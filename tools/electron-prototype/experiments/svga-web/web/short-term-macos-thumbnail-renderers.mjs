import {
  escapeHtml,
  isSafeImageDataUrl
} from "./short-term-macos-render-model.mjs";

function renderAudioThumbnailIcon(state) {
  return `<span class="thumbnailAudioIcon" data-component="ThumbnailAudioIcon" data-state="${state}" aria-hidden="true"></span>`;
}

function renderTextThumbnailIcon() {
  return `<span class="thumbnailTextIcon" data-component="ThumbnailTextIcon" aria-hidden="true"></span>`;
}

export function renderThumbnailHtml(thumbnail, model) {
  if (!thumbnail) return "";
  if (thumbnail.type === "audio-empty") return renderAudioThumbnailIcon("empty");
  if (thumbnail.type === "music") return renderAudioThumbnailIcon("available");
  if (thumbnail.type === "text") return renderTextThumbnailIcon();
  const urls = (thumbnail.resourceIds ?? [])
    .map((id) => model?.thumbnails?.imageDataUrlsByResourceId?.[id])
    .filter(isSafeImageDataUrl)
    .slice(0, thumbnail.type === "sequence-four-grid" ? 4 : 1);
  if (urls.length === 0) return "";
  return urls
    .map((url) => `<img src="${escapeHtml(url)}" alt="">`)
    .join("");
}
