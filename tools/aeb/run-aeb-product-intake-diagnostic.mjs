#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

const require = createRequire(import.meta.url);
const {
  CONTRACT,
  descriptorSha256,
  validateDescriptor,
} = require("./aeb-registered-fixture-proof-contract.cjs");
const {
  HELPER_PATH,
  HELPER_SHA256,
  createEvidenceStore,
  readJsonRecord,
  writeJsonRecord,
} = require("./registered-fixture-proof-evidence-store.cjs");

const INPUT_SCHEMA = "auto-svga-aeb-product-intake-diagnostic-input-v1";
const OUTPUT_SCHEMA = "auto-svga-aeb-product-intake-diagnostic-result-v1";
const OPEN_PATH = "/usr/bin/open";
const GIT_PATH = "/usr/bin/git";
const stages = new Set([
  "load-native-modules",
  "materialize-export-svga",
  "materialize-prepare-output",
  "materialize-read-generated-svga",
  "materialize-validate-generated-svga",
  "materialize-write-assets",
  "materialize-write-authority-records",
  "open-shared-preview",
  "publish-preview-authority",
  "read-package-json",
  "resolve-package-input",
  "snapshot-package-tree",
  "timing-preflight",
  "validate-package-authority",
  "validate-preview-acceptance",
  "validate-preview-path",
]);
const errorTypes = new Set(["Error", "RangeError", "TypeError", "UnclassifiedError"]);

function fail(code) {
  const error = new Error(code);
  error.code = code;
  throw error;
}

function exactJsonRecord(value, keys, code) {
  if (!value || typeof value !== "object" || Array.isArray(value) || Object.getPrototypeOf(value) !== Object.prototype) {
    fail(code);
  }
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  if (actual.length !== expected.length || actual.some((key, index) => key !== expected[index])) fail(code);
  return value;
}

export function validateDiagnosticInput(value) {
  const record = exactJsonRecord(value, ["descriptor", "schema"], "aeb_product_intake_diagnostic_input_invalid");
  if (record.schema !== INPUT_SCHEMA) fail("aeb_product_intake_diagnostic_input_invalid");
  return Object.freeze({ schema: INPUT_SCHEMA, descriptor: validateDescriptor(record.descriptor) });
}

export function summarizeDiagnostic(value) {
  const record = exactJsonRecord(
    value,
    ["errorCode", "errorName", "pathRedacted", "phase", "schema"],
    "aeb_product_intake_diagnostic_result_invalid",
  );
  if (
    record.schema !== "auto-svga-aeb-package-intake-diagnostic-v1"
    || !stages.has(record.phase)
    || !errorTypes.has(record.errorName)
    || typeof record.errorCode !== "string"
    || !/^[A-Za-z0-9._-]{1,96}$/u.test(record.errorCode)
    || record.pathRedacted !== true
  ) fail("aeb_product_intake_diagnostic_result_invalid");
  return Object.freeze({
    schema: OUTPUT_SCHEMA,
    status: "diagnosed",
    stage: record.phase,
    errorType: record.errorName,
    errorCode: record.errorCode,
    pathRedacted: true,
    runtimePassClaimed: false,
  });
}

export function buildOpenArgs({ wrapperPath, descriptorPath, descriptorHash, store, stdoutPath, stderrPath }) {
  return [
    "-W", "-n", "-g",
    "--stdout", stdoutPath,
    "--stderr", stderrPath,
    "-a", CONTRACT.electronApp,
    "--args",
    wrapperPath,
    "--descriptor-path", descriptorPath,
    "--descriptor-sha256", descriptorHash,
    "--evidence-binding-base64", Buffer.from(JSON.stringify(store.binding), "utf8").toString("base64url"),
    "--evidence-binding-sha256", store.bindingSha256,
    "--evidence-helper-path", HELPER_PATH,
    "--evidence-helper-sha256", HELPER_SHA256,
    "--output-root", store.outputRoot,
  ];
}

function gitValue(args) {
  const result = spawnSync(GIT_PATH, args, { cwd: process.cwd(), encoding: "utf8", maxBuffer: 1024 * 1024 });
  if (result.status !== 0 || result.signal) fail("aeb_product_intake_diagnostic_git_invalid");
  return result.stdout.trim();
}

export function runDiagnostic(inputPath) {
  const input = validateDiagnosticInput(JSON.parse(fs.readFileSync(inputPath, "utf8")));
  const descriptor = input.descriptor;
  if (gitValue(["rev-parse", "HEAD"]) !== descriptor.sourceHead || gitValue(["status", "--short"]) !== "") {
    fail("aeb_product_intake_diagnostic_source_invalid");
  }
  if (fs.existsSync(descriptor.outputRoot)) fail("aeb_product_intake_diagnostic_output_exists");
  const store = createEvidenceStore(descriptor.outputRoot);
  const descriptorWrite = writeJsonRecord(store, "reports", "registered-fixture-descriptor.json", descriptor);
  const expectedDescriptorHash = descriptorSha256(descriptor);
  if (descriptorWrite.sha256 !== expectedDescriptorHash) fail("aeb_product_intake_diagnostic_descriptor_invalid");

  const wrapperPath = path.join(store.outputRoot, "session-data", "product-intake-diagnostic-bootstrap.cjs");
  fs.writeFileSync(
    wrapperPath,
    `"use strict";\nrequire(${JSON.stringify(CONTRACT.bootstrapPath)}).main(process.argv.slice(2));\n`,
    { flag: "wx", mode: 0o600 },
  );
  const stdoutPath = path.join(store.outputRoot, "reports", "product-intake-diagnostic.stdout.log");
  const stderrPath = path.join(store.outputRoot, "reports", "product-intake-diagnostic.stderr.log");
  const openResult = spawnSync(OPEN_PATH, buildOpenArgs({
    wrapperPath,
    descriptorPath: path.join(store.outputRoot, "reports", "registered-fixture-descriptor.json"),
    descriptorHash: expectedDescriptorHash,
    store,
    stdoutPath,
    stderrPath,
  }), { encoding: "utf8", timeout: 120_000, maxBuffer: 1024 * 1024 });

  try {
    return summarizeDiagnostic(readJsonRecord(store, "reports", "aeb-package-intake-diagnostic.json").value);
  } catch (error) {
    if (error?.code === "aeb_product_intake_diagnostic_result_invalid") throw error;
  }
  return Object.freeze({
    schema: OUTPUT_SCHEMA,
    status: "failed_closed",
    stage: "pre-javascript-or-no-intake-record",
    errorType: "UnclassifiedError",
    errorCode: openResult.status === 0 && !openResult.signal ? "diagnostic_record_missing" : "registered_launch_failed",
    pathRedacted: true,
    runtimePassClaimed: false,
  });
}

function parseArgs(argv) {
  if (argv.length !== 2 || argv[0] !== "--input" || !argv[1] || argv[1].startsWith("--")) {
    fail("aeb_product_intake_diagnostic_arguments_invalid");
  }
  return argv[1];
}

if (import.meta.url === new URL(process.argv[1], "file:").href) {
  try {
    process.stdout.write(`${JSON.stringify(runDiagnostic(parseArgs(process.argv.slice(2))))}\n`);
  } catch (error) {
    process.stdout.write(`${JSON.stringify({
      schema: OUTPUT_SCHEMA,
      status: "failed_closed",
      stage: "preflight",
      errorType: "UnclassifiedError",
      errorCode: typeof error?.code === "string" ? error.code : "diagnostic_failed",
      pathRedacted: true,
      runtimePassClaimed: false,
    })}\n`);
    process.exitCode = 1;
  }
}
