export function hasOpenDialog(root) {
  return Boolean(root.querySelector("dialog[open]"));
}

export function closeOpenDialog(root, returnValue) {
  root.querySelector("dialog[open]")?.close(returnValue);
}

export function showDialog(dialog, onDialogStateChange = () => {}) {
  return new Promise((resolve) => {
    const handler = () => {
      dialog.removeEventListener("close", handler);
      onDialogStateChange();
      resolve(dialog.returnValue);
    };
    dialog.addEventListener("close", handler);
    dialog.showModal();
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
