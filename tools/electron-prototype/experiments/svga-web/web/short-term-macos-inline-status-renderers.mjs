export function createInlineStatusText(copy) {
  const empty = document.createElement("p");
  empty.className = "emptyText";
  empty.dataset.component = "InlineStatus";
  empty.textContent = copy;
  return empty;
}
