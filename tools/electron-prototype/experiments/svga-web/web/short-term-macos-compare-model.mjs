import {
  escapeHtml,
  factDisplayLabel,
  overviewVisibleFacts,
  renderCompareFactCellHtml,
  renderMetricValueHtml,
  renderOptimizationMetricCellHtml
} from "./short-term-macos-render-model.mjs";
import {
  canSaveOptimizationResult,
  optimizationResultTone
} from "./short-term-macos-optimization-model.mjs";

export function hasShortTermComparePrimarySource(state) {
  return Boolean(state?.sourceBytes?.byteLength);
}

export function canEnterShortTermGeneralCompare(state) {
  return state?.view === "preview" && hasShortTermComparePrimarySource(state);
}

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

const compareStatusScore = Object.freeze({
  unknown: 0,
  fail: 1,
  warning: 2,
  pass: 3
});

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
      label: factDisplayLabel(fact || peer || { id, label: id })
    };
  });
}

function compareFactDiff(fact, peer, comparisonReady = true) {
  if (!comparisonReady) return "uncompared";
  if (!fact || !peer) return "unavailable";
  const sameValue = compareFactValue([peer], fact.id) === fact.value;
  const sameStatus = (fact.status || "unknown") === (peer.status || "unknown");
  if (sameValue && sameStatus) return "same";
  const factScore = compareStatusScore[fact.status || "unknown"] ?? compareStatusScore.unknown;
  const peerScore = compareStatusScore[peer.status || "unknown"] ?? compareStatusScore.unknown;
  return factScore > peerScore ? "improved" : "different";
}

function renderCompareColumnFactHtml({ id, fact, peer, label, comparisonReady }) {
  const diff = compareFactDiff(fact, peer, comparisonReady);
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
      <span>${escapeHtml(factDisplayLabel(fact))}</span>
      <strong>${renderMetricValueHtml(fact.value)}</strong>
    </div>
  `;
}

function renderCompareMetricColumnHtml(slot, rowIds, facts, peerFacts, comparisonReady) {
  return `
    <div class="compareMetricColumn" data-component="CompareMetricColumn" data-slot="${escapeHtml(slot)}" data-state="loaded">
      ${compareAlignedFacts(rowIds, facts, peerFacts).map((row) => renderCompareColumnFactHtml({ ...row, comparisonReady })).join("")}
    </div>
  `;
}

function renderEmptyCompareMetricColumnHtml(slot) {
  return `<div class="compareMetricColumn" data-component="CompareMetricColumn" data-slot="${escapeHtml(slot)}" data-state="empty" aria-hidden="true"></div>`;
}

function renderCompareMetricColumns(aModel, bModel) {
  if (!aModel && !bModel) return "";
  const aFacts = compareFacts(aModel);
  const bFacts = compareFacts(bModel);
  const rowIds = compareFactIds(aFacts, bFacts);
  const comparisonReady = Boolean(aModel && bModel);
  const aColumn = aModel
    ? renderCompareMetricColumnHtml("A", rowIds, aFacts, bFacts, comparisonReady)
    : renderEmptyCompareMetricColumnHtml("A");
  const bColumn = bModel
    ? renderCompareMetricColumnHtml("B", rowIds, bFacts, aFacts, comparisonReady)
    : renderEmptyCompareMetricColumnHtml("B");
  return `${aColumn}${bColumn}`;
}

function renderComparePairSlotHtml(slot, model, displayName) {
  const state = model ? "loaded" : "empty";
  const openAction = slot === "A" ? "open-compare-a" : "open-compare-b";
  const actionCopy = model ? "替换" : "打开";
  const openButton = `
    <button class="toolbarButton${model ? "" : " primary"} comparePairOpenButton" data-component="ToolbarButton" type="button" data-action="${openAction}" aria-label="${actionCopy}对比文件 ${slot}">${actionCopy}文件</button>
  `;
  return `
    <div data-slot="${slot}" data-state="${state}">
      <strong>${escapeHtml(displayName || "文件未打开")}</strong>
      ${openButton}
    </div>
  `;
}

function comparePanelState(aModel, bModel) {
  if (aModel && bModel) return "loaded";
  if (aModel) return "waiting-b";
  if (bModel) return "waiting-a";
  return "empty";
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
  const state = comparePanelState(aModel, bModel);
  return `
    <section class="compareSummary compareModeHeader" data-compare-state="${state}">
      <h2>对比模式</h2>
      ${actionHtml}
    </section>
    <section class="comparePairHeader" aria-label="对比文件" data-compare-state="${state}">
      ${renderComparePairSlotHtml("A", aModel, aDisplayName)}
      ${renderComparePairSlotHtml("B", bModel, bDisplayName)}
    </section>
    ${rows ? `<section class="compareMetricGrid" aria-label="对比信息" data-compare-state="${state}">${rows}</section>` : ""}
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
    <section class="compareSummary optimizationResultSummary" data-status="${escapeHtml(tone)}" tabindex="-1" aria-labelledby="optimizationResultHeading">
      <h2 id="optimizationResultHeading">优化结果</h2>
    </section>
    ${(model.metrics ?? []).length ? `<section class="compareMetricGrid optimizationMetricGrid" aria-label="优化指标">${(model.metrics ?? []).map(renderOptimizationMetricCellHtml).join("")}</section>` : ""}
    <div class="compareActions optimizationActions">
      <button class="toolbarButton primary" type="button" data-action="save-as"${saveDisabled}>另存为 SVGA</button>
      <button class="toolbarButton" type="button" data-action="save-overwrite"${saveDisabled}>覆盖保存</button>
      <button class="toolbarButton" type="button" data-action="discard-optimization">放弃优化</button>
    </div>
    ${actionRows ? `<section class="resultGroup" data-status="success"><h3>已执行</h3><ul data-optimization-actions>${actionRows}</ul></section>` : ""}
    ${skippedRows ? `<section class="resultGroup muted" data-status="warning"><h3>未执行</h3><ul data-optimization-skipped>${skippedRows}</ul></section>` : ""}
  `;
}

export function renderGeneralComparePlaceholderHtml() {
  return renderGeneralComparePanelHtml({
    actions: [
      `<button class="toolbarButton compareExitButton" type="button" data-action="back-preview">退出对比</button>`
    ]
  });
}
