export function activePlaybackKey(playbackState) {
  return activePlaybackKeys(playbackState)[0]
    ?? (playbackState?.view === "edit" ? "edit" : playbackState?.view === "compare" ? "compareA" : "primary");
}

export function activePlaybackKeys(playbackState) {
  const candidates = playbackState?.view === "compare"
    ? ["compareA", "compareB"]
    : playbackState?.view === "edit"
      ? ["edit"]
      : ["primary"];
  return candidates.filter((key) => Boolean(playbackState?.[`${key}Playback`]));
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

export function togglePlaybackGroupState(playbackState, keys) {
  const playbacks = keys
    .map((key) => playbackState?.[`${key}Playback`])
    .filter(Boolean);
  const shouldPlay = !playbacks.some((playback) => playback.playing === true);
  for (const playback of playbacks) {
    if (shouldPlay && playback.playing !== true) playback.player.start();
    if (!shouldPlay && playback.playing === true) playback.player.pause();
    playback.playing = shouldPlay;
    if (shouldPlay) playback.hasPlayed = true;
  }
  return playbacks;
}

export function replayPlaybackGroupState(playbackState, keys) {
  const playbacks = keys
    .map((key) => playbackState?.[`${key}Playback`])
    .filter(Boolean);
  for (const playback of playbacks) {
    playback.player.clear();
    playback.player.start();
    playback.playing = true;
    playback.hasPlayed = true;
  }
  return playbacks;
}
