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
  地球影像（R3F + 3d-tiles-renderer XYZTilesPlugin）
  - 默认 ESRI World Imagery → WGS84 椭球（官方 mapTiles 示例）
  - 无 Cesium Ion

  坐标系注意（ECEF Z-up → three.js Y-up）：
  - 全球浏览（无 ReorientationPlugin）：需要 group.rotation.x = -π/2（官方 mapTiles.js）
  - LEO / 天宫（有 ReorientationPlugin）：插件已把 ECEF 转到局部 Y-up，
    再套父级 -π/2 会双重旋转，导致地球不在视野 / 黑屏。此时传 reoriented
*/

const dracoLoader = new DRACOLoader();
dracoLoader.setDecoderPath("https://www.gstatic.com/draco/v1/decoders/");

export interface GlobeProps {
  ref?: Ref<TilesRendererImpl>;
  /** XYZ 瓦片 URL 模板；默认 ESRI World Imagery */
  xyzUrl?: string;
  /**
   * 为 true 时表示场景使用 ReorientationPlugin（LEO 原点重定向）。
   * 此时不再额外施加 XYZ 的 -π/2 父旋转。
   */
  reoriented?: boolean;
  materialHandler?: () => Material;
  showAttribution?: boolean;
  children?: ReactNode;
}

export const Globe: FC<GlobeProps> = ({
  ref,
  xyzUrl,
  reoriented = false,
  materialHandler,
  showAttribution = true,
  children,
}) => {
  const url = xyzUrl ?? resolveGlobeXyzUrl();
  const yUpFix: [number, number, number] = reoriented
    ? [0, 0, 0]
    : [-Math.PI / 2, 0, 0];

  return (
    <group rotation={yUpFix}>
      <TilesRenderer
        ref={mergeRefs([ref, connectToDescription])}
        key={`xyz-${url}-r${reoriented ? 1 : 0}`}
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
