import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs from "node:fs";
import { mkdir, mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";

import {
  canonicalD001LifecycleBytes,
  parseD001Lifecycle,
} from "./run-registered-fixture-product-proof-orchestrator.mjs";
import {
  ENTRY_CONTRACT,
  buildFixtureRequestMaterial,
  canonicalJsonBytes,
  inspectRuntimeEntry,
  main,
  materializeFixtureRequest,
  parseArgs,
  prepareRuntimeEntry,
  retireAmbiguousRequestPublication,
  validateEntryInput,
  validateRequestInput,
} from "./aeb-registered-fixture-runtime-entry.mjs";
import { canonicalPackageTreeDigest } from "./aeb-ae-package-handoff.cjs";

const NOW = Date.parse("2026-07-16T08:00:00.000Z");
const SOURCE_HEAD = ENTRY_CONTRACT.packetBaseHead;
const REQUEST_ID = "aeb-semantic-runtime-entry-test-001";
const D001_EXECUTION_ID = "aeb-d001-runtime-entry-test-001";
const PRODUCT_EXECUTION_ID = "aeb-fixture-runtime-entry-test-001";
const TASK_ROOT = "/private/tmp/auto-svga-aeb-d001-8594bcfa";
const DEV_ROOT = "/private/tmp/auto-svga-aeb-dev";
const FIXTURE_SHA = "b7970b1a9c9a313e9b9f912411dacfe61d6e196c102918f4c77f49883da06936";

function requestInput(overrides = {}) {
  return {
    schema: ENTRY_CONTRACT.requestSchema,
    permitId: "ASV-APR-20260716-999",
    requestCreatedAtEpochMs: NOW,
    requestExpiresAtEpochMs: NOW + ENTRY_CONTRACT.requestLifetimeMs,
    requestId: REQUEST_ID,
    sourceHead: SOURCE_HEAD,
    sourcePackageRoot: path.join(DEV_ROOT, REQUEST_ID, "ae-export-package"),
    ...overrides,
  };
}

function entryInput(overrides = {}) {
  const requestOverrides = {};
  for (const key of [
    "permitId",
    "requestCreatedAtEpochMs",
    "requestExpiresAtEpochMs",
    "requestId",
    "sourceHead",
    "sourcePackageRoot",
  ]) {
    if (Object.prototype.hasOwnProperty.call(overrides, key)) requestOverrides[key] = overrides[key];
  }
  const request = requestInput(requestOverrides);
  const requestSha256 = buildFixtureRequestMaterial(request).requestSha256;
  return {
    schema: ENTRY_CONTRACT.entrySchema,
    permitId: request.permitId,
    executionId: PRODUCT_EXECUTION_ID,
    d001ExecutionId: D001_EXECUTION_ID,
    sourceHead: request.sourceHead,
    requestId: request.requestId,
    requestCreatedAtEpochMs: request.requestCreatedAtEpochMs,
    requestExpiresAtEpochMs: request.requestExpiresAtEpochMs,
    requestSha256,
    requestPublicationPath: path.join(DEV_ROOT, "semantic-inbox-ae26", `publication-${request.requestId}.json`),
    requestPublicationSha256: "6".repeat(64),
    sourcePackageRoot: request.sourcePackageRoot,
    packageRoot: path.join(TASK_ROOT, "aeb-fixture-package-test-999"),
    outputRoot: path.join(TASK_ROOT, "aeb-fixture-product-test-999"),
    d001OutputRoot: path.join(TASK_ROOT, "aeb-d001-test-999"),
    preflightRelayPath: path.join(TASK_ROOT, `${D001_EXECUTION_ID}-preflight-relay.json`),
    preflightRelaySha256: "1".repeat(64),
    prelaunchAuthorityPath: path.join(
      TASK_ROOT,
      "process-authority",
      D001_EXECUTION_ID,
      "prelaunch-authority.json",
    ),
    prelaunchAuthoritySha256: "2".repeat(64),
    ...overrides,
  };
}

function sourceDependencies(overrides = {}) {
  return {
    now: () => NOW + 1_000,
    verifyGitBinding: (head) => ({
      actualHead: head,
      actualBranch: ENTRY_CONTRACT.sourceBranch,
      trackedStatusEmpty: true,
      sourceAncestor: true,
      packetHead: head,
    }),
    verifyPacketBaseAncestry: () => true,
    ...overrides,
  };
}

function packageSnapshot(overrides = {}) {
  const entries = overrides.entries ?? [
    { relative: "ae-export-package.finalized.json", sizeBytes: 512, sha256: "3".repeat(64) },
    { relative: "ae-export-package.json", sizeBytes: 480, sha256: "4".repeat(64) },
    { relative: "assets/layer-0001.png", sizeBytes: 811, sha256: FIXTURE_SHA },
  ];
  return {
    entries,
    fileCount: entries.length,
    totalBytes: entries.reduce((sum, entry) => sum + entry.sizeBytes, 0),
    sha256: canonicalPackageTreeDigest(entries),
    ...Object.fromEntries(Object.entries(overrides).filter(([key]) => key !== "entries")),
  };
}

function preparationDependencies(snapshot = packageSnapshot(), overrides = {}) {
  let snapshotCalls = 0;
  return sourceDependencies({
    assertFreshOutputPaths: () => true,
    validateRequestPublicationAuthority: (input) => ({
      schema: ENTRY_CONTRACT.requestPublicationSchema,
      publicationPath: input.requestPublicationPath,
      publicationSha256: input.requestPublicationSha256,
      requestSha256: input.requestSha256,
    }),
    readBoundedRegularFile: (filePath) => ({
      sha256: filePath.endsWith("prelaunch-authority.json") ? "2".repeat(64) : "1".repeat(64),
      sizeBytes: 128,
    }),
    snapshotAePackageTree: () => {
      snapshotCalls += 1;
      return snapshot;
    },
    prepareAePackageHandoff: (input) => ({
      schema: "auto-svga-aeb-ae-package-handoff-v1",
      packageSha256: input.expectedPackageSha256,
      sourceBeforeSha256: input.expectedTreeSha256,
      sourceAfterSha256: input.expectedTreeSha256,
      targetSha256: input.expectedTreeSha256,
      fileCount: input.expectedFileCount,
      totalBytes: input.expectedTotalBytes,
      manifestPath: `${input.targetPackageRoot}.handoff-manifest.json`,
      manifestSha256: "5".repeat(64),
    }),
    snapshotCalls: () => snapshotCalls,
    ...overrides,
  });
}

test("failure-first: current source provides one canonical fixture request and runtime-entry producer", () => {
  const first = buildFixtureRequestMaterial(requestInput());
  const second = buildFixtureRequestMaterial(requestInput());
  assert.deepEqual(first, second);
  assert.equal(first.fixtureSha256, FIXTURE_SHA);
  assert.equal(first.fixtureBytes, 811);
  assert.equal(first.request.schemaVersion, "aeb-panel-semantic-request-v1");
  assert.equal(first.request.action, "prepare-task-owned-fixture-and-export-native-subset-metadata");
  assert.equal(first.request.targetHost.appId, "AEFT");
  assert.equal(first.request.targetHost.versionMajor, 26);
  assert.equal(first.request.targetHost.versionMinor, 3);
  assert.equal(first.request.assetFixture.assetId, "asset-task-fixture-0001");
  assert.equal(first.request.assetFixture.layerId, "layer-task-fixture-0001");
  assert.equal(first.request.assetFixture.width, 120);
  assert.equal(first.request.assetFixture.height, 80);
  assert.equal(first.request.permitId, first.permitId);
  assert.equal(first.request.sourceHead, first.sourceHead);
  assert.notEqual(
    buildFixtureRequestMaterial(requestInput({ permitId: "ASV-APR-20260716-998" })).requestSha256,
    first.requestSha256,
  );
  assert.notEqual(
    buildFixtureRequestMaterial(requestInput({ sourceHead: "b".repeat(40) })).requestSha256,
    first.requestSha256,
  );
  assert.equal(Object.hasOwn(first, "status"), false);
  assert.equal(Object.hasOwn(first, "pass"), false);
});

test("request and entry inputs reject proxy, accessor, coercion, missing, extra, and stale identity shapes", () => {
  assert.throws(() => validateRequestInput(new Proxy(requestInput(), {})), {
    code: "registered_fixture_runtime_entry_request_record_invalid",
  });
  let getterExecuted = false;
  const accessor = requestInput();
  Object.defineProperty(accessor, "sourceHead", {
    enumerable: true,
    get() {
      getterExecuted = true;
      return SOURCE_HEAD;
    },
  });
  assert.throws(() => validateRequestInput(accessor), {
    code: "registered_fixture_runtime_entry_request_accessor_invalid",
  });
  assert.equal(getterExecuted, false);
  assert.throws(() => validateRequestInput({ ...requestInput(), privatePath: "/Users/private" }), {
    code: "registered_fixture_runtime_entry_request_fields_invalid",
  });
  assert.throws(() => validateRequestInput({ ...requestInput(), permitId: new String("ASV-APR-20260716-999") }));
  let coercionExecuted = false;
  assert.throws(() => validateRequestInput({
    ...requestInput(),
    requestId: { toString() { coercionExecuted = true; return REQUEST_ID; } },
  }));
  assert.equal(coercionExecuted, false);
  assert.throws(() => validateEntryInput(new Proxy(entryInput(), {})), {
    code: "registered_fixture_runtime_entry_record_invalid",
  });
  assert.throws(() => validateEntryInput({ ...entryInput(), requestSha256: "f".repeat(64) }), {
    code: "registered_fixture_runtime_entry_request_hash_mismatch",
  });
});

test("request and entry path, lifetime, permit, and derived authority joins fail closed", () => {
  const badRequests = [
    { requestExpiresAtEpochMs: NOW + ENTRY_CONTRACT.requestLifetimeMs + 1 },
    { requestId: "../escape" },
    { sourcePackageRoot: "/private/tmp/outside/ae-export-package" },
    { sourcePackageRoot: path.join(DEV_ROOT, "different-request", "ae-export-package") },
    { sourceHead: "z".repeat(40) },
  ];
  for (const mutation of badRequests) assert.throws(() => validateRequestInput(requestInput(mutation)));

  const badEntries = [
    { packageRoot: path.join(TASK_ROOT, "nested", "package") },
    { outputRoot: "/private/tmp/outside" },
    { d001OutputRoot: path.join(TASK_ROOT, "aeb-fixture-product-test-999") },
    { preflightRelayPath: path.join(TASK_ROOT, "wrong-relay.json") },
    { prelaunchAuthorityPath: path.join(TASK_ROOT, "process-authority", "wrong", "prelaunch-authority.json") },
    { preflightRelaySha256: "not-a-sha" },
    { prelaunchAuthoritySha256: "not-a-sha" },
    { requestPublicationPath: path.join(DEV_ROOT, "semantic-inbox-ae26", "wrong-publication.json") },
    { requestPublicationSha256: "not-a-sha" },
    { executionId: "UPPERCASE-NOT-VALID" },
  ];
  for (const mutation of badEntries) assert.throws(() => validateEntryInput(entryInput(mutation)));
});

test("inspect output is deterministic, non-authorizing, and marks a descendant head for packet rebind", () => {
  const baseline = inspectRuntimeEntry(entryInput(), sourceDependencies());
  assert.equal(baseline.schema, ENTRY_CONTRACT.inspectSchema);
  assert.equal(baseline.packetBaseHead, SOURCE_HEAD);
  assert.equal(baseline.packetHead, SOURCE_HEAD);
  assert.equal(baseline.packetRebindRequired, false);
  assert.equal(baseline.preparationRequired, true);
  assert.equal(baseline.launchAuthorized, false);
  assert.deepEqual(baseline.productOracle.ownerCompatibility, {
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
  assert.equal(baseline.productOracle.packageHandoff.schema, "auto-svga-aeb-ae-package-handoff-v1");
  assert.equal(baseline.productOracle.packageHandoff.sourcePackageRoot, baseline.request.sourcePackageRoot);
  assert.equal(baseline.productOracle.packageHandoff.packageRoot, baseline.runtimeInputs.packageRoot);
  assert.equal(baseline.productOracle.packageHandoff.requestPublicationSha256, baseline.request.requestPublicationSha256);
  assert.equal(baseline.productOracle.packageHandoff.targetSnapshotVerificationRequired, true);
  assert.deepEqual(baseline, inspectRuntimeEntry(entryInput(), sourceDependencies()));

  const successor = "a".repeat(40);
  const changed = inspectRuntimeEntry(entryInput({ sourceHead: successor }), sourceDependencies());
  assert.equal(changed.packetHead, successor);
  assert.equal(changed.packetRebindRequired, true);
});

test("fixture request materialization is no-overwrite, identity-pinned, and cleans its owned partial output", async () => {
  const createdRoot = await mkdtemp(path.join(os.tmpdir(), "aeb-runtime-entry-request-"));
  const root = fs.realpathSync(createdRoot);
  try {
    const devRoot = path.join(root, "auto-svga-aeb-dev");
    const taskRoot = path.join(root, "auto-svga-aeb-d001-test");
    const processAuthorityBaseRoot = path.join(taskRoot, "process-authority");
    const inboxRoot = path.join(devRoot, "semantic-inbox-ae26");
    await mkdir(devRoot, { recursive: true, mode: 0o700 });
    await mkdir(taskRoot, { recursive: true, mode: 0o700 });
    const input = requestInput({
      requestId: "aeb-semantic-materialize-test-001",
      sourcePackageRoot: path.join(devRoot, "aeb-semantic-materialize-test-001", "ae-export-package"),
    });
    const dependencies = sourceDependencies({
      allowTestRoots: true,
      devRoot,
      taskRoot,
      processAuthorityBaseRoot,
      inboxRoot,
    });
    const result = materializeFixtureRequest(input, dependencies);
    assert.equal(result.schema, ENTRY_CONTRACT.requestPublicationResultSchema);
    assert.equal(result.mutationPerformed, true);
    const fixturePath = path.join(input.sourcePackageRoot, "assets", "layer-0001.png");
    assert.equal(sha256(await readFile(fixturePath)), FIXTURE_SHA);
    const requestPath = path.join(inboxRoot, "request.json");
    const request = JSON.parse(await readFile(requestPath, "utf8"));
    assert.equal(request.requestId, input.requestId);
    assert.equal(request.permitId, input.permitId);
    assert.equal(request.sourceHead, input.sourceHead);
    assert.equal(request.outputRoot, input.sourcePackageRoot);
    assert.equal(result.requestPath, requestPath);
    assert.equal(result.requestPublicationPath, path.join(inboxRoot, `publication-${input.requestId}.json`));
    assert.match(result.requestPublicationSha256, /^[a-f0-9]{64}$/u);
    assert.equal(result.requestPublication.schema, ENTRY_CONTRACT.requestPublicationSchema);
    assert.equal(result.requestPublication.files.request.sha256, result.requestSha256);
    assert.equal(result.requestPublication.files.fixture.sha256, FIXTURE_SHA);
    assert.equal(result.requestPublication.directories.runRoot.path, path.dirname(input.sourcePackageRoot));
    assert.equal(fs.lstatSync(fixturePath).nlink, 1);
    assert.equal(fs.lstatSync(requestPath).nlink, 1);
    assert.equal(fs.lstatSync(result.requestPublicationPath).nlink, 1);
    assert.throws(() => materializeFixtureRequest(input, dependencies), {
      code: "registered_fixture_runtime_entry_replay_or_stale_path",
    });

    await rm(requestPath);
    const blockedInput = requestInput({
      requestId: "aeb-semantic-materialize-test-ambiguous",
      sourcePackageRoot: path.join(devRoot, "aeb-semantic-materialize-test-ambiguous", "ae-export-package"),
    });
    assert.throws(() => materializeFixtureRequest(blockedInput, dependencies), {
      code: "registered_fixture_runtime_entry_publication_unconsumed_ambiguous",
    });
    assert.equal(fs.existsSync(path.dirname(blockedInput.sourcePackageRoot)), false);

    const retired = retireAmbiguousRequestPublication({
      schema: ENTRY_CONTRACT.requestRetireInputSchema,
      permitId: input.permitId,
      requestId: input.requestId,
      sourceHead: input.sourceHead,
      requestPublicationPath: result.requestPublicationPath,
      requestPublicationSha256: result.requestPublicationSha256,
      reasonCode: "ae_host_crash_or_request_marker_lost",
      recordedAtEpochMs: input.requestCreatedAtEpochMs + 1,
    }, dependencies);
    assert.equal(retired.mutationPerformed, true);
    assert.equal(fs.existsSync(path.join(inboxRoot, `retired-${input.requestId}.json`)), true);
    const retiredReplay = retireAmbiguousRequestPublication({
      schema: ENTRY_CONTRACT.requestRetireInputSchema,
      permitId: input.permitId,
      requestId: input.requestId,
      sourceHead: input.sourceHead,
      requestPublicationPath: result.requestPublicationPath,
      requestPublicationSha256: result.requestPublicationSha256,
      reasonCode: "ae_host_crash_or_request_marker_lost",
      recordedAtEpochMs: input.requestCreatedAtEpochMs + 1,
    }, dependencies);
    assert.equal(retiredReplay.mutationPerformed, false);

    const unblocked = materializeFixtureRequest(blockedInput, dependencies);
    assert.equal(unblocked.requestId, blockedInput.requestId);
    const unblockedRequest = JSON.parse(await readFile(requestPath, "utf8"));
    fs.writeFileSync(path.join(blockedInput.sourcePackageRoot, "ae-export-package.finalized.json"), "{}\n", { mode: 0o600 });
    fs.writeFileSync(requestPath, canonicalJsonBytes(unblockedRequest), { mode: 0o600 });
    fs.renameSync(requestPath, path.join(inboxRoot, `consumed-${blockedInput.requestId}.json`));

    const failedInput = requestInput({
      requestId: "aeb-semantic-materialize-test-002",
      sourcePackageRoot: path.join(devRoot, "aeb-semantic-materialize-test-002", "ae-export-package"),
    });
    assert.throws(() => materializeFixtureRequest(failedInput, {
      ...dependencies,
      afterFixtureWrite() {
        throw Object.assign(new Error("injected publication failure"), { code: "injected_publication_failure" });
      },
    }), { code: "injected_publication_failure" });
    assert.equal(fs.existsSync(path.dirname(failedInput.sourcePackageRoot)), false);
    assert.equal(fs.existsSync(requestPath), false);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("fixture request materialization rejects non-private dev or inbox authority before publication", async () => {
  const createdRoot = await mkdtemp(path.join(os.tmpdir(), "aeb-runtime-entry-mode-"));
  const root = fs.realpathSync(createdRoot);
  try {
    const devRoot = path.join(root, "auto-svga-aeb-dev");
    const taskRoot = path.join(root, "auto-svga-aeb-d001-test");
    const processAuthorityBaseRoot = path.join(taskRoot, "process-authority");
    const inboxRoot = path.join(devRoot, "semantic-inbox-ae26");
    await mkdir(devRoot, { recursive: true, mode: 0o700 });
    await mkdir(taskRoot, { recursive: true, mode: 0o700 });
    const input = requestInput({
      requestId: "aeb-semantic-mode-test-001",
      sourcePackageRoot: path.join(devRoot, "aeb-semantic-mode-test-001", "ae-export-package"),
    });
    const dependencies = sourceDependencies({
      allowTestRoots: true,
      devRoot,
      taskRoot,
      processAuthorityBaseRoot,
      inboxRoot,
    });

    fs.chmodSync(devRoot, 0o777);
    assert.throws(() => materializeFixtureRequest(input, dependencies), {
      code: "registered_fixture_runtime_entry_dev_root_invalid",
    });
    assert.equal(fs.existsSync(path.dirname(input.sourcePackageRoot)), false);

    fs.chmodSync(devRoot, 0o700);
    await mkdir(inboxRoot, { recursive: true, mode: 0o700 });
    fs.chmodSync(inboxRoot, 0o777);
    assert.throws(() => materializeFixtureRequest(input, dependencies), {
      code: "registered_fixture_runtime_entry_inbox_invalid",
    });
    assert.equal(fs.existsSync(path.dirname(input.sourcePackageRoot)), false);
    assert.equal(fs.existsSync(path.join(inboxRoot, "request.json")), false);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("prepare joins package tree, reviewed handoff, descriptor, lifecycle, and exact orchestrator argv", () => {
  const input = entryInput();
  const snapshot = packageSnapshot();
  let handoffInput;
  const dependencies = preparationDependencies(snapshot, {
    prepareAePackageHandoff(value) {
      handoffInput = value;
      return {
        schema: "auto-svga-aeb-ae-package-handoff-v1",
        packageSha256: value.expectedPackageSha256,
        sourceBeforeSha256: value.expectedTreeSha256,
        sourceAfterSha256: value.expectedTreeSha256,
        targetSha256: value.expectedTreeSha256,
        fileCount: value.expectedFileCount,
        totalBytes: value.expectedTotalBytes,
        manifestPath: `${value.targetPackageRoot}.handoff-manifest.json`,
        manifestSha256: "5".repeat(64),
      };
    },
  });
  const prepared = prepareRuntimeEntry(input, dependencies);
  assert.equal(prepared.schema, ENTRY_CONTRACT.preparedSchema);
  assert.equal(prepared.packetHead, SOURCE_HEAD);
  assert.equal(prepared.d001SourceHead, ENTRY_CONTRACT.d001SourceHead);
  assert.equal(prepared.package.packageSha256, "3".repeat(64));
  assert.equal(prepared.package.packageTreeSha256, snapshot.sha256);
  assert.equal(prepared.package.packageTreeFileCount, 3);
  assert.equal(prepared.package.handoffManifestSha256, "5".repeat(64));
  assert.deepEqual(prepared.productOracle.ownerCompatibility, {
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
  assert.deepEqual(prepared.productOracle.packageHandoff, {
    schema: "auto-svga-aeb-ae-package-handoff-v1",
    packageSha256: "3".repeat(64),
    packageTreeSha256: snapshot.sha256,
    packageTreeFileCount: snapshot.fileCount,
    packageTreeTotalBytes: snapshot.totalBytes,
    handoffManifestSha256: "5".repeat(64),
    requestPublicationSha256: input.requestPublicationSha256,
    descriptorTreeAuthorityRequired: true,
    targetSnapshotVerified: true,
  });
  assert.deepEqual(prepared.productOracle.generatedSvga, {
    sha256: "b65e06e931c30543c85d4fa030fddbee4b74f77f8f4315ff734e118851077fea",
    sizeBytes: 831,
  });
  assert.equal(
    prepared.descriptor.value.expectedGeneratedSvgaSha256,
    prepared.productOracle.generatedSvga.sha256,
  );
  assert.equal(
    prepared.descriptor.value.expectedGeneratedSvgaBytes,
    prepared.productOracle.generatedSvga.sizeBytes,
  );
  assert.equal(handoffInput.expectedTreeSha256, snapshot.sha256);
  assert.equal(handoffInput.expectedPackageSha256, "3".repeat(64));
  assert.equal(prepared.descriptor.value.sourceHead, SOURCE_HEAD);
  assert.equal(prepared.descriptor.value.requestId, input.requestId);
  assert.equal(prepared.descriptor.value.requestSha256, input.requestSha256);
  assert.equal(prepared.request.requestPublicationSha256, input.requestPublicationSha256);
  assert.equal(prepared.descriptor.value.d001PacketHead, SOURCE_HEAD);
  assert.equal(prepared.descriptor.value.d001SourceHead, ENTRY_CONTRACT.d001SourceHead);
  assert.equal(prepared.descriptor.value.packageTreeSha256, snapshot.sha256);
  assert.deepEqual(
    parseD001Lifecycle({ ...prepared.d001Lifecycle.value }, prepared.descriptor.value),
    prepared.d001Lifecycle.value,
  );
  assert.deepEqual(
    Buffer.from(prepared.d001Lifecycle.base64url, "base64url"),
    canonicalD001LifecycleBytes(prepared.d001Lifecycle.value),
  );
  assert.deepEqual(
    Buffer.from(prepared.descriptor.base64url, "base64url"),
    canonicalJsonBytes(prepared.descriptor.value),
  );
  assert.equal(prepared.command.executable, process.execPath);
  assert.equal(prepared.command.argv[0].endsWith("run-registered-fixture-product-proof-orchestrator.mjs"), true);
  assert.deepEqual(prepared.command.argv.slice(1, 4), ["--mode", "execute", "--descriptor-base64"]);
  assert.equal(prepared.launchAuthorized, false);
  assert.equal(dependencies.snapshotCalls(), 2);
});

test("prepare rejects stale/replayed identity, material hashes, missing package authority, and handoff drift before command authority", () => {
  const input = entryInput();
  assert.throws(() => prepareRuntimeEntry(input, preparationDependencies(packageSnapshot(), {
    now: () => NOW + ENTRY_CONTRACT.requestLifetimeMs,
  })), { code: "registered_fixture_runtime_entry_request_stale" });
  const staleConsumed = prepareRuntimeEntry(input, preparationDependencies(packageSnapshot(), {
    now: () => NOW + ENTRY_CONTRACT.requestLifetimeMs,
    validateRequestPublicationAuthority: (value) => ({
      schema: ENTRY_CONTRACT.requestPublicationSchema,
      publicationPath: value.requestPublicationPath,
      publicationSha256: value.requestPublicationSha256,
      requestSha256: value.requestSha256,
      requestConsumed: true,
    }),
  }));
  assert.equal(staleConsumed.request.requestPublicationSha256, input.requestPublicationSha256);
  assert.throws(() => prepareRuntimeEntry(input, preparationDependencies(packageSnapshot(), {
    assertFreshOutputPaths() {
      throw Object.assign(new Error("stale"), { code: "registered_fixture_runtime_entry_destination_exists" });
    },
  })), { code: "registered_fixture_runtime_entry_destination_exists" });
  assert.throws(() => prepareRuntimeEntry(input, preparationDependencies(packageSnapshot(), {
    readBoundedRegularFile: () => ({ sha256: "f".repeat(64), sizeBytes: 128 }),
  })), { code: "registered_fixture_runtime_entry_preflight_relay_hash_mismatch" });

  const missingFixture = packageSnapshot({
    entries: [
      { relative: "ae-export-package.finalized.json", sizeBytes: 512, sha256: "3".repeat(64) },
      { relative: "ae-export-package.json", sizeBytes: 480, sha256: "4".repeat(64) },
    ],
  });
  assert.throws(() => prepareRuntimeEntry(input, preparationDependencies(missingFixture)), {
    code: "registered_fixture_runtime_entry_package_material_invalid",
  });

  const wrongFixture = packageSnapshot({
    entries: [
      { relative: "ae-export-package.finalized.json", sizeBytes: 512, sha256: "3".repeat(64) },
      { relative: "assets/layer-0001.png", sizeBytes: 811, sha256: "0".repeat(64) },
    ],
  });
  assert.throws(() => prepareRuntimeEntry(input, preparationDependencies(wrongFixture)), {
    code: "registered_fixture_runtime_entry_package_material_invalid",
  });

  assert.throws(() => prepareRuntimeEntry(input, preparationDependencies(packageSnapshot(), {
    prepareAePackageHandoff: (value) => ({
      schema: "auto-svga-aeb-ae-package-handoff-v1",
      packageSha256: value.expectedPackageSha256,
      sourceBeforeSha256: value.expectedTreeSha256,
      sourceAfterSha256: "9".repeat(64),
      targetSha256: value.expectedTreeSha256,
      fileCount: value.expectedFileCount,
      totalBytes: value.expectedTotalBytes,
      manifestSha256: "5".repeat(64),
    }),
  })), { code: "registered_fixture_runtime_entry_handoff_result_invalid" });

  const replacedTargetSnapshot = {
    ...packageSnapshot(),
    sha256: "8".repeat(64),
  };
  let snapshotRead = 0;
  assert.throws(() => prepareRuntimeEntry(input, preparationDependencies(packageSnapshot(), {
    snapshotAePackageTree: () => {
      snapshotRead += 1;
      return snapshotRead === 1 ? packageSnapshot() : replacedTargetSnapshot;
    },
  })), { code: "registered_fixture_runtime_entry_handoff_target_mismatch" });

  let gitChecks = 0;
  assert.throws(() => prepareRuntimeEntry(input, preparationDependencies(packageSnapshot(), {
    verifyGitBinding: (head) => {
      gitChecks += 1;
      return {
        actualHead: gitChecks === 1 ? head : "f".repeat(40),
        actualBranch: ENTRY_CONTRACT.sourceBranch,
        trackedStatusEmpty: true,
      };
    },
  })), { code: "registered_fixture_runtime_entry_git_binding_invalid" });
  assert.equal(gitChecks, 2);
});

test("prepare reopens persisted request and rejects request relabel or directory replacement", async () => {
  const createdRoot = await mkdtemp(path.join(os.tmpdir(), "aeb-runtime-entry-authority-"));
  const root = fs.realpathSync(createdRoot);
  try {
    const devRoot = path.join(root, "auto-svga-aeb-dev");
    const taskRoot = path.join(root, "auto-svga-aeb-d001-test");
    const processAuthorityBaseRoot = path.join(taskRoot, "process-authority");
    const inboxRoot = path.join(devRoot, "semantic-inbox-ae26");
    await mkdir(devRoot, { recursive: true, mode: 0o700 });
    await mkdir(taskRoot, { recursive: true, mode: 0o700 });

    const input = requestInput({
      requestId: "aeb-semantic-authority-test-001",
      sourcePackageRoot: path.join(devRoot, "aeb-semantic-authority-test-001", "ae-export-package"),
    });
    const dependencies = sourceDependencies({
      allowTestRoots: true,
      devRoot,
      taskRoot,
      processAuthorityBaseRoot,
      inboxRoot,
    });
    const requestPath = path.join(inboxRoot, "request.json");
    let openRequest = null;
    const closeOpenRequest = () => {
      if (!openRequest) return;
      if (fs.existsSync(requestPath)) {
        const finalizedPath = path.join(openRequest.sourcePackageRoot, "ae-export-package.finalized.json");
        if (!fs.existsSync(finalizedPath)) writeFinalizedPackage(openRequest.sourcePackageRoot);
        fs.renameSync(requestPath, path.join(inboxRoot, `consumed-${openRequest.requestId}.json`));
      }
      openRequest = null;
    };
    const discardPublication = (result) => {
      fs.rmSync(result.publication.requestPublicationPath, { force: true });
      fs.rmSync(path.join(inboxRoot, `consumed-${result.request.requestId}.json`), { force: true });
      fs.rmSync(path.join(inboxRoot, `consumed-failed-${result.request.requestId}.json`), { force: true });
      if (openRequest?.requestId === result.request.requestId) fs.rmSync(requestPath, { force: true });
      fs.rmSync(path.dirname(result.request.sourcePackageRoot), { recursive: true, force: true });
      if (openRequest?.requestId === result.request.requestId) openRequest = null;
    };
    const materialize = (requestId) => {
      closeOpenRequest();
      const request = requestInput({
        requestId,
        sourcePackageRoot: path.join(devRoot, requestId, "ae-export-package"),
      });
      const publication = materializeFixtureRequest(request, dependencies);
      writeFinalizedPackage(request.sourcePackageRoot);
      openRequest = request;
      const entry = writeRuntimeEntryMaterial({
        taskRoot,
        processAuthorityBaseRoot,
        request,
        publication,
      });
      return { request, publication, entry };
    };

    const positive = materialize("aeb-semantic-authority-test-001");
    assert.equal(positive.entry.requestSha256, positive.publication.requestSha256);
    assert.equal(positive.entry.requestPublicationSha256, positive.publication.requestPublicationSha256);
    assert.equal(fs.existsSync(positive.publication.requestPublicationPath), true);

    const consumed = materialize("aeb-semantic-authority-test-008");
    fs.renameSync(requestPath, path.join(inboxRoot, `consumed-${consumed.request.requestId}.json`));
    openRequest = null;
    assert.throws(() => prepareRuntimeEntry(consumed.entry, dependencies), {
      code: "registered_fixture_source_package_root_out_of_root",
    });

    const forgedConsumed = materialize("aeb-semantic-authority-test-009");
    fs.copyFileSync(requestPath, path.join(inboxRoot, `consumed-${forgedConsumed.request.requestId}.json`));
    await rm(requestPath);
    openRequest = null;
    assert.throws(() => prepareRuntimeEntry(forgedConsumed.entry, dependencies), {
      code: "registered_fixture_runtime_entry_request_publication_mismatch",
    });

    const missingRequest = materialize("aeb-semantic-authority-test-002");
    await rm(requestPath);
    openRequest = null;
    assert.throws(() => prepareRuntimeEntry(missingRequest.entry, dependencies), {
      code: "registered_fixture_runtime_entry_request_publication_mismatch",
    });
    discardPublication(missingRequest);

    const original = materialize("aeb-semantic-authority-test-003");
    const relabeledRequest = requestInput({
      requestId: "aeb-semantic-authority-test-004",
      sourcePackageRoot: path.join(devRoot, "aeb-semantic-authority-test-004", "ae-export-package"),
    });
    const relabeledPublicationPath = path.join(inboxRoot, `publication-${relabeledRequest.requestId}.json`);
    fs.copyFileSync(original.publication.requestPublicationPath, relabeledPublicationPath);
    const relabeledEntry = writeRuntimeEntryMaterial({
      taskRoot,
      processAuthorityBaseRoot,
      request: relabeledRequest,
      publication: {
        ...original.publication,
        requestSha256: buildFixtureRequestMaterial(relabeledRequest, {
          allowTestRoots: true,
          devRoot,
          taskRoot,
          processAuthorityBaseRoot,
        }).requestSha256,
        requestPublicationPath: relabeledPublicationPath,
        requestPublicationSha256: sha256(fs.readFileSync(relabeledPublicationPath)),
      },
    });
    assert.throws(() => prepareRuntimeEntry(relabeledEntry, dependencies), {
      code: "registered_fixture_runtime_entry_publication_mismatch",
    });
    fs.rmSync(relabeledPublicationPath, { force: true });
    discardPublication(original);

    const noncanonical = materialize("aeb-semantic-authority-test-005");
    const noncanonicalPublication = JSON.parse(fs.readFileSync(noncanonical.publication.requestPublicationPath, "utf8"));
    fs.writeFileSync(noncanonical.publication.requestPublicationPath, JSON.stringify(noncanonicalPublication), { mode: 0o600 });
    assert.throws(() => prepareRuntimeEntry({
      ...noncanonical.entry,
      requestPublicationSha256: sha256(fs.readFileSync(noncanonical.publication.requestPublicationPath)),
    }, dependencies), {
      code: "registered_fixture_runtime_entry_publication_invalid",
    });
    discardPublication(noncanonical);

    const missingIdentity = materialize("aeb-semantic-authority-test-006");
    const missingIdentityPublication = JSON.parse(fs.readFileSync(missingIdentity.publication.requestPublicationPath, "utf8"));
    delete missingIdentityPublication.directories.assetsRoot;
    fs.writeFileSync(missingIdentity.publication.requestPublicationPath, canonicalJsonBytes(missingIdentityPublication), { mode: 0o600 });
    assert.throws(() => prepareRuntimeEntry({
      ...missingIdentity.entry,
      requestPublicationSha256: sha256(fs.readFileSync(missingIdentity.publication.requestPublicationPath)),
    }, dependencies), {
      code: "registered_fixture_runtime_entry_publication_directories_fields_invalid",
    });
    discardPublication(missingIdentity);

    const replaced = materialize("aeb-semantic-authority-test-007");
    const runRoot = path.dirname(replaced.request.sourcePackageRoot);
    const backupRoot = `${runRoot}.old`;
    fs.renameSync(runRoot, backupRoot);
    fs.mkdirSync(path.join(replaced.request.sourcePackageRoot, "assets"), { recursive: true, mode: 0o700 });
    fs.copyFileSync(path.join(backupRoot, "ae-export-package", "assets", "layer-0001.png"), path.join(replaced.request.sourcePackageRoot, "assets", "layer-0001.png"));
    writeFinalizedPackage(replaced.request.sourcePackageRoot);
    assert.throws(() => prepareRuntimeEntry(replaced.entry, dependencies), {
      code: "registered_fixture_runtime_entry_run_root_changed",
    });
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("CLI accepts one canonical input only and never turns inspect into execution authority", () => {
  const input = requestInput();
  const bytes = canonicalJsonBytes(input);
  const hash = sha256(bytes);
  const argv = [
    "--mode", "inspect-request",
    "--input-base64", bytes.toString("base64url"),
    "--input-sha256", hash,
  ];
  assert.deepEqual(Object.keys(parseArgs(argv)), ["mode", "input-base64", "input-sha256"]);
  const result = main(argv, sourceDependencies());
  assert.equal(result.requestSha256, buildFixtureRequestMaterial(input).requestSha256);
  assert.equal(Object.hasOwn(result, "launchAuthorized"), false);
  assert.throws(() => parseArgs([...argv.slice(2), ...argv.slice(0, 2)]), {
    code: "registered_fixture_runtime_entry_arguments_invalid",
  });
  assert.throws(() => parseArgs([...argv, "--private", "value"]), {
    code: "registered_fixture_runtime_entry_arguments_invalid",
  });
  assert.throws(() => main([
    ...argv.slice(0, 5),
    "f".repeat(64),
  ], sourceDependencies()), { code: "registered_fixture_runtime_entry_input_hash_mismatch" });
  const noncanonical = Buffer.from(JSON.stringify(input), "utf8");
  assert.throws(() => main([
    "--mode", "inspect-request",
    "--input-base64", noncanonical.toString("base64url"),
    "--input-sha256", sha256(noncanonical),
  ], sourceDependencies()), { code: "registered_fixture_runtime_entry_input_noncanonical" });
  assert.throws(() => main([
    "--mode", "inspect-request",
    "--input-base64", `${bytes.toString("base64url")}=`,
    "--input-sha256", hash,
  ], sourceDependencies()), { code: "registered_fixture_runtime_entry_input_noncanonical" });
});

function writeFinalizedPackage(sourcePackageRoot) {
  fs.writeFileSync(path.join(sourcePackageRoot, "ae-export-package.finalized.json"), `${JSON.stringify({
    schemaVersion: "auto-svga-aeb-package-v1",
    fixture: "assets/layer-0001.png",
  }, null, 2)}\n`);
}

function writeRuntimeEntryMaterial({ taskRoot, processAuthorityBaseRoot, request, publication }) {
  const suffix = request.requestId.replace(/^aeb-semantic-/u, "");
  const executionId = `aeb-fixture-${suffix}`;
  const d001ExecutionId = `aeb-d001-${suffix}`;
  const relayPath = path.join(taskRoot, `${d001ExecutionId}-preflight-relay.json`);
  const authorityPath = path.join(processAuthorityBaseRoot, d001ExecutionId, "prelaunch-authority.json");
  const relayBytes = Buffer.from(`${JSON.stringify({ schema: "test-relay", requestId: request.requestId })}\n`, "utf8");
  const authorityBytes = Buffer.from(`${JSON.stringify({ schema: "test-authority", requestId: request.requestId })}\n`, "utf8");
  fs.writeFileSync(relayPath, relayBytes, { mode: 0o600 });
  fs.mkdirSync(path.dirname(authorityPath), { recursive: true, mode: 0o700 });
  fs.writeFileSync(authorityPath, authorityBytes, { mode: 0o600 });
  return {
    schema: ENTRY_CONTRACT.entrySchema,
    permitId: request.permitId,
    executionId,
    d001ExecutionId,
    sourceHead: request.sourceHead,
    requestId: request.requestId,
    requestCreatedAtEpochMs: request.requestCreatedAtEpochMs,
    requestExpiresAtEpochMs: request.requestExpiresAtEpochMs,
    requestSha256: publication.requestSha256,
    requestPublicationPath: publication.requestPublicationPath,
    requestPublicationSha256: publication.requestPublicationSha256,
    sourcePackageRoot: request.sourcePackageRoot,
    packageRoot: path.join(taskRoot, `package-${suffix}`),
    outputRoot: path.join(taskRoot, `product-${suffix}`),
    d001OutputRoot: path.join(taskRoot, `d001-${suffix}`),
    preflightRelayPath: relayPath,
    preflightRelaySha256: sha256(relayBytes),
    prelaunchAuthorityPath: authorityPath,
    prelaunchAuthoritySha256: sha256(authorityBytes),
  };
}

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}
