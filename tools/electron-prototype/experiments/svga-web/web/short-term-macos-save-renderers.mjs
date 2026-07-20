import { saveBannerView } from "./short-term-macos-feedback-model.mjs";

export function showSaveFeedbackBanner(node, title, message, tone) {
  const view = saveBannerView(title, message, tone);
  node.hidden = false;
  node.dataset.status = view.status;
  node.setAttribute("role", view.role);
  node.setAttribute("aria-live", view.ariaLive);
  node.setAttribute("aria-busy", view.ariaBusy);
  node.innerHTML = view.html;
  return view;
}

export function hideSaveFeedbackBanner(node) {
  node.hidden = true;
  node.setAttribute("aria-busy", "false");
}

export function clearSaveFeedbackBanner(node) {
  node.hidden = true;
  node.removeAttribute("data-status");
  node.removeAttribute("role");
  node.setAttribute("aria-live", "polite");
  node.setAttribute("aria-busy", "false");
}
