import assert from "node:assert/strict";
import test from "node:test";

import type { MotionAssetInfo } from "../workbench/contracts.js";
import {
  VAP_OFFICIAL_WEB_ENTRYPOINT,
  VAP_OFFICIAL_WEB_PACKAGE,
  VAP_OFFICIAL_WEB_SOURCE_COMMIT,
  VAP_OFFICIAL_WEB_VERSION,
  VAP_PLAYBACK_PREPARATION_WP3B_GATE,
  VapPlaybackPreparationService,
  createCancelledVapPreparationToken
} from "../workbench/vap-playback-preparation.js";
import { VAP_COMPATIBILITY_MAX_DIMENSION } from "../workbench/vap-inspection.js";

test("VAP playback preparation requires the explicit hidden 0.2 gate", () => {
  const result = service().prepare(validVapAsset(), { gate: "0.1" });

  assert.equal(result.value, undefined);
  assert.equal(result.issues[0]?.code, "unsupported");
  assert.equal(result.issues[0]?.details?.reason, "gate_required");
});

test("normalizes the approved runtime candidate without importing or approving it", () => {
  const result = service().prepare(validVapAsset({
    name: "/Users/designer/Secret Campaign/effect.mp4"
  }), {
    gate: VAP_PLAYBACK_PREPARATION_WP3B_GATE,
    hostReadiness: readyHost(),
    providedFusionTags: ["avatar", "nickname"]
  });

  assert.ok(result.value);
  assert.equal(result.value.status, "dependency_pending");
  assert.equal(result.value.runtime.packageName, VAP_OFFICIAL_WEB_PACKAGE);
  assert.equal(result.value.runtime.version, VAP_OFFICIAL_WEB_VERSION);
  assert.equal(result.value.runtime.entryPoint, VAP_OFFICIAL_WEB_ENTRYPOINT);
  assert.equal(result.value.runtime.sourceCommit, VAP_OFFICIAL_WEB_SOURCE_COMMIT);
  assert.equal(result.value.runtime.dynamicImportOnly, true);
  assert.equal(result.value.runtime.networkAllowed, false);
  assert.equal(result.value.runtime.supportClaim, false);
  assert.equal(result.value.container.videoCodec, "avc1");
  assert.equal(result.value.container.audioPresent, false);
  assert.equal(result.value.container.overCompatibilityLimit, false);
  assert.deepEqual(result.value.fusionElements.map(({ kind }) => kind), ["image", "text"]);
  assert.deepEqual(result.value.fusionElements.map(({ replacementProvided }) => replacementProvided), [true, true]);
  assert.deepEqual(result.issues.map(({ code }) => code), ["missing_dependency"]);
  assertNoLocalPaths(result);
});

test("can become prepared only after dependency approval and host capabilities are present", () => {
  const result = service().prepare(validVapAsset(), {
    gate: VAP_PLAYBACK_PREPARATION_WP3B_GATE,
    dependencyApproval: "approved",
    hostReadiness: readyHost(),
    providedFusionTags: ["avatar", "nickname"]
  });

  assert.ok(result.value);
  assert.equal(result.value.status, "prepared");
  assert.equal(result.value.issues.length, 0);
  assert.deepEqual(result.value.lifecycle.cancellationBoundaries, [
    "before host range read",
    "after VAP inspection",
    "before object URL creation",
    "before dynamic runtime import",
    "immediately before runtime/container mutation"
  ]);
});

test("maps fusion image and text elements into deterministic runtime bindings", () => {
  const result = service().prepare(validVapAsset(), {
    gate: VAP_PLAYBACK_PREPARATION_WP3B_GATE,
    dependencyApproval: "approved",
    hostReadiness: readyHost(),
    providedFusionTags: ["avatar", "nickname"]
  });

  assert.ok(result.value);
  assert.equal(result.value.fusionElements[0]?.runtimeBindingKey, "avatar");
  assert.equal(result.value.fusionElements[0]?.replaceable, true);
  assert.equal(result.value.fusionElements[0]?.dimensions?.width, 120);
  assert.equal(result.value.fusionElements[0]?.fitType, "centerCrop");
  assert.equal(result.value.fusionElements[0]?.placementCount, 1);
  assert.deepEqual(result.value.fusionElements[0]?.zValues, [3]);
  assert.equal(result.value.fusionElements[1]?.runtimeBindingKey, "nickname");
  assert.equal(result.value.fusionElements[1]?.style, "bold");
});

test("warns for missing runtime replacement tags without blocking base playback", () => {
  const missing = service().prepare(validVapAsset(), {
    gate: VAP_PLAYBACK_PREPARATION_WP3B_GATE,
    dependencyApproval: "approved",
    hostReadiness: readyHost()
  });
  const missingReplacementIssues = missing.issues.filter(({ code, details }) =>
    code === "missing_resource" && details?.reason === "fusion_replacement_required"
  );

  assert.equal(missing.value?.status, "prepared");
  assert.equal(missingReplacementIssues.length, 2);
  assert.equal(missingReplacementIssues.every(({ severity }) => severity === "warning"), true);
  assert.equal(missing.value?.fusionElements[0]?.replacementRequired, true);
});

test("fails closed for ambiguous fusion bindings", () => {
  const duplicateTags = service().prepare(validVapAsset({ duplicateTag: true }), {
    gate: VAP_PLAYBACK_PREPARATION_WP3B_GATE,
    dependencyApproval: "approved",
    hostReadiness: readyHost(),
    providedFusionTags: ["avatar"]
  });

  assert.equal(duplicateTags.value?.status, "failed");
  assert.ok(duplicateTags.issues.some(({ code, details }) =>
    code === "ambiguous" && details?.reason === "ambiguous_fusion_source_tag"
  ));
  assert.deepEqual(
    duplicateTags.value?.fusionElements.map(({ runtimeBindingKey }) => runtimeBindingKey),
    ["avatar", "avatar"]
  );
});

test("blocks unsupported codec and missing host capabilities", () => {
  const result = service().prepare(validVapAsset({
    videoCodec: "hvc1"
  }), {
    gate: VAP_PLAYBACK_PREPARATION_WP3B_GATE,
    dependencyApproval: "approved",
    hostReadiness: {
      ...readyHost(),
      webglAvailable: false,
      cspAllowsBlobMedia: false
    },
    providedFusionTags: ["avatar", "nickname"]
  });

  assert.equal(result.value?.status, "blocked");
  assert.ok(result.issues.some(({ code, details }) =>
    code === "unsupported_feature" && details?.reason === "unsupported_video_codec"
  ));
  assert.ok(result.issues.some(({ code, details }) =>
    code === "capability" && details?.reason === "webgl_required"
  ));
  assert.ok(result.issues.some(({ code, details }) =>
    code === "capability" && details?.reason === "blob_media_csp_required"
  ));
});

test("keeps oversized H.264 VAP prepared with a compatibility warning", () => {
  const result = service().prepare(validVapAsset({
    displayWidth: VAP_COMPATIBILITY_MAX_DIMENSION + 1
  }), {
    gate: VAP_PLAYBACK_PREPARATION_WP3B_GATE,
    dependencyApproval: "approved",
    hostReadiness: readyHost(),
    providedFusionTags: ["avatar", "nickname"]
  });

  assert.equal(result.value?.status, "prepared");
  assert.equal(result.value?.container.overCompatibilityLimit, true);
  assert.deepEqual(result.issues.filter(({ details }) => details?.reason === "vap_dimensions_over_1504").map(({ severity }) => severity), ["warning"]);
});

test("fails closed for non-VAP assets, missing VAP metadata, and dangling layer resource ids", () => {
  const nonVap = service().prepare({
    ...validVapAsset(),
    format: "lottie"
  }, { gate: VAP_PLAYBACK_PREPARATION_WP3B_GATE });
  const missingMetadata = service().prepare({
    ...validVapAsset(),
    metadata: {}
  }, { gate: VAP_PLAYBACK_PREPARATION_WP3B_GATE });
  const danglingResource = service().prepare({
    ...validVapAsset(),
    layers: [{
      id: "vap_layer_missing",
      name: "missing",
      kind: "vap_fusion_image",
      resourceIds: ["missing_resource"],
      replaceable: true
    }]
  }, {
    gate: VAP_PLAYBACK_PREPARATION_WP3B_GATE,
    dependencyApproval: "approved",
    hostReadiness: readyHost()
  });

  assert.equal(nonVap.value, undefined);
  assert.equal(nonVap.issues[0]?.details?.reason, "vap_asset_required");
  assert.equal(missingMetadata.value, undefined);
  assert.equal(missingMetadata.issues[0]?.details?.reason, "vap_metadata_required");
  assert.equal(danglingResource.value?.status, "failed");
  assert.ok(danglingResource.issues.some(({ code, details }) =>
    code === "missing_resource" && details?.reason === "fusion_layer_resource_missing"
  ));
});

test("honors cancellation before producing a preparation model", () => {
  assert.throws(() => service().prepare(validVapAsset(), {
    gate: VAP_PLAYBACK_PREPARATION_WP3B_GATE,
    context: { cancellation: createCancelledVapPreparationToken() }
  }), /cancelled/u);
});

function service(): VapPlaybackPreparationService {
  return new VapPlaybackPreparationService();
}

function readyHost() {
  return {
    webglAvailable: true,
    h264Mp4DecodeAvailable: true,
    localObjectUrlAvailable: true,
    cspAllowsBlobMedia: true,
    gpuCompositingAvailable: true
  };
}

function validVapAsset(options: {
  name?: string;
  videoCodec?: string;
  displayWidth?: number;
  duplicateTag?: boolean;
} = {}): MotionAssetInfo {
  const displayWidth = options.displayWidth ?? 720;
  const secondTag = options.duplicateTag ? "avatar" : "nickname";
  return {
    format: "vap",
    name: options.name ?? "effect.mp4",
    sizeBytes: 4096,
    dimensions: { width: displayWidth, height: 405 },
    timing: { fps: 30, frameCount: 60, durationMs: 2000 },
    resources: [
      {
        id: "vap_fusion_avatar",
        name: "avatar",
        kind: "image",
        role: "static_image",
        dimensions: { width: 120, height: 120 },
        replaceable: true,
        metadata: {
          vapResourceType: "fusion_source",
          srcId: "1",
          srcTag: "avatar",
          srcType: "image",
          fitType: "centerCrop",
          replacementProvided: false
        }
      },
      {
        id: "vap_fusion_name",
        name: secondTag,
        kind: "unknown",
        role: "unknown",
        replaceable: true,
        metadata: {
          vapResourceType: "fusion_source",
          srcId: "2",
          srcTag: secondTag,
          srcType: "text",
          color: "#ffffff",
          style: "bold",
          replacementProvided: false
        }
      }
    ],
    layers: [
      {
        id: "vap_layer_avatar",
        name: "avatar",
        kind: "vap_fusion_image",
        resourceIds: ["vap_fusion_avatar"],
        replaceable: true,
        metadata: {
          placementCount: 1,
          placements: [{ frameIndex: 0, z: 3, frame: { x: 10, y: 20, w: 120, h: 120 } }],
          zValues: [3]
        }
      },
      {
        id: "vap_layer_name",
        name: secondTag,
        kind: "vap_fusion_text",
        resourceIds: ["vap_fusion_name"],
        replaceable: true,
        metadata: {
          placementCount: 1,
          placements: [{ frameIndex: 0, z: 4, frame: { x: 160, y: 20, w: 200, h: 40 } }],
          zValues: [4]
        }
      }
    ],
    metadata: {
      vap: {
        displayDimensions: { width: displayWidth, height: 405 },
        videoDimensions: { width: 720, height: 810 },
        frameCount: 60,
        fps: 30,
        durationMs: 2000,
        container: {
          videoCodec: options.videoCodec ?? "avc1",
          audioPresent: false,
          videoPresent: true,
          boundedSampleTruncated: false
        }
      }
    }
  };
}

function assertNoLocalPaths(value: unknown): void {
  const serialized = JSON.stringify(value);
  assert.doesNotMatch(serialized, /\/Users\/designer|C:\\\\Users\\\\designer/u);
}
