import { motionAssetAuditEnglishFallbacks } from "./motion-asset-audit-localization-keys.js";

export const MOTION_ASSET_AUDIT_DEFAULT_LOCALE = "en" as const;
export const MOTION_ASSET_AUDIT_SUPPORTED_LOCALES = ["en", "zh-CN"] as const;

export type MotionAssetAuditLocale =
  (typeof MOTION_ASSET_AUDIT_SUPPORTED_LOCALES)[number];

export interface MotionAssetAuditLocalizationBundle {
  locale: MotionAssetAuditLocale;
  fallbackLocale: typeof MOTION_ASSET_AUDIT_DEFAULT_LOCALE;
  labels: Readonly<Record<string, string>>;
}

export interface ResolveAuditPresentationLabelOptions {
  locale?: string;
  fallbackMessage?: string;
}

const chineseLabels: Readonly<Record<string, string>> = Object.freeze({
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
  "audit.uncertainty.low": "不确定性较低。",
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

const bundles: Readonly<Record<MotionAssetAuditLocale, MotionAssetAuditLocalizationBundle>> =
  Object.freeze({
    en: Object.freeze({
      locale: "en",
      fallbackLocale: MOTION_ASSET_AUDIT_DEFAULT_LOCALE,
      labels: motionAssetAuditEnglishFallbacks
    }),
    "zh-CN": Object.freeze({
      locale: "zh-CN",
      fallbackLocale: MOTION_ASSET_AUDIT_DEFAULT_LOCALE,
      labels: chineseLabels
    })
  });

export function getMotionAssetAuditLocalizationBundle(
  locale: string = MOTION_ASSET_AUDIT_DEFAULT_LOCALE
): MotionAssetAuditLocalizationBundle {
  return bundles[isSupportedLocale(locale) ? locale : MOTION_ASSET_AUDIT_DEFAULT_LOCALE];
}

export function resolveAuditPresentationLabel(
  key: string,
  options: ResolveAuditPresentationLabelOptions = {}
): string {
  const bundle = getMotionAssetAuditLocalizationBundle(options.locale);
  return bundle.labels[key]
    ?? motionAssetAuditEnglishFallbacks[key]
    ?? options.fallbackMessage
    ?? key;
}

function isSupportedLocale(locale: string): locale is MotionAssetAuditLocale {
  return MOTION_ASSET_AUDIT_SUPPORTED_LOCALES.some((supported) => supported === locale);
}
