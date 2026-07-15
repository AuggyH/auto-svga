import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const experimentRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const {
  TASK_RUNTIME_ORACLE_PHASES,
  createFusionVapcDocument,
  createTaskRuntimeFixtureSet,
  readTaskRuntimeFixtureContract
} = require("../scripts/multiformat-task-runtime-fixtures.cjs");
const {
  assertOwnerInventoryProjection,
  requireOwnerSnapshot
} = require("../scripts/run-multiformat-task-fixture-source-oracle.cjs");

test("task-owned runtime fixture contract fails closed for missing resources and malformed external contracts", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "auto-svga-task-fixture-negative-"));
  try {
    const fixtureSet = createTaskRuntimeFixtureSet({ root });
    await rm(fixtureSet.files.lottieImagePath);
    const missingImage = readTaskRuntimeFixtureContract({ root });
    assert.equal(missingImage.status, "failed");
    assert.equal(missingImage.findings.some(({ code }) => code === "lottieImage_missing"), true);
    assert.doesNotMatch(JSON.stringify(missingImage), /auto-svga-task-fixture-negative|\/Users\//u);

    createTaskRuntimeFixtureSet({ root });
    const lottieWithFonts = JSON.parse(readFileSync(fixtureSet.files.lottiePath, "utf8"));
    lottieWithFonts.fonts = { list: [{ fName: "Deferred-Font" }] };
    await writeFile(fixtureSet.files.lottiePath, `${JSON.stringify(lottieWithFonts)}\n`);
    const deferredFont = readTaskRuntimeFixtureContract({ root });
    assert.equal(deferredFont.status, "failed");
    assert.equal(deferredFont.findings.some(({ code }) => code === "lottie_fixture_fonts_deferred"), true);
    assert.doesNotMatch(JSON.stringify(deferredFont), /auto-svga-task-fixture-negative|\/Users\//u);

    createTaskRuntimeFixtureSet({ root });
    await rm(fixtureSet.files.vapSidecarPath);
    const missingSidecar = readTaskRuntimeFixtureContract({ root });
    assert.equal(missingSidecar.status, "failed");
    assert.equal(missingSidecar.findings.some(({ code }) => code === "vapSidecar_missing"), true);
    assert.doesNotMatch(JSON.stringify(missingSidecar), /auto-svga-task-fixture-negative|\/Users\//u);

    createTaskRuntimeFixtureSet({ root });
    await writeFile(fixtureSet.files.vapSidecarPath, "{not-json");
    const malformedSidecar = readTaskRuntimeFixtureContract({ root });
    assert.equal(malformedSidecar.status, "failed");
    assert.equal(malformedSidecar.findings.some(({ code }) => code === "vap_sidecar_json_invalid"), true);
    assert.doesNotMatch(JSON.stringify(malformedSidecar), /auto-svga-task-fixture-negative|\/Users\//u);

    createTaskRuntimeFixtureSet({ root });
    await writeFile(
      fixtureSet.files.vapSidecarPath,
      `${JSON.stringify(createFusionVapcDocument({
        src: [{ srcId: "avatar", srcTag: "badge", srcType: "image", w: 24, h: 24 }]
      }))}\n`
    );
    const fusionDrift = readTaskRuntimeFixtureContract({ root });
    assert.equal(fusionDrift.status, "failed");
    assert.equal(fusionDrift.findings.some(({ code }) => code === "vap_fusion_target_contract_drift"), true);
    assert.doesNotMatch(JSON.stringify(fusionDrift), /auto-svga-task-fixture-negative|\/Users\//u);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("task-owned source oracle binds external-image Lottie and fusion VAP without launching Electron", async () => {
  const oracleScript = path.join(experimentRoot, "scripts/run-multiformat-task-fixture-source-oracle.cjs");
  const output = execFileSync(process.execPath, [oracleScript], {
    cwd: path.resolve(experimentRoot, "../../../.."),
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"]
  }).trim();
  const result = JSON.parse(output);
  assert.equal(result.status, "passed");
  assert.match(result.proofOutputPath, /multiformat-task-fixture-source-oracle\.json$/u);

  const proof = JSON.parse(readFileSync(result.proofOutputPath, "utf8"));
  try {
    assert.equal(proof.status, "passed");
    assert.equal(proof.pathRedacted, true);
    assert.equal(proof.productMilestoneId, "0.2-multiformat-preview");
    assert.equal(proof.boundaries.electronLaunched, false);
    assert.equal(proof.boundaries.foregroundUsed, false);
    assert.equal(proof.boundaries.runtimePixelPlayback, false);
    assert.deepEqual(
      TASK_RUNTIME_ORACLE_PHASES.filter((phase) => phase !== "redacted_evidence_written").every((phase) =>
        proof.signals.some((signal) => signal.phase === phase)
      ),
      true
    );

    assert.equal(proof.fixtureContract.status, "passed");
    assert.equal(proof.fixtureContract.fixtures.lottie.externalImage.relativeResource, "images/avatar.png");
    assert.equal(proof.lottie.open.format, "lottie");
    assert.deepEqual(proof.lottie.open.ownerGroupIds, ["image_resources", "text_candidates"]);
    assert.equal(proof.lottie.runtime.externalImageInlined, true);
    assert.equal(proof.lottie.replacement.resetRestoredSource, true);
    assert.equal(proof.lottie.replacement.siblingPreserved, true);
    assert.equal(proof.lottie.playback.playedStatus, "playing");
    assert.equal(proof.lottie.playback.pausedStatus, "paused");

    assert.equal(proof.fixtureContract.fixtures.vap.expectedFusionTargets.length, 2);
    assert.equal(proof.vap.open.format, "vap");
    assert.deepEqual(proof.vap.open.ownerGroupIds, [
      "vap_fusion_images",
      "vap_fusion_texts",
      "audio_video_media",
      "unsupported_or_missing"
    ]);
    assert.equal(proof.vap.open.ownerIssueCount, 1);
    assert.equal(proof.vap.runtime.vapConfigSource, "adjacent_json");
    assert.equal(proof.vap.replacement.imageRuntimeTarget, "avatar");
    assert.equal(proof.vap.replacement.textRuntimeTarget, "title");
    assert.equal(proof.vap.replacement.canonicalImageKeyUsed, true);
    assert.equal(proof.vap.replacement.resetRestoredSource, true);
    assert.equal(proof.vap.playback.playedStatus, "playing");
    assert.equal(proof.vap.playback.pausedStatus, "paused");

    const serialized = JSON.stringify(proof);
    assert.doesNotMatch(serialized, /\/Users\/huangtengxin|auto-svga-task-fixture-source-oracle-|external-image-lottie\.json|fusion-vap\.mp4|replacement\.png/u);
  } finally {
    await rm(path.dirname(result.proofOutputPath), { recursive: true, force: true });
  }
});

test("task fixture source oracle rejects adversarial owner snapshot envelopes", async () => {
  const validSnapshot = ownerSnapshot({
    assetInventory: {
      ...ownerInventory(),
      format: "lottie",
      groups: [{
        id: "image_resources",
        label: "图片",
        count: 1,
        replaceableCount: 1,
        status: "available",
        items: [ownerInventoryItem({ id: "avatar", groupId: "image_resources", kind: "image", source: "asset", runtimeTargetId: "avatar" })]
      }, {
        id: "text_candidates",
        label: "文本",
        count: 1,
        replaceableCount: 1,
        status: "available",
        items: [ownerInventoryItem({ id: "text:2", groupId: "text_candidates", kind: "text", source: "text", runtimeTargetId: "text:2" })]
      }],
      summary: {
        totalItems: 2,
        replaceableItems: 2,
        imageCount: 1,
        textCount: 1,
        sequenceFrameCount: 0,
        audioVideoCount: 0,
        unsupportedOrMissingCount: 0
      }
    },
    imageTargets: [{ imageKey: "avatar", resourceId: "avatar", displayName: "Avatar", detail: "1 x 1" }],
    textTargets: [{ textKey: "text:2", displayName: "Title", initialText: "Task title", placeholder: "输入文字以预览", resetDisabled: false }]
  });
  const opened = openedWithEnvelope(envelopeFromSnapshot(validSnapshot));
  const accepted = await requireOwnerSnapshot(opened, "lottie");
  assertOwnerInventoryProjection(accepted, {
    expectedGroupIds: ["image_resources", "text_candidates"],
    expectedImageTargetIds: ["avatar"],
    expectedTextTargetIds: ["text:2"]
  });

  const extraField = ownerSnapshot({
    ...validSnapshot,
    ownerPath: "/Users/owner/private/source.json"
  });
  await assert.rejects(() => requireOwnerSnapshot(openedWithEnvelope(envelopeFromSnapshot(extraField)), "lottie"), /owner|snapshot|canonical|invalid/i);

  const extraTarget = ownerSnapshot({
    ...validSnapshot,
    assetInventory: {
      ...validSnapshot.assetInventory,
      groups: validSnapshot.assetInventory.groups.map((group) => group.id === "image_resources"
        ? {
            ...group,
            count: 2,
            replaceableCount: 2,
            items: [
              ...group.items,
              ownerInventoryItem({
                id: "unexpected-extra-image",
                groupId: "image_resources",
                kind: "image",
                source: "asset",
                runtimeTargetId: "unexpected-extra-image"
              })
            ]
          }
        : group),
      summary: {
        ...validSnapshot.assetInventory.summary,
        totalItems: 3,
        replaceableItems: 3,
        imageCount: 2
      }
    },
    imageTargets: [
      ...validSnapshot.imageTargets,
      { imageKey: "unexpected-extra-image", resourceId: "unexpected-extra-image", displayName: "Extra", detail: "1 x 1" }
    ]
  });
  const extraTargetSnapshot = await requireOwnerSnapshot(openedWithEnvelope(envelopeFromSnapshot(extraTarget)), "lottie");
  assert.throws(() => assertOwnerInventoryProjection(extraTargetSnapshot, {
    expectedGroupIds: ["image_resources", "text_candidates"],
    expectedImageTargetIds: ["avatar"],
    expectedTextTargetIds: ["text:2"]
  }), /extra|target|inventory|drift/i);

  const missingTarget = ownerSnapshot({
    ...validSnapshot,
    assetInventory: {
      ...validSnapshot.assetInventory,
      groups: validSnapshot.assetInventory.groups.filter((group) => group.id !== "text_candidates"),
      summary: {
        ...validSnapshot.assetInventory.summary,
        totalItems: 1,
        replaceableItems: 1,
        textCount: 0
      }
    },
    textTargets: []
  });
  const missingTargetSnapshot = await requireOwnerSnapshot(openedWithEnvelope(envelopeFromSnapshot(missingTarget)), "lottie");
  assert.throws(() => assertOwnerInventoryProjection(missingTargetSnapshot, {
    expectedGroupIds: ["image_resources", "text_candidates"],
    expectedImageTargetIds: ["avatar"],
    expectedTextTargetIds: ["text:2"]
  }), /missing|target|groups|inventory/i);

  const duplicateTarget = ownerSnapshot({
    ...validSnapshot,
    imageTargets: [
      ...validSnapshot.imageTargets,
      { imageKey: "avatar-copy", resourceId: "avatar", displayName: "Avatar Copy", detail: "1 x 1" }
    ]
  });
  const duplicateTargetSnapshot = await requireOwnerSnapshot(openedWithEnvelope(envelopeFromSnapshot(duplicateTarget)), "lottie");
  assert.throws(() => assertOwnerInventoryProjection(duplicateTargetSnapshot, {
    expectedGroupIds: ["image_resources", "text_candidates"],
    expectedImageTargetIds: ["avatar"],
    expectedTextTargetIds: ["text:2"]
  }), /duplicate|target|snapshot|invalid/i);

  const fakeDigestEnvelope = envelopeFromSnapshot(ownerSnapshot({
    ...validSnapshot,
    rawPath: "/Users/owner/private/source.json"
  }));
  await assert.rejects(() => requireOwnerSnapshot(openedWithEnvelope(fakeDigestEnvelope), "lottie"), /owner|snapshot|canonical|invalid/i);

  const noncanonicalSnapshotJson = JSON.stringify(validSnapshot);
  assert.notEqual(noncanonicalSnapshotJson, stableStringify(validSnapshot));
  await assert.rejects(() => requireOwnerSnapshot(openedWithEnvelope({
    schemaVersion: 1,
    sourceId: "source-a",
    snapshotJson: noncanonicalSnapshotJson,
    snapshotByteLength: Buffer.byteLength(noncanonicalSnapshotJson, "utf8"),
    snapshotSha256: createHash("sha256").update(noncanonicalSnapshotJson).digest("hex"),
    pathRedacted: true
  }), "lottie"), /canonical|snapshot|invalid/i);

});

function openedWithEnvelope(envelope) {
  return {
    sourceId: "source-a",
    model: {
      ownerRightPanelSnapshotEnvelope: envelope
    }
  };
}

function envelopeFromSnapshot(snapshot) {
  const snapshotJson = stableStringify(snapshot);
  return {
    schemaVersion: 1,
    sourceId: "source-a",
    snapshotJson,
    snapshotByteLength: Buffer.byteLength(snapshotJson, "utf8"),
    snapshotSha256: createHash("sha256").update(snapshotJson).digest("hex"),
    pathRedacted: true
  };
}

function ownerSnapshot(overrides = {}) {
  return {
    assetInventory: ownerInventory(),
    assets: [],
    facts: [{ id: "format", label: "格式", status: "pass", value: "LOTTIE" }],
    imageTargets: [],
    issues: [],
    pathRedacted: true,
    schemaVersion: 1,
    textTargets: [],
    unsupportedFeatures: [],
    ...overrides
  };
}

function ownerInventory(overrides = {}) {
  return {
    capabilityMarkers: [],
    format: "lottie",
    groups: [],
    pathRedacted: true,
    schemaVersion: 1,
    summary: {
      audioVideoCount: 0,
      imageCount: 0,
      replaceableItems: 0,
      sequenceFrameCount: 0,
      textCount: 0,
      totalItems: 0,
      unsupportedOrMissingCount: 0
    },
    ...overrides
  };
}

function ownerInventoryItem(overrides = {}) {
  return {
    detail: [],
    groupId: "image_resources",
    id: "avatar",
    kind: "image",
    label: "Avatar",
    pathRedacted: true,
    replaceable: true,
    runtimeTargetId: "avatar",
    source: "asset",
    status: "replaceable",
    ...overrides
  };
}

function stableStringify(value) {
  if (value === null) return "null";
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  if (typeof value === "object") {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}
