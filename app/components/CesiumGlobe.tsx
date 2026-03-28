import {
  GLTFExtensionsPlugin,
  UpdateOnChangePlugin,
} from "3d-tiles-renderer/plugins";
import { CesiumIonAuthPlugin } from "3d-tiles-renderer/core/plugins";
import {
  TilesPlugin,
  TilesRenderer,
  TilesAttributionOverlay,
} from "3d-tiles-renderer/r3f";
import type { FC, ReactNode } from "react";
import { DRACOLoader } from "three/addons/loaders/DRACOLoader.js";

/*
  1. 使用Cesium Ion的API Token和资产ID加载3D Tiles, 数据源: Cesium ION
  2. 不需要使用ReorientationPlugin, 因为Cesium Ion的3D Tiles已经是正确朝向的(ECEF坐标系)，不需要额外旋转。
  3. 为了使得相机看地球正确，使用GlobeControls，并设置了合适的 minDistance 和 maxDistance，限制相机只能在地球表面以外移动。

  2026-03-23 blitheli
*/

console.log("Cesium Ion API Token:", import.meta.env.VITE_CESIUM_ION_TOKEN);

const dracoLoader = new DRACOLoader();
dracoLoader.setDecoderPath("https://www.gstatic.com/draco/v1/decoders/");

export interface CesiumGlobeProps {
  apiToken?: string;
  assetId?: number;
  showAttribution?: boolean;
  children?: ReactNode;
}

export const CesiumGlobe: FC<CesiumGlobeProps> = ({
  // Cesium Ion 默认 token (公共示例 token)
  apiToken = import.meta.env.VITE_CESIUM_ION_TOKEN,
  // Aerometrex San Francisco High Resolution 3D Model (默认)
  assetId = 1415196,
  showAttribution = true,
  children,
}) => (
  <TilesRenderer key={assetId}>
    <TilesPlugin plugin={CesiumIonAuthPlugin} args={[{ apiToken, assetId }]} />
    <TilesPlugin plugin={GLTFExtensionsPlugin} dracoLoader={dracoLoader} />    
    <TilesPlugin plugin={UpdateOnChangePlugin} />
    {showAttribution && <TilesAttributionOverlay />}
    {children}
  </TilesRenderer>
);
