import type { TilesRenderer as TilesRendererImpl } from '3d-tiles-renderer'
import {
  GLTFExtensionsPlugin,
  TileCompressionPlugin,
  UpdateOnChangePlugin,
  CesiumIonAuthPlugin
} from "3d-tiles-renderer/plugins";
import {
  TilesPlugin,
  TilesRenderer,
  TilesAttributionOverlay,
} from "3d-tiles-renderer/r3f";
import type { FC, ReactNode, Ref } from "react";
import { mergeRefs } from 'react-merge-refs'
import type { Material } from 'three';
import { DRACOLoader } from "three/addons/loaders/DRACOLoader.js";
import { radians } from '@takram/three-geospatial'
import { TilesFadePlugin } from '../plugins/fade/TilesFadePlugin'
import { TileCreasedNormalsPlugin } from '../plugins/TileCreasedNormalsPlugin'
import { TileMaterialReplacementPlugin } from '../plugins/TileMaterialReplacementPlugin'
import { connectToDescription } from './Description'

/*
  1. 使用Cesium Ion的API Token和资产ID加载3D Tiles, 数据源: Cesium ION

  2026-03-29 blitheli
*/

const dracoLoader = new DRACOLoader();
dracoLoader.setDecoderPath("https://www.gstatic.com/draco/v1/decoders/");

export interface CesiumGlobeProps {
  ref?: Ref<TilesRendererImpl>
  apiToken?: string;
  assetId?: number;
  materialHandler?: () => Material
  showAttribution?: boolean;
  children?: ReactNode;
}

export const CesiumGlobe: FC<CesiumGlobeProps> = ({
  ref,
  // Cesium Ion 默认 token (公共示例 token)
  apiToken = import.meta.env.VITE_CESIUM_ION_TOKEN,  
  assetId = 2275207,    // Cesium全球,,
  materialHandler,
  showAttribution = true,
  children,
}) => (
  <TilesRenderer ref={mergeRefs([ref, connectToDescription])}>
    <TilesPlugin plugin={CesiumIonAuthPlugin} args={[{ apiToken, assetId }]} />
    <TilesPlugin plugin={GLTFExtensionsPlugin} dracoLoader={dracoLoader} />    
    <TilesPlugin plugin={TileCompressionPlugin} />
    <TilesPlugin plugin={UpdateOnChangePlugin} />
    <TilesPlugin
      plugin={TileCreasedNormalsPlugin}
      args={{ creaseAngle: radians(30) }}
    />
    <TilesPlugin
      plugin={TileMaterialReplacementPlugin}
      args={materialHandler}
    />
    <TilesPlugin plugin={TilesFadePlugin} />
    {showAttribution && <TilesAttributionOverlay />}
    {children}
  </TilesRenderer>
);
