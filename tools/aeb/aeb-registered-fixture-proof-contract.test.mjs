import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs, { link, mkdir, readFile, rm, symlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { createRequire } from "node:module";
import { test } from "node:test";

const require = createRequire(import.meta.url);
const contractModule = require("./aeb-registered-fixture-proof-contract.cjs");
const bootstrapModule = require("./registered-aeb-native-preview-bootstrap.cjs");
const {
  assertEvidenceRecordIdentity,
  assertRuntimeStateResidueAbsent,
  clearRuntimeState,
  createEvidenceStore,
} = require("./registered-fixture-proof-evidence-store.cjs");
const {
  CONTRACT,
  canonicalDescriptorBytes,
  descriptorEnvironment,
  descriptorSha256,
  validateDescriptor,
} = contractModule;

function descriptor(overrides = {}) {
  return {
    schema: CONTRACT.schema,
    permitId: "ASV-APR-20260715-999",
    executionId: "aeb-fixture-landing-test-001",
    sourceHead: "a".repeat(40),
    sourceBranch: "codex/aeb-registered-fixture-product-proof-bridge-repair-20260715",
    requestId: "aeb-semantic-fixture-landing-test-001",
    requestSha256: "9".repeat(64),
    d001PermitId: "ASV-APR-20260715-998",
    d001ExecutionId: "aeb-d001-fixture-entry-test-001",
    d001PacketHead: "a".repeat(40),
    d001SourceHead: "8594bcfa90b6df87eb5b4e2c3ddfcc5133acca01",
    isolatedPanelSourceHead: CONTRACT.isolatedPanelSourceHead,
    fixtureSourceHead: CONTRACT.fixtureSourceHead,
    sourcePackageRoot: path.join(CONTRACT.aeDevRoot, "aeb-semantic-fixture-landing-test-001", "ae-export-package"),
    packageRoot: path.join(CONTRACT.taskRoot, "aeb-fixture-product-package-test-001"),
    outputRoot: path.join(CONTRACT.taskRoot, "aeb-fixture-proof-test-001"),
    packageSha256: "b".repeat(64),
    packageTreeSha256: "4".repeat(64),
    packageTreeFileCount: 2,
    packageTreeTotalBytes: 1024,
    fixtureSha256: CONTRACT.fixtureSha256,
    fixtureBytes: CONTRACT.fixtureBytes,
    panelManifestSha256: CONTRACT.panelMaterialHashes.manifest,
    panelIndexSha256: CONTRACT.panelMaterialHashes.isolatedIndex,
    panelSharedPanelSha256: CONTRACT.panelMaterialHashes.sharedPanel,
    panelJsxSha256: CONTRACT.panelMaterialHashes.jsx,
    expectedGeneratedSvgaSha256: "c".repeat(64),
    expectedGeneratedSvgaBytes: 823,
    ...overrides,
  };
}

async function fileSha256(relativePath) {
  return createHash("sha256")
    .update(await readFile(path.join(import.meta.dirname, relativePath)))
    .digest("hex");
}

function evidenceStore(value = descriptor()) {
  return {
    outputRoot: value.outputRoot,
    bindingSha256: "d".repeat(64),
    binding: {
      schema: "auto-svga-aeb-registered-fixture-evidence-binding-v1",
      outputName: path.basename(value.outputRoot),
      helperSha256: "e".repeat(64),
      ownerUid: 501,
      identities: {
        base: { device: 1, inode: 1 },
        task: { device: 1, inode: 2 },
        output: { device: 1, inode: 3 },
        reports: { device: 1, inode: 4 },
        saved: { device: 1, inode: 5 },
        identity: { device: 1, inode: 6 },
        "user-data": { device: 1, inode: 7 },
        "session-data": { device: 1, inode: 8 },
      },
    },
  };
}

function bootstrapArgs(value = descriptor(), store = evidenceStore(value)) {
  return [
    "--descriptor-path", path.join(value.outputRoot, "reports", "registered-fixture-descriptor.json"),
    "--descriptor-sha256", descriptorSha256(value),
    "--evidence-binding-base64", Buffer.from(JSON.stringify(store.binding), "utf8").toString("base64url"),
    "--evidence-binding-sha256", store.bindingSha256,
    "--evidence-helper-path", path.join(import.meta.dirname, "registered-fixture-proof-evidence-store.py"),
    "--evidence-helper-sha256", "f".repeat(64),
    "--output-root", value.outputRoot,
  ];
}

test("descriptor binds the exact source, isolated panel, repaired fixture, package, and output identities", () => {
  const value = validateDescriptor(descriptor());
  const environment = descriptorEnvironment(value, evidenceStore(value));
  assert.equal(value.isolatedPanelSourceHead, "aa567f2f509ada69e9ab304464f319155aa564db");
  assert.equal(value.fixtureSourceHead, "f09604d07a675bf36e7f7b1de7a8f33612ac11e9");
  assert.equal(value.fixtureSha256, "b7970b1a9c9a313e9b9f912411dacfe61d6e196c102918f4c77f49883da06936");
  assert.equal(value.fixtureBytes, 811);
  assert.equal(
    value.sourcePackageRoot,
    path.join(CONTRACT.aeDevRoot, "aeb-semantic-fixture-landing-test-001", "ae-export-package"),
  );
  assert.equal(value.requestId, "aeb-semantic-fixture-landing-test-001");
  assert.equal(value.requestSha256, "9".repeat(64));
  assert.equal(environment.AUTO_SVGA_AEB_PROOF_PERMIT_ID, value.permitId);
  assert.equal(environment.AUTO_SVGA_AEB_PROOF_EXECUTION_ID, value.executionId);
  assert.equal(environment.AUTO_SVGA_AEB_PROOF_REQUEST_ID, value.requestId);
  assert.equal(environment.AUTO_SVGA_AEB_PROOF_REQUEST_SHA256, value.requestSha256);
  assert.equal(environment.AUTO_SVGA_AEB_PROOF_D001_PERMIT_ID, value.d001PermitId);
  assert.equal(environment.AUTO_SVGA_AEB_PROOF_D001_EXECUTION_ID, value.d001ExecutionId);
  assert.equal(environment.AUTO_SVGA_AEB_PROOF_D001_PACKET_HEAD, value.d001PacketHead);
  assert.equal(value.packageRoot, path.join(CONTRACT.taskRoot, "aeb-fixture-product-package-test-001"));
  assert.equal(environment.AUTO_SVGA_AEB_PROOF_OUTPUT_ROOT, value.outputRoot);
  assert.equal(environment.AUTO_SVGA_AEB_PROOF_PACKAGE_ROOT, value.packageRoot);
  assert.equal(environment.AUTO_SVGA_AEB_PROOF_SOURCE_HEAD, value.sourceHead);
  assert.equal(environment.AUTO_SVGA_AEB_PROOF_PACKAGE_TREE_SHA256, value.packageTreeSha256);
  assert.equal(environment.AUTO_SVGA_AEB_PROOF_PACKAGE_TREE_FILE_COUNT, String(value.packageTreeFileCount));
  assert.equal(environment.AUTO_SVGA_AEB_PROOF_PACKAGE_TREE_TOTAL_BYTES, String(value.packageTreeTotalBytes));
});

test("descriptor panel material hashes bind the current installable AE26 panel bytes", async () => {
  assert.equal(
    CONTRACT.panelMaterialHashes.manifest,
    await fileSha256("plugin-panel-ae26-isolated/CSXS/manifest.xml"),
  );
  assert.equal(
    CONTRACT.panelMaterialHashes.isolatedIndex,
    await fileSha256("plugin-panel-ae26-isolated/index.html"),
  );
  assert.equal(
    CONTRACT.panelMaterialHashes.sharedPanel,
    await fileSha256("plugin-panel-dev/js/aeb-panel.js"),
  );
  assert.equal(
    CONTRACT.panelMaterialHashes.jsx,
    await fileSha256("plugin-panel-dev/jsx/aeb-export-to-auto-svga.jsx"),
  );
});

test("descriptor fails closed on lineage, panel material, root, overlap, size, or field drift", () => {
  const mutations = [
    { isolatedPanelSourceHead: "0".repeat(40) },
    { fixtureSourceHead: "0".repeat(40) },
    { fixtureSha256: "0".repeat(64) },
    { fixtureBytes: 810 },
    { d001PacketHead: "0".repeat(40) },
    { d001SourceHead: "a".repeat(40) },
    { panelManifestSha256: "0".repeat(64) },
    { sourcePackageRoot: "/private/tmp/old-root/ae-export-package" },
    { sourcePackageRoot: path.join(CONTRACT.aeDevRoot, "request-test-001", "wrong-package") },
    { packageRoot: "/private/tmp/outside/package" },
    { packageRoot: path.join(CONTRACT.taskRoot, "ae-run", "ae-export-package") },
    { outputRoot: path.join(CONTRACT.taskRoot, "nested", "output") },
    { packageRoot: path.join(CONTRACT.taskRoot, "aeb-fixture-proof-test-001", "package") },
    { requestId: "request-test-001" },
    { requestSha256: "z".repeat(64) },
    { sourcePackageRoot: path.join(CONTRACT.aeDevRoot, "aeb-semantic-other-test-001", "ae-export-package") },
    { packageTreeSha256: "z".repeat(64) },
    { packageTreeFileCount: 0 },
    { packageTreeTotalBytes: 0 },
  ];
  for (const mutation of mutations) assert.throws(() => validateDescriptor(descriptor(mutation)));
  assert.throws(() => validateDescriptor({ ...descriptor(), privatePath: "/Users/private" }), {
    code: "registered_fixture_descriptor_fields_invalid",
  });
});

test("descriptor records reject proxy, accessor, boxed, coercible, and inherited authority", () => {
  const getterInput = descriptor();
  Object.defineProperty(getterInput, "sourceHead", {
    enumerable: true,
    get() {
      throw new Error("getter must not execute");
    },
  });
  assert.throws(() => validateDescriptor(getterInput), { code: "registered_fixture_descriptor_accessor_invalid" });
  assert.throws(() => validateDescriptor(new Proxy(descriptor(), {})), {
    code: "registered_fixture_descriptor_record_invalid",
  });
  assert.throws(() => validateDescriptor({ ...descriptor(), permitId: new String("ASV-APR-20260715-999") }));
  let coercionExecuted = false;
  assert.throws(() => validateDescriptor({
    ...descriptor(),
    permitId: { toString() { coercionExecuted = true; return "ASV-APR-20260715-999"; } },
  }));
  assert.equal(coercionExecuted, false);
  assert.throws(() => validateDescriptor(Object.assign(Object.create({ inherited: true }), descriptor())), {
    code: "registered_fixture_descriptor_prototype_invalid",
  });
  const store = evidenceStore();
  Object.defineProperty(store.binding.identities.output, "inode", {
    enumerable: true,
    get() {
      throw new Error("binding getter must not execute");
    },
  });
  assert.throws(() => descriptorEnvironment(descriptor(), store), {
    code: "registered_fixture_evidence_binding_invalid",
  });
});

test("public contract surface cannot mint D001 authority or construct a registered launch", () => {
  assert.equal(Object.hasOwn(contractModule, "validateD001FinalDispositionBytes"), false);
  assert.equal(Object.hasOwn(contractModule, "buildRegisteredLaunchSpec"), false);
  assert.deepEqual(Object.keys(contractModule).sort(), [
    "CONTRACT",
    "canonicalDescriptorBytes",
    "descriptorEnvironment",
    "descriptorSha256",
    "readOwnDataRecord",
    "validateDescriptor",
  ]);
});

test("post-close replacement metadata cannot retain physical evidence authority", () => {
  const original = { byteLength: 823, sha256: "a".repeat(64), device: 1, inode: 10 };
  assert.equal(assertEvidenceRecordIdentity(original, { ...original }), true);
  assert.throws(() => assertEvidenceRecordIdentity(original, { ...original, inode: 11 }), {
    code: "registered_fixture_evidence_identity_changed",
  });
  assert.throws(() => assertEvidenceRecordIdentity(original, { ...original, byteLength: 824 }), {
    code: "registered_fixture_evidence_identity_changed",
  });
});

test("normal exit cannot publish filesystem zero-residue while task-owned runtime state remains", async () => {
  await mkdir(CONTRACT.taskRoot, { recursive: true, mode: 0o700 });
  const outputRoot = path.join(
    CONTRACT.taskRoot,
    `aeb-runtime-residue-test-${process.pid}-${Date.now()}`,
  );
  const store = createEvidenceStore(outputRoot);
  try {
    await mkdir(path.join(outputRoot, "session-data", "Cache"));
    await writeFile(path.join(outputRoot, "session-data", "Cache", "state.bin"), "runtime-state");
    await writeFile(path.join(outputRoot, "user-data", "Preferences"), "runtime-state");

    assert.throws(() => assertRuntimeStateResidueAbsent(store), {
      code: "registered_fixture_filesystem_residue_present",
    });

    const cleanup = clearRuntimeState(store);
    assert.equal(cleanup.removedEntryCount, 3);
    assert.deepEqual(assertRuntimeStateResidueAbsent(store), {
      filesystemRuntimeStateResidueObserved: false,
      runtimeStateEntryCount: 0,
    });

    const retainedPath = path.join(outputRoot, "reports", "retained-state-source.bin");
    const aliasPath = path.join(outputRoot, "session-data", "alias-state.bin");
    await writeFile(retainedPath, "retained-evidence");
    await symlink(retainedPath, aliasPath);
    assert.throws(() => clearRuntimeState(store), { code: "registered_fixture_evidence_store_failed" });
    assert.equal(await readFile(retainedPath, "utf8"), "retained-evidence");
    await rm(aliasPath);

    await link(retainedPath, aliasPath);
    assert.throws(() => clearRuntimeState(store), { code: "registered_fixture_evidence_store_failed" });
    assert.equal(await readFile(retainedPath, "utf8"), "retained-evidence");
    await rm(aliasPath);
  } finally {
    await rm(outputRoot, { recursive: true, force: true });
  }
});

test("bootstrap CLI accepts one canonical exact-key sequence only", () => {
  const args = bootstrapArgs();
  assert.deepEqual(Object.keys(bootstrapModule.parseArgs(args)), bootstrapModule.ARGUMENT_KEYS);
  const duplicate = [...args];
  duplicate[2] = duplicate[0];
  assert.throws(() => bootstrapModule.parseArgs(duplicate), { code: "registered_fixture_arguments_invalid" });
  const unknown = [...args];
  unknown[0] = "--private-descriptor-path";
  assert.throws(() => bootstrapModule.parseArgs(unknown), { code: "registered_fixture_arguments_invalid" });
  const reordered = [...args.slice(2, 4), ...args.slice(0, 2), ...args.slice(4)];
  assert.throws(() => bootstrapModule.parseArgs(reordered), { code: "registered_fixture_arguments_invalid" });
  const alternate = [...args];
  alternate.splice(0, 2, `--descriptor-path=${args[1]}`, "ignored");
  assert.throws(() => bootstrapModule.parseArgs(alternate), { code: "registered_fixture_arguments_invalid" });
  assert.throws(() => bootstrapModule.parseArgs(args.slice(0, -1)), { code: "registered_fixture_arguments_invalid" });
});

test("orchestrator CLI is exact and exposes no D001 capability helper", async () => {
  const module = await import(`./run-registered-fixture-product-proof-orchestrator.mjs?test=${Date.now()}`);
  const args = [
    "--mode", "execute",
    "--descriptor-base64", "e30",
    "--descriptor-sha256", "a".repeat(64),
    "--d001-lifecycle-base64", "e30",
  ];
  assert.deepEqual(Object.keys(module.parseArgs(args)), module.CLI_KEYS);
  assert.equal(Object.hasOwn(module, "validateD001LifecycleResult"), false);
  assert.equal(Object.hasOwn(module, "buildRegisteredLaunch"), false);
  assert.equal(Object.hasOwn(module, "finalizeRegisteredFixtureProductProof"), false);
  assert.throws(() => module.parseArgs([...args.slice(2, 4), ...args.slice(0, 2), ...args.slice(4)]));
  assert.throws(() => module.parseArgs([...args, "--private", "value"]));
});

test("orchestrator rejects duplicate-key descriptor and lifecycle JSON before any execution", async () => {
  const module = await import(`./run-registered-fixture-product-proof-orchestrator.mjs?canonical=${Date.now()}`);
  const value = descriptor();
  const descriptorBytes = canonicalDescriptorBytes(value);
  const duplicateDescriptorBytes = Buffer.from(
    descriptorBytes.toString("utf8").replace(
      "{\n",
      `{\n  "d001ExecutionId": "forged-duplicate-value",\n`,
    ),
    "utf8",
  );
  const lifecycle = {
    executionId: value.d001ExecutionId,
    outputRoot: path.join(CONTRACT.taskRoot, "aeb-d001-test-output-001"),
    packetHead: value.d001PacketHead,
    permitId: value.d001PermitId,
    preflightRelayPath: path.join(CONTRACT.taskRoot, "control", "preflight.json"),
    preflightRelaySha256: "1".repeat(64),
    prelaunchAuthorityPath: path.join(CONTRACT.taskRoot, "process-authority", "prelaunch.json"),
    prelaunchAuthoritySha256: "2".repeat(64),
  };
  const lifecycleBytes = Buffer.from(`${JSON.stringify(
    Object.fromEntries(Object.keys(lifecycle).sort().map((key) => [key, lifecycle[key]])),
    null,
    2,
  )}\n`, "utf8");
  const cliValue = (input) => Buffer.isBuffer(input) ? input.toString("base64url") : input;
  const argsFor = (descriptorInput, lifecycleInput) => [
    "--mode", "execute",
    "--descriptor-base64", cliValue(descriptorInput),
    "--descriptor-sha256", descriptorSha256(value),
    "--d001-lifecycle-base64", cliValue(lifecycleInput),
  ];
  await assert.rejects(module.main(argsFor(duplicateDescriptorBytes, lifecycleBytes)), {
    code: "registered_fixture_descriptor_json_noncanonical",
  });
  await assert.rejects(module.main(argsFor(`${descriptorBytes.toString("base64url")}=`, lifecycleBytes)), {
    code: "registered_fixture_descriptor_json_noncanonical",
  });
  const duplicateLifecycleBytes = Buffer.from(
    lifecycleBytes.toString("utf8").replace("{\n", `{\n  "executionId": "forged-duplicate-value",\n`),
    "utf8",
  );
  await assert.rejects(module.main(argsFor(descriptorBytes, duplicateLifecycleBytes)), {
    code: "registered_fixture_d001_lifecycle_json_noncanonical",
  });
  await assert.rejects(module.main(argsFor(descriptorBytes, `${lifecycleBytes.toString("base64url")}` + "=")), {
    code: "registered_fixture_d001_lifecycle_json_noncanonical",
  });
});

test("orchestrator main carries the sanitized D001 lifecycle into run without raw-object revalidation", async () => {
  const module = await import(`./run-registered-fixture-product-proof-orchestrator.mjs?handoff=${Date.now()}`);
  const value = descriptor();
  const descriptorBytes = canonicalDescriptorBytes(value);
  const lifecycle = {
    executionId: value.d001ExecutionId,
    outputRoot: path.join(CONTRACT.taskRoot, "aeb-d001-test-output-002"),
    packetHead: value.d001PacketHead,
    permitId: value.d001PermitId,
    preflightRelayPath: path.join(CONTRACT.taskRoot, "control", "preflight.json"),
    preflightRelaySha256: "1".repeat(64),
    prelaunchAuthorityPath: path.join(CONTRACT.taskRoot, "process-authority", "prelaunch.json"),
    prelaunchAuthoritySha256: "2".repeat(64),
  };
  const lifecycleBytes = Buffer.from(`${JSON.stringify(
    Object.fromEntries(Object.keys(lifecycle).sort().map((key) => [key, lifecycle[key]])),
    null,
    2,
  )}\n`, "utf8");
  await assert.rejects(module.main([
    "--mode", "execute",
    "--descriptor-base64", descriptorBytes.toString("base64url"),
    "--descriptor-sha256", descriptorSha256(value),
    "--d001-lifecycle-base64", lifecycleBytes.toString("base64url"),
  ]), {
    code: "registered_fixture_git_binding_invalid",
  });
});

test("registered bootstrap enters the real product and records a legal app.quit lifecycle", async () => {
  const source = await fs.readFile(path.join(import.meta.dirname, "registered-aeb-native-preview-bootstrap.cjs"), "utf8");
  assert.match(source, /registered-first-javascript-marker\.json/u);
  assert.match(source, /registered-normal-quit-requested\.json/u);
  assert.match(source, /registered-normal-quit-will-quit\.json/u);
  assert.match(source, /registered-normal-quit-observed\.json/u);
  assert.match(source, /requestId: descriptor\.requestId/u);
  assert.match(source, /requestSha256: descriptor\.requestSha256/u);
  assert.match(source, /app\.setAppPath\(CONTRACT\.experimentRoot\)/u);
  assert.match(source, /require\(path\.join\(CONTRACT\.experimentRoot, "main\.cjs"\)\)/u);
  assert.doesNotMatch(source, /spawnSync|execFile/u);
});

test("executable orchestrator owns one registered action, no fallback, normal evidence, and final zero-residue gate", async () => {
  const source = await fs.readFile(path.join(import.meta.dirname, "run-registered-fixture-product-proof-orchestrator.mjs"), "utf8");
  assert.match(source, /PRIVATE_D001_AUTHORITIES = new WeakMap/u);
  assert.match(source, /assertDescriptorPackageTree\(descriptor, "registered_fixture_package_tree_prepared_mismatch"\);[\s\S]+?runExactD001Lifecycle\(d001Options\)/u);
  assert.match(source, /runExactD001Lifecycle\(d001Options\)/u);
  assert.match(source, /launchAttemptsPerformed \+= 1;[\s\S]+?launchResult = spawnSync/u);
  assert.match(source, /command: CONTRACT\.electronExecutable/u);
  assert.match(source, /REGISTERED_BOOTSTRAP_WRAPPER_NAME = "registered-bootstrap-wrapper\.cjs"/u);
  assert.match(source, /fs\.writeFileSync\(wrapperPath, source, \{ flag: "wx", mode: 0o600 \}\)/u);
  assert.match(source, /bootstrap\.main\(process\.argv\.slice\(2\)\)/u);
  assert.match(source, /bootstrapWrapper\.path,\s*"--descriptor-path"/u);
  assert.doesNotMatch(source, /CONTRACT\.bootstrapPath,\s*"--descriptor-path"/u);
  assert.doesNotMatch(source, /"-n", "-g", "-a", CONTRACT\.electronApp/u);
  assert.match(source, /normal-quit-observed\.json/u);
  assert.match(source, /prepareProcessAuthorityRoot/u);
  assert.match(source, /prepareProcessAuthorityRoot\(\{\s*executionId: descriptor\.executionId,\s*requireAbsent: true,/u);
  assert.match(source, /loadAndValidateProcessAuthority/u);
  assert.match(source, /crashDelta\(input\.crashBefore, input\.crashAfter\)/u);
  assert.match(source, /clearRuntimeState\(store\);\s*assertRuntimeStateResidueAbsent\(store\);/u);
  assert.match(source, /const filesystemRuntimeState = assertRuntimeStateResidueAbsent\(store\);/u);
  assert.match(source, /postrunProcessAuthorityAccepted: postrunAuthority\.artifact\.authorityAccepted === true/u);
  assert.match(source, /processResidueObserved: false/u);
  assert.match(source, /filesystemRuntimeStateResidueObserved: filesystemRuntimeState\.filesystemRuntimeStateResidueObserved/u);
  assert.doesNotMatch(source, /zeroResidueObserved/u);
  assert.match(source, /consumeD001AuthorityForFinalization/u);
  assert.equal(source.includes('"/usr/bin/open"'), false);
});
