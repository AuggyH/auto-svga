import assert from "node:assert/strict";
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { chmod } from "node:fs/promises";
import { createRequire } from "node:module";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";

const require = createRequire(import.meta.url);
const {
  describeFatalBootstrapError,
  describeFinderEquivalentLaunchEvidence,
  resolveStartupRuntimePolicy
} = require("../startup-runtime-policy.cjs");

test("sealed packaged normal launch without AUTO_SVGA environment uses owner-writable runtime state", async () => {
  const root = mkdtempSync(path.join(os.tmpdir(), "auto-svga-normal-launch-"));
  const sealedCandidateRoot = path.join(root, "candidate");
  const appRoot = path.join(sealedCandidateRoot, "Auto SVGA.app", "Contents", "Resources", "app.asar");
  const ownerUserDataRoot = path.join(root, "owner-user-data");
  mkdirSync(path.dirname(appRoot), { recursive: true });
  writeFileSync(appRoot, "mock app.asar");
  await chmod(sealedCandidateRoot, 0o555);

  try {
    const policy = resolveStartupRuntimePolicy({
      appIsPackaged: true,
      repoRoot: sealedCandidateRoot,
      ownerUserDataRoot,
      productMilestoneId: "0.2-multiformat-preview",
      normalVisibleStartupMode: true,
      acceptanceLaunch: false,
      environment: {}
    });

    assert.equal(policy.outputMode, "owner-runtime");
    assert.equal(policy.productEvidenceEnabled, false);
    assert.equal(policy.visibleStartupProofEnabled, false);
    assert.equal(policy.productArtifactRoot.startsWith(ownerUserDataRoot), true);
    assert.equal(policy.productArtifactRoot.startsWith(sealedCandidateRoot), false);

    mkdirSync(policy.productArtifactRoot, { recursive: true });
    writeFileSync(path.join(policy.productArtifactRoot, "runtime-state.json"), "{}\n");
    assert.equal(existsSync(path.join(sealedCandidateRoot, ".artifacts")), false);
  } finally {
    await chmod(sealedCandidateRoot, 0o755);
    rmSync(root, { recursive: true, force: true });
  }
});

test("explicit acceptance output remains isolated from owner runtime state", () => {
  const policy = resolveStartupRuntimePolicy({
    appIsPackaged: true,
    repoRoot: "/sealed/candidate",
    ownerUserDataRoot: "/owner/user-data",
    productMilestoneId: "0.2-multiformat-preview",
    normalVisibleStartupMode: true,
    acceptanceLaunch: true,
    environment: {
      AUTO_SVGA_ACCEPTANCE_EXECUTION_ID: "ASV-ACCEPTANCE-001",
      AUTO_SVGA_PRODUCT_ARTIFACTS: "/private/acceptance-proof"
    }
  });

  assert.equal(policy.outputMode, "explicit-proof");
  assert.equal(policy.productArtifactRoot, "/private/acceptance-proof");
  assert.equal(policy.ownerRuntimeRoot, "/owner/user-data/runtime/0.2-multiformat-preview");
  assert.equal(policy.productEvidenceEnabled, true);
  assert.equal(policy.visibleStartupProofEnabled, true);
});

test("non-acceptance fatal diagnostics preserve the underlying error instead of an ignored proof reason", () => {
  const error = Object.assign(
    new Error("EACCES: permission denied, mkdir '/sealed/candidate/.artifacts/product'"),
    { code: "EACCES", syscall: "mkdir" }
  );
  const diagnostic = describeFatalBootstrapError({
    source: "uncaught_exception",
    error,
    acceptanceLaunch: false,
    acceptanceProofResult: { status: "ignored", reason: "acceptance_launch_not_requested" }
  });

  assert.deepEqual(diagnostic, {
    source: "uncaught_exception",
    acceptanceLaunch: false,
    reason: "bootstrap_eacces",
    errorClass: "Error",
    errorCode: "EACCES",
    errorSyscall: "mkdir"
  });
  assert.notEqual(diagnostic.reason, "acceptance_launch_not_requested");
  assert.equal(JSON.stringify(diagnostic).includes("/sealed/candidate"), false);
});

test("explicit acceptance fatal diagnostics retain the acceptance reason and underlying category", () => {
  const error = Object.assign(new Error("placement rejected"), { code: "EINVAL" });
  const diagnostic = describeFatalBootstrapError({
    source: "unhandled_rejection",
    error,
    acceptanceLaunch: true,
    acceptanceProofResult: {
      status: "written",
      proof: { reason: "acceptance_startup_entrypoint_rejection" }
    }
  });

  assert.equal(diagnostic.reason, "acceptance_startup_entrypoint_rejection");
  assert.equal(diagnostic.errorClass, "Error");
  assert.equal(diagnostic.errorCode, "EINVAL");
});

test("in-process startup evidence never claims Finder equivalence", () => {
  const acceptanceEvidence = describeFinderEquivalentLaunchEvidence({
    acceptanceLaunch: true,
    environment: {
      AUTO_SVGA_PRODUCT_ARTIFACTS: "/private/acceptance-proof"
    },
    argv: ["Auto SVGA", "--auto-svga-acceptance-display-id=2"]
  });
  assert.deepEqual(acceptanceEvidence, {
    compatible: false,
    reason: "explicit_acceptance_or_auto_svga_overrides"
  });

  const ordinaryEvidence = describeFinderEquivalentLaunchEvidence({
    acceptanceLaunch: false,
    environment: {},
    argv: ["Auto SVGA"]
  });
  assert.deepEqual(ordinaryEvidence, {
    compatible: false,
    reason: "requires_external_no_env_finder_observation"
  });
});
