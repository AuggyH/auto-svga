import { createHash } from "node:crypto";
import { constants, type BigIntStats } from "node:fs";
import { link, lstat, open, unlink } from "node:fs/promises";
import path from "node:path";
import { deflateSync, inflateSync } from "node:zlib";
import { decode } from "fast-png";
import { buildSvgaMap } from "../core/svga-map-builder.js";
import {
  buildGeneratedNativeMoviePayload,
  validateSvgaBytes,
  type SvgaGeneratedNativeAuthorityResource
} from "../exporters/svga-exporter.js";
import type { AvatarFrameProject, ProjectAsset, ProjectLayer } from "../types/project.js";
import type {
  AebFormatNeutralIr,
  AebFormatNeutralIrLayer,
  AebNativeLayerPayload
} from "../workbench/aeb-bake-contracts.js";
import type {
  AebRetainedBakeAuthorityChainReceipt,
  CreateAebRetainedBakeAuthorityChainInput
} from "../workbench/aeb-retained-bake-authority-chain.js";
import { verifyAebRetainedBakeAuthorityChainReceipt } from "../workbench/aeb-retained-bake-authority-chain.js";
import { AebBakePipelineError } from "../workbench/aeb-bake-pipeline.js";
import {
  NodeAebTaskRootAuthority,
  type AebBoundedTaskFile
} from "./aeb-node-bake-resource-reader.js";
import {
  AEB_REVIEWED_SVGA_DESCRIPTOR_SHA256,
  AEB_REVIEWED_SVGA_PROTO_FILE_SHA256,
  loadAebReviewedSvgaSchemaAuthority
} from "./aeb-reviewed-svga-schema.js";

export const AEB_RETAINED_BAKE_FULL_COMPOSITION_SCHEMA_VERSION =
  "aeb-retained-bake-full-composition-v1" as const;

export interface AebRetainedBakeFullCompositionResult {
  schemaVersion: typeof AEB_RETAINED_BAKE_FULL_COMPOSITION_SCHEMA_VERSION;
  authorityState: "source_validated_mixed_composition_output";
  output: {
    relativePath: string;
    encodedBytes: number;
    contentHash: string;
    identityDigest: string;
    atomicAbsentDestination: true;
    noOverwrite: true;
  };
  schema: {
    protoFileSha256: typeof AEB_REVIEWED_SVGA_PROTO_FILE_SHA256;
    descriptorSha256: typeof AEB_REVIEWED_SVGA_DESCRIPTOR_SHA256;
  };
  standardsValidSvga: true;
  nativeMergeCompleted: true;
  fullCompositionEncoded: true;
  sourceLayerOrder: readonly string[];
  sourceLayerAuthority: readonly {
    layerId: string;
    plannerOutcome: "native" | "bake_required";
    stackIndex: number;
    activeRange: { startFrame: number; endFrameExclusive: number };
  }[];
  sourceTimebase: { startFrame: number; endFrameExclusive: number; fps: number };
  preservedNativePayloadHashes: readonly string[];
  preservedReplaceableElementIds: readonly string[];
  resourceBindings: readonly {
    ownerLayerId: string;
    resourceId: string;
    relativePath: string;
    contentHash: string;
    identityDigest: string;
  }[];
  validation: {
    standardsValidSvga: true;
    generatedNativeAuthorityValid: true;
    canonicalWireEncoding: true;
    nativeMergeCompleted: true;
    fullCompositionEncoded: true;
    sourceProjectUnchanged: true;
    sourcePackageUnchanged: true;
    successorPackageUnchanged: true;
    protectedReplaceableElementsPreserved: true;
    previewOrSaveAuthorized: false;
  };
  resultHash: string;
}

export interface AebRetainedBakeFullCompositionInput {
  chainReceipt: AebRetainedBakeAuthorityChainReceipt;
  chainInput: CreateAebRetainedBakeAuthorityChainInput;
  sourceIr: AebFormatNeutralIr;
}

interface BoundInput {
  ownerLayerId: string;
  resourceId: string;
  relativePath: string;
  contentHash: string;
  identityDigest: string;
  file: AebBoundedTaskFile;
}

interface Candidate {
  bytes: Buffer;
  contentHash: string;
  project: AvatarFrameProject;
  resources: readonly SvgaGeneratedNativeAuthorityResource[];
  boundInputs: readonly BoundInput[];
  sourceLayerOrder: readonly string[];
  sourceLayerAuthority: AebRetainedBakeFullCompositionResult["sourceLayerAuthority"];
  sourceTimebase: AebRetainedBakeFullCompositionResult["sourceTimebase"];
  preservedNativePayloadHashes: readonly string[];
  preservedReplaceableElementIds: readonly string[];
}

interface PrivateState {
  input: AebRetainedBakeFullCompositionInput;
  sourceIr: AebFormatNeutralIr;
  output: AebBoundedTaskFile;
  revoked: boolean;
}

export class NodeAebRetainedBakeFullCompositionPublisher {
  private readonly states = new WeakMap<AebRetainedBakeFullCompositionResult, PrivateState>();

  constructor(private readonly authority: NodeAebTaskRootAuthority) {}

  async publish(input: AebRetainedBakeFullCompositionInput): Promise<AebRetainedBakeFullCompositionResult> {
    const sourceIr = captureSourceIr(input.sourceIr);
    const candidate = await this.buildCandidate({ ...input, sourceIr });
    const outputName = aebRetainedBakeFullCompositionFileName(input.chainReceipt.chainHash);
    const output = await this.publishBytes(outputName, candidate.bytes, input.chainReceipt.chainHash);
    try {
      const rebound = await this.buildCandidate({ ...input, sourceIr });
      if (!candidate.bytes.equals(rebound.bytes)
        || !sameBindings(candidate.boundInputs, rebound.boundInputs)) {
        fail("AE_RETAINED_FULL_COMPOSITION_INPUT_CHANGED", "Mixed composition inputs changed during publication.");
      }
      const result = createResult(candidate, output, outputName);
      this.states.set(result, { input, sourceIr, output, revoked: false });
      return result;
    } catch (error) {
      await removeOwnedOutput(this.authority, outputName, output);
      throw error;
    }
  }

  async verify(result: AebRetainedBakeFullCompositionResult): Promise<boolean> {
    try {
      const state = this.states.get(result);
      if (!state || state.revoked) return false;
      const candidate = await this.buildCandidate({ ...state.input, sourceIr: state.sourceIr });
      const output = await this.authority.readBoundedTaskFile(
        result.output.relativePath,
        state.input.chainInput.plan.job.budgets.maxPackageBytes,
        "AE_RETAINED_FULL_COMPOSITION_OUTPUT"
      );
      return output.bytes.equals(candidate.bytes)
        && output.identityDigest === state.output.identityDigest
        && sameJson(result, createResult(candidate, output, result.output.relativePath));
    } catch {
      return false;
    }
  }

  async revoke(result: AebRetainedBakeFullCompositionResult): Promise<boolean> {
    const state = this.states.get(result);
    if (!state || state.revoked) return false;
    state.revoked = true;
    try {
      await removeOwnedOutput(this.authority, result.output.relativePath, state.output);
      return true;
    } catch {
      return false;
    }
  }

  private async buildCandidate(input: AebRetainedBakeFullCompositionInput): Promise<Candidate> {
    if (!await verifyAebRetainedBakeAuthorityChainReceipt(input.chainReceipt, input.chainInput)
      || !await input.chainInput.publicationAuthority.verifyPublishedSuccessor(
        input.chainInput.published,
        input.chainInput.hasher
      )) {
      fail("AE_RETAINED_FULL_COMPOSITION_CHAIN_INVALID", "Mixed composition requires the live retained Bake authority chain.");
    }
    validateMixedSourceIr(input.sourceIr, input.chainInput);
    const { project, resources, boundInputs } = await buildProject(
      this.authority,
      input.sourceIr,
      input.chainInput
    );
    const svgaMap = JSON.parse(JSON.stringify(buildSvgaMap(project))) as ReturnType<typeof buildSvgaMap>;
    const schema = await loadAebReviewedSvgaSchemaAuthority();
    const payload = buildGeneratedNativeMoviePayload(project, svgaMap, [...resources]);
    const verificationError = schema.encoderMovieEntity.verify(payload as { [key: string]: unknown });
    if (verificationError) {
      fail("AE_RETAINED_FULL_COMPOSITION_PROTOBUF_INVALID", "Mixed composition failed MovieEntity verification.");
    }
    const encoded = schema.encoderMovieEntity.encode(
      schema.encoderMovieEntity.create(payload as { [key: string]: unknown })
    ).finish();
    const bytes = Buffer.from(deflateSync(encoded));
    if (bytes.byteLength <= 0 || bytes.byteLength > input.chainInput.plan.job.budgets.maxPackageBytes) {
      fail("AE_RETAINED_FULL_COMPOSITION_BUDGET_EXCEEDED", "Mixed composition exceeds the approved package budget.");
    }
    const validation = await validateSvgaBytes(
      bytes,
      path.resolve("proto/svga.proto"),
      { project, svgaMap, resources: [...resources] }
    );
    if (!validation.inflated
      || !validation.decoded
      || !validation.generatedNativeStructureValid
      || !validation.generatedNativeVocabularyValid
      || !validation.generatedNativeAuthorityValid
      || !validation.canonicalWireEncoding
      || !validation.canonicalFloatValues
      || !validation.allSpriteFrameCountsMatch
      || !validation.requiredFrameFieldsPresent) {
      const failedChecks = Object.entries({
        inflated: validation.inflated,
        decoded: validation.decoded,
        structure: validation.generatedNativeStructureValid,
        vocabulary: validation.generatedNativeVocabularyValid,
        authority: validation.generatedNativeAuthorityValid,
        canonicalWire: validation.canonicalWireEncoding,
        canonicalFloat: validation.canonicalFloatValues,
        frameCounts: validation.allSpriteFrameCountsMatch,
        frameFields: validation.requiredFrameFieldsPresent
      }).filter(([, passed]) => !passed).map(([name]) => name).join(",");
      fail(
        "AE_RETAINED_FULL_COMPOSITION_VALIDATION_FAILED",
        `Mixed composition failed generated-native SVGA checks: ${failedChecks}; ${describeAuthorityFailure(
          bytes,
          schema.reopenMovieEntity,
          project,
          svgaMap,
          resources
        )}.`
      );
    }
    const orderedLayers = [...input.sourceIr.layers].sort(compareLayerStack);
    return {
      bytes,
      contentHash: sha256(bytes),
      project,
      resources,
      boundInputs,
      sourceLayerOrder: orderedLayers.map((layer) => layer.layerId),
      sourceLayerAuthority: orderedLayers.map((layer) => ({
        layerId: layer.layerId,
        plannerOutcome: layer.plannerOutcome as "native" | "bake_required",
        stackIndex: layer.stackIndex!,
        activeRange: { ...layer.activeRange! }
      })),
      sourceTimebase: {
        ...input.sourceIr.composition.timeRange,
        fps: input.sourceIr.composition.fps
      },
      preservedNativePayloadHashes: orderedLayers
        .filter((layer) => layer.plannerOutcome === "native")
        .map((layer) => layer.nativePayload!.payloadHash),
      preservedReplaceableElementIds: orderedLayers
        .flatMap((layer) => layer.replaceableElementIds)
        .sort(compare)
    };
  }

  private async publishBytes(outputName: string, bytes: Buffer, chainHash: string): Promise<AebBoundedTaskFile> {
    const outputPath = await this.authority.directChildPath(outputName);
    const temporaryName = `aeb-full-composition-${chainHash.slice(0, 24)}.tmp`;
    const temporaryPath = await this.authority.directChildPath(temporaryName);
    let temporaryCreated = false;
    let outputCreated = false;
    let identity: BigIntStats | undefined;
    try {
      await this.authority.verifyPinned();
      const handle = await open(
        temporaryPath,
        constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW,
        0o600
      );
      temporaryCreated = true;
      try {
        await handle.writeFile(bytes);
        await handle.sync();
        identity = await handle.stat({ bigint: true });
      } finally {
        await handle.close();
      }
      await this.authority.syncTaskRoot();
      await link(temporaryPath, outputPath);
      outputCreated = true;
      await this.authority.syncTaskRoot();
      await unlink(temporaryPath);
      temporaryCreated = false;
      await this.authority.syncTaskRoot();
      const output = await this.authority.readBoundedTaskFile(
        outputName,
        bytes.byteLength,
        "AE_RETAINED_FULL_COMPOSITION_OUTPUT"
      );
      if (!output.bytes.equals(bytes)) {
        fail("AE_RETAINED_FULL_COMPOSITION_READBACK_MISMATCH", "Mixed composition bytes failed exact read-back.");
      }
      return output;
    } catch (error) {
      let rollbackFailed = false;
      if (outputCreated && !await unlinkIfSame(outputPath, identity)) rollbackFailed = true;
      if (temporaryCreated && !await unlinkIfSame(temporaryPath, identity)) rollbackFailed = true;
      if (rollbackFailed) {
        fail("AE_RETAINED_FULL_COMPOSITION_ROLLBACK_FAILED", "Mixed composition rollback could not remove its partial output.");
      }
      if (error instanceof AebBakePipelineError) throw error;
      if (isErrno(error, "EEXIST")) {
        fail("AE_RETAINED_FULL_COMPOSITION_OUTPUT_EXISTS", "Mixed composition output already exists.");
      }
      fail("AE_RETAINED_FULL_COMPOSITION_PUBLICATION_FAILED", "Mixed composition publication failed closed.");
    }
  }
}

async function buildProject(
  authority: NodeAebTaskRootAuthority,
  sourceIr: AebFormatNeutralIr,
  chainInput: CreateAebRetainedBakeAuthorityChainInput
): Promise<{
  project: AvatarFrameProject;
  resources: readonly SvgaGeneratedNativeAuthorityResource[];
  boundInputs: readonly BoundInput[];
}> {
  const assets: ProjectAsset[] = [];
  const layers: ProjectLayer[] = [];
  const animations: AvatarFrameProject["animations"] = [];
  const resources: SvgaGeneratedNativeAuthorityResource[] = [];
  const boundInputs: BoundInput[] = [];
  const resourceById = new Map(sourceIr.resources.map((resource) => [resource.resourceId, resource]));
  const durationFrames = sourceIr.composition.timeRange.endFrameExclusive
    - sourceIr.composition.timeRange.startFrame;
  const orderedLayers = [...sourceIr.layers].sort(compareLayerStack);

  for (const layer of orderedLayers) {
    if (layer.plannerOutcome === "native") {
      const payload = layer.nativePayload!;
      const resource = resourceById.get(payload.resourceId)!;
      const file = await authority.readBoundedTaskFile(
        resource.relativePath,
        chainInput.plan.job.budgets.maxEncodedBytes,
        "AE_RETAINED_NATIVE_RESOURCE"
      );
      const decoded = decode(file.bytes, { checkCrc: true });
      if (sha256(file.bytes) !== resource.contentHash.value
        || decoded.width !== payload.width
        || decoded.height !== payload.height) {
        fail("AE_RETAINED_NATIVE_RESOURCE_MISMATCH", "Native payload resource bytes or dimensions changed.");
      }
      assets.push({
        id: resource.resourceId,
        type: "image",
        path: resource.relativePath,
        width: payload.width,
        height: payload.height,
        sha256: resource.contentHash.value,
        generated: false
      });
      resources.push({
        assetId: resource.resourceId,
        packagePath: resource.relativePath,
        width: payload.width,
        height: payload.height,
        sha256: resource.contentHash.value,
        bytes: file.bytes
      });
      boundInputs.push(boundInput(layer.layerId, resource.resourceId, resource.relativePath, file));
      layers.push(projectLayer(
        layer,
        resource.resourceId,
        payload,
        sourceIr.composition.timeRange.startFrame
      ));
      if (payload.keyframes.length > 0) {
        animations.push({
          id: `animation_${layer.layerId}`,
          templateId: "breathing_glow",
          targetLayerId: layer.layerId,
          keyframes: payload.keyframes.map((keyframe) => ({
            ...keyframe,
            frame: keyframe.frame - sourceIr.composition.timeRange.startFrame
          })),
          easing: "linear"
        });
      }
      continue;
    }

    const frameAssets = new Map<string, string>();
    for (const [frameOffset, frame] of chainInput.adapterInput.frames.entries()) {
      let assetId = frameAssets.get(frame.canonicalResourceId);
      if (!assetId) {
        assetId = `bake_${frame.canonicalResourceId}`;
        const file = await authority.readBoundedTaskFile(
          frame.relativePath,
          chainInput.plan.job.budgets.maxEncodedBytes,
          "AE_RETAINED_BAKED_RESOURCE"
        );
        if (sha256(file.bytes) !== frame.contentHash) {
          fail("AE_RETAINED_BAKED_RESOURCE_MISMATCH", "Baked payload resource bytes changed.");
        }
        assets.push({
          id: assetId,
          type: "image",
          path: frame.relativePath,
          width: frame.width,
          height: frame.height,
          sha256: frame.contentHash,
          generated: true
        });
        resources.push({
          assetId,
          packagePath: frame.relativePath,
          width: frame.width,
          height: frame.height,
          sha256: frame.contentHash,
          bytes: file.bytes
        });
        boundInputs.push(boundInput(layer.layerId, assetId, frame.relativePath, file));
        frameAssets.set(frame.canonicalResourceId, assetId);
      }
      layers.push({
        id: `${layer.layerId}__frame_${String(frameOffset).padStart(6, "0")}`,
        type: "image",
        assetId,
        zIndex: layer.stackIndex! * 1_000_000 + frameOffset,
        visible: true,
        blendMode: "normal",
        fallbackBlendMode: "normal",
        fallbackOpacityMultiplier: 1,
        activeFrameRange: { start: frameOffset, end: frameOffset },
        anchor: { x: 0, y: 0 },
        transform: { x: 0, y: 0, scaleX: 1, scaleY: 1, rotation: 0, opacity: 1 }
      });
    }
  }

  const sourceProject = await authority.readBoundedTaskFile(
    chainInput.plan.sourceFiles.projectRelativePath,
    chainInput.plan.sourceFiles.projectMaxBytes,
    "SOURCE_PROJECT"
  );
  const sourcePackage = await authority.readBoundedTaskFile(
    chainInput.plan.sourceFiles.packageRelativePath,
    chainInput.plan.sourceFiles.packageMaxBytes,
    "SOURCE_PACKAGE"
  );
  const successor = await authority.readBoundedTaskFile(
    chainInput.published.publicationReceipt.successorPackage.relativePath,
    chainInput.published.publicationReceipt.successorPackage.encodedBytes,
    "SUCCESSOR_PACKAGE"
  );
  if (sha256(sourceProject.bytes) !== chainInput.plan.sourceFiles.projectContentHash
    || sourceProject.identityDigest !== chainInput.producerReceipt.source.project.postIdentityDigest
    || sha256(sourcePackage.bytes) !== chainInput.plan.sourceFiles.packageContentHash
    || sourcePackage.identityDigest !== chainInput.producerReceipt.source.package.postIdentityDigest
    || sha256(successor.bytes) !== chainInput.published.publicationReceipt.successorPackage.contentHash.value) {
    fail(
      "AE_RETAINED_FULL_COMPOSITION_PROTECTED_INPUT_CHANGED",
      "Mixed composition source project, package, or F1 successor identity changed."
    );
  }
  boundInputs.push(
    boundInput("source-project", "source-project", chainInput.plan.sourceFiles.projectRelativePath, sourceProject),
    boundInput("source-package", "source-package", chainInput.plan.sourceFiles.packageRelativePath, sourcePackage),
    boundInput("successor-package", "successor-package", chainInput.published.publicationReceipt.successorPackage.relativePath, successor)
  );

  return {
    project: {
      schemaVersion: "0.4.0",
      version: "0.4.0",
      projectId: `aeb_mixed_${chainInput.plan.planHash.slice(0, 24)}`,
      assetType: "avatar_frame",
      canvas: { ...sourceIr.composition.canvas },
      fps: sourceIr.composition.fps,
      durationFrames,
      loop: true,
      assets,
      layers,
      animations,
      export: {
        format: "intermediate-json",
        exporter: "json-exporter",
        svgaExporter: { status: "stub", notes: "Retained Bake mixed composition generated by reviewed source authority." }
      }
    },
    resources,
    boundInputs
  };
}

function projectLayer(
  layer: AebFormatNeutralIrLayer,
  assetId: string,
  payload: AebNativeLayerPayload,
  sourceStartFrame: number
): ProjectLayer {
  return {
    id: layer.layerId,
    type: "image",
    assetId,
    zIndex: layer.stackIndex! * 1_000_000,
    visible: true,
    blendMode: "normal",
    fallbackBlendMode: "normal",
    fallbackOpacityMultiplier: 1,
    activeFrameRange: {
      start: layer.activeRange!.startFrame - sourceStartFrame,
      end: layer.activeRange!.endFrameExclusive - sourceStartFrame - 1
    },
    anchor: { ...payload.anchor },
    transform: { ...payload.transform }
  };
}

function validateMixedSourceIr(
  sourceIr: AebFormatNeutralIr,
  chainInput: CreateAebRetainedBakeAuthorityChainInput
): void {
  const layers = [...sourceIr.layers];
  const native = layers.filter((layer) => layer.plannerOutcome === "native");
  const baked = layers.filter((layer) => layer.plannerOutcome === "bake_required");
  const stackIndexes = layers.map((layer) => layer.stackIndex);
  const nativeResourceIds = new Set(sourceIr.resources.map((resource) => resource.resourceId));
  const imageKeys = native.map((layer) => layer.nativePayload?.imageKey);
  const expectedNative = [...chainInput.published.bundle.preservedNativeLayers]
    .sort((left, right) => compare(left.layerId, right.layerId));
  const canonicalNative = [...native].sort((left, right) => compare(left.layerId, right.layerId));
  if (native.length === 0
    || baked.length !== 1
    || layers.some((layer) => layer.plannerOutcome === "blocked")
    || stackIndexes.some((value) => !Number.isSafeInteger(value) || Number(value) < 0)
    || new Set(stackIndexes).size !== stackIndexes.length
    || new Set(imageKeys).size !== imageKeys.length
    || layers.some((layer) => !layer.activeRange
      || layer.activeRange.startFrame < sourceIr.composition.timeRange.startFrame
      || layer.activeRange.endFrameExclusive > sourceIr.composition.timeRange.endFrameExclusive)
    || baked.some((layer) => !sameJson(layer.activeRange, sourceIr.composition.timeRange))
    || native.some((layer) => !layer.nativePayload
      || !nativeResourceIds.has(layer.nativePayload.resourceId)
      || layer.nativePayload.payloadHash !== payloadHash(layer.nativePayload)
      || layer.nativePayload.keyframes.some((keyframe) =>
        keyframe.frame < sourceIr.composition.timeRange.startFrame
        || keyframe.frame >= sourceIr.composition.timeRange.endFrameExclusive)
      || new Set(layer.nativePayload.keyframes.map((keyframe) => keyframe.frame)).size
        !== layer.nativePayload.keyframes.length)
    || !sameJson(canonicalNative, expectedNative)
    || sourceIr.resources.length !== native.length
    || chainInput.adapterInput.frames.length !== chainInput.manifest.frames.length
    || chainInput.adapterInput.frames.some((frame, index) =>
      frame.frameIndex !== sourceIr.composition.timeRange.startFrame + index)) {
    fail("AE_RETAINED_FULL_COMPOSITION_INPUT_INVALID", "Mixed composition lacks exact native, stack, timebase, or payload authority.");
  }
  for (const layer of native) {
    const resource = sourceIr.resources.find((item) => item.resourceId === layer.nativePayload!.resourceId);
    if (!resource || resource.ownerLayerId !== layer.layerId) {
      fail("AE_RETAINED_FULL_COMPOSITION_RESOURCE_JOIN_INVALID", "Native layer payload does not join exactly one owned resource.");
    }
  }
}

function createResult(
  candidate: Candidate,
  output: AebBoundedTaskFile,
  outputName: string
): AebRetainedBakeFullCompositionResult {
  const unsigned: Omit<AebRetainedBakeFullCompositionResult, "resultHash"> = {
    schemaVersion: AEB_RETAINED_BAKE_FULL_COMPOSITION_SCHEMA_VERSION,
    authorityState: "source_validated_mixed_composition_output",
    output: {
      relativePath: outputName,
      encodedBytes: output.encodedBytes,
      contentHash: candidate.contentHash,
      identityDigest: output.identityDigest,
      atomicAbsentDestination: true,
      noOverwrite: true
    },
    schema: {
      protoFileSha256: AEB_REVIEWED_SVGA_PROTO_FILE_SHA256,
      descriptorSha256: AEB_REVIEWED_SVGA_DESCRIPTOR_SHA256
    },
    standardsValidSvga: true,
    nativeMergeCompleted: true,
    fullCompositionEncoded: true,
    sourceLayerOrder: candidate.sourceLayerOrder,
    sourceLayerAuthority: candidate.sourceLayerAuthority,
    sourceTimebase: candidate.sourceTimebase,
    preservedNativePayloadHashes: candidate.preservedNativePayloadHashes,
    preservedReplaceableElementIds: candidate.preservedReplaceableElementIds,
    resourceBindings: candidate.boundInputs
      .filter((item) => !["source-project", "source-package", "successor-package"].includes(item.resourceId))
      .map(({ file: _file, ...item }) => item)
      .sort((left, right) => compare(left.relativePath, right.relativePath)),
    validation: {
      standardsValidSvga: true,
      generatedNativeAuthorityValid: true,
      canonicalWireEncoding: true,
      nativeMergeCompleted: true,
      fullCompositionEncoded: true,
      sourceProjectUnchanged: true,
      sourcePackageUnchanged: true,
      successorPackageUnchanged: true,
      protectedReplaceableElementsPreserved: true,
      previewOrSaveAuthorized: false
    }
  };
  return { ...unsigned, resultHash: sha256(Buffer.from(canonicalJson(unsigned))) };
}

function captureSourceIr(sourceIr: AebFormatNeutralIr): AebFormatNeutralIr {
  try {
    return structuredClone(sourceIr);
  } catch {
    fail("AE_RETAINED_FULL_COMPOSITION_INPUT_INVALID", "Mixed composition IR could not be captured safely.");
  }
}

export function aebRetainedBakeFullCompositionFileName(chainHash: string): string {
  if (!/^[a-f0-9]{64}$/.test(chainHash)) {
    fail("AE_RETAINED_FULL_COMPOSITION_CHAIN_INVALID", "Mixed composition chain hash is invalid.");
  }
  return `aeb-retained-full-composition-${chainHash.slice(0, 24)}.svga`;
}

function boundInput(
  ownerLayerId: string,
  resourceId: string,
  relativePath: string,
  file: AebBoundedTaskFile
): BoundInput {
  return {
    ownerLayerId,
    resourceId,
    relativePath,
    contentHash: sha256(file.bytes),
    identityDigest: file.identityDigest,
    file
  };
}

function payloadHash(payload: AebNativeLayerPayload): string {
  const { payloadHash: _payloadHash, ...withoutHash } = payload;
  return sha256(Buffer.from(canonicalJson(withoutHash)));
}

function describeAuthorityFailure(
  bytes: Buffer,
  MovieEntity: Awaited<ReturnType<typeof loadAebReviewedSvgaSchemaAuthority>>["reopenMovieEntity"],
  project: AvatarFrameProject,
  svgaMap: ReturnType<typeof buildSvgaMap>,
  resources: readonly SvgaGeneratedNativeAuthorityResource[]
): string {
  try {
    const decoded = MovieEntity.toObject(MovieEntity.decode(inflateSync(bytes)), {
      bytes: Buffer,
      arrays: true,
      objects: true
    }) as { images?: Record<string, Buffer>; sprites?: Array<{ imageKey?: string }> };
    const orderedSprites = [...svgaMap.sprites].sort((left, right) =>
      left.zIndex - right.zIndex || compare(left.layerId, right.layerId));
    const uniquePaths = [...new Set(orderedSprites.map((sprite) => sprite.exportAssetPath))];
    const assetsByPath = new Map(project.assets.map((asset) => [asset.path, asset]));
    const resourcesByPath = new Map(resources.map((resource) => [resource.packagePath, resource]));
    const inputJoin = uniquePaths.length === project.assets.length
      && assetsByPath.size === project.assets.length
      && resourcesByPath.size === resources.length
      && resources.length === uniquePaths.length;
    const imageJoin = uniquePaths.every((relativePath, index) => {
      const asset = assetsByPath.get(relativePath);
      const resource = resourcesByPath.get(relativePath);
      const image = decoded.images?.[`img_${index}`];
      return Boolean(asset && resource && image
        && asset.id === resource.assetId
        && asset.sha256 === resource.sha256
        && sha256(resource.bytes) === asset.sha256
        && sha256(image!) === asset.sha256);
    });
    const spriteJoin = decoded.sprites?.length === orderedSprites.length
      && orderedSprites.every((sprite, index) =>
        decoded.sprites?.[index]?.imageKey === `img_${uniquePaths.indexOf(sprite.exportAssetPath)}`);
    return `inputJoin=${inputJoin},imageJoin=${imageJoin},spriteJoin=${spriteJoin}`;
  } catch {
    return "authorityDiagnostic=unavailable";
  }
}

function compareLayerStack(left: AebFormatNeutralIrLayer, right: AebFormatNeutralIrLayer): number {
  return left.stackIndex! - right.stackIndex! || compare(left.layerId, right.layerId);
}

function sameBindings(left: readonly BoundInput[], right: readonly BoundInput[]): boolean {
  return sameJson(
    left.map(({ file: _file, ...item }) => item).sort((a, b) => compare(a.relativePath, b.relativePath)),
    right.map(({ file: _file, ...item }) => item).sort((a, b) => compare(a.relativePath, b.relativePath))
  );
}

async function removeOwnedOutput(
  authority: NodeAebTaskRootAuthority,
  outputName: string,
  expected: AebBoundedTaskFile
): Promise<void> {
  const outputPath = await authority.directChildPath(outputName);
  const current = await lstat(outputPath, { bigint: true });
  if (!current.isFile() || current.isSymbolicLink() || current.nlink !== 1n
    || `${current.dev}:${current.ino}` !== expected.fileIdentity) {
    fail("AE_RETAINED_FULL_COMPOSITION_REVOKE_INVALID", "Mixed composition output identity changed before revocation.");
  }
  await unlink(outputPath);
  await authority.syncTaskRoot();
}

async function unlinkIfSame(filePath: string, expected?: BigIntStats): Promise<boolean> {
  if (!expected) return false;
  try {
    const current = await lstat(filePath, { bigint: true });
    if (current.dev !== expected.dev || current.ino !== expected.ino) return false;
    await unlink(filePath);
    return true;
  } catch (error) {
    return isErrno(error, "ENOENT");
  }
}

function isErrno(error: unknown, code: string): boolean {
  return error instanceof Error && (error as NodeJS.ErrnoException).code === code;
}

function sha256(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

function canonicalJson(value: unknown): string {
  return JSON.stringify(sortValue(value));
}

function sortValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortValue);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => compare(left, right))
      .map(([key, child]) => [key, sortValue(child)]));
  }
  return value;
}

function sameJson(left: unknown, right: unknown): boolean {
  return canonicalJson(left) === canonicalJson(right);
}

function compare(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function fail(code: string, message: string): never {
  throw new AebBakePipelineError(code, message);
}
