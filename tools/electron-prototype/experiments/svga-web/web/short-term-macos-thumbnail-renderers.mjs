import {
  escapeHtml,
  isSafeImageDataUrl
} from "./short-term-macos-render-model.mjs";

export function renderThumbnailHtml(thumbnail, model) {
  if (!thumbnail || thumbnail.type === "audio-empty") return "无音频";
  if (thumbnail.type === "music") return "音频";
  const urls = (thumbnail.resourceIds ?? [])
    .map((id) => model?.thumbnails?.imageDataUrlsByResourceId?.[id])
    .filter(isSafeImageDataUrl)
    .slice(0, thumbnail.type === "sequence-four-grid" ? 4 : 1);
  if (urls.length === 0) return "";
  return urls
    .map((url) => `<img src="${escapeHtml(url)}" alt="">`)
    .join("");
}
