import type { ReactNode } from "react";
import { Link, useLocation } from "react-router";

type NavItem = {
  id: string;
  label: string;
  icon: ReactNode;
  to?: string;
};

const trackerItems: NavItem[] = [
  {
    id: "",
    label: "实时追踪",
    to: "/",
    icon: (
      <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
        <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5a2.5 2.5 0 0 1 0-5 2.5 2.5 0 0 1 0 5z" />
      </svg>
    ),
  },
  {
    id: "access",
    label: "可见性分析",
    icon: (
      <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
        <path d="M3 13h2v-2H3v2zm0 4h2v-2H3v2zm0-8h2V7H3v2zm4 4h14v-2H7v2zm0 4h14v-2H7v2zM7 7v2h14V7H7z" />
      </svg>
    ),
  },
  {
    id: "orbit",
    label: "轨道参数",
    icon: (
      <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
        <path d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2zm1 15h-2v-2h2zm0-4h-2V7h2z" />
      </svg>
    ),
  },
  {
    id: "news",
    label: "综合新闻",
    icon: (
      <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
        <path d="M4 6h16v2H4V6zm0 5h16v2H4v-2zm0 5h10v2H4v-2z" />
      </svg>
    ),
  },
];

const sceneItems: NavItem[] = [
  {
    id: "tiangong",
    label: "天宫 3D",
    icon: (
      <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
        <path d="M12 7V3H2v18h20V7H12zM6 19H4v-2h2v2zm0-4H4v-2h2v2zm0-4H4V9h2v2zm0-4H4V5h2v2zm4 12H8v-2h2v2zm0-4H8v-2h2v2zm0-4H8V9h2v2zm0-4H8V5h2v2zm10 12h-8v-2h2v-2h-2v-2h2v-2h-2V9h8v10z" />
      </svg>
    ),
  },
  {
    id: "leo",
    label: "低地球轨道演示",
    icon: (
      <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
        <path d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2zm0 18a8 8 0 1 1 8-8 8 8 0 0 1-8 8z" />
      </svg>
    ),
  },
  {
    id: "box",
    label: "渲染测试",
    icon: (
      <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
        <path d="M3 3h8v8H3V3zm10 0h8v8h-8V3zM3 13h8v8H3v-8zm10 0h8v8h-8v-8z" />
      </svg>
    ),
  },
];

function NavSection({
  title,
  items,
  activePath,
}: {
  title: string;
  items: NavItem[];
  activePath: string;
}) {
  return (
    <div className="mb-6">
      <p className="mb-2 px-3 text-[11px] font-semibold tracking-wider text-slate-500">
        {title}
      </p>
      <ul className="space-y-0.5">
        {items.map((item) => {
          const to = item.to ?? `/${item.id}`;
          const active =
            to === "/"
              ? activePath === "/"
              : activePath === to || activePath.startsWith(`${to}/`);
          return (
            <li key={item.id || "home"}>
              <Link
                to={to}
                className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition ${
                  active
                    ? "bg-slate-200/90 font-medium text-slate-800 dark:bg-slate-700/80 dark:text-slate-100"
                    : "text-slate-600 hover:bg-slate-200/60 dark:text-slate-300 dark:hover:bg-slate-700/50"
                }`}
              >
                <span
                  className={
                    active
                      ? "text-slate-700 dark:text-slate-200"
                      : "text-slate-400 dark:text-slate-500"
                  }
                >
                  {item.icon}
                </span>
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export function SiteNav({
  isCollapsed,
  onToggle,
}: {
  isCollapsed: boolean;
  onToggle: () => void;
}) {
  const location = useLocation();
  const activePath = location.pathname;

  return (
    <>
      {isCollapsed && (
        <button
          onClick={onToggle}
          className="fixed left-4 top-[56px] z-50 flex h-10 w-10 items-center justify-center rounded-lg bg-slate-200 text-slate-600 hover:bg-slate-300 dark:bg-slate-700 dark:text-slate-300 dark:hover:bg-slate-600"
          title="展开导航"
        >
          <svg className="h-6 w-6" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
            <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z" />
          </svg>
        </button>
      )}
      {isCollapsed ? null : (
        <aside className="w-56 overflow-y-auto border-r border-slate-200 bg-gray-50 sm:w-64 dark:border-slate-700 dark:bg-slate-900/50">
          <nav className="p-4 pt-5" aria-label="站内导航">
            <button
              onClick={onToggle}
              className="mb-4 flex w-full items-center justify-center rounded-lg p-2 text-slate-600 hover:bg-slate-200/60 dark:text-slate-300 dark:hover:bg-slate-700/50"
              title="收起导航"
            >
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                <path d="M10 17l5-5-5-5v10z" />
              </svg>
            </button>
            <NavSection title="追踪" items={trackerItems} activePath={activePath} />
            <NavSection title="三维场景" items={sceneItems} activePath={activePath} />
          </nav>
        </aside>
      )}
    </>
  );
}
