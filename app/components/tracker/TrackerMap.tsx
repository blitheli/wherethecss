import { useEffect, useRef } from "react";
import {
  Map as MapLibreMap,
  Marker,
  NavigationControl,
  type GeoJSONSource,
  type StyleSpecification,
} from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { formatBeijingClock, formatUtcShort } from "../../lib/clock/simClock";

type Pt = { lon: number; lat: number };

/** Carto Dark Matter 栅格底图（深色任务控制台风格） */
const DARK_STYLE: StyleSpecification = {
  version: 8,
  sources: {
    carto: {
      type: "raster",
      tiles: [
        "https://a.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}@2x.png",
        "https://b.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}@2x.png",
        "https://c.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}@2x.png",
      ],
      tileSize: 256,
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
    },
  },
  layers: [{ id: "carto", type: "raster", source: "carto" }],
};

/**
 * 2D 实时窗：深色世界底图 + 星下点轨迹 + 当前位置。
 * 顶栏居中大屏显示北京时间（仿真时钟）。
 */
export function TrackerMap({
  track,
  current,
  simTimeMs,
  modeLabel,
}: {
  track: Pt[];
  current: Pt | null;
  simTimeMs: number;
  modeLabel: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const markerRef = useRef<Marker | null>(null);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = new MapLibreMap({
      container: containerRef.current,
      style: DARK_STYLE,
      center: current ? [current.lon, current.lat] : [110, 20],
      zoom: 1.6,
      attributionControl: { compact: true },
    });
    map.addControl(new NavigationControl({ showCompass: false }), "bottom-right");
    const ensureTrackLayer = () => {
      if (!map.getSource("css-track")) {
        map.addSource("css-track", {
          type: "geojson",
          data: { type: "FeatureCollection", features: [] },
        });
      }
      if (!map.getLayer("css-track-line")) {
        map.addLayer({
          id: "css-track-line",
          type: "line",
          source: "css-track",
          layout: { "line-join": "round", "line-cap": "round" },
          paint: {
            "line-color": "#38bdf8",
            "line-width": 3,
            "line-opacity": 0.95,
          },
        });
      }
    };
    map.on("load", ensureTrackLayer);
    map.on("styledata", ensureTrackLayer);
    mapRef.current = map;
    return () => {
      markerRef.current?.remove();
      markerRef.current = null;
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const apply = () => {
      const src = map.getSource("css-track") as GeoJSONSource | undefined;
      if (!src) return;
      const lines: Pt[][] = [];
      let curLine: Pt[] = [];
      let prev: Pt | null = null;
      for (const p of track) {
        if (prev && Math.abs(p.lon - prev.lon) > 180) {
          if (curLine.length >= 2) lines.push(curLine);
          curLine = [];
        }
        curLine.push(p);
        prev = p;
      }
      if (curLine.length >= 2) lines.push(curLine);

      src.setData({
        type: "FeatureCollection",
        features: lines.map((line) => ({
          type: "Feature",
          properties: {},
          geometry: {
            type: "LineString",
            coordinates: line.map((p) => [p.lon, p.lat]),
          },
        })),
      });
    };

    if (map.isStyleLoaded()) apply();
    else map.once("load", apply);
  }, [track]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !current) return;

    if (!markerRef.current) {
      const el = document.createElement("div");
      el.className = "css-pos-marker";
      el.innerHTML =
        '<span class="css-pos-pulse"></span><span class="css-pos-dot"></span>';
      markerRef.current = new Marker({ element: el })
        .setLngLat([current.lon, current.lat])
        .addTo(map);
    } else {
      markerRef.current.setLngLat([current.lon, current.lat]);
    }

    const z = map.getZoom();
    if (z < 2.5) {
      map.easeTo({ center: [current.lon, current.lat], duration: 600 });
    }
  }, [current]);

  const bj = formatBeijingClock(simTimeMs);

  return (
    <div className="relative overflow-hidden rounded-xl border border-zinc-800 bg-black shadow-[0_0_40px_rgba(0,0,0,0.5)]">
      <div className="pointer-events-none absolute inset-x-0 top-0 z-10 flex flex-col items-center bg-gradient-to-b from-black/80 via-black/40 to-transparent px-3 pb-10 pt-4">
        <p className="text-[11px] font-medium tracking-[0.35em] text-sky-400/90 uppercase">
          北京时间 · {modeLabel}
        </p>
        <p className="mt-1 font-mono text-4xl font-medium tabular-nums tracking-wider text-white drop-shadow sm:text-5xl md:text-6xl">
          {bj.time}
        </p>
        <p className="mt-1 font-mono text-sm text-zinc-300 sm:text-base">{bj.date}</p>
        <p className="mt-0.5 font-mono text-[11px] text-zinc-500">
          {formatUtcShort(simTimeMs)}
        </p>
      </div>
      <div ref={containerRef} className="h-[min(62vh,560px)] w-full" />
    </div>
  );
}
