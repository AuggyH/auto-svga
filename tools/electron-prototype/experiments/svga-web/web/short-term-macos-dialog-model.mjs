export function hasOpenDialog(root) {
  return Boolean(root.querySelector("dialog[open]"));
}

export function closeOpenDialog(root, returnValue) {
  root.querySelector("dialog[open]")?.close(returnValue);
}

function connectedElement(element) {
  return element?.isConnected ? element : undefined;
}

function focusInitialDialogElement(dialog, initialFocus) {
  const focusTarget = connectedElement(initialFocus)
    || dialog.querySelector("[autofocus], input, textarea, select, button, [tabindex]:not([tabindex='-1'])");
  focusTarget?.focus({ preventScroll: true });
  focusTarget?.select?.();
}

export function showDialog(dialog, onDialogStateChange = () => {}, options = {}) {
  return new Promise((resolve) => {
    const returnFocus = connectedElement(options.returnFocus || document.activeElement);
    const handler = () => {
      dialog.removeEventListener("close", handler);
      onDialogStateChange();
      returnFocus?.focus({ preventScroll: true });
      resolve(dialog.returnValue);
    };
    dialog.addEventListener("close", handler);
    dialog.showModal();
    focusInitialDialogElement(dialog, options.initialFocus);
    onDialogStateChange();
  });
}

export async function confirmDiscardUnsavedOutput({
  hasActiveOutput,
  message,
  dialog,
  renderMessage,
  onDialogStateChange
}) {
  if (!hasActiveOutput) return true;
  renderMessage(message);
  return (await showDialog(dialog, onDialogStateChange)) === "confirm";
}
