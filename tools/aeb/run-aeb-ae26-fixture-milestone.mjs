#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  CONTRACT as D001_CONTRACT,
  buildProcessAuthorityInvocation,
  collectPacketMaterialHashes,
  expectedAuthorityBinding,
  loadAndValidateProcessAuthority,
  prepareProcessAuthorityRoot,
  sha256File,
  verifyGitBinding,
} from "./run-registered-electron-bootstrap-discriminator.mjs";
import {
  canonicalJsonBytes,
  ENTRY_CONTRACT,
  prepareRuntimeEntry,
} from "./aeb-registered-fixture-runtime-entry.mjs";
import { collectAebHostForegroundReadiness } from "./aeb-host-foreground-readiness.mjs";
import { runAe26FixtureRequest } from "./run-aeb-ae26-fixture-request.mjs";

const SCRIPT_ROOT = path.dirname(fileURLToPath(import.meta.url));
const OUTPUT_SCHEMA = "auto-svga-aeb-ae26-fixture-milestone-run-v1";
const STOP_AFTER = new Set(["request", "prepare", "execute"]);
const ARGUMENTS = Object.freeze([
  "permit-id",
  "request-id",
  "source-head",
  "execution-id",
  "d001-execution-id",
  "stop-after",
  "timeout-ms",
  "auto-resume",
  "resume-existing",
  "resume-prepared",
]);

function fail(code, detail = {}) {
  const error = new Error(code);
  error.code = code;
  Object.assign(error, detail);
  throw error;
}

function parseArgs(argv) {
  if (!Array.isArray(argv)) fail("aeb_fixture_milestone_arguments_invalid");
  const parsed = Object.create(null);
  for (let index = 0; index < argv.length; index += 2) {
    const token = argv[index];
    const value = argv[index + 1];
    if (typeof token !== "string" || !token.startsWith("--") || typeof value !== "string" || value.startsWith("--")) {
      fail("aeb_fixture_milestone_arguments_invalid");
    }
    const key = token.slice(2);
    if (!ARGUMENTS.includes(key) || Object.prototype.hasOwnProperty.call(parsed, key)) {
      fail("aeb_fixture_milestone_arguments_invalid");
    }
    parsed[key] = value;
  }
  if (!parsed["permit-id"] || !parsed["request-id"]) fail("aeb_fixture_milestone_arguments_invalid");
  parsed["stop-after"] ??= "execute";
  if (!STOP_AFTER.has(parsed["stop-after"])) fail("aeb_fixture_milestone_arguments_invalid");
  parsed["auto-resume"] ??= "false";
  if (!["true", "false"].includes(parsed["auto-resume"])) fail("aeb_fixture_milestone_arguments_invalid");
  parsed["resume-existing"] ??= "false";
  if (!["true", "false"].includes(parsed["resume-existing"])) fail("aeb_fixture_milestone_arguments_invalid");
  parsed["resume-prepared"] ??= "false";
  if (!["true", "false"].includes(parsed["resume-prepared"])) fail("aeb_fixture_milestone_arguments_invalid");
  if (parsed["auto-resume"] === "true" && (parsed["resume-existing"] === "true" || parsed["resume-prepared"] === "true")) {
    fail("aeb_fixture_milestone_arguments_invalid");
  }
  if (parsed["auto-resume"] === "true" && parsed["stop-after"] !== "execute") {
    fail("aeb_fixture_milestone_arguments_invalid");
  }
  if (parsed["resume-prepared"] === "true" && parsed["stop-after"] !== "execute") {
    fail("aeb_fixture_milestone_arguments_invalid");
  }
  if (parsed["timeout-ms"] !== undefined && !/^[1-9][0-9]{0,6}$/u.test(parsed["timeout-ms"])) {
    fail("aeb_fixture_milestone_arguments_invalid");
  }
  return parsed;
}

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function writeJsonNoOverwrite(filePath, value) {
  const bytes = Buffer.from(`${JSON.stringify(value, null, 2)}\n`, "utf8");
  fs.writeFileSync(filePath, bytes, { flag: "wx", mode: 0o600 });
  return sha256(bytes);
}

function writeCanonicalJsonNoOverwrite(filePath, value) {
  const bytes = canonicalJsonBytes(value);
  fs.writeFileSync(filePath, bytes, { flag: "wx", mode: 0o600 });
  return sha256(bytes);
}

function assertPrivateDirectory(directoryPath, code) {
  const stat = fs.lstatSync(directoryPath);
  if (!stat.isDirectory() || stat.isSymbolicLink() || (stat.mode & 0o777) !== 0o700) fail(code);
  if (typeof process.getuid === "function" && stat.uid !== process.getuid()) fail(code);
  if (fs.realpathSync(directoryPath) !== path.resolve(directoryPath)) fail(code);
  return true;
}

function ensureTaskRoot(taskRoot = D001_CONTRACT.taskRoot) {
  if (!fs.existsSync(taskRoot)) {
    fs.mkdirSync(taskRoot, { mode: 0o700 });
  }
  assertPrivateDirectory(taskRoot, "aeb_fixture_milestone_task_root_invalid");
  return taskRoot;
}

function currentGitHead(cwd = process.cwd()) {
  const result = spawnSync("/usr/bin/git", ["rev-parse", "HEAD"], {
    cwd,
    encoding: "utf8",
    maxBuffer: 1024 * 1024,
  });
  if (result.status !== 0 || result.signal) fail("aeb_fixture_milestone_git_head_unavailable");
  const head = String(result.stdout || "").trim();
  if (!/^[0-9a-f]{40}$/u.test(head)) fail("aeb_fixture_milestone_git_head_invalid");
  return head;
}

function readPublicationFile(publicationPath) {
  const resolved = path.resolve(publicationPath);
  let stat;
  try {
    stat = fs.lstatSync(resolved);
  } catch (error) {
    if (error?.code === "ENOENT") fail("aeb_fixture_milestone_publication_missing");
    throw error;
  }
  if (!stat.isFile() || stat.isSymbolicLink() || stat.nlink !== 1 || stat.size <= 0 || stat.size > 256 * 1024) {
    fail("aeb_fixture_milestone_publication_invalid");
  }
  if (fs.realpathSync(resolved) !== resolved) fail("aeb_fixture_milestone_publication_invalid");
  const bytes = fs.readFileSync(resolved);
  if (bytes.byteLength !== stat.size) fail("aeb_fixture_milestone_publication_invalid");
  return Object.freeze({
    path: resolved,
    bytes,
    sha256: sha256(bytes),
  });
}

function inspectResumeFile(filePath) {
  try {
    const stat = fs.lstatSync(filePath);
    if (stat.isFile() && !stat.isSymbolicLink() && stat.nlink === 1) return "file";
    return "invalid";
  } catch (error) {
    if (error?.code === "ENOENT") return "missing";
    throw error;
  }
}

function requireResumeFileState(state, code) {
  if (!["missing", "file", "invalid"].includes(state)) fail(code);
  if (state === "invalid") fail(code);
  return state;
}

function classifyResumeRequestState({ requestId, inboxRoot, sourcePackageRoot }, dependencies = {}) {
  const inspect = dependencies.inspectResumeFile || inspectResumeFile;
  const requestPath = path.join(inboxRoot, "request.json");
  const consumedPath = path.join(inboxRoot, `consumed-${requestId}.json`);
  const consumedFailedPath = path.join(inboxRoot, `consumed-failed-${requestId}.json`);
  const finalizedPackagePath = path.join(sourcePackageRoot, "ae-export-package.finalized.json");
  const requestState = requireResumeFileState(inspect(requestPath), "aeb_fixture_milestone_resume_state_invalid");
  const consumedState = requireResumeFileState(inspect(consumedPath), "aeb_fixture_milestone_resume_state_invalid");
  const consumedFailedState = requireResumeFileState(inspect(consumedFailedPath), "aeb_fixture_milestone_resume_state_invalid");
  const finalizedState = requireResumeFileState(inspect(finalizedPackagePath), "aeb_fixture_milestone_resume_state_invalid");
  if (consumedFailedState === "file") {
    fail("aeb_fixture_milestone_ae_request_consumed_failed", { requestState: "consumed_failed" });
  }
  if (requestState === "file") {
    if (consumedState === "file" || finalizedState === "file") {
      fail("aeb_fixture_milestone_resume_state_invalid");
    }
    return {
      requestState: "pending",
      packageReady: false,
      requestPath,
      consumedPath,
      consumedFailedPath,
      finalizedPackagePath,
    };
  }
  if (consumedState === "file") {
    return {
      requestState: "consumed",
      packageReady: finalizedState === "file",
      requestPath,
      consumedPath,
      consumedFailedPath,
      finalizedPackagePath,
    };
  }
  if (finalizedState === "file") fail("aeb_fixture_milestone_resume_state_invalid");
  fail("aeb_fixture_milestone_publication_unconsumed_ambiguous", {
    requestState: "missing_request_marker",
  });
}

export function loadExistingRequestPublication({ permitId, requestId, sourceHead }, dependencies = {}) {
  defaultExecutionId(requestId, "aeb-fixture");
  if (typeof permitId !== "string" || permitId.length === 0) fail("aeb_fixture_milestone_publication_mismatch");
  if (!/^[0-9a-f]{40}$/u.test(sourceHead)) fail("aeb_fixture_milestone_publication_mismatch");
  const inboxRoot = path.resolve(dependencies.inboxRoot || ENTRY_CONTRACT.inboxRoot);
  const publicationPath = path.join(inboxRoot, `publication-${requestId}.json`);
  let read;
  try {
    read = (dependencies.readPublicationFile || readPublicationFile)(publicationPath);
  } catch (error) {
    if (error?.code === "ENOENT") fail("aeb_fixture_milestone_publication_missing");
    throw error;
  }
  if (
    !read
    || read.path !== publicationPath
    || !Buffer.isBuffer(read.bytes)
    || !/^[a-f0-9]{64}$/u.test(read.sha256 ?? "")
  ) fail("aeb_fixture_milestone_publication_invalid");
  let publication;
  try {
    publication = JSON.parse(read.bytes.toString("utf8"));
  } catch {
    fail("aeb_fixture_milestone_publication_invalid");
  }
  if (!publication || Object.getPrototypeOf(publication) !== Object.prototype) {
    fail("aeb_fixture_milestone_publication_invalid");
  }
  const expectedRequestPath = path.join(inboxRoot, "request.json");
  const expectedPackageRoot = path.join(path.dirname(inboxRoot), requestId, "ae-export-package");
  if (
    publication.schema !== ENTRY_CONTRACT.requestPublicationSchema
    || publication.permitId !== permitId
    || publication.requestId !== requestId
    || publication.sourceHead !== sourceHead
    || publication.requestPath !== expectedRequestPath
    || publication.publicationPath !== publicationPath
    || path.resolve(publication.sourcePackageRoot ?? "") !== expectedPackageRoot
    || !Number.isSafeInteger(publication.requestCreatedAtEpochMs)
    || !Number.isSafeInteger(publication.requestExpiresAtEpochMs)
    || publication.requestExpiresAtEpochMs <= publication.requestCreatedAtEpochMs
    || !/^[a-f0-9]{64}$/u.test(publication.requestSha256 ?? "")
    || publication.mutationPerformed !== true
  ) fail("aeb_fixture_milestone_publication_mismatch");
  const resumeState = (dependencies.classifyResumeRequestState || classifyResumeRequestState)({
    requestId,
    inboxRoot,
    sourcePackageRoot: expectedPackageRoot,
  }, dependencies);
  return Object.freeze({
    schema: "auto-svga-aeb-ae26-fixture-request-resume-v1",
    ready: true,
    sourceHead,
    requestId,
    permitId,
    requestCreatedAtEpochMs: publication.requestCreatedAtEpochMs,
    requestExpiresAtEpochMs: publication.requestExpiresAtEpochMs,
    sourcePackageRoot: expectedPackageRoot,
    requestSha256: publication.requestSha256,
    requestPublicationPath: publicationPath,
    requestPublicationSha256: read.sha256,
    requestState: resumeState.requestState,
    packageReady: resumeState.packageReady,
    consumedPath: resumeState.consumedPath,
    finalizedPackagePath: resumeState.finalizedPackagePath,
    resumedFromPublication: true,
    mutationPerformed: false,
  });
}

function defaultExecutionId(requestId, prefix) {
  if (!/^aeb-semantic-[a-z0-9][a-z0-9-]{7,79}$/u.test(requestId)) {
    fail("aeb_fixture_milestone_request_id_invalid");
  }
  const suffix = requestId.slice("aeb-semantic-".length);
  const executionId = `${prefix}-${suffix}`;
  if (!/^[a-z0-9][a-z0-9-]{15,95}$/u.test(executionId)) {
    fail("aeb_fixture_milestone_execution_id_invalid");
  }
  return executionId;
}

function preparedMaterialPathFor(parsed) {
  const d001ExecutionId = parsed["d001-execution-id"] || defaultExecutionId(parsed["request-id"], "aeb-d001");
  return path.join(D001_CONTRACT.taskRoot, `${d001ExecutionId}-prepared.json`);
}

function preparedSummary(prepared) {
  return {
    schema: prepared.schema,
    packetHead: prepared.packetHead,
    descriptorSha256: prepared.descriptor.sha256,
    d001LifecycleSha256: prepared.d001Lifecycle.sha256,
    commandArgvSha256: prepared.command.argvSha256,
  };
}

function assertPreparedForExecution(prepared, { permitId, requestId, sourceHead }) {
  if (!prepared || typeof prepared !== "object" || Array.isArray(prepared) || Object.getPrototypeOf(prepared) !== Object.prototype) {
    fail("aeb_fixture_milestone_prepared_invalid");
  }
  const descriptorBytes = Buffer.from(prepared.descriptor?.base64url ?? "", "base64url");
  const lifecycleBytes = Buffer.from(prepared.d001Lifecycle?.base64url ?? "", "base64url");
  const command = prepared.command;
  if (
    prepared.schema !== ENTRY_CONTRACT.preparedSchema
    || prepared.packetHead !== sourceHead
    || prepared.launchAuthorized !== false
    || prepared.mutationPerformed !== true
    || prepared.descriptor?.sha256 !== sha256(descriptorBytes)
    || prepared.d001Lifecycle?.sha256 !== sha256(lifecycleBytes)
    || prepared.descriptor?.value?.permitId !== permitId
    || prepared.descriptor?.value?.requestId !== requestId
    || prepared.descriptor?.value?.sourceHead !== sourceHead
    || !command
    || command.executable !== process.execPath
    || !Array.isArray(command.argv)
    || command.argv.length !== 9
    || command.argv[0] !== path.join(SCRIPT_ROOT, "run-registered-fixture-product-proof-orchestrator.mjs")
    || command.argv[1] !== "--mode"
    || command.argv[2] !== "execute"
    || command.argv[3] !== "--descriptor-base64"
    || command.argv[4] !== prepared.descriptor.base64url
    || command.argv[5] !== "--descriptor-sha256"
    || command.argv[6] !== prepared.descriptor.sha256
    || command.argv[7] !== "--d001-lifecycle-base64"
    || command.argv[8] !== prepared.d001Lifecycle.base64url
    || command.argvSha256 !== sha256(canonicalJsonBytes({ executable: command.executable, argv: command.argv }))
  ) fail("aeb_fixture_milestone_prepared_invalid");
  return prepared;
}

function writePreparedMaterial({ parsed, prepared }) {
  ensureTaskRoot();
  const preparedPath = preparedMaterialPathFor(parsed);
  const preparedSha256 = writeCanonicalJsonNoOverwrite(preparedPath, prepared);
  return { preparedPath, preparedSha256 };
}

function readPreparedFile(preparedPath) {
  const resolved = path.resolve(preparedPath);
  let stat;
  try {
    stat = fs.lstatSync(resolved);
  } catch (error) {
    if (error?.code === "ENOENT") fail("aeb_fixture_milestone_prepared_missing");
    throw error;
  }
  if (!stat.isFile() || stat.isSymbolicLink() || stat.nlink !== 1 || stat.size <= 0 || stat.size > 2 * 1024 * 1024) {
    fail("aeb_fixture_milestone_prepared_invalid");
  }
  if (fs.realpathSync(resolved) !== resolved) fail("aeb_fixture_milestone_prepared_invalid");
  const bytes = fs.readFileSync(resolved);
  if (bytes.byteLength !== stat.size) fail("aeb_fixture_milestone_prepared_invalid");
  return Object.freeze({
    path: resolved,
    bytes,
    sha256: sha256(bytes),
  });
}

export function loadPreparedMaterial({ parsed, sourceHead }, dependencies = {}) {
  const preparedPath = preparedMaterialPathFor(parsed);
  let read;
  try {
    read = (dependencies.readPreparedFile || readPreparedFile)(preparedPath);
  } catch (error) {
    if (error?.code === "ENOENT") fail("aeb_fixture_milestone_prepared_missing");
    throw error;
  }
  if (!read || read.path !== preparedPath || !Buffer.isBuffer(read.bytes)) fail("aeb_fixture_milestone_prepared_invalid");
  let prepared;
  try {
    prepared = JSON.parse(read.bytes.toString("utf8"));
  } catch {
    fail("aeb_fixture_milestone_prepared_invalid");
  }
  if (!canonicalJsonBytes(prepared).equals(read.bytes)) fail("aeb_fixture_milestone_prepared_invalid");
  assertPreparedForExecution(prepared, {
    permitId: parsed["permit-id"],
    requestId: parsed["request-id"],
    sourceHead,
  });
  return Object.freeze({
    prepared,
    preparedPath,
    preparedSha256: read.sha256,
  });
}

function missingCode(error, code) {
  return error?.code === code;
}

function requiresHostReadiness({ resumePrepared, resumeExisting, loadedPublication, stopAfter }) {
  if (resumePrepared) return false;
  if (!resumeExisting) return true;
  if (stopAfter === "request") return false;
  return loadedPublication?.packageReady !== true;
}

function runtimeEntryInput({ parsed, requestResult, preflight }) {
  const requestId = requestResult.requestId;
  const executionId = parsed["execution-id"] || defaultExecutionId(requestId, "aeb-fixture");
  const d001ExecutionId = parsed["d001-execution-id"] || defaultExecutionId(requestId, "aeb-d001");
  return {
    schema: ENTRY_CONTRACT.entrySchema,
    permitId: requestResult.permitId,
    executionId,
    d001ExecutionId,
    sourceHead: requestResult.sourceHead,
    requestId,
    requestCreatedAtEpochMs: requestResult.requestCreatedAtEpochMs,
    requestExpiresAtEpochMs: requestResult.requestExpiresAtEpochMs,
    requestSha256: requestResult.requestSha256,
    requestPublicationPath: requestResult.requestPublicationPath,
    requestPublicationSha256: requestResult.requestPublicationSha256,
    sourcePackageRoot: requestResult.sourcePackageRoot,
    packageRoot: path.join(D001_CONTRACT.taskRoot, `package-${requestId.slice("aeb-semantic-".length)}`),
    outputRoot: path.join(D001_CONTRACT.taskRoot, `product-${requestId.slice("aeb-semantic-".length)}`),
    d001OutputRoot: path.join(D001_CONTRACT.taskRoot, `d001-${requestId.slice("aeb-semantic-".length)}`),
    preflightRelayPath: preflight.relayPath,
    preflightRelaySha256: preflight.relaySha256,
    prelaunchAuthorityPath: preflight.prelaunchAuthorityPath,
    prelaunchAuthoritySha256: preflight.prelaunchAuthoritySha256,
  };
}

function installIsolatedPanel({ permitId, sourceHead, requestId }) {
  const targetParent = "/Users/huangtengxin/Library/Application Support/Adobe/CEP/extensions";
  const result = spawnSync("/bin/zsh", [
    path.join(SCRIPT_ROOT, "run-aeb-ae26-isolated-panel-install.zsh"),
    "--permit-id", permitId,
    "--source-identity", `${sourceHead}:${requestId}`,
    "--source-root", path.join(SCRIPT_ROOT, "plugin-panel-dev"),
    "--overlay-manifest", path.join(SCRIPT_ROOT, "plugin-panel-ae26-isolated", "CSXS", "manifest.xml"),
    "--target-parent", targetParent,
    "--evidence-root", path.join("/private/tmp/auto-svga-aeb-dev", `${requestId}-isolated-panel-install`),
    "--staging-path", path.join(targetParent, ".local.auto-svga.aeb.panel.ae26.dev.staging"),
  ], {
    encoding: "utf8",
    maxBuffer: 4 * 1024 * 1024,
  });
  if (result.status !== 0 || result.signal) {
    fail("aeb_fixture_milestone_panel_install_failed", {
      installStatus: result.status,
      installSignal: result.signal,
      stderr: result.stderr,
    });
  }
  return {
    stdout: result.stdout,
    stderr: result.stderr,
  };
}

async function waitForAePackage({ requestId, sourcePackageRoot, timeoutMs }) {
  const inboxRoot = ENTRY_CONTRACT.inboxRoot;
  const consumedPath = path.join(inboxRoot, `consumed-${requestId}.json`);
  const consumedFailedPath = path.join(inboxRoot, `consumed-failed-${requestId}.json`);
  const finalizedPackagePath = path.join(sourcePackageRoot, "ae-export-package.finalized.json");
  const deadline = Date.now() + timeoutMs;
  while (Date.now() <= deadline) {
    if (fs.existsSync(consumedFailedPath)) {
      fail("aeb_fixture_milestone_ae_request_consumed_failed", { consumedFailedPath });
    }
    if (fs.existsSync(consumedPath) && fs.existsSync(finalizedPackagePath)) {
      return { consumedPath, finalizedPackagePath };
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  fail("aeb_fixture_milestone_ae_package_timeout", {
    consumedPath,
    consumedFailedPath,
    finalizedPackagePath,
  });
}

async function prepareD001Preflight({ permitId, packetHead, d001ExecutionId, d001OutputRoot }) {
  ensureTaskRoot();
  await prepareProcessAuthorityRoot({
    executionId: d001ExecutionId,
    requireAbsent: true,
  });
  const invocation = buildProcessAuthorityInvocation({ phase: "prelaunch", executionId: d001ExecutionId });
  const execution = spawnSync(invocation.command, invocation.args, {
    encoding: "utf8",
    maxBuffer: 8 * 1024 * 1024,
  });
  if (execution.status !== 0 || execution.signal) {
    fail("aeb_fixture_milestone_process_authority_failed", {
      status: execution.status,
      signal: execution.signal,
      stderr: execution.stderr,
    });
  }
  const prelaunchAuthoritySha256 = await sha256File(invocation.artifactPath);
  const authority = await loadAndValidateProcessAuthority({
    artifactPath: invocation.artifactPath,
    artifactSha256: prelaunchAuthoritySha256,
    phase: "prelaunch",
    executionId: d001ExecutionId,
  });
  const packetMaterial = await collectPacketMaterialHashes();
  const gitBinding = verifyGitBinding(packetHead);
  const now = Date.now();
  const relay = {
    schema: "aeb-pm-registered-electron-bootstrap-preflight-v1",
    permitId,
    executionId: d001ExecutionId,
    sourceHead: D001_CONTRACT.sourceHead,
    packetHead,
    currentHead: gitBinding.actualHead,
    electronApp: D001_CONTRACT.electronApp,
    outputRoot: d001OutputRoot,
    capturedAtUtc: new Date(now).toISOString(),
    mutationPerformed: false,
    foregroundLeaseConflict: false,
    competingForegroundWorker: false,
    modalState: "clear",
    keychainPromptState: "absent",
    runtimeApprovalPopupState: "absent",
    commandApprovalDecision: "single_use_permit_active",
    registeredLaunchAllowed: true,
    controlStabilitySamples: [
      {
        capturedAtUtc: new Date(now - 1000).toISOString(),
        foregroundLeaseConflict: false,
        competingForegroundWorker: false,
        modalState: "clear",
        keychainPromptState: "absent",
        runtimeApprovalPopupState: "absent",
      },
      {
        capturedAtUtc: new Date(now - 500).toISOString(),
        foregroundLeaseConflict: false,
        competingForegroundWorker: false,
        modalState: "clear",
        keychainPromptState: "absent",
        runtimeApprovalPopupState: "absent",
      },
    ],
    prelaunchProcessAuthority: expectedAuthorityBinding({
      artifactSha256: authority.artifactSha256,
      invocationSha256: authority.invocation.invocationSha256,
      forbiddenPids: [],
    }),
    ...packetMaterial,
  };
  const relayPath = path.join(D001_CONTRACT.taskRoot, `${d001ExecutionId}-preflight-relay.json`);
  const relaySha256 = writeJsonNoOverwrite(relayPath, relay);
  return {
    relayPath,
    relaySha256,
    prelaunchAuthorityPath: invocation.artifactPath,
    prelaunchAuthoritySha256,
  };
}

function executePreparedCommand(prepared) {
  const result = spawnSync(prepared.command.executable, prepared.command.argv, {
    encoding: "utf8",
    maxBuffer: 16 * 1024 * 1024,
    timeout: 180_000,
  });
  if (result.status !== 0 || result.signal) {
    fail("aeb_fixture_milestone_product_orchestrator_failed", {
      status: result.status,
      signal: result.signal,
      stdout: result.stdout,
      stderr: result.stderr,
    });
  }
  try {
    return JSON.parse(result.stdout);
  } catch {
    fail("aeb_fixture_milestone_product_orchestrator_output_invalid", { stdout: result.stdout });
  }
}

export async function runAebAe26FixtureMilestone(argv = process.argv.slice(2), dependencies = {}) {
  const parsed = parseArgs(argv);
  const sourceHead = parsed["source-head"] || (dependencies.currentHead || currentGitHead)(dependencies.cwd);
  const autoResume = parsed["auto-resume"] === "true";
  let resumeExisting = parsed["resume-existing"] === "true";
  let resumePrepared = parsed["resume-prepared"] === "true";
  let loadedPrepared = null;
  let loadedPublication = null;
  if (autoResume) {
    try {
      loadedPrepared = (dependencies.loadPreparedMaterial || loadPreparedMaterial)({ parsed, sourceHead });
      resumePrepared = true;
    } catch (error) {
      if (!missingCode(error, "aeb_fixture_milestone_prepared_missing")) throw error;
    }
    if (!resumePrepared) {
      try {
        loadedPublication = await (dependencies.loadExistingRequestPublication || loadExistingRequestPublication)({
          permitId: parsed["permit-id"],
          requestId: parsed["request-id"],
          sourceHead,
        });
        resumeExisting = true;
      } catch (error) {
        if (!missingCode(error, "aeb_fixture_milestone_publication_missing")) throw error;
      }
    }
  }
  if (resumePrepared && !loadedPrepared) {
    loadedPrepared = (dependencies.loadPreparedMaterial || loadPreparedMaterial)({ parsed, sourceHead });
  }
  if (resumeExisting && !loadedPublication) {
    loadedPublication = await (dependencies.loadExistingRequestPublication || loadExistingRequestPublication)({
      permitId: parsed["permit-id"],
      requestId: parsed["request-id"],
      sourceHead,
    });
  }
  if (requiresHostReadiness({
    resumePrepared,
    resumeExisting,
    loadedPublication,
    stopAfter: parsed["stop-after"],
  })) {
    const readiness = (dependencies.collectReadiness || collectAebHostForegroundReadiness)();
    if (!readiness?.ready) fail("aeb_fixture_milestone_host_not_ready", { readiness });
  }

  if (resumePrepared) {
    const loaded = loadedPrepared;
    const execution = (dependencies.executePreparedCommand || executePreparedCommand)(loaded.prepared);
    return {
      schema: OUTPUT_SCHEMA,
      status: autoResume ? "auto_resumed_prepared_executed" : "executed_from_prepared",
      sourceHead,
      preparedPath: loaded.preparedPath,
      preparedSha256: loaded.preparedSha256,
      prepared: preparedSummary(loaded.prepared),
      execution,
      mutationPerformed: true,
    };
  }

  let install = null;
  let requestResult;
  if (resumeExisting) {
    requestResult = loadedPublication;
  } else {
    install = await (dependencies.installIsolatedPanel || installIsolatedPanel)({
      permitId: parsed["permit-id"],
      sourceHead,
      requestId: parsed["request-id"],
    });
    requestResult = await (dependencies.runFixtureRequest || runAe26FixtureRequest)([
      "--permit-id", parsed["permit-id"],
      "--request-id", parsed["request-id"],
      "--source-head", sourceHead,
    ], {
      collectReadiness: dependencies.collectReadiness || collectAebHostForegroundReadiness,
    });
  }
  if (parsed["stop-after"] === "request") {
    return {
      schema: OUTPUT_SCHEMA,
      status: resumeExisting ? "request_resumed" : "request_published",
      sourceHead,
      install,
      request: requestResult,
      mutationPerformed: !resumeExisting,
    };
  }

  const ae = requestResult.packageReady === true
    ? {
        consumedPath: requestResult.consumedPath,
        finalizedPackagePath: requestResult.finalizedPackagePath,
        resumedPackageReady: true,
      }
    : await (dependencies.waitForAePackage || waitForAePackage)({
        requestId: requestResult.requestId,
        sourcePackageRoot: requestResult.sourcePackageRoot,
        timeoutMs: Number(parsed["timeout-ms"] || 540_000),
      });
  const baseEntry = runtimeEntryInput({
    parsed,
    requestResult,
    preflight: {
      relayPath: "/private/tmp/placeholder-relay.json",
      relaySha256: "0".repeat(64),
      prelaunchAuthorityPath: path.join(D001_CONTRACT.processAuthorityBaseRoot, parsed["d001-execution-id"] || defaultExecutionId(requestResult.requestId, "aeb-d001"), "prelaunch-authority.json"),
      prelaunchAuthoritySha256: "0".repeat(64),
    },
  });
  const preflight = await (dependencies.prepareD001Preflight || prepareD001Preflight)({
    permitId: requestResult.permitId,
    packetHead: requestResult.sourceHead,
    d001ExecutionId: baseEntry.d001ExecutionId,
    d001OutputRoot: baseEntry.d001OutputRoot,
  });
  const entryInput = runtimeEntryInput({ parsed, requestResult, preflight });
  const prepared = (dependencies.prepareRuntimeEntry || prepareRuntimeEntry)(entryInput);
  const preparedWrite = await (dependencies.writePreparedMaterial || writePreparedMaterial)({ parsed, prepared });
  if (parsed["stop-after"] === "prepare") {
    return {
      schema: OUTPUT_SCHEMA,
      status: "prepared",
      sourceHead,
      install,
      request: requestResult,
      ae,
      preflight,
      preparedPath: preparedWrite.preparedPath,
      preparedSha256: preparedWrite.preparedSha256,
      prepared,
      mutationPerformed: true,
    };
  }
  const execution = (dependencies.executePreparedCommand || executePreparedCommand)(prepared);
  return {
    schema: OUTPUT_SCHEMA,
    status: autoResume && resumeExisting ? "auto_resumed_publication_executed" : "executed",
    sourceHead,
    install,
    request: requestResult,
    ae,
    preflight,
    preparedPath: preparedWrite.preparedPath,
    preparedSha256: preparedWrite.preparedSha256,
    prepared: preparedSummary(prepared),
    execution,
    mutationPerformed: true,
  };
}

export async function main(argv = process.argv.slice(2), dependencies = {}) {
  return runAebAe26FixtureMilestone(argv, dependencies);
}

if (import.meta.url === new URL(process.argv[1], "file:").href) {
  try {
    const result = await main();
    process.stdout.write(`${JSON.stringify(result)}\n`);
  } catch (error) {
    process.stderr.write(`${JSON.stringify({
      status: "failed_closed",
      issueCode: typeof error?.code === "string" ? error.code : "aeb_fixture_milestone_failed",
      readiness: error?.readiness,
      details: {
        installStatus: error?.installStatus,
        installSignal: error?.installSignal,
        status: error?.status,
        signal: error?.signal,
      },
    })}\n`);
    process.exitCode = 1;
  }
}
