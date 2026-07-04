import {
  compareSlotView,
  generalCompareTraceView,
  optimizationCompareTraceView,
  renderCompareInfoHtml,
  renderGeneralComparePlaceholderHtml,
  renderOptimizationCompareResultHtml
} from "./short-term-macos-compare-model.mjs";
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
