export function createInlineStatusText(copy, details = []) {
  const empty = document.createElement("p");
  empty.className = "emptyText";
  empty.dataset.component = "InlineStatus";
  const detailLines = Array.isArray(details)
    ? details.filter((line) => typeof line === "string" && line.trim())
    : [];
  if (!detailLines.length) {
    empty.textContent = copy;
    return empty;
  }
  empty.dataset.variant = "explanatory";
  const title = document.createElement("span");
  title.className = "emptyTextTitle";
  title.textContent = copy;
  empty.append(title);
  detailLines.forEach((line) => {
    const detail = document.createElement("span");
    detail.className = "emptyTextDetail";
    detail.textContent = line;
    empty.append(detail);
  });
  return empty;
}

export function createAssetEmptyStatus(copy, kind) {
  const empty = createInlineStatusText(copy);
  empty.dataset.variant = "asset";
  empty.dataset.kind = kind;
  const icon = document.createElement("span");
  icon.className = "emptyStateIcon";
  icon.dataset.kind = kind;
  icon.setAttribute("aria-hidden", "true");
  if (kind === "audio" || kind === "sequence") {
    const firstNote = document.createElement("span");
    firstNote.className = "emptyStateNote";
    const secondNote = document.createElement("span");
    secondNote.className = "emptyStateNote";
    icon.replaceChildren(firstNote, secondNote);
  }
  const title = document.createElement("span");
  title.className = "emptyTextTitle";
  title.textContent = copy;
  empty.replaceChildren(icon, title);
  return empty;
}

export function createReplaceableEmptyStatus() {
  return createAssetEmptyStatus("未发现可替换元素", "replaceable");
}
