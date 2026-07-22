import {
  consumeKeyboardEvent,
  isActivationKey,
  isContextMenuKey,
  isTextEditingTarget,
  shouldHandleGlobalPlaybackShortcut
} from "./short-term-macos-interaction-model.mjs";
import {
  closeOpenDialog,
  hasOpenDialog
} from "./short-term-macos-dialog-model.mjs";
import { nextAssetFilterForKey } from "./short-term-macos-overview-model.mjs";

function eventElement(event) {
  if (typeof Element !== "undefined" && event.target instanceof Element) return event.target;
  return event.target && typeof event.target.closest === "function" ? event.target : undefined;
}

export function handleAssetFilterTabsKeydown(event, state, handlers) {
  const eventTarget = eventElement(event);
  const target = eventTarget?.closest("[data-action='asset-filter']");
  if (!target) return false;
  const currentFilter = target.dataset.assetFilter || state.assetFilter || "all";
  const nextFilter = nextAssetFilterForKey(currentFilter, event.key);
  if (nextFilter === currentFilter) return false;
  consumeKeyboardEvent(event);
  handlers.setAssetFilter(nextFilter);
  return true;
}

function bindCanvasDragDecision(target, overlay, handlers) {
  if (!target || !overlay) return;
  target.addEventListener("dragover", (event) => {
    event.preventDefault();
    handlers.showCanvasDragDecision(event, target, overlay);
  });
  target.addEventListener("dragleave", (event) => {
    if (event.relatedTarget instanceof Node && target.contains(event.relatedTarget)) return;
    handlers.hideCanvasDragDecision();
  });
  target.addEventListener("drop", (event) => {
    event.preventDefault();
    handlers.dropCanvasFile(event, target, overlay).catch(handlers.showFailure);
  });
}

export function bindShortTermInteractionEvents({ documentRef = document, nodes, state, handlers }) {
  documentRef.addEventListener("click", (event) => {
    const eventTarget = eventElement(event);
    const target = eventTarget?.closest("[data-action]");
    if (!eventTarget?.closest("#resourceContextMenu")) handlers.closeResourceContextMenu();
    if (!target) return;
    const { action } = target.dataset;
    if (action === "open") handlers.openFromHostDialog().catch(handlers.showFailure);
    if (action === "open-recent") handlers.openRecentFromMenu(target.dataset.recentId).catch(handlers.showFailure);
    if (action === "clear-recent") handlers.clearRecentFiles().catch(handlers.showFailure);
    if (action === "compare") handlers.enterGeneralCompare().catch(handlers.showFailure);
    if (action === "open-settings") handlers.openSettings();
    if (action === "close-settings") handlers.closeSettings();
    if (action === "back-preview") handlers.setMode("preview");
    if (action === "mode-preview") handlers.setMode("preview");
    if (action === "mode-edit") handlers.setMode("edit");
    if (action === "play-pause") handlers.togglePrimaryPlayback();
    if (action === "replay") handlers.replayPrimary();
    if (action === "reload-playback") handlers.reloadPrimaryPlayback();
    if (action === "loop-toggle") handlers.togglePrimaryPlaybackLoop();
    if (action === "open-optimization") handlers.openTab("optimization");
    if (action === "close-optimization") handlers.openTab("overview");
    if (action === "asset-filter") handlers.setAssetFilter(target.dataset.assetFilter);
    if (action === "run-optimization") handlers.runOptimization().catch(handlers.showFailure);
    if (action === "discard-optimization") handlers.discardOptimizationResult();
    if (action === "save-as") handlers.saveActiveOutput("saveAs").catch(handlers.showFailure);
    if (action === "save-overwrite") handlers.saveActiveOutput("overwrite").catch(handlers.showFailure);
    if (action === "open-compare-a") handlers.openCompareAFromHost().catch(handlers.showFailure);
    if (action === "open-compare-b") handlers.openCompareBFromHost().catch(handlers.showFailure);
    if (action === "select-resource") handlers.selectImageKey(target.dataset.imageKey || state.selectedImageKey);
    if (action === "row-menu") {
      const rect = target.getBoundingClientRect();
      handlers.openResourceContextMenu({
        clientX: rect.right,
        clientY: rect.bottom
      }, target.dataset.imageKey || state.selectedImageKey, target);
    }
    if (action === "reset-image-preview") {
      handlers.resetImageReplacement(target.dataset.imageKey || state.selectedImageKey).catch(handlers.showFailure);
    }
    if (action === "select-text" && !eventTarget.closest("[data-text-input], [data-action='runtime-text-reset']")) {
      handlers.selectTextKey(target.dataset.textKey || state.selectedTextKey);
    }
    if (action === "runtime-text-reset") handlers.resetRuntimeText(target.dataset.textKey);
    if (action === "inline-rename-confirm") handlers.confirmInlineRename().catch(handlers.showFailure);
    if (action === "inline-rename-cancel") handlers.cancelInlineRename();
    if (action === "context-rename") {
      handlers.closeResourceContextMenu({ restoreFocus: true });
      handlers.renameSelectedImageKey().catch(handlers.showFailure);
    }
    if (action === "context-replace") {
      handlers.closeResourceContextMenu({ restoreFocus: true });
      handlers.chooseReplacementImage();
    }
    if (action === "context-reset") {
      handlers.closeResourceContextMenu({ restoreFocus: true });
      handlers.resetImageReplacement().catch(handlers.showFailure);
    }
    if (action === "edit-text") handlers.editRuntimeText();
    if (action === "reset-text") handlers.resetRuntimeText();
  });

  nodes.replaceableList.addEventListener("contextmenu", (event) => {
    const eventTarget = eventElement(event);
    if (eventTarget?.closest("[data-rename-input]")) return;
    const target = eventTarget?.closest(".replaceableRow");
    if (!target) return;
    event.preventDefault();
    handlers.openResourceContextMenu(event, target.dataset.imageKey, target);
  });

  nodes.replaceableList.addEventListener("keydown", (event) => {
    const eventTarget = eventElement(event);
    if (eventTarget?.matches("[data-text-input]")) return;
    if (eventTarget?.matches("[data-rename-input]")) {
      if (event.key === "Enter") {
        consumeKeyboardEvent(event);
        handlers.confirmInlineRename().catch(handlers.showFailure);
      }
      if (event.key === "Escape") {
        consumeKeyboardEvent(event);
        handlers.cancelInlineRename();
      }
      return;
    }
    if (eventTarget?.closest("button")) return;
    const row = eventTarget?.closest(".replaceableRow[data-image-key]");
    if (!row) return;
    if (isActivationKey(event)) {
      consumeKeyboardEvent(event);
      handlers.selectImageKey(row.dataset.imageKey);
    }
    if (isContextMenuKey(event)) {
      consumeKeyboardEvent(event);
      handlers.openKeyboardResourceContextMenu(row);
    }
  });

  nodes.textElementList.addEventListener("keydown", (event) => {
    const eventTarget = eventElement(event);
    if (eventTarget?.matches("[data-text-input]")) return;
    if (eventTarget?.closest("[data-action='runtime-text-reset']")) return;
    const row = eventTarget?.closest(".textElementRow[data-text-key]");
    if (!row) return;
    if (isActivationKey(event)) {
      consumeKeyboardEvent(event);
      handlers.selectTextKey(row.dataset.textKey);
    }
  });

  nodes.textElementList.addEventListener("focusin", (event) => {
    const input = eventElement(event)?.closest("[data-text-input]");
    if (!input) return;
    handlers.selectTextKey(input.dataset.textKey, { rerender: false });
  });

  nodes.textElementList.addEventListener("input", (event) => {
    const input = eventElement(event)?.closest("[data-text-input]");
    if (!input) return;
    handlers.updateRuntimeText(input.dataset.textKey, input.value, { liveInput: input });
  });

  nodes.replaceableList.addEventListener("focusin", (event) => {
    const input = eventElement(event)?.closest("[data-text-input]");
    if (!input) return;
    handlers.selectTextKey(input.dataset.textKey, { rerender: false });
  });

  nodes.replaceableList.addEventListener("input", (event) => {
    const input = eventElement(event)?.closest("[data-text-input]");
    if (!input) return;
    handlers.updateRuntimeText(input.dataset.textKey, input.value, { liveInput: input });
  });

  nodes.resourceContextMenu.addEventListener("keydown", handlers.handleResourceContextMenuKeydown);
  nodes.assetFilterTabs?.addEventListener("keydown", (event) => {
    handleAssetFilterTabsKeydown(event, state, handlers);
  });

  nodes.replacementFileInput.addEventListener("change", () => {
    handlers.applyReplacementFile(nodes.replacementFileInput.files?.[0]).catch(handlers.showFailure);
  });

  nodes.settingsDialog.addEventListener("change", (event) => {
    const input = eventElement(event)?.closest("[data-appearance-choice]");
    if (!input) return;
    handlers.setAppearance(input.value, { persist: true });
  });

  nodes.settingsDialog.addEventListener("close", handlers.renderCommandState);

  nodes.dropZone.addEventListener("dragover", (event) => {
    event.preventDefault();
    nodes.dropZone.classList.add("isDragOver");
  });

  nodes.dropZone.addEventListener("dragleave", () => nodes.dropZone.classList.remove("isDragOver"));
  nodes.dropZone.addEventListener("drop", (event) => {
    event.preventDefault();
    nodes.dropZone.classList.remove("isDragOver");
    handlers.dropCanvasFile(event, nodes.dropZone).catch(handlers.showFailure);
  });

  bindCanvasDragDecision(nodes.previewStagePanel, nodes.previewDragOverlay, handlers);
  bindCanvasDragDecision(nodes.compareStage, nodes.compareDragOverlay, handlers);

  documentRef.addEventListener("keydown", (event) => {
    const command = event.metaKey || event.ctrlKey;
    const textInput = isTextEditingTarget(event.target);
    if (hasOpenDialog(documentRef)) {
      if (event.key === "Escape") closeOpenDialog(documentRef, "cancel");
      return;
    }
    if (textInput && command && ["o", "r", "s"].includes(event.key.toLowerCase())) return;
    if (command && event.key.toLowerCase() === "o") {
      event.preventDefault();
      handlers.openFromHostDialog().catch(handlers.showFailure);
    }
    if (command && event.key.toLowerCase() === "r") {
      event.preventDefault();
      handlers.renameSelectedImageKey().catch(handlers.showFailure);
    }
    if (command && event.key.toLowerCase() === "s") {
      event.preventDefault();
      handlers.saveActiveOutput(event.shiftKey ? "saveAs" : "overwrite").catch(handlers.showFailure);
    }
    if (event.key === " " && shouldHandleGlobalPlaybackShortcut(event.target)) {
      event.preventDefault();
      handlers.togglePrimaryPlayback();
    }
    if (event.key === "Escape" && state.view === "compare") handlers.setMode("preview");
    if (event.key === "Escape" && state.view === "preview" && state.tab === "optimization") handlers.openTab("overview");
    if (event.key === "Escape" && state.renameImageKey) handlers.cancelInlineRename();
    if (event.key === "Escape") handlers.closeResourceContextMenu({ restoreFocus: true });
  });
}
