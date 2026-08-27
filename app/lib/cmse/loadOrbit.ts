import type { OrbitDataFile } from "../oem/parseOem";

export async function loadOrbitData(
  signal?: AbortSignal,
): Promise<OrbitDataFile> {
  const res = await fetch("/data/css-oem-latest.json", { signal });
  if (!res.ok) throw new Error(`无法加载轨道数据 HTTP ${res.status}`);
  return (await res.json()) as OrbitDataFile;
}

export type NewsItem = { title: string; url: string };
export type NewsFile = {
  source: string;
  fetchedAt: string;
  items: NewsItem[];
};

export async function loadNews(signal?: AbortSignal): Promise<NewsFile> {
  const res = await fetch("/data/cmse-news.json", { signal });
  if (!res.ok) throw new Error(`无法加载新闻 HTTP ${res.status}`);
  return (await res.json()) as NewsFile;
}
