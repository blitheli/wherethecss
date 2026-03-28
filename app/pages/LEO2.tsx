import { Suspense, useEffect, useLayoutEffect, useMemo, useRef } from "react";
import { extend, useThree, type ThreeElement } from "@react-three/fiber";
import { AgXToneMapping, MathUtils, Matrix4, Object3D } from "three";
import {
  context,
  mix,
  mul,
  texture,
  vec3,
  pass,
  mrt,
  output,
  uniform,
  toneMapping,
} from "three/tsl";
import {
  MeshPhysicalNodeMaterial,
  MeshLambertNodeMaterial,
  RenderPipeline,
  type MeshPhysicalNodeMaterialParameters,
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
} from "@takram/three-atmosphere/webgpu";
import { WebGPUCanvas } from "../components/WebGPUCanvas";
import { useResource } from "../hooks/useResource";
import { useGuardedFrame } from "../hooks/useGuardedFrame";
import { ReorientationPlugin } from "../plugins/ReorientationPlugin";
import { Globe } from "../components/Globe";
import { ISS } from "../components/ISS";
import { CameraController } from "../components/CameraController";
import { Ellipsoid, Geodetic, radians } from "@takram/three-geospatial";
import { useControls } from "leva";

extend({ MeshPhysicalNodeMaterial });
extend({ AtmosphereLight });

declare module "@react-three/fiber" {
  interface ThreeElements {
    atmosphereLight: ThreeElement<typeof AtmosphereLight>;
  }
}

/*
  使用webgpu渲染地球模型(sphereGeometry+blueMarble材质),实现地球效果: 云层、海洋、城市灯光、自发光等。

  坐标系原点在地心，通过相机target原点切换的方式实现全球视角和ISS视角的切换

  但是这种方式，ISS局部视角时，由于Float32精度问题，会出现ISS模型的细杆部分没有阴影!

  此方案仅作参考！

  20260319  blitheli
*/

const mt4 = new Matrix4();

// 使用WebGPUObject组件渲染
function Content() {
  console.log("重新渲染地球");

  // ISS的ECEF位置
  const issRef = useRef<Object3D | null>(null);

  // GUI控制
  const { longitude, latitude, height, hour } = useControls({
    longitude: { value: -110, min: -180, max: 180, step: 1 },
    latitude: { value: 45, min: -90, max: 90, step: 1 },
    height: { value: 408000, min: 10000, max: 1e6, step: 1000 },
    hour: { value: 6.5, min: 0, max: 24, step: 0.1 },
  });

  // ISS 位置（通过GUI控制）
  const issPosition = useMemo(
    () =>
      new Geodetic(
        radians(longitude), // 经度
        radians(latitude), // 纬度
        height, // 400 公里高度
      ).toECEF(),
    [longitude, latitude, height],
  );

  // ISS 根节点：用矩阵（NUE 姿态 + ECEF 位置），不再用 position prop
  useLayoutEffect(() => {

    Ellipsoid.WGS84.getNorthUpEastFrame(issPosition, mt4);
    const g = issRef.current;
    if (g == null) return;

    g.matrixAutoUpdate = false;
    g.matrix.copy(mt4);
    g.matrix.setPosition(issPosition);
    g.updateMatrixWorld(true);
  }, [issPosition]);


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
  // 太阳/月亮方向：Story 的 useLocalDateControls 用 Motion spring，滑块拖动时数值连续变化；
  // Leva + useEffect 只在状态跳变时更新，阴影/光照会「一顿一顿」。这里每帧用 damp 逼近面板目标，与弹簧类似。
  const smoothHourRef = useRef(hour);
  const smoothLongitudeRef = useRef(longitude);
  const DAMP = 10;

  useGuardedFrame((_, delta) => {
    smoothHourRef.current = MathUtils.damp(
      smoothHourRef.current,
      hour,
      DAMP,
      delta,
    );
    smoothLongitudeRef.current = MathUtils.damp(
      smoothLongitudeRef.current,
      longitude,
      DAMP,
      delta,
    );

    const timeOfDay = smoothHourRef.current;
    const dayOfYear = 200;
    const epoch = Date.UTC(2026, 0, 1, 0, 0, 0, 0);
    const offset = smoothLongitudeRef.current / 15;
    const date =
      epoch +
      ((dayOfYear - 1) * 24 + timeOfDay - offset) * 3600000;

    const { matrixECIToECEF, sunDirectionECEF, moonDirectionECEF } =
      atmosphereContext;

    getECIToECEFRotationMatrix(date, matrixECIToECEF.value);
    getSunDirectionECI(date, sunDirectionECEF.value).applyMatrix4(
      matrixECIToECEF.value,
    );
    getMoonDirectionECI(date, moonDirectionECEF.value).applyMatrix4(
      matrixECIToECEF.value,
    );
  });

  // ---- WebGPU 后处理管线 -------------------------------------------------------------

  // 1. 主渲染 pass（启用 MRT：颜色 + 高精度速度缓冲）
  // pass为WebGPU 后处理管线的节点函数，全称 Pass Node，本质是一个渲染通道节点。
  // 它把 scene + camera 的渲染结果捕获到 GPU 纹理缓冲区中，而不是直接输出到屏幕。之后可以从这个缓冲区里取出各种数据：
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
    () => toneMapping(AgXToneMapping, uniform(2), lensFlareNode),
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

  // 渲染循环 —— 优先级 1 接管 R3F 默认渲染，由 RenderPipeline 全权负责绘制
  useGuardedFrame(() => {
    renderPipeline.render();
  }, 1);

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
          attach='shadow-camera'
          top={60}
          bottom={-60}
          left={-60}
          right={60}
          near={0}
          far={160}
        />
      </atmosphereLight>

      <Globe materialHandler={() => new MeshLambertNodeMaterial()} />
      <Suspense>
        <group ref={issRef}>
          <ISS
            matrixWorldToECEF={atmosphereContext.matrixWorldToECEF.value}
            sunDirectionECEF={atmosphereContext.sunDirectionECEF.value}
          />
        </group>
      </Suspense>

      {/* 智能相机控制器 */}
      <CameraController tilesRenderer={null} scRef={issRef} mode={"local"} />
    </>
  );
}

export default function LEO() {
  return (
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
        position: [80, 80, 100],
        near: 10,
        far: 1e7,
      }}
    >
      <Content />
    </WebGPUCanvas>
  );
}
