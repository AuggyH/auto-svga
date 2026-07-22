import { execFileSync, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  closeSync,
  constants,
  existsSync,
  fsyncSync,
  fstatSync,
  lstatSync,
  mkdirSync,
  openSync,
  readFileSync,
  readlinkSync,
  readdirSync,
  realpathSync,
  renameSync,
  rmSync,
  writeFileSync
} from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const modulePath = fileURLToPath(import.meta.url);
const repoRoot = path.resolve(path.dirname(modulePath), "../..");
const trialRoot = path.join(repoRoot, "tools/electron-prototype/experiments/svga-web/.artifacts/internal-trial");

export const fixedTrialPackageContract = Object.freeze({
  appName: "Auto SVGA",
  bundleDisplayName: "Auto SVGA",
  bundleIdentifier: "local.auto-svga.internal-prototype",
  platform: "darwin",
  architecture: "arm64",
  manifestPath: "tools/electron-prototype/experiments/svga-web/.artifacts/internal-trial/internal-trial-manifest.json",
  proofPath: "tools/electron-prototype/experiments/svga-web/.artifacts/internal-trial/macos-package-proof.json",
  appPath: "tools/electron-prototype/experiments/svga-web/.artifacts/internal-trial/Auto SVGA-darwin-arm64/Auto SVGA.app",
  archivePath: "tools/electron-prototype/experiments/svga-web/.artifacts/internal-trial/Auto SVGA-darwin-arm64.zip",
  appAsarPath: "tools/electron-prototype/experiments/svga-web/.artifacts/internal-trial/Auto SVGA-darwin-arm64/Auto SVGA.app/Contents/Resources/app.asar",
  archiveAppAsarEntry: "Auto SVGA.app/Contents/Resources/app.asar"
});

const runtimeDependencies = [
  { packageName: "protobufjs", entries: ["package.json", "index.js"] },
  { packageName: "long", entries: ["package.json", "index.js"] },
  { packageName: "fast-png", entries: ["package.json", "lib/index.js"] },
  { packageName: "fflate", entries: ["package.json"] },
  { packageName: "iobuffer", entries: ["package.json"] },
  { packageName: "lottie-web", entries: ["package.json", "build/player/lottie_svg.js"] },
  { packageName: "video-animation-player", entries: ["package.json", "dist/vap.js"] }
];

const legacyLocalRuntimeVersions = {
  protobufjs: "8.6.4",
  long: "5.3.2",
  "fast-png": "8.0.0",
  fflate: "0.8.3",
  iobuffer: "6.0.1",
  "lottie-web": "5.13.0",
  "video-animation-player": "1.0.5"
};

function readCurrentSourceRuntimeVersions() {
  const packageJson = JSON.parse(readFileSync(path.join(repoRoot, "package.json"), "utf8"));
  const versions = { ...legacyLocalRuntimeVersions };
  for (const packageName of ["protobufjs", "fast-png", "lottie-web", "video-animation-player"]) {
    const version = packageJson.dependencies?.[packageName];
    if (typeof version !== "string" || !/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(version)) {
      throw new Error(`Source dependency ${packageName} must use an exact version for runtime closure authority`);
    }
    versions[packageName] = version;
  }
  return versions;
}

export const legacyLocalRuntimeVersionAuthority = Object.freeze({
  schemaVersion: 1,
  authorityId: "legacy-local-runtime-2026-07-09",
  authoritySource: "role-policy:installed-or-previous",
  runtimeRoles: Object.freeze(["legacy-retained", "installed", "previous", "candidate-copy"]),
  dependencyVersions: Object.freeze({ ...legacyLocalRuntimeVersions })
});

export const currentSourceRuntimeVersionAuthority = Object.freeze({
  schemaVersion: 1,
  authorityId: "current-source-runtime",
  authoritySource: "source:package.json+fixed-transitive-runtime-contract",
  runtimeRoles: Object.freeze(["candidate"]),
  dependencyVersions: Object.freeze(readCurrentSourceRuntimeVersions())
});

const retainedCurrentRuntimeVersions = {
  ...legacyLocalRuntimeVersions,
  protobufjs: "8.6.6"
};

export const retainedRuntimeVersionAuthorities = Object.freeze([
  Object.freeze({
    schemaVersion: 1,
    authorityId: "retained-runtime-protobufjs-8.6.6",
    authoritySource: "retained-policy:0.2.0-alpha.2",
    runtimeRoles: Object.freeze(["installed", "previous", "candidate-copy"]),
    dependencyVersions: Object.freeze({ ...retainedCurrentRuntimeVersions })
  })
]);

// Lifecycle: before a source dependency bump can be promoted, its exact closure
// must be appended to this retained allowlist. Remove an entry only after no
// installed app, previous bundle, or supported rollback can still carry it.
const defaultRetainedRuntimeAuthorities = Object.freeze([
  legacyLocalRuntimeVersionAuthority,
  ...retainedRuntimeVersionAuthorities
]);
const candidateRuntimeAuthorityCapabilities = new WeakMap();

export const requiredRuntimeEntries = [
  "/.runtime/build-info.json",
  ...runtimeDependencies.flatMap((dependency) => (
    dependency.entries.map((entry) => `/.runtime/node_modules/${dependency.packageName}/${entry}`)
  ))
];

function sha256Buffer(buffer) {
  return createHash("sha256").update(buffer).digest("hex");
}

function sha256File(filePath) {
  return sha256Buffer(readFileSync(filePath));
}

function statIdentity(stat) {
  return {
    dev: String(stat.dev),
    ino: String(stat.ino),
    mode: stat.mode,
    nlink: stat.nlink,
    size: stat.size,
    mtimeMs: stat.mtimeMs,
    ctimeMs: stat.ctimeMs
  };
}

function isInsidePath(candidate, root) {
  const relative = path.relative(root, candidate);
  return relative === "" || (!relative.startsWith(`..${path.sep}`) && relative !== ".." && !path.isAbsolute(relative));
}

function normalizeBundlePath(relativePath) {
  return relativePath.split(path.sep).join("/");
}

function isSafeRelativeLinkTarget(target) {
  return typeof target === "string"
    && target.length > 0
    && !path.isAbsolute(target)
    && !target.split("/").includes("..");
}

function isAllowedBundleSymlink(relativePath, target) {
  const normalizedPath = normalizeBundlePath(relativePath);
  if (!normalizedPath.startsWith("Contents/Frameworks/")) return false;
  if (!isSafeRelativeLinkTarget(target)) return false;

  const frameworkMatch = normalizedPath.match(/(^|\/)([^/]+\.framework)\/(.+)$/);
  if (!frameworkMatch) return false;
  const frameworkName = frameworkMatch[2].replace(/\.framework$/, "");
  const frameworkRelativePath = frameworkMatch[3];
  if (frameworkRelativePath === "Versions/Current") return target === "A";
  if (frameworkRelativePath === frameworkName) return target === `Versions/Current/${frameworkName}`;
  if (["Resources", "Libraries", "Helpers"].includes(frameworkRelativePath)) {
    return target === `Versions/Current/${frameworkRelativePath}`;
  }
  return false;
}

function inspectBundleCatalog(appPath, rootRealPath) {
  const catalog = [];
  let sizeBytes = 0;

  function visit(directoryPath) {
    for (const entry of readdirSync(directoryPath, { withFileTypes: true }).sort((left, right) => left.name.localeCompare(right.name))) {
      const entryPath = path.join(directoryPath, entry.name);
      const relativePath = path.relative(appPath, entryPath);
      const stat = lstatSync(entryPath);
      if (stat.isSymbolicLink()) {
        const linkTarget = readlinkSync(entryPath);
        if (!isAllowedBundleSymlink(relativePath, linkTarget)) {
          throw new Error(`App bundle symlink is not allowed: ${entryPath} -> ${linkTarget}`);
        }
        const resolved = realpathSync.native(entryPath);
        if (!isInsidePath(resolved, rootRealPath)) {
          throw new Error(`App bundle symlink escapes its bundle: ${entryPath} -> ${resolved}`);
        }
        catalog.push({ path: normalizeBundlePath(relativePath), type: "symlink", target: linkTarget });
        continue;
      }
      if (stat.isFile()) {
        if (stat.nlink !== 1) throw new Error(`App bundle hardlink is not allowed: ${entryPath}`);
        sizeBytes += stat.size;
        catalog.push({ path: normalizeBundlePath(relativePath), type: "file", ...statIdentity(stat) });
        continue;
      }
      if (stat.isDirectory()) {
        catalog.push({ path: normalizeBundlePath(relativePath), type: "directory", ...statIdentity(stat) });
        visit(entryPath);
        continue;
      }
      throw new Error(`Unsupported app bundle entry type: ${entryPath}`);
    }
  }

  visit(appPath);
  return {
    catalogDigest: sha256Buffer(Buffer.from(JSON.stringify(catalog))),
    entryCount: catalog.length,
    sizeBytes
  };
}

function assertRegularUniqueFile(filePath) {
  const stat = lstatSync(filePath);
  if (!stat.isFile() || stat.isSymbolicLink()) throw new Error(`Expected a regular file: ${filePath}`);
  if (stat.nlink !== 1) throw new Error(`Critical app file is hardlinked: ${filePath}`);
  return stat;
}

function assertSameStatIdentity(left, right, label) {
  if (JSON.stringify(statIdentity(left)) !== JSON.stringify(statIdentity(right))) {
    throw new Error(`${label} changed while it was being inspected`);
  }
}

function assertFileStatIsRegularUnique(stat, filePath) {
  if (!stat.isFile()) throw new Error(`Expected a regular file: ${filePath}`);
  if (stat.nlink !== 1) throw new Error(`Critical app file is hardlinked: ${filePath}`);
}

function readNoFollowCriticalFile(filePath, label) {
  const statBefore = assertRegularUniqueFile(filePath);
  let descriptor;
  try {
    descriptor = openSync(filePath, constants.O_RDONLY | constants.O_NOFOLLOW);
  } catch (error) {
    throw new Error(`${label} must be opened as a no-follow regular file: ${error.message}`);
  }
  try {
    const descriptorStatBefore = fstatSync(descriptor);
    assertFileStatIsRegularUnique(descriptorStatBefore, filePath);
    assertSameStatIdentity(statBefore, descriptorStatBefore, label);
    const bytes = readFileSync(descriptor);
    const descriptorStatAfter = fstatSync(descriptor);
    assertFileStatIsRegularUnique(descriptorStatAfter, filePath);
    assertSameStatIdentity(descriptorStatBefore, descriptorStatAfter, label);
    const pathStatAfter = assertRegularUniqueFile(filePath);
    assertSameStatIdentity(descriptorStatAfter, pathStatAfter, label);
    return {
      path: filePath,
      bytes,
      sha256: sha256Buffer(bytes),
      object: statIdentity(descriptorStatBefore)
    };
  } finally {
    closeSync(descriptor);
  }
}

function alignInt(value, alignment) {
  return value + ((alignment - (value % alignment)) % alignment);
}

function readPickleUInt32(buffer, label) {
  if (buffer.length < 8) throw new Error(`${label} pickle is too short`);
  const payloadSize = buffer.readUInt32LE(0);
  const headerSize = buffer.length - payloadSize;
  if (payloadSize !== 4 || headerSize < 4 || headerSize !== alignInt(headerSize, 4)) {
    throw new Error(`${label} has an invalid pickle header`);
  }
  return buffer.readUInt32LE(headerSize);
}

function readPickleString(buffer, label) {
  if (buffer.length < 8) throw new Error(`${label} pickle is too short`);
  const payloadSize = buffer.readUInt32LE(0);
  const headerSize = buffer.length - payloadSize;
  if (payloadSize <= 4 || headerSize < 4 || headerSize !== alignInt(headerSize, 4)) {
    throw new Error(`${label} has an invalid pickle header`);
  }
  const stringLength = buffer.readInt32LE(headerSize);
  if (stringLength < 0 || alignInt(4 + stringLength, 4) > payloadSize) {
    throw new Error(`${label} has an invalid pickle string length`);
  }
  return buffer.subarray(headerSize + 4, headerSize + 4 + stringLength).toString("utf8");
}

function readAsarArchiveFromBytes(bytes) {
  if (bytes.length < 8) throw new Error("app.asar is too small to contain an ASAR header");
  const headerSize = readPickleUInt32(bytes.subarray(0, 8), "app.asar size");
  const headerEnd = 8 + headerSize;
  if (headerEnd > bytes.length) throw new Error("app.asar header exceeds archive size");
  const headerString = readPickleString(bytes.subarray(8, headerEnd), "app.asar header");
  return {
    bytes,
    headerSize,
    dataOffset: headerEnd,
    header: JSON.parse(headerString)
  };
}

function asarEntryForPath(archive, filePath) {
  const segments = filePath.replace(/^\/+/, "").split("/").filter(Boolean);
  let node = archive.header;
  for (const segment of segments) {
    if (!node?.files?.[segment]) throw new Error(`Missing ASAR entry: ${filePath}`);
    node = node.files[segment];
  }
  if (!node || node.files || node.link) throw new Error(`ASAR entry is not a regular file: ${filePath}`);
  if (node.unpacked) throw new Error(`ASAR entry is unexpectedly unpacked: ${filePath}`);
  if (!Number.isInteger(node.size) || node.size < 0 || typeof node.offset !== "string") {
    throw new Error(`ASAR entry has invalid size/offset: ${filePath}`);
  }
  return node;
}

function extractAsarFile(archive, filePath) {
  const entry = asarEntryForPath(archive, filePath);
  const offset = archive.dataOffset + Number.parseInt(entry.offset, 10);
  const end = offset + entry.size;
  if (!Number.isSafeInteger(offset) || offset < archive.dataOffset || end > archive.bytes.length) {
    throw new Error(`ASAR entry is outside archive byte bounds: ${filePath}`);
  }
  return archive.bytes.subarray(offset, end);
}

function listAsarFiles(archive) {
  const files = [];
  function visit(node, prefix) {
    for (const [name, child] of Object.entries(node.files ?? {}).sort(([left], [right]) => left.localeCompare(right))) {
      const childPath = `${prefix}/${name}`;
      if (child.files) visit(child, childPath);
      else files.push(childPath);
    }
  }
  visit(archive.header, "");
  return files;
}

export function readDefaultPlistIdentity(plistFile) {
  const bytes = plistFile?.bytes ?? readNoFollowCriticalFile(plistFile, "Info.plist").bytes;
  const trimmed = bytes.toString("utf8").trimStart();
  const plist = trimmed.startsWith("{")
    ? JSON.parse(trimmed)
    : JSON.parse(execFileSync("/usr/bin/plutil", ["-convert", "json", "-o", "-", "--", "-"], {
      input: bytes,
      encoding: "utf8",
      stdio: "pipe"
    }));
  return {
    bundleIdentifier: plist.CFBundleIdentifier ?? plist.bundleIdentifier ?? null,
    name: plist.CFBundleName ?? plist.name,
    displayName: plist.CFBundleDisplayName ?? plist.displayName,
    executable: plist.CFBundleExecutable ?? plist.executable,
    shortVersion: plist.CFBundleShortVersionString ?? plist.shortVersion ?? null,
    bundleVersion: plist.CFBundleVersion ?? plist.bundleVersion ?? null,
    productVersion: plist.AutoSVGAProductVersion ?? plist.productVersion ?? null,
    releaseStage: plist.AutoSVGAReleaseStage ?? plist.releaseStage ?? null,
    distributionChannel: plist.AutoSVGADistributionChannel ?? plist.distributionChannel ?? null,
    internalUseOnly: plist.AutoSVGAInternalUseOnly ?? plist.internalUseOnly ?? null,
    signed: plist.AutoSVGASigned ?? plist.signed ?? null,
    notarized: plist.AutoSVGANotarized ?? plist.notarized ?? null,
    productionApproved: plist.AutoSVGAProductionApproved ?? plist.productionApproved ?? null,
    marker: plist.marker
  };
}

function assertLowerHex(value, length, label) {
  if (typeof value !== "string" || !new RegExp(`^[0-9a-f]{${length}}$`).test(value)) {
    throw new Error(`${label} must be a ${length}-character lowercase hexadecimal value`);
  }
}

function runtimeAuthoritiesForRole(runtimeRole, runtimeAuthorities) {
  if (runtimeAuthorities !== undefined) {
    throw new Error(`Runtime role ${runtimeRole} does not accept caller-supplied version authorities`);
  }
  if (runtimeRole === "legacy-retained") return [legacyLocalRuntimeVersionAuthority];
  if (["installed", "previous", "candidate-copy"].includes(runtimeRole)) {
    return defaultRetainedRuntimeAuthorities;
  }
  if (runtimeRole === "candidate") {
    throw new Error("Candidate runtime authority is available only inside one fixed-package inspection operation");
  }
  throw new Error(`Unsupported runtime role ${runtimeRole}`);
}

function resolveRuntimeVersionAuthorityFromAuthorities({
  buildInfo,
  appAsarSha256,
  dependencyVersions,
  runtimeRole
}, authorities) {
  assertLowerHex(appAsarSha256, 64, "appAsarSha256");
  const matches = authorities.filter((authority) => (
    authority.runtimeRoles.includes(runtimeRole)
    && (!authority.buildCommit || authority.buildCommit === buildInfo?.buildCommit)
    && (!authority.appAsarSha256 || authority.appAsarSha256 === appAsarSha256)
    && runtimeDependencies.every(({ packageName }) => (
      authority.dependencyVersions[packageName] === dependencyVersions[packageName]
    ))
  ));
  if (matches.length !== 1) {
    const authority = authorities[0];
    const findings = [];
    if (!authority.runtimeRoles.includes(runtimeRole)) {
      findings.push(`authority ${authority.authorityId} does not allow runtime role ${runtimeRole}`);
    }
    if (authority.buildCommit && authority.buildCommit !== buildInfo?.buildCommit) {
      findings.push(`buildCommit ${buildInfo?.buildCommit ?? "missing"} does not match ${authority.buildCommit}`);
    }
    if (authority.appAsarSha256 && authority.appAsarSha256 !== appAsarSha256) {
      findings.push(`app.asar sha256 ${appAsarSha256} does not match ${authority.appAsarSha256}`);
    }
    for (const { packageName } of runtimeDependencies) {
      if (dependencyVersions[packageName] !== authority.dependencyVersions[packageName]) {
        findings.push(
          `${packageName} version ${dependencyVersions[packageName] ?? "missing"} does not match ${authority.dependencyVersions[packageName]}`
        );
      }
    }
    if (findings.length === 0) findings.push(`runtime identity matches ${matches.length} authorities instead of exactly one`);
    throw new Error(`App runtime closure failed for ${runtimeRole}: ${findings.join("; ")}`);
  }
  const matched = matches[0];
  return {
    schemaVersion: 1,
    authorityId: matched.authorityId,
    authoritySource: matched.authoritySource,
    runtimeRole,
    buildCommit: buildInfo.buildCommit,
    appAsarSha256,
    dependencyVersions: { ...matched.dependencyVersions }
  };
}

export function resolveRuntimeVersionAuthority({
  buildInfo,
  appAsarSha256,
  dependencyVersions,
  runtimeRole = "legacy-retained",
  runtimeAuthorities
}) {
  return resolveRuntimeVersionAuthorityFromAuthorities({
    buildInfo,
    appAsarSha256,
    dependencyVersions,
    runtimeRole
  }, runtimeAuthoritiesForRole(runtimeRole, runtimeAuthorities));
}

function runtimeDependencyVersionsFromEvidence(closure, buildCommit, label) {
  if (closure?.validated !== true) throw new Error(`${label} is not validated`);
  if (closure.buildInfo?.validated !== true) throw new Error(`${label} build-info is not validated`);
  if (closure.buildInfo.buildCommit !== buildCommit) {
    throw new Error(`${label} buildCommit ${closure.buildInfo.buildCommit ?? "missing"} does not match ${buildCommit}`);
  }
  if (closure.buildInfo.source !== "package-internal-trial") {
    throw new Error(`${label} build-info source is not package-internal-trial`);
  }
  if (!Array.isArray(closure.missingEntries) || closure.missingEntries.length !== 0) {
    throw new Error(`${label} has missing runtime entries`);
  }
  if (!Array.isArray(closure.findings) || closure.findings.length !== 0) {
    throw new Error(`${label} has runtime findings`);
  }
  const dependencies = new Map();
  for (const dependency of closure.dependencies ?? []) {
    if (dependencies.has(dependency.packageName)) throw new Error(`${label} repeats ${dependency.packageName}`);
    if (dependency.validated !== true || dependency.error) {
      throw new Error(`${label} does not validate ${dependency.packageName}`);
    }
    dependencies.set(dependency.packageName, dependency.version);
  }
  const expectedNames = runtimeDependencies.map(({ packageName }) => packageName);
  if (dependencies.size !== expectedNames.length || expectedNames.some((name) => !dependencies.has(name))) {
    throw new Error(`${label} dependency set does not match the required runtime closure`);
  }
  return Object.fromEntries(expectedNames.map((name) => [name, dependencies.get(name)]));
}

export function deriveCandidateRuntimeVersionAuthorityDescriptor({
  buildCommit,
  appAsarSha256,
  manifestRuntimeClosure,
  proofRuntimeClosure
}) {
  assertLowerHex(buildCommit, 40, "candidate buildCommit");
  assertLowerHex(appAsarSha256, 64, "candidate appAsarSha256");
  const manifestVersions = runtimeDependencyVersionsFromEvidence(
    manifestRuntimeClosure,
    buildCommit,
    "manifest packagedRuntimeClosure"
  );
  const proofVersions = runtimeDependencyVersionsFromEvidence(
    proofRuntimeClosure,
    buildCommit,
    "proof packagedRuntimeClosure"
  );
  for (const { packageName } of runtimeDependencies) {
    const sourceVersion = currentSourceRuntimeVersionAuthority.dependencyVersions[packageName];
    if (manifestVersions[packageName] !== proofVersions[packageName]) {
      throw new Error(`Candidate manifest/proof disagree on ${packageName} version`);
    }
    if (manifestVersions[packageName] !== sourceVersion) {
      throw new Error(
        `Candidate ${packageName} version ${manifestVersions[packageName] ?? "missing"} does not match source authority ${sourceVersion}`
      );
    }
  }
  return Object.freeze({
    schemaVersion: 1,
    authorityId: `candidate-package-${buildCommit}`,
    authoritySource: "package-manifest+package-proof+source-runtime-contract",
    runtimeRoles: Object.freeze(["candidate"]),
    buildCommit,
    appAsarSha256,
    dependencyVersions: Object.freeze({ ...manifestVersions })
  });
}

function createCandidateRuntimeVersionAuthority(evidence, binding) {
  const capability = Object.freeze({});
  candidateRuntimeAuthorityCapabilities.set(capability, {
    authority: deriveCandidateRuntimeVersionAuthorityDescriptor(evidence),
    operation: binding.operation,
    appPath: binding.appPath,
    stabilityFingerprint: binding.stabilityFingerprint,
    consumed: false
  });
  return capability;
}

export function validateCandidatePackageDeclarations({ manifest, proof, expectedHead }) {
  const errors = [];
  const requireExact = (actual, expected, label) => {
    if (actual !== expected) errors.push(`${label} ${actual ?? "missing"} does not match ${expected}`);
  };

  requireExact(manifest?.appName, fixedTrialPackageContract.appName, "manifest appName");
  requireExact(manifest?.bundleDisplayName, fixedTrialPackageContract.bundleDisplayName, "manifest bundleDisplayName");
  requireExact(manifest?.bundleIdentifier, fixedTrialPackageContract.bundleIdentifier, "manifest bundleIdentifier");
  requireExact(manifest?.platform, fixedTrialPackageContract.platform, "manifest platform");
  requireExact(manifest?.architecture, fixedTrialPackageContract.architecture, "manifest architecture");
  requireExact(manifest?.buildCommit, expectedHead, "manifest buildCommit");
  requireExact(manifest?.packagePath, fixedTrialPackageContract.appPath, "manifest packagePath");
  requireExact(manifest?.archivePath, fixedTrialPackageContract.archivePath, "manifest archivePath");
  requireExact(manifest?.proofManifestPath, fixedTrialPackageContract.proofPath, "manifest proofManifestPath");
  requireExact(manifest?.packagedRuntimeClosure?.asarPath, fixedTrialPackageContract.appAsarPath, "manifest runtime app.asar path");

  requireExact(proof?.appName, manifest?.appName, "proof appName");
  requireExact(proof?.bundleDisplayName, manifest?.bundleDisplayName, "proof bundleDisplayName");
  requireExact(proof?.bundleIdentifier, manifest?.bundleIdentifier, "proof bundleIdentifier");
  requireExact(proof?.bundleShortVersion, manifest?.version, "proof short version");
  requireExact(proof?.bundleVersion, manifest?.bundleVersion, "proof bundle version");
  requireExact(proof?.platform, manifest?.platform, "proof platform");
  requireExact(proof?.architecture, manifest?.architecture, "proof architecture");
  requireExact(proof?.buildCommit, expectedHead, "proof buildCommit");
  requireExact(proof?.packagingScaffold?.appBundlePath, fixedTrialPackageContract.appPath, "proof appBundlePath");
  requireExact(proof?.packagingScaffold?.archivePath, fixedTrialPackageContract.archivePath, "proof archivePath");
  requireExact(
    proof?.packagingScaffold?.packagedRuntimeClosure?.asarPath,
    fixedTrialPackageContract.appAsarPath,
    "proof runtime app.asar path"
  );

  if (typeof manifest?.sha256 !== "string" || !/^[0-9a-f]{64}$/.test(manifest.sha256)) {
    errors.push("manifest archive sha256 must be a 64-character lowercase hexadecimal value");
  }
  if (manifest?.productionApproved !== false) errors.push("manifest productionApproved must be false");
  if (manifest?.distribution?.internalUseOnly !== true) errors.push("manifest distribution.internalUseOnly must be true");
  if (manifest?.distribution?.unsigned !== true) errors.push("manifest distribution.unsigned must be true");
  if (manifest?.distribution?.notarized !== false) errors.push("manifest distribution.notarized must be false");
  if (proof?.distribution?.internalUseOnly !== true) errors.push("proof distribution.internalUseOnly must be true");
  if (proof?.privacyAudit?.passed !== true) errors.push("proof privacy audit did not pass");

  if (errors.length > 0) throw new Error(`Candidate package evidence failed: ${errors.join("; ")}`);
  return true;
}

function assertFixedTrialPath(candidatePath, expectedType, label) {
  const resolvedTrialRoot = path.resolve(trialRoot);
  const resolvedCandidate = path.resolve(candidatePath);
  if (!isInsidePath(resolvedCandidate, resolvedTrialRoot)) {
    throw new Error(`${label} escapes the fixed trial root`);
  }
  const trialStat = lstatSync(resolvedTrialRoot);
  if (!trialStat.isDirectory() || trialStat.isSymbolicLink()) {
    throw new Error("Fixed trial root must be a real directory");
  }
  const relative = path.relative(resolvedTrialRoot, resolvedCandidate);
  let current = resolvedTrialRoot;
  for (const segment of relative.split(path.sep).filter(Boolean)) {
    current = path.join(current, segment);
    const stat = lstatSync(current);
    if (stat.isSymbolicLink()) throw new Error(`${label} contains a symbolic-link path component: ${current}`);
  }
  const candidateStat = lstatSync(resolvedCandidate);
  if (expectedType === "directory" && !candidateStat.isDirectory()) {
    throw new Error(`${label} must be a directory`);
  }
  if (expectedType === "file" && (!candidateStat.isFile() || candidateStat.nlink !== 1)) {
    throw new Error(`${label} must be a unique regular file`);
  }
  const realTrialRoot = realpathSync.native(resolvedTrialRoot);
  const realCandidate = realpathSync.native(resolvedCandidate);
  if (!isInsidePath(realCandidate, realTrialRoot)) throw new Error(`${label} escapes the canonical trial root`);
  return resolvedCandidate;
}

function readArchiveEntryFromDescriptor(descriptor, entryPath) {
  return execFileSync("/usr/bin/unzip", ["-p", "/dev/fd/3", entryPath], {
    encoding: null,
    maxBuffer: 512 * 1024 * 1024,
    stdio: ["ignore", "pipe", "pipe", descriptor]
  });
}

export function readStableArchiveEvidence(archivePath, entryPath, dependencies = {}) {
  if (Object.hasOwn(dependencies, "readArchiveEntry")) {
    throw new Error("Candidate archive entry must come from the same opened archive object");
  }
  if (
    typeof entryPath !== "string"
    || entryPath.length === 0
    || path.isAbsolute(entryPath)
    || entryPath.split("/").includes("..")
  ) {
    throw new Error("Candidate archive entry path must be a contained relative path");
  }
  const beforeArchiveEntryRead = dependencies.beforeArchiveEntryRead ?? (() => {});
  const afterArchiveEntryRead = dependencies.afterArchiveEntryRead ?? (() => {});
  const pathStatBefore = assertRegularUniqueFile(archivePath);
  if (pathStatBefore.size > 512 * 1024 * 1024) throw new Error("Candidate archive exceeds the inspection byte limit");
  let descriptor;
  try {
    descriptor = openSync(archivePath, constants.O_RDONLY | constants.O_NOFOLLOW);
    const descriptorStatBefore = fstatSync(descriptor);
    assertFileStatIsRegularUnique(descriptorStatBefore, archivePath);
    assertSameStatIdentity(pathStatBefore, descriptorStatBefore, "Candidate archive");
    const archiveBytes = readFileSync(descriptor);
    const descriptorStatAfterHash = fstatSync(descriptor);
    assertSameStatIdentity(descriptorStatBefore, descriptorStatAfterHash, "Candidate archive");
    let entryBytes;
    beforeArchiveEntryRead();
    try {
      entryBytes = readArchiveEntryFromDescriptor(descriptor, entryPath);
    } finally {
      afterArchiveEntryRead();
    }
    if (!Buffer.isBuffer(entryBytes)) throw new Error("Candidate archive entry reader must return bytes");
    const descriptorStatAfterEntry = fstatSync(descriptor);
    const pathStatAfter = assertRegularUniqueFile(archivePath);
    assertSameStatIdentity(descriptorStatAfterHash, descriptorStatAfterEntry, "Candidate archive");
    assertSameStatIdentity(descriptorStatAfterEntry, pathStatAfter, "Candidate archive");
    return {
      archiveSha256: sha256Buffer(archiveBytes),
      entrySha256: sha256Buffer(entryBytes),
      archiveObject: statIdentity(descriptorStatBefore),
      archiveSizeBytes: descriptorStatBefore.size,
      entrySizeBytes: entryBytes.length
    };
  } finally {
    if (descriptor !== undefined) closeSync(descriptor);
  }
}

function readStableJson(filePath, label) {
  const input = readNoFollowCriticalFile(filePath, label);
  return JSON.parse(input.bytes.toString("utf8"));
}

export function inspectFixedTrialCandidatePackage({ expectedHead }) {
  assertLowerHex(expectedHead, 40, "expected candidate HEAD");
  const manifestFile = assertFixedTrialPath(path.join(repoRoot, fixedTrialPackageContract.manifestPath), "file", "Candidate manifest");
  const proofFile = assertFixedTrialPath(path.join(repoRoot, fixedTrialPackageContract.proofPath), "file", "Candidate proof");
  const sourceApp = assertFixedTrialPath(path.join(repoRoot, fixedTrialPackageContract.appPath), "directory", "Candidate App");
  const sourceArchive = assertFixedTrialPath(path.join(repoRoot, fixedTrialPackageContract.archivePath), "file", "Candidate archive");
  const sourceAppAsar = assertFixedTrialPath(path.join(repoRoot, fixedTrialPackageContract.appAsarPath), "file", "Candidate app.asar");
  const manifest = readStableJson(manifestFile, "Candidate manifest");
  const proof = readStableJson(proofFile, "Candidate proof");
  validateCandidatePackageDeclarations({ manifest, proof, expectedHead });
  const archiveEvidence = readStableArchiveEvidence(
    sourceArchive,
    fixedTrialPackageContract.archiveAppAsarEntry
  );
  if (archiveEvidence.archiveSha256 !== manifest.sha256) {
    throw new Error("Candidate archive sha256 does not match the mandatory manifest hash");
  }
  const sourceAppAsarInput = readNoFollowCriticalFile(sourceAppAsar, "Candidate app.asar");
  if (archiveEvidence.entrySha256 !== sourceAppAsarInput.sha256) {
    throw new Error("Candidate source app.asar does not match the stable archive entry");
  }

  let candidateRuntimeEvidence;
  const candidateIdentity = inspectAppBundleCore(sourceApp, {}, {
    readRuntimeIdentity: (asarFile) => {
      candidateRuntimeEvidence = readDefaultRuntimeEvidence(asarFile);
      return {
        buildInfo: candidateRuntimeEvidence.buildInfo,
        buildInfoSha256: candidateRuntimeEvidence.buildInfoSha256,
        runtimeClosure: candidateRuntimeEvidence.runtimeClosure
      };
    }
  });
  if (!candidateRuntimeEvidence) throw new Error("Candidate runtime evidence was not inspected");
  if (candidateIdentity.appPath !== sourceApp || candidateIdentity.realPath !== sourceApp) {
    throw new Error("Candidate App inspection did not bind the exact canonical App path");
  }
  if (candidateIdentity.appAsar.sha256 !== sourceAppAsarInput.sha256) {
    throw new Error("Candidate App inspection does not match the fixed app.asar object");
  }
  if (candidateIdentity.buildInfo.buildCommit !== expectedHead) {
    throw new Error("Candidate App buildCommit does not match the expected candidate HEAD");
  }

  const operation = Object.freeze({});
  const candidateRuntimeAuthority = createCandidateRuntimeVersionAuthority({
    buildCommit: expectedHead,
    appAsarSha256: candidateIdentity.appAsar.sha256,
    manifestRuntimeClosure: manifest.packagedRuntimeClosure,
    proofRuntimeClosure: proof.packagingScaffold.packagedRuntimeClosure
  }, {
    operation,
    appPath: candidateIdentity.appPath,
    stabilityFingerprint: candidateIdentity.stabilityFingerprint
  });
  const authorizedRuntimeIdentity = consumeCandidateRuntimeVersionAuthority(candidateRuntimeAuthority, {
    operation,
    identity: candidateIdentity,
    runtimeEvidence: candidateRuntimeEvidence
  });
  candidateIdentity.runtimeClosure = authorizedRuntimeIdentity.runtimeClosure;
  return {
    manifest,
    proof,
    sourceApp,
    sourceArchive,
    head: expectedHead,
    archiveEvidence,
    candidateIdentity
  };
}

function readDefaultRuntimeEvidence(asarFile) {
  const asarInput = asarFile?.bytes ? asarFile : readNoFollowCriticalFile(asarFile, "app.asar");
  const bytes = asarInput.bytes;
  const appAsarSha256 = asarInput.sha256 ?? sha256Buffer(bytes);
  const archive = readAsarArchiveFromBytes(bytes);
  const entries = new Set(listAsarFiles(archive));
  const missingEntries = requiredRuntimeEntries.filter((entry) => !entries.has(entry));
  const buildInfoBuffer = extractAsarFile(archive, ".runtime/build-info.json");
  const buildInfo = JSON.parse(buildInfoBuffer.toString("utf8"));
  const dependencyVersions = {};
  const dependencies = runtimeDependencies.map((dependency) => {
    const packageJsonPath = `.runtime/node_modules/${dependency.packageName}/package.json`;
    const packageJson = JSON.parse(extractAsarFile(archive, packageJsonPath).toString("utf8"));
    dependencyVersions[dependency.packageName] = packageJson.version;
    return {
      packageName: dependency.packageName,
      version: packageJson.version
    };
  });
  const findings = missingEntries.map((entry) => `missing ${entry}`);
  if (typeof buildInfo.buildCommit !== "string" || !/^[0-9a-f]{40}$/.test(buildInfo.buildCommit)) {
    findings.push("runtime build-info has no full buildCommit");
  }
  if (buildInfo.source !== "package-internal-trial") {
    findings.push(`runtime build-info source is ${buildInfo.source ?? "missing"}, expected package-internal-trial`);
  }
  if (findings.length > 0) throw new Error(`App runtime closure failed: ${findings.join("; ")}`);
  return {
    appAsarSha256,
    buildInfo,
    buildInfoSha256: sha256Buffer(buildInfoBuffer),
    dependencyVersions,
    runtimeClosure: {
      validated: false,
      requiredEntries: requiredRuntimeEntries,
      missingEntries,
      dependencies,
      findings: []
    }
  };
}

function runtimeIdentityFromEvidence(evidence, versionAuthority) {
  const dependencies = evidence.runtimeClosure.dependencies.map((dependency) => ({
    ...dependency,
    expectedVersion: versionAuthority.dependencyVersions[dependency.packageName],
    validated: dependency.version === versionAuthority.dependencyVersions[dependency.packageName]
  }));
  return {
    buildInfo: evidence.buildInfo,
    buildInfoSha256: evidence.buildInfoSha256,
    runtimeClosure: {
      ...evidence.runtimeClosure,
      validated: true,
      dependencies,
      versionAuthority
    }
  };
}

function consumeCandidateRuntimeVersionAuthority(capability, { operation, identity, runtimeEvidence }) {
  const state = candidateRuntimeAuthorityCapabilities.get(capability);
  candidateRuntimeAuthorityCapabilities.delete(capability);
  if (!state || state.consumed) {
    throw new Error("Candidate runtime authority capability is unavailable or already consumed");
  }
  state.consumed = true;
  if (state.operation !== operation) throw new Error("Candidate runtime authority operation does not match");
  if (state.appPath !== identity.appPath) throw new Error("Candidate runtime authority App path does not match");
  if (state.stabilityFingerprint !== identity.stabilityFingerprint) {
    throw new Error("Candidate runtime authority App fingerprint does not match");
  }
  if (runtimeEvidence.appAsarSha256 !== identity.appAsar.sha256) {
    throw new Error("Candidate runtime authority app.asar fingerprint does not match");
  }
  const versionAuthority = resolveRuntimeVersionAuthorityFromAuthorities({
    buildInfo: runtimeEvidence.buildInfo,
    appAsarSha256: runtimeEvidence.appAsarSha256,
    dependencyVersions: runtimeEvidence.dependencyVersions,
    runtimeRole: "candidate"
  }, [state.authority]);
  return runtimeIdentityFromEvidence(runtimeEvidence, versionAuthority);
}

export function readDefaultRuntimeIdentity(asarFile, options = {}) {
  const evidence = readDefaultRuntimeEvidence(asarFile);
  const versionAuthority = resolveRuntimeVersionAuthority({
    buildInfo: evidence.buildInfo,
    appAsarSha256: evidence.appAsarSha256,
    dependencyVersions: evidence.dependencyVersions,
    runtimeRole: options.runtimeRole,
    runtimeAuthorities: options.runtimeAuthorities
  });
  return runtimeIdentityFromEvidence(evidence, versionAuthority);
}

/*
 * Compatibility entry points kept for tests and callers that import the default
 * readers directly. inspectAppBundle itself passes descriptor-bound objects.
 */
export function readDefaultPlistIdentityFromPath(plistPath) {
  return readDefaultPlistIdentity(plistPath);
}

export function readDefaultRuntimeIdentityFromPath(asarPath) {
  return readDefaultRuntimeIdentity(asarPath);
}

function inspectAppBundleCore(appPath, dependencies = {}, internal = {}) {
  const resolvedInput = path.resolve(appPath);
  if (!path.isAbsolute(appPath)) throw new Error(`App path must be absolute: ${appPath}`);
  if (!existsSync(resolvedInput)) throw new Error(`App bundle is missing: ${resolvedInput}`);
  const rootStatBefore = lstatSync(resolvedInput);
  if (!rootStatBefore.isDirectory() || rootStatBefore.isSymbolicLink()) {
    throw new Error(`App bundle root must be a real directory: ${resolvedInput}`);
  }
  const rootRealPath = realpathSync.native(resolvedInput);
  if (rootRealPath !== resolvedInput) {
    throw new Error(`App bundle path aliases another path: ${resolvedInput} -> ${rootRealPath}`);
  }

  const plistPath = path.join(resolvedInput, "Contents/Info.plist");
  const asarPath = path.join(resolvedInput, "Contents/Resources/app.asar");
  const executablePath = path.join(resolvedInput, "Contents/MacOS/Auto SVGA");
  const criticalPaths = [plistPath, asarPath, executablePath];
  const criticalStatsBefore = new Map();
  for (const criticalPath of criticalPaths) {
    if (!existsSync(criticalPath)) throw new Error(`Critical app file is missing: ${criticalPath}`);
    criticalStatsBefore.set(criticalPath, statIdentity(assertRegularUniqueFile(criticalPath)));
  }

  const readPlistIdentity = dependencies.readPlistIdentity ?? readDefaultPlistIdentity;
  const readRuntimeIdentity = internal.readRuntimeIdentity ?? dependencies.readRuntimeIdentity ?? readDefaultRuntimeIdentity;
  const plistFile = readNoFollowCriticalFile(plistPath, "Info.plist");
  const asarFile = readNoFollowCriticalFile(asarPath, "app.asar");
  const plistSha256 = plistFile.sha256;
  const asarSha256 = asarFile.sha256;
  const plistIdentity = readPlistIdentity(plistFile);
  if (
    plistIdentity.name !== "Auto SVGA"
    || plistIdentity.displayName !== "Auto SVGA"
    || plistIdentity.executable !== "Auto SVGA"
  ) {
    throw new Error(
      `Unexpected app identity: name=${plistIdentity.name}, displayName=${plistIdentity.displayName}, executable=${plistIdentity.executable}`
    );
  }
  const runtimeIdentity = readRuntimeIdentity(asarFile, {
    runtimeRole: dependencies.runtimeRole ?? "legacy-retained",
    runtimeAuthorities: dependencies.runtimeAuthorities
  });
  const catalog = inspectBundleCatalog(resolvedInput, rootRealPath);
  const rootStatAfter = lstatSync(resolvedInput);
  if (JSON.stringify(statIdentity(rootStatBefore)) !== JSON.stringify(statIdentity(rootStatAfter))) {
    throw new Error(`App bundle root changed while it was being inspected: ${resolvedInput}`);
  }
  for (const criticalPath of criticalPaths) {
    const after = statIdentity(assertRegularUniqueFile(criticalPath));
    if (JSON.stringify(criticalStatsBefore.get(criticalPath)) !== JSON.stringify(after)) {
      throw new Error(`Critical app file changed while it was being inspected: ${criticalPath}`);
    }
  }
  if (plistSha256 !== sha256File(plistPath) || asarSha256 !== sha256File(asarPath)) {
    throw new Error(`Critical app bytes changed while they were being inspected: ${resolvedInput}`);
  }
  const identity = {
    appPath: resolvedInput,
    realPath: rootRealPath,
    rootObject: statIdentity(rootStatBefore),
    catalogDigest: catalog.catalogDigest,
    entryCount: catalog.entryCount,
    sizeBytes: catalog.sizeBytes,
    infoPlist: {
      sha256: plistSha256,
      ...plistIdentity
    },
    appAsar: {
      sha256: asarSha256
    },
    buildInfo: {
      sha256: runtimeIdentity.buildInfoSha256,
      ...runtimeIdentity.buildInfo
    },
    runtimeClosure: runtimeIdentity.runtimeClosure
  };
  identity.stabilityFingerprint = sha256Buffer(Buffer.from(JSON.stringify({
    rootObject: identity.rootObject,
    catalogDigest: identity.catalogDigest,
    infoPlistSha256: identity.infoPlist.sha256,
    appAsarSha256: identity.appAsar.sha256,
    buildInfoSha256: identity.buildInfo.sha256,
    buildCommit: identity.buildInfo.buildCommit
  })));
  return identity;
}

export function inspectAppBundle(appPath, dependencies = {}) {
  if (dependencies.runtimeRole === "candidate") {
    throw new Error("Candidate App inspection is available only inside one fixed-package inspection operation");
  }
  return inspectAppBundleCore(appPath, dependencies);
}

function identityMatchesBinding(identity, binding) {
  return Boolean(
    identity
    && binding
    && identity.buildInfo.buildCommit === binding.buildCommit
    && identity.infoPlist.sha256 === binding.infoPlistSha256
    && identity.appAsar.sha256 === binding.appAsarSha256
    && identity.buildInfo.sha256 === binding.buildInfoSha256
    && identity.runtimeClosure?.validated === true
    && identity.runtimeClosure?.missingEntries?.length === 0
  );
}

export function classifyRollbackState({ installed, previous, bindings, stage }) {
  if (!bindings) return { state: "no-bound-rollback", recoverable: false };
  const original = identityMatchesBinding(installed, bindings.installed)
    && identityMatchesBinding(previous, bindings.previous);
  const swapped = identityMatchesBinding(installed, bindings.previous)
    && identityMatchesBinding(previous, bindings.installed);
  const stageValid = !stage || identityMatchesBinding(stage, bindings.previous);
  if (original) return { state: "original-roles", recoverable: true, stageValid };
  if (swapped) return { state: "swapped-roles", recoverable: true, stageValid };
  return { state: "ambiguous-role-bytes", recoverable: false, stageValid };
}

export function previousBackupPathForTarget(target) {
  return path.join(path.dirname(target), "Auto SVGA.previous.bundle");
}

export function legacyPreviousAppPathForTarget(target) {
  return path.join(path.dirname(target), "Auto SVGA.previous.app");
}

function inspectBundleIfExists(appPath, inspectBundle) {
  return existsSync(appPath) ? inspectBundle(appPath) : null;
}

export function inspectRecoveryState({
  target,
  candidateApp,
  rollbackJournalPath,
  rollbackManifestPath,
  inspectBundle = inspectAppBundle,
  now = () => new Date(),
  readJson = (filePath) => JSON.parse(readFileSync(filePath, "utf8"))
}) {
  const previous = previousBackupPathForTarget(target);
  const legacyPrevious = legacyPreviousAppPathForTarget(target);
  const installedIdentity = inspectBundle(target, { runtimeRole: "installed" });
  const previousIdentity = inspectBundleIfExists(
    previous,
    (appPath) => inspectBundle(appPath, { runtimeRole: "previous" })
  );
  const legacyPreviousIdentity = inspectBundleIfExists(
    legacyPrevious,
    (appPath) => inspectBundle(appPath, { runtimeRole: "previous" })
  );
  const result = {
    schemaVersion: 1,
    operation: "inspect-local-stable-recovery",
    inspectedAt: now().toISOString(),
    mutationPerformed: false,
    installed: installedIdentity,
    previous: previousIdentity,
    previousPath: previous,
    legacyPrevious: legacyPreviousIdentity,
    legacyPreviousPath: legacyPrevious,
    candidate: inspectBundle(candidateApp, { runtimeRole: "candidate-copy" })
  };
  if (rollbackJournalPath) {
    result.rollback = {
      journalPath: rollbackJournalPath,
      journalExists: existsSync(rollbackJournalPath),
      journalNextPath: `${rollbackJournalPath}.next`,
      journalNextExists: existsSync(`${rollbackJournalPath}.next`),
      manifestPath: rollbackManifestPath,
      manifestExists: Boolean(rollbackManifestPath && existsSync(rollbackManifestPath))
    };
    if (result.rollback.journalExists) {
      const journal = readJson(rollbackJournalPath);
      let stage = null;
      let stageError = null;
      if (existsSync(journal.stageApp)) {
        try {
          stage = inspectBundle(journal.stageApp, { runtimeRole: "previous" });
        } catch (error) {
          stageError = error instanceof Error ? error.message : String(error);
        }
      }
      result.rollback.journal = journal;
      result.rollback.stage = stage;
      result.rollback.stageError = stageError;
      if (result.rollback.journalNextExists) {
        result.rollback.journalNext = readJson(result.rollback.journalNextPath);
      }
      result.rollback.classification = classifyRollbackState({
        installed: installedIdentity,
        previous: previousIdentity,
        bindings: journal.bindings,
        stage
      });
      if (stageError) result.rollback.classification.stageValid = false;
    }
  }
  return result;
}

function assertHex(value, length, label) {
  if (typeof value !== "string" || !new RegExp(`^[0-9a-f]{${length}}$`).test(value)) {
    throw new Error(`${label} must be a ${length}-character lowercase hexadecimal value`);
  }
}

export function validateRollbackBindings(bindings) {
  for (const role of ["installed", "previous"]) {
    const binding = bindings?.[role];
    if (!binding) throw new Error(`Missing ${role} rollback binding`);
    assertHex(binding.buildCommit, 40, `${role}.buildCommit`);
    assertHex(binding.infoPlistSha256, 64, `${role}.infoPlistSha256`);
    assertHex(binding.appAsarSha256, 64, `${role}.appAsarSha256`);
    assertHex(binding.buildInfoSha256, 64, `${role}.buildInfoSha256`);
  }
}

function assertIdentityMatchesBinding(identity, binding, label) {
  const mismatches = [];
  if (identity.buildInfo.buildCommit !== binding.buildCommit) mismatches.push("buildCommit");
  if (identity.infoPlist.sha256 !== binding.infoPlistSha256) mismatches.push("Info.plist sha256");
  if (identity.appAsar.sha256 !== binding.appAsarSha256) mismatches.push("app.asar sha256");
  if (identity.buildInfo.sha256 !== binding.buildInfoSha256) mismatches.push("build-info sha256");
  if (identity.runtimeClosure?.validated !== true || identity.runtimeClosure?.missingEntries?.length !== 0) {
    mismatches.push("runtime closure");
  }
  if (mismatches.length > 0) {
    throw new Error(`${label} does not match caller binding: ${mismatches.join(", ")}`);
  }
}

function assertStableIdentity(before, after, label) {
  if (before.stabilityFingerprint !== after.stabilityFingerprint) {
    throw new Error(`${label} changed after preflight; refusing rollback`);
  }
}

function assertRollbackPaths(target, previous) {
  if (path.basename(target) !== "Auto SVGA.app") throw new Error(`Unexpected target app name: ${target}`);
  if (path.basename(previous) !== "Auto SVGA.previous.bundle") throw new Error(`Unexpected previous bundle name: ${previous}`);
  if (path.dirname(target) !== path.dirname(previous)) throw new Error("Installed and previous app must share one directory");
  if (target === previous) throw new Error("Installed and previous app paths must be distinct");
}

export function assertNoTargetProcess(target) {
  const executablePath = path.join(target, "Contents/MacOS/Auto SVGA");
  let psOutput;
  try {
    psOutput = execFileSync("/bin/ps", ["-axo", "pid=,comm="], { encoding: "utf8", stdio: "pipe" });
  } catch (error) {
    throw new Error(`Target process state is unavailable from ps: ${error.message}`);
  }
  const psMatches = psOutput.split("\n").map((line) => line.trim()).filter((line) => {
    const command = line.replace(/^\d+\s+/, "");
    return command === executablePath;
  });
  if (psMatches.length > 0) throw new Error(`Target Auto SVGA process is running: ${psMatches.join("; ")}`);

  const pgrep = spawnSync("/usr/bin/pgrep", ["-x", "Auto SVGA"], { encoding: "utf8" });
  if (pgrep.error || ![0, 1].includes(pgrep.status)) {
    throw new Error("Target process state is unavailable from pgrep");
  }
  if (pgrep.status === 0) {
    throw new Error(`An Auto SVGA process is running or ambiguous: ${pgrep.stdout.trim()}`);
  }
  return { ps: "clear", pgrep: "clear" };
}

function registerLaunchServices(target) {
  const lsregister = "/System/Library/Frameworks/CoreServices.framework/Frameworks/LaunchServices.framework/Support/lsregister";
  if (!existsSync(lsregister)) throw new Error(`LaunchServices registration tool is missing: ${lsregister}`);
  execFileSync(lsregister, ["-f", target], { encoding: "utf8", stdio: "pipe" });
  return true;
}

function copyBundle(source, destination) {
  execFileSync("/usr/bin/ditto", [source, destination], { encoding: "utf8", stdio: "pipe" });
}

function fsyncDirectory(directoryPath) {
  const descriptor = openSync(directoryPath, "r");
  try {
    fsyncSync(descriptor);
  } finally {
    closeSync(descriptor);
  }
}

function writeJsonExclusive(filePath, value) {
  mkdirSync(path.dirname(filePath), { recursive: true });
  let descriptor;
  let created = false;
  try {
    descriptor = openSync(filePath, "wx", 0o600);
    created = true;
    writeFileSync(descriptor, `${JSON.stringify(value, null, 2)}\n`);
    fsyncSync(descriptor);
    closeSync(descriptor);
    descriptor = undefined;
    fsyncDirectory(path.dirname(filePath));
  } catch (error) {
    if (descriptor !== undefined) closeSync(descriptor);
    if (created) {
      rmSync(filePath, { force: true });
      fsyncDirectory(path.dirname(filePath));
    }
    throw error;
  }
}

function replaceJsonDurably(filePath, value) {
  const temporaryPath = `${filePath}.next`;
  if (existsSync(temporaryPath)) throw new Error(`Journal update residue already exists: ${temporaryPath}`);
  writeJsonExclusive(temporaryPath, value);
  renameSync(temporaryPath, filePath);
  fsyncDirectory(path.dirname(filePath));
}

function removeDurably(filePath) {
  rmSync(filePath, { recursive: true, force: false });
  fsyncDirectory(path.dirname(filePath));
}

export function atomicSwapApps(left, right, authority) {
  if (!authority?.leftObject?.dev || !authority?.leftObject?.ino || !authority?.rightObject?.dev || !authority?.rightObject?.ino) {
    throw new Error("Atomic swap requires exact caller-bound directory object identities");
  }
  const helperPath = path.join(path.dirname(modulePath), "atomic-swap-darwin.py");
  const output = execFileSync("/usr/bin/python3", [
    helperPath,
    left,
    right,
    authority.leftObject.dev,
    authority.leftObject.ino,
    authority.rightObject.dev,
    authority.rightObject.ino
  ], {
    encoding: "utf8",
    stdio: "pipe"
  });
  const result = JSON.parse(output);
  if (
    result.primitive !== "renameatx_np"
    || result.flags !== "RENAME_SWAP"
    || result.left !== left
    || result.right !== right
    || result.leftObject.dev !== authority.leftObject.dev
    || result.leftObject.ino !== authority.leftObject.ino
    || result.rightObject.dev !== authority.rightObject.dev
    || result.rightObject.ino !== authority.rightObject.ino
    || result.parentDirectoryFsynced !== true
  ) {
    throw new Error("Atomic swap helper returned an unexpected primitive binding");
  }
  return result;
}

function compactIdentity(identity) {
  return {
    appPath: identity.appPath,
    catalogDigest: identity.catalogDigest,
    entryCount: identity.entryCount,
    sizeBytes: identity.sizeBytes,
    infoPlist: identity.infoPlist,
    appAsar: identity.appAsar,
    buildInfo: identity.buildInfo,
    runtimeClosure: identity.runtimeClosure
  };
}

function defaultDependencies(overrides = {}) {
  return {
    exists: existsSync,
    readJson: (filePath) => JSON.parse(readFileSync(filePath, "utf8")),
    inspectBundle: inspectAppBundle,
    sha256File,
    assertNoProcess: assertNoTargetProcess,
    copyBundle,
    atomicSwap: atomicSwapApps,
    removeDurably,
    registerLaunchServices,
    writeJournalInitial: writeJsonExclusive,
    updateJournal: replaceJsonDurably,
    writeManifestExclusive: writeJsonExclusive,
    now: () => new Date(),
    checkpoint: () => {},
    ...overrides
  };
}

function rollbackPaths({ target, rollbackId, rollbackManifestPath, rollbackJournalPath }) {
  const previous = previousBackupPathForTarget(target);
  const stage = path.join(path.dirname(target), `.Auto-SVGA.rollback-${rollbackId}.stage.bundle`);
  return {
    previous,
    stage,
    rollbackManifestPath,
    rollbackJournalPath
  };
}

function assertRollbackId(rollbackId) {
  if (typeof rollbackId !== "string" || !/^[A-Za-z0-9][A-Za-z0-9._-]{0,79}$/.test(rollbackId)) {
    throw new Error("rollbackId must contain only safe alphanumeric, dot, underscore, or dash characters");
  }
}

function assertPreflightIdentities({ installedBefore, previousBefore, bindings }) {
  assertIdentityMatchesBinding(installedBefore, bindings.installed, "Installed app");
  assertIdentityMatchesBinding(previousBefore, bindings.previous, "Previous app");
  if (installedBefore.buildInfo.buildCommit === previousBefore.buildInfo.buildCommit) {
    throw new Error("Installed and previous apps have the same buildCommit; rollback is ambiguous");
  }
  if (installedBefore.appAsar.sha256 === previousBefore.appAsar.sha256) {
    throw new Error("Installed and previous apps have the same app.asar; rollback is ambiguous");
  }
}

function buildRollbackManifest({ rollbackId, target, previous, processPrecheck, installedBefore, previousBefore, installedAfter, previousAfter, now }) {
  return {
    schemaVersion: 2,
    operation: "rollback-previous",
    rollbackId,
    performedAt: now.toISOString(),
    retrySafe: false,
    invocationCount: 1,
    atomicPrimitive: {
      name: "renameatx_np",
      flags: "RENAME_SWAP",
      parentDirectoryFsynced: true
    },
    targetApp: target,
    previousApp: previous,
    processPrecheck,
    before: {
      installed: compactIdentity(installedBefore),
      previous: compactIdentity(previousBefore)
    },
    after: {
      installed: compactIdentity(installedAfter),
      previous: compactIdentity(previousAfter)
    },
    launchServicesRegistered: true
  };
}

function stableStringify(value) {
  if (Array.isArray(value)) return `[${value.map((entry) => stableStringify(entry)).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value).sort().map((key) => (
      `${JSON.stringify(key)}:${stableStringify(value[key])}`
    )).join(",")}}`;
  }
  return JSON.stringify(value);
}

function assertJsonObject(value, label) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${label} must be a JSON object`);
  }
}

function assertIsoDate(value, label) {
  if (typeof value !== "string") throw new Error(`${label} must be an ISO timestamp`);
  const date = new Date(value);
  if (Number.isNaN(date.getTime()) || date.toISOString() !== value) {
    throw new Error(`${label} must be an ISO timestamp`);
  }
  return date;
}

function assertRecoveryManifestMatches({
  manifest,
  rollbackId,
  target,
  previous,
  bindings,
  journal,
  installed,
  previousIdentity
}) {
  assertJsonObject(manifest, "Existing rollback manifest");
  assertJsonObject(manifest.processPrecheck, "Existing rollback manifest processPrecheck");
  assertIdentityMatchesBinding(journal.before.installed, bindings.installed, "Journal installed app");
  assertIdentityMatchesBinding(journal.before.previous, bindings.previous, "Journal previous app");
  assertIdentityMatchesBinding(installed, bindings.previous, "Recovered installed app");
  assertIdentityMatchesBinding(previousIdentity, bindings.installed, "Recovered previous app");

  const expected = buildRollbackManifest({
    rollbackId,
    target,
    previous,
    processPrecheck: manifest.processPrecheck,
    installedBefore: journal.before.installed,
    previousBefore: journal.before.previous,
    installedAfter: installed,
    previousAfter: previousIdentity,
    now: assertIsoDate(manifest.performedAt, "Existing rollback manifest performedAt")
  });
  if (stableStringify(manifest) !== stableStringify(expected)) {
    throw new Error("Existing rollback manifest does not exactly match recovered byte roles and journal authority");
  }
}

function assertJournalBoundManifestBytes({ journal, manifestSha256 }) {
  if (typeof journal.manifestSha256 !== "string" || !/^[0-9a-f]{64}$/.test(journal.manifestSha256)) {
    throw new Error("Existing rollback manifest is not bound to a durable journal manifestSha256");
  }
  if (manifestSha256 !== journal.manifestSha256) {
    throw new Error("Existing rollback manifest SHA-256 does not match the durable journal authority");
  }
}

export function rollbackPreviousApp({
  target,
  rollbackId,
  bindings,
  rollbackManifestPath,
  rollbackJournalPath,
  dependencies: dependencyOverrides = {}
}) {
  assertRollbackId(rollbackId);
  validateRollbackBindings(bindings);
  const dependencies = defaultDependencies(dependencyOverrides);
  const { previous, stage } = rollbackPaths({ target, rollbackId, rollbackManifestPath, rollbackJournalPath });
  assertRollbackPaths(target, previous);
  if (!path.isAbsolute(rollbackManifestPath)) throw new Error("Rollback manifest path must be absolute");
  if (!path.isAbsolute(rollbackJournalPath)) throw new Error("Rollback journal path must be absolute");
  for (const collisionPath of [rollbackManifestPath, rollbackJournalPath, `${rollbackJournalPath}.next`, stage]) {
    if (dependencies.exists(collisionPath)) throw new Error(`Rollback collision path already exists: ${collisionPath}`);
  }

  const installedBefore = dependencies.inspectBundle(target, { runtimeRole: "installed" });
  const previousBefore = dependencies.inspectBundle(previous, { runtimeRole: "previous" });
  assertPreflightIdentities({ installedBefore, previousBefore, bindings });
  const processPrecheck = dependencies.assertNoProcess(target);

  const journalBase = {
    schemaVersion: 1,
    operation: "rollback-previous-journal",
    rollbackId,
    retrySafe: false,
    targetApp: target,
    previousApp: previous,
    stageApp: stage,
    manifestPath: rollbackManifestPath,
    bindings,
    before: {
      installed: compactIdentity(installedBefore),
      previous: compactIdentity(previousBefore)
    }
  };
  dependencies.checkpoint("before-journal-preparing");
  dependencies.writeJournalInitial(rollbackJournalPath, {
    ...journalBase,
    phase: "preparing",
    updatedAt: dependencies.now().toISOString()
  });
  dependencies.checkpoint("after-journal-preparing");

  dependencies.checkpoint("before-stage-copy");
  dependencies.copyBundle(previous, stage);
  dependencies.checkpoint("after-stage-copy");
  const stagedPrevious = dependencies.inspectBundle(stage, { runtimeRole: "previous" });
  assertIdentityMatchesBinding(stagedPrevious, bindings.previous, "Staged previous app");
  dependencies.checkpoint("before-journal-prepared");
  dependencies.updateJournal(rollbackJournalPath, {
    ...journalBase,
    phase: "prepared",
    stagedPrevious: compactIdentity(stagedPrevious),
    updatedAt: dependencies.now().toISOString()
  });
  dependencies.checkpoint("after-stage-validation");

  const installedBeforeSwap = dependencies.inspectBundle(target, { runtimeRole: "installed" });
  const previousBeforeSwap = dependencies.inspectBundle(previous, { runtimeRole: "previous" });
  assertStableIdentity(installedBefore, installedBeforeSwap, "Installed app");
  assertStableIdentity(previousBefore, previousBeforeSwap, "Previous app");
  dependencies.assertNoProcess(target);
  dependencies.checkpoint("before-atomic-swap");
  const atomicPrimitive = dependencies.atomicSwap(target, previous, {
    leftObject: installedBeforeSwap.rootObject,
    rightObject: previousBeforeSwap.rootObject
  });
  if (atomicPrimitive.primitive !== "renameatx_np" || atomicPrimitive.flags !== "RENAME_SWAP") {
    throw new Error("Rollback did not use the required atomic directory exchange primitive");
  }
  dependencies.checkpoint("after-atomic-swap");

  const installedAfter = dependencies.inspectBundle(target, { runtimeRole: "installed" });
  const previousAfter = dependencies.inspectBundle(previous, { runtimeRole: "previous" });
  assertIdentityMatchesBinding(installedAfter, bindings.previous, "Rolled-back installed app");
  assertIdentityMatchesBinding(previousAfter, bindings.installed, "Preserved former installed app");
  dependencies.checkpoint("before-journal-swapped");
  dependencies.updateJournal(rollbackJournalPath, {
    ...journalBase,
    phase: "swapped-and-postchecked",
    stagedPrevious: compactIdentity(stagedPrevious),
    after: {
      installed: compactIdentity(installedAfter),
      previous: compactIdentity(previousAfter)
    },
    atomicPrimitive,
    updatedAt: dependencies.now().toISOString()
  });
  dependencies.checkpoint("after-swapped-postcheck");

  dependencies.checkpoint("before-launch-services");
  dependencies.assertNoProcess(target);
  if (dependencies.registerLaunchServices(target) !== true) {
    throw new Error("LaunchServices registration did not report success");
  }
  dependencies.checkpoint("after-launch-services-before-journal");
  dependencies.updateJournal(rollbackJournalPath, {
    ...journalBase,
    phase: "launch-services-registered",
    stagedPrevious: compactIdentity(stagedPrevious),
    after: {
      installed: compactIdentity(installedAfter),
      previous: compactIdentity(previousAfter)
    },
    atomicPrimitive,
    launchServicesRegistered: true,
    updatedAt: dependencies.now().toISOString()
  });
  dependencies.checkpoint("after-launch-services");

  const manifest = buildRollbackManifest({
    rollbackId,
    target,
    previous,
    processPrecheck,
    installedBefore,
    previousBefore,
    installedAfter,
    previousAfter,
    now: dependencies.now()
  });
  dependencies.checkpoint("before-manifest-published");
  dependencies.writeManifestExclusive(rollbackManifestPath, manifest);
  dependencies.checkpoint("after-manifest-write-before-journal");
  dependencies.updateJournal(rollbackJournalPath, {
    ...journalBase,
    phase: "manifest-published",
    stagedPrevious: compactIdentity(stagedPrevious),
    after: manifest.after,
    atomicPrimitive,
    launchServicesRegistered: true,
    manifestSha256: sha256File(rollbackManifestPath),
    updatedAt: dependencies.now().toISOString()
  });
  dependencies.checkpoint("after-manifest-published");

  dependencies.checkpoint("before-stage-cleanup");
  dependencies.removeDurably(stage);
  dependencies.checkpoint("after-stage-remove-before-journal");
  dependencies.updateJournal(rollbackJournalPath, {
    ...journalBase,
    phase: "committed",
    after: manifest.after,
    atomicPrimitive,
    launchServicesRegistered: true,
    manifestSha256: sha256File(rollbackManifestPath),
    updatedAt: dependencies.now().toISOString()
  });
  dependencies.checkpoint("after-stage-cleanup");
  dependencies.checkpoint("before-final-process-check");
  const processPostcheck = dependencies.assertNoProcess(target);
  dependencies.checkpoint("after-final-process-check");
  dependencies.checkpoint("before-journal-cleanup");
  dependencies.removeDurably(rollbackJournalPath);
  dependencies.checkpoint("after-journal-cleanup");
  return { manifestPath: rollbackManifestPath, manifest, processPostcheck };
}

export function recoverRollbackTransaction({
  target,
  rollbackId,
  bindings,
  rollbackManifestPath,
  rollbackJournalPath,
  dependencies: dependencyOverrides = {}
}) {
  assertRollbackId(rollbackId);
  validateRollbackBindings(bindings);
  const dependencies = defaultDependencies(dependencyOverrides);
  if (!dependencies.exists(rollbackJournalPath)) throw new Error(`Rollback journal is missing: ${rollbackJournalPath}`);
  const journal = dependencies.readJson(rollbackJournalPath);
  if (journal.rollbackId !== rollbackId || JSON.stringify(journal.bindings) !== JSON.stringify(bindings)) {
    throw new Error("Rollback recovery authority does not match the durable journal");
  }
  const journalNextPath = `${rollbackJournalPath}.next`;
  if (dependencies.exists(journalNextPath)) {
    const journalNext = dependencies.readJson(journalNextPath);
    if (journalNext.rollbackId !== rollbackId || JSON.stringify(journalNext.bindings) !== JSON.stringify(bindings)) {
      throw new Error("Rollback journal update residue does not match recovery authority");
    }
  }
  const { previous, stage } = rollbackPaths({ target, rollbackId, rollbackManifestPath, rollbackJournalPath });
  const installed = dependencies.inspectBundle(target, { runtimeRole: "installed" });
  const previousIdentity = dependencies.inspectBundle(previous, { runtimeRole: "previous" });
  let stageIdentity = null;
  if (dependencies.exists(stage)) {
    try {
      stageIdentity = dependencies.inspectBundle(stage, { runtimeRole: "previous" });
    } catch {
      stageIdentity = null;
    }
  }
  const classification = classifyRollbackState({ installed, previous: previousIdentity, bindings, stage: stageIdentity });
  if (!classification.recoverable) throw new Error(`Rollback journal is not safely recoverable: ${classification.state}`);
  dependencies.assertNoProcess(target);

  if (classification.state === "original-roles") {
    if (dependencies.exists(rollbackManifestPath)) {
      throw new Error("Rollback manifest exists while app roles are original; refusing ambiguous recovery");
    }
    if (dependencies.exists(stage)) dependencies.removeDurably(stage);
    if (dependencies.exists(journalNextPath)) dependencies.removeDurably(journalNextPath);
    dependencies.removeDurably(rollbackJournalPath);
    return { disposition: "aborted-before-atomic-swap", appRolesChanged: false, recoveryCleanupPerformed: true };
  }

  assertIdentityMatchesBinding(installed, bindings.previous, "Recovered installed app");
  assertIdentityMatchesBinding(previousIdentity, bindings.installed, "Recovered previous app");
  if (!dependencies.exists(rollbackManifestPath)) {
    if (dependencies.registerLaunchServices(target) !== true) {
      throw new Error("LaunchServices registration did not report success during recovery");
    }
    const manifest = buildRollbackManifest({
      rollbackId,
      target,
      previous,
      processPrecheck: { recovery: "clear" },
      installedBefore: journal.before.installed,
      previousBefore: journal.before.previous,
      installedAfter: installed,
      previousAfter: previousIdentity,
      now: dependencies.now()
    });
    dependencies.writeManifestExclusive(rollbackManifestPath, manifest);
    dependencies.updateJournal(rollbackJournalPath, {
      ...journal,
      phase: "recovery-manifest-published",
      after: manifest.after,
      launchServicesRegistered: true,
      manifestSha256: dependencies.sha256File(rollbackManifestPath),
      updatedAt: dependencies.now().toISOString()
    });
  } else {
    assertJournalBoundManifestBytes({
      journal,
      manifestSha256: dependencies.sha256File(rollbackManifestPath)
    });
    const manifest = dependencies.readJson(rollbackManifestPath);
    assertRecoveryManifestMatches({
      manifest,
      rollbackId,
      target,
      previous,
      bindings,
      journal,
      installed,
      previousIdentity
    });
  }
  if (dependencies.exists(stage)) dependencies.removeDurably(stage);
  if (dependencies.exists(journalNextPath)) dependencies.removeDurably(journalNextPath);
  dependencies.removeDurably(rollbackJournalPath);
  dependencies.assertNoProcess(target);
  return { disposition: "completed-after-atomic-swap", mutationPerformed: true, manifestPath: rollbackManifestPath };
}
