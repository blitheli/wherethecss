import { Environment } from "@react-three/drei";
import { WebGPUCanvas } from "../components/WebGPUCanvas";
import { GlobeControls } from "3d-tiles-renderer/r3f";
import { Globe } from "../components/Globe";

/*
  R3F + XYZTilesPlugin 椭球影像（ESRI World Imagery）冒烟页
*/

export default function GlobeTest() {
  return (
    <WebGPUCanvas
      forceWebGL={false}
      shadows
      renderer={{
        logarithmicDepthBuffer: true,
      }}
      camera={{
        fov: 60,
        position: [0, -2e7, 0],
        near: 1e3,
        far: 1e9,
      }}
    >
      <Globe />
      <GlobeControls enableDamping={true} minDistance={1e6} maxDistance={1e8} />
      <Environment
        preset="sunset"
        background={true}
        backgroundBlurriness={0.9}
        environmentIntensity={1}
      />
    </WebGPUCanvas>
  );
}
