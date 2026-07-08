import { FILL_MODE, Parser as SvgaWebParser, Player as SvgaWebPlayer } from "/vendor/svga-web-2.4.4.js";
import { toParserArrayBuffer } from "./short-term-macos-byte-model.mjs";
import { playbackCanvasFitSize } from "./short-term-macos-playback-fit-model.mjs";

export async function mountPlayback({
  key,
  canvas,
  bytes,
  options = {},
  playbackState,
  onPlaybackStateChange = () => {}
}) {
  if (!canvas || !bytes?.byteLength) return undefined;
  stopPlayback({ key, playbackState });
  const parser = new SvgaWebParser();
  const videoItem = await parser.do(toParserArrayBuffer(bytes));
  const movieWidth = Math.max(1, Math.round(videoItem.videoSize?.width ?? videoItem.width ?? 512));
  const movieHeight = Math.max(1, Math.round(videoItem.videoSize?.height ?? videoItem.height ?? 512));
  canvas.width = movieWidth;
  canvas.height = movieHeight;
  fitPlaybackCanvasToContainer(canvas, movieWidth, movieHeight);
  const resizeObserver = observePlaybackCanvasContainer(canvas, movieWidth, movieHeight);
  const player = new SvgaWebPlayer(canvas);
  player.set({ loop: true, fillMode: FILL_MODE.FORWARDS, noExecutionDelay: false });
  await player.mount(videoItem);
  if (options.start !== false) player.start();
  playbackState[`${key}Playback`] = { player, videoItem, playing: options.start !== false, resizeObserver };
  onPlaybackStateChange();
  return playbackState[`${key}Playback`];
}

export function stopPlayback({ key, playbackState }) {
  const playback = playbackState[`${key}Playback`];
  try {
    playback?.player?.clear?.();
  } catch {
    // Renderer cleanup should never block opening another local file.
  }
  playback?.resizeObserver?.disconnect?.();
  playbackState[`${key}Playback`] = undefined;
}

export function stopAllPlayback(playbackState, keys = ["primary", "compareA", "compareB", "edit"]) {
  for (const key of keys) stopPlayback({ key, playbackState });
}

export function togglePrimaryPlayback(playbackState, onPlaybackStateChange = () => {}) {
  const playback = playbackState.primaryPlayback;
  if (!playback) return;
  if (playback.playing) {
    playback.player.pause();
    playback.playing = false;
  } else {
    playback.player.start();
    playback.playing = true;
  }
  onPlaybackStateChange();
}

export function replayPrimaryPlayback(playbackState, onPlaybackStateChange = () => {}) {
  const playback = playbackState.primaryPlayback;
  if (!playback) return;
  playback.player.clear();
  playback.player.start();
  playback.playing = true;
  onPlaybackStateChange();
}

export function clearCanvas(canvas) {
  const context = canvas.getContext("2d");
  context?.clearRect(0, 0, canvas.width, canvas.height);
}

export function playbackProgressView(playback) {
  const frames = Math.max(0, Number(playback?.videoItem?.frames ?? 0));
  const fps = Math.max(0, Number(playback?.videoItem?.FPS ?? 0));
  const currentFrame = Math.max(0, Number(playback?.player?.currentFrame ?? 0));
  const rawProgress = typeof playback?.player?.progress === "number"
    ? playback.player.progress
    : frames > 0
      ? (currentFrame / frames) * 100
      : 0;
  const progress = Math.max(0, Math.min(100, rawProgress));
  const durationSeconds = frames > 0 && fps > 0 ? frames / fps : 0;
  const currentSeconds = fps > 0 ? Math.min(durationSeconds, currentFrame / fps) : 0;
  return {
    progress,
    timeCopy: `${formatPlaybackTime(currentSeconds)} / ${formatPlaybackTime(durationSeconds)}`
  };
}

export function svgaWebPlayerPrototype() {
  return SvgaWebPlayer.prototype;
}

function formatPlaybackTime(seconds) {
  const safeSeconds = Number.isFinite(seconds) ? Math.max(0, seconds) : 0;
  const wholeSeconds = Math.floor(safeSeconds);
  const minutes = Math.floor(wholeSeconds / 60);
  const remainder = wholeSeconds % 60;
  return `${minutes}:${String(remainder).padStart(2, "0")}`;
}

function observePlaybackCanvasContainer(canvas, movieWidth, movieHeight) {
  if (typeof ResizeObserver !== "function") return undefined;
  const target = canvas.parentElement ?? canvas;
  const observer = new ResizeObserver(() => fitPlaybackCanvasToContainer(canvas, movieWidth, movieHeight));
  observer.observe(target);
  return observer;
}

export function fitPlaybackCanvasToContainer(canvas, movieWidth, movieHeight) {
  const safeMovieWidth = Math.max(1, Number(movieWidth) || 1);
  const safeMovieHeight = Math.max(1, Number(movieHeight) || 1);
  const parent = canvas.parentElement;
  const bounds = parent?.getBoundingClientRect?.();
  const maxWidth = Math.max(1, Math.floor(bounds?.width || parent?.clientWidth || safeMovieWidth));
  const maxHeight = Math.max(1, Math.floor(bounds?.height || parent?.clientHeight || safeMovieHeight));
  const fit = playbackCanvasFitSize({
    containerWidth: maxWidth,
    containerHeight: maxHeight,
    movieWidth: safeMovieWidth,
    movieHeight: safeMovieHeight
  });
  canvas.style.setProperty("--asv-playback-aspect", `${safeMovieWidth} / ${safeMovieHeight}`);
  canvas.style.width = `${fit.width}px`;
  canvas.style.height = `${fit.height}px`;
  canvas.dataset.movieWidth = String(safeMovieWidth);
  canvas.dataset.movieHeight = String(safeMovieHeight);
}
