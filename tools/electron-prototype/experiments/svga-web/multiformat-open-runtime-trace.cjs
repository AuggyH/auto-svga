"use strict";

const { appendFileSync, existsSync, readFileSync } = require("node:fs");
const path = require("node:path");

const TRACE_SCHEMA_VERSION = 1;
const TRACE_MARKER_FILE = "auto-svga-multiformat-trace-run-id";
const TRACE_RUN_ID_PATTERN = /^[a-z0-9][a-z0-9-]{7,63}$/u;
const TRACE_PHASES = new Set([
  "main_started",
  "open_file_received",
  "open_file_rejected_mode",
  "open_file_queued",
  "flush_attempt",
  "flush_deferred",
  "flush_started",
  "dispatch_started",
  "renderer_begin_result",
  "session_open_completed",
  "renderer_complete_result",
  "dispatch_failed",
  "renderer_load_completed",
  "renderer_action_bridge_ready"
]);

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
      if (!tracePath || !TRACE_PHASES.has(input.phase)) return false;
      const entry = sanitizeTraceEntry(input, clock);
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

function sanitizeTraceEntry(input, clock) {
  const phase = TRACE_PHASES.has(input.phase) ? input.phase : "";
  if (!phase) return undefined;
  const entry = {
    schemaVersion: TRACE_SCHEMA_VERSION,
    phase,
    timestampMs: finiteInteger(clock(), 0, Number.MAX_SAFE_INTEGER) ?? 0
  };
  assignToken(entry, "eventId", input.eventId, 96);
  assignToken(entry, "requestId", input.requestId, 96);
  assignToken(entry, "format", input.format, 24);
  assignHex(entry, "sourceId", input.sourceId);
  assignToken(entry, "productMilestoneId", input.productMilestoneId, 64);
  assignToken(entry, "modelStatus", input.modelStatus, 48);
  assignToken(entry, "issueCode", input.issueCode, 64);
  assignBoolean(entry, "formalRuntimeMode", input.formalRuntimeMode);
  assignBoolean(entry, "bridgeReady", input.bridgeReady);
  assignBoolean(entry, "actionAccepted", input.actionAccepted);
  const queueDepth = finiteInteger(input.queueDepth, 0, 1000);
  if (queueDepth !== undefined) entry.queueDepth = queueDepth;
  return entry;
}

function safeTraceRunId(value) {
  const normalized = typeof value === "string" ? value.trim().toLowerCase() : "";
  return TRACE_RUN_ID_PATTERN.test(normalized) ? normalized : "";
}

function assignToken(target, key, value, maxLength) {
  const token = typeof value === "string" ? value.trim() : "";
  if (token && token.length <= maxLength && /^[a-z0-9_.:-]+$/iu.test(token)) target[key] = token;
}

function assignHex(target, key, value) {
  const token = typeof value === "string" ? value.trim().toLowerCase() : "";
  if (/^[a-f0-9]{16,64}$/u.test(token)) target[key] = token;
}

function assignBoolean(target, key, value) {
  if (typeof value === "boolean") target[key] = value;
}

function finiteInteger(value, minimum, maximum) {
  const number = Number(value);
  if (!Number.isFinite(number)) return undefined;
  const integer = Math.trunc(number);
  return integer >= minimum && integer <= maximum ? integer : undefined;
}

module.exports = {
  TRACE_MARKER_FILE,
  TRACE_SCHEMA_VERSION,
  createMultiFormatOpenRuntimeTrace,
  resolveMultiFormatTraceRunId
};
