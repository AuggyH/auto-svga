import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import {
  cpSync,
  existsSync,
  linkSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  symlinkSync,
  writeFileSync
} from "node:fs";
import { test } from "node:test";
import path from "node:path";

import {
  atomicSwapApps,
  classifyRollbackState,
  inspectAppBundle,
  inspectRecoveryState,
  recoverRollbackTransaction,
  rollbackPreviousApp
} from "./local-stable-recovery.mjs";
import { parseArgs } from "./promote-local-stable-app.mjs";

const installedBuild = "a".repeat(40);
const previousBuild = "b".repeat(40);
const candidateBuild = "c".repeat(40);

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function createFixtureRoot() {
  return mkdtempSync("/private/tmp/auto-svga-rollback-test-");
}

function createFixtureApp(appPath, buildCommit, marker = buildCommit) {
  const contents = path.join(appPath, "Contents");
  const resources = path.join(contents, "Resources");
  const executableRoot = path.join(contents, "MacOS");
  mkdirSync(resources, { recursive: true });
  mkdirSync(executableRoot, { recursive: true });
  writeFileSync(path.join(contents, "Info.plist"), JSON.stringify({
    name: "Auto SVGA",
    displayName: "Auto SVGA",
    executable: "Auto SVGA",
    shortVersion: "0.2.0-alpha.2",
    marker
  }));
  writeFileSync(path.join(executableRoot, "Auto SVGA"), `executable:${marker}`);
  writeFileSync(path.join(resources, "app.asar"), JSON.stringify({
    buildInfo: {
      schemaVersion: 1,
      buildCommit,
      source: "package-internal-trial",
      productMilestoneId: "0.2-multiformat-preview",
      marker
    }
  }));
  writeFileSync(path.join(resources, "marker.txt"), marker);
  return appPath;
}

function readFixturePlistIdentity(plistPath) {
  return JSON.parse(readFileSync(plistPath, "utf8"));
}

function readFixtureRuntimeIdentity(asarPath) {
  const payload = JSON.parse(readFileSync(asarPath, "utf8"));
  const buildInfoBuffer = Buffer.from(JSON.stringify(payload.buildInfo));
  return {
    buildInfo: payload.buildInfo,
    buildInfoSha256: sha256(buildInfoBuffer),
    runtimeClosure: {
      validated: true,
      requiredEntries: Array.from({ length: 13 }, (_, index) => `/fixture/${index}`),
      missingEntries: [],
      dependencies: [],
      findings: []
    }
  };
}

function fixtureInspector(appPath) {
  return inspectAppBundle(appPath, {
    readPlistIdentity: readFixturePlistIdentity,
    readRuntimeIdentity: readFixtureRuntimeIdentity
  });
}

function bindingFromIdentity(identity) {
  return {
    buildCommit: identity.buildInfo.buildCommit,
    infoPlistSha256: identity.infoPlist.sha256,
    appAsarSha256: identity.appAsar.sha256,
    buildInfoSha256: identity.buildInfo.sha256
  };
}

function makeRollbackFixture() {
  const root = createFixtureRoot();
  const target = createFixtureApp(path.join(root, "Auto SVGA.app"), installedBuild, "installed");
  const previous = createFixtureApp(path.join(root, "Auto SVGA.previous.app"), previousBuild, "previous");
  const candidate = createFixtureApp(path.join(root, "Candidate.app"), candidateBuild, "candidate");
  const installedIdentity = fixtureInspector(target);
  const previousIdentity = fixtureInspector(previous);
  const rollbackId = "ASV-TEST-ROLLBACK-001";
  return {
    root,
    target,
    previous,
    candidate,
    rollbackId,
    rollbackManifestPath: path.join(root, "evidence", `${rollbackId}.manifest.json`),
    rollbackJournalPath: path.join(root, "evidence", `${rollbackId}.journal.json`),
    bindings: {
      installed: bindingFromIdentity(installedIdentity),
      previous: bindingFromIdentity(previousIdentity)
    }
  };
}

function fixtureDependencies(overrides = {}) {
  return {
    inspectBundle: fixtureInspector,
    assertNoProcess: () => ({ ps: "clear", pgrep: "clear" }),
    registerLaunchServices: () => true,
    ...overrides
  };
}

function snapshotTree(root) {
  const result = [];
  function visit(entryPath) {
    const stat = lstatSync(entryPath);
    const relativePath = path.relative(root, entryPath) || ".";
    result.push({
      path: relativePath,
      mode: stat.mode,
      size: stat.size,
      mtimeMs: stat.mtimeMs,
      ctimeMs: stat.ctimeMs,
      contentSha256: stat.isFile() ? sha256(readFileSync(entryPath)) : null
    });
    if (stat.isDirectory()) {
      for (const name of readdirSync(entryPath).sort()) visit(path.join(entryPath, name));
    }
  }
  visit(root);
  return result;
}

function assertRoleState(fixture, expected) {
  assert.equal(existsSync(fixture.target), true, "installed app must always exist");
  assert.equal(existsSync(fixture.previous), true, "previous app must always exist");
  const installed = fixtureInspector(fixture.target);
  const previous = fixtureInspector(fixture.previous);
  const classification = classifyRollbackState({ installed, previous, bindings: fixture.bindings });
  assert.equal(classification.state, expected);
}

test("CLI parses separate inspect, rollback, and recovery modes with exact bindings", () => {
  const inspect = parseArgs(["--inspect", "--rollback-id", "ASV-TEST-1"]);
  assert.equal(inspect.inspect, true);
  assert.equal(inspect.rollbackId, "ASV-TEST-1");

  const rollback = parseArgs([
    "--rollback-previous",
    "--rollback-id", "ASV-TEST-2",
    "--expected-installed-build", installedBuild,
    "--expected-installed-info-plist-sha256", "1".repeat(64),
    "--expected-installed-app-asar-sha256", "2".repeat(64),
    "--expected-installed-build-info-sha256", "3".repeat(64),
    "--expected-previous-build", previousBuild,
    "--expected-previous-info-plist-sha256", "4".repeat(64),
    "--expected-previous-app-asar-sha256", "5".repeat(64),
    "--expected-previous-build-info-sha256", "6".repeat(64)
  ]);
  assert.equal(rollback.rollbackPrevious, true);
  assert.equal(rollback.expectedInstalledBuild, installedBuild);
  assert.throws(() => parseArgs(["--inspect", "--rollback-previous"]), /mutually exclusive/);
  assert.throws(() => parseArgs(["--rollback-previous", "--use-existing"]), /do not accept packaging/);
});

test("inspect is behaviorally read-only for installed, previous, and candidate apps", () => {
  const fixture = makeRollbackFixture();
  try {
    const before = snapshotTree(fixture.root);
    const report = inspectRecoveryState({
      target: fixture.target,
      candidateApp: fixture.candidate,
      inspectBundle: fixtureInspector,
      now: () => new Date("2026-07-15T00:00:00.000Z")
    });
    const after = snapshotTree(fixture.root);
    assert.deepEqual(after, before);
    assert.equal(report.mutationPerformed, false);
    assert.equal(report.installed.buildInfo.buildCommit, installedBuild);
    assert.equal(report.previous.buildInfo.buildCommit, previousBuild);
    assert.equal(report.candidate.buildInfo.buildCommit, candidateBuild);
  } finally {
    rmSync(fixture.root, { recursive: true, force: true });
  }
});

test("bundle inspection rejects root aliases, escaping symlinks, and hardlinks", () => {
  const fixture = makeRollbackFixture();
  try {
    const alias = path.join(fixture.root, "Alias.app");
    symlinkSync(fixture.target, alias);
    assert.throws(() => fixtureInspector(alias), /real directory|aliases/);

    const escaping = path.join(fixture.target, "Contents", "escape");
    symlinkSync("/private/tmp", escaping);
    assert.throws(() => fixtureInspector(fixture.target), /symlink escapes/);
    rmSync(escaping);

    const executable = path.join(fixture.target, "Contents/MacOS/Auto SVGA");
    linkSync(executable, path.join(fixture.target, "Contents/MacOS/Auto SVGA hardlink"));
    assert.throws(() => fixtureInspector(fixture.target), /hardlink/);
  } finally {
    rmSync(fixture.root, { recursive: true, force: true });
  }
});

test("bundle inspection accepts contained framework-style symlinks and rejects mid-read replacement", () => {
  const fixture = makeRollbackFixture();
  try {
    symlinkSync("marker.txt", path.join(fixture.target, "Contents/Resources/marker-link"));
    assert.equal(fixtureInspector(fixture.target).buildInfo.buildCommit, installedBuild);

    const plistPath = path.join(fixture.target, "Contents/Info.plist");
    assert.throws(() => inspectAppBundle(fixture.target, {
      readPlistIdentity: (inputPath) => {
        const identity = readFixturePlistIdentity(inputPath);
        writeFileSync(inputPath, `${readFileSync(inputPath, "utf8")} `);
        return identity;
      },
      readRuntimeIdentity: readFixtureRuntimeIdentity
    }), /Info\.plist changed/);
    writeFileSync(plistPath, JSON.stringify({
      name: "Auto SVGA",
      displayName: "Auto SVGA",
      executable: "Auto SVGA",
      shortVersion: "0.2.0-alpha.2",
      marker: "installed"
    }));

    assert.throws(() => inspectAppBundle(fixture.target, {
      readPlistIdentity: readFixturePlistIdentity,
      readRuntimeIdentity: (asarPath) => {
        const identity = readFixtureRuntimeIdentity(asarPath);
        writeFileSync(asarPath, `${readFileSync(asarPath, "utf8")} `);
        return identity;
      }
    }), /app\.asar changed/);
  } finally {
    rmSync(fixture.root, { recursive: true, force: true });
  }
});

test("darwin helper performs one genuine renameatx_np RENAME_SWAP", () => {
  const root = createFixtureRoot();
  const left = path.join(root, "left");
  const right = path.join(root, "right");
  mkdirSync(left);
  mkdirSync(right);
  writeFileSync(path.join(left, "marker"), "left");
  writeFileSync(path.join(right, "marker"), "right");
  try {
    const leftStat = lstatSync(left);
    const rightStat = lstatSync(right);
    const result = atomicSwapApps(left, right, {
      leftObject: { dev: String(leftStat.dev), ino: String(leftStat.ino) },
      rightObject: { dev: String(rightStat.dev), ino: String(rightStat.ino) }
    });
    assert.equal(result.primitive, "renameatx_np");
    assert.equal(result.flags, "RENAME_SWAP");
    assert.equal(result.parentDirectoryFsynced, true);
    assert.equal(readFileSync(path.join(left, "marker"), "utf8"), "right");
    assert.equal(readFileSync(path.join(right, "marker"), "utf8"), "left");
    assert.throws(() => atomicSwapApps(left, right, {
      leftObject: { dev: String(leftStat.dev), ino: String(leftStat.ino) },
      rightObject: { dev: String(rightStat.dev), ino: String(rightStat.ino) }
    }), /directory object changed/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("rollback atomically swaps exact-bound apps and publishes a no-retry manifest", () => {
  const fixture = makeRollbackFixture();
  try {
    let registeredBuild = null;
    const result = rollbackPreviousApp({
      ...fixture,
      dependencies: fixtureDependencies({
        registerLaunchServices: (target) => {
          registeredBuild = fixtureInspector(target).buildInfo.buildCommit;
          return true;
        }
      })
    });
    assertRoleState(fixture, "swapped-roles");
    assert.equal(registeredBuild, previousBuild, "LaunchServices must run only after byte postconditions");
    assert.equal(result.manifest.retrySafe, false);
    assert.equal(result.manifest.invocationCount, 1);
    assert.equal(result.manifest.atomicPrimitive.name, "renameatx_np");
    assert.equal(existsSync(fixture.rollbackManifestPath), true);
    assert.equal(existsSync(fixture.rollbackJournalPath), false);
    assert.equal(existsSync(path.join(fixture.root, `.Auto-SVGA.rollback-${fixture.rollbackId}.stage.app`)), false);
  } finally {
    rmSync(fixture.root, { recursive: true, force: true });
  }
});

test("rollback fails closed before mutation on stale bindings, same-build ambiguity, residue, and a running process", () => {
  for (const scenario of ["stale", "same-build", "residue", "process"]) {
    const fixture = makeRollbackFixture();
    try {
      const targetBefore = fixtureInspector(fixture.target);
      const previousBefore = fixtureInspector(fixture.previous);
      const dependencies = fixtureDependencies();
      if (scenario === "stale") fixture.bindings.installed.appAsarSha256 = "0".repeat(64);
      if (scenario === "same-build") {
        rmSync(fixture.previous, { recursive: true });
        cpSync(fixture.target, fixture.previous, { recursive: true });
        fixture.bindings.previous = bindingFromIdentity(fixtureInspector(fixture.previous));
      }
      if (scenario === "residue") {
        mkdirSync(path.dirname(fixture.rollbackManifestPath), { recursive: true });
        writeFileSync(fixture.rollbackManifestPath, "collision");
      }
      if (scenario === "process") dependencies.assertNoProcess = () => { throw new Error("target running"); };
      assert.throws(() => rollbackPreviousApp({ ...fixture, dependencies }), /binding|ambiguous|collision|running/);
      assert.equal(fixtureInspector(fixture.target).buildInfo.buildCommit, targetBefore.buildInfo.buildCommit);
      assert.equal(
        fixtureInspector(fixture.previous).buildInfo.buildCommit,
        scenario === "same-build" ? installedBuild : previousBefore.buildInfo.buildCommit
      );
    } finally {
      rmSync(fixture.root, { recursive: true, force: true });
    }
  }
});

test("partial staging and a second process check never remove or mix either app", () => {
  for (const scenario of ["partial-stage", "late-process"]) {
    const fixture = makeRollbackFixture();
    try {
      let processChecks = 0;
      const dependencies = fixtureDependencies({
        copyBundle: scenario === "partial-stage"
          ? (source, destination) => {
              mkdirSync(destination, { recursive: true });
              writeFileSync(path.join(destination, "partial"), "partial");
              throw new Error("simulated partial copy");
            }
          : (source, destination) => cpSync(source, destination, { recursive: true }),
        assertNoProcess: () => {
          processChecks += 1;
          if (scenario === "late-process" && processChecks === 2) throw new Error("target started after staging");
          return { ps: "clear", pgrep: "clear" };
        }
      });
      assert.throws(() => rollbackPreviousApp({ ...fixture, dependencies }), /partial copy|started after staging/);
      assertRoleState(fixture, "original-roles");
      assert.equal(existsSync(fixture.rollbackJournalPath), true, "durable residue must expose interrupted work");
      const recovery = recoverRollbackTransaction({ ...fixture, dependencies: fixtureDependencies() });
      assert.equal(recovery.disposition, "aborted-before-atomic-swap");
      assertRoleState(fixture, "original-roles");
      assert.equal(existsSync(fixture.rollbackJournalPath), false);
    } finally {
      rmSync(fixture.root, { recursive: true, force: true });
    }
  }
});

test("identity growth after staging is detected before atomic swap", () => {
  const fixture = makeRollbackFixture();
  try {
    assert.throws(() => rollbackPreviousApp({
      ...fixture,
      dependencies: fixtureDependencies({
        checkpoint: (phase) => {
          if (phase === "after-stage-validation") {
            writeFileSync(path.join(fixture.target, "Contents/late-growth"), "late");
          }
        }
      })
    }), /changed after preflight/);
    assert.equal(fixtureInspector(fixture.target).buildInfo.buildCommit, installedBuild);
    assert.equal(fixtureInspector(fixture.previous).buildInfo.buildCommit, previousBuild);
  } finally {
    rmSync(fixture.root, { recursive: true, force: true });
  }
});

test("a target process observed after atomic swap blocks LaunchServices and leaves recovery authority", () => {
  const fixture = makeRollbackFixture();
  try {
    let processChecks = 0;
    let launchServicesCalls = 0;
    assert.throws(() => rollbackPreviousApp({
      ...fixture,
      dependencies: fixtureDependencies({
        assertNoProcess: () => {
          processChecks += 1;
          if (processChecks === 3) throw new Error("target started after atomic swap");
          return { ps: "clear", pgrep: "clear" };
        },
        registerLaunchServices: () => {
          launchServicesCalls += 1;
          return true;
        }
      })
    }), /started after atomic swap/);
    assertRoleState(fixture, "swapped-roles");
    assert.equal(launchServicesCalls, 0);
    assert.equal(existsSync(fixture.rollbackJournalPath), true);
    const recovery = recoverRollbackTransaction({ ...fixture, dependencies: fixtureDependencies() });
    assert.equal(recovery.disposition, "completed-after-atomic-swap");
  } finally {
    rmSync(fixture.root, { recursive: true, force: true });
  }
});

test("manifest publication failure leaves swapped roles journaled for recovery", () => {
  const fixture = makeRollbackFixture();
  try {
    assert.throws(() => rollbackPreviousApp({
      ...fixture,
      dependencies: fixtureDependencies({
        writeManifestExclusive: () => { throw new Error("manifest publication failed"); }
      })
    }), /manifest publication failed/);
    assertRoleState(fixture, "swapped-roles");
    assert.equal(existsSync(fixture.rollbackJournalPath), true);
    assert.equal(existsSync(fixture.rollbackManifestPath), false);

    const recovery = recoverRollbackTransaction({
      ...fixture,
      dependencies: fixtureDependencies()
    });
    assert.equal(recovery.disposition, "completed-after-atomic-swap");
    assertRoleState(fixture, "swapped-roles");
    assert.equal(existsSync(fixture.rollbackManifestPath), true);
  } finally {
    rmSync(fixture.root, { recursive: true, force: true });
  }
});

test("inspect reports a durable journal-update residue and recovery cleans only matching authority", () => {
  const fixture = makeRollbackFixture();
  try {
    assert.throws(() => rollbackPreviousApp({
      ...fixture,
      dependencies: fixtureDependencies({
        checkpoint: (phase) => {
          if (phase === "before-journal-prepared") {
            const journal = JSON.parse(readFileSync(fixture.rollbackJournalPath, "utf8"));
            writeFileSync(`${fixture.rollbackJournalPath}.next`, JSON.stringify({ ...journal, phase: "prepared-next" }));
            throw new Error("simulated journal update crash");
          }
        }
      })
    }), /journal update crash/);
    const report = inspectRecoveryState({
      target: fixture.target,
      candidateApp: fixture.candidate,
      rollbackJournalPath: fixture.rollbackJournalPath,
      rollbackManifestPath: fixture.rollbackManifestPath,
      inspectBundle: fixtureInspector
    });
    assert.equal(report.rollback.journalNextExists, true);
    assert.equal(report.rollback.classification.state, "original-roles");
    const recovery = recoverRollbackTransaction({ ...fixture, dependencies: fixtureDependencies() });
    assert.equal(recovery.disposition, "aborted-before-atomic-swap");
    assert.equal(existsSync(`${fixture.rollbackJournalPath}.next`), false);
  } finally {
    rmSync(fixture.root, { recursive: true, force: true });
  }
});

const crashPoints = [
  ["before-journal-preparing", "original-roles"],
  ["after-journal-preparing", "original-roles"],
  ["before-stage-copy", "original-roles"],
  ["after-stage-copy", "original-roles"],
  ["before-journal-prepared", "original-roles"],
  ["after-stage-validation", "original-roles"],
  ["before-atomic-swap", "original-roles"],
  ["after-atomic-swap", "swapped-roles"],
  ["before-journal-swapped", "swapped-roles"],
  ["after-swapped-postcheck", "swapped-roles"],
  ["before-launch-services", "swapped-roles"],
  ["after-launch-services-before-journal", "swapped-roles"],
  ["after-launch-services", "swapped-roles"],
  ["before-manifest-published", "swapped-roles"],
  ["after-manifest-write-before-journal", "swapped-roles"],
  ["after-manifest-published", "swapped-roles"],
  ["before-stage-cleanup", "swapped-roles"],
  ["after-stage-remove-before-journal", "swapped-roles"],
  ["after-stage-cleanup", "swapped-roles"],
  ["before-final-process-check", "swapped-roles"],
  ["after-final-process-check", "swapped-roles"],
  ["before-journal-cleanup", "swapped-roles"],
  ["after-journal-cleanup", "swapped-roles"]
];

for (const [crashPoint, expectedState] of crashPoints) {
  test(`simulated crash at ${crashPoint} leaves two deterministic app roles`, () => {
    const fixture = makeRollbackFixture();
    try {
      assert.throws(() => rollbackPreviousApp({
        ...fixture,
        dependencies: fixtureDependencies({
          checkpoint: (phase) => {
            if (phase === crashPoint) throw new Error(`simulated crash:${phase}`);
          }
        })
      }), new RegExp(`simulated crash:${crashPoint}`));
      assertRoleState(fixture, expectedState);
    } finally {
      rmSync(fixture.root, { recursive: true, force: true });
    }
  });
}

test("recovery only completes the durable state and never starts a second rollback", () => {
  for (const [crashPoint, expectedDisposition, expectedState] of [
    ["after-stage-validation", "aborted-before-atomic-swap", "original-roles"],
    ["after-atomic-swap", "completed-after-atomic-swap", "swapped-roles"]
  ]) {
    const fixture = makeRollbackFixture();
    try {
      assert.throws(() => rollbackPreviousApp({
        ...fixture,
        dependencies: fixtureDependencies({
          checkpoint: (phase) => {
            if (phase === crashPoint) throw new Error(`simulated crash:${phase}`);
          }
        })
      }), /simulated crash/);
      const result = recoverRollbackTransaction({
        ...fixture,
        dependencies: fixtureDependencies()
      });
      assert.equal(result.disposition, expectedDisposition);
      assertRoleState(fixture, expectedState);
      assert.equal(existsSync(fixture.rollbackJournalPath), false);
      assert.equal(existsSync(path.join(fixture.root, `.Auto-SVGA.rollback-${fixture.rollbackId}.stage.app`)), false);
      assert.equal(existsSync(fixture.rollbackManifestPath), expectedState === "swapped-roles");
    } finally {
      rmSync(fixture.root, { recursive: true, force: true });
    }
  }
});
