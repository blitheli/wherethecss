import type { TilesRenderer as TilesRendererImpl } from "3d-tiles-renderer";
import {
  GLTFExtensionsPlugin,
  TileCompressionPlugin,
  UpdateOnChangePlugin,
  CesiumIonAuthPlugin,
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
import {
  CESIUM_GLOBAL_3D_TILES_ASSET_ID,
  ESRI_WORLD_IMAGERY_XYZ,
  resolveCesiumIonToken,
} from "../lib/tiles/cesiumDefaults";

/*
  地球 3D Tiles（NASA-AMMOS/3DTilesRendererJS）
  - ion-3dtiles（默认）：Cesium Ion 全球 3D Tiles（影像+网格），令牌 resolveCesiumIonToken()
  - xyz-imagery：ESRI/公开 XYZ 椭球影像（无 token 回退，参考官方 mapTiles 示例）
*/

const dracoLoader = new DRACOLoader();
dracoLoader.setDecoderPath("https://www.gstatic.com/draco/v1/decoders/");

export type GlobeTilesSource = "xyz-imagery" | "ion-3dtiles";

export interface CesiumGlobeProps {
  ref?: Ref<TilesRendererImpl>;
  apiToken?: string;
  assetId?: number;
  source?: GlobeTilesSource;
  materialHandler?: () => Material;
  showAttribution?: boolean;
  children?: ReactNode;
}

export const CesiumGlobe: FC<CesiumGlobeProps> = ({
  ref,
  apiToken,
  assetId = CESIUM_GLOBAL_3D_TILES_ASSET_ID,
  source = "ion-3dtiles",
  materialHandler,
  showAttribution = true,
  children,
}) => {
  const token = apiToken ?? resolveCesiumIonToken();
  const useIon = source === "ion-3dtiles";

  return (
    <group rotation={useIon ? [0, 0, 0] : [-Math.PI / 2, 0, 0]}>
      <TilesRenderer
        ref={mergeRefs([ref, connectToDescription])}
        key={useIon ? `ion-3d-${assetId}` : "xyz-esri"}
      >
        {useIon ? (
          <TilesPlugin
            plugin={CesiumIonAuthPlugin}
            args={[
              {
                apiToken: token,
                assetId,
                autoRefreshToken: true,
              },
            ]}
          />
        ) : (
          <TilesPlugin
            plugin={XYZTilesPlugin}
            args={[
              {
                center: true,
                shape: "ellipsoid",
                url: ESRI_WORLD_IMAGERY_XYZ,
              },
            ]}
          />
        )}

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
