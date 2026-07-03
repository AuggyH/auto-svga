export function applyRuntimeTextOverlay(node, copy, visible) {
  node.textContent = copy;
  node.hidden = !visible;
}

export function clearRuntimeTextOverlay(node) {
  node.hidden = true;
  node.textContent = "";
}
