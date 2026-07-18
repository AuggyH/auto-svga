import {
  clearCanvas,
  mountPlayback,
  playbackProgressView,
  replayPlayback,
  replayPrimaryPlayback,
  stopAllPlayback,
  stopPlayback,
  togglePlayback,
  togglePlaybackLoop,
  togglePrimaryPlaybackLoop,
  svgaWebPlayerPrototype,
  togglePrimaryPlayback
} from "./short-term-macos-playback-model.mjs";
import { activePlaybackKey } from "./short-term-macos-playback-control-model.mjs";

export async function mountShortTermPlayback({
  state,
  key,
  canvas,
  bytes,
  options = {},
  onPlaybackStateChange
}) {
  return mountPlayback({
    key,
    canvas,
    bytes,
    options,
    playbackState: state,
    onPlaybackStateChange
  });
}

export function stopShortTermPlayback({ state, key }) {
  stopPlayback({ key, playbackState: state });
}

export function stopAllShortTermPlayback(state) {
  stopAllPlayback(state);
}

export function toggleShortTermPrimaryPlayback({ state, onPlaybackStateChange }) {
  togglePrimaryPlayback(state, onPlaybackStateChange);
}

export function toggleShortTermPlayback({ state, key, onPlaybackStateChange }) {
  return togglePlayback(state, key, onPlaybackStateChange);
}

export function replayShortTermPrimaryPlayback({ state, onPlaybackStateChange }) {
  replayPrimaryPlayback(state, onPlaybackStateChange);
}

export function replayShortTermPlayback({ state, key, onPlaybackStateChange }) {
  return replayPlayback(state, key, onPlaybackStateChange);
}

export function toggleShortTermPrimaryPlaybackLoop({ state, onPlaybackStateChange }) {
  togglePrimaryPlaybackLoop(state, onPlaybackStateChange);
}

export function toggleShortTermPlaybackLoop({ state, key, onPlaybackStateChange }) {
  return togglePlaybackLoop(state, key, onPlaybackStateChange);
}

export function shortTermActivePlaybackKey(state) {
  return activePlaybackKey(state);
}

export function renderShortTermPlaybackProgress(nodes, playback) {
  const view = playbackProgressView(playback);
  nodes.playbackProgress?.style.setProperty("--asv-playback-progress", `${view.progress}%`);
  nodes.playbackProgress?.setAttribute("aria-valuenow", String(Math.round(view.progress)));
  if (nodes.playbackTime) nodes.playbackTime.textContent = view.timeCopy;
  if (playback?.canvas?.dataset?.runtimePlayer === "svga-web") {
    playback.canvas.dataset.runtimePlaybackState = playback.playing
      ? "playing"
      : playback.hasPlayed
        ? "paused"
        : "previewReady";
    playback.canvas.dataset.runtimePlaybackProgress = String(view.progress);
    playback.canvas.dataset.runtimePlaybackFrame = String(view.frame);
    playback.canvas.dataset.runtimePlaybackFrames = String(view.frames);
    playback.canvas.dataset.runtimePlaybackTimeCopy = view.timeCopy;
  }
}

export function clearShortTermPlaybackCanvas(canvas) {
  clearCanvas(canvas);
}

export function shortTermPlayerPrototype() {
  return svgaWebPlayerPrototype();
}
