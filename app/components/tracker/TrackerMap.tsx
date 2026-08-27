import { useEffect, useRef, useState } from "react";
import {
  Map as MapLibreMap,
  Marker,
  NavigationControl,
} from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { formatBeijingClock, formatUtcShort } from "../../lib/clock/simClock";
import { chineseDarkMapStyle } from "../../lib/map/chineseDarkStyle";

type Pt = { lon: number; lat: number };

function splitAntimeridian(track: Pt[]): Pt[][] {
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
  return lines;
}

/**
 * 2D：高德中文底图（CSS invert 深色）+ SVG 星下点叠加（不受 invert 影响）+ 当前位置。
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
  const [pathDs, setPathDs] = useState<string[]>([]);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = new MapLibreMap({
      container: containerRef.current,
      style: chineseDarkMapStyle,
      center: current ? [current.lon, current.lat] : [105, 35],
      zoom: 1.8,
      attributionControl: { compact: true },
    });
    map.addControl(new NavigationControl({ showCompass: false }), "bottom-right");
    mapRef.current = map;
    return () => {
      markerRef.current?.remove();
      markerRef.current = null;
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 用 map.project 把星下点投到屏幕 SVG（画在 canvas 之上，避免 invert 把轨迹冲掉）
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const redraw = () => {
      const lines = splitAntimeridian(track);
      const ds = lines.map((line) => {
        const parts: string[] = [];
        for (let i = 0; i < line.length; i++) {
          const p = line[i]!;
          const { x, y } = map.project([p.lon, p.lat]);
          parts.push(`${i === 0 ? "M" : "L"} ${x.toFixed(1)} ${y.toFixed(1)}`);
        }
        return parts.join(" ");
      });
      setPathDs(ds);
    };

    redraw();
    map.on("move", redraw);
    map.on("zoom", redraw);
    map.on("resize", redraw);
    return () => {
      map.off("move", redraw);
      map.off("zoom", redraw);
      map.off("resize", redraw);
    };
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

    if (map.getZoom() < 2.5) {
      map.easeTo({ center: [current.lon, current.lat], duration: 600 });
    }
  }, [current]);

  const bj = formatBeijingClock(simTimeMs);

  return (
    <div className="relative overflow-hidden rounded-xl border border-zinc-800 bg-black shadow-[0_0_40px_rgba(0,0,0,0.5)]">
      <div className="pointer-events-none absolute inset-x-0 top-0 z-20 flex flex-col items-center bg-gradient-to-b from-black/85 via-black/45 to-transparent px-3 pb-10 pt-4">
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
      <div
        ref={containerRef}
        className="mc-zh-map h-[min(62vh,560px)] w-full"
      />
      <svg
        className="pointer-events-none absolute inset-0 z-10 h-full w-full"
        aria-hidden
      >
        {pathDs.map((d, i) => (
          <g key={i}>
            <path
              d={d}
              fill="none"
              stroke="#38bdf8"
              strokeWidth={6}
              strokeOpacity={0.25}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d={d}
              fill="none"
              stroke="#7dd3fc"
              strokeWidth={2.5}
              strokeOpacity={0.95}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </g>
        ))}
      </svg>
    </div>
  );
}
