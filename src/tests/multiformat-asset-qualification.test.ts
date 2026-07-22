import assert from "node:assert/strict";
import test from "node:test";

import {
  buildMultiFormatAssetInventory,
  buildMultiFormatQualificationReadinessMatrix,
  classifyQualificationMaterial
} from "../workbench/multiformat-asset-qualification.js";

test("unified asset inventory groups Lottie images text candidates and unsupported markers", () => {
  const inventory = buildMultiFormatAssetInventory({
    format: "lottie",
    assets: [{
      id: "avatar",
      name: "Avatar",
      kind: "image",
      dimensions: "64 x 64",
      replaceable: true,
      resolutionStatus: "resolved"
    }],
    lottieTexts: [{
      id: "text:2",
      layerId: "2",
      name: "Title",
      initialText: "Hello",
      replaceable: true
    }],
    unsupportedFeatures: [{ feature: "expression", path: "layers.0.xp" }]
  });

  assert.equal(inventory.summary.totalItems, 3);
  assert.equal(inventory.summary.replaceableItems, 2);
  assert.equal(inventory.summary.imageCount, 1);
  assert.equal(inventory.summary.textCount, 1);
  assert.equal(inventory.pathRedacted, true);
  assert.equal(group(inventory, "image_resources").replaceableCount, 1);
  assert.equal(group(inventory, "text_candidates").replaceableCount, 1);
  assert.equal(group(inventory, "unsupported_or_missing").status, "warning");
  assert.equal(group(inventory, "vap_fusion_images").status, "not_applicable");
  assert.ok(inventory.capabilityMarkers.some((entry) => entry.label === "VAP fusion tags"));
  assert.deepEqual(
    group(inventory, "unsupported_or_missing").items.map(({ issueCode }) => issueCode),
    ["unsupported_feature"]
  );
});

test("Lottie external images keep runtime replacement without claiming confirmed designer intent", () => {
  const inventory = buildMultiFormatAssetInventory({
    format: "lottie",
    assets: [{
      id: "img_0",
      name: "psd_avatar.png",
      kind: "image",
      replaceable: false,
      technicalReplaceable: true,
      designerIntentQualified: false,
      resolutionStatus: "resolved"
    }]
  });
  const item = group(inventory, "image_resources").items[0];

  assert.equal(item?.status, "available");
  assert.equal(item?.replaceable, false);
  assert.equal(item?.runtimeTargetId, "img_0");
  assert.ok(item?.detail.includes("designer intent unqualified"));
});

test("unified asset inventory exposes VAP fusion tags media facts and missing replacements", () => {
  const inventory = buildMultiFormatAssetInventory({
    format: "vap",
    videoCodec: "avc1",
    audioPresent: true,
    vapFusionImages: [{
      id: "src:avatar",
      kind: "image",
      resourceId: "resource:avatar",
      srcTag: "avatar",
      replaceable: true,
      replacementRequired: true,
      replacementProvided: true,
      dimensions: { width: 120, height: 120 },
      zValues: [3]
    }],
    vapFusionTexts: [{
      id: "src:name",
      kind: "text",
      resourceId: "resource:name",
      srcTag: "nickname",
      replaceable: true,
      replacementRequired: true,
      replacementProvided: false
    }],
    issues: [{
      code: "missing_resource",
      severity: "warning",
      message: "Fusion text replacement is required.",
      path: "[local path]"
    }]
  });

  assert.equal(inventory.summary.imageCount, 1);
  assert.equal(inventory.summary.textCount, 1);
  assert.equal(inventory.summary.audioVideoCount, 2);
  assert.equal(group(inventory, "vap_fusion_images").replaceableCount, 1);
  assert.equal(group(inventory, "vap_fusion_texts").status, "blocked");
  assert.equal(group(inventory, "vap_fusion_texts").items[0]?.status, "missing");
  assert.equal(group(inventory, "audio_video_media").items[0]?.status, "available");
  assert.equal(group(inventory, "audio_video_media").items[1]?.label, "Audio track");
  assert.equal(group(inventory, "text_candidates").status, "not_applicable");
});

test("unified asset inventory keeps SVGA imageKey and sequence/media capabilities format-specific", () => {
  const inventory = buildMultiFormatAssetInventory({
    format: "svga",
    assets: [
      {
        id: "img_frame",
        name: "frame",
        kind: "image",
        role: "static_image",
        replaceable: true
      },
      {
        id: "seq_001",
        name: "sequence 001",
        kind: "image",
        role: "sequence_frame",
        replaceable: false
      },
      {
        id: "audio_0",
        name: "audio",
        kind: "audio",
        replaceable: false
      }
    ]
  });

  assert.equal(inventory.summary.imageCount, 1);
  assert.equal(inventory.summary.sequenceFrameCount, 1);
  assert.equal(inventory.summary.audioVideoCount, 1);
  assert.equal(group(inventory, "image_resources").replaceableCount, 1);
  assert.equal(group(inventory, "sequence_frames").items[0]?.id, "seq_001");
  assert.equal(group(inventory, "vap_fusion_images").status, "not_applicable");
  assert.equal(group(inventory, "text_candidates").status, "not_applicable");
});

test("read-only qualification matrix classifies local material metadata without copying assets", () => {
  assert.equal(classifyQualificationMaterial({ displayName: "hero.svga" }), "svga");
  assert.equal(classifyQualificationMaterial({ displayName: "title.JSON" }), "lottie_json");
  assert.equal(classifyQualificationMaterial({ displayName: "fusion.MP4" }), "vap_mp4");
  assert.equal(classifyQualificationMaterial({ displayName: "notes.txt" }), "unsupported");

  const matrix = buildMultiFormatQualificationReadinessMatrix([
    { displayName: "hero.svga", sizeBytes: 1024 },
    { displayName: "fusion.mp4", sizeBytes: 2048 },
    { displayName: "notes.txt", sizeBytes: 12 }
  ]);

  assert.equal(matrix.noAssetCopy, true);
  assert.equal(matrix.noMutation, true);
  assert.equal(matrix.foregroundRequired, false);
  assert.equal(bucket(matrix, "svga").count, 1);
  assert.equal(bucket(matrix, "vap_mp4").largestSizeBytes, 2048);
  assert.equal(bucket(matrix, "lottie_json").syntheticFallbackRequired, true);
  assert.deepEqual(matrix.requiredSyntheticFixtures, ["lottie_json"]);
  assert.equal(matrix.matrixReady, true);
});

test("unified asset inventory redacts path-like strings at the shared boundary", () => {
  const inventory = buildMultiFormatAssetInventory({
    format: "vap",
    assets: [{
      id: "/Users/alice/Secret Campaign/avatar.png",
      name: "C:\\Users\\alice\\Desktop\\avatar.png",
      kind: "image",
      dimensions: "/Users/alice/Secret Campaign/size.txt",
      replaceable: true
    }],
    lottieTexts: [{
      id: "/Users/alice/Secret Campaign/text-layer",
      layerId: "C:\\Users\\alice\\Desktop\\layer",
      name: "/Users/alice/Secret Campaign/title",
      initialText: "/Users/alice/Secret Campaign/copy.txt",
      replaceable: true
    }],
    vapFusionImages: [{
      id: "/Users/alice/Secret Campaign/fusion-image",
      kind: "image",
      resourceId: "/Users/alice/Secret Campaign/resource.png",
      srcTag: "/Users/alice/Secret Campaign/avatar",
      runtimeBindingKey: "C:\\Users\\alice\\Desktop\\runtime",
      replaceable: true,
      replacementRequired: true,
      replacementProvided: true
    }],
    vapFusionTexts: [{
      id: "C:\\Users\\alice\\Desktop\\fusion-text",
      kind: "text",
      resourceId: "C:\\Users\\alice\\Desktop\\resource.txt",
      srcTag: "/Users/alice/Secret Campaign/name",
      runtimeBindingKey: "C:\\Users\\alice\\Desktop\\name-runtime",
      replaceable: true,
      replacementRequired: true,
      replacementProvided: false
    }],
    issues: [{
      code: "missing_resource",
      severity: "warning",
      message: "Missing /Users/alice/Secret Campaign/avatar.png and C:\\Users\\alice\\Desktop\\avatar.png",
      path: "/Users/alice/Secret Campaign/avatar.png"
    }],
    unsupportedFeatures: [{
      feature: "mask /Users/alice/Secret Campaign/private",
      path: "assets.0.layers.0.ef /Users/alice/Secret Campaign/private.json"
    }]
  });

  const serialized = JSON.stringify(inventory);
  assert.equal(inventory.pathRedacted, true);
  assert.doesNotMatch(serialized, /\/Users\/alice/u);
  assert.doesNotMatch(serialized, /C:\\\\Users\\\\alice/u);
  assert.doesNotMatch(serialized, /:\\\\Users\\\\alice/u);
  assert.doesNotMatch(serialized, /\\\\Users\\\\alice/u);
  assert.doesNotMatch(serialized, /alice/u);
  assert.doesNotMatch(serialized, /Secret Campaign/u);
  assert.doesNotMatch(serialized, /Desktop/u);
  assert.match(serialized, /\[local path\]/u);
});

type Inventory = ReturnType<typeof buildMultiFormatAssetInventory>;
type Matrix = ReturnType<typeof buildMultiFormatQualificationReadinessMatrix>;

function group(inventory: Inventory, id: Inventory["groups"][number]["id"]) {
  const found = inventory.groups.find((entry) => entry.id === id);
  assert.ok(found, `expected group ${id}`);
  return found;
}

function bucket(matrix: Matrix, kind: Matrix["buckets"][number]["kind"]) {
  const found = matrix.buckets.find((entry) => entry.kind === kind);
  assert.ok(found, `expected bucket ${kind}`);
  return found;
}
