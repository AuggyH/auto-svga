import { FILL_MODE, Parser as SvgaWebParser, Player as SvgaWebPlayer } from "/vendor/svga-web-2.4.4.js";
import { toParserArrayBuffer } from "./short-term-macos-byte-model.mjs";

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
  canvas.width = Math.max(1, Math.round(videoItem.videoSize?.width ?? videoItem.width ?? 512));
  canvas.height = Math.max(1, Math.round(videoItem.videoSize?.height ?? videoItem.height ?? 512));
  const player = new SvgaWebPlayer(canvas);
  player.set({ loop: true, fillMode: FILL_MODE.FORWARDS, noExecutionDelay: false });
  await player.mount(videoItem);
  if (options.start !== false) player.start();
  playbackState[`${key}Playback`] = { player, videoItem, playing: options.start !== false };
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

export function svgaWebPlayerPrototype() {
  return SvgaWebPlayer.prototype;
}
