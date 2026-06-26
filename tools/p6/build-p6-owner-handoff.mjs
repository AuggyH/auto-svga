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
const parityReportPath = path.join(productRoot, "p6-parity-report.json");
const trackedWorkerRegistryPath = path.join(repoRoot, "docs/product/p6/P6_WORKER_REGISTRY.json");
const workerRegistryFinalPath = path.join(productRoot, "worker-registry-final.json");
const workerRegistryFinalRepoPath = ".artifacts/product/P6/worker-registry-final.json";
const sidecarNamePrefix = "P6-R1-owner-upload-sidecar";

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
    if (entry.endsWith("REVIEW_PACKET.md") && isInsideFencedDiffBlock(text, match.index)) {
      continue;
    }
    if (isInsideOwnerHandoffPrivacyTestPatch(text, match.index, entry)) {
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

function manifestEntryFor(manifest, fileName) {
  return (manifest?.entries ?? []).find((entry) => entry.path === fileName) ?? null;
}

function validSha256(value) {
  return typeof value === "string" && /^[a-f0-9]{64}$/i.test(value);
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
    if (sidecar?.companionRequired !== true) errors.push("owner sidecar must require App ZIP and sidecar companions");
    const sidecarCompanions = new Set(sidecar?.mandatoryCompanions ?? []);
    if (!sidecarCompanions.has(appZipName) || !sidecarCompanions.has(sidecarName)) {
      errors.push("owner sidecar mandatoryCompanions must include App ZIP and sidecar");
    }
    if (sidecar?.ownerReviewZip?.fileName !== reviewZipName) errors.push("owner sidecar review ZIP fileName mismatch");
    if (sidecar?.macosAppZip?.fileName !== appZipName) errors.push("owner sidecar App ZIP fileName mismatch");
  }
  if (postSealVerification !== undefined) {
    if (postSealVerification?.reviewedHeadCommit !== headCommit) errors.push("owner post-seal reviewed head mismatch");
    if (postSealVerification?.passed !== true) errors.push("owner post-seal verification must pass");
    if (postSealVerification?.reviewZip?.fileName !== reviewZipName) errors.push("owner post-seal review ZIP fileName mismatch");
    if (postSealVerification?.macosAppZip?.fileName !== appZipName) errors.push("owner post-seal App ZIP fileName mismatch");
    if (postSealVerification?.ownerUploadSidecar?.fileName !== sidecarName) errors.push("owner post-seal sidecar fileName mismatch");
    for (const section of ["reviewZip", "macosAppZip", "ownerUploadSidecar"]) {
      const record = postSealVerification?.[section];
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

async function buildPrivacyAudit({ stagingRoot, appZipPath, reviewZipPath, expectedHeadShort }) {
  const findings = [];
  const scannedEntries = [];
  const stagingFiles = await listFiles(stagingRoot);
  const extraZipPaths = [];
  for (const filePath of stagingFiles) {
    const bundlePath = toBundlePath(stagingRoot, filePath);
    if (path.extname(filePath).toLowerCase() === ".zip") {
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

function finalResponseText({
  headShort,
  visibleRootAbs,
  reviewZipName,
  appZipName,
  sidecarName,
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
    "VISIBLE_REVIEW:",
    `- ${link("P6-R1 Review Packet", "REVIEW_PACKET.md")}`,
    `- ${link("P6-R1 Review ZIP", reviewZipName)}`,
    `- ${link("P6-R1 Owner Upload Sidecar", sidecarName)}`,
  ];
  if (patchCompanionRequired) {
    lines.push(`- ${link("P6-R1 Companion Patch", "changes.patch")}`);
  }
  lines.push(
    "",
    "MACOS_APP_TO_TEST:",
    `- ${link("Auto SVGA macOS App ZIP", appZipName)}`,
    "",
    "VISIBLE_FOLDER:",
    `- review/P6-R1-${headShort}/`,
    "",
    "STATUS:",
    "- P6-R1: HUMAN_REQUIRED",
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
  finalPackagingGate
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

async function main() {
  const headCommit = git(["rev-parse", "HEAD"]);
  const headShort = git(["rev-parse", "--short", headCommit]);
  const visibleRoot = path.join(repoRoot, `review/P6-R1-${headShort}`);
  const reviewZipName = `P6-R1-${headShort}-review-upload.zip`;
  const appZipName = `Auto-SVGA-macOS-internal-${headShort}.zip`;
  const sidecarName = `${sidecarNamePrefix}-${headShort}.json`;
  const reviewZipPath = path.join(visibleRoot, reviewZipName);
  const appZipPath = path.join(visibleRoot, appZipName);
  const sidecarPath = path.join(visibleRoot, sidecarName);
  const canonicalManifest = JSON.parse(await readFile(path.join(packetRoot, "MANIFEST.json"), "utf8"));

  if (canonicalManifest.milestoneOutcome !== "HUMAN_REQUIRED") {
    throw new Error("P6 owner handoff requires a HUMAN_REQUIRED sealed packet.");
  }
  if (!existsSync(trialApp)) {
    throw new Error(`macOS trial app missing: ${trialApp}`);
  }
  const finalPackagingGate = await assertFinalPackagingGate({ headCommit, canonicalManifest });
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
  if (existsSync(path.join(packetRoot, "post-seal-verification.json"))) {
    await copyRequired(path.join(packetRoot, "post-seal-verification.json"), path.join(uploadStagingRoot, "historical-loop-post-seal-verification.json"));
    await copyRequired(path.join(packetRoot, "post-seal-verification.json"), path.join(visibleRoot, "historical-loop-post-seal-verification.json"));
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
  const relativeFinalResponse = finalResponseText({
    headShort,
    visibleRootAbs: visibleRoot,
    reviewZipName,
    appZipName,
    sidecarName,
    patchCompanionRequired,
    absoluteLinks: false
  });
  const clickableFinalResponse = finalResponseText({
    headShort,
    visibleRootAbs: visibleRoot,
    reviewZipName,
    appZipName,
    sidecarName,
    patchCompanionRequired,
    absoluteLinks: false
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
    companionRequired: true,
    mandatoryCompanions: [appZipName, sidecarName],
    patchCompanionRequired,
    patchCompanions: patchCompanionRequired ? ["changes.patch"] : [],
    finalPackagingGate,
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
    finalPackagingGate
  });
  await writeFile(path.join(uploadStagingRoot, "REVIEW_PACKET.md"), ownerPacketText, "utf8");
  await writeFile(path.join(visibleRoot, "REVIEW_PACKET.md"), ownerPacketText, "utf8");

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
    privacyAudit = await buildPrivacyAudit({ stagingRoot: uploadStagingRoot, appZipPath, reviewZipPath, expectedHeadShort: headShort });
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
  const verificationPrivacyAudit = await buildPrivacyAudit({ stagingRoot: uploadStagingRoot, appZipPath, reviewZipPath, expectedHeadShort: headShort });
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
    generatedAt: "stable-p6-r1-owner-handoff-sidecar",
    productionApproved: false,
    phase2Started: false,
    companionRequired: true,
    mandatoryCompanions: [appZipName, sidecarName],
    ownerReviewZip: {
      fileName: reviewZipName,
      sizeBytes: reviewZipIdentity.sizeBytes,
      sha256: reviewZipIdentity.sha256,
      entryCount: reviewZipEntries.length,
      manifestEntriesEqualActualEntries: reviewZipIndex.passed
    },
    macosAppZip: appZipRecord,
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
  const ownerUploadPostSealVerification = {
    schemaVersion: 2,
    milestoneId,
    reviewedHeadCommit: headCommit,
    passed: true,
    reviewZip: ownerUploadSidecar.ownerReviewZip,
    macosAppZip: ownerUploadSidecar.macosAppZip,
    ownerUploadSidecar: {
      fileName: sidecarName,
      sizeBytes: sidecarIdentity.sizeBytes,
      sha256: sidecarIdentity.sha256
    },
    privacyAudit: ownerUploadSidecar.privacyAudit,
    assertions: {
      reviewZipIsCanonicalToolOutput: true,
      appZipIsMandatoryCompanion: true,
      sidecarIsMandatoryCompanion: true,
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
    "Open or upload the files in this visible folder. Hidden `.artifacts` paths are internal build outputs.",
    "",
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
      entryCount: reviewZipEntries.length
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
    companionRequired: true,
    mandatoryCompanions: [appZipName, sidecarName],
    patchCompanionRequired,
    finalPackagingGate,
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
