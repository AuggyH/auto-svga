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

export function createReplaceableEmptyStatus() {
  return createInlineStatusText("未发现可替换元素", [
    "仅包含自动命名资源（如 img_000），",
    "不满足可替换元素命名规则"
  ]);
}
