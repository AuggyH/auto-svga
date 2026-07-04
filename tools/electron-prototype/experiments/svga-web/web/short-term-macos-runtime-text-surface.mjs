import { showDialog } from "./short-term-macos-dialog-model.mjs";
import {
  runtimeTextInputValue,
  runtimeTextOverlayCopy,
  runtimeTextPlaceholder
} from "./short-term-macos-text-model.mjs";
import {
  applyRuntimeTextOverlay,
  clearRuntimeTextOverlay
} from "./short-term-macos-text-renderers.mjs";

export async function editShortTermRuntimeTextPreview({
  nodes,
  state,
  textElement,
  showSaveBanner,
  renderTextElements,
  renderCommandState
}) {
  if (!state.sourceBytes) return;
  if (!textElement) {
    showSaveBanner("没有可预览的文本元素。", "当前文件没有暴露可运行时替换的文本标识，源文件没有被修改。");
    return;
  }
  nodes.runtimeTextInput.value = runtimeTextInputValue(state.textPreview);
  nodes.runtimeTextInput.placeholder = runtimeTextPlaceholder(textElement);
  const result = await showDialog(nodes.textDialog, renderCommandState, {
    initialFocus: nodes.runtimeTextInput
  });
  if (result !== "confirm") return;
  state.textPreview = nodes.runtimeTextInput.value.trim();
  applyRuntimeTextOverlay(
    nodes.runtimeTextOverlay,
    runtimeTextOverlayCopy(textElement, state.textPreview),
    Boolean(state.textPreview)
  );
  renderTextElements(state.model?.replaceableElements);
  renderCommandState();
}

export function resetShortTermRuntimeTextPreview({
  nodes,
  state,
  renderTextElements,
  renderCommandState
}) {
  state.textPreview = "";
  clearRuntimeTextOverlay(nodes.runtimeTextOverlay);
  renderTextElements(state.model?.replaceableElements);
  renderCommandState();
}
