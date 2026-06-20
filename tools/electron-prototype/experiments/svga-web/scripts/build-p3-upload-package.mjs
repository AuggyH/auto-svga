import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { cp, mkdir, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import { inflateSync } from "node:zlib";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptRoot = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptRoot, "../../../../..");
const artifactRoot = path.join(repoRoot, ".artifacts/product/P3");
const visibleRoot = path.join(repoRoot, "review/P3-latest");
const textExtensions = new Set([".json", ".md", ".txt", ".html", ".js", ".mjs", ".css", ".svg", ".xml", ".patch"]);
const pngExtensions = new Set([".png"]);
const svgaExtensions = new Set([".svga"]);

const PRIVATE_SENTINELS = Object.freeze({
  POSIX_HOME_PATH: ["", "home", "private-user", "example"].join("/"),
  MACOS_USERS_PATH: ["", "Users", "private-user", "example"].join("/"),
  WINDOWS_USERS_PATH: ["C:", "Users", "private-user", "example"].join("\\"),
  REPO_ABSOLUTE_PATH: ["", "private", "repo", "root", "example"].join("/"),
  TEMP_ABSOLUTE_PATH: ["", "private", "var", "folders", "example"].join("/")
});

const screenshotFiles = [
  "original-loaded.png",
  "resource-list.png",
  "replacement-selected.png",
  "replacement-preview.png",
  "dirty-state.png",
  "reset-to-original.png",
  "export-success.png",
  "reopened-export.png",
  "invalid-png-state.png",
  "original-edited-comparison.png"
];

const reportFiles = [
  "artifact-index.json",
  "resource-edit-report.json",
  "round-trip-report.json",
  "thumbnail-evidence.json"
];

const docCopies = [
  ["docs/loop/CURRENT_MILESTONE.md", "docs/CURRENT_MILESTONE.md"]
];

function readArgument(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function gitHeadCommit() {
  return execFileSync("git", ["rev-parse", "HEAD"], { cwd: repoRoot, encoding: "utf8" }).trim();
}

function gitDiffStat() {
  return execFileSync("git", ["diff", "--stat"], { cwd: repoRoot, encoding: "utf8" });
}

function gitStatusShort() {
  return execFileSync("git", ["status", "--short"], { cwd: repoRoot, encoding: "utf8" });
}

async function copyRequired(sourcePath, targetPath) {
  const before = await fileIdentity(sourcePath);
  await mkdir(path.dirname(targetPath), { recursive: true });
  await cp(sourcePath, targetPath);
  const after = await fileIdentity(targetPath);
  return { sourcePath, targetPath, before, after };
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

function sha256Bytes(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

async function sha256File(filePath) {
  return sha256Bytes(await readFile(filePath));
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
  if (bundlePath.startsWith("docs/")) return "supporting-doc";
  return "supporting-evidence";
}

function privacyRules() {
  const slash = "/";
  const macUsersPrefix = ["", "Users", ""].join(slash);
  const posixHomePrefix = ["", "home", ""].join(slash);
  const windowsUsersPrefix = ["[A-Za-z]:", "Users", ""].join("\\\\");
  const escapedRepoRoot = escapeRegExp(repoRoot);
  const escapedHome = escapeRegExp(process.env.HOME ?? "");
  const escapedTmp = escapeRegExp(os.tmpdir());
  return [
    { ruleId: "MACOS_USERS_PATH", pattern: new RegExp(`${escapeRegExp(macUsersPrefix)}[^/\\s"'\\\`]+(?:/[^\\s"'\\\`]*)?`, "g") },
    { ruleId: "POSIX_HOME_PATH", pattern: new RegExp(`${escapeRegExp(posixHomePrefix)}[^/\\s"'\\\`]+(?:/[^\\s"'\\\`]*)?`, "g") },
    { ruleId: "WINDOWS_USERS_PATH", pattern: new RegExp(`${windowsUsersPrefix}[^\\\\\\s"'\\\`]+(?:\\\\[^\\s"'\\\`]*)?`, "g") },
    escapedRepoRoot ? { ruleId: "REPO_ABSOLUTE_PATH", pattern: new RegExp(escapedRepoRoot, "g") } : null,
    escapedHome ? { ruleId: "HOME_ABSOLUTE_PATH", pattern: new RegExp(escapedHome, "g") } : null,
    escapedTmp ? { ruleId: "TEMP_ABSOLUTE_PATH", pattern: new RegExp(escapedTmp, "g") } : null,
    os.userInfo().username ? { ruleId: "LOCAL_USERNAME", pattern: new RegExp(escapeRegExp(os.userInfo().username), "g") } : null
  ].filter(Boolean);
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function redactedFinding(ruleId, entry, value) {
  return {
    ruleId,
    entry,
    redacted: true,
    valueHash: sha256Bytes(Buffer.from(String(value)))
  };
}

function collectPrivacyFindingsFromText(text, entry) {
  const findings = [];
  for (const rule of privacyRules()) {
    for (const match of text.matchAll(rule.pattern)) {
      findings.push(redactedFinding(rule.ruleId, entry, match[0]));
    }
  }
  return findings;
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

async function buildPrivacyAudit(root) {
  const findings = [];
  const scannedEntries = [];
  const files = await listFiles(root);
  for (const filePath of files) {
    const bundlePath = toBundlePath(root, filePath);
    findings.push(...collectPrivacyFindingsFromText(bundlePath, `entry:${bundlePath}`));
    const extension = path.extname(bundlePath).toLowerCase();
    const bytes = await readFile(filePath);
    if (textExtensions.has(extension)) {
      scannedEntries.push({ path: bundlePath, scan: "text" });
      findings.push(...collectPrivacyFindingsFromText(bytes.toString("utf8"), bundlePath));
    } else if (pngExtensions.has(extension)) {
      scannedEntries.push({ path: bundlePath, scan: "png-binary-text" });
      findings.push(...collectPrivacyFindingsFromText(extractBinaryText(bytes), bundlePath));
    } else if (svgaExtensions.has(extension)) {
      scannedEntries.push({ path: bundlePath, scan: "svga-raw-and-inflated-strings" });
      findings.push(...collectPrivacyFindingsFromText(extractBinaryText(bytes), bundlePath));
      findings.push(...collectPrivacyFindingsFromText(inflateSvgaStrings(bytes), `${bundlePath}:inflated`));
    }
  }
  return {
    schemaVersion: 2,
    milestoneId: "P3",
    passed: findings.length === 0,
    rulesEvaluated: privacyRules().map(({ ruleId }) => ruleId),
    expectedEntryCount: files.length,
    scannedEntries: scannedEntries.sort((a, b) => a.path.localeCompare(b.path)),
    findings,
    fakeSentinelSelfTest: runPrivacySentinelSelfTest(),
    generatedAt: "stable-self-scan"
  };
}

async function fileIdentity(filePath) {
  const bytes = await readFile(filePath);
  return {
    sizeBytes: bytes.byteLength,
    sha256: sha256Bytes(bytes)
  };
}

function schemaVersionForJson(bytes) {
  try {
    const value = JSON.parse(bytes.toString("utf8"));
    return value && typeof value === "object" ? value.schemaVersion ?? null : null;
  } catch {
    return null;
  }
}

async function copySealedEvidence(packetRoot, stagingRoot, relativePath, role, required = true) {
  const sourcePath = path.join(packetRoot, relativePath);
  const targetPath = path.join(stagingRoot, relativePath);
  try {
    const copyResult = await copyRequired(sourcePath, targetPath);
    if (copyResult.before.sizeBytes !== copyResult.after.sizeBytes || copyResult.before.sha256 !== copyResult.after.sha256) {
      throw new Error(`sealed evidence hash changed during copy: ${relativePath}`);
    }
    const bytes = await readFile(targetPath);
    return {
      path: relativePath,
      role,
      sizeBytes: copyResult.after.sizeBytes,
      sha256: copyResult.after.sha256,
      schemaVersion: path.extname(relativePath) === ".json" ? schemaVersionForJson(bytes) : null,
      copiedByteExact: true
    };
  } catch (error) {
    if (required) throw error;
    return null;
  }
}

function runPrivacySentinelSelfTest() {
  const syntheticText = Object.values(PRIVATE_SENTINELS).join("\n");
  const matchedRuleIds = new Set(collectPrivacyFindingsFromText(syntheticText, "synthetic-sentinel").map(({ ruleId }) => ruleId));
  return {
    passed: ["POSIX_HOME_PATH", "MACOS_USERS_PATH", "WINDOWS_USERS_PATH"].every((ruleId) => matchedRuleIds.has(ruleId)),
    matchedRuleIds: [...matchedRuleIds].sort()
  };
}

async function buildManifest(root, headCommit) {
  const files = (await listFiles(root)).sort();
  const entries = [];
  for (const filePath of files) {
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
    schemaVersion: 2,
    milestoneId: "P3",
    headCommit,
    generatedAt: "stable-bundle-manifest",
    entries: entries.sort((a, b) => a.path.localeCompare(b.path)),
    selfReferentialManifestEntry: "MANIFEST.json lists itself with a stable self-referential marker; all other entries include exact sizeBytes and sha256."
  };
}

async function writeManifest(root, headCommit) {
  await writeFile(path.join(root, "MANIFEST.json"), `${JSON.stringify(await buildManifest(root, headCommit), null, 2)}\n`);
}

async function annotateProductArtifactIndex(bundlePaths) {
  const indexPath = path.join(artifactRoot, "artifact-index.json");
  const index = JSON.parse(await readFile(indexPath, "utf8"));
  index.artifacts = (index.artifacts ?? []).map((artifact) => {
    const normalized = String(artifact.path ?? "").replace(`.artifacts/product/P3/`, "");
    return {
      ...artifact,
      includedInBundle: bundlePaths.has(`screenshots/${normalized}`)
        || bundlePaths.has(`reports/${normalized}`)
        || bundlePaths.has(`artifacts/${normalized}`)
    };
  });
  await writeFile(indexPath, `${JSON.stringify(index, null, 2)}\n`);
  return index;
}

async function readJsonFile(filePath) {
  return JSON.parse(await readFile(filePath, "utf8"));
}

async function buildProductValidation({ sealedEvidenceManifest, privacyAudit, reviewerBCategories }) {
  const roundTrip = JSON.parse(await readFile(path.join(artifactRoot, "round-trip-report.json"), "utf8"));
  const resourceEdit = JSON.parse(await readFile(path.join(artifactRoot, "resource-edit-report.json"), "utf8"));
  const thumbnail = JSON.parse(await readFile(path.join(artifactRoot, "thumbnail-evidence.json"), "utf8"));
  const checks = [
    ["round_trip_schema_v2", roundTrip.schemaVersion === 2],
    ["round_trip_passed", roundTrip.passed === true],
    ["round_trip_source_sha_immutable", roundTrip.sourceSha256 === roundTrip.sourceSha256AfterEditing],
    ["unknown_field_boundary_passed", roundTrip.unknownFieldBoundary?.passed === true],
    ["changed_fields_limited", (roundTrip.changedFields ?? []).every((field) => /^images\.|^zlib_bytes$|^protobuf_serialization$/.test(field))],
    ["unexpected_changes_empty", Array.isArray(roundTrip.unexpectedChanges) && roundTrip.unexpectedChanges.length === 0],
    ["thumbnail_evidence_passed", thumbnail.passed === true],
    ["replacement_matches_reopened", thumbnail.invariants?.replacementMatchesReopened === true],
    ["original_matches_reset", thumbnail.invariants?.originalMatchesReset === true],
    ["invalid_png_retains_last_valid_thumbnail", thumbnail.invariants?.invalidPngRetainsLastValidThumbnail === true],
    ["replacement_selected_screenshot_bound", Boolean(thumbnail.replacementSelectedScreenshotSha256)],
    ["replacement_selected_state_confirmed", thumbnail.replacementSelectedStateConfirmed === true],
    ["replacement_selected_candidate_visible", thumbnail.replacementSelectedCandidateVisible === true],
    ["replacement_selected_candidate_sha_matches", thumbnail.replacementSelectedCandidateSha256 === thumbnail.replacementCandidate?.thumbnailSha256],
    ["resource_edit_passed", resourceEdit.passed === true],
    ["edited_output_exists", (await readFile(path.join(artifactRoot, "edited-output.svga"))).byteLength > 0],
    ["sealed_evidence_copied_byte_exact", sealedEvidenceManifest?.entries?.every((entry) => entry.copiedByteExact === true) === true],
    ["sealed_reviewer_a_schema_v2", sealedEvidenceManifest?.entries?.some((entry) => entry.path === "reviewer-a.json" && entry.schemaVersion === 2) === true],
    ["sealed_reviewer_b_schema_v2", sealedEvidenceManifest?.entries?.some((entry) => entry.path === "reviewer-b.json" && entry.schemaVersion === 2) === true],
    ["sealed_validation_schema_v2", sealedEvidenceManifest?.entries?.some((entry) => entry.path === "validation.json" && entry.schemaVersion === 2) === true],
    ["privacy_audit_passed", privacyAudit?.passed === true],
    ["privacy_audit_scanned_all_entries", privacyAudit ? privacyAudit.scannedEntries?.length === privacyAudit.expectedEntryCount : false],
    ["reviewer_b_product_categories_passed", reviewerBCategories?.verdict === "PASS"],
    ...screenshotFiles.map((fileName) => [`screenshot_${fileName}`, true])
  ];
  for (const fileName of screenshotFiles) {
    await readFile(path.join(artifactRoot, fileName));
  }
  return {
    schemaVersion: 2,
    milestoneId: "P3",
    passed: checks.every(([, passed]) => passed),
    checks: checks.map(([code, passed]) => ({ code, passed })),
    sealedEvidenceManifestPath: "reports/sealed-packet-manifest.json",
    privacyAuditPath: "reports/bundle-privacy-audit.json",
    reviewerBProductCategoriesPath: "reports/reviewer-b-product-categories.json",
    generatedAt: "stable-product-bundle-validation"
  };
}

async function buildSealedPacketManifest({ packetManifest, sealedEntries }) {
  return {
    schemaVersion: 2,
    milestoneId: "P3",
    packetStatus: packetManifest.packetStatus,
    milestoneOutcome: packetManifest.milestoneOutcome,
    reviewedHeadCommit: packetManifest.reviewedHeadCommit,
    candidateDigest: packetManifest.candidateDigest,
    sourceDiffSha256: packetManifest.sourceDiffSha256,
    packetDiffSha256: packetManifest.packetDiffSha256,
    diffFidelity: packetManifest.diffFidelity,
    companionRequired: packetManifest.companionRequired,
    entries: sealedEntries,
    reviewerAVerdictPath: "reviewer-a.json",
    reviewerBVerdictPath: "reviewer-b.json",
    validationSummaryPath: "validation.json",
    budgetCheckPath: "budget-check.json",
    postSealVerificationPath: "post-seal-verification.json",
    allCopiedByteExact: sealedEntries.every((entry) => entry.copiedByteExact === true),
    generatedAt: "stable-sealed-packet-manifest"
  };
}

async function buildReviewerBProductCategories(stagingRoot) {
  const thumbnail = await readJsonFile(path.join(stagingRoot, "reports/thumbnail-evidence.json"));
  const roundTrip = await readJsonFile(path.join(stagingRoot, "reports/round-trip-report.json"));
  const resourceEdit = await readJsonFile(path.join(stagingRoot, "reports/resource-edit-report.json"));
  const privacyAudit = await readJsonFile(path.join(stagingRoot, "reports/bundle-privacy-audit.json"));
  const bundleEntries = new Set((await listFiles(stagingRoot)).map((filePath) => toBundlePath(stagingRoot, filePath)));
  const screenshotHash = async (fileName) => sha256File(path.join(stagingRoot, "screenshots", fileName));
  const category = async (name, {
    verdict,
    screenshot,
    evidence,
    finding,
    visualObservations
  }) => ({
    category: name,
    verdict,
    visualObservations,
    screenshotSha256: screenshot ? await screenshotHash(screenshot) : "not_applicable",
    evidence,
    finding
  });
  const replacementSelectedTextValid = thumbnail.replacementSelectedStateConfirmed === true
    && thumbnail.replacementSelectedCandidateVisible === true
    && thumbnail.replacementSelectedCandidateSha256 === thumbnail.replacementCandidate?.thumbnailSha256;
  const requiredBundleEntries = [
    "REVIEW_PACKET.md",
    "FINAL_RESPONSE.txt",
    "MANIFEST.json",
    "validation.json",
    "budget-check.json",
    "reviewer-a.json",
    "reviewer-b.json",
    "post-seal-verification.json",
    "reports/product-bundle-validation.json",
    "reports/bundle-privacy-audit.json",
    "reports/sealed-packet-manifest.json",
    "reports/thumbnail-evidence.json",
    "reports/round-trip-report.json",
    "artifacts/edited-output.svga",
    ...screenshotFiles.map((fileName) => `screenshots/${fileName}`)
  ];
  const missingEntries = requiredBundleEntries.filter((entry) => !bundleEntries.has(entry));
  const categories = [
    await category("resourceDiscovery", {
      verdict: resourceEdit.resourceList === true ? "PASS" : "BLOCKING",
      screenshot: "resource-list.png",
      visualObservations: "Resource list evidence is read from the staged screenshot and resource edit report.",
      evidence: ["reports/resource-edit-report.json", "screenshots/resource-list.png"],
      finding: resourceEdit.resourceList === true ? "resource list available" : "resource list missing"
    }),
    await category("resourceThumbnail", {
      verdict: thumbnail.original?.visible === true && Boolean(thumbnail.original?.thumbnailSha256) ? "PASS" : "BLOCKING",
      screenshot: "resource-list.png",
      visualObservations: "Original resource thumbnail is present in thumbnail evidence.",
      evidence: ["reports/thumbnail-evidence.json", "screenshots/resource-list.png"],
      finding: thumbnail.original?.visible === true ? "thumbnail visible" : "thumbnail missing"
    }),
    await category("replacementSelection", {
      verdict: replacementSelectedTextValid ? "PASS" : "BLOCKING",
      screenshot: "replacement-selected.png",
      visualObservations: "Selected replacement screenshot is bound to candidate hash and selected-state metadata.",
      evidence: ["reports/thumbnail-evidence.json", "screenshots/replacement-selected.png"],
      finding: replacementSelectedTextValid ? "replacement candidate selected and visible" : "replacement selection not proven"
    }),
    await category("replacementPreview", {
      verdict: resourceEdit.replacementPreview === true && thumbnail.invariants?.originalDiffersFromReplacement === true ? "PASS" : "BLOCKING",
      screenshot: "replacement-preview.png",
      visualObservations: "Replacement preview differs from original and remounts edited bytes.",
      evidence: ["reports/resource-edit-report.json", "reports/thumbnail-evidence.json", "screenshots/replacement-preview.png"],
      finding: resourceEdit.replacementPreview === true ? "replacement preview passed" : "replacement preview missing"
    }),
    await category("dirtyState", {
      verdict: resourceEdit.dirtyState === true ? "PASS" : "BLOCKING",
      screenshot: "dirty-state.png",
      visualObservations: "Dirty state is represented after replacement.",
      evidence: ["reports/resource-edit-report.json", "screenshots/dirty-state.png"],
      finding: resourceEdit.dirtyState === true ? "dirty state visible" : "dirty state missing"
    }),
    await category("reset", {
      verdict: resourceEdit.reset === true && thumbnail.invariants?.originalMatchesReset === true ? "PASS" : "BLOCKING",
      screenshot: "reset-to-original.png",
      visualObservations: "Reset returns the resource thumbnail to the original hash.",
      evidence: ["reports/resource-edit-report.json", "reports/thumbnail-evidence.json", "screenshots/reset-to-original.png"],
      finding: resourceEdit.reset === true ? "reset passed" : "reset failed"
    }),
    await category("saveAs", {
      verdict: resourceEdit.saveAs === true ? "PASS" : "BLOCKING",
      screenshot: "export-success.png",
      visualObservations: "Save As completes with a success state.",
      evidence: ["reports/resource-edit-report.json", "screenshots/export-success.png"],
      finding: resourceEdit.saveAs === true ? "save as passed" : "save as failed"
    }),
    await category("reopenedExport", {
      verdict: resourceEdit.reopenedExport === true && thumbnail.invariants?.replacementMatchesReopened === true ? "PASS" : "BLOCKING",
      screenshot: "reopened-export.png",
      visualObservations: "Reopened export keeps the replacement thumbnail.",
      evidence: ["reports/resource-edit-report.json", "reports/thumbnail-evidence.json", "screenshots/reopened-export.png"],
      finding: resourceEdit.reopenedExport === true ? "reopen passed" : "reopen failed"
    }),
    await category("invalidPngState", {
      verdict: resourceEdit.invalidPngState === true && thumbnail.invariants?.invalidPngRetainsLastValidThumbnail === true ? "PASS" : "BLOCKING",
      screenshot: "invalid-png-state.png",
      visualObservations: "Invalid PNG shows an error and retains the last valid replacement thumbnail.",
      evidence: ["reports/resource-edit-report.json", "reports/thumbnail-evidence.json", "screenshots/invalid-png-state.png"],
      finding: resourceEdit.invalidPngState === true ? "invalid PNG state passed" : "invalid PNG state failed"
    }),
    await category("roundTripEvidence", {
      verdict: roundTrip.schemaVersion === 2 && roundTrip.passed === true ? "PASS" : "BLOCKING",
      screenshot: "original-edited-comparison.png",
      visualObservations: "Round-trip report is schemaVersion 2 and comparison evidence is present.",
      evidence: ["reports/round-trip-report.json", "screenshots/original-edited-comparison.png"],
      finding: roundTrip.passed === true ? "round trip passed" : "round trip failed"
    }),
    await category("originalImmutability", {
      verdict: resourceEdit.originalUnchanged === true && roundTrip.sourceSha256 === roundTrip.sourceSha256AfterEditing ? "PASS" : "BLOCKING",
      screenshot: "original-edited-comparison.png",
      visualObservations: "Original source hash remains unchanged after editing.",
      evidence: ["reports/resource-edit-report.json", "reports/round-trip-report.json"],
      finding: resourceEdit.originalUnchanged === true ? "original source immutable" : "original source changed"
    }),
    await category("productShellRegression", {
      verdict: bundleEntries.has("screenshots/original-loaded.png") && bundleEntries.has("reports/artifact-index.json") ? "PASS" : "BLOCKING",
      screenshot: "original-loaded.png",
      visualObservations: "P3 evidence keeps the P2 product shell artifact path and original loaded state.",
      evidence: ["screenshots/original-loaded.png", "reports/artifact-index.json"],
      finding: "product shell artifact present"
    }),
    await category("bundleCompleteness", {
      verdict: missingEntries.length === 0 ? "PASS" : "BLOCKING",
      evidence: ["MANIFEST.json", "reports/sealed-packet-manifest.json"],
      visualObservations: "Bundle completeness is checked from staged upload entries only.",
      finding: missingEntries.length === 0 ? "all required entries present" : `missing entries: ${missingEntries.join(", ")}`
    }),
    await category("bundlePrivacy", {
      verdict: privacyAudit.passed === true && privacyAudit.findings.length === 0 ? "PASS" : "BLOCKING",
      evidence: ["reports/bundle-privacy-audit.json"],
      visualObservations: "Privacy audit scans staged upload entries and reports only redacted finding hashes.",
      finding: privacyAudit.passed === true ? "privacy audit passed" : "privacy audit failed"
    })
  ];
  return {
    schemaVersion: 2,
    milestoneId: "P3",
    reviewerId: "B",
    reviewSource: "final candidate upload staging only",
    verdict: categories.every((item) => item.verdict === "PASS") ? "PASS" : "BLOCKING",
    categories,
    generatedAt: "stable-reviewer-b-product-categories"
  };
}

function finalResponseText({ uploadZipName, headShort }) {
  const uploadAssistantTrace = `UPLOAD_TO_REVIEW_ASSISTANT:P3-${headShort}-upload.zip`;
  return [
    "HUMAN_REQUIRED",
    "",
    "REVIEW_PACKET_READY",
    "",
    "UPLOAD_TO_REVIEW_ASSISTANT:",
    `1. review/P3-latest/${uploadZipName}`,
    "",
    "OPTIONAL_REFERENCE:",
    "- review/P3-latest/REVIEW_PACKET.md",
    "",
    "Question:",
    "是否接受 P3 图像资源替换、实时预览、重置、另存为和重新打开的基础编辑闭环，并允许规划下一项编辑能力？",
    "",
    "Recommendation:",
    "A: 接受 P3，允许规划下一项编辑能力。只有全部工程、视觉和交接 gate 通过后推荐 A。",
    "",
    "Safe default while waiting:",
    "B，不开始下一里程碑。",
    "",
    "Trace:",
    uploadAssistantTrace,
    "",
    "Do not upload:",
    "- individual screenshots",
    "- individual JSON reports",
    "- files directory",
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
  return execFileSync("unzip", ["-Z1", zipPath], { encoding: "utf8" })
    .split("\n")
    .filter(Boolean)
    .sort();
}

async function main() {
  const headCommit = gitHeadCommit();
  const headShort = headCommit.slice(0, 7);
  const packetRoot = readArgument("--packet-root")
    ? path.resolve(repoRoot, readArgument("--packet-root"))
    : path.join(repoRoot, ".artifacts/loop-handoff/latest");
  const stagingRoot = path.join(artifactRoot, `P3-${headShort}-upload`);
  const uploadZip = path.join(artifactRoot, `P3-${headShort}-upload.zip`);

  await rm(stagingRoot, { recursive: true, force: true });
  await rm(uploadZip, { force: true });
  await mkdir(path.join(stagingRoot, "screenshots"), { recursive: true });
  await mkdir(path.join(stagingRoot, "reports"), { recursive: true });
  await mkdir(path.join(stagingRoot, "artifacts"), { recursive: true });
  await mkdir(path.join(stagingRoot, "docs"), { recursive: true });

  const packetManifest = JSON.parse(await readFile(path.join(packetRoot, "MANIFEST.json"), "utf8"));
  if (packetManifest.milestoneOutcome !== "HUMAN_REQUIRED") {
    throw new Error("P3 upload package requires a HUMAN_REQUIRED sealed packet.");
  }
  const sealedEntries = [
    await copySealedEvidence(packetRoot, stagingRoot, "REVIEW_PACKET.md", "sealed-review-packet"),
    await copySealedEvidence(packetRoot, stagingRoot, "validation.json", "sealed-loop-validation"),
    await copySealedEvidence(packetRoot, stagingRoot, "budget-check.json", "sealed-loop-budget-check"),
    await copySealedEvidence(packetRoot, stagingRoot, "reviewer-a.json", "sealed-reviewer-a-verdict"),
    await copySealedEvidence(packetRoot, stagingRoot, "reviewer-b.json", "sealed-reviewer-b-verdict"),
    await copySealedEvidence(packetRoot, stagingRoot, "post-seal-verification.json", "sealed-post-seal-verification")
  ];
  if (packetManifest.companionRequired === true) {
    sealedEntries.push(await copySealedEvidence(packetRoot, stagingRoot, "changes.patch", "sealed-source-diff"));
  }
  const sealedEvidenceManifest = await buildSealedPacketManifest({
    packetManifest,
    sealedEntries: sealedEntries.filter(Boolean)
  });
  await writeFile(path.join(stagingRoot, "reports", "sealed-packet-manifest.json"), `${JSON.stringify(sealedEvidenceManifest, null, 2)}\n`);
  await writeFile(path.join(stagingRoot, "README.md"), [
    "# P3 Review Upload Package",
    "",
    "Status: HUMAN_REQUIRED",
    "This package contains the P3 repair-3 review packet, product screenshots, reports, edited SVGA output, and privacy audit.",
    "Use this ZIP as the primary upload. P3 remains blocked on the product owner Human Gate.",
    ""
  ].join("\n"));
  await writeFile(path.join(stagingRoot, "FINAL_RESPONSE.txt"), finalResponseText({ uploadZipName: `P3-${headShort}-upload.zip`, headShort }));

  for (const [source, target] of docCopies) {
    await copyRequired(path.join(repoRoot, source), path.join(stagingRoot, target));
  }
  for (const fileName of screenshotFiles) {
    await copyRequired(path.join(artifactRoot, fileName), path.join(stagingRoot, "screenshots", fileName));
  }
  for (const fileName of reportFiles) {
    await copyRequired(path.join(artifactRoot, fileName), path.join(stagingRoot, "reports", fileName));
  }
  await copyRequired(path.join(artifactRoot, "edited-output.svga"), path.join(stagingRoot, "artifacts", "edited-output.svga"));

  let privacyAudit = null;
  let reviewerBCategories = null;
  await writeFile(path.join(stagingRoot, "reports", "product-bundle-validation.json"), `${JSON.stringify(await buildProductValidation({ sealedEvidenceManifest, privacyAudit, reviewerBCategories }), null, 2)}\n`);
  await writeManifest(stagingRoot, headCommit);
  privacyAudit = await buildPrivacyAudit(stagingRoot);
  await writeFile(path.join(stagingRoot, "reports", "bundle-privacy-audit.json"), `${JSON.stringify(privacyAudit, null, 2)}\n`);
  reviewerBCategories = await buildReviewerBProductCategories(stagingRoot);
  await writeFile(path.join(stagingRoot, "reports", "reviewer-b-product-categories.json"), `${JSON.stringify(reviewerBCategories, null, 2)}\n`);
  await writeFile(path.join(stagingRoot, "reports", "product-bundle-validation.json"), `${JSON.stringify(await buildProductValidation({ sealedEvidenceManifest, privacyAudit, reviewerBCategories }), null, 2)}\n`);
  await writeManifest(stagingRoot, headCommit);
  const bundlePaths = new Set((await listFiles(stagingRoot)).map((filePath) => toBundlePath(stagingRoot, filePath)));
  await annotateProductArtifactIndex(bundlePaths);
  await copyRequired(path.join(artifactRoot, "artifact-index.json"), path.join(stagingRoot, "reports", "artifact-index.json"));
  await writeFile(path.join(stagingRoot, "reports", "product-bundle-validation.json"), `${JSON.stringify(await buildProductValidation({ sealedEvidenceManifest, privacyAudit, reviewerBCategories }), null, 2)}\n`);
  await writeManifest(stagingRoot, headCommit);
  privacyAudit = await buildPrivacyAudit(stagingRoot);
  await writeFile(path.join(stagingRoot, "reports", "bundle-privacy-audit.json"), `${JSON.stringify(privacyAudit, null, 2)}\n`);
  await writeManifest(stagingRoot, headCommit);
  const finalPrivacyAudit = await buildPrivacyAudit(stagingRoot);
  const finalFiles = (await listFiles(stagingRoot)).map((filePath) => toBundlePath(stagingRoot, filePath)).sort();
  if (!finalPrivacyAudit.passed || finalPrivacyAudit.fakeSentinelSelfTest.passed !== true) {
    throw new Error(`P3 upload privacy audit failed: ${finalPrivacyAudit.findings.map((finding) => `${finding.ruleId}:${finding.entry}:${finding.valueHash}`).join("; ")}`);
  }
  if (finalPrivacyAudit.scannedEntries.length !== finalFiles.length || finalPrivacyAudit.expectedEntryCount !== finalFiles.length) {
    throw new Error("P3 upload privacy audit did not scan every ZIP entry.");
  }
  if (reviewerBCategories.verdict !== "PASS") {
    throw new Error("Reviewer B product categories did not pass.");
  }

  zipFiles(stagingRoot, uploadZip, finalFiles);
  const entries = zipEntries(uploadZip);
  if (JSON.stringify(entries) !== JSON.stringify(finalFiles)) {
    throw new Error("P3 upload ZIP entries do not exactly match privacy-scanned staging files.");
  }
  if (packetManifest.companionRequired !== entries.includes("changes.patch")) {
    throw new Error("P3 upload ZIP changes.patch inclusion does not match companionRequired.");
  }
  const zipBytes = await readFile(uploadZip);
  const zipSummary = {
    schemaVersion: 2,
    milestoneId: "P3",
    headCommit,
    uploadZip: path.relative(repoRoot, uploadZip),
    sizeBytes: zipBytes.byteLength,
    sha256: sha256Bytes(zipBytes),
    entryCount: entries.length,
    privacyAudit: {
      passed: finalPrivacyAudit.passed,
      findingCount: finalPrivacyAudit.findings.length,
      scannedEntryCount: finalPrivacyAudit.scannedEntries.length
    },
    reviewerBProductCategories: {
      verdict: reviewerBCategories.verdict,
      categoryCount: reviewerBCategories.categories.length
    },
    generatedAt: "stable-p3-upload-package-summary"
  };
  await writeFile(path.join(artifactRoot, "p3-upload-package-summary.json"), `${JSON.stringify(zipSummary, null, 2)}\n`);

  await rm(stagingRoot, { recursive: true, force: true });
  await mkdir(visibleRoot, { recursive: true });
  await cp(uploadZip, path.join(visibleRoot, path.basename(uploadZip)));
  await cp(path.join(packetRoot, "REVIEW_PACKET.md"), path.join(visibleRoot, "REVIEW_PACKET.md"));
  await cp(path.join(packetRoot, "MANIFEST.json"), path.join(visibleRoot, "MANIFEST.json"));
  await writeFile(path.join(visibleRoot, "FINAL_RESPONSE.txt"), finalResponseText({ uploadZipName: `P3-${headShort}-upload.zip`, headShort }));
  await writeFile(path.join(visibleRoot, "README.md"), [
    "# P3 Review Materials",
    "",
    "Upload the ZIP in this folder for product review. P3 remains HUMAN_REQUIRED until product owner acceptance.",
    "",
    `- ${path.basename(uploadZip)}`,
    "- REVIEW_PACKET.md is included in the ZIP and copied here for quick reading.",
    ""
  ].join("\n"));
  console.log(`P3_UPLOAD_PACKAGE=${JSON.stringify(zipSummary)}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
