import assert from "node:assert/strict";
import {
  AEB_RETAINED_AE_BAKE_HOST_DESCRIPTOR,
  consumeAebRetainedAeTransactionCapability
} from "../experiments/aeb-retained-ae-discriminator/runtime.js";
import {
  appendFile,
  chmod,
  link,
  mkdtemp,
  mkdir,
  readFile,
  readdir,
  realpath,
  rename,
  rm,
  symlink,
  unlink,
  writeFile
} from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { inflateSync } from "node:zlib";
import {
  AebAeBakeExecutionError,
  NodeAebBoundedAeBakeExecutor,
  cleanupReceiptFile,
  planFile,
  producerReceiptFile,
  type AebBoundedAeBakeExecutionResult
} from "../hosts/aeb-node-bounded-ae-bake-executor.js";
import {
  NodeAebAerenderHostAdapter,
  NodeAebSyntheticAerenderHostAdapter,
  runAebAeClosedChildProcessSourceProbe,
  type AebAeSyntheticProcessRunRequest,
  type AebAeSyntheticProcessRunResult,
  type AebAeSyntheticProcessRunner
} from "../hosts/aeb-node-aerender-host-adapter.js";
import {
  NodeAebBakeResourceReader,
  NodeAebTaskRootAuthority,
  type AebTaskRootAuthorityHooks
} from "../hosts/aeb-node-bake-resource-reader.js";
import { NodeAebBakePackagePublisher } from "../hosts/aeb-node-bake-package-publisher.js";
import {
  NodeAebRetainedBakeSvgaFragmentPublisher,
  aebRetainedBakeSvgaFragmentSourceProbeFileName
} from "../hosts/aeb-node-retained-bake-svga-fragment-publisher.js";
import {
  createAebRetainedBakeSvgaFragmentOracleReport
} from "../hosts/aeb-retained-bake-svga-fragment-oracle.js";
import {
  NodeAebRetainedBakeCombinedSourceFlow
} from "../hosts/aeb-retained-bake-combined-source-flow.js";
import {
  NodeAebRetainedBakeFullCompositionPublisher,
  aebRetainedBakeFullCompositionFileName
} from "../hosts/aeb-retained-bake-full-composition-publisher.js";
import {
  NodeAebRetainedBakeCombinedHostSession
} from "../hosts/aeb-retained-bake-combined-host-session.js";
import {
  NodeAebRetainedBakePanelHost
} from "../hosts/aeb-retained-bake-panel-host.js";
import {
  NodeAebBakeOwnerSourceFlow,
  type RunAebBakeOwnerSourceFlowInput
} from "../hosts/aeb-bake-owner-source-flow.js";
import {
  AEB_REVIEWED_SVGA_DESCRIPTOR_SHA256,
  AEB_REVIEWED_SVGA_PROTO_FILE_SHA256,
  loadAebReviewedSvgaSchemaAuthority,
  runAebReviewedSvgaSchemaSourceProbe,
  verifyAebReviewedSvgaDescriptorSourceProbe
} from "../hosts/aeb-reviewed-svga-schema.js";
import { Sha256ResourceHasher } from "../hosts/sha256-resource-hasher.js";
import type {
  AebBakeExecutionAuthority,
  AebBakeExecutionReceipt,
  AebBakeJob,
  AebBakeManifest,
  AebBakePlannerJoin,
  AebBakeTaskReceipt,
  AebFormatNeutralIr
} from "../workbench/aeb-bake-contracts.js";
import {
  AebBakePipelineError,
  buildAebBakeManifest,
  verifyAebBakeManifestIntegrity
} from "../workbench/aeb-bake-pipeline.js";
import {
  type AebAeBakeHostAdapter,
  type AebAeBakeHostResult,
  type AebAeBakeCleanupReceipt,
  type AebAeBakeExecutionPlan,
  type AebAeBakeProducerReceipt,
  type AebAeControlledScanOutput,
  type AebAeControlledScanReceipt,
  type AebAeRetainedTransactionReceipt,
  type AebAeSplitHostExecutionEvidence,
  AEB_AE_RETAINED_TRANSACTION_RECEIPT_SCHEMA_VERSION,
  createAebAeRetainedHostExecutionEvidence,
  createAebAeBakeExecutionPlan,
  hashCanonical,
  verifyAebAeBakeExecutionPlan,
  verifyAebAeBakeProducerReceipt,
  verifyAebAeRetainedTransactionReceipt
} from "../workbench/aeb-ae-bake-execution.js";
import { reinsertAebBakePackage } from "../workbench/aeb-package-reinsertion.js";
import {
  createAebRetainedBakeAuthorityChain,
  verifyAebRetainedBakeAuthorityChainReceipt,
  type CreateAebRetainedBakeAuthorityChainInput
} from "../workbench/aeb-retained-bake-authority-chain.js";
import { createSvgaAebBakeAdapterInput } from "../workbench/svga/aeb-bake-adapter.js";
import { createTransparentImage, encodeRgbaPng, setPixel } from "../utils/png-writer.js";

type RunnerBehavior = "success" | "missing" | "extra" | "hardlink" | "symlink" | "hang";
type ScannerFault = "missing" | "malformed";

test("legacy split host stops before F1 manifest reinsertion publication or adapter authority", async (t) => {
  const fixture = await createFixture(t, { timeoutMs: 10_000 });
  await assertBakeError(
    () => new NodeAebBoundedAeBakeExecutor(fixture.authority, fixture.hasher).execute(
      fixture.plan,
      concreteHostFor(fixture)
    ),
    "AE_RETAINED_TRANSACTION_AUTHORITY_REQUIRED"
  );
  assert.deepEqual(await readFile(fixture.projectPath), fixture.projectBytes);
  assert.deepEqual(await readFile(fixture.packagePath), fixture.packageBytes);
  assert.equal((await taskNames(fixture)).includes("f2-successor-package.json"), false);
  await assertNoExecutionResidue(fixture);
});

test("self-hashed retained PASS-shaped host result cannot mint or replay actual authority", async (t) => {
  const fixture = await createFixture(t, { executionId: "exec-retained-shaped-001", retainedSlice: true });
  const host = passShapedRetainedHostFor(fixture);
  await assertBakeError(
    () => new NodeAebBoundedAeBakeExecutor(fixture.authority, fixture.hasher).execute(fixture.plan, host),
    "AE_RETAINED_TRANSACTION_AUTHORITY_REQUIRED"
  );
  const shaped = await host.lastResult();
  assert.equal(consumeAebRetainedAeTransactionCapability(shaped, fixture.plan), false);
  assert.equal(consumeAebRetainedAeTransactionCapability(structuredClone(shaped), fixture.plan), false);
  await assertNoExecutionResidue(fixture);
});

test("retained receipt semantics bind plan project package comp frame cleanup and process", async (t) => {
  const fixture = await createFixture(t, { executionId: "exec-retained-semantics", retainedSlice: true });
  const receipt = await passShapedRetainedReceipt(fixture);
  assert.equal(await verifyAebAeRetainedTransactionReceipt(fixture.plan, receipt, fixture.hasher), true);
  const mutations: Array<(value: AebAeRetainedTransactionReceipt) => void> = [
    (value) => { value.planHash = "a".repeat(64); },
    (value) => { value.taskId = "cross-task"; },
    (value) => { value.packageId = "cross-package"; },
    (value) => { value.sourceFingerprint = "b".repeat(64); },
    (value) => { value.source.projectContentHash = "c".repeat(64); },
    (value) => { value.source.packageContentHash = "d".repeat(64); },
    (value) => { value.timing.startFrame += 1; },
    (value) => { value.timing.fps += 1; },
    (value) => { value.canvas.width += 1; },
    (value) => { value.alphaMode = "premultiplied" as "straight"; },
    (value) => { value.composition.productId = "cross-comp"; },
    (value) => { value.output.frames[0]!.frameIndex += 1; },
    (value) => { value.cleanup.processGroupAbsenceProven = false as true; },
    (value) => { value.cleanup.runRootRemoved = false as true; },
    (value) => { (value as unknown as Record<string, unknown>).callerClaimedActual = true; }
  ];
  for (const mutate of mutations) {
    const forged = structuredClone(receipt);
    mutate(forged);
    forged.receiptHash = await rehashRetainedReceipt(forged, fixture.hasher);
    assert.equal(await verifyAebAeRetainedTransactionReceipt(fixture.plan, forged, fixture.hasher), false);
  }
});

test("retained adapter construction exposes no runner executable environment or actual flag inputs", async () => {
  const runtimeModule = await import("../experiments/aeb-retained-ae-discriminator/runtime.js");
  const publicModule = await import("../experiments/aeb-retained-ae-discriminator/index.js");
  assert.equal(runtimeModule.NodeAebRetainedAeBakeHostAdapter.length, 0);
  assert.deepEqual(runtimeModule.AEB_RETAINED_AE_BAKE_HOST_DESCRIPTOR, AEB_RETAINED_AE_BAKE_HOST_DESCRIPTOR);
  assert.equal(publicModule.NodeAebRetainedAeBakeHostAdapter.length, 0);
  assert.equal("consumeAebRetainedAeTransactionCapability" in publicModule, false);
  assert.equal("createPrivateRuntimePlan" in runtimeModule, false);
  assert.equal("privateCompletedRuns" in runtimeModule, false);
  assert.equal("retainedHostCapabilities" in runtimeModule, false);
});

test("unsupported and replaceable-capture plans stop before task or host mutation", async (t) => {
  const fixture = await createFixture(t);
  const runner = new DeterministicAerenderRunner("success", fixture.outsideFramePath);
  const host = hostFor(fixture, runner);
  const executor = new NodeAebBoundedAeBakeExecutor(fixture.authority, fixture.hasher);
  const unsupported = await rehashPlan({
    ...fixture.plan,
    controlledFeatures: { ...fixture.plan.controlledFeatures, unknownHostCapabilities: true as false }
  }, fixture.hasher);
  const replaceable = await rehashPlan({
    ...fixture.plan,
    job: {
      ...fixture.plan.job,
      target: { ...fixture.plan.job.target, replaceableElementIds: ["owner-slot"] }
    }
  }, fixture.hasher);
  await assertBakeError(() => executor.execute(unsupported, host), "AE_EXECUTION_PLAN_INVALID");
  await assertBakeError(() => executor.execute(replaceable, host), "AE_EXECUTION_PLAN_INVALID");
  assert.equal(runner.calls, 0);
  await assertNoExecutionResidue(fixture);
});

test("missing, stale, hard-link, and symlink frame outputs roll back before producer authority", async (t) => {
  for (const behavior of ["missing", "extra", "hardlink", "symlink"] as const) {
    await t.test(behavior, async (t) => {
      const fixture = await createFixture(t, { executionId: `exec-${behavior}` });
      const runner = new DeterministicAerenderRunner(behavior, fixture.outsideFramePath);
      await assert.rejects(
        () => new NodeAebBoundedAeBakeExecutor(fixture.authority, fixture.hasher).execute(
          fixture.plan,
          hostFor(fixture, runner)
        ),
        (error: unknown) => {
          assert.ok(error instanceof AebAeBakeExecutionError);
          assert.equal(error.cleanupReceipt?.outcome, "rollback");
          return true;
        }
      );
      await assertNoExecutionResidue(fixture);
      assert.deepEqual(await readFile(fixture.projectPath), fixture.projectBytes);
      assert.deepEqual(await readFile(fixture.packagePath), fixture.packageBytes);
    });
  }
});

test("growing frame output is rejected and fully rolled back", async (t) => {
  let grown = false;
  const hooks: AebTaskRootAuthorityHooks = {
    async afterFileRead(relativePath) {
      if (!grown && relativePath.includes("/raw/") && relativePath.endsWith(".png")) {
        grown = true;
        await appendFile(path.join(fixtureForHook.taskRoot, relativePath), Buffer.from([0]));
      }
    }
  };
  let fixtureForHook!: Fixture;
  fixtureForHook = await createFixture(t, { executionId: "exec-growing", authorityHooks: hooks });
  await assert.rejects(
    () => new NodeAebBoundedAeBakeExecutor(fixtureForHook.authority, fixtureForHook.hasher).execute(
      fixtureForHook.plan,
      hostFor(fixtureForHook, new DeterministicAerenderRunner("success", fixtureForHook.outsideFramePath))
    ),
    (error: unknown) => error instanceof AebAeBakeExecutionError
  );
  assert.equal(grown, true);
  await assertNoExecutionResidue(fixtureForHook);
});

test("source hard links, authority-file overwrite, and executable drift fail closed", async (t) => {
  await t.test("source hard link", async (t) => {
    const fixture = await createFixture(t, { executionId: "exec-source-hardlink" });
    const outsideProject = path.join(fixture.taskBase, "outside-source-project.aep");
    await writeFile(outsideProject, fixture.projectBytes);
    await unlink(fixture.projectPath);
    await link(outsideProject, fixture.projectPath);
    const runner = new DeterministicAerenderRunner("success", fixture.outsideFramePath);
    await assertBakeError(
      () => new NodeAebBoundedAeBakeExecutor(fixture.authority, fixture.hasher).execute(
        fixture.plan,
        hostFor(fixture, runner)
      ),
      "SOURCE_PROJECT_MULTILINK_FORBIDDEN"
    );
    assert.equal(runner.calls, 0);
    await assertNoExecutionResidue(fixture);
  });

  await t.test("authority-file no-overwrite", async (t) => {
    const fixture = await createFixture(t, { executionId: "exec-no-overwrite" });
    const competing = Buffer.from("competing-authority-bytes");
    const competingPath = path.join(fixture.taskRoot, planFile(fixture.plan.executionId));
    await writeFile(competingPath, competing);
    await assert.rejects(
      () => new NodeAebBoundedAeBakeExecutor(fixture.authority, fixture.hasher).execute(
        fixture.plan,
        hostFor(fixture, new DeterministicAerenderRunner("success", fixture.outsideFramePath))
      ),
      (error: unknown) => error instanceof AebAeBakeExecutionError
    );
    assert.deepEqual(await readFile(competingPath), competing);
    const names = await taskNames(fixture);
    assert.equal(names.some((name) => name.startsWith("aeb-ae-work-")), false);
    assert.equal(names.some((name) => name.startsWith("aeb-ae-frames-")), false);
    assert.equal(names.some((name) => name.startsWith("aeb-ae-temp-")), false);
    assert.equal(names.some((name) => name.startsWith("aeb-ae-producer-receipt-")), false);
    assert.equal(names.some((name) => name.startsWith("aeb-ae-cleanup-receipt-")), false);
  });

  await t.test("executable pre-post drift", async (t) => {
    const fixture = await createFixture(t, { executionId: "exec-host-drift" });
    const inner = new DeterministicAerenderRunner("success", fixture.outsideFramePath);
    const runner: AebAeSyntheticProcessRunner = {
      async run(request) {
        const result = await inner.run(request);
        await writeFile(fixture.executablePath, Buffer.from("mutated-aerender-executable"));
        return result;
      }
    };
    await assert.rejects(
      () => new NodeAebBoundedAeBakeExecutor(fixture.authority, fixture.hasher).execute(
        fixture.plan,
        hostFor(fixture, runner)
      ),
      (error: unknown) => {
        assert.ok(error instanceof AebAeBakeExecutionError);
        assert.equal(error.code, "AE_EXECUTABLE_AUTHORITY_CHANGED");
        return true;
      }
    );
    await assertNoExecutionResidue(fixture);
  });
});

test("encoded budget, cancel, timeout, and phase faults leave zero partial authority", async (t) => {
  await t.test("encoded budget", async (t) => {
    const fixture = await createFixture(t, { executionId: "exec-budget" });
    const constrained = await rehashPlan({
      ...fixture.plan,
      job: { ...fixture.plan.job, budgets: { ...fixture.plan.job.budgets, maxEncodedBytes: 32 } }
    }, fixture.hasher);
    await assert.rejects(
      () => new NodeAebBoundedAeBakeExecutor(fixture.authority, fixture.hasher).execute(
        constrained,
        hostFor(fixture, new DeterministicAerenderRunner("success", fixture.outsideFramePath), constrained.host)
      ),
      (error: unknown) => error instanceof AebAeBakeExecutionError
    );
    await assertNoExecutionResidue(fixture);
  });

  await t.test("pre-start cancel", async (t) => {
    const fixture = await createFixture(t, { executionId: "exec-cancel" });
    const runner = new DeterministicAerenderRunner("success", fixture.outsideFramePath);
    const controller = new AbortController();
    controller.abort();
    await assertBakeError(
      () => new NodeAebBoundedAeBakeExecutor(fixture.authority, fixture.hasher).execute(
        fixture.plan,
        hostFor(fixture, runner),
        { signal: controller.signal }
      ),
      "AE_EXECUTION_CANCELLED"
    );
    assert.equal(runner.calls, 0);
    await assertNoExecutionResidue(fixture);
  });

  await t.test("timeout", async (t) => {
    const fixture = await createFixture(t, { executionId: "exec-timeout", timeoutMs: 20 });
    await assert.rejects(
      () => new NodeAebBoundedAeBakeExecutor(fixture.authority, fixture.hasher).execute(
        fixture.plan,
        hostFor(fixture, new DeterministicAerenderRunner("hang", fixture.outsideFramePath))
      ),
      (error: unknown) => {
        assert.ok(error instanceof AebAeBakeExecutionError);
        assert.equal(error.code, "AE_EXECUTION_TIMEOUT");
        return true;
      }
    );
    await assertNoExecutionResidue(fixture);
  });

  await t.test("mid-render cancel", async (t) => {
    const fixture = await createFixture(t, { executionId: "exec-mid-cancel", timeoutMs: 2_000 });
    const controller = new AbortController();
    const runner: AebAeSyntheticProcessRunner = {
      async run(request) {
        controller.abort();
        if (!request.signal.aborted) {
          await new Promise<void>((resolve) => request.signal.addEventListener("abort", () => resolve(), { once: true }));
        }
        return { started: true, exitCode: null, signal: "SIGTERM", forcedTermination: false };
      }
    };
    await assert.rejects(
      () => new NodeAebBoundedAeBakeExecutor(fixture.authority, fixture.hasher).execute(
        fixture.plan,
        hostFor(fixture, runner),
        { signal: controller.signal }
      ),
      (error: unknown) => {
        assert.ok(error instanceof AebAeBakeExecutionError);
        assert.equal(error.code, "AE_EXECUTION_CANCELLED");
        return true;
      }
    );
    await assertNoExecutionResidue(fixture);
  });

  for (const phase of ["write", "finalize", "cleanup"] as const) {
    await t.test(`${phase} fault`, async (t) => {
      const fixture = await createFixture(t, { executionId: `exec-fault-${phase}` });
      await assert.rejects(
        () => new NodeAebBoundedAeBakeExecutor(fixture.authority, fixture.hasher).execute(
          fixture.plan,
          hostFor(fixture, new DeterministicAerenderRunner("success", fixture.outsideFramePath)),
          { hooks: { beforePhase(current) { if (current === phase) throw new Error("injected"); } } }
        ),
        (error: unknown) => error instanceof AebAeBakeExecutionError
      );
      await assertNoExecutionResidue(fixture);
    });
  }
});

test("PASS-shaped retained output leaves no producer receipt canonical frame or successor on rejection", async (t) => {
  const fixture = await createFixture(t, { executionId: "exec-shaped-zero-residue", retainedSlice: true });
  await assertBakeError(
    () => new NodeAebBoundedAeBakeExecutor(fixture.authority, fixture.hasher).execute(
      fixture.plan,
      passShapedRetainedHostFor(fixture)
    ),
    "AE_RETAINED_TRANSACTION_AUTHORITY_REQUIRED"
  );
  await assertNoExecutionResidue(fixture);
  assert.equal((await taskNames(fixture)).some((name) => name.includes("successor")), false);
});

test("retained receipt rejects a valid RGBA output substituted after the claimed transaction", async (t) => {
  const fixture = await createFixture(t, { executionId: "exec-retained-output-substitution", retainedSlice: true });
  const claimedFrameIndex = fixture.plan.output.frames[0]!.frameIndex;
  await assertBakeError(
    () => new NodeAebBoundedAeBakeExecutor(fixture.authority, fixture.hasher).execute(
      fixture.plan,
      passShapedRetainedHostFor(fixture, deterministicFrame(claimedFrameIndex + 1))
    ),
    "AE_RETAINED_OUTPUT_BINDING_MISMATCH"
  );
  await assertNoExecutionResidue(fixture);
});

test("retained Bake chain binds the controlled result through F1 physical package and SVGA adapter input", async (t) => {
  const { input } = await createRetainedChainFixture(t, "exec-retained-chain-positive");
  const receipt = await createAebRetainedBakeAuthorityChain(input);
  assert.equal(receipt.authorityState, "source_validated_svga_adapter_ready");
  assert.equal(receipt.actualAeRenderExecuted, true);
  assert.equal(receipt.runtimeProved, false);
  assert.equal(receipt.standardsValidSvgaEncoded, false);
  assert.equal(receipt.realPreviewValidated, false);
  assert.equal(receipt.saveAsBytesAuthorized, false);
  assert.equal(receipt.installedQaAccepted, false);
  assert.equal(receipt.productOwnerAccepted, false);
  assert.equal(receipt.producerReceiptHash, input.producerReceipt.receiptHash);
  assert.equal(receipt.executionReceiptHash, input.executionReceipt.receiptHash);
  assert.equal(receipt.manifestId, input.manifest.manifestId);
  assert.equal(receipt.packageBundleId, input.published.bundle.packageBundleId);
  assert.equal(receipt.publicationReceiptHash, input.published.publicationReceipt.receiptHash);
  assert.equal(await verifyAebRetainedBakeAuthorityChainReceipt(receipt, input), true);
});

test("retained Bake source probe publishes an exact standards-valid non-authoritative SVGA fragment", async (t) => {
  const { fixture, input } = await createRetainedChainFixture(t, "exec-retained-svga-fragment-positive");
  const chainReceipt = await createAebRetainedBakeAuthorityChain(input);
  const publisher = new NodeAebRetainedBakeSvgaFragmentPublisher(fixture.authority);
  const sourceBefore = await readFile(fixture.packagePath);
  const successorBefore = await readFile(path.join(
    fixture.taskRoot,
    input.published.publicationReceipt.successorPackage.relativePath
  ));
  const published = await publisher.publishSourceProbe({ chainReceipt, chainInput: input });

  assert.equal(published.authorityState, "source_validated_non_authoritative");
  assert.equal(published.actualAeRenderExecuted, false);
  assert.equal(published.validation.standardsValidSvgaEncoded, true);
  assert.equal(published.validation.nativeMergeRequired, true);
  assert.equal(published.validation.runtimeProved, false);
  assert.equal(published.validation.realPreviewValidated, false);
  assert.equal(published.validation.saveAsBytesAuthorized, false);
  assert.equal(published.schema.protoFileSha256, AEB_REVIEWED_SVGA_PROTO_FILE_SHA256);
  assert.equal(published.schema.descriptorSha256, AEB_REVIEWED_SVGA_DESCRIPTOR_SHA256);
  assert.equal(published.output.relativePath, aebRetainedBakeSvgaFragmentSourceProbeFileName(chainReceipt.chainHash));
  assert.equal(published.output.encodedBytes, (await readFile(path.join(fixture.taskRoot, published.output.relativePath))).byteLength);
  assert.deepEqual(await readFile(fixture.packagePath), sourceBefore);
  assert.deepEqual(
    await readFile(path.join(fixture.taskRoot, input.published.publicationReceipt.successorPackage.relativePath)),
    successorBefore
  );
  assert.equal(await publisher.verifySourceProbe(published, { chainReceipt, chainInput: input }), true);
  assert.equal(await publisher.verifyPublished(
    structuredClone({
      receipt: {
        receiptHash: published.probeHash,
        output: { identityDigest: published.output.identityDigest }
      }
    }) as unknown as Parameters<typeof publisher.verifyPublished>[0],
    { chainReceipt, chainInput: input }
  ), false);
});

test("retained Bake SVGA fragment oracle validates package tree schema and non-authoritative compatibility ladder", async (t) => {
  const { fixture, input } = await createRetainedChainFixture(t, "exec-retained-svga-fragment-oracle");
  const chainReceipt = await createAebRetainedBakeAuthorityChain(input);
  const publisher = new NodeAebRetainedBakeSvgaFragmentPublisher(fixture.authority);
  const sourceProbe = await publisher.publishSourceProbe({ chainReceipt, chainInput: input });

  const report = await createAebRetainedBakeSvgaFragmentOracleReport(
    fixture.authority,
    { chainReceipt, chainInput: input },
    sourceProbe
  );

  assert.equal(report.authorityState, "source_validated_fragment_oracle");
  assert.equal(report.sourceProbeHash, sourceProbe.probeHash);
  assert.equal(report.schema.protoFileSha256, AEB_REVIEWED_SVGA_PROTO_FILE_SHA256);
  assert.equal(report.schema.descriptorSha256, AEB_REVIEWED_SVGA_DESCRIPTOR_SHA256);
  assert.equal(report.sourcePackage.contentHash, input.plan.sourceFiles.packageContentHash);
  assert.equal(report.successorPackage.publicationReceiptHash, input.published.publicationReceipt.receiptHash);
  assert.equal(report.fragment.relativePath, sourceProbe.output.relativePath);
  assert.equal(report.fragment.contentHash, sourceProbe.output.contentHash);
  assert.equal(report.fragment.movieEntityVerified, true);
  assert.equal(report.fragment.fixedDescriptorReopened, true);
  assert.equal(report.compatibility.standardsValidSvgaFragment, true);
  assert.equal(report.compatibility.nativeMergeRequired, true);
  assert.equal(report.compatibility.fullCompositionEncoded, false);
  assert.equal(report.compatibility.actualBakeAuthorityMinted, false);
  assert.equal(report.compatibility.runtimeProved, false);
  assert.equal(report.compatibility.realPreviewValidated, false);
  assert.equal(report.compatibility.saveAsBytesAuthorized, false);
  assert.match(report.reportHash, /^[a-f0-9]{64}$/);
});

test("retained Bake SVGA fragment oracle rejects PASS-shaped elevation and stale physical inputs", async (t) => {
  await t.test("self-hashed-actual-elevation", async (t) => {
    const { fixture, input } = await createRetainedChainFixture(t, "exec-retained-svga-oracle-elevation");
    const chainReceipt = await createAebRetainedBakeAuthorityChain(input);
    const publisher = new NodeAebRetainedBakeSvgaFragmentPublisher(fixture.authority);
    const sourceProbe = await publisher.publishSourceProbe({ chainReceipt, chainInput: input });
    const forged = structuredClone(sourceProbe) as unknown as Record<string, unknown>;
    forged.actualAeRenderExecuted = true;
    forged.authorityState = "source_validated_standards_valid_baked_svga_fragment";
    forged.validation = { ...(forged.validation as Record<string, unknown>), realPreviewValidated: true };
    const { probeHash: _oldProbeHash, ...withoutHash } = forged;
    forged.probeHash = await hashCanonical(input.hasher, withoutHash);

    await assertBakeError(
      () => createAebRetainedBakeSvgaFragmentOracleReport(
        fixture.authority,
        { chainReceipt, chainInput: input },
        forged as unknown as Parameters<typeof createAebRetainedBakeSvgaFragmentOracleReport>[2]
      ),
      "AE_RETAINED_SVGA_ORACLE_PROBE_INVALID"
    );
  });

  await t.test("output-substitution", async (t) => {
    const { fixture, input } = await createRetainedChainFixture(t, "exec-retained-svga-oracle-output-swap");
    const chainReceipt = await createAebRetainedBakeAuthorityChain(input);
    const publisher = new NodeAebRetainedBakeSvgaFragmentPublisher(fixture.authority);
    const sourceProbe = await publisher.publishSourceProbe({ chainReceipt, chainInput: input });
    await writeFile(
      path.join(fixture.taskRoot, sourceProbe.output.relativePath),
      Buffer.alloc(sourceProbe.output.encodedBytes, 0)
    );

    await assertBakeError(
      () => createAebRetainedBakeSvgaFragmentOracleReport(
        fixture.authority,
        { chainReceipt, chainInput: input },
        sourceProbe
      ),
      "AE_RETAINED_SVGA_ORACLE_OUTPUT_MISMATCH"
    );
  });

  await t.test("successor-package-substitution", async (t) => {
    const { fixture, input } = await createRetainedChainFixture(t, "exec-retained-svga-oracle-package-swap");
    const chainReceipt = await createAebRetainedBakeAuthorityChain(input);
    const publisher = new NodeAebRetainedBakeSvgaFragmentPublisher(fixture.authority);
    const sourceProbe = await publisher.publishSourceProbe({ chainReceipt, chainInput: input });
    await writeFile(
      path.join(fixture.taskRoot, input.published.publicationReceipt.successorPackage.relativePath),
      Buffer.from("substituted-successor-package")
    );

    await assertBakeError(
      () => createAebRetainedBakeSvgaFragmentOracleReport(
        fixture.authority,
        { chainReceipt, chainInput: input },
        sourceProbe
      ),
      "AE_RETAINED_SVGA_ORACLE_CHAIN_INVALID"
    );
  });

  await t.test("source-frame-substitution", async (t) => {
    const { fixture, input } = await createRetainedChainFixture(t, "exec-retained-svga-oracle-frame-swap");
    const chainReceipt = await createAebRetainedBakeAuthorityChain(input);
    const publisher = new NodeAebRetainedBakeSvgaFragmentPublisher(fixture.authority);
    const sourceProbe = await publisher.publishSourceProbe({ chainReceipt, chainInput: input });
    const frame = input.adapterInput.frames[0]!;
    await writeFile(path.join(fixture.taskRoot, frame.relativePath), deterministicFrame(frame.frameIndex + 1));

    await assertBakeError(
      () => createAebRetainedBakeSvgaFragmentOracleReport(
        fixture.authority,
        { chainReceipt, chainInput: input },
        sourceProbe
      ),
      "AE_RETAINED_SVGA_ORACLE_CHAIN_INVALID"
    );
  });

  await t.test("source-package-drift", async (t) => {
    const { fixture, input } = await createRetainedChainFixture(t, "exec-retained-svga-oracle-source-drift");
    const chainReceipt = await createAebRetainedBakeAuthorityChain(input);
    const publisher = new NodeAebRetainedBakeSvgaFragmentPublisher(fixture.authority);
    const sourceProbe = await publisher.publishSourceProbe({ chainReceipt, chainInput: input });
    await writeFile(fixture.packagePath, Buffer.from("source-package-drift"));

    await assertBakeError(
      () => createAebRetainedBakeSvgaFragmentOracleReport(
        fixture.authority,
        { chainReceipt, chainInput: input },
        sourceProbe
      ),
      "AE_RETAINED_SVGA_ORACLE_CHAIN_INVALID"
    );
  });
});

test("combined retained Bake source flow validates classification through F1 and standards-valid SVGA fragment", async (t) => {
  const { fixture, execution } = await createRetainedExecutionFixture(t, "exec-retained-combined-positive");
  const input = {
    execution,
    sourceIr: fixture.ir,
    successorFileName: "combined-successor-positive.json",
    hasher: fixture.hasher
  };
  const sourceProjectBefore = await readFile(fixture.projectPath);
  const sourcePackageBefore = await readFile(fixture.packagePath);
  const flow = new NodeAebRetainedBakeCombinedSourceFlow(fixture.authority);

  const report = await flow.run(input);
  const successorPath = path.join(fixture.taskRoot, report.package.successorPackageRelativePath);

  assert.equal(report.authorityState, "source_validated_combined_bake_host_session_ready");
  assert.deepEqual(report.classification.nativeLayerIds, ["layer-native-title"]);
  assert.deepEqual(report.classification.bakeRequiredLayerIds, ["layer-bake-glow"]);
  assert.deepEqual(report.classification.blockedLayerIds, []);
  assert.deepEqual(report.classification.preservedReplaceableElementIds, ["owner-title-slot"]);
  assert.equal(report.package.sourceProjectUnchanged, true);
  assert.equal(report.package.sourcePackageUnchanged, true);
  assert.equal(report.package.physicalSuccessorReopened, true);
  assert.equal(report.fragment.standardsValidSvgaFragment, true);
  assert.equal(report.fragment.nativeMergeRequired, true);
  assert.equal(report.fragment.fullCompositionEncoded, false);
  const fullComposition = (report as unknown as {
    fullComposition?: {
      standardsValidSvga: boolean;
      nativeMergeCompleted: boolean;
      fullCompositionEncoded: boolean;
      sourceLayerOrder: readonly string[];
      preservedNativePayloadHashes: readonly string[];
      preservedReplaceableElementIds: readonly string[];
      sourceTimebase: { startFrame: number; endFrameExclusive: number; fps: number };
    };
  }).fullComposition;
  assert.ok(fullComposition, "mixed retained Bake flow must publish a full-composition output after the fragment boundary");
  assert.equal(fullComposition.standardsValidSvga, true);
  assert.equal(fullComposition.nativeMergeCompleted, true);
  assert.equal(fullComposition.fullCompositionEncoded, true);
  assert.deepEqual(fullComposition.sourceLayerOrder, ["layer-native-title", "layer-bake-glow"]);
  assert.deepEqual(report.fullComposition.sourceLayerAuthority, [{
    layerId: "layer-native-title",
    plannerOutcome: "native",
    stackIndex: 0,
    activeRange: { startFrame: 10, endFrameExclusive: 11 }
  }, {
    layerId: "layer-bake-glow",
    plannerOutcome: "bake_required",
    stackIndex: 1,
    activeRange: { startFrame: 10, endFrameExclusive: 11 }
  }]);
  assert.equal(fullComposition.preservedNativePayloadHashes.length, 1);
  assert.deepEqual(fullComposition.preservedReplaceableElementIds, ["owner-title-slot"]);
  assert.deepEqual(fullComposition.sourceTimebase, { startFrame: 10, endFrameExclusive: 11, fps: 1 });
  assert.equal(report.fullComposition.validation.previewOrSaveAuthorized, false);
  const fullCompositionBytes = await readFile(path.join(
    fixture.taskRoot,
    report.fullComposition.output.relativePath
  ));
  assert.equal(fixture.hasher.hash(fullCompositionBytes).value, report.fullComposition.output.contentHash);
  const schema = await loadAebReviewedSvgaSchemaAuthority();
  const decoded = schema.reopenMovieEntity.toObject(
    schema.reopenMovieEntity.decode(inflateSync(fullCompositionBytes)),
    { bytes: Buffer, arrays: true, objects: true }
  ) as {
    params?: { frames?: number };
    images?: Record<string, Buffer>;
    sprites?: Array<{ imageKey?: string; frames?: Array<{
      alpha?: number;
      transform?: { a?: number; b?: number; c?: number; d?: number; tx?: number; ty?: number };
    }> }>;
  };
  assert.equal(decoded.params?.frames, 1);
  assert.deepEqual(Object.keys(decoded.images ?? {}).sort(), ["img_0", "img_1"]);
  assert.equal(decoded.sprites?.length, 2);
  assert.equal(decoded.sprites?.[0]?.imageKey, "img_0");
  assert.equal(decoded.sprites?.[0]?.frames?.[0]?.alpha, Math.fround(0.6));
  assert.notEqual(decoded.sprites?.[0]?.frames?.[0]?.transform?.tx, 0);
  assert.equal(decoded.sprites?.[1]?.imageKey, "img_1");
  assert.equal(decoded.sprites?.[1]?.frames?.[0]?.alpha, 1);
  assert.equal(report.authority.actualBakeAuthorityMinted, false);
  assert.equal(report.authority.runtimeProved, false);
  assert.equal(report.authority.realPreviewValidated, false);
  assert.equal(report.authority.saveAsBytesAuthorized, false);
  assert.deepEqual(await readFile(fixture.projectPath), sourceProjectBefore);
  assert.deepEqual(await readFile(fixture.packagePath), sourcePackageBefore);
  assert.ok((await readFile(successorPath)).byteLength > 0);
  assert.equal(await flow.verify(report), true);
  await writeR1B04EvidenceIfRequested({
    report,
    sourceIr: fixture.ir,
    sourceProjectBefore,
    sourceProjectAfter: await readFile(fixture.projectPath),
    sourcePackageBefore,
    sourcePackageAfter: await readFile(fixture.packagePath),
    successorBytes: await readFile(successorPath),
    fragmentBytes: await readFile(path.join(fixture.taskRoot, report.fragment.relativePath)),
    fullCompositionBytes
  });
});

test("retained Bake full-composition authority rejects stack, timebase, payload, resource, and identity drift", async (t) => {
  await t.test("native-payload-hash-drift", async (t) => {
    const { fixture, execution } = await createRetainedExecutionFixture(t, "exec-full-native-payload-hash");
    const sourceIr = structuredClone(fixture.ir);
    sourceIr.layers[0]!.nativePayload!.payloadHash = "0".repeat(64);
    await assertBakeError(
      () => new NodeAebRetainedBakeCombinedSourceFlow(fixture.authority).run({
        execution,
        sourceIr,
        successorFileName: "full-native-payload-hash.json",
        hasher: fixture.hasher
      }),
      "SOURCE_IR_NATIVE_PAYLOAD_HASH_INVALID"
    );
  });

  await t.test("duplicate-stack-index", async (t) => {
    const { fixture, execution } = await createRetainedExecutionFixture(t, "exec-full-duplicate-stack");
    const sourceIr = structuredClone(fixture.ir);
    sourceIr.layers[1]!.stackIndex = sourceIr.layers[0]!.stackIndex;
    await assertBakeError(
      () => new NodeAebRetainedBakeCombinedSourceFlow(fixture.authority).run({
        execution,
        sourceIr,
        successorFileName: "full-duplicate-stack.json",
        hasher: fixture.hasher
      }),
      "AE_RETAINED_FULL_COMPOSITION_INPUT_INVALID"
    );
  });

  await t.test("layer-timebase-drift", async (t) => {
    const { fixture, execution } = await createRetainedExecutionFixture(t, "exec-full-timebase-drift");
    const sourceIr = structuredClone(fixture.ir);
    sourceIr.layers[1]!.activeRange = { startFrame: 10, endFrameExclusive: 12 };
    await assertBakeError(
      () => new NodeAebRetainedBakeCombinedSourceFlow(fixture.authority).run({
        execution,
        sourceIr,
        successorFileName: "full-timebase-drift.json",
        hasher: fixture.hasher
      }),
      "AE_RETAINED_FULL_COMPOSITION_INPUT_INVALID"
    );
  });

  await t.test("native-resource-hash-drift", async (t) => {
    const { fixture, execution } = await createRetainedExecutionFixture(t, "exec-full-resource-hash-drift");
    const sourceIr = structuredClone(fixture.ir);
    sourceIr.resources[0]!.contentHash.value = "f".repeat(64);
    await assertBakeError(
      () => new NodeAebRetainedBakeCombinedSourceFlow(fixture.authority).run({
        execution,
        sourceIr,
        successorFileName: "full-resource-hash-drift.json",
        hasher: fixture.hasher
      }),
      "AE_RETAINED_NATIVE_RESOURCE_MISMATCH"
    );
  });

  await t.test("same-byte-full-output-replacement", async (t) => {
    const { fixture, execution } = await createRetainedExecutionFixture(t, "exec-full-output-replacement");
    const flow = new NodeAebRetainedBakeCombinedSourceFlow(fixture.authority);
    const report = await flow.run({
      execution,
      sourceIr: fixture.ir,
      successorFileName: "full-output-replacement.json",
      hasher: fixture.hasher
    });
    const outputPath = path.join(fixture.taskRoot, report.fullComposition.output.relativePath);
    const replacementPath = `${outputPath}.replaced`;
    const bytes = await readFile(outputPath);
    await rename(outputPath, replacementPath);
    await writeFile(outputPath, bytes, { mode: 0o600 });
    assert.equal(await flow.verify(report), false);
  });

  await t.test("preexisting-full-output", async (t) => {
    const { fixture, input } = await createRetainedChainFixture(t, "exec-full-output-collision");
    const chainReceipt = await createAebRetainedBakeAuthorityChain(input);
    const outputName = aebRetainedBakeFullCompositionFileName(chainReceipt.chainHash);
    const collisionBytes = Buffer.from("unowned-full-composition-collision");
    await writeFile(path.join(fixture.taskRoot, outputName), collisionBytes, { flag: "wx", mode: 0o600 });

    await assertBakeError(
      () => new NodeAebRetainedBakeFullCompositionPublisher(fixture.authority).publish({
        chainReceipt,
        chainInput: input,
        sourceIr: fixture.ir
      }),
      "AE_RETAINED_FULL_COMPOSITION_OUTPUT_EXISTS"
    );
    assert.deepEqual(await readFile(path.join(fixture.taskRoot, outputName)), collisionBytes);
    assert.equal((await taskNames(fixture)).some((name) => name.endsWith(".tmp")), false);
  });

  await t.test("same-byte-native-resource-replacement", async (t) => {
    let taskRoot = "";
    let replaced = false;
    const fixture = await createFixture(t, {
      executionId: "exec-full-native-resource-replacement",
      retainedSlice: true,
      authorityHooks: {
        async afterFileRead(relativePath) {
          if (relativePath !== "assets/native-title.png" || replaced) return;
          replaced = true;
          const resourcePath = path.join(taskRoot, relativePath);
          const displacedPath = `${resourcePath}.displaced`;
          const bytes = await readFile(resourcePath);
          await rename(resourcePath, displacedPath);
          await writeFile(resourcePath, bytes, { mode: 0o600 });
        }
      }
    });
    taskRoot = fixture.taskRoot;
    const execution = await createRetainedExecutionFromFixture(fixture);
    await assertBakeError(
      () => new NodeAebRetainedBakeCombinedSourceFlow(fixture.authority).run({
        execution,
        sourceIr: fixture.ir,
        successorFileName: "full-native-resource-replacement.json",
        hasher: fixture.hasher
      }),
      "AE_RETAINED_NATIVE_RESOURCE_PATH_SWAP_DETECTED"
    );
    assert.equal((await taskNames(fixture)).includes("full-native-resource-replacement.json"), false);
    assert.equal((await taskNames(fixture)).some((name) => name.endsWith(".svga")), false);
  });
});

test("combined retained Bake host session prepares exact main-lane inputs and completes the source-owned chain", async (t) => {
  const fixture = await createFixture(t, {
    executionId: "exec-retained-combined-host-session-positive",
    retainedSlice: true
  });
  const sourceProjectBefore = await readFile(fixture.projectPath);
  const sourcePackageBefore = await readFile(fixture.packagePath);
  const session = new NodeAebRetainedBakeCombinedHostSession(fixture.authority);
  const prepared = await session.prepare({
    plan: fixture.plan,
    sourceIr: fixture.ir,
    successorFileName: "combined-host-session-successor.json"
  });

  assert.equal(prepared.authorityState, "retained_bake_combined_host_input_prepared");
  assert.equal(prepared.taskId, fixture.job.task.taskId);
  assert.equal(prepared.executionId, fixture.plan.executionId);
  assert.equal(prepared.planHash, fixture.plan.planHash);
  assert.deepEqual(prepared.classification.nativeLayerIds, ["layer-native-title"]);
  assert.deepEqual(prepared.classification.bakeRequiredLayerIds, ["layer-bake-glow"]);
  assert.deepEqual(prepared.classification.preservedReplaceableElementIds, ["owner-title-slot"]);
  assert.equal(prepared.source.project.contentHash, fixture.plan.sourceFiles.projectContentHash);
  assert.equal(prepared.source.package.contentHash, fixture.plan.sourceFiles.packageContentHash);
  assert.deepEqual(prepared.host, AEB_RETAINED_AE_BAKE_HOST_DESCRIPTOR);
  assert.equal(prepared.runtimeHost.version, "26.3.0");
  assert.equal(prepared.runtimeHost.build, "26.3.0.87");
  assert.equal(prepared.runtimeHost.executableSha256, fixture.plan.host.executableHash);
  assert.equal(prepared.runtimeHost.executablePath.endsWith("/Contents/MacOS/After Effects"), true);
  assert.equal(prepared.expectedOutput.alphaMode, "straight");
  assert.equal(prepared.expectedOutput.fullCompositionRequired, true);
  assert.equal(prepared.expectedOutput.frames.length, 1);
  assert.equal(prepared.expectedOutput.frames[0]?.frameIndex, 10);
  assert.equal(JSON.stringify(prepared).includes(fixture.taskBase), false);
  assert.equal(NodeAebRetainedBakeCombinedHostSession.length, 1);
  assert.equal(session.run.length, 1);
  assert.equal(await session.verifyPrepared(prepared), true);
  assert.equal(await session.verifyPrepared(structuredClone(prepared)), false);

  const execution = await createRetainedExecutionFromFixture(fixture);
  const report = await session.runSourceValidation(prepared, execution);

  assert.equal(report.authorityState, "source_validated_combined_bake_host_session_ready");
  assert.equal(report.package.f1ReinsertionValidated, true);
  assert.equal(report.fragment.standardsValidSvgaFragment, true);
  assert.equal(report.fragment.nativeMergeRequired, true);
  assert.equal(report.fullComposition.fullCompositionEncoded, true);
  assert.equal(report.fullComposition.validation.previewOrSaveAuthorized, false);
  assert.equal(report.authority.actualBakeAuthorityMinted, false);
  assert.equal(report.authority.runtimeProved, false);
  assert.deepEqual(await readFile(fixture.projectPath), sourceProjectBefore);
  assert.deepEqual(await readFile(fixture.packagePath), sourcePackageBefore);
  const successorBytes = await readFile(path.join(fixture.taskRoot, report.package.successorPackageRelativePath));
  const fragmentBytes = await readFile(path.join(fixture.taskRoot, report.fragment.relativePath));
  const fullCompositionBytes = await readFile(path.join(
    fixture.taskRoot,
    report.fullComposition.output.relativePath
  ));
  assert.equal(fixture.hasher.hash(successorBytes).value, report.package.successorPackageContentHash);
  assert.equal(fixture.hasher.hash(fragmentBytes).value, report.fragment.contentHash);
  assert.equal(
    fixture.hasher.hash(fullCompositionBytes).value,
    report.fullComposition.output.contentHash
  );
  assert.equal(await session.verifyPrepared(prepared), false);
  await assertBakeError(
    () => session.runSourceValidation(prepared, execution),
    "AE_RETAINED_COMBINED_HOST_INPUT_REQUIRED"
  );
});

test("retained Bake panel host preserves the exact canonical root and publishes real source-validated outputs", async (t) => {
  const fixture = await createFixture(t, {
    executionId: "exec-retained-panel-host-positive",
    retainedSlice: true,
    taskBasePrefix: "auto-svga - retained-panel -"
  });
  await chmod(fixture.taskRoot, 0o700);
  const host = new NodeAebRetainedBakePanelHost();
  t.after(() => host.close());
  const sourceProjectBefore = await readFile(fixture.projectPath);
  const sourcePackageBefore = await readFile(fixture.packagePath);

  const scratch = await host.preparePilotScratch({
    outputRoot: fixture.taskRoot,
    taskId: fixture.job.task.taskId
  });
  assert.equal(scratch.status, "prepared");
  assert.equal(scratch.outputRoot.canonicalPath, fixture.taskRoot);
  assert.equal(scratch.outputRoot.canonicalPath.includes("auto-svga - retained-panel -"), true);
  assert.equal(scratch.outputRoot.canonicalPath.includes("autosvga"), false);
  assert.equal(scratch.outputRoot.mode, "0700");
  assert.equal(scratch.nextAction, "classify_and_export");
  assert.equal(scratch.authorityClaims.actualAeBakeAuthorityMinted, false);

  const prepared = await host.prepareRetainedExport(scratch, {
    job: fixture.job,
    planner: fixture.planner,
    sourceIr: fixture.ir,
    plan: fixture.plan,
    successorFileName: "panel-retained-successor.json"
  });
  assert.equal(prepared.status, "ready");
  assert.equal(prepared.outputRoot.canonicalPath, fixture.taskRoot);
  assert.deepEqual(prepared.classification.nativeLayerIds, ["layer-native-title"]);
  assert.deepEqual(prepared.classification.bakeRequiredLayerIds, ["layer-bake-glow"]);
  assert.deepEqual(prepared.classification.blocked, []);
  assert.equal(prepared.authorityClaims.actualAeBakeAuthorityMinted, false);

  const execution = await createRetainedExecutionFromFixture(fixture);
  const result = await host.completeSourceValidation(prepared, execution);
  assert.equal(result.status, "source_validated");
  assert.equal(result.outputRoot.canonicalPath, fixture.taskRoot);
  assert.equal(result.package.f1ReinsertionValidated, true);
  assert.equal(result.fragment.standardsValidSvgaFragment, true);
  assert.equal(result.fragment.nativeMergeRequired, true);
  assert.equal(result.fullComposition.standardsValidSvga, true);
  assert.equal(result.fullComposition.nativeMergeCompleted, true);
  assert.equal(result.fullComposition.fullCompositionEncoded, true);
  assert.equal(result.fullComposition.previewOrSaveAuthorized, false);
  assert.equal(result.authorityClaims.actualAeBakeAuthorityMinted, false);
  assert.equal(result.authorityClaims.previewOrSaveAuthorized, false);
  assert.equal(await host.verifySourceValidationResult(result), true);
  assert.deepEqual(await readFile(fixture.projectPath), sourceProjectBefore);
  assert.deepEqual(await readFile(fixture.packagePath), sourcePackageBefore);

  await assertBakeError(
    () => host.consumeRuntimeHandoff(result as never),
    "AEB_PANEL_RUNTIME_RESULT_REQUIRED"
  );
  const passShaped = structuredClone(result) as unknown as Record<string, unknown>;
  passShaped.status = "completed";
  passShaped.authorityClaims = {
    actualAeBakeAuthorityMinted: true,
    packageOutputAuthorityMinted: true,
    standardsValidSvgaFragmentAuthorityMinted: true,
    previewOrSaveAuthorized: true
  };
  await assertBakeError(
    () => host.consumeRuntimeHandoff(passShaped as never),
    "AEB_PANEL_RUNTIME_RESULT_REQUIRED"
  );

  await writeFile(
    path.join(fixture.taskRoot, result.fragment.relativePath),
    Buffer.alloc(result.fragment.encodedBytes, 0x5a)
  );
  assert.equal(await host.verifySourceValidationResult(result), false);
});

test("retained Bake panel host revokes output authority after same-byte source identity replacement", async (t) => {
  for (const sourceKind of ["project", "package"] as const) {
    await t.test(sourceKind, async (childT) => {
      const fixture = await createFixture(childT, {
        executionId: `exec-retained-panel-source-replacement-${sourceKind}`,
        retainedSlice: true,
        taskBasePrefix: `auto-svga - retained-source-${sourceKind} -`
      });
      await chmod(fixture.taskRoot, 0o700);
      const host = new NodeAebRetainedBakePanelHost();
      childT.after(() => host.close());
      const scratch = await host.preparePilotScratch({
        outputRoot: fixture.taskRoot,
        taskId: fixture.job.task.taskId
      });
      const ready = await host.prepareRetainedExport(scratch, {
        job: fixture.job,
        planner: fixture.planner,
        sourceIr: fixture.ir,
        plan: fixture.plan,
        successorFileName: `panel-source-${sourceKind}-successor.json`
      });
      assert.equal(ready.status, "ready");
      const result = await host.completeSourceValidation(
        ready,
        await createRetainedExecutionFromFixture(fixture)
      );
      assert.equal(await host.verifySourceValidationResult(result), true);

      const sourcePath = sourceKind === "project" ? fixture.projectPath : fixture.packagePath;
      const sourceBytes = await readFile(sourcePath);
      await rename(sourcePath, `${sourcePath}.displaced`);
      await writeFile(sourcePath, sourceBytes);
      assert.equal(await host.verifySourceValidationResult(result), false);
    });
  }
});

test("retained Bake panel host emits one normalized blocked result with zero generated authority", async (t) => {
  const fixture = await createFixture(t, {
    executionId: "exec-retained-panel-host-blocked",
    retainedSlice: true,
    taskBasePrefix: "auto-svga - retained-blocked -"
  });
  await chmod(fixture.taskRoot, 0o700);
  const host = new NodeAebRetainedBakePanelHost();
  t.after(() => host.close());
  const scratch = await host.preparePilotScratch({
    outputRoot: fixture.taskRoot,
    taskId: fixture.job.task.taskId
  });
  const namesBefore = await readdir(fixture.taskRoot);
  const planner: AebBakePlannerJoin = {
    ...structuredClone(fixture.planner),
    decisions: [
      { layerId: "layer-native-title", outcome: "native", reason: "image_transform_v0" },
      { layerId: "layer-bake-glow", outcome: "blocked", reason: "third_party_plugin" }
    ]
  };
  const sourceIr: AebFormatNeutralIr = {
    ...structuredClone(fixture.ir),
    layers: fixture.ir.layers.map((layer) => layer.layerId === "layer-bake-glow"
      ? { ...layer, plannerOutcome: "blocked" }
      : layer)
  };

  const result = await host.prepareRetainedExport(scratch, {
    job: fixture.job,
    planner,
    sourceIr,
    successorFileName: "must-not-exist.json"
  });
  assert.equal(result.status, "blocked");
  assert.deepEqual(result.classification.blocked, [{
    layerId: "layer-bake-glow",
    reason: "third_party_plugin"
  }]);
  assert.deepEqual(result.generatedOutputs, []);
  assert.deepEqual(result.authorityClaims, {
    actualAeBakeAuthorityMinted: false,
    packageOutputAuthorityMinted: false,
    standardsValidSvgaFragmentAuthorityMinted: false,
    fullCompositionOutputAuthorityMinted: false,
    previewOrSaveAuthorized: false
  });
  assert.deepEqual(await readdir(fixture.taskRoot), namesBefore);
  assert.deepEqual(await readFile(fixture.projectPath), fixture.projectBytes);
  assert.deepEqual(await readFile(fixture.packagePath), fixture.packageBytes);
  await assertBakeError(
    () => host.prepareRetainedExport(scratch, {
      job: fixture.job,
      planner,
      sourceIr,
      successorFileName: "replay-must-not-exist.json"
    }),
    "AEB_PANEL_SCRATCH_RESULT_REQUIRED"
  );
});

test("retained Bake panel host rejects noncanonical mode-wrong and cloned root authority", async (t) => {
  const fixture = await createFixture(t, {
    executionId: "exec-retained-panel-host-root-negative",
    retainedSlice: true,
    taskBasePrefix: "auto-svga - retained-root -"
  });
  const host = new NodeAebRetainedBakePanelHost();
  t.after(() => host.close());

  await chmod(fixture.taskRoot, 0o755);
  await assertBakeError(
    () => host.preparePilotScratch({ outputRoot: fixture.taskRoot, taskId: fixture.job.task.taskId }),
    "AEB_PANEL_OUTPUT_ROOT_MODE_INVALID"
  );
  await chmod(fixture.taskRoot, 0o700);
  await assertBakeError(
    () => host.preparePilotScratch({
      outputRoot: `${fixture.taskRoot}/../${fixture.job.task.taskId}`,
      taskId: fixture.job.task.taskId
    }),
    "AEB_PANEL_OUTPUT_ROOT_NONCANONICAL"
  );
  const scratch = await host.preparePilotScratch({
    outputRoot: fixture.taskRoot,
    taskId: fixture.job.task.taskId
  });
  await assertBakeError(
    () => host.prepareRetainedExport(structuredClone(scratch), {
      job: fixture.job,
      planner: fixture.planner,
      sourceIr: fixture.ir,
      plan: fixture.plan,
      successorFileName: "clone-must-not-run.json"
    }),
    "AEB_PANEL_SCRATCH_RESULT_REQUIRED"
  );

  const displacedRoot = `${fixture.taskRoot}-displaced`;
  await rename(fixture.taskRoot, displacedRoot);
  await mkdir(fixture.taskRoot, { mode: 0o700 });
  await assertBakeError(
    () => host.prepareRetainedExport(scratch, {
      job: fixture.job,
      planner: fixture.planner,
      sourceIr: fixture.ir,
      plan: fixture.plan,
      successorFileName: "replaced-root-must-not-run.json"
    }),
    "AEB_PANEL_OUTPUT_ROOT_CHANGED"
  );
});

test("retained Bake panel host rejects a prototype-replaced PASS-shaped runtime completion", async (t) => {
  const fixture = await createFixture(t, {
    executionId: "exec-retained-panel-host-prototype-forgery",
    retainedSlice: true,
    taskBasePrefix: "auto-svga - retained-forgery -"
  });
  await chmod(fixture.taskRoot, 0o700);
  const host = new NodeAebRetainedBakePanelHost();
  t.after(() => host.close());
  const scratch = await host.preparePilotScratch({
    outputRoot: fixture.taskRoot,
    taskId: fixture.job.task.taskId
  });
  const ready = await host.prepareRetainedExport(scratch, {
    job: fixture.job,
    planner: fixture.planner,
    sourceIr: fixture.ir,
    plan: fixture.plan,
    successorFileName: "panel-prototype-successor.json"
  });
  assert.equal(ready.status, "ready");
  const execution = await createRetainedExecutionFromFixture(fixture);
  const report = await new NodeAebRetainedBakeCombinedSourceFlow(fixture.authority).run({
    execution,
    sourceIr: fixture.ir,
    successorFileName: "panel-prototype-successor.json",
    hasher: fixture.hasher
  });
  const prototype = NodeAebRetainedBakeCombinedHostSession.prototype as unknown as {
    run(prepared: unknown): Promise<unknown>;
  };
  const originalRun = prototype.run;
  prototype.run = async () => ({ preparedInput: ready, execution, report });
  try {
    await assertBakeError(
      () => host.run(ready),
      "AEB_PANEL_RETAINED_RUNTIME_CAPABILITY_REQUIRED"
    );
  } finally {
    prototype.run = originalRun;
  }
});

test("Bake owner source flow owns synthetic execution and completes classification through F1 and SVGA", async (t) => {
  const { fixture, flow, input } = await createBakeOwnerSourceFixture(
    t,
    "exec-bake-owner-source-positive"
  );
  const projectBefore = await readFile(fixture.projectPath);
  const packageBefore = await readFile(fixture.packagePath);
  const report = await flow.run(input);

  assert.equal(report.authorityState, "source_validated_bake_owner_flow_ready");
  assert.equal(report.execution.mode, "synthetic_fixture");
  assert.equal(report.execution.actualAeRenderExecuted, false);
  assert.equal(report.package.f1ReinsertionValidated, true);
  assert.equal(report.fragment.standardsValidSvgaFragment, true);
  assert.equal(report.fragment.nativeMergeRequired, true);
  assert.equal(report.authority.actualBakeAuthorityMinted, false);
  assert.equal(report.authority.previewOrSaveAuthorized, false);
  assert.deepEqual(report.classification.nativeLayerIds, ["layer-native-title"]);
  assert.deepEqual(report.classification.bakeRequiredLayerIds, ["layer-bake-glow"]);
  assert.deepEqual(report.classification.preservedReplaceableElementIds, ["owner-title-slot"]);
  assert.deepEqual(await readFile(fixture.projectPath), projectBefore);
  assert.deepEqual(await readFile(fixture.packagePath), packageBefore);
  assert.equal(NodeAebBakeOwnerSourceFlow.length, 1);
  assert.equal(flow.run.length, 1);
  assert.equal(await flow.verify(report), true);
  assert.equal(await flow.verify(structuredClone(report)), false);
  const passShaped = structuredClone(report) as unknown as Record<string, unknown>;
  passShaped.authority = {
    sourceValidationOnly: false,
    actualBakeAuthorityMinted: true,
    packageRuntimeAuthorityMinted: true,
    previewOrSaveAuthorized: true,
    runtimeProved: true
  };
  assert.equal(await flow.verify(passShaped as unknown as typeof report), false);
});

test("Bake owner source flow snapshots public inputs before caller mutation can cross an await boundary", async (t) => {
  const { flow, input } = await createBakeOwnerSourceFixture(
    t,
    "exec-bake-owner-source-snapshot"
  );
  const expectedProjectHash = input.sourceProject.contentHash;
  const expectedFixtureId = input.fixtureId;
  const pending = flow.run(input);
  input.sourceProject.contentHash = "0".repeat(64);
  input.fixtureId = `${input.fixtureId}-caller-mutated`;
  const report = await pending;

  assert.equal(report.fixtureId, expectedFixtureId);
  assert.equal(report.package.sourceProjectContentHash, expectedProjectHash);
  assert.equal(await flow.verify(report), true);
});

test("Bake owner source flow encodes a bounded multi-frame SVGA timeline with content deduplication", async (t) => {
  await t.test("distinct-frame-timeline", async (t) => {
    const { fixture, flow, input } = await createBakeOwnerSequenceFixture(
      t,
      "exec-bake-owner-sequence-distinct"
    );
    const projectBefore = await readFile(fixture.projectPath);
    const packageBefore = await readFile(fixture.packagePath);
    const report = await flow.run(input);
    const sequenceReport = report as unknown as {
      manifest: { frameCount: number; uniqueContentCount: number; deduplicatedFrameCount: number };
      fragment: { timelineFrameCount: number; uniqueImageCount: number; spriteCount: number };
    };

    assert.equal(sequenceReport.manifest.frameCount, 2);
    assert.equal(sequenceReport.manifest.uniqueContentCount, 2);
    assert.equal(sequenceReport.manifest.deduplicatedFrameCount, 0);
    assert.equal(sequenceReport.fragment.timelineFrameCount, 2);
    assert.equal(sequenceReport.fragment.uniqueImageCount, 2);
    assert.equal(sequenceReport.fragment.spriteCount, 2);
    const movie = await reopenOwnerFragment(fixture, report.fragment.relativePath);
    assert.equal(movie.params?.frames, 2);
    assert.equal(Object.keys(movie.images ?? {}).length, 2);
    assert.equal(movie.sprites?.length, 2);
    assert.deepEqual(
      movie.sprites?.map((sprite) => sprite.frames?.map((frame) => frame.alpha).join("")).sort(),
      ["01", "10"]
    );
    assert.deepEqual(await readFile(fixture.projectPath), projectBefore);
    assert.deepEqual(await readFile(fixture.packagePath), packageBefore);
    assert.equal(await flow.verify(report), true);
  });

  await t.test("duplicate-frame-deduplication", async (t) => {
    const { fixture, flow, input } = await createBakeOwnerSequenceFixture(
      t,
      "exec-bake-owner-sequence-duplicate",
      { duplicateFrames: true }
    );
    const report = await flow.run(input);
    const sequenceReport = report as unknown as {
      manifest: { frameCount: number; uniqueContentCount: number; deduplicatedFrameCount: number };
      fragment: { timelineFrameCount: number; uniqueImageCount: number; spriteCount: number };
    };

    assert.equal(sequenceReport.manifest.frameCount, 2);
    assert.equal(sequenceReport.manifest.uniqueContentCount, 1);
    assert.equal(sequenceReport.manifest.deduplicatedFrameCount, 1);
    assert.equal(sequenceReport.fragment.timelineFrameCount, 2);
    assert.equal(sequenceReport.fragment.uniqueImageCount, 1);
    assert.equal(sequenceReport.fragment.spriteCount, 1);
    const movie = await reopenOwnerFragment(fixture, report.fragment.relativePath);
    assert.equal(movie.params?.frames, 2);
    assert.equal(Object.keys(movie.images ?? {}).length, 1);
    assert.equal(movie.sprites?.length, 1);
    assert.deepEqual(movie.sprites?.[0]?.frames?.map((frame) => frame.alpha), [1, 1]);
    assert.equal(await flow.verify(report), true);
  });
});

test("Bake owner multi-frame failure matrix stops incomplete over-bound and substituted timelines", async (t) => {
  await t.test("missing-second-frame", async (t) => {
    const { fixture, flow, input } = await createBakeOwnerSequenceFixture(
      t,
      "exec-bake-owner-sequence-missing"
    );
    await unlink(path.join(fixture.taskRoot, input.frames[1]!.relativePath));
    await assertBakeError(() => flow.run(input), "RESOURCE_MISSING");
    assert.equal((await taskNames(fixture)).includes(input.successorFileName), false);
    assert.equal((await taskNames(fixture)).some((name) => name.endsWith(".svga")), false);
  });

  await t.test("owner-sequence-frame-bound", async (t) => {
    const { fixture, flow, input } = await createBakeOwnerSequenceFixture(
      t,
      "exec-bake-owner-sequence-bound"
    );
    const frameCount = 9;
    const job = {
      ...input.job,
      timeRange: {
        ...input.job.timeRange,
        endFrameExclusive: input.job.timeRange.startFrame + frameCount
      },
      budgets: { ...input.job.budgets, maxFrames: frameCount }
    };
    const frames = Array.from({ length: frameCount }, (_, index) => ({
      frameIndex: job.timeRange.startFrame + index,
      relativePath: `frames/over-bound-${index}.png`
    }));
    await assertBakeError(() => flow.run({ ...input, job, frames }), "AEB_BAKE_OWNER_SCOPE_INVALID");
    assert.equal((await taskNames(fixture)).includes(input.successorFileName), false);
    assert.equal((await taskNames(fixture)).some((name) => name.endsWith(".svga")), false);
  });

  await t.test("second-frame-substitution-revokes-report", async (t) => {
    const { fixture, flow, input } = await createBakeOwnerSequenceFixture(
      t,
      "exec-bake-owner-sequence-substitution"
    );
    const sourcePackageBefore = await readFile(fixture.packagePath);
    const report = await flow.run(input);
    await writeFile(
      path.join(fixture.taskRoot, input.frames[1]!.relativePath),
      deterministicFrame(99)
    );
    assert.equal(await flow.verify(report), false);
    assert.deepEqual(await readFile(fixture.packagePath), sourcePackageBefore);
    assert.equal(report.authority.actualBakeAuthorityMinted, false);
    assert.equal(report.authority.previewOrSaveAuthorized, false);
  });
});

test("Bake owner source flow failure matrix rejects authority injection drift loss substitution and replay", async (t) => {
  await t.test("caller-authority-injection", async (t) => {
    const { fixture, flow, input } = await createBakeOwnerSourceFixture(t, "exec-owner-source-injection");
    const forged = {
      ...input,
      executionAuthority: { async verifyExecution() { return true; }, async verifyManifest() { return true; } },
      actualAeRenderExecuted: true
    } as unknown as RunAebBakeOwnerSourceFlowInput;
    await assertBakeError(() => flow.run(forged), "AEB_BAKE_OWNER_INPUT_INVALID");
    assert.equal((await taskNames(fixture)).includes(input.successorFileName), false);
    assert.equal((await taskNames(fixture)).some((name) => name.endsWith(".svga")), false);
  });

  await t.test("actual-mode-elevation", async (t) => {
    const { fixture, flow, input } = await createBakeOwnerSourceFixture(t, "exec-owner-source-actual-mode");
    const taskReceipt = { ...input.taskReceipt, producer: "after_effects" as const };
    await writeFile(path.join(fixture.taskRoot, ".aeb-bake-task.json"), JSON.stringify(taskReceipt));
    await assertBakeError(
      () => flow.run({ ...input, taskReceipt }),
      "AEB_BAKE_OWNER_SCOPE_INVALID"
    );
    assert.equal((await taskNames(fixture)).includes(input.successorFileName), false);
  });

  await t.test("replaceable-loss", async (t) => {
    const { fixture, flow, input } = await createBakeOwnerSourceFixture(t, "exec-owner-source-replaceable");
    const sourceIr = {
      ...input.sourceIr,
      layers: input.sourceIr.layers.map((layer) => ({ ...layer, replaceableElementIds: [] }))
    };
    await assertBakeError(
      () => flow.run({ ...input, sourceIr }),
      "AEB_BAKE_OWNER_SCOPE_INVALID"
    );
    assert.equal((await taskNames(fixture)).includes(input.successorFileName), false);
    assert.equal((await taskNames(fixture)).some((name) => name.endsWith(".svga")), false);
  });

  await t.test("source-project-drift", async (t) => {
    const { fixture, flow, input } = await createBakeOwnerSourceFixture(t, "exec-owner-source-drift");
    await writeFile(fixture.projectPath, Buffer.from("owner-source-project-drift"));
    await assertBakeError(
      () => flow.run(input),
      "AEB_BAKE_OWNER_SOURCE_HASH_MISMATCH"
    );
    assert.equal((await taskNames(fixture)).includes(input.successorFileName), false);
    assert.equal((await taskNames(fixture)).some((name) => name.endsWith(".svga")), false);
  });

  await t.test("frame-substitution", async (t) => {
    const { fixture, flow, input } = await createBakeOwnerSourceFixture(t, "exec-owner-source-frame");
    await writeFile(
      path.join(fixture.taskRoot, input.frames[0]!.relativePath),
      Buffer.from("not-a-task-owned-rgba-png")
    );
    await assertBakeError(() => flow.run(input), "RESOURCE_PNG_HEADER_INVALID");
    assert.equal((await taskNames(fixture)).includes(input.successorFileName), false);
    assert.equal((await taskNames(fixture)).some((name) => name.endsWith(".svga")), false);
  });

  await t.test("replay-and-output-substitution", async (t) => {
    const { fixture, flow, input } = await createBakeOwnerSourceFixture(t, "exec-owner-source-replay");
    const report = await flow.run(input);
    const successorPath = path.join(fixture.taskRoot, report.package.successorPackageRelativePath);
    const successorBefore = await readFile(successorPath);
    await assertBakeError(() => flow.run(input), "PUBLICATION_FAILED");
    assert.deepEqual(await readFile(successorPath), successorBefore);
    assert.equal(await flow.verify(report), true);
    await writeFile(
      path.join(fixture.taskRoot, report.fragment.relativePath),
      Buffer.alloc(report.fragment.encodedBytes, 0x5a)
    );
    assert.equal(await flow.verify(report), false);
    assert.equal(report.authority.actualBakeAuthorityMinted, false);
    assert.equal(report.authority.previewOrSaveAuthorized, false);
  });
});

test("combined retained Bake host-session input rejects clones drift and replaceable loss before authority", async (t) => {
  await t.test("clone-and-source-drift", async (t) => {
    const fixture = await createFixture(t, {
      executionId: "exec-retained-combined-host-session-drift",
      retainedSlice: true
    });
    const session = new NodeAebRetainedBakeCombinedHostSession(fixture.authority);
    const prepared = await session.prepare({
      plan: fixture.plan,
      sourceIr: fixture.ir,
      successorFileName: "combined-host-session-drift-successor.json"
    });
    const execution = await createRetainedExecutionFromFixture(fixture);

    await assertBakeError(
      () => session.runSourceValidation(structuredClone(prepared), execution),
      "AE_RETAINED_COMBINED_HOST_INPUT_REQUIRED"
    );
    await writeFile(fixture.projectPath, Buffer.from("source-project-drift-after-prepare"));
    await assertBakeError(
      () => session.runSourceValidation(prepared, execution),
      "AE_RETAINED_COMBINED_HOST_SOURCE_CHANGED"
    );
    assert.equal((await taskNames(fixture)).includes("combined-host-session-drift-successor.json"), false);
    assert.equal((await taskNames(fixture)).some((name) => name.endsWith(".svga")), false);
  });

  await t.test("replaceable-loss", async (t) => {
    const fixture = await createFixture(t, {
      executionId: "exec-retained-combined-host-session-replaceable",
      retainedSlice: true
    });
    const session = new NodeAebRetainedBakeCombinedHostSession(fixture.authority);
    const sourceIr = {
      ...fixture.ir,
      layers: fixture.ir.layers.map((layer) => ({ ...layer, replaceableElementIds: [] }))
    };

    await assertBakeError(
      () => session.prepare({
        plan: fixture.plan,
        sourceIr,
        successorFileName: "combined-host-session-replaceable-successor.json"
      }),
      "AE_RETAINED_COMBINED_HOST_CLASSIFICATION_INVALID"
    );
    assert.equal((await taskNames(fixture)).includes("combined-host-session-replaceable-successor.json"), false);
    assert.equal((await taskNames(fixture)).some((name) => name.endsWith(".svga")), false);
  });

  await t.test("preexisting-successor", async (t) => {
    const fixture = await createFixture(t, {
      executionId: "exec-retained-combined-host-session-existing",
      retainedSlice: true
    });
    const successorFileName = "combined-host-session-existing-successor.json";
    const existing = Buffer.from("existing-unowned-successor");
    await writeFile(path.join(fixture.taskRoot, successorFileName), existing, { flag: "wx" });
    const session = new NodeAebRetainedBakeCombinedHostSession(fixture.authority);

    await assertBakeError(
      () => session.prepare({ plan: fixture.plan, sourceIr: fixture.ir, successorFileName }),
      "AE_RETAINED_COMBINED_HOST_OUTPUT_EXISTS"
    );
    assert.deepEqual(await readFile(path.join(fixture.taskRoot, successorFileName)), existing);
    assert.equal((await taskNames(fixture)).some((name) => name.endsWith(".svga")), false);
  });

  await t.test("cross-owner-native-resource", async (t) => {
    const fixture = await createFixture(t, {
      executionId: "exec-retained-combined-host-session-resource-owner",
      retainedSlice: true
    });
    const sourceIr = {
      ...fixture.ir,
      resources: fixture.ir.resources.map((resource) => ({
        ...resource,
        ownerLayerId: "layer-bake-glow"
      }))
    };
    const session = new NodeAebRetainedBakeCombinedHostSession(fixture.authority);

    await assertBakeError(
      () => session.prepare({
        plan: fixture.plan,
        sourceIr,
        successorFileName: "combined-host-session-resource-owner-successor.json"
      }),
      "AE_RETAINED_COMBINED_HOST_CLASSIFICATION_INVALID"
    );
    assert.equal((await taskNames(fixture)).some((name) => name.endsWith(".svga")), false);
  });
});

test("combined retained Bake source flow rejects replay and stale output without changing protected packages", async (t) => {
  const { fixture, execution } = await createRetainedExecutionFixture(t, "exec-retained-combined-replay");
  const input = {
    execution,
    sourceIr: fixture.ir,
    successorFileName: "combined-successor-replay.json",
    hasher: fixture.hasher
  };
  const flow = new NodeAebRetainedBakeCombinedSourceFlow(fixture.authority);
  const report = await flow.run(input);
  const sourceBefore = await readFile(fixture.packagePath);
  const successorPath = path.join(fixture.taskRoot, report.package.successorPackageRelativePath);
  const successorBefore = await readFile(successorPath);

  await assertBakeError(() => flow.run(input), "PUBLICATION_FAILED");
  assert.equal(await flow.verify(report), true);
  const passShaped = structuredClone(report) as unknown as Record<string, unknown>;
  passShaped.authority = {
    ...(passShaped.authority as Record<string, unknown>),
    actualBakeAuthorityMinted: true,
    runtimeProved: true,
    realPreviewValidated: true,
    saveAsBytesAuthorized: true
  };
  assert.equal(
    await flow.verify(passShaped as unknown as typeof report),
    false
  );
  await writeFile(path.join(fixture.taskRoot, report.fragment.relativePath), Buffer.alloc(report.fragment.encodedBytes, 0x5a));
  assert.equal(await flow.verify(report), false);
  assert.deepEqual(await readFile(fixture.packagePath), sourceBefore);
  assert.deepEqual(await readFile(successorPath), successorBefore);
  assert.equal(report.authority.actualBakeAuthorityMinted, false);
});

test("combined retained Bake source flow rejects replaceable loss and source-immutability contradictions before output", async (t) => {
  await t.test("replaceable-loss", async (t) => {
    const { fixture, execution } = await createRetainedExecutionFixture(t, "exec-retained-combined-replaceable-loss");
    const input = {
      execution,
      sourceIr: {
        ...fixture.ir,
        layers: fixture.ir.layers.map((layer, index) =>
          index === 0 ? { ...layer, replaceableElementIds: [] } : layer)
      },
      successorFileName: "combined-successor-replaceable-loss.json",
      hasher: fixture.hasher
    };
    const flow = new NodeAebRetainedBakeCombinedSourceFlow(fixture.authority);

    await assertBakeError(() => flow.run(input), "AE_RETAINED_COMBINED_EXECUTION_INPUT_INVALID");

    assert.equal((await taskNames(fixture)).includes(input.successorFileName), false);
    assert.equal((await taskNames(fixture)).some((name) => name.endsWith(".svga")), false);
  });

  await t.test("source-immutability-contradiction", async (t) => {
    const { fixture, execution } = await createRetainedExecutionFixture(t, "exec-retained-combined-source-mutable");
    const forgedExecution = {
      ...execution,
      producerReceipt: {
        ...execution.producerReceipt,
        source: {
          ...execution.producerReceipt.source,
          project: {
            ...execution.producerReceipt.source.project,
            unchanged: false
          }
        }
      }
    } as unknown as AebBoundedAeBakeExecutionResult;
    const input = {
      execution: forgedExecution,
      sourceIr: fixture.ir,
      successorFileName: "combined-successor-source-mutable.json",
      hasher: fixture.hasher
    };
    const flow = new NodeAebRetainedBakeCombinedSourceFlow(fixture.authority);

    await assertBakeError(() => flow.run(input), "AE_RETAINED_COMBINED_EXECUTION_INPUT_INVALID");

    assert.equal((await taskNames(fixture)).includes(input.successorFileName), false);
    assert.equal((await taskNames(fixture)).some((name) => name.endsWith(".svga")), false);
  });
});

test("combined retained Bake source flow rolls its probe back when post-publication validation fails", async (t) => {
  const { fixture, execution } = await createRetainedExecutionFixture(t, "exec-retained-combined-rollback");
  const input = {
    execution,
    sourceIr: fixture.ir,
    successorFileName: "combined-successor-rollback.json",
    hasher: fixture.hasher
  };
  const sourceBefore = await readFile(fixture.packagePath);
  let outputReadCount = 0;
  const hookedAuthority = new NodeAebTaskRootAuthority({
    approvedTaskBase: fixture.taskBase,
    taskId: fixture.job.task.taskId,
    hooks: {
      async afterFileRead(relativePath) {
        if (!relativePath.endsWith(".svga")) return;
        outputReadCount += 1;
        if (outputReadCount === 4) {
          const outputPath = path.join(fixture.taskRoot, relativePath);
          const current = await readFile(outputPath);
          await writeFile(outputPath, Buffer.alloc(current.byteLength, 0x5a));
        }
      }
    }
  });
  t.after(() => hookedAuthority.close());
  const flow = new NodeAebRetainedBakeCombinedSourceFlow(hookedAuthority);

  await assertBakeError(
    () => flow.run(input),
    "AE_RETAINED_SVGA_ORACLE_OUTPUT_CHANGED_DURING_READ"
  );

  assert.equal(outputReadCount, 4);
  assert.equal((await taskNames(fixture)).includes(input.successorFileName), false);
  assert.equal((await taskNames(fixture)).some((name) => name.endsWith(".svga")), false);
  assert.deepEqual(await readFile(fixture.packagePath), sourceBefore);
});

test("combined retained Bake source flow detects final source-project drift and rolls generated outputs back", async (t) => {
  const { fixture, execution } = await createRetainedExecutionFixture(t, "exec-retained-combined-source-drift");
  const input = {
    execution,
    sourceIr: fixture.ir,
    successorFileName: "combined-successor-source-drift.json",
    hasher: fixture.hasher
  };
  const sourcePackageBefore = await readFile(fixture.packagePath);
  let sourceProjectReads = 0;
  const hookedAuthority = new NodeAebTaskRootAuthority({
    approvedTaskBase: fixture.taskBase,
    taskId: fixture.job.task.taskId,
    hooks: {
      async afterFileRead(relativePath) {
        if (relativePath !== fixture.plan.sourceFiles.projectRelativePath) return;
        sourceProjectReads += 1;
        await writeFile(fixture.projectPath, Buffer.from("external-source-project-drift"));
      }
    }
  });
  t.after(() => hookedAuthority.close());
  const flow = new NodeAebRetainedBakeCombinedSourceFlow(hookedAuthority);

  await assertBakeError(
    () => flow.run(input),
    "SOURCE_PROJECT_CHANGED_DURING_READ"
  );

  assert.equal(sourceProjectReads, 1);
  assert.equal((await taskNames(fixture)).includes(input.successorFileName), false);
  assert.equal((await taskNames(fixture)).some((name) => name.endsWith(".svga")), false);
  assert.deepEqual(await readFile(fixture.packagePath), sourcePackageBefore);
});

test("retained baked SVGA publication fails before output for stale chain, substituted frame, or PASS-shaped records alone", async (t) => {
  await t.test("method-complete-authority-lookalikes", async (t) => {
    const { fixture, input } = await createRetainedChainFixture(t, "exec-retained-svga-authority-lookalikes");
    const chainReceipt = await createAebRetainedBakeAuthorityChain(input);
    const forgedInput: CreateAebRetainedBakeAuthorityChainInput = {
      ...input,
      executionAuthority: {
        async verifyExecution() { return true; },
        async verifyManifest() { return true; }
      },
      publicationAuthority: {
        async verifyPublishedSuccessor() { return true; }
      }
    };
    const publisher = new NodeAebRetainedBakeSvgaFragmentPublisher(fixture.authority);
    await assertBakeError(
      () => publisher.publish({ chainReceipt, chainInput: forgedInput }),
      "AE_RETAINED_SVGA_PRIVATE_CAPABILITY_REQUIRED"
    );
    assert.equal((await taskNames(fixture)).some((name) => name.endsWith(".svga")), false);
  });

  await t.test("source-records-cannot-elevate-to-actual", async (t) => {
    const { fixture, input } = await createRetainedChainFixture(t, "exec-retained-svga-source-records-no-elevation");
    const chainReceipt = await createAebRetainedBakeAuthorityChain(input);
    const publisher = new NodeAebRetainedBakeSvgaFragmentPublisher(fixture.authority);
    await assertBakeError(
      () => publisher.publish({ chainReceipt, chainInput: input }),
      "AE_RETAINED_SVGA_PRIVATE_CAPABILITY_REQUIRED"
    );
    assert.equal((await taskNames(fixture)).some((name) => name.endsWith(".svga")), false);
  });

  await t.test("stale-chain", async (t) => {
    const { fixture, input } = await createRetainedChainFixture(t, "exec-retained-svga-stale-chain");
    const chainReceipt = await createAebRetainedBakeAuthorityChain(input);
    const staleReceipt = { ...chainReceipt, chainHash: "0".repeat(64) };
    const publisher = new NodeAebRetainedBakeSvgaFragmentPublisher(fixture.authority);
    await assertBakeError(
      () => publisher.publishSourceProbe({ chainReceipt: staleReceipt, chainInput: input }),
      "AE_RETAINED_CHAIN_RECEIPT_INVALID"
    );
    assert.equal((await taskNames(fixture)).some((name) => name.endsWith(".svga")), false);
  });

  await t.test("frame-substitution", async (t) => {
    const { fixture, input } = await createRetainedChainFixture(t, "exec-retained-svga-frame-substitution");
    const chainReceipt = await createAebRetainedBakeAuthorityChain(input);
    await writeFile(
      path.join(fixture.taskRoot, fixture.plan.output.frames[0]!.relativePath),
      deterministicFrame(fixture.plan.output.frames[0]!.frameIndex + 1)
    );
    const publisher = new NodeAebRetainedBakeSvgaFragmentPublisher(fixture.authority);
    await assertBakeError(
      () => publisher.publishSourceProbe({ chainReceipt, chainInput: input }),
      "AE_RETAINED_CHAIN_RECEIPT_INVALID"
    );
    assert.equal((await taskNames(fixture)).some((name) => name.endsWith(".svga")), false);
  });

  await t.test("records-without-live-authorities", async (t) => {
    const { fixture, input } = await createRetainedChainFixture(t, "exec-retained-svga-pass-shaped");
    const chainReceipt = structuredClone(await createAebRetainedBakeAuthorityChain(input));
    const shapedInput = structuredClone({
      plan: input.plan,
      producerReceipt: input.producerReceipt,
      cleanupReceipt: input.cleanupReceipt,
      executionReceipt: input.executionReceipt,
      manifest: input.manifest,
      published: input.published,
      adapterInput: input.adapterInput
    }) as unknown as CreateAebRetainedBakeAuthorityChainInput;
    const publisher = new NodeAebRetainedBakeSvgaFragmentPublisher(fixture.authority);
    await assertBakeError(
      () => publisher.publishSourceProbe({ chainReceipt, chainInput: shapedInput }),
      "AE_RETAINED_CHAIN_RECEIPT_INVALID"
    );
    assert.equal((await taskNames(fixture)).some((name) => name.endsWith(".svga")), false);
  });
});

test("retained baked SVGA publication is no-overwrite, rolls faults back, and detects post-publication substitution", async (t) => {
  await t.test("no-overwrite-and-tamper", async (t) => {
    const { fixture, input } = await createRetainedChainFixture(t, "exec-retained-svga-no-overwrite");
    const chainReceipt = await createAebRetainedBakeAuthorityChain(input);
    const publisher = new NodeAebRetainedBakeSvgaFragmentPublisher(fixture.authority);
    const published = await publisher.publishSourceProbe({ chainReceipt, chainInput: input });
    const outputPath = path.join(fixture.taskRoot, published.output.relativePath);
    const exactBytes = await readFile(outputPath);
    await assertBakeError(
      () => publisher.publishSourceProbe({ chainReceipt, chainInput: input }),
      "AE_RETAINED_SVGA_OUTPUT_EXISTS"
    );
    assert.deepEqual(await readFile(outputPath), exactBytes);
    await writeFile(outputPath, Buffer.from("substituted-svga"));
    assert.equal(await publisher.verifySourceProbe(published, { chainReceipt, chainInput: input }), false);
  });

  await t.test("preexisting-temp-is-preserved", async (t) => {
    const { fixture, input } = await createRetainedChainFixture(t, "exec-retained-svga-temp-collision");
    const chainReceipt = await createAebRetainedBakeAuthorityChain(input);
    const tempPath = path.join(fixture.taskRoot, `aeb-svga-probe-temp-${chainReceipt.chainHash.slice(0, 24)}.tmp`);
    const existingBytes = Buffer.from("preexisting-unowned-temp");
    await writeFile(tempPath, existingBytes, { flag: "wx" });
    const publisher = new NodeAebRetainedBakeSvgaFragmentPublisher(fixture.authority);
    await assertBakeError(
      () => publisher.publishSourceProbe({ chainReceipt, chainInput: input }),
      "AE_RETAINED_SVGA_TEMP_EXISTS"
    );
    assert.deepEqual(await readFile(tempPath), existingBytes);
    assert.equal((await taskNames(fixture)).some((name) => name.endsWith(".svga")), false);
  });

  await t.test("async-hasher-output-mutation-stops-before-probe-authority", async (t) => {
    const { fixture, input } = await createRetainedChainFixture(t, "exec-retained-svga-hasher-output-mutation");
    const chainReceipt = await createAebRetainedBakeAuthorityChain(input);
    const outputPath = path.join(
      fixture.taskRoot,
      aebRetainedBakeSvgaFragmentSourceProbeFileName(chainReceipt.chainHash)
    );
    const mutatingHasher = new OutputMutatingHasher(outputPath);
    const publisher = new NodeAebRetainedBakeSvgaFragmentPublisher(fixture.authority);
    await assertBakeError(
      () => publisher.publishSourceProbe({
        chainReceipt,
        chainInput: { ...input, hasher: mutatingHasher }
      }),
      "AE_RETAINED_SVGA_PROTECTED_OUTPUT_CHANGED"
    );
    assert.equal(mutatingHasher.mutated, true);
    assert.equal((await taskNames(fixture)).some((name) => name.endsWith(".svga")), false);
  });

  await t.test("source-probe rollback requires the original publisher-owned object and is single-use", async (t) => {
    const { fixture, input } = await createRetainedChainFixture(t, "exec-retained-svga-source-probe-revoke");
    const chainReceipt = await createAebRetainedBakeAuthorityChain(input);
    const publisher = new NodeAebRetainedBakeSvgaFragmentPublisher(fixture.authority);
    const sourceProbe = await publisher.publishSourceProbe({ chainReceipt, chainInput: input });
    const clonedProbe = structuredClone(sourceProbe);

    assert.equal(
      await publisher.revokeSourceProbe(clonedProbe, { chainReceipt, chainInput: input }),
      false
    );
    assert.equal(await publisher.verifySourceProbe(sourceProbe, { chainReceipt, chainInput: input }), true);
    assert.equal(
      await publisher.revokeSourceProbe(sourceProbe, { chainReceipt, chainInput: input }),
      true
    );
    assert.equal(
      await publisher.revokeSourceProbe(sourceProbe, { chainReceipt, chainInput: input }),
      false
    );
    assert.equal(await publisher.verifySourceProbe(sourceProbe, { chainReceipt, chainInput: input }), false);
  });

  for (const phase of ["write", "finalize", "cleanup", "verification"] as const) {
    await t.test(`${phase}-rollback`, async (t) => {
      const { fixture, input } = await createRetainedChainFixture(t, `exec-retained-svga-${phase}-rollback`);
      const chainReceipt = await createAebRetainedBakeAuthorityChain(input);
      const sourceBefore = await readFile(fixture.packagePath);
      const successorPath = path.join(
        fixture.taskRoot,
        input.published.publicationReceipt.successorPackage.relativePath
      );
      const successorBefore = await readFile(successorPath);
      const publisher = new NodeAebRetainedBakeSvgaFragmentPublisher(fixture.authority, {
        beforePhase(current) {
          if (current === phase) throw new Error(`injected-${phase}`);
        }
      });
      await assertBakeError(
        () => publisher.publishSourceProbe({ chainReceipt, chainInput: input }),
        "AE_RETAINED_SVGA_PUBLICATION_FAILED"
      );
      assert.equal((await taskNames(fixture)).some((name) => name.endsWith(".svga") || name.startsWith("aeb-svga-probe-temp-")), false);
      assert.deepEqual(await readFile(fixture.packagePath), sourceBefore);
      assert.deepEqual(await readFile(successorPath), successorBefore);
    });
  }
});

test("reviewed SVGA schema authority rejects substitution growth replacement and descriptor mismatch", async (t) => {
  const schemaBytes = await readFile(path.join(process.cwd(), "proto/svga.proto"));

  await t.test("exact-reviewed-copy", async (t) => {
    const root = await mkdtemp(path.join(os.tmpdir(), "aeb-svga-schema-exact-"));
    t.after(() => rm(root, { recursive: true, force: true }));
    const candidate = path.join(root, "svga.proto");
    await writeFile(candidate, schemaBytes, { mode: 0o600, flag: "wx" });
    const result = await runAebReviewedSvgaSchemaSourceProbe(candidate);
    assert.equal(result.valid, true);
    assert.equal(result.protoFileSha256, AEB_REVIEWED_SVGA_PROTO_FILE_SHA256);
    assert.equal(result.descriptorSha256, AEB_REVIEWED_SVGA_DESCRIPTOR_SHA256);
  });

  await t.test("field-number-substitution", async (t) => {
    const root = await mkdtemp(path.join(os.tmpdir(), "aeb-svga-schema-substitute-"));
    t.after(() => rm(root, { recursive: true, force: true }));
    const candidate = path.join(root, "svga.proto");
    const substituted = Buffer.from(schemaBytes.toString("utf8")
      .replace("map<string, bytes> images = 3;", "map<string, bytes> images = 8;")
      .replace("repeated SpriteEntity sprites = 4;", "repeated SpriteEntity sprites = 9;"));
    await writeFile(candidate, substituted, { mode: 0o600, flag: "wx" });
    const result = await runAebReviewedSvgaSchemaSourceProbe(candidate);
    assert.equal(result.valid, false);
    assert.equal(result.code, "SVGA_SCHEMA_FILE_HASH_MISMATCH");
  });

  await t.test("hard-link-alias", async (t) => {
    const root = await mkdtemp(path.join(os.tmpdir(), "aeb-svga-schema-hardlink-"));
    t.after(() => rm(root, { recursive: true, force: true }));
    const outside = path.join(root, "outside.proto");
    const candidate = path.join(root, "svga.proto");
    await writeFile(outside, schemaBytes, { mode: 0o600, flag: "wx" });
    await link(outside, candidate);
    const result = await runAebReviewedSvgaSchemaSourceProbe(candidate);
    assert.equal(result.valid, false);
    assert.equal(result.code, "SVGA_SCHEMA_FILE_IDENTITY_INVALID");
  });

  await t.test("post-read-growth", async (t) => {
    const root = await mkdtemp(path.join(os.tmpdir(), "aeb-svga-schema-growth-"));
    t.after(() => rm(root, { recursive: true, force: true }));
    const candidate = path.join(root, "svga.proto");
    await writeFile(candidate, schemaBytes, { mode: 0o600, flag: "wx" });
    const result = await runAebReviewedSvgaSchemaSourceProbe(candidate, {
      afterRead: () => appendFile(candidate, Buffer.from("\n// growth"))
    });
    assert.equal(result.valid, false);
    assert.equal(result.code, "SVGA_SCHEMA_FILE_CHANGED");
  });

  await t.test("post-read-replacement", async (t) => {
    const root = await mkdtemp(path.join(os.tmpdir(), "aeb-svga-schema-replace-"));
    t.after(() => rm(root, { recursive: true, force: true }));
    const candidate = path.join(root, "svga.proto");
    const displaced = path.join(root, "displaced.proto");
    await writeFile(candidate, schemaBytes, { mode: 0o600, flag: "wx" });
    const result = await runAebReviewedSvgaSchemaSourceProbe(candidate, {
      async afterRead() {
        await rename(candidate, displaced);
        await writeFile(candidate, schemaBytes, { mode: 0o600, flag: "wx" });
      }
    });
    assert.equal(result.valid, false);
    assert.equal(result.code, "SVGA_SCHEMA_FILE_CHANGED");
  });

  assert.equal(verifyAebReviewedSvgaDescriptorSourceProbe({ MovieEntity: { images: 8, sprites: 9 } }), false);
});

test("retained SVGA private capability internals are not runtime exports", async () => {
  const fragmentModule = await import("../hosts/aeb-node-retained-bake-svga-fragment-publisher.js");
  const executorModule = await import("../hosts/aeb-node-bounded-ae-bake-executor.js");
  const publicationModule = await import("../hosts/aeb-node-bake-package-publisher.js");
  assert.equal("retainedBakeSvgaCapabilities" in fragmentModule, false);
  assert.equal("publishedRetainedBakeSvgaAuthorities" in fragmentModule, false);
  assert.equal("publishedRetainedBakeSourceProbes" in fragmentModule, false);
  assert.equal("mintPrivateRetainedBakeSvgaCapability" in fragmentModule, false);
  assert.equal("retainedBakeExecutionAuthorities" in executorModule, false);
  assert.equal("retainedBakePublicationCapabilities" in publicationModule, false);
  assert.equal("publishedSuccessorFiles" in publicationModule, false);
});

test("retained Bake chain rejects stale or cross-boundary authority mutations", async (t) => {
  const cases: Array<{
    name: string;
    code: string;
    mutate(input: CreateAebRetainedBakeAuthorityChainInput): Promise<void> | void;
  }> = [
    {
      name: "stale-retained-host-evidence",
      code: "AE_RETAINED_TRANSACTION_INVALID",
      mutate(input) {
        input.producerReceipt = structuredClone(input.producerReceipt);
        input.producerReceipt.scanReceipt = structuredClone(input.producerReceipt.scanReceipt);
        (input.producerReceipt.scanReceipt as AebAeRetainedTransactionReceipt).runtimePlanHash = "7".repeat(64);
      }
    },
    {
      name: "project-source-mismatch",
      code: "AE_RETAINED_TRANSACTION_INVALID",
      mutate(input) {
        input.producerReceipt = structuredClone(input.producerReceipt);
        input.producerReceipt.scanReceipt = structuredClone(input.producerReceipt.scanReceipt);
        (input.producerReceipt.scanReceipt as AebAeRetainedTransactionReceipt).source.projectContentHash = "8".repeat(64);
      }
    },
    {
      name: "comp-mismatch",
      code: "AE_RETAINED_TRANSACTION_INVALID",
      mutate(input) {
        input.producerReceipt = structuredClone(input.producerReceipt);
        input.producerReceipt.scanReceipt = structuredClone(input.producerReceipt.scanReceipt);
        (input.producerReceipt.scanReceipt as AebAeRetainedTransactionReceipt).composition.productId = "cross-comp";
      }
    },
    {
      name: "raw-frame-substitution",
      code: "AE_RETAINED_MANIFEST_BINDING_INVALID",
      mutate(input) {
        input.manifest = structuredClone(input.manifest);
        input.manifest.frames[0]!.contentHash.value = "9".repeat(64);
      }
    },
    {
      name: "output-package-substitution",
      code: "AE_RETAINED_PUBLICATION_BINDING_INVALID",
      mutate(input) {
        input.published = structuredClone(input.published);
        input.published.publicationReceipt.successorPackage.contentHash.value = "a".repeat(64);
      }
    },
    {
      name: "wrong-f1-adapter-package-binding",
      code: "AE_RETAINED_SVGA_ADAPTER_BINDING_INVALID",
      mutate(input) {
        input.adapterInput = structuredClone(input.adapterInput);
        input.adapterInput.packageId = "cross-package";
      }
    },
    {
      name: "preview-save-elevation",
      code: "AE_RETAINED_PREVIEW_SAVE_ELEVATION_FORBIDDEN",
      mutate(input) {
        input.adapterInput = structuredClone(input.adapterInput);
        input.adapterInput.validation.realPreviewValidated = true as false;
      }
    }
  ];
  for (const item of cases) {
    await t.test(item.name, async (t) => {
      const { input } = await createRetainedChainFixture(t, `exec-retained-chain-${item.name}`);
      await item.mutate(input);
      await assertBakeError(() => createAebRetainedBakeAuthorityChain(input), item.code);
    });
  }
});

test("public PASS-shaped retained records cannot consume executor authority before F1 chain entry", async (t) => {
  const fixture = await createFixture(t, { executionId: "exec-retained-chain-public-pass", retainedSlice: true });
  const host = passShapedRetainedHostFor(fixture);
  await assertBakeError(
    () => new NodeAebBoundedAeBakeExecutor(fixture.authority, fixture.hasher).execute(fixture.plan, host),
    "AE_RETAINED_TRANSACTION_AUTHORITY_REQUIRED"
  );
  assert.equal(consumeAebRetainedAeTransactionCapability(await host.lastResult(), fixture.plan), false);
  assert.equal((await taskNames(fixture)).some((name) => name.includes("successor")), false);
  await assertNoExecutionResidue(fixture);
});

test("concrete JSX scanner binds the controlled subset and blocks unsupported families", async () => {
  const jsxPath = path.resolve("tools/aeb/f2/aeb-bounded-bake-adapter.jsx");
  const source = await readFile(jsxPath, "utf8");
  for (const required of [
    "aeb-ae-bake-execution-plan-v2",
    "aeb-ae-controlled-comp-scan-request-v2",
    "aeb-ae-controlled-comp-scan-output-v2",
    "aeb-ae-scratch-project-binding-v1",
    "com.adobe.AfterEffects.application",
    "AE_UNSUPPORTED_3D_CAMERA",
    "AE_UNSUPPORTED_AUDIO",
    "AE_UNSUPPORTED_PLUGIN",
    "AE_UNSUPPORTED_MASK_MODE",
    "AE_UNSUPPORTED_PRECOMP_DEPTH",
    "expressionSampling: \"ae_rasterized\"",
    "AE_CONTROLLED_FEATURE_DRIFT",
    "AE_EXISTING_PROJECT_FORBIDDEN",
    "findComposition(plan.composition.id, plan.composition.name)",
    "findTargetLayer(comp, plan.composition.targetLayers[index])",
    "renderQueue.items.add(comp)",
    "app.project.save(new File(request.scratchProjectPath))"
  ]) assert.equal(source.includes(required), true, required);
  assert.equal(source.includes("clearExistingRenderQueueItems"), false);
  assert.equal(source.includes("renderQueue.items.remove"), false);
});

test("CR-001 legacy exact scanner and ID-bound renderer remain non-actual", async (t) => {
  const fixture = await createFixture(t, { executionId: "exec-cr001-scanner-chain" });
  await assertBakeError(
    () => new NodeAebBoundedAeBakeExecutor(fixture.authority, fixture.hasher).execute(
      fixture.plan,
      concreteHostFor(fixture)
    ),
    "AE_RETAINED_TRANSACTION_AUTHORITY_REQUIRED"
  );
  await assertNoExecutionResidue(fixture);
});

test("CR-001R replacing the scanned scratch project at the same path revokes execution authority", async (t) => {
  const fixture = await createFixture(t, { executionId: "exec-cr001r-project-swap" });
  const delegate = new DeterministicAerenderRunner("success", fixture.outsideFramePath);
  const runner: AebAeSyntheticProcessRunner = {
    async run(request) {
      if (request.args.includes("-rqindex")) {
        const projectPath = argAfter(request.args, "-project");
        await rename(projectPath, `${projectPath}.scanned`);
        await writeFile(projectPath, Buffer.from("replacement-project-with-same-rqindex"));
      }
      return delegate.run(request);
    }
  };
  await assert.rejects(
    () => new NodeAebBoundedAeBakeExecutor(fixture.authority, fixture.hasher).execute(
      fixture.plan,
      hostFor(fixture, runner)
    ),
    (error: unknown) => error instanceof AebAeBakeExecutionError
  );
  await assertNoExecutionResidue(fixture);
});

test("CR-001R scratch-project mutation and alias matrix rejects before producer authority", async (t) => {
  const cases = [
    {
      name: "in-place-content-change",
      async mutate(projectPath: string) { await appendFile(projectPath, "\nQUEUE_REORDERED"); }
    },
    {
      name: "rename-replace-inode-drift",
      async mutate(projectPath: string) {
        await rename(projectPath, `${projectPath}.scanned`);
        await writeFile(projectPath, "replacement-project");
      }
    },
    {
      name: "hardlink-nlink-drift",
      async mutate(projectPath: string) { await link(projectPath, `${projectPath}.alias`); }
    },
    {
      name: "symlink-alias",
      async mutate(projectPath: string) {
        await rename(projectPath, `${projectPath}.scanned`);
        await symlink(`${projectPath}.scanned`, projectPath);
      }
    },
    {
      name: "post-render-restore-attempt",
      restore: true,
      async mutate(projectPath: string) {
        await rename(projectPath, `${projectPath}.scanned`);
        await writeFile(projectPath, "temporary-project-with-valid-queue-index");
      }
    }
  ];
  for (const item of cases) {
    await t.test(item.name, async (t) => {
      const fixture = await createFixture(t, { executionId: `exec-cr001r-${item.name}` });
      const delegate = new DeterministicAerenderRunner("success", fixture.outsideFramePath);
      const runner: AebAeSyntheticProcessRunner = {
        async run(request) {
          if (!request.args.includes("-rqindex")) return delegate.run(request);
          const projectPath = argAfter(request.args, "-project");
          await item.mutate(projectPath);
          const result = await delegate.run(request);
          if (item.restore) {
            await unlink(projectPath);
            await rename(`${projectPath}.scanned`, projectPath);
          }
          return result;
        }
      };
      await assert.rejects(
        () => new NodeAebBoundedAeBakeExecutor(fixture.authority, fixture.hasher).execute(
          fixture.plan,
          hostFor(fixture, runner)
        ),
        (error: unknown) => error instanceof AebAeBakeExecutionError
      );
      await assertNoExecutionResidue(fixture);
    });
  }
});

test("CR-001 malformed, stale, duplicate-name, and feature-drift scans stop before render authority", async (t) => {
  const cases: Array<{
    name: string;
    fault?: ScannerFault;
    mutate?: (output: AebAeControlledScanOutput) => void;
  }> = [
    { name: "missing", fault: "missing" },
    { name: "malformed", fault: "malformed" },
    { name: "stale-plan", mutate(output) { output.planHash = "f".repeat(64); } },
    { name: "cross-execution", mutate(output) { output.executionId = "exec-other-authority"; } },
    { name: "wrong-source", mutate(output) { output.producerSourceHash = "e".repeat(64); } },
    {
      name: "stale-scratch-request",
      mutate(output) { output.scratchProjectBefore.pathDigest = "d".repeat(64); }
    },
    {
      name: "duplicate-name-wrong-id",
      mutate(output) { output.composition = { id: "202", name: output.composition.name }; }
    },
    {
      name: "wrong-target-layer",
      mutate(output) { output.targetLayers = [{ ...output.targetLayers[0], aeLayerId: "999" }]; }
    },
    {
      name: "feature-inventory-drift",
      mutate(output) {
        output.controlledFeatures = {
          ...output.controlledFeatures,
          effectMatchNames: ["ADBE Drop Shadow"]
        };
      }
    }
  ];
  for (const item of cases) {
    await t.test(item.name, async (t) => {
      const fixture = await createFixture(t, { executionId: `exec-cr001-${item.name}` });
      const runner = new DeterministicAerenderRunner(
        "success",
        fixture.outsideFramePath,
        item.mutate,
        item.fault
      );
      await assert.rejects(
        () => new NodeAebBoundedAeBakeExecutor(fixture.authority, fixture.hasher).execute(
          fixture.plan,
          hostFor(fixture, runner)
        ),
        (error: unknown) => error instanceof AebAeBakeExecutionError
      );
      assert.equal(runner.requests.length, 1);
      assert.equal(runner.requests.some((request) => request.args.includes("-rqindex")), false);
      await assertNoExecutionResidue(fixture);
    });
  }
});

test("CR-002 partial self-hashed producer cannot mint actual AE authority", async (t) => {
  const fixture = await createFixture(t, { executionId: "exec-cr002-partial-producer" });
  const executionModule = await import("../workbench/aeb-ae-bake-execution.js");
  assert.equal("createAebBakeExecutionReceiptFromProducer" in executionModule, false);
  const partial = { planHash: fixture.plan.planHash, receiptHash: "" };
  partial.receiptHash = await hashCanonical(fixture.hasher, { planHash: partial.planHash });
  assert.equal(await verifyAebAeBakeProducerReceipt(
    fixture.plan,
    partial as AebAeBakeProducerReceipt,
    undefined as unknown as AebAeBakeCleanupReceipt,
    fixture.hasher
  ), false);
  await assertNoExecutionResidue(fixture);
});

test("CR-002R arbitrary injected runner cannot mint actual AE authority", async (t) => {
  const fixture = await createFixture(t, { executionId: "exec-cr002r-arbitrary-runner" });
  const runner = new DeterministicAerenderRunner("success", fixture.outsideFramePath);
  await assertBakeError(
    () => new NodeAebBoundedAeBakeExecutor(fixture.authority, fixture.hasher).execute(
      fixture.plan,
      hostFor(fixture, runner)
    ),
    "AE_RETAINED_TRANSACTION_AUTHORITY_REQUIRED"
  );
  assert.equal(runner.calls, 2);
  await assertNoExecutionResidue(fixture);
});

test("CR-001R/002R split scanner-renderer adapter cannot mint actual AE authority", async (t) => {
  const fixture = await createFixture(t, { executionId: "exec-cr002r-closed-constructor" });
  const injectedRunner = new DeterministicAerenderRunner("success", fixture.outsideFramePath);
  const host = Reflect.construct(NodeAebAerenderHostAdapter, [
    fixture.plan.host,
    {
      renderExecutablePath: fixture.executablePath,
      scriptExecutablePath: fixture.scriptExecutablePath,
      producerSourcePath: fixture.producerSourcePath
    },
    fixture.hasher,
    injectedRunner
  ]) as NodeAebAerenderHostAdapter;
  await assertBakeError(
    () => new NodeAebBoundedAeBakeExecutor(fixture.authority, fixture.hasher).execute(
      fixture.plan,
      host
    ),
    "AE_RETAINED_TRANSACTION_AUTHORITY_REQUIRED"
  );
  assert.equal(NodeAebAerenderHostAdapter.length, 3);
  assert.equal(injectedRunner.calls, 0);
  await assertNoExecutionResidue(fixture);
});

test("CR-002R reflected public evidence cannot clone concrete process capability", async (t) => {
  const fixture = await createFixture(t, { executionId: "exec-cr002r-cloned-evidence" });
  const concreteHost = concreteHostFor(fixture);
  const clonedEvidenceHost: AebAeBakeHostAdapter = {
    descriptor: concreteHost.descriptor,
    async render(request) {
      return structuredClone(await concreteHost.render(request));
    }
  };
  await assertBakeError(
    () => new NodeAebBoundedAeBakeExecutor(fixture.authority, fixture.hasher).execute(
      fixture.plan,
      clonedEvidenceHost
    ),
    "AE_RETAINED_TRANSACTION_AUTHORITY_REQUIRED"
  );
  await assertNoExecutionResidue(fixture);
});

test("CR-002R concrete process authority factories are absent from runtime exports", async () => {
  const hostModule = await import("../hosts/aeb-node-aerender-host-adapter.js");
  const executorModule = await import("../hosts/aeb-node-bounded-ae-bake-executor.js");
  assert.equal("NodeAebChildProcessRunner" in hostModule, false);
  assert.equal("NodeAebAeExecutionAuthority" in executorModule, false);
  assert.equal("createAebAeConcreteProcessCapability" in hostModule, false);
  assert.equal("mintAebAeExecutionAuthority" in executorModule, false);
});

test("CR-003 child process receives no inherited sentinel environment", async () => {
  const key = "AUTO_SVGA_AEB_F2_REVIEW_SENTINEL";
  const previous = process.env[key];
  process.env[key] = "inherited-secret-probe";
  const lines: string[] = [];
  try {
    const result = await runAebAeClosedChildProcessSourceProbe({
      executablePath: process.execPath,
      args: ["-e", `console.log(process.env.${key} || "absent")`],
      cwd: os.tmpdir(),
      environment: { PATH: "/usr/bin:/bin", LANG: "C" },
      signal: new AbortController().signal,
      onStdoutLine(line) { lines.push(line); }
    });
    assert.equal(result.exitCode, 0);
    assert.deepEqual(lines, ["absent"]);
  } finally {
    if (previous === undefined) delete process.env[key];
    else process.env[key] = previous;
  }
});

test("CR-003 stdout rejection reaps a SIGTERM-resistant owned child", async () => {
  let childPid = 0;
  try {
    await assert.rejects(() => runAebAeClosedChildProcessSourceProbe({
      executablePath: process.execPath,
      args: ["-e", [
        "process.on('SIGTERM', () => {});",
        "console.log('PID:' + process.pid);",
        "setTimeout(() => process.stdout.write('x'.repeat(70 * 1024) + '\\n'), 20);",
        "setInterval(() => {}, 1000);"
      ].join("")],
      cwd: os.tmpdir(),
      environment: { PATH: "/usr/bin:/bin", LANG: "C" },
      signal: new AbortController().signal,
      onStdoutLine(line) {
        if (line.startsWith("PID:")) childPid = Number(line.slice(4));
      }
    }), /bounded-aerender-stdout-line-exceeded/);
    assert.ok(childPid > 0);
    assert.equal(isPidAlive(childPid), false);
  } finally {
    if (childPid > 0 && isPidAlive(childPid)) {
      process.kill(childPid, "SIGKILL");
      await waitForPidExit(childPid);
    }
  }
});

test("CR-003 cancel, timeout, and progress callback faults reap before promise rejection", async (t) => {
  const root = await mkdtemp(path.join(os.tmpdir(), "auto-svga-aeb-child-reap-"));
  t.after(async () => rm(root, { recursive: true, force: true }));
  for (const mode of ["cancel", "timeout", "progress-callback"] as const) {
    await t.test(mode, async () => {
      const marker = path.join(root, `${mode}.txt`);
      await writeFile(marker, "");
      const controller = new AbortController();
      let childPid = 0;
      const action = runAebAeClosedChildProcessSourceProbe({
        executablePath: process.execPath,
        args: ["-e", [
          "const fs=require('fs');",
          "const marker=process.argv[1];",
          "process.on('SIGTERM', () => {});",
          "console.log('PID:' + process.pid);",
          "setInterval(() => { fs.appendFileSync(marker, 'x'); console.log('PROGRESS:1'); }, 10);"
        ].join(""), marker],
        cwd: root,
        environment: { PATH: "/usr/bin:/bin", LANG: "C" },
        signal: controller.signal,
        onStdoutLine(line) {
          if (line.startsWith("PID:")) {
            childPid = Number(line.slice(4));
            if (mode !== "progress-callback") controller.abort(new Error(mode));
          } else if (mode === "progress-callback" && line.startsWith("PROGRESS:")) {
            throw new Error("injected-progress-callback-fault");
          }
        }
      });
      await assert.rejects(action);
      assert.ok(childPid > 0);
      assert.equal(isPidAlive(childPid), false);
      const bytesAtRejection = (await readFile(marker)).byteLength;
      await new Promise((resolve) => setTimeout(resolve, 50));
      assert.equal((await readFile(marker)).byteLength, bytesAtRejection);
    });
  }
});

test("CR-004 cumulative decoded budget rejects before host access", async (t) => {
  const fixture = await createFixture(t, { executionId: "exec-cr004-total-budget" });
  assert.equal(await verifyAebAeBakeExecutionPlan(fixture.plan, fixture.hasher), true);
  const impossible = await rehashPlan({
    ...fixture.plan,
    job: {
      ...fixture.plan.job,
      budgets: { ...fixture.plan.job.budgets, maxDecodedRgbaBytes: 127 }
    }
  }, fixture.hasher);
  assert.equal(await verifyAebAeBakeExecutionPlan(impossible, fixture.hasher), false);
  const runner = new DeterministicAerenderRunner("success", fixture.outsideFramePath);
  await assertBakeError(
    () => new NodeAebBoundedAeBakeExecutor(fixture.authority, fixture.hasher).execute(
      impossible,
      hostFor(fixture, runner, impossible.host)
    ),
    "AE_EXECUTION_PLAN_INVALID"
  );
  assert.equal(runner.calls, 0);
  await assertNoExecutionResidue(fixture);

  const packageImpossible = await rehashPlan({
    ...fixture.plan,
    job: {
      ...fixture.plan.job,
      budgets: { ...fixture.plan.job.budgets, maxPackageBytes: 64 * 1024 }
    }
  }, fixture.hasher);
  assert.equal(await verifyAebAeBakeExecutionPlan(packageImpossible, fixture.hasher), false);
  const packageRunner = new DeterministicAerenderRunner("success", fixture.outsideFramePath);
  await assertBakeError(
    () => new NodeAebBoundedAeBakeExecutor(fixture.authority, fixture.hasher).execute(
      packageImpossible,
      hostFor(fixture, packageRunner, packageImpossible.host)
    ),
    "AE_EXECUTION_PLAN_INVALID"
  );
  assert.equal(packageRunner.calls, 0);
});

interface Fixture {
  hasher: Sha256ResourceHasher;
  taskBase: string;
  taskRoot: string;
  authority: NodeAebTaskRootAuthority;
  executablePath: string;
  scriptExecutablePath: string;
  producerSourcePath: string;
  outsideFramePath: string;
  projectPath: string;
  packagePath: string;
  projectBytes: Buffer;
  packageBytes: Buffer;
  job: AebBakeJob;
  planner: AebBakePlannerJoin;
  taskReceipt: AebBakeTaskReceipt;
  plan: AebAeBakeExecutionPlan;
  ir: AebFormatNeutralIr;
}

interface RetainedChainFixture {
  fixture: Fixture;
  input: CreateAebRetainedBakeAuthorityChainInput;
}

interface RetainedExecutionFixture {
  fixture: Fixture;
  execution: AebBoundedAeBakeExecutionResult;
}

async function createFixture(
  t: test.TestContext,
  options: {
    executionId?: string;
    timeoutMs?: number;
    authorityHooks?: AebTaskRootAuthorityHooks;
    retainedSlice?: boolean;
    taskBasePrefix?: string;
  } = {}
): Promise<Fixture> {
  const hasher = new Sha256ResourceHasher();
  const taskBase = await realpath(await mkdtemp(path.join(
    os.tmpdir(),
    options.taskBasePrefix ?? "auto-svga-aeb-f2-base-"
  )));
  const taskId = "task-complex-comp-f2";
  const taskRoot = path.join(taskBase, taskId);
  await mkdir(taskRoot);
  const projectBytes = Buffer.from("task-owned-complex-ae-project-fixture-v1");
  const packageBytes = Buffer.from(JSON.stringify({ schemaVersion: "synthetic-aeb-source-package-v1", packageId: "package-complex-f2" }));
  const executableBytes = concreteRendererExecutable();
  const scriptExecutableBytes = concreteScannerExecutable();
  const projectHash = hasher.hash(projectBytes).value;
  const packageHash = hasher.hash(packageBytes).value;
  const executableHash = hasher.hash(executableBytes).value;
  const scriptExecutableHash = hasher.hash(scriptExecutableBytes).value;
  const jsxSource = await readFile(path.resolve("tools/aeb/f2/aeb-bounded-bake-adapter.jsx"));
  const producerSourcePath = path.resolve("tools/aeb/f2/aeb-bounded-bake-adapter.jsx");
  const producerSourceHash = hasher.hash(jsxSource).value;
  const projectPath = path.join(taskRoot, "source-project.aep");
  const packagePath = path.join(taskRoot, "source-package.json");
  const executablePath = path.join(taskBase, "aerender-fixture");
  const scriptExecutablePath = path.join(taskBase, "afterfx-fixture");
  const outsideFramePath = path.join(taskBase, "outside-frame.png");
  await writeFile(projectPath, projectBytes);
  await writeFile(packagePath, packageBytes);
  await writeFile(executablePath, executableBytes, { mode: 0o700 });
  await writeFile(scriptExecutablePath, scriptExecutableBytes, { mode: 0o700 });
  await writeFile(outsideFramePath, deterministicFrame(10));
  const nativeResourceBytes = deterministicFrame(77);
  const nativeResourceHash = hasher.hash(nativeResourceBytes).value;
  await mkdir(path.join(taskRoot, "assets"));
  await writeFile(path.join(taskRoot, "assets/native-title.png"), nativeResourceBytes, { mode: 0o600 });

  const job: AebBakeJob = {
    schemaVersion: "aeb-bake-job-v1",
    jobId: "job-complex-comp-f2",
    packageId: "package-complex-f2",
    source: {
      compositionId: "comp-f2-main",
      sourceFingerprint: projectHash,
      scanDigest: "b".repeat(64),
      plannerDigest: "c".repeat(64)
    },
    target: {
      kind: "precomp",
      sourceId: "precomp-effect-mask-expression",
      layerIds: ["layer-bake-glow"],
      replaceableElementIds: []
    },
    timeRange: { startFrame: 10, endFrameExclusive: options.retainedSlice ? 11 : 12 },
    fps: options.retainedSlice ? 1 : 30,
    canvas: { width: 4, height: 4 },
    alphaMode: "straight",
    bbox: { mode: "full_canvas", x: 0, y: 0, width: 4, height: 4 },
    budgets: {
      maxFrames: options.retainedSlice ? 1 : 2,
      maxEncodedBytes: 64 * 1024,
      maxDecodedRgbaBytes: options.retainedSlice ? 64 : 128,
      maxPackageBytes: 128 * 1024
    },
    task: { taskId, receiptId: "receipt-complex-comp-f2" },
    safety: {
      sourceProjectMutationAllowed: false,
      replaceablePolicy: "preserve",
      cleanupRequired: true,
      rollbackReceiptRequired: true
    }
  };
  const planner: AebBakePlannerJoin = {
    schemaVersion: "aeb-bake-planner-join-v1",
    jobId: job.jobId,
    sourceFingerprint: job.source.sourceFingerprint,
    scanDigest: job.source.scanDigest,
    plannerDigest: job.source.plannerDigest,
    decisions: [
      { layerId: "layer-native-title", outcome: "native", reason: "image_transform_v0" },
      { layerId: "layer-bake-glow", outcome: "bake_required", reason: "controlled_effect_mask_expression" }
    ]
  };
  const taskReceipt: AebBakeTaskReceipt = {
    schemaVersion: "aeb-bake-task-receipt-v1",
    taskId,
    receiptId: job.task.receiptId,
    jobId: job.jobId,
    packageId: job.packageId,
    sourceFingerprint: job.source.sourceFingerprint,
    outputDirectory: ".",
    cleanupPolicy: "delete_task_root_after_consumption",
    rollbackPolicy: "preserve_source_package",
    sourceProjectMutationAllowed: false,
    producer: "after_effects"
  };
  await writeFile(path.join(taskRoot, ".aeb-bake-task.json"), JSON.stringify(taskReceipt));
  const plan = await createAebAeBakeExecutionPlan({
    executionId: options.executionId ?? "exec-controlled-001",
    job,
    planner,
    taskReceipt,
    taskRootName: taskId,
    sourceFiles: {
      projectRelativePath: "source-project.aep",
      projectContentHash: projectHash,
      projectMaxBytes: 1024,
      packageRelativePath: "source-package.json",
      packageContentHash: packageHash,
      packageMaxBytes: 1024
    },
    composition: {
      id: "101",
      name: options.retainedSlice ? "AEB3_F2_S1_RETAINED_FIXTURE" : "AEB_F2_Controlled_Comp",
      targetLayers: [{
        layerId: "layer-bake-glow",
        aeLayerId: "201",
        name: "layer-bake-glow"
      }]
    },
    controlledFeatures: {
      twoDOnly: true,
      precompDepth: 1,
      effectMatchNames: options.retainedSlice ? ["ADBE Fill"] : ["ADBE Gaussian Blur 2"],
      maskModes: ["add"],
      expressionCount: 1,
      expressionSampling: "ae_rasterized",
      audio: false,
      threeD: false,
      camera: false,
      thirdPartyPlugins: false,
      unknownHostCapabilities: false
    },
    host: options.retainedSlice ? { ...AEB_RETAINED_AE_BAKE_HOST_DESCRIPTOR } : {
      applicationId: "com.adobe.AfterEffects.application",
      version: "26.3.0",
      build: "26.3.0.87",
      executableHash,
      scriptExecutableHash,
      producerSourceHash
    },
    render: {
      renderSettingsTemplate: "Best Settings",
      outputModuleTemplate: "Auto SVGA RGBA Straight PNG",
      alphaMode: "straight",
      timeoutMs: options.timeoutMs ?? 2_000
    }
  }, hasher);
  const authority = new NodeAebTaskRootAuthority({ approvedTaskBase: taskBase, taskId, hooks: options.authorityHooks });
  const nativePayloadWithoutHash = {
    schemaVersion: "aeb-native-layer-payload-v1" as const,
    resourceId: "resource-native-title",
    imageKey: "aeb_native_title",
    width: 4,
    height: 4,
    anchor: { x: 1, y: 2 },
    transform: { x: 3, y: 2, scaleX: 1.25, scaleY: 0.75, rotation: 15, opacity: 0.8 },
    keyframes: [{ frame: 10, x: 2.5, opacity: 0.6 }]
  };
  const ir: AebFormatNeutralIr = {
    schemaVersion: "aeb-format-neutral-ir-v1",
    packageId: job.packageId,
    source: { ...job.source },
    composition: { canvas: { ...job.canvas }, fps: job.fps, timeRange: { ...job.timeRange } },
    layers: [
      {
        layerId: "layer-native-title",
        sourceId: "source-native-title",
        plannerOutcome: "native",
        replaceableElementIds: ["owner-title-slot"],
        nativePayloadRef: "native-payload-title",
        stackIndex: 0,
        activeRange: { ...job.timeRange },
        nativePayload: {
          ...nativePayloadWithoutHash,
          payloadHash: await hashCanonical(hasher, nativePayloadWithoutHash)
        }
      },
      {
        layerId: "layer-bake-glow",
        sourceId: job.target.sourceId,
        plannerOutcome: "bake_required",
        replaceableElementIds: [],
        stackIndex: 1,
        activeRange: { ...job.timeRange }
      }
    ],
    resources: [{
      resourceId: "resource-native-title",
      relativePath: "assets/native-title.png",
      contentHash: { algorithm: "sha256", value: nativeResourceHash, scope: "encoded_bytes" },
      ownerLayerId: "layer-native-title"
    }]
  };
  t.after(async () => {
    await authority.close();
    await rm(taskBase, { recursive: true, force: true });
  });
  return {
    hasher,
    taskBase,
    taskRoot,
    authority,
    executablePath,
    scriptExecutablePath,
    producerSourcePath,
    outsideFramePath,
    projectPath,
    packagePath,
    projectBytes,
    packageBytes,
    job,
    planner,
    taskReceipt,
    plan,
    ir
  };
}

async function createRetainedExecutionFixture(
  t: test.TestContext,
  executionId: string
): Promise<RetainedExecutionFixture> {
  const fixture = await createFixture(t, { executionId, retainedSlice: true });
  const execution = await createRetainedExecutionFromFixture(fixture);
  return { fixture, execution };
}

async function createBakeOwnerSourceFixture(
  t: test.TestContext,
  executionId: string
): Promise<{
  fixture: Fixture;
  flow: NodeAebBakeOwnerSourceFlow;
  input: RunAebBakeOwnerSourceFlowInput;
}> {
  const fixture = await createFixture(t, { executionId, retainedSlice: true });
  const taskReceipt: AebBakeTaskReceipt = {
    ...fixture.taskReceipt,
    producer: "synthetic_fixture"
  };
  await writeFile(path.join(fixture.taskRoot, ".aeb-bake-task.json"), JSON.stringify(taskReceipt));
  await mkdir(path.join(fixture.taskRoot, fixture.plan.output.framesDirectory));
  await writeFile(
    path.join(fixture.taskRoot, fixture.plan.output.frames[0]!.relativePath),
    deterministicFrame(fixture.plan.output.frames[0]!.frameIndex),
    { flag: "wx" }
  );
  return {
    fixture,
    flow: new NodeAebBakeOwnerSourceFlow(fixture.authority),
    input: {
      job: fixture.job,
      planner: fixture.planner,
      taskReceipt,
      frames: fixture.plan.output.frames,
      sourceIr: fixture.ir,
      fixtureId: `owner-source-${executionId}`,
      sourceProject: {
        relativePath: fixture.plan.sourceFiles.projectRelativePath,
        contentHash: fixture.plan.sourceFiles.projectContentHash,
        maxBytes: fixture.plan.sourceFiles.projectMaxBytes
      },
      sourcePackage: {
        relativePath: fixture.plan.sourceFiles.packageRelativePath,
        contentHash: fixture.plan.sourceFiles.packageContentHash,
        maxBytes: fixture.plan.sourceFiles.packageMaxBytes
      },
      successorFileName: `owner-source-${executionId}.json`
    }
  };
}

async function createBakeOwnerSequenceFixture(
  t: test.TestContext,
  executionId: string,
  options: { duplicateFrames?: boolean } = {}
): Promise<{
  fixture: Fixture;
  flow: NodeAebBakeOwnerSourceFlow;
  input: RunAebBakeOwnerSourceFlowInput;
}> {
  const fixture = await createFixture(t, { executionId });
  const taskReceipt: AebBakeTaskReceipt = {
    ...fixture.taskReceipt,
    producer: "synthetic_fixture"
  };
  await writeFile(path.join(fixture.taskRoot, ".aeb-bake-task.json"), JSON.stringify(taskReceipt));
  await mkdir(path.join(fixture.taskRoot, fixture.plan.output.framesDirectory));
  const firstFrame = deterministicFrame(fixture.plan.output.frames[0]!.frameIndex);
  for (const [index, frame] of fixture.plan.output.frames.entries()) {
    await writeFile(
      path.join(fixture.taskRoot, frame.relativePath),
      options.duplicateFrames ? firstFrame : deterministicFrame(frame.frameIndex),
      { flag: "wx" }
    );
    assert.equal(frame.frameIndex, fixture.job.timeRange.startFrame + index);
  }
  return {
    fixture,
    flow: new NodeAebBakeOwnerSourceFlow(fixture.authority),
    input: {
      job: fixture.job,
      planner: fixture.planner,
      taskReceipt,
      frames: fixture.plan.output.frames,
      sourceIr: fixture.ir,
      fixtureId: `owner-sequence-${executionId}`,
      sourceProject: {
        relativePath: fixture.plan.sourceFiles.projectRelativePath,
        contentHash: fixture.plan.sourceFiles.projectContentHash,
        maxBytes: fixture.plan.sourceFiles.projectMaxBytes
      },
      sourcePackage: {
        relativePath: fixture.plan.sourceFiles.packageRelativePath,
        contentHash: fixture.plan.sourceFiles.packageContentHash,
        maxBytes: fixture.plan.sourceFiles.packageMaxBytes
      },
      successorFileName: `owner-sequence-${executionId}.json`
    }
  };
}

async function createRetainedExecutionFromFixture(
  fixture: Fixture
): Promise<AebBoundedAeBakeExecutionResult> {
  const framesDirectory = path.join(fixture.taskRoot, fixture.plan.output.framesDirectory);
  await mkdir(framesDirectory);
  const frameSource = fixture.plan.output.frames[0]!;
  const frameBytes = deterministicFrame(frameSource.frameIndex);
  await writeFile(path.join(fixture.taskRoot, frameSource.relativePath), frameBytes, { flag: "wx" });

  const reader = new NodeAebBakeResourceReader(fixture.authority);
  const frame = await reader.readFrame(frameSource, {
    width: fixture.job.canvas.width,
    height: fixture.job.canvas.height,
    maxEncodedBytes: fixture.job.budgets.maxEncodedBytes,
    maxDecodedRgbaBytes: fixture.job.budgets.maxDecodedRgbaBytes
  });
  const retainedReceipt = await passShapedRetainedReceipt(fixture);
  const sourceProject = await fixture.authority.readBoundedTaskFile(
    fixture.plan.sourceFiles.projectRelativePath,
    fixture.plan.sourceFiles.projectMaxBytes,
    "SOURCE_PROJECT"
  );
  const sourcePackage = await fixture.authority.readBoundedTaskFile(
    fixture.plan.sourceFiles.packageRelativePath,
    fixture.plan.sourceFiles.packageMaxBytes,
    "SOURCE_PACKAGE"
  );

  const cleanupWithoutHash: Omit<AebAeBakeCleanupReceipt, "receiptHash"> = {
    schemaVersion: "aeb-ae-bake-cleanup-receipt-v1",
    executionId: fixture.plan.executionId,
    taskId: fixture.job.task.taskId,
    jobId: fixture.job.jobId,
    planHash: fixture.plan.planHash,
    outcome: "success",
    phase: "cleanup",
    workDirectory: fixture.plan.output.workDirectory,
    framesDirectory: fixture.plan.output.framesDirectory,
    workDirectoryRemoved: true,
    partialFramesRemoved: false,
    planRemoved: false,
    temporaryRenderItemsRemoved: true,
    sourceProjectUnchanged: true,
    sourcePackageUnchanged: true
  };
  const cleanupReceipt: AebAeBakeCleanupReceipt = {
    ...cleanupWithoutHash,
    receiptHash: await hashCanonical(fixture.hasher, cleanupWithoutHash)
  };
  const progressDigest = await hashCanonical(fixture.hasher, [
    { phase: "rendering", completedFrames: 1, totalFrames: 1 }
  ]);
  const producerWithoutHash: Omit<AebAeBakeProducerReceipt, "receiptHash"> = {
    schemaVersion: "aeb-ae-bake-producer-receipt-v3",
    executionId: fixture.plan.executionId,
    planHash: fixture.plan.planHash,
    jobId: fixture.job.jobId,
    packageId: fixture.job.packageId,
    sourceFingerprint: fixture.job.source.sourceFingerprint,
    scanDigest: fixture.job.source.scanDigest,
    plannerDigest: fixture.job.source.plannerDigest,
    taskId: fixture.job.task.taskId,
    taskReceiptId: fixture.job.task.receiptId,
    target: {
      compositionId: fixture.plan.composition.id,
      compositionName: fixture.plan.composition.name,
      sourceId: fixture.job.target.sourceId,
      layerIds: [...fixture.job.target.layerIds].sort()
    },
    timing: {
      startFrame: fixture.job.timeRange.startFrame,
      endFrameExclusive: fixture.job.timeRange.endFrameExclusive,
      fps: fixture.job.fps
    },
    canvas: { ...fixture.job.canvas },
    alphaMode: "straight",
    host: { ...fixture.plan.host },
    scanReceipt: retainedReceipt,
    hostExecution: await createAebAeRetainedHostExecutionEvidence(fixture.plan, retainedReceipt, fixture.hasher),
    source: {
      project: {
        relativePath: fixture.plan.sourceFiles.projectRelativePath,
        contentHash: fixture.plan.sourceFiles.projectContentHash,
        preIdentityDigest: sourceProject.identityDigest,
        postIdentityDigest: sourceProject.identityDigest,
        unchanged: true
      },
      package: {
        relativePath: fixture.plan.sourceFiles.packageRelativePath,
        contentHash: fixture.plan.sourceFiles.packageContentHash,
        preIdentityDigest: sourcePackage.identityDigest,
        postIdentityDigest: sourcePackage.identityDigest,
        unchanged: true
      }
    },
    output: {
      frames: [{
        frameIndex: frameSource.frameIndex,
        relativePath: frameSource.relativePath,
        contentHash: fixture.hasher.hash(frame.bytes).value,
        encodedBytes: frame.encodedBytes,
        decodedRgbaBytes: frame.decodedRgbaBytes,
        width: frame.width,
        height: frame.height
      }],
      totalEncodedBytes: frame.encodedBytes,
      totalDecodedRgbaBytes: frame.decodedRgbaBytes
    },
    execution: {
      state: "completed",
      processStarted: true,
      hostCompleted: true,
      exitCode: 0,
      cancelled: false,
      timedOut: false,
      progressDigest
    },
    cleanupReceiptHash: cleanupReceipt.receiptHash
  };
  const producerReceipt: AebAeBakeProducerReceipt = {
    ...producerWithoutHash,
    receiptHash: await hashCanonical(fixture.hasher, producerWithoutHash)
  };
  assert.equal(await verifyAebAeBakeProducerReceipt(fixture.plan, producerReceipt, cleanupReceipt, fixture.hasher), true);

  const frameInventoryDigest = await hashCanonical(
    fixture.hasher,
    fixture.plan.output.frames
      .map((source) => ({ frameIndex: source.frameIndex, relativePath: source.relativePath }))
      .sort((left, right) => left.frameIndex - right.frameIndex)
  );
  const executionWithoutHash: Omit<AebBakeExecutionReceipt, "receiptHash"> = {
    schemaVersion: "aeb-bake-execution-receipt-v1",
    mode: "after_effects",
    jobId: fixture.job.jobId,
    taskId: fixture.job.task.taskId,
    taskReceiptId: fixture.job.task.receiptId,
    sourceFingerprint: fixture.job.source.sourceFingerprint,
    scanDigest: fixture.job.source.scanDigest,
    plannerDigest: fixture.job.source.plannerDigest,
    frameInventoryDigest,
    actualAeRenderExecuted: true,
    evidence: {
      kind: "after_effects",
      hostSessionId: fixture.plan.executionId,
      aeVersion: `${fixture.plan.host.version}+${fixture.plan.host.build}`,
      scriptDigest: fixture.plan.host.producerSourceHash,
      renderReceiptDigest: producerReceipt.receiptHash
    }
  };
  const executionReceipt: AebBakeExecutionReceipt = {
    ...executionWithoutHash,
    receiptHash: await hashCanonical(fixture.hasher, executionWithoutHash)
  };
  const executionAuthority: AebBakeExecutionAuthority = {
    async verifyExecution(input) {
      if (input.executionReceipt.receiptHash !== executionReceipt.receiptHash
        || input.job.jobId !== fixture.job.jobId
        || input.taskReceipt.receiptId !== fixture.taskReceipt.receiptId
        || input.frames.length !== fixture.plan.output.frames.length
        || !await verifyAebAeBakeProducerReceipt(fixture.plan, producerReceipt, cleanupReceipt, fixture.hasher)) {
        return false;
      }
      const currentFrame = await reader.readFrame(frameSource, {
        width: fixture.job.canvas.width,
        height: fixture.job.canvas.height,
        maxEncodedBytes: fixture.job.budgets.maxEncodedBytes,
        maxDecodedRgbaBytes: fixture.job.budgets.maxDecodedRgbaBytes
      });
      return fixture.hasher.hash(currentFrame.bytes).value === producerReceipt.output.frames[0]!.contentHash;
    },
    async verifyManifest(manifest: AebBakeManifest) {
      return manifest.execution.receiptHash === executionReceipt.receiptHash
        && manifest.execution.actualAeRenderExecuted === true
        && manifest.frames.length === producerReceipt.output.frames.length
        && manifest.frames.every((item, index) => {
          const producerFrame = producerReceipt.output.frames[index]!;
          return item.frameIndex === producerFrame.frameIndex
            && item.relativePath === producerFrame.relativePath
            && item.contentHash.value === producerFrame.contentHash;
        });
    }
  };
  return {
    plan: fixture.plan,
    frames: fixture.plan.output.frames,
    producerReceipt,
    cleanupReceipt,
    executionReceipt,
    executionAuthority,
    progress: [{ phase: "rendering", completedFrames: 1, totalFrames: 1 }]
  };
}

async function createRetainedChainFixture(
  t: test.TestContext,
  executionId: string
): Promise<RetainedChainFixture> {
  const { fixture, execution } = await createRetainedExecutionFixture(t, executionId);
  const reader = new NodeAebBakeResourceReader(fixture.authority);
  const {
    producerReceipt,
    cleanupReceipt,
    executionReceipt,
    executionAuthority
  } = execution;
  const manifest = await buildAebBakeManifest({
    job: fixture.job,
    planner: fixture.planner,
    taskReceipt: fixture.taskReceipt,
    frames: fixture.plan.output.frames,
    executionReceipt,
    executionAuthority,
    reader,
    hasher: fixture.hasher
  });
  const bundle = await reinsertAebBakePackage(fixture.ir, manifest, fixture.hasher, executionAuthority);
  const publisher = new NodeAebBakePackagePublisher(fixture.authority, {}, executionAuthority);
  const published = await publisher.publish({
    bundle,
    sourcePackageRelativePath: fixture.plan.sourceFiles.packageRelativePath,
    expectedSourcePackageHash: fixture.plan.sourceFiles.packageContentHash,
    successorFileName: `successor-${executionId}.json`,
    maxSourcePackageBytes: fixture.plan.sourceFiles.packageMaxBytes,
    maxSuccessorPackageBytes: fixture.job.budgets.maxPackageBytes,
    hasher: fixture.hasher
  });
  const adapterInput = await createSvgaAebBakeAdapterInput(
    published,
    fixture.hasher,
    publisher,
    executionAuthority
  );
  return {
    fixture,
    input: {
      plan: fixture.plan,
      producerReceipt,
      cleanupReceipt,
      executionReceipt,
      executionAuthority,
      manifest,
      published,
      publicationAuthority: publisher,
      adapterInput,
      hasher: fixture.hasher
    }
  };
}

class DeterministicAerenderRunner implements AebAeSyntheticProcessRunner {
  calls = 0;
  requests: AebAeSyntheticProcessRunRequest[] = [];

  constructor(
    private readonly behavior: RunnerBehavior,
    private readonly outsideFramePath: string,
    private readonly mutateScan?: (output: AebAeControlledScanOutput) => void,
    private readonly scannerFault?: ScannerFault
  ) {}

  async run(request: AebAeSyntheticProcessRunRequest): Promise<AebAeSyntheticProcessRunResult> {
    this.calls += 1;
    this.requests.push(request);
    if (this.behavior === "hang") {
      if (!request.signal.aborted) {
        await new Promise<void>((resolve) => request.signal.addEventListener("abort", () => resolve(), { once: true }));
      }
      return { started: true, exitCode: null, signal: "SIGTERM", forcedTermination: false };
    }
    if (request.args[0] === "-r") {
      const requestPath = request.environment.AUTO_SVGA_AEB_F2_SCAN_REQUEST;
      const resultPath = request.environment.AUTO_SVGA_AEB_F2_SCAN_RESULT;
      assert.ok(requestPath);
      assert.ok(resultPath);
      const scanRequest = JSON.parse(await readFile(requestPath, "utf8")) as {
        plan: AebAeBakeExecutionPlan;
        scratchProjectBefore: AebAeControlledScanOutput["scratchProjectBefore"];
        scratchProjectPath: string;
      };
      const plan = scanRequest.plan;
      if (this.scannerFault === "missing") {
        return { started: true, exitCode: 0, signal: null, forcedTermination: false };
      }
      if (this.scannerFault === "malformed") {
        await writeFile(resultPath, "{", { flag: "wx" });
        return { started: true, exitCode: 0, signal: null, forcedTermination: false };
      }
      await appendFile(scanRequest.scratchProjectPath, `\nAEB_RENDER_QUEUE:${plan.executionId}:1`);
      const output: AebAeControlledScanOutput = {
        schemaVersion: "aeb-ae-controlled-comp-scan-output-v2",
        executionId: plan.executionId,
        planHash: plan.planHash,
        producerSourceHash: plan.host.producerSourceHash,
        host: {
          applicationId: plan.host.applicationId,
          version: plan.host.version,
          build: plan.host.build
        },
        composition: { id: plan.composition.id, name: plan.composition.name },
        targetLayers: plan.composition.targetLayers.map((item) => ({ ...item })),
        controlledFeatures: structuredClone(plan.controlledFeatures),
        scratchProjectBefore: structuredClone(scanRequest.scratchProjectBefore),
        renderQueueIndex: 1,
        temporaryRenderItemsCreated: 1
      };
      this.mutateScan?.(output);
      await writeFile(resultPath, JSON.stringify(output), { flag: "wx" });
      return { started: true, exitCode: 0, signal: null, forcedTermination: false };
    }
    const start = Number(argAfter(request.args, "-s"));
    const end = Number(argAfter(request.args, "-e"));
    const outputPattern = argAfter(request.args, "-output");
    const paths = Array.from({ length: end - start + 1 }, (_, offset) =>
      outputPattern.replace("[######]", String(start + offset).padStart(6, "0"))
    );
    if (this.behavior === "hardlink") {
      await writeFile(paths[0], deterministicFrame(start));
      await link(paths[0], paths[1]);
    } else if (this.behavior === "symlink") {
      await symlink(this.outsideFramePath, paths[0]);
      await writeFile(paths[1], deterministicFrame(start + 1));
    } else {
      const count = this.behavior === "missing" ? paths.length - 1 : paths.length;
      for (let index = 0; index < count; index += 1) {
        await writeFile(paths[index], deterministicFrame(start + index));
      }
    }
    if (this.behavior === "extra") {
      await writeFile(path.join(path.dirname(paths[0]), "stale-extra.png"), deterministicFrame(99));
    }
    for (let index = 0; index < paths.length; index += 1) request.onStdoutLine(`PROGRESS: ${index + 1}`);
    return { started: true, exitCode: 0, signal: null, forcedTermination: false };
  }
}

function deterministicFrame(frameIndex: number): Buffer {
  const image = createTransparentImage(4, 4);
  setPixel(image, frameIndex % 4, 1, [frameIndex, 120, 240, 180]);
  return encodeRgbaPng(image);
}

async function writeR1B04EvidenceIfRequested(input: {
  report: Awaited<ReturnType<NodeAebRetainedBakeCombinedSourceFlow["run"]>>;
  sourceIr: AebFormatNeutralIr;
  sourceProjectBefore: Buffer;
  sourceProjectAfter: Buffer;
  sourcePackageBefore: Buffer;
  sourcePackageAfter: Buffer;
  successorBytes: Buffer;
  fragmentBytes: Buffer;
  fullCompositionBytes: Buffer;
}): Promise<void> {
  const requestedRoot = process.env.AUTO_SVGA_AEB_R1_B04_EVIDENCE_ROOT;
  if (!requestedRoot) return;
  const sourceHead = process.env.AUTO_SVGA_AEB_R1_B04_SOURCE_HEAD;
  if (!/^[a-f0-9]{40}$/u.test(sourceHead ?? "")) {
    throw new Error("R1-B04 evidence publication requires the exact committed source head.");
  }
  const allowedRoot = path.resolve(".artifacts");
  const evidenceRoot = path.resolve(requestedRoot);
  if (evidenceRoot !== allowedRoot && !evidenceRoot.startsWith(`${allowedRoot}${path.sep}`)) {
    throw new Error("R1-B04 evidence root must remain inside the ignored worktree artifact boundary.");
  }
  await mkdir(evidenceRoot, { mode: 0o700 });
  const files = [
    ["finalized-retained-package.json", input.successorBytes],
    ["retained-bake-fragment.svga", input.fragmentBytes],
    ["retained-mixed-full-composition.svga", input.fullCompositionBytes],
    ["retained-source-ir.json", Buffer.from(`${JSON.stringify(input.sourceIr, null, 2)}\n`)],
    ["retained-combined-source-report.json", Buffer.from(`${JSON.stringify(input.report, null, 2)}\n`)]
  ] as const;
  for (const [name, bytes] of files) {
    await writeFile(path.join(evidenceRoot, name), bytes, { flag: "wx", mode: 0o600 });
  }
  const manifest = {
    schemaVersion: "auto-svga-r1-b04-aeb-source-evidence-v1",
    status: "source_validated_multi_join_pending",
    sourceHead,
    issues: ["R1-ISS-004", "R1-ISS-020"],
    aepHandoff: {
      directTest: "installed client gives a canonical AEB handoff for AEP before finalized native package Preview and Save",
      outcome: "aepHandoff",
      sourceAuthority: false,
      recentAuthority: false,
      previewAuthority: false,
      saveAuthority: false
    },
    classification: input.report.classification,
    finalizedPackageIdentity: {
      manifestId: input.report.manifestId,
      packageBundleId: input.report.packageBundleId,
      chainHash: input.report.chainHash,
      relativePath: input.report.package.successorPackageRelativePath,
      contentHash: input.report.package.successorPackageContentHash,
      physicalSuccessorReopened: input.report.package.physicalSuccessorReopened,
      f1ReinsertionValidated: input.report.package.f1ReinsertionValidated
    },
    sourceImmutability: {
      project: {
        beforeSha256: hasherSha(input.sourceProjectBefore),
        afterSha256: hasherSha(input.sourceProjectAfter),
        unchanged: input.sourceProjectBefore.equals(input.sourceProjectAfter)
      },
      package: {
        beforeSha256: hasherSha(input.sourcePackageBefore),
        afterSha256: hasherSha(input.sourcePackageAfter),
        unchanged: input.sourcePackageBefore.equals(input.sourcePackageAfter)
      }
    },
    materials: Object.fromEntries(files.map(([name, bytes]) => [name, {
      bytes: bytes.byteLength,
      sha256: hasherSha(bytes)
    }])),
    fullComposition: {
      relativePath: input.report.fullComposition.output.relativePath,
      contentHash: input.report.fullComposition.output.contentHash,
      encodedBytes: input.report.fullComposition.output.encodedBytes,
      identityDigest: input.report.fullComposition.output.identityDigest,
      sourceLayerOrder: input.report.fullComposition.sourceLayerOrder,
      sourceLayerAuthority: input.report.fullComposition.sourceLayerAuthority,
      sourceTimebase: input.report.fullComposition.sourceTimebase,
      preservedNativePayloadHashes: input.report.fullComposition.preservedNativePayloadHashes,
      preservedReplaceableElementIds: input.report.fullComposition.preservedReplaceableElementIds,
      generatedNativeAuthorityValid: input.report.fullComposition.validation.generatedNativeAuthorityValid,
      canonicalWireEncoding: input.report.fullComposition.validation.canonicalWireEncoding,
      previewOrSaveAuthorized: input.report.fullComposition.validation.previewOrSaveAuthorized
    }
  };
  await writeFile(
    path.join(evidenceRoot, "EVIDENCE.json"),
    Buffer.from(`${JSON.stringify(manifest, null, 2)}\n`),
    { flag: "wx", mode: 0o600 }
  );
}

function hasherSha(bytes: Uint8Array): string {
  return new Sha256ResourceHasher().hash(bytes).value;
}

class OutputMutatingHasher {
  mutated = false;
  private readonly delegate = new Sha256ResourceHasher();

  constructor(private readonly outputPath: string) {
  }

  async hash(bytes: Uint8Array) {
    const result = this.delegate.hash(bytes);
    if (!this.mutated) {
      try {
        const currentOutput = await readFile(this.outputPath);
        this.mutated = true;
        await writeFile(this.outputPath, Buffer.alloc(currentOutput.byteLength, 0x5a));
      } catch {
        // Output is not published yet; keep behaving exactly like the normal hasher.
      }
    }
    return result;
  }
}

function concreteScannerExecutable(): Buffer {
  return Buffer.from(`#!${process.execPath}
const fs = require("fs");
const request = JSON.parse(fs.readFileSync(process.env.AUTO_SVGA_AEB_F2_SCAN_REQUEST, "utf8"));
const marker = "\\nAEB_RENDER_QUEUE:" + request.plan.executionId + ":1";
fs.appendFileSync(request.scratchProjectPath, marker);
const output = {
  schemaVersion: "aeb-ae-controlled-comp-scan-output-v2",
  executionId: request.plan.executionId,
  planHash: request.plan.planHash,
  producerSourceHash: request.plan.host.producerSourceHash,
  host: {
    applicationId: request.plan.host.applicationId,
    version: request.plan.host.version,
    build: request.plan.host.build
  },
  composition: { id: request.plan.composition.id, name: request.plan.composition.name },
  targetLayers: request.plan.composition.targetLayers,
  controlledFeatures: request.plan.controlledFeatures,
  scratchProjectBefore: request.scratchProjectBefore,
  renderQueueIndex: 1,
  temporaryRenderItemsCreated: 1
};
fs.writeFileSync(process.env.AUTO_SVGA_AEB_F2_SCAN_RESULT, JSON.stringify(output), { flag: "wx" });
`);
}

function concreteRendererExecutable(): Buffer {
  const frames = Object.fromEntries([10, 11].map((frameIndex) => [
    String(frameIndex),
    deterministicFrame(frameIndex).toString("base64")
  ]));
  return Buffer.from(`#!${process.execPath}
const fs = require("fs");
const args = process.argv.slice(2);
const after = (name) => args[args.indexOf(name) + 1];
const projectPath = after("-project");
const renderQueueIndex = Number(after("-rqindex"));
const start = Number(after("-s"));
const end = Number(after("-e"));
const outputPattern = after("-output");
const project = fs.readFileSync(projectPath);
if (!project.toString("utf8").includes(":1")) process.exit(21);
const frames = ${JSON.stringify(frames)};
for (let frame = start; frame <= end; frame += 1) {
  const outputPath = outputPattern.replace("[######]", String(frame).padStart(6, "0"));
  fs.writeFileSync(outputPath, Buffer.from(frames[String(frame)], "base64"), { flag: "wx" });
  console.log("PROGRESS: " + (frame - start + 1));
}
`);
}

function argAfter(args: readonly string[], name: string): string {
  const index = args.indexOf(name);
  assert.ok(index >= 0 && index + 1 < args.length, name);
  return args[index + 1];
}

async function executeSuccess(fixture: Fixture) {
  return new NodeAebBoundedAeBakeExecutor(fixture.authority, fixture.hasher).execute(
    fixture.plan,
    concreteHostFor(fixture)
  );
}

function concreteHostFor(fixture: Fixture): NodeAebAerenderHostAdapter {
  return new NodeAebAerenderHostAdapter(
    fixture.plan.host,
    {
      renderExecutablePath: fixture.executablePath,
      scriptExecutablePath: fixture.scriptExecutablePath,
      producerSourcePath: fixture.producerSourcePath
    },
    fixture.hasher
  );
}

function hostFor(
  fixture: Fixture,
  runner: AebAeSyntheticProcessRunner,
  descriptor = fixture.plan.host
): NodeAebSyntheticAerenderHostAdapter {
  return new NodeAebSyntheticAerenderHostAdapter(
    descriptor,
    {
      renderExecutablePath: fixture.executablePath,
      scriptExecutablePath: fixture.scriptExecutablePath,
      producerSourcePath: fixture.producerSourcePath
    },
    fixture.hasher,
    runner
  );
}

function passShapedRetainedHostFor(fixture: Fixture, rawFrame?: Buffer): AebAeBakeHostAdapter & {
  lastResult(): Promise<AebAeBakeHostResult>;
} {
  let latest: AebAeBakeHostResult | undefined;
  return {
    descriptor: { ...AEB_RETAINED_AE_BAKE_HOST_DESCRIPTOR },
    async render(request) {
      const frame = rawFrame ?? deterministicFrame(request.plan.output.frames[0]!.frameIndex);
      await writeFile(path.join(request.rawOutputDirectory, request.rawFrameFileNames[0]!), frame, { flag: "wx" });
      request.onProgress({ phase: "rendering", completedFrames: 1, totalFrames: 1 });
      const receipt = await passShapedRetainedReceipt(fixture);
      latest = {
        host: { ...AEB_RETAINED_AE_BAKE_HOST_DESCRIPTOR },
        processStarted: true,
        completed: true,
        exitCode: 0,
        cancelled: false,
        timedOut: false,
        temporaryRenderItemsConfinedToScratch: true,
        scanReceipt: receipt,
        executionEvidence: await createAebAeRetainedHostExecutionEvidence(fixture.plan, receipt, fixture.hasher)
      };
      return latest;
    },
    async lastResult() {
      assert.ok(latest);
      return latest;
    }
  };
}

async function passShapedRetainedReceipt(fixture: Fixture): Promise<AebAeRetainedTransactionReceipt> {
  const frameSource = fixture.plan.output.frames[0]!;
  const frame = deterministicFrame(frameSource.frameIndex);
  const withoutHash: Omit<AebAeRetainedTransactionReceipt, "receiptHash"> = {
    schemaVersion: AEB_AE_RETAINED_TRANSACTION_RECEIPT_SCHEMA_VERSION,
    taskId: fixture.job.task.taskId,
    executionId: fixture.plan.executionId,
    planHash: fixture.plan.planHash,
    runtimePlanHash: "1".repeat(64),
    jobId: fixture.job.jobId,
    packageId: fixture.job.packageId,
    sourceFingerprint: fixture.job.source.sourceFingerprint,
    scanDigest: fixture.job.source.scanDigest,
    plannerDigest: fixture.job.source.plannerDigest,
    source: {
      projectContentHash: fixture.plan.sourceFiles.projectContentHash,
      packageContentHash: fixture.plan.sourceFiles.packageContentHash
    },
    timing: {
      startFrame: fixture.job.timeRange.startFrame,
      endFrameExclusive: fixture.job.timeRange.endFrameExclusive,
      fps: fixture.job.fps
    },
    canvas: { ...fixture.job.canvas },
    alphaMode: fixture.job.alphaMode,
    process: {
      pid: 4242,
      startIdentity: "2".repeat(64),
      executableHash: fixture.plan.host.executableHash
    },
    checkpoint: {
      relativePath: "checkpoint/checkpoint.aep",
      contentHash: "3".repeat(64),
      encodedBytes: 128,
      identityDigest: "4".repeat(64)
    },
    approvalHash: "5".repeat(64),
    resultHash: "6".repeat(64),
    composition: {
      productId: fixture.plan.composition.id,
      retainedId: "101",
      name: fixture.plan.composition.name
    },
    targetLayers: fixture.plan.composition.targetLayers.map((item) => ({ ...item })),
    controlledFeatures: {
      ...fixture.plan.controlledFeatures,
      effectMatchNames: [...fixture.plan.controlledFeatures.effectMatchNames],
      maskModes: [...fixture.plan.controlledFeatures.maskModes] as ["add", ..."add"[]]
    },
    renderQueue: {
      itemId: "aeb3-f2-s1-source-shaped-rq-1",
      rqindex: 1,
      renderStatus: "done"
    },
    output: {
      frames: [{
        frameIndex: frameSource.frameIndex,
        relativePath: frameSource.relativePath,
        contentHash: fixture.hasher.hash(frame).value,
        encodedBytes: frame.byteLength,
        decodedRgbaBytes: 64,
        width: 4,
        height: 4,
        alpha: "mixed"
      }]
    },
    cleanup: {
      renderQueueItemRemoved: true,
      temporaryItemsRemoved: true,
      projectClosedWithoutSave: true,
      appOpenCountAfterCheckpoint: 0,
      approvalConsumedOnce: true,
      processClosedNormally: true,
      processGroupAbsenceProven: true,
      runRootRemoved: true,
      unexpectedResidue: []
    }
  };
  return { ...withoutHash, receiptHash: await hashCanonical(fixture.hasher, withoutHash) };
}

function splitScan(receipt: AebAeBakeProducerReceipt): AebAeControlledScanReceipt {
  assert.equal(receipt.scanReceipt.schemaVersion, "aeb-ae-controlled-comp-scan-receipt-v2");
  return receipt.scanReceipt as AebAeControlledScanReceipt;
}

function splitEvidence(evidence: AebAeBakeProducerReceipt["hostExecution"]): AebAeSplitHostExecutionEvidence {
  assert.equal(evidence.kind, "split_scanner_renderer");
  return evidence as AebAeSplitHostExecutionEvidence;
}

async function rehashPlan(plan: AebAeBakeExecutionPlan, hasher: Sha256ResourceHasher): Promise<AebAeBakeExecutionPlan> {
  const { planHash: ignored, ...withoutHash } = plan;
  void ignored;
  return { ...withoutHash, planHash: await hashCanonical(hasher, withoutHash) };
}

async function rehashProducer(receipt: AebAeBakeProducerReceipt, hasher: Sha256ResourceHasher): Promise<string> {
  const { receiptHash: ignored, ...withoutHash } = receipt;
  void ignored;
  return hashCanonical(hasher, withoutHash);
}

async function rehashRetainedReceipt(
  receipt: AebAeRetainedTransactionReceipt,
  hasher: Sha256ResourceHasher
): Promise<string> {
  const { receiptHash: ignored, ...withoutHash } = receipt;
  void ignored;
  return hashCanonical(hasher, withoutHash);
}

async function assertNoExecutionResidue(fixture: Fixture): Promise<void> {
  const names = await taskNames(fixture);
  for (const name of names) {
    assert.equal(name.startsWith("aeb-ae-work-"), false, name);
    assert.equal(name.startsWith("aeb-ae-frames-"), false, name);
    assert.equal(name.startsWith("aeb-ae-execution-plan-"), false, name);
    assert.equal(name.startsWith("aeb-ae-producer-receipt-"), false, name);
    assert.equal(name.startsWith("aeb-ae-cleanup-receipt-"), false, name);
    assert.equal(name.startsWith("aeb-ae-temp-"), false, name);
  }
  assert.equal(names.includes(planFile(fixture.plan.executionId)), false);
  assert.equal(names.includes(producerReceiptFile(fixture.plan.executionId)), false);
  assert.equal(names.includes(cleanupReceiptFile(fixture.plan.executionId)), false);
}

async function taskNames(fixture: Fixture): Promise<string[]> {
  return (await readdir(fixture.taskRoot)).sort();
}

async function reopenOwnerFragment(
  fixture: Fixture,
  relativePath: string
): Promise<{
  params?: { frames?: number };
  images?: Record<string, Buffer>;
  sprites?: Array<{ frames?: Array<{ alpha?: number }> }>;
}> {
  const schema = await loadAebReviewedSvgaSchemaAuthority();
  const encoded = await readFile(path.join(fixture.taskRoot, relativePath));
  const decoded = schema.reopenMovieEntity.decode(inflateSync(encoded));
  return schema.reopenMovieEntity.toObject(decoded, {
    bytes: Buffer,
    arrays: true,
    objects: true,
    defaults: true
  }) as {
    params?: { frames?: number };
    images?: Record<string, Buffer>;
    sprites?: Array<{ frames?: Array<{ alpha?: number }> }>;
  };
}

async function assertBakeError(action: () => Promise<unknown>, code: string): Promise<void> {
  await assert.rejects(action, (error: unknown) => {
    assert.ok(error instanceof AebBakePipelineError);
    assert.equal(error.code, code);
    assert.equal(error.message.includes(os.tmpdir()), false);
    return true;
  });
}

function isPidAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

async function waitForPidExit(pid: number): Promise<void> {
  for (let attempt = 0; attempt < 100 && isPidAlive(pid); attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
}
