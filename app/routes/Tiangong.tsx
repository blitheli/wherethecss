import { Suspense, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import { MathUtils, Matrix4, Vector3 } from "three";
import { TilesPlugin } from "3d-tiles-renderer/r3f";
import {
  getECIToECEFRotationMatrix,
  getSunDirectionECI,
} from "@takram/three-atmosphere";
import { availableAtom, WebGPUCanvas } from "../components/WebGPUCanvas";
import { ReorientationPlugin } from "../plugins/ReorientationPlugin";
import { Globe } from "../components/Globe";
import { TG_glb } from "../components/TG_glb";
import { Ellipsoid, Geodetic, radians } from "@takram/three-geospatial";
import { OrbitControls } from "@react-three/drei";
import { useAtomValue } from "jotai";
import {
  formatBeijingClock,
  playbackModeAtom,
} from "../lib/clock/simClock";
import { useOemPosition } from "../hooks/useOemPosition";

/*
  天宫 3D（可靠可见路径）
  - 地球：R3F Globe = XYZTilesPlugin + ESRI World Imagery（无 Cesium）
  - 原点：ReorientationPlugin 把 OEM 星下点附近放到世界原点（ECEF/局部 Y-up）
  - 天宫：TG_glb 约数十米尺度，相机须在百米级（勿拉到 10^4 m 以外）
  - WebGPU / WebGL：同一套场景（不接管 RenderPipeline），避免大气后处理失败导致永久黑屏
  - 与 2D 共用 simTimeMs
*/

const geodetic = new Geodetic();
const position = new Vector3();
const eciToEcefScratch = new Matrix4();

function Content() {
  const [reorientationPlugin, setReorientationPlugin] =
    useState<ReorientationPlugin | null>(null);

  const { geodetic: oemGeo, simTimeMs } = useOemPosition();
  const longitude = oemGeo?.longitudeDeg ?? 116.4;
  const latitude = oemGeo?.latitudeDeg ?? 20;
  const height = oemGeo?.heightM ?? 400_000;

  const smoothTimeRef = useRef(simTimeMs);
  const smoothLonRef = useRef(longitude);
  const smoothLatRef = useRef(latitude);
  const smoothHRef = useRef(height);
  const worldToEcef = useRef(new Matrix4()).current;
  const sunDirectionECEF = useRef(new Vector3(1, 0, 0)).current;
  const DAMP = 8;

  useFrame((_, delta) => {
    smoothTimeRef.current = MathUtils.damp(
      smoothTimeRef.current,
      simTimeMs,
      DAMP,
      delta,
    );
    smoothLonRef.current = MathUtils.damp(
      smoothLonRef.current,
      longitude,
      DAMP,
      delta,
    );
    smoothLatRef.current = MathUtils.damp(
      smoothLatRef.current,
      latitude,
      DAMP,
      delta,
    );
    smoothHRef.current = MathUtils.damp(
      smoothHRef.current,
      height,
      DAMP,
      delta,
    );

    const t = smoothTimeRef.current;
    getECIToECEFRotationMatrix(t, eciToEcefScratch);
    getSunDirectionECI(t, sunDirectionECEF).applyMatrix4(eciToEcefScratch);

    // 不等 OEM ready：默认经纬高也立刻重定向，避免相机落在地心内部
    if (reorientationPlugin != null) {
      reorientationPlugin.lon = radians(smoothLonRef.current);
      reorientationPlugin.lat = radians(smoothLatRef.current);
      reorientationPlugin.height = smoothHRef.current;
      reorientationPlugin.update();

      Ellipsoid.WGS84.getNorthUpEastFrame(
        geodetic
          .set(
            radians(smoothLonRef.current),
            radians(smoothLatRef.current),
            smoothHRef.current,
          )
          .toECEF(position),
        worldToEcef,
      );
    }
  });

  return (
    <>
      <color attach="background" args={["#02040a"]} />
      <ambientLight intensity={0.55} />
      <directionalLight position={[120, 180, 80]} intensity={1.6} />
      <hemisphereLight args={["#9ec9ff", "#1a1a1a", 0.4]} />

      {/* 目标在原点（天宫）；可略下俯看地球 */}
      <OrbitControls
        makeDefault
        enableDamping
        minDistance={25}
        maxDistance={5e5}
        target={[0, -80, 0]}
      />

      {/* reoriented：ReorientationPlugin 已处理 ECEF→Y-up，禁止再套 -π/2 */}
      <Globe reoriented>
        <TilesPlugin
          ref={setReorientationPlugin}
          plugin={ReorientationPlugin}
        />
      </Globe>

      <Suspense fallback={null}>
        <TG_glb
          matrixWorldToECEF={worldToEcef}
          sunDirectionECEF={sunDirectionECEF}
        />
      </Suspense>
    </>
  );
}

function TiangongHud() {
  const { geodetic, simTimeMs, ready } = useOemPosition();
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
        // 无 WebGPU 时强制 WebGL；有 WebGPU 也用同一套非后处理场景（更稳）
        forceWebGL={!webgpuOk}
        shadows={false}
        renderer={{
          logarithmicDepthBuffer: true,
        }}
        camera={{
          fov: 50,
          // 与 three-geospatial LEO story 同量级：百米级看清天宫，下方可见地球曲面
          position: [80, 120, 100],
          near: 1,
          far: 1e8,
        }}
      >
        <Content />
      </WebGPUCanvas>
    </div>
  );
}
