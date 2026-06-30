#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptRoot = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptRoot, "../..");
const outputPath = path.join(
  repoRoot,
  ".artifacts/product/SVGA-Workbench-v1/distribution/distribution-readiness.json"
);

const requiredFiles = [
  "docs/product/SHORT_TERM_DISTRIBUTION_PREP.md",
  "docs/autonomous/SVGA_WORKBENCH_V1_STATUS.md",
  "docs/autonomous/AUTONOMOUS_BLOCKERS.md",
  "tools/svga-workbench/run-validation-suite.mjs",
  "tools/svga-workbench/complete-review-package.mjs",
  "tools/electron-prototype/experiments/svga-web/scripts/package-internal-trial.mjs",
  "tools/electron-prototype/experiments/svga-web/scripts/macos-package-proof.mjs",
  "tools/electron-prototype/experiments/svga-web/scripts/macos-signing-workflow.mjs",
  "tools/electron-prototype/experiments/svga-web/packaging/macos/entitlements.plist"
];

const requiredRootScripts = {
  "svga-workbench:v1:validate": "node tools/svga-workbench/run-validation-suite.mjs",
  "svga-workbench:v1:complete-review": "node tools/svga-workbench/complete-review-package.mjs",
  "svga-workbench:v1:distribution-readiness": "node tools/svga-workbench/distribution-readiness.mjs"
};

const requiredExperimentScripts = {
  "internal:trial:package:mac": "node scripts/package-internal-trial.mjs",
  "internal:trial:proof:mac": "node scripts/macos-package-proof.mjs",
  "internal:trial:signing-plan:mac": "node scripts/macos-signing-workflow.mjs plan",
  "internal:trial:sign:mac": "node scripts/macos-signing-workflow.mjs sign",
  "internal:trial:notarize:mac": "node scripts/macos-signing-workflow.mjs notarize"
};

function git(args) {
  try {
    return execFileSync("git", args, { cwd: repoRoot, encoding: "utf8" }).trim();
  } catch {
    return null;
  }
}

async function readText(relativePath) {
  return readFile(path.join(repoRoot, relativePath), "utf8");
}

async function readJson(relativePath) {
  return JSON.parse(await readText(relativePath));
}

function hasMacosSigningIdentity() {
  return Boolean(process.env.AUTO_SVGA_MACOS_SIGN_IDENTITY || process.env.CSC_NAME);
}

function hasMacosNotaryCredentials() {
  return Boolean(
    process.env.AUTO_SVGA_NOTARY_PROFILE
    || process.env.NOTARYTOOL_KEYCHAIN_PROFILE
    || (process.env.APPLE_ID && process.env.APPLE_TEAM_ID && (process.env.APPLE_APP_SPECIFIC_PASSWORD || process.env.APPLE_PASSWORD))
  );
}

function pushCheck(checks, id, passed, severity, summary) {
  checks.push({ id, passed, severity, summary });
}

const checks = [];
for (const relativePath of requiredFiles) {
  pushCheck(checks, `file:${relativePath}`, existsSync(path.join(repoRoot, relativePath)), "required", `${relativePath} exists`);
}

const rootPackage = await readJson("package.json");
for (const [scriptName, expected] of Object.entries(requiredRootScripts)) {
  pushCheck(
    checks,
    `root-script:${scriptName}`,
    rootPackage.scripts?.[scriptName] === expected,
    "required",
    `${scriptName} points at ${expected}`
  );
}

const experimentPackage = await readJson("tools/electron-prototype/experiments/svga-web/package.json");
for (const [scriptName, expected] of Object.entries(requiredExperimentScripts)) {
  pushCheck(
    checks,
    `experiment-script:${scriptName}`,
    experimentPackage.scripts?.[scriptName] === expected,
    "required",
    `${scriptName} points at ${expected}`
  );
}

const statusText = existsSync(path.join(repoRoot, "docs/autonomous/SVGA_WORKBENCH_V1_STATUS.md"))
  ? await readText("docs/autonomous/SVGA_WORKBENCH_V1_STATUS.md")
  : "";
const blockerText = existsSync(path.join(repoRoot, "docs/autonomous/AUTONOMOUS_BLOCKERS.md"))
  ? await readText("docs/autonomous/AUTONOMOUS_BLOCKERS.md")
  : "";
const prepText = existsSync(path.join(repoRoot, "docs/product/SHORT_TERM_DISTRIBUTION_PREP.md"))
  ? await readText("docs/product/SHORT_TERM_DISTRIBUTION_PREP.md")
  : "";

const productReviewReady = !/not in Product Owner review|not review-ready/i.test(statusText);
const recordsMacosCredentialBlocker = blockerText.includes("SIGNING-BLOCKED-APPLE-DEVELOPER-ID");
const recordsWindowsCredentialBlocker = blockerText.includes("WINDOWS-SIGNING-BLOCKED");
const recordsPhase4Limit = blockerText.includes("PHASE4-REAL-ASSET-SEQUENCE-LIMIT");

pushCheck(checks, "policy:release-candidate-gate-documented", prepText.includes("Release Candidate Gate"), "required", "release candidate gate is documented");
pushCheck(checks, "policy:no-automatic-release", prepText.includes("No automatic push, merge, tag, upload, release, or deployment."), "required", "automatic release is prohibited");
pushCheck(checks, "blocker:macos-credentials-visible", recordsMacosCredentialBlocker, "required", "macOS signing/notarization blocker is visible");
pushCheck(checks, "blocker:windows-signing-visible", recordsWindowsCredentialBlocker, "required", "Windows signing blocker is visible");
pushCheck(checks, "blocker:phase4-real-asset-limit-visible", recordsPhase4Limit, "required", "Phase 4 real-asset limitation is visible");
pushCheck(checks, "gate:product-owner-review-ready", productReviewReady, "release_gate", "Product Owner review readiness");
pushCheck(checks, "credential:macos-signing-identity", hasMacosSigningIdentity(), "release_gate", "macOS signing identity is available");
pushCheck(checks, "credential:macos-notary", hasMacosNotaryCredentials(), "release_gate", "macOS notary credentials are available");

const requiredPrepPassed = checks
  .filter((check) => check.severity === "required")
  .every((check) => check.passed);
const releaseGatePassed = checks
  .filter((check) => check.severity === "release_gate")
  .every((check) => check.passed);

const report = {
  schemaVersion: 1,
  milestoneId: "SVGA-Workbench-v1",
  track: "short-term-distribution-preparation",
  generatedAt: new Date().toISOString(),
  branch: git(["rev-parse", "--abbrev-ref", "HEAD"]),
  headCommit: git(["rev-parse", "HEAD"]),
  state: requiredPrepPassed
    ? (releaseGatePassed ? "RELEASE_CANDIDATE_GATE_READY" : "PREP_READY_RELEASE_BLOCKED")
    : "PREP_INCOMPLETE",
  passed: requiredPrepPassed,
  releaseCandidateReady: requiredPrepPassed && releaseGatePassed,
  distributionTiers: [
    {
      id: "D0",
      name: "internal unsigned macOS ZIP",
      readyForEvidenceUse: requiredPrepPassed,
      trustedDistribution: false
    },
    {
      id: "D1",
      name: "signed and notarized macOS ZIP",
      readyForEvidenceUse: requiredPrepPassed && productReviewReady && hasMacosSigningIdentity() && hasMacosNotaryCredentials(),
      trustedDistribution: true
    },
    {
      id: "D2",
      name: "Windows trusted package",
      readyForEvidenceUse: false,
      trustedDistribution: true
    }
  ],
  commands: {
    readiness: "npm run svga-workbench:v1:distribution-readiness",
    validation: "npm run svga-workbench:v1:validate",
    completeReview: "npm run svga-workbench:v1:complete-review",
    macosPackage: "npm --prefix tools/electron-prototype/experiments/svga-web run internal:trial:package:mac",
    macosProof: "npm --prefix tools/electron-prototype/experiments/svga-web run internal:trial:proof:mac",
    macosSigningPlan: "npm --prefix tools/electron-prototype/experiments/svga-web run internal:trial:signing-plan:mac",
    macosSignExecute: "npm --prefix tools/electron-prototype/experiments/svga-web run internal:trial:sign:mac -- --execute",
    macosNotarizeExecute: "npm --prefix tools/electron-prototype/experiments/svga-web run internal:trial:notarize:mac -- --execute"
  },
  blockers: {
    productOwnerReviewReady: productReviewReady,
    macosSigningIdentityPresent: hasMacosSigningIdentity(),
    macosNotaryCredentialsPresent: hasMacosNotaryCredentials(),
    windowsTrustedDistributionBlocked: recordsWindowsCredentialBlocker,
    phase4RealAssetLimitTracked: recordsPhase4Limit
  },
  checks
};

await mkdir(path.dirname(outputPath), { recursive: true });
await writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");

console.log(JSON.stringify({
  passed: report.passed,
  releaseCandidateReady: report.releaseCandidateReady,
  state: report.state,
  reportPath: path.relative(repoRoot, outputPath),
  failedRequiredChecks: checks
    .filter((check) => check.severity === "required" && !check.passed)
    .map((check) => check.id),
  blockedReleaseChecks: checks
    .filter((check) => check.severity === "release_gate" && !check.passed)
    .map((check) => check.id)
}, null, 2));

if (!requiredPrepPassed) process.exitCode = 1;
