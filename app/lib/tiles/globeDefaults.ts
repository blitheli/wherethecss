/**
 * 3D 地球默认影像（无需 token）。
 * 对齐 NASA-AMMOS/3DTilesRendererJS 官方 mapTiles 示例中的 XYZTilesPlugin 椭球模式；
 * 使用 ESRI World Imagery 卫星影像（相对 OSM 更适合「地球影像」）。
 * 见：https://nasa-ammos.github.io/3DTilesRendererJS/three/mapTiles.html
 */

/** ESRI World Imagery XYZ（{z}/{y}/{x}） */
export const ESRI_WORLD_IMAGERY_XYZ =
  "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}";

/** 可通过 VITE_GLOBE_XYZ_URL 覆盖默认影像模板 */
export function resolveGlobeXyzUrl(): string {
  const fromEnv = import.meta.env.VITE_GLOBE_XYZ_URL as string | undefined;
  if (fromEnv && fromEnv.includes("{z}")) return fromEnv;
  return ESRI_WORLD_IMAGERY_XYZ;
}
