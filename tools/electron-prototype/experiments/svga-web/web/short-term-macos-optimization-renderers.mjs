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
