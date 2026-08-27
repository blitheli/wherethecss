import type { StyleSpecification } from "maplibre-gl";

/**
 * 高德公开栅格瓦片（lang=zh_cn，中文地名）。
 * 原图为浅色路网；通过 CSS invert 滤镜转为任务控制台深色观感（见 app.css .mc-zh-map）。
 * 说明：非官方 SDK，仅作公开瓦片底图；生产环境建议换自有授权图源。
 */
export const GAODE_ZH_TILES = [
  "https://webrd01.is.autonavi.com/appmaptile?lang=zh_cn&size=1&scale=1&style=8&x={x}&y={y}&z={z}",
  "https://webrd02.is.autonavi.com/appmaptile?lang=zh_cn&size=1&scale=1&style=8&x={x}&y={y}&z={z}",
  "https://webrd03.is.autonavi.com/appmaptile?lang=zh_cn&size=1&scale=1&style=8&x={x}&y={y}&z={z}",
  "https://webrd04.is.autonavi.com/appmaptile?lang=zh_cn&size=1&scale=1&style=8&x={x}&y={y}&z={z}",
];

export const chineseDarkMapStyle: StyleSpecification = {
  version: 8,
  sources: {
    "gaode-zh": {
      type: "raster",
      tiles: GAODE_ZH_TILES,
      tileSize: 256,
      attribution:
        '&copy; <a href="https://lbs.amap.com/" target="_blank" rel="noreferrer">高德地图</a>',
      maxzoom: 18,
    },
  },
  layers: [
    {
      id: "gaode-zh",
      type: "raster",
      source: "gaode-zh",
      paint: {
        "raster-brightness-min": 0.05,
        "raster-saturation": -0.15,
      },
    },
  ],
};
