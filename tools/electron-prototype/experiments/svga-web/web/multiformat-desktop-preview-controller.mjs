import {
  applyCommandState,
  applyModeButtons,
  applyTabState,
  applyViewState
} from "./short-term-macos-dom-state.mjs";
import { closeOpenDialog } from "./short-term-macos-dialog-model.mjs";
import {
  hideShortTermCanvasToast,
  hideShortTermDragDecisionOverlays,
  showShortTermCanvasToast,
  showShortTermDragDecisionOverlay
} from "./short-term-macos-drag-decision-surface.mjs";
import {
  applyShortTermAppearance,
  closeShortTermSettings,
  openShortTermSettings
} from "./short-term-macos-settings-surface.mjs";
import {
  renderFailureMessage,
  renderFileHeader,
  renderLoadingMessage
} from "./short-term-macos-state-renderers.mjs";
import { syncShortTermMenuState, syncShortTermWindowMode } from "./short-term-macos-host-client.mjs";
import { createOverviewFactCell } from "./short-term-macos-overview-renderers.mjs";
import {
  createReplaceableImageRow,
  createTextElementRow,
  replaceRuntimeTextRows
} from "./short-term-macos-replaceable-renderers.mjs";
import { escapeHtml } from "./short-term-macos-render-model.mjs";
import { runtimeTextReplacementView } from "./short-term-macos-text-model.mjs";
import {
  multiFormatDragDecisionForEvent,
  multiFormatInventorySummaryItems,
  projectMultiFormatRightPanel
} from "./multiformat-product-conformance.mjs";

export const MULTIFORMAT_RENDERER_OPEN_TERMINAL_DEADLINE_MS = 15_000;
const genericOwnerFailureCopy = "操作未能完成，源文件没有被修改。";
const reviewedOwnerFailureCopyByCode = Object.freeze({
  unsupported_file_type: "仅支持 SVGA、Lottie JSON 或 VAP MP4 文件。",
  file_picker_failed: "无法打开文件选择器，源文件没有被修改。",
  open_failed: "无法打开本地文件，源文件没有被修改。",
  open_timeout: "文件加载超时，请重新打开文件。源文件没有被修改。",
  recent_file_missing: "这个最近文件已缺失或不可访问。",
  host_file_open_failed: "无法打开系统传入的本地文件，源文件没有被修改。",
  svga_preview_data_missing: "SVGA 文件没有返回可验证的本地预览数据，源文件没有被修改。",
  replacement_preview_failed: "无法更新替换预览，源文件没有被修改。",
  missing_resource: "预览所需资源缺失，源文件没有被修改。",
  unsupported_feature: "当前文件包含暂不支持的内容，无法完整预览。",
  parse_precondition: "文件内容不完整或格式异常，无法预览。",
  asset_reference_precondition: "文件内容不完整或格式异常，无法预览。",
  playback_failure: "文件预览播放出现问题。",
  runtime_preview_failed: "无法挂载本地预览，源文件没有被修改。"
});
const rendererIssueCopyByCode = Object.freeze({
  missing_resource: "预览所需资源缺失。",
  unsupported_feature: "当前文件包含暂不支持的内容。",
  invalid_file: "文件内容不完整或格式异常，无法预览。",
  playback_failure: "文件预览播放出现问题。",
  owner_issue: "当前文件存在无法显示的检查问题。"
});
const rendererUnsupportedFeatureCopyByFeature = Object.freeze({
  "表达式": "暂不支持：表达式",
  "蒙版": "暂不支持：蒙版",
  "特效": "暂不支持：特效",
  "时间重映射": "暂不支持：时间重映射",
  "3D 图层": "暂不支持：3D 图层",
  "摄像机图层": "暂不支持：摄像机图层",
  "纯色图层": "暂不支持：纯色图层",
  "内嵌图片资源": "暂不支持：内嵌图片资源",
  "非 H.264 视频编码": "暂不支持：非 H.264 视频编码",
  "未识别的融合元素类型": "暂不支持：未识别的融合元素类型"
});
const factLabels = new Map([
  ["Format", "格式"],
  ["Canvas", "画布"],
  ["Duration", "时长"],
  ["Layers", "图层"],
  ["Assets", "资源"],
  ["Replaceable", "可替换"],
  ["Inventory", "资产列表"],
  ["Media", "媒体"],
  ["Video codec", "视频编码"],
  ["Audio", "音频"],
  ["Unsupported", "不支持特性"]
]);

export function createMultiFormatDesktopPreviewController({
  bridge,
  nodes,
  state,
  svgaController,
  svgaPlaybackModuleLoader = () => import("./short-term-macos-playback-model.mjs")
}) {
  let activeRequest = 0;
  let runtimePreviewGeneration = 0;
  let activeRuntimePreview;
  let runtimePlaybackProgressFrame = 0;
  let cancelRuntimePlaybackProgressFrame = () => {};
  let svgaPlaybackModulePromise;
  let runtimeReplacementValues = new Map();
  let publicRuntimeReplacementTargets = new Map();
  let runtimeReplacementAuthorityGeneration = 0;
  let runtimeTextMutationGeneration = 0;
  let runtimeTextMutationSequence = 0;
  let runtimeTextMutationIntents = new Map();
  let runtimeTextMutationQueues = new Map();
  let runtimeTextMutationMayHaveAuthority = new Set();
  let hostFileOpenEventId = "";
  let hostFileOpenRequest = 0;
  let activeFormat = "";

  function svgaWorkflowActive() {
    return activeFormat === "svga" && Boolean(svgaController?.handlers);
  }

  function setView(view) {
    state.view = view;
    applyViewState(nodes.app, view);
    const windowMode = view === "launch" || (view === "failed" && !state.model)
      ? "launch"
      : "workbench";
    state.lastWindowModeSnapshot = syncShortTermWindowMode(bridge, windowMode, state.lastWindowModeSnapshot);
    renderCommandState();
  }

  function setMode(mode) {
    if (svgaWorkflowActive()) return svgaController.handlers.setMode?.(mode);
    state.mode = "preview";
    applyModeButtons("preview", {
      editEnabled: false,
      editReason: "当前格式仅支持预览"
    });
    if (state.model) setView("preview");
  }

  async function openFromHostDialog() {
    if (!(await confirmSvgaSourceReplacement("打开新文件会放弃当前未保存的 SVGA 输出。"))) return;
    const request = beginRequest();
    const outcome = await resolveMultiFormatChooserOutcome(
      Promise.resolve().then(() => bridge.openMultiFormatFile())
    );
    if (!isActiveRequest(request)) return;
    await applyOpenOutcome(outcome);
  }

  async function loadDroppedFile(file) {
    if (!(await confirmSvgaSourceReplacement("拖入新文件会放弃当前未保存的 SVGA 输出。"))) return;
    const request = beginRequest();
    setLoading("读取拖拽的本地文件。");
    const outcome = await resolveMultiFormatOpenOutcome(
      Promise.resolve().then(() => bridge.openDroppedMultiFormatFile(file)),
      { deadlineMs: MULTIFORMAT_RENDERER_OPEN_TERMINAL_DEADLINE_MS }
    );
    if (!isActiveRequest(request)) return;
    await applyOpenOutcome(outcome);
  }

  function beginHostFileOpen(payload = {}) {
    if (typeof payload?.eventId !== "string" || payload.eventId.length === 0) return false;
    hostFileOpenEventId = payload.eventId;
    hostFileOpenRequest = beginRequest();
    return true;
  }

  async function completeHostFileOpen(payload = {}) {
    if (!hostFileOpenIsActive(payload)) return false;
    const outcome = await resolveMultiFormatOpenOutcome(Promise.resolve(payload?.result), {
      deadlineMs: MULTIFORMAT_RENDERER_OPEN_TERMINAL_DEADLINE_MS
    });
    if (!hostFileOpenIsActive(payload)) return false;
    if (!(await confirmSvgaSourceReplacement("打开系统文件会放弃当前未保存的 SVGA 输出。"))) {
      clearHostFileOpenRequest();
      return false;
    }
    clearHostFileOpenRequest();
    await applyOpenOutcome(outcome);
    return true;
  }

  function failHostFileOpen(payload = {}) {
    if (!hostFileOpenIsActive(payload)) return false;
    clearHostFileOpenRequest();
    showOpenFailure(payload);
    return true;
  }

  function hostFileOpenIsActive(payload = {}) {
    return typeof payload?.eventId === "string"
      && payload.eventId === hostFileOpenEventId
      && isActiveRequest(hostFileOpenRequest);
  }

  function clearHostFileOpenRequest() {
    hostFileOpenEventId = "";
    hostFileOpenRequest = 0;
  }

  async function confirmSvgaSourceReplacement(message) {
    if (!svgaWorkflowActive()) return true;
    const confirm = svgaController?.handlers?.confirmDiscardUnsavedOutput;
    return typeof confirm === "function" ? confirm(message) : true;
  }

  async function openRecentFromMenu(recentFileId) {
    if (!(await confirmSvgaSourceReplacement("打开最近文件会放弃当前未保存的 SVGA 输出。"))) return;
    const request = beginRequest();
    const outcome = await resolveMultiFormatOpenOutcome(
      Promise.resolve().then(() => bridge.openRecentSvgaFile(recentFileId)),
      { deadlineMs: MULTIFORMAT_RENDERER_OPEN_TERMINAL_DEADLINE_MS }
    );
    if (!isActiveRequest(request)) return;
    if (outcome?.result?.status === "missing") {
      await svgaController?.handlers?.refreshRecentFiles?.();
    }
    await applyOpenOutcome(outcome);
    await svgaController?.handlers?.refreshRecentFiles?.();
  }

  async function dropCanvasFile(event, target, overlay) {
    const decision = showCanvasDragDecision(event, target, overlay);
    hideCanvasDragDecision();
    if (!decision.file) return;
    if (svgaWorkflowActive() && (!decision.supported || decision.focusZone === "compare")) {
      return svgaController.handlers.dropCanvasFile?.(event, target, overlay);
    }
    if (!decision.supported) {
      await closeFile();
      showShortTermCanvasToast(nodes, "不支持的文件格式");
      renderCommandState();
      return;
    }
    await loadDroppedFile(decision.file);
  }

  function showCanvasDragDecision(event, target, overlay) {
    const decision = multiFormatDragDecisionForEvent(target, event, { activeFormat });
    showShortTermDragDecisionOverlay(overlay, decision);
    return decision;
  }

  function hideCanvasDragDecision() {
    hideShortTermDragDecisionOverlays(nodes);
  }

  async function closeFile() {
    if (svgaWorkflowActive()) {
      await svgaController?.handlers?.closeFile?.();
      if (!state.sourceBytes) activeFormat = "";
      return;
    }
    activeRequest += 1;
    invalidateRuntimeTextMutations();
    clearRuntimePreview();
    clearRuntimeReplacementValues();
    await bridge.controlMultiFormatPreview({ action: "dispose" }).catch(() => {});
    state.model = undefined;
    state.sourceId = "";
    state.displayName = "";
    state.selectedImageKey = "";
    state.selectedTextKey = "";
    state.textPreviewValues = {};
    state.mode = "preview";
    state.tab = "overview";
    activeFormat = "";
    clearSurfaces();
    setView("launch");
  }

  async function control(action, input = {}) {
    if (!state.model) return;
    const result = await bridge.controlMultiFormatPreview({ action, ...input });
    applyHostResult(result, { keepView: true });
  }

  async function togglePrimaryPlayback() {
    if (svgaWorkflowActive()) return svgaController.handlers.togglePrimaryPlayback?.();
    const status = state.model?.status;
    if (status === "playing") {
      await control("pause");
      return;
    }
    if (status === "playbackBlocked" || status === "playbackFailed") {
      await control("recover");
      return;
    }
    await control("play");
  }

  async function replayPrimary() {
    if (svgaWorkflowActive()) return svgaController.handlers.replayPrimary?.();
    const status = state.model?.status;
    if (status === "playbackBlocked" || status === "playbackFailed") {
      await control("recover");
      return;
    }
    await control("seek", { timeMs: 0 });
    await control("play");
  }

  async function togglePrimaryPlaybackLoop() {
    if (svgaWorkflowActive()) return svgaController.handlers.togglePrimaryPlaybackLoop?.();
    state.primaryPlaybackLooping = state.primaryPlaybackLooping === false;
    await control("loop", { loop: state.primaryPlaybackLooping });
  }

  function setTab(tab, options = {}) {
    if (svgaWorkflowActive()) return svgaController.handlers.setTab?.(tab, options);
    state.tab = tab === "replaceable" ? "replaceable" : "overview";
    applyTabState(state.tab, options);
    renderCommandState();
  }

  function openTab(tab) {
    if (svgaWorkflowActive()) return svgaController.handlers.openTab?.(tab);
    setTab(tab, { focus: true, scroll: true });
  }

  function selectImageKey(imageKey) {
    if (svgaWorkflowActive()) return svgaController.handlers.selectImageKey?.(imageKey);
    if (!imageKey) return;
    state.selectedImageKey = imageKey;
    renderReplaceableTargets();
    renderCommandState();
  }

  function selectTextKey(textKey) {
    if (svgaWorkflowActive()) return svgaController.handlers.selectTextKey?.(textKey);
    if (!textKey) return;
    state.selectedTextKey = textKey;
    renderTextTargets();
    renderCommandState();
  }

  async function chooseReplacementImage(imageKey = state.selectedImageKey) {
    if (svgaWorkflowActive()) return svgaController.handlers.chooseReplacementImage?.(imageKey);
    if (!imageKey) return;
    state.selectedImageKey = imageKey;
    const sourceId = state.sourceId || "";
    const authorityGeneration = runtimeReplacementAuthorityGeneration;
    const result = await bridge.chooseMultiFormatReplacementImage?.({
      targetId: imageKey,
      sourceId,
      kind: "image"
    });
    if (!runtimeReplacementAuthorityIsCurrent(sourceId, authorityGeneration)) return;
    if (!result || result.status === "cancelled") {
      renderCommandState();
      return;
    }
    if (result.status === "failed") {
      showFailure({ code: "replacement_preview_failed" });
      return;
    }
    const runtimeValue = acceptedRuntimeReplacementValue(result, "image");
    if (replacementActionAccepted(result) && !runtimeValue) {
      showFailure({ code: "replacement_preview_failed" });
      return;
    }
    if (runtimeValue) {
      setPublicRuntimeReplacementTarget(result, "image", imageKey, runtimeValue.targetId);
      setRuntimeReplacementValue(
        "image",
        runtimeValue.targetId,
        runtimeValue.value
      );
    }
    applyHostResult(result, { keepView: true });
  }

  async function applyReplacementFile(file) {
    if (svgaWorkflowActive()) return svgaController.handlers.applyReplacementFile?.(file);
    if (!file || !state.selectedImageKey) return;
    const sourceId = state.sourceId || "";
    const selectedImageKey = state.selectedImageKey;
    const authorityGeneration = runtimeReplacementAuthorityGeneration;
    const dataUri = await fileToDataUri(file);
    if (!runtimeReplacementAuthorityIsCurrent(sourceId, authorityGeneration)) return;
    const result = await bridge.applyMultiFormatReplacement({
      targetId: selectedImageKey,
      sourceId,
      kind: "image",
      value: dataUri
    });
    if (!runtimeReplacementAuthorityIsCurrent(sourceId, authorityGeneration)) return;
    const runtimeValue = acceptedRuntimeReplacementValue(result, "image");
    if (replacementActionAccepted(result) && !runtimeValue) {
      showFailure({ code: "replacement_preview_failed" });
      return;
    }
    if (runtimeValue) {
      setPublicRuntimeReplacementTarget(result, "image", selectedImageKey, runtimeValue.targetId);
      setRuntimeReplacementValue(
        "image",
        runtimeValue.targetId,
        runtimeValue.value
      );
    }
    applyHostResult(result, { keepView: true });
  }

  async function resetImageReplacement(imageKey = state.selectedImageKey) {
    if (svgaWorkflowActive()) return svgaController.handlers.resetImageReplacement?.();
    if (!imageKey) return;
    state.selectedImageKey = imageKey;
    const result = await bridge.resetMultiFormatReplacement({
      targetId: imageKey,
      sourceId: state.sourceId,
      kind: "image"
    });
    const runtimeTargetId = acceptedResetRuntimeTargetId(result);
    if (replacementActionAccepted(result) && !runtimeTargetId) {
      showFailure("Replacement reset did not return an accepted runtime target binding.");
      return;
    }
    if (runtimeTargetId) clearRuntimeReplacementValues("image", runtimeTargetId);
    applyHostResult(result, { keepView: true });
  }

  function editRuntimeText() {
    if (svgaWorkflowActive()) return svgaController.handlers.editRuntimeText?.();
    const input = nodes.textElementList.querySelector(`[data-text-input][data-text-key="${cssEscape(state.selectedTextKey)}"]`);
    input?.focus();
    input?.select?.();
  }

  function updateRuntimeText(textKey, value) {
    if (svgaWorkflowActive()) return svgaController.handlers.updateRuntimeText?.(textKey, value);
    if (!textKey) return;
    state.selectedTextKey = textKey;
    state.textPreviewValues = state.textPreviewValues || {};
    const textTarget = (projectMultiFormatRightPanel(state.model).textTargets ?? [])
      .find((target) => target.textKey === textKey);
    const replacement = runtimeTextReplacementView(textTarget, value, {
      emptyIsSource: textTarget?.resetDisabled === true
    });
    if (replacement.hasPreview) {
      state.textPreviewValues[textKey] = replacement.value;
    } else {
      delete state.textPreviewValues[textKey];
    }
    renderTextTargets();
    renderCommandState();
    return enqueueRuntimeTextMutation(textKey, replacement);
  }

  function enqueueRuntimeTextMutation(textKey, replacement) {
    const intent = beginRuntimeTextMutationIntent(textKey, replacement);
    const previous = runtimeTextMutationQueues.get(intent.key) ?? Promise.resolve();
    const queued = previous
      .catch(() => {})
      .then(() => applyRuntimeTextMutationIntent(intent))
      .catch(() => {
        if (runtimeTextMutationIntentIsCurrent(intent)) {
          showFailure({ code: "replacement_preview_failed" });
        }
      })
      .finally(() => {
        if (runtimeTextMutationQueues.get(intent.key) === queued) {
          runtimeTextMutationQueues.delete(intent.key);
        }
      });
    runtimeTextMutationQueues.set(intent.key, queued);
    return queued;
  }

  function beginRuntimeTextMutationIntent(textKey, replacement) {
    const sourceId = state.sourceId || "";
    const generation = runtimeTextMutationGeneration;
    const sequence = ++runtimeTextMutationSequence;
    const key = `${generation}:${sourceId}:${textKey}`;
    const intent = {
      generation,
      sequence,
      sourceId,
      textKey,
      key,
      hasPreview: replacement.hasPreview,
      value: replacement.value
    };
    runtimeTextMutationIntents.set(key, intent);
    return intent;
  }

  function runtimeTextMutationIntentIsCurrent(intent) {
    return intent.generation === runtimeTextMutationGeneration
      && intent.sourceId === state.sourceId
      && runtimeTextMutationIntents.get(intent.key)?.sequence === intent.sequence;
  }

  async function applyRuntimeTextMutationIntent(intent) {
    if (!runtimeTextMutationIntentIsCurrent(intent)) return;
    if (!intent.hasPreview) {
      const resetRequired = runtimeTextMutationMayHaveAuthority.has(intent.key)
        || activeReplacementForPublicTarget(state.model, "text", intent.textKey, publicRuntimeReplacementTargets);
      if (!resetRequired) return;
      const result = await bridge.resetMultiFormatReplacement({
        targetId: intent.textKey,
        sourceId: intent.sourceId,
        kind: "text"
      });
      if (!runtimeTextMutationIntentIsCurrent(intent)) return;
      const runtimeTargetId = acceptedResetRuntimeTargetId(result);
      if (replacementActionAccepted(result) && !runtimeTargetId) {
        showFailure({ code: "replacement_preview_failed" });
        return;
      }
      if (replacementActionAccepted(result)) {
        clearRuntimeReplacementValues("text", runtimeTargetId);
      }
      runtimeTextMutationMayHaveAuthority.delete(intent.key);
      applyHostResult(result, { keepView: true });
      return;
    }

    runtimeTextMutationMayHaveAuthority.add(intent.key);
    const result = await bridge.applyMultiFormatReplacement({
      targetId: intent.textKey,
      sourceId: intent.sourceId,
      kind: "text",
      value: intent.value
    });
    if (!runtimeTextMutationIntentIsCurrent(intent)) return;
    const runtimeValue = acceptedRuntimeReplacementValue(result, "text");
    if (replacementActionAccepted(result) && !runtimeValue) {
      showFailure({ code: "replacement_preview_failed" });
      return;
    }
    if (runtimeValue) {
      setPublicRuntimeReplacementTarget(result, "text", intent.textKey, runtimeValue.targetId);
      setRuntimeReplacementValue("text", runtimeValue.targetId, runtimeValue.value);
    }
    applyHostResult(result, { keepView: true });
  }

  function resetRuntimeText(textKey = state.selectedTextKey) {
    if (svgaWorkflowActive()) return svgaController.handlers.resetRuntimeText?.();
    if (!textKey) return;
    const textTarget = (projectMultiFormatRightPanel(state.model).textTargets ?? [])
      .find((target) => target.textKey === textKey);
    return updateRuntimeText(textKey, textTarget?.initialText ?? "");
  }

  function applyHostResult(result, options = {}) {
    if (!result?.model) {
      showFailure({ code: options.keepView ? "replacement_preview_failed" : "open_failed" });
      return;
    }
    const model = result.ownerRightPanelSnapshotEnvelope && !result.model.ownerRightPanelSnapshotEnvelope
      ? { ...result.model, ownerRightPanelSnapshotEnvelope: result.ownerRightPanelSnapshotEnvelope }
      : result.model;
    const normalizedResult = model === result.model ? result : { ...result, model };
    state.model = model;
    state.sourceId = result.sourceId || state.sourceId || "";
    state.displayName = model.displayName || state.displayName || "";
    selectDefaultTargets(model);
    renderModel(normalizedResult);
    if (options.keepView && state.view === "preview") {
      renderCommandState();
      return;
    }
    setView(model.status === "failed" ? "failed" : "preview");
  }

  async function applyOpenedHostResult(result) {
    if (result?.model?.detectedFormat === "svga" && svgaController?.handlers?.loadOpenedSource) {
      const bytes = result?.svgaSource?.bytes;
      if (!bytes?.byteLength) {
        showOpenFailure({ code: "svga_preview_data_missing" });
        return;
      }
      clearRuntimePreview();
      clearRuntimeReplacementValues();
      activeFormat = "svga";
      await svgaController.handlers.loadOpenedSource({
        bytes,
        displayName: result.svgaSource.displayName || result.model.displayName || "local.svga",
        sourceId: result.sourceId || "",
        openedFromHost: true,
        startPlayback: result.model.status === "playing"
      });
      await svgaController.handlers.refreshRecentFiles?.();
      return;
    }
    if (activeFormat === "svga") svgaController?.handlers?.deactivateForMultiFormat?.();
    activeFormat = result?.model?.detectedFormat || "";
    state.mode = "preview";
    state.tab = "overview";
    applyModeButtons("preview", {
      editEnabled: false,
      editReason: "当前格式仅支持预览"
    });
    applyTabState("overview");
    clearRuntimeReplacementAuthorityForAcceptedOpen();
    applyHostResult(result);
  }

  function clearRuntimeReplacementAuthorityForAcceptedOpen() {
    runtimeReplacementAuthorityGeneration += 1;
    invalidateRuntimeTextMutations();
    clearRuntimeReplacementValues();
    state.textPreviewValues = {};
  }

  function runtimeReplacementAuthorityIsCurrent(sourceId, generation) {
    return generation === runtimeReplacementAuthorityGeneration
      && sourceId === (state.sourceId || "");
  }

  function setLoading(copy) {
    revokeActiveDocumentAuthority({ disposeHost: false });
    renderLoadingMessage(nodes, copy);
    setView("loading");
  }

  async function applyOpenOutcome(outcome) {
    if (outcome.kind === "cancelled") {
      return;
    }
    if (outcome.kind === "failure") {
      showOpenFailure(outcome);
      return;
    }
    await applyOpenedHostResult(outcome.result);
  }

  function renderModel(result) {
    const model = result.model;
    renderFileHeader(nodes, model.displayName || "本地文件", playbackMeta(model));
    renderFacts(model);
    renderAssets(model);
    renderIssues(model);
    renderReplaceableTargets();
    renderTextTargets();
    if (!activeRuntimePreviewOwnsCanvasOutput(result)) renderCanvasState();
    renderPlaybackState(model);
    mountRuntimePreview(result);
    if (model.status === "failed") {
      renderFailureMessage(nodes, issueSummary(model) || "文件未能解析，源文件没有被修改。");
    } else {
      renderFailureMessage(nodes, "");
    }
  }

  function renderFacts(model) {
    const rightPanel = projectMultiFormatRightPanel(model);
    const facts = (rightPanel.facts ?? []).map((fact) => ({
      ...fact,
      label: factLabels.get(fact.label) ?? fact.label
    }));
    nodes.factGrid.replaceChildren(...facts.map(createOverviewFactCell));
  }

  function renderAssets(model) {
    const rightPanel = projectMultiFormatRightPanel(model);
    const inventory = rightPanel.assetInventory;
    if (inventory?.groups?.length) {
      const groups = inventory.groups.filter((group) => {
        const items = Array.isArray(group.items) ? group.items : [];
        return items.length > 0 || group.status === "warning" || group.status === "blocked";
      });
      if (nodes.assetListHeading) {
        nodes.assetListHeading.textContent = `资产列表 (${inventory.summary.totalItems})`;
      }
      const summaryItems = multiFormatInventorySummaryItems(inventory.summary);
      if (nodes.assetFilterTabs) {
        nodes.assetFilterTabs.hidden = summaryItems.length === 0;
        nodes.assetFilterTabs.dataset.presentation = "summary";
      }
      nodes.assetFilterTabs?.setAttribute("role", "list");
      nodes.assetFilterTabs?.setAttribute("aria-label", "资产类型");
      nodes.assetFilterTabs?.replaceChildren(
        ...summaryItems.map(createInventorySummaryItem)
      );
      nodes.assetList.removeAttribute("role");
      nodes.assetList.replaceChildren(...groups.map(createAssetGroup));
      return;
    }

    const assets = rightPanel.assets ?? [];
    if (nodes.assetListHeading) nodes.assetListHeading.textContent = `资产列表 (${assets.length})`;
    if (nodes.assetFilterTabs) {
      nodes.assetFilterTabs.hidden = true;
      nodes.assetFilterTabs.dataset.presentation = "empty";
    }
    nodes.assetFilterTabs?.setAttribute("role", "tablist");
    nodes.assetFilterTabs?.setAttribute("aria-label", "资产类型");
    nodes.assetFilterTabs?.replaceChildren();
    nodes.assetList.setAttribute("role", "list");
    nodes.assetList.replaceChildren(...assets.map((asset) => {
      const row = document.createElement("article");
      row.className = "assetRow";
      row.dataset.component = "AssetRow";
      row.setAttribute("role", "listitem");
      row.dataset.kind = asset.kind || "unknown";
      const detail = [asset.dimensions, asset.fileSize, asset.resolutionStatus].filter(Boolean).join(" · ");
      const label = rowLabel(asset.name || asset.id, detail, asset.replaceable ? "可替换" : "");
      if (label) {
        row.title = label;
        row.setAttribute("aria-label", label);
      }
      row.innerHTML = `
        <span class="thumb">${escapeHtml((asset.ownerKind || "资源").slice(0, 1))}</span>
        <span class="rowText"><strong>${escapeHtml(asset.name || asset.id)}</strong>${detail ? `<span>${escapeHtml(detail)}</span>` : ""}</span>
        ${asset.replaceable ? `<span class="badge safe">可替换</span>` : ""}
      `;
      return row;
    }));
  }

  function rowLabel(...parts) {
    return parts
      .filter((part) => typeof part === "string" && part.trim())
      .join("，");
  }

  function createInventorySummaryItem(item) {
    const summary = document.createElement("span");
    summary.className = "assetSummaryItem";
    summary.dataset.summaryId = item.id;
    summary.dataset.count = String(item.count);
    summary.setAttribute("role", "listitem");
    summary.textContent = `${item.label} ${item.count}`;
    const label = rowLabel(item.label, String(item.count));
    summary.title = label;
    summary.setAttribute("aria-label", label);
    return summary;
  }

  function createAssetGroup(group) {
    const items = Array.isArray(group.items) ? group.items : [];
    const section = document.createElement("section");
    section.className = "assetGroup";
    section.dataset.role = "AssetInventoryGroup";
    section.dataset.group = group.id;
    section.dataset.status = group.status;
    section.dataset.empty = items.length === 0 ? "true" : "false";
    section.setAttribute("role", "group");
    const statusCopy = groupStatusCopy(group);
    const groupLabel = rowLabel(group.label, statusCopy, `${group.count} 项`);
    section.title = groupLabel;
    section.setAttribute("aria-label", groupLabel);

    const heading = document.createElement("header");
    heading.className = "assetGroupHeader";
    heading.dataset.status = group.status;
    heading.setAttribute("aria-label", groupLabel);
    heading.title = groupLabel;
    heading.innerHTML = `
      <span class="rowText"><strong>${escapeHtml(group.label)}</strong>${statusCopy ? `<span>${escapeHtml(statusCopy)}</span>` : ""}</span>
      <span class="badge">${escapeHtml(String(group.count))}</span>
    `;

    const list = document.createElement("div");
    list.className = "assetGroupList";
    list.setAttribute("role", "list");
    list.replaceChildren(...items.map(createInventoryItemRow));
    section.replaceChildren(heading, list);
    return section;
  }

  function createInventoryItemRow(item) {
    const row = document.createElement("article");
    row.className = "assetRow";
    row.dataset.component = "AssetRow";
    row.dataset.group = item.groupId;
    row.dataset.kind = item.kind || "unknown";
    row.dataset.source = item.source;
    row.dataset.status = item.status;
    row.dataset.attention = ["missing", "unsupported", "blocked"].includes(item.status) ? "true" : "false";
    row.dataset.replaceable = item.replaceable ? "true" : "false";
    row.setAttribute("role", "listitem");
    if (item.runtimeTargetId) row.dataset.runtimeTargetId = item.runtimeTargetId;
    const detail = item.detail?.length ? item.detail.join(" · ") : "";
    const label = rowLabel(item.label || item.id, detail, assetStatusCopy(item.status));
    row.title = label;
    row.setAttribute("aria-label", label);
    row.innerHTML = `
      <span class="thumb">${escapeHtml((item.kind || "?").slice(0, 1).toUpperCase())}</span>
      <span class="rowText"><strong>${escapeHtml(item.label || item.id)}</strong>${detail ? `<span>${escapeHtml(detail)}</span>` : ""}</span>
      ${inventoryItemBadgeHtml(item)}
    `;
    return row;
  }

  function groupStatusCopy(group) {
    if (group.status === "blocked") return "存在缺失或阻断";
    if (group.status === "warning") return "存在不支持项";
    if (group.replaceableCount > 0) return `${group.replaceableCount} 可替换`;
    return "";
  }

  function assetStatusCopy(status) {
    switch (status) {
      case "replaceable": return "可替换";
      case "missing": return "缺失";
      case "unsupported": return "不支持";
      case "blocked": return "阻断";
      case "not_applicable": return "不适用";
      case "available":
      default: return "可用";
    }
  }

  function inventoryItemBadgeHtml(item) {
    if (item.replaceable) return `<span class="badge safe">可替换</span>`;
    const statusTone = inventoryStatusTone(item.status);
    if (!statusTone) return "";
    return `<span class="badge ${statusTone}">${escapeHtml(assetStatusCopy(item.status))}</span>`;
  }

  function inventoryStatusTone(status) {
    switch (status) {
      case "missing":
      case "blocked":
        return "fail";
      case "unsupported":
        return "unsupported";
      default:
        return "";
    }
  }

  function renderIssues(model) {
    const rightPanel = projectMultiFormatRightPanel(model);
    const issues = [
      ...(rightPanel.issues ?? []),
      ...(rightPanel.unsupportedFeatures ?? []).map((entry) => ({
        code: "unsupported_feature",
        severity: entry.severity,
        feature: entry.feature
      }))
    ];
    nodes.findingList.setAttribute("role", "list");
    nodes.findingList.setAttribute("aria-label", "优化");
    nodes.findingList.replaceChildren(...issues.map((issue) => {
      const copy = issueDisplayCopy(issue);
      const severity = issueSeverity(issue.severity);
      const row = document.createElement("article");
      row.className = "findingRow";
      row.dataset.component = "FindingRow";
      row.dataset.severity = severity;
      row.dataset.disposition = issueDisposition(severity);
      row.setAttribute("role", "listitem");
      const label = rowLabel(copy);
      row.title = label;
      row.setAttribute("aria-label", label);
      row.innerHTML = `<div><strong>${escapeHtml(copy)}</strong></div>`;
      return row;
    }));
  }

  function issueDisplayCopy(issue) {
    if (issue?.code === "unsupported_feature" && typeof issue.feature === "string") {
      return rendererUnsupportedFeatureCopyByFeature[issue.feature] ?? rendererIssueCopyByCode.unsupported_feature;
    }
    return rendererIssueCopyByCode[issue?.code] ?? rendererIssueCopyByCode.owner_issue;
  }

  function issueSeverity(severity) {
    return severity === "error" || severity === "info" ? severity : "warning";
  }

  function issueDisposition(severity) {
    return severity === "error" ? "unsupported" : "reviewOnly";
  }

  function renderReplaceableTargets() {
    const model = state.model;
    const rightPanel = projectMultiFormatRightPanel(model);
    const targets = (rightPanel.imageTargets ?? []).map((target) => ({
      ...target,
      replacementActive: multiFormatActiveReplacementForPublicTarget(
        model,
        "image",
        target.imageKey,
        publicRuntimeReplacementTargets
      )
    }));
    nodes.replaceableSummary.textContent = targets.length
      ? `${targets.length} 个可替换图片`
      : "当前文件没有可替换图片。";
    nodes.replaceableList.replaceChildren(...targets.map((target, index) => createReplaceableImageRow(target, index, {
      model,
      selected: state.selectedImageKey === target.imageKey,
      renaming: false,
      directReplace: true,
      replacementActive: target.replacementActive
    })));
  }

  function renderTextTargets() {
    const rightPanel = projectMultiFormatRightPanel(state.model);
    const targets = (rightPanel.textTargets ?? []).map((target) => {
      const active = multiFormatActiveReplacementEntryForPublicTarget(
        state.model,
        "text",
        target.textKey,
        publicRuntimeReplacementTargets
      );
      return {
        ...target,
        inputValue: state.textPreviewValues[target.textKey] ?? active?.valuePreview ?? target.initialText ?? "",
        replacementActive: Boolean(active)
      };
    });
    replaceRuntimeTextRows(nodes.textElementList, targets.map((target, index) => createTextElementRow(target, index, {
      selected: state.selectedTextKey === target.textKey,
      replacementActive: target.replacementActive
    })));
  }

  function renderCanvasState() {
    const canvas = nodes.primaryCanvas;
    const context = canvas?.getContext?.("2d");
    if (!canvas || !context) return;
    const rect = canvas.getBoundingClientRect?.();
    const width = Math.max(320, Math.round(rect?.width || canvas.width || 640));
    const height = Math.max(240, Math.round(rect?.height || canvas.height || 420));
    canvas.width = width;
    canvas.height = height;
    context.clearRect(0, 0, width, height);
    canvas.dataset.surfaceState = "preparing";
  }

  function mountRuntimePreview(result) {
    const model = result?.model;
    const format = model?.detectedFormat;
    const sourceId = result?.sourceId || state.sourceId;
    const mountable = (format === "svga" || format === "lottie" || format === "vap")
      && sourceId
      && ["previewReady", "playing", "paused"].includes(model.status);
    if (!mountable || !bridge?.prepareMultiFormatRuntimePreview) {
      clearRuntimePreview();
      return;
    }

    const runtimeIdentity = {
      sourceId,
      replacementSignature: runtimeReplacementSignature(model)
    };
    if (format === "svga" && syncReusableSvgaRuntimePreview(runtimeIdentity, model)) {
      return;
    }
    if (format === "lottie" && syncReusableLottieRuntimePreview(runtimeIdentity, model)) {
      return;
    }
    if (format === "vap" && syncReusableVapRuntimePreview(runtimeIdentity, model)) {
      return;
    }

    const generation = beginRuntimePreviewGeneration();
    const mount = ensureRuntimeMount();
    mount.hidden = false;
    mount.dataset.runtimePreviewState = "preparing";
    mount.dataset.runtimeFormat = format;
    delete mount.dataset.runtimePlayerReady;
    delete mount.dataset.runtimePlaybackFrame;
    delete mount.dataset.runtimePlaybackFrames;
    if (nodes.primaryCanvas) nodes.primaryCanvas.style.visibility = "hidden";
    bridge.prepareMultiFormatRuntimePreview({
      sourceId,
      format,
      requestId: model.requestId,
      replacements: runtimePreviewReplacementPayload(model.replacement)
    }).then(async (payload) => {
      if (!isActiveRuntimePreviewGeneration(generation)) return;
      if (payload?.status !== "prepared") {
        throw new RuntimePreviewPayloadError(payload?.issue);
      }
      if (format === "svga") {
        await mountSvgaRuntimePreview(payload, mount, model, generation, runtimeIdentity);
      } else if (format === "lottie") {
        await mountLottieRuntimePreview(payload, mount, model, generation, runtimeIdentity);
      } else {
        await mountVapRuntimePreview(payload, mount, model, generation, runtimeIdentity);
      }
    }).catch((error) => {
      if (!isActiveRuntimePreviewGeneration(generation)) return;
      showRuntimePreviewFailure(error);
    });
  }

  function beginRuntimePreviewGeneration() {
    runtimePreviewGeneration += 1;
    disposeActiveRuntimePreview();
    return runtimePreviewGeneration;
  }

  function isActiveRuntimePreviewGeneration(generation) {
    return runtimePreviewGeneration === generation;
  }

  function clearRuntimePreview(options = {}) {
    if (options.preserveGeneration !== true) runtimePreviewGeneration += 1;
    disposeActiveRuntimePreview();
  }

  function disposeActiveRuntimePreview() {
    stopRuntimePlaybackProgressLoop();
    const active = activeRuntimePreview;
    activeRuntimePreview = undefined;
    try {
      active?.cleanup?.();
    } catch {}
    try {
      active?.animation?.destroy?.();
    } catch {}
    try {
      active?.player?.pause?.();
    } catch {}
    try {
      active?.player?.cancelRequestAnimation?.();
    } catch {}
    try {
      active?.player?.destroy?.();
    } catch {}
    if (active?.format === "vap" && active?.player) {
      try {
        active.player.video = vapDisposedVideoSentinel();
      } catch {}
    }
    if (active?.format === "svga") {
      try {
        active.stopPlayback?.({ key: active.playbackKey, playbackState: state });
      } catch {}
    }
    if (active?.objectUrl) {
      try {
        URL.revokeObjectURL(active.objectUrl);
      } catch {}
    }
    const mount = runtimeMountNode();
    if (mount) {
      mount.replaceChildren();
      mount.hidden = true;
      mount.dataset.runtimePreviewState = "idle";
      delete mount.dataset.runtimeFormat;
      delete mount.dataset.runtimePlayerReady;
      delete mount.dataset.runtimePlaybackProgress;
      delete mount.dataset.runtimePlaybackTimeCopy;
      delete mount.dataset.runtimePlaybackFrame;
      delete mount.dataset.runtimePlaybackFrames;
    }
    if (nodes.primaryCanvas) nodes.primaryCanvas.style.visibility = "";
  }

  function ensureRuntimeMount() {
    const existing = runtimeMountNode();
    if (existing) return existing;
    const mount = document.createElement("div");
    mount.id = "multiFormatRuntimeMount";
    mount.className = "multiFormatRuntimeMount";
    mount.dataset.role = "MultiFormatRuntimeMount";
    mount.dataset.runtimePreviewState = "idle";
    mount.hidden = true;
    nodes.primaryCanvas?.parentElement?.append(mount);
    return mount;
  }

  function runtimeMountNode() {
    return nodes.primaryCanvas?.parentElement?.querySelector("#multiFormatRuntimeMount");
  }

  function activeRuntimePreviewOwnsCanvasOutput(result) {
    const model = result?.model;
    if (model?.detectedFormat !== "svga") return false;
    const sourceId = result?.sourceId || state.sourceId;
    const mount = runtimeMountNode();
    return Boolean(sourceId)
      && activeRuntimePreview?.format === "svga"
      && activeRuntimePreview.sourceId === sourceId
      && activeRuntimePreview.replacementSignature === runtimeReplacementSignature(model)
      && mount?.dataset.runtimePreviewState === "loaded"
      && mount?.dataset.runtimeFormat === "svga"
      && mount?.dataset.runtimePlayerReady === "svga-web"
      && activeRuntimePreview.canvas?.parentElement === mount
      && activeRuntimePreview.canvas?.dataset.runtimePlayer === "svga-web";
  }

  async function mountSvgaRuntimePreview(payload, mount, model, generation, runtimeIdentity) {
    if (payload?.status !== "prepared" || payload.format !== "svga") {
      throw new RuntimePreviewPayloadError(payload?.issue);
    }
    const bytes = base64ToBytes(payload.svgaBase64);
    const svgaPlayback = await loadSvgaPlaybackModule();
    if (!isActiveRuntimePreviewGeneration(generation)) return;
    const canvas = document.createElement("canvas");
    const playbackKey = `multiFormatSvga:${generation}`;
    canvas.className = "multiFormatSvgaRuntimeCanvas";
    canvas.dataset.runtimeGeneration = String(generation);
    mount.replaceChildren(canvas);
    mount.hidden = false;
    mount.dataset.runtimePreviewState = "preparing";
    mount.dataset.runtimeFormat = "svga";
    delete mount.dataset.runtimePlayerReady;
    if (nodes.primaryCanvas) nodes.primaryCanvas.style.visibility = "hidden";
    const playback = await svgaPlayback.mountPlayback({
      key: playbackKey,
      canvas,
      bytes,
      options: {
        loop: state.primaryPlaybackLooping !== false,
        start: model.status === "playing"
      },
      playbackState: state,
      onPlaybackStateChange: () => renderRuntimePlaybackProgress()
    });
    if (!isActiveRuntimePreviewGeneration(generation) || canvas.parentElement !== mount || mount.children?.[0] !== canvas) {
      svgaPlayback.stopPlayback({ key: playbackKey, playbackState: state });
      return;
    }
    if (model.status === "paused" || model.status === "previewReady") {
      if (svgaPlayback.pausePlaybackAtCurrentFrame) {
        svgaPlayback.pausePlaybackAtCurrentFrame(playback);
      } else {
        playback?.player?.pause?.();
        if (playback) playback.playing = false;
      }
    }
    mount.dataset.runtimePreviewState = "loaded";
    mount.dataset.runtimeFormat = "svga";
    mount.dataset.runtimePlayerReady = playback?.player ? "svga-web" : "";
    canvas.dataset.runtimePlayer = playback?.player ? "svga-web" : "";
    activeRuntimePreview = {
      format: "svga",
      sourceId: runtimeIdentity.sourceId,
      replacementSignature: runtimeIdentity.replacementSignature,
      canvas,
      playbackKey,
      playback,
      playbackProgressView: svgaPlayback.playbackProgressView,
      pausePlaybackAtCurrentFrame: svgaPlayback.pausePlaybackAtCurrentFrame,
      stopPlayback: svgaPlayback.stopPlayback
    };
    renderRuntimePlaybackProgress();
    startRuntimePlaybackProgressLoop();
  }

  async function mountLottieRuntimePreview(payload, mount, model, generation, runtimeIdentity) {
    await loadRuntimeScript(payload.runtimeScripts?.[0], "lottie");
    if (!isActiveRuntimePreviewGeneration(generation)) return;
    const lottie = globalThis.lottie;
    if (!lottie?.loadAnimation) throw new Error("The approved Lottie SVG runtime did not expose loadAnimation.");
    mount.replaceChildren();
    const animation = lottie.loadAnimation({
      container: mount,
      renderer: "svg",
      loop: state.primaryPlaybackLooping !== false,
      autoplay: model.status === "playing",
      rendererSettings: { runExpressions: false },
      animationData: payload.animationData
    });
    activeRuntimePreview = {
      format: "lottie",
      animation,
      sourceId: runtimeIdentity.sourceId,
      replacementSignature: runtimeIdentity.replacementSignature,
      fps: Number(payload?.playback?.fps) || Number(payload?.animationData?.fr) || 30,
      durationMs: Number(payload?.playback?.durationMs) || Number(model?.canvas?.playback?.durationMs) || 0
    };
    const frame = lottieFrameFromPlayback(model, payload);
    if (model.status === "paused" || model.status === "previewReady") animation.goToAndStop?.(frame, true);
    if (model.status === "playing") animation.play?.();
    mount.dataset.runtimePreviewState = "loaded";
    mount.dataset.runtimeFormat = "lottie";
    renderRuntimePlaybackProgress();
    startRuntimePlaybackProgressLoop();
  }

  async function mountVapRuntimePreview(payload, mount, model, generation, runtimeIdentity) {
    await loadVapRuntimeScript(payload.runtimeScripts?.[0]);
    if (!isActiveRuntimePreviewGeneration(generation)) return;
    const vapModule = globalThis.Vap;
    const VapConstructor = typeof vapModule?.default === "function" ? vapModule.default : typeof vapModule === "function" ? vapModule : undefined;
    if (!VapConstructor) throw new Error("The approved VAP runtime did not expose a constructor.");
    if (typeof vapModule?.canWebGL === "function" && vapModule.canWebGL() !== true) {
      throw new Error("The current renderer cannot create a WebGL VAP preview.");
    }
    mount.replaceChildren();
    mount.dataset.runtimePreviewState = "preparing";
    mount.dataset.runtimeFormat = "vap";
    const blob = new Blob([base64ToBytes(payload.mp4Base64)], { type: payload.mediaType || "video/mp4" });
    const objectUrl = URL.createObjectURL(blob);
    const player = VapConstructor({
      container: mount,
      src: objectUrl,
      config: payload.vapConfig,
      width: payload.dimensions?.width,
      height: payload.dimensions?.height,
      fps: payload.playback?.fps,
      loop: state.primaryPlaybackLooping !== false,
      mute: true,
      precache: false,
      accurate: true,
      ...(payload.fusionParams ?? {}),
      onLoadError: (error) => {
        if (!isActiveRuntimePreviewGeneration(generation)) return;
        showRuntimePreviewFailure(new RuntimePreviewPayloadError({
          code: "playback_failure",
          message: "VAP runtime preview reached a typed playback failure.",
          details: { reason: "vap_runtime_load_error", cause: error ? "redacted runtime error" : undefined }
        }));
      }
    });
    fitVapRuntimeCanvas(mount);
    activeRuntimePreview = {
      format: "vap",
      player,
      objectUrl,
      sourceId: runtimeIdentity.sourceId,
      replacementSignature: runtimeIdentity.replacementSignature,
      desiredStatus: model.status,
      runtimeReady: false,
      cleanup: bindVapPlaybackReadinessGuards(mount, player, generation),
      currentTimeMs: undefined,
      playbackStatus: undefined
    };
    const currentTimeMs = Number(model.canvas?.playback?.currentTimeMs) || 0;
    syncVapRuntimePlayback(activeRuntimePreview, model, {
      forceSeek: currentTimeMs > 0,
      deferPlaybackUntilReady: true
    });
    mount.dataset.runtimePreviewState = "loaded";
    mount.dataset.runtimeFormat = "vap";
    renderRuntimePlaybackProgress();
    startRuntimePlaybackProgressLoop();
  }

  function syncReusableSvgaRuntimePreview(runtimeIdentity, model) {
    const active = activeRuntimePreview;
    if (active?.format !== "svga" || !active.playback) return false;
    if (active.sourceId !== runtimeIdentity.sourceId) return false;
    if (active.replacementSignature !== runtimeIdentity.replacementSignature) return false;
    const mount = runtimeMountNode();
    if (!mount || active.canvas?.parentElement !== mount || active.canvas?.dataset.runtimePlayer !== "svga-web") return false;
    if (model.status === "playing") {
      if (!active.playback.playing) {
        active.playback.player?.start?.();
        active.playback.playing = true;
      }
    } else if (model.status === "paused" || model.status === "previewReady") {
      if (active.pausePlaybackAtCurrentFrame) {
        active.pausePlaybackAtCurrentFrame(active.playback);
      } else {
        active.playback.player?.pause?.();
        active.playback.playing = false;
      }
    }
    renderRuntimePlaybackProgress();
    startRuntimePlaybackProgressLoop();
    mount.hidden = false;
    if (nodes.primaryCanvas) nodes.primaryCanvas.style.visibility = "hidden";
    return true;
  }

  function syncReusableLottieRuntimePreview(runtimeIdentity, model) {
    const active = activeRuntimePreview;
    if (active?.format !== "lottie" || !active.animation) return false;
    if (active.sourceId !== runtimeIdentity.sourceId) return false;
    if (active.replacementSignature !== runtimeIdentity.replacementSignature) return false;
    const mount = runtimeMountNode();
    if (!mount || mount.dataset.runtimePreviewState !== "loaded" || mount.dataset.runtimeFormat !== "lottie") return false;
    if (model.status === "playing") {
      active.animation.play?.();
    } else if (model.status === "paused" || model.status === "previewReady") {
      active.animation.pause?.();
    }
    mount.hidden = false;
    if (nodes.primaryCanvas) nodes.primaryCanvas.style.visibility = "hidden";
    renderRuntimePlaybackProgress();
    startRuntimePlaybackProgressLoop();
    return true;
  }

  function syncReusableVapRuntimePreview(runtimeIdentity, model) {
    const active = activeRuntimePreview;
    if (active?.format !== "vap" || !active.player) return false;
    if (active.sourceId !== runtimeIdentity.sourceId) return false;
    if (active.replacementSignature !== runtimeIdentity.replacementSignature) return false;
    const mount = runtimeMountNode();
    if (!mount || mount.dataset.runtimePreviewState !== "loaded" || mount.dataset.runtimeFormat !== "vap") return false;
    syncVapRuntimePlayback(active, model);
    mount.hidden = false;
    if (nodes.primaryCanvas) nodes.primaryCanvas.style.visibility = "hidden";
    return true;
  }

  function syncVapRuntimePlayback(active, model, options = {}) {
    const player = active?.player;
    if (!player) return;
    active.desiredStatus = model.status;
    const currentTimeMs = Math.max(0, Number(model.canvas?.playback?.currentTimeMs) || 0);
    if (options.forceSeek || active.currentTimeMs !== currentTimeMs) {
      player.setTime?.(currentTimeMs / 1000);
      active.currentTimeMs = currentTimeMs;
    }
    if (options.deferPlaybackUntilReady && active.runtimeReady !== true && model.status !== "playing") return;
    if (model.status === "playing") {
      if (options.forcePlayback || active.playbackStatus !== "playing") invokeVapRuntimePlay(player, active);
      active.playbackStatus = "playing";
      return;
    }
    if (model.status === "paused" || model.status === "previewReady") {
      if (options.forcePlayback || active.playbackStatus !== model.status) player.pause?.();
      active.playbackStatus = model.status;
    }
  }

  function invokeVapRuntimePlay(player, active) {
    const playResult = player?.play?.();
    if (playResult && typeof playResult.catch === "function") {
      playResult.catch(() => {
        if (activeRuntimePreview !== active) return;
        showRuntimePreviewFailure(new RuntimePreviewPayloadError({
          code: "playback_failure",
          message: "VAP runtime preview reached a typed playback failure.",
          details: { reason: "vap_runtime_play_rejected" }
        }));
      });
    }
  }

  function startRuntimePlaybackProgressLoop() {
    if (runtimePlaybackProgressFrame) return;
    const tick = () => {
      renderRuntimePlaybackProgress();
      if (!activeRuntimePreview) {
        runtimePlaybackProgressFrame = 0;
        cancelRuntimePlaybackProgressFrame = () => {};
        return;
      }
      runtimePlaybackProgressFrame = scheduleRuntimePlaybackProgress(tick);
    };
    tick();
  }

  function stopRuntimePlaybackProgressLoop() {
    if (runtimePlaybackProgressFrame) cancelRuntimePlaybackProgressFrame(runtimePlaybackProgressFrame);
    runtimePlaybackProgressFrame = 0;
    cancelRuntimePlaybackProgressFrame = () => {};
  }

  function scheduleRuntimePlaybackProgress(callback) {
    if (typeof globalThis.requestAnimationFrame === "function") {
      cancelRuntimePlaybackProgressFrame = (frame) => globalThis.cancelAnimationFrame?.(frame);
      return globalThis.requestAnimationFrame(callback);
    }
    cancelRuntimePlaybackProgressFrame = (frame) => clearTimeout(frame);
    const frame = setTimeout(() => callback(Date.now()), 100);
    frame?.unref?.();
    return frame;
  }

  function renderRuntimePlaybackProgress() {
    const active = activeRuntimePreview;
    if (!active || !nodes.playbackTime) return;
    let progress = 0;
    let timeCopy = "";
    if (active.format === "svga" && active.playback) {
      const view = active.playbackProgressView(active.playback);
      progress = view.progress;
      timeCopy = view.timeCopy;
      const mount = runtimeMountNode();
      if (mount) {
        mount.dataset.runtimePlaybackFrame = String(view.frame ?? 0);
        mount.dataset.runtimePlaybackFrames = String(view.frames ?? 0);
      }
    } else if (active.format === "vap") {
      drawVapRuntimeFrame(active);
      const video = active.player?.video;
      const durationMs = Number(state.model?.canvas?.playback?.durationMs) || (Number(video?.duration) > 0 ? Number(video.duration) * 1000 : 0);
      const currentMs = Number(video?.currentTime) > 0 ? Number(video.currentTime) * 1000 : Number(state.model?.canvas?.playback?.currentTimeMs) || 0;
      progress = durationMs > 0 ? Math.max(0, Math.min(100, (currentMs / durationMs) * 100)) : 0;
      timeCopy = `${formatTime(currentMs)} / ${formatTime(durationMs)}`;
    } else if (active.format === "lottie") {
      const currentFrame = Number(active.animation?.currentFrame) || 0;
      const fps = Number(active.fps) || 30;
      const currentMs = fps > 0 ? (currentFrame / fps) * 1000 : 0;
      const durationMs = Number(active.durationMs) || Number(state.model?.canvas?.playback?.durationMs) || 0;
      progress = durationMs > 0 ? Math.max(0, Math.min(100, (currentMs / durationMs) * 100)) : 0;
      timeCopy = `${formatTime(currentMs)} / ${formatTime(durationMs)}`;
      const mount = runtimeMountNode();
      if (mount) {
        mount.dataset.runtimePlaybackFrame = String(currentFrame);
        mount.dataset.runtimePlaybackFrames = String(durationMs > 0 && fps > 0 ? (durationMs / 1000) * fps : 0);
      }
    }
    if (timeCopy) nodes.playbackTime.textContent = timeCopy;
    const mount = runtimeMountNode();
    if (mount) {
      mount.dataset.runtimePlaybackProgress = String(Math.round(progress));
      mount.dataset.runtimePlaybackTimeCopy = timeCopy;
      if (active.format === "svga" && active.playback?.player) {
        mount.dataset.runtimePlayerReady = "svga-web";
      }
      if (active.format === "vap") {
        delete mount.dataset.runtimePlaybackFrame;
        delete mount.dataset.runtimePlaybackFrames;
      }
    }
    nodes.playbackProgress?.setAttribute("aria-valuenow", String(Math.round(progress)));
    applyPlaybackProgress(progress);
  }

  function applyPlaybackProgress(progress) {
    const value = `${Math.round(progress)}%`;
    const style = nodes.playbackProgress?.style;
    if (style && typeof style.setProperty === "function") {
      style.setProperty("--asv-playback-progress", value);
    } else if (style) {
      style["--asv-playback-progress"] = value;
    }
    const bar = nodes.playbackProgress?.querySelector("span");
    if (bar) bar.style.width = value;
  }

  function drawVapRuntimeFrame(active) {
    const player = active?.player;
    if (!player || typeof player.drawFrame !== "function") {
      return { drawn: false, reason: "missing_draw_frame" };
    }
    try {
      player.drawFrame(null, null);
      player.cancelRequestAnimation?.();
      return {
        drawn: true,
        hasVideo: Boolean(player.video),
        videoReadyState: Number(player.video?.readyState) || 0,
        videoCurrentTime: Number(player.video?.currentTime) || 0,
        hasWebglCanvas: Boolean(player.canvas)
      };
    } catch (error) {
      return {
        drawn: false,
        reason: "draw_frame_failed",
        errorName: String(error?.name || "Error"),
        errorMessage: String(error?.message || "redacted runtime error").replace(/\/Users\/[^ "']+/gu, "[redacted-path]")
      };
    }
  }

  function vapDisposedVideoSentinel() {
    return {
      currentTime: 0,
      readyState: 0,
      paused: true,
      requestVideoFrameCallback() {
        return 0;
      },
      cancelVideoFrameCallback() {},
      play() {
        return Promise.resolve();
      },
      pause() {},
      addEventListener() {},
      removeEventListener() {}
    };
  }

  function loadSvgaPlaybackModule() {
    if (!svgaPlaybackModulePromise) {
      svgaPlaybackModulePromise = Promise.resolve().then(() => svgaPlaybackModuleLoader());
    }
    return svgaPlaybackModulePromise;
  }

  function bindVapPlaybackReadinessGuards(mount, player, generation) {
    let video;
    let discoveryTimer;
    let resizeObserver;
    let discoveryAttempts = 0;
    const syncDesiredPlayback = (event) => {
      if (!isActiveRuntimePreviewGeneration(generation)) return;
      if (activeRuntimePreview?.player !== player) return;
      if (event?.type === "playing") activeRuntimePreview.runtimeReady = true;
      fitVapRuntimeCanvas(mount);
      syncVapRuntimePlayback(activeRuntimePreview, state.model ?? {}, { forcePlayback: true });
    };
    const bindVideo = () => {
      const candidate = player?.video;
      if (!candidate || candidate === video || typeof candidate.addEventListener !== "function") return false;
      video = candidate;
      try {
        video.muted = true;
        video.playsInline = true;
        video.preload = "auto";
        video.setAttribute?.("muted", "");
        video.setAttribute?.("playsinline", "");
        video.setAttribute?.("preload", "auto");
      } catch {}
      ["loadedmetadata", "loadeddata", "canplay", "canplaythrough", "playing"].forEach((eventName) => {
        video.addEventListener(eventName, syncDesiredPlayback);
      });
      if (Number(video.readyState) >= 2) syncDesiredPlayback({ type: "readyState" });
      else syncVapRuntimePlayback(activeRuntimePreview, state.model ?? {}, { forcePlayback: true });
      return true;
    };
    const discoverRuntimeChildren = () => {
      const videoReady = bindVideo() || Boolean(video);
      const canvasReady = fitVapRuntimeCanvas(mount);
      return videoReady && canvasReady;
    };
    if (typeof globalThis.ResizeObserver === "function") {
      resizeObserver = new globalThis.ResizeObserver(() => fitVapRuntimeCanvas(mount));
      resizeObserver.observe(mount);
    }
    if (!discoverRuntimeChildren()) {
      discoveryTimer = setInterval(() => {
        discoveryAttempts += 1;
        if (discoverRuntimeChildren() || discoveryAttempts >= 40) clearInterval(discoveryTimer);
      }, 25);
    }
    return () => {
      if (discoveryTimer) clearInterval(discoveryTimer);
      resizeObserver?.disconnect?.();
      ["loadedmetadata", "loadeddata", "canplay", "canplaythrough", "playing"].forEach((eventName) => {
        video?.removeEventListener?.(eventName, syncDesiredPlayback);
      });
    };
  }

  function fitVapRuntimeCanvas(mount) {
    const canvas = Array.from(mount?.querySelectorAll?.("canvas") ?? []).find((candidate) => {
      try {
        return Boolean(candidate.getContext?.("webgl") || candidate.getContext?.("experimental-webgl") || candidate.getContext?.("webgl2"));
      } catch {
        return false;
      }
    });
    if (!canvas) return false;
    const backingWidth = Math.max(1, Number(canvas.width) || 1);
    const backingHeight = Math.max(1, Number(canvas.height) || 1);
    const bounds = mount.getBoundingClientRect?.();
    const mountWidth = Math.max(1, Number(bounds?.width) || Number(mount.clientWidth) || backingWidth);
    const mountHeight = Math.max(1, Number(bounds?.height) || Number(mount.clientHeight) || backingHeight);
    const viewportWidths = [
      Number(globalThis.visualViewport?.width),
      Number(globalThis.document?.documentElement?.clientWidth),
      Number(globalThis.innerWidth)
    ].filter((value) => Number.isFinite(value) && value > 0);
    const viewportHeights = [
      Number(globalThis.visualViewport?.height),
      Number(globalThis.document?.documentElement?.clientHeight),
      Number(globalThis.innerHeight)
    ].filter((value) => Number.isFinite(value) && value > 0);
    const viewportWidth = viewportWidths.length > 0 ? Math.min(...viewportWidths) : 0;
    const viewportHeight = viewportHeights.length > 0 ? Math.min(...viewportHeights) : 0;
    const left = Number(bounds?.left) || 0;
    const top = Number(bounds?.top) || 0;
    const right = left + mountWidth;
    const bottom = top + mountHeight;
    const playbackBounds = mount.parentElement?.querySelector?.(".playbackBar")?.getBoundingClientRect?.();
    const playbackTop = Number(playbackBounds?.top);
    const visibleLeft = Math.max(left, 0);
    const visibleTop = Math.max(top, 0);
    const visibleRight = viewportWidth > 0 ? Math.min(right, viewportWidth) : right;
    let visibleBottom = viewportHeight > 0 ? Math.min(bottom, viewportHeight) : bottom;
    if (Number.isFinite(playbackTop) && playbackTop > visibleTop && playbackTop < visibleBottom) {
      visibleBottom = playbackTop;
    }
    const availableWidth = Math.max(1, Math.min(mountWidth, visibleRight - visibleLeft));
    const availableHeight = Math.max(1, Math.min(mountHeight, visibleBottom - visibleTop));
    mount.style.boxSizing = "border-box";
    mount.style.padding = `${Math.max(0, visibleTop - top)}px ${Math.max(0, right - visibleRight)}px ${Math.max(0, bottom - visibleBottom)}px ${Math.max(0, visibleLeft - left)}px`;
    const scale = Math.min(1, availableWidth / backingWidth, availableHeight / backingHeight);
    canvas.style.width = `${Math.max(1, Math.round(backingWidth * scale))}px`;
    canvas.style.height = `${Math.max(1, Math.round(backingHeight * scale))}px`;
    canvas.style.aspectRatio = `${backingWidth} / ${backingHeight}`;
    return true;
  }

  function runtimeReplacementSignature(model) {
    const replacement = model?.replacement ?? {};
    const active = Array.isArray(replacement.active)
      ? replacement.active.map((entry) => ({
          format: entry.format,
          kind: entry.kind,
          targetId: entry.targetId,
          valuePreview: entry.valuePreview
        }))
      : [];
    return JSON.stringify({
      revision: Number(replacement.revision) || 0,
      active
    });
  }

  function runtimePreviewReplacementPayload(replacement) {
    const runtimeValues = Array.from(runtimeReplacementValues.values());
    if (runtimeValues.length === 0) return replacement;
    return {
      ...(replacement ?? {}),
      runtimeValues
    };
  }

  function setRuntimeReplacementValue(kind, targetId, value) {
    if (!targetId || (kind !== "image" && kind !== "text")) return;
    runtimeReplacementValues.set(`${kind}:${targetId}`, {
      kind,
      targetId,
      value
    });
  }

  function setPublicRuntimeReplacementTarget(result, kind, fallbackPublicTargetId, runtimeTargetId) {
    if (kind !== "image" && kind !== "text") return;
    const lastAction = result?.model?.replacement?.lastAction;
    if (lastAction?.type !== "applyReplacement" || lastAction.status !== "accepted") return;
    const publicTargetId = typeof lastAction.publicTargetId === "string" && lastAction.publicTargetId.trim()
      ? lastAction.publicTargetId.trim()
      : String(fallbackPublicTargetId || "").trim();
    const acceptedRuntimeTargetId = typeof lastAction.runtimeTargetId === "string" && lastAction.runtimeTargetId.trim()
      ? lastAction.runtimeTargetId.trim()
      : String(runtimeTargetId || "").trim();
    if (!publicTargetId || !acceptedRuntimeTargetId || acceptedRuntimeTargetId !== String(runtimeTargetId || "").trim()) return;
    publicRuntimeReplacementTargets.set(`${kind}:${publicTargetId}`, {
      kind,
      publicTargetId,
      runtimeTargetId: acceptedRuntimeTargetId
    });
  }

  function clearRuntimeReplacementValues(kind, targetId) {
    if (kind !== "image" && kind !== "text") {
      runtimeReplacementValues = new Map();
      publicRuntimeReplacementTargets = new Map();
      return;
    }
    for (const [key, record] of runtimeReplacementValues.entries()) {
      if (record.kind === kind && (!targetId || record.targetId === targetId)) runtimeReplacementValues.delete(key);
    }
    for (const [key, record] of publicRuntimeReplacementTargets.entries()) {
      if (record.kind === kind && (!targetId || record.runtimeTargetId === targetId)) {
        publicRuntimeReplacementTargets.delete(key);
      }
    }
  }

  function invalidateRuntimeTextMutations() {
    runtimeTextMutationGeneration += 1;
    runtimeTextMutationIntents = new Map();
    runtimeTextMutationQueues = new Map();
    runtimeTextMutationMayHaveAuthority = new Set();
  }

  function replacementActionAccepted(result) {
    return result?.model?.replacement?.lastAction?.status === "accepted";
  }

  function acceptedRuntimeReplacementValue(result, kind) {
    if (!replacementActionAccepted(result)) return undefined;
    const runtimeValue = result?.replacementRuntimeValue;
    if (
      runtimeValue?.kind !== kind
      || typeof runtimeValue.targetId !== "string"
      || !runtimeValue.targetId.trim()
      || typeof runtimeValue.value !== "string"
      || !runtimeValue.value
    ) {
      return undefined;
    }
    return {
      kind,
      targetId: runtimeValue.targetId.trim(),
      value: runtimeValue.value
    };
  }

  function acceptedResetRuntimeTargetId(result) {
    if (!replacementActionAccepted(result)) return undefined;
    const lastAction = result?.model?.replacement?.lastAction;
    if (
      lastAction?.type !== "resetReplacement"
      || typeof lastAction.runtimeTargetId !== "string"
      || !lastAction.runtimeTargetId.trim()
    ) {
      return undefined;
    }
    return lastAction.runtimeTargetId.trim();
  }

  function loadRuntimeScript(src, runtimeName) {
    const allowedRuntimeScript = typeof src === "string"
      && (src.startsWith("/runtime-node-modules/") || src === "/vap-regenerator-runtime-global-shim.js");
    if (!allowedRuntimeScript) {
      return Promise.reject(new Error(`${runtimeName} runtime script is unavailable.`));
    }
    const existing = document.querySelector(`script[data-multiformat-runtime="${cssEscape(runtimeName)}"]`);
    if (existing?.dataset.loaded === "true") return Promise.resolve();
    if (existing) {
      return new Promise((resolve, reject) => {
        existing.addEventListener("load", resolve, { once: true });
        existing.addEventListener("error", reject, { once: true });
      });
    }
    return new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = src;
      script.async = true;
      script.dataset.multiformatRuntime = runtimeName;
      script.addEventListener("load", () => {
        script.dataset.loaded = "true";
        resolve();
      }, { once: true });
      script.addEventListener("error", () => reject(new Error(`${runtimeName} runtime script failed to load.`)), { once: true });
      document.head.append(script);
    });
  }

  async function loadVapRuntimeScript(src) {
    await loadRuntimeScript("/vap-regenerator-runtime-global-shim.js", "vap-regenerator-runtime-global");
    await loadRuntimeScript(src, "vap");
  }

  function renderPlaybackState(model) {
    const playback = model.canvas?.playback ?? {};
    const duration = playback.durationMs || 0;
    const current = Math.min(duration, playback.currentTimeMs || 0);
    const progress = duration > 0 ? Math.round((current / duration) * 100) : 0;
    nodes.playbackProgress?.setAttribute("aria-valuenow", String(progress));
    applyPlaybackProgress(progress);
    nodes.playbackTime.textContent = `${formatTime(current)} / ${formatTime(duration)}`;
    nodes.playbackMeta.textContent = playbackMeta(model);
    nodes.playbackMeta.dataset.status = playbackStatusId(model.status);
    nodes.playbackMeta.dataset.format = playbackFormatId(model.detectedFormat);
  }

  function renderCommandState() {
    if (svgaWorkflowActive()) {
      applyModeButtons(state.mode);
      return svgaController.handlers.renderCommandState?.();
    }
    const model = state.model;
    const commands = model?.commands ?? {};
    const hasFile = Boolean(model);
    const selectedText = Boolean(state.selectedTextKey);
    const menuState = {
      view: state.view,
      mode: state.mode,
      tab: state.tab,
      appearance: state.appearance,
      hasFile,
      hasOutput: false,
      outputKind: "",
      canOverwrite: false,
      canSaveAs: false,
      saveBusy: false,
      canCompare: false,
      canPlay: commands.play === true || commands.pause === true || commands.recover === true,
      canReplay: commands.seek === true || commands.recover === true,
      canLoop: commands.loop === true,
      loopEnabled: state.primaryPlaybackLooping !== false,
      canRenameImageKey: false,
      canReplaceImage: commands.replace === true && Boolean(state.selectedImageKey),
      canResetImageReplacement: commands.resetReplacement === true
        && multiFormatActiveReplacementForPublicTarget(model, "image", state.selectedImageKey, publicRuntimeReplacementTargets),
      canEditText: commands.replace === true && selectedText,
      canResetText: commands.resetReplacement === true
        && multiFormatActiveReplacementForPublicTarget(model, "text", state.selectedTextKey, publicRuntimeReplacementTargets),
      canRunOptimization: false,
      canShowOptimizationComparison: false,
      isRenaming: false,
      hasTransientState: false
    };
    applyCommandState({
      actionStates: {
        compare: { enabled: false, reason: "当前格式不支持对比" },
        "play-pause": { enabled: menuState.canPlay, reason: "请先打开文件" },
        replay: { enabled: menuState.canReplay, reason: "请先打开文件" },
        "loop-toggle": { enabled: menuState.canLoop, reason: "请先打开文件" },
        "run-optimization": { enabled: false, reason: "当前格式不支持优化" },
        "save-as": { enabled: false, reason: "当前格式不支持保存" },
        "save-overwrite": { enabled: false, reason: "当前格式不支持覆盖保存" },
        "edit-text": { enabled: menuState.canEditText, reason: "当前文件没有可预览文本" },
        "reset-text": { enabled: menuState.canResetText, reason: "当前没有运行时文本替换" }
      },
      headerSaveAsVisible: false,
      playPauseCopy: model?.status === "playing" ? "暂停" : "播放",
      loopEnabled: state.primaryPlaybackLooping !== false
    });
    applyModeButtons("preview", {
      previewEnabled: hasFile,
      editEnabled: false,
      editReason: "当前格式仅支持预览"
    });
    state.lastMenuStateSnapshot = syncShortTermMenuState(bridge, menuState, state.lastMenuStateSnapshot);
  }

  function clearSurfaces() {
    nodes.factGrid.replaceChildren();
    nodes.assetList.replaceChildren();
    nodes.findingList.replaceChildren();
    nodes.replaceableList.replaceChildren();
    nodes.textElementList.replaceChildren();
    nodes.replaceableSummary.textContent = "";
    if (nodes.assetListHeading) nodes.assetListHeading.textContent = "";
    if (nodes.assetFilterTabs) {
      nodes.assetFilterTabs.replaceChildren();
      nodes.assetFilterTabs.hidden = true;
      nodes.assetFilterTabs.dataset.presentation = "empty";
      nodes.assetFilterTabs.setAttribute("role", "tablist");
      nodes.assetFilterTabs.setAttribute("aria-label", "资产类型");
    }
    nodes.playbackTime.textContent = "0:00 / 0:00";
  }

  function openSettings() {
    openShortTermSettings({ nodes, state, renderCommandState });
  }

  function closeSettings() {
    closeShortTermSettings({ nodes, renderCommandState });
  }

  function setAppearance(appearance, options = {}) {
    applyShortTermAppearance({ nodes, state, appearance, persist: options.persist === true });
    renderCommandState();
  }

  function beginRequest() {
    activeRequest += 1;
    return activeRequest;
  }

  function isActiveRequest(request) {
    return activeRequest === request;
  }

  function selectDefaultTargets(model) {
    const rightPanel = projectMultiFormatRightPanel(model);
    const imageTarget = rightPanel.imageTargets?.[0]?.imageKey ?? "";
    const textTarget = rightPanel.textTargets?.[0]?.textKey ?? "";
    if (!state.selectedImageKey || !hasImageTarget(model, state.selectedImageKey)) state.selectedImageKey = imageTarget;
    if (!state.selectedTextKey || !hasTextTarget(model, state.selectedTextKey)) state.selectedTextKey = textTarget;
  }

  function showFailure(error) {
    clearRuntimePreview();
    renderFailureMessage(nodes, ownerFailureCopy(error));
    setView("failed");
  }

  function showRuntimePreviewFailure(error) {
    const failure = runtimePreviewFailure(error);
    clearRuntimePreview({ preserveGeneration: true });
    if (!state.model || svgaWorkflowActive()) {
      showFailure(failure);
      return;
    }
    state.model = runtimePreviewFailureModel(state.model);
    renderModel({ model: state.model, sourceId: state.sourceId });
    renderFailureMessage(nodes, ownerFailureCopy(failure));
    setView("preview");
  }

  function showOpenFailure(error) {
    revokeActiveDocumentAuthority();
    renderFailureMessage(nodes, ownerFailureCopy(error));
    setView("failed");
  }

  function revokeActiveDocumentAuthority(options = {}) {
    if (activeFormat === "svga") svgaController?.handlers?.deactivateForMultiFormat?.();
    activeFormat = "";
    invalidateRuntimeTextMutations();
    clearRuntimePreview();
    clearRuntimeReplacementValues();
    if (options.disposeHost !== false) {
      Promise.resolve(bridge?.controlMultiFormatPreview?.({ action: "dispose" })).catch(() => {});
    }
    state.sourceBytes = undefined;
    state.previewBytes = undefined;
    state.sourceId = "";
    state.displayName = "";
    state.model = undefined;
    state.selectedImageKey = "";
    state.selectedTextKey = "";
    state.assetFilter = "all";
    state.renameImageKey = "";
    state.textPreview = "";
    state.textPreviewValues = {};
    state.activeOutput = undefined;
    state.cleanSaveAsVisible = false;
    state.primaryPlayback = undefined;
    state.compareAPlayback = undefined;
    state.compareBPlayback = undefined;
    state.editPlayback = undefined;
    state.resourceMenuReturnFocus = undefined;
    state.mode = "preview";
    state.tab = "overview";
    state.lastMenuStateSnapshot = "";
    renderFileHeader(nodes, "", "");
    clearSurfaces();
  }

  function currentStateSummary() {
    if (svgaWorkflowActive()) return svgaController.handlers.currentStateSummary?.();
    return JSON.stringify({
      productMilestoneId: bridge?.productMilestoneId,
      status: state.model?.status ?? state.view,
      format: state.model?.detectedFormat,
      displayName: state.displayName,
      pathRedacted: true,
      supportClaim: false,
      saveExportSupported: false
    }, null, 2);
  }

  function refreshRuntimePreviewFrame() {
    if (activeRuntimePreview?.format !== "vap") return false;
    return drawVapRuntimeFrame(activeRuntimePreview);
  }

  function delegateSvga(handlerName, ...args) {
    if (!svgaWorkflowActive()) return undefined;
    return svgaController?.handlers?.[handlerName]?.(...args);
  }

  const enterGeneralCompare = (...args) => delegateSvga("enterGeneralCompare", ...args);
  const runOptimization = (...args) => delegateSvga("runOptimization", ...args);
  const saveActiveOutput = (...args) => delegateSvga("saveActiveOutput", ...args);
  const openCompareAFromHost = (...args) => delegateSvga("openCompareAFromHost", ...args);
  const openCompareBFromHost = (...args) => delegateSvga("openCompareBFromHost", ...args);
  const confirmInlineRename = (...args) => delegateSvga("confirmInlineRename", ...args);
  const cancelInlineRename = (...args) => delegateSvga("cancelInlineRename", ...args);
  const renameSelectedImageKey = (...args) => delegateSvga("renameSelectedImageKey", ...args);
  const openKeyboardResourceContextMenu = (...args) => delegateSvga("openKeyboardResourceContextMenu", ...args);
  const setAssetFilter = (...args) => delegateSvga("setAssetFilter", ...args);
  const handleTabListKeydown = (...args) => delegateSvga("handleTabListKeydown", ...args);
  const handleResourceContextMenuKeydown = (...args) => delegateSvga("handleResourceContextMenuKeydown", ...args);
  const clearTransientOutput = (...args) => delegateSvga("clearTransientOutput", ...args);
  const showOptimizationComparison = (...args) => delegateSvga("showOptimizationComparison", ...args);
  const createSaveProofOutput = (...args) => delegateSvga("createSaveProofOutput", ...args);
  const createSaveFailureProofOutput = (...args) => delegateSvga("createSaveFailureProofOutput", ...args);

  const handlers = {
    openFromHostDialog,
    beginHostFileOpen,
    completeHostFileOpen,
    failHostFileOpen,
    openRecentFromMenu,
    clearRecentFiles: (...args) => svgaController?.handlers?.clearRecentFiles?.(...args),
    closeFile,
    enterGeneralCompare,
    setMode,
    togglePrimaryPlayback,
    replayPrimary,
    togglePrimaryPlaybackLoop,
    runOptimization,
    saveActiveOutput,
    openCompareAFromHost,
    openCompareBFromHost,
    selectImageKey,
    openResourceContextMenu(event, imageKey, returnFocus) {
      if (svgaWorkflowActive()) {
        return svgaController?.handlers?.openResourceContextMenu?.(event, imageKey, returnFocus);
      }
      chooseReplacementImage(imageKey).catch(() => showFailure({ code: "replacement_preview_failed" }));
    },
    closeResourceContextMenu: (...args) => delegateSvga("closeResourceContextMenu", ...args),
    selectTextKey,
    confirmInlineRename,
    cancelInlineRename,
    renameSelectedImageKey,
    chooseReplacementImage,
    resetImageReplacement,
    editRuntimeText,
    updateRuntimeText,
    resetRuntimeText,
    openSettings,
    closeSettings,
    setAppearance,
    openKeyboardResourceContextMenu,
    setAssetFilter,
    setTab,
    openTab,
    handleTabListKeydown,
    handleResourceContextMenuKeydown,
    applyReplacementFile,
    loadDroppedFile,
    showCanvasDragDecision,
    hideCanvasDragDecision,
    dropCanvasFile,
    loadOpenedSource: (...args) => svgaController?.handlers?.loadOpenedSource?.(...args),
    clearTransientOutput,
    showFailure,
    showOptimizationComparison,
    createSaveProofOutput,
    createSaveFailureProofOutput,
    currentStateSummary,
    refreshRuntimePreviewFrame,
    renderCommandState
  };

  function initialize() {
    applyProductCopy();
    svgaController?.initialize?.();
    state.mode = "preview";
    state.tab = "overview";
    setAppearance(state.appearance);
    if (state.model) {
      setView(state.model.status === "failed" ? "failed" : "preview");
      return;
    }
    setView("launch");
  }

  return { handlers, initialize };
}

export async function resolveMultiFormatOpenOutcome(openPromise, options = {}) {
  const deadlineMs = Number.isFinite(Number(options.deadlineMs))
    ? Math.max(10, Math.trunc(Number(options.deadlineMs)))
    : MULTIFORMAT_RENDERER_OPEN_TERMINAL_DEADLINE_MS;
  let timeout;
  try {
    const result = await Promise.race([
      Promise.resolve(openPromise),
      new Promise((resolve) => {
        timeout = setTimeout(() => {
          resolve({
            kind: "failure",
            code: "open_timeout"
          });
        }, deadlineMs);
      })
    ]);
    return normalizeMultiFormatOpenOutcome(result);
  } catch {
    return ownerFailureOutcome("open_failed");
  } finally {
    clearTimeout(timeout);
  }
}

export async function resolveMultiFormatChooserOutcome(openPromise) {
  try {
    return normalizeMultiFormatOpenOutcome(await Promise.resolve(openPromise));
  } catch {
    return ownerFailureOutcome("file_picker_failed", { pathRedacted: true });
  }
}

export function normalizeMultiFormatOpenOutcome(result) {
  if (result?.kind === "failure") {
    return ownerFailureOutcome(trustedOwnerFailureCode(result), {
      pathRedacted: result?.pathRedacted === true
    });
  }
  if (result?.kind === "cancelled" || result?.kind === "model") return result;
  if (result?.status === "cancelled") return { kind: "cancelled" };
  const reviewedPickerFailureCode = result?.status === "failed" && result?.pathRedacted === true
    ? trustedOwnerFailureCode(result)
    : "";
  if (reviewedPickerFailureCode) {
    return ownerFailureOutcome(reviewedPickerFailureCode, { pathRedacted: true });
  }
  if (result?.status === "missing") {
    return ownerFailureOutcome("recent_file_missing");
  }
  if (result?.model) return { kind: "model", result };
  if (result?.status === "opened") {
    return ownerFailureOutcome("open_failed");
  }
  return ownerFailureOutcome("");
}

function applyProductCopy(documentRef = document) {
  documentRef.querySelector(".launchPrompt p")?.replaceChildren("拖拽 SVGA / Lottie JSON / VAP MP4 到此处");
  documentRef.querySelectorAll("[data-action='open'] span").forEach((node) => {
    node.textContent = "打开文件";
  });
  documentRef.querySelector("#previewStagePanel")?.setAttribute("aria-label", "多格式预览");
  documentRef.querySelector("#primaryCanvas")?.setAttribute("aria-label", "多格式预览画布");
}

async function fileToDataUri(file) {
  const bytes = new Uint8Array(await file.arrayBuffer());
  const binary = Array.from(bytes, (byte) => String.fromCharCode(byte)).join("");
  const base64 = btoa(binary);
  return `data:${file.type || "application/octet-stream"};base64,${base64}`;
}

function playbackMeta(model) {
  const format = playbackFormatCopy(model.detectedFormat);
  const dimensions = model.canvas?.dimensions || "unknown";
  const duration = formatTime(model.canvas?.playback?.durationMs || 0);
  return `${format} · ${dimensions} · ${duration} · ${statusCopy(model.status)}`;
}

function issueSummary(model) {
  const rightPanel = projectMultiFormatRightPanel(model);
  const issue = rightPanel.issues?.[0];
  if (issue?.code === "missing_resource") return "预览所需资源缺失，源文件没有被修改。";
  if (issue?.code === "unsupported_feature" || rightPanel.unsupportedFeatures?.length) {
    return "当前文件包含暂不支持的内容，无法完整预览。";
  }
  return issue ? "文件未能解析，源文件没有被修改。" : "";
}

function ownerFailureCopy(failure) {
  const code = trustedOwnerFailureCode(failure);
  return code ? reviewedOwnerFailureCopyByCode[code] : genericOwnerFailureCopy;
}

function ownerFailureOutcome(code, options = {}) {
  const trustedCode = trustedOwnerFailureCode({ code });
  return {
    kind: "failure",
    ...(trustedCode ? { code: trustedCode } : {}),
    message: trustedCode ? reviewedOwnerFailureCopyByCode[trustedCode] : genericOwnerFailureCopy,
    ...(options.pathRedacted === true && trustedCode ? { pathRedacted: true } : {})
  };
}

function trustedOwnerFailureCode(failure) {
  if (!failure || typeof failure !== "object" || Array.isArray(failure)) return "";
  try {
    const prototype = Object.getPrototypeOf(failure);
    if (prototype !== Object.prototype && prototype !== null) return "";
    const descriptor = Object.getOwnPropertyDescriptor(failure, "code");
    const code = descriptor && "value" in descriptor && typeof descriptor.value === "string"
      ? descriptor.value
      : "";
    return Object.hasOwn(reviewedOwnerFailureCopyByCode, code) ? code : "";
  } catch {
    return "";
  }
}

const playbackStatusCopyById = Object.freeze({
  launch: "待打开",
  loading: "加载中",
  previewReady: "已就绪",
  playing: "播放中",
  paused: "已暂停",
  playbackBlocked: "播放受限",
  playbackFailed: "播放失败",
  failed: "加载失败",
  disposed: "已关闭"
});

const playbackFormatCopyById = Object.freeze({
  svga: "SVGA",
  lottie: "LOTTIE",
  vap: "VAP"
});

function playbackStatusId(status) {
  return typeof status === "string" && Object.hasOwn(playbackStatusCopyById, status)
    ? status
    : "unknown";
}

function playbackFormatId(format) {
  const id = typeof format === "string" ? format.toLowerCase() : "";
  return Object.hasOwn(playbackFormatCopyById, id) ? id : "unknown";
}

function playbackFormatCopy(format) {
  return playbackFormatCopyById[playbackFormatId(format)] ?? "0.2";
}

function statusCopy(status) {
  return playbackStatusCopyById[playbackStatusId(status)] ?? "未知";
}

function formatTime(timeMs) {
  const seconds = Math.max(0, Math.round((Number(timeMs) || 0) / 1000));
  const minutes = Math.floor(seconds / 60);
  return `${minutes}:${String(seconds % 60).padStart(2, "0")}`;
}

function hasImageTarget(model, targetId) {
  return (projectMultiFormatRightPanel(model).imageTargets ?? []).some((target) =>
    target.imageKey === targetId || target.resourceId === targetId
  );
}

function hasTextTarget(model, targetId) {
  return (projectMultiFormatRightPanel(model).textTargets ?? []).some((target) =>
    target.textKey === targetId
  );
}

export function multiFormatActiveReplacementForPublicTarget(model, kind, publicTargetId, publicRuntimeReplacementTargets = new Map()) {
  return Boolean(multiFormatActiveReplacementEntryForPublicTarget(
    model,
    kind,
    publicTargetId,
    publicRuntimeReplacementTargets
  ));
}

export function multiFormatActiveReplacementEntryForPublicTarget(model, kind, publicTargetId, publicRuntimeReplacementTargets = new Map()) {
  if (!publicTargetId || (kind !== "image" && kind !== "text")) return undefined;
  const acceptedBinding = publicRuntimeReplacementTargets?.get?.(`${kind}:${publicTargetId}`);
  const runtimeTargetId = acceptedBinding?.runtimeTargetId || publicTargetId;
  return (model?.replacement?.active ?? []).find((entry) =>
    entry?.format === model?.detectedFormat
    && entry?.kind === kind
    && (entry?.targetId === runtimeTargetId || entry?.targetId === publicTargetId)
  );
}

class RuntimePreviewPayloadError extends Error {
  constructor(issue) {
    super("无法准备本地预览，源文件没有被修改。");
    this.name = "RuntimePreviewPayloadError";
    this.issue = issue;
  }
}

function runtimePreviewFailure(error) {
  if (error instanceof RuntimePreviewPayloadError) {
    const issueCode = trustedOwnerFailureCode(error.issue);
    if ([
      "missing_resource",
      "unsupported_feature",
      "parse_precondition",
      "asset_reference_precondition",
      "playback_failure"
    ].includes(issueCode)) {
      return { code: issueCode };
    }
  }
  return { code: "runtime_preview_failed" };
}

function runtimePreviewFailureModel(model) {
  const commands = model?.commands ?? {};
  return {
    ...model,
    status: "playbackFailed",
    commands: {
      ...commands,
      play: false,
      pause: false,
      recover: true,
      seek: commands.seek === true,
      loop: commands.loop === true,
      replace: commands.replace === true,
      resetReplacement: commands.resetReplacement === true,
      save: false,
      export: false
    },
    canvas: {
      ...(model?.canvas ?? {}),
      status: "playbackFailed",
      playback: {
        ...(model?.canvas?.playback ?? {}),
        status: "error"
      }
    }
  };
}

function base64ToBytes(value) {
  const binary = atob(String(value || ""));
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

function lottieFrameFromPlayback(model, payload) {
  const fps = Number(payload?.playback?.fps) || Number(payload?.animationData?.fr) || 30;
  const currentTimeMs = Math.max(0, Number(model?.canvas?.playback?.currentTimeMs) || 0);
  return Math.max(0, Math.round((currentTimeMs / 1000) * fps));
}

function cssEscape(value) {
  if (globalThis.CSS?.escape) return CSS.escape(value);
  return String(value).replace(/["\\]/g, "\\$&");
}
