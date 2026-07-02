import { createHash } from "node:crypto";
import {
  shortTermDisplayNameFromPathLike,
  shortTermParentDisplayNameFromPathLike
} from "./short-term-path-display.js";

export const SHORT_TERM_RECENT_FILES_SCHEMA_VERSION = 1 as const;
export const SHORT_TERM_RECENT_FILES_STORAGE_KEY = "auto-svga.short-term.recent-files.v1" as const;
export const SHORT_TERM_MAX_LAUNCH_RECENT_FILES = 5 as const;
export const SHORT_TERM_MAX_MENU_RECENT_FILES = 10 as const;

export type ShortTermRecentAvailability = "available" | "missing";
export type ShortTermRecentOpenSource = "recentLaunch" | "recentMenu";

export interface ShortTermRecentFileInput {
  id?: string;
  localPath: string;
  displayName?: string;
  parentDisplayName?: string;
  lastOpenedAt?: string | number | Date;
  availability?: ShortTermRecentAvailability;
}

export interface ShortTermRecentFileHostRecord {
  schemaVersion: typeof SHORT_TERM_RECENT_FILES_SCHEMA_VERSION;
  id: string;
  localPath: string;
  displayName: string;
  parentDisplayName: string;
  lastOpenedAt: string;
  availability: ShortTermRecentAvailability;
}

export interface ShortTermRecentFileViewRecord {
  id: string;
  displayName: string;
  parentDisplayName: string;
  lastOpenedAt: string;
  availability: ShortTermRecentAvailability;
  pathRedacted: true;
  rendererHasFullPath: false;
}

export interface ShortTermRecentFilesState {
  schemaVersion: typeof SHORT_TERM_RECENT_FILES_SCHEMA_VERSION;
  source: "short-term-recent-files-state";
  prdIds: readonly ["S16"];
  records: readonly ShortTermRecentFileHostRecord[];
  updatedAt: string;
}

export interface ShortTermRecentFilesViewModel {
  schemaVersion: typeof SHORT_TERM_RECENT_FILES_SCHEMA_VERSION;
  source: "short-term-recent-files-view";
  prdIds: readonly ["S16"];
  launchRecentFiles: readonly ShortTermRecentFileViewRecord[];
  menuRecentFiles: readonly ShortTermRecentFileViewRecord[];
  clearActionEnabled: boolean;
  privacy: {
    fullPathsHiddenByDefault: true;
    rendererRecordsContainFullPath: false;
  };
  statusCopy: string;
}

export interface ShortTermRecentOpenReady {
  status: "ready";
  request: {
    requestId: string;
    source: ShortTermRecentOpenSource;
    displayName: string;
    localPath: string;
    recentFileId: string;
  };
}

export interface ShortTermRecentOpenMissing {
  status: "missing";
  recentFileId: string;
  displayName: string;
  message: string;
}

export type ShortTermRecentOpenResolution = ShortTermRecentOpenReady | ShortTermRecentOpenMissing;

export interface ShortTermRecentFilesStateOptions {
  now?: string | number | Date;
}

export function createShortTermRecentFilesState(
  records: readonly ShortTermRecentFileInput[] = [],
  options: ShortTermRecentFilesStateOptions = {}
): ShortTermRecentFilesState {
  return {
    schemaVersion: SHORT_TERM_RECENT_FILES_SCHEMA_VERSION,
    source: "short-term-recent-files-state",
    prdIds: ["S16"],
    records: normalizeRecentRecords(records, options),
    updatedAt: isoTimestamp(options.now)
  };
}

export function createShortTermRecentFilesViewModel(
  state: ShortTermRecentFilesState,
  status: "ready" | "missing" | "cleared" = "ready"
): ShortTermRecentFilesViewModel {
  const records = normalizeRecentRecords(state.records, { now: state.updatedAt });
  return {
    schemaVersion: SHORT_TERM_RECENT_FILES_SCHEMA_VERSION,
    source: "short-term-recent-files-view",
    prdIds: ["S16"],
    launchRecentFiles: records.slice(0, SHORT_TERM_MAX_LAUNCH_RECENT_FILES).map(toViewRecord),
    menuRecentFiles: records.slice(0, SHORT_TERM_MAX_MENU_RECENT_FILES).map(toViewRecord),
    clearActionEnabled: records.length > 0,
    privacy: {
      fullPathsHiddenByDefault: true,
      rendererRecordsContainFullPath: false
    },
    statusCopy: statusCopy(status)
  };
}

export function addShortTermRecentFile(
  state: ShortTermRecentFilesState,
  input: ShortTermRecentFileInput,
  options: ShortTermRecentFilesStateOptions = {}
): ShortTermRecentFilesState {
  const nextRecord = createRecentRecord(input, options);
  if (!nextRecord) return createShortTermRecentFilesState(state.records, options);
  return createShortTermRecentFilesState([
    nextRecord,
    ...state.records.filter((record) => dedupeKey(record) !== dedupeKey(nextRecord))
  ], options);
}

export function clearShortTermRecentFiles(
  options: ShortTermRecentFilesStateOptions = {}
): ShortTermRecentFilesState {
  return createShortTermRecentFilesState([], options);
}

export function markShortTermRecentFileMissing(
  state: ShortTermRecentFilesState,
  recentFileId: string,
  options: ShortTermRecentFilesStateOptions = {}
): ShortTermRecentFilesState {
  return createShortTermRecentFilesState(state.records.map((record) => (
    record.id === recentFileId ? { ...record, availability: "missing" } : record
  )), options);
}

export function resolveShortTermRecentOpen(
  state: ShortTermRecentFilesState,
  recentFileId: string,
  source: ShortTermRecentOpenSource,
  requestId: string
): ShortTermRecentOpenResolution {
  const record = state.records.find(({ id }) => id === recentFileId);
  if (!record || record.availability === "missing") {
    return {
      status: "missing",
      recentFileId,
      displayName: record?.displayName ?? "最近文件",
      message: "最近文件已不存在或当前无法访问。"
    };
  }

  return {
    status: "ready",
    request: {
      requestId,
      source,
      displayName: record.displayName,
      localPath: record.localPath,
      recentFileId: record.id
    }
  };
}

export function serializeShortTermRecentFilesState(state: ShortTermRecentFilesState): string {
  return JSON.stringify({
    schemaVersion: SHORT_TERM_RECENT_FILES_SCHEMA_VERSION,
    records: normalizeRecentRecords(state.records, { now: state.updatedAt })
  });
}

export function parseShortTermRecentFilesStateJson(
  raw: string | undefined,
  fallback: readonly ShortTermRecentFileInput[] = [],
  options: ShortTermRecentFilesStateOptions = {}
): ShortTermRecentFilesState {
  if (!raw) return createShortTermRecentFilesState(fallback, options);
  try {
    const parsed = JSON.parse(raw) as { schemaVersion?: unknown; records?: unknown };
    if (parsed.schemaVersion !== SHORT_TERM_RECENT_FILES_SCHEMA_VERSION) {
      return createShortTermRecentFilesState(fallback, options);
    }
    const records = Array.isArray(parsed.records) ? parsed.records : fallback;
    return createShortTermRecentFilesState(records as ShortTermRecentFileInput[], options);
  } catch {
    return createShortTermRecentFilesState(fallback, options);
  }
}

function normalizeRecentRecords(
  records: readonly unknown[],
  options: ShortTermRecentFilesStateOptions
): ShortTermRecentFileHostRecord[] {
  const normalized: ShortTermRecentFileHostRecord[] = [];
  const seen = new Set<string>();
  for (const input of records) {
    const record = createRecentRecord(input, options);
    if (!record) continue;
    const key = dedupeKey(record);
    if (seen.has(key)) continue;
    seen.add(key);
    normalized.push(record);
  }
  return normalized
    .sort((a, b) => Date.parse(b.lastOpenedAt) - Date.parse(a.lastOpenedAt))
    .slice(0, SHORT_TERM_MAX_MENU_RECENT_FILES);
}

function createRecentRecord(
  input: unknown,
  options: ShortTermRecentFilesStateOptions
): ShortTermRecentFileHostRecord | undefined {
  if (!isRecord(input)) return undefined;
  const localPath = normalizeLocalPath(input.localPath);
  if (!localPath) return undefined;
  const displayName = shortTermDisplayNameFromPathLike(input.displayName) || shortTermDisplayNameFromPathLike(localPath);
  if (!displayName) return undefined;
  const parentDisplayName = shortTermDisplayNameFromPathLike(input.parentDisplayName)
    || shortTermParentDisplayNameFromPathLike(localPath)
    || "本地文件";

  return {
    schemaVersion: SHORT_TERM_RECENT_FILES_SCHEMA_VERSION,
    id: sanitizeIdentifier(input.id) || `recent-${sha256(localPath).slice(0, 16)}`,
    localPath,
    displayName,
    parentDisplayName,
    lastOpenedAt: isoTimestamp(input.lastOpenedAt ?? options.now),
    availability: isRecentAvailability(input.availability) ? input.availability : "available"
  };
}

function toViewRecord(record: ShortTermRecentFileHostRecord): ShortTermRecentFileViewRecord {
  return {
    id: record.id,
    displayName: record.displayName,
    parentDisplayName: record.parentDisplayName,
    lastOpenedAt: record.lastOpenedAt,
    availability: record.availability,
    pathRedacted: true,
    rendererHasFullPath: false
  };
}

function statusCopy(status: "ready" | "missing" | "cleared"): string {
  switch (status) {
    case "missing":
      return "最近文件已缺失或不可访问。可以打开其他文件，或清除最近记录。";
    case "cleared":
      return "最近记录已清除，源文件不会被删除。";
    case "ready":
      return "最近记录仅显示文件名和父级位置，不展示完整本地路径。";
  }
}

function dedupeKey(record: ShortTermRecentFileHostRecord): string {
  return normalizeLocalPath(record.localPath).toLocaleLowerCase();
}

function normalizeLocalPath(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function isRecentAvailability(value: unknown): value is ShortTermRecentAvailability {
  return value === "available" || value === "missing";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object";
}

function sanitizeIdentifier(value: unknown): string {
  return typeof value === "string" ? value.replace(/[^\w.-]+/g, "-").replace(/^-+|-+$/g, "") : "";
}

function isoTimestamp(value: unknown): string {
  if (value instanceof Date && Number.isFinite(value.getTime())) return value.toISOString();
  if (typeof value === "number" && Number.isFinite(value)) return new Date(value).toISOString();
  if (typeof value === "string") {
    const parsed = Date.parse(value);
    if (Number.isFinite(parsed)) return new Date(parsed).toISOString();
  }
  return new Date(0).toISOString();
}

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}
