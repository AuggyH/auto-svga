import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const experimentRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const repoRoot = path.resolve(experimentRoot, "../../../..");
const webRoot = path.join(experimentRoot, "web");

const expectedStyleOrder = [
  "./short-term-macos.tokens.css",
  "./short-term-macos.atoms.css",
  "./short-term-macos.molecules.css",
  "./short-term-macos.components.css",
  "./short-term-macos.modules.css",
  "./short-term-macos.page-states.css",
  "./short-term-macos.css"
];

const cssRawDimensionDebtLimit = new Map([
  ["short-term-macos.atoms.css", 12],
  ["short-term-macos.components.css", 18],
  ["short-term-macos.css", 2],
  ["short-term-macos.modules.css", 29],
  ["short-term-macos.molecules.css", 9],
  ["short-term-macos.page-states.css", 18]
]);

const allowedDynamicDomModules = new Set([
  "short-term-macos-compare-renderers.mjs",
  "short-term-macos-dom-renderers.mjs",
  "short-term-macos-launch-renderers.mjs"
]);

const allowedDataComponents = new Set([
  "WindowToolbar",
  "LaunchDropCanvas",
  "LaunchRecentFilesList",
  "FileRecentSubmenu",
  "PreviewStage",
  "PlaybackControls",
  "RightTabPanel",
  "OverviewFactRow",
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
  "SaveFeedbackBanner",
  "ErrorRecoveryPanel",
  "LayerRow",
  "ReservedOperationPanel",
  "ToolbarButton",
  "IconButton",
  "SegmentedModeSwitch",
  "TabItem",
  "FactCell",
  "SpecStatusCell",
  "InlineStatus",
  "FileDropTarget",
  "PlaybackButtonGroup",
  "ContextMenuItem",
  "RenameInput",
  "SaveButtonPair"
]);

const allowedModules = new Set([
  "LaunchModule",
  "PreviewCanvasModule",
  "OverviewTabModule",
  "OptimizationTabModule",
  "ReplaceableElementsTabModule",
  "GeneralCompareModule",
  "OptimizationCompareModule",
  "EditReservedModule",
  "MenuBarCommandModel",
  "SaveStateModule"
]);

const requiredPageStates = [
  "Launch",
  "Loading",
  "Load failed",
  "Preview ready",
  "General comparing",
  "Edit reserved"
];

const failures = [];
const checks = [];

function record(name, passed, details = {}) {
  checks.push({ name, passed, ...details });
  if (!passed) failures.push({ name, ...details });
}

function lineNumber(text, offset) {
  return text.slice(0, offset).split("\n").length;
}

function collectAttributeValues(source, attributeName) {
  return [...source.matchAll(new RegExp(`${attributeName}="([^"]+)"`, "g"))].map((match) => match[1]);
}

function countRawDimensions(source) {
  return (source.match(/\b(?:\d*\.)?\d+(?:px|rem|em|vh|vw|ms|s)\b/g) ?? []).length;
}

function collectRawColors(source) {
  return [...source.matchAll(/#[0-9a-fA-F]{3,8}|rgba?\(/g)].map((match) => ({
    value: match[0],
    line: lineNumber(source, match.index ?? 0)
  }));
}

function collectDynamicDomUsage(source) {
  const matches = [];
  const patterns = [
    "document.createElement",
    ".innerHTML",
    "insertAdjacentHTML",
    ".className =",
    "setAttribute(\"role\"",
    "setAttribute('role'"
  ];
  for (const pattern of patterns) {
    let index = source.indexOf(pattern);
    while (index >= 0) {
      matches.push({ pattern, line: lineNumber(source, index) });
      index = source.indexOf(pattern, index + pattern.length);
    }
  }
  return matches;
}

async function main() {
  const page = await readFile(path.join(webRoot, "index.html"), "utf8");
  const designManifest = await readFile(path.join(repoRoot, "DESIGN.md"), "utf8");
  const executionPlan = await readFile(path.join(repoRoot, "docs/product/SHORT_TERM_UI_UX_REDESIGN_EXECUTION_PLAN.md"), "utf8");

  const styleOrder = [...page.matchAll(/<link rel="stylesheet" href="([^"]+)">/g)].map((match) => match[1]);
  record("stylesheet-order", JSON.stringify(styleOrder) === JSON.stringify(expectedStyleOrder), {
    expected: expectedStyleOrder,
    actual: styleOrder
  });

  const dataComponents = [...new Set(collectAttributeValues(page, "data-component"))].sort();
  const unknownComponents = dataComponents.filter((name) => !allowedDataComponents.has(name));
  record("html-data-components-are-canonical", unknownComponents.length === 0, {
    unknownComponents,
    componentCount: dataComponents.length
  });

  const dataModules = [...new Set(collectAttributeValues(page, "data-module"))].sort();
  const unknownModules = dataModules.filter((name) => !allowedModules.has(name));
  record("html-data-modules-are-canonical", unknownModules.length === 0, {
    unknownModules,
    moduleCount: dataModules.length
  });

  const pageStates = [...new Set(collectAttributeValues(page, "data-page-state"))];
  const missingPageStates = requiredPageStates.filter((state) => !pageStates.includes(state));
  record("required-page-state-trace", missingPageStates.length === 0, {
    missingPageStates,
    pageStateCount: pageStates.length
  });

  const cssFiles = (await readdir(webRoot))
    .filter((file) => file.startsWith("short-term-macos") && file.endsWith(".css"))
    .sort();
  for (const cssFile of cssFiles) {
    const source = await readFile(path.join(webRoot, cssFile), "utf8");
    if (cssFile !== "short-term-macos.tokens.css") {
      const rawColors = collectRawColors(source);
      record(`no-raw-color-outside-tokens:${cssFile}`, rawColors.length === 0, { rawColors });
      const rawDimensionCount = countRawDimensions(source);
      const limit = cssRawDimensionDebtLimit.get(cssFile) ?? 0;
      record(`raw-dimension-debt-not-increased:${cssFile}`, rawDimensionCount <= limit, {
        rawDimensionCount,
        limit
      });
    }
  }

  const atoms = await readFile(path.join(webRoot, "short-term-macos.atoms.css"), "utf8");
  const molecules = await readFile(path.join(webRoot, "short-term-macos.molecules.css"), "utf8");
  const components = await readFile(path.join(webRoot, "short-term-macos.components.css"), "utf8");
  const modules = await readFile(path.join(webRoot, "short-term-macos.modules.css"), "utf8");
  const pageStatesCss = await readFile(path.join(webRoot, "short-term-macos.page-states.css"), "utf8");
  const baseCss = await readFile(path.join(webRoot, "short-term-macos.css"), "utf8");

  record("focus-visible-covered-by-ui-layers", [atoms, molecules, components, modules].every((source) => source.includes(":focus-visible")));
  record("reduced-motion-covered", /@media \(prefers-reduced-motion: reduce\)/.test(pageStatesCss)
    && /animation-duration:\s*1ms !important/.test(pageStatesCss)
    && /transition-duration:\s*1ms !important/.test(pageStatesCss));
  record("minimum-window-boundary-explicit", /min-width:\s*1060px/.test(baseCss)
    && /min-height:\s*720px/.test(baseCss)
    && /@media \(max-width: 1080px\)/.test(pageStatesCss)
    && /@media \(max-height: 780px\)/.test(pageStatesCss));

  const mjsFiles = (await readdir(webRoot))
    .filter((file) => file.startsWith("short-term-macos") && file.endsWith(".mjs"))
    .sort();
  for (const mjsFile of mjsFiles) {
    const source = await readFile(path.join(webRoot, mjsFile), "utf8");
    const dynamicDomUsage = collectDynamicDomUsage(source);
    record(`visible-dom-owned-by-render-modules:${mjsFile}`, allowedDynamicDomModules.has(mjsFile) || dynamicDomUsage.length === 0, {
      dynamicDomUsage
    });
  }

  record("foreground-validation-rule-documented", /Foreground Desktop Evidence/.test(designManifest)
    && /Automated smoke screenshots and smoke reports are regression evidence/.test(designManifest)
    && /Foreground macOS Validation Gate/.test(executionPlan)
    && /Automated smoke evidence is regression evidence only/.test(executionPlan)
    && /auto-svga测试物料/.test(executionPlan));

  const report = {
    proofId: "short-term-design-system-check",
    passed: failures.length === 0,
    checkedAt: new Date().toISOString(),
    checks
  };

  console.log(JSON.stringify(report, null, 2));
  if (failures.length > 0) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack : String(error));
  process.exitCode = 1;
});
