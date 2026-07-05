export const APPEARANCE_STORAGE_KEY = "auto-svga-short-term-appearance";
export const APPEARANCE_VALUES = Object.freeze(["system", "light", "dark"]);

export function normalizeAppearance(value) {
  return APPEARANCE_VALUES.includes(value) ? value : "system";
}

export function loadStoredAppearance(storage = globalThis.localStorage) {
  try {
    return normalizeAppearance(storage?.getItem?.(APPEARANCE_STORAGE_KEY));
  } catch {
    return "system";
  }
}

export function persistAppearance(value, storage = globalThis.localStorage) {
  try {
    storage?.setItem?.(APPEARANCE_STORAGE_KEY, normalizeAppearance(value));
  } catch {
    // Appearance remains session-local when storage is unavailable.
  }
}

export function appearanceColorScheme(appearance) {
  if (appearance === "dark") return "dark";
  if (appearance === "light") return "light";
  return "light dark";
}
