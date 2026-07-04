import {
  escapeHtml,
  overviewVisibleFacts,
  renderCompareFactCellHtml,
  renderCompareMetricCellHtml
} from "./short-term-macos-render-model.mjs";

export function renderCompareInfoHtml(title, model, displayName, actions = []) {
  const actionHtml = actions.length ? `<div class="compareActions">${actions.join("")}</div>` : "";
  if (!model) {
    return `<section class="compareSummary" data-status="warning"><h2>${escapeHtml(title)}</h2><p>未打开文件。</p></section>${actionHtml}`;
  }
  const facts = overviewVisibleFacts(model).map(renderCompareFactCellHtml).join("");
  return `<section class="compareSummary"><h2>${escapeHtml(title)}</h2><p>${escapeHtml(displayName)}</p></section><section class="compareMetricGrid" aria-label="${escapeHtml(title)} 信息">${facts}</section>${actionHtml}`;
}

export function compareSlotMeta(model, fallback = "") {
  const facts = overviewVisibleFacts(model);
  const canvas = facts.find((fact) => fact.id === "canvas")?.value;
  const fps = facts.find((fact) => fact.id === "fps")?.value;
  return [canvas, fps ? `${fps} FPS` : ""].filter(Boolean).join(" / ") || fallback;
}

export function compareSlotView(slot, title, model, fallbackMeta = "") {
  return {
    title: title || `${slot} 文件`,
    meta: compareSlotMeta(model, fallbackMeta),
    compareState: model ? "loaded" : "empty"
  };
}

function compareFacts(model) {
  return model ? overviewVisibleFacts(model) : [];
}

function compareFactValue(facts, id) {
  return facts.find((fact) => fact.id === id)?.value || "";
}

function renderComparePairRows(aModel, bModel) {
  const aFacts = compareFacts(aModel);
  const bFacts = compareFacts(bModel);
  const ids = Array.from(new Set([...aFacts, ...bFacts].map((fact) => fact.id)));
  return ids.map((id) => {
    const label = aFacts.find((fact) => fact.id === id)?.label || bFacts.find((fact) => fact.id === id)?.label || id;
    const aValue = compareFactValue(aFacts, id) || "未打开";
    const bValue = compareFactValue(bFacts, id) || "未打开";
    const status = bModel ? (aValue === bValue ? "same" : "different") : "empty";
    return `
      <div class="compareMetricRow" data-status="${escapeHtml(status)}">
        <span>${escapeHtml(label)}</span>
        <strong>${escapeHtml(aValue)}</strong>
        <strong>${escapeHtml(bValue)}</strong>
      </div>
    `;
  }).join("");
}

export function renderGeneralComparePanelHtml({
  aTitle = "A 文件",
  aModel,
  aDisplayName = "",
  bTitle = "B 文件",
  bModel,
  bDisplayName = "",
  actions = []
} = {}) {
  const actionHtml = actions.length ? `<div class="compareActions">${actions.join("")}</div>` : "";
  return `
    <section class="compareSummary">
      <h2>对比模式</h2>
    </section>
    <section class="comparePairHeader" aria-label="对比文件">
      <div>
        <span>${escapeHtml(aTitle)}</span>
        <strong>${escapeHtml(aDisplayName || "未打开文件")}</strong>
      </div>
      <div>
        <span>${escapeHtml(bTitle)}</span>
        <strong>${escapeHtml(bDisplayName || "未打开文件")}</strong>
      </div>
    </section>
    <section class="compareMetricGrid" aria-label="对比信息">
      ${renderComparePairRows(aModel, bModel)}
    </section>
    ${actionHtml}
  `;
}

export function generalCompareTraceView() {
  return {
    moduleName: "GeneralCompareModule",
    pageState: "General comparing"
  };
}

export function optimizationCompareTraceView() {
  return {
    moduleName: "OptimizationCompareModule",
    pageState: "Optimization compare"
  };
}

export function renderOptimizationCompareResultHtml(model) {
  const actionRows = (model.actions ?? []).map((action) => `
    <li>
      <strong>${escapeHtml(action.title)}</strong>
      <span>${escapeHtml(action.summary)}</span>
    </li>
  `).join("");
  const skippedRows = (model.methods ?? [])
    .filter((method) => method.disposition !== "executed")
    .map((method) => `<li><strong>${escapeHtml(method.label)}</strong><span>${escapeHtml(method.reason)}</span></li>`)
    .join("");
  return `
    <section class="compareSummary" data-status="success">
      <h2>${escapeHtml(model.resultTitle)}</h2>
      <p>${escapeHtml(model.resultSummary)}</p>
    </section>
    ${(model.metrics ?? []).length ? `<section class="compareMetricGrid" aria-label="优化指标">${(model.metrics ?? []).map(renderCompareMetricCellHtml).join("")}</section>` : ""}
    ${actionRows ? `<section class="resultGroup" data-status="success"><h3>已执行</h3><ul data-optimization-actions>${actionRows}</ul></section>` : ""}
    ${skippedRows ? `<section class="resultGroup muted" data-status="warning"><h3>未执行</h3><ul data-optimization-skipped>${skippedRows}</ul></section>` : ""}
    <div class="compareActions">
      <button class="toolbarButton primary" type="button" data-action="save-as">另存为</button>
      <button class="toolbarButton" type="button" data-action="back-preview">返回预览</button>
    </div>
  `;
}

export function renderGeneralComparePlaceholderHtml() {
  return renderGeneralComparePanelHtml({
    actions: [
      `<button class="toolbarButton primary" type="button" data-action="open-compare-b">打开 B 文件</button>`,
      `<button class="toolbarButton" type="button" data-action="back-preview">退出对比</button>`
    ]
  });
}
