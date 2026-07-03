import { saveBannerView } from "./short-term-macos-feedback-model.mjs";

export function showSaveFeedbackBanner(node, title, message, tone) {
  const view = saveBannerView(title, message, tone);
  node.hidden = false;
  node.dataset.status = view.status;
  node.innerHTML = view.html;
  return view;
}

export function hideSaveFeedbackBanner(node) {
  node.hidden = true;
}

export function clearSaveFeedbackBanner(node) {
  node.hidden = true;
  node.removeAttribute("data-status");
}
