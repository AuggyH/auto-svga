import { escapeHtml } from "./short-term-macos-render-model.mjs";

export function renderRecentFilesUnavailable({ listNode, noteNode, clearButton }) {
  listNode.replaceChildren();
  clearButton.disabled = true;
  noteNode.textContent = "";
  noteNode.hidden = true;
}

export function renderLaunchRecentFiles({ listNode, noteNode, clearButton }, records) {
  clearButton.disabled = records.length === 0;
  listNode.replaceChildren(...records.map(createRecentFileRow));
  if (records.length === 0) listNode.append(createEmptyRecentFileRow());
  noteNode.textContent = "";
  noteNode.hidden = true;
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
