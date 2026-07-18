export function renderLoadingMessage(nodes, copy) {
  nodes.loadingMessage.textContent = copy;
}

export function renderFileHeader(nodes, displayName, playbackMeta) {
  nodes.fileIdentity.textContent = displayName;
  nodes.playbackMeta.textContent = playbackMeta;
  if (!playbackMeta) {
    delete nodes.playbackMeta.dataset.status;
    delete nodes.playbackMeta.dataset.format;
  }
}

export function renderDiscardMessage(nodes, copy) {
  nodes.discardMessage.textContent = copy;
}

export function renderFailureMessage(nodes, copy) {
  nodes.errorMessage.textContent = copy;
}

export function showPlaybackFailureRecovery(nodes) {
  nodes.playbackErrorMessage.textContent = "动画解析失败，无法正常播放";
  nodes.playbackErrorRecovery.hidden = false;
}

export function hidePlaybackFailureRecovery(nodes) {
  nodes.playbackErrorRecovery.hidden = true;
}
