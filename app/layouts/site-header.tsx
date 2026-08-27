function CssMark({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 40 40"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <rect width="40" height="40" rx="8" className="fill-zinc-900" stroke="#334155" />
      <path
        d="M8 20h24M14 14v12M26 14v12M11 17h18M11 23h18"
        stroke="white"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <circle cx="20" cy="20" r="3" stroke="#38bdf8" strokeWidth="1.5" />
    </svg>
  );
}

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-50 flex h-14 shrink-0 items-center border-b border-zinc-800 bg-black px-4">
      <a
        href="/"
        className="flex min-w-0 items-center gap-3 rounded-md outline-offset-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-sky-400"
      >
        <CssMark className="h-9 w-9 shrink-0" />
        <div className="min-w-0 leading-tight">
          <span className="block truncate font-semibold text-white">
            中国空间站
          </span>
          <span className="block truncate text-xs text-zinc-500">
            任务控制 · OEM 实时追踪
          </span>
        </div>
      </a>

      <div className="ml-auto flex shrink-0 items-center gap-2 sm:gap-3">
        <a
          href="https://www.cmse.gov.cn/gfgg/zgkjzgdcs/"
          target="_blank"
          rel="noreferrer"
          className="rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm font-medium text-zinc-100 transition hover:border-sky-600 hover:bg-zinc-800 sm:px-4"
        >
          官方轨道参数
        </a>
      </div>
    </header>
  );
}
