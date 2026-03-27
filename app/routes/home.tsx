import type { Route } from "./+types/home";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "首页" },
    { name: "robots", content: "noindex" },
  ];
}

export default function content() {


  return (
    <div className="mx-auto max-w-lg">
      <h1 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">
        首页内容,待实现
      </h1>
    </div>
  );
}
