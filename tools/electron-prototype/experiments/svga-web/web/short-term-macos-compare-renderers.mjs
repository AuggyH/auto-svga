export function applyCompareSlotView(nodes, slot, view) {
  const titleNode = slot === "A" ? nodes.compareCanvasTitleA : nodes.compareCanvasTitleB;
  const metaNode = slot === "A" ? nodes.compareCanvasMetaA : nodes.compareCanvasMetaB;
  const wrapNode = slot === "A" ? nodes.compareCanvasWrapA : nodes.compareCanvasWrapB;
  if (titleNode) titleNode.textContent = view.title;
  if (metaNode) metaNode.textContent = view.meta;
  if (wrapNode) wrapNode.dataset.compareState = view.compareState;
}

export function markCompareSlotLoaded(nodes, slot) {
  const wrapNode = slot === "A" ? nodes.compareCanvasWrapA : nodes.compareCanvasWrapB;
  if (wrapNode) wrapNode.dataset.compareState = "loaded";
}

export function applyCompareTraceView(node, view) {
  if (!node) return;
  node.dataset.module = view.moduleName;
  node.dataset.pageState = view.pageState;
  node.dataset.stateMode = view.stateMode;
}

export function renderCompareInfoPanel(nodes, slot, html) {
  const node = slot === "A" ? nodes.compareInfoA : nodes.compareInfoB;
  if (node) node.innerHTML = html;
}
