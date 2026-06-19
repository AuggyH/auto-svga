import type {
  MotionAssetAuditFinding,
  MotionAssetAuditStatus,
  MotionAssetAuditSummary,
  MotionAssetAuditUncertainty,
  MotionAssetOptimizationOpportunity
} from "./motion-asset-audit-summary.js";

export type MotionAssetAuditPresentationSeverity =
  | "success"
  | "warning"
  | "error"
  | "unknown";

export type MotionAssetAuditCardCategory =
  | "specification"
  | "memory"
  | "transparency"
  | "sequence"
  | "general";

export interface MotionAssetAuditFindingCard {
  code: string;
  title: string;
  description: string;
  severity: MotionAssetAuditFinding["severity"];
  category: MotionAssetAuditCardCategory;
  evidenceRefs: readonly string[];
}

export interface MotionAssetAuditOpportunityCard {
  code: string;
  title: string;
  description: string;
  category: MotionAssetAuditCardCategory;
  evidenceRefs: readonly string[];
  actionType: "review_only";
}

export interface MotionAssetAuditPresentation {
  statusLabel: string;
  severityLevel: MotionAssetAuditPresentationSeverity;
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
    statusLabel: `audit.status.${summary.auditStatus}`,
    severityLevel: severityForStatus(summary.auditStatus),
    summaryTitle: `audit.summary.${summary.auditStatus}.title`,
    summaryDescription: `audit.summary.${summary.auditStatus}.description`,
    findingCards: summary.primaryFindings.map(findingCard),
    opportunityCards: summary.optimizationOpportunities.map(opportunityCard),
    uncertaintyNotes: uncertaintyNotes(summary.uncertainty),
    evidenceRefs: [...summary.evidenceRefs]
  };
}

function findingCard(finding: MotionAssetAuditFinding): MotionAssetAuditFindingCard {
  return {
    code: finding.code,
    title: `audit.finding.${finding.code}.title`,
    description: finding.message,
    severity: finding.severity,
    category: categoryForCode(finding.code),
    evidenceRefs: [...finding.evidenceRefs]
  };
}

function opportunityCard(
  opportunity: MotionAssetOptimizationOpportunity
): MotionAssetAuditOpportunityCard {
  return {
    code: opportunity.code,
    title: `audit.opportunity.${opportunity.code}.title`,
    description: opportunity.message,
    category: categoryForCode(opportunity.code),
    evidenceRefs: [...opportunity.evidenceRefs],
    actionType: "review_only"
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

function uncertaintyNotes(uncertainty: MotionAssetAuditUncertainty): string[] {
  return uncertainty === "low" ? [] : [`audit.uncertainty.${uncertainty}`];
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
