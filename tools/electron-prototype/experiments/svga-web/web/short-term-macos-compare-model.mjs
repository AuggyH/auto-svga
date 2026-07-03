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
  return `
    <section class="compareSummary" data-status="info">
      <h2>B 文件</h2>
      <p>打开另一个 SVGA 后开始对比。</p>
    </section>
    <div class="compareActions">
      <button class="toolbarButton primary" type="button" data-action="open-compare-b">打开 B 文件</button>
      <button class="toolbarButton" type="button" data-action="back-preview">退出对比</button>
    </div>
  `;
}
