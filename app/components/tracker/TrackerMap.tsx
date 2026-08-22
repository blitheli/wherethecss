import { useMemo } from "react";

type Pt = { lon: number; lat: number };

function project(lon: number, lat: number, w: number, h: number) {
  const x = ((lon + 180) / 360) * w;
  const y = ((90 - lat) / 180) * h;
  return { x, y };
}

/** 简易等距圆柱投影星下点地图（非版权瓦片，自绘网格） */
export function TrackerMap({
  track,
  current,
  width = 960,
  height = 480,
}: {
  track: Pt[];
  current: Pt | null;
  width?: number;
  height?: number;
}) {
  const pathD = useMemo(() => {
    if (track.length === 0) return "";
    const parts: string[] = [];
    let prev: Pt | null = null;
    for (const p of track) {
      const { x, y } = project(p.lon, p.lat, width, height);
      if (!prev) {
        parts.push(`M ${x} ${y}`);
      } else if (Math.abs(p.lon - prev.lon) > 180) {
        // 日界线断开
        parts.push(`M ${x} ${y}`);
      } else {
        parts.push(`L ${x} ${y}`);
      }
      prev = p;
    }
    return parts.join(" ");
  }, [track, width, height]);

  const cur = current
    ? project(current.lon, current.lat, width, height)
    : null;

  const parallels = [-60, -30, 0, 30, 60];
  const meridians = [-150, -120, -90, -60, -30, 0, 30, 60, 90, 120, 150];

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="h-auto w-full rounded-lg border border-slate-700/60 bg-[#0b1a2b]"
      role="img"
      aria-label="中国空间站星下点轨迹图"
    >
      <defs>
        <linearGradient id="ocean" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#0e2a44" />
          <stop offset="100%" stopColor="#081520" />
        </linearGradient>
      </defs>
      <rect width={width} height={height} fill="url(#ocean)" />
      {parallels.map((lat) => {
        const y = project(0, lat, width, height).y;
        return (
          <g key={lat}>
            <line
              x1={0}
              x2={width}
              y1={y}
              y2={y}
              stroke="#1e3a54"
              strokeWidth={1}
            />
            <text x={6} y={y - 4} fill="#64748b" fontSize={11}>
              {lat}°
            </text>
          </g>
        );
      })}
      {meridians.map((lon) => {
        const x = project(lon, 0, width, height).x;
        return (
          <line
            key={lon}
            x1={x}
            x2={x}
            y1={0}
            y2={height}
            stroke="#1e3a54"
            strokeWidth={1}
          />
        );
      })}
      {/* 简化大陆示意：中国大致范围高亮框，非正式底图 */}
      <rect
        x={project(73, 54, width, height).x}
        y={project(73, 54, width, height).y}
        width={project(135, 18, width, height).x - project(73, 54, width, height).x}
        height={project(135, 18, width, height).y - project(73, 54, width, height).y}
        fill="none"
        stroke="#334155"
        strokeDasharray="4 4"
        opacity={0.5}
      />
      <path
        d={pathD}
        fill="none"
        stroke="#38bdf8"
        strokeWidth={2}
        strokeLinecap="round"
        opacity={0.9}
      />
      {cur && (
        <g>
          <circle cx={cur.x} cy={cur.y} r={10} fill="#38bdf8" opacity={0.25} />
          <circle cx={cur.x} cy={cur.y} r={5} fill="#f8fafc" stroke="#0ea5e9" strokeWidth={2} />
        </g>
      )}
    </svg>
  );
}
