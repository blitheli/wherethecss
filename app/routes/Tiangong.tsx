import { Suspense, useLayoutEffect, useRef, useState } from "react";
import {
  extend,
  useFrame,
  useThree,
  type ThreeElement,
} from "@react-three/fiber";
import { AgXToneMapping, MathUtils, Vector3 } from "three";
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
import { WebGPUCanvas } from "../components/WebGPUCanvas";
import { useResource } from "../hooks/useResource";
import { useGuardedFrame } from "../hooks/useGuardedFrame";
import { ReorientationPlugin } from "../plugins/ReorientationPlugin";
import { CesiumGlobe } from "../components/CesiumGlobe";
import { TG_glb } from "../components/TG_glb";
import { Ellipsoid, Geodetic, radians } from "@takram/three-geospatial";
import { OrbitControls } from "@react-three/drei";
import { useAtomValue } from "jotai";
import { playbackModeAtom } from "../lib/clock/simClock";
import { useOemPosition } from "../hooks/useOemPosition";
import { formatBeijingClock } from "../lib/clock/simClock";

extend({ AtmosphereLight });

declare module "@react-three/fiber" {
  interface ThreeElements {
    atmosphereLight: ThreeElement<typeof AtmosphereLight>;
  }
}

/*
  天宫 3D：世界系原点跟随 OEM 插值星下点（ECEF/ENU 重定向）。
  太阳/月方向用仿真时钟的 UTC Date（与 2D 同一 simTimeMs）。
*/

const geodetic = new Geodetic();
const position = new Vector3();

function Content() {
  const [reorientationPlugin, setReorientationPlugin] =
    useState<ReorientationPlugin | null>(null);

  const { geodetic: oemGeo, simTimeMs, ready } = useOemPosition();
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

    if (reorientationPlugin != null && ready) {
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
      <OrbitControls minDistance={20} maxDistance={1e5} />

      <CesiumGlobe materialHandler={() => new MeshLambertNodeMaterial()}>
        <TilesPlugin
          ref={setReorientationPlugin}
          plugin={ReorientationPlugin}
        />
      </CesiumGlobe>
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
  return (
    <div className="relative h-[calc(100vh-3.5rem-5.5rem)] min-h-[420px] w-full bg-black">
      <TiangongHud />
      <WebGPUCanvas
        forceWebGL={false}
        shadows
        renderer={{
          logarithmicDepthBuffer: true,
          onInit: (renderer) => {
            renderer.library.addLight(AtmosphereLightNode, AtmosphereLight);
          },
        }}
        camera={{
          fov: 50,
          position: [40, 40, 60],
          near: 10,
          far: 1e7,
        }}
      >
        <Content />
      </WebGPUCanvas>
    </div>
  );
}
