import { renderAvatarFrameInspectionReport } from "./inspection-report-view.mjs";
import { getProductHostAdapter } from "./web-host-adapter.mjs";

const hostAdapter = getProductHostAdapter();
const fetch = hostAdapter.http.fetch;
const URL = hostAdapter.urls;
const localStorage = hostAdapter.storage;
const urlParams = new URLSearchParams(window.location.search);
const isSmokeMode = urlParams.get("mode") === "smoke";
const shouldCaptureArtifacts = urlParams.get("artifacts") === "1";
const electronBridge = globalThis.autoSvgaElectronHost ?? globalThis.autoSvgaPrototype;
const cspViolations = [];

window.addEventListener("securitypolicyviolation", (event) => {
  cspViolations.push({
    blockedURI: event.blockedURI,
    effectiveDirective: event.effectiveDirective,
    violatedDirective: event.violatedDirective
  });
});

const paths = {
  svga: "/examples/avatar_frame_basic/output/avatar_frame_basic.svga",
  report: "/examples/avatar_frame_basic/output/report.json"
};

const reportLabels = {
  jobName: "任务名称 / jobName",
  assetType: "资产类型 / assetType",
  canvasSize: "画布尺寸 / canvasSize",
  frames: "帧数 / frames",
  durationMs: "时长毫秒 / durationMs",
  svgaExported: "SVGA 已导出 / svgaExported",
  previewSizeBytes: "GIF 大小 / preview.sizeBytes",
  svgaSizeBytes: "SVGA 大小 / svga.sizeBytes",
  primaryReviewTarget: "主验收对象 / primaryReviewTarget",
  gifPreviewDeprecated: "GIF 已降级 / gifPreviewDeprecated",
  warnings: "警告 / warnings",
  fileSizeBytes: "文件大小 / fileSizeBytes",
  imageCount: "图像数量 / imageCount",
  spriteCount: "精灵数量 / spriteCount",
  frameCount: "帧数 / frameCount",
  fps: "帧率 / fps",
  durationSeconds: "时长秒 / durationSeconds",
  exporterReady: "导出准备状态 / exporterReady",
  "svgaExport.success": "SVGA 导出成功 / svgaExport.success",
  bakedSweepFrameStride: "扫光采样步长 / bakedSweepFrameStride",
  sampledFrameCount: "采样帧数量 / sampledFrameCount",
  bakedSweepUniqueAssetCount: "烘焙扫光唯一资源数 / bakedSweepUniqueAssetCount",
  bakedSweepTransparentFrameCount: "透明帧数量 / bakedSweepTransparentFrameCount"
};

const statusText = {
  loading: "加载中",
  loaded: "已加载",
  playing: "播放中",
  empty: "空",
  error: "错误",
  ready: "就绪"
};

const appLogs = [];
const players = {
  a: createPlayerSlot("A"),
  b: createPlayerSlot("B")
};

const referenceState = {
  panel: document.querySelector("#referencePanel"),
  frame: document.querySelector("#referenceFrame"),
  video: document.querySelector("#referenceVideo"),
  image: document.querySelector("#referenceImage"),
  emptyState: document.querySelector("#referenceEmptyState"),
  info: document.querySelector("#referenceInfo"),
  status: document.querySelector("#referenceStatus"),
  objectUrl: undefined,
  metrics: undefined,
  kind: undefined,
  loadToken: 0
};

const modeSelect = document.querySelector("#modeSelect");
const modeDropdownTrigger = document.querySelector("#modeDropdownTrigger");
const modeDropdownLabel = document.querySelector("#modeDropdownLabel");
const modeDropdownMenu = document.querySelector("#modeDropdownMenu");
const workspace = document.querySelector("#workspace");
const compareToggle = document.querySelector("#compareToggle");
const compareToggleWrap = document.querySelector("#compareToggleWrap");
const infoPanelButton = document.querySelector("#infoPanelButton");
const logsButton = document.querySelector("#logsButton");
const themeToggleButton = document.querySelector("#themeToggleButton");
const settingsButton = document.querySelector("#settingsButton");
const syncBar = document.querySelector("#syncBar");
const syncProgress = document.querySelector("#syncProgress");
const syncTime = document.querySelector("#syncTime");
const syncLeftInfo = document.querySelector("#syncLeftInfo");
const syncRightInfo = document.querySelector("#syncRightInfo");
const syncWarnings = document.querySelector("#syncWarnings");
const svgaBadgeA = document.querySelector("#svgaBadgeA");
const svgaTitleA = document.querySelector("#svgaTitleA");
const svgaEmptyTitleA = document.querySelector("#svgaEmptyTitleA");
const svgaEmptySubtitleA = document.querySelector("#svgaEmptySubtitleA");
const localReplayButton = document.querySelector("#localReplayButton");
const localPlayPauseButton = document.querySelector("#localPlayPauseButton");
const localLoopToggle = document.querySelector("#localLoopToggle");
const localProgress = document.querySelector("#localProgress");
const localTime = document.querySelector("#localTime");
const localFitButton = document.querySelector("#localFitButton");
const playerBPlayPauseButton = document.querySelector("#playerBPlayPauseButton");
const playerBReplayButton = document.querySelector("#playerBReplayButton");
const playerBProgress = document.querySelector("#playerBProgress");
const playerBTime = document.querySelector("#playerBTime");
const playerBLoopToggle = document.querySelector("#playerBLoopToggle");
const referencePlayPauseButton = document.querySelector("#referencePlayPauseButton");
const referenceReplayButton = document.querySelector("#referenceReplayButton");
const referenceProgress = document.querySelector("#referenceProgress");
const referenceTime = document.querySelector("#referenceTime");
const referenceLoopToggle = document.querySelector("#referenceLoopToggle");
const syncPlayControl = document.querySelector("#syncPlayControl");
const syncReplayControl = document.querySelector("#syncReplayControl");
const reportGrid = document.querySelector("#reportGrid");
const errorBox = document.querySelector("#errorBox");
const svgaFileInput = document.querySelector("#svgaFileInput");
const secondaryFileInput = document.querySelector("#secondaryFileInput");
const referenceFileInput = document.querySelector("#referenceFileInput");
const primaryFileButton = document.querySelector("#primaryFileButton");
const primaryEmptyFileButton = document.querySelector("#primaryEmptyFileButton");
const secondaryEmptyFileButton = document.querySelector("#secondaryEmptyFileButton");
const referenceEmptyFileButton = document.querySelector("#referenceEmptyFileButton");
const secondaryInputWrap = document.querySelector("#secondaryInputWrap");
const secondaryInputLabel = document.querySelector("#secondaryInputLabel");
const primaryInputLabel = document.querySelector("#primaryInputLabel");
const fitModeA = document.querySelector("#fitModeA");
const fitModeB = document.querySelector("#fitModeB");
const fitModeReference = document.querySelector("#fitModeReference");
const toolbar = document.querySelector(".toolbar");
const infoStatus = document.querySelector("#infoStatus");
const tabButtons = Array.from(document.querySelectorAll(".tabButton"));
const svgaFilePillA = document.querySelector("#svgaFilePillA");
const assetPreviewModal = document.querySelector("#assetPreviewModal");
const assetPreviewClose = document.querySelector("#assetPreviewClose");
const assetPreviewImage = document.querySelector("#assetPreviewImage");
const assetPreviewTitle = document.querySelector("#assetPreviewTitle");
const assetPreviewMeta = document.querySelector("#assetPreviewMeta");
const assetPreviewDetails = document.querySelector("#assetPreviewDetails");
const copyImageKeyButton = document.querySelector("#copyImageKeyButton");
const settingsModal = document.querySelector("#settingsModal");
const settingsCloseButton = document.querySelector("#settingsCloseButton");
const settingsToast = document.querySelector("#settingsToast");
const infoPanel = document.querySelector("#infoPanel");
const logsPanel = document.querySelector("#logsPanel");
const fullLogsContent = document.querySelector("#fullLogsContent");
const fullLogsSubtitle = document.querySelector("#fullLogsSubtitle");
const copyFullLogsButton = document.querySelector("#copyFullLogsButton");
const clearFullLogsButton = document.querySelector("#clearFullLogsButton");
const logsActionFeedback = document.querySelector("#logsActionFeedback");
const infoPanelResizeHandle = document.querySelector("#infoPanelResizeHandle");
const logsPanelResizeHandle = document.querySelector("#logsPanelResizeHandle");
const autoLoadLatestToggle = document.querySelector("#autoLoadLatestToggle");
const rescanButton = document.querySelector("#rescanButton");
const rescanStatus = document.querySelector("#rescanStatus");
const globalLoopToggle = document.querySelector("#globalLoopToggle");
const reduceMotionToggle = document.querySelector("#reduceMotionToggle");
const reduceBlurToggle = document.querySelector("#reduceBlurToggle");
const statusAnnouncer = document.querySelector("#statusAnnouncer");
const floatingRoot = document.querySelector("#floatingRoot");
const dropdownBindings = new Map();

let defaultReport;
let defaultSvgaMap;
let syncTimer;
let localTimer;
let localStartedAt = 0;
let localPausedPercent = 0;
let playerBTimer;
let playerBStartedAt = 0;
let referenceTimer;
let selectedLayerKey;
let selectedImageKey;
let selectedAssetKey;
let assetFilter = "all";
const expandedSequenceGroups = new Set();
let previewImageKey;
let effectiveTheme = "light";
let activeSidePanel = null;
let compareEnabled = false;
let syncIsPlaying = false;
let infoPanelWidth = Number(localStorage.getItem("autoSvgaInfoPanelWidth")) || 420;
let logsPanelWidth = Number(localStorage.getItem("autoSvgaLogsPanelWidth")) || 560;
let manualArtifactSelection = false;
let latestArtifactGroup;
let artifactAutoLoading = false;
let activeModal = null;
let modalReturnFocus = null;
let toastTimer;

function createPlayerSlot(slotName) {
  const suffix = slotName.toUpperCase();
  return {
    slotName: suffix,
    panel: document.querySelector(`#svgaPanel${suffix}`),
    frame: document.querySelector(`#svgaFrame${suffix}`),
    canvas: document.querySelector(`#svgaCanvas${suffix}`),
    info: document.querySelector(`#svgaSizeInfo${suffix}`),
    status: document.querySelector(`#svgaStatus${suffix}`),
    player: undefined,
    videoItem: undefined,
    objectUrl: undefined,
    metrics: undefined,
    report: undefined,
    inspectionReport: undefined,
    inspectionStatus: "idle",
    inspectionRequestId: 0,
    loadingPhases: Array.from(document.querySelectorAll(`#svgaPanel${suffix} [data-loading-phase]`)),
    source: undefined,
    parseStatus: "empty",
    renderStatus: "empty",
    isPlaying: false,
    loop: true
  };
}

function addLog(level, message) {
  appLogs.push({
    level,
    message,
    time: new Date().toLocaleTimeString("zh-CN", { hour12: false })
  });
  renderInfoPanel();
  renderLogsPanel();
}

function showError(message) {
  errorBox.hidden = false;
  errorBox.textContent = String(message).split(" / ")[0];
  announce(errorBox.textContent);
  addLog("error", message);
}

function announce(message) {
  if (statusAnnouncer) statusAnnouncer.textContent = message;
}

function clearError() {
  errorBox.hidden = true;
  errorBox.textContent = "";
}

function setSlotLoadingPhase(slot, activePhase, phaseStates = {}) {
  for (const item of slot.loadingPhases ?? []) {
    const phase = item.dataset.loadingPhase;
    item.classList.toggle("isActive", phase === activePhase);
    item.classList.toggle("isDone", phaseStates[phase] === "done");
    item.classList.toggle("isError", phaseStates[phase] === "error");
  }
}

function clearSlotLoadingPhase(slot) {
  setSlotLoadingPhase(slot, undefined, {});
}

function resetSlotMediaState(slot, { clearReport = false } = {}) {
  slot.videoItem = undefined;
  slot.metrics = undefined;
  slot.isPlaying = false;
  slot.inspectionReport = undefined;
  slot.inspectionStatus = "idle";
  slot.parseStatus = "empty";
  slot.renderStatus = "empty";
  slot.panel.classList.remove("hasMedia", "isLoading");
  slot.canvas.innerHTML = "";
  slot.frame.style.removeProperty("width");
  slot.frame.style.removeProperty("height");
  slot.info.innerHTML = "";
  clearSlotLoadingPhase(slot);
  slot.player?.clear?.();
  if (slot.slotName === "A") {
    svgaFilePillA.hidden = true;
    svgaFilePillA.textContent = "";
    selectedLayerKey = undefined;
    selectedImageKey = undefined;
    selectedAssetKey = undefined;
    previewImageKey = undefined;
    expandedSequenceGroups.clear();
    if (!assetPreviewModal.hidden) closeAssetPreview();
    applyPrimaryEmptyCopy();
    localProgress.value = "0";
    updateRangeProgress(localProgress, 0);
    localTime.textContent = "0:00 / 0:00";
    if (clearReport) {
      slot.report = undefined;
      renderReport(undefined);
    }
  }
}

function setSlotInvalidState(slot, message) {
  slot.inspectionRequestId += 1;
  resetSlotMediaState(slot, { clearReport: slot.slotName === "A" });
  slot.source = undefined;
  slot.parseStatus = "error";
  slot.renderStatus = "error";
  slot.inspectionStatus = "error";
  setStatus(slot.status, "error");
  setSlotLoadingPhase(slot, undefined, {
    file: "done",
    read: "done",
    parse: "error",
    check: "error"
  });
  showError(message);
  updateButtons();
  renderInfoPanel();
  refreshLayout();
}

function setStatus(element, value) {
  element.textContent = statusText[value] ?? value;
}

function applyPrimaryEmptyCopy() {
  if (modeSelect.value === "localPreview") {
    primaryEmptyFileButton.textContent = compareEnabled ? "选择 SVGA A" : "选择 SVGA 文件";
    svgaEmptyTitleA.textContent = compareEnabled ? "拖拽第一个 SVGA 文件到此处" : "拖拽 SVGA 文件到此处";
    svgaEmptySubtitleA.textContent = "或选择本地文件";
  } else {
    primaryEmptyFileButton.textContent = "选择导出 SVGA";
    svgaEmptyTitleA.textContent = "拖拽导出的 SVGA 文件到此处";
    svgaEmptySubtitleA.textContent = "或选择本地文件";
  }
}

function applyPrimaryLoadingCopy(fileName) {
  svgaEmptyTitleA.textContent = "正在加载 SVGA 文件";
  svgaEmptySubtitleA.textContent = fileName ? `正在处理 ${fileName}` : "正在读取、解析并生成检查结果";
}

function ensureSvgaLibrary() {
  if (!window.SVGA?.Player || !window.SVGA?.Parser) {
    throw new Error("SVGA Web Player 库加载失败，请检查网络或本地依赖。/ SVGA Web Player library failed to load.");
  }
}

function ensurePakoLibrary() {
  if (!window.pako?.inflate) {
    throw new Error("pako 加载失败，无法解析 SVGA。/ pako failed to load; SVGA metadata cannot be decoded.");
  }
}

async function loadReport(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`无法加载 report.json。/ Unable to load report.json (${response.status})`);
  }
  return response.json();
}

function renderReport(report) {
  if (!report) {
    reportGrid.innerHTML = `<div><dt>状态 / status</dt><dd>暂无报告 / No report loaded</dd></div>`;
    return;
  }

  const validation = report.svgaExport?.validation ?? {};
  const isMvpReport = Boolean(report.jobName && report.summary && report.validation);
  const rows = isMvpReport ? [
    ["jobName", report.jobName],
    ["assetType", report.assetType],
    ["canvasSize", report.validation?.canvasSize],
    ["fps", report.preview?.fps],
    ["frames", report.preview?.frames],
    ["durationMs", report.preview?.durationMs],
    ["svgaExported", report.validation?.svgaExported],
    ["previewSizeBytes", report.preview?.sizeBytes],
    ["svgaSizeBytes", report.svga?.sizeBytes],
    ["primaryReviewTarget", report.review?.primary?.toUpperCase?.() ?? report.visualWarnings?.primaryReviewTarget?.toUpperCase?.()],
    ["gifPreviewDeprecated", report.review?.gifPreviewDeprecated ?? report.visualWarnings?.gifPreviewDeprecated],
    ["warnings", report.warnings?.length ? report.warnings.join("；") : "无"]
  ] : [
    ["fileSizeBytes", report.svgaExport?.fileSizeBytes ?? report.svgaFileSizeBytes],
    ["imageCount", validation.imageCount],
    ["spriteCount", validation.spriteCount],
    ["frameCount", validation.frameCount ?? report.preview?.frameCount],
    ["fps", report.fps],
    ["durationSeconds", report.durationSeconds],
    ["exporterReady", report.exporterReady],
    ["svgaExport.success", report.svgaExport?.success],
    ["bakedSweepFrameStride", report.bakedSweepFrameStride],
    ["sampledFrameCount", report.bakedSweepSampledFrameCount ?? report.sampledFrameCount],
    ["bakedSweepUniqueAssetCount", report.bakedSweepUniqueAssetCount],
    ["bakedSweepTransparentFrameCount", report.bakedSweepTransparentFrameCount]
  ];

  reportGrid.innerHTML = rows.map(([key, value]) => {
    const normalizedValue = value === undefined || value === null ? "n/a" : String(value);
    return `<div><dt>${reportLabels[key] ?? key}</dt><dd>${escapeHtml(normalizedValue)}</dd></div>`;
  }).join("");
}

function extractReportMetrics(report) {
  const validation = report?.svgaExport?.validation ?? {};
  const metrics = {
    fileSizeBytes: report?.svgaExport?.fileSizeBytes ?? report?.svgaFileSizeBytes,
    frameCount: validation.frameCount ?? report?.preview?.frameCount,
    imageCount: validation.imageCount,
    spriteCount: validation.spriteCount,
    bakedSweepFrameStride: report?.bakedSweepFrameStride,
    sampledFrameCount: report?.bakedSweepSampledFrameCount ?? report?.sampledFrameCount,
    fps: report?.fps,
    durationSeconds: report?.durationSeconds
  };
  return Object.fromEntries(Object.entries(metrics).filter(([, value]) => value !== undefined && value !== null));
}

function getStageAvailableSize(frameElement) {
  const stage = frameElement.closest(".stage");
  const style = window.getComputedStyle(stage);
  const horizontalPadding = parseFloat(style.paddingLeft) + parseFloat(style.paddingRight);
  const verticalPadding = parseFloat(style.paddingTop) + parseFloat(style.paddingBottom);
  return {
    width: Math.max(1, stage.clientWidth - horizontalPadding),
    height: Math.max(1, stage.clientHeight - verticalPadding)
  };
}

function computeDisplaySize(sourceWidth, sourceHeight, frameElement, mode = "contain") {
  const available = getStageAvailableSize(frameElement);
  const aspectRatio = sourceWidth / sourceHeight;
  let width;
  let height;

  if (mode === "original") {
    const scale = Math.min(1, available.width / sourceWidth, available.height / sourceHeight);
    width = sourceWidth * scale;
    height = sourceHeight * scale;
  } else if (mode === "fitWidth") {
    width = available.width;
    height = width / aspectRatio;
    if (height > available.height) {
      height = available.height;
      width = height * aspectRatio;
    }
  } else {
    const scale = Math.min(available.width / sourceWidth, available.height / sourceHeight);
    width = sourceWidth * scale;
    height = sourceHeight * scale;
  }

  return {
    width: Math.max(1, Math.round(width)),
    height: Math.max(1, Math.round(height))
  };
}

function applyMediaSize(frameElement, metrics, mode = "contain") {
  if (!metrics?.sourceWidth || !metrics?.sourceHeight) {
    frameElement.style.removeProperty("width");
    frameElement.style.removeProperty("height");
    return;
  }

  const displaySize = computeDisplaySize(metrics.sourceWidth, metrics.sourceHeight, frameElement, mode);
  frameElement.style.width = `${displaySize.width}px`;
  frameElement.style.height = `${displaySize.height}px`;
  metrics.displayedWidth = displaySize.width;
  metrics.displayedHeight = displaySize.height;
}

function renderSvgaInfo(slot) {
  const metrics = slot.metrics;
  if (!metrics) {
    slot.info.innerHTML = "";
    return;
  }

  const rows = [
    ["文件 / file", metrics.fileName],
    ["体积 / size", formatBytes(metrics.fileSizeBytes)],
    ["画布 / canvas", formatSize(metrics.sourceWidth, metrics.sourceHeight)],
    ["时长 / duration", formatDuration(metrics)],
    ["FPS", metrics.fps],
    ["图层 / layers", metrics.spriteCount],
    ["图片 / images", metrics.imageCount],
    ["显示 / displayed", formatSize(metrics.displayedWidth, metrics.displayedHeight)]
  ];

  slot.info.innerHTML = rows.map(([label, value]) => (
    `<div><dt>${label}</dt><dd>${escapeHtml(value ?? "n/a")}</dd></div>`
  )).join("");
}

function renderReferenceInfo() {
  const metrics = referenceState.metrics;
  if (!metrics) {
    referenceState.info.innerHTML = "";
    return;
  }
  const rows = [
    ["文件 / file", metrics.fileName],
    ["体积 / size", formatBytes(metrics.fileSizeBytes)],
    ["尺寸 / size", formatSize(metrics.sourceWidth, metrics.sourceHeight)],
    ["时长 / duration", metrics.durationSeconds ? `${metrics.durationSeconds.toFixed(2)}s` : "n/a"],
    ["显示 / displayed", formatSize(metrics.displayedWidth, metrics.displayedHeight)]
  ];
  referenceState.info.innerHTML = rows.map(([label, value]) => (
    `<div><dt>${label}</dt><dd>${escapeHtml(value ?? "n/a")}</dd></div>`
  )).join("");
}

function refreshLayout() {
  applyMediaSize(players.a.frame, players.a.metrics, fitModeA.value);
  renderSvgaInfo(players.a);
  applyMediaSize(players.b.frame, players.b.metrics, fitModeB.value);
  renderSvgaInfo(players.b);
  applyMediaSize(referenceState.frame, referenceState.metrics, fitModeReference.value);
  renderReferenceInfo();
  renderInfoPanel();
  renderSyncBar();
}

function updateButtons() {
  const mode = modeSelect.value;
  const hasA = Boolean(players.a.videoItem);
  const hasB = Boolean(players.b.videoItem);
  const hasReference = Boolean(referenceState.metrics);
  localReplayButton.disabled = !hasA;
  compareToggleWrap.hidden = mode !== "localPreview";
  infoPanelButton.hidden = false;
  logsButton.hidden = false;
  settingsButton.hidden = false;
  const syncDisabled = isCompareActive() ? (!hasA && !hasB) : (!hasA && !hasReference);
  syncPlayControl.disabled = syncDisabled;
  syncReplayControl.disabled = syncDisabled;
  infoPanelButton.classList.toggle("isActive", activeSidePanel === "info");
  logsButton.classList.toggle("isActive", activeSidePanel === "logs");
  infoPanelButton.setAttribute("aria-pressed", String(activeSidePanel === "info"));
  logsButton.setAttribute("aria-pressed", String(activeSidePanel === "logs"));
  updatePlaybackButtons();
  updateSyncPlaybackButton();
}

function setAppMode(nextMode = modeSelect.value) {
  if (nextMode === "localCompare") nextMode = "localPreview";
  const previousMode = modeSelect.value;
  modeSelect.value = nextMode;
  modeDropdownLabel.textContent = nextMode === "exportReview" ? "导出验收" : "本地预览";
  if (previousMode !== nextMode) {
    announce(nextMode === "exportReview" ? "已切换到导出验收" : "已切换到本地预览");
  }
  syncDropdownSelection(modeDropdownMenu, nextMode);
  workspace.className = `workspace mode-${nextMode}${compareEnabled && nextMode === "localPreview" ? " withCompare" : ""}${activeSidePanel ? " withSidePanel" : ""}`;
  players.b.panel.classList.toggle("isHidden", !isCompareActive());
  referenceState.panel.classList.toggle("isHidden", nextMode !== "exportReview");
  rescanButton.hidden = nextMode !== "exportReview";
  syncBar.classList.toggle("isHidden", nextMode === "localPreview" && !compareEnabled);
  secondaryFileInput.value = "";
  referenceFileInput.value = "";

  if (nextMode === "localPreview") {
    primaryInputLabel.textContent = compareEnabled ? "选择 SVGA A" : "选择 SVGA";
    primaryEmptyFileButton.textContent = compareEnabled ? "选择 SVGA A" : "选择 SVGA 文件";
    secondaryInputLabel.textContent = "选择 SVGA B";
    secondaryFileInput.accept = ".svga,application/octet-stream";
    svgaBadgeA.textContent = compareEnabled ? "SVGA A" : "SVGA";
    svgaTitleA.textContent = compareEnabled ? "SVGA A" : "SVGA 本地预览";
    svgaTitleA.removeAttribute("data-subtitle");
    svgaEmptyTitleA.textContent = compareEnabled ? "拖拽第一个 SVGA 文件到此处" : "拖拽 SVGA 文件到此处";
    svgaEmptySubtitleA.textContent = "或选择本地文件";
  } else {
    compareEnabled = false;
    compareToggle.checked = false;
    primaryInputLabel.textContent = "选择导出 SVGA";
    primaryEmptyFileButton.textContent = "选择导出 SVGA";
    svgaBadgeA.textContent = "SVGA";
    svgaTitleA.textContent = "导出 SVGA";
    svgaTitleA.removeAttribute("data-subtitle");
    svgaEmptyTitleA.textContent = "拖拽导出的 SVGA 文件到此处";
    svgaEmptySubtitleA.textContent = "或选择本地文件";
  }

  updateButtons();
  refreshLayout();
}

function isCompareActive() {
  return modeSelect.value === "localPreview" && compareEnabled;
}

function setActiveSidePanel(nextPanel) {
  activeSidePanel = nextPanel === activeSidePanel ? null : nextPanel;
  infoPanel.classList.toggle("isHidden", activeSidePanel !== "info");
  logsPanel.classList.toggle("isHidden", activeSidePanel !== "logs");
  workspace.classList.toggle("withSidePanel", Boolean(activeSidePanel));
  updateButtons();
  if (activeSidePanel === "info") renderInfoPanel();
  if (activeSidePanel === "logs") renderLogsPanel();
  window.requestAnimationFrame(refreshLayout);
}

function openModal(layer, trigger) {
  if (!layer) return;
  activeModal = layer;
  modalReturnFocus = trigger ?? document.activeElement;
  layer.hidden = false;
  layer.classList.remove("isClosing");
  window.requestAnimationFrame(() => layer.classList.add("isOpen"));
}

function closeModal(layer, { restoreFocus = true } = {}) {
  if (!layer || layer.hidden || layer.classList.contains("isClosing")) return;
  layer.classList.remove("isOpen");
  layer.classList.add("isClosing");
  window.setTimeout(() => {
    layer.hidden = true;
    layer.classList.remove("isClosing");
    if (activeModal === layer) activeModal = null;
    if (restoreFocus) modalReturnFocus?.focus?.();
  }, document.documentElement.classList.contains("reduceMotion") ? 20 : 190);
}

function showSettingsToast(message = "设置已更新") {
  window.clearTimeout(toastTimer);
  settingsToast.textContent = message;
  announce(message);
  settingsToast.hidden = false;
  settingsToast.classList.remove("isClosing");
  window.requestAnimationFrame(() => settingsToast.classList.add("isOpen"));
  toastTimer = window.setTimeout(() => {
    settingsToast.classList.remove("isOpen");
    settingsToast.classList.add("isClosing");
    window.setTimeout(() => {
      settingsToast.hidden = true;
      settingsToast.classList.remove("isClosing");
    }, document.documentElement.classList.contains("reduceMotion") ? 20 : 170);
  }, 1700);
}

function openInfoPanel(tabName = "overview") {
  const target = tabButtons.find((button) => button.dataset.tab === tabName) ?? tabButtons[0];
  for (const item of tabButtons) item.classList.toggle("isActive", item === target);
  for (const panel of document.querySelectorAll(".tabPanel")) panel.classList.add("isHidden");
  document.querySelector(`#tab-${target.dataset.tab}`).classList.remove("isHidden");
  setActiveSidePanel("info");
}

function applyInfoPanelWidth(width) {
  const viewportMaximum = Math.max(300, Math.min(440, Math.floor(window.innerWidth * 0.42)));
  infoPanelWidth = Math.min(viewportMaximum, Math.max(320, Math.round(width)));
  document.documentElement.style.setProperty("--info-panel-width", `${infoPanelWidth}px`);
  infoPanelResizeHandle?.setAttribute("aria-valuenow", String(infoPanelWidth));
}

function applyLogsPanelWidth(width) {
  const viewportMaximum = Math.max(320, Math.min(480, Math.floor(window.innerWidth * 0.46)));
  logsPanelWidth = Math.min(viewportMaximum, Math.max(320, Math.round(width)));
  document.documentElement.style.setProperty("--logs-panel-width", `${logsPanelWidth}px`);
  logsPanelResizeHandle?.setAttribute("aria-valuenow", String(logsPanelWidth));
}

function closeInfoPanel() {
  if (activeSidePanel === "info") setActiveSidePanel(null);
}

function loadReference(fileOrSource, options = {}) {
  clearError();
  clearReference();
  const loadToken = ++referenceState.loadToken;
  const source = typeof fileOrSource === "string" ? fileOrSource : URL.createObjectURL(fileOrSource);
  if (typeof fileOrSource !== "string") {
    referenceState.objectUrl = source;
  }

  const fileName = options.fileName ?? (typeof fileOrSource === "string" ? "reference-video" : fileOrSource.name);
  const fileSizeBytes = options.fileSizeBytes ?? (typeof fileOrSource === "string" ? undefined : fileOrSource.size);
  const kind = options.kind ?? fileKind({ name: fileName });
  referenceState.kind = kind;
  setStatus(referenceState.status, "loading");
  referenceState.emptyState.hidden = true;

  if (kind === "gif") {
    referenceState.image.hidden = false;
    referenceState.video.hidden = true;
    referenceState.image.src = source;
    return new Promise((resolve, reject) => {
      referenceState.image.addEventListener("load", () => {
        if (loadToken !== referenceState.loadToken) return;
      referenceState.metrics = {
        fileName,
        fileSizeBytes,
        sourceWidth: referenceState.image.naturalWidth,
        sourceHeight: referenceState.image.naturalHeight
      };
      setStatus(referenceState.status, "loaded");
      referenceState.panel.classList.add("hasMedia");
      refreshLayout();
        updateButtons();
        resolve();
      }, { once: true });
      referenceState.image.addEventListener("error", () => {
        if (loadToken !== referenceState.loadToken) return;
        setStatus(referenceState.status, "error");
        updateButtons();
        reject(new Error(`参考 GIF 加载失败：${fileName} / Unable to load reference GIF`));
      }, { once: true });
    });
  }

  referenceState.video.hidden = false;
  referenceState.image.hidden = true;
  referenceState.video.controls = true;
  referenceState.video.muted = true;
  referenceState.video.playsInline = true;
  referenceState.video.preload = "auto";
  referenceState.video.loop = referenceLoopToggle.checked;
  referenceState.video.src = source;
  referenceState.video.load();
  return new Promise((resolve, reject) => {
    referenceState.video.addEventListener("loadedmetadata", () => {
      if (loadToken !== referenceState.loadToken) return;
      referenceState.metrics = {
        fileName,
        fileSizeBytes,
        sourceWidth: referenceState.video.videoWidth,
        sourceHeight: referenceState.video.videoHeight,
        durationSeconds: referenceState.video.duration
      };
      setStatus(referenceState.status, "loaded");
      referenceState.panel.classList.add("hasMedia");
      refreshLayout();
      updateButtons();
      addLog("info", `参考视频元数据已加载：${fileName} / Reference metadata loaded`);
    }, { once: true });
    referenceState.video.addEventListener("canplay", () => {
      if (loadToken !== referenceState.loadToken) return;
      setStatus(referenceState.status, "loaded");
      updateButtons();
      addLog("success", `参考视频可以播放：${fileName} / Reference video can play`);
      resolve();
    }, { once: true });
    referenceState.video.addEventListener("error", () => {
      if (loadToken !== referenceState.loadToken) return;
      setStatus(referenceState.status, "error");
      updateButtons();
      const mediaError = referenceState.video.error;
      reject(new Error(`参考视频加载失败：${fileName}（code ${mediaError?.code ?? "unknown"}）/ Unsupported video source`));
    }, { once: true });
  });
}

function clearReference() {
  referenceState.loadToken += 1;
  if (referenceState.objectUrl) {
    URL.revokeObjectURL(referenceState.objectUrl);
    referenceState.objectUrl = undefined;
  }
  referenceState.video.pause();
  referenceState.video.removeAttribute("src");
  referenceState.video.load();
  referenceState.video.hidden = true;
  referenceState.image.removeAttribute("src");
  referenceState.image.hidden = true;
  referenceState.metrics = undefined;
  referenceState.kind = undefined;
  referenceState.panel.classList.remove("hasMedia");
  referenceState.frame.style.removeProperty("width");
  referenceState.frame.style.removeProperty("height");
  referenceState.info.innerHTML = "";
  referenceState.emptyState.hidden = false;
  setStatus(referenceState.status, "empty");
}

function rebuildPlayer(slot) {
  slot.canvas.innerHTML = "";
  slot.player = new window.SVGA.Player(`#${slot.canvas.id}`);
  slot.player.loops = slot.loop ? 0 : 1;
  slot.player.clearsAfterStop = false;
  slot.player.setContentMode("AspectFit");
  slot.player.onFinished?.(() => {
    if (slot.loop) return;
    finishSlotPlayback(slot);
  });
}

function replaySlot(slot, shouldShowError = true) {
  if (!slot.player || !slot.videoItem) {
    if (shouldShowError) {
      showError(`当前没有可播放的 SVGA。/ No SVGA loaded in player ${slot.slotName}.`);
    }
    updateButtons();
    return;
  }
  slot.player.clear();
  slot.player.setVideoItem(slot.videoItem);
  slot.player.startAnimation();
  slot.renderStatus = "ready";
  slot.isPlaying = true;
  setStatus(slot.status, "playing");
  slot.panel.classList.add("hasMedia");
  if (slot.slotName === "A") {
    svgaFilePillA.hidden = false;
    svgaFilePillA.textContent = slot.metrics?.fileName ?? "SVGA";
    startLocalTicker(true);
  } else {
    startPlayerBTicker(true);
  }
  updatePlaybackButtons();
}

function pauseSlot(slot) {
  if (slot.player?.pauseAnimation) {
    slot.player.pauseAnimation();
  }
  slot.isPlaying = false;
  if (slot.slotName === "A") {
    stopLocalTicker();
  } else {
    stopPlayerBTicker();
  }
  updatePlaybackButtons();
}

function playSlot(slot) {
  if (slot.player && slot.videoItem) {
    const progress = getSlotProgressInput(slot);
    if (!slot.loop && Number(progress.value) >= 99.9) {
      progress.value = "0";
      seekSlot(slot, 0, false);
    }
    slot.player.startAnimation();
    slot.isPlaying = true;
    setStatus(slot.status, "playing");
    if (slot.slotName === "A") {
      startLocalTicker(false);
    } else {
      startPlayerBTicker(false);
    }
  }
  updatePlaybackButtons();
}

function toggleSlot(slot) {
  if (!slot.videoItem) {
    showError(`当前没有可播放的 SVGA。/ No SVGA loaded in player ${slot.slotName}.`);
    return;
  }
  if (slot.isPlaying) {
    pauseSlot(slot);
  } else {
    playSlot(slot);
  }
  updateSyncPlaybackState();
}

function seekSlot(slot, percent, playAfter = false) {
  if (!slot.player || !slot.videoItem || !slot.metrics?.frameCount || !slot.player.stepToFrame) {
    return;
  }
  const frame = Math.max(0, Math.min(slot.metrics.frameCount - 1, Math.round((percent / 100) * (slot.metrics.frameCount - 1))));
  slot.player.stepToFrame(frame, playAfter);
}

function getSlotProgressInput(slot) {
  return slot.slotName === "A" ? localProgress : playerBProgress;
}

function finishSlotPlayback(slot) {
  slot.isPlaying = false;
  const progress = getSlotProgressInput(slot);
  progress.value = "100";
  if (slot.slotName === "A") {
    stopLocalTicker();
    updateLocalTime(100);
  } else {
    stopPlayerBTicker();
    updatePlayerBTime(100);
  }
  updatePlaybackButtons();
  updateSyncPlaybackState();
}

function setSlotLoop(slot, enabled) {
  slot.loop = enabled;
  if (!slot.player || !slot.videoItem) return;
  const progress = getSlotProgressInput(slot);
  const percent = enabled && Number(progress.value) >= 99.9 ? 0 : Number(progress.value);
  progress.value = String(percent);
  const wasPlaying = slot.isPlaying;
  rebuildPlayer(slot);
  slot.player.setVideoItem(slot.videoItem);
  seekSlot(slot, percent, wasPlaying);
  slot.isPlaying = wasPlaying;
  if (wasPlaying) {
    if (slot.slotName === "A") startLocalTicker(false);
    else startPlayerBTicker(false);
  }
  updatePlaybackButtons();
}

function syncPlay() {
  clearError();
  if (isCompareActive()) {
    playSlot(players.a);
    playSlot(players.b);
  } else {
    playSlot(players.a);
    playReference();
  }
  syncIsPlaying = true;
  announce("同步播放已开始");
  updateSyncPlaybackButton();
  startSyncTicker();
}

function syncPause() {
  pauseSlot(players.a);
  pauseSlot(players.b);
  referenceState.video.pause();
  stopReferenceTicker();
  syncIsPlaying = false;
  announce("同步播放已暂停");
  updateSyncPlaybackButton();
  stopSyncTicker();
}

function toggleSyncPlayback() {
  if (syncIsPlaying) syncPause();
  else syncPlay();
}

function syncReplay() {
  clearError();
  replaySlot(players.a, false);
  if (isCompareActive()) {
    replaySlot(players.b, false);
  } else {
    replayReference();
  }
  syncProgress.value = "0";
  syncIsPlaying = true;
  updateSyncPlaybackButton();
  startSyncTicker();
  if (!players.a.videoItem && !players.b.videoItem && !referenceState.metrics) {
    showError("当前没有可同步播放的文件。/ No files are loaded for synchronized playback.");
  }
}

function updateSyncPlaybackButton() {
  renderPlaybackButton(syncPlayControl, {
    kind: syncIsPlaying ? "playing" : "paused",
    canPlay: !syncPlayControl.disabled,
    mediaType: "video"
  }, "同步");
}

function updateSyncPlaybackState() {
  const rightPlaying = isCompareActive() ? players.b.isPlaying : !referenceState.video.paused;
  syncIsPlaying = Boolean(players.a.isPlaying || rightPlaying);
  updateSyncPlaybackButton();
}

function seekSynchronized(percent) {
  const safePercent = Math.max(0, Math.min(100, Number(percent) || 0));
  const resume = syncIsPlaying;
  localProgress.value = String(safePercent);
  seekSlot(players.a, safePercent, resume);
  updateLocalTime(safePercent);
  localPausedPercent = safePercent;
  if (players.a.isPlaying) startLocalTicker(false);

  if (isCompareActive()) {
    playerBProgress.value = String(safePercent);
    seekSlot(players.b, safePercent, resume);
    updatePlayerBTime(safePercent);
    if (players.b.isPlaying) startPlayerBTicker(false);
  } else {
    const duration = referenceState.video.duration || 0;
    if (duration) {
      referenceState.video.currentTime = (duration * safePercent) / 100;
      referenceProgress.value = String(safePercent);
      updateRangeProgress(referenceProgress, safePercent);
      referenceTime.textContent = `${formatClock(referenceState.video.currentTime)} / ${formatClock(duration)}`;
    }
  }
  syncProgress.value = String(safePercent);
  updateSyncTime(safePercent);
}

function playReference() {
  if (referenceState.kind === "video" || referenceState.kind === "mp4" || referenceState.kind === "webm") {
    referenceState.video.play().catch((error) => {
      addLog("warning", `参考视频需要用户手动播放。/ Reference autoplay was blocked: ${error.message}`);
      updateSyncPlaybackState();
    });
  }
}

function replayReference() {
  if (referenceState.kind === "video" || referenceState.kind === "mp4" || referenceState.kind === "webm") {
    referenceState.video.currentTime = 0;
    playReference();
  } else if (referenceState.kind === "gif" && referenceState.image.src) {
    const src = referenceState.image.src;
    referenceState.image.src = "";
    referenceState.image.src = src;
  }
}

function startSyncTicker() {
  stopSyncTicker();
  syncTimer = window.setInterval(() => {
    const duration = getPrimaryDuration();
    const current = isCompareActive() || !referenceState.video.duration
      ? (duration * Number(localProgress.value)) / 100
      : referenceState.video.currentTime;
    const percent = duration ? Math.min(100, (current / duration) * 100) : Number(syncProgress.value);
    syncProgress.value = String(percent);
    updateSyncTime(percent);
  }, 120);
}

function stopSyncTicker() {
  if (syncTimer) {
    window.clearInterval(syncTimer);
    syncTimer = undefined;
  }
}

function startLocalTicker(reset = false) {
  stopLocalTicker();
  if (reset) {
    localPausedPercent = 0;
    localProgress.value = "0";
  }
  const duration = getPrimaryDuration();
  localStartedAt = performance.now() - ((Number(localProgress.value) / 100) * duration * 1000);
  localTimer = window.setInterval(() => {
    const nextPercent = duration ? (((performance.now() - localStartedAt) / 1000) / duration) * 100 : 0;
    if (!players.a.loop && nextPercent >= 100) {
      finishSlotPlayback(players.a);
      return;
    }
    const normalized = duration ? (players.a.loop ? nextPercent % 100 : Math.min(100, nextPercent)) : 0;
    localProgress.value = String(normalized);
    updateLocalTime(normalized);
  }, 120);
  updateLocalTime(Number(localProgress.value));
}

function stopLocalTicker() {
  if (localTimer) {
    window.clearInterval(localTimer);
    localTimer = undefined;
  }
  localPausedPercent = Number(localProgress.value);
}

function updateLocalTime(percent = Number(localProgress.value)) {
  const duration = getPrimaryDuration();
  updateRangeProgress(localProgress, percent);
  localTime.textContent = `${formatClock((duration * percent) / 100)} / ${formatClock(duration)}`;
}

function startPlayerBTicker(reset = false) {
  stopPlayerBTicker();
  if (reset) {
    playerBProgress.value = "0";
  }
  const duration = getSlotDuration(players.b);
  playerBStartedAt = performance.now() - ((Number(playerBProgress.value) / 100) * duration * 1000);
  playerBTimer = window.setInterval(() => {
    const nextPercent = duration ? (((performance.now() - playerBStartedAt) / 1000) / duration) * 100 : 0;
    if (!players.b.loop && nextPercent >= 100) {
      finishSlotPlayback(players.b);
      return;
    }
    const normalized = duration ? (players.b.loop ? nextPercent % 100 : Math.min(100, nextPercent)) : 0;
    playerBProgress.value = String(normalized);
    updatePlayerBTime(normalized);
  }, 120);
  updatePlayerBTime(Number(playerBProgress.value));
}

function stopPlayerBTicker() {
  if (playerBTimer) {
    window.clearInterval(playerBTimer);
    playerBTimer = undefined;
  }
}

function updatePlayerBTime(percent = Number(playerBProgress.value)) {
  const duration = getSlotDuration(players.b);
  updateRangeProgress(playerBProgress, percent);
  playerBTime.textContent = `${formatClock((duration * percent) / 100)} / ${formatClock(duration)}`;
}

function startReferenceTicker() {
  stopReferenceTicker();
  referenceTimer = window.setInterval(() => {
    const duration = referenceState.video.duration || referenceState.metrics?.durationSeconds || 0;
    const percent = duration ? Math.min(100, (referenceState.video.currentTime / duration) * 100) : 0;
    referenceProgress.value = String(percent);
    updateRangeProgress(referenceProgress, percent);
    referenceTime.textContent = `${formatClock(referenceState.video.currentTime)} / ${formatClock(duration)}`;
  }, 120);
}

function stopReferenceTicker() {
  if (referenceTimer) {
    window.clearInterval(referenceTimer);
    referenceTimer = undefined;
  }
}

function getSlotDuration(slot) {
  return slot.metrics?.durationSeconds
    ?? (slot.metrics?.fps && slot.metrics?.frameCount ? slot.metrics.frameCount / slot.metrics.fps : 0)
    ?? 0;
}

function getPrimaryDuration() {
  const slotDuration = getSlotDuration(players.a);
  return slotDuration || referenceState.metrics?.durationSeconds || 0;
}

function updateSyncTime(percent) {
  const duration = getPrimaryDuration();
  updateRangeProgress(syncProgress, percent);
  syncTime.textContent = `${formatClock((duration * percent) / 100)} / ${formatClock(duration)}`;
}

function updateRangeProgress(input, percent = Number(input.value)) {
  const safePercent = Math.max(0, Math.min(100, Number.isFinite(Number(percent)) ? Number(percent) : 0));
  input.style.setProperty("--rangeProgress", `${safePercent}%`);
}

function extractSizeFromVideoItem(item) {
  const candidates = [
    item?.videoSize,
    item?.params,
    item?.movie?.params,
    item?.movieEntity?.params,
    item?._videoItem?.params
  ];

  for (const candidate of candidates) {
    const width = Number(candidate?.viewBoxWidth ?? candidate?.width);
    const height = Number(candidate?.viewBoxHeight ?? candidate?.height);
    if (Number.isFinite(width) && Number.isFinite(height) && width > 0 && height > 0) {
      return { sourceWidth: width, sourceHeight: height };
    }
  }

  const directWidth = Number(item?.viewBoxWidth ?? item?.width);
  const directHeight = Number(item?.viewBoxHeight ?? item?.height);
  if (Number.isFinite(directWidth) && Number.isFinite(directHeight) && directWidth > 0 && directHeight > 0) {
    return { sourceWidth: directWidth, sourceHeight: directHeight };
  }

  return undefined;
}

async function decodeSvgaInfo(source) {
  ensurePakoLibrary();
  const response = await fetch(source);
  if (!response.ok) {
    throw new Error(`无法读取 SVGA 文件。/ Unable to fetch SVGA (${response.status})`);
  }

  const compressedBytes = new Uint8Array(await response.arrayBuffer());
  const inflatedBytes = window.pako.inflate(compressedBytes);
  const movie = parseMessage(inflatedBytes);
  const paramsField = movie.find((field) => field.number === 2 && field.wireType === 2);
  const params = paramsField?.bytes ? parseMessage(paramsField.bytes) : [];

  const widthField = params.find((field) => field.number === 1 && field.wireType === 5);
  const heightField = params.find((field) => field.number === 2 && field.wireType === 5);
  const fpsField = params.find((field) => field.number === 3 && field.wireType === 0);
  const framesField = params.find((field) => field.number === 4 && field.wireType === 0);
  const width = widthField ? readFloat32(widthField.bytes, 0) : undefined;
  const height = heightField ? readFloat32(heightField.bytes, 0) : undefined;

  const images = await Promise.all(movie
    .filter((field) => field.number === 3 && field.wireType === 2)
    .map(async (field, index) => {
      const entry = parseMessage(field.bytes);
      const keyField = entry.find((item) => item.number === 1 && item.wireType === 2);
      const valueField = entry.find((item) => item.number === 2 && item.wireType === 2);
      const key = keyField ? decodeUtf8(keyField.bytes) : `image_${index}`;
      const byteSize = valueField?.bytes?.length ?? 0;
      const previewUrl = valueField?.bytes ? URL.createObjectURL(new Blob([valueField.bytes], { type: "image/png" })) : undefined;
      const size = valueField?.bytes ? await readImageDimensions(valueField.bytes) : {};
      const warnings = buildImageWarnings({ ...size, byteSize });
      return { key, name: key, byteSize, previewUrl, ...size, warnings, referenceCount: 0 };
    }));

  const imageByKey = new Map(images.map((image) => [image.key, image]));
  const sprites = movie
    .filter((field) => field.number === 4 && field.wireType === 2)
    .map((field, index) => {
      const sprite = parseMessage(field.bytes);
      const imageKeyField = sprite.find((item) => item.number === 1 && item.wireType === 2);
      const imageKey = imageKeyField ? decodeUtf8(imageKeyField.bytes) : `sprite_${index}`;
      const frames = sprite.filter((item) => item.number === 2 && item.wireType === 2);
      const image = imageByKey.get(imageKey);
      if (image) image.referenceCount += 1;
      return {
        name: imageKey || `sprite_${index}`,
        imageKey,
        type: imageKey ? "image sprite" : "sprite",
        frameCount: frames.length,
        width: image?.width,
        height: image?.height,
        byteSize: image?.byteSize,
        previewUrl: image?.previewUrl,
        hasImage: Boolean(image),
        warnings: image ? image.warnings : ["资源缺失 / missing resource"]
      };
    });

  const pixelMemory = images.reduce((sum, image) => {
    if (!image.width || !image.height) return sum;
    return sum + image.width * image.height * 4;
  }, 0);
  const assetBytes = images.reduce((sum, image) => sum + image.byteSize, 0);

  return {
    sourceWidth: Number.isFinite(width) && width > 0 ? width : undefined,
    sourceHeight: Number.isFinite(height) && height > 0 ? height : undefined,
    fps: fpsField?.value,
    frameCount: framesField?.value,
    imageCount: images.length,
    spriteCount: sprites.length,
    images,
    sprites,
    memoryBytes: pixelMemory + assetBytes
  };
}

function parseMessage(bytes) {
  const fields = [];
  let offset = 0;
  while (offset < bytes.length) {
    const tag = readVarint(bytes, offset);
    offset = tag.offset;
    const fieldNumber = tag.value >> 3;
    const wireType = tag.value & 7;

    if (wireType === 0) {
      const value = readVarint(bytes, offset);
      fields.push({ number: fieldNumber, wireType, value: value.value });
      offset = value.offset;
    } else if (wireType === 1) {
      fields.push({ number: fieldNumber, wireType, bytes: bytes.slice(offset, offset + 8) });
      offset += 8;
    } else if (wireType === 2) {
      const length = readVarint(bytes, offset);
      offset = length.offset;
      fields.push({ number: fieldNumber, wireType, bytes: bytes.slice(offset, offset + length.value) });
      offset += length.value;
    } else if (wireType === 5) {
      fields.push({ number: fieldNumber, wireType, bytes: bytes.slice(offset, offset + 4) });
      offset += 4;
    } else {
      throw new Error(`不支持的 protobuf wire type。/ Unsupported protobuf wire type: ${wireType}`);
    }
  }
  return fields;
}

function readVarint(bytes, offset) {
  let value = 0;
  let shift = 0;
  let cursor = offset;
  while (cursor < bytes.length) {
    const byte = bytes[cursor];
    value |= (byte & 0x7f) << shift;
    cursor += 1;
    if ((byte & 0x80) === 0) {
      return { value, offset: cursor };
    }
    shift += 7;
  }
  throw new Error("protobuf varint 无效。/ Invalid protobuf varint.");
}

function readFloat32(bytes, offset) {
  return new DataView(bytes.buffer, bytes.byteOffset + offset, 4).getFloat32(0, true);
}

function decodeUtf8(bytes) {
  return new TextDecoder().decode(bytes);
}

function readImageDimensions(bytes) {
  return new Promise((resolve) => {
    const blob = new Blob([bytes]);
    const url = URL.createObjectURL(blob);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve({ width: image.naturalWidth, height: image.naturalHeight });
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      resolve({});
    };
    image.src = url;
  });
}

function buildImageWarnings(image) {
  const warnings = [];
  if ((image.width ?? 0) > 1024 || (image.height ?? 0) > 1024) {
    warnings.push("尺寸过大 / large dimensions");
  }
  if ((image.byteSize ?? 0) > 512 * 1024) {
    warnings.push("体积过大 / large file");
  }
  if (image.width && image.height && image.byteSize > image.width * image.height * 3) {
    warnings.push("疑似未压缩 / possibly uncompressed");
  }
  return warnings;
}

async function loadSvga(slotKey, source = paths.svga, options = {}) {
  ensureSvgaLibrary();
  const slot = players[slotKey];
  clearError();
  resetSlotMediaState(slot);
  slot.source = source;
  slot.report = options.report;
  slot.inspectionStatus = "loading";
  const inspectionRequestId = ++slot.inspectionRequestId;
  slot.parseStatus = "loading";
  slot.renderStatus = "loading";
  slot.panel.classList.add("isLoading");
  setStatus(slot.status, "loading");
  const phaseState = { file: "done" };
  setSlotLoadingPhase(slot, "read", phaseState);
  if (slot.slotName === "A") applyPrimaryLoadingCopy(options.fileName);
  updateButtons();
  renderInfoPanel();
  addLog("info", `开始解析 SVGA：${options.fileName ?? source} / Parsing SVGA`);
  if (options.loadingHoldMs) {
    await delay(options.loadingHoldMs);
  }

  loadAvatarFrameInspectionReport(source, options.fileName ?? `SVGA ${slot.slotName}`)
    .then((report) => {
      if (slot.inspectionRequestId !== inspectionRequestId) return;
      slot.inspectionReport = report;
      slot.inspectionStatus = "success";
      phaseState.check = "done";
      setSlotLoadingPhase(slot, slot.parseStatus === "loading" ? "parse" : undefined, phaseState);
      renderInfoPanel();
      addLog("success", `生产规范检查完成：${report.passed ? "通过" : "未通过"} / Spec check completed`);
    })
    .catch((error) => {
      if (slot.inspectionRequestId !== inspectionRequestId) return;
      slot.inspectionStatus = "error";
      phaseState.check = "error";
      setSlotLoadingPhase(slot, slot.parseStatus === "loading" ? "parse" : undefined, phaseState);
      renderInfoPanel();
      addLog("warning", `生产规范检查暂不可用，不影响播放。/ Spec check unavailable: ${error.message}`);
    });

  const decodedInfoPromise = decodeSvgaInfo(source).catch((error) => {
    phaseState.read = "done";
    setSlotLoadingPhase(slot, "parse", phaseState);
    addLog("error", `SVGA 元数据解析失败 / Metadata parse failed: ${error.message}`);
    return undefined;
  });
  const parser = new window.SVGA.Parser(`#${slot.canvas.id}`);

  return new Promise((resolve, reject) => {
    parser.load(
      source,
      async (loadedVideoItem) => {
        const decodedInfo = await decodedInfoPromise;
        const playerSize = extractSizeFromVideoItem(loadedVideoItem);
        const reportMetrics = extractReportMetrics(slot.report);
        phaseState.read = "done";
        phaseState.parse = "done";
        setSlotLoadingPhase(slot, slot.inspectionStatus === "loading" ? "check" : undefined, phaseState);
        slot.videoItem = loadedVideoItem;
        slot.parseStatus = decodedInfo ? "success" : "warning";
        slot.metrics = {
          ...decodedInfo,
          ...playerSize,
          ...reportMetrics,
          fileName: options.fileName ?? `SVGA ${slot.slotName}`,
          fileSizeBytes: options.fileSizeBytes ?? reportMetrics.fileSizeBytes,
          sourceWidth: playerSize?.sourceWidth ?? decodedInfo?.sourceWidth,
          sourceHeight: playerSize?.sourceHeight ?? decodedInfo?.sourceHeight
        };
        slot.metrics.durationSeconds = slot.metrics.durationSeconds
          ?? (slot.metrics.fps && slot.metrics.frameCount ? slot.metrics.frameCount / slot.metrics.fps : undefined);

        if (!slot.metrics.sourceWidth || !slot.metrics.sourceHeight) {
          setStatus(slot.status, "loaded");
          showError(`SVGA 已加载，但无法读取 viewBox 尺寸。/ SVGA loaded, but viewBox size could not be read for player ${slot.slotName}.`);
        }

        refreshLayout();
        rebuildPlayer(slot);
        replaySlot(slot, false);
        slot.panel.classList.remove("isLoading");
        clearSlotLoadingPhase(slot);
        if (slot.slotName === "A") applyPrimaryEmptyCopy();
        refreshLayout();
        updateButtons();
        addLog("success", `SVGA 加载完成：${slot.metrics.fileName} / SVGA loaded`);
        resolve(slot);
      },
      (error) => {
        const loadError = new Error(`SVGA 文件加载失败：${error?.message ?? error}`);
        setSlotInvalidState(slot, `${loadError.message} / Unable to load SVGA file`);
        reject(loadError);
      }
    );
  });
}

async function loadAvatarFrameInspectionReport(source, fileName) {
  const sourceResponse = await fetch(source);
  if (!sourceResponse.ok) {
    throw new Error(`无法读取 SVGA：HTTP ${sourceResponse.status}`);
  }
  const bytes = await sourceResponse.arrayBuffer();
  const response = await fetch(`/api/avatar-frame-inspection-report?name=${encodeURIComponent(fileName)}`, {
    method: "POST",
    headers: { "content-type": "application/octet-stream" },
    body: bytes
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.error ?? `HTTP ${response.status}`);
  }
  return payload;
}

function normalizeJobPath(value) {
  const normalized = String(value ?? "").replace(/^\/+|\/+$/g, "");
  if (!/^jobs\/[a-zA-Z0-9._-]+$/.test(normalized)) {
    throw new Error("job 参数无效，应使用 jobs/<job-name> 相对路径。/ Invalid job query path.");
  }
  return normalized;
}

async function loadJobOutput(jobValue) {
  const jobPath = normalizeJobPath(jobValue);
  const jobName = jobPath.split("/").at(-1);
  const basePath = `/${jobPath}`;
  const missing = [];

  try {
    defaultReport = await loadReport(`${basePath}/output/report.json`);
    renderReport(defaultReport);
  } catch (error) {
    missing.push("output/report.json");
    renderReport(undefined);
    addLog("error", error.message);
  }

  try {
    const response = await fetch(`${basePath}/output/svga-map.json`);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    defaultSvgaMap = await response.json();
    addLog("success", `已加载映射：${defaultSvgaMap.layers?.length ?? 0} 个图层 / SVGA map loaded`);
  } catch (error) {
    missing.push("output/svga-map.json");
    addLog("warning", `无法加载 svga-map.json。/ Unable to load svga-map.json: ${error.message}`);
  }

  setAppMode("exportReview");
  const svgaRelativePath = defaultReport?.output?.svga ?? `output/${jobName}.svga`;
  const svgaUrl = `${basePath}/${svgaRelativePath}`;
  try {
    const response = await fetch(svgaUrl, { method: "HEAD" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    await loadSvga("a", svgaUrl, {
      fileName: svgaRelativePath.split("/").at(-1),
      fileSizeBytes: defaultReport?.svga?.sizeBytes ?? (Number(response.headers.get("content-length")) || undefined),
      report: defaultReport
    });
  } catch (error) {
    missing.push(svgaRelativePath);
    addLog("error", `无法加载导出 SVGA。/ Unable to load exported SVGA: ${error.message}`);
  }

  const previewCandidates = [
    {
      path: defaultReport?.previewOutputs?.webm ?? defaultReport?.output?.previewWebm ?? "output/preview.webm",
      kind: "webm"
    },
    {
      path: defaultReport?.previewOutputs?.mp4 ?? defaultReport?.output?.previewMp4 ?? "output/preview.mp4",
      kind: "mp4"
    },
    {
      path: defaultReport?.previewOutputs?.gif ?? defaultReport?.output?.previewGif ?? "output/preview.gif",
      kind: "gif"
    }
  ];
  let referenceLoaded = false;
  for (const candidate of previewCandidates) {
    const previewUrl = `${basePath}/${candidate.path}`;
    try {
      const response = await fetch(previewUrl, { method: "HEAD" });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      await loadReference(previewUrl, {
        fileName: candidate.path.split("/").at(-1),
        fileSizeBytes: Number(response.headers.get("content-length")) || undefined,
        kind: candidate.kind
      });
      referenceLoaded = true;
      if (candidate.kind === "gif") {
        addLog("warning", "当前使用 GIF fallback；最终视觉验收请以真实 SVGA 播放为准。/ GIF fallback loaded.");
      } else {
        addLog("success", `已加载辅助预览：${candidate.path} / Auxiliary preview loaded`);
      }
      break;
    } catch (error) {
      addLog("warning", `${candidate.kind.toUpperCase()} 加载失败，尝试下一个格式：${candidate.path}。/ ${error.message}`);
    }
  }
  if (!referenceLoaded) {
    missing.push("output/preview.webm|preview.mp4|preview.gif");
  }

  if (missing.length > 0) {
    showError(`Job 输出不完整：${missing.join("、")}。/ Job output is incomplete.`);
  } else {
    addLog("success", `Job 验收资源加载完成：${jobName} / Job review output loaded`);
  }
}

function handleSvgaFile(file, slotKey) {
  const slot = players[slotKey];
  if (slot.objectUrl) {
    URL.revokeObjectURL(slot.objectUrl);
  }
  slot.objectUrl = URL.createObjectURL(file);
  addLog("info", "本地文件模式下浏览器不能自动读取同目录 report.json。/ Browser cannot auto-read sibling report.json for local files.");
  loadSvga(slotKey, slot.objectUrl, {
    fileName: file.name,
    fileSizeBytes: file.size,
    isDefault: false
  });
}

function delay(ms) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function waitFor(predicate, timeoutMs = 8000) {
  const startedAt = performance.now();
  return new Promise((resolve, reject) => {
    const tick = () => {
      if (predicate()) {
        resolve(true);
        return;
      }
      if (performance.now() - startedAt > timeoutMs) {
        reject(new Error("Timed out waiting for product smoke condition."));
        return;
      }
      window.setTimeout(tick, 80);
    };
    tick();
  });
}

async function captureArtifact(scenario) {
  if (!shouldCaptureArtifacts || !electronBridge?.captureArtifact) return undefined;
  return electronBridge.captureArtifact(scenario);
}

const p6SmokeActionTrace = [];
let p6SmokeFixture = null;

const p6SmokeRegionContract = [
  ["shell", ".shell"],
  ["toolbar", ".toolbar"],
  ["brand", ".brand"],
  ["modeControl", ".modeControl"],
  ["actionRow", ".actionRow"],
  ["workspace", "#workspace"],
  ["svgaPanelA", "#svgaPanelA"],
  ["svgaPanelB", "#svgaPanelB"],
  ["referencePanel", "#referencePanel"],
  ["playerBarA", "#svgaPanelA .playerBar"],
  ["playerBarB", "#svgaPanelB .playerBar"],
  ["referencePlayerBar", "#referencePanel .playerBar"],
  ["syncBar", "#syncBar"],
  ["infoPanel", "#infoPanel"],
  ["logsPanel", "#logsPanel"],
  ["settingsModal", "#settingsModal"],
  ["assetPreviewModal", "#assetPreviewModal"],
  ["reportGrid", "#tab-overview .overviewGrid, #reportGrid"],
  ["errorBox", "#errorBox"],
  ["floatingRoot", "#floatingRoot"]
];

function p6SmokeControlValue(selector) {
  const target = p6SmokeTargetForSelector(selector);
  return {
    visible: target.visible,
    disabled: Boolean(target.node?.disabled),
    checked: Boolean(target.node?.checked)
  };
}

function p6SmokeTargetForSelector(selector) {
  if (selector === "body") {
    return {
      node: document.body,
      visible: true,
      rect: { x: 0, y: 0, width: innerWidth, height: innerHeight }
    };
  }
  const nodes = selector.split(",")
    .map((part) => document.querySelector(part.trim()))
    .filter(Boolean);
  const visibleNode = nodes.find((node) => isElementVisible(node)) ?? nodes[0] ?? null;
  const rect = visibleNode?.getBoundingClientRect();
  return {
    node: visibleNode,
    visible: isElementVisible(visibleNode),
    rect: rect ? {
      x: Math.round(rect.x),
      y: Math.round(rect.y),
      width: Math.round(rect.width),
      height: Math.round(rect.height)
    } : null
  };
}

async function p6Sha256Text(value) {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function p6Sha256Bytes(bytes) {
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function collectP6SmokeSnapshot(stateId) {
  const regions = p6SmokeRegionContract.map(([id, selector]) => {
    const node = document.querySelector(selector);
    const rect = node?.getBoundingClientRect();
    return {
      id,
      selector,
      present: Boolean(node),
      visible: isElementVisible(node),
      textSample: (node?.innerText ?? "").replace(/\s+/g, " ").trim().slice(0, 160),
      rect: rect ? {
        x: Math.round(rect.x),
        y: Math.round(rect.y),
        width: Math.round(rect.width),
        height: Math.round(rect.height)
      } : null
    };
  });
  const controls = [...document.querySelectorAll("button,input,label,select,textarea,[role=button],[role=menuitemradio],[role=status],[aria-live],[data-value],[data-tab],[data-preview-image-key]")]
    .map((node) => {
      const rect = node.getBoundingClientRect();
      return {
        tag: node.tagName.toLowerCase(),
        id: node.id || null,
        role: node.getAttribute("role"),
        type: node.getAttribute("type"),
        dataValue: node.dataset?.value ?? null,
        dataTab: node.dataset?.tab ?? null,
        dataPreviewImageKey: node.dataset?.previewImageKey ?? null,
        ariaExpanded: node.getAttribute("aria-expanded"),
        text: (node.innerText || node.getAttribute("aria-label") || node.getAttribute("title") || "").replace(/\s+/g, " ").trim().slice(0, 120),
        present: true,
        visible: isElementVisible(node),
        hidden: Boolean(node.hidden),
        disabled: Boolean(node.disabled),
        checked: Boolean(node.checked),
        rect: {
          x: Math.round(rect.x),
          y: Math.round(rect.y),
          width: Math.round(rect.width),
          height: Math.round(rect.height)
        }
      };
    });
  const activeMode = modeDropdownTrigger?.textContent?.replace(/\s+/g, " ").trim() ?? "unknown";
  const panel = !infoPanel.hidden ? "info" : !logsPanel.hidden ? "logs" : "none";
  const modal = !settingsModal.hidden ? "settingsModal" : !assetPreviewModal.hidden ? "assetPreviewModal" : "none";
  return {
    stateId,
    viewport: { width: innerWidth, height: innerHeight },
    devicePixelRatio,
    playbackTimeMs: Math.round((players.a.timeDisplay?.textContent?.match(/[0-9.]+/)?.[0] ?? 0) * 1000),
    mode: activeMode,
    panel,
    modal,
    bodyTextSample: document.body.innerText.replace(/\s+/g, " ").trim().slice(0, 600),
    regions,
    controls
  };
}

function p6VisibleIds(entries = []) {
  return entries
    .filter((entry) => entry.visible === true)
    .map((entry) => entry.id ?? entry.selector ?? entry.text)
    .filter(Boolean)
    .sort();
}

async function recordP6SmokeAction(action, runAction, waitForState) {
  const target = p6SmokeTargetForSelector(action.selector);
  await runAction();
  await waitForState?.();
  const proof = collectRenderedStateProof(action.expectedState);
  p6SmokeActionTrace.push({
    ...action,
    source: "desktop-product-smoke-input",
    stateReached: proof.passed ? action.expectedState : null,
    targetRect: target.rect,
    controlValue: p6SmokeControlValue(action.selector),
    stateProofPassed: proof.passed,
    stateProofFailures: proof.failures
  });
}

async function buildP6SmokeInteractionTrace() {
  const finalSnapshot = collectP6SmokeSnapshot("recovered-from-invalid");
  return {
    schemaVersion: 1,
    host: "desktop",
    fixture: p6SmokeFixture,
    context: {
      viewportCss: finalSnapshot.viewport,
      devicePixelRatio: finalSnapshot.devicePixelRatio,
      playbackTimeMs: finalSnapshot.playbackTimeMs,
      mode: finalSnapshot.mode,
      panel: finalSnapshot.panel,
      modal: finalSnapshot.modal,
      controls: Object.fromEntries(finalSnapshot.controls.map((control) => [
        control.id ?? control.dataValue ?? control.dataTab ?? control.text,
        {
          visible: control.visible === true,
          disabled: control.disabled === true,
          checked: control.checked === true
        }
      ]).filter(([key]) => key))
    },
    actionTrace: p6SmokeActionTrace,
    finalStateDigest: await p6Sha256Text(JSON.stringify({
      host: "desktop",
      stateId: finalSnapshot.stateId,
      regions: p6VisibleIds(finalSnapshot.regions),
      controls: p6VisibleIds(finalSnapshot.controls),
      text: finalSnapshot.bodyTextSample
    })),
    visibleRegions: p6VisibleIds(finalSnapshot.regions),
    visibleControls: p6VisibleIds(finalSnapshot.controls),
    screenshots: [
      { stateId: "recovered-from-invalid", path: ".artifacts/product/P6/desktop-recovered-from-invalid.png" }
    ],
    failures: [],
    generatedAt: new Date().toISOString()
  };
}

function resourcesAreLocal() {
  return performance.getEntriesByType("resource").every((entry) => {
    const name = String(entry.name);
    if (name.startsWith("blob:") || name.startsWith("data:")) return true;
    try {
      return new globalThis.URL(name, location.href).origin === location.origin;
    } catch {
      return false;
    }
  });
}

function cspAllowsOnlyLocalWasm() {
  const content = document.querySelector("meta[name='auto-svga-csp']")?.content ?? "";
  return content.includes("script-src 'self' 'wasm-unsafe-eval'")
    && !content.includes("'unsafe-eval'")
    && !/https?:\/\//.test(content);
}

function canvasIsNonBlank(slot = players.a) {
  const canvas = slot.canvas.querySelector("canvas");
  if (!(canvas instanceof HTMLCanvasElement)) return false;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) return false;
  const { width, height } = canvas;
  if (!width || !height) return false;
  const sample = context.getImageData(0, 0, width, height).data;
  for (let index = 3; index < sample.length; index += 4) {
    if (sample[index] !== 0) return true;
  }
  return false;
}

function rectFor(node) {
  if (!node) return null;
  const rect = node.getBoundingClientRect();
  return {
    x: Math.round(rect.x),
    y: Math.round(rect.y),
    width: Math.round(rect.width),
    height: Math.round(rect.height),
    top: Math.round(rect.top),
    right: Math.round(rect.right),
    bottom: Math.round(rect.bottom),
    left: Math.round(rect.left)
  };
}

function isRectVisible(rect) {
  return Boolean(rect && rect.width > 0 && rect.height > 0);
}

function isElementVisible(node) {
  if (!node || node.hidden) return false;
  const rect = rectFor(node);
  const style = getComputedStyle(node);
  return isRectVisible(rect)
    && style.display !== "none"
    && style.visibility !== "hidden"
    && Number(style.opacity ?? 1) > 0.01;
}

function compactText(node) {
  return node?.textContent?.replace(/\s+/g, " ").trim() ?? "";
}

function elementLabel(node) {
  if (!node) return "none";
  const id = node.id ? `#${node.id}` : "";
  const classes = node.classList?.length ? `.${Array.from(node.classList).join(".")}` : "";
  return `${node.tagName?.toLowerCase?.() ?? "unknown"}${id}${classes}`;
}

function collectRenderedStateProof(state) {
  const normalizedState = {
    "invalid-error-state": "invalid",
    "local-compare-loaded": "local-compare-loaded",
    "space-sync-toggle": "synchronized-playback-toggled-by-space",
    "responsive-export-review-900x720": "responsive-export-review-loaded-at-900-x-720"
  }[state] ?? state;
  const stage = players.a.panel?.querySelector(".stage");
  const primaryEmptyOverlay = players.a.panel?.querySelector(".centerEmptyState");
  const secondaryEmptyOverlay = players.b.panel?.querySelector(".centerEmptyState");
  const invalidOverlay = errorBox;
  const overlay = normalizedState === "invalid" ? invalidOverlay : primaryEmptyOverlay;
  const button = normalizedState === "invalid" ? primaryEmptyFileButton : overlay?.querySelector("button");
  const stageRect = rectFor(stage);
  const canvasRect = rectFor(players.a.canvas);
  const overlayRect = rectFor(overlay);
  const overlayStyle = overlay ? getComputedStyle(overlay) : {};
  const canvasStyle = getComputedStyle(players.a.canvas);
  const primaryActionRect = rectFor(button);
  const primaryHeaderActionRect = rectFor(primaryFileButton);
  const centerX = overlayRect ? overlayRect.left + overlayRect.width / 2 : 0;
  const centerY = overlayRect ? overlayRect.top + overlayRect.height / 2 : 0;
  const topElement = overlayRect ? document.elementFromPoint(centerX, centerY) : null;
  const overlayVisible = overlayStyle.display !== "none"
    && overlayStyle.visibility !== "hidden"
    && Number(overlayStyle.opacity ?? 1) > 0.01
    && isRectVisible(overlayRect);
  const overlayInsideStage = normalizedState === "invalid" || Boolean(stageRect && overlayRect
    && overlayRect.left >= stageRect.left
    && overlayRect.right <= stageRect.right
    && overlayRect.top >= stageRect.top
    && overlayRect.bottom <= stageRect.bottom);
  const overlayNotOccluded = !overlayVisible
    || overlay?.contains(topElement)
    || overlayStyle.pointerEvents === "none"
    || normalizedState === "invalid";
  const loadingPhaseItems = Array.from(players.a.loadingPhases ?? []).map((item) => ({
    phase: item.dataset.loadingPhase,
    text: item.textContent?.replace(/\s+/g, " ").trim() ?? "",
    active: item.classList.contains("isActive"),
    done: item.classList.contains("isDone"),
    error: item.classList.contains("isError")
  }));
  const loadingPhaseList = players.a.panel?.querySelector(".loadingPhaseList");
  const loadingPhaseStyle = loadingPhaseList ? getComputedStyle(loadingPhaseList) : {};
  const loadingActivePhases = loadingPhaseItems.filter((item) => item.active).map((item) => item.phase);
  const loadingSourceLabel = compactText(svgaEmptySubtitleA);
  const reportText = reportGrid.textContent?.replace(/\s+/g, " ").trim() ?? "";
  const filePillText = svgaFilePillA.textContent?.replace(/\s+/g, " ").trim() ?? "";
  const overviewText = compactText(document.querySelector("#tab-overview"));
  const assetText = compactText(document.querySelector("#tab-assets"));
  const syncButtonPressed = syncPlayControl.getAttribute("aria-pressed") === "true";
  const modeMenuVisible = isElementVisible(modeDropdownMenu) && !modeDropdownMenu.hidden;
  const infoPanelVisible = isElementVisible(infoPanel) && !infoPanel.classList.contains("isHidden");
  const logsPanelVisible = isElementVisible(logsPanel) && !logsPanel.classList.contains("isHidden");
  const settingsVisible = isElementVisible(settingsModal) && !settingsModal.hidden;
  const assetPreviewVisible = isElementVisible(assetPreviewModal) && !assetPreviewModal.hidden;
  const comparePanelVisible = isElementVisible(players.b.panel) && !players.b.panel.classList.contains("isHidden");
  const referencePanelVisible = isElementVisible(referenceState.panel) && !referenceState.panel.classList.contains("isHidden");
  const syncBarVisible = isElementVisible(syncBar) && !syncBar.classList.contains("isHidden");
  const secondaryEmptyVisible = isElementVisible(secondaryEmptyOverlay);
  const playerBarBVisible = isElementVisible(players.b.panel?.querySelector(".playerBar"));
  const referencePlayerBarVisible = isElementVisible(referenceState.panel?.querySelector(".playerBar"));
  const overviewPanelVisible = isElementVisible(document.querySelector("#tab-overview")) && !document.querySelector("#tab-overview")?.classList.contains("isHidden");
  const assetsPanelVisible = isElementVisible(document.querySelector("#tab-assets")) && !document.querySelector("#tab-assets")?.classList.contains("isHidden");
  const reportOverviewVisible = isElementVisible(document.querySelector("#tab-overview .overviewGrid, #reportGrid"));
  const statusAnnouncementText = compactText(statusAnnouncer);
  const staleFieldPattern = /文件体积|fileSizeBytes|内存占用|memoryUsage|画布尺寸|canvasSize|播放时长|duration|帧率|fps|图层数量|spriteCount|图片资源|imageCount|文件名|fileName/;
  const staleReportPattern = /Motion Asset Audit|动效诊断|specReportSection|auditReportSection|fileSizeBytes|imageCount|spriteCount|canvasSize|durationSeconds|fps/;
  const primaryActionVisible = Boolean(button)
    && isRectVisible(primaryActionRect)
    && getComputedStyle(button).display !== "none"
    && getComputedStyle(button).visibility !== "hidden"
    && Number(getComputedStyle(button).opacity) > 0.01;
  const primaryHeaderActionVisible = Boolean(primaryFileButton)
    && isRectVisible(primaryHeaderActionRect)
    && getComputedStyle(primaryFileButton).display !== "none"
    && getComputedStyle(primaryFileButton).visibility !== "hidden"
    && Number(getComputedStyle(primaryFileButton).opacity) > 0.01;
  const renderedText = overlay?.textContent?.replace(/\s+/g, " ").trim() ?? "";
  const failures = [];
  if (normalizedState === "empty" || normalizedState === "local-empty") {
    if (!overlayVisible) failures.push("empty overlay is not visible");
    if (!renderedText.includes("拖拽 SVGA 文件到此处")) failures.push("empty text missing");
    if (!primaryActionVisible) failures.push("empty primary action not visible");
  }
  if (normalizedState === "loading") {
    if (players.a.parseStatus !== "loading") failures.push("loading parse status missing");
    if (players.a.renderStatus !== "loading") failures.push("loading render status missing");
    if (!players.a.panel.classList.contains("isLoading")) failures.push("loading card class missing");
    if (!renderedText.includes("正在加载 SVGA 文件")) failures.push("loading text is not distinct from empty");
    if (loadingPhaseStyle.display === "none") failures.push("loading phase list is hidden");
    if (!loadingActivePhases.length) failures.push("loading phase has no active step");
    if (!loadingSourceLabel || loadingSourceLabel === "或选择本地文件") failures.push("loading source label missing");
    if (primaryActionVisible) failures.push("loading empty CTA should be hidden");
    if (primaryHeaderActionVisible) failures.push("loading header choose button should be hidden");
    if (!["file", "read", "parse", "check"].every((phase) => loadingPhaseItems.some((item) => item.phase === phase))) {
      failures.push("loading phases missing");
    }
  }
  if (normalizedState === "playing") {
    if (!players.a.videoItem) failures.push("playing SVGA is not loaded");
    if (!players.a.isPlaying) failures.push("primary playback is not playing");
    if (!canvasIsNonBlank(players.a)) failures.push("playing canvas is blank");
  }
  if (normalizedState === "paused") {
    if (!players.a.videoItem) failures.push("paused SVGA is not loaded");
    if (players.a.isPlaying) failures.push("primary playback is still playing");
    if (!canvasIsNonBlank(players.a)) failures.push("paused canvas is blank");
  }
  if (normalizedState === "loaded" || normalizedState === "export-review-loaded") {
    if (overlayVisible) failures.push("loaded overlay should be hidden");
    if (!canvasIsNonBlank(players.a)) failures.push("loaded canvas is blank");
  }
  if (normalizedState === "latest-artifact-loaded") {
    if (!latestArtifactGroup) failures.push("latest artifact group is not recorded");
    if (modeSelect.value !== "exportReview") failures.push("latest artifact did not enter export review mode");
    if (!players.a.videoItem) failures.push("latest artifact SVGA is not loaded");
    if (!canvasIsNonBlank(players.a)) failures.push("latest artifact canvas is blank");
  }
  if (normalizedState === "reference-media-loaded") {
    if (modeSelect.value !== "exportReview") failures.push("reference media did not enter export review mode");
    if (!referencePanelVisible) failures.push("reference panel is not visible");
    if (!referenceState.metrics) failures.push("reference media metrics are missing");
    if (!referenceState.panel.classList.contains("hasMedia")) failures.push("reference media is not marked loaded");
    if (!referencePlayerBarVisible) failures.push("reference player bar is not visible");
  }
  if (normalizedState === "invalid") {
    if (!overlayVisible) failures.push("invalid error box is not visible");
    if (!/文件类型不支持|加载失败|Unable|Unsupported|failed/i.test(renderedText)) {
      failures.push("invalid product message missing");
    }
    if (players.a.metrics) failures.push("invalid metadata still present");
    if (players.a.inspectionReport) failures.push("invalid inspection still present");
    if (players.a.canvas.children.length > 0) failures.push("invalid canvas children still present");
    if (!svgaFilePillA.hidden || filePillText) failures.push("invalid file badge still visible");
    if (staleReportPattern.test(reportText)) failures.push("invalid report still visible");
    if (staleFieldPattern.test(overviewText)) failures.push("invalid overview metadata still visible");
    if (document.querySelector("#tab-overview .status-ready")) failures.push("invalid ready badge still visible");
  }
  if (normalizedState === "recovered-from-invalid") {
    if (!errorBox.hidden || compactText(errorBox)) failures.push("recovery left invalid error visible");
    if (!players.a.videoItem) failures.push("recovered SVGA is not loaded");
    if (!players.a.metrics) failures.push("recovered metadata is missing");
    if (!players.a.inspectionReport) failures.push("recovered inspection is missing");
    if (!canvasIsNonBlank(players.a)) failures.push("recovered canvas is blank");
    if (staleReportPattern.test(reportText) && !players.a.report) failures.push("recovery report state is inconsistent");
    if (document.querySelector("#tab-overview .status-error")) failures.push("recovery still shows an error badge");
  }
  if (normalizedState === "mode-menu-open") {
    if (!modeMenuVisible) failures.push("mode menu is not visible");
    if (modeDropdownTrigger.getAttribute("aria-expanded") !== "true") failures.push("mode trigger is not expanded");
    if (!floatingRoot.contains(modeDropdownMenu)) failures.push("mode menu is not mounted in floating root");
  }
  if (normalizedState === "local-compare-empty") {
    if (!isCompareActive()) failures.push("compare mode is not active");
    if (!comparePanelVisible) failures.push("secondary panel is not visible");
    if (!secondaryEmptyVisible) failures.push("secondary empty state is not visible");
    if (!isElementVisible(secondaryEmptyFileButton)) failures.push("secondary file controls are not reachable");
    if (!syncBarVisible) failures.push("sync bar is not visible for local compare");
  }
  if (normalizedState === "local-compare-loaded") {
    if (!isCompareActive()) failures.push("compare mode is not active");
    if (!comparePanelVisible) failures.push("secondary panel is not visible");
    if (!players.b.videoItem) failures.push("secondary SVGA is not loaded");
    if (!canvasIsNonBlank(players.b)) failures.push("secondary canvas is blank");
    if (!playerBarBVisible) failures.push("secondary player bar is not visible");
  }
  if (normalizedState === "export-review-loaded") {
    if (modeSelect.value !== "exportReview") failures.push("export review mode is not active");
    if (!referencePanelVisible) failures.push("reference panel is not visible");
    if (!referencePlayerBarVisible) failures.push("reference player bar is not visible");
    if (!syncBarVisible) failures.push("sync bar is not visible");
  }
  if (normalizedState === "info-overview-open") {
    if (!infoPanelVisible) failures.push("info panel is not visible");
    if (!overviewPanelVisible) failures.push("overview tab is not visible");
    if (!reportOverviewVisible) failures.push("report overview grid is not visible");
  }
  if (normalizedState === "info-assets-open") {
    if (!infoPanelVisible) failures.push("info panel is not visible");
    if (!assetsPanelVisible) failures.push("assets tab is not visible");
    if (!/资源|Assets|全部|图片|序列帧/.test(assetText)) failures.push("assets content is not reachable");
  }
  if (normalizedState === "logs-open") {
    if (!logsPanelVisible) failures.push("logs panel is not visible");
    if (!isElementVisible(fullLogsContent)) failures.push("logs content is not visible");
  }
  if (normalizedState === "settings-open") {
    if (!settingsVisible) failures.push("settings modal is not visible");
    if (!isElementVisible(settingsCloseButton)) failures.push("settings close control is not visible");
  }
  if (normalizedState === "accessibility-toggles-on") {
    if (!reduceMotionToggle.checked || !document.documentElement.classList.contains("reduceMotion")) failures.push("reduce motion is not enabled");
    if (!reduceBlurToggle.checked || !document.documentElement.classList.contains("reduceBlur")) failures.push("reduce blur is not enabled");
  }
  if (normalizedState === "settings-closed-by-escape") {
    if (!settingsModal.hidden) failures.push("settings modal is still open");
    if (activeSidePanel && !logsPanelVisible && !infoPanelVisible) failures.push("side panel state is inconsistent after Escape");
  }
  if (normalizedState === "synchronized-playback-toggled-by-space") {
    if (!syncBarVisible) failures.push("sync bar is not visible");
    if (!syncIsPlaying || !syncButtonPressed) failures.push("synchronized playback is not active");
  }
  if (normalizedState === "asset-preview-modal-open") {
    if (!assetPreviewVisible) failures.push("asset preview modal is not visible");
    if (!assetPreviewImage.getAttribute("src")) failures.push("asset preview image is missing");
    if (!compactText(assetPreviewDetails)) failures.push("asset preview details are missing");
  }
  if (normalizedState === "responsive-export-review-loaded-at-900-x-720") {
    if (modeSelect.value !== "exportReview") failures.push("responsive state is not in export review mode");
    if (!isElementVisible(workspace)) failures.push("workspace is not visible");
    if (!syncBarVisible) failures.push("sync controls are not reachable");
  }
  return {
    state: normalizedState,
    requestedState: state,
    stageRect,
    canvasRect,
    overlaySelector: normalizedState === "invalid" ? "#errorBox" : ".centerEmptyState",
    overlayRect,
    overlayDisplay: overlayStyle.display ?? "unknown",
    overlayVisibility: overlayStyle.visibility ?? "unknown",
    overlayOpacity: overlayStyle.opacity ?? "unknown",
    overlayZIndex: overlayStyle.zIndex ?? "unknown",
    canvasZIndex: canvasStyle.zIndex,
    overlayVisible,
    overlayInsideStage,
    overlayNotOccluded,
    topElementAtOverlayCenter: elementLabel(topElement),
    renderedText,
    loadingPhaseDisplay: loadingPhaseStyle.display ?? "unknown",
    loadingPhases: loadingPhaseItems,
    loadingActivePhases,
    loadingSourceLabel,
    primaryActionText: button?.textContent?.replace(/\s+/g, " ").trim() ?? "",
    primaryActionRect,
    primaryActionVisible,
    primaryActionEnabled: button ? !button.disabled : false,
    primaryHeaderActionVisible,
    loadedCanvasNonBlank: ["loaded", "playing", "paused", "export-review-loaded", "latest-artifact-loaded", "recovered-from-invalid"].includes(normalizedState) ? canvasIsNonBlank(players.a) : false,
    recoveredFromInvalid: normalizedState === "recovered-from-invalid" ? errorBox.hidden && Boolean(players.a.videoItem && players.a.metrics) : null,
    latestArtifactLoaded: normalizedState === "latest-artifact-loaded" ? Boolean(latestArtifactGroup && players.a.videoItem) : null,
    referenceMediaLoaded: normalizedState === "reference-media-loaded" ? Boolean(referenceState.metrics && referenceState.panel.classList.contains("hasMedia")) : null,
    staleMetadataCleared: normalizedState === "invalid" ? !players.a.metrics && !staleFieldPattern.test(overviewText) : null,
    staleInspectionCleared: normalizedState === "invalid" ? !players.a.inspectionReport : null,
    staleCanvasCleared: normalizedState === "invalid" ? players.a.canvas.children.length === 0 : null,
    staleFileBadgeCleared: normalizedState === "invalid" ? svgaFilePillA.hidden && !filePillText : null,
    staleReportCleared: normalizedState === "invalid" ? !staleReportPattern.test(reportText) : null,
    staleReadyBadgeCleared: normalizedState === "invalid" ? !document.querySelector("#tab-overview .status-ready") : null,
    parserStatus: players.a.parseStatus,
    renderStatus: players.a.renderStatus,
    productState: {
      mode: modeSelect.value,
      compareActive: isCompareActive(),
      activeSidePanel,
      activeModal: activeModal?.id ?? null,
      modeMenuVisible,
      infoPanelVisible,
      logsPanelVisible,
      settingsVisible,
      assetPreviewVisible,
      comparePanelVisible,
      referencePanelVisible,
      syncBarVisible,
      syncIsPlaying,
      syncButtonPressed,
      reduceMotion: reduceMotionToggle.checked,
      reduceBlur: reduceBlurToggle.checked,
      statusAnnouncementText
    },
    passed: failures.length === 0,
    failures
  };
}

function installStateProbe() {
  window.__autoSvgaDesktopStateProbe = {
    collect: (state) => collectRenderedStateProof(state)
  };
}

async function waitForInspectionStatus(slot = players.a) {
  await waitFor(() => slot.inspectionStatus === "success" || slot.inspectionStatus === "error");
  return slot.inspectionStatus === "success";
}

async function smokeFileInput(bytes) {
  const file = new File([bytes], "synthetic-avatar-frame.svga", { type: "application/octet-stream" });
  handleSvgaFile(file, "a");
  await waitFor(() => Boolean(players.a.videoItem));
  return players.a.parseStatus === "success" || players.a.parseStatus === "warning";
}

async function smokeDragDrop(bytes) {
  const file = new File([bytes], "synthetic-avatar-frame-dropped.svga", { type: "application/octet-stream" });
  handleDroppedFile(file, "svga", "a");
  await waitFor(() => Boolean(players.a.videoItem));
  return players.a.parseStatus === "success" || players.a.parseStatus === "warning";
}

async function smokeErrorFile() {
  const file = new File([new Uint8Array([1, 2, 3, 4])], "not-svga.txt", { type: "text/plain" });
  handleDroppedFile(file, "svga", "a");
  await waitFor(() => !errorBox.hidden && /文件类型不支持|Unsupported/.test(errorBox.textContent));
  players.a.metrics = undefined;
  players.a.inspectionReport = undefined;
  return true;
}

const p6SmokeReferenceGifBase64 = "R0lGODlhAQABAPAAAP///wAAACH5BAAAAAAALAAAAAABAAEAAAICRAEAOw==";

function p6SmokeReferenceGifFile() {
  const binary = atob(p6SmokeReferenceGifBase64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return new File([bytes], "synthetic-reference.gif", { type: "image/gif" });
}

async function loadP6SmokeReferenceGif() {
  if (modeSelect.value !== "exportReview") setAppMode("exportReview");
  const file = p6SmokeReferenceGifFile();
  await loadReference(file, {
    fileName: file.name,
    fileSizeBytes: file.size,
    kind: "gif"
  });
  await waitFor(() => Boolean(referenceState.metrics) && referenceState.panel.classList.contains("hasMedia"));
}

function closeP6SmokeTransientUi() {
  closeDropdown(modeDropdownMenu);
  closeFitMenus();
  closeInfoPanel();
  closeFullLogs();
  if (!settingsModal.hidden) closeSettings();
  if (!assetPreviewModal.hidden) closeAssetPreview();
}

function ensureP6SmokeInfoPanel(tabName) {
  if (activeSidePanel === "info") setActiveSidePanel(null);
  openInfoPanel(tabName);
}

async function captureMotionTriplet(motionId, setup) {
  if (!shouldCaptureArtifacts) return;
  await setup?.();
  await delay(40);
  await captureArtifact(`desktop-motion-${motionId}-start`);
  await delay(190);
  await captureArtifact(`desktop-motion-${motionId}-mid`);
  await delay(230);
  await captureArtifact(`desktop-motion-${motionId}-end`);
}

async function captureP6MotionEvidence() {
  await captureMotionTriplet("emptyIconFloat", async () => {
    setAppMode("localPreview");
    if (compareToggle.checked) compareToggle.click();
    closeP6SmokeTransientUi();
  });
  await captureMotionTriplet("cardEnter", async () => {
    setAppMode("localPreview");
    if (!compareToggle.checked) compareToggle.click();
  });
  await captureMotionTriplet("fitMenuIn", async () => {
    closeFitMenus();
    localFitButton?.click();
  });
  await captureMotionTriplet("dropdownIn", async () => {
    closeP6SmokeTransientUi();
    modeDropdownTrigger?.click();
  });
  await captureMotionTriplet("sidePanelEnter", async () => {
    if (activeSidePanel === "info") setActiveSidePanel(null);
    openInfoPanel("overview");
  });
  await captureMotionTriplet("tabIn", async () => {
    ensureP6SmokeInfoPanel("assets");
    await delay(120);
    ensureP6SmokeInfoPanel("overview");
  });
  await captureMotionTriplet("drawerIn", async () => {
    if (activeSidePanel === "logs") setActiveSidePanel(null);
    openFullLogs();
  });
  await captureMotionTriplet("modalIn", async () => {
    if (!settingsModal.hidden) closeSettings();
    await delay(220);
    openSettings();
  });
  await captureMotionTriplet("overlayIn", async () => {
    if (!settingsModal.hidden) closeSettings();
    if (!assetPreviewModal.hidden) closeAssetPreview();
    openSettings();
  });
}

async function runProductSmoke() {
  if (!electronBridge?.reportSmokeResult) return;
  try {
    await delay(180);
    await captureArtifact("desktop-empty");
    const fixtureUrl = "/fixture/avatar-frame-smoke.svga";
    const bytes = new Uint8Array(await fetch(fixtureUrl).then((response) => {
      if (!response.ok) throw new Error(`Fixture fetch failed (${response.status})`);
      return response.arrayBuffer();
    }));
    p6SmokeActionTrace.length = 0;
    p6SmokeFixture = {
      sha256: await p6Sha256Bytes(bytes),
      displayName: "avatar_frame_basic.svga",
      sizeBytes: bytes.byteLength
    };
    const loadPromise = loadSvga("a", fixtureUrl, {
      fileName: "synthetic-avatar-frame.svga",
      fileSizeBytes: bytes.byteLength,
      loadingHoldMs: 350
    });
    await captureArtifact("desktop-loading");
    await loadPromise;
    await waitFor(() => Boolean(players.a.videoItem));
    await waitFor(() => canvasIsNonBlank(players.a));
    const canvasNonBlank = canvasIsNonBlank(players.a);
    const inspectionReport = await waitForInspectionStatus(players.a);
    await captureArtifact("desktop-playing");
    pauseSlot(players.a);
    await delay(180);
    await captureArtifact("desktop-paused");
    playSlot(players.a);
    await recordP6SmokeAction({
      id: "click-mode-dropdown-trigger-menu-opens",
      kind: "click",
      selector: "#modeDropdownTrigger",
      initialState: "local-empty",
      expectedState: "mode-menu-open"
    }, async () => {
      closeP6SmokeTransientUi();
      modeDropdownTrigger?.click();
    }, () => waitFor(() => !modeDropdownMenu.hidden && isElementVisible(modeDropdownMenu)));
    await captureArtifact("desktop-mode-menu-open");
    await recordP6SmokeAction({
      id: "select-export-review-mode-latest-artifact-loads",
      kind: "click",
      selector: "[data-value='exportReview']",
      initialState: "mode-menu-open",
      expectedState: "export-review-loaded"
    }, async () => {
      document.querySelector("[data-value='exportReview']")?.click();
    }, async () => {
      await waitFor(() => Boolean(latestArtifactGroup && players.a.videoItem));
      await waitFor(() => canvasIsNonBlank(players.a));
    });
    await captureArtifact("desktop-latest-artifact-loaded");
    await loadP6SmokeReferenceGif();
    await captureArtifact("desktop-reference-media-loaded");
    await recordP6SmokeAction({
      id: "open-info-panel-overview-visible",
      kind: "click",
      selector: "#infoPanelButton",
      initialState: "export-review-loaded",
      expectedState: "info-overview-open"
    }, async () => {
      if (activeSidePanel === "info") setActiveSidePanel(null);
      infoPanelButton?.click();
    }, async () => {
      await waitFor(() => activeSidePanel === "info");
      ensureP6SmokeInfoPanel("overview");
      await delay(120);
    });
    const auditPanel = Boolean(document.querySelector(".auditReportSection, .specReportSection"));
    await captureArtifact("desktop-loaded");
    await captureArtifact("smoke-loaded");
    await captureArtifact("desktop-1280x800");
    await captureArtifact("desktop-1440x900");
    await captureArtifact("desktop-inspection");
    await captureArtifact("desktop-info-overview-open");
    await recordP6SmokeAction({
      id: "switch-info-panel-tab-assets-visible",
      kind: "click",
      selector: ".tabButton[data-tab='assets']",
      initialState: "info-overview-open",
      expectedState: "info-assets-open"
    }, async () => {
      document.querySelector(".tabButton[data-tab='assets']")?.click();
    }, async () => {
      await waitFor(() => isElementVisible(document.querySelector("#tab-assets")));
      await delay(120);
    });
    await captureArtifact("desktop-info-assets-open");
    const previewButton = document.querySelector("#tab-assets [data-preview-image-key]:not(:disabled)");
    previewButton?.click();
    await waitFor(() => !assetPreviewModal.hidden && assetPreviewModal.classList.contains("isOpen"));
    await delay(280);
    await captureArtifact("desktop-asset-preview-modal-open");
    closeAssetPreview();
    await delay(240);
    closeP6SmokeTransientUi();
    await delay(160);
    await recordP6SmokeAction({
      id: "switch-diagnostics-to-runtime-logs",
      kind: "click",
      selector: "#logsButton",
      initialState: "info-assets-open",
      expectedState: "logs-open"
    }, async () => {
      logsButton?.click();
    }, async () => {
      await waitFor(() => activeSidePanel === "logs");
      await delay(120);
    });
    await captureArtifact("desktop-logs-open");
    await recordP6SmokeAction({
      id: "open-settings-modal",
      kind: "click",
      selector: "#settingsButton",
      initialState: "logs-open",
      expectedState: "settings-open"
    }, async () => {
      settingsButton?.click();
    }, async () => {
      await waitFor(() => !settingsModal.hidden);
      await delay(120);
    });
    await captureArtifact("desktop-settings-open");
    await recordP6SmokeAction({
      id: "enable-reduce-motion-and-reduce-blur-toggles",
      kind: "click",
      selector: "#reduceMotionToggle, #reduceBlurToggle",
      initialState: "settings-open",
      expectedState: "accessibility-toggles-on"
    }, async () => {
      if (!reduceMotionToggle.checked) reduceMotionToggle.click();
      if (!reduceBlurToggle.checked) reduceBlurToggle.click();
    }, async () => {
      await waitFor(() => reduceMotionToggle.checked && reduceBlurToggle.checked);
      await delay(120);
    });
    await captureArtifact("desktop-accessibility-toggles-on");
    await recordP6SmokeAction({
      id: "escape-closes-settings-before-side-panel",
      kind: "keyboard",
      selector: "body",
      initialState: "settings-open",
      expectedState: "settings-closed-by-escape"
    }, () => new Promise((resolve) => {
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
      window.setTimeout(resolve, 260);
    }), async () => {
      await waitFor(() => settingsModal.hidden);
    });
    await captureArtifact("desktop-settings-closed-by-escape");
    await recordP6SmokeAction({
      id: "space-toggles-synchronized-playback-in-export-review",
      kind: "keyboard",
      selector: "body",
      initialState: "export-review-loaded",
      expectedState: "synchronized-playback-toggled-by-space"
    }, () => new Promise((resolve) => {
      document.dispatchEvent(new KeyboardEvent("keydown", { key: " ", code: "Space", bubbles: true }));
      window.setTimeout(resolve, 260);
    }), async () => {
      await waitFor(() => syncPlayControl.getAttribute("aria-pressed") === "true");
    });
    await captureArtifact("desktop-synchronized-playback-toggled-by-space");
    await captureP6MotionEvidence();
    closeP6SmokeTransientUi();
    await delay(240);
    setAppMode("localPreview");
    await recordP6SmokeAction({
      id: "enable-local-compare-switch",
      kind: "click",
      selector: "#compareToggle",
      initialState: "local-empty",
      expectedState: "local-compare-empty"
    }, async () => {
      if (!compareToggle.checked) compareToggle.click();
    }, async () => {
      await waitFor(() => isCompareActive());
      await delay(120);
    });
    await captureArtifact("desktop-local-compare-empty");
    handleDroppedFile(new File([bytes.slice(0)], "synthetic-avatar-frame-b.svga", { type: "application/octet-stream" }), "svga", "b");
    await waitFor(() => Boolean(players.b.videoItem));
    await waitFor(() => canvasIsNonBlank(players.b));
    await captureArtifact("desktop-local-compare-loaded");
    const fileInput = await smokeFileInput(bytes.slice(0));
    const dragDrop = await smokeDragDrop(bytes.slice(0));
    const errorFile = await smokeErrorFile();
    await captureArtifact("desktop-invalid");
    await loadSvga("a", fixtureUrl, {
      fileName: "synthetic-avatar-frame-recovered.svga",
      fileSizeBytes: bytes.byteLength,
      loadingHoldMs: 120
    });
    await waitFor(() => Boolean(players.a.videoItem));
    await waitFor(() => canvasIsNonBlank(players.a));
    await waitForInspectionStatus(players.a);
    await captureArtifact("desktop-recovered-from-invalid");
    await electronBridge.reportSmokeResult({
      localPage: location.hostname === "127.0.0.1",
      localOnly: resourcesAreLocal(),
      strictCsp: cspAllowsOnlyLocalWasm(),
      noCspViolation: cspViolations.length === 0,
      playback: Boolean(players.a.player),
      canvasNonBlank,
      inspectionReport,
      auditPanel,
      fileInput,
      dragDrop,
      errorFile,
      playerLifecycle: true,
      cleanup: true,
      p6InteractionTrace: await buildP6SmokeInteractionTrace()
    });
  } catch (error) {
    addLog("error", `产品 smoke 失败：${error.message} / Product smoke failed`);
    await electronBridge.reportSmokeResult({
      localPage: false,
      localOnly: false,
      strictCsp: false,
      noCspViolation: false,
      playback: false,
      canvasNonBlank: false,
      inspectionReport: false,
      auditPanel: false,
      fileInput: false,
      dragDrop: false,
      errorFile: false,
      playerLifecycle: false,
      cleanup: false
    });
  }
}

function handleDroppedFile(file, acceptedKind, slotKey = "a") {
  clearError();
  if (!artifactAutoLoading) manualArtifactSelection = true;
  const kind = fileKind(file);
  if (!kind) {
    if (acceptedKind === "svga" || acceptedKind === "auto") {
      setSlotInvalidState(players[slotKey] ?? players.a, `文件类型不支持：${file.name}。/ Unsupported file type.`);
    } else {
      showError(`文件类型不支持：${file.name}。/ Unsupported file type.`);
    }
    return;
  }
  if (acceptedKind !== "auto" && acceptedKind !== kind && !(acceptedKind === "reference" && ["mp4", "webm", "gif"].includes(kind))) {
    const message = acceptedKind === "svga"
      ? "文件类型不支持，请拖入 .svga 文件。/ Unsupported file type. Please drop a .svga file."
      : "文件类型不支持，请拖入 .mp4、.webm 或 .gif 文件。/ Unsupported file type. Please drop a video or GIF.";
    if (acceptedKind === "svga") {
      setSlotInvalidState(players[slotKey] ?? players.a, message);
    } else {
      showError(message);
    }
    return;
  }

  if (kind === "svga") {
    const targetSlot = acceptedKind === "auto" ? getAutoSvgaSlot() : slotKey;
    handleSvgaFile(file, targetSlot);
    return;
  }

  if (modeSelect.value !== "exportReview") {
    showError("参考视频只在导出验收模式显示。/ Reference video is only shown in Export Review Mode.");
    return;
  }
  loadReference(file, { fileName: file.name, fileSizeBytes: file.size, kind })
    .catch((error) => showError(error.message));
}

function getAutoSvgaSlot() {
  if (isCompareActive()) {
    return players.a.videoItem && !players.b.videoItem ? "b" : "a";
  }
  return "a";
}

function fileKind(file) {
  const name = file.name.toLowerCase();
  if (name.endsWith(".svga")) return "svga";
  if (name.endsWith(".mp4")) return "mp4";
  if (name.endsWith(".webm")) return "webm";
  if (name.endsWith(".gif")) return "gif";
  return undefined;
}

async function fetchFileSize(url) {
  try {
    const response = await fetch(url, { method: "HEAD" });
    if (!response.ok) return undefined;
    return Number(response.headers.get("content-length")) || undefined;
  } catch {
    return undefined;
  }
}

function setRescanState(kind, message) {
  if (!rescanButton || !rescanStatus) return;
  rescanButton.dataset.state = kind;
  rescanButton.disabled = kind === "scanning";
  const label = rescanButton.querySelector("span");
  if (label) label.textContent = kind === "scanning" ? "扫描中…" : kind === "success" ? "已更新" : kind === "error" ? "重试" : "重新扫描";
  rescanStatus.textContent = message;
  announce(message);
}

async function loadArtifactGroup(group, { force = false } = {}) {
  if (!group) return false;
  if (manualArtifactSelection && !force) {
    addLog("info", "已保留本次会话中的手动文件选择。/ Manual selection preserved.");
    return false;
  }

  artifactAutoLoading = true;
  latestArtifactGroup = group;
  setAppMode("exportReview");
  clearError();
  let svgaLoaded = false;

  try {
    if (group.reportPath) {
      try {
        defaultReport = await loadReport(group.reportPath);
        renderReport(defaultReport);
      } catch (error) {
        addLog("warning", `同组报告加载失败：${error.message} / Group report failed`);
      }
    } else {
      renderReport(undefined);
    }

    if (group.svgaPath) {
      try {
        await loadSvga("a", group.svgaPath, {
          fileName: group.svgaPath.split("/").at(-1),
          fileSizeBytes: await fetchFileSize(group.svgaPath),
          report: defaultReport
        });
        svgaLoaded = true;
      } catch (error) {
        addLog("error", `主验收 SVGA 加载失败：${error.message} / Primary SVGA failed`);
        showError(`主验收 SVGA 加载失败：${error.message}`);
      }
    } else {
      players.a.parseStatus = "error";
      players.a.renderStatus = "error";
      setStatus(players.a.status, "error");
      showError("当前产物组不包含 SVGA，仅可查看参考文件。");
    }

    const referencePath = group.mp4Path ?? group.webmPath ?? group.gifPath;
    if (referencePath) {
      try {
        await loadReference(referencePath, {
          fileName: referencePath.split("/").at(-1),
          fileSizeBytes: await fetchFileSize(referencePath),
          kind: referencePath.split(".").at(-1).toLowerCase()
        });
      } catch (error) {
        addLog("warning", `同组参考文件加载失败：${error.message} / Group reference failed`);
      }
    } else {
      clearReference();
    }

    for (const warning of group.warnings ?? []) addLog("warning", `${warning} / Artifact warning`);
    if (!svgaLoaded && referencePath) {
      addLog("error", "参考文件可用，但不能替代真实 SVGA 验收。/ Reference cannot replace SVGA validation.");
    }
    addLog(svgaLoaded ? "success" : "warning", `已加载产物组：${group.jobId} / Artifact group loaded`);
    return svgaLoaded;
  } finally {
    artifactAutoLoading = false;
    updateButtons();
  }
}

async function scanLatestArtifact({ force = false } = {}) {
  if (manualArtifactSelection && !force) return;
  setRescanState("scanning", "正在扫描本地导出产物");
  addLog("info", "正在扫描本地最新导出产物… / Scanning local artifacts");
  try {
    const response = await fetch("/api/latest-artifact");
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    const target = data.latestWithSvga ?? data.latestAny;
    for (const warning of data.warnings ?? []) addLog("warning", `${warning} / Scan warning`);
    if (!target) {
      setRescanState("error", "未找到可用产物");
      showSettingsToast("未找到可用产物");
      return;
    }
    if (force) manualArtifactSelection = false;
    await loadArtifactGroup(target, { force });
    const message = data.latestWithSvga
      ? `已加载 ${target.jobId}`
      : `未找到 SVGA，已加载 ${target.jobId} 的参考文件`;
    setRescanState(data.latestWithSvga ? "success" : "error", message);
    showSettingsToast(message);
  } catch (error) {
    setRescanState("error", `扫描失败：${error.message}`);
    showSettingsToast("扫描失败，请查看运行日志");
    addLog("error", `产物扫描失败：${error.message} / Artifact scan failed`);
  }
}

function setupDropZone(element, acceptedKind, slotKey) {
  element.addEventListener("dragover", (event) => {
    event.preventDefault();
    const file = event.dataTransfer?.items?.[0];
    const kind = file?.kind === "file" ? fileKind({ name: file.getAsFile()?.name ?? "" }) : undefined;
    const accepted = !kind || isAcceptedDropKind(kind, acceptedKind);
    element.classList.toggle("isDragOver", accepted);
    element.classList.toggle("isDragReject", !accepted);
  });
  element.addEventListener("dragleave", (event) => {
    if (!element.contains(event.relatedTarget)) {
      clearDropFeedback(element);
    }
  });
  element.addEventListener("drop", (event) => {
    event.preventDefault();
    clearDropFeedback(element);
    const file = event.dataTransfer?.files?.[0];
    if (!file) return;
    handleDroppedFile(file, acceptedKind, slotKey);
  });
}

function isAcceptedDropKind(kind, acceptedKind) {
  return acceptedKind === "auto"
    || acceptedKind === kind
    || (acceptedKind === "reference" && ["mp4", "webm", "gif"].includes(kind));
}

function clearDropFeedback(element) {
  element.classList.remove("isDragOver", "isDragReject");
}

function renderInfoPanel() {
  const metrics = players.a.metrics;
  setStatus(infoStatus, players.a.parseStatus === "success" ? "ready" : players.a.parseStatus === "error" ? "error" : players.a.parseStatus === "empty" ? "empty" : "loading");
  document.querySelector("#tab-overview").innerHTML = renderOverview(metrics, players.a);
  document.querySelector("#tab-assets").innerHTML = renderAssets(metrics);
}

function renderOverview(metrics, slot) {
  if (!metrics) {
    return renderBilingualEmpty("暂无文件信息。选择或拖入 SVGA 文件后查看详情。", "No SVGA loaded.");
  }
  const rows = [
    ["文件名", "fileName", metrics.fileName, "mono"],
    ["文件体积", "fileSizeBytes", formatBytes(metrics.fileSizeBytes)],
    ["内存占用", "memoryUsage", formatBytes(metrics.memoryBytes)],
    ["画布尺寸", "canvasSize", formatSize(metrics.sourceWidth, metrics.sourceHeight), "mono"],
    ["播放时长", "duration", formatDuration(metrics)],
    ["帧率", "fps", metrics.fps ? `${metrics.fps} fps` : "n/a", "mono"],
    ["图层数量", "spriteCount", metrics.spriteCount ? `${metrics.spriteCount} 个` : "n/a"],
    ["图片资源", "imageCount", metrics.imageCount ? `${metrics.imageCount} 个` : "n/a"]
  ];
  const statusRows = [
    ["解析状态", "parseStatus", slot.parseStatus],
    ["渲染状态", "renderStatus", slot.renderStatus]
  ];
  return `
    <div class="overviewContent">
      <dl class="overviewGrid">
      ${rows.map(([label, key, value, tone]) => `
        <div class="overviewRow">
          <dt><span>${escapeHtml(label)}</span><small>${escapeHtml(key)}</small></dt>
          <dd class="${tone === "mono" ? "monoValue" : ""} ${key === "fileName" ? "fileNameValue" : ""}" title="${escapeHtml(value ?? "n/a")}">${escapeHtml(value ?? "n/a")}</dd>
        </div>
      `).join("")}
      <div class="overviewStatusBlock">
        ${statusRows.map(([label, key, value]) => `
          <div class="overviewStatusRow">
            <dt><span>${escapeHtml(label)}</span><small>${escapeHtml(key)}</small></dt>
            ${renderStatusBadge(value)}
          </div>
        `).join("")}
      </div>
      </dl>
      ${renderAvatarFrameInspectionReport(slot.inspectionReport, slot.inspectionStatus)}
    </div>
  `;
}

function renderStatusBadge(value) {
  const normalized = value === "success" || value === "ready" || value === "playing"
    ? "ready"
    : value === "error"
      ? "error"
      : value === "warning" || value === "loading"
        ? "warning"
        : "neutral";
  const label = normalized === "ready"
    ? "就绪"
    : normalized === "error"
      ? "错误"
      : normalized === "warning"
        ? "警告"
        : "空";
  return `<dd class="statusBadge status-${normalized}"><span aria-hidden="true"></span>${label}</dd>`;
}

function renderBilingualEmpty(primary, secondary) {
  return `
    <div class="emptyPanel bilingualEmpty">
      <span>${escapeHtml(primary)}</span>
      <small>${escapeHtml(secondary)}</small>
    </div>
  `;
}

function renderAssets(metrics) {
  const filterBar = `
    <div class="assetFilters">
      ${[
        ["all", "全部"],
        ["sprite", "精灵"],
        ["image", "图片"],
        ["sequence", "序列帧"],
        ["warning", "异常"]
      ].map(([value, label]) => `<button type="button" class="${assetFilter === value ? "isActive" : ""}" data-asset-filter="${value}">${label}</button>`).join("")}
    </div>
  `;
  if (!metrics?.sprites?.length && !metrics?.images?.length) {
    return `${filterBar}${renderBilingualEmpty("暂无资源信息", "No asset data")}`;
  }
  const assets = buildAssetEntries(metrics);
  const filtered = assets.filter((asset) => {
    if (assetFilter === "all") return asset.kind !== "sprite";
    if (assetFilter === "warning") return asset.warnings?.length;
    return asset.kind === assetFilter;
  });
  return `
    ${filterBar}
    <div class="assetUnifiedList">
      ${filtered.length ? filtered.map(renderAssetEntry).join("") : renderBilingualEmpty("当前筛选没有资源", "No assets match this filter")}
    </div>
  `;
}

function buildAssetEntries(metrics) {
  const images = metrics.images ?? [];
  const sprites = metrics.sprites ?? [];
  const imageByKey = new Map(images.map((image) => [image.key, image]));
  const sequenceGroups = buildSequenceGroups(images);
  const groupedImageKeys = new Set(sequenceGroups.flatMap((group) => group.items.map((item) => item.key)));
  const spriteEntries = sprites.map((sprite, index) => ({
    kind: "sprite",
    key: `sprite:${sprite.name || index}`,
    name: sprite.name || `sprite_${index}`,
    imageKey: sprite.imageKey,
    typeLabel: "精灵",
    width: sprite.width,
    height: sprite.height,
    byteSize: sprite.byteSize,
    referenceCount: sprite.imageKey ? imageByKey.get(sprite.imageKey)?.referenceCount ?? 1 : 0,
    previewUrl: sprite.previewUrl,
    warnings: sprite.warnings ?? [],
    fullKey: sprite.imageKey || sprite.name || `sprite_${index}`
  }));
  const imageEntries = images
    .filter((image) => !groupedImageKeys.has(image.key))
    .map((image) => ({
      kind: "image",
      key: `image:${image.key}`,
      name: image.name ?? image.key,
      imageKey: image.key,
      typeLabel: "图片",
      width: image.width,
      height: image.height,
      byteSize: image.byteSize,
      referenceCount: image.referenceCount ?? 0,
      previewUrl: image.previewUrl,
      warnings: image.warnings ?? [],
      fullKey: image.key
    }));
  const sequenceEntries = sequenceGroups.map((group) => ({
    kind: "sequence",
    key: `sequence:${group.prefix}:${group.startNumber}-${group.endNumber}`,
    name: group.prefix,
    imageKey: group.keyRange,
    typeLabel: "序列帧",
    width: group.width,
    height: group.height,
    byteSize: group.byteSize,
    referenceCount: group.items.reduce((sum, item) => sum + (item.referenceCount ?? 0), 0),
    previewUrl: group.items[0]?.previewUrl,
    previewItems: group.items.slice(0, 4),
    warnings: group.warnings,
    fullKey: group.keyRange,
    frameCount: group.items.length,
    items: group.items
  }));
  return [...spriteEntries, ...sequenceEntries, ...imageEntries];
}

function buildSequenceGroups(images = []) {
  const buckets = new Map();
  for (const image of images) {
    const match = String(image.key).match(/^(.*?)(\d+)$/);
    if (!match) continue;
    const prefix = match[1];
    const number = Number(match[2]);
    const bucketKey = `${prefix}|${Math.round(image.width ?? 0)}x${Math.round(image.height ?? 0)}`;
    if (!buckets.has(bucketKey)) buckets.set(bucketKey, { prefix, width: image.width, height: image.height, items: [] });
    buckets.get(bucketKey).items.push({ ...image, sequenceNumber: number });
  }
  const groups = [];
  for (const bucket of buckets.values()) {
    const sorted = bucket.items.sort((a, b) => a.sequenceNumber - b.sequenceNumber || String(a.key).localeCompare(String(b.key)));
    const itemsByNumber = new Map();
    for (const item of sorted) {
      if (!itemsByNumber.has(item.sequenceNumber)) itemsByNumber.set(item.sequenceNumber, []);
      itemsByNumber.get(item.sequenceNumber).push(item);
    }
    const sortedNumbers = [...itemsByNumber.keys()].sort((a, b) => a - b);
    let segmentNumbers = [];
    const flush = () => {
      if (segmentNumbers.length < 3) {
        segmentNumbers = [];
        return;
      }
      const segment = segmentNumbers.flatMap((number) => itemsByNumber.get(number) ?? []);
      const byteSize = segment.reduce((sum, item) => sum + (item.byteSize ?? 0), 0);
      const warnings = [...new Set(segment.flatMap((item) => item.warnings ?? []))];
      const first = segment[0];
      const last = segment.at(-1);
      groups.push({
        ...bucket,
        items: [...segment],
        byteSize,
        warnings,
        keyRange: `${first?.key ?? bucket.prefix} ... ${last?.key ?? bucket.prefix}`,
        startNumber: first?.sequenceNumber,
        endNumber: last?.sequenceNumber
      });
      segmentNumbers = [];
    };
    for (const number of sortedNumbers) {
      const previous = segmentNumbers.at(-1);
      if (Number.isFinite(previous) && number !== previous + 1) {
        flush();
      }
      segmentNumbers.push(number);
    }
    flush();
  }
  return groups;
}

function renderAssetEntry(asset) {
  const isSelected = selectedAssetKey === asset.key;
  const warningHtml = asset.warnings?.length
    ? `<div class="assetWarningTags">${asset.warnings.map((warning) => `<span>${escapeHtml(shortWarningLabel(warning))}</span>`).join("")}</div>`
    : "";
  const sequenceExpanded = asset.kind === "sequence" && expandedSequenceGroups.has(asset.key);
  return `
    <article class="assetUnifiedRow ${asset.warnings?.length ? "hasWarning" : ""} ${isSelected ? "isSelected" : ""}" data-asset-key="${escapeHtml(asset.key)}">
      <button class="assetUnifiedThumb checkerboard ${asset.kind === "sequence" ? "isSequence" : ""}" type="button" data-preview-image-key="${escapeHtml(asset.items?.[0]?.key ?? asset.imageKey ?? "")}" ${asset.previewUrl ? "" : "disabled"}>
        ${asset.kind === "sequence"
          ? (asset.previewItems ?? []).map((item) => item.previewUrl ? `<img src="${escapeHtml(item.previewUrl)}" alt="">` : `<span></span>`).join("")
          : (asset.previewUrl ? `<img src="${escapeHtml(asset.previewUrl)}" alt="">` : `<span></span>`)}
      </button>
      <div class="assetUnifiedMain">
        <div class="assetPrimaryLine">
          <strong title="${escapeHtml(asset.name)}">${escapeHtml(asset.name)}</strong>
          <span class="assetTypeTag ${asset.kind}">${escapeHtml(asset.typeLabel)}</span>
        </div>
        <div class="assetMetaLines">
          <div>
            <span>${escapeHtml(formatSize(asset.width, asset.height))}</span>
            <span>${escapeHtml(formatBytes(asset.byteSize))}</span>
            ${asset.frameCount ? `<span>${escapeHtml(asset.frameCount)} 帧</span>` : ""}
          </div>
          <div>
            <span class="assetImageKey" title="${escapeHtml(asset.imageKey ?? "n/a")}">${escapeHtml(asset.imageKey ?? "n/a")}</span>
            <span>引用 ×${escapeHtml(asset.referenceCount ?? 0)}</span>
          </div>
        </div>
        <div class="assetFullKey" title="${escapeHtml(asset.fullKey ?? "")}">${escapeHtml(asset.fullKey ?? "")}</div>
        ${warningHtml}
        ${asset.kind === "sequence" ? `<button class="sequenceToggle" type="button" data-sequence-toggle="${escapeHtml(asset.key)}">${sequenceExpanded ? "收起序列帧" : "展开序列帧"}</button>` : ""}
      </div>
    </article>
    ${sequenceExpanded ? `<div class="sequenceChildren">${asset.items.map((item) => renderAssetEntry({
      kind: "image",
      key: `sequence-child:${item.key}`,
      name: item.name ?? item.key,
      imageKey: item.key,
      typeLabel: "图片",
      width: item.width,
      height: item.height,
      byteSize: item.byteSize,
      referenceCount: item.referenceCount ?? 0,
      previewUrl: item.previewUrl,
      warnings: item.warnings ?? [],
      fullKey: item.key
    })).join("")}</div>` : ""}
  `;
}

function renderLayerList(sprites = []) {
  if (!sprites.length) {
    return `<div class="emptyPanel">暂无图层信息 / No layer data</div>`;
  }
  return `<div class="layerList">${sprites.map((sprite, index) => `
    <article class="layerRow ${sprite.warnings?.length ? "hasWarning" : ""} ${selectedLayerKey === sprite.name ? "isSelected" : ""}" data-layer-key="${escapeHtml(sprite.name)}" title="${escapeHtml(sprite.name || `sprite_${index}`)}">
      <button class="layerTypeIcon ${sprite.previewUrl ? "hasPreview" : ""}" type="button" data-preview-image-key="${escapeHtml(sprite.imageKey ?? "")}" ${sprite.previewUrl ? "" : "disabled"} aria-label="查看图层资源 / View layer asset">
        ${sprite.previewUrl ? `<img src="${escapeHtml(sprite.previewUrl)}" alt="">` : `<span></span>`}
      </button>
      <div class="layerMain">
        <strong>${escapeHtml(sprite.name || `sprite_${index}`)}</strong>
        <small>${escapeHtml(sprite.imageKey ?? sprite.type ?? "sprite")}</small>
      </div>
      <span class="layerSize">${escapeHtml(formatSize(sprite.width, sprite.height))}</span>
      <span class="layerBytes">${escapeHtml(formatBytes(sprite.byteSize))}</span>
      ${sprite.warnings?.length ? `<span class="layerWarning" title="${escapeHtml(sprite.warnings.join(", "))}">!</span>` : ""}
    </article>
  `).join("")}</div>`;
}

function renderImageList(images = []) {
  if (!images.length) {
    return `<div class="emptyPanel">暂无图片资源信息 / No image resource data</div>`;
  }
  return `<div class="imageList">${images.map((image) => `
    <article class="imageRow ${image.warnings?.length ? "hasWarning" : ""} ${selectedImageKey === image.key ? "isSelected" : ""}" data-image-key="${escapeHtml(image.key)}" title="${escapeHtml(image.key)}">
      <div class="imageRowTop">
        <button class="imageThumb checkerboard" type="button" data-preview-image-key="${escapeHtml(image.key)}" aria-label="查看图片资源 / View image asset">
          ${image.previewUrl ? `<img src="${escapeHtml(image.previewUrl)}" alt="">` : `<span></span>`}
        </button>
        <strong>${escapeHtml(image.name ?? image.key)}</strong>
      </div>
      <div class="imageRowMeta">
        <span>${escapeHtml(formatSize(image.width, image.height))}</span>
        <span class="${image.warnings?.some((warning) => warning.includes("体积")) ? "warningText" : ""}">${escapeHtml(formatBytes(image.byteSize))}</span>
        <span>引用×${escapeHtml(image.referenceCount ?? 0)}</span>
      </div>
      ${image.warnings?.length ? `<div class="imageWarningTags">${image.warnings.map((warning) => `<span>${escapeHtml(shortWarningLabel(warning))}</span>`).join("")}</div>` : ""}
    </article>
  `).join("")}</div>`;
}

function shortWarningLabel(warning) {
  if (warning.includes("体积")) return "图片体积偏大";
  if (warning.includes("未压缩")) return "疑似未压缩";
  if (warning.includes("尺寸")) return "图片尺寸偏大";
  return warning.split(" / ")[0] || warning;
}

function renderLogsPanel() {
  if (!fullLogsContent) return;
  const logs = appLogs.length
    ? appLogs.slice().reverse()
    : [{ level: "info", message: "暂无日志 / No logs", time: "--:--:--" }];
  fullLogsSubtitle.innerHTML = `<span>运行日志 · ${appLogs.length} 条</span><small>Runtime Logs</small>`;
  fullLogsContent.innerHTML = logs.map(renderFullLogRow).join("");
}

function logLevelLabel(level) {
  if (level === "success") return "SUCC";
  if (level === "error") return "ERR";
  if (level === "warning" || level === "warn") return "WARN";
  return "INFO";
}

function renderSyncBar() {
  if (modeSelect.value === "localPreview" && !compareEnabled) return;
  const right = isCompareActive() ? players.b.metrics : referenceState.metrics;
  syncLeftInfo.innerHTML = renderSyncFile(modeSelect.value === "exportReview" ? "SVGA" : "SVGA A", players.a.metrics, "svga");
  syncRightInfo.innerHTML = renderSyncFile(isCompareActive() ? "SVGA B" : getReferenceSyncLabel(), right, isCompareActive() ? "svga" : "reference");
  syncWarnings.innerHTML = renderSyncWarnings(players.a.metrics, right);
  updateSyncTime(Number(syncProgress.value));
}

function renderSyncFile(label, metrics, tone = "svga") {
  if (!metrics) {
    return `
      <strong class="syncFileBadge ${tone === "reference" ? "isReference" : ""}">${label}</strong>
      <span class="syncFileName">暂未加载</span>
    `;
  }
  const primaryMeta = formatSize(metrics.sourceWidth, metrics.sourceHeight);
  const secondaryMeta = [formatBytes(metrics.fileSizeBytes), formatDuration(metrics)]
    .filter((item) => item && item !== "n/a")
    .join(" · ");
  return `
    <strong class="syncFileBadge ${tone === "reference" ? "isReference" : ""}">${escapeHtml(label)}</strong>
    <span class="syncFileName" title="${escapeHtml(metrics.fileName ?? "n/a")}">${escapeHtml(metrics.fileName ?? "n/a")}</span>
    <small><span>${escapeHtml(primaryMeta)}</span><span class="syncOptionalMeta">${escapeHtml(secondaryMeta)}</span></small>
  `;
}

function getReferenceSyncLabel() {
  if (referenceState.kind === "gif") return "GIF";
  if (referenceState.kind === "webm") return "WEBM";
  return "MP4";
}

function renderSyncWarnings(left, right) {
  if (!left || !right) {
    return left || right ? `<span class="syncStatusPill isWaiting">等待另一侧文件</span>` : "";
  }
  const warnings = [];
  const leftDuration = Number(left.durationSeconds ?? 0);
  const rightDuration = Number(right.durationSeconds ?? 0);
  if (leftDuration && rightDuration && Math.abs(leftDuration - rightDuration) > 0.05) {
    const delta = rightDuration - leftDuration;
    warnings.push({
      title: `时长差异 ${delta >= 0 ? "+" : ""}${delta.toFixed(2)}s`
    });
  }
  if (left.sourceWidth && left.sourceHeight && right.sourceWidth && right.sourceHeight) {
    const sameSize = Math.round(left.sourceWidth) === Math.round(right.sourceWidth)
      && Math.round(left.sourceHeight) === Math.round(right.sourceHeight);
    if (!sameSize) {
      warnings.push({
        title: "尺寸存在差异"
      });
    }
  }
  if (!warnings.length && isCompareActive()) {
    return `<span class="syncStatusPill isMatched">规格一致</span>`;
  }
  return warnings.map((warning) => `
    <span class="syncStatusPill isWarning">${escapeHtml(warning.title)}</span>
  `).join("");
}

function formatBytes(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return value ?? "n/a";
  if (number < 1024) return `${number} B`;
  if (number < 1024 * 1024) return `${(number / 1024).toFixed(1)} KB`;
  return `${(number / 1024 / 1024).toFixed(2)} MB`;
}

function formatSize(width, height) {
  if (!Number.isFinite(Number(width)) || !Number.isFinite(Number(height))) return "n/a";
  return `${Math.round(Number(width))} × ${Math.round(Number(height))}`;
}

function formatDuration(metrics) {
  const duration = metrics?.durationSeconds ?? (metrics?.fps && metrics?.frameCount ? metrics.frameCount / metrics.fps : undefined);
  return Number.isFinite(Number(duration)) ? `${Number(duration).toFixed(2)}s` : "n/a";
}

function formatClock(seconds) {
  const safe = Number.isFinite(Number(seconds)) ? Number(seconds) : 0;
  const minutes = Math.floor(safe / 60);
  const secs = Math.floor(safe % 60);
  return `${minutes}:${String(secs).padStart(2, "0")}`;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function playbackStateForSlot(slot) {
  return {
    kind: slot.parseStatus === "error" || slot.renderStatus === "error"
      ? "error"
      : slot.parseStatus === "loading"
        ? "loading"
        : slot.isPlaying
          ? "playing"
          : slot.videoItem
            ? "paused"
            : "idle",
    canPlay: Boolean(slot.videoItem),
    mediaType: slot.videoItem ? "svga" : "none"
  };
}

function renderPlaybackButton(button, state, labelPrefix = "") {
  const isGif = state.mediaType === "gif";
  const isPlaying = state.kind === "playing";
  const label = isGif ? "重新播放" : isPlaying ? "暂停" : "播放";
  button.innerHTML = isGif
    ? `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 12a8 8 0 1 1-2.35-5.65" /><path d="M20 4v6h-6" /></svg>`
    : isPlaying
      ? `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5v14" /><path d="M16 5v14" /></svg>`
      : `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5v14l11-7z" /></svg>`;
  button.disabled = !state.canPlay || state.kind === "loading";
  button.title = `${labelPrefix}${label}`;
  button.setAttribute("aria-label", `${labelPrefix}${label}`);
  button.setAttribute("aria-pressed", String(isPlaying));
  button.classList.toggle("isLoading", state.kind === "loading");
  button.classList.toggle("hasError", state.kind === "error");
}

function updatePlaybackButtons() {
  renderPlaybackButton(localPlayPauseButton, playbackStateForSlot(players.a), "SVGA A ");
  renderPlaybackButton(playerBPlayPauseButton, playbackStateForSlot(players.b), "SVGA B ");
  const referenceKind = referenceState.kind === "gif" ? "gif" : referenceState.metrics ? "video" : "none";
  renderPlaybackButton(referencePlayPauseButton, {
    kind: referenceKind === "video" && !referenceState.video.paused ? "playing" : referenceState.metrics ? "paused" : "idle",
    canPlay: Boolean(referenceState.metrics),
    mediaType: referenceKind
  }, "参考预览 ");
  localReplayButton.disabled = !players.a.videoItem;
  playerBReplayButton.disabled = !players.b.videoItem;
  referenceReplayButton.disabled = !referenceState.metrics;
  renderPlaybackButton(syncPlayControl, {
    kind: syncIsPlaying ? "playing" : "paused",
    canPlay: !syncPlayControl.disabled,
    mediaType: "video"
  }, "同步");
}

function getImageByKey(imageKey) {
  return players.a.metrics?.images?.find((image) => image.key === imageKey)
    ?? players.b.metrics?.images?.find((image) => image.key === imageKey);
}

function openAssetPreview(imageKey) {
  const image = getImageByKey(imageKey);
  if (!image?.previewUrl) return;
  previewImageKey = image.key;
  assetPreviewTitle.textContent = image.name ?? image.key;
  assetPreviewMeta.textContent = `imageKey: ${image.key}`;
  assetPreviewImage.src = image.previewUrl;
  assetPreviewDetails.textContent = `${formatSize(image.width, image.height)} · ${formatBytes(image.byteSize)}`;
  openModal(assetPreviewModal, document.activeElement);
}

function closeAssetPreview() {
  closeModal(assetPreviewModal);
  window.setTimeout(() => assetPreviewImage.removeAttribute("src"), 200);
}

function setThemePreference(value) {
  localStorage.setItem("autoSvgaTheme", value);
  applyThemePreference(value);
}

function applyThemePreference(value = localStorage.getItem("autoSvgaTheme") ?? "system") {
  const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  effectiveTheme = value === "system" ? (prefersDark ? "dark" : "light") : value;
  document.documentElement.dataset.theme = effectiveTheme;
  for (const input of document.querySelectorAll('input[name="theme"]')) {
    input.checked = input.value === value;
  }
  const targetTheme = effectiveTheme === "light" ? "深色" : "浅色";
  themeToggleButton.title = `切换到${targetTheme}模式`;
  themeToggleButton.setAttribute("aria-label", `切换到${targetTheme}模式`);
  themeToggleButton.innerHTML = effectiveTheme === "light"
    ? `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3a6 6 0 0 0 9 7.5A9 9 0 1 1 12 3Z" /></svg>`
    : `<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4" /><path d="M12 2v2" /><path d="M12 20v2" /><path d="m4.93 4.93 1.41 1.41" /><path d="m17.66 17.66 1.41 1.41" /><path d="M2 12h2" /><path d="M20 12h2" /><path d="m6.34 17.66-1.41 1.41" /><path d="m19.07 4.93-1.41 1.41" /></svg>`;
}

function setPreviewBackground(value) {
  localStorage.setItem("autoSvgaPreviewBackground", value);
  document.documentElement.dataset.previewBackground = value;
  for (const input of document.querySelectorAll('input[name="previewBackground"]')) {
    input.checked = input.value === value;
  }
}

function openSettings() {
  openModal(settingsModal, settingsButton);
}

function closeSettings() {
  closeModal(settingsModal);
}

function openFullLogs() {
  setActiveSidePanel("logs");
}

function closeFullLogs() {
  if (activeSidePanel === "logs") setActiveSidePanel(null);
}

function closeFitMenus(exceptSlot) {
  for (const menu of document.querySelectorAll(".dropdownMenu, [data-fit-menu]")) {
    if (menu.dataset.fitMenu === exceptSlot) continue;
    closeDropdown(menu);
  }
}

function applyFitMode(slotKey, value) {
  const select = slotKey === "a" ? fitModeA : slotKey === "b" ? fitModeB : fitModeReference;
  select.value = value;
  localStorage.setItem(`autoSvgaFitMode:${slotKey}`, value);
  select.dispatchEvent(new Event("change"));
  updateFitMenuSelection(slotKey);
  closeFitMenus();
}

function updateFitMenuSelection(slotKey) {
  const select = slotKey === "a" ? fitModeA : slotKey === "b" ? fitModeB : fitModeReference;
  const menu = document.querySelector(`[data-fit-menu="${slotKey}"]`);
  if (!menu) return;
  for (const option of menu.querySelectorAll("[data-fit-value]")) {
    const selected = option.dataset.fitValue === select.value;
    option.classList.toggle("isSelected", selected);
    option.setAttribute("aria-checked", String(selected));
  }
  const label = dropdownBindings.get(menu)?.trigger.querySelector(".fitMenuButtonLabel");
  if (label) {
    label.textContent = select.value === "original" ? "原始尺寸" : select.value === "fitWidth" ? "适应宽度" : "适应窗口";
  }
}

function restoreFitMode(slotKey) {
  const select = slotKey === "a" ? fitModeA : slotKey === "b" ? fitModeB : fitModeReference;
  const stored = localStorage.getItem(`autoSvgaFitMode:${slotKey}`);
  select.value = ["contain", "original", "fitWidth"].includes(stored) ? stored : "original";
}

function syncDropdownSelection(menu, value) {
  if (!menu) return;
  for (const item of menu.querySelectorAll("[data-value], [data-fit-value]")) {
    const itemValue = item.dataset.value ?? item.dataset.fitValue;
    const selected = itemValue === value;
    item.classList.toggle("isSelected", selected);
    item.setAttribute("aria-checked", String(selected));
  }
}

function positionDropdown(trigger, menu) {
  menu.style.left = "auto";
  menu.style.right = "auto";
  menu.style.top = "auto";
  menu.style.bottom = "auto";
  const triggerRect = trigger.getBoundingClientRect();
  const menuWidth = Math.max(menu.offsetWidth, 180);
  const menuHeight = menu.offsetHeight;
  const gutter = 10;
  const preferredLeft = trigger.closest(".modeControl")
    ? triggerRect.left + (triggerRect.width - menuWidth) / 2
    : triggerRect.right - menuWidth;
  const left = Math.min(
    Math.max(gutter, preferredLeft),
    Math.max(gutter, window.innerWidth - menuWidth - gutter)
  );
  const prefersAbove = trigger.classList.contains("fitMenuButton");
  const fitsAbove = triggerRect.top - menuHeight - 8 >= gutter;
  const top = prefersAbove && fitsAbove
    ? triggerRect.top - menuHeight - 8
    : Math.min(triggerRect.bottom + 8, window.innerHeight - menuHeight - gutter);
  menu.style.left = `${Math.round(left)}px`;
  menu.style.top = `${Math.round(Math.max(gutter, top))}px`;
  menu.classList.toggle("opensAbove", prefersAbove && fitsAbove);
}

function openDropdown(trigger, menu) {
  for (const other of document.querySelectorAll(".dropdownMenu, [data-fit-menu]")) {
    if (other !== menu) closeDropdown(other);
  }
  menu.classList.remove("isClosing");
  menu.hidden = false;
  trigger.setAttribute("aria-expanded", "true");
  positionDropdown(trigger, menu);
  menu.querySelector(".isSelected, [role^='menuitem']")?.focus();
}

function closeDropdown(menu, restoreFocus = false) {
  if (!menu || menu.hidden) return;
  const trigger = dropdownBindings.get(menu)?.trigger;
  trigger?.setAttribute("aria-expanded", "false");
  menu.classList.add("isClosing");
  window.setTimeout(() => {
    menu.hidden = true;
    menu.classList.remove("isClosing");
    if (restoreFocus) trigger?.focus();
  }, document.documentElement.classList.contains("reduceMotion") ? 20 : 130);
}

function setupDropdown({ trigger, menu, itemSelector, getValue, onSelect }) {
  if (!trigger || !menu) return;
  dropdownBindings.set(menu, { trigger });
  menu.classList.add("dropdownMenu");
  for (const item of menu.querySelectorAll(itemSelector)) {
    item.classList.add("dropdownMenuItem");
    item.setAttribute("role", "menuitemradio");
    item.tabIndex = -1;
  }
  trigger.classList.add("dropdownTrigger");
  floatingRoot.append(menu);
  trigger.addEventListener("click", (event) => {
    event.stopPropagation();
    if (menu.hidden) openDropdown(trigger, menu);
    else closeDropdown(menu);
  });
  menu.addEventListener("click", (event) => {
    const item = event.target.closest(itemSelector);
    if (!item) return;
    onSelect(getValue(item));
    closeDropdown(menu, true);
  });
  menu.addEventListener("keydown", (event) => {
    const items = [...menu.querySelectorAll(itemSelector)].filter((item) => !item.disabled);
    const currentIndex = Math.max(0, items.indexOf(document.activeElement));
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      const direction = event.key === "ArrowDown" ? 1 : -1;
      items[(currentIndex + direction + items.length) % items.length]?.focus();
    } else if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      document.activeElement?.click();
    } else if (event.key === "Escape") {
      event.preventDefault();
      closeDropdown(menu, true);
    }
  });
}

function setupDropdownMenus() {
  setupDropdown({
    trigger: modeDropdownTrigger,
    menu: modeDropdownMenu,
    itemSelector: "[data-value]",
    getValue: (item) => item.dataset.value,
    onSelect: (value) => {
      setAppMode(value);
      if (value === "exportReview" && autoLoadLatestToggle.checked) {
        scanLatestArtifact();
      }
    }
  });

  for (const menu of document.querySelectorAll("[data-fit-menu]")) {
    const slotKey = menu.dataset.fitMenu;
    const trigger = menu.parentElement.querySelector(".fitMenuButton");
    setupDropdown({
      trigger,
      menu,
      itemSelector: "[data-fit-value]",
      getValue: (item) => item.dataset.fitValue,
      onSelect: (value) => applyFitMode(slotKey, value)
    });
    updateFitMenuSelection(slotKey);
  }
  document.addEventListener("click", () => closeFitMenus());
}

function renderFullLogRow(log) {
  return `
    <div class="fullLogRow ${escapeHtml(log.level)}">
      <time>${escapeHtml(log.time)}</time>
      <strong>${escapeHtml(logLevelLabel(log.level))}</strong>
      <span>${escapeHtml(log.message)}</span>
    </div>
  `;
}

function serializeLogs() {
  return appLogs.length
    ? appLogs.map((log) => `${log.time} ${logLevelLabel(log.level)} ${log.message}`).join("\n")
    : "暂无日志 / No logs";
}

let feedbackTimer;
function showActionFeedback(target, { type = "info", text }) {
  if (!target) return;
  window.clearTimeout(feedbackTimer);
  target.textContent = text;
  target.dataset.state = type;
  target.classList.add("isVisible");
  feedbackTimer = window.setTimeout(() => {
    target.classList.remove("isVisible");
    target.removeAttribute("data-state");
  }, 1800);
}

localPlayPauseButton.addEventListener("click", () => {
  clearError();
  toggleSlot(players.a);
});
localReplayButton.addEventListener("click", () => {
  clearError();
  replaySlot(players.a);
});
localLoopToggle.addEventListener("change", () => {
  setSlotLoop(players.a, localLoopToggle.checked);
});
compareToggle.addEventListener("change", () => {
  compareEnabled = compareToggle.checked;
  if (compareEnabled) {
    addLog("info", "已开启对比，可拖入第二个 SVGA。/ Compare enabled; drop a second SVGA.");
    announce("已开启本地对比");
  } else {
    announce("已关闭本地对比");
  }
  setAppMode("localPreview");
});
infoPanelButton.addEventListener("click", () => {
  const panel = document.querySelector("#infoPanel");
  if (panel.classList.contains("isHidden")) {
    openInfoPanel("overview");
  } else {
    closeInfoPanel();
  }
});
logsButton.addEventListener("click", () => {
  if (logsPanel.classList.contains("isHidden")) openFullLogs();
  else closeFullLogs();
});
settingsButton.addEventListener("click", () => {
  openSettings();
});
themeToggleButton.addEventListener("click", () => {
  setThemePreference(effectiveTheme === "light" ? "dark" : "light");
});
syncPlayControl.addEventListener("click", toggleSyncPlayback);
syncReplayControl.addEventListener("click", syncReplay);
primaryEmptyFileButton.addEventListener("click", () => svgaFileInput.click());
secondaryEmptyFileButton.addEventListener("click", () => secondaryFileInput.click());
referenceEmptyFileButton.addEventListener("click", () => referenceFileInput.click());
modeSelect.addEventListener("change", () => {
  setAppMode(modeSelect.value);
  if (modeSelect.value === "exportReview" && autoLoadLatestToggle.checked) {
    scanLatestArtifact();
  }
});

playerBPlayPauseButton.addEventListener("click", () => toggleSlot(players.b));
playerBReplayButton.addEventListener("click", () => replaySlot(players.b));
playerBLoopToggle.addEventListener("change", () => {
  setSlotLoop(players.b, playerBLoopToggle.checked);
});
playerBProgress.addEventListener("input", () => {
  const percent = Number(playerBProgress.value);
  seekSlot(players.b, percent);
  updatePlayerBTime(percent);
});
referencePlayPauseButton.addEventListener("click", () => {
  if (!referenceState.metrics) {
    showError("当前没有可播放的参考视频。/ No reference media loaded.");
    return;
  }
  if (referenceState.kind === "gif") {
    replayReference();
    return;
  }
  if (referenceState.video.paused) {
    playReference();
    startReferenceTicker();
  } else {
    referenceState.video.pause();
    stopReferenceTicker();
  }
});
referenceReplayButton.addEventListener("click", () => {
  replayReference();
  startReferenceTicker();
});
referenceLoopToggle.addEventListener("change", () => {
  referenceState.video.loop = referenceLoopToggle.checked;
});
referenceProgress.addEventListener("input", () => {
  const duration = referenceState.video.duration || 0;
  if (duration) {
    referenceState.video.currentTime = (duration * Number(referenceProgress.value)) / 100;
  }
  updateRangeProgress(referenceProgress, Number(referenceProgress.value));
  referenceTime.textContent = `${formatClock(referenceState.video.currentTime || 0)} / ${formatClock(duration)}`;
});

syncProgress.addEventListener("input", () => {
  seekSynchronized(Number(syncProgress.value));
});
syncProgress.addEventListener("change", () => seekSynchronized(Number(syncProgress.value)));

localProgress.addEventListener("input", () => {
  const percent = Number(localProgress.value);
  seekSlot(players.a, percent);
  updateLocalTime(percent);
  localPausedPercent = percent;
});

for (const select of [fitModeA, fitModeB, fitModeReference]) {
  select.addEventListener("change", () => {
    refreshLayout();
    const slotKey = select.dataset.fitSlot;
    updateFitMenuSelection(slotKey);
  });
}

window.addEventListener("resize", () => {
  closeFitMenus();
  applyInfoPanelWidth(infoPanelWidth);
  applyLogsPanelWidth(logsPanelWidth);
  window.requestAnimationFrame(refreshLayout);
});

referenceState.video.addEventListener("play", () => {
  startReferenceTicker();
  updateSyncPlaybackState();
});
referenceState.video.addEventListener("pause", updateSyncPlaybackState);
referenceState.video.addEventListener("ended", () => {
  stopReferenceTicker();
  updateSyncPlaybackState();
});

svgaFileInput.addEventListener("change", () => {
  const file = svgaFileInput.files?.[0];
  if (file) handleDroppedFile(file, "svga", getAutoSvgaSlot());
});

secondaryFileInput.addEventListener("change", () => {
  const file = secondaryFileInput.files?.[0];
  if (!file) return;
  handleDroppedFile(file, "svga", "b");
});

referenceFileInput.addEventListener("change", () => {
  const file = referenceFileInput.files?.[0];
  if (file) handleDroppedFile(file, "reference");
});

for (const button of tabButtons) {
  button.addEventListener("click", () => {
    for (const item of tabButtons) item.classList.toggle("isActive", item === button);
    for (const panel of document.querySelectorAll(".tabPanel")) panel.classList.add("isHidden");
    document.querySelector(`#tab-${button.dataset.tab}`).classList.remove("isHidden");
  });
}

document.querySelector("#tab-assets").addEventListener("click", (event) => {
  const filterButton = event.target.closest("[data-asset-filter]");
  if (filterButton) {
    assetFilter = filterButton.dataset.assetFilter;
    renderInfoPanel();
    return;
  }
  const toggleButton = event.target.closest("[data-sequence-toggle]");
  if (toggleButton) {
    const key = toggleButton.dataset.sequenceToggle;
    if (expandedSequenceGroups.has(key)) {
      expandedSequenceGroups.delete(key);
    } else {
      expandedSequenceGroups.add(key);
    }
    renderInfoPanel();
    return;
  }
  const previewButton = event.target.closest("[data-preview-image-key]");
  if (previewButton?.dataset.previewImageKey) {
    openAssetPreview(previewButton.dataset.previewImageKey);
    return;
  }
  const row = event.target.closest("[data-asset-key]");
  if (row) {
    selectedAssetKey = row.dataset.assetKey;
    renderInfoPanel();
  }
});

assetPreviewClose.addEventListener("click", closeAssetPreview);
assetPreviewModal.addEventListener("click", (event) => {
  if (event.target === assetPreviewModal) closeAssetPreview();
});
copyImageKeyButton.addEventListener("click", () => {
  if (previewImageKey) {
    navigator.clipboard?.writeText(previewImageKey).catch(() => undefined);
  }
});
settingsCloseButton.addEventListener("click", closeSettings);
settingsModal.addEventListener("click", (event) => {
  if (event.target === settingsModal) closeSettings();
});
copyFullLogsButton.addEventListener("click", () => {
  navigator.clipboard?.writeText(serializeLogs())
    .then(() => showActionFeedback(logsActionFeedback, { type: "success", text: "已复制" }))
    .catch(() => showActionFeedback(logsActionFeedback, { type: "error", text: "复制失败" }));
});
clearFullLogsButton.addEventListener("click", () => {
  if (!appLogs.length) {
    showActionFeedback(logsActionFeedback, { text: "暂无日志可清除" });
    return;
  }
  appLogs.length = 0;
  renderInfoPanel();
  renderLogsPanel();
  showActionFeedback(logsActionFeedback, { type: "success", text: "已清除" });
});
for (const input of document.querySelectorAll('input[name="theme"]')) {
  input.addEventListener("change", () => {
    setThemePreference(input.value);
    showSettingsToast("外观设置已更新");
  });
}
for (const input of document.querySelectorAll('input[name="previewBackground"]')) {
  input.addEventListener("change", () => {
    setPreviewBackground(input.value);
    showSettingsToast("预览背景已更新");
  });
}
autoLoadLatestToggle.checked = localStorage.getItem("autoSvgaAutoLoad") !== "false";
autoLoadLatestToggle.addEventListener("change", () => {
  localStorage.setItem("autoSvgaAutoLoad", String(autoLoadLatestToggle.checked));
  showSettingsToast("验收设置已更新");
});
rescanButton.addEventListener("click", async () => {
  await scanLatestArtifact({ force: true });
});
globalLoopToggle.addEventListener("change", () => {
  localLoopToggle.checked = globalLoopToggle.checked;
  playerBLoopToggle.checked = globalLoopToggle.checked;
  referenceLoopToggle.checked = globalLoopToggle.checked;
  setSlotLoop(players.a, globalLoopToggle.checked);
  setSlotLoop(players.b, globalLoopToggle.checked);
  referenceState.video.loop = globalLoopToggle.checked;
  showSettingsToast("播放设置已更新");
});
reduceMotionToggle.checked = localStorage.getItem("autoSvgaReduceMotion") === "true";
document.documentElement.classList.toggle("reduceMotion", reduceMotionToggle.checked);
reduceMotionToggle.addEventListener("change", () => {
  localStorage.setItem("autoSvgaReduceMotion", String(reduceMotionToggle.checked));
  document.documentElement.classList.toggle("reduceMotion", reduceMotionToggle.checked);
  showSettingsToast("可访问性设置已更新");
});
reduceBlurToggle.checked = localStorage.getItem("autoSvgaReduceBlur") === "true";
document.documentElement.classList.toggle("reduceBlur", reduceBlurToggle.checked);
reduceBlurToggle.addEventListener("change", () => {
  localStorage.setItem("autoSvgaReduceBlur", String(reduceBlurToggle.checked));
  document.documentElement.classList.toggle("reduceBlur", reduceBlurToggle.checked);
  showSettingsToast("浮层显示已更新");
});
window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => {
  if ((localStorage.getItem("autoSvgaTheme") ?? "system") === "system") {
    applyThemePreference("system");
  }
});
function setupPanelResize(handle, options) {
  if (!handle) return;
  const { defaultWidth, storageKey, apply, getWidth, bodyClass } = options;
  const updateAria = () => {
    handle.setAttribute("role", "separator");
    handle.setAttribute("aria-orientation", "vertical");
    handle.setAttribute("aria-valuemin", String(options.minimum));
    handle.setAttribute("aria-valuemax", String(options.maximum()));
    handle.setAttribute("aria-valuenow", String(getWidth()));
  };
  handle.addEventListener("pointerdown", (event) => {
    event.preventDefault();
    const startX = event.clientX;
    const startWidth = getWidth();
    document.body.classList.add(bodyClass);
    handle.setPointerCapture?.(event.pointerId);
    const onPointerMove = (moveEvent) => {
      apply(startWidth + startX - moveEvent.clientX);
      refreshLayout();
    };
    const onPointerUp = () => {
      document.body.classList.remove(bodyClass);
      localStorage.setItem(storageKey, String(getWidth()));
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
    };
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
  });
  handle.addEventListener("keydown", (event) => {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    const next = event.key === "Home"
      ? options.minimum
      : event.key === "End"
        ? options.maximum()
        : getWidth() + (event.key === "ArrowLeft" ? -20 : 20);
    apply(next);
    localStorage.setItem(storageKey, String(getWidth()));
    refreshLayout();
  });
  handle.addEventListener("dblclick", () => {
    apply(defaultWidth);
    localStorage.setItem(storageKey, String(defaultWidth));
    refreshLayout();
  });
  updateAria();
}

setupDropZone(players.a.panel, "svga", "a");
setupDropZone(players.b.panel, "svga", "b");
setupDropZone(referenceState.panel, "reference");
setupDropZone(toolbar, "auto");
for (const slotKey of ["a", "b", "reference"]) restoreFitMode(slotKey);
setupDropdownMenus();
setupPanelResize(infoPanelResizeHandle, {
  defaultWidth: 420,
  minimum: 320,
  maximum: () => Math.max(320, Math.min(440, Math.floor(window.innerWidth * 0.42))),
  storageKey: "autoSvgaInfoPanelWidth",
  apply: applyInfoPanelWidth,
  getWidth: () => infoPanelWidth,
  bodyClass: "isResizingInfoPanel"
});
setupPanelResize(logsPanelResizeHandle, {
  defaultWidth: 440,
  minimum: 320,
  maximum: () => Math.max(320, Math.min(480, Math.floor(window.innerWidth * 0.46))),
  storageKey: "autoSvgaLogsPanelWidth",
  apply: applyLogsPanelWidth,
  getWidth: () => logsPanelWidth,
  bodyClass: "isResizingLogsPanel"
});

document.addEventListener("click", (event) => {
  if (!activeSidePanel || activeModal) return;
  const activePanel = activeSidePanel === "info" ? infoPanel : logsPanel;
  const activeTrigger = activeSidePanel === "info" ? infoPanelButton : logsButton;
  const eventPath = event.composedPath();
  if (eventPath.includes(activePanel) || eventPath.includes(activeTrigger)) return;
  if (eventPath.includes(toolbar) || eventPath.includes(rescanButton)) return;
  if (event.target.closest(".toolbar, #rescanButton, .dropdownMenu, .fitMenu, .resizeHandle")) return;
  setActiveSidePanel(null);
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    if (!assetPreviewModal.hidden) {
      event.preventDefault();
      closeAssetPreview();
      return;
    }
    if (!settingsModal.hidden) {
      event.preventDefault();
      closeSettings();
      return;
    }
    const openMenu = [...document.querySelectorAll(".dropdownMenu, [data-fit-menu]")].find((menu) => !menu.hidden);
    if (openMenu) {
      event.preventDefault();
      closeDropdown(openMenu, true);
      return;
    }
    if (activeSidePanel) {
      event.preventDefault();
      setActiveSidePanel(null);
      return;
    }
  }
  if (event.code !== "Space" || event.repeat) return;
  const target = event.target;
  const tagName = target?.tagName?.toLowerCase();
  if (["input", "select", "textarea"].includes(tagName) || target?.isContentEditable) return;
  if (!settingsModal.hidden || !assetPreviewModal.hidden) return;
  event.preventDefault();
  if (isCompareActive() || modeSelect.value === "exportReview") {
    toggleSyncPlayback();
  } else {
    toggleSlot(players.a);
  }
});

try {
  applyInfoPanelWidth(infoPanelWidth);
  applyLogsPanelWidth(logsPanelWidth);
  applyThemePreference(localStorage.getItem("autoSvgaTheme") ?? "system");
  setPreviewBackground(localStorage.getItem("autoSvgaPreviewBackground") ?? "checkerboard");
  installStateProbe();
  for (const input of [localProgress, playerBProgress, referenceProgress, syncProgress]) {
    updateRangeProgress(input, Number(input.value));
  }
  setAppMode("localPreview");
  setStatus(players.a.status, "empty");
  updateButtons();
  renderInfoPanel();
  const requestedJob = new URLSearchParams(window.location.search).get("job");
  const requestedMode = new URLSearchParams(window.location.search).get("mode");
  if (requestedJob) {
    await loadJobOutput(requestedJob);
  } else {
    try {
      defaultReport = await loadReport(paths.report);
      renderReport(defaultReport);
    } catch {
      renderReport(undefined);
    }
    if (requestedMode === "export" && autoLoadLatestToggle.checked) {
      await scanLatestArtifact();
    }
  }
  if (isSmokeMode) {
    await runProductSmoke();
  }
} catch (error) {
  setStatus(players.a.status, "error");
  showError(error instanceof Error ? error.message : String(error));
  renderReport(defaultReport);
  if (isSmokeMode && electronBridge?.reportSmokeResult) {
    await electronBridge.reportSmokeResult({
      localPage: false,
      localOnly: false,
      strictCsp: false,
      noCspViolation: false,
      playback: false,
      canvasNonBlank: false,
      inspectionReport: false,
      auditPanel: false,
      fileInput: false,
      dragDrop: false,
      errorFile: false,
      playerLifecycle: false,
      cleanup: false
    });
  }
}
