import { Suspense, useRef, useState, type FC } from "react";
import { useFrame } from "@react-three/fiber";
import {
  DirectionalLight,
  MathUtils,
  Matrix4,
  Vector3,
} from "three";
import { TilesPlugin } from "3d-tiles-renderer/r3f";
import {
  getECIToECEFRotationMatrix,
  getSunDirectionECI,
} from "@takram/three-atmosphere";
import { availableAtom, WebGPUCanvas } from "../components/WebGPUCanvas";
import { ReorientationPlugin } from "../plugins/ReorientationPlugin";
import { Globe } from "../components/Globe";
import { TG_glb } from "../components/TG_glb";
import { OrbitTrajectory } from "../components/OrbitTrajectory";
import { Ellipsoid, Geodetic, radians } from "@takram/three-geospatial";
import { OrbitControls } from "@react-three/drei";
import { useAtomValue } from "jotai";
import {
  formatBeijingClock,
  playbackModeAtom,
} from "../lib/clock/simClock";
import { useOemMotion } from "../hooks/useOemPosition";

/*
  天宫 3D
  - 地球：Globe auto（有 Google key → Photorealistic 3D Tiles；否则 ESRI XYZ 椭球）
  - 飞行：每帧用 OEM 插值 ECEF→经纬高驱动 ReorientationPlugin（不阻尼经纬，避免粘滞抖动）
  - 轨迹：约 ±1 轨 ECEF 折线投到局部系
  - 光照：太阳方向（ECEF→世界）驱动 DirectionalLight；GLB PBR 受光 + 帆板对日
  - WebGPU/WebGL 同一套场景
*/

const geodeticScratch = new Geodetic();
const ecefScratch = new Vector3();
const eciToEcefMat = new Matrix4();
const ecefToWorldMat = new Matrix4();
const sunWorld = new Vector3();

/** 太阳方向光：ECEF 太阳方向 → 世界系，照亮天宫与地球 */
const SunLight: FC<{
  sunDirectionEcef: Vector3;
  matrixWorldToEcef: Matrix4;
}> = ({ sunDirectionEcef, matrixWorldToEcef }) => {
  const lightRef = useRef<DirectionalLight>(null);

  useFrame(() => {
    const light = lightRef.current;
    if (!light) return;
    ecefToWorldMat.copy(matrixWorldToEcef).invert();
    sunWorld.copy(sunDirectionEcef).transformDirection(ecefToWorldMat).normalize();
    // 光源放在「太阳方向」远处，指向原点（天宫）
    light.position.copy(sunWorld).multiplyScalar(5e5);
    light.target.position.set(0, 0, 0);
    light.target.updateMatrixWorld();
  });

  return (
    <directionalLight
      ref={lightRef}
      intensity={3.2}
      color="#fff5e6"
      castShadow
      shadow-mapSize={[2048, 2048]}
      shadow-bias={-0.0001}
      shadow-normalBias={0.5}
    >
      <orthographicCamera
        attach="shadow-camera"
        args={[-200, 200, 200, -200, 10, 1e6]}
      />
    </directionalLight>
  );
};

function Content() {
  const [reorientationPlugin, setReorientationPlugin] =
    useState<ReorientationPlugin | null>(null);

  const { geodetic, simTimeMs, ready, states, startMs, stopMs } = useOemMotion();

  const longitude = geodetic?.longitudeDeg ?? 116.4;
  const latitude = geodetic?.latitudeDeg ?? 20;
  const height = geodetic?.heightM ?? 400_000;

  const worldToEcef = useRef(new Matrix4()).current;
  const sunDirectionEcef = useRef(new Vector3(1, 0, 0.2)).current;

  // 仅对仿真时钟做极轻平滑，位置用精确插值（不阻尼经纬）
  const smoothTimeRef = useRef(simTimeMs);

  useFrame((_, delta) => {
    // 时钟轻微跟随，避免 scrub 时太阳跳变过猛；位置仍用当前 OEM 插值点
    smoothTimeRef.current = MathUtils.damp(
      smoothTimeRef.current,
      simTimeMs,
      12,
      delta,
    );

    getECIToECEFRotationMatrix(smoothTimeRef.current, eciToEcefMat);
    getSunDirectionECI(smoothTimeRef.current, sunDirectionEcef).applyMatrix4(
      eciToEcefMat,
    );

    if (reorientationPlugin != null) {
      // 精确 OEM 点：平滑轨道运动 = 插值本身，勿对 lat/lon 阻尼
      reorientationPlugin.lon = radians(longitude);
      reorientationPlugin.lat = radians(latitude);
      reorientationPlugin.height = height;
      reorientationPlugin.update();

      Ellipsoid.WGS84.getNorthUpEastFrame(
        geodeticScratch
          .set(radians(longitude), radians(latitude), height)
          .toECEF(ecefScratch),
        worldToEcef,
      );
    }
  });

  return (
    <>
      <color attach="background" args={["#02040a"]} />
      <ambientLight intensity={0.28} />
      <hemisphereLight args={["#b1d0ff", "#2a2a2a", 0.35]} />
      <SunLight
        sunDirectionEcef={sunDirectionEcef}
        matrixWorldToEcef={worldToEcef}
      />

      <OrbitControls
        makeDefault
        enableDamping
        dampingFactor={0.08}
        minDistance={25}
        maxDistance={5e5}
        target={[0, -60, 0]}
      />

      <Globe reoriented>
        <TilesPlugin
          ref={setReorientationPlugin}
          plugin={ReorientationPlugin}
        />
      </Globe>

      {ready && (
        <OrbitTrajectory
          states={states}
          simTimeMs={simTimeMs}
          startMs={startMs}
          stopMs={stopMs}
          lonRad={radians(longitude)}
          latRad={radians(latitude)}
          heightM={height}
        />
      )}

      <Suspense fallback={null}>
        <TG_glb
          matrixWorldToECEF={worldToEcef}
          sunDirectionECEF={sunDirectionEcef}
          castShadow
          receiveShadow
        />
      </Suspense>
    </>
  );
}

function TiangongHud() {
  const { geodetic, simTimeMs, ready } = useOemMotion();
  const mode = useAtomValue(playbackModeAtom);
  const bj = formatBeijingClock(simTimeMs);
  const webgpuOk = useAtomValue(availableAtom);

  return (
    <div className="pointer-events-none absolute inset-x-0 top-0 z-20 flex flex-col items-center bg-gradient-to-b from-black/70 to-transparent px-3 pb-8 pt-3">
      <p className="text-[11px] tracking-[0.3em] text-sky-400/90">
        天宫 3D · {mode === "realtime" ? "实时" : "非实时"} · 北京时间
        {!webgpuOk ? " · WebGL" : ""}
      </p>
      <p className="font-mono text-3xl tabular-nums tracking-wider text-white sm:text-4xl">
        {bj.time}
      </p>
      <p className="font-mono text-xs text-zinc-400">
        {ready && geodetic
          ? `${geodetic.latitudeDeg.toFixed(2)}°N  ${geodetic.longitudeDeg.toFixed(2)}°E  ${(geodetic.heightM / 1000).toFixed(1)} km`
          : "等待 OEM…"}
      </p>
    </div>
  );
}

export default function TiangongRoute() {
  const webgpuOk = useAtomValue(availableAtom);

  return (
    <div className="relative h-[calc(100vh-3.5rem-5.5rem)] min-h-[420px] w-full bg-black">
      <TiangongHud />
      <WebGPUCanvas
        forceWebGL={!webgpuOk}
        shadows
        renderer={{
          logarithmicDepthBuffer: true,
        }}
        camera={{
          fov: 50,
          position: [90, 110, 95],
          near: 1,
          far: 1e8,
        }}
      >
        <Content />
      </WebGPUCanvas>
    </div>
  );
}
