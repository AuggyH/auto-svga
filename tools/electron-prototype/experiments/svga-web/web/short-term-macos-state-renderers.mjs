export function renderLoadingMessage(nodes, copy) {
  nodes.loadingMessage.textContent = copy;
}

export function captureViewTransitionFocus(nodes, container = nodes.app) {
  const documentRef = nodes.app?.ownerDocument ?? container?.ownerDocument ?? globalThis.document;
  const activeElement = documentRef?.activeElement;
  return {
    shouldMove: Boolean(
      activeElement
      && activeElement !== documentRef?.body
      && container?.contains?.(activeElement)
      && activeElement.closest?.("[data-view]")
    )
  };
}

export function moveViewTransitionFocus(context, target) {
  if (!context?.shouldMove || !target?.focus) return false;
  target.focus({ preventScroll: true });
  target.scrollIntoView?.({ block: "nearest" });
  return true;
}

export function renderFileHeader(nodes, displayName, playbackMeta, options = {}) {
  const dirty = options.dirty === true;
  nodes.fileIdentity.textContent = dirty ? `${displayName} *` : displayName;
  nodes.fileIdentity.dataset.dirty = dirty ? "true" : "false";
  nodes.fileIdentity.setAttribute(
    "aria-label",
    dirty ? `${displayName}，存在未保存更改` : displayName
  );
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
  const focusContext = captureViewTransitionFocus(nodes, nodes.previewStagePanel);
  nodes.playbackErrorMessage.textContent = "动画解析失败，无法正常播放";
  nodes.playbackErrorRecovery.hidden = false;
  moveViewTransitionFocus(focusContext, nodes.playbackRecoveryButton);
}

export function hidePlaybackFailureRecovery(nodes) {
  const focusContext = captureViewTransitionFocus(nodes, nodes.playbackErrorRecovery);
  nodes.playbackErrorRecovery.hidden = true;
  moveViewTransitionFocus(focusContext, nodes.previewStagePanel);
}
