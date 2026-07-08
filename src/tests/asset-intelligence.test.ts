import assert from "node:assert/strict";
import test from "node:test";
import {
  createAssetIntelligenceReport,
  filterAssetIntelligenceResources,
  sortAssetIntelligenceResources
} from "../workbench/asset-intelligence.js";
import type {
  ImageAlphaBounds,
  MotionAssetInfo,
  MotionResourceInfo,
  MotionResourceRole,
  WorkbenchIssue
} from "../workbench/contracts.js";
import { estimateDecodedMemory } from "../workbench/memory-estimation.js";
import type { RuntimeStructureDiagnostics } from "../workbench/runtime-structure-diagnostics.js";
import { diagnoseSequenceResidency } from "../workbench/sequence-residency-diagnostics.js";
import { collectSequenceFrameEvidence } from "../workbench/sequence-frame-evidence.js";

test("reports safe unreferenced resources and byte-identical duplicate candidates", () => {
  const resources = [
    resource("frame", "static_image", { sizeBytes: 100, hash: "frame", replaceable: true }),
    resource("unused", "unknown", { sizeBytes: 40, hash: "unused" }),
    resource("duplicate_a", "static_image", { sizeBytes: 30, hash: "dup" }),
    resource("duplicate_b", "static_image", { sizeBytes: 35, hash: "dup" })
  ];
  const report = intelligence(resources, [], [
    layer("layer-frame", ["frame"]),
    layer("layer-duplicate", ["duplicate_a"])
  ]);

  assert.deepEqual(
    report.findings.map(({ code }) => code),
    [
      "unreferenced_image_resource",
      "unreferenced_image_resource",
      "duplicate_encoded_image_resource"
    ]
  );
  assert.equal(report.summary.safeAutoOptimizeFindingCount, 3);
  assert.equal(report.summary.estimatedSafeFileSizeSavingsBytes, null);
  assert.equal(report.resources.find(({ resourceId }) => resourceId === "unused")?.usageCount, 0);
  assert.ok(report.resources.find(({ resourceId }) => resourceId === "unused")?.concepts.includes("未引用资源"));
  assert.ok(report.resources.find(({ resourceId }) => resourceId === "frame")?.concepts.includes("可替换资源"));
});

test("keeps referenced transparent and padded resources out of automatic optimization", () => {
  const resources = [
    resource("transparent", "static_image", {
      sizeBytes: 10,
      alphaBounds: { status: "fullyTransparent" }
    }),
    resource("padded", "static_image", {
      sizeBytes: 20,
      alphaBounds: alpha(0.75)
    })
  ];
  const report = intelligence(resources, [
    issue("resource_transparent_padding_exceeds_limit", "warning", "padded")
  ], [
    layer("transparent-layer", ["transparent"]),
    layer("padded-layer", ["padded"])
  ]);

  const transparent = report.findings.find(({ code }) => code === "fully_transparent_image_resource");
  const padded = report.findings.find(({ code }) => code === "excessive_transparent_padding");

  assert.equal(transparent?.optimizationDisposition, "requires_visual_confirmation");
  assert.equal(transparent?.safeToAutoOptimize, false);
  assert.equal(transparent?.severity, "error");
  assert.equal(padded?.optimizationDisposition, "requires_visual_confirmation");
  assert.equal(padded?.estimatedDecodedMemoryImpactBytes, 20 * 30 * 4 * 0.75);
});

test("summarizes sequence memory and missing evidence as product-facing findings", () => {
  const resources = [
    resource("seq_001", "sequence_frame", { width: 1024, height: 1024, hash: undefined, alphaBounds: { status: "unknown" } }),
    resource("seq_002", "sequence_frame", { width: 1024, height: 1024, hash: undefined, alphaBounds: { status: "unknown" } }),
    resource("seq_003", "sequence_frame", { width: 1024, height: 1024, hash: undefined, alphaBounds: { status: "unknown" } })
  ];
  const report = intelligence(resources, [], [
    layer("sequence-layer", ["seq_001", "seq_002", "seq_003"])
  ]);

  assert.ok(report.findings.some(({ code }) => code === "sequence_frame_memory_concentration"));
  assert.ok(report.findings.some(({ code }) => code === "sequence_frame_analysis_incomplete"));
  assert.equal(report.summary.unsupportedFindingCount, 1);
});

test("classifies runtime structure risk and safe all-zero pruning separately", () => {
  const report = intelligence([
    resource("seq_001", "sequence_frame"),
    resource("seq_002", "sequence_frame"),
    resource("seq_003", "sequence_frame")
  ], [], [
    layer("runtime-1", ["seq_001"]),
    layer("runtime-2", ["seq_002"])
  ], runtimeStructureDiagnostics());

  assert.deepEqual(
    report.findings
      .filter(({ code }) => code.includes("runtime") || code.includes("fanout"))
      .map(({ code, optimizationDisposition, safeToAutoOptimize }) => ({
        code,
        optimizationDisposition,
        safeToAutoOptimize
      })),
    [
      {
        code: "runtime_structure_complexity_risk",
        optimizationDisposition: "suggestion_only",
        safeToAutoOptimize: false
      },
      {
        code: "all_zero_runtime_object_prunable",
        optimizationDisposition: "safe_auto_optimize",
        safeToAutoOptimize: true
      },
      {
        code: "sequence_frame_fanout_risk",
        optimizationDisposition: "structural_risky",
        safeToAutoOptimize: false
      }
    ]
  );
});

test("sorts and filters resources by product table controls", () => {
  const report = intelligence([
    resource("a", "static_image", { width: 10, height: 10, sizeBytes: 50 }),
    resource("b", "sequence_frame", { width: 100, height: 100, sizeBytes: 20 }),
    resource("c", "static_image", { width: 5, height: 5, sizeBytes: 200 })
  ], [
    issue("resource_transparent_padding_exceeds_limit", "warning", "c")
  ], [
    layer("a-layer", ["a"]),
    layer("b-layer", ["b"])
  ]);

  assert.deepEqual(
    sortAssetIntelligenceResources(report.resources, "compressedSizeBytes")
      .map(({ resourceId }) => resourceId),
    ["c", "a", "b"]
  );
  assert.deepEqual(
    sortAssetIntelligenceResources(report.resources, "usageCount")
      .map(({ resourceId }) => resourceId),
    ["a", "b", "c"]
  );
  assert.deepEqual(
    filterAssetIntelligenceResources(report.resources, {
      concept: "未引用资源",
      abnormalityAtLeast: "medium"
    }).map(({ resourceId }) => resourceId),
    ["c"]
  );
  assert.deepEqual(
    filterAssetIntelligenceResources(report.resources, {
      role: "sequence_frame",
      query: "b"
    }).map(({ resourceId }) => resourceId),
    ["b"]
  );
});

function intelligence(
  resources: MotionResourceInfo[],
  issues: WorkbenchIssue[] = [],
  layers: MotionAssetInfo["layers"] = [],
  runtimeStructureDiagnostics?: RuntimeStructureDiagnostics
) {
  const asset: MotionAssetInfo = {
    format: "svga",
    name: "asset-intelligence-fixture.svga",
    sizeBytes: resources.reduce((total, item) => total + (item.sizeBytes ?? 0), 0),
    dimensions: { width: 300, height: 300 },
    timing: { fps: 24, frameCount: 72, durationMs: 3000 },
    layers,
    resources
  };
  const memoryEstimation = estimateDecodedMemory(resources);
  return createAssetIntelligenceReport({
    asset,
    issues,
    memoryEstimation,
    runtimeStructureDiagnostics,
    sequenceResidencyDiagnostics: diagnoseSequenceResidency(resources, memoryEstimation),
    sequenceFrameEvidence: collectSequenceFrameEvidence(resources)
  });
}

function runtimeStructureDiagnostics(): RuntimeStructureDiagnostics {
  return {
    schemaVersion: 1,
    spriteCount: 1200,
    frameEntityCount: 144000,
    alphaPositiveFrameCount: 120000,
    zeroAlphaFrameCount: 24000,
    lowAlphaFrameCount: 0,
    targetPlayerVisibleFrameCount: null,
    invisibleFrameRatio: 1 / 6,
    lowAlphaFrameRatio: 0,
    perFrameVisibleSpritePeak: 1100,
    perFrameVisibleSpriteAverage: 1000,
    estimatedRuntimeStructureBytes: 16 * 1024 * 1024,
    estimatedRuntimeStructureMiB: 16,
    riskLevel: "high",
    allZeroSpriteCount: 1,
    allZeroFrameEntityCount: 120,
    allZeroSpriteResourceIds: ["seq_001"],
    sequenceFrameFanout: {
      groupCount: 1,
      totalSpriteReferences: 120,
      maxSpriteReferencesInGroup: 120,
      groups: [{
        groupId: "seq",
        resourceIds: ["seq_001", "seq_002", "seq_003"],
        spriteReferenceCount: 120,
        estimatedInstanceCount: 40
      }]
    },
    evidence: [],
    limitations: []
  };
}

function resource(
  id: string,
  role: MotionResourceRole,
  options: {
    width?: number;
    height?: number;
    sizeBytes?: number;
    hash?: string;
    alphaBounds?: ImageAlphaBounds;
    replaceable?: boolean;
  } = {}
): MotionResourceInfo {
  const width = options.width ?? 20;
  const height = options.height ?? 30;
  return {
    id,
    name: id,
    kind: "image",
    role,
    sizeBytes: options.sizeBytes ?? width * height,
    dimensions: { width, height },
    alphaBounds: options.alphaBounds ?? alpha(0),
    contentHash: options.hash === undefined
      ? undefined
      : { algorithm: "sha256", value: options.hash, scope: "encoded_bytes" },
    replaceable: options.replaceable
  };
}

function alpha(transparentPaddingRatio: number): ImageAlphaBounds {
  return {
    status: "known",
    x: 0,
    y: 0,
    width: 20,
    height: 30,
    transparentPaddingRatio
  };
}

function layer(id: string, resourceIds: readonly string[]): MotionAssetInfo["layers"][number] {
  return {
    id,
    name: id,
    kind: "sprite",
    resourceIds
  };
}

function issue(
  code: string,
  severity: WorkbenchIssue["severity"],
  resourceId: string
): WorkbenchIssue {
  return {
    code,
    severity,
    message: code,
    details: { resourceId }
  };
}
