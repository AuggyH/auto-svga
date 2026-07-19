import { fromBase64 } from "./short-term-macos-byte-model.mjs";
import { optimizeShortTermSvga } from "./short-term-macos-api-client.mjs";
import {
  optimizationResultTone,
  optimizationTabView
} from "./short-term-macos-optimization-model.mjs";
import {
  focusOptimizationResult,
  prependOptimizationResult,
  renderOptimizationFindings,
  renderOptimizationRunningState,
  restoreOptimizationInteractionFocus
} from "./short-term-macos-optimization-renderers.mjs";
import { clearShortTermSaveBanner } from "./short-term-macos-feedback-surface.mjs";
import { suffixName } from "./short-term-macos-render-model.mjs";
import {
  markShortTermCompareSlotLoaded,
  renderShortTermOptimizationCompareResult,
  renderShortTermOptimizationCompareTrace
} from "./short-term-macos-compare-surface.mjs";

export function renderShortTermOptimization({ nodes, model }) {
  if (!model) return;
  renderOptimizationFindings(nodes, optimizationTabView(model));
}

export function renderShortTermOptimizationResult({ nodes, model }) {
  if (!model) return;
  const tone = optimizationResultTone(model);
  prependOptimizationResult(nodes, model.resultTitle, model.resultSummary, tone);
}

export async function renderShortTermOptimizationCompare({
  nodes,
  state,
  model,
  optimizedBytes,
  setView,
  setCompareSlot,
  renderCompareInfo,
  mountPlayback
}) {
  setView("compare");
  renderShortTermOptimizationCompareTrace(nodes);
  setCompareSlot("A", state.displayName || "原始文件", state.model);
  setCompareSlot("B", model.resultTitle || "优化结果", undefined, "优化副本");
  renderCompareInfo("A", "原始文件", state.model, state.displayName);
  renderShortTermOptimizationCompareResult({ nodes, model });
  focusOptimizationResult(nodes);
  const comparePlaybackOptions = { loop: state.comparePlaybackLooping !== false };
  await Promise.all([
    mountPlayback("compareA", nodes.compareCanvasA, state.sourceBytes, comparePlaybackOptions),
    mountPlayback("compareB", nodes.compareCanvasB, optimizedBytes, comparePlaybackOptions)
  ]);
  markShortTermCompareSlotLoaded({ nodes, slot: "A" });
  markShortTermCompareSlotLoaded({ nodes, slot: "B" });
}

export async function showShortTermOptimizationComparison({
  nodes,
  state,
  setView,
  setCompareSlot,
  renderCompareInfo,
  mountPlayback
}) {
  if (state.activeOutput?.kind !== "optimization" || !state.activeOutput.bytes?.byteLength) return;
  await renderShortTermOptimizationCompare({
    nodes,
    state,
    model: state.activeOutput.details ?? {
      resultTitle: state.activeOutput.title || "优化结果",
      resultSummary: state.activeOutput.summary || "已生成优化副本。",
      metrics: []
    },
    optimizedBytes: state.activeOutput.bytes,
    setView,
    setCompareSlot,
    renderCompareInfo,
    mountPlayback
  });
}

export async function runShortTermOptimizationWorkflow({
  bridge,
  nodes,
  state,
  confirmDiscardUnsavedOutput,
  setTab,
  setView,
  showSaveBanner,
  setActiveOutput,
  setCompareSlot,
  renderCompareInfo,
  mountPlayback,
  showOperationFailure
}) {
  if (!state.sourceBytes) return;
  if (!(await confirmDiscardUnsavedOutput("执行安全优化会放弃当前未保存的 SVGA 输出。"))) return;
  setTab("optimization");
  clearShortTermSaveBanner(nodes);
  renderOptimizationRunningState(nodes, true);
  const finishRunning = ({ restoreFocus = true } = {}) => {
    renderOptimizationRunningState(nodes, false);
    renderShortTermOptimization({ nodes, model: state.model });
    if (restoreFocus) {
      restoreOptimizationInteractionFocus(nodes);
    } else {
      delete nodes.panelOptimization.dataset.returnFocus;
    }
  };
  try {
    const result = await optimizeShortTermSvga({
      bytes: state.sourceBytes,
      name: state.displayName,
      reportToken: bridge?.reportToken
    });
    const optimizedBytes = result.optimizedSvgaBase64 ? fromBase64(result.optimizedSvgaBase64) : undefined;
    if (!optimizedBytes?.byteLength || result.optimization?.status !== "optimized") {
      finishRunning();
      showSaveBanner(result.optimization?.resultTitle || "没有可安全执行的优化项。", result.optimization?.resultSummary || "源文件没有被修改。");
      renderShortTermOptimizationResult({ nodes, model: result.optimization });
      return;
    }
    state.previewBytes = optimizedBytes;
    setActiveOutput({
      kind: "optimization",
      bytes: optimizedBytes,
      suggestedName: suffixName(state.displayName, "optimized"),
      title: result.optimization.resultTitle,
      summary: result.optimization.resultSummary,
      details: result.optimization
    });
    finishRunning({ restoreFocus: false });
    await renderShortTermOptimizationCompare({
      nodes,
      state,
      model: result.optimization,
      optimizedBytes,
      setView,
      setCompareSlot,
      renderCompareInfo,
      mountPlayback
    });
  } catch (error) {
    finishRunning();
    showOperationFailure("优化未完成。", error);
  }
}
