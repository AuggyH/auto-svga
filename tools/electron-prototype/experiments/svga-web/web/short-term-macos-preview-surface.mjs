import {
  renderAssetList,
  renderOverviewFacts
} from "./short-term-macos-overview-renderers.mjs";
import { overviewTabView } from "./short-term-macos-overview-model.mjs";
import { renderFileHeader } from "./short-term-macos-state-renderers.mjs";
import {
  renderEditReservedLayers
} from "./short-term-macos-edit-reserved-renderers.mjs";
import { editReservedLayerListView } from "./short-term-macos-edit-reserved-model.mjs";
import { renderShortTermOptimization } from "./short-term-macos-optimization-surface.mjs";
import {
  renderShortTermReplaceableImages,
  renderShortTermRuntimeTextElements
} from "./short-term-macos-replaceable-surface.mjs";

export function renderShortTermPreviewModel({ nodes, state }) {
  const model = state.model;
  if (!model) return;
  const overviewView = overviewTabView(model);
  renderFileHeader(nodes, state.displayName, overviewView.playbackMeta);
  renderOverviewFacts(nodes, overviewView);
  renderAssetList(nodes, overviewView, model);
  renderShortTermOptimization({ nodes, model: model.optimization });
  renderShortTermReplaceableImages({
    nodes,
    state,
    model: model.replaceableElements
  });
  renderShortTermRuntimeTextElements({
    nodes,
    state,
    model: model.replaceableElements
  });
  renderShortTermEditReserved({ nodes, state });
}

export function renderShortTermEditReserved({ nodes, state }) {
  renderEditReservedLayers(nodes, editReservedLayerListView(state.model), state.model);
}
