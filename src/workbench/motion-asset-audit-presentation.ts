import type {
  MotionAssetAuditFinding,
  MotionAssetAuditStatus,
  MotionAssetAuditSummary,
  MotionAssetOptimizationOpportunity
} from "./motion-asset-audit-summary.js";
import {
  motionAssetAuditLocalizationKeyFor,
  motionAssetAuditLocalizationKeys,
  type MotionAssetAuditCardCategory,
  type MotionAssetAuditPresentationSeverity
} from "./motion-asset-audit-localization-keys.js";

export type {
  MotionAssetAuditCardCategory,
  MotionAssetAuditPresentationSeverity
} from "./motion-asset-audit-localization-keys.js";

export interface MotionAssetAuditFindingCard {
  code: string;
  title: string;
  descriptionKey: string;
  description: string;
  severity: MotionAssetAuditFinding["severity"];
  severityLabel: string;
  category: MotionAssetAuditCardCategory;
  categoryLabel: string;
  evidenceRefs: readonly string[];
}

export interface MotionAssetAuditOpportunityCard {
  code: string;
  title: string;
  descriptionKey: string;
  description: string;
  category: MotionAssetAuditCardCategory;
  categoryLabel: string;
  evidenceRefs: readonly string[];
  actionType: "review_only";
  actionTypeLabel: string;
}

export interface MotionAssetAuditPresentation {
  statusLabel: string;
  severityLevel: MotionAssetAuditPresentationSeverity;
  severityLabel: string;
  summaryTitle: string;
  summaryDescription: string;
  findingCards: readonly MotionAssetAuditFindingCard[];
  opportunityCards: readonly MotionAssetAuditOpportunityCard[];
  uncertaintyNotes: readonly string[];
  evidenceRefs: readonly string[];
}

export function createMotionAssetAuditPresentation(
  summary: MotionAssetAuditSummary
): MotionAssetAuditPresentation {
  return {
    statusLabel: motionAssetAuditLocalizationKeys.status[summary.auditStatus],
    severityLevel: severityForStatus(summary.auditStatus),
    severityLabel: motionAssetAuditLocalizationKeys.severity[severityForStatus(summary.auditStatus)],
    summaryTitle: motionAssetAuditLocalizationKeyFor.summaryTitle(summary.auditStatus),
    summaryDescription: motionAssetAuditLocalizationKeyFor.summaryDescription(summary.auditStatus),
    findingCards: summary.primaryFindings.map(findingCard),
    opportunityCards: summary.optimizationOpportunities.map(opportunityCard),
    uncertaintyNotes: uncertaintyNotes(summary.uncertainty),
    evidenceRefs: [...summary.evidenceRefs]
  };
}

function findingCard(finding: MotionAssetAuditFinding): MotionAssetAuditFindingCard {
  return {
    code: finding.code,
    title: motionAssetAuditLocalizationKeyFor.findingTitle(finding.code),
    descriptionKey: motionAssetAuditLocalizationKeyFor.findingDescription(finding.code),
    description: finding.message,
    severity: finding.severity,
    severityLabel: motionAssetAuditLocalizationKeys.severity[finding.severity],
    category: categoryForCode(finding.code),
    categoryLabel: motionAssetAuditLocalizationKeys.category[categoryForCode(finding.code)],
    evidenceRefs: [...finding.evidenceRefs]
  };
}

function opportunityCard(
  opportunity: MotionAssetOptimizationOpportunity
): MotionAssetAuditOpportunityCard {
  return {
    code: opportunity.code,
    title: motionAssetAuditLocalizationKeyFor.opportunityTitle(opportunity.code),
    descriptionKey: motionAssetAuditLocalizationKeyFor.opportunityDescription(opportunity.code),
    description: opportunity.message,
    category: categoryForCode(opportunity.code),
    categoryLabel: motionAssetAuditLocalizationKeys.category[categoryForCode(opportunity.code)],
    evidenceRefs: [...opportunity.evidenceRefs],
    actionType: "review_only",
    actionTypeLabel: motionAssetAuditLocalizationKeys.actionType.review_only
  };
}

function severityForStatus(
  status: MotionAssetAuditStatus
): MotionAssetAuditPresentationSeverity {
  if (status === "pass") return "success";
  if (status === "advisory") return "warning";
  if (status === "needs_review") return "error";
  return "unknown";
}

function uncertaintyNotes(
  uncertainty: MotionAssetAuditSummary["uncertainty"]
): string[] {
  return uncertainty === "low"
    ? []
    : [motionAssetAuditLocalizationKeys.uncertainty[uncertainty]];
}

function categoryForCode(code: string): MotionAssetAuditCardCategory {
  if (includesAny(code, ["memory", "large_resource"])) return "memory";
  if (includesAny(code, ["transparent", "padding", "empty"])) return "transparency";
  if (includesAny(code, ["sequence", "duplicate", "sprite_sheet"])) return "sequence";
  if (includesAny(code, [
    "file_size",
    "resource_count",
    "dimensions",
    "fps",
    "duration"
  ])) return "specification";
  return "general";
}

function includesAny(value: string, fragments: readonly string[]): boolean {
  return fragments.some((fragment) => value.includes(fragment));
}
