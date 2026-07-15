import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const experimentRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const {
  TASK_RUNTIME_ORACLE_PHASES,
  createFusionVapcDocument,
  createTaskRuntimeFixtureSet,
  readTaskRuntimeFixtureContract
} = require("../scripts/multiformat-task-runtime-fixtures.cjs");

test("task-owned runtime fixture contract fails closed for missing resources and malformed external contracts", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "auto-svga-task-fixture-negative-"));
  try {
    const fixtureSet = createTaskRuntimeFixtureSet({ root });
    await rm(fixtureSet.files.lottieImagePath);
    const missingImage = readTaskRuntimeFixtureContract({ root });
    assert.equal(missingImage.status, "failed");
    assert.equal(missingImage.findings.some(({ code }) => code === "lottieImage_missing"), true);
    assert.doesNotMatch(JSON.stringify(missingImage), /auto-svga-task-fixture-negative|\/Users\//u);

    createTaskRuntimeFixtureSet({ root });
    const lottieWithFonts = JSON.parse(readFileSync(fixtureSet.files.lottiePath, "utf8"));
    lottieWithFonts.fonts = { list: [{ fName: "Deferred-Font" }] };
    await writeFile(fixtureSet.files.lottiePath, `${JSON.stringify(lottieWithFonts)}\n`);
    const deferredFont = readTaskRuntimeFixtureContract({ root });
    assert.equal(deferredFont.status, "failed");
    assert.equal(deferredFont.findings.some(({ code }) => code === "lottie_fixture_fonts_deferred"), true);
    assert.doesNotMatch(JSON.stringify(deferredFont), /auto-svga-task-fixture-negative|\/Users\//u);

    createTaskRuntimeFixtureSet({ root });
    await rm(fixtureSet.files.vapSidecarPath);
    const missingSidecar = readTaskRuntimeFixtureContract({ root });
    assert.equal(missingSidecar.status, "failed");
    assert.equal(missingSidecar.findings.some(({ code }) => code === "vapSidecar_missing"), true);
    assert.doesNotMatch(JSON.stringify(missingSidecar), /auto-svga-task-fixture-negative|\/Users\//u);

    createTaskRuntimeFixtureSet({ root });
    await writeFile(fixtureSet.files.vapSidecarPath, "{not-json");
    const malformedSidecar = readTaskRuntimeFixtureContract({ root });
    assert.equal(malformedSidecar.status, "failed");
    assert.equal(malformedSidecar.findings.some(({ code }) => code === "vap_sidecar_json_invalid"), true);
    assert.doesNotMatch(JSON.stringify(malformedSidecar), /auto-svga-task-fixture-negative|\/Users\//u);

    createTaskRuntimeFixtureSet({ root });
    await writeFile(
      fixtureSet.files.vapSidecarPath,
      `${JSON.stringify(createFusionVapcDocument({
        src: [{ srcId: "avatar", srcTag: "badge", srcType: "image", w: 24, h: 24 }]
      }))}\n`
    );
    const fusionDrift = readTaskRuntimeFixtureContract({ root });
    assert.equal(fusionDrift.status, "failed");
    assert.equal(fusionDrift.findings.some(({ code }) => code === "vap_fusion_target_contract_drift"), true);
    assert.doesNotMatch(JSON.stringify(fusionDrift), /auto-svga-task-fixture-negative|\/Users\//u);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("task-owned source oracle binds external-image Lottie and fusion VAP without launching Electron", async () => {
  const oracleScript = path.join(experimentRoot, "scripts/run-multiformat-task-fixture-source-oracle.cjs");
  const output = execFileSync(process.execPath, [oracleScript], {
    cwd: path.resolve(experimentRoot, "../../../.."),
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"]
  }).trim();
  const result = JSON.parse(output);
  assert.equal(result.status, "passed");
  assert.match(result.proofOutputPath, /multiformat-task-fixture-source-oracle\.json$/u);

  const proof = JSON.parse(readFileSync(result.proofOutputPath, "utf8"));
  try {
    assert.equal(proof.status, "passed");
    assert.equal(proof.pathRedacted, true);
    assert.equal(proof.productMilestoneId, "0.2-multiformat-preview");
    assert.equal(proof.boundaries.electronLaunched, false);
    assert.equal(proof.boundaries.foregroundUsed, false);
    assert.equal(proof.boundaries.runtimePixelPlayback, false);
    assert.deepEqual(
      TASK_RUNTIME_ORACLE_PHASES.filter((phase) => phase !== "redacted_evidence_written").every((phase) =>
        proof.signals.some((signal) => signal.phase === phase)
      ),
      true
    );

    assert.equal(proof.fixtureContract.status, "passed");
    assert.equal(proof.fixtureContract.fixtures.lottie.externalImage.relativeResource, "images/avatar.png");
    assert.equal(proof.lottie.open.format, "lottie");
    assert.equal(proof.lottie.runtime.externalImageInlined, true);
    assert.equal(proof.lottie.replacement.resetRestoredSource, true);
    assert.equal(proof.lottie.replacement.siblingPreserved, true);
    assert.equal(proof.lottie.playback.playedStatus, "playing");
    assert.equal(proof.lottie.playback.pausedStatus, "paused");

    assert.equal(proof.fixtureContract.fixtures.vap.expectedFusionTargets.length, 2);
    assert.equal(proof.vap.open.format, "vap");
    assert.equal(proof.vap.runtime.vapConfigSource, "adjacent_json");
    assert.equal(proof.vap.replacement.imageRuntimeTarget, "avatar");
    assert.equal(proof.vap.replacement.textRuntimeTarget, "title");
    assert.equal(proof.vap.replacement.canonicalImageKeyUsed, true);
    assert.equal(proof.vap.replacement.resetRestoredSource, true);
    assert.equal(proof.vap.playback.playedStatus, "playing");
    assert.equal(proof.vap.playback.pausedStatus, "paused");

    const serialized = JSON.stringify(proof);
    assert.doesNotMatch(serialized, /\/Users\/huangtengxin|auto-svga-task-fixture-source-oracle-|external-image-lottie\.json|fusion-vap\.mp4|replacement\.png/u);
  } finally {
    await rm(path.dirname(result.proofOutputPath), { recursive: true, force: true });
  }
});
