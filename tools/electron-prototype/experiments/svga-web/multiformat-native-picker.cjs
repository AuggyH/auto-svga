"use strict";

const { lstatSync } = require("node:fs");
const path = require("node:path");

const SUPPORTED_MULTI_FORMAT_EXTENSIONS = new Set([".svga", ".json", ".mp4", ".aep"]);
let darwinMultiFormatPickerActive = false;

function createMultiFormatOpenDialogOptions(platform = process.platform) {
  const options = {
    title: "打开文件",
    properties: ["openFile"]
  };
  if (platform !== "darwin") {
    options.filters = [
      { name: "SVGA / Lottie JSON / VAP MP4 / AEP Handoff", extensions: ["svga", "json", "mp4", "aep"] },
      { name: "SVGA", extensions: ["svga"] },
      { name: "Lottie JSON", extensions: ["json"] },
      { name: "VAP MP4", extensions: ["mp4"] },
      { name: "After Effects AEP Handoff", extensions: ["aep"] }
    ];
  }
  return options;
}

function failedPickerResult(code = "file_picker_failed") {
  return {
    status: "failed",
    code,
    message: code === "unsupported_file_type"
      ? "仅支持 SVGA、Lottie JSON、VAP MP4 或 After Effects AEP 交接文件。"
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

async function chooseMultiFormatLocalFile({
  showOpenDialog,
  platform = process.platform,
  readStats = lstatSync
}) {
  if (platform === "darwin" && darwinMultiFormatPickerActive) return failedPickerResult();
  if (platform === "darwin") darwinMultiFormatPickerActive = true;
  try {
    const result = await showOpenDialog(createMultiFormatOpenDialogOptions(platform));
    if (result?.canceled || !result?.filePaths?.[0]) return { status: "cancelled" };
    return validateMultiFormatPickerSelection(result.filePaths[0], readStats);
  } catch {
    return failedPickerResult();
  } finally {
    if (platform === "darwin") darwinMultiFormatPickerActive = false;
  }
}

module.exports = {
  chooseMultiFormatLocalFile,
  createMultiFormatOpenDialogOptions,
  validateMultiFormatPickerSelection
};
