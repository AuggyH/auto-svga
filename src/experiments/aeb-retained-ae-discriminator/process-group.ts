import { execFile, spawn, type ChildProcess } from "node:child_process";
import { randomBytes } from "node:crypto";
import { once } from "node:events";
import { userInfo } from "node:os";
import path from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import {
  AEB_RETAINED_AE_BUDGETS,
  AEB_RETAINED_AE_EXPECTED_HOST,
  AEB_RETAINED_AE_REQUEST_ENV,
  AebRetainedAeDiscriminatorError,
  canonicalJson,
  sha256,
  type AebRetainedAeProcessBinding
} from "./contracts.js";

const execFileAsync = promisify(execFile);
const PROCESS_GROUP_POLL_MS = 25;
const PROCESS_GROUP_KILL_WAIT_MS = 1_000;
const PROCESS_GROUP_MAX_MEMBERS = 256;
const PROCESS_SNAPSHOT_MAX_BYTES = 256 * 1024;
const PROCESS_SNAPSHOT_PROBE_PGID = 999_999_937;
const MAX_CHILD_OUTPUT_BYTES = 64 * 1024;
const CONCRETE_CHILD_ENVIRONMENT_KEYS = new Set([
  "HOME", "LANG", "LC_ALL", "PATH", "TMPDIR", AEB_RETAINED_AE_REQUEST_ENV
]);
const concreteChildEnvironment: Readonly<Record<string, string>> = {
  HOME: userInfo().homedir,
  LANG: "C",
  LC_ALL: "C",
  PATH: "/usr/bin:/bin:/usr/sbin:/sbin",
  TMPDIR: "/private/tmp"
};

interface ProcessGroupMember {
  pid: number;
  ppid: number;
  pgid: number;
  session: string;
  startIdentity: string;
  command: string;
}

interface ProcessGroupIo {
  snapshot(): Promise<readonly ProcessGroupMember[]>;
  signal(signal: NodeJS.Signals): void;
  wait(milliseconds: number): Promise<void>;
  now(): number;
}

export interface AebRetainedAeConcreteProcessHandle {
  readonly pid: number;
  readonly processBinding: Promise<AebRetainedAeProcessBinding>;
  readonly completion: Promise<{ exitCode: number | null; signal: NodeJS.Signals | null }>;
  terminate(reason: Error): void;
  reap(): Promise<void>;
}

export type AebRetainedAeProcessControlScenario =
  | "reuse_between_checks"
  | "esrch_then_reuse"
  | "session_drift"
  | "membership_ambiguity"
  | "signal_fault"
  | "delayed_signal_fault"
  | "delayed_kill"
  | "repeated_cleanup";

export interface AebRetainedAeProcessControlScenarioResult {
  outcome: "reaped" | "rejected";
  errorCode: string | null;
  signals: NodeJS.Signals[];
  absenceProven: boolean;
  repeatedCleanupProved: boolean;
  elapsedMs: number;
}

export type AebRetainedAeCallbackProbeTrigger = "abort" | "output_overflow" | "timeout";
export type AebRetainedAeSnapshotFacilityScenario = "available" | "pgrep_unavailable" | "ps_unavailable" | "ps_empty";

export function spawnAebRetainedAeConcreteProcess(
  runRoot: string,
  requestPath: string,
  signal: AbortSignal
): AebRetainedAeConcreteProcessHandle {
  const environment = validateConcreteEnvironment({
    ...concreteChildEnvironment,
    [AEB_RETAINED_AE_REQUEST_ENV]: requestPath
  });
  const child = spawn(AEB_RETAINED_AE_EXPECTED_HOST.executablePath, ["-r", fixedJsxPath()], {
    cwd: runRoot,
    detached: true,
    env: environment,
    shell: false,
    stdio: ["ignore", "pipe", "pipe"]
  });
  if (!child.pid) {
    child.once("error", () => undefined);
    fail("AE_PROCESS_START_FAILED", "The retained AE process did not expose a PID.");
  }
  return createConcreteProcessHandle(
    child,
    AEB_RETAINED_AE_EXPECTED_HOST.executablePath,
    signal,
    AEB_RETAINED_AE_BUDGETS.processTimeoutMs,
    AEB_RETAINED_AE_BUDGETS.terminationGraceMs
  );
}

export async function assertAebRetainedAeProcessSnapshotFacilityAvailable(): Promise<void> {
  await assertProcessSnapshotFacilityAvailable({
    currentPid: process.pid,
    execFile: async (file, args) => {
      const result = await execFileAsync(file, args, {
        encoding: "utf8",
        env: { LANG: "C", LC_ALL: "C", PATH: "/usr/bin:/bin:/usr/sbin:/sbin" },
        maxBuffer: PROCESS_SNAPSHOT_MAX_BYTES
      });
      return { stdout: result.stdout };
    }
  });
}

export async function runAebRetainedAeOwnedSubprocessProbe(): Promise<{
  completionRejected: true;
  processGroupAbsenceProven: true;
}> {
  const descendantSource = "process.on('SIGTERM',()=>{});if(process.send)process.send('ready');setInterval(()=>{},1000);";
  const leaderSource = [
    "const {spawn}=require('node:child_process');",
    `const child=spawn(process.execPath,['-e',${JSON.stringify(descendantSource)}],{stdio:['ignore','ignore','ignore','ipc']});`,
    "child.on('message',()=>process.stdout.write('ready\\n'));",
    "process.on('SIGTERM',()=>process.exit(0));",
    "setInterval(()=>{},1000);"
  ].join("");
  const child = spawn(process.execPath, ["-e", leaderSource], {
    detached: true,
    stdio: ["ignore", "pipe", "ignore"]
  });
  if (!child.pid || !child.stdout) {
    child.once("error", () => undefined);
    fail("AE_PROCESS_PROBE_START_FAILED", "The owned subprocess probe did not expose a process identity.");
  }
  const controller = createConcreteProcessHandle(
    child,
    process.execPath,
    new AbortController().signal,
    5_000,
    50
  );
  try {
    await once(child.stdout, "data");
    controller.terminate(new Error("AE_PROCESS_PROBE_TERMINATED"));
    let completionRejected = false;
    try {
      await controller.completion;
    } catch {
      completionRejected = true;
    }
    if (!completionRejected) {
      fail("AE_PROCESS_PROBE_INVALID", "The owned subprocess probe did not reject its termination request.");
    }
    await controller.reap();
    return { completionRejected: true, processGroupAbsenceProven: true };
  } finally {
    controller.terminate(new Error("AE_PROCESS_PROBE_CLEANUP"));
    await controller.completion.catch(() => undefined);
    await controller.reap();
  }
}

export async function runAebRetainedAeCallbackSubprocessProbe(
  trigger: AebRetainedAeCallbackProbeTrigger
): Promise<{
  terminalMessage: string;
  processGroupAbsenceProven: true;
}> {
  const controllerSignal = new AbortController();
  const source = trigger === "output_overflow"
    ? `process.on('SIGTERM',()=>{});process.stdout.write('x'.repeat(${MAX_CHILD_OUTPUT_BYTES + 1}));setInterval(()=>{},1000);`
    : "process.on('SIGTERM',()=>{});process.stdout.write('ready\\n');setInterval(()=>{},1000);";
  const child = spawn(process.execPath, ["-e", source], {
    detached: true,
    stdio: ["ignore", "pipe", "ignore"]
  });
  if (!child.pid || !child.stdout) {
    child.once("error", () => undefined);
    fail("AE_PROCESS_PROBE_START_FAILED", "The callback subprocess probe did not expose a process identity.");
  }
  const processController = createConcreteProcessHandle(
    child,
    process.execPath,
    controllerSignal.signal,
    trigger === "timeout" ? 50 : 5_000,
    25
  );
  try {
    if (trigger === "abort") {
      await once(child.stdout, "data");
      controllerSignal.abort();
    }
    let terminalMessage = "";
    try {
      await processController.completion;
    } catch (error) {
      terminalMessage = error instanceof Error ? error.message : "unknown";
    }
    if (!terminalMessage) {
      fail("AE_PROCESS_PROBE_INVALID", "The callback subprocess probe did not settle as a rejection.");
    }
    await processController.reap();
    return { terminalMessage, processGroupAbsenceProven: true };
  } finally {
    processController.terminate(new Error("AE_PROCESS_PROBE_CLEANUP"));
    await processController.completion.catch(() => undefined);
    await processController.reap();
  }
}

export async function runAebRetainedAeProcessControlScenario(
  scenario: AebRetainedAeProcessControlScenario
): Promise<AebRetainedAeProcessControlScenarioResult> {
  const leader = scriptedMember({ pid: 4242, ppid: 100, start: "generation-a", session: "session-a" });
  const replacement = scriptedMember({ pid: 4242, ppid: 100, start: "generation-b", session: "session-a" });
  const sessionReplacement = scriptedMember({ pid: 4242, ppid: 100, start: "generation-a", session: "session-b" });
  const orphan = scriptedMember({ pid: 4343, ppid: 1, start: "orphan", session: "session-a" });
  let snapshotCount = 0;
  let elapsedMs = 0;
  let esrchObserved = false;
  const signals: NodeJS.Signals[] = [];
  const io: ProcessGroupIo = {
    async snapshot() {
      snapshotCount += 1;
      if (scenario === "reuse_between_checks" && snapshotCount >= 3) return [replacement];
      if (scenario === "session_drift" && snapshotCount >= 3) return [sessionReplacement];
      if (scenario === "membership_ambiguity" && snapshotCount >= 3) return [leader, orphan];
      if (scenario === "esrch_then_reuse" && esrchObserved) {
        return snapshotCount % 2 === 0 ? [] : [replacement];
      }
      if (scenario === "delayed_kill" && signals.includes("SIGKILL")) return [];
      if (scenario === "repeated_cleanup" && signals.includes("SIGTERM")) return [];
      return [leader];
    },
    signal(value) {
      signals.push(value);
      if (scenario === "esrch_then_reuse" && value === "SIGTERM") {
        esrchObserved = true;
        throw errnoError("ESRCH");
      }
      if (scenario === "signal_fault" && value === "SIGTERM") throw errnoError("EPERM");
      if (scenario === "delayed_signal_fault" && value === "SIGKILL") throw errnoError("EACCES");
    },
    async wait(milliseconds) {
      elapsedMs += milliseconds;
    },
    now() {
      return elapsedMs;
    }
  };
  let authority: OwnedProcessGroupAuthority | undefined;
  let errorCode: string | null = null;
  let repeatedCleanupProved = false;
  try {
    authority = await OwnedProcessGroupAuthority.bind(io, 4242, 100, "/fixed/owned-executable");
    await authority.reap(50);
    if (scenario === "repeated_cleanup") {
      const signalCount = signals.length;
      await authority.reap(50);
      repeatedCleanupProved = signals.length === signalCount;
    }
  } catch (error) {
    errorCode = error instanceof AebRetainedAeDiscriminatorError
      ? error.code
      : "UNEXPECTED_PROCESS_CONTROL_ERROR";
  }
  const absenceProven = authority?.isAbsenceProven() ?? false;
  return {
    outcome: errorCode === null ? "reaped" : "rejected",
    errorCode,
    signals,
    absenceProven,
    repeatedCleanupProved,
    elapsedMs
  };
}

export async function runAebRetainedAeSnapshotFacilityScenario(
  scenario: AebRetainedAeSnapshotFacilityScenario
): Promise<{
  outcome: "available" | "rejected";
  errorCode: string | null;
  commands: string[];
}> {
  const commands: string[] = [];
  try {
    await assertProcessSnapshotFacilityAvailable({
      currentPid: 4242,
      async execFile(file, args) {
        commands.push(`${file} ${args.join(" ")}`);
        if (file === "/usr/bin/pgrep") {
          if (scenario === "pgrep_unavailable") throw exitCode(3);
          throw exitCode(1);
        }
        if (file === "/bin/ps") {
          if (scenario === "ps_unavailable") throw errnoError("EPERM");
          if (scenario === "ps_empty") return { stdout: "" };
          return { stdout: " 4242 100 4242 4242 Fri Jul 17 03:48:00 2026 /fixed/owned-executable --probe\n" };
        }
        throw errnoError("ENOENT");
      }
    });
    return { outcome: "available", errorCode: null, commands };
  } catch (error) {
    return {
      outcome: "rejected",
      errorCode: error instanceof AebRetainedAeDiscriminatorError
        ? error.code
        : "UNEXPECTED_PROCESS_SNAPSHOT_ERROR",
      commands
    };
  }
}

interface ProcessSnapshotFacilityIo {
  readonly currentPid: number;
  execFile(file: string, args: readonly string[]): Promise<{ stdout: string }>;
}

async function assertProcessSnapshotFacilityAvailable(io: ProcessSnapshotFacilityIo): Promise<void> {
  try {
    await io.execFile("/usr/bin/pgrep", ["-g", String(PROCESS_SNAPSHOT_PROBE_PGID)]);
  } catch (error) {
    if ((error as NodeJS.ErrnoException & { code?: number }).code !== 1) {
      fail("AE_PROCESS_GROUP_SNAPSHOT_FAILED", "The retained AE process group could not be enumerated.");
    }
  }
  try {
    const result = await io.execFile("/bin/ps", [
      "-p", String(io.currentPid),
      "-o", "pid=,ppid=,pgid=,sess=,lstart=,command="
    ]);
    if (result.stdout.trim().length === 0) {
      fail("AE_PROCESS_GROUP_SNAPSHOT_FAILED", "The retained AE process group identity could not be inspected.");
    }
  } catch (error) {
    if (error instanceof AebRetainedAeDiscriminatorError) throw error;
    fail("AE_PROCESS_GROUP_SNAPSHOT_FAILED", "The retained AE process group identity could not be inspected.");
  }
}

class OwnedProcessGroupAuthority {
  readonly processBinding: AebRetainedAeProcessBinding;
  private readonly generationCapability = randomBytes(32);
  private readonly knownMembers = new Map<number, ProcessGroupMember>();
  private absenceSealed = false;

  private constructor(
    private readonly io: ProcessGroupIo,
    private readonly leaderPid: number,
    private readonly parentPid: number,
    private readonly session: string,
    leader: ProcessGroupMember,
    initialMembers: readonly ProcessGroupMember[]
  ) {
    for (const member of initialMembers) this.knownMembers.set(member.pid, member);
    this.processBinding = {
      pid: leader.pid,
      startIdentity: sha256(Buffer.concat([
        this.generationCapability,
        Buffer.from(`\0${leader.startIdentity}\0${session}`, "utf8")
      ])),
      executablePath: AEB_RETAINED_AE_EXPECTED_HOST.executablePath,
      executableSha256: AEB_RETAINED_AE_EXPECTED_HOST.executableSha256,
      bundleId: AEB_RETAINED_AE_EXPECTED_HOST.bundleId,
      version: AEB_RETAINED_AE_EXPECTED_HOST.version,
      build: AEB_RETAINED_AE_EXPECTED_HOST.build,
      teamId: AEB_RETAINED_AE_EXPECTED_HOST.teamId,
      cdHash: AEB_RETAINED_AE_EXPECTED_HOST.cdHash,
      codeResourcesSha256: AEB_RETAINED_AE_EXPECTED_HOST.codeResourcesSha256
    };
  }

  static async bind(
    io: ProcessGroupIo,
    leaderPid: number,
    parentPid: number,
    expectedExecutablePath: string
  ): Promise<OwnedProcessGroupAuthority> {
    if (!Number.isSafeInteger(leaderPid) || leaderPid <= 0 || !Number.isSafeInteger(parentPid) || parentPid <= 0) {
      fail("AE_PROCESS_IDENTITY_INVALID", "The retained AE process identity is invalid.");
    }
    const initial = await io.snapshot();
    const leader = initial.find((member) => member.pid === leaderPid);
    if (!leader
      || leader.ppid !== parentPid
      || leader.pgid !== leaderPid
      || !commandMatchesExecutable(leader.command, expectedExecutablePath)) {
      fail("AE_PROCESS_GROUP_AUTHORITY_INVALID", "The detached process group could not be bound to the spawned leader.");
    }
    if (initial.some((member) => member.pgid !== leaderPid || member.session !== leader.session)) {
      fail("AE_PROCESS_GROUP_SESSION_AMBIGUOUS", "The detached process group does not have one coherent session.");
    }
    return new OwnedProcessGroupAuthority(io, leaderPid, parentPid, leader.session, leader, initial);
  }

  isAbsenceProven(): boolean {
    return this.absenceSealed;
  }

  async reap(terminationGraceMs: number): Promise<boolean> {
    validateTerminationBudget(terminationGraceMs);
    if (await this.waitForAbsence(0)) return false;

    await this.sendSignal("SIGTERM");
    if (await this.waitForAbsence(terminationGraceMs)) return true;

    await this.sendSignal("SIGKILL");
    if (!await this.waitForAbsence(PROCESS_GROUP_KILL_WAIT_MS)) {
      fail("AE_PROCESS_RESIDUE", "The retained AE process group survived bounded termination.");
    }
    return true;
  }

  async requireAbsent(): Promise<void> {
    if (!await this.waitForAbsence(PROCESS_GROUP_KILL_WAIT_MS)) {
      fail("AE_PROCESS_RESIDUE", "The retained AE process group survived bounded termination.");
    }
  }

  private async sendSignal(signal: NodeJS.Signals): Promise<void> {
    const before = await this.readValidatedSnapshot();
    if (before.length === 0) {
      await this.confirmAbsenceAfterEmpty();
      return;
    }
    try {
      this.io.signal(signal);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ESRCH") {
        await this.confirmAbsenceAfterEsrch();
        return;
      }
      fail("AE_PROCESS_SIGNAL_FAILED", "The retained AE process signal failed before absence was proven.");
    }
    const after = await this.readValidatedSnapshot();
    if (after.length === 0) await this.confirmAbsenceAfterEmpty();
  }

  private async waitForAbsence(timeoutMs: number): Promise<boolean> {
    const deadline = this.io.now() + timeoutMs;
    while (true) {
      const members = await this.readValidatedSnapshot();
      if (members.length === 0) {
        await this.confirmAbsenceAfterEmpty();
        return true;
      }
      if (this.io.now() >= deadline) return false;
      await this.io.wait(Math.min(PROCESS_GROUP_POLL_MS, deadline - this.io.now()));
    }
  }

  private async confirmAbsenceAfterEsrch(): Promise<void> {
    const first = await this.readValidatedSnapshot();
    if (first.length > 0) {
      fail("AE_PROCESS_GROUP_SIGNAL_AMBIGUOUS", "The process group remained observable after an ESRCH signal result.");
    }
    await this.confirmAbsenceAfterEmpty();
  }

  private async confirmAbsenceAfterEmpty(): Promise<void> {
    await this.io.wait(PROCESS_GROUP_POLL_MS);
    const confirmation = await this.io.snapshot();
    if (confirmation.length > 0) {
      fail("AE_PROCESS_GROUP_REUSED", "The detached process-group identity reappeared after absence.");
    }
    this.absenceSealed = true;
  }

  private async readValidatedSnapshot(): Promise<readonly ProcessGroupMember[]> {
    const members = await this.io.snapshot();
    if (members.length === 0) return members;
    if (this.absenceSealed) {
      fail("AE_PROCESS_GROUP_REUSED", "The detached process-group identity was reused after cleanup.");
    }
    if (members.some((member) => member.pgid !== this.leaderPid || member.session !== this.session)) {
      fail("AE_PROCESS_GROUP_SESSION_AMBIGUOUS", "The detached process-group session changed during execution.");
    }
    const pending = new Map<number, ProcessGroupMember>();
    for (const member of members) {
      const known = this.knownMembers.get(member.pid);
      if (known) {
        if (known.startIdentity !== member.startIdentity
          || known.pgid !== member.pgid
          || known.session !== member.session) {
          fail("AE_PROCESS_GROUP_REUSED", "A process-group member changed generation during execution.");
        }
        if (known.ppid !== member.ppid && member.ppid !== 1) {
          fail("AE_PROCESS_GROUP_MEMBERSHIP_AMBIGUOUS", "A process-group member changed parent authority.");
        }
      } else {
        pending.set(member.pid, member);
      }
    }
    while (pending.size > 0) {
      let progressed = false;
      for (const [pid, member] of pending) {
        if (this.knownMembers.has(member.ppid)) {
          this.knownMembers.set(pid, member);
          pending.delete(pid);
          progressed = true;
        }
      }
      if (!progressed) {
        fail("AE_PROCESS_GROUP_MEMBERSHIP_AMBIGUOUS", "A process-group member is not derived from the spawned generation.");
      }
    }
    const leader = members.find((member) => member.pid === this.leaderPid);
    if (leader && (leader.ppid !== this.parentPid || !this.knownMembers.has(leader.pid))) {
      fail("AE_PROCESS_GROUP_REUSED", "The spawned leader identity changed during execution.");
    }
    return members;
  }
}

function createConcreteProcessHandle(
  child: ChildProcess,
  expectedExecutablePath: string,
  abortSignal: AbortSignal,
  processTimeoutMs: number,
  terminationGraceMs: number
): AebRetainedAeConcreteProcessHandle {
  if (!child.pid) fail("AE_PROCESS_START_FAILED", "The retained AE process did not expose a PID.");
  const pid = child.pid;
  const io = createRealProcessGroupIo(pid);
  const authorityPromise = OwnedProcessGroupAuthority.bind(io, pid, process.pid, expectedExecutablePath).catch((error) => {
    try {
      child.kill("SIGKILL");
    } catch {
      // The exact child handle was already unavailable; group authority remains unproven.
    }
    throw error;
  });
  let terminalError: Error | undefined;
  let resolveTermination!: (reason: Error) => void;
  let resolveClose!: (outcome: { exitCode: number | null; signal: NodeJS.Signals | null }) => void;
  const terminationRequested = new Promise<Error>((resolve) => {
    resolveTermination = resolve;
  });
  const closeObserved = new Promise<{ exitCode: number | null; signal: NodeJS.Signals | null }>((resolve) => {
    resolveClose = resolve;
  });
  const terminate = (reason: Error): void => {
    if (terminalError) return;
    terminalError = reason;
    resolveTermination(reason);
  };
  let outputBytes = 0;
  const onData = (chunk: Buffer): void => {
    outputBytes += chunk.byteLength;
    if (outputBytes > MAX_CHILD_OUTPUT_BYTES) terminate(new Error("AE_PROCESS_OUTPUT_LIMIT_EXCEEDED"));
  };
  child.stdout?.on("data", onData);
  child.stderr?.on("data", onData);
  child.once("error", (error) => terminate(error));
  child.once("close", (exitCode, closeSignal) => resolveClose({ exitCode, signal: closeSignal }));
  const abort = () => terminate(new Error("AE_PROCESS_CANCELLED"));
  abortSignal.addEventListener("abort", abort, { once: true });
  const timeout = setTimeout(() => terminate(new Error("AE_PROCESS_TIMEOUT")), processTimeoutMs);
  const completion = (async () => {
    const authority = await authorityPromise;
    const first = await Promise.race([
      closeObserved.then((outcome) => ({ kind: "close" as const, outcome })),
      terminationRequested.then((reason) => ({ kind: "termination" as const, reason }))
    ]);
    const residueObserved = await authority.reap(terminationGraceMs);
    if (first.kind === "termination") {
      await waitForClose(closeObserved);
      throw terminalError ?? first.reason;
    }
    if (terminalError) throw terminalError;
    if (residueObserved) {
      fail("AE_PROCESS_RESIDUE", "The retained AE process left an owned descendant after close.");
    }
    return first.outcome;
  })().finally(() => {
    clearTimeout(timeout);
    abortSignal.removeEventListener("abort", abort);
    child.stdout?.removeListener("data", onData);
    child.stderr?.removeListener("data", onData);
  });
  void completion.catch(() => undefined);
  return {
    pid,
    processBinding: authorityPromise.then((authority) => authority.processBinding),
    completion,
    terminate,
    async reap() {
      const authority = await authorityPromise;
      await authority.reap(terminationGraceMs);
      await authority.requireAbsent();
    }
  };
}

function createRealProcessGroupIo(pgid: number): ProcessGroupIo {
  return {
    snapshot: () => snapshotProcessGroup(pgid),
    signal: (signal) => process.kill(-pgid, signal),
    wait: (milliseconds) => delay(milliseconds),
    now: () => Date.now()
  };
}

async function snapshotProcessGroup(pgid: number): Promise<readonly ProcessGroupMember[]> {
  let pids: number[];
  try {
    const result = await execFileAsync("/usr/bin/pgrep", ["-g", String(pgid)], {
      encoding: "utf8",
      env: { LANG: "C", LC_ALL: "C", PATH: "/usr/bin:/bin:/usr/sbin:/sbin" },
      maxBuffer: PROCESS_SNAPSHOT_MAX_BYTES
    });
    pids = result.stdout.split(/\s+/).filter(Boolean).map(Number);
  } catch (error) {
    if ((error as NodeJS.ErrnoException & { code?: number }).code === 1) return [];
    fail("AE_PROCESS_GROUP_SNAPSHOT_FAILED", "The retained AE process group could not be enumerated.");
  }
  if (pids.length === 0) return [];
  if (pids.length > PROCESS_GROUP_MAX_MEMBERS
    || pids.some((pid) => !Number.isSafeInteger(pid) || pid <= 0)) {
    fail("AE_PROCESS_GROUP_MEMBERSHIP_AMBIGUOUS", "The retained AE process group membership is invalid.");
  }
  let stdout: string;
  try {
    const result = await execFileAsync("/bin/ps", [
      "-p", pids.join(","),
      "-o", "pid=,ppid=,pgid=,sess=,lstart=,command="
    ], {
      encoding: "utf8",
      env: { LANG: "C", LC_ALL: "C", PATH: "/usr/bin:/bin:/usr/sbin:/sbin" },
      maxBuffer: PROCESS_SNAPSHOT_MAX_BYTES
    });
    stdout = result.stdout;
  } catch (error) {
    if ((error as NodeJS.ErrnoException & { code?: number }).code === 1) return [];
    fail("AE_PROCESS_GROUP_SNAPSHOT_FAILED", "The retained AE process group identity could not be inspected.");
  }
  return stdout.split(/\r?\n/)
    .filter((line) => line.trim().length > 0)
    .map(parseProcessGroupMember)
    .filter((member) => member.pgid === pgid)
    .sort((left, right) => left.pid - right.pid);
}

function parseProcessGroupMember(line: string): ProcessGroupMember {
  const match = line.match(/^\s*(\d+)\s+(\d+)\s+(\d+)\s+(-?\d+)\s+(.{24})\s+(.+)$/);
  if (!match) fail("AE_PROCESS_GROUP_SNAPSHOT_INVALID", "The retained AE process snapshot is malformed.");
  const [, pidText, ppidText, pgidText, session, start, command] = match;
  const pid = Number(pidText);
  const ppid = Number(ppidText);
  const pgid = Number(pgidText);
  if (![pid, ppid, pgid].every((value) => Number.isSafeInteger(value) && value >= 0)) {
    fail("AE_PROCESS_GROUP_SNAPSHOT_INVALID", "The retained AE process snapshot identity is invalid.");
  }
  return {
    pid,
    ppid,
    pgid,
    session,
    startIdentity: sha256(canonicalJson({ pid, pgid, session, start, command })),
    command
  };
}

function scriptedMember(input: {
  pid: number;
  ppid: number;
  start: string;
  session: string;
}): ProcessGroupMember {
  const command = "/fixed/owned-executable --fixed";
  return {
    pid: input.pid,
    ppid: input.ppid,
    pgid: 4242,
    session: input.session,
    startIdentity: sha256(canonicalJson({ pid: input.pid, pgid: 4242, session: input.session, start: input.start, command })),
    command
  };
}

function commandMatchesExecutable(command: string, executablePath: string): boolean {
  return command === executablePath || command.startsWith(`${executablePath} `);
}

function validateConcreteEnvironment(environment: Readonly<Record<string, string>>): NodeJS.ProcessEnv {
  if (Object.keys(environment).some((key) => !CONCRETE_CHILD_ENVIRONMENT_KEYS.has(key))) {
    fail("AE_CHILD_ENVIRONMENT_INVALID", "The retained AE child environment is not allowlisted.");
  }
  return { ...environment };
}

function validateTerminationBudget(terminationGraceMs: number): void {
  if (!Number.isSafeInteger(terminationGraceMs)
    || terminationGraceMs <= 0
    || terminationGraceMs > 10_000) {
    fail("AE_PROCESS_TERMINATION_BUDGET_INVALID", "The retained AE process termination budget is invalid.");
  }
}

async function waitForClose(
  closeObserved: Promise<{ exitCode: number | null; signal: NodeJS.Signals | null }>
): Promise<void> {
  await Promise.race([
    closeObserved.then(() => undefined),
    delay(PROCESS_GROUP_KILL_WAIT_MS).then(() => {
      fail("AE_PROCESS_CLOSE_TIMEOUT", "The retained AE process did not report close after group cleanup.");
    })
  ]);
}

function fixedJsxPath(): string {
  return path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    "../../../tools/aeb/f2/aeb-retained-ae-discriminator.jsx"
  );
}

function errnoError(code: string): NodeJS.ErrnoException {
  const error = new Error("synthetic process-control fault") as NodeJS.ErrnoException;
  error.code = code;
  return error;
}

function exitCode(code: number): Error & { code: number } {
  const error = new Error("synthetic process-control exit") as Error & { code: number };
  error.code = code;
  return error;
}

function fail(code: string, message: string): never {
  throw new AebRetainedAeDiscriminatorError(code, message);
}
