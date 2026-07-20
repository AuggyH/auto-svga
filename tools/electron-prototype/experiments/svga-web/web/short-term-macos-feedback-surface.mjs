import {
  buildCurrentStateSummary,
  SHORT_TERM_LOAD_FAILURE_COPY,
  sourceUnmodifiedMessage
} from "./short-term-macos-feedback-model.mjs";
import {
  clearSaveFeedbackBanner,
  hideSaveFeedbackBanner,
  showSaveFeedbackBanner
} from "./short-term-macos-save-renderers.mjs";
import {
  captureViewTransitionFocus,
  moveViewTransitionFocus,
  renderFailureMessage
} from "./short-term-macos-state-renderers.mjs";

export function showShortTermSaveBanner({ nodes, title, message, tone }) {
  showSaveFeedbackBanner(nodes.saveBanner, title, message, tone);
}

export function hideShortTermSaveBanner(nodes) {
  hideSaveFeedbackBanner(nodes.saveBanner);
}

export function clearShortTermSaveBanner(nodes) {
  clearSaveFeedbackBanner(nodes.saveBanner);
}

export function showShortTermFailure({ nodes, setView }) {
  const focusContext = captureViewTransitionFocus(nodes);
  renderFailureMessage(nodes, SHORT_TERM_LOAD_FAILURE_COPY);
  setView("failed");
  moveViewTransitionFocus(focusContext, nodes.failureRecoveryButton);
}

export function showShortTermOperationFailure({ nodes, state, setMode, renderCommandState }, title) {
  if (state.sourceBytes && !["preview", "compare", "edit"].includes(state.view)) {
    setMode("preview");
  }
  showShortTermSaveBanner({
    nodes,
    title,
    message: sourceUnmodifiedMessage()
  });
  state.saveStatus = state.activeOutput ? "dirty" : "idle";
  renderCommandState();
}

export function shortTermCurrentStateSummary({ nodes, state }) {
  return buildCurrentStateSummary({
    view: state.view,
    displayName: state.displayName,
    playbackMeta: nodes.playbackMeta.textContent,
    activeOutput: state.activeOutput,
    saveBannerVisible: !nodes.saveBanner.hidden,
    saveBannerText: nodes.saveBanner.textContent,
    errorVisible: state.view === "failed",
    errorText: nodes.errorMessage.textContent
  });
}
