import { constants } from "node:fs";
import {
  link,
  lstat,
  mkdir,
  open,
  readdir,
  rm,
  unlink
} from "node:fs/promises";
import path from "node:path";
import { decode } from "fast-png";
import { encodeRgbaPng } from "../utils/png-writer.js";
import type {
  AebBakeExecutionAuthority,
  AebBakeExecutionReceipt,
  AebBakeExecutionVerificationInput,
  AebBakeFrameSource,
  AebBakeManifest
} from "../workbench/aeb-bake-contracts.js";
import { AebBakePipelineError } from "../workbench/aeb-bake-pipeline.js";
import {
  AEB_AE_BAKE_CLEANUP_RECEIPT_SCHEMA_VERSION,
  AEB_AE_BAKE_PRODUCER_RECEIPT_SCHEMA_VERSION,
  AEB_AE_RETAINED_TRANSACTION_RECEIPT_SCHEMA_VERSION,
  type AebAeBakeCleanupReceipt,
  type AebAeBakeExecutionPlan,
  type AebAeBakeHostAdapter,
  type AebAeBakeHostDescriptor,
  type AebAeBakeHostResult,
  type AebAeBakeProducerFrameReceipt,
  type AebAeBakeProducerReceipt,
  type AebAeBakeProgressEvent,
  type AebAeRetainedTransactionReceipt,
  createAebAeHostExecutionEvidence,
  createAebAeRetainedHostExecutionEvidence,
  hashCanonical,
  verifyAebAeBakeExecutionPlan,
  verifyAebAeBakeProducerReceipt,
  verifyAebAeControlledScanReceipt,
  verifyAebAeRetainedTransactionReceipt
} from "../workbench/aeb-ae-bake-execution.js";
import type { EmbeddedResourceHasher } from "../workbench/resource-hasher.js";
import {
  NodeAebBakeResourceReader,
  NodeAebTaskRootAuthority
} from "./aeb-node-bake-resource-reader.js";
import { consumeAebRetainedAeTransactionCapability } from "../experiments/aeb-retained-ae-discriminator/runtime.js";

const MAX_RECEIPT_BYTES = 512 * 1024;

export type AebAeBakeExecutionPhase = "write" | "render" | "canonicalize" | "finalize" | "cleanup";

export interface AebAeBakeExecutionHooks {
  beforePhase?(phase: AebAeBakeExecutionPhase): Promise<void> | void;
}

export interface ExecuteAebBoundedAeBakeOptions {
  signal?: AbortSignal;
  onProgress?(event: AebAeBakeProgressEvent): void;
  hooks?: AebAeBakeExecutionHooks;
}

export interface AebBoundedAeBakeExecutionResult {
  plan: AebAeBakeExecutionPlan;
  frames: readonly AebBakeFrameSource[];
  producerReceipt: AebAeBakeProducerReceipt;
  cleanupReceipt: AebAeBakeCleanupReceipt;
  executionReceipt: AebBakeExecutionReceipt;
  executionAuthority: AebBakeExecutionAuthority;
  progress: readonly AebAeBakeProgressEvent[];
}

export interface AebRetainedBakeExecutionAuthorityBinding {
  planHash: string;
  executionReceiptHash: string;
  producerReceiptHash: string;
  taskId: string;
  executionId: string;
  jobId: string;
  packageId: string;
}

interface PrivateRetainedBakeExecutionAuthority extends AebRetainedBakeExecutionAuthorityBinding {
  authority: AebBakeExecutionAuthority;
}

const retainedBakeExecutionAuthorities = new WeakMap<object, PrivateRetainedBakeExecutionAuthority>();

export function verifyAebRetainedBakeExecutionAuthorityProvenance(
  authority: AebBakeExecutionAuthority | undefined,
  expected: AebRetainedBakeExecutionAuthorityBinding
): boolean {
  if (!authority) return false;
  const privateState = retainedBakeExecutionAuthorities.get(authority);
  return Boolean(privateState
    && privateState.authority === authority
    && privateState.planHash === expected.planHash
    && privateState.executionReceiptHash === expected.executionReceiptHash
    && privateState.producerReceiptHash === expected.producerReceiptHash
    && privateState.taskId === expected.taskId
    && privateState.executionId === expected.executionId
    && privateState.jobId === expected.jobId
    && privateState.packageId === expected.packageId);
}

export function verifyAebRetainedBakeExecutionAuthorityForPublication(
  authority: AebBakeExecutionAuthority | undefined,
  expected: Pick<AebRetainedBakeExecutionAuthorityBinding,
    "executionReceiptHash" | "taskId" | "jobId" | "packageId">
): boolean {
  if (!authority) return false;
  const privateState = retainedBakeExecutionAuthorities.get(authority);
  return Boolean(privateState
    && privateState.authority === authority
    && privateState.executionReceiptHash === expected.executionReceiptHash
    && privateState.taskId === expected.taskId
    && privateState.jobId === expected.jobId
    && privateState.packageId === expected.packageId);
}

export class AebAeBakeExecutionError extends AebBakePipelineError {
  constructor(
    code: string,
    message: string,
    readonly cleanupReceipt?: AebAeBakeCleanupReceipt
  ) {
    super(code, message);
    this.name = "AebAeBakeExecutionError";
  }
}

interface OwnedPath {
  path: string;
  dev: number;
  ino: number;
}

export class NodeAebBoundedAeBakeExecutor {
  constructor(
    private readonly authority: NodeAebTaskRootAuthority,
    private readonly hasher: EmbeddedResourceHasher
  ) {}

  async execute(
    plan: AebAeBakeExecutionPlan,
    host: AebAeBakeHostAdapter,
    options: ExecuteAebBoundedAeBakeOptions = {}
  ): Promise<AebBoundedAeBakeExecutionResult> {
    if (!await verifyAebAeBakeExecutionPlan(plan, this.hasher)) {
      fail("AE_EXECUTION_PLAN_INVALID", "AEB AE Bake execution plan is invalid.");
    }
    if (!sameJson(host.descriptor, plan.host)) {
      fail("AE_HOST_BINDING_MISMATCH", "AEB AE Bake host does not match the approved host identity.");
    }
    if (options.signal?.aborted) {
      fail("AE_EXECUTION_CANCELLED", "AEB AE Bake execution was cancelled before host access.");
    }

    const reader = new NodeAebBakeResourceReader(this.authority);
    await reader.verifyTaskReceipt(plan.taskReceipt);
    const sourceProjectBefore = await this.readAndVerifySource(
      plan.sourceFiles.projectRelativePath,
      plan.sourceFiles.projectMaxBytes,
      plan.sourceFiles.projectContentHash,
      "SOURCE_PROJECT"
    );
    const sourcePackageBefore = await this.readAndVerifySource(
      plan.sourceFiles.packageRelativePath,
      plan.sourceFiles.packageMaxBytes,
      plan.sourceFiles.packageContentHash,
      "SOURCE_PACKAGE"
    );

    const planFileName = planFile(plan.executionId);
    const producerFileName = producerReceiptFile(plan.executionId);
    const cleanupFileName = cleanupReceiptFile(plan.executionId);
    let workDirectory: OwnedPath | undefined;
    let framesDirectory: OwnedPath | undefined;
    const ownedFiles: OwnedPath[] = [];
    let hostResult: AebAeBakeHostResult | undefined;
    let phase: AebAeBakeExecutionPhase = "write";
    let timedOut = false;
    let cancelled = false;
    const progress: AebAeBakeProgressEvent[] = [];
    const internalAbort = new AbortController();
    const externalAbort = () => {
      cancelled = true;
      internalAbort.abort(options.signal?.reason);
    };
    options.signal?.addEventListener("abort", externalAbort, { once: true });
    const timeout = setTimeout(() => {
      timedOut = true;
      internalAbort.abort(new Error("aeb-ae-bake-timeout"));
    }, plan.render.timeoutMs);

    const emit = (event: AebAeBakeProgressEvent): void => {
      validateProgressEvent(event, progress, plan.output.frames.length);
      progress.push({ ...event });
      options.onProgress?.({ ...event });
    };

    try {
      await options.hooks?.beforePhase?.("write");
      ownedFiles.push(await writeDirectAtomic(
        this.authority,
        planFileName,
        Buffer.from(canonicalJson(plan)),
        MAX_RECEIPT_BYTES,
        plan.executionId,
        "plan"
      ));
      workDirectory = await createOwnedDirectory(this.authority, plan.output.workDirectory);
      const rawDirectoryPath = path.join(workDirectory.path, "raw");
      await mkdir(rawDirectoryPath, { mode: 0o700 });
      const scratchProjectPath = path.join(workDirectory.path, "scratch-project.aep");
      await writeNestedAtomic(
        workDirectory,
        "scratch-project.aep",
        sourceProjectBefore.bytes,
        plan.sourceFiles.projectMaxBytes,
        "scratch-project"
      );
      emit({ phase: "prepared", completedFrames: 0, totalFrames: plan.output.frames.length });

      phase = "render";
      await options.hooks?.beforePhase?.("render");
      const rawFrameFileNames = plan.output.frames.map((frame) => path.posix.basename(frame.relativePath));
      hostResult = await host.render({
        plan,
        taskRootPath: path.dirname(workDirectory.path),
        scratchProjectPath,
        scratchProjectRelativePath: `${plan.output.workDirectory}/scratch-project.aep`,
        rawOutputDirectory: rawDirectoryPath,
        rawFrameFileNames,
        signal: internalAbort.signal,
        onProgress: emit
      });
      if (internalAbort.signal.aborted) {
        fail(timedOut ? "AE_EXECUTION_TIMEOUT" : "AE_EXECUTION_CANCELLED", "AEB AE Bake host did not complete inside its execution authority.");
      }
      await validateHostResult(hostResult, plan, this.hasher);
      await verifyExactDirectoryInventory(rawDirectoryPath, rawFrameFileNames);

      phase = "canonicalize";
      await options.hooks?.beforePhase?.("canonicalize");
      framesDirectory = await createOwnedDirectory(this.authority, plan.output.framesDirectory);
      const producerFrames: AebAeBakeProducerFrameReceipt[] = [];
      let totalEncodedBytes = 0;
      let totalDecodedRgbaBytes = 0;
      const rawReader = new NodeAebBakeResourceReader(this.authority);
      const canonicalReader = new NodeAebBakeResourceReader(this.authority);
      for (let index = 0; index < plan.output.frames.length; index += 1) {
        const frame = plan.output.frames[index];
        const rawRelativePath = `${plan.output.workDirectory}/raw/${path.posix.basename(frame.relativePath)}`;
        const raw = await rawReader.readFrame(
          { frameIndex: frame.frameIndex, relativePath: rawRelativePath },
          {
            width: plan.job.canvas.width,
            height: plan.job.canvas.height,
            maxEncodedBytes: plan.job.budgets.maxEncodedBytes,
            maxDecodedRgbaBytes: plan.job.budgets.maxDecodedRgbaBytes
          }
        );
        if (hostResult.scanReceipt.schemaVersion === AEB_AE_RETAINED_TRANSACTION_RECEIPT_SCHEMA_VERSION) {
          const retainedFrame = hostResult.scanReceipt.output.frames[index];
          const rawContentHash = requireSha256(await this.hasher.hash(raw.bytes));
          if (!retainedFrame
            || retainedFrame.contentHash !== rawContentHash
            || retainedFrame.encodedBytes !== raw.encodedBytes
            || retainedFrame.decodedRgbaBytes !== raw.decodedRgbaBytes
            || retainedFrame.width !== raw.width
            || retainedFrame.height !== raw.height) {
            fail(
              "AE_RETAINED_OUTPUT_BINDING_MISMATCH",
              "The task-owned raw frame bytes do not match the retained AE transaction receipt."
            );
          }
        }
        const decoded = decode(raw.bytes, { checkCrc: true });
        if (decoded.channels !== 4 || decoded.depth !== 8) {
          fail("AE_FRAME_RGBA_REQUIRED", "AEB AE Bake raw output must decode to 8-bit RGBA.");
        }
        const canonicalBytes = encodeRgbaPng({
          width: decoded.width,
          height: decoded.height,
          pixels: new Uint8Array(decoded.data)
        });
        const fileName = path.posix.basename(frame.relativePath);
        await writeNestedAtomic(
          framesDirectory,
          fileName,
          canonicalBytes,
          plan.job.budgets.maxEncodedBytes,
          `frame-${frame.frameIndex}`
        );
        const canonical = await canonicalReader.readFrame(frame, {
          width: plan.job.canvas.width,
          height: plan.job.canvas.height,
          maxEncodedBytes: plan.job.budgets.maxEncodedBytes,
          maxDecodedRgbaBytes: plan.job.budgets.maxDecodedRgbaBytes
        });
        const contentHash = requireSha256(await this.hasher.hash(canonical.bytes));
        totalEncodedBytes += canonical.encodedBytes;
        totalDecodedRgbaBytes += canonical.decodedRgbaBytes;
        if (totalEncodedBytes > plan.job.budgets.maxEncodedBytes) {
          fail("AE_ENCODED_BUDGET_EXCEEDED", "AEB AE Bake canonical frames exceed the encoded-byte budget.");
        }
        if (totalDecodedRgbaBytes > plan.job.budgets.maxDecodedRgbaBytes) {
          fail("AE_DECODED_BUDGET_EXCEEDED", "AEB AE Bake canonical frames exceed the decoded-byte budget.");
        }
        producerFrames.push({
          frameIndex: frame.frameIndex,
          relativePath: frame.relativePath,
          contentHash,
          encodedBytes: canonical.encodedBytes,
          decodedRgbaBytes: canonical.decodedRgbaBytes,
          width: canonical.width,
          height: canonical.height
        });
        emit({ phase: "canonicalizing", completedFrames: index + 1, totalFrames: plan.output.frames.length });
      }

      phase = "finalize";
      await options.hooks?.beforePhase?.("finalize");
      if (!consumeAebRetainedAeTransactionCapability(hostResult, plan)) {
        fail(
          "AE_RETAINED_TRANSACTION_AUTHORITY_REQUIRED",
          "Only one complete retained AE transaction can mint actual After Effects Bake authority."
        );
      }
      const sourceProjectAfter = await this.readAndAssertUnchanged(
        plan.sourceFiles.projectRelativePath,
        plan.sourceFiles.projectMaxBytes,
        sourceProjectBefore,
        "SOURCE_PROJECT"
      );
      const sourcePackageAfter = await this.readAndAssertUnchanged(
        plan.sourceFiles.packageRelativePath,
        plan.sourceFiles.packageMaxBytes,
        sourcePackageBefore,
        "SOURCE_PACKAGE"
      );
      await removeOwnedDirectory(workDirectory);
      workDirectory = undefined;
      emit({ phase: "finalizing", completedFrames: plan.output.frames.length, totalFrames: plan.output.frames.length });

      phase = "cleanup";
      let cleanupHookFailed = false;
      try {
        await options.hooks?.beforePhase?.("cleanup");
      } catch {
        cleanupHookFailed = true;
      }
      if (cleanupHookFailed) {
        fail("AE_CLEANUP_FAILED", "AEB AE Bake cleanup gate failed after task-owned work removal.");
      }
      const cleanupWithoutHash: Omit<AebAeBakeCleanupReceipt, "receiptHash"> = {
        schemaVersion: AEB_AE_BAKE_CLEANUP_RECEIPT_SCHEMA_VERSION,
        executionId: plan.executionId,
        taskId: plan.job.task.taskId,
        jobId: plan.job.jobId,
        planHash: plan.planHash,
        outcome: "success",
        phase: "cleanup",
        workDirectory: plan.output.workDirectory,
        framesDirectory: plan.output.framesDirectory,
        workDirectoryRemoved: true,
        partialFramesRemoved: false,
        planRemoved: false,
        temporaryRenderItemsRemoved: hostResult.temporaryRenderItemsConfinedToScratch,
        sourceProjectUnchanged: true,
        sourcePackageUnchanged: true
      };
      const cleanupReceipt: AebAeBakeCleanupReceipt = {
        ...cleanupWithoutHash,
        receiptHash: await hashCanonical(this.hasher, cleanupWithoutHash)
      };
      ownedFiles.push(await writeDirectAtomic(
        this.authority,
        cleanupFileName,
        Buffer.from(canonicalJson(cleanupReceipt)),
        MAX_RECEIPT_BYTES,
        plan.executionId,
        "cleanup"
      ));
      const progressDigest = await hashCanonical(this.hasher, progress);
      const producerWithoutHash: Omit<AebAeBakeProducerReceipt, "receiptHash"> = {
        schemaVersion: AEB_AE_BAKE_PRODUCER_RECEIPT_SCHEMA_VERSION,
        executionId: plan.executionId,
        planHash: plan.planHash,
        jobId: plan.job.jobId,
        packageId: plan.job.packageId,
        sourceFingerprint: plan.job.source.sourceFingerprint,
        scanDigest: plan.job.source.scanDigest,
        plannerDigest: plan.job.source.plannerDigest,
        taskId: plan.job.task.taskId,
        taskReceiptId: plan.job.task.receiptId,
        target: {
          compositionId: plan.composition.id,
          compositionName: plan.composition.name,
          sourceId: plan.job.target.sourceId,
          layerIds: [...plan.job.target.layerIds].sort(compareCodeUnits)
        },
        timing: {
          startFrame: plan.job.timeRange.startFrame,
          endFrameExclusive: plan.job.timeRange.endFrameExclusive,
          fps: plan.job.fps
        },
        canvas: { ...plan.job.canvas },
        alphaMode: "straight",
        host: { ...hostResult.host },
        scanReceipt: structuredClone(hostResult.scanReceipt),
        hostExecution: structuredClone(hostResult.executionEvidence),
        source: {
          project: {
            relativePath: plan.sourceFiles.projectRelativePath,
            contentHash: plan.sourceFiles.projectContentHash,
            preIdentityDigest: sourceProjectBefore.identityDigest,
            postIdentityDigest: sourceProjectAfter.identityDigest,
            unchanged: true
          },
          package: {
            relativePath: plan.sourceFiles.packageRelativePath,
            contentHash: plan.sourceFiles.packageContentHash,
            preIdentityDigest: sourcePackageBefore.identityDigest,
            postIdentityDigest: sourcePackageAfter.identityDigest,
            unchanged: true
          }
        },
        output: { frames: producerFrames, totalEncodedBytes, totalDecodedRgbaBytes },
        execution: {
          state: "completed",
          processStarted: hostResult.processStarted,
          hostCompleted: hostResult.completed,
          exitCode: hostResult.exitCode,
          cancelled: hostResult.cancelled,
          timedOut: hostResult.timedOut,
          progressDigest
        },
        cleanupReceiptHash: cleanupReceipt.receiptHash
      };
      const producerReceipt: AebAeBakeProducerReceipt = {
        ...producerWithoutHash,
        receiptHash: await hashCanonical(this.hasher, producerWithoutHash)
      };
      if (!await verifyAebAeBakeProducerReceipt(plan, producerReceipt, cleanupReceipt, this.hasher)) {
        fail("AE_PRODUCER_RECEIPT_INVALID", "AEB AE Bake producer receipt failed semantic verification.");
      }
      ownedFiles.push(await writeDirectAtomic(
        this.authority,
        producerFileName,
        Buffer.from(canonicalJson(producerReceipt)),
        MAX_RECEIPT_BYTES,
        plan.executionId,
        "producer"
      ));
      const executionReceipt = await createVerifiedExecutionReceipt(
        plan,
        producerReceipt,
        cleanupReceipt,
        this.hasher
      );
      const executionAuthority = new NodeAebAeExecutionAuthority(this.authority, plan, this.hasher);
      retainedBakeExecutionAuthorities.set(executionAuthority, {
        authority: executionAuthority,
        planHash: plan.planHash,
        executionReceiptHash: executionReceipt.receiptHash,
        producerReceiptHash: producerReceipt.receiptHash,
        taskId: plan.job.task.taskId,
        executionId: plan.executionId,
        jobId: plan.job.jobId,
        packageId: plan.job.packageId
      });
      emit({ phase: "completed", completedFrames: plan.output.frames.length, totalFrames: plan.output.frames.length });
      return {
        plan,
        frames: plan.output.frames.map((frame) => ({ ...frame })),
        producerReceipt,
        cleanupReceipt,
        executionReceipt,
        executionAuthority,
        progress
      };
    } catch (error) {
      internalAbort.abort(error);
      const cleanupFailures: unknown[] = [];
      if (workDirectory) {
        try { await removeOwnedDirectory(workDirectory); } catch (cleanupError) { cleanupFailures.push(cleanupError); }
      }
      if (framesDirectory) {
        try { await removeOwnedDirectory(framesDirectory); } catch (cleanupError) { cleanupFailures.push(cleanupError); }
      }
      for (const ownedFile of [...ownedFiles].reverse()) {
        try { await removeOwnedFile(ownedFile); } catch (cleanupError) { cleanupFailures.push(cleanupError); }
      }
      let sourceProjectUnchanged = false;
      let sourcePackageUnchanged = false;
      try {
        await this.readAndAssertUnchanged(
          plan.sourceFiles.projectRelativePath,
          plan.sourceFiles.projectMaxBytes,
          sourceProjectBefore,
          "SOURCE_PROJECT"
        );
        sourceProjectUnchanged = true;
      } catch (cleanupError) {
        cleanupFailures.push(cleanupError);
      }
      try {
        await this.readAndAssertUnchanged(
          plan.sourceFiles.packageRelativePath,
          plan.sourceFiles.packageMaxBytes,
          sourcePackageBefore,
          "SOURCE_PACKAGE"
        );
        sourcePackageUnchanged = true;
      } catch (cleanupError) {
        cleanupFailures.push(cleanupError);
      }
      if (cleanupFailures.length > 0 || !sourceProjectUnchanged || !sourcePackageUnchanged) {
        throw new AebAeBakeExecutionError(
          "AE_EXECUTION_ROLLBACK_FAILED",
          "AEB AE Bake execution failed and task-owned rollback could not be proved."
        );
      }
      const rollbackWithoutHash: Omit<AebAeBakeCleanupReceipt, "receiptHash"> = {
        schemaVersion: AEB_AE_BAKE_CLEANUP_RECEIPT_SCHEMA_VERSION,
        executionId: plan.executionId,
        taskId: plan.job.task.taskId,
        jobId: plan.job.jobId,
        planHash: plan.planHash,
        outcome: "rollback",
        phase,
        workDirectory: plan.output.workDirectory,
        framesDirectory: plan.output.framesDirectory,
        workDirectoryRemoved: true,
        partialFramesRemoved: Boolean(framesDirectory),
        planRemoved: ownedFiles.some((item) => path.basename(item.path) === planFileName),
        temporaryRenderItemsRemoved: hostResult?.temporaryRenderItemsConfinedToScratch === true || phase === "write",
        sourceProjectUnchanged: true,
        sourcePackageUnchanged: true
      };
      const rollbackReceipt: AebAeBakeCleanupReceipt = {
        ...rollbackWithoutHash,
        receiptHash: await hashCanonical(this.hasher, rollbackWithoutHash)
      };
      const code = timedOut
        ? "AE_EXECUTION_TIMEOUT"
        : cancelled || options.signal?.aborted
          ? "AE_EXECUTION_CANCELLED"
          : error instanceof AebBakePipelineError
            ? error.code
            : phase === "write"
              ? "AE_EXECUTION_PREPARE_FAILED"
              : phase === "finalize"
                ? "AE_EXECUTION_FINALIZE_FAILED"
                : phase === "cleanup"
                  ? "AE_CLEANUP_FAILED"
                  : "AE_HOST_EXECUTION_FAILED";
      throw new AebAeBakeExecutionError(
        code,
        "AEB AE Bake execution failed and task-owned outputs were rolled back.",
        rollbackReceipt
      );
    } finally {
      clearTimeout(timeout);
      options.signal?.removeEventListener("abort", externalAbort);
    }
  }

  private async readAndVerifySource(
    relativePath: string,
    maxBytes: number,
    expectedHash: string,
    codePrefix: string
  ) {
    const file = await this.authority.readBoundedTaskFile(relativePath, maxBytes, codePrefix);
    if (requireSha256(await this.hasher.hash(file.bytes)) !== expectedHash) {
      fail(`${codePrefix}_HASH_MISMATCH`, "AEB AE Bake source bytes do not match the approved source binding.");
    }
    return file;
  }

  private async readAndAssertUnchanged(
    relativePath: string,
    maxBytes: number,
    before: Awaited<ReturnType<NodeAebTaskRootAuthority["readBoundedTaskFile"]>>,
    codePrefix: string
  ) {
    const after = await this.authority.readBoundedTaskFile(relativePath, maxBytes, codePrefix);
    if (after.identityDigest !== before.identityDigest || !after.bytes.equals(before.bytes)) {
      fail(`${codePrefix}_MUTATED`, "AEB AE Bake source changed during execution.");
    }
    return after;
  }
}

class NodeAebAeExecutionAuthority implements AebBakeExecutionAuthority {
  constructor(
    private readonly authority: NodeAebTaskRootAuthority,
    private readonly plan: AebAeBakeExecutionPlan,
    private readonly hasher: EmbeddedResourceHasher
  ) {}

  async verifyExecution(input: AebBakeExecutionVerificationInput): Promise<boolean> {
    try {
      const loaded = await this.loadAndVerify();
      if (!sameJson(input.job, this.plan.job)
        || !sameJson(input.planner, this.plan.planner)
        || !sameJson(input.taskReceipt, this.plan.taskReceipt)
        || !sameJson(input.frames, this.plan.output.frames)) return false;
      const expected = await createVerifiedExecutionReceipt(
        this.plan,
        loaded.producer,
        loaded.cleanup,
        input.hasher
      );
      return sameJson(expected, input.executionReceipt);
    } catch {
      return false;
    }
  }

  async verifyManifest(manifest: AebBakeManifest): Promise<boolean> {
    try {
      const loaded = await this.loadAndVerify();
      const execution = await createVerifiedExecutionReceipt(
        this.plan,
        loaded.producer,
        loaded.cleanup,
        this.hasher
      );
      return sameJson(manifest.job.source, this.plan.job.source)
        && manifest.job.jobId === this.plan.job.jobId
        && manifest.job.packageId === this.plan.job.packageId
        && manifest.execution.mode === "after_effects"
        && manifest.execution.actualAeRenderExecuted === true
        && manifest.execution.receiptHash === execution.receiptHash
        && manifest.execution.frameInventoryDigest === execution.frameInventoryDigest
        && manifest.frames.length === loaded.producer.output.frames.length
        && manifest.frames.every((frame, index) => frame.frameIndex === loaded.producer.output.frames[index].frameIndex
          && frame.relativePath === loaded.producer.output.frames[index].relativePath
          && frame.contentHash.value === loaded.producer.output.frames[index].contentHash);
    } catch {
      return false;
    }
  }

  private async loadAndVerify(): Promise<{
    producer: AebAeBakeProducerReceipt;
    cleanup: AebAeBakeCleanupReceipt;
  }> {
    if (!await verifyAebAeBakeExecutionPlan(this.plan, this.hasher)) {
      fail("AE_EXECUTION_PLAN_INVALID", "AEB AE execution authority plan is invalid.");
    }
    const loadedPlan = await readJson<AebAeBakeExecutionPlan>(
      this.authority,
      planFile(this.plan.executionId),
      MAX_RECEIPT_BYTES,
      "AE_PLAN"
    );
    const cleanup = await readJson<AebAeBakeCleanupReceipt>(
      this.authority,
      cleanupReceiptFile(this.plan.executionId),
      MAX_RECEIPT_BYTES,
      "AE_CLEANUP_RECEIPT"
    );
    const producer = await readJson<AebAeBakeProducerReceipt>(
      this.authority,
      producerReceiptFile(this.plan.executionId),
      MAX_RECEIPT_BYTES,
      "AE_PRODUCER_RECEIPT"
    );
    if (!sameJson(loadedPlan, this.plan)
      || !await verifyAebAeBakeProducerReceipt(this.plan, producer, cleanup, this.hasher)) {
      fail("AE_PRODUCER_RECEIPT_INVALID", "AEB AE producer authority files are invalid.");
    }
    const reader = new NodeAebBakeResourceReader(this.authority);
    await reader.verifyTaskReceipt(this.plan.taskReceipt);
    for (let index = 0; index < this.plan.output.frames.length; index += 1) {
      const frame = this.plan.output.frames[index];
      const expected = producer.output.frames[index];
      const resource = await reader.readFrame(frame, {
        width: this.plan.job.canvas.width,
        height: this.plan.job.canvas.height,
        maxEncodedBytes: this.plan.job.budgets.maxEncodedBytes,
        maxDecodedRgbaBytes: this.plan.job.budgets.maxDecodedRgbaBytes
      });
      if (resource.encodedBytes !== expected.encodedBytes
        || resource.decodedRgbaBytes !== expected.decodedRgbaBytes
        || requireSha256(await this.hasher.hash(resource.bytes)) !== expected.contentHash) {
        fail("AE_FRAME_AUTHORITY_INVALID", "AEB AE canonical frame no longer matches producer authority.");
      }
    }
    await verifyCurrentSource(this.authority, this.hasher, producer.source.project, this.plan.sourceFiles.projectMaxBytes, "SOURCE_PROJECT");
    await verifyCurrentSource(this.authority, this.hasher, producer.source.package, this.plan.sourceFiles.packageMaxBytes, "SOURCE_PACKAGE");
    return { producer, cleanup };
  }
}

export function planFile(executionId: string): string {
  return `aeb-ae-execution-plan-${executionId}.json`;
}

export function producerReceiptFile(executionId: string): string {
  return `aeb-ae-producer-receipt-${executionId}.json`;
}

export function cleanupReceiptFile(executionId: string): string {
  return `aeb-ae-cleanup-receipt-${executionId}.json`;
}

async function verifyCurrentSource(
  authority: NodeAebTaskRootAuthority,
  hasher: EmbeddedResourceHasher,
  receipt: AebAeBakeProducerReceipt["source"]["project"],
  maxBytes: number,
  codePrefix: string
): Promise<void> {
  const current = await authority.readBoundedTaskFile(receipt.relativePath, maxBytes, codePrefix);
  if (current.identityDigest !== receipt.preIdentityDigest
    || current.identityDigest !== receipt.postIdentityDigest
    || requireSha256(await hasher.hash(current.bytes)) !== receipt.contentHash) {
    fail(`${codePrefix}_MUTATED`, "AEB AE source authority changed after producer completion.");
  }
}

async function readJson<T>(
  authority: NodeAebTaskRootAuthority,
  relativePath: string,
  maxBytes: number,
  codePrefix: string
): Promise<T> {
  const file = await authority.readBoundedTaskFile(relativePath, maxBytes, codePrefix);
  try {
    return JSON.parse(file.bytes.toString("utf8")) as T;
  } catch {
    fail(`${codePrefix}_MALFORMED`, "AEB AE authority receipt is not valid JSON.");
  }
}

async function writeDirectAtomic(
  authority: NodeAebTaskRootAuthority,
  fileName: string,
  bytes: Uint8Array,
  maxBytes: number,
  executionId: string,
  label: string
): Promise<OwnedPath> {
  if (bytes.byteLength <= 0 || bytes.byteLength > maxBytes) {
    fail("AE_ATOMIC_WRITE_BUDGET_EXCEEDED", "AEB AE authority file exceeds its write budget.");
  }
  const destinationPath = await authority.directChildPath(fileName);
  const temporaryName = `aeb-ae-temp-${executionId}-${label}.tmp`;
  const temporaryPath = await authority.directChildPath(temporaryName);
  let temporaryCreated = false;
  let destinationCreated = false;
  try {
    const handle = await open(temporaryPath, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW, 0o600);
    temporaryCreated = true;
    try {
      await handle.writeFile(bytes);
      await handle.sync();
    } finally {
      await handle.close();
    }
    await link(temporaryPath, destinationPath);
    destinationCreated = true;
    await unlink(temporaryPath);
    temporaryCreated = false;
    await authority.syncTaskRoot();
    return ownedPath(destinationPath);
  } catch (error) {
    if (destinationCreated) await safeUnlink(destinationPath);
    if (temporaryCreated) await safeUnlink(temporaryPath);
    if (error instanceof AebBakePipelineError) throw error;
    fail("AE_ATOMIC_WRITE_FAILED", "AEB AE authority file could not be atomically published without overwrite.");
  }
}

async function createOwnedDirectory(
  authority: NodeAebTaskRootAuthority,
  directoryName: string
): Promise<OwnedPath> {
  const directoryPath = await authority.directChildPath(directoryName);
  try {
    await mkdir(directoryPath, { mode: 0o700 });
    await authority.syncTaskRoot();
    return ownedPath(directoryPath, true);
  } catch {
    fail("AE_OUTPUT_PATH_EXISTS", "AEB AE output directory must be an absent task-owned destination.");
  }
}

async function writeNestedAtomic(
  parent: OwnedPath,
  fileName: string,
  bytes: Uint8Array,
  maxBytes: number,
  label: string
): Promise<void> {
  await assertOwnedDirectory(parent);
  if (!isDirectFileName(fileName) || bytes.byteLength <= 0 || bytes.byteLength > maxBytes) {
    fail("AE_FRAME_WRITE_INVALID", "AEB AE nested output write is invalid or over budget.");
  }
  const destinationPath = path.join(parent.path, fileName);
  const temporaryPath = path.join(parent.path, `temp-${label}.tmp`);
  let temporaryCreated = false;
  let destinationCreated = false;
  try {
    const handle = await open(temporaryPath, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW, 0o600);
    temporaryCreated = true;
    try {
      await handle.writeFile(bytes);
      await handle.sync();
    } finally {
      await handle.close();
    }
    await link(temporaryPath, destinationPath);
    destinationCreated = true;
    await unlink(temporaryPath);
    temporaryCreated = false;
    await assertOwnedDirectory(parent);
    const metadata = await lstat(destinationPath);
    if (!metadata.isFile() || metadata.isSymbolicLink() || metadata.nlink !== 1) {
      fail("AE_FRAME_WRITE_IDENTITY_INVALID", "AEB AE nested output is not an exclusive regular file.");
    }
  } catch (error) {
    if (destinationCreated) await safeUnlink(destinationPath);
    if (temporaryCreated) await safeUnlink(temporaryPath);
    if (error instanceof AebBakePipelineError) throw error;
    fail("AE_FRAME_WRITE_FAILED", "AEB AE nested output could not be atomically published.");
  }
}

async function removeOwnedDirectory(directory: OwnedPath): Promise<void> {
  await assertOwnedDirectory(directory);
  await rm(directory.path, { recursive: true, force: false });
  if (await pathExists(directory.path)) {
    fail("AE_CLEANUP_FAILED", "AEB AE task-owned directory cleanup did not complete.");
  }
}

async function removeOwnedFile(file: OwnedPath): Promise<void> {
  const metadata = await lstat(file.path);
  if (!metadata.isFile() || metadata.isSymbolicLink() || metadata.dev !== file.dev || metadata.ino !== file.ino) {
    fail("AE_CLEANUP_IDENTITY_MISMATCH", "AEB AE authority file changed before rollback cleanup.");
  }
  await unlink(file.path);
}

async function ownedPath(filePath: string, directory = false): Promise<OwnedPath> {
  const metadata = await lstat(filePath);
  if (metadata.isSymbolicLink()
    || (directory ? !metadata.isDirectory() : !metadata.isFile())
    || (!directory && metadata.nlink !== 1)) {
    fail("AE_OUTPUT_IDENTITY_INVALID", "AEB AE task-owned output identity is invalid.");
  }
  return { path: filePath, dev: metadata.dev, ino: metadata.ino };
}

async function assertOwnedDirectory(directory: OwnedPath): Promise<void> {
  const metadata = await lstat(directory.path);
  if (!metadata.isDirectory() || metadata.isSymbolicLink()
    || metadata.dev !== directory.dev || metadata.ino !== directory.ino) {
    fail("AE_OUTPUT_PATH_SWAP_DETECTED", "AEB AE task-owned output directory identity changed.");
  }
}

async function verifyExactDirectoryInventory(directoryPath: string, expectedNames: readonly string[]): Promise<void> {
  const names = (await readdir(directoryPath)).sort(compareCodeUnits);
  const expected = [...expectedNames].sort(compareCodeUnits);
  if (!sameJson(names, expected)) {
    fail("AE_FRAME_INVENTORY_INVALID", "AEB AE raw output inventory is missing, duplicated, or contains stale files.");
  }
}

function validateProgressEvent(
  event: AebAeBakeProgressEvent,
  prior: readonly AebAeBakeProgressEvent[],
  expectedTotal: number
): void {
  const previous = prior[prior.length - 1];
  const phaseOrder: Record<AebAeBakeProgressEvent["phase"], number> = {
    prepared: 0,
    rendering: 1,
    canonicalizing: 2,
    finalizing: 3,
    completed: 4
  };
  if (!isProgressPhase(event.phase)
    || !Number.isInteger(event.completedFrames)
    || event.completedFrames < 0
    || event.completedFrames > expectedTotal
    || event.totalFrames !== expectedTotal
    || (previous && phaseOrder[event.phase] < phaseOrder[previous.phase])
    || (previous && event.phase === previous.phase && event.completedFrames < previous.completedFrames)
    || prior.length > expectedTotal * 3 + 8) {
    fail("AE_PROGRESS_INVALID", "AEB AE Bake progress is stale, non-monotonic, or over its event budget.");
  }
}

async function createVerifiedExecutionReceipt(
  plan: AebAeBakeExecutionPlan,
  producer: AebAeBakeProducerReceipt,
  cleanup: AebAeBakeCleanupReceipt,
  hasher: EmbeddedResourceHasher
): Promise<AebBakeExecutionReceipt> {
  if (!await verifyAebAeBakeProducerReceipt(plan, producer, cleanup, hasher)) {
    fail("AE_PRODUCER_RECEIPT_INVALID", "AEB AE producer and cleanup authority failed complete semantic verification.");
  }
  const receiptWithoutHash: Omit<AebBakeExecutionReceipt, "receiptHash"> = {
    schemaVersion: "aeb-bake-execution-receipt-v1",
    mode: "after_effects",
    jobId: plan.job.jobId,
    taskId: plan.job.task.taskId,
    taskReceiptId: plan.job.task.receiptId,
    sourceFingerprint: plan.job.source.sourceFingerprint,
    scanDigest: plan.job.source.scanDigest,
    plannerDigest: plan.job.source.plannerDigest,
    frameInventoryDigest: await hashCanonical(hasher, plan.output.frames),
    actualAeRenderExecuted: true,
    evidence: {
      kind: "after_effects",
      hostSessionId: plan.executionId,
      aeVersion: `${plan.host.version}+${plan.host.build}`,
      scriptDigest: plan.host.producerSourceHash,
      renderReceiptDigest: producer.receiptHash
    }
  };
  return { ...receiptWithoutHash, receiptHash: await hashCanonical(hasher, receiptWithoutHash) };
}

async function validateHostResult(
  result: AebAeBakeHostResult,
  plan: AebAeBakeExecutionPlan,
  hasher: EmbeddedResourceHasher
): Promise<void> {
  const retained = result.scanReceipt.schemaVersion === AEB_AE_RETAINED_TRANSACTION_RECEIPT_SCHEMA_VERSION;
  const receiptValid = retained
    ? await verifyAebAeRetainedTransactionReceipt(
      plan,
      result.scanReceipt as AebAeRetainedTransactionReceipt,
      hasher
    )
    : await verifyAebAeControlledScanReceipt(plan, result.scanReceipt as import("../workbench/aeb-ae-bake-execution.js").AebAeControlledScanReceipt, hasher);
  const expectedEvidence = retained
    ? await createAebAeRetainedHostExecutionEvidence(
      plan,
      result.scanReceipt as AebAeRetainedTransactionReceipt,
      hasher
    )
    : await createAebAeHostExecutionEvidence(
      plan,
      result.scanReceipt as import("../workbench/aeb-ae-bake-execution.js").AebAeControlledScanReceipt,
      hasher
    );
  if (!sameJson(result.host, plan.host)
    || result.processStarted !== true
    || result.completed !== true
    || result.exitCode !== 0
    || result.cancelled !== false
    || result.timedOut !== false
    || result.temporaryRenderItemsConfinedToScratch !== true
    || !receiptValid
    || !sameJson(result.executionEvidence, expectedEvidence)) {
    fail("AE_HOST_RECEIPT_INVALID", "AEB AE host result is incomplete or bound to another host.");
  }
}

function isProgressPhase(value: string): value is AebAeBakeProgressEvent["phase"] {
  return ["prepared", "rendering", "canonicalizing", "finalizing", "completed"].includes(value);
}

function requireSha256(hash: { algorithm: string; value: string; scope: string }): string {
  if (hash.algorithm !== "sha256" || hash.scope !== "encoded_bytes" || !/^[a-f0-9]{64}$/.test(hash.value)) {
    fail("HASHER_CONTRACT_INVALID", "AEB AE Bake requires encoded-byte SHA-256 hashes.");
  }
  return hash.value;
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
      .sort(([left], [right]) => compareCodeUnits(left, right))
      .map(([key, child]) => [key, sortValue(child)]));
  }
  return value;
}

function compareCodeUnits(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function isDirectFileName(value: string): boolean {
  return /^[a-zA-Z0-9][a-zA-Z0-9._-]{0,127}$/.test(value) && value !== "." && value !== "..";
}

async function pathExists(filePath: string): Promise<boolean> {
  try {
    await lstat(filePath);
    return true;
  } catch {
    return false;
  }
}

async function safeUnlink(filePath: string): Promise<void> {
  try { await unlink(filePath); } catch { /* best-effort cleanup followed by caller failure */ }
}

function fail(code: string, message: string): never {
  throw new AebBakePipelineError(code, message);
}
