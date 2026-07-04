import {
  compareSlotView,
  generalCompareTraceView,
  optimizationCompareTraceView,
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
  if (!state.sourceBytes) return;
  setView("compare");
  renderShortTermGeneralCompareTrace(nodes);
  renderShortTermCompareSlot({ nodes, slot: "A", title: state.displayName || "A 文件", model: state.model });
  renderShortTermCompareSlot({ nodes, slot: "B", title: "B 文件", fallbackMeta: "等待打开" });
  renderShortTermCompareInfo({ nodes, slot: "A", title: "A 文件", model: state.model, displayName: state.displayName });
  renderShortTermGeneralComparePlaceholder(nodes);
  await mountPlayback("compareA", nodes.compareCanvasA, state.previewBytes ?? state.sourceBytes);
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
    await openFromHostDialog();
    return;
  }
  if (state.view !== "compare") await enterGeneralCompare();
  const opened = await bridge.openSvgaFile();
  if (!opened || opened.status === "cancelled") return;
  const bytes = toUint8Array(opened.bytes);
  await mountPlayback("compareB", nodes.compareCanvasB, bytes);
  const model = await inspectShortTerm(bytes, opened.basename || "compare.svga");
  renderShortTermCompareSlot({ nodes, slot: "B", title: opened.basename || "B 文件", model });
  renderShortTermCompareInfo({
    nodes,
    slot: "B",
    title: "B 文件",
    model,
    displayName: opened.basename || "compare.svga",
    actions: [
      `<button class="toolbarButton" type="button" data-action="back-preview">退出对比</button>`
    ]
  });
  await refreshRecentFiles();
}
