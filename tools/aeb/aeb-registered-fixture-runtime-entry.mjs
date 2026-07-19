#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { types as utilTypes } from "node:util";
import { decode, encode } from "fast-png";

import {
  CONTRACT as D001_CONTRACT,
  authorityPaths,
  verifyGitBinding,
} from "./run-registered-electron-bootstrap-discriminator.mjs";
import {
  canonicalD001LifecycleBytes,
  parseD001Lifecycle,
} from "./run-registered-fixture-product-proof-orchestrator.mjs";

const require = createRequire(import.meta.url);
const {
  CONTRACT: PROOF_CONTRACT,
  canonicalDescriptorBytes,
  descriptorSha256,
  readOwnDataRecord,
  validateDescriptor,
} = require("./aeb-registered-fixture-proof-contract.cjs");
const {
  HANDOFF_SCHEMA,
  prepareAePackageHandoff,
  snapshotAePackageTree,
} = require("./aeb-ae-package-handoff.cjs");

const SCRIPT_PATH = fileURLToPath(import.meta.url);
const SCRIPT_ROOT = path.dirname(SCRIPT_PATH);
const ORCHESTRATOR_PATH = path.join(SCRIPT_ROOT, "run-registered-fixture-product-proof-orchestrator.mjs");
const REQUEST_LIFETIME_MS = 9 * 60 * 1000;
const MAX_BOUND_MATERIAL_BYTES = 5 * 1024 * 1024;

export const ENTRY_CONTRACT = Object.freeze({
  requestSchema: "auto-svga-aeb-registered-fixture-request-input-v1",
  requestPublicationSchema: "auto-svga-aeb-registered-fixture-request-publication-v2",
  requestPublicationResultSchema: "auto-svga-aeb-registered-fixture-request-publication-result-v2",
  requestRetireInputSchema: "auto-svga-aeb-registered-fixture-publication-retire-input-v1",
  requestRetiredSchema: "auto-svga-aeb-registered-fixture-request-retired-v1",
  entrySchema: "auto-svga-aeb-registered-fixture-runtime-entry-input-v1",
  inspectSchema: "auto-svga-aeb-registered-fixture-runtime-entry-inspect-v1",
  preparedSchema: "auto-svga-aeb-registered-fixture-runtime-entry-prepared-v1",
  requestMaterialSchema: "aeb-panel-semantic-request-v1",
  requestAction: "prepare-task-owned-fixture-and-export-native-subset-metadata",
  requestSourceIdentity: "aeb-panel-semantic-execution-bridge-v0",
  packetBaseHead: "bc4a46e65d74ad8e57eb85093493dbeabdc396f1",
  sourceBranch: D001_CONTRACT.branch,
  d001SourceHead: D001_CONTRACT.sourceHead,
  expectedGeneratedSvgaSha256: "b65e06e931c30543c85d4fa030fddbee4b74f77f8f4315ff734e118851077fea",
  expectedGeneratedSvgaBytes: 831,
  requestLifetimeMs: REQUEST_LIFETIME_MS,
  inboxRoot: path.join(PROOF_CONTRACT.aeDevRoot, "semantic-inbox-ae26"),
});

const OWNER_COMPATIBILITY_ORACLE = Object.freeze({
  schema: "auto-svga-aeb-owner-model-product-oracle-v1",
  nativeCount: 1,
  bakeRequiredCount: 0,
  blockedCount: 0,
  suggestionOnlyCount: 0,
  outputAllowed: true,
  readOnly: true,
  resourceAuthorityExact: true,
  layerAuthorityExact: true,
  saveExportSupported: true,
});

export const REQUEST_INPUT_KEYS = Object.freeze([
  "permitId",
  "requestCreatedAtEpochMs",
  "requestExpiresAtEpochMs",
  "requestId",
  "schema",
  "sourceHead",
  "sourcePackageRoot",
]);

export const ENTRY_INPUT_KEYS = Object.freeze([
  "d001ExecutionId",
  "d001OutputRoot",
  "executionId",
  "outputRoot",
  "packageRoot",
  "permitId",
  "preflightRelayPath",
  "preflightRelaySha256",
  "prelaunchAuthorityPath",
  "prelaunchAuthoritySha256",
  "requestCreatedAtEpochMs",
  "requestExpiresAtEpochMs",
  "requestId",
  "requestPublicationPath",
  "requestPublicationSha256",
  "requestSha256",
  "schema",
  "sourceHead",
  "sourcePackageRoot",
]);

export const RETIRE_INPUT_KEYS = Object.freeze([
  "permitId",
  "reasonCode",
  "recordedAtEpochMs",
  "requestId",
  "requestPublicationPath",
  "requestPublicationSha256",
  "schema",
  "sourceHead",
]);

export const CLI_KEYS = Object.freeze(["mode", "input-base64", "input-sha256"]);
const DIRECTORY_IDENTITY_KEYS = Object.freeze(["dev", "ino", "mode", "path", "type", "uid"]);
const FILE_IDENTITY_KEYS = Object.freeze(["dev", "ino", "mode", "nlink", "path", "sha256", "sizeBytes", "type", "uid"]);
const REQUEST_PUBLICATION_KEYS = Object.freeze([
  "directories",
  "files",
  "fixtureBytes",
  "fixtureSha256",
  "mutationPerformed",
  "permitId",
  "publicationPath",
  "requestBytes",
  "requestCreatedAtEpochMs",
  "requestExpiresAtEpochMs",
  "requestId",
  "requestPath",
  "requestSha256",
  "schema",
  "sourceHead",
  "sourcePackageRoot",
]);
const REQUEST_PUBLICATION_DIRECTORY_KEYS = Object.freeze(["assetsRoot", "devRoot", "inboxRoot", "runRoot", "sourcePackageRoot"]);
const REQUEST_PUBLICATION_FILE_KEYS = Object.freeze(["fixture", "request"]);
const REQUEST_RETIRED_KEYS = Object.freeze([
  "mutationPerformed",
  "permitId",
  "reasonCode",
  "recordedAtEpochMs",
  "requestId",
  "requestPublicationPath",
  "requestPublicationSha256",
  "requestSha256",
  "schema",
  "sourceHead",
  "sourcePackageRoot",
]);

const FIXTURE_WIDTH = 120;
const FIXTURE_HEIGHT = 80;
const FIXTURE_BYTES = buildFixtureBytes();
const FIXTURE_SHA256 = sha256(FIXTURE_BYTES);
const decodedFixture = decode(FIXTURE_BYTES, { checkCrc: true });
if (
  FIXTURE_SHA256 !== PROOF_CONTRACT.fixtureSha256
  || FIXTURE_BYTES.byteLength !== PROOF_CONTRACT.fixtureBytes
  || decodedFixture.width !== FIXTURE_WIDTH
  || decodedFixture.height !== FIXTURE_HEIGHT
  || decodedFixture.depth !== 8
  || decodedFixture.channels !== 4
) {
  throw codedError("registered_fixture_runtime_entry_fixture_identity_invalid");
}

function codedError(code) {
  const error = new Error(code);
  error.code = code;
  return error;
}

function reject(code) {
  throw codedError(code);
}

function readOwnRecord(value, expectedKeys, purpose, { allowObjectKeys = new Set() } = {}) {
  if (!value || typeof value !== "object" || Array.isArray(value) || utilTypes.isProxy(value)) {
    reject(`registered_fixture_${purpose}_record_invalid`);
  }
  if (Object.getPrototypeOf(value) !== Object.prototype) reject(`registered_fixture_${purpose}_prototype_invalid`);
  const ownKeys = Reflect.ownKeys(value);
  if (ownKeys.some((key) => typeof key !== "string")) reject(`registered_fixture_${purpose}_fields_invalid`);
  const actualKeys = ownKeys.slice().sort();
  const requiredKeys = [...expectedKeys].sort();
  if (actualKeys.length !== requiredKeys.length || actualKeys.some((key, index) => key !== requiredKeys[index])) {
    reject(`registered_fixture_${purpose}_fields_invalid`);
  }
  const descriptors = Object.getOwnPropertyDescriptors(value);
  const result = Object.create(null);
  for (const key of expectedKeys) {
    const descriptor = descriptors[key];
    if (
      !descriptor
      || !("value" in descriptor)
      || descriptor.get
      || descriptor.set
      || descriptor.enumerable !== true
    ) reject(`registered_fixture_${purpose}_accessor_invalid`);
    const item = descriptor.value;
    if (
      item !== null
      && !["string", "number", "boolean"].includes(typeof item)
      && !(allowObjectKeys.has(key) && typeof item === "object" && !Array.isArray(item))
    ) reject(`registered_fixture_${purpose}_primitive_invalid`);
    result[key] = item;
  }
  return result;
}

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function stableJson(value) {
  if (Array.isArray(value)) return value.map(stableJson);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stableJson(value[key])]));
  }
  return value;
}

export function canonicalJsonBytes(value) {
  return Buffer.from(`${JSON.stringify(stableJson(value), null, 2)}\n`, "utf8");
}

function buildFixtureBytes() {
  const pixels = new Uint8Array(FIXTURE_WIDTH * FIXTURE_HEIGHT * 4);
  for (let y = 0; y < FIXTURE_HEIGHT; y += 1) {
    for (let x = 0; x < FIXTURE_WIDTH; x += 1) {
      const offset = (y * FIXTURE_WIDTH + x) * 4;
      const light = (Math.floor(x / 12) + Math.floor(y / 10)) % 2 === 0;
      pixels[offset] = light ? 36 : 18;
      pixels[offset + 1] = light ? 146 : 92;
      pixels[offset + 2] = light ? 255 : 204;
      pixels[offset + 3] = 255;
    }
  }
  return Buffer.from(encode({
    width: FIXTURE_WIDTH,
    height: FIXTURE_HEIGHT,
    data: pixels,
    depth: 8,
    channels: 4,
  }));
}

function requireString(value, code) {
  if (typeof value !== "string" || value.length === 0 || value.includes("\0")) reject(code);
  return value;
}

function requireSha256(value, code) {
  if (typeof value !== "string" || !/^[a-f0-9]{64}$/u.test(value)) reject(code);
  return value;
}

function requireSafeInteger(value, code) {
  if (!Number.isSafeInteger(value) || value <= 0) reject(code);
  return value;
}

function pathIsInside(child, root) {
  const relative = path.relative(root, child);
  return relative !== "" && !relative.startsWith("..") && !path.isAbsolute(relative);
}

function directChild(value, root, code) {
  const resolved = path.resolve(requireString(value, code));
  if (path.dirname(resolved) !== root || !/^[A-Za-z0-9._-]{1,120}$/u.test(path.basename(resolved))) reject(code);
  return resolved;
}

function expectedSourcePackageRoot(requestId, devRoot) {
  return path.join(devRoot, requestId, "ae-export-package");
}

function validateCommonRequestFields(record, roots) {
  if (!/^ASV-APR-\d{8}-\d{3}$/u.test(record.permitId)) reject("registered_fixture_runtime_entry_permit_invalid");
  if (!/^aeb-semantic-[a-z0-9][a-z0-9-]{7,79}$/u.test(record.requestId)) {
    reject("registered_fixture_runtime_entry_request_id_invalid");
  }
  if (!/^[a-f0-9]{40}$/u.test(record.sourceHead)) reject("registered_fixture_runtime_entry_source_head_invalid");
  const createdAt = requireSafeInteger(record.requestCreatedAtEpochMs, "registered_fixture_runtime_entry_request_time_invalid");
  const expiresAt = requireSafeInteger(record.requestExpiresAtEpochMs, "registered_fixture_runtime_entry_request_time_invalid");
  if (expiresAt - createdAt !== REQUEST_LIFETIME_MS) reject("registered_fixture_runtime_entry_request_lifetime_invalid");
  const sourcePackageRoot = path.resolve(requireString(
    record.sourcePackageRoot,
    "registered_fixture_runtime_entry_source_package_invalid",
  ));
  if (
    sourcePackageRoot !== expectedSourcePackageRoot(record.requestId, roots.devRoot)
    || !pathIsInside(sourcePackageRoot, roots.devRoot)
  ) reject("registered_fixture_runtime_entry_source_package_invalid");
  return {
    ...record,
    sourcePackageRoot,
    requestCreatedAtEpochMs: createdAt,
    requestExpiresAtEpochMs: expiresAt,
  };
}

function rootContract(options = {}) {
  const devRoot = path.resolve(options.devRoot ?? PROOF_CONTRACT.aeDevRoot);
  const taskRoot = path.resolve(options.taskRoot ?? PROOF_CONTRACT.taskRoot);
  const processAuthorityBaseRoot = path.resolve(
    options.processAuthorityBaseRoot ?? D001_CONTRACT.processAuthorityBaseRoot,
  );
  if (
    options.allowTestRoots !== true
    && (
      devRoot !== PROOF_CONTRACT.aeDevRoot
      || taskRoot !== PROOF_CONTRACT.taskRoot
      || processAuthorityBaseRoot !== D001_CONTRACT.processAuthorityBaseRoot
    )
  ) reject("registered_fixture_runtime_entry_root_override_forbidden");
  if (path.dirname(processAuthorityBaseRoot) !== taskRoot || path.basename(processAuthorityBaseRoot) !== "process-authority") {
    reject("registered_fixture_runtime_entry_process_authority_root_invalid");
  }
  return { devRoot, taskRoot, processAuthorityBaseRoot };
}

function inboxRootFor(options, roots) {
  const inboxRoot = path.resolve(options.inboxRoot ?? ENTRY_CONTRACT.inboxRoot);
  if (path.dirname(inboxRoot) !== roots.devRoot || path.basename(inboxRoot) !== "semantic-inbox-ae26") {
    reject("registered_fixture_runtime_entry_inbox_invalid");
  }
  return inboxRoot;
}

function requestPublicationPathFor(requestId, inboxRoot) {
  return path.join(inboxRoot, `publication-${requestId}.json`);
}

function consumedRequestPathFor(requestId, inboxRoot) {
  return path.join(inboxRoot, `consumed-${requestId}.json`);
}

function consumedFailedRequestPathFor(requestId, inboxRoot) {
  return path.join(inboxRoot, `consumed-failed-${requestId}.json`);
}

function retiredRequestPathFor(requestId, inboxRoot) {
  return path.join(inboxRoot, `retired-${requestId}.json`);
}

function publicationResidueFileState(filePath, code) {
  try {
    const stat = fs.lstatSync(filePath);
    if (stat.isFile() && !stat.isSymbolicLink() && stat.nlink === 1) return "file";
    reject(code);
  } catch (error) {
    if (error?.code === "ENOENT") return "missing";
    throw error;
  }
}

function parseCanonicalBoundFile(filePath, maxBytes, code) {
  const read = readBoundedRegularFile(filePath, maxBytes);
  const value = parseJsonBytes(read.bytes, code);
  if (!canonicalJsonBytes(value).equals(read.bytes)) reject(code);
  return { read, value };
}

function assertRetiredMarkerForPublication({
  markerPath,
  publication,
  publicationPath,
  publicationSha256,
  code = "registered_fixture_runtime_entry_inbox_residue_invalid",
}) {
  if (publicationResidueFileState(markerPath, code) !== "file") return false;
  const { value } = parseCanonicalBoundFile(markerPath, 64 * 1024, code);
  const record = readOwnRecord(value, REQUEST_RETIRED_KEYS, "runtime_entry_retired_publication");
  if (
    record.schema !== ENTRY_CONTRACT.requestRetiredSchema
    || record.permitId !== publication.permitId
    || record.requestId !== publication.requestId
    || record.sourceHead !== publication.sourceHead
    || record.requestPublicationPath !== publicationPath
    || record.requestPublicationSha256 !== publicationSha256
    || record.requestSha256 !== publication.requestSha256
    || record.sourcePackageRoot !== publication.sourcePackageRoot
    || record.reasonCode !== "ae_host_crash_or_request_marker_lost"
    || !Number.isSafeInteger(record.recordedAtEpochMs)
    || record.recordedAtEpochMs < publication.requestCreatedAtEpochMs
    || record.mutationPerformed !== true
  ) reject(code);
  return true;
}

function assertNoAmbiguousPublicationResidue(inboxRoot) {
  let names;
  try {
    names = fs.readdirSync(inboxRoot);
  } catch (error) {
    if (error?.code === "ENOENT") return;
    throw error;
  }
  const requestPath = path.join(inboxRoot, "request.json");
  if (publicationResidueFileState(requestPath, "registered_fixture_runtime_entry_inbox_residue_invalid") === "file") {
    return;
  }
  for (const name of names) {
    const match = /^publication-(aeb-semantic-[A-Za-z0-9][A-Za-z0-9._-]{0,79})\.json$/u.exec(name);
    if (!match) continue;
    const publicationPath = path.join(inboxRoot, name);
    const { read: publicationRead, value: publicationValue } = parseCanonicalBoundFile(
      publicationPath,
      256 * 1024,
      "registered_fixture_runtime_entry_inbox_residue_invalid",
    );
    if (
      !publicationValue
      || Object.getPrototypeOf(publicationValue) !== Object.prototype
      || publicationValue.schema !== ENTRY_CONTRACT.requestPublicationSchema
      || publicationValue.requestId !== match[1]
      || publicationValue.publicationPath !== publicationPath
      || typeof publicationValue.sourcePackageRoot !== "string"
    ) reject("registered_fixture_runtime_entry_inbox_residue_invalid");
    const consumedState = publicationResidueFileState(
      consumedRequestPathFor(match[1], inboxRoot),
      "registered_fixture_runtime_entry_inbox_residue_invalid",
    );
    const consumedFailedState = publicationResidueFileState(
      consumedFailedRequestPathFor(match[1], inboxRoot),
      "registered_fixture_runtime_entry_inbox_residue_invalid",
    );
    const finalizedState = publicationResidueFileState(
      path.join(publicationValue.sourcePackageRoot, "ae-export-package.finalized.json"),
      "registered_fixture_runtime_entry_inbox_residue_invalid",
    );
    if (consumedState === "file") {
      if (consumedFailedState === "file" || finalizedState !== "file") {
        reject("registered_fixture_runtime_entry_inbox_residue_invalid");
      }
      continue;
    }
    if (consumedFailedState === "file") {
      if (finalizedState === "file") reject("registered_fixture_runtime_entry_inbox_residue_invalid");
      continue;
    }
    if (finalizedState === "file") reject("registered_fixture_runtime_entry_inbox_residue_invalid");
    if (assertRetiredMarkerForPublication({
      markerPath: retiredRequestPathFor(match[1], inboxRoot),
      publication: publicationValue,
      publicationPath,
      publicationSha256: publicationRead.sha256,
    })) continue;
    reject("registered_fixture_runtime_entry_publication_unconsumed_ambiguous");
  }
}

export function validateRequestInput(value, options = {}) {
  const roots = rootContract(options);
  const record = readOwnDataRecord(value, REQUEST_INPUT_KEYS, "runtime_entry_request");
  if (record.schema !== ENTRY_CONTRACT.requestSchema) reject("registered_fixture_runtime_entry_request_schema_invalid");
  return Object.freeze(validateCommonRequestFields(record, roots));
}

export function validateRetireInput(value, options = {}) {
  const roots = rootContract(options);
  const record = readOwnDataRecord(value, RETIRE_INPUT_KEYS, "runtime_entry_retire");
  if (record.schema !== ENTRY_CONTRACT.requestRetireInputSchema) {
    reject("registered_fixture_runtime_entry_retire_schema_invalid");
  }
  if (!/^ASV-APR-\d{8}-\d{3}$/u.test(record.permitId)) reject("registered_fixture_runtime_entry_retire_permit_invalid");
  if (!/^aeb-semantic-[a-z0-9][a-z0-9-]{7,79}$/u.test(record.requestId)) {
    reject("registered_fixture_runtime_entry_retire_request_id_invalid");
  }
  if (!/^[a-f0-9]{40}$/u.test(record.sourceHead)) reject("registered_fixture_runtime_entry_retire_source_head_invalid");
  if (record.reasonCode !== "ae_host_crash_or_request_marker_lost") {
    reject("registered_fixture_runtime_entry_retire_reason_invalid");
  }
  const recordedAtEpochMs = requireSafeInteger(
    record.recordedAtEpochMs,
    "registered_fixture_runtime_entry_retire_time_invalid",
  );
  const inboxRoot = inboxRootFor(options, roots);
  const requestPublicationPath = path.resolve(requireString(
    record.requestPublicationPath,
    "registered_fixture_runtime_entry_retire_publication_invalid",
  ));
  if (requestPublicationPath !== requestPublicationPathFor(record.requestId, inboxRoot)) {
    reject("registered_fixture_runtime_entry_retire_publication_invalid");
  }
  return Object.freeze({
    schema: record.schema,
    permitId: record.permitId,
    reasonCode: record.reasonCode,
    recordedAtEpochMs,
    requestId: record.requestId,
    requestPublicationPath,
    requestPublicationSha256: requireSha256(
      record.requestPublicationSha256,
      "registered_fixture_runtime_entry_retire_publication_hash_invalid",
    ),
    sourceHead: record.sourceHead,
  });
}

function fixtureSpec() {
  return {
    assetId: "asset-task-fixture-0001",
    layerId: "layer-task-fixture-0001",
    packagePath: "assets/layer-0001.png",
    width: FIXTURE_WIDTH,
    height: FIXTURE_HEIGHT,
    anchor: { x: 60, y: 40 },
    transform: {
      x: 150,
      y: 150,
      scaleX: 1,
      scaleY: 1,
      rotation: 0,
      opacity: 1,
    },
    keyframes: [
      { frame: 0, x: 150, y: 150, scaleX: 1, scaleY: 1, rotation: 0, opacity: 1 },
      { frame: 119, x: 170, y: 150, scaleX: 1, scaleY: 1, rotation: 0, opacity: 1 },
    ],
  };
}

export function buildFixtureRequestMaterial(value, options = {}) {
  const input = validateRequestInput(value, options);
  const request = {
    schemaVersion: ENTRY_CONTRACT.requestMaterialSchema,
    action: ENTRY_CONTRACT.requestAction,
    permitId: input.permitId,
    requestId: input.requestId,
    sourceHead: input.sourceHead,
    oneTimeState: "pending",
    executionState: "not_executed",
    sourceIdentity: ENTRY_CONTRACT.requestSourceIdentity,
    panelIdentity: {
      bundleId: "local.auto-svga.aeb.panel.ae26.dev",
      extensionId: "local.auto-svga.aeb.panel.ae26.dev.export",
      version: "0.3.0",
    },
    targetHost: {
      appId: "AEFT",
      versionMajor: 26,
      versionMinor: 3,
      versionRule: "app.version.leading_major_minor",
    },
    createdAtEpochMs: input.requestCreatedAtEpochMs,
    expiresAtEpochMs: input.requestExpiresAtEpochMs,
    outputRoot: input.sourcePackageRoot,
    boundaries: {
      sourceProjectMutationAllowed: false,
      saveOrOverwriteAllowed: false,
      renderOrBakeAllowed: false,
      relinkOrCollectAllowed: false,
      encoderAllowed: false,
      networkOrCloudAllowed: false,
      targetSupportClaimAllowed: false,
      visualOrExportSuccessClaimAllowed: false,
    },
    assetFixture: fixtureSpec(),
  };
  const requestBytes = canonicalJsonBytes(request);
  if (requestBytes.byteLength > 64 * 1024) reject("registered_fixture_runtime_entry_request_oversized");
  return Object.freeze({
    schema: "auto-svga-aeb-registered-fixture-request-material-v1",
    sourceHead: input.sourceHead,
    sourceBranch: ENTRY_CONTRACT.sourceBranch,
    packetBaseHead: ENTRY_CONTRACT.packetBaseHead,
    permitId: input.permitId,
    requestId: input.requestId,
    sourcePackageRoot: input.sourcePackageRoot,
    requestPath: path.join(ENTRY_CONTRACT.inboxRoot, "request.json"),
    requestSha256: sha256(requestBytes),
    requestBytes: requestBytes.byteLength,
    requestBase64url: requestBytes.toString("base64url"),
    fixturePath: path.join(input.sourcePackageRoot, "assets", "layer-0001.png"),
    fixtureSha256: FIXTURE_SHA256,
    fixtureBytes: FIXTURE_BYTES.byteLength,
    fixtureBase64url: FIXTURE_BYTES.toString("base64url"),
    request,
  });
}

function captureDirectoryIdentity(directory, code) {
  const canonical = path.resolve(directory);
  const stat = fs.lstatSync(canonical);
  if (!stat.isDirectory() || stat.isSymbolicLink() || fs.realpathSync(canonical) !== canonical) reject(code);
  const currentUid = typeof process.getuid === "function" ? process.getuid() : null;
  if (currentUid === null || stat.uid !== currentUid || (stat.mode & 0o777) !== 0o700) reject(code);
  return { type: "directory", path: canonical, dev: stat.dev, ino: stat.ino, uid: stat.uid, mode: stat.mode & 0o777 };
}

function assertDirectoryIdentity(identity, code) {
  const current = captureDirectoryIdentity(identity.path, code);
  if (
    current.dev !== identity.dev
    || current.ino !== identity.ino
    || current.uid !== identity.uid
    || current.mode !== identity.mode
  ) reject(code);
}

function captureRegularFileIdentity(filePath, maxBytes, code) {
  const material = readBoundedRegularFile(filePath, maxBytes);
  const currentUid = typeof process.getuid === "function" ? process.getuid() : null;
  if (currentUid === null || material.uid !== currentUid || material.nlink !== 1) reject(code);
  return {
    type: "file",
    path: material.path,
    dev: material.dev,
    ino: material.ino,
    uid: material.uid,
    mode: material.mode,
    nlink: material.nlink,
    sizeBytes: material.sizeBytes,
    sha256: material.sha256,
  };
}

function assertAbsent(targetPath, code) {
  try {
    fs.lstatSync(targetPath);
    reject(code);
  } catch (error) {
    if (error?.code === "ENOENT") return;
    throw error;
  }
}

function writeBoundFile(targetPath, bytes, mode) {
  const descriptor = fs.openSync(targetPath, fs.constants.O_WRONLY | fs.constants.O_CREAT | fs.constants.O_EXCL, mode);
  try {
    fs.writeFileSync(descriptor, bytes);
    fs.fsyncSync(descriptor);
    const opened = fs.fstatSync(descriptor);
    if (!opened.isFile() || opened.nlink !== 1 || opened.size !== bytes.byteLength) {
      reject("registered_fixture_runtime_entry_publication_invalid");
    }
  } finally {
    fs.closeSync(descriptor);
  }
  const current = fs.lstatSync(targetPath);
  if (!current.isFile() || current.isSymbolicLink() || current.nlink !== 1 || fs.realpathSync(targetPath) !== targetPath) {
    reject("registered_fixture_runtime_entry_publication_invalid");
  }
}

function buildRequestPublication({
  input,
  material,
  roots,
  inboxRoot,
  runRoot,
  requestPath,
  publicationPath,
  fixturePath,
}) {
  const sourcePackageRoot = input.sourcePackageRoot;
  const assetsRoot = path.join(sourcePackageRoot, "assets");
  return Object.freeze({
    schema: ENTRY_CONTRACT.requestPublicationSchema,
    permitId: input.permitId,
    requestId: input.requestId,
    sourceHead: input.sourceHead,
    requestCreatedAtEpochMs: input.requestCreatedAtEpochMs,
    requestExpiresAtEpochMs: input.requestExpiresAtEpochMs,
    requestPath,
    requestSha256: material.requestSha256,
    requestBytes: material.requestBytes,
    publicationPath,
    sourcePackageRoot,
    fixtureSha256: material.fixtureSha256,
    fixtureBytes: material.fixtureBytes,
    directories: {
      devRoot: captureDirectoryIdentity(roots.devRoot, "registered_fixture_runtime_entry_dev_root_changed"),
      inboxRoot: captureDirectoryIdentity(inboxRoot, "registered_fixture_runtime_entry_inbox_changed"),
      runRoot: captureDirectoryIdentity(runRoot, "registered_fixture_runtime_entry_run_root_changed"),
      sourcePackageRoot: captureDirectoryIdentity(sourcePackageRoot, "registered_fixture_runtime_entry_source_package_changed"),
      assetsRoot: captureDirectoryIdentity(assetsRoot, "registered_fixture_runtime_entry_assets_changed"),
    },
    files: {
      request: captureRegularFileIdentity(requestPath, 64 * 1024, "registered_fixture_runtime_entry_request_publication_mismatch"),
      fixture: captureRegularFileIdentity(fixturePath, PROOF_CONTRACT.fixtureBytes, "registered_fixture_runtime_entry_fixture_publication_mismatch"),
    },
    mutationPerformed: true,
  });
}

export function materializeFixtureRequest(value, dependencies = {}) {
  const roots = rootContract(dependencies);
  const input = validateRequestInput(value, { ...roots, allowTestRoots: dependencies.allowTestRoots === true });
  const material = buildFixtureRequestMaterial(input, { ...roots, allowTestRoots: dependencies.allowTestRoots === true });
  verifyRuntimeSource(input.sourceHead, dependencies);
  const nowMs = (dependencies.now ?? Date.now)();
  if (nowMs < input.requestCreatedAtEpochMs || nowMs >= input.requestExpiresAtEpochMs) {
    reject("registered_fixture_runtime_entry_request_stale");
  }

  const inboxRoot = inboxRootFor(dependencies, roots);
  const devIdentity = captureDirectoryIdentity(roots.devRoot, "registered_fixture_runtime_entry_dev_root_invalid");
  let inboxCreated = false;
  if (!fs.existsSync(inboxRoot)) {
    fs.mkdirSync(inboxRoot, { mode: 0o700 });
    inboxCreated = true;
  }
  const inboxIdentity = captureDirectoryIdentity(inboxRoot, "registered_fixture_runtime_entry_inbox_invalid");
  assertNoAmbiguousPublicationResidue(inboxRoot);
  const runRoot = path.dirname(input.sourcePackageRoot);
  const requestPath = path.join(inboxRoot, "request.json");
  const publicationPath = requestPublicationPathFor(input.requestId, inboxRoot);
  const replayPaths = [
    requestPath,
    publicationPath,
    path.join(inboxRoot, `consumed-${input.requestId}.json`),
    path.join(inboxRoot, `consumed-failed-${input.requestId}.json`),
  ];
  for (const candidate of [runRoot, ...replayPaths]) {
    assertAbsent(candidate, "registered_fixture_runtime_entry_replay_or_stale_path");
  }

  let runCreated = false;
  let requestCreated = false;
  let publicationCreated = false;
  try {
    fs.mkdirSync(runRoot, { mode: 0o700 });
    runCreated = true;
    fs.mkdirSync(input.sourcePackageRoot, { mode: 0o700 });
    fs.mkdirSync(path.join(input.sourcePackageRoot, "assets"), { mode: 0o700 });
    const fixturePath = path.join(input.sourcePackageRoot, "assets", "layer-0001.png");
    writeBoundFile(fixturePath, FIXTURE_BYTES, 0o600);
    if (typeof dependencies.afterFixtureWrite === "function") dependencies.afterFixtureWrite({ fixturePath });
    assertDirectoryIdentity(devIdentity, "registered_fixture_runtime_entry_dev_root_changed");
    assertDirectoryIdentity(inboxIdentity, "registered_fixture_runtime_entry_inbox_changed");
    const requestBytes = Buffer.from(material.requestBase64url, "base64url");
    writeBoundFile(requestPath, requestBytes, 0o600);
    requestCreated = true;
    if (typeof dependencies.afterRequestWrite === "function") dependencies.afterRequestWrite({ requestPath });
    assertDirectoryIdentity(devIdentity, "registered_fixture_runtime_entry_dev_root_changed");
    assertDirectoryIdentity(inboxIdentity, "registered_fixture_runtime_entry_inbox_changed");
    if (readBoundedRegularFile(fixturePath, PROOF_CONTRACT.fixtureBytes).sha256 !== FIXTURE_SHA256) {
      reject("registered_fixture_runtime_entry_fixture_publication_mismatch");
    }
    if (readBoundedRegularFile(requestPath, 64 * 1024).sha256 !== material.requestSha256) {
      reject("registered_fixture_runtime_entry_request_publication_mismatch");
    }
    const publication = buildRequestPublication({
      input,
      material,
      roots,
      inboxRoot,
      runRoot,
      requestPath,
      publicationPath,
      fixturePath,
    });
    const publicationBytes = canonicalJsonBytes(publication);
    writeBoundFile(publicationPath, publicationBytes, 0o600);
    publicationCreated = true;
    const publicationRead = readBoundedRegularFile(publicationPath, 256 * 1024);
    if (publicationRead.sha256 !== sha256(publicationBytes)) {
      reject("registered_fixture_runtime_entry_publication_invalid");
    }
    return Object.freeze({
      schema: ENTRY_CONTRACT.requestPublicationResultSchema,
      requestSha256: material.requestSha256,
      fixtureSha256: material.fixtureSha256,
      requestId: input.requestId,
      sourceHead: input.sourceHead,
      requestPath,
      requestPublicationPath: publicationPath,
      requestPublicationSha256: publicationRead.sha256,
      requestPublication: publication,
      mutationPerformed: true,
    });
  } catch (error) {
    if (!publicationCreated) {
      try {
        const partialPublication = fs.lstatSync(publicationPath);
        if (partialPublication.isFile() && !partialPublication.isSymbolicLink()) publicationCreated = true;
      } catch {
        // No publication was created; the original failure remains authoritative.
      }
    }
    if (publicationCreated) fs.rmSync(publicationPath, { force: true });
    if (requestCreated) fs.rmSync(requestPath, { force: true });
    if (runCreated) fs.rmSync(runRoot, { recursive: true, force: true });
    if (inboxCreated) {
      try {
        if (fs.readdirSync(inboxRoot).length === 0) fs.rmdirSync(inboxRoot);
      } catch {
        // The original failure remains authoritative; no external cleanup is attempted.
      }
    }
    throw error;
  }
}

export function retireAmbiguousRequestPublication(value, dependencies = {}) {
  const roots = rootContract(dependencies);
  const input = validateRetireInput(value, { ...dependencies, allowTestRoots: dependencies.allowTestRoots === true });
  const inboxRoot = inboxRootFor(dependencies, roots);
  const markerPath = retiredRequestPathFor(input.requestId, inboxRoot);
  const { read: publicationRead, value: publication } = parseCanonicalBoundFile(
    input.requestPublicationPath,
    256 * 1024,
    "registered_fixture_runtime_entry_retire_publication_invalid",
  );
  if (publicationRead.sha256 !== input.requestPublicationSha256) {
    reject("registered_fixture_runtime_entry_retire_publication_hash_mismatch");
  }
  if (
    !publication
    || Object.getPrototypeOf(publication) !== Object.prototype
    || publication.schema !== ENTRY_CONTRACT.requestPublicationSchema
    || publication.permitId !== input.permitId
    || publication.requestId !== input.requestId
    || publication.sourceHead !== input.sourceHead
    || publication.publicationPath !== input.requestPublicationPath
    || typeof publication.sourcePackageRoot !== "string"
    || !/^[a-f0-9]{64}$/u.test(publication.requestSha256 ?? "")
    || !Number.isSafeInteger(publication.requestCreatedAtEpochMs)
    || input.recordedAtEpochMs < publication.requestCreatedAtEpochMs
  ) reject("registered_fixture_runtime_entry_retire_publication_mismatch");
  const requestPath = path.join(inboxRoot, "request.json");
  const consumedPath = consumedRequestPathFor(input.requestId, inboxRoot);
  const consumedFailedPath = consumedFailedRequestPathFor(input.requestId, inboxRoot);
  const finalizedPackagePath = path.join(publication.sourcePackageRoot, "ae-export-package.finalized.json");
  if (
    publicationResidueFileState(requestPath, "registered_fixture_runtime_entry_retire_state_invalid") !== "missing"
    || publicationResidueFileState(consumedPath, "registered_fixture_runtime_entry_retire_state_invalid") !== "missing"
    || publicationResidueFileState(consumedFailedPath, "registered_fixture_runtime_entry_retire_state_invalid") !== "missing"
    || publicationResidueFileState(finalizedPackagePath, "registered_fixture_runtime_entry_retire_state_invalid") !== "missing"
  ) reject("registered_fixture_runtime_entry_retire_state_invalid");
  if (publicationResidueFileState(markerPath, "registered_fixture_runtime_entry_retire_marker_invalid") === "file") {
    assertRetiredMarkerForPublication({
      markerPath,
      publication,
      publicationPath: input.requestPublicationPath,
      publicationSha256: input.requestPublicationSha256,
      code: "registered_fixture_runtime_entry_retire_marker_invalid",
    });
    const markerRead = readBoundedRegularFile(markerPath, 64 * 1024);
    return Object.freeze({
      schema: "auto-svga-aeb-registered-fixture-publication-retire-result-v1",
      requestId: input.requestId,
      requestPublicationPath: input.requestPublicationPath,
      requestPublicationSha256: input.requestPublicationSha256,
      retiredPath: markerPath,
      retiredSha256: markerRead.sha256,
      mutationPerformed: false,
    });
  }
  const marker = {
    schema: ENTRY_CONTRACT.requestRetiredSchema,
    permitId: input.permitId,
    requestId: input.requestId,
    sourceHead: input.sourceHead,
    requestPublicationPath: input.requestPublicationPath,
    requestPublicationSha256: input.requestPublicationSha256,
    requestSha256: publication.requestSha256,
    sourcePackageRoot: publication.sourcePackageRoot,
    reasonCode: input.reasonCode,
    recordedAtEpochMs: input.recordedAtEpochMs,
    mutationPerformed: true,
  };
  const markerBytes = canonicalJsonBytes(marker);
  writeBoundFile(markerPath, markerBytes, 0o600);
  const markerRead = readBoundedRegularFile(markerPath, 64 * 1024);
  if (markerRead.sha256 !== sha256(markerBytes)) reject("registered_fixture_runtime_entry_retire_marker_invalid");
  return Object.freeze({
    schema: "auto-svga-aeb-registered-fixture-publication-retire-result-v1",
    requestId: input.requestId,
    requestPublicationPath: input.requestPublicationPath,
    requestPublicationSha256: input.requestPublicationSha256,
    retiredPath: markerPath,
    retiredSha256: markerRead.sha256,
    mutationPerformed: true,
  });
}

function entryRequestInput(record) {
  return {
    schema: ENTRY_CONTRACT.requestSchema,
    permitId: record.permitId,
    requestCreatedAtEpochMs: record.requestCreatedAtEpochMs,
    requestExpiresAtEpochMs: record.requestExpiresAtEpochMs,
    requestId: record.requestId,
    sourceHead: record.sourceHead,
    sourcePackageRoot: record.sourcePackageRoot,
  };
}

export function validateEntryInput(value, options = {}) {
  const roots = rootContract(options);
  const record = readOwnDataRecord(value, ENTRY_INPUT_KEYS, "runtime_entry");
  if (record.schema !== ENTRY_CONTRACT.entrySchema) reject("registered_fixture_runtime_entry_schema_invalid");
  const common = validateCommonRequestFields(record, roots);
  if (!/^[a-z0-9][a-z0-9-]{15,95}$/u.test(record.executionId)) {
    reject("registered_fixture_runtime_entry_execution_id_invalid");
  }
  if (!/^[a-z0-9][a-z0-9-]{15,95}$/u.test(record.d001ExecutionId)) {
    reject("registered_fixture_runtime_entry_d001_execution_id_invalid");
  }
  const packageRoot = directChild(record.packageRoot, roots.taskRoot, "registered_fixture_runtime_entry_package_root_invalid");
  const outputRoot = directChild(record.outputRoot, roots.taskRoot, "registered_fixture_runtime_entry_output_root_invalid");
  const d001OutputRoot = directChild(record.d001OutputRoot, roots.taskRoot, "registered_fixture_runtime_entry_d001_output_root_invalid");
  if (new Set([packageRoot, outputRoot, d001OutputRoot]).size !== 3) {
    reject("registered_fixture_runtime_entry_root_overlap");
  }
  const preflightRelayPath = path.resolve(requireString(
    record.preflightRelayPath,
    "registered_fixture_runtime_entry_preflight_relay_invalid",
  ));
  const expectedRelayPath = path.join(roots.taskRoot, `${record.d001ExecutionId}-preflight-relay.json`);
  if (preflightRelayPath !== expectedRelayPath) reject("registered_fixture_runtime_entry_preflight_relay_invalid");
  const expectedAuthorityPath = authorityPaths(record.d001ExecutionId, roots.processAuthorityBaseRoot).prelaunchArtifactPath;
  const prelaunchAuthorityPath = path.resolve(requireString(
    record.prelaunchAuthorityPath,
    "registered_fixture_runtime_entry_prelaunch_authority_invalid",
  ));
  if (prelaunchAuthorityPath !== expectedAuthorityPath) {
    reject("registered_fixture_runtime_entry_prelaunch_authority_invalid");
  }
  requireSha256(record.preflightRelaySha256, "registered_fixture_runtime_entry_preflight_relay_hash_invalid");
  requireSha256(record.prelaunchAuthoritySha256, "registered_fixture_runtime_entry_prelaunch_authority_hash_invalid");
  requireSha256(record.requestSha256, "registered_fixture_runtime_entry_request_hash_invalid");
  const inboxRoot = inboxRootFor(options, roots);
  const requestPublicationPath = path.resolve(requireString(
    record.requestPublicationPath,
    "registered_fixture_runtime_entry_publication_invalid",
  ));
  if (requestPublicationPath !== requestPublicationPathFor(record.requestId, inboxRoot)) {
    reject("registered_fixture_runtime_entry_publication_invalid");
  }
  requireSha256(record.requestPublicationSha256, "registered_fixture_runtime_entry_publication_hash_invalid");
  const requestMaterial = buildFixtureRequestMaterial(entryRequestInput(common), {
    ...roots,
    allowTestRoots: options.allowTestRoots === true,
  });
  if (record.requestSha256 !== requestMaterial.requestSha256) {
    reject("registered_fixture_runtime_entry_request_hash_mismatch");
  }
  return Object.freeze({
    ...common,
    packageRoot,
    outputRoot,
    d001OutputRoot,
    preflightRelayPath,
    prelaunchAuthorityPath,
    preflightRelaySha256: record.preflightRelaySha256,
    prelaunchAuthoritySha256: record.prelaunchAuthoritySha256,
    requestPublicationPath,
    requestPublicationSha256: record.requestPublicationSha256,
    requestSha256: record.requestSha256,
  });
}

function verifyPacketBaseAncestry(sourceHead) {
  const result = spawnSync("/usr/bin/git", [
    "-C",
    D001_CONTRACT.worktree,
    "merge-base",
    "--is-ancestor",
    ENTRY_CONTRACT.packetBaseHead,
    sourceHead,
  ], { encoding: "utf8", maxBuffer: 64 * 1024 });
  if (result.status !== 0 || result.signal) reject("registered_fixture_runtime_entry_packet_base_not_ancestor");
  return true;
}

function verifyRuntimeSource(sourceHead, dependencies = {}) {
  const binding = (dependencies.verifyGitBinding ?? verifyGitBinding)(sourceHead);
  const baseAncestor = (dependencies.verifyPacketBaseAncestry ?? verifyPacketBaseAncestry)(sourceHead);
  if (
    !binding
    || binding.actualHead !== sourceHead
    || binding.actualBranch !== ENTRY_CONTRACT.sourceBranch
    || binding.trackedStatusEmpty !== true
    || baseAncestor !== true
  ) reject("registered_fixture_runtime_entry_git_binding_invalid");
  return binding;
}

export function inspectRuntimeEntry(value, dependencies = {}) {
  const input = validateEntryInput(value, dependencies);
  verifyRuntimeSource(input.sourceHead, dependencies);
  return Object.freeze({
    schema: ENTRY_CONTRACT.inspectSchema,
    packetBaseHead: ENTRY_CONTRACT.packetBaseHead,
    packetHead: input.sourceHead,
    sourceBranch: ENTRY_CONTRACT.sourceBranch,
    d001SourceHead: ENTRY_CONTRACT.d001SourceHead,
    packetRebindRequired: input.sourceHead !== ENTRY_CONTRACT.packetBaseHead,
    request: {
      requestId: input.requestId,
      requestSha256: input.requestSha256,
      requestPublicationPath: input.requestPublicationPath,
      requestPublicationSha256: input.requestPublicationSha256,
      fixtureSha256: FIXTURE_SHA256,
      fixtureBytes: FIXTURE_BYTES.byteLength,
      sourcePackageRoot: input.sourcePackageRoot,
    },
    expectedGeneratedSvga: {
      sha256: ENTRY_CONTRACT.expectedGeneratedSvgaSha256,
      sizeBytes: ENTRY_CONTRACT.expectedGeneratedSvgaBytes,
    },
    productOracle: productOracleSkeleton(input),
    runtimeInputs: {
      permitId: input.permitId,
      executionId: input.executionId,
      d001ExecutionId: input.d001ExecutionId,
      packageRoot: input.packageRoot,
      outputRoot: input.outputRoot,
      d001OutputRoot: input.d001OutputRoot,
      preflightRelayPath: input.preflightRelayPath,
      preflightRelaySha256: input.preflightRelaySha256,
      prelaunchAuthorityPath: input.prelaunchAuthorityPath,
      prelaunchAuthoritySha256: input.prelaunchAuthoritySha256,
    },
    preparationRequired: true,
    launchAuthorized: false,
  });
}

function readBoundedRegularFile(filePath, maxBytes = MAX_BOUND_MATERIAL_BYTES) {
  const canonical = path.resolve(filePath);
  const before = fs.lstatSync(canonical);
  if (!before.isFile() || before.isSymbolicLink() || before.nlink !== 1 || fs.realpathSync(canonical) !== canonical) {
    reject("registered_fixture_runtime_entry_material_identity_invalid");
  }
  if (before.size <= 0 || before.size > maxBytes) reject("registered_fixture_runtime_entry_material_size_invalid");
  const descriptor = fs.openSync(canonical, fs.constants.O_RDONLY | (fs.constants.O_NOFOLLOW ?? 0));
  try {
    const opened = fs.fstatSync(descriptor);
    if (opened.dev !== before.dev || opened.ino !== before.ino || opened.size !== before.size || opened.nlink !== 1) {
      reject("registered_fixture_runtime_entry_material_identity_invalid");
    }
    const capacity = Math.min(opened.size + 1, maxBytes + 1);
    const bytes = Buffer.allocUnsafe(capacity);
    let offset = 0;
    while (offset < bytes.byteLength) {
      const count = fs.readSync(descriptor, bytes, offset, bytes.byteLength - offset, offset);
      if (count === 0) break;
      offset += count;
    }
    const after = fs.fstatSync(descriptor);
    const current = fs.lstatSync(canonical);
    if (
      offset !== opened.size
      || after.dev !== opened.dev
      || after.ino !== opened.ino
      || after.size !== opened.size
      || after.nlink !== 1
      || current.dev !== opened.dev
      || current.ino !== opened.ino
      || current.size !== opened.size
      || current.nlink !== 1
    ) reject("registered_fixture_runtime_entry_material_changed");
    const body = bytes.subarray(0, offset);
    return {
      path: canonical,
      dev: opened.dev,
      ino: opened.ino,
      uid: opened.uid,
      mode: opened.mode & 0o777,
      nlink: opened.nlink,
      sha256: sha256(body),
      sizeBytes: body.byteLength,
      bytes: Buffer.from(body),
    };
  } finally {
    fs.closeSync(descriptor);
  }
}

function parseJsonBytes(bytes, code) {
  try {
    return JSON.parse(Buffer.from(bytes).toString("utf8"));
  } catch {
    reject(code);
  }
}

function exactDirectoryIdentity(value, expectedPath, code) {
  const record = readOwnRecord(value, DIRECTORY_IDENTITY_KEYS, "runtime_entry_directory_identity");
  if (
    record.type !== "directory"
    || record.path !== expectedPath
    || !Number.isSafeInteger(record.dev)
    || !Number.isSafeInteger(record.ino)
    || !Number.isSafeInteger(record.uid)
    || record.mode !== 0o700
  ) reject(code);
  assertDirectoryIdentity(record, code);
  return record;
}

function exactFileIdentity(value, expectedPath, expectedSha256, expectedSizeBytes, maxBytes, code) {
  const record = readOwnRecord(value, FILE_IDENTITY_KEYS, "runtime_entry_file_identity");
  if (
    record.type !== "file"
    || record.path !== expectedPath
    || record.sha256 !== expectedSha256
    || record.sizeBytes !== expectedSizeBytes
    || record.nlink !== 1
    || !Number.isSafeInteger(record.dev)
    || !Number.isSafeInteger(record.ino)
    || !Number.isSafeInteger(record.uid)
    || !Number.isSafeInteger(record.mode)
  ) reject(code);
  const current = readBoundedRegularFile(expectedPath, maxBytes);
  if (
    current.dev !== record.dev
    || current.ino !== record.ino
    || current.uid !== record.uid
    || current.mode !== record.mode
    || current.nlink !== record.nlink
    || current.sha256 !== record.sha256
    || current.sizeBytes !== record.sizeBytes
  ) reject(code);
  return record;
}

function exactPendingOrConsumedRequestIdentity(value, requestPath, consumedPath, expectedSha256, expectedSizeBytes, code) {
  const record = readOwnRecord(value, FILE_IDENTITY_KEYS, "runtime_entry_file_identity");
  if (
    record.type !== "file"
    || record.path !== requestPath
    || record.sha256 !== expectedSha256
    || record.sizeBytes !== expectedSizeBytes
    || record.nlink !== 1
    || !Number.isSafeInteger(record.dev)
    || !Number.isSafeInteger(record.ino)
    || !Number.isSafeInteger(record.uid)
    || !Number.isSafeInteger(record.mode)
  ) reject(code);

  let current;
  let consumed = false;
  try {
    current = readBoundedRegularFile(requestPath, 64 * 1024);
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
    consumed = true;
    try {
      current = readBoundedRegularFile(consumedPath, 64 * 1024);
    } catch (consumedError) {
      if (consumedError?.code === "ENOENT") reject(code);
      throw consumedError;
    }
    try {
      fs.lstatSync(requestPath);
      reject(code);
    } catch (afterError) {
      if (afterError?.code !== "ENOENT") throw afterError;
    }
  }

  if (
    current.dev !== record.dev
    || current.ino !== record.ino
    || current.uid !== record.uid
    || current.mode !== record.mode
    || current.nlink !== record.nlink
    || current.sha256 !== record.sha256
    || current.sizeBytes !== record.sizeBytes
  ) reject(code);
  return Object.freeze({ ...current, consumed });
}

function validateRequestPublicationValue(value, input, dependencies, publicationRead) {
  const roots = rootContract(dependencies);
  const inboxRoot = inboxRootFor(dependencies, roots);
  const requestPath = path.join(inboxRoot, "request.json");
  const consumedRequestPath = consumedRequestPathFor(input.requestId, inboxRoot);
  const publicationPath = requestPublicationPathFor(input.requestId, inboxRoot);
  const material = buildFixtureRequestMaterial(entryRequestInput(input), {
    ...roots,
    allowTestRoots: dependencies.allowTestRoots === true,
  });
  const record = readOwnRecord(value, REQUEST_PUBLICATION_KEYS, "runtime_entry_publication", {
    allowObjectKeys: new Set(["directories", "files"]),
  });
  if (
    record.schema !== ENTRY_CONTRACT.requestPublicationSchema
    || record.permitId !== input.permitId
    || record.requestId !== input.requestId
    || record.sourceHead !== input.sourceHead
    || record.requestCreatedAtEpochMs !== input.requestCreatedAtEpochMs
    || record.requestExpiresAtEpochMs !== input.requestExpiresAtEpochMs
    || record.requestPath !== requestPath
    || record.requestSha256 !== input.requestSha256
    || record.requestSha256 !== material.requestSha256
    || record.requestBytes !== material.requestBytes
    || record.publicationPath !== publicationPath
    || record.sourcePackageRoot !== input.sourcePackageRoot
    || record.fixtureSha256 !== FIXTURE_SHA256
    || record.fixtureBytes !== FIXTURE_BYTES.byteLength
    || record.mutationPerformed !== true
  ) reject("registered_fixture_runtime_entry_publication_mismatch");

  const files = readOwnRecord(record.files, REQUEST_PUBLICATION_FILE_KEYS, "runtime_entry_publication_files", {
    allowObjectKeys: new Set(REQUEST_PUBLICATION_FILE_KEYS),
  });
  const requestRead = exactPendingOrConsumedRequestIdentity(
    files.request,
    requestPath,
    consumedRequestPath,
    material.requestSha256,
    material.requestBytes,
    "registered_fixture_runtime_entry_request_publication_mismatch",
  );
  const requestValue = parseJsonBytes(requestRead.bytes, "registered_fixture_runtime_entry_request_publication_mismatch");
  const requestBytes = canonicalJsonBytes(requestValue);
  if (
    !requestBytes.equals(requestRead.bytes)
    || requestRead.sha256 !== material.requestSha256
    || requestRead.sizeBytes !== material.requestBytes
  ) reject("registered_fixture_runtime_entry_request_publication_mismatch");

  const directories = readOwnRecord(record.directories, REQUEST_PUBLICATION_DIRECTORY_KEYS, "runtime_entry_publication_directories", {
    allowObjectKeys: new Set(REQUEST_PUBLICATION_DIRECTORY_KEYS),
  });
  const runRoot = path.dirname(input.sourcePackageRoot);
  const assetsRoot = path.join(input.sourcePackageRoot, "assets");
  exactDirectoryIdentity(directories.devRoot, roots.devRoot, "registered_fixture_runtime_entry_dev_root_changed");
  exactDirectoryIdentity(directories.inboxRoot, inboxRoot, "registered_fixture_runtime_entry_inbox_changed");
  exactDirectoryIdentity(directories.runRoot, runRoot, "registered_fixture_runtime_entry_run_root_changed");
  exactDirectoryIdentity(directories.sourcePackageRoot, input.sourcePackageRoot, "registered_fixture_runtime_entry_source_package_changed");
  exactDirectoryIdentity(directories.assetsRoot, assetsRoot, "registered_fixture_runtime_entry_assets_changed");
  exactFileIdentity(files.fixture, material.fixturePath, FIXTURE_SHA256, FIXTURE_BYTES.byteLength, PROOF_CONTRACT.fixtureBytes, "registered_fixture_runtime_entry_fixture_publication_mismatch");

  if (
    publicationRead
    && (
      publicationRead.path !== publicationPath
      || publicationRead.sha256 !== input.requestPublicationSha256
    )
  ) reject("registered_fixture_runtime_entry_publication_hash_mismatch");
  return Object.freeze({
    schema: record.schema,
    requestPath,
    publicationPath,
    publicationSha256: input.requestPublicationSha256,
    requestSha256: material.requestSha256,
    requestConsumed: requestRead.consumed,
  });
}

function validateRequestPublicationAuthority(input, dependencies = {}) {
  const readMaterial = dependencies.readBoundedRegularFile ?? readBoundedRegularFile;
  let publicationRead;
  try {
    publicationRead = readMaterial(input.requestPublicationPath, 256 * 1024);
  } catch (error) {
    if (error?.code === "ENOENT") reject("registered_fixture_runtime_entry_publication_invalid");
    throw error;
  }
  if (publicationRead.sha256 !== input.requestPublicationSha256) {
    reject("registered_fixture_runtime_entry_publication_hash_mismatch");
  }
  if (!Buffer.isBuffer(publicationRead.bytes)) reject("registered_fixture_runtime_entry_publication_invalid");
  const publicationValue = parseJsonBytes(publicationRead.bytes, "registered_fixture_runtime_entry_publication_invalid");
  if (!canonicalJsonBytes(publicationValue).equals(publicationRead.bytes)) {
    reject("registered_fixture_runtime_entry_publication_invalid");
  }
  return validateRequestPublicationValue(publicationValue, input, dependencies, publicationRead);
}

function assertFreshOutputPaths(input) {
  for (const candidate of [input.packageRoot, `${input.packageRoot}.handoff-manifest.json`, input.outputRoot, input.d001OutputRoot]) {
    assertAbsent(candidate, "registered_fixture_runtime_entry_destination_exists");
  }
}

function validatePackageSnapshot(snapshot) {
  if (
    !snapshot
    || typeof snapshot !== "object"
    || !/^[a-f0-9]{64}$/u.test(snapshot.sha256 ?? "")
    || !Number.isInteger(snapshot.fileCount)
    || !Number.isInteger(snapshot.totalBytes)
    || !Array.isArray(snapshot.entries)
    || snapshot.entries.length !== snapshot.fileCount
  ) reject("registered_fixture_runtime_entry_package_snapshot_invalid");
  const fixtureEntries = snapshot.entries.filter((entry) => entry.relative === "assets/layer-0001.png");
  const finalizedEntries = snapshot.entries.filter((entry) => entry.relative === "ae-export-package.finalized.json");
  if (
    fixtureEntries.length !== 1
    || fixtureEntries[0].sha256 !== FIXTURE_SHA256
    || fixtureEntries[0].sizeBytes !== FIXTURE_BYTES.byteLength
    || finalizedEntries.length !== 1
    || !/^[a-f0-9]{64}$/u.test(finalizedEntries[0].sha256 ?? "")
    || finalizedEntries[0].sizeBytes <= 0
  ) reject("registered_fixture_runtime_entry_package_material_invalid");
  return { fixture: fixtureEntries[0], finalized: finalizedEntries[0] };
}

function assertHandoffResult(result, sourceSnapshot, packageSha256) {
  if (
    !result
    || result.schema !== HANDOFF_SCHEMA
    || result.packageSha256 !== packageSha256
    || result.sourceBeforeSha256 !== sourceSnapshot.sha256
    || result.sourceAfterSha256 !== sourceSnapshot.sha256
    || result.targetSha256 !== sourceSnapshot.sha256
    || result.fileCount !== sourceSnapshot.fileCount
    || result.totalBytes !== sourceSnapshot.totalBytes
    || !/^[a-f0-9]{64}$/u.test(result.manifestSha256 ?? "")
  ) reject("registered_fixture_runtime_entry_handoff_result_invalid");
}

function buildDescriptor(input, packageSnapshot, packageSha256) {
  return validateDescriptor({
    schema: PROOF_CONTRACT.schema,
    permitId: input.permitId,
    executionId: input.executionId,
    sourceHead: input.sourceHead,
    sourceBranch: ENTRY_CONTRACT.sourceBranch,
    requestId: input.requestId,
    requestSha256: input.requestSha256,
    d001PermitId: input.permitId,
    d001ExecutionId: input.d001ExecutionId,
    d001PacketHead: input.sourceHead,
    d001SourceHead: ENTRY_CONTRACT.d001SourceHead,
    isolatedPanelSourceHead: PROOF_CONTRACT.isolatedPanelSourceHead,
    fixtureSourceHead: PROOF_CONTRACT.fixtureSourceHead,
    sourcePackageRoot: input.sourcePackageRoot,
    packageRoot: input.packageRoot,
    outputRoot: input.outputRoot,
    packageSha256,
    packageTreeSha256: packageSnapshot.sha256,
    packageTreeFileCount: packageSnapshot.fileCount,
    packageTreeTotalBytes: packageSnapshot.totalBytes,
    fixtureSha256: FIXTURE_SHA256,
    fixtureBytes: FIXTURE_BYTES.byteLength,
    panelManifestSha256: PROOF_CONTRACT.panelMaterialHashes.manifest,
    panelIndexSha256: PROOF_CONTRACT.panelMaterialHashes.isolatedIndex,
    panelSharedPanelSha256: PROOF_CONTRACT.panelMaterialHashes.sharedPanel,
    panelJsxSha256: PROOF_CONTRACT.panelMaterialHashes.jsx,
    expectedGeneratedSvgaSha256: ENTRY_CONTRACT.expectedGeneratedSvgaSha256,
    expectedGeneratedSvgaBytes: ENTRY_CONTRACT.expectedGeneratedSvgaBytes,
  });
}

function buildLifecycle(input, descriptor) {
  return parseD001Lifecycle({
    executionId: input.d001ExecutionId,
    outputRoot: input.d001OutputRoot,
    packetHead: input.sourceHead,
    permitId: input.permitId,
    preflightRelayPath: input.preflightRelayPath,
    preflightRelaySha256: input.preflightRelaySha256,
    prelaunchAuthorityPath: input.prelaunchAuthorityPath,
    prelaunchAuthoritySha256: input.prelaunchAuthoritySha256,
  }, descriptor);
}

function productOracleSkeleton(input) {
  return {
    schema: "auto-svga-aeb-fixture-product-oracle-v1",
    ownerCompatibility: OWNER_COMPATIBILITY_ORACLE,
    packageHandoff: {
      schema: HANDOFF_SCHEMA,
      sourcePackageRoot: input.sourcePackageRoot,
      packageRoot: input.packageRoot,
      requestPublicationSha256: input.requestPublicationSha256,
      requiresFreshTarget: true,
      descriptorTreeAuthorityRequired: true,
      targetSnapshotVerificationRequired: true,
    },
    generatedSvga: {
      sha256: ENTRY_CONTRACT.expectedGeneratedSvgaSha256,
      sizeBytes: ENTRY_CONTRACT.expectedGeneratedSvgaBytes,
    },
  };
}

function preparedProductOracle(input, snapshot, packageSha256, handoff) {
  return {
    ...productOracleSkeleton(input),
    packageHandoff: {
      schema: HANDOFF_SCHEMA,
      packageSha256,
      packageTreeSha256: snapshot.sha256,
      packageTreeFileCount: snapshot.fileCount,
      packageTreeTotalBytes: snapshot.totalBytes,
      handoffManifestSha256: handoff.manifestSha256,
      requestPublicationSha256: input.requestPublicationSha256,
      descriptorTreeAuthorityRequired: true,
      targetSnapshotVerified: true,
    },
  };
}

export function prepareRuntimeEntry(value, dependencies = {}) {
  const input = validateEntryInput(value, dependencies);
  verifyRuntimeSource(input.sourceHead, dependencies);
  const nowMs = (dependencies.now ?? Date.now)();
  if (nowMs < input.requestCreatedAtEpochMs) reject("registered_fixture_runtime_entry_request_stale");
  const assertFresh = dependencies.assertFreshOutputPaths ?? assertFreshOutputPaths;
  assertFresh(input);
  const readMaterial = dependencies.readBoundedRegularFile ?? readBoundedRegularFile;
  const validatePublication = dependencies.validateRequestPublicationAuthority ?? validateRequestPublicationAuthority;
  const publicationBefore = validatePublication(input, dependencies);
  if (nowMs >= input.requestExpiresAtEpochMs && publicationBefore.requestConsumed !== true) {
    reject("registered_fixture_runtime_entry_request_stale");
  }
  const relay = readMaterial(input.preflightRelayPath, MAX_BOUND_MATERIAL_BYTES);
  const authority = readMaterial(input.prelaunchAuthorityPath, MAX_BOUND_MATERIAL_BYTES);
  if (relay.sha256 !== input.preflightRelaySha256) reject("registered_fixture_runtime_entry_preflight_relay_hash_mismatch");
  if (authority.sha256 !== input.prelaunchAuthoritySha256) {
    reject("registered_fixture_runtime_entry_prelaunch_authority_hash_mismatch");
  }
  const snapshot = (dependencies.snapshotAePackageTree ?? snapshotAePackageTree)(input.sourcePackageRoot, {
    sourceRoot: dependencies.devRoot ?? PROOF_CONTRACT.aeDevRoot,
  });
  const packageMaterial = validatePackageSnapshot(snapshot);
  const handoff = (dependencies.prepareAePackageHandoff ?? prepareAePackageHandoff)({
    sourcePackageRoot: input.sourcePackageRoot,
    targetPackageRoot: input.packageRoot,
    expectedPackageSha256: packageMaterial.finalized.sha256,
    expectedTreeSha256: snapshot.sha256,
    expectedFileCount: snapshot.fileCount,
    expectedTotalBytes: snapshot.totalBytes,
    devRoot: dependencies.devRoot ?? PROOF_CONTRACT.aeDevRoot,
    taskRoot: dependencies.taskRoot ?? PROOF_CONTRACT.taskRoot,
  });
  assertHandoffResult(handoff, snapshot, packageMaterial.finalized.sha256);
  const targetSnapshot = (dependencies.snapshotAePackageTree ?? snapshotAePackageTree)(input.packageRoot, {
    sourceRoot: dependencies.taskRoot ?? PROOF_CONTRACT.taskRoot,
  });
  if (
    targetSnapshot.sha256 !== snapshot.sha256
    || targetSnapshot.fileCount !== snapshot.fileCount
    || targetSnapshot.totalBytes !== snapshot.totalBytes
  ) reject("registered_fixture_runtime_entry_handoff_target_mismatch");
  const publicationAfter = validatePublication(input, dependencies);
  if (
    publicationAfter.publicationSha256 !== publicationBefore.publicationSha256
    || publicationAfter.requestSha256 !== publicationBefore.requestSha256
  ) reject("registered_fixture_runtime_entry_publication_mismatch");

  verifyRuntimeSource(input.sourceHead, dependencies);
  const descriptor = buildDescriptor(input, snapshot, packageMaterial.finalized.sha256);
  const descriptorBytes = canonicalDescriptorBytes(descriptor);
  const descriptorHash = descriptorSha256(descriptor);
  const lifecycle = buildLifecycle(input, descriptor);
  const lifecycleBytes = canonicalD001LifecycleBytes(lifecycle);
  const argv = [
    ORCHESTRATOR_PATH,
    "--mode",
    "execute",
    "--descriptor-base64",
    descriptorBytes.toString("base64url"),
    "--descriptor-sha256",
    descriptorHash,
    "--d001-lifecycle-base64",
    lifecycleBytes.toString("base64url"),
  ];
  const command = { executable: process.execPath, argv };
  return Object.freeze({
    schema: ENTRY_CONTRACT.preparedSchema,
    packetBaseHead: ENTRY_CONTRACT.packetBaseHead,
    packetHead: input.sourceHead,
    sourceBranch: ENTRY_CONTRACT.sourceBranch,
    d001SourceHead: ENTRY_CONTRACT.d001SourceHead,
    request: {
      requestId: input.requestId,
      requestSha256: input.requestSha256,
      requestPublicationSha256: publicationBefore.publicationSha256,
      fixtureSha256: FIXTURE_SHA256,
      fixtureBytes: FIXTURE_BYTES.byteLength,
    },
    package: {
      packageSha256: packageMaterial.finalized.sha256,
      packageTreeSha256: snapshot.sha256,
      packageTreeFileCount: snapshot.fileCount,
      packageTreeTotalBytes: snapshot.totalBytes,
      handoffManifestSha256: handoff.manifestSha256,
      requestPublicationSha256: publicationBefore.publicationSha256,
    },
    descriptor: {
      sha256: descriptorHash,
      sizeBytes: descriptorBytes.byteLength,
      base64url: descriptorBytes.toString("base64url"),
      value: descriptor,
    },
    d001Lifecycle: {
      sha256: sha256(lifecycleBytes),
      sizeBytes: lifecycleBytes.byteLength,
      base64url: lifecycleBytes.toString("base64url"),
      value: lifecycle,
    },
    productOracle: preparedProductOracle(input, snapshot, packageMaterial.finalized.sha256, handoff),
    command: {
      ...command,
      argvSha256: sha256(canonicalJsonBytes(command)),
    },
    launchAuthorized: false,
    mutationPerformed: true,
  });
}

export function parseArgs(argv) {
  if (!Array.isArray(argv) || argv.length !== CLI_KEYS.length * 2) {
    reject("registered_fixture_runtime_entry_arguments_invalid");
  }
  const result = Object.create(null);
  for (let index = 0; index < argv.length; index += 2) {
    const token = argv[index];
    const value = argv[index + 1];
    const key = typeof token === "string" && token.startsWith("--") ? token.slice(2) : "";
    if (
      typeof value !== "string"
      || value.startsWith("--")
      || key !== CLI_KEYS[index / 2]
      || Object.prototype.hasOwnProperty.call(result, key)
    ) reject("registered_fixture_runtime_entry_arguments_invalid");
    result[key] = value;
  }
  if (!new Set(["inspect-request", "materialize-request", "retire-publication", "inspect-entry", "prepare-entry"]).has(result.mode)) {
    reject("registered_fixture_runtime_entry_mode_invalid");
  }
  return result;
}

function parseCanonicalInput(base64url, expectedSha256) {
  if (typeof base64url !== "string" || base64url.length === 0 || base64url.length > 1024 * 1024) {
    reject("registered_fixture_runtime_entry_input_invalid");
  }
  if (!/^[A-Za-z0-9_-]+$/u.test(base64url)) {
    reject("registered_fixture_runtime_entry_input_noncanonical");
  }
  requireSha256(expectedSha256, "registered_fixture_runtime_entry_input_hash_invalid");
  let bytes;
  let value;
  try {
    bytes = Buffer.from(base64url, "base64url");
  } catch {
    reject("registered_fixture_runtime_entry_input_invalid");
  }
  if (bytes.toString("base64url") !== base64url) reject("registered_fixture_runtime_entry_input_noncanonical");
  try {
    value = JSON.parse(bytes.toString("utf8"));
  } catch {
    reject("registered_fixture_runtime_entry_input_invalid");
  }
  if (sha256(bytes) !== expectedSha256) reject("registered_fixture_runtime_entry_input_hash_mismatch");
  return { bytes, value };
}

export function main(argv = process.argv.slice(2), dependencies = {}) {
  const parsed = parseArgs(argv);
  const input = parseCanonicalInput(parsed["input-base64"], parsed["input-sha256"]);
  const requestMode = parsed.mode === "inspect-request" || parsed.mode === "materialize-request";
  const retireMode = parsed.mode === "retire-publication";
  const validated = requestMode
    ? validateRequestInput(input.value, dependencies)
    : retireMode
      ? validateRetireInput(input.value, dependencies)
    : validateEntryInput(input.value, dependencies);
  if (!input.bytes.equals(canonicalJsonBytes(validated))) {
    reject("registered_fixture_runtime_entry_input_noncanonical");
  }
  if (parsed.mode === "inspect-request") return buildFixtureRequestMaterial(validated, dependencies);
  if (parsed.mode === "materialize-request") return materializeFixtureRequest(validated, dependencies);
  if (parsed.mode === "retire-publication") return retireAmbiguousRequestPublication(validated, dependencies);
  if (parsed.mode === "inspect-entry") return inspectRuntimeEntry(validated, dependencies);
  return prepareRuntimeEntry(validated, dependencies);
}

const invokedPath = process.argv[1] ? pathToFileURL(path.resolve(process.argv[1])).href : null;
if (invokedPath === import.meta.url) {
  try {
    const result = main();
    process.stdout.write(`${JSON.stringify(result)}\n`);
  } catch (error) {
    process.stderr.write(`${JSON.stringify({
      status: "failed_closed",
      issueCode: typeof error?.code === "string" ? error.code : "registered_fixture_runtime_entry_failed",
    })}\n`);
    process.exitCode = 1;
  }
}
