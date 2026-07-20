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

function readArgument(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

async function readJson(fileName) {
  return JSON.parse(await readFile(path.join(artifactRoot, fileName), "utf8"));
}

async function readReviewerInput() {
  const inputPath = process.env.AUTO_SVGA_REVIEWER_B_INPUT ?? readArgument("--input");
  if (!inputPath) {
    throw new Error("Independent Reviewer B input is required. Pass --input <reviewer-b-json> or AUTO_SVGA_REVIEWER_B_INPUT.");
  }
  return JSON.parse(await readFile(path.resolve(repoRoot, inputPath), "utf8"));
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

function validateReviewerInput(input, report, canonical) {
  const failures = [];
  if (input.schemaVersion !== 2) failures.push("schemaVersion must be 2");
  if (input.reviewerId !== "B") failures.push("reviewerId must be B");
  if (!["PASS", "BLOCKING", "HUMAN_REQUIRED"].includes(input.verdict)) failures.push("verdict must be PASS, BLOCKING, or HUMAN_REQUIRED");
  if (input.reviewedHeadCommit !== (report.headCommit ?? gitHeadCommit())) failures.push("reviewedHeadCommit must match parity report head");
  if (input.fixture?.sha256 !== canonical.sha256) failures.push("fixture.sha256 must match canonical fixture");
  for (const name of requiredCategories) {
    const category = input.categories?.[name];
    if (!category) {
      failures.push(`missing category ${name}`);
      continue;
    }
    if (!["PASS", "BLOCKING", "HUMAN_REQUIRED"].includes(category.verdict)) failures.push(`${name}.verdict is invalid`);
    if (!Array.isArray(category.evidenceRefs) || category.evidenceRefs.length === 0) failures.push(`${name}.evidenceRefs required`);
    if (!Array.isArray(category.visualObservations)) failures.push(`${name}.visualObservations must be an array`);
  }
  return failures;
}

async function main() {
  const report = await readJson("web-desktop-parity-report.json");
  const canonical = await readJson("canonical-fixture.json");
  const input = await readReviewerInput();
  const validationFailures = validateReviewerInput(input, report, canonical);
  if (validationFailures.length > 0) {
    throw new Error(`Independent Reviewer B input failed validation: ${validationFailures.join("; ")}`);
  }
  const payload = {
    schemaVersion: 2,
    reviewerId: "B",
    verdict: input.verdict,
    reviewedHeadCommit: report.headCommit ?? gitHeadCommit(),
    candidateDigest: input.candidateDigest,
    packetDiffSha256: input.packetDiffSha256 ?? null,
    reviewBoundary: "upload ZIP screenshots and reports only",
    fixture: {
      label: canonical.label,
      sha256: canonical.sha256,
      sizeBytes: canonical.sizeBytes
    },
    categories: input.categories,
    findings: input.findings ?? [],
    confirmations: {
      independentReviewerInput: true,
      sameFixtureHash: report.fixtureParity?.sameFixture === true,
      productCategoriesReviewed: requiredCategories.every((name) => Boolean(input.categories?.[name])),
      uploadZipSufficientForProductReview: input.verdict === "PASS"
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
