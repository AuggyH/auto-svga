export function togglePlaybackLoopState(playbackState, key) {
  const playback = playbackState[`${key}Playback`];
  const loopingKey = `${key}PlaybackLooping`;
  const nextLooping = !(playbackState[loopingKey] ?? playback?.looping ?? true);
  playbackState[loopingKey] = nextLooping;
  if (playback) playback.looping = nextLooping;
  return {
    looping: nextLooping,
    playback
  };
}

export function togglePrimaryPlaybackLoopState(playbackState) {
  return togglePlaybackLoopState(playbackState, "primary");
}
