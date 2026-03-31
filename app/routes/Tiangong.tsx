import { Suspense, useLayoutEffect, useRef, useState } from "react";
import {
  extend,
  useFrame,
  useThree,
  type ThreeElement,
} from "@react-three/fiber";
import { AgXToneMapping, MathUtils, Vector3, Group } from "three";
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
import { Globe } from "../components/Globe";
import { CesiumGlobe } from "../components/CesiumGlobe";
import { ISS } from "../components/ISS";
import { TG_glb } from "../components/TG_glb";
import { Ellipsoid, Geodetic, radians } from "@takram/three-geospatial";
import { OrbitControls } from "@react-three/drei";
import { TimeControl } from "../components/TimeControl";
import { SatelliteEphemeris, TIANJONG_TLE } from "../core/SatelliteEphemeris";

extend({ AtmosphereLight });

declare module "@react-three/fiber" {
  interface ThreeElements {
    atmosphereLight: ThreeElement<typeof AtmosphereLight>;
  }
}

/*
  使用webgpu渲染地球模型(sphereGeometry+blueMarble材质)

  3D Tiles插件实现地球全球视角, 通过坐标系原点切换的方式实现ISS在世界系原点附近
  集成卫星星历系统，支持实时/仿真模式的时间控制

  20260319  blitheli
  202603311 blitheli - 集成星历系统
*/

const geodetic = new Geodetic();
const position = new Vector3();

// 使用WebGPUObject组件渲染
function Content({
  currentTime,
  isRealtime,
  simulationSpeed,
  isPaused,
}: {
  currentTime: Date;
  isRealtime: boolean;
  simulationSpeed: number;
  isPaused: boolean;
}) {
  console.log("重新渲染地球");

  // 3D Tiles 插件实例,用于重定向坐标系,使指定 (lat, lon, height) 附近落在原点附近,减轻大坐标下的精度问题。
  const [reorientationPlugin, setReorientationPlugin] =
    useState<ReorientationPlugin | null>(null);

  // 初始化卫星星历
  const satelliteEphemeris = useResource(
    () => new SatelliteEphemeris(TIANJONG_TLE.line1, TIANJONG_TLE.line2),
    []
  );

  // 天宫模型的ref，用于更新位置
  const tgRef = useRef<Group>(null);

  //-------------------------------------------------------------------------------------

  // 获取相机, 接收一个选择器函数（selector），R3F 会把包含整个场景状态的 state 对象传给它：
  // state 里大概长这样：camera,  当前活跃相机  scene, Three.js Scene  gl, WebGPU/WebGL 渲染器
  //选择器 ({ camera }) => camera 从 state 中解构出 camera 并返回，所以最终 const camera 拿到的就是当前的 Three.js 相机对象。
  const renderer = useThree<Renderer>(({ gl }) => gl as any);
  const scene = useThree(({ scene }) => scene);
  const camera = useThree(({ camera }) => camera);

  // 大气上下文对象,使用useMemo缓存,避免重复创建大气上下文对象
  const atmosphereContext = useResource(() => new AtmosphereContextNode(), []);
  // 将 camera 同步到 atmosphereContext（大气光照需要相机位置做透射率计算）
  atmosphereContext.camera = camera;

  // 在DOM 更新前同步执行,确保渲染器在渲染前就有正确的大气上下文
  // renderer.contextNode是 Three.js WebGPU 渲染器的全局上下文节点,可以存储在着色器中共享的数据
  // 这样,后面所有使用 MeshPhysicalNodeMaterial 的材质都可以通过 getAtmosphere() 访问到大气参数(如太阳方向、月亮方向、大气散射参数等),从而实现正确的大气渲染效果。
  // 简单来说: 这是在给 Three.js 渲染器"装配"大气系统,让所有材质都知道当前场景有大气层,并能获取大气相关的光照信息。
  useLayoutEffect(() => {
    renderer.contextNode = context({
      ...renderer.contextNode.value,
      getAtmosphere: () => atmosphereContext,
    });
  }, [renderer, atmosphereContext]);

  //-------------------------------------------------------------------------------------
  // 每帧更新时间和光照方向
  useFrame(() => {
    const { matrixECIToECEF, sunDirectionECEF, moonDirectionECEF } = atmosphereContext;

    // 使用currentTime状态更新时间
    getECIToECEFRotationMatrix(currentTime, matrixECIToECEF.value);
    getSunDirectionECI(currentTime, sunDirectionECEF.value).applyMatrix4(
      matrixECIToECEF.value,
    );
    getMoonDirectionECI(currentTime, moonDirectionECEF.value).applyMatrix4(
      matrixECIToECEF.value,
    );
  });

  // ---- WebGPU 后处理管线 -------------------------------------------------------------

  // 1. 主渲染 pass（启用 MRT：颜色 + 高精度速度缓冲）
  // pass为WebGPU 后处理管线的节点函数，全称 Pass Node，本质是一个渲染通道节点。
  // 它把 scene + camera 的渲染结果捕获到 GPU 纹理缓冲区中，而不是直接输出到屏幕。之后可以从这个缓冲区里取出各种数据：
  // samples>0 时 depth 为多重采样纹理；@takram 的 aerialPerspective / TAA 绑定的是非 MSAA depth，会触发
  // "Sample count (4) of depth doesn't match expectation (multisampled: 0)"。抗锯齿交给 temporalAntialias。
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

  // 2. 空气透视 (Aerial Perspective)
  const aerialNode = useResource(
    () => aerialPerspective(atmosphereContext, colorNode, depthNode),
    [atmosphereContext, colorNode, depthNode],
  );

  // 3. 镜头光晕 (Lens Flare)
  const lensFlareNode = useResource(() => lensFlare(aerialNode), [aerialNode]);

  // 4. 色调映射 (AgX Tone Mapping, 曝光度 = 2)
  // story.js 原版通过 useToneMappingControls 交互调节，这里固定为 2
  const toneMappingNode = useResource(
    () => toneMapping(AgXToneMapping, uniform(4), lensFlareNode),
    [lensFlareNode],
  );

  // 5. 时域抗锯齿 (Temporal Anti-Aliasing)
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

  // 6. 最终后处理（附加 Dithering 去色带）
  const renderPipeline = useResource(
    () => new RenderPipeline(renderer, taaNode.add(dithering)),
    [renderer, taaNode],
  );

  // 更新天宫位置（基于星历计算）
  useGuardedFrame(() => {
    if (satelliteEphemeris != null && tgRef.current != null) {
      const satPosition = satelliteEphemeris.getPositionECEF(
        currentTime,
        atmosphereContext.matrixWorldToECEF.value
      );
      tgRef.current.position.copy(satPosition);

      // 同时更新ReorientationPlugin的参考点，使坐标系原点跟随卫星
      if (reorientationPlugin != null) {
        // 将ECEF位置转换为经纬高
        const ecefPos = satPosition.clone().applyMatrix4(
          atmosphereContext.matrixWorldToECEF.value.clone().invert()
        );

        // 使用Ellipsoid工具转换ECEF到经纬高
        geodetic.fromECEF(ecefPos.x / 1000, ecefPos.y / 1000, ecefPos.z / 1000);

        reorientationPlugin.lon = geodetic.lon;
        reorientationPlugin.lat = geodetic.lat;
        reorientationPlugin.height = geodetic.height * 1000;
        reorientationPlugin.update();

        // 同步AtmosphereContext的matrixWorldToECEF
        Ellipsoid.WGS84.getNorthUpEastFrame(
          ecefPos.x / 1000,
          ecefPos.y / 1000,
          ecefPos.z / 1000,
          atmosphereContext.matrixWorldToECEF.value
        );
      }
    }
    renderPipeline.render();
  }, 1);

  const envNode = useResource(
    () => skyEnvironment(atmosphereContext),
    [atmosphereContext],
  );
  scene.environmentNode = envNode;

  return (
    <>
      {/* 大气光照：根据大气透射率自动计算太阳颜色 */}
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

      {/* 注意，这里的ref 把底层拿到的插件实例写进React 的 state，方便页面其它逻辑（例如 useLayoutEffect）去改 
        lon/lat/height 并 update()。
        在 React 里，ref 可以传 函数（callback ref）：
          - 挂载时：React 调用 setReorientationPlugin(instance)，参数是 DOM 或（在 R3F 里）Three / 插件对应的实例。
          - 卸载时：React 会再调用一次 setReorientationPlugin(null)。
       */}
      <CesiumGlobe materialHandler={() => new MeshLambertNodeMaterial()}>
        <TilesPlugin
          ref={setReorientationPlugin}
          plugin={ReorientationPlugin}
        />
      </CesiumGlobe>
      <Suspense>
        <TG_glb
          ref={tgRef}
          matrixWorldToECEF={atmosphereContext.matrixWorldToECEF.value}
          sunDirectionECEF={atmosphereContext.sunDirectionECEF.value}
        />
      </Suspense>
    </>
  );
}

// 父组件状态提升，用于在3D场景外管理时间控制
export default function TiangongRoute() {
  const [currentTime, setCurrentTime] = useState(new Date());
  const [isRealtime, setIsRealtime] = useState(true);
  const [simulationSpeed, setSimulationSpeed] = useState(60);
  const [isPaused, setIsPaused] = useState(false);

  return (
    <>
      <TimeControl
        currentTime={currentTime}
        onTimeChange={setCurrentTime}
        isRealtime={isRealtime}
        onRealtimeChange={setIsRealtime}
        simulationSpeed={simulationSpeed}
        onSpeedChange={setSimulationSpeed}
        isPaused={isPaused}
        onPauseChange={setIsPaused}
      />
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
        <Content
          currentTime={currentTime}
          isRealtime={isRealtime}
          simulationSpeed={simulationSpeed}
          isPaused={isPaused}
        />
      </WebGPUCanvas>
    </>
  );
}
