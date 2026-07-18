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
  "AssetFilterTabs",
  "ThumbnailFrame",
  "ThumbnailAudioIcon",
  "ThumbnailTextIcon",
  "SequenceThumbnail",
  "AudioAssetRow",
  "ReplaceableImageRow",
  "ReplaceableTextRow",
  "OptimizationFindingRow",
  "OptimizationRunningState",
  "OptimizationResultCard",
  "OptimizationResultDetailRow",
  "CompareCanvasSurface",
  "CompareInfoPanel",
  "CompareMetricColumn",
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
  "TabItem",
  "RenameInput",
  "SaveButtonPair"
]);

const allowedModules = new Set([
  "LaunchModule",
  "PreviewCanvasModule",
  "OverviewInformationModule",
  "ReplaceableElementsSurface",
  "OptimizationDetailSurface",
  "OptimizationRunningState",
  "GeneralCompareModule",
  "OptimizationCompareModule",
  "EditReservedModule",
  "SettingsDialogModule",
  "WindowChromeModule",
  "MenuBarCommandModel",
  "SaveStateModule",
  "StateRecoveryModule"
]);

const requiredPageStates = [
  "Launch",
  "Loading",
  "Load failed",
  "Playback error",
  "Drag decision overlay",
  "Unsupported drop",
  "Preview ready",
  "Preview replaceable",
  "Save feedback",
  "General comparing",
  "Edit reserved"
];

const requiredFigmaPageStates = [
  { figma: "启动 / 默认", codePageState: "Launch", frame: { width: 640, height: 640 }, rootModules: ["WindowChromeModule", "LaunchModule"] },
  { figma: "加载 / 加载中", codePageState: "Loading", frame: { width: 1280, height: 800 }, rootModules: ["WindowChromeModule", "PreviewCanvasModule", "StateRecoveryModule"] },
  { figma: "加载 / 加载失败", codePageState: "Load failed", frame: { width: 1280, height: 800 }, rootModules: ["WindowChromeModule", "PreviewCanvasModule", "StateRecoveryModule"] },
  { figma: "加载 / 播放异常", codePageState: "Playback error", frame: { width: 1280, height: 800 }, rootModules: ["WindowChromeModule", "PreviewCanvasModule", "OverviewInformationModule"] },
  { figma: "预览 / 默认", codePageState: "Preview ready", frame: { width: 1280, height: 800 }, rootModules: ["WindowChromeModule", "PreviewCanvasModule", "OverviewInformationModule"] },
  { figma: "预览 / 可替换元素", codePageState: "Preview ready", frame: { width: 1280, height: 800 }, rootModules: ["WindowChromeModule", "PreviewCanvasModule", "OverviewInformationModule", "ReplaceableElementsSurface"] },
  { figma: "预览 / imageKey 重命名 Dirty 状态", codePageState: "Preview ready", frame: { width: 1280, height: 800 }, rootModules: ["WindowChromeModule", "PreviewCanvasModule", "OverviewInformationModule", "ReplaceableElementsSurface", "SaveStateModule"] },
  { figma: "预览 / 无可替换元素", codePageState: "Preview ready", frame: { width: 1280, height: 800 }, rootModules: ["WindowChromeModule", "PreviewCanvasModule", "OverviewInformationModule", "ReplaceableElementsSurface"] },
  { figma: "预览 / 无音频资产", codePageState: "Preview ready", frame: { width: 1280, height: 800 }, rootModules: ["WindowChromeModule", "PreviewCanvasModule", "OverviewInformationModule"] },
  { figma: "预览 / 无序列帧资产", codePageState: "Preview ready", frame: { width: 1280, height: 800 }, rootModules: ["WindowChromeModule", "PreviewCanvasModule", "OverviewInformationModule"] },
  { figma: "预览 / 优化详情", codePageState: "Preview ready", frame: { width: 1280, height: 800 }, rootModules: ["WindowChromeModule", "PreviewCanvasModule", "OptimizationDetailSurface"] },
  { figma: "预览 / 优化执行中", codePageState: "Preview ready", frame: { width: 1280, height: 800 }, rootModules: ["WindowChromeModule", "PreviewCanvasModule", "OptimizationDetailSurface", "OptimizationRunningState"] },
  { figma: "预览 / 优化结果对比", codePageState: "General comparing", frame: { width: 1280, height: 800 }, rootModules: ["WindowChromeModule", "OptimizationCompareModule", "OptimizationDetailSurface"] },
  { figma: "对比 / 空态", codePageState: "General comparing", frame: { width: 1280, height: 800 }, rootModules: ["WindowChromeModule", "GeneralCompareModule"] },
  { figma: "对比 / 已有文件A_等待文件B", codePageState: "General comparing", frame: { width: 1280, height: 800 }, rootModules: ["WindowChromeModule", "GeneralCompareModule"] },
  { figma: "对比 / 双文件已加载", codePageState: "General comparing", frame: { width: 1280, height: 800 }, rootModules: ["WindowChromeModule", "GeneralCompareModule"] },
  { figma: "对比 / 拖拽中", codePageState: "Drag decision overlay", frame: { width: 1280, height: 800 }, rootModules: ["WindowChromeModule", "GeneralCompareModule"] },
  { figma: "拖拽 / 已有文件_拖入对比", codePageState: "Drag decision overlay", frame: { width: 1280, height: 800 }, rootModules: ["WindowChromeModule", "PreviewCanvasModule", "OverviewInformationModule"] },
  { figma: "拖拽 / 格式不支持_拖拽中", codePageState: "Drag decision overlay", frame: { width: 1280, height: 800 }, rootModules: ["WindowChromeModule", "PreviewCanvasModule", "OverviewInformationModule"] },
  { figma: "拖拽 / 格式不支持_Drop后", codePageState: "Unsupported drop", frame: { width: 1280, height: 800 }, rootModules: ["WindowChromeModule", "PreviewCanvasModule", "StateRecoveryModule"] },
  { figma: "保存 / 保存中", codePageState: "Save feedback", frame: { width: 1280, height: 800 }, rootModules: ["WindowChromeModule", "PreviewCanvasModule", "OverviewInformationModule", "SaveStateModule"] },
  { figma: "保存 / 保存成功", codePageState: "Save feedback", frame: { width: 1280, height: 800 }, rootModules: ["WindowChromeModule", "PreviewCanvasModule", "OverviewInformationModule", "SaveStateModule"] },
  { figma: "保存 / 保存失败", codePageState: "Save feedback", frame: { width: 1280, height: 800 }, rootModules: ["WindowChromeModule", "PreviewCanvasModule", "OverviewInformationModule", "SaveStateModule"] },
  { figma: "编辑 / 默认", codePageState: "Edit reserved", frame: { width: 1280, height: 800 }, rootModules: ["WindowChromeModule", "EditReservedModule", "PreviewCanvasModule"] },
  { figma: "参考 / 设置面板", codePageState: "Settings dialog", frame: { width: 1280, height: 800 }, rootModules: ["SettingsDialogModule"] }
];

const requiredFigmaCatalog = {
  atoms: [
    "Atom/文字输入框",
    "Atom/分割线",
    "Atom/加载指示器",
    "Atom/缩略图框",
    "Atom/模式切换器",
    "Atom/图标按钮",
    "Atom/文字按钮",
    "Atom/文件信息头部/默认",
    "Atom/指标优化入口",
    "Atom/最近文件行/正常",
    "Atom/筛选标签栏",
    "Atom/面板区块标题",
    "Atom/Tab Item",
    "Atom/状态徽标"
  ],
  molecules: [
    "Molecule/动画占位",
    "Molecule/加载提示文字",
    "Molecule/统计信息网格",
    "Molecule/拖拽决策",
    "Molecule/资源列表行",
    "Molecule/拖拽决策区",
    "Molecule/保存反馈横幅",
    "Molecule/空态画布",
    "Molecule/错误恢复面板",
    "Molecule/进度状态",
    "Molecule/数据指标块",
    "Molecule/图层列表行",
    "Molecule/优化候选项行",
    "Molecule/缺省",
    "Molecule/toast"
  ],
  modules: [
    "Module/启动页模块/默认",
    "Module/中间面板",
    "Module/右侧栏",
    "Module/左侧栏",
    "Module/设置面板",
    "Module/状态恢复面板",
    "Module/播放控制栏/播放中",
    "Module/窗口标题栏"
  ]
};
const designSystemCatalogSections = Object.keys(requiredFigmaCatalog);
const designSystemTraceSections = [...designSystemCatalogSections, "pageStates", "extensions"];

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
    /父级位置/,
    /暂无最近打开记录/
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

function collectNamedVisualColors(source) {
  return [...source.matchAll(/:\s*(white|black)\b/g)].map((match) => ({
    value: match[1],
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

function collectMappedValues(designSystemMap, fieldName, sections = designSystemCatalogSections) {
  return sections
    .flatMap((section) => designSystemMap[section] ?? [])
    .flatMap((entry) => entry[fieldName] ?? []);
}

function uniqueSorted(values) {
  return [...new Set(values)].sort();
}

async function collectMissingImplementationFiles(designSystemMap) {
  const files = uniqueSorted(collectMappedValues(designSystemMap, "implementationFiles", designSystemTraceSections));
  const missing = [];
  for (const file of files) {
    try {
      await readFile(path.join(experimentRoot, file), "utf8");
    } catch {
      missing.push(file);
    }
  }
  return missing;
}

async function collectMissingReadPackets(designSystemMap) {
  const files = uniqueSorted(collectMappedValues(designSystemMap, "readPackets", ["pageStates"]));
  const missing = [];
  for (const file of files) {
    try {
      await readFile(path.join(repoRoot, file), "utf8");
    } catch {
      missing.push(file);
    }
  }
  return missing;
}

function arraysEqual(a = [], b = []) {
  return JSON.stringify([...a].sort()) === JSON.stringify([...b].sort());
}

async function main() {
  const page = await readFile(path.join(webRoot, "index.html"), "utf8");
  const optimizationPanelStart = page.indexOf('id="panelOptimization"');
  const optimizationPanelEnd = page.indexOf("</aside>", optimizationPanelStart);
  const optimizationPanel = optimizationPanelStart >= 0 && optimizationPanelEnd > optimizationPanelStart
    ? page.slice(optimizationPanelStart, optimizationPanelEnd)
    : "";
  const appEntry = await readFile(path.join(webRoot, "short-term-macos-app.mjs"), "utf8");
  const launchRenderer = await readFile(path.join(webRoot, "short-term-macos-launch-renderers.mjs"), "utf8");
  const overviewRenderer = await readFile(path.join(webRoot, "short-term-macos-overview-renderers.mjs"), "utf8");
  const optimizationRenderer = await readFile(path.join(webRoot, "short-term-macos-optimization-renderers.mjs"), "utf8");
  const feedbackModel = await readFile(path.join(webRoot, "short-term-macos-feedback-model.mjs"), "utf8");
  const feedbackSurface = await readFile(path.join(webRoot, "short-term-macos-feedback-surface.mjs"), "utf8");
  const saveSurface = await readFile(path.join(webRoot, "short-term-macos-save-surface.mjs"), "utf8");
  const recentFilesModel = await readFile(path.join(webRoot, "short-term-macos-recent-files-model.mjs"), "utf8");
  const renderModel = await readFile(path.join(webRoot, "short-term-macos-render-model.mjs"), "utf8");
  const compareModel = await readFile(path.join(webRoot, "short-term-macos-compare-model.mjs"), "utf8");
  const multiFormatController = await readFile(path.join(webRoot, "multiformat-desktop-preview-controller.mjs"), "utf8");
  const multiFormatConformance = await readFile(path.join(webRoot, "multiformat-product-conformance.mjs"), "utf8");
  const mainProcess = await readFile(path.join(experimentRoot, "main.cjs"), "utf8");
  const windowBoundsPolicy = await readFile(path.join(experimentRoot, "short-term-window-bounds-policy.cjs"), "utf8");
  const designManifest = await readFile(path.join(repoRoot, "DESIGN.md"), "utf8");
  const executionPlan = await readFile(path.join(repoRoot, "docs/product/SHORT_TERM_UI_UX_REDESIGN_EXECUTION_PLAN.md"), "utf8");
  const designSystemMap = JSON.parse(await readFile(path.join(experimentRoot, "design-system-map.json"), "utf8"));

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

  record("multiformat-dynamic-components-reuse-canonical-system",
    /row\.dataset\.component = "AssetRow"/.test(multiFormatController)
      && /section\.dataset\.role = "AssetInventoryGroup"/.test(multiFormatController)
      && /mount\.dataset\.role = "MultiFormatRuntimeMount"/.test(multiFormatController)
      && !/dataset\.component = "(?:AssetInventoryGroup|AssetInventoryItem|MultiFormatRuntimeMount)"/.test(multiFormatController));

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

  for (const [section, requiredEntries] of Object.entries(requiredFigmaCatalog)) {
    const mappedEntries = new Set((designSystemMap[section] ?? []).map((entry) => entry.figma));
    const missingFigmaEntries = requiredEntries.filter((name) => !mappedEntries.has(name));
    const extraFigmaEntries = [...mappedEntries].filter((name) => !requiredEntries.includes(name)).sort();
    record(`figma-${section}-catalog-mapped`, missingFigmaEntries.length === 0 && extraFigmaEntries.length === 0, {
      mappedCount: mappedEntries.size,
      missingFigmaEntries,
      extraFigmaEntries
    });
  }

  const mappedCodeComponents = uniqueSorted(collectMappedValues(designSystemMap, "codeComponents"));
  const unknownMappedComponents = mappedCodeComponents.filter((name) => !allowedDataComponents.has(name));
  record("figma-map-code-components-are-canonical", unknownMappedComponents.length === 0, {
    mappedCodeComponentCount: mappedCodeComponents.length,
    unknownMappedComponents
  });

  const mappedCodeModules = uniqueSorted(collectMappedValues(designSystemMap, "codeModules"));
  const unknownMappedModules = mappedCodeModules.filter((name) => !allowedModules.has(name));
  record("figma-map-code-modules-are-canonical", unknownMappedModules.length === 0, {
    mappedCodeModuleCount: mappedCodeModules.length,
    unknownMappedModules
  });

  const missingImplementationFiles = await collectMissingImplementationFiles(designSystemMap);
  record("figma-map-implementation-files-exist", missingImplementationFiles.length === 0, {
    missingImplementationFiles
  });
  const missingReadPackets = await collectMissingReadPackets(designSystemMap);
  record("figma-map-page-state-read-packets-exist", missingReadPackets.length === 0, {
    missingReadPackets
  });

  const mappedPageStates = new Map((designSystemMap.pageStates ?? []).map((entry) => [entry.figma, entry]));
  const missingFigmaPageStates = requiredFigmaPageStates
    .filter((state) => !mappedPageStates.has(state.figma))
    .map((state) => state.figma);
  const pageStateMismatches = [];
  for (const expected of requiredFigmaPageStates) {
    const mapped = mappedPageStates.get(expected.figma);
    if (!mapped) continue;
    if (mapped.codePageState !== expected.codePageState) {
      pageStateMismatches.push({ figma: expected.figma, field: "codePageState", expected: expected.codePageState, actual: mapped.codePageState });
    }
    if (mapped.frame?.width !== expected.frame.width || mapped.frame?.height !== expected.frame.height) {
      pageStateMismatches.push({ figma: expected.figma, field: "frame", expected: expected.frame, actual: mapped.frame });
    }
    if (!arraysEqual(mapped.rootModules, expected.rootModules)) {
      pageStateMismatches.push({ figma: expected.figma, field: "rootModules", expected: expected.rootModules, actual: mapped.rootModules });
    }
  }
  record("figma-page-state-catalog-mapped", missingFigmaPageStates.length === 0 && pageStateMismatches.length === 0, {
    mappedPageStateCount: mappedPageStates.size,
    missingFigmaPageStates,
    pageStateMismatches
  });

  const mappedPageStateNames = [...new Set((designSystemMap.pageStates ?? []).map((entry) => entry.codePageState))];
  const missingMappedHtmlPageStates = mappedPageStateNames
    .filter((state) => state !== "Settings dialog" && !pageStates.includes(state));
  const mappedPageModules = uniqueSorted(collectMappedValues(designSystemMap, "rootModules", ["pageStates"]));
  const unknownMappedPageModules = mappedPageModules.filter((name) => !allowedModules.has(name));
  const dynamicMappedPageModules = ["OptimizationCompareModule", "SettingsDialogModule"];
  const missingMappedHtmlModules = mappedPageModules
    .filter((name) => !dynamicMappedPageModules.includes(name))
    .filter((name) => !dataModules.includes(name));
  record("figma-page-states-map-to-current-html", missingMappedHtmlPageStates.length === 0
    && unknownMappedPageModules.length === 0
    && missingMappedHtmlModules.length === 0
    && /data-component="SettingsSheet" data-module="SettingsDialogModule"/.test(page)
    && /moduleName:\s*"OptimizationCompareModule"/.test(compareModel), {
    missingMappedHtmlPageStates,
    unknownMappedPageModules,
    missingMappedHtmlModules
  });

  const multiFormatExtension = (designSystemMap.extensions ?? [])
    .find(({ productMilestone }) => productMilestone === "0.2-multiformat-preview");
  const requiredMultiFormatComponents = [
    "CanvasModeSwitch",
    "DragDecisionOverlay",
    "PlaybackControls",
    "OverviewFactRow",
    "AssetFilterTabs",
    "AssetRow",
    "ReplaceableImageRow",
    "ReplaceableTextRow",
    "RightInformationSurface"
  ];
  const requiredMultiFormatModules = [
    "LaunchModule",
    "PreviewCanvasModule",
    "OverviewInformationModule",
    "GeneralCompareModule",
    "SettingsDialogModule",
    "StateRecoveryModule"
  ];
  record("multiformat-preview-inherits-canonical-ui-system", Boolean(multiFormatExtension)
    && requiredMultiFormatComponents.every((name) => multiFormatExtension.codeComponents?.includes(name))
    && requiredMultiFormatModules.every((name) => multiFormatExtension.codeModules?.includes(name))
    && /createReplaceableImageRow/.test(multiFormatController)
    && /createTextElementRow/.test(multiFormatController)
    && /directReplace:\s*true/.test(multiFormatController)
    && /multiFormatDragDecisionForEvent/.test(multiFormatController)
    && /editEnabled:\s*false/.test(multiFormatController)
    && /multiFormatInventorySummaryItems/.test(multiFormatConformance)
    && !/#(?:[0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})\b/iu.test(multiFormatController)
    && !/本地渲染已就绪|正在准备本地预览/u.test(multiFormatController), {
    extensionFound: Boolean(multiFormatExtension),
    missingComponents: requiredMultiFormatComponents.filter((name) => !multiFormatExtension?.codeComponents?.includes(name)),
    missingModules: requiredMultiFormatModules.filter((name) => !multiFormatExtension?.codeModules?.includes(name))
  });

  const loadingSection = page.match(/<section class="view stateView workbenchStateView" data-view="loading"[\s\S]*?<\/aside>\s*<\/section>/)?.[0] ?? "";
  const failedSection = page.match(/<section class="view stateView workbenchStateView" data-view="failed"[\s\S]*?<\/aside>\s*<\/section>/)?.[0] ?? "";
  const unsupportedSection = page.match(/<section class="view stateView workbenchStateView unsupportedDropView" data-view="unsupported"[\s\S]*?<\/section>\s*<\/section>/)?.[0] ?? "";
  const staleStateContentPattern = /id="fileIdentity"|class="factGrid"|id="assetList"|id="replaceableList"|toolbarClusterSave|data-action="save-as"|data-action="save-overwrite"/;
  record("loading-and-load-failed-states-keep-recovery-contract",
    /aria-live="polite"[^>]*aria-busy="true"[^>]*role="status"[^>]*data-page-state="Loading"/.test(loadingSection)
    && /data-module="PreviewCanvasModule"/.test(loadingSection)
    && /data-module="StateRecoveryModule"/.test(loadingSection)
    && /data-role="LoadingCanvasRecovery"/.test(loadingSection)
    && /<button class="toolbarButton primary stateRecoveryButton" type="button" data-action="open">[\s\S]*?<span>打开文件<\/span>/.test(loadingSection)
    && /<div class="playbackBar statePlaybackBar"[^>]*data-state="disabled"/.test(loadingSection)
    && !staleStateContentPattern.test(loadingSection)
    && /aria-live="assertive"[^>]*role="alert"[^>]*data-page-state="Load failed"/.test(failedSection)
    && /data-module="PreviewCanvasModule"/.test(failedSection)
    && /data-module="StateRecoveryModule"/.test(failedSection)
    && /data-role="FailureCanvasRecovery"/.test(failedSection)
    && /<button class="toolbarButton primary stateRecoveryButton" type="button" data-action="open">[\s\S]*?<span>打开文件<\/span>/.test(failedSection)
    && /<div class="playbackBar statePlaybackBar"[^>]*data-state="disabled"/.test(failedSection)
    && !staleStateContentPattern.test(failedSection));

  const launchCopySources = [page, launchRenderer].join("\n");
  const disallowedLaunchCopy = disallowedLaunchCopyPatterns
    .filter((pattern) => pattern.test(launchCopySources))
    .map((pattern) => pattern.source);
  record("launch-page-copy-stays-minimal", disallowedLaunchCopy.length === 0
    && /<div class="launchPrompt" data-component="FileDropTarget" data-role="LaunchEmptyCanvas">/.test(page)
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
      const namedVisualColors = collectNamedVisualColors(source);
      record(`no-named-visual-color-outside-tokens:${cssFile}`, namedVisualColors.length === 0, { namedVisualColors });
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

  record("loading-and-failed-states-match-frozen-visual-contract",
    /class="stateCard stateLoadingCard"/.test(loadingSection)
    && /class="stateCard error stateFailureCard"/.test(failedSection)
    && /class="stateFailureIcon" aria-hidden="true">[\s\S]*?<svg[^>]*>[\s\S]*?<\/svg>/.test(failedSection)
    && /--asv-component-state-loading-indicator-size:\s*28px/.test(tokens)
    && /--asv-component-state-loading-label-size:\s*var\(--asv-type-size-footnote\)/.test(tokens)
    && /--asv-component-state-failure-icon-size:\s*var\(--asv-base-space-48\)/.test(tokens)
    && /--asv-component-state-failure-icon-background:\s*var\(--asv-color-status-danger\)/.test(tokens)
    && /--asv-radius-xs:\s*var\(--asv-base-radius-2\)/.test(tokens)
    && /--asv-radius-pill:\s*var\(--asv-base-radius-full\)/.test(tokens)
    && /--asv-component-state-failure-title-size:\s*var\(--asv-type-size-metric\)/.test(tokens)
    && /\.stateLoadingCard\s*>\s*\.spinner\s*\{[^}]*width:\s*var\(--asv-state-loading-indicator-size\);[^}]*height:\s*var\(--asv-state-loading-indicator-size\);/s.test(components)
    && /\.stateFailureIcon\s*\{[^}]*width:\s*var\(--asv-state-failure-icon-size\);[^}]*background:\s*var\(--asv-state-failure-icon-bg\);/s.test(components)
    && /\.stateFailureCard\s*>\s*h1\s*\{[^}]*font-size:\s*var\(--asv-state-failure-title-size\);[^}]*font-weight:\s*var\(--asv-state-failure-title-weight\);/s.test(components));

  record("playback-error-preserves-preview-workspace-contract",
    /id="playbackErrorRecovery"(?=[^>]*data-component="ErrorRecoveryPanel")(?=[^>]*data-page-state="Playback error")(?=[^>]*role="alert")[^>]*hidden/.test(page)
    && /class="playbackErrorIcon playbackErrorWarningIcon"[^>]*>!<\/span>/.test(page)
    && /id="playbackErrorMessage">动画解析失败，无法正常播放<\/p>/.test(page)
    && /data-action="reload-playback">重新加载<\/button>/.test(page)
    && /--asv-component-playback-error-icon-glyph-size:\s*20px/.test(tokens)
    && /\.playbackErrorRecovery\s*\{[\s\S]*position: absolute[\s\S]*place-items: center/.test(components)
    && /\.playbackErrorWarningIcon\s*\{[^}]*font-size:\s*var\(--asv-playback-error-icon-glyph-size\)/s.test(components)
    && /\.stateCard\.playbackErrorPanel\s*\{[\s\S]*width: min\(var\(--asv-playback-error-panel-size\), 100%\)[\s\S]*height: min\(var\(--asv-playback-error-panel-size\), 100%\)/.test(components));
  const baseCss = await readFile(path.join(webRoot, "short-term-macos.css"), "utf8");

  record("multiformat-asset-groups-use-tokenized-layout",
    /--asv-component-asset-group-gap:\s*var\(--asv-space-1\)/.test(tokens)
      && /--asv-asset-group-gap:\s*var\(--asv-component-asset-group-gap\)/.test(tokens)
      && /\.assetGroup\s*\{[\s\S]*gap:\s*var\(--asv-asset-group-gap\)/.test(modules)
      && /--asv-asset-group-header-padding-inline:\s*var\(--asv-component-asset-group-header-padding-inline\)/.test(tokens)
      && /\.assetGroupHeader\s*\{[\s\S]*padding:\s*var\(--asv-asset-group-header-padding-block\) var\(--asv-asset-group-header-padding-inline\)/.test(modules));

  const rightSurfaceContractChecks = [
    /--asv-component-right-panel-width:\s*360px/.test(tokens),
    /--asv-component-right-panel-padding:\s*var\(--asv-space-4\)/.test(tokens),
    /--asv-component-workbench-top-safe-area:\s*var\(--asv-component-toolbar-height\)/.test(tokens),
    /--asv-component-workbench-floating-control-top:\s*var\(--asv-space-4\)/.test(tokens),
    /--asv-component-right-panel-safe-padding-block-start:\s*var\(--asv-component-workbench-top-safe-area\)/.test(tokens),
    /--asv-component-right-surface-content-width:\s*calc\(var\(--asv-component-right-panel-width\) - \(var\(--asv-component-right-panel-padding\) \* 2\)\)/.test(tokens),
    /--asv-component-right-panel-section-gap:\s*var\(--asv-space-1\)/.test(tokens),
    /--asv-component-right-panel-section-margin-block-start:\s*var\(--asv-space-1\)/.test(tokens),
    /--asv-component-right-panel-section-padding-block-start:\s*var\(--asv-space-1\)/.test(tokens),
    /--asv-component-right-panel-separator-width:\s*0px/.test(tokens),
    /--asv-component-right-panel-header-divider:\s*var\(--asv-component-right-panel-section-divider\)/.test(tokens),
    /--asv-component-right-section-head-padding-block-end:\s*var\(--asv-space-1\)/.test(tokens),
    /--asv-component-right-section-list-margin-block-start:\s*var\(--asv-space-1\)/.test(tokens),
    /--asv-component-side-surface-background:\s*var\(--asv-color-surface-right-panel\)/.test(tokens),
    /--asv-side-surface-bg:\s*var\(--asv-component-side-surface-background\)/.test(tokens),
    /--asv-component-file-header-width:\s*calc\(100% - \(var\(--asv-right-panel-padding\) \* 2\)\)/.test(tokens),
    /--asv-component-file-header-padding-block:\s*var\(--asv-space-3\)/.test(tokens),
    /--asv-component-right-section-title-size:\s*var\(--asv-type-size-footnote\)/.test(tokens),
    /--asv-component-right-section-title-line-height:\s*18px/.test(tokens),
    /--asv-component-right-section-title-weight:\s*var\(--asv-type-weight-medium\)/.test(tokens),
    /--asv-component-fact-grid-width:\s*328px/.test(tokens),
    /--asv-component-fact-grid-padding-block:\s*var\(--asv-space-3\)/.test(tokens),
    /<aside class="rightPanel"[^>]*data-component="RightInformationSurface"/.test(page),
    /id="panelOverview"[^>]*data-module="OverviewInformationModule"/.test(page),
    /class="rightSurfaceHeader"/.test(page),
    /id="assetListHeading">资产列表<\/h2>/.test(page),
    /id="assetFilterTabs"[^>]*data-component="AssetFilterTabs"/.test(page),
    /<section class="replaceableSection"[\s\S]*id="textElementList" role="listbox" aria-label="运行时文本"[\s\S]*id="replaceableList" role="listbox" aria-label="imageKey"[\s\S]*<\/section>/.test(page),
    !/textPreviewBlock|textPreviewHeading|textPreviewSummary/.test(page),
    /dataset\.action = "asset-filter"/.test(overviewRenderer),
    /cell\.dataset\.component = "FactCell"/.test(overviewRenderer),
    /assetListHeading\.textContent = `资产列表 \(\$\{view\.assets\.length\}\)`/.test(overviewRenderer),
    /\.rightSurfaceHeader\s*\{[\s\S]*width: var\(--asv-file-header-width\)[\s\S]*margin: var\(--asv-right-panel-safe-padding-block-start\) var\(--asv-right-panel-padding\) 0[\s\S]*border-bottom: var\(--asv-right-panel-header-divider\)/.test(modules),
    /\.rightPanel\s*\{[\s\S]*background: var\(--asv-side-surface-bg\)/.test(modules),
    /\.rightSurfaceBody\s*\{[\s\S]*background: var\(--asv-side-surface-bg\)/.test(modules),
    /\.rightSurfaceBody > \.factGrid,[\s\S]*\.compareInfo > \.resultGroup\s*\{[\s\S]*max-width: var\(--asv-right-surface-content-width\)/.test(modules),
    /\.compareInfo\s*\{[\s\S]*gap: var\(--asv-right-panel-section-gap\)[\s\S]*min-width: 0[\s\S]*overflow-x: hidden[\s\S]*overflow-y: auto[\s\S]*padding: var\(--asv-right-panel-safe-padding-block-start\) var\(--asv-right-panel-padding\) var\(--asv-right-panel-padding\)[\s\S]*background: var\(--asv-side-surface-bg\)/.test(modules),
    /\.canvasModeSwitch\s*\{[\s\S]*top: var\(--asv-workbench-floating-control-top\)/.test(modules),
    /\.sectionHead\s*\{[\s\S]*padding-bottom: var\(--asv-right-section-head-padding-block-end\)/.test(modules),
    /\.sectionHead h2\s*\{[\s\S]*font-size: var\(--asv-right-section-title-size\)[\s\S]*line-height: var\(--asv-right-section-title-line-height\)/.test(modules),
    /\.assetList,[\s\S]*\.textElementList\s*\{[\s\S]*margin-top: var\(--asv-right-section-list-margin-block-start\)/.test(modules),
    /\.assetSection,[\s\S]*\.replaceableSection\s*\{[\s\S]*margin-top: var\(--asv-right-panel-section-margin-block-start\)[\s\S]*padding-top: var\(--asv-right-panel-section-padding-block-start\)/.test(modules),
    /\.factGrid\s*\{[\s\S]*width: min\(var\(--asv-fact-grid-width\), 100%\)[\s\S]*padding: var\(--asv-fact-grid-padding-block\) 0 0/.test(modules)
  ];
  record("figma-r7-right-surface-default-contract-covered", rightSurfaceContractChecks.every(Boolean), {
    failedIndexes: rightSurfaceContractChecks
      .map((passed, index) => (passed ? undefined : index))
      .filter((value) => value !== undefined)
  });
  record("right-surface-asset-row-copy-stays-figma-scoped", !/次引用/.test(overviewRenderer), {
    disallowedCopy: "次引用"
  });
  record("scrollable-surfaces-do-not-force-visible-scrollbar-gutter", !/scrollbar-gutter:\s*stable/.test(baseCss + atoms + molecules + components + modules + pageStatesCss));
  record("scrollable-surfaces-use-tokenized-hidden-scrollbar-contract", /--asv-component-scrollable-surface-scrollbar-size:\s*0px/.test(tokens)
    && /--asv-scrollable-surface-scrollbar-size:\s*var\(--asv-component-scrollable-surface-scrollbar-size\)/.test(tokens)
    && /\.rightSurfaceBody,\s*\.compareInfo,\s*\.layerPanel,\s*\.reservedPanel\s*\{[\s\S]*scrollbar-width: none/.test(modules)
    && /\.rightSurfaceBody::-webkit-scrollbar,[\s\S]*\.reservedPanel::-webkit-scrollbar\s*\{[\s\S]*width: var\(--asv-scrollable-surface-scrollbar-size\)[\s\S]*height: var\(--asv-scrollable-surface-scrollbar-size\)/.test(modules));
  record("figma-save-feedback-banner-stays-in-contextual-right-surface-flow",
    /class="saveFeedbackOutlet" data-save-feedback-outlet="overview">[\s\S]*id="saveBanner"[^>]*data-module="SaveStateModule"[^>]*data-page-state="Save feedback"/.test(page)
      && /class="saveFeedbackOutlet" data-save-feedback-outlet="optimization"/.test(page)
      && !/<header class="titlebar"[\s\S]*?<\/header>\s*<section class="saveBanner"/.test(page)
      && /--asv-component-save-banner-min-height:\s*36px/.test(tokens)
      && /--asv-component-save-banner-gap:\s*var\(--asv-base-space-10\)/.test(tokens)
      && /--asv-component-save-banner-radius:\s*var\(--asv-radius-sm\)/.test(tokens)
      && /--asv-component-save-banner-font-size:\s*var\(--asv-type-size-footnote\)/.test(tokens)
      && /--asv-component-save-banner-line-height:\s*18px/.test(tokens)
      && /--asv-component-save-banner-title-weight:\s*var\(--asv-type-weight-medium\)/.test(tokens)
      && /--asv-component-save-banner-icon-size:\s*var\(--asv-base-space-20\)/.test(tokens)
      && /--asv-component-save-banner-icon-border-width:\s*3px/.test(tokens)
      && /--asv-component-save-banner-loading-background:\s*var\(--asv-color-status-info-bg\)/.test(tokens)
      && /--asv-component-save-banner-success-background:\s*transparent/.test(tokens)
      && /--asv-component-save-banner-danger-background:\s*var\(--asv-color-status-danger-bg\)/.test(tokens)
      && /\.saveFeedbackOutlet\s*\{[\s\S]*padding: var\(--asv-save-feedback-outlet-padding-block\) 0/.test(modules)
      && /\.saveBanner\s*\{[\s\S]*justify-content: center[\s\S]*border-radius: var\(--asv-save-banner-radius\)[\s\S]*font-size: var\(--asv-save-banner-font-size\)[\s\S]*line-height: var\(--asv-save-banner-line-height\)/.test(modules)
      && /\.saveBanner\[data-status="loading"\]::before\s*\{[\s\S]*animation: spin var\(--asv-save-banner-icon-duration\)/.test(modules)
      && /\.saveBanner strong\s*\{[\s\S]*color: currentColor/.test(modules)
      && /\.macApp > \.saveBanner\s*\{[\s\S]*grid-row: 1/.test(pageStatesCss));
  record("figma-save-feedback-copy-stays-renderer-owned-and-path-free",
    /export function sourceUnmodifiedMessage\(\)\s*\{[\s\S]*return "源文件没有被修改。"/.test(feedbackModel)
      && /message: sourceUnmodifiedMessage\(\)/.test(feedbackSurface)
      && !/String\(error\)|error\.message/.test(feedbackSurface)
      && /showSaveBanner\("保存失败，请重试", ""\)/.test(saveSurface)
      && !/sourceUnmodifiedMessage|String\(error\)|error\.message/.test(saveSurface));
  record("figma-r4-launch-module-contract-covered", /data-view="launch"[^>]*data-module="LaunchModule"/.test(page)
    && /class="launchCanvas"[^>]*data-component="LaunchDropCanvas"/.test(page)
    && /class="launchPrompt"[^>]*data-component="FileDropTarget"[^>]*data-role="LaunchEmptyCanvas"/.test(page)
    && /class="recentBlock"[^>]*data-component="LaunchRecentFilesList"[^>]*data-state="empty"/.test(page)
    && /class="recentClearButton"[^>]*data-action="clear-recent"[^>]*disabled/.test(page)
    && /--asv-component-launch-empty-canvas-size:\s*300px/.test(tokens)
    && /--asv-component-launch-content-width:\s*300px/.test(tokens)
    && /--asv-component-launch-content-offset-block-start:\s*46px/.test(tokens)
    && /--asv-component-launch-action-width:\s*72px/.test(tokens)
    && /--asv-component-launch-action-height:\s*30px/.test(tokens)
    && /--asv-component-launch-recent-width:\s*360px/.test(tokens)
    && /--asv-component-launch-recent-height:\s*200px/.test(tokens)
    && /--asv-component-launch-recent-row-height:\s*32px/.test(tokens)
    && /--asv-component-launch-recent-row-radius:\s*var\(--asv-base-radius-12\)/.test(tokens)
    && /--asv-component-launch-recent-invalid-opacity:\s*0\.45/.test(tokens)
    && /recentBlock\.hidden = false/.test(launchRenderer)
    && /recentBlock\.dataset\.state = "unavailable"/.test(launchRenderer)
    && /recentBlock\.dataset\.state = records\.length === 0 \? "empty" : "ready"/.test(launchRenderer)
    && /records\.map\(createRecentFileRow\)/.test(launchRenderer)
    && /LAUNCH_RECENT_LIMIT = 5/.test(recentFilesModel)
    && /records\.slice\(0, limit\)/.test(recentFilesModel)
    && /文件不可访问/.test(launchRenderer)
    && /\.recentClearButton:disabled\s*\{[\s\S]*visibility: hidden/.test(modules)
    && !/\.launchCanvas:has\(\.recentBlock:not\(\[hidden\]\)\)/.test(modules));
  record("figma-r4-canvas-playback-contract-covered", /data-module="PreviewCanvasModule"[^>]*data-component="PreviewStage"/.test(page)
    && /class="canvasModeSwitch"[^>]*data-component="CanvasModeSwitch"/.test(page)
    && /class="playbackBar"[^>]*data-component="PlaybackControls"/.test(page)
    && /class="playbackActions"[^>]*data-component="PlaybackButtonGroup"/.test(page)
    && /class="playbackRightActions"[^>]*data-component="PlaybackButtonGroup"/.test(page)
    && /class="playbackIconButton"[^>]*data-component="IconButton"/.test(page)
    && /class="playbackIconButton primary"[^>]*data-component="IconButton"/.test(page)
    && /data-action="loop-toggle"[\s\S]*aria-pressed="true"/.test(page)
    && !/data-action="fullscreen"/.test(page)
    && /--asv-component-playback-bar-height:\s*44px/.test(tokens)
    && /--asv-component-playback-bar-padding-inline:\s*var\(--asv-base-space-40\)/.test(tokens)
    && /--asv-component-playback-bar-padding-block:\s*var\(--asv-space-3\)/.test(tokens)
    && /--asv-component-playback-bar-gap:\s*var\(--asv-space-4\)/.test(tokens)
    && /--asv-component-playback-actions-gap:\s*var\(--asv-space-4\)/.test(tokens)
    && /--asv-component-icon-button-size:\s*44px/.test(tokens)
    && /--asv-component-icon-button-radius:\s*var\(--asv-radius-md\)/.test(tokens)
    && /--asv-component-icon-button-icon-size:\s*20px/.test(tokens)
    && /--asv-component-icon-button-selected-background:\s*var\(--asv-color-surface-control-selected\)/.test(tokens)
    && /--asv-component-icon-button-selected-color:\s*var\(--asv-color-action-primary\)/.test(tokens)
    && /--asv-component-playback-primary-size:\s*var\(--asv-component-icon-button-size\)/.test(tokens)
    && /--asv-component-playback-control-size:\s*var\(--asv-component-icon-button-size\)/.test(tokens)
    && /--asv-component-playback-icon-size:\s*var\(--asv-component-icon-button-icon-size\)/.test(tokens)
    && /--asv-component-playback-progress-height:\s*3px/.test(tokens)
    && /--asv-component-playback-time-line-height:\s*18px/.test(tokens)
    && /--asv-component-mode-switch-width:\s*152px/.test(tokens)
    && /--asv-component-mode-switch-height:\s*42px/.test(tokens)
    && /--asv-component-mode-button-width:\s*72px/.test(tokens)
    && /--asv-component-mode-button-height:\s*34px/.test(tokens)
    && /--asv-component-mode-switch-padding:\s*var\(--asv-space-1\)/.test(tokens)
    && /--asv-component-mode-button-padding-inline:\s*var\(--asv-space-3\)/.test(tokens)
    && /--asv-component-mode-button-padding-block:\s*var\(--asv-space-2\)/.test(tokens)
    && /--asv-component-mode-button-line-height:\s*18px/.test(tokens)
    && /\.playbackBar\s*\{[\s\S]*grid-template-columns:[\s\S]*minmax\(var\(--asv-playback-progress-min-width\), var\(--asv-playback-progress-track-fr\)\)[\s\S]*padding: var\(--asv-playback-bar-padding-block\) var\(--asv-playback-bar-padding-inline\)/.test(modules)
    && /\.playbackIconButton\s*\{[\s\S]*width: var\(--asv-icon-button-size\)[\s\S]*height: var\(--asv-icon-button-size\)[\s\S]*border-radius: var\(--asv-icon-button-radius\)/.test(modules)
    && /\.playbackIconButton\.primary\s*\{[\s\S]*background: var\(--asv-icon-button-primary-bg\)[\s\S]*color: var\(--asv-icon-button-primary-color\)/.test(modules)
    && /\.playbackIconButton\.isSelected:not\(\.primary\):not\(:disabled\)\s*\{[\s\S]*background: var\(--asv-icon-button-selected-bg\)[\s\S]*color: var\(--asv-icon-button-selected-color\)/.test(modules)
    && /\.playbackProgress\s*\{[\s\S]*height: var\(--asv-playback-progress-height\)/.test(modules)
    && /\.modeSwitch,[\s\S]*\.canvasModeSwitch\s*\{[\s\S]*width: var\(--asv-mode-switch-width\)[\s\S]*min-height: var\(--asv-mode-switch-height\)/.test(molecules)
    && /\.modeSwitch button,[\s\S]*\.canvasModeSwitch button\s*\{[\s\S]*width: var\(--asv-mode-button-width\)[\s\S]*min-height: var\(--asv-mode-button-height\)/.test(molecules)
    && /\.canvasModeSwitch\s*\{[\s\S]*top: var\(--asv-workbench-floating-control-top\)[\s\S]*left: 50%/.test(modules));
  record("compare-empty-slots-use-file-drop-target-contract", /class="compareEmptyPrompt" data-component="FileDropTarget" data-role="CompareEmptySlot"[\s\S]*<p>拖拽文件到此处<\/p>[\s\S]*data-action="open-compare-a"/.test(page)
    && /class="compareEmptyPrompt" data-component="FileDropTarget" data-role="CompareEmptySlot"[\s\S]*<p>拖拽文件到此处<\/p>[\s\S]*data-action="open-compare-b"/.test(page)
    && /--asv-component-compare-empty-prompt-width:\s*var\(--asv-component-launch-content-width\)/.test(tokens)
    && /\.compareEmptyPrompt\s*\{[\s\S]*gap: var\(--asv-compare-empty-prompt-gap\)[\s\S]*width: min\(var\(--asv-compare-empty-prompt-width\), 100%\)/.test(modules)
    && /\.compareCanvasWrap\[data-compare-state="loaded"\] \.compareEmptyPrompt\s*\{[\s\S]*display: none/.test(modules));
  record("compare-right-panel-missing-slots-use-open-action-contract", /function renderComparePairSlotHtml\(slot, model, displayName\)/.test(compareModel)
    && /const openAction = slot === "A" \? "open-compare-a" : "open-compare-b"/.test(compareModel)
    && /class="toolbarButton primary comparePairOpenButton"/.test(compareModel)
    && /data-state="\$\{state\}"/.test(compareModel)
    && /\.comparePairOpenButton\s*\{[\s\S]*width: var\(--asv-compare-open-button-width\)[\s\S]*min-height: var\(--asv-compare-open-button-height\)/.test(modules));
  record("compare-waiting-b-keeps-loaded-a-facts", /function comparePanelState/.test(compareModel)
    && /if \(aModel\) return "waiting-b"/.test(compareModel)
    && /data-state="empty" aria-hidden="true"/.test(compareModel)
    && /displayName \|\| "文件未打开"/.test(compareModel)
    && /if \(!comparisonReady\) return "uncompared"/.test(compareModel));
  record("compare-loaded-highlights-only-the-better-fact", /const compareStatusScore = Object\.freeze/.test(compareModel)
    && /return factScore > peerScore \? "improved" : "different"/.test(compareModel)
    && /\.compareMetricCell\[data-diff="improved"\] strong\s*\{[\s\S]*color: var\(--asv-success\)/.test(modules)
    && !/\.compareMetricCell\[data-diff="different"\] strong\s*\{[\s\S]*color: var\(--asv-success\)/.test(modules));
  record("optimization-detail-uses-figma-r5-candidate-row-contract", /dataset\.component = "OptimizationFindingRow"/.test(optimizationRenderer)
    && /dataset\.role = "OptimizationCandidateRow"/.test(optimizationRenderer)
    && /--asv-component-finding-row-min-height:\s*62px/.test(tokens)
    && /--asv-component-finding-row-gap:\s*var\(--asv-space-2\)/.test(tokens)
    && /--asv-component-finding-row-padding-block:\s*var\(--asv-space-3\)/.test(tokens)
    && /--asv-component-finding-row-padding-inline:\s*var\(--asv-space-3\)/.test(tokens)
    && /--asv-component-finding-row-radius:\s*var\(--asv-base-radius-12\)/.test(tokens)
    && /--asv-component-finding-row-title-line-height:\s*18px/.test(tokens)
    && /--asv-component-finding-row-summary-line-height:\s*16px/.test(tokens)
    && /\.findingRow\s*\{[\s\S]*min-height: var\(--asv-finding-row-min-height\)[\s\S]*padding: var\(--asv-finding-row-padding-block\) var\(--asv-finding-row-padding-inline\) var\(--asv-finding-row-padding-block\) var\(--asv-finding-row-padding-inline-start\)[\s\S]*border-radius: var\(--asv-finding-row-radius\)/.test(components)
    && /\.findingRow\[data-disposition="safeExecutable"\]/.test(components)
    && /\.findingRow\[data-disposition="reviewOnly"\]/.test(components)
    && /\.findingRow\[data-disposition="unsupported"\]/.test(components)
    && /class="optimizationDetailActions"[\s\S]*data-action="run-optimization">一键优化<\/button>[\s\S]*data-action="close-optimization">放弃优化<\/button>/.test(page)
    && optimizationPanel.indexOf('id="findingList"') >= 0
    && optimizationPanel.indexOf('id="findingList"') < optimizationPanel.indexOf('class="optimizationDetailActions"')
    && /--asv-component-optimization-detail-header-padding-block:\s*var\(--asv-space-3\)/.test(tokens)
    && /--asv-component-optimization-detail-list-gap:\s*var\(--asv-space-2\)/.test(tokens)
    && /--asv-component-optimization-detail-list-padding-block:\s*var\(--asv-space-3\)/.test(tokens)
    && /--asv-component-optimization-detail-actions-padding-block:\s*var\(--asv-space-3\)/.test(tokens)
    && /#panelOptimization:not\(\[hidden\]\) > \.sectionHead\s*\{[^}]*display:\s*contents/s.test(modules)
    && /#panelOptimization:not\(\[hidden\]\) > \.sectionHead > div\s*\{[^}]*padding:\s*var\(--asv-optimization-detail-header-padding-block\) 0/s.test(modules)
    && /#panelOptimization:not\(\[hidden\]\) #findingList\s*\{[^}]*gap:\s*var\(--asv-optimization-detail-list-gap\)[^}]*padding:\s*var\(--asv-optimization-detail-list-padding-block\) 0/s.test(modules)
    && /#panelOptimization:not\(\[hidden\]\) \.optimizationDetailActions\s*\{[\s\S]*grid-template-columns: minmax\(0, 1fr\)[\s\S]*gap: var\(--asv-optimization-action-gap\)[\s\S]*padding: var\(--asv-optimization-detail-actions-padding-block\) 0/.test(modules));
  record("optimization-running-uses-figma-progress-contract", /data-component="OptimizationRunningState"[\s\S]*优化执行中…[\s\S]*role="progressbar"[\s\S]*正在生成优化文件，请勿关闭…/.test(page)
    && /export function renderOptimizationRunningState/.test(optimizationRenderer)
    && /--asv-component-optimization-progress-width:\s*var\(--asv-component-right-surface-content-width\)/.test(tokens)
    && /--asv-component-optimization-progress-detail-size:\s*var\(--asv-type-size-micro\)/.test(tokens)
    && /--asv-component-optimization-progress-track-height:\s*4px/.test(tokens)
    && /\.optimizationProgressBarFill\s*\{[\s\S]*animation: optimization-progress-indeterminate/.test(modules)
    && /@media \(prefers-reduced-motion: reduce\)[\s\S]*\.optimizationProgressBarFill/.test(modules));
  record("optimization-result-metrics-use-figma-component-contract", /data-component="OptimizationResultCard" data-role="OptimizationMetricCell"/.test(baseCss + modules + components + renderModel)
    && /--asv-optimization-metric-min-height:\s*var\(--asv-component-optimization-metric-min-height\)/.test(tokens)
    && /--asv-component-optimization-metric-improved-value-size:\s*var\(--asv-type-size-body\)/.test(tokens)
    && /--asv-component-optimization-metric-arrow-size:\s*var\(--asv-type-size-micro\)/.test(tokens)
    && /gap:\s*var\(--asv-optimization-metric-gap\)/.test(modules)
    && /padding:\s*var\(--asv-optimization-metric-padding-block\) var\(--asv-optimization-metric-padding-inline\)/.test(modules)
    && /\.optimizationMetricCell\[data-improved="true"\] \.optimizationMetricValue em\s*\{[^}]*font-size: var\(--asv-optimization-metric-improved-value-size\)/s.test(modules)
    && /\.optimizationMetricValue i\s*\{[^}]*font-size: var\(--asv-optimization-metric-arrow-size\)/s.test(modules));
  record("optimization-actions-use-figma-r5-button-rhythm", /<div class="compareActions optimizationActions">/.test(compareModel)
    && /--asv-component-optimization-action-height:\s*30px/.test(tokens)
    && /--asv-component-optimization-action-radius:\s*var\(--asv-radius-sm\)/.test(tokens)
    && /--asv-component-optimization-action-gap:\s*var\(--asv-space-2\)/.test(tokens)
    && /\.optimizationActions\s*\{[\s\S]*grid-template-columns: minmax\(0, 1fr\)[\s\S]*gap: var\(--asv-optimization-action-gap\)/.test(modules)
    && /\.optimizationActions \.toolbarButton\s*\{[\s\S]*min-height: var\(--asv-optimization-action-height\)[\s\S]*border-radius: var\(--asv-optimization-action-radius\)/.test(modules));
  record("optimization-result-details-use-tokenized-row-contract", /data-component="OptimizationResultDetailRow"/.test(compareModel)
    && /--asv-component-optimization-result-row-padding-block:\s*var\(--asv-base-space-4\)/.test(tokens)
    && /--asv-component-optimization-result-row-radius:\s*var\(--asv-radius-md\)/.test(tokens)
    && /\.resultGroup li\s*\{[\s\S]*padding: var\(--asv-optimization-result-row-padding-block\) var\(--asv-optimization-result-row-padding-inline\)[\s\S]*border-radius: var\(--asv-optimization-result-row-radius\)[\s\S]*background: var\(--asv-optimization-result-row-bg\)/.test(modules)
    && /\.resultGroup\.muted li\s*\{[\s\S]*background: var\(--asv-optimization-result-muted-row-bg\)/.test(modules));
  record("figma-r9-compare-edit-settings-contract-covered", /--asv-component-preview-gap:\s*var\(--asv-base-space-0\)/.test(tokens)
    && /--asv-component-left-panel-width:\s*360px/.test(tokens)
    && /--asv-component-edit-right-panel-min-width:\s*var\(--asv-component-right-panel-width\)/.test(tokens)
    && /--asv-component-layer-row-min-height:\s*56px/.test(tokens)
    && /--asv-component-layer-row-thumb-size:\s*48px/.test(tokens)
    && /--asv-component-layer-panel-padding-block-start:\s*var\(--asv-base-space-48\)/.test(tokens)
    && /--asv-component-compare-metric-column-min-height:\s*347px/.test(tokens)
    && /--asv-component-compare-mode-header-min-height:\s*54px/.test(tokens)
    && /--asv-compare-mode-header-divider:\s*var\(--asv-component-compare-mode-header-divider\)/.test(tokens)
    && /--asv-component-dialog-backdrop-background:/.test(tokens)
    && /--asv-component-settings-sheet-min-height:\s*300px/.test(tokens)
    && /--asv-component-settings-sheet-border:\s*1px solid/.test(tokens)
    && /--asv-component-settings-sheet-radius:\s*var\(--asv-base-radius-24\)/.test(tokens)
    && /--asv-component-settings-sheet-background:/.test(tokens)
    && /--asv-component-settings-sheet-shadow:/.test(tokens)
    && /--asv-component-settings-sheet-padding:\s*var\(--asv-space-6\)/.test(tokens)
    && /--asv-component-settings-sheet-gap:\s*var\(--asv-space-4\)/.test(tokens)
    && /--asv-component-settings-title-row-height:\s*22px/.test(tokens)
    && /--asv-component-settings-title-icon-size:\s*20px/.test(tokens)
    && /--asv-component-settings-title-size:\s*var\(--asv-type-size-metric\)/.test(tokens)
    && /--asv-component-settings-title-weight:\s*var\(--asv-type-weight-semibold\)/.test(tokens)
    && /--asv-component-settings-action-height:\s*44px/.test(tokens)
    && /--asv-component-settings-appearance-block-height:\s*116px/.test(tokens)
    && /--asv-component-settings-appearance-block-gap:\s*var\(--asv-base-space-10\)/.test(tokens)
    && /--asv-component-settings-appearance-block-padding-block:\s*var\(--asv-base-space-0\)/.test(tokens)
    && /--asv-component-settings-choice-height:\s*88px/.test(tokens)
    && /--asv-component-settings-choice-icon-size:\s*20px/.test(tokens)
    && /--asv-component-settings-choice-label-size:\s*var\(--asv-type-size-caption\)/.test(tokens)
    && /--asv-component-settings-choice-selected-border:\s*var\(--asv-color-border-focus\)/.test(tokens)
    && /--asv-component-settings-choice-selected-bg:\s*var\(--asv-color-status-info-soft\)/.test(tokens)
    && /--asv-component-layer-panel-header-height:\s*50px/.test(tokens)
    && /--asv-component-edit-reserved-gap:\s*var\(--asv-space-2\)/.test(tokens)
    && /--asv-component-edit-reserved-title-size:\s*var\(--asv-type-size-body\)/.test(tokens)
    && /--asv-component-edit-reserved-title-color:\s*var\(--asv-color-text-secondary\)/.test(tokens)
    && /--asv-component-edit-reserved-message-size:\s*var\(--asv-type-size-caption\)/.test(tokens)
    && /--asv-component-edit-reserved-message-color:\s*var\(--asv-color-text-tertiary\)/.test(tokens)
    && /\.previewView,\s*\.workbenchStateView\s*\{[\s\S]*gap: var\(--asv-preview-gap\)[\s\S]*padding: var\(--asv-preview-gap\)/.test(pageStatesCss)
    && /\.compareMetricGrid\s*\{[\s\S]*grid-template-columns: repeat\(2, minmax\(0, 1fr\)\)[\s\S]*gap: var\(--asv-compare-metric-column-gap\)/.test(modules)
    && /\.compareModeHeader\s*\{[\s\S]*min-height: var\(--asv-compare-mode-header-min-height\)[\s\S]*border-bottom: var\(--asv-compare-mode-header-divider\)/.test(modules)
    && /\.compareMetricColumn\s*\{[\s\S]*min-height: var\(--asv-compare-metric-column-min-height\)[\s\S]*background: var\(--asv-compare-metric-column-bg\)/.test(modules)
    && /\.layerPanelHeader\s*\{[\s\S]*min-height: var\(--asv-layer-panel-header-height\)/.test(modules)
    && /\.layerList\s*\{[\s\S]*gap: var\(--asv-layer-list-gap\)/.test(modules)
    && /data-role="EditReservedPlaceholder"/.test(page)
    && /<h2>编辑操作区<\/h2>/.test(page)
    && /<span>短期版本保留占位<\/span>/.test(page)
    && /<span>高级功能后续规划<\/span>/.test(page)
    && /\.reservedPanel\s*\{[\s\S]*display: grid[\s\S]*place-items: center/.test(modules)
    && /\.editReservedPlaceholder\s*\{[\s\S]*gap: var\(--asv-edit-reserved-gap\)[\s\S]*text-align: center/.test(modules)
    && /\.settingsDialog \.dialogBody\s*\{[\s\S]*gap: var\(--asv-settings-sheet-gap\)[\s\S]*padding: var\(--asv-settings-sheet-padding\) 0/.test(components)
    && /\.appDialog::backdrop\s*\{[\s\S]*background: var\(--asv-dialog-backdrop-bg\)/.test(components)
    && /\.settingsDialog\s*\{[\s\S]*border: var\(--asv-settings-sheet-border\)[\s\S]*border-radius: var\(--asv-settings-sheet-radius\)[\s\S]*background: var\(--asv-settings-sheet-bg\)[\s\S]*box-shadow: var\(--asv-settings-sheet-shadow\)/.test(components)
    && /\.settingsHeader h2\s*\{[\s\S]*min-height: var\(--asv-settings-title-row-height\)/.test(components)
    && /\.settingsDialog \.dialogActions button\s*\{[\s\S]*min-height: var\(--asv-settings-action-height\)/.test(components)
    && /\.settingsGroup\s*\{[\s\S]*gap: var\(--asv-settings-appearance-block-gap\)[\s\S]*min-height: var\(--asv-settings-appearance-block-height\)[\s\S]*padding-block: var\(--asv-settings-appearance-block-padding-block\)/.test(components)
    && /\.settingsChoice\s*\{[\s\S]*grid-template-columns: minmax\(0, 1fr\)[\s\S]*grid-template-rows: auto auto/.test(components)
    && /const rows = renderCompareMetricColumns\(aModel, bModel\)/.test(compareModel)
    && /data-diff="\$\{escapeHtml\(diff\)\}"/.test(compareModel)
    && !/<span>\$\{escapeHtml\(aTitle\)\}<\/span>|<span>\$\{escapeHtml\(bTitle\)\}<\/span>/.test(compareModel)
    && !/compareMetricRow/.test(compareModel));

  record("figma-r10-atom-molecule-contract-covered", /--asv-component-text-input-width:\s*172px/.test(tokens)
    && /--asv-component-text-input-height:\s*24px/.test(tokens)
    && /--asv-component-text-input-padding-block:\s*var\(--asv-base-space-4\)/.test(tokens)
    && /--asv-component-text-input-padding-inline:\s*var\(--asv-base-space-8\)/.test(tokens)
    && /--asv-component-text-input-font-size:\s*var\(--asv-type-size-caption\)/.test(tokens)
    && /--asv-component-file-header-action-width:\s*72px/.test(tokens)
    && /--asv-component-metric-entry-gap:\s*var\(--asv-base-space-2\)/.test(tokens)
    && /--asv-component-metric-entry-padding-block:\s*var\(--asv-base-space-2\)/.test(tokens)
    && /--asv-component-asset-row-min-height:\s*56px/.test(tokens)
    && /--asv-component-asset-row-gap:\s*var\(--asv-space-3\)/.test(tokens)
    && /--asv-component-layer-row-min-height:\s*56px/.test(tokens)
    && /--asv-component-layer-row-gap:\s*var\(--asv-base-space-10\)/.test(tokens)
    && /--asv-component-finding-row-min-height:\s*62px/.test(tokens)
    && /--asv-component-finding-row-gap:\s*var\(--asv-space-2\)/.test(tokens)
    && /--asv-component-asset-filter-width:\s*235px/.test(tokens)
    && /--asv-component-asset-filter-height:\s*34px/.test(tokens)
    && /--asv-component-asset-section-head-gap:\s*var\(--asv-space-2\)/.test(tokens)
    && /--asv-component-asset-filter-tab-font-size:\s*var\(--asv-type-size-micro\)/.test(tokens)
    && /--asv-component-toast-height:\s*44px/.test(tokens)
    && /--asv-component-toast-width:\s*280px/.test(tokens)
    && /--asv-component-toast-failure-width:\s*320px/.test(tokens)
    && /\.renameInputInline\s*\{[\s\S]*height: var\(--asv-text-input-height\)[\s\S]*padding: var\(--asv-text-input-padding-block\) var\(--asv-text-input-padding-inline\)/.test(molecules)
    && /\.runtimeTextInput\s*\{[\s\S]*width: min\(var\(--asv-runtime-text-input-width\), 100%\)[\s\S]*height: var\(--asv-text-input-height\)[\s\S]*font-size: var\(--asv-text-input-font-size\)/.test(molecules)
    && /\.metricOptimizationEntry\s*\{[\s\S]*gap: var\(--asv-metric-entry-gap\)[\s\S]*padding: var\(--asv-metric-entry-padding-block\) var\(--asv-metric-entry-padding-inline\)/.test(components)
    && /\.sectionHead\.assetSectionHead\s*\{[\s\S]*display: grid[\s\S]*gap: var\(--asv-asset-section-head-gap\)/.test(modules)
    && /\.sectionHead\.assetSectionHead h2\s*\{[\s\S]*white-space: nowrap/.test(modules)
    && /\.assetFilterTabs\s*\{[\s\S]*width: min\(var\(--asv-asset-filter-width\), 100%\)[\s\S]*min-height: var\(--asv-asset-filter-height\)/.test(modules)
    && /\.canvasToast\s*\{[\s\S]*width: min\(var\(--asv-toast-failure-width\), 60%\)[\s\S]*min-height: var\(--asv-toast-height\)/.test(modules));

  record("page-state-recovery-uses-canvas-first-contract", /--asv-component-state-canvas-checker-size:\s*var\(--asv-component-preview-checker-size\)/.test(tokens)
    && /--asv-component-state-canvas-background:\s*[\s\S]*var\(--asv-component-canvas-checker-pattern\),[\s\S]*var\(--asv-color-surface-canvas\)/.test(tokens)
    && /--asv-state-canvas-bg:\s*var\(--asv-component-state-canvas-background\)/.test(tokens)
    && /\.stateCanvasWrap\s*\{[\s\S]*background:\s*[\s\S]*var\(--asv-state-canvas-bg\)[\s\S]*background-size: var\(--asv-state-canvas-checker-size\) var\(--asv-state-canvas-checker-size\), auto/.test(modules)
    && /<section class="view stateView workbenchStateView" data-view="loading"[\s\S]*data-page-state="Loading"/.test(page)
    && /<section class="view stateView workbenchStateView" data-view="failed"[\s\S]*data-page-state="Load failed"/.test(page)
    && /id="playbackErrorRecovery"[^>]*data-page-state="Playback error"/.test(page)
    && /\.workbenchStateView\s*\{[^}]*place-items: stretch/s.test(pageStatesCss));
  record("drag-decision-follows-frozen-typography-and-owner-zone-contract",
    /--asv-component-drag-overlay-label-size:\s*var\(--asv-type-size-metric\)/.test(tokens)
    && /--asv-component-drag-overlay-label-line-height:\s*22px/.test(tokens)
    && /--asv-component-drag-overlay-label-weight:\s*var\(--asv-type-weight-semibold\)/.test(tokens)
    && /--asv-component-drag-overlay-grid-rows:\s*1fr 3fr/.test(tokens)
    && /\.dragDecisionZone strong\s*\{[\s\S]*line-height:\s*var\(--asv-drag-overlay-label-line-height\)/.test(modules)
    && !/--asv-component-drag-overlay-label-size:\s*(?:30|36)px/.test(tokens));
  record("unsupported-drop-keeps-workbench-recovery-shell",
    /data-page-state="Unsupported drop"/.test(unsupportedSection)
    && /data-role="UnsupportedDropCanvasRecovery"/.test(unsupportedSection)
    && /class="stateCard error stateFailureCard unsupportedDropRecoveryPanel"[^>]*id="unsupportedDropRecovery"[^>]*data-component="ErrorRecoveryPanel"/.test(unsupportedSection)
    && /class="stateFailureIcon" aria-hidden="true"/.test(unsupportedSection)
    && !/class="stateCard error playbackErrorPanel unsupportedDropRecoveryPanel"/.test(unsupportedSection)
    && /data-state="disabled"/.test(unsupportedSection)
    && /\.unsupportedDropView\s*\{[\s\S]*grid-template-columns:\s*minmax\(0, 1fr\)/.test(pageStatesCss));

  record("page-state-surface-trace-contract", /<aside class="rightPanel"[^>]*data-component="RightInformationSurface"[^>]*data-panel-state="overview"/.test(page)
    && /id="panelOverview"[^>]*data-panel="overview"[^>]*data-page-state="Preview overview"[^>]*data-module="OverviewInformationModule"/.test(page)
    && /class="replaceableSection"(?=[^>]*data-module="ReplaceableElementsSurface")(?=[^>]*data-page-state="Preview replaceable")[^>]*>/.test(page)
    && /id="panelOptimization"[^>]*data-panel="optimization"[^>]*data-page-state="Preview optimization"[^>]*data-module="OptimizationDetailSurface"/.test(page)
    && /id="settingsDialog"[^>]*data-component="SettingsSheet"[^>]*data-module="SettingsDialogModule"[^>]*data-page-state="Settings dialog"/.test(page)
    && /data-view="compare"[^>]*data-page-state="General comparing"[^>]*data-module="GeneralCompareModule"[^>]*data-state-mode="general"/.test(page)
    && /id="compareInfoB"(?=[^>]*data-component="RightInformationSurface")(?=[^>]*data-role="CompareInfoPanel")[^>]*>/.test(page)
    && /stateMode:\s*"general"/.test(compareModel)
    && /stateMode:\s*"optimization"/.test(compareModel)
    && /pageState:\s*"General comparing"/.test(compareModel)
    && /class="compareMetricColumn" data-component="CompareMetricColumn"/.test(compareModel)
    && !/pageState:\s*"Optimization compare"/.test(compareModel)
    && /const surfaceState = tab === "replaceable" \? "replaceable" : activePanel/.test(await readFile(path.join(webRoot, "short-term-macos-dom-state.mjs"), "utf8"))
    && /rightPanel\.dataset\.panelState = surfaceState/.test(await readFile(path.join(webRoot, "short-term-macos-dom-state.mjs"), "utf8"))
    && /node\.dataset\.stateMode = view\.stateMode/.test(await readFile(path.join(webRoot, "short-term-macos-compare-renderers.mjs"), "utf8")));

  record("settings-sheet-keeps-boundary-light-grouping", /--asv-component-settings-divider-width:\s*1px/.test(tokens)
    && /\.settingsGroup\s*\{[\s\S]*border-top: var\(--asv-settings-divider-width\) solid var\(--asv-settings-divider-color\)[\s\S]*border-bottom: var\(--asv-settings-divider-width\) solid var\(--asv-settings-divider-color\)/.test(components));

  record("focus-visible-covered-by-ui-layers", [atoms, molecules, components, modules].every((source) => source.includes(":focus-visible")));
  record("reduced-motion-covered", /@media \(prefers-reduced-motion: reduce\)/.test(pageStatesCss)
    && /animation-duration:\s*var\(--asv-reduced-motion-duration\) !important/.test(pageStatesCss)
    && /transition-duration:\s*var\(--asv-reduced-motion-duration\) !important/.test(pageStatesCss)
    && /--asv-reduced-motion-duration:\s*var\(--asv-motion-duration-reduced\)/.test(tokens));
  record("launch-checker-idle-motion-tokenized", /--asv-motion-duration-idle/.test(tokens)
    && /--asv-component-launch-checker-idle-duration:\s*var\(--asv-motion-duration-idle\)/.test(tokens)
    && /animation:\s*launchCheckerIdleDrift var\(--asv-launch-checker-idle-duration\) var\(--asv-launch-checker-idle-easing\) infinite/.test(modules)
    && /@keyframes launchCheckerIdleDrift/.test(modules)
    && /\.launchCanvas\.isDragOver\s*\{[\s\S]*animation-play-state:\s*paused/.test(modules)
    && /\.launchCanvas\s*\{[\s\S]*animation:\s*none !important/.test(pageStatesCss)
    && /\.launchCanvas\s*\{[\s\S]*background-position:\s*0 0, 0 0 !important/.test(pageStatesCss));
  record("reduced-transparency-covered", /@media \(prefers-reduced-transparency: reduce\)/.test(pageStatesCss)
    && /--asv-effect-titlebar-backdrop-filter:\s*none/.test(pageStatesCss)
    && /--asv-effect-menu-backdrop-filter:\s*none/.test(pageStatesCss)
    && /--asv-effect-drag-overlay-backdrop-filter:\s*none/.test(pageStatesCss)
    && /\.titlebar,\s*\.contextMenu,\s*\.dragDecisionOverlay\s*\{[\s\S]*backdrop-filter:\s*none/.test(pageStatesCss)
    && /backdrop-filter:\s*var\(--asv-effect-menu-backdrop-filter\)/.test(components)
    && /backdrop-filter:\s*var\(--asv-drag-overlay-backdrop-filter\)/.test(modules));
  record("minimum-window-boundary-explicit", /--asv-layout-launch-min-width:\s*640px/.test(tokens)
    && /--asv-layout-launch-min-height:\s*640px/.test(tokens)
    && /--asv-layout-workbench-min-width:\s*1180px/.test(tokens)
    && /--asv-layout-workbench-min-height:\s*760px/.test(tokens)
    && /--asv-launch-min-width:\s*var\(--asv-layout-launch-min-width\)/.test(tokens)
    && /--asv-workbench-min-width:\s*var\(--asv-layout-workbench-min-width\)/.test(tokens)
    && /body\s*\{[\s\S]*min-width:\s*var\(--asv-launch-min-width\)[\s\S]*min-height:\s*var\(--asv-launch-min-height\)/.test(baseCss)
    && /\.macApp\s*\{[\s\S]*min-width:\s*var\(--asv-launch-min-width\)[\s\S]*min-height:\s*var\(--asv-launch-min-height\)/.test(pageStatesCss)
    && /\.macApp\[data-app-state="preview"\],[\s\S]*\.macApp\[data-app-state="unsupported"\]\s*\{[\s\S]*min-width:\s*min\(var\(--asv-workbench-min-width\), 100vw\)[\s\S]*min-height:\s*min\(var\(--asv-workbench-min-height\), 100vh\)/.test(pageStatesCss)
    && /\.compareView\s*\{[\s\S]*min-width:\s*0/.test(pageStatesCss)
    && /\.compareCanvasSurface\s*\{[\s\S]*min-width:\s*0/.test(modules)
    && /\.compareStage\s*\{[\s\S]*min-width:\s*0/.test(modules)
    && /\.compareCanvasWrap\s*\{[\s\S]*min-width:\s*0/.test(modules)
    && /@media \(max-width: 1080px\)/.test(pageStatesCss)
    && /@media \(max-height: 780px\)/.test(pageStatesCss));
  record("figma-page-frame-layout-contract-covered", /--asv-layout-page-launch-frame-width:\s*640px/.test(tokens)
    && /--asv-layout-page-launch-frame-height:\s*640px/.test(tokens)
    && /--asv-layout-page-workbench-frame-width:\s*1280px/.test(tokens)
    && /--asv-layout-page-workbench-frame-height:\s*800px/.test(tokens)
    && /--asv-layout-page-workbench-center-width:\s*920px/.test(tokens)
    && /--asv-layout-page-edit-center-width:\s*560px/.test(tokens)
    && /--asv-page-launch-frame-width:\s*var\(--asv-layout-page-launch-frame-width\)/.test(tokens)
    && /--asv-page-workbench-frame-width:\s*var\(--asv-layout-page-workbench-frame-width\)/.test(tokens)
    && /launch:\s*\{\s*width:\s*640,\s*height:\s*640\s*\}/.test(mainProcess)
    && /shortTermWorkbench:\s*\{\s*width:\s*1280,\s*height:\s*800\s*\}/.test(mainProcess)
    && /comfortable:\s*\{\s*width:\s*1280,\s*height:\s*800\s*\}/.test(mainProcess)
    && /const targetSize = usesShortTermPreviewShell[\s\S]*macosWorkbenchWindowSizing\.shortTermWorkbench[\s\S]*macosWorkbenchWindowSizing\.defaultWorkbench/.test(mainProcess)
    && /scenario === "short-term-preview-overview"\) window\.setContentSize\(macosWorkbenchWindowSizing\.shortTermWorkbench\.width, macosWorkbenchWindowSizing\.shortTermWorkbench\.height\)/.test(mainProcess)
    && /scenario === "short-term-preview-overview-wide"\) window\.setContentSize\(macosWorkbenchWindowSizing\.defaultWorkbench\.width, macosWorkbenchWindowSizing\.defaultWorkbench\.height\)/.test(mainProcess)
    && /scenario === "short-term-general-compare"\) window\.setContentSize\(macosWorkbenchWindowSizing\.shortTermWorkbench\.width, macosWorkbenchWindowSizing\.shortTermWorkbench\.height\)/.test(mainProcess)
    && /scenario === "short-term-settings-dialog"\) window\.setContentSize\(macosWorkbenchWindowSizing\.shortTermWorkbench\.width, macosWorkbenchWindowSizing\.shortTermWorkbench\.height\)/.test(mainProcess)
    && /scenario === "short-term-edit-reserved"\) window\.setContentSize\(macosWorkbenchWindowSizing\.shortTermWorkbench\.width, macosWorkbenchWindowSizing\.shortTermWorkbench\.height\)/.test(mainProcess)
    && /minimumLaunch:\s*\{\s*width:\s*640,\s*height:\s*640\s*\}/.test(mainProcess)
    && /minimumSupported:\s*\{\s*width:\s*1180,\s*height:\s*760\s*\}/.test(mainProcess)
    && /width:\s*640,\s*height:\s*640/.test(windowBoundsPolicy), {
    source: "R6/R8/R9 page-state dimensions plus short-term window bounds policy"
  });

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
