import { SiteHeader } from "./site-header";
import { SiteNav } from "./site-nav";
import { Outlet } from "react-router";
import { useState, useEffect } from "react";

export default function MainLayout() {
  const [isCollapsed, setIsCollapsed] = useState(false);

  const toggleNav = () => setIsCollapsed((prev) => !prev);

  useEffect(() => {
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
    <div className="flex min-h-screen flex-col bg-slate-100 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <SiteHeader />
      <div className="flex min-h-0 flex-1">
        <SiteNav isCollapsed={isCollapsed} onToggle={toggleNav} />
        <main className="min-w-0 flex-1 overflow-y-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
