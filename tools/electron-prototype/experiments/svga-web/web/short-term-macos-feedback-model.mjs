export function bannerTone(title) {
  if (/正在/.test(title)) return "loading";
  if (/失败|未完成|未通过/.test(title)) return "danger";
  if (/没有|不支持|取消/.test(title)) return "warning";
  if (/已/.test(title)) return "success";
  return "info";
}

export function buildCurrentStateSummary(input) {
  const lines = [
    "Auto SVGA 状态摘要",
    `状态：${viewCopy(input.view)}`,
    input.displayName ? `文件：${input.displayName}` : "文件：未打开",
    input.playbackMeta && input.playbackMeta !== "-"
      ? `播放：${input.playbackMeta}`
      : "",
    input.activeOutput ? `未保存输出：${input.activeOutput.title || input.activeOutput.kind}` : "",
    input.saveBannerVisible && input.saveBannerText ? `提示：${input.saveBannerText.trim()}` : "",
    input.errorVisible && input.errorText ? `错误：${input.errorText.trim()}` : ""
  ];
  return lines.filter(Boolean).join("\n");
}

export function viewCopy(view) {
  return {
    launch: "等待打开",
    loading: "正在打开",
    failed: "打开失败",
    preview: "预览",
    compare: "对比",
    edit: "编辑预留"
  }[view] || view;
}
