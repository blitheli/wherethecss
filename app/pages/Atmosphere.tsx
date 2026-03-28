import { useEffect, useLayoutEffect } from "react";
import { extend, useThree, type ThreeElement } from "@react-three/fiber";
import { OrbitControls, } from "@react-three/drei";
import { AgXToneMapping, TextureLoader } from "three";
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
  RenderPipeline,
  type MeshPhysicalNodeMaterialParameters,
  type Renderer
} from 'three/webgpu'
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
  getSunDirectionECEF,
  getMoonDirectionECEF,
} from "@takram/three-atmosphere";
import {
  aerialPerspective,
  AtmosphereContextNode,
  AtmosphereLight,
  AtmosphereLightNode,
  skyBackground,
} from "@takram/three-atmosphere/webgpu";
import { Ellipsoid,Geodetic, radians } from "@takram/three-geospatial";
import { EllipsoidMesh } from "@takram/three-geospatial/r3f";
import { WebGPUCanvas } from "../components/WebGPUCanvas";
import { useResource } from "../hooks/useResource";
import { useGuardedFrame } from "../hooks/useGuardedFrame";
import { ReorientationPlugin } from '../plugins/ReorientationPlugin'

extend({ MeshPhysicalNodeMaterial });
extend({ AtmosphereLight });

declare module '@react-three/fiber' {
  interface ThreeElements {
    atmosphereLight: ThreeElement<typeof AtmosphereLight>
  }
}

/*
  使用webgpu渲染地球模型(sphereGeometry+blueMarble材质),实现地球效果: 云层、海洋、城市灯光、自发光等。

  20260319  blitheli
*/

// 加载地球纹理, 返回材质对象: MeshPhysicalNodeMaterialParameters
//本质是：用多张纹理和 TSL 节点，在材质里做颜色、发光、粗糙度的混合和映射，实现地球效果。
// 形参里 ({...} = {}) 表示整个参数默认是空对象，每个属性都有默认值，不传就用默认值。所以可以写 blueMarble() 而不报错。
const blueMarble = ({
  cloudAlbedo = 0.95,
  oceanRoughness = 0.4, //海洋粗糙度,这里默认为光滑度最低值  oceanIOR = 1.33,
  emissiveColor = vec3(1, 0.6, 0.5).mul(0.15), // 发光颜色(发光强度)，0.15 可见
  oceanIOR = 1.33, //海洋的 IOR 设为 1.33（水的折射率），用来模拟海面的折射和菲涅尔效果，让海洋看起来更像真实水面。
} = {}) => {
  const color = new TextureLoader().load("/blue_marble/color.webp");
  const ocean = new TextureLoader().load("/blue_marble/ocean.webp");
  const clouds = new TextureLoader().load("/blue_marble/clouds.webp");
  const emissive = new TextureLoader().load("/blue_marble/emissive.webp");
  color.anisotropy = 16;
  ocean.anisotropy = 16;
  clouds.anisotropy = 16;
  emissive.anisotropy = 16;

  // 海洋区域且无云, 是海洋且无云”的地方为 1，其它地方为 0
  const oceanSubClouds = mul(texture(ocean).r, texture(clouds).r.oneMinus());
  return {
    // mix(底色, 云色, 云量)：云量越大，越接近云色
    colorNode: mix(texture(color).rgb, vec3(cloudAlbedo), texture(clouds).r),
    // 自发光：城市灯光等发光遮罩* 发光颜色(发光强度)
    emissiveNode: texture(emissive).r.mul(emissiveColor),
    // 粗糙度：输入 1 → 输出 oceanRoughness（海洋较光滑）
    // 输入 0 → 输出 1（陆地/云更粗糙）
    roughnessNode: oceanSubClouds.remap(1, 0, oceanRoughness, 1),
    // 这里把海洋的 IOR 设为 1.33（水的折射率），用来模拟海面的折射和菲涅尔效果，让海洋看起来更像真实水面。
    // 默认把整个地球都设为 1.33，？？
    ior: oceanIOR,
  };
};

// 地球模型,使用WebGPUObject组件渲染
function Content() {
  console.log("重新渲染地球");

  // 获取相机, 接收一个选择器函数（selector），R3F 会把包含整个场景状态的 state 对象传给它：
  // state 里大概长这样：camera,  当前活跃相机  scene, Three.js Scene  gl, WebGPU/WebGL 渲染器
  //选择器 ({ camera }) => camera 从 state 中解构出 camera 并返回，所以最终 const camera 拿到的就是当前的 Three.js 相机对象。
  const renderer = useThree<Renderer>(({ gl }) => gl as any)
  const scene = useThree(({ scene }) => scene)
  const camera = useThree(({ camera }) => camera)

  // 大气上下文对象,使用useMemo缓存,避免重复创建大气上下文对象
  const atmosphereContext = useResource(() => new AtmosphereContextNode(), [])
  // 将 camera 同步到 atmosphereContext（大气光照需要相机位置做透射率计算）
  atmosphereContext.camera = camera;

  // 在DOM 更新前同步执行,确保渲染器在渲染前就有正确的大气上下文
  // renderer.contextNode是 Three.js WebGPU 渲染器的全局上下文节点,可以存储在着色器中共享的数据
  // 这样,后面所有使用 MeshPhysicalNodeMaterial 的材质都可以通过 getAtmosphere() 访问到大气参数(如太阳方向、月亮方向、大气散射参数等),从而实现正确的大气渲染效果。
  // 简单来说: 这是在给 Three.js 渲染器"装配"大气系统,让所有材质都知道当前场景有大气层,并能获取大气相关的光照信息。
  useLayoutEffect(() => {
    renderer.contextNode = context({
      ...renderer.contextNode.value,
      getAtmosphere: () => atmosphereContext
    })
  }, [renderer, atmosphereContext])

  //-------------------------------------------------------------------------------------
  // 初始化太阳/月亮方向（基于当前系统时间）
  // 只有第一次渲染时，才初始化太阳/月亮方向
  //  后续要实时变化时间，实现动态效果
  useEffect(() => {
    const date = new Date();
    console.log("date", date);
    // 获取大气上下文对象的属性(直接取出属性值)
    const { matrixECIToECEF, sunDirectionECEF, moonDirectionECEF } =
      atmosphereContext;

    //
    getECIToECEFRotationMatrix(date, matrixECIToECEF.value);
    getSunDirectionECI(date, sunDirectionECEF.value).applyMatrix4(matrixECIToECEF.value);
    getMoonDirectionECI(date, moonDirectionECEF.value).applyMatrix4(matrixECIToECEF.value);
  
  }, []);

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

  //-------------------------------------------------------------------------------------
  // 地球材质,使用useMemo缓存,避免重复创建材质对象
  const earthMaterial = useResource(
    () => new MeshPhysicalNodeMaterial(blueMarble()),
    [],
  );


  return (
    <>
      {/* 大气光照：根据大气透射率自动计算太阳颜色 */}
      <atmosphereLight args={[atmosphereContext]} />

      {/* 地球模型 */}
      <EllipsoidMesh
        args={[Ellipsoid.WGS84.radii, 360, 180]}
        material={earthMaterial}
      />

      {/* 相机限制在地球表面以外 */}
      <OrbitControls minDistance={1.2e6} enablePan={false} />
    </>
  );
}

export default function Atmosphere() {
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
        fov: 60,
        position: [-2e7, 0, 0],
        up: [0, 0, 1],
        near: 1e4,
        far: 1e9,
      }}
    >
      <Content />
    </WebGPUCanvas>
  );
}
