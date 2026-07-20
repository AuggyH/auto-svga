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

export function togglePlaybackLoopGroupState(playbackState, keys, groupKey) {
  const loopingKey = `${groupKey}PlaybackLooping`;
  const firstPlayback = keys
    .map((key) => playbackState?.[`${key}Playback`])
    .find(Boolean);
  const nextLooping = !(playbackState?.[loopingKey] ?? firstPlayback?.looping ?? true);
  playbackState[loopingKey] = nextLooping;
  const playbacks = [];
  for (const key of keys) {
    playbackState[`${key}PlaybackLooping`] = nextLooping;
    const playback = playbackState?.[`${key}Playback`];
    if (!playback) continue;
    playback.looping = nextLooping;
    playbacks.push(playback);
  }
  return { looping: nextLooping, playbacks };
}
