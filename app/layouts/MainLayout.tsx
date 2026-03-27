import { SiteHeader } from "./site-header";
import { SiteNav } from "./site-nav";
import { Outlet } from "react-router";

export default function MainLayout() {
  return (
    <div className="flex min-h-screen flex-col bg-slate-100 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <SiteHeader />
      <div className="flex min-h-0 flex-1">
        <SiteNav />
        <main className="min-w-0 flex-1 overflow-y-auto p-6 md:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
