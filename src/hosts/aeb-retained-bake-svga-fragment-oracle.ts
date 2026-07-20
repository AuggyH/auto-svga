import { inflateSync } from "node:zlib";
import type protobuf from "protobufjs";
import type {
  AebPhysicalSuccessorPackage
} from "../workbench/aeb-bake-contracts.js";
import {
  AEB_PHYSICAL_SUCCESSOR_SCHEMA_VERSION
} from "../workbench/aeb-bake-contracts.js";
import { AebBakePipelineError } from "../workbench/aeb-bake-pipeline.js";
import { hashCanonical } from "../workbench/aeb-ae-bake-execution.js";
import type { CreateAebRetainedBakeAuthorityChainInput, AebRetainedBakeAuthorityChainReceipt } from "../workbench/aeb-retained-bake-authority-chain.js";
import { verifyAebRetainedBakeAuthorityChainReceipt } from "../workbench/aeb-retained-bake-authority-chain.js";
import { NodeAebBakeResourceReader, NodeAebTaskRootAuthority, type AebBoundedTaskFile } from "./aeb-node-bake-resource-reader.js";
import {
  AEB_REVIEWED_SVGA_DESCRIPTOR_SHA256,
  AEB_REVIEWED_SVGA_PROTO_FILE_SHA256,
  loadAebReviewedSvgaSchemaAuthority
} from "./aeb-reviewed-svga-schema.js";
import {
  aebRetainedBakeSvgaFragmentSourceProbeFileName,
  type AebRetainedBakeSvgaFragmentSourceProbe,
  type PublishAebRetainedBakeSvgaFragmentInput
} from "./aeb-node-retained-bake-svga-fragment-publisher.js";

export const AEB_RETAINED_BAKE_SVGA_FRAGMENT_ORACLE_SCHEMA_VERSION = "aeb-retained-bake-svga-fragment-oracle-v1" as const;

export interface AebRetainedBakeSvgaFragmentOracleReport {
  schemaVersion: typeof AEB_RETAINED_BAKE_SVGA_FRAGMENT_ORACLE_SCHEMA_VERSION;
  authorityState: "source_validated_fragment_oracle";
  artifactRole: "baked_sequence_fragment";
  taskId: string;
  executionId: string;
  jobId: string;
  packageId: string;
  sourceFingerprint: string;
  chainHash: string;
  sourceProbeHash: string;
  manifestId: string;
  packageBundleId: string;
  packagePublicationReceiptHash: string;
  svgaAdapterDigest: string;
  frameInventoryDigest: string;
  schema: {
    protoFileSha256: typeof AEB_REVIEWED_SVGA_PROTO_FILE_SHA256;
    descriptorSha256: typeof AEB_REVIEWED_SVGA_DESCRIPTOR_SHA256;
    independentlyReopened: true;
  };
  sourcePackage: {
    relativePath: string;
    contentHash: string;
    identityDigest: string;
    physicalTreeBytesMatched: true;
    unchanged: true;
  };
  successorPackage: {
    relativePath: string;
    contentHash: string;
    identityDigest: string;
    physicalTreeReopened: true;
    publicationReceiptHash: string;
  };
  fragment: {
    relativePath: string;
    encodedBytes: number;
    contentHash: string;
    identityDigest: string;
    movieEntityVerified: true;
    inflated: true;
    decoded: true;
    fixedDescriptorReopened: true;
    exactFrameBytesBound: true;
  };
  compatibility: {
    controlledRetainedFixtureOnly: true;
    standardsValidSvgaFragment: true;
    nativeMergeRequired: true;
    fullCompositionEncoded: false;
    finalCompositionEncoderRequired: true;
    runtimeValidatorRequired: true;
    runtimeProved: false;
    realPreviewValidated: false;
    saveAsBytesAuthorized: false;
    installedQaAccepted: false;
    productOwnerAccepted: false;
    actualBakeAuthorityMinted: false;
  };
  reportHash: string;
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

export async function createAebRetainedBakeSvgaFragmentOracleReport(
  authority: NodeAebTaskRootAuthority,
  input: PublishAebRetainedBakeSvgaFragmentInput,
  sourceProbe: AebRetainedBakeSvgaFragmentSourceProbe
): Promise<AebRetainedBakeSvgaFragmentOracleReport> {
  await validateSourceProbeShape(input.chainReceipt, input.chainInput, sourceProbe);
  if (!await verifyAebRetainedBakeAuthorityChainReceipt(input.chainReceipt, input.chainInput)) {
    fail("AE_RETAINED_SVGA_ORACLE_CHAIN_INVALID", "SVGA fragment oracle requires the current retained Bake authority chain.");
  }

  const output = await authority.readBoundedTaskFile(
    sourceProbe.output.relativePath,
    input.chainInput.plan.job.budgets.maxPackageBytes,
    "AE_RETAINED_SVGA_ORACLE_OUTPUT"
  );
  const outputHash = requireSha256(await input.chainInput.hasher.hash(output.bytes));
  if (sourceProbe.output.relativePath !== aebRetainedBakeSvgaFragmentSourceProbeFileName(input.chainReceipt.chainHash)
    || sourceProbe.output.encodedBytes !== output.encodedBytes
    || sourceProbe.output.contentHash !== outputHash
    || sourceProbe.output.identityDigest !== output.identityDigest) {
    fail("AE_RETAINED_SVGA_ORACLE_OUTPUT_MISMATCH", "SVGA fragment oracle output binding is stale or substituted.");
  }

  const sourcePackage = await authority.readBoundedTaskFile(
    input.chainInput.plan.sourceFiles.packageRelativePath,
    input.chainInput.plan.sourceFiles.packageMaxBytes,
    "SOURCE_PACKAGE"
  );
  const sourceHash = requireSha256(await input.chainInput.hasher.hash(sourcePackage.bytes));
  if (sourceHash !== input.chainInput.plan.sourceFiles.packageContentHash) {
    fail("AE_RETAINED_SVGA_ORACLE_SOURCE_PACKAGE_MISMATCH", "Source package bytes no longer match the retained Bake plan.");
  }

  const successorPackage = await authority.readBoundedTaskFile(
    input.chainInput.published.publicationReceipt.successorPackage.relativePath,
    input.chainInput.published.publicationReceipt.successorPackage.encodedBytes,
    "SUCCESSOR_PACKAGE"
  );
  const successorHash = requireSha256(await input.chainInput.hasher.hash(successorPackage.bytes));
  if (successorHash !== input.chainInput.published.publicationReceipt.successorPackage.contentHash.value) {
    fail("AE_RETAINED_SVGA_ORACLE_SUCCESSOR_PACKAGE_MISMATCH", "Successor package bytes no longer match publication authority.");
  }

  validatePhysicalPackageTree(input.chainInput, sourcePackage, successorPackage);
  await validateFragmentBytes(authority, input.chainInput, output);

  const unsigned: Omit<AebRetainedBakeSvgaFragmentOracleReport, "reportHash"> = {
    schemaVersion: AEB_RETAINED_BAKE_SVGA_FRAGMENT_ORACLE_SCHEMA_VERSION,
    authorityState: "source_validated_fragment_oracle",
    artifactRole: "baked_sequence_fragment",
    taskId: input.chainReceipt.taskId,
    executionId: input.chainReceipt.executionId,
    jobId: input.chainReceipt.jobId,
    packageId: input.chainReceipt.packageId,
    sourceFingerprint: input.chainReceipt.sourceFingerprint,
    chainHash: input.chainReceipt.chainHash,
    sourceProbeHash: sourceProbe.probeHash,
    manifestId: input.chainReceipt.manifestId,
    packageBundleId: input.chainReceipt.packageBundleId,
    packagePublicationReceiptHash: input.chainReceipt.publicationReceiptHash,
    svgaAdapterDigest: input.chainReceipt.svgaAdapterDigest,
    frameInventoryDigest: input.chainReceipt.frameInventoryDigest,
    schema: {
      protoFileSha256: AEB_REVIEWED_SVGA_PROTO_FILE_SHA256,
      descriptorSha256: AEB_REVIEWED_SVGA_DESCRIPTOR_SHA256,
      independentlyReopened: true
    },
    sourcePackage: {
      relativePath: input.chainInput.plan.sourceFiles.packageRelativePath,
      contentHash: sourceHash,
      identityDigest: sourcePackage.identityDigest,
      physicalTreeBytesMatched: true,
      unchanged: true
    },
    successorPackage: {
      relativePath: input.chainInput.published.publicationReceipt.successorPackage.relativePath,
      contentHash: successorHash,
      identityDigest: successorPackage.identityDigest,
      physicalTreeReopened: true,
      publicationReceiptHash: input.chainInput.published.publicationReceipt.receiptHash
    },
    fragment: {
      relativePath: sourceProbe.output.relativePath,
      encodedBytes: output.encodedBytes,
      contentHash: outputHash,
      identityDigest: output.identityDigest,
      movieEntityVerified: true,
      inflated: true,
      decoded: true,
      fixedDescriptorReopened: true,
      exactFrameBytesBound: true
    },
    compatibility: {
      controlledRetainedFixtureOnly: true,
      standardsValidSvgaFragment: true,
      nativeMergeRequired: true,
      fullCompositionEncoded: false,
      finalCompositionEncoderRequired: true,
      runtimeValidatorRequired: true,
      runtimeProved: false,
      realPreviewValidated: false,
      saveAsBytesAuthorized: false,
      installedQaAccepted: false,
      productOwnerAccepted: false,
      actualBakeAuthorityMinted: false
    }
  };
  return { ...unsigned, reportHash: await hashCanonical(input.chainInput.hasher, unsigned) };
}

async function validateSourceProbeShape(
  chainReceipt: AebRetainedBakeAuthorityChainReceipt,
  chainInput: CreateAebRetainedBakeAuthorityChainInput,
  sourceProbe: AebRetainedBakeSvgaFragmentSourceProbe
): Promise<void> {
  const { probeHash, ...probeWithoutHash } = sourceProbe;
  const expectedProbeHash = await hashCanonical(chainInput.hasher, probeWithoutHash);
  if (sourceProbe.schemaVersion !== "aeb-retained-bake-svga-fragment-source-probe-v1"
    || sourceProbe.authorityState !== "source_validated_non_authoritative"
    || sourceProbe.actualAeRenderExecuted !== false
    || sourceProbe.schema.protoFileSha256 !== AEB_REVIEWED_SVGA_PROTO_FILE_SHA256
    || sourceProbe.schema.descriptorSha256 !== AEB_REVIEWED_SVGA_DESCRIPTOR_SHA256
    || sourceProbe.schema.independentlyReopened !== true
    || sourceProbe.output.relativePath !== aebRetainedBakeSvgaFragmentSourceProbeFileName(chainReceipt.chainHash)
    || sourceProbe.output.atomicAbsentDestination !== true
    || sourceProbe.output.noOverwrite !== true
    || sourceProbe.validation.standardsValidSvgaEncoded !== true
    || sourceProbe.validation.nativeMergeRequired !== true
    || sourceProbe.validation.runtimeProved !== false
    || sourceProbe.validation.realPreviewValidated !== false
    || sourceProbe.validation.saveAsBytesAuthorized !== false
    || probeHash !== expectedProbeHash) {
    fail("AE_RETAINED_SVGA_ORACLE_PROBE_INVALID", "SVGA fragment oracle requires the exact non-authoritative source probe.");
  }
}

function validatePhysicalPackageTree(
  input: CreateAebRetainedBakeAuthorityChainInput,
  sourcePackage: AebBoundedTaskFile,
  successorPackage: AebBoundedTaskFile
): void {
  const physical = parsePhysicalPackage(successorPackage.bytes);
  if (physical.schemaVersion !== AEB_PHYSICAL_SUCCESSOR_SCHEMA_VERSION
    || physical.sourcePackage.relativePath !== input.plan.sourceFiles.packageRelativePath
    || physical.sourcePackage.encodedBytes !== sourcePackage.encodedBytes
    || !sameEncodedHash(physical.sourcePackage.contentHash, input.plan.sourceFiles.packageContentHash)
    || Buffer.from(physical.sourcePackage.bytesBase64, "base64").compare(sourcePackage.bytes) !== 0
    || !sameJson(physical.reinsertedPackage, input.published.bundle)
    || physical.publicationReceipt.taskId !== input.plan.job.task.taskId
    || physical.publicationReceipt.receiptId !== input.plan.job.task.receiptId
    || physical.publicationReceipt.executionReceiptHash !== input.executionReceipt.receiptHash
    || physical.publicationReceipt.manifestId !== input.manifest.manifestId
    || physical.publicationReceipt.packageBundleId !== input.published.bundle.packageBundleId
    || physical.publicationReceipt.atomicAbsentDestination !== true
    || physical.publicationReceipt.noOverwrite !== true
    || physical.publicationReceipt.rollbackOnFailure !== true
    || physical.publicationReceipt.temporaryPathCleanupRequired !== true
    || physical.publicationReceipt.sourceMutationAllowed !== false) {
    fail("AE_RETAINED_SVGA_ORACLE_PACKAGE_TREE_INVALID", "SVGA fragment oracle could not reopen the physical successor package tree.");
  }
}

async function validateFragmentBytes(
  authority: NodeAebTaskRootAuthority,
  input: CreateAebRetainedBakeAuthorityChainInput,
  output: AebBoundedTaskFile
): Promise<void> {
  try {
    const schema = await loadAebReviewedSvgaSchemaAuthority();
    const inflated = Buffer.from(inflateSync(output.bytes, { maxOutputLength: input.plan.job.budgets.maxPackageBytes }));
    const adapterFrame = input.adapterInput.frames[0];
    if (!adapterFrame) {
      fail("AE_RETAINED_SVGA_ORACLE_FRAME_MISSING", "SVGA fragment oracle requires one adapter frame.");
    }
    const frame = await new NodeAebBakeResourceReader(authority).readFrame(
      { frameIndex: adapterFrame.frameIndex, relativePath: adapterFrame.relativePath },
      {
        width: adapterFrame.width,
        height: adapterFrame.height,
        maxEncodedBytes: input.plan.job.budgets.maxEncodedBytes,
        maxDecodedRgbaBytes: input.plan.job.budgets.maxDecodedRgbaBytes
      }
    );
    const frameHash = requireSha256(await input.hasher.hash(frame.bytes));
    if (frameHash !== adapterFrame.contentHash
      || frameHash !== input.producerReceipt.output.frames[0]?.contentHash) {
      fail("AE_RETAINED_SVGA_ORACLE_FRAME_MISMATCH", "SVGA fragment oracle frame resource is stale or substituted.");
    }
    const frameBytes = Buffer.from(frame.bytes);
    inspectMovie(schema.encoderMovieEntity, inflated, input, frameBytes, { requireVersion: false, requireShapes: true });
    inspectMovie(schema.reopenMovieEntity, inflated, input, frameBytes, { requireVersion: true, requireShapes: false });
  } catch (error) {
    if (error instanceof AebBakePipelineError) throw error;
    fail("AE_RETAINED_SVGA_ORACLE_FRAGMENT_INVALID", "SVGA fragment oracle rejected the canonical MovieEntity semantics.");
  }
}

function inspectMovie(
  MovieEntity: protobuf.Type,
  inflated: Buffer,
  input: CreateAebRetainedBakeAuthorityChainInput,
  frameBytes: Buffer,
  options: { requireVersion: boolean; requireShapes: boolean }
): void {
  const adapterFrame = input.adapterInput.frames[0];
  if (!adapterFrame) {
    fail("AE_RETAINED_SVGA_ORACLE_FRAME_MISSING", "SVGA fragment oracle requires one adapter frame.");
  }
  const movie = MovieEntity.toObject(MovieEntity.decode(inflated), {
    bytes: Buffer,
    defaults: true,
    arrays: true,
    objects: true
  }) as DecodedMovie;
  const embedded = movie.images?.[adapterFrame.imageKey];
  const sprite = movie.sprites?.[0];
  const frame = sprite?.frames?.[0];
  if ((options.requireVersion && movie.version !== "2.0")
    || movie.params?.viewBoxWidth !== input.adapterInput.canvas.width
    || movie.params.viewBoxHeight !== input.adapterInput.canvas.height
    || movie.params.fps !== input.adapterInput.fps
    || movie.params.frames !== 1
    || Object.keys(movie.images ?? {}).length !== 1
    || !embedded
    || Buffer.compare(embedded, frameBytes) !== 0
    || movie.sprites?.length !== 1
    || sprite?.imageKey !== adapterFrame.imageKey
    || sprite.frames?.length !== 1
    || frame?.alpha !== 1
    || frame.layout?.x !== 0
    || frame.layout.y !== 0
    || frame.layout.width !== adapterFrame.width
    || frame.layout.height !== adapterFrame.height
    || frame.transform?.a !== 1
    || frame.transform.b !== 0
    || frame.transform.c !== 0
    || frame.transform.d !== 1
    || frame.transform.tx !== 0
    || frame.transform.ty !== 0
    || frame.clipPath !== ""
    || (options.requireShapes && frame.shapes?.length !== 0)
    || movie.audios?.length !== 0) {
    fail("AE_RETAINED_SVGA_ORACLE_FRAGMENT_INVALID", "SVGA fragment oracle rejected the canonical MovieEntity semantics.");
  }
}

function parsePhysicalPackage(bytes: Buffer): AebPhysicalSuccessorPackage {
  try {
    const parsed = JSON.parse(bytes.toString("utf8")) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      fail("AE_RETAINED_SVGA_ORACLE_PACKAGE_TREE_INVALID", "Physical successor package is not an object.");
    }
    return parsed as AebPhysicalSuccessorPackage;
  } catch (error) {
    if (error instanceof AebBakePipelineError) throw error;
    fail("AE_RETAINED_SVGA_ORACLE_PACKAGE_TREE_INVALID", "Physical successor package is not valid JSON.");
  }
}

function sameEncodedHash(
  actual: { algorithm: string; value: string; scope: string },
  expectedValue: string
): boolean {
  return actual.algorithm === "sha256"
    && actual.scope === "encoded_bytes"
    && actual.value === expectedValue
    && isSha256(expectedValue);
}

function requireSha256(value: { algorithm: string; value: string; scope: string }): string {
  if (value.algorithm !== "sha256" || value.scope !== "encoded_bytes" || !isSha256(value.value)) {
    fail("HASHER_CONTRACT_INVALID", "SVGA fragment oracle requires encoded-byte SHA-256 hashes.");
  }
  return value.value;
}

function isSha256(value: unknown): value is string {
  return typeof value === "string" && /^[a-f0-9]{64}$/.test(value);
}

function sameJson(left: unknown, right: unknown): boolean {
  return JSON.stringify(sortValue(left)) === JSON.stringify(sortValue(right));
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
