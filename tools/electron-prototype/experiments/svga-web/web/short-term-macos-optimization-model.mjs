import { groupOptimizationItems } from "./short-term-macos-render-model.mjs";

export function optimizationTabView(model) {
  const groupedItems = groupOptimizationItems(model?.items);
  return {
    summaryCopy: `${model.safeExecutableCount} 项可安全执行，${model.reviewOnlyCount} 项需复核，${model.unsupportedCount} 项暂不支持。`,
    runButtonCopy: "一键优化",
    runButtonTitle: model.batchActionEnabled
      ? "批量执行当前可安全执行的优化项"
      : "没有可安全执行的优化项",
    runButtonDisabled: !model.batchActionEnabled,
    groupedItems,
    hasFindings: groupedItems.length > 0,
    emptyCopy: "暂无可执行优化项"
  };
}

export function optimizationResultTone(model) {
  if (model?.status === "optimized") return "success";
  if (model?.status === "tradeoff") return "warning";
  return "danger";
}

export function canSaveOptimizationResult(model) {
  return model?.status === "optimized" || model?.status === "tradeoff";
}
