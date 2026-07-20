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

const runtimeDependencies = [
  { packageName: "protobufjs", expectedVersion: "8.6.4", entries: ["package.json", "index.js"] },
  { packageName: "long", expectedVersion: "5.3.2", entries: ["package.json", "index.js"] },
  { packageName: "fast-png", expectedVersion: "8.0.0", entries: ["package.json", "lib/index.js"] },
  { packageName: "fflate", expectedVersion: "0.8.3", entries: ["package.json"] },
  { packageName: "iobuffer", expectedVersion: "6.0.1", entries: ["package.json"] },
  { packageName: "lottie-web", expectedVersion: "5.13.0", entries: ["package.json", "build/player/lottie_svg.js"] },
  { packageName: "video-animation-player", expectedVersion: "1.0.5", entries: ["package.json", "dist/vap.js"] }
];

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

export function readDefaultRuntimeIdentity(asarFile) {
  const bytes = asarFile?.bytes ?? readNoFollowCriticalFile(asarFile, "app.asar").bytes;
  const archive = readAsarArchiveFromBytes(bytes);
  const entries = new Set(listAsarFiles(archive));
  const missingEntries = requiredRuntimeEntries.filter((entry) => !entries.has(entry));
  const buildInfoBuffer = extractAsarFile(archive, ".runtime/build-info.json");
  const buildInfo = JSON.parse(buildInfoBuffer.toString("utf8"));
  const dependencies = runtimeDependencies.map((dependency) => {
    const packageJsonPath = `.runtime/node_modules/${dependency.packageName}/package.json`;
    const packageJson = JSON.parse(extractAsarFile(archive, packageJsonPath).toString("utf8"));
    return {
      packageName: dependency.packageName,
      expectedVersion: dependency.expectedVersion,
      version: packageJson.version,
      validated: packageJson.version === dependency.expectedVersion
    };
  });
  const findings = [
    ...missingEntries.map((entry) => `missing ${entry}`),
    ...dependencies.filter((dependency) => !dependency.validated).map((dependency) => (
      `${dependency.packageName} version ${dependency.version ?? "missing"} does not match ${dependency.expectedVersion}`
    ))
  ];
  if (typeof buildInfo.buildCommit !== "string" || !/^[0-9a-f]{40}$/.test(buildInfo.buildCommit)) {
    findings.push("runtime build-info has no full buildCommit");
  }
  if (buildInfo.source !== "package-internal-trial") {
    findings.push(`runtime build-info source is ${buildInfo.source ?? "missing"}, expected package-internal-trial`);
  }
  if (findings.length > 0) throw new Error(`App runtime closure failed: ${findings.join("; ")}`);

  return {
    buildInfo,
    buildInfoSha256: sha256Buffer(buildInfoBuffer),
    runtimeClosure: {
      validated: true,
      requiredEntries: requiredRuntimeEntries,
      missingEntries,
      dependencies,
      findings: []
    }
  };
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

export function inspectAppBundle(appPath, dependencies = {}) {
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
  const readRuntimeIdentity = dependencies.readRuntimeIdentity ?? readDefaultRuntimeIdentity;
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
  const runtimeIdentity = readRuntimeIdentity(asarFile);
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
  const installedIdentity = inspectBundle(target);
  const previousIdentity = inspectBundleIfExists(previous, inspectBundle);
  const legacyPreviousIdentity = inspectBundleIfExists(legacyPrevious, inspectBundle);
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
    candidate: inspectBundle(candidateApp)
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
          stage = inspectBundle(journal.stageApp);
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

  const installedBefore = dependencies.inspectBundle(target);
  const previousBefore = dependencies.inspectBundle(previous);
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
  const stagedPrevious = dependencies.inspectBundle(stage);
  assertIdentityMatchesBinding(stagedPrevious, bindings.previous, "Staged previous app");
  dependencies.checkpoint("before-journal-prepared");
  dependencies.updateJournal(rollbackJournalPath, {
    ...journalBase,
    phase: "prepared",
    stagedPrevious: compactIdentity(stagedPrevious),
    updatedAt: dependencies.now().toISOString()
  });
  dependencies.checkpoint("after-stage-validation");

  const installedBeforeSwap = dependencies.inspectBundle(target);
  const previousBeforeSwap = dependencies.inspectBundle(previous);
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

  const installedAfter = dependencies.inspectBundle(target);
  const previousAfter = dependencies.inspectBundle(previous);
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
  const installed = dependencies.inspectBundle(target);
  const previousIdentity = dependencies.inspectBundle(previous);
  let stageIdentity = null;
  if (dependencies.exists(stage)) {
    try {
      stageIdentity = dependencies.inspectBundle(stage);
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
