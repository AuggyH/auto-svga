import {
  clearCanvas,
  mountPlayback,
  replayPrimaryPlayback,
  stopAllPlayback,
  stopPlayback,
  svgaWebPlayerPrototype,
  togglePrimaryPlayback
} from "./short-term-macos-playback-model.mjs";

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

export function replayShortTermPrimaryPlayback({ state, onPlaybackStateChange }) {
  replayPrimaryPlayback(state, onPlaybackStateChange);
}

export function clearShortTermPlaybackCanvas(canvas) {
  clearCanvas(canvas);
}

export function shortTermPlayerPrototype() {
  return svgaWebPlayerPrototype();
}
