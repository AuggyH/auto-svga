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
const settingsDoneButton = document.querySelector("#settingsDoneButton");
const logsPanel = document.querySelector("#logsPanel");
const fullLogsContent = document.querySelector("#fullLogsContent");
const fullLogsSubtitle = document.querySelector("#fullLogsSubtitle");
const copyFullLogsButton = document.querySelector("#copyFullLogsButton");
const clearFullLogsButton = document.querySelector("#clearFullLogsButton");
const infoPanelResizeHandle = document.querySelector("#infoPanelResizeHandle");

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
let compareEnabled = false;
let syncIsPlaying = false;
let infoPanelWidth = Number(localStorage.getItem("autoSvgaInfoPanelWidth")) || Math.round(window.innerWidth * 0.15);

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
  addLog("error", message);
}

function clearError() {
  errorBox.hidden = true;
  errorBox.textContent = "";
}

function setStatus(element, value) {
  element.textContent = statusText[value] ?? value;
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
  infoPanelButton.classList.toggle("isActive", !document.querySelector("#infoPanel").classList.contains("isHidden"));
  logsButton.classList.toggle("isActive", !logsPanel.classList.contains("isHidden"));
  infoPanelButton.setAttribute("aria-pressed", String(!document.querySelector("#infoPanel").classList.contains("isHidden")));
  logsButton.setAttribute("aria-pressed", String(!logsPanel.classList.contains("isHidden")));
  updatePlaybackButtons();
  updateSyncPlaybackButton();
}

function setAppMode(nextMode = modeSelect.value) {
  if (nextMode === "localCompare") nextMode = "localPreview";
  modeSelect.value = nextMode;
  workspace.className = `workspace mode-${nextMode}${compareEnabled && nextMode === "localPreview" ? " withCompare" : ""}`;
  workspace.classList.toggle("withInfoPanel", !document.querySelector("#infoPanel").classList.contains("isHidden"));
  workspace.classList.toggle("withLogsPanel", !logsPanel.classList.contains("isHidden"));
  players.b.panel.classList.toggle("isHidden", !isCompareActive());
  referenceState.panel.classList.toggle("isHidden", nextMode !== "exportReview");
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

function openInfoPanel(tabName = "overview") {
  document.querySelector("#infoPanel").classList.remove("isHidden");
  workspace.classList.add("withInfoPanel");
  infoPanelButton.classList.add("isActive");
  infoPanelButton.setAttribute("aria-pressed", "true");
  const target = tabButtons.find((button) => button.dataset.tab === tabName) ?? tabButtons[0];
  for (const item of tabButtons) item.classList.toggle("isActive", item === target);
  for (const panel of document.querySelectorAll(".tabPanel")) panel.classList.add("isHidden");
  document.querySelector(`#tab-${target.dataset.tab}`).classList.remove("isHidden");
  refreshLayout();
}

function applyInfoPanelWidth(width) {
  const viewportMaximum = Math.max(1, Math.floor(window.innerWidth * 0.15));
  const minimum = Math.min(220, viewportMaximum);
  infoPanelWidth = Math.min(viewportMaximum, Math.max(minimum, Math.round(width)));
  document.documentElement.style.setProperty("--info-panel-width", `${infoPanelWidth}px`);
}

function closeInfoPanel() {
  document.querySelector("#infoPanel").classList.add("isHidden");
  workspace.classList.remove("withInfoPanel");
  infoPanelButton.classList.remove("isActive");
  infoPanelButton.setAttribute("aria-pressed", "false");
  refreshLayout();
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
  updateSyncPlaybackButton();
  startSyncTicker();
}

function syncPause() {
  pauseSlot(players.a);
  pauseSlot(players.b);
  referenceState.video.pause();
  stopReferenceTicker();
  syncIsPlaying = false;
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
  syncPlayControl.innerHTML = syncIsPlaying
    ? `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5v14" /><path d="M16 5v14" /></svg>`
    : `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5v14l11-7z" /></svg>`;
  syncPlayControl.title = syncIsPlaying ? "同步暂停" : "同步播放";
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
  slot.source = source;
  slot.videoItem = undefined;
  slot.report = options.report;
  slot.parseStatus = "loading";
  slot.renderStatus = "loading";
  setStatus(slot.status, "loading");
  updateButtons();
  renderInfoPanel();
  addLog("info", `开始解析 SVGA：${options.fileName ?? source} / Parsing SVGA`);

  const decodedInfoPromise = decodeSvgaInfo(source).catch((error) => {
    slot.parseStatus = "error";
    addLog("error", `SVGA 元数据解析失败 / Metadata parse failed: ${error.message}`);
    return undefined;
  });
  const parser = new window.SVGA.Parser(`#${slot.canvas.id}`);

  parser.load(
    source,
    async (loadedVideoItem) => {
      const decodedInfo = await decodedInfoPromise;
      const playerSize = extractSizeFromVideoItem(loadedVideoItem);
      const reportMetrics = extractReportMetrics(slot.report);
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
      refreshLayout();
      updateButtons();
      addLog("success", `SVGA 加载完成：${slot.metrics.fileName} / SVGA loaded`);
    },
    (error) => {
      setStatus(slot.status, "error");
      slot.videoItem = undefined;
      slot.parseStatus = "error";
      slot.renderStatus = "error";
      showError(`SVGA 文件加载失败。/ Unable to load SVGA file: ${error?.message ?? error}`);
      updateButtons();
      renderInfoPanel();
    }
  );
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

function handleDroppedFile(file, acceptedKind, slotKey = "a") {
  clearError();
  const kind = fileKind(file);
  if (!kind) {
    showError(`文件类型不支持：${file.name}。/ Unsupported file type.`);
    return;
  }
  if (acceptedKind !== "auto" && acceptedKind !== kind && !(acceptedKind === "reference" && ["mp4", "webm", "gif"].includes(kind))) {
    const message = acceptedKind === "svga"
      ? "文件类型不支持，请拖入 .svga 文件。/ Unsupported file type. Please drop a .svga file."
      : "文件类型不支持，请拖入 .mp4、.webm 或 .gif 文件。/ Unsupported file type. Please drop a video or GIF.";
    showError(message);
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
    return `<div class="emptyPanel">暂无文件信息。选择或拖入 SVGA 文件后查看详情。/ No SVGA loaded.</div>`;
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
    <dl class="overviewGrid">
      ${rows.map(([label, key, value, tone]) => `
        <div class="overviewRow">
          <dt><span>${escapeHtml(label)}</span><small>${escapeHtml(key)}</small></dt>
          <dd class="${tone === "mono" ? "monoValue" : ""}">${escapeHtml(value ?? "n/a")}</dd>
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
    return `${filterBar}<div class="emptyPanel">暂无资源信息 / No asset data</div>`;
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
      ${filtered.length ? filtered.map(renderAssetEntry).join("") : `<div class="emptyPanel">当前筛选没有资源 / No assets match this filter</div>`}
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
        <div class="assetSecondaryLine">
          <span title="${escapeHtml(asset.imageKey ?? "n/a")}">${escapeHtml(asset.imageKey ?? "n/a")}</span>
          <span>${escapeHtml(formatSize(asset.width, asset.height))}</span>
          <span>${escapeHtml(formatBytes(asset.byteSize))}</span>
          <span>引用×${escapeHtml(asset.referenceCount ?? 0)}</span>
          ${asset.frameCount ? `<span>${escapeHtml(asset.frameCount)} 帧</span>` : ""}
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
  fullLogsSubtitle.textContent = `运行日志 · ${appLogs.length} 条 / Runtime Logs`;
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
    return `<strong class="syncFileBadge ${tone === "reference" ? "isReference" : ""}">${label}</strong><span>暂未加载</span>`;
  }
  const meta = [
    formatSize(metrics.sourceWidth, metrics.sourceHeight),
    formatBytes(metrics.fileSizeBytes),
    formatDuration(metrics)
  ].filter((item) => item && item !== "n/a").join(" · ");
  return `
    <strong class="syncFileBadge ${tone === "reference" ? "isReference" : ""}">${escapeHtml(label)}</strong>
    <span title="${escapeHtml(metrics.fileName ?? "n/a")}">${escapeHtml(metrics.fileName ?? "n/a")}</span>
    <small>${escapeHtml(meta || "n/a")}</small>
  `;
}

function getReferenceSyncLabel() {
  if (referenceState.kind === "gif") return "GIF";
  if (referenceState.kind === "webm") return "WEBM";
  return "MP4";
}

function renderSyncWarnings(left, right) {
  if (!left || !right) return "";
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
    return `
      <span class="syncMatchedStatus">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 6 9 17l-5-5" /></svg>
        <span>规格一致</span>
      </span>
    `;
  }
  return warnings.map((warning) => `
    <span class="syncWarningPill">
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 8v5" /><path d="M12 17h.01" /><path d="M10.3 4.5 2.8 17.5A2 2 0 0 0 4.5 20h15a2 2 0 0 0 1.7-2.5L13.7 4.5a2 2 0 0 0-3.4 0Z" /></svg>
      <span><strong>${escapeHtml(warning.title)}</strong></span>
    </span>
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

function updatePlaybackButtons() {
  localPlayPauseButton.innerHTML = players.a.isPlaying
    ? `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5v14" /><path d="M16 5v14" /></svg>`
    : `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5v14l11-7z" /></svg>`;
  playerBPlayPauseButton.innerHTML = players.b.isPlaying
    ? `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5v14" /><path d="M16 5v14" /></svg>`
    : `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5v14l11-7z" /></svg>`;
  localPlayPauseButton.disabled = !players.a.videoItem;
  localReplayButton.disabled = !players.a.videoItem;
  playerBPlayPauseButton.disabled = !players.b.videoItem;
  playerBReplayButton.disabled = !players.b.videoItem;
  referencePlayPauseButton.disabled = !referenceState.metrics;
  referenceReplayButton.disabled = !referenceState.metrics;
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
  assetPreviewModal.hidden = false;
}

function closeAssetPreview() {
  assetPreviewModal.hidden = true;
  assetPreviewImage.removeAttribute("src");
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
}

function setPreviewBackground(value) {
  localStorage.setItem("autoSvgaPreviewBackground", value);
  document.documentElement.dataset.previewBackground = value;
  for (const input of document.querySelectorAll('input[name="previewBackground"]')) {
    input.checked = input.value === value;
  }
}

function openSettings() {
  settingsModal.hidden = false;
}

function closeSettings() {
  settingsModal.hidden = true;
}

function openFullLogs() {
  logsPanel.classList.remove("isHidden");
  workspace.classList.add("withLogsPanel");
  logsButton.classList.add("isActive");
  logsButton.setAttribute("aria-pressed", "true");
  renderLogsPanel();
  refreshLayout();
}

function closeFullLogs() {
  logsPanel.classList.add("isHidden");
  workspace.classList.remove("withLogsPanel");
  logsButton.classList.remove("isActive");
  logsButton.setAttribute("aria-pressed", "false");
  refreshLayout();
}

function closeFitMenus(exceptSlot) {
  for (const menu of document.querySelectorAll("[data-fit-menu]")) {
    if (menu.dataset.fitMenu === exceptSlot) continue;
    menu.hidden = true;
    menu.parentElement?.querySelector(".fitMenuButton")?.setAttribute("aria-expanded", "false");
  }
}

function applyFitMode(slotKey, value) {
  const select = slotKey === "a" ? fitModeA : slotKey === "b" ? fitModeB : fitModeReference;
  select.value = value;
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
    option.setAttribute("aria-current", selected ? "true" : "false");
  }
}

function setupFitMenus() {
  for (const menu of document.querySelectorAll("[data-fit-menu]")) {
    const slotKey = menu.dataset.fitMenu;
    const trigger = menu.parentElement.querySelector(".fitMenuButton");
    const items = [...menu.querySelectorAll(".dropdownMenuItem")];

    trigger.addEventListener("click", (event) => {
      event.stopPropagation();
      const shouldOpen = menu.hidden;
      closeFitMenus(slotKey);
      updateFitMenuSelection(slotKey);
      menu.hidden = !shouldOpen;
      trigger.setAttribute("aria-expanded", String(shouldOpen));
      if (shouldOpen && items.length) items[0].focus();
    });
    trigger.addEventListener("keydown", (event) => {
      if (event.key === "ArrowDown") {
        event.preventDefault();
        menu.hidden = false;
        trigger.setAttribute("aria-expanded", "true");
        if (items.length) items[0].focus();
      }
    });
    menu.addEventListener("keydown", (event) => {
      const idx = items.indexOf(document.activeElement);
      if (event.key === "ArrowDown") {
        event.preventDefault();
        items[Math.min(idx + 1, items.length - 1)]?.focus();
      } else if (event.key === "ArrowUp") {
        event.preventDefault();
        items[Math.max(idx - 1, 0)]?.focus();
      } else if (event.key === "Escape") {
        closeFitMenus();
        trigger.focus();
      }
    });
    menu.addEventListener("click", (event) => {
      const option = event.target.closest("[data-fit-value]");
      if (!option) return;
      applyFitMode(slotKey, option.dataset.fitValue);
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
  const current = localStorage.getItem("autoSvgaTheme") ?? "system";
  const next = current === "system" ? "light" : current === "light" ? "dark" : "system";
  setThemePreference(next);
});
syncPlayControl.addEventListener("click", toggleSyncPlayback);
syncReplayControl.addEventListener("click", syncReplay);
primaryEmptyFileButton.addEventListener("click", () => svgaFileInput.click());
secondaryEmptyFileButton.addEventListener("click", () => secondaryFileInput.click());
referenceEmptyFileButton.addEventListener("click", () => referenceFileInput.click());
modeSelect.addEventListener("change", () => {
  setAppMode(modeSelect.value);
  if (modeSelect.value === "exportReview") {
    autoLoadLatestArtifact();
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
    if (slotKey === "reference") return;
    const slot = players[slotKey];
    if (slot?.videoItem) {
      rebuildPlayer(slot);
      replaySlot(slot, false);
    }
  });
}

window.addEventListener("resize", () => {
  applyInfoPanelWidth(infoPanelWidth);
  refreshLayout();
  for (const slot of Object.values(players)) {
    if (slot.videoItem) {
      rebuildPlayer(slot);
      replaySlot(slot, false);
    }
  }
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
settingsDoneButton.addEventListener("click", closeSettings);
settingsModal.addEventListener("click", (event) => {
  if (event.target === settingsModal) closeSettings();
});
copyFullLogsButton.addEventListener("click", () => {
  navigator.clipboard?.writeText(serializeLogs()).catch(() => undefined);
});
clearFullLogsButton.addEventListener("click", () => {
  appLogs.length = 0;
  renderInfoPanel();
  renderLogsPanel();
});
for (const input of document.querySelectorAll('input[name="theme"]')) {
  input.addEventListener("change", () => setThemePreference(input.value));
}
for (const input of document.querySelectorAll('input[name="previewBackground"]')) {
  input.addEventListener("change", () => setPreviewBackground(input.value));
}
window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => {
  if ((localStorage.getItem("autoSvgaTheme") ?? "system") === "system") {
    applyThemePreference("system");
  }
});
infoPanelResizeHandle.addEventListener("pointerdown", (event) => {
  event.preventDefault();
  const startX = event.clientX;
  const startWidth = infoPanelWidth;
  document.body.classList.add("isResizingInfoPanel");
  infoPanelResizeHandle.setPointerCapture?.(event.pointerId);

  const onPointerMove = (moveEvent) => {
    applyInfoPanelWidth(startWidth + startX - moveEvent.clientX);
    refreshLayout();
  };
  const onPointerUp = () => {
    document.body.classList.remove("isResizingInfoPanel");
    localStorage.setItem("autoSvgaInfoPanelWidth", String(infoPanelWidth));
    window.removeEventListener("pointermove", onPointerMove);
    window.removeEventListener("pointerup", onPointerUp);
  };

  window.addEventListener("pointermove", onPointerMove);
  window.addEventListener("pointerup", onPointerUp);
});

setupDropZone(players.a.panel, "svga", "a");
setupDropZone(players.b.panel, "svga", "b");
setupDropZone(referenceState.panel, "reference");
setupDropZone(toolbar, "auto");
setupFitMenus();

document.addEventListener("keydown", (event) => {
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

// ── Auto-load latest export artifact ──
async function autoLoadLatestArtifact() {
  addLog("info", "正在扫描本地最新导出产物… / Scanning for latest export artifacts");
  try {
    const response = await fetch("/api/latest-artifact");
    if (!response.ok) throw new Error(`API ${response.status}`);
    const data = await response.json();
    if (!data.latest) {
      addLog("warning", "未找到本地输出产物 / No local export artifacts found");
      return;
    }
    const a = data.latest;
    addLog("success", `找到最新产物：${a.jobId} / Latest: ${a.jobId}`);

    // Load SVGA
    if (a.svgaPath) {
      try {
        const svgaResponse = await fetch(`/${a.svgaPath}`);
        if (svgaResponse.ok) {
          const blob = await svgaResponse.blob();
          const file = new File([blob], a.svgaPath.split("/").pop(), { type: "application/octet-stream" });
          setAppMode("exportReview");
          await loadSvgaFile({ file, slotKey: "a" });
          addLog("success", `已自动加载 SVGA: ${a.svgaPath}`);
        }
      } catch (e) {
        addLog("error", `SVGA 加载失败: ${e.message}`);
      }
    }

    // Load reference (MP4 preferred, WebM fallback, GIF last)
    const refPath = a.mp4Path || a.webmPath || a.gifPath;
    if (refPath) {
      try {
        const refResponse = await fetch(`/${refPath}`);
        if (refResponse.ok) {
          const blob = await refResponse.blob();
          const file = new File([blob], refPath.split("/").pop());
          await loadReference(file, { fileName: file.name, fileSizeBytes: file.size });
          addLog("success", `已自动加载参考: ${refPath}`);
        }
      } catch (e) {
        addLog("warning", `参考加载失败: ${e.message}`);
      }
    }

    // Load report if available
    if (a.reportPath) {
      try {
        const r = await loadReport(`/${a.reportPath}`);
        if (r) {
          defaultReport = r;
          renderReport(r);
        }
      } catch { /* silent */ }
    }
  } catch (err) {
    addLog("error", `产物扫描失败: ${err.message}`);
  }
}

// ── Panel resize handles ──
function setupPanelResize() {
  const infoPanel = document.querySelector("#infoPanel");
  const logsPanel = document.querySelector("#logsPanel");

  for (const [panel, storageKey, minW, maxW, defaultW] of [
    [infoPanel, "autoSvgaInfoPanelWidth", 320, Math.min(560, Math.floor(window.innerWidth * 0.42)), 420],
    [logsPanel, "autoSvgaLogsPanelWidth", 420, Math.min(720, Math.floor(window.innerWidth * 0.5)), 560]
  ]) {
    if (!panel) continue;
    // Restore saved width
    const saved = Number(localStorage.getItem(storageKey));
    if (saved >= minW && saved <= maxW) {
      panel.style.width = `${saved}px`;
    }
    // Create resize handle
    const handle = document.createElement("div");
    handle.className = "panelResizeHandle";
    handle.title = "拖拽调整宽度 / Drag to resize";
    handle.setAttribute("aria-label", "调整面板宽度");
    handle.setAttribute("role", "separator");
    handle.setAttribute("tabindex", "0");
    handle.addEventListener("dblclick", () => {
      panel.style.width = `${defaultW}px`;
      localStorage.setItem(storageKey, String(defaultW));
      refreshLayout();
    });
    let dragging = false, startX = 0, startW = 0;
    handle.addEventListener("pointerdown", (e) => {
      dragging = true;
      startX = e.clientX;
      startW = panel.offsetWidth;
      handle.setPointerCapture(e.pointerId);
      document.body.style.userSelect = "none";
      document.body.style.cursor = "col-resize";
    });
    window.addEventListener("pointermove", (e) => {
      if (!dragging) return;
      const delta = startX - e.clientX;
      const newW = Math.max(minW, Math.min(maxW, startW + delta));
      panel.style.width = `${newW}px`;
      localStorage.setItem(storageKey, String(Math.round(newW)));
      refreshLayout();
    });
    window.addEventListener("pointerup", () => {
      if (!dragging) return;
      dragging = false;
      document.body.style.userSelect = "";
      document.body.style.cursor = "";
    });
    panel.insertBefore(handle, panel.firstChild);
  }
}

try {
  applyInfoPanelWidth(infoPanelWidth);
  applyThemePreference(localStorage.getItem("autoSvgaTheme") ?? "system");
  setPreviewBackground(localStorage.getItem("autoSvgaPreviewBackground") ?? "checkerboard");
  for (const input of [localProgress, playerBProgress, referenceProgress, syncProgress]) {
    updateRangeProgress(input, Number(input.value));
  }
  setAppMode("localPreview");
  setStatus(players.a.status, "empty");
  updateButtons();
  renderInfoPanel();
  const requestedJob = new URLSearchParams(window.location.search).get("job");
  if (requestedJob) {
    await loadJobOutput(requestedJob);
  } else {
    try {
      defaultReport = await loadReport(paths.report);
      renderReport(defaultReport);
    } catch {
      renderReport(undefined);
    }
  }

  // Auto-load in export review mode
  setupPanelResize();
  const urlMode = new URLSearchParams(window.location.search).get("mode");
  if (urlMode === "export" || (!requestedJob && localStorage.getItem("autoSvgaAutoLoad") !== "false")) {
    const autoLoadEnabled = localStorage.getItem("autoSvgaAutoLoad") !== "false";
    if (autoLoadEnabled) {
      autoLoadLatestArtifact();
    }
  }
} catch (error) {
  setStatus(players.a.status, "error");
  showError(error instanceof Error ? error.message : String(error));
  renderReport(defaultReport);
}
