import {
  dragDecisionZoneForEvent,
  dragFileFromEvent,
  isSupportedShortTermDropFile
} from "./short-term-macos-drag-decision-model.mjs";

const zoneLabels = {
  open: "打开新文件",
  compare: "添加为对比文件",
  unsupported: "不支持的文件格式"
};

export function dragDecisionForEvent(target, event) {
  const file = dragFileFromEvent(event);
  return {
    file,
    focusZone: dragDecisionZoneForEvent(target, event),
    supported: isSupportedShortTermDropFile(file)
  };
}

export function showShortTermDragDecisionOverlay(overlay, decision) {
  if (!overlay) return;
  overlay.hidden = false;
  overlay.dataset.status = decision.supported ? "supported" : "unsupported";
  overlay.dataset.focusZone = decision.focusZone;
  overlay.querySelectorAll("[data-drag-zone]").forEach((zone) => {
    const active = zone.dataset.dragZone === decision.focusZone;
    zone.querySelector("strong").textContent = decision.supported || !active
      ? zoneLabels[zone.dataset.dragZone]
      : zoneLabels.unsupported;
  });
}

export function hideShortTermDragDecisionOverlays(nodes) {
  [nodes.previewDragOverlay, nodes.compareDragOverlay].forEach((overlay) => {
    if (!overlay) return;
    overlay.hidden = true;
  });
}

export function showShortTermCanvasToast(nodes, message) {
  if (!nodes.canvasToast) return;
  nodes.canvasToast.textContent = message;
  nodes.canvasToast.hidden = false;
}

export function hideShortTermCanvasToast(nodes) {
  if (!nodes.canvasToast) return;
  nodes.canvasToast.hidden = true;
  nodes.canvasToast.textContent = "";
}
