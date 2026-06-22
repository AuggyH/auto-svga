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

const sealedFiles = [
  "REVIEW_PACKET.md",
  "validation.json",
  "budget-check.json",
  "reviewer-a.json",
  "reviewer-b.json",
  "post-seal-verification.json"
];

const textExtensions = new Set([".json", ".md", ".txt", ".html", ".js", ".mjs", ".cjs", ".css", ".patch"]);

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

async function buildPrivacyAudit({ stagingRoot, appZipPath }) {
  const findings = [];
  const scannedEntries = [];
  for (const filePath of await listFiles(stagingRoot)) {
    const bundlePath = toBundlePath(stagingRoot, filePath);
    findings.push(...findPrivacyMatches(bundlePath, `entry:${bundlePath}`));
    const ext = path.extname(filePath).toLowerCase();
    if (!textExtensions.has(ext)) continue;
    scannedEntries.push(bundlePath);
    findings.push(...findPrivacyMatches(await readFile(filePath, "utf8"), bundlePath));
  }
  for (const entry of zipEntries(appZipPath)) {
    findings.push(...findPrivacyMatches(entry, `app-zip-entry:${entry}`));
    if (entry.includes("__MACOSX") || path.basename(entry) === ".DS_Store") {
      findings.push({ ruleId: "FORBIDDEN_ZIP_METADATA", entry });
    }
  }
  return {
    schemaVersion: 1,
    milestoneId,
    passed: findings.length === 0,
    scannedTextEntries: scannedEntries.sort(),
    scannedAppZipEntries: zipEntries(appZipPath).length,
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

function finalResponseText({ headShort, visibleRootAbs, reviewZipName, appZipName, absoluteLinks }) {
  const link = (label, fileName) => {
    const target = absoluteLinks ? path.join(visibleRootAbs, fileName) : fileName;
    return `[${label}](${target})`;
  };
  return [
    "P6_MACHINE_EXECUTION_COMPLETE",
    "",
    "VISIBLE_REVIEW:",
    `- ${link("P6 Review Packet", "REVIEW_PACKET.md")}`,
    `- ${link("P6 Review ZIP", reviewZipName)}`,
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
  ].join("\n");
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
  const relativeFinalResponse = finalResponseText({
    headShort,
    visibleRootAbs: visibleRoot,
    reviewZipName,
    appZipName,
    absoluteLinks: false
  });
  const clickableFinalResponse = finalResponseText({
    headShort,
    visibleRootAbs: visibleRoot,
    reviewZipName,
    appZipName,
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

  const privacyAudit = await buildPrivacyAudit({ stagingRoot: uploadStagingRoot, appZipPath });
  if (!privacyAudit.passed) {
    throw new Error(`P6 owner handoff privacy audit failed: ${privacyAudit.findings.map((finding) => `${finding.ruleId}:${finding.entry}`).join("; ")}`);
  }
  await writeFile(path.join(uploadStagingRoot, "bundle-privacy-audit.json"), `${JSON.stringify(privacyAudit, null, 2)}\n`);
  await writeFile(path.join(visibleRoot, "bundle-privacy-audit.json"), `${JSON.stringify(privacyAudit, null, 2)}\n`);

  const manifestExtra = {
    reviewedHeadCommit: headCommit,
    companionRequired: canonicalManifest.companionRequired === true,
    ownerReviewZip: reviewZipName,
    macosAppZip: {
      fileName: appZipName,
      sizeBytes: appZipIdentity.sizeBytes,
      sha256: appZipIdentity.sha256
    },
    visibleHandoff: {
      canonicalPacketRoot: path.relative(visibleRoot, packetRoot).split(path.sep).join("/")
    },
    privacyAudit: {
      passed: privacyAudit.passed,
      findingCount: privacyAudit.findingCount
    }
  };

  await writeFile(path.join(uploadStagingRoot, "MANIFEST.json"), `${JSON.stringify(await buildManifest(uploadStagingRoot, manifestExtra), null, 2)}\n`);
  const uploadEntries = (await listFiles(uploadStagingRoot)).map((filePath) => toBundlePath(uploadStagingRoot, filePath)).sort();
  runZip({ cwd: uploadStagingRoot, zipPath: reviewZipPath, entries: uploadEntries });
  const reviewZipEntries = zipEntries(reviewZipPath);
  if (JSON.stringify(reviewZipEntries) !== JSON.stringify(uploadEntries)) {
    throw new Error("P6 owner review ZIP entries do not match staging files.");
  }
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
      sha256: appZipIdentity.sha256
    },
    companionRequired: canonicalManifest.companionRequired === true,
    privacyAudit: {
      passed: privacyAudit.passed,
      findingCount: privacyAudit.findingCount
    }
  };
  console.log(`AUTO_SVGA_P6_OWNER_HANDOFF_RESULT=${JSON.stringify(summary)}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack ?? error.message : String(error));
  process.exitCode = 1;
});
