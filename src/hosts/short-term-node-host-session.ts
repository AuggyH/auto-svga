import {
  createShortTermHostSession,
  type ShortTermHostSession
} from "../workbench/short-term-host-session.js";
import {
  createShortTermNodeHostEnvironment,
  type CreateShortTermNodeHostEnvironmentOptions
} from "./short-term-node-host-environment.js";
import { createShortTermNodeRecentFilesStore } from "./short-term-node-recent-files-store.js";

export interface CreateShortTermNodeHostSessionOptions extends CreateShortTermNodeHostEnvironmentOptions {
  recentStorePath?: string;
}

export async function createShortTermNodeHostSession(
  options: CreateShortTermNodeHostSessionOptions = {}
): Promise<ShortTermHostSession> {
  const host = createShortTermNodeHostEnvironment({
    inspectionReportService: options.inspectionReportService
  });
  const recentStore = options.recentStorePath
    ? createShortTermNodeRecentFilesStore({ filePath: options.recentStorePath })
    : undefined;
  return createShortTermHostSession({
    host,
    recentStore
  });
}
