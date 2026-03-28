import { StrictMode, useMemo, useEffect } from "react";
import { createRoot } from "react-dom/client";
import { Canvas, extend, useThree, useFrame } from "@react-three/fiber";
import { OrbitControls, Stats } from "@react-three/drei";
import { AgXToneMapping, TextureLoader } from "three";
import { mix, mul, texture, vec3, pass, mrt, output, uniform, toneMapping, } from "three/tsl";
import { MeshPhysicalNodeMaterial, WebGPURenderer, RenderPipeline } from "three/webgpu";
import { lensFlare, temporalAntialias, dithering, highpVelocity } from "@takram/three-geospatial/webgpu";
import {
  getECIToECEFRotationMatrix,
  getMoonDirectionECI,
  getSunDirectionECI,
  getSunDirectionECEF,
  getMoonDirectionECEF,
} from '@takram/three-atmosphere'
import {
  aerialPerspective,
  AtmosphereContextNode,
  AtmosphereLight,
  AtmosphereLightNode
} from '@takram/three-atmosphere/webgpu'
import { Ellipsoid } from '@takram/three-geospatial'
import { EllipsoidMesh } from '@takram/three-geospatial/r3f'
import { WebGPUCanvas } from '../components/WebGPUCanvas'


extend({ MeshPhysicalNodeMaterial });
extend({ AtmosphereLight });

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

  console.log("渲染地球");


  //-------------------------------------------------------------------------------------
  // 地球材质,使用useMemo缓存,避免重复创建材质对象
  const earthMaterial = useMemo(
    () => new MeshPhysicalNodeMaterial(blueMarble()),
    [],
  );

  return (
    <>
    
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

export default function ONLY_EARTH() {
  return (
    <WebGPUCanvas
    shadows
    renderer={{
      logarithmicDepthBuffer: true,
      onInit: renderer => {
      //  renderer.library.addLight(AtmosphereLightNode, AtmosphereLight)
      }
    }}
    camera={{
      fov: 60,
      position: [-2e7, 0, 0],
      up: [0, 0, 1],
      near: 1e4,
      far: 1e9
    }}
  > <Content /> </WebGPUCanvas>
  );
}
