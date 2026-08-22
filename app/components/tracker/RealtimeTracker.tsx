import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router";
import type { OrbitDataFile } from "../../lib/oem/parseOem";
import {
  expandCartesianVelocity,
  interpolateState,
} from "../../lib/oem/interpolate";
import { eciToGeodetic } from "../../lib/oem/eciToGeodetic";
import { loadOrbitData, loadNews, type NewsFile } from "../../lib/cmse/loadOrbit";
import {
  buildGsToCssAccessRequest,
  PRESET_SITES,
} from "../../lib/astrox/buildAccessRequest";
import {
  postAccessComputeV2,
  type AccessPass,
} from "../../lib/astrox/client";
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
  const d = new Date(iso);
  return d.toLocaleString("zh-CN", { timeZone: "Asia/Shanghai", hour12: false });
}

export function RealtimeTracker() {
  const [orbit, setOrbit] = useState<OrbitDataFile | null>(null);
  const [news, setNews] = useState<NewsFile | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [siteIdx, setSiteIdx] = useState(1); // 三亚
  const [passes, setPasses] = useState<AccessPass[] | null>(null);
  const [accessMsg, setAccessMsg] = useState<string | null>(null);
  const [accessLoading, setAccessLoading] = useState(false);

  useEffect(() => {
    const ac = new AbortController();
    Promise.all([loadOrbitData(ac.signal), loadNews(ac.signal)])
      .then(([o, n]) => {
        setOrbit(o);
        setNews(n);
      })
      .catch((e) => setError(e instanceof Error ? e.message : String(e)));
    return () => ac.abort();
  }, []);

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
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
  const inWindow = orbit ? now >= startMs && now <= stopMs : false;
  const queryMs = orbit
    ? Math.min(Math.max(now, startMs), stopMs)
    : now;

  const { geodetic, clamped } = useMemo(() => {
    if (!states.length) return { geodetic: null, clamped: false };
    const { state, clamped } = interpolateState(states, queryMs);
    return {
      geodetic: eciToGeodetic(state.positionM, state.timeMs),
      clamped,
    };
  }, [states, queryMs]);

  const track = useMemo(() => {
    if (!states.length) return [];
    // 未来约 3 小时星下点（~2 圈）
    const out: { lon: number; lat: number }[] = [];
    const t0 = queryMs;
    const t1 = Math.min(queryMs + 3 * 3600 * 1000, stopMs || queryMs);
    for (let t = t0; t <= t1; t += 60_000) {
      const { state } = interpolateState(states, t);
      const g = eciToGeodetic(state.positionM, state.timeMs);
      out.push({ lon: g.longitudeDeg, lat: g.latitudeDeg });
    }
    return out;
  }, [states, queryMs, stopMs]);

  async function computePasses() {
    if (!orbit) return;
    setAccessLoading(true);
    setAccessMsg(null);
    setPasses(null);
    const site = PRESET_SITES[siteIdx]!;
    const start = new Date(Math.max(now, startMs));
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

  const utcStr = new Date(now).toISOString().replace("T", " ").slice(0, 19) + " UTC";
  const bjStr = new Date(now).toLocaleString("zh-CN", {
    timeZone: "Asia/Shanghai",
    hour12: false,
  });

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-4 p-4 pb-10">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-medium tracking-wide text-sky-400/90">
            实时追踪 · 中国空间站
          </p>
          <h1 className="mt-1 text-2xl font-semibold text-slate-100 sm:text-3xl">
            天宫当前位置
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-slate-400">
            轨道数据来自中国载人航天工程办公室公开发布的 OEM（约{" "}
            {orbit?.validityDays ?? 7}{" "}
            天有效）。默认实时模式；过期后自动使用最新官方星历并钳制到有效窗口。
          </p>
        </div>
        <div className="rounded-lg border border-slate-700 bg-slate-900/70 px-4 py-3 text-right font-mono text-sm text-slate-200">
          <div>{bjStr}（北京时间）</div>
          <div className="text-slate-400">{utcStr}</div>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-amber-700/50 bg-amber-950/40 px-4 py-3 text-sm text-amber-100">
          {error}
        </div>
      )}

      {!inWindow && orbit && (
        <div className="rounded-lg border border-amber-700/40 bg-amber-950/30 px-4 py-2 text-sm text-amber-100/90">
          当前时刻不在本套 OEM 有效区间（{orbit.meta.startTime} →{" "}
          {orbit.meta.stopTime}）内，已使用最新官方星历并钳制显示。请等待每日自动更新抓取新文件。
        </div>
      )}

      <TrackerMap
        track={track}
        current={
          geodetic
            ? { lon: geodetic.longitudeDeg, lat: geodetic.latitudeDeg }
            : null
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
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
          label="数据状态"
          value={clamped ? "窗口边界" : inWindow ? "实时有效" : "加载中"}
        />
      </div>

      <section className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-slate-700/70 bg-slate-900/50 p-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-lg font-medium text-slate-100">即将过境</h2>
            <select
              className="rounded-md border border-slate-600 bg-slate-800 px-2 py-1 text-sm"
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
          <p className="mb-3 text-xs text-slate-400">
            由 ASTROX AccessComputeV2 计算（地面站 SitePosition + OEM
            CzmlPosition）。服务不可用时会优雅降级提示。
          </p>
          {accessLoading && (
            <p className="text-sm text-slate-400">正在计算可见弧段…</p>
          )}
          {accessMsg && (
            <p className="text-sm text-amber-200/90">{accessMsg}</p>
          )}
          {passes && passes.length > 0 && (
            <ul className="max-h-64 space-y-2 overflow-y-auto text-sm">
              {passes.slice(0, 8).map((p) => (
                <li
                  key={p.AccessStart}
                  className="rounded-lg border border-slate-700/60 bg-slate-950/40 px-3 py-2"
                >
                  <div className="font-medium text-sky-300">
                    {toBeijing(p.AccessStart)} → {toBeijing(p.AccessStop)}
                  </div>
                  <div className="mt-0.5 text-slate-400">
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
              className="rounded-md bg-sky-600 px-3 py-1.5 text-sm text-white hover:bg-sky-500"
            >
              重新计算
            </button>
            <Link
              to="/access"
              className="rounded-md border border-slate-600 px-3 py-1.5 text-sm text-slate-200 hover:bg-slate-800"
            >
              高级可见性分析
            </Link>
          </div>
        </div>

        <div className="rounded-xl border border-slate-700/70 bg-slate-900/50 p-4">
          <h2 className="mb-3 text-lg font-medium text-slate-100">
            轨道数据来源
          </h2>
          {orbit ? (
            <dl className="space-y-2 text-sm text-slate-300">
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
              <Row k="参考系" v={`${orbit.meta.refFrame} / ${orbit.meta.timeSystem}`} />
              <Row k="发布机构" v={orbit.meta.originator} />
              <Row k="抓取时间" v={new Date(orbit.fetchedAt).toLocaleString("zh-CN")} />
            </dl>
          ) : (
            <p className="text-sm text-slate-400">加载中…</p>
          )}
          <h2 className="mb-2 mt-5 text-lg font-medium text-slate-100">
            综合新闻
          </h2>
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
          {news && (
            <a
              href={news.source}
              target="_blank"
              rel="noreferrer"
              className="mt-2 inline-block text-xs text-slate-500 hover:text-slate-300"
            >
              来源：中国载人航天 · 综合新闻 →
            </a>
          )}
        </div>
      </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-700/70 bg-slate-900/50 px-4 py-3">
      <div className="text-xs text-slate-500">{label}</div>
      <div className="mt-1 font-mono text-xl text-slate-100">{value}</div>
    </div>
  );
}

function Row({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="flex gap-2">
      <dt className="w-20 shrink-0 text-slate-500">{k}</dt>
      <dd className="min-w-0 break-all">{v}</dd>
    </div>
  );
}
