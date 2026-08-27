/**
 * 3D 地球默认影像（无需 token）。
 * 对齐 NASA-AMMOS/3DTilesRendererJS mapTiles 椭球模式 + 社区 ArcGIS 示例。
 * 真 3D Tiles（含地形网格）优先用 Google Photorealistic（需 VITE_GOOGLE_MAP_API_KEY）。
 */

/** ESRI World Imagery（{z}/{y}/{x}，与 bertt/3DGS 等示例一致） */
export const ESRI_WORLD_IMAGERY_XYZ =
  "https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}";

/** 可通过 VITE_GLOBE_XYZ_URL 覆盖默认影像模板 */
export function resolveGlobeXyzUrl(): string {
  const fromEnv = import.meta.env.VITE_GLOBE_XYZ_URL as string | undefined;
  if (fromEnv && fromEnv.includes("{z}")) return fromEnv;
  return ESRI_WORLD_IMAGERY_XYZ;
}

export function resolveGoogleMapsTileKey(): string | undefined {
  const key = import.meta.env.VITE_GOOGLE_MAP_API_KEY as string | undefined;
  if (key && key.length > 8) return key;
  return undefined;
}
