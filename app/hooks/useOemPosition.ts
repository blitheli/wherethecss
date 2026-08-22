import { useMemo } from "react";
import { useAtomValue } from "jotai";
import {
  expandCartesianVelocity,
  interpolateState,
} from "../lib/oem/interpolate";
import { eciToGeodetic, type Geodetic } from "../lib/oem/eciToGeodetic";
import { orbitDataAtom, simTimeMsAtom } from "../lib/clock/simClock";

/** 从共享仿真时钟 + CMSE OEM 插值得到 WGS84 经纬高 */
export function useOemPosition(): {
  geodetic: Geodetic | null;
  simTimeMs: number;
  ready: boolean;
} {
  const orbit = useAtomValue(orbitDataAtom);
  const simTimeMs = useAtomValue(simTimeMsAtom);

  const states = useMemo(
    () =>
      orbit
        ? expandCartesianVelocity(orbit.epoch, orbit.cartesianVelocity)
        : [],
    [orbit],
  );

  const geodetic = useMemo(() => {
    if (!states.length) return null;
    const { state } = interpolateState(states, simTimeMs);
    return eciToGeodetic(state.positionM, state.timeMs);
  }, [states, simTimeMs]);

  return { geodetic, simTimeMs, ready: Boolean(orbit && geodetic) };
}
