const RISK_STATUSES = new Set(["warning", "fail"]);
const FACT_DISPLAY_LABELS = new Map([
  ["fileSize", "文件大小"],
  ["decodedMemory", "内存占用"],
  ["duration", "动画时长"],
  ["fps", "帧率"],
  ["canvas", "画布尺寸"]
]);

export function overviewFactGroups(model) {
  const requiredIds = new Set([
    "fileSize",
    "decodedMemory",
    "runtimeStructure",
    "runtimeObjectCount",
    "animationFrameRecordCount",
    "runtimeVisibleDensity",
    "runtimeInvisibleRatio",
    "sequenceFanoutRisk",
    "canvas",
    "fps",
    "assetCount"
  ]);
  const facts = (model?.overview?.facts ?? []).filter((fact) => requiredIds.has(fact.id));
  return {
    summary: facts.filter((fact) => fact.disclosure !== "moreInfo" || RISK_STATUSES.has(fact.status)),
    moreInfo: facts.filter((fact) => fact.disclosure === "moreInfo" && !RISK_STATUSES.has(fact.status))
  };
}

export function overviewVisibleFacts(model) {
  return overviewFactGroups(model).summary;
}

export function renderOverviewFactCellHtml(fact) {
  const label = factDisplayLabel(fact);
  const status = overviewStatusCopy(fact.status);
  const requirement = fact.requirement ? ` title="${escapeHtml(fact.requirement)}"` : "";
  return `
    <span>${escapeHtml(label)}</span>
    <strong>${renderMetricValueHtml(fact.value)}</strong>
    ${status ? `<button type="button" class="metricOptimizationEntry" data-component="MetricOptimizationEntry" data-action="open-optimization" aria-label="${escapeHtml(label)}${escapeHtml(status)}"${requirement}><b>${escapeHtml(status)}</b></button>` : ""}
  `;
}

export function renderCompareFactCellHtml(fact) {
  const label = factDisplayLabel(fact);
  return `
    <div class="factCell compareMetricCell" data-component="FactCell" data-status="${escapeHtml(fact.status || "unknown")}">
      <span>${escapeHtml(label)}</span>
      <strong>${renderMetricValueHtml(fact.value)}</strong>
      <small><b>${escapeHtml(statusCopy(fact.status))}</b>${escapeHtml(fact.requirement)}</small>
    </div>
  `;
}

export function factDisplayLabel(fact) {
  return FACT_DISPLAY_LABELS.get(fact?.id) || String(fact?.label ?? "");
}

export function renderMetricValueHtml(value) {
  const copy = String(value ?? "");
  const match = copy.match(/^(\d+(?:\.\d+)?(?:\s*[×x]\s*\d+(?:\.\d+)?)?)\s+(MiB|KiB|B|fps|px|ms|s)$/i);
  if (!match) return escapeHtml(copy);
  return `${escapeHtml(formatDisplayDimensionCopy(match[1]))} <span class="factValueUnit">${escapeHtml(match[2])}</span>`;
}

export function formatDisplayDimensionCopy(value) {
  return String(value ?? "").replace(/\b(\d{1,6}(?:\.\d+)?)\s*[x×]\s*(\d{1,6}(?:\.\d+)?)\b/gu, "$1×$2");
}

export function formatDisplayDetailCopy(value) {
  return formatDisplayDimensionCopy(value);
}

export function renderOptimizationMetricCellHtml(metric) {
  const improved = metric.improved === true && metric.before && metric.after;
  const beforeCopy = renderMetricValueHtml(metric.before || metric.after || "-");
  const afterCopy = metric.after && metric.before !== metric.after
    ? renderMetricValueHtml(metric.after)
    : "";
  return `
    <div class="optimizationMetricCell" data-component="OptimizationResultCard" data-role="OptimizationMetricCell" data-improved="${improved ? "true" : "false"}">
      <span>${escapeHtml(metric.label)}</span>
      <strong class="optimizationMetricValue">
        <b>${beforeCopy}</b>
        ${afterCopy ? `<i aria-hidden="true">→</i><em>${afterCopy}</em>` : ""}
      </strong>
    </div>
  `;
}

export function renderOptimizationFindingHtml(item) {
  const countCopy = item.count > 1 ? ` · ${item.count} 项` : "";
  const impactCopy = item.estimatedFileSizeImpact && item.estimatedFileSizeImpact !== "-"
    ? item.estimatedFileSizeImpact
    : item.estimatedDecodedMemoryImpact;
  const badgeClass = item.disposition === "safeExecutable"
    ? "safe"
    : item.disposition === "reviewOnly" ? "review" : "unsupported";
  return `
    <div><strong>${escapeHtml(item.title)}${escapeHtml(countCopy)}</strong><p>${escapeHtml(item.summary)}</p></div>
    <span class="findingImpact">${escapeHtml(impactCopy || "-")}</span>
    <span class="badge ${badgeClass}">${dispositionCopy(item.disposition)}</span>
  `;
}

export function renderMessageRowHtml(title, summary, tone = "info") {
  const badgeClass = {
    success: "safe",
    warning: "review",
    danger: "fail",
    info: ""
  }[tone] || "";
  const badgeCopy = {
    success: "已生成",
    warning: "未执行",
    danger: "未完成",
    info: "状态"
  }[tone] || "状态";
  return `<div><strong>${escapeHtml(title)}</strong><p>${escapeHtml(summary || "")}</p></div><span class="badge ${badgeClass}">${badgeCopy}</span>`;
}

export function groupOptimizationItems(items = []) {
  const groups = new Map();
  for (const item of items) {
    const key = [
      item.disposition,
      item.title,
      item.summary,
      item.estimatedFileSizeImpact
    ].join("\u0000");
    const existing = groups.get(key);
    if (existing) {
      existing.count += 1;
    } else {
      groups.set(key, { ...item, count: 1 });
    }
  }
  return [...groups.values()];
}

export function isSafeImageDataUrl(value) {
  return typeof value === "string" && /^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(value);
}

export function suffixName(name, suffix) {
  const cleanName = name && name.toLowerCase().endsWith(".svga") ? name.slice(0, -5) : (name || "output");
  return `${cleanName}-${suffix}.svga`;
}

export function statusCopy(status) {
  return {
    pass: "通过",
    warning: "注意",
    fail: "超出",
    unknown: "未知"
  }[status] || "未知";
}

export function overviewStatusCopy(status) {
  return {
    warning: "可优化",
    fail: "可优化",
    unknown: "未知"
  }[status] || "";
}

export function dispositionCopy(disposition) {
  return {
    safeExecutable: "可安全执行",
    reviewOnly: "需复核",
    unsupported: "暂不支持"
  }[disposition] || "建议项";
}

export function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
