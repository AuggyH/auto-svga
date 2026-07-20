export function shortTermDisplayNameFromPathLike(value: unknown): string {
  const raw = typeof value === "string" ? value.trim() : "";
  if (!raw) return "";
  const parts = raw.split(/[\\/]+/).filter(Boolean);
  return sanitizeShortTermDisplayPart(parts.at(-1) ?? raw);
}

export function shortTermParentDisplayNameFromPathLike(value: unknown): string {
  const raw = typeof value === "string" ? value.trim() : "";
  if (!raw) return "";
  const parts = raw.split(/[\\/]+/).filter(Boolean);
  if (parts.length < 2) return "";
  return sanitizeShortTermDisplayPart(parts.at(-2) ?? "");
}

export function shortTermSourceNameFromPathLike(value: unknown, fallback = "untitled.svga"): string {
  return shortTermDisplayNameFromPathLike(value) || fallback;
}

export function sanitizeShortTermDisplayPart(value: unknown): string {
  return typeof value === "string"
    ? value.replace(/[\p{Cc}\p{Cf}]+/gu, " ").replace(/[\\/]+/g, " ").replace(/\s+/g, " ").trim()
    : "";
}
