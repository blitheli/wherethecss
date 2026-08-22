import { useAtom, useAtomValue } from "jotai";
import {
  clampToOemWindow,
  formatBeijingClock,
  formatUtcShort,
  orbitDataAtom,
  playbackModeAtom,
  simTimeMsAtom,
  type PlaybackMode,
} from "../../lib/clock/simClock";

/** OEM 有效窗时间轴：实时跟随 / 非实时 scrub */
export function OemTimeline() {
  const orbit = useAtomValue(orbitDataAtom);
  const [mode, setMode] = useAtom(playbackModeAtom);
  const [simTimeMs, setSimTimeMs] = useAtom(simTimeMsAtom);

  if (!orbit) {
    return (
      <div className="z-40 shrink-0 border-t border-zinc-800 bg-zinc-950 px-4 py-3 text-xs text-zinc-500">
        正在加载 OEM 有效时间窗…
      </div>
    );
  }

  const startMs = Date.parse(orbit.meta.startTime);
  const stopMs = Date.parse(orbit.meta.stopTime);
  const span = Math.max(1, stopMs - startMs);
  const pct = ((simTimeMs - startMs) / span) * 100;
  const bj = formatBeijingClock(simTimeMs);

  function setModeAndSync(next: PlaybackMode) {
    setMode(next);
    if (next === "realtime") {
      setSimTimeMs(clampToOemWindow(Date.now(), startMs, stopMs));
    }
  }

  function onScrub(value: number) {
    setMode("replay");
    setSimTimeMs(clampToOemWindow(value, startMs, stopMs));
  }

  return (
    <div className="z-40 shrink-0 border-t border-zinc-800 bg-black px-3 py-3 sm:px-5">
      <div className="mx-auto flex max-w-6xl flex-col gap-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs tracking-wide text-zinc-500">OEM 时间轴</span>
            <div className="flex rounded-md border border-zinc-700 p-0.5 text-xs">
              <button
                type="button"
                className={`rounded px-2.5 py-1 ${
                  mode === "realtime"
                    ? "bg-emerald-600 text-white"
                    : "text-zinc-400 hover:text-zinc-200"
                }`}
                onClick={() => setModeAndSync("realtime")}
              >
                实时
              </button>
              <button
                type="button"
                className={`rounded px-2.5 py-1 ${
                  mode === "replay"
                    ? "bg-amber-600 text-white"
                    : "text-zinc-400 hover:text-zinc-200"
                }`}
                onClick={() => setModeAndSync("replay")}
              >
                非实时
              </button>
            </div>
            <span className="font-mono text-xs text-zinc-300">
              {bj.date} {bj.time}（北京）
            </span>
            <span className="hidden font-mono text-xs text-zinc-500 sm:inline">
              {formatUtcShort(simTimeMs)}
            </span>
          </div>
          <div className="font-mono text-[10px] text-zinc-500 sm:text-xs">
            {orbit.meta.startTime.slice(0, 10)} → {orbit.meta.stopTime.slice(0, 10)}（约{" "}
            {orbit.validityDays} 天）
          </div>
        </div>

        <div className="relative flex h-6 items-center">
          <div className="pointer-events-none absolute inset-x-0 h-2 rounded-full bg-zinc-800" />
          <div
            className="pointer-events-none absolute left-0 h-2 rounded-full bg-sky-500/50"
            style={{ width: `${Math.min(100, Math.max(0, pct))}%` }}
          />
          <input
            type="range"
            min={startMs}
            max={stopMs}
            step={60_000}
            value={simTimeMs}
            onChange={(e) => onScrub(Number(e.target.value))}
            onInput={(e) => onScrub(Number((e.target as HTMLInputElement).value))}
            className="relative z-10 h-2 w-full cursor-pointer appearance-none bg-transparent accent-sky-400"
            aria-label="OEM 有效窗时间轴"
          />
        </div>
      </div>
    </div>
  );
}
