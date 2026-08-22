import type { Route } from "./+types/home";
import { RealtimeTracker } from "../components/tracker/RealtimeTracker";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "中国空间站实时追踪 · WhereTheCSS" },
    {
      name: "description",
      content: "基于中国载人航天官网 OEM 的中国空间站实时位置、星下点与过境预报",
    },
  ];
}

export default function Home() {
  return <RealtimeTracker />;
}
