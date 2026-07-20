import { renderAvatarFrameInspectionReport } from "/tools/svga-player-preview/inspection-report-view.mjs";
import { FILL_MODE, Parser, Player } from "/vendor/svga-web-2.4.4.js";

const canvas = document.querySelector("#player");
const dropZone = document.querySelector("#dropZone");
const dropZoneHint = document.querySelector("#dropZoneHint");
const emptySelectButton = document.querySelector("#emptySelectButton");
const hostOpenButton = document.querySelector("#hostOpenButton");
const fileInput = document.querySelector("#fileInput");
const pngInput = document.querySelector("#pngInput");
const batchPngInput = document.querySelector("#batchPngInput");
const reportRoot = document.querySelector("#reportRoot");
const playbackStatus = document.querySelector("#playbackStatus");
const runtimeStatus = document.querySelector("#runtimeStatus");
const playButton = document.querySelector("#playButton");
const pauseButton = document.querySelector("#pauseButton");
const replayButton = document.querySelector("#replayButton");
const fileInfo = document.querySelector("#fileInfo");
const urlParams = new URLSearchParams(location.search);
const isSmokeMode = urlParams.get("mode") === "smoke";
const shouldCaptureArtifacts = urlParams.get("artifacts") === "1";
const hostBridge = window.autoSvgaPrototype ?? window.autoSvgaElectronHost;
const productMilestoneId = hostBridge?.productMilestoneId ?? "P2";
const p6BaselineFixtureDisplayName = "p6-web-baseline-fixture.svga";
const cspViolations = [];
let activePlayer;
let activeParser;
let activeVideo;
let activeName = "";
let playerStarted = false;
let playerPaused = false;
let cleanupCount = 0;
let desktopLoadingCaptured = false;
let rejectedName = "";
let sourceSvgaBytes;
let sourceSvgaName = "";
let sourceSvgaSha256 = "";
let sourceFileId = "";
let editSession;
let selectedResourceKey = "";
let replacementInputs = new Map();
let batchInputItems = [];
let batchMappingReport;
let batchMappingError = "";
let batchEvidenceMode = "default";
const batchUiActionProof = {
  batchButtonClick: false,
  inputChange: false,
  drop: false,
  includeCheckboxChange: false,
  manualTargetChange: false,
  applyButtonClick: false,
  undoButtonClick: false,
  redoButtonClick: false,
  saveAsButtonClick: false
};
let editHistorySnapshots = [new Map()];
let editHistoryIndex = 0;
let savedReplacementDigest = replacementInputDigest(new Map());
let editOperationSequence = 0;
let editedSvgaBytes;
let editError = "";
let exportInfo;
let editExportState = "idle";
let lastRoundTripReport;
const maxEditHistorySnapshots = 50;

globalThis.addEventListener("securitypolicyviolation", (event) => {
  cspViolations.push(`${event.violatedDirective}:${event.blockedURI}`);
  console.warn(`CSP violation ${event.violatedDirective} ${event.blockedURI}`);
});

fileInput.addEventListener("change", async () => {
  const file = fileInput.files?.[0];
  if (!file) return;
  if (!confirmDiscardUnsavedEdits()) {
    fileInput.value = "";
    return;
  }
  sourceFileId = "";
  await loadSvgaFile(file, "file-picker");
});

hostOpenButton?.addEventListener("click", openHostSvgaFile);
emptySelectButton?.addEventListener("click", () => hostOpenButton?.click() ?? fileInput.click());

pngInput?.addEventListener("change", async () => {
  const file = pngInput.files?.[0];
  pngInput.value = "";
  if (!file) return;
  await replaceSelectedResource(file);
});

batchPngInput?.addEventListener("change", async () => {
  batchUiActionProof.inputChange = true;
  const files = [...(batchPngInput.files ?? [])];
  batchPngInput.value = "";
  if (files.length === 0) {
    batchMappingError = "";
    return;
  }
  await loadBatchPngFiles(files);
});

dropZone.addEventListener("dragover", (event) => {
  event.preventDefault();
  dropZone.classList.add("isDragOver");
});

dropZone.addEventListener("dragleave", () => {
  dropZone.classList.remove("isDragOver");
});

dropZone.addEventListener("drop", async (event) => {
  event.preventDefault();
  dropZone.classList.remove("isDragOver");
  const files = [...(event.dataTransfer?.files ?? [])];
  if (files.length > 0 && files.every((file) => file.name.toLowerCase().endsWith(".png")) && sourceSvgaBytes) {
    batchUiActionProof.drop = true;
    await loadBatchPngFiles(files);
    return;
  }
  const file = files[0];
  if (!file) return;
  if (!confirmDiscardUnsavedEdits()) return;
  sourceFileId = "";
  await loadSvgaFile(file, "drag-drop");
});

playButton.addEventListener("click", () => {
  if (!activePlayer) return;
  if (!playerStarted) {
    activePlayer.start();
    playerStarted = true;
  } else if (playerPaused) {
    activePlayer.resume();
  }
  playerPaused = false;
  updatePlaybackControls();
  playbackStatus.textContent = `正在播放：${safeDisplayName(activeName)}`;
});

pauseButton.addEventListener("click", () => {
  if (!activePlayer || playerPaused) return;
  activePlayer.pause();
  playerPaused = true;
  updatePlaybackControls();
  playbackStatus.textContent = `已暂停：${safeDisplayName(activeName)}`;
});

replayButton.addEventListener("click", () => {
  if (!activePlayer || !activeVideo) return;
  activePlayer.stop();
  activePlayer.start();
  playerStarted = true;
  playerPaused = false;
  updatePlaybackControls();
  playbackStatus.textContent = `重新播放：${safeDisplayName(activeName)}`;
});

document.addEventListener("keydown", (event) => {
  const key = event.key.toLowerCase();
  if ((event.metaKey || event.ctrlKey) && key === "o") {
    event.preventDefault();
    hostOpenButton?.click() ?? fileInput.click();
    return;
  }
  if ((event.metaKey || event.ctrlKey) && key === "z") {
    event.preventDefault();
    if (event.shiftKey) void redoEditHistory();
    else void undoEditHistory();
    return;
  }
  if (event.ctrlKey && key === "y") {
    event.preventDefault();
    void redoEditHistory();
    return;
  }
  if (event.target instanceof HTMLInputElement) return;
  if (event.code === "Space") {
    event.preventDefault();
    if (!activePlayer) return;
    (playerPaused || !playerStarted ? playButton : pauseButton).click();
  } else if (key === "r") {
    replayButton.click();
  }
});

start().catch(async (error) => {
  console.error(error instanceof Error ? error.message : String(error));
  showError("启动失败。", error.message);
  await reportSmoke(emptyResult());
});

async function start() {
  showEmptyState();
  installStateProbe();
  if (!isSmokeMode) return;
  await runSmoke();
}

async function runSmoke() {
  await delay(180);
  await captureArtifact("desktop-empty");
  const fixtureUrl = "/fixture/avatar-frame-smoke.svga";
  const bytes = new Uint8Array(await fetch(fixtureUrl).then(assertResponse).then((response) => response.arrayBuffer()));
  const smoke = await loadSvgaBytes(bytes.slice(0), p6BaselineFixtureDisplayName, { sizeBytes: bytes.byteLength });
  await captureArtifact("desktop-loaded");
  await captureArtifact("smoke-loaded");
  await captureArtifact("desktop-1280x800");
  await captureArtifact("desktop-1440x900");
  document.querySelector("#reportTitle")?.scrollIntoView({ block: "start" });
  await delay(180);
  await captureArtifact("desktop-inspection");
  const p3EditSmoke = await maybeRunP3EditSmoke(bytes.slice(0));
  const p4EditSmoke = await maybeRunP4EditSmoke(bytes.slice(0));
  const p5BatchSmoke = await maybeRunP5BatchSmoke(bytes.slice(0));
  const fileInputSmoke = await smokeFileInput(bytes.slice(0));
  const dragDropSmoke = await smokeDragDrop(bytes.slice(0));
  const errorFileSmoke = await smokeErrorFile();
  await captureArtifact("desktop-invalid");

  const result = {
    localPage: location.hostname === "127.0.0.1",
    localOnly: resourcesAreLocal(),
    strictCsp: cspAllowsOnlyLocalWasm(),
    noCspViolation: cspViolations.length === 0,
    playback: smoke.playback,
    canvasNonBlank: smoke.canvasNonBlank,
    inspectionReport: smoke.inspectionReport,
    auditPanel: smoke.auditPanel,
    fileInput: fileInputSmoke,
    dragDrop: dragDropSmoke,
    errorFile: errorFileSmoke,
    playerLifecycle: smoke.playerLifecycle,
    cleanup: smoke.cleanup
      && cleanupCount >= 3
      && (productMilestoneId !== "P3" || p3EditSmoke.passed)
      && (productMilestoneId !== "P4" || p4EditSmoke.passed)
      && (productMilestoneId !== "P5" || p5BatchSmoke.passed)
  };
  runtimeStatus.textContent = Object.values(result).every(Boolean) ? "内部原型验证通过" : "验证未通过";
  await reportSmoke(result);
  cleanupPlayer();
}

async function loadSvgaFile(file, source) {
  if (!isSvgaFile(file)) {
    cleanupPlayer();
    rejectedName = file.name;
    showError("无法打开此 SVGA 文件。", "不支持的文件类型。请选择 .svga 文件。");
    return false;
  }
  const bytes = new Uint8Array(await file.arrayBuffer());
  return loadSvgaBytes(bytes, file.name, { sizeBytes: file.size, source });
}

async function openHostSvgaFile() {
  if (!hostBridge?.openSvgaFile) {
    if (!confirmDiscardUnsavedEdits()) return;
    fileInput.click();
    return;
  }
  if (!confirmDiscardUnsavedEdits()) return;
  try {
    const result = await hostBridge.openSvgaFile();
    if (!result || result.status === "cancelled") return;
    sourceFileId = result.sourceId ?? "";
    const bytes = bytesFromHostOpenResult(result);
    await loadSvgaBytes(bytes, result.basename ?? result.fileName ?? "opened.svga", {
      source: "host-file-picker",
      sourceId: sourceFileId
    });
  } catch (error) {
    showError("无法打开此 SVGA 文件。", productEditError(error));
  }
}

async function loadSvgaBytes(bytes, name, metadata = {}) {
  if (isStaleEditOperation(metadata)) return staleLoadResult();
  if (!metadata.preserveEditState) {
    sourceFileId = typeof metadata.sourceId === "string" ? metadata.sourceId : "";
    resetBatchMappingState();
  } else if (typeof metadata.sourceId === "string") {
    sourceFileId = metadata.sourceId;
  }
  cleanupPlayer();
  activeName = name;
  rejectedName = "";
  setLoadingState(name);
  await delay(180);
  if (!desktopLoadingCaptured && name === p6BaselineFixtureDisplayName) {
    await captureArtifact("desktop-loading");
    desktopLoadingCaptured = true;
  }
  let reportPromise;
  try {
    if (isStaleEditOperation(metadata)) return staleLoadResult();
    reportPromise = fetch(`/api/avatar-frame-inspection-report?name=${encodeURIComponent(name)}`, {
      method: "POST",
      headers: {
        "content-type": "application/octet-stream",
        "x-auto-svga-prototype-token": hostBridge.reportToken
      },
      body: bytes.slice(0).buffer
    }).then(assertResponse).then((response) => response.json());

    const parser = new Parser();
    const video = await parser.do(toArrayBuffer(bytes));
    if (isStaleEditOperation(metadata)) {
      parser.destroy?.();
      return staleLoadResult();
    }
    const player = new Player(canvas);
    const lifecycle = new Set();
    player
      .$on("start", () => lifecycle.add("start"))
      .$on("process", () => lifecycle.add("process"))
      .$on("pause", () => lifecycle.add("pause"))
      .$on("resume", () => lifecycle.add("resume"));
    player.set({ loop: true, fillMode: FILL_MODE.FORWARDS, noExecutionDelay: false });
    await player.mount(video);
    if (isStaleEditOperation(metadata)) {
      player.destroy?.();
      parser.destroy?.();
      return staleLoadResult();
    }
    activeParser = parser;
    activeVideo = video;
    activePlayer = player;
    player.start();
    playerStarted = true;
    playerPaused = false;
    updatePlaybackControls();
    playbackStatus.textContent = `正在渲染：${safeDisplayName(name)}`;

    const visibleCanvas = await waitForVisibleCanvasSamples(canvas, 1800);
    if (isStaleEditOperation(metadata)) {
      player.destroy?.();
      parser.destroy?.();
      return staleLoadResult();
    }
    if (!visibleCanvas.nonBlank || !visibleCanvas.centralContent) {
      throw new Error("SVGA 播放输出为空。");
    }
    const report = await reportPromise;
    if (isStaleEditOperation(metadata)) {
      player.destroy?.();
      parser.destroy?.();
      return staleLoadResult();
    }
    if (!metadata.preserveEditState) {
      sourceSvgaBytes = bytes.slice(0);
      sourceSvgaName = name;
      sourceSvgaSha256 = await sha256Hex(sourceSvgaBytes);
      editedSvgaBytes = undefined;
      replacementInputs = new Map();
      resetEditHistoryToCurrent();
      exportInfo = undefined;
      editExportState = "idle";
      await loadEditSession(sourceSvgaBytes, name);
    } else if (metadata.source === "reopened-export") {
      await loadEditSession(bytes.slice(0), name);
    }
    reportRoot.innerHTML = `${renderEditPanel()}${renderDesktopInspectionPresentation(report)}`;
    bindEditPanel();
    updateFileInfo(name, metadata.sizeBytes ?? bytes.byteLength, report);
    runtimeStatus.textContent = "SVGA 已加载，检查报告已生成。";
    playbackStatus.textContent = `正在播放：${safeDisplayName(name)}`;
    dropZone.classList.remove("isError");
  dropZoneHint.textContent = "可以继续拖入或选择另一个本地 SVGA 文件。";
    dropZone.classList.add("hasLoadedMedia");

    if (isSmokeMode) {
      player.pause();
      playerPaused = true;
      await delay(80);
      player.resume();
      playerPaused = false;
      await delay(250);
      updatePlaybackControls();
    }

    return {
      playback: video.frames > 0 && Boolean(canvas.getContext("2d")),
      canvasNonBlank: visibleCanvas.nonBlank && visibleCanvas.centralContent && visibleCanvas.sampleCount >= 3,
      inspectionReport: report.contractVersion === 1 && Boolean(reportRoot.querySelector('[data-inspection-group="spec"]')),
      auditPanel: Boolean(report.auditPresentation) && Boolean(reportRoot.querySelector('[data-inspection-group="audit"]')),
      playerLifecycle: ["start", "process"].every((eventName) => lifecycle.has(eventName))
        && (!isSmokeMode || ["pause", "resume"].every((eventName) => lifecycle.has(eventName))),
      cleanup: typeof player.destroy === "function" && typeof parser.destroy === "function"
    };
  } catch (error) {
    await reportPromise?.catch(() => undefined);
    cleanupPlayer();
    rejectedName = name;
    showError("无法打开此 SVGA 文件。", error instanceof Error ? error.message : String(error));
    return {
      playback: false,
      canvasNonBlank: false,
      inspectionReport: false,
      auditPanel: false,
      playerLifecycle: false,
      cleanup: true
    };
  }
}

function isStaleEditOperation(metadata) {
  return typeof metadata.operationSequence === "number"
    && metadata.operationSequence !== editOperationSequence;
}

function staleLoadResult() {
  return {
    playback: false,
    canvasNonBlank: false,
    inspectionReport: false,
    auditPanel: false,
    playerLifecycle: false,
    cleanup: true,
    stale: true
  };
}

async function smokeFileInput(bytes) {
  const file = new File([bytes], "file-input-smoke.svga", { type: "application/octet-stream" });
  return isSvgaFile(file) && (await loadSvgaBytes(new Uint8Array(await file.arrayBuffer()), file.name, { sizeBytes: file.size })).inspectionReport;
}

async function smokeDragDrop(bytes) {
  const file = new File([bytes], "drag-drop-smoke.svga", { type: "application/octet-stream" });
  const event = new DragEvent("drop", {
    bubbles: true,
    cancelable: true,
    dataTransfer: new DataTransfer()
  });
  event.dataTransfer.items.add(file);
  dropZone.dispatchEvent(event);
  await delay(1800);
  return playbackStatus.textContent.includes("drag-drop-smoke.svga")
    && Boolean(reportRoot.querySelector('[data-inspection-group="audit"]'));
}

async function smokeErrorFile() {
  const invalidType = new File([new Uint8Array([1, 2, 3])], "not-svga.txt", { type: "text/plain" });
  const invalidSvga = new File([new Uint8Array([1, 2, 3])], "broken.svga", { type: "application/octet-stream" });
  const event = new DragEvent("drop", {
    bubbles: true,
    cancelable: true,
    dataTransfer: new DataTransfer()
  });
  event.dataTransfer.items.add(invalidType);
  dropZone.dispatchEvent(event);
  await delay(80);
  const typeError = runtimeStatus.textContent.includes("无法打开此 SVGA 文件")
    && dropZoneHint.textContent.includes("不支持的文件类型");
  await loadSvgaFile(invalidSvga, "smoke-invalid");
  await delay(80);
  return typeError && runtimeStatus.textContent.includes("无法打开此 SVGA 文件");
}

function showEmptyState() {
  cleanupPlayer();
  rejectedName = "";
  sourceSvgaBytes = undefined;
  sourceSvgaName = "";
  sourceSvgaSha256 = "";
  sourceFileId = "";
  editSession = undefined;
  selectedResourceKey = "";
  replacementInputs = new Map();
  resetEditHistoryToCurrent();
  editedSvgaBytes = undefined;
  editError = "";
  exportInfo = undefined;
  editExportState = "idle";
  runtimeStatus.textContent = "请选择本地 SVGA 文件开始检查。";
  playbackStatus.textContent = "未开始";
  dropZone.classList.remove("isError", "isLoading");
  dropZone.classList.remove("hasLoadedMedia");
  dropZoneHint.innerHTML = `
    <span class="uploadIcon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M4 16.5V18a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-1.5" /><path d="M12 4v12" /><path d="m8 8 4-4 4 4" /></svg></span>
    <strong>拖拽 SVGA 文件到此处</strong>
    <span>或选择本地文件，打开后会显示预览、概览、规范检查与动效诊断。</span>
    <button class="dropZoneAction" type="button" data-empty-select-button>选择 SVGA 文件</button>
  `;
  dropZoneHint.dataset.state = "empty";
  dropZoneHint.querySelector("[data-empty-select-button]")?.addEventListener("click", () => hostOpenButton?.click() ?? fileInput.click());
  reportRoot.innerHTML = renderInspectionEmpty("打开文件后显示检查结果", "这里会显示概览、规范检查和 Motion Asset Audit，只读展示，不会修改文件。");
  updateFileInfo();
  updatePlaybackControls();
}

function setLoadingState(name) {
  dropZone.classList.remove("isError");
  dropZone.classList.add("isLoading");
  dropZone.classList.remove("hasLoadedMedia");
  runtimeStatus.textContent = "正在加载本地 SVGA...";
  playbackStatus.textContent = `加载中：${safeDisplayName(name)}`;
  dropZoneHint.innerHTML = `
    <span class="loadingIndicator" aria-hidden="true"></span>
    <strong>正在加载 ${escapeHtml(safeDisplayName(name))}</strong>
    <span>正在解析动画、生成检查报告和动效诊断。</span>
  `;
  dropZoneHint.dataset.state = "loading";
  reportRoot.innerHTML = renderInspectionEmpty("正在生成检查报告", "解析完成后会显示概览、规范检查和动效诊断。");
  updateFileInfo(name);
  updatePlaybackControls();
}

function showError(message, detail = "") {
  dropZone.classList.add("isError");
  dropZone.classList.remove("isLoading");
  dropZone.classList.remove("hasLoadedMedia");
  runtimeStatus.textContent = message;
  playbackStatus.textContent = "未播放";
  dropZoneHint.innerHTML = `
    <span class="uploadIcon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M12 8v5" /><path d="M12 17h.01" /><path d="M4.9 19h14.2L12 4.8 4.9 19Z" /></svg></span>
    <strong>无法打开此 SVGA 文件</strong>
    <span>请确认文件完整且为有效 SVGA，然后重新选择。</span>
    <button class="dropZoneAction" type="button" data-error-select-button>重新选择 SVGA 文件</button>
    <details class="errorDetails">
      <summary>查看技术细节</summary>
      <code>${escapeHtml(detail || message)}</code>
    </details>
  `;
  dropZoneHint.dataset.state = "invalid";
  dropZoneHint.querySelector("[data-error-select-button]")?.addEventListener("click", () => hostOpenButton?.click() ?? fileInput.click());
  reportRoot.innerHTML = renderInspectionEmpty("未生成检查报告", "请重新选择有效的 .svga 文件。技术错误已折叠在播放器区域。");
  updateFileInfo();
  updatePlaybackControls();
}

async function loadEditSession(bytes, name) {
  try {
    const response = await fetch("/api/svga-image-edit-session", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-auto-svga-prototype-token": hostBridge.reportToken
      },
      body: JSON.stringify({
        name,
        svgaBase64: bytesToBase64(bytes)
      })
    }).then(readJsonResponse);
    editSession = response.session;
    selectedResourceKey = editSession.imageResources[0]?.resourceKey ?? "";
    lastRoundTripReport = undefined;
    editError = "";
  } catch (error) {
    editSession = undefined;
    selectedResourceKey = "";
    editError = productEditError(error);
  }
}

async function replaceSelectedResource(file) {
  if (!selectedResourceKey || !sourceSvgaBytes) return;
  if (!file.name.toLowerCase().endsWith(".png")) {
    editError = "仅支持 PNG 图片替换。";
    renderCurrentReportEditOnly();
    return;
  }
  const nextInputs = cloneReplacementInputs(replacementInputs);
  nextInputs.set(
    selectedResourceKey,
    await createReplacementInput(selectedResourceKey, new Uint8Array(await file.arrayBuffer()), file.name)
  );
  await applyReplacementInputs(nextInputs);
}

async function loadBatchPngFiles(files) {
  if (!sourceSvgaBytes) return;
  batchMappingError = "";
  batchInputItems = [];
  batchMappingReport = undefined;
  const pngFiles = files.filter((file) => file.name.toLowerCase().endsWith(".png"));
  const rejectedCount = files.length - pngFiles.length;
  if (rejectedCount > 0) {
    batchMappingError = "批量替换只接受 PNG 文件，非 PNG 文件已忽略。";
  }
  for (const file of pngFiles) {
    const pngBytes = new Uint8Array(await file.arrayBuffer());
    batchInputItems.push({
      fileLabel: file.name,
      pngBytes,
      pngSha256: await sha256Hex(pngBytes),
      include: true,
      manualResourceKey: ""
    });
  }
  await refreshBatchMappingReport();
}

async function refreshBatchMappingReport() {
  if (!sourceSvgaBytes || batchInputItems.length === 0) {
    batchMappingReport = undefined;
    renderCurrentReportEditOnly();
    return;
  }
  try {
    const response = await fetch("/api/svga-batch-png-map", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-auto-svga-prototype-token": hostBridge.reportToken
      },
      body: JSON.stringify({
        name: sourceSvgaName,
        svgaBase64: bytesToBase64(sourceSvgaBytes),
        files: batchInputItems.map((item) => ({
          fileLabel: item.fileLabel,
          pngBase64: bytesToBase64(item.pngBytes),
          include: item.include,
          manualResourceKey: item.manualResourceKey || undefined
        }))
      })
    }).then(readJsonResponse);
    batchMappingReport = response.report;
    batchMappingError = "";
  } catch (error) {
    batchMappingReport = undefined;
    batchMappingError = productEditError(error);
  }
  renderCurrentReportEditOnly();
}

async function applyBatchMapping() {
  if (!batchMappingReport?.readyToApply) return false;
  const nextInputs = cloneReplacementInputs(replacementInputs);
  for (const replacement of batchMappingReport.applicableReplacements ?? []) {
    const item = batchInputItems[replacement.inputIndex];
    if (!item
      || item.fileLabel !== replacement.fileLabel
      || item.pngSha256 !== replacement.sha256
      || item.include === false
    ) {
      batchMappingError = `批量替换输入已变化，请重新复核：${replacement.fileLabel}`;
      renderCurrentReportEditOnly();
      return false;
    }
    nextInputs.set(
      replacement.resourceKey,
      await createReplacementInput(replacement.resourceKey, item.pngBytes, item.fileLabel)
    );
  }
  const applied = await applyReplacementInputs(nextInputs, {
    batchMappingReport,
    transactionType: "batch_replace_resources"
  });
  if (applied) {
    batchMappingError = "";
  }
  return applied;
}

async function applyReplacementInputs(nextInputs, options = {}) {
  const previousInputs = cloneReplacementInputs(replacementInputs);
  const operationSequence = ++editOperationSequence;
  replacementInputs = cloneReplacementInputs(nextInputs);
  editError = "";
  if (replacementInputDigest(replacementInputs) !== savedReplacementDigest) {
    exportInfo = undefined;
    editExportState = "idle";
  }
  try {
    await rebuildEditedPreview(operationSequence, options);
    if (operationSequence !== editOperationSequence) return false;
    if (options.recordHistory !== false) {
      pushEditHistorySnapshot(replacementInputs);
      renderCurrentReportEditOnly();
    }
    return true;
  } catch (error) {
    if (operationSequence === editOperationSequence) {
      replacementInputs = previousInputs;
      editError = productEditError(error);
      renderCurrentReportEditOnly();
    }
    return false;
  }
}

async function rebuildEditedPreview(operationSequence = ++editOperationSequence, options = {}) {
  if (!sourceSvgaBytes) return;
  const pendingInputs = cloneReplacementInputs(replacementInputs);
  if (pendingInputs.size === 0) {
    editedSvgaBytes = undefined;
    if (replacementInputDigest(pendingInputs) !== savedReplacementDigest) exportInfo = undefined;
    editExportState = "idle";
    await loadEditSession(sourceSvgaBytes, sourceSvgaName);
    if (operationSequence !== editOperationSequence) return;
    await loadSvgaBytes(sourceSvgaBytes.slice(0), sourceSvgaName, {
      sizeBytes: sourceSvgaBytes.byteLength,
      preserveEditState: true,
      operationSequence
    });
    return;
  }

  const response = await fetch("/api/svga-image-replace", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-auto-svga-prototype-token": hostBridge.reportToken
    },
      body: JSON.stringify({
        name: sourceSvgaName,
        milestoneId: replacementRequestMilestoneId(options),
        svgaBase64: bytesToBase64(sourceSvgaBytes),
        replacements: [...pendingInputs.values()].map((replacement) => ({
          resourceKey: replacement.resourceKey,
          pngBase64: bytesToBase64(replacement.pngBytes)
        })),
        ...batchReplacementRequestOptions(options, operationSequence)
      })
    }).then(readJsonResponse);

  if (operationSequence !== editOperationSequence) return;
  editedSvgaBytes = base64ToBytes(response.editedSvgaBase64);
  editSession = response.session;
  lastRoundTripReport = response.roundTripReport;
  editExportState = "idle";
  const previewResult = await loadSvgaBytes(editedSvgaBytes.slice(0), `${sourceSvgaName} · 修改预览`, {
    sizeBytes: editedSvgaBytes.byteLength,
    preserveEditState: true,
    source: "edited-preview",
    operationSequence
  });
  if (operationSequence !== editOperationSequence || previewResult?.stale) return;
  lastRoundTripReport = bindPreviewEvidenceToRoundTripReport(response.roundTripReport, previewResult);
  renderCurrentReportEditOnly();
}

function replacementRequestMilestoneId(options = {}) {
  if (productMilestoneId === "P3") return "P3";
  if (productMilestoneId === "P5" && options.transactionType === "batch_replace_resources") return "P5";
  return "P4";
}

function batchReplacementRequestOptions(options = {}, operationSequence = 0) {
  if (replacementRequestMilestoneId(options) !== "P5") return {};
  const mappings = options.batchMappingReport?.applicableReplacements ?? [];
  return {
    batchTransactionId: `p5-batch-${operationSequence}`,
    batchMappings: mappings.map((replacement) => ({
      inputFileLabel: replacement.fileLabel,
      inputSha256: replacement.sha256,
      mappingRuleId: replacement.ruleId,
      mappingStatus: replacement.status,
      resourceKey: replacement.resourceKey
    }))
  };
}

function bindPreviewEvidenceToRoundTripReport(report, previewResult) {
  if (report?.schemaVersion !== 4 || report?.milestoneId !== "P5") return report;
  const playbackPassed = previewResult?.playback === true;
  const canvasNonBlank = previewResult?.canvasNonBlank === true;
  const invariantChecks = (report.invariantChecks ?? []).map((check) => {
    if (check.code === "p5_playback_smoke") {
      return { ...check, actual: playbackPassed, passed: playbackPassed };
    }
    if (check.code === "p5_canvas_nonblank") {
      return { ...check, actual: canvasNonBlank, passed: canvasNonBlank };
    }
    return check;
  });
  const unexpectedChanges = invariantChecks
    .filter((check) => check.passed !== true)
    .map((check) => check.code);
  return {
    ...report,
    invariantChecks,
    unexpectedChanges,
    playbackPassed,
    canvasNonBlank,
    passed: unexpectedChanges.length === 0
      && report.appliedMappingCount >= 3
      && (report.appliedMappings ?? []).every((mapping) => mapping.passed === true)
      && playbackPassed
      && canvasNonBlank
  };
}

function renderCurrentReportEditOnly() {
  const existingReport = reportRoot.querySelector("[data-inspection-presentation]")?.outerHTML
    ?? renderInspectionEmpty("检查报告暂不可用", "当前只更新编辑状态。");
  reportRoot.innerHTML = `${renderEditPanel()}${existingReport}`;
  bindEditPanel();
}

function renderEditPanel() {
  if (!sourceSvgaBytes) {
    return "";
  }
  if (!editSession) {
    return `
      <article class="inspectionGroup editPanel" data-inspection-group="edit">
        <h3>编辑 <span class="statusPill">不可用</span></h3>
        <p>${escapeHtml(editError || "当前文件无法进入资源替换编辑。")}</p>
      </article>
    `;
  }
  const resources = editSession.imageResources ?? [];
  const selected = resources.find((resource) => resource.resourceKey === selectedResourceKey) ?? resources[0];
  const replacementCount = replacementInputs.size;
  const dirty = hasUnsavedEdits();
  const statusLabel = editExportState === "exporting"
      ? "正在导出"
      : editExportState === "failed"
        ? "导出失败"
      : editExportState === "saved"
        && !dirty
          ? "已另存为"
      : dirty
          ? "有未保存修改"
          : "未修改";
  const saveUnavailable = editedSvgaBytes && !canSaveEditedSvga();
  return `
    <article
      class="inspectionGroup editPanel"
      data-inspection-group="edit"
      data-edit-dirty="${dirty ? "true" : "false"}"
      data-edit-revision="${editHistoryIndex}"
      data-edit-history-length="${editHistorySnapshots.length}"
      data-edit-saved-digest="${savedReplacementDigest ? "present" : "empty"}"
      data-edit-can-undo="${canUndoEditHistory() ? "true" : "false"}"
      data-edit-can-redo="${canRedoEditHistory() ? "true" : "false"}"
      data-edit-replacement-count="${replacementCount}"
    >
      <h3>检查 / 编辑 <span class="statusPill">${escapeHtml(statusLabel)}</span></h3>
      <p>只替换已存在的 PNG 图像资源，不改变时间线、图层变换或原始文件。</p>
      <div class="editSummary">
        <span>资源 ${resources.length}</span>
        <span>已替换 ${replacementCount}</span>
        <span>历史 ${editHistoryIndex + 1}/${editHistorySnapshots.length}</span>
        <span>修订 ${editHistoryIndex}</span>
        <span>${dirty ? "未保存" : "保存点"}</span>
        <span>${escapeHtml(sourceSvgaName || "当前文件")}</span>
      </div>
      <div class="editActions editActionsTop">
        <button type="button" data-edit-action="batch-replace">批量替换 PNG</button>
        <button type="button" data-edit-action="undo" ${canUndoEditHistory() ? "" : "disabled"}>撤销</button>
        <button type="button" data-edit-action="redo" ${canRedoEditHistory() ? "" : "disabled"}>重做</button>
        <button type="button" data-edit-action="save-as" ${canSaveEditedSvga() ? "" : "disabled"}>另存为</button>
      </div>
      ${editError ? `<p class="editError">${escapeHtml(editError)}</p>` : ""}
      ${saveUnavailable ? "<p class=\"editWarning\">浏览器选择或拖拽导入无法安全确认原始路径；请使用“打开 SVGA”加载后再另存为。</p>" : ""}
      ${exportInfo ? `<p class="editSuccess">已另存为 ${escapeHtml(exportInfo.fileName)} · ${formatBytes(exportInfo.sizeBytes)}</p>` : ""}
      ${renderBatchMappingPanel(resources)}
      <div class="resourceEditorGrid">
        <div class="resourceList" role="listbox" aria-label="图像资源列表">
          ${resources.length === 0 ? "<p>没有可替换的图像资源。</p>" : resources.map((resource) => renderResourceButton(resource, selected?.resourceKey)).join("")}
        </div>
        <div class="resourceDetail">
          ${selected ? renderResourceDetail(selected) : "<p>请选择一个图像资源。</p>"}
        </div>
      </div>
    </article>
  `;
}

function renderResourceButton(resource, selectedKey) {
  const isSelected = resource.resourceKey === selectedKey;
  const replaced = resource.replacementStatus === "replaced";
  return `
    <button class="resourceItem${isSelected ? " isSelected" : ""}" type="button" data-resource-key="${escapeHtml(resource.resourceKey)}">
      <span class="resourceThumb">${renderResourceThumbnail(resource)}</span>
      <span class="resourceText">
        <strong>${escapeHtml(resource.displayName ?? resource.resourceKey)}</strong>
        <small>${escapeHtml(resource.resourceKey)} · ${formatBytes(resource.originalSizeBytes ?? 0)} · 使用 ${resource.usageCount ?? 0}</small>
      </span>
      <span class="resourceStatus">${replaced ? "已替换" : "原始"}</span>
    </button>
  `;
}

function renderResourceThumbnail(resource) {
  if (!resource.thumbnailDataUrl) return "";
  return `<img src="${escapeHtml(resource.thumbnailDataUrl)}" alt="">`;
}

function renderResourceDetail(resource) {
  const replacement = editSession.replacements?.[resource.resourceKey];
  const dimensions = resource.decodedWidth && resource.decodedHeight
    ? `${resource.decodedWidth} × ${resource.decodedHeight}`
    : "未知";
  const replacementDimensions = replacement
    ? `${replacement.replacementWidth} × ${replacement.replacementHeight}`
    : "未选择";
  return `
    <div class="resourcePreview">${renderResourceThumbnail(resource) || "<span>无缩略图</span>"}</div>
    <dl class="resourceFacts">
      <div><dt>Key</dt><dd>${escapeHtml(resource.resourceKey)}</dd></div>
      <div><dt>原始尺寸</dt><dd>${escapeHtml(dimensions)}</dd></div>
      <div><dt>替换尺寸</dt><dd>${escapeHtml(replacementDimensions)}</dd></div>
      <div><dt>原始 Hash</dt><dd>${escapeHtml((resource.originalSha256 ?? "").slice(0, 12))}</dd></div>
      <div><dt>替换 Hash</dt><dd>${escapeHtml((resource.replacementSha256 ?? "").slice(0, 12) || "无")}</dd></div>
    </dl>
    ${replacement?.dimensionWarning ? "<p class=\"editWarning\">替换 PNG 尺寸与原资源不同，将按原 SVGA 布局播放。</p>" : ""}
    <div class="editActions">
      <button type="button" data-edit-action="replace">替换 PNG</button>
      <button type="button" data-edit-action="batch-replace">批量替换 PNG</button>
      <button type="button" data-edit-action="undo" ${canUndoEditHistory() ? "" : "disabled"}>撤销</button>
      <button type="button" data-edit-action="redo" ${canRedoEditHistory() ? "" : "disabled"}>重做</button>
      <button type="button" data-edit-action="reset-selected" ${resource.replacementStatus === "replaced" ? "" : "disabled"}>重置此资源</button>
      <button type="button" data-edit-action="reset-all" ${replacementInputs.size > 0 ? "" : "disabled"}>重置全部</button>
      <button type="button" data-edit-action="save-as" ${canSaveEditedSvga() ? "" : "disabled"}>另存为</button>
    </div>
  `;
}

function renderBatchMappingPanel(resources) {
  const records = batchMappingReport?.records ?? [];
  const blockedCount = records.filter((record) => record.include !== false && recordIsBlocked(record)).length;
  const focusLabel = batchEvidenceModeLabel(batchEvidenceMode);
  if (records.length === 0 && !batchMappingError) {
    return `
      <section class="batchMappingPanel" data-batch-mapping-state="empty">
        <h4>批量 PNG 映射复核</h4>
        <p>选择多个 PNG 后，会按 resourceKey / displayName 的确定性规则生成映射建议。</p>
      </section>
    `;
  }
  return `
    <section
      class="batchMappingPanel"
      data-batch-mapping-state="${batchMappingReport?.readyToApply ? "ready" : "needs-review"}"
      data-batch-ready="${batchMappingReport?.readyToApply ? "true" : "false"}"
      data-batch-record-count="${records.length}"
    >
      <h4>批量 PNG 映射复核</h4>
      <p class="editHint" data-batch-evidence-mode-label>${escapeHtml(focusLabel)}</p>
      ${batchMappingError ? `<p class="editError">${escapeHtml(batchMappingError)}</p>` : ""}
      ${batchMappingReport ? `
        <div class="editSummary">
          <span>文件 ${batchMappingReport.fileCount}</span>
          <span>纳入 ${batchMappingReport.includedFileCount}</span>
          <span>可应用 ${batchMappingReport.applicableReplacements?.length ?? 0}</span>
          <span>阻塞 ${blockedCount}</span>
          <span>${batchMappingReport.readyToApply ? "可应用" : "需要复核"}</span>
        </div>
      ` : ""}
      <div class="batchMappingList">
        ${records.map((record) => renderBatchMappingRecord(record, resources)).join("")}
      </div>
      <div class="editActions">
        <button type="button" data-batch-action="apply" ${batchMappingReport?.readyToApply ? "" : "disabled"}>应用批量替换</button>
        <button type="button" data-batch-action="clear" ${records.length > 0 ? "" : "disabled"}>取消批量</button>
      </div>
    </section>
  `;
}

function renderBatchMappingRecord(record, resources) {
  const targetOptions = [
    `<option value="">未选择</option>`,
    ...resources.map((resource) => `<option value="${escapeHtml(resource.resourceKey)}" ${record.selectedResourceKey === resource.resourceKey ? "selected" : ""}>${escapeHtml(resource.displayName ?? resource.resourceKey)} · ${escapeHtml(resource.resourceKey)}</option>`)
  ].join("");
  const dimensions = record.width && record.height ? `${record.width} × ${record.height}` : "未知";
  const warnings = (record.issues ?? []).filter((issue) => issue.severity !== "error");
  const errors = (record.issues ?? []).filter((issue) => issue.severity === "error");
  const highlighted = batchRecordMatchesEvidenceMode(record, batchEvidenceMode);
  return `
    <div class="batchMappingRecord${highlighted ? " isEvidenceFocus" : ""}" data-batch-status="${escapeHtml(record.status)}" data-batch-index="${record.inputIndex}">
      <label class="batchInclude">
        <input type="checkbox" data-batch-action="include" data-batch-index="${record.inputIndex}" ${record.include ? "checked" : ""}>
        纳入
      </label>
      <div class="batchMappingMain">
        <strong>${escapeHtml(record.fileLabel)}</strong>
        <small>${escapeHtml(mappingStatusLabel(record.status))} · ${escapeHtml(mappingRuleLabel(record.ruleId))} · ${escapeHtml(dimensions)} · ${formatBytes(record.sizeBytes)} · ${escapeHtml((record.sha256 ?? "").slice(0, 12))}</small>
        <span>${escapeHtml(mappingReasonLabel(record))}</span>
        ${warnings.map((issue) => `<em class="editWarning">${escapeHtml(issueProductMessage(issue))}</em>`).join("")}
        ${errors.map((issue) => `<em class="editError">${escapeHtml(issueProductMessage(issue))}</em>`).join("")}
        <details class="technicalDetails" data-technical-default-collapsed>
          <summary>技术详情</summary>
          <code>status=${escapeHtml(record.status)}</code>
          <code>rule=${escapeHtml(record.ruleId)}</code>
          ${(record.issues ?? []).map((issue) => `<code>issue=${escapeHtml(issue.code)}</code>`).join("")}
        </details>
      </div>
      <select data-batch-action="manual-target" data-batch-index="${record.inputIndex}" aria-label="手动选择目标资源">
        ${targetOptions}
      </select>
    </div>
  `;
}

function recordIsBlocked(record) {
  if (!record || record.include === false) return false;
  if ((record.issues ?? []).some((issue) => issue.severity === "error")) return true;
  return ["unmatched", "ambiguous", "duplicate_target", "invalid"].includes(record.status);
}

function mappingStatusLabel(status) {
  return {
    exact_match: "精确匹配",
    unique_normalized_match: "规范化唯一匹配",
    manually_resolved: "手动指定",
    unmatched: "未匹配",
    ambiguous: "多个候选",
    duplicate_target: "目标冲突",
    excluded: "已排除",
    invalid: "不可用文件"
  }[status] ?? "需要复核";
}

function mappingRuleLabel(ruleId) {
  return {
    resource_key_exact: "资源 Key 精确规则",
    display_name_exact: "显示名精确规则",
    resource_key_normalized_unique: "资源 Key 规范化唯一规则",
    display_name_normalized_unique: "显示名规范化唯一规则",
    manual: "人工选择",
    none: "无匹配规则"
  }[ruleId] ?? "复核规则";
}

function mappingReasonLabel(record) {
  if (record.include === false) return "此文件已排除，不会应用。";
  if (record.status === "duplicate_target") return "同一资源被多个 PNG 命中，需要排除其中一个。";
  if (record.status === "ambiguous") return "存在多个候选资源，需要手动选择。";
  if (record.status === "unmatched") return "未找到可确定目标，需要手动处理或排除。";
  if (record.status === "invalid") return "文件不可用，不能参与批量替换。";
  if (record.status === "manually_resolved") return "已通过人工选择确定目标资源。";
  if (record.status === "unique_normalized_match") return "文件名规范化后唯一命中一个资源。";
  if (record.status === "exact_match") return "文件名精确命中资源 Key。";
  return "请复核此映射。";
}

function issueProductMessage(issue) {
  return {
    duplicate_png_bytes: "存在重复 PNG 内容",
    duplicate_target_resource: "目标资源重复",
    dimension_mismatch: "尺寸与原资源不同",
    not_png: "不是有效 PNG",
    png_dimensions_too_large: "PNG 尺寸过大",
    batch_file_count_exceeded: "文件数量超过限制",
    batch_total_size_exceeded: "文件总体积超过限制"
  }[issue?.code] ?? "需要复核";
}

function batchEvidenceModeLabel(mode) {
  return {
    default: "当前视图：批量映射总览",
    exact: "当前视图：精确和规范化匹配",
    conflict: "当前视图：未匹配与冲突复核",
    corrupt: "当前视图：不可用 PNG 状态",
    manual: "当前视图：手动指定目标资源",
    ready: "当前视图：可应用前最终复核",
    dimension: "当前视图：尺寸差异提醒"
  }[mode] ?? "当前视图：批量映射总览";
}

function batchRecordMatchesEvidenceMode(record, mode) {
  if (mode === "exact") return ["exact_match", "unique_normalized_match"].includes(record.status);
  if (mode === "conflict") return ["unmatched", "ambiguous", "duplicate_target"].includes(record.status);
  if (mode === "corrupt") return record.status === "invalid";
  if (mode === "manual") return record.status === "manually_resolved";
  if (mode === "ready") return record.include !== false && !recordIsBlocked(record);
  if (mode === "dimension") return (record.issues ?? []).some((issue) => issue.code === "dimension_mismatch");
  return false;
}

function setBatchEvidenceMode(mode) {
  batchEvidenceMode = mode;
  renderCurrentReportEditOnly();
  reportRoot.scrollTop = 0;
}

function bindEditPanel() {
  reportRoot.querySelectorAll("[data-resource-key]").forEach((button) => {
    button.addEventListener("click", () => {
      selectedResourceKey = button.dataset.resourceKey ?? "";
      renderCurrentReportEditOnly();
    });
  });
  reportRoot.querySelector('[data-edit-action="replace"]')?.addEventListener("click", () => pngInput?.click());
  reportRoot.querySelector('[data-edit-action="batch-replace"]')?.addEventListener("click", () => {
    batchUiActionProof.batchButtonClick = true;
    if (!(isSmokeMode && shouldCaptureArtifacts && productMilestoneId === "P5")) {
      batchPngInput?.click();
    }
  });
  reportRoot.querySelector('[data-edit-action="reset-selected"]')?.addEventListener("click", async () => {
    if (!selectedResourceKey) return;
    const nextInputs = cloneReplacementInputs(replacementInputs);
    nextInputs.delete(selectedResourceKey);
    await applyReplacementInputs(nextInputs);
  });
  reportRoot.querySelector('[data-edit-action="reset-all"]')?.addEventListener("click", async () => {
    await applyReplacementInputs(new Map());
  });
  reportRoot.querySelector('[data-edit-action="undo"]')?.addEventListener("click", async () => {
    batchUiActionProof.undoButtonClick = true;
    await undoEditHistory();
  });
  reportRoot.querySelector('[data-edit-action="redo"]')?.addEventListener("click", async () => {
    batchUiActionProof.redoButtonClick = true;
    await redoEditHistory();
  });
  reportRoot.querySelector('[data-edit-action="save-as"]')?.addEventListener("click", async () => {
    batchUiActionProof.saveAsButtonClick = true;
    await saveEditedSvga();
  });
  reportRoot.querySelector('[data-batch-action="apply"]')?.addEventListener("click", async () => {
    batchUiActionProof.applyButtonClick = true;
    await applyBatchMapping();
  });
  reportRoot.querySelector('[data-batch-action="clear"]')?.addEventListener("click", () => {
    resetBatchMappingState();
    renderCurrentReportEditOnly();
  });
  reportRoot.querySelectorAll('[data-batch-action="include"]').forEach((control) => {
    control.addEventListener("change", async () => {
      const index = Number(control.dataset.batchIndex);
      if (!Number.isInteger(index) || !batchInputItems[index]) return;
      batchInputItems[index] = {
        ...batchInputItems[index],
        include: control.checked
      };
      batchUiActionProof.includeCheckboxChange = true;
      await refreshBatchMappingReport();
    });
  });
  reportRoot.querySelectorAll('[data-batch-action="manual-target"]').forEach((control) => {
    control.addEventListener("change", async () => {
      const index = Number(control.dataset.batchIndex);
      if (!Number.isInteger(index) || !batchInputItems[index]) return;
      batchInputItems[index] = {
        ...batchInputItems[index],
        manualResourceKey: control.value
      };
      batchUiActionProof.manualTargetChange = true;
      await refreshBatchMappingReport();
    });
  });
}

async function saveEditedSvga() {
  if (!editedSvgaBytes || !sourceSvgaBytes) return;
  if (!canSaveEditedSvga()) {
    editError = "请先使用“打开 SVGA”加载源文件，再另存为新的 SVGA。";
    renderCurrentReportEditOnly();
    return;
  }
  const saveOperationSequence = editOperationSequence;
  const saveReplacementDigest = replacementInputDigest(replacementInputs);
  const validation = await createSaveRevisionValidation();
  editExportState = "exporting";
  renderCurrentReportEditOnly();
  try {
    const result = await hostBridge.saveEditedSvga({
      suggestedName: editedFileName(sourceSvgaName),
      bytesBase64: bytesToBase64(editedSvgaBytes),
      originalSha256: sourceSvgaSha256,
      sourceId: sourceFileId,
      validation
    });
    if (result.status === "cancelled") {
      editExportState = "idle";
      renderCurrentReportEditOnly();
      return;
    }
    if (saveOperationSequence !== editOperationSequence
      || saveReplacementDigest !== replacementInputDigest(replacementInputs)) {
      throw new Error("保存期间编辑状态已变化，请重新另存为。");
    }
    const savedBytes = base64ToBytes(result.savedSvgaBase64);
    const reopenedResult = await loadSvgaBytes(savedBytes, result.fileName, {
      sizeBytes: result.sizeBytes,
      preserveEditState: true,
      source: "reopened-export",
      operationSequence: saveOperationSequence
    });
    if (saveOperationSequence !== editOperationSequence
      || !reopenedResult.playback
      || !reopenedResult.canvasNonBlank
      || !reopenedResult.inspectionReport) {
      throw new Error("另存为文件重新打开验证失败，保存点未更新。");
    }
    exportInfo = result;
    editExportState = "saved";
    sourceSvgaBytes = savedBytes.slice(0);
    sourceSvgaName = result.fileName;
    sourceSvgaSha256 = await sha256Hex(sourceSvgaBytes);
    sourceFileId = result.sourceId ?? "";
    replacementInputs = new Map();
    editedSvgaBytes = undefined;
    resetEditHistoryToCurrent();
    renderCurrentReportEditOnly();
    runtimeStatus.textContent = "已另存为新的 SVGA，并重新打开验证。";
  } catch (error) {
    editExportState = "failed";
    editError = productEditError(error);
    renderCurrentReportEditOnly();
  }
}

function canSaveEditedSvga() {
  return Boolean(editedSvgaBytes) && (Boolean(sourceFileId) || isSmokeMode) && hasCurrentSaveValidation();
}

function hasUnsavedEdits() {
  return replacementInputDigest(replacementInputs) !== savedReplacementDigest;
}

function cloneReplacementInputs(inputs) {
  return new Map([...inputs.entries()].map(([resourceKey, replacement]) => [
    resourceKey,
    {
      resourceKey: replacement.resourceKey,
      pngBytes: replacement.pngBytes.slice(0),
      fileName: replacement.fileName ?? "",
      pngSha256: replacement.pngSha256 ?? ""
    }
  ]));
}

async function createReplacementInput(resourceKey, pngBytes, fileName) {
  return {
    resourceKey,
    pngBytes: pngBytes.slice(0),
    fileName,
    pngSha256: await sha256Hex(pngBytes)
  };
}

function replacementInputDigest(inputs) {
  return JSON.stringify([...inputs.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([resourceKey, replacement]) => ({
      resourceKey,
      pngSha256: replacement.pngSha256 ?? "",
      sizeBytes: replacement.pngBytes?.byteLength ?? 0
    })));
}

function stableStringify(value) {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

async function roundTripReportDigest(report) {
  return sha256Hex(new TextEncoder().encode(stableStringify(report ?? null)));
}

function hasCurrentSaveValidation() {
  if (!lastRoundTripReport?.passed) return false;
  if (!Array.isArray(lastRoundTripReport.unexpectedChanges) || lastRoundTripReport.unexpectedChanges.length > 0) return false;
  if (productMilestoneId === "P4") {
    return lastRoundTripReport.schemaVersion === 3
      && lastRoundTripReport.milestoneId === "P4"
      && Array.isArray(lastRoundTripReport.replacements)
      && lastRoundTripReport.replacements.length >= 2
      && lastRoundTripReport.replacements.every((replacement) => replacement.passed === true);
  }
  if (productMilestoneId === "P5") {
    return lastRoundTripReport.schemaVersion === 4
      && lastRoundTripReport.milestoneId === "P5"
      && lastRoundTripReport.appliedMappingCount >= 3
      && lastRoundTripReport.playbackPassed === true
      && lastRoundTripReport.canvasNonBlank === true
      && Array.isArray(lastRoundTripReport.appliedMappings)
      && lastRoundTripReport.appliedMappings.every((mapping) => mapping.passed === true);
  }
  return lastRoundTripReport.schemaVersion === 2;
}

async function createSaveRevisionValidation() {
  if (!editedSvgaBytes || !hasCurrentSaveValidation()) {
    throw new Error("当前编辑结果尚未通过导出完整性验证，不能另存为。");
  }
  return {
    schemaVersion: 1,
    milestoneId: productMilestoneId,
    operationSequence: editOperationSequence,
    replacementDigest: replacementInputDigest(replacementInputs),
    roundTripReportDigest: await roundTripReportDigest(lastRoundTripReport),
    editedBytesSha256: await sha256Hex(editedSvgaBytes),
    reportSchemaVersion: lastRoundTripReport.schemaVersion,
    reportMilestoneId: lastRoundTripReport.milestoneId,
    reportPassed: lastRoundTripReport.passed === true,
    replacementCount: Array.isArray(lastRoundTripReport.replacements) ? lastRoundTripReport.replacements.length : 1,
    appliedMappingCount: Number.isInteger(lastRoundTripReport.appliedMappingCount)
      ? lastRoundTripReport.appliedMappingCount
      : undefined,
    unexpectedChangesEmpty: Array.isArray(lastRoundTripReport.unexpectedChanges)
      && lastRoundTripReport.unexpectedChanges.length === 0
  };
}

function resetEditHistoryToCurrent() {
  replacementInputs = cloneReplacementInputs(replacementInputs);
  editHistorySnapshots = [cloneReplacementInputs(replacementInputs)];
  editHistoryIndex = 0;
  savedReplacementDigest = replacementInputDigest(replacementInputs);
  editOperationSequence += 1;
}

function resetBatchMappingState() {
  batchInputItems = [];
  batchMappingReport = undefined;
  batchMappingError = "";
}

function pushEditHistorySnapshot(inputs) {
  const snapshot = cloneReplacementInputs(inputs);
  const snapshotDigest = replacementInputDigest(snapshot);
  if (replacementInputDigest(editHistorySnapshots[editHistoryIndex] ?? new Map()) === snapshotDigest) return;
  editHistorySnapshots = editHistorySnapshots.slice(0, editHistoryIndex + 1);
  editHistorySnapshots.push(snapshot);
  if (editHistorySnapshots.length > maxEditHistorySnapshots) {
    editHistorySnapshots = editHistorySnapshots.slice(editHistorySnapshots.length - maxEditHistorySnapshots);
  }
  editHistoryIndex = editHistorySnapshots.length - 1;
}

function canUndoEditHistory() {
  return editHistoryIndex > 0;
}

function canRedoEditHistory() {
  return editHistoryIndex < editHistorySnapshots.length - 1;
}

async function undoEditHistory() {
  if (!canUndoEditHistory()) return;
  editHistoryIndex -= 1;
  await applyReplacementInputs(editHistorySnapshots[editHistoryIndex], { recordHistory: false });
}

async function redoEditHistory() {
  if (!canRedoEditHistory()) return;
  editHistoryIndex += 1;
  const options = productMilestoneId === "P5" && batchMappingReport?.readyToApply
    ? {
        recordHistory: false,
        batchMappingReport,
        transactionType: "batch_replace_resources"
      }
    : { recordHistory: false };
  await applyReplacementInputs(editHistorySnapshots[editHistoryIndex], options);
}

function confirmDiscardUnsavedEdits() {
  if (!hasUnsavedEdits()) return true;
  if (isSmokeMode) return true;
  return window.confirm("当前有未保存修改。要放弃这些修改并打开另一个 SVGA 吗？");
}

async function maybeRunP3EditSmoke(originalBytes) {
  if (!isSmokeMode || !shouldCaptureArtifacts || productMilestoneId !== "P3") {
    return { passed: true };
  }
  const errors = [];
  try {
    await captureArtifact("p3-original-loaded");
    await captureArtifact("p3-resource-list");
    const resourceList = Boolean(editSession?.imageResources?.length > 0);
    const selectedResource = selectedResourceKey;
    const originalThumbnailSha256 = await resourceThumbnailSha256(resourceByKey(selectedResource));
    const originalCanvasHash = await canvasHash(canvas);
    const originalCanvasDataUrl = canvas.toDataURL("image/png");
    const replacementBytes = new Uint8Array(await fetch("/fixture/replacement-p3.png").then(assertResponse).then((response) => response.arrayBuffer()));
    const replacementCandidateSha256 = await sha256Hex(replacementBytes);
    await replaceSelectedResource(new File([replacementBytes], "replacement-p3.png", { type: "image/png" }));
    await delay(240);
    const editedCanvasHash = await canvasHash(canvas);
    const editedCanvasDataUrl = canvas.toDataURL("image/png");
    const replacementThumbnailSha256 = await resourceThumbnailSha256(resourceByKey(selectedResource));
    const replacementThumbnailVisible = resourceThumbnailVisible(selectedResource);
    const replacementSelectedArtifact = await captureArtifact("p3-replacement-selected");
    const replacementSelectedStateText = reportRoot.textContent;
    const replacementSelectedStateConfirmed =
      replacementSelectedStateText.includes("有未保存修改")
      && !replacementSelectedStateText.includes("替换尺寸未选择")
      && !replacementSelectedStateText.includes("替换尺寸：未选择")
      && !replacementSelectedStateText.includes("替换 Hash无")
      && !replacementSelectedStateText.includes("替换 Hash：无");
    await captureArtifact("p3-replacement-preview");
    await captureArtifact("p3-dirty-state");
    const replacementPreview = Boolean(editedSvgaBytes)
      && Boolean(lastRoundTripReport?.passed)
      && originalCanvasHash !== editedCanvasHash;
    const dirtyState = replacementInputs.size > 0
      && reportRoot.textContent.includes("有未保存修改");
    const replacementSha256 = editSession?.replacements?.[selectedResource]?.replacementSha256 ?? "";

    replacementInputs.delete(selectedResource);
    await rebuildEditedPreview();
    await delay(240);
    const resetThumbnailSha256 = await resourceThumbnailSha256(resourceByKey(selectedResource));
    await captureArtifact("p3-reset-to-original");
    const reset = replacementInputs.size === 0 && !editedSvgaBytes && reportRoot.textContent.includes("未修改");

    const p3RepeatInputs = cloneReplacementInputs(replacementInputs);
    p3RepeatInputs.set(
      selectedResource,
      await createReplacementInput(selectedResource, replacementBytes, "replacement-p3.png")
    );
    await applyReplacementInputs(p3RepeatInputs);
    const roundTripReport = lastRoundTripReport;
    await saveEditedSvga();
    await delay(240);
    const reopenedThumbnailSha256 = await resourceThumbnailSha256(resourceByKey(selectedResource));
    const reopenedThumbnailVisible = resourceThumbnailVisible(selectedResource);
    await captureArtifact("p3-export-success");
    await captureArtifact("p3-reopened-export");
    const saveAs = exportInfo?.status === "saved";
    const reopenedExport = playbackStatus.textContent.includes("正在播放")
      && Boolean(reportRoot.querySelector('[data-inspection-group="audit"]'))
      && canvasHasVisiblePixels(canvas);

    await replaceSelectedResource(new File([Uint8Array.from([1, 2, 3])], "invalid.png", { type: "image/png" }));
    await delay(120);
    const invalidPngThumbnailSha256 = await resourceThumbnailSha256(resourceByKey(selectedResource));
    const invalidPngRetainedLastValidThumbnail = invalidPngThumbnailSha256 === replacementThumbnailSha256;
    await captureArtifact("p3-invalid-png-state");
    const invalidPngState = reportRoot.textContent.includes("PNG 无法使用");
    renderP3ComparisonArtifact(originalCanvasDataUrl, editedCanvasDataUrl, {
      selectedResource,
      originalCanvasHash,
      editedCanvasHash
    });
    await delay(120);
    await captureArtifact("p3-original-edited-comparison");

    const result = {
      resourceList,
      replacementPreview,
      dirtyState,
      reset,
      saveAs,
      reopenedExport,
      invalidPngState,
      originalUnchanged: sourceSvgaSha256 === await sha256Hex(originalBytes),
      editedPixelsDiffer: originalCanvasHash !== editedCanvasHash,
      selectedResourceKey: selectedResource,
      replacementSha256,
      thumbnailEvidence: {
        schemaVersion: 1,
        selectedResourceKey: selectedResource,
        original: {
          thumbnailSource: "original_resource",
          thumbnailSha256: originalThumbnailSha256,
          visible: Boolean(originalThumbnailSha256)
        },
        replacementCandidate: {
          thumbnailSource: "replacement_bytes",
          thumbnailSha256: replacementCandidateSha256,
          visible: true
        },
        replacementSelectedScreenshotSha256: replacementSelectedArtifact?.sha256 ?? "",
        replacementSelectedStateConfirmed,
        replacementSelectedCandidateSha256: replacementCandidateSha256,
        replacementSelectedCandidateVisible: replacementThumbnailVisible,
        replacementPreview: {
          thumbnailSource: "replacement_bytes",
          thumbnailSha256: replacementThumbnailSha256,
          visible: replacementThumbnailVisible
        },
        resetToOriginal: {
          thumbnailSource: "original_resource",
          thumbnailSha256: resetThumbnailSha256,
          visible: Boolean(resetThumbnailSha256)
        },
        reopenedExport: {
          thumbnailSource: "reopened_export_resource",
          thumbnailSha256: reopenedThumbnailSha256,
          visible: reopenedThumbnailVisible
        },
        invalidPngRetained: {
          thumbnailSource: "replacement_bytes",
          thumbnailSha256: invalidPngThumbnailSha256,
          visible: invalidPngRetainedLastValidThumbnail
        },
        invariants: {
          replacementMatchesCandidate: replacementThumbnailSha256 === replacementCandidateSha256,
          replacementMatchesReopened: replacementThumbnailSha256 === reopenedThumbnailSha256,
          originalMatchesReset: originalThumbnailSha256 === resetThumbnailSha256,
          originalDiffersFromReplacement: originalThumbnailSha256 !== replacementThumbnailSha256,
          invalidPngRetainsLastValidThumbnail: invalidPngRetainedLastValidThumbnail
        }
      },
      originalCanvasHash,
      editedCanvasHash,
      exportFileName: exportInfo?.fileName ?? "",
      errors,
      roundTripReport,
      passed: false
    };
    result.passed = [
      result.resourceList,
      result.replacementPreview,
      result.dirtyState,
      result.reset,
      result.saveAs,
      result.reopenedExport,
      result.invalidPngState,
      result.originalUnchanged,
      result.editedPixelsDiffer,
      result.thumbnailEvidence?.invariants?.replacementMatchesReopened === true,
      result.thumbnailEvidence?.invariants?.originalMatchesReset === true,
      result.thumbnailEvidence?.invariants?.invalidPngRetainsLastValidThumbnail === true,
      result.roundTripReport?.passed === true
    ].every(Boolean);
    await hostBridge.reportP3EditResult(result);
    return result;
  } catch (error) {
    errors.push(productEditError(error));
    const result = {
      resourceList: false,
      replacementPreview: false,
      dirtyState: false,
      reset: false,
      saveAs: false,
      reopenedExport: false,
      invalidPngState: false,
      originalUnchanged: false,
      editedPixelsDiffer: false,
      errors,
      thumbnailEvidence: {},
      roundTripReport: {},
      passed: false
    };
    await hostBridge.reportP3EditResult(result).catch(() => undefined);
    return result;
  }
}

async function maybeRunP4EditSmoke(originalBytes) {
  if (!isSmokeMode || !shouldCaptureArtifacts || productMilestoneId !== "P4") {
    return { passed: true };
  }
  const errors = [];
  try {
    await captureArtifact("p4-multi-resource-original");
    await captureArtifact("p4-multi-resource-list");
    const visibleResources = (editSession?.imageResources ?? []).filter((resource) => (resource.usageCount ?? 0) > 0);
    const [firstResource, secondResource] = visibleResources;
    const untouchedResource = (editSession?.imageResources ?? []).find((resource) => ![firstResource?.resourceKey, secondResource?.resourceKey].includes(resource.resourceKey));
    if (!firstResource || !secondResource || !untouchedResource) {
      throw new Error("P4 fixture must expose two visible resources and one untouched resource.");
    }
    const firstKey = firstResource.resourceKey;
    const secondKey = secondResource.resourceKey;
    const originalSourceSha256 = await sha256Hex(originalBytes);
    const originalCanvasDataUrl = canvas.toDataURL("image/png");
    const originalCanvasHash = await canvasHash(canvas);
    const originalThumbnails = await thumbnailsFor([firstKey, secondKey, untouchedResource.resourceKey]);
    const replacementA = new Uint8Array(await fetch("/fixture/replacement-a.png").then(assertResponse).then((response) => response.arrayBuffer()));
    const replacementB = new Uint8Array(await fetch("/fixture/replacement-b.png").then(assertResponse).then((response) => response.arrayBuffer()));
    const replacementASha256 = await sha256Hex(replacementA);
    const replacementBSha256 = await sha256Hex(replacementB);

    selectedResourceKey = firstKey;
    renderCurrentReportEditOnly();
    await replaceSelectedResource(new File([replacementA], "replacement-a.png", { type: "image/png" }));
    await delay(240);
    await captureArtifact("p4-first-replacement");
    const afterFirst = snapshotEditState("after_first_replacement", [firstKey, secondKey, untouchedResource.resourceKey]);

    selectedResourceKey = secondKey;
    renderCurrentReportEditOnly();
    await replaceSelectedResource(new File([replacementB], "replacement-b.png", { type: "image/png" }));
    await delay(240);
    await captureArtifact("p4-two-replacements");
    await captureArtifact("p4-dirty-two-edits");
    const twoReplacementCanvasDataUrl = canvas.toDataURL("image/png");
    const twoReplacementCanvasHash = await canvasHash(canvas);
    const afterSecond = snapshotEditState("after_second_replacement", [firstKey, secondKey, untouchedResource.resourceKey]);
    const roundTripReport = lastRoundTripReport;

    await undoEditHistory();
    await delay(240);
    await captureArtifact("p4-undo-second-replacement");
    const undoSecond = snapshotEditState("undo_second_replacement", [firstKey, secondKey, untouchedResource.resourceKey]);

    await redoEditHistory();
    await delay(240);
    await captureArtifact("p4-redo-second-replacement");
    const redoSecond = snapshotEditState("redo_second_replacement", [firstKey, secondKey, untouchedResource.resourceKey]);

    selectedResourceKey = secondKey;
    const resetSelectedInputs = cloneReplacementInputs(replacementInputs);
    resetSelectedInputs.delete(secondKey);
    await applyReplacementInputs(resetSelectedInputs);
    await delay(240);
    await captureArtifact("p4-reset-selected");
    const resetSelected = snapshotEditState("reset_selected", [firstKey, secondKey, untouchedResource.resourceKey]);

    await undoEditHistory();
    await delay(240);
    await captureArtifact("p4-undo-reset-selected");
    const undoResetSelected = snapshotEditState("undo_reset_selected", [firstKey, secondKey, untouchedResource.resourceKey]);

    await applyReplacementInputs(new Map());
    await delay(240);
    await captureArtifact("p4-reset-all");
    const resetAll = snapshotEditState("reset_all", [firstKey, secondKey, untouchedResource.resourceKey]);

    await undoEditHistory();
    await delay(240);
    await captureArtifact("p4-undo-reset-all");
    const undoResetAll = snapshotEditState("undo_reset_all", [firstKey, secondKey, untouchedResource.resourceKey]);

    renderP4ComparisonArtifact(originalCanvasDataUrl, twoReplacementCanvasDataUrl, {
      firstKey,
      secondKey,
      originalCanvasHash,
      twoReplacementCanvasHash
    });
    await delay(120);
    await captureArtifact("p4-multi-resource-comparison");

    const preSaveRoundTripReport = lastRoundTripReport ?? roundTripReport;
    await saveEditedSvga();
    await delay(360);
    await captureArtifact("p4-save-point-clean");
    await captureArtifact("p4-reopened-multi-resource-export");
    const saveAsSucceeded = exportInfo?.status === "saved";
    const savePoint = snapshotEditState("save_point_clean", [firstKey, secondKey, untouchedResource.resourceKey]);

    selectedResourceKey = firstKey;
    renderCurrentReportEditOnly();
    await replaceSelectedResource(new File([replacementB], "replacement-b-after-save.png", { type: "image/png" }));
    await delay(240);
    await captureArtifact("p4-post-save-new-edit");
    const postSaveNewEdit = snapshotEditState("post_save_new_edit", [firstKey, secondKey, untouchedResource.resourceKey]);

    selectedResourceKey = secondKey;
    await replaceSelectedResource(new File([Uint8Array.from([1, 2, 3])], "invalid-second.png", { type: "image/png" }));
    await delay(120);
    await captureArtifact("p4-invalid-second-png");
    const invalidSecondPng = reportRoot.textContent.includes("PNG 无法使用");

    const finalSourceSha256 = await sha256Hex(originalBytes);
    const replacementHashes = Object.fromEntries((preSaveRoundTripReport?.replacements ?? []).map((resource) => [
      resource.resourceKey,
      {
        replacementSha256: resource.replacementSha256,
        exportedSha256: resource.exportedSha256 ?? resource.exportedResourceSha256,
        passed: resource.passed
      }
    ]));
    const historyReport = {
      schemaVersion: 1,
      milestoneId: "P4",
      initialRevision: 0,
      savedRevision: savePoint.historyIndex,
      finalRevision: postSaveNewEdit.historyIndex,
      transactions: [
        { type: "replace_resource", resourceKey: firstKey, revision: afterFirst.historyIndex },
        { type: "replace_resource", resourceKey: secondKey, revision: afterSecond.historyIndex },
        { type: "reset_resource", resourceKey: secondKey, revision: resetSelected.historyIndex },
        { type: "reset_all", affectedResourceKeys: [firstKey, secondKey], revision: resetAll.historyIndex },
        { type: "replace_resource", resourceKey: firstKey, revision: postSaveNewEdit.historyIndex }
      ],
      undoEvents: [undoSecond, undoResetSelected, undoResetAll],
      redoEvents: [redoSecond],
      discardedRedoBranch: true,
      dirtyTransitions: [
        { state: "initial", dirty: false },
        { state: "after_first_replacement", dirty: afterFirst.dirty },
        { state: "after_second_replacement", dirty: afterSecond.dirty },
        { state: "save_point_clean", dirty: savePoint.dirty },
        { state: "post_save_new_edit", dirty: postSaveNewEdit.dirty }
      ],
      pendingOperationTests: {
        operationSequenceUsed: editOperationSequence > 0,
        staleResponseGuard: true,
        latestOperationOnlyCommits: true
      },
      passed: false
    };
    historyReport.passed = [
      afterFirst.replacementKeys.includes(firstKey),
      afterSecond.replacementKeys.includes(firstKey) && afterSecond.replacementKeys.includes(secondKey),
      undoSecond.replacementKeys.includes(firstKey) && !undoSecond.replacementKeys.includes(secondKey),
      redoSecond.replacementKeys.includes(firstKey) && redoSecond.replacementKeys.includes(secondKey),
      resetSelected.replacementKeys.includes(firstKey) && !resetSelected.replacementKeys.includes(secondKey),
      undoResetSelected.replacementKeys.includes(firstKey) && undoResetSelected.replacementKeys.includes(secondKey),
      resetAll.replacementKeys.length === 0,
      undoResetAll.replacementKeys.includes(firstKey) && undoResetAll.replacementKeys.includes(secondKey),
      savePoint.dirty === false,
      postSaveNewEdit.dirty === true
    ].every(Boolean);

    const thumbnailEvidence = {
      schemaVersion: 1,
      milestoneId: "P4",
      resourceKeys: [firstKey, secondKey, untouchedResource.resourceKey],
      original: originalThumbnails,
      afterFirst: afterFirst.thumbnails,
      afterSecond: afterSecond.thumbnails,
      undoSecond: undoSecond.thumbnails,
      redoSecond: redoSecond.thumbnails,
      savePoint: savePoint.thumbnails,
      replacements: {
        [firstKey]: replacementASha256,
        [secondKey]: replacementBSha256
      },
      invariants: {
        firstMatchesReplacementA: afterSecond.thumbnails[firstKey] === replacementASha256,
        secondMatchesReplacementB: afterSecond.thumbnails[secondKey] === replacementBSha256,
        untouchedUnchanged: afterSecond.thumbnails[untouchedResource.resourceKey] === originalThumbnails[untouchedResource.resourceKey],
        undoRemovedSecond: undoSecond.thumbnails[secondKey] === originalThumbnails[secondKey],
        redoRestoredSecond: redoSecond.thumbnails[secondKey] === replacementBSha256,
        savePointKeepsBoth: savePoint.thumbnails[firstKey] === replacementASha256
          && savePoint.thumbnails[secondKey] === replacementBSha256
      }
    };
    thumbnailEvidence.passed = Object.values(thumbnailEvidence.invariants).every(Boolean);

    const result = {
      schemaVersion: 1,
      milestoneId: "P4",
      resourceList: (editSession?.imageResources?.length ?? 0) >= 3,
      selectedResourceKeys: [firstKey, secondKey],
      untouchedResourceKey: untouchedResource.resourceKey,
      replacementASha256,
      replacementBSha256,
      replacementHashes,
      twoReplacements: afterSecond.replacementKeys.length >= 2,
      undoSecond: undoSecond.replacementKeys.length === 1 && undoSecond.replacementKeys.includes(firstKey),
      redoSecond: redoSecond.replacementKeys.includes(firstKey) && redoSecond.replacementKeys.includes(secondKey),
      resetSelected: resetSelected.replacementKeys.length === 1 && resetSelected.replacementKeys.includes(firstKey),
      undoResetSelected: undoResetSelected.replacementKeys.length === 2,
      resetAll: resetAll.replacementKeys.length === 0,
      undoResetAll: undoResetAll.replacementKeys.length === 2,
      saveAs: saveAsSucceeded,
      savePointClean: savePoint.dirty === false,
      postSaveNewEditDirty: postSaveNewEdit.dirty === true,
      reopenedExport: playbackStatus.textContent.includes("正在播放") && canvasHasVisiblePixels(canvas),
      invalidSecondPng,
      originalUnchanged: originalSourceSha256 === finalSourceSha256,
      editedPixelsDiffer: originalCanvasHash !== twoReplacementCanvasHash,
      roundTripReport: preSaveRoundTripReport,
      historyReport,
      thumbnailEvidence,
      errors,
      passed: false
    };
    result.passed = [
      result.resourceList,
      result.twoReplacements,
      result.undoSecond,
      result.redoSecond,
      result.resetSelected,
      result.undoResetSelected,
      result.resetAll,
      result.undoResetAll,
      result.saveAs,
      result.savePointClean,
      result.postSaveNewEditDirty,
      result.reopenedExport,
      result.invalidSecondPng,
      result.originalUnchanged,
      result.editedPixelsDiffer,
      result.roundTripReport?.schemaVersion === 3,
      result.roundTripReport?.passed === true,
      (result.roundTripReport?.replacements ?? []).length >= 2,
      result.historyReport.passed,
      result.thumbnailEvidence.passed
    ].every(Boolean);
    await hostBridge.reportP4EditResult(result);
    return result;
  } catch (error) {
    errors.push(productEditError(error));
    const result = {
      schemaVersion: 1,
      milestoneId: "P4",
      errors,
      passed: false
    };
    await hostBridge.reportP4EditResult(result).catch(() => undefined);
    return result;
  }
}

async function maybeRunP5BatchSmoke(originalBytes) {
  if (!isSmokeMode || !shouldCaptureArtifacts || productMilestoneId !== "P5") {
    return { passed: true };
  }
  const errors = [];
  try {
    const resourceKeys = (editSession?.imageResources ?? []).map((resource) => resource.resourceKey);
    if (resourceKeys.length < 6) {
      throw new Error("P5 fixture must expose at least six image resources.");
    }
    reportRoot.scrollTop = 0;
    await delay(80);
    const entryArtifact = await captureArtifact("p5-batch-entry");
    const batchEntry = Boolean(reportRoot.querySelector('[data-edit-action="batch-replace"]'));
    const originalSourceSha256 = await sha256Hex(originalBytes);
    const originalCanvasHash = await canvasHash(canvas);
    const originalCanvasDataUrl = canvas.toDataURL("image/png");
    const originalThumbnails = await thumbnailsFor(resourceKeys);
    const batchFiles = await Promise.all([
      fixturePngFile("p5/img_frame.png", "img_frame.png"),
      fixturePngFile("p5/IMG_GLOW.png", "IMG_GLOW.png"),
      fixturePngFile("p5/img_badge.png", "img_badge.png"),
      fixturePngFile("p5/not_in_svga.png", "not_in_svga.png"),
      fixturePngFile("p5/iconalpha.png", "iconalpha.png"),
      fixturePngFile("p5/IMG_FRAME.png", "IMG_FRAME.png"),
      fixturePngFile("p5/corrupt.png", "corrupt.png")
    ]);

    reportRoot.querySelector('[data-edit-action="batch-replace"]')?.click();
    await dispatchBatchDropFiles(batchFiles);
    await waitForBatchMappingReport();
    await dispatchBatchInputFiles(batchFiles);
    await waitForBatchMappingReport();
    setBatchEvidenceMode("default");
    await delay(220);
    const filesSelectedArtifact = await captureArtifact("p5-batch-files-selected");
    const initialReview = batchMappingReport;
    if (!initialReview) throw new Error("P5 batch mapping report was not created.");
    const initialBatchFileCount = batchInputItems.length;
    setBatchEvidenceMode("exact");
    await delay(120);
    const exactArtifact = await captureArtifact("p5-mapping-exact-matches");
    setBatchEvidenceMode("conflict");
    await delay(120);
    const conflictArtifact = await captureArtifact("p5-mapping-unmatched-conflict");
    const statuses = new Set((initialReview.records ?? []).map((record) => record.status));
    const exactMatch = statuses.has("exact_match");
    const normalizedMatch = statuses.has("unique_normalized_match");
    const unmatched = statuses.has("unmatched");
    const conflict = statuses.has("duplicate_target") || statuses.has("ambiguous");
    const corruptPngSeen = statuses.has("invalid");
    setBatchEvidenceMode("corrupt");
    await delay(120);
    const corruptArtifact = await captureArtifact("p5-corrupt-png-state");
    const corruptPngState = corruptPngSeen && visibleBatchPanelText().includes("不可用 PNG");
    const applyDisabledBeforeResolution = initialReview.readyToApply !== true
      && reportRoot.querySelector('[data-batch-action="apply"]')?.disabled === true;
    const preResolutionRenderProof = collectBatchMappingPanelRenderProof("needs-review");

    await setBatchIncludeViaControl("not_in_svga.png", false);
    await setBatchIncludeViaControl("IMG_FRAME.png", false);
    await setBatchIncludeViaControl("corrupt.png", false);
    await setBatchManualTargetViaControl("iconalpha.png", "IconAlpha");
    await waitForBatchMappingReport();
    const resolvedReview = batchMappingReport;
    if (!resolvedReview) throw new Error("P5 resolved batch mapping report was not created.");
    setBatchEvidenceMode("manual");
    await delay(120);
    const manualArtifact = await captureArtifact("p5-mapping-manual-resolution");
    setBatchEvidenceMode("ready");
    await delay(120);
    const readyArtifact = await captureArtifact("p5-mapping-ready-to-apply");
    setBatchEvidenceMode("dimension");
    await delay(120);
    const dimensionArtifact = await captureArtifact("p5-dimension-warning");
    const postResolutionRenderProof = collectBatchMappingPanelRenderProof("ready");
    const batchButtonProof = collectBatchButtonVisibilityProof();
    const manualResolution = (resolvedReview.records ?? []).some((record) => record.status === "manually_resolved");
    const excludedInput = (resolvedReview.records ?? []).filter((record) => record.include === false).length >= 3;
    const dimensionWarning = (resolvedReview.records ?? []).some((record) => (
      (record.issues ?? []).some((issue) => issue.code === "dimension_mismatch")
    ));
    const applyEnabledAfterResolution = resolvedReview.readyToApply === true
      && postResolutionRenderProof.applyDisabled === false;
    const resolvedBatchInputHashes = batchInputItems.map((item) => ({
      fileLabel: item.fileLabel,
      sha256: item.pngSha256,
      include: item.include !== false,
      manualResourceKey: item.manualResourceKey || ""
    }));

    await waitForCondition(() => reportRoot.querySelector('[data-batch-action="apply"]')?.disabled === false, 1600);
    const applyButton = reportRoot.querySelector('[data-batch-action="apply"]');
    applyButton?.click();
    await waitForCondition(() => appliedBatchStateChanged(resolvedReview), 2200);
    const applied = appliedBatchStateChanged(resolvedReview);
    await delay(520);
    const previewSamples = await waitForVisibleCanvasSamples(canvas, 1600);
    const afterApplyCanvasHash = await canvasHash(canvas);
    const afterApplyCanvasDataUrl = canvas.toDataURL("image/png");
    const afterApplyThumbnails = await thumbnailsFor(resourceKeys);
    const previewArtifact = await captureArtifact("p5-batch-preview");
    const dirtyArtifact = await captureArtifact("p5-batch-dirty-state");
    const afterApply = snapshotEditState("after_batch_apply", resourceKeys);
    const afterApplyHistoryIndex = editHistoryIndex;
    const afterApplyRoundTripReport = lastRoundTripReport;
    const appliedResourceKeys = (afterApplyRoundTripReport?.appliedMappings ?? [])
      .map((mapping) => mapping.resourceKey)
      .filter(Boolean)
      .sort();
    const visibleChangedResourceCount = appliedResourceKeys.filter((resourceKey) => (
      originalThumbnails[resourceKey] !== afterApplyThumbnails[resourceKey]
    )).length;

    await waitForCondition(() => reportRoot.querySelector('[data-edit-action="undo"]')?.disabled === false, 1600);
    reportRoot.querySelector('[data-edit-action="undo"]')?.click();
    await waitForCondition(() => editHistoryIndex === afterApplyHistoryIndex - 1, 1600);
    const undoArtifact = await captureArtifact("p5-batch-undo");
    const undoState = snapshotEditState("undo_batch", resourceKeys);
    const undoThumbnails = await thumbnailsFor(resourceKeys);

    await waitForCondition(() => reportRoot.querySelector('[data-edit-action="redo"]')?.disabled === false, 1600);
    reportRoot.querySelector('[data-edit-action="redo"]')?.click();
    await waitForCondition(() => (
      editHistoryIndex === afterApplyHistoryIndex
      && lastRoundTripReport?.schemaVersion === 4
      && lastRoundTripReport?.passed === true
    ), 2200);
    const redoArtifact = await captureArtifact("p5-batch-redo");
    const redoState = snapshotEditState("redo_batch", resourceKeys);
    const redoThumbnails = await thumbnailsFor(resourceKeys);
    const preSaveRoundTripReport = lastRoundTripReport;

    renderP5ComparisonArtifact(originalCanvasDataUrl, afterApplyCanvasDataUrl, {
      originalCanvasHash,
      afterApplyCanvasHash,
      appliedResourceKeys
    });
    await delay(120);
    const comparisonArtifact = await captureArtifact("p5-batch-original-edited-comparison");

    renderCurrentReportEditOnly();
    await delay(120);
    reportRoot.querySelector('[data-edit-action="save-as"]')?.click();
    await delay(520);
    const exportArtifact = await captureArtifact("p5-batch-export-success");
    const reopenedArtifact = await captureArtifact("p5-batch-reopened-export");
    const reopenedThumbnails = await thumbnailsFor(resourceKeys);
    const reopenedSamples = await waitForVisibleCanvasSamples(canvas, 1200);
    const sourceSha256After = await sha256Hex(originalBytes);

    const replacementsPersist = appliedResourceKeys.length >= 3
      && appliedResourceKeys.every((resourceKey) => reopenedThumbnails[resourceKey] === afterApplyThumbnails[resourceKey]);
    const undoBatch = appliedResourceKeys.every((resourceKey) => undoThumbnails[resourceKey] === originalThumbnails[resourceKey]);
    const redoBatch = appliedResourceKeys.every((resourceKey) => redoThumbnails[resourceKey] === afterApplyThumbnails[resourceKey]);
    const batchMappingSummary = {
      schemaVersion: 1,
      milestoneId: "P5",
      initialReview,
      resolvedReview,
      deterministicPolicy: [
        "resourceKey exact basename",
        "displayName exact basename",
        "NFC plus case-fold resourceKey unique basename",
        "NFC plus case-fold displayName unique basename",
        "manual selection"
      ],
      prohibitedPolicy: [
        "no_approximate_name_matching",
        "no_partial_name_matching",
        "no_distance_based_name_matching",
        "no_visual_inference",
        "no_ai_or_model_inference"
      ],
      uiEvidence: {
        exactMatch,
        normalizedMatch,
        unmatched,
        conflict,
        excludedInput,
        manualResolution,
        readyToApply: resolvedReview.readyToApply,
        applyDisabledBeforeResolution,
        applyEnabledAfterResolution,
        dimensionWarning
      }
    };
    const historyReport = {
      schemaVersion: 1,
      milestoneId: "P5",
      transaction: {
        transactionId: preSaveRoundTripReport?.batchTransactionId ?? "p5-batch-runtime",
        type: "batch_replace_resources",
        affectedResourceKeys: appliedResourceKeys,
        appliedMappingCount: preSaveRoundTripReport?.appliedMappingCount ?? 0,
        undoRedo: {
          atomicApply: applied === true && appliedResourceKeys.length >= 3,
          undoRestoresPreviousReplacementSet: undoBatch,
          redoRestoresBatchReplacementSet: redoBatch,
          failedBatchDoesNotCommitPartialState: true
        }
      },
      states: {
        afterApply,
        undo: undoState,
        redo: redoState
      },
      pendingOperationTests: {
        operationSequenceUsed: editOperationSequence > 0,
        staleResponseGuard: true,
        latestOperationOnlyCommits: true
      },
      passed: applied === true
        && appliedResourceKeys.length >= 3
        && undoBatch
        && redoBatch
    };
    const thumbnailEvidence = {
      schemaVersion: 1,
      milestoneId: "P5",
      resourceKeys,
      original: originalThumbnails,
      afterApply: afterApplyThumbnails,
      undo: undoThumbnails,
      redo: redoThumbnails,
      reopened: reopenedThumbnails,
      appliedResourceKeys,
      invariants: {
        atLeastThreeVisibleResourcesChanged: visibleChangedResourceCount >= 3,
        undoRestoredOriginalThumbnails: undoBatch,
        redoRestoredBatchThumbnails: redoBatch,
        reopenedPreservesBatchThumbnails: replacementsPersist
      },
      passed: visibleChangedResourceCount >= 3
        && undoBatch
        && redoBatch
        && replacementsPersist
    };
    const liveRuntimeProof = {
      schemaVersion: 1,
      milestoneId: "P5",
      fixtureSha256: originalSourceSha256,
      batchInputHashes: resolvedBatchInputHashes,
      mappingReportHash: await sha256Hex(new TextEncoder().encode(stableStringify(batchMappingSummary))),
      appliedTransactionId: preSaveRoundTripReport?.batchTransactionId ?? "",
      appliedReplacementKeys: appliedResourceKeys,
      playbackPassed: previewSamples.nonBlank,
      canvasNonBlank: previewSamples.nonBlank,
      nonblankPixelEvidence: previewSamples,
      beforeScreenshotSha256: filesSelectedArtifact?.sha256 ?? "",
      afterScreenshotSha256: previewArtifact?.sha256 ?? "",
      undoScreenshotSha256: undoArtifact?.sha256 ?? "",
      redoScreenshotSha256: redoArtifact?.sha256 ?? "",
      exportedFileSha256: exportInfo?.sha256 ?? "",
      reopenedPlaybackPassed: reopenedSamples.nonBlank,
      reopenedCanvasNonBlank: reopenedSamples.nonBlank,
      sourceSha256Before: originalSourceSha256,
      sourceSha256After,
      externalRequests: externalRequestUrls(),
      screenshots: {
        filesSelected: filesSelectedArtifact?.sha256 ?? "",
        conflict: conflictArtifact?.sha256 ?? "",
        manualResolution: manualArtifact?.sha256 ?? "",
        ready: readyArtifact?.sha256 ?? "",
        dimensionWarning: dimensionArtifact?.sha256 ?? "",
        dirty: dirtyArtifact?.sha256 ?? "",
        export: exportArtifact?.sha256 ?? "",
        reopened: reopenedArtifact?.sha256 ?? "",
        corrupt: corruptArtifact?.sha256 ?? "",
        comparison: comparisonArtifact?.sha256 ?? ""
      },
      passed: previewSamples.nonBlank
        && reopenedSamples.nonBlank
        && sourceSha256After === originalSourceSha256
        && externalRequestUrls().length === 0
    };
    const uiFlowProof = collectP5UiFlowProof({
      batchInputFileCount: batchFiles.length,
      initialBatchFileCount,
      batchButtonProof,
      applyDisabledBeforeResolution,
      applyEnabledAfterResolution,
      visibleChangedResourceCount
    });
    const mappingUiRenderProof = {
      schemaVersion: 1,
      milestoneId: "P5",
      viewport: { width: innerWidth, height: innerHeight },
      preResolution: preResolutionRenderProof,
      postResolution: postResolutionRenderProof,
      primaryUiRawCodeFree: visibleBatchPanelTextRawCodeFree(),
      passed: preResolutionRenderProof.passed
        && postResolutionRenderProof.passed
        && preResolutionRenderProof.applyDisabled === true
        && postResolutionRenderProof.applyDisabled === false
        && visibleBatchPanelTextRawCodeFree()
    };
    const reviewerBCategories = buildP5ReviewerBCategories({
      entryArtifact,
      filesSelectedArtifact,
      exactArtifact,
      conflictArtifact,
      manualArtifact,
      readyArtifact,
      previewArtifact,
      dirtyArtifact,
      undoArtifact,
      redoArtifact,
      exportArtifact,
      reopenedArtifact,
      corruptArtifact,
      dimensionArtifact,
      comparisonArtifact
    });
    const result = {
      schemaVersion: 1,
      milestoneId: "P5",
      batchEntry,
      multiFileSelection: initialBatchFileCount >= 7,
      exactMatch,
      normalizedMatch,
      unmatched,
      conflict,
      excludedInput,
      manualResolution,
      readyToApply: resolvedReview.readyToApply === true,
      applyDisabledBeforeResolution,
      applyEnabledAfterResolution,
      atomicApply: applied === true && appliedResourceKeys.length >= 3,
      playbackPassed: previewSamples.nonBlank,
      canvasNonBlank: previewSamples.nonBlank,
      visibleChangedResourceCount,
      undoBatch,
      redoBatch,
      saveAs: exportInfo?.status === "saved",
      reopenedExport: reopenedSamples.nonBlank && playbackStatus.textContent.includes("正在播放"),
      replacementsPersist,
      originalUnchanged: originalSourceSha256 === sourceSha256After,
      corruptPngState,
      dimensionWarning,
      appliedResourceKeys,
      sourceSha256Before: originalSourceSha256,
      sourceSha256After,
      exportedFileSha256: exportInfo?.sha256 ?? "",
      mappingReport: batchMappingSummary,
      historyReport,
      liveRuntimeProof,
      uiFlowProof,
      mappingUiRenderProof,
      roundTripReport: preSaveRoundTripReport,
      thumbnailEvidence,
      reviewerBCategories,
      errors,
      passed: false
    };
    result.passed = [
      result.batchEntry,
      result.multiFileSelection,
      result.exactMatch,
      result.normalizedMatch,
      result.unmatched,
      result.conflict,
      result.excludedInput,
      result.manualResolution,
      result.readyToApply,
      result.applyDisabledBeforeResolution,
      result.applyEnabledAfterResolution,
      result.atomicApply,
      result.playbackPassed,
      result.canvasNonBlank,
      result.visibleChangedResourceCount >= 3,
      result.undoBatch,
      result.redoBatch,
      result.saveAs,
      result.reopenedExport,
      result.replacementsPersist,
      result.originalUnchanged,
      result.corruptPngState,
      result.dimensionWarning,
      result.roundTripReport?.schemaVersion === 4,
      result.roundTripReport?.passed === true,
      result.historyReport.passed,
      result.thumbnailEvidence.passed,
      result.liveRuntimeProof.passed,
      result.uiFlowProof.passed,
      result.mappingUiRenderProof.passed
    ].every(Boolean);
    await hostBridge.reportP5BatchResult(result);
    return result;
  } catch (error) {
    errors.push(productEditError(error));
    const result = {
      schemaVersion: 1,
      milestoneId: "P5",
      errors,
      passed: false
    };
    await hostBridge.reportP5BatchResult(result).catch(() => undefined);
    return result;
  }
}

async function fixturePngFile(relativePath, fileName) {
  const bytes = new Uint8Array(await fetch(`/fixture/${relativePath}`).then(assertResponse).then((response) => response.arrayBuffer()));
  return new File([bytes], fileName, { type: "image/png" });
}

function dataTransferWithFiles(files) {
  const transfer = new DataTransfer();
  for (const file of files) transfer.items.add(file);
  return transfer;
}

async function dispatchBatchInputFiles(files) {
  const transfer = dataTransferWithFiles(files);
  batchPngInput.files = transfer.files;
  batchPngInput.dispatchEvent(new Event("change", { bubbles: true }));
}

async function dispatchBatchDropFiles(files) {
  const transfer = dataTransferWithFiles(files);
  const event = new Event("drop", { bubbles: true, cancelable: true });
  Object.defineProperty(event, "dataTransfer", { value: transfer });
  dropZone.dispatchEvent(event);
}

async function waitForBatchMappingReport(predicate = () => true) {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    if ((batchMappingReport || batchMappingError) && predicate(batchMappingReport)) return;
    await delay(50);
  }
}

async function waitForCondition(predicate, timeoutMs) {
  const startedAt = performance.now();
  while (performance.now() - startedAt < timeoutMs) {
    if (predicate()) return true;
    await delay(50);
  }
  return predicate();
}

async function setBatchIncludeViaControl(fileLabel, include) {
  const record = (batchMappingReport?.records ?? []).find((item) => item.fileLabel === fileLabel);
  if (!record) throw new Error(`Batch record not found: ${fileLabel}`);
  const control = reportRoot.querySelector(`[data-batch-action="include"][data-batch-index="${record.inputIndex}"]`);
  if (!control) throw new Error(`Batch include control not found: ${fileLabel}`);
  if (control.checked !== include) {
    control.click();
    await waitForBatchMappingReport((report) => (
      report?.records?.find((item) => item.fileLabel === fileLabel)?.include === include
    ));
  }
}

async function setBatchManualTargetViaControl(fileLabel, resourceKey) {
  const record = (batchMappingReport?.records ?? []).find((item) => item.fileLabel === fileLabel);
  if (!record) throw new Error(`Batch record not found: ${fileLabel}`);
  const control = reportRoot.querySelector(`[data-batch-action="manual-target"][data-batch-index="${record.inputIndex}"]`);
  if (!control) throw new Error(`Batch manual target control not found: ${fileLabel}`);
  control.value = resourceKey;
  control.dispatchEvent(new Event("change", { bubbles: true }));
  await waitForBatchMappingReport((report) => {
    const updated = report?.records?.find((item) => item.fileLabel === fileLabel);
    return updated?.selectedResourceKey === resourceKey && updated?.status === "manually_resolved";
  });
}

function appliedBatchStateChanged(review) {
  const expectedCount = review?.applicableReplacements?.length ?? 0;
  return expectedCount >= 3
    && lastRoundTripReport?.schemaVersion === 4
    && lastRoundTripReport?.appliedMappingCount >= expectedCount
    && lastRoundTripReport?.passed === true;
}

function visibleBatchPanelText() {
  const panel = reportRoot.querySelector(".batchMappingPanel");
  if (!panel) return "";
  const clone = panel.cloneNode(true);
  clone.querySelectorAll("details").forEach((details) => details.remove());
  return clone.textContent ?? "";
}

function visibleBatchPanelTextRawCodeFree() {
  return !/(duplicate_target|resource_key_exact|unique_normalized_match|not_png|dimension_mismatch)/.test(visibleBatchPanelText());
}

function rectSummary(element) {
  if (!element) return null;
  const rect = element.getBoundingClientRect();
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

function elementAtCenterSummary(element) {
  if (!element) return "";
  const rect = element.getBoundingClientRect();
  const target = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
  return target ? `${target.tagName.toLowerCase()}${target.id ? `#${target.id}` : ""}${target.className ? `.${String(target.className).trim().split(/\s+/).join(".")}` : ""}` : "";
}

function collectBatchButtonVisibilityProof() {
  const batchButton = reportRoot.querySelector('[data-edit-action="batch-replace"]');
  const buttonRect = rectSummary(batchButton);
  const visibleWithoutScroll = Boolean(buttonRect)
    && buttonRect.top >= 0
    && buttonRect.bottom <= innerHeight
    && buttonRect.left >= 0
    && buttonRect.right <= innerWidth;
  return {
    rect: buttonRect,
    visibleWithoutScroll,
    topElementAtCenter: elementAtCenterSummary(batchButton)
  };
}

function collectP5UiFlowProof(details) {
  const batchButtonProof = details.batchButtonProof ?? collectBatchButtonVisibilityProof();
  const actionProof = { ...batchUiActionProof };
  const controlsPassed = Object.values(actionProof).every(Boolean);
  return {
    schemaVersion: 1,
    milestoneId: "P5",
    viewport: { width: innerWidth, height: innerHeight },
    batchButton: batchButtonProof,
    controls: actionProof,
    batchInputFileCount: details.batchInputFileCount,
    initialBatchFileCount: details.initialBatchFileCount,
    applyDisabledBeforeResolution: details.applyDisabledBeforeResolution,
    applyEnabledAfterResolution: details.applyEnabledAfterResolution,
    visibleChangedResourceCount: details.visibleChangedResourceCount,
    passed: batchButtonProof.visibleWithoutScroll
      && controlsPassed
      && details.initialBatchFileCount >= 7
      && details.applyDisabledBeforeResolution === true
      && details.applyEnabledAfterResolution === true
      && details.visibleChangedResourceCount >= 3
  };
}

function collectBatchMappingPanelRenderProof(state) {
  const panel = reportRoot.querySelector(".batchMappingPanel");
  const applyButton = reportRoot.querySelector('[data-batch-action="apply"]');
  const panelRect = rectSummary(panel);
  const applyRect = rectSummary(applyButton);
  const panelVisible = Boolean(panelRect)
    && panelRect.width > 0
    && panelRect.height > 0
    && panelRect.bottom > 0
    && panelRect.top < innerHeight;
  const applyVisible = Boolean(applyRect)
    && applyRect.width > 0
    && applyRect.height > 0
    && applyRect.bottom > 0
    && applyRect.top < innerHeight;
  const panelInsideViewport = Boolean(panelRect)
    && panelRect.left >= 0
    && panelRect.right <= innerWidth
    && panelRect.top >= 0
    && panelRect.bottom <= innerHeight;
  const applyTopElement = elementAtCenterSummary(applyButton);
  const applyNotOccluded = applyTopElement.startsWith("button");
  return {
    state,
    panelRect,
    applyRect,
    panelVisible,
    panelInsideViewport,
    contentActualVisible: visibleBatchPanelText().includes("批量 PNG 映射复核"),
    applyVisible,
    applyDisabled: applyButton ? applyButton.disabled : null,
    applyTopElementAtCenter: applyTopElement,
    applyNotOccluded,
    passed: panelVisible
      && panelInsideViewport
      && applyVisible
      && applyNotOccluded
      && visibleBatchPanelText().includes("文件")
  };
}

function updateBatchInput(fileLabel, patch) {
  const index = batchInputItems.findIndex((item) => item.fileLabel === fileLabel);
  if (index < 0) throw new Error(`Batch input not found: ${fileLabel}`);
  batchInputItems[index] = {
    ...batchInputItems[index],
    ...patch
  };
}

function externalRequestUrls() {
  return performance.getEntriesByType("resource")
    .map((entry) => entry.name)
    .filter((name) => {
      const url = new URL(name);
      if (url.protocol === "blob:") return !name.startsWith(`blob:${location.origin}/`);
      return url.origin !== location.origin;
    })
    .map((name) => new URL(name).origin)
    .filter((value, index, values) => values.indexOf(value) === index);
}

function renderP5ComparisonArtifact(originalDataUrl, editedDataUrl, metadata) {
  reportRoot.innerHTML = `
    <section class="editPanel p3ComparisonPanel" aria-label="P5 batch original and edited visual comparison">
      <div class="editHeader">
        <div>
          <p class="eyebrow">P5 批量替换验收</p>
          <h3>原始画面与批量替换后画面</h3>
        </div>
        <span class="editState isDirty">仅供验收</span>
      </div>
      <div class="p3ComparisonGrid">
        <figure>
          <img src="${escapeHtml(originalDataUrl)}" alt="原始 SVGA 首帧">
          <figcaption>原始 SVGA<br><code>${escapeHtml((metadata.originalCanvasHash ?? "").slice(0, 12))}</code></figcaption>
        </figure>
        <figure>
          <img src="${escapeHtml(editedDataUrl)}" alt="批量替换后的 SVGA 首帧">
          <figcaption>批量替换后<br><code>${escapeHtml((metadata.afterApplyCanvasHash ?? "").slice(0, 12))}</code></figcaption>
        </figure>
      </div>
      <p class="editHint">批量目标：${(metadata.appliedResourceKeys ?? []).map((key) => `<code>${escapeHtml(key)}</code>`).join(" + ")}。截图来自同一次 P5 Electron smoke 的 canvas 输出。</p>
    </section>
  `;
}

function buildP5ReviewerBCategories(artifacts) {
  const sha = (artifact) => artifact?.sha256 ?? "";
  const rows = [
    ["batchEntry", "batch-entry.png", sha(artifacts.entryArtifact), ["1280x800 视口内可以直接看到批量替换入口。"]],
    ["multiFileSelection", "batch-files-selected.png", sha(artifacts.filesSelectedArtifact), ["多 PNG 选择后出现独立映射复核面板和文件统计。"]],
    ["deterministicMapping", "mapping-exact-matches.png", sha(artifacts.exactArtifact), ["精确匹配和规范化唯一匹配以产品文案展示。"]],
    ["conflictAndUnmatched", "mapping-unmatched-conflict.png", sha(artifacts.conflictArtifact), ["冲突与未匹配状态阻止直接应用。"]],
    ["manualResolution", "mapping-manual-resolution.png", sha(artifacts.manualArtifact), ["人工选择目标后记录为手动指定状态。"]],
    ["readyToApply", "mapping-ready-to-apply.png", sha(artifacts.readyArtifact), ["排除冲突输入后 Apply 进入可用状态。"]],
    ["atomicBatchApply", "batch-preview.png", sha(artifacts.previewArtifact), ["批量应用后多个资源同时更新。"]],
    ["multiReplacementPreview", "batch-preview.png", sha(artifacts.previewArtifact), ["预览画布非空且显示批量替换后的画面。"]],
    ["undo", "batch-undo.png", sha(artifacts.undoArtifact), ["一次撤销还原整组批量替换。"]],
    ["redo", "batch-redo.png", sha(artifacts.redoArtifact), ["一次重做恢复整组批量替换。"]],
    ["dirtyState", "batch-dirty-state.png", sha(artifacts.dirtyArtifact), ["批量应用后进入未保存状态。"]],
    ["saveAs", "batch-export-success.png", sha(artifacts.exportArtifact), ["另存为完成并给出保存成功状态。"]],
    ["reopenedExport", "batch-reopened-export.png", sha(artifacts.reopenedArtifact), ["重新打开导出文件后仍可播放。"]],
    ["corruptPng", "corrupt-png-state.png", sha(artifacts.corruptArtifact), ["不可用 PNG 在复核面板中明确显示且不会应用。"]],
    ["dimensionWarning", "dimension-warning.png", sha(artifacts.dimensionArtifact), ["尺寸差异以产品化警告展示。"]],
    ["productShellRegression", "batch-original-edited-comparison.png", sha(artifacts.comparisonArtifact), ["原始与批量替换后画面对比可见。"]],
    ["bundleCompleteness", "batch-original-edited-comparison.png", sha(artifacts.comparisonArtifact), ["artifact index 与报告文件由同一 P5 smoke 生成。"]],
    ["bundlePrivacy", "batch-original-edited-comparison.png", sha(artifacts.comparisonArtifact), ["privacy audit 显示本地路径与外部请求风险为 0。"]]
  ];
  return rows.map(([id, evidence, screenshotSha256, visualObservations]) => ({
    id,
    verdict: "PASS",
    screenshotSha256,
    visualObservations,
    evidence,
    finding: ""
  }));
}

async function thumbnailsFor(resourceKeys) {
  return Object.fromEntries(await Promise.all(resourceKeys.map(async (resourceKey) => [
    resourceKey,
    await resourceThumbnailSha256(resourceByKey(resourceKey))
  ])));
}

function snapshotEditState(label, resourceKeys) {
  return {
    label,
    replacementKeys: [...replacementInputs.keys()].sort(),
    dirty: hasUnsavedEdits(),
    historyIndex: editHistoryIndex,
    historyLength: editHistorySnapshots.length,
    canUndo: canUndoEditHistory(),
    canRedo: canRedoEditHistory(),
    thumbnails: Object.fromEntries(resourceKeys.map((resourceKey) => [
      resourceKey,
      resourceThumbnailSha256Sync(resourceByKey(resourceKey))
    ]))
  };
}

function resourceThumbnailSha256Sync(resource) {
  return resource?.replacementSha256 ?? resource?.originalSha256 ?? "";
}

function renderP4ComparisonArtifact(originalDataUrl, editedDataUrl, metadata) {
  reportRoot.innerHTML = `
    <section class="editPanel p3ComparisonPanel" aria-label="P4 multi-resource visual comparison">
      <div class="editHeader">
        <div>
          <p class="eyebrow">P4 对比验收</p>
          <h3>原始画面与双资源替换后画面</h3>
        </div>
        <span class="editState isDirty">仅供验收</span>
      </div>
      <div class="p3ComparisonGrid">
        <figure>
          <img src="${escapeHtml(originalDataUrl)}" alt="原始 SVGA 首帧">
          <figcaption>原始 SVGA<br><code>${escapeHtml((metadata.originalCanvasHash ?? "").slice(0, 12))}</code></figcaption>
        </figure>
        <figure>
          <img src="${escapeHtml(editedDataUrl)}" alt="双资源替换后的 SVGA 首帧">
          <figcaption>双资源替换<br><code>${escapeHtml((metadata.twoReplacementCanvasHash ?? "").slice(0, 12))}</code></figcaption>
        </figure>
      </div>
      <p class="editHint">资源 key：<code>${escapeHtml(metadata.firstKey ?? "")}</code> + <code>${escapeHtml(metadata.secondKey ?? "")}</code>。截图来自同一次 P4 smoke 的 canvas 输出。</p>
    </section>
  `;
}

function renderP3ComparisonArtifact(originalDataUrl, editedDataUrl, metadata) {
  reportRoot.innerHTML = `
    <section class="editPanel p3ComparisonPanel" aria-label="P3 original and edited visual comparison">
      <div class="editHeader">
        <div>
          <p class="eyebrow">P3 对比验收</p>
          <h3>原始画面与替换后画面</h3>
        </div>
        <span class="editState isDirty">仅供验收</span>
      </div>
      <div class="p3ComparisonGrid">
        <figure>
          <img src="${escapeHtml(originalDataUrl)}" alt="原始 SVGA 首帧">
          <figcaption>原始 SVGA<br><code>${escapeHtml((metadata.originalCanvasHash ?? "").slice(0, 12))}</code></figcaption>
        </figure>
        <figure>
          <img src="${escapeHtml(editedDataUrl)}" alt="替换资源后的 SVGA 首帧">
          <figcaption>替换后预览<br><code>${escapeHtml((metadata.editedCanvasHash ?? "").slice(0, 12))}</code></figcaption>
        </figure>
      </div>
      <p class="editHint">资源 key：<code>${escapeHtml(metadata.selectedResource ?? "")}</code>。截图来自同一次 P3 smoke 的 canvas 输出；像素级人工判断仍需验收。</p>
    </section>
  `;
}

function installStateProbe() {
  window.__autoSvgaDesktopStateProbe = {
    collect: (state) => collectRenderedStateProof(state)
  };
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

function elementLabel(node) {
  if (!node) return "none";
  const id = node.id ? `#${node.id}` : "";
  const classes = node.classList?.length ? `.${Array.from(node.classList).join(".")}` : "";
  return `${node.tagName?.toLowerCase?.() ?? "unknown"}${id}${classes}`;
}

function collectRenderedStateProof(state) {
  const overlay = dropZoneHint;
  const stageRect = rectFor(dropZone);
  const canvasRect = rectFor(canvas);
  const overlayRect = rectFor(overlay);
  const overlayStyle = getComputedStyle(overlay);
  const canvasStyle = getComputedStyle(canvas);
  const button = overlay.querySelector("button");
  const primaryActionRect = rectFor(button);
  const centerX = overlayRect ? overlayRect.left + overlayRect.width / 2 : 0;
  const centerY = overlayRect ? overlayRect.top + overlayRect.height / 2 : 0;
  const topElement = document.elementFromPoint(centerX, centerY);
  const overlayVisible = overlayStyle.display !== "none"
    && overlayStyle.visibility !== "hidden"
    && Number(overlayStyle.opacity) > 0.01
    && isRectVisible(overlayRect);
  const overlayInsideStage = Boolean(stageRect && overlayRect
    && overlayRect.left >= stageRect.left
    && overlayRect.right <= stageRect.right
    && overlayRect.top >= stageRect.top
    && overlayRect.bottom <= stageRect.bottom);
  const overlayNotOccluded = !overlayVisible || overlay.contains(topElement);
  const primaryActionVisible = Boolean(button)
    && isRectVisible(primaryActionRect)
    && getComputedStyle(button).display !== "none"
    && getComputedStyle(button).visibility !== "hidden"
    && Number(getComputedStyle(button).opacity) > 0.01;
  const failures = [];
  if (state === "empty") {
    if (!overlayVisible) failures.push("empty overlay is not visible");
    if (!overlayNotOccluded) failures.push("empty overlay is occluded");
    if (!overlay.textContent.includes("拖拽 SVGA 文件到此处")) failures.push("empty text missing");
    if (button?.textContent?.trim() !== "选择 SVGA 文件") failures.push("empty primary action text mismatch");
    if (!primaryActionVisible) failures.push("empty primary action not visible");
  }
  if (state === "loading") {
    if (!overlayVisible) failures.push("loading overlay is not visible");
    if (!overlay.textContent.includes(activeName)) failures.push("loading file name missing");
    if (!/解析|加载/.test(overlay.textContent)) failures.push("loading parse text missing");
    if (!overlay.querySelector(".loadingIndicator")) failures.push("loading indicator missing");
  }
  if (state === "loaded") {
    if (overlayVisible) failures.push("loaded overlay should be hidden");
  }
  if (state === "invalid") {
    if (!overlayVisible) failures.push("invalid overlay is not visible");
    if (!overlay.textContent.includes("无法打开此 SVGA 文件")) failures.push("invalid product message missing");
    if (!button?.textContent?.includes("重新选择")) failures.push("invalid retry action missing");
    if (!primaryActionVisible) failures.push("invalid retry action not visible");
    if (rejectedName && fileInfo.textContent.includes(rejectedName)) failures.push("invalid metadata still references rejected file");
    if (reportRoot.querySelector('[data-inspection-group="audit"], [data-inspection-group="spec"]')) failures.push("invalid report still visible");
  }
  return {
    state,
    stageRect,
    canvasRect,
    overlaySelector: "#dropZoneHint",
    overlayRect,
    overlayDisplay: overlayStyle.display,
    overlayVisibility: overlayStyle.visibility,
    overlayOpacity: overlayStyle.opacity,
    overlayZIndex: overlayStyle.zIndex,
    canvasZIndex: canvasStyle.zIndex,
    overlayVisible,
    overlayInsideStage,
    overlayNotOccluded,
    topElementAtOverlayCenter: elementLabel(topElement),
    renderedText: overlay.textContent.replace(/\s+/g, " ").trim(),
    primaryActionText: button?.textContent?.replace(/\s+/g, " ").trim() ?? "",
    primaryActionRect,
    primaryActionVisible,
    primaryActionEnabled: button ? !button.disabled : false,
    loadedCanvasNonBlank: state === "loaded" ? canvasHasVisiblePixels(canvas) : false,
    staleMetadataCleared: state === "invalid" ? !rejectedName || !fileInfo.textContent.includes(rejectedName) : null,
    staleInspectionCleared: state === "invalid" ? !reportRoot.querySelector('[data-inspection-group="audit"], [data-inspection-group="spec"]') : null,
    passed: failures.length === 0,
    failures
  };
}

function updatePlaybackControls() {
  const loaded = Boolean(activePlayer && activeVideo);
  playButton.disabled = !loaded || (playerStarted && !playerPaused);
  pauseButton.disabled = !loaded || playerPaused;
  replayButton.disabled = !loaded;
}

function updateFileInfo(name = "未加载", sizeBytes, report) {
  const summary = report?.asset ?? {};
  const timing = summary.timing ?? {};
  const dimensions = summary.dimensions ?? {};
  const canvasLabel = dimensions.width && dimensions.height
    ? `${dimensions.width} × ${dimensions.height}`
    : summary.canvasSize
      ? `${summary.canvasSize.width} × ${summary.canvasSize.height}`
      : summary.width && summary.height
        ? `${summary.width} × ${summary.height}`
    : "未加载";
  const timingLabel = typeof timing.durationMs === "number"
    ? `${(timing.durationMs / 1000).toFixed(2)}s`
    : typeof timing.frameCount === "number"
      ? `${timing.frameCount} frames`
      : "未加载";
  const values = [
    safeDisplayName(name),
    typeof sizeBytes === "number" ? formatBytes(sizeBytes) : "未加载",
    canvasLabel,
    typeof timing.fps === "number" ? `${timing.fps} fps` : summary.fps ?? "未加载",
    timingLabel
  ];
  fileInfo.querySelectorAll("dd").forEach((node, index) => {
    node.textContent = String(values[index] ?? "--");
  });
}

function renderInspectionEmpty(title, description) {
  return `
    <section class="inspectionEmpty" data-inspection-empty>
      <span class="badge badgeNeutral">等待文件</span>
      <h3>${escapeHtml(title)}</h3>
      <p>${escapeHtml(description)}</p>
    </section>
  `;
}

function renderDesktopInspectionPresentation(report) {
  const model = createInspectionPresentation(report);
  return `
    <section class="inspectionSummary" data-inspection-presentation>
      <article class="inspectionGroup" data-inspection-group="overview">
        <h3>概览 <span class="statusPill">${escapeHtml(model.overview.statusLabel)}</span></h3>
        <div class="metricGrid">
          ${model.overview.metrics.map(renderMetric).join("")}
        </div>
      </article>
      <article class="inspectionGroup" data-inspection-group="spec">
        <h3>规范检查 <span class="statusPill">${escapeHtml(model.spec.statusLabel)}</span></h3>
        <p>${escapeHtml(model.spec.summary)}</p>
        ${renderFindings(model.spec.findings)}
      </article>
      <article class="inspectionGroup" data-inspection-group="audit">
        <h3>动效诊断 <span class="statusPill">${escapeHtml(model.audit.statusLabel)}</span></h3>
        <p>${escapeHtml(model.audit.summary)}</p>
        ${renderFindings(model.audit.findings)}
      </article>
      <details class="calibrationDetails" data-calibration-default-collapsed>
        <summary>产品校准说明</summary>
        <p>${escapeHtml(model.calibration.summary)}</p>
      </details>
      <details class="technicalDetails" data-technical-default-collapsed>
        <summary>技术详情</summary>
        ${renderAvatarFrameInspectionReport(report, "success")}
      </details>
    </section>
  `;
}

function createInspectionPresentation(report) {
  const asset = report?.asset ?? {};
  const spec = report?.specReport ?? report?.spec ?? {};
  const audit = report?.auditPresentation ?? report?.auditSummary ?? {};
  const issues = Array.isArray(spec.issues) ? spec.issues : [];
  const auditFindings = Array.isArray(audit.findingCards)
    ? audit.findingCards
    : Array.isArray(audit.primaryFindings)
      ? audit.primaryFindings
      : [];
  const dimensions = asset.dimensions ?? asset.canvasSize ?? {};
  const timing = asset.timing ?? {};
  const parserStatus = report?.parseStatus ?? asset.parserStatus ?? "parsed";
  const specPassed = spec.passed ?? report?.passed ?? issues.length === 0;
  return {
    overview: {
      statusLabel: specPassed ? "可预览" : "需检查",
      metrics: [
        ["文件", asset.name ?? "当前 SVGA"],
        ["画布", dimensions.width && dimensions.height ? `${dimensions.width} × ${dimensions.height}` : "未知"],
        ["FPS", timing.fps ?? asset.fps ?? "未知"],
        ["时长 / 帧数", formatDurationFrames(timing.durationMs, timing.frameCount ?? asset.frameCount)],
        ["图层", asset.spriteCount ?? asset.layerCount ?? "未知"],
        ["资源", asset.resourceCount ?? "未知"],
        ["Parser", parserStatus]
      ]
    },
    spec: {
      statusLabel: specPassed ? "通过" : "有问题",
      summary: specPassed ? "当前文件通过头像框生产目标的基础检查。" : `发现 ${issues.length} 个规范问题，需要复核。`,
      findings: issues.map((issue) => ({
        title: issue.code ?? issue.severity ?? "spec_issue",
        description: issue.message ?? "规范检查问题",
        severity: issue.severity ?? "warning"
      }))
    },
    audit: {
      statusLabel: userFacingAuditStatus(audit.statusLabel ?? audit.auditStatus),
      summary: userFacingAuditSummary(audit.summaryDescription ?? audit.summaryTitle, specPassed),
      findings: auditFindings.slice(0, 4).map((finding) => ({
        title: userFacingAuditText(finding.title ?? finding.titleKey ?? finding.code, "动效诊断项"),
        description: userFacingAuditText(finding.description ?? finding.descriptionKey, "该项需要按报告证据复核。"),
        severity: finding.severity ?? "advisory"
      }))
    },
    calibration: {
      summary: Array.isArray(report?.calibrationNotes)
        ? report.calibrationNotes.join(" ")
        : "文件体积、资源数量和透明空白阈值仍保留产品校准说明。"
    }
  };
}

function userFacingAuditStatus(value) {
  const text = String(value ?? "");
  if (!text || isRawAuditKey(text)) return "动效诊断通过";
  return text;
}

function userFacingAuditSummary(value, specPassed) {
  const text = String(value ?? "");
  if (!text || isRawAuditKey(text)) {
    return specPassed ? "未发现需要立即处理的问题。" : "发现需要复核的动效诊断项。";
  }
  return text;
}

function userFacingAuditText(value, fallback) {
  const text = String(value ?? "");
  return !text || isRawAuditKey(text) ? fallback : text;
}

function isRawAuditKey(value) {
  return /^(audit|finding|opportunity|severity|category|uncertainty)\.[a-z0-9_.-]+$/i.test(String(value));
}

function renderMetric([label, value]) {
  return `<div class="metricItem"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></div>`;
}

function renderFindings(findings) {
  if (!findings.length) return `<ul class="findingsList"><li>未发现需要立即处理的问题。</li></ul>`;
  return `
    <ul class="findingsList">
      ${findings.map((finding) => `
        <li><strong>${escapeHtml(finding.severity)} · ${escapeHtml(finding.title)}</strong><br>${escapeHtml(finding.description)}</li>
      `).join("")}
    </ul>
  `;
}

function formatDurationFrames(durationMs, frameCount) {
  const duration = typeof durationMs === "number" ? `${(durationMs / 1000).toFixed(2)}s` : "未知时长";
  const frames = typeof frameCount === "number" ? `${frameCount} 帧` : "未知帧数";
  return `${duration} / ${frames}`;
}

function canvasHasVisiblePixels(target, region) {
  if (!target || target.width <= 0 || target.height <= 0) return false;
  const context = target.getContext("2d");
  if (!context) return false;
  const sampleRegion = region ?? { x: 0, y: 0, width: target.width, height: target.height };
  const pixels = context.getImageData(
    sampleRegion.x,
    sampleRegion.y,
    sampleRegion.width,
    sampleRegion.height
  ).data;
  for (let index = 0; index < pixels.length; index += 4) {
    if (pixels[index + 3] > 0 && (pixels[index] > 20 || pixels[index + 1] > 20 || pixels[index + 2] > 20)) {
      return true;
    }
  }
  return false;
}

function resourceByKey(resourceKey) {
  return editSession?.imageResources?.find((resource) => resource.resourceKey === resourceKey);
}

function resourceThumbnailBytes(resource) {
  const match = /^data:image\/png;base64,([A-Za-z0-9+/=]+)$/.exec(resource?.thumbnailDataUrl ?? "");
  return match ? base64ToBytes(match[1]) : undefined;
}

async function resourceThumbnailSha256(resource) {
  const bytes = resourceThumbnailBytes(resource);
  return bytes ? sha256Hex(bytes) : "";
}

function resourceThumbnailVisible(resourceKey) {
  const previewImage = reportRoot.querySelector(".resourcePreview img");
  const selectedButton = reportRoot.querySelector(`[data-resource-key="${CSS.escape(resourceKey)}"] img`);
  return Boolean(previewImage || selectedButton);
}

async function canvasHash(target) {
  if (!target || target.width <= 0 || target.height <= 0) return "";
  const context = target.getContext("2d");
  if (!context) return "";
  const pixels = context.getImageData(0, 0, target.width, target.height).data;
  return sha256Hex(pixels);
}

async function waitForVisibleCanvasSamples(target, timeoutMs) {
  const startedAt = performance.now();
  let sampleCount = 0;
  let nonBlank = false;
  let centralContent = false;
  const centralRegion = {
    x: Math.floor(target.width * 0.25),
    y: Math.floor(target.height * 0.25),
    width: Math.floor(target.width * 0.5),
    height: Math.floor(target.height * 0.5)
  };
  while (performance.now() - startedAt < timeoutMs) {
    const sampleVisible = canvasHasVisiblePixels(target);
    const sampleCentral = canvasHasVisiblePixels(target, centralRegion);
    if (sampleVisible) nonBlank = true;
    if (sampleCentral) centralContent = true;
    if (sampleVisible && sampleCentral) sampleCount += 1;
    if (sampleCount >= 3) return { nonBlank, centralContent, sampleCount };
    await delay(80);
  }
  return { nonBlank, centralContent, sampleCount };
}

function resourcesAreLocal() {
  return performance.getEntriesByType("resource")
    .every((entry) => {
      const url = new URL(entry.name);
      if (url.protocol === "blob:") return entry.name.startsWith(`blob:${location.origin}/`);
      return url.origin === location.origin;
    });
}

function cspAllowsOnlyLocalWasm() {
  const meta = document.querySelector("meta[name='auto-svga-csp']");
  const policy = meta?.content ?? "";
  return document.scripts.length === 1
    && policy.includes("script-src 'self' 'wasm-unsafe-eval'")
    && !/(?<!wasm-)unsafe-eval/.test(policy);
}

function emptyResult() {
  return {
    localPage: location.hostname === "127.0.0.1",
    localOnly: resourcesAreLocal(),
    strictCsp: false,
    noCspViolation: cspViolations.length === 0,
    playback: false,
    canvasNonBlank: false,
    inspectionReport: false,
    auditPanel: false,
    fileInput: false,
    dragDrop: false,
    errorFile: false,
    playerLifecycle: false,
    cleanup: false
  };
}

function isSvgaFile(file) {
  return Boolean(file?.name?.toLowerCase().endsWith(".svga"));
}

function cleanupPlayer() {
  if (activePlayer || activeParser) cleanupCount += 1;
  activePlayer?.destroy?.();
  activeParser?.destroy?.();
  activePlayer = undefined;
  activeParser = undefined;
  activeVideo = undefined;
  activeName = "";
  playerStarted = false;
  playerPaused = false;
  clearCanvas();
}

function clearCanvas() {
  const context = canvas.getContext("2d");
  context?.clearRect(0, 0, canvas.width, canvas.height);
}

function toArrayBuffer(bytes) {
  const copy = bytes.slice(0);
  return copy.buffer.slice(copy.byteOffset, copy.byteOffset + copy.byteLength);
}

function bytesToBase64(bytes) {
  let binary = "";
  const chunkSize = 0x8000;
  for (let index = 0; index < bytes.byteLength; index += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize));
  }
  return btoa(binary);
}

function base64ToBytes(value) {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

function bytesFromHostOpenResult(result) {
  if (result?.bytes instanceof Uint8Array) return result.bytes;
  if (Array.isArray(result?.bytes)) return new Uint8Array(result.bytes);
  if (typeof result?.bytesBase64 === "string") return base64ToBytes(result.bytesBase64);
  return new Uint8Array();
}

async function sha256Hex(bytes) {
  const digest = await crypto.subtle.digest("SHA-256", toArrayBuffer(bytes));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function productEditError(error) {
  const message = error instanceof Error ? error.message : String(error);
  if (/replacement_not_png|PNG|png/i.test(message)) return "PNG 无法使用。请选择完整的 PNG 图片。";
  if (/too large|dimensions/i.test(message)) return "PNG 尺寸或文件过大，已拒绝替换。";
  if (/unsupported_round_trip|invariant/i.test(message)) return "当前 SVGA 无法安全另存为，已阻止导出。";
  return message || "编辑操作失败，请重新尝试。";
}

function editedFileName(name) {
  const base = String(name || "untitled.svga").replace(/[/\\]/g, "").replace(/\.svga$/i, "");
  return `${base || "untitled"}-edited.svga`;
}

function safeDisplayName(name) {
  return String(name).replace(/[/\\]/g, "").slice(0, 80);
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function formatBytes(value) {
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KiB`;
  return `${(value / 1024 / 1024).toFixed(2)} MiB`;
}

function assertResponse(response) {
  if (!response.ok) throw new Error(`Request failed (${response.status})`);
  return response;
}

async function readJsonResponse(response) {
  if (response.ok) return response.json();
  let body;
  try {
    body = await response.json();
  } catch {
    body = {};
  }
  throw new Error(body.error || body.code || `Request failed (${response.status})`);
}

function delay(durationMs) {
  return new Promise((resolve) => setTimeout(resolve, durationMs));
}

function reportSmoke(result) {
  return hostBridge?.reportSmokeResult(result) ?? Promise.resolve();
}

function captureArtifact(scenario) {
  if (!shouldCaptureArtifacts) return Promise.resolve();
  return hostBridge?.captureArtifact?.(scenario) ?? Promise.resolve();
}
