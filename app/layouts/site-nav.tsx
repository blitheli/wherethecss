import type { ReactNode } from "react";
import { Link } from "react-router";

type NavItem = {
  id: string;
  label: string;
  icon: ReactNode;
};

const liveStreams: NavItem[] = [
  {
    id: "box",
    label: "测试Box",
    icon: (
      <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
        <path d="M17 10.5V7a1 1 0 0 0-1-1H4a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-3.5l4 4v-11l-4 4z" />
      </svg>
    ),
  },
  {
    id: "sd",
    label: "SD Camera",
    icon: (
      <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
        <path d="M17 10.5V7a1 1 0 0 0-1-1H4a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-3.5l4 4v-11l-4 4z" />
      </svg>
    ),
  },
  {
    id: "4k",
    label: "4K Camera - Sen.com",
    icon: (
      <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
        <path d="M17 10.5V7a1 1 0 0 0-1-1H4a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-3.5l4 4v-11l-4 4z" />
      </svg>
    ),
  },
];

const learnItems: NavItem[] = [
  {
    id: "location",
    label: "ISS Location Fact",
    icon: (
      <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
        <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5a2.5 2.5 0 0 1 0-5 2.5 2.5 0 0 1 0 5z" />
      </svg>
    ),
  },
  {
    id: "telescopes",
    label: "Telescopes",
    icon: (
      <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
        <path d="M12 2l2.4 7.4H22l-6 4.6 2.3 7L12 17.8 5.7 21l2.3-7-6-4.6h7.6L12 2z" />
      </svg>
    ),
  },
  {
    id: "crew",
    label: "Who is on the ISS",
    icon: (
      <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
        <path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z" />
      </svg>
    ),
  },
  {
    id: "launches",
    label: "Upcoming Launches",
    icon: (
      <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
        <path d="M12 2.5s4 8 4 12a4 4 0 1 1-8 0c0-4 4-12 4-12zm0 15.5a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3zM7 20h10v1H7v-1z" />
      </svg>
    ),
  },
  {
    id: "about",
    label: "About the ISS",
    icon: (
      <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z" />
      </svg>
    ),
  },
  {
    id: "leo",
    label: "Low Earth Orbit",
    icon: (
      <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
        <path d="M12 7V3H2v18h20V7H12zM6 19H4v-2h2v2zm0-4H4v-2h2v2zm0-4H4V9h2v2zm0-4H4V5h2v2zm4 12H8v-2h2v2zm0-4H8v-2h2v2zm0-4H8V9h2v2zm0-4H8V5h2v2zm10 12h-8v-2h2v-2h-2v-2h2v-2h-2V9h8v10zm-2-8h-2v2h2v-2zm0 4h-2v2h2v-2z" />
      </svg>
    ),
  },
  {
    id: "sites",
    label: "Launch Sites",
    icon: (
      <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
        <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5a2.5 2.5 0 0 1 0-5 2.5 2.5 0 0 1 0 5z" />
      </svg>
    ),
  },
  {
    id: "cameras",
    label: "ISS Cameras",
    icon: (
      <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
        <path d="M17 10.5V7a1 1 0 0 0-1-1H4a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-3.5l4 4v-11l-4 4z" />
      </svg>
    ),
  },
  {
    id: "explore",
    label: "Space Exploration",
    icon: (
      <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z" />
      </svg>
    ),
  },
  {
    id: "faq",
    label: "FAQ",
    icon: (
      <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 17h-2v-2h2v2zm2.07-7.75l-.9.92C13.45 12.9 13 13.5 13 15h-2v-.5c0-1.1.45-2.1 1.17-2.83l1.24-1.26c.37-.36.59-.86.59-1.41 0-1.1-.9-2-2-2s-2 .9-2 2H8c0-2.21 1.79-4 4-4s4 1.79 4 4c0 .88-.36 1.68-.93 2.25z" />
      </svg>
    ),
  },
];

function NavSection({
  title,
  items,
  activeId,
}: {
  title: string;
  items: NavItem[];
  activeId: string;
}) {
  return (
    <div className="mb-6">
      <p className="mb-2 px-3 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
        {title}
      </p>
      <ul className="space-y-0.5">
        {items.map((item) => {
          const active = item.id === activeId;
          return (
            <li key={item.id}>
              <Link
                to={`/${item.id}`}
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

export function SiteNav() {
  return (
    <aside className="w-56 shrink-0 overflow-y-auto border-r border-slate-200 bg-gray-50 sm:w-64 dark:border-slate-700 dark:bg-slate-900/50">
      <nav className="p-4 pt-5" aria-label="站内导航">
        <NavSection title="Live streams" items={liveStreams} activeId="hd" />
        <NavSection title="Learn" items={learnItems} activeId="location" />
      </nav>
    </aside>
  );
}
