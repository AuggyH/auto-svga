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
    emptyCopy: "没有可一键优化的安全项。若总览存在超标，请按规格复核或等待后续支持。"
  };
}

export function optimizationResultTone(model) {
  return model.status === "optimized"
    ? "success"
    : model.status === "failed" ? "danger" : "warning";
}
