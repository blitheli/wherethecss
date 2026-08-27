import { useEffect, type ReactNode } from "react";
import { useAtom, useAtomValue, useSetAtom } from "jotai";
import { loadOrbitData } from "../../lib/cmse/loadOrbit";
import {
  clampToOemWindow,
  orbitDataAtom,
  orbitLoadErrorAtom,
  playbackModeAtom,
  simTimeMsAtom,
} from "../../lib/clock/simClock";

/** 加载 OEM，并在「实时」模式下每秒推进仿真时钟 */
export function SimClockProvider({ children }: { children: ReactNode }) {
  const mode = useAtomValue(playbackModeAtom);
  const [simTimeMs, setSimTimeMs] = useAtom(simTimeMsAtom);
  const setOrbit = useSetAtom(orbitDataAtom);
  const setError = useSetAtom(orbitLoadErrorAtom);
  const orbit = useAtomValue(orbitDataAtom);

  useEffect(() => {
    const ac = new AbortController();
    loadOrbitData(ac.signal)
      .then((data) => {
        setOrbit(data);
        setError(null);
        const start = Date.parse(data.meta.startTime);
        const stop = Date.parse(data.meta.stopTime);
        setSimTimeMs(clampToOemWindow(Date.now(), start, stop));
      })
      .catch((e) =>
        setError(e instanceof Error ? e.message : String(e)),
      );
    return () => ac.abort();
  }, [setOrbit, setError, setSimTimeMs]);

  useEffect(() => {
    if (mode !== "realtime" || !orbit) return;
    const start = Date.parse(orbit.meta.startTime);
    const stop = Date.parse(orbit.meta.stopTime);
    const tick = () => {
      setSimTimeMs(clampToOemWindow(Date.now(), start, stop));
    };
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [mode, orbit, setSimTimeMs]);

  // silence unused in provider tree
  void simTimeMs;

  return <>{children}</>;
}
