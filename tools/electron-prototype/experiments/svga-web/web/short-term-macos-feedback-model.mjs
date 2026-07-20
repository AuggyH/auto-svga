import { escapeHtml } from "./short-term-macos-render-model.mjs";

export const SHORT_TERM_LOAD_FAILURE_COPY = "文件格式不受支持或已损坏";

const SAVE_BANNER_A11Y = {
  danger: { role: "alert", ariaLive: "assertive", ariaBusy: "false" },
  loading: { role: "status", ariaLive: "polite", ariaBusy: "true" },
  success: { role: "status", ariaLive: "polite", ariaBusy: "false" },
  warning: { role: "status", ariaLive: "polite", ariaBusy: "false" },
  info: { role: "status", ariaLive: "polite", ariaBusy: "false" }
};

export function normalizeSaveBannerStatus(status) {
  return Object.hasOwn(SAVE_BANNER_A11Y, status) ? status : "info";
}

export function bannerTone(title) {
  if (/正在|执行中/.test(title)) return "loading";
  if (/失败|未完成|未通过/.test(title)) return "danger";
  if (/没有|不支持|取消/.test(title)) return "warning";
  if (/已/.test(title)) return "success";
  return "info";
}

export function saveBannerA11yState(status) {
  return SAVE_BANNER_A11Y[normalizeSaveBannerStatus(status)];
}

export function saveBannerView(title, message, tone = bannerTone(title)) {
  const status = normalizeSaveBannerStatus(tone);
  const a11y = saveBannerA11yState(status);
  const messageHtml = message ? `<span> ${escapeHtml(message)}</span>` : "";
  return {
    status,
    ...a11y,
    html: `<strong>${escapeHtml(title)}</strong>${messageHtml}`
  };
}

export function sourceUnmodifiedMessage() {
  return "源文件没有被修改。";
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
    unsupported: "格式不支持",
    preview: "预览",
    compare: "对比",
    edit: "编辑预留"
  }[view] || view;
}
