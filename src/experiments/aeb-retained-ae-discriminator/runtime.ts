import { randomBytes } from "node:crypto";
import { constants, type BigIntStats } from "node:fs";
import { link, lstat, mkdir, open, realpath, unlink, type FileHandle } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { execFile } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";
import {
  AEB_RETAINED_AE_APPROVAL_SCHEMA,
  AEB_RETAINED_AE_BUDGETS,
  AEB_RETAINED_AE_CHECKPOINT_SCHEMA,
  AEB_RETAINED_AE_EVIDENCE_SCHEMA,
  AEB_RETAINED_AE_EXPECTED_HOST,
  AEB_RETAINED_AE_RESULT_SCHEMA,
  AEB_RETAINED_AE_TASK_BASE,
  AebRetainedAeApprovalGate,
  AebRetainedAeDiscriminatorError,
  type AebRetainedAeApproval,
  type AebRetainedAeBakeAuthorityContext,
  type AebRetainedAeCheckpointPublication,
  type AebRetainedAePlanInput,
  type AebRetainedAeProcessBinding,
  type AebRetainedAeResult,
  type AebRetainedAeRuntimeEvidence,
  type AebRetainedAeRuntimePlan,
  canonicalJson,
  createAebRetainedAeApproval,
  createAebRetainedAeRuntimePlan,
  hashCanonical,
  sha256,
  validateRuntimePlan,
  verifyAebRetainedAeResult
} from "./contracts.js";
import {
  NodeAebRetainedAeRunAuthority,
  createAebRetainedAeRunRoot,
  removeAebRetainedAeRunRoot
} from "./filesystem.js";
import {
  assertAebRetainedAeProcessSnapshotFacilityAvailable,
  spawnAebRetainedAeConcreteProcess,
  type AebRetainedAeConcreteProcessHandle
} from "./process-group.js";
import {
  AEB_AE_RETAINED_TRANSACTION_RECEIPT_SCHEMA_VERSION,
  type AebAeBakeExecutionPlan,
  type AebAeBakeHostAdapter,
  type AebAeBakeHostDescriptor,
  type AebAeBakeHostRenderRequest,
  type AebAeBakeHostResult,
  type AebAeRetainedTransactionReceipt,
  createAebAeRetainedHostExecutionEvidence,
  hashCanonical as hashAebCanonical
} from "../../workbench/aeb-ae-bake-execution.js";
import { Sha256ResourceHasher } from "../../hosts/sha256-resource-hasher.js";

const execFileAsync = promisify(execFile);
const EXPECTED_JSX_SHA256 = "2f7499995673c90c6d6d14780133d4b2f5c0c80fa49e668691b7d12c8b58a4ad";
const MAX_JSX_BYTES = 512 * 1024;
const MAX_EXECUTABLE_BYTES = 4 * 1024 * 1024;
const MAX_CODE_RESOURCES_BYTES = 4 * 1024 * 1024;
const MAX_CHILD_OUTPUT_BYTES = 64 * 1024;

export type AebRetainedAeProcessCleanupState = "not_started" | "spawned_unproven" | "absence_proven";

interface PrivatePlanState {
  approvalToken: string;
  taskId: string;
  executionId: string;
  planHash: string;
  expiresAtMs: number;
  consumed: boolean;
}

interface PrivateCompletedRun {
  plan: AebRetainedAeRuntimePlan;
  approval: AebRetainedAeApproval;
  result: AebRetainedAeResult;
  process: AebRetainedAeProcessBinding;
  checkpoint: import("./contracts.js").AebRetainedAeFileBinding;
  frame: import("./filesystem.js").AebRetainedAeVerifiedFrame;
  frameBytes: Buffer;
  runRootBinding: import("./filesystem.js").AebRetainedAeRunRootBinding;
  consumed: boolean;
}

interface PrivateRetainedHostCapability {
  planHash: string;
  receiptHash: string;
  consumed: boolean;
}

const privatePlans = new WeakMap<AebRetainedAeRuntimePlan, PrivatePlanState>();
const privateCompletedRuns = new WeakMap<AebRetainedAeRuntimeEvidence, PrivateCompletedRun>();
const retainedHostCapabilities = new WeakMap<AebAeBakeHostResult, PrivateRetainedHostCapability>();
const retainedHasher = new Sha256ResourceHasher();

export const AEB_RETAINED_AE_BAKE_HOST_DESCRIPTOR: AebAeBakeHostDescriptor = Object.freeze({
  applicationId: "com.adobe.AfterEffects.application",
  version: AEB_RETAINED_AE_EXPECTED_HOST.version,
  build: AEB_RETAINED_AE_EXPECTED_HOST.build,
  executableHash: AEB_RETAINED_AE_EXPECTED_HOST.executableSha256,
  scriptExecutableHash: AEB_RETAINED_AE_EXPECTED_HOST.executableSha256,
  producerSourceHash: EXPECTED_JSX_SHA256
});

export class NodeAebRetainedAeRuntimeDiscriminator {
  async plan(input: AebRetainedAePlanInput): Promise<AebRetainedAeRuntimePlan> {
    return createPrivateRuntimePlan(input, { kind: "discriminator_only" });
  }

  async run(plan: AebRetainedAeRuntimePlan, signal: AbortSignal): Promise<AebRetainedAeRuntimeEvidence> {
    validateRuntimePlan(plan);
    const privateState = privatePlans.get(plan);
    if (!privateState
      || privateState.consumed
      || privateState.taskId !== plan.taskId
      || privateState.executionId !== plan.executionId
      || privateState.planHash !== plan.planHash
      || privateState.expiresAtMs !== plan.expiresAtMs) {
      fail(
        privateState?.consumed ? "APPROVAL_TOKEN_REPLAYED" : "DISCRIMINATOR_PLAN_CAPABILITY_REQUIRED",
        "The retained AE runtime plan is stale, cloned, synthetic, or already consumed."
      );
    }
    privateState.consumed = true;
    if (Date.now() > plan.expiresAtMs || signal.aborted) {
      fail("DISCRIMINATOR_PLAN_EXPIRED", "The retained AE runtime plan expired before launch.");
    }
    await verifyStaticPreflight(plan);
    await assertAebRetainedAeProcessSnapshotFacilityAvailable();

    await ensureApprovedBase();
    const runRootBinding = await createAebRetainedAeRunRoot(AEB_RETAINED_AE_TASK_BASE, plan.runDirectoryName);
    let authority: NodeAebRetainedAeRunAuthority | undefined;
    let child: AebRetainedAeConcreteProcessHandle | undefined;
    let completed = false;
    let processCleanupState: AebRetainedAeProcessCleanupState = "not_started";
    try {
      authority = await NodeAebRetainedAeRunAuthority.open(
        AEB_RETAINED_AE_TASK_BASE,
        plan.runDirectoryName
      );
      const requestRelativePath = "control/request.json";
      const requestPath = path.join(authority.canonicalRoot, ...requestRelativePath.split("/"));
      await authority.writeExclusiveJson(requestRelativePath, {
        schemaVersion: "aeb-retained-ae-jsx-request-v1",
        plan,
        paths: {
          checkpoint: "checkpoint/checkpoint.aep",
          checkpointPublication: "checkpoint/publication.json",
          approval: "control/approval.json",
          result: "result/result.json",
          output: plan.fixture.outputRelativePath
        }
      }, AEB_RETAINED_AE_BUDGETS.maxExchangeBytes);

      child = spawnAebRetainedAeConcreteProcess(authority.canonicalRoot, requestPath, signal);
      processCleanupState = "spawned_unproven";
      const processBinding = await child.processBinding;
      const publicationRead = await waitForJson<AebRetainedAeCheckpointPublication>(
        authority,
        "checkpoint/publication.json",
        AEB_RETAINED_AE_BUDGETS.maxExchangeBytes,
        Math.min(plan.expiresAtMs, plan.createdAtMs + plan.budgets.approvalWaitMs),
        signal
      );
      verifyCheckpointPublication(plan, publicationRead.value);
      const checkpointSeal = await authority.captureCheckpointSeal();
      if (checkpointSeal.publication.identityDigest !== publicationRead.binding.identityDigest) {
        fail("CHECKPOINT_PUBLICATION_CHANGED", "The checkpoint publication changed before approval.");
      }
      const approval = createAebRetainedAeApproval({
        schemaVersion: AEB_RETAINED_AE_APPROVAL_SCHEMA,
        taskId: plan.taskId,
        executionId: plan.executionId,
        planHash: plan.planHash,
        phase: "checkpoint_approved",
        token: privateState.approvalToken,
        tokenSha256: plan.approvalTokenSha256,
        issuedAtMs: Date.now(),
        expiresAtMs: Math.min(plan.expiresAtMs, plan.createdAtMs + plan.budgets.approvalWaitMs),
        process: processBinding,
        checkpoint: checkpointSeal.checkpoint,
        checkpointPublication: checkpointSeal.publication,
        jsxSha256: plan.jsx.sha256,
        composition: publicationRead.value.composition,
        marker: publicationRead.value.marker,
        budgets: AEB_RETAINED_AE_BUDGETS
      });
      const approvalGate = new AebRetainedAeApprovalGate(plan, {
        process: processBinding,
        checkpoint: checkpointSeal.checkpoint,
        checkpointPublication: checkpointSeal.publication,
        composition: publicationRead.value.composition
      });
      if (!approvalGate.consume(approval, approval.issuedAtMs)) {
        fail("APPROVAL_BINDING_INVALID", "The checkpoint approval failed its complete binding check.");
      }
      await authority.writeExclusiveJson(
        "control/approval.json",
        approval,
        AEB_RETAINED_AE_BUDGETS.maxExchangeBytes
      );

      const processOutcome = await child.completion;
      if (processOutcome.exitCode !== 0 || processOutcome.signal !== null) {
        fail("AE_PROCESS_EXIT_ABNORMAL", "The retained AE process did not close normally.");
      }
      await child.reap();
      processCleanupState = "absence_proven";
      await verifyStaticPreflight(plan);
      await authority.verifyCheckpointSeal(checkpointSeal);
      const resultRead = await authority.readBoundedJson<AebRetainedAeResult>(
        "result/result.json",
        AEB_RETAINED_AE_BUDGETS.maxExchangeBytes
      );
      if (!verifyAebRetainedAeResult(plan, approval, resultRead.value)) {
        fail("DISCRIMINATOR_RESULT_INVALID", "The retained AE result failed semantic verification.");
      }
      const frame = await authority.verifyRgbaFrame(plan.fixture.outputRelativePath);
      const frameRead = await authority.readBoundedFile(
        plan.fixture.outputRelativePath,
        plan.budgets.maxEncodedFrameBytes
      );
      if (canonicalJson(frameRead.binding) !== canonicalJson(frame.binding)) {
        fail("OUTPUT_CHANGED_AFTER_VALIDATION", "The retained AE output changed after RGBA validation.");
      }
      if (frame.binding.byteCount > plan.budgets.maxAggregateEncodedBytes
        || frame.decodedRgbaBytes > plan.budgets.maxAggregateDecodedBytes) {
        fail("DISCRIMINATOR_BUDGET_EXCEEDED", "The retained AE result exceeds aggregate budgets.");
      }
      await authority.verifyCheckpointSeal(checkpointSeal);
      const files = await authority.listFiles();
      const expectedFiles = [
        "checkpoint/checkpoint.aep",
        "checkpoint/publication.json",
        plan.fixture.outputRelativePath,
        "result/result.json"
      ].sort();
      const unexpectedResidue = files.filter((file) => !expectedFiles.includes(file));
      if (canonicalJson(files.sort()) !== canonicalJson(expectedFiles) || unexpectedResidue.length > 0) {
        fail("DISCRIMINATOR_RESIDUE_DETECTED", "The retained AE run left unexpected task residue.");
      }
      if (evaluateAebRetainedAeProcessOutcome({
        exitCode: processOutcome.exitCode,
        signal: processOutcome.signal,
        processGroupGone: true,
        resultPublishedAfterCleanup: resultRead.value.rollback.renderQueueItemRemoved
          && resultRead.value.rollback.temporaryItemsRemoved
          && resultRead.value.rollback.projectClosedWithoutSave,
        unexpectedResidue
      }) !== "normal_close") {
        fail("AE_PROCESS_CLOSE_INVALID", "The retained AE process close and cleanup boundary is invalid.");
      }
      const unsignedEvidence = {
        schemaVersion: AEB_RETAINED_AE_EVIDENCE_SCHEMA as typeof AEB_RETAINED_AE_EVIDENCE_SCHEMA,
        mode: "runtime_discriminator_evidence" as const,
        disposition: "feasible" as const,
        taskId: plan.taskId,
        executionId: plan.executionId,
        planHash: plan.planHash,
        retainedAeTransactionObserved: true as const,
        processClosedNormally: true as const,
        actualAeBakeAuthorityMinted: false as const,
        packageAuthorityMinted: false as const,
        adapterAuthorityMinted: false as const,
        checkpoint: checkpointSeal.checkpoint,
        result: resultRead.binding,
        outputs: [frame.binding],
        unexpectedResidue: [] as string[]
      };
      const evidence = { ...unsignedEvidence, evidenceHash: hashCanonical(unsignedEvidence) };
      privateCompletedRuns.set(evidence, {
        plan,
        approval,
        result: resultRead.value,
        process: processBinding,
        checkpoint: checkpointSeal.checkpoint,
        frame,
        frameBytes: frameRead.bytes,
        runRootBinding,
        consumed: false
      });
      completed = true;
      return evidence;
    } catch (error) {
      child?.terminate(toError(error));
      let completionError: unknown;
      if (child) {
        try {
          await child.completion;
        } catch (observedCompletionError) {
          completionError = observedCompletionError;
        }
      }
      if (child) {
        try {
          await child.reap();
          processCleanupState = "absence_proven";
        } catch (reapError) {
          throw reapError;
        }
      }
      if (completionError !== undefined && completionError !== error) throw completionError;
      if (error instanceof AebRetainedAeDiscriminatorError) throw error;
      fail("DISCRIMINATOR_RUNTIME_FAILED", "The retained AE discriminator failed closed.");
    } finally {
      await authority?.close();
      if (!completed && evaluateAebRetainedAeRunRootCleanup(processCleanupState) === "remove") {
        await removeAebRetainedAeRunRoot(
          AEB_RETAINED_AE_TASK_BASE,
          plan.runDirectoryName,
          runRootBinding
        );
      }
    }
    fail("DISCRIMINATOR_RUNTIME_FAILED", "The retained AE discriminator did not produce evidence.");
  }
}

export class NodeAebRetainedAeBakeHostAdapter implements AebAeBakeHostAdapter {
  readonly descriptor = AEB_RETAINED_AE_BAKE_HOST_DESCRIPTOR;

  async render(request: AebAeBakeHostRenderRequest): Promise<AebAeBakeHostResult> {
    const context = createRetainedBakeContext(request.plan, request.rawFrameFileNames);
    const runtimePlan = await createPrivateRuntimePlan({
      taskId: request.plan.job.task.taskId,
      executionId: request.plan.executionId
    }, context);
    const runtime = new NodeAebRetainedAeRuntimeDiscriminator();
    const evidence = await runtime.run(runtimePlan, request.signal);
    const completed = privateCompletedRuns.get(evidence);
    let rawFrame: { path: string; device: bigint; inode: bigint } | undefined;
    let runRootRemoved = false;
    try {
      if (!completed
        || completed.consumed
        || completed.plan !== runtimePlan
        || completed.plan.authorityContext.kind !== "f2_bake"
        || completed.plan.authorityContext.bakePlanHash !== request.plan.planHash) {
        fail("AE_RETAINED_TRANSACTION_CAPABILITY_REQUIRED", "The retained AE transaction cannot be cloned or rebound.");
      }
      rawFrame = await publishRetainedRawFrame(
        request.rawOutputDirectory,
        request.rawFrameFileNames[0] ?? "",
        completed.frameBytes,
        request.plan.job.budgets.maxEncodedBytes
      );
      request.onProgress({ phase: "rendering", completedFrames: 1, totalFrames: 1 });
      await removeAebRetainedAeRunRoot(
        AEB_RETAINED_AE_TASK_BASE,
        runtimePlan.runDirectoryName,
        completed.runRootBinding
      );
      runRootRemoved = true;

      const receiptWithoutHash: Omit<AebAeRetainedTransactionReceipt, "receiptHash"> = {
        schemaVersion: AEB_AE_RETAINED_TRANSACTION_RECEIPT_SCHEMA_VERSION,
        taskId: request.plan.job.task.taskId,
        executionId: request.plan.executionId,
        planHash: request.plan.planHash,
        runtimePlanHash: runtimePlan.planHash,
        jobId: request.plan.job.jobId,
        packageId: request.plan.job.packageId,
        sourceFingerprint: request.plan.job.source.sourceFingerprint,
        scanDigest: request.plan.job.source.scanDigest,
        plannerDigest: request.plan.job.source.plannerDigest,
        source: {
          projectContentHash: request.plan.sourceFiles.projectContentHash,
          packageContentHash: request.plan.sourceFiles.packageContentHash
        },
        timing: {
          startFrame: request.plan.job.timeRange.startFrame,
          endFrameExclusive: request.plan.job.timeRange.endFrameExclusive,
          fps: request.plan.job.fps
        },
        canvas: { ...request.plan.job.canvas },
        alphaMode: request.plan.job.alphaMode,
        process: {
          pid: completed.process.pid,
          startIdentity: completed.process.startIdentity,
          executableHash: completed.process.executableSha256
        },
        checkpoint: {
          relativePath: completed.checkpoint.relativePath,
          contentHash: completed.checkpoint.sha256,
          encodedBytes: completed.checkpoint.byteCount,
          identityDigest: completed.checkpoint.identityDigest
        },
        approvalHash: completed.approval.approvalHash,
        resultHash: completed.result.resultHash,
        composition: {
          productId: request.plan.composition.id,
          retainedId: completed.result.composition.id,
          name: completed.result.composition.name
        },
        targetLayers: request.plan.composition.targetLayers.map((item) => ({ ...item })),
        controlledFeatures: {
          ...request.plan.controlledFeatures,
          effectMatchNames: [...request.plan.controlledFeatures.effectMatchNames],
          maskModes: [...request.plan.controlledFeatures.maskModes] as ["add", ..."add"[]]
        },
        renderQueue: {
          itemId: completed.result.renderQueue.itemId,
          rqindex: completed.result.renderQueue.rqindex,
          renderStatus: "done"
        },
        output: {
          frames: [{
            frameIndex: request.plan.output.frames[0]!.frameIndex,
            relativePath: request.plan.output.frames[0]!.relativePath,
            contentHash: completed.frame.binding.sha256,
            encodedBytes: completed.frame.binding.byteCount,
            decodedRgbaBytes: completed.frame.decodedRgbaBytes,
            width: completed.frame.width,
            height: completed.frame.height,
            alpha: "mixed"
          }]
        },
        cleanup: {
          renderQueueItemRemoved: true,
          temporaryItemsRemoved: true,
          projectClosedWithoutSave: true,
          appOpenCountAfterCheckpoint: 0,
          approvalConsumedOnce: true,
          processClosedNormally: true,
          processGroupAbsenceProven: true,
          runRootRemoved: true,
          unexpectedResidue: []
        }
      };
      const receipt: AebAeRetainedTransactionReceipt = {
        ...receiptWithoutHash,
        receiptHash: await hashAebCanonical(retainedHasher, receiptWithoutHash)
      };
      const result: AebAeBakeHostResult = {
        host: { ...this.descriptor },
        processStarted: true,
        completed: true,
        exitCode: 0,
        cancelled: false,
        timedOut: false,
        temporaryRenderItemsConfinedToScratch: true,
        scanReceipt: receipt,
        executionEvidence: await createAebAeRetainedHostExecutionEvidence(request.plan, receipt, retainedHasher)
      };
      retainedHostCapabilities.set(result, {
        planHash: request.plan.planHash,
        receiptHash: receipt.receiptHash,
        consumed: false
      });
      completed.consumed = true;
      return result;
    } catch (error) {
      let cleanupFailure: unknown;
      if (rawFrame) {
        try {
          await removeRetainedRawFrame(rawFrame);
        } catch (cleanupError) {
          cleanupFailure = cleanupError;
        }
      }
      if (completed && !runRootRemoved) {
        try {
          await removeAebRetainedAeRunRoot(
            AEB_RETAINED_AE_TASK_BASE,
            runtimePlan.runDirectoryName,
            completed.runRootBinding
          );
          runRootRemoved = true;
        } catch (cleanupError) {
          cleanupFailure ??= cleanupError;
        }
      }
      if (cleanupFailure !== undefined) throw cleanupFailure;
      throw error;
    }
  }
}

export function consumeAebRetainedAeTransactionCapability(
  result: AebAeBakeHostResult,
  plan: AebAeBakeExecutionPlan
): boolean {
  const capability = retainedHostCapabilities.get(result);
  if (!capability
    || capability.consumed
    || capability.planHash !== plan.planHash
    || result.scanReceipt.schemaVersion !== AEB_AE_RETAINED_TRANSACTION_RECEIPT_SCHEMA_VERSION
    || capability.receiptHash !== result.scanReceipt.receiptHash) {
    return false;
  }
  capability.consumed = true;
  return true;
}

async function createPrivateRuntimePlan(
  input: AebRetainedAePlanInput,
  authorityContext: import("./contracts.js").AebRetainedAeAuthorityContext
): Promise<AebRetainedAeRuntimePlan> {
  const jsx = await readFixedBoundedFile(fixedJsxPath(), MAX_JSX_BYTES, "JSX_SOURCE_INVALID", false);
  const jsxSha256 = sha256(jsx.bytes);
  if (jsxSha256 !== EXPECTED_JSX_SHA256) {
    fail("JSX_SOURCE_HASH_MISMATCH", "The retained AE JSX source does not match the reviewed transaction source.");
  }
  const approvalToken = randomBytes(32).toString("base64url");
  const plan = deepFreeze(createAebRetainedAeRuntimePlan(
    input,
    jsxSha256,
    sha256(approvalToken),
    Date.now(),
    authorityContext
  ));
  privatePlans.set(plan, {
    approvalToken,
    taskId: plan.taskId,
    executionId: plan.executionId,
    planHash: plan.planHash,
    expiresAtMs: plan.expiresAtMs,
    consumed: false
  });
  return plan;
}

function createRetainedBakeContext(
  plan: AebAeBakeExecutionPlan,
  rawFrameFileNames: readonly string[]
): AebRetainedAeBakeAuthorityContext {
  const frame = plan.output.frames[0];
  if (canonicalJson(plan.host) !== canonicalJson(AEB_RETAINED_AE_BAKE_HOST_DESCRIPTOR)
    || plan.composition.name !== "AEB3_F2_S1_RETAINED_FIXTURE"
    || plan.job.canvas.width !== 4
    || plan.job.canvas.height !== 4
    || plan.job.fps !== 1
    || plan.job.timeRange.endFrameExclusive !== plan.job.timeRange.startFrame + 1
    || plan.output.frames.length !== 1
    || rawFrameFileNames.length !== 1
    || !frame
    || rawFrameFileNames[0] !== path.posix.basename(frame.relativePath)
    || canonicalJson(plan.controlledFeatures) !== canonicalJson({
      twoDOnly: true,
      precompDepth: 1,
      effectMatchNames: ["ADBE Fill"],
      maskModes: ["add"],
      expressionCount: 1,
      expressionSampling: "ae_rasterized",
      audio: false,
      threeD: false,
      camera: false,
      thirdPartyPlugins: false,
      unknownHostCapabilities: false
    })) {
    fail("AE_RETAINED_BAKE_SLICE_UNSUPPORTED", "The retained AE Bake source slice is outside the reviewed controlled fixture contract.");
  }
  return {
    kind: "f2_bake",
    sourceMode: "task_owned_controlled_fixture",
    bakePlanHash: plan.planHash,
    jobId: plan.job.jobId,
    packageId: plan.job.packageId,
    sourceFingerprint: plan.job.source.sourceFingerprint,
    scanDigest: plan.job.source.scanDigest,
    plannerDigest: plan.job.source.plannerDigest,
    sourceProjectContentHash: plan.sourceFiles.projectContentHash,
    sourcePackageContentHash: plan.sourceFiles.packageContentHash,
    composition: { id: plan.composition.id, name: plan.composition.name },
    targetLayerIds: plan.composition.targetLayers.map((item) => item.layerId).sort(),
    timeRange: { ...plan.job.timeRange },
    fps: 1,
    canvas: { width: 4, height: 4 },
    alphaMode: "straight",
    frame: { frameIndex: frame.frameIndex, relativePath: frame.relativePath }
  };
}

async function publishRetainedRawFrame(
  directory: string,
  fileName: string,
  bytes: Uint8Array,
  maxBytes: number
): Promise<{ path: string; device: bigint; inode: bigint }> {
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/.test(fileName)
    || bytes.byteLength <= 0
    || bytes.byteLength > maxBytes) {
    fail("AE_RETAINED_RAW_FRAME_INVALID", "The retained AE raw frame publication is invalid.");
  }
  const canonicalDirectory = await realpath(directory).catch(() => "");
  const parentBefore = await lstat(directory, { bigint: true }).catch(() => undefined);
  if (!parentBefore?.isDirectory()
    || parentBefore.isSymbolicLink()
    || canonicalDirectory !== path.resolve(directory)) {
    fail("AE_RETAINED_RAW_DIRECTORY_INVALID", "The retained AE raw frame directory is not canonical.");
  }
  const target = path.join(canonicalDirectory, fileName);
  const temporary = path.join(canonicalDirectory, `.retained-${randomBytes(12).toString("hex")}.tmp`);
  let handle: FileHandle | undefined;
  let published = false;
  try {
    handle = await open(temporary, constants.O_CREAT | constants.O_EXCL | constants.O_WRONLY | constants.O_NOFOLLOW, 0o600);
    await handle.writeFile(bytes);
    await handle.sync();
    await handle.close();
    handle = undefined;
    await link(temporary, target);
    published = true;
    await unlink(temporary);
    const targetIdentity = await lstat(target, { bigint: true });
    const parentAfter = await lstat(canonicalDirectory, { bigint: true });
    if (!targetIdentity.isFile()
      || targetIdentity.isSymbolicLink()
      || targetIdentity.nlink !== 1n
      || targetIdentity.size !== BigInt(bytes.byteLength)
      || parentAfter.dev !== parentBefore.dev
      || parentAfter.ino !== parentBefore.ino) {
      fail("AE_RETAINED_RAW_FRAME_CHANGED", "The retained AE raw frame publication changed identity.");
    }
    return { path: target, device: targetIdentity.dev, inode: targetIdentity.ino };
  } catch (error) {
    await unlink(temporary).catch(() => undefined);
    if (published) await unlink(target).catch(() => undefined);
    throw error;
  } finally {
    await handle?.close();
  }
}

async function removeRetainedRawFrame(frame: { path: string; device: bigint; inode: bigint }): Promise<void> {
  const current = await lstat(frame.path, { bigint: true });
  if (!current.isFile()
    || current.isSymbolicLink()
    || current.nlink !== 1n
    || current.dev !== frame.device
    || current.ino !== frame.inode) {
    fail("AE_RETAINED_RAW_FRAME_ROLLBACK_FAILED", "The retained AE raw frame changed before rollback.");
  }
  await unlink(frame.path);
}

export function evaluateAebRetainedAeObservedHost(input: {
  executablePath: string;
  executableSha256: string;
  bundleId: string;
  version: string;
  build: string;
  teamId: string;
  cdHash: string;
  codeResourcesSha256: string;
}): "matches_fixed_ae26_3" | "rejected" {
  return canonicalJson(input) === canonicalJson({
    executablePath: AEB_RETAINED_AE_EXPECTED_HOST.executablePath,
    executableSha256: AEB_RETAINED_AE_EXPECTED_HOST.executableSha256,
    bundleId: AEB_RETAINED_AE_EXPECTED_HOST.bundleId,
    version: AEB_RETAINED_AE_EXPECTED_HOST.version,
    build: AEB_RETAINED_AE_EXPECTED_HOST.build,
    teamId: AEB_RETAINED_AE_EXPECTED_HOST.teamId,
    cdHash: AEB_RETAINED_AE_EXPECTED_HOST.cdHash,
    codeResourcesSha256: AEB_RETAINED_AE_EXPECTED_HOST.codeResourcesSha256
  }) ? "matches_fixed_ae26_3" : "rejected";
}

export function evaluateAebRetainedAeProcessOutcome(input: {
  exitCode: number | null;
  signal: NodeJS.Signals | null;
  processGroupGone: boolean;
  resultPublishedAfterCleanup: boolean;
  unexpectedResidue: readonly string[];
}): "normal_close" | "rejected" {
  return input.exitCode === 0
    && input.signal === null
    && input.processGroupGone === true
    && input.resultPublishedAfterCleanup === true
    && input.unexpectedResidue.length === 0
    ? "normal_close"
    : "rejected";
}

export function evaluateAebRetainedAeRunRootCleanup(
  processState: AebRetainedAeProcessCleanupState
): "remove" | "preserve" {
  return processState === "not_started" || processState === "absence_proven"
    ? "remove"
    : "preserve";
}

async function verifyStaticPreflight(plan: AebRetainedAeRuntimePlan): Promise<void> {
  validateRuntimePlan(plan);
  if (plan.budgets.maxFrames !== 1
    || plan.budgets.maxDecodedRgbaBytes !== 64
    || plan.budgets.maxAggregateDecodedBytes !== 64
    || plan.budgets.maxFrames * plan.budgets.maxEncodedFrameBytes > plan.budgets.maxAggregateEncodedBytes
    || plan.budgets.maxFrames * plan.budgets.maxDecodedRgbaBytes > plan.budgets.maxAggregateDecodedBytes
    || plan.fixture.width * plan.fixture.height * 4 > plan.budgets.maxAggregateDecodedBytes) {
    fail("DISCRIMINATOR_BUDGET_INVALID", "The retained AE aggregate budget is invalid.");
  }
  const jsx = await readFixedBoundedFile(fixedJsxPath(), MAX_JSX_BYTES, "JSX_SOURCE_INVALID", false);
  if (sha256(jsx.bytes) !== EXPECTED_JSX_SHA256 || plan.jsx.sha256 !== EXPECTED_JSX_SHA256) {
    fail("JSX_SOURCE_HASH_MISMATCH", "The retained AE JSX source is not the reviewed source.");
  }
  const executable = await readFixedBoundedFile(
    AEB_RETAINED_AE_EXPECTED_HOST.executablePath,
    MAX_EXECUTABLE_BYTES,
    "AE_EXECUTABLE_INVALID",
    true
  );
  if (sha256(executable.bytes) !== AEB_RETAINED_AE_EXPECTED_HOST.executableSha256) {
    fail("AE_EXECUTABLE_HASH_MISMATCH", "The installed AE executable does not match the fixed authority.");
  }
  const codeResources = await readFixedBoundedFile(
    path.join(AEB_RETAINED_AE_EXPECTED_HOST.bundlePath, "Contents/_CodeSignature/CodeResources"),
    MAX_CODE_RESOURCES_BYTES,
    "AE_CODE_RESOURCES_INVALID",
    true
  );
  if (sha256(codeResources.bytes) !== AEB_RETAINED_AE_EXPECTED_HOST.codeResourcesSha256) {
    fail("AE_CODE_RESOURCES_HASH_MISMATCH", "The installed AE resource seal does not match the fixed authority.");
  }
  const infoPlist = path.join(AEB_RETAINED_AE_EXPECTED_HOST.bundlePath, "Contents/Info.plist");
  const [bundleId, version, build] = await Promise.all([
    readPlistValue(infoPlist, "CFBundleIdentifier"),
    readPlistValue(infoPlist, "CFBundleShortVersionString"),
    readPlistValue(infoPlist, "CFBundleVersion")
  ]);
  if (bundleId !== AEB_RETAINED_AE_EXPECTED_HOST.bundleId
    || version !== AEB_RETAINED_AE_EXPECTED_HOST.version
    || build !== AEB_RETAINED_AE_EXPECTED_HOST.build) {
    fail("AE_BUNDLE_IDENTITY_MISMATCH", "The installed AE bundle identity does not match the fixed authority.");
  }
  await execFileAsync("/usr/bin/codesign", ["--verify", "--deep", "--strict", AEB_RETAINED_AE_EXPECTED_HOST.bundlePath], {
    maxBuffer: MAX_CHILD_OUTPUT_BYTES
  });
  const signature = await execFileAsync("/usr/bin/codesign", ["-dv", "--verbose=4", AEB_RETAINED_AE_EXPECTED_HOST.executablePath], {
    maxBuffer: MAX_CHILD_OUTPUT_BYTES
  });
  const signatureText = `${signature.stdout}\n${signature.stderr}`;
  if (!signatureText.includes(`TeamIdentifier=${AEB_RETAINED_AE_EXPECTED_HOST.teamId}`)
    || !signatureText.includes(`CDHash=${AEB_RETAINED_AE_EXPECTED_HOST.cdHash}`)) {
    fail("AE_CODE_SIGNATURE_MISMATCH", "The installed AE code signature does not match the fixed authority.");
  }
}

function verifyCheckpointPublication(
  plan: AebRetainedAeRuntimePlan,
  publication: AebRetainedAeCheckpointPublication
): void {
  const keys = Object.keys(publication).sort();
  const expected = [
    "schemaVersion", "taskId", "executionId", "planHash", "phase", "marker", "composition",
    "checkpointRelativePath", "checkpointSaveCompleted", "appOpenCountAfterCheckpoint", "authorityContext", "publicationHash"
  ].sort();
  if (canonicalJson(keys) !== canonicalJson(expected)
    || publication.schemaVersion !== AEB_RETAINED_AE_CHECKPOINT_SCHEMA
    || publication.phase !== "checkpoint_published"
    || publication.publicationHash !== hashCanonical(withoutKey(publication, "publicationHash"))
    || publication.taskId !== plan.taskId
    || publication.executionId !== plan.executionId
    || publication.planHash !== plan.planHash
    || publication.marker !== plan.fixture.marker
    || canonicalJson(publication.authorityContext) !== canonicalJson(plan.authorityContext)
    || publication.composition.name !== plan.fixture.compositionName
    || !/^[1-9][0-9]*$/.test(publication.composition.id)
    || publication.checkpointRelativePath !== "checkpoint/checkpoint.aep"
    || publication.checkpointSaveCompleted !== true
    || publication.appOpenCountAfterCheckpoint !== 0) {
    fail("CHECKPOINT_PUBLICATION_INVALID", "The retained AE checkpoint publication is invalid.");
  }
}

async function waitForJson<T>(
  authority: NodeAebRetainedAeRunAuthority,
  relativePath: string,
  maxBytes: number,
  expiresAtMs: number,
  signal: AbortSignal
): Promise<{ value: T; binding: import("./contracts.js").AebRetainedAeFileBinding }> {
  while (Date.now() <= expiresAtMs && !signal.aborted) {
    try {
      return await authority.readBoundedJson<T>(relativePath, maxBytes);
    } catch (error) {
      if (!(error instanceof AebRetainedAeDiscriminatorError) || error.code !== "TASK_FILE_MISSING") throw error;
    }
    await delay(25, undefined, { signal }).catch(() => undefined);
  }
  fail(signal.aborted ? "DISCRIMINATOR_CANCELLED" : "CHECKPOINT_WAIT_TIMEOUT", "The retained AE checkpoint wait ended without approval input.");
}

async function ensureApprovedBase(): Promise<void> {
  try {
    await mkdir(AEB_RETAINED_AE_TASK_BASE, { mode: 0o700 });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "EEXIST") {
      fail("TASK_BASE_CREATE_FAILED", "The fixed retained AE task base could not be created.");
    }
  }
  const metadata = await lstat(AEB_RETAINED_AE_TASK_BASE, { bigint: true });
  const uid = typeof process.getuid === "function" ? BigInt(process.getuid()) : metadata.uid;
  if (!metadata.isDirectory()
    || metadata.isSymbolicLink()
    || metadata.uid !== uid
    || (metadata.mode & 0o777n) !== 0o700n
    || await realpath(AEB_RETAINED_AE_TASK_BASE) !== AEB_RETAINED_AE_TASK_BASE) {
    fail("TASK_BASE_INVALID", "The fixed retained AE task base is not canonical, owned, and mode 0700.");
  }
}

async function readFixedBoundedFile(
  filePath: string,
  maxBytes: number,
  code: string,
  requireRootOwner: boolean
): Promise<{ bytes: Buffer; identity: BigIntStats }> {
  const canonical = await realpath(filePath).catch(() => fail(code, "The fixed retained AE source is unavailable."));
  const pathBefore = await lstat(filePath, { bigint: true }).catch(() => fail(code, "The fixed retained AE source is unavailable."));
  if (canonical !== filePath
    || !pathBefore.isFile()
    || pathBefore.isSymbolicLink()
    || pathBefore.nlink !== 1n
    || (requireRootOwner && pathBefore.uid !== 0n)
    || pathBefore.size <= 0n
    || pathBefore.size > BigInt(maxBytes)) {
    fail(code, "The fixed retained AE source identity is invalid.");
  }
  let handle: FileHandle | undefined;
  try {
    handle = await open(filePath, constants.O_RDONLY | constants.O_NOFOLLOW);
    const openedBefore = await handle.stat({ bigint: true });
    if (openedBefore.dev !== pathBefore.dev || openedBefore.ino !== pathBefore.ino) {
      fail(code, "The fixed retained AE source changed before read.");
    }
    const bytes = await readCapPlusOne(handle, maxBytes);
    const openedAfter = await handle.stat({ bigint: true });
    const pathAfter = await lstat(filePath, { bigint: true });
    if (bytes.byteLength > maxBytes
      || !sameStableFile(openedBefore, openedAfter)
      || !sameStableFile(openedAfter, pathAfter)) {
      fail(code, "The fixed retained AE source changed during read.");
    }
    return { bytes, identity: openedAfter };
  } finally {
    await handle?.close();
  }
}

async function readCapPlusOne(handle: FileHandle, cap: number): Promise<Buffer> {
  const buffer = Buffer.alloc(cap + 1);
  let offset = 0;
  while (offset < buffer.length) {
    const { bytesRead } = await handle.read(buffer, offset, buffer.length - offset, null);
    if (bytesRead === 0) break;
    offset += bytesRead;
  }
  return buffer.subarray(0, offset);
}

function sameStableFile(left: BigIntStats, right: BigIntStats): boolean {
  return left.dev === right.dev
    && left.ino === right.ino
    && left.size === right.size
    && left.mtimeNs === right.mtimeNs
    && left.ctimeNs === right.ctimeNs
    && left.nlink === 1n
    && right.nlink === 1n;
}

async function readPlistValue(infoPlist: string, key: string): Promise<string> {
  const result = await execFileAsync("/usr/bin/plutil", ["-extract", key, "raw", "-o", "-", infoPlist], {
    maxBuffer: MAX_CHILD_OUTPUT_BYTES
  });
  return result.stdout.trim();
}

function fixedJsxPath(): string {
  return path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    "../../../tools/aeb/f2/aeb-retained-ae-discriminator.jsx"
  );
}

function withoutKey<T extends object, K extends keyof T>(value: T, key: K): Omit<T, K> {
  const copy = { ...value };
  delete copy[key];
  return copy;
}

function deepFreeze<T>(value: T): T {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    for (const child of Object.values(value as Record<string, unknown>)) deepFreeze(child);
    Object.freeze(value);
  }
  return value;
}

function toError(error: unknown): Error {
  return error instanceof Error ? error : new Error("retained-ae-discriminator-failed");
}

function fail(code: string, message: string): never {
  throw new AebRetainedAeDiscriminatorError(code, message);
}
