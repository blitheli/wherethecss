import type { Route } from "./+types/error";
import { Link, useLocation, useParams } from "react-router";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "页面未找到" },
    { name: "robots", content: "noindex" },
  ];
}

export default function ErrorRoute() {
  const location = useLocation();
  const params = useParams();
  const splat = params["*"];

  return (
    <div className="mx-auto max-w-lg">
      <p className="text-sm font-medium text-amber-700 dark:text-amber-400">404</p>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">
        未找到页面
      </h1>
      <p className="mt-3 text-slate-600 dark:text-slate-400">
        该地址尚未实现或不存在。你可以返回首页继续浏览。
      </p>
      <p className="mt-4 rounded-lg border border-slate-200 bg-white/80 px-3 py-2 font-mono text-sm text-slate-700 dark:border-slate-700 dark:bg-slate-900/50 dark:text-slate-300">
        {location.pathname}
        {splat ? ` (${splat})` : null}
      </p>
      <p className="mt-6">
        <Link
          to="/"
          className="inline-flex rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white"
        >
          返回首页
        </Link>
      </p>
    </div>
  );
}
