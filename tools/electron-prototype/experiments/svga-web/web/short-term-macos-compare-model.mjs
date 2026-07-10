import {
  escapeHtml,
  overviewVisibleFacts,
  renderCompareFactCellHtml,
  renderMetricValueHtml,
  renderOptimizationMetricCellHtml
} from "./short-term-macos-render-model.mjs";
import {
  canSaveOptimizationResult,
  optimizationResultTone
} from "./short-term-macos-optimization-model.mjs";

export function renderCompareInfoHtml(title, model, displayName, actions = []) {
  const actionHtml = actions.length ? `<div class="compareActions">${actions.join("")}</div>` : "";
  if (!model) {
    return `<section class="compareSummary" data-status="warning"><h2>${escapeHtml(title)}</h2><p>未打开文件</p></section>${actionHtml}`;
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

function compareFactIds(aFacts, bFacts) {
  return [...aFacts, ...bFacts].reduce((ids, fact) => {
    if (fact?.id && !ids.includes(fact.id)) ids.push(fact.id);
    return ids;
  }, []);
}

function compareAlignedFacts(rowIds, facts, peerFacts) {
  return rowIds.map((id) => {
    const fact = facts.find((item) => item.id === id);
    const peer = peerFacts.find((item) => item.id === id);
    return {
      id,
      fact,
      peer,
      label: fact?.label || peer?.label || id
    };
  });
}

function compareFactDiff(fact, peer) {
  if (!fact || !peer) return "unavailable";
  return compareFactValue([peer], fact.id) !== fact.value ? "different" : "same";
}

function renderCompareColumnFactHtml({ id, fact, peer, label }) {
  const diff = compareFactDiff(fact, peer);
  if (!fact) {
    return `
      <div class="compareMetricCell" data-component="FactCell" data-fact-id="${escapeHtml(id)}" data-status="unavailable" data-diff="unavailable">
        <span>${escapeHtml(label)}</span>
        <strong>${renderMetricValueHtml("不可用")}</strong>
      </div>
    `;
  }
  return `
    <div class="compareMetricCell" data-component="FactCell" data-fact-id="${escapeHtml(id)}" data-status="${escapeHtml(fact.status || "unknown")}" data-diff="${escapeHtml(diff)}">
      <span>${escapeHtml(fact.label)}</span>
      <strong>${renderMetricValueHtml(fact.value)}</strong>
    </div>
  `;
}

function renderCompareMetricColumnHtml(slot, rowIds, facts, peerFacts) {
  return `
    <div class="compareMetricColumn" data-slot="${escapeHtml(slot)}">
      ${compareAlignedFacts(rowIds, facts, peerFacts).map(renderCompareColumnFactHtml).join("")}
    </div>
  `;
}

function renderCompareMetricColumns(aModel, bModel) {
  if (!aModel || !bModel) return "";
  const aFacts = compareFacts(aModel);
  const bFacts = compareFacts(bModel);
  const rowIds = compareFactIds(aFacts, bFacts);
  return `${renderCompareMetricColumnHtml("A", rowIds, aFacts, bFacts)}${renderCompareMetricColumnHtml("B", rowIds, bFacts, aFacts)}`;
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
  const rows = renderCompareMetricColumns(aModel, bModel);
  return `
    <section class="compareSummary compareModeHeader">
      <h2>对比模式</h2>
      ${actionHtml}
    </section>
    <section class="comparePairHeader" aria-label="对比文件">
      <div>
        <strong>${escapeHtml(aDisplayName || "未打开文件")}</strong>
      </div>
      <div>
        <strong>${escapeHtml(bDisplayName || "未打开文件")}</strong>
      </div>
    </section>
    ${rows ? `<section class="compareMetricGrid" aria-label="对比信息">${rows}</section>` : ""}
  `;
}

export function generalCompareTraceView() {
  return {
    moduleName: "GeneralCompareModule",
    pageState: "General comparing",
    stateMode: "general"
  };
}

export function optimizationCompareTraceView() {
  return {
    moduleName: "OptimizationCompareModule",
    pageState: "General comparing",
    stateMode: "optimization"
  };
}

export function renderOptimizationCompareResultHtml(model) {
  const tone = optimizationResultTone(model);
  const saveDisabled = canSaveOptimizationResult(model) ? "" : " disabled";
  const actionRows = (model.actions ?? []).map((action) => `
    <li data-component="OptimizationResultDetailRow" data-result-disposition="executed">
      <strong>${escapeHtml(action.title)}</strong>
      <span>${escapeHtml(action.summary)}</span>
    </li>
  `).join("");
  const skippedRows = (model.methods ?? [])
    .filter((method) => method.disposition !== "executed")
    .map((method) => `<li data-component="OptimizationResultDetailRow" data-result-disposition="skipped"><strong>${escapeHtml(method.label)}</strong><span>${escapeHtml(method.reason)}</span></li>`)
    .join("");
  return `
    <section class="compareSummary optimizationResultSummary" data-status="${escapeHtml(tone)}">
      <h2>优化结果</h2>
    </section>
    ${(model.metrics ?? []).length ? `<section class="compareMetricGrid optimizationMetricGrid" aria-label="优化指标">${(model.metrics ?? []).map(renderOptimizationMetricCellHtml).join("")}</section>` : ""}
    <div class="compareActions optimizationActions">
      <button class="toolbarButton primary" type="button" data-action="save-as"${saveDisabled}>另存为 SVGA</button>
      <button class="toolbarButton" type="button" data-action="save-overwrite"${saveDisabled}>覆盖保存</button>
      <button class="toolbarButton" type="button" data-action="back-preview">放弃优化</button>
    </div>
    ${actionRows ? `<section class="resultGroup" data-status="success"><h3>已执行</h3><ul data-optimization-actions>${actionRows}</ul></section>` : ""}
    ${skippedRows ? `<section class="resultGroup muted" data-status="warning"><h3>未执行</h3><ul data-optimization-skipped>${skippedRows}</ul></section>` : ""}
  `;
}

export function renderGeneralComparePlaceholderHtml() {
  return renderGeneralComparePanelHtml({
    actions: [
      `<button class="toolbarButton primary" type="button" data-action="back-preview">退出对比</button>`
    ]
  });
}
