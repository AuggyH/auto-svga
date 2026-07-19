import { constants } from "node:fs";
import { link, lstat, open, unlink } from "node:fs/promises";
import type {
  AebPackagePublicationAuthorityVerifier,
  AebBakeExecutionAuthority,
  AebPackagePublicationReceipt,
  AebPackagePublicationRollbackReceipt,
  AebPhysicalSuccessorPackage,
  AebPublishedSuccessorPackage,
  AebReinsertedPackage
} from "../workbench/aeb-bake-contracts.js";
import { AebBakePipelineError } from "../workbench/aeb-bake-pipeline.js";
import {
  verifyAebPublishedSuccessorPackageIntegrity,
  verifyAebReinsertedPackageIntegrity
} from "../workbench/aeb-package-reinsertion.js";
import type { EmbeddedResourceHasher } from "../workbench/resource-hasher.js";
import { NodeAebTaskRootAuthority, type AebBoundedTaskFile } from "./aeb-node-bake-resource-reader.js";
import {
  verifyAebRetainedBakeExecutionAuthorityForPublication,
  verifyAebRetainedBakeExecutionAuthorityProvenance
} from "./aeb-node-bounded-ae-bake-executor.js";

export type AebPublicationFailurePhase = "write" | "finalize" | "cleanup";

export interface AebPackagePublicationHooks {
  beforePhase?(phase: AebPublicationFailurePhase): Promise<void> | void;
}

export interface PublishAebBakeSuccessorInput {
  bundle: AebReinsertedPackage;
  sourcePackageRelativePath: string;
  expectedSourcePackageHash: string;
  successorFileName: string;
  maxSourcePackageBytes: number;
  maxSuccessorPackageBytes: number;
  hasher: EmbeddedResourceHasher;
}

export interface AebRetainedBakePublicationCapabilityBinding {
  chainHash: string;
  planHash: string;
  executionReceiptHash: string;
  producerReceiptHash: string;
  publicationReceiptHash: string;
  packageBundleId: string;
  taskId: string;
  executionId: string;
  jobId: string;
  packageId: string;
  protoFileSha256: string;
  descriptorSha256: string;
}

interface PrivateRetainedBakePublicationState {
  publisher: NodeAebBakePackagePublisher;
  executionAuthority: AebBakeExecutionAuthority;
  publicationReceiptHash: string;
  packageBundleId: string;
  taskId: string;
  jobId: string;
  packageId: string;
  executionReceiptHash: string;
  consumed: boolean;
  schemaBinding?: {
    protoFileSha256: string;
    descriptorSha256: string;
  };
}

const retainedBakePublicationCapabilities = new WeakMap<object, PrivateRetainedBakePublicationState>();
const publishedSuccessorFiles = new WeakMap<object, {
  publisher: NodeAebBakePackagePublisher;
  outputName: string;
  output: AebBoundedTaskFile;
  revoked: boolean;
}>();

export function consumeAebRetainedBakePublicationCapability(
  published: AebPublishedSuccessorPackage,
  publicationAuthority: AebPackagePublicationAuthorityVerifier | undefined,
  executionAuthority: AebBakeExecutionAuthority | undefined,
  expected: AebRetainedBakePublicationCapabilityBinding
): boolean {
  const privateState = retainedBakePublicationCapabilities.get(published);
  if (!privateState
    || privateState.consumed
    || privateState.publisher !== publicationAuthority
    || privateState.executionAuthority !== executionAuthority
    || privateState.publicationReceiptHash !== expected.publicationReceiptHash
    || privateState.packageBundleId !== expected.packageBundleId
    || privateState.taskId !== expected.taskId
    || privateState.jobId !== expected.jobId
    || privateState.packageId !== expected.packageId
    || privateState.executionReceiptHash !== expected.executionReceiptHash
    || !/^[a-f0-9]{64}$/.test(expected.chainHash)
    || !/^[a-f0-9]{64}$/.test(expected.protoFileSha256)
    || !/^[a-f0-9]{64}$/.test(expected.descriptorSha256)
    || !verifyAebRetainedBakeExecutionAuthorityProvenance(executionAuthority, {
      planHash: expected.planHash,
      executionReceiptHash: expected.executionReceiptHash,
      producerReceiptHash: expected.producerReceiptHash,
      taskId: expected.taskId,
      executionId: expected.executionId,
      jobId: expected.jobId,
      packageId: expected.packageId
    })) {
    return false;
  }
  privateState.schemaBinding = {
    protoFileSha256: expected.protoFileSha256,
    descriptorSha256: expected.descriptorSha256
  };
  privateState.consumed = true;
  return true;
}

export class AebPackagePublicationError extends AebBakePipelineError {
  constructor(
    code: string,
    message: string,
    readonly rollbackReceipt: AebPackagePublicationRollbackReceipt
  ) {
    super(code, message);
    this.name = "AebPackagePublicationError";
  }
}

export class NodeAebBakePackagePublisher implements AebPackagePublicationAuthorityVerifier {
  constructor(
    private readonly authority: NodeAebTaskRootAuthority,
    private readonly hooks: AebPackagePublicationHooks = {},
    private readonly executionAuthority?: AebBakeExecutionAuthority
  ) {}

  async publish(input: PublishAebBakeSuccessorInput): Promise<AebPublishedSuccessorPackage> {
    if (!await verifyAebReinsertedPackageIntegrity(input.bundle, input.hasher, this.executionAuthority)) {
      fail("PACKAGE_INTEGRITY_INVALID", "AEB Package reinsertion bundle is invalid before physical publication.");
    }
    if (!isSha256(input.expectedSourcePackageHash)) {
      fail("SOURCE_PACKAGE_HASH_INVALID", "Expected source package hash must be SHA-256.");
    }
    const sourceBefore = await this.authority.readBoundedTaskFile(
      input.sourcePackageRelativePath,
      input.maxSourcePackageBytes,
      "SOURCE_PACKAGE"
    );
    const sourceHash = requireSha256(await input.hasher.hash(sourceBefore.bytes));
    if (sourceHash.value !== input.expectedSourcePackageHash) {
      fail("SOURCE_PACKAGE_BINDING_MISMATCH", "Task-owned source package bytes do not match the approved source hash.");
    }

    const manifest = input.bundle.bakeManifest;
    const physical: AebPhysicalSuccessorPackage = {
      schemaVersion: "aeb-physical-successor-package-v1",
      sourcePackage: {
        relativePath: input.sourcePackageRelativePath,
        encodedBytes: sourceBefore.encodedBytes,
        contentHash: sourceHash,
        bytesBase64: sourceBefore.bytes.toString("base64")
      },
      reinsertedPackage: input.bundle,
      publicationReceipt: {
        taskId: manifest.safety.taskId,
        receiptId: manifest.safety.receiptId,
        executionReceiptHash: manifest.execution.receiptHash,
        manifestId: manifest.manifestId,
        packageBundleId: input.bundle.packageBundleId,
        atomicAbsentDestination: true,
        noOverwrite: true,
        rollbackOnFailure: true,
        temporaryPathCleanupRequired: true,
        sourceMutationAllowed: false
      }
    };
    const successorBytes = new TextEncoder().encode(canonicalJson(physical));
    if (successorBytes.byteLength > input.maxSuccessorPackageBytes
      || successorBytes.byteLength > manifest.job.budgets.maxPackageBytes) {
      fail("PHYSICAL_PACKAGE_BUDGET_EXCEEDED", "Physical successor AEB Package exceeds its package budget.");
    }

    const destinationPath = await this.authority.directChildPath(input.successorFileName);
    const temporaryIdentity = await hashCanonical(input.hasher, {
      receiptId: manifest.safety.receiptId,
      packageBundleId: input.bundle.packageBundleId
    });
    const temporaryName = `aeb-publish-temp-${temporaryIdentity.slice(0, 24)}.json`;
    const temporaryPath = await this.authority.directChildPath(temporaryName);
    let temporaryCreated = false;
    let temporaryEverCreated = false;
    let destinationCreated = false;
    let publicationIdentity: { dev: number; ino: number } | undefined;
    let phase: AebPackagePublicationRollbackReceipt["phase"] = "write";

    try {
      await this.authority.verifyPinned();
      await this.hooks.beforePhase?.("write");
      await this.authority.verifyPinned();
      const handle = await open(temporaryPath, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW, 0o600);
      temporaryCreated = true;
      temporaryEverCreated = true;
      try {
        await handle.writeFile(successorBytes);
        await handle.sync();
      } finally {
        await handle.close();
      }
      publicationIdentity = await fileIdentity(temporaryPath);
      await this.authority.syncTaskRoot();
      phase = "finalize";
      await this.hooks.beforePhase?.("finalize");
      await this.authority.verifyPinned();
      await link(temporaryPath, destinationPath);
      destinationCreated = true;
      assertIdentity(await fileIdentity(destinationPath), publicationIdentity);
      await this.authority.syncTaskRoot();
      phase = "cleanup";
      await this.hooks.beforePhase?.("cleanup");
      await this.authority.verifyPinned();
      await unlinkIfSame(temporaryPath, publicationIdentity);
      temporaryCreated = false;
      await this.authority.syncTaskRoot();
      phase = "verification";

      const sourceAfter = await this.authority.readBoundedTaskFile(
        input.sourcePackageRelativePath,
        input.maxSourcePackageBytes,
        "SOURCE_PACKAGE"
      );
      const sourceAfterHash = requireSha256(await input.hasher.hash(sourceAfter.bytes));
      if (sourceAfter.identityDigest !== sourceBefore.identityDigest
        || sourceAfterHash.value !== sourceHash.value
        || !sourceAfter.bytes.equals(sourceBefore.bytes)) {
        fail("SOURCE_PACKAGE_MUTATED", "Source AEB Package changed during successor publication.");
      }

      const publishedFile = await this.authority.readBoundedTaskFile(
        input.successorFileName,
        input.maxSuccessorPackageBytes,
        "SUCCESSOR_PACKAGE"
      );
      const successorHash = requireSha256(await input.hasher.hash(publishedFile.bytes));
      if (!Buffer.from(successorBytes).equals(publishedFile.bytes)) {
        fail("SUCCESSOR_PACKAGE_READBACK_MISMATCH", "Published successor package bytes failed exact read-back.");
      }

      const receiptWithoutHash: Omit<AebPackagePublicationReceipt, "receiptHash"> = {
        schemaVersion: "aeb-package-publication-receipt-v1",
        receiptId: manifest.safety.receiptId,
        taskId: manifest.safety.taskId,
        jobId: manifest.job.jobId,
        packageId: manifest.job.packageId,
        sourceFingerprint: manifest.job.source.sourceFingerprint,
        sourcePackage: {
          relativePath: input.sourcePackageRelativePath,
          encodedBytes: sourceBefore.encodedBytes,
          contentHash: sourceHash,
          preIdentityDigest: sourceBefore.identityDigest,
          postIdentityDigest: sourceAfter.identityDigest,
          unchanged: true
        },
        successorPackage: {
          relativePath: input.successorFileName,
          encodedBytes: publishedFile.encodedBytes,
          contentHash: successorHash,
          atomicAbsentDestination: true,
          noOverwrite: true
        },
        joins: {
          executionReceiptHash: manifest.execution.receiptHash,
          manifestId: manifest.manifestId,
          packageBundleId: input.bundle.packageBundleId
        },
        cleanup: {
          temporaryPathRemoved: true,
          rollbackOnFailure: true,
          rollbackPerformed: false,
          partialSuccessorPresent: false
        }
      };
      const published: AebPublishedSuccessorPackage = {
        bundle: input.bundle,
        publicationReceipt: {
          ...receiptWithoutHash,
          receiptHash: await hashCanonical(input.hasher, receiptWithoutHash)
        }
      };
      if (this.executionAuthority && verifyAebRetainedBakeExecutionAuthorityForPublication(this.executionAuthority, {
        executionReceiptHash: manifest.execution.receiptHash,
        taskId: manifest.safety.taskId,
        jobId: manifest.job.jobId,
        packageId: manifest.job.packageId
      })) {
        retainedBakePublicationCapabilities.set(published, {
          publisher: this,
          executionAuthority: this.executionAuthority,
          publicationReceiptHash: published.publicationReceipt.receiptHash,
          packageBundleId: published.bundle.packageBundleId,
          taskId: published.publicationReceipt.taskId,
          jobId: published.publicationReceipt.jobId,
          packageId: published.publicationReceipt.packageId,
          executionReceiptHash: published.publicationReceipt.joins.executionReceiptHash,
          consumed: false
        });
      }
      publishedSuccessorFiles.set(published, {
        publisher: this,
        outputName: input.successorFileName,
        output: publishedFile,
        revoked: false
      });
      return published;
    } catch (error) {
      const rollbackErrors: unknown[] = [];
      if (destinationCreated) {
        try { await unlinkIfSame(destinationPath, publicationIdentity); } catch (rollbackError) { rollbackErrors.push(rollbackError); }
      }
      if (temporaryCreated) {
        try { await unlinkIfSame(temporaryPath, publicationIdentity); } catch (rollbackError) { rollbackErrors.push(rollbackError); }
      }
      const temporaryPathRemoved = !await pathExists(temporaryPath);
      const successorRemoved = !destinationCreated || !await pathExists(destinationPath);
      let sourceAfterRollback;
      try {
        sourceAfterRollback = await this.authority.readBoundedTaskFile(
          input.sourcePackageRelativePath,
          input.maxSourcePackageBytes,
          "SOURCE_PACKAGE"
        );
      } catch (rollbackError) {
        rollbackErrors.push(rollbackError);
      }
      const sourceAfterRollbackHash = sourceAfterRollback
        ? requireSha256(await input.hasher.hash(sourceAfterRollback.bytes))
        : undefined;
      const sourceUnchanged = Boolean(sourceAfterRollback
        && sourceAfterRollback.identityDigest === sourceBefore.identityDigest
        && sourceAfterRollbackHash?.value === sourceHash.value
        && sourceAfterRollback.bytes.equals(sourceBefore.bytes));
      if (rollbackErrors.length > 0 || !temporaryPathRemoved || !successorRemoved || !sourceUnchanged) {
        fail("PUBLICATION_ROLLBACK_FAILED", "AEB successor publication rollback could not remove partial task-owned output.");
      }
      const rollbackWithoutHash: Omit<AebPackagePublicationRollbackReceipt, "receiptHash"> = {
        schemaVersion: "aeb-package-publication-rollback-receipt-v1",
        taskId: manifest.safety.taskId,
        receiptId: manifest.safety.receiptId,
        jobId: manifest.job.jobId,
        packageId: manifest.job.packageId,
        phase,
        sourcePackage: {
          relativePath: input.sourcePackageRelativePath,
          contentHash: sourceHash,
          preIdentityDigest: sourceBefore.identityDigest,
          postIdentityDigest: sourceAfterRollback!.identityDigest,
          unchanged: true
        },
        successorPackage: {
          relativePath: input.successorFileName,
          ownedDestinationCreated: destinationCreated,
          ownedDestinationRemoved: destinationCreated,
          partialSuccessorPresent: false
        },
        cleanup: {
          temporaryPathCreated: temporaryEverCreated,
          temporaryPathRemoved: true,
          rollbackPerformed: temporaryEverCreated || destinationCreated
        }
      };
      const rollbackReceipt: AebPackagePublicationRollbackReceipt = {
        ...rollbackWithoutHash,
        receiptHash: await hashCanonical(input.hasher, rollbackWithoutHash)
      };
      const code = error instanceof AebBakePipelineError
        ? error.code
        : phase === "cleanup" ? "PUBLICATION_CLEANUP_FAILED" : "PUBLICATION_FAILED";
      throw new AebPackagePublicationError(
        code,
        "AEB successor publication failed and was rolled back without changing the source package.",
        rollbackReceipt
      );
    }
  }

  async verifyPublishedSuccessor(
    published: AebPublishedSuccessorPackage,
    hasher: EmbeddedResourceHasher
  ): Promise<boolean> {
    try {
      if (!await verifyAebPublishedSuccessorPackageIntegrity(published, hasher, this.executionAuthority)) return false;
      const receipt = published.publicationReceipt;
      const source = await this.authority.readBoundedTaskFile(
        receipt.sourcePackage.relativePath,
        receipt.sourcePackage.encodedBytes,
        "SOURCE_PACKAGE"
      );
      const successor = await this.authority.readBoundedTaskFile(
        receipt.successorPackage.relativePath,
        receipt.successorPackage.encodedBytes,
        "SUCCESSOR_PACKAGE"
      );
      if (source.encodedBytes !== receipt.sourcePackage.encodedBytes
        || source.identityDigest !== receipt.sourcePackage.preIdentityDigest
        || source.identityDigest !== receipt.sourcePackage.postIdentityDigest
        || requireSha256(await hasher.hash(source.bytes)).value !== receipt.sourcePackage.contentHash.value
        || successor.encodedBytes !== receipt.successorPackage.encodedBytes
        || requireSha256(await hasher.hash(successor.bytes)).value !== receipt.successorPackage.contentHash.value) {
        return false;
      }
      let physical: AebPhysicalSuccessorPackage;
      try {
        physical = JSON.parse(successor.bytes.toString("utf8")) as AebPhysicalSuccessorPackage;
      } catch {
        return false;
      }
      const manifest = published.bundle.bakeManifest;
      return physical.schemaVersion === "aeb-physical-successor-package-v1"
        && physical.sourcePackage.relativePath === receipt.sourcePackage.relativePath
        && physical.sourcePackage.encodedBytes === source.encodedBytes
        && sameJson(physical.sourcePackage.contentHash, receipt.sourcePackage.contentHash)
        && physical.sourcePackage.bytesBase64 === source.bytes.toString("base64")
        && sameJson(physical.reinsertedPackage, published.bundle)
        && sameJson(physical.publicationReceipt, {
          taskId: receipt.taskId,
          receiptId: receipt.receiptId,
          executionReceiptHash: receipt.joins.executionReceiptHash,
          manifestId: receipt.joins.manifestId,
          packageBundleId: receipt.joins.packageBundleId,
          atomicAbsentDestination: true,
          noOverwrite: true,
          rollbackOnFailure: true,
          temporaryPathCleanupRequired: true,
          sourceMutationAllowed: false
        })
        && manifest.safety.taskId === this.authority.taskId;
    } catch {
      return false;
    }
  }

  async revokePublishedSuccessor(published: AebPublishedSuccessorPackage): Promise<boolean> {
    const privateState = publishedSuccessorFiles.get(published);
    if (!privateState
      || privateState.publisher !== this
      || privateState.revoked
      || privateState.outputName !== published.publicationReceipt.successorPackage.relativePath
      || privateState.output.identityDigest === "") {
      return false;
    }
    privateState.revoked = true;
    const retainedState = retainedBakePublicationCapabilities.get(published);
    if (retainedState) retainedState.consumed = true;
    try {
      const outputPath = await this.authority.directChildPath(privateState.outputName);
      const current = await this.authority.readBoundedTaskFile(
        privateState.outputName,
        published.publicationReceipt.successorPackage.encodedBytes,
        "SUCCESSOR_PACKAGE"
      );
      if (current.fileIdentity !== privateState.output.fileIdentity) return false;
      await unlinkIfSame(outputPath, fileIdentityFromString(privateState.output.fileIdentity));
      await this.authority.syncTaskRoot();
      return !await pathExists(outputPath);
    } catch {
      return false;
    }
  }
}

async function pathExists(filePath: string): Promise<boolean> {
  try {
    await lstat(filePath);
    return true;
  } catch {
    return false;
  }
}

async function fileIdentity(filePath: string): Promise<{ dev: number; ino: number }> {
  const metadata = await lstat(filePath);
  if (!metadata.isFile() || metadata.isSymbolicLink()) {
    fail("PUBLICATION_IDENTITY_INVALID", "AEB successor publication path is not a regular file.");
  }
  return { dev: metadata.dev, ino: metadata.ino };
}

function assertIdentity(
  actual: { dev: number; ino: number },
  expected: { dev: number; ino: number } | undefined
): void {
  if (!expected || actual.dev !== expected.dev || actual.ino !== expected.ino) {
    fail("PUBLICATION_PATH_SWAP_DETECTED", "AEB successor publication path identity changed.");
  }
}

async function unlinkIfSame(
  filePath: string,
  expected: { dev: number; ino: number } | undefined
): Promise<void> {
  assertIdentity(await fileIdentity(filePath), expected);
  await unlink(filePath);
}

function fileIdentityFromString(value: string): { dev: number; ino: number } | undefined {
  const match = /^(\d+):(\d+)$/.exec(value);
  if (!match) return undefined;
  const dev = Number(match[1]);
  const ino = Number(match[2]);
  if (!Number.isSafeInteger(dev) || !Number.isSafeInteger(ino)) return undefined;
  return { dev, ino };
}

async function hashCanonical(hasher: EmbeddedResourceHasher, value: unknown): Promise<string> {
  return requireSha256(await hasher.hash(new TextEncoder().encode(canonicalJson(value)))).value;
}

function canonicalJson(value: unknown): string {
  return JSON.stringify(sortValue(value));
}

function sameJson(left: unknown, right: unknown): boolean {
  return canonicalJson(left) === canonicalJson(right);
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

function requireSha256(hash: { algorithm: string; value: string; scope: string }): {
  algorithm: "sha256";
  value: string;
  scope: "encoded_bytes";
} {
  if (hash.algorithm !== "sha256" || hash.scope !== "encoded_bytes" || !isSha256(hash.value)) {
    fail("HASHER_CONTRACT_INVALID", "AEB package publication requires encoded-byte SHA-256 hashes.");
  }
  return { algorithm: "sha256", value: hash.value, scope: "encoded_bytes" };
}

function isSha256(value: unknown): value is string {
  return typeof value === "string" && /^[a-f0-9]{64}$/.test(value);
}

function fail(code: string, message: string): never {
  throw new AebBakePipelineError(code, message);
}
