import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { internalTrialCsp } from "../server.mjs";

export const appName = "Auto SVGA";
export const bundleIdentifier = "local.auto-svga.internal-prototype";
export const bundleDisplayName = "Auto SVGA";
export const productVersionLine = "0.2.x";
export const productVersion = "0.2.0";
export const productName = "Multi-format Preview MVP";
export const releaseStage = "alpha.2";
export const distributionChannel = "internal";
export const candidateChannel = "local/internal candidate";
export const bundleShortVersion = "0.2.0-alpha.2";
export const bundleVersion = bundleShortVersion;
export const ownerVisibleLabel = `${appName} ${bundleShortVersion} ${distributionChannel} candidate`;
export const platform = "darwin";
export const architecture = "arm64";
export const proofSchemaVersion = 1;
export const finalAcceptanceOwner = "Integration Coordinator";

const experimentRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const repoRoot = path.resolve(experimentRoot, "../../../..");
const prototypeRoot = path.resolve(experimentRoot, "../..");
const requireFromPrototype = createRequire(path.join(prototypeRoot, "package.json"));
const artifactsRoot = path.join(experimentRoot, ".artifacts/internal-trial");
const proofPath = path.join(artifactsRoot, "macos-package-proof.json");
const plistPath = path.join(experimentRoot, "packaging/macos/Info.plist");
const entitlementsPath = path.join(experimentRoot, "packaging/macos/entitlements.plist");
const appIconSourcePath = path.join(experimentRoot, "packaging/macos/app-icon-source.png");
const appIconPath = path.join(experimentRoot, "packaging/macos/app-icon.icns");
export const windowPlacementPackagedSourceFiles = [
  "main.cjs",
  "short-term-window-bounds-policy.cjs",
  "short-term-window-placement-store.cjs"
];
const sourceAuditFiles = [
  ...windowPlacementPackagedSourceFiles,
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
export const packagedRuntimeDependencies = [
  {
    packageName: "protobufjs",
    requiredEntries: ["package.json", "index.js"]
  },
  {
    packageName: "long",
    requiredEntries: ["package.json", "index.js"]
  },
  {
    packageName: "fast-png",
    requiredEntries: ["package.json", "lib/index.js"]
  },
  {
    packageName: "fflate",
    requiredEntries: ["package.json"]
  },
  {
    packageName: "iobuffer",
    requiredEntries: ["package.json"]
  },
  {
    packageName: "lottie-web",
    expectedVersion: "5.13.0",
    requiredEntries: ["package.json", "build/player/lottie_svg.js"]
  },
  {
    packageName: "video-animation-player",
    expectedVersion: "1.0.5",
    requiredEntries: ["package.json", "dist/vap.js"]
  }
];
export const requiredPackagedRuntimeEntries = [
  "/.runtime/build-info.json",
  ...packagedRuntimeDependencies.flatMap((dependency) => (
    dependency.requiredEntries.map((entry) => `/.runtime/node_modules/${dependency.packageName}/${entry}`)
  ))
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
    `--icon=${path.relative(experimentRoot, appIconPath).replace(/\.icns$/, "")}`,
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
  const packagedAsarPath = path.join(appBundle, "Contents/Resources/app.asar");
  const validatePackagedApp = options.validatePackagedApp !== false;
  const packagedPlist = validatePackagedApp && existsSync(packagedPlistPath)
    ? await readFile(packagedPlistPath, "utf8")
    : sourcePlist;
  const buildCommit = git(["rev-parse", "HEAD"]);
  const packagedRuntimeClosure = validatePackagedApp
    ? readPackagedRuntimeClosure(packagedAsarPath, buildCommit)
    : skippedPackagedRuntimeClosure(packagedAsarPath, "packaged app validation disabled");
  const windowPlacementSourceHashes = Object.fromEntries(await Promise.all(
    windowPlacementPackagedSourceFiles.map(async (relativePath) => [
      relativePath,
      await sha256(path.join(experimentRoot, relativePath))
    ])
  ));
  const windowPlacementSourceClosure = validatePackagedApp
    ? readPackagedWindowPlacementSourceClosure(packagedAsarPath, windowPlacementSourceHashes)
    : skippedPackagedWindowPlacementSourceClosure(windowPlacementSourceHashes, "packaged app validation disabled");
  const privacyAudit = await runPrivacyAudit(sourcePlist);
  const sourceInfoPlistSecurityAudit = auditInfoPlistSecurity(sourcePlist);
  const packagedInfoPlistSecurityAudit = auditInfoPlistSecurity(packagedPlist);
  const infoPlistSecurityAudit = mergeInfoPlistSecurityAudits({
    sourceInfoPlistSecurityAudit,
    packagedInfoPlistSecurityAudit
  });
  const appIconSourceStats = await stat(appIconSourcePath);
  const appIconStats = await stat(appIconPath);
  const appIconSourceSha256 = await sha256(appIconSourcePath);
  const appIconSha256 = await sha256(appIconPath);
  const packagedAppIconPath = path.join(appBundle, "Contents/Resources/electron.icns");
  const packagedAppIconExists = validatePackagedApp && existsSync(packagedAppIconPath);
  const packagedAppIconSha256 = packagedAppIconExists ? await sha256(packagedAppIconPath) : null;
  const proof = {
    schemaVersion: proofSchemaVersion,
    appName,
    bundleIdentifier,
    bundleDisplayName,
    bundleVersion,
    bundleShortVersion,
    productIdentity: {
      productVersionLine,
      productVersion,
      productName,
      releaseStage,
      distributionChannel,
      candidateChannel,
      ownerVisibleLabel
    },
    branch: git(["rev-parse", "--abbrev-ref", "HEAD"]),
    buildCommit,
    platform,
    architecture,
    distribution: {
      channel: distributionChannel,
      candidateChannel,
      packageCandidate: true,
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
    appIcon: {
      status: "temporary-owner-provided",
      sourcePngPath: path.relative(repoRoot, appIconSourcePath),
      icnsPath: path.relative(repoRoot, appIconPath),
      sourceSizeBytes: appIconSourceStats.size,
      icnsSizeBytes: appIconStats.size,
      sourceSha256: appIconSourceSha256,
      icnsSha256: appIconSha256,
      packagedIconPath: path.relative(repoRoot, packagedAppIconPath),
      packagedIconSha256: packagedAppIconSha256,
      packagedIconMatchesSource: packagedAppIconExists ? packagedAppIconSha256 === appIconSha256 : null
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
      appIconPath: path.relative(repoRoot, appIconPath),
      extendInfoPath: path.relative(repoRoot, plistPath),
      packagedInfoPlistPath: path.relative(repoRoot, packagedPlistPath),
      packagedInfoPlistValidated: validatePackagedApp && existsSync(packagedPlistPath),
      packagedRuntimeBuildInfo: packagedRuntimeClosure.buildInfo,
      packagedRuntimeClosure,
      windowPlacementSourceClosure,
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
  const packagedRuntimeClosure = proof.packagingScaffold.packagedRuntimeClosure;
  const checks = [
    ["sourceAppIdentity", plistStringValue(plist, "CFBundleName") === appName && plistStringValue(plist, "CFBundleDisplayName") === bundleDisplayName],
    ["packagedAppIdentity", plistStringValue(packagedPlist, "CFBundleName") === appName && plistStringValue(packagedPlist, "CFBundleDisplayName") === bundleDisplayName],
    ["packagedExecutableIdentity", !packagedInfoPlistValidated || plistStringValue(packagedPlist, "CFBundleExecutable") === appName],
    ["sourceBundleVersionStamp", plistStringValue(plist, "CFBundleShortVersionString") === bundleShortVersion && plistStringValue(plist, "CFBundleVersion") === bundleVersion],
    ["packagedBundleVersionStamp", plistStringValue(packagedPlist, "CFBundleShortVersionString") === bundleShortVersion && plistStringValue(packagedPlist, "CFBundleVersion") === bundleVersion],
    ["sourceProductIdentity", plistStringValue(plist, "AutoSVGAProductVersion") === productVersion && plistStringValue(plist, "AutoSVGAReleaseStage") === releaseStage && plistStringValue(plist, "AutoSVGADistributionChannel") === distributionChannel && plistBooleanTrue(plist, "AutoSVGAPackageCandidate")],
    ["packagedProductIdentity", plistStringValue(packagedPlist, "AutoSVGAProductVersion") === productVersion && plistStringValue(packagedPlist, "AutoSVGAReleaseStage") === releaseStage && plistStringValue(packagedPlist, "AutoSVGADistributionChannel") === distributionChannel && plistBooleanTrue(packagedPlist, "AutoSVGAPackageCandidate")],
    ["productIdentity", proof.productIdentity?.productVersion === productVersion && proof.productIdentity?.releaseStage === releaseStage && proof.productIdentity?.distributionChannel === distributionChannel && proof.productIdentity?.candidateChannel === candidateChannel && proof.productIdentity?.ownerVisibleLabel === ownerVisibleLabel],
    ["packagedRuntimeClosure", proof.packagingScaffold.packagedInfoPlistValidated !== true || (packagedRuntimeClosure?.validated === true && packagedRuntimeClosure?.buildInfo?.buildCommit === proof.buildCommit)],
    ["windowPlacementSourceClosure", proof.packagingScaffold.packagedInfoPlistValidated !== true || proof.packagingScaffold.windowPlacementSourceClosure?.validated === true],
    ["internalUseOnly", proof.distribution.internalUseOnly === true && plist.includes("<key>AutoSVGAInternalUseOnly</key>")],
    ["distributionChannel", proof.distribution.channel === distributionChannel && proof.distribution.candidateChannel === candidateChannel && proof.distribution.packageCandidate === true],
    ["unsigned", proof.distribution.unsigned === true && plist.includes("<key>AutoSVGASigned</key>")],
    ["unnotarized", proof.distribution.notarized === false && plist.includes("<key>AutoSVGANotarized</key>")],
    ["productionApprovedFalse", proof.distribution.productionApproved === false && plist.includes("<key>AutoSVGAProductionApproved</key>")],
    ["noSvgaDocumentType", !plist.includes("<key>CFBundleDocumentTypes</key>") && !packagedPlist.includes("<key>CFBundleDocumentTypes</key>") && !plist.includes("<string>svga</string>") && !packagedPlist.includes("<string>svga</string>")],
    ["noUtiDeclaration", !plist.includes("<key>UTExportedTypeDeclarations</key>") && !packagedPlist.includes("<key>UTExportedTypeDeclarations</key>") && !plist.includes("<string>com.auto-svga.svga</string>") && !packagedPlist.includes("<string>com.auto-svga.svga</string>")],
    ["iconArg", proof.packagingScaffold.electronPackagerArgs.some((arg) => arg === "--icon=packaging/macos/app-icon")],
    ["extendInfoArg", proof.packagingScaffold.electronPackagerArgs.some((arg) => arg.startsWith("--extend-info="))],
    ["appIconPath", proof.packagingScaffold.appIconPath === "tools/electron-prototype/experiments/svga-web/packaging/macos/app-icon.icns"],
    ["appIconProof", proof.appIcon?.status === "temporary-owner-provided" && proof.appIcon?.icnsPath === proof.packagingScaffold.appIconPath && typeof proof.appIcon?.icnsSha256 === "string"],
    ["packagedAppIcon", proof.packagingScaffold.packagedInfoPlistValidated !== true || proof.appIcon?.packagedIconMatchesSource === true],
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

function skippedPackagedWindowPlacementSourceClosure(sourceHashes, skippedReason) {
  return {
    validated: false,
    files: windowPlacementPackagedSourceFiles.map((relativePath) => ({
      path: relativePath,
      sourceSha256: sourceHashes[relativePath],
      packagedSha256: null,
      matchesSource: null
    })),
    missingEntries: [],
    findings: [],
    skippedReason
  };
}

function readPackagedWindowPlacementSourceClosure(packagedAsarPath, sourceHashes) {
  const base = skippedPackagedWindowPlacementSourceClosure(sourceHashes, undefined);
  delete base.skippedReason;
  const findings = [];
  if (!existsSync(packagedAsarPath)) {
    return {
      ...base,
      findings: ["packaged app.asar is missing"]
    };
  }

  try {
    const asar = requireFromPrototype("@electron/asar");
    const entries = new Set(asar.listPackage(packagedAsarPath));
    const files = windowPlacementPackagedSourceFiles.map((relativePath) => {
      const packagedEntry = `/${relativePath}`;
      if (!entries.has(packagedEntry)) {
        findings.push(`missing ${packagedEntry}`);
        return {
          path: relativePath,
          sourceSha256: sourceHashes[relativePath],
          packagedSha256: null,
          matchesSource: false
        };
      }
      const packagedSha256 = createHash("sha256")
        .update(asar.extractFile(packagedAsarPath, relativePath))
        .digest("hex");
      const matchesSource = packagedSha256 === sourceHashes[relativePath];
      if (!matchesSource) findings.push(`${packagedEntry} does not match source`);
      return {
        path: relativePath,
        sourceSha256: sourceHashes[relativePath],
        packagedSha256,
        matchesSource
      };
    });
    return {
      ...base,
      validated: findings.length === 0,
      files,
      missingEntries: files.filter((file) => file.packagedSha256 === null).map((file) => `/${file.path}`),
      findings
    };
  } catch {
    return {
      ...base,
      findings: ["packaged window-placement source closure could not be read"]
    };
  }
}

async function sha256(filePath) {
  return createHash("sha256").update(await readFile(filePath)).digest("hex");
}

export function assertPackagedRuntimeClosure(packagedAsarPath, expectedBuildCommit) {
  const closure = readPackagedRuntimeClosure(packagedAsarPath, expectedBuildCommit);
  if (closure.validated !== true) {
    throw new Error(`packagedRuntimeClosure failed: ${closure.findings.join("; ")}`);
  }
  return closure;
}

function skippedPackagedRuntimeClosure(packagedAsarPath, skippedReason) {
  return {
    asarPath: path.relative(repoRoot, packagedAsarPath),
    buildInfoPath: ".runtime/build-info.json",
    validated: false,
    buildInfo: {
      validated: false,
      buildCommit: null,
      source: null,
      skippedReason
    },
    requiredEntries: requiredPackagedRuntimeEntries,
    missingEntries: [],
    dependencies: packagedRuntimeDependencies.map((dependency) => ({
      packageName: dependency.packageName,
      expectedVersion: dependency.expectedVersion ?? null,
      version: null,
      validated: false,
      skippedReason
    })),
    findings: [],
    skippedReason
  };
}

function readPackagedRuntimeClosure(packagedAsarPath, expectedBuildCommit) {
  const base = skippedPackagedRuntimeClosure(packagedAsarPath, undefined);
  delete base.skippedReason;
  const findings = [];
  if (!existsSync(packagedAsarPath)) {
    return {
      ...base,
      findings: ["packaged app.asar is missing"],
      error: "packaged app.asar is missing"
    };
  }

  try {
    const asar = requireFromPrototype("@electron/asar");
    const entries = new Set(asar.listPackage(packagedAsarPath));
    const missingEntries = requiredPackagedRuntimeEntries.filter((entry) => !entries.has(entry));
    for (const entry of missingEntries) findings.push(`missing ${entry}`);

    const buildInfo = readAsarJson(asar, packagedAsarPath, ".runtime/build-info.json");
    const buildCommit = typeof buildInfo.buildCommit === "string" ? buildInfo.buildCommit : null;
    const source = typeof buildInfo.source === "string" ? buildInfo.source : null;
    if (!buildCommit) findings.push("packaged runtime build-info is missing buildCommit");
    if (buildCommit && buildCommit !== expectedBuildCommit) {
      findings.push(`packaged runtime buildCommit ${buildCommit} does not match ${expectedBuildCommit}`);
    }

    const dependencies = packagedRuntimeDependencies.map((dependency) => {
      const packageJsonPath = `.runtime/node_modules/${dependency.packageName}/package.json`;
      let version = null;
      let error = null;
      try {
        const packageJson = readAsarJson(asar, packagedAsarPath, packageJsonPath);
        version = typeof packageJson.version === "string" ? packageJson.version : null;
      } catch (readError) {
        error = readError instanceof Error ? readError.message : String(readError);
      }
      const versionMatches = !dependency.expectedVersion || version === dependency.expectedVersion;
      if (error) findings.push(`${dependency.packageName} package metadata could not be read`);
      if (!versionMatches) {
        findings.push(`${dependency.packageName} version ${version ?? "missing"} does not match ${dependency.expectedVersion}`);
      }
      return {
        packageName: dependency.packageName,
        expectedVersion: dependency.expectedVersion ?? null,
        version,
        requiredEntries: dependency.requiredEntries.map((entry) => `/.runtime/node_modules/${dependency.packageName}/${entry}`),
        validated: !error && versionMatches,
        error
      };
    });

    return {
      ...base,
      validated: findings.length === 0,
      buildInfo: {
        validated: Boolean(buildCommit) && buildCommit === expectedBuildCommit,
        buildCommit,
        source,
        error: Boolean(buildCommit) ? null : "packaged runtime build-info is missing buildCommit"
      },
      missingEntries,
      dependencies,
      findings
    };
  } catch (error) {
    return {
      ...base,
      findings: [error instanceof Error ? error.message : String(error)],
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

function readAsarJson(asar, packagedAsarPath, relativePath) {
  return JSON.parse(asar.extractFile(packagedAsarPath, relativePath).toString("utf8"));
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
