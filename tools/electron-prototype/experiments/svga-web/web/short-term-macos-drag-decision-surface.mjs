import {
  compareDragDecisionZoneForEvent,
  dragDecisionZoneForEvent,
  dragFileFromEvent,
  isSupportedShortTermDropFile
} from "./short-term-macos-drag-decision-model.mjs";

const previewZoneLabels = Object.freeze({
  open: "打开新文件",
  compare: "添加为对比文件",
});

function compareZoneLabels(compareSlots = {}) {
  const slotLabel = (slot) => compareSlots[slot] === "loaded"
    ? `替换对比文件 ${slot}`
    : `打开对比文件 ${slot}`;
  return Object.freeze({
    "compare-a": slotLabel("A"),
    "compare-b": slotLabel("B"),
    open: "打开文件"
  });
}

export function dragDecisionForEvent(target, event, options = {}) {
  const file = dragFileFromEvent(event);
  const compareView = options.view === "compare";
  const focusZone = compareView
    ? compareDragDecisionZoneForEvent(target, event)
    : dragDecisionZoneForEvent(target, event);
  const fileSupported = isSupportedShortTermDropFile(file);
  return {
    file,
    view: compareView ? "compare" : "preview",
    focusZone,
    supported: fileSupported,
    fileSupported,
    compareAvailable: true,
    unsupportedCopy: compareView && focusZone !== "open"
      ? "当前格式不支持对比"
      : "不支持的文件格式",
    zoneLabels: compareView ? compareZoneLabels(options.compareSlots) : previewZoneLabels
  };
}

export function showShortTermDragDecisionOverlay(overlay, decision) {
  if (!overlay) return;
  const compareAvailable = decision.compareAvailable !== false;
  const compareView = overlay.dataset.variant === "compare" || decision.view === "compare";
  overlay.hidden = false;
  overlay.dataset.status = decision.supported ? "supported" : "unsupported";
  overlay.dataset.focusZone = decision.focusZone;
  overlay.dataset.compareAvailable = compareAvailable ? "true" : "false";
  const zoneLabels = decision.zoneLabels
    ?? (compareView ? compareZoneLabels(decision.compareSlots) : previewZoneLabels);
  let activeCopy = "";
  overlay.querySelectorAll("[data-drag-zone]").forEach((zone) => {
    const available = compareView || compareAvailable || zone.dataset.dragZone !== "compare";
    const active = zone.dataset.dragZone === decision.focusZone;
    zone.hidden = !available;
    zone.setAttribute("aria-hidden", available ? "false" : "true");
    const label = zoneLabels[zone.dataset.dragZone]
      ?? previewZoneLabels[zone.dataset.dragZone]
      ?? "打开文件";
    const visibleCopy = decision.supported || !active
      ? label
      : decision.unsupportedCopy || "不支持的文件格式";
    zone.querySelector("strong").textContent = visibleCopy;
    zone.setAttribute("aria-label", visibleCopy);
    if (active) activeCopy = visibleCopy;
  });
  overlay.setAttribute("aria-label", activeCopy || "拖拽文件操作");
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
