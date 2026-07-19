"use strict";

const { execFile } = require("node:child_process");
const { randomBytes } = require("node:crypto");
const {
  chmodSync,
  closeSync,
  constants,
  fstatSync,
  lstatSync,
  mkdirSync,
  openSync,
  readSync,
  rmdirSync,
  unlinkSync
} = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { promisify } = require("node:util");

const SUPPORTED_MULTI_FORMAT_EXTENSIONS = new Set([".svga", ".json", ".mp4"]);
const execFileAsync = promisify(execFile);
const DARWIN_MULTI_FORMAT_PICKER_LAUNCHER = "/usr/bin/open";
const DARWIN_MULTI_FORMAT_PICKER_HELPER_BUNDLE_NAME = "Auto SVGA File Picker.app";
const DARWIN_MULTI_FORMAT_PICKER_HELPER_NAME = "asv-open-panel";
const DARWIN_MULTI_FORMAT_PICKER_RESULT_MAX_BYTES = 32768;
const DARWIN_MULTI_FORMAT_PICKER_TIMEOUT_MS = 120000;
const DARWIN_MULTI_FORMAT_PICKER_CHANNEL_PREFIX = "auto-svga-native-picker-";
let darwinMultiFormatPickerActive = false;

function createMultiFormatOpenDialogOptions() {
  return {
    title: "打开文件",
    filters: [
      { name: "SVGA / Lottie JSON / VAP MP4", extensions: ["svga", "json", "mp4"] },
      { name: "SVGA", extensions: ["svga"] },
      { name: "Lottie JSON", extensions: ["json"] },
      { name: "VAP MP4", extensions: ["mp4"] }
    ],
    properties: ["openFile"]
  };
}

function failedPickerResult(code = "file_picker_failed") {
  return {
    status: "failed",
    code,
    message: code === "unsupported_file_type"
      ? "仅支持 SVGA、Lottie JSON 或 VAP MP4 文件。"
      : "无法打开文件选择器，源文件没有被修改。",
    pathRedacted: true
  };
}

function validateMultiFormatPickerSelection(filePath, readStats = lstatSync) {
  if (typeof filePath !== "string" || !filePath.trim()) {
    return { status: "cancelled" };
  }
  if (!SUPPORTED_MULTI_FORMAT_EXTENSIONS.has(path.extname(filePath).toLowerCase())) {
    return failedPickerResult("unsupported_file_type");
  }
  try {
    if (!readStats(filePath).isFile()) return failedPickerResult();
  } catch {
    return failedPickerResult();
  }
  return { status: "selected", filePath };
}

function parseDarwinPickerOutput(stdout) {
  if (typeof stdout !== "string" || Buffer.byteLength(stdout, "utf8") > DARWIN_MULTI_FORMAT_PICKER_RESULT_MAX_BYTES) {
    return failedPickerResult();
  }
  try {
    const value = JSON.parse(stdout.trim());
    if (!value || Array.isArray(value) || typeof value !== "object") return failedPickerResult();
    const keys = Object.keys(value).sort();
    if (value.status === "cancelled" && keys.length === 1 && keys[0] === "status") {
      return { status: "cancelled" };
    }
    if (
      value.status === "selected"
      && keys.length === 2
      && keys[0] === "filePath"
      && keys[1] === "status"
      && typeof value.filePath === "string"
      && value.filePath.trim()
    ) {
      return { status: "selected", filePath: value.filePath };
    }
  } catch {}
  return failedPickerResult();
}

function assertPrivateDirectory(directoryPath, expectedIdentity = null) {
  const stats = lstatSync(directoryPath);
  const ownerId = typeof process.getuid === "function" ? process.getuid() : null;
  if (
    !stats.isDirectory()
    || stats.isSymbolicLink()
    || (stats.mode & 0o7777) !== 0o700
    || ownerId === null
    || stats.uid !== ownerId
    || (expectedIdentity && (stats.dev !== expectedIdentity.dev || stats.ino !== expectedIdentity.ino))
  ) {
    throw new Error("Native picker result directory is outside the private contract");
  }
  return { dev: stats.dev, ino: stats.ino };
}

function assertPrivateResultFileStats(stats, expectedIdentity) {
  const ownerId = typeof process.getuid === "function" ? process.getuid() : null;
  if (
    !stats.isFile()
    || stats.isSymbolicLink?.()
    || stats.nlink !== 1
    || (stats.mode & 0o7777) !== 0o600
    || ownerId === null
    || stats.uid !== ownerId
    || stats.dev !== expectedIdentity.dev
    || stats.ino !== expectedIdentity.ino
  ) {
    throw new Error("Native picker result file is outside the private contract");
  }
}

function createPrivateResultFile(filePath) {
  const fd = openSync(
    filePath,
    constants.O_CREAT | constants.O_EXCL | constants.O_WRONLY | (constants.O_NOFOLLOW || 0),
    0o600
  );
  try {
    const stats = fstatSync(fd);
    const identity = { dev: stats.dev, ino: stats.ino };
    assertPrivateResultFileStats(stats, identity);
    if (stats.size !== 0) throw new Error("Native picker result file was not empty");
    return { filePath, ...identity };
  } finally {
    closeSync(fd);
  }
}

function cleanupDarwinPickerResultChannel(channel) {
  let cleanupError = null;
  for (const binding of [channel?.result, channel?.stderr]) {
    if (!binding?.filePath) continue;
    try {
      unlinkSync(binding.filePath);
    } catch (error) {
      if (error?.code !== "ENOENT" && !cleanupError) cleanupError = error;
    }
  }
  if (channel?.rootPath) {
    try {
      rmdirSync(channel.rootPath);
    } catch (error) {
      if (error?.code !== "ENOENT" && !cleanupError) cleanupError = error;
    }
  }
  if (cleanupError) throw cleanupError;
}

function createDarwinPickerResultChannel(temporaryDirectory = os.tmpdir()) {
  const token = randomBytes(16).toString("hex");
  const rootPath = path.join(temporaryDirectory, `${DARWIN_MULTI_FORMAT_PICKER_CHANNEL_PREFIX}${token}`);
  const channel = { token, rootPath, rootIdentity: null, result: null, stderr: null };
  try {
    mkdirSync(rootPath, { mode: 0o700 });
    chmodSync(rootPath, 0o700);
    channel.rootIdentity = assertPrivateDirectory(rootPath);
    channel.result = createPrivateResultFile(path.join(rootPath, "picker-result.json"));
    channel.stderr = createPrivateResultFile(path.join(rootPath, "launcher-stderr.log"));
    return channel;
  } catch (error) {
    try {
      cleanupDarwinPickerResultChannel(channel);
    } catch {}
    throw error;
  }
}

function readBoundedPrivateResultFile(channel, binding) {
  assertPrivateDirectory(channel.rootPath, channel.rootIdentity);
  const linkStats = lstatSync(binding.filePath);
  assertPrivateResultFileStats(linkStats, binding);

  const fd = openSync(binding.filePath, constants.O_RDONLY | (constants.O_NOFOLLOW || 0));
  try {
    const before = fstatSync(fd);
    assertPrivateResultFileStats(before, binding);
    if (before.size > DARWIN_MULTI_FORMAT_PICKER_RESULT_MAX_BYTES) {
      throw new Error("Native picker result exceeded the bounded contract");
    }

    const output = Buffer.alloc(DARWIN_MULTI_FORMAT_PICKER_RESULT_MAX_BYTES + 1);
    let total = 0;
    while (total < output.length) {
      const bytesRead = readSync(fd, output, total, output.length - total, null);
      if (bytesRead === 0) break;
      total += bytesRead;
    }
    if (total > DARWIN_MULTI_FORMAT_PICKER_RESULT_MAX_BYTES) {
      throw new Error("Native picker result exceeded the bounded contract");
    }

    const after = fstatSync(fd);
    assertPrivateResultFileStats(after, binding);
    const finalLinkStats = lstatSync(binding.filePath);
    assertPrivateResultFileStats(finalLinkStats, binding);
    if (before.size !== after.size || total !== after.size) {
      throw new Error("Native picker result changed during bounded read");
    }
    return output.subarray(0, total).toString("utf8");
  } finally {
    closeSync(fd);
  }
}

function resolveDarwinMultiFormatPickerHelperBundlePath({
  moduleDirectory = __dirname,
  resourcesPath = process.resourcesPath
} = {}) {
  const packaged = moduleDirectory.endsWith(`${path.sep}app.asar`)
    || moduleDirectory.includes(`${path.sep}app.asar${path.sep}`);
  const nativeRoot = packaged
    ? path.join(resourcesPath, "native")
    : path.join(moduleDirectory, ".runtime", "native");
  return path.join(nativeRoot, DARWIN_MULTI_FORMAT_PICKER_HELPER_BUNDLE_NAME);
}

function resolveDarwinMultiFormatPickerHelperPath(options = {}) {
  return path.join(
    resolveDarwinMultiFormatPickerHelperBundlePath(options),
    "Contents",
    "MacOS",
    DARWIN_MULTI_FORMAT_PICKER_HELPER_NAME
  );
}

async function runDarwinMultiFormatPicker(
  execute = execFileAsync,
  helperBundlePath = resolveDarwinMultiFormatPickerHelperBundlePath()
) {
  if (darwinMultiFormatPickerActive) return failedPickerResult();
  darwinMultiFormatPickerActive = true;
  let channel = null;
  let outcome = failedPickerResult();
  let cleanupFailed = false;
  try {
    channel = createDarwinPickerResultChannel();
    try {
      await execute(
        DARWIN_MULTI_FORMAT_PICKER_LAUNCHER,
        [
          "-n",
          "-W",
          "-a",
          helperBundlePath,
          "--stderr",
          channel.stderr.filePath,
          "--args",
          `--auto-svga-picker-channel=${channel.token}`,
          `--auto-svga-picker-root=${channel.rootPath}`,
          `--auto-svga-picker-parent-pid=${process.pid}`
        ],
        {
          encoding: "utf8",
          maxBuffer: DARWIN_MULTI_FORMAT_PICKER_RESULT_MAX_BYTES,
          timeout: DARWIN_MULTI_FORMAT_PICKER_TIMEOUT_MS,
          killSignal: "SIGTERM"
        }
      );
    } catch {}
    readBoundedPrivateResultFile(channel, channel.stderr);
    outcome = parseDarwinPickerOutput(readBoundedPrivateResultFile(channel, channel.result));
  } catch {
  } finally {
    try {
      if (channel) cleanupDarwinPickerResultChannel(channel);
    } catch {
      cleanupFailed = true;
    }
    darwinMultiFormatPickerActive = false;
  }
  return cleanupFailed ? failedPickerResult() : outcome;
}

async function chooseMultiFormatLocalFile({
  showOpenDialog,
  platform = process.platform,
  runDarwinPicker = runDarwinMultiFormatPicker,
  readStats = lstatSync
}) {
  try {
    const result = platform === "darwin"
      ? await runDarwinPicker()
      : await showOpenDialog(createMultiFormatOpenDialogOptions(platform));
    if (platform === "darwin") {
      if (result?.status !== "selected") return result?.status === "cancelled" ? result : failedPickerResult();
      return validateMultiFormatPickerSelection(result.filePath, readStats);
    }
    if (result?.canceled || !result?.filePaths?.[0]) return { status: "cancelled" };
    return validateMultiFormatPickerSelection(result.filePaths[0], readStats);
  } catch {
    return failedPickerResult();
  }
}

module.exports = {
  DARWIN_MULTI_FORMAT_PICKER_LAUNCHER,
  DARWIN_MULTI_FORMAT_PICKER_HELPER_BUNDLE_NAME,
  DARWIN_MULTI_FORMAT_PICKER_HELPER_NAME,
  DARWIN_MULTI_FORMAT_PICKER_TIMEOUT_MS,
  chooseMultiFormatLocalFile,
  createMultiFormatOpenDialogOptions,
  parseDarwinPickerOutput,
  resolveDarwinMultiFormatPickerHelperBundlePath,
  resolveDarwinMultiFormatPickerHelperPath,
  runDarwinMultiFormatPicker,
  validateMultiFormatPickerSelection
};
