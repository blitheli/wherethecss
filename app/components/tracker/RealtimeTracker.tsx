import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Link } from "react-router";
import { useAtomValue } from "jotai";
import {
  expandCartesianVelocity,
  interpolateState,
} from "../../lib/oem/interpolate";
import { eciToGeodetic } from "../../lib/oem/eciToGeodetic";
import { loadNews, type NewsFile } from "../../lib/cmse/loadOrbit";
import {
  buildGsToCssAccessRequest,
  PRESET_SITES,
} from "../../lib/astrox/buildAccessRequest";
import {
  postAccessComputeV2,
  type AccessPass,
} from "../../lib/astrox/client";
import {
  orbitDataAtom,
  orbitLoadErrorAtom,
  playbackModeAtom,
  simTimeMsAtom,
} from "../../lib/clock/simClock";
import { TrackerMap } from "./TrackerMap";

function fmtCoord(n: number, digits = 2) {
  return n.toFixed(digits);
}

function fmtDuration(sec: number) {
  const m = Math.floor(sec / 60);
  const s = Math.round(sec % 60);
  return `${m}分${s.toString().padStart(2, "0")}秒`;
}

function toBeijing(iso: string) {
  return new Date(iso).toLocaleString("zh-CN", {
    timeZone: "Asia/Shanghai",
    hour12: false,
  });
}

export function RealtimeTracker() {
  const orbit = useAtomValue(orbitDataAtom);
  const error = useAtomValue(orbitLoadErrorAtom);
  const simTimeMs = useAtomValue(simTimeMsAtom);
  const mode = useAtomValue(playbackModeAtom);

  const [news, setNews] = useState<NewsFile | null>(null);
  const [siteIdx, setSiteIdx] = useState(1);
  const [passes, setPasses] = useState<AccessPass[] | null>(null);
  const [accessMsg, setAccessMsg] = useState<string | null>(null);
  const [accessLoading, setAccessLoading] = useState(false);

  useEffect(() => {
    const ac = new AbortController();
    loadNews(ac.signal).then(setNews).catch(() => {});
    return () => ac.abort();
  }, []);

  const states = useMemo(
    () =>
      orbit
        ? expandCartesianVelocity(orbit.epoch, orbit.cartesianVelocity)
        : [],
    [orbit],
  );

  const startMs = orbit ? Date.parse(orbit.meta.startTime) : 0;
  const stopMs = orbit ? Date.parse(orbit.meta.stopTime) : 0;
  const wallNow = Date.now();
  const wallInWindow = orbit ? wallNow >= startMs && wallNow <= stopMs : false;

  const { geodetic, clamped } = useMemo(() => {
    if (!states.length) return { geodetic: null, clamped: false };
    const { state, clamped } = interpolateState(states, simTimeMs);
    return {
      geodetic: eciToGeodetic(state.positionM, state.timeMs),
      clamped,
    };
  }, [states, simTimeMs]);

  /** CSS 轨道周期约 92.5 min；绘制以当前时刻为中心约 2 圈星下点 */
  const track = useMemo(() => {
    if (!states.length) return [];
    const PERIOD_MS = 92.5 * 60 * 1000;
    const out: { lon: number; lat: number }[] = [];
    const t0 = Math.max(simTimeMs - PERIOD_MS, startMs);
    const t1 = Math.min(simTimeMs + PERIOD_MS, stopMs || simTimeMs);
    for (let t = t0; t <= t1; t += 30_000) {
      const { state } = interpolateState(states, t);
      const g = eciToGeodetic(state.positionM, state.timeMs);
      out.push({ lon: g.longitudeDeg, lat: g.latitudeDeg });
    }
    return out;
  }, [states, simTimeMs, startMs, stopMs]);

  async function computePasses() {
    if (!orbit) return;
    setAccessLoading(true);
    setAccessMsg(null);
    setPasses(null);
    const site = PRESET_SITES[siteIdx]!;
    const start = new Date(Math.max(Date.now(), startMs));
    const stop = new Date(
      Math.min(start.getTime() + 24 * 3600 * 1000, stopMs),
    );
    try {
      const body = buildGsToCssAccessRequest({
        site,
        orbit,
        startIso: start.toISOString(),
        stopIso: stop.toISOString(),
        outStep: 30,
        computeAER: true,
      });
      const result = await postAccessComputeV2(body, { timeoutMs: 90000 });
      if (!result.ok) {
        setAccessMsg(
          `可见性计算不可用：${result.message}。请稍后重试，或确认 ASTROX（http://astrox.cn:8765）可达。`,
        );
        return;
      }
      setPasses(result.data.Passes ?? []);
      if (!result.data.Passes?.length) {
        setAccessMsg("未来 24 小时内无满足仰角约束的可见弧段。");
      }
    } catch (e) {
      setAccessMsg(e instanceof Error ? e.message : String(e));
    } finally {
      setAccessLoading(false);
    }
  }

  useEffect(() => {
    if (orbit) void computePasses();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orbit, siteIdx]);

  const modeLabel = mode === "realtime" ? "实时" : "非实时回放";

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-4 p-4 pb-6">
      <div>
        <p className="text-xs font-medium tracking-wide text-sky-400/90">
          任务控制 · 中国空间站
        </p>
        <h1 className="mt-1 text-2xl font-semibold text-zinc-50 sm:text-3xl">
          天宫当前位置
        </h1>
        <p className="mt-1 max-w-2xl text-sm text-zinc-400">
          轨道数据来自中国载人航天工程办公室 OEM（约{" "}
          {orbit?.validityDays ?? 7}{" "}
          天有效）。2D/3D 共用底部时间轴；「实时」跟随当前时刻，「非实时」可在有效窗内 scrub。
        </p>
      </div>

      {error && (
        <div className="rounded-lg border border-amber-700/50 bg-amber-950/40 px-4 py-3 text-sm text-amber-100">
          {error}
        </div>
      )}

      {!wallInWindow && orbit && mode === "realtime" && (
        <div className="rounded-lg border border-amber-700/40 bg-amber-950/30 px-4 py-2 text-sm text-amber-100/90">
          墙钟不在本套 OEM 有效区间（{orbit.meta.startTime} →{" "}
          {orbit.meta.stopTime}）内，已钳制到窗口边界。请等待每日更新。
        </div>
      )}

      <TrackerMap
        track={track}
        current={
          geodetic
            ? { lon: geodetic.longitudeDeg, lat: geodetic.latitudeDeg }
            : null
        }
        simTimeMs={simTimeMs}
        modeLabel={modeLabel}
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat
          label="经度"
          value={geodetic ? `${fmtCoord(geodetic.longitudeDeg)}°` : "—"}
        />
        <Stat
          label="纬度"
          value={geodetic ? `${fmtCoord(geodetic.latitudeDeg)}°` : "—"}
        />
        <Stat
          label="高度"
          value={
            geodetic ? `${fmtCoord(geodetic.heightM / 1000, 1)} km` : "—"
          }
        />
        <Stat
          label="模式"
          value={
            mode === "realtime"
              ? clamped
                ? "实时·边界"
                : "实时"
              : "非实时"
          }
        />
      </div>

      <section className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-zinc-800 bg-zinc-950/80 p-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-lg font-medium text-zinc-100">即将过境</h2>
            <select
              className="rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1 text-sm text-zinc-200"
              value={siteIdx}
              onChange={(e) => setSiteIdx(Number(e.target.value))}
            >
              {PRESET_SITES.map((s, i) => (
                <option key={s.name} value={i}>
                  {s.name}（仰角≥{s.minElevationDeg ?? 10}°）
                </option>
              ))}
            </select>
          </div>
          <p className="mb-3 text-xs text-zinc-500">
            ASTROX AccessComputeV2（地面站 + OEM CzmlPosition）。
          </p>
          {accessLoading && (
            <p className="text-sm text-zinc-400">正在计算可见弧段…</p>
          )}
          {accessMsg && (
            <p className="text-sm text-amber-200/90">{accessMsg}</p>
          )}
          {passes && passes.length > 0 && (
            <ul className="max-h-64 space-y-2 overflow-y-auto text-sm">
              {passes.slice(0, 8).map((p) => (
                <li
                  key={p.AccessStart}
                  className="rounded-lg border border-zinc-800 bg-black/40 px-3 py-2"
                >
                  <div className="font-medium text-sky-300">
                    {toBeijing(p.AccessStart)} → {toBeijing(p.AccessStop)}
                  </div>
                  <div className="mt-0.5 text-zinc-500">
                    时长 {fmtDuration(p.Duration)}
                    {p.MaxElevationData != null &&
                      ` · 最大仰角 ${p.MaxElevationData.Elevation.toFixed(1)}°`}
                  </div>
                </li>
              ))}
            </ul>
          )}
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={() => void computePasses()}
              className="rounded-md bg-sky-700 px-3 py-1.5 text-sm text-white hover:bg-sky-600"
            >
              重新计算
            </button>
            <Link
              to="/access"
              className="rounded-md border border-zinc-700 px-3 py-1.5 text-sm text-zinc-200 hover:bg-zinc-900"
            >
              高级可见性分析
            </Link>
          </div>
        </div>

        <div className="rounded-xl border border-zinc-800 bg-zinc-950/80 p-4">
          <h2 className="mb-3 text-lg font-medium text-zinc-100">轨道数据来源</h2>
          {orbit ? (
            <dl className="space-y-2 text-sm text-zinc-300">
              <Row
                k="官方页面"
                v={
                  <a
                    className="text-sky-400 hover:underline"
                    href={orbit.sourcePage}
                    target="_blank"
                    rel="noreferrer"
                  >
                    cmse.gov.cn 中国空间站轨道参数
                  </a>
                }
              />
              <Row k="文件" v={orbit.fileName} />
              <Row k="发布日期" v={orbit.publishDate ?? "—"} />
              <Row
                k="有效区间"
                v={`${orbit.meta.startTime} → ${orbit.meta.stopTime}`}
              />
              <Row
                k="参考系"
                v={`${orbit.meta.refFrame} / ${orbit.meta.timeSystem}`}
              />
              <Row k="发布机构" v={orbit.meta.originator} />
            </dl>
          ) : (
            <p className="text-sm text-zinc-500">加载中…</p>
          )}
          <h2 className="mb-2 mt-5 text-lg font-medium text-zinc-100">综合新闻</h2>
          <ul className="space-y-1.5 text-sm">
            {(news?.items ?? []).slice(0, 6).map((item) => (
              <li key={item.url}>
                <a
                  href={item.url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-sky-300/90 hover:underline"
                >
                  {item.title}
                </a>
              </li>
            ))}
          </ul>
        </div>
      </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-950/80 px-4 py-3">
      <div className="text-xs text-zinc-500">{label}</div>
      <div className="mt-1 font-mono text-xl text-zinc-50">{value}</div>
    </div>
  );
}

function Row({ k, v }: { k: string; v: ReactNode }) {
  return (
    <div className="flex gap-2">
      <dt className="w-20 shrink-0 text-zinc-500">{k}</dt>
      <dd className="min-w-0 break-all">{v}</dd>
    </div>
  );
}
