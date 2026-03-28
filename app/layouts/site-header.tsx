import { useEffect, useState } from "react";

function MoonIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden
    >
      <path d="M12 3a9 9 0 1 0 9 9c0-.46-.04-.92-.1-1.36a5.389 5.389 0 0 1-4.4 2.26 5.403 5.403 0 0 1-3.14-9.8c-.44-.06-.9-.1-1.36-.1z" />
    </svg>
  );
}

function SunIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden
    >
      <path d="M12 7a5 5 0 1 0 0 10 5 5 0 0 0 0-10zM2 13h2v-2H2v2zm18 0h2v-2h-2v2zM11 2v2h2V2h-2zm0 18v2h2v-2h-2zM6.31 5.75L4.9 7.16l1.42 1.42 1.41-1.41L6.31 5.75zm12.02 12.02l1.41 1.41 1.42-1.41-1.41-1.41-1.42 1.41zM4.9 16.84l1.41 1.41 1.42-1.41-1.42-1.41-1.41 1.41zM19.07 4.93l-1.41 1.41 1.42 1.42 1.41-1.41-1.42-1.42z" />
    </svg>
  );
}

function IssMark({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 40 40"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <rect width="40" height="40" rx="8" className="fill-slate-800" />
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
  const [dark, setDark] = useState(true);

  useEffect(() => {
    const root = document.documentElement;
    const prefersDark = window.matchMedia(
      "(prefers-color-scheme: dark)",
    ).matches;
    const stored = localStorage.getItem("theme");
    const initial =
      stored === "dark" || (!stored && prefersDark);
    setDark(initial);
    root.classList.toggle("dark", initial);
  }, []);

  function toggleTheme() {
    setDark((d) => {
      const next = !d;
      document.documentElement.classList.toggle("dark", next);
      localStorage.setItem("theme", next ? "dark" : "light");
      return next;
    });
  }

  return (
    <header className="sticky top-0 z-50 flex h-14 shrink-0 items-center border-b border-slate-700/50 bg-slate-600 px-4 shadow-sm">
      <div className="mx-auto flex w-full max-w-[1600px] items-center justify-between gap-4">
        <a
          href="/"
          className="flex min-w-0 items-center gap-3 rounded-md outline-offset-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-sky-400"
        >
          <IssMark className="h-9 w-9 shrink-0" />
          <div className="min-w-0 leading-tight">
            <span className="block truncate font-semibold text-white">
              中国空间站
            </span>
            <span className="block truncate text-xs text-slate-300">
              3D 可视化展示
            </span>
          </div>
        </a>

        <div className="flex shrink-0 items-center gap-2 sm:gap-3">
          <button
            type="button"
            onClick={toggleTheme}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-700/80 text-white transition hover:bg-slate-700"
            aria-label={dark ? "切换浅色模式" : "切换深色模式"}
          >
            {dark ? (
              <SunIcon className="h-5 w-5" />
            ) : (
              <MoonIcon className="h-5 w-5" />
            )}
          </button>

          <button
            type="button"
            className="relative rounded-lg border border-white/35 bg-slate-700/40 px-3 py-2 text-sm font-medium text-white transition hover:bg-slate-700/60 sm:px-4"
          >           
            Unlock All Features
          </button>
        </div>
      </div>
    </header>
  );
}
