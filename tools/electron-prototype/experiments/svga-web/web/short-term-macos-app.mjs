import { collectShortTermNodes } from "./short-term-macos-nodes.mjs";
import { bindShortTermInteractionEvents } from "./short-term-macos-event-bindings.mjs";
import { installShortTermActionBridge } from "./short-term-macos-action-bridge.mjs";
import { createShortTermInitialState } from "./short-term-macos-state.mjs";
import { createShortTermAppController } from "./short-term-macos-controller.mjs";
import { runShortTermSmokeIfRequested } from "./short-term-macos-smoke-runner.mjs";

const bridge = globalThis.autoSvgaElectronHost;
const state = createShortTermInitialState();
const nodes = collectShortTermNodes();
const multiFormatModule = bridge?.productMilestoneId === "0.2-multiformat-preview" ? await import("./multiformat-desktop-preview-controller.mjs") : undefined;
const svgaController = createShortTermAppController({ bridge, nodes, state });
const controller = multiFormatModule
  ? multiFormatModule.createMultiFormatDesktopPreviewController({ bridge, nodes, state, svgaController })
  : svgaController;

bindShortTermInteractionEvents({
  nodes,
  state,
  handlers: controller.handlers
});

installShortTermActionBridge({
  bridge,
  state,
  handlers: controller.handlers
});

controller.initialize();
await bridge?.notifyMultiFormatRendererReady?.();

if (bridge?.productMilestoneId !== "0.2-multiformat-preview") {
  runShortTermSmokeIfRequested({
    bridge,
    nodes,
    state,
    ...controller.handlers
  }).catch(() => {});
}
