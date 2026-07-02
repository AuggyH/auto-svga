const GENERIC_LOCAL_PATH_PATTERNS: readonly RegExp[] = [
  /(?:\/Users\/|\/Volumes\/|\/private\/|\/var\/|\/tmp\/)(?:[^，。；;:'")\n\r]|'(?=\S))*/gu,
  /[A-Za-z]:[\\/](?:[^，。；;:'")\n\r]|'(?=\S))*/gu
];

export function redactShortTermLocalPaths(
  message: string,
  sensitivePaths: readonly string[] = []
): string {
  let redacted = message;
  for (const sensitivePath of sensitivePaths) {
    const normalized = sensitivePath.trim();
    if (normalized) {
      redacted = redacted.split(normalized).join("[local path]");
    }
  }
  for (const pattern of GENERIC_LOCAL_PATH_PATTERNS) {
    redacted = redacted.replace(pattern, "[local path]");
  }
  return redacted;
}

export function redactShortTermLocalPathsFromError(
  error: unknown,
  fallback: string,
  sensitivePaths: readonly string[] = []
): string {
  const message = error instanceof Error && error.message
    ? error.message
    : typeof error === "string" && error
      ? error
      : fallback;
  return redactShortTermLocalPaths(message, sensitivePaths);
}

export function redactShortTermLocalPathsInValue<T>(
  value: T,
  sensitivePaths: readonly string[] = []
): T {
  return redactValue(value, sensitivePaths) as T;
}

function redactValue(value: unknown, sensitivePaths: readonly string[]): unknown {
  if (typeof value === "string") return redactShortTermLocalPaths(value, sensitivePaths);
  if (Array.isArray(value)) return value.map((entry) => redactValue(entry, sensitivePaths));
  if (!value || typeof value !== "object") return value;
  if (value instanceof Uint8Array) return new Uint8Array(value);

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(([key, entry]) => [
      key,
      redactValue(entry, sensitivePaths)
    ])
  );
}
