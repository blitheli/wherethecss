/**
 * OEM / cartesianVelocity 星历插值（线性）。
 * 输入为 EME2000 米制位置速度。
 */

export type StateVector = {
  timeMs: number;
  positionM: [number, number, number];
  velocityMps: [number, number, number];
};

/** 从 [t,x,y,z,vx,vy,vz,...] 展开为状态点 */
export function expandCartesianVelocity(
  epochIso: string,
  cartesianVelocity: number[],
): StateVector[] {
  const epochMs = Date.parse(epochIso);
  const out: StateVector[] = [];
  for (let i = 0; i + 6 < cartesianVelocity.length; i += 7) {
    const t = cartesianVelocity[i]!;
    out.push({
      timeMs: epochMs + t * 1000,
      positionM: [
        cartesianVelocity[i + 1]!,
        cartesianVelocity[i + 2]!,
        cartesianVelocity[i + 3]!,
      ],
      velocityMps: [
        cartesianVelocity[i + 4]!,
        cartesianVelocity[i + 5]!,
        cartesianVelocity[i + 6]!,
      ],
    });
  }
  return out;
}

function lerp(a: number, b: number, u: number) {
  return a + (b - a) * u;
}

/** 在给定 UTC 毫秒时刻线性插值；越界则钳制到端点并标记 */
export function interpolateState(
  states: StateVector[],
  timeMs: number,
): { state: StateVector; clamped: boolean } {
  if (states.length === 0) {
    throw new Error("星历为空");
  }
  if (timeMs <= states[0]!.timeMs) {
    return { state: states[0]!, clamped: timeMs < states[0]!.timeMs };
  }
  const last = states[states.length - 1]!;
  if (timeMs >= last.timeMs) {
    return { state: last, clamped: timeMs > last.timeMs };
  }

  let lo = 0;
  let hi = states.length - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (states[mid]!.timeMs <= timeMs) lo = mid;
    else hi = mid;
  }
  const a = states[lo]!;
  const b = states[hi]!;
  const u = (timeMs - a.timeMs) / (b.timeMs - a.timeMs);
  return {
    state: {
      timeMs,
      positionM: [
        lerp(a.positionM[0], b.positionM[0], u),
        lerp(a.positionM[1], b.positionM[1], u),
        lerp(a.positionM[2], b.positionM[2], u),
      ],
      velocityMps: [
        lerp(a.velocityMps[0], b.velocityMps[0], u),
        lerp(a.velocityMps[1], b.velocityMps[1], u),
        lerp(a.velocityMps[2], b.velocityMps[2], u),
      ],
    },
    clamped: false,
  };
}

/** 截取时间窗内的 cartesianVelocity（供 Access 请求减负） */
export function sliceCartesianVelocity(
  epochIso: string,
  cartesianVelocity: number[],
  startMs: number,
  stopMs: number,
  padSec = 600,
): { epoch: string; cartesianVelocity: number[]; interval: string } {
  const epochMs = Date.parse(epochIso);
  const startSec = (startMs - epochMs) / 1000 - padSec;
  const stopSec = (stopMs - epochMs) / 1000 + padSec;
  const sliced: number[] = [];
  let firstT: number | null = null;
  for (let i = 0; i + 6 < cartesianVelocity.length; i += 7) {
    const t = cartesianVelocity[i]!;
    if (t < startSec) continue;
    if (t > stopSec) break;
    if (firstT === null) firstT = t;
    const rel = t - (firstT ?? 0);
    sliced.push(
      rel,
      cartesianVelocity[i + 1]!,
      cartesianVelocity[i + 2]!,
      cartesianVelocity[i + 3]!,
      cartesianVelocity[i + 4]!,
      cartesianVelocity[i + 5]!,
      cartesianVelocity[i + 6]!,
    );
  }
  if (sliced.length === 0) {
    throw new Error("所选时间窗内无 OEM 星历点");
  }
  const newEpochMs = epochMs + (firstT ?? 0) * 1000;
  const newEpoch = new Date(newEpochMs).toISOString().replace(/\.\d{3}Z$/, "Z");
  const interval = `${new Date(startMs).toISOString()}/${new Date(stopMs).toISOString()}`;
  return { epoch: newEpoch, cartesianVelocity: sliced, interval };
}
