const GENERIC_LOCAL_PATH_PATTERNS: readonly RegExp[] = [
  /(?:\/Users\/|\/Volumes\/|\/private\/|\/var\/|\/tmp\/)[^，。；;:'")\n\r]*/gu,
  /[A-Za-z]:[\\/][^，。；;:'")\n\r]*/gu
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
