/**
 * 全站共享仿真时钟：实时跟随墙钟，或在 OEM 有效窗内回放。
 * 2D 追踪与天宫 3D 共用同一 simTimeMs。
 */
import { atom } from "jotai";
import type { OrbitDataFile } from "../oem/parseOem";

export type PlaybackMode = "realtime" | "replay";

export const playbackModeAtom = atom<PlaybackMode>("realtime");
/** 仿真时刻（UTC 毫秒）；实时模式下由 ticker 写入 */
export const simTimeMsAtom = atom<number>(Date.now());
export const orbitDataAtom = atom<OrbitDataFile | null>(null);
export const orbitLoadErrorAtom = atom<string | null>(null);

export function clampToOemWindow(
  timeMs: number,
  startMs: number,
  stopMs: number,
): number {
  if (!Number.isFinite(startMs) || !Number.isFinite(stopMs)) return timeMs;
  return Math.min(Math.max(timeMs, startMs), stopMs);
}

export function formatBeijingClock(ms: number): {
  time: string;
  date: string;
} {
  const d = new Date(ms);
  const time = d.toLocaleTimeString("zh-CN", {
    timeZone: "Asia/Shanghai",
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const date = d.toLocaleDateString("zh-CN", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
  });
  return { time, date };
}

export function formatUtcShort(ms: number): string {
  return (
    new Date(ms).toISOString().replace("T", " ").replace(/\.\d{3}Z$/, "") +
    " UTC"
  );
}
