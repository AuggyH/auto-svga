"use strict";

const crypto = require("node:crypto");
const childProcess = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");
const { types: utilTypes } = require("node:util");

const HELPER_PATH = path.join(__dirname, "registered-fixture-proof-evidence-store.py");
const PYTHON_PATH = "/usr/bin/python3";
const HELPER_SHA256 = "9315c2d7a8dcd1219572b6fac64a77aef5b822219b039ab683a451dbb753a1a8";

function fail(code) {
  const error = new Error(code);
  error.code = code;
  throw error;
}

function assertHelperIdentity() {
  const before = fs.lstatSync(HELPER_PATH);
  if (!before.isFile() || before.isSymbolicLink() || before.nlink !== 1 || fs.realpathSync(HELPER_PATH) !== HELPER_PATH) {
    fail("registered_fixture_evidence_helper_identity_invalid");
  }
  const bytes = fs.readFileSync(HELPER_PATH);
  const after = fs.lstatSync(HELPER_PATH);
  if (
    before.dev !== after.dev
    || before.ino !== after.ino
    || before.size !== after.size
    || after.nlink !== 1
    || crypto.createHash("sha256").update(bytes).digest("hex") !== HELPER_SHA256
  ) fail("registered_fixture_evidence_helper_hash_invalid");
}

function runHelper(args, { input, maxBuffer = 8 * 1024 * 1024 } = {}) {
  assertHelperIdentity();
  const result = childProcess.spawnSync(PYTHON_PATH, [HELPER_PATH, ...args], {
    encoding: input instanceof Uint8Array && typeof input !== "string" ? undefined : "utf8",
    input,
    maxBuffer,
    timeout: 10_000
  });
  if (!result || result.status !== 0 || result.signal) fail("registered_fixture_evidence_store_failed");
  const stdout = Buffer.isBuffer(result.stdout) ? result.stdout.toString("utf8") : String(result.stdout || "");
  const lines = stdout.trim().split(/\r?\n/u);
  if (lines.length !== 1) fail("registered_fixture_evidence_store_output_invalid");
  let parsed;
  try {
    parsed = JSON.parse(lines[0]);
  } catch {
    fail("registered_fixture_evidence_store_output_invalid");
  }
  if (!parsed || parsed.status !== "pass") fail("registered_fixture_evidence_store_rejected");
  return parsed;
}

function cloneOwnJsonRecord(value, depth = 0) {
  if (!value || typeof value !== "object" || Array.isArray(value) || utilTypes.isProxy(value) || depth > 4) {
    fail("registered_fixture_evidence_binding_invalid");
  }
  if (Object.getPrototypeOf(value) !== Object.prototype) fail("registered_fixture_evidence_binding_invalid");
  const keys = Reflect.ownKeys(value);
  if (keys.some((key) => typeof key !== "string")) fail("registered_fixture_evidence_binding_invalid");
  const descriptors = Object.getOwnPropertyDescriptors(value);
  const result = Object.create(null);
  for (const key of keys) {
    const descriptor = descriptors[key];
    if (!descriptor || !("value" in descriptor) || descriptor.get || descriptor.set || descriptor.enumerable !== true) {
      fail("registered_fixture_evidence_binding_invalid");
    }
    const nested = descriptor.value;
    if (nested && typeof nested === "object") {
      result[key] = cloneOwnJsonRecord(nested, depth + 1);
    } else if (nested === null || ["string", "number", "boolean"].includes(typeof nested)) {
      result[key] = nested;
    } else {
      fail("registered_fixture_evidence_binding_invalid");
    }
  }
  return result;
}

function bindingBase64(binding) {
  return Buffer.from(JSON.stringify(cloneOwnJsonRecord(binding)), "utf8").toString("base64url");
}

function recordIdentity(value) {
  if (!value || typeof value !== "object" || Array.isArray(value) || utilTypes.isProxy(value)) {
    fail("registered_fixture_evidence_record_identity_invalid");
  }
  const descriptors = Object.getOwnPropertyDescriptors(value);
  const result = Object.create(null);
  for (const key of ["byteLength", "sha256", "device", "inode"]) {
    const descriptor = descriptors[key];
    if (!descriptor || !("value" in descriptor) || descriptor.get || descriptor.set) {
      fail("registered_fixture_evidence_record_identity_invalid");
    }
    result[key] = descriptor.value;
  }
  if (
    !Number.isInteger(result.byteLength)
    || result.byteLength <= 0
    || !/^[a-f0-9]{64}$/u.test(result.sha256)
    || !Number.isInteger(result.device)
    || !Number.isInteger(result.inode)
  ) fail("registered_fixture_evidence_record_identity_invalid");
  return result;
}

function assertEvidenceRecordIdentity(expected, current) {
  const first = recordIdentity(expected);
  const second = recordIdentity(current);
  if (["byteLength", "sha256", "device", "inode"].some((key) => first[key] !== second[key])) {
    fail("registered_fixture_evidence_identity_changed");
  }
  return true;
}

function createEvidenceStore(outputRoot) {
  const result = runHelper(["--mode", "create", "--output-root", outputRoot]);
  return { outputRoot, binding: result.binding, bindingSha256: result.bindingSha256 };
}

function validateEvidenceStore(store) {
  return runHelper([
    "--mode", "load",
    "--output-root", store.outputRoot,
    "--binding-base64", bindingBase64(store.binding),
    "--binding-sha256", store.bindingSha256
  ]);
}

function writeJsonRecord(store, group, recordName, value) {
  return runHelper([
    "--mode", "write-json",
    "--output-root", store.outputRoot,
    "--binding-base64", bindingBase64(store.binding),
    "--binding-sha256", store.bindingSha256,
    "--group", group,
    "--record-name", recordName
  ], { input: `${JSON.stringify(value)}\n` });
}

function writeBytesRecord(store, group, recordName, bytes) {
  if (!Buffer.isBuffer(bytes) || utilTypes.isProxy(bytes)) fail("registered_fixture_evidence_bytes_invalid");
  return runHelper([
    "--mode", "write-bytes",
    "--output-root", store.outputRoot,
    "--binding-base64", bindingBase64(store.binding),
    "--binding-sha256", store.bindingSha256,
    "--group", group,
    "--record-name", recordName
  ], { input: bytes, maxBuffer: 64 * 1024 * 1024 });
}

function readJsonRecord(store, group, recordName) {
  return runHelper([
    "--mode", "read-json",
    "--output-root", store.outputRoot,
    "--binding-base64", bindingBase64(store.binding),
    "--binding-sha256", store.bindingSha256,
    "--group", group,
    "--record-name", recordName
  ]);
}

function readBytesMetadata(store, group, recordName) {
  return runHelper([
    "--mode", "read-bytes",
    "--output-root", store.outputRoot,
    "--binding-base64", bindingBase64(store.binding),
    "--binding-sha256", store.bindingSha256,
    "--group", group,
    "--record-name", recordName
  ]);
}

function inspectRuntimeState(store) {
  const result = runHelper([
    "--mode", "inspect-runtime-state",
    "--output-root", store.outputRoot,
    "--binding-base64", bindingBase64(store.binding),
    "--binding-sha256", store.bindingSha256,
  ]);
  if (!Number.isInteger(result.runtimeStateEntryCount) || result.runtimeStateEntryCount < 0) {
    fail("registered_fixture_runtime_state_inspection_invalid");
  }
  return Object.freeze({ runtimeStateEntryCount: result.runtimeStateEntryCount });
}

function clearRuntimeState(store) {
  const result = runHelper([
    "--mode", "clear-runtime-state",
    "--output-root", store.outputRoot,
    "--binding-base64", bindingBase64(store.binding),
    "--binding-sha256", store.bindingSha256,
  ]);
  if (
    !Number.isInteger(result.removedEntryCount)
    || result.removedEntryCount < 0
    || result.remainingEntryCount !== 0
  ) fail("registered_fixture_runtime_state_cleanup_invalid");
  return Object.freeze({
    removedEntryCount: result.removedEntryCount,
    remainingEntryCount: result.remainingEntryCount,
  });
}

function assertRuntimeStateResidueAbsent(store) {
  const result = inspectRuntimeState(store);
  if (result.runtimeStateEntryCount !== 0) fail("registered_fixture_filesystem_residue_present");
  return Object.freeze({
    filesystemRuntimeStateResidueObserved: false,
    runtimeStateEntryCount: 0,
  });
}

module.exports = {
  HELPER_PATH,
  HELPER_SHA256,
  assertEvidenceRecordIdentity,
  assertRuntimeStateResidueAbsent,
  clearRuntimeState,
  createEvidenceStore,
  inspectRuntimeState,
  readBytesMetadata,
  readJsonRecord,
  validateEvidenceStore,
  writeBytesRecord,
  writeJsonRecord
};
