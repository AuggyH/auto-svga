#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import path from "node:path";

import {
  ENTRY_CONTRACT,
  materializeFixtureRequest,
} from "./aeb-registered-fixture-runtime-entry.mjs";
import { collectAebHostForegroundReadiness } from "./aeb-host-foreground-readiness.mjs";

const OUTPUT_SCHEMA = "auto-svga-aeb-ae26-fixture-request-run-v1";
const ARGUMENTS = Object.freeze(["permit-id", "request-id", "source-head"]);

function fail(code, detail = {}) {
  const error = new Error(code);
  error.code = code;
  Object.assign(error, detail);
  throw error;
}

function parseArgs(argv) {
  if (!Array.isArray(argv)) fail("aeb_fixture_request_arguments_invalid");
  const parsed = Object.create(null);
  for (let index = 0; index < argv.length; index += 2) {
    const token = argv[index];
    const value = argv[index + 1];
    if (typeof token !== "string" || !token.startsWith("--") || typeof value !== "string" || value.startsWith("--")) {
      fail("aeb_fixture_request_arguments_invalid");
    }
    const key = token.slice(2);
    if (!ARGUMENTS.includes(key) || Object.prototype.hasOwnProperty.call(parsed, key)) {
      fail("aeb_fixture_request_arguments_invalid");
    }
    parsed[key] = value;
  }
  if (!parsed["permit-id"] || !parsed["request-id"]) fail("aeb_fixture_request_arguments_invalid");
  return parsed;
}

function currentGitHead(cwd = process.cwd()) {
  const result = spawnSync("/usr/bin/git", ["rev-parse", "HEAD"], {
    cwd,
    encoding: "utf8",
    maxBuffer: 1024 * 1024,
  });
  if (result.status !== 0) fail("aeb_fixture_request_git_head_unavailable");
  const head = result.stdout.trim();
  if (!/^[0-9a-f]{40}$/u.test(head)) fail("aeb_fixture_request_git_head_invalid");
  return head;
}

function buildRequestInput({ permitId, requestId, sourceHead, now }) {
  const aeDevRoot = path.dirname(ENTRY_CONTRACT.inboxRoot);
  return {
    schema: ENTRY_CONTRACT.requestSchema,
    permitId,
    requestCreatedAtEpochMs: now,
    requestExpiresAtEpochMs: now + ENTRY_CONTRACT.requestLifetimeMs,
    requestId,
    sourceHead,
    sourcePackageRoot: path.join(aeDevRoot, requestId, "ae-export-package"),
  };
}

export async function runAe26FixtureRequest(argv = process.argv.slice(2), dependencies = {}) {
  const parsed = parseArgs(argv);
  const readiness = (dependencies.collectReadiness || collectAebHostForegroundReadiness)();
  if (!readiness?.ready) {
    fail("aeb_fixture_request_host_not_ready", { readiness });
  }
  const sourceHead = parsed["source-head"] || (dependencies.currentHead || currentGitHead)(dependencies.cwd);
  const now = (dependencies.now || Date.now)();
  const input = buildRequestInput({
    permitId: parsed["permit-id"],
    requestId: parsed["request-id"],
    sourceHead,
    now,
  });
  const result = (dependencies.materializeFixtureRequest || materializeFixtureRequest)(
    input,
    dependencies.runtimeEntryDependencies || {},
  );
  return {
    schema: OUTPUT_SCHEMA,
    ready: true,
    sourceHead,
    requestId: input.requestId,
    permitId: input.permitId,
    requestCreatedAtEpochMs: input.requestCreatedAtEpochMs,
    requestExpiresAtEpochMs: input.requestExpiresAtEpochMs,
    sourcePackageRoot: input.sourcePackageRoot,
    requestSha256: result.requestSha256,
    requestPublicationPath: result.requestPublicationPath,
    requestPublicationSha256: result.requestPublicationSha256,
    mutationPerformed: result.mutationPerformed === true,
  };
}

export async function main(argv = process.argv.slice(2), dependencies = {}) {
  return runAe26FixtureRequest(argv, dependencies);
}

if (import.meta.url === new URL(process.argv[1], "file:").href) {
  try {
    const result = await main();
    process.stdout.write(`${JSON.stringify(result)}\n`);
  } catch (error) {
    process.stderr.write(`${JSON.stringify({
      status: "failed_closed",
      issueCode: typeof error?.code === "string" ? error.code : "aeb_fixture_request_failed",
      readiness: error?.readiness,
    })}\n`);
    process.exitCode = 1;
  }
}
