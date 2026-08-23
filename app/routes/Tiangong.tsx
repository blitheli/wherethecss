import { Suspense, useLayoutEffect, useRef, useState } from "react";
import {
  extend,
  useFrame,
  useThree,
  type ThreeElement,
} from "@react-three/fiber";
import {
  AgXToneMapping,
  MathUtils,
  Matrix4,
  Vector3,
} from "three";
import { TilesPlugin } from "3d-tiles-renderer/r3f";
import { context, mrt, output, pass, toneMapping, uniform } from "three/tsl";
import {
  MeshLambertNodeMaterial,
  RenderPipeline,
  type Renderer,
} from "three/webgpu";
import {
  lensFlare,
  temporalAntialias,
  dithering,
  highpVelocity,
} from "@takram/three-geospatial/webgpu";
import {
  getECIToECEFRotationMatrix,
  getMoonDirectionECI,
  getSunDirectionECI,
} from "@takram/three-atmosphere";
import {
  aerialPerspective,
  AtmosphereContextNode,
  AtmosphereLight,
  AtmosphereLightNode,
  skyEnvironment,
} from "@takram/three-atmosphere/webgpu";
import { availableAtom, WebGPUCanvas } from "../components/WebGPUCanvas";
import { useResource } from "../hooks/useResource";
import { useGuardedFrame } from "../hooks/useGuardedFrame";
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

extend({ AtmosphereLight });

declare module "@react-three/fiber" {
  interface ThreeElements {
    atmosphereLight: ThreeElement<typeof AtmosphereLight>;
  }
}

/*
  天宫 3D：世界系原点跟随 OEM 插值星下点（ECEF/ENU 重定向）。
  太阳/月方向用仿真时钟的 UTC Date（与 2D 同一 simTimeMs）。
  地球：R3F Globe = XYZTilesPlugin + ESRI World Imagery（无 Cesium Ion）。
  WebGPU：大气/空气透视管线；WebGL 回退：简易光照 + 默认瓦片材质（保证可见）。
*/

const geodetic = new Geodetic();
const position = new Vector3();
const eciToEcefScratch = new Matrix4();

function useOemReorientation(
  reorientationPlugin: ReorientationPlugin | null,
  onFrame?: (args: {
    lon: number;
    lat: number;
    height: number;
    simTimeMs: number;
    worldToEcef: Matrix4;
  }) => void,
) {
  const { geodetic: oemGeo, simTimeMs, ready } = useOemPosition();
  const longitude = oemGeo?.longitudeDeg ?? 116.4;
  const latitude = oemGeo?.latitudeDeg ?? 20;
  const height = oemGeo?.heightM ?? 400000;

  const smoothTimeRef = useRef(simTimeMs);
  const smoothLonRef = useRef(longitude);
  const smoothLatRef = useRef(latitude);
  const smoothHRef = useRef(height);
  const worldToEcef = useRef(new Matrix4()).current;
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

    // 即使 OEM 尚未 ready，也用默认/平滑经纬高立刻重定向，避免相机停在地心内部导致黑屏
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

    onFrame?.({
      lon: smoothLonRef.current,
      lat: smoothLatRef.current,
      height: smoothHRef.current,
      simTimeMs: smoothTimeRef.current,
      worldToEcef,
    });
  });

  return { ready, worldToEcef, simTimeMs };
}

/** WebGL 回退：不走 TSL/大气后处理，瓦片用默认材质，保证地球可见 */
function WebGLGlobeContent() {
  const [reorientationPlugin, setReorientationPlugin] =
    useState<ReorientationPlugin | null>(null);
  const sunDirectionECEF = useRef(new Vector3(1, 0, 0)).current;

  const { worldToEcef } = useOemReorientation(
    reorientationPlugin,
    ({ simTimeMs, worldToEcef: m }) => {
      getECIToECEFRotationMatrix(simTimeMs, eciToEcefScratch);
      getSunDirectionECI(simTimeMs, sunDirectionECEF).applyMatrix4(
        eciToEcefScratch,
      );
      void m;
    },
  );

  return (
    <>
      <color attach="background" args={["#02040a"]} />
      <ambientLight intensity={0.45} />
      <directionalLight position={[80, 120, 40]} intensity={1.4} />
      <hemisphereLight args={["#8ecae6", "#1b1b1b", 0.35]} />
      <OrbitControls minDistance={30} maxDistance={8e5} target={[0, -2e4, 0]} />

      <Globe>
        <TilesPlugin
          ref={setReorientationPlugin}
          plugin={ReorientationPlugin}
        />
      </Globe>
      <Suspense>
        <TG_glb
          matrixWorldToECEF={worldToEcef}
          sunDirectionECEF={sunDirectionECEF}
        />
      </Suspense>
    </>
  );
}

/** WebGPU：three-geospatial / three-atmosphere 全管线 */
function AtmosphereContent() {
  const [reorientationPlugin, setReorientationPlugin] =
    useState<ReorientationPlugin | null>(null);

  const { geodetic: oemGeo, simTimeMs } = useOemPosition();
  const longitude = oemGeo?.longitudeDeg ?? 116.4;
  const latitude = oemGeo?.latitudeDeg ?? 20;
  const height = oemGeo?.heightM ?? 400000;

  const renderer = useThree<Renderer>(({ gl }) => gl as any);
  const scene = useThree(({ scene }) => scene);
  const camera = useThree(({ camera }) => camera);

  const atmosphereContext = useResource(() => new AtmosphereContextNode(), []);
  atmosphereContext.camera = camera;

  useLayoutEffect(() => {
    renderer.contextNode = context({
      ...renderer.contextNode.value,
      getAtmosphere: () => atmosphereContext,
    });
  }, [renderer, atmosphereContext]);

  const smoothTimeRef = useRef(simTimeMs);
  const smoothLonRef = useRef(longitude);
  const smoothLatRef = useRef(latitude);
  const smoothHRef = useRef(height);
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

    const date = smoothTimeRef.current;
    const { matrixECIToECEF, sunDirectionECEF, moonDirectionECEF } =
      atmosphereContext;

    getECIToECEFRotationMatrix(date, matrixECIToECEF.value);
    getSunDirectionECI(date, sunDirectionECEF.value).applyMatrix4(
      matrixECIToECEF.value,
    );
    getMoonDirectionECI(date, moonDirectionECEF.value).applyMatrix4(
      matrixECIToECEF.value,
    );

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
        atmosphereContext.matrixWorldToECEF.value,
      );
    }
  });

  const passNode = useResource(
    () =>
      pass(scene, camera, { samples: 0 }).setMRT(
        mrt({ output, velocity: highpVelocity }),
      ),
    [scene, camera],
  );

  const colorNode = passNode.getTextureNode("output");
  const depthNode = passNode.getTextureNode("depth");
  const velocityNode = passNode.getTextureNode("velocity");

  const aerialNode = useResource(
    () => aerialPerspective(atmosphereContext, colorNode, depthNode),
    [atmosphereContext, colorNode, depthNode],
  );

  const lensFlareNode = useResource(() => lensFlare(aerialNode), [aerialNode]);

  const toneMappingNode = useResource(
    () => toneMapping(AgXToneMapping, uniform(4), lensFlareNode),
    [lensFlareNode],
  );

  const taaNode = useResource(
    () =>
      temporalAntialias(highpVelocity)(
        toneMappingNode,
        depthNode,
        velocityNode,
        camera,
      ),
    [camera, depthNode, velocityNode, toneMappingNode],
  );

  const renderPipeline = useResource(
    () => new RenderPipeline(renderer, taaNode.add(dithering)),
    [renderer, taaNode],
  );

  useGuardedFrame(() => {
    renderPipeline.render();
  }, 1);

  const envNode = useResource(
    () => skyEnvironment(atmosphereContext),
    [atmosphereContext],
  );
  scene.environmentNode = envNode;

  return (
    <>
      <atmosphereLight
        args={[atmosphereContext, 80]}
        castShadow
        shadow-normalBias={0.1}
        shadow-mapSize={[2048, 2048]}
      >
        <orthographicCamera
          attach="shadow-camera"
          top={60}
          bottom={-60}
          left={-60}
          right={60}
          near={0}
          far={100}
        />
      </atmosphereLight>
      <OrbitControls minDistance={30} maxDistance={8e5} target={[0, -2e4, 0]} />

      <Globe materialHandler={() => new MeshLambertNodeMaterial()}>
        <TilesPlugin
          ref={setReorientationPlugin}
          plugin={ReorientationPlugin}
        />
      </Globe>
      <Suspense>
        <TG_glb
          matrixWorldToECEF={atmosphereContext.matrixWorldToECEF.value}
          sunDirectionECEF={atmosphereContext.sunDirectionECEF.value}
        />
      </Suspense>
    </>
  );
}

function TiangongHud() {
  const { geodetic, simTimeMs, ready } = useOemPosition();
  const mode = useAtomValue(playbackModeAtom);
  const bj = formatBeijingClock(simTimeMs);

  return (
    <div className="pointer-events-none absolute inset-x-0 top-0 z-20 flex flex-col items-center bg-gradient-to-b from-black/70 to-transparent px-3 pb-8 pt-3">
      <p className="text-[11px] tracking-[0.3em] text-sky-400/90">
        天宫 3D · {mode === "realtime" ? "实时" : "非实时"} · 北京时间
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
        shadows={webgpuOk}
        renderer={{
          logarithmicDepthBuffer: true,
          onInit: (renderer) => {
            if (webgpuOk) {
              renderer.library.addLight(AtmosphereLightNode, AtmosphereLight);
            }
          },
        }}
        camera={{
          fov: 55,
          // LEO 侧视：首帧同时看到天宫附近与下方地球曲面
          position: [6e4, 9e4, 5e4],
          near: 10,
          far: 1e8,
        }}
      >
        {webgpuOk ? <AtmosphereContent /> : <WebGLGlobeContent />}
      </WebGPUCanvas>
    </div>
  );
}
