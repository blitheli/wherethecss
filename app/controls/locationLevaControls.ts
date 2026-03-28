import { useControls } from "leva";

export interface LocationLevaArgs {
  longitude: number;
  latitude: number;
  height: number;
}

export function locationLevaSchema(defaults?: Partial<LocationLevaArgs>) {
  const longitude = defaults?.longitude ?? 0;
  const latitude = defaults?.latitude ?? 0;
  const height = defaults?.height ?? 10000;
  return {
    longitude: { value: longitude, min: -180, max: 180, step: 1 },
    latitude: { value: latitude, min: -90, max: 90, step: 1 },
    height: { value: height, min: 10000, max: 1e6, step: 1000 },
  };
}

export function useLocationLevaControls(defaults?: Partial<LocationLevaArgs>) {
  return useControls("Location", locationLevaSchema(defaults));
}
