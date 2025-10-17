export type EyeConfig = {
  centerLeft: { x: number; y: number };
  centerRight: { x: number; y: number };
  radiusMax: number;
};

const STORAGE_KEY = "alfan-eye-config";

export const defaultEyeConfig: EyeConfig = {
  centerLeft: { x: 125, y: 150 },
  centerRight: { x: 195, y: 150 },
  radiusMax: 6,
};

export const loadEyeConfig = (): EyeConfig => {
  if (typeof window === "undefined") {
    return defaultEyeConfig;
  }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return defaultEyeConfig;
    }
    const parsed = JSON.parse(raw) as EyeConfig;
    if (!parsed.centerLeft || !parsed.centerRight) {
      return defaultEyeConfig;
    }
    return {
      centerLeft: {
        x: parsed.centerLeft.x ?? defaultEyeConfig.centerLeft.x,
        y: parsed.centerLeft.y ?? defaultEyeConfig.centerLeft.y,
      },
      centerRight: {
        x: parsed.centerRight.x ?? defaultEyeConfig.centerRight.x,
        y: parsed.centerRight.y ?? defaultEyeConfig.centerRight.y,
      },
      radiusMax: parsed.radiusMax ?? defaultEyeConfig.radiusMax,
    };
  } catch {
    return defaultEyeConfig;
  }
};

export const saveEyeConfig = (config: EyeConfig) => {
  if (typeof window === "undefined") {
    return;
  }
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
};
