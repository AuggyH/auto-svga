export function togglePrimaryPlaybackLoopState(playbackState) {
  const playback = playbackState.primaryPlayback;
  const nextLooping = !(playbackState.primaryPlaybackLooping ?? playback?.looping ?? true);
  playbackState.primaryPlaybackLooping = nextLooping;
  if (playback) playback.looping = nextLooping;
  return {
    looping: nextLooping,
    playback
  };
}
