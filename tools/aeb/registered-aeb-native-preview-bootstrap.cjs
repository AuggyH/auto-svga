"use strict";

const crypto = require("node:crypto");
const path = require("node:path");

const {
  CONTRACT,
  descriptorEnvironment,
  descriptorSha256,
  validateDescriptor
} = require("./aeb-registered-fixture-proof-contract.cjs");
const {
  HELPER_PATH,
  HELPER_SHA256,
  readJsonRecord,
  writeJsonRecord
} = require("./registered-fixture-proof-evidence-store.cjs");

const ARGUMENT_KEYS = Object.freeze([
  "descriptor-path",
  "descriptor-sha256",
  "evidence-binding-base64",
  "evidence-binding-sha256",
  "evidence-helper-path",
  "evidence-helper-sha256",
  "output-root"
]);
const PROCESS_STARTED_AT_UTC = new Date(Date.now() - (process.uptime() * 1000)).toISOString();

function fail(code) {
  const error = new Error(code);
  error.code = code;
  throw error;
}

function parseArgs(argv) {
  if (!Array.isArray(argv) || argv.length !== ARGUMENT_KEYS.length * 2) fail("registered_fixture_arguments_invalid");
  const result = Object.create(null);
  for (let index = 0; index < argv.length; index += 2) {
    const token = argv[index];
    const value = argv[index + 1];
    if (typeof token !== "string" || typeof value !== "string" || !token.startsWith("--") || value.startsWith("--")) {
      fail("registered_fixture_arguments_invalid");
    }
    const key = token.slice(2);
    if (key !== ARGUMENT_KEYS[index / 2] || Object.prototype.hasOwnProperty.call(result, key)) {
      fail("registered_fixture_arguments_invalid");
    }
    result[key] = value;
  }
  if (Object.keys(result).length !== ARGUMENT_KEYS.length) fail("registered_fixture_arguments_invalid");
  return result;
}

function decodeBinding(value) {
  if (typeof value !== "string" || value.length === 0) fail("registered_fixture_evidence_binding_invalid");
  let parsed;
  try {
    parsed = JSON.parse(Buffer.from(value, "base64url").toString("utf8"));
  } catch {
    fail("registered_fixture_evidence_binding_invalid");
  }
  return parsed;
}

function loadDescriptor(args) {
  if (args["evidence-helper-path"] !== HELPER_PATH || args["evidence-helper-sha256"] !== HELPER_SHA256) {
    fail("registered_fixture_evidence_helper_invalid");
  }
  const outputRoot = path.resolve(args["output-root"]);
  if (path.dirname(outputRoot) !== CONTRACT.taskRoot) fail("registered_fixture_output_root_invalid");
  const descriptorPath = path.resolve(args["descriptor-path"]);
  const expectedDescriptorPath = path.join(outputRoot, "reports", "registered-fixture-descriptor.json");
  if (descriptorPath !== expectedDescriptorPath || !/^[a-f0-9]{64}$/u.test(args["descriptor-sha256"])) {
    fail("registered_fixture_descriptor_path_invalid");
  }
  const binding = decodeBinding(args["evidence-binding-base64"]);
  const store = {
    binding,
    bindingSha256: args["evidence-binding-sha256"],
    outputRoot
  };
  if (!/^[a-f0-9]{64}$/u.test(store.bindingSha256)) fail("registered_fixture_evidence_binding_invalid");
  const descriptorRecord = readJsonRecord(store, "reports", "registered-fixture-descriptor.json");
  if (descriptorRecord.sha256 !== args["descriptor-sha256"]) fail("registered_fixture_descriptor_hash_mismatch");
  const descriptor = validateDescriptor(descriptorRecord.value);
  if (descriptor.outputRoot !== outputRoot || descriptorSha256(descriptorRecord.value) !== descriptorRecord.sha256) {
    fail("registered_fixture_descriptor_binding_mismatch");
  }
  return { descriptor, store };
}

function phaseRecord(phase, descriptor, store, extra = {}) {
  return {
    schema: `auto-svga-aeb-registered-fixture-proof-${phase}-v1`,
    phase,
    permitId: descriptor.permitId,
    executionId: descriptor.executionId,
    sourceHead: descriptor.sourceHead,
    requestId: descriptor.requestId,
    requestSha256: descriptor.requestSha256,
    d001PermitId: descriptor.d001PermitId,
    d001ExecutionId: descriptor.d001ExecutionId,
    d001PacketHead: descriptor.d001PacketHead,
    pid: process.pid,
    ppid: process.ppid,
    processStartedAtUtc: PROCESS_STARTED_AT_UTC,
    processExecPath: process.execPath,
    appPath: CONTRACT.electronApp,
    bundleId: CONTRACT.electronBundleId,
    electronVersion: process.versions.electron || null,
    evidenceBindingSha256: store.bindingSha256,
    recordedAtUtc: new Date().toISOString(),
    ...extra
  };
}

function writeMarker(store, name, value) {
  return writeJsonRecord(store, "reports", name, value);
}

function writeLifecycleMarker(store, name, value) {
  try {
    writeMarker(store, name, value);
  } catch {
    process.exitCode = 1;
  }
}

function main(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (process.execPath !== CONTRACT.electronExecutable || process.versions.electron !== CONTRACT.electronVersion) {
    fail("registered_fixture_electron_identity_invalid");
  }
  const { descriptor, store } = loadDescriptor(args);
  Object.assign(process.env, descriptorEnvironment(descriptor, store));
  writeMarker(store, "registered-first-javascript-marker.json", phaseRecord("first-javascript", descriptor, store, {
    argvSha256: crypto.createHash("sha256").update(JSON.stringify(process.argv)).digest("hex")
  }));

  const { app } = require("electron");
  app.setAppPath(CONTRACT.experimentRoot);
  app.once("before-quit", () => {
    writeLifecycleMarker(store, "registered-normal-quit-requested.json", phaseRecord("normal-quit-requested", descriptor, store));
  });
  app.once("will-quit", () => {
    writeLifecycleMarker(store, "registered-normal-quit-will-quit.json", phaseRecord("normal-quit-will-quit", descriptor, store));
  });
  app.once("quit", (_event, exitCode) => {
    const effectiveExitCode = Number.isInteger(process.exitCode) ? process.exitCode : exitCode;
    writeLifecycleMarker(
      store,
      "registered-normal-quit-observed.json",
      phaseRecord("normal-quit-observed", descriptor, store, { exitCode: effectiveExitCode }),
    );
  });
  process.argv.push("--aeb-native-preview-proof");
  require(path.join(CONTRACT.experimentRoot, "main.cjs"));
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    process.stderr.write(`${JSON.stringify({
      status: "failed_closed",
      issueCode: typeof error?.code === "string" ? error.code : "registered_fixture_bootstrap_failed"
    })}\n`);
    process.exitCode = 1;
  }
}

module.exports = { ARGUMENT_KEYS, loadDescriptor, main, parseArgs };
