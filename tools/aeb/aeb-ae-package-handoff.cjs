"use strict";

const { createHash } = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const DEFAULT_AE_DEV_ROOT = "/private/tmp/auto-svga-aeb-dev";
const DEFAULT_D001_TASK_ROOT = "/private/tmp/auto-svga-aeb-d001-8594bcfa";
const HANDOFF_SCHEMA = "auto-svga-aeb-ae-package-handoff-v1";
const MAX_PACKAGE_FILES = 128;
const MAX_PACKAGE_BYTES = 25 * 1024 * 1024;
const MAX_PACKAGE_FILE_BYTES = 10 * 1024 * 1024;

function prepareAePackageHandoff(options) {
  const input = normalizeHandoffInput(options);
  assertSourcePackageRoot(input.sourcePackageRoot, input.devRoot);
  assertTargetPackageRoot(input.targetPackageRoot, input.taskRoot);
  assertTargetAbsent(input.targetPackageRoot);

  const identityBefore = captureHandoffIdentities(input);
  const sourceBefore = snapshotAePackageTree(input.sourcePackageRoot, { sourceRoot: input.devRoot });
  if (sourceBefore.sha256 !== input.expectedTreeSha256) throw codedError("aeb.package_handoff_tree_mismatch", "AEB handoff source tree did not match the expected package tree.");
  if (sourceBefore.fileCount !== input.expectedFileCount) throw codedError("aeb.package_handoff_tree_mismatch", "AEB handoff source file count did not match the expected package tree.");
  if (sourceBefore.totalBytes !== input.expectedTotalBytes) throw codedError("aeb.package_handoff_tree_mismatch", "AEB handoff source byte count did not match the expected package tree.");
  const finalized = sourceBefore.entries.find((entry) => entry.relative === "ae-export-package.finalized.json");
  if (!finalized || finalized.sha256 !== input.expectedPackageSha256) {
    throw codedError("aeb.package_handoff_package_sha_mismatch", "AEB handoff package JSON hash did not match the descriptor.");
  }

  const manifestPath = `${input.targetPackageRoot}.handoff-manifest.json`;
  assertTargetAbsent(manifestPath);
  let targetCreated = false;
  let manifestCreated = false;
  try {
    if (typeof input.afterSourceSnapshot === "function") input.afterSourceSnapshot();
    assertHandoffIdentitiesUnchanged(identityBefore);
    createTargetRoot(input.targetPackageRoot);
    targetCreated = true;
    writeTargetEntries(input.targetPackageRoot, sourceBefore.entries, input.afterTargetEntryWrite);

    assertHandoffIdentitiesUnchanged(identityBefore);
    const sourceAfter = snapshotAePackageTree(input.sourcePackageRoot, { sourceRoot: input.devRoot });
    if (sourceAfter.sha256 !== sourceBefore.sha256 || sourceAfter.fileCount !== sourceBefore.fileCount || sourceAfter.totalBytes !== sourceBefore.totalBytes) {
      throw codedError("aeb.package_handoff_source_mutated", "AEB handoff source changed during package copy.");
    }
    const target = snapshotAePackageTree(input.targetPackageRoot, { sourceRoot: input.taskRoot });
    if (target.sha256 !== sourceBefore.sha256 || target.fileCount !== sourceBefore.fileCount || target.totalBytes !== sourceBefore.totalBytes) {
      throw codedError("aeb.package_handoff_target_mismatch", "AEB handoff target did not match the source package tree.");
    }

    const manifest = {
      schema: HANDOFF_SCHEMA,
      sourceAlias: "ae-export-package",
      targetAlias: "d001-package-root",
      sourceImmutable: true,
      targetExactCopy: true,
      packageSha256: finalized.sha256,
      tree: {
        sha256: sourceBefore.sha256,
        fileCount: sourceBefore.fileCount,
        totalBytes: sourceBefore.totalBytes
      },
      entries: sourceBefore.entries.map((entry) => ({
        relative: entry.relative,
        sizeBytes: entry.sizeBytes,
        sha256: entry.sha256
      }))
    };
    const manifestBytes = Buffer.from(`${JSON.stringify(manifest, null, 2)}\n`);
    fs.writeFileSync(manifestPath, manifestBytes, { flag: "wx", mode: 0o600 });
    manifestCreated = true;
    const manifestStat = fs.lstatSync(manifestPath);
    if (!manifestStat.isFile() || manifestStat.nlink !== 1) {
      throw codedError("aeb.package_handoff_manifest_invalid", "AEB handoff manifest was not published as a private regular file.");
    }
    return {
      schema: HANDOFF_SCHEMA,
      packageSha256: finalized.sha256,
      sourceBeforeSha256: sourceBefore.sha256,
      sourceAfterSha256: sourceAfter.sha256,
      targetSha256: target.sha256,
      fileCount: target.fileCount,
      totalBytes: target.totalBytes,
      manifestPath,
      manifestSha256: sha256(manifestBytes)
    };
  } catch (error) {
    if (manifestCreated) fs.rmSync(manifestPath, { force: true });
    if (targetCreated) fs.rmSync(input.targetPackageRoot, { recursive: true, force: true });
    throw error;
  }
}

function snapshotAePackageTree(root, options = {}) {
  const sourceRoot = path.resolve(options.sourceRoot ?? DEFAULT_AE_DEV_ROOT);
  const rootPath = path.resolve(root);
  assertUnderRoot(rootPath, sourceRoot, "aeb.package_handoff_source_out_of_root");
  assertDirectoryCanonical(rootPath, "aeb.package_handoff_source_alias");
  const entries = [];
  const seenCanonical = new Set();
  walkTree(rootPath, "", entries, seenCanonical);
  if (entries.length === 0 || entries.length > MAX_PACKAGE_FILES) {
    throw codedError("aeb.package_handoff_tree_size", "AEB handoff package file count is outside the bounded contract.");
  }
  const totalBytes = entries.reduce((sum, entry) => sum + entry.sizeBytes, 0);
  if (totalBytes > MAX_PACKAGE_BYTES) {
    throw codedError("aeb.package_handoff_tree_size", "AEB handoff package byte count is outside the bounded contract.");
  }
  entries.sort(comparePackageEntries);
  const digest = canonicalPackageTreeDigest(entries);
  return { sha256: digest, fileCount: entries.length, totalBytes, entries };
}

function normalizeHandoffInput(options) {
  if (!options || typeof options !== "object") throw codedError("aeb.package_handoff_input_invalid", "AEB handoff options are invalid.");
  return {
    sourcePackageRoot: path.resolve(requireString(options.sourcePackageRoot, "aeb.package_handoff_source_invalid")),
    targetPackageRoot: path.resolve(requireString(options.targetPackageRoot, "aeb.package_handoff_target_invalid")),
    expectedPackageSha256: requireSha256(options.expectedPackageSha256, "aeb.package_handoff_package_sha_invalid"),
    expectedTreeSha256: requireSha256(options.expectedTreeSha256, "aeb.package_handoff_tree_sha_invalid"),
    expectedFileCount: requirePositiveInteger(options.expectedFileCount, MAX_PACKAGE_FILES, "aeb.package_handoff_tree_size"),
    expectedTotalBytes: requirePositiveInteger(options.expectedTotalBytes, MAX_PACKAGE_BYTES, "aeb.package_handoff_tree_size"),
    devRoot: path.resolve(options.devRoot ?? DEFAULT_AE_DEV_ROOT),
    taskRoot: path.resolve(options.taskRoot ?? DEFAULT_D001_TASK_ROOT),
    afterSourceSnapshot: options.afterSourceSnapshot,
    afterTargetEntryWrite: options.afterTargetEntryWrite
  };
}

function assertSourcePackageRoot(sourcePackageRoot, devRoot) {
  assertUnderRoot(sourcePackageRoot, devRoot, "aeb.package_handoff_source_out_of_root");
  if (path.basename(sourcePackageRoot) !== "ae-export-package") {
    throw codedError("aeb.package_handoff_source_invalid", "AEB handoff source must be an ae-export-package directory.");
  }
  assertDirectoryCanonical(devRoot, "aeb.package_handoff_source_alias");
  assertDirectoryCanonical(sourcePackageRoot, "aeb.package_handoff_source_alias");
}

function assertTargetPackageRoot(targetPackageRoot, taskRoot) {
  assertDirectoryCanonical(taskRoot, "aeb.package_handoff_target_alias");
  if (path.dirname(targetPackageRoot) !== taskRoot || !/^[A-Za-z0-9._-]{1,120}$/u.test(path.basename(targetPackageRoot))) {
    throw codedError("aeb.package_handoff_target_out_of_root", "AEB handoff target must be a fresh direct child of the D001 task root.");
  }
}

function assertTargetAbsent(targetPath) {
  try {
    fs.lstatSync(targetPath);
    throw codedError("aeb.package_handoff_target_stale", "AEB handoff target already exists.");
  } catch (error) {
    if (error && error.code === "ENOENT") return;
    throw error;
  }
}

function assertUnderRoot(child, root, code) {
  const relative = path.relative(root, child);
  if (!relative || relative.startsWith("..") || path.isAbsolute(relative)) {
    throw codedError(code, "AEB handoff path is outside the approved root.");
  }
}

function assertDirectoryCanonical(directory, code) {
  let stat;
  try {
    stat = fs.lstatSync(directory);
  } catch (error) {
    throw error?.code === "ENOENT" ? codedError(code, "AEB handoff directory does not exist.") : error;
  }
  if (!stat.isDirectory() || stat.isSymbolicLink()) throw codedError(code, "AEB handoff directory is not canonical.");
  if (path.resolve(fs.realpathSync(directory)) !== path.resolve(directory)) throw codedError(code, "AEB handoff directory resolves through an alias.");
}

function captureHandoffIdentities(input) {
  return {
    source: captureDirectoryChain(input.devRoot, input.sourcePackageRoot, "aeb.package_handoff_source_identity_changed"),
    taskRoot: captureDirectoryIdentity(input.taskRoot, "aeb.package_handoff_task_root_changed")
  };
}

function assertHandoffIdentitiesUnchanged(snapshot) {
  for (const entry of snapshot.source) assertDirectoryIdentityUnchanged(entry);
  assertDirectoryIdentityUnchanged(snapshot.taskRoot);
}

function captureDirectoryChain(root, leaf, code) {
  const rootPath = path.resolve(root);
  const leafPath = path.resolve(leaf);
  assertUnderRoot(leafPath, rootPath, code);
  const identities = [captureDirectoryIdentity(rootPath, code)];
  let current = rootPath;
  for (const part of path.relative(rootPath, leafPath).split(path.sep)) {
    current = path.join(current, part);
    identities.push(captureDirectoryIdentity(current, code));
  }
  return identities;
}

function captureDirectoryIdentity(directory, code) {
  const resolved = path.resolve(directory);
  const stat = fs.lstatSync(resolved);
  if (!stat.isDirectory() || stat.isSymbolicLink() || path.resolve(fs.realpathSync(resolved)) !== resolved) {
    throw codedError(code, "AEB handoff directory identity is not canonical.");
  }
  return {
    path: resolved,
    code,
    dev: stat.dev,
    ino: stat.ino,
    mode: stat.mode & 0o777,
    type: "directory"
  };
}

function assertDirectoryIdentityUnchanged(expected) {
  let stat;
  try {
    stat = fs.lstatSync(expected.path);
  } catch {
    throw codedError(expected.code, "AEB handoff pinned directory identity disappeared.");
  }
  if (
    !stat.isDirectory()
    || stat.isSymbolicLink()
    || stat.dev !== expected.dev
    || stat.ino !== expected.ino
    || (stat.mode & 0o777) !== expected.mode
    || path.resolve(fs.realpathSync(expected.path)) !== expected.path
  ) {
    throw codedError(expected.code, "AEB handoff pinned directory identity changed.");
  }
}

function walkTree(rootPath, relativeDir, entries, seenCanonical) {
  const directoryPath = path.join(rootPath, relativeDir);
  const names = fs.readdirSync(directoryPath).sort();
  const seenLocal = new Set();
  for (const name of names) {
    if (!isSafeName(name)) throw codedError("aeb.package_handoff_entry_invalid", "AEB handoff package contains an unsafe entry name.");
    const localKey = name.normalize("NFKC").toLowerCase();
    if (seenLocal.has(localKey)) throw codedError("aeb.package_handoff_entry_alias", "AEB handoff package contains ambiguous entry names.");
    seenLocal.add(localKey);

    const relative = path.posix.join(relativeDir.split(path.sep).join("/"), name);
    const absolute = path.join(rootPath, relativeDir, name);
    const stat = fs.lstatSync(absolute);
    if (stat.isSymbolicLink()) throw codedError("aeb.package_handoff_source_symlink", "AEB handoff package cannot contain symlinks.");
    const canonicalKey = relative.normalize("NFKC").toLowerCase();
    if (seenCanonical.has(canonicalKey)) throw codedError("aeb.package_handoff_entry_alias", "AEB handoff package contains ambiguous relative paths.");
    seenCanonical.add(canonicalKey);
    if (stat.isDirectory()) {
      assertDirectoryCanonical(absolute, "aeb.package_handoff_source_alias");
      walkTree(rootPath, path.join(relativeDir, name), entries, seenCanonical);
      continue;
    }
    if (!stat.isFile()) throw codedError("aeb.package_handoff_entry_invalid", "AEB handoff package can contain only regular files.");
    if (stat.nlink !== 1) throw codedError("aeb.package_handoff_source_link", "AEB handoff package files must be single-link regular files.");
    const bytes = readBoundedRegularFile(absolute, "aeb.package_handoff_source_read_failed");
    entries.push({
      relative,
      sizeBytes: bytes.byteLength,
      sha256: sha256(bytes),
      bytes
    });
  }
}

function createTargetRoot(targetPackageRoot) {
  fs.mkdirSync(targetPackageRoot, { mode: 0o700 });
  const stat = fs.lstatSync(targetPackageRoot);
  if (!stat.isDirectory() || stat.isSymbolicLink() || stat.nlink < 1 || path.resolve(fs.realpathSync(targetPackageRoot)) !== path.resolve(targetPackageRoot)) {
    throw codedError("aeb.package_handoff_target_alias", "AEB handoff target root is not canonical.");
  }
}

function writeTargetEntries(targetPackageRoot, entries, afterTargetEntryWrite) {
  let index = 0;
  for (const entry of entries) {
    const destination = path.join(targetPackageRoot, ...entry.relative.split("/"));
    const destinationDirectory = path.dirname(destination);
    fs.mkdirSync(destinationDirectory, { recursive: true, mode: 0o700 });
    const directoryStat = fs.lstatSync(destinationDirectory);
    if (!directoryStat.isDirectory() || directoryStat.isSymbolicLink()) {
      throw codedError("aeb.package_handoff_target_alias", "AEB handoff target directory is not canonical.");
    }
    fs.writeFileSync(destination, entry.bytes, { flag: "wx", mode: 0o600 });
    const written = readBoundedRegularFile(destination, "aeb.package_handoff_target_read_failed");
    if (sha256(written) !== entry.sha256) throw codedError("aeb.package_handoff_target_mismatch", "AEB handoff target write did not match source bytes.");
    index += 1;
    if (typeof afterTargetEntryWrite === "function") afterTargetEntryWrite({ entry, index, destination });
  }
}

function readBoundedRegularFile(filePath, code) {
  const openedPath = path.resolve(filePath);
  const before = fs.lstatSync(openedPath);
  if (!before.isFile() || before.isSymbolicLink()) throw codedError(code, "AEB handoff file is not a regular no-follow file.");
  if (before.nlink !== 1) throw codedError("aeb.package_handoff_source_link", "AEB handoff files must be single-link regular files.");
  if (before.size <= 0 || before.size > MAX_PACKAGE_FILE_BYTES) throw codedError("aeb.package_handoff_file_size", "AEB handoff file is outside the bounded size contract.");
  const fd = fs.openSync(openedPath, fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW);
  try {
    const opened = fs.fstatSync(fd);
    if (!opened.isFile() || opened.nlink !== 1 || opened.size !== before.size || opened.ino !== before.ino || opened.dev !== before.dev) {
      throw codedError(code, "AEB handoff file identity changed before read.");
    }
    const capacity = Math.min(opened.size + 1, MAX_PACKAGE_FILE_BYTES + 1);
    const buffer = Buffer.allocUnsafe(capacity);
    let total = 0;
    while (total < capacity) {
      const bytesRead = fs.readSync(fd, buffer, total, capacity - total, total);
      if (bytesRead === 0) break;
      total += bytesRead;
    }
    const post = fs.fstatSync(fd);
    const after = fs.lstatSync(openedPath);
    if (
      post.dev !== opened.dev
      || post.ino !== opened.ino
      || post.size !== opened.size
      || post.nlink !== 1
      || after.dev !== opened.dev
      || after.ino !== opened.ino
      || after.size !== opened.size
      || after.nlink !== 1
      || total !== opened.size
      || total > MAX_PACKAGE_FILE_BYTES
    ) {
      throw codedError(code, "AEB handoff file changed during bounded read.");
    }
    return Buffer.from(buffer.subarray(0, total));
  } finally {
    fs.closeSync(fd);
  }
}

function isSafeName(value) {
  return typeof value === "string"
    && value.length > 0
    && value !== "."
    && value !== ".."
    && !value.includes("/")
    && !value.includes("\\")
    && value === value.normalize("NFC");
}

function requireString(value, code) {
  if (typeof value !== "string" || value.length === 0) throw codedError(code, "AEB handoff string input is invalid.");
  return value;
}

function requireSha256(value, code) {
  if (typeof value !== "string" || !/^[a-f0-9]{64}$/u.test(value)) throw codedError(code, "AEB handoff SHA-256 input is invalid.");
  return value;
}

function requirePositiveInteger(value, max, code) {
  if (!Number.isInteger(value) || value <= 0 || value > max) throw codedError(code, "AEB handoff integer input is invalid.");
  return value;
}

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function canonicalPackageTreeDigest(entries) {
  return sha256(Buffer.from(stableStringify(entries.map((entry) => ({
    relative: entry.relative,
    sizeBytes: entry.sizeBytes,
    sha256: entry.sha256
  })).sort(comparePackageEntries))));
}

function comparePackageEntries(first, second) {
  return first.relative < second.relative ? -1 : first.relative > second.relative ? 1 : 0;
}

function stableStringify(value) {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  if (value !== null && typeof value === "object") {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function codedError(code, message) {
  const error = new Error(message);
  error.code = code;
  return error;
}

module.exports = {
  DEFAULT_AE_DEV_ROOT,
  DEFAULT_D001_TASK_ROOT,
  HANDOFF_SCHEMA,
  canonicalPackageTreeDigest,
  prepareAePackageHandoff,
  snapshotAePackageTree
};
