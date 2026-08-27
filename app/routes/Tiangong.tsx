import { Suspense, useRef, useState, type FC } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import {
  DirectionalLight,
  Group,
  MathUtils,
  Matrix4,
  Vector3,
} from "three";
import { TilesPlugin } from "3d-tiles-renderer/r3f";
import {
  OBJECT_FRAME,
  WGS84_ELLIPSOID,
} from "3d-tiles-renderer/three";
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
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import {
  formatBeijingClock,
  playbackModeAtom,
} from "../lib/clock/simClock";
import { useOemMotion } from "../hooks/useOemPosition";
import { eciToEcef } from "../lib/oem/eciToGeodetic";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";

/*
  天宫 3D
  - 地球：Globe auto（Google 3D Tiles 或 ESRI XYZ 椭球）
  - 飞行：原点间歇重定（避免每帧 Reorientation 打爆瓦片）；天宫在局部系连续滑动
  - 轨迹：约两圈珠串（OBJECT_FRAME）
  - 光照：太阳 DirectionalLight + 充足环境光
*/

const geodeticScratch = new Geodetic();
const ecefScratch = new Vector3();
const eciToEcefMat = new Matrix4();
const ecefToLocal = new Matrix4();
const sunWorld = new Vector3();
const stationLocal = new Vector3();

/** 滑出原点超过该距离（米）才重定瓦片原点 */
const REBASE_DISTANCE_M = 80_000;

const SunLight: FC<{
  sunDirectionEcef: Vector3;
  matrixWorldToEcef: Matrix4;
}> = ({ sunDirectionEcef, matrixWorldToEcef }) => {
  const lightRef = useRef<DirectionalLight>(null);

  useFrame(() => {
    const light = lightRef.current;
    if (!light) return;
    const inv = ecefToLocal.copy(matrixWorldToEcef).invert();
    sunWorld.copy(sunDirectionEcef).transformDirection(inv).normalize();
    light.position.copy(sunWorld).multiplyScalar(2e5);
    light.target.position.set(0, 0, 0);
    light.target.updateMatrixWorld();
  });

  return (
    <directionalLight
      ref={lightRef}
      intensity={4}
      color="#fff6e8"
      castShadow
      shadow-mapSize={[1024, 1024]}
      shadow-bias={-0.0002}
    />
  );
};

function Content() {
  const [reorientationPlugin, setReorientationPlugin] =
    useState<ReorientationPlugin | null>(null);

  const { geodetic, eciM, simTimeMs, states, startMs, stopMs } = useOemMotion();

  const longitude = geodetic?.longitudeDeg ?? 116.4;
  const latitude = geodetic?.latitudeDeg ?? 20;
  const height = geodetic?.heightM ?? 400_000;

  const worldToEcef = useRef(new Matrix4()).current;
  const sunDirectionEcef = useRef(new Vector3(1, 0.2, 0.3)).current;
  const stationRef = useRef<Group>(null);
  const { controls } = useThree();

  const originRef = useRef({
    lon: radians(longitude),
    lat: radians(latitude),
    height,
  });
  const originReady = useRef(false);

  const smoothTimeRef = useRef(simTimeMs);

  useFrame((_, delta) => {
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

    if (reorientationPlugin == null) return;

    const lon = radians(longitude);
    const lat = radians(latitude);
    const h = height;

    if (!originReady.current) {
      originRef.current = { lon, lat, height: h };
      reorientationPlugin.lon = lon;
      reorientationPlugin.lat = lat;
      reorientationPlugin.height = h;
      reorientationPlugin.update();
      originReady.current = true;
    }

    WGS84_ELLIPSOID.getObjectFrame(
      originRef.current.lat,
      originRef.current.lon,
      originRef.current.height,
      0,
      0,
      0,
      ecefToLocal,
      OBJECT_FRAME,
    );
    ecefToLocal.invert();

    let ecefNow: [number, number, number];
    if (eciM) {
      ecefNow = eciToEcef(eciM, simTimeMs);
    } else {
      geodeticScratch.set(lon, lat, h).toECEF(ecefScratch);
      ecefNow = [ecefScratch.x, ecefScratch.y, ecefScratch.z];
    }
    stationLocal.set(ecefNow[0], ecefNow[1], ecefNow[2]).applyMatrix4(ecefToLocal);

    if (stationLocal.length() > REBASE_DISTANCE_M) {
      originRef.current = { lon, lat, height: h };
      reorientationPlugin.lon = lon;
      reorientationPlugin.lat = lat;
      reorientationPlugin.height = h;
      reorientationPlugin.update();
      stationLocal.set(0, 0, 0);
    }

    if (stationRef.current) {
      stationRef.current.position.copy(stationLocal);
    }
    const oc = controls as OrbitControlsImpl | null;
    if (oc?.target) {
      oc.target.copy(stationLocal);
    }

    Ellipsoid.WGS84.getNorthUpEastFrame(
      geodeticScratch.set(lon, lat, h).toECEF(ecefScratch),
      worldToEcef,
    );
  });

  return (
    <>
      <color attach="background" args={["#02040a"]} />
      <ambientLight intensity={0.85} />
      <hemisphereLight args={["#cfe0ff", "#3a3a3a", 0.55]} />
      <pointLight position={[40, 80, 40]} intensity={1.2} distance={500} />
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
      />

      <Globe reoriented>
        <TilesPlugin
          ref={setReorientationPlugin}
          plugin={ReorientationPlugin}
        />
      </Globe>

      {states.length > 0 && (
        <OrbitTrajectory
          states={states}
          simTimeMs={simTimeMs}
          startMs={startMs}
          stopMs={stopMs}
          originRef={originRef}
        />
      )}

      <group ref={stationRef}>
        <Suspense fallback={null}>
          <TG_glb
            matrixWorldToECEF={worldToEcef}
            sunDirectionECEF={sunDirectionEcef}
          />
        </Suspense>
        {/* 近距补光，避免 PBR 发黑 */}
        <pointLight intensity={2.5} distance={200} color="#fff8f0" />
      </group>
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
