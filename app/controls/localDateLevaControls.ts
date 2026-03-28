import { useControls } from "leva";

/** 与 `localDateControls.ts` 中同名结构一致（本文件自包含，不向该模块 import）。 */
export interface LocalDateArgs {
  dayOfYear: number;
  timeOfDay: number;
  year: number;
}

function localDateArgs(defaults?: Partial<LocalDateArgs>): LocalDateArgs {
  return {
    dayOfYear: 0,
    timeOfDay: 0,
    year: new Date().getFullYear(),
    ...defaults,
  };
}

/** 与 `useLocalDateControls` / Story 中使用的公式一致。 */
export function getLocalDate(
  longitude: number,
  dayOfYear: number,
  timeOfDay: number,
  year: number,
): number {
  const epoch = Date.UTC(year, 0, 1, 0, 0, 0, 0);
  const offset = longitude / 15;
  return epoch + ((dayOfYear - 1) * 24 + timeOfDay - offset) * 3600000;
}

/** 与 `localDateArgTypes` 相同的范围，供 Leva 使用（不依赖 Storybook）。 */
export function localDateLevaSchema(defaults?: Partial<LocalDateArgs>) {
  const d = localDateArgs(defaults);
  const dayOfYear =
    d.dayOfYear >= 1 && d.dayOfYear <= 365 ? d.dayOfYear : 1;
  return {
    year: { value: d.year, min: 2000, max: 2050, step: 1 },
    dayOfYear: { value: dayOfYear, min: 1, max: 365, step: 1 },
    timeOfDay: { value: d.timeOfDay, min: 0, max: 24, step: 0.1 },
  };
}

/** 面板标题与 Storybook `local date` 分类一致。 */
export function useLocalDateLevaControls(defaults?: Partial<LocalDateArgs>) {
  return useControls("Local date", localDateLevaSchema(defaults));
}
