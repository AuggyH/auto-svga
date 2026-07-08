import { canSaveOptimizationResult } from "./short-term-macos-optimization-model.mjs";

export function buildCommandState(input) {
  const appearance = ["system", "light", "dark"].includes(input.appearance) ? input.appearance : "system";
  const hasFile = input.hasFile === true;
  const hasOutput = Boolean(input.activeOutput);
  const outputKind = input.activeOutput?.kind || "";
  const outputSaveable = outputKind === "optimization"
    ? canSaveOptimizationResult(input.activeOutput?.details)
    : hasOutput;
  const saveBusy = input.saveStatus === "validating";
  const canOverwrite = hasOutput && outputSaveable && !saveBusy && Boolean(input.sourceId);
  const canSaveAs = hasOutput && outputSaveable && !saveBusy;
  const headerSaveAsVisible = (hasOutput && outputKind !== "optimization") || input.cleanSaveAsVisible === true;
  const canRunOptimization = hasFile && input.optimizationBatchActionEnabled === true;
  const canRenameImageKey = hasFile && Boolean(input.selectedImageKey);
  const canEditText = input.canEditText === true;
  const canResetText = Object.values(input.textPreviewValues || {}).some(Boolean);
  const canResetImageReplacement = input.activeOutput?.kind === "replacement";
  const canShowOptimizationComparison = input.activeOutput?.kind === "optimization"
    && Boolean(input.activeOutput.bytes?.byteLength);

  return {
    actionStates: {
      compare: { enabled: true, reason: "" },
      "play-pause": { enabled: hasFile, reason: "请先打开 SVGA" },
      replay: { enabled: hasFile, reason: "请先打开 SVGA" },
      "run-optimization": { enabled: canRunOptimization, reason: "没有可安全执行的优化项" },
      "save-as": { enabled: canSaveAs, reason: hasOutput ? "正在验证保存输出" : "没有可保存的输出" },
      "save-overwrite": { enabled: canOverwrite, reason: input.sourceId ? "正在验证保存输出" : "当前文件不支持覆盖保存" },
      "edit-text": { enabled: canEditText, reason: "当前文件没有可预览文本元素" },
      "reset-text": { enabled: canResetText, reason: "当前没有已应用的文本预览" }
    },
    headerSaveAsVisible,
    playPauseCopy: input.primaryPlaybackPlaying ? "暂停" : "播放",
    menuState: {
      view: input.view,
      mode: input.mode,
      tab: input.tab,
      appearance,
      hasFile,
      hasOutput,
      outputKind,
      canOverwrite,
      canSaveAs,
      saveBusy,
      canCompare: true,
      canPlay: hasFile,
      canReplay: hasFile,
      canRenameImageKey,
      canReplaceImage: canRenameImageKey,
      canResetImageReplacement,
      canEditText,
      canResetText,
      canRunOptimization,
      canShowOptimizationComparison,
      isRenaming: Boolean(input.renameImageKey),
      hasTransientState: Boolean(input.renameImageKey) || input.view === "compare" || input.dialogOpen === true
    }
  };
}
