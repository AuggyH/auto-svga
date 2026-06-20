import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { cp, mkdir, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import { inflateSync } from "node:zlib";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptRoot = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptRoot, "../../../../..");
const artifactRoot = path.join(repoRoot, ".artifacts/product/P4");
const visibleRoot = path.join(repoRoot, "review/P4-latest");
const textExtensions = new Set([".json", ".md", ".txt", ".html", ".js", ".mjs", ".css", ".svg", ".xml", ".patch"]);
const pngExtensions = new Set([".png"]);
const svgaExtensions = new Set([".svga"]);

const screenshotFiles = [
  "multi-resource-original.png",
  "multi-resource-list.png",
  "first-replacement.png",
  "two-replacements.png",
  "undo-second-replacement.png",
  "redo-second-replacement.png",
  "reset-selected.png",
  "undo-reset-selected.png",
  "reset-all.png",
  "undo-reset-all.png",
  "dirty-two-edits.png",
  "save-point-clean.png",
  "post-save-new-edit.png",
  "reopened-multi-resource-export.png",
  "invalid-second-png.png",
  "multi-resource-comparison.png"
];

const reportFiles = [
  "canonical-multi-resource-fixture.json",
  "multi-resource-round-trip-report.json",
  "edit-history-report.json",
  "multi-resource-edit-report.json",
  "thumbnail-evidence.json",
  "artifact-index.json"
];

function readArgument(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function gitHeadCommit() {
  return execFileSync("git", ["rev-parse", "HEAD"], { cwd: repoRoot, encoding: "utf8" }).trim();
}

function sha256Bytes(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

async function sha256File(filePath) {
  return sha256Bytes(await readFile(filePath));
}

async function fileIdentity(filePath) {
  const bytes = await readFile(filePath);
  return {
    sizeBytes: bytes.byteLength,
    sha256: sha256Bytes(bytes)
  };
}

async function copyRequired(sourcePath, targetPath) {
  const before = await fileIdentity(sourcePath);
  await mkdir(path.dirname(targetPath), { recursive: true });
  await cp(sourcePath, targetPath);
  const after = await fileIdentity(targetPath);
  if (before.sizeBytes !== after.sizeBytes || before.sha256 !== after.sha256) {
    throw new Error(`Copied file changed: ${sourcePath}`);
  }
  return after;
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

function toBundlePath(root, filePath) {
  return path.relative(root, filePath).split(path.sep).join("/");
}

function mimeFor(bundlePath) {
  const extension = path.extname(bundlePath).toLowerCase();
  if (extension === ".json") return "application/json";
  if (extension === ".md") return "text/markdown";
  if (extension === ".txt") return "text/plain";
  if (extension === ".png") return "image/png";
  if (extension === ".svga") return "application/x-svga";
  if (extension === ".patch") return "text/x-diff";
  return "application/octet-stream";
}

function roleFor(bundlePath) {
  if (bundlePath === "REVIEW_PACKET.md") return "sealed-review-packet";
  if (bundlePath === "FINAL_RESPONSE.txt") return "final-upload-response";
  if (bundlePath === "MANIFEST.json") return "bundle-manifest";
  if (bundlePath === "changes.patch") return "source-diff";
  if (bundlePath.startsWith("screenshots/")) return "visual-evidence";
  if (bundlePath.startsWith("reports/")) return "machine-report";
  if (bundlePath.startsWith("artifacts/")) return "edited-output";
  return "supporting-evidence";
}

function extractBinaryText(bytes) {
  return Buffer.from(bytes).toString("latin1").replace(/[^\x20-\x7e\n\r\t]+/g, " ");
}

function inflateSvgaStrings(bytes) {
  try {
    return extractBinaryText(inflateSync(bytes));
  } catch {
    return "";
  }
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function privacyRules() {
  const escapedRepoRoot = escapeRegExp(repoRoot);
  const escapedHome = escapeRegExp(process.env.HOME ?? "");
  const escapedTmp = escapeRegExp(os.tmpdir());
  return [
    { ruleId: "MACOS_USERS_PATH", pattern: /\/Users\/[^/\s"'`]+(?:\/[^\s"'`]*)?/g },
    { ruleId: "POSIX_HOME_PATH", pattern: /\/home\/[^/\s"'`]+(?:\/[^\s"'`]*)?/g },
    { ruleId: "WINDOWS_USERS_PATH", pattern: /[A-Za-z]:\\Users\\[^\\\s"'`]+(?:\\[^\s"'`]*)?/g },
    escapedRepoRoot ? { ruleId: "REPO_ABSOLUTE_PATH", pattern: new RegExp(escapedRepoRoot, "g") } : null,
    escapedHome ? { ruleId: "HOME_ABSOLUTE_PATH", pattern: new RegExp(escapedHome, "g") } : null,
    escapedTmp ? { ruleId: "TEMP_ABSOLUTE_PATH", pattern: new RegExp(escapedTmp, "g") } : null,
    os.userInfo().username ? { ruleId: "LOCAL_USERNAME", pattern: new RegExp(escapeRegExp(os.userInfo().username), "g") } : null
  ].filter(Boolean);
}

function collectPrivacyFindingsFromText(text, entry, allowedUploadTargets) {
  const findings = [];
  for (const rule of privacyRules()) {
    for (const match of text.matchAll(rule.pattern)) {
      const value = match[0];
      const matchIndex = match.index ?? 0;
      const lineStart = text.lastIndexOf("\n", matchIndex) + 1;
      const lineEndIndex = text.indexOf("\n", matchIndex);
      const lineEnd = lineEndIndex >= 0 ? lineEndIndex : text.length;
      const containingLine = text.slice(lineStart, lineEnd);
      const allowed = allowedUploadTargets.some((target) => (
        value.includes(target) || containingLine.includes(target)
      ));
      findings.push({
        ruleId: rule.ruleId,
        entry,
        allowedUploadPointer: allowed,
        redacted: true,
        valueHash: sha256Bytes(Buffer.from(String(value)))
      });
    }
  }
  return findings;
}

async function buildPrivacyAudit(root, allowedUploadTargets) {
  const findings = [];
  const scannedEntries = [];
  for (const filePath of await listFiles(root)) {
    const bundlePath = toBundlePath(root, filePath);
    findings.push(...collectPrivacyFindingsFromText(bundlePath, `entry:${bundlePath}`, allowedUploadTargets));
    const extension = path.extname(bundlePath).toLowerCase();
    const bytes = await readFile(filePath);
    if (textExtensions.has(extension)) {
      scannedEntries.push({ path: bundlePath, scan: "text" });
      findings.push(...collectPrivacyFindingsFromText(bytes.toString("utf8"), bundlePath, allowedUploadTargets));
    } else if (pngExtensions.has(extension)) {
      scannedEntries.push({ path: bundlePath, scan: "png-binary-text" });
      findings.push(...collectPrivacyFindingsFromText(extractBinaryText(bytes), bundlePath, allowedUploadTargets));
    } else if (svgaExtensions.has(extension)) {
      scannedEntries.push({ path: bundlePath, scan: "svga-raw-and-inflated-strings" });
      findings.push(...collectPrivacyFindingsFromText(extractBinaryText(bytes), bundlePath, allowedUploadTargets));
      findings.push(...collectPrivacyFindingsFromText(inflateSvgaStrings(bytes), `${bundlePath}:inflated`, allowedUploadTargets));
    }
  }
  const blockingFindings = findings.filter((finding) => finding.allowedUploadPointer !== true);
  return {
    schemaVersion: 1,
    milestoneId: "P4",
    passed: blockingFindings.length === 0,
    scannedEntries: scannedEntries.sort((left, right) => left.path.localeCompare(right.path)),
    expectedEntryCount: (await listFiles(root)).length,
    findingCount: findings.length,
    blockingFindingCount: blockingFindings.length,
    findings,
    allowedUploadPointerPolicy: "Absolute paths are allowed only inside generated review handoff pointers for the visible P4 ZIP and REVIEW_PACKET."
  };
}

async function buildManifest(root, headCommit) {
  const entries = [];
  for (const filePath of (await listFiles(root)).sort()) {
    const bundlePath = toBundlePath(root, filePath);
    if (bundlePath === "MANIFEST.json") continue;
    const fileStat = await stat(filePath);
    entries.push({
      path: bundlePath,
      role: roleFor(bundlePath),
      mime: mimeFor(bundlePath),
      sizeBytes: fileStat.size,
      sha256: await sha256File(filePath),
      includedInBundle: true
    });
  }
  entries.push({
    path: "MANIFEST.json",
    role: "bundle-manifest",
    mime: "application/json",
    sizeBytes: 0,
    sha256: "self-referential-manifest-entry",
    includedInBundle: true
  });
  return {
    schemaVersion: 1,
    milestoneId: "P4",
    headCommit,
    generatedAt: "stable-p4-bundle-manifest",
    entries: entries.sort((left, right) => left.path.localeCompare(right.path))
  };
}

async function writeManifest(root, headCommit) {
  await writeFile(path.join(root, "MANIFEST.json"), `${JSON.stringify(await buildManifest(root, headCommit), null, 2)}\n`);
}

async function buildReviewerBProductCategories(stagingRoot) {
  const reviewerB = JSON.parse(await readFile(path.join(stagingRoot, "reviewer-b.json"), "utf8"));
  const categories = reviewerB.categories ?? reviewerB.productCategories;
  if (reviewerB.verdict !== "PASS") {
    throw new Error("Reviewer B verdict is not PASS.");
  }
  if (!Array.isArray(categories) || categories.length === 0) {
    throw new Error("Reviewer B JSON must include independently authored categories.");
  }
  for (const category of categories) {
    if (category.verdict !== "PASS") throw new Error(`Reviewer B category did not pass: ${category.category ?? "unknown"}`);
    if (typeof category.visualObservations !== "string" || category.visualObservations.length < 8) {
      throw new Error(`Reviewer B category lacks visual observations: ${category.category ?? "unknown"}`);
    }
    if (!Array.isArray(category.evidence) || category.evidence.length === 0) {
      throw new Error(`Reviewer B category lacks evidence refs: ${category.category ?? "unknown"}`);
    }
  }
  return {
    schemaVersion: 1,
    milestoneId: "P4",
    reviewerId: "B",
    reviewSource: "independent-read-only-reviewer-b-json",
    verdict: "PASS",
    categories,
    generatedAt: "stable-p4-reviewer-b-product-categories"
  };
}

async function buildProductValidation({ stagingRoot, sealedPacketManifest, reviewerBProductCategories, privacyAudit }) {
  const roundTrip = JSON.parse(await readFile(path.join(stagingRoot, "reports/multi-resource-round-trip-report.json"), "utf8"));
  const editReport = JSON.parse(await readFile(path.join(stagingRoot, "reports/multi-resource-edit-report.json"), "utf8"));
  const history = JSON.parse(await readFile(path.join(stagingRoot, "reports/edit-history-report.json"), "utf8"));
  const thumbnail = JSON.parse(await readFile(path.join(stagingRoot, "reports/thumbnail-evidence.json"), "utf8"));
  const bundleEntries = new Set((await listFiles(stagingRoot)).map((filePath) => toBundlePath(stagingRoot, filePath)));
  const requiredEntries = [
    "REVIEW_PACKET.md",
    "README.md",
    "FINAL_RESPONSE.txt",
    "MANIFEST.json",
    "validation.json",
    "budget-check.json",
    "reviewer-a.json",
    "reviewer-b.json",
    "post-seal-verification.json",
    ...screenshotFiles.map((fileName) => `screenshots/${fileName}`),
    ...reportFiles.map((fileName) => `reports/${fileName}`),
    "reports/reviewer-b-product-categories.json",
    "reports/bundle-privacy-audit.json",
    "artifacts/multi-resource-edited-output.svga"
  ];
  if (sealedPacketManifest.companionRequired === true) requiredEntries.push("changes.patch");
  const checks = [
    ["required_entries_present", requiredEntries.every((entry) => bundleEntries.has(entry))],
    ["sealed_packet_human_required", sealedPacketManifest.milestoneOutcome === "HUMAN_REQUIRED"],
    ["round_trip_schema_v3", roundTrip.schemaVersion === 3],
    ["round_trip_passed", roundTrip.passed === true],
    ["round_trip_two_replacements", (roundTrip.replacements ?? []).length >= 2],
    ["round_trip_no_unexpected_changes", Array.isArray(roundTrip.unexpectedChanges) && roundTrip.unexpectedChanges.length === 0],
    ["edit_report_passed", editReport.passed === true],
    ["history_report_passed", history.passed === true],
    ["thumbnail_evidence_passed", thumbnail.passed === true],
    ["reviewer_b_independent_categories_passed", reviewerBProductCategories.verdict === "PASS"],
    ["privacy_audit_passed", privacyAudit.passed === true]
  ];
  return {
    schemaVersion: 1,
    milestoneId: "P4",
    passed: checks.every(([, passed]) => passed),
    missingRequiredEntries: requiredEntries.filter((entry) => !bundleEntries.has(entry)),
    checks: checks.map(([code, passed]) => ({ code, passed }))
  };
}

function finalResponseText({ uploadZipPath, packetPath, visibleRootPath }) {
  return [
    "HUMAN_REQUIRED",
    "",
    "REVIEW_PACKET_READY",
    "",
    "REVIEW_MATERIALS:",
    `- [P4 latest review folder](${visibleRootPath})`,
    "",
    "UPLOAD_TO_REVIEW_ASSISTANT:",
    `1. [P4 upload ZIP](${uploadZipPath})`,
    "",
    "OPTIONAL_REFERENCE:",
    `- [P4 sealed REVIEW_PACKET.md](${packetPath})`,
    "",
    "Question:",
    "是否接受 P4 多图像资源替换、撤销/重做、保存点状态以及多资源导出完整性，并允许规划下一项编辑能力？",
    "",
    "Recommendation:",
    "A: 接受 P4，允许规划下一项编辑能力。只有两个 replacement、Undo/Redo、Save point、导出完整性和 Reviewer A/B 都通过后推荐 A。",
    "",
    "Safe default while waiting:",
    "B，不开始下一里程碑。",
    "",
    "Do not upload:",
    "- individual screenshots",
    "- individual JSON reports",
    "- hidden .artifacts directories",
    "unless explicitly requested.",
    ""
  ].join("\n");
}

function zipFiles(root, zipPath, bundlePaths) {
  execFileSync("zip", ["-q", "-X", zipPath, "-@"], {
    cwd: root,
    input: `${bundlePaths.join("\n")}\n`,
    env: { ...process.env, COPYFILE_DISABLE: "1" }
  });
}

function zipEntries(zipPath) {
  return execFileSync("unzip", ["-Z1", zipPath], { encoding: "utf8" }).split("\n").filter(Boolean).sort();
}

async function main() {
  const headCommit = gitHeadCommit();
  const headShort = headCommit.slice(0, 7);
  const packetRoot = readArgument("--packet-root")
    ? path.resolve(repoRoot, readArgument("--packet-root"))
    : path.join(repoRoot, ".artifacts/loop-handoff/latest");
  const stagingRoot = path.join(artifactRoot, `P4-${headShort}-upload`);
  const uploadZip = path.join(artifactRoot, `P4-${headShort}-upload.zip`);
  const visibleUploadZip = path.join(visibleRoot, path.basename(uploadZip));
  const visiblePacket = path.join(visibleRoot, "REVIEW_PACKET.md");
  const finalText = finalResponseText({
    uploadZipPath: visibleUploadZip,
    packetPath: visiblePacket,
    visibleRootPath: visibleRoot
  });

  await rm(stagingRoot, { recursive: true, force: true });
  await rm(uploadZip, { force: true });
  await mkdir(path.join(stagingRoot, "screenshots"), { recursive: true });
  await mkdir(path.join(stagingRoot, "reports"), { recursive: true });
  await mkdir(path.join(stagingRoot, "artifacts"), { recursive: true });

  const packetManifest = JSON.parse(await readFile(path.join(packetRoot, "MANIFEST.json"), "utf8"));
  if (packetManifest.milestoneOutcome !== "HUMAN_REQUIRED") {
    throw new Error("P4 upload package requires a HUMAN_REQUIRED sealed packet.");
  }

  for (const fileName of ["REVIEW_PACKET.md", "validation.json", "budget-check.json", "reviewer-a.json", "reviewer-b.json", "post-seal-verification.json"]) {
    await copyRequired(path.join(packetRoot, fileName), path.join(stagingRoot, fileName));
  }
  if (packetManifest.companionRequired === true) {
    await copyRequired(path.join(packetRoot, "changes.patch"), path.join(stagingRoot, "changes.patch"));
  }
  for (const fileName of screenshotFiles) {
    await copyRequired(path.join(artifactRoot, fileName), path.join(stagingRoot, "screenshots", fileName));
  }
  for (const fileName of reportFiles) {
    await copyRequired(path.join(artifactRoot, fileName), path.join(stagingRoot, "reports", fileName));
  }
  await copyRequired(path.join(artifactRoot, "multi-resource-edited-output.svga"), path.join(stagingRoot, "artifacts/multi-resource-edited-output.svga"));

  await writeFile(path.join(stagingRoot, "README.md"), [
    "# P4 Review Upload Package",
    "",
    "Status: HUMAN_REQUIRED",
    "This package contains the P4 multi-resource editing review packet, screenshots, machine reports, edited SVGA output, and privacy audit.",
    "Upload the ZIP as one file. P4 remains blocked on the product owner Human Gate.",
    ""
  ].join("\n"));
  await writeFile(path.join(stagingRoot, "FINAL_RESPONSE.txt"), finalText);

  const reviewerBProductCategories = await buildReviewerBProductCategories(stagingRoot);
  await writeFile(path.join(stagingRoot, "reports/reviewer-b-product-categories.json"), `${JSON.stringify(reviewerBProductCategories, null, 2)}\n`);
  await writeManifest(stagingRoot, headCommit);
  const privacyAudit = await buildPrivacyAudit(stagingRoot, [path.basename(uploadZip), "P4-latest", "REVIEW_PACKET.md"]);
  await writeFile(path.join(stagingRoot, "reports/bundle-privacy-audit.json"), `${JSON.stringify(privacyAudit, null, 2)}\n`);
  const productValidation = await buildProductValidation({
    stagingRoot,
    sealedPacketManifest: packetManifest,
    reviewerBProductCategories,
    privacyAudit
  });
  await writeFile(path.join(stagingRoot, "reports/product-bundle-validation.json"), `${JSON.stringify(productValidation, null, 2)}\n`);
  await writeManifest(stagingRoot, headCommit);

  if (!privacyAudit.passed) {
    throw new Error("P4 upload privacy audit failed.");
  }
  if (!productValidation.passed) {
    throw new Error(`P4 product bundle validation failed: ${productValidation.checks.filter((check) => !check.passed).map((check) => check.code).join(", ")}`);
  }

  const finalFiles = (await listFiles(stagingRoot)).map((filePath) => toBundlePath(stagingRoot, filePath)).sort();
  zipFiles(stagingRoot, uploadZip, finalFiles);
  const entries = zipEntries(uploadZip);
  if (JSON.stringify(entries) !== JSON.stringify(finalFiles)) {
    throw new Error("P4 upload ZIP entries do not exactly match staged files.");
  }
  const zipBytes = await readFile(uploadZip);
  const zipSummary = {
    schemaVersion: 1,
    milestoneId: "P4",
    headCommit,
    uploadZip: path.relative(repoRoot, uploadZip),
    visibleZip: path.relative(repoRoot, visibleUploadZip),
    sizeBytes: zipBytes.byteLength,
    sha256: sha256Bytes(zipBytes),
    entryCount: entries.length,
    privacyAudit: {
      passed: privacyAudit.passed,
      blockingFindingCount: privacyAudit.blockingFindingCount
    },
    reviewerBProductCategories: {
      verdict: reviewerBProductCategories.verdict,
      categoryCount: reviewerBProductCategories.categories.length
    }
  };
  await writeFile(path.join(artifactRoot, "p4-upload-package-summary.json"), `${JSON.stringify(zipSummary, null, 2)}\n`);

  await rm(stagingRoot, { recursive: true, force: true });
  await rm(visibleRoot, { recursive: true, force: true });
  await mkdir(visibleRoot, { recursive: true });
  await cp(uploadZip, visibleUploadZip);
  await cp(path.join(packetRoot, "REVIEW_PACKET.md"), visiblePacket);
  await cp(path.join(packetRoot, "MANIFEST.json"), path.join(visibleRoot, "MANIFEST.json"));
  await writeFile(path.join(visibleRoot, "FINAL_RESPONSE.txt"), finalText);
  await writeFile(path.join(visibleRoot, "README.md"), [
    "# P4 Review Materials",
    "",
    "This visible folder is the only folder the product owner needs for P4 review.",
    "",
    `- ${path.basename(uploadZip)}: upload this single ZIP for review.`,
    "- REVIEW_PACKET.md: readable copy of the sealed packet.",
    "- FINAL_RESPONSE.txt: exact final response content.",
    "",
    "Hidden .artifacts paths are internal build outputs and are not required for review.",
    ""
  ].join("\n"));
  await writeFile(path.join(visibleRoot, "UPLOAD_INDEX.json"), `${JSON.stringify(zipSummary, null, 2)}\n`);
  console.log(`P4_UPLOAD_PACKAGE=${JSON.stringify(zipSummary)}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
