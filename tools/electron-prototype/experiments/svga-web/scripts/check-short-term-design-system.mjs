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
  "short-term-macos-edit-reserved-renderers.mjs",
  "short-term-macos-inline-status-renderers.mjs",
  "short-term-macos-launch-renderers.mjs",
  "short-term-macos-optimization-renderers.mjs",
  "short-term-macos-overview-renderers.mjs",
  "short-term-macos-replaceable-renderers.mjs",
  "short-term-macos-save-renderers.mjs"
]);

const allowedDataComponents = new Set([
  "WindowChrome",
  "LaunchDropCanvas",
  "LaunchRecentFilesList",
  "FileRecentSubmenu",
  "PreviewStage",
  "PlaybackControls",
  "RightInformationSurface",
  "OverviewFactRow",
  "ProductionSpecInlineRow",
  "MetricOptimizationEntry",
  "AssetRow",
  "SequenceThumbnail",
  "AudioAssetRow",
  "ReplaceableImageRow",
  "ReplaceableTextRow",
  "OptimizationFindingRow",
  "OptimizationResultCard",
  "CompareCanvasSurface",
  "ComparePreviewCard",
  "InlineTextReplacementInput",
  "SettingsSheet",
  "ThemeSegmentedControl",
  "SaveFeedbackBanner",
  "ErrorRecoveryPanel",
  "LayerRow",
  "ReservedOperationPanel",
  "ToolbarButton",
  "IconButton",
  "CanvasModeSwitch",
  "FactCell",
  "SpecStatusCell",
  "InlineStatus",
  "FileDropTarget",
  "DragDecisionOverlay",
  "CanvasToast",
  "PlaybackButtonGroup",
  "ContextMenuItem",
  "RenameInput",
  "SaveButtonPair"
]);

const allowedModules = new Set([
  "LaunchModule",
  "PreviewCanvasModule",
  "OverviewInformationModule",
  "OptimizationDetailSurface",
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

const expectedAppEntryImports = [
  "./short-term-macos-nodes.mjs",
  "./short-term-macos-event-bindings.mjs",
  "./short-term-macos-action-bridge.mjs",
  "./short-term-macos-state.mjs",
  "./short-term-macos-controller.mjs",
  "./short-term-macos-smoke-runner.mjs"
];

const disallowedLaunchCopyPatterns = [
  /本地预览/,
  /不上传/,
  /仅显示文件名/,
  /父级位置/
];

const disallowedLegacySurfaceCopyPatterns = [
  /检查器/,
  /检查面板/,
  /检查标签/,
  /工作台/,
  /\bInspector\b/,
  /\bWorkbench\b/
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

function collectPatternViolations(file, source, patterns) {
  const violations = [];
  for (const pattern of patterns) {
    const flags = pattern.flags.includes("g") ? pattern.flags : `${pattern.flags}g`;
    const globalPattern = new RegExp(pattern.source, flags);
    for (const match of source.matchAll(globalPattern)) {
      violations.push({
        file,
        pattern: pattern.source,
        line: lineNumber(source, match.index ?? 0)
      });
    }
  }
  return violations;
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function collectMissingTokenValues(source, expectedTokens) {
  const missing = [];
  for (const [name, expectedValue] of expectedTokens) {
    const pattern = new RegExp(`${escapeRegExp(name)}:\\s*${escapeRegExp(expectedValue)};`);
    if (!pattern.test(source)) {
      missing.push({ name, expectedValue });
    }
  }
  return missing;
}

async function main() {
  const page = await readFile(path.join(webRoot, "index.html"), "utf8");
  const appEntry = await readFile(path.join(webRoot, "short-term-macos-app.mjs"), "utf8");
  const launchRenderer = await readFile(path.join(webRoot, "short-term-macos-launch-renderers.mjs"), "utf8");
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

  const launchCopySources = [page, launchRenderer].join("\n");
  const disallowedLaunchCopy = disallowedLaunchCopyPatterns
    .filter((pattern) => pattern.test(launchCopySources))
    .map((pattern) => pattern.source);
  record("launch-page-copy-stays-minimal", disallowedLaunchCopy.length === 0
    && /<p>拖拽文件到此处<\/p>/.test(page)
    && /<button class="largeOpenButton"[^>]*>[\s\S]*?<span>打开文件<\/span>[\s\S]*?<\/button>/.test(page)
    && /<p class="recentNote" id="recentNote" hidden><\/p>/.test(page), {
    disallowedLaunchCopy
  });

  const shortTermMjsFiles = (await readdir(webRoot))
    .filter((file) => file.startsWith("short-term-macos") && file.endsWith(".mjs"))
    .sort();
  const visibleSurfaceFiles = ["index.html", ...shortTermMjsFiles];
  const legacySurfaceCopyViolations = [];
  for (const file of visibleSurfaceFiles) {
    const source = file === "index.html" ? page : await readFile(path.join(webRoot, file), "utf8");
    legacySurfaceCopyViolations.push(...collectPatternViolations(file, source, disallowedLegacySurfaceCopyPatterns));
  }
  record("visible-surface-avoids-legacy-workbench-and-inspector-language", legacySurfaceCopyViolations.length === 0, {
    legacySurfaceCopyViolations
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
  const tokens = await readFile(path.join(webRoot, "short-term-macos.tokens.css"), "utf8");
  const molecules = await readFile(path.join(webRoot, "short-term-macos.molecules.css"), "utf8");
  const components = await readFile(path.join(webRoot, "short-term-macos.components.css"), "utf8");
  const modules = await readFile(path.join(webRoot, "short-term-macos.modules.css"), "utf8");
  const pageStatesCss = await readFile(path.join(webRoot, "short-term-macos.page-states.css"), "utf8");
  const baseCss = await readFile(path.join(webRoot, "short-term-macos.css"), "utf8");

  record("focus-visible-covered-by-ui-layers", [atoms, molecules, components, modules].every((source) => source.includes(":focus-visible")));
  record("reduced-motion-covered", /@media \(prefers-reduced-motion: reduce\)/.test(pageStatesCss)
    && /animation-duration:\s*1ms !important/.test(pageStatesCss)
    && /transition-duration:\s*1ms !important/.test(pageStatesCss));
  record("reduced-transparency-covered", /@media \(prefers-reduced-transparency: reduce\)/.test(pageStatesCss)
    && /--asv-effect-titlebar-backdrop-filter:\s*none/.test(pageStatesCss)
    && /--asv-effect-menu-backdrop-filter:\s*none/.test(pageStatesCss)
    && /--asv-effect-drag-overlay-backdrop-filter:\s*none/.test(pageStatesCss)
    && /\.titlebar,\s*\.contextMenu,\s*\.dragDecisionOverlay\s*\{[\s\S]*backdrop-filter:\s*none/.test(pageStatesCss)
    && /backdrop-filter:\s*var\(--asv-effect-menu-backdrop-filter\)/.test(components)
    && /backdrop-filter:\s*var\(--asv-drag-overlay-backdrop-filter\)/.test(modules));
  record("minimum-window-boundary-explicit", /min-width:\s*1060px/.test(baseCss)
    && /min-height:\s*720px/.test(baseCss)
    && /@media \(max-width: 1080px\)/.test(pageStatesCss)
    && /@media \(max-height: 780px\)/.test(pageStatesCss));

  const figmaR2FoundationTokens = new Map([
    ["--asv-base-neutral-0", "#ffffff"],
    ["--asv-base-neutral-50", "#f8f8f8"],
    ["--asv-base-neutral-100", "#f0f0f0"],
    ["--asv-base-neutral-150", "#e8e8e8"],
    ["--asv-base-neutral-200", "#e0e0e0"],
    ["--asv-base-neutral-300", "#c4c4c4"],
    ["--asv-base-neutral-400", "#a0a0a0"],
    ["--asv-base-neutral-500", "#737373"],
    ["--asv-base-neutral-600", "#525252"],
    ["--asv-base-neutral-700", "#383838"],
    ["--asv-base-neutral-800", "#222222"],
    ["--asv-base-neutral-900", "#111111"],
    ["--asv-base-neutral-1000", "#000000"],
    ["--asv-base-blue-100", "#eff4ff"],
    ["--asv-base-blue-200", "#c7d9fd"],
    ["--asv-base-blue-300", "#93b4f7"],
    ["--asv-base-blue-400", "#5b8bf5"],
    ["--asv-base-blue-500", "#2d62f0"],
    ["--asv-base-blue-600", "#1a4fcc"],
    ["--asv-base-blue-700", "#0f3a9e"],
    ["--asv-base-green-100", "#eefaf3"],
    ["--asv-base-green-300", "#6dd98a"],
    ["--asv-base-green-500", "#2ea355"],
    ["--asv-base-green-700", "#1a6636"],
    ["--asv-base-red-100", "#fff0ee"],
    ["--asv-base-red-300", "#f5908a"],
    ["--asv-base-red-500", "#e03030"],
    ["--asv-base-red-700", "#a01a1a"],
    ["--asv-base-orange-100", "#fff7e8"],
    ["--asv-base-orange-300", "#f5c063"],
    ["--asv-base-orange-400", "#e89930"],
    ["--asv-base-orange-600", "#b86a10"],
    ["--asv-base-space-2", "2px"],
    ["--asv-base-space-6", "6px"],
    ["--asv-base-space-10", "10px"],
    ["--asv-base-space-32", "32px"],
    ["--asv-base-space-40", "40px"],
    ["--asv-base-space-48", "48px"],
    ["--asv-base-radius-2", "2px"],
    ["--asv-base-radius-4", "4px"],
    ["--asv-base-radius-8", "8px"],
    ["--asv-base-radius-12", "12px"],
    ["--asv-base-radius-16", "16px"],
    ["--asv-base-radius-full", "999px"]
  ]);
  const figmaR2SemanticTokens = new Map([
    ["--asv-color-text-primary", "var(--asv-base-neutral-900)"],
    ["--asv-color-text-secondary", "var(--asv-base-neutral-500)"],
    ["--asv-color-text-tertiary", "var(--asv-base-neutral-400)"],
    ["--asv-color-text-disabled", "var(--asv-base-neutral-300)"],
    ["--asv-color-text-danger", "var(--asv-base-red-500)"],
    ["--asv-color-text-link", "var(--asv-base-blue-500)"],
    ["--asv-color-surface-window", "var(--asv-base-neutral-50)"],
    ["--asv-color-surface-canvas", "var(--asv-base-neutral-100)"],
    ["--asv-color-surface-overlay", "var(--asv-base-neutral-0)"],
    ["--asv-color-surface-mask", "var(--asv-base-neutral-900)"],
    ["--asv-color-surface-muted", "var(--asv-base-neutral-50)"],
    ["--asv-color-border-default", "var(--asv-base-neutral-200)"],
    ["--asv-color-border-strong", "var(--asv-base-neutral-300)"],
    ["--asv-color-border-focus", "var(--asv-base-blue-500)"],
    ["--asv-color-action-primary", "var(--asv-base-blue-500)"],
    ["--asv-color-action-secondary", "var(--asv-base-neutral-100)"],
    ["--asv-color-action-hover", "var(--asv-base-blue-100)"],
    ["--asv-color-status-success", "var(--asv-base-green-500)"],
    ["--asv-color-status-warning", "var(--asv-base-orange-400)"],
    ["--asv-color-status-danger", "var(--asv-base-red-500)"],
    ["--asv-color-status-success-bg", "var(--asv-base-green-100)"],
    ["--asv-color-status-warning-bg", "var(--asv-base-orange-100)"],
    ["--asv-color-status-danger-bg", "var(--asv-base-red-100)"],
    ["--asv-color-drag-accept", "var(--asv-base-green-500)"],
    ["--asv-color-drag-reject", "var(--asv-base-red-500)"],
    ["--asv-space-panel-padding", "var(--asv-base-space-16)"],
    ["--asv-space-panel-gap", "var(--asv-base-space-12)"],
    ["--asv-size-list-row-height", "var(--asv-base-space-32)"],
    ["--asv-size-resource-row-height", "var(--asv-base-space-48)"],
    ["--asv-radius-control", "var(--asv-base-radius-control-8)"],
    ["--asv-radius-card", "var(--asv-base-radius-8)"],
    ["--asv-radius-modal", "var(--asv-base-radius-16)"],
    ["--asv-radius-toast", "var(--asv-base-radius-12)"]
  ]);
  const missingFigmaR2FoundationTokens = collectMissingTokenValues(tokens, figmaR2FoundationTokens);
  const missingFigmaR2SemanticTokens = collectMissingTokenValues(tokens, figmaR2SemanticTokens);
  record("figma-r2-token-foundation-covered", missingFigmaR2FoundationTokens.length === 0
    && missingFigmaR2SemanticTokens.length === 0
    && /:root\[data-radius-mode="large"\]/.test(tokens)
    && /--asv-color-surface-window:\s*var\(--asv-base-neutral-900\);/.test(tokens)
    && /--asv-color-action-primary:\s*var\(--asv-base-blue-400\);/.test(tokens), {
    missingFigmaR2FoundationTokens,
    missingFigmaR2SemanticTokens
  });

  const appEntryImports = [...appEntry.matchAll(/from "([^"]+)"/g)].map((match) => match[1]);
  const appEntryLineCount = appEntry.trimEnd().split("\n").length;
  record("app-entry-stays-assembly-only", appEntryLineCount <= 40
    && JSON.stringify(appEntryImports) === JSON.stringify(expectedAppEntryImports)
    && /createShortTermInitialState/.test(appEntry)
    && /createShortTermAppController/.test(appEntry)
    && !/function\s+/.test(appEntry), {
    appEntryLineCount,
    appEntryImports
  });

  for (const mjsFile of shortTermMjsFiles) {
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
