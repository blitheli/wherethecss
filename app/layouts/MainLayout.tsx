import { SiteHeader } from "./site-header";
import { SiteNav } from "./site-nav";
import { Outlet } from "react-router";
import { useState, useEffect } from "react";
import { Provider as JotaiProvider } from "jotai";
import { SimClockProvider } from "../components/clock/SimClockProvider";
import { OemTimeline } from "../components/clock/OemTimeline";

export default function MainLayout() {
  const [isCollapsed, setIsCollapsed] = useState(false);

  const toggleNav = () => setIsCollapsed((prev) => !prev);

  useEffect(() => {
    document.documentElement.classList.add("dark");
    document.documentElement.style.colorScheme = "dark";
    const handleResize = () => {
      if (window.innerWidth < 768) {
        setIsCollapsed(true);
      }
    };
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  return (
    <JotaiProvider>
      <SimClockProvider>
        <div className="flex h-dvh max-h-dvh flex-col overflow-hidden bg-black text-zinc-100">
          <SiteHeader />
          <div className="flex min-h-0 flex-1">
            <SiteNav isCollapsed={isCollapsed} onToggle={toggleNav} />
            <main className="min-w-0 flex-1 overflow-y-auto bg-zinc-950">
              <Outlet />
            </main>
          </div>
          <OemTimeline />
        </div>
      </SimClockProvider>
    </JotaiProvider>
  );
}
