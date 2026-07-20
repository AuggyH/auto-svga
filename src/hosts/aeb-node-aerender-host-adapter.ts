import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { constants } from "node:fs";
import { lstat, open, realpath, type FileHandle } from "node:fs/promises";
import path from "node:path";
import type { EmbeddedResourceHasher } from "../workbench/resource-hasher.js";
import {
  type AebAeBakeHostAdapter,
  type AebAeBakeHostDescriptor,
  type AebAeBakeHostRenderRequest,
  type AebAeBakeHostResult,
  type AebAeControlledScanOutput,
  type AebAeScratchProjectBinding,
  createAebAeControlledScanReceipt,
  createAebAeHostExecutionEvidence,
  createAebAeScannerInvocationContract,
  createAebAeScratchProjectPathDigest,
  sameAebAeScratchProjectObject
} from "../workbench/aeb-ae-bake-execution.js";
import { AebBakePipelineError } from "../workbench/aeb-bake-pipeline.js";

const MAX_EXECUTABLE_BYTES = 256 * 1024 * 1024;
const MAX_PRODUCER_SOURCE_BYTES = 1024 * 1024;
const MAX_SCANNER_EXCHANGE_BYTES = 512 * 1024;
const MAX_STDOUT_LINE_BYTES = 64 * 1024;
const TERMINATION_GRACE_MS = 200;
const SCAN_REQUEST_ENV = "AUTO_SVGA_AEB_F2_SCAN_REQUEST";
const SCAN_RESULT_ENV = "AUTO_SVGA_AEB_F2_SCAN_RESULT";
const ALLOWED_CHILD_ENVIRONMENT_KEYS = new Set([
  "HOME", "LANG", "LC_ALL", "PATH", "TEMP", "TMP", "TMPDIR",
  SCAN_REQUEST_ENV, SCAN_RESULT_ENV
]);
const CONCRETE_CHILD_ENVIRONMENT: Readonly<Record<string, string>> = {
  PATH: "/usr/bin:/bin:/usr/sbin:/sbin",
  LANG: "C",
  LC_ALL: "C"
};

export interface AebAeSyntheticProcessRunRequest {
  executablePath: string;
  args: readonly string[];
  cwd: string;
  environment: Readonly<Record<string, string>>;
  signal: AbortSignal;
  onStdoutLine(line: string): void;
}

export interface AebAeSyntheticProcessRunResult {
  started: true;
  exitCode: number | null;
  signal: NodeJS.Signals | null;
  forcedTermination: boolean;
}

export interface AebAeSyntheticProcessRunner {
  run(request: AebAeSyntheticProcessRunRequest): Promise<AebAeSyntheticProcessRunResult>;
}

export interface NodeAebAeHostPaths {
  renderExecutablePath: string;
  scriptExecutablePath: string;
  producerSourcePath: string;
}

class NodeAebChildProcessRunner implements AebAeSyntheticProcessRunner {
  async run(request: AebAeSyntheticProcessRunRequest): Promise<AebAeSyntheticProcessRunResult> {
    const environment = validateChildEnvironment(request.environment);
    return new Promise((resolve, reject) => {
      const ownsProcessGroup = process.platform !== "win32";
      const child = spawn(request.executablePath, [...request.args], {
        cwd: request.cwd,
        detached: ownsProcessGroup,
        env: environment,
        shell: false,
        stdio: ["ignore", "pipe", "pipe"]
      });
      let forcedTermination = false;
      let lineBuffer = Buffer.alloc(0);
      let terminalError: Error | undefined;
      let escalation: ReturnType<typeof setTimeout> | undefined;
      let settled = false;

      const signalOwned = (signal: NodeJS.Signals): void => {
        if (!child.pid || child.exitCode !== null || child.signalCode !== null) return;
        try {
          if (ownsProcessGroup) process.kill(-child.pid, signal);
          else child.kill(signal);
        } catch {
          // Close and process-group verification decide whether cleanup completed.
        }
      };
      const terminate = (error: unknown): void => {
        if (!terminalError) terminalError = toError(error);
        if (child.exitCode !== null || child.signalCode !== null || escalation) return;
        signalOwned("SIGTERM");
        escalation = setTimeout(() => {
          forcedTermination = true;
          signalOwned("SIGKILL");
        }, TERMINATION_GRACE_MS);
      };
      const abort = () => terminate(new Error("bounded-ae-child-aborted"));
      const deliverLine = (line: Buffer): boolean => {
        if (line.byteLength > MAX_STDOUT_LINE_BYTES) {
          terminate(new Error("bounded-aerender-stdout-line-exceeded"));
          return false;
        }
        try {
          request.onStdoutLine(line.toString("utf8").replace(/\r$/u, ""));
          return true;
        } catch (error) {
          terminate(error);
          return false;
        }
      };

      request.signal.addEventListener("abort", abort, { once: true });
      child.stderr.resume();
      child.stdout.on("data", (chunk: Buffer) => {
        if (terminalError) return;
        lineBuffer = Buffer.concat([lineBuffer, chunk], lineBuffer.length + chunk.length);
        let newline = lineBuffer.indexOf(0x0a);
        while (newline >= 0) {
          const line = lineBuffer.subarray(0, newline);
          lineBuffer = lineBuffer.subarray(newline + 1);
          if (!deliverLine(line)) return;
          newline = lineBuffer.indexOf(0x0a);
        }
        if (lineBuffer.byteLength > MAX_STDOUT_LINE_BYTES) {
          terminate(new Error("bounded-aerender-stdout-line-exceeded"));
        }
      });
      child.once("error", (error) => {
        if (!child.pid) {
          settled = true;
          request.signal.removeEventListener("abort", abort);
          reject(error);
          return;
        }
        terminate(error);
      });
      child.once("close", (exitCode, signal) => {
        void (async () => {
          if (settled) return;
          if (escalation) clearTimeout(escalation);
          request.signal.removeEventListener("abort", abort);
          if (!terminalError && lineBuffer.byteLength > 0) deliverLine(lineBuffer);
          if (ownsProcessGroup && child.pid) {
            await ensureOwnedProcessGroupGone(child.pid, terminalError !== undefined);
          }
          settled = true;
          if (terminalError) reject(terminalError);
          else resolve({ started: true, exitCode, signal, forcedTermination });
        })().catch((error) => {
          settled = true;
          reject(error);
        });
      });
      if (request.signal.aborted) abort();
    });
  }
}

export function runAebAeClosedChildProcessSourceProbe(
  request: AebAeSyntheticProcessRunRequest
): Promise<AebAeSyntheticProcessRunResult> {
  return new NodeAebChildProcessRunner().run(request);
}

export class NodeAebAerenderHostAdapter implements AebAeBakeHostAdapter {
  constructor(
    readonly descriptor: AebAeBakeHostDescriptor,
    private readonly paths: NodeAebAeHostPaths,
    private readonly hasher: EmbeddedResourceHasher
  ) {}

  async render(request: AebAeBakeHostRenderRequest): Promise<AebAeBakeHostResult> {
    const result = await renderWithProcessRunner(
      request,
      this.descriptor,
      this.paths,
      this.hasher,
      new NodeAebChildProcessRunner(),
      CONCRETE_CHILD_ENVIRONMENT
    );
    return result;
  }
}

export class NodeAebSyntheticAerenderHostAdapter implements AebAeBakeHostAdapter {
  constructor(
    readonly descriptor: AebAeBakeHostDescriptor,
    private readonly paths: NodeAebAeHostPaths,
    private readonly hasher: EmbeddedResourceHasher,
    private readonly runner: AebAeSyntheticProcessRunner,
    private readonly environment: Readonly<Record<string, string>> = CONCRETE_CHILD_ENVIRONMENT
  ) {}

  render(request: AebAeBakeHostRenderRequest): Promise<AebAeBakeHostResult> {
    return renderWithProcessRunner(
      request,
      this.descriptor,
      this.paths,
      this.hasher,
      this.runner,
      this.environment
    );
  }
}

async function renderWithProcessRunner(
  request: AebAeBakeHostRenderRequest,
  descriptor: AebAeBakeHostDescriptor,
  paths: NodeAebAeHostPaths,
  hasher: EmbeddedResourceHasher,
  runner: AebAeSyntheticProcessRunner,
  baseEnvironment: Readonly<Record<string, string>>
): Promise<AebAeBakeHostResult> {
  await verifyHostFiles(paths, descriptor);
  const projectAuthority = await ScratchProjectAuthority.open(request, hasher);
  try {
    const scratchProjectBefore = await projectAuthority.captureInitial();
    const workDirectory = path.dirname(request.rawOutputDirectory);
    const scanRequestPath = path.join(workDirectory, `scan-request-${request.plan.executionId}.json`);
    const scanResultPath = path.join(workDirectory, `scan-result-${request.plan.executionId}.json`);
    const scanContract = createAebAeScannerInvocationContract(request.plan, scratchProjectBefore);
    await writeExclusiveBoundedFile(scanRequestPath, Buffer.from(canonicalJson({
      ...scanContract,
      scratchProjectPath: request.scratchProjectPath,
      plan: request.plan
    })), MAX_SCANNER_EXCHANGE_BYTES);

    const scannerResult = await runner.run({
      executablePath: paths.scriptExecutablePath,
      args: ["-r", path.resolve(paths.producerSourcePath)],
      cwd: workDirectory,
      environment: {
        ...baseEnvironment,
        [SCAN_REQUEST_ENV]: scanRequestPath,
        [SCAN_RESULT_ENV]: scanResultPath
      },
      signal: request.signal,
      onStdoutLine() {
        // The typed result file is the only scanner transcript authority.
      }
    });
    if (request.signal.aborted) {
      fail("AE_EXECUTION_CANCELLED", "AEB AE scanner process was cancelled or timed out.");
    }
    requireNormalProcess(scannerResult, "AE_SCANNER_EXECUTION_FAILED");
    await verifyHostFiles(paths, descriptor);
    const scanOutput = await readBoundedJson<AebAeControlledScanOutput>(scanResultPath, MAX_SCANNER_EXCHANGE_BYTES);
    const scratchProjectAfter = await projectAuthority.captureAfterScan(scratchProjectBefore);
    const scanReceipt = await createAebAeControlledScanReceipt(
      request.plan,
      scanOutput,
      scratchProjectAfter,
      hasher
    );
    await projectAuthority.verifyExact(scanReceipt.scratchProjectAfter, "AE_SCRATCH_PROJECT_PRE_RENDER_CHANGED");

    const outputPattern = path.join(request.rawOutputDirectory, "frame_[######].png");
    let completedFrames = 0;
    const renderResult = await runner.run({
      executablePath: paths.renderExecutablePath,
      cwd: request.rawOutputDirectory,
      environment: baseEnvironment,
      signal: request.signal,
      args: [
        "-project", request.scratchProjectPath,
        "-rqindex", String(scanReceipt.renderQueueIndex),
        "-s", String(request.plan.job.timeRange.startFrame),
        "-e", String(request.plan.job.timeRange.endFrameExclusive - 1),
        "-RStemplate", request.plan.render.renderSettingsTemplate,
        "-OMtemplate", request.plan.render.outputModuleTemplate,
        "-output", outputPattern,
        "-close", "DO_NOT_SAVE_CHANGES"
      ],
      onStdoutLine(line) {
        if (!line.includes("PROGRESS:")) return;
        const next = Math.min(request.rawFrameFileNames.length, completedFrames + 1);
        if (next === completedFrames) return;
        completedFrames = next;
        request.onProgress({
          phase: "rendering",
          completedFrames,
          totalFrames: request.rawFrameFileNames.length
        });
      }
    });
    await projectAuthority.verifyExact(scanReceipt.scratchProjectAfter, "AE_SCRATCH_PROJECT_POST_RENDER_CHANGED");
    await verifyHostFiles(paths, descriptor);
    if (request.signal.aborted) {
      fail("AE_EXECUTION_CANCELLED", "AEB aerender process was cancelled or timed out.");
    }
    requireNormalProcess(renderResult, "AE_HOST_EXECUTION_FAILED");
    if (completedFrames < request.rawFrameFileNames.length) {
      request.onProgress({
        phase: "rendering",
        completedFrames: request.rawFrameFileNames.length,
        totalFrames: request.rawFrameFileNames.length
      });
    }
    return {
      host: { ...descriptor },
      processStarted: true,
      completed: true,
      exitCode: 0,
      cancelled: false,
      timedOut: false,
      temporaryRenderItemsConfinedToScratch: true,
      scanReceipt,
      executionEvidence: await createAebAeHostExecutionEvidence(request.plan, scanReceipt, hasher)
    };
  } finally {
    await projectAuthority.close();
  }
}

async function verifyHostFiles(paths: NodeAebAeHostPaths, descriptor: AebAeBakeHostDescriptor): Promise<void> {
  await verifyBoundedFile(paths.renderExecutablePath, descriptor.executableHash, MAX_EXECUTABLE_BYTES, "AE_EXECUTABLE");
  await verifyBoundedFile(paths.scriptExecutablePath, descriptor.scriptExecutableHash, MAX_EXECUTABLE_BYTES, "AE_SCRIPT_EXECUTABLE");
  await verifyBoundedFile(paths.producerSourcePath, descriptor.producerSourceHash, MAX_PRODUCER_SOURCE_BYTES, "AE_PRODUCER_SOURCE");
}

class ScratchProjectAuthority {
  private constructor(
    private readonly request: AebAeBakeHostRenderRequest,
    private readonly hasher: EmbeddedResourceHasher,
    private readonly handle: FileHandle,
    private readonly openedDevice: bigint,
    private readonly openedInode: bigint,
    private readonly taskRootDevice: bigint,
    private readonly taskRootInode: bigint,
    private readonly parentDevice: bigint,
    private readonly parentInode: bigint
  ) {}

  static async open(
    request: AebAeBakeHostRenderRequest,
    hasher: EmbeddedResourceHasher
  ): Promise<ScratchProjectAuthority> {
    let handle: FileHandle | undefined;
    try {
      const taskRootPath = path.resolve(request.taskRootPath);
      const scratchProjectPath = path.resolve(request.scratchProjectPath);
      const expectedRelativePath = `${request.plan.output.workDirectory}/scratch-project.aep`;
      const expectedScratchPath = path.resolve(taskRootPath, request.scratchProjectRelativePath);
      if (request.scratchProjectRelativePath !== expectedRelativePath
        || path.basename(taskRootPath) !== request.plan.taskRootName
        || expectedScratchPath !== scratchProjectPath
        || await realpath(taskRootPath) !== taskRootPath
        || await realpath(scratchProjectPath) !== scratchProjectPath) {
        fail("AE_SCRATCH_PROJECT_PATH_INVALID", "AEB AE scratch project is outside the approved task root relationship.");
      }
      const taskRoot = await lstat(taskRootPath, { bigint: true });
      const parent = await lstat(path.dirname(scratchProjectPath), { bigint: true });
      const before = await lstat(scratchProjectPath, { bigint: true });
      if (!taskRoot.isDirectory() || taskRoot.isSymbolicLink()
        || !parent.isDirectory() || parent.isSymbolicLink()
        || !before.isFile() || before.isSymbolicLink() || before.nlink !== 1n
        || before.size <= 0n || before.size > BigInt(request.plan.sourceFiles.projectMaxBytes)) {
        fail("AE_SCRATCH_PROJECT_AUTHORITY_INVALID", "AEB AE scratch project identity is invalid.");
      }
      handle = await open(scratchProjectPath, constants.O_RDONLY | constants.O_NOFOLLOW);
      const opened = await handle.stat({ bigint: true });
      if (opened.dev !== before.dev || opened.ino !== before.ino || opened.nlink !== 1n) {
        fail("AE_SCRATCH_PROJECT_AUTHORITY_CHANGED", "AEB AE scratch project changed before descriptor binding.");
      }
      return new ScratchProjectAuthority(
        request,
        hasher,
        handle,
        opened.dev,
        opened.ino,
        taskRoot.dev,
        taskRoot.ino,
        parent.dev,
        parent.ino
      );
    } catch (error) {
      if (handle) await handle.close();
      if (error instanceof AebBakePipelineError) throw error;
      fail("AE_SCRATCH_PROJECT_AUTHORITY_INVALID", "AEB AE scratch project could not be bound safely.");
    }
  }

  async captureInitial(): Promise<AebAeScratchProjectBinding> {
    const binding = await this.capture();
    if (binding.contentHash !== this.request.plan.sourceFiles.projectContentHash) {
      fail("AE_SCRATCH_PROJECT_SOURCE_MISMATCH", "AEB AE scratch project does not match the approved source project bytes.");
    }
    return binding;
  }

  async captureAfterScan(before: AebAeScratchProjectBinding): Promise<AebAeScratchProjectBinding> {
    const after = await this.capture();
    if (!sameAebAeScratchProjectObject(before, after)) {
      fail("AE_SCRATCH_PROJECT_SCAN_REPLACED", "AEB AE scanner did not preserve the approved scratch project object.");
    }
    return after;
  }

  async verifyExact(expected: AebAeScratchProjectBinding, code: string): Promise<void> {
    const current = await this.capture();
    if (canonicalJson(current) !== canonicalJson(expected)) {
      fail(code, "AEB AE renderer scratch project no longer matches the scanned project authority.");
    }
  }

  async close(): Promise<void> {
    await this.handle.close();
  }

  private async capture(): Promise<AebAeScratchProjectBinding> {
    const scratchProjectPath = path.resolve(this.request.scratchProjectPath);
    const taskRootPath = path.resolve(this.request.taskRootPath);
    const parentPath = path.dirname(scratchProjectPath);
    const before = await this.handle.stat({ bigint: true });
    if (before.dev !== this.openedDevice || before.ino !== this.openedInode
      || before.nlink !== 1n || before.size <= 0n
      || before.size > BigInt(this.request.plan.sourceFiles.projectMaxBytes)) {
      fail("AE_SCRATCH_PROJECT_AUTHORITY_CHANGED", "AEB AE scratch project descriptor identity changed.");
    }
    const bytes = Buffer.alloc(this.request.plan.sourceFiles.projectMaxBytes + 1);
    let offset = 0;
    while (offset <= this.request.plan.sourceFiles.projectMaxBytes) {
      const { bytesRead } = await this.handle.read(
        bytes,
        offset,
        Math.min(64 * 1024, this.request.plan.sourceFiles.projectMaxBytes + 1 - offset),
        offset
      );
      if (bytesRead === 0) break;
      offset += bytesRead;
    }
    const after = await this.handle.stat({ bigint: true });
    const currentPath = await lstat(scratchProjectPath, { bigint: true });
    const taskRoot = await lstat(taskRootPath, { bigint: true });
    const parent = await lstat(parentPath, { bigint: true });
    const finalDescriptor = await this.handle.stat({ bigint: true });
    if (offset !== Number(before.size)
      || after.dev !== before.dev || after.ino !== before.ino || after.size !== before.size
      || after.mtimeNs !== before.mtimeNs || after.ctimeNs !== before.ctimeNs
      || currentPath.dev !== before.dev || currentPath.ino !== before.ino
      || !currentPath.isFile() || currentPath.isSymbolicLink() || currentPath.nlink !== 1n
      || currentPath.size !== after.size
      || currentPath.mtimeNs !== after.mtimeNs || currentPath.ctimeNs !== after.ctimeNs
      || finalDescriptor.dev !== after.dev || finalDescriptor.ino !== after.ino
      || finalDescriptor.nlink !== after.nlink || finalDescriptor.size !== after.size
      || finalDescriptor.mtimeNs !== after.mtimeNs || finalDescriptor.ctimeNs !== after.ctimeNs
      || !taskRoot.isDirectory() || taskRoot.isSymbolicLink()
      || taskRoot.dev !== this.taskRootDevice || taskRoot.ino !== this.taskRootInode
      || !parent.isDirectory() || parent.isSymbolicLink()
      || parent.dev !== this.parentDevice || parent.ino !== this.parentInode) {
      fail("AE_SCRATCH_PROJECT_AUTHORITY_CHANGED", "AEB AE scratch project changed during descriptor verification.");
    }
    const hash = await this.hasher.hash(bytes.subarray(0, offset));
    if (hash.algorithm !== "sha256" || hash.scope !== "encoded_bytes" || !/^[a-f0-9]{64}$/.test(hash.value)) {
      fail("HASHER_CONTRACT_INVALID", "AEB AE scratch project requires encoded-byte SHA-256 authority.");
    }
    return {
      schemaVersion: "aeb-ae-scratch-project-binding-v1",
      taskId: this.request.plan.job.task.taskId,
      taskRootName: this.request.plan.taskRootName,
      relativePath: this.request.scratchProjectRelativePath,
      pathDigest: await createAebAeScratchProjectPathDigest(
        this.request.plan,
        this.request.scratchProjectRelativePath,
        this.hasher
      ),
      contentHash: hash.value,
      encodedBytes: offset,
      identity: {
        device: after.dev.toString(),
        inode: after.ino.toString(),
        linkCount: 1,
        modifiedNs: after.mtimeNs.toString(),
        changedNs: after.ctimeNs.toString(),
        taskRootDevice: taskRoot.dev.toString(),
        taskRootInode: taskRoot.ino.toString(),
        parentDevice: parent.dev.toString(),
        parentInode: parent.ino.toString(),
        parentModifiedNs: parent.mtimeNs.toString(),
        parentChangedNs: parent.ctimeNs.toString()
      }
    };
  }
}

function requireNormalProcess(result: AebAeSyntheticProcessRunResult, code: string): void {
  if (result.exitCode !== 0 || result.signal !== null || result.forcedTermination) {
    fail(code, "AEB AE owned child did not exit and reap normally.");
  }
}

function validateChildEnvironment(input: Readonly<Record<string, string>>): NodeJS.ProcessEnv {
  const output: NodeJS.ProcessEnv = Object.create(null) as NodeJS.ProcessEnv;
  for (const [key, value] of Object.entries(input)) {
    if (!ALLOWED_CHILD_ENVIRONMENT_KEYS.has(key)
      || typeof value !== "string"
      || value.length > 4_096
      || value.includes("\0")
      || value.includes("\n")
      || value.includes("\r")) {
      throw new Error("bounded-ae-child-environment-invalid");
    }
    output[key] = value;
  }
  return output;
}

async function ensureOwnedProcessGroupGone(pid: number, terminationWasRequested: boolean): Promise<void> {
  if (!isProcessGroupAlive(pid)) return;
  if (!terminationWasRequested) {
    try { process.kill(-pid, "SIGTERM"); } catch { /* verified below */ }
    await delay(TERMINATION_GRACE_MS);
  }
  if (isProcessGroupAlive(pid)) {
    try { process.kill(-pid, "SIGKILL"); } catch { /* verified below */ }
  }
  while (isProcessGroupAlive(pid)) await delay(10);
  if (!terminationWasRequested) throw new Error("bounded-ae-owned-process-group-residue");
}

function isProcessGroupAlive(pid: number): boolean {
  try {
    process.kill(-pid, 0);
    return true;
  } catch (error) {
    return (error as NodeJS.ErrnoException).code === "EPERM";
  }
}

async function verifyBoundedFile(filePath: string, expectedHash: string, maxBytes: number, code: string): Promise<void> {
  let handle: FileHandle | undefined;
  try {
    const requested = path.resolve(filePath);
    const before = await lstat(requested, { bigint: true });
    if (!before.isFile() || before.isSymbolicLink() || before.nlink !== 1n
      || before.size <= 0n || before.size > BigInt(maxBytes)
      || await realpath(requested) !== requested) {
      fail(`${code}_AUTHORITY_INVALID`, "Approved AEB AE host file identity is invalid.");
    }
    handle = await open(requested, constants.O_RDONLY | constants.O_NOFOLLOW);
    const opened = await handle.stat({ bigint: true });
    if (opened.dev !== before.dev || opened.ino !== before.ino || opened.size !== before.size) {
      fail(`${code}_AUTHORITY_CHANGED`, "Approved AEB AE host file changed before verification.");
    }
    const digest = createHash("sha256");
    const chunk = Buffer.alloc(64 * 1024);
    let offset = 0;
    while (offset < Number(opened.size)) {
      const { bytesRead } = await handle.read(chunk, 0, Math.min(chunk.length, Number(opened.size) - offset), offset);
      if (bytesRead === 0) break;
      digest.update(chunk.subarray(0, bytesRead));
      offset += bytesRead;
    }
    const after = await handle.stat({ bigint: true });
    const pathAfter = await lstat(requested, { bigint: true });
    if (offset !== Number(opened.size)
      || after.dev !== opened.dev || after.ino !== opened.ino || after.size !== opened.size
      || after.mtimeNs !== opened.mtimeNs || after.ctimeNs !== opened.ctimeNs
      || pathAfter.dev !== opened.dev || pathAfter.ino !== opened.ino || pathAfter.nlink !== 1n
      || digest.digest("hex") !== expectedHash) {
      fail(`${code}_AUTHORITY_CHANGED`, "Approved AEB AE host file failed exact hash and identity verification.");
    }
  } catch (error) {
    if (error instanceof AebBakePipelineError) throw error;
    fail(`${code}_AUTHORITY_INVALID`, "Approved AEB AE host file could not be safely verified.");
  } finally {
    await handle?.close();
  }
}

async function writeExclusiveBoundedFile(filePath: string, bytes: Uint8Array, maxBytes: number): Promise<void> {
  if (bytes.byteLength <= 0 || bytes.byteLength > maxBytes) {
    fail("AE_SCANNER_REQUEST_BUDGET_EXCEEDED", "AEB AE scanner request exceeds its bounded exchange budget.");
  }
  let handle: FileHandle | undefined;
  try {
    const parent = await lstat(path.dirname(filePath));
    if (!parent.isDirectory() || parent.isSymbolicLink()) {
      fail("AE_SCANNER_EXCHANGE_PATH_INVALID", "AEB AE scanner exchange parent is invalid.");
    }
    handle = await open(filePath, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW, 0o600);
    await handle.writeFile(bytes);
    await handle.sync();
    await handle.close();
    handle = undefined;

    const parentAfter = await lstat(path.dirname(filePath));
    const file = await lstat(filePath);
    if (parentAfter.dev !== parent.dev || parentAfter.ino !== parent.ino
      || !file.isFile() || file.isSymbolicLink() || file.nlink !== 1
      || file.size !== bytes.byteLength) {
      fail("AE_SCANNER_EXCHANGE_PATH_CHANGED", "AEB AE scanner request publication identity changed.");
    }
  } catch (error) {
    if (error instanceof AebBakePipelineError) throw error;
    fail("AE_SCANNER_REQUEST_PUBLICATION_FAILED", "AEB AE scanner request could not be published safely.");
  } finally {
    await handle?.close();
  }
}

async function readBoundedJson<T>(filePath: string, maxBytes: number): Promise<T> {
  let handle: FileHandle | undefined;
  try {
    const before = await lstat(filePath, { bigint: true });
    if (!before.isFile() || before.isSymbolicLink() || before.nlink !== 1n || before.size <= 0n || before.size > BigInt(maxBytes)) {
      fail("AE_SCANNER_RESULT_INVALID", "AEB AE scanner result identity or budget is invalid.");
    }
    handle = await open(filePath, constants.O_RDONLY | constants.O_NOFOLLOW);
    const opened = await handle.stat({ bigint: true });
    const buffer = Buffer.alloc(maxBytes + 1);
    let offset = 0;
    while (offset <= maxBytes) {
      const { bytesRead } = await handle.read(buffer, offset, Math.min(64 * 1024, maxBytes + 1 - offset), offset);
      if (bytesRead === 0) break;
      offset += bytesRead;
    }
    const after = await handle.stat({ bigint: true });
    const pathAfter = await lstat(filePath, { bigint: true });
    if (offset <= 0 || offset > maxBytes || opened.dev !== before.dev || opened.ino !== before.ino
      || after.dev !== opened.dev || after.ino !== opened.ino || after.size !== opened.size
      || after.mtimeNs !== opened.mtimeNs || after.ctimeNs !== opened.ctimeNs
      || pathAfter.dev !== opened.dev || pathAfter.ino !== opened.ino || pathAfter.nlink !== 1n) {
      fail("AE_SCANNER_RESULT_CHANGED", "AEB AE scanner result changed during bounded read.");
    }
    return JSON.parse(buffer.subarray(0, offset).toString("utf8")) as T;
  } catch (error) {
    if (error instanceof AebBakePipelineError) throw error;
    return fail("AE_SCANNER_RESULT_INVALID", "AEB AE scanner result is missing or malformed.");
  } finally {
    await handle?.close();
  }
}

function canonicalJson(value: unknown): string {
  return JSON.stringify(sortValue(value));
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

function toError(error: unknown): Error {
  return error instanceof Error ? error : new Error("bounded-ae-child-failed");
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function fail(code: string, message: string): never {
  throw new AebBakePipelineError(code, message);
}
