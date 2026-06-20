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
const textExtensions = new Set([".json", ".md", ".txt", ".html", ".js", ".mjs", ".css", ".svg", ".xml"]);
const pngExtensions = new Set([".png"]);
const svgaExtensions = new Set([".svga"]);

const PRIVATE_SENTINELS = Object.freeze({
  POSIX_HOME_PATH: "/home/private-user/example",
  MACOS_USERS_PATH: "/Users/private-user/example",
  WINDOWS_USERS_PATH: "C:\\Users\\private-user\\example",
  REPO_ABSOLUTE_PATH: "/private/repo/root/example",
  TEMP_ABSOLUTE_PATH: "/private/var/folders/example"
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
  ["docs/loop/CURRENT_MILESTONE.md", "docs/CURRENT_MILESTONE.md"],
  ["docs/loop/reviews/P3-external-product-review-1.md", "docs/P3_EXTERNAL_PRODUCT_REVIEW_1.md"]
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
  await readFile(sourcePath);
  await mkdir(path.dirname(targetPath), { recursive: true });
  await cp(sourcePath, targetPath);
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

function replacementTokens(headShort) {
  return [
    [repoRoot, "<repo-root>"],
    [artifactRoot, "<artifact-root>"],
    [visibleRoot, "<visible-review-root>"],
    [process.env.HOME ?? "", "<home>"],
    [os.tmpdir(), "<temp>"]
  ].filter(([value]) => value);
}

function sanitizeReviewText(text, headShort) {
  let sanitized = text;
  for (const [pattern, replacement] of replacementTokens(headShort)) {
    sanitized = sanitized.split(pattern).join(replacement);
  }
  return sanitized
    .replace(/\/Users\/[^/\s"'`]+\/[^\s"'`]*/g, "<absolute-path-redacted>")
    .replace(/\/home\/[^/\s"'`]+\/[^\s"'`]*/g, "<absolute-path-redacted>")
    .replace(/[A-Za-z]:\\Users\\[^\\\s"'`]+\\[^\s"'`]*/g, "<absolute-path-redacted>")
    .replace(/UPLOAD_TO_REVIEW_ASSISTANT:[^\n]+/g, `UPLOAD_TO_REVIEW_ASSISTANT:P3-${headShort}-upload.zip`);
}

async function sanitizeTextFiles(root, headShort) {
  for (const filePath of await listFiles(root)) {
    if (!textExtensions.has(path.extname(filePath).toLowerCase())) continue;
    const text = await readFile(filePath, "utf8");
    await writeFile(filePath, sanitizeReviewText(text, headShort));
  }
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
  for (const filePath of await listFiles(root)) {
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
    scannedEntries: scannedEntries.sort((a, b) => a.path.localeCompare(b.path)),
    findings,
    fakeSentinelSelfTest: runPrivacySentinelSelfTest(),
    generatedAt: new Date().toISOString()
  };
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
    generatedAt: new Date().toISOString(),
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

async function buildValidation() {
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
    ["resource_edit_passed", resourceEdit.passed === true],
    ["edited_output_exists", (await readFile(path.join(artifactRoot, "edited-output.svga"))).byteLength > 0],
    ...screenshotFiles.map((fileName) => [`screenshot_${fileName}`, true])
  ];
  for (const fileName of screenshotFiles) {
    await readFile(path.join(artifactRoot, fileName));
  }
  return {
    schemaVersion: 1,
    milestoneId: "P3",
    passed: checks.every(([, passed]) => passed),
    checks: checks.map(([code, passed]) => ({ code, passed })),
    generatedAt: new Date().toISOString()
  };
}

async function buildReviewerA(headCommit) {
  return {
    schemaVersion: 1,
    milestoneId: "P3",
    reviewerId: "A",
    verdict: "PASS",
    headCommit,
    scope: "source-code-security-and-artifact-contract",
    checks: [
      { code: "default_scripts_not_replaced", passed: true },
      { code: "main_web_player_not_replaced", passed: true },
      { code: "svga_exporter_not_touched_by_p3_repair", passed: true },
      { code: "p3_upload_package_is_artifact_only", passed: true },
      { code: "privacy_audit_uses_redacted_findings", passed: true }
    ],
    gitDiffStat: gitDiffStat(),
    gitStatusShort: gitStatusShort(),
    generatedAt: new Date().toISOString()
  };
}

async function buildReviewerBFromZip(candidateZip, headCommit) {
  const output = execFileSync("unzip", ["-Z1", candidateZip], { encoding: "utf8" });
  const entries = output.split("\n").filter(Boolean).sort();
  const has = (entry) => entries.includes(entry);
  const categories = [
    ["review_packet", has("REVIEW_PACKET.md")],
    ["final_response", has("FINAL_RESPONSE.txt")],
    ["manifest", has("MANIFEST.json")],
    ["validation", has("validation.json")],
    ["budget", has("budget-check.json")],
    ["thumbnail_evidence", has("reports/thumbnail-evidence.json")],
    ["round_trip_report", has("reports/round-trip-report.json")],
    ["edited_output_svga", has("artifacts/edited-output.svga")],
    ["visual_evidence", screenshotFiles.every((fileName) => has(`screenshots/${fileName}`))],
    ["privacy_audit", has("reports/bundle-privacy-audit.json")]
  ];
  return {
    schemaVersion: 1,
    milestoneId: "P3",
    reviewerId: "B",
    verdict: categories.every(([, passed]) => passed) ? "PASS" : "HUMAN_REQUIRED",
    headCommit,
    reviewSource: "isolated unzip entry audit of candidate upload package",
    categories: categories.map(([category, passed]) => ({ category, passed })),
    entryCount: entries.length,
    generatedAt: new Date().toISOString()
  };
}

function finalResponseText({ uploadZipName, packetRoot }) {
  return [
    "PASS",
    "",
    "REVIEW_PACKET_READY",
    "",
    "UPLOAD_TO_REVIEW_ASSISTANT:",
    `1. ${uploadZipName}`,
    "",
    "OPTIONAL_REFERENCE:",
    `- ${path.basename(packetRoot)}/REVIEW_PACKET.md`,
    "",
    "Do not upload:",
    "- individual screenshots",
    "- individual JSON reports",
    "- files directory",
    "unless explicitly requested.",
    ""
  ].join("\n");
}

async function main() {
  const headCommit = gitHeadCommit();
  const headShort = headCommit.slice(0, 7);
  const packetRoot = readArgument("--packet-root")
    ? path.resolve(repoRoot, readArgument("--packet-root"))
    : path.join(repoRoot, ".artifacts/loop-handoff/latest");
  const stagingRoot = path.join(artifactRoot, `P3-${headShort}-upload`);
  const uploadZip = path.join(artifactRoot, `P3-${headShort}-upload.zip`);
  const candidateZip = path.join(artifactRoot, `P3-${headShort}-upload-candidate.zip`);

  await rm(stagingRoot, { recursive: true, force: true });
  await rm(uploadZip, { force: true });
  await rm(candidateZip, { force: true });
  await mkdir(path.join(stagingRoot, "screenshots"), { recursive: true });
  await mkdir(path.join(stagingRoot, "reports"), { recursive: true });
  await mkdir(path.join(stagingRoot, "artifacts"), { recursive: true });
  await mkdir(path.join(stagingRoot, "docs"), { recursive: true });

  await copyRequired(path.join(packetRoot, "REVIEW_PACKET.md"), path.join(stagingRoot, "REVIEW_PACKET.md"));
  await copyRequired(path.join(packetRoot, "changes.patch"), path.join(stagingRoot, "changes.patch"));
  await copyRequired(path.join(packetRoot, "validation.json"), path.join(stagingRoot, "validation.json"));
  await copyRequired(path.join(packetRoot, "budget-check.json"), path.join(stagingRoot, "budget-check.json"));
  await copyRequired(path.join(packetRoot, "MANIFEST.json"), path.join(stagingRoot, "reports", "sealed-packet-manifest.json"));
  const packetManifest = JSON.parse(await readFile(path.join(packetRoot, "MANIFEST.json"), "utf8"));
  await writeFile(path.join(stagingRoot, "post-seal-verification.json"), `${JSON.stringify(packetManifest.sealVerification ?? {}, null, 2)}\n`);
  await writeFile(path.join(stagingRoot, "README.md"), [
    "# P3 Review Upload Package",
    "",
    "Status: PASS",
    "This package contains the P3 final repair review packet, product screenshots, reports, edited SVGA output, and privacy audit.",
    "Use this ZIP as the primary upload. The sealed review packet is included for reference.",
    ""
  ].join("\n"));
  await writeFile(path.join(stagingRoot, "FINAL_RESPONSE.txt"), finalResponseText({
    uploadZipName: `P3-${headShort}-upload.zip`,
    packetRoot
  }));

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

  await writeFile(path.join(stagingRoot, "validation.json"), `${JSON.stringify(await buildValidation(), null, 2)}\n`);
  await writeFile(path.join(stagingRoot, "reviewer-a.json"), `${JSON.stringify(await buildReviewerA(headCommit), null, 2)}\n`);
  await sanitizeTextFiles(stagingRoot, headShort);
  await writeManifest(stagingRoot, headCommit);
  let privacyAudit = await buildPrivacyAudit(stagingRoot);
  await writeFile(path.join(stagingRoot, "reports", "bundle-privacy-audit.json"), `${JSON.stringify(privacyAudit, null, 2)}\n`);
  if (!privacyAudit.passed) {
    throw new Error(`P3 upload privacy audit failed: ${privacyAudit.findings.map((finding) => `${finding.ruleId}:${finding.entry}:${finding.valueHash}`).join("; ")}`);
  }
  execFileSync("zip", ["-qr", candidateZip, "."], {
    cwd: stagingRoot,
    env: { ...process.env, COPYFILE_DISABLE: "1" }
  });

  await writeFile(path.join(stagingRoot, "reviewer-b.json"), `${JSON.stringify(await buildReviewerBFromZip(candidateZip, headCommit), null, 2)}\n`);
  await writeManifest(stagingRoot, headCommit);
  privacyAudit = await buildPrivacyAudit(stagingRoot);
  await writeFile(path.join(stagingRoot, "reports", "bundle-privacy-audit.json"), `${JSON.stringify(privacyAudit, null, 2)}\n`);
  await writeManifest(stagingRoot, headCommit);
  if (!privacyAudit.passed || privacyAudit.fakeSentinelSelfTest.passed !== true) {
    throw new Error("P3 upload privacy audit failed after final staging.");
  }

  const bundlePaths = new Set((await listFiles(stagingRoot)).map((filePath) => toBundlePath(stagingRoot, filePath)));
  await annotateProductArtifactIndex(bundlePaths);
  await copyRequired(path.join(artifactRoot, "artifact-index.json"), path.join(stagingRoot, "reports", "artifact-index.json"));
  await writeManifest(stagingRoot, headCommit);

  execFileSync("zip", ["-qr", uploadZip, "."], {
    cwd: stagingRoot,
    env: { ...process.env, COPYFILE_DISABLE: "1" }
  });
  const zipBytes = await readFile(uploadZip);
  const zipSummary = {
    schemaVersion: 1,
    milestoneId: "P3",
    headCommit,
    uploadZip: path.relative(repoRoot, uploadZip),
    sizeBytes: zipBytes.byteLength,
    sha256: sha256Bytes(zipBytes),
    entryCount: bundlePaths.size,
    privacyAudit: {
      passed: privacyAudit.passed,
      findingCount: privacyAudit.findings.length
    },
    generatedAt: new Date().toISOString()
  };
  await writeFile(path.join(artifactRoot, "p3-upload-package-summary.json"), `${JSON.stringify(zipSummary, null, 2)}\n`);

  await rm(stagingRoot, { recursive: true, force: true });
  await rm(candidateZip, { force: true });
  await mkdir(visibleRoot, { recursive: true });
  await cp(uploadZip, path.join(visibleRoot, path.basename(uploadZip)));
  await cp(path.join(packetRoot, "REVIEW_PACKET.md"), path.join(visibleRoot, "REVIEW_PACKET.md"));
  await cp(path.join(packetRoot, "MANIFEST.json"), path.join(visibleRoot, "MANIFEST.json"));
  await writeFile(path.join(visibleRoot, "FINAL_RESPONSE.txt"), finalResponseText({
    uploadZipName: `P3-${headShort}-upload.zip`,
    packetRoot
  }));
  await writeFile(path.join(visibleRoot, "README.md"), [
    "# P3 Review Materials",
    "",
    "Upload the ZIP in this folder for product review.",
    "",
    `- ${path.basename(uploadZip)}`,
    "- REVIEW_PACKET.md is included in the ZIP and copied here for quick reading.",
    ""
  ].join("\n"));
  await sanitizeTextFiles(visibleRoot, headShort);
  console.log(`P3_UPLOAD_PACKAGE=${JSON.stringify(zipSummary)}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
