import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { chmod, lstat, mkdir, mkdtemp, readFile, readdir, realpath, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import {
  CONTRACT,
  PermitError,
  assessRuntimePendingOutcome,
  authorityPaths,
  buildLaunchSpec,
  buildProcessAuthorityInvocation,
  collectCrashContext,
  collectPacketMaterialHashes,
  expectedAuthorityBinding,
  loadAndValidateProcessAuthority,
  prepareProcessAuthorityRoot,
  snapshotElectronTree,
  summarizeProcessAuthority,
  summarizeCrashContext,
  summarizeDistributionBinding,
  summarizeRuntimePending,
  validateFreshOutputRoot,
  validateGitBindingSnapshot,
  validatePreflightRelay,
  validateProcessAuthorityArtifact,
  withFreshPreLaunchIdentity,
} from "./run-registered-electron-bootstrap-discriminator.mjs";
import {
  assessFinalization,
  buildVisibleFinalDisposition,
  finalizeMode,
  validatePendingDisposition,
  validatePostrunRelay,
  validateRuntimeMarkerFiles,
} from "./finalize-registered-electron-bootstrap-discriminator.mjs";

async function withTemporaryRoot(run) {
  const root = await mkdtemp(path.join(tmpdir(), "auto-svga-aeb-bootstrap-test-"));
  try {
    return await run(await realpath(root));
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

function validRelay(overrides = {}) {
  const now = Date.now();
  const executionId = "aeb-electron-bootstrap-test-001";
  const prelaunchProcessAuthority = expectedAuthorityBinding({
    artifactSha256: "5".repeat(64),
    invocationSha256: "6".repeat(64),
    forbiddenPids: [],
  });
  return {
    schema: "aeb-pm-registered-electron-bootstrap-preflight-v1",
    permitId: "ASV-APR-20260714-999",
    executionId,
    sourceHead: CONTRACT.sourceHead,
    packetHead: "a".repeat(40),
    currentHead: "c".repeat(40),
    electronApp: CONTRACT.electronApp,
    outputRoot: `${CONTRACT.taskRoot}/aeb-electron-bootstrap-20260714-001`,
    capturedAtUtc: new Date(now - 1000).toISOString(),
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
        capturedAtUtc: new Date(now - 2000).toISOString(),
        foregroundLeaseConflict: false,
        competingForegroundWorker: false,
        modalState: "clear",
        keychainPromptState: "absent",
        runtimeApprovalPopupState: "absent",
      },
      {
        capturedAtUtc: new Date(now - 1000).toISOString(),
        foregroundLeaseConflict: false,
        competingForegroundWorker: false,
        modalState: "clear",
        keychainPromptState: "absent",
        runtimeApprovalPopupState: "absent",
      },
    ],
    prelaunchProcessAuthority,
    runnerSha256: "1".repeat(64),
    bootstrapSha256: "2".repeat(64),
    testSha256: "3".repeat(64),
    finalizerSha256: "7".repeat(64),
    evidenceStoreSha256: CONTRACT.expectedEvidenceStoreSha256,
    orchestratorSha256: "8".repeat(64),
    lifecycleTestSha256: "9".repeat(64),
    relayPublisherSha256: "a".repeat(64),
    permitPacketSha256: "4".repeat(64),
    ...overrides,
  };
}

function relayExpected(relay, nowMs = Date.parse(relay.capturedAtUtc) + 1000) {
  return {
    permitId: relay.permitId,
    executionId: relay.executionId,
    packetHead: relay.packetHead,
    currentHead: relay.currentHead,
    outputRoot: relay.outputRoot,
    nowMs,
    prelaunchProcessAuthority: relay.prelaunchProcessAuthority,
    packetMaterialHashes: {
      runnerSha256: relay.runnerSha256,
      bootstrapSha256: relay.bootstrapSha256,
      testSha256: relay.testSha256,
      finalizerSha256: relay.finalizerSha256,
      evidenceStoreSha256: relay.evidenceStoreSha256,
      orchestratorSha256: relay.orchestratorSha256,
      lifecycleTestSha256: relay.lifecycleTestSha256,
      relayPublisherSha256: relay.relayPublisherSha256,
      permitPacketSha256: relay.permitPacketSha256,
    },
  };
}

test("distribution snapshot is deterministic and detects byte drift", async () => {
  await withTemporaryRoot(async (root) => {
    const left = path.join(root, "left.app");
    const right = path.join(root, "right.app");
    await mkdir(path.join(left, "Contents"), { recursive: true });
    await mkdir(path.join(right, "Contents"), { recursive: true });
    await writeFile(path.join(left, "Contents/a"), "alpha");
    await writeFile(path.join(right, "Contents/a"), "alpha");
    await symlink("a", path.join(left, "Contents/current"));
    await symlink("a", path.join(right, "Contents/current"));
    const first = await snapshotElectronTree(left);
    const second = await snapshotElectronTree(right);
    assert.equal(first.entryCount, 2);
    assert.equal(first.manifestSha256, second.manifestSha256);
    await writeFile(path.join(right, "Contents/a"), "changed");
    assert.notEqual(first.manifestSha256, (await snapshotElectronTree(right)).manifestSha256);
  });
});

test("preflight relay accepts only a fresh fully clear PM decision", () => {
  const relay = validRelay();
  assert.equal(validatePreflightRelay(relay, relayExpected(relay)), true);
  for (const mutation of [
    { foregroundLeaseConflict: true },
    { modalState: "ambiguous" },
    { keychainPromptState: "present" },
    { runtimeApprovalPopupState: "present" },
    { commandApprovalDecision: "unknown" },
    { executionId: "wrong-execution-id-000" },
    { controlStabilitySamples: [] },
    { prelaunchProcessAuthority: { ...relay.prelaunchProcessAuthority, producerExitStatus: 2 } },
  ]) {
    const rejected = validRelay(mutation);
    assert.throws(
      () => validatePreflightRelay(rejected, relayExpected(relay)),
      (error) => error instanceof PermitError && error.issueCode === "preflight_relay_rejected",
    );
  }
});

test("preflight relay rejects one material hash that differs from independently expected bytes", () => {
  const relay = validRelay();
  const expectedMaterialHashes = {
    runnerSha256: relay.runnerSha256,
    bootstrapSha256: relay.bootstrapSha256,
    testSha256: relay.testSha256,
    finalizerSha256: relay.finalizerSha256,
    evidenceStoreSha256: relay.evidenceStoreSha256,
    orchestratorSha256: relay.orchestratorSha256,
    lifecycleTestSha256: relay.lifecycleTestSha256,
    relayPublisherSha256: relay.relayPublisherSha256,
    permitPacketSha256: relay.permitPacketSha256,
  };
  relay.runnerSha256 = "f".repeat(64);
  assert.throws(() => validatePreflightRelay(relay, {
    ...relayExpected(relay),
    packetMaterialHashes: expectedMaterialHashes,
  }), (error) => {
    assert.equal(error instanceof PermitError, true);
    assert.equal(error.issueCode, "preflight_relay_rejected");
    assert.equal(error.details.failures[0].field, "runnerSha256");
    return true;
  });
});

test("preflight relay rejects stale control samples under a fresh top-level capture", () => {
  const relay = validRelay();
  const nowMs = Date.parse(relay.capturedAtUtc) + 1000;
  relay.controlStabilitySamples = relay.controlStabilitySamples.map((sample, index) => ({
    ...sample,
    capturedAtUtc: new Date(nowMs - 120_000 + index * 1000).toISOString(),
  }));
  assert.throws(
    () => validatePreflightRelay(relay, relayExpected(relay, nowMs)),
    (error) => error instanceof PermitError && error.issueCode === "preflight_relay_rejected",
  );
});

function validAuthorityArtifact({ forbiddenPids = [], nowMs = Date.now() } = {}) {
  const sample = (offset) => ({
    capturedAtUtc: new Date(nowMs + offset).toISOString(),
    pidCount: 42,
    nameReadableCount: 40,
    pathReadableCount: 39,
    evaluation: {
      accepted: true,
      targetMatches: [],
      ambiguousTargetNames: [],
      forbiddenPidMatches: [],
      liveUnidentifiedPids: [],
      unstableGenerationPids: [],
      nonRunnableCorpsePids: [],
      exitedDuringCapturePids: [],
    },
    launchctl: { available: true, status: 0, outputBytes: 128, issue: null, matchedNeedles: [] },
    lsappinfoSupplemental: {
      list: { available: false, status: 0, outputBytes: 0, issue: "unavailable_or_unparseable" },
      front: { available: false, status: 0, outputBytes: 8, issue: "unavailable_or_unparseable" },
    },
    authorityAccepted: true,
  });
  return {
    schema: CONTRACT.processAuthoritySchema,
    capturedAtUtc: new Date(nowMs - 500).toISOString(),
    scriptPath: CONTRACT.producerScriptPath,
    scriptSha256: CONTRACT.producerScriptSha256,
    targetRoots: [CONTRACT.electronApp],
    targetNames: [...CONTRACT.processAuthorityTargetNames],
    forbiddenPids,
    launchctlNeedles: [...CONTRACT.processAuthorityLaunchctlNeedles],
    sampleCount: 2,
    samples: [sample(-1500), sample(-750)],
    authorityAccepted: true,
    mutationPerformed: false,
    launchPerformed: false,
    foregroundActionPerformed: false,
  };
}

test("process authority rejects malformed identity, stale ordering, binding drift, and residue", () => {
  const nowMs = Date.now();
  const base = validAuthorityArtifact({ nowMs });
  assert.equal(validateProcessAuthorityArtifact(base, { forbiddenPids: [], notBeforeMs: null, nowMs }), base);
  assert.throws(
    () => validateProcessAuthorityArtifact(base, { forbiddenPids: [], notBeforeMs: nowMs, nowMs }),
    (error) => error instanceof PermitError && error.issueCode === "process_authority_rejected",
  );
  const mutations = [
    { schema: "wrong" },
    { scriptSha256: "f".repeat(64) },
    { targetRoots: ["/wrong"] },
    { targetNames: ["Electron"] },
    { forbiddenPids: [123] },
    { launchctlNeedles: [] },
    { authorityAccepted: false },
    { capturedAtUtc: new Date(nowMs - 120_000).toISOString() },
    { samples: [base.samples[1], base.samples[0]] },
    { samples: [{ ...base.samples[0], authorityAccepted: false }, base.samples[1]] },
    { samples: [{ ...base.samples[0], evaluation: { ...base.samples[0].evaluation, targetMatches: [{ pid: 1 }] } }, base.samples[1]] },
    { samples: [{ ...base.samples[0], evaluation: { ...base.samples[0].evaluation, liveUnidentifiedPids: [7] } }, base.samples[1]] },
    { samples: [{ ...base.samples[0], launchctl: { ...base.samples[0].launchctl, matchedNeedles: ["com.github.Electron"] } }, base.samples[1]] },
  ];
  for (const mutation of mutations) {
    const artifact = { ...base, ...mutation };
    assert.throws(
      () => validateProcessAuthorityArtifact(artifact, { forbiddenPids: [], notBeforeMs: null, nowMs }),
      (error) => error instanceof PermitError && error.issueCode === "process_authority_rejected",
    );
  }
});

test("private authority loader binds canonical path, artifact hash, and exact invocation", async () => {
  await withTemporaryRoot(async (root) => {
    const executionId = "aeb-electron-bootstrap-test-001";
    const paths = authorityPaths(executionId, root);
    await mkdir(paths.authorityRoot, { recursive: true });
    const artifact = validAuthorityArtifact();
    const bytes = `${JSON.stringify(artifact, null, 2)}\n`;
    await writeFile(paths.prelaunchArtifactPath, bytes);
    const sha256 = await import("node:crypto").then(({ createHash }) => createHash("sha256").update(bytes).digest("hex"));
    const loaded = await loadAndValidateProcessAuthority({
      artifactPath: paths.prelaunchArtifactPath,
      artifactSha256: sha256,
      phase: "prelaunch",
      executionId,
      baseRoot: root,
    });
    assert.equal(loaded.binding.producerExitStatus, 0);
    assert.equal(loaded.invocation.command, "/usr/bin/python3");
    await assert.rejects(
      loadAndValidateProcessAuthority({
        artifactPath: paths.prelaunchArtifactPath,
        artifactSha256: "0".repeat(64),
        phase: "prelaunch",
        executionId,
        baseRoot: root,
      }),
      (error) => error instanceof PermitError && error.issueCode === "process_authority_hash_mismatch",
    );
    const alias = path.join(paths.authorityRoot, "alias.json");
    await symlink(paths.prelaunchArtifactPath, alias);
    await assert.rejects(
      loadAndValidateProcessAuthority({
        artifactPath: alias,
        artifactSha256: sha256,
        phase: "prelaunch",
        executionId,
        baseRoot: root,
      }),
      (error) => error instanceof PermitError && error.issueCode === "process_authority_file_rejected",
    );
  });
});

test("process authority root preparation creates the producer-required fresh 0700 execution directory", async () => {
  await withTemporaryRoot(async (root) => {
    await chmod(root, 0o700);
    const executionId = "aeb-electron-bootstrap-test-001";
    const baseRoot = path.join(root, "process-authority");
    const invocation = buildProcessAuthorityInvocation({ phase: "prelaunch", executionId, baseRoot });
    const prepared = await prepareProcessAuthorityRoot({ executionId, baseRoot, taskRoot: root, requireAbsent: true });
    assert.equal(prepared.authorityRoot, invocation.authorityRoot);
    assert.equal(prepared.prelaunchArtifactPath, invocation.artifactPath);
    assert.deepEqual(await readdir(prepared.authorityRoot), []);
    assert.equal((await lstat(prepared.baseRoot)).mode & 0o777, 0o700);
    assert.equal((await lstat(prepared.authorityRoot)).mode & 0o777, 0o700);
  });
});

test("process authority root preparation rejects missing task roots, aliases, wrong ownership, path escapes, and stale children", async () => {
  await withTemporaryRoot(async (root) => {
    await chmod(root, 0o700);
    const executionId = "aeb-electron-bootstrap-test-001";
    await assert.rejects(
      prepareProcessAuthorityRoot({
        executionId,
        baseRoot: path.join(root, "missing", "process-authority"),
        taskRoot: path.join(root, "missing"),
      }),
      (error) => error instanceof PermitError && error.issueCode === "process_authority_task_root_missing",
    );
    await assert.rejects(
      prepareProcessAuthorityRoot({
        executionId,
        baseRoot: path.join(root, "escaped-authority"),
        taskRoot: root,
      }),
      (error) => error instanceof PermitError && error.issueCode === "process_authority_base_outside_task_root",
    );
    await assert.rejects(
      prepareProcessAuthorityRoot({
        executionId,
        baseRoot: path.join(root, "process-authority"),
        taskRoot: root,
        ownerUid: (typeof process.getuid === "function" ? process.getuid() : 0) + 1,
      }),
      (error) => error instanceof PermitError && error.issueCode === "process_authority_task_root_owner_invalid",
    );
  });

  await withTemporaryRoot(async (root) => {
    await chmod(root, 0o700);
    const executionId = "aeb-electron-bootstrap-test-001";
    const baseRoot = path.join(root, "process-authority");
    await mkdir(baseRoot, { mode: 0o755 });
    await chmod(baseRoot, 0o755);
    await assert.rejects(
      prepareProcessAuthorityRoot({ executionId, baseRoot, taskRoot: root }),
      (error) => error instanceof PermitError && error.issueCode === "process_authority_base_mode_invalid",
    );
  });

  await withTemporaryRoot(async (root) => {
    await chmod(root, 0o700);
    const executionId = "aeb-electron-bootstrap-test-001";
    const baseRoot = path.join(root, "process-authority");
    await symlink(root, baseRoot);
    await assert.rejects(
      prepareProcessAuthorityRoot({ executionId, baseRoot, taskRoot: root }),
      (error) => error instanceof PermitError && error.issueCode === "process_authority_base_alias",
    );
  });

  await withTemporaryRoot(async (root) => {
    await chmod(root, 0o700);
    const executionId = "aeb-electron-bootstrap-test-001";
    const baseRoot = path.join(root, "process-authority");
    const prepared = await prepareProcessAuthorityRoot({ executionId, baseRoot, taskRoot: root });
    await assert.rejects(
      prepareProcessAuthorityRoot({ executionId, baseRoot, taskRoot: root, requireAbsent: true }),
      (error) => error instanceof PermitError && error.issueCode === "process_authority_root_exists",
    );
    await writeFile(path.join(prepared.authorityRoot, "prelaunch-authority.json"), "{}\n");
    await prepareProcessAuthorityRoot({
      executionId,
      baseRoot,
      taskRoot: root,
      allowedExistingEntries: ["prelaunch-authority.json"],
    });
    await writeFile(path.join(prepared.authorityRoot, "stale-child.json"), "{}\n");
    await assert.rejects(
      prepareProcessAuthorityRoot({
        executionId,
        baseRoot,
        taskRoot: root,
        allowedExistingEntries: ["prelaunch-authority.json"],
      }),
      (error) => error instanceof PermitError && error.issueCode === "process_authority_root_not_fresh",
    );
  });
});

test("owner-visible authority summary redacts raw roots, executable records, and PIDs", () => {
  const artifact = validAuthorityArtifact({ forbiddenPids: [98765] });
  const invocation = buildProcessAuthorityInvocation({
    phase: "postrun",
    executionId: "aeb-electron-bootstrap-test-001",
    expectedPid: 98765,
  });
  const summary = summarizeProcessAuthority({
    artifact,
    artifactSha256: "a".repeat(64),
    artifactByteLength: 2048,
    invocation,
  });
  const text = JSON.stringify(summary);
  assert.doesNotMatch(text, /\/Users\/|\/Applications\/|Electron\.app|98765|"pid"/);
  assert.equal(summary.authorityAccepted, true);
  assert.equal(summary.forbiddenPidsSha256.length, 64);
});

test("owner-visible source binding redacts distribution paths and crash records", () => {
  const distribution = {
    appPath: "/Users/example/Electron.app",
    executablePath: "/Users/example/Electron.app/Contents/MacOS/Electron",
    bundleId: "com.github.Electron",
    version: "42.4.1",
    build: "42.4.1",
    executableName: "Electron",
    executableByteLength: 123,
    executableSha256: "1".repeat(64),
    infoPlistSha256: "2".repeat(64),
    tree: { entryCount: 1, fileCount: 1, symlinkCount: 0, totalFileBytes: 123, manifestSha256: "3".repeat(64) },
    codeSignDisplayStatus: 0,
    codeSignDisplaySha256: "4".repeat(64),
    strictCodeSignStatus: 1,
    strictCodeSignOutputSha256: "5".repeat(64),
    strictCodeSignIssue: "missing_resources",
    rootQuarantine: { present: false },
    executableQuarantine: { present: false },
  };
  const crashContext = {
    reportCount: 1,
    reports: [{ basename: "Electron.ips", incidentId: "private", pid: 999, path: "/Users/example/private" }],
    allSigabrt: true,
    allCodexCoalition: true,
    allRegisterApplicationStack: true,
  };
  const visible = JSON.stringify({
    distribution: summarizeDistributionBinding(distribution),
    crashContext: summarizeCrashContext(crashContext),
  });
  assert.doesNotMatch(visible, /\/Users\/|Electron\.app|Electron\.ips|private|"pid"\s*:/);
  assert.match(visible, /identitySha256|reportSetSha256/);
});

test("fresh output root rejects outside, existing, and aliased task roots", async () => {
  await withTemporaryRoot(async (root) => {
    const taskRoot = path.join(root, "task-root");
    await mkdir(taskRoot, { mode: 0o700 });
    assert.equal(
      await validateFreshOutputRoot(path.join(taskRoot, "fresh-run"), taskRoot),
      path.join(taskRoot, "fresh-run"),
    );
    await chmod(taskRoot, 0o755);
    await assert.rejects(
      validateFreshOutputRoot(path.join(taskRoot, "fresh-mode-reject"), taskRoot),
      (error) => error instanceof PermitError && error.issueCode === "task_root_mode_invalid",
    );
    await chmod(taskRoot, 0o700);
    await mkdir(path.join(taskRoot, "existing"));
    await assert.rejects(
      validateFreshOutputRoot(path.join(taskRoot, "existing"), taskRoot),
      (error) => error instanceof PermitError && error.issueCode === "output_root_exists",
    );
    await assert.rejects(
      validateFreshOutputRoot(path.join(root, "outside"), taskRoot),
      (error) => error instanceof PermitError && error.issueCode === "output_root_outside_task_root",
    );
    const actual = path.join(root, "actual");
    const alias = path.join(root, "alias");
    await mkdir(actual);
    await symlink(actual, alias);
    await assert.rejects(
      validateFreshOutputRoot(path.join(alias, "fresh"), alias),
      (error) => error instanceof PermitError && error.issueCode === "task_root_alias",
    );
  });
});

test("launch specification has one registered LaunchServices action and no fallback", () => {
  const binding = {
    schema: "auto-svga-registered-electron-evidence-binding-v1",
    helperSha256: CONTRACT.expectedEvidenceStoreSha256,
    createdAtUtc: new Date().toISOString(),
    outputName: "aeb-electron-bootstrap-20260714-001",
    identities: {},
  };
  const spec = buildLaunchSpec({
    permitId: "ASV-APR-20260714-999",
    packetHead: "b".repeat(40),
    executionId: "aeb-electron-bootstrap-test-001",
    outputRoot: `${CONTRACT.taskRoot}/aeb-electron-bootstrap-20260714-001`,
    evidenceStore: {
      binding,
      bindingSha256: "e".repeat(64),
    },
  });
  assert.equal(spec.command, "/usr/bin/open");
  assert.deepEqual(spec.args.slice(0, 5), ["-n", "-g", "-a", CONTRACT.electronApp, "--args"]);
  assert.equal(spec.attemptLimit, 1);
  assert.equal(spec.alternateLauncherAllowed, false);
  assert.equal(spec.directExecutableAllowed, false);
  assert.equal(spec.args.includes("aeb-electron-bootstrap-test-001"), true);
  assert.equal(spec.args.includes("--evidence-binding-sha256"), true);
  assert.equal(spec.args.includes("e".repeat(64)), true);
  assert.doesNotMatch(spec.args.join(" "), /--inspect|product-proof|aeb-native-preview/);
});

test("exact Git binding rejects descendant or mismatched current heads", () => {
  const packetHead = "a".repeat(40);
  assert.equal(validateGitBindingSnapshot({
    actualHead: packetHead,
    actualBranch: CONTRACT.branch,
    trackedStatusEmpty: true,
    sourceAncestor: true,
  }, packetHead).actualHead, packetHead);
  assert.throws(() => validateGitBindingSnapshot({
    actualHead: "b".repeat(40),
    actualBranch: CONTRACT.branch,
    trackedStatusEmpty: true,
    sourceAncestor: true,
  }, packetHead), (error) => error instanceof PermitError && error.issueCode === "git_binding_drift");
});

test("pre-launch packet hash drift prevents the launch callback", async () => {
  const packetHead = "a".repeat(40);
  const initialGitBinding = {
    actualHead: packetHead,
    actualBranch: CONTRACT.branch,
    trackedStatusEmpty: true,
    sourceAncestor: true,
    packetHead,
  };
  const initialPacketMaterialHashes = {
    runnerSha256: "1".repeat(64),
    bootstrapSha256: "2".repeat(64),
    testSha256: "3".repeat(64),
    finalizerSha256: "7".repeat(64),
    evidenceStoreSha256: CONTRACT.expectedEvidenceStoreSha256,
    orchestratorSha256: "8".repeat(64),
    lifecycleTestSha256: "9".repeat(64),
    relayPublisherSha256: "a".repeat(64),
    permitPacketSha256: "4".repeat(64),
  };
  const relay = validRelay({
    packetHead,
    currentHead: packetHead,
  });
  let launchCallbackCount = 0;
  const initialProcessAuthority = {
    artifactSha256: relay.prelaunchProcessAuthority.artifactSha256,
    invocation: { invocationSha256: relay.prelaunchProcessAuthority.invocationSha256 },
    binding: relay.prelaunchProcessAuthority,
  };
  await assert.rejects(withFreshPreLaunchIdentity({
    permitId: relay.permitId,
    packetHead,
    executionId: relay.executionId,
    outputRoot: relay.outputRoot,
    relay,
    initialGitBinding,
    initialPacketMaterialHashes,
    initialProcessAuthority,
    revalidateProcessAuthority: async () => initialProcessAuthority,
  }, async () => {
    launchCallbackCount += 1;
  }, {
    verifyGitBinding: () => ({ ...initialGitBinding }),
    collectPacketMaterialHashes: async () => ({
      ...initialPacketMaterialHashes,
      runnerSha256: "f".repeat(64),
    }),
  }), (error) => error instanceof PermitError && error.issueCode === "pre_launch_identity_drift");
  assert.equal(launchCallbackCount, 0);
});

test("runtime material authority excludes mutable governance files while local contract drift still rejects", async () => {
  const runnerSource = await readFile(
    new URL("run-registered-electron-bootstrap-discriminator.mjs", import.meta.url),
    "utf8",
  );
  assert.doesNotMatch(runnerSource, /review\//u);
  assert.doesNotMatch(runnerSource, /TASK_RETRO_LEDGER/u);

  const before = await collectPacketMaterialHashes();
  const ledgerBytes = await readFile(
    new URL("../../docs/retrospectives/TASK_RETRO_LEDGER.jsonl", import.meta.url),
    "utf8",
  );
  const currentLedgerSha256 = createHash("sha256").update(ledgerBytes).digest("hex");
  const grownLedgerSha256 = createHash("sha256")
    .update(`${ledgerBytes}{"schema":"unrelated-ledger-growth-test"}\n`)
    .digest("hex");
  assert.notEqual(grownLedgerSha256, currentLedgerSha256);
  assert.deepEqual(await collectPacketMaterialHashes(), before);

  const relay = validRelay({ packetHead: "a".repeat(40), currentHead: "a".repeat(40) });
  const initialGitBinding = {
    actualHead: relay.packetHead,
    actualBranch: CONTRACT.branch,
    trackedStatusEmpty: true,
    sourceAncestor: true,
    packetHead: relay.packetHead,
  };
  const initialProcessAuthority = {
    artifactSha256: relay.prelaunchProcessAuthority.artifactSha256,
    invocation: { invocationSha256: relay.prelaunchProcessAuthority.invocationSha256 },
    binding: relay.prelaunchProcessAuthority,
  };
  let launchCallbackCount = 0;
  await assert.rejects(withFreshPreLaunchIdentity({
    permitId: relay.permitId,
    packetHead: relay.packetHead,
    executionId: relay.executionId,
    outputRoot: relay.outputRoot,
    relay,
    initialGitBinding,
    initialPacketMaterialHashes: before,
    initialProcessAuthority,
    revalidateProcessAuthority: async () => initialProcessAuthority,
  }, async () => {
    launchCallbackCount += 1;
  }, {
    verifyGitBinding: () => initialGitBinding,
    collectPacketMaterialHashes: async () => ({
      ...before,
      permitPacketSha256: "f".repeat(64),
    }),
  }), (error) => error instanceof PermitError && error.issueCode === "pre_launch_identity_drift");
  assert.equal(launchCallbackCount, 0);
});

test("pre-launch process-authority drift prevents the launch callback", async () => {
  const relay = validRelay({ packetHead: "a".repeat(40), currentHead: "a".repeat(40) });
  const initialGitBinding = {
    actualHead: relay.packetHead,
    actualBranch: CONTRACT.branch,
    trackedStatusEmpty: true,
    sourceAncestor: true,
    packetHead: relay.packetHead,
  };
  const initialPacketMaterialHashes = relayExpected(relay).packetMaterialHashes;
  const initialProcessAuthority = {
    artifactSha256: relay.prelaunchProcessAuthority.artifactSha256,
    invocation: { invocationSha256: relay.prelaunchProcessAuthority.invocationSha256 },
    binding: relay.prelaunchProcessAuthority,
  };
  let launchCallbackCount = 0;
  await assert.rejects(withFreshPreLaunchIdentity({
    permitId: relay.permitId,
    packetHead: relay.packetHead,
    executionId: relay.executionId,
    outputRoot: relay.outputRoot,
    relay,
    initialGitBinding,
    initialPacketMaterialHashes,
    initialProcessAuthority,
    revalidateProcessAuthority: async () => ({
      ...initialProcessAuthority,
      artifactSha256: "0".repeat(64),
    }),
  }, async () => {
    launchCallbackCount += 1;
  }, {
    verifyGitBinding: () => initialGitBinding,
    collectPacketMaterialHashes: async () => initialPacketMaterialHashes,
  }), (error) => error instanceof PermitError && error.issueCode === "pre_launch_process_authority_drift");
  assert.equal(launchCallbackCount, 0);
});

function runtimeMarkers({ pendingAtMs = Date.now() - 1_000, runtimeDurationMs = 5_000 } = {}) {
  const permitId = "ASV-APR-20260714-999";
  const packetHead = "a".repeat(40);
  const executionId = "aeb-electron-bootstrap-test-001";
  const evidenceBindingSha256 = "e".repeat(64);
  const launchedAtMs = pendingAtMs - runtimeDurationMs;
  const markerSpacingMs = runtimeDurationMs / 5;
  const base = {
    permitId,
    packetHead,
    executionId,
    sourceHead: CONTRACT.sourceHead,
    pid: 123,
    processExecPath: `${CONTRACT.electronApp}/${CONTRACT.executableRelativePath}`,
    appPath: CONTRACT.electronApp,
    bundleId: CONTRACT.bundleId,
    electronVersion: CONTRACT.version,
    evidenceBindingSha256,
  };
  return {
    permitId,
    packetHead,
    executionId,
    launchResult: { status: 0 },
    launchedAtUtc: new Date(launchedAtMs).toISOString(),
    pendingAtUtc: new Date(pendingAtMs).toISOString(),
    evidenceBindingSha256,
    firstMarker: {
      ...base,
      schema: "auto-svga-registered-electron-bootstrap-v0-first-javascript",
      phase: "first-javascript",
      recordedAtUtc: new Date(launchedAtMs + markerSpacingMs).toISOString(),
    },
    readyMarker: {
      ...base,
      schema: "auto-svga-registered-electron-bootstrap-v0-app-ready",
      phase: "app-ready",
      userDataBound: true,
      sessionDataBound: true,
      windowsCreated: 0,
      recordedAtUtc: new Date(launchedAtMs + markerSpacingMs * 2).toISOString(),
    },
    willQuitMarker: {
      ...base,
      schema: "auto-svga-registered-electron-bootstrap-v0-normal-quit-will-quit",
      phase: "normal-quit-will-quit",
      recordedAtUtc: new Date(launchedAtMs + markerSpacingMs * 3).toISOString(),
    },
    quitObservedMarker: {
      ...base,
      schema: "auto-svga-registered-electron-bootstrap-v0-normal-quit-observed",
      phase: "normal-quit-observed",
      exitCode: 0,
      recordedAtUtc: new Date(launchedAtMs + markerSpacingMs * 4).toISOString(),
    },
  };
}

test("runner stops at postrun-authority pending and never directly PASS", () => {
  const valid = runtimeMarkers();
  assert.equal(
    assessRuntimePendingOutcome(valid).status,
    "runtime_completed_pending_postrun_authority",
  );
  assert.equal(
    assessRuntimePendingOutcome({ ...valid, quitObservedMarker: null }).issueCode,
    "normal_quit_observed_marker_missing",
  );
  assert.equal(
    assessRuntimePendingOutcome({ ...valid, launchResult: { status: 1 } }).status,
    "runtime_failed_pending_postrun_authority",
  );
});

test("valid pre authority does not invoke local ps and still ends pending", async () => {
  const source = await readFile(
    new URL("./run-registered-electron-bootstrap-discriminator.mjs", import.meta.url),
    "utf8",
  );
  const executeSource = source.slice(source.indexOf("async function executeMode"), source.indexOf("export function assessRuntimePendingOutcome"));
  assert.doesNotMatch(executeSource, /capturePassiveProcessState|waitForZeroResidue|runDynamicPrelaunchProcessGate|\/bin\/ps/);
  assert.equal(assessRuntimePendingOutcome(runtimeMarkers()).status, "runtime_completed_pending_postrun_authority");
});

function validPendingDisposition(options = {}) {
  const markers = runtimeMarkers(options);
  return {
    schema: "auto-svga-registered-electron-bootstrap-runtime-pending-v1",
    status: "runtime_completed_pending_postrun_authority",
    earliestMissingPhase: "postrun_process_authority",
    issueCode: "postrun_process_authority_required",
    permitId: markers.permitId,
    executionId: markers.executionId,
    packetHead: markers.packetHead,
    sourceHead: CONTRACT.sourceHead,
    pendingAtUtc: markers.pendingAtUtc,
    outputRootSha256: "b".repeat(64),
    launchAttemptsPerformed: 1,
    launchResult: { ...markers.launchResult, signal: null },
    evidenceStore: {
      schema: "auto-svga-registered-electron-evidence-binding-v1",
      helperSha256: CONTRACT.expectedEvidenceStoreSha256,
      bindingSha256: markers.evidenceBindingSha256,
      bindingByteLength: 512,
      createdAtUtc: markers.launchedAtUtc,
      directoryIdentitySha256: "d".repeat(64),
    },
    prelaunchAuthorityArtifactSha256: "5".repeat(64),
    launchedAtUtc: markers.launchedAtUtc,
    firstJavaScriptMarker: markers.firstMarker,
    appReadyMarker: markers.readyMarker,
    normalQuitWillQuitMarker: markers.willQuitMarker,
    normalQuitObservedMarker: markers.quitObservedMarker,
    markerHashes: {
      firstJavaScript: "1".repeat(64),
      appReady: "2".repeat(64),
      normalQuitWillQuit: "3".repeat(64),
      normalQuitObserved: "4".repeat(64),
    },
    crashBefore: { reports: [] },
    postrunAuthorityRequired: true,
    finalPassAllowedInRunner: false,
    productProofContinued: false,
    forcedTerminationUsed: false,
    retryUsed: false,
  };
}

function validPostrunAuthority(pending = validPendingDisposition(), nowMs = Date.now()) {
  const artifact = validAuthorityArtifact({ forbiddenPids: [pending.firstJavaScriptMarker.pid], nowMs });
  const invocation = buildProcessAuthorityInvocation({
    phase: "postrun",
    executionId: pending.executionId,
    expectedPid: pending.firstJavaScriptMarker.pid,
  });
  return {
    artifact,
    artifactSha256: "8".repeat(64),
    artifactByteLength: 4096,
    invocation,
    binding: expectedAuthorityBinding({
      artifactSha256: "8".repeat(64),
      invocationSha256: invocation.invocationSha256,
      forbiddenPids: [pending.firstJavaScriptMarker.pid],
    }),
  };
}

function expectedPendingBinding(pending, nowMs = Date.parse(pending.pendingAtUtc) + 1_000) {
  return {
    permitId: pending.permitId,
    executionId: pending.executionId,
    packetHead: pending.packetHead,
    prelaunchAuthorityArtifactSha256: pending.prelaunchAuthorityArtifactSha256,
    outputRootSha256: pending.outputRootSha256,
    evidenceBindingSha256: pending.evidenceStore.bindingSha256,
    nowMs,
  };
}

function validPostrunRelay(pending, postrunAuthority, nowMs = Date.now()) {
  const identity = pending.firstJavaScriptMarker;
  return {
    schema: "aeb-pm-registered-electron-bootstrap-postrun-v0",
    capturedAtUtc: new Date(nowMs - 250).toISOString(),
    permitId: pending.permitId,
    executionId: pending.executionId,
    packetHead: pending.packetHead,
    sourceHead: CONTRACT.sourceHead,
    pendingDispositionSha256: "9".repeat(64),
    prelaunchAuthorityArtifactSha256: pending.prelaunchAuthorityArtifactSha256,
    postrunAuthorityArtifactSha256: postrunAuthority.artifactSha256,
    mutationPerformed: false,
    launchPerformed: false,
    foregroundActionPerformed: false,
    outputRootSha256: pending.outputRootSha256,
    evidenceBindingSha256: pending.evidenceStore.bindingSha256,
    expectedPid: identity.pid,
    processExecPathSha256: createHash("sha256").update(identity.processExecPath).digest("hex"),
    appPathSha256: createHash("sha256").update(identity.appPath).digest("hex"),
    markerHashes: pending.markerHashes,
    postrunProcessAuthority: postrunAuthority.binding,
  };
}

test("postrun finalizer binds pending, same PID/path markers, relay, zero residue, and empty crash delta", () => {
  const pending = validPendingDisposition();
  const postrunAuthority = validPostrunAuthority();
  assert.equal(validatePendingDisposition(pending, expectedPendingBinding(pending)), pending);
  const relay = validPostrunRelay(pending, postrunAuthority);
  assert.equal(validatePostrunRelay(relay, {
    permitId: pending.permitId,
    executionId: pending.executionId,
    packetHead: pending.packetHead,
    pendingDispositionSha256: relay.pendingDispositionSha256,
    prelaunchAuthorityArtifactSha256: pending.prelaunchAuthorityArtifactSha256,
    postrunAuthorityArtifactSha256: postrunAuthority.artifactSha256,
    outputRootSha256: pending.outputRootSha256,
    evidenceBindingSha256: pending.evidenceStore.bindingSha256,
    expectedPid: pending.firstJavaScriptMarker.pid,
    processExecPathSha256: relay.processExecPathSha256,
    appPathSha256: relay.appPathSha256,
    markerHashes: pending.markerHashes,
    postrunProcessAuthority: postrunAuthority.binding,
    postrunAuthorityCapturedAtMs: Date.parse(postrunAuthority.artifact.capturedAtUtc),
    nowMs: Date.parse(relay.capturedAtUtc) + 1000,
  }), relay);
  assert.equal(assessFinalization({ pending, postrunAuthority, crashReports: [] }).status, "pass");
  assert.notEqual(assessFinalization({ pending, postrunAuthority: null, crashReports: [] }).status, "pass");
  assert.notEqual(assessFinalization({ pending, postrunAuthority, crashReports: [{ sha256: "f".repeat(64) }] }).status, "pass");
});

test("pending evidence rederives every sole-PASS invariant and rejects contradictions", () => {
  const pending = validPendingDisposition();
  const expected = expectedPendingBinding(pending);
  assert.equal(
    assessFinalization({ pending, postrunAuthority: validPostrunAuthority(), crashReports: [] }).issueCode,
    "runtime_pending_not_validated",
  );
  for (const mutation of [
    { firstJavaScriptMarker: { ...pending.firstJavaScriptMarker, processExecPath: "/wrong" } },
    { appReadyMarker: { ...pending.appReadyMarker, pid: 999 } },
    { appReadyMarker: { ...pending.appReadyMarker, userDataBound: false } },
    { appReadyMarker: { ...pending.appReadyMarker, sessionDataBound: false } },
    { appReadyMarker: { ...pending.appReadyMarker, windowsCreated: 1 } },
    { normalQuitObservedMarker: { ...pending.normalQuitObservedMarker, exitCode: 1 } },
    { launchAttemptsPerformed: 99 },
    { launchResult: { status: 0, signal: "SIGABRT" } },
    { postrunAuthorityRequired: false },
    { finalPassAllowedInRunner: true },
    { productProofContinued: true },
    { forcedTerminationUsed: true },
    { retryUsed: true },
    { earliestMissingPhase: "product_proof" },
    { issueCode: null },
    { evidenceStore: { ...pending.evidenceStore, bindingSha256: "0".repeat(64) } },
    {
      normalQuitObservedMarker: {
        ...pending.normalQuitObservedMarker,
        recordedAtUtc: new Date(Date.parse(pending.firstJavaScriptMarker.recordedAtUtc) - 1000).toISOString(),
      },
    },
  ]) {
    assert.throws(
      () => validatePendingDisposition({ ...pending, ...mutation }, expected),
      (error) => error instanceof PermitError && error.issueCode === "runtime_pending_rejected",
    );
  }
  const mutatedAfterValidation = validPendingDisposition();
  validatePendingDisposition(mutatedAfterValidation, expectedPendingBinding(mutatedAfterValidation));
  mutatedAfterValidation.retryUsed = true;
  assert.equal(
    assessFinalization({
      pending: mutatedAfterValidation,
      postrunAuthority: validPostrunAuthority(),
      crashReports: [],
    }).issueCode,
    "runtime_pending_not_validated",
  );
});

test("pending chain enforces freshness, future skew, runtime duration, and exact boundaries", () => {
  const nowMs = Date.parse("2026-07-14T16:00:00.000Z");
  const stale = validPendingDisposition({
    pendingAtMs: nowMs - CONTRACT.runtimePendingMaxAgeMs - 1,
  });
  const future = validPendingDisposition({
    pendingAtMs: nowMs + CONTRACT.runtimeFutureSkewMs + 1,
  });
  const overlong = validPendingDisposition({
    pendingAtMs: nowMs - 1_000,
    runtimeDurationMs: CONTRACT.runtimeMaxDurationMs + 1,
  });
  for (const pending of [stale, future, overlong]) {
    assert.throws(
      () => validatePendingDisposition(pending, expectedPendingBinding(pending, nowMs)),
      (error) => error instanceof PermitError && error.issueCode === "runtime_pending_rejected",
    );
  }
  for (const pending of [
    validPendingDisposition({ pendingAtMs: nowMs - CONTRACT.runtimePendingMaxAgeMs }),
    validPendingDisposition({ pendingAtMs: nowMs + CONTRACT.runtimeFutureSkewMs }),
    validPendingDisposition({
      pendingAtMs: nowMs - 1_000,
      runtimeDurationMs: CONTRACT.runtimeMaxDurationMs,
    }),
    validPendingDisposition({ pendingAtMs: nowMs - 1_000 }),
  ]) {
    assert.equal(validatePendingDisposition(pending, expectedPendingBinding(pending, nowMs)), pending);
  }
});

test("finalizer independently re-reads exact marker bytes", async () => {
  const pending = validPendingDisposition();
  const records = new Map();
  for (const [valueField, hashField, basename] of [
    ["firstJavaScriptMarker", "firstJavaScript", "first-javascript-marker.json"],
    ["appReadyMarker", "appReady", "app-ready-marker.json"],
    ["normalQuitWillQuitMarker", "normalQuitWillQuit", "normal-quit-will-quit.json"],
    ["normalQuitObservedMarker", "normalQuitObserved", "normal-quit-observed.json"],
  ]) {
    const bytes = `${JSON.stringify(pending[valueField], null, 2)}\n`;
    const sha256 = createHash("sha256").update(bytes).digest("hex");
    pending.markerHashes[hashField] = sha256;
    records.set(basename, { value: pending[valueField], sha256 });
  }
  const readBoundEvidenceRecord = async (_store, basename) => records.get(basename);
  assert.equal(await validateRuntimeMarkerFiles(pending, {}, { readBoundEvidenceRecord }), true);
  records.set("app-ready-marker.json", { value: { tampered: true }, sha256: pending.markerHashes.appReady });
  await assert.rejects(
    validateRuntimeMarkerFiles(pending, {}, { readBoundEvidenceRecord }),
    (error) => error instanceof PermitError && error.issueCode === "runtime_marker_binding_mismatch",
  );
});

test("postrun relay rejects replay, cross-execution, wrong pending binding, PID, and marker identity", () => {
  const pending = validPendingDisposition();
  const postrunAuthority = validPostrunAuthority();
  const relay = validPostrunRelay(pending, postrunAuthority);
  const expected = {
    permitId: pending.permitId,
    executionId: pending.executionId,
    packetHead: pending.packetHead,
    pendingDispositionSha256: relay.pendingDispositionSha256,
    prelaunchAuthorityArtifactSha256: pending.prelaunchAuthorityArtifactSha256,
    outputRootSha256: pending.outputRootSha256,
    evidenceBindingSha256: pending.evidenceStore.bindingSha256,
    postrunAuthorityArtifactSha256: postrunAuthority.artifactSha256,
    expectedPid: pending.firstJavaScriptMarker.pid,
    processExecPathSha256: relay.processExecPathSha256,
    appPathSha256: relay.appPathSha256,
    markerHashes: pending.markerHashes,
    postrunProcessAuthority: postrunAuthority.binding,
    postrunAuthorityCapturedAtMs: Date.parse(postrunAuthority.artifact.capturedAtUtc),
    nowMs: Date.parse(relay.capturedAtUtc) + 1000,
  };
  for (const mutation of [
    { executionId: "aeb-electron-bootstrap-other-001" },
    { pendingDispositionSha256: "0".repeat(64) },
    { prelaunchAuthorityArtifactSha256: "0".repeat(64) },
    { outputRootSha256: "0".repeat(64) },
    { evidenceBindingSha256: "0".repeat(64) },
    { expectedPid: 999 },
    { markerHashes: { ...relay.markerHashes, appReady: "0".repeat(64) } },
    { postrunProcessAuthority: { ...relay.postrunProcessAuthority, producerExitStatus: 2 } },
    { capturedAtUtc: new Date(Date.parse(relay.capturedAtUtc) - 120_000).toISOString() },
  ]) {
    assert.throws(
      () => validatePostrunRelay({ ...relay, ...mutation }, expected),
      (error) => error instanceof PermitError && error.issueCode === "postrun_relay_rejected",
    );
  }
});

test("final visible evidence is redacted and publishes validated private invariants", () => {
  const pending = validPendingDisposition();
  validatePendingDisposition(pending, expectedPendingBinding(pending));
  const postrunAuthority = validPostrunAuthority();
  const visible = buildVisibleFinalDisposition({
    pending,
    pendingDispositionSha256: "9".repeat(64),
    postrunRelaySha256: "a".repeat(64),
    postrunAuthority,
    crashReports: [],
    outcome: assessFinalization({ pending, postrunAuthority, crashReports: [] }),
  });
  const text = JSON.stringify(visible);
  assert.doesNotMatch(text, /\/Users\/|\/Applications\/|Electron\.app|"pid"\s*:/);
  assert.equal(visible.launchAttemptsPerformed, pending.launchAttemptsPerformed);
  assert.equal(visible.userDataBound, pending.appReadyMarker.userDataBound);
  assert.equal(visible.sessionDataBound, pending.appReadyMarker.sessionDataBound);
  assert.equal(visible.windowsCreated, pending.appReadyMarker.windowsCreated);
  assert.equal(visible.postrunAuthorityRequired, pending.postrunAuthorityRequired);
  assert.equal(visible.finalPassAllowedInRunner, pending.finalPassAllowedInRunner);
  assert.equal(visible.productProofContinued, pending.productProofContinued);
  assert.equal(visible.forcedTerminationUsed, pending.forcedTerminationUsed);
  assert.equal(visible.retryUsed, pending.retryUsed);
});

test("descriptor-bound evidence store rejects child, reports, output, and task swaps without outside writes", async () => {
  await withTemporaryRoot(async (root) => {
    const helperPath = path.resolve(
      path.dirname(new URL(import.meta.url).pathname),
      "registered-electron-evidence-store.py",
    );
    const source = String.raw`
import importlib.util
import json
import os
import sys

helper_path, base_root = sys.argv[1], sys.argv[2]
spec = importlib.util.spec_from_file_location("evidence_store", helper_path)
store = importlib.util.module_from_spec(spec)
spec.loader.exec_module(store)
store.BASE_ROOT = base_root
store.TASK_NAME = "task-root"
store.TASK_ROOT = os.path.join(base_root, store.TASK_NAME)
task_root = store.TASK_ROOT
output_name = "aeb-evidence-test-001"
output_root = os.path.join(task_root, output_name)
outside = os.path.join(base_root, "outside")
os.mkdir(task_root)
os.chmod(task_root, 0o755)
try:
    store.create_tree(output_root)
except ValueError as error:
    if "owned-mode 0700" not in str(error):
        raise
else:
    raise AssertionError("preexisting 0755 task root was accepted")
os.rmdir(task_root)
os.mkdir(task_root, 0o700)
os.mkdir(outside)

os.symlink(outside, output_root)
try:
    store.create_tree(output_root)
    raise AssertionError("preexisting child alias was accepted")
except Exception:
    pass
assert os.listdir(outside) == []
os.unlink(output_root)

tree, _ = store.create_tree(output_root)
try:
    store.atomic_write_json(tree, "exclusive.json", {"value": 1})
    try:
        store.atomic_write_json(tree, "exclusive.json", {"value": 2})
        raise AssertionError("exclusive record was overwritten")
    except FileExistsError:
        pass
    assert store.read_json_record(tree, "exclusive.json")["value"] == {"value": 1}

    def swap_reports(bound):
        os.rename(store.REPORTS_NAME, "reports-held", src_dir_fd=bound.output_fd, dst_dir_fd=bound.output_fd)
        os.symlink(outside, store.REPORTS_NAME, dir_fd=bound.output_fd)
    try:
        store.atomic_write_json(tree, "reports-swap.json", {"value": 3}, before_link=swap_reports)
        raise AssertionError("reports swap was accepted")
    except Exception:
        pass
    assert os.listdir(outside) == []
    assert not any(name.startswith(".evidence-") for name in os.listdir(tree.reports_fd))
    os.unlink(store.REPORTS_NAME, dir_fd=tree.output_fd)
    os.rename("reports-held", store.REPORTS_NAME, src_dir_fd=tree.output_fd, dst_dir_fd=tree.output_fd)
    tree.assert_current()

    os.rename(output_name, "output-held", src_dir_fd=tree.task_fd, dst_dir_fd=tree.task_fd)
    os.symlink(outside, output_name, dir_fd=tree.task_fd)
    try:
        store.atomic_write_json(tree, "output-swap.json", {"value": 4})
        raise AssertionError("output swap was accepted")
    except Exception:
        pass
    assert os.listdir(outside) == []
    os.unlink(output_name, dir_fd=tree.task_fd)
    os.rename("output-held", output_name, src_dir_fd=tree.task_fd, dst_dir_fd=tree.task_fd)
    tree.assert_current()

    os.rename(store.TASK_NAME, "task-held", src_dir_fd=tree.base_fd, dst_dir_fd=tree.base_fd)
    os.symlink(outside, store.TASK_NAME, dir_fd=tree.base_fd)
    try:
        store.atomic_write_json(tree, "task-swap.json", {"value": 5})
        raise AssertionError("task swap was accepted")
    except Exception:
        pass
    assert os.listdir(outside) == []
    os.unlink(store.TASK_NAME, dir_fd=tree.base_fd)
    os.rename("task-held", store.TASK_NAME, src_dir_fd=tree.base_fd, dst_dir_fd=tree.base_fd)
    tree.assert_current()
finally:
    tree.close()

print(json.dumps({"status": "pass", "outsideEntries": os.listdir(outside)}))
`;
    const result = spawnSync("/usr/bin/python3", ["-c", source, helperPath, root], {
      encoding: "utf8",
      maxBuffer: 1024 * 1024,
    });
    assert.equal(result.status, 0, result.stderr);
    assert.deepEqual(JSON.parse(result.stdout), { status: "pass", outsideEntries: [] });
  });
});

function createNoLaunchFinalizerFixture(pending, nowMs) {
  const outputRoot = `${CONTRACT.taskRoot}/aeb-electron-bootstrap-test-001`;
  pending.outputRootSha256 = createHash("sha256").update(outputRoot).digest("hex");
  const postrunAuthority = validPostrunAuthority(pending, nowMs);
  const records = new Map();
  const put = (name, value) => {
    const bytes = `${JSON.stringify(value, null, 2)}\n`;
    const record = {
      value,
      sha256: createHash("sha256").update(bytes).digest("hex"),
      byteLength: Buffer.byteLength(bytes),
    };
    records.set(name, record);
    return record;
  };
  for (const [field, hashField, name] of [
    ["firstJavaScriptMarker", "firstJavaScript", "first-javascript-marker.json"],
    ["appReadyMarker", "appReady", "app-ready-marker.json"],
    ["normalQuitWillQuitMarker", "normalQuitWillQuit", "normal-quit-will-quit.json"],
    ["normalQuitObservedMarker", "normalQuitObserved", "normal-quit-observed.json"],
  ]) {
    pending.markerHashes[hashField] = put(name, pending[field]).sha256;
  }
  const pendingRecord = put("runtime-pending-private.json", pending);
  const relay = validPostrunRelay(pending, postrunAuthority, nowMs);
  relay.pendingDispositionSha256 = pendingRecord.sha256;
  const relayBytes = `${JSON.stringify(relay, null, 2)}\n`;
  const relaySha256 = createHash("sha256").update(relayBytes).digest("hex");
  const paths = authorityPaths(pending.executionId);
  const writes = [];
  const args = {
    "permit-id": pending.permitId,
    "packet-head": pending.packetHead,
    "execution-id": pending.executionId,
    "output-root": outputRoot,
    "evidence-binding-sha256": pending.evidenceStore.bindingSha256,
    "pending-disposition-sha256": pendingRecord.sha256,
    "prelaunch-authority-sha256": pending.prelaunchAuthorityArtifactSha256,
    "postrun-authority": paths.postrunArtifactPath,
    "postrun-authority-sha256": postrunAuthority.artifactSha256,
    "postrun-relay": paths.postrunRelayPath,
    "postrun-relay-sha256": relaySha256,
  };
  const dependencies = {
    loadBoundEvidenceStore: async () => ({ outputRoot, bindingSha256: pending.evidenceStore.bindingSha256 }),
    readBoundEvidenceRecord: async (_store, name) => {
      const record = records.get(name);
      if (!record) throw new Error(`missing test record ${name}`);
      return record;
    },
    writeBoundEvidenceRecord: async (_store, name, value) => {
      if (records.has(name)) throw new PermitError("evidence_store_rejected", "record exists");
      writes.push({ name, value });
      return put(name, value);
    },
    verifyGitBinding: () => ({ actualHead: pending.packetHead }),
    collectPacketMaterialHashes: async () => ({}),
    loadAndValidateProcessAuthority: async () => postrunAuthority,
    readBoundedPrivateJson: async () => ({ value: relay, sha256: relaySha256 }),
    now: () => nowMs,
    sleep: async () => {},
    collectCrashContext: async () => ({ reports: [] }),
  };
  return { args, dependencies, records, writes };
}

test("no-launch finalizer rejects stale, future, and overlong chains before publication", async () => {
  const nowMs = Date.parse("2026-07-14T16:00:00.000Z");
  const cases = [
    validPendingDisposition({ pendingAtMs: nowMs - CONTRACT.runtimePendingMaxAgeMs - 1 }),
    validPendingDisposition({ pendingAtMs: nowMs + CONTRACT.runtimeFutureSkewMs + 1 }),
    validPendingDisposition({
      pendingAtMs: nowMs - 1_000,
      runtimeDurationMs: CONTRACT.runtimeMaxDurationMs + 1,
    }),
  ];
  for (const pending of cases) {
    const fixture = createNoLaunchFinalizerFixture(pending, nowMs);
    await assert.rejects(
      finalizeMode(fixture.args, fixture.dependencies),
      (error) => error instanceof PermitError && error.issueCode === "runtime_pending_rejected",
    );
    assert.equal(fixture.writes.length, 0);
  }
});

test("no-launch finalizer rejects a chain whose fixed crash settle exhausts freshness", async () => {
  const pendingAtMs = Date.parse("2026-07-14T16:00:00.000Z");
  const validationNowMs = pendingAtMs + 27_999;
  const settledNowMs = pendingAtMs + CONTRACT.runtimePendingMaxAgeMs + 1;
  const pending = validPendingDisposition({ pendingAtMs });
  const fixture = createNoLaunchFinalizerFixture(pending, validationNowMs);
  const times = [validationNowMs, settledNowMs];
  fixture.dependencies.now = () => times.shift();
  await assert.rejects(
    finalizeMode(fixture.args, fixture.dependencies),
    (error) => error instanceof PermitError
      && error.issueCode === "runtime_pending_expired_during_crash_settle",
  );
  assert.equal(fixture.writes.length, 0);
});

test("no-launch finalizer accepts fresh and exact-age/duration boundary chains only once", async () => {
  const nowMs = Date.parse("2026-07-14T16:00:00.000Z");
  for (const pending of [
    validPendingDisposition({ pendingAtMs: nowMs - 1_000 }),
    validPendingDisposition({ pendingAtMs: nowMs - CONTRACT.runtimePendingMaxAgeMs }),
    validPendingDisposition({
      pendingAtMs: nowMs - 1_000,
      runtimeDurationMs: CONTRACT.runtimeMaxDurationMs,
    }),
  ]) {
    const fixture = createNoLaunchFinalizerFixture(pending, nowMs);
    const result = await finalizeMode(fixture.args, fixture.dependencies);
    assert.equal(result.status, "pass");
    assert.equal(fixture.writes.length, 1);
    assert.equal(fixture.writes[0].name, "disposition.json");
    assert.equal(fixture.writes[0].value.launchAttemptsPerformed, 1);
    assert.equal(fixture.writes[0].value.userDataBound, true);
    assert.equal(fixture.writes[0].value.windowsCreated, 0);
  }
});

test("no-launch finalizer fixture reaches PASS only from validated private pending bytes", async () => {
  const nowMs = Date.parse("2026-07-14T16:00:00.000Z");
  const fixture = createNoLaunchFinalizerFixture(
    validPendingDisposition({ pendingAtMs: nowMs - 1_000 }),
    nowMs,
  );
  const result = await finalizeMode(fixture.args, fixture.dependencies);
  assert.equal(result.status, "pass");
  assert.equal(fixture.writes.length, 1);
  await assert.rejects(
    finalizeMode(fixture.args, fixture.dependencies),
    (error) => error instanceof PermitError && error.issueCode === "evidence_store_rejected",
  );
});

test("crash context binds only top-level July 14 Electron reports", async () => {
  await withTemporaryRoot(async (root) => {
    const header = {
      app_name: "Electron",
      timestamp: "2026-07-14 12:00:00.00 +0800",
      app_version: "42.4.1",
      bundleID: "com.github.Electron",
      incident_id: "fixture-incident",
    };
    const body = {
      coalitionName: "com.openai.codex",
      exception: { signal: "SIGABRT" },
      termination: { indicator: "Abort trap: 6" },
      threads: [{
        triggered: true,
        frames: [
          { symbol: "_RegisterApplication" },
          { symbol: "-[NSApplication init]" },
          { symbol: "+[NSApplication sharedApplication]" },
        ],
      }],
    };
    await writeFile(
      path.join(root, "Electron-2026-07-14-120000.ips"),
      `${JSON.stringify(header)}\n${JSON.stringify(body)}\n`,
    );
    await writeFile(path.join(root, "Electron-2026-07-13-120000.ips"), "ignored");
    const context = await collectCrashContext(root);
    assert.equal(context.reportCount, 1);
    assert.equal(context.allSigabrt, true);
    assert.equal(context.allCodexCoalition, true);
    assert.equal(context.allRegisterApplicationStack, true);
    assert.equal(context.reports[0].basename, "Electron-2026-07-14-120000.ips");
  });
});

test("bootstrap helper remains product-independent and uses normal app quit", async () => {
  const source = await readFile(new URL("./electron-bootstrap.cjs", import.meta.url), "utf8");
  assert.match(source, /require\("electron"\)/);
  assert.match(source, /app\.quit\(\)/);
  assert.doesNotMatch(source, /aeb-native-preview|generated SVGA|Auto SVGA|After Effects/);
  assert.doesNotMatch(source, /process\.kill|SIGTERM|SIGKILL|forceQuit/);
});
