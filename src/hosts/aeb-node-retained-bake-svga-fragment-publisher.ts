import { createHash } from "node:crypto";
import { constants } from "node:fs";
import { link, lstat, open, unlink } from "node:fs/promises";
import { deflateSync, inflateSync } from "node:zlib";
import protobuf from "protobufjs";
import type { CreateAebRetainedBakeAuthorityChainInput, AebRetainedBakeAuthorityChainReceipt } from "../workbench/aeb-retained-bake-authority-chain.js";
import { verifyAebRetainedBakeAuthorityChainReceipt } from "../workbench/aeb-retained-bake-authority-chain.js";
import { AebBakePipelineError } from "../workbench/aeb-bake-pipeline.js";
import type { AebBakeReadResource } from "../workbench/aeb-bake-contracts.js";
import { consumeAebRetainedBakePublicationCapability } from "./aeb-node-bake-package-publisher.js";
import { NodeAebBakeResourceReader, NodeAebTaskRootAuthority, type AebBoundedTaskFile } from "./aeb-node-bake-resource-reader.js";
import {
  AEB_REVIEWED_SVGA_DESCRIPTOR_SHA256,
  AEB_REVIEWED_SVGA_PROTO_FILE_SHA256,
  loadAebReviewedSvgaSchemaAuthority,
  type AebReviewedSvgaSchemaAuthority
} from "./aeb-reviewed-svga-schema.js";

export const AEB_RETAINED_BAKE_SVGA_FRAGMENT_RECEIPT_SCHEMA_VERSION = "aeb-retained-bake-svga-fragment-receipt-v1" as const;

export type AebRetainedBakeSvgaPublicationPhase = "write" | "finalize" | "cleanup" | "verification";

export interface AebRetainedBakeSvgaPublicationHooks {
  beforePhase?(phase: AebRetainedBakeSvgaPublicationPhase): Promise<void> | void;
}

export interface AebRetainedBakeSvgaFragmentReceipt {
  schemaVersion: typeof AEB_RETAINED_BAKE_SVGA_FRAGMENT_RECEIPT_SCHEMA_VERSION;
  authorityState: "source_validated_standards_valid_baked_svga_fragment";
  artifactRole: "baked_sequence_fragment";
  taskId: string;
  executionId: string;
  jobId: string;
  packageId: string;
  sourceFingerprint: string;
  chainHash: string;
  manifestId: string;
  packageBundleId: string;
  packagePublicationReceiptHash: string;
  svgaAdapterDigest: string;
  frameInventoryDigest: string;
  actualAeRenderExecuted: true;
  schema: {
    protoFileSha256: typeof AEB_REVIEWED_SVGA_PROTO_FILE_SHA256;
    descriptorSha256: typeof AEB_REVIEWED_SVGA_DESCRIPTOR_SHA256;
    independentlyReopened: true;
  };
  sourcePackage: {
    relativePath: string;
    contentHash: string;
    identityDigest: string;
    unchanged: true;
  };
  successorPackage: {
    relativePath: string;
    contentHash: string;
    identityDigest: string;
    unchanged: true;
  };
  frame: {
    frameIndex: number;
    relativePath: string;
    imageKey: string;
    contentHash: string;
    encodedBytes: number;
    width: number;
    height: number;
  };
  output: {
    relativePath: string;
    encodedBytes: number;
    contentHash: string;
    identityDigest: string;
    atomicAbsentDestination: true;
    noOverwrite: true;
  };
  cleanup: {
    temporaryPathRemoved: true;
    rollbackOnFailure: true;
    partialOutputPresent: false;
  };
  validation: {
    movieEntityVerified: true;
    inflated: true;
    decoded: true;
    reopenInspected: true;
    exactFrameBytesBound: true;
    standardsValidSvgaEncoded: true;
    nativeMergeRequired: true;
    fullCompositionEncoded: false;
    finalCompositionEncoderRequired: true;
    runtimeValidatorRequired: true;
    runtimeProved: false;
    realPreviewValidated: false;
    saveAsBytesAuthorized: false;
    installedQaAccepted: false;
    productOwnerAccepted: false;
  };
  receiptHash: string;
}

export interface AebPublishedRetainedBakeSvgaFragment {
  receipt: AebRetainedBakeSvgaFragmentReceipt;
}

export interface AebRetainedBakeSvgaFragmentSourceProbe {
  schemaVersion: "aeb-retained-bake-svga-fragment-source-probe-v1";
  authorityState: "source_validated_non_authoritative";
  actualAeRenderExecuted: false;
  schema: {
    protoFileSha256: typeof AEB_REVIEWED_SVGA_PROTO_FILE_SHA256;
    descriptorSha256: typeof AEB_REVIEWED_SVGA_DESCRIPTOR_SHA256;
    independentlyReopened: true;
  };
  output: {
    relativePath: string;
    encodedBytes: number;
    contentHash: string;
    identityDigest: string;
    atomicAbsentDestination: true;
    noOverwrite: true;
  };
  validation: {
    standardsValidSvgaEncoded: true;
    nativeMergeRequired: true;
    runtimeProved: false;
    realPreviewValidated: false;
    saveAsBytesAuthorized: false;
  };
  probeHash: string;
}

export interface PublishAebRetainedBakeSvgaFragmentInput {
  chainReceipt: AebRetainedBakeAuthorityChainReceipt;
  chainInput: CreateAebRetainedBakeAuthorityChainInput;
}

interface Candidate {
  bytes: Buffer;
  contentHash: string;
  sourcePackage: AebBoundedTaskFile;
  successorPackage: AebBoundedTaskFile;
  frame: AebBakeReadResource;
  schema: AebReviewedSvgaSchemaAuthority;
}

interface PublishedCandidate {
  output: AebBoundedTaskFile;
  sourcePackage: AebBoundedTaskFile;
  successorPackage: AebBoundedTaskFile;
}

interface DecodedMovie {
  version?: string;
  params?: { viewBoxWidth?: number; viewBoxHeight?: number; fps?: number; frames?: number };
  images?: Record<string, Buffer>;
  sprites?: Array<{
    imageKey?: string;
    frames?: Array<{
      alpha?: number;
      layout?: { x?: number; y?: number; width?: number; height?: number };
      transform?: { a?: number; b?: number; c?: number; d?: number; tx?: number; ty?: number };
      clipPath?: string;
      shapes?: unknown[];
    }>;
  }>;
  audios?: unknown[];
}

interface PrivateRetainedBakeSvgaCapabilityState {
  chainHash: string;
  protoFileSha256: typeof AEB_REVIEWED_SVGA_PROTO_FILE_SHA256;
  descriptorSha256: typeof AEB_REVIEWED_SVGA_DESCRIPTOR_SHA256;
  consumed: boolean;
}

const retainedBakeSvgaCapabilities = new WeakMap<object, PrivateRetainedBakeSvgaCapabilityState>();
const publishedRetainedBakeSvgaAuthorities = new WeakMap<object, {
  chainHash: string;
  receiptHash: string;
  outputIdentityDigest: string;
}>();
const publishedRetainedBakeSourceProbes = new WeakMap<object, {
  publisher: NodeAebRetainedBakeSvgaFragmentPublisher;
  chainHash: string;
  outputName: string;
  output: AebBoundedTaskFile;
  revoked: boolean;
}>();

export function aebRetainedBakeSvgaFragmentFileName(chainHash: string): string {
  if (!isSha256(chainHash)) {
    fail("AE_RETAINED_CHAIN_RECEIPT_INVALID", "Retained Bake chain hash is invalid.");
  }
  return `aeb-bake-fragment-${chainHash.slice(0, 24)}.svga`;
}

export function aebRetainedBakeSvgaFragmentSourceProbeFileName(chainHash: string): string {
  if (!isSha256(chainHash)) {
    fail("AE_RETAINED_CHAIN_RECEIPT_INVALID", "Retained Bake chain hash is invalid.");
  }
  return `aeb-bake-fragment-source-probe-${chainHash.slice(0, 24)}.svga`;
}

export class NodeAebRetainedBakeSvgaFragmentPublisher {
  constructor(
    private readonly authority: NodeAebTaskRootAuthority,
    private readonly hooks: AebRetainedBakeSvgaPublicationHooks = {}
  ) {}

  async publish(input: PublishAebRetainedBakeSvgaFragmentInput): Promise<AebPublishedRetainedBakeSvgaFragment> {
    const capability = mintPrivateRetainedBakeSvgaCapability(input);
    const schema = await loadAebReviewedSvgaSchemaAuthority();
    consumePrivateRetainedBakeSvgaCapability(capability, input, schema);
    const candidate = await this.buildCandidate(input, schema);
    const outputName = aebRetainedBakeSvgaFragmentFileName(input.chainReceipt.chainHash);
    const publishedCandidate = await this.publishCandidate(input, candidate, outputName, "aeb-svga-temp");
    const receipt = await this.createReceipt(
      input,
      candidate,
      publishedCandidate.output,
      publishedCandidate.sourcePackage,
      publishedCandidate.successorPackage
    );
    await this.rebindProtectedInputsOrRollback(input, candidate, outputName, publishedCandidate.output);
    const published = { receipt };
    publishedRetainedBakeSvgaAuthorities.set(published, {
      chainHash: input.chainReceipt.chainHash,
      receiptHash: receipt.receiptHash,
      outputIdentityDigest: receipt.output.identityDigest
    });
    return published;
  }

  async publishSourceProbe(
    input: PublishAebRetainedBakeSvgaFragmentInput
  ): Promise<AebRetainedBakeSvgaFragmentSourceProbe> {
    const schema = await loadAebReviewedSvgaSchemaAuthority();
    const candidate = await this.buildCandidate(input, schema);
    const outputName = aebRetainedBakeSvgaFragmentSourceProbeFileName(input.chainReceipt.chainHash);
    const publishedCandidate = await this.publishCandidate(input, candidate, outputName, "aeb-svga-probe-temp");
    const probe = await this.createSourceProbe(input, candidate, publishedCandidate.output);
    const rebound = await this.rebindProtectedInputsOrRollback(input, candidate, outputName, publishedCandidate.output);
    publishedRetainedBakeSourceProbes.set(probe, {
      publisher: this,
      chainHash: input.chainReceipt.chainHash,
      outputName,
      output: rebound.output,
      revoked: false
    });
    return probe;
  }

  async verifySourceProbe(
    probe: AebRetainedBakeSvgaFragmentSourceProbe,
    input: PublishAebRetainedBakeSvgaFragmentInput
  ): Promise<boolean> {
    try {
      const schema = await loadAebReviewedSvgaSchemaAuthority();
      const candidate = await this.buildCandidate(input, schema);
      const outputName = aebRetainedBakeSvgaFragmentSourceProbeFileName(input.chainReceipt.chainHash);
      const output = await this.authority.readBoundedTaskFile(
        outputName,
        input.chainInput.plan.job.budgets.maxPackageBytes,
        "AE_RETAINED_SVGA_OUTPUT"
      );
      if (!output.bytes.equals(candidate.bytes)
        || output.encodedBytes !== candidate.bytes.byteLength) {
        return false;
      }
      const rebound = await this.rebindProtectedInputs(input, candidate, outputName, output);
      const expected = await this.createSourceProbe(input, candidate, rebound.output);
      await this.rebindProtectedInputs(input, candidate, outputName, rebound.output);
      return sameJson(probe, expected);
    } catch {
      return false;
    }
  }

  async revokeSourceProbe(
    probe: AebRetainedBakeSvgaFragmentSourceProbe,
    input: PublishAebRetainedBakeSvgaFragmentInput
  ): Promise<boolean> {
    const privateState = publishedRetainedBakeSourceProbes.get(probe);
    if (!privateState
      || privateState.publisher !== this
      || privateState.revoked
      || privateState.chainHash !== input.chainReceipt.chainHash
      || privateState.outputName !== probe.output.relativePath
      || privateState.output.identityDigest !== probe.output.identityDigest) {
      return false;
    }
    privateState.revoked = true;
    try {
      await this.removeOwnedSourceProbeOrFail(privateState.outputName, privateState.output);
      return true;
    } catch {
      return false;
    }
  }

  private async createSourceProbe(
    input: PublishAebRetainedBakeSvgaFragmentInput,
    candidate: Candidate,
    output: AebBoundedTaskFile
  ): Promise<AebRetainedBakeSvgaFragmentSourceProbe> {
    const schema = candidate.schema;
    const outputName = aebRetainedBakeSvgaFragmentSourceProbeFileName(input.chainReceipt.chainHash);
    const unsigned: Omit<AebRetainedBakeSvgaFragmentSourceProbe, "probeHash"> = {
      schemaVersion: "aeb-retained-bake-svga-fragment-source-probe-v1",
      authorityState: "source_validated_non_authoritative",
      actualAeRenderExecuted: false,
      schema: {
        protoFileSha256: schema.protoFileSha256,
        descriptorSha256: schema.descriptorSha256,
        independentlyReopened: true
      },
      output: {
        relativePath: outputName,
        encodedBytes: output.encodedBytes,
        contentHash: candidate.contentHash,
        identityDigest: output.identityDigest,
        atomicAbsentDestination: true,
        noOverwrite: true
      },
      validation: {
        standardsValidSvgaEncoded: true,
        nativeMergeRequired: true,
        runtimeProved: false,
        realPreviewValidated: false,
        saveAsBytesAuthorized: false
      }
    };
    return { ...unsigned, probeHash: hashCanonicalLocal(unsigned) };
  }

  private async publishCandidate(
    input: PublishAebRetainedBakeSvgaFragmentInput,
    candidate: Candidate,
    outputName: string,
    temporaryPrefix: string
  ): Promise<PublishedCandidate> {
    const outputPath = await this.authority.directChildPath(outputName);
    const temporaryName = `${temporaryPrefix}-${input.chainReceipt.chainHash.slice(0, 24)}.tmp`;
    const temporaryPath = await this.authority.directChildPath(temporaryName);
    let temporaryCreated = false;
    let destinationCreated = false;
    let publicationIdentity: FileIdentity | undefined;
    let phase: AebRetainedBakeSvgaPublicationPhase = "write";

    try {
      await this.authority.verifyPinned();
      await this.hooks.beforePhase?.("write");
      await this.authority.verifyPinned();
      const handle = await open(
        temporaryPath,
        constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW,
        0o600
      );
      temporaryCreated = true;
      try {
        await handle.writeFile(candidate.bytes);
        await handle.sync();
      } finally {
        await handle.close();
      }
      publicationIdentity = await fileIdentity(temporaryPath);
      await this.authority.syncTaskRoot();

      phase = "finalize";
      await this.hooks.beforePhase?.("finalize");
      await this.authority.verifyPinned();
      await link(temporaryPath, outputPath);
      destinationCreated = true;
      assertIdentity(await fileIdentity(outputPath), publicationIdentity);
      await this.authority.syncTaskRoot();

      phase = "cleanup";
      await this.hooks.beforePhase?.("cleanup");
      await this.authority.verifyPinned();
      await unlinkIfSame(temporaryPath, publicationIdentity);
      temporaryCreated = false;
      await this.authority.syncTaskRoot();

      phase = "verification";
      await this.hooks.beforePhase?.("verification");
      const output = await this.authority.readBoundedTaskFile(
        outputName,
        input.chainInput.plan.job.budgets.maxPackageBytes,
        "AE_RETAINED_SVGA_OUTPUT"
      );
      if (!output.bytes.equals(candidate.bytes)
        || output.encodedBytes !== candidate.bytes.byteLength) {
        fail("AE_RETAINED_SVGA_READBACK_MISMATCH", "Published retained Bake SVGA bytes failed exact read-back.");
      }
      const rebound = await this.rebindProtectedInputs(input, candidate, outputName, output);
      return {
        output: rebound.output,
        sourcePackage: rebound.sourcePackage,
        successorPackage: rebound.successorPackage
      };
    } catch (error) {
      const temporaryExisted = isErrno(error, "EEXIST") && phase === "write" && !temporaryCreated;
      const outputExisted = isErrno(error, "EEXIST") && phase === "finalize" && !destinationCreated;
      const rollbackErrors: unknown[] = [];
      if (destinationCreated) {
        try { await unlinkIfSame(outputPath, publicationIdentity); } catch (rollbackError) { rollbackErrors.push(rollbackError); }
      }
      if (temporaryCreated) {
        try { await unlinkIfSame(temporaryPath, publicationIdentity); } catch (rollbackError) { rollbackErrors.push(rollbackError); }
      }
      const partialOutputPresent = destinationCreated && await pathExists(outputPath);
      const temporaryPathPresent = temporaryCreated && await pathExists(temporaryPath);
      if (rollbackErrors.length > 0 || partialOutputPresent || temporaryPathPresent) {
        fail("AE_RETAINED_SVGA_ROLLBACK_FAILED", "Retained Bake SVGA rollback could not prove zero partial output.");
      }
      if (outputExisted) {
        fail("AE_RETAINED_SVGA_OUTPUT_EXISTS", "Retained Bake SVGA output already exists and was not overwritten.");
      }
      if (temporaryExisted) {
        fail("AE_RETAINED_SVGA_TEMP_EXISTS", "Retained Bake SVGA temporary publication path already exists and was not modified.");
      }
      if (error instanceof AebBakePipelineError) throw error;
      fail("AE_RETAINED_SVGA_PUBLICATION_FAILED", `Retained Bake SVGA ${phase} failed and was rolled back.`);
    }
  }

  async verifyPublished(
    published: AebPublishedRetainedBakeSvgaFragment,
    input: PublishAebRetainedBakeSvgaFragmentInput
  ): Promise<boolean> {
    try {
      const privateState = publishedRetainedBakeSvgaAuthorities.get(published);
      if (!privateState
        || privateState.chainHash !== input.chainReceipt.chainHash
        || privateState.receiptHash !== published.receipt.receiptHash
        || privateState.outputIdentityDigest !== published.receipt.output.identityDigest) {
        return false;
      }
      const schema = await loadAebReviewedSvgaSchemaAuthority();
      const candidate = await this.buildCandidate(input, schema);
      const outputName = aebRetainedBakeSvgaFragmentFileName(input.chainReceipt.chainHash);
      const output = await this.authority.readBoundedTaskFile(
        outputName,
        input.chainInput.plan.job.budgets.maxPackageBytes,
        "AE_RETAINED_SVGA_OUTPUT"
      );
      if (!output.bytes.equals(candidate.bytes)
        || output.encodedBytes !== candidate.bytes.byteLength) {
        return false;
      }
      const rebound = await this.rebindProtectedInputs(input, candidate, outputName, output);
      const expected = await this.createReceipt(
        input,
        candidate,
        rebound.output,
        rebound.sourcePackage,
        rebound.successorPackage
      );
      await this.rebindProtectedInputs(input, candidate, outputName, rebound.output);
      return sameJson(published.receipt, expected);
    } catch {
      return false;
    }
  }

  private async buildCandidate(
    input: PublishAebRetainedBakeSvgaFragmentInput,
    schema: AebReviewedSvgaSchemaAuthority
  ): Promise<Candidate> {
    if (!input.chainInput
      || !input.chainInput.executionAuthority
      || !input.chainInput.publicationAuthority
      || !input.chainInput.hasher
      || !await verifyAebRetainedBakeAuthorityChainReceipt(input.chainReceipt, input.chainInput)) {
      fail("AE_RETAINED_CHAIN_RECEIPT_INVALID", "Retained Bake SVGA publication requires the live validated authority chain.");
    }
    const { plan, adapterInput, published } = input.chainInput;
    if (this.authority.taskId !== plan.job.task.taskId
      || adapterInput.frames.length !== 1
      || adapterInput.bakedLayerIds.length !== 1
      || adapterInput.preservedNativeLayerIds.length === 0
      || adapterInput.validation.standardsValidSvgaEncoded !== false
      || adapterInput.validation.realPreviewValidated !== false) {
      fail("AE_RETAINED_SVGA_FRAGMENT_SCOPE_INVALID", "Retained Bake SVGA fragment is limited to the reviewed one-frame mixed fixture boundary.");
    }
    if (!await input.chainInput.publicationAuthority.verifyPublishedSuccessor(published, input.chainInput.hasher)) {
      fail("AE_RETAINED_SVGA_PACKAGE_AUTHORITY_INVALID", "Retained Bake SVGA publication requires the current physical successor authority.");
    }

    const sourcePackage = await this.authority.readBoundedTaskFile(
      plan.sourceFiles.packageRelativePath,
      plan.sourceFiles.packageMaxBytes,
      "SOURCE_PACKAGE"
    );
    if (sha256Bytes(sourcePackage.bytes) !== plan.sourceFiles.packageContentHash) {
      fail("AE_RETAINED_SVGA_SOURCE_PACKAGE_MISMATCH", "Source package bytes no longer match the retained Bake plan.");
    }
    const successorPackage = await this.authority.readBoundedTaskFile(
      published.publicationReceipt.successorPackage.relativePath,
      published.publicationReceipt.successorPackage.encodedBytes,
      "SUCCESSOR_PACKAGE"
    );
    if (sha256Bytes(successorPackage.bytes)
      !== published.publicationReceipt.successorPackage.contentHash.value) {
      fail("AE_RETAINED_SVGA_SUCCESSOR_PACKAGE_MISMATCH", "Physical successor package bytes no longer match publication authority.");
    }

    const adapterFrame = adapterInput.frames[0]!;
    const frame = await new NodeAebBakeResourceReader(this.authority).readFrame(
      { frameIndex: adapterFrame.frameIndex, relativePath: adapterFrame.relativePath },
      {
        width: adapterFrame.width,
        height: adapterFrame.height,
        maxEncodedBytes: plan.job.budgets.maxEncodedBytes,
        maxDecodedRgbaBytes: plan.job.budgets.maxDecodedRgbaBytes
      }
    );
    if (frame.encodedBytes !== input.chainInput.manifest.frames[0]!.encodedBytes
      || sha256Bytes(frame.bytes) !== adapterFrame.contentHash) {
      fail("AE_RETAINED_SVGA_FRAME_BINDING_MISMATCH", "Baked frame bytes no longer match the retained adapter input.");
    }

    const MovieEntity = schema.encoderMovieEntity;
    const moviePayload = {
      version: "2.0",
      params: {
        viewBoxWidth: adapterInput.canvas.width,
        viewBoxHeight: adapterInput.canvas.height,
        fps: adapterInput.fps,
        frames: 1
      },
      images: { [adapterFrame.imageKey]: frame.bytes },
      sprites: [{
        imageKey: adapterFrame.imageKey,
        frames: [{
          alpha: 1,
          layout: { x: 0, y: 0, width: adapterFrame.width, height: adapterFrame.height },
          transform: { a: 1, b: 0, c: 0, d: 1, tx: 0, ty: 0 },
          clipPath: "",
          shapes: []
        }]
      }],
      audios: []
    };
    const verificationError = MovieEntity.verify(moviePayload);
    if (verificationError) {
      fail("AE_RETAINED_SVGA_PROTOBUF_INVALID", "Retained Bake fragment failed MovieEntity verification.");
    }
    const bytes = deflateSync(MovieEntity.encode(MovieEntity.create(moviePayload)).finish());
    if (bytes.byteLength <= 0 || bytes.byteLength > plan.job.budgets.maxPackageBytes) {
      fail("AE_RETAINED_SVGA_BUDGET_EXCEEDED", "Retained Bake SVGA fragment exceeds the approved package budget.");
    }
    await validateExactMovie(
      MovieEntity,
      schema.reopenMovieEntity,
      bytes,
      adapterFrame,
      adapterInput.canvas,
      adapterInput.fps,
      plan.job.budgets.maxPackageBytes
    );
    return {
      bytes,
      contentHash: sha256Bytes(bytes),
      sourcePackage,
      successorPackage,
      frame,
      schema
    };
  }

  private async rebindProtectedInputs(
    input: PublishAebRetainedBakeSvgaFragmentInput,
    before: Candidate,
    outputName: string,
    beforeOutput: AebBoundedTaskFile
  ): Promise<PublishedCandidate> {
    if (!await input.chainInput.publicationAuthority.verifyPublishedSuccessor(
      input.chainInput.published,
      input.chainInput.hasher
    )) {
      fail("AE_RETAINED_SVGA_PACKAGE_AUTHORITY_CHANGED", "Physical successor authority changed during SVGA publication.");
    }
    const sourcePackage = await this.authority.readBoundedTaskFile(
      input.chainInput.plan.sourceFiles.packageRelativePath,
      input.chainInput.plan.sourceFiles.packageMaxBytes,
      "SOURCE_PACKAGE"
    );
    const successorPackage = await this.authority.readBoundedTaskFile(
      input.chainInput.published.publicationReceipt.successorPackage.relativePath,
      input.chainInput.published.publicationReceipt.successorPackage.encodedBytes,
      "SUCCESSOR_PACKAGE"
    );
    const output = await this.authority.readBoundedTaskFile(
      outputName,
      input.chainInput.plan.job.budgets.maxPackageBytes,
      "AE_RETAINED_SVGA_OUTPUT"
    );
    if (!sameBoundFile(before.sourcePackage, sourcePackage)
      || !sameBoundFile(before.successorPackage, successorPackage)) {
      fail("AE_RETAINED_SVGA_PROTECTED_INPUT_CHANGED", "Source or successor package changed during SVGA publication.");
    }
    if (!sameBoundFile(beforeOutput, output)
      || output.encodedBytes !== before.bytes.byteLength
      || !output.bytes.equals(before.bytes)) {
      fail("AE_RETAINED_SVGA_PROTECTED_OUTPUT_CHANGED", "Published retained Bake SVGA output changed before authority branding.");
    }
    return { output, sourcePackage, successorPackage };
  }

  private async rebindProtectedInputsOrRollback(
    input: PublishAebRetainedBakeSvgaFragmentInput,
    before: Candidate,
    outputName: string,
    beforeOutput: AebBoundedTaskFile
  ): Promise<PublishedCandidate> {
    try {
      return await this.rebindProtectedInputs(input, before, outputName, beforeOutput);
    } catch (error) {
      await this.removeOwnedPublishedOutput(outputName, beforeOutput);
      throw error;
    }
  }

  private async removeOwnedPublishedOutput(
    outputName: string,
    expectedOutput: AebBoundedTaskFile
  ): Promise<void> {
    const outputPath = await this.authority.directChildPath(outputName);
    try {
      const currentIdentity = await fileIdentity(outputPath);
      if (fileIdentityString(currentIdentity) === expectedOutput.fileIdentity) {
        await unlink(outputPath);
        await this.authority.syncTaskRoot();
      }
    } catch {
      // Preserve the original authority failure; ordinary rollback is already
      // covered inside publishCandidate before this post-receipt rebind phase.
    }
  }

  private async removeOwnedSourceProbeOrFail(
    outputName: string,
    expectedOutput: AebBoundedTaskFile
  ): Promise<void> {
    const outputPath = await this.authority.directChildPath(outputName);
    const currentIdentity = await lstat(outputPath);
    if (!currentIdentity.isFile()
      || currentIdentity.isSymbolicLink()
      || currentIdentity.nlink !== 1
      || fileIdentityString(currentIdentity) !== expectedOutput.fileIdentity) {
      fail(
        "AE_RETAINED_SVGA_SOURCE_PROBE_ROLLBACK_IDENTITY_MISMATCH",
        "Retained Bake source-probe rollback refused an unowned or replaced output."
      );
    }
    await unlink(outputPath);
    await this.authority.syncTaskRoot();
    if (await pathExists(outputPath)) {
      fail(
        "AE_RETAINED_SVGA_SOURCE_PROBE_ROLLBACK_FAILED",
        "Retained Bake source-probe rollback could not prove output absence."
      );
    }
  }

  private async createReceipt(
    input: PublishAebRetainedBakeSvgaFragmentInput,
    candidate: Candidate,
    output: AebBoundedTaskFile,
    sourcePackage: AebBoundedTaskFile,
    successorPackage: AebBoundedTaskFile
  ): Promise<AebRetainedBakeSvgaFragmentReceipt> {
    const { chainReceipt, chainInput } = input;
    const adapterFrame = chainInput.adapterInput.frames[0]!;
    const unsigned: Omit<AebRetainedBakeSvgaFragmentReceipt, "receiptHash"> = {
      schemaVersion: AEB_RETAINED_BAKE_SVGA_FRAGMENT_RECEIPT_SCHEMA_VERSION,
      authorityState: "source_validated_standards_valid_baked_svga_fragment",
      artifactRole: "baked_sequence_fragment",
      taskId: chainReceipt.taskId,
      executionId: chainReceipt.executionId,
      jobId: chainReceipt.jobId,
      packageId: chainReceipt.packageId,
      sourceFingerprint: chainReceipt.sourceFingerprint,
      chainHash: chainReceipt.chainHash,
      manifestId: chainReceipt.manifestId,
      packageBundleId: chainReceipt.packageBundleId,
      packagePublicationReceiptHash: chainReceipt.publicationReceiptHash,
      svgaAdapterDigest: chainReceipt.svgaAdapterDigest,
      frameInventoryDigest: chainReceipt.frameInventoryDigest,
      actualAeRenderExecuted: true,
      schema: {
        protoFileSha256: candidate.schema.protoFileSha256,
        descriptorSha256: candidate.schema.descriptorSha256,
        independentlyReopened: true
      },
      sourcePackage: {
        relativePath: chainInput.plan.sourceFiles.packageRelativePath,
        contentHash: sha256Bytes(sourcePackage.bytes),
        identityDigest: sourcePackage.identityDigest,
        unchanged: true
      },
      successorPackage: {
        relativePath: chainInput.published.publicationReceipt.successorPackage.relativePath,
        contentHash: sha256Bytes(successorPackage.bytes),
        identityDigest: successorPackage.identityDigest,
        unchanged: true
      },
      frame: {
        frameIndex: adapterFrame.frameIndex,
        relativePath: adapterFrame.relativePath,
        imageKey: adapterFrame.imageKey,
        contentHash: sha256Bytes(candidate.frame.bytes),
        encodedBytes: candidate.frame.encodedBytes,
        width: adapterFrame.width,
        height: adapterFrame.height
      },
      output: {
        relativePath: aebRetainedBakeSvgaFragmentFileName(chainReceipt.chainHash),
        encodedBytes: output.encodedBytes,
        contentHash: candidate.contentHash,
        identityDigest: output.identityDigest,
        atomicAbsentDestination: true,
        noOverwrite: true
      },
      cleanup: {
        temporaryPathRemoved: true,
        rollbackOnFailure: true,
        partialOutputPresent: false
      },
      validation: {
        movieEntityVerified: true,
        inflated: true,
        decoded: true,
        reopenInspected: true,
        exactFrameBytesBound: true,
        standardsValidSvgaEncoded: true,
        nativeMergeRequired: true,
        fullCompositionEncoded: false,
        finalCompositionEncoderRequired: true,
        runtimeValidatorRequired: true,
        runtimeProved: false,
        realPreviewValidated: false,
        saveAsBytesAuthorized: false,
        installedQaAccepted: false,
        productOwnerAccepted: false
      }
    };
    return { ...unsigned, receiptHash: hashCanonicalLocal(unsigned) };
  }
}

async function validateExactMovie(
  MovieEntity: protobuf.Type,
  FixedReviewedMovieEntity: protobuf.Type,
  bytes: Buffer,
  frame: { imageKey: string; contentHash: string; width: number; height: number },
  canvas: { width: number; height: number },
  fps: number,
  maxInflatedBytes: number
): Promise<void> {
  try {
    const inflated = inflateSync(bytes, { maxOutputLength: maxInflatedBytes });
    const decoded = MovieEntity.decode(inflated);
    const movie = MovieEntity.toObject(decoded, {
      bytes: Buffer,
      defaults: true,
      arrays: true,
      objects: true
    }) as DecodedMovie;
    const sprite = movie.sprites?.[0];
    const decodedFrame = sprite?.frames?.[0];
    const embedded = movie.images?.[frame.imageKey];
    if (movie.params?.viewBoxWidth !== canvas.width
      || movie.params.viewBoxHeight !== canvas.height
      || movie.params.fps !== fps
      || movie.params.frames !== 1
      || Object.keys(movie.images ?? {}).length !== 1
      || !embedded
      || sha256Bytes(embedded) !== frame.contentHash
      || movie.sprites?.length !== 1
      || sprite?.imageKey !== frame.imageKey
      || sprite.frames?.length !== 1
      || decodedFrame?.alpha !== 1
      || decodedFrame.layout?.x !== 0
      || decodedFrame.layout.y !== 0
      || decodedFrame.layout.width !== frame.width
      || decodedFrame.layout.height !== frame.height
      || decodedFrame.transform?.a !== 1
      || decodedFrame.transform.b !== 0
      || decodedFrame.transform.c !== 0
      || decodedFrame.transform.d !== 1
      || decodedFrame.transform.tx !== 0
      || decodedFrame.transform.ty !== 0
      || decodedFrame.clipPath !== ""
      || decodedFrame.shapes?.length !== 0
      || movie.audios?.length !== 0) {
      fail("AE_RETAINED_SVGA_SEMANTIC_VALIDATION_FAILED", "Retained Bake SVGA bytes do not exactly represent the approved frame contract.");
    }
    await validateFixedReviewedReopen(FixedReviewedMovieEntity, inflated, frame, canvas, fps);
  } catch (error) {
    if (error instanceof AebBakePipelineError) throw error;
    fail("AE_RETAINED_SVGA_DECODE_FAILED", "Retained Bake SVGA bytes failed bounded inflate or protobuf decode.");
  }
}

async function validateFixedReviewedReopen(
  MovieEntity: protobuf.Type,
  inflated: Buffer,
  frame: { imageKey: string; contentHash: string; width: number; height: number },
  canvas: { width: number; height: number },
  fps: number
): Promise<void> {
  const reopened = MovieEntity.toObject(MovieEntity.decode(inflated), {
    bytes: Buffer,
    defaults: true,
    arrays: true,
    objects: true
  }) as DecodedMovie;
  const sprite = reopened.sprites?.[0];
  const reopenedFrame = sprite?.frames?.[0];
  const embedded = reopened.images?.[frame.imageKey];
  if (reopened.version !== "2.0"
    || reopened.params?.viewBoxWidth !== canvas.width
    || reopened.params.viewBoxHeight !== canvas.height
    || reopened.params.fps !== fps
    || reopened.params.frames !== 1
    || Object.keys(reopened.images ?? {}).length !== 1
    || !embedded
    || sha256Bytes(embedded) !== frame.contentHash
    || reopened.sprites?.length !== 1
    || sprite?.imageKey !== frame.imageKey
    || sprite.frames?.length !== 1
    || reopenedFrame?.alpha !== 1
    || reopenedFrame.layout?.x !== 0
    || reopenedFrame.layout.y !== 0
    || reopenedFrame.layout?.width !== frame.width
    || reopenedFrame.layout.height !== frame.height
    || reopenedFrame.transform?.a !== 1
    || reopenedFrame.transform.b !== 0
    || reopenedFrame.transform.c !== 0
    || reopenedFrame.transform.d !== 1
    || reopenedFrame.transform.tx !== 0
    || reopenedFrame.transform.ty !== 0
    || reopenedFrame.clipPath !== ""
    || reopened.audios?.length !== 0) {
    fail("AE_RETAINED_SVGA_REOPEN_VALIDATION_FAILED", "Retained Bake SVGA bytes failed fixed reviewed-schema reopen inspection.");
  }
}

function mintPrivateRetainedBakeSvgaCapability(
  input: PublishAebRetainedBakeSvgaFragmentInput
): object {
  const { chainReceipt, chainInput } = input;
  if (!chainInput
    || !consumeAebRetainedBakePublicationCapability(
      chainInput.published,
      chainInput.publicationAuthority,
      chainInput.executionAuthority,
      {
        chainHash: chainReceipt.chainHash,
        planHash: chainReceipt.planHash,
        executionReceiptHash: chainReceipt.executionReceiptHash,
        producerReceiptHash: chainReceipt.producerReceiptHash,
        publicationReceiptHash: chainReceipt.publicationReceiptHash,
        packageBundleId: chainReceipt.packageBundleId,
        taskId: chainReceipt.taskId,
        executionId: chainReceipt.executionId,
        jobId: chainReceipt.jobId,
        packageId: chainReceipt.packageId,
        protoFileSha256: AEB_REVIEWED_SVGA_PROTO_FILE_SHA256,
        descriptorSha256: AEB_REVIEWED_SVGA_DESCRIPTOR_SHA256
      }
    )) {
    fail(
      "AE_RETAINED_SVGA_PRIVATE_CAPABILITY_REQUIRED",
      "Retained Bake SVGA publication requires the private single-use executor and physical-publication capability."
    );
  }
  const capability = Object.freeze({});
  retainedBakeSvgaCapabilities.set(capability, {
    chainHash: chainReceipt.chainHash,
    protoFileSha256: AEB_REVIEWED_SVGA_PROTO_FILE_SHA256,
    descriptorSha256: AEB_REVIEWED_SVGA_DESCRIPTOR_SHA256,
    consumed: false
  });
  return capability;
}

function consumePrivateRetainedBakeSvgaCapability(
  capability: object,
  input: PublishAebRetainedBakeSvgaFragmentInput,
  schema: AebReviewedSvgaSchemaAuthority
): void {
  const privateState = retainedBakeSvgaCapabilities.get(capability);
  if (!privateState
    || privateState.consumed
    || privateState.chainHash !== input.chainReceipt.chainHash
    || privateState.protoFileSha256 !== schema.protoFileSha256
    || privateState.descriptorSha256 !== schema.descriptorSha256) {
    fail("AE_RETAINED_SVGA_PRIVATE_CAPABILITY_INVALID", "Retained Bake SVGA capability is stale, cloned, replayed, or schema-mismatched.");
  }
  privateState.consumed = true;
}

interface FileIdentity { dev: number; ino: number }

async function fileIdentity(filePath: string): Promise<FileIdentity> {
  const metadata = await lstat(filePath);
  if (!metadata.isFile() || metadata.isSymbolicLink() || metadata.nlink < 1) {
    fail("AE_RETAINED_SVGA_OUTPUT_IDENTITY_INVALID", "Retained Bake SVGA publication path is not a regular file.");
  }
  return { dev: metadata.dev, ino: metadata.ino };
}

function assertIdentity(actual: FileIdentity, expected: FileIdentity | undefined): void {
  if (!expected || actual.dev !== expected.dev || actual.ino !== expected.ino) {
    fail("AE_RETAINED_SVGA_OUTPUT_PATH_SWAP", "Retained Bake SVGA publication path identity changed.");
  }
}

function fileIdentityString(identity: FileIdentity): string {
  return `${identity.dev}:${identity.ino}`;
}

async function unlinkIfSame(filePath: string, expected: FileIdentity | undefined): Promise<void> {
  assertIdentity(await fileIdentity(filePath), expected);
  await unlink(filePath);
}

async function pathExists(filePath: string): Promise<boolean> {
  try {
    await lstat(filePath);
    return true;
  } catch {
    return false;
  }
}

function sameBoundFile(left: AebBoundedTaskFile, right: AebBoundedTaskFile): boolean {
  return left.identityDigest === right.identityDigest
    && left.fileIdentity === right.fileIdentity
    && left.encodedBytes === right.encodedBytes
    && left.bytes.equals(right.bytes);
}

function isSha256(value: unknown): value is string {
  return typeof value === "string" && /^[a-f0-9]{64}$/.test(value);
}

function isErrno(error: unknown, code: string): boolean {
  return Boolean(error && typeof error === "object" && "code" in error && (error as { code?: unknown }).code === code);
}

function sameJson(left: unknown, right: unknown): boolean {
  return JSON.stringify(sortValue(left)) === JSON.stringify(sortValue(right));
}

function hashCanonicalLocal(value: unknown): string {
  return sha256Bytes(new TextEncoder().encode(JSON.stringify(sortValue(value))));
}

function sha256Bytes(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

function sortValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortValue);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left < right ? -1 : left > right ? 1 : 0)
      .map(([key, child]) => [key, sortValue(child)]));
  }
  return value;
}

function fail(code: string, message: string): never {
  throw new AebBakePipelineError(code, message);
}
