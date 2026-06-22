#!/usr/bin/env node
import { execFileSync, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { cp, mkdir, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptRoot = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptRoot, "../..");
const milestoneId = "P6";
const productRoot = path.join(repoRoot, ".artifacts/product/P6");
const packetRoot = path.join(repoRoot, ".artifacts/loop-handoff/latest");
const trialRoot = path.join(repoRoot, "tools/electron-prototype/experiments/svga-web/.artifacts/internal-trial");
const trialApp = path.join(trialRoot, "Auto SVGA-darwin-arm64/Auto SVGA.app");
const uploadStagingRoot = path.join(repoRoot, ".artifacts/product/P6-owner-review-upload");
const parityReportPath = path.join(productRoot, "p6-parity-report.json");

const sealedFiles = [
  "REVIEW_PACKET.md",
  "validation.json",
  "budget-check.json",
  "reviewer-a.json",
  "reviewer-b.json",
  "post-seal-verification.json"
];

const textExtensions = new Set([".json", ".md", ".txt", ".html", ".js", ".mjs", ".cjs", ".css", ".patch", ".plist", ".xml"]);

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
  const data = await readFile(filePath);
  return {
    sizeBytes: data.byteLength,
    sha256: sha256Bytes(data)
  };
}

async function copyRequired(sourcePath, targetPath) {
  const before = await fileIdentity(sourcePath);
  await mkdir(path.dirname(targetPath), { recursive: true });
  await cp(sourcePath, targetPath, { recursive: true });
  const after = await fileIdentity(targetPath);
  if (before.sizeBytes !== after.sizeBytes || before.sha256 !== after.sha256) {
    throw new Error(`copied file changed: ${sourcePath}`);
  }
  return after;
}

async function listFiles(root) {
  const files = [];
  async function walk(directory) {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const absolute = path.join(directory, entry.name);
      if (entry.name === ".DS_Store" || entry.name === "__MACOSX") continue;
      if (entry.isDirectory()) {
        await walk(absolute);
      } else if (entry.isFile()) {
        files.push(absolute);
      }
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
  if (ext === ".patch") return "text/x-diff";
  if (ext === ".svga") return "application/octet-stream";
  return "application/octet-stream";
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function privacyRules() {
  const rules = [
    { ruleId: "MACOS_USERS_PATH", pattern: /\/Users\/[^/\s"'`]+(?:\/[^\s"'`]*)?/g },
    { ruleId: "PRIVATE_PATH", pattern: /\/private\/[^\s"'`]+/g },
    { ruleId: "VAR_FOLDERS_PATH", pattern: /\/var\/folders\/[^\s"'`]+/g },
    { ruleId: "TMP_PATH", pattern: /\/tmp\/[^\s"'`]+/g },
    { ruleId: "WINDOWS_PATH", pattern: /[A-Za-z]:\\Users\\[^\\\s"'`]+(?:\\[^\s"'`]*)?/g }
  ];
  for (const value of [repoRoot, process.env.HOME, os.tmpdir(), os.userInfo().username]) {
    if (value) rules.push({ ruleId: "LOCAL_ENVIRONMENT_TEXT", pattern: new RegExp(escapeRegExp(value), "g") });
  }
  return rules;
}

function findPrivacyMatches(text, entry) {
  const findings = [];
  for (const rule of privacyRules()) {
    for (const match of text.matchAll(rule.pattern)) {
      findings.push({
        ruleId: rule.ruleId,
        entry,
        valueSha256: sha256Bytes(Buffer.from(match[0]))
      });
    }
  }
  return findings;
}

function zipEntries(zipPath) {
  const result = spawnSync("unzip", ["-Z1", zipPath], { encoding: "utf8" });
  if (result.status !== 0) throw new Error(`unable to inspect ZIP: ${zipPath}`);
  return result.stdout.split("\n").filter(Boolean).sort();
}

function zipEntryBytes(zipPath, entry) {
  const result = spawnSync("unzip", ["-p", zipPath, entry], {
    encoding: "buffer",
    maxBuffer: 512 * 1024 * 1024
  });
  if (result.status !== 0) throw new Error(`unable to extract ZIP entry: ${entry}`);
  return result.stdout;
}

function looksText(bytes) {
  if (bytes.includes(0)) return false;
  const sample = bytes.subarray(0, Math.min(bytes.length, 4096));
  if (sample.length === 0) return true;
  let printable = 0;
  for (const byte of sample) {
    if (byte === 9 || byte === 10 || byte === 13 || (byte >= 32 && byte <= 126) || byte >= 128) printable += 1;
  }
  return printable / sample.length > 0.9;
}

function extractAsciiStrings(bytes, minLength = 8) {
  const strings = [];
  let current = "";
  for (const byte of bytes) {
    if (byte >= 32 && byte <= 126) {
      current += String.fromCharCode(byte);
    } else {
      if (current.length >= minLength) strings.push(current);
      current = "";
    }
  }
  if (current.length >= minLength) strings.push(current);
  return strings;
}

function extractUtf16LeStrings(bytes, minLength = 8) {
  const strings = [];
  let current = "";
  for (let index = 0; index + 1 < bytes.length; index += 2) {
    const code = bytes[index] + bytes[index + 1] * 256;
    if (code >= 32 && code <= 126) {
      current += String.fromCharCode(code);
    } else {
      if (current.length >= minLength) strings.push(current);
      current = "";
    }
  }
  if (current.length >= minLength) strings.push(current);
  return strings;
}

function pngMetadataStrings(bytes) {
  const pngSignature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  if (bytes.length < pngSignature.length || !bytes.subarray(0, pngSignature.length).equals(pngSignature)) return [];
  const metadata = [];
  let offset = pngSignature.length;
  while (offset + 12 <= bytes.length) {
    const length = bytes.readUInt32BE(offset);
    const type = bytes.subarray(offset + 4, offset + 8).toString("ascii");
    const dataStart = offset + 8;
    const dataEnd = dataStart + length;
    if (dataEnd + 4 > bytes.length) break;
    if (["tEXt", "iTXt", "zTXt"].includes(type)) {
      metadata.push(bytes.subarray(dataStart, dataEnd).toString("latin1"));
    }
    offset = dataEnd + 4;
  }
  return metadata;
}

function scanEntryBytes({ bytes, entry, ext }) {
  const findings = [];
  if (textExtensions.has(ext) || looksText(bytes)) {
    findings.push(...findPrivacyMatches(bytes.toString("utf8"), `zip-text:${entry}`));
    return { kind: "text", findings };
  }
  const extractable = [
    ...extractAsciiStrings(bytes),
    ...extractUtf16LeStrings(bytes),
    ...pngMetadataStrings(bytes)
  ].join("\n");
  if (extractable) findings.push(...findPrivacyMatches(extractable, `zip-binary-strings:${entry}`));
  return { kind: "binary", findings };
}

function shouldSkipVendorBinaryContentScan(entry) {
  return /^Auto SVGA\.app\/Contents\/(?:Frameworks|MacOS)\//.test(entry);
}

function zipRoleForBundlePath(bundlePath) {
  return `staging:${bundlePath.replace(/[^A-Za-z0-9._-]+/g, "_")}`;
}

function headFromCanonicalManifest(manifest) {
  return manifest.reviewedHeadCommit
    ?? manifest.sourceHeadCommit
    ?? manifest.headCommit
    ?? manifest.source?.headCommit
    ?? manifest.repositoryHeadCommitAtFinish
    ?? null;
}

export function collectP6ParityNonPass(report) {
  const nonPass = [];
  for (const [sectionKey, section] of Object.entries(report?.sections ?? {})) {
    const sectionStatus = section?.status ?? "missing";
    if (sectionStatus !== "pass") nonPass.push(`${sectionKey}:${sectionStatus}`);
    for (const evidence of section?.evidence ?? []) {
      if (evidence.status !== "pass") nonPass.push(`${sectionKey}.${evidence.id}:${evidence.status}`);
    }
    for (const item of section?.items ?? []) {
      if (item.required === false) continue;
      if (item.status !== "pass") {
        const failures = Array.isArray(item.failures) ? item.failures.join("|") : "";
        nonPass.push(`${sectionKey}.${item.id}:${item.status}:${failures}`);
      }
    }
  }
  return nonPass;
}

export function validateFinalPackagingGate({ headCommit, canonicalManifest, parityReport }) {
  const errors = [];
  const packetHead = headFromCanonicalManifest(canonicalManifest);
  const parityHead = parityReport?.source?.headCommit ?? parityReport?.headCommit ?? null;
  const nonPassEvidence = collectP6ParityNonPass(parityReport);

  if (!packetHead) {
    errors.push("sealed packet MANIFEST.json does not record a reviewed head commit");
  } else if (packetHead !== headCommit) {
    errors.push(`sealed packet reviewed head ${packetHead} does not match current head ${headCommit}`);
  }

  if (!parityHead) {
    errors.push("P6 parity report does not record a source head commit");
  } else if (parityHead !== headCommit) {
    errors.push(`P6 parity report head ${parityHead} does not match current head ${headCommit}`);
  }

  if (nonPassEvidence.length > 0) {
    errors.push(`P6 required parity failures remain: ${nonPassEvidence.slice(0, 40).join("; ")}`);
  }

  return {
    passed: errors.length === 0,
    headCommit,
    packetHeadCommit: packetHead,
    parityReportHeadCommit: parityHead,
    nonPassEvidenceCount: nonPassEvidence.length,
    nonPassEvidence,
    errors
  };
}

async function assertFinalPackagingGate({ headCommit, canonicalManifest }) {
  if (!existsSync(parityReportPath)) {
    throw new Error(`P6 final packaging gate blocked: missing parity report ${parityReportPath}`);
  }
  const parityReport = JSON.parse(await readFile(parityReportPath, "utf8"));
  const gate = validateFinalPackagingGate({ headCommit, canonicalManifest, parityReport });
  if (!gate.passed) {
    throw new Error(`P6 final packaging gate blocked: ${gate.errors.join("; ")}`);
  }
  return {
    passed: true,
    packetHeadCommit: gate.packetHeadCommit,
    parityReportHeadCommit: gate.parityReportHeadCommit,
    nonPassEvidenceCount: gate.nonPassEvidenceCount,
    parityReportPath: path.relative(repoRoot, parityReportPath).split(path.sep).join("/")
  };
}

export function buildZipPrivacyAudit({
  reviewZipPath,
  appZipPath,
  extraZipPaths = [],
  selfReferentialEntryNames = ["bundle-privacy-audit.json"]
}) {
  const findings = [];
  const selfReferentialExclusions = [];
  const zipAudits = [];
  let scannedEntryCount = 0;
  let scannedTextEntryCount = 0;
  let scannedBinaryEntryCount = 0;
  const selfReferentialSet = new Set(selfReferentialEntryNames);
  const zipInputs = [
    ["review", reviewZipPath],
    ["app", appZipPath],
    ...extraZipPaths.map(({ zipRole, zipPath }) => [zipRole, zipPath])
  ];

  for (const [zipRole, zipPath] of zipInputs) {
    const entries = zipEntries(zipPath);
    const zipAudit = {
      zipRole,
      fileName: path.basename(zipPath),
      actualZipEntryCount: entries.length,
      scannedEntryCount: 0,
      scannedTextEntryCount: 0,
      scannedBinaryEntryCount: 0,
      skippedNestedArchiveEntryCount: 0,
      skippedVendorBinaryEntryCount: 0
    };
    for (const entry of entries) {
      scannedEntryCount += 1;
      zipAudit.scannedEntryCount += 1;
      findings.push(...findPrivacyMatches(entry, `zip-entry:${zipRole}:${entry}`));
      if (entry.includes("__MACOSX") || path.basename(entry) === ".DS_Store") {
        findings.push({ ruleId: "FORBIDDEN_ZIP_METADATA", entry: `${zipRole}:${entry}` });
      }
      if (entry.endsWith("/")) continue;
      if (selfReferentialSet.has(path.basename(entry))) {
        selfReferentialExclusions.push({
          zipRole,
          entry,
          reason: "self-referential audit content is regenerated after ZIP assembly"
        });
        continue;
      }
      if (path.extname(entry).toLowerCase() === ".zip") {
        scannedBinaryEntryCount += 1;
        zipAudit.scannedBinaryEntryCount += 1;
        zipAudit.skippedNestedArchiveEntryCount += 1;
        continue;
      }
      if (shouldSkipVendorBinaryContentScan(entry)) {
        scannedBinaryEntryCount += 1;
        zipAudit.scannedBinaryEntryCount += 1;
        zipAudit.skippedVendorBinaryEntryCount += 1;
        continue;
      }
      const bytes = zipEntryBytes(zipPath, entry);
      const scan = scanEntryBytes({ bytes, entry: `${zipRole}:${entry}`, ext: path.extname(entry).toLowerCase() });
      findings.push(...scan.findings);
      if (scan.kind === "text") {
        scannedTextEntryCount += 1;
        zipAudit.scannedTextEntryCount += 1;
      } else {
        scannedBinaryEntryCount += 1;
        zipAudit.scannedBinaryEntryCount += 1;
      }
    }
    zipAudits.push(zipAudit);
  }

  const actualZipEntryCount = zipAudits.reduce((total, audit) => total + audit.actualZipEntryCount, 0);
  return {
    schemaVersion: 2,
    milestoneId,
    passed: findings.length === 0,
    actualZipEntryCount,
    scannedEntryCount,
    scannedTextEntryCount,
    scannedBinaryEntryCount,
    selfReferentialExclusions,
    zipAudits,
    findings
  };
}

async function buildPrivacyAudit({ stagingRoot, appZipPath, reviewZipPath }) {
  const findings = [];
  const scannedEntries = [];
  const stagingFiles = await listFiles(stagingRoot);
  const extraZipPaths = [];
  for (const filePath of stagingFiles) {
    const bundlePath = toBundlePath(stagingRoot, filePath);
    if (path.extname(filePath).toLowerCase() === ".zip") {
      extraZipPaths.push({ zipRole: zipRoleForBundlePath(bundlePath), zipPath: filePath });
    }
    findings.push(...findPrivacyMatches(bundlePath, `entry:${bundlePath}`));
    const ext = path.extname(filePath).toLowerCase();
    if (!textExtensions.has(ext)) continue;
    scannedEntries.push(bundlePath);
    findings.push(...findPrivacyMatches(await readFile(filePath, "utf8"), bundlePath));
  }
  const zipAudit = buildZipPrivacyAudit({ reviewZipPath, appZipPath, extraZipPaths });
  findings.push(...zipAudit.findings);
  return {
    schemaVersion: 2,
    milestoneId,
    passed: findings.length === 0,
    actualZipEntryCount: zipAudit.actualZipEntryCount,
    scannedEntryCount: zipAudit.scannedEntryCount,
    scannedTextEntryCount: zipAudit.scannedTextEntryCount,
    scannedBinaryEntryCount: zipAudit.scannedBinaryEntryCount,
    selfReferentialExclusions: zipAudit.selfReferentialExclusions,
    zipAudits: zipAudit.zipAudits,
    scannedTextEntries: scannedEntries.sort(),
    findingCount: findings.length,
    findings
  };
}

async function buildManifest(root, extra = {}) {
  const entries = [];
  for (const filePath of await listFiles(root)) {
    const bundlePath = toBundlePath(root, filePath);
    if (bundlePath === "MANIFEST.json") continue;
    const stats = await stat(filePath);
    entries.push({
      path: bundlePath,
      mime: mimeFor(filePath),
      sizeBytes: stats.size,
      sha256: await sha256File(filePath)
    });
  }
  return {
    schemaVersion: 1,
    milestoneId,
    generatedAt: "stable-p6-owner-handoff",
    ...extra,
    entries: entries.sort((left, right) => left.path.localeCompare(right.path))
  };
}

function runZip({ cwd, zipPath, entries }) {
  const result = spawnSync("zip", ["-q", "-X", zipPath, "-@"], {
    cwd,
    input: `${entries.join("\n")}\n`,
    env: { ...process.env, COPYFILE_DISABLE: "1" },
    encoding: "utf8",
    maxBuffer: 20 * 1024 * 1024
  });
  if (result.status !== 0) throw new Error(result.stderr || result.stdout || `zip failed: ${zipPath}`);
}

function createCleanAppZip({ appBundle, zipPath }) {
  const result = spawnSync("/usr/bin/ditto", ["-c", "-k", "--norsrc", "--keepParent", appBundle, zipPath], {
    env: { ...process.env, COPYFILE_DISABLE: "1" },
    encoding: "utf8",
    maxBuffer: 20 * 1024 * 1024
  });
  if (result.status !== 0) throw new Error(result.stderr || result.stdout || "ditto app zip failed");
  const badEntries = zipEntries(zipPath).filter((entry) => entry.includes("__MACOSX") || path.basename(entry) === ".DS_Store");
  if (badEntries.length) throw new Error(`clean App ZIP contains forbidden metadata: ${badEntries.slice(0, 5).join(", ")}`);
}

function finalResponseText({ headShort, visibleRootAbs, reviewZipName, appZipName, companionRequired, absoluteLinks }) {
  const link = (label, fileName) => {
    const target = absoluteLinks ? path.join(visibleRootAbs, fileName) : fileName;
    return `[${label}](${target})`;
  };
  const lines = [
    "P6_MACHINE_EXECUTION_COMPLETE",
    "",
    "VISIBLE_REVIEW:",
    `- ${link("P6 Review Packet", "REVIEW_PACKET.md")}`,
    `- ${link("P6 Review ZIP", reviewZipName)}`,
  ];
  if (companionRequired) {
    lines.push(`- ${link("P6 Companion Patch", "changes.patch")}`);
  }
  lines.push(
    "",
    "MACOS_APP_TO_TEST:",
    `- ${link("Auto SVGA macOS App ZIP", appZipName)}`,
    "",
    "VISIBLE_FOLDER:",
    `- review/P6-${headShort}/`,
    "",
    "STATUS:",
    "- P6: HUMAN_REQUIRED",
    "- PHASE_2: NOT_STARTED",
    ""
  );
  return lines.join("\n");
}

async function main() {
  const headCommit = git(["rev-parse", "HEAD"]);
  const headShort = git(["rev-parse", "--short", headCommit]);
  const visibleRoot = path.join(repoRoot, `review/P6-${headShort}`);
  const reviewZipName = `P6-${headShort}-review-upload.zip`;
  const appZipName = `Auto-SVGA-macOS-internal-${headShort}.zip`;
  const reviewZipPath = path.join(visibleRoot, reviewZipName);
  const appZipPath = path.join(visibleRoot, appZipName);
  const canonicalManifest = JSON.parse(await readFile(path.join(packetRoot, "MANIFEST.json"), "utf8"));

  if (canonicalManifest.milestoneOutcome !== "HUMAN_REQUIRED") {
    throw new Error("P6 owner handoff requires a HUMAN_REQUIRED sealed packet.");
  }
  if (!existsSync(trialApp)) {
    throw new Error(`macOS trial app missing: ${trialApp}`);
  }
  const finalPackagingGate = await assertFinalPackagingGate({ headCommit, canonicalManifest });

  await rm(uploadStagingRoot, { recursive: true, force: true });
  await rm(visibleRoot, { recursive: true, force: true });
  await mkdir(uploadStagingRoot, { recursive: true });
  await mkdir(visibleRoot, { recursive: true });

  for (const fileName of sealedFiles) {
    await copyRequired(path.join(packetRoot, fileName), path.join(uploadStagingRoot, fileName));
    await copyRequired(path.join(packetRoot, fileName), path.join(visibleRoot, fileName));
  }
  if (canonicalManifest.companionRequired === true) {
    await copyRequired(path.join(packetRoot, "changes.patch"), path.join(uploadStagingRoot, "changes.patch"));
    await copyRequired(path.join(packetRoot, "changes.patch"), path.join(visibleRoot, "changes.patch"));
  }
  for (const fileName of ["artifact-index.json"]) {
    if (existsSync(path.join(packetRoot, fileName))) {
      await copyRequired(path.join(packetRoot, fileName), path.join(uploadStagingRoot, fileName));
    }
  }

  await cp(productRoot, path.join(uploadStagingRoot, "product"), { recursive: true });
  await rm(path.join(uploadStagingRoot, "product", "Auto-SVGA-macOS-internal-runtime.zip"), { force: true });
  await mkdir(path.join(uploadStagingRoot, "app-manifest"), { recursive: true });
  for (const fileName of ["internal-trial-manifest.json", "macos-package-proof.json"]) {
    if (existsSync(path.join(trialRoot, fileName))) {
      await copyRequired(path.join(trialRoot, fileName), path.join(uploadStagingRoot, "app-manifest", fileName));
      await copyRequired(path.join(trialRoot, fileName), path.join(visibleRoot, "app-manifest", fileName));
    }
  }
  await copyRequired(path.join(productRoot, "artifact-index.json"), path.join(visibleRoot, "evidence-index.json"));
  await copyRequired(path.join(productRoot, "P6_EVIDENCE_INDEX.md"), path.join(visibleRoot, "P6_EVIDENCE_INDEX.md"));

  createCleanAppZip({ appBundle: trialApp, zipPath: appZipPath });
  const appZipIdentity = await fileIdentity(appZipPath);
  const appZipEntries = zipEntries(appZipPath);
  const relativeFinalResponse = finalResponseText({
    headShort,
    visibleRootAbs: visibleRoot,
    reviewZipName,
    appZipName,
    companionRequired: canonicalManifest.companionRequired === true,
    absoluteLinks: false
  });
  const clickableFinalResponse = finalResponseText({
    headShort,
    visibleRootAbs: visibleRoot,
    reviewZipName,
    appZipName,
    companionRequired: canonicalManifest.companionRequired === true,
    absoluteLinks: true
  });
  await writeFile(path.join(uploadStagingRoot, "FINAL_RESPONSE.txt"), relativeFinalResponse, "utf8");
  await writeFile(path.join(visibleRoot, "FINAL_RESPONSE.txt"), clickableFinalResponse, "utf8");
  await writeFile(path.join(uploadStagingRoot, "README.md"), [
    "# P6 Owner Review Upload",
    "",
    "Status: HUMAN_REQUIRED.",
    "This ZIP is portable and uses relative paths only.",
    ""
  ].join("\n"), "utf8");

  const manifestExtra = {
    reviewedHeadCommit: headCommit,
    companionRequired: canonicalManifest.companionRequired === true,
    finalPackagingGate,
    ownerReviewZip: reviewZipName,
    macosAppZip: {
      fileName: appZipName,
      sizeBytes: appZipIdentity.sizeBytes,
      sha256: appZipIdentity.sha256,
      entryCount: appZipEntries.length,
      distribution: {
        unsigned: true,
        notarized: false,
        productionApproved: false,
        internalOnly: true
      }
    },
    visibleHandoff: {
      canonicalPacketRoot: path.relative(visibleRoot, packetRoot).split(path.sep).join("/")
    }
  };

  let privacyAudit = {
    passed: false,
    findingCount: -1,
    actualZipEntryCount: 0,
    scannedEntryCount: 0,
    scannedTextEntryCount: 0,
    scannedBinaryEntryCount: 0,
    selfReferentialExclusions: []
  };
  for (const phase of ["pre-audit", "final-audit"]) {
    await writeFile(path.join(uploadStagingRoot, "MANIFEST.json"), `${JSON.stringify(await buildManifest(uploadStagingRoot, {
      ...manifestExtra,
      privacyAudit: {
        passed: privacyAudit.passed,
        findingCount: privacyAudit.findingCount,
        actualZipEntryCount: privacyAudit.actualZipEntryCount,
        scannedEntryCount: privacyAudit.scannedEntryCount,
        scannedTextEntryCount: privacyAudit.scannedTextEntryCount,
        scannedBinaryEntryCount: privacyAudit.scannedBinaryEntryCount,
        selfReferentialExclusionCount: privacyAudit.selfReferentialExclusions.length
      }
    }), null, 2)}\n`);
    const uploadEntries = (await listFiles(uploadStagingRoot)).map((filePath) => toBundlePath(uploadStagingRoot, filePath)).sort();
    await rm(reviewZipPath, { force: true });
    runZip({ cwd: uploadStagingRoot, zipPath: reviewZipPath, entries: uploadEntries });
    const reviewZipEntries = zipEntries(reviewZipPath);
    if (JSON.stringify(reviewZipEntries) !== JSON.stringify(uploadEntries)) {
      throw new Error("P6 owner review ZIP entries do not match staging files.");
    }
    privacyAudit = await buildPrivacyAudit({ stagingRoot: uploadStagingRoot, appZipPath, reviewZipPath });
    if (!privacyAudit.passed) {
      throw new Error(`P6 owner handoff privacy audit failed during ${phase}: ${privacyAudit.findings.map((finding) => `${finding.ruleId}:${finding.entry}`).join("; ")}`);
    }
    await writeFile(path.join(uploadStagingRoot, "bundle-privacy-audit.json"), `${JSON.stringify(privacyAudit, null, 2)}\n`);
    await writeFile(path.join(visibleRoot, "bundle-privacy-audit.json"), `${JSON.stringify(privacyAudit, null, 2)}\n`);
  }
  await writeFile(path.join(uploadStagingRoot, "MANIFEST.json"), `${JSON.stringify(await buildManifest(uploadStagingRoot, {
    ...manifestExtra,
    privacyAudit: {
      passed: privacyAudit.passed,
      findingCount: privacyAudit.findingCount,
      actualZipEntryCount: privacyAudit.actualZipEntryCount,
      scannedEntryCount: privacyAudit.scannedEntryCount,
      scannedTextEntryCount: privacyAudit.scannedTextEntryCount,
      scannedBinaryEntryCount: privacyAudit.scannedBinaryEntryCount,
      selfReferentialExclusionCount: privacyAudit.selfReferentialExclusions.length
    }
  }), null, 2)}\n`);
  let uploadEntries = (await listFiles(uploadStagingRoot)).map((filePath) => toBundlePath(uploadStagingRoot, filePath)).sort();
  await rm(reviewZipPath, { force: true });
  runZip({ cwd: uploadStagingRoot, zipPath: reviewZipPath, entries: uploadEntries });
  const verificationPrivacyAudit = await buildPrivacyAudit({ stagingRoot: uploadStagingRoot, appZipPath, reviewZipPath });
  if (!verificationPrivacyAudit.passed) {
    throw new Error(`P6 owner handoff final privacy audit failed: ${verificationPrivacyAudit.findings.map((finding) => `${finding.ruleId}:${finding.entry}`).join("; ")}`);
  }
  privacyAudit = verificationPrivacyAudit;
  await writeFile(path.join(uploadStagingRoot, "bundle-privacy-audit.json"), `${JSON.stringify(privacyAudit, null, 2)}\n`);
  await writeFile(path.join(visibleRoot, "bundle-privacy-audit.json"), `${JSON.stringify(privacyAudit, null, 2)}\n`);
  uploadEntries = (await listFiles(uploadStagingRoot)).map((filePath) => toBundlePath(uploadStagingRoot, filePath)).sort();
  await rm(reviewZipPath, { force: true });
  runZip({ cwd: uploadStagingRoot, zipPath: reviewZipPath, entries: uploadEntries });
  const reviewZipEntries = zipEntries(reviewZipPath);
  const reviewZipIdentity = await fileIdentity(reviewZipPath);

  await writeFile(path.join(visibleRoot, "README.md"), [
    "# P6 Owner Review Materials",
    "",
    "Open or upload the files in this visible folder. Hidden `.artifacts` paths are internal build outputs.",
    "",
    `- ${reviewZipName}: portable owner review ZIP.`,
    `- ${appZipName}: unsigned macOS internal App ZIP for testing.`,
    "- REVIEW_PACKET.md: byte-identical copy of the sealed canonical review packet.",
    "- FINAL_RESPONSE.txt: exact terminal response with clickable local file links.",
    ""
  ].join("\n"), "utf8");
  await writeFile(path.join(visibleRoot, "MANIFEST.json"), `${JSON.stringify(await buildManifest(visibleRoot, {
    ...manifestExtra,
    ownerReviewZip: {
      fileName: reviewZipName,
      sizeBytes: reviewZipIdentity.sizeBytes,
      sha256: reviewZipIdentity.sha256,
      entryCount: reviewZipEntries.length
    }
  }), null, 2)}\n`);

  const summary = {
    schemaVersion: 1,
    milestoneId,
    headCommit,
    visibleRoot: path.relative(repoRoot, visibleRoot).split(path.sep).join("/"),
    reviewZip: {
      fileName: reviewZipName,
      sizeBytes: reviewZipIdentity.sizeBytes,
      sha256: reviewZipIdentity.sha256,
      entryCount: reviewZipEntries.length
    },
    macosAppZip: {
      fileName: appZipName,
      sizeBytes: appZipIdentity.sizeBytes,
      sha256: appZipIdentity.sha256,
      productionApproved: false
    },
    companionRequired: canonicalManifest.companionRequired === true,
    finalPackagingGate,
    privacyAudit: {
      passed: privacyAudit.passed,
      findingCount: privacyAudit.findingCount
    }
  };
  console.log(`AUTO_SVGA_P6_OWNER_HANDOFF_RESULT=${JSON.stringify(summary)}`);
}

const isDirectRun = process.argv[1]
  && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isDirectRun) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.stack ?? error.message : String(error));
    process.exitCode = 1;
  });
}
