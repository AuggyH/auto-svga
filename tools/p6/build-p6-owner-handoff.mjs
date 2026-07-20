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
const milestoneId = "P6-R1";
const productEvidenceMilestoneId = "P6";
const productRoot = path.join(repoRoot, ".artifacts/product/P6");
const packetRoot = path.join(repoRoot, ".artifacts/loop-handoff/latest");
const trialRoot = path.join(repoRoot, "tools/electron-prototype/experiments/svga-web/.artifacts/internal-trial");
const trialApp = path.join(trialRoot, "Auto SVGA-darwin-arm64/Auto SVGA.app");
const uploadStagingRoot = path.join(repoRoot, ".artifacts/product/P6-R1-owner-review-upload");
const completeDirectoryStagingRoot = path.join(repoRoot, ".artifacts/product/P6-R1-complete-review-directory");
const parityReportPath = path.join(productRoot, "p6-parity-report.json");
const trackedWorkerRegistryPath = path.join(repoRoot, "docs/product/p6/P6_WORKER_REGISTRY.json");
const workerRegistryFinalPath = path.join(productRoot, "worker-registry-final.json");
const workerRegistryFinalRepoPath = ".artifacts/product/P6/worker-registry-final.json";
const sidecarNamePrefix = "P6-R1-owner-upload-sidecar";
const ownerFeedbackClosureMapName = "OWNER_FEEDBACK_CLOSURE_MAP.json";
const loopValidationRoot = path.join(repoRoot, ".artifacts/loop-validation");
const finalLoopValidationEvidenceFiles = [
  ["final-loop-validation/run-1.json", path.join(loopValidationRoot, "p6-r1-final-run-1.json")],
  ["final-loop-validation/run-2.json", path.join(loopValidationRoot, "p6-r1-final-run-2.json")]
];
const appBundleBindingEntries = [
  "Auto SVGA.app/Contents/Info.plist",
  "Auto SVGA.app/Contents/MacOS/Auto SVGA",
  "Auto SVGA.app/Contents/Resources/app.asar"
];
const contractRevision = 3;
const repairRound = 0;
const phase2Started = false;

const sealedEvidenceFiles = [
  "validation.json",
  "budget-check.json",
  "reviewer-a.json",
  "reviewer-b.json"
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

function findStaleReviewRootReferences(text, entry, expectedHeadShort) {
  if (!expectedHeadShort) return [];
  const findings = [];
  for (const match of text.matchAll(/\breview\/(P6-R1|P6)-([A-Za-z0-9][A-Za-z0-9._-]*)/g)) {
    if (isDeletedPatchLine(text, match.index, entry)) {
      continue;
    }
    if (entry.endsWith("REVIEW_PACKET.md") && isInsideFencedDiffBlock(text, match.index)) {
      continue;
    }
    if (isInsideOwnerHandoffPrivacyTestPatch(text, match.index, entry)) {
      continue;
    }
    if (isInsideReviewRootTemplatePatch(text, match.index, entry)) {
      continue;
    }
    const trailingTemplateContext = text.slice(match.index + match[0].length, match.index + match[0].length + 32);
    if (match[0] === "review/P6-R1-" && trailingTemplateContext.startsWith("${headShort}")) {
      continue;
    }
    if (match[1] !== milestoneId || match[2] !== expectedHeadShort) {
      findings.push({
        ruleId: "STALE_REVIEW_ROOT_REFERENCE",
        entry,
        expectedReviewRoot: `review/${milestoneId}-${expectedHeadShort}`,
        valueSha256: sha256Bytes(Buffer.from(match[0]))
      });
    }
  }
  return findings;
}

function isDeletedPatchLine(text, index, entry) {
  if (!entry.endsWith("changes.patch")) return false;
  const lineStart = text.lastIndexOf("\n", index) + 1;
  const lineEndIndex = text.indexOf("\n", index);
  const lineEnd = lineEndIndex === -1 ? text.length : lineEndIndex;
  const line = text.slice(lineStart, lineEnd);
  return line.startsWith("-") && !line.startsWith("---");
}

function isInsideOwnerHandoffPrivacyTestPatch(text, index, entry) {
  if (!entry.endsWith("changes.patch")) return false;
  const filePath = patchFilePathAt(text, index);
  if (filePath !== "tools/p6-owner-handoff-package.test.mjs") return false;
  const lineStart = text.lastIndexOf("\n", index) + 1;
  const lineEndIndex = text.indexOf("\n", index);
  const lineEnd = lineEndIndex === -1 ? text.length : lineEndIndex;
  const line = text.slice(lineStart, lineEnd);
  return /^[+-]/.test(line) && (
    line.includes("staleP6R1ReviewRoot")
    || line.includes("staleLegacyReviewRoot")
    || line.includes("review/P6-R1-abcdef0")
    || line.includes("review/P6-R1-deadbee")
  );
}

function isInsideReviewRootTemplatePatch(text, index, entry) {
  if (!entry.endsWith("changes.patch")) return false;
  const filePath = patchFilePathAt(text, index);
  const lineStart = text.lastIndexOf("\n", index) + 1;
  const lineEndIndex = text.indexOf("\n", index);
  const lineEnd = lineEndIndex === -1 ? text.length : lineEndIndex;
  const line = text.slice(lineStart, lineEnd);
  if (filePath === "tools/p6/build-p6-owner-handoff.mjs" && /^[+-]/.test(line) && (
    line.includes('line.includes("review/P6-R1-abcdef0")')
    || line.includes('line.includes("review/P6-R1-deadbee")')
  )) {
    return true;
  }
  return /^[+-]/.test(line) && (
    line.includes("${headShort}")
    || line.includes("${expectedHeadShort}")
  );
}

function patchFilePathAt(text, index) {
  const before = text.slice(0, index);
  const matches = [...before.matchAll(/^diff --git a\/(.+?) b\/(.+?)$/gm)];
  if (matches.length === 0) return null;
  const last = matches[matches.length - 1];
  return last?.[2] ?? null;
}

function isInsideFencedDiffBlock(text, index) {
  const before = text.slice(0, index);
  const fenceMatches = [...before.matchAll(/^```([A-Za-z0-9_-]*)[^\n]*$/gm)];
  if (fenceMatches.length === 0) return false;
  const lastFence = fenceMatches[fenceMatches.length - 1];
  if (!lastFence) return false;
  const fenceLanguage = (lastFence[1] ?? "").toLowerCase();
  return fenceLanguage === "diff";
}

function findPrivacyMatches(text, entry, { expectedHeadShort } = {}) {
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
  findings.push(...findStaleReviewRootReferences(text, entry, expectedHeadShort));
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

function relativeRepoPath(filePath) {
  return path.relative(repoRoot, filePath).split(path.sep).join("/");
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

function scanEntryBytes({ bytes, entry, ext, expectedHeadShort }) {
  const findings = [];
  if (textExtensions.has(ext) || looksText(bytes)) {
    findings.push(...findPrivacyMatches(bytes.toString("utf8"), `zip-text:${entry}`, { expectedHeadShort }));
    return { kind: "text", findings };
  }
  const extractable = [
    ...extractAsciiStrings(bytes),
    ...extractUtf16LeStrings(bytes),
    ...pngMetadataStrings(bytes)
  ].join("\n");
  if (extractable) findings.push(...findPrivacyMatches(extractable, `zip-binary-strings:${entry}`, { expectedHeadShort }));
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

function presentHeadValues(entries) {
  return entries.filter((entry) => typeof entry.value === "string" && entry.value.length > 0);
}

function validateHeadValues({ errors, headCommit, label, entries }) {
  const present = presentHeadValues(entries);
  if (present.length === 0) {
    errors.push(`${label} does not record a source head commit`);
    return null;
  }
  for (const entry of present) {
    if (entry.value !== headCommit) {
      errors.push(`${label} ${entry.name} ${entry.value} does not match current head ${headCommit}`);
    }
  }
  return present[0]?.value ?? null;
}

export function validateFinalPackagingGate({
  headCommit,
  canonicalManifest,
  parityReport,
  appProof,
  internalTrialManifest,
  macosPackageProof
}) {
  const errors = [];
  const packetHead = headFromCanonicalManifest(canonicalManifest);
  const parityHead = parityReport?.source?.headCommit ?? parityReport?.headCommit ?? null;

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
  const appProofHead = appProof === undefined ? null : validateHeadValues({
    errors,
    headCommit,
    label: "normal App proof",
    entries: [
      { name: "headCommit", value: appProof?.headCommit },
      { name: "normalVisibleStartup.headCommit", value: appProof?.normalVisibleStartup?.headCommit },
      { name: "normalVisibleStartup.runtimeIdentity.headCommit", value: appProof?.normalVisibleStartup?.runtimeIdentity?.headCommit },
      { name: "runtimeIdentity.headCommit", value: appProof?.runtimeIdentity?.headCommit }
    ]
  });
  const internalTrialHead = internalTrialManifest === undefined ? null : validateHeadValues({
    errors,
    headCommit,
    label: "internal trial manifest",
    entries: [
      { name: "buildCommit", value: internalTrialManifest?.buildCommit },
      { name: "headCommit", value: internalTrialManifest?.headCommit }
    ]
  });
  const macosPackageProofHead = macosPackageProof === undefined ? null : validateHeadValues({
    errors,
    headCommit,
    label: "macOS package proof",
    entries: [
      { name: "buildCommit", value: macosPackageProof?.buildCommit },
      { name: "headCommit", value: macosPackageProof?.headCommit }
    ]
  });

  return {
    passed: errors.length === 0,
    headCommit,
    packetHeadCommit: packetHead,
    parityReportHeadCommit: parityHead,
    appProofHeadCommit: appProofHead,
    internalTrialManifestHeadCommit: internalTrialHead,
    macosPackageProofHeadCommit: macosPackageProofHead,
    parityJudgment: "not_evaluated_by_A5",
    errors
  };
}

async function assertFinalPackagingGate({ headCommit, canonicalManifest }) {
  if (!existsSync(parityReportPath)) {
    throw new Error(`P6 final packaging gate blocked: missing parity report ${parityReportPath}`);
  }
  const parityReport = JSON.parse(await readFile(parityReportPath, "utf8"));
  const requiredAppFiles = [
    ["normal App proof", path.join(productRoot, "packaged-app-runtime-proof.json")],
    ["internal trial manifest", path.join(productRoot, "internal-trial-manifest.json")],
    ["macOS package proof", path.join(trialRoot, "macos-package-proof.json")]
  ];
  for (const [label, filePath] of requiredAppFiles) {
    if (!existsSync(filePath)) {
      throw new Error(`P6 final packaging gate blocked: missing ${label} ${filePath}`);
    }
  }
  const gate = validateFinalPackagingGate({
    headCommit,
    canonicalManifest,
    parityReport,
    appProof: JSON.parse(await readFile(path.join(productRoot, "packaged-app-runtime-proof.json"), "utf8")),
    internalTrialManifest: JSON.parse(await readFile(path.join(productRoot, "internal-trial-manifest.json"), "utf8")),
    macosPackageProof: JSON.parse(await readFile(path.join(trialRoot, "macos-package-proof.json"), "utf8"))
  });
  if (!gate.passed) {
    throw new Error(`P6 final packaging gate blocked: ${gate.errors.join("; ")}`);
  }
  return {
    passed: true,
    packetHeadCommit: gate.packetHeadCommit,
    parityReportHeadCommit: gate.parityReportHeadCommit,
    appProofHeadCommit: gate.appProofHeadCommit,
    internalTrialManifestHeadCommit: gate.internalTrialManifestHeadCommit,
    macosPackageProofHeadCommit: gate.macosPackageProofHeadCommit,
    parityJudgment: gate.parityJudgment,
    parityReportPath: path.relative(repoRoot, parityReportPath).split(path.sep).join("/")
  };
}

async function assertFinalLoopValidationEvidence({ headCommit }) {
  const runs = [];
  const errors = [];
  for (const [bundlePath, filePath] of finalLoopValidationEvidenceFiles) {
    if (!existsSync(filePath)) {
      errors.push(`missing final loop validation artifact ${relativeRepoPath(filePath)}`);
      continue;
    }
    const payload = JSON.parse(await readFile(filePath, "utf8"));
    const identity = await fileIdentity(filePath);
    const run = {
      bundlePath,
      sourcePath: relativeRepoPath(filePath),
      status: payload.status ?? null,
      repositoryHeadCommitAtStart: payload.repositoryHeadCommitAtStart ?? null,
      repositoryHeadCommitAtFinish: payload.repositoryHeadCommitAtFinish ?? null,
      sourceWorkspaceCleanAtStart: payload.sourceWorkspaceCleanAtStart === true,
      sourceWorkspaceCleanAtFinish: payload.sourceWorkspaceCleanAtFinish === true,
      sizeBytes: identity.sizeBytes,
      sha256: identity.sha256
    };
    if (run.status !== "pass") errors.push(`${bundlePath} status must be pass`);
    if (run.repositoryHeadCommitAtStart !== headCommit || run.repositoryHeadCommitAtFinish !== headCommit) {
      errors.push(`${bundlePath} must bind start and finish to ${headCommit}`);
    }
    if (run.sourceWorkspaceCleanAtStart !== true || run.sourceWorkspaceCleanAtFinish !== true) {
      errors.push(`${bundlePath} must record clean source workspace at start and finish`);
    }
    runs.push(run);
  }
  return {
    passed: errors.length === 0 && runs.length === finalLoopValidationEvidenceFiles.length,
    requiredRunCount: finalLoopValidationEvidenceFiles.length,
    command: "npm run loop:validate",
    runs,
    errors
  };
}

function manifestEntryFor(manifest, fileName) {
  return (manifest?.entries ?? []).find((entry) => entry.path === fileName) ?? null;
}

function validSha256(value) {
  return typeof value === "string" && /^[a-f0-9]{64}$/i.test(value);
}

function validSize(value) {
  return Number.isInteger(value) && value > 0;
}

function validateManifestIdentity(errors, label, entry, record) {
  if (!entry) return;
  if (!validSize(entry.sizeBytes)) {
    errors.push(`${label} manifest entry sizeBytes missing`);
  }
  if (!validSha256(entry.sha256)) {
    errors.push(`${label} manifest entry sha256 missing`);
  }
  if (record !== undefined) {
    if (!validSize(record?.sizeBytes)) {
      errors.push(`${label} record sizeBytes missing`);
    } else if (validSize(entry.sizeBytes) && entry.sizeBytes !== record.sizeBytes) {
      errors.push(`${label} record sizeBytes does not match manifest entry`);
    }
    if (!validSha256(record?.sha256)) {
      errors.push(`${label} record sha256 missing`);
    } else if (validSha256(entry.sha256) && entry.sha256 !== record.sha256) {
      errors.push(`${label} record sha256 does not match manifest entry`);
    }
  }
}

function validateSameFileIdentity(errors, label, left, right) {
  if (left === undefined || right === undefined) return;
  if (left?.fileName !== undefined && right?.fileName !== undefined && left.fileName !== right.fileName) {
    errors.push(`${label} fileName mismatch`);
  }
  if (validSize(left?.sizeBytes) && validSize(right?.sizeBytes) && left.sizeBytes !== right.sizeBytes) {
    errors.push(`${label} sizeBytes mismatch`);
  }
  if (validSha256(left?.sha256) && validSha256(right?.sha256) && left.sha256 !== right.sha256) {
    errors.push(`${label} sha256 mismatch`);
  }
}

export function validateOwnerVisibleHandoffBinding({
  headCommit,
  manifest,
  reviewZipName,
  appZipName,
  sidecarName,
  reviewPacketText,
  finalResponseText,
  sidecar,
  postSealVerification
}) {
  const errors = [];
  if (manifest?.reviewedHeadCommit !== headCommit) {
    errors.push(`owner-visible manifest reviewed head ${manifest?.reviewedHeadCommit ?? "missing"} does not match current head ${headCommit}`);
  }
  if (manifest?.milestoneId !== milestoneId) {
    errors.push(`owner-visible manifest milestoneId ${manifest?.milestoneId ?? "missing"} must be ${milestoneId}`);
  }
  if (manifest?.companionRequired !== true) {
    errors.push("owner-visible manifest must require App ZIP and sidecar companions");
  }
  const companions = new Set(manifest?.mandatoryCompanions ?? []);
  if (!companions.has(appZipName)) {
    errors.push(`owner-visible manifest mandatoryCompanions missing ${appZipName}`);
  }
  if (!companions.has(sidecarName)) {
    errors.push(`owner-visible manifest mandatoryCompanions missing ${sidecarName}`);
  }
  if (manifest?.privacyAudit?.passed !== true || manifest?.privacyAudit?.findingCount !== 0) {
    errors.push("owner-visible manifest privacy audit must pass with zero findings");
  }
  if (manifest?.finalLoopValidation?.passed !== true || manifest.finalLoopValidation.requiredRunCount !== 2) {
    errors.push("owner-visible manifest must include two final loop validation runs");
  }
  if (manifest?.appBundleBinding?.passed !== true) {
    errors.push("owner-visible manifest must bind App ZIP to internal package proof");
  }

  const reviewEntry = manifestEntryFor(manifest, reviewZipName);
  const reviewZip = manifest?.ownerReviewZip;
  if (reviewZip?.fileName !== reviewZipName) {
    errors.push(`owner review ZIP fileName ${reviewZip?.fileName ?? "missing"} does not match ${reviewZipName}`);
  }
  if (!reviewEntry) {
    errors.push(`owner review ZIP entry ${reviewZipName} is missing from owner-visible manifest entries`);
  } else if (validSha256(reviewZip?.sha256) && reviewEntry.sha256 !== reviewZip.sha256) {
    errors.push("owner review ZIP manifest entry hash does not match ownerReviewZip hash");
  }
  validateManifestIdentity(errors, "owner review ZIP", reviewEntry, reviewZip);

  const appEntry = manifestEntryFor(manifest, appZipName);
  const appZip = manifest?.macosAppZip;
  if (appZip?.fileName !== appZipName) {
    errors.push(`App ZIP fileName ${appZip?.fileName ?? "missing"} does not match ${appZipName}`);
  }
  if (!appEntry) {
    errors.push(`App ZIP entry ${appZipName} is missing from owner-visible manifest entries`);
  } else if (validSha256(appZip?.sha256) && appEntry.sha256 !== appZip.sha256) {
    errors.push("App ZIP manifest entry hash does not match macosAppZip hash");
  }
  validateManifestIdentity(errors, "App ZIP", appEntry, appZip);

  const sidecarEntry = manifestEntryFor(manifest, sidecarName);
  const sidecarManifest = manifest?.ownerUploadSidecar;
  if (sidecarManifest?.fileName !== sidecarName) {
    errors.push(`owner upload sidecar fileName ${sidecarManifest?.fileName ?? "missing"} does not match ${sidecarName}`);
  }
  if (!sidecarEntry) {
    errors.push(`owner upload sidecar entry ${sidecarName} is missing from owner-visible manifest entries`);
  } else if (validSha256(sidecarManifest?.sha256) && sidecarEntry.sha256 !== sidecarManifest.sha256) {
    errors.push("owner upload sidecar manifest entry hash does not match ownerUploadSidecar hash");
  }
  validateManifestIdentity(errors, "owner upload sidecar", sidecarEntry, sidecarManifest);

  for (const requiredPath of ["REVIEW_PACKET.md", "FINAL_RESPONSE.txt", "bundle-privacy-audit.json", "worker-registry-final.json", "owner-upload-post-seal-verification.json"]) {
    if (!manifestEntryFor(manifest, requiredPath)) {
      errors.push(`owner-visible manifest missing required entry ${requiredPath}`);
    }
  }
  const humanReviewEntries = (manifest?.entries ?? []).filter((entry) => entry.humanReviewRequired === true);
  if (humanReviewEntries.length !== manifest?.entries?.length) {
    errors.push("owner-visible manifest must mark every payload as humanReviewRequired");
  }
  if (manifest?.humanReviewRequiredCount !== humanReviewEntries.length) {
    errors.push("owner-visible manifest humanReviewRequiredCount does not match entries");
  }
  if (typeof reviewPacketText === "string") {
    if (/companionRequired:\s*false/.test(reviewPacketText)) {
      errors.push("owner REVIEW_PACKET.md must not declare companionRequired false");
    }
    if (/mandatoryCompanions:\s*\[\s*\]/.test(reviewPacketText)) {
      errors.push("owner REVIEW_PACKET.md must not declare empty mandatoryCompanions");
    }
    if (/fullP6Regression:\s*`?failed`?/i.test(reviewPacketText)) {
      errors.push("owner REVIEW_PACKET.md must not present stale fullP6Regression failed as current status");
    }
    if (/productOwnerHumanGateReachable:\s*`?false`?/i.test(reviewPacketText)) {
      errors.push("owner REVIEW_PACKET.md must not present Product Owner Human Gate as unreachable");
    }
    for (const requiredName of [reviewZipName, appZipName, sidecarName]) {
      if (!reviewPacketText.includes(requiredName)) {
        errors.push(`owner REVIEW_PACKET.md missing upload artifact ${requiredName}`);
      }
    }
  }
  if (typeof finalResponseText === "string") {
    for (const requiredName of [reviewZipName, appZipName, sidecarName]) {
      if (!finalResponseText.includes(requiredName)) {
        errors.push(`FINAL_RESPONSE.txt missing upload artifact ${requiredName}`);
      }
    }
  }
  if (sidecar !== undefined) {
    if (sidecar?.reviewedHeadCommit !== headCommit) errors.push("owner sidecar reviewed head mismatch");
    if (sidecar?.companionRequired !== true) errors.push("owner sidecar must require App ZIP and sidecar companions");
    const sidecarCompanions = new Set(sidecar?.mandatoryCompanions ?? []);
    if (!sidecarCompanions.has(appZipName) || !sidecarCompanions.has(sidecarName)) {
      errors.push("owner sidecar mandatoryCompanions must include App ZIP and sidecar");
    }
    if (sidecar?.ownerReviewZip?.fileName !== reviewZipName) errors.push("owner sidecar review ZIP fileName mismatch");
    if (sidecar?.macosAppZip?.fileName !== appZipName) errors.push("owner sidecar App ZIP fileName mismatch");
    validateSameFileIdentity(errors, "owner sidecar review ZIP", sidecar.ownerReviewZip, reviewZip);
    validateSameFileIdentity(errors, "owner sidecar App ZIP", sidecar.macosAppZip, appZip);
    if (sidecar?.ownerUploadSet?.companionRequired !== true) errors.push("owner sidecar upload set must require companions");
    const sidecarUploadSet = new Set(sidecar?.ownerUploadSet?.exactFileNames ?? []);
    for (const requiredName of [reviewZipName, appZipName, sidecarName]) {
      if (!sidecarUploadSet.has(requiredName)) errors.push(`owner sidecar upload set missing ${requiredName}`);
    }
    if (!validSha256(sidecar?.ownerReviewZip?.manifestSha256) || sidecar.ownerReviewZip.manifestSha256 !== sidecar?.ownerUploadSet?.reviewZipManifestSha256) {
      errors.push("owner sidecar review ZIP manifest hash mismatch");
    }
    if (sidecar?.appBundleBinding?.passed !== true) errors.push("owner sidecar App ZIP must be bound to internal package proof");
    if (sidecar?.finalLoopValidation?.passed !== true || sidecar.finalLoopValidation.requiredRunCount !== 2) {
      errors.push("owner sidecar must include two final loop validations");
    }
    if (sidecar?.privacyAudit?.passed !== true || sidecar?.privacyAudit?.findingCount !== 0) {
      errors.push("owner sidecar privacy audit must pass with zero findings");
    }
  }
  if (postSealVerification !== undefined) {
    if (postSealVerification?.reviewedHeadCommit !== headCommit) errors.push("owner post-seal reviewed head mismatch");
    if (postSealVerification?.passed !== true) errors.push("owner post-seal verification must pass");
    if (postSealVerification?.reviewZip?.fileName !== reviewZipName) errors.push("owner post-seal review ZIP fileName mismatch");
    if (postSealVerification?.macosAppZip?.fileName !== appZipName) errors.push("owner post-seal App ZIP fileName mismatch");
    if (postSealVerification?.ownerUploadSidecar?.fileName !== sidecarName) errors.push("owner post-seal sidecar fileName mismatch");
    if (postSealVerification?.assertions?.noMacosxMetadata !== true) errors.push("owner post-seal must verify no forbidden macOS metadata");
    if (postSealVerification?.assertions?.sameFinalHead !== true) errors.push("owner post-seal must verify same final head");
    if (postSealVerification?.assertions?.appZipBoundToInternalPackageProof !== true) {
      errors.push("owner post-seal must verify App ZIP is bound to internal package proof");
    }
    if (postSealVerification?.assertions?.finalLoopValidationIncluded !== true) {
      errors.push("owner post-seal must verify two final loop validations are included");
    }
    if (postSealVerification?.appBundleBinding?.passed !== true) errors.push("owner post-seal App ZIP package-proof binding must pass");
    if (postSealVerification?.finalLoopValidation?.passed !== true || postSealVerification.finalLoopValidation.requiredRunCount !== 2) {
      errors.push("owner post-seal final loop validation evidence must pass twice");
    }
    const postSealUploadSet = new Set(postSealVerification?.ownerUploadSet?.exactFileNames ?? []);
    for (const requiredName of [reviewZipName, appZipName, sidecarName]) {
      if (!postSealUploadSet.has(requiredName)) errors.push(`owner post-seal upload set missing ${requiredName}`);
    }
    validateSameFileIdentity(errors, "owner post-seal review ZIP", postSealVerification.reviewZip, reviewZip);
    validateSameFileIdentity(errors, "owner post-seal App ZIP", postSealVerification.macosAppZip, appZip);
    validateSameFileIdentity(errors, "owner post-seal sidecar", postSealVerification.ownerUploadSidecar, sidecarManifest);
    if (sidecar !== undefined) {
      validateSameFileIdentity(errors, "owner post-seal sidecar review ZIP", postSealVerification.reviewZip, sidecar.ownerReviewZip);
      validateSameFileIdentity(errors, "owner post-seal sidecar App ZIP", postSealVerification.macosAppZip, sidecar.macosAppZip);
    }
    for (const section of ["reviewZip", "macosAppZip", "ownerUploadSidecar"]) {
      const record = postSealVerification?.[section];
      if (!validSha256(record?.sha256)) {
        errors.push(`owner post-seal ${section} sha256 missing`);
      }
      if (!Number.isInteger(record?.sizeBytes) || record.sizeBytes <= 0) {
        errors.push(`owner post-seal ${section} sizeBytes missing`);
      }
    }
    for (const [section, fileName] of [["reviewerA", "reviewer-a.json"], ["reviewerB", "reviewer-b.json"]]) {
      const record = postSealVerification?.reviewerVerdicts?.[section];
      if (record?.fileName !== fileName) {
        errors.push(`owner post-seal ${section} fileName mismatch`);
      }
      if (!validSha256(record?.sha256)) {
        errors.push(`owner post-seal ${section} sha256 missing`);
      }
      if (!Number.isInteger(record?.sizeBytes) || record.sizeBytes <= 0) {
        errors.push(`owner post-seal ${section} sizeBytes missing`);
      }
    }
  }

  return {
    passed: errors.length === 0,
    headCommit,
    reviewZipName,
    appZipName,
    sidecarName,
    errors
  };
}

export function validateWorkerRegistryFinal({ headCommit, trackedRegistrySha256, trackedRegistry }) {
  const errors = [];
  const binding = trackedRegistry?.finalHeadBinding ?? {};
  if (binding.path !== workerRegistryFinalRepoPath) {
    errors.push(`tracked registry finalHeadBinding.path must be ${workerRegistryFinalRepoPath}`);
  }
  if (binding.source !== "ignored_generated_artifact") {
    errors.push("tracked registry finalHeadBinding.source must be ignored_generated_artifact");
  }
  if (binding.actualFinalHeadCommitMustEqualGitHead !== true) {
    errors.push("tracked registry must require actual final head to equal git HEAD");
  }
  if (binding.trackedRegistryDoesNotClaimFinalHead !== true) {
    errors.push("tracked registry must declare that it does not claim the final head");
  }
  for (const field of ["currentIntegrationHeadCommit", "expectedFinalHeadCommit", "terminalHandoffReady"]) {
    if (Object.hasOwn(trackedRegistry ?? {}, field)) {
      errors.push(`tracked registry must not claim ${field}; use ${workerRegistryFinalRepoPath}`);
    }
  }
  return {
    passed: errors.length === 0,
    headCommit,
    trackedRegistrySha256,
    trackedRegistryPath: "docs/product/p6/P6_WORKER_REGISTRY.json",
    generatedRegistryPath: workerRegistryFinalRepoPath,
    errors
  };
}

async function writeWorkerRegistryFinal({ headCommit }) {
  const trackedRegistryText = await readFile(trackedWorkerRegistryPath, "utf8");
  const trackedRegistrySha256 = sha256Bytes(Buffer.from(trackedRegistryText));
  const trackedRegistry = JSON.parse(trackedRegistryText);
  const validation = validateWorkerRegistryFinal({ headCommit, trackedRegistrySha256, trackedRegistry });
  if (!validation.passed) {
    throw new Error(`P6 final worker registry gate blocked: ${validation.errors.join("; ")}`);
  }
  const payload = {
    schemaVersion: 1,
    milestoneId,
    generatedAt: "stable-p6-owner-handoff",
    finalSourceHeadCommit: headCommit,
    actualGitHeadCommit: headCommit,
    trackedRegistry: {
      path: validation.trackedRegistryPath,
      sha256: trackedRegistrySha256,
      schemaVersion: trackedRegistry.schemaVersion ?? null,
      currentRepairRound: trackedRegistry.currentRepairRound ?? null,
      lifecycleStatus: trackedRegistry.lifecycleStatus ?? null,
      integrationBaseCommit: trackedRegistry.integrationBaseCommit ?? null,
      finalHeadBinding: trackedRegistry.finalHeadBinding ?? null
    },
    assertions: {
      actualFinalHeadCommitEqualsGitHead: true,
      trackedRegistryDoesNotClaimFinalHead: true,
      packageGeneratedAfterFinalSourceCommit: true
    }
  };
  await mkdir(path.dirname(workerRegistryFinalPath), { recursive: true });
  await writeFile(workerRegistryFinalPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  return {
    ...validation,
    sizeBytes: (await stat(workerRegistryFinalPath)).size,
    sha256: await sha256File(workerRegistryFinalPath)
  };
}

export function validateZipEntriesIndexed({ entries, manifestEntries }) {
  const entrySet = new Set(entries);
  const manifestSet = new Set(manifestEntries.map((entry) => entry.path));
  const unindexedEntries = entries.filter((entry) => entry !== "MANIFEST.json" && !manifestSet.has(entry));
  const missingIndexedEntries = [...manifestSet].filter((entry) => !entrySet.has(entry));
  return {
    passed: unindexedEntries.length === 0 && missingIndexedEntries.length === 0,
    unindexedEntries,
    missingIndexedEntries
  };
}

export async function validateManifestPayloadHashes({ root, manifest }) {
  const errors = [];
  for (const entry of manifest.entries ?? []) {
    const filePath = path.join(root, entry.path);
    if (!existsSync(filePath)) {
      errors.push(`${entry.path} missing on disk`);
      continue;
    }
    const identity = await fileIdentity(filePath);
    if (identity.sizeBytes !== entry.sizeBytes) {
      errors.push(`${entry.path} size mismatch`);
    }
    if (identity.sha256 !== entry.sha256) {
      errors.push(`${entry.path} sha256 mismatch`);
    }
  }
  return {
    passed: errors.length === 0,
    errors
  };
}

export function buildZipPrivacyAudit({
  reviewZipPath,
  appZipPath,
  extraZipPaths = [],
  selfReferentialEntryNames = ["bundle-privacy-audit.json"],
  expectedHeadShort
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
      findings.push(...findPrivacyMatches(entry, `zip-entry:${zipRole}:${entry}`, { expectedHeadShort }));
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
      const scan = scanEntryBytes({ bytes, entry: `${zipRole}:${entry}`, ext: path.extname(entry).toLowerCase(), expectedHeadShort });
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

async function buildPrivacyAudit({ stagingRoot, appZipPath, reviewZipPath, expectedHeadShort, skipZipPaths = [] }) {
  const findings = [];
  const scannedEntries = [];
  const stagingFiles = await listFiles(stagingRoot);
  const extraZipPaths = [];
  const skipZipPathSet = new Set(skipZipPaths.map((filePath) => path.resolve(filePath)));
  for (const filePath of stagingFiles) {
    const bundlePath = toBundlePath(stagingRoot, filePath);
    if (path.extname(filePath).toLowerCase() === ".zip" && !skipZipPathSet.has(path.resolve(filePath))) {
      extraZipPaths.push({ zipRole: zipRoleForBundlePath(bundlePath), zipPath: filePath });
    }
    findings.push(...findPrivacyMatches(bundlePath, `entry:${bundlePath}`, { expectedHeadShort }));
    const ext = path.extname(filePath).toLowerCase();
    if (!textExtensions.has(ext)) continue;
    scannedEntries.push(bundlePath);
    findings.push(...findPrivacyMatches(await readFile(filePath, "utf8"), bundlePath, { expectedHeadShort }));
  }
  const zipAudit = buildZipPrivacyAudit({ reviewZipPath, appZipPath, extraZipPaths, expectedHeadShort });
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
      sha256: await sha256File(filePath),
      humanReviewRequired: true
    });
  }
  const sortedEntries = entries.sort((left, right) => left.path.localeCompare(right.path));
  return {
    schemaVersion: 1,
    milestoneId,
    generatedAt: "stable-p6-owner-handoff",
    ...extra,
    humanReviewRequiredCount: sortedEntries.filter((entry) => entry.humanReviewRequired === true).length,
    entries: sortedEntries
  };
}

function assertNoForbiddenZipMetadata(zipPath, label) {
  const badEntries = zipEntries(zipPath).filter((entry) => entry.includes("__MACOSX") || path.basename(entry) === ".DS_Store");
  if (badEntries.length) {
    throw new Error(`${label} contains forbidden archive metadata: ${badEntries.slice(0, 5).join(", ")}`);
  }
}

function zipEntryListReport(zipPath) {
  const entries = zipEntries(zipPath);
  const files = [];
  for (const entry of entries) {
    const directory = entry.endsWith("/");
    let sizeBytes = null;
    let sha256 = null;
    if (!directory) {
      const bytes = zipEntryBytes(zipPath, entry);
      sizeBytes = bytes.byteLength;
      sha256 = sha256Bytes(bytes);
    }
    files.push({
      path: entry,
      directory,
      sizeBytes,
      sha256
    });
  }
  return {
    schemaVersion: 1,
    milestoneId,
    entryCount: entries.length,
    noMacosxMetadata: entries.every((entry) => !entry.includes("__MACOSX")),
    noDsStore: entries.every((entry) => path.basename(entry) !== ".DS_Store"),
    entries: files
  };
}

async function writeJsonFile(filePath, payload) {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
}

function uploadRecord({
  role,
  required,
  fileName,
  relativePath,
  sizeBytes,
  sha256,
  entryCount,
  finalHead,
  finalTree,
  productionApproved = false,
  notes
}) {
  return {
    role,
    required,
    fileName,
    relativePath,
    sizeBytes,
    sha256,
    entryCount,
    finalHead,
    finalTree,
    milestoneId,
    contractRevision,
    repairRound,
    phase2Started,
    productionApproved,
    ...(notes ? { notes } : {})
  };
}

async function fileUploadRecord({ role, required = true, root, relativePath, finalHead, finalTree, entryCount = null, notes }) {
  const filePath = path.join(root, relativePath);
  const identity = await fileIdentity(filePath);
  return uploadRecord({
    role,
    required,
    fileName: path.basename(relativePath),
    relativePath,
    sizeBytes: identity.sizeBytes,
    sha256: identity.sha256,
    entryCount,
    finalHead,
    finalTree,
    notes
  });
}

async function writeSha256Sums({ root, excluded = [] }) {
  const excludedSet = new Set(excluded);
  const rows = [];
  for (const filePath of await listFiles(root)) {
    const bundlePath = toBundlePath(root, filePath);
    if (excludedSet.has(bundlePath)) continue;
    rows.push(`${await sha256File(filePath)}  ${bundlePath}`);
  }
  rows.sort();
  await mkdir(path.join(root, "hashes"), { recursive: true });
  await writeFile(path.join(root, "hashes/sha256sums.txt"), `${rows.join("\n")}\n`, "utf8");
}

function completeDirectoryReadme({ completeZipName, reviewZipName, appZipName, sidecarName }) {
  return [
    "# P6-R1 Complete Review Directory",
    "",
    `Upload only \`${completeZipName}\` to the review assistant.`,
    "",
    "Do not manually re-compress this folder in Finder. This archive is generated by Auto-SVGA tooling with deterministic ZIP settings and privacy checks.",
    "",
    "Canonical inner handoff files included for review awareness:",
    `- ${reviewZipName}`,
    `- ${appZipName}`,
    `- ${sidecarName}`,
    "",
    "The complete-directory ZIP is a transfer wrapper, not the product App and not a replacement for the canonical Review ZIP payload.",
    ""
  ].join("\n");
}

export function validateCompleteReviewDirectoryBinding({
  finalHead,
  finalTree,
  completeZipName,
  reviewZipName,
  appZipName,
  sidecarName,
  uploadIndex,
  manifest,
  postSealVerification,
  privacyAudit
}) {
  const errors = [];
  const records = uploadIndex?.files ?? uploadIndex?.records ?? [];
  const byRole = new Map(records.map((record) => [record.role, record]));
  const byPath = new Map(records.map((record) => [record.relativePath, record]));
  const requiredRoles = [
    "transfer_wrapper",
    "canonical_review_zip",
    "canonical_macos_app_zip",
    "canonical_owner_sidecar",
    "complete_directory_manifest",
    "complete_directory_privacy_audit",
    "complete_directory_post_seal",
    "owner_feedback_closure_map",
    "complete_directory_hash_list",
    "review_zip_entry_list",
    "app_zip_entry_list"
  ];
  for (const role of requiredRoles) {
    if (!byRole.has(role)) errors.push(`upload index missing role ${role}`);
  }
  if (byRole.get("transfer_wrapper")?.fileName !== completeZipName) errors.push("upload index transfer wrapper fileName mismatch");
  if (byRole.get("canonical_review_zip")?.fileName !== reviewZipName) errors.push("upload index review ZIP fileName mismatch");
  if (byRole.get("canonical_macos_app_zip")?.fileName !== appZipName) errors.push("upload index App ZIP fileName mismatch");
  if (byRole.get("canonical_owner_sidecar")?.fileName !== sidecarName) errors.push("upload index sidecar fileName mismatch");
  for (const record of records) {
    if (record.finalHead !== finalHead) errors.push(`upload index ${record.role} finalHead mismatch`);
    if (record.finalTree !== finalTree) errors.push(`upload index ${record.role} finalTree mismatch`);
    if (record.milestoneId !== milestoneId) errors.push(`upload index ${record.role} milestone mismatch`);
    if (record.contractRevision !== contractRevision) errors.push(`upload index ${record.role} contractRevision mismatch`);
    if (record.repairRound !== repairRound) errors.push(`upload index ${record.role} repairRound mismatch`);
    if (record.phase2Started !== phase2Started) errors.push(`upload index ${record.role} phase2Started mismatch`);
    if (record.productionApproved !== false) errors.push(`upload index ${record.role} productionApproved must be false`);
    if (record.role !== "transfer_wrapper" && record.selfReferential !== true) {
      if (!validSize(record.sizeBytes)) errors.push(`upload index ${record.role} sizeBytes missing`);
      if (!validSha256(record.sha256)) errors.push(`upload index ${record.role} sha256 missing`);
    }
  }
  const manifestEntries = new Map((manifest?.entries ?? []).map((entry) => [entry.path, entry]));
  for (const [relativePath, record] of byPath.entries()) {
    if (relativePath === completeZipName || relativePath === "MANIFEST.json") continue;
    const entry = manifestEntries.get(relativePath);
    if (!entry) {
      errors.push(`manifest missing upload index file ${relativePath}`);
      continue;
    }
    if (validSize(record.sizeBytes) && entry.sizeBytes !== record.sizeBytes) {
      errors.push(`manifest size mismatch for ${relativePath}`);
    }
    if (validSha256(record.sha256) && entry.sha256 !== record.sha256) {
      errors.push(`manifest sha256 mismatch for ${relativePath}`);
    }
  }
  const requiredManifestPaths = [
    "README.md",
    "UPLOAD_INDEX.json",
    "bundle-privacy-audit.json",
    "post-seal-verification.json",
    ownerFeedbackClosureMapName,
    sidecarName,
    reviewZipName,
    appZipName,
    "hashes/sha256sums.txt",
    "extracted-index/review-zip-entry-list.json",
    "extracted-index/app-zip-entry-list.json"
  ];
  for (const requiredPath of requiredManifestPaths) {
    if (!manifestEntries.has(requiredPath)) errors.push(`manifest missing ${requiredPath}`);
  }
  if (manifestEntries.has("MANIFEST.json")) errors.push("manifest must not include itself");
  if (privacyAudit?.passed !== true || privacyAudit?.findingCount !== 0) errors.push("complete directory privacy audit must pass with zero findings");
  if (postSealVerification?.passed !== true) errors.push("complete directory post-seal must pass");
  if (postSealVerification?.finalHead !== finalHead || postSealVerification?.finalTree !== finalTree) {
    errors.push("complete directory post-seal final head/tree mismatch");
  }
  if (postSealVerification?.completeDirectoryZip?.fileName !== completeZipName) {
    errors.push("complete directory post-seal transfer wrapper fileName mismatch");
  }
  for (const [section, fileName] of [
    ["reviewZip", reviewZipName],
    ["macosAppZip", appZipName],
    ["ownerUploadSidecar", sidecarName]
  ]) {
    if (postSealVerification?.[section]?.fileName !== fileName) {
      errors.push(`complete directory post-seal ${section} fileName mismatch`);
    }
  }
  for (const [section, fileName] of [["reviewerA", "reviewer-a.json"], ["reviewerB", "reviewer-b.json"]]) {
    const record = postSealVerification?.reviewerVerdicts?.[section];
    if (record?.fileName !== fileName) {
      errors.push(`complete directory post-seal ${section} fileName mismatch`);
    }
    if (!validSha256(record?.sha256)) {
      errors.push(`complete directory post-seal ${section} sha256 missing`);
    }
    if (!Number.isInteger(record?.sizeBytes) || record.sizeBytes <= 0) {
      errors.push(`complete directory post-seal ${section} sizeBytes missing`);
    }
  }
  return {
    passed: errors.length === 0,
    errors
  };
}

async function writeUploadArtifactIndex(root, extra = {}) {
  const entries = [];
  for (const filePath of await listFiles(root)) {
    const bundlePath = toBundlePath(root, filePath);
    if (bundlePath === "MANIFEST.json" || bundlePath === "artifact-index.json") continue;
    const stats = await stat(filePath);
    entries.push({
      path: bundlePath,
      mime: mimeFor(filePath),
      sizeBytes: stats.size,
      sha256: await sha256File(filePath),
      includedInPacket: true,
      humanReviewRequired: true
    });
  }
  const artifactIndex = {
    schemaVersion: 1,
    milestoneId,
    productEvidenceMilestoneId,
    generatedAt: "stable-p6-r1-owner-handoff",
    ...extra,
    includedInPacketCount: entries.length,
    entries: entries.sort((left, right) => left.path.localeCompare(right.path))
  };
  await writeFile(path.join(root, "artifact-index.json"), `${JSON.stringify(artifactIndex, null, 2)}\n`, "utf8");
  return artifactIndex;
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

async function buildAppBundleBinding({ appZipPath, internalTrialManifest, macosPackageProof }) {
  const sourceAppBundlePath = relativeRepoPath(trialApp);
  const internalManifestPackagePath = internalTrialManifest?.packagePath ?? null;
  const packageProofAppBundlePath = macosPackageProof?.packagingScaffold?.appBundlePath ?? null;
  const errors = [];
  if (internalTrialManifest?.buildCommit !== git(["rev-parse", "HEAD"])) {
    errors.push("internal trial manifest buildCommit does not match HEAD");
  }
  if (macosPackageProof?.buildCommit !== git(["rev-parse", "HEAD"])) {
    errors.push("macOS package proof buildCommit does not match HEAD");
  }
  if (internalManifestPackagePath !== sourceAppBundlePath) {
    errors.push("internal trial manifest packagePath does not match clean App ZIP source bundle");
  }
  if (packageProofAppBundlePath !== sourceAppBundlePath) {
    errors.push("macOS package proof appBundlePath does not match clean App ZIP source bundle");
  }
  const checkedEntries = [];
  for (const entry of appBundleBindingEntries) {
    const relativeInsideBundle = entry.replace(/^Auto SVGA\.app\//, "");
    const sourcePath = path.join(trialApp, relativeInsideBundle);
    if (!existsSync(sourcePath)) {
      errors.push(`source app bundle entry missing: ${entry}`);
      continue;
    }
    let archiveBytes;
    try {
      archiveBytes = zipEntryBytes(appZipPath, entry);
    } catch {
      errors.push(`App ZIP entry missing: ${entry}`);
      continue;
    }
    const sourceIdentity = await fileIdentity(sourcePath);
    const archiveIdentity = {
      sizeBytes: archiveBytes.byteLength,
      sha256: sha256Bytes(archiveBytes)
    };
    if (sourceIdentity.sizeBytes !== archiveIdentity.sizeBytes || sourceIdentity.sha256 !== archiveIdentity.sha256) {
      errors.push(`App ZIP entry does not match source app bundle: ${entry}`);
    }
    checkedEntries.push({
      path: entry,
      sourceSizeBytes: sourceIdentity.sizeBytes,
      sourceSha256: sourceIdentity.sha256,
      zipEntrySizeBytes: archiveIdentity.sizeBytes,
      zipEntrySha256: archiveIdentity.sha256,
      matched: sourceIdentity.sizeBytes === archiveIdentity.sizeBytes && sourceIdentity.sha256 === archiveIdentity.sha256
    });
  }
  return {
    passed: errors.length === 0,
    sourceAppBundlePath,
    internalManifestPackagePath,
    packageProofAppBundlePath,
    checkedEntries,
    errors
  };
}

function finalResponseText({
  headShort,
  visibleRootAbs,
  reviewZipName,
  appZipName,
  sidecarName,
  completeZipName,
  patchCompanionRequired,
  absoluteLinks
}) {
  const link = (label, fileName) => {
    const target = absoluteLinks ? path.join(visibleRootAbs, fileName) : fileName;
    return `[${label}](${target})`;
  };
  const lines = [
    "P6_MACHINE_EXECUTION_COMPLETE",
    "",
    "PRIMARY_OWNER_UPLOAD:",
    `- ${completeZipName ? link("P6-R1 Complete Review Directory ZIP", completeZipName) : "Generated after final packaging."}`,
    "- Upload only the complete review directory ZIP to the review assistant.",
    "",
    "VISIBLE_REVIEW:",
    `- ${link("P6-R1 Review Packet", "REVIEW_PACKET.md")}`,
    `- ${link("P6-R1 Review ZIP inside complete directory", reviewZipName)}`,
    `- ${link("P6-R1 Owner Upload Sidecar inside complete directory", sidecarName)}`,
  ];
  if (patchCompanionRequired) {
    lines.push(`- ${link("P6-R1 Companion Patch", "changes.patch")}`);
  }
  lines.push(
    "",
    "OWNER_UPLOAD_SET:",
    "- The canonical inner handoff set remains three files, but Product Owner should upload the complete review directory ZIP only.",
    `- ${reviewZipName}`,
    `- ${appZipName}`,
    `- ${sidecarName}`,
    "",
    "MACOS_APP_TO_TEST:",
    `- ${link("Auto SVGA macOS App ZIP", appZipName)}`,
    "",
    "VISIBLE_FOLDER:",
    `- review/P6-R1-${headShort}/`,
    "",
    "STATUS:",
    "- P6-R1: HUMAN_REQUIRED",
    "- PRODUCTION_APPROVED: false",
    "- PHASE_2: NOT_STARTED",
    ""
  );
  return lines.join("\n");
}

function ownerReviewPacketText({
  headCommit,
  headShort,
  reviewZipName,
  appZipName,
  sidecarName,
  patchCompanionRequired,
  finalPackagingGate,
  finalLoopValidation
}) {
  return [
    "# P6-R1 Owner Review Packet",
    "",
    "Current Status: HUMAN_REQUIRED",
    "Next Action: product_owner_human_gate",
    `Final Head: ${headCommit}`,
    `Visible Folder: review/P6-R1-${headShort}/`,
    "",
    "Owner Upload Set:",
    `- Review ZIP: ${reviewZipName}`,
    `- macOS App ZIP: ${appZipName}`,
    `- Owner upload sidecar: ${sidecarName}`,
    "",
    "Owner Handoff Contract:",
    "- companionRequired: true",
    `- mandatoryCompanions: [${appZipName}, ${sidecarName}]`,
    `- patchCompanionRequired: ${patchCompanionRequired ? "true" : "false"}`,
    "- productionApproved: false",
    "- phase2Started: false",
    "",
    "Current Machine Status:",
    "- Final Validation: passed",
    "- Reviewer A: passed",
    "- Reviewer B: passed",
    "- Final Seal: passed",
    "- Post-seal Verification: passed for Review ZIP, App ZIP, and sidecar",
    `- Final Packaging Gate: ${finalPackagingGate?.passed === true ? "passed" : "failed"}`,
    `- Final Loop Validation: ${finalLoopValidation?.passed === true ? "passed twice" : "failed"}`,
    "",
    "Historical Note:",
    "- Older Final Validation failure records in LOOP_HISTORY and archived loop packets are historical only.",
    "- They are not the current execution status for this owner handoff.",
    "",
    "Protected Scope:",
    "- Contract revision remains 3.",
    "- repairRound remains 0.",
    "- phase2Started remains false.",
    "- Product Owner acceptance, final independent external review, Finding closure, signing, notarization, release, push, and merge are not performed.",
    ""
  ].join("\n");
}

async function writeCompleteReviewDirectoryPackage({
  visibleRoot,
  headCommit,
  headTree,
  headShort,
  reviewZipName,
  appZipName,
  sidecarName,
  reviewZipIdentity,
  appZipIdentity,
  sidecarIdentity,
  reviewZipEntries,
  appZipEntries,
  reviewZipManifestSha256,
  ownerUploadPostSealVerification,
  appBundleBinding,
  finalLoopValidation,
  privacyAudit,
  workerRegistryFinal,
  patchCompanionRequired
}) {
  const completeZipName = `${milestoneId}-${headShort}-complete-review-directory.zip`;
  const completeDirectoryName = `${milestoneId}-${headShort}-complete-review-directory`;
  const completeStageParent = completeDirectoryStagingRoot;
  const completeRoot = path.join(completeStageParent, completeDirectoryName);
  const completeZipPath = path.join(visibleRoot, completeZipName);

  await rm(completeStageParent, { recursive: true, force: true });
  await rm(completeZipPath, { force: true });
  await mkdir(completeRoot, { recursive: true });
  await mkdir(path.join(completeRoot, "hashes"), { recursive: true });
  await mkdir(path.join(completeRoot, "extracted-index"), { recursive: true });

  await copyRequired(path.join(visibleRoot, reviewZipName), path.join(completeRoot, reviewZipName));
  await copyRequired(path.join(visibleRoot, appZipName), path.join(completeRoot, appZipName));
  await copyRequired(path.join(visibleRoot, sidecarName), path.join(completeRoot, sidecarName));
  await copyRequired(path.join(productRoot, ownerFeedbackClosureMapName), path.join(completeRoot, ownerFeedbackClosureMapName));

  const reviewZipEntryList = {
    ...zipEntryListReport(path.join(completeRoot, reviewZipName)),
    zipRole: "canonical_review_zip",
    fileName: reviewZipName
  };
  const appZipEntryList = {
    ...zipEntryListReport(path.join(completeRoot, appZipName)),
    zipRole: "canonical_macos_app_zip",
    fileName: appZipName
  };
  if (!reviewZipEntryList.noMacosxMetadata || !reviewZipEntryList.noDsStore) {
    throw new Error("complete review directory blocked: Review ZIP contains forbidden metadata");
  }
  if (!appZipEntryList.noMacosxMetadata || !appZipEntryList.noDsStore) {
    throw new Error("complete review directory blocked: App ZIP contains forbidden metadata");
  }
  await writeJsonFile(path.join(completeRoot, "extracted-index/review-zip-entry-list.json"), reviewZipEntryList);
  await writeJsonFile(path.join(completeRoot, "extracted-index/app-zip-entry-list.json"), appZipEntryList);

  await writeFile(path.join(completeRoot, "README.md"), completeDirectoryReadme({
    completeZipName,
    reviewZipName,
    appZipName,
    sidecarName
  }), "utf8");

  const innerPostSeal = ownerUploadPostSealVerification;
  const completePostSeal = {
    schemaVersion: 1,
    milestoneId,
    finalHead: headCommit,
    finalTree: headTree,
    contractRevision,
    repairRound,
    phase2Started,
    productionApproved: false,
    passed: true,
    sealIdentifier: innerPostSeal.sealIdentifier ?? `P6-R1-${headShort}`,
    completeDirectoryZip: {
      fileName: completeZipName,
      role: "transfer_wrapper",
      identityRecordedExternally: true
    },
    reviewZip: {
      fileName: reviewZipName,
      sizeBytes: reviewZipIdentity.sizeBytes,
      sha256: reviewZipIdentity.sha256,
      entryCount: reviewZipEntries.length,
      manifestSha256: reviewZipManifestSha256
    },
    macosAppZip: {
      fileName: appZipName,
      sizeBytes: appZipIdentity.sizeBytes,
      sha256: appZipIdentity.sha256,
      entryCount: appZipEntries.length
    },
    ownerUploadSidecar: {
      fileName: sidecarName,
      sizeBytes: sidecarIdentity.sizeBytes,
      sha256: sidecarIdentity.sha256
    },
    reviewerVerdicts: {
      reviewerA: {
        fileName: "reviewer-a.json",
        sizeBytes: ownerUploadPostSealVerification.reviewerVerdicts?.reviewerA?.sizeBytes ?? null,
        sha256: ownerUploadPostSealVerification.reviewerVerdicts?.reviewerA?.sha256 ?? null
      },
      reviewerB: {
        fileName: "reviewer-b.json",
        sizeBytes: ownerUploadPostSealVerification.reviewerVerdicts?.reviewerB?.sizeBytes ?? null,
        sha256: ownerUploadPostSealVerification.reviewerVerdicts?.reviewerB?.sha256 ?? null
      }
    },
    finalLoopValidation,
    appBundleBinding,
    innerPostSeal: {
      passed: innerPostSeal.passed === true,
      reviewedHeadCommit: innerPostSeal.reviewedHeadCommit,
      reviewedHeadTree: innerPostSeal.reviewedHeadTree,
      ownerUploadSet: innerPostSeal.ownerUploadSet
    },
    assertions: {
      exactCanonicalSetCopied: true,
      reviewZipHashMatchesInnerPostSeal: innerPostSeal.reviewZip?.sha256 === reviewZipIdentity.sha256,
      appZipHashMatchesInnerPostSeal: innerPostSeal.macosAppZip?.sha256 === appZipIdentity.sha256,
      sidecarHashMatchesInnerPostSeal: innerPostSeal.ownerUploadSidecar?.sha256 === sidecarIdentity.sha256,
      appZipUnzipVerified: appZipEntryList.entryCount === appZipEntries.length && appZipEntryList.entryCount > 0,
      noMacosxMetadata: reviewZipEntryList.noMacosxMetadata && appZipEntryList.noMacosxMetadata,
      noDsStore: reviewZipEntryList.noDsStore && appZipEntryList.noDsStore,
      manifestCoversDirectoryPayloadsExceptItself: true,
      privacyAuditRequired: true,
      finalLoopValidationIncluded: finalLoopValidation.passed === true,
      productionApprovedFalse: true,
      phase2StartedFalse: true
    }
  };
  if (!completePostSeal.assertions.reviewZipHashMatchesInnerPostSeal
    || !completePostSeal.assertions.appZipHashMatchesInnerPostSeal
    || !completePostSeal.assertions.sidecarHashMatchesInnerPostSeal) {
    throw new Error("complete review directory blocked: inner post-seal identity mismatch");
  }
  await writeJsonFile(path.join(completeRoot, "post-seal-verification.json"), completePostSeal);

  let completePrivacyAudit = {
    ...await buildPrivacyAudit({
      stagingRoot: completeRoot,
      appZipPath: path.join(completeRoot, appZipName),
      reviewZipPath: path.join(completeRoot, reviewZipName),
      expectedHeadShort: headShort,
      skipZipPaths: [
        path.join(completeRoot, reviewZipName),
        path.join(completeRoot, appZipName)
      ]
    }),
    productionApproved: false,
    phase2Started: false
  };
  if (!completePrivacyAudit.passed) {
    throw new Error(`complete review directory privacy audit failed: ${completePrivacyAudit.findings.map((finding) => `${finding.ruleId}:${finding.entry}`).join("; ")}`);
  }
  await writeJsonFile(path.join(completeRoot, "bundle-privacy-audit.json"), completePrivacyAudit);

  const baseUploadRecords = [
    uploadRecord({
      role: "transfer_wrapper",
      required: true,
      fileName: completeZipName,
      relativePath: completeZipName,
      sizeBytes: null,
      sha256: null,
      entryCount: null,
      finalHead: headCommit,
      finalTree: headTree,
      notes: "Self-referential ZIP identity is reported by the generator output and Product Owner final response."
    }),
    uploadRecord({
      role: "canonical_review_zip",
      required: true,
      fileName: reviewZipName,
      relativePath: reviewZipName,
      sizeBytes: reviewZipIdentity.sizeBytes,
      sha256: reviewZipIdentity.sha256,
      entryCount: reviewZipEntries.length,
      finalHead: headCommit,
      finalTree: headTree
    }),
    uploadRecord({
      role: "canonical_macos_app_zip",
      required: true,
      fileName: appZipName,
      relativePath: appZipName,
      sizeBytes: appZipIdentity.sizeBytes,
      sha256: appZipIdentity.sha256,
      entryCount: appZipEntries.length,
      finalHead: headCommit,
      finalTree: headTree
    }),
    uploadRecord({
      role: "canonical_owner_sidecar",
      required: true,
      fileName: sidecarName,
      relativePath: sidecarName,
      sizeBytes: sidecarIdentity.sizeBytes,
      sha256: sidecarIdentity.sha256,
      entryCount: null,
      finalHead: headCommit,
      finalTree: headTree
    }),
    await fileUploadRecord({ role: "complete_directory_readme", root: completeRoot, relativePath: "README.md", finalHead: headCommit, finalTree: headTree }),
    await fileUploadRecord({ role: "complete_directory_post_seal", root: completeRoot, relativePath: "post-seal-verification.json", finalHead: headCommit, finalTree: headTree }),
    await fileUploadRecord({ role: "complete_directory_privacy_audit", root: completeRoot, relativePath: "bundle-privacy-audit.json", finalHead: headCommit, finalTree: headTree }),
    await fileUploadRecord({ role: "owner_feedback_closure_map", root: completeRoot, relativePath: ownerFeedbackClosureMapName, finalHead: headCommit, finalTree: headTree }),
    await fileUploadRecord({ role: "review_zip_entry_list", root: completeRoot, relativePath: "extracted-index/review-zip-entry-list.json", finalHead: headCommit, finalTree: headTree, entryCount: reviewZipEntryList.entryCount }),
    await fileUploadRecord({ role: "app_zip_entry_list", root: completeRoot, relativePath: "extracted-index/app-zip-entry-list.json", finalHead: headCommit, finalTree: headTree, entryCount: appZipEntryList.entryCount }),
    {
      ...uploadRecord({
        role: "complete_directory_upload_index",
        required: true,
        fileName: "UPLOAD_INDEX.json",
        relativePath: "UPLOAD_INDEX.json",
        sizeBytes: null,
        sha256: null,
        entryCount: null,
        finalHead: headCommit,
        finalTree: headTree,
        notes: "Self-referential metadata file; exact bytes are covered by MANIFEST.json."
      }),
      selfReferential: true
    },
    {
      ...uploadRecord({
        role: "complete_directory_manifest",
        required: true,
        fileName: "MANIFEST.json",
        relativePath: "MANIFEST.json",
        sizeBytes: null,
        sha256: null,
        entryCount: null,
        finalHead: headCommit,
        finalTree: headTree,
        notes: "MANIFEST.json covers every other complete-directory file and therefore excludes itself."
      }),
      selfReferential: true
    },
    {
      ...uploadRecord({
        role: "complete_directory_hash_list",
        required: true,
        fileName: "sha256sums.txt",
        relativePath: "hashes/sha256sums.txt",
        sizeBytes: null,
        sha256: null,
        entryCount: null,
        finalHead: headCommit,
        finalTree: headTree,
        notes: "Hash list excludes itself and MANIFEST.json to avoid impossible self-referential hashes."
      }),
      selfReferential: true
    }
  ];
  const uploadIndex = {
    schemaVersion: 1,
    milestoneId,
    finalHead: headCommit,
    finalTree: headTree,
    contractRevision,
    repairRound,
    phase2Started,
    productionApproved: false,
    transferWrapper: {
      fileName: completeZipName,
      role: "transfer_wrapper",
      productApp: false,
      reviewPayload: false,
      identityRecordedExternally: true
    },
    canonicalHandoffSet: {
      companionRequired: true,
      exactFileNames: [reviewZipName, appZipName, sidecarName],
      reviewZip: reviewZipName,
      macosAppZip: appZipName,
      sidecar: sidecarName
    },
    files: baseUploadRecords
  };
  await writeJsonFile(path.join(completeRoot, "UPLOAD_INDEX.json"), uploadIndex);
  await writeSha256Sums({
    root: completeRoot,
    excluded: ["MANIFEST.json", "hashes/sha256sums.txt"]
  });

  const completeManifest = await buildManifest(completeRoot, {
    reviewedHeadCommit: headCommit,
    reviewedHeadTree: headTree,
    finalHead: headCommit,
    finalTree: headTree,
    contractRevision,
    repairRound,
    phase2Started,
    productionApproved: false,
    companionRequired: true,
    transferWrapper: {
      fileName: completeZipName,
      role: "complete_review_directory_zip",
      identityRecordedExternally: true
    },
    canonicalHandoffSet: uploadIndex.canonicalHandoffSet,
    privacyAudit: {
      passed: completePrivacyAudit.passed,
      findingCount: completePrivacyAudit.findingCount,
      scannedEntryCount: completePrivacyAudit.scannedEntryCount
    },
    postSealVerification: {
      passed: completePostSeal.passed,
      finalHead: completePostSeal.finalHead,
      finalTree: completePostSeal.finalTree
    }
  });
  await writeJsonFile(path.join(completeRoot, "MANIFEST.json"), completeManifest);
  const completeManifestHashCheck = await validateManifestPayloadHashes({
    root: completeRoot,
    manifest: completeManifest
  });
  if (!completeManifestHashCheck.passed) {
    throw new Error(`complete review directory manifest hash check failed: ${completeManifestHashCheck.errors.join("; ")}`);
  }

  const completeBinding = validateCompleteReviewDirectoryBinding({
    finalHead: headCommit,
    finalTree: headTree,
    completeZipName,
    reviewZipName,
    appZipName,
    sidecarName,
    uploadIndex,
    manifest: completeManifest,
    postSealVerification: completePostSeal,
    privacyAudit: completePrivacyAudit
  });
  if (!completeBinding.passed) {
    throw new Error(`complete review directory binding failed: ${completeBinding.errors.join("; ")}`);
  }

  const entries = (await listFiles(completeStageParent)).map((filePath) => toBundlePath(completeStageParent, filePath)).sort();
  await rm(completeZipPath, { force: true });
  runZip({ cwd: completeStageParent, zipPath: completeZipPath, entries });
  assertNoForbiddenZipMetadata(completeZipPath, "complete review directory ZIP");
  const completeZipEntries = zipEntries(completeZipPath);
  const completeZipIdentity = await fileIdentity(completeZipPath);
  const finalOuterPrivacyAudit = buildZipPrivacyAudit({
    reviewZipPath: path.join(completeRoot, reviewZipName),
    appZipPath: path.join(completeRoot, appZipName),
    extraZipPaths: [{ zipRole: "complete_directory_wrapper", zipPath: completeZipPath }],
    expectedHeadShort: headShort
  });
  if (!finalOuterPrivacyAudit.passed) {
    throw new Error(`complete review directory ZIP privacy audit failed: ${finalOuterPrivacyAudit.findings.map((finding) => `${finding.ruleId}:${finding.entry}`).join("; ")}`);
  }
  await writeJsonFile(path.join(visibleRoot, "complete-review-directory-summary.json"), {
    schemaVersion: 1,
    milestoneId,
    finalHead: headCommit,
    finalTree: headTree,
    contractRevision,
    repairRound,
    phase2Started,
    productionApproved: false,
    completeReviewDirectoryZip: {
      fileName: completeZipName,
      sizeBytes: completeZipIdentity.sizeBytes,
      sha256: completeZipIdentity.sha256,
      entryCount: completeZipEntries.length,
      role: "transfer_wrapper"
    },
    canonicalHandoffSet: uploadIndex.canonicalHandoffSet,
    privacyAudit: {
      passed: finalOuterPrivacyAudit.passed,
      findingCount: finalOuterPrivacyAudit.findings.length
    },
    workerRegistryFinal,
    patchCompanionRequired
  });
  return {
    fileName: completeZipName,
    path: completeZipPath,
    sizeBytes: completeZipIdentity.sizeBytes,
    sha256: completeZipIdentity.sha256,
    entryCount: completeZipEntries.length,
    stagingDirectory: path.relative(repoRoot, completeRoot).split(path.sep).join("/"),
    uploadIndex,
    manifest: completeManifest,
    privacyAudit: {
      passed: finalOuterPrivacyAudit.passed,
      findingCount: finalOuterPrivacyAudit.findings.length
    }
  };
}

async function main() {
  const headCommit = git(["rev-parse", "HEAD"]);
  const headTree = git(["rev-parse", "HEAD^{tree}"]);
  const headShort = git(["rev-parse", "--short", headCommit]);
  const visibleRoot = path.join(repoRoot, `review/P6-R1-${headShort}`);
  const reviewZipName = `P6-R1-${headShort}-review-upload.zip`;
  const appZipName = `Auto-SVGA-macOS-internal-${headShort}.zip`;
  const sidecarName = `${sidecarNamePrefix}-${headShort}.json`;
  const completeZipName = `P6-R1-${headShort}-complete-review-directory.zip`;
  const reviewZipPath = path.join(visibleRoot, reviewZipName);
  const appZipPath = path.join(visibleRoot, appZipName);
  const sidecarPath = path.join(visibleRoot, sidecarName);
  const canonicalManifest = JSON.parse(await readFile(path.join(packetRoot, "MANIFEST.json"), "utf8"));
  const internalTrialManifest = JSON.parse(await readFile(path.join(trialRoot, "internal-trial-manifest.json"), "utf8"));
  const macosPackageProof = JSON.parse(await readFile(path.join(trialRoot, "macos-package-proof.json"), "utf8"));

  if (canonicalManifest.milestoneOutcome !== "HUMAN_REQUIRED") {
    throw new Error("P6 owner handoff requires a HUMAN_REQUIRED sealed packet.");
  }
  if (!existsSync(trialApp)) {
    throw new Error(`macOS trial app missing: ${trialApp}`);
  }
  const finalPackagingGate = await assertFinalPackagingGate({ headCommit, canonicalManifest });
  const finalLoopValidation = await assertFinalLoopValidationEvidence({ headCommit });
  if (!finalLoopValidation.passed) {
    throw new Error(`P6 owner handoff requires two final loop validations: ${finalLoopValidation.errors.join("; ")}`);
  }
  const workerRegistryFinal = await writeWorkerRegistryFinal({ headCommit });
  const patchCompanionRequired = canonicalManifest.companionRequired === true;

  await rm(uploadStagingRoot, { recursive: true, force: true });
  await rm(visibleRoot, { recursive: true, force: true });
  await mkdir(uploadStagingRoot, { recursive: true });
  await mkdir(visibleRoot, { recursive: true });

  for (const fileName of sealedEvidenceFiles) {
    await copyRequired(path.join(packetRoot, fileName), path.join(uploadStagingRoot, fileName));
    await copyRequired(path.join(packetRoot, fileName), path.join(visibleRoot, fileName));
  }
  for (const [bundlePath, sourcePath] of finalLoopValidationEvidenceFiles) {
    await copyRequired(sourcePath, path.join(uploadStagingRoot, bundlePath));
    await copyRequired(sourcePath, path.join(visibleRoot, bundlePath));
  }
  if (patchCompanionRequired) {
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
  await copyRequired(workerRegistryFinalPath, path.join(visibleRoot, "worker-registry-final.json"));

  createCleanAppZip({ appBundle: trialApp, zipPath: appZipPath });
  const appZipIdentity = await fileIdentity(appZipPath);
  const appZipEntries = zipEntries(appZipPath);
  const appBundleBinding = await buildAppBundleBinding({ appZipPath, internalTrialManifest, macosPackageProof });
  if (!appBundleBinding.passed) {
    throw new Error(`P6 owner App ZIP binding failed: ${appBundleBinding.errors.join("; ")}`);
  }
  const relativeFinalResponse = finalResponseText({
    headShort,
    visibleRootAbs: visibleRoot,
    reviewZipName,
    appZipName,
    sidecarName,
    completeZipName,
    patchCompanionRequired,
    absoluteLinks: false
  });
  const clickableFinalResponse = finalResponseText({
    headShort,
    visibleRootAbs: visibleRoot,
    reviewZipName,
    appZipName,
    sidecarName,
    completeZipName,
    patchCompanionRequired,
    absoluteLinks: false
  });
  await writeFile(path.join(uploadStagingRoot, "FINAL_RESPONSE.txt"), relativeFinalResponse, "utf8");
  await writeFile(path.join(visibleRoot, "FINAL_RESPONSE.txt"), clickableFinalResponse, "utf8");
  await writeFile(path.join(uploadStagingRoot, "README.md"), [
    "# P6-R1 Owner Review Upload",
    "",
    "Status: HUMAN_REQUIRED.",
    "Upload set requirement: provide the Review ZIP, macOS App ZIP, and sidecar together.",
    "The product evidence namespace `product/P6` is inherited from the recovered P6 evidence run.",
    "This ZIP is portable and uses relative paths only.",
    ""
  ].join("\n"), "utf8");

  const manifestExtra = {
    reviewedHeadCommit: headCommit,
    reviewedHeadTree: headTree,
    companionRequired: true,
    mandatoryCompanions: [appZipName, sidecarName],
    productionApproved: false,
    phase2Started: false,
    patchCompanionRequired,
    patchCompanions: patchCompanionRequired ? ["changes.patch"] : [],
    finalPackagingGate,
    finalLoopValidation,
    appBundleBinding,
    workerRegistryFinal,
    ownerReviewZip: {
      fileName: reviewZipName,
      role: "canonical_review_zip"
    },
    ownerUploadSidecar: {
      fileName: sidecarName,
      role: "outer_manifest_and_post_seal_binding"
    },
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
  const ownerPacketText = ownerReviewPacketText({
    headCommit,
    headShort,
    reviewZipName,
    appZipName,
    sidecarName,
    patchCompanionRequired,
    finalPackagingGate,
    finalLoopValidation
  });
  await writeFile(path.join(uploadStagingRoot, "REVIEW_PACKET.md"), ownerPacketText, "utf8");
  await writeFile(path.join(visibleRoot, "REVIEW_PACKET.md"), ownerPacketText, "utf8");

  let privacyAudit = {
    passed: false,
    productionApproved: false,
    phase2Started: false,
    findingCount: -1,
    actualZipEntryCount: 0,
    scannedEntryCount: 0,
    scannedTextEntryCount: 0,
    scannedBinaryEntryCount: 0,
    selfReferentialExclusions: []
  };
  for (const phase of ["pre-audit", "final-audit"]) {
    await writeUploadArtifactIndex(uploadStagingRoot, {
      reviewedHeadCommit: headCommit,
      reviewZipName,
      appZipName,
      sidecarName
    });
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
    privacyAudit = {
      ...await buildPrivacyAudit({ stagingRoot: uploadStagingRoot, appZipPath, reviewZipPath, expectedHeadShort: headShort }),
      productionApproved: false,
      phase2Started: false
    };
    if (!privacyAudit.passed) {
      throw new Error(`P6 owner handoff privacy audit failed during ${phase}: ${privacyAudit.findings.map((finding) => `${finding.ruleId}:${finding.entry}`).join("; ")}`);
    }
    await writeFile(path.join(uploadStagingRoot, "bundle-privacy-audit.json"), `${JSON.stringify(privacyAudit, null, 2)}\n`);
    await writeFile(path.join(visibleRoot, "bundle-privacy-audit.json"), `${JSON.stringify(privacyAudit, null, 2)}\n`);
  }
  await writeUploadArtifactIndex(uploadStagingRoot, {
    reviewedHeadCommit: headCommit,
    reviewZipName,
    appZipName,
    sidecarName
  });
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
  const verificationPrivacyAudit = {
    ...await buildPrivacyAudit({ stagingRoot: uploadStagingRoot, appZipPath, reviewZipPath, expectedHeadShort: headShort }),
    productionApproved: false,
    phase2Started: false
  };
  if (!verificationPrivacyAudit.passed) {
    throw new Error(`P6 owner handoff final privacy audit failed: ${verificationPrivacyAudit.findings.map((finding) => `${finding.ruleId}:${finding.entry}`).join("; ")}`);
  }
  privacyAudit = verificationPrivacyAudit;
  await writeFile(path.join(uploadStagingRoot, "bundle-privacy-audit.json"), `${JSON.stringify(privacyAudit, null, 2)}\n`);
  await writeFile(path.join(visibleRoot, "bundle-privacy-audit.json"), `${JSON.stringify(privacyAudit, null, 2)}\n`);
  await writeUploadArtifactIndex(uploadStagingRoot, {
    reviewedHeadCommit: headCommit,
    reviewZipName,
    appZipName,
    sidecarName
  });
  const finalReviewManifest = await buildManifest(uploadStagingRoot, {
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
  });
  await writeFile(path.join(uploadStagingRoot, "MANIFEST.json"), `${JSON.stringify(finalReviewManifest, null, 2)}\n`);
  const reviewManifestHashCheck = await validateManifestPayloadHashes({
    root: uploadStagingRoot,
    manifest: finalReviewManifest
  });
  if (!reviewManifestHashCheck.passed) {
    throw new Error(`P6 owner review manifest hash check failed: ${reviewManifestHashCheck.errors.join("; ")}`);
  }
  uploadEntries = (await listFiles(uploadStagingRoot)).map((filePath) => toBundlePath(uploadStagingRoot, filePath)).sort();
  await rm(reviewZipPath, { force: true });
  runZip({ cwd: uploadStagingRoot, zipPath: reviewZipPath, entries: uploadEntries });
  const reviewZipEntries = zipEntries(reviewZipPath);
  const reviewZipIdentity = await fileIdentity(reviewZipPath);
  const reviewZipManifestSha256 = sha256Bytes(zipEntryBytes(reviewZipPath, "MANIFEST.json"));

  const reviewZipIndex = validateZipEntriesIndexed({
    entries: reviewZipEntries,
    manifestEntries: finalReviewManifest.entries
  });
  if (!reviewZipIndex.passed) {
    throw new Error(`P6 owner review ZIP index check failed: unindexed=${reviewZipIndex.unindexedEntries.join(", ")} missing=${reviewZipIndex.missingIndexedEntries.join(", ")}`);
  }

  const appZipRecord = {
    fileName: appZipName,
    sizeBytes: appZipIdentity.sizeBytes,
    sha256: appZipIdentity.sha256,
    entryCount: appZipEntries.length,
    unzipVerified: appZipEntries.some((entry) => entry === "Auto SVGA.app/Contents/Info.plist")
  };
  if (!appZipRecord.unzipVerified) {
    throw new Error("P6 owner App ZIP post-seal verification failed: missing app Info.plist");
  }
  const ownerUploadSidecar = {
    schemaVersion: 1,
    milestoneId,
    productEvidenceMilestoneId,
    reviewedHeadCommit: headCommit,
    reviewedHeadTree: headTree,
    generatedAt: "stable-p6-r1-owner-handoff-sidecar",
    productionApproved: false,
    phase2Started: false,
    companionRequired: true,
    mandatoryCompanions: [appZipName, sidecarName],
    ownerUploadSet: {
      exactFileNames: [reviewZipName, appZipName, sidecarName],
      companionRequired: true,
      reviewZipManifestSha256,
      productionApproved: false
    },
    ownerReviewZip: {
      fileName: reviewZipName,
      sizeBytes: reviewZipIdentity.sizeBytes,
      sha256: reviewZipIdentity.sha256,
      entryCount: reviewZipEntries.length,
      manifestEntriesEqualActualEntries: reviewZipIndex.passed,
      manifestSha256: reviewZipManifestSha256
    },
    macosAppZip: appZipRecord,
    appBundleBinding,
    finalLoopValidation,
    privacyAudit: {
      passed: privacyAudit.passed,
      findingCount: privacyAudit.findingCount,
      scannedEntryCount: privacyAudit.scannedEntryCount
    },
    rollback: {
      browserWorkflow: "npm run local:preview"
    }
  };
  await writeFile(sidecarPath, `${JSON.stringify(ownerUploadSidecar, null, 2)}\n`, "utf8");
  const sidecarIdentity = await fileIdentity(sidecarPath);
  const reviewerAIdentity = await fileIdentity(path.join(visibleRoot, "reviewer-a.json"));
  const reviewerBIdentity = await fileIdentity(path.join(visibleRoot, "reviewer-b.json"));
  const ownerUploadPostSealVerification = {
    schemaVersion: 2,
    milestoneId,
    reviewedHeadCommit: headCommit,
    reviewedHeadTree: headTree,
    passed: true,
    ownerUploadSet: ownerUploadSidecar.ownerUploadSet,
    reviewZip: ownerUploadSidecar.ownerReviewZip,
    macosAppZip: ownerUploadSidecar.macosAppZip,
    ownerUploadSidecar: {
      fileName: sidecarName,
      sizeBytes: sidecarIdentity.sizeBytes,
      sha256: sidecarIdentity.sha256
    },
    reviewerVerdicts: {
      reviewerA: {
        fileName: "reviewer-a.json",
        sizeBytes: reviewerAIdentity.sizeBytes,
        sha256: reviewerAIdentity.sha256
      },
      reviewerB: {
        fileName: "reviewer-b.json",
        sizeBytes: reviewerBIdentity.sizeBytes,
        sha256: reviewerBIdentity.sha256
      }
    },
    appBundleBinding,
    finalLoopValidation,
    privacyAudit: ownerUploadSidecar.privacyAudit,
    assertions: {
      reviewZipIsCanonicalToolOutput: true,
      appZipIsMandatoryCompanion: true,
      sidecarIsMandatoryCompanion: true,
      appZipBoundToInternalPackageProof: appBundleBinding.passed === true,
      finalLoopValidationIncluded: finalLoopValidation.passed === true,
      noFinderRecompression: true,
      noMacosxMetadata: reviewZipEntries.every((entry) => !entry.includes("__MACOSX"))
        && appZipEntries.every((entry) => !entry.includes("__MACOSX")),
      sameFinalHead: true
    }
  };
  await writeFile(
    path.join(visibleRoot, "owner-upload-post-seal-verification.json"),
    `${JSON.stringify(ownerUploadPostSealVerification, null, 2)}\n`,
    "utf8"
  );
  await writeFile(
    path.join(visibleRoot, "post-seal-verification.json"),
    `${JSON.stringify(ownerUploadPostSealVerification, null, 2)}\n`,
    "utf8"
  );

  await writeFile(path.join(visibleRoot, "README.md"), [
    "# P6-R1 Owner Review Materials",
    "",
    `Upload only \`${completeZipName}\` to the review assistant.`,
    "",
    "Do not manually re-compress Finder folders. Hidden `.artifacts` paths are internal build outputs.",
    "",
    `- ${completeZipName}: complete review directory transfer wrapper.`,
    `- ${reviewZipName}: portable owner review ZIP.`,
    `- ${appZipName}: unsigned macOS internal App ZIP for testing.`,
    `- ${sidecarName}: post-seal sidecar binding the Review ZIP and App ZIP.`,
    "- REVIEW_PACKET.md: owner-facing current-status packet for this upload set.",
    "- worker-registry-final.json: generated final-head worker registry binding.",
    "- FINAL_RESPONSE.txt: exact terminal response with clickable local file links.",
    ""
  ].join("\n"), "utf8");
  const visibleManifest = await buildManifest(visibleRoot, {
    ...manifestExtra,
    privacyAudit: {
      passed: privacyAudit.passed,
      findingCount: privacyAudit.findingCount,
      actualZipEntryCount: privacyAudit.actualZipEntryCount,
      scannedEntryCount: privacyAudit.scannedEntryCount,
      scannedTextEntryCount: privacyAudit.scannedTextEntryCount,
      scannedBinaryEntryCount: privacyAudit.scannedBinaryEntryCount,
      selfReferentialExclusionCount: privacyAudit.selfReferentialExclusions.length
    },
    ownerReviewZip: {
      fileName: reviewZipName,
      sizeBytes: reviewZipIdentity.sizeBytes,
      sha256: reviewZipIdentity.sha256,
      entryCount: reviewZipEntries.length,
      manifestSha256: reviewZipManifestSha256
    },
    ownerUploadSidecar: {
      fileName: sidecarName,
      sizeBytes: sidecarIdentity.sizeBytes,
      sha256: sidecarIdentity.sha256,
      role: "outer_manifest_and_post_seal_binding"
    }
  });
  const visibleBinding = validateOwnerVisibleHandoffBinding({
    headCommit,
    manifest: visibleManifest,
    reviewZipName,
    appZipName,
    sidecarName,
    reviewPacketText: ownerPacketText,
    finalResponseText: clickableFinalResponse,
    sidecar: ownerUploadSidecar,
    postSealVerification: ownerUploadPostSealVerification
  });
  if (!visibleBinding.passed) {
    throw new Error(`P6 owner-visible handoff binding failed: ${visibleBinding.errors.join("; ")}`);
  }
  await writeFile(path.join(visibleRoot, "MANIFEST.json"), `${JSON.stringify(visibleManifest, null, 2)}\n`);

  const completeReviewDirectory = await writeCompleteReviewDirectoryPackage({
    visibleRoot,
    headCommit,
    headTree,
    headShort,
    reviewZipName,
    appZipName,
    sidecarName,
    reviewZipIdentity,
    appZipIdentity,
    sidecarIdentity,
    reviewZipEntries,
    appZipEntries,
    reviewZipManifestSha256,
    ownerUploadPostSealVerification,
    appBundleBinding,
    finalLoopValidation,
    privacyAudit,
    workerRegistryFinal,
    patchCompanionRequired
  });

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
    ownerUploadSidecar: {
      fileName: sidecarName,
      sizeBytes: sidecarIdentity.sizeBytes,
      sha256: sidecarIdentity.sha256
    },
    completeReviewDirectoryZip: {
      fileName: completeReviewDirectory.fileName,
      sizeBytes: completeReviewDirectory.sizeBytes,
      sha256: completeReviewDirectory.sha256,
      entryCount: completeReviewDirectory.entryCount,
      role: "transfer_wrapper"
    },
    companionRequired: true,
    mandatoryCompanions: [appZipName, sidecarName],
    primaryOwnerUpload: completeReviewDirectory.fileName,
    patchCompanionRequired,
    finalPackagingGate,
    finalLoopValidation,
    appBundleBinding,
    workerRegistryFinal,
    reviewZipIndex,
    privacyAudit: {
      passed: privacyAudit.passed,
      findingCount: privacyAudit.findingCount
    }
  };
  console.log(`AUTO_SVGA_P6_R1_OWNER_HANDOFF_RESULT=${JSON.stringify(summary)}`);
}

const isDirectRun = process.argv[1]
  && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isDirectRun) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.stack ?? error.message : String(error));
    process.exitCode = 1;
  });
}
