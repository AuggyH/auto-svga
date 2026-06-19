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
    resource_transparent_padding_exceeds_limit: "内嵌图片资源存在过多透明空白。",
    resource_fully_transparent: "内嵌图片资源完全透明。",
    resource_alpha_bounds_unavailable: "部分内嵌图片暂时无法分析透明边界。",
    duration_unavailable: "无法读取播放时长。",
    fps_unavailable: "无法读取帧率。"
  };
  return messages[issue?.code] ?? "未通过当前生产规范检查。";
}

const auditFallbackLabels = Object.freeze({
  "audit.status.pass": "通过",
  "audit.status.advisory": "建议检查",
  "audit.status.needs_review": "需要检查",
  "audit.status.unknown": "信息不足",
  "audit.severity.success": "正常",
  "audit.severity.info": "提示",
  "audit.severity.warning": "注意",
  "audit.severity.error": "风险",
  "audit.severity.unknown": "未知",
  "audit.category.specification": "生产规范",
  "audit.category.memory": "内存",
  "audit.category.transparency": "透明区域",
  "audit.category.sequence": "序列帧",
  "audit.category.general": "综合检查",
  "audit.action.review_only": "仅供检查",
  "audit.uncertainty.medium": "部分诊断证据仍存在不确定性。",
  "audit.uncertainty.high": "重要诊断证据仍存在不确定性。",
  "audit.uncertainty.insufficient_evidence": "当前证据不足，无法形成确定结论。",
  "audit.summary.pass.title": "未发现主要风险",
  "audit.summary.pass.description": "当前确定性检查未发现主要优化信号。",
  "audit.summary.advisory.title": "存在建议检查项",
  "audit.summary.advisory.description": "诊断发现了值得进一步检查的非阻塞信号。",
  "audit.summary.needs_review.title": "资产需要检查",
  "audit.summary.needs_review.description": "诊断发现了一个或多个较明显的风险信号。",
  "audit.summary.unknown.title": "诊断信息不完整",
  "audit.summary.unknown.description": "当前证据不足，暂时无法形成可靠摘要。",
  "audit.finding.unsupported_motion_format.title": "格式暂不支持",
  "audit.finding.unsupported_motion_format.description": "当前规范不支持检查此动效格式。",
  "audit.finding.file_size_exceeds_limit.title": "文件体积超出限制",
  "audit.finding.file_size_exceeds_limit.description": "文件体积超过当前规范。",
  "audit.finding.dimensions_exceed_limit.title": "画布尺寸超出限制",
  "audit.finding.dimensions_exceed_limit.description": "画布尺寸超过当前规范。",
  "audit.finding.dimensions_unavailable.title": "画布尺寸不可用",
  "audit.finding.dimensions_unavailable.description": "无法检查画布尺寸。",
  "audit.finding.duration_exceeds_limit.title": "播放时长超出限制",
  "audit.finding.duration_exceeds_limit.description": "播放时长超过当前规范。",
  "audit.finding.duration_unavailable.title": "播放时长不可用",
  "audit.finding.duration_unavailable.description": "无法检查播放时长。",
  "audit.finding.fps_exceeds_limit.title": "帧率超出限制",
  "audit.finding.fps_exceeds_limit.description": "帧率超过当前规范。",
  "audit.finding.fps_unavailable.title": "帧率不可用",
  "audit.finding.fps_unavailable.description": "无法检查帧率。",
  "audit.finding.resource_count_exceeds_limit.title": "资源数量超出限制",
  "audit.finding.resource_count_exceeds_limit.description": "资源数量超过当前规范。",
  "audit.finding.resource_dimensions_exceed_limit.title": "资源尺寸超出限制",
  "audit.finding.resource_dimensions_exceed_limit.description": "存在超过尺寸限制的内嵌资源。",
  "audit.finding.resource_dimensions_unavailable.title": "资源尺寸不可用",
  "audit.finding.resource_dimensions_unavailable.description": "无法检查一个或多个资源尺寸。",
  "audit.finding.resource_fully_transparent.title": "资源完全透明",
  "audit.finding.resource_fully_transparent.description": "存在完全透明的内嵌资源。",
  "audit.finding.resource_transparent_padding_exceeds_limit.title": "透明空白偏多",
  "audit.finding.resource_transparent_padding_exceeds_limit.description": "存在超过透明空白限制的内嵌资源。",
  "audit.finding.resource_alpha_bounds_unavailable.title": "透明边界不可用",
  "audit.finding.resource_alpha_bounds_unavailable.description": "无法检查一个或多个资源的透明边界。",
  "audit.finding.decoded_memory_risk.title": "解码内存存在风险",
  "audit.finding.decoded_memory_risk.description": "资源解码内存估算存在建议检查的风险。",
  "audit.finding.decoded_memory_unknown.title": "解码内存信息不完整",
  "audit.finding.decoded_memory_unknown.description": "无法完整估算资源解码内存。",
  "audit.finding.sequence_memory_concentration.title": "序列帧内存较集中",
  "audit.finding.sequence_memory_concentration.description": "序列帧资源占用了较明显的估算解码内存。",
  "audit.finding.sequence_memory_unknown.title": "序列帧内存信息不完整",
  "audit.finding.sequence_memory_unknown.description": "无法完整估算序列帧资源内存。",
  "audit.finding.duplicate_encoded_frames.title": "存在重复编码帧",
  "audit.finding.duplicate_encoded_frames.description": "发现字节内容完全相同的序列帧。",
  "audit.finding.fully_transparent_sequence_frames.title": "存在全透明帧",
  "audit.finding.fully_transparent_sequence_frames.description": "发现完全透明的序列帧。",
  "audit.finding.near_empty_sequence_frames.title": "存在近空帧",
  "audit.finding.near_empty_sequence_frames.description": "发现按临时规则判定的近空序列帧。",
  "audit.opportunity.review_large_resources.title": "检查大尺寸资源",
  "audit.opportunity.review_large_resources.description": "检查解码内存占用最大的资源。",
  "audit.opportunity.crop_static_transparent_padding.title": "评估静态资源裁切",
  "audit.opportunity.crop_static_transparent_padding.description": "在保留偏移的前提下评估裁切静态资源透明空白。",
  "audit.opportunity.evaluate_group_level_sequence_crop.title": "评估序列帧分组裁切",
  "audit.opportunity.evaluate_group_level_sequence_crop.description": "在保留偏移的前提下评估序列帧分组裁切。",
  "audit.opportunity.review_duplicate_encoded_frames.title": "检查重复帧",
  "audit.opportunity.review_duplicate_encoded_frames.description": "检查字节内容完全相同的序列帧。",
  "audit.opportunity.review_fully_transparent_frames.title": "检查全透明帧",
  "audit.opportunity.review_fully_transparent_frames.description": "检查完全透明的序列帧。",
  "audit.opportunity.evaluate_sprite_sheet_packing.title": "评估雪碧图打包",
  "audit.opportunity.evaluate_sprite_sheet_packing.description": "评估对确定的序列帧组使用雪碧图打包。",
  "audit.opportunity.review_fps.title": "检查帧率",
  "audit.opportunity.review_fps.description": "当前规范报告帧率超限，建议检查帧率。",
  "audit.opportunity.review_duration.title": "检查时长",
  "audit.opportunity.review_duration.description": "当前规范报告时长超限，建议检查播放时长。"
});

function auditLabel(key, fallback) {
  return auditFallbackLabels[key] ?? fallback ?? key ?? "n/a";
}

function auditSeverityClass(value) {
  return ["success", "info", "warning", "error", "unknown"].includes(value)
    ? value
    : "unknown";
}

function renderAuditEvidence(evidenceRefs) {
  const refs = Array.isArray(evidenceRefs) ? evidenceRefs : [];
  return refs.length > 0
    ? `<small class="auditEvidence">证据 ${refs.length} 项 / Evidence ×${refs.length}</small>`
    : "";
}

function renderMotionAssetAudit(presentation) {
  if (!presentation || typeof presentation !== "object") return "";

  const findings = Array.isArray(presentation.findingCards) ? presentation.findingCards : [];
  const opportunities = Array.isArray(presentation.opportunityCards) ? presentation.opportunityCards : [];
  const uncertaintyNotes = Array.isArray(presentation.uncertaintyNotes)
    ? presentation.uncertaintyNotes
    : [];
  const severity = auditSeverityClass(presentation.severityLevel);

  return `
    <section class="auditReportSection severity-${severity}" aria-labelledby="motion-audit-title">
      <div class="specReportHeader auditReportHeader">
        <div>
          <strong id="motion-audit-title">动效资产诊断</strong>
          <small>Motion Asset Audit</small>
        </div>
        <span class="specReportBadge auditStatusBadge severity-${severity}">${escapeHtml(auditLabel(
          presentation.statusLabel,
          presentation.statusLabel
        ))}</span>
      </div>
      <div class="auditSummary">
        <h3>${escapeHtml(auditLabel(presentation.summaryTitle, presentation.summaryTitle))}</h3>
        <p>${escapeHtml(auditLabel(presentation.summaryDescription, presentation.summaryDescription))}</p>
      </div>
      ${findings.length > 0 ? `
        <div class="specReportGroup auditCardGroup">
          <h3>主要发现 <small>Findings</small></h3>
          <ul class="auditCardList">
            ${findings.map((card) => `
              <li class="auditCard severity-${auditSeverityClass(card.severity)}">
                <div class="auditCardMeta">
                  <span>${escapeHtml(auditLabel(card.categoryLabel, card.categoryLabel ?? card.category))}</span>
                  <span>${escapeHtml(auditLabel(card.severityLabel, card.severityLabel ?? card.severity))}</span>
                </div>
                <strong>${escapeHtml(auditLabel(card.title, card.title ?? card.code))}</strong>
                <p>${escapeHtml(auditLabel(card.descriptionKey, card.description))}</p>
                ${renderAuditEvidence(card.evidenceRefs)}
              </li>
            `).join("")}
          </ul>
        </div>
      ` : ""}
      ${opportunities.length > 0 ? `
        <div class="specReportGroup auditCardGroup">
          <h3>建议评估 <small>Opportunities</small></h3>
          <ul class="auditCardList">
            ${opportunities.map((card) => `
              <li class="auditCard isOpportunity">
                <div class="auditCardMeta">
                  <span>${escapeHtml(auditLabel(card.categoryLabel, card.categoryLabel ?? card.category))}</span>
                  <span>${escapeHtml(auditLabel(card.actionTypeLabel, card.actionType))}</span>
                </div>
                <strong>${escapeHtml(auditLabel(card.title, card.title ?? card.code))}</strong>
                <p>${escapeHtml(auditLabel(card.descriptionKey, card.description))}</p>
                ${renderAuditEvidence(card.evidenceRefs)}
              </li>
            `).join("")}
          </ul>
        </div>
      ` : ""}
      ${uncertaintyNotes.length > 0 ? `
        <div class="auditUncertainty">
          <strong>不确定性 <small>Uncertainty</small></strong>
          <ul>${uncertaintyNotes.map((note) => `<li>${escapeHtml(auditLabel(note, note))}</li>`).join("")}</ul>
        </div>
      ` : ""}
    </section>
  `;
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
      <div class="specReportId">
        <span>检查档案</span>
        <code>${escapeHtml(report.profileLabel ?? "n/a")}</code>
        <small>${escapeHtml(report.profileId ?? "n/a")}</small>
      </div>
      <p class="specReportHint">${escapeHtml(report.profilePurpose ?? "")}</p>
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
      ${renderMotionAssetAudit(report.auditPresentation)}
    </section>
  `;
}
