import { setActionEnabled } from "./short-term-macos-dom-state.mjs";
import {
  fromBase64,
  toBase64
} from "./short-term-macos-byte-model.mjs";
import {
  renameShortTermImageKey,
  replaceShortTermImageAsset
} from "./short-term-macos-api-client.mjs";
import {
  applyRuntimeTextSelection,
  renderReplaceableImages,
  renderRuntimeTextElements
} from "./short-term-macos-replaceable-renderers.mjs";
import { suffixName } from "./short-term-macos-render-model.mjs";
import {
  nextReplaceableSelection,
  replaceableImageListView
} from "./short-term-macos-replaceable-model.mjs";
import {
  nextSelectedTextKey,
  runtimeTextOverlayCopy,
  runtimeTextListView,
  selectedRuntimeTextElement
} from "./short-term-macos-text-model.mjs";
import {
  applyRuntimeTextOverlay,
  clearRuntimeTextOverlay
} from "./short-term-macos-text-renderers.mjs";

export function renderShortTermReplaceableImages({ nodes, state, model }) {
  if (!model) return;
  const view = replaceableImageListView(model, state.selectedImageKey, state.renameImageKey);
  renderReplaceableImages(nodes, view, state.model);
}

export function renderShortTermRuntimeTextElements({ nodes, state, model }) {
  const view = runtimeTextListView(model, state.textPreviewValues);
  state.selectedTextKey = nextSelectedTextKey(state.selectedTextKey, view.texts);
  renderRuntimeTextElements(nodes, view, state.selectedTextKey);
  setActionEnabled("edit-text", view.hasTextElements, "当前文件没有可预览文本元素");
  setActionEnabled("reset-text", view.hasTextPreview, "当前没有已应用的文本预览");
}

export function selectShortTermRuntimeTextElement({ nodes, state, textKey, rerender = true }) {
  if (!textKey) return;
  state.selectedTextKey = textKey;
  state.textPreview = state.textPreviewValues?.[textKey] || "";
  const textElement = selectedRuntimeTextElement(state.model?.replaceableElements, textKey);
  if (state.textPreview) {
    applyRuntimeTextOverlay(nodes.runtimeTextOverlay, runtimeTextOverlayCopy(textElement, state.textPreview), true);
  } else {
    clearRuntimeTextOverlay(nodes.runtimeTextOverlay);
  }
  if (!rerender) {
    applyRuntimeTextSelection(nodes, textKey);
    return;
  }
  renderShortTermRuntimeTextElements({
    nodes,
    state,
    model: state.model?.replaceableElements
  });
}

export function selectedShortTermRuntimeTextElement(state) {
  return selectedRuntimeTextElement(state.model?.replaceableElements, state.selectedTextKey);
}

export function selectShortTermImageKey({
  documentRef = document,
  nodes,
  state,
  imageKey
}) {
  if (!imageKey) return;
  const selection = nextReplaceableSelection(imageKey, state.renameImageKey);
  state.selectedImageKey = selection.selectedImageKey;
  state.renameImageKey = selection.renameImageKey;
  if (selection.shouldRerender) {
    renderShortTermReplaceableImages({
      nodes,
      state,
      model: state.model?.replaceableElements
    });
    return;
  }
  documentRef.querySelectorAll(".replaceableRow").forEach((row) => {
    const selected = row.dataset.imageKey === imageKey;
    row.classList.toggle("isSelected", selected);
    row.setAttribute("aria-selected", selected ? "true" : "false");
  });
}

export async function beginShortTermImageKeyRename({
  nodes,
  state,
  confirmDiscardUnsavedOutput,
  setMode,
  setTab
}) {
  if (!state.sourceBytes || !state.selectedImageKey) return;
  if (!(await confirmDiscardUnsavedOutput("重命名 imageKey 会放弃当前未保存的 SVGA 输出。"))) return;
  state.renameImageKey = state.selectedImageKey;
  if (state.view !== "preview") setMode("preview");
  setTab("replaceable");
  renderShortTermReplaceableImages({
    nodes,
    state,
    model: state.model?.replaceableElements
  });
  requestAnimationFrame(() => {
    const input = nodes.replaceableList.querySelector("[data-rename-input]");
    input?.focus();
    input?.select?.();
  });
}

export async function confirmShortTermInlineRename({
  bridge,
  nodes,
  state,
  inspectShortTerm,
  setActiveOutput,
  renderPreviewModel,
  mountPrimaryPlayback,
  showSaveBanner,
  showOperationFailure
}) {
  if (!state.sourceBytes || !state.renameImageKey) return;
  const fromImageKey = state.renameImageKey;
  const input = nodes.replaceableList.querySelector("[data-rename-input]");
  const toImageKey = input?.value?.trim() ?? "";
  if (!toImageKey || toImageKey === fromImageKey) {
    cancelShortTermInlineRename({ nodes, state });
    return;
  }
  showSaveBanner("正在重命名 imageKey。", "完成引用闭合检查后启用保存。");
  try {
    const renamed = await renameShortTermImageKey({
      bytes: state.sourceBytes,
      name: state.displayName,
      fromImageKey,
      toImageKey,
      reportToken: bridge?.reportToken
    });
    const renamedBytes = renamed.renamedSvgaBase64 ? fromBase64(renamed.renamedSvgaBase64) : undefined;
    if (!renamedBytes?.byteLength || renamed.rename?.status !== "renamed") {
      showSaveBanner(renamed.rename?.resultTitle || "重命名失败。", renamed.rename?.diagnostic?.message || "保存保持关闭。");
      return;
    }
    state.previewBytes = renamedBytes;
    state.model = await inspectShortTerm(renamedBytes, state.displayName);
    state.selectedImageKey = toImageKey;
    state.renameImageKey = "";
    setActiveOutput({
      kind: "rename",
      bytes: renamedBytes,
      suggestedName: suffixName(state.displayName, "renamed"),
      title: renamed.rename.resultTitle,
      summary: renamed.rename.resultSummary,
      details: renamed.rename
    });
    renderPreviewModel();
    await mountPrimaryPlayback(state.previewBytes);
  } catch (error) {
    showOperationFailure("重命名未完成。", error);
  }
}

export function cancelShortTermInlineRename({ nodes, state }) {
  state.renameImageKey = "";
  renderShortTermReplaceableImages({
    nodes,
    state,
    model: state.model?.replaceableElements
  });
}

export function chooseShortTermReplacementImage({ nodes, state, imageKey = state.selectedImageKey }) {
  if (!state.sourceBytes || !imageKey) return;
  state.selectedImageKey = imageKey;
  nodes.replacementFileInput.value = "";
  nodes.replacementFileInput.click();
}

export async function applyShortTermReplacementFile({
  bridge,
  file,
  state,
  confirmDiscardUnsavedOutput,
  inspectShortTerm,
  setActiveOutput,
  renderPreviewModel,
  mountPrimaryPlayback,
  showSaveBanner,
  showOperationFailure
}) {
  if (!file || !state.sourceBytes || !state.selectedImageKey) return;
  if (!(await confirmDiscardUnsavedOutput("替换图片会放弃当前未保存的 SVGA 输出。"))) return;
  showSaveBanner("正在替换图片资源。", "完成重开验证后启用保存。");
  try {
    const payload = {
      name: state.displayName,
      imageKey: state.selectedImageKey,
      svgaBase64: toBase64(state.sourceBytes),
      pngBase64: toBase64(new Uint8Array(await file.arrayBuffer()))
    };
    const replaced = await replaceShortTermImageAsset({
      payload,
      reportToken: bridge?.reportToken
    });
    const replacedBytes = replaced.replacedSvgaBase64 ? fromBase64(replaced.replacedSvgaBase64) : undefined;
    if (!replacedBytes?.byteLength || replaced.replacement?.status !== "replaced") {
      showSaveBanner(replaced.replacement?.resultTitle || "替换未完成。", replaced.replacement?.diagnostic?.message || "保存保持关闭。");
      return;
    }
    state.previewBytes = replacedBytes;
    state.model = await inspectShortTerm(replacedBytes, state.displayName);
    setActiveOutput({
      kind: "replacement",
      bytes: replacedBytes,
      suggestedName: suffixName(state.displayName, "replaced"),
      title: replaced.replacement.resultTitle,
      summary: replaced.replacement.resultSummary
    });
    renderPreviewModel();
    await mountPrimaryPlayback(state.previewBytes);
  } catch (error) {
    showOperationFailure("替换未完成。", error);
  }
}

export async function resetShortTermImageReplacement({
  state,
  inspectShortTerm,
  clearTransientOutput,
  renderPreviewModel,
  mountPrimaryPlayback
}) {
  if (!state.sourceBytes || state.activeOutput?.kind !== "replacement") return;
  state.previewBytes = new Uint8Array(state.sourceBytes);
  state.model = await inspectShortTerm(state.sourceBytes, state.displayName);
  clearTransientOutput();
  renderPreviewModel();
  await mountPrimaryPlayback(state.previewBytes);
}
