import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { internalTrialCsp } from "../server.mjs";

export const appName = "Auto SVGA";
export const bundleIdentifier = "local.auto-svga.internal-prototype";
export const bundleDisplayName = "Auto SVGA";
export const bundleShortVersion = "0.0.0-internal";
export const bundleVersion = bundleShortVersion;
export const platform = "darwin";
export const architecture = "arm64";
export const proofSchemaVersion = 1;
export const finalAcceptanceOwner = "Integration Coordinator";

const experimentRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const repoRoot = path.resolve(experimentRoot, "../../../..");
const artifactsRoot = path.join(experimentRoot, ".artifacts/internal-trial");
const proofPath = path.join(artifactsRoot, "macos-package-proof.json");
const plistPath = path.join(experimentRoot, "packaging/macos/Info.plist");
const entitlementsPath = path.join(experimentRoot, "packaging/macos/entitlements.plist");
const sourceAuditFiles = [
  "main.cjs",
  "preload.cjs",
  "server.mjs",
  "scripts/macos-signing-workflow.mjs",
  "web/index.html",
  "web/short-term-macos-app.mjs",
  "web/short-term-macos.css",
  "web/workbench.html",
  "web/desktop-product-entry.mjs",
  "web/prototype.js",
  "web/styles.css",
  "package.json",
  "packaging/macos/Info.plist",
  "packaging/macos/entitlements.plist"
];
const forbiddenPermissionUsageDescriptionKeys = [
  "NSCameraUsageDescription",
  "NSMicrophoneUsageDescription",
  "NSBluetoothAlwaysUsageDescription",
  "NSBluetoothPeripheralUsageDescription",
  "NSSpeechRecognitionUsageDescription",
  "NSAppleEventsUsageDescription",
  "NSMotionUsageDescription",
  "NSLocationUsageDescription",
  "NSLocationWhenInUseUsageDescription",
  "NSLocationAlwaysAndWhenInUseUsageDescription",
  "NSPhotoLibraryUsageDescription",
  "NSPhotoLibraryAddUsageDescription",
  "NSContactsUsageDescription",
  "NSCalendarsUsageDescription",
  "NSRemindersUsageDescription",
  "NSDesktopFolderUsageDescription",
  "NSDocumentsFolderUsageDescription",
  "NSDownloadsFolderUsageDescription",
  "NSNetworkVolumesUsageDescription",
  "NSRemovableVolumesUsageDescription",
  "NSSystemAdministrationUsageDescription"
];
const forbiddenArbitraryNetworkKeys = [
  "NSAllowsArbitraryLoads",
  "NSAllowsArbitraryLoadsInWebContent",
  "NSExceptionAllowsInsecureHTTPLoads"
];

export function macosPackagerArgs(outputRoot = ".artifacts/internal-trial") {
  return [
    ".",
    appName,
    "--platform=darwin",
    "--arch=arm64",
    `--out=${outputRoot}`,
    `--app-bundle-id=${bundleIdentifier}`,
    `--app-version=${bundleShortVersion}`,
    `--build-version=${bundleVersion}`,
    "--app-category-type=public.app-category.developer-tools",
    "--overwrite",
    "--prune=true",
    "--asar",
    `--extend-info=${path.relative(experimentRoot, plistPath)}`,
    "--ignore=^/(tests|scripts|\\.artifacts)($|/)"
  ];
}

export async function buildMacosPackageProof(options = {}) {
  const appBundle = options.appBundle
    ? path.resolve(options.appBundle)
    : path.join(artifactsRoot, `${appName}-darwin-arm64/${appName}.app`);
  const archivePath = options.archivePath
    ? path.resolve(options.archivePath)
    : path.join(artifactsRoot, `${appName}-darwin-arm64.zip`);
  const sourcePlist = await readFile(plistPath, "utf8");
  const packagedPlistPath = path.join(appBundle, "Contents/Info.plist");
  const validatePackagedApp = options.validatePackagedApp !== false;
  const packagedPlist = validatePackagedApp && existsSync(packagedPlistPath)
    ? await readFile(packagedPlistPath, "utf8")
    : sourcePlist;
  const privacyAudit = await runPrivacyAudit(sourcePlist);
  const sourceInfoPlistSecurityAudit = auditInfoPlistSecurity(sourcePlist);
  const packagedInfoPlistSecurityAudit = auditInfoPlistSecurity(packagedPlist);
  const infoPlistSecurityAudit = mergeInfoPlistSecurityAudits({
    sourceInfoPlistSecurityAudit,
    packagedInfoPlistSecurityAudit
  });
  const proof = {
    schemaVersion: proofSchemaVersion,
    appName,
    bundleIdentifier,
    bundleDisplayName,
    bundleVersion,
    bundleShortVersion,
    branch: git(["rev-parse", "--abbrev-ref", "HEAD"]),
    buildCommit: git(["rev-parse", "HEAD"]),
    platform,
    architecture,
    distribution: {
      internalUseOnly: true,
      unsigned: true,
      notarized: false,
      productionApproved: false,
      finalPackagedAppAcceptanceOwner: finalAcceptanceOwner
    },
    documentTypes: [],
    documentAssociationPolicy: {
      svgaFinderOpen: "not-declared",
      reason: "Phase-one internal package supports in-app file picker and drag/drop only; Finder document association is disabled until robust open-file support is approved."
    },
    player: {
      package: "svga-web",
      version: "2.4.4"
    },
    csp: internalTrialCsp,
    securityFlags: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      remoteNavigationBlocked: true,
      newWindowsBlocked: true,
      permissionsDenied: true,
      telemetry: false,
      persistedAbsolutePaths: false,
      arbitraryFileServing: false
    },
    metadataSecurity: {
      noArbitraryNetworkLoads: infoPlistSecurityAudit.arbitraryNetworkAllowances.length === 0,
      noUnnecessaryPermissionUsageDescriptions: infoPlistSecurityAudit.permissionUsageDescriptions.length === 0,
      noFinderDocumentAssociation: infoPlistSecurityAudit.finderDocumentAssociations.length === 0,
      localOnlySecurityPosture: true
    },
    infoPlistSecurityAudit,
    packagingScaffold: {
      packageScript: "internal:trial:package:mac",
      signScript: "internal:trial:sign:mac",
      notarizeScript: "internal:trial:notarize:mac",
      signingPlanScript: "internal:trial:signing-plan:mac",
      appBundlePath: path.relative(repoRoot, appBundle),
      archivePath: path.relative(repoRoot, archivePath),
      extendInfoPath: path.relative(repoRoot, plistPath),
      packagedInfoPlistPath: path.relative(repoRoot, packagedPlistPath),
      packagedInfoPlistValidated: validatePackagedApp && existsSync(packagedPlistPath),
      entitlementsPath: path.relative(repoRoot, entitlementsPath),
      electronPackagerArgs: macosPackagerArgs(path.relative(experimentRoot, artifactsRoot))
    },
    privacyAudit,
    knownRisks: [
      "Unsigned and not notarized.",
      "Internal testing only; not approved for production distribution.",
      "Final packaged App acceptance is owned by Integration Coordinator.",
      "Windows runtime is not verified.",
      "Finder double-click .svga open is intentionally not claimed in this internal package."
    ],
    requestedIntegrationChanges: [
      "Add a root package script only if Integration Coordinator wants a top-level packaging entrypoint."
    ],
    generatedAt: new Date().toISOString()
  };
  validateProof(sourcePlist, proof, packagedPlist);
  return proof;
}

export async function writeMacosPackageProof(options = {}) {
  const proof = await buildMacosPackageProof(options);
  const outputPath = options.outputPath ?? proofPath;
  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(proof, null, 2)}\n`);
  return proof;
}

export function validateProof(plist, proof, packagedPlist = plist) {
  const packagedInfoPlistValidated = packagedPlist !== plist;
  const checks = [
    ["sourceAppIdentity", plistStringValue(plist, "CFBundleName") === appName && plistStringValue(plist, "CFBundleDisplayName") === bundleDisplayName],
    ["packagedAppIdentity", plistStringValue(packagedPlist, "CFBundleName") === appName && plistStringValue(packagedPlist, "CFBundleDisplayName") === bundleDisplayName],
    ["packagedExecutableIdentity", !packagedInfoPlistValidated || plistStringValue(packagedPlist, "CFBundleExecutable") === appName],
    ["internalUseOnly", proof.distribution.internalUseOnly === true && plist.includes("<key>AutoSVGAInternalUseOnly</key>")],
    ["unsigned", proof.distribution.unsigned === true && plist.includes("<key>AutoSVGASigned</key>")],
    ["unnotarized", proof.distribution.notarized === false && plist.includes("<key>AutoSVGANotarized</key>")],
    ["productionApprovedFalse", proof.distribution.productionApproved === false && plist.includes("<key>AutoSVGAProductionApproved</key>")],
    ["noSvgaDocumentType", !plist.includes("<key>CFBundleDocumentTypes</key>") && !packagedPlist.includes("<key>CFBundleDocumentTypes</key>") && !plist.includes("<string>svga</string>") && !packagedPlist.includes("<string>svga</string>")],
    ["noUtiDeclaration", !plist.includes("<key>UTExportedTypeDeclarations</key>") && !packagedPlist.includes("<key>UTExportedTypeDeclarations</key>") && !plist.includes("<string>com.auto-svga.svga</string>") && !packagedPlist.includes("<string>com.auto-svga.svga</string>")],
    ["extendInfoArg", proof.packagingScaffold.electronPackagerArgs.some((arg) => arg.startsWith("--extend-info="))],
    ["packagedInfoPlistPath", typeof proof.packagingScaffold.packagedInfoPlistPath === "string" && proof.packagingScaffold.packagedInfoPlistPath.endsWith("Contents/Info.plist")],
    ["entitlementsPath", typeof proof.packagingScaffold.entitlementsPath === "string" && proof.packagingScaffold.entitlementsPath.endsWith("entitlements.plist")],
    ["signingScripts", proof.packagingScaffold.signScript === "internal:trial:sign:mac" && proof.packagingScaffold.notarizeScript === "internal:trial:notarize:mac"],
    ["privacyAuditPassed", proof.privacyAudit.passed === true],
    ["infoPlistSecurityAuditPassed", proof.infoPlistSecurityAudit?.passed === true && auditInfoPlistSecurity(plist).passed === true && auditInfoPlistSecurity(packagedPlist).passed === true],
    ["noArbitraryNetworkLoads", proof.metadataSecurity?.noArbitraryNetworkLoads === true],
    ["noUnnecessaryPermissionUsageDescriptions", proof.metadataSecurity?.noUnnecessaryPermissionUsageDescriptions === true],
    ["noFinderDocumentAssociation", proof.metadataSecurity?.noFinderDocumentAssociation === true],
    ["acceptanceOwner", proof.distribution.finalPackagedAppAcceptanceOwner === finalAcceptanceOwner]
  ];
  const failed = checks.filter(([, passed]) => !passed).map(([name]) => name);
  if (failed.length > 0) throw new Error(`macOS package proof failed: ${failed.join(", ")}`);
}

function mergeInfoPlistSecurityAudits({ sourceInfoPlistSecurityAudit, packagedInfoPlistSecurityAudit }) {
  return {
    passed: sourceInfoPlistSecurityAudit.passed === true && packagedInfoPlistSecurityAudit.passed === true,
    source: sourceInfoPlistSecurityAudit,
    packagedApp: packagedInfoPlistSecurityAudit,
    arbitraryNetworkAllowances: [
      ...new Set([
        ...sourceInfoPlistSecurityAudit.arbitraryNetworkAllowances,
        ...packagedInfoPlistSecurityAudit.arbitraryNetworkAllowances
      ])
    ],
    permissionUsageDescriptions: [
      ...new Set([
        ...sourceInfoPlistSecurityAudit.permissionUsageDescriptions,
        ...packagedInfoPlistSecurityAudit.permissionUsageDescriptions
      ])
    ],
    finderDocumentAssociations: [
      ...new Set([
        ...sourceInfoPlistSecurityAudit.finderDocumentAssociations,
        ...packagedInfoPlistSecurityAudit.finderDocumentAssociations
      ])
    ],
    findings: [
      ...sourceInfoPlistSecurityAudit.findings.map((finding) => `source:${finding}`),
      ...packagedInfoPlistSecurityAudit.findings.map((finding) => `packaged:${finding}`)
    ]
  };
}

export function auditInfoPlistSecurity(plist) {
  const arbitraryNetworkAllowances = forbiddenArbitraryNetworkKeys.filter((key) => plistBooleanTrue(plist, key));
  const permissionUsageDescriptions = forbiddenPermissionUsageDescriptionKeys.filter((key) => plistKeyPresent(plist, key));
  const finderDocumentAssociations = [
    "CFBundleDocumentTypes",
    "UTExportedTypeDeclarations",
    "UTImportedTypeDeclarations"
  ].filter((key) => plistKeyPresent(plist, key));
  if (/<string>\s*svga\s*<\/string>/i.test(plist) || /public\.filename-extension[\s\S]*<string>\s*svga\s*<\/string>/i.test(plist)) {
    finderDocumentAssociations.push("svga-filename-extension");
  }
  const findings = [
    ...arbitraryNetworkAllowances.map((key) => `${key}=true is not allowed for the local-only internal package`),
    ...permissionUsageDescriptions.map((key) => `${key} is not allowed unless the app actually uses that permission`),
    ...finderDocumentAssociations.map((key) => `${key} is not allowed until Finder open-file support is implemented`)
  ];
  return {
    passed: findings.length === 0,
    arbitraryNetworkAllowances,
    permissionUsageDescriptions,
    finderDocumentAssociations,
    findings
  };
}

function plistKeyPresent(plist, key) {
  return new RegExp(`<key>\\s*${escapeRegExp(key)}\\s*<\\/key>`).test(plist);
}

function plistBooleanTrue(plist, key) {
  return new RegExp(`<key>\\s*${escapeRegExp(key)}\\s*<\\/key>\\s*<true\\s*\\/>`, "m").test(plist);
}

function plistStringValue(plist, key) {
  return new RegExp(`<key>\\s*${escapeRegExp(key)}\\s*<\\/key>\\s*<string>([^<]*)<\\/string>`, "m").exec(plist)?.[1];
}

async function runPrivacyAudit(plist) {
  const username = os.userInfo().username;
  const scans = [];
  for (const relativePath of sourceAuditFiles) {
    const absolutePath = path.join(experimentRoot, relativePath);
    const text = await readFile(absolutePath, "utf8");
    scans.push(scanText(relativePath, text, username));
  }
  const proofTargetPaths = [
    path.relative(repoRoot, plistPath),
    ...sourceAuditFiles.map((file) => path.relative(repoRoot, path.join(experimentRoot, file)))
  ];
  return {
    passed: scans.every((scan) => scan.passed),
    rules: {
      noRepoAbsolutePath: true,
      noUsername: true,
      noCdnOrPublicNetworkDependency: true,
      noRealUserAssets: true
    },
    scannedFiles: [...new Set(proofTargetPaths)].sort(),
    findings: scans.flatMap((scan) => scan.findings)
  };
}

function scanText(relativePath, text, username) {
  const findings = [];
  const slash = "/";
  const repoPathLiterals = [
    repoRoot,
    experimentRoot,
    [slash, "Users", slash].join(""),
    [slash, "home", slash].join("")
  ];
  for (const literal of repoPathLiterals) {
    if (literal && text.includes(literal)) findings.push(`${relativePath}: contains local absolute path literal`);
  }
  if (username && text.includes(username)) findings.push(`${relativePath}: contains local username`);
  if (/(cdn\.jsdelivr|unpkg\.com|https?:\/\/)/i.test(stripAllowedLocalUrls(stripPlistDoctype(text, relativePath)))) {
    findings.push(`${relativePath}: contains public network URL or CDN dependency`);
  }
  if (/\.(psd|sketch|fig|figma|mov|mp4|gif|webm|svga|png)/i.test(relativePath) && !relativePath.includes("fixture")) {
    findings.push(`${relativePath}: unexpected asset file in packaging source audit`);
  }
  return {
    relativePath,
    passed: findings.length === 0,
    findings
  };
}

function stripPlistDoctype(text, relativePath) {
  if (!relativePath.endsWith(".plist")) return text;
  return text.replace(/<!DOCTYPE[^>]+>/g, "");
}

function stripAllowedLocalUrls(text) {
  return text.replace(/https?:\/\/(?:127\.0\.0\.1|localhost|\[::1\])(?::\d+)?/g, "<loopback>");
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function git(args, options = {}) {
  try {
    return execFileSync("git", args, { cwd: repoRoot, encoding: "utf8" }).trim();
  } catch (error) {
    if (options.optional) return "";
    throw error;
  }
}

async function fileExists(filePath) {
  try {
    return (await stat(filePath)).isFile();
  } catch {
    return false;
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  const outputIndex = process.argv.indexOf("--output");
  const outputPath = outputIndex >= 0 ? path.resolve(process.argv[outputIndex + 1]) : proofPath;
  const proof = await writeMacosPackageProof({ outputPath });
  if (await fileExists(outputPath)) {
    console.log(JSON.stringify({
      proof: path.relative(repoRoot, outputPath),
      branch: proof.branch,
      buildCommit: proof.buildCommit,
      privacyAuditPassed: proof.privacyAudit.passed,
      finalPackagedAppAcceptanceOwner: proof.distribution.finalPackagedAppAcceptanceOwner
    }, null, 2));
  }
}
