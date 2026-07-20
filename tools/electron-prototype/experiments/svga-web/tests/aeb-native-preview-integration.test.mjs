import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { appendFileSync, existsSync, linkSync, renameSync, symlinkSync, truncateSync, writeFileSync } from "node:fs";
import { mkdir, mkdtemp, readFile, readdir, rm, symlink, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
import test from "node:test";
import { pathToFileURL } from "node:url";
import { deflateSync, inflateSync } from "node:zlib";
import {
  assertPrivateProductProofTaskRoot,
  assertPackageTreeUnchanged,
  buildRegisteredProductProofLaunch,
  parseArgs as parseProductProofArgs,
  resolveProductProofRoots,
  snapshotBoundedPackageTree,
  validateElectronProductProofReport,
  validateProductProofLifecycleEvidence,
  validateProjectIdentityArtifacts
} from "../../../../aeb/run-aeb-0.3-native-preview-product-proof.mjs";
import {
  ENTRY_CONTRACT,
  buildFixtureRequestMaterial
} from "../../../../aeb/aeb-registered-fixture-runtime-entry.mjs";

const require = createRequire(import.meta.url);
const experimentRoot = path.resolve(import.meta.dirname, "..");
const repoRoot = path.resolve(experimentRoot, "../../../..");
const {
  CONTRACT: REGISTERED_PRODUCT_PROOF_CONTRACT,
  descriptorEnvironment,
  validateDescriptor,
} = require("../../../../aeb/aeb-registered-fixture-proof-contract.cjs");
const {
  AEB_NATIVE_PREVIEW_PRODUCT_MILESTONE_ID,
  createAebNativePreviewSession
} = require("../aeb-native-preview-session.cjs");
const {
  AEB_FIXTURE_LANDING_TASK_ROOT,
  assertAebProofJsonPublication,
  createRuntimePackageTreeObservationState,
  resolveAebProofEvidenceStore,
  resolveAebProofOwnedPath,
  resolveAebProofRuntimePaths,
  resolveAebProofUserDataPath,
  resolveAebNativePreviewRuntimeRoot,
  waitForRuntimePackageTreeObservation,
  waitForRuntimePackageTreeObservationOrRendererFailure,
  visibleRendererErrorMessage
} = require("../aeb-native-preview-electron-proof.cjs");
const { createMultiFormatDesktopPreviewSession } = require("../multiformat-desktop-session.cjs");

test("installed client gives a canonical AEB handoff for AEP before finalized native package Preview and Save", async () => {
  const root = await mkdtemp(path.join("/private/tmp", "auto-svga-aeb-client-handoff-"));
  const aepPath = path.join(root, "task-owned-source.aep");
  const packageRoot = path.join(root, "ae-export-package");
  const preview = previewContractSpy();
  const sourceStore = new Map();
  const clientSession = createMultiFormatDesktopPreviewSession({
    repoRoot,
    sessionRoot: path.join(root, "client-session"),
    sourceStore
  });
  const aepBytes = Buffer.from("task-owned-aep-fixture");
  try {
    await writeFile(aepPath, aepBytes);
    const sourceSha256Before = sha256(await readFile(aepPath));

    const handoff = await clientSession.openLocalFilePath(aepPath, "fileOpenEvent");
    const { normalizeMultiFormatOpenOutcome } = await import(
      pathToFileURL(path.join(experimentRoot, "web/multiformat-desktop-preview-controller.mjs")).href
    );
    const rendererOutcome = normalizeMultiFormatOpenOutcome(handoff);

    assert.equal(handoff.status, "handoffRequired");
    assert.equal(handoff.outcome, "aepHandoff");
    assert.equal(handoff.sourceId, "");
    assert.equal(handoff.sourceAuthority, false);
    assert.equal(handoff.recentAuthority, false);
    assert.equal(handoff.previewAuthority, false);
    assert.equal(handoff.saveAuthority, false);
    assert.equal(handoff.model.status, "handoffRequired");
    assert.equal(handoff.model.detectedFormat, "aep");
    assert.equal(handoff.model.pathRedacted, true);
    assert.equal(handoff.model.saveExportSupported, false);
    assert.equal(handoff.model.commands.save, false);
    assert.equal(handoff.model.rightPanel.issues[0].code, "aeb.aep_handoff_required");
    assert.match(handoff.model.rightPanel.issues[0].message, /After Effects 26\.3/);
    assert.match(handoff.model.rightPanel.issues[0].message, /Auto SVGA AEB Dev 26\.3/);
    assert.deepEqual(handoff.model.aebHandoff, {
      schemaVersion: "auto-svga-aeb-client-handoff-v1",
      pathRedacted: true,
      sourceReadOnly: true,
      requiredHost: "After Effects 26.3",
      requiredPanel: "Auto SVGA AEB Dev 26.3",
      acceptedPackageEntry: "ae-export-package.finalized.json"
    });
    assert.equal(rendererOutcome.kind, "aepHandoff");
    assert.equal(rendererOutcome.result.sourceId, "");
    assert.equal(rendererOutcome.result.recentAuthority, false);
    assert.equal(rendererOutcome.result.model.status, "handoffRequired");
    assert.equal(rendererOutcome.result.model.rightPanel.issues[0].code, "aeb.aep_handoff_required");
    assert.match(rendererOutcome.result.model.rightPanel.issues[0].message, /After Effects 26\.3/);
    const forgedAuthority = JSON.parse(JSON.stringify(handoff));
    forgedAuthority.previewAuthority = true;
    const rejectedOutcome = normalizeMultiFormatOpenOutcome(forgedAuthority);
    assert.equal(rejectedOutcome.kind, "failure");
    assert.match(rejectedOutcome.message, /未授予 Preview、最近打开或 Save 权限/);
    assert.doesNotMatch(rejectedOutcome.message, /\/private\/tmp|task-owned-source/u);
    assert.equal(sourceStore.size, 0, "AEP guidance must not mint normal preview source authority");
    assert.equal(sha256(await readFile(aepPath)), sourceSha256Before);
    assert.equal(JSON.stringify(handoff).includes(root), false);
    assert.doesNotMatch(JSON.stringify(handoff), /\/private\/tmp/u);

    const [pickerSource, preloadSource, controllerSource] = await Promise.all([
      readFile(path.join(experimentRoot, "multiformat-native-picker.cjs"), "utf8"),
      readFile(path.join(experimentRoot, "preload.cjs"), "utf8"),
      readFile(path.join(experimentRoot, "web/multiformat-desktop-preview-controller.mjs"), "utf8")
    ]);
    assert.match(pickerSource, /extensions: \["svga", "json", "mp4", "aep"\]/u);
    assert.match(preloadSource, /"after-effects-project-handoff"/u);
    assert.match(controllerSource, /record\.status !== "handoffRequired"/u);
    assert.match(controllerSource, /readSafeDataValue\(model, "status"\) !== "handoffRequired"/u);

    const fixture = await writePackageFixture(packageRoot);
    const aebSession = createAebNativePreviewSession({
      repoRoot,
      sessionRoot: path.join(root, "aeb-session"),
      previewSession: preview.session
    });
    const opened = await aebSession.openPackagePath(fixture.packageRoot, "aebClientHandoff");

    assert.equal(opened.model.status, "previewReady");
    assert.equal(opened.aeb.ownerModel.compatibility.counts.native, 1);
    assert.equal(opened.aeb.ownerModel.compatibility.outputAllowed, true);
    assert.equal(opened.aebOutput.saveAsAllowed, true);
    const saved = aebSession.resolveSaveOutput({
      command: "saveAs",
      saveToken: opened.aebOutput.saveToken,
      packageSha256: opened.aebOutput.packageSha256,
      generatedSvgaSha256: opened.aebOutput.generatedSvgaSha256
    });
    assert.equal(saved.sha256, opened.aeb.generatedSvga.sha256);
    assert.equal(sha256(saved.bytes), opened.aeb.generatedSvga.sha256);
    assert.equal(saved.bytes.byteLength, opened.aeb.generatedSvga.sizeBytes);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("AEP handoff revokes stale preview authority without reading dropped bytes and rejects path aliases", async () => {
  const root = await mkdtemp(path.join("/private/tmp", "auto-svga-aeb-client-handoff-guard-"));
  const sourceStore = new Map();
  const session = createMultiFormatDesktopPreviewSession({
    repoRoot,
    sessionRoot: path.join(root, "client-session"),
    sourceStore
  });
  const previousPath = path.join(root, "previous.json");
  const aepPath = path.join(root, "source.aep");
  const aliasPath = path.join(root, "source-alias.aep");
  try {
    await writeFile(previousPath, Buffer.from(JSON.stringify({
      v: "5.7.4",
      fr: 24,
      ip: 0,
      op: 24,
      w: 64,
      h: 64,
      assets: [],
      layers: []
    })));
    await writeFile(aepPath, Buffer.from("task-owned-aep-fixture"));
    await symlink(aepPath, aliasPath);

    const previous = await session.openLocalFilePath(previousPath, "fileButton");
    assert.match(previous.sourceId, /^[a-f0-9]{24}$/u);
    assert.equal(sourceStore.has(previous.sourceId), true);

    const dropped = { displayName: "dropped-source.aep", mediaType: "application/octet-stream" };
    Object.defineProperty(dropped, "bytes", {
      enumerable: true,
      get() {
        throw new Error("AEP guidance must not read dropped project bytes");
      }
    });
    const handoff = await session.openDroppedFile(dropped);
    assert.equal(handoff.status, "handoffRequired");
    assert.equal(handoff.model.rightPanel.issues[0].code, "aeb.aep_handoff_required");
    assert.equal(handoff.sourceId, "");
    assert.equal(handoff.recentAuthority, false);
    assert.equal(handoff.previewAuthority, false);
    assert.equal(handoff.saveAuthority, false);
    assert.equal(sourceStore.has(previous.sourceId), false);

    await assert.rejects(session.openLocalFilePath(aliasPath, "fileButton"), /regular task-owned AEP copy/);
    await assert.rejects(session.openLocalFilePath(path.join(root, "missing.aep"), "fileButton"), { code: "ENOENT" });
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("0.3 Electron proof ignores hidden failure copy until the failed view is active", () => {
  const defaultFailureCopy = "文件未能解析，源文件没有被修改。";
  assert.equal(visibleRendererErrorMessage({
    view: "launch",
    errorMessage: defaultFailureCopy
  }), "");
  assert.equal(visibleRendererErrorMessage({
    view: "preview",
    errorMessage: defaultFailureCopy
  }), "");
  assert.equal(visibleRendererErrorMessage({
    view: "failed",
    errorMessage: defaultFailureCopy
  }), defaultFailureCopy);
});

test("0.3 Electron proof waits only for a missing runtime package-tree observation", async () => {
  const expected = {
    ...expectedProductProofIdentity(),
    requestId: "aeb-semantic-ae26-host-test",
    requestSha256: "f".repeat(64)
  };
  const observation = {
    schema: "auto-svga-aeb-runtime-package-tree-observation-v1",
    phase: "aeb-native-preview-session-pre-conversion",
    observationSource: "aeb-native-preview-session",
    packageRootAlias: "proof-package-root",
    sourceHead: expected.sourceHead,
    requestId: expected.requestId,
    requestSha256: expected.requestSha256,
    sha256: expected.packageTreeSha256,
    fileCount: expected.packageTreeFileCount,
    totalBytes: expected.packageTreeTotalBytes,
    pathRedacted: true
  };
  let reads = 0;
  const delayed = await waitForRuntimePackageTreeObservation({
    ...expected,
    readRuntimePackageTreeObservation() {
      reads += 1;
      return reads < 3 ? undefined : observation;
    }
  }, {
    timeoutMs: 50,
    pollIntervalMs: 0,
    sleep: async () => {}
  });
  assert.equal(delayed, observation);
  assert.equal(reads, 3);

  await assert.rejects(waitForRuntimePackageTreeObservation({
    ...expected,
    readRuntimePackageTreeObservation: () => undefined
  }, { timeoutMs: 0 }), {
    code: "electron_runtime_package_manifest_missing"
  });

  let malformedReads = 0;
  await assert.rejects(waitForRuntimePackageTreeObservation({
    ...expected,
    readRuntimePackageTreeObservation() {
      malformedReads += 1;
      return { ...observation, sha256: "0".repeat(64) };
    }
  }, {
    timeoutMs: 50,
    pollIntervalMs: 0,
    sleep: async () => {}
  }), {
    code: "electron_runtime_package_manifest_hash_invalid"
  });
  assert.equal(malformedReads, 1);
});

test("0.3 Electron proof preserves the first main-process observer failure", () => {
  const publicationFailure = Object.assign(new Error("private observer detail"), {
    code: "registered_fixture_evidence_store_failed"
  });
  const failedState = createRuntimePackageTreeObservationState();
  assert.throws(() => failedState.capture(() => {
    throw publicationFailure;
  }), { code: "registered_fixture_evidence_store_failed" });
  assert.throws(() => failedState.read(), { code: "registered_fixture_evidence_store_failed" });

  const unknownFailureState = createRuntimePackageTreeObservationState();
  assert.throws(() => unknownFailureState.capture(() => {
    throw new Error("/Users/private/package-root");
  }), { code: "electron_runtime_package_observer_failed" });
  assert.throws(() => unknownFailureState.read(), { code: "electron_runtime_package_observer_failed" });

  const observation = Object.freeze({ schema: "runtime-package-tree-observation" });
  const successfulState = createRuntimePackageTreeObservationState();
  assert.equal(successfulState.capture(() => observation), observation);
  assert.equal(successfulState.read(), observation);
  assert.throws(() => successfulState.capture(() => observation), {
    code: "electron_runtime_package_manifest_duplicate"
  });
});

test("0.3 Electron proof accepts canonical JSON key reordering but rejects publication drift", () => {
  const digest = "a".repeat(64);
  const expected = { schema: "runtime-observation", identity: { sourceHead: "b".repeat(40), requestId: "request-1" } };
  const readbackValue = { identity: { requestId: "request-1", sourceHead: "b".repeat(40) }, schema: "runtime-observation" };
  assert.notEqual(
    JSON.stringify(readbackValue),
    JSON.stringify(expected),
    "failure-first: insertion-order comparison rejects equal canonical JSON values"
  );
  assert.equal(assertAebProofJsonPublication(
    { sha256: digest },
    { sha256: digest, value: readbackValue },
    expected,
    "electron_runtime_package_manifest_publication_invalid"
  ), true);
  assert.throws(() => assertAebProofJsonPublication(
    { sha256: digest },
    { sha256: digest, value: { ...readbackValue, schema: "replaced" } },
    expected,
    "electron_runtime_package_manifest_publication_invalid"
  ), { code: "electron_runtime_package_manifest_publication_invalid" });
});

test("0.3 Electron proof reports pre-observer renderer failures without waiting for a missing manifest", async () => {
  const expected = {
    ...expectedProductProofIdentity(),
    requestId: "aeb-semantic-ae26-host-test",
    requestSha256: "f".repeat(64),
    readRuntimePackageTreeObservation: () => undefined
  };
  for (const issueCode of [
    "aeb.package_intake_failed",
    "aeb.layer_timing_invalid",
    "aeb.package_path_invalid"
  ]) {
    let snapshotReads = 0;
    await assert.rejects(waitForRuntimePackageTreeObservationOrRendererFailure(expected, {
      timeoutMs: 50,
      pollIntervalMs: 0,
      sleep: async () => {},
      readRendererSnapshot: async () => {
        snapshotReads += 1;
        return {
          view: "failed",
          summary: { status: "failed", aebFirstIssueCode: issueCode },
          errorMessage: "/Users/private/package-root"
        };
      }
    }), { code: issueCode });
    assert.equal(snapshotReads, 1);
  }

  await assert.rejects(waitForRuntimePackageTreeObservationOrRendererFailure(expected, {
    timeoutMs: 50,
    pollIntervalMs: 0,
    sleep: async () => {},
    readRendererSnapshot: async () => ({
      view: "failed",
      summary: { status: "failed", aebFirstIssueCode: "file:///Users/private/package-root" },
      errorMessage: "file:///Users/private/package-root"
    })
  }), (error) => {
    assert.equal(error.code, "electron_renderer_error_visible");
    assert.doesNotMatch(JSON.stringify(error.rendererSnapshot), /\/Users\/private/u);
    return true;
  });
});

test("0.3 source-bound Electron proof ignores a packaged app's stale runtime snapshot", async () => {
  const sourceRuntimeRoot = "/repo/auto-svga";
  const appRoot = "/repo/auto-svga/tools/electron-prototype/experiments/svga-web";
  assert.equal(resolveAebNativePreviewRuntimeRoot({
    appIsPackaged: true,
    appRoot,
    repoRoot: sourceRuntimeRoot,
    proofMode: true
  }), sourceRuntimeRoot);
  assert.equal(resolveAebNativePreviewRuntimeRoot({
    appIsPackaged: true,
    appRoot,
    repoRoot: sourceRuntimeRoot,
    proofMode: false
  }), path.join(appRoot, ".runtime"));

  const bootstrapSource = await readFile(path.join(repoRoot, "tools/aeb/registered-aeb-native-preview-bootstrap.cjs"), "utf8");
  assert.match(bootstrapSource, /Object\.assign\(process\.env, descriptorEnvironment\(descriptor, store\)\)/u);
  assert.match(bootstrapSource, /require\(path\.join\(CONTRACT\.experimentRoot, "main\.cjs"\)\)/u);
  assert.doesNotMatch(bootstrapSource, /review\//u);
});

test("0.3 product proof CLI accepts only one canonical descriptor authority", () => {
  const parsed = parseProductProofArgs([
    "--descriptor-path", "/private/tmp/auto-svga-aeb-dev/product-proof-descriptor.json",
    "--descriptor-sha256", "a".repeat(64),
  ]);
  assert.equal(parsed["descriptor-path"], "/private/tmp/auto-svga-aeb-dev/product-proof-descriptor.json");
  assert.equal(parsed["descriptor-sha256"], "a".repeat(64));

  for (const argv of [
    ["--package-root", "/private/tmp/package", "--source-head", "a".repeat(40)],
    ["--descriptor-sha256", "a".repeat(64), "--descriptor-path", "/private/tmp/descriptor.json"],
    ["--descriptor-path", "/private/tmp/descriptor.json", "--descriptor-path", "/private/tmp/other.json"],
    ["--descriptor-path", "/private/tmp/descriptor.json", "--descriptor-sha256", "a".repeat(64), "--extra", "x"],
  ]) assert.throws(() => parseProductProofArgs(argv), { code: "invalid_arguments" });
});

test("0.3 generic product runner uses the complete registered bootstrap and evidence-store contract", async () => {
  const descriptor = registeredProductProofDescriptor();
  const store = {
    outputRoot: descriptor.outputRoot,
    binding: { schema: "task-owned-evidence-binding-v1", outputIdentity: "fixture-proof" },
    bindingSha256: "f".repeat(64),
  };
  const wrapper = {
    path: path.join(descriptor.outputRoot, "session-data", "product-proof-registered-bootstrap.cjs"),
    sha256: "e".repeat(64),
  };
  const stdoutPath = path.join(descriptor.outputRoot, "reports/electron-stdout.log");
  const stderrPath = path.join(descriptor.outputRoot, "reports/electron-stderr.log");
  const launch = buildRegisteredProductProofLaunch({ descriptor, store, wrapper, stdoutPath, stderrPath });
  assert.equal(launch.command, "/usr/bin/open");
  assert.deepEqual(launch.args.slice(0, 9), [
    "-W", "-n", "-g", "--stdout", stdoutPath, "--stderr", stderrPath,
    "-a", REGISTERED_PRODUCT_PROOF_CONTRACT.electronApp,
  ]);
  assert.equal(launch.args[10], wrapper.path);
  for (const token of [
    "--descriptor-path",
    "--descriptor-sha256",
    "--evidence-binding-base64",
    "--evidence-binding-sha256",
    "--evidence-helper-path",
    "--evidence-helper-sha256",
    "--output-root",
  ]) assert.equal(launch.args.filter((value) => value === token).length, 1);

  const environment = descriptorEnvironment(descriptor, store);
  for (const key of [
    "AUTO_SVGA_AEB_PROOF_TASK_ROOT",
    "AUTO_SVGA_AEB_PROOF_OUTPUT_ROOT",
    "AUTO_SVGA_AEB_PROOF_PACKAGE_ROOT",
    "AUTO_SVGA_AEB_PROOF_REPORT_RECORD",
    "AUTO_SVGA_AEB_PROOF_SAVE_RECORD",
    "AUTO_SVGA_AEB_PROOF_EVIDENCE_BINDING_BASE64",
    "AUTO_SVGA_AEB_PROOF_EVIDENCE_BINDING_SHA256",
    "AUTO_SVGA_AEB_PROOF_REQUEST_ID",
    "AUTO_SVGA_AEB_PROOF_REQUEST_SHA256",
    "AUTO_SVGA_AEB_PROOF_PERMIT_ID",
    "AUTO_SVGA_AEB_PROOF_EXECUTION_ID",
  ]) assert.equal(typeof environment[key], "string");
  const bootstrapSource = await readFile(path.join(repoRoot, "tools/aeb/registered-aeb-native-preview-bootstrap.cjs"), "utf8");
  assert.match(bootstrapSource, /Object\.assign\(process\.env, descriptorEnvironment\(descriptor, store\)\)/u);
  assert.match(bootstrapSource, /registered-first-javascript-marker\.json/u);
  assert.match(bootstrapSource, /registered-normal-quit-requested\.json/u);
  assert.match(bootstrapSource, /registered-normal-quit-will-quit\.json/u);
  assert.match(bootstrapSource, /registered-normal-quit-observed\.json/u);

  const productRunnerSource = await readFile(path.join(
    repoRoot,
    "tools/aeb/run-aeb-0.3-native-preview-product-proof.mjs",
  ), "utf8");
  assert.match(
    productRunnerSource,
    /finally \{\s*runtimeStateCleanup = [\s\S]+?clearRuntimeState[\s\S]+?filesystemRuntimeState = [\s\S]+?assertRuntimeStateResidueAbsent/u,
  );
});

test("0.3 generic product runner rederives one same-process first-JS and normal-quit chain", () => {
  const descriptor = registeredProductProofDescriptor();
  const store = {
    outputRoot: descriptor.outputRoot,
    binding: { schema: "task-owned-evidence-binding-v1" },
    bindingSha256: "f".repeat(64),
  };
  const evidence = registeredProductProofLifecycleEvidence(descriptor, store);
  assert.deepEqual(validateProductProofLifecycleEvidence(evidence, descriptor, store), {
    pid: 43210,
    processStartedAtUtc: "2026-07-18T01:00:00.000Z",
    normalExitCode: 0,
  });

  const wrongPid = structuredClone(evidence);
  wrongPid.normalQuitObserved.value.pid += 1;
  assert.throws(() => validateProductProofLifecycleEvidence(wrongPid, descriptor, store), {
    code: "electron_marker_pid_invalid",
  });
  const wrongBinding = structuredClone(evidence);
  wrongBinding.firstJavaScript.value.evidenceBindingSha256 = "0".repeat(64);
  assert.throws(() => validateProductProofLifecycleEvidence(wrongBinding, descriptor, store), {
    code: "electron_marker_evidenceBindingSha256_invalid",
  });
  const missingWillQuit = structuredClone(evidence);
  delete missingWillQuit.normalQuitWillQuit;
  assert.throws(() => validateProductProofLifecycleEvidence(missingWillQuit, descriptor, store), {
    code: "electron_normal_quit_will_quit_invalid",
  });
  const nonzeroExit = structuredClone(evidence);
  nonzeroExit.normalQuitObserved.value.exitCode = 1;
  assert.throws(() => validateProductProofLifecycleEvidence(nonzeroExit, descriptor, store), {
    code: "electron_normal_exit_invalid",
  });
});

test("0.3 product proof separates reviewed package and D001 output root authority", () => {
  const packageRoot = path.join(AEB_FIXTURE_LANDING_TASK_ROOT, "package-proof-root-contract");
  const outputRoot = path.join(AEB_FIXTURE_LANDING_TASK_ROOT, "output-proof-root-contract");
  assert.deepEqual(resolveProductProofRoots(packageRoot, outputRoot), { packageRoot, outputRoot });

  for (const [candidatePackageRoot, candidateOutputRoot, code] of [
    ["/private/tmp/auto-svga-aeb-dev/request/ae-export-package", outputRoot, "package_root_not_task_owned"],
    [packageRoot, "/private/tmp/auto-svga-aeb-dev/product-output", "output_root_not_task_owned"],
    [path.join(packageRoot, "nested"), outputRoot, "package_root_not_task_owned"],
    [packageRoot, path.join(outputRoot, "nested"), "output_root_not_task_owned"],
    [packageRoot, packageRoot, "package_output_root_overlap"],
  ]) {
    assert.throws(() => resolveProductProofRoots(candidatePackageRoot, candidateOutputRoot), { code });
  }
});

test("0.3 product proof requires a canonical current-user private D001 task root", () => {
  const uid = 501;
  const taskRoot = AEB_FIXTURE_LANDING_TASK_ROOT;
  const fileSystem = (overrides = {}) => ({
    lstatSync: () => ({
      isDirectory: () => true,
      isSymbolicLink: () => false,
      mode: 0o40700,
      uid,
      ...overrides.stat,
    }),
    realpathSync: () => overrides.realpath ?? taskRoot,
  });
  assert.equal(assertPrivateProductProofTaskRoot(taskRoot, undefined, fileSystem(), uid), taskRoot);

  for (const invalidFileSystem of [
    fileSystem({ stat: { mode: 0o40755 } }),
    fileSystem({ stat: { uid: uid + 1 } }),
    fileSystem({ stat: { isSymbolicLink: () => true } }),
    fileSystem({ realpath: `${taskRoot}-replacement` }),
  ]) {
    assert.throws(
      () => assertPrivateProductProofTaskRoot(taskRoot, undefined, invalidFileSystem, uid),
      { code: "output_task_root_invalid" },
    );
  }
});

test("0.3 product proof rejects the prior Node-session and borrowed-pixel proof shape", () => {
  const expected = {
    sourceHead: "a".repeat(40),
    packageSha256: "b".repeat(64),
    packageTreeSha256: "e".repeat(64),
    packageTreeFileCount: 3,
    packageTreeTotalBytes: 1200,
    fixtureSha256: "c".repeat(64),
    generatedSvgaSha256: "d".repeat(64),
    generatedSvgaBytes: 823
  };
  const priorShape = {
    schemaVersion: "auto-svga-aeb-native-preview-product-proof-v1",
    status: "pass",
    productMilestoneId: "0.3.0-alpha.1",
    source: { head: expected.sourceHead },
    package: { sha256: expected.packageSha256, sourceImmutable: true },
    fixture: { sha256: expected.fixtureSha256 },
    generatedSvga: { sha256: expected.generatedSvgaSha256, sizeBytes: expected.generatedSvgaBytes },
    preview: { runtime: "real-auto-svga-multiformat-preview-session", directPixelEvidence: "bound-by-durable-player-proof" },
    boundaries: { externalRequests: 0 }
  };

  assert.throws(() => validateElectronProductProofReport(priorShape, expected), { code: "electron_proof_schema_invalid" });
});

test("0.3 product proof binds package-tree manifest to descriptor values", () => {
  const expected = expectedProductProofIdentity();
  const report = validProductProofReport(expected);
  assert.equal(validateElectronProductProofReport(report, expected), report);

  for (const mutation of [
    { field: "sha256", value: "f".repeat(64), code: "electron_package_manifest_hash_invalid" },
    { field: "fileCount", value: expected.packageTreeFileCount + 1, code: "electron_package_manifest_count_invalid" },
    { field: "totalBytes", value: expected.packageTreeTotalBytes + 1, code: "electron_package_manifest_size_invalid" }
  ]) {
    const mutated = validProductProofReport(expected);
    mutated.package.outerManifest[mutation.field] = mutation.value;
    assert.throws(() => validateElectronProductProofReport(mutated, expected), { code: mutation.code });
  }

  const expectedManifestDrift = validProductProofReport(expected);
  expectedManifestDrift.package.expectedOuterManifest.sha256 = "f".repeat(64);
  assert.throws(() => validateElectronProductProofReport(expectedManifestDrift, expected), {
    code: "electron_expected_package_manifest_hash_invalid"
  });

  const missingRuntimeObservation = validProductProofReport(expected);
  delete missingRuntimeObservation.package.runtimeObservedOuterManifest;
  assert.throws(() => validateElectronProductProofReport(missingRuntimeObservation, expected), {
    code: "electron_runtime_package_manifest_missing"
  });

  const transientRuntimeMutation = validProductProofReport(expected);
  transientRuntimeMutation.package.runtimeObservedOuterManifest.sha256 = "f".repeat(64);
  assert.throws(() => validateElectronProductProofReport(transientRuntimeMutation, expected), {
    code: "electron_runtime_package_manifest_hash_invalid"
  });
});

test("0.3 product proof binds runtime-observed package identity to descriptor and evidence store", () => {
  const descriptor = registeredProductProofDescriptor();
  const expected = {
    sourceHead: descriptor.sourceHead,
    packageSha256: descriptor.packageSha256,
    packageTreeSha256: descriptor.packageTreeSha256,
    packageTreeFileCount: descriptor.packageTreeFileCount,
    packageTreeTotalBytes: descriptor.packageTreeTotalBytes,
    fixtureSha256: descriptor.fixtureSha256,
    generatedSvgaSha256: descriptor.expectedGeneratedSvgaSha256,
    generatedSvgaBytes: descriptor.expectedGeneratedSvgaBytes,
    requestId: descriptor.requestId,
    requestSha256: descriptor.requestSha256,
    permitId: descriptor.permitId,
    executionId: descriptor.executionId,
    d001PermitId: descriptor.d001PermitId,
    d001ExecutionId: descriptor.d001ExecutionId,
    d001PacketHead: descriptor.d001PacketHead,
    evidenceBindingSha256: "f".repeat(64),
  };
  assert.equal(validateElectronProductProofReport(validProductProofReport(expected), expected).status, "pass");
  for (const field of [
    "requestId", "requestSha256", "permitId", "executionId",
    "d001PermitId", "d001ExecutionId", "d001PacketHead", "evidenceBindingSha256",
  ]) {
    const report = validProductProofReport(expected);
    report.package.runtimeObservedOuterManifest[field] = field.endsWith("Sha256")
      ? "0".repeat(64)
      : `${report.package.runtimeObservedOuterManifest[field]}-drift`;
    assert.throws(() => validateElectronProductProofReport(report, expected), {
      code: "electron_runtime_package_manifest_identity_invalid",
    });
  }
});

test("0.3 registered finalizer accepts the bounded outer manifest beside the exact runtime observation", async () => {
  const descriptor = registeredProductProofDescriptor();
  const expected = {
    sourceHead: descriptor.sourceHead,
    packageSha256: descriptor.packageSha256,
    packageTreeSha256: descriptor.packageTreeSha256,
    packageTreeFileCount: descriptor.packageTreeFileCount,
    packageTreeTotalBytes: descriptor.packageTreeTotalBytes,
    fixtureSha256: descriptor.fixtureSha256,
    generatedSvgaSha256: descriptor.expectedGeneratedSvgaSha256,
    generatedSvgaBytes: descriptor.expectedGeneratedSvgaBytes,
    requestId: descriptor.requestId,
    requestSha256: descriptor.requestSha256,
    permitId: descriptor.permitId,
    executionId: descriptor.executionId,
    d001PermitId: descriptor.d001PermitId,
    d001ExecutionId: descriptor.d001ExecutionId,
    d001PacketHead: descriptor.d001PacketHead,
    evidenceBindingSha256: "f".repeat(64),
  };
  const report = validProductProofReport(expected);
  report.execution.electronVersion = REGISTERED_PRODUCT_PROOF_CONTRACT.electronVersion;
  assert.deepEqual(Object.keys(report.package.outerManifest).sort(), [
    "fileCount",
    "pathRedacted",
    "sha256",
    "totalBytes",
    "unchangedAcrossElectronRuntime",
  ]);

  const orchestrator = await import(pathToFileURL(path.join(
    repoRoot,
    "tools/aeb/run-registered-fixture-product-proof-orchestrator.mjs",
  )).href);
  assert.equal(
    orchestrator.validateProductReport(report, descriptor, report.package.runtimeObservedOuterManifest),
    report,
  );
});

test("0.3 product proof rejects A-to-B-to-A package-tree runtime exposure", async () => {
  const expected = expectedProductProofIdentity();
  const orchestrator = await import(pathToFileURL(path.join(repoRoot, "tools/aeb/run-registered-fixture-product-proof-orchestrator.mjs")).href);
  const descriptor = {
    packageTreeSha256: expected.packageTreeSha256,
    packageTreeFileCount: expected.packageTreeFileCount,
    packageTreeTotalBytes: expected.packageTreeTotalBytes
  };
  const endpointTreeA = {
    sha256: expected.packageTreeSha256,
    fileCount: expected.packageTreeFileCount,
    totalBytes: expected.packageTreeTotalBytes
  };
  assert.equal(orchestrator.assertPackageTreeSnapshotMatchesDescriptor(
    endpointTreeA,
    descriptor,
    "registered_fixture_package_tree_prelaunch_mismatch"
  ), endpointTreeA);
  assert.equal(orchestrator.assertPackageTreeSnapshotMatchesDescriptor(
    endpointTreeA,
    descriptor,
    "registered_fixture_package_tree_finalization_mismatch"
  ), endpointTreeA);

  const runtimeTreeB = validProductProofReport(expected);
  runtimeTreeB.package.runtimeObservedOuterManifest.sha256 = "f".repeat(64);
  runtimeTreeB.package.outerManifest.sha256 = expected.packageTreeSha256;
  assert.throws(() => validateElectronProductProofReport(runtimeTreeB, expected), {
    code: "electron_runtime_package_manifest_hash_invalid"
  });
});

test("0.3 product proof requires owner-model oracle before pixel, playback, or Save authority", async () => {
  const proofSource = await readFile(path.join(experimentRoot, "aeb-native-preview-electron-proof.cjs"), "utf8");
  const orchestratorSource = await readFile(path.join(repoRoot, "tools/aeb/run-registered-fixture-product-proof-orchestrator.mjs"), "utf8");
  assert.match(proofSource, /const ownerModelOracle = assertOwnerModelOracle\(loaded\.summary, expected\);[\s\S]+?const loadedPixels = await captureSvgaPixels/u);
  assert.match(proofSource, /ownerModelOracle,/u);
  assert.match(orchestratorSource, /validateOwnerModelOracle\(report\.ownerModelOracle\)/u);
  assert.match(orchestratorSource, /oracle\.nativeCount !== 1/u);
  assert.match(orchestratorSource, /oracle\.saveExportSupported !== true/u);
});

test("0.3 registered product finalizer rederives package-tree authority before launch and finalization", async () => {
  const orchestratorSource = await readFile(path.join(repoRoot, "tools/aeb/run-registered-fixture-product-proof-orchestrator.mjs"), "utf8");
  assert.match(orchestratorSource, /import \{ snapshotBoundedPackageTree \} from "\.\/run-aeb-0\.3-native-preview-product-proof\.mjs";/u);
  assert.match(orchestratorSource, /assertDescriptorPackageTree\(descriptor, "registered_fixture_package_tree_prelaunch_mismatch"\);[\s\S]+?launchAttemptsPerformed \+= 1;/u);
  assert.match(orchestratorSource, /RUNTIME_PACKAGE_TREE_OBSERVATION_RECORD = "registered-package-tree-runtime-observed\.json"/u);
  assert.match(orchestratorSource, /runtimePackageTree: readJsonRecord\(store, "reports", RUNTIME_PACKAGE_TREE_OBSERVATION_RECORD\)/u);
  assert.match(orchestratorSource, /"electronVersion", "evidenceBindingSha256", "executionId", "permitId", "phase", "pid", "ppid"/u);
  assert.match(orchestratorSource, /exactRuntimePackageTreeObservation\(runtimePackageTreeRead\.value, descriptor, store\)[\s\S]+?assertDescriptorPackageTree\(descriptor, "registered_fixture_package_tree_finalization_mismatch"\);[\s\S]+?validateProductReport\(reportRead\.value, descriptor, runtimePackageTreeObservation\)/u);

  const module = await import(pathToFileURL(path.join(repoRoot, "tools/aeb/run-registered-fixture-product-proof-orchestrator.mjs")).href);
  const descriptor = {
    packageTreeSha256: "a".repeat(64),
    packageTreeFileCount: 3,
    packageTreeTotalBytes: 1200
  };
  const snapshot = { sha256: descriptor.packageTreeSha256, fileCount: 3, totalBytes: 1200 };
  assert.equal(module.assertPackageTreeSnapshotMatchesDescriptor(snapshot, descriptor, "registered_fixture_package_tree_prelaunch_mismatch"), snapshot);
  for (const mutation of [
    { sha256: "b".repeat(64) },
    { fileCount: 4 },
    { totalBytes: 1201 }
  ]) {
    assert.throws(() => module.assertPackageTreeSnapshotMatchesDescriptor({
      ...snapshot,
      ...mutation
    }, descriptor, "registered_fixture_package_tree_prelaunch_mismatch"), {
      code: "registered_fixture_package_tree_prelaunch_mismatch"
    });
  }
});

function registeredProductProofDescriptor() {
  const requestId = "aeb-semantic-product-proof-contract-test";
  return validateDescriptor({
    d001ExecutionId: "aeb-d001-product-proof-contract-test",
    d001PacketHead: "a".repeat(40),
    d001PermitId: "ASV-APR-20260718-999",
    d001SourceHead: "b".repeat(40),
    executionId: "aeb-product-proof-contract-test",
    expectedGeneratedSvgaBytes: 823,
    expectedGeneratedSvgaSha256: "e".repeat(64),
    fixtureBytes: REGISTERED_PRODUCT_PROOF_CONTRACT.fixtureBytes,
    fixtureSha256: REGISTERED_PRODUCT_PROOF_CONTRACT.fixtureSha256,
    fixtureSourceHead: REGISTERED_PRODUCT_PROOF_CONTRACT.fixtureSourceHead,
    isolatedPanelSourceHead: REGISTERED_PRODUCT_PROOF_CONTRACT.isolatedPanelSourceHead,
    outputRoot: path.join(REGISTERED_PRODUCT_PROOF_CONTRACT.taskRoot, "product-proof-contract-output"),
    packageRoot: path.join(REGISTERED_PRODUCT_PROOF_CONTRACT.taskRoot, "product-proof-contract-package"),
    packageSha256: "b".repeat(64),
    packageTreeFileCount: 2,
    packageTreeSha256: "c".repeat(64),
    packageTreeTotalBytes: 4058,
    panelIndexSha256: REGISTERED_PRODUCT_PROOF_CONTRACT.panelMaterialHashes.isolatedIndex,
    panelJsxSha256: REGISTERED_PRODUCT_PROOF_CONTRACT.panelMaterialHashes.jsx,
    panelManifestSha256: REGISTERED_PRODUCT_PROOF_CONTRACT.panelMaterialHashes.manifest,
    panelSharedPanelSha256: REGISTERED_PRODUCT_PROOF_CONTRACT.panelMaterialHashes.sharedPanel,
    permitId: "ASV-APR-20260718-999",
    requestId,
    requestSha256: "9".repeat(64),
    schema: REGISTERED_PRODUCT_PROOF_CONTRACT.schema,
    sourceBranch: "codex/aeb-product-proof-contract-test",
    sourceHead: "a".repeat(40),
    sourcePackageRoot: path.join(REGISTERED_PRODUCT_PROOF_CONTRACT.aeDevRoot, requestId, "ae-export-package"),
  });
}

function registeredProductProofLifecycleEvidence(descriptor, store) {
  const pid = 43210;
  const ppid = 43100;
  const processStartedAtUtc = "2026-07-18T01:00:00.000Z";
  const marker = (phase, recordedAtUtc, extra = {}) => ({
    appPath: REGISTERED_PRODUCT_PROOF_CONTRACT.electronApp,
    bundleId: REGISTERED_PRODUCT_PROOF_CONTRACT.electronBundleId,
    d001ExecutionId: descriptor.d001ExecutionId,
    d001PacketHead: descriptor.d001PacketHead,
    d001PermitId: descriptor.d001PermitId,
    electronVersion: REGISTERED_PRODUCT_PROOF_CONTRACT.electronVersion,
    evidenceBindingSha256: store.bindingSha256,
    executionId: descriptor.executionId,
    permitId: descriptor.permitId,
    phase,
    pid,
    ppid,
    processExecPath: REGISTERED_PRODUCT_PROOF_CONTRACT.electronExecutable,
    processStartedAtUtc,
    recordedAtUtc,
    requestId: descriptor.requestId,
    requestSha256: descriptor.requestSha256,
    schema: `auto-svga-aeb-registered-fixture-proof-${phase}-v1`,
    sourceHead: descriptor.sourceHead,
    ...extra,
  });
  return {
    firstJavaScript: { value: marker("first-javascript", "2026-07-18T01:00:01.000Z", { argvSha256: "a".repeat(64) }) },
    normalQuitRequested: { value: marker("normal-quit-requested", "2026-07-18T01:00:02.000Z") },
    normalQuitWillQuit: { value: marker("normal-quit-will-quit", "2026-07-18T01:00:03.000Z") },
    normalQuitObserved: { value: marker("normal-quit-observed", "2026-07-18T01:00:04.000Z", { exitCode: 0 }) },
  };
}

function expectedProductProofIdentity() {
  return {
    sourceHead: "a".repeat(40),
    packageSha256: "b".repeat(64),
    packageTreeSha256: "c".repeat(64),
    packageTreeFileCount: 3,
    packageTreeTotalBytes: 1200,
    fixtureSha256: "d".repeat(64),
    generatedSvgaSha256: "e".repeat(64),
    generatedSvgaBytes: 823
  };
}

function validProductProofReport(expected) {
  const manifest = {
    sha256: expected.packageTreeSha256,
    fileCount: expected.packageTreeFileCount,
    totalBytes: expected.packageTreeTotalBytes,
    pathRedacted: true
  };
  return {
    schemaVersion: "auto-svga-aeb-native-preview-electron-proof-v2",
    status: "pass",
    productMilestoneId: "0.3.0-alpha.1",
    source: { head: expected.sourceHead },
    execution: {
      actualElectronMainEntry: true,
      actualPreloadIpcRoundTrip: true,
      actualRendererController: true,
      actualRendererSvgaMount: true,
      rendererActionBridgeOpen: true,
      hiddenWindow: true,
      taskOwnedUserDataBound: true,
      userDataPathRedacted: true
    },
    package: {
      sha256: expected.packageSha256,
      expectedOuterManifest: { ...manifest },
      runtimeObservedOuterManifest: {
        schema: "auto-svga-aeb-runtime-package-tree-observation-v1",
        phase: "aeb-native-preview-session-pre-conversion",
        observationSource: "aeb-native-preview-session",
        packageRootAlias: "proof-package-root",
        ...Object.fromEntries([
          "sourceHead", "requestId", "requestSha256", "permitId", "executionId",
          "d001PermitId", "d001ExecutionId", "d001PacketHead", "evidenceBindingSha256",
        ].filter((field) => expected[field] !== undefined).map((field) => [field, expected[field]])),
        ...manifest
      },
      outerManifest: {
        ...manifest,
        unchangedAcrossElectronRuntime: true
      },
      sourceImmutable: true
    },
    fixture: { sha256: expected.fixtureSha256 },
    generatedSvga: {
      sha256: expected.generatedSvgaSha256,
      sizeBytes: expected.generatedSvgaBytes,
      rendererMounted: true,
      playbackLoadPrepared: true
    },
    projectIdentity: {
      projectId: "project-fixture",
      projectSha256: "1".repeat(64),
      mapSha256: "2".repeat(64),
      assetSetSha256: "3".repeat(64),
      hostReadbackMatched: true
    },
    ownerModelOracle: {
      schema: "auto-svga-aeb-owner-model-product-oracle-v1",
      nativeCount: 1,
      bakeRequiredCount: 0,
      blockedCount: 0,
      suggestionOnlyCount: 0,
      outputAllowed: true,
      readOnly: true,
      resourceAuthorityExact: true,
      layerAuthorityExact: true,
      saveExportSupported: true
    },
    identityArtifacts: {
      project: "project.json",
      map: "svga-map.json",
      assetSet: "asset-set.json",
      pathRedacted: true
    },
    renderer: {
      informationFacts: 4,
      assets: 1,
      diagnostics: 1,
      runtimeCanvas: { source: "canvas-backing-store" }
    },
    playback: {
      changingPlayingPixels: true,
      playingSamples: [{}, {}],
      paused: {
        stablePixels: true,
        stableFrame: true
      }
    },
    save: {
      status: "saved",
      sha256: expected.generatedSvgaSha256,
      sizeBytes: expected.generatedSvgaBytes,
      byteExact: true,
      overwriteAllowed: false
    },
    network: {
      captureInstalled: true,
      externalRequestCount: 0,
      observedExternalRequests: []
    },
    boundaries: {
      sourcePackageMutation: false,
      renderOrBakeExecuted: false,
      foregroundUsed: false,
      installedAppMutated: false,
      supportClaimAllowed: false,
      productOwnerAcceptanceClaimed: false,
      releaseClaimed: false
    }
  };
}

test("AEB proof mode binds a fresh canonical task-owned userData path before app readiness", async () => {
  const outputRoot = path.join(AEB_FIXTURE_LANDING_TASK_ROOT, "proof-output");
  const reportsRoot = path.join(outputRoot, "reports");
  const reportPath = path.join(reportsRoot, "proof.json");
  const canonicalDirectories = new Set([AEB_FIXTURE_LANDING_TASK_ROOT, outputRoot, reportsRoot]);
  let staleUserData = false;
  let aliasDirectory = "";
  const fileSystem = {
    existsSync(value) {
      return staleUserData && value === path.join(outputRoot, "electron-user-data");
    },
    lstatSync(value) {
      if (!canonicalDirectories.has(value)) throw Object.assign(new Error("missing"), { code: "ENOENT" });
      return {
        isDirectory: () => true,
        isSymbolicLink: () => value === aliasDirectory,
        mode: value === AEB_FIXTURE_LANDING_TASK_ROOT ? 0o40700 : 0o40755
      };
    },
    realpathSync(value) {
      return value === aliasDirectory ? path.join(AEB_FIXTURE_LANDING_TASK_ROOT, "different") : value;
    }
  };

  assert.equal(
    resolveAebProofUserDataPath(reportPath, AEB_FIXTURE_LANDING_TASK_ROOT, fileSystem),
    path.join(outputRoot, "electron-user-data")
  );
  assert.throws(() => resolveAebProofUserDataPath("", AEB_FIXTURE_LANDING_TASK_ROOT, fileSystem), {
    code: "electron_proof_user_data_report_missing"
  });
  assert.throws(() => resolveAebProofUserDataPath(reportPath, "/private/tmp/not-aeb-task", fileSystem), {
    code: "electron_proof_task_root_invalid"
  });
  assert.throws(() => resolveAebProofOwnedPath({ toString: () => reportPath }, "report", AEB_FIXTURE_LANDING_TASK_ROOT, fileSystem), {
    code: "electron_proof_report_path_invalid"
  });
  assert.throws(() => resolveAebProofEvidenceStore(new Proxy({}, {})), {
    code: "electron_proof_evidence_store_environment_invalid"
  });
  const accessorEnvironment = {};
  Object.defineProperty(accessorEnvironment, "AUTO_SVGA_AEB_PROOF_OUTPUT_ROOT", {
    enumerable: true,
    get() {
      throw new Error("environment getter must not execute");
    }
  });
  assert.throws(() => resolveAebProofEvidenceStore(accessorEnvironment), {
    code: "electron_proof_evidence_store_environment_invalid"
  });

  aliasDirectory = outputRoot;
  assert.throws(() => resolveAebProofUserDataPath(reportPath, AEB_FIXTURE_LANDING_TASK_ROOT, fileSystem), {
    code: "electron_proof_user_data_alias_rejected"
  });
  aliasDirectory = "";
  staleUserData = true;
  assert.throws(() => resolveAebProofUserDataPath(reportPath, AEB_FIXTURE_LANDING_TASK_ROOT, fileSystem), {
    code: "electron_proof_user_data_stale"
  });

  const runtimePaths = resolveAebProofRuntimePaths({ outputRoot });
  assert.deepEqual(runtimePaths, {
    userData: path.join(outputRoot, "user-data"),
    sessionData: path.join(outputRoot, "session-data"),
    productSessionRoot: path.join(outputRoot, "session-data", "product-runtime")
  });
});

test("outer product proof whole-tree manifest rejects added package files", async () => {
  const root = await mkdtemp(path.join("/private/tmp", "auto-svga-aeb-outer-manifest-reject-"));
  try {
    const fixture = await writePackageFixture(path.join(root, "package"));
    const before = snapshotBoundedPackageTree(fixture.packageRoot);
    await writeFile(path.join(fixture.packageRoot, "unexpected.json"), "{}\n");
    const after = snapshotBoundedPackageTree(fixture.packageRoot);

    assert.notEqual(after.sha256, before.sha256);
    assert.equal(after.fileCount, before.fileCount + 1);
    assert.throws(() => assertPackageTreeUnchanged(before, after), {
      code: "package_tree_mutated_during_electron_proof"
    });
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("0.3 AEB source adapter exposes the bounded package-to-Preview host contract", () => {
  assert.equal(AEB_NATIVE_PREVIEW_PRODUCT_MILESTONE_ID, "0.3.0-alpha.1");
  const preview = previewContractSpy();
  const session = createAebNativePreviewSession({
    repoRoot,
    sessionRoot: "/private/tmp/auto-svga-aeb-contract-shape",
    previewSession: preview.session
  });
  assert.equal(typeof session.openPackagePath, "function");
  assert.equal(typeof session.prepareRuntimePreview, "function");
  assert.equal(typeof session.control, "function");
  assert.equal(typeof session.resolveSaveOutput, "function");
});

test("validated native AEB package generates standards-valid SVGA and enters the real Preview session", async () => {
  const root = await mkdtemp(path.join("/private/tmp", "auto-svga-aeb-native-preview-"));
  try {
    const canonicalFixtureMaterial = buildFixtureRequestMaterial({
      schema: ENTRY_CONTRACT.requestSchema,
      permitId: "ASV-APR-20260718-998",
      requestCreatedAtEpochMs: Date.parse("2026-07-18T00:00:00.000Z"),
      requestExpiresAtEpochMs: Date.parse("2026-07-18T00:09:00.000Z"),
      requestId: "aeb-semantic-canonical-output-test",
      sourceHead: ENTRY_CONTRACT.packetBaseHead,
      sourcePackageRoot: "/private/tmp/auto-svga-aeb-dev/aeb-semantic-canonical-output-test/ae-export-package"
    });
    const fixture = await writePackageFixture(path.join(root, "package"), {
      assetBytes: Buffer.from(canonicalFixtureMaterial.fixtureBase64url, "base64url")
    });
    const beforePackage = await readFile(fixture.packagePath);
    const beforeAsset = await readFile(fixture.assetPath);
    const previewSession = createMultiFormatDesktopPreviewSession({
      repoRoot,
      sessionRoot: path.join(root, "session"),
      sourceStore: new Map(),
      openTimeoutMs: 3_000
    });
    const session = createAebNativePreviewSession({
      repoRoot,
      sessionRoot: path.join(root, "session"),
      previewSession
    });

    const result = await session.openPackagePath(fixture.packageRoot);

    assert.equal(result.status, "opened");
    assert.equal(result.model.status, "playing", JSON.stringify(result.model.rightPanel?.issues));
    assert.equal(result.model.detectedFormat, "svga");
    assert.equal(result.aeb.productMilestoneId, "0.3.0-alpha.1");
    assert.deepEqual(result.aeb.compatibility.counts, {
      native: 1,
      bake_required: 0,
      blocked: 0,
      suggestion_only: 0
    });
    assert.equal(result.aeb.ownerModel.compatibility.outputAllowed, true);
    assert.equal(result.aeb.ownerModel.authority.resourceCount, 1);
    assert.equal(result.aeb.ownerModel.authority.layerCount, 1);
    assert.deepEqual(result.aeb.ownerModel.authority.layers.map((layer) => ({
      layerId: layer.layerId,
      assetId: layer.assetId,
      outcome: layer.outcome,
      resourceAuthorityBound: layer.resourceAuthorityBound
    })), [{
      layerId: "layer-task-fixture-0001",
      assetId: "asset-task-fixture-0001",
      outcome: "native",
      resourceAuthorityBound: true
    }]);
    assert.equal(result.aeb.package.sourceImmutable, true);
    assert.equal(result.aeb.generatedSvga.validation.inflated, true);
    assert.equal(result.aeb.generatedSvga.validation.decoded, true);
    assert.equal(result.aeb.generatedSvga.validation.imageCount, 1);
    assert.equal(result.aeb.generatedSvga.validation.spriteCount, 1);
    assert.equal(result.aeb.generatedSvga.validation.frameCount, 120);
    assert.equal(result.aeb.project.projectId, "aeb-test-native-package-wp5am-native-subset");
    for (const field of ["sha256", "mapSha256", "assetSetSha256"]) {
      assert.match(result.aeb.project[field], /^[a-f0-9]{64}$/u, field);
    }
    const hostIdentity = session.readActiveGeneratedIdentity();
    assert.deepEqual(hostIdentity.summary, {
      projectId: result.aeb.project.projectId,
      projectSha256: result.aeb.project.sha256,
      mapSha256: result.aeb.project.mapSha256,
      assetSetSha256: result.aeb.project.assetSetSha256
    });
    assert.equal(sha256(hostIdentity.files.projectBytes), result.aeb.project.sha256);
    assert.equal(sha256(hostIdentity.files.mapBytes), result.aeb.project.mapSha256);
    assert.equal(sha256(hostIdentity.files.assetSetBytes), result.aeb.project.assetSetSha256);
    const identityRoot = path.join(root, "identity");
    await mkdir(identityRoot, { recursive: true });
    await writeFile(path.join(identityRoot, "project.json"), hostIdentity.files.projectBytes);
    await writeFile(path.join(identityRoot, "svga-map.json"), hostIdentity.files.mapBytes);
    await writeFile(path.join(identityRoot, "asset-set.json"), hostIdentity.files.assetSetBytes);
    assert.deepEqual(validateProjectIdentityArtifacts({
      report: { projectIdentity: hostIdentity.summary },
      packagePath: fixture.packagePath,
      identityRoot
    }), hostIdentity.summary);
    await writeFile(path.join(identityRoot, "project.json"), Buffer.concat([
      hostIdentity.files.projectBytes,
      Buffer.from("\n")
    ]));
    assert.throws(() => validateProjectIdentityArtifacts({
      report: { projectIdentity: hostIdentity.summary },
      packagePath: fixture.packagePath,
      identityRoot
    }), { code: "electron_project_sha256_binding_drift" });
    assert.equal(result.aebOutput.saveAsAllowed, true);
    assert.equal(result.aebOutput.overwriteAllowed, false);
    assert.equal(result.aebOutput.bytesBase64, undefined);
    assert.equal(result.aebOutput.expectedSha256, undefined);
    assert.match(result.aebOutput.saveToken, /^[a-f0-9]{48}$/u);
    assert.equal(result.aebOutput.packageSha256, result.aeb.package.sha256);
    assert.equal(result.aebOutput.generatedSvgaSha256, result.aeb.generatedSvga.sha256);

    const hostOwnedOutput = session.resolveSaveOutput({
      command: "saveAs",
      saveToken: result.aebOutput.saveToken,
      packageSha256: result.aebOutput.packageSha256,
      generatedSvgaSha256: result.aebOutput.generatedSvgaSha256
    });
    assert.equal(sha256(hostOwnedOutput.bytes), result.aeb.generatedSvga.sha256);
    assert.equal(hostOwnedOutput.bytes.byteLength, 831);
    assert.equal(
      sha256(hostOwnedOutput.bytes),
      "b65e06e931c30543c85d4fa030fddbee4b74f77f8f4315ff734e118851077fea"
    );
    assert.equal(hostOwnedOutput.suggestedName, result.aebOutput.suggestedName);

    const { NodeProtobufSvgaInspector, SvgaFormatAdapter } = await import(
      pathToFileURL(path.join(repoRoot, "dist/workbench/svga/index.js")).href
    );
    const source = {
      id: "task-owned:canonical-aeb-fixture",
      name: "canonical-aeb-fixture.svga",
      sizeBytes: hostOwnedOutput.bytes.byteLength,
      mediaType: "application/octet-stream",
      async read() {
        return hostOwnedOutput.bytes;
      }
    };
    const adapter = new SvgaFormatAdapter(new NodeProtobufSvgaInspector());
    assert.deepEqual(await adapter.probe(source), {
      format: "svga",
      confidence: 1,
      issues: []
    });
    const parsed = await adapter.parse(source);
    assert.deepEqual(parsed.issues, []);
    assert.deepEqual(parsed.value?.dimensions, { width: 300, height: 300 });
    assert.deepEqual(parsed.value?.timing, {
      fps: 24,
      frameCount: 120,
      durationMs: 5_000
    });
    assert.equal(parsed.value?.resources.length, 1);
    assert.equal(parsed.value?.layers.length, 1);

    const prepared = await session.prepareRuntimePreview({
      sourceId: result.sourceId,
      format: "svga",
      requestId: result.model.requestId
    });
    assert.equal(prepared.status, "prepared");
    assert.equal(prepared.format, "svga");
    assert.ok(prepared.svgaBase64.length > 0);
    assert.equal((await session.control({ action: "play" })).model.status, "playing");
    assert.equal((await session.control({ action: "pause" })).model.status, "paused");

    assert.deepEqual(await readFile(fixture.packagePath), beforePackage);
    assert.deepEqual(await readFile(fixture.assetPath), beforeAsset);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("native footage timing binds AE in/out points through project, map, Preview, and Save bytes", async () => {
  const root = await mkdtemp(path.join("/private/tmp", "auto-svga-aeb-native-timing-"));
  try {
    const fixture = await writePackageFixture(path.join(root, "package"), {
      hostTiming: { inPoint: 1, outPoint: 3, startTime: 0, stretch: 100 },
      nativeKeyframes: keyframesForRange({ start: 24, end: 71 })
    });
    const previewSession = createMultiFormatDesktopPreviewSession({
      repoRoot,
      sessionRoot: path.join(root, "session"),
      sourceStore: new Map(),
      openTimeoutMs: 3_000
    });
    const session = createAebNativePreviewSession({
      repoRoot,
      sessionRoot: path.join(root, "session"),
      previewSession
    });

    const result = await session.openPackagePath(fixture.packageRoot);
    assert.equal(result.status, "opened");
    assert.equal(result.model.status, "playing", JSON.stringify(result.model.rightPanel?.issues));
    const saveOutput = session.resolveSaveOutput({
      command: "saveAs",
      saveToken: result.aebOutput.saveToken,
      packageSha256: result.aebOutput.packageSha256,
      generatedSvgaSha256: result.aebOutput.generatedSvgaSha256
    });
    const identity = session.readActiveGeneratedIdentity();
    const project = JSON.parse(identity.files.projectBytes.toString("utf8"));
    const map = JSON.parse(identity.files.mapBytes.toString("utf8"));
    const decoded = await decodeSvga(saveOutput.bytes);

    assert.deepEqual(project.layers[0].activeFrameRange, { start: 24, end: 71 });
    assert.deepEqual(project.layers[0].sourceTiming.frameBoundaryContract, {
      version: "frame_boundary_v1",
      arithmetic: "ieee754_binary64",
      framePosition: "seconds_times_fps",
      predicate: "abs(frame_position-round(frame_position))<=epsilon",
      epsilon: 1e-9,
      epsilonUnit: "frames",
      snap: "nearest_integer_within_epsilon",
      interval: "in_inclusive_out_exclusive"
    });
    assert.deepEqual(map.sprites[0].visibleFrameRange, { start: 24, end: 71 });
    assert.deepEqual(map.sprites[0].sourceTiming, project.layers[0].sourceTiming);
    assertNear(decoded.sprites[0].frames[0].alpha ?? 0, 0);
    assertNear(decoded.sprites[0].frames[23].alpha ?? 0, 0);
    assert.ok(decoded.sprites[0].frames[24].alpha > 0);
    assert.ok(decoded.sprites[0].frames[71].alpha > 0);
    assertNear(decoded.sprites[0].frames[72].alpha ?? 0, 0);
    assertNear(decoded.sprites[0].frames[119].alpha ?? 0, 0);
    assert.equal(result.aebOutput.saveAsAllowed, true);
    assert.equal(sha256(saveOutput.bytes), result.aeb.generatedSvga.sha256);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("native footage transform samples bind exactly to the layer active range", async () => {
  const root = await mkdtemp(path.join("/private/tmp", "auto-svga-aeb-active-range-samples-"));
  const activeKeyframes = [
    { frame: 24, x: 150, y: 150, scaleX: 1, scaleY: 1, rotation: 0, opacity: 1 },
    { frame: 47, x: 180, y: 145, scaleX: 1.1, scaleY: 0.9, rotation: 12, opacity: 0.75 },
    { frame: 71, x: 170, y: 150, scaleX: 1, scaleY: 1, rotation: 0, opacity: 1 }
  ];
  try {
    const acceptedFixture = await writePackageFixture(path.join(root, "accepted-package"), {
      hostTiming: { inPoint: 1, outPoint: 3, startTime: 0, stretch: 100 },
      nativeKeyframes: activeKeyframes
    });
    const acceptedSessionRoot = path.join(root, "accepted-session");
    const acceptedSession = createAebNativePreviewSession({
      repoRoot,
      sessionRoot: acceptedSessionRoot,
      previewSession: createMultiFormatDesktopPreviewSession({
        repoRoot,
        sessionRoot: acceptedSessionRoot,
        sourceStore: new Map(),
        openTimeoutMs: 3_000
      })
    });

    const accepted = await acceptedSession.openPackagePath(acceptedFixture.packageRoot);
    assert.equal(accepted.model.status, "playing", JSON.stringify(accepted.model.rightPanel?.issues));
    const identity = acceptedSession.readActiveGeneratedIdentity();
    const project = JSON.parse(identity.files.projectBytes.toString("utf8"));
    const map = JSON.parse(identity.files.mapBytes.toString("utf8"));
    const saveOutput = acceptedSession.resolveSaveOutput({
      command: "saveAs",
      saveToken: accepted.aebOutput.saveToken,
      packageSha256: accepted.aebOutput.packageSha256,
      generatedSvgaSha256: accepted.aebOutput.generatedSvgaSha256
    });
    const decoded = await decodeSvga(saveOutput.bytes);

    assert.deepEqual(project.layers[0].activeFrameRange, { start: 24, end: 71 });
    assert.deepEqual(project.animations[0].keyframes, activeKeyframes);
    assert.deepEqual(map.sprites[0].visibleFrameRange, { start: 24, end: 71 });
    assert.deepEqual(map.sprites[0].keyframes, activeKeyframes);
    assertNear(decoded.sprites[0].frames[23].alpha ?? 0, 0);
    assert.ok(decoded.sprites[0].frames[24].alpha > 0);
    assertFrameTransform(decoded.sprites[0].frames[24], matrixFor({
      x: 150,
      y: 150,
      scaleX: 1,
      scaleY: 1,
      rotation: 0,
      anchorX: 60,
      anchorY: 40
    }));
    assertFrameTransform(decoded.sprites[0].frames[47], matrixFor({
      x: 180,
      y: 145,
      scaleX: 1.1,
      scaleY: 0.9,
      rotation: 12,
      anchorX: 60,
      anchorY: 40
    }));
    assert.ok(decoded.sprites[0].frames[71].alpha > 0);
    assertNear(decoded.sprites[0].frames[72].alpha ?? 0, 0);
    assert.equal(accepted.aebOutput.saveAsAllowed, true);
    assert.equal(sha256(saveOutput.bytes), accepted.aeb.generatedSvga.sha256);

    const singleSampleFixture = await writePackageFixture(path.join(root, "single-sample-package"), {
      hostTiming: { inPoint: 1, outPoint: 24.5 / 24, startTime: 0, stretch: 100 },
      nativeKeyframes: keyframesForRange({ start: 24, end: 24 })
    });
    const singleSampleSessionRoot = path.join(root, "single-sample-session");
    const singleSampleSession = createAebNativePreviewSession({
      repoRoot,
      sessionRoot: singleSampleSessionRoot,
      previewSession: createMultiFormatDesktopPreviewSession({
        repoRoot,
        sessionRoot: singleSampleSessionRoot,
        sourceStore: new Map(),
        openTimeoutMs: 3_000
      })
    });
    const singleSample = await singleSampleSession.openPackagePath(singleSampleFixture.packageRoot);
    assert.equal(singleSample.model.status, "playing", JSON.stringify(singleSample.model.rightPanel?.issues));
    const singleSampleProject = JSON.parse(singleSampleSession.readActiveGeneratedIdentity().files.projectBytes.toString("utf8"));
    assert.deepEqual(singleSampleProject.layers[0].activeFrameRange, { start: 24, end: 24 });
    assert.deepEqual(singleSampleProject.animations[0].keyframes, keyframesForRange({ start: 24, end: 24 }));
    assert.equal(singleSample.aebOutput.saveAsAllowed, true);

    const rejectedCases = [
      { name: "composition-endpoints", keyframes: undefined },
      { name: "missing-active-start", keyframes: keyframesForRange({ start: 25, end: 71 }) },
      { name: "missing-active-end", keyframes: keyframesForRange({ start: 24, end: 70 }) },
      { name: "before-active-start", keyframes: keyframesForRange({ start: 23, end: 71 }) },
      { name: "after-active-end", keyframes: keyframesForRange({ start: 24, end: 72 }) }
    ];
    for (const entry of rejectedCases) {
      const rejectedFixture = await writePackageFixture(path.join(root, `${entry.name}-package`), {
        hostTiming: { inPoint: 1, outPoint: 3, startTime: 0, stretch: 100 },
        nativeKeyframes: entry.keyframes
      });
      const preview = previewSpy();
      const purposes = [];
      const rejectedSessionRoot = path.join(root, `${entry.name}-session`);
      const rejectedSession = createAebNativePreviewSession({
        repoRoot,
        sessionRoot: rejectedSessionRoot,
        previewSession: preview.session,
        fileReadHooks: { afterOpen: ({ purpose }) => purposes.push(purpose) }
      });

      const rejected = await rejectedSession.openPackagePath(rejectedFixture.packageRoot);
      assert.equal(rejected.model.status, "failed", entry.name);
      assert.ok(rejected.model.rightPanel.issues.some((issue) => issue.code === "aeb.native_keyframe_range_mismatch"), entry.name);
      assert.deepEqual(purposes, ["package-json"], entry.name);
      assert.equal(rejected.aebOutput, null, entry.name);
      assert.equal(preview.calls.length, 0, entry.name);
      assert.equal(existsSync(path.join(rejectedSessionRoot, "aeb-native-preview")), false, entry.name);
    }
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("native visible=false remains transparent through project, map, Preview, and Save bytes", async () => {
  const root = await mkdtemp(path.join("/private/tmp", "auto-svga-aeb-native-hidden-layer-"));
  try {
    const fixture = await writePackageFixture(path.join(root, "package"), {
      nativeVisible: false,
      hostTiming: { inPoint: 1, outPoint: 3, startTime: 0, stretch: 100 },
      nativeKeyframes: keyframesForRange({ start: 24, end: 71 })
    });
    const session = createAebNativePreviewSession({
      repoRoot,
      sessionRoot: path.join(root, "session"),
      previewSession: createMultiFormatDesktopPreviewSession({
        repoRoot,
        sessionRoot: path.join(root, "session"),
        sourceStore: new Map(),
        openTimeoutMs: 3_000
      })
    });

    const result = await session.openPackagePath(fixture.packageRoot);
    assert.equal(result.model.status, "playing", JSON.stringify(result.model.rightPanel?.issues));
    const saveOutput = session.resolveSaveOutput({
      command: "saveAs",
      saveToken: result.aebOutput.saveToken,
      packageSha256: result.aebOutput.packageSha256,
      generatedSvgaSha256: result.aebOutput.generatedSvgaSha256
    });
    const identity = session.readActiveGeneratedIdentity();
    const project = JSON.parse(identity.files.projectBytes.toString("utf8"));
    const map = JSON.parse(identity.files.mapBytes.toString("utf8"));
    const decoded = await decodeSvga(saveOutput.bytes);

    assert.equal(project.layers[0].visible, false);
    assert.deepEqual(project.layers[0].activeFrameRange, { start: 24, end: 71 });
    assert.equal(map.sprites[0].visible, false);
    assert.deepEqual(map.sprites[0].visibleFrameRange, { start: 24, end: 71 });
    assert.ok(decoded.sprites[0].frames.every((frame) => (frame.alpha ?? 0) === 0));
    assert.equal(result.aebOutput.saveAsAllowed, true);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("multi-layer native package preserves deterministic stack order, local anchors, and resource identities", async () => {
  const root = await mkdtemp(path.join("/private/tmp", "auto-svga-aeb-multi-layer-native-"));
  try {
    const firstFixture = await writeMultiLayerPackageFixture(path.join(root, "first"));
    const reorderedFixture = await writeMultiLayerPackageFixture(path.join(root, "reordered"), { reverseInput: true });
    const tiedFixture = await writeMultiLayerPackageFixture(path.join(root, "tied"), {
      reverseInput: true,
      equalZIndex: true
    });
    const open = async (fixture, sessionName) => {
      const sessionRoot = path.join(root, sessionName);
      const session = createAebNativePreviewSession({
        repoRoot,
        sessionRoot,
        previewSession: createMultiFormatDesktopPreviewSession({
          repoRoot,
          sessionRoot,
          sourceStore: new Map(),
          openTimeoutMs: 3_000
        })
      });
      const result = await session.openPackagePath(fixture.packageRoot);
      assert.equal(result.status, "opened");
      assert.equal(result.model.status, "playing", JSON.stringify(result.model.rightPanel?.issues));
      assert.deepEqual(result.aeb.compatibility.counts, {
        native: 2,
        bake_required: 0,
        blocked: 0,
        suggestion_only: 0
      });
      assert.equal(result.aeb.generatedSvga.validation.imageCount, 2);
      assert.equal(result.aeb.generatedSvga.validation.spriteCount, 2);
      const saveOutput = session.resolveSaveOutput({
        command: "saveAs",
        saveToken: result.aebOutput.saveToken,
        packageSha256: result.aebOutput.packageSha256,
        generatedSvgaSha256: result.aebOutput.generatedSvgaSha256
      });
      const identity = session.readActiveGeneratedIdentity();
      return {
        result,
        saveOutput,
        identity,
        project: JSON.parse(identity.files.projectBytes.toString("utf8")),
        map: JSON.parse(identity.files.mapBytes.toString("utf8")),
        assetSet: JSON.parse(identity.files.assetSetBytes.toString("utf8")),
        decoded: await decodeSvga(saveOutput.bytes)
      };
    };

    const first = await open(firstFixture, "first-session");
    const reordered = await open(reorderedFixture, "reordered-session");
    const tied = await open(tiedFixture, "tied-session");
    const expectedResourceOrder = [
      firstFixture.assetSha256ById["asset-task-fixture-0002"],
      firstFixture.assetSha256ById["asset-task-fixture-0001"]
    ];
    assert.deepEqual(resourceHashesInSpriteOrder(first.decoded), expectedResourceOrder);
    assert.deepEqual(resourceHashesInSpriteOrder(reordered.decoded), expectedResourceOrder);
    assert.equal(sha256(first.saveOutput.bytes), "ff02ea07f5588dda8791426804e2253aff8e38ce27db31966f7576338bb5c034");
    assert.equal(sha256(first.saveOutput.bytes), sha256(reordered.saveOutput.bytes));

    assertFrameTransform(first.decoded.sprites[0].frames[0], matrixFor({
      x: 75,
      y: 210,
      scaleX: 0.8,
      scaleY: 1.1,
      rotation: -20,
      anchorX: 8,
      anchorY: 36
    }));
    assertFrameTransform(first.decoded.sprites[1].frames[0], matrixFor({
      x: 220,
      y: 90,
      scaleX: 1.2,
      scaleY: 0.7,
      rotation: 30,
      anchorX: 12,
      anchorY: 18
    }));
    assertFrameTransform(first.decoded.sprites[0].frames[119], matrixFor({
      x: 95,
      y: 180,
      scaleX: 1.1,
      scaleY: 0.9,
      rotation: 10,
      anchorX: 8,
      anchorY: 36
    }));
    assertFrameTransform(first.decoded.sprites[1].frames[119], matrixFor({
      x: 240,
      y: 110,
      scaleX: 1,
      scaleY: 1,
      rotation: 60,
      anchorX: 12,
      anchorY: 18
    }));
    assertNear(first.decoded.sprites[0].frames[0].alpha, 0.9);
    assertNear(first.decoded.sprites[0].frames[119].alpha, 0.6);
    assertNear(first.decoded.sprites[1].frames[0].alpha, 0.75);
    assertNear(first.decoded.sprites[1].frames[119].alpha, 1);

    assert.deepEqual(first.project.layers.map((layer) => layer.id), [
      "layer-task-fixture-0002",
      "layer-task-fixture-0001"
    ]);
    assert.deepEqual(first.project.layers.map((layer) => layer.anchor), [
      { x: 8, y: 36 },
      { x: 12, y: 18 }
    ]);
    assert.deepEqual(first.map.sprites.map((sprite) => ({ layerId: sprite.layerId, anchor: sprite.anchor })), [
      { layerId: "layer-task-fixture-0002", anchor: { x: 8, y: 36 } },
      { layerId: "layer-task-fixture-0001", anchor: { x: 12, y: 18 } }
    ]);
    assert.deepEqual(first.assetSet.map((asset) => asset.id), [
      "asset-task-fixture-0001",
      "asset-task-fixture-0002"
    ]);
    assert.deepEqual(reordered.project, first.project);
    assert.deepEqual(reordered.map, first.map);
    assert.deepEqual(reordered.assetSet, first.assetSet);
    assert.deepEqual(tied.project.layers.map((layer) => layer.id), [
      "layer-task-fixture-0001",
      "layer-task-fixture-0002"
    ]);
    assert.deepEqual(resourceHashesInSpriteOrder(tied.decoded), [
      tiedFixture.assetSha256ById["asset-task-fixture-0001"],
      tiedFixture.assetSha256ById["asset-task-fixture-0002"]
    ]);
    assert.equal(first.result.aebOutput.saveAsAllowed, true);
    assert.equal(first.result.aeb.package.sourceImmutable, true);
    assert.equal(reordered.result.aeb.package.sourceImmutable, true);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("native signed and zero scale preserve mirror and scale-in footage through Preview and Save", async () => {
  const root = await mkdtemp(path.join("/private/tmp", "auto-svga-aeb-native-scale-fidelity-"));
  const mirrorTransform = { x: 220, y: 90, scaleX: -1.2, scaleY: 0.7, rotation: 30, opacity: 0.75 };
  const mirrorKeyframes = [
    { frame: 0, ...mirrorTransform },
    { frame: 119, x: 240, y: 110, scaleX: -0.5, scaleY: 1, rotation: 60, opacity: 1 }
  ];
  const scaleInTransform = { x: 75, y: 210, scaleX: 0, scaleY: 0, rotation: -20, opacity: 0.9 };
  const scaleInKeyframes = [
    { frame: 0, ...scaleInTransform },
    { frame: 60, x: 85, y: 195, scaleX: 0.5, scaleY: 0.75, rotation: -5, opacity: 0.8 },
    { frame: 119, x: 95, y: 180, scaleX: 1.1, scaleY: 0.9, rotation: 10, opacity: 0.6 }
  ];
  try {
    const fixture = await writeMultiLayerPackageFixture(path.join(root, "package"));
    await mutatePackage(fixture.packagePath, (pkg) => {
      const layersById = new Map(pkg.semanticGraph.layers.map((layer) => [layer.layerId, layer]));
      const mirrorLayer = layersById.get("layer-task-fixture-0001");
      const scaleInLayer = layersById.get("layer-task-fixture-0002");
      mirrorLayer.transform = mirrorTransform;
      mirrorLayer.keyframes = mirrorKeyframes;
      scaleInLayer.transform = scaleInTransform;
      scaleInLayer.keyframes = scaleInKeyframes;
    });
    const beforePackage = await readFile(fixture.packagePath);
    const beforeFirstAsset = await readFile(fixture.assetPath);
    const beforeSecondAsset = await readFile(fixture.secondPath);
    const sessionRoot = path.join(root, "session");
    const session = createAebNativePreviewSession({
      repoRoot,
      sessionRoot,
      previewSession: createMultiFormatDesktopPreviewSession({
        repoRoot,
        sessionRoot,
        sourceStore: new Map(),
        openTimeoutMs: 3_000
      })
    });

    const result = await session.openPackagePath(fixture.packageRoot);

    assert.equal(result.status, "opened");
    assert.equal(result.model.status, "playing", JSON.stringify(result.model.rightPanel?.issues));
    assert.equal(result.aeb.generatedSvga.validation.inflated, true);
    assert.equal(result.aeb.generatedSvga.validation.decoded, true);
    assert.equal(result.aeb.generatedSvga.validation.spriteCount, 2);
    const identity = session.readActiveGeneratedIdentity();
    const project = JSON.parse(identity.files.projectBytes.toString("utf8"));
    const map = JSON.parse(identity.files.mapBytes.toString("utf8"));
    const projectLayers = new Map(project.layers.map((layer) => [layer.id, layer]));
    const mapSprites = new Map(map.sprites.map((sprite) => [sprite.layerId, sprite]));
    assert.deepEqual(projectLayers.get("layer-task-fixture-0001").transform, mirrorTransform);
    assert.deepEqual(project.animations.find((animation) => animation.targetLayerId === "layer-task-fixture-0001").keyframes, mirrorKeyframes);
    assert.deepEqual(projectLayers.get("layer-task-fixture-0002").transform, scaleInTransform);
    assert.deepEqual(project.animations.find((animation) => animation.targetLayerId === "layer-task-fixture-0002").keyframes, scaleInKeyframes);
    assert.deepEqual(mapSprites.get("layer-task-fixture-0001").transform, mirrorTransform);
    assert.deepEqual(mapSprites.get("layer-task-fixture-0001").keyframes, mirrorKeyframes);
    assert.deepEqual(mapSprites.get("layer-task-fixture-0002").transform, scaleInTransform);
    assert.deepEqual(mapSprites.get("layer-task-fixture-0002").keyframes, scaleInKeyframes);

    const saveOutput = session.resolveSaveOutput({
      command: "saveAs",
      saveToken: result.aebOutput.saveToken,
      packageSha256: result.aebOutput.packageSha256,
      generatedSvgaSha256: result.aebOutput.generatedSvgaSha256
    });
    const decoded = await decodeSvga(saveOutput.bytes);
    assert.deepEqual(resourceHashesInSpriteOrder(decoded), [
      fixture.assetSha256ById["asset-task-fixture-0002"],
      fixture.assetSha256ById["asset-task-fixture-0001"]
    ]);
    assertFrameTransform(decoded.sprites[0].frames[0], matrixFor({
      ...scaleInKeyframes[0],
      anchorX: 8,
      anchorY: 36
    }), 1e-4);
    assertFrameTransform(decoded.sprites[0].frames[60], matrixFor({
      ...scaleInKeyframes[1],
      anchorX: 8,
      anchorY: 36
    }), 1e-4);
    assertFrameTransform(decoded.sprites[0].frames[119], matrixFor({
      ...scaleInKeyframes[2],
      anchorX: 8,
      anchorY: 36
    }), 1e-4);
    assertFrameTransform(decoded.sprites[1].frames[0], matrixFor({
      ...mirrorKeyframes[0],
      anchorX: 12,
      anchorY: 18
    }), 1e-4);
    assertFrameTransform(decoded.sprites[1].frames[119], matrixFor({
      ...mirrorKeyframes[1],
      anchorX: 12,
      anchorY: 18
    }), 1e-4);
    assert.equal(sha256(saveOutput.bytes), result.aeb.generatedSvga.sha256);
    assert.equal(result.aebOutput.saveAsAllowed, true);

    const prepared = await session.prepareRuntimePreview({
      sourceId: result.sourceId,
      format: "svga",
      requestId: result.model.requestId
    });
    assert.equal(prepared.status, "prepared");
    assert.equal((await session.control({ action: "play" })).model.status, "playing");
    assert.equal((await session.control({ action: "pause" })).model.status, "paused");
    assert.deepEqual(await readFile(fixture.packagePath), beforePackage);
    assert.deepEqual(await readFile(fixture.assetPath), beforeFirstAsset);
    assert.deepEqual(await readFile(fixture.secondPath), beforeSecondAsset);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("versioned SVGA float32 contract has explicit rounding, zero, underflow, and finite boundaries", async () => {
  const {
    SVGA_FLOAT_SERIALIZATION_CONTRACT,
    SVGA_GENERATED_NATIVE_OUTPUT_AUTHORITY_CONTRACT,
    SVGA_GENERATED_NATIVE_STRUCTURE_CONTRACT,
    canonicalizeSvgaFloat32
  } = await import(pathToFileURL(path.join(repoRoot, "dist/core/svga-float-serialization.js")).href);
  const maximum = SVGA_FLOAT_SERIALIZATION_CONTRACT.maximumFiniteMagnitude;
  const minimum = SVGA_FLOAT_SERIALIZATION_CONTRACT.minimumNonzeroMagnitude;

  assert.equal(SVGA_FLOAT_SERIALIZATION_CONTRACT.version, "svga_float32_v1");
  assert.equal(SVGA_GENERATED_NATIVE_STRUCTURE_CONTRACT.version, "svga_generated_native_frame_v1");
  assert.equal(SVGA_GENERATED_NATIVE_OUTPUT_AUTHORITY_CONTRACT.version, "aeb_generated_native_output_authority_v1");
  assert.equal(Object.isFrozen(SVGA_GENERATED_NATIVE_STRUCTURE_CONTRACT), true);
  assert.equal(Object.isFrozen(SVGA_GENERATED_NATIVE_OUTPUT_AUTHORITY_CONTRACT), true);
  assert.deepEqual(SVGA_GENERATED_NATIVE_OUTPUT_AUTHORITY_CONTRACT.movieVocabulary, ["version", "params", "images", "sprites"]);
  assert.deepEqual(SVGA_GENERATED_NATIVE_OUTPUT_AUTHORITY_CONTRACT.unsupportedFrameFields, ["clipPath", "shapes", "unknown_fields"]);
  assert.equal(Object.isFrozen(SVGA_GENERATED_NATIVE_STRUCTURE_CONTRACT.requiredTransformFields), true);
  assert.deepEqual(SVGA_GENERATED_NATIVE_STRUCTURE_CONTRACT.requiredFrameFields, ["alpha", "layout", "transform"]);
  assert.equal(canonicalizeSvgaFloat32(0.1), Math.fround(0.1));
  assert.equal(canonicalizeSvgaFloat32(maximum), maximum);
  assert.equal(canonicalizeSvgaFloat32(-maximum), -maximum);
  assert.equal(canonicalizeSvgaFloat32(minimum), minimum);
  assert.equal(canonicalizeSvgaFloat32(-minimum), -minimum);
  assert.equal(canonicalizeSvgaFloat32(-0), 0);
  assert.equal(Object.is(canonicalizeSvgaFloat32(-0), -0), false);
  assert.throws(() => canonicalizeSvgaFloat32(adjacentFloat(maximum, 1)), { code: "svga_float_serialization_invalid" });
  assert.throws(() => canonicalizeSvgaFloat32(-adjacentFloat(maximum, 1)), { code: "svga_float_serialization_invalid" });
  assert.throws(() => canonicalizeSvgaFloat32(adjacentFloat(minimum, -1)), { code: "svga_float_serialization_invalid" });
  assert.throws(() => canonicalizeSvgaFloat32(-adjacentFloat(minimum, -1)), { code: "svga_float_serialization_invalid" });
});

test("native float32 serialization rejects source, composition, and interpolated overflow before downstream authority", async () => {
  const root = await mkdtemp(path.join("/private/tmp", "auto-svga-aeb-native-float32-reject-"));
  try {
    const { SVGA_FLOAT_SERIALIZATION_CONTRACT } = await import(
      pathToFileURL(path.join(repoRoot, "dist/core/svga-float-serialization.js")).href
    );
    const maximum = SVGA_FLOAT_SERIALIZATION_CONTRACT.maximumFiniteMagnitude;
    const minimum = SVGA_FLOAT_SERIALIZATION_CONTRACT.minimumNonzeroMagnitude;
    const cases = [
      {
        name: "scale-overflow",
        options: {
          nativeAnchor: { x: 0, y: 0 },
          nativeTransform: { x: 0, y: 0, scaleX: 3.5e38, scaleY: 1, rotation: 0, opacity: 1 },
          nativeKeyframes: [
            { frame: 0, x: 0, y: 0, scaleX: 3.5e38, scaleY: 1, rotation: 0, opacity: 1 },
            { frame: 119, x: 0, y: 0, scaleX: 3.5e38, scaleY: 1, rotation: 0, opacity: 1 }
          ]
        }
      },
      {
        name: "active-range-endpoint-overflow",
        options: {
          nativeAnchor: { x: 0, y: 0 },
          nativeTransform: { x: 0, y: 0, scaleX: 1, scaleY: 1, rotation: 0, opacity: 1 },
          nativeKeyframes: [
            { frame: 0, x: 0, y: 0, scaleX: 1, scaleY: 1, rotation: 0, opacity: 1 },
            { frame: 119, x: 0, y: 0, scaleX: 3.5e38, scaleY: 1, rotation: 0, opacity: 1 }
          ]
        }
      },
      {
        name: "immediately-outside-maximum",
        options: {
          nativeAnchor: { x: 0, y: 0 },
          nativeTransform: { x: 0, y: 0, scaleX: adjacentFloat(maximum, 1), scaleY: 1, rotation: 0, opacity: 1 },
          nativeKeyframes: [
            { frame: 0, x: 0, y: 0, scaleX: adjacentFloat(maximum, 1), scaleY: 1, rotation: 0, opacity: 1 },
            { frame: 119, x: 0, y: 0, scaleX: adjacentFloat(maximum, 1), scaleY: 1, rotation: 0, opacity: 1 }
          ]
        }
      },
      {
        name: "nonzero-underflow",
        options: {
          nativeAnchor: { x: 0, y: 0 },
          nativeTransform: { x: 0, y: 0, scaleX: adjacentFloat(minimum, -1), scaleY: 1, rotation: 0, opacity: 1 },
          nativeKeyframes: [
            { frame: 0, x: 0, y: 0, scaleX: adjacentFloat(minimum, -1), scaleY: 1, rotation: 0, opacity: 1 },
            { frame: 119, x: 0, y: 0, scaleX: adjacentFloat(minimum, -1), scaleY: 1, rotation: 0, opacity: 1 }
          ]
        }
      },
      {
        name: "anchor-translation-overflow",
        options: {
          nativeAnchor: { x: 2, y: 2 },
          nativeTransform: { x: 0, y: 0, scaleX: maximum, scaleY: maximum, rotation: 0, opacity: 1 },
          nativeKeyframes: [
            { frame: 0, x: 0, y: 0, scaleX: maximum, scaleY: maximum, rotation: 0, opacity: 1 },
            { frame: 119, x: 0, y: 0, scaleX: maximum, scaleY: maximum, rotation: 0, opacity: 1 }
          ]
        }
      },
      {
        name: "interior-frame-composition-overflow",
        options: {
          composition: { durationFrames: 3 },
          hostTiming: { inPoint: 0, outPoint: 3 / 24, startTime: 0, stretch: 100 },
          nativeAnchor: { x: 1, y: 1 },
          nativeTransform: { x: 0, y: 0, scaleX: maximum, scaleY: maximum, rotation: 0, opacity: 1 },
          nativeKeyframes: [
            { frame: 0, x: 0, y: 0, scaleX: maximum, scaleY: maximum, rotation: 0, opacity: 1 },
            { frame: 2, x: 0, y: 0, scaleX: maximum, scaleY: maximum, rotation: 90, opacity: 1 }
          ]
        }
      }
    ];
    for (const entry of cases) {
      const fixture = await writePackageFixture(path.join(root, entry.name), entry.options);
      const purposes = [];
      const preview = previewSpy();
      const sessionRoot = path.join(root, `${entry.name}-session`);
      let exporterCreated = false;
      const session = createAebNativePreviewSession({
        repoRoot,
        sessionRoot,
        previewSession: preview.session,
        fileReadHooks: { afterOpen: ({ purpose }) => purposes.push(purpose) },
        exporterFactory() {
          exporterCreated = true;
          throw new Error("exporter must not be created for float32 rejection");
        }
      });

      const result = await session.openPackagePath(fixture.packageRoot);

      assert.equal(result.model.status, "failed", entry.name);
      assert.ok(result.model.rightPanel.issues.some((issue) => issue.code === "aeb.svga_float_serialization_invalid"), entry.name);
      assert.deepEqual(purposes, ["package-json"], entry.name);
      assert.equal(exporterCreated, false, entry.name);
      assert.equal(preview.calls.length, 0, entry.name);
      assert.equal(result.aeb.generatedSvga, null, entry.name);
      assert.equal(result.aebOutput, null, entry.name);
      assert.deepEqual(await outputEntries(sessionRoot), [], entry.name);
    }
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("native float32 boundary values emit canonical decoded matrices and retain Preview and Save authority", async () => {
  const root = await mkdtemp(path.join("/private/tmp", "auto-svga-aeb-native-float32-boundary-"));
  try {
    const { SVGA_FLOAT_SERIALIZATION_CONTRACT } = await import(
      pathToFileURL(path.join(repoRoot, "dist/core/svga-float-serialization.js")).href
    );
    const maximum = SVGA_FLOAT_SERIALIZATION_CONTRACT.maximumFiniteMagnitude;
    const minimum = SVGA_FLOAT_SERIALIZATION_CONTRACT.minimumNonzeroMagnitude;
    const boundaryTransform = { x: 0, y: 0, scaleX: maximum, scaleY: -minimum, rotation: 0, opacity: 1 };
    const fixture = await writePackageFixture(path.join(root, "package"), {
      nativeAnchor: { x: 0, y: 0 },
      nativeTransform: boundaryTransform,
      nativeKeyframes: [
        { frame: 0, ...boundaryTransform },
        { frame: 119, ...boundaryTransform }
      ]
    });
    const sessionRoot = path.join(root, "session");
    const session = createAebNativePreviewSession({
      repoRoot,
      sessionRoot,
      previewSession: createMultiFormatDesktopPreviewSession({
        repoRoot,
        sessionRoot,
        sourceStore: new Map(),
        openTimeoutMs: 3_000
      })
    });

    const result = await session.openPackagePath(fixture.packageRoot);

    assert.equal(result.model.status, "playing", JSON.stringify(result.model.rightPanel?.issues));
    assert.equal(result.aeb.generatedSvga.validation.floatContractVersion, "svga_float32_v1");
    assert.equal(result.aeb.generatedSvga.validation.canonicalFloatValues, true);
    assert.equal(result.aeb.generatedSvga.validation.structureContractVersion, "svga_generated_native_frame_v1");
    assert.equal(result.aeb.generatedSvga.validation.generatedNativeStructureValid, true);
    assert.equal(result.aeb.generatedSvga.validation.allSpriteFrameCountsMatch, true);
    assert.equal(result.aeb.generatedSvga.validation.requiredFrameFieldsPresent, true);
    assert.deepEqual(result.aeb.generatedSvga.validation.spriteFrameCounts, [120]);
    assert.equal(result.aeb.generatedSvga.validation.totalFrameRecords, 120);
    const saveOutput = session.resolveSaveOutput({
      command: "saveAs",
      saveToken: result.aebOutput.saveToken,
      packageSha256: result.aebOutput.packageSha256,
      generatedSvgaSha256: result.aebOutput.generatedSvgaSha256
    });
    const decoded = await decodeSvga(saveOutput.bytes);
    const matrix = decoded.sprites[0].frames[0].transform;
    assert.equal(matrix.a, maximum);
    assert.equal(matrix.d, -minimum);
    for (const field of ["b", "c", "tx", "ty"]) {
      assert.equal(matrix[field] ?? 0, 0, field);
      assert.equal(Object.is(matrix[field] ?? 0, -0), false, field);
    }
    assert.equal(sha256(saveOutput.bytes), result.aeb.generatedSvga.sha256);
    assert.equal(result.aebOutput.saveAsAllowed, true);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("independent generated-SVGA validation rejects a forged nonfinite decoded matrix", async () => {
  const root = await mkdtemp(path.join("/private/tmp", "auto-svga-aeb-native-float32-forged-output-"));
  try {
    const fixture = await writePackageFixture(path.join(root, "package"));
    const forgedBytes = await encodeSvgaWithMatrix({
      a: Number.POSITIVE_INFINITY,
      b: 0,
      c: 0,
      d: 1,
      tx: Number.NEGATIVE_INFINITY,
      ty: 0
    }, await readFile(fixture.assetPath), 120);
    const preview = previewSpy();
    const sessionRoot = path.join(root, "session");
    const session = createAebNativePreviewSession({
      repoRoot,
      sessionRoot,
      previewSession: preview.session,
      exporterFactory: () => ({
        async export(project, outputRoot) {
          const outputPath = path.join(outputRoot, "forged-nonfinite.svga");
          await writeFile(outputPath, forgedBytes);
          return {
            outputPath,
            validation: {
              exists: true,
              inflated: true,
              decoded: true,
              imageCount: 1,
              spriteCount: project.layers.length,
              frameCount: project.durationFrames,
              floatContractVersion: "svga_float32_v1",
              canonicalFloatValues: true
            }
          };
        }
      })
    });

    const result = await session.openPackagePath(fixture.packageRoot);

    assert.equal(result.model.status, "failed");
    assert.ok(result.model.rightPanel.issues.some((issue) => issue.code === "aeb.native_svga_float_validation_failed"));
    assert.equal(preview.calls.length, 0);
    assert.equal(result.aeb.generatedSvga, null);
    assert.equal(result.aebOutput, null);
    assert.deepEqual(await outputEntries(sessionRoot), []);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("generated native FrameEntity structure rejects missing records, scalars, and timeline cardinality", async () => {
  const root = await mkdtemp(path.join("/private/tmp", "auto-svga-aeb-native-frame-structure-"));
  try {
    const fixture = await writePackageFixture(path.join(root, "package"));
    const validBytes = await encodeSvgaWithMatrix({
      a: 1,
      b: 0,
      c: 0,
      d: 1,
      tx: 0,
      ty: 0
    }, await readFile(fixture.assetPath), 3);
    const { validateSvgaBytes } = await import(
      pathToFileURL(path.join(repoRoot, "dist/exporters/svga-exporter.js")).href
    );
    const protoPath = path.join(repoRoot, "proto/svga.proto");

    for (const mutation of generatedFrameStructureMutations()) {
      const malformedBytes = await mutateSvgaBytes(validBytes, mutation.mutate);
      const validation = await validateSvgaBytes(malformedBytes, protoPath);

      assert.equal(validation.structureContractVersion, "svga_generated_native_frame_v1", mutation.name);
      assert.equal(validation.generatedNativeStructureValid, false, mutation.name);
      assert.equal(validation.allSpriteFrameCountsMatch, mutation.expectedFrameCountsMatch ?? true, mutation.name);
      assert.equal(validation.requiredFrameFieldsPresent, mutation.expectedRequiredFields ?? true, mutation.name);
      assert.equal(validation.canonicalFloatValues, mutation.expectedCanonical ?? true, mutation.name);
    }
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("generated native output authority rejects unsupported raw wire and noncanonical encodings", async () => {
  const root = await mkdtemp(path.join("/private/tmp", "auto-svga-aeb-native-raw-wire-authority-"));
  try {
    const fixture = await writePackageFixture(path.join(root, "package"));
    const previewSession = createMultiFormatDesktopPreviewSession({
      repoRoot,
      sessionRoot: path.join(root, "session"),
      sourceStore: new Map(),
      openTimeoutMs: 3_000
    });
    const session = createAebNativePreviewSession({
      repoRoot,
      sessionRoot: path.join(root, "session"),
      previewSession
    });
    const result = await session.openPackagePath(fixture.packageRoot);
    assert.equal(result.model.status, "playing");
    const saveOutput = session.resolveSaveOutput({
      command: "saveAs",
      saveToken: result.aebOutput.saveToken,
      packageSha256: result.aebOutput.packageSha256,
      generatedSvgaSha256: result.aebOutput.generatedSvgaSha256
    });
    const identity = session.readActiveGeneratedIdentity();
    const project = JSON.parse(identity.files.projectBytes.toString("utf8"));
    const svgaMap = JSON.parse(identity.files.mapBytes.toString("utf8"));
    const asset = project.assets[0];
    const authority = {
      project,
      svgaMap,
      resources: [{
        assetId: asset.id,
        packagePath: asset.path,
        width: asset.width,
        height: asset.height,
        sha256: asset.sha256,
        bytes: await readFile(fixture.assetPath)
      }]
    };
    const { validateSvgaBytes } = await import(pathToFileURL(path.join(repoRoot, "dist/exporters/svga-exporter.js")).href);
    const protoPath = path.join(repoRoot, "proto/svga.proto");
    const valid = await validateSvgaBytes(saveOutput.bytes, protoPath, authority);
    assert.equal(valid.generatedNativeStructureValid, true);
    assert.equal(valid.generatedNativeVocabularyValid, true);
    assert.equal(valid.generatedNativeAuthorityValid, true);
    assert.equal(valid.canonicalWireEncoding, true);

    const structuralCases = [
      { name: "duplicate-version", bytes: appendWire(saveOutput.bytes, wireString(1, "2.0")) },
      { name: "wrong-wire-type", bytes: appendWire(saveOutput.bytes, wireVarintField(2, 1)) },
      { name: "group-wire-type", bytes: appendWire(saveOutput.bytes, wireTag(42, 3)) },
      { name: "unknown-root-field", bytes: appendWire(saveOutput.bytes, wireVarintField(99, 1)) },
      { name: "malformed-length", bytes: appendWire(saveOutput.bytes, Buffer.concat([wireTag(3, 2), wireVarint(99), Buffer.from([0])])) },
      { name: "trailing-data", bytes: appendWire(saveOutput.bytes, Buffer.from([0x80])) },
      { name: "unsupported-audio", bytes: appendWire(saveOutput.bytes, wireLengthDelimited(5, wireString(1, "audio_0"))) }
    ];
    for (const entry of structuralCases) {
      const validation = await validateSvgaBytes(entry.bytes, protoPath, authority);
      assert.equal(validation.generatedNativeStructureValid, false, entry.name);
      assert.equal(validation.generatedNativeAuthorityValid, false, entry.name);
      assert.equal(validation.canonicalWireEncoding, false, entry.name);
    }

    const reordered = await validateSvgaBytes(reorderedRootFields(saveOutput.bytes), protoPath, authority);
    assert.equal(reordered.generatedNativeStructureValid, true, "reordered root fields remain protobuf-decodable");
    assert.equal(reordered.generatedNativeVocabularyValid, true, "reordered root fields keep the closed vocabulary");
    assert.equal(reordered.generatedNativeAuthorityValid, false, "reordered root fields are not canonical authority bytes");
    assert.equal(reordered.canonicalWireEncoding, false, "reordered root fields fail deterministic exact bytes");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("generated native output authority binds resource asset IDs to project assets", async () => {
  const root = await mkdtemp(path.join("/private/tmp", "auto-svga-aeb-resource-asset-authority-"));
  try {
    const { validateSvgaBytes } = await import(pathToFileURL(path.join(repoRoot, "dist/exporters/svga-exporter.js")).href);
    const protoPath = path.join(repoRoot, "proto/svga.proto");
    async function openFixtureAndBuildAuthority(fixture, sessionName) {
      const preview = previewContractSpy();
      const session = createAebNativePreviewSession({
        repoRoot,
        sessionRoot: path.join(root, sessionName),
        previewSession: preview.session
      });
      const result = await session.openPackagePath(fixture.packageRoot);
      assert.equal(result.model.status, "previewReady", sessionName);
      const saveOutput = session.resolveSaveOutput({
        command: "saveAs",
        saveToken: result.aebOutput.saveToken,
        packageSha256: result.aebOutput.packageSha256,
        generatedSvgaSha256: result.aebOutput.generatedSvgaSha256
      });
      const identity = session.readActiveGeneratedIdentity();
      const project = JSON.parse(identity.files.projectBytes.toString("utf8"));
      const svgaMap = JSON.parse(identity.files.mapBytes.toString("utf8"));
      return {
        saveOutput,
        project,
        svgaMap,
        resources: await Promise.all(project.assets.map(async (asset) => ({
          assetId: asset.id,
          packagePath: asset.path,
          width: asset.width,
          height: asset.height,
          sha256: asset.sha256,
          bytes: await readFile(path.join(fixture.packageRoot, asset.path))
        })))
      };
    }

    const single = await openFixtureAndBuildAuthority(await writePackageFixture(path.join(root, "single")), "single-session");
    const singleValid = await validateSvgaBytes(single.saveOutput.bytes, protoPath, single);
    assert.equal(singleValid.generatedNativeAuthorityValid, true);
    assert.equal(singleValid.canonicalWireEncoding, true);
    const wrongSingleResourceId = await validateSvgaBytes(single.saveOutput.bytes, protoPath, {
      ...single,
      resources: [{ ...single.resources[0], assetId: "asset-task-fixture-9999" }]
    });
    assert.equal(wrongSingleResourceId.generatedNativeAuthorityValid, false);

    const multi = await openFixtureAndBuildAuthority(await writeMultiLayerPackageFixture(path.join(root, "multi")), "multi-session");
    const multiValid = await validateSvgaBytes(multi.saveOutput.bytes, protoPath, multi);
    assert.equal(multiValid.generatedNativeAuthorityValid, true);
    assert.equal(multiValid.canonicalWireEncoding, true);

    const cases = [
      {
        name: "duplicate-resource-asset-id",
        resources: multi.resources.map((resource, index) => (
          index === 1 ? { ...resource, assetId: multi.resources[0].assetId } : resource
        ))
      },
      {
        name: "path-correct-id-wrong",
        resources: multi.resources.map((resource, index) => (
          index === 0 ? { ...resource, assetId: multi.resources[1].assetId } : resource
        ))
      },
      {
        name: "same-count-alias-swapped-resource-ids",
        resources: [
          { ...multi.resources[0], assetId: multi.resources[1].assetId },
          { ...multi.resources[1], assetId: multi.resources[0].assetId }
        ]
      },
      {
        name: "missing-resource-asset",
        resources: multi.resources.slice(1)
      },
      {
        name: "replaced-resource-identity",
        resources: [
          { ...multi.resources[1], packagePath: multi.resources[0].packagePath },
          multi.resources[1]
        ]
      }
    ];
    for (const entry of cases) {
      const validation = await validateSvgaBytes(multi.saveOutput.bytes, protoPath, {
        project: multi.project,
        svgaMap: multi.svgaMap,
        resources: entry.resources
      });
      assert.equal(validation.generatedNativeAuthorityValid, false, entry.name);
    }
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("host bounded read rejects every malformed generated FrameEntity before Preview and Save authority", async () => {
  const root = await mkdtemp(path.join("/private/tmp", "auto-svga-aeb-native-frame-host-reject-"));
  try {
    const fixture = await writePackageFixture(path.join(root, "package"));
    const validBytes = await encodeSvgaWithMatrix({
      a: 1,
      b: 0,
      c: 0,
      d: 1,
      tx: 0,
      ty: 0
    }, await readFile(fixture.assetPath), 120);

    for (const mutation of generatedFrameStructureMutations()) {
      const malformedBytes = await mutateSvgaBytes(validBytes, mutation.mutate);
      const preview = previewSpy();
      const sessionRoot = path.join(root, `${mutation.name}-session`);
      const session = createAebNativePreviewSession({
        repoRoot,
        sessionRoot,
        previewSession: preview.session,
        exporterFactory: ({ onStage }) => ({
          async export(project, outputRoot) {
            const outputPath = path.join(outputRoot, `${mutation.name}.svga`);
            await writeFile(outputPath, malformedBytes);
            return {
              outputPath,
              validation: {
                exists: true,
                inflated: true,
                decoded: true,
                imageCount: 1,
                spriteCount: project.layers.length,
                frameCount: project.durationFrames,
                floatContractVersion: "svga_float32_v1",
                canonicalFloatValues: true,
                structureContractVersion: "svga_generated_native_frame_v1",
                generatedNativeStructureValid: true,
                allSpriteFrameCountsMatch: true,
                requiredFrameFieldsPresent: true,
                spriteFrameCounts: [project.durationFrames]
              }
            };
          }
        })
      });

      const result = await session.openPackagePath(fixture.packageRoot);

      assert.equal(result.model.status, "failed", mutation.name);
      assert.ok(
        result.model.rightPanel.issues.some((entry) => entry.code === "aeb.native_svga_structure_validation_failed"),
        mutation.name
      );
      assert.equal(preview.calls.length, 0, mutation.name);
      assert.equal(result.aeb.generatedSvga, null, mutation.name);
      assert.equal(result.aebOutput, null, mutation.name);
      assert.throws(() => session.readActiveGeneratedIdentity(), { code: "aeb.generated_identity_unavailable" });
      assert.deepEqual(await outputEntries(sessionRoot), [], mutation.name);
    }
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("project-derived sprite authority rejects forged maps before Preview or Save authority", async () => {
  const mutations = [
    {
      name: "same-count resource path swap",
      mutate(map) {
        [map.sprites[0].assetPath, map.sprites[1].assetPath] = [map.sprites[1].assetPath, map.sprites[0].assetPath];
        [map.sprites[0].exportAssetPath, map.sprites[1].exportAssetPath] = [
          map.sprites[1].exportAssetPath,
          map.sprites[0].exportAssetPath
        ];
      }
    },
    { name: "dimension mutation", mutate: (map) => { map.sprites[0].width += 1; } },
    { name: "transform mutation", mutate: (map) => { map.sprites[0].transform.x += 779; } },
    { name: "keyframe mutation", mutate: (map) => { map.sprites[0].keyframes[0].x += 1; } },
    { name: "visibility mutation", mutate: (map) => { map.sprites[0].visible = false; } },
    { name: "source timing mutation", mutate: (map) => { map.sprites[0].sourceTiming.outPoint -= 1; } },
    { name: "frame-boundary contract mutation", mutate: (map) => { map.sprites[0].sourceTiming.frameBoundaryContract.epsilon *= 2; } },
    { name: "visible frame range mutation", mutate: (map) => { map.sprites[0].visibleFrameRange.end -= 1; } },
    { name: "z-index mutation", mutate: (map) => { map.sprites[0].zIndex += 1; } },
    { name: "anchor mutation", mutate: (map) => { map.sprites[0].anchor.x += 1; } },
    { name: "blend mutation", mutate: (map) => { map.sprites[0].blendMode = "screen"; } },
    {
      name: "mask mutation",
      mutate(map) {
        map.sprites[0].mask = { type: "alpha", sourceLayerId: map.sprites[1].layerId };
        map.sprites[0].maskStrategy = "baked_asset_preferred";
      }
    },
    { name: "missing sprite", mutate: (map) => { map.sprites.pop(); } },
    { name: "duplicate sprite", mutate: (map) => { map.sprites[1] = structuredClone(map.sprites[0]); } },
    {
      name: "extra sprite",
      mutate(map) {
        map.sprites.push({
          ...structuredClone(map.sprites[0]),
          spriteId: "sprite_unexpected-layer",
          layerId: "unexpected-layer"
        });
      }
    }
  ];
  const { SvgaExporter } = await import(pathToFileURL(path.join(repoRoot, "dist/exporters/svga-exporter.js")).href);
  const { buildSvgaMap } = await import(pathToFileURL(path.join(repoRoot, "dist/core/svga-map-builder.js")).href);

  for (const mutation of mutations) {
    const root = await mkdtemp(path.join("/private/tmp", "auto-svga-aeb-map-authority-reject-"));
    try {
      const fixture = await writeMultiLayerPackageFixture(path.join(root, "package"));
      const sessionRoot = path.join(root, "session");
      let exporterCalls = 0;
      let exporterCompleted = false;
      let exporterRejected = false;
      let previewCalls = 0;
      const intakeDiagnostics = [];
      const previewSession = {
        async openLocalFilePath() {
          previewCalls += 1;
          return previewOpenResult();
        },
        async prepareRuntimePreview() {
          throw new Error("Preview preparation must not run for a forged map.");
        },
        async control() {
          return { status: "disposed" };
        }
      };
      const session = createAebNativePreviewSession({
        repoRoot,
        sessionRoot,
        previewSession,
        intakeFailureObserver: (value) => intakeDiagnostics.push(value),
        exporterFactory: ({ onStage }) => ({
          async export(project, outputRoot) {
            exporterCalls += 1;
            const mapPath = path.join(outputRoot, "svga-map.json");
            const map = JSON.parse(await readFile(mapPath, "utf8"));
            mutation.mutate(map);
            assert.notDeepEqual(map, JSON.parse(JSON.stringify(buildSvgaMap(project))), `${mutation.name}: mutation must change map authority`);
            await writeFile(mapPath, `${JSON.stringify(map, null, 2)}\n`);
            try {
              const result = await new SvgaExporter(
                path.join(repoRoot, "proto/svga.proto"),
                { onStage }
              ).export(project, outputRoot);
              exporterCompleted = true;
              return result;
            } catch (error) {
              exporterRejected = true;
              throw error;
            }
          }
        })
      });

      const result = await session.openPackagePath(fixture.packageRoot);
      assert.equal(exporterCalls, 1, `${mutation.name}: injected exporter must run once`);
      assert.equal(exporterRejected, true, `${mutation.name}: exporter boundary must reject`);
      assert.equal(exporterCompleted, false, `${mutation.name}: exporter must not publish output`);
      assert.equal(result.status, "opened", mutation.name);
      assert.equal(result.model.status, "failed", mutation.name);
      const issueCodes = result.model.rightPanel.issues.map((entry) => entry.code);
      assert.ok(
        issueCodes.some((code) => /^aeb\.svga_export_[a-z_]+_failed$/u.test(code)),
        `${mutation.name}: ${JSON.stringify({ issueCodes, intakeDiagnostics })}`
      );
      assert.equal(intakeDiagnostics.some((entry) => entry.errorCode === "ENOENT"), false, mutation.name);
      assert.equal(result.aeb.generatedSvga, null, `${mutation.name}: generated output identity must remain absent`);
      assert.equal(result.aebOutput, null, `${mutation.name}: Save authority must remain absent`);
      assert.equal(previewCalls, 0, `${mutation.name}: Preview must not run`);
      const outputParent = path.join(sessionRoot, "aeb-native-preview");
      assert.deepEqual(existsSync(outputParent) ? await readdir(outputParent) : [], [], `${mutation.name}: output rolled back`);
      assert.throws(() => session.resolveSaveOutput({
        command: "saveAs",
        saveToken: "a".repeat(48),
        packageSha256: "b".repeat(64),
        generatedSvgaSha256: "c".repeat(64)
      }), { code: "aeb.save_authority_invalid" }, `${mutation.name}: Save authority must remain absent`);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  }
});

test("host readback rederives generated output authority and rejects post-write movie mutations", async () => {
  const cases = [
    {
      name: "repointed-sprite-image",
      issueCode: "aeb.native_svga_authority_validation_failed",
      mutate(movie) { movie.sprites[1].imageKey = movie.sprites[0].imageKey; }
    },
    {
      name: "missing-movie-image",
      issueCode: "aeb.native_svga_structure_validation_failed",
      mutate(movie) { delete movie.images.img_1; }
    },
    {
      name: "extra-movie-image",
      issueCode: "aeb.native_svga_authority_validation_failed",
      mutate(movie) { movie.images.img_extra = Buffer.from(movie.images.img_0); }
    },
    {
      name: "image-byte-drift",
      issueCode: "aeb.native_svga_authority_validation_failed",
      mutate(movie) { movie.images.img_1 = Buffer.from(movie.images.img_0); }
    },
    {
      name: "sprite-order-drift",
      issueCode: "aeb.native_svga_authority_validation_failed",
      mutate(movie) { movie.sprites.reverse(); }
    },
    {
      name: "transform-value-drift",
      issueCode: "aeb.native_svga_authority_validation_failed",
      mutate(movie) { movie.sprites[0].frames[0].transform.tx += 1; }
    },
    {
      name: "frame-alpha-drift",
      issueCode: "aeb.native_svga_authority_validation_failed",
      mutate(movie) { movie.sprites[0].frames[0].alpha = 0.5; }
    },
    {
      name: "postwrite-clipPath",
      issueCode: "aeb.native_svga_structure_validation_failed",
      mutate(movie) { movie.sprites[0].frames[0].clipPath = "runtime-mask"; }
    },
    {
      name: "postwrite-shape-entity",
      issueCode: "aeb.native_svga_structure_validation_failed",
      mutate(movie) {
        movie.sprites[0].frames[0].shapes = [{
          type: 1,
          rect: { x: 0, y: 0, width: 1, height: 1, cornerRadius: 0 }
        }];
      }
    }
  ];
  const { SvgaExporter } = await import(pathToFileURL(path.join(repoRoot, "dist/exporters/svga-exporter.js")).href);

  for (const entry of cases) {
    const root = await mkdtemp(path.join("/private/tmp", "auto-svga-aeb-host-generated-authority-"));
    try {
      const fixture = await writeMultiLayerPackageFixture(path.join(root, "package"));
      const preview = previewSpy();
      const sessionRoot = path.join(root, "session");
      let exporterCalls = 0;
      const intakeDiagnostics = [];
      const session = createAebNativePreviewSession({
        repoRoot,
        sessionRoot,
        previewSession: preview.session,
        intakeFailureObserver: (value) => intakeDiagnostics.push(value),
        exporterFactory: ({ onStage }) => ({
          async export(project, outputRoot) {
            exporterCalls += 1;
            const result = await new SvgaExporter(
              path.join(repoRoot, "proto/svga.proto"),
              { onStage }
            ).export(project, outputRoot);
            await writeFile(result.outputPath, await mutateSvgaBytesClosed(await readFile(result.outputPath), entry.mutate));
            return result;
          }
        })
      });

      const result = await session.openPackagePath(fixture.packageRoot);

      assert.equal(exporterCalls, 1, entry.name);
      assert.equal(result.model.status, "failed", entry.name);
      assert.ok(
        result.model.rightPanel.issues.some((issue) => issue.code === entry.issueCode),
        `${entry.name}: ${JSON.stringify({ issues: result.model.rightPanel.issues, intakeDiagnostics })}`
      );
      assert.equal(preview.calls.length, 0, entry.name);
      assert.equal(result.aeb.generatedSvga, null, `${entry.name}: generated identity must remain absent`);
      assert.equal(result.aebOutput, null, `${entry.name}: Save authority must remain absent`);
      assert.deepEqual(await outputEntries(sessionRoot), [], `${entry.name}: output must be rolled back`);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  }
});

test("Preview acceptance rejects blocked, failed, malformed, wrong-format, or unprepared initial states", async () => {
  const root = await mkdtemp(path.join("/private/tmp", "auto-svga-aeb-preview-state-reject-"));
  try {
    const cases = [
      { name: "blocked", result: previewOpenResult({ status: "playbackBlocked" }), code: "aeb.preview_initial_state_rejected" },
      { name: "failed", result: previewOpenResult({ status: "playbackFailed" }), code: "aeb.preview_initial_state_rejected" },
      { name: "missing-model", result: { status: "opened", sourceId: "c".repeat(24) }, code: "aeb.preview_initial_state_rejected" },
      { name: "missing-status", result: previewOpenResult({ status: undefined }), code: "aeb.preview_initial_state_rejected" },
      { name: "wrong-format", result: previewOpenResult({ detectedFormat: "lottie" }), code: "aeb.preview_initial_state_rejected" },
      {
        name: "unprepared",
        result: previewOpenResult(),
        prepared: { status: "failed", format: "svga" },
        code: "aeb.preview_runtime_prepare_failed"
      },
      {
        name: "runtime-bytes-mismatch",
        result: previewOpenResult(),
        prepared: { status: "prepared", format: "svga", svgaBase64: Buffer.from("not-the-generated-svga").toString("base64") },
        code: "aeb.preview_runtime_bytes_mismatch"
      }
    ];
    for (const entry of cases) {
      const fixture = await writePackageFixture(path.join(root, entry.name));
      const preview = previewContractSpy(entry.result, entry.prepared);
      const sessionRoot = path.join(root, `${entry.name}-session`);
      const session = createAebNativePreviewSession({ repoRoot, sessionRoot, previewSession: preview.session });

      const result = await session.openPackagePath(fixture.packageRoot);

      assert.equal(result.model.status, "failed", entry.name);
      assert.ok(result.model.rightPanel.issues.some((issue) => issue.code === entry.code), entry.name);
      assert.equal(result.aebOutput, null, entry.name);
      assert.throws(() => session.resolveSaveOutput({
        command: "saveAs",
        saveToken: "f".repeat(48),
        packageSha256: "a".repeat(64),
        generatedSvgaSha256: "b".repeat(64)
      }), { code: "aeb.save_authority_invalid" }, entry.name);
      assert.ok(preview.controls.some((input) => input.action === "dispose"), entry.name);
      assert.deepEqual(await outputEntries(sessionRoot), [], entry.name);
    }
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("AEB Save As authority rejects forged, missing, stale, and cross-session tokens", async () => {
  const root = await mkdtemp(path.join("/private/tmp", "auto-svga-aeb-save-authority-reject-"));
  try {
    const firstFixture = await writePackageFixture(path.join(root, "first"));
    const blockedFixture = await writePackageFixture(path.join(root, "blocked"), { unsupportedLayer: "precomp" });
    const secondFixture = await writePackageFixture(path.join(root, "second"), { packageId: "aeb-test-native-package-second" });
    const firstSession = createAebNativePreviewSession({
      repoRoot,
      sessionRoot: path.join(root, "first-session"),
      previewSession: createMultiFormatDesktopPreviewSession({
        repoRoot,
        sessionRoot: path.join(root, "first-session"),
        sourceStore: new Map(),
        openTimeoutMs: 3_000
      })
    });
    const secondSession = createAebNativePreviewSession({
      repoRoot,
      sessionRoot: path.join(root, "second-session"),
      previewSession: createMultiFormatDesktopPreviewSession({
        repoRoot,
        sessionRoot: path.join(root, "second-session"),
        sourceStore: new Map(),
        openTimeoutMs: 3_000
      })
    });
    const first = await firstSession.openPackagePath(firstFixture.packageRoot);
    const tokenInput = {
      command: "saveAs",
      saveToken: first.aebOutput.saveToken,
      packageSha256: first.aebOutput.packageSha256,
      generatedSvgaSha256: first.aebOutput.generatedSvgaSha256
    };

    assert.throws(() => firstSession.resolveSaveOutput({ ...tokenInput, saveToken: undefined }), { code: "aeb.save_authority_invalid" });
    assert.throws(() => firstSession.resolveSaveOutput({
      ...tokenInput,
      bytesBase64: Buffer.from("forged").toString("base64"),
      expectedSha256: sha256(Buffer.from("forged")),
      suggestedName: "forged.svga"
    }), { code: "aeb.save_authority_invalid" });
    assert.throws(() => firstSession.resolveSaveOutput({ ...tokenInput, saveToken: "f".repeat(48) }), { code: "aeb.save_authority_invalid" });
    assert.throws(() => secondSession.resolveSaveOutput(tokenInput), { code: "aeb.save_authority_invalid" });

    const blocked = await firstSession.openPackagePath(blockedFixture.packageRoot);
    assert.equal(blocked.model.status, "failed");
    assert.equal(blocked.aeb.ownerModel.compatibility.counts.bake_required, 1);
    assert.equal(blocked.aebOutput, null);
    assert.throws(() => firstSession.resolveSaveOutput(tokenInput), { code: "aeb.save_authority_invalid" });
    assert.throws(() => firstSession.readActiveGeneratedIdentity(), { code: "aeb.generated_identity_unavailable" });

    const second = await firstSession.openPackagePath(secondFixture.packageRoot);
    assert.equal(second.model.status, "playing");
    assert.throws(() => firstSession.resolveSaveOutput(tokenInput), { code: "aeb.save_authority_invalid" });
    const currentInput = {
      command: "saveAs",
      saveToken: second.aebOutput.saveToken,
      packageSha256: second.aebOutput.packageSha256,
      generatedSvgaSha256: second.aebOutput.generatedSvgaSha256
    };
    assert.doesNotThrow(() => firstSession.resolveSaveOutput(currentInput));
    await firstSession.control({ action: "dispose" });
    assert.throws(() => firstSession.resolveSaveOutput(currentInput), { code: "aeb.save_authority_invalid" });
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("newer package invalidates an in-flight generation before Preview success or Save authority", async () => {
  const root = await mkdtemp(path.join("/private/tmp", "auto-svga-aeb-async-generation-reject-"));
  try {
    const firstFixture = await writePackageFixture(path.join(root, "first"));
    const secondFixture = await writePackageFixture(path.join(root, "second"), { packageId: "aeb-test-native-package-newer" });
    const firstOpen = deferred();
    let openCount = 0;
    const preview = previewContractSpy(undefined, undefined, {
      async openLocalFilePath() {
        openCount += 1;
        if (openCount === 1) return firstOpen.promise;
        return previewOpenResult({ sourceId: "d".repeat(24) });
      }
    });
    const sessionRoot = path.join(root, "session");
    const session = createAebNativePreviewSession({ repoRoot, sessionRoot, previewSession: preview.session });

    const stalePromise = session.openPackagePath(firstFixture.packageRoot);
    await waitFor(() => openCount === 1);
    const currentPromise = session.openPackagePath(secondFixture.packageRoot);
    firstOpen.resolve(previewOpenResult({ sourceId: "c".repeat(24) }));
    const stale = await stalePromise;
    const current = await currentPromise;

    assert.equal(stale.model.status, "failed");
    assert.ok(stale.model.rightPanel.issues.some((issue) => issue.code === "aeb.open_generation_stale"));
    assert.equal(stale.aebOutput, null);
    assert.equal(current.model.status, "previewReady");
    assert.match(current.aebOutput.saveToken, /^[a-f0-9]{48}$/u);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("asset hash drift fails before generated output or Preview mutation", async () => {
  const root = await mkdtemp(path.join("/private/tmp", "auto-svga-aeb-hash-reject-"));
  try {
    const fixture = await writePackageFixture(path.join(root, "package"), { assetSha256: "0".repeat(64) });
    const preview = previewSpy();
    const sessionRoot = path.join(root, "session");
    const session = createAebNativePreviewSession({ repoRoot, sessionRoot, previewSession: preview.session });

    const result = await session.openPackagePath(fixture.packageRoot);

    assert.equal(result.model.status, "failed");
    assert.ok(result.model.rightPanel.issues.some((entry) => entry.code === "aeb.asset_hash_mismatch"));
    assert.equal(preview.calls.length, 0);
    assert.equal(existsSync(path.join(sessionRoot, "aeb-native-preview")), false);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("raw local path fails before generated output or Preview mutation", async () => {
  const root = await mkdtemp(path.join("/private/tmp", "auto-svga-aeb-path-reject-"));
  try {
    const fixture = await writePackageFixture(path.join(root, "package"), { rawPath: "/Users/operator/private.aep" });
    const preview = previewSpy();
    const sessionRoot = path.join(root, "session");
    const session = createAebNativePreviewSession({ repoRoot, sessionRoot, previewSession: preview.session });

    const result = await session.openPackagePath(fixture.packageRoot);

    assert.equal(result.model.status, "failed");
    assert.ok(result.model.rightPanel.issues.some((entry) => entry.code === "aeb.raw_path"));
    assert.equal(preview.calls.length, 0);
    assert.equal(existsSync(path.join(sessionRoot, "aeb-native-preview")), false);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("forged package provenance or S3 host-scan state fails before output or Preview mutation", async () => {
  const root = await mkdtemp(path.join("/private/tmp", "auto-svga-aeb-provenance-reject-"));
  try {
    const cases = [
      { name: "creator", options: { createdBy: "forged_direct_export" }, issueCode: "aeb.package_creator_invalid" },
      { name: "s3-host-scan", options: { s3RanAeScript: false }, issueCode: "aeb.host_scan_unproven" }
    ];
    for (const entry of cases) {
      const fixture = await writePackageFixture(path.join(root, entry.name), entry.options);
      const preview = previewSpy();
      const sessionRoot = path.join(root, `${entry.name}-session`);
      const session = createAebNativePreviewSession({ repoRoot, sessionRoot, previewSession: preview.session });

      const result = await session.openPackagePath(fixture.packageRoot);

      assert.equal(result.model.status, "failed");
      assert.ok(result.model.rightPanel.issues.some((issue) => issue.code === entry.issueCode));
      assert.equal(preview.calls.length, 0);
      assert.equal(existsSync(path.join(sessionRoot, "aeb-native-preview")), false);
    }
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("post-stat package JSON growth fails before output or Preview mutation", async () => {
  const root = await mkdtemp(path.join("/private/tmp", "auto-svga-aeb-json-growth-reject-"));
  try {
    const fixture = await writePackageFixture(path.join(root, "package"));
    const preview = previewSpy();
    const sessionRoot = path.join(root, "session");
    let injected = false;
    let observedReadCapacity;
    let observedOpenedSize;
    const session = createAebNativePreviewSession({
      repoRoot,
      sessionRoot,
      previewSession: preview.session,
      fileReadHooks: {
        afterOpen({ filePath, purpose, openedSize, readCapacity }) {
          if (injected || purpose !== "package-json") return;
          injected = true;
          observedOpenedSize = openedSize;
          observedReadCapacity = readCapacity;
          appendFileSync(filePath, Buffer.alloc(2 * 1024 * 1024, 0x20));
        }
      }
    });

    const result = await session.openPackagePath(fixture.packageRoot);

    assert.equal(injected, true);
    assert.equal(observedReadCapacity, observedOpenedSize + 1);
    assert.ok(observedReadCapacity < 2 * 1024 * 1024);
    assert.equal(result.model.status, "failed");
    assert.ok(result.model.rightPanel.issues.some((issue) => issue.code === "aeb.package_json_changed_after_stat"));
    assert.equal(preview.calls.length, 0);
    assert.equal(existsSync(path.join(sessionRoot, "aeb-native-preview")), false);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("low-level bounded read failures use stable path-redacted issue codes", async () => {
  const root = await mkdtemp(path.join("/private/tmp", "auto-svga-aeb-read-error-redaction-"));
  try {
    const fixture = await writePackageFixture(path.join(root, "package"));
    const preview = previewSpy();
    const sessionRoot = path.join(root, "session");
    const session = createAebNativePreviewSession({
      repoRoot,
      sessionRoot,
      previewSession: preview.session,
      fileReadHooks: {
        afterOpen({ filePath, purpose }) {
          if (purpose === "package-json") throw new Error(`injected read failure at ${filePath}`);
        }
      }
    });

    const result = await session.openPackagePath(fixture.packageRoot);

    assert.equal(result.model.status, "failed");
    assert.deepEqual(result.model.rightPanel.issues.map((issue) => issue.code), ["aeb.package_json_read_failed"]);
    assert.equal(JSON.stringify(result).includes(root), false);
    assert.equal(preview.calls.length, 0);
    assert.equal(existsSync(path.join(sessionRoot, "aeb-native-preview")), false);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("post-open asset path replacement fails before output or Preview mutation", async () => {
  const root = await mkdtemp(path.join("/private/tmp", "auto-svga-aeb-asset-replace-reject-"));
  try {
    const fixture = await writePackageFixture(path.join(root, "package"));
    const preview = previewSpy();
    const sessionRoot = path.join(root, "session");
    let injected = false;
    const session = createAebNativePreviewSession({
      repoRoot,
      sessionRoot,
      previewSession: preview.session,
      fileReadHooks: {
        afterOpen({ filePath, purpose }) {
          if (injected || purpose !== "asset") return;
          injected = true;
          renameSync(filePath, `${filePath}.replaced`);
          writeFileSync(filePath, Buffer.from("replacement"));
        }
      }
    });

    const result = await session.openPackagePath(fixture.packageRoot);

    assert.equal(injected, true);
    assert.equal(result.model.status, "failed");
    assert.ok(result.model.rightPanel.issues.some((issue) => issue.code === "aeb.asset_identity_changed"));
    assert.equal(preview.calls.length, 0);
    assert.equal(existsSync(path.join(sessionRoot, "aeb-native-preview")), false);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("duplicate native asset and layer identities fail before output or Preview mutation", async () => {
  const root = await mkdtemp(path.join("/private/tmp", "auto-svga-aeb-duplicate-identity-reject-"));
  try {
    const cases = [
      { name: "asset", options: { duplicateAssetId: true }, issueCode: "aeb.asset_id_duplicate" },
      { name: "layer", options: { duplicateLayerId: true }, issueCode: "aeb.layer_id_duplicate" }
    ];
    for (const entry of cases) {
      const fixture = await writePackageFixture(path.join(root, entry.name), entry.options);
      const preview = previewSpy();
      const sessionRoot = path.join(root, `${entry.name}-session`);
      const session = createAebNativePreviewSession({ repoRoot, sessionRoot, previewSession: preview.session });

      const result = await session.openPackagePath(fixture.packageRoot);

      assert.equal(result.model.status, "failed");
      assert.ok(result.model.rightPanel.issues.some((issue) => issue.code === entry.issueCode));
      assert.equal(preview.calls.length, 0);
      assert.equal(existsSync(path.join(sessionRoot, "aeb-native-preview")), false);
    }
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("malformed and duplicate semantic native identities fail at package-JSON preflight", async () => {
  const root = await mkdtemp(path.join("/private/tmp", "auto-svga-aeb-semantic-identity-preflight-"));
  try {
    const cases = [
      {
        name: "duplicate-layer-id",
        issueCode: "aeb.layer_id_duplicate",
        mutate(pkg) { pkg.semanticGraph.layers.push(structuredClone(pkg.semanticGraph.layers[0])); }
      },
      {
        name: "malformed-layer-id",
        issueCode: "aeb.layer_contract_invalid",
        mutate(pkg) { pkg.semanticGraph.layers[0].layerId = "../private-layer"; }
      },
      {
        name: "malformed-asset-id",
        issueCode: "aeb.layer_contract_invalid",
        mutate(pkg) { pkg.semanticGraph.layers[0].assetId = "/private/asset"; }
      }
    ];
    for (const entry of cases) {
      const fixture = await writePackageFixture(path.join(root, entry.name));
      const document = JSON.parse(await readFile(fixture.packagePath, "utf8"));
      entry.mutate(document.aeExportPackage);
      await writeFile(fixture.packagePath, `${JSON.stringify(document, null, 2)}\n`);
      const preview = previewSpy();
      const purposes = [];
      const sessionRoot = path.join(root, `${entry.name}-session`);
      const session = createAebNativePreviewSession({
        repoRoot,
        sessionRoot,
        previewSession: preview.session,
        fileReadHooks: { afterOpen: ({ purpose }) => purposes.push(purpose) }
      });

      const result = await session.openPackagePath(fixture.packageRoot);

      assert.equal(result.model.status, "failed", entry.name);
      assert.ok(result.model.rightPanel.issues.some((issue) => issue.code === entry.issueCode), entry.name);
      assert.deepEqual(purposes, ["package-json"], `${entry.name}: no snapshot or asset read`);
      assert.equal(result.aebOutput, null, entry.name);
      assert.equal(preview.calls.length, 0, entry.name);
      assert.equal(existsSync(path.join(sessionRoot, "aeb-native-preview")), false, entry.name);
    }
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("native footage frame intervals use one explicit epsilon and sampling contract", async () => {
  const epsilonFrames = 1e-9;
  const frame24PositiveEdge = findSecondsSnapEdge(24, 24, 1, epsilonFrames);
  const frame72PositiveEdge = findSecondsSnapEdge(72, 24, 1, epsilonFrames);
  const frame72NegativeEdge = findSecondsSnapEdge(72, 24, -1, epsilonFrames);
  const cases = [
    {
      name: "fractional-two-sample-range",
      composition: { fps: 24, durationFrames: 120 },
      timing: { inPoint: 0.5 / 24, outPoint: 2.25 / 24 },
      expectedRange: { start: 1, end: 2 }
    },
    {
      name: "epsilon-edge-collapses-to-no-sample",
      composition: { fps: 24, durationFrames: 120 },
      timing: { inPoint: 1, outPoint: frame24PositiveEdge.inside },
      issueCode: "aeb.native_host_timing_no_sample"
    },
    {
      name: "just-beyond-epsilon-keeps-one-sample",
      composition: { fps: 24, durationFrames: 120 },
      timing: { inPoint: 1, outPoint: frame24PositiveEdge.firstOutside },
      expectedRange: { start: 24, end: 24 }
    },
    {
      name: "near-in-boundary-snaps",
      composition: { fps: 24, durationFrames: 120 },
      timing: { inPoint: frame24PositiveEdge.inside, outPoint: 3 },
      expectedRange: { start: 24, end: 71 },
      expectedInPoint: 1
    },
    {
      name: "beyond-in-boundary-epsilon-does-not-snap",
      composition: { fps: 24, durationFrames: 120 },
      timing: { inPoint: frame24PositiveEdge.firstOutside, outPoint: 3 },
      expectedRange: { start: 25, end: 71 }
    },
    {
      name: "near-out-boundary-snaps",
      composition: { fps: 24, durationFrames: 120 },
      timing: { inPoint: 1, outPoint: frame72PositiveEdge.inside },
      expectedRange: { start: 24, end: 71 },
      expectedOutPoint: 3
    },
    {
      name: "near-out-boundary-from-below-snaps",
      composition: { fps: 24, durationFrames: 120 },
      timing: { inPoint: 1, outPoint: frame72NegativeEdge.inside },
      expectedRange: { start: 24, end: 71 },
      expectedOutPoint: 3
    },
    {
      name: "beyond-out-boundary-epsilon-does-not-snap",
      composition: { fps: 24, durationFrames: 120 },
      timing: { inPoint: 1, outPoint: frame72PositiveEdge.firstOutside },
      expectedRange: { start: 24, end: 72 }
    },
    {
      name: "strict-no-sample-between-frame-times",
      composition: { fps: 24, durationFrames: 120 },
      timing: { inPoint: 0.1 / 24, outPoint: 0.9 / 24 },
      issueCode: "aeb.native_host_timing_no_sample"
    },
    {
      name: "strict-one-sample-interval",
      composition: { fps: 24, durationFrames: 120 },
      timing: { inPoint: 0.1 / 24, outPoint: 1.1 / 24 },
      expectedRange: { start: 1, end: 1 }
    },
    {
      name: "noninteger-23-976-fps",
      composition: { fps: 23.976, durationFrames: 120 },
      timing: { inPoint: 1, outPoint: 3 },
      issueCode: "aeb.composition_fps_unsupported"
    },
    {
      name: "noninteger-29-97-fps",
      composition: { fps: 29.97, durationFrames: 120 },
      timing: { inPoint: 1, outPoint: 3 },
      issueCode: "aeb.composition_fps_unsupported"
    },
    {
      name: "exact-full-duration",
      composition: { fps: 24, durationFrames: 120 },
      timing: { inPoint: 0, outPoint: 5 },
      expectedRange: { start: 0, end: 119 }
    }
  ];

  const root = await mkdtemp(path.join("/private/tmp", "auto-svga-aeb-frame-interval-contract-"));
  try {
    for (const entry of cases) {
      const fixture = await writePackageFixture(path.join(root, entry.name), {
        composition: entry.composition,
        hostTiming: { ...entry.timing, startTime: 0, stretch: 100 },
        nativeKeyframes: entry.expectedRange ? keyframesForRange(entry.expectedRange) : undefined
      });
      let previewCalls = 0;
      let openedPath = "";
      const previewSession = {
        async openLocalFilePath(filePath) {
          previewCalls += 1;
          openedPath = filePath;
          return previewOpenResult();
        },
        async prepareRuntimePreview() {
          return { status: "prepared", format: "svga", svgaBase64: (await readFile(openedPath)).toString("base64") };
        },
        async control() {}
      };
      const purposes = [];
      const sessionRoot = path.join(root, `${entry.name}-session`);
      const session = createAebNativePreviewSession({
        repoRoot,
        sessionRoot,
        previewSession,
        fileReadHooks: { afterOpen: ({ purpose }) => purposes.push(purpose) }
      });

      const result = await session.openPackagePath(fixture.packageRoot);

      if (entry.issueCode) {
        assert.equal(result.model.status, "failed", entry.name);
        assert.ok(result.model.rightPanel.issues.some((issue) => issue.code === entry.issueCode), entry.name);
        assert.deepEqual(purposes, ["package-json"], `${entry.name}: no snapshot or asset read`);
        assert.equal(result.aebOutput, null, entry.name);
        assert.equal(previewCalls, 0, entry.name);
        continue;
      }
      assert.equal(result.model.status, "previewReady", `${entry.name}: ${JSON.stringify(result.model.rightPanel?.issues)}`);
      const project = JSON.parse(session.readActiveGeneratedIdentity().files.projectBytes.toString("utf8"));
      assert.deepEqual(project.layers[0].activeFrameRange, entry.expectedRange, entry.name);
      if (entry.expectedInPoint !== undefined) {
        assert.equal(project.layers[0].sourceTiming.inPoint, entry.expectedInPoint, entry.name);
      }
      if (entry.expectedOutPoint !== undefined) {
        assert.equal(project.layers[0].sourceTiming.outPoint, entry.expectedOutPoint, entry.name);
      }
      assert.deepEqual(project.layers[0].sourceTiming.frameBoundaryContract, {
        version: "frame_boundary_v1",
        arithmetic: "ieee754_binary64",
        framePosition: "seconds_times_fps",
        predicate: "abs(frame_position-round(frame_position))<=epsilon",
        epsilon: epsilonFrames,
        epsilonUnit: "frames",
        snap: "nearest_integer_within_epsilon",
        interval: "in_inclusive_out_exclusive"
      }, entry.name);
      assert.equal(previewCalls, 1, entry.name);
    }
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("versioned frame-boundary predicate has no high-frame arithmetic-guard band", async () => {
  const {
    FRAME_BOUNDARY_CONTRACT,
    isFrameBoundaryWithinSnapEpsilon,
    normalizeFrameInterval
  } = await import(pathToFileURL(path.join(repoRoot, "dist/core/frame-interval.js")).href);
  const frame = 9_999;
  const fps = 24;
  const durationFrames = 10_000;
  const epsilon = 1e-9;
  const formerGuard = Number.EPSILON * frame * 2;
  const hiddenBandOutPoint = (frame + epsilon + formerGuard / 2) / fps;
  const measuredHiddenBandDelta = Math.abs(hiddenBandOutPoint * fps - frame);

  assert.ok(measuredHiddenBandDelta > epsilon);
  assert.ok(measuredHiddenBandDelta < epsilon + formerGuard);
  assert.deepEqual(normalizeFrameInterval({
    inPoint: 0,
    outPoint: hiddenBandOutPoint,
    fps,
    durationFrames
  }), {
    ok: true,
    inPoint: 0,
    outPoint: hiddenBandOutPoint,
    activeFrameRange: { start: 0, end: 9_999 },
    frameBoundaryContract: {
      version: "frame_boundary_v1",
      arithmetic: "ieee754_binary64",
      framePosition: "seconds_times_fps",
      predicate: "abs(frame_position-round(frame_position))<=epsilon",
      epsilon,
      epsilonUnit: "frames",
      snap: "nearest_integer_within_epsilon",
      interval: "in_inclusive_out_exclusive"
    }
  });
  assert.deepEqual(FRAME_BOUNDARY_CONTRACT, {
    version: "frame_boundary_v1",
    arithmetic: "ieee754_binary64",
    framePosition: "seconds_times_fps",
    predicate: "abs(frame_position-round(frame_position))<=epsilon",
    epsilon,
    epsilonUnit: "frames",
    snap: "nearest_integer_within_epsilon",
    interval: "in_inclusive_out_exclusive"
  });

  for (const direction of [-1, 1]) {
    const { inside, firstOutside } = findRepresentableSnapEdge(frame, direction, epsilon);
    let beyondFormerGuard = firstOutside;
    while (Math.abs(beyondFormerGuard - frame) <= epsilon + formerGuard) {
      beyondFormerGuard = adjacentFloat(beyondFormerGuard, direction);
    }

    assert.ok(Math.abs(inside - frame) <= epsilon, `inside edge ${direction}`);
    assert.ok(Math.abs(firstOutside - frame) > epsilon, `outside edge ${direction}`);
    assert.ok(Math.abs(firstOutside - frame) < epsilon + formerGuard, `hidden band ${direction}`);
    assert.ok(Math.abs(beyondFormerGuard - frame) > epsilon + formerGuard, `beyond guard ${direction}`);
    assert.equal(isFrameBoundaryWithinSnapEpsilon(inside), true, `inside predicate ${direction}`);
    assert.equal(isFrameBoundaryWithinSnapEpsilon(firstOutside), false, `outside predicate ${direction}`);
    assert.equal(isFrameBoundaryWithinSnapEpsilon(beyondFormerGuard), false, `beyond predicate ${direction}`);
  }
});

test("high-frame epsilon authority reaches project, map, exporter, Preview, and fail-closed rejection", async () => {
  const root = await mkdtemp(path.join("/private/tmp", "auto-svga-aeb-high-frame-contract-"));
  const fps = 24;
  const durationFrames = 10_000;
  const frame = durationFrames - 1;
  const epsilon = 1e-9;
  const formerGuard = Number.EPSILON * frame * 2;
  const hiddenBandBoundary = (frame + epsilon + formerGuard / 2) / fps;
  const keyframes = [
    { frame: 0, x: 150, y: 150, scaleX: 1, scaleY: 1, rotation: 0, opacity: 1 },
    { frame, x: 170, y: 150, scaleX: 1, scaleY: 1, rotation: 0, opacity: 1 }
  ];
  try {
    const acceptedFixture = await writePackageFixture(path.join(root, "accepted-package"), {
      composition: { fps, durationFrames },
      hostTiming: { inPoint: 0, outPoint: hiddenBandBoundary, startTime: 0, stretch: 100 },
      nativeKeyframes: keyframes
    });
    const acceptedSessionRoot = path.join(root, "accepted-session");
    const acceptedSession = createAebNativePreviewSession({
      repoRoot,
      sessionRoot: acceptedSessionRoot,
      previewSession: createMultiFormatDesktopPreviewSession({
        repoRoot,
        sessionRoot: acceptedSessionRoot,
        sourceStore: new Map(),
        openTimeoutMs: 3_000
      })
    });

    const accepted = await acceptedSession.openPackagePath(acceptedFixture.packageRoot);
    assert.equal(accepted.model.status, "playing", JSON.stringify(accepted.model.rightPanel?.issues));
    const acceptedIdentity = acceptedSession.readActiveGeneratedIdentity();
    const project = JSON.parse(acceptedIdentity.files.projectBytes.toString("utf8"));
    const map = JSON.parse(acceptedIdentity.files.mapBytes.toString("utf8"));
    const saveOutput = acceptedSession.resolveSaveOutput({
      command: "saveAs",
      saveToken: accepted.aebOutput.saveToken,
      packageSha256: accepted.aebOutput.packageSha256,
      generatedSvgaSha256: accepted.aebOutput.generatedSvgaSha256
    });
    const decoded = await decodeSvga(saveOutput.bytes);

    assert.deepEqual(project.layers[0].activeFrameRange, { start: 0, end: frame });
    assert.equal(project.layers[0].sourceTiming.outPoint, hiddenBandBoundary);
    assert.deepEqual(map.sprites[0].visibleFrameRange, { start: 0, end: frame });
    assert.deepEqual(map.sprites[0].sourceTiming, project.layers[0].sourceTiming);
    assert.ok(decoded.sprites[0].frames[frame].alpha > 0);
    assert.equal(accepted.aebOutput.saveAsAllowed, true);
    assert.equal(sha256(saveOutput.bytes), accepted.aeb.generatedSvga.sha256);

    const rejectedFixture = await writePackageFixture(path.join(root, "rejected-package"), {
      composition: { fps, durationFrames },
      hostTiming: {
        inPoint: hiddenBandBoundary,
        outPoint: durationFrames / fps,
        startTime: 0,
        stretch: 100
      },
      nativeKeyframes: keyframes
    });
    const preview = previewSpy();
    const purposes = [];
    const rejectedSessionRoot = path.join(root, "rejected-session");
    const rejectedSession = createAebNativePreviewSession({
      repoRoot,
      sessionRoot: rejectedSessionRoot,
      previewSession: preview.session,
      fileReadHooks: { afterOpen: ({ purpose }) => purposes.push(purpose) }
    });

    const rejected = await rejectedSession.openPackagePath(rejectedFixture.packageRoot);
    assert.equal(rejected.model.status, "failed");
    assert.ok(rejected.model.rightPanel.issues.some((issue) => issue.code === "aeb.native_host_timing_no_sample"));
    assert.deepEqual(purposes, ["package-json"]);
    assert.equal(rejected.aebOutput, null);
    assert.equal(preview.calls.length, 0);
    assert.equal(existsSync(path.join(rejectedSessionRoot, "aeb-native-preview")), false);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("canonical frame interval math remains deterministic for noninteger source FPS", async () => {
  const { normalizeFrameInterval } = await import(pathToFileURL(path.join(repoRoot, "dist/core/frame-interval.js")).href);
  assert.deepEqual(normalizeFrameInterval({
    inPoint: 1,
    outPoint: 3,
    fps: 23.976,
    durationFrames: 120
  }), {
    ok: true,
    inPoint: 1,
    outPoint: 3,
    activeFrameRange: { start: 24, end: 71 },
    frameBoundaryContract: {
      version: "frame_boundary_v1",
      arithmetic: "ieee754_binary64",
      framePosition: "seconds_times_fps",
      predicate: "abs(frame_position-round(frame_position))<=epsilon",
      epsilon: 1e-9,
      epsilonUnit: "frames",
      snap: "nearest_integer_within_epsilon",
      interval: "in_inclusive_out_exclusive"
    }
  });
  assert.deepEqual(normalizeFrameInterval({
    inPoint: 0,
    outPoint: 120 / 29.97,
    fps: 29.97,
    durationFrames: 120
  }), {
    ok: true,
    inPoint: 0,
    outPoint: 120 / 29.97,
    activeFrameRange: { start: 0, end: 119 },
    frameBoundaryContract: {
      version: "frame_boundary_v1",
      arithmetic: "ieee754_binary64",
      framePosition: "seconds_times_fps",
      predicate: "abs(frame_position-round(frame_position))<=epsilon",
      epsilon: 1e-9,
      epsilonUnit: "frames",
      snap: "nearest_integer_within_epsilon",
      interval: "in_inclusive_out_exclusive"
    }
  });
});

test("malformed native keyframe and numeric records fail before output or Preview mutation", async () => {
  const root = await mkdtemp(path.join("/private/tmp", "auto-svga-aeb-keyframe-contract-reject-"));
  const validFrame = (frame, overrides = {}) => ({
    frame,
    x: 150,
    y: 150,
    scaleX: 1,
    scaleY: 1,
    rotation: 0,
    opacity: 1,
    ...overrides
  });
  try {
    const cases = [
      { name: "numeric-string-frame", options: { nativeKeyframes: [validFrame("0"), validFrame(119)] } },
      { name: "negative-frame", options: { nativeKeyframes: [validFrame(-1), validFrame(0), validFrame(119)] } },
      { name: "out-of-range-frame", options: { nativeKeyframes: [validFrame(0), validFrame(120)] } },
      { name: "duplicate-frame", options: { nativeKeyframes: [validFrame(0), validFrame(0), validFrame(119)] } },
      { name: "non-monotonic-frame", options: { nativeKeyframes: [validFrame(0), validFrame(60), validFrame(40), validFrame(119)] } },
      { name: "opacity-out-of-domain", options: { nativeKeyframes: [validFrame(0), validFrame(119, { opacity: 1.5 })] } },
      { name: "numeric-string-transform", options: { nativeTransform: { x: "150" } } },
      { name: "numeric-string-negative-scale", options: { nativeTransform: { scaleX: "-1" } } },
      { name: "null-zero-scale", options: { nativeTransform: { scaleY: null } } },
      { name: "numeric-string-anchor", options: { nativeAnchor: { x: "60" } } },
      { name: "numeric-string-z-index", options: { nativeZIndex: "1" } }
    ];
    for (const entry of cases) {
      const fixture = await writePackageFixture(path.join(root, entry.name), entry.options);
      const preview = previewSpy();
      const sessionRoot = path.join(root, `${entry.name}-session`);
      const session = createAebNativePreviewSession({ repoRoot, sessionRoot, previewSession: preview.session });

      const result = await session.openPackagePath(fixture.packageRoot);

      assert.equal(result.model.status, "failed", entry.name);
      assert.ok(result.model.rightPanel.issues.some((issue) => issue.code === "aeb.layer_contract_invalid"), entry.name);
      assert.equal(preview.calls.length, 0, entry.name);
      assert.equal(existsSync(path.join(sessionRoot, "aeb-native-preview")), false, entry.name);
    }
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("invalid native host timing fails before package-tree asset reads, output, Preview, or Save authority", async () => {
  const root = await mkdtemp(path.join("/private/tmp", "auto-svga-aeb-native-timing-reject-"));
  try {
    const cases = [
      { name: "missing-in-point", issueCode: "aeb.native_host_timing_invalid", mutate: (host) => { delete host.inPoint; } },
      { name: "missing-start-time", issueCode: "aeb.native_host_timing_invalid", mutate: (host) => { delete host.startTime; } },
      { name: "nonfinite-in-point", issueCode: "aeb.compatibility_layer_invalid", mutate: (host) => { host.inPoint = "NaN"; } },
      { name: "negative-in-point", issueCode: "aeb.native_host_timing_invalid", mutate: (host) => { host.inPoint = -1; } },
      { name: "reversed-range", issueCode: "aeb.native_host_timing_invalid", mutate: (host) => { host.inPoint = 3; host.outPoint = 1; } },
      { name: "beyond-composition", issueCode: "aeb.native_host_timing_invalid", mutate: (host) => { host.outPoint = 6; } },
      { name: "unsupported-stretch", issueCode: "aeb.native_host_time_mapping_unsupported", mutate: (host) => { host.stretch = 50; } },
      { name: "unsupported-time-remap", issueCode: "aeb.native_host_time_mapping_unsupported", mutate: (host) => { host.timeRemapEnabled = true; } }
    ];
    for (const entry of cases) {
      const fixture = await writePackageFixture(path.join(root, entry.name));
      const document = JSON.parse(await readFile(fixture.packagePath, "utf8"));
      entry.mutate(document.aeExportPackage.s3Report.layers[0]);
      await writeFile(fixture.packagePath, `${JSON.stringify(document, null, 2)}\n`);
      const preview = previewSpy();
      const purposes = [];
      const sessionRoot = path.join(root, `${entry.name}-session`);
      const session = createAebNativePreviewSession({
        repoRoot,
        sessionRoot,
        previewSession: preview.session,
        fileReadHooks: { afterOpen: ({ purpose }) => purposes.push(purpose) }
      });

      const result = await session.openPackagePath(fixture.packageRoot);

      assert.equal(result.model.status, "failed", entry.name);
      assert.ok(result.model.rightPanel.issues.some((issue) => issue.code === entry.issueCode), entry.name);
      assert.deepEqual(purposes, ["package-json"], `${entry.name}: no package-tree asset read`);
      assert.equal(result.aebOutput, null, entry.name);
      assert.equal(preview.calls.length, 0, entry.name);
      assert.equal(existsSync(path.join(sessionRoot, "aeb-native-preview")), false, entry.name);
    }
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("numeric-string composition values fail before output or Preview mutation", async () => {
  const root = await mkdtemp(path.join("/private/tmp", "auto-svga-aeb-composition-contract-reject-"));
  try {
    const cases = [
      { name: "width", composition: { width: "300" } },
      { name: "fps", composition: { fps: "24" } },
      { name: "duration-frames", composition: { durationFrames: "120" } }
    ];
    for (const entry of cases) {
      const fixture = await writePackageFixture(path.join(root, entry.name), { composition: entry.composition });
      const preview = previewSpy();
      const sessionRoot = path.join(root, `${entry.name}-session`);
      const session = createAebNativePreviewSession({ repoRoot, sessionRoot, previewSession: preview.session });

      const result = await session.openPackagePath(fixture.packageRoot);

      assert.equal(result.model.status, "failed", entry.name);
      assert.ok(result.model.rightPanel.issues.some((issue) => issue.code === "aeb.composition_invalid"), entry.name);
      assert.equal(preview.calls.length, 0, entry.name);
      assert.equal(existsSync(path.join(sessionRoot, "aeb-native-preview")), false, entry.name);
    }
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("malformed native visibility and compatibility records fail before output, Preview, or Save authority", async () => {
  const root = await mkdtemp(path.join("/private/tmp", "auto-svga-aeb-compatibility-contract-reject-"));
  try {
    const cases = [
      {
        name: "native-visible-string",
        issueCode: "aeb.layer_contract_invalid",
        mutate(pkg) { pkg.semanticGraph.layers[0].visible = "false"; }
      },
      {
        name: "effect-count-string",
        mutate(pkg) { pkg.s3Report.layers[0].effectCount = "1"; }
      },
      {
        name: "mask-count-malformed",
        mutate(pkg) { pkg.s3Report.layers[0].maskCount = -1; }
      },
      {
        name: "enabled-string",
        mutate(pkg) { pkg.s3Report.layers[0].enabled = "true"; }
      },
      {
        name: "has-audio-string",
        mutate(pkg) { pkg.s3Report.layers[0].hasAudio = "false"; }
      },
      {
        name: "expressed-fields-malformed",
        mutate(pkg) { pkg.s3Report.layers[0].expressedTransformFields = ["position", 1]; }
      },
      {
        name: "disabled-malformed-unsupported",
        options: { unsupportedLayer: "precomp" },
        mutate(pkg) {
          pkg.semanticGraph.unsupportedLayers[0].enabled = false;
          pkg.semanticGraph.unsupportedLayers[0].effectCount = "1";
        }
      }
    ];
    for (const entry of cases) {
      const fixture = await writePackageFixture(path.join(root, entry.name), entry.options);
      await mutatePackage(fixture.packagePath, entry.mutate);
      const preview = previewSpy();
      const sessionRoot = path.join(root, `${entry.name}-session`);
      const session = createAebNativePreviewSession({ repoRoot, sessionRoot, previewSession: preview.session });

      const result = await session.openPackagePath(fixture.packageRoot);

      assert.equal(result.model.status, "failed", entry.name);
      assert.ok(result.model.rightPanel.issues.some((issue) => (
        issue.code === (entry.issueCode ?? "aeb.compatibility_layer_invalid")
      )), entry.name);
      assert.equal(preview.calls.length, 0, entry.name);
      assert.equal(result.aebOutput ?? null, null, entry.name);
      assert.equal(existsSync(path.join(sessionRoot, "aeb-native-preview")), false, entry.name);
    }
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("semantic-native layers require one matching native-safe host authority before output, Preview, or Save", async () => {
  const root = await mkdtemp(path.join("/private/tmp", "auto-svga-aeb-native-host-authority-reject-"));
  try {
    const cases = [
      {
        name: "effect-requires-bake",
        issueCode: "aeb.compatibility_bake_required",
        mutate(pkg) { pkg.s3Report.layers[0].effectCount = 1; }
      },
      {
        name: "mask-requires-bake",
        issueCode: "aeb.compatibility_bake_required",
        mutate(pkg) { pkg.s3Report.layers[0].maskCount = 1; }
      },
      {
        name: "audio-blocked",
        issueCode: "aeb.compatibility_blocked",
        mutate(pkg) { pkg.s3Report.layers[0].hasAudio = true; }
      },
      {
        name: "expression-blocked",
        issueCode: "aeb.compatibility_blocked",
        mutate(pkg) { pkg.s3Report.layers[0].expressedTransformFields = ["position"]; }
      },
      {
        name: "unsupported-type-blocked",
        issueCode: "aeb.compatibility_blocked",
        mutate(pkg) { pkg.s3Report.layers[0].layerType = "text"; }
      },
      {
        name: "missing-host-record",
        issueCode: "aeb.native_host_record_missing",
        mutate(pkg) { pkg.s3Report.layers = []; }
      },
      {
        name: "duplicate-host-record",
        issueCode: "aeb.native_host_record_duplicate",
        mutate(pkg) { pkg.s3Report.layers.push({ ...pkg.s3Report.layers[0] }); }
      },
      {
        name: "conflicting-host-record",
        issueCode: "aeb.native_host_record_duplicate",
        mutate(pkg) { pkg.s3Report.layers.push({ ...pkg.s3Report.layers[0], effectCount: 1 }); }
      },
      {
        name: "host-asset-identity-mismatch",
        issueCode: "aeb.native_host_identity_mismatch",
        mutate(pkg) { pkg.s3Report.layers[0].sourceAssetId = "asset-task-fixture-9999"; }
      }
    ];
    for (const entry of cases) {
      const fixture = await writePackageFixture(path.join(root, entry.name));
      await mutatePackage(fixture.packagePath, entry.mutate);
      const preview = previewSpy();
      const sessionRoot = path.join(root, `${entry.name}-session`);
      let exporterCreated = false;
      const session = createAebNativePreviewSession({
        repoRoot,
        sessionRoot,
        previewSession: preview.session,
        exporterFactory() {
          exporterCreated = true;
          throw new Error("exporter must not be created");
        }
      });

      const result = await session.openPackagePath(fixture.packageRoot);

      assert.equal(result.model.status, "failed", entry.name);
      assert.ok(result.model.rightPanel.issues.some((issue) => issue.code === entry.issueCode), entry.name);
      assert.equal(exporterCreated, false, entry.name);
      assert.equal(preview.calls.length, 0, entry.name);
      assert.equal(result.aebOutput ?? null, null, entry.name);
      assert.deepEqual(await outputEntries(sessionRoot), [], entry.name);
    }
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("native sprite-frame expansion is bounded before exporter or Preview mutation", async () => {
  const root = await mkdtemp(path.join("/private/tmp", "auto-svga-aeb-native-expansion-reject-"));
  try {
    const fixture = await writePackageFixture(path.join(root, "package"));
    await mutatePackage(fixture.packagePath, (pkg) => {
      pkg.s3Report.composition.durationFrames = 10_000;
      const template = pkg.semanticGraph.layers[0];
      const hostTemplate = pkg.s3Report.layers[0];
      pkg.semanticGraph.layers = Array.from({ length: 11 }, (_, index) => ({
        ...template,
        layerId: `layer-task-fixture-${String(index + 1).padStart(4, "0")}`,
        keyframes: [
          { ...template.keyframes[0], frame: 0 },
          { ...template.keyframes[1], frame: 9_999 }
        ]
      }));
      pkg.s3Report.layers = pkg.semanticGraph.layers.map((layer) => ({
        ...hostTemplate,
        layerId: layer.layerId,
        sourceAssetId: layer.assetId,
        outPoint: 10_000 / 24
      }));
    });
    const preview = previewSpy();
    const sessionRoot = path.join(root, "session");
    let exporterCreated = false;
    const session = createAebNativePreviewSession({
      repoRoot,
      sessionRoot,
      previewSession: preview.session,
      exporterFactory() {
        exporterCreated = true;
        throw new Error("exporter must not be created");
      }
    });

    const result = await session.openPackagePath(fixture.packageRoot);

    assert.equal(result.model.status, "failed");
    assert.ok(result.model.rightPanel.issues.some((issue) => issue.code === "aeb.native_expansion_bound"));
    assert.equal(exporterCreated, false);
    assert.equal(preview.calls.length, 0);
    assert.equal(result.aebOutput ?? null, null);
    assert.equal(existsSync(path.join(sessionRoot, "aeb-native-preview")), false);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("generated SVGA output rejects oversize, escape, symlink, hardlink, empty, growth, and replacement before Preview or Save authority", async () => {
  const root = await mkdtemp(path.join("/private/tmp", "auto-svga-aeb-generated-output-reject-"));
  try {
    const cases = [
      {
        name: "oversize",
        issueCode: "aeb.generated_svga_bound",
        write(outputRoot) {
          const outputPath = path.join(outputRoot, "oversize.svga");
          writeFileSync(outputPath, "x");
          truncateSync(outputPath, 50 * 1024 * 1024 + 1);
          return outputPath;
        }
      },
      {
        name: "escape",
        issueCode: "aeb.generated_svga_output_escape",
        write(outputRoot, caseRoot) {
          const outputPath = path.join(caseRoot, "outside.svga");
          writeFileSync(outputPath, "outside");
          return outputPath;
        }
      },
      {
        name: "symlink",
        issueCode: "aeb.generated_svga_bound",
        write(outputRoot) {
          const target = path.join(outputRoot, "real.svga");
          const outputPath = path.join(outputRoot, "alias.svga");
          writeFileSync(target, "real");
          symlinkSync(target, outputPath);
          return outputPath;
        }
      },
      {
        name: "hardlink",
        issueCode: "aeb.generated_svga_bound",
        write(outputRoot) {
          const target = path.join(outputRoot, "real-hardlink.svga");
          const outputPath = path.join(outputRoot, "hardlink.svga");
          writeFileSync(target, "real");
          linkSync(target, outputPath);
          return outputPath;
        }
      },
      {
        name: "empty",
        issueCode: "aeb.generated_svga_bound",
        write(outputRoot) {
          const outputPath = path.join(outputRoot, "empty.svga");
          writeFileSync(outputPath, "");
          return outputPath;
        }
      },
      {
        name: "growth",
        issueCode: "aeb.generated_svga_changed_after_stat",
        write(outputRoot) {
          const outputPath = path.join(outputRoot, "growth.svga");
          writeFileSync(outputPath, "before");
          return outputPath;
        },
        afterOpen({ filePath, purpose }) {
          if (purpose === "generated-svga") appendFileSync(filePath, "x");
        }
      },
      {
        name: "replacement",
        issueCode: "aeb.generated_svga_identity_changed",
        write(outputRoot) {
          const outputPath = path.join(outputRoot, "replacement.svga");
          writeFileSync(outputPath, "before");
          return outputPath;
        },
        afterOpen({ filePath, purpose }) {
          if (purpose !== "generated-svga") return;
          renameSync(filePath, `${filePath}.old`);
          writeFileSync(filePath, "after");
        }
      }
    ];
    for (const entry of cases) {
      const caseRoot = path.join(root, entry.name);
      const fixture = await writePackageFixture(path.join(caseRoot, "package"));
      const preview = previewSpy();
      const sessionRoot = path.join(caseRoot, "session");
      const session = createAebNativePreviewSession({
        repoRoot,
        sessionRoot,
        previewSession: preview.session,
        fileReadHooks: entry.afterOpen ? { afterOpen: entry.afterOpen } : undefined,
        exporterFactory: () => ({
          async export(project, outputRoot) {
            return {
              outputPath: entry.write(outputRoot, caseRoot),
              validation: {
                exists: true,
                inflated: true,
                decoded: true,
                imageCount: 1,
                spriteCount: project.layers.length,
                frameCount: project.durationFrames
              }
            };
          }
        })
      });

      const result = await session.openPackagePath(fixture.packageRoot);

      assert.equal(result.model.status, "failed", entry.name);
      assert.ok(result.model.rightPanel.issues.some((issue) => issue.code === entry.issueCode), entry.name);
      assert.equal(preview.calls.length, 0, entry.name);
      assert.equal(result.aebOutput ?? null, null, entry.name);
      assert.deepEqual(await outputEntries(sessionRoot), [], entry.name);
    }
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("bake-required, blocked, and suggestion-only packages expose redacted owner diagnostics without Preview or Save authority", async () => {
  const root = await mkdtemp(path.join("/private/tmp", "auto-svga-aeb-compat-terminal-"));
  try {
    for (const entry of [
      { name: "bake-required", unsupportedLayer: "precomp", outcome: "bake_required" },
      { name: "blocked", unsupportedLayer: "text", outcome: "blocked" },
      { name: "suggestion-only", unsupportedLayer: "disabled-footage", outcome: "suggestion_only" }
    ]) {
      const fixture = await writePackageFixture(path.join(root, entry.name), { unsupportedLayer: entry.unsupportedLayer });
      const preview = previewSpy();
      const sessionRoot = path.join(root, `${entry.name}-session`);
      const session = createAebNativePreviewSession({ repoRoot, sessionRoot, previewSession: preview.session });

      const result = await session.openPackagePath(fixture.packageRoot);

      assert.equal(result.model.status, "failed", entry.name);
      assert.equal(result.aeb.compatibility.counts.native, 1, entry.name);
      assert.equal(result.aeb.compatibility.counts[entry.outcome], 1, entry.name);
      assert.equal(result.aeb.compatibility.outputAllowed, false, entry.name);
      assert.equal(result.aeb.compatibility.renderOrBakeExecuted, false, entry.name);
      assert.equal(result.aeb.ownerModel.schemaVersion, "auto-svga-aeb-owner-model-v1", entry.name);
      assert.equal(result.aeb.ownerModel.pathRedacted, true, entry.name);
      assert.equal(result.aeb.ownerModel.readOnly, true, entry.name);
      assert.equal(result.aeb.ownerModel.compatibility.outputAllowed, false, entry.name);
      assert.deepEqual(result.aeb.ownerModel.authority.resources, [{
        assetId: "asset-task-fixture-0001",
        sha256: fixture.assetSha256,
        sizeBytes: fixture.assetSizeBytes,
        width: 120,
        height: 80,
        hashVerified: true,
        pathRedacted: true
      }], entry.name);
      assert.deepEqual(result.aeb.ownerModel.authority.layers.map((layer) => ({
        layerId: layer.layerId,
        assetId: layer.assetId,
        outcome: layer.outcome,
        hostAuthorityBound: layer.hostAuthorityBound,
        resourceAuthorityBound: layer.resourceAuthorityBound
      })), [
        {
          layerId: "layer-task-fixture-0001",
          assetId: "asset-task-fixture-0001",
          outcome: "native",
          hostAuthorityBound: true,
          resourceAuthorityBound: true
        },
        {
          layerId: "layer-unsupported-0002",
          assetId: null,
          outcome: entry.outcome,
          hostAuthorityBound: true,
          resourceAuthorityBound: false
        }
      ], entry.name);
      assert.deepEqual(
        result.aeb.ownerModel.authority.layers.map(({ layerId, outcome, reason }) => ({ layerId, outcome, reason })),
        result.aeb.ownerModel.compatibility.decisions,
        entry.name
      );
      assert.ok(result.aeb.ownerModel.authority.layers.every((layer) => typeof layer.reason === "string" && layer.reason.length > 0), entry.name);
      assert.equal(result.model.rightPanel.assets.length, 1, entry.name);
      assert.ok(result.model.rightPanel.issues.some((item) => item.code === "aeb.compatibility_native"), entry.name);
      assert.ok(result.model.rightPanel.issues.some((item) => item.code === `aeb.compatibility_${entry.outcome}`), entry.name);
      assert.doesNotMatch(JSON.stringify(result), /\/Users\/|\\\\Users\\\\|auto-svga-aeb-bake-reject/u, entry.name);
      assert.equal(result.aeb.generatedSvga, null, entry.name);
      assert.equal(result.aebOutput, null, entry.name);
      assert.equal(preview.calls.length, 0, entry.name);
      assert.equal(existsSync(path.join(sessionRoot, "aeb-native-preview")), false, entry.name);
      assert.throws(() => session.readActiveGeneratedIdentity(), {
        code: "aeb.generated_identity_unavailable"
      }, entry.name);
    }
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("Preview reopen failure rolls back generated task output", async () => {
  const root = await mkdtemp(path.join("/private/tmp", "auto-svga-aeb-preview-rollback-"));
  try {
    const fixture = await writePackageFixture(path.join(root, "package"));
    const preview = previewSpy();
    const diagnostics = [];
    const sessionRoot = path.join(root, "session");
    const session = createAebNativePreviewSession({
      repoRoot,
      sessionRoot,
      previewSession: preview.session,
      previewFailureObserver: (value) => diagnostics.push(value)
    });

    const result = await session.openPackagePath(fixture.packageRoot);

    assert.equal(result.model.status, "failed");
    assert.equal(result.model.rightPanel.issues[0].code, "aeb.preview_reopen_failed");
    assert.equal(preview.calls.length, 1);
    assert.equal(diagnostics.length, 1);
    assert.deepEqual(diagnostics[0], {
      schema: "auto-svga-aeb-preview-reopen-diagnostic-v1",
      phase: "shared-preview-open-threw",
      pathIdentity: {
        basename: path.basename(preview.calls[0][0]),
        extension: ".svga",
        exists: true,
        regularFile: true,
        linkCount: 1,
        sizeBytes: diagnostics[0].pathIdentity.sizeBytes
      },
      errorName: "Error",
      errorCode: "unclassified",
      pathRedacted: true
    });
    assert.ok(diagnostics[0].pathIdentity.sizeBytes > 0);
    const outputParent = path.join(sessionRoot, "aeb-native-preview");
    assert.deepEqual(existsSync(outputParent) ? await readdir(outputParent) : [], []);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("Preview returned failure records only bounded path and typed issue diagnostics", async () => {
  const root = await mkdtemp(path.join("/private/tmp", "auto-svga-aeb-preview-returned-failure-"));
  try {
    const fixture = await writePackageFixture(path.join(root, "package"));
    const diagnostics = [];
    const preview = previewContractSpy(previewOpenResult({
      status: "failed",
      rightPanel: {
        facts: [],
        assets: [],
        issues: [{ code: "svga_parse_failed", severity: "error", message: "redacted" }]
      }
    }));
    const sessionRoot = path.join(root, "session");
    const session = createAebNativePreviewSession({
      repoRoot,
      sessionRoot,
      previewSession: preview.session,
      previewFailureObserver: (value) => diagnostics.push(value)
    });

    const result = await session.openPackagePath(fixture.packageRoot);

    assert.equal(result.model.status, "failed");
    assert.equal(result.model.rightPanel.issues[0].code, "aeb.preview_initial_state_rejected");
    assert.equal(diagnostics.length, 1);
    assert.equal(diagnostics[0].phase, "shared-preview-open-returned-failed-model");
    assert.equal(diagnostics[0].previewStatus, "failed");
    assert.equal(diagnostics[0].previewIssueCode, "svga_parse_failed");
    assert.equal(diagnostics[0].pathIdentity.extension, ".svga");
    assert.equal(diagnostics[0].pathIdentity.exists, true);
    assert.equal(diagnostics[0].pathIdentity.regularFile, true);
    assert.equal(diagnostics[0].pathIdentity.linkCount, 1);
    assert.equal(diagnostics[0].pathRedacted, true);
    assert.doesNotMatch(JSON.stringify(diagnostics), /\/private\/tmp|\/Users\//u);
    assert.deepEqual(await outputEntries(sessionRoot), []);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("generic package intake failures record one bounded private stage without path data", async () => {
  const root = await mkdtemp(path.join("/private/tmp", "auto-svga-aeb-intake-diagnostic-"));
  try {
    const fixture = await writePackageFixture(path.join(root, "package"));
    const diagnostics = [];
    const sessionRoot = path.join(root, "session");
    const session = createAebNativePreviewSession({
      repoRoot,
      sessionRoot,
      previewSession: previewSpy().session,
      exporterFactory: () => ({
        async export() {
          throw Object.assign(new TypeError("/Users/private/generated output failed"), {
            code: "ERR_INVALID_ARG_TYPE"
          });
        }
      }),
      intakeFailureObserver: (value) => diagnostics.push(value)
    });

    const result = await session.openPackagePath(fixture.packageRoot);

    assert.equal(result.model.status, "failed");
    assert.equal(result.model.rightPanel.issues[0].code, "aeb.package_intake_failed");
    assert.deepEqual(diagnostics, [{
      schema: "auto-svga-aeb-package-intake-diagnostic-v1",
      phase: "materialize-export-svga",
      errorName: "TypeError",
      errorCode: "ERR_INVALID_ARG_TYPE",
      pathRedacted: true
    }]);
    assert.doesNotMatch(JSON.stringify(diagnostics), /\/private\/tmp|\/Users\//u);
    assert.deepEqual(await outputEntries(sessionRoot), []);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("SVGA exporter substage failures retain one typed private intake boundary", async () => {
  const root = await mkdtemp(path.join("/private/tmp", "auto-svga-aeb-export-stage-diagnostic-"));
  try {
    const fixture = await writePackageFixture(path.join(root, "package"));
    const diagnostics = [];
    const sessionRoot = path.join(root, "session");
    const session = createAebNativePreviewSession({
      repoRoot,
      sessionRoot,
      previewSession: previewSpy().session,
      exporterFactory: ({ onStage }) => ({
        async export() {
          onStage("load-proto");
          throw Object.assign(new Error("private exporter details"), {
            code: "aeb.svga_export_load_proto_failed"
          });
        }
      }),
      intakeFailureObserver: (value) => diagnostics.push(value)
    });

    const result = await session.openPackagePath(fixture.packageRoot);

    assert.equal(result.model.status, "failed");
    assert.equal(result.model.rightPanel.issues[0].code, "aeb.svga_export_load_proto_failed");
    assert.deepEqual(diagnostics, [{
      schema: "auto-svga-aeb-package-intake-diagnostic-v1",
      phase: "materialize-export-load-proto",
      errorName: "Error",
      errorCode: "aeb.svga_export_load_proto_failed",
      pathRedacted: true
    }]);
    assert.doesNotMatch(JSON.stringify(diagnostics), /private exporter details|\/private\/tmp|\/Users\//u);
    assert.deepEqual(await outputEntries(sessionRoot), []);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("native Preview binds protobuf authority to the runtime root when process cwd differs", async () => {
  const root = await mkdtemp(path.join("/private/tmp", "auto-svga-aeb-runtime-root-proto-"));
  const originalCwd = process.cwd();
  try {
    const fixture = await writePackageFixture(path.join(root, "package"));
    const preview = previewContractSpy();
    process.chdir(root);
    const session = createAebNativePreviewSession({
      repoRoot,
      sessionRoot: path.join(root, "session"),
      previewSession: preview.session
    });

    const result = await session.openPackagePath(fixture.packageRoot);

    assert.equal(result.model.status, "previewReady");
    assert.equal(result.aeb.generatedSvga.validation.inflated, true);
    assert.match(result.aeb.generatedSvga.sha256, /^[a-f0-9]{64}$/u);
    assert.equal(result.aebOutput.saveAsAllowed, true);
  } finally {
    process.chdir(originalCwd);
    await rm(root, { recursive: true, force: true });
  }
});

function previewSpy() {
  const calls = [];
  return {
    calls,
    session: {
      async openLocalFilePath(...args) {
        calls.push(args);
        throw new Error("Preview must not be called for rejected packages");
      },
      async prepareRuntimePreview() {},
      async control() {}
    }
  };
}

function previewOpenResult(overrides = {}) {
  const model = {
    status: "previewReady",
    detectedFormat: "svga",
    requestId: "preview-request",
    commands: { play: true, pause: false },
    rightPanel: { facts: [], assets: [], issues: [] },
    ...overrides
  };
  if (overrides.status === undefined && Object.hasOwn(overrides, "status")) delete model.status;
  return {
    status: "opened",
    sourceId: overrides.sourceId ?? "c".repeat(24),
    model
  };
}

function previewContractSpy(openResult = previewOpenResult(), preparedResult, overrides = {}) {
  const controls = [];
  let openedPath = "";
  const session = {
    async openLocalFilePath(...args) {
      openedPath = args[0];
      if (overrides.openLocalFilePath) return overrides.openLocalFilePath(...args);
      return openResult;
    },
    async prepareRuntimePreview() {
      if (preparedResult) return preparedResult;
      return {
        status: "prepared",
        format: "svga",
        svgaBase64: (await readFile(openedPath)).toString("base64")
      };
    },
    async control(input) {
      controls.push(input);
      return previewOpenResult();
    }
  };
  return { session, controls };
}

async function outputEntries(sessionRoot) {
  const outputParent = path.join(sessionRoot, "aeb-native-preview");
  return existsSync(outputParent) ? readdir(outputParent) : [];
}

function deferred() {
  let resolve;
  const promise = new Promise((resolver) => {
    resolve = resolver;
  });
  return { promise, resolve };
}

async function waitFor(predicate, timeoutMs = 3_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (predicate()) return;
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  throw new Error("condition not reached before timeout");
}

function adjacentFloat(value, direction) {
  const bytes = Buffer.allocUnsafe(8);
  bytes.writeDoubleBE(value);
  const bits = bytes.readBigUInt64BE();
  bytes.writeBigUInt64BE(direction > 0 ? bits + 1n : bits - 1n);
  return bytes.readDoubleBE();
}

function findRepresentableSnapEdge(frame, direction, epsilon) {
  let inside = frame;
  while (true) {
    const candidate = adjacentFloat(inside, direction);
    if (Math.abs(candidate - frame) > epsilon) {
      return { inside, firstOutside: candidate };
    }
    inside = candidate;
  }
}

function findSecondsSnapEdge(frame, fps, direction, epsilon) {
  let inside = (frame + direction * epsilon) / fps;
  while (Math.abs(inside * fps - frame) > epsilon) {
    inside = adjacentFloat(inside, -direction);
  }
  while (Math.abs(adjacentFloat(inside, direction) * fps - frame) <= epsilon) {
    inside = adjacentFloat(inside, direction);
  }
  return { inside, firstOutside: adjacentFloat(inside, direction) };
}

function keyframesForRange(range) {
  const start = {
    frame: range.start,
    x: 150,
    y: 150,
    scaleX: 1,
    scaleY: 1,
    rotation: 0,
    opacity: 1
  };
  if (range.start === range.end) return [start];
  return [
    start,
    {
      frame: range.end,
      x: 170,
      y: 150,
      scaleX: 1,
      scaleY: 1,
      rotation: 0,
      opacity: 1
    }
  ];
}

async function writePackageFixture(packageRoot, options = {}) {
  const { encode } = await import("fast-png");
  const width = 120;
  const height = 80;
  let assetBytes;
  if (options.assetBytes) {
    assetBytes = Buffer.from(options.assetBytes);
  } else {
    const pixels = new Uint8Array(width * height * 4);
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const offset = (y * width + x) * 4;
        pixels[offset] = (x * 2) % 256;
        pixels[offset + 1] = (y * 3) % 256;
        pixels[offset + 2] = 180;
        pixels[offset + 3] = 255;
      }
    }
    assetBytes = Buffer.from(encode({ width, height, data: pixels }));
  }
  const assetSha256 = options.assetSha256 ?? sha256(assetBytes);
  const assetPath = path.join(packageRoot, "assets/layer-0001.png");
  const packagePath = path.join(packageRoot, "ae-export-package.finalized.json");
  await mkdir(path.dirname(assetPath), { recursive: true });
  await writeFile(assetPath, assetBytes);
  const forbiddenActions = {
    rendered: false,
    baked: false,
    collectedFiles: false,
    relinkedFootage: false,
    ranAeScript: true,
    installedPlugin: false,
    wroteImporterOutput: false,
    wroteEncoderOutput: false,
    acceptedThirdPartyUpdate: false
  };
  const nativeLayer = {
    layerId: "layer-task-fixture-0001",
    type: "image",
    assetId: "asset-task-fixture-0001",
    zIndex: 1,
    visible: true,
    anchor: { x: 60, y: 40 },
    transform: { x: 150, y: 150, scaleX: 1, scaleY: 1, rotation: 0, opacity: 1 },
    keyframes: [
      { frame: 0, x: 150, y: 150, scaleX: 1, scaleY: 1, rotation: 0, opacity: 1 },
      { frame: 119, x: 170, y: 150, scaleX: 1, scaleY: 1, rotation: 0, opacity: 1 }
    ]
  };
  nativeLayer.zIndex = options.nativeZIndex ?? nativeLayer.zIndex;
  nativeLayer.visible = options.nativeVisible ?? nativeLayer.visible;
  nativeLayer.anchor = { ...nativeLayer.anchor, ...options.nativeAnchor };
  nativeLayer.transform = { ...nativeLayer.transform, ...options.nativeTransform };
  nativeLayer.keyframes = options.nativeKeyframes ?? nativeLayer.keyframes;
  const unsupportedLayer = options.unsupportedLayer ? [{
    layerId: "layer-unsupported-0002",
    layerType: options.unsupportedLayer === "disabled-footage" ? "footage" : options.unsupportedLayer,
    enabled: options.unsupportedLayer !== "disabled-footage",
    effectCount: options.unsupportedLayer === "precomp" ? 1 : 0,
    maskCount: 0,
    hasAudio: false,
    expressedTransformFields: []
  }] : [];
  const packageValue = {
    packageIdentity: {
      packageId: options.packageId ?? "aeb-test-native-package",
      schemaVersion: "ae-export-package-wp1-draft",
      createdBy: options.createdBy ?? "wp2_thin_script_prototype"
    },
    redaction: {
      mode: "selector_only",
      absolutePathsAllowed: false,
      memberNamesAllowed: false,
      rawProductionMediaAllowed: false,
      externalVolumePathsAllowed: false
    },
    commonSource: {
      sourceSafety: { forbiddenActions },
      project: options.rawPath ? { unsafePath: options.rawPath } : { projectSelector: "TaskOwned/Test" }
    },
    semanticGraph: {
      schemaVersion: "aeb-semantic-graph-v0",
      targetFormat: "svga",
      nativeSubset: "image_transform_v0",
      sourceProof: {
        sampledTransforms: true,
        assetFilesExported: true,
        unsupportedFeaturesClassified: true,
        sourceProjectUnchanged: true
      },
      assets: [{
        assetId: "asset-task-fixture-0001",
        type: "image",
        packagePath: "assets/layer-0001.png",
        width,
        height,
        sha256: assetSha256,
        materialization: { status: "copied_hash_finalized", rawPathCollected: false }
      }, ...(options.duplicateAssetId ? [{
        assetId: "asset-task-fixture-0001",
        type: "image",
        packagePath: "assets/layer-0001.png",
        width,
        height,
        sha256: assetSha256,
        materialization: { status: "copied_hash_finalized", rawPathCollected: false }
      }] : [])],
      layers: [nativeLayer, ...(options.duplicateLayerId ? [{ ...nativeLayer }] : [])],
      unsupportedLayers: unsupportedLayer,
      limitations: ["semantic_graph_candidate_assets_materialized"]
    },
    renderPlan: null,
    replaceableSlots: [],
    outputProfiles: [
      { targetFormat: "svga", supportClaim: false },
      { targetFormat: "vap", supportClaim: false }
    ],
    s3Report: {
      scanStatus: "completed_metadata_only",
      sourceSafety: {
        forbiddenActions: {
          ...forbiddenActions,
          ranAeScript: options.s3RanAeScript ?? true
        }
      },
      composition: {
        width: 300,
        height: 300,
        fps: 24,
        durationFrames: 120,
        ...options.composition
      },
      layers: [{
        layerId: nativeLayer.layerId,
        sourceAssetId: nativeLayer.assetId,
        layerType: "footage",
        enabled: true,
        effectCount: 0,
        maskCount: 0,
        hasAudio: false,
        expressedTransformFields: [],
        inPoint: options.hostTiming?.inPoint ?? 0,
        outPoint: options.hostTiming?.outPoint ?? 5,
        startTime: options.hostTiming?.startTime ?? 0,
        stretch: options.hostTiming?.stretch ?? 100
      }, ...unsupportedLayer],
      renderQueue: { status: "not_executed" }
    },
    reports: [],
    hashBinding: { reportDigest: "test-bound" }
  };
  await writeFile(packagePath, `${JSON.stringify({
    schemaVersion: "aeb-wp2-script-output-v0",
    aeExportPackage: packageValue
  }, null, 2)}\n`);
  return { packageRoot, packagePath, assetPath, assetSha256: sha256(assetBytes), assetSizeBytes: assetBytes.byteLength };
}

async function writeMultiLayerPackageFixture(packageRoot, options = {}) {
  const fixture = await writePackageFixture(packageRoot, { packageId: "aeb-test-multi-layer-native-package" });
  const { encode } = await import("fast-png");
  const width = 64;
  const height = 48;
  const pixels = new Uint8Array(width * height * 4);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const offset = (y * width + x) * 4;
      pixels[offset] = 30;
      pixels[offset + 1] = (x * 4) % 256;
      pixels[offset + 2] = (y * 5) % 256;
      pixels[offset + 3] = 255;
    }
  }
  const secondBytes = Buffer.from(encode({ width, height, data: pixels }));
  const secondSha256 = sha256(secondBytes);
  const secondPath = path.join(packageRoot, "assets/layer-0002.png");
  await writeFile(secondPath, secondBytes);

  const document = JSON.parse(await readFile(fixture.packagePath, "utf8"));
  const pkg = document.aeExportPackage;
  const firstAsset = pkg.semanticGraph.assets[0];
  const firstLayer = {
    ...pkg.semanticGraph.layers[0],
    zIndex: 20,
    anchor: { x: 12, y: 18 },
    transform: { x: 220, y: 90, scaleX: 1.2, scaleY: 0.7, rotation: 30, opacity: 0.75 },
    keyframes: [
      { frame: 0, x: 220, y: 90, scaleX: 1.2, scaleY: 0.7, rotation: 30, opacity: 0.75 },
      { frame: 119, x: 240, y: 110, scaleX: 1, scaleY: 1, rotation: 60, opacity: 1 }
    ]
  };
  const secondAsset = {
    assetId: "asset-task-fixture-0002",
    type: "image",
    packagePath: "assets/layer-0002.png",
    width,
    height,
    sha256: secondSha256,
    materialization: { status: "copied_hash_finalized", rawPathCollected: false }
  };
  const secondLayer = {
    layerId: "layer-task-fixture-0002",
    type: "image",
    assetId: secondAsset.assetId,
    zIndex: 5,
    visible: true,
    anchor: { x: 8, y: 36 },
    transform: { x: 75, y: 210, scaleX: 0.8, scaleY: 1.1, rotation: -20, opacity: 0.9 },
    keyframes: [
      { frame: 0, x: 75, y: 210, scaleX: 0.8, scaleY: 1.1, rotation: -20, opacity: 0.9 },
      { frame: 119, x: 95, y: 180, scaleX: 1.1, scaleY: 0.9, rotation: 10, opacity: 0.6 }
    ]
  };
  if (options.equalZIndex) {
    firstLayer.zIndex = 10;
    secondLayer.zIndex = 10;
  }
  const firstHost = pkg.s3Report.layers[0];
  const secondHost = {
    layerId: secondLayer.layerId,
    sourceAssetId: secondLayer.assetId,
    layerType: "footage",
    enabled: true,
    effectCount: 0,
    maskCount: 0,
    hasAudio: false,
    expressedTransformFields: [],
    inPoint: 0,
    outPoint: 5,
    startTime: 0,
    stretch: 100
  };
  pkg.semanticGraph.assets = options.reverseInput ? [secondAsset, firstAsset] : [firstAsset, secondAsset];
  pkg.semanticGraph.layers = options.reverseInput ? [secondLayer, firstLayer] : [firstLayer, secondLayer];
  pkg.s3Report.layers = options.reverseInput ? [secondHost, firstHost] : [firstHost, secondHost];
  await writeFile(fixture.packagePath, `${JSON.stringify(document, null, 2)}\n`);

  return {
    ...fixture,
    secondPath,
    assetSha256ById: {
      [firstAsset.assetId]: firstAsset.sha256,
      [secondAsset.assetId]: secondAsset.sha256
    }
  };
}

async function decodeSvga(bytes) {
  const protobuf = require("protobufjs");
  const root = await protobuf.load(path.join(repoRoot, "proto/svga.proto"));
  const MovieEntity = root.lookupType("com.opensource.svga.MovieEntity");
  return MovieEntity.toObject(MovieEntity.decode(inflateSync(bytes)), { bytes: Buffer });
}

async function encodeSvgaWithMatrix(matrix, imageBytes, durationFrames) {
  const protobuf = require("protobufjs");
  const root = await protobuf.load(path.join(repoRoot, "proto/svga.proto"));
  const MovieEntity = root.lookupType("com.opensource.svga.MovieEntity");
  const payload = {
    version: "2.0",
    params: { viewBoxWidth: 300, viewBoxHeight: 300, fps: 24, frames: durationFrames },
    images: { img_0: imageBytes },
    sprites: [{
      imageKey: "img_0",
      frames: Array.from({ length: durationFrames }, () => ({
        alpha: 1,
        layout: { x: 0, y: 0, width: 120, height: 80 },
        transform: matrix
      }))
    }],
    audios: []
  };
  assert.equal(MovieEntity.verify(payload), null);
  return deflateSync(MovieEntity.encode(MovieEntity.create(payload)).finish());
}

async function mutateSvgaBytes(bytes, mutate) {
  const protobuf = require("protobufjs");
  const root = await protobuf.load(path.join(repoRoot, "proto/svga.proto"));
  const MovieEntity = root.lookupType("com.opensource.svga.MovieEntity");
  const payload = MovieEntity.toObject(MovieEntity.decode(inflateSync(bytes)), {
    arrays: true,
    bytes: Buffer,
    defaults: true,
    objects: true
  });
  mutate(payload);
  assert.equal(MovieEntity.verify(payload), null);
  return deflateSync(MovieEntity.encode(MovieEntity.create(payload)).finish());
}

async function mutateSvgaBytesClosed(bytes, mutate) {
  const protobuf = require("protobufjs");
  const root = await protobuf.load(path.join(repoRoot, "proto/svga.proto"));
  const MovieEntity = root.lookupType("com.opensource.svga.MovieEntity");
  const payload = MovieEntity.toObject(MovieEntity.decode(inflateSync(bytes)), {
    arrays: true,
    bytes: Buffer,
    defaults: true,
    objects: true
  });
  pruneEmptyUnsupportedSvgaDefaults(payload);
  mutate(payload);
  pruneEmptyUnsupportedSvgaDefaults(payload);
  assert.equal(MovieEntity.verify(payload), null);
  return deflateSync(MovieEntity.encode(MovieEntity.create(payload)).finish());
}

function pruneEmptyUnsupportedSvgaDefaults(movie) {
  if (Array.isArray(movie.audios) && movie.audios.length === 0) delete movie.audios;
  for (const sprite of movie.sprites ?? []) {
    if (sprite.matteKey === "") delete sprite.matteKey;
    for (const frame of sprite.frames ?? []) {
      if (frame.clipPath === "") delete frame.clipPath;
      if (Array.isArray(frame.shapes) && frame.shapes.length === 0) delete frame.shapes;
    }
  }
}

function mutateInflatedSvgaBytes(bytes, mutate) {
  return deflateSync(mutate(Buffer.from(inflateSync(bytes))));
}

function appendWire(bytes, ...chunks) {
  return mutateInflatedSvgaBytes(bytes, (inflated) => Buffer.concat([inflated, ...chunks]));
}

function wireTag(field, wireType) {
  return wireVarint((field << 3) | wireType);
}

function wireVarint(value) {
  const bytes = [];
  let next = value;
  do {
    let byte = next & 0x7f;
    next = Math.floor(next / 128);
    if (next > 0) byte |= 0x80;
    bytes.push(byte);
  } while (next > 0);
  return Buffer.from(bytes);
}

function wireString(field, value) {
  const body = Buffer.from(value);
  return Buffer.concat([wireTag(field, 2), wireVarint(body.byteLength), body]);
}

function wireVarintField(field, value) {
  return Buffer.concat([wireTag(field, 0), wireVarint(value)]);
}

function wireLengthDelimited(field, body) {
  return Buffer.concat([wireTag(field, 2), wireVarint(body.byteLength), body]);
}

function reorderedRootFields(bytes) {
  return mutateInflatedSvgaBytes(bytes, (inflated) => {
    const fields = rootWireSegments(inflated);
    assert.ok(fields.length >= 4);
    return Buffer.concat([fields[1].bytes, fields[0].bytes, ...fields.slice(2).map((field) => field.bytes)]);
  });
}

function rootWireSegments(inflated) {
  const segments = [];
  let offset = 0;
  while (offset < inflated.byteLength) {
    const start = offset;
    const tag = readWireVarintForTest(inflated, offset);
    offset = tag.offset;
    const wireType = tag.value & 0x7;
    if (wireType === 0) {
      offset = readWireVarintForTest(inflated, offset).offset;
    } else if (wireType === 1) {
      offset += 8;
    } else if (wireType === 2) {
      const length = readWireVarintForTest(inflated, offset);
      offset = length.offset + length.value;
    } else if (wireType === 5) {
      offset += 4;
    } else {
      throw new Error(`unsupported test wire type ${wireType}`);
    }
    assert.ok(offset <= inflated.byteLength);
    segments.push({ bytes: inflated.subarray(start, offset) });
  }
  return segments;
}

function readWireVarintForTest(bytes, offset) {
  let result = 0;
  let multiplier = 1;
  let cursor = offset;
  for (let index = 0; index < 10; index += 1) {
    const byte = bytes[cursor];
    cursor += 1;
    result += (byte & 0x7f) * multiplier;
    if ((byte & 0x80) === 0) return { value: result, offset: cursor };
    multiplier *= 128;
  }
  throw new Error("overlong test varint");
}

function generatedFrameStructureMutations() {
  return [
    {
      name: "missing-alpha",
      expectedRequiredFields: false,
      expectedCanonical: false,
      mutate: (movie) => { delete movie.sprites[0].frames[0].alpha; }
    },
    {
      name: "missing-layout",
      expectedRequiredFields: false,
      expectedCanonical: false,
      mutate: (movie) => { delete movie.sprites[0].frames[0].layout; }
    },
    {
      name: "missing-transform",
      expectedRequiredFields: false,
      expectedCanonical: false,
      mutate: (movie) => { delete movie.sprites[0].frames[0].transform; }
    },
    {
      name: "nonempty-clipPath",
      mutate: (movie) => { movie.sprites[0].frames[0].clipPath = "runtime-mask"; }
    },
    {
      name: "shape-entity",
      mutate: (movie) => {
        movie.sprites[0].frames[0].shapes = [{
          type: 1,
          rect: { x: 0, y: 0, width: 1, height: 1, cornerRadius: 0 }
        }];
      }
    },
    {
      name: "sprite-matte-key",
      mutate: (movie) => { movie.sprites[0].matteKey = "matte_0"; }
    },
    {
      name: "audio-entity",
      mutate: (movie) => {
        movie.audios = [{ audioKey: "audio_0", startFrame: 0, endFrame: 1, startTime: 0, totalTime: 1 }];
      }
    },
    {
      name: "empty-layout",
      expectedRequiredFields: false,
      expectedCanonical: false,
      mutate: (movie) => { movie.sprites[0].frames[0].layout = {}; }
    },
    {
      name: "empty-transform",
      expectedRequiredFields: false,
      expectedCanonical: false,
      mutate: (movie) => { movie.sprites[0].frames[0].transform = {}; }
    },
    {
      name: "missing-layout-width",
      expectedRequiredFields: false,
      expectedCanonical: false,
      mutate: (movie) => { delete movie.sprites[0].frames[0].layout.width; }
    },
    {
      name: "missing-transform-tx",
      expectedRequiredFields: false,
      expectedCanonical: false,
      mutate: (movie) => { delete movie.sprites[0].frames[0].transform.tx; }
    },
    {
      name: "shorter-sprite-timeline",
      expectedFrameCountsMatch: false,
      mutate: (movie) => { movie.sprites[0].frames.pop(); }
    },
    {
      name: "longer-sprite-timeline",
      expectedFrameCountsMatch: false,
      mutate: (movie) => { movie.sprites[0].frames.push(structuredClone(movie.sprites[0].frames[0])); }
    }
  ];
}

function resourceHashesInSpriteOrder(decoded) {
  return decoded.sprites.map((sprite) => sha256(Buffer.from(decoded.images[sprite.imageKey])));
}

function matrixFor({ x, y, scaleX, scaleY, rotation, anchorX, anchorY }) {
  const radians = (rotation / 180) * Math.PI;
  const a = Math.cos(radians) * scaleX;
  const b = Math.sin(radians) * scaleX;
  const c = -Math.sin(radians) * scaleY;
  const d = Math.cos(radians) * scaleY;
  return {
    a,
    b,
    c,
    d,
    tx: x - (a * anchorX + c * anchorY),
    ty: y - (b * anchorX + d * anchorY)
  };
}

function assertFrameTransform(frame, expected, tolerance = 1e-5) {
  for (const field of ["a", "b", "c", "d", "tx", "ty"]) {
    assertNear(frame.transform[field] ?? 0, expected[field], field, tolerance);
  }
}

function assertNear(actual, expected, label = "value", tolerance = 1e-5) {
  assert.ok(Math.abs(actual - expected) < tolerance, `${label}: ${actual} != ${expected}`);
}

async function mutatePackage(packagePath, mutate) {
  const document = JSON.parse(await readFile(packagePath, "utf8"));
  mutate(document.aeExportPackage);
  await writeFile(packagePath, `${JSON.stringify(document, null, 2)}\n`);
}

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}
