import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  clearShortTermRecentFiles,
  parseShortTermRecentFilesStateJson,
  serializeShortTermRecentFilesState,
  type ShortTermRecentFilesState
} from "../workbench/short-term-recent-files.js";
import type { ShortTermRecentFilesStore } from "../workbench/short-term-host-recent-persistence.js";

export interface CreateShortTermNodeRecentFilesStoreOptions {
  filePath: string;
}

export function createShortTermNodeRecentFilesStore(
  options: CreateShortTermNodeRecentFilesStoreOptions
): ShortTermRecentFilesStore {
  return new ShortTermNodeRecentFilesStore(options.filePath);
}

class ShortTermNodeRecentFilesStore implements ShortTermRecentFilesStore {
  constructor(private readonly filePath: string) {}

  async load(): Promise<ShortTermRecentFilesState> {
    try {
      return parseShortTermRecentFilesStateJson(await readFile(this.filePath, "utf8"));
    } catch {
      return parseShortTermRecentFilesStateJson(undefined);
    }
  }

  async save(state: ShortTermRecentFilesState): Promise<void> {
    await mkdir(path.dirname(this.filePath), { recursive: true });
    const tempPath = `${this.filePath}.${process.pid}.${randomUUID()}.tmp`;
    await writeFile(tempPath, `${serializeShortTermRecentFilesState(state)}\n`, {
      mode: 0o600
    });
    await rename(tempPath, this.filePath);
  }

  async clear(): Promise<ShortTermRecentFilesState> {
    const cleared = clearShortTermRecentFiles();
    await this.save(cleared);
    return cleared;
  }
}
