/**
 * 解析 CMSE 发布的 CCSDS OEM 2.0（中国空间站轨道星历）。
 * 参考系：EME2000（惯性系），单位：km / km/s（文件 COMMENT 声明）。
 */

export type OemMeta = {
  version: string;
  creationDate: string;
  originator: string;
  objectName: string;
  objectId: string;
  centerName: string;
  refFrame: string;
  timeSystem: string;
  startTime: string;
  stopTime: string;
};

export type OemPoint = {
  /** UTC ISO 时间（无时区后缀时按 UTC 理解） */
  time: string;
  /** EME2000 位置，米 */
  positionM: [number, number, number];
  /** EME2000 速度，米/秒 */
  velocityMps: [number, number, number];
};

export type ParsedOem = {
  meta: OemMeta;
  points: OemPoint[];
  /** 相邻点间隔（秒），由前两点推断 */
  stepSeconds: number;
};

function parseMetaLine(line: string): [string, string] | null {
  const idx = line.indexOf("=");
  if (idx < 0) return null;
  const key = line.slice(0, idx).trim();
  const value = line.slice(idx + 1).trim();
  return [key, value];
}

function ensureZ(iso: string): string {
  if (iso.endsWith("Z") || /[+\-]\d{2}:\d{2}$/.test(iso)) return iso;
  return `${iso}Z`;
}

/** 将 OEM 文本解析为米制星历点列 */
export function parseOemText(text: string): ParsedOem {
  const lines = text.split(/\r?\n/);
  const meta: Partial<OemMeta> = {};
  const points: OemPoint[] = [];
  let inMeta = false;

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;

    if (line.startsWith("CCSDS_OEM_VERS")) {
      const kv = parseMetaLine(line);
      if (kv) meta.version = kv[1];
      continue;
    }
    if (line.startsWith("CREATION_DATE")) {
      const kv = parseMetaLine(line);
      if (kv) meta.creationDate = kv[1];
      continue;
    }
    if (line.startsWith("ORIGINATOR")) {
      const kv = parseMetaLine(line);
      if (kv) meta.originator = kv[1];
      continue;
    }
    if (line === "META_START") {
      inMeta = true;
      continue;
    }
    if (line === "META_STOP") {
      inMeta = false;
      continue;
    }
    if (inMeta) {
      const kv = parseMetaLine(line);
      if (!kv) continue;
      const [k, v] = kv;
      if (k === "OBJECT_NAME") meta.objectName = v;
      else if (k === "OBJECT_ID") meta.objectId = v;
      else if (k === "CENTER_NAME") meta.centerName = v;
      else if (k === "REF_FRAME") meta.refFrame = v;
      else if (k === "TIME_SYSTEM") meta.timeSystem = v;
      else if (k === "START_TIME") meta.startTime = ensureZ(v);
      else if (k === "STOP_TIME") meta.stopTime = ensureZ(v);
      continue;
    }
    if (line.startsWith("COMMENT")) continue;

    const parts = line.split(/\s+/);
    if (parts.length < 7) continue;
    if (!/^\d{4}-\d{2}-\d{2}T/.test(parts[0])) continue;

    const time = ensureZ(parts[0]);
    const nums = parts.slice(1, 7).map(Number);
    if (nums.some((n) => Number.isNaN(n))) continue;

    points.push({
      time,
      positionM: [nums[0]! * 1000, nums[1]! * 1000, nums[2]! * 1000],
      velocityMps: [nums[3]! * 1000, nums[4]! * 1000, nums[5]! * 1000],
    });
  }

  if (
    !meta.version ||
    !meta.startTime ||
    !meta.stopTime ||
    !meta.refFrame ||
    points.length < 2
  ) {
    throw new Error("OEM 解析失败：缺少必要元数据或星历点不足");
  }

  const t0 = Date.parse(points[0]!.time);
  const t1 = Date.parse(points[1]!.time);
  const stepSeconds = Math.max(1, Math.round((t1 - t0) / 1000));

  return {
    meta: meta as OemMeta,
    points,
    stepSeconds,
  };
}

export type OrbitDataFile = {
  sourcePage: string;
  sourceZipUrl: string;
  fileName: string;
  fetchedAt: string;
  publishDate: string | null;
  meta: OemMeta;
  stepSeconds: number;
  epoch: string;
  cartesianVelocity: number[];
  validityDays: number;
};

export function toOrbitDataFile(
  parsed: ParsedOem,
  opts: {
    sourcePage: string;
    sourceZipUrl: string;
    fileName: string;
    fetchedAt?: string;
    publishDate?: string | null;
    stride?: number;
  },
): OrbitDataFile {
  const stride = Math.max(1, opts.stride ?? 1);
  const epoch = parsed.meta.startTime;
  const epochMs = Date.parse(epoch);
  const cartesianVelocity: number[] = [];

  for (let i = 0; i < parsed.points.length; i += stride) {
    const p = parsed.points[i]!;
    const tSec = (Date.parse(p.time) - epochMs) / 1000;
    cartesianVelocity.push(
      tSec,
      p.positionM[0],
      p.positionM[1],
      p.positionM[2],
      p.velocityMps[0],
      p.velocityMps[1],
      p.velocityMps[2],
    );
  }

  const validityDays =
    (Date.parse(parsed.meta.stopTime) - Date.parse(parsed.meta.startTime)) /
    86400000;

  return {
    sourcePage: opts.sourcePage,
    sourceZipUrl: opts.sourceZipUrl,
    fileName: opts.fileName,
    fetchedAt: opts.fetchedAt ?? new Date().toISOString(),
    publishDate: opts.publishDate ?? null,
    meta: parsed.meta,
    stepSeconds: parsed.stepSeconds * stride,
    epoch,
    cartesianVelocity,
    validityDays,
  };
}
