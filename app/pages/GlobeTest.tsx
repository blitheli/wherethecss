// R3F, DREI and LEVA imports
import { Environment } from "@react-three/drei";
import { WebGPUCanvas } from "../components/WebGPUCanvas";
import { GlobeControls} from "3d-tiles-renderer/r3f";
import { CesiumGlobe } from "../components/CesiumGlobe";
import { Globe } from "../components/Globe";
/*
  CesiumGlobe 加载后帧率不高约40几
  Globe 加载后帧率很高，接近60帧，流畅
*/

// Aerometrex San Francisco High Resolution 3D Model with Street Level Enhanced 3D (Non-Commercial Trial)
//const assetId = 1415196; //2275207
const assetId = 2275207;    // Cesium全球, fps不高，也不流畅

export default function GlobeTest() {
  return (
    <WebGPUCanvas
      forceWebGL={false}
      shadows
      renderer={{
        logarithmicDepthBuffer: true,
      }}
      // 相机不用设置Z轴向上, 
      camera={{
        fov: 60,
        position: [0, -2e7, 0],  // 距离地心 2000 万米        
        near: 1e3,                // 1 公里 - 防止太近时出现精度问题
        far: 1e9,                 // 10 亿米 - 足够看到整个地球
      }}
    >
      <CesiumGlobe
        assetId={assetId as number}
      />

      {/* google 的 3D Tiles */}
      {/* <Globe/> */}

      {/* 这个专门为3D Tiles设计的控制器，使得相机可以更好地与3D Tiles交互，+Z轴向上 */}
      <GlobeControls enableDamping={true} minDistance={1e6} maxDistance={1e8} />

      {/* other r3f staging */}
      <Environment
        preset="sunset"
        background={true}
        backgroundBlurriness={0.9}
        environmentIntensity={1}
      />

    </WebGPUCanvas>
  );
}
