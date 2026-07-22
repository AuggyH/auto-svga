import {
  fromBase64,
  sha256Hex,
  toBase64
} from "./short-term-macos-byte-model.mjs";
import { suffixName } from "./short-term-macos-render-model.mjs";
import { renameShortTermImageKey } from "./short-term-macos-api-client.mjs";
import {
  createSaveFailureProofActiveOutput,
  saveProofImageKey,
  saveProofSourceImageKey
} from "./short-term-macos-save-model.mjs";
import { canSaveOptimizationResult } from "./short-term-macos-optimization-model.mjs";

export async function createShortTermSaveProofOutput({
  state,
  suffix,
  reportToken,
  inspectShortTerm,
  setActiveOutput,
  renderPreviewModel,
  mountPrimaryPlayback,
  showSaveBanner,
  authorityIsCurrent = () => true
}) {
  if (!state.sourceBytes) throw new Error("保存证明需要先打开 SVGA。");
  const fromImageKey = saveProofSourceImageKey({
    selectedImageKey: state.selectedImageKey,
    model: state.model
  });
  if (!fromImageKey) throw new Error("保存证明没有可用 imageKey。");
  const toImageKey = saveProofImageKey(fromImageKey, suffix);
  showSaveBanner("正在生成保存证明输出。", "使用短期重命名工作流生成可验证 SVGA 输出。");
  const renamed = await renameShortTermImageKey({
    bytes: state.sourceBytes,
    name: state.displayName,
    fromImageKey,
    toImageKey,
    reportToken
  });
  if (!authorityIsCurrent()) return undefined;
  const renamedBytes = renamed.renamedSvgaBase64 ? fromBase64(renamed.renamedSvgaBase64) : undefined;
  if (!renamedBytes?.byteLength || renamed.rename?.status !== "renamed") {
    throw new Error(renamed.rename?.diagnostic?.message || "保存证明输出生成失败。");
  }
  const model = await inspectShortTerm(renamedBytes, state.displayName);
  if (!authorityIsCurrent()) return undefined;
  state.previewBytes = renamedBytes;
  state.model = model;
  state.selectedImageKey = toImageKey;
  setActiveOutput({
    kind: "rename",
    bytes: renamedBytes,
    suggestedName: suffixName(state.displayName, "renamed"),
    title: renamed.rename.resultTitle,
    summary: renamed.rename.resultSummary
  });
  renderPreviewModel();
  await mountPrimaryPlayback(state.previewBytes);
  return {
    fromImageKey,
    toImageKey,
    expectedSha256: await sha256Hex(renamedBytes)
  };
}

export function createShortTermSaveFailureProofOutput({ state, setActiveOutput }) {
  if (!state.sourceBytes) throw new Error("保存失败证明需要先打开 SVGA。");
  setActiveOutput(createSaveFailureProofActiveOutput(state.displayName));
}

export async function saveShortTermActiveOutput({
  bridge,
  command,
  state,
  inspectShortTerm,
  clearTransientOutput,
  renderPreviewModel,
  renderCommandState,
  mountPrimaryPlayback,
  refreshRecentFiles,
  showSaveBanner,
  onOptimizationOverwriteCommitted,
  authorityIsCurrent = () => true
}) {
  if (!state.activeOutput?.bytes?.byteLength || !bridge?.saveShortTermSvgaOutput) return undefined;
  if (state.activeOutput.kind === "optimization" && !canSaveOptimizationResult(state.activeOutput.details)) {
    showSaveBanner(state.activeOutput.title || "优化结果不可保存。", state.activeOutput.summary || "当前结果不可保存。");
    return undefined;
  }
  if (state.saveStatus === "validating") return undefined;
  if (command === "overwrite" && !state.sourceId) {
    showSaveBanner("当前文件不支持覆盖保存。", "请使用“另存为”保存这份 SVGA 输出。");
    return undefined;
  }
  state.saveStatus = "validating";
  renderCommandState();
  showSaveBanner("正在保存并验证输出…", "");
  const outputKind = state.activeOutput.kind;
  const outputBytes = new Uint8Array(state.activeOutput.bytes);
  let expectedSha256;
  let result;
  let savedModel;
  try {
    expectedSha256 = await sha256Hex(outputBytes);
    if (!authorityIsCurrent()) return undefined;
    result = await bridge.saveShortTermSvgaOutput({
      command,
      sourceId: state.sourceId,
      suggestedName: state.activeOutput.suggestedName,
      bytesBase64: toBase64(outputBytes),
      expectedSha256
    });
    if (!authorityIsCurrent()) return undefined;
    if (!result || result.status === "cancelled") {
      state.saveStatus = "idle";
      renderCommandState();
      showSaveBanner("已取消保存。", "当前输出仍未保存。");
      return result;
    }
    savedModel = await inspectShortTerm(outputBytes, result.fileName || state.displayName);
    if (!authorityIsCurrent()) return undefined;
    await mountPrimaryPlayback(outputBytes);
    if (!authorityIsCurrent()) return undefined;
  } catch {
    if (!authorityIsCurrent()) return undefined;
    state.saveStatus = "failed";
    renderCommandState();
    showSaveBanner("保存失败，请重试", "");
    return { status: "failed" };
  }
  state.sourceBytes = outputBytes;
  state.previewBytes = new Uint8Array(outputBytes);
  state.sourceId = result.sourceId || state.sourceId;
  state.displayName = result.fileName || state.displayName;
  clearTransientOutput();
  state.cleanSaveAsVisible = outputKind !== "optimization" && command === "saveAs";
  state.model = savedModel;
  renderPreviewModel();
  renderCommandState();
  if (outputKind === "optimization" && command === "overwrite") {
    onOptimizationOverwriteCommitted?.();
  }
  showSaveBanner("已保存", "");
  try {
    await refreshRecentFiles();
  } catch {
    // Recent refresh is ancillary after the validated Save has committed.
  }
  return {
    ...result,
    outputKind,
    expectedSha256
  };
}
