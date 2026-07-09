"use strict";

function normalizePositiveInteger(value, fallback) {
  return Number.isFinite(value) && value > 0 ? Math.round(value) : fallback;
}

function normalizeRect(value, fallback) {
  const source = value && typeof value === "object" ? value : {};
  return {
    x: Number.isFinite(source.x) ? Math.round(source.x) : fallback.x,
    y: Number.isFinite(source.y) ? Math.round(source.y) : fallback.y,
    width: normalizePositiveInteger(source.width, fallback.width),
    height: normalizePositiveInteger(source.height, fallback.height)
  };
}

function clamp(value, min, max) {
  if (max < min) return min;
  return Math.min(max, Math.max(min, value));
}

function clampSizeToWorkArea(size, workArea, minimumSize) {
  const fallbackSize = normalizeRect(size, { x: 0, y: 0, width: 640, height: 640 });
  const area = normalizeRect(workArea, { x: 0, y: 0, width: fallbackSize.width, height: fallbackSize.height });
  const minimum = normalizeRect(minimumSize, { x: 0, y: 0, width: 1, height: 1 });
  const minWidth = Math.min(minimum.width, area.width);
  const minHeight = Math.min(minimum.height, area.height);

  return {
    width: clamp(fallbackSize.width, minWidth, area.width),
    height: clamp(fallbackSize.height, minHeight, area.height)
  };
}

function preserveWindowSizeAcrossDisplay({ currentBounds, preservedSize, workArea, minimumSize }) {
  const area = normalizeRect(workArea, { x: 0, y: 0, width: 640, height: 640 });
  const bounds = normalizeRect(currentBounds, {
    x: area.x,
    y: area.y,
    width: preservedSize?.width ?? 640,
    height: preservedSize?.height ?? 640
  });
  const size = clampSizeToWorkArea(preservedSize ?? bounds, area, minimumSize);
  const maxX = area.x + area.width - size.width;
  const maxY = area.y + area.height - size.height;

  return {
    x: clamp(bounds.x, area.x, maxX),
    y: clamp(bounds.y, area.y, maxY),
    width: size.width,
    height: size.height
  };
}

function sameWindowBounds(a, b) {
  return Boolean(a && b)
    && Math.round(a.x) === Math.round(b.x)
    && Math.round(a.y) === Math.round(b.y)
    && Math.round(a.width) === Math.round(b.width)
    && Math.round(a.height) === Math.round(b.height);
}

module.exports = {
  clampSizeToWorkArea,
  preserveWindowSizeAcrossDisplay,
  sameWindowBounds
};
