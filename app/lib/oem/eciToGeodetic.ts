/**
 * EME2000/ECI 位置 → WGS84 大地坐标。
 * 变换链：EME2000(惯性) --GMST 绕 Z--> ECEF → 经纬高。
 * 精度满足可视化/星下点追踪；非精密定轨。
 */

const WGS84_A = 6378137.0;
const WGS84_F = 1 / 298.257223563;
const WGS84_E2 = WGS84_F * (2 - WGS84_F);

/** 儒略世纪自 J2000.0 起（TT≈UTC 对本可视化足够） */
function julianDate(ms: number): number {
  return ms / 86400000 + 2440587.5;
}

/** Greenwich Mean Sidereal Time (rad) */
export function gmstRadians(dateMs: number): number {
  const jd = julianDate(dateMs);
  const t = (jd - 2451545.0) / 36525.0;
  let gmst =
    280.46061837 +
    360.98564736629 * (jd - 2451545.0) +
    0.000387933 * t * t -
    (t * t * t) / 38710000.0;
  gmst = ((gmst % 360) + 360) % 360;
  return (gmst * Math.PI) / 180;
}

/** ECI/EME2000 米 → ECEF 米（简化地球自转） */
export function eciToEcef(
  positionM: [number, number, number],
  dateMs: number,
): [number, number, number] {
  const theta = gmstRadians(dateMs);
  const c = Math.cos(theta);
  const s = Math.sin(theta);
  const [x, y, z] = positionM;
  return [c * x + s * y, -s * x + c * y, z];
}

export type Geodetic = {
  longitudeDeg: number;
  latitudeDeg: number;
  heightM: number;
};

/** ECEF 米 → WGS84 经纬高 */
export function ecefToGeodetic(ecef: [number, number, number]): Geodetic {
  const [x, y, z] = ecef;
  const lon = Math.atan2(y, x);
  const p = Math.hypot(x, y);
  let lat = Math.atan2(z, p * (1 - WGS84_E2));
  for (let i = 0; i < 6; i++) {
    const sinLat = Math.sin(lat);
    const N = WGS84_A / Math.sqrt(1 - WGS84_E2 * sinLat * sinLat);
    lat = Math.atan2(z + WGS84_E2 * N * sinLat, p);
  }
  const sinLat = Math.sin(lat);
  const N = WGS84_A / Math.sqrt(1 - WGS84_E2 * sinLat * sinLat);
  const height = p / Math.cos(lat) - N;
  return {
    longitudeDeg: (lon * 180) / Math.PI,
    latitudeDeg: (lat * 180) / Math.PI,
    heightM: height,
  };
}

export function eciToGeodetic(
  positionM: [number, number, number],
  dateMs: number,
): Geodetic {
  return ecefToGeodetic(eciToEcef(positionM, dateMs));
}
