import { useMemo } from "react";
import { useAtomValue } from "jotai";
import {
  expandCartesianVelocity,
  interpolateState,
  type StateVector,
} from "../lib/oem/interpolate";
import {
  eciToEcef,
  eciToGeodetic,
  type Geodetic,
} from "../lib/oem/eciToGeodetic";
import { orbitDataAtom, simTimeMsAtom } from "../lib/clock/simClock";

export type OemMotion = {
  geodetic: Geodetic | null;
  /** EME2000 位置（米） */
  eciM: [number, number, number] | null;
  /** ECEF 位置（米） */
  ecefM: [number, number, number] | null;
  simTimeMs: number;
  ready: boolean;
  states: StateVector[];
  startMs: number;
  stopMs: number;
};

/** 从共享仿真时钟 + CMSE OEM 插值得到 ECI/ECEF/大地坐标（无阻尼，供平滑飞行） */
export function useOemMotion(): OemMotion {
  const orbit = useAtomValue(orbitDataAtom);
  const simTimeMs = useAtomValue(simTimeMsAtom);

  const states = useMemo(
    () =>
      orbit
        ? expandCartesianVelocity(orbit.epoch, orbit.cartesianVelocity)
        : [],
    [orbit],
  );

  const startMs = orbit ? Date.parse(orbit.meta.startTime) : 0;
  const stopMs = orbit ? Date.parse(orbit.meta.stopTime) : 0;

  const motion = useMemo(() => {
    if (!states.length) {
      return {
        geodetic: null as Geodetic | null,
        eciM: null as [number, number, number] | null,
        ecefM: null as [number, number, number] | null,
      };
    }
    const { state } = interpolateState(states, simTimeMs);
    const eciM = state.positionM;
    const ecefM = eciToEcef(eciM, state.timeMs);
    const geodetic = eciToGeodetic(eciM, state.timeMs);
    return { geodetic, eciM, ecefM };
  }, [states, simTimeMs]);

  return {
    ...motion,
    simTimeMs,
    ready: Boolean(orbit && motion.geodetic),
    states,
    startMs,
    stopMs,
  };
}

/** 兼容旧钩子 */
export function useOemPosition(): {
  geodetic: Geodetic | null;
  simTimeMs: number;
  ready: boolean;
} {
  const { geodetic, simTimeMs, ready } = useOemMotion();
  return { geodetic, simTimeMs, ready };
}
