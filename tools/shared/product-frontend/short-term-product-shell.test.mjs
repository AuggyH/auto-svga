import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");

async function readRepoFile(filePath) {
  return readFile(path.join(repoRoot, filePath), "utf8");
}

test("short-term product shell exposes the corrected S1-S15 app structure", async () => {
  const [shell, app, styles, entryHtml, entryScript] = await Promise.all([
    readRepoFile("tools/shared/product-frontend/short-term-product-shell.html"),
    readRepoFile("tools/shared/product-frontend/short-term-product-app.mjs"),
    readRepoFile("tools/shared/product-frontend/short-term-product-styles.css"),
    readRepoFile("tools/short-term-ui-preview/index.html"),
    readRepoFile("tools/short-term-ui-preview/main.js")
  ]);

  assert.match(shell, /data-product-shell-variant="short-term"/);
  assert.match(shell, /data-component="WindowToolbar"/);
  assert.match(shell, /data-module="MenuBarCommandModel"/);
  assert.match(shell, /data-page-state="Launch"/);
  assert.match(shell, /data-page-state="Loading"/);
  assert.match(shell, /data-page-state="Load failed"/);
  assert.match(shell, /data-page-state="Preview ready"/);
  assert.match(shell, /data-page-state="Optimization comparing"/);
  assert.match(shell, /data-page-state="General comparing"/);
  assert.match(shell, /data-page-state="Edit reserved"/);

  for (const prdId of ["S1", "S2", "S3", "S4", "S5", "S6", "S7", "S8", "S9", "S10", "S11", "S12", "S13", "S14", "S15"]) {
    assert.match(shell, new RegExp(prdId));
  }

  for (const component of [
    "PreviewStage",
    "RightTabPanel",
    "ProductionSpecRow",
    "AssetRow",
    "SequenceThumbnail",
    "AudioAssetRow",
    "ReplaceableImageRow",
    "ReplaceableTextRow",
    "OptimizationFindingRow",
    "OptimizationResultCard",
    "ComparePreviewCard",
    "TextReplacementSheet",
    "SaveStateModule"
  ]) {
    assert.match(shell, new RegExp(component));
  }

  for (const forbidden of ["导出验收", "Export Acceptance", "Sequence Repair", "Batch Replacement", "AI Generation", "settingsButton", "themeToggleButton"]) {
    assert.doesNotMatch(shell, new RegExp(forbidden));
  }

  assert.match(app, /startLoading/);
  assert.match(app, /startOptimizationCompare/);
  assert.match(app, /finishSave/);
  assert.match(app, /failSave/);
  assert.match(app, /mode-edit/);
  assert.match(app, /key\.toLowerCase\(\) === "r"/);
  assert.match(app, /key\.toLowerCase\(\) === "s"/);
  assert.match(app, /event\.key === " "/);

  assert.match(styles, /--asv-color-window/);
  assert.match(styles, /--asv-color-toolbar/);
  assert.match(styles, /--asv-color-panel/);
  assert.match(styles, /prefers-reduced-motion/);
  assert.match(styles, /\[hidden\]/);

  assert.match(entryHtml, /short-term-product-shell\.html/);
  assert.match(entryHtml, /short-term-product-styles\.css/);
  assert.match(entryScript, /mountProductShell/);
  assert.match(entryScript, /short-term-product-app\.mjs/);
});
