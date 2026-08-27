import { useMemo, useRef, type FC } from "react";
import { useFrame } from "@react-three/fiber";
import {
  Matrix4,
  Vector3,
  type InstancedMesh,
  Object3D,
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
const SAMPLE_MS = 20_000;
/** 轨迹珠半径（米） */
const BEAD_RADIUS_M = 3200;

const _local = new Vector3();
const _ecefToLocal = new Matrix4();
const _proxy = new Object3D();

export type OrbitTrajectoryProps = {
  states: StateVector[];
  simTimeMs: number;
  startMs: number;
  stopMs: number;
  lonRad: number;
  latRad: number;
  heightM: number;
  color?: string;
};

/**
 * 约两圈 OEM 轨道：实例化球体「珠串」+ 当前点高亮。
 * 与 ReorientationPlugin 共用 OBJECT_FRAME（ECEF→局部）。
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
  const instRef = useRef<InstancedMesh>(null);
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
    // 强制加入当前精确位置，保证轨迹过原点附近
    const { state: now } = interpolateState(states, simTimeMs);
    const [nx, ny, nz] = eciToEcef(now.positionM, now.timeMs);
    pts.push(new Vector3(nx, ny, nz));
    return pts;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [states, windowKey, startMs, stopMs, simTimeMs]);

  const count = ecefSamples.length;

  useFrame(() => {
    const mesh = instRef.current;
    if (!mesh || count < 2) return;

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

    for (let i = 0; i < count; i++) {
      _local.copy(ecefSamples[i]!).applyMatrix4(_ecefToLocal);
      _proxy.position.copy(_local);
      // 当前点（最后一个）略大
      const s = i === count - 1 ? 1.6 : 1;
      _proxy.scale.setScalar(s);
      _proxy.updateMatrix();
      mesh.setMatrixAt(i, _proxy.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
    mesh.computeBoundingSphere();
  });

  if (count < 2) return null;

  return (
    <instancedMesh
      ref={instRef}
      args={[undefined, undefined, count]}
      frustumCulled={false}
    >
      <sphereGeometry args={[BEAD_RADIUS_M, 10, 10]} />
      <meshBasicMaterial color={color} transparent opacity={0.9} depthWrite={false} />
    </instancedMesh>
  );
};
