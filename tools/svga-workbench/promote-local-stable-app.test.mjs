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
  renameSync,
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
import { installApp, parseArgs } from "./promote-local-stable-app.mjs";

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
  if (plistPath?.bytes) return JSON.parse(plistPath.bytes.toString("utf8"));
  return JSON.parse(readFileSync(plistPath, "utf8"));
}

function readFixtureRuntimeIdentity(asarPath) {
  const payload = JSON.parse((asarPath?.bytes ?? readFileSync(asarPath)).toString("utf8"));
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

function assertBundleBinding(appPath, expected) {
  assert.deepEqual(bindingFromIdentity(fixtureInspector(appPath)), bindingFromIdentity(expected));
}

function swapFixtureDirectories(left, right) {
  const temporary = path.join(path.dirname(left), `.swap-${process.pid}-${Date.now()}`);
  renameSync(left, temporary);
  renameSync(right, left);
  renameSync(temporary, right);
}

function promoteFixtureDependencies(fixture, overrides = {}) {
  const stagingRoot = path.join(fixture.root, "promotion-stage");
  return {
    inspectBundle: fixtureInspector,
    validateIdentity: (appPath) => fixtureInspector(appPath),
    clearQuarantine: () => {},
    copyBundle: (source, destination) => cpSync(source, destination, { recursive: true }),
    createStagingRoot: () => {
      mkdirSync(stagingRoot);
      return stagingRoot;
    },
    preflightDestination: () => {},
    atomicSwap: (left, right) => swapFixtureDirectories(left, right),
    stagingRoot,
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
  const inspect = parseArgs(["--inspect"]);
  assert.equal(inspect.inspect, true);

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
  assert.throws(() => parseArgs(["--inspect", "--inspect"]), /Duplicate option/);
  assert.throws(() => parseArgs(["--inspect", "--rollback-id", "ASV-TEST-1"]), /Inspect mode/);
  assert.throws(() => parseArgs(["--inspect", "--target", "/tmp/a", "--target", "/tmp/b"]), /Duplicate option/);
  assert.throws(() => parseArgs(["--recover-rollback", "--rollback-id", "../../outside"]), /rollback-id/);
  assert.throws(() => parseArgs([
    "--rollback-previous",
    "--rollback-id", "ASV-TEST-2",
    "--expected-installed-build", "not-a-sha",
    "--expected-installed-info-plist-sha256", "1".repeat(64),
    "--expected-installed-app-asar-sha256", "2".repeat(64),
    "--expected-installed-build-info-sha256", "3".repeat(64),
    "--expected-previous-build", previousBuild,
    "--expected-previous-info-plist-sha256", "4".repeat(64),
    "--expected-previous-app-asar-sha256", "5".repeat(64),
    "--expected-previous-build-info-sha256", "6".repeat(64)
  ]), /expected-installed-build/);
  assert.throws(() => parseArgs(["--inspect", "--target", "/tmp/cli"], {
    AUTO_SVGA_LOCAL_STABLE_APP_PATH: "/tmp/env"
  }), /target.*environment/i);
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

test("promotion stages and validates under task-owned private tmp before installing", () => {
  const fixture = makeRollbackFixture();
  try {
    const installedBefore = fixtureInspector(fixture.target);
    const previousBefore = fixtureInspector(fixture.previous);
    const candidateBefore = fixtureInspector(fixture.candidate);
    const events = [];
    const dependencies = promoteFixtureDependencies(fixture, {
      copyBundle: (source, destination) => {
        assert.equal(source, fixture.candidate);
        assert.ok(destination.startsWith("/private/tmp/"), "candidate staging must stay under /private/tmp");
        assertBundleBinding(fixture.target, installedBefore);
        assertBundleBinding(fixture.previous, previousBefore);
        cpSync(source, destination, { recursive: true });
        events.push("copy");
      },
      preflightDestination: () => {
        assertBundleBinding(fixture.target, installedBefore);
        assertBundleBinding(fixture.previous, previousBefore);
        events.push("destination-preflight");
      },
      atomicSwap: (left, right) => {
        events.push(`swap:${path.basename(right)}`);
        swapFixtureDirectories(left, right);
      }
    });

    const result = installApp({
      sourceApp: fixture.candidate,
      target: fixture.target,
      dependencies
    });

    assert.equal(result.backupTarget, fixture.previous);
    assertBundleBinding(fixture.target, candidateBefore);
    assertBundleBinding(fixture.previous, installedBefore);
    assert.equal(existsSync(dependencies.stagingRoot), false);
    assert.deepEqual(events, [
      "copy",
      "destination-preflight",
      "swap:Auto SVGA.app",
      "swap:Auto SVGA.previous.app"
    ]);
  } finally {
    rmSync(fixture.root, { recursive: true, force: true });
  }
});

test("promotion staging-copy and destination denials fail closed before owner-app mutation", () => {
  for (const scenario of ["staging-copy-denial", "destination-denial"]) {
    const fixture = makeRollbackFixture();
    try {
      const installedBefore = fixtureInspector(fixture.target);
      const previousBefore = fixtureInspector(fixture.previous);
      const dependencies = promoteFixtureDependencies(fixture, scenario === "staging-copy-denial"
        ? {
            copyBundle: (_source, destination) => {
              mkdirSync(destination, { recursive: true });
              writeFileSync(path.join(destination, "partial"), "partial");
              throw new Error("simulated staging-copy denial");
            }
          }
        : {
            preflightDestination: () => {
              throw new Error("simulated destination denial");
            }
          });

      assert.throws(() => installApp({
        sourceApp: fixture.candidate,
        target: fixture.target,
        dependencies
      }), new RegExp(scenario === "staging-copy-denial" ? "staging-copy denial" : "destination denial"));
      assertBundleBinding(fixture.target, installedBefore);
      assertBundleBinding(fixture.previous, previousBefore);
      assert.equal(existsSync(dependencies.stagingRoot), false, "failed pre-mutation promotion must not leave staging residue");
    } finally {
      rmSync(fixture.root, { recursive: true, force: true });
    }
  }
});

test("promotion refuses pre-existing staging or journal residue before copying", () => {
  const fixture = makeRollbackFixture();
  try {
    const installedBefore = fixtureInspector(fixture.target);
    const previousBefore = fixtureInspector(fixture.previous);
    mkdirSync(path.join(fixture.root, ".Auto SVGA.promote-stale.app"));
    writeFileSync(path.join(fixture.root, ".Auto-SVGA.promote-stale.journal.json"), "{}");
    let stagingRequested = false;
    const dependencies = promoteFixtureDependencies(fixture, {
      createStagingRoot: () => {
        stagingRequested = true;
        return path.join(fixture.root, "promotion-stage");
      }
    });

    assert.throws(() => installApp({
      sourceApp: fixture.candidate,
      target: fixture.target,
      dependencies
    }), /staging or journal residue/);
    assert.equal(stagingRequested, false, "residue must fail before any staging root is created");
    assertBundleBinding(fixture.target, installedBefore);
    assertBundleBinding(fixture.previous, previousBefore);
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
    assert.throws(() => fixtureInspector(fixture.target), /symlink/);
    rmSync(escaping);

    const executable = path.join(fixture.target, "Contents/MacOS/Auto SVGA");
    linkSync(executable, path.join(fixture.target, "Contents/MacOS/Auto SVGA hardlink"));
    assert.throws(() => fixtureInspector(fixture.target), /hardlink/);
  } finally {
    rmSync(fixture.root, { recursive: true, force: true });
  }
});

test("bundle inspection rejects arbitrary contained symlinks but permits known framework symlinks", () => {
  const fixture = makeRollbackFixture();
  try {
    symlinkSync("marker.txt", path.join(fixture.target, "Contents/Resources/marker-link"));
    assert.throws(() => fixtureInspector(fixture.target), /symlink.*not allowed/i);
    rmSync(path.join(fixture.target, "Contents/Resources/marker-link"));

    const frameworkRoot = path.join(fixture.target, "Contents/Frameworks/Electron Framework.framework");
    mkdirSync(path.join(frameworkRoot, "Versions/A"), { recursive: true });
    writeFileSync(path.join(frameworkRoot, "Versions/A/Electron Framework"), "framework");
    symlinkSync("A", path.join(frameworkRoot, "Versions/Current"));
    symlinkSync("Versions/Current/Electron Framework", path.join(frameworkRoot, "Electron Framework"));
    assert.equal(fixtureInspector(fixture.target).buildInfo.buildCommit, installedBuild);
  } finally {
    rmSync(fixture.root, { recursive: true, force: true });
  }
});

test("bundle inspection binds critical parsing to descriptor-read bytes", () => {
  const fixture = makeRollbackFixture();
  try {
    const plistPath = path.join(fixture.target, "Contents/Info.plist");
    const asarPath = path.join(fixture.target, "Contents/Resources/app.asar");

    const plistIdentity = inspectAppBundle(fixture.target, {
      readPlistIdentity: (input) => {
        if (input?.bytes) {
          return readFixturePlistIdentity(input);
        }
        return {
          ...readFixturePlistIdentity(input),
          marker: "path-contaminated"
        };
      },
      readRuntimeIdentity: readFixtureRuntimeIdentity
    });
    assert.equal(plistIdentity.infoPlist.marker, "installed");

    const runtimeIdentity = inspectAppBundle(fixture.target, {
      readPlistIdentity: readFixturePlistIdentity,
      readRuntimeIdentity: (input) => {
        if (input?.bytes) {
          return readFixtureRuntimeIdentity(input);
        }
        return {
          ...readFixtureRuntimeIdentity(input),
          buildInfo: {
            ...readFixtureRuntimeIdentity(input).buildInfo,
            buildCommit: candidateBuild
          }
        };
      }
    });
    assert.equal(runtimeIdentity.buildInfo.buildCommit, installedBuild);

    assert.throws(() => inspectAppBundle(fixture.target, {
      readPlistIdentity: (input) => {
        const identity = readFixturePlistIdentity(input);
        writeFileSync(input.path ?? input, `${readFileSync(input.path ?? input, "utf8")} `);
        return identity;
      },
      readRuntimeIdentity: readFixtureRuntimeIdentity
    }), /Info\.plist|Critical app file changed/);
    writeFileSync(plistPath, JSON.stringify({
      name: "Auto SVGA",
      displayName: "Auto SVGA",
      executable: "Auto SVGA",
      shortVersion: "0.2.0-alpha.2",
      marker: "installed"
    }));

    assert.throws(() => inspectAppBundle(fixture.target, {
      readPlistIdentity: readFixturePlistIdentity,
      readRuntimeIdentity: (input) => {
        const identity = readFixtureRuntimeIdentity(input);
        writeFileSync(input.path ?? input, `${readFileSync(input.path ?? input, "utf8")} `);
        return identity;
      }
    }), /app\.asar|Critical app file changed/);
    assert.equal(readFixtureRuntimeIdentity(asarPath).buildInfo.buildCommit, installedBuild);
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

test("recovery rejects a tampered manifest for already swapped app roles", () => {
  const fixture = makeRollbackFixture();
  try {
    assert.throws(() => rollbackPreviousApp({
      ...fixture,
      dependencies: fixtureDependencies({
        checkpoint: (phase) => {
          if (phase === "after-manifest-published") throw new Error("simulated crash after manifest");
        }
      })
    }), /simulated crash after manifest/);
    assertRoleState(fixture, "swapped-roles");
    assert.equal(existsSync(fixture.rollbackJournalPath), true);
    assert.equal(existsSync(fixture.rollbackManifestPath), true);

    const manifest = JSON.parse(readFileSync(fixture.rollbackManifestPath, "utf8"));
    manifest.after.installed.appAsar.sha256 = "0".repeat(64);
    writeFileSync(fixture.rollbackManifestPath, `${JSON.stringify(manifest, null, 2)}\n`);

    assert.throws(() => recoverRollbackTransaction({
      ...fixture,
      dependencies: fixtureDependencies()
    }), /manifest/i);
    assert.equal(existsSync(fixture.rollbackJournalPath), true, "journal must remain for a later audited recovery");
  } finally {
    rmSync(fixture.root, { recursive: true, force: true });
  }
});

test("recovery rejects non-journal-bound rollback manifest mutations and preserves the journal", () => {
  const tamperCases = [
    {
      name: "processPrecheck",
      mutate: (manifest) => {
        manifest.processPrecheck = { tampered: "accepted" };
      }
    },
    {
      name: "performedAt",
      mutate: (manifest) => {
        manifest.performedAt = "2026-01-01T00:00:00.000Z";
      }
    },
    {
      name: "extra field",
      mutate: (manifest) => {
        manifest.extraAuthority = "not-durable";
      }
    },
    {
      name: "missing field",
      mutate: (manifest) => {
        delete manifest.processPrecheck;
      }
    },
    {
      name: "journal manifest hash mismatch",
      mutate: (_manifest, journal) => {
        journal.manifestSha256 = "0".repeat(64);
      }
    }
  ];

  for (const { name, mutate } of tamperCases) {
    const fixture = makeRollbackFixture();
    try {
      assert.throws(() => rollbackPreviousApp({
        ...fixture,
        dependencies: fixtureDependencies({
          checkpoint: (phase) => {
            if (phase === "after-manifest-published") throw new Error(`simulated crash after manifest:${name}`);
          }
        })
      }), /simulated crash after manifest/);
      assertRoleState(fixture, "swapped-roles");
      assert.equal(existsSync(fixture.rollbackManifestPath), true);
      assert.equal(existsSync(fixture.rollbackJournalPath), true);

      const manifest = JSON.parse(readFileSync(fixture.rollbackManifestPath, "utf8"));
      const journal = JSON.parse(readFileSync(fixture.rollbackJournalPath, "utf8"));
      mutate(manifest, journal);
      writeFileSync(fixture.rollbackManifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
      writeFileSync(fixture.rollbackJournalPath, `${JSON.stringify(journal, null, 2)}\n`);

      assert.throws(() => recoverRollbackTransaction({
        ...fixture,
        dependencies: fixtureDependencies()
      }), /manifest/i, name);
      assert.equal(existsSync(fixture.rollbackJournalPath), true, `journal must remain for ${name}`);
    } finally {
      rmSync(fixture.root, { recursive: true, force: true });
    }
  }
});

test("recovery rejects an existing manifest that was written before journal hash authority", () => {
  const fixture = makeRollbackFixture();
  try {
    assert.throws(() => rollbackPreviousApp({
      ...fixture,
      dependencies: fixtureDependencies({
        checkpoint: (phase) => {
          if (phase === "after-manifest-write-before-journal") {
            throw new Error("simulated crash before manifest hash journal");
          }
        }
      })
    }), /simulated crash before manifest hash journal/);
    assertRoleState(fixture, "swapped-roles");
    assert.equal(existsSync(fixture.rollbackManifestPath), true);
    assert.equal(existsSync(fixture.rollbackJournalPath), true);

    assert.throws(() => recoverRollbackTransaction({
      ...fixture,
      dependencies: fixtureDependencies()
    }), /manifest/i);
    assert.equal(existsSync(fixture.rollbackJournalPath), true, "journal must remain when manifest hash is not durable");
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
