import assert from "node:assert/strict";
import { access, appendFile, link, mkdtemp, mkdir, readFile, readdir, rename, rm, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { encode as encodeFastPng } from "fast-png";
import { Sha256ResourceHasher } from "../hosts/sha256-resource-hasher.js";
import {
  NodeAebBakeResourceReader,
  NodeAebTaskRootAuthority
} from "../hosts/aeb-node-bake-resource-reader.js";
import {
  AebPackagePublicationError,
  NodeAebBakePackagePublisher
} from "../hosts/aeb-node-bake-package-publisher.js";
import {
  AebBakePipelineError,
  buildAebBakeManifest,
  createSyntheticAebBakeExecutionReceipt,
  verifyAebBakeManifestIntegrity
} from "../workbench/aeb-bake-pipeline.js";
import type {
  AebBakeJob,
  AebBakeExecutionReceipt,
  AebBakePlannerJoin,
  AebBakeTaskReceipt,
  AebFormatNeutralIr,
  AebPackagePublicationRollbackAuthority,
  AebPackagePublicationRollbackReceipt,
  AebPublishedSuccessorPackage,
  AebReinsertedPackage
} from "../workbench/aeb-bake-contracts.js";
import {
  reinsertAebBakePackage,
  verifyAebPackagePublicationRollbackReceiptIntegrity
} from "../workbench/aeb-package-reinsertion.js";
import { createSvgaAebBakeAdapterInput } from "../workbench/svga/aeb-bake-adapter.js";
import type { EmbeddedResourceHasher } from "../workbench/resource-hasher.js";
import { createTransparentImage, encodeRgbaPng, setPixel } from "../utils/png-writer.js";

const digest = (character: string): string => character.repeat(64);

const baseJob: AebBakeJob = {
  schemaVersion: "aeb-bake-job-v1",
  jobId: "job-complex-comp-001",
  packageId: "package-complex-comp-001",
  source: {
    compositionId: "comp-main",
    sourceFingerprint: digest("a"),
    scanDigest: digest("b"),
    plannerDigest: digest("c")
  },
  target: {
    kind: "precomp",
    sourceId: "precomp-glow-stack",
    layerIds: ["layer-bake-glow"],
    replaceableElementIds: []
  },
  timeRange: { startFrame: 10, endFrameExclusive: 12 },
  fps: 30,
  canvas: { width: 4, height: 4 },
  alphaMode: "straight",
  bbox: { mode: "full_canvas", x: 0, y: 0, width: 4, height: 4 },
  budgets: {
    maxFrames: 2,
    maxEncodedBytes: 64 * 1024,
    maxDecodedRgbaBytes: 128,
    maxPackageBytes: 96 * 1024
  },
  task: { taskId: "task-complex-comp-001", receiptId: "receipt-complex-comp-001" },
  safety: {
    sourceProjectMutationAllowed: false,
    replaceablePolicy: "preserve",
    cleanupRequired: true,
    rollbackReceiptRequired: true
  }
};

const basePlanner: AebBakePlannerJoin = {
  schemaVersion: "aeb-bake-planner-join-v1",
  jobId: baseJob.jobId,
  sourceFingerprint: baseJob.source.sourceFingerprint,
  scanDigest: baseJob.source.scanDigest,
  plannerDigest: baseJob.source.plannerDigest,
  decisions: [
    { layerId: "layer-native-title", outcome: "native", reason: "image_transform_v0" },
    { layerId: "layer-bake-glow", outcome: "bake_required", reason: "unsupported_effect_stack" }
  ]
};

const baseIr: AebFormatNeutralIr = {
  schemaVersion: "aeb-format-neutral-ir-v1",
  packageId: baseJob.packageId,
  source: { ...baseJob.source },
  composition: {
    canvas: { ...baseJob.canvas },
    fps: baseJob.fps,
    timeRange: { ...baseJob.timeRange }
  },
  layers: [
    {
      layerId: "layer-native-title",
      sourceId: "source-native-title",
      plannerOutcome: "native",
      replaceableElementIds: ["owner-title-slot"],
      nativePayloadRef: "native-payload-title"
    },
    {
      layerId: "layer-bake-glow",
      sourceId: "precomp-glow-stack",
      plannerOutcome: "bake_required",
      replaceableElementIds: []
    }
  ],
  resources: [{
    resourceId: "resource-native-title",
    relativePath: "assets/native-title.png",
    contentHash: { algorithm: "sha256", value: digest("e"), scope: "encoded_bytes" },
    ownerLayerId: "layer-native-title"
  }]
};

test("shared Bake manifest is deterministic, deduped, package-reinsertable, and SVGA adapter-ready", async (t) => {
  const fixture = await createFixture(t);
  const hasher = new Sha256ResourceHasher();

  const first = await buildAebBakeManifest(await createBuildInput(fixture, { hasher }));
  const second = await buildAebBakeManifest(await createBuildInput(fixture, {
    hasher,
    planner: { ...basePlanner, decisions: [...basePlanner.decisions].reverse() }
  }));

  assert.equal(first.manifestId, second.manifestId);
  assert.equal(first.resources.frameCount, 2);
  assert.equal(first.resources.uniqueContentCount, 1);
  assert.equal(first.resources.deduplicatedFrameCount, 1);
  assert.equal(first.frames[1].canonicalResourceId, first.frames[0].resourceId);
  assert.deepEqual(first.reinsertion.replaceBakedLayerIds, ["layer-bake-glow"]);
  assert.deepEqual(first.reinsertion.preserveNativeLayerIds, ["layer-native-title"]);
  assert.equal(first.reinsertion.contractValidated, true);
  assert.equal(first.reinsertion.packageReinserted, false);
  assert.equal(first.validation.adapterNeutralValidated, true);
  assert.equal(first.validation.packageReinsertionValidated, false);
  assert.equal(first.validation.actualAeRenderExecuted, false);
  assert.equal(first.validation.finalEncoderValidationRequired, true);
  assert.equal(await verifyAebBakeManifestIntegrity(first, hasher), true);

  const reinsertedPackage = await reinsertAebBakePackage(baseIr, first, hasher);
  const reorderedPackage = await reinsertAebBakePackage({
    ...baseIr,
    layers: [...baseIr.layers].reverse(),
    resources: [...baseIr.resources].reverse()
  }, second, hasher);
  assert.equal(reinsertedPackage.packageBundleId, reorderedPackage.packageBundleId);
  assert.equal(reinsertedPackage.validation.packageReinsertionValidated, true);
  assert.deepEqual(reinsertedPackage.preservedNativeLayers[0].replaceableElementIds, ["owner-title-slot"]);
  assert.deepEqual(reinsertedPackage.bakedSequences[0].replacesLayerIds, ["layer-bake-glow"]);
  assert.equal(reinsertedPackage.resources.bakedCanonicalResourceIds.length, 1);

  const sourceBytes = await readFile(path.join(fixture.taskRoot, "source-package.json"));
  const sourceHash = hasher.hash(sourceBytes).value;
  const publisher = new NodeAebBakePackagePublisher(fixture.authority);
  const published = await publisher.publish({
    bundle: reinsertedPackage,
    sourcePackageRelativePath: "source-package.json",
    expectedSourcePackageHash: sourceHash,
    successorFileName: "successor-package.json",
    maxSourcePackageBytes: 64 * 1024,
    maxSuccessorPackageBytes: baseJob.budgets.maxPackageBytes,
    hasher
  });
  assert.equal(published.publicationReceipt.sourcePackage.unchanged, true);
  assert.equal(published.publicationReceipt.cleanup.temporaryPathRemoved, true);
  assert.deepEqual(await readFile(path.join(fixture.taskRoot, "source-package.json")), sourceBytes);
  const physical = JSON.parse(await readFile(path.join(fixture.taskRoot, "successor-package.json"), "utf8"));
  assert.equal(physical.schemaVersion, "aeb-physical-successor-package-v1");
  assert.deepEqual(Buffer.from(physical.sourcePackage.bytesBase64, "base64"), sourceBytes);
  const successorBeforeOverwrite = await readFile(path.join(fixture.taskRoot, "successor-package.json"));
  await assertBakeError(
    () => publishBundle(fixture, reinsertedPackage, hasher),
    "PUBLICATION_FAILED"
  );
  assert.deepEqual(await readFile(path.join(fixture.taskRoot, "successor-package.json")), successorBeforeOverwrite);

  const adapterInput = await createSvgaAebBakeAdapterInput(published, hasher, publisher);
  assert.equal(adapterInput.sourceFormat, "aeb_physical_successor_package");
  assert.equal(adapterInput.outputFormat, "svga");
  assert.equal(adapterInput.frames.length, 2);
  assert.equal(adapterInput.frames[0].imageKey, `aeb_${first.frames[0].resourceId}`);
  assert.equal(adapterInput.validation.standardsValidSvgaEncoded, false);
  assert.equal(adapterInput.validation.finalEncoderValidationRequired, true);
});

test("package reinsertion rejects stale format-neutral IR source binding", async (t) => {
  const fixture = await createFixture(t);
  const hasher = new Sha256ResourceHasher();
  const manifest = await buildAebBakeManifest(await createBuildInput(fixture, { hasher }));
  const staleIr: AebFormatNeutralIr = {
    ...baseIr,
    source: { ...baseIr.source, scanDigest: digest("f") }
  };

  await assertBakeError(
    () => reinsertAebBakePackage(staleIr, manifest, hasher),
    "SOURCE_IR_BINDING_MISMATCH"
  );
});

test("shared Bake rejects a stale task receipt before reading resources", async (t) => {
  const fixture = await createFixture(t, {
    receipt: { sourceFingerprint: digest("d") }
  });

  await assertBakeError(
    async () => buildAebBakeManifest(await createBuildInput(fixture)),
    "TASK_RECEIPT_BINDING_MISMATCH"
  );
});

test("shared boundaries return coded failures for malformed untrusted inputs", async (t) => {
  const fixture = await createFixture(t);
  const validInput = await createBuildInput(fixture);
  await assertBakeError(
    () => buildAebBakeManifest({
      ...validInput,
      job: null as unknown as AebBakeJob
    }),
    "JOB_INVALID"
  );

  await assertBakeError(
    () => createSvgaAebBakeAdapterInput(
      null as unknown as AebPublishedSuccessorPackage,
      new Sha256ResourceHasher(),
      { verifyPublishedSuccessor: async () => false }
    ),
    "PACKAGE_SHAPE_INVALID"
  );
});

test("shared Bake rejects blocked planner joins and replaceable-element loss", async (t) => {
  const fixture = await createFixture(t);
  const blocked: AebBakePlannerJoin = {
    ...basePlanner,
    decisions: [...basePlanner.decisions, { layerId: "layer-plugin", outcome: "blocked", reason: "plugin_missing" }]
  };

  await assertBakeError(
    async () => buildAebBakeManifest(await createBuildInput(fixture, { planner: blocked })),
    "PLANNER_BLOCKED"
  );

  await assertBakeError(
    async () => buildAebBakeManifest(await createBuildInput(fixture, {
      job: {
        ...baseJob,
        target: { ...baseJob.target, replaceableElementIds: ["owner-avatar-slot"] }
      }
    })),
    "REPLACEABLE_ELEMENT_LOSS"
  );
});

test("task-owned resource reader rejects symlink aliases and path escape", async (t) => {
  const fixture = await createFixture(t);
  await symlink(path.join(fixture.taskRoot, fixture.frames[0].relativePath), path.join(fixture.taskRoot, "frames", "alias.png"));

  await assertBakeError(
    async () => buildAebBakeManifest(await createBuildInput(fixture, {
      frames: [fixture.frames[0], { frameIndex: 11, relativePath: "frames/alias.png" }],
    })),
    "RESOURCE_SYMLINK_FORBIDDEN"
  );

  await assertBakeError(
    async () => buildAebBakeManifest(await createBuildInput(fixture, {
      frames: [fixture.frames[0], { frameIndex: 11, relativePath: "../outside.png" }],
    })),
    "RESOURCE_PATH_INVALID"
  );

  const absolutePath = path.join(fixture.taskRoot, "frames", "private-production-name.png");
  await assertBakeErrorWithRedaction(
    async () => buildAebBakeManifest(await createBuildInput(fixture, {
      frames: [fixture.frames[0], { frameIndex: 11, relativePath: absolutePath }]
    })),
    "RESOURCE_PATH_INVALID",
    [fixture.taskBase, fixture.taskRoot, absolutePath]
  );
});

test("task authority rejects first-use external hard links and aliases created during validation", async (t) => {
  const fixture = await createFixture(t);
  const outsideRoot = await mkdtemp(path.join(os.tmpdir(), "auto-svga-aeb-outside-hardlink-"));
  t.after(() => rm(outsideRoot, { recursive: true, force: true }));
  const outsideFrame = path.join(outsideRoot, "outside-frame.png");
  const framePath = path.join(fixture.taskRoot, fixture.frames[0].relativePath);
  const externalBytes = await readFile(framePath);
  await writeFile(outsideFrame, externalBytes);
  await rm(framePath);
  await link(outsideFrame, framePath);

  const delegate = new Sha256ResourceHasher();
  let resourceHashCalls = 0;
  const trackingHasher: EmbeddedResourceHasher = {
    hash(bytes) {
      if (Buffer.from(bytes).equals(externalBytes)) resourceHashCalls += 1;
      return delegate.hash(bytes);
    }
  };
  let manifest: Awaited<ReturnType<typeof buildAebBakeManifest>> | undefined;
  let reinsertionAttempted = false;
  let publicationAttempted = false;
  let adapterAttempted = false;
  await assertBakeError(
    async () => {
      manifest = await buildAebBakeManifest(await createBuildInput(fixture, { hasher: trackingHasher }));
      reinsertionAttempted = true;
      const bundle = await reinsertAebBakePackage(baseIr, manifest, trackingHasher);
      publicationAttempted = true;
      const publisher = new NodeAebBakePackagePublisher(fixture.authority);
      const published = await publisher.publish({
        bundle,
        sourcePackageRelativePath: "source-package.json",
        expectedSourcePackageHash: delegate.hash(await readFile(path.join(fixture.taskRoot, "source-package.json"))).value,
        successorFileName: "hardlink-successor.json",
        maxSourcePackageBytes: 64 * 1024,
        maxSuccessorPackageBytes: baseJob.budgets.maxPackageBytes,
        hasher: trackingHasher
      });
      adapterAttempted = true;
      await createSvgaAebBakeAdapterInput(published, trackingHasher, publisher);
    },
    "RESOURCE_MULTILINK_FORBIDDEN"
  );
  assert.equal(manifest, undefined);
  assert.equal(resourceHashCalls, 0);
  assert.equal(reinsertionAttempted, false);
  assert.equal(publicationAttempted, false);
  assert.equal(adapterAttempted, false);
  assert.equal(await fileExists(path.join(fixture.taskRoot, "hardlink-successor.json")), false);

  const during = await createFixture(t);
  const aliasPath = path.join(outsideRoot, "during-read-alias.png");
  const duringAuthority = new NodeAebTaskRootAuthority({
    approvedTaskBase: during.taskBase,
    taskId: during.job.task.taskId,
    hooks: {
      async afterFileOpen(relativePath) {
        if (relativePath === during.frames[0].relativePath) {
          await link(path.join(during.taskRoot, relativePath), aliasPath);
        }
      }
    }
  });
  t.after(() => duringAuthority.close());
  let readResult: unknown;
  await assertBakeError(
    async () => {
      readResult = await new NodeAebBakeResourceReader(duringAuthority).readFrame(during.frames[0], {
        width: during.job.canvas.width,
        height: during.job.canvas.height,
        maxEncodedBytes: during.job.budgets.maxEncodedBytes,
        maxDecodedRgbaBytes: during.job.budgets.maxDecodedRgbaBytes
      });
    },
    "RESOURCE_MULTILINK_FORBIDDEN"
  );
  assert.equal(readResult, undefined);
});

test("single-link ownership covers task receipts and source or successor package authority reads", async (t) => {
  const outsideRoot = await mkdtemp(path.join(os.tmpdir(), "auto-svga-aeb-authority-hardlink-"));
  t.after(() => rm(outsideRoot, { recursive: true, force: true }));

  const receiptFixture = await createFixture(t);
  const receiptPath = path.join(receiptFixture.taskRoot, ".aeb-bake-task.json");
  const outsideReceipt = path.join(outsideRoot, "outside-task-receipt.json");
  await writeFile(outsideReceipt, await readFile(receiptPath));
  await rm(receiptPath);
  await link(outsideReceipt, receiptPath);
  await assertBakeError(
    async () => buildAebBakeManifest(await createBuildInput(receiptFixture)),
    "TASK_RECEIPT_MULTILINK_FORBIDDEN"
  );

  const sourceFixture = await createFixture(t);
  const sourceHasher = new Sha256ResourceHasher();
  const sourceManifest = await buildAebBakeManifest(await createBuildInput(sourceFixture, { hasher: sourceHasher }));
  const sourceBundle = await reinsertAebBakePackage(baseIr, sourceManifest, sourceHasher);
  const sourcePath = path.join(sourceFixture.taskRoot, "source-package.json");
  const outsideSource = path.join(outsideRoot, "outside-source-package.json");
  const sourceBytes = await readFile(sourcePath);
  await writeFile(outsideSource, sourceBytes);
  await rm(sourcePath);
  await link(outsideSource, sourcePath);
  await assertBakeError(
    () => publishBundle(sourceFixture, sourceBundle, sourceHasher, "source-hardlink-successor.json"),
    "SOURCE_PACKAGE_MULTILINK_FORBIDDEN"
  );
  assert.equal(await fileExists(path.join(sourceFixture.taskRoot, "source-hardlink-successor.json")), false);

  const successorFixture = await createFixture(t);
  const successorHasher = new Sha256ResourceHasher();
  const successorManifest = await buildAebBakeManifest(await createBuildInput(successorFixture, { hasher: successorHasher }));
  const successorBundle = await reinsertAebBakePackage(baseIr, successorManifest, successorHasher);
  const publisher = new NodeAebBakePackagePublisher(successorFixture.authority);
  const published = await publishBundle(
    successorFixture,
    successorBundle,
    successorHasher,
    "successor-hardlink.json",
    publisher
  );
  await link(
    path.join(successorFixture.taskRoot, "successor-hardlink.json"),
    path.join(outsideRoot, "outside-successor-alias.json")
  );
  let adapterInput: unknown;
  await assertBakeError(
    async () => {
      adapterInput = await createSvgaAebBakeAdapterInput(published, successorHasher, publisher);
    },
    "PACKAGE_PUBLICATION_AUTHORITY_INVALID"
  );
  assert.equal(adapterInput, undefined);
});

test("planner rejects untargeted bake-required work before task or downstream authority", async (t) => {
  const fixture = await createFixture(t);
  const input = await createBuildInput(fixture);
  let taskVerificationCalls = 0;
  let frameReadCalls = 0;
  let manifest: Awaited<ReturnType<typeof buildAebBakeManifest>> | undefined;
  let reinsertionAttempted = false;
  let publicationAttempted = false;
  let adapterAttempted = false;
  const planner: AebBakePlannerJoin = {
    ...basePlanner,
    decisions: [
      ...basePlanner.decisions,
      { layerId: "layer-bake-untargeted", outcome: "bake_required", reason: "outside_this_job" }
    ]
  };

  await assertBakeError(
    async () => {
      manifest = await buildAebBakeManifest({
        ...input,
        planner,
        reader: {
          async verifyTaskReceipt(receipt) {
            taskVerificationCalls += 1;
            return input.reader.verifyTaskReceipt(receipt);
          },
          async readFrame(source, expected) {
            frameReadCalls += 1;
            return input.reader.readFrame(source, expected);
          }
        }
      });
      reinsertionAttempted = true;
      const bundle = await reinsertAebBakePackage(baseIr, manifest, input.hasher);
      publicationAttempted = true;
      const publisher = new NodeAebBakePackagePublisher(fixture.authority);
      const published = await publishBundle(fixture, bundle, new Sha256ResourceHasher(), "untargeted-successor.json", publisher);
      adapterAttempted = true;
      await createSvgaAebBakeAdapterInput(published, input.hasher, publisher);
    },
    "PLANNER_JOB_SCOPE_MISMATCH"
  );

  assert.equal(taskVerificationCalls, 0);
  assert.equal(frameReadCalls, 0);
  assert.equal(manifest, undefined);
  assert.equal(reinsertionAttempted, false);
  assert.equal(publicationAttempted, false);
  assert.equal(adapterAttempted, false);
  assert.equal(await fileExists(path.join(fixture.taskRoot, "untargeted-successor.json")), false);
});

test("task-owned resource reader requires transparent-capable 8-bit RGBA PNG output", async (t) => {
  const fixture = await createFixture(t);
  const rgb = new Uint8Array(4 * 4 * 3).fill(180);
  await writeFile(
    path.join(fixture.taskRoot, "frames", "frame_000011.png"),
    encodeFastPng({ width: 4, height: 4, data: rgb, channels: 3 })
  );

  await assertBakeError(
    async () => buildAebBakeManifest(await createBuildInput(fixture)),
    "RESOURCE_RGBA_REQUIRED"
  );
});

test("shared Bake fails closed when decoded or package budgets are exceeded", async (t) => {
  const fixture = await createFixture(t);
  const overBudgetJob: AebBakeJob = {
    ...baseJob,
    budgets: { ...baseJob.budgets, maxDecodedRgbaBytes: 127 }
  };

  await assertBakeError(
    async () => buildAebBakeManifest(await createBuildInput(fixture, { job: overBudgetJob })),
    "DECODED_BUDGET_EXCEEDED"
  );

  await assertBakeError(
    async () => buildAebBakeManifest(await createBuildInput(fixture, {
      job: {
        ...baseJob,
        budgets: { ...baseJob.budgets, maxPackageBytes: 1 }
      }
    })),
    "PACKAGE_BUDGET_EXCEEDED"
  );

  const encodedFrameBytes = (await readFile(path.join(fixture.taskRoot, fixture.frames[0].relativePath))).byteLength;
  await assertBakeError(
    async () => buildAebBakeManifest(await createBuildInput(fixture, {
      job: {
        ...baseJob,
        budgets: { ...baseJob.budgets, maxEncodedBytes: encodedFrameBytes * 2 - 1 }
      }
    })),
    "ENCODED_BUDGET_EXCEEDED"
  );

  await assertBakeError(
    async () => buildAebBakeManifest(await createBuildInput(fixture, {
      job: {
        ...baseJob,
        budgets: { ...baseJob.budgets, maxEncodedBytes: 128 * 1024 * 1024 + 1 }
      }
    })),
    "JOB_INVALID"
  );
});

test("SVGA adapter boundary rejects a mutated or incomplete reinserted package", async (t) => {
  const fixture = await createFixture(t);
  const hasher = new Sha256ResourceHasher();
  const manifest = await buildAebBakeManifest(await createBuildInput(fixture, { hasher }));
  const reinsertedPackage = await reinsertAebBakePackage(baseIr, manifest, hasher);
  const publisher = new NodeAebBakePackagePublisher(fixture.authority);
  const published = await publishBundle(fixture, reinsertedPackage, hasher, "successor-package.json", publisher);
  const mutated = {
    ...published,
    bundle: {
      ...published.bundle,
      validation: { ...published.bundle.validation, packageReinsertionValidated: false as const }
    }
  } as unknown as AebPublishedSuccessorPackage;

  await assertBakeError(
    () => createSvgaAebBakeAdapterInput(mutated, hasher, publisher),
    "PACKAGE_INTEGRITY_INVALID"
  );
});

test("task authority rejects arbitrary roots and root or parent replacement without leaking paths", async (t) => {
  const fixture = await createFixture(t);
  const arbitrary = new NodeAebTaskRootAuthority({
    approvedTaskBase: fixture.taskRoot,
    taskId: fixture.job.task.taskId
  });
  await assertBakeErrorWithRedaction(() => arbitrary.verifyPinned(), "TASK_ROOT_INVALID", [fixture.taskBase, fixture.taskRoot]);
  await arbitrary.close();

  await fixture.authority.verifyPinned();
  const movedRoot = `${fixture.taskRoot}-moved`;
  await rename(fixture.taskRoot, movedRoot);
  await mkdir(fixture.taskRoot);
  await assertBakeErrorWithRedaction(
    () => fixture.authority.verifyPinned(),
    "TASK_ROOT_CHANGED",
    [fixture.taskBase, fixture.taskRoot]
  );

  const parentFixture = await createFixture(t);
  await parentFixture.authority.verifyPinned();
  const movedBase = `${parentFixture.taskBase}-moved`;
  await rename(parentFixture.taskBase, movedBase);
  await mkdir(parentFixture.taskBase);
  try {
    await assertBakeErrorWithRedaction(
      () => parentFixture.authority.verifyPinned(),
      "TASK_BASE_CHANGED",
      [parentFixture.taskBase, parentFixture.taskRoot]
    );
  } finally {
    await rm(parentFixture.taskBase, { recursive: true, force: true });
    await rename(movedBase, parentFixture.taskBase);
  }
});

test("task authority detects post-open file swap, growth beyond cap, and PNG decode-bomb IHDR", async (t) => {
  const swapped = await createFixture(t);
  let swappedOnce = false;
  const swapAuthority = new NodeAebTaskRootAuthority({
    approvedTaskBase: swapped.taskBase,
    taskId: swapped.job.task.taskId,
    hooks: {
      async afterFileRead(relativePath) {
        if (relativePath !== swapped.frames[0].relativePath || swappedOnce) return;
        swappedOnce = true;
        const current = path.join(swapped.taskRoot, relativePath);
        const original = `${current}.original`;
        const bytes = await readFile(current);
        await rename(current, original);
        await writeFile(current, bytes);
      }
    }
  });
  t.after(() => swapAuthority.close());
  await assertBakeError(
    async () => buildAebBakeManifest(await createBuildInput(swapped, { authority: swapAuthority })),
    "RESOURCE_PATH_SWAP_DETECTED"
  );

  const grown = await createFixture(t);
  let grownOnce = false;
  const growthAuthority = new NodeAebTaskRootAuthority({
    approvedTaskBase: grown.taskBase,
    taskId: grown.job.task.taskId,
    hooks: {
      async afterFileOpen(relativePath) {
        if (relativePath !== grown.frames[0].relativePath || grownOnce) return;
        grownOnce = true;
        await appendFile(path.join(grown.taskRoot, relativePath), Buffer.alloc(baseJob.budgets.maxEncodedBytes + 1));
      }
    }
  });
  t.after(() => growthAuthority.close());
  await assertBakeError(
    async () => buildAebBakeManifest(await createBuildInput(grown, { authority: growthAuthority })),
    "RESOURCE_READ_LIMIT_EXCEEDED"
  );

  const bomb = await createFixture(t);
  const bombBytes = Buffer.from(await readFile(path.join(bomb.taskRoot, bomb.frames[0].relativePath)));
  bombBytes.writeUInt32BE(100_000, 16);
  bombBytes.writeUInt32BE(100_000, 20);
  await writeFile(path.join(bomb.taskRoot, bomb.frames[0].relativePath), bombBytes);
  await assertBakeError(
    async () => buildAebBakeManifest(await createBuildInput(bomb)),
    "RESOURCE_DIMENSIONS_MISMATCH"
  );
});

test("physical package publication rolls back write, finalize, and cleanup failures", async (t) => {
  for (const phase of ["write", "finalize", "cleanup"] as const) {
    const fixture = await createFixture(t);
    const hasher = new Sha256ResourceHasher();
    const successorFileName = `successor-${phase}.json`;
    const expectedAuthority = await createRollbackAuthority(fixture, hasher, successorFileName);
    const manifest = await buildAebBakeManifest(await createBuildInput(fixture, { hasher }));
    const bundle = await reinsertAebBakePackage(baseIr, manifest, hasher);
    const publisher = new NodeAebBakePackagePublisher(fixture.authority, {
      beforePhase(current) {
        if (current === phase) throw new Error(`injected-${phase}`);
      }
    });
    let captured: AebPackagePublicationError | undefined;
    await assert.rejects(
      () => publishBundle(fixture, bundle, hasher, successorFileName, publisher),
      (error: unknown) => {
        assert.ok(error instanceof AebPackagePublicationError);
        captured = error;
        assert.equal(error.code, phase === "cleanup" ? "PUBLICATION_CLEANUP_FAILED" : "PUBLICATION_FAILED");
        const { receiptHash, ...receiptWithoutHash } = error.rollbackReceipt;
        assert.equal(receiptHash, hashCanonicalForTest(receiptWithoutHash, hasher));
        assert.equal(error.rollbackReceipt.sourcePackage.unchanged, true);
        assert.equal(error.rollbackReceipt.successorPackage.partialSuccessorPresent, false);
        assert.equal(error.rollbackReceipt.cleanup.temporaryPathRemoved, true);
        return true;
      }
    );
    assert.ok(captured);
    assert.equal(
      await verifyAebPackagePublicationRollbackReceiptIntegrity(
        captured.rollbackReceipt,
        hasher,
        expectedAuthority
      ),
      true
    );
    assert.equal(await fileExists(path.join(fixture.taskRoot, successorFileName)), false);
    assert.equal((await listNames(fixture.taskRoot)).some((name) => name.startsWith("aeb-publish-temp-")), false);
  }
});

test("rollback receipt verifier rejects self-hashed impossible histories for every phase", async () => {
  const hasher = new Sha256ResourceHasher();
  const baseWithoutHash: Omit<AebPackagePublicationRollbackReceipt, "receiptHash"> = {
    schemaVersion: "aeb-package-publication-rollback-receipt-v1",
    taskId: baseJob.task.taskId,
    receiptId: baseJob.task.receiptId,
    jobId: baseJob.jobId,
    packageId: baseJob.packageId,
    phase: "write",
    sourcePackage: {
      relativePath: "source-package.json",
      contentHash: { algorithm: "sha256", value: digest("a"), scope: "encoded_bytes" },
      preIdentityDigest: digest("b"),
      postIdentityDigest: digest("b"),
      unchanged: true
    },
    successorPackage: {
      relativePath: "successor-package.json",
      ownedDestinationCreated: true,
      ownedDestinationRemoved: true,
      partialSuccessorPresent: false
    },
    cleanup: {
      temporaryPathCreated: false,
      temporaryPathRemoved: true,
      rollbackPerformed: false
    }
  };
  const contradictions: Array<Omit<AebPackagePublicationRollbackReceipt, "receiptHash">> = [
    baseWithoutHash,
    { ...baseWithoutHash, phase: "finalize" },
    {
      ...baseWithoutHash,
      phase: "cleanup",
      successorPackage: {
        ...baseWithoutHash.successorPackage,
        ownedDestinationCreated: false,
        ownedDestinationRemoved: false
      },
      cleanup: { ...baseWithoutHash.cleanup, temporaryPathCreated: true, rollbackPerformed: true }
    },
    {
      ...baseWithoutHash,
      phase: "verification",
      cleanup: { ...baseWithoutHash.cleanup, temporaryPathCreated: true, rollbackPerformed: false }
    }
  ];
  const expectedAuthority: AebPackagePublicationRollbackAuthority = {
    taskId: baseJob.task.taskId,
    receiptId: baseJob.task.receiptId,
    jobId: baseJob.jobId,
    packageId: baseJob.packageId,
    sourcePackage: {
      relativePath: "source-package.json",
      contentHash: { algorithm: "sha256", value: digest("a"), scope: "encoded_bytes" },
      identityDigest: digest("b")
    },
    successorPackage: { relativePath: "successor-package.json" }
  };

  for (const withoutHash of contradictions) {
    const receipt: AebPackagePublicationRollbackReceipt = {
      ...withoutHash,
      receiptHash: hashCanonicalForTest(withoutHash, hasher)
    };
    assert.equal(
      await verifyAebPackagePublicationRollbackReceiptIntegrity(receipt, hasher, expectedAuthority),
      false
    );
  }
});

test("verification-phase rollback receipt binds cleanup history and expected authority", async (t) => {
  const fixture = await createFixture(t);
  const hasher = new Sha256ResourceHasher();
  const manifest = await buildAebBakeManifest(await createBuildInput(fixture, { hasher }));
  const bundle = await reinsertAebBakePackage(baseIr, manifest, hasher);
  const successorFileName = "verification-failure-successor.json";
  const expected = await createRollbackAuthority(fixture, hasher, successorFileName);
  let injected = false;
  const authority = new NodeAebTaskRootAuthority({
    approvedTaskBase: fixture.taskBase,
    taskId: fixture.job.task.taskId,
    hooks: {
      afterFileRead(relativePath) {
        if (relativePath === successorFileName && !injected) {
          injected = true;
          throw new Error("injected-verification-readback-failure");
        }
      }
    }
  });
  t.after(() => authority.close());
  const publisher = new NodeAebBakePackagePublisher(authority);
  let captured: AebPackagePublicationError | undefined;
  await assert.rejects(
    () => publishBundle(fixture, bundle, hasher, successorFileName, publisher),
    (error: unknown) => {
      assert.ok(error instanceof AebPackagePublicationError);
      captured = error;
      assert.equal(error.rollbackReceipt.phase, "verification");
      return true;
    }
  );
  assert.ok(captured);
  assert.equal(
    await verifyAebPackagePublicationRollbackReceiptIntegrity(captured.rollbackReceipt, hasher, expected),
    true
  );
  assert.equal(
    await verifyAebPackagePublicationRollbackReceiptIntegrity(
      captured.rollbackReceipt,
      hasher,
      { ...expected, jobId: "another-job" }
    ),
    false
  );
  assert.equal(await fileExists(path.join(fixture.taskRoot, successorFileName)), false);
});

test("atomic successor publication rejects a destination race without overwriting the competing file", async (t) => {
  const fixture = await createFixture(t);
  const hasher = new Sha256ResourceHasher();
  const manifest = await buildAebBakeManifest(await createBuildInput(fixture, { hasher }));
  const bundle = await reinsertAebBakePackage(baseIr, manifest, hasher);
  const competingBytes = Buffer.from("competing-owner-bytes");
  const destinationPath = path.join(fixture.taskRoot, "raced-successor.json");
  const publisher = new NodeAebBakePackagePublisher(fixture.authority, {
    async beforePhase(phase) {
      if (phase === "finalize") await writeFile(destinationPath, competingBytes);
    }
  });
  await assert.rejects(
    () => publishBundle(fixture, bundle, hasher, "raced-successor.json", publisher),
    (error: unknown) => {
      assert.ok(error instanceof AebPackagePublicationError);
      assert.equal(error.code, "PUBLICATION_FAILED");
      assert.equal(error.rollbackReceipt.phase, "finalize");
      assert.equal(error.rollbackReceipt.successorPackage.ownedDestinationRemoved, false);
      assert.equal(error.rollbackReceipt.successorPackage.partialSuccessorPresent, false);
      return true;
    }
  );
  assert.deepEqual(await readFile(destinationPath), competingBytes);
  assert.equal((await listNames(fixture.taskRoot)).some((name) => name.startsWith("aeb-publish-temp-")), false);
});

test("a self-hashed forged AE receipt still requires independent execution authority", async (t) => {
  const fixture = await createFixture(t);
  const hasher = new Sha256ResourceHasher();
  const input = await createBuildInput(fixture, { hasher });
  const syntheticManifest = await buildAebBakeManifest(input);
  const afterEffectsTaskReceipt: AebBakeTaskReceipt = { ...fixture.receipt, producer: "after_effects" };
  await writeFile(path.join(fixture.taskRoot, ".aeb-bake-task.json"), JSON.stringify(afterEffectsTaskReceipt));
  const { receiptHash: ignoredSyntheticHash, ...syntheticReceiptWithoutHash } = input.executionReceipt;
  void ignoredSyntheticHash;
  const forgedWithoutHash: Omit<AebBakeExecutionReceipt, "receiptHash"> = {
    ...syntheticReceiptWithoutHash,
    mode: "after_effects",
    actualAeRenderExecuted: true,
    evidence: {
      kind: "after_effects",
      hostSessionId: "forged-host-session",
      aeVersion: "forged-ae-version",
      scriptDigest: digest("1"),
      renderReceiptDigest: digest("2")
    }
  };
  const forged: AebBakeExecutionReceipt = {
    ...forgedWithoutHash,
    receiptHash: hashCanonicalForTest(forgedWithoutHash, hasher)
  };
  await assertBakeError(
    () => buildAebBakeManifest({
      ...input,
      taskReceipt: afterEffectsTaskReceipt,
      executionReceipt: forged
    }),
    "AE_EXECUTION_AUTHORITY_REQUIRED"
  );

  const { manifestId: ignoredManifestId, ...forgedManifestWithoutId } = {
    ...syntheticManifest,
    execution: {
      ...syntheticManifest.execution,
      mode: "after_effects" as const,
      actualAeRenderExecuted: true
    },
    validation: {
      ...syntheticManifest.validation,
      actualAeRenderExecuted: true
    }
  };
  void ignoredManifestId;
  const forgedManifest = {
    ...forgedManifestWithoutId,
    manifestId: hashCanonicalForTest(forgedManifestWithoutId, hasher)
  };
  assert.equal(await verifyAebBakeManifestIntegrity(forgedManifest, hasher), false);
});

test("semantic validation rejects self-hashed contradictory bundles and receipts", async (t) => {
  const fixture = await createFixture(t);
  const hasher = new Sha256ResourceHasher();
  const manifest = await buildAebBakeManifest(await createBuildInput(fixture, { hasher }));
  const bundle = await reinsertAebBakePackage(baseIr, manifest, hasher);
  const { packageBundleId: ignoredBundleId, ...bundleWithoutId } = {
    ...bundle,
    resources: { ...bundle.resources, bakedCanonicalResourceIds: [] }
  };
  void ignoredBundleId;
  const contradictoryBundle = {
    ...bundleWithoutId,
    packageBundleId: hashCanonicalForTest(bundleWithoutId, hasher)
  } as AebReinsertedPackage;
  await assertBakeError(
    () => publishBundle(fixture, contradictoryBundle, hasher, "contradictory-bundle.json"),
    "PACKAGE_INTEGRITY_INVALID"
  );

  const publisher = new NodeAebBakePackagePublisher(fixture.authority);
  const published = await publishBundle(fixture, bundle, hasher, "semantic-successor.json", publisher);
  const { receiptHash: ignoredReceiptHash, ...receiptWithoutHash } = {
    ...published.publicationReceipt,
    cleanup: { ...published.publicationReceipt.cleanup, partialSuccessorPresent: true as const }
  };
  void ignoredReceiptHash;
  const contradictoryPublished = {
    ...published,
    publicationReceipt: {
      ...receiptWithoutHash,
      receiptHash: hashCanonicalForTest(receiptWithoutHash, hasher)
    }
  } as unknown as AebPublishedSuccessorPackage;
  await assertBakeError(
    () => createSvgaAebBakeAdapterInput(contradictoryPublished, hasher, publisher),
    "PACKAGE_INTEGRITY_INVALID"
  );

  const { manifestId: ignoredManifestId, ...manifestWithoutId } = {
    ...manifest,
    frames: manifest.frames.map((frame, index) => index === 0
      ? { ...frame, canonicalResourceId: manifest.frames[1].resourceId }
      : frame)
  };
  void ignoredManifestId;
  const contradictoryManifest = {
    ...manifestWithoutId,
    manifestId: hashCanonicalForTest(manifestWithoutId, hasher)
  };
  assert.equal(await verifyAebBakeManifestIntegrity(contradictoryManifest, hasher), false);
});

test("SVGA adapter entry re-reads the physical successor and rejects post-publication tampering", async (t) => {
  const fixture = await createFixture(t);
  const hasher = new Sha256ResourceHasher();
  const manifest = await buildAebBakeManifest(await createBuildInput(fixture, { hasher }));
  const bundle = await reinsertAebBakePackage(baseIr, manifest, hasher);
  const publisher = new NodeAebBakePackagePublisher(fixture.authority);
  const published = await publishBundle(fixture, bundle, hasher, "tamper-successor.json", publisher);
  const successorPath = path.join(fixture.taskRoot, "tamper-successor.json");
  const tampered = Buffer.from(await readFile(successorPath));
  tampered[tampered.length - 1] ^= 1;
  await writeFile(successorPath, tampered);

  await assertBakeError(
    () => createSvgaAebBakeAdapterInput(published, hasher, publisher),
    "PACKAGE_PUBLICATION_AUTHORITY_INVALID"
  );
});

test("resource and sequence identities do not collide for colon and dot job IDs", async (t) => {
  const colonJob: AebBakeJob = { ...baseJob, jobId: "job:collision" };
  const dotJob: AebBakeJob = { ...baseJob, jobId: "job.collision" };
  const colonFixture = await createFixture(t, { job: colonJob });
  const dotFixture = await createFixture(t, { job: dotJob });
  const colonPlanner: AebBakePlannerJoin = { ...basePlanner, jobId: colonJob.jobId };
  const dotPlanner: AebBakePlannerJoin = { ...basePlanner, jobId: dotJob.jobId };
  const colonManifest = await buildAebBakeManifest(await createBuildInput(colonFixture, {
    job: colonJob,
    planner: colonPlanner
  }));
  const dotManifest = await buildAebBakeManifest(await createBuildInput(dotFixture, {
    job: dotJob,
    planner: dotPlanner
  }));
  assert.notEqual(colonManifest.frames[0].resourceId, dotManifest.frames[0].resourceId);
});

test("equivalent replaceable-element ordering canonicalizes to one package identity", async (t) => {
  const fixture = await createFixture(t);
  const hasher = new Sha256ResourceHasher();
  const manifest = await buildAebBakeManifest(await createBuildInput(fixture, { hasher }));
  const withReplaceables = (ids: string[]): AebFormatNeutralIr => ({
    ...baseIr,
    layers: baseIr.layers.map((layer) => layer.plannerOutcome === "native"
      ? { ...layer, replaceableElementIds: ids }
      : layer)
  });
  const first = await reinsertAebBakePackage(withReplaceables(["owner-z-slot", "owner-a-slot"]), manifest, hasher);
  const second = await reinsertAebBakePackage(withReplaceables(["owner-a-slot", "owner-z-slot"]), manifest, hasher);
  assert.equal(first.packageBundleId, second.packageBundleId);
  assert.deepEqual(first.preservedNativeLayers[0].replaceableElementIds, ["owner-a-slot", "owner-z-slot"]);
});

test("bounded job enums and hard limits fail before resource allocation", async (t) => {
  const fixture = await createFixture(t);
  await assertBakeError(
    async () => buildAebBakeManifest(await createBuildInput(fixture, {
      job: {
        ...baseJob,
        target: { ...baseJob.target, kind: "composition" as unknown as "precomp" }
      }
    })),
    "JOB_INVALID"
  );
  await assertBakeError(
    async () => buildAebBakeManifest(await createBuildInput(fixture, {
      job: {
        ...baseJob,
        bbox: { ...baseJob.bbox, mode: "unknown" as unknown as "full_canvas" }
      }
    })),
    "JOB_INVALID"
  );
});

test("reinsertion rejects duplicate cross-source and nested replaceable identities", async (t) => {
  const fixture = await createFixture(t);
  const hasher = new Sha256ResourceHasher();
  const planner: AebBakePlannerJoin = {
    ...basePlanner,
    decisions: [
      ...basePlanner.decisions,
      { layerId: "layer-native-second", outcome: "native", reason: "native_second" }
    ]
  };
  const manifest = await buildAebBakeManifest(await createBuildInput(fixture, { planner, hasher }));
  const duplicateIr: AebFormatNeutralIr = {
    ...baseIr,
    layers: [
      ...baseIr.layers,
      {
        layerId: "layer-native-second",
        sourceId: "source-native-second",
        plannerOutcome: "native",
        replaceableElementIds: ["owner-title-slot"]
      }
    ]
  };
  await assertBakeError(
    () => reinsertAebBakePackage(duplicateIr, manifest, hasher),
    "SOURCE_IR_PLANNER_MISMATCH"
  );
  await assertBakeError(
    async () => reinsertAebBakePackage({
      ...baseIr,
      layers: baseIr.layers.map((layer, index) => index === 0
        ? { ...layer, replaceableElementIds: ["parent/child"] }
        : layer)
    }, await buildAebBakeManifest(await createBuildInput(fixture, { hasher })), hasher),
    "SOURCE_IR_PLANNER_MISMATCH"
  );
});

async function createFixture(
  t: test.TestContext,
  overrides: { receipt?: Partial<AebBakeTaskReceipt>; job?: AebBakeJob } = {}
): Promise<{
  job: AebBakeJob;
  taskBase: string;
  taskRoot: string;
  authority: NodeAebTaskRootAuthority;
  receipt: AebBakeTaskReceipt;
  frames: Array<{ frameIndex: number; relativePath: string }>;
}> {
  const job = overrides.job ?? baseJob;
  const taskBase = await mkdtemp(path.join(os.tmpdir(), "auto-svga-aeb-bake-base-"));
  const taskRoot = path.join(taskBase, job.task.taskId);
  await mkdir(taskRoot);
  await mkdir(path.join(taskRoot, "frames"));

  const image = createTransparentImage(4, 4);
  setPixel(image, 1, 1, [240, 120, 60, 180]);
  const bytes = encodeRgbaPng(image);
  await writeFile(path.join(taskRoot, "frames", "frame_000010.png"), bytes);
  await writeFile(path.join(taskRoot, "frames", "frame_000011.png"), bytes);
  await writeFile(path.join(taskRoot, "source-package.json"), JSON.stringify({
    schemaVersion: "synthetic-aeb-source-package-v1",
    packageId: job.packageId,
    sourceFingerprint: job.source.sourceFingerprint
  }));

  const receipt: AebBakeTaskReceipt = {
    schemaVersion: "aeb-bake-task-receipt-v1",
    taskId: job.task.taskId,
    receiptId: job.task.receiptId,
    jobId: job.jobId,
    packageId: job.packageId,
    sourceFingerprint: job.source.sourceFingerprint,
    outputDirectory: ".",
    cleanupPolicy: "delete_task_root_after_consumption",
    rollbackPolicy: "preserve_source_package",
    sourceProjectMutationAllowed: false,
    producer: "synthetic_fixture",
    ...overrides.receipt
  };
  await writeFile(path.join(taskRoot, ".aeb-bake-task.json"), JSON.stringify(receipt));
  const authority = new NodeAebTaskRootAuthority({
    approvedTaskBase: taskBase,
    taskId: job.task.taskId
  });
  t.after(async () => {
    await authority.close();
    await rm(taskBase, { recursive: true, force: true });
  });

  return {
    job,
    taskBase,
    taskRoot,
    authority,
    receipt,
    frames: [
      { frameIndex: 10, relativePath: "frames/frame_000010.png" },
      { frameIndex: 11, relativePath: "frames/frame_000011.png" }
    ]
  };
}

async function createBuildInput(
  fixture: Awaited<ReturnType<typeof createFixture>>,
  overrides: {
    job?: AebBakeJob;
    planner?: AebBakePlannerJoin;
    frames?: Array<{ frameIndex: number; relativePath: string }>;
    hasher?: EmbeddedResourceHasher;
    authority?: NodeAebTaskRootAuthority;
  } = {}
) {
  const job = overrides.job ?? fixture.job;
  const frames = overrides.frames ?? fixture.frames;
  const hasher = overrides.hasher ?? new Sha256ResourceHasher();
  return {
    job,
    planner: overrides.planner ?? basePlanner,
    taskReceipt: fixture.receipt,
    frames,
    executionReceipt: await createSyntheticAebBakeExecutionReceipt({
      job,
      frames,
      fixtureId: "synthetic-bac1-fixture"
    }, hasher),
    reader: new NodeAebBakeResourceReader(overrides.authority ?? fixture.authority),
    hasher
  };
}

async function publishBundle(
  fixture: Awaited<ReturnType<typeof createFixture>>,
  bundle: AebReinsertedPackage,
  hasher: Sha256ResourceHasher,
  successorFileName = "successor-package.json",
  publisher = new NodeAebBakePackagePublisher(fixture.authority)
): Promise<AebPublishedSuccessorPackage> {
  const sourceBytes = await readFile(path.join(fixture.taskRoot, "source-package.json"));
  return publisher.publish({
    bundle,
    sourcePackageRelativePath: "source-package.json",
    expectedSourcePackageHash: hasher.hash(sourceBytes).value,
    successorFileName,
    maxSourcePackageBytes: 64 * 1024,
    maxSuccessorPackageBytes: baseJob.budgets.maxPackageBytes,
    hasher
  });
}

async function assertBakeError(
  action: () => Promise<unknown>,
  code: string
): Promise<void> {
  await assert.rejects(action, (error: unknown) => {
    assert.ok(error instanceof AebBakePipelineError);
    assert.equal(error.code, code);
    return true;
  });
}

async function assertBakeErrorWithRedaction(
  action: () => Promise<unknown>,
  code: string,
  forbiddenPaths: string[]
): Promise<void> {
  await assert.rejects(action, (error: unknown) => {
    assert.ok(error instanceof AebBakePipelineError);
    assert.equal(error.code, code);
    for (const forbiddenPath of forbiddenPaths) {
      assert.equal(error.message.includes(forbiddenPath), false);
    }
    return true;
  });
}

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function listNames(directoryPath: string): Promise<string[]> {
  return readdir(directoryPath);
}

function hashCanonicalForTest(value: unknown, hasher: Sha256ResourceHasher): string {
  return hasher.hash(new TextEncoder().encode(JSON.stringify(sortValueForTest(value)))).value;
}

async function createRollbackAuthority(
  fixture: Awaited<ReturnType<typeof createFixture>>,
  hasher: Sha256ResourceHasher,
  successorFileName: string
): Promise<AebPackagePublicationRollbackAuthority> {
  const source = await fixture.authority.readBoundedTaskFile(
    "source-package.json",
    64 * 1024,
    "EXPECTED_SOURCE_PACKAGE"
  );
  return {
    taskId: fixture.job.task.taskId,
    receiptId: fixture.job.task.receiptId,
    jobId: fixture.job.jobId,
    packageId: fixture.job.packageId,
    sourcePackage: {
      relativePath: "source-package.json",
      contentHash: {
        algorithm: "sha256",
        value: hasher.hash(source.bytes).value,
        scope: "encoded_bytes"
      },
      identityDigest: source.identityDigest
    },
    successorPackage: {
      relativePath: successorFileName
    }
  };
}

function sortValueForTest(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortValueForTest);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left < right ? -1 : left > right ? 1 : 0)
      .map(([key, child]) => [key, sortValueForTest(child)]));
  }
  return value;
}
