import { useEffect, useState } from "react";
import type { Route } from "./+types/access";
import type { OrbitDataFile } from "../lib/oem/parseOem";
import { loadOrbitData } from "../lib/cmse/loadOrbit";
import {
  buildGsToCssAccessRequest,
  PRESET_SITES,
} from "../lib/astrox/buildAccessRequest";
import {
  postAccessComputeV2,
  type AccessPass,
} from "../lib/astrox/client";

export function meta({}: Route.MetaArgs) {
  return [{ title: "可见性分析 · 中国空间站" }];
}

function toBeijing(iso: string) {
  return new Date(iso).toLocaleString("zh-CN", {
    timeZone: "Asia/Shanghai",
    hour12: false,
  });
}

export default function AccessPage() {
  const [orbit, setOrbit] = useState<OrbitDataFile | null>(null);
  const [siteIdx, setSiteIdx] = useState(1);
  const [hours, setHours] = useState(24);
  const [minEl, setMinEl] = useState(10);
  const [passes, setPasses] = useState<AccessPass[] | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<"gs-sat" | "sat-sat">("gs-sat");

  useEffect(() => {
    loadOrbitData().then(setOrbit).catch((e) => setMsg(String(e)));
  }, []);

  async function run() {
    if (!orbit) return;
    setLoading(true);
    setMsg(null);
    setPasses(null);
    const now = Date.now();
    const startMs = Math.max(now, Date.parse(orbit.meta.startTime));
    const stopMs = Math.min(
      startMs + hours * 3600 * 1000,
      Date.parse(orbit.meta.stopTime),
    );

    if (mode === "sat-sat") {
      setMsg(
        "卫星—卫星可见性：两端均使用同一套 CSS OEM 时无相对运动意义。请在后续版本接入第二目标星历；当前请使用「地面站—空间站」模式。",
      );
      setLoading(false);
      return;
    }

    const site = {
      ...PRESET_SITES[siteIdx]!,
      minElevationDeg: minEl,
    };
    const body = buildGsToCssAccessRequest({
      site,
      orbit,
      startIso: new Date(startMs).toISOString(),
      stopIso: new Date(stopMs).toISOString(),
      outStep: 30,
      computeAER: true,
    });
    const result = await postAccessComputeV2(body, { timeoutMs: 120000 });
    setLoading(false);
    if (!result.ok) {
      setMsg(`ASTROX 不可用：${result.message}`);
      return;
    }
    setPasses(result.data.Passes ?? []);
    if (!result.data.Passes?.length) setMsg("无可见弧段。");
  }

  return (
    <div className="mx-auto max-w-3xl p-4 pb-12">
      <h1 className="text-2xl font-semibold text-slate-100">可见性 / Access</h1>
      <p className="mt-2 text-sm text-slate-400">
        按{" "}
        <a
          className="text-sky-400 hover:underline"
          href="https://github.com/blitheli/astrox-skills/tree/main/skills/access"
          target="_blank"
          rel="noreferrer"
        >
          ASTROX access 技能
        </a>{" "}
        调用{" "}
        <code className="text-slate-300">POST /access/AccessComputeV2</code>
        。空间站位置使用 CMSE OEM 转 CzmlPosition（EME2000/INERTIAL，米制），不编造
        TLE。
      </p>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <label className="text-sm">
          <span className="text-slate-400">模式</span>
          <select
            className="mt-1 w-full rounded-md border border-slate-600 bg-slate-800 px-2 py-2"
            value={mode}
            onChange={(e) => setMode(e.target.value as "gs-sat" | "sat-sat")}
          >
            <option value="gs-sat">地面站 → 空间站</option>
            <option value="sat-sat">卫星 → 卫星（预留）</option>
          </select>
        </label>
        <label className="text-sm">
          <span className="text-slate-400">地面站</span>
          <select
            className="mt-1 w-full rounded-md border border-slate-600 bg-slate-800 px-2 py-2"
            value={siteIdx}
            onChange={(e) => setSiteIdx(Number(e.target.value))}
          >
            {PRESET_SITES.map((s, i) => (
              <option key={s.name} value={i}>
                {s.name}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          <span className="text-slate-400">分析时长（小时）</span>
          <input
            type="number"
            min={1}
            max={72}
            className="mt-1 w-full rounded-md border border-slate-600 bg-slate-800 px-2 py-2"
            value={hours}
            onChange={(e) => setHours(Number(e.target.value))}
          />
        </label>
        <label className="text-sm">
          <span className="text-slate-400">最小仰角（°）</span>
          <input
            type="number"
            min={0}
            max={45}
            className="mt-1 w-full rounded-md border border-slate-600 bg-slate-800 px-2 py-2"
            value={minEl}
            onChange={(e) => setMinEl(Number(e.target.value))}
          />
        </label>
      </div>

      <button
        type="button"
        onClick={() => void run()}
        disabled={loading || !orbit}
        className="mt-4 rounded-md bg-sky-600 px-4 py-2 text-sm text-white hover:bg-sky-500 disabled:opacity-50"
      >
        {loading ? "计算中…" : "开始计算"}
      </button>

      {msg && <p className="mt-3 text-sm text-amber-200">{msg}</p>}

      {passes && passes.length > 0 && (
        <table className="mt-4 w-full text-left text-sm text-slate-300">
          <thead className="text-slate-500">
            <tr>
              <th className="py-2">开始（北京）</th>
              <th>结束（北京）</th>
              <th>时长</th>
              <th>最大仰角</th>
            </tr>
          </thead>
          <tbody>
            {passes.map((p) => (
              <tr key={p.AccessStart} className="border-t border-slate-800">
                <td className="py-2">{toBeijing(p.AccessStart)}</td>
                <td>{toBeijing(p.AccessStop)}</td>
                <td>{Math.round(p.Duration)} s</td>
                <td>
                  {p.MaxElevationData
                    ? `${p.MaxElevationData.Elevation.toFixed(1)}°`
                    : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
