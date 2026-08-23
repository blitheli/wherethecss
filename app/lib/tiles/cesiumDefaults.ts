/**
 * Cesium Ion 访问令牌。
 * 优先使用 VITE_CESIUM_ION_TOKEN；未配置时回退到 CesiumJS 公开发布的默认演示令牌
 *（见 CesiumGS/cesium Ion.js，标注有效期至 2026-10-01）。生产请自备令牌。
 */
export const CESIUM_DEFAULT_ION_TOKEN =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqdGkiOiJkYjZkM2MyOS1mODRiLTRlMGQtYTYzMy0xNWYyYmNiZjE1NGUiLCJpZCI6MjU5LCJzdWIiOiJDZXNpdW1KUyIsImlzcyI6Imh0dHBzOi8vYXBpLmNlc2l1bS5jb20iLCJhdWQiOiIxLjE0NCBSZWxlYXNlIC0gRGVsZXRlIG9uIE9jdG9iZXIgMSwgMjAyNiIsImlhdCI6MTc4NDk1ODg5MH0.x3Ra1-m0GEx7jwv8wnz-bAt4SSG3_ZCC9zU_MwzfjA4";

export function resolveCesiumIonToken(): string {
  const fromEnv = import.meta.env.VITE_CESIUM_ION_TOKEN as string | undefined;
  if (fromEnv && fromEnv.length > 10) return fromEnv;
  return CESIUM_DEFAULT_ION_TOKEN;
}

/** Cesium World Terrain（量化网格） */
export const CESIUM_WORLD_TERRAIN_ASSET_ID = 1;

/**
 * 全球 3D Tiles（经 Ion 解析）。本仓库历史默认 2275207。
 */
export const CESIUM_GLOBAL_3D_TILES_ASSET_ID = 2275207;

/** 公开 ESRI 全球影像（无需 token，XYZ；{z}/{y}/{x}） */
export const ESRI_WORLD_IMAGERY_XYZ =
  "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}";
