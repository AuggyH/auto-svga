export function activePlaybackKey(playbackState) {
  return playbackState?.view === "edit" ? "edit" : "primary";
}

export function togglePlaybackState(playbackState, key) {
  const playback = playbackState?.[`${key}Playback`];
  if (!playback) return undefined;
  if (playback.playing) {
    playback.player.pause();
    playback.playing = false;
  } else {
    playback.player.start();
    playback.playing = true;
    playback.hasPlayed = true;
  }
  return playback;
}

export function replayPlaybackState(playbackState, key) {
  const playback = playbackState?.[`${key}Playback`];
  if (!playback) return undefined;
  playback.player.clear();
  playback.player.start();
  playback.playing = true;
  playback.hasPlayed = true;
  return playback;
}
