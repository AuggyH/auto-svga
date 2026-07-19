import {
  renderMessageRowHtml,
  renderOptimizationFindingHtml
} from "./short-term-macos-render-model.mjs";
import { createInlineStatusText } from "./short-term-macos-inline-status-renderers.mjs";

export function createOptimizationFindingRow(item) {
  const row = document.createElement("article");
  row.className = "findingRow";
  row.dataset.component = "OptimizationFindingRow";
  row.dataset.role = "OptimizationCandidateRow";
  row.dataset.disposition = item.disposition;
  row.title = `${item.title}: ${item.summary}`;
  row.innerHTML = renderOptimizationFindingHtml(item);
  return row;
}

export function renderOptimizationFindings(nodes, view) {
  nodes.optimizationSummary.textContent = view.summaryCopy;
  nodes.runOptimizationButton.textContent = view.runButtonCopy;
  nodes.runOptimizationButton.title = view.runButtonTitle;
  nodes.runOptimizationButton.disabled = view.runButtonDisabled;
  if (!view.hasFindings) {
    nodes.findingList.replaceChildren(createInlineStatusText(view.emptyCopy));
    return;
  }
  nodes.findingList.replaceChildren(...view.groupedItems.map(createOptimizationFindingRow));
}

export function renderOptimizationRunningState(nodes, active) {
  const running = Boolean(active);
  const documentRef = nodes.panelOptimization.ownerDocument ?? globalThis.document;
  const shouldMoveFocus = running && documentRef?.activeElement === nodes.runOptimizationButton;
  nodes.panelOptimization.dataset.workflowState = running ? "running" : "idle";
  nodes.panelOptimization.setAttribute("aria-busy", running ? "true" : "false");
  nodes.optimizationProgress.hidden = !running;
  nodes.runOptimizationButton.hidden = running;
  if (running) {
    if (shouldMoveFocus) {
      nodes.panelOptimization.dataset.returnFocus = "run-optimization";
      nodes.optimizationProgress.focus?.({ preventScroll: true });
    } else {
      delete nodes.panelOptimization.dataset.returnFocus;
    }
    nodes.runOptimizationButton.disabled = true;
    nodes.closeOptimizationButton.disabled = true;
    return;
  }
  nodes.closeOptimizationButton.disabled = false;
}

export function restoreOptimizationInteractionFocus(nodes) {
  if (nodes.panelOptimization.dataset.returnFocus !== "run-optimization") return false;
  delete nodes.panelOptimization.dataset.returnFocus;
  const target = !nodes.runOptimizationButton.hidden && !nodes.runOptimizationButton.disabled
    ? nodes.runOptimizationButton
    : !nodes.closeOptimizationButton.hidden && !nodes.closeOptimizationButton.disabled
      ? nodes.closeOptimizationButton
      : nodes.panelOptimization;
  target?.focus?.({ preventScroll: true });
  return true;
}

export function focusOptimizationResult(nodes) {
  const target = nodes.compareInfoB?.querySelector?.(".optimizationResultSummary");
  target?.focus?.({ preventScroll: true });
  return Boolean(target);
}

export function prependOptimizationResult(nodes, title, summary, tone) {
  nodes.findingList.prepend(createMessageRow(title, summary, tone));
}

export function createMessageRow(title, summary, tone = "info") {
  const row = document.createElement("article");
  row.className = "findingRow messageRow";
  row.dataset.status = tone;
  row.dataset.component = "InlineStatus";
  row.innerHTML = renderMessageRowHtml(title, summary, tone);
  return row;
}
