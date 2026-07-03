export function renderLoadingMessage(nodes, copy) {
  nodes.loadingMessage.textContent = copy;
}

export function renderFileHeader(nodes, displayName, playbackMeta) {
  nodes.fileIdentity.textContent = displayName;
  nodes.playbackMeta.textContent = playbackMeta;
}

export function renderDiscardMessage(nodes, copy) {
  nodes.discardMessage.textContent = copy;
}

export function renderFailureMessage(nodes, copy) {
  nodes.errorMessage.textContent = copy;
}
