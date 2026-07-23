"use strict";

const { appendFileSync, existsSync, readFileSync } = require("node:fs");
const path = require("node:path");
const { sanitizeRuntimeTraceEntry } = require("./startup-runtime-policy.cjs");

const TRACE_SCHEMA_VERSION = 1;
const TRACE_MARKER_FILE = "auto-svga-multiformat-trace-run-id";
const TRACE_RUN_ID_PATTERN = /^[a-z0-9][a-z0-9-]{7,63}$/u;
function resolveMultiFormatTraceRunId(options = {}) {
  const environmentRunId = safeTraceRunId(options.environment?.AUTO_SVGA_MULTIFORMAT_TRACE_RUN_ID);
  if (environmentRunId) return environmentRunId;
  if (options.isPackaged !== true || typeof options.resourcesPath !== "string") return "";
  const markerPath = path.join(options.resourcesPath, TRACE_MARKER_FILE);
  try {
    if (!existsSync(markerPath)) return "";
    return safeTraceRunId(readFileSync(markerPath, "utf8"));
  } catch {
    return "";
  }
}

function createMultiFormatOpenRuntimeTrace(options = {}) {
  const runId = safeTraceRunId(options.runId);
  const tracePath = runId ? `/private/tmp/auto-svga-multiformat-trace-${runId}.jsonl` : "";
  const clock = typeof options.clock === "function" ? options.clock : Date.now;

  return Object.freeze({
    enabled: Boolean(tracePath),
    runId,
    tracePath,
    record(input = {}) {
      if (!tracePath) return false;
      let entry;
      try {
        entry = sanitizeRuntimeTraceEntry(input, clock());
      } catch {
        return false;
      }
      if (!entry) return false;
      try {
        appendFileSync(tracePath, `${JSON.stringify(entry)}\n`, { encoding: "utf8", mode: 0o600 });
        return true;
      } catch {
        return false;
      }
    }
  });
}

function safeTraceRunId(value) {
  const normalized = typeof value === "string" ? value.trim().toLowerCase() : "";
  return TRACE_RUN_ID_PATTERN.test(normalized) ? normalized : "";
}

module.exports = {
  TRACE_MARKER_FILE,
  TRACE_SCHEMA_VERSION,
  createMultiFormatOpenRuntimeTrace,
  resolveMultiFormatTraceRunId
};
