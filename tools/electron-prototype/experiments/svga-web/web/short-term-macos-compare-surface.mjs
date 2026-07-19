import {
  compareSlotView,
  generalCompareTraceView,
  optimizationCompareTraceView,
  renderGeneralComparePanelHtml,
  renderCompareInfoHtml,
  renderGeneralComparePlaceholderHtml,
  renderOptimizationCompareResultHtml
} from "./short-term-macos-compare-model.mjs";
import { toUint8Array } from "./short-term-macos-byte-model.mjs";
import {
  applyCompareSlotView,
  applyCompareTraceView,
  markCompareSlotLoaded,
  renderCompareInfoPanel
} from "./short-term-macos-compare-renderers.mjs";

export function renderShortTermCompareSlot({ nodes, slot, title, model, fallbackMeta = "" }) {
  applyCompareSlotView(nodes, slot, compareSlotView(slot, title, model, fallbackMeta));
}

export function renderShortTermGeneralCompareTrace(nodes) {
  applyCompareTraceView(nodes.compareView, generalCompareTraceView());
}

export function renderShortTermOptimizationCompareTrace(nodes) {
  applyCompareTraceView(nodes.compareView, optimizationCompareTraceView());
}

export function renderShortTermCompareInfo({ nodes, slot, title, model, displayName, actions = [] }) {
  renderCompareInfoPanel(nodes, slot, renderCompareInfoHtml(title, model, displayName, actions));
}

export function renderShortTermGeneralComparePlaceholder(nodes) {
  renderCompareInfoPanel(nodes, "B", renderGeneralComparePlaceholderHtml());
}

export function renderShortTermGeneralComparePanel({ nodes, state, bModel, bDisplayName, actions = [] }) {
  const compareBSource = state.compareBSource;
  renderCompareInfoPanel(nodes, "B", renderGeneralComparePanelHtml({
    aTitle: "A 文件",
    aModel: state.model,
    aDisplayName: state.displayName,
    bTitle: "B 文件",
    bModel: bModel ?? compareBSource?.model,
    bDisplayName: bDisplayName ?? compareBSource?.displayName ?? "",
    actions
  }));
}

export function renderShortTermOptimizationCompareResult({ nodes, model }) {
  renderCompareInfoPanel(nodes, "B", renderOptimizationCompareResultHtml(model));
}

export function markShortTermCompareSlotLoaded({ nodes, slot }) {
  markCompareSlotLoaded(nodes, slot);
}

export async function enterShortTermGeneralCompare({
  nodes,
  state,
  setView,
  mountPlayback,
  clearCanvas
}) {
  setView("compare");
  renderShortTermGeneralCompareTrace(nodes);
  renderShortTermCompareSlot({
    nodes,
    slot: "A",
    title: state.sourceBytes ? state.displayName || "A 文件" : "未打开文件",
    model: state.model
  });
  renderShortTermCompareSlot({
    nodes,
    slot: "B",
    title: state.compareBSource?.displayName || "文件未打开",
    model: state.compareBSource?.model
  });
  renderShortTermGeneralComparePanel({
    nodes,
    state,
    actions: [
      `<button class="toolbarButton compareExitButton" type="button" data-action="back-preview">退出对比</button>`
    ]
  });
  if (state.sourceBytes) {
    await mountPlayback("compareA", nodes.compareCanvasA, state.previewBytes ?? state.sourceBytes, {
      loop: state.comparePlaybackLooping !== false
    });
    markShortTermCompareSlotLoaded({ nodes, slot: "A" });
  } else {
    clearCanvas(nodes.compareCanvasA);
  }
  if (state.compareBSource?.bytes?.byteLength) {
    await mountPlayback("compareB", nodes.compareCanvasB, state.compareBSource.bytes, {
      start: state.compareAPlayback?.playing !== false,
      loop: state.comparePlaybackLooping !== false
    });
    markShortTermCompareSlotLoaded({ nodes, slot: "B" });
  } else {
    clearCanvas(nodes.compareCanvasB);
  }
}

export async function openShortTermCompareAFromHost({
  bridge,
  state,
  loadOpenedSource,
  enterGeneralCompare,
  refreshRecentFiles
}) {
  if (!bridge?.openSvgaFile) return false;
  const opened = await bridge.openSvgaFile();
  if (!opened || opened.status === "cancelled") return false;
  await loadOpenedSource({
    bytes: toUint8Array(opened.bytes),
    displayName: opened.basename || "compare-a.svga",
    sourceId: opened.sourceId || "",
    openedFromHost: true,
    startPlayback: false
  }, { preserveComparePeer: true });
  if (!state.sourceBytes) return false;
  await enterGeneralCompare();
  await refreshRecentFiles();
  return true;
}

export async function openShortTermCompareBFromHost({
  bridge,
  nodes,
  state,
  enterGeneralCompare,
  inspectShortTerm,
  mountPlayback,
  refreshRecentFiles
}) {
  if (!bridge?.openSvgaFile) return;
  if (state.view !== "compare") await enterGeneralCompare();
  applyCompareSlotView(nodes, "B", {
    title: "选择 B 文件",
    meta: "等待选择 SVGA",
    compareState: "selecting"
  });
  const opened = await bridge.openSvgaFile();
  if (!opened || opened.status === "cancelled") {
    renderShortTermCompareSlot({ nodes, slot: "B", title: "文件未打开" });
    return false;
  }
  if (opened.status !== "opened" || !opened.bytes) {
    applyCompareSlotView(nodes, "B", {
      title: "无法打开 B 文件",
      meta: opened.code === "unsupported_file_type" ? "仅支持 SVGA 文件" : "文件选择未完成",
      compareState: "unsupported"
    });
    return false;
  }
  const bytes = toUint8Array(opened.bytes);
  applyCompareSlotView(nodes, "B", {
    title: opened.basename || "B 文件",
    meta: "正在加载 SVGA",
    compareState: "waiting"
  });
  let model;
  try {
    model = await inspectShortTerm(bytes, opened.basename || "compare.svga");
    await mountPlayback("compareB", nodes.compareCanvasB, bytes, {
      start: state.compareAPlayback?.playing !== false,
      loop: state.comparePlaybackLooping !== false
    });
  } catch {
    applyCompareSlotView(nodes, "B", {
      title: "无法打开 B 文件",
      meta: "文件内容不完整或格式异常",
      compareState: "unsupported"
    });
    return false;
  }
  state.compareBSource = {
    bytes: new Uint8Array(bytes),
    displayName: opened.basename || "compare.svga",
    model
  };
  markShortTermCompareSlotLoaded({ nodes, slot: "B" });
  renderShortTermCompareSlot({ nodes, slot: "B", title: opened.basename || "B 文件", model });
  renderShortTermGeneralComparePanel({
    nodes,
    state,
    bModel: model,
    bDisplayName: opened.basename || "compare.svga",
    actions: [
      `<button class="toolbarButton compareExitButton" type="button" data-action="back-preview">退出对比</button>`
    ]
  });
  await refreshRecentFiles();
  return true;
}

export async function loadShortTermCompareAFromDroppedFile({
  file,
  state,
  loadOpenedSource,
  enterGeneralCompare
}) {
  if (!file) return false;
  await loadOpenedSource({
    bytes: new Uint8Array(await file.arrayBuffer()),
    displayName: file.name || "compare-a.svga",
    sourceId: "",
    openedFromHost: false,
    startPlayback: false
  }, { preserveComparePeer: true });
  if (!state.sourceBytes) return false;
  await enterGeneralCompare();
  return true;
}

export async function loadShortTermCompareBFromDroppedFile({
  file,
  nodes,
  state,
  enterGeneralCompare,
  inspectShortTerm,
  mountPlayback
}) {
  if (!file) return;
  if (state.view !== "compare") await enterGeneralCompare();
  const bytes = new Uint8Array(await file.arrayBuffer());
  const model = await inspectShortTerm(bytes, file.name || "compare.svga");
  await mountPlayback("compareB", nodes.compareCanvasB, bytes, {
    start: state.compareAPlayback?.playing !== false,
    loop: state.comparePlaybackLooping !== false
  });
  state.compareBSource = {
    bytes: new Uint8Array(bytes),
    displayName: file.name || "compare.svga",
    model
  };
  markShortTermCompareSlotLoaded({ nodes, slot: "B" });
  renderShortTermCompareSlot({ nodes, slot: "B", title: file.name || "B 文件", model });
  renderShortTermGeneralComparePanel({
    nodes,
    state,
    bModel: model,
    bDisplayName: file.name || "compare.svga",
    actions: [
      `<button class="toolbarButton compareExitButton" type="button" data-action="back-preview">退出对比</button>`
    ]
  });
  return true;
}
