import assert from "node:assert/strict";
import {
  appendFile,
  chmod,
  link,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  realpath,
  rename,
  rm,
  symlink,
  writeFile
} from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test, { type TestContext } from "node:test";
import {
  AEB_RETAINED_AE_BUDGETS,
  AEB_RETAINED_AE_EXPECTED_HOST,
  AEB_RETAINED_AE_TASK_BASE,
  AebRetainedAeApprovalGate,
  AebRetainedAeDiscriminatorError,
  NodeAebRetainedAeRunAuthority,
  NodeAebRetainedAeRuntimeDiscriminator,
  createAebRetainedAeApproval,
  createAebRetainedAeRunRoot,
  createSyntheticAebRetainedAeDiscriminatorPlan,
  evaluateAebRetainedAeObservedHost,
  evaluateAebRetainedAeProcessOutcome,
  evaluateAebRetainedAeRunRootCleanup,
  hashCanonical,
  verifyAebRetainedAeApproval,
  verifyAebRetainedAeResult,
  type AebRetainedAeApproval,
  type AebRetainedAeFileBinding,
  type AebRetainedAeProcessBinding,
  type AebRetainedAeResult,
  type AebRetainedAeRuntimePlan
} from "../experiments/aeb-retained-ae-discriminator/index.js";
import {
  createAebRetainedAeRuntimePlan,
  sha256
} from "../experiments/aeb-retained-ae-discriminator/contracts.js";
import { createTransparentImage, encodeRgbaPng, setPixel } from "../utils/png-writer.js";
import {
  assertAebRetainedAeProcessSnapshotFacilityAvailable,
  runAebRetainedAeCallbackSubprocessProbe,
  runAebRetainedAeOwnedSubprocessProbe,
  runAebRetainedAeProcessControlScenario,
  runAebRetainedAeSnapshotFacilityScenario
} from "../experiments/aeb-retained-ae-discriminator/process-group.js";

const JSX_PATH = path.resolve("tools/aeb/f2/aeb-retained-ae-discriminator.jsx");
const CONTRACTS_SOURCE_PATH = path.resolve("src/experiments/aeb-retained-ae-discriminator/contracts.ts");
const RUNTIME_SOURCE_PATH = path.resolve("src/experiments/aeb-retained-ae-discriminator/runtime.ts");
const PROCESS_GROUP_SOURCE_PATH = path.resolve("src/experiments/aeb-retained-ae-discriminator/process-group.ts");
const FILESYSTEM_SOURCE_PATH = path.resolve("src/experiments/aeb-retained-ae-discriminator/filesystem.ts");
const S1_RETAINED_AE_TASK_BASE = "/private/tmp/auto-svga-aeb-f2-s1-retained-ae-7920995d";
const OLD_AEB_DEV_TASK_BASE = "/private/tmp/auto-svga-aeb-dev";
const D001_TASK_BASE = "/private/tmp/auto-svga-aeb-d001-8594bcfa";

test("failure-first source boundary separates fixed production and synthetic plans", async () => {
  assert.equal(NodeAebRetainedAeRuntimeDiscriminator.length, 0);
  const production = new NodeAebRetainedAeRuntimeDiscriminator();
  const plan = await production.plan({
    taskId: "task-source-probe",
    executionId: "execution-source-probe"
  });
  const synthetic = createSyntheticAebRetainedAeDiscriminatorPlan({
    taskId: "task-source-probe",
    executionId: "execution-source-probe"
  });

  assert.equal(plan.mode, "runtime_discriminator_planned");
  assert.equal(synthetic.mode, "synthetic_discriminator_planned");
  assert.equal("actualAeRenderExecuted" in plan, false);
  assert.equal("actualAeRenderExecuted" in synthetic, false);
  assert.deepEqual(plan.authorityClaims, {
    runtimeDiscriminatorOnly: true,
    actualAeBakeAuthorityMinted: false,
    packageAuthorityMinted: false,
    adapterAuthorityMinted: false
  });
  assert.equal(plan.expectedHost.executablePath, AEB_RETAINED_AE_EXPECTED_HOST.executablePath);
  assert.equal(plan.budgets.maxFrames, 1);
  assert.equal(plan.budgets.maxAggregateDecodedBytes, 64);
  assert.equal(Object.isFrozen(plan), true);
  assert.equal(Object.isFrozen(plan.fixture), true);
});

test("retained AE task-base authority is S1-specific and excludes old evidence roots", async () => {
  const contracts = await readFile(CONTRACTS_SOURCE_PATH, "utf8");
  const runtime = await readFile(RUNTIME_SOURCE_PATH, "utf8");
  const plan = createAebRetainedAeRuntimePlan(
    { taskId: "task-base-authority", executionId: "execution-base-authority" },
    sha256(await readFile(JSX_PATH)),
    "a".repeat(64),
    1_800_000_000_000
  );
  const futureRunRoot = path.join(AEB_RETAINED_AE_TASK_BASE, plan.runDirectoryName);
  assert.equal(AEB_RETAINED_AE_TASK_BASE, S1_RETAINED_AE_TASK_BASE);
  assert.notEqual(AEB_RETAINED_AE_TASK_BASE, OLD_AEB_DEV_TASK_BASE);
  assert.notEqual(AEB_RETAINED_AE_TASK_BASE, D001_TASK_BASE);
  assert.equal(contracts.includes(OLD_AEB_DEV_TASK_BASE), false);
  assert.equal(runtime.includes(OLD_AEB_DEV_TASK_BASE), false);
  assert.equal(futureRunRoot.startsWith(`${S1_RETAINED_AE_TASK_BASE}/run-`), true);
  assert.equal(futureRunRoot.startsWith(`${OLD_AEB_DEV_TASK_BASE}/`), false);
  assert.equal(futureRunRoot.startsWith(`${D001_TASK_BASE}/`), false);
});

test("historical AEB dev child names cannot become retained AE run-root names", async (t) => {
  const createdTempRoot = await mkdtemp(path.join(os.tmpdir(), "aeb-retained-stale-child-"));
  const tempRoot = await realpath(createdTempRoot);
  const base = path.join(tempRoot, "base");
  await mkdir(base, { mode: 0o700 });
  await chmod(base, 0o700);
  t.after(() => rm(tempRoot, { recursive: true, force: true }));
  for (const staleName of [
    "aeb-registered-electron-runtime-20260715-071",
    "process-authority",
    "process-authority/aeb-registered-electron-runtime-20260715-070",
    "process-authority/aeb-registered-electron-runtime-20260715-071"
  ]) {
    await assertDiscriminatorError(
      () => createAebRetainedAeRunRoot(base, staleName),
      "RUN_ROOT_NAME_INVALID"
    );
  }
  assert.deepEqual(await readdir(base), []);
});

test("retained AE run roots require a canonical owned mode-0700 task base", async (t) => {
  const createdTempRoot = await mkdtemp(path.join(os.tmpdir(), "aeb-retained-base-authority-"));
  const tempRoot = await realpath(createdTempRoot);
  const wrongModeBase = path.join(tempRoot, "wrong-mode-base");
  const canonicalBase = path.join(tempRoot, "canonical-base");
  const aliasBase = path.join(tempRoot, "alias-base");
  const runName = `run-${sha256("base-authority")}`;
  await mkdir(wrongModeBase, { mode: 0o700 });
  await mkdir(canonicalBase, { mode: 0o700 });
  await chmod(wrongModeBase, 0o755);
  await chmod(canonicalBase, 0o700);
  await symlink(canonicalBase, aliasBase);
  t.after(() => rm(tempRoot, { recursive: true, force: true }));
  await assertDiscriminatorError(
    () => createAebRetainedAeRunRoot(wrongModeBase, runName),
    "TASK_BASE_INVALID"
  );
  await assertDiscriminatorError(
    () => createAebRetainedAeRunRoot(aliasBase, runName),
    "TASK_BASE_INVALID"
  );
  assert.deepEqual(await readdir(wrongModeBase), []);
  assert.deepEqual(await readdir(canonicalBase), []);
});

test("fake executable plus self-consistent hashes cannot match the fixed production authority", () => {
  const fake = {
    executablePath: "/tmp/task/fake-after-effects",
    executableSha256: "a".repeat(64),
    bundleId: AEB_RETAINED_AE_EXPECTED_HOST.bundleId,
    version: AEB_RETAINED_AE_EXPECTED_HOST.version,
    build: AEB_RETAINED_AE_EXPECTED_HOST.build,
    teamId: AEB_RETAINED_AE_EXPECTED_HOST.teamId,
    cdHash: "b".repeat(40),
    codeResourcesSha256: "c".repeat(64)
  };
  assert.equal(evaluateAebRetainedAeObservedHost(fake), "rejected");
  const reflected = Reflect.construct(NodeAebRetainedAeRuntimeDiscriminator, [fake]);
  assert.ok(reflected instanceof NodeAebRetainedAeRuntimeDiscriminator);
  assert.equal(NodeAebRetainedAeRuntimeDiscriminator.length, 0);
});

test("exclusive run-root creation never removes a pre-existing task directory", async (t) => {
  const createdTempRoot = await mkdtemp(path.join(os.tmpdir(), "aeb-retained-existing-root-"));
  const tempRoot = await realpath(createdTempRoot);
  const base = path.join(tempRoot, "base");
  const runName = `run-${sha256("pre-existing-root")}`;
  const runRoot = path.join(base, runName);
  const marker = path.join(runRoot, "owner-marker.txt");
  await mkdir(runRoot, { recursive: true, mode: 0o700 });
  await chmod(base, 0o700);
  await chmod(runRoot, 0o700);
  await writeFile(marker, "preserve");
  t.after(() => rm(tempRoot, { recursive: true, force: true }));
  await assertDiscriminatorError(
    () => createAebRetainedAeRunRoot(base, runName),
    "RUN_ROOT_CREATE_FAILED"
  );
  assert.equal(await readFile(marker, "utf8"), "preserve");
});

test("atomic JSON publication never overwrites an existing task file", async (t) => {
  const fixture = await createAuthorityFixture(t, "json-no-overwrite");
  const approval = path.join(fixture.runRoot, "control/approval.json");
  await writeFile(approval, "owner-bytes");
  await assertDiscriminatorError(
    () => fixture.authority.writeExclusiveJson("control/approval.json", { forged: true }, 1024),
    "TASK_FILE_PUBLICATION_FAILED"
  );
  assert.equal(await readFile(approval, "utf8"), "owner-bytes");
  assert.deepEqual(await fixture.authority.listFiles(), ["control/approval.json"]);
});

test("cloned synthetic and caller-shaped plans stop before filesystem or executable access", async () => {
  const runtime = new NodeAebRetainedAeRuntimeDiscriminator();
  const plan = await runtime.plan({ taskId: "task-clone-probe", executionId: "execution-clone-probe" });
  const cloned = structuredClone(plan);
  await assertDiscriminatorError(
    () => runtime.run(cloned, new AbortController().signal),
    "DISCRIMINATOR_PLAN_CAPABILITY_REQUIRED"
  );
  const synthetic = createSyntheticAebRetainedAeDiscriminatorPlan({
    taskId: "task-clone-probe",
    executionId: "execution-clone-probe"
  });
  const callerShaped = { ...synthetic, actualAeRenderExecuted: true };
  await assertDiscriminatorError(
    () => runtime.run(callerShaped as unknown as AebRetainedAeRuntimePlan, new AbortController().signal),
    "PLAN_INVALID",
    ["PLAN_FIELDS_INVALID"]
  );
});

test("cancelled real plan stops before task-root or host preflight", async () => {
  const runtime = new NodeAebRetainedAeRuntimeDiscriminator();
  const plan = await runtime.plan({ taskId: "task-cancel-probe", executionId: "execution-cancel-probe" });
  const abort = new AbortController();
  abort.abort();
  await assertDiscriminatorError(
    () => runtime.run(plan, abort.signal),
    "DISCRIMINATOR_PLAN_EXPIRED"
  );
});

test("checkpoint transient rename/restore and in-place restore invalidate the sealed identity", async (t) => {
  for (const mutation of ["rename_restore", "in_place_restore"] as const) {
    await t.test(mutation, async (t) => {
      const fixture = await createAuthorityFixture(t, mutation);
      await publishSyntheticCheckpoint(fixture.authority);
      const seal = await fixture.authority.captureCheckpointSeal();
      const checkpoint = path.join(fixture.runRoot, "checkpoint/checkpoint.aep");
      const original = await readFile(checkpoint);
      if (mutation === "rename_restore") {
        const moved = path.join(fixture.runRoot, "checkpoint/checkpoint-moved.aep");
        await rename(checkpoint, moved);
        await rename(moved, checkpoint);
      } else {
        await appendFile(checkpoint, Buffer.from([1]));
        await writeFile(checkpoint, original);
      }
      await assertDiscriminatorError(
        () => fixture.authority.verifyCheckpointSeal(seal),
        mutation === "rename_restore" ? "RUN_ROOT_CHANGED" : "CHECKPOINT_CHANGED",
        ["CHECKPOINT_DIRECTORY_CHANGED"]
      );
    });
  }
});

test("task parent/root replacement is rejected by pinned directory authority", async (t) => {
  for (const mutation of ["root", "parent"] as const) {
    await t.test(mutation, async (t) => {
      const fixture = await createAuthorityFixture(t, `${mutation}-swap`);
      const target = mutation === "root" ? fixture.runRoot : fixture.base;
      const moved = `${target}-moved`;
      await rename(target, moved);
      await mkdir(target, { mode: 0o700 });
      if (mutation === "root") {
        for (const child of ["control", "checkpoint", "output", "result"]) {
          await mkdir(path.join(target, child), { mode: 0o700 });
        }
      }
      await assertDiscriminatorError(
        () => fixture.authority.verifyRoots(),
        mutation === "root" ? "RUN_ROOT_CHANGED" : "TASK_BASE_CHANGED",
        ["TASK_BASE_CHANGED"]
      );
    });
  }
});

test("checkpoint symlink and first-use hard-link aliases are rejected", async (t) => {
  for (const alias of ["symlink", "hardlink"] as const) {
    await t.test(alias, async (t) => {
      const fixture = await createAuthorityFixture(t, alias);
      const outside = path.join(fixture.tempRoot, `outside-${alias}.aep`);
      const checkpoint = path.join(fixture.runRoot, "checkpoint/checkpoint.aep");
      await writeFile(outside, Buffer.from("synthetic-checkpoint"));
      if (alias === "symlink") await symlink(outside, checkpoint);
      else await link(outside, checkpoint);
      await fixture.authority.writeExclusiveJson(
        "checkpoint/publication.json",
        { synthetic: true },
        AEB_RETAINED_AE_BUDGETS.maxExchangeBytes
      );
      await assertDiscriminatorError(
        () => fixture.authority.captureCheckpointSeal(),
        alias === "symlink" ? "TASK_FILE_INVALID" : "TASK_FILE_INVALID"
      );
    });
  }
});

test("approval token binds process checkpoint JSX composition task and execution and is one-time", async () => {
  const { plan, approval, expected } = await approvalFixture();
  assert.equal(verifyAebRetainedAeApproval(plan, approval, approval.issuedAtMs, expected), true);
  const gate = new AebRetainedAeApprovalGate(plan, expected);
  assert.equal(gate.consume(approval, approval.issuedAtMs), true);
  assert.equal(gate.consume(approval, approval.issuedAtMs), false);

  const mutations: Array<[string, (value: AebRetainedAeApproval) => void, number?]> = [
    ["cross task", (value) => { value.taskId = "task-cross-binding"; }],
    ["cross execution", (value) => { value.executionId = "execution-cross-binding"; }],
    ["wrong plan", (value) => { value.planHash = "a".repeat(64); }],
    ["wrong pid", (value) => { value.process.pid += 1; }],
    ["wrong start", (value) => { value.process.startIdentity = "b".repeat(64); }],
    ["wrong checkpoint", (value) => { value.checkpoint.sha256 = "c".repeat(64); }],
    ["wrong publication", (value) => { value.checkpointPublication.sha256 = "d".repeat(64); }],
    ["wrong jsx", (value) => { value.jsxSha256 = "e".repeat(64); }],
    ["wrong comp", (value) => { value.composition.id = "999"; }],
    ["wrong token", (value) => { value.token = "forged-token-value-with-minimum-length-000"; }],
    ["future", (value) => { value.issuedAtMs += 10_000; }, approval.issuedAtMs],
    ["stale", () => undefined, plan.expiresAtMs + 1]
  ];
  for (const [label, mutate, now = approval.issuedAtMs] of mutations) {
    const forged = structuredClone(approval);
    mutate(forged);
    rehashApproval(forged);
    assert.equal(
      verifyAebRetainedAeApproval(plan, forged, now, expected),
      false,
      label
    );
  }
  const unknown = { ...structuredClone(approval), unknown: true } as unknown as AebRetainedAeApproval;
  assert.equal(verifyAebRetainedAeApproval(plan, unknown, approval.issuedAtMs, expected), false);
});

test("result verifier rejects post-checkpoint reopen composition queue output rollback and residue drift", async () => {
  const { plan, approval } = await approvalFixture();
  const valid = validResult(plan, approval);
  assert.equal(verifyAebRetainedAeResult(plan, approval, valid), true);
  const mutations: Array<[string, (value: AebRetainedAeResult) => void]> = [
    ["second app.open", (value) => { value.continuation.appOpenCountAfterCheckpoint = 1 as 0; }],
    ["comp drift", (value) => { value.composition.id = "999"; }],
    ["queue drift", (value) => { value.renderQueue.itemId = "other-queue-item"; }],
    ["rqindex drift", (value) => { value.renderQueue.rqindex = 0; }],
    ["wrong output path", (value) => { value.output.files[0]!.relativePath = "output/other.png"; }],
    ["wrong frame", (value) => { value.output.files[0]!.frameIndex = 1; }],
    ["duplicate output", (value) => { value.output.files.push({ ...value.output.files[0]! }); }],
    ["result before cleanup", (value) => { value.rollback.renderQueueItemRemoved = false as true; }],
    ["rollback failure", (value) => { value.rollback.temporaryItemsRemoved = false as true; }],
    ["project left open", (value) => { value.rollback.projectClosedWithoutSave = false as true; }],
    ["approval not consumed", (value) => { value.continuation.approvalConsumedOnce = false as true; }],
    ["normal close not requested", (value) => { value.continuation.closeRequested = false as true; }],
    ["residue", (value) => { (value.unexpectedResidue as string[]).push("control/approval.json"); }]
  ];
  for (const [label, mutate] of mutations) {
    const forged = structuredClone(valid);
    mutate(forged);
    rehashResult(forged);
    assert.equal(verifyAebRetainedAeResult(plan, approval, forged), false, label);
  }
  const unknown = { ...structuredClone(valid), rawPath: "/private/example" } as unknown as AebRetainedAeResult;
  rehashResult(unknown);
  assert.equal(verifyAebRetainedAeResult(plan, approval, unknown), false);
});

test("RGBA output verifier rejects substitution growth aliases wrong dimensions and wrong alpha", async (t) => {
  for (const mutation of ["substitution", "growth", "symlink", "hardlink", "dimensions", "alpha"] as const) {
    await t.test(mutation, async (t) => {
      let framePath = "";
      let mutated = false;
      const fixture = await createAuthorityFixture(t, `output-${mutation}`, {
        async afterFileOpen(relativePath) {
          if (mutation === "substitution" && relativePath === "output/frame-0000.png" && !mutated) {
            mutated = true;
            const moved = `${framePath}.moved`;
            await rename(framePath, moved);
            await writeFile(framePath, mixedPng());
          }
        },
        async afterFileRead(relativePath) {
          if (mutation === "growth" && relativePath === "output/frame-0000.png" && !mutated) {
            mutated = true;
            await appendFile(framePath, Buffer.from([0]));
          }
        }
      });
      framePath = path.join(fixture.runRoot, "output/frame-0000.png");
      if (mutation === "dimensions") {
        const image = createTransparentImage(5, 4);
        setPixel(image, 1, 1, [255, 0, 0, 255]);
        await writeFile(framePath, encodeRgbaPng(image));
      } else if (mutation === "alpha") {
        const image = createTransparentImage(4, 4);
        for (let y = 0; y < 4; y += 1) {
          for (let x = 0; x < 4; x += 1) setPixel(image, x, y, [255, 0, 0, 255]);
        }
        await writeFile(framePath, encodeRgbaPng(image));
      } else if (mutation === "hardlink" || mutation === "symlink") {
        const outside = path.join(fixture.tempRoot, "outside-frame.png");
        await writeFile(outside, mixedPng());
        if (mutation === "hardlink") await link(outside, framePath);
        else await symlink(outside, framePath);
      } else {
        await writeFile(framePath, mixedPng());
      }
      await assert.rejects(
        () => fixture.authority.verifyRgbaFrame("output/frame-0000.png"),
        (error: unknown) => error instanceof AebRetainedAeDiscriminatorError
      );
    });
  }
});

test("valid mixed-alpha frame is bounded and task residue is explicit", async (t) => {
  const fixture = await createAuthorityFixture(t, "valid-frame");
  await writeFile(path.join(fixture.runRoot, "output/frame-0000.png"), mixedPng());
  const frame = await fixture.authority.verifyRgbaFrame("output/frame-0000.png");
  assert.equal(frame.alpha, "mixed");
  assert.equal(frame.width, 4);
  assert.equal(frame.height, 4);
  assert.equal(frame.decodedRgbaBytes, 64);
  await fixture.authority.writeExclusiveJson("result/unexpected.json", { residue: true }, 1024);
  assert.deepEqual(await fixture.authority.listFiles(), [
    "output/frame-0000.png",
    "result/unexpected.json"
  ]);
});

test("normal close evaluator rejects abnormal exit signal cleanup ordering and residue", () => {
  assert.equal(evaluateAebRetainedAeProcessOutcome({
    exitCode: 0,
    signal: null,
    processGroupGone: true,
    resultPublishedAfterCleanup: true,
    unexpectedResidue: []
  }), "normal_close");
  const failures = [
    { exitCode: 1, signal: null, processGroupGone: true, resultPublishedAfterCleanup: true, unexpectedResidue: [] },
    { exitCode: null, signal: "SIGKILL" as const, processGroupGone: true, resultPublishedAfterCleanup: true, unexpectedResidue: [] },
    { exitCode: 0, signal: null, processGroupGone: false, resultPublishedAfterCleanup: true, unexpectedResidue: [] },
    { exitCode: 0, signal: null, processGroupGone: true, resultPublishedAfterCleanup: false, unexpectedResidue: [] },
    { exitCode: 0, signal: null, processGroupGone: true, resultPublishedAfterCleanup: true, unexpectedResidue: ["control/request.json"] }
  ];
  for (const failure of failures) {
    assert.equal(evaluateAebRetainedAeProcessOutcome(failure), "rejected");
  }
});

test("process-group control rejects bare numeric authority at the runtime export boundary", async () => {
  const processControl = await import("../experiments/aeb-retained-ae-discriminator/process-group.js");
  const publicApi = await import("../experiments/aeb-retained-ae-discriminator/index.js");
  assert.equal("reapAebRetainedAeOwnedProcessGroup" in processControl, false);
  assert.equal("signalAebRetainedAeOwnedProcessGroup" in processControl, false);
  assert.equal("requireAebRetainedAeOwnedProcessGroupGone" in processControl, false);
  assert.equal(processControl.spawnAebRetainedAeConcreteProcess.length, 3);
  assert.equal("spawnAebRetainedAeConcreteProcess" in publicApi, false);
  assert.equal("assertAebRetainedAeProcessSnapshotFacilityAvailable" in publicApi, false);
  assert.equal("runAebRetainedAeProcessControlScenario" in publicApi, false);
  assert.equal("runAebRetainedAeOwnedSubprocessProbe" in publicApi, false);
});

test("process snapshot facility failures stop before run-root creation or retained AE launch", async () => {
  const pgrepUnavailable = await runAebRetainedAeSnapshotFacilityScenario("pgrep_unavailable");
  assert.deepEqual(pgrepUnavailable, {
    outcome: "rejected",
    errorCode: "AE_PROCESS_GROUP_SNAPSHOT_FAILED",
    commands: ["/usr/bin/pgrep -g 999999937"]
  });

  const psUnavailable = await runAebRetainedAeSnapshotFacilityScenario("ps_unavailable");
  assert.deepEqual(psUnavailable, {
    outcome: "rejected",
    errorCode: "AE_PROCESS_GROUP_SNAPSHOT_FAILED",
    commands: [
      "/usr/bin/pgrep -g 999999937",
      "/bin/ps -p 4242 -o pid=,ppid=,pgid=,sess=,lstart=,command="
    ]
  });

  const available = await runAebRetainedAeSnapshotFacilityScenario("available");
  assert.deepEqual(available, {
    outcome: "available",
    errorCode: null,
    commands: [
      "/usr/bin/pgrep -g 999999937",
      "/bin/ps -p 4242 -o pid=,ppid=,pgid=,sess=,lstart=,command="
    ]
  });

  const runtime = await readFile(RUNTIME_SOURCE_PATH, "utf8");
  const staticPreflight = runtime.indexOf("await verifyStaticPreflight(plan);");
  const snapshotPreflight = runtime.indexOf("await assertAebRetainedAeProcessSnapshotFacilityAvailable();");
  const ensureBase = runtime.indexOf("await ensureApprovedBase();");
  const createRunRoot = runtime.indexOf("createAebRetainedAeRunRoot(AEB_RETAINED_AE_TASK_BASE");
  const spawnConcrete = runtime.indexOf("spawnAebRetainedAeConcreteProcess(");
  assert.ok(staticPreflight > 0);
  assert.ok(snapshotPreflight > staticPreflight);
  assert.ok(snapshotPreflight < ensureBase);
  assert.ok(snapshotPreflight < createRunRoot);
  assert.ok(snapshotPreflight < spawnConcrete);
});

test("spawn-derived group authority rejects reuse, ESRCH reuse, and ambiguous membership before signaling another generation", async () => {
  const reuse = await runAebRetainedAeProcessControlScenario("reuse_between_checks");
  assert.deepEqual(reuse, {
    outcome: "rejected",
    errorCode: "AE_PROCESS_GROUP_REUSED",
    signals: [],
    absenceProven: false,
    repeatedCleanupProved: false,
    elapsedMs: 0
  });
  const esrchReuse = await runAebRetainedAeProcessControlScenario("esrch_then_reuse");
  assert.equal(esrchReuse.outcome, "rejected");
  assert.equal(esrchReuse.errorCode, "AE_PROCESS_GROUP_REUSED");
  assert.deepEqual(esrchReuse.signals, ["SIGTERM"]);
  assert.equal(esrchReuse.absenceProven, false);
  const sessionDrift = await runAebRetainedAeProcessControlScenario("session_drift");
  assert.equal(sessionDrift.outcome, "rejected");
  assert.equal(sessionDrift.errorCode, "AE_PROCESS_GROUP_SESSION_AMBIGUOUS");
  assert.deepEqual(sessionDrift.signals, []);
  const ambiguous = await runAebRetainedAeProcessControlScenario("membership_ambiguity");
  assert.equal(ambiguous.outcome, "rejected");
  assert.equal(ambiguous.errorCode, "AE_PROCESS_GROUP_MEMBERSHIP_AMBIGUOUS");
  assert.deepEqual(ambiguous.signals, []);
});

test("signal and delayed escalation faults settle as typed rejections without proving absence", async () => {
  const signalFault = await runAebRetainedAeProcessControlScenario("signal_fault");
  assert.equal(signalFault.outcome, "rejected");
  assert.equal(signalFault.errorCode, "AE_PROCESS_SIGNAL_FAILED");
  assert.deepEqual(signalFault.signals, ["SIGTERM"]);
  assert.equal(signalFault.absenceProven, false);
  const delayedFault = await runAebRetainedAeProcessControlScenario("delayed_signal_fault");
  assert.equal(delayedFault.outcome, "rejected");
  assert.equal(delayedFault.errorCode, "AE_PROCESS_SIGNAL_FAILED");
  assert.deepEqual(delayedFault.signals, ["SIGTERM", "SIGKILL"]);
  assert.equal(delayedFault.absenceProven, false);
  assert.ok(delayedFault.elapsedMs >= 50);
});

test("delayed KILL, repeated cleanup, and run-root gate require affirmative absence", async () => {
  const delayedKill = await runAebRetainedAeProcessControlScenario("delayed_kill");
  assert.equal(delayedKill.outcome, "reaped");
  assert.deepEqual(delayedKill.signals, ["SIGTERM", "SIGKILL"]);
  assert.equal(delayedKill.absenceProven, true);
  assert.ok(delayedKill.elapsedMs >= 75);
  const repeated = await runAebRetainedAeProcessControlScenario("repeated_cleanup");
  assert.equal(repeated.outcome, "reaped");
  assert.equal(repeated.absenceProven, true);
  assert.equal(repeated.repeatedCleanupProved, true);
  assert.deepEqual(repeated.signals, ["SIGTERM"]);
  assert.equal(evaluateAebRetainedAeRunRootCleanup("not_started"), "remove");
  assert.equal(evaluateAebRetainedAeRunRootCleanup("spawned_unproven"), "preserve");
  assert.equal(evaluateAebRetainedAeRunRootCleanup("absence_proven"), "remove");
});

test("owned process-group cleanup reaps a signal-resistant descendant through the spawn-derived authority", async (t) => {
  if (await skipWhenProcessSnapshotFacilityUnavailable(t)) return;
  assert.deepEqual(await runAebRetainedAeOwnedSubprocessProbe(), {
    completionRejected: true,
    processGroupAbsenceProven: true
  });
});

test("abort, output, and timeout callbacks settle once and reap before returning", async (t) => {
  if (await skipWhenProcessSnapshotFacilityUnavailable(t)) return;
  const abort = await runAebRetainedAeCallbackSubprocessProbe("abort");
  assert.equal(abort.terminalMessage, "AE_PROCESS_CANCELLED");
  assert.equal(abort.processGroupAbsenceProven, true);
  const output = await runAebRetainedAeCallbackSubprocessProbe("output_overflow");
  assert.equal(output.terminalMessage, "AE_PROCESS_OUTPUT_LIMIT_EXCEEDED");
  assert.equal(output.processGroupAbsenceProven, true);
  const timeout = await runAebRetainedAeCallbackSubprocessProbe("timeout");
  assert.equal(timeout.terminalMessage, "AE_PROCESS_TIMEOUT");
  assert.equal(timeout.processGroupAbsenceProven, true);
});

test("concrete JSX is one retained transaction with no app.open or aerender path reopen", async () => {
  const jsx = await readFile(JSX_PATH, "utf8");
  const runtime = await readFile(RUNTIME_SOURCE_PATH, "utf8");
  const processGroup = await readFile(PROCESS_GROUP_SOURCE_PATH, "utf8");
  const filesystem = await readFile(FILESYSTEM_SOURCE_PATH, "utf8");
  assert.equal(jsx.includes("app.open("), false);
  assert.equal(jsx.includes("aerender"), false);
  assert.equal((jsx.match(/app\.project\.renderQueue\.render\(\)/g) ?? []).length, 1);
  assert.ok(jsx.indexOf("app.project.save(checkpointFile)") < jsx.indexOf("approval = waitForApproval(approvalFile"));
  assert.ok(jsx.indexOf("approval = waitForApproval(approvalFile") < jsx.indexOf("facts = scanFixture(fixtureComp)"));
  assert.ok(jsx.indexOf("facts = scanFixture(fixtureComp)") < jsx.indexOf("result = renderFixture(plan, approval"));
  assert.ok(jsx.includes("app.project.close(CloseOptions.DO_NOT_SAVE_CHANGES)"));
  assert.ok(jsx.includes("app.quit()"));
  assert.ok(jsx.includes("$.sleep(25)"));
  assert.ok(jsx.includes("Math.min(plan.expiresAtMs, plan.createdAtMs + plan.budgets.approvalWaitMs)"));
  assert.ok(jsx.includes("temporary.rename(file.name)"));
  assert.ok(processGroup.includes("AEB_RETAINED_AE_EXPECTED_HOST.executablePath"));
  assert.equal(runtime.includes("process.env"), false);
  assert.equal(runtime.includes("process.kill"), false);
  assert.equal(runtime.includes("safeToRemoveRunRoot"), false);
  assert.ok(runtime.includes("spawned_unproven"));
  assert.ok(runtime.includes("absence_proven"));
  assert.ok(runtime.includes("evaluateAebRetainedAeRunRootCleanup(processCleanupState)"));
  assert.equal(runtime.includes("runRootBinding\n        ).catch(() => undefined)"), false);
  assert.equal(processGroup.includes("export async function reapAebRetainedAeOwnedProcessGroup"), false);
  assert.equal(processGroup.includes("setTimeout(\n      () => signal"), false);
  assert.ok(filesystem.includes("await link(temporary, target)"));
  assert.equal(runtime.includes("aerender"), false);
  assert.equal(`${jsx}\n${runtime}\n${processGroup}`.includes("actualAeRenderExecuted"), false);
  assert.equal(`${jsx}\n${runtime}\n${processGroup}`.includes("/Users/"), false);
});

test("malformed identifiers and raw paths fail without leaking raw path text", () => {
  const rawPath = "/Users/private-owner/project.aep";
  assert.throws(
    () => createSyntheticAebRetainedAeDiscriminatorPlan({ taskId: rawPath, executionId: "execution-safe-id" }),
    (error: unknown) => {
      assert.ok(error instanceof AebRetainedAeDiscriminatorError);
      assert.equal(error.code, "TASK_ID_INVALID");
      assert.equal(error.message.includes(rawPath), false);
      return true;
    }
  );
});

async function createAuthorityFixture(
  t: TestContext,
  label: string,
  hooks: Parameters<typeof NodeAebRetainedAeRunAuthority.open>[2] = {}
): Promise<{
  tempRoot: string;
  base: string;
  runName: string;
  runRoot: string;
  authority: NodeAebRetainedAeRunAuthority;
}> {
  const createdTempRoot = await mkdtemp(path.join(os.tmpdir(), `aeb-retained-${label}-`));
  const tempRoot = await realpath(createdTempRoot);
  const base = path.join(tempRoot, "base");
  await mkdir(base, { mode: 0o700 });
  await chmod(base, 0o700);
  const runName = `run-${sha256(label.padEnd(8, "_")).slice(0, 64)}`;
  const runRootBinding = await createAebRetainedAeRunRoot(base, runName);
  const runRoot = runRootBinding.canonicalPath;
  const authority = await NodeAebRetainedAeRunAuthority.open(base, runName, hooks);
  t.after(async () => {
    await authority.close();
    await rm(tempRoot, { recursive: true, force: true });
  });
  return { tempRoot, base, runName, runRoot, authority };
}

async function skipWhenProcessSnapshotFacilityUnavailable(t: TestContext): Promise<boolean> {
  try {
    await assertAebRetainedAeProcessSnapshotFacilityAvailable();
    return false;
  } catch (error) {
    if (error instanceof AebRetainedAeDiscriminatorError
      && error.code === "AE_PROCESS_GROUP_SNAPSHOT_FAILED") {
      t.skip("process-group snapshot facility unavailable in this worker runtime");
      return true;
    }
    throw error;
  }
}

async function publishSyntheticCheckpoint(authority: NodeAebRetainedAeRunAuthority): Promise<void> {
  await authority.writeExclusiveJson(
    "checkpoint/checkpoint.aep",
    { syntheticAep: true },
    AEB_RETAINED_AE_BUDGETS.maxCheckpointBytes
  );
  await authority.writeExclusiveJson(
    "checkpoint/publication.json",
    { syntheticPublication: true },
    AEB_RETAINED_AE_BUDGETS.maxExchangeBytes
  );
}

async function approvalFixture(): Promise<{
  plan: AebRetainedAeRuntimePlan;
  approval: AebRetainedAeApproval;
  expected: {
    process: AebRetainedAeProcessBinding;
    checkpoint: AebRetainedAeFileBinding;
    checkpointPublication: AebRetainedAeFileBinding;
    composition: { id: string; name: string };
  };
}> {
  const token = "runtime-approval-token-abcdefghijklmnopqrstuvwxyz-0123456789";
  const jsxHash = sha256(await readFile(JSX_PATH));
  const createdAtMs = 1_800_000_000_000;
  const plan = createAebRetainedAeRuntimePlan(
    { taskId: "task-approval-probe", executionId: "execution-approval-probe" },
    jsxHash,
    sha256(token),
    createdAtMs
  );
  const processBinding: AebRetainedAeProcessBinding = {
    pid: 4242,
    startIdentity: "f".repeat(64),
    executablePath: AEB_RETAINED_AE_EXPECTED_HOST.executablePath,
    executableSha256: AEB_RETAINED_AE_EXPECTED_HOST.executableSha256,
    bundleId: AEB_RETAINED_AE_EXPECTED_HOST.bundleId,
    version: AEB_RETAINED_AE_EXPECTED_HOST.version,
    build: AEB_RETAINED_AE_EXPECTED_HOST.build,
    teamId: AEB_RETAINED_AE_EXPECTED_HOST.teamId,
    cdHash: AEB_RETAINED_AE_EXPECTED_HOST.cdHash,
    codeResourcesSha256: AEB_RETAINED_AE_EXPECTED_HOST.codeResourcesSha256
  };
  const checkpoint = fileBinding("checkpoint/checkpoint.aep", "a");
  const checkpointPublication = fileBinding("checkpoint/publication.json", "b");
  const composition = { id: "101", name: plan.fixture.compositionName };
  const approval = createAebRetainedAeApproval({
    schemaVersion: "aeb-retained-ae-checkpoint-approval-v1",
    taskId: plan.taskId,
    executionId: plan.executionId,
    planHash: plan.planHash,
    phase: "checkpoint_approved",
    token,
    tokenSha256: plan.approvalTokenSha256,
    issuedAtMs: createdAtMs + 1,
    expiresAtMs: Math.min(plan.expiresAtMs, plan.createdAtMs + plan.budgets.approvalWaitMs),
    process: processBinding,
    checkpoint,
    checkpointPublication,
    jsxSha256: plan.jsx.sha256,
    composition,
    marker: plan.fixture.marker,
    budgets: AEB_RETAINED_AE_BUDGETS
  });
  return {
    plan,
    approval,
    expected: { process: processBinding, checkpoint, checkpointPublication, composition }
  };
}

function validResult(plan: AebRetainedAeRuntimePlan, approval: AebRetainedAeApproval): AebRetainedAeResult {
  const unsigned: Omit<AebRetainedAeResult, "resultHash"> = {
    schemaVersion: "aeb-retained-ae-discriminator-result-v1",
    taskId: plan.taskId,
    executionId: plan.executionId,
    planHash: plan.planHash,
    phase: "transaction_completed",
    tokenSha256: approval.tokenSha256,
    process: { pid: approval.process.pid, startIdentity: approval.process.startIdentity },
    marker: plan.fixture.marker,
    authorityContext: structuredClone(plan.authorityContext),
    composition: approval.composition,
    scanFacts: {
      twoDOnly: true,
      effectMatchNames: ["ADBE Fill"],
      maskModes: ["add"],
      expressionCount: 1,
      audio: false,
      threeD: false,
      camera: false,
      thirdPartyPlugins: false
    },
    renderQueue: {
      itemId: `${plan.fixture.marker}-rq-1`,
      rqindex: 1,
      outputModuleTemplate: "PNG Sequence with Alpha",
      renderStatus: "done"
    },
    output: { files: [{ relativePath: plan.fixture.outputRelativePath, frameIndex: 0 }] },
    rollback: {
      renderQueueItemRemoved: true,
      temporaryItemsRemoved: true,
      projectClosedWithoutSave: true
    },
    continuation: {
      appOpenCountAfterCheckpoint: 0,
      approvalConsumedOnce: true,
      closeRequested: true
    },
    unexpectedResidue: []
  };
  return { ...unsigned, resultHash: hashCanonical(unsigned) };
}

function fileBinding(relativePath: string, seed: string): AebRetainedAeFileBinding {
  return {
    relativePath,
    sha256: seed.repeat(64),
    byteCount: 128,
    device: "1",
    inode: seed === "a" ? "10" : "11",
    linkCount: 1,
    identityDigest: sha256(`${relativePath}\0${seed}`)
  };
}

function rehashApproval(approval: AebRetainedAeApproval): void {
  const unsigned = { ...approval };
  delete (unsigned as Partial<AebRetainedAeApproval>).approvalHash;
  approval.approvalHash = hashCanonical(unsigned);
}

function rehashResult(result: AebRetainedAeResult): void {
  const unsigned = { ...result };
  delete (unsigned as Partial<AebRetainedAeResult>).resultHash;
  result.resultHash = hashCanonical(unsigned);
}

function mixedPng(): Buffer {
  const image = createTransparentImage(4, 4);
  setPixel(image, 1, 1, [255, 0, 0, 255]);
  return encodeRgbaPng(image);
}

async function assertDiscriminatorError(
  action: () => unknown | Promise<unknown>,
  expectedCode: string,
  alternativeCodes: readonly string[] = []
): Promise<void> {
  await assert.rejects(
    async () => action(),
    (error: unknown) => {
      assert.ok(error instanceof AebRetainedAeDiscriminatorError);
      assert.ok([expectedCode, ...alternativeCodes].includes(error.code), `${error.code} not expected`);
      return true;
    }
  );
}
