import { useEffect, useState } from "react";
import type { Route } from "./+types/news";
import { loadNews, type NewsFile } from "../lib/cmse/loadOrbit";

export function meta({}: Route.MetaArgs) {
  return [{ title: "综合新闻 · 中国载人航天" }];
}

export default function NewsPage() {
  const [data, setData] = useState<NewsFile | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    loadNews()
      .then(setData)
      .catch((e) => setErr(e instanceof Error ? e.message : String(e)));
  }, []);

  return (
    <div className="mx-auto max-w-3xl p-4 pb-12">
      <h1 className="text-2xl font-semibold text-zinc-100">综合新闻</h1>
      <p className="mt-2 text-sm text-zinc-400">
        标题与链接抓取自{" "}
        <a
          className="text-sky-400 hover:underline"
          href="https://www.cmse.gov.cn/xwzx/zhxw/"
          target="_blank"
          rel="noreferrer"
        >
          中国载人航天官方网站 · 综合新闻
        </a>
        ，正文请点击原文阅读。本站不转载全文。
      </p>
      {err && <p className="mt-3 text-amber-200">{err}</p>}
      <ul className="mt-4 space-y-3">
        {(data?.items ?? []).map((item) => (
          <li key={item.url} className="border-b border-zinc-800 pb-3">
            <a
              href={item.url}
              target="_blank"
              rel="noreferrer"
              className="text-base text-sky-300 hover:underline"
            >
              {item.title}
            </a>
          </li>
        ))}
      </ul>
      {data && (
        <p className="mt-4 text-xs text-zinc-500">
          本地缓存更新于 {new Date(data.fetchedAt).toLocaleString("zh-CN")}
        </p>
      )}
    </div>
  );
}
