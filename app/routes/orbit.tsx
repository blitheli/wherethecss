import { useEffect, useState } from "react";
import type { Route } from "./+types/orbit";
import type { OrbitDataFile } from "../lib/oem/parseOem";
import { loadOrbitData } from "../lib/cmse/loadOrbit";

export function meta({}: Route.MetaArgs) {
  return [{ title: "轨道参数 · OEM" }];
}

export default function OrbitPage() {
  const [orbit, setOrbit] = useState<OrbitDataFile | null>(null);

  useEffect(() => {
    loadOrbitData().then(setOrbit).catch(console.error);
  }, []);

  return (
    <div className="mx-auto max-w-3xl p-4 pb-12">
      <h1 className="text-2xl font-semibold text-slate-100">中国空间站轨道参数</h1>
      <p className="mt-2 text-sm leading-relaxed text-slate-400">
        自 2023-09-01 起，中国载人航天工程办公室在官网发布中国空间站{" "}
        <strong className="font-medium text-slate-200">OEM</strong>（Orbital
        Ephemeris Message）轨道星历，取代此前的每日 TLE。OEM 描述未来约{" "}
        <strong className="font-medium text-slate-200">7 天</strong>
        的位置速度（EME2000，km/km/s），通常每周一、三、五更新。
      </p>
      <ul className="mt-4 list-disc space-y-2 pl-5 text-sm text-slate-300">
        <li>
          列表页：{" "}
          <a
            className="text-sky-400 hover:underline"
            href="https://www.cmse.gov.cn/gfgg/zgkjzgdcs/"
            target="_blank"
            rel="noreferrer"
          >
            https://www.cmse.gov.cn/gfgg/zgkjzgdcs/
          </a>
        </li>
        <li>
          按日查询：{" "}
          <code className="text-xs text-slate-400">
            /was5/web/search?token=…&amp;channelid=228160&amp;docreltime=YYYY.M.D
          </code>
        </li>
        <li>
          说明文章：{" "}
          <a
            className="text-sky-400 hover:underline"
            href="https://www.cmse.gov.cn/xwzx/202309/t20230913_54312.html"
            target="_blank"
            rel="noreferrer"
          >
            中国空间站OEM来啦
          </a>
        </li>
      </ul>
      {orbit && (
        <pre className="mt-6 overflow-x-auto rounded-lg border border-slate-700 bg-slate-950 p-4 text-xs text-slate-300">
{JSON.stringify(
  {
    fileName: orbit.fileName,
    sourceZipUrl: orbit.sourceZipUrl,
    publishDate: orbit.publishDate,
    meta: orbit.meta,
    validityDays: orbit.validityDays,
    stepSeconds: orbit.stepSeconds,
    pointCount: orbit.cartesianVelocity.length / 7,
    fetchedAt: orbit.fetchedAt,
  },
  null,
  2,
)}
        </pre>
      )}
    </div>
  );
}
