import { useMemo, useRef, type FC } from "react";
import { useFrame } from "@react-three/fiber";
import { Line } from "@react-three/drei";
import { Matrix4, Vector3 } from "three";
import type { Line2 } from "three-stdlib";
import {
  interpolateState,
  type StateVector,
} from "../lib/oem/interpolate";
import { eciToEcef } from "../lib/oem/eciToGeodetic";

const PERIOD_MS = 92.5 * 60 * 1000;
const SAMPLE_MS = 20_000;

const _local = new Vector3();
const _ecefToWorld = new Matrix4();

export type OrbitTrajectoryProps = {
  states: StateVector[];
  simTimeMs: number;
  startMs: number;
  stopMs: number;
  matrixWorldToEcef: Matrix4;
  color?: string;
};

/**
 * 约 ±1 轨（共约 2 圈）OEM 轨道线。
 * ECEF 采样缓存；每帧用 matrixWorldToEcef⁻¹ 投到 LEO 局部系。
 */
export const OrbitTrajectory: FC<OrbitTrajectoryProps> = ({
  states,
  simTimeMs,
  startMs,
  stopMs,
  matrixWorldToEcef,
  color = "#5eead4",
}) => {
  const lineRef = useRef<Line2>(null);

  const ecefSamples = useMemo(() => {
    if (!states.length) return [] as Vector3[];
    const t0 = Math.max(simTimeMs - PERIOD_MS, startMs || states[0]!.timeMs);
    const t1 = Math.min(
      simTimeMs + PERIOD_MS,
      stopMs || states[states.length - 1]!.timeMs,
    );
    const pts: Vector3[] = [];
    for (let t = t0; t <= t1; t += SAMPLE_MS) {
      const { state } = interpolateState(states, t);
      const [x, y, z] = eciToEcef(state.positionM, state.timeMs);
      pts.push(new Vector3(x, y, z));
    }
    return pts;
  }, [states, simTimeMs, startMs, stopMs]);

  const placeholder = useMemo(
    () => ecefSamples.map(() => new Vector3(0, 0, 0)),
    [ecefSamples],
  );

  useFrame(() => {
    const line = lineRef.current;
    if (!line || ecefSamples.length < 2) return;
    _ecefToWorld.copy(matrixWorldToEcef).invert();
    const flat: number[] = [];
    for (const p of ecefSamples) {
      _local.copy(p).applyMatrix4(_ecefToWorld);
      flat.push(_local.x, _local.y, _local.z);
    }
    line.geometry.setPositions(flat);
  });

  if (ecefSamples.length < 2) return null;

  return (
    <Line
      ref={lineRef}
      points={placeholder}
      color={color}
      lineWidth={2.5}
      transparent
      opacity={0.95}
      depthWrite={false}
    />
  );
};
