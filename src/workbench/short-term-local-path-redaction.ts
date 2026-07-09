import {
  redactLocalPaths,
  redactLocalPathsFromError,
  redactLocalPathsInValue
} from "./local-path-redaction.js";

export function redactShortTermLocalPaths(
  message: string,
  sensitivePaths: readonly string[] = []
): string {
  return redactLocalPaths(message, sensitivePaths);
}

export function redactShortTermLocalPathsFromError(
  error: unknown,
  fallback: string,
  sensitivePaths: readonly string[] = []
): string {
  return redactLocalPathsFromError(error, fallback, sensitivePaths);
}

export function redactShortTermLocalPathsInValue<T>(
  value: T,
  sensitivePaths: readonly string[] = []
): T {
  return redactLocalPathsInValue(value, sensitivePaths);
}
