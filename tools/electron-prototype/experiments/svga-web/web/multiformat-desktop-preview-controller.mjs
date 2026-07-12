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
import { escapeHtml } from "./short-term-macos-render-model.mjs";

const supportedDropPattern = /\.(svga|json|mp4)$/i;
export const MULTIFORMAT_RENDERER_OPEN_TERMINAL_DEADLINE_MS = 15_000;
const factLabels = new Map([
  ["Format", "格式"],
  ["Canvas", "画布"],
  ["Duration", "时长"],
  ["Layers", "图层"],
  ["Assets", "资源"],
  ["Replaceable", "可替换"],
  ["Inventory", "资产清单"],
  ["Media", "媒体"],
  ["Maturity", "阶段"],
  ["Video codec", "视频编码"],
  ["Audio", "音频"],
  ["Unsupported", "不支持特性"]
]);

export function createMultiFormatDesktopPreviewController({ bridge, nodes, state }) {
  let activeRequest = 0;
  let runtimePreviewGeneration = 0;
  let activeRuntimePreview;
  let hostFileOpenEventId = "";
  let hostFileOpenRequest = 0;

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
    state.mode = "preview";
    applyModeButtons("preview");
    if (mode === "edit") {
      showShortTermCanvasToast(nodes, "0.2 预览候选暂不开放持久编辑。");
    }
    if (state.model) setView("preview");
  }

  async function openFromHostDialog() {
    const request = beginRequest();
    setLoading("选择并读取本地预览候选。");
    const outcome = await resolveMultiFormatOpenOutcome(
      Promise.resolve().then(() => bridge.openMultiFormatFile()),
      { deadlineMs: MULTIFORMAT_RENDERER_OPEN_TERMINAL_DEADLINE_MS }
    );
    if (!isActiveRequest(request)) return;
    applyOpenOutcome(outcome);
  }

  async function loadDroppedFile(file) {
    const request = beginRequest();
    setLoading("读取拖拽的本地预览候选。");
    const bytes = new Uint8Array(await file.arrayBuffer());
    const outcome = await resolveMultiFormatOpenOutcome(
      Promise.resolve().then(() => bridge.openDroppedMultiFormatFile({
        displayName: file.name || "dropped-motion-asset",
        mediaType: file.type || "",
        bytes: Array.from(bytes)
      })),
      { deadlineMs: MULTIFORMAT_RENDERER_OPEN_TERMINAL_DEADLINE_MS }
    );
    if (!isActiveRequest(request)) return;
    applyOpenOutcome(outcome);
  }

  function beginHostFileOpen(payload = {}) {
    if (typeof payload?.eventId !== "string" || payload.eventId.length === 0) return false;
    hostFileOpenEventId = payload.eventId;
    hostFileOpenRequest = beginRequest();
    setLoading("读取系统打开的本地预览候选。");
    return true;
  }

  async function completeHostFileOpen(payload = {}) {
    if (!hostFileOpenIsActive(payload)) return false;
    const outcome = await resolveMultiFormatOpenOutcome(Promise.resolve(payload?.result), {
      deadlineMs: MULTIFORMAT_RENDERER_OPEN_TERMINAL_DEADLINE_MS
    });
    if (!hostFileOpenIsActive(payload)) return false;
    clearHostFileOpenRequest();
    applyOpenOutcome(outcome);
    return true;
  }

  function failHostFileOpen(payload = {}) {
    if (!hostFileOpenIsActive(payload)) return false;
    clearHostFileOpenRequest();
    showFailure(typeof payload.message === "string" && payload.message.length > 0
      ? payload.message
      : "0.2 预览主机未能打开系统传入的本地候选，源文件没有被修改。");
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

  async function dropCanvasFile(event, target, overlay) {
    const decision = showCanvasDragDecision(event, target, overlay);
    hideCanvasDragDecision();
    if (!decision.file) return;
    if (!decision.supported) {
      showShortTermCanvasToast(nodes, "不支持的文件格式");
      renderCommandState();
      return;
    }
    await loadDroppedFile(decision.file);
  }

  function showCanvasDragDecision(event, target, overlay) {
    const file = event.dataTransfer?.files?.[0];
    const decision = {
      file,
      focusZone: "open",
      supported: !file || supportedDropPattern.test(file.name || "")
    };
    showShortTermDragDecisionOverlay(overlay, decision);
    return decision;
  }

  function hideCanvasDragDecision() {
    hideShortTermDragDecisionOverlays(nodes);
  }

  async function closeFile() {
    activeRequest += 1;
    clearRuntimePreview();
    await bridge.controlMultiFormatPreview({ action: "dispose" }).catch(() => {});
    state.model = undefined;
    state.sourceId = "";
    state.displayName = "";
    state.selectedImageKey = "";
    state.selectedTextKey = "";
    state.textPreviewValues = {};
    clearSurfaces();
    setView("launch");
  }

  async function control(action, input = {}) {
    if (!state.model) return;
    const result = await bridge.controlMultiFormatPreview({ action, ...input });
    applyHostResult(result, { keepView: true });
  }

  async function togglePrimaryPlayback() {
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
    const status = state.model?.status;
    if (status === "playbackBlocked" || status === "playbackFailed") {
      await control("recover");
      return;
    }
    await control("seek", { timeMs: 0 });
    await control("play");
  }

  async function togglePrimaryPlaybackLoop() {
    state.primaryPlaybackLooping = state.primaryPlaybackLooping === false;
    await control("loop", { loop: state.primaryPlaybackLooping });
  }

  function setTab(tab, options = {}) {
    state.tab = tab === "replaceable" ? "replaceable" : "overview";
    applyTabState(state.tab, options);
    renderCommandState();
  }

  function openTab(tab) {
    setTab(tab, { focus: true, scroll: true });
  }

  function selectImageKey(imageKey) {
    if (!imageKey) return;
    state.selectedImageKey = imageKey;
    renderReplaceableTargets();
    renderCommandState();
  }

  function selectTextKey(textKey) {
    if (!textKey) return;
    state.selectedTextKey = textKey;
    renderTextTargets();
    renderCommandState();
  }

  function chooseReplacementImage(imageKey = state.selectedImageKey) {
    if (!imageKey) return;
    state.selectedImageKey = imageKey;
    nodes.replacementFileInput.value = "";
    nodes.replacementFileInput.click();
  }

  async function applyReplacementFile(file) {
    if (!file || !state.selectedImageKey) return;
    const dataUri = await fileToDataUri(file);
    const result = await bridge.applyMultiFormatReplacement({
      targetId: state.selectedImageKey,
      kind: "image",
      value: dataUri
    });
    applyHostResult(result, { keepView: true });
  }

  async function resetImageReplacement() {
    const result = await bridge.resetMultiFormatReplacement({ kind: "image" });
    applyHostResult(result, { keepView: true });
  }

  function editRuntimeText() {
    const input = nodes.textElementList.querySelector(`[data-text-input][data-text-key="${cssEscape(state.selectedTextKey)}"]`);
    input?.focus();
    input?.select?.();
  }

  function updateRuntimeText(textKey, value) {
    if (!textKey) return;
    state.selectedTextKey = textKey;
    state.textPreviewValues[textKey] = value;
    bridge.applyMultiFormatReplacement({
      targetId: textKey,
      kind: "text",
      value
    }).then((result) => {
      applyHostResult(result, { keepView: true });
    }).catch(showFailure);
  }

  async function resetRuntimeText() {
    const result = await bridge.resetMultiFormatReplacement({ kind: "text" });
    state.textPreviewValues = {};
    applyHostResult(result, { keepView: true });
  }

  function applyHostResult(result, options = {}) {
    if (!result?.model) {
      showFailure("0.2 预览主机没有返回可见的终态结果，源文件没有被修改。");
      return;
    }
    const model = result.model;
    state.model = model;
    state.sourceId = result.sourceId || state.sourceId || "";
    state.displayName = model.displayName || state.displayName || "";
    selectDefaultTargets(model);
    renderModel(result);
    if (options.keepView && state.view === "preview") {
      renderCommandState();
      return;
    }
    setView(model.status === "failed" ? "failed" : "preview");
  }

  function setLoading(copy) {
    state.model = undefined;
    clearRuntimePreview();
    renderLoadingMessage(nodes, copy);
    clearSurfaces();
    setView("loading");
  }

  function applyOpenOutcome(outcome) {
    if (outcome.kind === "cancelled") {
      if (!state.model) setView("launch");
      return;
    }
    if (outcome.kind === "failure") {
      showFailure(outcome.message);
      return;
    }
    applyHostResult(outcome.result);
  }

  function renderModel(result) {
    const model = result.model;
    renderFileHeader(nodes, model.displayName || "预览候选", playbackMeta(model));
    renderFacts(model);
    renderAssets(model);
    renderIssues(model);
    renderReplaceableTargets();
    renderTextTargets();
    renderCanvasState(model, result.visualEvidence);
    mountRuntimePreview(result);
    renderPlaybackState(model);
    if (model.status === "failed") {
      renderFailureMessage(nodes, issueSummary(model) || "文件未能解析，源文件没有被修改。");
    }
  }

  function renderFacts(model) {
    const facts = (model.rightPanel?.facts ?? []).map((fact) => ({
      ...fact,
      label: factLabels.get(fact.label) ?? fact.label
    }));
    nodes.factGrid.replaceChildren(...facts.map(createOverviewFactCell));
  }

  function renderAssets(model) {
    const inventory = model.rightPanel?.assetInventory;
    if (inventory?.groups?.length) {
      const groups = inventory.groups.filter((group) => group.items?.length > 0);
      if (nodes.assetListHeading) {
        nodes.assetListHeading.textContent = `资产清单 (${inventory.summary.totalItems})`;
      }
      nodes.assetFilterTabs?.setAttribute("role", "list");
      nodes.assetFilterTabs?.setAttribute("aria-label", "资产清单摘要");
      nodes.assetFilterTabs?.replaceChildren(
        createInventorySummaryChip("图片", inventory.summary.imageCount),
        createInventorySummaryChip("文本", inventory.summary.textCount),
        createInventorySummaryChip("序列", inventory.summary.sequenceFrameCount),
        createInventorySummaryChip("媒体", inventory.summary.audioVideoCount),
        createInventorySummaryChip("问题", inventory.summary.unsupportedOrMissingCount)
      );
      nodes.assetList.replaceChildren(...groups.map(createAssetGroup));
      return;
    }

    const assets = model.rightPanel?.assets ?? [];
    if (nodes.assetListHeading) nodes.assetListHeading.textContent = `资产列表 (${assets.length})`;
    nodes.assetFilterTabs?.setAttribute("role", "tablist");
    nodes.assetFilterTabs?.setAttribute("aria-label", "资产类型");
    nodes.assetFilterTabs?.replaceChildren();
    nodes.assetList.replaceChildren(...assets.map((asset) => {
      const row = document.createElement("article");
      row.className = "assetRow";
      row.dataset.component = "AssetRow";
      row.dataset.kind = asset.kind || "unknown";
      const detail = [asset.dimensions, asset.sizeBytes ? `${asset.sizeBytes} B` : "", asset.resolutionStatus].filter(Boolean).join(" · ") || "metadata";
      row.innerHTML = `
        <span class="thumb">${escapeHtml((asset.kind || "?").slice(0, 1).toUpperCase())}</span>
        <span class="rowText"><strong>${escapeHtml(asset.name || asset.id)}</strong><span>${escapeHtml(detail)}</span></span>
        ${asset.replaceable ? `<span class="badge">可替换</span>` : ""}
      `;
      return row;
    }));
  }

  function createInventorySummaryChip(label, count) {
    const chip = document.createElement("span");
    chip.className = "badge";
    chip.dataset.component = "AssetInventorySummaryChip";
    chip.dataset.count = String(count);
    chip.textContent = `${label} ${count}`;
    return chip;
  }

  function createAssetGroup(group) {
    const section = document.createElement("section");
    section.className = "assetGroup";
    section.dataset.component = "AssetInventoryGroup";
    section.dataset.group = group.id;
    section.dataset.status = group.status;

    const heading = document.createElement("header");
    heading.className = "assetGroupHeader";
    heading.innerHTML = `
      <span class="rowText"><strong>${escapeHtml(group.label)}</strong><span>${escapeHtml(groupStatusCopy(group))}</span></span>
      <span class="badge">${escapeHtml(String(group.count))}</span>
    `;

    const list = document.createElement("div");
    list.className = "assetGroupList";
    list.replaceChildren(...group.items.map(createInventoryItemRow));
    section.replaceChildren(heading, list);
    return section;
  }

  function createInventoryItemRow(item) {
    const row = document.createElement("article");
    row.className = "assetRow";
    row.dataset.component = "AssetInventoryItem";
    row.dataset.group = item.groupId;
    row.dataset.kind = item.kind || "unknown";
    row.dataset.source = item.source;
    row.dataset.status = item.status;
    row.dataset.replaceable = item.replaceable ? "true" : "false";
    if (item.runtimeTargetId) row.dataset.runtimeTargetId = item.runtimeTargetId;
    const detail = item.detail?.length ? item.detail.join(" · ") : assetStatusCopy(item.status);
    row.innerHTML = `
      <span class="thumb">${escapeHtml((item.kind || "?").slice(0, 1).toUpperCase())}</span>
      <span class="rowText"><strong>${escapeHtml(item.label || item.id)}</strong><span>${escapeHtml(detail)}</span></span>
      ${item.replaceable ? `<span class="badge">可替换</span>` : `<span class="badge">${escapeHtml(assetStatusCopy(item.status))}</span>`}
    `;
    return row;
  }

  function groupStatusCopy(group) {
    const replaceable = group.replaceableCount > 0 ? `${group.replaceableCount} 可替换` : "无运行时替换";
    if (group.status === "not_applicable") return "当前格式不适用";
    if (group.status === "blocked") return `${replaceable} · 存在缺失或阻断`;
    if (group.status === "warning") return `${replaceable} · 存在不支持项`;
    if (group.status === "empty") return "无条目";
    return replaceable;
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

  function renderIssues(model) {
    const issues = [
      ...(model.rightPanel?.issues ?? []),
      ...(model.rightPanel?.unsupportedFeatures ?? []).map((entry) => ({
        code: "unsupported_feature",
        severity: "warning",
        message: `${entry.feature} · ${entry.path}`
      }))
    ];
    nodes.findingList.replaceChildren(...issues.map((issue) => {
      const row = document.createElement("article");
      row.className = "findingRow";
      row.dataset.severity = issue.severity || "warning";
      row.innerHTML = `<strong>${escapeHtml(issue.code || "issue")}</strong><span>${escapeHtml(issue.message || "")}</span>`;
      return row;
    }));
  }

  function renderReplaceableTargets() {
    const model = state.model;
    const assets = model?.rightPanel?.assets?.filter((asset) => asset.replaceable) ?? [];
    const fusionImages = model?.rightPanel?.vapFusionImages ?? [];
    const targets = [
      ...assets.map((asset) => ({
        id: asset.id,
        name: asset.name || asset.id,
        detail: [model.detectedFormat?.toUpperCase(), asset.kind, asset.dimensions].filter(Boolean).join(" · ")
      })),
      ...fusionImages.filter((entry) => entry.replaceable).map((entry) => ({
        id: entry.srcTag || entry.runtimeBindingKey || entry.id,
        name: entry.srcTag || entry.id,
        detail: ["VAP fusion image", entry.dimensions ? `${entry.dimensions.width} x ${entry.dimensions.height}` : ""].filter(Boolean).join(" · ")
      }))
    ];
    nodes.replaceableSummary.textContent = targets.length
      ? `${targets.length} 个运行时图片替换候选`
      : "当前候选没有可替换图片。";
    nodes.replaceableList.replaceChildren(...targets.map((target) => {
      const selected = state.selectedImageKey === target.id;
      const row = document.createElement("article");
      row.className = "replaceableRow";
      row.dataset.imageKey = target.id;
      row.dataset.action = "select-resource";
      row.tabIndex = 0;
      row.setAttribute("aria-selected", selected ? "true" : "false");
      row.classList.toggle("isSelected", selected);
      row.innerHTML = `
        <span class="rowText"><strong>${escapeHtml(target.name)}</strong><span>${escapeHtml(target.detail)}</span></span>
        <button type="button" data-action="row-menu" data-image-key="${escapeHtml(target.id)}" aria-label="打开资源菜单">...</button>
      `;
      return row;
    }));
  }

  function renderTextTargets() {
    const lottieTexts = state.model?.rightPanel?.lottieTexts ?? [];
    const vapTexts = state.model?.rightPanel?.vapFusionTexts ?? [];
    const targets = [
      ...lottieTexts.filter((entry) => entry.replaceable).map((entry) => ({
        id: entry.id,
        name: entry.name || entry.layerId || entry.id,
        value: entry.initialText || "",
        detail: "Lottie text"
      })),
      ...vapTexts.filter((entry) => entry.replaceable).map((entry) => ({
        id: entry.srcTag || entry.runtimeBindingKey || entry.id,
        name: entry.srcTag || entry.id,
        value: "",
        detail: "VAP fusion text"
      }))
    ];
    nodes.textElementList.replaceChildren(...targets.map((target) => {
      const selected = state.selectedTextKey === target.id;
      const row = document.createElement("article");
      row.className = "textElementRow";
      row.dataset.textKey = target.id;
      row.dataset.action = "select-text";
      row.tabIndex = 0;
      row.setAttribute("aria-selected", selected ? "true" : "false");
      row.classList.toggle("isSelected", selected);
      row.innerHTML = `
        <span class="rowText"><strong>${escapeHtml(target.name)}</strong><span>${escapeHtml(target.detail)}</span></span>
        <input data-text-input data-text-key="${escapeHtml(target.id)}" value="${escapeHtml(state.textPreviewValues[target.id] ?? target.value)}" aria-label="${escapeHtml(target.name)}">
        <button type="button" data-action="runtime-text-reset" data-text-key="${escapeHtml(target.id)}">重置</button>
      `;
      return row;
    }));
  }

  function renderCanvasState(model, visualEvidence) {
    const canvas = nodes.primaryCanvas;
    const context = canvas?.getContext?.("2d");
    if (!canvas || !context) return;
    const rect = canvas.getBoundingClientRect?.();
    const width = Math.max(320, Math.round(rect?.width || canvas.width || 640));
    const height = Math.max(240, Math.round(rect?.height || canvas.height || 420));
    canvas.width = width;
    canvas.height = height;
    context.clearRect(0, 0, width, height);
    context.fillStyle = "#f6f7f8";
    context.fillRect(0, 0, width, height);
    context.strokeStyle = "#d7dce2";
    context.strokeRect(0.5, 0.5, width - 1, height - 1);
    context.fillStyle = "#1f2937";
    context.font = "600 18px system-ui, sans-serif";
    context.textAlign = "center";
    context.fillText(`${(model.detectedFormat || "motion").toUpperCase()} · ${statusCopy(model.status)}`, width / 2, height / 2 - 12);
    context.font = "13px system-ui, sans-serif";
    context.fillStyle = "#64748b";
    context.fillText(visualEvidence?.vapVisualPlaybackVerified || visualEvidence?.lottieDomPlaybackVerified ? "visual verified" : "source-side preview contract", width / 2, height / 2 + 16);
  }

  function mountRuntimePreview(result) {
    const model = result?.model;
    const format = model?.detectedFormat;
    const sourceId = result?.sourceId || state.sourceId;
    const mountable = (format === "lottie" || format === "vap")
      && sourceId
      && ["previewReady", "playing", "paused"].includes(model.status);
    if (!mountable || !bridge?.prepareMultiFormatRuntimePreview) {
      clearRuntimePreview();
      return;
    }

    const generation = beginRuntimePreviewGeneration();
    const mount = ensureRuntimeMount();
    mount.hidden = false;
    mount.dataset.runtimePreviewState = "preparing";
    mount.dataset.runtimeFormat = format;
    if (nodes.primaryCanvas) nodes.primaryCanvas.style.visibility = "hidden";
    bridge.prepareMultiFormatRuntimePreview({
      sourceId,
      format,
      requestId: model.requestId,
      replacements: model.replacement
    }).then(async (payload) => {
      if (!isActiveRuntimePreviewGeneration(generation)) return;
      if (payload?.status !== "prepared") {
        throw new RuntimePreviewPayloadError(payload?.issue);
      }
      if (format === "lottie") {
        await mountLottieRuntimePreview(payload, mount, model, generation);
      } else {
        await mountVapRuntimePreview(payload, mount, model, generation);
      }
    }).catch((error) => {
      if (!isActiveRuntimePreviewGeneration(generation)) return;
      clearRuntimePreview({ preserveGeneration: true });
      showFailure(runtimePreviewErrorCopy(error));
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
    const active = activeRuntimePreview;
    activeRuntimePreview = undefined;
    try {
      active?.animation?.destroy?.();
    } catch {}
    try {
      active?.player?.destroy?.();
    } catch {}
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
    }
    if (nodes.primaryCanvas) nodes.primaryCanvas.style.visibility = "";
  }

  function ensureRuntimeMount() {
    const existing = runtimeMountNode();
    if (existing) return existing;
    const mount = document.createElement("div");
    mount.id = "multiFormatRuntimeMount";
    mount.className = "multiFormatRuntimeMount";
    mount.dataset.component = "MultiFormatRuntimeMount";
    mount.dataset.runtimePreviewState = "idle";
    mount.hidden = true;
    nodes.primaryCanvas?.parentElement?.append(mount);
    return mount;
  }

  function runtimeMountNode() {
    return nodes.primaryCanvas?.parentElement?.querySelector("#multiFormatRuntimeMount");
  }

  async function mountLottieRuntimePreview(payload, mount, model, generation) {
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
      animationData: payload.animationData
    });
    activeRuntimePreview = { format: "lottie", animation };
    const frame = lottieFrameFromPlayback(model, payload);
    if (model.status === "paused" || model.status === "previewReady") animation.goToAndStop?.(frame, true);
    if (model.status === "playing") animation.play?.();
    mount.dataset.runtimePreviewState = "loaded";
    mount.dataset.runtimeFormat = "lottie";
  }

  async function mountVapRuntimePreview(payload, mount, model, generation) {
    await loadRuntimeScript(payload.runtimeScripts?.[0], "vap");
    if (!isActiveRuntimePreviewGeneration(generation)) return;
    const vapModule = globalThis.Vap;
    const VapConstructor = typeof vapModule?.default === "function" ? vapModule.default : typeof vapModule === "function" ? vapModule : undefined;
    if (!VapConstructor) throw new Error("The approved VAP runtime did not expose a constructor.");
    if (typeof vapModule?.canWebGL === "function" && vapModule.canWebGL() !== true) {
      throw new Error("The current renderer cannot create a WebGL VAP preview.");
    }
    mount.replaceChildren();
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
        clearRuntimePreview({ preserveGeneration: true });
        showFailure(runtimePreviewErrorCopy(new RuntimePreviewPayloadError({
          code: "playback_failure",
          message: "VAP runtime preview reached a typed playback failure.",
          details: { reason: "vap_runtime_load_error", cause: error ? "redacted runtime error" : undefined }
        })));
      }
    });
    activeRuntimePreview = { format: "vap", player, objectUrl };
    const currentTimeMs = Number(model.canvas?.playback?.currentTimeMs) || 0;
    if (currentTimeMs > 0) player.setTime?.(currentTimeMs / 1000);
    if (model.status === "paused" || model.status === "previewReady") player.pause?.();
    if (model.status === "playing") player.play?.();
    mount.dataset.runtimePreviewState = "loaded";
    mount.dataset.runtimeFormat = "vap";
  }

  function loadRuntimeScript(src, runtimeName) {
    if (!src || typeof src !== "string" || !src.startsWith("/runtime-node-modules/")) {
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

  function renderPlaybackState(model) {
    const playback = model.canvas?.playback ?? {};
    const duration = playback.durationMs || 0;
    const current = Math.min(duration, playback.currentTimeMs || 0);
    const progress = duration > 0 ? Math.round((current / duration) * 100) : 0;
    nodes.playbackProgress?.setAttribute("aria-valuenow", String(progress));
    const bar = nodes.playbackProgress?.querySelector("span");
    if (bar) bar.style.width = `${progress}%`;
    nodes.playbackTime.textContent = `${formatTime(current)} / ${formatTime(duration)}`;
    nodes.playbackMeta.textContent = playbackMeta(model);
  }

  function renderCommandState() {
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
      canResetImageReplacement: commands.resetReplacement === true,
      canEditText: commands.replace === true && selectedText,
      canResetText: commands.resetReplacement === true,
      canRunOptimization: false,
      canShowOptimizationComparison: false,
      isRenaming: false,
      hasTransientState: false
    };
    applyCommandState({
      actionStates: {
        compare: { enabled: false, reason: "0.2 预览候选暂不开放对比" },
        "play-pause": { enabled: menuState.canPlay, reason: "请先打开预览候选" },
        replay: { enabled: menuState.canReplay, reason: "请先打开预览候选" },
        "loop-toggle": { enabled: menuState.canLoop, reason: "请先打开预览候选" },
        "run-optimization": { enabled: false, reason: "0.2 预览候选暂不开放优化" },
        "save-as": { enabled: false, reason: "0.2 预览候选不支持保存" },
        "save-overwrite": { enabled: false, reason: "0.2 预览候选不支持覆盖保存" },
        "edit-text": { enabled: menuState.canEditText, reason: "当前候选没有可预览文本" },
        "reset-text": { enabled: menuState.canResetText, reason: "当前没有运行时文本替换" }
      },
      headerSaveAsVisible: false,
      playPauseCopy: model?.status === "playing" ? "暂停" : "播放",
      loopEnabled: state.primaryPlaybackLooping !== false
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
    const imageTarget = model.rightPanel?.assets?.find((asset) => asset.replaceable)?.id
      ?? model.rightPanel?.vapFusionImages?.find((entry) => entry.replaceable)?.srcTag
      ?? model.rightPanel?.vapFusionImages?.find((entry) => entry.replaceable)?.runtimeBindingKey
      ?? "";
    const textTarget = model.rightPanel?.lottieTexts?.find((entry) => entry.replaceable)?.id
      ?? model.rightPanel?.vapFusionTexts?.find((entry) => entry.replaceable)?.srcTag
      ?? model.rightPanel?.vapFusionTexts?.find((entry) => entry.replaceable)?.runtimeBindingKey
      ?? "";
    if (!state.selectedImageKey || !hasImageTarget(model, state.selectedImageKey)) state.selectedImageKey = imageTarget;
    if (!state.selectedTextKey || !hasTextTarget(model, state.selectedTextKey)) state.selectedTextKey = textTarget;
  }

  function showFailure(error) {
    clearRuntimePreview();
    renderFailureMessage(nodes, error instanceof Error ? error.message : String(error));
    setView("failed");
  }

  function currentStateSummary() {
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

  const unsupportedAsync = async () => {};
  const unsupportedSync = () => {};
  const handlers = {
    openFromHostDialog,
    beginHostFileOpen,
    completeHostFileOpen,
    failHostFileOpen,
    openRecentFromMenu: unsupportedAsync,
    clearRecentFiles: unsupportedAsync,
    closeFile,
    enterGeneralCompare: unsupportedAsync,
    setMode,
    togglePrimaryPlayback,
    replayPrimary,
    togglePrimaryPlaybackLoop,
    runOptimization: unsupportedAsync,
    saveActiveOutput: unsupportedAsync,
    openCompareAFromHost: unsupportedAsync,
    openCompareBFromHost: unsupportedAsync,
    selectImageKey,
    openResourceContextMenu: unsupportedSync,
    closeResourceContextMenu: unsupportedSync,
    selectTextKey,
    confirmInlineRename: unsupportedAsync,
    cancelInlineRename: unsupportedSync,
    renameSelectedImageKey: unsupportedAsync,
    chooseReplacementImage,
    resetImageReplacement,
    editRuntimeText,
    updateRuntimeText,
    resetRuntimeText,
    openSettings,
    closeSettings,
    setAppearance,
    openKeyboardResourceContextMenu: unsupportedSync,
    setAssetFilter: unsupportedSync,
    setTab,
    openTab,
    handleTabListKeydown: unsupportedSync,
    handleResourceContextMenuKeydown: unsupportedSync,
    applyReplacementFile,
    loadDroppedFile,
    showCanvasDragDecision,
    hideCanvasDragDecision,
    dropCanvasFile,
    loadOpenedSource: unsupportedAsync,
    clearTransientOutput: unsupportedSync,
    showFailure,
    showOptimizationComparison: unsupportedAsync,
    createSaveProofOutput: unsupportedAsync,
    createSaveFailureProofOutput: unsupportedSync,
    currentStateSummary,
    renderCommandState
  };

  function initialize() {
    applyProductCopy();
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
            message: "0.2 预览请求没有在限定时间内到达加载或错误终态，已中止本次打开。"
          });
        }, deadlineMs);
      })
    ]);
    return normalizeMultiFormatOpenOutcome(result);
  } catch {
    return {
      kind: "failure",
      message: "0.2 预览主机打开本地候选失败，源文件没有被修改。"
    };
  } finally {
    clearTimeout(timeout);
  }
}

export function normalizeMultiFormatOpenOutcome(result) {
  if (result?.kind === "failure" || result?.kind === "cancelled" || result?.kind === "model") return result;
  if (result?.status === "cancelled") return { kind: "cancelled" };
  if (result?.model) return { kind: "model", result };
  if (result?.status === "opened") {
    return {
      kind: "failure",
      message: "0.2 预览主机没有返回可见的终态结果，源文件没有被修改。"
    };
  }
  return {
    kind: "failure",
    message: "0.2 预览主机返回了无法识别的结果，源文件没有被修改。"
  };
}

function applyProductCopy(documentRef = document) {
  documentRef.querySelector(".launchPrompt p")?.replaceChildren("拖拽 SVGA / Lottie JSON / VAP MP4 到此处");
  documentRef.querySelectorAll("[data-action='open'] span").forEach((node) => {
    node.textContent = "打开预览候选";
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
  const format = model.detectedFormat ? model.detectedFormat.toUpperCase() : "0.2";
  const dimensions = model.canvas?.dimensions || "unknown";
  const duration = formatTime(model.canvas?.playback?.durationMs || 0);
  return `${format} · ${dimensions} · ${duration} · ${statusCopy(model.status)}`;
}

function issueSummary(model) {
  return model.rightPanel?.issues?.[0]?.message || model.rightPanel?.unsupportedFeatures?.[0]?.feature || "";
}

function statusCopy(status) {
  return {
    launch: "待打开",
    loading: "加载中",
    previewReady: "已就绪",
    playing: "播放中",
    paused: "已暂停",
    playbackBlocked: "播放受限",
    playbackFailed: "播放失败",
    failed: "加载失败",
    disposed: "已关闭"
  }[status] ?? status ?? "未知";
}

function formatTime(timeMs) {
  const seconds = Math.max(0, Math.round((Number(timeMs) || 0) / 1000));
  const minutes = Math.floor(seconds / 60);
  return `${minutes}:${String(seconds % 60).padStart(2, "0")}`;
}

function hasImageTarget(model, targetId) {
  return (model.rightPanel?.assets ?? []).some((asset) => asset.replaceable && asset.id === targetId)
    || (model.rightPanel?.vapFusionImages ?? []).some((entry) =>
      entry.replaceable && [entry.srcTag, entry.runtimeBindingKey, entry.id].includes(targetId)
    );
}

function hasTextTarget(model, targetId) {
  return (model.rightPanel?.lottieTexts ?? []).some((entry) => entry.replaceable && entry.id === targetId)
    || (model.rightPanel?.vapFusionTexts ?? []).some((entry) =>
      entry.replaceable && [entry.srcTag, entry.runtimeBindingKey, entry.id].includes(targetId)
    );
}

class RuntimePreviewPayloadError extends Error {
  constructor(issue) {
    super(issue?.message || "0.2 预览运行时没有返回可播放的本地载荷。");
    this.name = "RuntimePreviewPayloadError";
    this.issue = issue;
  }
}

function runtimePreviewErrorCopy(error) {
  if (error instanceof RuntimePreviewPayloadError) {
    const code = error.issue?.code ? `${error.issue.code}: ` : "";
    return `${code}${error.message}`;
  }
  return error instanceof Error
    ? error.message
    : "0.2 预览运行时未能挂载本地播放视图。";
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
