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

export function renderShortTermGeneralComparePanel({ nodes, state, bModel, bDisplayName = "", actions = [] }) {
  renderCompareInfoPanel(nodes, "B", renderGeneralComparePanelHtml({
    aTitle: "A 文件",
    aModel: state.model,
    aDisplayName: state.displayName,
    bTitle: "B 文件",
    bModel,
    bDisplayName,
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
  renderShortTermCompareSlot({ nodes, slot: "B", title: "文件未打开" });
  renderShortTermGeneralComparePanel({
    nodes,
    state,
    actions: [
      `<button class="toolbarButton compareExitButton" type="button" data-action="back-preview">退出对比</button>`
    ]
  });
  if (state.sourceBytes) {
    await mountPlayback("compareA", nodes.compareCanvasA, state.previewBytes ?? state.sourceBytes);
    markShortTermCompareSlotLoaded({ nodes, slot: "A" });
  } else {
    clearCanvas(nodes.compareCanvasA);
  }
  clearCanvas(nodes.compareCanvasB);
}

export async function openShortTermCompareBFromHost({
  bridge,
  nodes,
  state,
  openFromHostDialog,
  enterGeneralCompare,
  inspectShortTerm,
  mountPlayback,
  refreshRecentFiles
}) {
  if (!bridge?.openSvgaFile) return;
  if (!state.sourceBytes) {
    await enterGeneralCompare();
    return;
  }
  if (state.view !== "compare") await enterGeneralCompare();
  const opened = await bridge.openSvgaFile();
  if (!opened || opened.status === "cancelled") return;
  const bytes = toUint8Array(opened.bytes);
  await mountPlayback("compareB", nodes.compareCanvasB, bytes);
  markShortTermCompareSlotLoaded({ nodes, slot: "B" });
  const model = await inspectShortTerm(bytes, opened.basename || "compare.svga");
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
  if (!state.sourceBytes) {
    await enterGeneralCompare();
    return;
  }
  if (state.view !== "compare") await enterGeneralCompare();
  const bytes = new Uint8Array(await file.arrayBuffer());
  await mountPlayback("compareB", nodes.compareCanvasB, bytes);
  markShortTermCompareSlotLoaded({ nodes, slot: "B" });
  const model = await inspectShortTerm(bytes, file.name || "compare.svga");
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
}
