import { useMemo, useRef, type FC } from "react";
import { useFrame } from "@react-three/fiber";
import {
  BufferGeometry,
  CatmullRomCurve3,
  Float32BufferAttribute,
  Matrix4,
  Mesh,
  TubeGeometry,
  Vector3,
} from "three";
import {
  OBJECT_FRAME,
  WGS84_ELLIPSOID,
} from "3d-tiles-renderer/three";
import {
  interpolateState,
  type StateVector,
} from "../lib/oem/interpolate";
import { eciToEcef } from "../lib/oem/eciToGeodetic";

const PERIOD_MS = 92.5 * 60 * 1000;
const SAMPLE_MS = 30_000;
/** 管半径（米），LEO 旁足够粗以便看见 */
const TUBE_RADIUS_M = 1800;

const _local = new Vector3();
const _ecefToLocal = new Matrix4();

export type OrbitTrajectoryProps = {
  states: StateVector[];
  simTimeMs: number;
  startMs: number;
  stopMs: number;
  /** 当前重定向原点（与 ReorientationPlugin 同一组经纬高，弧度） */
  lonRad: number;
  latRad: number;
  heightM: number;
  color?: string;
};

/**
 * 约两圈 OEM 轨道丝带。
 * 用与 ReorientationPlugin 相同的 OBJECT_FRAME 把 ECEF → 局部（当前星下点≈原点）。
 */
export const OrbitTrajectory: FC<OrbitTrajectoryProps> = ({
  states,
  simTimeMs,
  startMs,
  stopMs,
  lonRad,
  latRad,
  heightM,
  color = "#5eead4",
}) => {
  const meshRef = useRef<Mesh>(null);
  const rebuildAcc = useRef(0);
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
      [new Vector3(-1e4, 0, 0), new Vector3(1e4, 0, 0)],
      false,
    );
    return new TubeGeometry(c, 8, TUBE_RADIUS_M, 5, false);
  }, []);

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

    // 与 ReorientationPlugin.transformLatLonHeightToOrigin 同一变换
    WGS84_ELLIPSOID.getObjectFrame(
      latRad,
      lonRad,
      heightM,
      0,
      0,
      0,
      _ecefToLocal,
      OBJECT_FRAME,
    );
    _ecefToLocal.invert();

    const locals: Vector3[] = [];
    for (const p of ecefSamples) {
      _local.copy(p).applyMatrix4(_ecefToLocal);
      locals.push(_local.clone());
    }
    if (locals.length < 2) return;

    const attr = lineGeom.getAttribute("position") as Float32BufferAttribute;
    const n = Math.min(locals.length, attr.count);
    for (let i = 0; i < n; i++) {
      attr.setXYZ(i, locals[i]!.x, locals[i]!.y, locals[i]!.z);
    }
    attr.needsUpdate = true;
    lineGeom.setDrawRange(0, n);
    lineGeom.computeBoundingSphere();

    rebuildAcc.current += delta;
    if (rebuildAcc.current < 0.2 || !meshRef.current) return;
    rebuildAcc.current = 0;

    const curve = new CatmullRomCurve3(locals, false, "catmullrom", 0.2);
    const tube = new TubeGeometry(
      curve,
      Math.min(locals.length * 2, 220),
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
          opacity={0.88}
          depthWrite={false}
        />
      </mesh>
      <line geometry={lineGeom} frustumCulled={false}>
        <lineBasicMaterial color="#99f6e4" transparent opacity={1} />
      </line>
    </group>
  );
};
