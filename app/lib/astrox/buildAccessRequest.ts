/**
 * 按 ASTROX access 技能构造 AccessComputeV2 请求。
 * GS→卫星：From=SitePosition，To=CzmlPosition（CMSE OEM 星历）。
 * 卫星→卫星：两端均可为 CzmlPosition / SGP4。
 */

import type { OrbitDataFile } from "../oem/parseOem";
import { sliceCartesianVelocity } from "../oem/interpolate";

export type GroundSite = {
  name: string;
  /** [经度 deg, 纬度 deg, 高度 m] */
  cartographicDegrees: [number, number, number];
  minElevationDeg?: number;
};

export function buildGsToCssAccessRequest(opts: {
  site: GroundSite;
  orbit: OrbitDataFile;
  startIso: string;
  stopIso: string;
  outStep?: number;
  computeAER?: boolean;
  description?: string;
}) {
  const startMs = Date.parse(opts.startIso);
  const stopMs = Date.parse(opts.stopIso);
  const sliced = sliceCartesianVelocity(
    opts.orbit.epoch,
    opts.orbit.cartesianVelocity,
    startMs,
    stopMs,
  );

  const minEl = opts.site.minElevationDeg ?? 10;
  return {
    Description:
      opts.description ??
      `${opts.site.name} → 中国空间站（CMSE OEM / CzmlPosition）`,
    Start: opts.startIso.replace(/\.\d{3}Z$/, "Z"),
    Stop: opts.stopIso.replace(/\.\d{3}Z$/, "Z"),
    OutStep: opts.outStep ?? 60,
    ComputeAER: opts.computeAER ?? true,
    UseLightTimeDelay: false,
    FromObjectPath: {
      Name: `Facility/${opts.site.name}`,
      Description: opts.site.name,
      Position: {
        $type: "SitePosition",
        CentralBody: "Earth",
        cartographicDegrees: opts.site.cartographicDegrees,
        clampToGround: false,
      },
      Constraints: [
        {
          $type: "ElevationAngle",
          Text: `最小仰角 ${minEl}°`,
          MinimumValue: minEl,
        },
      ],
    },
    ToObjectPath: {
      Name: "Satellite/CSS",
      Description: `中国空间站 OEM ${opts.orbit.fileName}`,
      Position: {
        $type: "CzmlPosition",
        CentralBody: "Earth",
        interpolationAlgorithm: "LAGRANGE",
        interpolationDegree: 5,
        referenceFrame: "INERTIAL",
        epoch: sliced.epoch,
        interval: sliced.interval,
        cartesianVelocity: sliced.cartesianVelocity,
      },
    },
  };
}

/** 预置地面站（公开坐标，非机密） */
export const PRESET_SITES: GroundSite[] = [
  {
    name: "北京",
    cartographicDegrees: [116.391, 39.907, 50],
    minElevationDeg: 10,
  },
  {
    name: "三亚",
    cartographicDegrees: [109.311, 18.313, 0],
    minElevationDeg: 10,
  },
  {
    name: "酒泉",
    cartographicDegrees: [100.28, 40.96, 1000],
    minElevationDeg: 10,
  },
  {
    name: "文昌",
    cartographicDegrees: [110.75, 19.61, 20],
    minElevationDeg: 10,
  },
];
