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
import { sourceUnmodifiedMessage } from "./short-term-macos-feedback-model.mjs";

export async function createShortTermSaveProofOutput({
  state,
  suffix,
  reportToken,
  inspectShortTerm,
  setActiveOutput,
  renderPreviewModel,
  mountPrimaryPlayback,
  showSaveBanner
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
  const renamedBytes = renamed.renamedSvgaBase64 ? fromBase64(renamed.renamedSvgaBase64) : undefined;
  if (!renamedBytes?.byteLength || renamed.rename?.status !== "renamed") {
    throw new Error(renamed.rename?.diagnostic?.message || "保存证明输出生成失败。");
  }
  state.previewBytes = renamedBytes;
  state.model = await inspectShortTerm(renamedBytes, state.displayName);
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
  showSaveBanner
}) {
  if (!state.activeOutput?.bytes?.byteLength || !bridge?.saveShortTermSvgaOutput) return undefined;
  if (state.activeOutput.kind === "optimization" && !canSaveOptimizationResult(state.activeOutput.details)) {
    showSaveBanner(state.activeOutput.title || "优化结果不可保存。", state.activeOutput.summary || "保存保持关闭。");
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
  try {
    const outputKind = state.activeOutput.kind;
    const outputBytes = new Uint8Array(state.activeOutput.bytes);
    const expectedSha256 = await sha256Hex(outputBytes);
    const result = await bridge.saveShortTermSvgaOutput({
      command,
      sourceId: state.sourceId,
      suggestedName: state.activeOutput.suggestedName,
      bytesBase64: toBase64(outputBytes),
      expectedSha256
    });
    if (!result || result.status === "cancelled") {
      state.saveStatus = "idle";
      renderCommandState();
      showSaveBanner("已取消保存。", "当前输出仍未保存。");
      return result;
    }
    const savedModel = await inspectShortTerm(outputBytes, result.fileName || state.displayName);
    state.sourceBytes = outputBytes;
    state.previewBytes = new Uint8Array(outputBytes);
    state.sourceId = result.sourceId || state.sourceId;
    state.displayName = result.fileName || state.displayName;
    clearTransientOutput();
    state.cleanSaveAsVisible = outputKind !== "optimization" && command === "saveAs";
    state.model = savedModel;
    renderPreviewModel();
    await mountPrimaryPlayback(state.previewBytes);
    renderCommandState();
    showSaveBanner("已保存", "");
    await refreshRecentFiles();
    return {
      ...result,
      outputKind,
      expectedSha256
    };
  } catch (error) {
    state.saveStatus = "failed";
    renderCommandState();
    showSaveBanner("保存失败，请重试", sourceUnmodifiedMessage(error instanceof Error ? error.message : String(error)));
    throw error;
  }
}
