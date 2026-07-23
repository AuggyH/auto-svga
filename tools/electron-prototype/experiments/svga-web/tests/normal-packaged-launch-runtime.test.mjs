import assert from "node:assert/strict";
import { existsSync, mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from "node:fs";
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

test("runtime and proof paths reject traversal before any filesystem side effect", () => {
  const root = mkdtempSync(path.join(os.tmpdir(), "auto-svga-startup-policy-"));
  const ownerUserDataRoot = path.join(root, "owner-user-data");
  const repoRoot = path.join(root, "repo");
  const validMilestone = "0.2-multiformat-preview";
  const input = {
    appIsPackaged: true,
    repoRoot,
    ownerUserDataRoot,
    productMilestoneId: validMilestone,
    normalVisibleStartupMode: true,
    acceptanceLaunch: false,
    environment: {}
  };

  try {
    const ordinary = resolveStartupRuntimePolicy(input);
    assert.equal(
      ordinary.ownerRuntimeRoot,
      path.join(ownerUserDataRoot, "runtime", validMilestone)
    );
    assert.equal(ordinary.productArtifactRoot, ordinary.ownerRuntimeRoot);
    assert.deepEqual(readdirSync(root), []);

    for (const productMilestoneId of [
      "",
      ".",
      "..",
      "../escape",
      "nested/escape",
      "nested\\escape",
      path.join(root, "absolute")
    ]) {
      assert.throws(
        () => resolveStartupRuntimePolicy({ ...input, productMilestoneId }),
        /startup_policy_invalid_product_milestone/u,
        productMilestoneId || "<empty>"
      );
      assert.deepEqual(readdirSync(root), []);
    }

    const absoluteProofRoot = path.join(root, "explicit-proof");
    const explicit = resolveStartupRuntimePolicy({
      ...input,
      acceptanceLaunch: true,
      environment: {
        AUTO_SVGA_PRODUCT_ARTIFACTS: absoluteProofRoot
      }
    });
    assert.equal(explicit.productArtifactRoot, absoluteProofRoot);
    assert.equal(existsSync(absoluteProofRoot), false);
    assert.deepEqual(readdirSync(root), []);

    for (const proofRoot of ["", ".", "..", "relative-proof", "../escape"]) {
      assert.throws(
        () => resolveStartupRuntimePolicy({
          ...input,
          acceptanceLaunch: true,
          environment: {
            AUTO_SVGA_PRODUCT_ARTIFACTS: proofRoot
          }
        }),
        /startup_policy_invalid_product_artifact_root/u,
        proofRoot || "<empty>"
      );
      assert.deepEqual(readdirSync(root), []);
    }
  } finally {
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

test("fatal diagnostics never serialize malicious error names or arbitrary acceptance reasons", () => {
  const privatePayload = "Failure /Users/owner/private/client-name.svga";
  const error = new Error("private path is present only in the raw error");
  error.name = privatePayload;

  const ordinary = describeFatalBootstrapError({
    source: "uncaught_exception",
    error,
    acceptanceLaunch: false,
    acceptanceProofResult: { status: "ignored", reason: "acceptance_launch_not_requested" }
  });
  assert.equal(ordinary.errorClass, "Error");
  assert.equal(ordinary.reason, "bootstrap_error");
  assert.equal(JSON.stringify(ordinary).includes(privatePayload), false);
  assert.equal(JSON.stringify(ordinary).includes("/Users/owner"), false);

  const acceptance = describeFatalBootstrapError({
    source: "unhandled_rejection",
    error,
    acceptanceLaunch: true,
    acceptanceProofResult: {
      status: "rejected",
      reason: privatePayload
    }
  });
  assert.equal(acceptance.errorClass, "Error");
  assert.equal(acceptance.reason, "acceptance_startup_bootstrap_failed");
  assert.equal(JSON.stringify(acceptance).includes(privatePayload), false);
  assert.equal(JSON.stringify(acceptance).includes("/Users/owner"), false);
});

test("fatal taxonomy rejects safe-character code and syscall payloads", () => {
  const safeCharacterPayload = "PRIVATE_CLIENT_NAME_SVGA";
  const syscallPayload = "Users_owner_private";
  const ordinary = describeFatalBootstrapError({
    source: "uncaught_exception",
    error: {
      name: safeCharacterPayload,
      code: safeCharacterPayload,
      syscall: syscallPayload
    },
    acceptanceLaunch: false,
    acceptanceProofResult: { status: "ignored", reason: "acceptance_launch_not_requested" }
  });
  assert.deepEqual(ordinary, {
    source: "uncaught_exception",
    acceptanceLaunch: false,
    reason: "bootstrap_error",
    errorClass: "Error"
  });
  assert.equal(JSON.stringify(ordinary).includes(safeCharacterPayload), false);
  assert.equal(JSON.stringify(ordinary).includes(syscallPayload), false);
});

test("fatal taxonomy rejects arbitrary safe-character acceptance reasons", () => {
  const arbitraryAcceptance = describeFatalBootstrapError({
    source: "unhandled_rejection",
    error: new Error("private failure"),
    acceptanceLaunch: true,
    acceptanceProofResult: {
      status: "rejected",
      reason: "acceptance_users_owner_private_client_name_svga"
    }
  });
  assert.equal(arbitraryAcceptance.reason, "acceptance_startup_bootstrap_failed");
  assert.equal(JSON.stringify(arbitraryAcceptance).includes("users_owner_private"), false);
});

test("fatal taxonomy distinguishes fixed startup policy failures", () => {
  const policyInput = {
    appIsPackaged: true,
    repoRoot: "/sealed/candidate/app",
    ownerUserDataRoot: "/owner/user-data",
    productMilestoneId: "0.2-multiformat-preview",
    normalVisibleStartupMode: true,
    acceptanceLaunch: false,
    environment: {}
  };
  const policyCases = [
    {
      expectedReason: "startup_policy_invalid_product_milestone",
      expectedCode: "AUTO_SVGA_STARTUP_POLICY_INVALID_PRODUCT_MILESTONE",
      run: () => resolveStartupRuntimePolicy({ ...policyInput, productMilestoneId: ".." })
    },
    {
      expectedReason: "startup_policy_invalid_product_artifact_root",
      expectedCode: "AUTO_SVGA_STARTUP_POLICY_INVALID_PRODUCT_ARTIFACT_ROOT",
      run: () => resolveStartupRuntimePolicy({
        ...policyInput,
        environment: { AUTO_SVGA_PRODUCT_ARTIFACTS: "relative-proof" }
      })
    }
  ];
  for (const policyCase of policyCases) {
    let policyError;
    try {
      policyCase.run();
    } catch (error) {
      policyError = error;
    }
    assert.ok(policyError instanceof Error);
    const diagnostic = describeFatalBootstrapError({
      source: "uncaught_exception",
      error: policyError,
      acceptanceLaunch: false,
      acceptanceProofResult: { status: "ignored", reason: "acceptance_launch_not_requested" }
    });
    assert.equal(diagnostic.reason, policyCase.expectedReason);
    assert.equal(diagnostic.errorCode, policyCase.expectedCode);
  }
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
