import { suffixName } from "./short-term-macos-render-model.mjs";

export function saveProofImageKey(fromImageKey, suffix) {
  const clean = String(fromImageKey || "image_key")
    .replace(/[\u0000-\u001F\u007F/\\]/gu, "_")
    .replace(/[^A-Za-z0-9_.-]/g, "_")
    .slice(0, 64) || "image_key";
  return `${clean}_${suffix}`;
}

export function saveProofSourceImageKey({ selectedImageKey, model }) {
  return selectedImageKey
    || model?.replaceableElements?.images?.[0]?.imageKey
    || model?.assets?.find((asset) => asset.kind === "image")?.name
    || "";
}

export function createSaveFailureProofActiveOutput(displayName) {
  return {
    kind: "rename",
    bytes: new Uint8Array([0, 1, 2, 3, 4]),
    suggestedName: suffixName(displayName || "save-failure", "invalid"),
    title: "保存失败验证输出",
    summary: "保存后重开验证应失败，当前源文件保持不变。"
  };
}
