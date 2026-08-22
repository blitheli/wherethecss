/**
 * ASTROX Web API 客户端。
 * 默认 BASE: http://astrox.cn:8765 （见 astrox-skills/claude.json）
 * Access 技能文档: https://github.com/blitheli/astrox-skills/tree/main/skills/access
 */

export const ASTROX_DEFAULT_BASE =
  import.meta.env.VITE_ASTROX_BASE_URL || "http://astrox.cn:8765";

export type AccessAER = {
  Time: string;
  Azimuth: number;
  Elevation: number;
  Range: number;
  RangeDot: number;
};

export type AccessPass = {
  AccessStart: string;
  AccessStop: string;
  Duration: number;
  MinElevationData?: AccessAER | null;
  MaxElevationData?: AccessAER | null;
  MinRangeData?: AccessAER | null;
  MaxRangeData?: AccessAER | null;
  AccessBeginData?: AccessAER | null;
  AccessEndData?: AccessAER | null;
  AllDatas?: AccessAER[] | null;
};

export type AccessResponse = {
  IsSuccess: boolean;
  Message: string;
  Passes: AccessPass[];
};

export type AccessComputeError = {
  ok: false;
  reason: "network" | "http" | "api";
  message: string;
  status?: number;
};

export type AccessComputeOk = {
  ok: true;
  data: AccessResponse;
};

export async function postAccessComputeV2(
  body: unknown,
  opts?: { baseUrl?: string; signal?: AbortSignal; timeoutMs?: number },
): Promise<AccessComputeOk | AccessComputeError> {
  const base = (opts?.baseUrl ?? ASTROX_DEFAULT_BASE).replace(/\/$/, "");
  const url = `${base}/access/AccessComputeV2`;
  const timeoutMs = opts?.timeoutMs ?? 60000;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const onAbort = () => controller.abort();
  opts?.signal?.addEventListener("abort", onAbort);

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    if (!res.ok) {
      return {
        ok: false,
        reason: "http",
        message: `ASTROX HTTP ${res.status}`,
        status: res.status,
      };
    }
    const data = (await res.json()) as AccessResponse;
    if (!data.IsSuccess) {
      return {
        ok: false,
        reason: "api",
        message: data.Message || "IsSuccess=false",
      };
    }
    return { ok: true, data };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return {
      ok: false,
      reason: "network",
      message:
        msg.includes("abort") || msg.includes("Abort")
          ? "ASTROX 请求超时或已取消；服务可能未启动"
          : `无法连接 ASTROX（${msg}）。默认地址 ${base}，请确认服务可用。`,
    };
  } finally {
    clearTimeout(timer);
    opts?.signal?.removeEventListener("abort", onAbort);
  }
}
