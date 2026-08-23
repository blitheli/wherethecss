import type { TilesRenderer as TilesRendererImpl } from "3d-tiles-renderer";
import {
  GLTFExtensionsPlugin,
  TileCompressionPlugin,
  UpdateOnChangePlugin,
  XYZTilesPlugin,
} from "3d-tiles-renderer/plugins";
import {
  TilesPlugin,
  TilesRenderer,
  TilesAttributionOverlay,
} from "3d-tiles-renderer/r3f";
import type { FC, ReactNode, Ref } from "react";
import { mergeRefs } from "react-merge-refs";
import type { Material } from "three";
import { DRACOLoader } from "three/addons/loaders/DRACOLoader.js";
import { radians } from "@takram/three-geospatial";
import { TilesFadePlugin } from "../plugins/fade/TilesFadePlugin";
import { TileCreasedNormalsPlugin } from "../plugins/TileCreasedNormalsPlugin";
import { TileMaterialReplacementPlugin } from "../plugins/TileMaterialReplacementPlugin";
import { connectToDescription } from "./Description";
import { resolveGlobeXyzUrl } from "../lib/tiles/globeDefaults";

/*
  地球影像（R3F + 3d-tiles-renderer）
  - 默认：XYZTilesPlugin + ESRI World Imagery，投影到 WGS84 椭球（官方 mapTiles 椭球模式）
  - 不依赖 Cesium Ion / Google Photorealistic
  - XYZ 椭球需 group.rotation.x = -π/2（与官方 mapTiles.js 一致）
*/

const dracoLoader = new DRACOLoader();
dracoLoader.setDecoderPath("https://www.gstatic.com/draco/v1/decoders/");

export interface GlobeProps {
  ref?: Ref<TilesRendererImpl>;
  /** XYZ 瓦片 URL 模板；默认 ESRI World Imagery */
  xyzUrl?: string;
  materialHandler?: () => Material;
  showAttribution?: boolean;
  children?: ReactNode;
}

export const Globe: FC<GlobeProps> = ({
  ref,
  xyzUrl,
  materialHandler,
  showAttribution = true,
  children,
}) => {
  const url = xyzUrl ?? resolveGlobeXyzUrl();

  return (
    <group rotation={[-Math.PI / 2, 0, 0]}>
      <TilesRenderer
        ref={mergeRefs([ref, connectToDescription])}
        key={`xyz-${url}`}
      >
        <TilesPlugin
          plugin={XYZTilesPlugin}
          args={{
            center: true,
            shape: "ellipsoid",
            url,
          }}
        />
        <TilesPlugin plugin={GLTFExtensionsPlugin} dracoLoader={dracoLoader} />
        <TilesPlugin plugin={TileCompressionPlugin} />
        <TilesPlugin plugin={UpdateOnChangePlugin} />
        <TilesPlugin
          plugin={TileCreasedNormalsPlugin}
          args={{ creaseAngle: radians(30) }}
        />
        {materialHandler != null && (
          <TilesPlugin
            plugin={TileMaterialReplacementPlugin}
            args={[materialHandler]}
          />
        )}
        <TilesPlugin plugin={TilesFadePlugin} />
        {showAttribution && <TilesAttributionOverlay />}
        {children}
      </TilesRenderer>
    </group>
  );
};
