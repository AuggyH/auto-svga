function targetLayout(videoItem, imageKey, frame) {
  const sprite = videoItem?.sprites?.find?.((candidate) => candidate?.imageKey === imageKey);
  if (!sprite) return undefined;
  const frames = Array.isArray(sprite.frames) ? sprite.frames : [];
  const safeFrame = Math.max(0, Math.min(frames.length - 1, Number(frame) || 0));
  const layout = frames[safeFrame]?.layout ?? frames.find(({ layout: value }) => value)?.layout;
  const width = Math.max(1, Math.round(Number(layout?.width) || 1));
  const height = Math.max(1, Math.round(Number(layout?.height) || 1));
  return { width, height };
}

function defaultTextSurface() {
  return typeof OffscreenCanvas === "function" ? new OffscreenCanvas(1, 1) : undefined;
}

function fitFontSize(context, text, width, height) {
  let size = Math.max(1, Math.floor(height * 0.7));
  if (typeof context.measureText !== "function") return size;
  while (size > 1) {
    context.font = `600 ${size}px system-ui, sans-serif`;
    if (context.measureText(text).width <= width * 0.92) return size;
    size -= 1;
  }
  return size;
}

function redrawCurrentFrame(playback) {
  const { player, videoItem } = playback ?? {};
  if (!videoItem || !player?.renderer?.drawFrame) return false;
  const frame = Math.max(0, Math.min((videoItem.frames ?? 1) - 1, Number(player.currentFrame) || 0));
  player.renderer.drawFrame(videoItem.images, videoItem.sprites, videoItem.dynamicElements, frame);
  return true;
}

export function applySvgaRuntimeTextTarget(playback, imageKey, text, options = {}) {
  const value = typeof text === "string" ? text : "";
  const layout = targetLayout(playback?.videoItem, imageKey, playback?.player?.currentFrame);
  if (!layout || !value) return { applied: false, imageKey };
  const surface = (options.createSurface ?? defaultTextSurface)();
  const context = surface?.getContext?.("2d");
  if (!context) return { applied: false, imageKey };
  surface.width = layout.width;
  surface.height = layout.height;
  if (surface.dataset) surface.dataset.runtimeTextValue = value;
  surface.runtimeTextValue = value;
  context.clearRect(0, 0, layout.width, layout.height);
  context.fillStyle = options.color ?? "CanvasText";
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.font = `600 ${fitFontSize(context, value, layout.width, layout.height)}px system-ui, sans-serif`;
  context.fillText(value, layout.width / 2, layout.height / 2, layout.width * 0.92);
  playback.videoItem.dynamicElements ??= {};
  playback.videoItem.dynamicElements[imageKey] = { source: surface, fit: "fill" };
  redrawCurrentFrame(playback);
  return { applied: true, imageKey, source: surface };
}

export function resetSvgaRuntimeTextTarget(playback, imageKey) {
  if (!imageKey || !playback?.videoItem?.dynamicElements?.[imageKey]) {
    return { reset: false, imageKey };
  }
  delete playback.videoItem.dynamicElements[imageKey];
  redrawCurrentFrame(playback);
  return { reset: true, imageKey };
}
