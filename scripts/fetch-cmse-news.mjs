#!/usr/bin/env node
/**
 * 抓取 CMSE 综合新闻列表（标题+链接），不编造正文。
 * 来源: https://www.cmse.gov.cn/xwzx/zhxw/
 */
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const SOURCE = "https://www.cmse.gov.cn/xwzx/zhxw/";
const OUT = path.join(root, "public/data/cmse-news.json");

function parseNews(html) {
  const items = [];
  const re =
    /href="(\.\.\/\d{6}\/t\d+_\d+\.html)"[^>]*>([^<]+)</g;
  let m;
  while ((m = re.exec(html))) {
    const href = m[1];
    const title = m[2].trim();
    if (!title || title.length < 4) continue;
    const url = new URL(href, SOURCE).href;
    if (items.some((i) => i.url === url)) continue;
    items.push({ title, url });
  }
  return items;
}

async function main() {
  const useFixture = process.argv.includes("--fixture");
  let html;
  if (useFixture) {
    html = await fs.readFile(
      path.join(root, "fixtures/cmse/zhxw-list.sample.html"),
      "utf8",
    );
  } else {
    try {
      const res = await fetch(SOURCE, {
        headers: { "User-Agent": "wherethecss-news-bot/1.0" },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      html = await res.text();
    } catch (e) {
      console.error("新闻抓取失败，回退 fixture:", e.message);
      html = await fs.readFile(
        path.join(root, "fixtures/cmse/zhxw-list.sample.html"),
        "utf8",
      );
    }
  }
  const items = parseNews(html).slice(0, 30);
  const payload = {
    source: SOURCE,
    fetchedAt: new Date().toISOString(),
    items,
  };
  await fs.mkdir(path.dirname(OUT), { recursive: true });
  await fs.writeFile(OUT, JSON.stringify(payload, null, 2));
  console.log("Wrote", OUT, `items=${items.length}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
