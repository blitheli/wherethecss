import { useMemo, useRef, type FC } from "react";
import { useFrame } from "@react-three/fiber";
import {
  BufferGeometry,
  CatmullRomCurve3,
  Float32BufferAttribute,
  Matrix4,
  TubeGeometry,
  Vector3,
} from "three";
import {
  interpolateState,
  type StateVector,
} from "../lib/oem/interpolate";
import { eciToEcef } from "../lib/oem/eciToGeodetic";

const PERIOD_MS = 92.5 * 60 * 1000;
const SAMPLE_MS = 30_000;
/** 管半径（米）：LEO 旁可视 */
const TUBE_RADIUS_M = 2500;

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
 * 约两圈 OEM 轨道丝带。
 * ECEF 采样按时间窗缓存；每帧投到局部系后节流重建 Tube（兼容 WebGL/WebGPU）。
 */
export const OrbitTrajectory: FC<OrbitTrajectoryProps> = ({
  states,
  simTimeMs,
  startMs,
  stopMs,
  matrixWorldToEcef,
  color = "#5eead4",
}) => {
  const meshRef = useRef<THREE.Mesh>(null);
  const rebuildAcc = useRef(0);
  const localPts = useRef<Vector3[]>([]);

  // 按采样节拍量化时间窗，避免每秒重建采样
  const windowKey = Math.floor(simTimeMs / SAMPLE_MS);

  const ecefSamples = useMemo(() => {
    if (!states.length) return [] as Vector3[];
    const center = windowKey * SAMPLE_MS;
    const t0 = Math.max(center - PERIOD_MS, startMs || states[0]!.timeMs);
    const t1 = Math.min(
      center + PERIOD_MS,
      stopMs || states[states.length - 1]!.timeMs,
    );
    const pts: Vector3[] = [];
    for (let t = t0; t <= t1; t += SAMPLE_MS) {
      const { state } = interpolateState(states, t);
      const [x, y, z] = eciToEcef(state.positionM, state.timeMs);
      pts.push(new Vector3(x, y, z));
    }
    return pts;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [states, windowKey, startMs, stopMs]);

  const bootGeom = useMemo(() => {
    const c = new CatmullRomCurve3(
      [new Vector3(0, 0, 0), new Vector3(10, 0, 0)],
      false,
    );
    return new TubeGeometry(c, 8, TUBE_RADIUS_M, 5, false);
  }, []);

  // 细折线（双保险，Tube 重建间隙也能看到）
  const lineGeom = useMemo(() => {
    const g = new BufferGeometry();
    const n = Math.max(ecefSamples.length, 2);
    g.setAttribute(
      "position",
      new Float32BufferAttribute(new Float32Array(n * 3), 3),
    );
    return g;
  }, [ecefSamples.length]);

  useFrame((_, delta) => {
    if (ecefSamples.length < 2) return;
    _ecefToWorld.copy(matrixWorldToEcef).invert();

    const locals: Vector3[] = [];
    for (const p of ecefSamples) {
      _local.copy(p).applyMatrix4(_ecefToWorld);
      if (_local.length() < 2.5e7) locals.push(_local.clone());
    }
    if (locals.length < 2) return;
    localPts.current = locals;

    // 更新折线缓冲
    const attr = lineGeom.getAttribute("position") as Float32BufferAttribute;
    const n = Math.min(locals.length, attr.count);
    for (let i = 0; i < n; i++) {
      attr.setXYZ(i, locals[i]!.x, locals[i]!.y, locals[i]!.z);
    }
    attr.needsUpdate = true;
    lineGeom.setDrawRange(0, n);
    lineGeom.computeBoundingSphere();

    // 节流重建管状丝带（约 4 Hz）
    rebuildAcc.current += delta;
    if (rebuildAcc.current < 0.25 || !meshRef.current) return;
    rebuildAcc.current = 0;

    const curve = new CatmullRomCurve3(locals, false, "catmullrom", 0.2);
    const tube = new TubeGeometry(
      curve,
      Math.min(locals.length * 2, 200),
      TUBE_RADIUS_M,
      5,
      false,
    );
    const prev = meshRef.current.geometry;
    meshRef.current.geometry = tube;
    if (prev !== bootGeom) prev.dispose();
  });

  if (ecefSamples.length < 2) return null;

  return (
    <group>
      <mesh ref={meshRef} geometry={bootGeom} frustumCulled={false}>
        <meshBasicMaterial
          color={color}
          transparent
          opacity={0.8}
          depthWrite={false}
        />
      </mesh>
      <line geometry={lineGeom} frustumCulled={false}>
        <lineBasicMaterial color={color} transparent opacity={1} />
      </line>
    </group>
  );
};

// three namespace for Mesh type without importing namespace clash
import type * as THREE from "three";
