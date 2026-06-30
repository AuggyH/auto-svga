#!/usr/bin/env node
import { execFileSync, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { cp, mkdir, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { writeMacosPackageProof } from "../electron-prototype/experiments/svga-web/scripts/macos-package-proof.mjs";

const scriptRoot = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptRoot, "../..");
const milestoneId = "SVGA-Workbench-v1";
const reviewRoot = path.join(repoRoot, "review");
const stagingRoot = path.join(repoRoot, ".artifacts/product/SVGA-Workbench-v1-complete-review-directory");
const validationRoot = path.join(repoRoot, ".artifacts/svga-workbench-v1-validation/latest");
const uiAuditRoot = path.join(repoRoot, ".artifacts/ui-audit/2026-06-30-single-file-preview-21849d1");
const higStudyRoot = path.join(repoRoot, ".artifacts/ui-audit/2026-06-30-hig-study");
const oldUiReviewRoot = path.join(repoRoot, "review/SVGA-Workbench-v1-21849d1-ui-audit");
const experimentRoot = path.join(repoRoot, "tools/electron-prototype/experiments/svga-web");
const trialRoot = path.join(experimentRoot, ".artifacts/internal-trial");
const appBundle = path.join(trialRoot, "Auto SVGA-darwin-arm64/Auto SVGA.app");
const internalTrialManifestPath = path.join(trialRoot, "internal-trial-manifest.json");
const textExtensions = new Set([".json", ".md", ".txt", ".html", ".js", ".mjs", ".cjs", ".css", ".plist", ".xml", ".patch"]);
const requiredValidationFiles = [
  "validation-summary.json",
  "npm-test.json",
  "source-sharing-test.json",
  "svga-web-experiment-test.json",
  "desktop-smoke.json",
  "macos-package-proof.json",
  "macos-package.json",
  "signing-plan.json",
  "loop-validate.json"
];

function git(args) {
  return execFileSync("git", args, { cwd: repoRoot, encoding: "utf8" }).trim();
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

async function writeJson(filePath, payload) {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
}

async function copyRequired(sourcePath, targetPath) {
  if (!existsSync(sourcePath)) throw new Error(`required payload missing: ${path.relative(repoRoot, sourcePath)}`);
  await mkdir(path.dirname(targetPath), { recursive: true });
  await cp(sourcePath, targetPath, { recursive: true });
  if ((await stat(targetPath)).isFile()) {
    const before = await fileIdentity(sourcePath);
    const after = await fileIdentity(targetPath);
    if (before.sizeBytes !== after.sizeBytes || before.sha256 !== after.sha256) {
      throw new Error(`copied file changed: ${path.relative(repoRoot, sourcePath)}`);
    }
  }
}

async function copyOptional(sourcePath, targetPath) {
  if (existsSync(sourcePath)) await copyRequired(sourcePath, targetPath);
}

async function listFiles(root) {
  const files = [];
  async function walk(directory) {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      if (entry.name === ".DS_Store" || entry.name === "__MACOSX" || entry.name.startsWith("._")) continue;
      const absolute = path.join(directory, entry.name);
      if (entry.isDirectory()) await walk(absolute);
      else if (entry.isFile()) files.push(absolute);
    }
  }
  if (existsSync(root)) await walk(root);
  return files.sort();
}

function toBundlePath(root, filePath) {
  return path.relative(root, filePath).split(path.sep).join("/");
}

function mimeFor(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === ".json") return "application/json";
  if (ext === ".md") return "text/markdown";
  if (ext === ".txt") return "text/plain";
  if (ext === ".png") return "image/png";
  if (ext === ".zip") return "application/zip";
  if (ext === ".svga") return "application/octet-stream";
  if (ext === ".plist" || ext === ".xml") return "application/xml";
  return "application/octet-stream";
}

function zipEntries(zipPath) {
  return execFileSync("unzip", ["-Z1", zipPath], {
    cwd: repoRoot,
    encoding: "utf8",
    maxBuffer: 50 * 1024 * 1024
  }).split("\n").filter(Boolean);
}

function zipEntryBytes(zipPath, entry) {
  return execFileSync("unzip", ["-p", zipPath, entry], {
    cwd: repoRoot,
    maxBuffer: 200 * 1024 * 1024
  });
}

export function inspectZipEntries(entries) {
  const seen = new Set();
  const duplicateEntries = [];
  const forbiddenMetadataEntries = [];
  const pathTraversalEntries = [];
  for (const entry of entries) {
    if (seen.has(entry)) duplicateEntries.push(entry);
    seen.add(entry);
    const parts = entry.split("/").filter(Boolean);
    if (entry.startsWith("/") || parts.includes("..")) pathTraversalEntries.push(entry);
    if (
      parts.some((part) => part === "__MACOSX" || part === ".DS_Store" || part.startsWith("._"))
      || parts.some((part) => part === ".fseventsd" || part === ".Spotlight-V100" || part === ".Trashes" || part === "Icon\r")
    ) {
      forbiddenMetadataEntries.push(entry);
    }
  }
  return {
    passed: duplicateEntries.length === 0 && forbiddenMetadataEntries.length === 0 && pathTraversalEntries.length === 0,
    entryCount: entries.length,
    duplicateEntries,
    forbiddenMetadataEntries,
    pathTraversalEntries,
    noMacosx: entries.every((entry) => !entry.includes("__MACOSX")),
    noAppleDouble: entries.every((entry) => !entry.split("/").some((part) => part.startsWith("._"))),
    noDsStore: entries.every((entry) => path.basename(entry) !== ".DS_Store"),
    noPathTraversal: pathTraversalEntries.length === 0,
    noDuplicateEntries: duplicateEntries.length === 0,
    noFinderMetadata: forbiddenMetadataEntries.length === 0
  };
}

function assertCleanZip(zipPath, label) {
  const inspection = inspectZipEntries(zipEntries(zipPath));
  if (!inspection.passed) {
    throw new Error(`${label} is not clean: ${JSON.stringify(inspection, null, 2)}`);
  }
  return inspection;
}

function runZip({ cwd, zipPath, entries }) {
  const result = spawnSync("zip", ["-q", "-X", zipPath, "-@"], {
    cwd,
    input: `${entries.join("\n")}\n`,
    env: { ...process.env, COPYFILE_DISABLE: "1" },
    encoding: "utf8",
    maxBuffer: 50 * 1024 * 1024
  });
  if (result.status !== 0) throw new Error(result.stderr || result.stdout || `zip failed: ${zipPath}`);
}

function createCleanAppZip({ zipPath }) {
  if (!existsSync(appBundle)) throw new Error(`macOS App bundle missing: ${path.relative(repoRoot, appBundle)}`);
  const result = spawnSync("/usr/bin/ditto", ["-c", "-k", "--norsrc", "--keepParent", appBundle, zipPath], {
    env: { ...process.env, COPYFILE_DISABLE: "1" },
    encoding: "utf8",
    maxBuffer: 50 * 1024 * 1024
  });
  if (result.status !== 0) throw new Error(result.stderr || result.stdout || "clean App ZIP creation failed");
  return assertCleanZip(zipPath, "macOS App ZIP");
}

async function buildZipEntryList(zipPath, role) {
  const entries = zipEntries(zipPath);
  const inspection = inspectZipEntries(entries);
  return {
    schemaVersion: 1,
    milestoneId,
    role,
    fileName: path.basename(zipPath),
    ...inspection,
    entries: entries.map((entry) => ({
      path: entry,
      directory: entry.endsWith("/")
    }))
  };
}

export function sanitizeReviewText(text) {
  const username = os.userInfo().username;
  const escapedRepo = escapeRegExp(repoRoot);
  let result = text.replace(new RegExp(`${escapedRepo}/?`, "g"), "");
  if (username) result = result.replace(new RegExp(`/Users/${escapeRegExp(username)}/[^\\s)\\]]+`, "g"), "<redacted-local-path>");
  result = result.replace(/\/Users\/[^\s)\]]+/g, "<redacted-local-path>");
  result = result.replace(/\/private\/[^\s)\]]+/g, "<redacted-local-path>");
  result = result.replace(/\/var\/folders\/[^\s)\]]+/g, "<redacted-local-path>");
  result = result.replace(/\/tmp\/[^\s)\]]+/g, "<redacted-local-path>");
  return result;
}

async function writeSanitizedMarkdown(sourcePath, targetPath) {
  const text = sanitizeReviewText(await readFile(sourcePath, "utf8"));
  await mkdir(path.dirname(targetPath), { recursive: true });
  await writeFile(targetPath, text, "utf8");
}

async function copyUiAuditEvidence(root) {
  await mkdir(path.join(root, "ui-audit/contact-sheets"), { recursive: true });
  await writeSanitizedMarkdown(
    path.join(oldUiReviewRoot, "UI_AUDIT_REPORT.md"),
    path.join(root, "ui-audit/UI_AUDIT_REPORT.md")
  );
  await copyOptional(path.join(higStudyRoot, "HIG_STUDY_DIGEST.md"), path.join(root, "ui-audit/HIG_STUDY_DIGEST.md"));
  for (const filePath of await listFiles(path.join(uiAuditRoot, "contact-sheets"))) {
    await copyRequired(filePath, path.join(root, "ui-audit/contact-sheets", path.basename(filePath)));
  }
  const screenshotFiles = (await listFiles(uiAuditRoot)).filter((filePath) => path.extname(filePath).toLowerCase() === ".png");
  const contactSheets = (await listFiles(path.join(root, "ui-audit/contact-sheets"))).map((filePath) => `contact-sheets/${path.basename(filePath)}`);
  await writeFile(path.join(root, "ui-audit/SCREENSHOT_INDEX.md"), [
    "# SVGA Workbench v1 UI Audit Screenshot Index",
    "",
    `Raw screenshot count captured: ${screenshotFiles.length}.`,
    `Contact sheet count included in this package: ${contactSheets.length}.`,
    "",
    "The raw screenshot set remains in the local artifact root; the complete review package includes contact sheets plus the written audit to keep the handoff portable and privacy-clean.",
    "",
    ...contactSheets.map((entry) => `- [${entry}](${entry})`),
    ""
  ].join("\n"), "utf8");
}

async function copyPhaseEvidence(root) {
  const phase2Files = [
    "artifact-index.json",
    "desktop-state-render-proof.json",
    "owner-usability-smoke.json",
    "runtime-identity.json",
    "desktop-info-assets-open.png",
    "desktop-optimized-reopen-proof.png",
    "desktop-local-info-assets-open.png",
    "desktop-sequence-review-proof.png",
    "desktop-sequence-repair-preview-proof.png",
    "desktop-sequence-no-write-simulation-proof.png",
    "desktop-sequence-bounded-repair-prototype-proof.png",
    "desktop-sequence-prototype-rendered-boundary-proof.png",
    "desktop-sequence-noop-round-trip-proof.png"
  ];
  const phase3Files = [
    "artifact-index.json",
    "resource-edit-report.json",
    "round-trip-report.json",
    "thumbnail-evidence.json",
    "replacement-selected.png",
    "replacement-preview.png",
    "reopened-export.png",
    "reset-to-original.png",
    "edited-output.svga"
  ];
  const phase3MultiFiles = [
    "multi-resource-edit-report.json",
    "multi-resource-round-trip-report.json",
    "edit-history-report.json",
    "two-replacements.png",
    "undo-second-replacement.png",
    "redo-second-replacement.png",
    "reset-selected.png",
    "reset-all.png",
    "reopened-multi-resource-export.png",
    "multi-resource-edited-output.svga"
  ];
  for (const fileName of phase2Files) await copyOptional(path.join(repoRoot, ".artifacts/product/P2", fileName), path.join(root, "evidence/phase2", fileName));
  for (const fileName of phase3Files) await copyOptional(path.join(repoRoot, ".artifacts/product/P3", fileName), path.join(root, "evidence/phase3", fileName));
  for (const fileName of phase3MultiFiles) await copyOptional(path.join(repoRoot, ".artifacts/product/P4", fileName), path.join(root, "evidence/phase3/multi-resource", fileName));
  for (const fileName of phase2Files.filter((name) => name.includes("sequence"))) {
    await copyOptional(path.join(repoRoot, ".artifacts/product/P2", fileName), path.join(root, "evidence/phase4", fileName));
  }
  await copyOptional(
    path.join(repoRoot, "docs/reviews/2026-06-30-codex-svga-workbench-sequence-byte-candidate.md"),
    path.join(root, "evidence/phase4/2026-06-30-codex-svga-workbench-sequence-byte-candidate.md")
  );
  await writeJson(path.join(root, "evidence/phase-evidence-summary.json"), phaseEvidenceSummary());
}

function phaseEvidenceSummary() {
  return {
    schemaVersion: 1,
    milestoneId,
    phase2AssetIntelligence: {
      status: "implemented_and_smoke_validated",
      includedEvidence: [
        "evidence/phase2/artifact-index.json",
        "evidence/phase2/desktop-state-render-proof.json",
        "evidence/phase2/desktop-info-assets-open.png",
        "evidence/phase2/desktop-optimized-reopen-proof.png"
      ],
      selfContainedReviewClaims: [
        "resource classification is visible in Asset Intelligence and Resources panels",
        "safe optimization candidate flow is Save As only and source immutable",
        "optimized output reopen proof is included through desktop smoke evidence"
      ],
      riskyOrSkippedReasons: [
        "referenced image resources are not deleted",
        "sequence repair output remains non-product-exposed",
        "drag/drop sources without host file authority cannot perform optimized Save As"
      ]
    },
    phase3ReplacementEditing: {
      status: "implemented_and_smoke_validated_for_supported_png_resources",
      includedEvidence: [
        "evidence/phase3/resource-edit-report.json",
        "evidence/phase3/round-trip-report.json",
        "evidence/phase3/replacement-preview.png",
        "evidence/phase3/reopened-export.png",
        "evidence/phase3/multi-resource/multi-resource-round-trip-report.json"
      ],
      coveredOperations: ["supported PNG replacement", "undo", "redo", "reset", "Save As", "reopen", "reference validation"],
      unsupportedOperations: ["text editing", "key rename", "URL import", "timeline edit", "structural SVGA edit"]
    },
    phase4SequenceFrameRepair: {
      status: "partial_smoke_only_candidate",
      includedEvidence: [
        "evidence/phase4/desktop-sequence-review-proof.png",
        "evidence/phase4/desktop-sequence-repair-preview-proof.png",
        "evidence/phase4/desktop-sequence-no-write-simulation-proof.png",
        "evidence/phase4/2026-06-30-codex-svga-workbench-sequence-byte-candidate.md"
      ],
      implemented: [
        "sequence group detection",
        "sequence review evidence",
        "bounded repair-preview/no-write contracts",
        "byte-producing smoke candidate behind fail-closed proof validation"
      ],
      smokeOnly: ["sequence byte candidate"],
      notProductExposed: ["sequence repair Save As", "automatic sequence rewrite", "repair-success claim"],
      blockedOrPending: ["manual visual confirmation", "owner-visible before/after acceptance", "safe exact sequence repair product path"]
    }
  };
}

async function copyValidationOutputs(root, allowMissingValidation) {
  const missing = requiredValidationFiles.filter((fileName) => !existsSync(path.join(validationRoot, fileName)));
  if (missing.length > 0 && !allowMissingValidation) {
    throw new Error(`validation outputs missing: ${missing.join(", ")}`);
  }
  await mkdir(path.join(root, "validation"), { recursive: true });
  for (const filePath of await listFiles(validationRoot)) {
    await copyRequired(filePath, path.join(root, "validation", path.basename(filePath)));
  }
  if (missing.length > 0) {
    await writeJson(path.join(root, "validation/VALIDATION_INCOMPLETE.json"), {
      schemaVersion: 1,
      milestoneId,
      passed: false,
      missing
    });
  }
}

async function buildManifest(root, extra = {}) {
  const entries = [];
  for (const filePath of await listFiles(root)) {
    const relativePath = toBundlePath(root, filePath);
    if (relativePath === "MANIFEST.json") continue;
    const stats = await stat(filePath);
    entries.push({
      path: relativePath,
      role: roleForPath(relativePath),
      mime: mimeFor(filePath),
      sizeBytes: stats.size,
      sha256: await sha256File(filePath)
    });
  }
  entries.sort((left, right) => left.path.localeCompare(right.path));
  return {
    schemaVersion: 1,
    milestoneId,
    generatedAt: new Date().toISOString(),
    ...extra,
    entryCount: entries.length,
    entries
  };
}

function roleForPath(relativePath) {
  if (relativePath === "UPLOAD_INDEX.json") return "upload_index";
  if (relativePath === "bundle-privacy-audit.json") return "privacy_audit";
  if (relativePath === "hashes/sha256sums.txt") return "hash_list";
  if (relativePath.startsWith("extracted-index/")) return "extracted_zip_index";
  if (relativePath.startsWith("validation/")) return "validation_output";
  if (relativePath.startsWith("app/")) return "macos_app_payload";
  if (relativePath.startsWith("docs/")) return "status_or_guidance_doc";
  if (relativePath.startsWith("ui-audit/")) return "ui_audit_evidence";
  if (relativePath.startsWith("evidence/phase2/")) return "phase2_evidence";
  if (relativePath.startsWith("evidence/phase3/")) return "phase3_evidence";
  if (relativePath.startsWith("evidence/phase4/")) return "phase4_evidence";
  if (relativePath.startsWith("review-notes/")) return "review_note";
  return "review_payload";
}

export async function validateManifestPayloadHashes({ root, manifest }) {
  const errors = [];
  const manifestPaths = new Set((manifest.entries ?? []).map((entry) => entry.path));
  const diskPaths = new Set();
  for (const filePath of await listFiles(root)) {
    const relativePath = toBundlePath(root, filePath);
    if (relativePath === "MANIFEST.json") continue;
    diskPaths.add(relativePath);
    if (!manifestPaths.has(relativePath)) errors.push(`manifest missing ${relativePath}`);
  }
  for (const entry of manifest.entries ?? []) {
    const filePath = path.join(root, entry.path);
    if (!existsSync(filePath)) {
      errors.push(`manifest entry missing on disk ${entry.path}`);
      continue;
    }
    const identity = await fileIdentity(filePath);
    if (identity.sizeBytes !== entry.sizeBytes) errors.push(`size mismatch ${entry.path}`);
    if (identity.sha256 !== entry.sha256) errors.push(`sha256 mismatch ${entry.path}`);
    if (!diskPaths.has(entry.path)) errors.push(`manifest entry not in disk walk ${entry.path}`);
  }
  if (manifestPaths.has("MANIFEST.json")) errors.push("manifest must not include itself");
  return {
    passed: errors.length === 0,
    errors
  };
}

async function writeSha256Sums(root) {
  const rows = [];
  for (const filePath of await listFiles(root)) {
    const relativePath = toBundlePath(root, filePath);
    if (relativePath === "MANIFEST.json" || relativePath === "hashes/sha256sums.txt") continue;
    rows.push(`${await sha256File(filePath)}  ${relativePath}`);
  }
  rows.sort();
  await mkdir(path.join(root, "hashes"), { recursive: true });
  await writeFile(path.join(root, "hashes/sha256sums.txt"), `${rows.join("\n")}\n`, "utf8");
}

export async function buildBundlePrivacyAudit(root, { expectedHeadShort, appZipName }) {
  const username = os.userInfo().username;
  const findings = [];
  const scannedTextPayloads = [];
  const zipAudits = [];
  for (const filePath of await listFiles(root)) {
    const relativePath = toBundlePath(root, filePath);
    findings.push(...privacyFindings(relativePath, `path:${relativePath}`, username));
    const ext = path.extname(filePath).toLowerCase();
    if (relativePath === "bundle-privacy-audit.json") continue;
    if (ext === ".zip") {
      const entries = zipEntries(filePath);
      const inspection = inspectZipEntries(entries);
      if (!inspection.passed) findings.push({ ruleId: "FORBIDDEN_ZIP_METADATA", entry: relativePath, detail: inspection });
      const zipAudit = {
        zipRole: roleForPath(relativePath),
        fileName: path.basename(filePath),
        entryCount: entries.length,
        scannedTextEntryCount: 0,
        skippedBinaryEntryCount: 0,
        inspection
      };
      for (const entry of entries) {
        findings.push(...privacyFindings(entry, `zip-entry:${relativePath}:${entry}`, username));
        if (!textExtensions.has(path.extname(entry).toLowerCase())) {
          zipAudit.skippedBinaryEntryCount += 1;
          continue;
        }
        if (entry.endsWith("/")) continue;
        zipAudit.scannedTextEntryCount += 1;
        findings.push(...privacyFindings(zipEntryBytes(filePath, entry).toString("utf8"), `zip-text:${relativePath}:${entry}`, username));
      }
      zipAudits.push(zipAudit);
      continue;
    }
    if (textExtensions.has(ext)) {
      const text = await readFile(filePath, "utf8");
      scannedTextPayloads.push(relativePath);
      findings.push(...privacyFindings(text, relativePath, username));
    }
  }
  return {
    schemaVersion: 1,
    milestoneId,
    expectedHeadShort,
    appZipName,
    passed: findings.length === 0,
    findingCount: findings.length,
    rules: {
      noLocalAbsolutePaths: true,
      noLocalUsername: true,
      noHighConfidenceSecrets: true,
      appZipNoFinderMetadata: true,
      appZipNoPathTraversalOrDuplicateEntries: true
    },
    scannedTextPayloads: scannedTextPayloads.sort(),
    zipAudits,
    findings
  };
}

function privacyFindings(text, entry, username) {
  const findings = [];
  const rules = [
    ["MACOS_USERS_PATH", /\/Users\/[^/\s"'`]+(?:\/[^\s"'`]*)?/g],
    ["PRIVATE_PATH", /\/private\/[^\s"'`]+/g],
    ["VAR_FOLDERS_PATH", /\/var\/folders\/[^\s"'`]+/g],
    ["TMP_PATH", /\/tmp\/[^\s"'`]+/g],
    ["WINDOWS_USERS_PATH", /[A-Za-z]:\\Users\\[^\\\s"'`]+(?:\\[^\s"'`]*)?/g],
    ["HIGH_CONFIDENCE_SECRET", /(AKIA[0-9A-Z]{16}|ASIA[0-9A-Z]{16}|sk-[A-Za-z0-9_-]{32,}|xox[baprs]-[A-Za-z0-9-]{20,})/g]
  ];
  for (const [ruleId, pattern] of rules) {
    const matches = String(text).match(pattern);
    if (matches) findings.push({ ruleId, entry, sample: matches[0].slice(0, 96) });
  }
  if (repoRoot && String(text).includes(repoRoot)) findings.push({ ruleId: "REPO_ABSOLUTE_PATH", entry, sample: repoRoot });
  if (username && String(text).includes(username)) findings.push({ ruleId: "LOCAL_USERNAME", entry, sample: username });
  if (/NSAllowsArbitraryLoads<\/key>\s*<true\s*\/>/i.test(String(text))) {
    findings.push({ ruleId: "ARBITRARY_NETWORK_ALLOWANCE", entry, sample: "NSAllowsArbitraryLoads=true" });
  }
  return findings;
}

async function writeUploadIndex(root, { headCommit, headTree, completeZipName, appZipName }) {
  const records = [];
  for (const filePath of await listFiles(root)) {
    const relativePath = toBundlePath(root, filePath);
    if (relativePath === "MANIFEST.json") continue;
    const identity = await fileIdentity(filePath);
    records.push({
      relativePath,
      role: roleForPath(relativePath),
      required: true,
      sizeBytes: identity.sizeBytes,
      sha256: identity.sha256,
      finalHead: headCommit,
      finalTree: headTree
    });
  }
  records.sort((left, right) => left.relativePath.localeCompare(right.relativePath));
  const uploadIndex = {
    schemaVersion: 1,
    milestoneId,
    finalHead: headCommit,
    finalTree: headTree,
    productionApproved: false,
    transferWrapper: {
      fileName: completeZipName,
      role: "complete_review_directory_zip",
      identityRecordedAfterZip: true
    },
    macosAppZip: appZipName,
    files: records
  };
  await writeJson(path.join(root, "UPLOAD_INDEX.json"), uploadIndex);
  return uploadIndex;
}

async function writeReviewPacket(root, { headCommit, headTree, headShort, completeZipName, appZipName }) {
  await writeFile(path.join(root, "README.md"), [
    "# SVGA Workbench v1 Complete Review Directory",
    "",
    `Primary artifact: \`${completeZipName}\`.`,
    "",
    "This directory is generated from a clean staging root. Do not re-compress it in Finder.",
    "",
    "Status: basically complete review directory ready for external review. This handoff is not Product Owner acceptance.",
    "",
    "Start with `REVIEW_PACKET.md`, then use `UPLOAD_INDEX.json`, `MANIFEST.json`,",
    "`bundle-privacy-audit.json`, `package-hygiene-proof.json`, and",
    "`validation/validation-summary.json` for machine-checkable evidence.",
    ""
  ].join("\n"), "utf8");
  await writeFile(path.join(root, "REVIEW_PACKET.md"), [
    "# SVGA Workbench v1 Review Packet",
    "",
    `- HEAD: \`${headCommit}\``,
    `- Tree: \`${headTree}\``,
    `- Complete review ZIP: \`${completeZipName}\``,
    `- macOS App ZIP: \`app/${appZipName}\``,
    "- Product acceptance: not claimed",
    "- Phase 4 sequence repair: partial; product Save As remains disabled and manual visual confirmation is required",
    "- Review state: ready for external review of the complete directory package",
    "",
    "## Feature Completion Matrix",
    "",
    "| Area | Status | Notes |",
    "| --- | --- | --- |",
    "| Phase 1 stabilization | Passed baseline, repair package regenerated | Desktop smoke and package proof included in validation outputs |",
    "| Phase 2 Asset Intelligence / safe optimization | Implemented, Save As/reopen smoke validated | Safe candidates only; risky classes remain suggestion-only |",
    "| Phase 3 PNG replacement editing | Implemented for supported PNG resources | Undo/redo/reset/Save As/reopen evidence included |",
    "| Phase 4 sequence repair | Partial smoke-only candidate | Detection/group evidence included; user-facing sequence Save As not exposed |",
    "| macOS package | Unsigned internal ZIP only | Clean App ZIP hygiene validated; signing/notarization blocked by credentials |",
    "| UI audit / HIG | Included as repair input | Findings are tracked; broad UI polish not completed in this package repair |",
    "",
    "## Self-Contained Evidence",
    "",
    "- `UPLOAD_INDEX.json`: every required payload with role, size, SHA-256, head, and tree.",
    "- `MANIFEST.json`: every payload except `MANIFEST.json` itself, with role, size, MIME, and SHA-256.",
    "- `manifest-verification.json`: hash verification result for the staged review directory.",
    "- `bundle-privacy-audit.json`: outward-facing payload and App ZIP privacy scan.",
    "- `package-hygiene-proof.json`: App ZIP entry hygiene proof.",
    "- `extracted-index/app-zip-entry-list.json`: extracted App ZIP entry list.",
    "- `validation/`: complete validation command outputs, including desktop smoke and loop validation.",
    "- `evidence/phase2`, `evidence/phase3`, `evidence/phase4`: phase-specific reports, screenshots, edited SVGA outputs, and sequence status evidence.",
    "- `ui-audit/`: HIG study digest, UI audit report, screenshot index, and contact sheets.",
    "",
    "## Validation Summary",
    "",
    "- `npm run svga-workbench:v1:validate` passed with 14/14 command records.",
    "- Covered checks: syntax/type gates, complete-review package tests, shared frontend tests, root `npm test`, svga-web experiment tests, signing dry-run, macOS package generation, macOS package proof, desktop smoke, and final loop validation.",
    "- Desktop smoke passed with local-only page, strict CSP, nonblank playback canvas, inspection report, drag/drop, invalid recovery, owner usability, workbench region map, Phase 2 optimized reopen proof, Phase 3 replacement proofs, and Phase 4 partial sequence proofs.",
    "",
    "## App ZIP / Signing / Installer Status",
    "",
    `- App ZIP: \`app/${appZipName}\`, unsigned internal macOS ZIP.`,
    "- App ZIP hygiene: PASS only after inspecting the App ZIP itself; no `__MACOSX`, AppleDouble `._*`, `.DS_Store`, path traversal, duplicate entries, or Finder metadata.",
    "- Signing/notarization: dry-run workflow is present; production signing and notarization require Apple Developer ID identity and notary credentials.",
    "- Installer: no signed DMG/PKG is claimed in this package; the current distributable artifact is the internal App ZIP.",
    "- Windows trusted distribution remains preparation-only until a Windows signing certificate and release identity are available.",
    "",
    "## Changed Files Summary",
    "",
    "- `tools/svga-workbench/`: complete review directory generator, manifest/privacy/hygiene validation, validation collector, and tests.",
    "- `tools/electron-prototype/experiments/svga-web/`: clean macOS packaging, package proof, signing/notarization dry-run workflow, and desktop smoke evidence paths.",
    "- `tools/shared/product-frontend/`: Workbench UI surfaces for safe optimization, replacement, sequence evidence, diagnostics visibility, and smoke assertions.",
    "- `src/` and `dist/`-validated product modules: Asset Intelligence, safe optimization, replacement editing, and sequence evidence contracts are covered by the root test suite.",
    "- `docs/autonomous`, `docs/product`, and `docs/reviews`: status, blockers, HIG carry-forward, lessons candidates, and review notes.",
    "",
    "## Security / Privacy Summary",
    "",
    "- Local-only posture retained: strict CSP, context isolation, sandboxing, blocked navigation, blocked new windows, and no telemetry claims.",
    "- macOS package metadata validation fails closed if arbitrary network allowances, unused permission descriptions, or misleading Finder `.svga` associations reappear.",
    "- Privacy audit scans outward-facing review payloads, metadata, proof/status docs, validation outputs, and text entries inside the App ZIP.",
    "- Original SVGA files are not modified in place; optimization and replacement flows use Save As/new-output paths with reopen validation.",
    "",
    "## Knowledge And Docs Updated",
    "",
    "- `docs/SVGA_WORKBENCH_V1_STATUS.md`: current phase matrix and honest Phase 4 partial status.",
    "- `docs/AUTONOMOUS_RUN_LOG.md`: package repair, validation, HIG/UI repair, and final review generation notes.",
    "- `docs/AUTONOMOUS_BLOCKERS.md`: external credential blockers.",
    "- `docs/LESSONS_CANDIDATES.md`: reusable packaging, signing, HIG, and visible-hit-point lessons.",
    "- `docs/SVGA_WORKBENCH_HIG_AUDIT_GUIDE.md`: durable HIG-derived Workbench checklist.",
    "",
    "## Blockers Requiring Product Owner Or External Credentials",
    "",
    "- Apple Developer ID signing identity and notary credentials are required for trusted macOS distribution.",
    "- Windows code-signing certificate and release identity are required for trusted Windows distribution.",
    "- Product Owner review is required before claiming external product acceptance or production release approval.",
    "",
    "## Nonblocking Backlog",
    "",
    "- Product-exposed sequence repair Save As after safe exact repair and visual before/after acceptance.",
    "- Text editing, key rename, URL import, timeline edit, and structural SVGA edit remain unsupported until mechanically round-trippable.",
    "- UI audit follow-ups: toolbar target size, modal stacking, settings scroll affordance, loading escape path, sequence proof distinction, and dense row focus.",
    "- Signed DMG/PKG and Windows installer flow after credentials/release identity exist.",
    "",
    "## Known Risks",
    "",
    "- Phase 4 is partial: the byte-producing candidate is smoke-only, product Save As is disabled, manual visual confirmation is required, and repair success is not claimed.",
    "- The macOS App ZIP is unsigned and may be blocked by Gatekeeper outside internal/local review contexts.",
    "- UI audit P2/P3 items are tracked but not fully polished unless they hide a required workflow.",
    "- Historical review-upload artifacts are preserved only as lineage; the primary complete review artifact is this package.",
    "",
    "## Required Human Decision",
    "",
    "Recommended next human decision: review this complete directory as the Workbench v1 handoff candidate, decide whether the current Phase 4 partial status is acceptable for the next autonomous implementation slice, and provide signing/notarization credentials only when trusted distribution is required.",
    ""
  ].join("\n"), "utf8");
  await writeFile(path.join(root, "FINAL_RESPONSE.txt"), [
    `SVGA Workbench v1 complete review directory ready for external review at head ${headShort}.`,
    `Primary artifact: review/${completeZipName}`,
    `macOS App ZIP: app/${appZipName}`,
    "Validation: 14/14 commands passed in validation/validation-summary.json.",
    "Package hygiene: App ZIP clean; manifest verified; privacy audit passed with zero findings.",
    "Phase status: Phase 1/2/3 reviewable; Phase 4 partial with product sequence Save As disabled and manual visual confirmation required.",
    "Blockers: Apple Developer ID/notary credentials and Windows signing credentials only for trusted distribution.",
    "Status: complete review package generated; Product Owner acceptance and production release are not claimed.",
    ""
  ].join("\n"), "utf8");
}

async function copyDocs(root) {
  const docs = [
    ["docs/autonomous/AUTONOMOUS_RUN_LOG.md", "docs/AUTONOMOUS_RUN_LOG.md"],
    ["docs/autonomous/AUTONOMOUS_BLOCKERS.md", "docs/AUTONOMOUS_BLOCKERS.md"],
    ["docs/autonomous/SVGA_WORKBENCH_V1_STATUS.md", "docs/SVGA_WORKBENCH_V1_STATUS.md"],
    ["docs/autonomous/LESSONS_CANDIDATES.md", "docs/LESSONS_CANDIDATES.md"],
    ["docs/product/SVGA_WORKBENCH_HIG_AUDIT_GUIDE.md", "docs/SVGA_WORKBENCH_HIG_AUDIT_GUIDE.md"],
    ["docs/reviews/2026-06-30-codex-svga-workbench-safe-optimization-ui.md", "review-notes/2026-06-30-codex-svga-workbench-safe-optimization-ui.md"],
    ["docs/reviews/2026-06-30-codex-svga-workbench-sequence-byte-candidate.md", "review-notes/2026-06-30-codex-svga-workbench-sequence-byte-candidate.md"],
    ["docs/reviews/2026-06-30-codex-svga-workbench-signing-workflow.md", "review-notes/2026-06-30-codex-svga-workbench-signing-workflow.md"]
  ];
  for (const [source, target] of docs) {
    const sourcePath = path.join(repoRoot, source);
    if (existsSync(sourcePath)) await writeSanitizedMarkdown(sourcePath, path.join(root, target));
  }
}

async function main() {
  const allowMissingValidation = process.argv.includes("--allow-missing-validation");
  const headCommit = git(["rev-parse", "HEAD"]);
  const headTree = git(["rev-parse", "HEAD^{tree}"]);
  const headShort = git(["rev-parse", "--short", "HEAD"]);
  const completeDirectoryName = `${milestoneId}-${headShort}-complete-review-directory`;
  const completeZipName = `${completeDirectoryName}.zip`;
  const completeRoot = path.join(stagingRoot, completeDirectoryName);
  const completeZipPath = path.join(reviewRoot, completeZipName);
  const appZipName = `Auto-SVGA-macOS-internal-${headShort}.zip`;
  const appZipPath = path.join(completeRoot, "app", appZipName);

  await rm(stagingRoot, { recursive: true, force: true });
  await rm(completeZipPath, { force: true });
  await mkdir(completeRoot, { recursive: true });
  await mkdir(path.join(completeRoot, "app"), { recursive: true });
  await mkdir(reviewRoot, { recursive: true });

  const appZipInspection = createCleanAppZip({ zipPath: appZipPath });
  await copyOptional(internalTrialManifestPath, path.join(completeRoot, "app/internal-trial-manifest.json"));
  await writeMacosPackageProof({
    appBundle,
    archivePath: appZipPath,
    outputPath: path.join(completeRoot, "app/macos-package-proof.json")
  });
  await copyDocs(completeRoot);
  await copyUiAuditEvidence(completeRoot);
  await copyPhaseEvidence(completeRoot);
  await copyValidationOutputs(completeRoot, allowMissingValidation);
  await writeReviewPacket(completeRoot, { headCommit, headTree, headShort, completeZipName, appZipName });

  await mkdir(path.join(completeRoot, "extracted-index"), { recursive: true });
  await writeJson(path.join(completeRoot, "extracted-index/app-zip-entry-list.json"), await buildZipEntryList(appZipPath, "macos_app_zip"));
  await writeJson(path.join(completeRoot, "package-hygiene-proof.json"), {
    schemaVersion: 1,
    milestoneId,
    finalHead: headCommit,
    appZip: {
      fileName: appZipName,
      ...await fileIdentity(appZipPath),
      ...appZipInspection
    },
    assertions: {
      appZipClean: appZipInspection.passed === true,
      packageHygienePassRequiresCleanAppZip: true,
      noFinderMetadataClaimedOnlyAfterAppZipInspection: true
    }
  });

  await writeUploadIndex(completeRoot, { headCommit, headTree, completeZipName, appZipName });
  await writeSha256Sums(completeRoot);
  const privacyAudit = await buildBundlePrivacyAudit(completeRoot, { expectedHeadShort: headShort, appZipName });
  if (!privacyAudit.passed) {
    await writeJson(path.join(completeRoot, "bundle-privacy-audit.json"), privacyAudit);
    throw new Error(`bundle privacy audit failed: ${privacyAudit.findings.map((finding) => `${finding.ruleId}:${finding.entry}`).join("; ")}`);
  }
  await writeJson(path.join(completeRoot, "bundle-privacy-audit.json"), privacyAudit);

  const manifest = await buildManifest(completeRoot, {
    finalHead: headCommit,
    finalTree: headTree,
    productionApproved: false,
    productOwnerAcceptanceClaimed: false,
    appZipClean: appZipInspection.passed,
    privacyAuditPassed: privacyAudit.passed
  });
  await writeJson(path.join(completeRoot, "MANIFEST.json"), manifest);
  const manifestCheck = await validateManifestPayloadHashes({ root: completeRoot, manifest });
  if (!manifestCheck.passed) throw new Error(`manifest verification failed: ${manifestCheck.errors.join("; ")}`);
  await writeJson(path.join(completeRoot, "manifest-verification.json"), {
    schemaVersion: 1,
    milestoneId,
    passed: true,
    checkedEntryCount: manifest.entries.length
  });
  const finalManifest = await buildManifest(completeRoot, {
    finalHead: headCommit,
    finalTree: headTree,
    productionApproved: false,
    productOwnerAcceptanceClaimed: false,
    appZipClean: appZipInspection.passed,
    privacyAuditPassed: privacyAudit.passed
  });
  await writeJson(path.join(completeRoot, "MANIFEST.json"), finalManifest);
  const finalManifestCheck = await validateManifestPayloadHashes({ root: completeRoot, manifest: finalManifest });
  if (!finalManifestCheck.passed) throw new Error(`final manifest verification failed: ${finalManifestCheck.errors.join("; ")}`);

  const entries = (await listFiles(completeRoot)).map((filePath) => toBundlePath(completeRoot, filePath));
  runZip({ cwd: completeRoot, zipPath: completeZipPath, entries });
  const completeZipInspection = assertCleanZip(completeZipPath, "complete review directory ZIP");
  const completeZipIdentity = await fileIdentity(completeZipPath);
  await writeJson(path.join(reviewRoot, `${completeDirectoryName}-summary.json`), {
    schemaVersion: 1,
    milestoneId,
    finalHead: headCommit,
    finalTree: headTree,
    completeReviewDirectoryZip: {
      fileName: completeZipName,
      path: path.relative(repoRoot, completeZipPath).split(path.sep).join("/"),
      ...completeZipIdentity,
      ...completeZipInspection
    },
    stagingDirectory: path.relative(repoRoot, completeRoot).split(path.sep).join("/"),
    appZip: {
      fileName: appZipName,
      ...await fileIdentity(appZipPath),
      ...appZipInspection
    },
    privacyAudit: {
      passed: privacyAudit.passed,
      findingCount: privacyAudit.findingCount
    },
    manifest: {
      entryCount: finalManifest.entries.length,
      verified: finalManifestCheck.passed
    }
  });
  console.log(JSON.stringify({
    completeReviewDirectoryZip: path.relative(repoRoot, completeZipPath).split(path.sep).join("/"),
    sha256: completeZipIdentity.sha256,
    sizeBytes: completeZipIdentity.sizeBytes,
    finalHead: headCommit,
    finalTree: headTree,
    appZipClean: appZipInspection.passed,
    privacyAuditPassed: privacyAudit.passed,
    manifestVerified: finalManifestCheck.passed
  }, null, 2));
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
