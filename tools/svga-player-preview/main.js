const paths = {
  svga: "/examples/avatar_frame_basic/output/avatar_frame_basic.svga",
  gif: "/examples/avatar_frame_basic/output/preview.gif",
  report: "/examples/avatar_frame_basic/output/report.json"
};

const reportLabels = {
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
  loading: "加载中 / LOADING",
  loaded: "已加载 / LOADED",
  playing: "播放中 / PLAYING",
  empty: "空 / EMPTY",
  error: "错误 / ERROR"
};

const players = {
  a: createPlayerSlot("A"),
  b: createPlayerSlot("B")
};

const gifState = {
  frame: document.querySelector("#gifFrame"),
  panel: document.querySelector("#gifPanel"),
  preview: document.querySelector("#gifPreview"),
  emptyState: document.querySelector("#gifEmptyState"),
  info: document.querySelector("#gifSizeInfo"),
  status: document.querySelector("#gifStatus"),
  objectUrl: undefined,
  metrics: undefined
};

const replayButton = document.querySelector("#replayButton");
const syncReplayButton = document.querySelector("#syncReplayButton");
const reportGrid = document.querySelector("#reportGrid");
const errorBox = document.querySelector("#errorBox");
const svgaFileInput = document.querySelector("#svgaFileInput");
const gifFileInput = document.querySelector("#gifFileInput");
const compareModeSelect = document.querySelector("#compareModeSelect");
const fitModeSelect = document.querySelector("#fitModeSelect");
const fileBar = document.querySelector(".fileBar");

let defaultReport;

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
    source: undefined
  };
}

function showError(message) {
  errorBox.hidden = false;
  errorBox.textContent = message;
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
    throw new Error("pako 加载失败，无法解析 SVGA 尺寸。/ pako failed to load; SVGA metadata cannot be decoded.");
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
  const rows = [
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
    sampledFrameCount: report?.bakedSweepSampledFrameCount ?? report?.sampledFrameCount
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

function computeDisplaySize(sourceWidth, sourceHeight, frameElement) {
  const available = getStageAvailableSize(frameElement);
  const aspectRatio = sourceWidth / sourceHeight;
  const mode = fitModeSelect.value;
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

function applyMediaSize(frameElement, metrics) {
  if (!metrics?.sourceWidth || !metrics?.sourceHeight) {
    frameElement.style.removeProperty("width");
    frameElement.style.removeProperty("height");
    return;
  }

  const displaySize = computeDisplaySize(metrics.sourceWidth, metrics.sourceHeight, frameElement);
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

  const aspectRatio = metrics.sourceWidth && metrics.sourceHeight
    ? (metrics.sourceWidth / metrics.sourceHeight).toFixed(4)
    : "n/a";
  const rows = [
    ["文件名 / fileName", metrics.fileName],
    [reportLabels.fileSizeBytes, formatBytes(metrics.fileSizeBytes)],
    ["SVGA viewBoxWidth", metrics.sourceWidth],
    ["SVGA viewBoxHeight", metrics.sourceHeight],
    ["宽高比 / aspectRatio", aspectRatio],
    ["显示宽度 / displayedWidth", metrics.displayedWidth],
    ["显示高度 / displayedHeight", metrics.displayedHeight],
    [reportLabels.frameCount, metrics.frameCount],
    [reportLabels.imageCount, metrics.imageCount],
    [reportLabels.spriteCount, metrics.spriteCount],
    [reportLabels.bakedSweepFrameStride, metrics.bakedSweepFrameStride],
    [reportLabels.sampledFrameCount, metrics.sampledFrameCount]
  ];

  slot.info.innerHTML = rows.map(([label, value]) => (
    `<div><dt>${label}</dt><dd>${escapeHtml(value ?? "n/a")}</dd></div>`
  )).join("");
}

function renderGifInfo() {
  const metrics = gifState.metrics;
  if (!metrics) {
    gifState.info.innerHTML = "";
    return;
  }

  const aspectRatio = metrics.sourceWidth && metrics.sourceHeight
    ? (metrics.sourceWidth / metrics.sourceHeight).toFixed(4)
    : "n/a";
  const rows = [
    ["文件名 / fileName", metrics.fileName],
    ["GIF 宽度 / GIF width", metrics.sourceWidth],
    ["GIF 高度 / GIF height", metrics.sourceHeight],
    ["宽高比 / aspectRatio", aspectRatio],
    ["显示宽度 / displayedWidth", metrics.displayedWidth],
    ["显示高度 / displayedHeight", metrics.displayedHeight]
  ];

  gifState.info.innerHTML = rows.map(([label, value]) => (
    `<div><dt>${label}</dt><dd>${escapeHtml(value ?? "n/a")}</dd></div>`
  )).join("");
}

function refreshLayout() {
  for (const slot of Object.values(players)) {
    applyMediaSize(slot.frame, slot.metrics);
    renderSvgaInfo(slot);
  }
  applyMediaSize(gifState.frame, gifState.metrics);
  renderGifInfo();
}

function updateButtons() {
  replayButton.disabled = !players.a.videoItem;
  syncReplayButton.disabled = compareModeSelect.value !== "svgaAB" || (!players.a.videoItem && !players.b.videoItem);
}

function setCompareMode() {
  const isAB = compareModeSelect.value === "svgaAB";
  players.b.panel.classList.toggle("isHidden", !isAB);
  gifState.panel.classList.toggle("isHidden", isAB);
  syncReplayButton.hidden = !isAB;
  updateButtons();
  refreshLayout();
}

function loadGif(source = `${paths.gif}?t=${Date.now()}`, options = {}) {
  clearError();
  setStatus(gifState.status, "loading");
  gifState.emptyState.hidden = true;
  gifState.preview.hidden = false;
  gifState.preview.src = source;
  gifState.preview.addEventListener("load", () => {
    gifState.metrics = {
      fileName: options.fileName ?? "preview.gif",
      sourceWidth: gifState.preview.naturalWidth,
      sourceHeight: gifState.preview.naturalHeight
    };
    refreshLayout();
    setStatus(gifState.status, "loaded");
  }, { once: true });
  gifState.preview.addEventListener("error", () => {
    setStatus(gifState.status, "error");
    showError(`GIF 预览加载失败。/ Unable to load GIF preview: ${source}`);
  }, { once: true });
}

function clearGif() {
  if (gifState.objectUrl) {
    URL.revokeObjectURL(gifState.objectUrl);
    gifState.objectUrl = undefined;
  }
  gifState.preview.removeAttribute("src");
  gifState.preview.hidden = true;
  gifState.metrics = undefined;
  gifState.frame.style.removeProperty("width");
  gifState.frame.style.removeProperty("height");
  gifState.info.innerHTML = "";
  gifState.emptyState.hidden = false;
  setStatus(gifState.status, "empty");
}

function rebuildPlayer(slot) {
  slot.canvas.innerHTML = "";
  slot.player = new window.SVGA.Player(`#${slot.canvas.id}`);
  slot.player.loops = 0;
  slot.player.clearsAfterStop = false;
  slot.player.setContentMode("AspectFit");
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
  setStatus(slot.status, "playing");
}

function syncReplay() {
  clearError();
  replaySlot(players.a, false);
  replaySlot(players.b, false);
  if (!players.a.videoItem && !players.b.videoItem) {
    showError("当前没有可同步播放的 SVGA。/ No SVGA files are loaded for sync replay.");
  }
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

  return {
    sourceWidth: Number.isFinite(width) && width > 0 ? width : undefined,
    sourceHeight: Number.isFinite(height) && height > 0 ? height : undefined,
    fps: fpsField?.value,
    frameCount: framesField?.value,
    imageCount: movie.filter((field) => field.number === 3 && field.wireType === 2).length,
    spriteCount: movie.filter((field) => field.number === 4 && field.wireType === 2).length
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

async function loadSvga(slotKey, source = paths.svga, options = {}) {
  ensureSvgaLibrary();
  const slot = players[slotKey];
  clearError();

  if (!options.isDefault && compareModeSelect.value === "svgaGif" && slotKey === "a") {
    clearGif();
  }

  slot.source = source;
  slot.videoItem = undefined;
  slot.report = options.report;
  setStatus(slot.status, "loading");
  updateButtons();

  const decodedInfoPromise = decodeSvgaInfo(source).catch(() => undefined);
  const parser = new window.SVGA.Parser(`#${slot.canvas.id}`);

  parser.load(
    source,
    async (loadedVideoItem) => {
      const decodedInfo = await decodedInfoPromise;
      const playerSize = extractSizeFromVideoItem(loadedVideoItem);
      const reportMetrics = extractReportMetrics(slot.report);
      slot.videoItem = loadedVideoItem;
      slot.metrics = {
        ...decodedInfo,
        ...playerSize,
        ...reportMetrics,
        fileName: options.fileName ?? `SVGA ${slot.slotName}`,
        fileSizeBytes: options.fileSizeBytes ?? reportMetrics.fileSizeBytes,
        sourceWidth: playerSize?.sourceWidth ?? decodedInfo?.sourceWidth,
        sourceHeight: playerSize?.sourceHeight ?? decodedInfo?.sourceHeight
      };

      if (!slot.metrics.sourceWidth || !slot.metrics.sourceHeight) {
        setStatus(slot.status, "loaded");
        showError(`SVGA 已加载，但无法读取 viewBox 尺寸。/ SVGA loaded, but viewBox size could not be read for player ${slot.slotName}.`);
      }

      refreshLayout();
      rebuildPlayer(slot);
      replaySlot(slot, false);
      refreshLayout();
      updateButtons();
    },
    (error) => {
      setStatus(slot.status, "error");
      slot.videoItem = undefined;
      showError(`SVGA 文件加载失败。/ Unable to load SVGA file: ${error?.message ?? error}`);
      updateButtons();
    }
  );
}

function handleSvgaFile(file, slotKey) {
  const slot = players[slotKey];
  if (slot.objectUrl) {
    URL.revokeObjectURL(slot.objectUrl);
  }
  slot.objectUrl = URL.createObjectURL(file);
  loadSvga(slotKey, slot.objectUrl, {
    fileName: file.name,
    fileSizeBytes: file.size,
    isDefault: false
  });
}

function handleGifFile(file) {
  if (gifState.objectUrl) {
    URL.revokeObjectURL(gifState.objectUrl);
  }
  gifState.objectUrl = URL.createObjectURL(file);
  loadGif(gifState.objectUrl, { fileName: file.name });
}

function handleDroppedFile(file, acceptedKind, slotKey = "a") {
  clearError();
  const kind = fileKind(file);
  if (!kind) {
    showError(`文件类型不支持：${file.name}。/ Unsupported file type. Please drop a .svga file or .gif file.`);
    return;
  }
  if (acceptedKind !== "auto" && kind !== acceptedKind) {
    showError(kind === "svga"
      ? "文件类型不匹配，请把 .svga 文件拖入 SVGA 播放器面板。/ .svga files can only be dropped on an SVGA Player panel."
      : "文件类型不匹配，请把 .gif 文件拖入 GIF 预览面板。/ .gif files can only be dropped on the GIF Preview panel.");
    return;
  }

  if (kind === "svga") {
    handleSvgaFile(file, acceptedKind === "auto" ? getAutoSvgaSlot() : slotKey);
  } else {
    if (compareModeSelect.value === "svgaAB") {
      showError("当前是 SVGA A/B 模式，不显示 GIF 预览。/ GIF preview is hidden in SVGA A/B mode.");
      return;
    }
    handleGifFile(file);
  }
}

function getAutoSvgaSlot() {
  if (compareModeSelect.value !== "svgaAB") {
    return "a";
  }
  return players.a.videoItem && !players.b.videoItem ? "b" : "a";
}

function fileKind(file) {
  const name = file.name.toLowerCase();
  if (name.endsWith(".svga")) {
    return "svga";
  }
  if (name.endsWith(".gif")) {
    return "gif";
  }
  return undefined;
}

function setupDropZone(element, acceptedKind, slotKey) {
  element.addEventListener("dragover", (event) => {
    event.preventDefault();
    element.classList.add("isDragOver");
  });

  element.addEventListener("dragleave", (event) => {
    if (!element.contains(event.relatedTarget)) {
      element.classList.remove("isDragOver");
    }
  });

  element.addEventListener("drop", (event) => {
    event.preventDefault();
    element.classList.remove("isDragOver");
    const file = event.dataTransfer?.files?.[0];
    if (!file) {
      return;
    }
    handleDroppedFile(file, acceptedKind, slotKey);
  });
}

function formatBytes(value) {
  if (!Number.isFinite(Number(value))) {
    return value ?? "n/a";
  }
  return `${Number(value)} B`;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

replayButton.addEventListener("click", () => {
  clearError();
  replaySlot(players.a);
});

syncReplayButton.addEventListener("click", syncReplay);

compareModeSelect.addEventListener("change", setCompareMode);

fitModeSelect.addEventListener("change", () => {
  refreshLayout();
  for (const slot of Object.values(players)) {
    if (slot.videoItem) {
      rebuildPlayer(slot);
      replaySlot(slot, false);
    }
  }
});

window.addEventListener("resize", () => {
  refreshLayout();
  for (const slot of Object.values(players)) {
    if (slot.videoItem) {
      rebuildPlayer(slot);
      replaySlot(slot, false);
    }
  }
});

svgaFileInput.addEventListener("change", () => {
  const file = svgaFileInput.files?.[0];
  if (file) {
    handleDroppedFile(file, "svga", getAutoSvgaSlot());
  }
});

gifFileInput.addEventListener("change", () => {
  const file = gifFileInput.files?.[0];
  if (file) {
    handleDroppedFile(file, "gif");
  }
});

setupDropZone(players.a.panel, "svga", "a");
setupDropZone(players.b.panel, "svga", "b");
setupDropZone(gifState.panel, "gif");
setupDropZone(fileBar, "auto");

try {
  setCompareMode();
  loadGif(`${paths.gif}?t=${Date.now()}`, { fileName: "preview.gif" });
  defaultReport = await loadReport(paths.report);
  renderReport(defaultReport);
  await loadSvga("a", paths.svga, {
    fileName: "avatar_frame_basic.svga",
    isDefault: true,
    report: defaultReport
  });
} catch (error) {
  setStatus(players.a.status, "error");
  showError(error instanceof Error ? error.message : String(error));
  renderReport(defaultReport);
}
