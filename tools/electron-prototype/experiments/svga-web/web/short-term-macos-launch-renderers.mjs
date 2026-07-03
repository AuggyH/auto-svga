import { escapeHtml } from "./short-term-macos-render-model.mjs";

export function renderRecentFilesUnavailable({ listNode, noteNode, clearButton }) {
  listNode.replaceChildren();
  clearButton.disabled = true;
  noteNode.textContent = "最近文件由 macOS 客户端提供。";
}

export function renderLaunchRecentFiles({ listNode, noteNode, clearButton }, records) {
  clearButton.disabled = records.length === 0;
  listNode.replaceChildren(...records.map(createRecentFileRow));
  if (records.length === 0) listNode.append(createEmptyRecentFileRow());
  noteNode.textContent = "仅显示文件名和父级位置。";
}

export function createRecentFileRow(record) {
  const item = document.createElement("li");
  item.innerHTML = `
    <button type="button" data-action="open-recent" data-recent-id="${escapeHtml(record.id)}">${escapeHtml(record.displayName)}</button>
    <span class="recentMeta">${escapeHtml(record.parentName || "本地文件")}</span>
  `;
  return item;
}

export function createEmptyRecentFileRow() {
  const empty = document.createElement("li");
  empty.className = "isEmpty";
  empty.innerHTML = `<span class="recentMeta">暂无最近打开记录</span>`;
  return empty;
}
