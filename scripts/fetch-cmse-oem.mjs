#!/usr/bin/env node
/**
 * 从中国载人航天官网抓取最新中国空间站 OEM 并写出 public/data/css-oem-latest.json
 *
 * 官方页面: https://www.cmse.gov.cn/gfgg/zgkjzgdcs/
 * 按日查询 API: /was5/web/search?token=...&channelid=228160&docreltime=YYYY.M.D
 * 发布节奏: 通常周一/三/五；页面默认展示最新一条 ZIP。
 *
 * 用法:
 *   node scripts/fetch-cmse-oem.mjs
 *   node scripts/fetch-cmse-oem.mjs --fixture   # 仅用 fixtures/ 离线解析
 */
import { createWriteStream, promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { pipeline } from "node:stream/promises";
import { createUnzip } from "node:zlib";
import { Readable } from "node:stream";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const SOURCE_PAGE = "https://www.cmse.gov.cn/gfgg/zgkjzgdcs/";
const OUT_JSON = path.join(root, "public/data/css-oem-latest.json");
const OUT_META = path.join(root, "public/data/css-oem-meta.json");

function ensureZ(iso) {
  if (iso.endsWith("Z") || /[+-]\d{2}:\d{2}$/.test(iso)) return iso;
  return `${iso}Z`;
}

function parseOemText(text) {
  const lines = text.split(/\r?\n/);
  const meta = {};
  const points = [];
  let inMeta = false;
  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;
    if (line.startsWith("CCSDS_OEM_VERS")) {
      meta.version = line.split("=")[1]?.trim();
      continue;
    }
    if (line.startsWith("CREATION_DATE")) {
      meta.creationDate = line.split("=")[1]?.trim();
      continue;
    }
    if (line.startsWith("ORIGINATOR")) {
      meta.originator = line.split("=")[1]?.trim();
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
      const [k, ...rest] = line.split("=");
      const v = rest.join("=").trim();
      const key = k.trim();
      if (key === "OBJECT_NAME") meta.objectName = v;
      else if (key === "OBJECT_ID") meta.objectId = v;
      else if (key === "CENTER_NAME") meta.centerName = v;
      else if (key === "REF_FRAME") meta.refFrame = v;
      else if (key === "TIME_SYSTEM") meta.timeSystem = v;
      else if (key === "START_TIME") meta.startTime = ensureZ(v);
      else if (key === "STOP_TIME") meta.stopTime = ensureZ(v);
      continue;
    }
    if (line.startsWith("COMMENT")) continue;
    const parts = line.split(/\s+/);
    if (parts.length < 7 || !/^\d{4}-\d{2}-\d{2}T/.test(parts[0])) continue;
    const nums = parts.slice(1, 7).map(Number);
    if (nums.some(Number.isNaN)) continue;
    points.push({
      time: ensureZ(parts[0]),
      positionM: [nums[0] * 1000, nums[1] * 1000, nums[2] * 1000],
      velocityMps: [nums[3] * 1000, nums[4] * 1000, nums[5] * 1000],
    });
  }
  if (!meta.startTime || !meta.stopTime || points.length < 2) {
    throw new Error("OEM 解析失败");
  }
  const stepSeconds = Math.max(
    1,
    Math.round((Date.parse(points[1].time) - Date.parse(points[0].time)) / 1000),
  );
  return { meta, points, stepSeconds };
}

function toOrbitDataFile(parsed, opts) {
  const epoch = parsed.meta.startTime;
  const epochMs = Date.parse(epoch);
  const cartesianVelocity = [];
  for (const p of parsed.points) {
    const tSec = (Date.parse(p.time) - epochMs) / 1000;
    cartesianVelocity.push(
      tSec,
      ...p.positionM,
      ...p.velocityMps,
    );
  }
  const validityDays =
    (Date.parse(parsed.meta.stopTime) - Date.parse(parsed.meta.startTime)) /
    86400000;
  return {
    sourcePage: opts.sourcePage,
    sourceZipUrl: opts.sourceZipUrl,
    fileName: opts.fileName,
    fetchedAt: new Date().toISOString(),
    publishDate: opts.publishDate ?? null,
    meta: parsed.meta,
    stepSeconds: parsed.stepSeconds,
    epoch,
    cartesianVelocity,
    validityDays,
  };
}

function extractZipLink(html, baseUrl) {
  const publishMatch = html.match(/发布日期[：:]\s*<span class="dayTime">([^<]+)</);
  const publishDate = publishMatch?.[1]?.trim() ?? null;
  const zipMatch =
    html.match(/href="([^"]+\.zip)"[^>]*>\s*(CSS_OEM_[^<]+\.zip)/i) ||
    html.match(/href="([^"]+W0\d+\.zip)"[^>]*>\s*([^<]*\.zip)/i);
  if (!zipMatch) return null;
  const href = zipMatch[1];
  const fileName = (zipMatch[2] || path.basename(href)).trim();
  const sourceZipUrl = new URL(href, baseUrl).href;
  return { sourceZipUrl, fileName, publishDate };
}

async function unzipDat(zipPath, outDir) {
  // Prefer system unzip for simplicity
  await fs.mkdir(outDir, { recursive: true });
  try {
    await execFileAsync("unzip", ["-o", zipPath, "-d", outDir]);
  } catch {
    // fallback: try Python zipfile
    await execFileAsync("python3", [
      "-c",
      "import zipfile,sys; zipfile.ZipFile(sys.argv[1]).extractall(sys.argv[2])",
      zipPath,
      outDir,
    ]);
  }
  const entries = await fs.readdir(outDir);
  const dat = entries.find((e) => e.toLowerCase().endsWith(".dat"));
  if (!dat) throw new Error("ZIP 内未找到 .dat");
  return path.join(outDir, dat);
}

async function fetchLive() {
  console.log("GET", SOURCE_PAGE);
  const res = await fetch(SOURCE_PAGE, {
    headers: { "User-Agent": "wherethecss-orbit-bot/1.0" },
  });
  if (!res.ok) throw new Error(`列表页 HTTP ${res.status}`);
  const html = await res.text();
  const link = extractZipLink(html, SOURCE_PAGE);
  if (!link) {
    throw new Error(
      "未能从 CMSE 页面解析 ZIP 链接；HTML 结构可能已变更。请检查 fixtures 与解析逻辑。",
    );
  }
  console.log("ZIP", link.sourceZipUrl, link.fileName, link.publishDate);

  const tmpDir = path.join(root, ".tmp-oem");
  await fs.mkdir(tmpDir, { recursive: true });
  const zipPath = path.join(tmpDir, link.fileName);
  const zipRes = await fetch(link.sourceZipUrl, {
    headers: { "User-Agent": "wherethecss-orbit-bot/1.0" },
  });
  if (!zipRes.ok) throw new Error(`ZIP HTTP ${zipRes.status}`);
  const buf = Buffer.from(await zipRes.arrayBuffer());
  await fs.writeFile(zipPath, buf);
  const datPath = await unzipDat(zipPath, path.join(tmpDir, "extract"));
  const text = await fs.readFile(datPath, "utf8");
  return { text, ...link };
}

async function fetchFixture() {
  const dat = path.join(
    root,
    "fixtures/cmse/CSS_OEM_20260821004850_0001.dat",
  );
  const text = await fs.readFile(dat, "utf8");
  return {
    text,
    sourceZipUrl:
      "https://www.cmse.gov.cn/gfgg/zgkjzgdcs/202608/W020260821367431140778.zip",
    fileName: "CSS_OEM_20260821004850_0001.zip",
    publishDate: "2026-08-21",
  };
}

async function main() {
  const useFixture = process.argv.includes("--fixture");
  let payload;
  try {
    payload = useFixture ? await fetchFixture() : await fetchLive();
  } catch (err) {
    console.error("在线抓取失败，回退 fixture:", err.message);
    payload = await fetchFixture();
    payload.fallback = true;
  }

  const parsed = parseOemText(payload.text);
  const data = toOrbitDataFile(parsed, {
    sourcePage: SOURCE_PAGE,
    sourceZipUrl: payload.sourceZipUrl,
    fileName: payload.fileName,
    publishDate: payload.publishDate,
  });

  await fs.mkdir(path.dirname(OUT_JSON), { recursive: true });
  await fs.writeFile(OUT_JSON, JSON.stringify(data));
  await fs.writeFile(
    OUT_META,
    JSON.stringify(
      {
        sourcePage: data.sourcePage,
        sourceZipUrl: data.sourceZipUrl,
        fileName: data.fileName,
        fetchedAt: data.fetchedAt,
        publishDate: data.publishDate,
        startTime: data.meta.startTime,
        stopTime: data.meta.stopTime,
        validityDays: data.validityDays,
        stepSeconds: data.stepSeconds,
        pointCount: data.cartesianVelocity.length / 7,
        refFrame: data.meta.refFrame,
        originator: data.meta.originator,
        usedFixtureFallback: Boolean(payload.fallback) || useFixture,
      },
      null,
      2,
    ),
  );
  console.log(
    "Wrote",
    OUT_JSON,
    `points=${data.cartesianVelocity.length / 7}`,
    `validityDays=${data.validityDays}`,
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
