import type { TilesRenderer as TilesRendererImpl } from "3d-tiles-renderer";
import {
  GLTFExtensionsPlugin,
  GoogleCloudAuthPlugin,
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
import {
  resolveGlobeXyzUrl,
  resolveGoogleMapsTileKey,
} from "../lib/tiles/globeDefaults";

/*
  地球（R3F + 3d-tiles-renderer）
  - google：Photorealistic 3D Tiles（真 3D Tiles + 地形网格，需 API key）
  - xyz：ESRI World Imagery 投影到 WGS84 椭球（官方 mapTiles；无 DEM）
  - auto：有 VITE_GOOGLE_MAP_API_KEY 用 google，否则 xyz

  朝向：LEO + ReorientationPlugin 时传 reoriented（勿再套 -π/2）
*/

const dracoLoader = new DRACOLoader();
dracoLoader.setDecoderPath("https://www.gstatic.com/draco/v1/decoders/");

export type GlobeSource = "auto" | "xyz" | "google";

export interface GlobeProps {
  ref?: Ref<TilesRendererImpl>;
  source?: GlobeSource;
  xyzUrl?: string;
  apiKey?: string;
  /** LEO 场景使用 ReorientationPlugin 时为 true */
  reoriented?: boolean;
  materialHandler?: () => Material;
  showAttribution?: boolean;
  children?: ReactNode;
}

function resolveSource(
  source: GlobeSource,
  apiKey: string | undefined,
): "xyz" | "google" {
  if (source === "xyz") return "xyz";
  if (source === "google") return apiKey ? "google" : "xyz";
  return apiKey ? "google" : "xyz";
}

export const Globe: FC<GlobeProps> = ({
  ref,
  source = "auto",
  xyzUrl,
  apiKey: apiKeyProp,
  reoriented = false,
  materialHandler,
  showAttribution = true,
  children,
}) => {
  const apiKey = apiKeyProp ?? resolveGoogleMapsTileKey();
  const mode = resolveSource(source, apiKey);
  const url = xyzUrl ?? resolveGlobeXyzUrl();

  // 仅纯 XYZ 全球浏览需要 -π/2；Google 3D Tiles 与 ReorientationPlugin 均不要
  const yUpFix: [number, number, number] =
    mode === "xyz" && !reoriented ? [-Math.PI / 2, 0, 0] : [0, 0, 0];

  if (mode === "google" && apiKey) {
    return (
      <group rotation={yUpFix}>
        <TilesRenderer
          ref={mergeRefs([ref, connectToDescription])}
          key={`google-${apiKey}`}
          url={`https://tile.googleapis.com/v1/3dtiles/root.json?key=${apiKey}`}
        >
          <TilesPlugin
            plugin={GoogleCloudAuthPlugin}
            args={{
              apiToken: apiKey,
              autoRefreshToken: true,
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
  }

  // XYZ 椭球：精简插件（对齐官方 mapTiles），避免压缩/折痕破坏影像
  return (
    <group rotation={yUpFix}>
      <TilesRenderer
        ref={mergeRefs([ref, connectToDescription])}
        key={`xyz-${url}-r${reoriented ? 1 : 0}`}
        errorTarget={2}
      >
        <TilesPlugin
          plugin={XYZTilesPlugin}
          args={{
            center: true,
            shape: "ellipsoid",
            levels: 20,
            url,
          }}
        />
        <TilesPlugin plugin={UpdateOnChangePlugin} />
        {materialHandler != null && (
          <TilesPlugin
            plugin={TileMaterialReplacementPlugin}
            args={[materialHandler]}
          />
        )}
        {showAttribution && <TilesAttributionOverlay />}
        {children}
      </TilesRenderer>
    </group>
  );
};
