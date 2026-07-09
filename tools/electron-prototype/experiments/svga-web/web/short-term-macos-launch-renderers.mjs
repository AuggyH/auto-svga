import { escapeHtml } from "./short-term-macos-render-model.mjs";

export function renderRecentFilesUnavailable({ listNode, noteNode, clearButton }) {
  const recentBlock = listNode.closest(".recentBlock");
  if (recentBlock) recentBlock.hidden = true;
  listNode.replaceChildren();
  clearButton.disabled = true;
  noteNode.textContent = "";
  noteNode.hidden = true;
}

export function renderLaunchRecentFiles({ listNode, noteNode, clearButton }, records) {
  const recentBlock = listNode.closest(".recentBlock");
  if (recentBlock) recentBlock.hidden = records.length === 0;
  clearButton.disabled = records.length === 0;
  listNode.replaceChildren(...records.map(createRecentFileRow));
  noteNode.textContent = "";
  noteNode.hidden = true;
}

function isRecentRecordUnavailable(record) {
  return record?.available === false
    || record?.inaccessible === true
    || record?.status === "missing"
    || record?.status === "unavailable";
}

function recentRecordMetaText(record) {
  return isRecentRecordUnavailable(record) ? "文件不可访问" : (record.parentName || "本地文件");
}

export function createRecentFileRow(record) {
  const item = document.createElement("li");
  if (isRecentRecordUnavailable(record)) item.dataset.state = "invalid";
  item.innerHTML = `
    <button type="button" data-action="open-recent" data-recent-id="${escapeHtml(record.id)}">${escapeHtml(record.displayName)}</button>
    <span class="recentMeta">${escapeHtml(recentRecordMetaText(record))}</span>
  `;
  return item;
}
