import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptRoot = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptRoot, "../../../../..");
const artifactRoot = path.join(repoRoot, ".artifacts/product/P2");

const requiredCategories = [
  "productIdentity",
  "fixtureParity",
  "playerWorkspace",
  "controls",
  "metadata",
  "inspection",
  "emptyState",
  "loadingState",
  "invalidState",
  "webDesktopParity",
  "normalRuntimeEvidence"
];

function gitHeadCommit() {
  return process.env.AUTO_SVGA_REVIEWED_HEAD
    ?? execFileSync("git", ["rev-parse", "HEAD"], { cwd: repoRoot, encoding: "utf8" }).trim();
}

async function readJson(fileName) {
  return JSON.parse(await readFile(path.join(artifactRoot, fileName), "utf8"));
}

async function upsertArtifactRecord(fileName, payload, canonical) {
  const index = await readJson("artifact-index.json").catch(() => ({
    milestoneId: "P2",
    title: "Desktop Product Shell And Web Preview Parity",
    productIdentity: "Auto SVGA",
    headCommit: payload.reviewedHeadCommit,
    generatedAt: new Date().toISOString(),
    humanReviewRequired: true,
    artifacts: []
  }));
  const bytes = await readFile(path.join(artifactRoot, fileName));
  const record = {
    scenario: "reviewer-b-product-categories",
    mode: "review",
    source: "reviewer-b",
    viewport: { width: null, height: null },
    path: `.artifacts/product/P2/${fileName}`,
    mime: "application/json",
    sizeBytes: bytes.byteLength,
    sha256: createHash("sha256").update(bytes).digest("hex"),
    fixture: canonical.label,
    fixtureLabel: canonical.label,
    fixtureSha256: canonical.sha256,
    fixtureSizeBytes: canonical.sizeBytes,
    fixtureSourcePath: canonical.sourcePath,
    fixtureArtifactPath: canonical.artifactPath,
    headCommit: payload.reviewedHeadCommit,
    generatedAt: new Date().toISOString(),
    humanReviewRequired: true
  };
  index.artifacts = index.artifacts.filter((artifact) => artifact.path !== record.path);
  index.artifacts.push(record);
  index.generatedAt = new Date().toISOString();
  await writeFile(path.join(artifactRoot, "artifact-index.json"), `${JSON.stringify(index, null, 2)}\n`);
}

function categoryVerdict(report, name) {
  const result = report.categoryResults?.[name];
  const failedChecks = Array.isArray(result?.checks) ? result.checks.filter((check) => !check.passed) : [];
  return {
    verdict: result?.status === "pass" && failedChecks.length === 0 ? "PASS" : "BLOCKING",
    evidence: result?.evidenceRefs ?? [],
    finding: failedChecks.length === 0 ? null : failedChecks.map((check) => ({
      id: check.id,
      actual: check.actual,
      expected: check.expected
    }))
  };
}

async function main() {
  const report = await readJson("web-desktop-parity-report.json");
  const canonical = await readJson("canonical-fixture.json");
  const categories = Object.fromEntries(requiredCategories.map((name) => [name, categoryVerdict(report, name)]));
  const blocking = Object.entries(categories)
    .filter(([, value]) => value.verdict === "BLOCKING")
    .map(([name, value]) => ({ category: name, finding: value.finding }));
  const payload = {
    schemaVersion: 1,
    reviewerId: "B",
    verdict: blocking.length === 0 ? "PASS" : "BLOCKING",
    reviewedHeadCommit: report.headCommit ?? gitHeadCommit(),
    candidateDigest: process.env.AUTO_SVGA_CANDIDATE_DIGEST ?? "pending-final-candidate",
    reviewBoundary: "upload ZIP screenshots and reports only",
    fixture: {
      label: canonical.label,
      sha256: canonical.sha256,
      sizeBytes: canonical.sizeBytes
    },
    categories,
    findings: blocking,
    confirmations: {
      sameFixtureHash: report.fixtureParity?.sameFixture === true,
      validInvalidPhaseIsolated: report.categoryResults?.playerWorkspace?.checks?.some((check) => check.id === "web_invalid_phase_isolated" && check.passed === true) === true,
      emptyStateCentralUpload: categories.emptyState.verdict === "PASS",
      noRawAuditKeyInPrimaryInspection: categories.inspection.verdict === "PASS",
      uploadZipSufficientForProductReview: blocking.length === 0
    },
    generatedAt: new Date().toISOString()
  };
  const bytes = Buffer.from(`${JSON.stringify(payload, null, 2)}\n`);
  await writeFile(path.join(artifactRoot, "reviewer-b-product-categories.json"), bytes);
  await upsertArtifactRecord("reviewer-b-product-categories.json", payload, canonical);
  console.log(`P2_REVIEWER_B_PRODUCT_CATEGORIES=${JSON.stringify({
    verdict: payload.verdict,
    sha256: createHash("sha256").update(bytes).digest("hex"),
    sizeBytes: bytes.byteLength
  })}`);
  if (payload.verdict !== "PASS") process.exit(1);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
