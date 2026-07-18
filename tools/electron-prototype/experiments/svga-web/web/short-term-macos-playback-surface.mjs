import {
  clearCanvas,
  mountPlayback,
  playbackProgressView,
  replayPlaybackGroup,
  replayPlayback,
  replayPrimaryPlayback,
  stopAllPlayback,
  stopPlayback,
  togglePlayback,
  togglePlaybackGroup,
  togglePlaybackLoop,
  togglePlaybackLoopGroup,
  togglePrimaryPlaybackLoop,
  svgaWebPlayerPrototype,
  togglePrimaryPlayback
} from "./short-term-macos-playback-model.mjs";
import {
  activePlaybackKey,
  activePlaybackKeys
} from "./short-term-macos-playback-control-model.mjs";

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

export function toggleShortTermPlaybackGroup({ state, keys, onPlaybackStateChange }) {
  return togglePlaybackGroup(state, keys, onPlaybackStateChange);
}

export function replayShortTermPlaybackGroup({ state, keys, onPlaybackStateChange }) {
  return replayPlaybackGroup(state, keys, onPlaybackStateChange);
}

export function toggleShortTermPrimaryPlaybackLoop({ state, onPlaybackStateChange }) {
  togglePrimaryPlaybackLoop(state, onPlaybackStateChange);
}

export function toggleShortTermPlaybackLoop({ state, key, onPlaybackStateChange }) {
  return togglePlaybackLoop(state, key, onPlaybackStateChange);
}

export function toggleShortTermPlaybackLoopGroup({ state, keys, groupKey, onPlaybackStateChange }) {
  return togglePlaybackLoopGroup(state, keys, groupKey, onPlaybackStateChange);
}

export function shortTermActivePlaybackKey(state) {
  return activePlaybackKey(state);
}

export function shortTermActivePlaybackKeys(state) {
  return activePlaybackKeys(state);
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
