"use strict";

const path = require("node:path");

const SUPPORTED_MULTI_FORMAT_EXTENSIONS = new Set([".svga", ".json", ".mp4"]);

function createMultiFormatOpenDialogOptions(platform = process.platform) {
  const options = {
    title: "打开文件",
    filters: platform === "darwin"
      ? [{ name: "SVGA / Lottie JSON / VAP MP4", extensions: ["*"] }]
      : [
          { name: "SVGA / Lottie JSON / VAP MP4", extensions: ["svga", "json", "mp4"] },
          { name: "SVGA", extensions: ["svga"] },
          { name: "Lottie JSON", extensions: ["json"] },
          { name: "VAP MP4", extensions: ["mp4"] }
        ],
    properties: ["openFile"]
  };
  return options;
}

function validateMultiFormatPickerSelection(filePath) {
  if (typeof filePath !== "string" || !filePath.trim()) {
    return { status: "cancelled" };
  }
  if (!SUPPORTED_MULTI_FORMAT_EXTENSIONS.has(path.extname(filePath).toLowerCase())) {
    return {
      status: "failed",
      code: "unsupported_file_type",
      message: "仅支持 SVGA、Lottie JSON 或 VAP MP4 文件。",
      pathRedacted: true
    };
  }
  return { status: "selected", filePath };
}

async function chooseMultiFormatLocalFile({ showOpenDialog, platform = process.platform }) {
  try {
    const result = await showOpenDialog(createMultiFormatOpenDialogOptions(platform));
    if (result?.canceled || !result?.filePaths?.[0]) return { status: "cancelled" };
    return validateMultiFormatPickerSelection(result.filePaths[0]);
  } catch {
    return {
      status: "failed",
      code: "file_picker_failed",
      message: "无法打开文件选择器，源文件没有被修改。",
      pathRedacted: true
    };
  }
}

module.exports = {
  chooseMultiFormatLocalFile,
  createMultiFormatOpenDialogOptions,
  validateMultiFormatPickerSelection
};
