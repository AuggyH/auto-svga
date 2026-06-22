import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createServer } from "node:http";
import { mkdir, mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import test from "node:test";

import {
  createLoopValidationSteps,
  runLoopValidation,
  runWebLocalSmoke
} from "./loop-validate.mjs";
import { validateReviewerConfig } from "./loop-reviewer-config-check.mjs";

function run(cmd, args, cwd, options = {}) {
  const result = spawnSync(cmd, args, {
    cwd,
    encoding: "utf8",
    maxBuffer: 10 * 1024 * 1024
  });
  if (!options.allowFailure && result.status !== 0) {
    throw new Error(`${cmd} ${args.join(" ")} failed: ${result.stderr || result.stdout}`);
  }
  return result;
}

function testSteps() {
  return [
    { id: "one", command: "one", required: true, run: { cmd: "one", args: [] } },
    { id: "two", command: "two", required: true, run: { cmd: "two", args: [] } },
    { id: "three", command: "three", required: true, run: { cmd: "three", args: [] } }
  ];
}

async function withTempDir(callback) {
  const directory = await mkdtemp(join(tmpdir(), "auto-svga-loop-"));
  try {
    return await callback(directory);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

test("success path executes steps in order and returns pass", async () => {
  await withTempDir(async (artifactDir) => {
    const order = [];
    const logs = [];
    const summary = await runLoopValidation({
      steps: testSteps(),
      artifactDir,
      consoleLike: { log: (line) => logs.push(line) },
      executor: async (step) => {
        order.push(step.id);
        return { exitCode: 0 };
      }
    });

    assert.equal(summary.status, "pass");
    assert.deepEqual(order, ["one", "two", "three"]);
    assert.deepEqual(summary.steps.map(({ status }) => status), ["pass", "pass", "pass"]);
    assert.equal(summary.steps.every(({ exitCode }) => exitCode === 0), true);
    assert.match(logs.at(-1), /^AUTO_SVGA_LOOP_VALIDATE_RESULT=/);
  });
});

test("middle-step failure returns fail and skips later steps", async () => {
  await withTempDir(async (artifactDir) => {
    const order = [];
    const summary = await runLoopValidation({
      steps: testSteps(),
      artifactDir,
      consoleLike: { log() {} },
      executor: async (step) => {
        order.push(step.id);
        return { exitCode: step.id === "two" ? 2 : 0 };
      }
    });

    assert.equal(summary.status, "fail");
    assert.deepEqual(order, ["one", "two"]);
    assert.deepEqual(summary.steps.map(({ status }) => status), ["pass", "fail", "skipped"]);
    assert.equal(summary.steps[1].exitCode, 2);
    assert.equal(summary.steps[2].reason, "blocked_by_previous_failure");
  });
});

test("file summary is parseable and matches console summary semantics", async () => {
  await withTempDir(async (artifactDir) => {
    const logs = [];
    const summary = await runLoopValidation({
      steps: testSteps().slice(0, 1),
      artifactDir,
      consoleLike: { log: (line) => logs.push(line) },
      executor: async () => ({ exitCode: 0 })
    });

    const fileSummary = JSON.parse(await readFile(join(artifactDir, "latest.json"), "utf8"));
    const consoleSummary = JSON.parse(logs.at(-1).replace("AUTO_SVGA_LOOP_VALIDATE_RESULT=", ""));

    assert.equal(fileSummary.schemaVersion, 2);
    assert.equal(consoleSummary.schemaVersion, 2);
    assert.equal(typeof fileSummary.repositoryHeadCommitAtStart, "string");
    assert.equal(typeof fileSummary.repositoryHeadCommitAtFinish, "string");
    assert.equal(typeof fileSummary.sourceWorkspaceCleanAtStart, "boolean");
    assert.equal(typeof fileSummary.sourceWorkspaceCleanAtFinish, "boolean");
    assert.equal(fileSummary.status, summary.status);
    assert.equal(consoleSummary.status, summary.status);
    assert.deepEqual(fileSummary.knownGaps, summary.knownGaps);
  });
});

test("loop validation starts with handoff, reviewer config, budget, and worker protocol gates", () => {
  const ids = createLoopValidationSteps().map(({ id }) => id);
  assert.deepEqual(ids.slice(0, 4), [
    "handoff-tests",
    "reviewer-config-check",
    "loop-budget-check",
    "multi-worker-protocol-check"
  ]);
});

test("electron steps are ordered after web smoke and are not parallelized", () => {
  const ids = createLoopValidationSteps().map(({ id }) => id);
  assert.deepEqual(ids.slice(12, 15), [
    "web-local-smoke",
    "electron-prototype-tests",
    "svga-web-prototype-tests"
  ]);
});

test("reviewer config check validates must_check array and read-only sandbox", async () => {
  const result = await validateReviewerConfig(".codex/agents/reviewer.toml");

  assert.equal(result.status, "pass");
  assert.equal(result.permissions.mode, "read-only");
  assert.equal(result.permissions.allow_writes, false);
  assert.equal(result.mustCheck.includes("scope drift"), true);
  assert.equal(result.mustCheck.includes("review handoff completeness"), true);
});

test("reviewer config check rejects missing comma separators", async () => {
  await withTempDir(async (directory) => {
    const configPath = join(directory, "reviewer.toml");
    await writeFile(configPath, [
      "[permissions]",
      "mode = \"read-only\"",
      "allow_writes = false",
      "allow_commits = false",
      "allow_network = false",
      "",
      "[review]",
      "must_check = [",
      "  \"scope drift\"",
      "  \"review handoff completeness\"",
      "]",
      ""
    ].join("\n"));

    await assert.rejects(
      () => validateReviewerConfig(configPath),
      /missing a comma separator/
    );
  });
});

test("validation fails when repository HEAD changes during a run", async () => {
  await withTempDir(async (repo) => {
    await mkdir(join(repo, "nested"), { recursive: true });
    await writeFile(join(repo, "file.txt"), "one\n");
    run("git", ["init"], repo);
    run("git", ["config", "user.name", "Codex"], repo);
    run("git", ["config", "user.email", "codex-agent@local"], repo);
    run("git", ["add", "."], repo);
    run("git", ["commit", "-m", "one"], repo);

    const summary = await runLoopValidation({
      cwd: repo,
      steps: testSteps().slice(0, 1),
      artifactDir: join(repo, ".artifacts/loop-validation"),
      consoleLike: { log() {} },
      executor: async () => {
        await writeFile(join(repo, "file.txt"), "two\n");
        run("git", ["add", "file.txt"], repo);
        run("git", ["commit", "-m", "two"], repo);
        return { exitCode: 0 };
      }
    });

    assert.equal(summary.status, "fail");
    assert.notEqual(summary.repositoryHeadCommitAtStart, summary.repositoryHeadCommitAtFinish);
  });
});

test("runner waits for each step before starting the next step", async () => {
  await withTempDir(async (artifactDir) => {
    let active = 0;
    let maxActive = 0;
    const order = [];

    await runLoopValidation({
      steps: testSteps(),
      artifactDir,
      consoleLike: { log() {} },
      executor: async (step) => {
        active += 1;
        maxActive = Math.max(maxActive, active);
        order.push(`start:${step.id}`);
        await new Promise((resolve) => setTimeout(resolve, 5));
        order.push(`end:${step.id}`);
        active -= 1;
        return { exitCode: 0 };
      }
    });

    assert.equal(maxActive, 1);
    assert.deepEqual(order, [
      "start:one",
      "end:one",
      "start:two",
      "end:two",
      "start:three",
      "end:three"
    ]);
  });
});

test("web smoke uses a random loopback port and closes the server", async () => {
  let observedHost;
  let observedPort;
  let closed = false;

  const serverFactory = () => {
    const server = createServer((request, response) => {
      if (request.url === "/tools/svga-player-preview/") {
        response.writeHead(200);
        response.end("preview");
        return;
      }
      if (request.url === "/api/latest-artifact") {
        response.writeHead(200, { "content-type": "application/json; charset=utf-8" });
        response.end(JSON.stringify({ artifacts: [] }));
        return;
      }
      response.writeHead(404);
      response.end();
    });
    const originalListen = server.listen.bind(server);
    server.listen = (port, host, callback) => {
      observedPort = port;
      observedHost = host;
      return originalListen(port, host, callback);
    };
    server.once("close", () => {
      closed = true;
    });
    return server;
  };

  await runWebLocalSmoke({ serverFactory });
  assert.equal(observedHost, "127.0.0.1");
  assert.equal(observedPort, 0);
  assert.equal(closed, true);
});

test("failure-path tests write only to the requested artifact directory", async () => {
  await withTempDir(async (artifactDir) => {
    const summary = await runLoopValidation({
      steps: testSteps(),
      artifactDir,
      consoleLike: { log() {} },
      executor: async (step) => ({ exitCode: step.id === "one" ? 1 : 0 })
    });
    const summaryStat = await stat(join(artifactDir, "latest.json"));

    assert.equal(summary.status, "fail");
    assert.equal(summaryStat.isFile(), true);
    assert.deepEqual(summary.steps.map(({ status }) => status), ["fail", "skipped", "skipped"]);
  });
});
