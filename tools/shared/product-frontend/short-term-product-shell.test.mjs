import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");

async function readRepoFile(filePath) {
  return readFile(path.join(repoRoot, filePath), "utf8");
}

test("short-term product shell exposes the corrected S1-S16 app structure", async () => {
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
  assert.match(shell, /data-component="LaunchDropCanvas"/);
  assert.match(shell, /data-component="LaunchRecentFilesList"/);
  assert.match(shell, /data-component="FileMenu"/);
  assert.match(shell, /data-component="FileRecentSubmenu"/);
  assert.match(shell, /data-component="FileRecentSubmenu" data-prd="S16"/);
  assert.match(shell, /id="asvFileRecent" aria-haspopup="menu">Recent<\/button>/);
  assert.match(shell, /id="asvFileRecentList"/);
  assert.match(shell, /id="asvLaunchRecentList"/);
  assert.match(shell, /id="asvRecentStatus" aria-live="polite"/);
  assert.match(shell, /data-action="clear-recent"/);
  assert.doesNotMatch(shell, /id="asvFileRecent">file-recent<\/p>/);
  assert.doesNotMatch(shell, /data-product-change="pending-product-manager-confirmation"/);
  assert.doesNotMatch(shell, /<li><button type="button" data-action="open">.*?\.svga<\/button><span>/);
  assert.doesNotMatch(shell, /<button type="button" data-action="open" role="menuitem">.*?\.svga<\/button>/);
  assert.doesNotMatch(shell, /asvLaunchWorkspace/);
  assert.doesNotMatch(shell, /打开本地 SVGA 文件/);
  assert.doesNotMatch(shell, /选择文件或拖入窗口后进入预览/);
  assert.doesNotMatch(shell, /显示无效文件/);

  for (const prdId of ["S1", "S2", "S3", "S4", "S5", "S6", "S7", "S8", "S9", "S10", "S11", "S12", "S13", "S14", "S15", "S16"]) {
    assert.match(shell, new RegExp(prdId));
  }

  for (const component of [
    "PreviewStage",
    "RightTabPanel",
    "ProductionSpecInlineRow",
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
  assert.doesNotMatch(shell, /id="asvIdentity"/);
  assert.doesNotMatch(shell, /id="asvPlaybackStatus"/);
  assert.doesNotMatch(shell, /id="asvPreviewNote"/);
  assert.doesNotMatch(shell, />Preview mode</);
  assert.doesNotMatch(shell, /<h3>生产规格<\/h3>/);
  assert.match(shell, /data-component="SegmentedModeSwitch"[\s\S]*data-action="compare"/);
  assert.match(shell, /data-action="run-all-optimizations"/);
  assert.match(shell, /一键优化只执行可安全执行项/);
  assert.match(shell, /暂不支持\/建议项/);
  assert.match(shell, /class="asvSpecStatus">通过<\/span>规格 &lt; 1 MB/);

  assert.match(app, /startLoading/);
  assert.match(app, /startOptimizationCompare/);
  assert.match(app, /run-all-optimizations/);
  assert.match(app, /recentFiles: getInitialRecentFiles\(\)/);
  assert.match(app, /renderLaunchRecentFiles/);
  assert.match(app, /renderMenuRecentFiles/);
  assert.match(app, /slice\(0, 5\)/);
  assert.match(app, /slice\(0, 10\)/);
  assert.match(app, /case "open-recent"/);
  assert.match(app, /case "clear-recent"/);
  assert.match(app, /missing: true/);
  assert.match(app, /不展示完整本地路径/);
  assert.match(app, /需复核和暂不支持项未进入批量/);
  assert.match(app, /重试播放/);
  assert.match(app, /finishSave/);
  assert.match(app, /failSave/);
  assert.match(app, /mode-edit/);
  assert.match(app, /key\.toLowerCase\(\) === "r"/);
  assert.match(app, /key\.toLowerCase\(\) === "s"/);
  assert.match(app, /event\.key === " "/);

  assert.match(styles, /--asv-color-window/);
  assert.match(styles, /--asv-color-toolbar/);
  assert.match(styles, /--asv-color-panel/);
  assert.match(styles, /--asv-type-family/);
  assert.match(styles, /--asv-font-size-body/);
  assert.match(styles, /--asv-control-height/);
  assert.match(styles, /--asv-row-height/);
  assert.match(styles, /--asv-thumb-size/);
  assert.match(styles, /--asv-shadow-menu/);
  assert.match(styles, /--asv-focus-ring/);
  assert.match(styles, /--asv-checker-size/);
  assert.match(styles, /--asv-modal-backdrop/);
  assert.match(styles, /font-family: var\(--asv-type-family\)/);
  assert.match(styles, /box-shadow: var\(--asv-focus-ring\)/);
  assert.match(styles, /\.asvMenuBar \{[\s\S]*z-index: 30/);
  assert.match(styles, /\.asvToolbar \{[\s\S]*z-index: 10/);
  assert.match(styles, /\.asvToolbarButton \{[\s\S]*--asv-toolbar-control-height/);
  assert.match(styles, /\.asvSubMenuDropdown \{/);
  assert.match(styles, /\.asvSubMenu:hover \.asvSubMenuDropdown/);
  assert.match(styles, /\.asvMenuRecentList \{/);
  assert.match(styles, /\.asvTabs \{[\s\S]*background: var\(--asv-color-control-recessed\)/);
  assert.match(styles, /\.asvFactGrid div:hover/);
  assert.match(styles, /grid-template-columns: var\(--asv-thumb-size\) minmax\(0, 1fr\) auto auto auto/);
  assert.match(styles, /\.asvRecentFiles ol \{[\s\S]*grid-template-columns: minmax\(0, 1fr\)/);
  assert.match(styles, /\.asvRecentFiles \{[\s\S]*padding: 0/);
  assert.match(styles, /\.asvRecentFiles li \+ li \{/);
  assert.doesNotMatch(styles, /\.asvRecentFiles \{[^}]*border:/);
  assert.match(styles, /\.asvRecentFiles button \{[\s\S]*white-space: nowrap/);
  assert.match(styles, /\.asvRecentStatus/);
  assert.match(styles, /\.asvSectionTitle/);
  assert.match(styles, /\.asvFindingActions/);
  assert.match(styles, /prefers-reduced-motion/);
  assert.match(styles, /\[hidden\]/);

  assert.match(entryHtml, /short-term-product-shell\.html/);
  assert.match(entryHtml, /short-term-product-styles\.css/);
  assert.match(entryScript, /mountProductShell/);
  assert.match(entryScript, /short-term-product-app\.mjs/);
});
