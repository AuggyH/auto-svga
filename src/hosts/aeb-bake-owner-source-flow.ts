import { createHash } from "node:crypto";
import { constants } from "node:fs";
import { link, lstat, open, unlink } from "node:fs/promises";
import { deflateSync, inflateSync } from "node:zlib";
import type protobuf from "protobufjs";
import type {
  AebBakeFrameSource,
  AebBakeJob,
  AebBakeManifest,
  AebBakePlannerJoin,
  AebBakeTaskReceipt,
  AebFormatNeutralIr,
  AebPublishedSuccessorPackage
} from "../workbench/aeb-bake-contracts.js";
import {
  AebBakePipelineError,
  buildAebBakeManifest,
  createSyntheticAebBakeExecutionReceipt
} from "../workbench/aeb-bake-pipeline.js";
import { reinsertAebBakePackage } from "../workbench/aeb-package-reinsertion.js";
import type { SvgaAebBakeAdapterInput } from "../workbench/svga/aeb-bake-adapter.js";
import { createSvgaAebBakeAdapterInput } from "../workbench/svga/aeb-bake-adapter.js";
import { NodeAebBakePackagePublisher } from "./aeb-node-bake-package-publisher.js";
import {
  NodeAebBakeResourceReader,
  NodeAebTaskRootAuthority,
  type AebBoundedTaskFile
} from "./aeb-node-bake-resource-reader.js";
import {
  AEB_REVIEWED_SVGA_DESCRIPTOR_SHA256,
  AEB_REVIEWED_SVGA_PROTO_FILE_SHA256,
  loadAebReviewedSvgaSchemaAuthority
} from "./aeb-reviewed-svga-schema.js";
import { Sha256ResourceHasher } from "./sha256-resource-hasher.js";

export const AEB_BAKE_OWNER_SOURCE_FLOW_SCHEMA_VERSION = "aeb-bake-owner-source-flow-v2" as const;
const MAX_OWNER_SOURCE_SEQUENCE_FRAMES = 8;

export interface AebBakeOwnerSourceBinding {
  relativePath: string;
  contentHash: string;
  maxBytes: number;
}

export interface RunAebBakeOwnerSourceFlowInput {
  job: AebBakeJob;
  planner: AebBakePlannerJoin;
  taskReceipt: AebBakeTaskReceipt;
  frames: readonly AebBakeFrameSource[];
  sourceIr: AebFormatNeutralIr;
  fixtureId: string;
  sourceProject: AebBakeOwnerSourceBinding;
  sourcePackage: AebBakeOwnerSourceBinding;
  successorFileName: string;
}

export interface AebBakeOwnerSourceFlowReport {
  schemaVersion: typeof AEB_BAKE_OWNER_SOURCE_FLOW_SCHEMA_VERSION;
  authorityState: "source_validated_bake_owner_flow_ready";
  taskId: string;
  fixtureId: string;
  jobId: string;
  packageId: string;
  sourceFingerprint: string;
  classification: {
    nativeLayerIds: readonly string[];
    bakeRequiredLayerIds: readonly string[];
    blockedLayerIds: readonly string[];
    preservedReplaceableElementIds: readonly string[];
  };
  execution: {
    mode: "synthetic_fixture";
    receiptHash: string;
    actualAeRenderExecuted: false;
  };
  manifest: {
    manifestId: string;
    frameCount: number;
    uniqueContentCount: number;
    deduplicatedFrameCount: number;
    totalEncodedBytes: number;
    totalDecodedRgbaBytes: number;
    estimatedPackageBytes: number;
  };
  package: {
    sourceProjectContentHash: string;
    sourcePackageContentHash: string;
    successorPackageRelativePath: string;
    successorPackageContentHash: string;
    sourceProjectUnchanged: true;
    sourcePackageUnchanged: true;
    f1ReinsertionValidated: true;
  };
  fragment: {
    relativePath: string;
    encodedBytes: number;
    contentHash: string;
    identityDigest: string;
    protoFileSha256: typeof AEB_REVIEWED_SVGA_PROTO_FILE_SHA256;
    descriptorSha256: typeof AEB_REVIEWED_SVGA_DESCRIPTOR_SHA256;
    timelineFrameCount: number;
    uniqueImageCount: number;
    spriteCount: number;
    timelineDigest: string;
    standardsValidSvgaFragment: true;
    nativeMergeRequired: true;
    fullCompositionEncoded: false;
  };
  authority: {
    sourceValidationOnly: true;
    actualBakeAuthorityMinted: false;
    packageRuntimeAuthorityMinted: false;
    previewOrSaveAuthorized: false;
    runtimeProved: false;
  };
  reportHash: string;
}

interface PublishedFragment {
  output: AebBoundedTaskFile;
  outputName: string;
  contentHash: string;
  frames: readonly AebBoundedTaskFile[];
  timelineDigest: string;
  uniqueImageCount: number;
  spriteCount: number;
}

interface FragmentSequenceResource {
  canonicalResourceId: string;
  imageKey: string;
  bytes: Buffer;
  width: number;
  height: number;
}

interface FragmentSequenceModel {
  resources: readonly FragmentSequenceResource[];
  timeline: readonly SvgaAebBakeAdapterInput["frames"][number][];
  timelineDigest: string;
}

interface VerifiedOwnerReport {
  input: RunAebBakeOwnerSourceFlowInput;
  manifest: AebBakeManifest;
  published: AebPublishedSuccessorPackage;
  publisher: NodeAebBakePackagePublisher;
  adapterInput: SvgaAebBakeAdapterInput;
  project: AebBoundedTaskFile;
  sourcePackage: AebBoundedTaskFile;
  fragment: PublishedFragment;
}

const INPUT_KEYS = [
  "fixtureId",
  "frames",
  "job",
  "planner",
  "sourceIr",
  "sourcePackage",
  "sourceProject",
  "successorFileName",
  "taskReceipt"
] as const;

function snapshotInput(input: RunAebBakeOwnerSourceFlowInput): RunAebBakeOwnerSourceFlowInput {
  try {
    return deepFreeze(structuredClone(input));
  } catch {
    fail("AEB_BAKE_OWNER_INPUT_INVALID", "Bake owner source flow input could not be captured safely.");
  }
}

export class NodeAebBakeOwnerSourceFlow {
  private readonly hasher = new Sha256ResourceHasher();
  private readonly verifiedReports = new WeakMap<AebBakeOwnerSourceFlowReport, VerifiedOwnerReport>();

  constructor(private readonly authority: NodeAebTaskRootAuthority) {}

  async run(input: RunAebBakeOwnerSourceFlowInput): Promise<AebBakeOwnerSourceFlowReport> {
    const trustedInput = snapshotInput(input);
    validateInput(this.authority, trustedInput);
    const reader = new NodeAebBakeResourceReader(this.authority);
    await reader.verifyTaskReceipt(trustedInput.taskReceipt);
    const projectBefore = await readBoundSource(this.authority, trustedInput.sourceProject, "SOURCE_PROJECT");
    const sourcePackageBefore = await readBoundSource(this.authority, trustedInput.sourcePackage, "SOURCE_PACKAGE");
    let publisher: NodeAebBakePackagePublisher | undefined;
    let published: AebPublishedSuccessorPackage | undefined;
    let fragment: PublishedFragment | undefined;
    try {
      const executionReceipt = await createSyntheticAebBakeExecutionReceipt({
        job: trustedInput.job,
        frames: trustedInput.frames,
        fixtureId: trustedInput.fixtureId
      }, this.hasher);
      const manifest = await buildAebBakeManifest({
        job: trustedInput.job,
        planner: trustedInput.planner,
        taskReceipt: trustedInput.taskReceipt,
        frames: trustedInput.frames,
        executionReceipt,
        reader,
        hasher: this.hasher
      });
      const bundle = await reinsertAebBakePackage(trustedInput.sourceIr, manifest, this.hasher);
      publisher = new NodeAebBakePackagePublisher(this.authority);
      published = await publisher.publish({
        bundle,
        sourcePackageRelativePath: trustedInput.sourcePackage.relativePath,
        expectedSourcePackageHash: trustedInput.sourcePackage.contentHash,
        successorFileName: trustedInput.successorFileName,
        maxSourcePackageBytes: trustedInput.sourcePackage.maxBytes,
        maxSuccessorPackageBytes: trustedInput.job.budgets.maxPackageBytes,
        hasher: this.hasher
      });
      const adapterInput = await createSvgaAebBakeAdapterInput(
        published,
        this.hasher,
        publisher
      );
      fragment = await publishSourceFragment(
        this.authority,
        trustedInput,
        manifest,
        published,
        publisher,
        adapterInput
      );
      const projectAfter = await readBoundSource(this.authority, trustedInput.sourceProject, "SOURCE_PROJECT");
      const sourcePackageAfter = await readBoundSource(this.authority, trustedInput.sourcePackage, "SOURCE_PACKAGE");
      if (!sameBoundFile(projectBefore, projectAfter)
        || !sameBoundFile(sourcePackageBefore, sourcePackageAfter)
        || !await publisher.verifyPublishedSuccessor(published, this.hasher)) {
        fail("AEB_BAKE_OWNER_SOURCE_CHANGED", "Bake owner source inputs changed before final validation.");
      }
      const report = createReport(
        trustedInput,
        executionReceipt.receiptHash,
        manifest,
        published,
        projectAfter,
        sourcePackageAfter,
        fragment
      );
      this.verifiedReports.set(report, {
        input: trustedInput,
        manifest,
        published,
        publisher,
        adapterInput,
        project: projectAfter,
        sourcePackage: sourcePackageAfter,
        fragment
      });
      return report;
    } catch (error) {
      let rollbackFailed = false;
      if (fragment) rollbackFailed = !await removeOwnedFile(this.authority, fragment.outputName, fragment.output);
      if (published && publisher) {
        rollbackFailed = !await publisher.revokePublishedSuccessor(published) || rollbackFailed;
      }
      if (rollbackFailed) {
        fail("AEB_BAKE_OWNER_ROLLBACK_FAILED", "Bake owner source flow could not prove removal of partial outputs.");
      }
      throw error;
    }
  }

  async verify(report: AebBakeOwnerSourceFlowReport): Promise<boolean> {
    try {
      const state = this.verifiedReports.get(report);
      if (!state
        || !await state.publisher.verifyPublishedSuccessor(state.published, this.hasher)) return false;
      const project = await readBoundSource(this.authority, state.input.sourceProject, "SOURCE_PROJECT");
      const sourcePackage = await readBoundSource(this.authority, state.input.sourcePackage, "SOURCE_PACKAGE");
      const output = await this.authority.readBoundedTaskFile(
        state.fragment.outputName,
        state.input.job.budgets.maxPackageBytes,
        "AE_RETAINED_SVGA_OUTPUT"
      );
      const frames = await readAdapterFrames(this.authority, state.input.job, state.adapterInput, state.manifest);
      if (!sameBoundFile(project, state.project)
        || !sameBoundFile(sourcePackage, state.sourcePackage)
        || !sameBoundFile(output, state.fragment.output)
        || !sameBoundFiles(frames, state.fragment.frames)
        || sha256(output.bytes) !== state.fragment.contentHash) return false;
      await validateMovie(output.bytes, frames, state.adapterInput, state.input.job.budgets.maxPackageBytes);
      return sameJson(report, createReport(
        state.input,
        state.manifest.execution.receiptHash,
        state.manifest,
        state.published,
        project,
        sourcePackage,
        { ...state.fragment, output, frames }
      ));
    } catch {
      return false;
    }
  }
}

function validateInput(authority: NodeAebTaskRootAuthority, input: RunAebBakeOwnerSourceFlowInput): void {
  if (!isRecord(input)
    || !sameJson(Object.keys(input).sort(), [...INPUT_KEYS])
    || !isRecord(input.job)
    || !isRecord(input.job.source)
    || !isRecord(input.job.task)
    || !isRecord(input.job.canvas)
    || !isRecord(input.job.timeRange)
    || !isRecord(input.job.budgets)
    || !isRecord(input.planner)
    || !Array.isArray(input.planner.decisions)
    || !isRecord(input.taskReceipt)
    || !isRecord(input.sourceIr)
    || !Array.isArray(input.sourceIr.layers)
    || !isRecord(input.sourceProject)
    || !isRecord(input.sourcePackage)
    || !Array.isArray(input.frames)) {
    fail("AEB_BAKE_OWNER_INPUT_INVALID", "Bake owner source flow input is malformed or contains untrusted authority fields.");
  }
  const decisions = input.planner.decisions ?? [];
  const nativeLayerIds = decisions.filter((item) => item.outcome === "native").map((item) => item.layerId);
  const bakeLayerIds = decisions.filter((item) => item.outcome === "bake_required").map((item) => item.layerId);
  const blockedLayerIds = decisions.filter((item) => item.outcome === "blocked").map((item) => item.layerId);
  const protectedIds = input.sourceIr.layers?.flatMap((layer) => layer.replaceableElementIds) ?? [];
  const frameCount = input.job.timeRange.endFrameExclusive - input.job.timeRange.startFrame;
  if (authority.taskId !== input.job.task.taskId
    || input.taskReceipt.producer !== "synthetic_fixture"
    || input.sourceProject.contentHash !== input.job.source.sourceFingerprint
    || input.job.canvas.width !== 4
    || input.job.canvas.height !== 4
    || !Number.isInteger(input.job.fps)
    || input.job.fps < 1
    || input.job.fps > 60
    || !Number.isInteger(frameCount)
    || frameCount < 1
    || frameCount > MAX_OWNER_SOURCE_SEQUENCE_FRAMES
    || input.frames.length !== frameCount
    || input.job.budgets.maxFrames < frameCount
    || nativeLayerIds.length === 0
    || bakeLayerIds.length !== 1
    || blockedLayerIds.length !== 0
    || protectedIds.length === 0
    || new Set(protectedIds).size !== protectedIds.length
    || input.sourceIr.layers.some((layer) => layer.plannerOutcome === "bake_required"
      && layer.replaceableElementIds.length > 0)
    || !isIdentifier(input.fixtureId)
    || !isSha256(input.sourceProject.contentHash)
    || !isSha256(input.sourcePackage.contentHash)
    || !isPositiveInteger(input.sourceProject.maxBytes)
    || !isPositiveInteger(input.sourcePackage.maxBytes)
    || typeof input.sourceProject.relativePath !== "string"
    || typeof input.sourcePackage.relativePath !== "string"
    || input.sourceProject.relativePath === input.sourcePackage.relativePath
    || !/^[A-Za-z0-9][A-Za-z0-9._-]{0,127}\.json$/.test(input.successorFileName)
    || input.successorFileName === input.sourcePackage.relativePath
    || input.successorFileName === input.sourceProject.relativePath) {
    fail("AEB_BAKE_OWNER_SCOPE_INVALID", "Bake owner source flow requires a bounded mixed-classification RGBA sequence fixture.");
  }
}

async function readBoundSource(
  authority: NodeAebTaskRootAuthority,
  binding: AebBakeOwnerSourceBinding,
  role: "SOURCE_PROJECT" | "SOURCE_PACKAGE"
): Promise<AebBoundedTaskFile> {
  const file = await authority.readBoundedTaskFile(binding.relativePath, binding.maxBytes, role);
  if (sha256(file.bytes) !== binding.contentHash) {
    fail("AEB_BAKE_OWNER_SOURCE_HASH_MISMATCH", "Bake owner source bytes do not match their approved binding.");
  }
  return file;
}

async function publishSourceFragment(
  authority: NodeAebTaskRootAuthority,
  input: RunAebBakeOwnerSourceFlowInput,
  manifest: AebBakeManifest,
  published: AebPublishedSuccessorPackage,
  publisher: NodeAebBakePackagePublisher,
  adapterInput: SvgaAebBakeAdapterInput
): Promise<PublishedFragment> {
  if (manifest.execution.mode !== "synthetic_fixture"
    || manifest.execution.actualAeRenderExecuted !== false
    || adapterInput.frames.length < 1
    || adapterInput.frames.length > MAX_OWNER_SOURCE_SEQUENCE_FRAMES
    || adapterInput.bakedLayerIds.length !== 1
    || adapterInput.preservedNativeLayerIds.length === 0
    || !await publisher.verifyPublishedSuccessor(published, new Sha256ResourceHasher())) {
    fail("AEB_BAKE_OWNER_FRAGMENT_INPUT_INVALID", "Source fragment requires the current synthetic F1 package boundary.");
  }
  const sourcePackage = await readBoundSource(authority, input.sourcePackage, "SOURCE_PACKAGE");
  const successor = await authority.readBoundedTaskFile(
    published.publicationReceipt.successorPackage.relativePath,
    published.publicationReceipt.successorPackage.encodedBytes,
    "SUCCESSOR_PACKAGE"
  );
  const frames = await readAdapterFrames(authority, input.job, adapterInput, manifest);
  const sequence = buildSequenceModel(frames, adapterInput);
  if (sequence.resources.length !== manifest.resources.uniqueContentCount
    || manifest.resources.deduplicatedFrameCount !== frames.length - sequence.resources.length) {
    fail("AEB_BAKE_OWNER_DEDUPE_INVALID", "Source fragment resource deduplication does not match the Bake manifest.");
  }
  const bytes = await encodeFragment(frames, adapterInput, input.job.budgets.maxPackageBytes);
  const flowHash = sha256(Buffer.from(canonicalJson({
    manifestId: manifest.manifestId,
    packageBundleId: published.bundle.packageBundleId,
    publicationReceiptHash: published.publicationReceipt.receiptHash,
    adapterInput
  })));
  const outputName = `aeb-bake-owner-source-${flowHash.slice(0, 24)}.svga`;
  const temporaryName = `aeb-bake-owner-source-${flowHash.slice(0, 24)}.tmp`;
  const outputPath = await authority.directChildPath(outputName);
  const temporaryPath = await authority.directChildPath(temporaryName);
  let temporaryCreated = false;
  let outputCreated = false;
  let identity: FileIdentity | undefined;
  try {
    await authority.verifyPinned();
    const handle = await open(
      temporaryPath,
      constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW,
      0o600
    );
    temporaryCreated = true;
    try {
      await handle.writeFile(bytes);
      await handle.sync();
    } finally {
      await handle.close();
    }
    identity = await fileIdentity(temporaryPath);
    if (identity.nlink !== 1) {
      fail("AEB_BAKE_OWNER_PATH_CHANGED", "Source fragment temporary output gained an unexpected alias.");
    }
    await authority.syncTaskRoot();
    await link(temporaryPath, outputPath);
    outputCreated = true;
    const linkedIdentity = await fileIdentity(outputPath);
    assertIdentity(linkedIdentity, identity);
    if (linkedIdentity.nlink !== 2) {
      fail("AEB_BAKE_OWNER_PATH_CHANGED", "Source fragment publication link count is ambiguous.");
    }
    await authority.syncTaskRoot();
    await unlinkSame(temporaryPath, identity, 2);
    temporaryCreated = false;
    await authority.syncTaskRoot();
    const output = await authority.readBoundedTaskFile(
      outputName,
      input.job.budgets.maxPackageBytes,
      "AE_RETAINED_SVGA_OUTPUT"
    );
    const reboundSource = await readBoundSource(authority, input.sourcePackage, "SOURCE_PACKAGE");
    const reboundSuccessor = await authority.readBoundedTaskFile(
      published.publicationReceipt.successorPackage.relativePath,
      published.publicationReceipt.successorPackage.encodedBytes,
      "SUCCESSOR_PACKAGE"
    );
    const reboundFrames = await readAdapterFrames(authority, input.job, adapterInput, manifest);
    if (!output.bytes.equals(bytes)
      || !sameBoundFile(sourcePackage, reboundSource)
      || !sameBoundFile(successor, reboundSuccessor)
      || !sameBoundFiles(frames, reboundFrames)
      || !await publisher.verifyPublishedSuccessor(published, new Sha256ResourceHasher())) {
      fail("AEB_BAKE_OWNER_FRAGMENT_REBIND_FAILED", "Source fragment inputs changed before final output binding.");
    }
    await validateMovie(output.bytes, reboundFrames, adapterInput, input.job.budgets.maxPackageBytes);
    return {
      output,
      outputName,
      contentHash: sha256(output.bytes),
      frames: reboundFrames,
      timelineDigest: sequence.timelineDigest,
      uniqueImageCount: sequence.resources.length,
      spriteCount: sequence.resources.length
    };
  } catch (error) {
    let rollbackFailed = false;
    if (outputCreated && identity) {
      rollbackFailed = !await unlinkOwned(outputPath, identity, temporaryCreated ? 2 : 1);
    }
    if (temporaryCreated && identity) {
      rollbackFailed = !await unlinkOwned(temporaryPath, identity, 1) || rollbackFailed;
    }
    if (rollbackFailed) {
      fail("AEB_BAKE_OWNER_FRAGMENT_ROLLBACK_FAILED", "Source fragment rollback could not prove output removal.");
    }
    if (error instanceof AebBakePipelineError) throw error;
    fail("AEB_BAKE_OWNER_FRAGMENT_PUBLICATION_FAILED", "Source fragment publication failed closed.");
  }
}

async function readAdapterFrames(
  authority: NodeAebTaskRootAuthority,
  job: AebBakeJob,
  adapterInput: SvgaAebBakeAdapterInput,
  manifest: AebBakeManifest
): Promise<readonly AebBoundedTaskFile[]> {
  if (adapterInput.frames.length !== manifest.frames.length) {
    fail("AEB_BAKE_OWNER_FRAME_BINDING_INVALID", "Source fragment frame inventory does not match the manifest.");
  }
  const reader = new NodeAebBakeResourceReader(authority);
  const frames: AebBoundedTaskFile[] = [];
  for (const [index, adapterFrame] of adapterInput.frames.entries()) {
    const manifestFrame = manifest.frames[index];
    if (!manifestFrame
      || adapterFrame.frameIndex !== manifestFrame.frameIndex
      || adapterFrame.relativePath !== manifestFrame.relativePath
      || adapterFrame.resourceId !== manifestFrame.resourceId
      || adapterFrame.canonicalResourceId !== manifestFrame.canonicalResourceId
      || adapterFrame.contentHash !== manifestFrame.contentHash.value
      || adapterFrame.imageKey !== `aeb_${adapterFrame.resourceId}`) {
      fail("AEB_BAKE_OWNER_FRAME_BINDING_INVALID", "Source fragment frame does not match the manifest and adapter input.");
    }
    const validatedFrame = await reader.readFrame(
      { frameIndex: adapterFrame.frameIndex, relativePath: adapterFrame.relativePath },
      {
        width: adapterFrame.width,
        height: adapterFrame.height,
        maxEncodedBytes: job.budgets.maxEncodedBytes,
        maxDecodedRgbaBytes: job.budgets.maxDecodedRgbaBytes
      }
    );
    const frame = await authority.readBoundedTaskFile(
      adapterFrame.relativePath,
      job.budgets.maxEncodedBytes,
      "RESOURCE"
    );
    if (!frame.bytes.equals(validatedFrame.bytes)
      || sha256(frame.bytes) !== adapterFrame.contentHash) {
      fail("AEB_BAKE_OWNER_FRAME_HASH_MISMATCH", "Source fragment frame bytes changed after manifest construction.");
    }
    frames.push(frame);
  }
  return frames;
}

async function encodeFragment(
  frames: readonly AebBoundedTaskFile[],
  adapterInput: SvgaAebBakeAdapterInput,
  maxPackageBytes: number
): Promise<Buffer> {
  const schema = await loadAebReviewedSvgaSchemaAuthority();
  const sequence = buildSequenceModel(frames, adapterInput);
  const payload = moviePayload(sequence, adapterInput);
  const error = schema.encoderMovieEntity.verify(payload);
  if (error) fail("AEB_BAKE_OWNER_PROTOBUF_INVALID", "Source fragment failed fixed MovieEntity verification.");
  const bytes = Buffer.from(deflateSync(
    schema.encoderMovieEntity.encode(schema.encoderMovieEntity.create(payload)).finish()
  ));
  if (bytes.byteLength <= 0 || bytes.byteLength > maxPackageBytes) {
    fail("AEB_BAKE_OWNER_FRAGMENT_BUDGET_EXCEEDED", "Source fragment exceeds its package budget.");
  }
  await validateMovie(bytes, frames, adapterInput, maxPackageBytes);
  return bytes;
}

function moviePayload(
  sequence: FragmentSequenceModel,
  adapterInput: SvgaAebBakeAdapterInput
): object {
  return {
    version: "2.0",
    params: {
      viewBoxWidth: adapterInput.canvas.width,
      viewBoxHeight: adapterInput.canvas.height,
      fps: adapterInput.fps,
      frames: sequence.timeline.length
    },
    images: Object.fromEntries(sequence.resources.map((resource) => [resource.imageKey, resource.bytes])),
    sprites: sequence.resources.map((resource) => ({
      imageKey: resource.imageKey,
      frames: sequence.timeline.map((frame) => staticFrame(
        frame.canonicalResourceId === resource.canonicalResourceId ? 1 : 0,
        resource.width,
        resource.height
      ))
    })),
    audios: []
  };
}

function staticFrame(alpha: 0 | 1, width: number, height: number): object {
  return {
    alpha,
    layout: { x: 0, y: 0, width, height },
    transform: { a: 1, b: 0, c: 0, d: 1, tx: 0, ty: 0 },
    clipPath: "",
    shapes: []
  };
}

function buildSequenceModel(
  frames: readonly AebBoundedTaskFile[],
  adapterInput: SvgaAebBakeAdapterInput
): FragmentSequenceModel {
  if (frames.length !== adapterInput.frames.length || frames.length === 0) {
    fail("AEB_BAKE_OWNER_FRAME_BINDING_INVALID", "Source fragment sequence inventory is incomplete.");
  }
  const resourcesById = new Map<string, FragmentSequenceResource>();
  adapterInput.frames.forEach((frame, index) => {
    const bytes = frames[index]?.bytes;
    if (!bytes || sha256(bytes) !== frame.contentHash) {
      fail("AEB_BAKE_OWNER_FRAME_HASH_MISMATCH", "Source fragment sequence bytes do not match the adapter input.");
    }
    const resource: FragmentSequenceResource = {
      canonicalResourceId: frame.canonicalResourceId,
      imageKey: `aeb_${frame.canonicalResourceId}`,
      bytes: Buffer.from(bytes),
      width: frame.width,
      height: frame.height
    };
    const existing = resourcesById.get(frame.canonicalResourceId);
    if (existing
      && (!existing.bytes.equals(resource.bytes)
        || existing.width !== resource.width
        || existing.height !== resource.height)) {
      fail("AEB_BAKE_OWNER_DEDUPE_INVALID", "Canonical Bake resource identity maps to contradictory frame content.");
    }
    resourcesById.set(frame.canonicalResourceId, existing ?? resource);
  });
  const resources = [...resourcesById.values()]
    .sort((left, right) => compare(left.canonicalResourceId, right.canonicalResourceId));
  const timeline = adapterInput.frames.map((frame) => ({ ...frame }));
  return {
    resources,
    timeline,
    timelineDigest: sha256(Buffer.from(canonicalJson(timeline.map((frame) => ({
      frameIndex: frame.frameIndex,
      canonicalResourceId: frame.canonicalResourceId,
      contentHash: frame.contentHash
    })))))
  };
}

async function validateMovie(
  bytes: Buffer,
  frames: readonly AebBoundedTaskFile[],
  adapterInput: SvgaAebBakeAdapterInput,
  maxPackageBytes: number
): Promise<void> {
  try {
    const schema = await loadAebReviewedSvgaSchemaAuthority();
    const inflated = Buffer.from(inflateSync(bytes, { maxOutputLength: maxPackageBytes }));
    const sequence = buildSequenceModel(frames, adapterInput);
    inspectMovie(schema.encoderMovieEntity, inflated, sequence, adapterInput);
    inspectMovie(schema.reopenMovieEntity, inflated, sequence, adapterInput);
  } catch (error) {
    if (error instanceof AebBakePipelineError) throw error;
    fail("AEB_BAKE_OWNER_FRAGMENT_INVALID", "Source fragment failed fixed-schema reopen validation.");
  }
}

function inspectMovie(
  MovieEntity: protobuf.Type,
  inflated: Buffer,
  sequence: FragmentSequenceModel,
  adapterInput: SvgaAebBakeAdapterInput
): void {
  const movie = MovieEntity.toObject(MovieEntity.decode(inflated), {
    bytes: Buffer,
    defaults: true,
    arrays: true,
    objects: true
  }) as {
    version?: string;
    params?: { viewBoxWidth?: number; viewBoxHeight?: number; fps?: number; frames?: number };
    images?: Record<string, Buffer>;
    sprites?: Array<{ imageKey?: string; frames?: Array<{
      alpha?: number;
      layout?: { x?: number; y?: number; width?: number; height?: number };
      transform?: { a?: number; b?: number; c?: number; d?: number; tx?: number; ty?: number };
      clipPath?: string;
    }> }>;
    audios?: unknown[];
  };
  const images = movie.images ?? {};
  const sprites = movie.sprites ?? [];
  const imageKeys = Object.keys(images).sort(compare);
  const expectedImageKeys = sequence.resources.map((resource) => resource.imageKey).sort(compare);
  if (movie.version !== "2.0"
    || movie.params?.viewBoxWidth !== adapterInput.canvas.width
    || movie.params.viewBoxHeight !== adapterInput.canvas.height
    || movie.params.fps !== adapterInput.fps
    || movie.params.frames !== sequence.timeline.length
    || !sameJson(imageKeys, expectedImageKeys)
    || sprites.length !== sequence.resources.length
    || movie.audios?.length !== 0) {
    fail("AEB_BAKE_OWNER_FRAGMENT_INVALID", "Source fragment has unexpected MovieEntity semantics.");
  }
  const spritesByImageKey = new Map(sprites.map((sprite) => [sprite.imageKey ?? "", sprite]));
  if (spritesByImageKey.size !== sprites.length) {
    fail("AEB_BAKE_OWNER_FRAGMENT_INVALID", "Source fragment contains duplicate sprite resource identities.");
  }
  for (const resource of sequence.resources) {
    const embedded = images[resource.imageKey];
    const sprite = spritesByImageKey.get(resource.imageKey);
    if (!embedded
      || !Buffer.from(embedded).equals(resource.bytes)
      || !sprite
      || sprite.frames?.length !== sequence.timeline.length) {
      fail("AEB_BAKE_OWNER_FRAGMENT_INVALID", "Source fragment resource closure is incomplete.");
    }
    sprite.frames.forEach((frame, index) => {
      const expectedAlpha = sequence.timeline[index]?.canonicalResourceId === resource.canonicalResourceId ? 1 : 0;
      if (!isExpectedStaticFrame(frame, expectedAlpha, resource.width, resource.height)) {
        fail("AEB_BAKE_OWNER_FRAGMENT_INVALID", "Source fragment sprite timeline is inconsistent.");
      }
    });
  }
  sequence.timeline.forEach((timelineFrame, index) => {
    const active = sprites.filter((sprite) => sprite.frames?.[index]?.alpha === 1);
    if (active.length !== 1
      || active[0]?.imageKey !== `aeb_${timelineFrame.canonicalResourceId}`) {
      fail("AEB_BAKE_OWNER_FRAGMENT_INVALID", "Source fragment timeline does not select exactly one Bake frame.");
    }
  });
}

function isExpectedStaticFrame(
  frame: {
    alpha?: number;
    layout?: { x?: number; y?: number; width?: number; height?: number };
    transform?: { a?: number; b?: number; c?: number; d?: number; tx?: number; ty?: number };
    clipPath?: string;
  },
  alpha: number,
  width: number,
  height: number
): boolean {
  return frame.alpha === alpha
    && frame.layout?.x === 0
    && frame.layout.y === 0
    && frame.layout.width === width
    && frame.layout.height === height
    && frame.transform?.a === 1
    && frame.transform.b === 0
    && frame.transform.c === 0
    && frame.transform.d === 1
    && frame.transform.tx === 0
    && frame.transform.ty === 0
    && frame.clipPath === "";
}

function createReport(
  input: RunAebBakeOwnerSourceFlowInput,
  executionReceiptHash: string,
  manifest: AebBakeManifest,
  published: AebPublishedSuccessorPackage,
  project: AebBoundedTaskFile,
  sourcePackage: AebBoundedTaskFile,
  fragment: PublishedFragment
): AebBakeOwnerSourceFlowReport {
  const decisions = input.planner.decisions.slice().sort((a, b) => compare(a.layerId, b.layerId));
  const unsigned: Omit<AebBakeOwnerSourceFlowReport, "reportHash"> = {
    schemaVersion: AEB_BAKE_OWNER_SOURCE_FLOW_SCHEMA_VERSION,
    authorityState: "source_validated_bake_owner_flow_ready",
    taskId: input.job.task.taskId,
    fixtureId: input.fixtureId,
    jobId: input.job.jobId,
    packageId: input.job.packageId,
    sourceFingerprint: input.job.source.sourceFingerprint,
    classification: {
      nativeLayerIds: decisions.filter((item) => item.outcome === "native").map((item) => item.layerId),
      bakeRequiredLayerIds: decisions.filter((item) => item.outcome === "bake_required").map((item) => item.layerId),
      blockedLayerIds: decisions.filter((item) => item.outcome === "blocked").map((item) => item.layerId),
      preservedReplaceableElementIds: published.bundle.preservedNativeLayers
        .flatMap((layer) => layer.replaceableElementIds)
        .sort(compare)
    },
    execution: {
      mode: "synthetic_fixture",
      receiptHash: executionReceiptHash,
      actualAeRenderExecuted: false
    },
    manifest: {
      manifestId: manifest.manifestId,
      frameCount: manifest.resources.frameCount,
      uniqueContentCount: manifest.resources.uniqueContentCount,
      deduplicatedFrameCount: manifest.resources.deduplicatedFrameCount,
      totalEncodedBytes: manifest.resources.totalEncodedBytes,
      totalDecodedRgbaBytes: manifest.resources.totalDecodedRgbaBytes,
      estimatedPackageBytes: manifest.resources.estimatedPackageBytes
    },
    package: {
      sourceProjectContentHash: sha256(project.bytes),
      sourcePackageContentHash: sha256(sourcePackage.bytes),
      successorPackageRelativePath: published.publicationReceipt.successorPackage.relativePath,
      successorPackageContentHash: published.publicationReceipt.successorPackage.contentHash.value,
      sourceProjectUnchanged: true,
      sourcePackageUnchanged: true,
      f1ReinsertionValidated: true
    },
    fragment: {
      relativePath: fragment.outputName,
      encodedBytes: fragment.output.encodedBytes,
      contentHash: fragment.contentHash,
      identityDigest: fragment.output.identityDigest,
      protoFileSha256: AEB_REVIEWED_SVGA_PROTO_FILE_SHA256,
      descriptorSha256: AEB_REVIEWED_SVGA_DESCRIPTOR_SHA256,
      timelineFrameCount: fragment.frames.length,
      uniqueImageCount: fragment.uniqueImageCount,
      spriteCount: fragment.spriteCount,
      timelineDigest: fragment.timelineDigest,
      standardsValidSvgaFragment: true,
      nativeMergeRequired: true,
      fullCompositionEncoded: false
    },
    authority: {
      sourceValidationOnly: true,
      actualBakeAuthorityMinted: false,
      packageRuntimeAuthorityMinted: false,
      previewOrSaveAuthorized: false,
      runtimeProved: false
    }
  };
  return deepFreeze({ ...unsigned, reportHash: sha256(Buffer.from(canonicalJson(unsigned))) });
}

async function removeOwnedFile(
  authority: NodeAebTaskRootAuthority,
  relativePath: string,
  expected: AebBoundedTaskFile
): Promise<boolean> {
  try {
    const filePath = await authority.directChildPath(relativePath);
    const identity = await fileIdentity(filePath);
    if (`${identity.dev}:${identity.ino}` !== expected.fileIdentity || identity.nlink !== 1) return false;
    await unlinkSame(filePath, identity, 1);
    await authority.syncTaskRoot();
    return !await pathExists(filePath);
  } catch {
    return false;
  }
}

interface FileIdentity { dev: number; ino: number; nlink: number }

async function fileIdentity(filePath: string): Promise<FileIdentity> {
  const stat = await lstat(filePath);
  if (!stat.isFile() || stat.isSymbolicLink()) {
    fail("AEB_BAKE_OWNER_PATH_INVALID", "Source flow publication path is not a regular file.");
  }
  return { dev: stat.dev, ino: stat.ino, nlink: stat.nlink };
}

function assertIdentity(actual: FileIdentity, expected: FileIdentity | undefined): void {
  if (!expected || actual.dev !== expected.dev || actual.ino !== expected.ino) {
    fail("AEB_BAKE_OWNER_PATH_CHANGED", "Source flow publication path identity changed.");
  }
}

async function unlinkSame(filePath: string, identity: FileIdentity, expectedNlink: number): Promise<void> {
  const current = await fileIdentity(filePath);
  assertIdentity(current, identity);
  if (current.nlink !== expectedNlink) {
    fail("AEB_BAKE_OWNER_PATH_CHANGED", "Source flow refused to unlink an aliased output.");
  }
  await unlink(filePath);
}

async function unlinkOwned(filePath: string, identity: FileIdentity, expectedNlink: number): Promise<boolean> {
  try {
    await unlinkSame(filePath, identity, expectedNlink);
    return !await pathExists(filePath);
  } catch {
    return false;
  }
}

async function pathExists(filePath: string): Promise<boolean> {
  try {
    await lstat(filePath);
    return true;
  } catch (error) {
    return (error as NodeJS.ErrnoException).code !== "ENOENT";
  }
}

function sameBoundFile(left: AebBoundedTaskFile, right: AebBoundedTaskFile): boolean {
  return left.encodedBytes === right.encodedBytes
    && left.fileIdentity === right.fileIdentity
    && left.identityDigest === right.identityDigest
    && left.bytes.equals(right.bytes);
}

function sameBoundFiles(
  left: readonly AebBoundedTaskFile[],
  right: readonly AebBoundedTaskFile[]
): boolean {
  return left.length === right.length
    && left.every((file, index) => Boolean(right[index] && sameBoundFile(file, right[index]!)));
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isIdentifier(value: unknown): value is string {
  return typeof value === "string" && /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(value);
}

function isSha256(value: unknown): value is string {
  return typeof value === "string" && /^[a-f0-9]{64}$/.test(value);
}

function isPositiveInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0;
}

function deepFreeze<T>(value: T): T {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value as Record<string, unknown>)) deepFreeze(child);
  }
  return value;
}

function fail(code: string, message: string): never {
  throw new AebBakePipelineError(code, message);
}
