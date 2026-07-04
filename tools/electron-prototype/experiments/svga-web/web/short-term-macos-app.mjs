import { collectShortTermNodes } from "./short-term-macos-nodes.mjs";
import { bindShortTermInteractionEvents } from "./short-term-macos-event-bindings.mjs";
import { installShortTermActionBridge } from "./short-term-macos-action-bridge.mjs";
import { createShortTermInitialState } from "./short-term-macos-state.mjs";
import { createShortTermAppController } from "./short-term-macos-controller.mjs";
import { runShortTermSmokeIfRequested } from "./short-term-macos-smoke-runner.mjs";

const bridge = globalThis.autoSvgaElectronHost;
const state = createShortTermInitialState();
const nodes = collectShortTermNodes();
const controller = createShortTermAppController({ bridge, nodes, state });

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
runShortTermSmokeIfRequested({
  bridge,
  nodes,
  state,
  ...controller.handlers
}).catch(() => {});
