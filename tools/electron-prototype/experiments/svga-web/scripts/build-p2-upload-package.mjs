import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { cp, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptRoot = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptRoot, "../../../../..");
const artifactRoot = path.join(repoRoot, ".artifacts/product/P2");
const visibleRoot = path.join(repoRoot, "review/P2-latest");

const screenshotFiles = [
  "web-reference-empty.png",
  "web-reference-loaded.png",
  "web-reference-inspection.png",
  "web-reference-invalid.png",
  "desktop-empty.png",
  "desktop-loading.png",
  "desktop-loaded.png",
  "desktop-inspection.png",
  "desktop-invalid.png",
  "actual-normal-loaded.png",
  "smoke-loaded.png",
  "desktop-1280x800.png",
  "desktop-1440x900.png",
  "matched-web-desktop-empty-comparison.png",
  "matched-web-desktop-loaded-comparison.png",
  "matched-web-desktop-inspection-comparison.png",
  "matched-web-desktop-invalid-comparison.png"
];

const reportFiles = [
  "canonical-fixture.json",
  "invalid-fixture.json",
  "comparison-manifest.json",
  "artifact-index.json",
  "desktop-state-render-proof.json",
  "normal-runtime-proof.json",
  "normal-smoke-parity.json",
  "runtime-identity.json",
  "web-reference-runtime-proof.json",
  "web-reference-request-audit.json",
  "web-desktop-parity-report.json",
  "reviewer-b-product-categories.json"
];

const comparisonMetaFiles = [
  "matched-web-desktop-empty-comparison.png.meta.json",
  "matched-web-desktop-loaded-comparison.png.meta.json",
  "matched-web-desktop-inspection-comparison.png.meta.json",
  "matched-web-desktop-invalid-comparison.png.meta.json"
];

const textExtensions = new Set([".json", ".md", ".txt"]);

function readArgument(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function gitHeadCommit() {
  return execFileSync("git", ["rev-parse", "HEAD"], { cwd: repoRoot, encoding: "utf8" }).trim();
}

async function copyRequired(src, dest) {
  await readFile(src);
  await cp(src, dest);
}

function sanitizeReviewText(text, headShort) {
  const patterns = [
    [repoRoot, "<repo-root>"],
    [artifactRoot, "<artifact-root>"],
    [visibleRoot, "<visible-review-root>"],
    [process.env.HOME ?? "", "<home>"]
  ].filter(([pattern]) => pattern);
  let sanitized = text;
  for (const [pattern, replacement] of patterns) {
    sanitized = sanitized.split(pattern).join(replacement);
  }
  sanitized = sanitized
    .replace(/\/Users\/[^/\s"'`]+\/[^\s"'`]*/g, "<absolute-path-redacted>")
    .replace(/\/home\/[^/\s"'`]+\/[^\s"'`]*/g, "<absolute-path-redacted>")
    .replace(/[A-Za-z]:\\Users\\[^\\\s"'`]+\\[^\s"'`]*/g, "<absolute-path-redacted>");
  return sanitized.replace(/UPLOAD_TO_REVIEW_ASSISTANT:[^\n]+/g, `UPLOAD_TO_REVIEW_ASSISTANT:P2-${headShort}-upload.zip`);
}

async function listFiles(root) {
  const entries = await readdir(root, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const fullPath = path.join(root, entry.name);
    if (entry.isDirectory()) files.push(...await listFiles(fullPath));
    else files.push(fullPath);
  }
  return files;
}

async function sanitizeTextFiles(root, headShort) {
  for (const filePath of await listFiles(root)) {
    if (!textExtensions.has(path.extname(filePath))) continue;
    const text = await readFile(filePath, "utf8");
    await writeFile(filePath, sanitizeReviewText(text, headShort));
  }
}

async function buildPrivacyAudit(root) {
  const findings = [];
  const forbiddenPatterns = [
    { id: "repo_absolute_path", pattern: repoRoot },
    { id: "artifact_absolute_path", pattern: artifactRoot },
    { id: "visible_absolute_path", pattern: visibleRoot },
    { id: "home_absolute_path", pattern: process.env.HOME ?? "" },
    { id: "unix_user_path", pattern: /\/Users\/[^/\s"'`]+\/[^\s"'`]*/ },
    { id: "linux_user_path", pattern: /\/home\/[^/\s"'`]+\/[^\s"'`]*/ },
    { id: "windows_user_path", pattern: /[A-Za-z]:\\Users\\[^\\\s"'`]+\\[^\s"'`]*/ }
  ].filter((item) => item.pattern);
  const scannedFiles = [];
  for (const filePath of await listFiles(root)) {
    const relativePath = path.relative(root, filePath);
    if (relativePath.includes("__MACOSX") || relativePath.endsWith(".DS_Store")) {
      findings.push({ id: "macos_metadata", path: relativePath });
      continue;
    }
    if (!textExtensions.has(path.extname(filePath))) continue;
    scannedFiles.push(relativePath);
    const text = await readFile(filePath, "utf8");
    for (const forbidden of forbiddenPatterns) {
      const matched = typeof forbidden.pattern === "string"
        ? text.includes(forbidden.pattern)
        : forbidden.pattern.test(text);
      if (matched) findings.push({ id: forbidden.id, path: relativePath });
    }
  }
  return {
    schemaVersion: 1,
    milestoneId: "P2",
    passed: findings.length === 0,
    scannedTextFiles: scannedFiles.sort(),
    findings,
    redactions: ["repoRoot", "artifactRoot", "visibleRoot", "homePath", "absoluteUserPaths"],
    generatedAt: new Date().toISOString()
  };
}

async function main() {
  const headCommit = gitHeadCommit();
  const headShort = headCommit.slice(0, 7);
  const packetRoot = readArgument("--packet-root")
    ? path.resolve(repoRoot, readArgument("--packet-root"))
    : path.join(repoRoot, ".artifacts/loop-handoff/latest");
  const stagingRoot = path.join(artifactRoot, `P2-${headShort}-upload`);
  const uploadZip = path.join(artifactRoot, `P2-${headShort}-upload.zip`);
  await rm(stagingRoot, { recursive: true, force: true });
  await rm(uploadZip, { force: true });
  await mkdir(path.join(stagingRoot, "screenshots"), { recursive: true });
  await mkdir(path.join(stagingRoot, "reports"), { recursive: true });

  await copyRequired(path.join(packetRoot, "REVIEW_PACKET.md"), path.join(stagingRoot, "REVIEW_PACKET.md"));
  await copyRequired(path.join(packetRoot, "FINAL_RESPONSE.txt"), path.join(stagingRoot, "FINAL_RESPONSE.txt"));
  await copyRequired(path.join(packetRoot, "MANIFEST.json"), path.join(stagingRoot, "MANIFEST.json"));
  await writeFile(path.join(stagingRoot, "README.md"), [
    "# P2 Review Upload Package",
    "",
    "Status: HUMAN_REQUIRED",
    "This package contains the P2 final repair review packet and product evidence.",
    "",
    "Upload this ZIP only. REVIEW_PACKET.md is included inside the ZIP.",
    ""
  ].join("\n"));

  for (const fileName of screenshotFiles) {
    await copyRequired(path.join(artifactRoot, fileName), path.join(stagingRoot, "screenshots", fileName));
  }
  for (const fileName of reportFiles) {
    await copyRequired(path.join(artifactRoot, fileName), path.join(stagingRoot, "reports", fileName));
  }
  for (const fileName of comparisonMetaFiles) {
    await copyRequired(path.join(artifactRoot, fileName), path.join(stagingRoot, "reports", fileName));
  }

  await sanitizeTextFiles(stagingRoot, headShort);
  const privacyAudit = await buildPrivacyAudit(stagingRoot);
  await writeFile(path.join(stagingRoot, "reports", "bundle-privacy-audit.json"), `${JSON.stringify(privacyAudit, null, 2)}\n`);
  await writeFile(path.join(artifactRoot, "bundle-privacy-audit.json"), `${JSON.stringify(privacyAudit, null, 2)}\n`);
  if (!privacyAudit.passed) {
    throw new Error(`Upload bundle privacy audit failed: ${privacyAudit.findings.map((finding) => `${finding.id}:${finding.path}`).join("; ")}`);
  }

  execFileSync("zip", ["-qr", uploadZip, "."], {
    cwd: stagingRoot,
    env: { ...process.env, COPYFILE_DISABLE: "1" }
  });
  await rm(stagingRoot, { recursive: true, force: true });
  await mkdir(visibleRoot, { recursive: true });
  await cp(uploadZip, path.join(visibleRoot, path.basename(uploadZip)));
  await cp(path.join(packetRoot, "REVIEW_PACKET.md"), path.join(visibleRoot, "REVIEW_PACKET.md"));
  await writeFile(
    path.join(visibleRoot, "FINAL_RESPONSE.txt"),
    sanitizeReviewText(await readFile(path.join(packetRoot, "FINAL_RESPONSE.txt"), "utf8"), headShort)
  );
  await cp(path.join(packetRoot, "MANIFEST.json"), path.join(visibleRoot, "MANIFEST.json"));
  const bytes = await readFile(uploadZip);
  const summary = {
    schemaVersion: 1,
    milestoneId: "P2",
    headCommit,
    uploadZip: path.relative(repoRoot, uploadZip),
    visibleUploadZip: path.relative(repoRoot, path.join(visibleRoot, path.basename(uploadZip))),
    sizeBytes: bytes.byteLength,
    sha256: createHash("sha256").update(bytes).digest("hex"),
    screenshotFiles,
    reportFiles: [...reportFiles, ...comparisonMetaFiles, "bundle-privacy-audit.json"],
    privacyAudit: {
      passed: privacyAudit.passed,
      findingCount: privacyAudit.findings.length
    },
    generatedAt: new Date().toISOString()
  };
  await writeFile(path.join(artifactRoot, "p2-upload-package-summary.json"), `${JSON.stringify(summary, null, 2)}\n`);
  await writeFile(path.join(visibleRoot, "README.md"), [
    "# P2 Review Materials",
    "",
    "Use the ZIP in this folder for review upload.",
    "",
    `- ${path.basename(uploadZip)}`,
    "- REVIEW_PACKET.md is included in the ZIP and also copied here for quick reading.",
    ""
  ].join("\n"));
  await sanitizeTextFiles(visibleRoot, headShort);
  console.log(`P2_UPLOAD_PACKAGE=${JSON.stringify(summary)}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
