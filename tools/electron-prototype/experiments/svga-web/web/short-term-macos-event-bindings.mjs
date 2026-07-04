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

function eventElement(event) {
  return event.target instanceof Element ? event.target : undefined;
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
    if (action === "back-preview") handlers.setMode("preview");
    if (action === "mode-preview") handlers.setMode("preview");
    if (action === "mode-edit") handlers.setMode("edit");
    if (action === "play-pause") handlers.togglePrimaryPlayback();
    if (action === "replay") handlers.replayPrimary();
    if (action === "run-optimization") handlers.runOptimization().catch(handlers.showFailure);
    if (action === "save-as") handlers.saveActiveOutput("saveAs").catch(handlers.showFailure);
    if (action === "save-overwrite") handlers.saveActiveOutput("overwrite").catch(handlers.showFailure);
    if (action === "open-compare-b") handlers.openCompareBFromHost().catch(handlers.showFailure);
    if (action === "select-resource") handlers.selectImageKey(target.dataset.imageKey || state.selectedImageKey);
    if (action === "row-menu") {
      const rect = target.getBoundingClientRect();
      handlers.openResourceContextMenu({
        clientX: rect.right,
        clientY: rect.bottom
      }, target.dataset.imageKey || state.selectedImageKey, target);
    }
    if (action === "select-text") handlers.selectTextKey(target.dataset.textKey || state.selectedTextKey);
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
    if (action === "edit-text") handlers.editRuntimeText().catch(handlers.showFailure);
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
    const row = eventElement(event)?.closest(".textElementRow[data-text-key]");
    if (!row) return;
    if (isActivationKey(event)) {
      consumeKeyboardEvent(event);
      handlers.selectTextKey(row.dataset.textKey);
    }
  });

  nodes.resourceContextMenu.addEventListener("keydown", handlers.handleResourceContextMenuKeydown);

  nodes.replacementFileInput.addEventListener("change", () => {
    handlers.applyReplacementFile(nodes.replacementFileInput.files?.[0]).catch(handlers.showFailure);
  });

  nodes.runtimeTextInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      nodes.textDialog.close("confirm");
    }
    if (event.key === "Escape") {
      event.preventDefault();
      nodes.textDialog.close("cancel");
    }
  });

  nodes.dropZone.addEventListener("dragover", (event) => {
    event.preventDefault();
    nodes.dropZone.classList.add("isDragOver");
  });

  nodes.dropZone.addEventListener("dragleave", () => nodes.dropZone.classList.remove("isDragOver"));
  nodes.dropZone.addEventListener("drop", (event) => {
    event.preventDefault();
    nodes.dropZone.classList.remove("isDragOver");
    handlers.loadDroppedFile(event.dataTransfer?.files?.[0]).catch(handlers.showFailure);
  });

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
    if (event.key === "Escape" && state.renameImageKey) handlers.cancelInlineRename();
    if (event.key === "Escape") handlers.closeResourceContextMenu({ restoreFocus: true });
  });
}
