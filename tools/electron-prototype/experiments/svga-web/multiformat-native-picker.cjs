"use strict";

const { execFile } = require("node:child_process");
const { lstatSync } = require("node:fs");
const path = require("node:path");
const { promisify } = require("node:util");

const SUPPORTED_MULTI_FORMAT_EXTENSIONS = new Set([".svga", ".json", ".mp4"]);
const execFileAsync = promisify(execFile);
const DARWIN_MULTI_FORMAT_PICKER_HELPER_BUNDLE_NAME = "Auto SVGA File Picker.app";
const DARWIN_MULTI_FORMAT_PICKER_HELPER_NAME = "asv-open-panel";

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
  if (typeof stdout !== "string" || Buffer.byteLength(stdout, "utf8") > 32768) {
    return failedPickerResult();
  }
  try {
    const value = JSON.parse(stdout.trim());
    if (value?.status === "cancelled") return { status: "cancelled" };
    if (value?.status === "selected" && typeof value.filePath === "string" && value.filePath.trim()) {
      return { status: "selected", filePath: value.filePath };
    }
  } catch {}
  return failedPickerResult();
}

function resolveDarwinMultiFormatPickerHelperPath({
  moduleDirectory = __dirname,
  resourcesPath = process.resourcesPath
} = {}) {
  const packaged = moduleDirectory.endsWith(`${path.sep}app.asar`)
    || moduleDirectory.includes(`${path.sep}app.asar${path.sep}`);
  const nativeRoot = packaged
    ? path.join(resourcesPath, "native")
    : path.join(moduleDirectory, ".runtime", "native");
  return path.join(
    nativeRoot,
    DARWIN_MULTI_FORMAT_PICKER_HELPER_BUNDLE_NAME,
    "Contents",
    "MacOS",
    DARWIN_MULTI_FORMAT_PICKER_HELPER_NAME
  );
}

async function runDarwinMultiFormatPicker(
  execute = execFileAsync,
  helperPath = resolveDarwinMultiFormatPickerHelperPath()
) {
  try {
    const { stdout } = await execute(
      helperPath,
      [],
      { encoding: "utf8", maxBuffer: 32768 }
    );
    return parseDarwinPickerOutput(stdout);
  } catch {
    return failedPickerResult();
  }
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
  DARWIN_MULTI_FORMAT_PICKER_HELPER_BUNDLE_NAME,
  DARWIN_MULTI_FORMAT_PICKER_HELPER_NAME,
  chooseMultiFormatLocalFile,
  createMultiFormatOpenDialogOptions,
  parseDarwinPickerOutput,
  resolveDarwinMultiFormatPickerHelperPath,
  runDarwinMultiFormatPicker,
  validateMultiFormatPickerSelection
};
