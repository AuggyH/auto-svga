function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatBytes(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return "n/a";
  if (number < 1024) return `${number} B`;
  if (number < 1024 * 1024) return `${(number / 1024).toFixed(1)} KB`;
  return `${(number / 1024 / 1024).toFixed(2)} MB`;
}

function formatDimensions(dimensions) {
  if (!dimensions) return "n/a";
  return `${dimensions.width} × ${dimensions.height}`;
}

function formatDuration(durationMs) {
  return Number.isFinite(Number(durationMs))
    ? `${(Number(durationMs) / 1000).toFixed(2)}s`
    : "n/a";
}

function severityLabel(severity) {
  return severity === "error" ? "错误" : severity === "warning" ? "警告" : "提示";
}

function issueMessage(issue) {
  const messages = {
    unsupported_motion_format: "当前规范检查不支持此动效格式。",
    file_size_exceeds_limit: "文件体积超过生产规范上限。",
    dimensions_exceed_limit: "画布尺寸超过 300 × 300 生产上限。",
    duration_exceeds_limit: "播放时长超过生产规范上限。",
    fps_exceeds_limit: "帧率超过生产规范上限。",
    resource_count_exceeds_limit: "图片资源数量超过生产规范上限。",
    resource_dimensions_exceed_limit: "内嵌图片资源尺寸超过 300 × 300 上限。",
    resource_dimensions_unavailable: "无法识别内嵌图片资源尺寸。",
    duration_unavailable: "无法读取播放时长。",
    fps_unavailable: "无法读取帧率。"
  };
  return messages[issue?.code] ?? "未通过当前生产规范检查。";
}

export function renderAvatarFrameInspectionReport(report, status = "idle") {
  if (status === "loading") {
    return `
      <section class="specReportSection isLoading" aria-live="polite">
        <div class="specReportHeader">
          <div><strong>生产规范</strong><small>Spec Check</small></div>
          <span class="specReportBadge isPending">检查中</span>
        </div>
      </section>
    `;
  }

  if (status === "error") {
    return `
      <section class="specReportSection isError" aria-live="polite">
        <div class="specReportHeader">
          <div><strong>生产规范</strong><small>Spec Check</small></div>
          <span class="specReportBadge isError">暂不可用</span>
        </div>
        <p class="specReportHint">规范检查暂不可用，不影响当前播放。</p>
      </section>
    `;
  }

  if (!report) return "";

  const asset = report.asset ?? {};
  const timing = asset.timing ?? {};
  const issues = Array.isArray(report.issues) ? report.issues : [];
  const calibrationNotes = Array.isArray(report.calibrationNotes) ? report.calibrationNotes : [];
  const summary = [
    ["画布", formatDimensions(asset.dimensions)],
    ["帧率", Number.isFinite(Number(timing.fps)) ? `${timing.fps} fps` : "n/a"],
    ["时长", formatDuration(timing.durationMs)],
    ["文件", formatBytes(asset.sizeBytes)],
    ["图层", Number.isFinite(Number(asset.layerCount)) ? `${asset.layerCount}` : "n/a"],
    ["资源", Number.isFinite(Number(asset.resourceCount)) ? `${asset.resourceCount}` : "n/a"]
  ];

  return `
    <section class="specReportSection ${report.passed ? "isPassed" : "isFailed"}" aria-live="polite">
      <div class="specReportHeader">
        <div><strong>生产规范</strong><small>Spec Check</small></div>
        <span class="specReportBadge ${report.passed ? "isPassed" : "isFailed"}">${report.passed ? "通过" : "未通过"}</span>
      </div>
      <div class="specReportId"><span>规范</span><code>${escapeHtml(report.specId ?? "n/a")}</code></div>
      <dl class="specAssetSummary">
        ${summary.map(([label, value]) => `
          <div><dt>${escapeHtml(label)}</dt><dd>${escapeHtml(value)}</dd></div>
        `).join("")}
      </dl>
      ${issues.length > 0 ? `
        <div class="specReportGroup">
          <h3>检查问题 <small>Issues</small></h3>
          <ul class="specIssueList">
            ${issues.map((issue) => `
              <li class="severity-${escapeHtml(issue.severity)}">
                <div><span>${severityLabel(issue.severity)}</span><code>${escapeHtml(issue.code)}</code></div>
                <p>${escapeHtml(issueMessage(issue))}<small>${escapeHtml(issue.message)}</small></p>
              </li>
            `).join("")}
          </ul>
        </div>
      ` : `<p class="specReportHint">未发现超出当前规范的项目。</p>`}
      ${calibrationNotes.length > 0 ? `
        <div class="specReportGroup calibrationGroup">
          <h3>待产品校准 <small>Calibration</small></h3>
          <ul class="calibrationList">
            ${calibrationNotes.map((note) => `
              <li>
                <code>${escapeHtml(note.field)}</code>
                <span>当前为有限样本建议值，待产品确认。</span>
                <small>${escapeHtml(note.message)}</small>
              </li>
            `).join("")}
          </ul>
        </div>
      ` : ""}
    </section>
  `;
}
