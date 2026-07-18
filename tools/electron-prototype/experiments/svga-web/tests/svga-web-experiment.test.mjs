import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { deflateSync } from "node:zlib";
import { readFileSync } from "node:fs";
import { copyFile, link, mkdir, mkdtemp, readFile, readdir, rename, rm, stat, symlink, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import os from "node:os";
import { test } from "node:test";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import vm from "node:vm";
import protobuf from "protobufjs";
import { legacyBrowserBaselineAuditCsp, strictCsp, startSvgaWebExperimentServer } from "../server.mjs";
import {
  appName,
  assertPackagedRuntimeClosure,
  auditInfoPlistSecurity,
  buildMacosPackageProof,
  bundleIdentifier,
  bundleShortVersion,
  bundleVersion,
  candidateChannel,
  distributionChannel,
  finalAcceptanceOwner,
  macosPackagerArgs,
  ownerVisibleLabel,
  packagedRuntimeDependencies,
  productName,
  productVersion,
  productVersionLine,
  releaseStage,
  requiredPackagedRuntimeEntries,
  validateProof,
  windowPlacementPackagedSourceAuthorities,
  windowPlacementPackagedSourceFiles
} from "../scripts/macos-package-proof.mjs";

const require = createRequire(import.meta.url);
const experimentRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const repoRoot = path.resolve(experimentRoot, "../../../..");
const requireFromPrototype = createRequire(path.join(experimentRoot, "../..", "package.json"));
const vendorPath = path.join(experimentRoot, "vendor/svga-web-2.4.4.js");
const hostContract = require("../host-adapter-contract.cjs");
const { createDesktopArtifactCatalog } = require("../desktop-artifact-catalog.cjs");
const {
  preserveWindowSizeAcrossDisplay
} = require("../short-term-window-bounds-policy.cjs");
const {
  validateSequenceByteRepairProof,
  validateSequenceProductRepairProof,
  validateSequenceRepairReportBinding
} = require("../sequence-repair-proof-contract.cjs");
const {
  MULTIFORMAT_DESKTOP_PRODUCT_MILESTONE_ID,
  createMultiFormatDesktopPreviewSession
} = require("../multiformat-desktop-session.cjs");

function extractFunctionSource(source, signature) {
  const start = source.indexOf(signature);
  assert.notEqual(start, -1, `missing function signature: ${signature}`);
  const bodyStart = source.indexOf("{", start);
  assert.notEqual(bodyStart, -1, `missing function body: ${signature}`);
  let depth = 0;
  for (let index = bodyStart; index < source.length; index += 1) {
    const char = source[index];
    if (char === "{") depth += 1;
    if (char === "}") {
      depth -= 1;
      if (depth === 0) return source.slice(start, index + 1);
    }
  }
  throw new Error(`unterminated function source: ${signature}`);
}

async function exposePreloadGlobals(productMilestoneId, hostBoundaryMode = "formal") {
  const preloadSource = await readFile(path.join(experimentRoot, "preload.cjs"), "utf8");
  const exposed = {};
  const invocations = [];
  const context = {
    Buffer,
    console,
    process: {
      argv: [
        "electron",
        "preload.cjs",
        "--prototype-report-token=test-token",
        `--prototype-product-milestone=${productMilestoneId}`,
        `--prototype-host-boundary=${hostBoundaryMode}`
      ]
    },
    require(specifier) {
      if (specifier === "electron") {
        return {
          contextBridge: {
            exposeInMainWorld(name, api) {
              exposed[name] = api;
            }
          },
          ipcRenderer: {
            invoke(channel, input) {
              invocations.push({ channel, input });
              return { channel, input };
            }
          },
          webUtils: {
            getPathForFile(file) {
              return typeof file?.path === "string" ? file.path : "";
            }
          }
        };
      }
      return require(specifier);
    }
  };
  vm.runInNewContext(preloadSource, context, {
    filename: path.join(experimentRoot, "preload.cjs")
  });
  return { exposed, invocations };
}

test("short-term metric values split units only for simple numeric facts", async () => {
  const { formatDisplayDetailCopy, renderMetricValueHtml, renderOptimizationMetricCellHtml } = await import(pathToFileURL(path.join(experimentRoot, "web/short-term-macos-render-model.mjs")).href);
  assert.equal(renderMetricValueHtml("104.5 KiB"), "104.5 <span class=\"factValueUnit\">KiB</span>");
  assert.equal(renderMetricValueHtml("300 x 300 px"), "300×300 <span class=\"factValueUnit\">px</span>");
  assert.equal(formatDisplayDetailCopy("VAP 融合图片 · 120 x 80 · 1.5 KiB"), "VAP 融合图片 · 120×80 · 1.5 KiB");
  assert.equal(renderMetricValueHtml("低风险 / 估算 125.6 KiB"), "低风险 / 估算 125.6 KiB");
  assert.match(renderOptimizationMetricCellHtml({
    label: "文件体积",
    before: "302 B",
    after: "242 B",
    improved: true
  }), /302 <span class="factValueUnit">B<\/span>[\s\S]*242 <span class="factValueUnit">B<\/span>/);
});

test("short-term right surface normalizes core fact labels to frozen design copy", async () => {
  const {
    factDisplayLabel,
    renderCompareFactCellHtml,
    renderOverviewFactCellHtml
  } = await import(pathToFileURL(path.join(experimentRoot, "web/short-term-macos-render-model.mjs")).href);
  const legacyFacts = [
    { id: "fileSize", label: "文件体积", value: "2.4 MiB", status: "warning" },
    { id: "decodedMemory", label: "估算内存", value: "20.6 MiB", status: "pass" },
    { id: "canvas", label: "画布", value: "300 x 300 px", status: "pass" },
    { id: "fps", label: "FPS", value: "30 fps", status: "pass" }
  ];
  const labels = legacyFacts.map(factDisplayLabel);
  const html = [
    renderOverviewFactCellHtml(legacyFacts[0]),
    renderOverviewFactCellHtml(legacyFacts[1]),
    renderCompareFactCellHtml(legacyFacts[2]),
    renderCompareFactCellHtml(legacyFacts[3])
  ].join("");

  assert.deepEqual(labels, ["文件大小", "内存占用", "画布尺寸", "帧率"]);
  assert.match(html, /文件大小/);
  assert.match(html, /内存占用/);
  assert.match(html, /画布尺寸/);
  assert.match(html, /帧率/);
  assert.doesNotMatch(html, /文件体积|估算内存|>画布<|>FPS</);
  assert.match(html, /aria-label="文件大小可优化"/);
});

test("short-term playback loop toggle updates player loop state", async () => {
  const { togglePrimaryPlaybackLoopState } = await import(pathToFileURL(path.join(experimentRoot, "web/short-term-macos-playback-loop-model.mjs")).href);
  const state = {
    primaryPlaybackLooping: true,
    primaryPlayback: {
      looping: true
    }
  };

  const first = togglePrimaryPlaybackLoopState(state);

  assert.equal(state.primaryPlaybackLooping, false);
  assert.equal(state.primaryPlayback.looping, false);
  assert.equal(first.looping, false);

  const second = togglePrimaryPlaybackLoopState(state);

  assert.equal(state.primaryPlaybackLooping, true);
  assert.equal(state.primaryPlayback.looping, true);
  assert.equal(second.looping, true);
});

test("short-term save banner states expose direct accessible page-state semantics", async () => {
  const {
    bannerTone,
    saveBannerA11yState,
    saveBannerView,
    sourceUnmodifiedMessage
  } = await import(pathToFileURL(path.join(experimentRoot, "web/short-term-macos-feedback-model.mjs")).href);
  const { showSaveFeedbackBanner, clearSaveFeedbackBanner } = await import(pathToFileURL(path.join(experimentRoot, "web/short-term-macos-save-renderers.mjs")).href);

  assert.equal(bannerTone("正在保存并验证输出…"), "loading");
  assert.equal(bannerTone("优化执行中…"), "loading");
  assert.equal(bannerTone("已保存"), "success");
  assert.equal(bannerTone("保存失败，请重试"), "danger");
  assert.equal(bannerTone("已取消保存。"), "warning");
  assert.deepEqual(saveBannerA11yState("loading"), {
    role: "status",
    ariaLive: "polite",
    ariaBusy: "true"
  });
  assert.deepEqual(saveBannerA11yState("danger"), {
    role: "alert",
    ariaLive: "assertive",
    ariaBusy: "false"
  });

  const loadingView = saveBannerView("正在保存并验证输出…", "");
  assert.equal(loadingView.status, "loading");
  assert.equal(loadingView.role, "status");
  assert.equal(loadingView.ariaBusy, "true");
  assert.match(loadingView.html, /正在保存并验证输出…/);
  assert.doesNotMatch(loadingView.html, /<span>/);

  const attributes = new Map();
  const node = {
    hidden: true,
    dataset: {},
    innerHTML: "",
    setAttribute(name, value) {
      attributes.set(name, value);
    },
    removeAttribute(name) {
      attributes.delete(name);
      if (name === "data-status") delete this.dataset.status;
    }
  };

  const failedView = showSaveFeedbackBanner(node, "保存失败，请重试", "源文件没有被修改。");
  assert.equal(failedView.status, "danger");
  assert.equal(node.hidden, false);
  assert.equal(node.dataset.status, "danger");
  assert.equal(attributes.get("role"), "alert");
  assert.equal(attributes.get("aria-live"), "assertive");
  assert.equal(attributes.get("aria-busy"), "false");
  assert.match(node.innerHTML, /源文件没有被修改。/);

  clearSaveFeedbackBanner(node);
  assert.equal(node.hidden, true);
  assert.equal(node.dataset.status, undefined);
  assert.equal(attributes.has("role"), false);
  assert.equal(attributes.get("aria-live"), "polite");
  assert.equal(attributes.get("aria-busy"), "false");

  assert.equal(sourceUnmodifiedMessage("磁盘写入失败。"), "磁盘写入失败。 源文件没有被修改。");
  const saveSurface = await readFile(path.join(experimentRoot, "web/short-term-macos-save-surface.mjs"), "utf8");
  const commandState = await readFile(path.join(experimentRoot, "web/short-term-macos-command-state.mjs"), "utf8");
  assert.match(saveSurface, /import \{ sourceUnmodifiedMessage \} from "\.\/short-term-macos-feedback-model\.mjs";/);
  assert.match(saveSurface, /showSaveBanner\("正在保存并验证输出…", ""\)/);
  assert.match(saveSurface, /showSaveBanner\("已保存", ""\)/);
  assert.match(saveSurface, /showSaveBanner\("保存失败，请重试", sourceUnmodifiedMessage/);
  assert.match(commandState, /正在保存并验证输出/);
  assert.doesNotMatch(commandState, /正在验证保存输出/);
});

test("short-term loading and load-failed states expose recovery actions", async () => {
  const page = await readFile(path.join(experimentRoot, "web/index.html"), "utf8");
  const loadingSection = page.match(/<section class="view stateView workbenchStateView" data-view="loading"[\s\S]*?<\/aside>\s*<\/section>/)?.[0] ?? "";
  const failedSection = page.match(/<section class="view stateView workbenchStateView" data-view="failed"[\s\S]*?<\/aside>\s*<\/section>/)?.[0] ?? "";
  const staleStateContentPattern = /id="fileIdentity"|class="factGrid"|id="assetList"|id="replaceableList"|toolbarClusterSave|data-action="save-as"|data-action="save-overwrite"/;

  assert.match(loadingSection, /aria-live="polite"[^>]*aria-busy="true"[^>]*role="status"[^>]*data-page-state="Loading"/);
  assert.match(loadingSection, /data-module="PreviewCanvasModule"/);
  assert.match(loadingSection, /data-module="StateRecoveryModule"/);
  assert.match(loadingSection, /data-role="LoadingCanvasRecovery"/);
  assert.match(loadingSection, /<h1>正在加载…<\/h1>/);
  assert.match(loadingSection, /<p id="loadingMessage"><\/p>/);
  assert.doesNotMatch(loadingSection, /读取文件并准备预览。|解析文件并准备预览。|正在打开最近文件。/);
  assert.match(loadingSection, /<button class="toolbarButton primary stateRecoveryButton" type="button" data-action="open">[\s\S]*?<span>打开文件<\/span>/);
  assert.match(loadingSection, /<div class="playbackBar statePlaybackBar"[^>]*data-state="disabled"/);
  assert.doesNotMatch(loadingSection, staleStateContentPattern);

  assert.match(failedSection, /aria-live="assertive"[^>]*role="alert"[^>]*data-page-state="Load failed"/);
  assert.match(failedSection, /data-module="PreviewCanvasModule"/);
  assert.match(failedSection, /data-module="StateRecoveryModule"/);
  assert.match(failedSection, /data-role="FailureCanvasRecovery"/);
  assert.match(failedSection, /文件加载失败/);
  assert.match(failedSection, /文件格式不受支持或已损坏/);
  assert.match(failedSection, /<button class="toolbarButton primary stateRecoveryButton" type="button" data-action="open">[\s\S]*?<span>打开文件<\/span>/);
  assert.match(failedSection, /<div class="playbackBar statePlaybackBar"[^>]*data-state="disabled"/);
  assert.doesNotMatch(failedSection, staleStateContentPattern);
});

test("short-term preview right surface exposes page-state trace semantics", async () => {
  const page = await readFile(path.join(experimentRoot, "web/index.html"), "utf8");
  const { applyTabState } = await import(pathToFileURL(path.join(experimentRoot, "web/short-term-macos-dom-state.mjs")).href);
  const {
    generalCompareTraceView,
    optimizationCompareTraceView
  } = await import(pathToFileURL(path.join(experimentRoot, "web/short-term-macos-compare-model.mjs")).href);
  const { applyCompareTraceView } = await import(pathToFileURL(path.join(experimentRoot, "web/short-term-macos-compare-renderers.mjs")).href);

  assert.match(page, /<aside class="rightPanel"[^>]*data-component="RightInformationSurface"[^>]*data-panel-state="overview"/);
  assert.match(page, /id="panelOverview"[^>]*data-panel="overview"[^>]*data-page-state="Preview overview"[^>]*data-module="OverviewInformationModule"/);
  assert.match(page, /id="panelOptimization"[^>]*data-panel="optimization"[^>]*data-page-state="Preview optimization"[^>]*data-module="OptimizationDetailSurface"/);
  assert.match(page, /id="settingsDialog"[^>]*data-component="SettingsSheet"[^>]*data-module="SettingsDialogModule"[^>]*data-page-state="Settings dialog"/);
  assert.match(page, /data-view="compare"[^>]*data-page-state="General comparing"[^>]*data-module="GeneralCompareModule"[^>]*data-state-mode="general"/);

  const rightPanel = { dataset: { panelState: "overview" } };
  const overviewPanel = {
    dataset: { panel: "overview" },
    hidden: false,
    classList: { toggle() {} }
  };
  const optimizationPanel = {
    dataset: { panel: "optimization" },
    hidden: true,
    classList: { toggle() {} }
  };
  const originalDocument = globalThis.document;
  globalThis.document = {
    querySelector(selector) {
      if (selector === ".rightPanel") return rightPanel;
      if (selector === "[data-panel=\"optimization\"]") return optimizationPanel;
      if (selector === ".replaceableSection") return { focus() {}, scrollIntoView() {} };
      return null;
    },
    querySelectorAll(selector) {
      return selector === "[data-panel]" ? [overviewPanel, optimizationPanel] : [];
    }
  };
  try {
    applyTabState("optimization");
    assert.equal(rightPanel.dataset.panelState, "optimization");
    assert.equal(overviewPanel.hidden, true);
    assert.equal(optimizationPanel.hidden, false);

    applyTabState("replaceable");
    assert.equal(rightPanel.dataset.panelState, "replaceable");
    assert.equal(overviewPanel.hidden, false);
    assert.equal(optimizationPanel.hidden, true);

    const compareView = { dataset: {} };
    applyCompareTraceView(compareView, generalCompareTraceView());
    assert.equal(compareView.dataset.module, "GeneralCompareModule");
    assert.equal(compareView.dataset.pageState, "General comparing");
    assert.equal(compareView.dataset.stateMode, "general");

    applyCompareTraceView(compareView, optimizationCompareTraceView());
    assert.equal(compareView.dataset.module, "OptimizationCompareModule");
    assert.equal(compareView.dataset.pageState, "General comparing");
    assert.equal(compareView.dataset.stateMode, "optimization");
  } finally {
    globalThis.document = originalDocument;
  }
});

test("short-term general compare renders loaded A/B facts through shared metric renderer", async () => {
  const { renderGeneralComparePanelHtml } = await import(pathToFileURL(path.join(experimentRoot, "web/short-term-macos-compare-model.mjs")).href);
  const aModel = {
    overview: {
      facts: [
        { id: "fileSize", label: "文件体积", value: "2.4 MiB", status: "warning" },
        { id: "canvas", label: "画布尺寸", value: "300 x 300 px", status: "pass" }
      ]
    }
  };
  const bModel = {
    overview: {
      facts: [
        { id: "fileSize", label: "文件体积", value: "1.2 MiB", status: "pass" },
        { id: "canvas", label: "画布尺寸", value: "300 x 300 px", status: "pass" }
      ]
    }
  };

  const html = renderGeneralComparePanelHtml({
    aModel,
    aDisplayName: "a.svga",
    bModel,
    bDisplayName: "b.svga"
  });

  assert.match(html, /data-slot="A"/);
  assert.match(html, /data-slot="B"/);
  assert.match(html, /2.4 <span class="factValueUnit">MiB<\/span>/);
  assert.match(html, /1.2 <span class="factValueUnit">MiB<\/span>/);
  assert.match(html, /文件大小/);
  assert.doesNotMatch(html, /文件体积/);
  assert.equal((html.match(/data-diff="different"/g) ?? []).length, 2);
  assert.equal((html.match(/data-diff="same"/g) ?? []).length, 2);
});

test("short-term general compare keeps open actions on canvas, not in right panel", async () => {
  const { renderGeneralComparePanelHtml } = await import(pathToFileURL(path.join(experimentRoot, "web/short-term-macos-compare-model.mjs")).href);

  const html = renderGeneralComparePanelHtml({
    actions: ['<button class="toolbarButton primary" type="button" data-action="exit-compare">退出对比</button>']
  });

  assert.match(html, /<h2>对比模式<\/h2>/);
  assert.equal((html.match(/未打开文件/g) ?? []).length, 2);
  assert.match(html, /data-action="exit-compare"/);
  assert.doesNotMatch(html, /comparePairOpenButton/);
  assert.doesNotMatch(html, /data-action="open-compare-a"/);
  assert.doesNotMatch(html, /data-action="open-compare-b"/);
});

test("short-term general compare marks asymmetric visible facts unavailable", async () => {
  const { renderGeneralComparePanelHtml } = await import(pathToFileURL(path.join(experimentRoot, "web/short-term-macos-compare-model.mjs")).href);
  const aModel = {
    overview: {
      facts: [
        { id: "fileSize", label: "文件体积", value: "2.4 MiB", status: "warning" },
        { id: "runtimeStructure", label: "运行结构风险", value: "高风险", status: "warning" }
      ]
    }
  };
  const bModel = {
    overview: {
      facts: [
        { id: "fileSize", label: "文件体积", value: "2.4 MiB", status: "pass" }
      ]
    }
  };

  const html = renderGeneralComparePanelHtml({ aModel, bModel });

  assert.match(html, /运行结构风险/);
  assert.equal((html.match(/data-diff="unavailable"/g) ?? []).length, 2);
  assert.match(html, />不可用<\/strong>/);
  assert.equal((html.match(/data-diff="same"/g) ?? []).length, 2);
});

test("short-term general compare keeps identical row order when both sides have unique facts", async () => {
  const { renderGeneralComparePanelHtml } = await import(pathToFileURL(path.join(experimentRoot, "web/short-term-macos-compare-model.mjs")).href);
  const aModel = {
    overview: {
      facts: [
        { id: "fileSize", label: "文件体积", value: "2.4 MiB", status: "pass" },
        { id: "decodedMemory", label: "估算内存", value: "20.6 MiB", status: "pass" },
        { id: "runtimeInvisibleRatio", label: "不可见记录占比", value: "32%", status: "warning" },
        { id: "canvas", label: "画布", value: "300 x 300 px", status: "pass" },
        { id: "fps", label: "FPS", value: "30 fps", status: "pass" },
        { id: "assetCount", label: "资源数量", value: "60", status: "pass" }
      ]
    }
  };
  const bModel = {
    overview: {
      facts: [
        { id: "fileSize", label: "文件体积", value: "2.4 MiB", status: "pass" },
        { id: "decodedMemory", label: "估算内存", value: "20.6 MiB", status: "pass" },
        { id: "sequenceFanoutRisk", label: "序列帧展开风险", value: "高风险", status: "warning" },
        { id: "canvas", label: "画布", value: "300 x 300 px", status: "pass" },
        { id: "fps", label: "FPS", value: "30 fps", status: "pass" },
        { id: "assetCount", label: "资源数量", value: "60", status: "pass" }
      ]
    }
  };
  const factIdsForSlot = (html, slot) => {
    const column = html.match(new RegExp(`<div class="compareMetricColumn"[^>]*data-slot="${slot}"[^>]*>([\\s\\S]*?)(?=\\s*<div class="compareMetricColumn"|\\s*</section>)`))?.[1] ?? "";
    return [...column.matchAll(/data-fact-id="([^"]+)"/g)].map((match) => match[1]);
  };

  const html = renderGeneralComparePanelHtml({ aModel, bModel });
  const aIds = factIdsForSlot(html, "A");
  const bIds = factIdsForSlot(html, "B");

  assert.deepEqual(aIds, [
    "fileSize",
    "decodedMemory",
    "runtimeInvisibleRatio",
    "canvas",
    "fps",
    "assetCount",
    "sequenceFanoutRisk"
  ]);
  assert.deepEqual(bIds, aIds);
  assert.equal((html.match(/data-diff="unavailable"/g) ?? []).length, 4);
});

test("short-term asset filters support roving keyboard model and interaction handler", async () => {
  const { nextAssetFilterForKey, assetFilterFocusTarget } = await import(pathToFileURL(path.join(experimentRoot, "web/short-term-macos-overview-model.mjs")).href);
  const { handleAssetFilterTabsKeydown } = await import(pathToFileURL(path.join(experimentRoot, "web/short-term-macos-event-bindings.mjs")).href);

  assert.equal(nextAssetFilterForKey("all", "ArrowRight"), "image");
  assert.equal(nextAssetFilterForKey("image", "ArrowDown"), "sequence");
  assert.equal(nextAssetFilterForKey("all", "ArrowLeft"), "audio");
  assert.equal(nextAssetFilterForKey("sequence", "Home"), "all");
  assert.equal(nextAssetFilterForKey("image", "End"), "audio");
  assert.equal(nextAssetFilterForKey("sequence", "Tab"), "sequence");
  assert.equal(assetFilterFocusTarget("sequence", "image"), "sequence");
  assert.equal(assetFilterFocusTarget("sequence", ""), "");

  let prevented = false;
  let stopped = false;
  let selectedFilter = "";
  const target = {
    dataset: { assetFilter: "all" },
    closest(selector) {
      return selector === "[data-action='asset-filter']" ? this : null;
    }
  };
  const handled = handleAssetFilterTabsKeydown({
    key: "End",
    target,
    preventDefault() {
      prevented = true;
    },
    stopPropagation() {
      stopped = true;
    }
  }, { assetFilter: "all" }, {
    setAssetFilter(nextFilter) {
      selectedFilter = nextFilter;
    }
  });

  assert.equal(handled, true);
  assert.equal(selectedFilter, "audio");
  assert.equal(prevented, true);
  assert.equal(stopped, true);
});

test("short-term asset empty filters follow frozen no-sequence and no-audio states", async () => {
  const { overviewTabView, assetFilterTabCopy, assetFilterEmptyCopy } = await import(pathToFileURL(path.join(experimentRoot, "web/short-term-macos-overview-model.mjs")).href);
  const { renderAssetList } = await import(pathToFileURL(path.join(experimentRoot, "web/short-term-macos-overview-renderers.mjs")).href);
  const originalDocument = globalThis.document;

  try {
    const nodes = createMultiFormatControllerTestNodes();
    globalThis.document = createMultiFormatControllerTestDocument(nodes);
    const model = {
      overview: {
        facts: [],
        audioGroup: {
          status: "empty",
          copy: "当前文件暂无音频资产"
        }
      },
      assets: [{
        kind: "image",
        name: "img_000",
        dimensions: "300 x 300",
        fileSize: "41.8 KB",
        findingCodes: [],
        thumbnail: { type: "image", resourceIds: [] }
      }]
    };
    const view = overviewTabView(model);

    assert.equal(assetFilterTabCopy({ label: "序列帧", count: 0 }), "序列帧");
    assert.equal(assetFilterTabCopy({ label: "音频", count: 3 }), "音频 (3)");
    assert.equal(assetFilterEmptyCopy("sequence"), "当前文件暂无序列帧资产");
    assert.equal(assetFilterEmptyCopy("audio"), "当前文件暂无音频资产");

    renderAssetList(nodes, view, model, "all");
    assert.equal(nodes.assetList.children.length, 1);
    assert.match(nodes.assetList.children[0].innerHTML, /300×300 · 41\.8 KB/u);
    assert.doesNotMatch(nodes.assetList.children[0].innerHTML, /300 x 300/u);

    renderAssetList(nodes, view, model, "sequence");
    assert.deepEqual(
      nodes.assetFilterTabs.children.map((child) => child.textContent),
      ["全部 (1)", "图片 (1)", "序列帧", "音频"]
    );
    assert.equal(nodes.assetList.children.length, 1);
    assert.equal(nodes.assetList.children[0].className, "emptyText");
    assert.equal(nodes.assetList.children[0].dataset.component, "InlineStatus");
    assert.equal(nodes.assetList.children[0].textContent, "当前文件暂无序列帧资产");

    renderAssetList(nodes, view, model, "audio");
    assert.equal(nodes.assetList.children.length, 1);
    assert.equal(nodes.assetList.children[0].textContent, "当前文件暂无音频资产");
  } finally {
    globalThis.document = originalDocument;
  }
});

async function createPackagedProofFixture({
  root,
  buildCommit,
  omitRuntimeEntries = [],
  packageVersionOverrides = {},
  omitWindowPlacementSourceFiles = [],
  windowPlacementSourceTransforms = {},
  plistTransform = (plist) => plist
}) {
  const appBundle = path.join(root, "Auto SVGA.app");
  const contents = path.join(appBundle, "Contents");
  const resources = path.join(contents, "Resources");
  await mkdir(resources, { recursive: true });

  const sourcePlist = await readFile(path.join(experimentRoot, "packaging/macos/Info.plist"), "utf8");
  await writeFile(
    path.join(contents, "Info.plist"),
    plistTransform(sourcePlist.replace("</dict>", "  <key>CFBundleExecutable</key>\n  <string>Auto SVGA</string>\n</dict>"))
  );
  await copyFile(
    path.join(experimentRoot, "packaging/macos/app-icon.icns"),
    path.join(resources, "electron.icns")
  );

  const omitted = new Set(omitRuntimeEntries);
  const asarSource = path.join(root, "asar-source");
  for (const entry of requiredPackagedRuntimeEntries) {
    if (omitted.has(entry)) continue;
    const relativeEntry = entry.replace(/^\//, "");
    const entryPath = path.join(asarSource, relativeEntry);
    await mkdir(path.dirname(entryPath), { recursive: true });
    if (relativeEntry === ".runtime/build-info.json") {
      await writeFile(entryPath, `${JSON.stringify({ schemaVersion: 1, buildCommit, source: "test-package-proof" }, null, 2)}\n`);
    } else if (relativeEntry.endsWith("/package.json")) {
      const packageName = relativeEntry.split("/node_modules/")[1].replace(/\/package\.json$/, "");
      const expected = packagedRuntimeDependencies.find((dependency) => dependency.packageName === packageName)?.expectedVersion;
      await writeFile(entryPath, `${JSON.stringify({
        name: packageName,
        version: packageVersionOverrides[packageName] ?? expected ?? "0.0.0-test"
      }, null, 2)}\n`);
    } else {
      await writeFile(entryPath, "module.exports = {};\n");
    }
  }
  for (const relativePath of windowPlacementPackagedSourceFiles) {
    if (omitWindowPlacementSourceFiles.includes(relativePath)) continue;
    const source = await readFile(path.join(experimentRoot, relativePath));
    const transform = windowPlacementSourceTransforms[relativePath];
    const packagedSource = transform ? Buffer.from(transform(source.toString("utf8")), "utf8") : source;
    const destination = path.join(asarSource, relativePath);
    await mkdir(path.dirname(destination), { recursive: true });
    await writeFile(destination, packagedSource);
  }

  const asar = requireFromPrototype("@electron/asar");
  const packagedAsarPath = path.join(resources, "app.asar");
  await asar.createPackage(asarSource, packagedAsarPath);
  return {
    appBundle,
    packagedAsarPath,
    archivePath: path.join(root, "Auto SVGA-darwin-arm64.zip")
  };
}

test("macOS internal package scaffold avoids unsupported Finder .svga document association", async () => {
  const plist = await readFile(path.join(experimentRoot, "packaging/macos/Info.plist"), "utf8");
  const entitlements = await readFile(path.join(experimentRoot, "packaging/macos/entitlements.plist"), "utf8");
  assert.equal(appName, "Auto SVGA");
  assert.match(plist, /CFBundleDisplayName[\s\S]*<string>Auto SVGA<\/string>/);
  assert.match(plist, /CFBundleName[\s\S]*<string>Auto SVGA<\/string>/);
  assert.match(plist, new RegExp(`CFBundleShortVersionString[\\s\\S]*<string>${bundleShortVersion.replaceAll(".", "\\.")}</string>`));
  assert.match(plist, new RegExp(`CFBundleVersion[\\s\\S]*<string>${bundleVersion.replaceAll(".", "\\.")}</string>`));
  assert.match(plist, new RegExp(`AutoSVGAProductVersion[\\s\\S]*<string>${productVersion.replaceAll(".", "\\.")}</string>`));
  assert.match(plist, new RegExp(`AutoSVGAReleaseStage[\\s\\S]*<string>${releaseStage.replaceAll(".", "\\.")}</string>`));
  assert.match(plist, new RegExp(`AutoSVGADistributionChannel[\\s\\S]*<string>${distributionChannel}</string>`));
  assert.match(plist, /AutoSVGAPackageCandidate[\s\S]*<true\/>/);
  assert.doesNotMatch(plist, /AutoSVGAInternalPrototype|Auto SVGA Internal Prototype/);
  assert.match(plist, /AutoSVGAInternalUseOnly/);
  assert.match(plist, /AutoSVGASigned/);
  assert.match(plist, /AutoSVGANotarized/);
  assert.match(plist, /AutoSVGAProductionApproved/);
  assert.match(plist, new RegExp(bundleIdentifier));
  assert.match(
    await readFile(path.join(experimentRoot, "scripts/macos-package-proof.mjs"), "utf8"),
    /"short-term-window-bounds-policy\.cjs"/
  );
  assert.match(
    await readFile(path.join(experimentRoot, "scripts/macos-package-proof.mjs"), "utf8"),
    /"short-term-window-placement-store\.cjs"/
  );
  assert.doesNotMatch(plist, /CFBundleDocumentTypes/);
  assert.doesNotMatch(plist, /CFBundleTypeRole[\s\S]*Viewer/);
  assert.doesNotMatch(plist, /LSHandlerRank[\s\S]*Alternate/);
  assert.doesNotMatch(plist, /UTExportedTypeDeclarations/);
  assert.doesNotMatch(plist, /com\.auto-svga\.svga/);
  assert.doesNotMatch(plist, /public\.filename-extension[\s\S]*svga/);
  assert.doesNotMatch(plist, /NSAllowsArbitraryLoads/);
  assert.doesNotMatch(plist, /NSCameraUsageDescription/);
  assert.doesNotMatch(plist, /NSMicrophoneUsageDescription/);
  assert.doesNotMatch(plist, /NSBluetooth/);
  assert.equal(auditInfoPlistSecurity(plist).passed, true);

  const packagerArgs = macosPackagerArgs(".artifacts/internal-trial");
  assert.equal(packagerArgs[1], appName);
  assert.ok(packagerArgs.includes("--platform=darwin"));
  assert.ok(packagerArgs.includes("--arch=arm64"));
  assert.ok(packagerArgs.includes(`--app-bundle-id=${bundleIdentifier}`));
  assert.ok(packagerArgs.includes(`--app-version=${bundleShortVersion}`));
  assert.ok(packagerArgs.includes(`--build-version=${bundleVersion}`));
  assert.ok(packagerArgs.includes("--icon=packaging/macos/app-icon"));
  assert.ok(packagerArgs.some((arg) => arg === "--extend-info=packaging/macos/Info.plist"));
  assert.match(entitlements, /com\.apple\.security\.cs\.allow-jit/);
  assert.match(entitlements, /com\.apple\.security\.cs\.allow-unsigned-executable-memory/);
  assert.match(entitlements, /com\.apple\.security\.cs\.disable-library-validation/);
});

test("macOS package proof manifest records audit boundaries without final App acceptance", async () => {
  const proof = await buildMacosPackageProof({
    appBundle: path.join(experimentRoot, ".artifacts/internal-trial/Auto SVGA-darwin-arm64/Auto SVGA.app"),
    archivePath: path.join(experimentRoot, ".artifacts/internal-trial/Auto SVGA-darwin-arm64.zip"),
    validatePackagedApp: false
  });
  const packageScript = await readFile(path.join(experimentRoot, "scripts/package-internal-trial.mjs"), "utf8");
  const prepareRuntime = await readFile(path.join(experimentRoot, "scripts/prepare-runtime.mjs"), "utf8");
  const mainProcess = await readFile(path.join(experimentRoot, "main.cjs"), "utf8");
  const signingWorkflow = await readFile(path.join(experimentRoot, "scripts/macos-signing-workflow.mjs"), "utf8");
  const packageJson = JSON.parse(await readFile(path.join(experimentRoot, "package.json"), "utf8"));
  const sourcePlist = await readFile(path.join(experimentRoot, "packaging/macos/Info.plist"), "utf8");
  assert.equal(proof.schemaVersion, 1);
  assert.equal(proof.appName, "Auto SVGA");
  assert.equal(proof.bundleDisplayName, "Auto SVGA");
  assert.equal(proof.bundleShortVersion, bundleShortVersion);
  assert.equal(proof.bundleVersion, bundleVersion);
  assert.deepEqual(proof.productIdentity, {
    productVersionLine,
    productVersion,
    productName,
    releaseStage,
    distributionChannel,
    candidateChannel,
    ownerVisibleLabel
  });
  assert.equal(proof.platform, "darwin");
  assert.equal(proof.architecture, "arm64");
  assert.equal(proof.distribution.channel, distributionChannel);
  assert.equal(proof.distribution.candidateChannel, candidateChannel);
  assert.equal(proof.distribution.packageCandidate, true);
  assert.equal(proof.distribution.internalUseOnly, true);
  assert.equal(proof.distribution.unsigned, true);
  assert.equal(proof.distribution.notarized, false);
  assert.equal(proof.distribution.productionApproved, false);
  assert.equal(proof.distribution.finalPackagedAppAcceptanceOwner, finalAcceptanceOwner);
  assert.deepEqual(proof.documentTypes, []);
  assert.equal(proof.documentAssociationPolicy.svgaFinderOpen, "not-declared");
  assert.match(proof.documentAssociationPolicy.reason, /in-app file picker and drag\/drop only/);
  assert.match(proof.knownRisks.join(" "), /Finder double-click/);
  assert.equal(proof.privacyAudit.passed, true);
  assert.deepEqual(proof.privacyAudit.findings, []);
  assert.equal(proof.infoPlistSecurityAudit.passed, true);
  assert.equal(proof.infoPlistSecurityAudit.source.passed, true);
  assert.equal(proof.infoPlistSecurityAudit.packagedApp.passed, true);
  assert.equal(proof.metadataSecurity.noArbitraryNetworkLoads, true);
  assert.equal(proof.metadataSecurity.noUnnecessaryPermissionUsageDescriptions, true);
  assert.equal(proof.metadataSecurity.noFinderDocumentAssociation, true);
  assert.match(proof.packagingScaffold.extendInfoPath, /packaging\/macos\/Info\.plist$/);
  assert.match(proof.packagingScaffold.appIconPath, /packaging\/macos\/app-icon\.icns$/);
  assert.match(proof.packagingScaffold.packagedInfoPlistPath, /Auto SVGA\.app\/Contents\/Info\.plist$/);
  assert.match(proof.packagingScaffold.entitlementsPath, /packaging\/macos\/entitlements\.plist$/);
  assert.equal(proof.packagingScaffold.signScript, "internal:trial:sign:mac");
  assert.equal(proof.packagingScaffold.notarizeScript, "internal:trial:notarize:mac");
  assert.match(packageScript, /const artifactsRoot = path\.join\(experimentRoot, "\.artifacts\/internal-trial"\)/);
  assert.doesNotMatch(packageScript, /AUTO_SVGA_PRODUCT_ARTIFACTS|\.artifacts\/product/);
  assert.equal(packageJson.scripts["internal:trial:sign:mac"], "node scripts/macos-signing-workflow.mjs sign");
  assert.equal(packageJson.scripts["internal:trial:notarize:mac"], "node scripts/macos-signing-workflow.mjs notarize");
  assert.match(signingWorkflow, /SIGNING_BLOCKED_REQUIRES_CREDENTIALS/);
  assert.match(signingWorkflow, /codesign/);
  assert.match(signingWorkflow, /notarytool/);
  assert.match(signingWorkflow, /stapler/);
  assert.match(signingWorkflow, /READY_REQUIRES_EXPLICIT_EXECUTE/);
  assert.match(proof.packagingScaffold.appBundlePath, /Auto SVGA-darwin-arm64\/Auto SVGA\.app$/);
  assert.doesNotMatch(JSON.stringify(proof), /AutoSVGAInternalPrototype|Auto SVGA Internal Prototype/);
  assert.match(proof.requestedIntegrationChanges[0], /root package script/);
  assert.equal(proof.appIcon.status, "temporary-owner-provided");
  assert.match(proof.appIcon.sourcePngPath, /packaging\/macos\/app-icon-source\.png$/);
  assert.match(proof.appIcon.icnsPath, /packaging\/macos\/app-icon\.icns$/);
  assert.match(proof.appIcon.packagedIconPath, /Auto SVGA\.app\/Contents\/Resources\/electron\.icns$/);
  assert.equal(proof.appIcon.packagedIconMatchesSource, null);
  assert.equal(typeof proof.appIcon.icnsSha256, "string");
  assert.equal(proof.appIcon.icnsSha256.length, 64);
  assert.match(packageScript, /archiveEntryCount/);
  assert.match(packageScript, /zipEntries\(archivePath\)\.length/);
  assert.match(packageScript, /--norsrc/);
  assert.match(packageScript, /COPYFILE_DISABLE/);
  assert.match(packageScript, /assertCleanZipEntries/);
  assert.match(packageScript, /sanitizePackagedInfoPlist/);
  assert.match(packageScript, /NSAudioCaptureUsageDescription/);
  assert.match(prepareRuntime, /"lottie-web"/);
  assert.match(prepareRuntime, /"video-animation-player"/);
  assert.match(prepareRuntime, /resolveRuntimeNodeDependency/);
  assert.match(prepareRuntime, /copyRuntimeNodeDependency\(packageName\)/);
  assert.match(prepareRuntime, /runtimeDependencies: runtimeNodeDependencies\.map/);
  assert.match(packageScript, /assertPackagedRuntimeDependencies/);
  assert.match(packageScript, /Contents\/Resources\/app\.asar/);
  assert.match(packageScript, /\.runtime\/build-info\.json/);
  assert.match(packageScript, /const internalTrialProductMilestoneId = "0\.2-multiformat-preview";/);
  assert.match(packageScript, /writeRuntimeBuildInfo\(buildCommit, internalTrialProductMilestoneId\)/);
  assert.match(packageScript, /productMilestoneId: internalTrialProductMilestoneId/);
  assert.match(packageScript, /assertPackagedRuntimeClosure/);
  assert.match(packageScript, /productVersionLine/);
  assert.match(packageScript, /candidateChannel/);
  assert.deepEqual(
    proof.packagingScaffold.packagedRuntimeClosure.dependencies
      .filter((dependency) => dependency.expectedVersion)
      .map((dependency) => `${dependency.packageName}@${dependency.expectedVersion}`),
    ["lottie-web@5.13.0", "video-animation-player@1.0.5"]
  );
  assert.equal(proof.packagingScaffold.windowPlacementSourceClosure.validated, false);
  assert.equal(proof.packagingScaffold.windowPlacementSourceClosure.skippedReason, "packaged app validation disabled");
  assert.deepEqual(
    proof.packagingScaffold.windowPlacementSourceClosure.files.map((file) => file.path),
    windowPlacementPackagedSourceFiles
  );
  assert.ok(
    proof.packagingScaffold.windowPlacementSourceClosure.files.some((file) => file.path === "acceptance-startup-placement-proof.cjs"),
    "acceptance startup proof helper must be part of the package source closure"
  );
  assert.ok(proof.packagingScaffold.windowPlacementSourceClosure.files.every((file) => (
    typeof file.sourceSha256 === "string"
    && file.sourceSha256.length === 64
    && file.packagedSha256 === null
    && file.matchesSource === null
  )));
  assert.deepEqual(
    Object.fromEntries(proof.packagingScaffold.windowPlacementSourceClosure.authorities.map((entry) => [
      entry.authority,
      entry.path
    ])),
    windowPlacementPackagedSourceAuthorities
  );
  assert.ok(proof.packagingScaffold.windowPlacementSourceClosure.authorities.every((entry) => (
    typeof entry.sourceSha256 === "string"
    && entry.sourceSha256.length === 64
    && entry.packagedSha256 === null
    && entry.matchesSource === null
  )));
  const authorityDrift = structuredClone(proof);
  authorityDrift.packagingScaffold.windowPlacementSourceClosure.authorities = authorityDrift
    .packagingScaffold.windowPlacementSourceClosure.authorities
    .filter((entry) => entry.authority !== "executionBinding");
  assert.throws(() => validateProof(sourcePlist, authorityDrift), /windowPlacementSourceClosure/u);
  assert.match(mainProcess, /packagedBuildCommit\(\) \?\? "unknown"/);
  assert.match(mainProcess, /const packagedRuntimeBuildInfo = app\.isPackaged \? readPackagedRuntimeBuildInfo\(\) : undefined;/);
  assert.match(mainProcess, /runtimeBuildInfoProductMilestoneId\(packagedRuntimeBuildInfo\) \?\? "short-term"/);
  assert.match(mainProcess, /\.runtime\/build-info\.json/);
  assert.doesNotMatch(packageScript, /--sequesterRsrc/);
});

test("macOS package proof rejects packaged App identity drift", async () => {
  const sourcePlist = await readFile(path.join(experimentRoot, "packaging/macos/Info.plist"), "utf8");
  const proof = await buildMacosPackageProof({
    appBundle: path.join(experimentRoot, ".artifacts/internal-trial/Auto SVGA-darwin-arm64/Auto SVGA.app"),
    archivePath: path.join(experimentRoot, ".artifacts/internal-trial/Auto SVGA-darwin-arm64.zip"),
    validatePackagedApp: false
  });
  const packagedPlist = sourcePlist.replace(
    "</dict>",
    "  <key>CFBundleExecutable</key>\n  <string>Auto SVGA</string>\n</dict>"
  );

  assert.doesNotThrow(() => validateProof(sourcePlist, proof, packagedPlist));
  assert.throws(
    () => validateProof(
      sourcePlist,
      proof,
      packagedPlist.replace("<key>CFBundleDisplayName</key>\n  <string>Auto SVGA</string>", "<key>CFBundleDisplayName</key>\n  <string>Electron</string>")
    ),
    /packagedAppIdentity/
  );
  assert.throws(
    () => validateProof(sourcePlist, proof, packagedPlist.replace("<key>CFBundleExecutable</key>\n  <string>Auto SVGA</string>", "<key>CFBundleExecutable</key>\n  <string>Electron</string>")),
    /packagedExecutableIdentity/
  );
});

test("macOS package proof rejects stale package version and channel identity", async () => {
  const sourcePlist = await readFile(path.join(experimentRoot, "packaging/macos/Info.plist"), "utf8");
  const proof = await buildMacosPackageProof({
    appBundle: path.join(experimentRoot, ".artifacts/internal-trial/Auto SVGA-darwin-arm64/Auto SVGA.app"),
    archivePath: path.join(experimentRoot, ".artifacts/internal-trial/Auto SVGA-darwin-arm64.zip"),
    validatePackagedApp: false
  });
  const packagedPlist = sourcePlist.replace(
    "</dict>",
    "  <key>CFBundleExecutable</key>\n  <string>Auto SVGA</string>\n</dict>"
  );

  assert.throws(
    () => validateProof(
      sourcePlist,
      proof,
      packagedPlist.replace("<string>0.2.0-alpha.2</string>", "<string>0.0.0-internal</string>")
    ),
    /packagedBundleVersionStamp/
  );
  assert.throws(
    () => validateProof(
      sourcePlist,
      proof,
      packagedPlist.replace("<key>AutoSVGADistributionChannel</key>\n  <string>internal</string>", "<key>AutoSVGADistributionChannel</key>\n  <string>local</string>")
    ),
    /packagedProductIdentity/
  );
});

test("macOS package proof rejects stale packaged runtime build identity", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "auto-svga-package-proof-"));
  try {
    const { appBundle, archivePath } = await createPackagedProofFixture({
      root,
      buildCommit: "stale-build-commit"
    });

    await assert.rejects(
      () => buildMacosPackageProof({
        appBundle,
        archivePath
      }),
      /packagedRuntimeClosure/
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("macOS package proof rejects missing or stale 0.2 runtime dependency closure", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "auto-svga-package-proof-"));
  try {
    const expectedBuildCommit = execFileSync("git", ["rev-parse", "HEAD"], {
      cwd: repoRoot,
      encoding: "utf8"
    }).trim();
    const valid = await createPackagedProofFixture({
      root,
      buildCommit: expectedBuildCommit
    });
    const closure = assertPackagedRuntimeClosure(valid.packagedAsarPath, expectedBuildCommit);
    assert.equal(closure.validated, true);
    assert.deepEqual(
      closure.dependencies
        .filter((dependency) => dependency.expectedVersion)
        .map((dependency) => `${dependency.packageName}@${dependency.version}`),
      ["lottie-web@5.13.0", "video-animation-player@1.0.5"]
    );
    const validProof = await buildMacosPackageProof({
      appBundle: valid.appBundle,
      archivePath: valid.archivePath
    });
    assert.equal(validProof.packagingScaffold.windowPlacementSourceClosure.validated, true);
    assert.ok(validProof.packagingScaffold.windowPlacementSourceClosure.files.every((file) => (
      file.matchesSource === true && file.sourceSha256 === file.packagedSha256
    )));
    assert.deepEqual(
      Object.fromEntries(validProof.packagingScaffold.windowPlacementSourceClosure.authorities.map((entry) => [
        entry.authority,
        entry.path
      ])),
      windowPlacementPackagedSourceAuthorities
    );
    assert.ok(validProof.packagingScaffold.windowPlacementSourceClosure.authorities.every((entry) => (
      entry.matchesSource === true && entry.sourceSha256 === entry.packagedSha256
    )));

    const sourceDrift = await createPackagedProofFixture({
      root: path.join(root, "source-drift"),
      buildCommit: expectedBuildCommit,
      windowPlacementSourceTransforms: {
        "short-term-window-placement-store.cjs": (source) => `${source}\n// packaged drift\n`
      }
    });
    await assert.rejects(
      () => buildMacosPackageProof({
        appBundle: sourceDrift.appBundle,
        archivePath: sourceDrift.archivePath
      }),
      /windowPlacementSourceClosure/
    );

    const missingPlacementProof = await createPackagedProofFixture({
      root: path.join(root, "missing-placement-proof"),
      buildCommit: expectedBuildCommit,
      omitWindowPlacementSourceFiles: ["acceptance-startup-placement-proof.cjs"]
    });
    await assert.rejects(
      () => buildMacosPackageProof({
        appBundle: missingPlacementProof.appBundle,
        archivePath: missingPlacementProof.archivePath
      }),
      /windowPlacementSourceClosure/
    );

    const missing = await createPackagedProofFixture({
      root: path.join(root, "missing"),
      buildCommit: expectedBuildCommit,
      omitRuntimeEntries: ["/.runtime/node_modules/lottie-web/build/player/lottie_svg.js"]
    });
    assert.throws(
      () => assertPackagedRuntimeClosure(missing.packagedAsarPath, expectedBuildCommit),
      /lottie-web\/build\/player\/lottie_svg\.js/
    );

    const staleVersion = await createPackagedProofFixture({
      root: path.join(root, "stale-version"),
      buildCommit: expectedBuildCommit,
      packageVersionOverrides: { "video-animation-player": "1.0.4" }
    });
    assert.throws(
      () => assertPackagedRuntimeClosure(staleVersion.packagedAsarPath, expectedBuildCommit),
      /video-animation-player version 1\.0\.4 does not match 1\.0\.5/
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("macOS Info.plist security audit rejects arbitrary network, unused permissions, and Finder associations", () => {
  const badPlist = [
    "<plist><dict>",
    "<key>NSAppTransportSecurity</key><dict><key>NSAllowsArbitraryLoads</key><true/></dict>",
    "<key>NSCameraUsageDescription</key><string>unused</string>",
    "<key>NSMicrophoneUsageDescription</key><string>unused</string>",
    "<key>NSBluetoothAlwaysUsageDescription</key><string>unused</string>",
    "<key>CFBundleDocumentTypes</key><array><dict><key>CFBundleTypeExtensions</key><array><string>svga</string></array></dict></array>",
    "</dict></plist>"
  ].join("");
  const audit = auditInfoPlistSecurity(badPlist);
  assert.equal(audit.passed, false);
  assert.deepEqual(audit.arbitraryNetworkAllowances, ["NSAllowsArbitraryLoads"]);
  assert.ok(audit.permissionUsageDescriptions.includes("NSCameraUsageDescription"));
  assert.ok(audit.permissionUsageDescriptions.includes("NSMicrophoneUsageDescription"));
  assert.ok(audit.permissionUsageDescriptions.includes("NSBluetoothAlwaysUsageDescription"));
  assert.ok(audit.finderDocumentAssociations.includes("CFBundleDocumentTypes"));
  assert.ok(audit.finderDocumentAssociations.includes("svga-filename-extension"));
});

test("sequence byte repair proof rejects no-op and write-exposed evidence", () => {
  const sourceSha256 = "a".repeat(64);
  const editedSha256 = "b".repeat(64);
  const beforeSha256 = "c".repeat(64);
  const afterSha256 = "d".repeat(64);
  const validProof = {
    schemaVersion: 1,
    proofId: "svga-sequence-byte-repair-proof",
    source: "workbench-sequence-byte-repair",
    sourceSha256,
    sourceSha256AfterRepair: sourceSha256,
    editedSha256,
    prototypeId: "svga-bounded-sequence-repair-prototype-v1",
    resourceKeyCount: 1,
    operationCount: 1,
    resourceDiffs: [{ resourceKey: "seq_001", beforeSha256, afterSha256 }],
    roundTripMode: "edited_bytes_reopen",
    sourceDeltaProduced: true,
    editedBytesProduced: true,
    roundTripPassed: true,
    reopenedPlayback: true,
    reopenedCanvasNonBlank: true,
    reopenedInspectionReport: true,
    renderedProofPassed: true,
    writeAttempted: false,
    productSaveAsEnabled: false,
    writeActionExposed: false,
    repairSuccessClaimed: false,
    manualVisualConfirmationRequired: true,
    passed: true
  };

  assert.equal(validateSequenceByteRepairProof(validProof)?.editedSha256, editedSha256);
  assert.equal(validateSequenceByteRepairProof({ ...validProof, editedSha256: sourceSha256 }), undefined);
  assert.equal(validateSequenceByteRepairProof({ ...validProof, roundTripMode: "no_op_source_reopen" }), undefined);
  assert.equal(validateSequenceByteRepairProof({ ...validProof, roundTripNoopOnly: true }), undefined);
  assert.equal(validateSequenceByteRepairProof({ ...validProof, sourceDeltaProduced: false }), undefined);
  assert.equal(validateSequenceByteRepairProof({ ...validProof, resourceDiffs: [{ resourceKey: "seq_001", beforeSha256, afterSha256: beforeSha256 }] }), undefined);
  assert.equal(validateSequenceByteRepairProof({ ...validProof, productSaveAsEnabled: true }), undefined);
  assert.equal(validateSequenceByteRepairProof({ ...validProof, writeActionExposed: true }), undefined);
  assert.equal(validateSequenceByteRepairProof({ ...validProof, repairSuccessClaimed: true }), undefined);
});

test("sequence product repair report and Save As proof fail closed on unsafe evidence", () => {
  const sourceSha256 = "a".repeat(64);
  const editedBytes = Buffer.from("sequence-edited-svga");
  const editedSha256 = createHash("sha256").update(editedBytes).digest("hex");
  const beforeSha256 = "b".repeat(64);
  const transparentSha256 = "c".repeat(64);
  const unchangedSha256 = "d".repeat(64);
  const alphaProof = Array.from({ length: 8 }, (_, index) => {
    const changed = index === 3;
    return {
      resourceKey: `seq_${String(index + 1).padStart(3, "0")}`,
      spriteIndex: index,
      frameIndex: index + 1,
      usageCount: 1,
      width: 200,
      height: 200,
      beforeSha256: changed ? beforeSha256 : unchangedSha256,
      afterSha256: changed ? transparentSha256 : unchangedSha256,
      beforeNonTransparentPixelCount: changed ? 4 : 4000,
      afterNonTransparentPixelCount: changed ? 0 : 4000,
      beforeNonTransparentRatio: changed ? 0.0001 : 0.1,
      afterNonTransparentRatio: changed ? 0 : 0.1,
      beforeAlphaBounds: changed ? { x: 10, y: 10, width: 2, height: 2 } : { x: 0, y: 0, width: 200, height: 200 },
      afterAlphaBounds: changed ? null : { x: 0, y: 0, width: 200, height: 200 },
      visibleFrameIndices: [index * 2, index * 2 + 1],
      maxTimelineAlpha: 1,
      timelineAlphaDigest: "e".repeat(64),
      changed,
      changeReason: changed ? "near_empty_speck_to_transparent" : "unchanged",
      passed: true
    };
  });
  const validReport = {
    schemaVersion: 1,
    repairId: "svga-sequence-frame-anti-flicker-v1",
    status: "repaired",
    sourceSha256,
    sourceSha256AfterRepair: sourceSha256,
    editedSha256,
    headCommit: "phase4-test",
    sequenceGroup: {
      groupId: "seq_:200x200",
      detectionMethod: "continuous_numeric_resource_keys",
      resourceKeys: alphaProof.map((entry) => entry.resourceKey),
      resourceKeyCount: alphaProof.length,
      repairedResourceKey: "seq_004",
      targetVisibleFrames: [6, 7],
      fullAffectedFrameVisibilityAlphaProof: alphaProof
    },
    selectedRepair: {
      resourceKey: "seq_004",
      reason: "near_empty_visible_speck_frame",
      replacement: "same_dimensions_transparent_png",
      beforeNonTransparentPixelCount: 4,
      afterNonTransparentPixelCount: 0,
      beforeNonTransparentRatio: 0.0001,
      afterNonTransparentRatio: 0,
      beforeSha256,
      afterSha256: transparentSha256
    },
    roundTripReport: {
      schemaVersion: 2,
      milestoneId: "P3",
      sourceSha256,
      sourceSha256AfterEditing: sourceSha256,
      exportedSha256: editedSha256,
      replacedResourceKey: "seq_004",
      exportedResourceSha256: transparentSha256,
      passed: true
    },
    invariantSummary: {
      sourceUnchanged: true,
      roundTripPassed: true,
      imageResourceKeySetStable: true,
      spriteTimelineStable: true,
      untouchedResourceHashesStable: true,
      onlySelectedResourceChanged: true,
      replacementDimensionsMatchOriginal: true
    },
    productSaveAsEnabled: true,
    repairSuccessClaimed: true,
    manualVisualConfirmationRequired: false,
    failureClosed: true,
    passed: true
  };
  const validProof = {
    schemaVersion: 1,
    proofId: "svga-sequence-product-repair-save-as-proof",
    source: "workbench-sequence-product-repair-save-as",
    sourceSha256,
    editedSha256,
    savedSha256: editedSha256,
    savedFileName: "sequence-repaired-output.svga",
    saveStatus: "saved",
    repairedResourceKey: "seq_004",
    groupResourceKeyCount: 8,
    alphaProofResourceCount: 8,
    changedResourceCount: 1,
    fullAffectedFrameVisibilityAlphaProof: alphaProof,
    targetVisibleFrames: [6, 7],
    beforeAfterPlaybackProof: [{
      frameIndex: 6,
      beforeCanvasSha256: "f".repeat(64),
      afterCanvasSha256: "1".repeat(64),
      canvasWidth: 200,
      canvasHeight: 200,
      canvasDimensionsStable: true,
      beforeCanvasNonBlank: true,
      afterCanvasNonBlank: true,
      canvasHashChanged: true
    }],
    playbackDeltaObserved: true,
    savedHashBound: true,
    sourceUnchanged: true,
    fullAffectedFrameVisibilityAlphaProofPassed: true,
    repairedFrameTransparentAfter: true,
    productSaveAsEnabled: true,
    repairSuccessClaimed: true,
    manualVisualConfirmationRequired: false,
    failureClosed: true,
    reopenedPlayback: true,
    reopenedCanvasNonBlank: true,
    reopenedInspectionReport: true,
    renderedProofPassed: true,
    passed: true
  };

  assert.equal(validateSequenceRepairReportBinding(validReport, editedBytes)?.editedSha256, editedSha256);
  assert.equal(validateSequenceRepairReportBinding({ ...validReport, manualVisualConfirmationRequired: true }, editedBytes), undefined);
  assert.equal(validateSequenceRepairReportBinding({ ...validReport, productSaveAsEnabled: false }, editedBytes), undefined);
  assert.equal(validateSequenceRepairReportBinding(validReport, Buffer.from("different")), undefined);
  assert.equal(validateSequenceProductRepairProof(validProof)?.savedSha256, editedSha256);
  assert.equal(validateSequenceProductRepairProof({ ...validProof, productSaveAsEnabled: false }), undefined);
  assert.equal(validateSequenceProductRepairProof({ ...validProof, manualVisualConfirmationRequired: true }), undefined);
  assert.equal(validateSequenceProductRepairProof({ ...validProof, playbackDeltaObserved: false })?.passed, true);
  assert.equal(validateSequenceProductRepairProof({ ...validProof, beforeAfterPlaybackProof: [] }), undefined);
  assert.equal(validateSequenceProductRepairProof({ ...validProof, savedSha256: sourceSha256 }), undefined);
});

test("vendored svga-web asset is pinned and strict-CSP compatible", async () => {
  const source = await readFile(vendorPath, "utf8");
  assert.equal(createHash("sha256").update(source).digest("hex"), "6235bc9802e76dd517343123ec730d25e02c4d476b66b81ef26befe7881f3c50");
  assert.equal(source.includes("eval("), false);
  assert.equal(source.includes("Function("), false);
  assert.match(await readFile(path.join(experimentRoot, "vendor/NOTICE.md"), "utf8"), /MIT/);
});

test("short-term drag decision hit testing keeps Compare opt-in at the top", async () => {
  const dragDecisionModel = await import(pathToFileURL(path.join(
    experimentRoot,
    "web/short-term-macos-drag-decision-model.mjs"
  )).href);
  const target = {
    getBoundingClientRect: () => ({
      left: 10,
      top: 20,
      width: 400,
      height: 200
    })
  };

  assert.equal(dragDecisionModel.SHORT_TERM_DRAG_DECISION_OPEN_RATIO, 0.75);
  assert.equal(dragDecisionModel.SHORT_TERM_DRAG_DECISION_COMPARE_RATIO, 0.25);
  assert.equal(dragDecisionModel.dragDecisionZoneForEvent(target, { clientX: 210, clientY: 40 }), "compare");
  assert.equal(dragDecisionModel.dragDecisionZoneForEvent(target, { clientX: 210, clientY: 70 }), "open");
  assert.equal(dragDecisionModel.dragDecisionZoneForEvent(target, { clientX: 210, clientY: 120 }), "open");
  assert.equal(dragDecisionModel.dragDecisionZoneForEvent(target, { clientX: 210, clientY: 160 }), "open");
  assert.equal(dragDecisionModel.dragDecisionZoneForEvent(target, { clientX: 390, clientY: 120 }), "open");
  assert.equal(dragDecisionModel.dragDecisionZoneForEvent(target, { clientX: 210, clientY: 200 }), "open");
});

test("0.2 multi-format drag affordance accepts Lottie and VAP while keeping Compare SVGA-only", async () => {
  const dragDecisionModel = await import(pathToFileURL(path.join(
    experimentRoot,
    "web/multiformat-product-conformance.mjs"
  )).href);
  const dragDecisionSurface = await import(pathToFileURL(path.join(
    experimentRoot,
    "web/short-term-macos-drag-decision-surface.mjs"
  )).href);
  const target = {
    getBoundingClientRect: () => ({
      left: 0,
      top: 0,
      width: 1280,
      height: 800
    })
  };
  const dragEvent = (name, clientY = 40) => ({
    clientY,
    dataTransfer: { files: [{ name }] }
  });

  const svgaDecision = dragDecisionModel.multiFormatDragDecisionForEvent(target, dragEvent("frame.svga"), {
    activeFormat: "svga"
  });
  assert.equal(svgaDecision.supported, true);
  assert.equal(svgaDecision.compareAvailable, true);
  assert.equal(svgaDecision.focusZone, "compare");

  const lottieDecision = dragDecisionModel.multiFormatDragDecisionForEvent(target, dragEvent("motion.json"), {
    activeFormat: "lottie"
  });
  assert.equal(lottieDecision.supported, true);
  assert.equal(lottieDecision.compareAvailable, false);
  assert.equal(lottieDecision.focusZone, "open");

  const vapDecision = dragDecisionModel.multiFormatDragDecisionForEvent(target, dragEvent("fusion.mp4"), {
    activeFormat: "vap"
  });
  assert.equal(vapDecision.supported, true);
  assert.equal(vapDecision.compareAvailable, false);
  assert.equal(vapDecision.focusZone, "open");

  const unsupportedDecision = dragDecisionModel.multiFormatDragDecisionForEvent(target, dragEvent("preview.gif"), {
    activeFormat: "lottie"
  });
  assert.equal(unsupportedDecision.supported, false);
  assert.equal(unsupportedDecision.compareAvailable, false);
  assert.equal(unsupportedDecision.focusZone, "open");

  const createZone = (dragZone) => {
    const strong = { textContent: "" };
    return {
      dataset: { dragZone },
      hidden: false,
      attributes: {},
      strong,
      setAttribute(name, value) {
        this.attributes[name] = String(value);
      },
      querySelector(selector) {
        return selector === "strong" ? strong : null;
      }
    };
  };
  const compareZone = createZone("compare");
  const openZone = createZone("open");
  const overlay = {
    hidden: true,
    dataset: {},
    querySelectorAll(selector) {
      return selector === "[data-drag-zone]" ? [compareZone, openZone] : [];
    }
  };

  dragDecisionSurface.showShortTermDragDecisionOverlay(overlay, lottieDecision);
  assert.equal(overlay.hidden, false);
  assert.equal(overlay.dataset.status, "supported");
  assert.equal(overlay.dataset.focusZone, "open");
  assert.equal(overlay.dataset.compareAvailable, "false");
  assert.equal(compareZone.hidden, true);
  assert.equal(compareZone.attributes["aria-hidden"], "true");
  assert.equal(openZone.hidden, false);
  assert.equal(openZone.strong.textContent, "打开新文件");

  dragDecisionSurface.showShortTermDragDecisionOverlay(overlay, unsupportedDecision);
  assert.equal(overlay.dataset.status, "unsupported");
  assert.equal(overlay.dataset.focusZone, "open");
  assert.equal(openZone.strong.textContent, "不支持的文件格式");
});

test("short-term optimization result UI fails closed for no-benefit output", async () => {
  const optimizationModel = await import(pathToFileURL(path.join(
    experimentRoot,
    "web/short-term-macos-optimization-model.mjs"
  )).href);
  const commandStateModel = await import(pathToFileURL(path.join(
    experimentRoot,
    "web/short-term-macos-command-state.mjs"
  )).href);
  const compareModel = await import(pathToFileURL(path.join(
    experimentRoot,
    "web/short-term-macos-compare-model.mjs"
  )).href);

  assert.equal(optimizationModel.optimizationResultTone({ status: "optimized" }), "success");
  assert.equal(optimizationModel.optimizationResultTone({ status: "tradeoff" }), "warning");
  assert.equal(optimizationModel.optimizationResultTone({ status: "no-benefit" }), "danger");
  assert.equal(optimizationModel.canSaveOptimizationResult({ status: "optimized" }), true);
  assert.equal(optimizationModel.canSaveOptimizationResult({ status: "tradeoff" }), true);
  assert.equal(optimizationModel.canSaveOptimizationResult({ status: "failed" }), false);

  const disabledState = commandStateModel.buildCommandState({
    activeOutput: {
      kind: "optimization",
      bytes: new Uint8Array([1]),
      details: { status: "no-benefit" }
    },
    sourceId: "source-id"
  });
  assert.equal(disabledState.actionStates["save-as"].enabled, false);
  assert.equal(disabledState.actionStates["save-overwrite"].enabled, false);

  const disabledHtml = compareModel.renderOptimizationCompareResultHtml({
    status: "no-benefit",
    metrics: [{ label: "文件体积", before: "2.4 MiB", after: "2.5 MiB" }]
  });
  assert.match(disabledHtml, /data-status="danger"/);
  assert.match(disabledHtml, /data-action="save-as" disabled>另存为 SVGA/);
  assert.match(disabledHtml, /data-action="save-overwrite" disabled>覆盖保存/);
});

test("short-term future compatibility guardrails keep current behavior bounded", async () => {
  const webRoot = path.join(experimentRoot, "web");
  const shortTermFileNames = (await readdir(webRoot))
    .filter((name) => /^short-term-macos-.*\.(mjs|css)$/.test(name))
    .sort();
  const shortTermSources = Object.fromEntries(await Promise.all(shortTermFileNames.map(async (name) => [
    name,
    await readFile(path.join(webRoot, name), "utf8")
  ])));
  const indexPage = await readFile(path.join(webRoot, "index.html"), "utf8");
  const rendererSources = [indexPage, ...Object.values(shortTermSources)].join("\n");
  const main = await readFile(path.join(experimentRoot, "main.cjs"), "utf8");
  const preload = await readFile(path.join(experimentRoot, "preload.cjs"), "utf8");
  const hostContractSource = await readFile(path.join(experimentRoot, "host-adapter-contract.cjs"), "utf8");
  const shortTermMenuSource = main.slice(
    main.indexOf("function installShortTermApplicationMenu"),
    main.indexOf("function installApplicationMenu", main.indexOf("function installShortTermApplicationMenu") + 1)
  );

  assert.doesNotMatch(rendererSources, /\b(?:vap|lottie|aeb|import-package|format-selection|ffmpeg)\b/i);
  assert.doesNotMatch(rendererSources, /(?:cdn\.jsdelivr|unpkg\.com|https?:\/\/(?!127\.0\.0\.1))/i);
  assert.doesNotMatch(rendererSources, /\b(?:ipcRenderer|contextBridge|showOpenDialog|showSaveDialog|readFileSync|writeFileSync|require\(|node:fs|node:path|shell\.)/);
  assert.doesNotMatch(rendererSources, /\/Users\//);

  assert.match(hostContractSource, /const DOCUMENT_TYPES = Object\.freeze\(\["svga"\]\)/);
  assert.match(preload, /documentTypes: Object\.freeze\(\["svga"\]\)/);
  assert.match(shortTermSources["short-term-macos-drag-decision-model.mjs"], /\.svga\$\/i/);
  assert.match(shortTermSources["short-term-macos-file-surface.mjs"], /bridge\?\.openSvgaFile/);
  assert.match(shortTermSources["short-term-macos-file-surface.mjs"], /bridge\?\.openRecentSvgaFile/);
  assert.match(shortTermSources["short-term-macos-host-client.mjs"], /getRecentSvgaFiles/);
  assert.match(shortTermSources["short-term-macos-host-client.mjs"], /clearRecentSvgaFiles/);
  assert.match(shortTermSources["short-term-macos-save-surface.mjs"], /bridge\.saveShortTermSvgaOutput/);
  assert.match(shortTermSources["short-term-macos-action-bridge.mjs"], /writeClipboardText/);
  assert.match(shortTermMenuSource, /invokeShortTermAction\("openFromHostDialog"\)/);
  assert.match(shortTermMenuSource, /invokeShortTermAction\("saveAs"\)/);
  assert.match(shortTermMenuSource, /invokeShortTermAction\("copyStateSummary"\)/);

  const playerBindingFiles = Object.entries(shortTermSources)
    .filter(([, source]) => /SvgaWebParser|SvgaWebPlayer|FILL_MODE|svga-web-2\.4\.4/.test(source))
    .map(([name]) => name);
  assert.deepEqual(playerBindingFiles, ["short-term-macos-playback-model.mjs"]);
  assert.match(shortTermSources["short-term-macos-playback-surface.mjs"], /from "\.\/short-term-macos-playback-model\.mjs"/);
  assert.doesNotMatch(shortTermSources["short-term-macos-playback-surface.mjs"], /SvgaWebParser|SvgaWebPlayer|FILL_MODE/);

  assert.match(main, /pathRedacted: true/);
  assert.match(main, /targetPathRedacted: sanitizeRuntimeArgument\(targetPath\)/);
  assert.match(shortTermSources["short-term-macos-feedback-surface.mjs"], /showShortTermFailure/);
  assert.match(shortTermSources["short-term-macos-feedback-surface.mjs"], /showShortTermOperationFailure/);
});

test("formal preload isolates short-term SVGA from 0.2 multi-format APIs", async () => {
  const { exposed } = await exposePreloadGlobals("short-term", "formal");
  const api = exposed.autoSvgaElectronHost;

  assert.deepEqual([...api.capabilities.documentTypes], ["svga"]);
  assert.equal(typeof api.openSvgaFile, "function");
  assert.equal(typeof api.saveShortTermSvgaOutput, "function");
  assert.equal(api.openMultiFormatFile, undefined);
  assert.equal(api.openDroppedMultiFormatFile, undefined);
  assert.equal(api.controlMultiFormatPreview, undefined);
  assert.equal(api.applyMultiFormatReplacement, undefined);
  assert.equal(api.resetMultiFormatReplacement, undefined);
  assert.equal(exposed.autoSvgaPrototype, undefined);
});

test("formal 0.2 multi-format preload preserves the SVGA host workflow beside the gated preview bridge", async () => {
  const { exposed, invocations } = await exposePreloadGlobals("0.2-multiformat-preview", "formal");
  const api = exposed.autoSvgaElectronHost;

  assert.deepEqual([...api.capabilities.documentTypes], ["svga", "lottie-json", "vap-mp4"]);
  assert.equal(api.capabilities.saveAs, "host-dialog-svga-only");
  assert.equal(api.capabilities.overwriteSave, "host-source-path-from-file-picker-only");
  assert.equal(api.capabilities.export, false);
  assert.equal(api.capabilities.visibleIn01, false);
  assert.equal(api.capabilities.supportClaim, false);
  assert.equal(typeof api.openSvgaFile, "function");
  assert.equal(typeof api.saveShortTermSvgaOutput, "function");
  assert.equal(typeof api.getRecentSvgaFiles, "function");
  assert.equal(typeof api.openRecentSvgaFile, "function");
  assert.equal(typeof api.clearRecentSvgaFiles, "function");
  assert.equal(exposed.autoSvgaPrototype, undefined);

  api.openMultiFormatFile();
  api.openDroppedMultiFormatFile({ path: "/private/tmp/fixture.json" });
  api.prepareMultiFormatRuntimePreview({ sourceId: "0123456789abcdef01234567", format: "lottie" });
  api.controlMultiFormatPreview({ action: "play" });
  api.chooseMultiFormatReplacementImage({ targetId: "asset", sourceId: "0123456789abcdef01234567", kind: "image" });
  api.applyMultiFormatReplacement({
    targetId: "asset",
    sourceId: "0123456789abcdef01234567",
    kind: "image",
    value: "data:image/png;base64,AA=="
  });
  api.resetMultiFormatReplacement();

  assert.deepEqual(invocations.map(({ channel }) => channel), [
    "svga-web-experiment:open-multiformat-file",
    "svga-web-experiment:open-dropped-multiformat-file",
    "svga-web-experiment:prepare-multiformat-runtime-preview",
    "svga-web-experiment:control-multiformat-preview",
    "svga-web-experiment:choose-multiformat-replacement-image",
    "svga-web-experiment:apply-multiformat-replacement",
    "svga-web-experiment:reset-multiformat-replacement"
  ]);
});

test("0.2 multi-format desktop mode reuses the preview shell without widening short-term identity", async () => {
  const main = await readFile(path.join(experimentRoot, "main.cjs"), "utf8");
  const appEntry = await readFile(path.join(experimentRoot, "web/short-term-macos-app.mjs"), "utf8");
  const controller = await readFile(path.join(experimentRoot, "web/multiformat-desktop-preview-controller.mjs"), "utf8");
  const session = await readFile(path.join(experimentRoot, "multiformat-desktop-session.cjs"), "utf8");
  const server = await readFile(path.join(experimentRoot, "server.mjs"), "utf8");
  const vapRegeneratorShim = await readFile(path.join(experimentRoot, "web/vap-regenerator-runtime-global-shim.js"), "utf8");

  assert.match(main, /const multiFormatDesktopRuntimeRoot = app\.isPackaged \? path\.join\(appRoot, "\.runtime"\) : repoRoot;/);
  assert.match(main, /const isShortTermProduct = productMilestoneId === "short-term";/);
  assert.match(main, /const isMultiFormatDesktopProduct = productMilestoneId === MULTIFORMAT_DESKTOP_PRODUCT_MILESTONE_ID;/);
  assert.match(main, /const usesShortTermPreviewShell = isShortTermProduct \|\| isMultiFormatDesktopProduct;/);
  assert.match(main, /const rendererPath = usesShortTermPreviewShell \? "\/" : "\/workbench\.html";/);
  assert.match(main, /if \(usesShortTermPreviewShell\) \{\s*installShortTermApplicationMenu/);
  assert.match(main, /repoRoot: multiFormatDesktopRuntimeRoot/);
  assert.match(main, /openDroppedMultiFormatFile\(input\)/);
  assert.match(appEntry, /bridge\?\.productMilestoneId === "0\.2-multiformat-preview"/);
  assert.match(appEntry, /createMultiFormatDesktopPreviewController/);
  assert.match(appEntry, /const svgaController = createShortTermAppController/);
  assert.match(controller, /const saveActiveOutput = \(\.\.\.args\) => delegateSvga\("saveActiveOutput"/);
  assert.match(controller, /const renameSelectedImageKey = \(\.\.\.args\) => delegateSvga\("renameSelectedImageKey"/);
  assert.match(controller, /resolveMultiFormatOpenOutcome/);
  assert.match(controller, /projectMultiFormatRightPanel/);
  assert.match(controller, /function createAssetGroup/);
  assert.match(controller, /dataset\.group = group\.id/);
  assert.match(controller, /prepareMultiFormatRuntimePreview/);
  assert.match(controller, /function mountLottieRuntimePreview/);
  assert.match(controller, /function mountVapRuntimePreview/);
  assert.match(controller, /src\.startsWith\("\/runtime-node-modules\/"\)/);
  assert.match(controller, /loadRuntimeScript\("\/vap-regenerator-runtime-global-shim\.js", "vap-regenerator-runtime-global"\)/);
  assert.match(controller, /await loadVapRuntimeScript\(payload\.runtimeScripts\?\.\[0\]\)/);
  assert.match(vapRegeneratorShim, /globalThis\.regeneratorRuntime \|\|= \{\}/);
  assert.doesNotMatch(vapRegeneratorShim, /Function\(|unsafe-eval/);
  assert.match(controller, /beginRuntimePreviewGeneration/);
  assert.match(session, /rendererHasFullPath|pathRedacted/);
  assert.match(session, /lottieLoads|vapLoads|objectUrlsRevoked/);
  assert.match(session, /openWithTerminalDeadline/);
  assert.match(session, /prepareRuntimePreview/);
  assert.match(session, /prepareLottieRuntimePreview/);
  assert.match(session, /prepareVapRuntimePreview/);
  assert.match(session, /\/runtime-node-modules\/lottie-web\/build\/player\/lottie_svg\.js/);
  assert.match(session, /\/runtime-node-modules\/video-animation-player\/dist\/vap\.js/);
  assert.match(server, /runtimeVendorMappings/);
  assert.match(server, /runtime-node-modules\/lottie-web\/build\/player\/lottie_svg\.js/);
  assert.match(server, /runtime-node-modules\/video-animation-player\/dist\/vap\.js/);
});

test("0.2 alpha package runtime identity selects the multi-format desktop product before defaulting to 0.1", async () => {
  const main = await readFile(path.join(experimentRoot, "main.cjs"), "utf8");
  const packageScript = await readFile(path.join(experimentRoot, "scripts/package-internal-trial.mjs"), "utf8");

  assert.match(packageScript, /const internalTrialProductMilestoneId = "0\.2-multiformat-preview";/);
  assert.match(packageScript, /productMilestoneId: internalTrialProductMilestoneId/);
  assert.match(packageScript, /writeRuntimeBuildInfo\(buildCommit, internalTrialProductMilestoneId\)/);
  assert.match(main, /function runtimeBuildInfoProductMilestoneId\(buildInfo\)/);
  assert.match(main, /if \(buildInfo\?\.productMilestoneId === MULTIFORMAT_DESKTOP_PRODUCT_MILESTONE_ID\)/);
  assert.match(main, /if \(buildInfo\?\.productMilestoneId === "short-term"\)/);
  assert.match(main, /const packagedRuntimeBuildInfo = app\.isPackaged \? readPackagedRuntimeBuildInfo\(\) : undefined;/);
  assert.match(
    main,
    /const productMilestoneId = process\.env\.AUTO_SVGA_PRODUCT_MILESTONE \?\? runtimeBuildInfoProductMilestoneId\(packagedRuntimeBuildInfo\) \?\? "short-term";/
  );
});

test("formal 0.1 direct multi-format IPC calls are guarded before host side effects", async () => {
  const main = await readFile(path.join(experimentRoot, "main.cjs"), "utf8");
  const openFunctionStart = main.indexOf("async function openMultiFormatFile()");
  const openDropFunctionStart = main.indexOf("async function openDroppedMultiFormatFile", openFunctionStart + 1);
  assert.notEqual(openFunctionStart, -1);
  assert.notEqual(openDropFunctionStart, -1);

  const openFunctionSource = main.slice(openFunctionStart, openDropFunctionStart);
  assert.match(openFunctionSource, /assertMultiFormatDesktopProduct\(\);[\s\S]*dialog\.showOpenDialog/);
  assert.ok(
    openFunctionSource.indexOf("assertMultiFormatDesktopProduct();") < openFunctionSource.indexOf("dialog.showOpenDialog"),
    "multi-format file dialog must be gated before showOpenDialog"
  );

  const guardedChannels = [
    ["openMultiFormatFile", "openMultiFormatFile()"],
    ["openDroppedMultiFormatFile", "openDroppedMultiFormatFile(input)"],
    ["controlMultiFormatPreview", "controlMultiFormatPreview(input)"],
    ["chooseMultiFormatReplacementImage", "chooseMultiFormatReplacementImage(input)"],
    ["applyMultiFormatReplacement", "applyMultiFormatReplacement(input)"],
    ["resetMultiFormatReplacement", "resetMultiFormatReplacement(input)"]
  ];
  for (const [channel, targetCall] of guardedChannels) {
    const handlerStart = main.indexOf(`ipcMain.handle(IPC_CHANNELS.${channel}`);
    const nextHandlerStart = main.indexOf("ipcMain.handle(", handlerStart + 1);
    assert.notEqual(handlerStart, -1, `${channel} IPC handler must exist`);
    assert.notEqual(nextHandlerStart, -1, `${channel} IPC handler must be bounded by the next handler`);
    const handlerSource = main.slice(handlerStart, nextHandlerStart);
    assert.match(handlerSource, /assertMultiFormatDesktopProduct\(\);/);
    assert.ok(
      handlerSource.indexOf("assertMultiFormatDesktopProduct();") < handlerSource.indexOf(targetCall),
      `${channel} must reject non-0.2 callers before ${targetCall}`
    );
  }
});

test("0.2 image replacement controls use a host picker instead of renderer file-input clicks", async () => {
  const main = await readFile(path.join(experimentRoot, "main.cjs"), "utf8");
  const preload = await readFile(path.join(experimentRoot, "preload.cjs"), "utf8");
  const controller = await readFile(path.join(experimentRoot, "web/multiformat-desktop-preview-controller.mjs"), "utf8");
  const replaceableRenderer = await readFile(path.join(experimentRoot, "web/short-term-macos-replaceable-renderers.mjs"), "utf8");

  assert.match(preload, /chooseMultiFormatReplacementImage\(input\)/);
  assert.match(preload, /IPC_CHANNELS\.chooseMultiFormatReplacementImage/);

  const pickerStart = main.indexOf("async function chooseMultiFormatReplacementImage(input)");
  const pickerFileStart = main.indexOf("async function openMultiFormatReplacementImageFile()", pickerStart + 1);
  const pickerReadStart = main.indexOf("function readMultiFormatReplacementImageFile(filePath)", pickerFileStart + 1);
  assert.notEqual(pickerStart, -1, "host replacement picker must exist");
  assert.notEqual(pickerFileStart, -1, "host replacement picker file dialog helper must exist");
  assert.notEqual(pickerReadStart, -1, "host replacement picker file read helper must exist");
  const pickerSource = main.slice(pickerStart, pickerFileStart);
  const pickerFileSource = main.slice(pickerFileStart, pickerReadStart);
  const pickerReadSource = main.slice(pickerReadStart, main.indexOf("function enqueueMultiFormatOpenFileEvent", pickerReadStart));
  assert.match(pickerSource, /assertMultiFormatDesktopProduct\(\);/);
  assert.match(pickerSource, /targetId/);
  assert.match(pickerSource, /expectedSourceId/);
  assert.match(pickerSource, /if \(!expectedSourceId\) \{/);
  assert.match(pickerSource, /activeSourceId !== expectedSourceId/);
  assert.match(pickerSource, /resolveReplacementSelection/);
  assert.match(pickerSource, /selectionBeforePicker/);
  assert.match(pickerSource, /selectionAfterPicker/);
  assert.match(pickerSource, /bindingToken !== selectionBeforePicker\.bindingToken/);
  assert.doesNotMatch(pickerSource, /if \(expectedSourceId && session\.activeSourceId !== expectedSourceId\)/);
  assert.match(pickerSource, /applyMultiFormatReplacement\(\{/);
  assert.match(pickerSource, /selectionToken: selectionAfterPicker\.bindingToken/);
  assert.ok(
    pickerSource.indexOf("if (!expectedSourceId)") < pickerSource.indexOf("openMultiFormatReplacementImageFile()"),
    "missing or blank sourceId must fail before the host picker can show a dialog"
  );
  assert.ok(
    pickerSource.indexOf("session.activeSourceId !== expectedSourceId") < pickerSource.indexOf("openMultiFormatReplacementImageFile()"),
    "stale sourceId must fail before the host picker can show a dialog"
  );
  assert.match(pickerFileSource, /dialog\.showOpenDialog/);
  assert.match(pickerFileSource, /extensions: \["png", "jpg", "jpeg", "webp"\]/);
  assert.match(pickerFileSource, /status: "cancelled"/);
  assert.match(pickerReadSource, /status: "failed"/);
  assert.match(pickerReadSource, /pathRedacted: true/);
  assert.doesNotMatch(pickerReadSource, /message:[^\n]+normalizedPath/);
  assert.match(pickerReadSource, /openSync\(normalizedPath, "r"\)/);
  assert.match(pickerReadSource, /fstatSync\(fd\)/);
  assert.match(pickerReadSource, /readSync\(fd,/);
  assert.match(pickerReadSource, /MAX_MULTI_FORMAT_REPLACEMENT_IMAGE_BYTES \+ 1/);
  assert.match(pickerReadSource, /totalBytes > MAX_MULTI_FORMAT_REPLACEMENT_IMAGE_BYTES/);
  assert.match(pickerReadSource, /closeSync\(fd\)/);
  assert.match(pickerReadSource, /message: "Replacement preview image could not be read\."/);
  assert.doesNotMatch(pickerReadSource, /statSync\(normalizedPath\)|readFileSync\(normalizedPath\)/);

  const handlerStart = main.indexOf("ipcMain.handle(IPC_CHANNELS.chooseMultiFormatReplacementImage");
  const nextHandlerStart = main.indexOf("ipcMain.handle(", handlerStart + 1);
  assert.notEqual(handlerStart, -1, "replacement picker IPC handler must exist");
  const handlerSource = main.slice(handlerStart, nextHandlerStart);
  assert.ok(
    handlerSource.indexOf("assertMultiFormatDesktopProduct();") < handlerSource.indexOf("chooseMultiFormatReplacementImage(input)"),
    "replacement picker IPC must reject non-0.2 callers before host file dialog or reads"
  );

  const chooseStart = controller.indexOf("async function chooseReplacementImage");
  const applyStart = controller.indexOf("async function applyReplacementFile", chooseStart + 1);
  const chooseSource = controller.slice(chooseStart, applyStart);
  const applySource = controller.slice(applyStart, controller.indexOf("async function resetImageReplacement", applyStart + 1));
  assert.match(chooseSource, /bridge\.chooseMultiFormatReplacementImage/);
  assert.match(chooseSource, /const sourceId = state\.sourceId \|\| ""/);
  assert.match(chooseSource, /sourceId,/);
  assert.match(chooseSource, /runtimeReplacementAuthorityIsCurrent\(sourceId, authorityGeneration\)/);
  assert.match(controller, /function acceptedRuntimeReplacementValue[\s\S]*result\?\.replacementRuntimeValue/);
  assert.match(chooseSource, /runtimeValue\.targetId/);
  assert.match(applySource, /const sourceId = state\.sourceId \|\| ""/);
  assert.match(applySource, /sourceId,/);
  assert.match(applySource, /runtimeReplacementAuthorityIsCurrent\(sourceId, authorityGeneration\)/);
  assert.match(applySource, /runtimeValue\.targetId/);
  assert.doesNotMatch(controller, /runtimeReplacementImageTargetId/);
  assert.doesNotMatch(chooseSource, /replacementFileInput\.click\(\)|\.click\(\)/);
  assert.match(controller, /openResourceContextMenu\(event, imageKey, returnFocus\) \{[\s\S]*chooseReplacementImage\(imageKey\)\.catch\(\(\) => showFailure\(\{ code: "replacement_preview_failed" \}\)\);/);
  assert.match(controller, /directReplace:\s*true/);
  assert.match(replaceableRenderer, /class="replaceImageButton"/);
  assert.match(replaceableRenderer, /data-action="row-menu"/);
  assert.match(replaceableRenderer, />替换图片<\/button>/);
  assert.doesNotMatch(replaceableRenderer, /type="file"|replacementFileInput\.click\(\)/);
});

test("0.2 host replacement picker fails closed for missing source and bounded read races", async () => {
  const main = await readFile(path.join(experimentRoot, "main.cjs"), "utf8");
  const chooseSource = extractFunctionSource(main, "async function chooseMultiFormatReplacementImage(input)");
  const selectionFailureSource = extractFunctionSource(main, "function replacementSelectionFailure(selection)");
  const applySource = extractFunctionSource(main, "async function applyMultiFormatReplacement(input)");
  const readSource = extractFunctionSource(main, "function readMultiFormatReplacementImageFile(filePath)");

  const createChooseHarness = ({ activeSourceId = "active-source", picker, resolveSelection } = {}) => {
    const context = {
      session: {
        activeSourceId,
        selectionRevision: 0,
        async resolveReplacementSelection(input) {
          if (resolveSelection) return resolveSelection(context, input);
          return {
            status: "accepted",
            publicTargetId: String(input?.targetId ?? ""),
            runtimeTargetId: "avatar",
            bindingToken: `selection:${context.session.selectionRevision}`,
            pathRedacted: true
          };
        }
      },
      dialogCalls: 0,
      applied: [],
      assertMultiFormatDesktopProduct() {},
      getMultiFormatDesktopSession() {
        return context.session;
      },
      async openMultiFormatReplacementImageFile() {
        context.dialogCalls += 1;
        return picker ? picker(context) : {
          status: "opened",
          mediaType: "image/png",
          sizeBytes: 1,
          sha256: "replacement-sha",
          value: "data:image/png;base64,AA==",
          pathRedacted: true
        };
      },
      async applyMultiFormatReplacement(input) {
        context.applied.push(input);
        return {
          status: "previewReady",
          sourceId: context.session.activeSourceId,
          replacementRuntimeValue: {
            kind: input.kind,
            targetId: "avatar",
            value: input.value
          }
        };
      }
    };
    vm.runInNewContext(`${selectionFailureSource}; ${chooseSource}; globalThis.callPicker = chooseMultiFormatReplacementImage;`, context);
    return context;
  };

  for (const sourceId of [undefined, "", "   "]) {
    const context = createChooseHarness();
    const result = await context.callPicker({ targetId: "avatar", sourceId });
    assert.equal(result.status, "failed");
    assert.equal(result.code, "parse_precondition");
    assert.equal(result.pathRedacted, true);
    assert.equal(context.dialogCalls, 0, "missing or blank sourceId must reject before dialog");
    assert.equal(context.applied.length, 0);
  }

  {
    const context = createChooseHarness({ activeSourceId: "current-source" });
    const result = await context.callPicker({ targetId: "avatar", sourceId: "stale-source" });
    assert.equal(result.status, "failed");
    assert.equal(result.code, "parse_precondition");
    assert.equal(context.dialogCalls, 0, "stale sourceId must reject before dialog");
    assert.equal(context.applied.length, 0);
  }

  {
    const context = createChooseHarness({
      activeSourceId: "source-before-picker",
      picker(pickerContext) {
        pickerContext.session.activeSourceId = "source-after-picker";
        return {
          status: "opened",
          mediaType: "image/png",
          sizeBytes: 1,
          sha256: "replacement-sha",
          value: "data:image/png;base64,AA==",
          pathRedacted: true
        };
      }
    });
    const result = await context.callPicker({ targetId: "avatar", sourceId: "source-before-picker" });
    assert.equal(context.dialogCalls, 1);
    assert.equal(result.status, "failed");
    assert.equal(result.code, "parse_precondition");
    assert.equal(result.pathRedacted, true);
    assert.equal(context.applied.length, 0, "stale source after picker must not apply replacement");
  }

  {
    const context = createChooseHarness({
      activeSourceId: "stable-source",
      picker(pickerContext) {
        pickerContext.session.selectionRevision += 1;
        return {
          status: "opened",
          mediaType: "image/png",
          sizeBytes: 1,
          sha256: "replacement-sha",
          value: "data:image/png;base64,AA==",
          pathRedacted: true
        };
      }
    });
    const result = await context.callPicker({ targetId: "vap_fusion_1", sourceId: "stable-source" });
    assert.equal(context.dialogCalls, 1);
    assert.equal(result.status, "failed");
    assert.equal(result.code, "replacement_target_stale");
    assert.equal(result.pathRedacted, true);
    assert.equal(context.applied.length, 0, "changed model binding must reject before replacement mutation");
  }

  const createApplyHarness = ({
    activeSourceId = "active-source",
    selection,
    returnedRuntimeTargetId = "badge"
  } = {}) => {
    const context = {
      assertMultiFormatDesktopProduct() {},
      applyCalls: [],
      session: {
        activeSourceId,
        async resolveReplacementSelection() {
          return selection ?? {
            status: "accepted",
            format: "vap",
            kind: "image",
            publicTargetId: "vap_fusion_2",
            runtimeTargetId: "badge",
            bindingToken: "binding:1",
            pathRedacted: true
          };
        },
        async applyReplacement(input) {
          context.applyCalls.push(input);
          return {
            status: "opened",
            sourceId: context.session.activeSourceId,
            model: {
              replacement: {
                lastAction: {
                  status: "accepted",
                  ...(returnedRuntimeTargetId ? { runtimeTargetId: returnedRuntimeTargetId } : {})
                }
              }
            }
          };
        }
      },
      getMultiFormatDesktopSession() {
        return context.session;
      }
    };
    vm.runInNewContext(`${selectionFailureSource}; ${applySource}; globalThis.applyReplacement = applyMultiFormatReplacement;`, context);
    return context;
  };

  for (const input of [
    { targetId: "vap_fusion_2", sourceId: "" },
    { targetId: "", sourceId: "active-source" }
  ]) {
    const context = createApplyHarness();
    const result = await context.applyReplacement({ ...input, kind: "image", value: "data:image/png;base64,AA==" });
    assert.equal(result.status, "failed");
    assert.equal(result.pathRedacted, true);
    assert.equal(context.applyCalls.length, 0);
  }

  {
    const context = createApplyHarness({
      selection: {
        status: "blocked",
        diagnostic: { code: "replacement_target_ambiguous", message: "Ambiguous target." },
        pathRedacted: true
      }
    });
    const result = await context.applyReplacement({
      targetId: "vap_fusion_2",
      sourceId: "active-source",
      kind: "image",
      value: "data:image/png;base64,AA=="
    });
    assert.equal(result.status, "failed");
    assert.equal(result.code, "replacement_target_ambiguous");
    assert.equal(context.applyCalls.length, 0);
  }

  {
    const context = createApplyHarness({ returnedRuntimeTargetId: "" });
    const result = await context.applyReplacement({
      targetId: "vap_fusion_2",
      sourceId: "active-source",
      selectionToken: "binding:1",
      kind: "image",
      value: "data:image/png;base64,AA=="
    });
    assert.equal(result.status, "failed");
    assert.equal(result.code, "replacement_target_malformed");
    assert.equal(result.pathRedacted, true);
    assert.equal(result.replacementRuntimeValue, undefined);
  }

  {
    const context = createApplyHarness();
    const stale = await context.applyReplacement({
      targetId: "vap_fusion_2",
      sourceId: "active-source",
      selectionToken: "binding:stale",
      kind: "image",
      value: "data:image/png;base64,AA=="
    });
    assert.equal(stale.status, "failed");
    assert.equal(stale.code, "replacement_target_stale");
    assert.equal(context.applyCalls.length, 0);

    const accepted = await context.applyReplacement({
      targetId: "vap_fusion_2",
      sourceId: "active-source",
      selectionToken: "binding:1",
      kind: "image",
      value: "data:image/png;base64,AA=="
    });
    assert.equal(accepted.replacementRuntimeValue.targetId, "badge");
    assert.equal(context.applyCalls.length, 1);
    assert.equal(context.applyCalls[0].targetId, "vap_fusion_2");
  }

  const createReadHarness = ({ openSync, fstatSync, readSync }) => {
    const context = {
      Buffer,
      path,
      createHash,
      closeCalls: 0,
      MAX_MULTI_FORMAT_REPLACEMENT_IMAGE_BYTES: 8,
      openSync,
      fstatSync,
      readSync,
      closeSync() {
        context.closeCalls += 1;
      }
    };
    vm.runInNewContext(`${readSource}; globalThis.readReplacement = readMultiFormatReplacementImageFile;`, context);
    return context;
  };

  {
    const context = createReadHarness({
      openSync() {
        return 7;
      },
      fstatSync() {
        return { isFile: () => true, size: 1 };
      },
      readSync() {
        throw new Error("/Users/alice/Desktop/secret.png");
      }
    });
    const result = context.readReplacement("/Users/alice/Desktop/secret.png");
    assert.equal(result.status, "failed");
    assert.equal(result.code, "missing_resource");
    assert.equal(result.message, "Replacement preview image could not be read.");
    assert.equal(result.pathRedacted, true);
    assert.equal(context.closeCalls, 1);
    assert.doesNotMatch(JSON.stringify(result), /Users|alice|Desktop|secret/);
  }

  {
    const context = createReadHarness({
      openSync() {
        return 8;
      },
      fstatSync() {
        return { isFile: () => true, size: 1 };
      },
      readSync(_fd, _buffer, _offset, length) {
        return length;
      }
    });
    const result = context.readReplacement("/Users/alice/Desktop/growing.png");
    assert.equal(result.status, "failed");
    assert.equal(result.code, "parse_precondition");
    assert.equal(result.pathRedacted, true);
    assert.equal(result.value, undefined, "oversized post-stat growth must not return an opened data URI");
    assert.equal(context.closeCalls, 1);
    assert.doesNotMatch(JSON.stringify(result), /Users|alice|Desktop|growing/);
  }
});

test("0.2 host reset requires active source and canonical target authority", async () => {
  const main = await readFile(path.join(experimentRoot, "main.cjs"), "utf8");
  const resetSource = extractFunctionSource(main, "async function resetMultiFormatReplacement(input)");
  const selectionFailureSource = extractFunctionSource(main, "function replacementSelectionFailure(selection)");
  const createHarness = ({
    activeSourceId = "active-source",
    runtimeTargetId = "avatar",
    returnedType = "resetReplacement",
    returnedPublicTargetId = "vap_fusion_1",
    returnedTargetId = "avatar",
    returnedBindingToken = "selection:1"
  } = {}) => {
    const context = {
      sessionCalls: 0,
      resetCalls: [],
      assertMultiFormatDesktopProduct() {},
      getMultiFormatDesktopSession() {
        context.sessionCalls += 1;
        return {
          activeSourceId,
          async resolveReplacementSelection(input) {
            return {
              status: "accepted",
              publicTargetId: String(input?.targetId ?? ""),
              runtimeTargetId,
              bindingToken: "selection:1",
              pathRedacted: true
            };
          },
          async resetReplacement(input) {
            context.resetCalls.push(input);
            return {
              status: "previewReady",
              model: {
                replacement: {
                  lastAction: {
                    type: returnedType,
                    status: "accepted",
                    publicTargetId: returnedPublicTargetId,
                    runtimeTargetId: returnedTargetId,
                    bindingToken: returnedBindingToken
                  }
                }
              }
            };
          }
        };
      }
    };
    vm.runInNewContext(`${selectionFailureSource}; ${resetSource}; globalThis.callReset = resetMultiFormatReplacement;`, context);
    return context;
  };

  for (const input of [
    { targetId: "avatar", kind: "image" },
    { sourceId: "active-source", targetId: "", kind: "image" },
    { sourceId: "active-source", targetId: "avatar", kind: "unknown" }
  ]) {
    const context = createHarness();
    const result = await context.callReset(input);
    assert.equal(result.status, "failed");
    assert.equal(result.code, "parse_precondition");
    assert.equal(result.pathRedacted, true);
    assert.equal(context.sessionCalls, 0);
    assert.deepEqual(context.resetCalls, []);
  }

  {
    const context = createHarness({ activeSourceId: "current-source" });
    const result = await context.callReset({ sourceId: "stale-source", targetId: "avatar", kind: "image" });
    assert.equal(result.status, "failed");
    assert.equal(result.code, "replacement_target_stale");
    assert.deepEqual(context.resetCalls, []);
  }

  {
    const context = createHarness();
    const result = await context.callReset({ sourceId: "active-source", targetId: "vap_fusion_1", kind: "image" });
    assert.equal(result.status, "previewReady");
    assert.equal(context.resetCalls.length, 1);
    assert.equal(context.resetCalls[0].targetId, "vap_fusion_1");
    assert.equal(context.resetCalls[0].kind, "image");
    assert.equal(result.model.replacement.lastAction.runtimeTargetId, "avatar");
  }

  {
    const context = createHarness({ runtimeTargetId: "avatar", returnedTargetId: "wrong-target" });
    const result = await context.callReset({ sourceId: "active-source", targetId: "vap_fusion_1", kind: "image" });
    assert.equal(result.status, "failed");
    assert.equal(result.code, "replacement_target_malformed");
    assert.equal(result.pathRedacted, true);
    assert.doesNotMatch(JSON.stringify(result), /Users|Desktop|private/iu);
  }

  for (const receipt of [
    { returnedType: "applyReplacement" },
    { returnedPublicTargetId: "vap_fusion_2" },
    { returnedBindingToken: "selection:stale" }
  ]) {
    const context = createHarness(receipt);
    const result = await context.callReset({ sourceId: "active-source", targetId: "vap_fusion_1", kind: "image" });
    assert.equal(result.status, "failed");
    assert.equal(result.code, "replacement_target_malformed");
    assert.equal(result.pathRedacted, true);
    assert.equal(result.model, undefined, "contradictory reset receipts must not reach renderer bookkeeping");
    assert.equal(context.resetCalls.length, 1);
    assert.doesNotMatch(JSON.stringify(result), /Users|Desktop|private/iu);
  }
});

test("0.2 SVGA runtime payload reads complete bounded files across partial reads", async () => {
  const sessionSource = await readFile(path.join(experimentRoot, "multiformat-desktop-session.cjs"), "utf8");
  const readSource = extractFunctionSource(sessionSource, "function readBoundedFileBuffer(filePath, maxBytes)");

  const createReadHarness = ({ statSize = 5, data = [1, 2, 3, 4, 5], chunkSize = 2 } = {}) => {
    const bytes = Buffer.from(data);
    const context = {
      Buffer,
      cursor: 0,
      closeCalls: 0,
      openSync() {
        return 11;
      },
      fstatSync() {
        return { isFile: () => true, size: statSize };
      },
      readSync(_fd, scratch, offset, length) {
        const available = Math.max(0, bytes.byteLength - context.cursor);
        const count = Math.min(length, chunkSize, available);
        if (count <= 0) return 0;
        bytes.copy(scratch, offset, context.cursor, context.cursor + count);
        context.cursor += count;
        return count;
      },
      closeSync() {
        context.closeCalls += 1;
      }
    };
    vm.runInNewContext(`${readSource}; globalThis.readBounded = readBoundedFileBuffer;`, context);
    return context;
  };

  {
    const context = createReadHarness({ statSize: 5, data: [1, 2, 3, 4, 5], chunkSize: 2 });
    const result = context.readBounded("/Users/alice/source.svga", 8);
    assert.equal(Buffer.isBuffer(result), true);
    assert.deepEqual([...result], [1, 2, 3, 4, 5]);
    assert.equal(context.closeCalls, 1);
  }

  for (const fixture of [
    { name: "shrink", statSize: 5, data: [1, 2], chunkSize: 2 },
    { name: "growth", statSize: 5, data: [1, 2, 3, 4, 5, 6], chunkSize: 3 }
  ]) {
    const context = createReadHarness(fixture);
    assert.throws(
      () => context.readBounded(`/Users/alice/${fixture.name}.svga`, 8),
      /File changed outside the bounded read limit\./,
      `${fixture.name} must reject instead of returning truncated or grown payload bytes`
    );
    assert.equal(context.closeCalls, 1);
  }
});

test("0.2 installed file-open events route to a visible terminal multi-format state", async () => {
  const main = await readFile(path.join(experimentRoot, "main.cjs"), "utf8");
  const controller = await readFile(path.join(experimentRoot, "web/multiformat-desktop-preview-controller.mjs"), "utf8");
  const actionBridge = await readFile(path.join(experimentRoot, "web/short-term-macos-action-bridge.mjs"), "utf8");
  const app = await readFile(path.join(experimentRoot, "web/short-term-macos-app.mjs"), "utf8");

  const appOpenFileStart = main.indexOf('app.on("open-file", handleMultiFormatOpenFileEvent);');
  const mainStartedTraceStart = main.indexOf('phase: "main_started"');
  const handlerStart = main.indexOf("function handleMultiFormatOpenFileEvent");
  const rendererReadyHandlerStart = main.indexOf("ipcMain.handle(IPC_CHANNELS.multiFormatRendererReady");
  const whenReadyStart = main.indexOf("app.whenReady().then(createExperimentWindow)");
  assert.notEqual(appOpenFileStart, -1, "installed macOS file-open events must be handled");
  assert.notEqual(mainStartedTraceStart, -1, "main startup trace must remain present");
  assert.notEqual(handlerStart, -1, "installed macOS file-open handler must be named for early registration");
  assert.notEqual(rendererReadyHandlerStart, -1, "renderer-ready IPC must exist");
  assert.ok(
    appOpenFileStart < mainStartedTraceStart,
    "file-open listener must be registered before startup trace so launch-time events are not missed"
  );
  assert.ok(
    appOpenFileStart < whenReadyStart,
    "file-open events can arrive before app.whenReady and must be queued early"
  );
  const appOpenFileSource = main.slice(handlerStart, whenReadyStart);
  assert.match(appOpenFileSource, /if \(!isMultiFormatDesktopProduct\) \{/);
  assert.match(appOpenFileSource, /return;/);
  assert.match(appOpenFileSource, /event\.preventDefault\(\);/);
  assert.ok(
    appOpenFileSource.indexOf("if (!isMultiFormatDesktopProduct) {") < appOpenFileSource.indexOf("event.preventDefault();"),
    "formal 0.1 must not see a multi-format file-open side effect"
  );
  assert.match(appOpenFileSource, /enqueueMultiFormatOpenFileEvent\(filePath, sourceId\)/);

  assert.match(main, /pendingMultiFormatOpenFileEvents/);
  assert.match(main, /openMultiFormatFilePath\(item\.filePath, "fileOpenEvent"\)/);
  assert.match(main, /beginHostFileOpen/);
  assert.match(main, /completeHostFileOpen/);
  assert.match(main, /failHostFileOpen/);
  assert.match(main, /flushPendingMultiFormatOpenFileEvents\(\)/);
  const rendererLoadCompletedStart = main.indexOf('phase: "renderer_load_completed"');
  const normalVisibleStartupStart = main.indexOf("if (normalVisibleStartupMode)");
  assert.notEqual(rendererLoadCompletedStart, -1, "renderer load completion trace must remain present");
  const rendererLoadCompletedSource = main.slice(rendererLoadCompletedStart, normalVisibleStartupStart);
  assert.doesNotMatch(
    rendererLoadCompletedSource,
    /multiFormatDesktopRendererReady\s*=\s*true|flushPendingMultiFormatOpenFileEvents\(\)/,
    "loadURL completion alone must not mark the renderer bridge ready or flush launch-time file-open events"
  );
  const rendererReadySource = main.slice(rendererReadyHandlerStart, main.indexOf("ipcMain.handle(", rendererReadyHandlerStart + 1));
  assert.match(rendererReadySource, /input\?\.phase !== "renderer_action_bridge_ready"/);
  assert.match(rendererReadySource, /multiFormatDesktopRendererReady\s*=\s*true/);
  assert.match(rendererReadySource, /void flushPendingMultiFormatOpenFileEvents\(\)\.catch/);
  assert.ok(
    rendererReadySource.indexOf("multiFormatDesktopRendererReady = true") < rendererReadySource.indexOf("void flushPendingMultiFormatOpenFileEvents().catch"),
    "renderer-ready IPC must flip readiness before flushing queued file-open events"
  );
  assert.ok(
    rendererReadySource.indexOf("void flushPendingMultiFormatOpenFileEvents().catch") < rendererReadySource.indexOf("return { accepted: true }"),
    "renderer-ready IPC must start queued file-open processing before returning accepted"
  );
  assert.doesNotMatch(
    appOpenFileSource,
    /dialog\.showOpenDialog/,
    "installed file-open events must not open a second dialog"
  );

  assert.match(actionBridge, /beginHostFileOpen/);
  assert.match(actionBridge, /completeHostFileOpen/);
  assert.match(actionBridge, /failHostFileOpen/);
  assert.match(controller, /function beginHostFileOpen/);
  assert.match(controller, /function completeHostFileOpen/);
  assert.match(controller, /function failHostFileOpen/);
  assert.match(controller, /resolveMultiFormatOpenOutcome\(Promise\.resolve\(payload\?\.result\)/);
  assert.match(controller, /isActiveRequest\(hostFileOpenRequest\)/);
  assert.ok(
    app.indexOf("controller.initialize();") < app.indexOf("await bridge?.notifyMultiFormatRendererReady?.();"),
    "renderer action bridge must initialize visible state before notifying main to flush launch-time file-open events"
  );
});

test("0.2 launch-time file-open queue survives loadURL until renderer-ready IPC", async () => {
  const main = await readFile(path.join(experimentRoot, "main.cjs"), "utf8");
  const flushStart = main.indexOf("async function flushPendingMultiFormatOpenFileEvents()");
  const dispatchStart = main.indexOf("async function dispatchMultiFormatOpenFileEvent");
  const rendererLoadCompletedStart = main.indexOf('phase: "renderer_load_completed"');
  const normalVisibleStartupStart = main.indexOf("if (normalVisibleStartupMode)");
  const rendererReadyHandlerStart = main.indexOf("ipcMain.handle(IPC_CHANNELS.multiFormatRendererReady");
  const nextIpcHandlerStart = main.indexOf("ipcMain.handle(", rendererReadyHandlerStart + 1);

  assert.notEqual(flushStart, -1, "flush function must exist");
  assert.notEqual(dispatchStart, -1, "dispatch function must exist");
  assert.notEqual(rendererLoadCompletedStart, -1, "renderer load completion trace must exist");
  assert.notEqual(rendererReadyHandlerStart, -1, "renderer-ready IPC handler must exist");

  const rendererLoadCompletedSource = main.slice(rendererLoadCompletedStart, normalVisibleStartupStart);
  assert.doesNotMatch(rendererLoadCompletedSource, /multiFormatDesktopRendererReady\s*=\s*true/);
  assert.doesNotMatch(rendererLoadCompletedSource, /flushPendingMultiFormatOpenFileEvents\(\)/);

  const rendererReadySource = main.slice(rendererReadyHandlerStart, nextIpcHandlerStart);
  assert.match(rendererReadySource, /phase: "renderer_action_bridge_ready"/);
  assert.match(rendererReadySource, /multiFormatDesktopRendererReady\s*=\s*true/);
  assert.match(rendererReadySource, /void flushPendingMultiFormatOpenFileEvents\(\)\.catch/);

  const flushSource = main.slice(flushStart, dispatchStart);
  assert.match(flushSource, /const item = pendingMultiFormatOpenFileEvents\[0\]/);
  assert.match(flushSource, /await dispatchMultiFormatOpenFileEvent\(activeMainWindow, item\);[\s\S]*pendingMultiFormatOpenFileEvents\.shift\(\);/);
  assert.match(flushSource, /phase: "dispatch_failed"/);
  assert.match(flushSource, /return;/);
  assert.doesNotMatch(
    flushSource,
    /const item = pendingMultiFormatOpenFileEvents\.shift\(\);/,
    "queued launch-time file-open event must not be removed before renderer action bridge accepts it"
  );
});

test("0.2 multi-format desktop session rejects unsupported drops before source registration", async () => {
  const sessionRoot = await mkdtemp(path.join(os.tmpdir(), "auto-svga-wp6-session-"));
  const sourceStore = new Map();
  const session = createMultiFormatDesktopPreviewSession({
    repoRoot,
    sessionRoot,
    sourceStore
  });

  assert.equal(MULTIFORMAT_DESKTOP_PRODUCT_MILESTONE_ID, "0.2-multiformat-preview");
  try {
    await assert.rejects(
      session.openDroppedFile({
        displayName: "../unsafe-preview.gif",
        bytes: [71, 73, 70, 56]
      }),
      (error) => {
        assert.match(String(error?.message ?? error), /Only local SVGA, Lottie JSON, and VAP\/MP4 candidates/);
        assert.doesNotMatch(String(error?.message ?? error), /auto-svga-wp6-session|unsafe-preview/);
        return true;
      }
    );
    assert.equal(sourceStore.size, 0);
  } finally {
    await rm(sessionRoot, { recursive: true, force: true });
  }
});

test("0.2 multi-format desktop session opens synthetic SVGA, Lottie, and VAP candidates to terminal states", async () => {
  const sessionRoot = await mkdtemp(path.join(os.tmpdir(), "auto-svga-terminal-session-"));
  const sourceStore = new Map();
  const session = createMultiFormatDesktopPreviewSession({
    repoRoot,
    sessionRoot,
    sourceStore,
    openTimeoutMs: 1000
  });
  const svgaPath = path.join(sessionRoot, "synthetic-svga.svga");
  const lottiePath = path.join(sessionRoot, "synthetic-lottie.json");
  const vapPath = path.join(sessionRoot, "synthetic-vap.mp4");
  const vapSidecarPath = path.join(sessionRoot, "synthetic-vap-sidecar.mp4");
  const vapSidecarConfigPath = path.join(sessionRoot, "synthetic-vap-sidecar.json");
  const vapFusionPath = path.join(sessionRoot, "synthetic-vap-fusion.mp4");

  try {
    await copyFile(path.join(experimentRoot, ".runtime/fixture/avatar-frame-smoke.svga"), svgaPath);
    await writeFile(lottiePath, JSON.stringify({
      v: "5.7.4",
      w: 120,
      h: 80,
      fr: 30,
      ip: 0,
      op: 30,
      layers: [
        {
          ind: 1,
          ty: 5,
          nm: "Greeting",
          t: {
            d: {
              k: [
                { s: { t: "Original greeting" } }
              ]
            }
          }
        }
      ],
      assets: []
    }));
    await writeFile(vapPath, createSyntheticVapMp4Bytes());
    await writeFile(vapSidecarPath, createSyntheticVapMp4WithoutEmbeddedVapcBytes());
    await writeFile(vapSidecarConfigPath, JSON.stringify(createSyntheticVapcDocument()));
    await writeFile(vapFusionPath, createSyntheticVapMp4Bytes({
      src: [
        { srcId: 1, srcType: "image", srcTag: "avatar", w: 120, h: 120, fitType: "centerCrop" },
        { srcId: 2, srcType: "text", srcTag: "title", color: "#ffffff", style: "bold" }
      ],
      frame: [{
        i: 0,
        obj: [
          { srcId: 1, z: 3, frame: { x: 10, y: 20, w: 120, h: 120 }, mFrame: { x: 0, y: 0, w: 120, h: 120 }, mt: 0 },
          { srcId: 2, z: 4, frame: { x: 160, y: 20, w: 200, h: 40 }, mFrame: { x: 0, y: 0, w: 200, h: 40 }, mt: 0 }
        ]
      }]
    }));

    const svga = await withTerminalTestDeadline(session.openLocalFilePath(svgaPath, "fileButton"), "svga");
    assert.equal(svga.status, "opened");
    assert.equal(svga.pathRedacted, true);
    assert.equal(svga.model.detectedFormat, "svga");
    assert.equal(svga.model.status, "playing");
    assert.notEqual(svga.model.status, "launch");
    assert.notEqual(svga.model.status, "loading");
    const svgaRuntime = await session.prepareRuntimePreview({
      sourceId: svga.sourceId,
      format: "svga",
      requestId: svga.model.requestId,
      replacements: svga.model.replacement
    });
    assert.equal(svgaRuntime.status, "prepared");
    assert.equal(svgaRuntime.pathRedacted, true);
    assert.equal(svgaRuntime.rendererHasFullPath, false);
    assert.deepEqual(svgaRuntime.runtimeScripts, ["/vendor/svga-web-2.4.4.js"]);
    assert.match(svgaRuntime.svgaBase64, /^[A-Za-z0-9+/=]+$/);
    assert.doesNotMatch(JSON.stringify(svgaRuntime), /\/Users|auto-svga-terminal-session/i);

    const lottie = await withTerminalTestDeadline(session.openLocalFilePath(lottiePath, "fileButton"), "lottie");
    assert.equal(lottie.status, "opened");
    assert.equal(lottie.pathRedacted, true);
    assert.equal(lottie.model.detectedFormat, "lottie");
    assert.equal(lottie.model.status, "playing");
    assert.notEqual(lottie.model.status, "launch");
    assert.notEqual(lottie.model.status, "loading");
    assert.equal(lottie.lifecycle.lottieLoads, 1);
    const lottieRuntime = await session.prepareRuntimePreview({
      sourceId: lottie.sourceId,
      format: "lottie",
      requestId: lottie.model.requestId,
      replacements: lottie.model.replacement
    });
    assert.equal(lottieRuntime.status, "prepared");
    assert.equal(lottieRuntime.pathRedacted, true);
    assert.equal(lottieRuntime.rendererHasFullPath, false);
    assert.deepEqual(lottieRuntime.runtimeScripts, ["/runtime-node-modules/lottie-web/build/player/lottie_svg.js"]);
    assert.equal(lottieRuntime.animationData.v, "5.7.4");
    assert.doesNotMatch(JSON.stringify(lottieRuntime), /\/Users|auto-svga-terminal-session/i);
    const lottieReplacementRuntime = await session.prepareRuntimePreview({
      sourceId: lottie.sourceId,
      format: "lottie",
      requestId: `${lottie.model.requestId}:replacement`,
      replacements: {
        active: [
          {
            targetId: "text:1",
            kind: "text",
            valuePreview: "Runtime greeting"
          }
        ]
      }
    });
    assert.equal(lottieReplacementRuntime.status, "prepared");
    assert.equal(lottieReplacementRuntime.animationData.layers[0].t.d.k[0].s.t, "Runtime greeting");
    assert.doesNotMatch(JSON.stringify(lottieReplacementRuntime), /\/Users|auto-svga-terminal-session/i);
    assert.equal(sourceStore.size, 2);

    const vap = await withTerminalTestDeadline(session.openLocalFilePath(vapPath, "fileButton"), "vap");
    assert.equal(vap.status, "opened");
    assert.equal(vap.pathRedacted, true);
    assert.equal(vap.model.detectedFormat, "vap");
    assert.equal(vap.model.status, "playing");
    assert.notEqual(vap.model.status, "launch");
    assert.notEqual(vap.model.status, "loading");
    assert.equal(vap.lifecycle.vapLoads, 1);
    assert.equal(vap.lifecycle.objectUrlsCreated, 1);
    const vapRuntime = await session.prepareRuntimePreview({
      sourceId: vap.sourceId,
      format: "vap",
      requestId: vap.model.requestId,
      replacements: vap.model.replacement
    });
    assert.equal(vapRuntime.status, "prepared");
    assert.equal(vapRuntime.pathRedacted, true);
    assert.equal(vapRuntime.rendererHasFullPath, false);
    assert.deepEqual(vapRuntime.runtimeScripts, ["/runtime-node-modules/video-animation-player/dist/vap.js"]);
    assert.match(vapRuntime.mp4Base64, /^[A-Za-z0-9+/=]+$/);
    assert.equal(vapRuntime.vapConfig.info.w, 720);
    assert.doesNotMatch(JSON.stringify(vapRuntime), /\/Users|auto-svga-terminal-session/i);
    const vapReplacementRuntime = await session.prepareRuntimePreview({
      sourceId: vap.sourceId,
      format: "vap",
      requestId: `${vap.model.requestId}:replacement`,
      replacements: {
        active: [
          {
            targetId: "title",
            kind: "text",
            valuePreview: "Runtime VAP title"
          }
        ]
      }
    });
    assert.equal(vapReplacementRuntime.status, "prepared");
    assert.equal(vapReplacementRuntime.fusionParams.title, "Runtime VAP title");
    assert.doesNotMatch(JSON.stringify(vapReplacementRuntime), /\/Users|auto-svga-terminal-session/i);
    const vapSidecar = await withTerminalTestDeadline(session.openLocalFilePath(vapSidecarPath, "fileButton"), "vap-sidecar");
    assert.equal(vapSidecar.status, "opened");
    assert.equal(vapSidecar.model.detectedFormat, "vap");
    assert.equal(vapSidecar.model.status, "playing");
    assert.equal(vapSidecar.model.rightPanel.facts.some((fact) => fact.id === "format" && fact.value === "VAP"), true);
    assert.equal(vapSidecar.lifecycle.vapLoads, 2);
    assert.equal(vapSidecar.lifecycle.objectUrlsCreated, 2);
    const vapFusion = await withTerminalTestDeadline(session.openLocalFilePath(vapFusionPath, "fileButton"), "vap-fusion");
    assert.equal(vapFusion.status, "opened");
    assert.equal(vapFusion.model.detectedFormat, "vap");
    assert.equal(vapFusion.model.status, "playing");
    const vapFusionRuntime = await session.prepareRuntimePreview({
      sourceId: vapFusion.sourceId,
      format: "vap",
      requestId: `${vapFusion.model.requestId}:replacement`,
      replacements: {
        active: [
          {
            targetId: "avatar",
            kind: "image",
            valuePreview: `data:image/png;base64,${Buffer.from([1, 2, 3, 4]).toString("base64")}`
          },
          {
            targetId: "title",
            kind: "text",
            valuePreview: "Runtime VAP title"
          }
        ]
      }
    });
    assert.equal(vapFusionRuntime.status, "prepared");
    assert.deepEqual(Object.keys(vapFusionRuntime.fusionParams).sort(), ["avatar", "title"]);
    assert.deepEqual(vapFusionRuntime.vapConfig.info.aFrame, [0, 405, 720, 405]);
    assert.deepEqual(vapFusionRuntime.vapConfig.info.rgbFrame, [0, 0, 720, 405]);
    assert.equal(vapFusionRuntime.vapConfig.src[0].srcTag, "avatar");
    assert.equal(vapFusionRuntime.vapConfig.src[0].srcType, "img");
    assert.equal(vapFusionRuntime.vapConfig.src[1].srcTag, "title");
    assert.equal(vapFusionRuntime.vapConfig.src[1].srcType, "txt");
    assert.deepEqual(vapFusionRuntime.vapConfig.frame[0].obj[0].frame, [10, 20, 120, 120]);
    assert.doesNotMatch(JSON.stringify(vapFusionRuntime), /\/Users|auto-svga-terminal-session/i);
    assert.equal(sourceStore.size, 5);
  } finally {
    await rm(sessionRoot, { recursive: true, force: true });
  }
});

test("0.2 host-owned drag intake preserves embedded, adjacent, absent, and Lottie resource context", async () => {
  const sessionRoot = await mkdtemp(path.join(os.tmpdir(), "auto-svga-host-intake-context-"));
  const sourceStore = new Map();
  const session = createMultiFormatDesktopPreviewSession({
    repoRoot,
    sessionRoot,
    sourceStore,
    openTimeoutMs: 1000
  });
  const embeddedVapPath = path.join(sessionRoot, "embedded-vap.mp4");
  const adjacentVapPath = path.join(sessionRoot, "adjacent-vap.mp4");
  const adjacentVapcPath = path.join(sessionRoot, "adjacent-vap.json");
  const isolatedVapPath = path.join(sessionRoot, "isolated-vap.mp4");
  const lottiePath = path.join(sessionRoot, "external-image-lottie.json");
  const lottieImagePath = path.join(sessionRoot, "avatar.png");

  try {
    await writeFile(embeddedVapPath, createSyntheticVapMp4Bytes());
    await writeFile(adjacentVapPath, createSyntheticVapMp4WithoutEmbeddedVapcBytes());
    await writeFile(adjacentVapcPath, JSON.stringify(createSyntheticVapcDocument()));
    await writeFile(isolatedVapPath, createSyntheticVapMp4WithoutEmbeddedVapcBytes());
    await writeFile(lottieImagePath, Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M/wHwAFgAI/1C1Z4QAAAABJRU5ErkJggg==",
      "base64"
    ));
    await writeFile(lottiePath, JSON.stringify({
      v: "5.13.0",
      w: 120,
      h: 80,
      fr: 30,
      ip: 0,
      op: 30,
      layers: [{ ind: 1, ty: 2, refId: "image_0" }],
      assets: [{ id: "image_0", u: "", p: "avatar.png", w: 1, h: 1 }]
    }));

    const embedded = await session.openLocalFilePath(embeddedVapPath, "dragDrop");
    assert.equal(embedded.model.status, "playing");
    assert.equal(embedded.model.detectedFormat, "vap");
    assert.equal(embedded.model.openedFrom, "dragDrop");

    const adjacent = await session.openLocalFilePath(adjacentVapPath, "dragDrop");
    assert.equal(adjacent.model.status, "playing");
    assert.equal(adjacent.model.detectedFormat, "vap");
    assert.equal(adjacent.model.openedFrom, "dragDrop");

    const isolated = await session.openLocalFilePath(isolatedVapPath, "dragDrop");
    assert.notEqual(isolated.model.status, "previewReady");
    assert.equal(isolated.model.detectedFormat, "vap");
    assert.equal(isolated.model.rightPanel.issues.some((issue) =>
      issue.code === "invalid_file"
      && issue.message === "文件内容不完整或格式异常，无法预览。"
      && issue.pathRedacted === true
    ), true, JSON.stringify(isolated.model.rightPanel.issues));

    const lottie = await session.openLocalFilePath(lottiePath, "dragDrop");
    assert.equal(lottie.model.status, "playing");
    assert.equal(lottie.model.detectedFormat, "lottie");
    const lottieRuntime = await session.prepareRuntimePreview({
      sourceId: lottie.sourceId,
      format: "lottie",
      requestId: lottie.model.requestId,
      replacements: lottie.model.replacement
    });
    assert.equal(lottieRuntime.status, "prepared");
    assert.match(lottieRuntime.animationData.assets[0].p, /^data:image\/png;base64,/u);

    const serialized = JSON.stringify({ embedded, adjacent, isolated, lottie, lottieRuntime });
    assert.doesNotMatch(serialized, /auto-svga-host-intake-context|\/Users\//u);
  } finally {
    await rm(sessionRoot, { recursive: true, force: true });
  }
});

test("0.2 host-owned Lottie intake rejects adjacent image aliases that escape the source root", async () => {
  const sessionRoot = await mkdtemp(path.join(os.tmpdir(), "auto-svga-lottie-root-bound-"));
  const externalRoot = await mkdtemp(path.join(os.tmpdir(), "auto-svga-lottie-external-"));
  const session = createMultiFormatDesktopPreviewSession({
    repoRoot,
    sessionRoot,
    sourceStore: new Map(),
    openTimeoutMs: 1000
  });
  const lottiePath = path.join(sessionRoot, "root-bound-lottie.json");
  const aliasedImagePath = path.join(sessionRoot, "avatar.png");
  const externalImagePath = path.join(externalRoot, "owner-avatar.png");

  try {
    await writeFile(externalImagePath, Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M/wHwAFgAI/1C1Z4QAAAABJRU5ErkJggg==",
      "base64"
    ));
    await symlink(externalImagePath, aliasedImagePath);
    await writeFile(lottiePath, JSON.stringify({
      v: "5.13.0",
      w: 120,
      h: 80,
      fr: 30,
      ip: 0,
      op: 30,
      layers: [{ ind: 1, ty: 2, refId: "image_0" }],
      assets: [{ id: "image_0", u: "", p: "avatar.png", w: 1, h: 1 }]
    }));

    const opened = await session.openLocalFilePath(lottiePath, "fileButton");
    assert.notEqual(opened.model.status, "playing");
    assert.equal(opened.model.rightPanel.issues.some((issue) =>
      issue.code === "missing_resource" && issue.pathRedacted === true
    ), true, JSON.stringify(opened.model.rightPanel.issues));

    const runtime = await session.prepareRuntimePreview({
      sourceId: opened.sourceId,
      format: "lottie",
      requestId: opened.model.requestId,
      replacements: opened.model.replacement
    });
    assert.equal(runtime.status, "failed");
    assert.equal(runtime.issue.code, "missing_resource");
    assert.doesNotMatch(JSON.stringify({ opened, runtime }), /auto-svga-lottie-(?:root-bound|external)-|owner-avatar|\/Users\//u);
  } finally {
    await rm(sessionRoot, { recursive: true, force: true });
    await rm(externalRoot, { recursive: true, force: true });
  }
});

test("0.2 host-owned Lottie intake rejects hardlink, case, and Unicode adjacent aliases", async () => {
  const cases = [
    {
      id: "hardlink",
      actualName: "avatar.png",
      referencedName: "avatar.png",
      async prepare(sessionRoot, externalRoot) {
        await writeFile(path.join(externalRoot, "owner-avatar.png"), await createTestPng([255, 0, 0, 255]));
        await link(path.join(externalRoot, "owner-avatar.png"), path.join(sessionRoot, "avatar.png"));
      }
    },
    {
      id: "case-alias",
      actualName: "avatar.png",
      referencedName: "AVATAR.PNG",
      async prepare(sessionRoot) {
        await writeFile(path.join(sessionRoot, "avatar.png"), await createTestPng([0, 255, 0, 255]));
      }
    },
    {
      id: "unicode-alias",
      actualName: "café.png",
      referencedName: "cafe\u0301.png",
      async prepare(sessionRoot) {
        await writeFile(path.join(sessionRoot, "café.png"), await createTestPng([0, 0, 255, 255]));
      }
    }
  ];

  for (const variant of cases) {
    const sessionRoot = await mkdtemp(path.join(os.tmpdir(), `auto-svga-lottie-${variant.id}-`));
    const externalRoot = await mkdtemp(path.join(os.tmpdir(), `auto-svga-lottie-${variant.id}-external-`));
    const session = createMultiFormatDesktopPreviewSession({
      repoRoot,
      sessionRoot,
      sourceStore: new Map(),
      openTimeoutMs: 1000
    });
    const lottiePath = path.join(sessionRoot, `${variant.id}.json`);

    try {
      await variant.prepare(sessionRoot, externalRoot);
      await writeFile(lottiePath, JSON.stringify({
        v: "5.13.0",
        w: 120,
        h: 80,
        fr: 30,
        ip: 0,
        op: 30,
        layers: [{ ind: 1, ty: 2, refId: "image_0" }],
        assets: [{ id: "image_0", u: "", p: variant.referencedName, w: 1, h: 1 }]
      }));

      const opened = await session.openLocalFilePath(lottiePath, "fileButton");
      assert.notEqual(opened.model.status, "playing", variant.id);
      assert.equal(opened.model.rightPanel.issues.some((issue) =>
        issue.code === "missing_resource" && issue.pathRedacted === true
      ), true, `${variant.id}: ${JSON.stringify(opened.model.rightPanel.issues)}`);
      const runtime = await session.prepareRuntimePreview({
        sourceId: opened.sourceId,
        format: "lottie",
        requestId: opened.model.requestId,
        replacements: opened.model.replacement
      });
      assert.equal(runtime.status, "failed", variant.id);
      assert.equal(runtime.issue.code, "missing_resource", variant.id);
      assert.doesNotMatch(JSON.stringify({ opened, runtime }), /auto-svga-lottie-|owner-avatar|\/Users\//u);
    } finally {
      await rm(sessionRoot, { recursive: true, force: true });
      await rm(externalRoot, { recursive: true, force: true });
    }
  }
});

test("0.2 host-owned Lottie runtime rejects adjacent resource growth, replacement, and ancestor swap after Open", async () => {
  const cases = [
    {
      id: "growth",
      async mutate(lottieDir) {
        await writeFile(path.join(lottieDir, "avatar.png"), Buffer.concat([
          await createTestPng([255, 0, 0, 255]),
          Buffer.from([1, 2, 3, 4])
        ]));
      }
    },
    {
      id: "replacement",
      async mutate(lottieDir) {
        await writeFile(path.join(lottieDir, "avatar.png"), await createTestPng([0, 255, 0, 255]));
      }
    },
    {
      id: "ancestor-swap",
      async mutate(lottieDir) {
        const parent = path.dirname(lottieDir);
        const swapped = path.join(parent, "asset-root-swapped");
        await rename(lottieDir, swapped);
        await mkdir(lottieDir, { recursive: true });
        await writeFile(path.join(lottieDir, "avatar.png"), await createTestPng([0, 0, 255, 255]));
        await writeFile(path.join(lottieDir, "external-image-lottie.json"), lottieFixtureJson("avatar.png"));
      }
    }
  ];

  for (const variant of cases) {
    const sessionRoot = await mkdtemp(path.join(os.tmpdir(), `auto-svga-lottie-mutation-${variant.id}-`));
    const lottieDir = path.join(sessionRoot, "asset-root");
    const sourceStore = new Map();
    const session = createMultiFormatDesktopPreviewSession({
      repoRoot,
      sessionRoot,
      sourceStore,
      openTimeoutMs: 1000
    });
    const lottiePath = path.join(lottieDir, "external-image-lottie.json");

    try {
      await mkdir(lottieDir, { recursive: true });
      await writeFile(path.join(lottieDir, "avatar.png"), await createTestPng([255, 0, 0, 255]));
      await writeFile(lottiePath, lottieFixtureJson("avatar.png"));
      const opened = await session.openLocalFilePath(lottiePath, "fileButton");
      assert.equal(opened.model.status, "playing", variant.id);

      await variant.mutate(lottieDir);
      const runtime = await session.prepareRuntimePreview({
        sourceId: opened.sourceId,
        format: "lottie",
        requestId: opened.model.requestId,
        replacements: opened.model.replacement
      });
      assert.equal(runtime.status, "failed", variant.id);
      assert.equal(runtime.issue.code, "missing_resource", variant.id);
      assert.doesNotMatch(JSON.stringify({ opened, runtime }), /auto-svga-lottie-mutation-|\/Users\//u);
    } finally {
      await rm(sessionRoot, { recursive: true, force: true });
    }
  }
});

test("0.2 desktop session rejects source mutation and stale source IDs before runtime prepare, apply, and Reset", async () => {
  const sessionRoot = await mkdtemp(path.join(os.tmpdir(), "auto-svga-source-authority-"));
  const sourceStore = new Map();
  const session = createMultiFormatDesktopPreviewSession({
    repoRoot,
    sessionRoot,
    sourceStore,
    openTimeoutMs: 1000
  });
  const svgaPath = path.join(sessionRoot, "authority.svga");
  const otherSvgaPath = path.join(sessionRoot, "authority-other.svga");
  const sourceBytes = await createReplaceableWideSvgaFixture();
  const replacementDataUri = `data:image/png;base64,${(await createTestPng([0, 255, 0, 255])).toString("base64")}`;

  try {
    await writeFile(svgaPath, sourceBytes);
    await writeFile(otherSvgaPath, sourceBytes);

    const opened = await session.openLocalFilePath(svgaPath, "fileButton");
    assert.equal(opened.model.status, "playing");
    await writeFile(svgaPath, Buffer.concat([Buffer.from(sourceBytes), Buffer.from([1])]));
    const mutatedApply = await session.applyReplacement({
      sourceId: opened.sourceId,
      targetId: "profile_frame",
      kind: "image",
      value: replacementDataUri
    });
    assert.equal(mutatedApply.model.replacement.lastAction.status, "blocked");
    assert.equal(mutatedApply.model.replacement.lastAction.diagnostic.code, "svga_replacement_source_changed");
    const mutatedRuntime = await session.prepareRuntimePreview({
      sourceId: opened.sourceId,
      format: "svga",
      requestId: opened.model.requestId,
      replacements: opened.model.replacement
    });
    assert.equal(mutatedRuntime.status, "failed");
    assert.equal(mutatedRuntime.issue.code, "missing_resource");

    await writeFile(svgaPath, sourceBytes);
    const resetOpen = await session.openLocalFilePath(svgaPath, "menuOpen");
    const applied = await session.applyReplacement({
      sourceId: resetOpen.sourceId,
      targetId: "profile_frame",
      kind: "image",
      value: replacementDataUri
    });
    assert.equal(applied.model.replacement.lastAction.status, "accepted");
    await writeFile(svgaPath, Buffer.concat([Buffer.from(sourceBytes), Buffer.from([2])]));
    const mutatedReset = await session.resetReplacement({
      sourceId: resetOpen.sourceId,
      targetId: "profile_frame",
      kind: "image"
    });
    assert.equal(mutatedReset.model.replacement.lastAction.status, "blocked");
    assert.equal(mutatedReset.model.replacement.lastAction.diagnostic.code, "svga_replacement_source_changed");

    await writeFile(svgaPath, sourceBytes);
    const first = await session.openLocalFilePath(svgaPath, "menuOpen");
    const second = await session.openLocalFilePath(otherSvgaPath, "menuOpen");
    assert.notEqual(first.sourceId, second.sourceId);
    const staleAfterOtherOpen = await session.prepareRuntimePreview({
      sourceId: first.sourceId,
      format: "svga",
      requestId: first.model.requestId,
      replacements: first.model.replacement
    });
    assert.equal(staleAfterOtherOpen.status, "failed");
    assert.equal(staleAfterOtherOpen.issue.code, "missing_resource");

    const samePathReopen = await session.openLocalFilePath(svgaPath, "menuOpen");
    assert.notEqual(first.sourceId, samePathReopen.sourceId);
    const staleAfterSamePathReopen = await session.prepareRuntimePreview({
      sourceId: first.sourceId,
      format: "svga",
      requestId: first.model.requestId,
      replacements: first.model.replacement
    });
    assert.equal(staleAfterSamePathReopen.status, "failed");
    assert.equal(staleAfterSamePathReopen.issue.code, "missing_resource");
    assert.doesNotMatch(JSON.stringify({ mutatedApply, mutatedReset, staleAfterOtherOpen }), /auto-svga-source-authority-|\/Users\//u);
  } finally {
    await rm(sessionRoot, { recursive: true, force: true });
  }
});

test("0.2 desktop session rejects same-byte SVGA source identity replacement before Apply, Reset, and async Apply publication", async () => {
  const sourceBytes = await createReplaceableWideSvgaFixture();
  const replacementDataUri = `data:image/png;base64,${(await createTestPng([0, 255, 0, 255])).toString("base64")}`;

  async function createOpenedSession(rootPrefix = "auto-svga-source-identity-") {
    const sessionRoot = await mkdtemp(path.join(os.tmpdir(), rootPrefix));
    const session = createMultiFormatDesktopPreviewSession({
      repoRoot,
      sessionRoot,
      sourceStore: new Map(),
      openTimeoutMs: 1000
    });
    const svgaPath = path.join(sessionRoot, "identity.svga");
    await writeFile(svgaPath, sourceBytes);
    const opened = await session.openLocalFilePath(svgaPath, "fileButton");
    assert.equal(opened.model.status, "playing");
    return { sessionRoot, session, svgaPath, opened };
  }

  const beforeApply = await createOpenedSession();
  try {
    await replaceFileWithSameBytesAndNewInode(beforeApply.svgaPath, sourceBytes);
    const result = await beforeApply.session.applyReplacement({
      sourceId: beforeApply.opened.sourceId,
      targetId: "profile_frame",
      kind: "image",
      value: replacementDataUri
    });
    assert.equal(result.model.replacement.lastAction.status, "blocked");
    assert.equal(result.model.replacement.lastAction.diagnostic.code, "svga_replacement_source_changed");
  } finally {
    await rm(beforeApply.sessionRoot, { recursive: true, force: true });
  }

  const beforeReset = await createOpenedSession();
  try {
    const applied = await beforeReset.session.applyReplacement({
      sourceId: beforeReset.opened.sourceId,
      targetId: "profile_frame",
      kind: "image",
      value: replacementDataUri
    });
    assert.equal(applied.model.replacement.lastAction.status, "accepted");
    await replaceFileWithSameBytesAndNewInode(beforeReset.svgaPath, sourceBytes);
    const result = await beforeReset.session.resetReplacement({
      sourceId: beforeReset.opened.sourceId,
      targetId: "profile_frame",
      kind: "image"
    });
    assert.equal(result.model.replacement.lastAction.status, "blocked");
    assert.equal(result.model.replacement.lastAction.diagnostic.code, "svga_replacement_source_changed");
  } finally {
    await rm(beforeReset.sessionRoot, { recursive: true, force: true });
  }

  const duringApply = await createOpenedSession();
  try {
    const originalApply = duringApply.session.applySvgaImageReplacement.bind(duringApply.session);
    duringApply.session.applySvgaImageReplacement = async (modules, input) => {
      const patchedModules = {
        ...modules,
        async applyShortTermImageReplacementPreview(...args) {
          const result = await modules.applyShortTermImageReplacementPreview(...args);
          await replaceFileWithSameBytesAndNewInode(duringApply.svgaPath, sourceBytes);
          return result;
        }
      };
      return originalApply(patchedModules, input);
    };
    const result = await duringApply.session.applyReplacement({
      sourceId: duringApply.opened.sourceId,
      targetId: "profile_frame",
      kind: "image",
      value: replacementDataUri
    });
    assert.equal(result.model.replacement.lastAction.status, "blocked");
    assert.equal(result.model.replacement.lastAction.diagnostic.code, "svga_replacement_source_changed");
  } finally {
    await rm(duringApply.sessionRoot, { recursive: true, force: true });
  }

  const parentSwap = await createOpenedSession("auto-svga-source-parent-");
  try {
    await replaceParentWithSameBytesAndNewIdentity(path.dirname(parentSwap.svgaPath), path.basename(parentSwap.svgaPath), sourceBytes);
    await assert.rejects(
      stat(`${path.dirname(parentSwap.svgaPath)}.swapped`),
      (error) => error?.code === "ENOENT"
    );
    const result = await parentSwap.session.applyReplacement({
      sourceId: parentSwap.opened.sourceId,
      targetId: "profile_frame",
      kind: "image",
      value: replacementDataUri
    });
    assert.equal(result.model.replacement.lastAction.status, "blocked");
    assert.equal(result.model.replacement.lastAction.diagnostic.code, "svga_replacement_source_changed");
    assert.doesNotMatch(JSON.stringify(result), /auto-svga-source-(?:identity|parent)-|\/Users\//u);
  } finally {
    await rm(parentSwap.sessionRoot, { recursive: true, force: true });
  }
});

test("0.2 desktop session applies and target-resets a replaceable wide SVGA without mutating source bytes", async () => {
  const sessionRoot = await mkdtemp(path.join(os.tmpdir(), "auto-svga-wide-svga-replacement-"));
  const sourceStore = new Map();
  const session = createMultiFormatDesktopPreviewSession({
    repoRoot,
    sessionRoot,
    sourceStore,
    openTimeoutMs: 1000
  });
  const svgaPath = path.join(sessionRoot, "wide-replaceable.svga");
  const sourceBytes = await createReplaceableWideSvgaFixture();
  const sourceSha256 = createHash("sha256").update(sourceBytes).digest("hex");
  const replacementDataUri = `data:image/png;base64,${(await createTestPng([0, 255, 0, 255])).toString("base64")}`;

  try {
    await writeFile(svgaPath, sourceBytes);
    const opened = await session.openLocalFilePath(svgaPath, "fileButton");
    assert.equal(opened.model.status, "playing");
    assert.equal(opened.model.detectedFormat, "svga");
    const ownerSnapshot = JSON.parse(opened.model.ownerRightPanelSnapshotEnvelope.snapshotJson);
    assert.equal(ownerSnapshot.imageTargets.some((target) =>
      target.resourceId === "profile_frame"
    ), true, JSON.stringify(ownerSnapshot.imageTargets));
    assert.equal(ownerSnapshot.imageTargets.some((target) =>
      target.resourceId === "internal_unused_designer_badge"
    ), false, JSON.stringify(ownerSnapshot.imageTargets));

    const applied = await session.applyReplacement({
      sourceId: opened.sourceId,
      targetId: "profile_frame",
      kind: "image",
      value: replacementDataUri
    });
    assert.equal(applied.model.replacement.lastAction.type, "applyReplacement");
    assert.equal(applied.model.replacement.lastAction.status, "accepted", JSON.stringify(applied.model.replacement.lastAction));
    assert.equal(applied.model.replacement.lastAction.publicTargetId, "profile_frame");
    assert.equal(applied.model.replacement.lastAction.runtimeTargetId, "profile_frame");
    assert.deepEqual(JSON.parse(applied.model.replacement.lastAction.bindingToken), [
      opened.model.requestId,
      "svga",
      0,
      "image",
      "profile_frame",
      "profile_frame"
    ]);
    assert.deepEqual(applied.replacementRuntimeValue, {
      kind: "image",
      targetId: "profile_frame",
      value: replacementDataUri
    });
    assert.equal(applied.model.replacement.dirty, true);
    assert.equal(applied.model.replacement.resetEnabled, true);

    const replacedRuntime = await session.prepareRuntimePreview({
      sourceId: opened.sourceId,
      format: "svga",
      requestId: applied.model.requestId,
      replacements: applied.model.replacement
    });
    assert.equal(replacedRuntime.status, "prepared");
    assert.notEqual(
      createHash("sha256").update(Buffer.from(replacedRuntime.svgaBase64, "base64")).digest("hex"),
      sourceSha256
    );
    assert.equal(createHash("sha256").update(await readFile(svgaPath)).digest("hex"), sourceSha256);

    const reset = await session.resetReplacement({
      sourceId: opened.sourceId,
      targetId: "profile_frame",
      kind: "image"
    });
    assert.equal(reset.model.replacement.lastAction.type, "resetReplacement");
    assert.equal(reset.model.replacement.lastAction.status, "accepted");
    assert.equal(reset.model.replacement.dirty, false);
    assert.equal(reset.model.replacement.resetEnabled, false);

    const resetRuntime = await session.prepareRuntimePreview({
      sourceId: opened.sourceId,
      format: "svga",
      requestId: reset.model.requestId,
      replacements: reset.model.replacement
    });
    assert.equal(resetRuntime.status, "prepared");
    assert.equal(
      createHash("sha256").update(Buffer.from(resetRuntime.svgaBase64, "base64")).digest("hex"),
      sourceSha256
    );

    const reopened = await session.openLocalFilePath(svgaPath, "menuOpen");
    assert.equal(reopened.model.status, "playing");
    assert.equal(reopened.model.replacement.dirty, false);
    assert.equal(createHash("sha256").update(await readFile(svgaPath)).digest("hex"), sourceSha256);
    assert.doesNotMatch(JSON.stringify({ opened, applied, reset, reopened }), /auto-svga-wide-svga-replacement-|\/Users\//u);
  } finally {
    await rm(sessionRoot, { recursive: true, force: true });
  }
});

test("0.2 multi-format desktop session headless SVGA playback load returns a value contract", async () => {
  const sessionSource = await readFile(path.join(experimentRoot, "multiformat-desktop-session.cjs"), "utf8");
  const adapterStart = sessionSource.indexOf("function createHeadlessPlaybackAdapter(format)");
  const adapterEnd = sessionSource.indexOf("function droppedBytes(input)", adapterStart);
  assert.notEqual(adapterStart, -1);
  assert.notEqual(adapterEnd, -1);
  const adapterSource = sessionSource.slice(adapterStart, adapterEnd);

  assert.match(adapterSource, /async load\(_source, context\)/);
  assert.match(adapterSource, /value:\s*\{/);
  assert.match(adapterSource, /format,/);
  assert.match(adapterSource, /name:/);
  assert.match(adapterSource, /sizeBytes:/);
  assert.match(adapterSource, /timing:\s*\{\}/);
  assert.match(adapterSource, /resources:\s*\[\]/);
  assert.match(adapterSource, /layers:\s*\[\]/);
});

test("0.2 installed file-open source reaches positive Lottie and sidecar VAP states including oversized VAP", async () => {
  const sessionRoot = await mkdtemp(path.join(os.tmpdir(), "auto-svga-file-open-session-"));
  const sourceStore = new Map();
  const session = createMultiFormatDesktopPreviewSession({
    repoRoot,
    sessionRoot,
    sourceStore,
    openTimeoutMs: 1000
  });
  const lottiePath = path.join(sessionRoot, "file-open-lottie.json");
  const vapPath = path.join(sessionRoot, "file-open-vap.mp4");
  const vapSidecarPath = path.join(sessionRoot, "file-open-vap.json");
  const overLimitVapPath = path.join(sessionRoot, "file-open-vap-over-limit.mp4");
  const overLimitVapSidecarPath = path.join(sessionRoot, "file-open-vap-over-limit.json");

  try {
    await writeFile(lottiePath, JSON.stringify({
      v: "5.7.4",
      w: 120,
      h: 160,
      fr: 30,
      ip: 0,
      op: 30,
      layers: [{
        ind: 1,
        ty: 5,
        nm: "Foreground title",
        t: { d: { k: [{ s: { t: "Task-owned Lottie" } }] } }
      }],
      assets: []
    }));
    await writeFile(vapPath, createSyntheticVapMp4WithoutEmbeddedVapcBytes());
    await writeFile(vapSidecarPath, JSON.stringify(createSyntheticVapcDocument({
      info: {
        ...createSyntheticVapcDocument().info,
        w: 120,
        h: 160,
        videoW: 120,
        videoH: 320,
        aFrame: { x: 0, y: 160, w: 120, h: 160 },
        rgbFrame: { x: 0, y: 0, w: 120, h: 160 }
      }
    })));
    await writeFile(overLimitVapPath, createSyntheticVapMp4WithoutEmbeddedVapcBytes());
    await writeFile(overLimitVapSidecarPath, JSON.stringify(createSyntheticVapcDocument({
      info: {
        ...createSyntheticVapcDocument().info,
        w: 1136,
        h: 1632,
        videoW: 1136,
        videoH: 3264,
        aFrame: { x: 0, y: 1632, w: 1136, h: 1632 },
        rgbFrame: { x: 0, y: 0, w: 1136, h: 1632 }
      }
    })));

    const lottie = await withTerminalTestDeadline(
      session.openLocalFilePath(lottiePath, "fileOpenEvent"),
      "installed-file-open-lottie"
    );
    assert.equal(lottie.model.status, "playing");
    assert.equal(lottie.model.openedFrom, "fileOpenEvent");
    assert.equal(lottie.model.detectedFormat, "lottie");
    assert.equal(lottie.model.rightPanel.lottieTexts.length, 1);
    assert.doesNotMatch(JSON.stringify(lottie), /auto-svga-file-open-session/);
    const lottieRuntime = await session.prepareRuntimePreview({
      sourceId: lottie.sourceId,
      format: "lottie",
      requestId: lottie.model.requestId,
      replacements: lottie.model.replacement
    });
    assert.equal(lottieRuntime.status, "prepared");
    assert.equal((await session.control({ action: "play" })).model.status, "playing");
    assert.equal((await session.control({ action: "pause" })).model.status, "paused");

    const vap = await withTerminalTestDeadline(
      session.openLocalFilePath(vapPath, "fileOpenEvent"),
      "installed-file-open-vap"
    );
    assert.equal(vap.model.status, "playing");
    assert.equal(vap.model.openedFrom, "fileOpenEvent");
    assert.equal(vap.model.detectedFormat, "vap");
    assert.equal(vap.model.rightPanel.facts.some((fact) => fact.id === "format" && fact.value === "VAP"), true);
    assert.equal(vap.model.rightPanel.vapFusionTexts.length, 0);
    assert.doesNotMatch(JSON.stringify(vap), /auto-svga-file-open-session/);
    const vapRuntime = await session.prepareRuntimePreview({
      sourceId: vap.sourceId,
      format: "vap",
      requestId: vap.model.requestId,
      replacements: vap.model.replacement
    });
    assert.equal(vapRuntime.status, "prepared");
    assert.equal((await session.control({ action: "play" })).model.status, "playing");
    assert.equal((await session.control({ action: "pause" })).model.status, "paused");

    const overLimitVap = await withTerminalTestDeadline(
      session.openLocalFilePath(overLimitVapPath, "fileOpenEvent"),
      "installed-file-open-vap-over-limit"
    );
    assert.equal(overLimitVap.model.status, "playing");
    assert.equal(overLimitVap.model.detectedFormat, "vap");
    assert.equal(overLimitVap.model.rightPanel.issues.some((issue) =>
      issue.code === "owner_issue"
      && issue.message === "当前文件存在无法显示的检查问题。"
      && issue.severity === "warning"
      && issue.pathRedacted === true
    ), true);
    assert.equal(overLimitVap.model.rightPanel.facts.some((fact) =>
      fact.id === "dimensions" && fact.value === "1136 x 1632" && fact.status === "warning"
    ), true);
    assert.equal(overLimitVap.model.rightPanel.issues.some((issue) => issue.details?.reason === "open_input_invalid"), false);
    const overLimitRuntime = await session.prepareRuntimePreview({
      sourceId: overLimitVap.sourceId,
      format: "vap",
      requestId: overLimitVap.model.requestId,
      replacements: overLimitVap.model.replacement
    });
    assert.equal(overLimitRuntime.status, "prepared");
    assert.equal((await session.control({ action: "play" })).model.status, "playing");
    assert.equal((await session.control({ action: "pause" })).model.status, "paused");
    assert.doesNotMatch(JSON.stringify(overLimitVap), /auto-svga-file-open-session/);
  } finally {
    await rm(sessionRoot, { recursive: true, force: true });
  }
});

test("0.2 installed file-open source keeps bounded embedded-image Lottie playable and nonreplaceable", async () => {
  const sessionRoot = await mkdtemp(path.join(os.tmpdir(), "auto-svga-file-open-embedded-lottie-"));
  const sourceStore = new Map();
  const session = createMultiFormatDesktopPreviewSession({
    repoRoot,
    sessionRoot,
    sourceStore,
    openTimeoutMs: 1000
  });
  const lottiePath = path.join(sessionRoot, "embedded-image-lottie.json");

  try {
    await writeFile(lottiePath, JSON.stringify({
      v: "5.12.2",
      w: 288,
      h: 288,
      fr: 60,
      ip: 0,
      op: 300,
      assets: [
        { id: "image_0", w: 96, h: 96, e: 1, p: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAAAAAA6fptVAAAACklEQVR42mP8z8AABQMBgF7gywAAAABJRU5ErkJggg==" },
        { id: "image_1", w: 64, h: 64, e: 1, p: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAAAAAA6fptVAAAACklEQVR42mP8z8AABQMBgF7gywAAAABJRU5ErkJggg==" }
      ],
      layers: [
        {
          ind: 1,
          ty: 2,
          nm: "Embedded avatar",
          refId: "image_0",
          ks: {
            s: {
              a: 1,
              k: [
                { t: 0, s: [80, 80, 100], i: { x: [0.667], y: [1] }, o: { x: [0.333], y: [0] } },
                { t: 30, s: [110, 110, 100], h: 0 },
                { t: 60, s: [80, 80, 100] }
              ],
              x: "var $bm_rt;\n$bm_rt = loopOut();"
            }
          }
        },
        { ind: 2, ty: 2, nm: "Embedded badge", refId: "image_1" },
        { ind: 3, ty: 4, nm: "Vector accent", shapes: [] }
      ]
    }));

    const result = await withTerminalTestDeadline(
      session.openLocalFilePath(lottiePath, "fileOpenEvent"),
      "installed-file-open-embedded-lottie"
    );
    assert.equal(result.status, "opened");
    assert.equal(result.pathRedacted, true);
    assert.equal(result.model.openedFrom, "fileOpenEvent");
    assert.equal(result.model.detectedFormat, "lottie");
    assert.equal(result.model.status, "playing");
    assert.equal(result.model.rightPanel.assets.length, 2);
    assert.equal(result.model.rightPanel.assets.every((asset) => asset.replaceable === false), true);
    assert.equal(result.model.rightPanel.assetInventory.summary.imageCount, 2);
    assert.equal(result.model.rightPanel.assetInventory.summary.unsupportedOrMissingCount, 0);
    assert.equal(result.model.rightPanel.issues.some((issue) => issue.code === "unsupported_feature"), false);
    const runtime = await session.prepareRuntimePreview({
      sourceId: result.sourceId,
      format: "lottie",
      requestId: result.model.requestId,
      replacements: result.model.replacement
    });
    assert.equal(runtime.status, "prepared");
    assert.deepEqual(runtime.expressionNormalization, {
      safeLoopOutProperties: 1,
      sourceEvaluationAllowed: false
    });
    const normalizedScale = runtime.animationData.layers[0].ks.s;
    assert.equal(normalizedScale.x, undefined);
    assert.deepEqual(normalizedScale.k.map((keyframe) => keyframe.t), [0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300]);
    const sourceDocument = JSON.parse(await readFile(lottiePath, "utf8"));
    assert.deepEqual(normalizedScale.k.slice(0, 3), sourceDocument.layers[0].ks.s.k);
    assert.equal(runtime.animationData.ip, sourceDocument.ip);
    assert.equal(runtime.animationData.op, sourceDocument.op);
    assert.equal(runtime.animationData.fr, sourceDocument.fr);
    assert.equal(sourceDocument.layers[0].ks.s.x, "var $bm_rt;\n$bm_rt = loopOut();");
    assert.equal((await session.control({ action: "play" })).model.status, "playing");
    assert.equal((await session.control({ action: "pause" })).model.status, "paused");
    assert.equal(result.lifecycle.lottieLoads, 1);
    assert.doesNotMatch(JSON.stringify(result), /auto-svga-file-open-embedded-lottie|\/Users|C:\\\\Users/);
  } finally {
    await rm(sessionRoot, { recursive: true, force: true });
  }
});

test("0.2 strict-CSP Lottie runtime blocks unsafe or malformed expression shapes", async () => {
  const sessionRoot = await mkdtemp(path.join(os.tmpdir(), "auto-svga-lottie-expression-block-"));
  const session = createMultiFormatDesktopPreviewSession({
    repoRoot,
    sessionRoot,
    sourceStore: new Map(),
    openTimeoutMs: 1000
  });
  const cases = [
    {
      id: "parameterized",
      expression: '$bm_rt = loopOut("cycle");',
      keyframes: [{ t: 0, s: [80, 80, 100] }, { t: 24, s: [80, 80, 100] }],
      reason: "unsupported_lottie_expression"
    },
    {
      id: "other-expression",
      expression: "$bm_rt = time * 2;",
      keyframes: [{ t: 0, s: [80, 80, 100] }, { t: 24, s: [80, 80, 100] }],
      reason: "unsupported_lottie_expression"
    },
    {
      id: "malformed-keyframes",
      expression: "$bm_rt = loopOut();",
      keyframes: [{ t: 0, s: [80, 80, 100] }],
      reason: "safe_loop_out_keyframes_required"
    },
    {
      id: "unordered-keyframes",
      expression: "$bm_rt = loopOut();",
      keyframes: [{ t: 24, s: [80, 80, 100] }, { t: 12, s: [90, 90, 100] }],
      reason: "safe_loop_out_keyframes_required"
    },
    {
      id: "string-vector",
      expression: "$bm_rt = loopOut();",
      keyframes: [{ t: 0, s: ["80", 80, 100] }, { t: 24, s: [90, 90, 100] }],
      reason: "safe_loop_out_numeric_vectors_required"
    },
    {
      id: "mismatched-vector",
      expression: "$bm_rt = loopOut();",
      keyframes: [{ t: 0, s: [80, 80, 100] }, { t: 24, s: [90, 90] }],
      reason: "safe_loop_out_numeric_vectors_required"
    },
    {
      id: "ambiguous-timing",
      expression: "$bm_rt = loopOut();",
      keyframes: [{ t: 0, s: [80, 80, 100] }, { t: 144, s: [90, 90, 100] }],
      reason: "safe_loop_out_timing_required"
    },
    {
      id: "reviewed-malformed-metadata",
      expression: "$bm_rt = loopOut();",
      keyframes: [
        {
          t: 0,
          s: [80, 80, 100],
          i: { x: ["not-a-number"], y: [1] },
          e: ["bad", 90, 100],
          h: "yes"
        },
        { t: 24, s: [90, 90, 100] }
      ],
      reason: "safe_loop_out_keyframe_metadata_required"
    },
    {
      id: "end-vector-dimension",
      expression: "$bm_rt = loopOut();",
      keyframes: [{ t: 0, s: [80, 80, 100], e: [90, 90] }, { t: 24, s: [90, 90, 100] }],
      reason: "safe_loop_out_keyframe_metadata_required"
    },
    {
      id: "end-vector-type",
      expression: "$bm_rt = loopOut();",
      keyframes: [{ t: 0, s: [80, 80, 100], e: [90, "90", 100] }, { t: 24, s: [90, 90, 100] }],
      reason: "safe_loop_out_keyframe_metadata_required"
    },
    {
      id: "unpaired-easing",
      expression: "$bm_rt = loopOut();",
      keyframes: [{ t: 0, s: [80, 80, 100], i: { x: [0.667], y: [1] } }, { t: 24, s: [90, 90, 100] }],
      reason: "safe_loop_out_keyframe_metadata_required"
    },
    {
      id: "easing-vector-type",
      expression: "$bm_rt = loopOut();",
      keyframes: [
        {
          t: 0,
          s: [80, 80, 100],
          i: { x: ["not-a-number"], y: [1] },
          o: { x: [0.333], y: [0] }
        },
        { t: 24, s: [90, 90, 100] }
      ],
      reason: "safe_loop_out_keyframe_metadata_required"
    },
    {
      id: "easing-vector-dimension",
      expression: "$bm_rt = loopOut();",
      keyframes: [
        {
          t: 0,
          s: [80, 80, 100],
          i: { x: [0.667, 0.667], y: [1, 1] },
          o: { x: [0.333, 0.333], y: [0, 0] }
        },
        { t: 24, s: [90, 90, 100] }
      ],
      reason: "safe_loop_out_keyframe_metadata_required"
    },
    {
      id: "spatial-tangent-type",
      expression: "$bm_rt = loopOut();",
      keyframes: [
        { t: 0, s: [80, 80, 100], to: [0, "bad", 0], ti: [0, 0, 0] },
        { t: 24, s: [90, 90, 100] }
      ],
      reason: "safe_loop_out_keyframe_metadata_required"
    },
    {
      id: "spatial-tangent-dimension",
      expression: "$bm_rt = loopOut();",
      keyframes: [
        { t: 0, s: [80, 80, 100], to: [0, 0], ti: [0, 0, 0] },
        { t: 24, s: [90, 90, 100] }
      ],
      reason: "safe_loop_out_keyframe_metadata_required"
    },
    {
      id: "hold-flag-type",
      expression: "$bm_rt = loopOut();",
      keyframes: [{ t: 0, s: [80, 80, 100], h: "yes" }, { t: 24, s: [90, 90, 100] }],
      reason: "safe_loop_out_keyframe_metadata_required"
    },
    {
      id: "unknown-keyframe-field",
      expression: "$bm_rt = loopOut();",
      keyframes: [{ t: 0, s: [80, 80, 100], ambiguous: true }, { t: 24, s: [90, 90, 100] }],
      reason: "safe_loop_out_keyframe_metadata_required"
    }
  ];

  try {
    for (const input of cases) {
      const filePath = path.join(sessionRoot, `${input.id}.json`);
      const sourceDocument = {
        v: "5.12.2",
        w: 120,
        h: 120,
        fr: 24,
        ip: 0,
        op: 120,
        assets: [],
        layers: [{
          ind: 1,
          ty: 2,
          nm: "Expression fixture",
          ks: { s: { a: 1, k: input.keyframes, x: input.expression } }
        }]
      };
      await writeFile(filePath, JSON.stringify(sourceDocument));
      const opened = await session.openLocalFilePath(filePath, "fileOpenEvent");
      assert.equal(opened.status, "opened");
      const runtime = await session.prepareRuntimePreview({
        sourceId: opened.sourceId,
        format: "lottie",
        requestId: opened.model.requestId,
        replacements: opened.model.replacement
      });
      assert.equal(runtime.status, "failed");
      assert.equal(runtime.issue.code, "unsupported_feature");
      assert.equal(runtime.issue.details.reason, input.reason);
      assert.equal(runtime.pathRedacted, true);
      assert.equal(runtime.animationData, undefined);
      assert.equal(runtime.runtimeScripts, undefined);
      assert.deepEqual(JSON.parse(await readFile(filePath, "utf8")), sourceDocument);
      assert.doesNotMatch(JSON.stringify(runtime), /auto-svga-lottie-expression-block|\/Users|C:\\Users/i);
    }
  } finally {
    await rm(sessionRoot, { recursive: true, force: true });
  }
});

test("0.2 strict-CSP Lottie runtime accepts only deliberate no-argument loopOut whitespace forms", async () => {
  const sessionRoot = await mkdtemp(path.join(os.tmpdir(), "auto-svga-lottie-safe-loop-out-"));
  const session = createMultiFormatDesktopPreviewSession({
    repoRoot,
    sessionRoot,
    sourceStore: new Map(),
    openTimeoutMs: 1000
  });
  const safeExpressions = [
    "$bm_rt = loopOut()",
    "  var   $bm_rt ;\n  $bm_rt = loopOut ( ) ;  "
  ];

  try {
    for (const [index, expression] of safeExpressions.entries()) {
      const filePath = path.join(sessionRoot, `safe-${index}.json`);
      await writeFile(filePath, JSON.stringify({
        v: "5.12.2",
        w: 120,
        h: 120,
        fr: 24,
        ip: 0,
        op: 120,
        assets: [],
        layers: [{
          ind: 1,
          ty: 4,
          nm: "Safe loop fixture",
          ks: {
            s: {
              a: 1,
              k: [{ t: 0, s: [80, 80, 100] }, { t: 24, s: [110, 110, 100] }, { t: 48, s: [80, 80, 100] }],
              x: expression
            }
          },
          shapes: []
        }]
      }));
      const opened = await session.openLocalFilePath(filePath, "fileOpenEvent");
      const runtime = await session.prepareRuntimePreview({
        sourceId: opened.sourceId,
        format: "lottie",
        requestId: opened.model.requestId,
        replacements: opened.model.replacement
      });
      assert.equal(runtime.status, "prepared");
      assert.equal(runtime.expressionNormalization.safeLoopOutProperties, 1);
      assert.equal(runtime.expressionNormalization.sourceEvaluationAllowed, false);
      assert.equal(runtime.animationData.layers[0].ks.s.x, undefined);
      assert.deepEqual(runtime.animationData.layers[0].ks.s.k.map((keyframe) => keyframe.t), [0, 24, 48, 72, 96, 120]);
    }
  } finally {
    await rm(sessionRoot, { recursive: true, force: true });
  }
});

test("0.2 renderer open contract turns missing model rejected and stalled bridge results into terminal failures", async () => {
  const {
    normalizeMultiFormatOpenOutcome,
    resolveMultiFormatOpenOutcome
  } = await import(pathToFileURL(path.join(experimentRoot, "web/multiformat-desktop-preview-controller.mjs")).href);

  assert.equal(normalizeMultiFormatOpenOutcome({ status: "cancelled" }).kind, "cancelled");
  assert.equal(normalizeMultiFormatOpenOutcome({ status: "opened", model: { status: "previewReady" } }).kind, "model");

  const missingModel = normalizeMultiFormatOpenOutcome({ status: "opened" });
  assert.equal(missingModel.kind, "failure");
  assert.equal(missingModel.message, "无法打开本地文件，源文件没有被修改。");
  assert.doesNotMatch(missingModel.message, /\/Users|C:\\|alice/i);

  const rejected = await resolveMultiFormatOpenOutcome(
    Promise.reject(new Error("/Users/alice/Desktop/secret.json")),
    { deadlineMs: 10 }
  );
  assert.equal(rejected.kind, "failure");
  assert.match(rejected.message, /无法打开本地文件/);
  assert.doesNotMatch(rejected.message, /\/Users|alice|secret/i);

  const stalled = await resolveMultiFormatOpenOutcome(new Promise(() => {}), { deadlineMs: 10 });
  assert.equal(stalled.kind, "failure");
  assert.equal(stalled.message, "文件加载超时，请重新打开文件。源文件没有被修改。");
  assert.doesNotMatch(stalled.message, /\/Users|C:\\|alice/i);

  const missingRecent = normalizeMultiFormatOpenOutcome({
    status: "missing",
    message: "中文路径 /Users/alice/Secret/recent.svga",
    path: "/Users/alice/Secret/recent.svga"
  });
  assert.deepEqual(missingRecent, {
    kind: "failure",
    code: "recent_file_missing",
    message: "这个最近文件已缺失或不可访问。"
  });

  const unknownFailure = normalizeMultiFormatOpenOutcome({
    kind: "failure",
    code: "unknown_host_code",
    message: "中文主机错误 /Users/alice/Secret/input.json",
    feature: "expression",
    path: "layers.0.xp"
  });
  assert.deepEqual(unknownFailure, {
    kind: "failure",
    message: "操作未能完成，源文件没有被修改。"
  });
});

test("0.2 owner failure rendering trusts only reviewed codes and never raw host text", async () => {
  const { createMultiFormatDesktopPreviewController } = await import(pathToFileURL(path.join(experimentRoot, "web/multiformat-desktop-preview-controller.mjs")).href);
  const originalDocument = globalThis.document;
  const nodes = createMultiFormatControllerTestNodes();
  globalThis.document = createMultiFormatControllerTestDocument(nodes);
  const genericCopy = "操作未能完成，源文件没有被修改。";
  let codeGetterRead = false;
  const accessorFailure = {};
  Object.defineProperty(accessorFailure, "code", {
    get() {
      codeGetterRead = true;
      return "file_picker_failed";
    }
  });
  const coercibleFailure = {
    toString() {
      return "中文主机错误 /Users/alice/Secret layers.0.xp";
    }
  };
  const cases = [
    {
      input: {
        code: "file_picker_failed",
        message: "中文路径 /Users/alice/Secret/input.json and layers.0.xp",
        feature: "expression",
        path: "layers.0.xp"
      },
      expected: "无法打开文件选择器，源文件没有被修改。"
    },
    {
      input: {
        code: "unsupported_file_type",
        message: "混合 technical host detail /Users/alice/Secret/input.txt"
      },
      expected: "仅支持 SVGA、Lottie JSON 或 VAP MP4 文件。"
    },
    {
      input: {
        code: "missing_resource",
        message: "resource missing at /Users/alice/Secret/assets/avatar.png"
      },
      expected: "预览所需资源缺失，源文件没有被修改。"
    },
    {
      input: {
        code: "parse_precondition",
        message: "Complete bounded JSON is required at /Users/alice/Secret/input.json",
        path: "layers.0.xp"
      },
      expected: "文件内容不完整或格式异常，无法预览。"
    },
    {
      input: {
        code: "unknown_host_code",
        message: "中文路径 /Users/alice/Secret/input.json",
        feature: "expression",
        path: "layers.0.xp"
      },
      expected: genericCopy
    },
    {
      input: new Error("中文主机错误 /Users/alice/Secret/input.json; Complete bounded JSON is required"),
      expected: genericCopy
    },
    {
      input: ["file_picker_failed", "中文路径 /Users/alice/Secret/input.json"],
      expected: genericCopy
    },
    {
      input: { message: "中文主机错误 /Users/alice/Secret/input.json", path: "layers.0.xp" },
      expected: genericCopy
    },
    { input: accessorFailure, expected: genericCopy },
    { input: coercibleFailure, expected: genericCopy }
  ];

  try {
    const controller = createMultiFormatDesktopPreviewController({
      bridge: {
        updateShortTermMenuState() {
          return Promise.resolve();
        },
        setShortTermWindowMode() {
          return Promise.resolve();
        },
        controlMultiFormatPreview() {
          return Promise.resolve({ status: "disposed" });
        }
      },
      nodes,
      state: {
        view: "launch",
        mode: "preview",
        tab: "overview",
        appearance: "light",
        primaryPlaybackLooping: true,
        textPreviewValues: {}
      },
      svgaController: { handlers: {} }
    });

    for (const { input, expected } of cases) {
      controller.handlers.showFailure(input);
      assert.equal(nodes.errorMessage.textContent, expected);
      assert.doesNotMatch(nodes.errorMessage.textContent, /\/Users|alice|layers\.0\.xp|Complete bounded JSON|technical host detail/i);
    }
    assert.equal(codeGetterRead, false, "owner copy must not execute an untrusted code getter");

    assert.equal(controller.handlers.beginHostFileOpen({ eventId: "raw-host-failure" }), true);
    assert.equal(controller.handlers.failHostFileOpen({
      eventId: "raw-host-failure",
      message: "中文路径 /Users/alice/Secret/input.json and layers.0.xp",
      feature: "expression",
      path: "layers.0.xp"
    }), true);
    assert.equal(nodes.errorMessage.textContent, genericCopy);

    assert.equal(controller.handlers.beginHostFileOpen({ eventId: "known-host-failure" }), true);
    assert.equal(controller.handlers.failHostFileOpen({
      eventId: "known-host-failure",
      code: "file_picker_failed",
      message: "mixed 中文 technical /Users/alice/Secret/input.json",
      feature: "expression",
      path: "layers.0.xp"
    }), true);
    assert.equal(nodes.errorMessage.textContent, "无法打开文件选择器，源文件没有被修改。");
    assert.doesNotMatch(nodes.errorMessage.textContent, /\/Users|alice|layers\.0\.xp|expression|technical/i);
  } finally {
    globalThis.document = originalDocument;
  }
});

test("0.2 composed open cancellation preserves active authority while accepted failure revokes every format", async () => {
  const { createMultiFormatDesktopPreviewController } = await import(pathToFileURL(path.join(experimentRoot, "web/multiformat-desktop-preview-controller.mjs")).href);
  const originalDocument = globalThis.document;

  try {
    for (const format of ["lottie", "vap", "svga"]) {
      const nodes = createMultiFormatControllerTestNodes();
      globalThis.document = createMultiFormatControllerTestDocument(nodes);
      const menuStates = [];
      const disposeCalls = [];
      const legacyCalls = [];
      let chooserResult = { status: "cancelled" };
      const state = {
        view: "launch",
        mode: "preview",
        tab: "overview",
        appearance: "light",
        primaryPlaybackLooping: true,
        textPreviewValues: {}
      };
      const bridge = {
        openMultiFormatFile() {
          return Promise.resolve(chooserResult);
        },
        updateShortTermMenuState(snapshot) {
          menuStates.push(structuredClone(snapshot));
          return Promise.resolve();
        },
        setShortTermWindowMode() {
          return Promise.resolve();
        },
        controlMultiFormatPreview(input) {
          disposeCalls.push(input);
          return Promise.resolve({ status: "disposed" });
        }
      };
      const svgaController = {
        handlers: {
          confirmDiscardUnsavedOutput() {
            return true;
          },
          loadOpenedSource(input) {
            legacyCalls.push(["load", input.sourceId]);
            state.sourceBytes = new Uint8Array(input.bytes);
            state.previewBytes = new Uint8Array(input.bytes);
            state.sourceId = input.sourceId;
            state.displayName = input.displayName;
            state.model = { status: "previewReady", detectedFormat: "svga" };
            state.selectedImageKey = "avatar";
            state.selectedTextKey = "title";
            state.textPreviewValues = { title: "旧文字" };
          },
          refreshRecentFiles() {},
          deactivateForMultiFormat() {
            legacyCalls.push(["deactivate"]);
          },
          saveActiveOutput() {
            legacyCalls.push(["save"]);
            return "stale-save";
          },
          renderCommandState() {}
        }
      };
      const controller = createMultiFormatDesktopPreviewController({ bridge, nodes, state, svgaController });

      if (format === "svga") {
        assert.equal(controller.handlers.beginHostFileOpen({ eventId: `${format}-initial` }), true);
        assert.equal(await controller.handlers.completeHostFileOpen({
          eventId: `${format}-initial`,
          result: {
            sourceId: `source:${format}`,
            model: { detectedFormat: "svga", displayName: `${format}.fixture`, status: "previewReady" },
            svgaSource: { displayName: `${format}.fixture`, bytes: Uint8Array.from([1, 2, 3]) }
          }
        }), true);
      } else {
        assert.equal(controller.handlers.beginHostFileOpen({ eventId: `${format}-initial` }), true);
        assert.equal(await controller.handlers.completeHostFileOpen({
          eventId: `${format}-initial`,
          result: createRuntimeMountOpenResult(format, { sourceId: `source:${format}` })
        }), true);
      }

      const activeModel = state.model;
      const activeSourceId = state.sourceId;
      const activeImageKey = state.selectedImageKey;
      const activeTextKey = state.selectedTextKey;
      nodes.playbackProgress.setAttribute("aria-valuenow", "64");
      nodes.playbackProgress.style["--asv-playback-progress"] = "64%";
      nodes.playbackProgress.children[0].style.width = "64%";
      nodes.playbackTime.textContent = "0:32 / 0:50";
      nodes.playbackMeta.textContent = "VAP · 120 x 80 · 0:50 · 播放中";
      nodes.playbackMeta.dataset.status = "playing";
      nodes.playbackMeta.dataset.format = "vap";
      await controller.handlers.openFromHostDialog();
      assert.equal(state.model, activeModel, `${format} cancel must preserve model`);
      assert.equal(state.sourceId, activeSourceId, `${format} cancel must preserve source`);
      assert.equal(state.selectedImageKey, activeImageKey, `${format} cancel must preserve image selection`);
      assert.equal(state.selectedTextKey, activeTextKey, `${format} cancel must preserve text selection`);

      chooserResult = {
        status: "failed",
        code: "file_picker_failed",
        pathRedacted: true,
        message: "中文路径 /Users/alice/Secret/input.json and layers.0.xp",
        feature: "expression",
        path: "layers.0.xp"
      };
      await controller.handlers.openFromHostDialog();
      assert.equal(state.view, "failed", `${format} failure must enter failed view`);
      assert.equal(nodes.errorMessage.textContent, "无法打开文件选择器，源文件没有被修改。");
      assert.doesNotMatch(nodes.errorMessage.textContent, /\/Users|alice|layers\.0\.xp|expression/i);
      assert.equal(nodes.playbackProgress.attributes["aria-valuenow"], "0", `${format} failure must reset progress a11y`);
      assert.equal(nodes.playbackProgress.style["--asv-playback-progress"], "0%", `${format} failure must reset progress token`);
      assert.equal(nodes.playbackProgress.children[0].style.width, "0%", `${format} failure must reset progress bar`);
      assert.equal(nodes.playbackTime.textContent, "0:00 / 0:00", `${format} failure must reset playback time`);
      assert.equal(nodes.playbackMeta.textContent, "", `${format} failure must clear playback meta copy`);
      assert.equal(nodes.playbackMeta.dataset.status, undefined, `${format} failure must clear playback meta status`);
      assert.equal(nodes.playbackMeta.dataset.format, undefined, `${format} failure must clear playback meta format`);
      assert.equal(state.model, undefined, `${format} failure must clear model`);
      assert.equal(state.sourceBytes, undefined, `${format} failure must clear source bytes`);
      assert.equal(state.previewBytes, undefined, `${format} failure must clear preview bytes`);
      assert.equal(state.sourceId, "", `${format} failure must clear source id`);
      assert.equal(state.displayName, "", `${format} failure must clear display name`);
      assert.equal(state.selectedImageKey, "", `${format} failure must clear image selection`);
      assert.equal(state.selectedTextKey, "", `${format} failure must clear text selection`);
      assert.deepEqual(state.textPreviewValues, {}, `${format} failure must clear text replacements`);
      assert.deepEqual(disposeCalls.at(-1), { action: "dispose" }, `${format} failure must dispose host preview`);

      const terminalMenu = menuStates.at(-1);
      assert.equal(terminalMenu.hasFile, false, `${format} failure must disable file commands`);
      for (const key of ["canPlay", "canReplay", "canLoop", "canReplaceImage", "canResetImageReplacement", "canEditText", "canResetText"]) {
        assert.equal(terminalMenu[key], false, `${format} failure must disable ${key}`);
      }
      assert.equal(controller.handlers.saveActiveOutput(), undefined, `${format} failure must disable SVGA delegation`);
      assert.equal(legacyCalls.filter(([name]) => name === "save").length, 0, `${format} failure must not reach stale save`);
      if (format === "svga") {
        assert.equal(legacyCalls.filter(([name]) => name === "deactivate").length, 1);
      }
    }
  } finally {
    globalThis.document = originalDocument;
  }
});

test("0.2 right surface keeps normal assets quiet and highlights actionable inventory states", async () => {
  const { createMultiFormatDesktopPreviewController } = await import(pathToFileURL(path.join(experimentRoot, "web/multiformat-desktop-preview-controller.mjs")).href);
  const originalDocument = globalThis.document;
  const nodes = createMultiFormatControllerTestNodes();
  globalThis.document = createMultiFormatControllerTestDocument(nodes);

  try {
    const state = {
      view: "launch",
      mode: "preview",
      tab: "overview",
      appearance: "light",
      primaryPlaybackLooping: true,
      textPreviewValues: {}
    };
    const controller = createMultiFormatDesktopPreviewController({
      bridge: {
        updateShortTermMenuState() {
          return Promise.resolve();
        },
        setShortTermWindowMode() {
          return Promise.resolve();
        }
      },
      nodes,
      state,
      svgaController: { handlers: { deactivateForMultiFormat() {}, renderCommandState() {} } }
    });
    const ownerRightPanelSnapshotEnvelope = createTestOwnerRightPanelSnapshotEnvelope({
      facts: [{ id: "format", label: "格式", value: "LOTTIE", status: "pass" }],
      assetInventory: {
        schemaVersion: 1,
        pathRedacted: true,
        format: "lottie",
        groups: [
          {
            id: "image_resources",
            label: "图片资源",
            count: 3,
            replaceableCount: 1,
            status: "blocked",
            items: [
              {
                id: "image-ok",
                label: "背景图片",
                groupId: "image_resources",
                kind: "image",
                source: "asset",
                status: "available",
                replaceable: false,
                detail: ["120 x 80"],
                pathRedacted: true
              },
              {
                id: "avatar",
                label: "头像占位",
                groupId: "image_resources",
                kind: "image",
                source: "asset",
                status: "available",
                replaceable: true,
                runtimeTargetId: "avatar",
                detail: ["120 x 80"],
                pathRedacted: true
              },
              {
                id: "missing-image",
                label: "缺失图片",
                groupId: "image_resources",
                kind: "image",
                source: "issue",
                status: "missing",
                replaceable: false,
                detail: ["需要补齐"],
                issueCode: "missing_resource",
                severity: "error",
                pathRedacted: true
              }
            ]
          },
          {
            id: "runtime_capabilities",
            label: "运行能力",
            count: 2,
            replaceableCount: 0,
            status: "warning",
            items: [
              {
                id: "expression",
                label: "表达式能力",
                groupId: "runtime_capabilities",
                kind: "unknown",
                source: "capability",
                status: "unsupported",
                replaceable: false,
                detail: ["需要复核"],
                issueCode: "unsupported_feature",
                severity: "warning",
                pathRedacted: true
              },
              {
                id: "export-blocked",
                label: "导出阻断",
                groupId: "runtime_capabilities",
                kind: "unknown",
                source: "issue",
                status: "blocked",
                replaceable: false,
                detail: ["需要处理"],
                issueCode: "unsupported_feature",
                severity: "error",
                pathRedacted: true
              }
            ]
          },
          {
            id: "format_diagnostics",
            label: "格式诊断",
            count: 0,
            replaceableCount: 0,
            status: "warning",
            items: []
          }
        ],
        summary: {
          totalItems: 5,
          replaceableItems: 1,
          imageCount: 3,
          textCount: 0,
          sequenceFrameCount: 0,
          audioVideoCount: 0,
          unsupportedOrMissingCount: 3
        },
        capabilityMarkers: []
      },
      issues: [{
        code: "unsupported_feature",
        severity: "warning",
        message: "存在不支持能力",
        pathRedacted: true
      }],
      unsupportedFeatures: [{
        code: "unsupported_feature",
        severity: "warning",
        feature: "表达式",
        path: "",
        message: "不应直接显示的自由文案",
        pathRedacted: true
      }]
    }, "source:daily-ui");
    const result = createRuntimeMountOpenResult("lottie", { sourceId: "source:daily-ui" });
    result.ownerRightPanelSnapshotEnvelope = ownerRightPanelSnapshotEnvelope;
    result.model.ownerRightPanelSnapshotEnvelope = ownerRightPanelSnapshotEnvelope;

    assert.equal(controller.handlers.beginHostFileOpen({ eventId: "daily-ui" }), true);
    assert.equal(await controller.handlers.completeHostFileOpen({ eventId: "daily-ui", result }), true);

    const [imageGroup, capabilityGroup, diagnosticGroup] = nodes.assetList.children;
    assert.equal(nodes.assetList.children.length, 3);
    assert.equal(nodes.assetFilterTabs.dataset.presentation, "summary");
    const summaryText = (child) => child.children.map((part) => part.textContent).join("");
    assert.deepEqual(
      nodes.assetFilterTabs.children.map(summaryText),
      ["全部 (5)", "图片 (3)", "问题 (3)"]
    );
    assert.deepEqual(
      nodes.assetFilterTabs.children.map((child) => child.dataset.summaryId),
      ["all", "images", "issues"]
    );
    for (const child of nodes.assetFilterTabs.children) {
      assert.deepEqual(
        child.children.map((part) => part.className),
        ["assetSummaryLabel", "assetSummaryCount"]
      );
    }
    assert.equal(imageGroup.dataset.empty, "false");
    assert.equal(capabilityGroup.dataset.empty, "false");
    assert.equal(diagnosticGroup.dataset.status, "warning");
    assert.equal(diagnosticGroup.dataset.empty, "true");
    for (const group of [imageGroup, capabilityGroup, diagnosticGroup]) {
      assert.deepEqual(
        group.children[0].children.map((child) => child.className),
        ["assetGroupTitle", "assetGroupCount"]
      );
      assert.doesNotMatch(group.children[0].innerHTML, /存在缺失或阻断|存在不支持项|可替换/u);
    }
    assert.equal(imageGroup.children[0].children[0].textContent, "图片资源");
    assert.equal(imageGroup.children[0].children[1].textContent, "(3)");
    assert.equal(diagnosticGroup.children[0].children[0].textContent, "格式诊断");
    assert.equal(diagnosticGroup.children[0].children[1].textContent, "(0)");
    assert.equal(diagnosticGroup.children[1].children.length, 0);

    const [availableRow, replaceableRow, missingRow] = imageGroup.children[1].children;
    const [unsupportedRow, blockedRow] = capabilityGroup.children[1].children;
    assert.equal(availableRow.dataset.status, "available");
    assert.equal(availableRow.dataset.attention, "false");
    assert.doesNotMatch(availableRow.innerHTML, />可用</u);
    assert.match(availableRow.innerHTML, /120×80/u);
    assert.doesNotMatch(availableRow.innerHTML, /120 x 80/u);
    assert.match(replaceableRow.innerHTML, /class="badge safe"[^>]*>可替换</u);
    assert.match(replaceableRow.attributes["aria-label"], /120×80/u);
    assert.doesNotMatch(replaceableRow.attributes["aria-label"], /120 x 80/u);
    assert.equal(missingRow.dataset.attention, "true");
    assert.match(missingRow.innerHTML, /class="badge fail"[^>]*>缺失</u);
    assert.equal(unsupportedRow.dataset.attention, "true");
    assert.match(unsupportedRow.innerHTML, /class="badge unsupported"[^>]*>不支持</u);
    assert.equal(blockedRow.dataset.attention, "true");
    assert.match(blockedRow.innerHTML, /class="badge fail"[^>]*>阻断</u);

    const [issueRow, unsupportedFeatureRow] = nodes.findingList.children;
    assert.equal(nodes.findingList.attributes.role, "list");
    assert.equal(nodes.findingList.attributes["aria-label"], "格式检查");
    assert.equal(issueRow.attributes.role, "listitem");
    assert.equal(issueRow.dataset.component, "FindingRow");
    assert.equal(issueRow.dataset.disposition, "reviewOnly");
    assert.match(issueRow.innerHTML, /<div><strong>当前文件包含暂不支持的内容。<\/strong><\/div>/u);
    assert.match(unsupportedFeatureRow.innerHTML, /<div><strong>暂不支持：表达式<\/strong><\/div>/u);
    assert.doesNotMatch(nodes.findingList.textContent, /存在不支持能力|不应直接显示/u);
  } finally {
    globalThis.document = originalDocument;
  }
});

test("0.2 replaceable summary includes text-only Lottie and VAP targets", async () => {
  const { createMultiFormatDesktopPreviewController } = await import(pathToFileURL(path.join(experimentRoot, "web/multiformat-desktop-preview-controller.mjs")).href);
  const originalDocument = globalThis.document;

  try {
    for (const fixture of [
      {
        format: "lottie",
        eventId: "lottie-text-only",
        textKey: "text:1",
        displayName: "Greeting",
        initialText: "Original greeting"
      },
      {
        format: "vap",
        eventId: "vap-text-only",
        textKey: "title",
        displayName: "title",
        initialText: "VAP 融合文字"
      }
    ]) {
      const nodes = createMultiFormatControllerTestNodes();
      globalThis.document = createMultiFormatControllerTestDocument(nodes);
      const state = {
        view: "launch",
        mode: "preview",
        tab: "overview",
        appearance: "light",
        primaryPlaybackLooping: true,
        textPreviewValues: {}
      };
      const controller = createMultiFormatDesktopPreviewController({
        bridge: {
          updateShortTermMenuState() {
            return Promise.resolve();
          },
          setShortTermWindowMode() {
            return Promise.resolve();
          }
        },
        nodes,
        state,
        svgaController: { handlers: { deactivateForMultiFormat() {}, renderCommandState() {} } }
      });
      const textTargets = [{
        textKey: fixture.textKey,
        displayName: fixture.displayName,
        initialText: fixture.initialText,
        placeholder: "输入文字以预览",
        resetDisabled: false
      }];
      const result = createRuntimeMountOpenResult(fixture.format, {
        sourceId: `${fixture.eventId}-source`,
        imageTargets: [],
        textTargets
      });

      assert.equal(controller.handlers.beginHostFileOpen({ eventId: fixture.eventId }), true);
      assert.equal(await controller.handlers.completeHostFileOpen({ eventId: fixture.eventId, result }), true);

      assert.equal(nodes.replaceableSummary.textContent, "(1)");
      assert.doesNotMatch(nodes.replaceableSummary.textContent, /没有可替换图片|未发现可替换元素/u);
      assert.equal(nodes.replaceableList.children.length, 0);
      assert.equal(nodes.replaceableList.dataset.empty, "true");
      assert.equal(nodes.replaceableList.closest(".replaceableSection").dataset.empty, "false");
      assert.equal(nodes.textElementList.dataset.empty, "false");
      const input = nodes.textElementList.querySelector(`[data-text-input][data-text-key="${fixture.textKey}"]`);
      assert.ok(input);
      assert.equal(input.value, fixture.initialText);
      assert.equal(input.closest(".textElementRow[data-text-key]").dataset.replacementState, "source");
    }
  } finally {
    globalThis.document = originalDocument;
  }
});

test("0.2 replaceable empty state uses frozen Figma copy and section state", async () => {
  const { createMultiFormatDesktopPreviewController } = await import(pathToFileURL(path.join(experimentRoot, "web/multiformat-desktop-preview-controller.mjs")).href);
  const originalDocument = globalThis.document;

  try {
    const nodes = createMultiFormatControllerTestNodes();
    globalThis.document = createMultiFormatControllerTestDocument(nodes);
    const state = {
      view: "launch",
      mode: "preview",
      tab: "overview",
      appearance: "light",
      primaryPlaybackLooping: true,
      textPreviewValues: {}
    };
    const controller = createMultiFormatDesktopPreviewController({
      bridge: {
        updateShortTermMenuState() {
          return Promise.resolve();
        },
        setShortTermWindowMode() {
          return Promise.resolve();
        }
      },
      nodes,
      state,
      svgaController: { handlers: { deactivateForMultiFormat() {}, renderCommandState() {} } }
    });
    const result = createRuntimeMountOpenResult("lottie", {
      sourceId: "lottie-no-replaceable-source",
      imageTargets: [],
      textTargets: []
    });

    assert.equal(controller.handlers.beginHostFileOpen({ eventId: "lottie-no-replaceable" }), true);
    assert.equal(await controller.handlers.completeHostFileOpen({ eventId: "lottie-no-replaceable", result }), true);

    assert.equal(nodes.replaceableSummary.textContent, "(0)");
    assert.equal(nodes.replaceableList.children.length, 1);
    assert.equal(nodes.replaceableList.children[0].className, "emptyText");
    assert.equal(nodes.replaceableList.children[0].dataset.component, "InlineStatus");
    assert.equal(nodes.replaceableList.children[0].dataset.variant, "explanatory");
    assert.deepEqual(
      nodes.replaceableList.children[0].children.map((child) => child.textContent),
      [
        "未发现可替换元素",
        "仅包含自动命名资源（如 img_000），",
        "不满足可替换元素命名规则"
      ]
    );
    assert.equal(nodes.replaceableList.dataset.empty, "false");
    assert.equal(nodes.textElementList.children.length, 0);
    assert.equal(nodes.replaceableList.closest(".replaceableSection").dataset.empty, "true");
    assert.equal(nodes.textElementList.dataset.empty, "true");
  } finally {
    globalThis.document = originalDocument;
  }
});

test("0.1 replaceable empty state keeps imageKey module and Figma explanatory copy", async () => {
  const {
    renderShortTermReplaceableImages,
    renderShortTermRuntimeTextElements
  } = await import(pathToFileURL(path.join(experimentRoot, "web/short-term-macos-replaceable-surface.mjs")).href);
  const originalDocument = globalThis.document;

  try {
    const nodes = createMultiFormatControllerTestNodes();
    globalThis.document = createMultiFormatControllerTestDocument(nodes);
    const state = {
      selectedImageKey: "",
      selectedTextKey: "",
      renameImageKey: "",
      textPreviewValues: {}
    };
    const model = {
      images: [],
      texts: []
    };

    renderShortTermReplaceableImages({ nodes, state, model });
    renderShortTermRuntimeTextElements({ nodes, state, model });

    assert.equal(nodes.replaceableSummary.textContent, "(0)");
    assert.equal(nodes.replaceableList.dataset.empty, "false");
    assert.equal(nodes.textElementList.dataset.empty, "true");
    assert.equal(nodes.replaceableList.closest(".replaceableSection").dataset.empty, "true");
    assert.equal(nodes.replaceableList.children.length, 1);
    const empty = nodes.replaceableList.children[0];
    assert.equal(empty.className, "emptyText");
    assert.equal(empty.dataset.component, "InlineStatus");
    assert.equal(empty.dataset.variant, "explanatory");
    assert.deepEqual(
      empty.children.map((child) => child.textContent),
      [
        "未发现可替换元素",
        "仅包含自动命名资源（如 img_000），",
        "不满足可替换元素命名规则"
      ]
    );
  } finally {
    globalThis.document = originalDocument;
  }
});

test("0.2 inventory summary follows Figma asset type rhythm", async () => {
  const { multiFormatInventorySummaryItems } = await import(pathToFileURL(path.join(experimentRoot, "web/multiformat-product-conformance.mjs")).href);
  assert.deepEqual(
    multiFormatInventorySummaryItems({
      totalItems: 12,
      imageCount: 7,
      textCount: 2,
      sequenceFrameCount: 1,
      audioVideoCount: 1,
      unsupportedOrMissingCount: 1
    }),
    [
      { id: "all", label: "全部", count: 12 },
      { id: "images", label: "图片", count: 7 },
      { id: "texts", label: "文本", count: 2 },
      { id: "sequences", label: "序列帧", count: 1 },
      { id: "media", label: "音视频", count: 1 },
      { id: "issues", label: "问题", count: 1 }
    ]
  );
  assert.deepEqual(
    multiFormatInventorySummaryItems({
      totalItems: 4,
      imageCount: 4,
      textCount: 0,
      sequenceFrameCount: 0,
      audioVideoCount: 0,
      unsupportedOrMissingCount: 0
    }),
    [
      { id: "all", label: "全部", count: 4 },
      { id: "images", label: "图片", count: 4 }
    ]
  );
});

test("0.2 playback meta uses closed renderer-owned status and format semantics", async () => {
  const { createMultiFormatDesktopPreviewController } = await import(pathToFileURL(path.join(experimentRoot, "web/multiformat-desktop-preview-controller.mjs")).href);
  const originalDocument = globalThis.document;
  const nodes = createMultiFormatControllerTestNodes();
  globalThis.document = createMultiFormatControllerTestDocument(nodes);

  try {
    const state = {
      view: "launch",
      mode: "preview",
      tab: "overview",
      appearance: "light",
      primaryPlaybackLooping: true,
      textPreviewValues: {}
    };
    const controller = createMultiFormatDesktopPreviewController({
      bridge: {
        updateShortTermMenuState() {
          return Promise.resolve();
        },
        setShortTermWindowMode() {
          return Promise.resolve();
        }
      },
      nodes,
      state,
      svgaController: { handlers: { deactivateForMultiFormat() {}, renderCommandState() {} } }
    });

    const playingResult = createRuntimeMountOpenResult("vap", { sourceId: "source:playback-meta" });
    playingResult.model.status = "playing";
    assert.equal(controller.handlers.beginHostFileOpen({ eventId: "playback-meta-playing" }), true);
    assert.equal(await controller.handlers.completeHostFileOpen({ eventId: "playback-meta-playing", result: playingResult }), true);

    assert.equal(nodes.playbackMeta.dataset.status, "playing");
    assert.equal(nodes.playbackMeta.dataset.format, "vap");
    assert.match(nodes.playbackMeta.textContent, /VAP · 120×80 · 0:01 · 播放中/u);
    assert.equal(nodes.playbackProgress.style["--asv-playback-progress"], "25%");
    assert.equal(nodes.playbackProgress.children[0].style.width, "25%");

    const unknownResult = createRuntimeMountOpenResult("lottie", { sourceId: "source:playback-unknown" });
    unknownResult.model.status = "hostInternalPhase123";
    unknownResult.model.detectedFormat = "internalRuntimeFormat";
    assert.equal(controller.handlers.beginHostFileOpen({ eventId: "playback-meta-unknown" }), true);
    assert.equal(await controller.handlers.completeHostFileOpen({ eventId: "playback-meta-unknown", result: unknownResult }), true);

    assert.equal(nodes.playbackMeta.dataset.status, "unknown");
    assert.equal(nodes.playbackMeta.dataset.format, "unknown");
    assert.match(nodes.playbackMeta.textContent, /0\.2 · 120×80 · 0:01 · 未知/u);
    assert.doesNotMatch(nodes.playbackMeta.textContent, /hostInternalPhase123|internalRuntimeFormat/u);
  } finally {
    globalThis.document = originalDocument;
  }
});

test("0.2 renderer mounts prepared Lottie and VAP runtime payloads after host file-open", async () => {
  const { createMultiFormatDesktopPreviewController } = await import(pathToFileURL(path.join(experimentRoot, "web/multiformat-desktop-preview-controller.mjs")).href);
  const originalDocument = globalThis.document;
  const originalLottie = globalThis.lottie;
  const originalVap = globalThis.Vap;
  const originalUrl = globalThis.URL;
  const nodes = createMultiFormatControllerTestNodes();
  const documentRef = createMultiFormatControllerTestDocument(nodes);
  const lottieCalls = [];
  const vapCalls = [];
  const objectUrls = [];
  globalThis.document = documentRef;
  globalThis.lottie = {
    loadAnimation(options) {
      lottieCalls.push(options);
      return {
        play() {},
        pause() {},
        destroy() {},
        goToAndStop(frame) {
          this.frame = frame;
        }
      };
    }
  };
  globalThis.Vap = {
    canWebGL() {
      return true;
    },
    default(options) {
      vapCalls.push(options);
      return {
        on() { return this; },
        play() { return this; },
        pause() {},
        destroy() {},
        setTime(seconds) {
          this.seconds = seconds;
        }
      };
    }
  };
  globalThis.URL = {
    createObjectURL() {
      const objectUrl = `blob:test-${objectUrls.length + 1}`;
      objectUrls.push(objectUrl);
      return objectUrl;
    },
    revokeObjectURL() {}
  };

  try {
    const bridge = createMultiFormatRuntimeMountTestBridge();
    const state = {
      view: "launch",
      mode: "preview",
      tab: "overview",
      appearance: "light",
      primaryPlaybackLooping: true,
      textPreviewValues: {}
    };
    const controller = createMultiFormatDesktopPreviewController({ bridge, nodes, state });
    controller.initialize();

    bridge.markOpened("lottie");
    assert.equal(controller.handlers.beginHostFileOpen({ eventId: "lottie-open" }), true);
    assert.equal(await controller.handlers.completeHostFileOpen({
      eventId: "lottie-open",
      result: createRuntimeMountOpenResult("lottie")
    }), true);
    await Promise.resolve();
    await Promise.resolve();

    assert.equal(lottieCalls.length, 1);
    assert.equal(lottieCalls[0].container.dataset.runtimeFormat, "lottie");
    assert.equal(lottieCalls[0].animationData.v, "5.7.4");
    assert.equal(lottieCalls[0].loop, true);
    assert.deepEqual(lottieCalls[0].rendererSettings, { runExpressions: false });
    assert.equal(nodes.runtimeMount.dataset.runtimePreviewState, "loaded");

    const lottieInput = nodes.textElementList.querySelector(`[data-text-input][data-text-key="text:1"]`);
    assert.ok(lottieInput);
    assert.equal(nodes.replaceableSummary.textContent, "(2)");
    assert.equal(lottieInput.value, "Original greeting");
    assert.equal(lottieInput.closest(".textElementRow[data-text-key]").dataset.replacementState, "source");
    assert.equal(lottieInput.closest(".textElementRow[data-text-key]").querySelector("[data-action='runtime-text-reset']").disabled, true);
    lottieInput.focus();
    lottieInput.value = "Runtime greeting";
    lottieInput.setSelectionRange(7, 15, "forward");
    await controller.handlers.updateRuntimeText("text:1", "Runtime greeting");
    await flushRuntimeMountPromises();
    const lottieChangedInput = nodes.textElementList.querySelector(`[data-text-input][data-text-key="text:1"]`);
    assert.equal(documentRef.activeElement, lottieChangedInput);
    assert.equal(lottieChangedInput.value, "Runtime greeting");
    assert.equal(lottieChangedInput.selectionStart, 7);
    assert.equal(lottieChangedInput.selectionEnd, 15);
    assert.equal(lottieChangedInput.selectionDirection, "forward");
    assert.equal(lottieChangedInput.closest(".textElementRow[data-text-key]").dataset.replacementState, "preview");
    assert.equal(lottieChangedInput.closest(".textElementRow[data-text-key]").querySelector("[data-action='runtime-text-reset']").disabled, false);
    assert.equal(nodes.replaceableSummary.textContent, "(2)*");
    assert.equal(lottieCalls.length, 2);
    assert.equal(lottieCalls[1].animationData.layers[0].t.d.k[0].s.t, "Runtime greeting");
    assert.deepEqual(bridge.prepareInputs.at(-1).replacements.active.map((record) => record.targetId), ["text:1"]);

    lottieChangedInput.value = "Original greeting";
    lottieChangedInput.setSelectionRange(8, 8, "none");
    await controller.handlers.updateRuntimeText("text:1", "Original greeting");
    await flushRuntimeMountPromises();
    const lottieSourceInput = nodes.textElementList.querySelector(`[data-text-input][data-text-key="text:1"]`);
    assert.equal(documentRef.activeElement, lottieSourceInput);
    assert.equal(lottieSourceInput.value, "Original greeting");
    assert.equal(lottieSourceInput.selectionStart, 8);
    assert.equal(lottieSourceInput.selectionEnd, 8);
    assert.equal(lottieSourceInput.closest(".textElementRow[data-text-key]").dataset.replacementState, "source");
    assert.equal(lottieSourceInput.closest(".textElementRow[data-text-key]").querySelector("[data-action='runtime-text-reset']").disabled, true);
    assert.equal(nodes.replaceableSummary.textContent, "(2)");
    assert.deepEqual(bridge.prepareInputs.at(-1).replacements.active, []);
    assert.equal(bridge.menuStates.at(-1).canResetText, false);

    lottieSourceInput.value = "Runtime greeting";
    lottieSourceInput.setSelectionRange(16, 16, "none");
    await controller.handlers.updateRuntimeText("text:1", "Runtime greeting");
    await flushRuntimeMountPromises();
    const lottieChangedAgainInput = nodes.textElementList.querySelector(`[data-text-input][data-text-key="text:1"]`);
    assert.equal(documentRef.activeElement, lottieChangedAgainInput);
    assert.equal(lottieChangedAgainInput.closest(".textElementRow[data-text-key]").dataset.replacementState, "preview");
    assert.equal(nodes.replaceableSummary.textContent, "(2)*");

    controller.handlers.selectImageKey("avatar");
    await controller.handlers.applyReplacementFile({
      type: "image/png",
      async arrayBuffer() {
        return Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 1, 2, 3]).buffer;
      }
    });
    await flushRuntimeMountPromises();
    assert.equal(lottieCalls.length, 5);
    assert.equal(lottieCalls[4].animationData.layers[0].t.d.k[0].s.t, "Runtime greeting");
    assert.match(lottieCalls[4].animationData.assets[0].p, /^data:image\/png;base64,/u);
    assert.deepEqual(
      bridge.prepareInputs.at(-1).replacements.active.map((record) => record.targetId).sort(),
      ["avatar", "text:1"]
    );
    assert.equal(nodes.replaceableSummary.textContent, "(2)*");

    await controller.handlers.resetRuntimeText("text:1");
    await flushRuntimeMountPromises();
    assert.equal(lottieCalls.length, 6);
    assert.equal(lottieCalls[5].animationData.layers[0].t.d.k[0].s.t, "Original greeting");
    assert.match(lottieCalls[5].animationData.assets[0].p, /^data:image\/png;base64,/u);
    assert.deepEqual(bridge.prepareInputs.at(-1).replacements.active.map((record) => record.targetId), ["avatar"]);
    assert.equal(bridge.menuStates.at(-1).canResetImageReplacement, true);
    assert.equal(bridge.menuStates.at(-1).canResetText, false);
    const lottieResetInput = nodes.textElementList.querySelector(`[data-text-input][data-text-key="text:1"]`);
    assert.equal(documentRef.activeElement, lottieResetInput);
    assert.equal(lottieResetInput.value, "Original greeting");
    assert.equal(lottieResetInput.selectionStart, 16);
    assert.equal(lottieResetInput.selectionEnd, 16);
    assert.equal(lottieResetInput.closest(".textElementRow[data-text-key]").dataset.replacementState, "source");
    assert.equal(lottieResetInput.closest(".textElementRow[data-text-key]").querySelector("[data-action='runtime-text-reset']").disabled, true);
    assert.equal(nodes.replaceableSummary.textContent, "(2)*");

    await controller.handlers.resetImageReplacement("avatar");
    await flushRuntimeMountPromises();
    assert.equal(lottieCalls.length, 7);
    assert.equal(lottieCalls[6].animationData.assets[0].p, "data:image/png;base64,AQID");
    assert.deepEqual(bridge.prepareInputs.at(-1).replacements.active, []);
    assert.equal(bridge.menuStates.at(-1).canResetImageReplacement, false);
    assert.equal(nodes.replaceableSummary.textContent, "(2)");

    bridge.markOpened("vap");
    assert.equal(controller.handlers.beginHostFileOpen({ eventId: "vap-open" }), true);
    assert.equal(await controller.handlers.completeHostFileOpen({
      eventId: "vap-open",
      result: createRuntimeMountOpenResult("vap")
    }), true);
    await flushRuntimeMountPromises();

    assert.equal(vapCalls.length, 1);
    assert.equal(vapCalls[0].container.dataset.runtimeFormat, "vap");
    assert.equal(vapCalls[0].config.info.w, 120);
    assert.equal(vapCalls[0].precache, false);
    assert.equal(vapCalls[0].src, "blob:test-1");
    assert.equal(objectUrls.length, 1);
    assert.equal(nodes.runtimeMount.dataset.runtimePreviewState, "loaded");

    const unrelatedFocus = new FakeDomElement("button");
    unrelatedFocus.ownerDocument = documentRef;
    unrelatedFocus.focus();
    controller.handlers.updateRuntimeText("title", "Runtime VAP title");
    await flushRuntimeMountPromises();
    assert.equal(vapCalls.length, 2);
    assert.equal(vapCalls[1].title, "Runtime VAP title");
    assert.deepEqual(bridge.prepareInputs.at(-1).replacements.active.map((record) => record.targetId), ["title"]);
    assert.equal(documentRef.activeElement, unrelatedFocus);

    const vapInput = nodes.textElementList.querySelector(`[data-text-input][data-text-key="title"]`);
    assert.equal(vapInput.closest(".textElementRow[data-text-key]").dataset.replacementState, "preview");
    assert.equal(vapInput.closest(".textElementRow[data-text-key]").querySelector("[data-action='runtime-text-reset']").disabled, false);
    assert.equal(nodes.replaceableSummary.textContent, "(2)*");
    vapInput.focus();
    vapInput.setSelectionRange(3, 3, "none");
    await controller.handlers.resetRuntimeText("title");
    await flushRuntimeMountPromises();
    const vapSourceInput = nodes.textElementList.querySelector(`[data-text-input][data-text-key="title"]`);
    assert.equal(documentRef.activeElement, vapSourceInput);
    assert.equal(vapSourceInput.value, "VAP 融合文字");
    assert.equal(vapSourceInput.selectionStart, 3);
    assert.equal(vapSourceInput.closest(".textElementRow[data-text-key]").dataset.replacementState, "source");
    assert.equal(vapSourceInput.closest(".textElementRow[data-text-key]").querySelector("[data-action='runtime-text-reset']").disabled, true);
    assert.equal(nodes.replaceableSummary.textContent, "(2)");
    assert.deepEqual(bridge.prepareInputs.at(-1).replacements.active, []);
    assert.equal(bridge.menuStates.at(-1).canResetText, false);
  } finally {
    globalThis.document = originalDocument;
    globalThis.lottie = originalLottie;
    globalThis.Vap = originalVap;
    globalThis.URL = originalUrl;
  }
});

test("0.2 Lottie and VAP text intents cannot publish a delayed Apply after returning to source", async () => {
  const { createMultiFormatDesktopPreviewController } = await import(pathToFileURL(path.join(experimentRoot, "web/multiformat-desktop-preview-controller.mjs")).href);
  const originalDocument = globalThis.document;
  const originalLottie = globalThis.lottie;
  const originalVap = globalThis.Vap;
  const originalUrl = globalThis.URL;
  globalThis.lottie = {
    loadAnimation() {
      return { play() {}, pause() {}, destroy() {}, goToAndStop() {} };
    }
  };
  globalThis.Vap = {
    canWebGL() { return true; },
    default() {
      return { on() { return this; }, play() { return this; }, pause() {}, destroy() {}, setTime() {} };
    }
  };
  globalThis.URL = {
    createObjectURL() { return "blob:runtime-text-intent"; },
    revokeObjectURL() {}
  };

  try {
    for (const fixture of [
      { format: "lottie", textKey: "text:1", sourceValue: "Original greeting", changedValue: "Delayed Lottie" },
      { format: "vap", textKey: "title", sourceValue: "VAP 融合文字", changedValue: "延迟 VAP" }
    ]) {
      const nodes = createMultiFormatControllerTestNodes();
      const documentRef = createMultiFormatControllerTestDocument(nodes);
      globalThis.document = documentRef;
      const bridge = createMultiFormatRuntimeMountTestBridge();
      const pendingApplies = [];
      const pendingResets = [];
      const applyReplacement = bridge.applyMultiFormatReplacement.bind(bridge);
      const resetReplacement = bridge.resetMultiFormatReplacement.bind(bridge);
      bridge.applyMultiFormatReplacement = (input) => new Promise((resolve) => {
        pendingApplies.push({ input, resolve: () => resolve(applyReplacement(input)) });
      });
      bridge.resetMultiFormatReplacement = (input) => new Promise((resolve) => {
        pendingResets.push({ input, resolve: () => resolve(resetReplacement(input)) });
      });
      const state = {
        view: "launch",
        mode: "preview",
        tab: "overview",
        appearance: "light",
        primaryPlaybackLooping: true,
        textPreviewValues: {}
      };
      const controller = createMultiFormatDesktopPreviewController({ bridge, nodes, state });
      controller.initialize();
      bridge.markOpened(fixture.format);
      assert.equal(controller.handlers.beginHostFileOpen({ eventId: `${fixture.format}-intent-open` }), true);
      assert.equal(await controller.handlers.completeHostFileOpen({
        eventId: `${fixture.format}-intent-open`,
        result: createRuntimeMountOpenResult(fixture.format)
      }), true);
      await flushRuntimeMountPromises();

      controller.handlers.updateRuntimeText(fixture.textKey, fixture.sourceValue);
      controller.handlers.updateRuntimeText(fixture.textKey, `${fixture.changedValue} skipped`);
      controller.handlers.updateRuntimeText(fixture.textKey, fixture.sourceValue);
      await flushRuntimeMountPromises();
      assert.equal(pendingApplies.length, 0, `${fixture.format} no-wait source -> changed -> source must coalesce before dispatch`);
      assert.equal(pendingResets.length, 0, `${fixture.format} no-wait source -> changed -> source must not create a needless Reset`);

      const input = nodes.textElementList.querySelector(`[data-text-input][data-text-key="${fixture.textKey}"]`);
      input.focus();
      input.value = fixture.changedValue;
      input.setSelectionRange(2, Math.min(7, fixture.changedValue.length), "forward");
      controller.handlers.updateRuntimeText(fixture.textKey, fixture.changedValue);
      await flushRuntimeMountPromises();
      assert.equal(pendingApplies.length, 1, `${fixture.format} changed intent must dispatch Apply`);

      const changedInput = nodes.textElementList.querySelector(`[data-text-input][data-text-key="${fixture.textKey}"]`);
      changedInput.setSelectionRange(3, 3, "none");
      const sourceMutation = controller.handlers.resetRuntimeText(fixture.textKey);
      await flushRuntimeMountPromises();
      const immediateSourceInput = nodes.textElementList.querySelector(`[data-text-input][data-text-key="${fixture.textKey}"]`);
      assert.equal(immediateSourceInput.value, fixture.sourceValue);
      assert.equal(immediateSourceInput.selectionStart, 3);
      assert.equal(immediateSourceInput.closest(".textElementRow[data-text-key]").dataset.replacementState, "source");
      assert.equal(immediateSourceInput.closest(".textElementRow[data-text-key]").querySelector("[data-action='runtime-text-reset']").disabled, true);

      pendingApplies.shift().resolve();
      await flushRuntimeMountPromises();
      assert.equal(pendingResets.length, 1, `${fixture.format} newest source intent must reconcile a delayed Apply`);
      pendingResets.shift().resolve();
      await sourceMutation;
      await flushRuntimeMountPromises();

      const finalInput = nodes.textElementList.querySelector(`[data-text-input][data-text-key="${fixture.textKey}"]`);
      assert.equal(documentRef.activeElement, finalInput);
      assert.equal(finalInput.value, fixture.sourceValue);
      assert.equal(finalInput.selectionStart, 3);
      assert.equal(finalInput.selectionEnd, 3);
      assert.equal(finalInput.closest(".textElementRow[data-text-key]").dataset.replacementState, "source");
      assert.equal(finalInput.closest(".textElementRow[data-text-key]").querySelector("[data-action='runtime-text-reset']").disabled, true);
      assert.deepEqual(bridge.prepareInputs.at(-1).replacements.active, []);
      assert.equal(bridge.menuStates.at(-1).canResetText, false);

      const firstChangedValue = `${fixture.changedValue} first`;
      const latestChangedValue = `${fixture.changedValue} latest`;
      finalInput.value = firstChangedValue;
      controller.handlers.updateRuntimeText(fixture.textKey, firstChangedValue);
      await flushRuntimeMountPromises();
      assert.equal(pendingApplies.length, 1, `${fixture.format} first changed intent must dispatch Apply`);

      const latestInput = nodes.textElementList.querySelector(`[data-text-input][data-text-key="${fixture.textKey}"]`);
      latestInput.focus();
      latestInput.value = latestChangedValue;
      latestInput.setSelectionRange(4, Math.min(9, latestChangedValue.length), "forward");
      const latestMutation = controller.handlers.updateRuntimeText(fixture.textKey, latestChangedValue);
      await flushRuntimeMountPromises();
      assert.equal(pendingApplies.length, 1, `${fixture.format} newer Apply must wait for the older target mutation`);

      pendingApplies.shift().resolve();
      await flushRuntimeMountPromises();
      assert.equal(pendingApplies.length, 1, `${fixture.format} latest Apply dispatches only after the older completion settles`);
      const beforeLatestCompletion = nodes.textElementList.querySelector(`[data-text-input][data-text-key="${fixture.textKey}"]`);
      assert.equal(beforeLatestCompletion.value, latestChangedValue);
      assert.equal(beforeLatestCompletion.selectionStart, 4);
      assert.equal(beforeLatestCompletion.selectionEnd, Math.min(9, latestChangedValue.length));

      pendingApplies.shift().resolve();
      await latestMutation;
      await flushRuntimeMountPromises();
      const orderedFinalInput = nodes.textElementList.querySelector(`[data-text-input][data-text-key="${fixture.textKey}"]`);
      assert.equal(documentRef.activeElement, orderedFinalInput);
      assert.equal(orderedFinalInput.value, latestChangedValue);
      assert.equal(orderedFinalInput.closest(".textElementRow[data-text-key]").dataset.replacementState, "preview");
      assert.equal(orderedFinalInput.closest(".textElementRow[data-text-key]").querySelector("[data-action='runtime-text-reset']").disabled, false);
      assert.equal(bridge.prepareInputs.at(-1).replacements.active.at(-1).valuePreview, latestChangedValue);
    }
  } finally {
    globalThis.document = originalDocument;
    globalThis.lottie = originalLottie;
    globalThis.Vap = originalVap;
    globalThis.URL = originalUrl;
  }
});

test("0.2 accepted Lottie and VAP source reopen clears stale renderer replacement authority", async () => {
  const { createMultiFormatDesktopPreviewController } = await import(pathToFileURL(path.join(experimentRoot, "web/multiformat-desktop-preview-controller.mjs")).href);
  const originalDocument = globalThis.document;
  const originalLottie = globalThis.lottie;
  const originalVap = globalThis.Vap;
  const originalUrl = globalThis.URL;
  globalThis.lottie = {
    loadAnimation() {
      return { play() {}, pause() {}, destroy() {}, goToAndStop() {} };
    }
  };
  globalThis.Vap = {
    canWebGL() { return true; },
    default() {
      return { on() { return this; }, play() { return this; }, pause() {}, destroy() {}, setTime() {} };
    }
  };
  globalThis.URL = {
    createObjectURL() { return "blob:open-isolation"; },
    revokeObjectURL() {}
  };

  try {
    for (const fixture of [
      { format: "lottie", textKey: "text:1", sourceValue: "Original greeting", changedValue: "stale-from-source-a" },
      { format: "vap", textKey: "title", sourceValue: "VAP 融合文字", changedValue: "过期来源 A" }
    ]) {
      const nodes = createMultiFormatControllerTestNodes();
      const documentRef = createMultiFormatControllerTestDocument(nodes);
      globalThis.document = documentRef;
      const bridge = createMultiFormatRuntimeMountTestBridge();
      const state = {
        view: "launch",
        mode: "preview",
        tab: "overview",
        appearance: "light",
        primaryPlaybackLooping: true,
        textPreviewValues: {}
      };
      const controller = createMultiFormatDesktopPreviewController({ bridge, nodes, state });
      controller.initialize();

      bridge.markOpened(fixture.format);
      assert.equal(controller.handlers.beginHostFileOpen({ eventId: `${fixture.format}-source-a` }), true);
      assert.equal(await controller.handlers.completeHostFileOpen({
        eventId: `${fixture.format}-source-a`,
        result: createRuntimeMountOpenResult(fixture.format, { sourceId: `${fixture.format}:source-a` })
      }), true);
      await flushRuntimeMountPromises();

      controller.handlers.selectImageKey("avatar");
      await controller.handlers.applyReplacementFile({
        type: "image/png",
        async arrayBuffer() {
          return Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 9, 9, 9]).buffer;
        }
      });
      await controller.handlers.updateRuntimeText(fixture.textKey, fixture.changedValue);
      await flushRuntimeMountPromises();

      assert.equal(state.textPreviewValues[fixture.textKey], fixture.changedValue);
      assert.deepEqual(
        bridge.prepareInputs.at(-1).replacements.active.map((record) => `${record.kind}:${record.targetId}`).sort(),
        [`image:avatar`, `text:${fixture.textKey}`].sort()
      );

      bridge.markOpened(fixture.format);
      const prepareCountBeforeSourceB = bridge.prepareInputs.length;
      assert.equal(controller.handlers.beginHostFileOpen({ eventId: `${fixture.format}-source-b` }), true);
      assert.equal(await controller.handlers.completeHostFileOpen({
        eventId: `${fixture.format}-source-b`,
        result: createRuntimeMountOpenResult(fixture.format, { sourceId: `${fixture.format}:source-b` })
      }), true);
      await flushRuntimeMountPromises();

      const sourceBPrepare = bridge.prepareInputs.slice(prepareCountBeforeSourceB)
        .find((input) => input.sourceId === `${fixture.format}:source-b`);
      assert.ok(sourceBPrepare, `${fixture.format} source B must prepare runtime`);
      assert.deepEqual(sourceBPrepare.replacements.active, [], `${fixture.format} source B host replacement model must be clean`);
      assert.equal(sourceBPrepare.replacements.runtimeValues, undefined, `${fixture.format} source B must not inherit source A runtime values`);
      assert.deepEqual(state.textPreviewValues, {}, `${fixture.format} source B must not inherit visible text preview values`);
      const input = nodes.textElementList.querySelector(`[data-text-input][data-text-key="${fixture.textKey}"]`);
      assert.equal(input.value, fixture.sourceValue);
      assert.equal(input.closest(".textElementRow[data-text-key]").dataset.replacementState, "source");
    }
  } finally {
    globalThis.document = originalDocument;
    globalThis.lottie = originalLottie;
    globalThis.Vap = originalVap;
    globalThis.URL = originalUrl;
  }
});

test("0.2 delayed Lottie and VAP Apply completion cannot cross a successful source reopen", async () => {
  const { createMultiFormatDesktopPreviewController } = await import(pathToFileURL(path.join(experimentRoot, "web/multiformat-desktop-preview-controller.mjs")).href);
  const originalDocument = globalThis.document;
  const originalLottie = globalThis.lottie;
  const originalVap = globalThis.Vap;
  const originalUrl = globalThis.URL;
  globalThis.lottie = {
    loadAnimation() {
      return { play() {}, pause() {}, destroy() {}, goToAndStop() {} };
    }
  };
  globalThis.Vap = {
    canWebGL() { return true; },
    default() {
      return { on() { return this; }, play() { return this; }, pause() {}, destroy() {}, setTime() {} };
    }
  };
  globalThis.URL = {
    createObjectURL() { return "blob:delayed-open-isolation"; },
    revokeObjectURL() {}
  };

  try {
    for (const fixture of [
      { format: "lottie", textKey: "text:1", sourceValue: "Original greeting", changedValue: "delayed-source-a" },
      { format: "vap", textKey: "title", sourceValue: "VAP 融合文字", changedValue: "延迟来源 A" }
    ]) {
      const nodes = createMultiFormatControllerTestNodes();
      const documentRef = createMultiFormatControllerTestDocument(nodes);
      globalThis.document = documentRef;
      const bridge = createMultiFormatRuntimeMountTestBridge();
      const applyReplacement = bridge.applyMultiFormatReplacement.bind(bridge);
      const pendingApplies = [];
      bridge.applyMultiFormatReplacement = (input) => new Promise((resolve) => {
        pendingApplies.push({ input, resolve: () => resolve(applyReplacement(input)) });
      });
      const state = {
        view: "launch",
        mode: "preview",
        tab: "overview",
        appearance: "light",
        primaryPlaybackLooping: true,
        textPreviewValues: {}
      };
      const controller = createMultiFormatDesktopPreviewController({ bridge, nodes, state });
      controller.initialize();

      bridge.markOpened(fixture.format);
      assert.equal(controller.handlers.beginHostFileOpen({ eventId: `${fixture.format}-delayed-a` }), true);
      assert.equal(await controller.handlers.completeHostFileOpen({
        eventId: `${fixture.format}-delayed-a`,
        result: createRuntimeMountOpenResult(fixture.format, { sourceId: `${fixture.format}:delayed-a` })
      }), true);
      await flushRuntimeMountPromises();

      const mutation = controller.handlers.updateRuntimeText(fixture.textKey, fixture.changedValue);
      await flushRuntimeMountPromises();
      assert.equal(pendingApplies.length, 1, `${fixture.format} source A changed text must dispatch Apply`);
      assert.equal(state.textPreviewValues[fixture.textKey], fixture.changedValue);

      bridge.markOpened(fixture.format);
      assert.equal(controller.handlers.beginHostFileOpen({ eventId: `${fixture.format}-delayed-b` }), true);
      assert.equal(await controller.handlers.completeHostFileOpen({
        eventId: `${fixture.format}-delayed-b`,
        result: createRuntimeMountOpenResult(fixture.format, { sourceId: `${fixture.format}:delayed-b` })
      }), true);
      await flushRuntimeMountPromises();
      const prepareCountAfterSourceB = bridge.prepareInputs.length;

      pendingApplies.shift().resolve();
      await mutation;
      await flushRuntimeMountPromises();

      assert.equal(bridge.prepareInputs.length, prepareCountAfterSourceB, `${fixture.format} delayed source A Apply must not remount source B`);
      assert.deepEqual(state.textPreviewValues, {}, `${fixture.format} delayed source A Apply must not restore visible text state`);
      const input = nodes.textElementList.querySelector(`[data-text-input][data-text-key="${fixture.textKey}"]`);
      assert.equal(input.value, fixture.sourceValue);
      assert.equal(input.closest(".textElementRow[data-text-key]").dataset.replacementState, "source");
    }
  } finally {
    globalThis.document = originalDocument;
    globalThis.lottie = originalLottie;
    globalThis.Vap = originalVap;
    globalThis.URL = originalUrl;
  }
});

test("0.2 delayed Lottie and VAP image Apply completion cannot publish after source reopen", async () => {
  const { createMultiFormatDesktopPreviewController } = await import(pathToFileURL(path.join(experimentRoot, "web/multiformat-desktop-preview-controller.mjs")).href);
  const originalDocument = globalThis.document;
  const originalLottie = globalThis.lottie;
  const originalVap = globalThis.Vap;
  const originalUrl = globalThis.URL;
  globalThis.lottie = {
    loadAnimation() {
      return { play() {}, pause() {}, destroy() {}, goToAndStop() {} };
    }
  };
  globalThis.Vap = {
    canWebGL() { return true; },
    default() {
      return { on() { return this; }, play() { return this; }, pause() {}, destroy() {}, setTime() {} };
    }
  };
  globalThis.URL = {
    createObjectURL() { return "blob:delayed-image-open-isolation"; },
    revokeObjectURL() {}
  };

  try {
    for (const format of ["lottie", "vap"]) {
      const nodes = createMultiFormatControllerTestNodes();
      const documentRef = createMultiFormatControllerTestDocument(nodes);
      globalThis.document = documentRef;
      const bridge = createMultiFormatRuntimeMountTestBridge();
      const applyReplacement = bridge.applyMultiFormatReplacement.bind(bridge);
      const pendingApplies = [];
      bridge.applyMultiFormatReplacement = (input) => new Promise((resolve) => {
        pendingApplies.push({ input, resolve: () => resolve(applyReplacement(input)) });
      });
      const state = {
        view: "launch",
        mode: "preview",
        tab: "overview",
        appearance: "light",
        primaryPlaybackLooping: true,
        textPreviewValues: {}
      };
      const controller = createMultiFormatDesktopPreviewController({ bridge, nodes, state });
      controller.initialize();

      bridge.markOpened(format);
      assert.equal(controller.handlers.beginHostFileOpen({ eventId: `${format}-image-a` }), true);
      assert.equal(await controller.handlers.completeHostFileOpen({
        eventId: `${format}-image-a`,
        result: createRuntimeMountOpenResult(format, { sourceId: `${format}:image-a` })
      }), true);
      await flushRuntimeMountPromises();

      controller.handlers.selectImageKey("avatar");
      const mutation = controller.handlers.applyReplacementFile({
        type: "image/png",
        async arrayBuffer() {
          return Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 7, 7, 7]).buffer;
        }
      });
      await flushRuntimeMountPromises();
      assert.equal(pendingApplies.length, 1, `${format} source A image Apply must dispatch`);

      bridge.markOpened(format);
      assert.equal(controller.handlers.beginHostFileOpen({ eventId: `${format}-image-b` }), true);
      assert.equal(await controller.handlers.completeHostFileOpen({
        eventId: `${format}-image-b`,
        result: createRuntimeMountOpenResult(format, { sourceId: `${format}:image-b` })
      }), true);
      await flushRuntimeMountPromises();
      const prepareCountAfterSourceB = bridge.prepareInputs.length;

      pendingApplies.shift().resolve();
      await mutation;
      await flushRuntimeMountPromises();

      assert.equal(bridge.prepareInputs.length, prepareCountAfterSourceB, `${format} delayed source A image Apply must not remount source B`);
      assert.equal(state.sourceId, `${format}:image-b`);
      assert.equal(state.model.replacement.dirty, false);
      assert.deepEqual(state.model.replacement.active, []);
      assert.deepEqual(state.textPreviewValues, {});
    }
  } finally {
    globalThis.document = originalDocument;
    globalThis.lottie = originalLottie;
    globalThis.Vap = originalVap;
    globalThis.URL = originalUrl;
  }
});

test("0.2 renderer runtime prepare failure preserves current multi-format source and recovers through host control", async () => {
  const { createMultiFormatDesktopPreviewController } = await import(pathToFileURL(path.join(experimentRoot, "web/multiformat-desktop-preview-controller.mjs")).href);
  const originalDocument = globalThis.document;
  const originalLottie = globalThis.lottie;
  const nodes = createMultiFormatControllerTestNodes();
  const documentRef = createMultiFormatControllerTestDocument(nodes);
  const baseBridge = createMultiFormatRuntimeMountTestBridge();
  const controlCalls = [];
  let prepareAttempts = 0;
  globalThis.document = documentRef;
  globalThis.lottie = {
    loadAnimation() {
      return {
        play() {},
        pause() {},
        destroy() {},
        goToAndStop() {}
      };
    }
  };

  try {
    baseBridge.markOpened("lottie");
    const bridge = {
      ...baseBridge,
      prepareMultiFormatRuntimePreview(input) {
        prepareAttempts += 1;
        if (prepareAttempts === 1) {
          return Promise.reject(new Error("runtime prepare failed for /Users/alice/Secret/lottie.json"));
        }
        return baseBridge.prepareMultiFormatRuntimePreview(input);
      },
      controlMultiFormatPreview(input) {
        controlCalls.push(input);
        return Promise.resolve(createRuntimeMountOpenResult("lottie", { sourceId: "lottie-runtime-source" }));
      }
    };
    const state = {
      view: "launch",
      mode: "preview",
      tab: "overview",
      appearance: "light",
      primaryPlaybackLooping: true,
      textPreviewValues: {}
    };
    const controller = createMultiFormatDesktopPreviewController({ bridge, nodes, state });
    controller.initialize();

    assert.equal(controller.handlers.beginHostFileOpen({ eventId: "runtime-failure-lottie" }), true);
    assert.equal(await controller.handlers.completeHostFileOpen({
      eventId: "runtime-failure-lottie",
      result: createRuntimeMountOpenResult("lottie", { sourceId: "lottie-runtime-source" })
    }), true);
    await flushRuntimeMountPromises();

    assert.equal(prepareAttempts, 1);
    assert.equal(state.view, "preview");
    assert.equal(state.sourceId, "lottie-runtime-source");
    assert.equal(state.displayName, "lottie.fixture");
    assert.equal(state.model.status, "playbackFailed");
    assert.equal(state.selectedImageKey, "avatar");
    assert.equal(state.selectedTextKey, "text:1");
    assert.equal(nodes.playbackMeta.textContent.includes("播放异常"), true);
    assert.equal(nodes.errorMessage.textContent, "无法挂载本地预览，源文件没有被修改。");
    assert.doesNotMatch(JSON.stringify(state.model), /\/Users|alice|Secret|lottie\.json/i);

    const failureMenu = bridge.menuStates.at(-1);
    assert.equal(failureMenu.view, "preview");
    assert.equal(failureMenu.hasFile, true);
    assert.equal(failureMenu.canPlay, true);
    assert.equal(failureMenu.canReplay, true);
    assert.equal(failureMenu.canReplaceImage, true);

    await controller.handlers.togglePrimaryPlayback();
    await flushRuntimeMountPromises();

    assert.deepEqual(controlCalls.map((input) => input.action), ["recover"]);
    assert.equal(state.view, "preview");
    assert.equal(state.model.status, "previewReady");
    assert.equal(nodes.runtimeMount.dataset.runtimePreviewState, "loaded");
    assert.equal(nodes.errorMessage.textContent, "");
  } finally {
    globalThis.document = originalDocument;
    globalThis.lottie = originalLottie;
  }
});

test("0.2 deferred SVGA mount completion cannot overwrite a newer runtime generation", async () => {
  const { createMultiFormatDesktopPreviewController } = await import(pathToFileURL(path.join(experimentRoot, "web/multiformat-desktop-preview-controller.mjs")).href);
  const originalDocument = globalThis.document;
  const nodes = createMultiFormatControllerTestNodes();
  globalThis.document = createMultiFormatControllerTestDocument(nodes);
  const mountCalls = [];
  const stopCalls = [];
  const pauseCalls = [];
  const deferredMounts = [];
  const svgaPlaybackModule = {
    mountPlayback(input) {
      mountCalls.push(input);
      return new Promise((resolve) => deferredMounts.push({ input, resolve }));
    },
    stopPlayback(input) {
      stopCalls.push(input);
      delete input.playbackState[`${input.key}Playback`];
    },
    playbackProgressView(playback) {
      return { progress: playback?.progress ?? 0, frame: playback?.player?.currentFrame ?? 0, frames: 60, timeCopy: "0:00 / 0:01" };
    },
    pausePlaybackAtCurrentFrame(playback) {
      pauseCalls.push(playback?.label);
      playback.player.pause();
      playback.playing = false;
      return playback.player.currentFrame;
    }
  };
  const bridge = {
    productMilestoneId: "0.2-multiformat-preview",
    updateShortTermMenuState() { return Promise.resolve(); },
    setShortTermWindowMode() { return Promise.resolve(); },
    prepareMultiFormatRuntimePreview(input) {
      return Promise.resolve({
        status: "prepared",
        format: "svga",
        svgaBase64: Buffer.from([0x78, 0x9c, 0x03, 0x00]).toString("base64"),
        sourceId: input.sourceId
      });
    },
    controlMultiFormatPreview(input) {
      const result = createRuntimeMountOpenResult("svga", { sourceId: "svga-source-new" });
      result.model.status = input.action === "play" ? "playing" : "paused";
      result.model.canvas.playback.status = result.model.status;
      return Promise.resolve(result);
    }
  };
  const state = {
    view: "launch",
    mode: "preview",
    tab: "overview",
    appearance: "light",
    primaryPlaybackLooping: true,
    textPreviewValues: {}
  };

  try {
    const controller = createMultiFormatDesktopPreviewController({
      bridge,
      nodes,
      state,
      svgaPlaybackModuleLoader: async () => svgaPlaybackModule
    });
    controller.initialize();

    assert.equal(controller.handlers.beginHostFileOpen({ eventId: "svga-old" }), true);
    assert.equal(await controller.handlers.completeHostFileOpen({
      eventId: "svga-old",
      result: createRuntimeMountOpenResult("svga", { sourceId: "svga-source-old" })
    }), true);
    await flushRuntimeMountPromises();
    assert.equal(mountCalls.length, 1);

    assert.equal(controller.handlers.beginHostFileOpen({ eventId: "svga-new" }), true);
    assert.equal(await controller.handlers.completeHostFileOpen({
      eventId: "svga-new",
      result: createRuntimeMountOpenResult("svga", { sourceId: "svga-source-new" })
    }), true);
    await flushRuntimeMountPromises();
    assert.equal(mountCalls.length, 2);
    assert.notEqual(mountCalls[0].key, mountCalls[1].key);
    assert.notEqual(mountCalls[0].canvas, mountCalls[1].canvas);

    const newPlayback = fakeDeferredSvgaPlayback("new");
    deferredMounts[1].resolve(newPlayback);
    await flushRuntimeMountPromises();
    const currentCanvas = nodes.runtimeMount.children[0];
    assert.equal(currentCanvas, mountCalls[1].canvas);
    assert.equal(currentCanvas.dataset.runtimePlayer, "svga-web");
    assert.equal(nodes.runtimeMount.dataset.runtimePlayerReady, "svga-web");

    deferredMounts[0].resolve(fakeDeferredSvgaPlayback("old"));
    await flushRuntimeMountPromises();
    assert.equal(nodes.runtimeMount.children[0], currentCanvas);
    assert.equal(nodes.runtimeMount.dataset.runtimePlayerReady, "svga-web");
    assert.deepEqual(stopCalls.map(({ key }) => key), [mountCalls[0].key]);
    assert.deepEqual(pauseCalls, ["new"]);

    const mountCount = mountCalls.length;
    await controller.handlers.togglePrimaryPlayback();
    await flushRuntimeMountPromises();
    assert.equal(state.model.status, "playing");
    assert.equal(mountCalls.length, mountCount);
    assert.deepEqual(pauseCalls, ["new"]);
    await controller.handlers.togglePrimaryPlayback();
    await flushRuntimeMountPromises();
    assert.equal(state.model.status, "paused");
    assert.equal(mountCalls.length, mountCount);
    assert.deepEqual(pauseCalls, ["new", "new"]);
  } finally {
    globalThis.document = originalDocument;
  }
});

test("0.2 runtime mount preserves VAP canvas intrinsic aspect ratio", async () => {
  const modulesCss = await readFile(path.join(experimentRoot, "web/short-term-macos.modules.css"), "utf8");
  const controller = await readFile(path.join(experimentRoot, "web/multiformat-desktop-preview-controller.mjs"), "utf8");

  assert.match(modulesCss, /(?:^|\n)canvas\s*\{[^}]*aspect-ratio:\s*var\(--asv-playback-aspect,\s*1\s*\/\s*1\);/s);
  assert.match(modulesCss, /\.multiFormatRuntimeMount canvas\s*\{[^}]*aspect-ratio:\s*auto;/s);
  assert.match(controller, /function fitVapRuntimeCanvas\(mount\)/);
  assert.match(controller, /querySelector\?\.\("\.playbackBar"\)\?\.getBoundingClientRect/);
  assert.match(controller, /mount\.style\.padding =/);
  assert.match(controller, /Math\.min\(1, availableWidth \/ backingWidth, availableHeight \/ backingHeight\)/);
  assert.match(controller, /canvas\.style\.aspectRatio = `\$\{backingWidth\} \/ \$\{backingHeight\}`/);
});

test("0.2 first-launch file-open survives delayed renderer-ready flush and late initialization", async () => {
  const { createMultiFormatDesktopPreviewController } = await import(pathToFileURL(path.join(experimentRoot, "web/multiformat-desktop-preview-controller.mjs")).href);
  const sessionRoot = await mkdtemp(path.join(os.tmpdir(), "auto-svga-first-launch-open-"));
  const session = createMultiFormatDesktopPreviewSession({
    repoRoot,
    sessionRoot,
    sourceStore: new Map(),
    openTimeoutMs: 1000
  });
  const lottiePath = path.join(sessionRoot, "first-launch-lottie.json");
  const originalDocument = globalThis.document;
  const originalLottie = globalThis.lottie;
  const nodes = createMultiFormatControllerTestNodes();
  const lottieCalls = [];
  const runtimeEvents = [];

  globalThis.document = createMultiFormatControllerTestDocument(nodes);
  globalThis.lottie = {
    loadAnimation(options) {
      lottieCalls.push(options);
      return {
        play() { runtimeEvents.push("lottie:play"); },
        pause() { runtimeEvents.push("lottie:pause"); },
        destroy() { runtimeEvents.push("lottie:destroy"); },
        goToAndStop() { runtimeEvents.push("lottie:seek"); }
      };
    }
  };

  try {
    await writeFile(lottiePath, JSON.stringify({
      v: "5.7.4",
      w: 120,
      h: 160,
      fr: 30,
      ip: 0,
      op: 30,
      assets: [],
      layers: [{
        ind: 1,
        ty: 5,
        nm: "Foreground title",
        t: { d: { k: [{ s: { t: "Task-owned first launch Lottie" } }] } }
      }]
    }));

    const state = {
      view: "launch",
      mode: "preview",
      tab: "overview",
      appearance: "light",
      primaryPlaybackLooping: true,
      textPreviewValues: {}
    };
    const bridge = createSessionBackedMultiFormatRuntimeMountTestBridge(session);
    const controller = createMultiFormatDesktopPreviewController({ bridge, nodes, state });

    controller.initialize();
    assert.equal(state.view, "launch");
    await Promise.resolve();

    assert.equal(controller.handlers.beginHostFileOpen({ eventId: "first-launch-lottie" }), true);
    const lottie = await session.openLocalFilePath(lottiePath, "fileOpenEvent");
    assert.equal(await controller.handlers.completeHostFileOpen({ eventId: "first-launch-lottie", result: lottie }), true);
    await flushRuntimeMountPromises();

    assert.equal(state.view, "preview");
    assert.equal(state.model.status, "playing");
    assert.equal(state.model.openedFrom, "fileOpenEvent");
    assert.equal(state.model.detectedFormat, "lottie");
    assert.equal(state.model.rightPanel.lottieTexts.length, 1);
    assert.equal(lottieCalls.length, 1);
    assert.equal(nodes.runtimeMount.dataset.runtimePreviewState, "loaded");
    assert.equal(runtimeEvents.includes("lottie:play"), true);

    controller.initialize();
    await flushRuntimeMountPromises();

    assert.equal(state.view, "preview");
    assert.equal(state.model.status, "playing");
    assert.equal(state.model.openedFrom, "fileOpenEvent");
    assert.equal(nodes.runtimeMount.dataset.runtimePreviewState, "loaded");
    assert.notEqual(state.view, "launch");
    assert.equal(runtimeEvents.includes("lottie:destroy"), false);
    assert.doesNotMatch(JSON.stringify(state.model), /auto-svga-first-launch-open|\/Users|C:\\/i);
  } finally {
    globalThis.document = originalDocument;
    globalThis.lottie = originalLottie;
    await rm(sessionRoot, { recursive: true, force: true });
  }
});

test("0.2 installed file-open keeps source identity through renderer playback and VAP fusion replacement", async () => {
  const { createMultiFormatDesktopPreviewController } = await import(pathToFileURL(path.join(experimentRoot, "web/multiformat-desktop-preview-controller.mjs")).href);
  const sessionRoot = await mkdtemp(path.join(os.tmpdir(), "auto-svga-file-open-renderer-"));
  const session = createMultiFormatDesktopPreviewSession({
    repoRoot,
    sessionRoot,
    sourceStore: new Map(),
    openTimeoutMs: 1000
  });
  const lottiePath = path.join(sessionRoot, "renderer-lottie.json");
  const lottieImagePath = path.join(sessionRoot, "images", "avatar.png");
  const vapPath = path.join(sessionRoot, "renderer-vap.mp4");
  const vapSidecarPath = path.join(sessionRoot, "renderer-vap.json");
  const vapFusionPath = path.join(sessionRoot, "renderer-vap-fusion.mp4");
  const vapFusionSidecarPath = path.join(sessionRoot, "renderer-vap-fusion.json");
  const originalDocument = globalThis.document;
  const originalLottie = globalThis.lottie;
  const originalVap = globalThis.Vap;
  const originalUrl = globalThis.URL;
  const nodes = createMultiFormatControllerTestNodes();
  const lottieCalls = [];
  const vapCalls = [];
  const vapVideos = [];
  const runtimeEvents = [];
  globalThis.document = createMultiFormatControllerTestDocument(nodes);
  globalThis.lottie = {
    loadAnimation(options) {
      lottieCalls.push(options);
      return {
        play() { runtimeEvents.push("lottie:play"); },
        pause() { runtimeEvents.push("lottie:pause"); },
        destroy() { runtimeEvents.push("lottie:destroy"); },
        goToAndStop() { runtimeEvents.push("lottie:seek"); }
      };
    }
  };
  globalThis.Vap = {
    canWebGL() {
      return true;
    },
    default(options) {
      vapCalls.push(options);
      const video = new FakeDomElement("video");
      vapVideos.push(video);
      options.container?.appendChild?.(video);
      return {
        video,
        on() { return this; },
        play() { runtimeEvents.push("vap:play"); return this; },
        pause() { runtimeEvents.push("vap:pause"); },
        destroy() { runtimeEvents.push("vap:destroy"); },
        setTime() { runtimeEvents.push("vap:seek"); }
      };
    }
  };
  globalThis.URL = {
    createObjectURL() {
      return `blob:file-open-${vapCalls.length + 1}`;
    },
    revokeObjectURL() {
      runtimeEvents.push("vap:revoke");
    }
  };

  try {
    await mkdir(path.dirname(lottieImagePath), { recursive: true });
    await writeFile(lottieImagePath, new Uint8Array([0x89, 0x50, 0x4e, 0x47, 1, 2, 3, 4]));
    await writeFile(lottiePath, JSON.stringify({
      v: "5.7.4",
      w: 120,
      h: 160,
      fr: 30,
      ip: 0,
      op: 30,
      layers: [
        {
          ind: 1,
          ty: 5,
          nm: "Foreground title",
          t: { d: { k: [{ s: { t: "Task-owned Lottie" } }] } }
        },
        {
          ind: 2,
          ty: 2,
          nm: "Avatar image",
          refId: "avatar"
        }
      ],
      assets: [{ id: "avatar", w: 24, h: 24, u: "images/", p: "avatar.png" }]
    }));
    await writeFile(vapPath, createSyntheticVapMp4WithoutEmbeddedVapcBytes());
    await writeFile(vapSidecarPath, JSON.stringify(createSyntheticVapcDocument({
      info: {
        ...createSyntheticVapcDocument().info,
        w: 120,
        h: 160,
        videoW: 120,
        videoH: 320,
        aFrame: { x: 0, y: 160, w: 120, h: 160 },
        rgbFrame: { x: 0, y: 0, w: 120, h: 160 }
      }
    })));
    await writeFile(vapFusionPath, createSyntheticVapMp4WithoutEmbeddedVapcBytes());
    await writeFile(vapFusionSidecarPath, JSON.stringify(createSyntheticVapcDocument({
      info: {
        ...createSyntheticVapcDocument().info,
        w: 120,
        h: 160,
        videoW: 120,
        videoH: 320,
        aFrame: { x: 0, y: 160, w: 120, h: 160 },
        rgbFrame: { x: 0, y: 0, w: 120, h: 160 }
      },
      src: [
        { srcId: 1, srcType: "image", srcTag: "vap_fusion_2", w: 24, h: 24, fitType: "cover" },
        { srcId: 2, srcType: "image", srcTag: "badge", w: 20, h: 20, fitType: "cover" },
        { srcId: 3, srcType: "text", srcTag: "title" }
      ],
      frame: [{
        i: 0,
        obj: [
          {
            srcId: 1,
            z: 1,
            frame: { x: 8, y: 8, w: 24, h: 24 },
            mFrame: { x: 0, y: 0, w: 24, h: 24 },
            mt: 0
          },
          {
            srcId: 2,
            z: 2,
            frame: { x: 36, y: 8, w: 20, h: 20 },
            mFrame: { x: 24, y: 0, w: 20, h: 20 },
            mt: 0
          },
          {
            srcId: 3,
            z: 3,
            frame: { x: 60, y: 8, w: 56, h: 24 },
            mFrame: { x: 44, y: 0, w: 56, h: 24 },
            mt: 0
          }
        ]
      }]
    })));

    const state = {
      view: "launch",
      mode: "preview",
      tab: "overview",
      appearance: "light",
      primaryPlaybackLooping: true,
      textPreviewValues: {}
    };
    const bridge = createSessionBackedMultiFormatRuntimeMountTestBridge(session);
    const controller = createMultiFormatDesktopPreviewController({ bridge, nodes, state });
    controller.initialize();

    assert.equal(controller.handlers.beginHostFileOpen({ eventId: "installed-lottie" }), true);
    const lottie = await session.openLocalFilePath(lottiePath, "fileOpenEvent");
    assert.equal(await controller.handlers.completeHostFileOpen({ eventId: "installed-lottie", result: lottie }), true);
    await flushRuntimeMountPromises();
    assert.equal(state.model.status, "playing");
    assert.equal(state.model.openedFrom, "fileOpenEvent");
    assert.equal(state.model.rightPanel.lottieTexts.length, 1);
    assert.equal(state.model.rightPanel.assets.some((asset) => asset.id === "avatar" && asset.replaceable), true);
    assert.equal(state.model.rightPanel.assetInventory.summary.imageCount > 0, true);
    assert.equal(state.model.rightPanel.assetInventory.summary.textCount > 0, true);
    assert.equal(lottieCalls.length, 1);
    assert.match(lottieCalls[0].animationData.assets[0].p, /^data:image\/png;base64,/);
    assert.equal(lottieCalls[0].animationData.assets[0].u, "");
    assert.equal(nodes.runtimeMount.dataset.runtimePreviewState, "loaded");
    assert.equal(runtimeEvents.includes("lottie:play"), true);

    await controller.handlers.togglePrimaryPlayback();
    await flushRuntimeMountPromises();
    assert.equal(state.model.status, "paused");
    assert.equal(nodes.runtimeMount.dataset.runtimePreviewState, "loaded");
    await controller.handlers.togglePrimaryPlayback();
    await flushRuntimeMountPromises();
    assert.equal(state.model.status, "playing");
    assert.equal(nodes.runtimeMount.dataset.runtimePreviewState, "loaded");

    assert.equal(controller.handlers.beginHostFileOpen({ eventId: "installed-vap" }), true);
    const vap = await session.openLocalFilePath(vapPath, "fileOpenEvent");
    assert.equal(await controller.handlers.completeHostFileOpen({ eventId: "installed-vap", result: vap }), true);
    await flushRuntimeMountPromises();
    assert.equal(state.model.status, "playing");
    assert.equal(state.model.detectedFormat, "vap");
    assert.equal(state.model.rightPanel.facts.some((fact) => fact.id === "format" && fact.value === "VAP"), true);
    assert.equal(vapCalls.length > 0, true);
    assert.equal(nodes.runtimeMount.dataset.runtimePreviewState, "loaded");
    assert.equal(runtimeEvents.includes("vap:play"), true);
    const vapPreviewPlayCount = runtimeEvents.filter((event) => event === "vap:play").length;
    vapVideos.at(-1)?.dispatchEvent("canplay");
    await flushRuntimeMountPromises();
    assert.equal(runtimeEvents.filter((event) => event === "vap:play").length > vapPreviewPlayCount, true);
    const vapOpenCallCount = vapCalls.length;
    await controller.handlers.togglePrimaryPlayback();
    await flushRuntimeMountPromises();
    assert.equal(state.model.status, "paused");
    assert.equal(vapCalls.length, vapOpenCallCount);
    await controller.handlers.togglePrimaryPlayback();
    await flushRuntimeMountPromises();
    assert.equal(state.model.status, "playing");
    assert.equal(vapCalls.length, vapOpenCallCount);
    assert.equal(runtimeEvents.filter((event) => event === "vap:destroy").length, 0);

    assert.equal(controller.handlers.beginHostFileOpen({ eventId: "installed-vap-fusion" }), true);
    const vapFusion = await session.openLocalFilePath(vapFusionPath, "fileOpenEvent");
    assert.equal(await controller.handlers.completeHostFileOpen({ eventId: "installed-vap-fusion", result: vapFusion }), true);
    await flushRuntimeMountPromises();
    assert.equal(state.model.status, "playing");
    assert.equal(state.model.rightPanel.vapFusionTexts.some((entry) => entry.srcTag === "title"), true);
    assert.equal(state.model.rightPanel.vapFusionImages.some((entry) => entry.srcTag === "badge"), true);
    assert.equal(state.model.rightPanel.issues.some((entry) =>
      entry.code === "missing_resource"
      && entry.message === "预览所需资源缺失。"
      && entry.pathRedacted === true
    ), true);
    assert.equal(nodes.runtimeMount.dataset.runtimePreviewState, "loaded");
    const vapFusionBaseCallCount = vapCalls.length;
    controller.handlers.selectImageKey("vap_fusion_2");
    assert.equal(state.selectedImageKey, "vap_fusion_2");
    await controller.handlers.applyReplacementFile({
      type: "image/png",
      async arrayBuffer() {
        return Uint8Array.from(atob("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAAAAAA6fptVAAAACklEQVR42mP8z8AABQMBgF7gywAAAABJRU5ErkJggg=="), (char) => char.charCodeAt(0)).buffer;
      }
    });
    await flushRuntimeMountPromises();
    assert.equal(state.model.status, "previewReady");
    assert.equal(vapCalls.length, vapFusionBaseCallCount + 1);
    assert.match(vapCalls.at(-1).badge, /^data:image\/png;base64,/);
    assert.equal(vapCalls.at(-1).vap_fusion_2, undefined);
    assert.equal(state.model.replacement.dirty, true);
    assert.equal(nodes.runtimeMount.dataset.runtimePreviewState, "loaded");
    await controller.handlers.resetImageReplacement();
    await flushRuntimeMountPromises();
    assert.equal(state.model.status, "previewReady");
    assert.equal(state.model.replacement.dirty, false);
    assert.equal(vapCalls.length, vapFusionBaseCallCount + 2);
    assert.equal(vapCalls.at(-1).badge, undefined);
    assert.equal(nodes.runtimeMount.dataset.runtimePreviewState, "loaded");
    const vapFusionAfterImageResetCallCount = vapCalls.length;
    assert.equal(state.selectedTextKey, "vap_fusion_3");
    controller.handlers.updateRuntimeText(state.selectedTextKey, "Runtime VAP title");
    await flushRuntimeMountPromises();
    assert.equal(state.model.status, "previewReady");
    assert.equal(vapCalls.length, vapFusionAfterImageResetCallCount + 1);
    assert.equal(vapCalls.at(-1).title, "Runtime VAP title");
    assert.equal(nodes.runtimeMount.dataset.runtimePreviewState, "loaded");
    await controller.handlers.resetRuntimeText();
    await flushRuntimeMountPromises();
    assert.equal(state.model.status, "previewReady");
    assert.equal(state.model.replacement.dirty, false);
    assert.equal(vapCalls.length, vapFusionAfterImageResetCallCount + 2);
    assert.equal(nodes.runtimeMount.dataset.runtimePreviewState, "loaded");

    assert.doesNotMatch(JSON.stringify(state.model), /auto-svga-file-open-renderer|\/Users|C:\\/i);
    assert.equal(runtimeEvents.includes("lottie:play"), true);
    assert.equal(runtimeEvents.includes("vap:play"), true);
  } finally {
    globalThis.document = originalDocument;
    globalThis.lottie = originalLottie;
    globalThis.Vap = originalVap;
    globalThis.URL = originalUrl;
    await rm(sessionRoot, { recursive: true, force: true });
  }
});

test("VAP real-runtime proofs require canonical replacement authority without public-id fallback", () => {
  const proofSources = [
    "run-vap-fusion-replacement-pixel-proof.cjs",
    "run-multiformat-real-vap-runtime-proof.cjs",
    "run-multiformat-real-rendering-matrix-proof.cjs"
  ].map((fileName) => readFileSync(path.join(experimentRoot, `scripts/${fileName}`), "utf8"));
  const [proofSource] = proofSources;
  assert.match(proofSource, /sourceReadiness\.ready\.instanceCount === 1/);
  assert.match(proofSource, /textReadiness\.ready\.instanceCount === 2/);
  assert.match(proofSource, /replacementReadiness\.ready\.instanceCount === 3/);
  assert.match(proofSource, /textResetReadiness\.ready\.instanceCount === 4/);
  assert.match(proofSource, /resetReadiness\.ready\.instanceCount === 5/);
  assert.match(proofSource, /replacementReadiness\.ready\.hasAvatarOption/);
  assert.match(proofSource, /sourceIds\.includes\("avatar"\)/);
  assert.match(proofSource, /textureIds\.includes\("avatar"\)/);
  assert.match(proofSource, /avatarTextureIndex > 0/);
  assert.match(proofSource, /frame\.seekedEvents > 0/);
  assert.match(proofSource, /frame\.videoFrameCallbacks > 0/);
  assert.match(proofSource, /sourceFrame\.sha256 !== replacementFrame\.sha256/);
  assert.match(proofSource, /sourceFrame\.sha256 === resetFrame\.sha256/);
  assert.match(proofSource, /replacementFrame\.sha256 === replacementPausedFrame\.sha256/);
  for (const source of proofSources) {
    assert.match(source, /selectionBeforeRead = await previewSession\.resolveReplacementSelection\(\{ targetId, kind: "image" \}\)/);
    assert.match(source, /selectionAfterRead = await previewSession\.resolveReplacementSelection\(\{ targetId, kind: "image" \}\)/);
    assert.match(source, /selectionAfterRead\.bindingToken !== selectionBeforeRead\.bindingToken/);
    assert.match(source, /acceptedRuntimeTargetId !== selectionAfterRead\.runtimeTargetId/);
    assert.match(source, /targetId: acceptedRuntimeTargetId/);
    assert.doesNotMatch(source, /replacementRuntimeValue:\s*\{\s*kind: "image",\s*targetId,\s*value: dataUri/);
  }
  assert.match(proofSource, /waitForBalancedLifecycle\(5\)/);
});

test("multi-format runtime self-test writes bootstrap diagnostics before Electron initialization", () => {
  const proofSource = readFileSync(
    path.join(experimentRoot, "scripts/run-multiformat-runtime-selftest.cjs"),
    "utf8"
  );
  const entrypointIndex = proofSource.indexOf('writeBootstrapPhase("entrypoint_loaded")');
  const requireBeginIndex = proofSource.indexOf('writeBootstrapPhase("electron_require_begin")');
  const electronRequireIndex = proofSource.indexOf('require("electron")');
  const electronRequiredIndex = proofSource.indexOf('writeBootstrapPhase("electron_required")');
  assert.ok(entrypointIndex >= 0 && entrypointIndex < requireBeginIndex);
  assert.ok(requireBeginIndex >= 0 && requireBeginIndex < electronRequireIndex);
  assert.ok(electronRequireIndex >= 0 && electronRequireIndex < electronRequiredIndex);
  assert.match(proofSource, /if \(!electronApi\?\.app\?\.commandLine\) \{\s*bootstrapElectronProcess\(electronApi\);\s*\}/u);
  assert.match(proofSource, /execFileSync\(electronApiValue, \[__filename, \.\.\.process\.argv\.slice\(2\)\]/u);
  assert.match(proofSource, /AUTO_SVGA_MULTIFORMAT_RUNTIME_SELFTEST_ELECTRON/u);
  assert.match(proofSource, /electron_reexec_begin/u);
  assert.match(proofSource, /runtime-selftest-bootstrap-phases\.jsonl/u);
  assert.match(proofSource, /runtime-selftest-bootstrap-failure\.json/u);
  assert.match(proofSource, /installBootstrapFailureGuards\(\)/u);
  assert.doesNotMatch(proofSource, /\/Users\/huangtengxin/u);
});

test("multi-format runtime self-test uses the owner replacement path for each format", () => {
  const proofSource = readFileSync(
    path.join(experimentRoot, "scripts/run-multiformat-runtime-selftest.cjs"),
    "utf8"
  );
  const applyStart = proofSource.indexOf("async function applyOwnerVisibleImageReplacement");
  const applyEnd = proofSource.indexOf("async function setRuntimeText", applyStart);
  assert.notEqual(applyStart, -1, "runtime self-test must define one format-aware replacement action");
  assert.notEqual(applyEnd, -1, "runtime self-test replacement action must have a bounded source range");
  const applySource = proofSource.slice(applyStart, applyEnd);
  assert.match(applySource, /input\.format === "svga"[\s\S]*applyRendererReplacementFile/u);
  assert.match(applySource, /selectRendererImageTarget\(input\.imageTarget\)/u);
  assert.match(applySource, /clickOwnerVisibleReplaceButton\(input\.imageTarget\)/u);
  assert.match(applySource, /actions\.applyReplacementFile\(file\)/u);
  assert.match(applySource, /\.replaceImageButton\[data-image-key=/u);
  assert.match(proofSource, /createLottieMotionProofLayer\(\)/u);
  assert.match(proofSource, /Runtime self-test motion proof/u);
  assert.match(proofSource, /backgroundThrottling:\s*false/u);
  assert.match(proofSource, /markupSha256/u);
  assert.match(proofSource, /webgl-backing-store/u);
  assert.match(proofSource, /refreshRuntimePreviewFrame/u);
  const bridgeSource = readFileSync(
    path.join(experimentRoot, "web/short-term-macos-action-bridge.mjs"),
    "utf8"
  );
  assert.match(bridgeSource, /selectImageKey:\s*handlers\.selectImageKey/u);
  assert.match(bridgeSource, /applyReplacementFile:\s*handlers\.applyReplacementFile/u);
  assert.match(bridgeSource, /selectTextKey:\s*handlers\.selectTextKey/u);
  assert.match(bridgeSource, /updateTextPreview:\s*handlers\.updateRuntimeText/u);
  assert.match(bridgeSource, /currentStateSummary:\s*handlers\.currentStateSummary/u);
  assert.match(bridgeSource, /refreshRuntimePreviewFrame:\s*handlers\.refreshRuntimePreviewFrame/u);
  assert.match(proofSource, /actions\.updateTextPreview\(/u);
  assert.match(proofSource, /actions\.resetTextPreview\(/u);
  assert.match(proofSource, /snapshot\.summaryText\?\.includes\("未保存输出："\)/u);
});

test("VAP pixel proof requires target-scoped sibling isolation and source restoration", () => {
  const proofSource = readFileSync(
    path.join(experimentRoot, "scripts/run-vap-fusion-replacement-pixel-proof.cjs"),
    "utf8"
  );
  assert.match(proofSource, /resetTextPreview\(\$\{JSON\.stringify\(textTargetId\)\}\)/u);
  assert.match(proofSource, /active\[0\]\?\.targetId === "avatar"/u);
  assert.match(proofSource, /textResetReadiness\.ready\.hasAvatarOption/u);
  assert.match(proofSource, /!textResetReadiness\.ready\.hasTitleOption/u);
  assert.match(proofSource, /sourceFrame\.sha256 !== textResetFrame\.sha256/u);
  assert.match(proofSource, /replacementFrame\.sha256 !== textResetFrame\.sha256/u);
  assert.match(proofSource, /resetImageReplacement\(\$\{JSON\.stringify\(imageTargetId\)\}\)/u);
  assert.match(proofSource, /sourceFrame\.sha256 === resetFrame\.sha256/u);
  assert.match(proofSource, /waitForBalancedLifecycle\(5\)/u);
  assert.match(proofSource, /phase: "apply_replacement_binding_accepted"/u);
  assert.match(proofSource, /phase: "reset_binding_accepted"/u);
  assert.match(proofSource, /resetReceipt\.type !== "resetReplacement"/u);
  assert.match(proofSource, /acceptedPublicTargetId !== selection\.publicTargetId/u);
  assert.match(proofSource, /acceptedRuntimeTargetId !== selection\.runtimeTargetId/u);
  assert.match(proofSource, /acceptedBindingToken !== selection\.bindingToken/u);
});

test("server uses bounded internal-trial CSP and keeps report API token-bound", async () => {
  assert.match(strictCsp, /script-src 'self'/);
  assert.match(strictCsp, /wasm-unsafe-eval/);
  assert.doesNotMatch(strictCsp, /(?<!wasm-)unsafe-eval/);
  assert.match(strictCsp, /worker-src 'self' blob:/);
  assert.match(strictCsp, /connect-src 'self' blob:/);
  assert.match(legacyBrowserBaselineAuditCsp, /unsafe-eval/);
  const reportToken = "test-token";
  const desktopArtifactBytes = new Uint8Array([83, 86, 71, 65]);
  const server = await startSvgaWebExperimentServer({
    appRoot: experimentRoot,
    reportToken,
    desktopArtifacts: {
      readArtifact(publicPath) {
        if (publicPath !== "/desktop-artifact/0123456789abcdef01234567/fixture.svga") return undefined;
        return {
          bytes: desktopArtifactBytes,
          mimeType: "application/octet-stream",
          sizeBytes: desktopArtifactBytes.byteLength
        };
      }
    }
  });
  try {
    const health = await fetch(`${server.origin}/health`).then((response) => response.json());
    assert.deepEqual(health, {
      status: "ok",
      runtime: "auto-svga-desktop-preview",
      prototypeLabel: "Auto SVGA Desktop Preview; internal prototype, not production"
    });
    const unauthorized = await fetch(`${server.origin}/api/avatar-frame-inspection-report`, { method: "POST" });
    assert.equal(unauthorized.status, 401);
    const page = await fetch(`${server.origin}/`).then((response) => response.text());
    assert.match(page, /<title>Auto SVGA<\/title>/);
    assert.match(page, /data-app-state="launch"/);
    assert.match(page, /short-term-macos-app\.mjs/);
    assert.match(page, /short-term-macos\.tokens\.css/);
    assert.match(page, /short-term-macos\.css/);
    assert.match(page, /覆盖保存/);
    assert.doesNotMatch(page, /productShellMount/);
    assert.doesNotMatch(page, /desktop-product-entry\.mjs/);
    assert.doesNotMatch(page, /prototype\.js/);
    assert.doesNotMatch(page, /brandMark/);
    assert.doesNotMatch(page, /cdn\.jsdelivr|(?<!wasm-)unsafe-eval/);
    const workbenchPage = await fetch(`${server.origin}/workbench.html`).then((response) => response.text());
    assert.match(workbenchPage, /productShellMount/);
    assert.match(workbenchPage, /desktop-product-entry\.mjs/);
    const lottieRuntime = await fetch(`${server.origin}/runtime-node-modules/lottie-web/build/player/lottie_svg.js`).then((response) => response.text());
    assert.match(lottieRuntime, /global\.lottie = factory\(\)/);
    const vapRuntime = await fetch(`${server.origin}/runtime-node-modules/video-animation-player/dist/vap.js`).then((response) => response.text());
    assert.match(vapRuntime, /factory\(global\.Vap = \{\}\)/);
    const sharedShell = await fetch(`${server.origin}/tools/shared/product-frontend/product-shell.html`).then((response) => response.text());
    assert.match(sharedShell, /brandMark/);
    assert.match(sharedShell, /本地预览/);
    const sharedTokens = await fetch(`${server.origin}/tools/shared/product-tokens.css`);
    assert.equal(sharedTokens.status, 200);
    const missingAuditSample = await fetch(`${server.origin}/audit-samples/missing.svga`);
    assert.equal(missingAuditSample.status, 404);
    const desktopArtifact = await fetch(`${server.origin}/desktop-artifact/0123456789abcdef01234567/fixture.svga`);
    assert.equal(desktopArtifact.status, 200);
    assert.equal(desktopArtifact.headers.get("content-type"), "application/octet-stream");
    assert.equal(await desktopArtifact.text(), "SVGA");
    const missingDesktopArtifact = await fetch(`${server.origin}/desktop-artifact/0123456789abcdef01234567/missing.svga`);
    assert.equal(missingDesktopArtifact.status, 404);
    const legacyVendor = await fetch(`${server.origin}/legacy-vendor/pako-2.1.0.min.js`);
    assert.equal(legacyVendor.status, 200);
    assert.match(legacyVendor.headers.get("content-type") ?? "", /text\/javascript/);
  } finally {
    await server.close();
  }
});

test("server exposes a token-bound safe SVGA image optimizer API", async () => {
  const reportToken = "optimizer-token";
  const sourceBytes = await createOptimizerFixture();
  const sourceSha256 = createHash("sha256").update(sourceBytes).digest("hex");
  const server = await startSvgaWebExperimentServer({
    appRoot: experimentRoot,
    reportToken
  });
  try {
    const unauthorized = await fetch(`${server.origin}/api/svga-image-optimize`, { method: "POST" });
    assert.equal(unauthorized.status, 401);

    const response = await fetch(`${server.origin}/api/svga-image-optimize`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-auto-svga-prototype-token": reportToken
      },
      body: JSON.stringify({
        name: "avatar-frame-smoke.svga",
        svgaBase64: sourceBytes.toString("base64")
      })
    });
    assert.equal(response.status, 200);
    const body = await response.json();
    const optimizedBytes = Buffer.from(body.optimizedSvgaBase64, "base64");

    assert.equal(body.optimizationReport.schemaVersion, 1);
    assert.equal(body.optimizationReport.optimizationId, "svga-safe-image-optimizer-v1");
    assert.equal(body.optimizationReport.sourceSha256, sourceSha256);
    assert.equal(body.optimizationReport.sourceSha256AfterOptimization, sourceSha256);
    assert.equal(body.optimizationReport.optimizedSha256, createHash("sha256").update(optimizedBytes).digest("hex"));
    assert.equal(body.optimizationReport.sourceUnchanged, true);
    assert.equal(body.optimizationReport.saveAsRequired, true);
    assert.equal(body.optimizationReport.passed, true);
    assert.equal(body.optimizationReport.originalImageCount, 3);
    assert.equal(body.optimizationReport.optimizedImageCount, 1);
    assert.deepEqual(body.optimizationReport.removedResourceKeys, ["img_copy", "img_unused"]);
    assert.equal(body.optimizationReport.invariantChecks.every(({ passed }) => passed), true);
  } finally {
    await server.close();
  }
});

test("server exposes a token-bound read-only SVGA image edit session API", async () => {
  const reportToken = "edit-session-token";
  const sourceBytes = await createOptimizerFixture();
  const sourceSha256 = createHash("sha256").update(sourceBytes).digest("hex");
  const server = await startSvgaWebExperimentServer({
    appRoot: experimentRoot,
    reportToken
  });
  try {
    const unauthorized = await fetch(`${server.origin}/api/svga-image-edit-session`, { method: "POST" });
    assert.equal(unauthorized.status, 401);

    const response = await fetch(`${server.origin}/api/svga-image-edit-session`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-auto-svga-prototype-token": reportToken
      },
      body: JSON.stringify({
        name: "../unsafe-name.svga",
        svgaBase64: sourceBytes.toString("base64")
      })
    });
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.session.sourceFile.name, "unsafe-name.svga");
    assert.equal(body.session.sourceFile.sha256, sourceSha256);
    assert.equal(body.session.dirty, false);
    assert.equal(body.session.exportState, "idle");
    assert.deepEqual(
      body.session.imageResources.map((resource) => resource.resourceKey),
      ["img_base", "img_copy", "img_unused"]
    );
    assert.equal(body.session.imageResources.every((resource) => resource.replacementStatus === "original"), true);
  } finally {
    await server.close();
  }
});

test("main process keeps sandboxed Electron security settings", async () => {
  const main = await readFile(path.join(experimentRoot, "main.cjs"), "utf8");
  const preload = await readFile(path.join(experimentRoot, "preload.cjs"), "utf8");
  const desktopEntry = await readFile(path.join(experimentRoot, "web/desktop-product-entry.mjs"), "utf8");
  const prepareRuntime = await readFile(path.join(experimentRoot, "scripts/prepare-runtime.mjs"), "utf8");
  const hostContractSource = await readFile(path.join(experimentRoot, "host-adapter-contract.cjs"), "utf8");
  const productApp = await readFile(path.join(repoRoot, "tools/shared/product-frontend/product-app.mjs"), "utf8");
  const localTmpPath = ["/", "tmp", "preload.cjs"].join("");
  const localTmpFileUrl = `file://${["", "tmp", "test.svga"].join("/")}`;
  const securePreferences = hostContract.createSecureWebPreferences({
    preloadPath: localTmpPath,
    reportToken: "test-token",
    productMilestoneId: "P6"
  });
  assert.equal(securePreferences.contextIsolation, true);
  assert.equal(securePreferences.nodeIntegration, false);
  assert.equal(securePreferences.sandbox, true);
  assert.equal(securePreferences.webSecurity, true);
  assert.equal(securePreferences.allowRunningInsecureContent, false);
  assert.equal(securePreferences.spellcheck, false);
  assert.deepEqual(securePreferences.additionalArguments, [
    "--prototype-report-token=test-token",
    "--prototype-product-milestone=P6",
    "--prototype-host-boundary=formal"
  ]);
  assert.equal(hostContract.isAllowedHostUrl("http://127.0.0.1:1234/", "http://127.0.0.1:1234"), true);
  assert.equal(hostContract.isAllowedHostUrl("blob:http://127.0.0.1:1234/id", "http://127.0.0.1:1234", { allowBlob: true }), true);
  assert.equal(hostContract.isAllowedHostUrl("devtools://devtools/bundled/inspector.html", "http://127.0.0.1:1234", { allowDevtools: true }), true);
  assert.equal(hostContract.isAllowedHostUrl("https://example.com/", "http://127.0.0.1:1234"), false);
  assert.equal(hostContract.isAllowedHostUrl(localTmpFileUrl, "http://127.0.0.1:1234"), false);
  assert.equal(hostContract.isAllowedHostUrl("devtools://devtools/bundled/inspector.html", "http://127.0.0.1:1234"), false);
  assert.equal(hostContract.isExpectedSenderUrl("http://127.0.0.1:1234/index.html", "http://127.0.0.1:1234"), true);
  assert.equal(hostContract.isExpectedSenderUrl("http://127.0.0.1:4321/index.html", "http://127.0.0.1:1234"), false);
  const invocations = [];
  const preloadApi = hostContract.createPreloadApi((channel, input) => {
    invocations.push({ channel, input });
    return { channel, input };
  }, { reportToken: "test-token", productMilestoneId: "P6" });
  const shortTermInvocations = [];
  const productPreloadApi = hostContract.createProductPreloadApi((channel, input) => {
    shortTermInvocations.push({ channel, input });
    return { channel, input };
  }, {
    reportToken: "test-token",
    productMilestoneId: "short-term"
  });
  const p6ProductPreloadApi = hostContract.createProductPreloadApi(() => undefined, {
    reportToken: "test-token",
    productMilestoneId: "P6"
  });
  const aebInvocations = [];
  const aebProductPreloadApi = hostContract.createProductPreloadApi((channel, input) => {
    aebInvocations.push({ channel, input });
    return { channel, input };
  }, {
    reportToken: "test-token",
    productMilestoneId: "aeb"
  });
  assert.equal(preloadApi.hostAdapterVersion, 1);
  assert.equal(preloadApi.telemetry, "disabled");
  assert.equal(preloadApi.capabilities.arbitraryFileSystemAccess, false);
  assert.equal(preloadApi.capabilities.shellAccess, false);
  assert.equal(preloadApi.capabilities.referenceMediaOpen, "host-dialog-mp4-webm-gif-only");
  assert.equal(preloadApi.capabilities.recentFiles, "host-user-data-redacted");
  assert.equal(preloadApi.capabilities.clipboardWrite, "host-clipboard-write-text-only");
  assert.equal(preloadApi.capabilities.finderDocumentAssociation, "not-declared");
  assert.equal(preloadApi.capabilities.overwriteSave, "host-source-path-from-file-picker-only");
  assert.deepEqual(preloadApi.capabilities.documentTypes, ["svga"]);
  assert.equal("referenceMediaOpen" in productPreloadApi.capabilities, false);
  assert.equal("sequenceRepairSaveAs" in productPreloadApi.capabilities, false);
  assert.equal("scanLatestArtifacts" in productPreloadApi, false);
  assert.equal("openReferenceMediaFile" in productPreloadApi, false);
  assert.equal("captureArtifact" in productPreloadApi, false);
  assert.equal("performSmokeInput" in productPreloadApi, false);
  assert.equal("reportSmokeResult" in productPreloadApi, false);
  assert.equal("reportAuditResult" in productPreloadApi, false);
  assert.equal("reportNormalProofResult" in productPreloadApi, false);
  assert.equal("saveSequenceRepairSvga" in productPreloadApi, false);
  assert.equal("saveEditedSvga" in productPreloadApi, false);
  assert.equal("saveOptimizedSvga" in productPreloadApi, false);
  assert.equal("reportP4EditResult" in productPreloadApi, false);
  assert.equal(typeof productPreloadApi.saveShortTermSvgaOutput, "function");
  assert.equal(typeof productPreloadApi.updateShortTermMenuState, "function");
  assert.equal(typeof productPreloadApi.setShortTermWindowMode, "function");
  assert.equal(typeof p6ProductPreloadApi.saveSequenceRepairSvga, "function");
  assert.equal(typeof p6ProductPreloadApi.reportP4EditResult, "function");
  assert.equal(typeof preloadApi.saveSequenceRepairSvga, "function");
  assert.equal(typeof preloadApi.saveEditedSvga, "function");
  assert.equal(typeof preloadApi.saveOptimizedSvga, "function");
  assert.equal(typeof preloadApi.reportP4EditResult, "function");
  assert.equal(preloadApi.openSvgaFile().channel, hostContract.IPC_CHANNELS.openSvgaFile);
  assert.equal(preloadApi.openReferenceMediaFile().channel, hostContract.IPC_CHANNELS.openReferenceMediaFile);
  assert.equal(preloadApi.getRecentSvgaFiles().channel, hostContract.IPC_CHANNELS.getRecentSvgaFiles);
  assert.equal(preloadApi.openRecentSvgaFile("recent-id").channel, hostContract.IPC_CHANNELS.openRecentSvgaFile);
  assert.equal(preloadApi.clearRecentSvgaFiles().channel, hostContract.IPC_CHANNELS.clearRecentSvgaFiles);
  assert.equal(preloadApi.scanLatestArtifacts().channel, hostContract.IPC_CHANNELS.scanLatestArtifacts);
  assert.equal(preloadApi.writeClipboardText("logs").channel, hostContract.IPC_CHANNELS.writeClipboardText);
  assert.equal(preloadApi.updateShortTermMenuState({ hasFile: true }).channel, hostContract.IPC_CHANNELS.updateShortTermMenuState);
  assert.equal(preloadApi.saveEditedSvga({ bytesBase64: "AA==" }).channel, hostContract.IPC_CHANNELS.saveEditedSvga);
  assert.equal(preloadApi.saveOptimizedSvga({ bytesBase64: "AA==" }).channel, hostContract.IPC_CHANNELS.saveOptimizedSvga);
  assert.equal(productPreloadApi.updateShortTermMenuState({ hasFile: true }).channel, hostContract.IPC_CHANNELS.updateShortTermMenuState);
  assert.equal(productPreloadApi.setShortTermWindowMode("launch").channel, hostContract.IPC_CHANNELS.setShortTermWindowMode);
  assert.equal(productPreloadApi.saveShortTermSvgaOutput({ bytesBase64: "AA==" }).channel, hostContract.IPC_CHANNELS.saveShortTermSvgaOutput);
  assert.equal(aebProductPreloadApi.getAebIntakeReport().channel, hostContract.IPC_CHANNELS.getAebIntakeReport);
  assert.equal(hostContract.IPC_CHANNELS.saveOptimizedSvga, "svga-web-experiment:save-optimized-svga");
  assert.equal(invocations.length, 10);
  assert.equal(shortTermInvocations.length, 3);
  assert.equal(aebInvocations.length, 1);
  assert.equal(hostContract.ELECTRON_HOST_BRIDGE_NAME, "autoSvgaElectronHost");
  assert.equal(hostContract.LEGACY_PROTOTYPE_BRIDGE_NAME, "autoSvgaPrototype");
  assert.match(preload, /createProductPreloadApi/);
  assert.match(preload, /createLegacyPrototypePreloadApi/);
  assert.match(hostContractSource, /createProductPreloadApi/);
  assert.match(hostContractSource, /createLegacyPrototypePreloadApi/);
  assert.throws(
    () => hostContract.rejectFormalShortTermHostCapability("short-term", "formal", "saveEditedSvga"),
    /Formal short-term product runtime cannot use saveEditedSvga/
  );
  assert.doesNotThrow(() => hostContract.rejectFormalShortTermHostCapability("short-term", "proof", "captureArtifact"));
  assert.throws(
    () => hostContract.rejectAebProductCapability("aeb", "saveEditedSvga"),
    /AEB product surface cannot use saveEditedSvga/
  );
  const hostOpenReturn = main.match(/function openSvgaFileBytes[\s\S]*?\n}\n\nasync function openSvgaFile/)?.[0] ?? "";
  const referenceOpenReturn = main.match(/function openReferenceMediaFileBytes[\s\S]*?\n}\n\nasync function openSvgaFile/)?.[0] ?? "";
  assert.match(main, /createSecureWebPreferences/);
  assert.match(main, /isAllowedHostUrl/);
  assert.match(main, /isExpectedSenderUrl/);
  assert.match(main, /productSmokeMode/);
  assert.match(main, /hostBoundaryMode/);
  assert.match(main, /rejectFormalShortTermHostCapability\(productMilestoneId, hostBoundaryMode, "saveEditedSvga"\)/);
  assert.match(main, /rejectFormalShortTermHostCapability\(productMilestoneId, hostBoundaryMode, "scanLatestArtifacts"\)/);
  assert.match(main, /rejectFormalShortTermHostCapability\(productMilestoneId, hostBoundaryMode, "openReferenceMediaFile"\)/);
  assert.match(main, /rejectFormalShortTermHostCapability\(productMilestoneId, hostBoundaryMode, "captureArtifact"\)/);
  assert.match(main, /captureProductArtifact/);
  assert.match(main, /function validateOptimizedSvgaSaveInput/);
  assert.match(main, /function validateOptimizationReportBinding/);
  assert.match(main, /function validateOptimizedReopenProof/);
  assert.match(main, /function validateSequenceReviewProof/);
  assert.match(main, /function validateSequenceRepairPreviewProof/);
  assert.match(main, /function validateSequenceNoWriteSimulationProof/);
  assert.match(main, /function validateSequenceBoundedRepairPrototypeProof/);
  assert.match(main, /function validateSequencePrototypeRenderedBoundaryProof/);
  assert.match(main, /function validateSequenceNoopRoundTripProof/);
  assert.match(main, /validateSequenceByteRepairProof/);
  assert.match(main, /function validateReplacementReadinessProof/);
  assert.match(main, /function validateReplacementPreviewProof/);
  assert.match(main, /function validateReplacementUndoRedoProof/);
  assert.match(main, /function validateReplacementResetProof/);
  assert.match(main, /function validateReplacementMultiResourceProof/);
  assert.match(main, /function validateReplacementSaveAsProof/);
  assert.match(main, /function saveOptimizedSvga/);
  assert.match(main, /optimizedReopenProof/);
  assert.match(main, /sequenceReviewProof/);
  assert.match(main, /sequenceRepairPreviewProof/);
  assert.match(main, /sequenceNoWriteSimulationProof/);
  assert.match(main, /sequenceBoundedRepairPrototypeProof/);
  assert.match(main, /sequencePrototypeRenderedBoundaryProof/);
  assert.match(main, /sequenceNoopRoundTripProof/);
  assert.match(main, /sequenceByteRepairProof/);
  assert.match(main, /replacementReadinessProof/);
  assert.match(main, /replacementPreviewProof/);
  assert.match(main, /replacementUndoRedoProof/);
  assert.match(main, /replacementResetProof/);
  assert.match(main, /replacementSaveAsProof/);
  assert.match(main, /replacementMultiResourceProof/);
  assert.match(main, /Optimized Save As requires the source SVGA to be opened through the desktop file picker/);
  assert.match(desktopEntry, /\/api\/svga-image-optimize/);
  assert.match(desktopEntry, /\/api\/svga-image-edit-session/);
  assert.match(desktopEntry, /\/api\/svga-image-replace/);
  assert.match(productApp, /runReplacementReadinessProof/);
  assert.match(productApp, /runSequenceReviewProof/);
  assert.match(productApp, /runSequenceRepairPreviewContractProof/);
  assert.match(productApp, /runSequenceNoWriteSimulationProof/);
  assert.match(productApp, /runSequenceBoundedRepairPrototypeProof/);
  assert.match(productApp, /runSequencePrototypeRenderedBoundaryProof/);
  assert.match(productApp, /runSequenceNoopRoundTripProof/);
  assert.match(productApp, /runSequenceByteRepairCandidateProof/);
  assert.match(productApp, /runSingleReplacementPreviewProof/);
  assert.match(productApp, /runReplacementUndoRedoProof/);
  assert.match(productApp, /runMultiReplacementWorkbenchProof/);
  assert.match(productApp, /runReplacementSaveAsProof/);
  assert.match(productApp, /data-save-optimized-svga/);
  assert.match(productApp, /saveOptimizedPrimarySvga/);
  assert.match(productApp, /autoSvgaSourceId/);
  assert.match(main, /desktop-sequence-review-proof/);
  assert.match(main, /desktop-sequence-repair-preview-proof/);
  assert.match(main, /desktop-sequence-no-write-simulation-proof/);
  assert.match(main, /desktop-sequence-bounded-repair-prototype-proof/);
  assert.match(main, /desktop-sequence-prototype-rendered-boundary-proof/);
  assert.match(main, /desktop-sequence-noop-round-trip-proof/);
  assert.match(main, /desktop-multi-replacement-proof/);
  assert.match(prepareRuntime, /optimizer-reopen-smoke\.svga/);
  assert.match(prepareRuntime, /replaceable-workflow-smoke\.svga/);
  assert.match(prepareRuntime, /replacement-preview-green\.png/);
  assert.match(prepareRuntime, /profile_frame/);
  assert.match(main, /validateArtifactScenario/);
  assert.match(main, /validateP6InteractionTrace/);
  assert.match(main, /\["Escape", "Space", "Enter", "Tab"\]/);
  assert.match(main, /node\.focus\?\.\(\{ preventScroll: true \}\)/);
  assert.match(main, /Product smoke keyboard target is not actionable/);
  assert.match(main, /function validateSmokeDiagnostics/);
  assert.match(main, /function validateOwnerUsabilityResult/);
  assert.match(main, /function validatePreviewCardConsistency/);
  assert.match(main, /function validatePreviewCardZoneSnapshot/);
  assert.match(main, /fileNameInTitle/);
  assert.match(main, /duplicateFilePillHidden/);
  assert.doesNotMatch(main, /filePillVisible/);
  assert.match(main, /owner-usability-smoke\.json/);
  assert.match(main, /finderDocumentAssociationNotClaimed/);
  assert.match(main, /clearCurrentFileAction/);
  assert.match(main, /enterActivatesResourceTab/);
  assert.match(main, /previewCardSingleFileConsistency/);
  assert.match(main, /diagnostics = validateSmokeDiagnostics\(value\.diagnostics\)/);
  assert.match(main, /ownerUsability = validateOwnerUsabilityResult\(value\.ownerUsability\)/);
  assert.match(main, /logPayload\.diagnostics = diagnostics/);
  assert.match(main, /desktop-interaction-trace\.source\.json/);
  assert.match(main, /p6InteractionTrace: Boolean\(p6InteractionTrace\)/);
  assert.match(main, /const productIdentity = "auto-svga"/);
  assert.match(main, /runtimeIdentity/);
  assert.match(main, /normalSmokeParity/);
  assert.match(main, /runtime-identity\.json/);
  assert.match(main, /normal-smoke-parity\.json/);
  assert.match(main, /normal-runtime-proof\.json/);
  assert.match(main, /desktop-loaded/);
  assert.match(main, /actual-normal-loaded/);
  const normalProofStart = main.indexOf("async function driveCanonicalNormalProof");
  assert.ok(normalProofStart >= 0, "normal proof driver must exist");
  const normalProofSource = main.slice(normalProofStart);
  assert.match(normalProofSource, /__autoSvgaShortTermActions/);
  assert.match(normalProofSource, /openFromHostDialog/);
  assert.match(normalProofSource, /findApplicationMenuItem\(\["文件", "打开 SVGA\.\.\."\]\)/);
  assert.match(normalProofSource, /openMenuItem\.click\(openMenuItem, window\)/);
  assert.match(normalProofSource, /menuOpen: false/);
  assert.match(normalProofSource, /result\.menuOpen = menuOpen/);
  assert.match(normalProofSource, /#primaryCanvas/);
  assert.match(normalProofSource, /#factGrid/);
  assert.match(normalProofSource, /#assetList/);
  assert.match(normalProofSource, /getRecentSvgaFiles/);
  assert.match(normalProofSource, /recentFiles/);
  assert.match(normalProofSource, /recentMissingRecovery/);
  assert.match(normalProofSource, /short-term-recent-proof/);
  assert.match(normalProofSource, /menuRecordLimit: 10/);
  assert.match(normalProofSource, /launchRecordLimit: 5/);
  assert.match(normalProofSource, /clearHistoryCompleted/);
  assert.match(normalProofSource, /launchEmptyAfterClear/);
  assert.match(normalProofSource, /missing-normal-proof\.svga/);
  assert.match(normalProofSource, /openRecentFromMenu/);
  assert.match(normalProofSource, /missingRecordRemoved/);
  assert.match(normalProofSource, /missingFeedbackVisible/);
  assert.match(normalProofSource, /short-term-save-proof/);
  assert.match(normalProofSource, /produceRenameOutput/);
  assert.match(normalProofSource, /actions\.createSaveProofOutput/);
  assert.match(normalProofSource, /actions\.saveAs\(\)/);
  assert.match(normalProofSource, /actions\.save\(\)/);
  assert.match(normalProofSource, /firstOutputSaveEnabled/);
  assert.match(normalProofSource, /overwriteReopenValidated/);
  assert.match(normalProofSource, /canonicalFixtureSha256Before/);
  assert.match(normalProofSource, /canonicalSourceUnchanged/);
  assert.match(normalProofSource, /result\.shortTermSave = result\.shortTermSaveProof\.passed === true/);
  assert.match(normalProofSource, /pathRedacted/);
  assert.ok(
    normalProofSource.indexOf("await actions.closeFile()") < normalProofSource.indexOf("await actions.clearRecentFiles()"),
    "normal proof must inspect launch recent rows before clearing history"
  );
  assert.ok(
    normalProofSource.indexOf("openMenuItem.click(openMenuItem, window)") < normalProofSource.indexOf("const result = await window.webContents.executeJavaScript"),
    "normal proof initial open must be triggered by the macOS File menu before renderer validation"
  );
  assert.ok(
    normalProofSource.indexOf("await actions.openRecentFromMenu(missingRecord.id)") < normalProofSource.indexOf("await actions.openFromHostDialog()"),
    "direct host open action is allowed only after missing-recent recovery starts"
  );
  assert.doesNotMatch(normalProofSource, /#svgaFileInput|#svgaStatusA|#svgaCanvasA|specReportSection|auditReportSection/);
  assert.match(main, /writeJsonProductArtifact\("short-term-recent-proof\.json", "short-term-recent-proof"/);
  assert.match(main, /writeJsonProductArtifact\("short-term-save-proof\.json", "short-term-save-proof"/);
  assert.match(main, /normalProofMode \? "short-term-normal-save-as\.svga" : "short-term-smoke-save-as\.svga"/);
  assert.match(main, /IPC_CHANNELS\.openSvgaFile/);
  assert.match(main, /IPC_CHANNELS\.openReferenceMediaFile/);
  assert.match(main, /IPC_CHANNELS\.scanLatestArtifacts/);
  assert.match(main, /IPC_CHANNELS\.writeClipboardText/);
  assert.match(main, /clipboard\.writeText/);
  assert.match(main, /Invalid clipboard text payload/);
  assert.match(main, /desktopArtifacts\.scan\(\)/);
  assert.match(main, /createDesktopArtifactCatalog/);
  assert.match(main, /installApplicationMenu/);
  assert.match(main, /label: "文件"/);
  assert.match(main, /label: "编辑"/);
  assert.match(main, /label: "资源"/);
  assert.match(main, /label: "优化"/);
  assert.match(main, /label: "播放"/);
  assert.match(main, /label: "视图"/);
  assert.match(main, /label: "窗口"/);
  assert.match(main, /label: "帮助"/);
  assert.match(main, /打开 SVGA\.\.\./);
  assert.match(main, /打开对比 SVGA\.\.\./);
  assert.match(main, /打开参考媒体\.\.\./);
  assert.match(main, /另存替换副本\.\.\./);
  assert.match(main, /生成优化副本\.\.\./);
  assert.doesNotMatch(main, /label: "序列"/);
  assert.doesNotMatch(main, /修复闪帧并另存\.\.\./);
  assert.doesNotMatch(main, /加载最新导出产物/);
  assert.doesNotMatch(main, /本地预览/);
  assert.doesNotMatch(main, /导出验收/);
  assert.match(main, /撤销替换预览/);
  assert.match(main, /重做替换预览/);
  assert.match(main, /重置替换预览/);
  assert.match(main, /role: "copy"/);
  assert.match(main, /role: "paste"/);
  assert.match(main, /role: "selectAll"/);
  assert.match(main, /显示资源列表/);
  assert.match(main, /替换选中资源\.\.\./);
  assert.match(main, /复制当前资源 Key/);
  assert.match(main, /活动记录/);
  assert.match(main, /设置/);
  assert.match(main, /退出 Auto SVGA/);
  assert.match(main, /invokeWorkbenchAction\("replaceSelectedResource"\)/);
  assert.match(main, /invokeWorkbenchAction\("saveOptimizedCopy"\)/);
  assert.doesNotMatch(main, /invokeWorkbenchAction\("saveSequenceRepairCopy"\)/);
  assert.doesNotMatch(main, /invokeWorkbenchAction\("loadLatestExportArtifact"\)/);
  assert.doesNotMatch(main, /invokeWorkbenchAction\("setLocalPreviewMode"\)/);
  assert.doesNotMatch(main, /invokeWorkbenchAction\("setExportReviewMode"\)/);
  assert.match(main, /invokeWorkbenchAction\("toggleLogs"\)/);
  assert.match(main, /invokeWorkbenchActionAsync\("prepareSecondaryOpen"\)/);
  assert.match(main, /invokeWorkbenchActionAsync\("prepareReferenceOpen"\)/);
  assert.match(main, /openSvgaFromHostMenu/);
  assert.match(main, /openReferenceMediaFileBytes/);
  assert.match(main, /referenceMediaTypes/);
  assert.match(main, /referenceFileIds/);
  assert.match(referenceOpenReturn, /rememberReferenceFile/);
  assert.doesNotMatch(referenceOpenReturn, /sourceFilePaths/);
  assert.match(hostOpenReturn, /openSvgaFileBytes/);
  assert.match(hostOpenReturn, /basename: path\.basename\(filePath\)/);
  assert.match(hostOpenReturn, /hash: createHash\("sha256"\)/);
  assert.match(hostOpenReturn, /bytes: new Uint8Array\(bytes\)/);
  assert.doesNotMatch(hostOpenReturn, /fileName|sizeBytes|targetPath|targetPathRedacted|absolutePath|sha256:|bytesBase64/);
  assert.match(main, /IPC_CHANNELS\.saveEditedSvga/);
  assert.match(main, /IPC_CHANNELS\.p3EditResult/);
  assert.match(main, /sourceFilePaths/);
  assert.match(main, /fsyncSync/);
  assert.match(main, /actualLaunchCommand/);
  assert.match(main, /actualArgvSanitized/);
  assert.match(main, /pathRedactionsApplied/);
  assert.match(main, /normalVisibleStartupMode/);
  assert.match(main, /normalVisibleStartup/);
  assert.match(main, /finderEquivalentLaunchCompatible/);
  assert.match(main, /fileOpenTargets: \["primary-svga", "secondary-svga", "reference-media"\]/);
  assert.match(main, /const hostMenuActions = Object\.freeze/);
  assert.match(main, /"copy"/);
  assert.match(main, /"select-all"/);
  assert.match(main, /menuActions: hostMenuActions/);
  assert.match(main, /blockedExternalRequests/);
  assert.match(main, /writeVisibleNormalStartupProof/);
  assert.match(main, /normal-visible-startup\.json/);
	  assert.match(main, /windowShown: window\.isVisible\(\)/);
	  assert.match(main, /launch:\s*\{\s*width:\s*640,\s*height:\s*640\s*\}/);
	  assert.match(main, /shortTermWorkbench:\s*\{\s*width:\s*1280,\s*height:\s*800\s*\}/);
	  assert.match(main, /minimumLaunch:\s*\{\s*width:\s*640,\s*height:\s*640\s*\}/);
	  assert.match(main, /defaultWorkbench:\s*\{\s*width:\s*1440,\s*height:\s*900\s*\}/);
	  assert.match(main, /minimumSupported:\s*\{\s*width:\s*1180,\s*height:\s*760\s*\}/);
	  assert.match(main, /legacyStressViewport:\s*\{\s*width:\s*900,\s*height:\s*720\s*\}/);
	  assert.match(main, /let shortTermWindowMode = usesShortTermPreviewShell \? "launch" : "workbench"/);
	  assert.match(main, /function installShortTermWindowBoundsPolicy/);
	  assert.match(main, /preserveShortTermLaunchWindowBounds/);
	  assert.match(main, /display-metrics-changed/);
	  assert.match(main, /window\.on\("move"/);
	  assert.match(main, /window\.on\("resize"/);
	  assert.match(main, /const targetSize = usesShortTermPreviewShell[\s\S]*macosWorkbenchWindowSizing\.shortTermWorkbench[\s\S]*macosWorkbenchWindowSizing\.defaultWorkbench/);
	  assert.match(main, /scenario === "desktop-1440x900"\) window\.setContentSize\(macosWorkbenchWindowSizing\.defaultWorkbench\.width, macosWorkbenchWindowSizing\.defaultWorkbench\.height\)/);
	  assert.match(main, /scenario === "short-term-preview-overview"\) window\.setContentSize\(macosWorkbenchWindowSizing\.shortTermWorkbench\.width, macosWorkbenchWindowSizing\.shortTermWorkbench\.height\)/);
	  assert.match(main, /scenario === "short-term-preview-overview-wide"\) window\.setContentSize\(macosWorkbenchWindowSizing\.defaultWorkbench\.width, macosWorkbenchWindowSizing\.defaultWorkbench\.height\)/);
	  assert.match(main, /scenario === "short-term-optimization-result"\) window\.setContentSize\(macosWorkbenchWindowSizing\.shortTermWorkbench\.width, macosWorkbenchWindowSizing\.shortTermWorkbench\.height\)/);
	  assert.match(main, /scenario === "short-term-general-compare"\) window\.setContentSize\(macosWorkbenchWindowSizing\.shortTermWorkbench\.width, macosWorkbenchWindowSizing\.shortTermWorkbench\.height\)/);
	  assert.match(main, /scenario === "short-term-settings-dialog"\) window\.setContentSize\(macosWorkbenchWindowSizing\.shortTermWorkbench\.width, macosWorkbenchWindowSizing\.shortTermWorkbench\.height\)/);
	  assert.match(main, /scenario === "short-term-edit-reserved"\) window\.setContentSize\(macosWorkbenchWindowSizing\.shortTermWorkbench\.width, macosWorkbenchWindowSizing\.shortTermWorkbench\.height\)/);
	  assert.match(main, /"short-term-preview-overview-wide",/);
	  assert.match(main, /scenario === "short-term-drag-decision-supported"\) window\.setContentSize\(macosWorkbenchWindowSizing\.shortTermWorkbench\.width, macosWorkbenchWindowSizing\.shortTermWorkbench\.height\)/);
	  assert.match(main, /scenario === "short-term-drag-decision-unsupported"\) window\.setContentSize\(macosWorkbenchWindowSizing\.shortTermWorkbench\.width, macosWorkbenchWindowSizing\.shortTermWorkbench\.height\)/);
	  assert.match(main, /"short-term-drag-decision-supported",/);
	  assert.match(main, /"short-term-drag-decision-unsupported",/);
	  assert.match(main, /scenario === "desktop-1280x800"\) window\.setContentSize\(macosWorkbenchWindowSizing\.comfortable\.width, macosWorkbenchWindowSizing\.comfortable\.height\)/);
	  assert.match(main, /minWidth:\s*usesShortTermPreviewShell[\s\S]*macosWorkbenchWindowSizing\.minimumLaunch\.width[\s\S]*macosWorkbenchWindowSizing\.minimumSupported\.width/);
	  assert.match(main, /minHeight:\s*usesShortTermPreviewShell[\s\S]*macosWorkbenchWindowSizing\.minimumLaunch\.height[\s\S]*macosWorkbenchWindowSizing\.minimumSupported\.height/);
	  assert.match(main, /environmentOverrides: \{\}/);
  assert.match(main, /rendererQuery: rendererProbe\.rendererQuery/);
  assert.match(main, /noProofMode: true/);
  assert.match(main, /noSmokeMode: true/);
  assert.match(main, /noProofArguments/);
  assert.match(main, /orphanProcessPolicy/);
  assert.match(main, /AUTO_SVGA_RUNTIME_CLEANUP/);
  assert.match(main, /AUTO_SVGA_SMOKE_RESULT_REJECTED/);
  assert.match(main, /describeP6InteractionTraceValidationFailure/);
  assert.match(main, /sessionRootRedacted: sanitizeRuntimeArgument\(sessionRoot\)/);
  assert.match(main, /tempRemoved: true/);
  assert.doesNotMatch(main, /actualArgv:\s*process\.argv/);
  assert.match(main, /driveCanonicalNormalProof/);
  assert.match(main, /window\.autoSvgaElectronHost/);
  assert.match(main, /__autoSvgaShortTermActions/);
  assert.match(main, /openFromHostDialog/);
  assert.match(main, /#primaryCanvas/);
  assert.match(main, /#factGrid/);
  assert.doesNotMatch(main, /fetch\("\/fixture\/avatar-frame-smoke\.svga"\)/);
  assert.match(main, /setPermissionRequestHandler/);
  assert.match(main, /setWindowOpenHandler\(\(\) => \(\{ action: "deny" \}\)\)/);
  assert.match(main, /will-navigate/);
  assert.match(main, /webRequest\.onBeforeRequest/);
  assert.match(preload, /ELECTRON_HOST_BRIDGE_NAME/);
  assert.match(preload, /LEGACY_PROTOTYPE_BRIDGE_NAME/);
  assert.match(preload, /scanLatestArtifacts/);
  assert.match(preload, /openReferenceMediaFile/);
  assert.match(preload, /hostAdapterVersion:\s*1/);
  assert.match(preload, /arbitraryFileSystemAccess:\s*false/);
  assert.match(preload, /referenceMediaOpen:\s*"host-dialog-mp4-webm-gif-only"/);
  assert.doesNotMatch(preload, /require\(["']\.\/host-adapter-contract\.cjs["']\)/);
  assert.doesNotMatch(preload, /\bdialog\s*[\s,:})]|shell\.|openPath|readFile/);
  assert.doesNotMatch(preload, /require\("node:fs"\)|require\("fs"\)/);
  assert.match(productApp, /function createP6SmokeFailureDiagnostics/);
  assert.match(productApp, /diagnostics: createP6SmokeFailureDiagnostics\(error\)/);
  assert.match(productApp, /currentActionId: p6SmokeCurrentActionId/);
  assert.match(productApp, /sanitizeP6SmokeDiagnostic/);
  assert.match(productApp, /function p6BoundedSmokeText/);
  assert.match(productApp, /visibleResultText: p6BoundedSmokeText\(proof\.renderedText\)/);
  assert.doesNotMatch(productApp, /stack: error\.stack|error\.stack/);
});

test("formal short-term actual preload exposes only the authorized product bridge", async () => {
  const { exposed, invocations } = await exposePreloadGlobals("short-term");
  assert.deepEqual(Object.keys(exposed), [hostContract.ELECTRON_HOST_BRIDGE_NAME]);
  assert.equal(exposed[hostContract.LEGACY_PROTOTYPE_BRIDGE_NAME], undefined);

  const api = exposed[hostContract.ELECTRON_HOST_BRIDGE_NAME];
  assert.equal(api.hostAdapterVersion, 1);
  assert.equal(api.productMilestoneId, "short-term");
  assert.equal(api.reportToken, "test-token");
  assert.equal(api.localOnly, true);
  assert.equal(api.telemetry, "disabled");
  assert.deepEqual(Array.from(api.capabilities.documentTypes), ["svga"]);
  assert.equal(api.capabilities.fileOpen, "host-dialog-svga-only");
  assert.equal(api.capabilities.dragDrop, "renderer-file-api-no-path-authority");
  assert.equal(api.capabilities.recentFiles, "host-user-data-redacted");
  assert.equal(api.capabilities.clipboardWrite, "host-clipboard-write-text-only");
  assert.equal(api.capabilities.finderDocumentAssociation, "not-declared");
  assert.equal(api.capabilities.saveAs, "host-dialog-svga-only");
  assert.equal(api.capabilities.overwriteSave, "host-source-path-from-file-picker-only");
  assert.equal(api.capabilities.arbitraryFileSystemAccess, false);
  assert.equal(api.capabilities.shellAccess, false);
  assert.equal(api.capabilities.remoteNavigation, false);
  assert.equal(api.capabilities.newWindows, false);

  const allowedMethods = [
    "openSvgaFile",
    "getRecentSvgaFiles",
    "openRecentSvgaFile",
    "clearRecentSvgaFiles",
    "writeClipboardText",
    "updateShortTermMenuState",
    "setShortTermWindowMode",
    "saveShortTermSvgaOutput"
  ];
  for (const allowedMethod of allowedMethods) {
    assert.equal(typeof api[allowedMethod], "function", allowedMethod);
  }

  const blockedKeys = [
    "referenceMediaOpen",
    "sequenceRepairSaveAs",
    "scanLatestArtifacts",
    "openReferenceMediaFile",
    "captureArtifact",
    "performSmokeInput",
    "reportSmokeResult",
    "reportAuditResult",
    "reportNormalProofResult",
    "saveEditedSvga",
    "saveOptimizedSvga",
    "saveSequenceRepairSvga",
    "reportP3EditResult",
    "reportP4EditResult",
    "reportP5BatchResult",
    "getAebIntakeReport"
  ];
  for (const blockedKey of blockedKeys) {
    assert.equal(blockedKey in api, false, blockedKey);
    assert.equal(blockedKey in api.capabilities, false, blockedKey);
  }

  assert.equal(api.openSvgaFile().channel, hostContract.IPC_CHANNELS.openSvgaFile);
  assert.equal(api.saveShortTermSvgaOutput({ bytesBase64: "AA==" }).channel, hostContract.IPC_CHANNELS.saveShortTermSvgaOutput);
  assert.equal(invocations.length, 2);
});

test("proof short-term actual preload may expose evidence helpers without legacy Workbench bridge", async () => {
  const { exposed } = await exposePreloadGlobals("short-term", "proof");
  assert.deepEqual(Object.keys(exposed), [hostContract.ELECTRON_HOST_BRIDGE_NAME]);
  assert.equal(exposed[hostContract.LEGACY_PROTOTYPE_BRIDGE_NAME], undefined);

  const api = exposed[hostContract.ELECTRON_HOST_BRIDGE_NAME];
  assert.equal(api.productMilestoneId, "short-term");
  assert.equal(typeof api.reportSmokeResult, "function");
  assert.equal(typeof api.captureArtifact, "function");
  assert.equal(typeof api.reportNormalProofResult, "function");
  assert.equal("saveEditedSvga" in api, false);
  assert.equal("saveOptimizedSvga" in api, false);
  assert.equal("saveSequenceRepairSvga" in api, false);
});

test("AEB actual preload exposes only the intake bridge", async () => {
  const { exposed, invocations } = await exposePreloadGlobals("aeb");
  assert.deepEqual(Object.keys(exposed), [hostContract.ELECTRON_HOST_BRIDGE_NAME]);
  assert.equal(exposed[hostContract.LEGACY_PROTOTYPE_BRIDGE_NAME], undefined);

  const api = exposed[hostContract.ELECTRON_HOST_BRIDGE_NAME];
  assert.equal(api.productMilestoneId, "aeb");
  assert.equal(api.localOnly, true);
  assert.equal(api.telemetry, "disabled");
  assert.deepEqual(Array.from(api.capabilities.documentTypes), ["aeb-intake-report"]);
  assert.equal(api.capabilities.aebIntakeReport, "host-read-normalized-redacted-json-from-launch-path");
  assert.equal(api.capabilities.arbitraryFileSystemAccess, false);
  assert.equal(api.capabilities.shellAccess, false);
  assert.equal(typeof api.getAebIntakeReport, "function");

  const blockedMethods = [
    "scanLatestArtifacts",
    "openSvgaFile",
    "openReferenceMediaFile",
    "getRecentSvgaFiles",
    "openRecentSvgaFile",
    "clearRecentSvgaFiles",
    "writeClipboardText",
    "updateShortTermMenuState",
    "setShortTermWindowMode",
    "saveShortTermSvgaOutput",
    "saveEditedSvga",
    "saveOptimizedSvga",
    "saveSequenceRepairSvga",
    "reportP3EditResult",
    "reportP4EditResult",
    "reportP5BatchResult"
  ];
  for (const blockedMethod of blockedMethods) {
    assert.equal(blockedMethod in api, false, blockedMethod);
  }

  assert.equal(api.getAebIntakeReport().channel, hostContract.IPC_CHANNELS.getAebIntakeReport);
  assert.equal(invocations.length, 1);
});

test("desktop latest-artifact catalog returns Web-shaped non-empty and safe-empty results without path leaks", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "auto-svga-desktop-artifacts-"));
  try {
    const output = path.join(root, "examples/avatar_frame_basic/output");
    await mkdir(output, { recursive: true });
    const svgaBytes = Uint8Array.from([120, 156, 3, 0]);
    await writeFile(path.join(output, "avatar_frame_basic.svga"), svgaBytes);
    await writeFile(path.join(output, "report.json"), JSON.stringify({ ok: true }));
    await writeFile(path.join(output, "preview.webm"), Uint8Array.from([1, 2, 3]));
    const exports = path.join(root, "exports");
    await mkdir(exports, { recursive: true });
    await writeFile(path.join(exports, "invalid-fixture.svga"), Uint8Array.from([0, 1, 2, 3]));
    const catalog = createDesktopArtifactCatalog({
      groupedRoots: [{ rootPath: path.join(root, "examples"), kind: "example" }],
      standaloneRoots: [{ rootPath: path.join(root, "exports"), jobId: "exports" }]
    });
    const result = await catalog.scan();
    assert.equal(result.latestWithSvga?.jobId, "example:avatar_frame_basic");
    assert.match(result.latestWithSvga.svgaPath, /^\/desktop-artifact\/[a-f0-9]{24}\/avatar_frame_basic\.svga$/);
    assert.match(result.latestWithSvga.reportPath, /^\/desktop-artifact\/[a-f0-9]{24}\/report\.json$/);
    assert.match(result.latestWithSvga.webmPath, /^\/desktop-artifact\/[a-f0-9]{24}\/preview\.webm$/);
    assert.doesNotMatch(JSON.stringify(result), new RegExp(root.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
    const artifact = await catalog.readArtifact(result.latestWithSvga.svgaPath);
    assert.equal(Buffer.compare(Buffer.from(artifact.bytes), Buffer.from(svgaBytes)), 0);
    assert.equal(artifact.mimeType, "application/octet-stream");
    assert.equal(
      await catalog.readArtifact(result.latestWithSvga.svgaPath.replace("avatar_frame_basic.svga", "renamed.svga")),
      undefined
    );

    const emptyCatalog = createDesktopArtifactCatalog({
      groupedRoots: [{ rootPath: path.join(root, "missing"), kind: "example" }]
    });
    const empty = await emptyCatalog.scan();
    assert.equal(empty.latestWithSvga, null);
    assert.equal(empty.latestAny, null);
    assert.deepEqual(empty.artifacts, []);
    assert.match(empty.warnings.join(" "), /未扫描到可用的本地产物/);
    assert.equal(await emptyCatalog.readArtifact("/desktop-artifact/000000000000000000000000/test.svga"), undefined);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("P6 normal App proof launches without smoke query mode and uses Web baseline fixture bytes", async () => {
  const runner = await readFile(path.join(experimentRoot, "scripts/run-canonical-normal-proof.mjs"), "utf8");
  const main = await readFile(path.join(experimentRoot, "main.cjs"), "utf8");
  const prototype = await readFile(path.join(experimentRoot, "web/prototype.js"), "utf8");
  const prepareRuntime = await readFile(path.join(experimentRoot, "scripts/prepare-runtime.mjs"), "utf8");
  const p2Fixture = await readFile(path.join(experimentRoot, "scripts/p2-fixture.mjs"), "utf8");
  const productApp = await readFile(path.join(repoRoot, "tools/shared/product-frontend/product-app.mjs"), "utf8");
  const p6Evidence = await readFile(path.join(repoRoot, "tools/p6/generate-p6-evidence.mjs"), "utf8");
  const p6ParityRunner = await readFile(path.join(repoRoot, "tools/p6/parity-runner.mjs"), "utf8");

  assert.match(runner, /AUTO_SVGA_P2_NORMAL_PROOF/);
  assert.match(runner, /npm", \["run", "desktop:dev"\]/);
  assert.doesNotMatch(runner, /--smoke|--product-smoke|--p2-normal-proof|\?mode=smoke/);
  assert.match(main, /show:\s*false/);
  assert.match(main, /window\.showInactive\(\)/);
  assert.match(main, /writeVisibleNormalStartupProof\(window, rendererUrl\)/);
  assert.match(main, /runtimeIdentity\("normal-visible", rendererUrl\)/);
  assert.match(main, /actualLaunchCommand: normalIdentity\.actualLaunchCommand/);
  assert.match(main, /windowShown: window\.isVisible\(\)/);
  assert.match(main, /normalVisibleStartup: true/);
  assert.match(main, /environmentOverrides: \{\}/);
  assert.match(main, /rendererQuery: rendererProbe\.rendererQuery/);
  assert.match(main, /externalRequests: \[\.\.\.new Set/);
  assert.match(main, /expectedExit: "window-all-closed -> cleanupRuntime -> app\.quit"/);
  assert.match(main, /const isCanvasNonBlank = \(\) =>/);
  assert.match(main, /const canvasStartedAt = performance\.now\(\)/);
  assert.match(main, /const width = context\.canvas\.width/);
  assert.doesNotMatch(main, /Math\.min\(300, context\.canvas\.width\)/);
  assert.match(main, /normalProofMode\s*\?\s*""/);
  assert.match(main, /rendererQuery: location\.search/);
  assert.match(main, /window\.autoSvgaElectronHost/);
  assert.match(main, /__autoSvgaShortTermActions/);
  assert.match(main, /openFromHostDialog/);
  assert.match(main, /fileOpenMechanism: "macOS File > Open SVGA menu item -> short-term host dialog IPC"/);
  assert.match(main, /document\.querySelector\("#primaryCanvas"\)/);
  assert.match(main, /document\.querySelector\("#factGrid"\)/);
  assert.match(main, /document\.querySelector\("#assetList"\)/);
  assert.match(main, /menuOpen: value\.menuOpen/);
  assert.match(main, /recentFiles: value\.recentFiles/);
  assert.match(main, /recentMissingRecovery: value\.recentMissingRecovery/);
  assert.match(main, /shortTermRecentProof/);
  assert.match(main, /shortTermSave: value\.shortTermSave/);
  assert.match(main, /function validateShortTermNormalRecentProof/);
  assert.match(main, /function validateShortTermNormalSaveProof/);
  assert.match(main, /saveAsSavedSha256 !== value\.overwriteSavedSha256|value\.saveAsSavedSha256 === value\.overwriteSavedSha256/);
  assert.match(main, /short-term-normal-save-as\.svga/);
  assert.match(main, /host\.getRecentSvgaFiles/);
  const normalProofSource = main.slice(main.indexOf("async function driveCanonicalNormalProof"));
  assert.doesNotMatch(normalProofSource, /document\.querySelector\("#svgaFileInput"\)/);
  assert.match(prototype, /p6BaselineFixtureDisplayName = "p6-web-baseline-fixture\.svga"/);
  assert.match(prototype, /loadSvgaBytes\(bytes\.slice\(0\), p6BaselineFixtureDisplayName/);
  assert.match(prototype, /name === p6BaselineFixtureDisplayName/);
  for (const scenario of [
    "desktop-playing",
    "desktop-paused",
    "desktop-latest-artifact-loaded",
    "desktop-reference-media-loaded",
    "desktop-local-info-diagnostics-open",
    "desktop-local-source-resources-open",
    "desktop-local-source-layers-open",
    "desktop-local-inspector-actions-open",
    "desktop-local-logs-hidden-default",
    "desktop-local-minimum-size",
    "desktop-recovered-from-invalid"
  ]) {
    assert.match(main, new RegExp(scenario));
  }
  assert.match(prepareRuntime, /examples\/avatar_frame_basic\/output\/avatar_frame_basic\.svga/);
  assert.match(prepareRuntime, /"node", \["dist\/cli\.js", "export", "examples\/avatar_frame_basic"\]/);
  assert.match(p2Fixture, /repository-avatar-frame-basic\.svga/);
  assert.doesNotMatch(p2Fixture, /synthetic-avatar-frame\.svga/);
  assert.match(p6Evidence, /Auto SVGA-darwin-arm64\/Auto SVGA\.app\/Contents\/MacOS\/Auto SVGA/);
  assert.match(p6Evidence, /normal-visible-startup\.json/);
  assert.match(p6Evidence, /normalVisibleStartup/);
  assert.match(p6Evidence, /delete normalLaunchEnv\.AUTO_SVGA_P2_NORMAL_PROOF/);
  assert.doesNotMatch(p6Evidence, /AUTO_SVGA_P2_NORMAL_PROOF:\s*"1"/);
  assert.doesNotMatch(p6Evidence, /AUTO_SVGA_DESKTOP_NORMAL_PROOF/);
  assert.match(p6Evidence, /packaged Auto SVGA\.app/);
  assert.match(p6Evidence, /buildP6ParityReportFromRuntimeFacts/);
  assert.match(p6Evidence, /assertLocalPreviewWorkbenchRegionMap/);
  assert.match(p6Evidence, /layoutIntegrity/);
  assert.match(main, /requiredLayoutChecks/);
  assert.match(main, /coreRegionsInsideViewport/);
  assert.match(main, /sourceDocumentNotToolbar/);
  assert.match(main, /noResourceActionCollision/);
  assert.match(main, /noVerticalFilterWrapping/);
  assert.match(main, /mode-not-local-preview/);
  assert.match(main, /workflowPrimary !== "local_preview_first"/);
  assert.match(productApp, /workflowPrimary:\s*localPreviewPrimary \? "local_preview_first"/);
  assert.match(productApp, /collectWorkbenchLayoutIntegrity/);
  assert.match(productApp, /region_out_of_viewport/);
  assert.match(productApp, /coreRegionsInsideViewport/);
  assert.match(productApp, /source_document_maps_toolbar_instead_of_left_panel/);
  assert.match(productApp, /resource_action_collision/);
  assert.match(productApp, /resource_filter_vertical_wrap/);
  assert.match(p6ParityRunner, /function webFragmentsForItem/);
  assert.match(p6ParityRunner, /function desktopFragmentsForItem/);
  assert.match(p6ParityRunner, /function comparisonFragmentsForItem/);
  assert.doesNotMatch(p6Evidence, /webDesktopIds/);
  assert.doesNotMatch(p6ParityRunner, /webDesktopIds/);
  assert.doesNotMatch(p6Evidence, /AutoSVGAInternalPrototype|--product-smoke"\]|--smoke", "--product-smoke"/);
});

test("default Electron renderer is the short-term macOS client and keeps legacy Workbench isolated", async () => {
  const shortTermEntry = await readFile(path.join(experimentRoot, "web/short-term-macos-app.mjs"), "utf8");
  const shortTermController = await readFile(path.join(experimentRoot, "web/short-term-macos-controller.mjs"), "utf8");
  const shortTermState = await readFile(path.join(experimentRoot, "web/short-term-macos-state.mjs"), "utf8");
  const shortTermAppearanceModel = await readFile(path.join(experimentRoot, "web/short-term-macos-appearance-model.mjs"), "utf8");
  const shortTermSettingsSurface = await readFile(path.join(experimentRoot, "web/short-term-macos-settings-surface.mjs"), "utf8");
  const main = await readFile(path.join(experimentRoot, "main.cjs"), "utf8");
  const page = await readFile(path.join(experimentRoot, "web/index.html"), "utf8");
  const shortTermTokens = await readFile(path.join(experimentRoot, "web/short-term-macos.tokens.css"), "utf8");
  const shortTermAtoms = await readFile(path.join(experimentRoot, "web/short-term-macos.atoms.css"), "utf8");
  const shortTermMolecules = await readFile(path.join(experimentRoot, "web/short-term-macos.molecules.css"), "utf8");
  const shortTermComponents = await readFile(path.join(experimentRoot, "web/short-term-macos.components.css"), "utf8");
  const shortTermModules = await readFile(path.join(experimentRoot, "web/short-term-macos.modules.css"), "utf8");
  const shortTermPageStates = await readFile(path.join(experimentRoot, "web/short-term-macos.page-states.css"), "utf8");
  const shortTermStyles = await readFile(path.join(experimentRoot, "web/short-term-macos.css"), "utf8");
  const shortTermCommandState = await readFile(path.join(experimentRoot, "web/short-term-macos-command-state.mjs"), "utf8");
  const shortTermCommandSurface = await readFile(path.join(experimentRoot, "web/short-term-macos-command-surface.mjs"), "utf8");
  const shortTermCompareModel = await readFile(path.join(experimentRoot, "web/short-term-macos-compare-model.mjs"), "utf8");
  const shortTermCompareRenderers = await readFile(path.join(experimentRoot, "web/short-term-macos-compare-renderers.mjs"), "utf8");
  const shortTermCompareSurface = await readFile(path.join(experimentRoot, "web/short-term-macos-compare-surface.mjs"), "utf8");
  const shortTermDragDecisionModel = await readFile(path.join(experimentRoot, "web/short-term-macos-drag-decision-model.mjs"), "utf8");
  const shortTermDragDecisionSurface = await readFile(path.join(experimentRoot, "web/short-term-macos-drag-decision-surface.mjs"), "utf8");
  const shortTermEditReservedRenderers = await readFile(path.join(experimentRoot, "web/short-term-macos-edit-reserved-renderers.mjs"), "utf8");
  const shortTermDomState = await readFile(path.join(experimentRoot, "web/short-term-macos-dom-state.mjs"), "utf8");
  const shortTermNodes = await readFile(path.join(experimentRoot, "web/short-term-macos-nodes.mjs"), "utf8");
  const shortTermEventBindings = await readFile(path.join(experimentRoot, "web/short-term-macos-event-bindings.mjs"), "utf8");
  const shortTermActionBridge = await readFile(path.join(experimentRoot, "web/short-term-macos-action-bridge.mjs"), "utf8");
  const shortTermFeedbackModel = await readFile(path.join(experimentRoot, "web/short-term-macos-feedback-model.mjs"), "utf8");
  const shortTermFeedbackSurface = await readFile(path.join(experimentRoot, "web/short-term-macos-feedback-surface.mjs"), "utf8");
  const shortTermFileSurface = await readFile(path.join(experimentRoot, "web/short-term-macos-file-surface.mjs"), "utf8");
  const shortTermInlineStatusRenderers = await readFile(path.join(experimentRoot, "web/short-term-macos-inline-status-renderers.mjs"), "utf8");
  const shortTermLaunchRenderers = await readFile(path.join(experimentRoot, "web/short-term-macos-launch-renderers.mjs"), "utf8");
  const shortTermRecentFilesModel = await readFile(path.join(experimentRoot, "web/short-term-macos-recent-files-model.mjs"), "utf8");
  const shortTermRecentFilesSurface = await readFile(path.join(experimentRoot, "web/short-term-macos-recent-files-surface.mjs"), "utf8");
  const shortTermOutputSurface = await readFile(path.join(experimentRoot, "web/short-term-macos-output-surface.mjs"), "utf8");
  const shortTermRenderModel = await readFile(path.join(experimentRoot, "web/short-term-macos-render-model.mjs"), "utf8");
  const shortTermSaveRenderers = await readFile(path.join(experimentRoot, "web/short-term-macos-save-renderers.mjs"), "utf8");
  const shortTermSaveModel = await readFile(path.join(experimentRoot, "web/short-term-macos-save-model.mjs"), "utf8");
  const shortTermSaveSurface = await readFile(path.join(experimentRoot, "web/short-term-macos-save-surface.mjs"), "utf8");
  const shortTermStateRenderers = await readFile(path.join(experimentRoot, "web/short-term-macos-state-renderers.mjs"), "utf8");
  const shortTermInteractionModel = await readFile(path.join(experimentRoot, "web/short-term-macos-interaction-model.mjs"), "utf8");
  const shortTermTextRenderers = await readFile(path.join(experimentRoot, "web/short-term-macos-text-renderers.mjs"), "utf8");
  const shortTermTextModel = await readFile(path.join(experimentRoot, "web/short-term-macos-text-model.mjs"), "utf8");
  const shortTermThumbnailRenderers = await readFile(path.join(experimentRoot, "web/short-term-macos-thumbnail-renderers.mjs"), "utf8");
  const shortTermReplaceableModel = await readFile(path.join(experimentRoot, "web/short-term-macos-replaceable-model.mjs"), "utf8");
  const shortTermReplaceableRenderers = await readFile(path.join(experimentRoot, "web/short-term-macos-replaceable-renderers.mjs"), "utf8");
  const shortTermReplaceableSurface = await readFile(path.join(experimentRoot, "web/short-term-macos-replaceable-surface.mjs"), "utf8");
  const shortTermRuntimeTextSurface = await readFile(path.join(experimentRoot, "web/short-term-macos-runtime-text-surface.mjs"), "utf8");
  const shortTermOptimizationModel = await readFile(path.join(experimentRoot, "web/short-term-macos-optimization-model.mjs"), "utf8");
  const shortTermOptimizationRenderers = await readFile(path.join(experimentRoot, "web/short-term-macos-optimization-renderers.mjs"), "utf8");
  const shortTermOptimizationSurface = await readFile(path.join(experimentRoot, "web/short-term-macos-optimization-surface.mjs"), "utf8");
  const shortTermPreviewSurface = await readFile(path.join(experimentRoot, "web/short-term-macos-preview-surface.mjs"), "utf8");
  const shortTermOverviewModel = await readFile(path.join(experimentRoot, "web/short-term-macos-overview-model.mjs"), "utf8");
  const shortTermOverviewRenderers = await readFile(path.join(experimentRoot, "web/short-term-macos-overview-renderers.mjs"), "utf8");
  const shortTermEditReservedModel = await readFile(path.join(experimentRoot, "web/short-term-macos-edit-reserved-model.mjs"), "utf8");
  const shortTermResourceMenuRenderers = await readFile(path.join(experimentRoot, "web/short-term-macos-resource-menu-renderers.mjs"), "utf8");
  const shortTermResourceMenuModel = await readFile(path.join(experimentRoot, "web/short-term-macos-resource-menu-model.mjs"), "utf8");
  const shortTermResourceMenuSurface = await readFile(path.join(experimentRoot, "web/short-term-macos-resource-menu-surface.mjs"), "utf8");
  const shortTermNavigationSurface = await readFile(path.join(experimentRoot, "web/short-term-macos-navigation-surface.mjs"), "utf8");
  const shortTermSmokeProofModel = await readFile(path.join(experimentRoot, "web/short-term-macos-smoke-proof-model.mjs"), "utf8");
  const shortTermSmokeRunner = await readFile(path.join(experimentRoot, "web/short-term-macos-smoke-runner.mjs"), "utf8");
  const shortTermByteModel = await readFile(path.join(experimentRoot, "web/short-term-macos-byte-model.mjs"), "utf8");
  const shortTermApiClient = await readFile(path.join(experimentRoot, "web/short-term-macos-api-client.mjs"), "utf8");
  const shortTermHostClient = await readFile(path.join(experimentRoot, "web/short-term-macos-host-client.mjs"), "utf8");
  const shortTermDialogModel = await readFile(path.join(experimentRoot, "web/short-term-macos-dialog-model.mjs"), "utf8");
  const shortTermPlaybackFitModel = await readFile(path.join(experimentRoot, "web/short-term-macos-playback-fit-model.mjs"), "utf8");
  const shortTermPlaybackModel = await readFile(path.join(experimentRoot, "web/short-term-macos-playback-model.mjs"), "utf8");
  const shortTermPlaybackSurface = await readFile(path.join(experimentRoot, "web/short-term-macos-playback-surface.mjs"), "utf8");
  const workbenchPage = await readFile(path.join(experimentRoot, "web/workbench.html"), "utf8");
  const desktopEntry = await readFile(path.join(experimentRoot, "web/desktop-product-entry.mjs"), "utf8");
  const prototypeRenderer = await readFile(path.join(experimentRoot, "web/prototype.js"), "utf8");
  const sharedShell = await readFile(path.join(repoRoot, "tools/shared/product-frontend/product-shell.html"), "utf8");
  assert.match(page, /<title>Auto SVGA<\/title>/);
  assert.match(page, /id="previewDragOverlay"/);
  assert.match(page, /id="compareDragOverlay"/);
  assert.match(page, /data-drag-zone="compare"><strong>添加为对比文件<\/strong><\/div>\s*<div class="dragDecisionZone" data-drag-zone="open"><strong>打开新文件<\/strong>/);
  assert.match(page, /data-component="DragDecisionOverlay"/);
  assert.match(page, /id="canvasToast"/);
  assert.match(page, /data-component="CanvasToast"/);
  assert.match(main, /productDisplayName = "Auto SVGA"/);
  assert.match(main, /app\.setName\(productDisplayName\)/);
  assert.match(page, /data-app-state="launch"/);
  assert.match(page, /data-view="preview"/);
  assert.match(page, /data-panel="overview"/);
  assert.match(page, /data-panel="optimization"/);
  assert.doesNotMatch(page, /data-panel="replaceable"/);
  assert.doesNotMatch(page, /role="tablist" aria-orientation="horizontal"/);
  assert.match(page, /class="rightPanel" aria-label="信息" data-component="RightInformationSurface"/);
  assert.match(page, /class="rightSurfaceHeader"/);
  assert.match(page, /<h1 class="fileIdentity" id="fileIdentity">等待打开文件<\/h1>/);
  assert.match(page, /class="canvasModeSwitch" role="group" aria-label="模式" data-component="CanvasModeSwitch"/);
  assert.doesNotMatch(page, /class="tabs" aria-label="面板标签" role="tablist"/);
  assert.doesNotMatch(page, /data-tab="overview"|data-component="TabItem"|role="tab"/);
  assert.match(page, /short-term-macos\.css/);
  assert.match(page, /short-term-macos\.atoms\.css/);
  assert.match(page, /short-term-macos\.molecules\.css/);
  assert.match(page, /short-term-macos\.components\.css/);
  assert.match(page, /short-term-macos\.modules\.css/);
  assert.match(page, /short-term-macos\.page-states\.css/);
  assert.match(page, /short-term-macos-app\.mjs/);
  assert.match(page, /data-module="GeneralCompareModule"/);
  assert.match(page, /data-component="ComparePreviewCard"/);
  assert.match(page, /data-compare-label="A"/);
  assert.match(page, /data-compare-label="B"/);
  assert.match(page, /id="compareCanvasTitleA"/);
  assert.match(page, /id="compareCanvasMetaB"/);
  assert.match(page, /data-component="CompareCanvasSurface"/);
  assert.match(page, /class="compareEmptyPrompt" data-component="FileDropTarget" data-role="CompareEmptySlot"[\s\S]*<p>拖拽文件到此处<\/p>[\s\S]*class="largeOpenButton compareCanvasOpenButton" type="button" data-action="open-compare-a"[\s\S]*class="buttonIcon"[\s\S]*<span>打开文件<\/span>/);
  assert.match(page, /class="compareEmptyPrompt" data-component="FileDropTarget" data-role="CompareEmptySlot"[\s\S]*<p>拖拽文件到此处<\/p>[\s\S]*class="largeOpenButton compareCanvasOpenButton" type="button" data-action="open-compare-b"[\s\S]*class="buttonIcon"[\s\S]*<span>打开文件<\/span>/);
  assert.doesNotMatch(page, /data-canvas-label="预览"/);
  assert.match(page, /class="playbackActions" data-component="PlaybackButtonGroup"/);
  assert.match(page, /class="playbackIconButton primary"(?=[^>]*data-component="IconButton")(?=[^>]*data-action="play-pause")[^>]*>/);
  assert.match(page, /class="playbackIcon playbackIconPlay"/);
  assert.match(page, /class="playbackIcon playbackIconPause"/);
  assert.match(page, /class="playbackIconButton"(?=[^>]*data-component="IconButton")(?=[^>]*data-action="replay")[^>]*>/);
  assert.match(page, /class="playbackRightActions" data-component="PlaybackButtonGroup"/);
  assert.match(page, /class="playbackIconButton isSelected"(?=[^>]*data-component="IconButton")(?=[^>]*data-action="loop-toggle")(?=[^>]*aria-pressed="true")[^>]*>/);
  assert.doesNotMatch(page, /data-action="fullscreen"/);
  assert.doesNotMatch(page, /<button type="button" data-action="play-pause">播放<\/button>/);
  assert.doesNotMatch(page, /<button type="button" data-action="replay">重播<\/button>/);
  assert.match(page, /class="playbackProgress" id="playbackProgress" role="progressbar" aria-label="播放进度"/);
  assert.match(page, /class="playbackTime" id="playbackTime">0:00 \/ 0:00<\/span>/);
  assert.match(page, /class="playbackMeta" id="playbackMeta" aria-live="polite" data-component="InlineStatus"/);
  assert.match(page, /class="playbackBar comparePlaybackBar" aria-label="播放控制" data-component="PlaybackControls" data-state="disabled"/);
  assert.match(page, /class="playbackIconButton primary" data-playback-state="paused" aria-label="播放" title="播放" disabled/);
  assert.match(page, /最近打开/);
  assert.match(page, /class="launchDropIcon fileDropIcon"/);
  assert.match(page, />拖拽文件到此处<\/p>/);
  assert.match(page, /class="largeOpenButton" type="button" data-action="open"[\s\S]*class="buttonIcon"/);
  assert.doesNotMatch(shortTermModules, /\.launchPrompt \.largeOpenButton \.buttonIcon\s*\{[^}]*display:\s*none/s);
  assert.match(page, /class="recentClearButton" type="button" data-action="clear-recent" aria-label="清除最近记录"/);
  assert.doesNotMatch(page, />清除记录<\/button>/);
  assert.doesNotMatch(page, /本地预览，不上传/);
  assert.match(page, /覆盖保存/);
  assert.match(page, /id="discardDialog"/);
  assert.doesNotMatch(page, /id="textDialog"|data-component="TextReplacementSheet"/);
  assert.match(page, /id="discardDialog" data-component="ErrorRecoveryPanel" data-status="warning"/);
  assert.match(page, /id="settingsDialog"(?=[^>]*data-component="SettingsSheet")(?=[^>]*data-module="SettingsDialogModule")(?=[^>]*data-status="info")[^>]*>/);
  assert.match(page, /class="settingsGroup" aria-label="外观" data-component="ThemeSegmentedControl"/);
  assert.match(page, /class="dialogHeader settingsHeader"/);
  assert.doesNotMatch(page, /class="settingsHeaderIcon"/);
  assert.match(page, /name="appearance" value="system" data-appearance-choice>[\s\S]*class="settingsChoiceIcon"[\s\S]*<span>跟随系统<\/span>/);
  assert.match(page, /name="appearance" value="light" data-appearance-choice>[\s\S]*class="settingsChoiceIcon"[\s\S]*<span>浅色<\/span>/);
  assert.match(page, /name="appearance" value="dark" data-appearance-choice>[\s\S]*class="settingsChoiceIcon"[\s\S]*<span>深色<\/span>/);
  assert.doesNotMatch(page, /预览背景|主预览适配|活动记录/);
  assert.match(page, /class="dialogActions"/);
  assert.match(page, /id="resourceContextMenu"/);
  assert.match(page, /放弃未保存输出/);
  assert.match(page, /id="textElementList"/);
  assert.match(page, /<section class="replaceableSection"[\s\S]*id="textElementList" role="listbox" aria-label="运行时文本"[\s\S]*id="replaceableList" role="listbox" aria-label="imageKey"[\s\S]*<\/section>/);
  assert.doesNotMatch(page, /textPreviewBlock|textPreviewHeading|textPreviewSummary|>运行时文本 <span/);
  assert.doesNotMatch(page, /class="textPreviewActions"|data-action="edit-text" disabled|data-action="reset-text" disabled/);
  assert.match(page, /data-component="WindowChrome"/);
  assert.doesNotMatch(page, /class="toolbarCluster toolbarClusterPrimary"/);
  assert.doesNotMatch(page, /data-action="compare"/);
  assert.doesNotMatch(page, /打开另一个 SVGA 后开始对比/);
  assert.match(page, /data-component="CanvasModeSwitch"/);
  assert.match(page, /class="toolbarCluster toolbarClusterSave" data-component="SaveButtonPair"/);
  assert.match(page, /data-component="ReservedOperationPanel"/);
  assert.doesNotMatch(page, /class="tabs"[^>]*role="tablist"|data-component="TabItem"|role="tab"|aria-selected="true"/);
  assert.match(page, /id="panelOverview"(?=[^>]*data-panel="overview")(?=[^>]*data-page-state="Preview overview")(?=[^>]*tabindex="0")(?=[^>]*aria-label="文件信息")(?=[^>]*data-module="OverviewInformationModule")[^>]*>/);
  assert.doesNotMatch(page, /id="overviewSummary"/);
  assert.doesNotMatch(page, /id="assetSummary"/);
  assert.match(page, /id="panelOptimization"(?=[^>]*data-panel="optimization")(?=[^>]*data-page-state="Preview optimization")(?=[^>]*tabindex="0")(?=[^>]*aria-label="优化")(?=[^>]*data-module="OptimizationDetailSurface")[^>]*>/);
  assert.doesNotMatch(page, /id="panelReplaceable"/);
  assert.match(page, /id="replaceableList" role="listbox" aria-label="imageKey"/);
  assert.match(page, /id="textElementList" role="listbox" aria-label="运行时文本"/);
  assert.match(page, /short-term-macos\.tokens\.css/);
  assert.doesNotMatch(page, /id="compareFileInput"/);
  assert.doesNotMatch(page, /id="renameDialog"|id="renameInput"|id="renameHint"/);
  assert.doesNotMatch(page, /短期版仅保留图层查看/);
  assert.doesNotMatch(page, /productShellMount|desktop-product-entry\.mjs|prototype\.js/);
  assert.doesNotMatch(page, /导出验收|序列修复|批量 PNG|Export Acceptance/);
  assert.doesNotMatch(page, /brandMark/);
  assert.doesNotMatch(page, /inspectorPanel|检查面板|检查标签|检查器/);
  assert.match(shortTermTokens, /--asv-window/);
  assert.match(shortTermTokens, /--asv-color-window/);
  assert.match(shortTermTokens, /--asv-color-surface-window/);
  assert.match(shortTermTokens, /--asv-color-surface-workbench/);
  assert.match(shortTermTokens, /--asv-color-surface-right-panel/);
  assert.match(shortTermTokens, /--asv-color-surface-panel-chrome/);
  assert.match(shortTermTokens, /--asv-color-surface-panel-recessed/);
  assert.match(shortTermTokens, /--asv-component-right-panel-width/);
  assert.match(shortTermTokens, /--asv-component-right-panel-separator-width/);
  assert.match(shortTermTokens, /--asv-right-panel-separator/);
  assert.doesNotMatch(shortTermTokens, /inspector/);
  assert.match(shortTermTokens, /--asv-color-surface-control/);
  assert.match(shortTermTokens, /--asv-color-surface-mode-switch: var\(--asv-color-border-default\)/);
  assert.match(shortTermTokens, /--asv-color-surface-mode-selected: var\(--asv-color-surface-overlay\)/);
  assert.match(shortTermTokens, /--asv-mode-switch-bg: var\(--asv-color-surface-mode-switch\)/);
  assert.match(shortTermTokens, /--asv-mode-selected-bg: var\(--asv-color-surface-mode-selected\)/);
  assert.match(shortTermTokens, /--asv-component-text-input-width: 172px/);
  assert.match(shortTermTokens, /--asv-component-text-input-height: 24px/);
  assert.match(shortTermTokens, /--asv-text-input-height: var\(--asv-component-text-input-height\)/);
  assert.match(shortTermTokens, /--asv-component-mode-switch-width: 192px/);
  assert.match(shortTermTokens, /--asv-component-mode-switch-height: 42px/);
  assert.match(shortTermTokens, /--asv-component-mode-button-width: 92px/);
  assert.match(shortTermTokens, /--asv-component-mode-button-height: 34px/);
  assert.match(shortTermTokens, /--asv-mode-switch-gap: var\(--asv-component-mode-switch-gap\)/);
  assert.match(shortTermTokens, /--asv-mode-switch-shadow: var\(--asv-component-mode-switch-shadow\)/);
  assert.match(shortTermTokens, /--asv-mode-button-padding-inline: var\(--asv-component-mode-button-padding-inline\)/);
  assert.match(shortTermTokens, /--asv-mode-button-font-size: var\(--asv-component-mode-button-font-size\)/);
  assert.match(shortTermTokens, /--asv-mode-button-hover-bg: var\(--asv-component-mode-button-hover-background\)/);
  assert.match(shortTermTokens, /--asv-mode-selected-color: var\(--asv-component-mode-selected-color\)/);
  assert.match(shortTermTokens, /--asv-mode-selected-shadow: var\(--asv-component-mode-selected-shadow\)/);
  assert.match(shortTermTokens, /--asv-component-status-rail-width/);
  assert.match(shortTermTokens, /--asv-status-rail-width: var\(--asv-component-status-rail-width\)/);
  assert.match(shortTermTokens, /--asv-color-surface-row-selected/);
  assert.match(shortTermTokens, /--asv-component-canvas-checker-pattern: conic-gradient\(var\(--asv-color-canvas-checker\) 25%/);
  assert.match(shortTermTokens, /--asv-canvas-checker-pattern: var\(--asv-component-canvas-checker-pattern\)/);
  assert.match(shortTermTokens, /--asv-motion-duration-idle: 30s/);
  assert.match(shortTermTokens, /--asv-component-launch-checker-idle-duration: var\(--asv-motion-duration-idle\)/);
  assert.match(shortTermTokens, /--asv-component-launch-checker-idle-offset: calc\(var\(--asv-component-launch-checker-size\) \* 12\)/);
  assert.match(shortTermTokens, /--asv-panel-border/);
  assert.match(shortTermTokens, /--asv-shadow-panel-highlight/);
  assert.match(shortTermTokens, /--asv-shadow-panel-chrome/);
  assert.match(shortTermTokens, /--asv-shadow-row-selected/);
  assert.match(shortTermTokens, /--asv-shadow-fact-cell/);
  assert.match(shortTermTokens, /--asv-component-toolbar-control-background/);
  assert.match(shortTermTokens, /--asv-toolbar-control-bg: var\(--asv-component-toolbar-control-background\)/);
  assert.match(shortTermTokens, /--asv-component-asset-list-gap: var\(--asv-space-1\)/);
  assert.match(shortTermTokens, /--asv-component-thumbnail-size: 48px/);
  assert.match(shortTermTokens, /--asv-component-right-panel-width: 360px/);
  assert.match(shortTermTokens, /--asv-component-right-panel-padding: var\(--asv-space-4\)/);
  assert.match(shortTermTokens, /--asv-component-right-surface-content-width: calc\(var\(--asv-component-right-panel-width\) - \(var\(--asv-component-right-panel-padding\) \* 2\)\)/);
  assert.match(shortTermTokens, /--asv-component-right-panel-section-gap: var\(--asv-space-1\)/);
  assert.match(shortTermTokens, /--asv-component-right-panel-section-divider: 1px solid color-mix\(in srgb, var\(--asv-color-border-subtle\) 42%, transparent\)/);
  assert.match(shortTermTokens, /--asv-component-right-panel-header-divider: var\(--asv-component-right-panel-section-divider\)/);
  assert.match(shortTermTokens, /--asv-component-right-section-head-padding-block-end: var\(--asv-space-1\)/);
  assert.match(shortTermTokens, /--asv-component-right-section-list-margin-block-start: var\(--asv-space-1\)/);
  assert.match(shortTermTokens, /--asv-component-file-header-width: calc\(100% - \(var\(--asv-right-panel-padding\) \* 2\)\)/);
  assert.match(shortTermTokens, /--asv-component-file-header-action-width: 72px/);
  assert.match(shortTermTokens, /--asv-component-tab-selected-background: var\(--asv-color-surface-canvas\)/);
  assert.match(shortTermTokens, /--asv-component-tab-selected-ring: none/);
  assert.match(shortTermTokens, /--asv-component-asset-row-divider: 0 solid transparent/);
  assert.match(shortTermTokens, /--asv-component-asset-row-hover-background: color-mix\(in srgb, var\(--asv-color-surface-row-hover\) 18%, transparent\)/);
  assert.match(shortTermTokens, /--asv-component-asset-row-detail-letter-spacing: 0/);
  assert.match(shortTermTokens, /--asv-component-row-menu-size/);
  assert.match(shortTermTokens, /--asv-row-menu-icon-size: var\(--asv-component-row-menu-icon-size\)/);
  assert.match(shortTermTokens, /--asv-component-runtime-text-input-width: var\(--asv-component-text-input-width\)/);
  assert.match(shortTermTokens, /--asv-runtime-text-input-width: var\(--asv-component-runtime-text-input-width\)/);
  assert.match(shortTermTokens, /--asv-asset-list-gap: var\(--asv-component-asset-list-gap\)/);
  assert.match(shortTermTokens, /--asv-component-asset-filter-width: 235px/);
  assert.match(shortTermTokens, /--asv-component-asset-filter-height: 34px/);
  assert.match(shortTermTokens, /--asv-component-asset-section-head-gap: var\(--asv-space-2\)/);
  assert.match(shortTermTokens, /--asv-asset-section-head-gap: var\(--asv-component-asset-section-head-gap\)/);
  assert.match(shortTermTokens, /--asv-component-asset-filter-tab-font-size: var\(--asv-type-size-micro\)/);
  assert.match(shortTermTokens, /--asv-component-asset-filter-tab-letter-spacing: 0/);
  assert.match(shortTermTokens, /--asv-asset-filter-width: var\(--asv-component-asset-filter-width\)/);
  assert.match(shortTermTokens, /--asv-component-toast-height: 44px/);
  assert.match(shortTermTokens, /--asv-component-toast-width: 280px/);
  assert.match(shortTermTokens, /--asv-component-toast-failure-width: 320px/);
  assert.match(shortTermTokens, /--asv-toast-radius: var\(--asv-component-toast-radius\)/);
  assert.match(shortTermTokens, /--asv-component-toolbar-height/);
  assert.match(shortTermTokens, /--asv-component-launch-content-width/);
  assert.match(shortTermTokens, /--asv-component-launch-drop-icon-size/);
  assert.match(shortTermTokens, /--asv-launch-button-icon-size/);
  assert.match(shortTermTokens, /--asv-launch-clear-icon-size/);
  assert.match(shortTermTokens, /--asv-launch-recent-row-height/);
  assert.match(shortTermTokens, /--asv-launch-recent-list-border: var\(--asv-component-launch-recent-list-border\)/);
  assert.match(shortTermTokens, /--asv-launch-recent-row-border: var\(--asv-component-launch-recent-row-border\)/);
  assert.match(shortTermTokens, /--asv-launch-recent-name-color: var\(--asv-component-launch-recent-name-color\)/);
  assert.match(shortTermTokens, /--asv-launch-recent-clear-hover-bg: var\(--asv-component-launch-recent-clear-hover-bg\)/);
  assert.match(shortTermTokens, /--asv-launch-recent-control-shadow: var\(--asv-component-launch-recent-control-shadow\)/);
  assert.match(shortTermTokens, /--asv-launch-recent-invalid-opacity: var\(--asv-component-launch-recent-invalid-opacity\)/);
  assert.match(shortTermTokens, /--asv-component-preview-gap/);
  assert.match(shortTermTokens, /--asv-component-compare-canvas-header-height/);
  assert.match(shortTermTokens, /--asv-component-compare-canvas-gap/);
  assert.match(shortTermTokens, /--asv-compare-canvas-gap: var\(--asv-component-compare-canvas-gap\)/);
  assert.match(shortTermTokens, /--asv-compare-metric-row-min-height/);
  assert.match(shortTermTokens, /--asv-component-drag-overlay-label-size/);
  assert.match(shortTermTokens, /--asv-component-drag-overlay-zone-focus-opacity/);
  assert.match(shortTermTokens, /--asv-drag-overlay-label-size: var\(--asv-component-drag-overlay-label-size\)/);
  assert.match(shortTermTokens, /--asv-drag-zone-focus-opacity: var\(--asv-component-drag-overlay-zone-focus-opacity\)/);
  assert.match(shortTermTokens, /--asv-effect-drag-overlay-backdrop-filter/);
  assert.match(shortTermTokens, /--asv-drag-overlay-backdrop-filter: var\(--asv-effect-drag-overlay-backdrop-filter\)/);
  assert.match(shortTermTokens, /--asv-component-settings-sheet-width/);
  assert.match(shortTermTokens, /--asv-component-settings-sheet-border/);
  assert.match(shortTermTokens, /--asv-component-settings-sheet-radius/);
  assert.match(shortTermTokens, /--asv-component-settings-sheet-background/);
  assert.match(shortTermTokens, /--asv-component-settings-sheet-shadow/);
  assert.match(shortTermTokens, /--asv-component-settings-sheet-gap/);
  assert.match(shortTermTokens, /--asv-component-settings-appearance-block-height/);
  assert.match(shortTermTokens, /--asv-component-settings-appearance-block-gap/);
  assert.match(shortTermTokens, /--asv-component-settings-appearance-block-padding-block/);
  assert.match(shortTermTokens, /--asv-component-settings-choice-height/);
  assert.match(shortTermTokens, /--asv-component-settings-choice-gap/);
  assert.match(shortTermTokens, /--asv-dialog-backdrop-bg: var\(--asv-component-dialog-backdrop-background\)/);
  assert.match(shortTermTokens, /--asv-settings-sheet-border: var\(--asv-component-settings-sheet-border\)/);
  assert.match(shortTermTokens, /--asv-settings-sheet-radius: var\(--asv-component-settings-sheet-radius\)/);
  assert.match(shortTermTokens, /--asv-settings-sheet-bg: var\(--asv-component-settings-sheet-background\)/);
  assert.match(shortTermTokens, /--asv-settings-sheet-shadow: var\(--asv-component-settings-sheet-shadow\)/);
  assert.match(shortTermTokens, /--asv-settings-sheet-gap: var\(--asv-component-settings-sheet-gap\)/);
  assert.match(shortTermTokens, /--asv-settings-appearance-block-height: var\(--asv-component-settings-appearance-block-height\)/);
  assert.match(shortTermTokens, /--asv-settings-appearance-block-gap: var\(--asv-component-settings-appearance-block-gap\)/);
  assert.match(shortTermTokens, /--asv-settings-appearance-block-padding-block: var\(--asv-component-settings-appearance-block-padding-block\)/);
  assert.match(shortTermTokens, /--asv-settings-choice-group-padding: var\(--asv-component-settings-choice-group-padding\)/);
  assert.match(shortTermTokens, /--asv-settings-choice-group-bg: var\(--asv-component-settings-choice-group-bg\)/);
  assert.match(shortTermTokens, /--asv-settings-choice-hover-bg: var\(--asv-component-settings-choice-hover-bg\)/);
  assert.match(shortTermTokens, /--asv-settings-choice-selected-bg: var\(--asv-component-settings-choice-selected-bg\)/);
  assert.match(shortTermTokens, /--asv-settings-choice-selected-shadow: var\(--asv-component-settings-choice-selected-shadow\)/);
  assert.match(shortTermTokens, /:root\[data-appearance="light"\]/);
  assert.match(shortTermTokens, /:root\[data-appearance="dark"\]/);
  assert.match(shortTermTokens, /:root:not\(\[data-appearance="light"\]\)/);
  assert.match(shortTermTokens, /--asv-component-icon-button-size: 44px/);
  assert.match(shortTermTokens, /--asv-component-icon-button-radius: var\(--asv-radius-md\)/);
  assert.match(shortTermTokens, /--asv-component-icon-button-icon-size: 20px/);
  assert.match(shortTermTokens, /--asv-icon-button-size: var\(--asv-component-icon-button-size\)/);
  assert.match(shortTermTokens, /--asv-icon-button-radius: var\(--asv-component-icon-button-radius\)/);
  assert.match(shortTermTokens, /--asv-icon-button-icon-size: var\(--asv-component-icon-button-icon-size\)/);
  assert.match(shortTermTokens, /--asv-component-playback-control-size: var\(--asv-component-icon-button-size\)/);
  assert.match(shortTermTokens, /--asv-component-playback-icon-size: var\(--asv-component-icon-button-icon-size\)/);
  assert.match(shortTermTokens, /--asv-playback-bar-height/);
  assert.match(shortTermTokens, /--asv-component-playback-progress-height/);
  assert.match(shortTermTokens, /--asv-playback-progress-min-width: var\(--asv-component-playback-progress-min-width\)/);
  assert.match(shortTermTokens, /--asv-playback-progress-track-fr: var\(--asv-component-playback-progress-track-fr\)/);
  assert.match(shortTermTokens, /--asv-playback-end-spacer-fr: var\(--asv-component-playback-end-spacer-fr\)/);
  assert.match(shortTermTokens, /--asv-playback-time-width: var\(--asv-component-playback-time-width\)/);
  assert.match(shortTermTokens, /--asv-playback-control-shadow: var\(--asv-component-playback-control-shadow\)/);
  assert.match(shortTermTokens, /--asv-playback-progress-track-bg: var\(--asv-component-playback-track-bg\)/);
  assert.match(shortTermTokens, /--asv-playback-progress-track-ring: var\(--asv-component-playback-track-ring\)/);
  assert.match(shortTermTokens, /--asv-component-status-strip-width/);
  assert.match(shortTermTokens, /--asv-component-fact-status-strip-width/);
  assert.match(shortTermTokens, /--asv-component-fact-grid-width: 328px/);
  assert.match(shortTermTokens, /--asv-component-fact-grid-padding-block: var\(--asv-space-3\)/);
  assert.match(shortTermTokens, /--asv-component-fact-grid-row-gap: var\(--asv-space-4\)/);
  assert.match(shortTermTokens, /--asv-component-fact-cell-min-height: 56px/);
  assert.match(shortTermTokens, /--asv-component-fact-cell-value-size: var\(--asv-type-size-metric\)/);
  assert.match(shortTermTokens, /--asv-component-fact-cell-unit-size: var\(--asv-type-size-footnote\)/);
  assert.match(shortTermTokens, /--asv-fact-cell-unit-color: var\(--asv-component-fact-cell-unit-color\)/);
  assert.match(shortTermTokens, /--asv-component-metric-entry-font-size: var\(--asv-type-size-micro\)/);
  assert.match(shortTermTokens, /--asv-fact-cell-meta-gap: var\(--asv-component-fact-cell-meta-gap\)/);
  assert.match(shortTermTokens, /--asv-component-metric-entry-height/);
  assert.match(shortTermTokens, /--asv-metric-entry-bg: var\(--asv-component-metric-entry-bg\)/);
  assert.match(shortTermTokens, /--asv-metric-entry-color: var\(--asv-component-metric-entry-color\)/);
  assert.match(shortTermTokens, /--asv-component-asset-row-gap/);
  assert.match(shortTermTokens, /--asv-component-asset-row-padding-block: var\(--asv-space-1\)/);
  assert.match(shortTermTokens, /--asv-asset-row-divider: var\(--asv-component-asset-row-divider\)/);
  assert.match(shortTermTokens, /--asv-asset-row-hover-bg: var\(--asv-component-asset-row-hover-background\)/);
  assert.match(shortTermTokens, /--asv-component-replaceable-row-gap: var\(--asv-space-2\)/);
  assert.match(shortTermTokens, /--asv-replaceable-row-divider: var\(--asv-component-replaceable-row-divider\)/);
  assert.match(shortTermTokens, /--asv-replaceable-row-selected-bg: var\(--asv-component-replaceable-row-selected-background\)/);
  assert.match(shortTermTokens, /--asv-component-empty-state-width: 312px/);
  assert.match(shortTermTokens, /--asv-component-state-surface-width/);
  assert.match(shortTermTokens, /--asv-state-surface-width: var\(--asv-component-state-surface-width\)/);
  assert.match(shortTermTokens, /--asv-component-state-canvas-checker-size: var\(--asv-component-preview-checker-size\)/);
  assert.match(shortTermTokens, /--asv-component-state-canvas-background:[\s\S]*var\(--asv-component-canvas-checker-pattern\),[\s\S]*var\(--asv-color-surface-canvas\)/);
  assert.match(shortTermTokens, /--asv-state-canvas-bg: var\(--asv-component-state-canvas-background\)/);
  assert.match(shortTermModules, /\.stateCanvasWrap\s*\{[\s\S]*background:\s*[\s\S]*var\(--asv-state-canvas-bg\)[\s\S]*background-size: var\(--asv-state-canvas-checker-size\) var\(--asv-state-canvas-checker-size\), auto/);
  assert.match(shortTermTokens, /--asv-layout-launch-min-width: 640px/);
  assert.match(shortTermTokens, /--asv-layout-launch-min-height: 640px/);
  assert.match(shortTermTokens, /--asv-layout-workbench-min-width: 1180px/);
  assert.match(shortTermTokens, /--asv-layout-workbench-min-height: 760px/);
  assert.match(shortTermTokens, /--asv-launch-min-width: var\(--asv-layout-launch-min-width\)/);
  assert.match(shortTermTokens, /--asv-workbench-min-width: var\(--asv-layout-workbench-min-width\)/);
  assert.match(shortTermTokens, /--asv-component-launch-content-offset-block-start: 46px/);
  assert.match(shortTermTokens, /--asv-launch-content-offset-block-start: var\(--asv-component-launch-content-offset-block-start\)/);
  assert.match(shortTermTokens, /--asv-layout-page-launch-frame-width: 640px/);
  assert.match(shortTermTokens, /--asv-layout-page-launch-frame-height: 640px/);
  assert.match(shortTermTokens, /--asv-layout-page-workbench-frame-width: 1280px/);
  assert.match(shortTermTokens, /--asv-layout-page-workbench-frame-height: 800px/);
  assert.match(shortTermTokens, /--asv-layout-page-workbench-center-width: 920px/);
  assert.match(shortTermTokens, /--asv-layout-page-edit-center-width: 560px/);
  assert.match(shortTermTokens, /--asv-page-launch-frame-width: var\(--asv-layout-page-launch-frame-width\)/);
  assert.match(shortTermTokens, /--asv-page-workbench-frame-width: var\(--asv-layout-page-workbench-frame-width\)/);
  assert.match(shortTermTokens, /--asv-component-settings-divider-width: 0px/);
  assert.match(shortTermTokens, /--asv-component-layer-row-min-height/);
  assert.match(shortTermTokens, /--asv-component-layer-row-divider: 0 solid transparent/);
  assert.match(shortTermTokens, /--asv-layer-list-gap: var\(--asv-component-layer-list-gap\)/);
  assert.match(shortTermTokens, /--asv-layer-row-divider: var\(--asv-component-layer-row-divider\)/);
  assert.match(shortTermTokens, /--asv-layer-panel-padding: var\(--asv-component-layer-panel-padding\)/);
  assert.match(shortTermTokens, /--asv-layer-panel-padding-block-start: var\(--asv-component-layer-panel-padding-block-start\)/);
  assert.match(shortTermTokens, /--asv-component-edit-view-gap/);
  assert.match(shortTermTokens, /--asv-edit-canvas-min-width: var\(--asv-component-edit-canvas-min-width\)/);
  assert.match(shortTermTokens, /--asv-component-finding-row-gap/);
  assert.match(shortTermTokens, /--asv-component-finding-row-min-height: 62px/);
  assert.match(shortTermTokens, /--asv-finding-row-review-bg: var\(--asv-component-finding-row-review-background\)/);
  assert.match(shortTermTokens, /--asv-finding-row-unsupported-bg: var\(--asv-component-finding-row-unsupported-background\)/);
  assert.match(shortTermTokens, /--asv-finding-row-title-line-height: var\(--asv-component-finding-row-title-line-height\)/);
  assert.match(shortTermTokens, /--asv-finding-row-summary-size: var\(--asv-component-finding-row-summary-size\)/);
  assert.match(shortTermTokens, /--asv-finding-row-impact-color: var\(--asv-component-finding-row-impact-color\)/);
  assert.match(shortTermTokens, /--asv-finding-row-badge-min-height: var\(--asv-component-finding-row-badge-min-height\)/);
  assert.match(shortTermTokens, /--asv-component-row-index-width/);
  assert.match(shortTermTokens, /--asv-status-strip-width/);
  assert.match(shortTermTokens, /--asv-row-index-width/);
  assert.match(shortTermTokens, /--asv-focus-inset/);
  assert.match(shortTermTokens, /prefers-color-scheme: dark/);
  assert.match(shortTermTokens, /@media \(max-height: 780px\)/);
  assert.match(shortTermRecentFilesSurface, /clearRecentButton/);
  assert.match(shortTermAtoms, /button\.primary:disabled/);
  assert.match(shortTermAtoms, /\.spinner/);
  assert.match(shortTermAtoms, /\.thumb\.sequence/);
  assert.match(shortTermAtoms, /\.rowIndex/);
  assert.match(shortTermAtoms, /\.badge/);
  assert.match(shortTermAtoms, /\.emptyText\s*\{[^}]*background: transparent/s);
  assert.match(shortTermAtoms, /\.emptyText\s*\{[^}]*width: min\(var\(--asv-empty-state-width\), 100%\)/s);
  assert.doesNotMatch(shortTermAtoms, /\.emptyText\s*\{[^}]*border: 1px dashed/s);
  assert.match(shortTermAtoms, /:focus-visible/);
  assert.match(shortTermMolecules, /\.toolbarButton/);
  assert.match(shortTermMolecules, /\.buttonIcon\s*\{[^}]*flex: 0 0 auto/s);
  assert.match(shortTermMolecules, /\.modeSwitch/);
  assert.match(shortTermMolecules, /\.modeSwitch,[\s\S]*\.canvasModeSwitch\s*\{[^}]*border: 0/s);
  assert.match(shortTermMolecules, /\.modeSwitch,[\s\S]*\.canvasModeSwitch\s*\{[^}]*width: var\(--asv-mode-switch-width\)/s);
  assert.match(shortTermMolecules, /\.modeSwitch,[\s\S]*\.canvasModeSwitch\s*\{[^}]*min-height: var\(--asv-mode-switch-height\)/s);
  assert.match(shortTermMolecules, /\.modeSwitch,[\s\S]*\.canvasModeSwitch\s*\{[^}]*gap: var\(--asv-mode-switch-gap\)/s);
  assert.match(shortTermMolecules, /\.modeSwitch,[\s\S]*\.canvasModeSwitch\s*\{[^}]*background: var\(--asv-mode-switch-bg\)/s);
  assert.match(shortTermMolecules, /\.modeSwitch,[\s\S]*\.canvasModeSwitch\s*\{[^}]*box-shadow: var\(--asv-mode-switch-shadow\)/s);
  assert.match(shortTermMolecules, /\.modeSwitch button,[\s\S]*\.canvasModeSwitch button\s*\{[^}]*all: unset/s);
  assert.match(shortTermMolecules, /\.modeSwitch button,[\s\S]*\.canvasModeSwitch button\s*\{[^}]*display: inline-flex/s);
  assert.match(shortTermMolecules, /\.modeSwitch button,[\s\S]*\.canvasModeSwitch button\s*\{[^}]*width: var\(--asv-mode-button-width\)/s);
  assert.match(shortTermMolecules, /\.modeSwitch button,[\s\S]*\.canvasModeSwitch button\s*\{[^}]*min-height: var\(--asv-mode-button-height\)/s);
  assert.match(shortTermMolecules, /\.modeSwitch button,[\s\S]*\.canvasModeSwitch button\s*\{[^}]*background-image: none/s);
  assert.match(shortTermMolecules, /\.modeSwitch button:hover:not\(\.isSelected\),[\s\S]*\.canvasModeSwitch button:hover:not\(\.isSelected\)\s*\{[^}]*background: var\(--asv-mode-button-hover-bg\)/s);
  assert.match(shortTermMolecules, /\.modeSwitch button\.isSelected,[\s\S]*\.canvasModeSwitch button\.isSelected\s*\{[^}]*background: var\(--asv-mode-selected-bg\)/s);
  assert.match(shortTermMolecules, /\.modeSwitch button\.isSelected,[\s\S]*\.canvasModeSwitch button\.isSelected\s*\{[^}]*background-color: var\(--asv-mode-selected-bg\)/s);
  assert.match(shortTermMolecules, /\.modeSwitch button\.isSelected,[\s\S]*\.canvasModeSwitch button\.isSelected\s*\{[^}]*box-shadow: var\(--asv-mode-selected-shadow\)/s);
  assert.match(shortTermMolecules, /\.modeSwitch button:focus-visible,[\s\S]*\.canvasModeSwitch button:focus-visible\s*\{[^}]*box-shadow: var\(--asv-focus\)/s);
  assert.doesNotMatch(shortTermMolecules, /\.modeSwitch,[\s\S]*\.canvasModeSwitch\s*\{[^}]*box-shadow: var\(--asv-shadow-overlay\)/s);
  assert.doesNotMatch(shortTermMolecules, /\.tabs/);
  assert.match(shortTermMolecules, /\.rowMenuButton/);
  assert.match(shortTermMolecules, /:focus-visible/);
  assert.doesNotMatch(shortTermComponents, /button\.primary:disabled/);
  assert.doesNotMatch(shortTermComponents, /\.modeSwitch/);
  assert.doesNotMatch(shortTermComponents, /\.tabs/);
  assert.match(shortTermComponents, /\.factCell/);
  assert.match(shortTermComponents, /\.factCell\s*\{[^}]*align-content: center/s);
  assert.match(shortTermComponents, /\.factCell\s*\{[^}]*padding: 0/s);
  assert.match(shortTermComponents, /\.factCell\s*\{[^}]*box-shadow: none/s);
  assert.doesNotMatch(shortTermComponents, /\.factCell:nth-child\(5\)/);
  assert.match(shortTermComponents, /\.factCell::before\s*\{[^}]*display: none/s);
  assert.match(shortTermComponents, /\.factCell strong\s*\{[^}]*font-family: var\(--asv-font\)/s);
  assert.match(shortTermComponents, /\.factCell strong\s*\{[^}]*color: var\(--asv-fact-cell-value-color\)/s);
  assert.match(shortTermComponents, /\.factCell strong\s*\{[^}]*line-height: var\(--asv-fact-cell-value-line-height\)/s);
  assert.match(shortTermComponents, /\.factCell strong\s*\{[^}]*gap: var\(--asv-fact-cell-unit-gap\)/s);
  assert.match(shortTermComponents, /\.factCell\[data-fact-id="runtimeStructure"\]\s*\{[^}]*grid-column: 1 \/ -1/s);
  assert.match(shortTermComponents, /\.factValueUnit\s*\{[^}]*color: var\(--asv-fact-cell-unit-color\)/s);
  assert.match(shortTermComponents, /\.factValueUnit\s*\{[^}]*font-size: var\(--asv-fact-cell-unit-size\)/s);
  assert.match(shortTermComponents, /\.factValueUnit\s*\{[^}]*white-space: nowrap/s);
  assert.match(shortTermComponents, /\.factCell span\s*\{[^}]*color: var\(--asv-fact-cell-label-color\)/s);
  assert.match(shortTermComponents, /\.factCell span\s*\{[^}]*letter-spacing: var\(--asv-fact-cell-label-letter-spacing\)/s);
  assert.match(shortTermComponents, /\.factCell small\s*\{[^}]*margin-top: var\(--asv-fact-cell-meta-gap\)/s);
  assert.match(shortTermComponents, /\.factMoreInfo\s*\{[^}]*gap: var\(--asv-fact-more-info-gap\)/s);
  assert.match(shortTermComponents, /\.factMoreInfo summary\s*\{[^}]*min-height: var\(--asv-fact-more-info-summary-height\)/s);
  assert.match(shortTermComponents, /\.factMoreInfo summary\s*\{[^}]*font-size: var\(--asv-fact-more-info-summary-font-size\)/s);
  assert.match(shortTermComponents, /\.factMoreInfo summary::after\s*\{[^}]*border-right: var\(--asv-fact-more-info-arrow-stroke\) solid currentColor/s);
  assert.match(shortTermComponents, /\.factMoreInfo summary:hover\s*\{[^}]*background: var\(--asv-fact-more-info-summary-hover-bg\)/s);
  assert.match(shortTermComponents, /\.factMoreInfoGrid\s*\{[^}]*gap: var\(--asv-fact-more-info-row-gap\) var\(--asv-fact-more-info-column-gap\)/s);
  assert.match(shortTermComponents, /\.metricOptimizationEntry\s*\{[^}]*border-radius: var\(--asv-status-strip-radius\)/s);
  assert.match(shortTermComponents, /\.metricOptimizationEntry\s*\{[^}]*gap: var\(--asv-metric-entry-gap\)/s);
  assert.match(shortTermComponents, /\.metricOptimizationEntry\s*\{[^}]*padding: var\(--asv-metric-entry-padding-block\) var\(--asv-metric-entry-padding-inline\)/s);
  assert.match(shortTermComponents, /\.metricOptimizationEntry\s*\{[^}]*background: var\(--asv-metric-entry-bg\)/s);
  assert.match(shortTermComponents, /\.metricOptimizationEntry::after\s*\{[^}]*border-top: var\(--asv-metric-entry-arrow-stroke\) solid currentColor/s);
  assert.match(shortTermComponents, /\.assetRow/);
  assert.match(shortTermComponents, /\.assetRow\s*\{[^}]*gap: var\(--asv-asset-row-gap\)/s);
  assert.match(shortTermComponents, /\.assetRow\s*\{[^}]*padding: var\(--asv-asset-row-padding-block\) var\(--asv-asset-row-padding-inline\)/s);
  assert.match(shortTermComponents, /\.assetRow\s*\{[^}]*border-bottom: var\(--asv-asset-row-divider\)/s);
  assert.match(shortTermComponents, /\.assetRow:hover\s*\{[^}]*background: var\(--asv-asset-row-hover-bg\)/s);
  assert.match(shortTermComponents, /\.assetRow\[data-attention="true"\]/);
  assert.match(shortTermComponents, /\.assetRow \.rowText\s*\{[^}]*min-width: 0/s);
  assert.match(shortTermComponents, /\.assetRow \.rowText\s*\{[^}]*overflow: hidden/s);
  assert.match(shortTermComponents, /\.assetRow \.rowText strong\s*\{[^}]*min-width: 0/s);
  assert.match(shortTermComponents, /\.assetRow \.rowText span\s*\{[^}]*min-width: 0/s);
  assert.match(shortTermComponents, /\.assetRow \.badge\s*\{[^}]*justify-self: end/s);
  assert.match(shortTermComponents, /\.assetRow \.badge\.safe\s*\{[^}]*background: var\(--asv-color-success-soft\)/s);
  assert.match(shortTermComponents, /\.assetRow \.badge\.unsupported\s*\{[^}]*background: var\(--asv-asset-row-badge-attention-bg\)/s);
  assert.match(shortTermComponents, /\.assetRow \.badge\.fail\s*\{[^}]*background: var\(--asv-color-danger-soft\)/s);
  assert.match(shortTermComponents, /\.layerRow/);
  assert.match(shortTermComponents, /\.layerRow\s*\{[^}]*grid-template-columns: var\(--asv-layer-row-thumb-size\) minmax\(0, 1fr\)/s);
  assert.match(shortTermComponents, /\.layerRow\s*\{[^}]*border-bottom: var\(--asv-layer-row-divider\)/s);
  assert.match(shortTermComponents, /\.layerRow \.thumb\s*\{[^}]*width: var\(--asv-layer-row-thumb-size\)/s);
  assert.match(shortTermComponents, /\.layerRowText strong\s*\{[^}]*text-overflow: ellipsis/s);
  assert.match(shortTermComponents, /\.layerRowText strong\s*\{[^}]*font-weight: var\(--asv-layer-row-title-weight\)/s);
  assert.match(shortTermComponents, /\.findingRow\s*\{[^}]*grid-template-columns: minmax\(0, 1fr\) auto auto/s);
  assert.match(shortTermComponents, /\.findingRow\s*\{[^}]*gap: var\(--asv-finding-row-gap\)/s);
  assert.match(shortTermComponents, /\.findingRow\s*\{[^}]*background: var\(--asv-finding-row-bg\)/s);
  assert.match(shortTermComponents, /\.findingRow strong\s*\{[^}]*font-weight: var\(--asv-finding-row-title-weight\)/s);
  assert.match(shortTermComponents, /\.findingRow strong\s*\{[^}]*line-height: var\(--asv-finding-row-title-line-height\)/s);
  assert.match(shortTermComponents, /\.findingRow p\s*\{[^}]*font-size: var\(--asv-finding-row-summary-size\)/s);
  assert.match(shortTermComponents, /\.findingRow p\s*\{[^}]*white-space: nowrap/s);
  assert.match(shortTermComponents, /\.findingRow\[data-disposition="reviewOnly"\]\s*\{[^}]*background: var\(--asv-finding-row-review-bg\)/s);
  assert.match(shortTermComponents, /\.findingRow\[data-disposition="unsupported"\]\s*\{[^}]*background: var\(--asv-finding-row-unsupported-bg\)/s);
  assert.match(shortTermAtoms, /\.findingImpact\s*\{[^}]*grid-column: 2/s);
  assert.match(shortTermAtoms, /\.findingImpact\s*\{[^}]*font-size: var\(--asv-finding-row-impact-size\)/s);
  assert.match(shortTermAtoms, /\.findingRow \.badge\s*\{[^}]*grid-column: 3/s);
  assert.match(shortTermAtoms, /\.findingRow \.badge\s*\{[^}]*min-height: var\(--asv-finding-row-badge-min-height\)/s);
  assert.match(shortTermComponents, /\.replaceableRow,[\s\S]*\.textElementRow\s*\{[^}]*gap: var\(--asv-replaceable-row-gap\)/s);
  assert.match(shortTermComponents, /\.replaceableRow,[\s\S]*\.textElementRow\s*\{[^}]*border-bottom: var\(--asv-replaceable-row-divider\)/s);
  assert.match(shortTermComponents, /\.replaceableRow\.isSelected,[\s\S]*\.textElementRow\.isSelected\s*\{[^}]*background: var\(--asv-replaceable-row-selected-bg\)/s);
  assert.match(shortTermComponents, /\.messageRow/);
  assert.match(shortTermComponents, /\.messageRow\[data-status="success"\]/);
  assert.doesNotMatch(shortTermComponents, /\.reservedNotice/);
  assert.match(shortTermComponents, /\.stateCard\s*\{[^}]*width: min\(var\(--asv-state-surface-width\), 100%\)/s);
  assert.match(shortTermComponents, /\.stateCard\s*\{[^}]*border: 0/s);
  assert.match(shortTermComponents, /\.stateCard\s*\{[^}]*background: transparent/s);
  assert.match(shortTermComponents, /\.stateCard\s*\{[^}]*box-shadow: none/s);
  assert.match(shortTermComponents, /\.stateCard::before\s*\{[^}]*display: none/s);
  assert.match(shortTermComponents, /\.stateRecoveryButton\s*\{[^}]*display: inline-flex/s);
  assert.doesNotMatch(shortTermComponents, /\.stateCard\.error h1\s*\{[^}]*color: var\(--asv-danger\)/s);
  assert.match(page, /class="toolbarButton primary stateRecoveryButton"/);
  assert.match(page, /class="buttonIcon" viewBox="0 0 24 24" aria-hidden="true"/);
  assert.match(shortTermPageStates, /\.macApp\[data-app-state="loading"\] \.view,[\s\S]*\.macApp\[data-app-state="failed"\] \.view\s*\{[^}]*grid-row: 2/s);
  assert.match(shortTermPageStates, /\.workbenchStateView\s*\{[^}]*place-items: stretch/s);
  assert.match(shortTermComponents, /\.appDialog\[data-status="warning"\]::before/);
  assert.match(shortTermComponents, /\.dialogHeader/);
  assert.match(shortTermComponents, /\.dialogActions/);
  assert.match(shortTermComponents, /\.settingsDialog/);
  assert.match(shortTermComponents, /\.settingsGroup/);
  assert.match(shortTermComponents, /\.settingsHeader/);
  assert.doesNotMatch(shortTermComponents, /\.settingsHeaderIcon/);
  assert.match(shortTermComponents, /\.appDialog::backdrop\s*\{[^}]*background: var\(--asv-dialog-backdrop-bg\)/s);
  assert.match(shortTermComponents, /\.settingsDialog\s*\{[^}]*border: var\(--asv-settings-sheet-border\)/s);
  assert.match(shortTermComponents, /\.settingsDialog\s*\{[^}]*border-radius: var\(--asv-settings-sheet-radius\)/s);
  assert.match(shortTermComponents, /\.settingsDialog\s*\{[^}]*background: var\(--asv-settings-sheet-bg\)/s);
  assert.match(shortTermComponents, /\.settingsDialog\s*\{[^}]*box-shadow: var\(--asv-settings-sheet-shadow\)/s);
  assert.match(shortTermComponents, /\.settingsDialog \.dialogBody\s*\{[^}]*gap: var\(--asv-settings-sheet-gap\)/s);
  assert.match(shortTermComponents, /\.settingsDialog \.dialogBody\s*\{[^}]*padding: var\(--asv-settings-sheet-padding\) 0/s);
  assert.match(shortTermComponents, /\.settingsHeader\s*\{[^}]*padding: 0 var\(--asv-settings-sheet-padding\)/s);
  assert.match(shortTermComponents, /\.settingsHeader h2\s*\{[^}]*min-height: var\(--asv-settings-title-row-height\)/s);
  assert.match(shortTermComponents, /\.settingsChoiceGroup/);
  assert.match(shortTermComponents, /\.settingsGroup\s*\{[^}]*gap: var\(--asv-settings-appearance-block-gap\)/s);
  assert.match(shortTermComponents, /\.settingsGroup\s*\{[^}]*min-height: var\(--asv-settings-appearance-block-height\)/s);
  assert.match(shortTermComponents, /\.settingsGroup\s*\{[^}]*padding-block: var\(--asv-settings-appearance-block-padding-block\)/s);
  assert.match(shortTermComponents, /\.settingsChoiceGroup\s*\{[^}]*padding: var\(--asv-settings-choice-group-padding\)/s);
  assert.match(shortTermComponents, /\.settingsChoiceGroup\s*\{[^}]*background: var\(--asv-settings-choice-group-bg\)/s);
  assert.match(shortTermComponents, /\.settingsChoice/);
  assert.match(shortTermComponents, /\.settingsChoiceIcon/);
  assert.match(shortTermComponents, /\.settingsChoice:hover\s*\{[^}]*background: var\(--asv-settings-choice-hover-bg\)/s);
  assert.match(shortTermComponents, /\.settingsChoice:has\(input:checked\)/);
  assert.match(shortTermComponents, /\.settingsChoice:has\(input:checked\)\s*\{[^}]*border-color: var\(--asv-settings-choice-selected-border\)/s);
  assert.match(shortTermComponents, /\.settingsChoice:has\(input:checked\)\s*\{[^}]*background: var\(--asv-settings-choice-selected-bg\)/s);
  assert.match(shortTermComponents, /\.settingsChoice:has\(input:checked\)\s*\{[^}]*box-shadow: var\(--asv-settings-choice-selected-shadow\)/s);
  assert.match(shortTermComponents, /\.settingsChoice:has\(input:focus-visible\)/);
  assert.match(shortTermComponents, /\.settingsDialog \.dialogActions button\s*\{[^}]*min-height: var\(--asv-settings-action-height\)/s);
  assert.match(shortTermComponents, /\.contextMenu button:disabled/);
  assert.match(shortTermModules, /\.toolbarCluster/);
  assert.match(shortTermModules, /\.rightPanel/);
  assert.match(shortTermTokens, /--asv-component-side-surface-background: var\(--asv-color-surface-right-panel\)/);
  assert.match(shortTermTokens, /--asv-side-surface-bg: var\(--asv-component-side-surface-background\)/);
  assert.match(shortTermModules, /box-shadow: inset var\(--asv-side-surface-separator-width\) 0 0 var\(--asv-side-surface-separator\)/);
  assert.match(shortTermModules, /\.fileIdentity\s*\{[^}]*max-width: 100%/s);
  assert.match(shortTermModules, /\.toolbarClusterSave\s*\{[^}]*min-width: 0/s);
  assert.match(shortTermModules, /\.rightSurfaceHeader\s*\{[^}]*box-sizing: border-box/s);
  assert.match(shortTermModules, /\.rightSurfaceHeader\s*\{[^}]*width: var\(--asv-file-header-width\)/s);
  assert.match(shortTermModules, /\.rightSurfaceHeader\s*\{[^}]*max-width: var\(--asv-file-header-width\)/s);
  assert.match(shortTermModules, /\.rightSurfaceHeader\s*\{[^}]*overflow: hidden/s);
  assert.match(shortTermModules, /\.rightSurfaceHeader\s*\{[^}]*padding: var\(--asv-file-header-padding-block\) 0/s);
  assert.match(shortTermTokens, /--asv-component-workbench-top-safe-area: var\(--asv-component-toolbar-height\)/);
  assert.match(shortTermTokens, /--asv-component-workbench-floating-control-top: var\(--asv-space-4\)/);
  assert.match(shortTermTokens, /--asv-component-right-panel-safe-padding-block-start: var\(--asv-component-right-panel-padding\)/);
  assert.match(shortTermModules, /\.rightSurfaceHeader\s*\{[^}]*margin: var\(--asv-right-panel-safe-padding-block-start\) var\(--asv-right-panel-padding\) 0/s);
  assert.match(shortTermModules, /\.rightPanel\s*\{[^}]*background: var\(--asv-side-surface-bg\)/s);
  assert.match(shortTermModules, /\.rightSurfaceBody\s*\{[^}]*background: var\(--asv-side-surface-bg\)/s);
  assert.match(shortTermModules, /\.rightSurfaceBody > \.factGrid,[\s\S]*\.compareInfo > \.resultGroup\s*\{[^}]*max-width: var\(--asv-right-surface-content-width\)/s);
  assert.match(shortTermModules, /\.launchCanvas\s*\{[^}]*background:[^}]*var\(--asv-canvas-checker-pattern\)/s);
  assert.match(shortTermModules, /\.launchCanvas\s*\{[^}]*animation: launchCheckerIdleDrift var\(--asv-launch-checker-idle-duration\) var\(--asv-launch-checker-idle-easing\) infinite/s);
  assert.match(shortTermModules, /\.launchCanvas\.isDragOver\s*\{[^}]*animation-play-state: paused/s);
  assert.match(shortTermModules, /@keyframes launchCheckerIdleDrift/);
  assert.match(shortTermModules, /background-position: var\(--asv-launch-checker-idle-offset\) calc\(var\(--asv-launch-checker-idle-offset\) \* -1\), 0 0/);
  assert.match(shortTermModules, /\.canvasWrap,[\s\S]*\.compareCanvasWrap\s*\{[^}]*background:[^}]*var\(--asv-canvas-checker-pattern\)/s);
  assert.doesNotMatch(shortTermModules, /conic-gradient\(from 45deg/);
  assert.match(shortTermModules, /\.factGrid\s*\{[^}]*gap: var\(--asv-fact-grid-row-gap\) var\(--asv-fact-grid-column-gap\)/s);
  assert.match(shortTermModules, /\.factGrid\s*\{[^}]*width: min\(var\(--asv-fact-grid-width\), 100%\)/s);
  assert.match(shortTermModules, /\.assetList\s*\{[^}]*gap: var\(--asv-asset-list-gap\)/s);
  assert.match(shortTermModules, /\.fileDropIcon\s*\{/);
  assert.match(shortTermModules, /\.recentClearButton\s*\{/);
  assert.match(shortTermModules, /\.recentClearButton\s*\{[^}]*box-shadow: var\(--asv-launch-recent-control-shadow\)/s);
  assert.match(shortTermModules, /\.recentClearButton:hover:not\(:disabled\)\s*\{[^}]*background: var\(--asv-launch-recent-clear-hover-bg\)/s);
  assert.match(page, /class="recentBlock"[^>]*data-component="LaunchRecentFilesList"[^>]*data-state="empty"/);
  assert.match(page, /class="recentClearButton"[^>]*data-action="clear-recent"[^>]*disabled/);
  assert.match(shortTermModules, /\.recentBlock ol\s*\{[^}]*border-top: var\(--asv-launch-recent-list-border\)/s);
  assert.match(shortTermModules, /\.recentBlock li\s*\{[^}]*border-bottom: var\(--asv-launch-recent-row-border\)/s);
  assert.match(shortTermModules, /\.recentBlock li\[data-state="invalid"\]\s*\{[^}]*opacity: var\(--asv-launch-recent-invalid-opacity\)/s);
  assert.match(shortTermModules, /\.recentBlock li button\s*\{[^}]*color: var\(--asv-launch-recent-name-color\)/s);
  assert.match(shortTermModules, /\.recentBlock li button\s*\{[^}]*box-shadow: var\(--asv-launch-recent-control-shadow\)/s);
  assert.doesNotMatch(shortTermModules, /inspector/);
  assert.match(shortTermModules, /grid-template-columns: var\(--asv-window-controls-width\) minmax\(0, 1fr\)/);
  assert.match(shortTermModules, /\.titlebar\s*\{[\s\S]*background: transparent/s);
  assert.match(shortTermModules, /\.rightSurfaceHeader \.toolbarButton\s*\{[^}]*background: var\(--asv-toolbar-control-bg\)/s);
  assert.match(shortTermModules, /\.rightSurfaceHeader \.toolbarButton\.primary\s*\{[^}]*background: var\(--asv-action\)/s);
  assert.match(shortTermModules, /\.canvasModeSwitch\s*\{[^}]*position: absolute/s);
  assert.match(shortTermModules, /\.canvasModeSwitch\s*\{[^}]*top: var\(--asv-workbench-floating-control-top\)/s);
  assert.match(shortTermModules, /\.compareCanvasWrap\s*\{[^}]*grid-template-rows: minmax\(0, 1fr\)/s);
  assert.match(shortTermModules, /\.compareCanvasSurface\s*\{[^}]*position: relative/s);
  assert.match(shortTermModules, /\.compareCanvasSurface\s*\{[^}]*grid-template-rows: minmax\(0, 1fr\) auto/s);
  assert.match(shortTermTokens, /--asv-component-compare-empty-prompt-width: var\(--asv-component-launch-content-width\)/);
  assert.match(shortTermModules, /\.compareEmptyPrompt\s*\{[^}]*position: absolute/s);
  assert.match(shortTermModules, /\.compareEmptyPrompt\s*\{[^}]*gap: var\(--asv-compare-empty-prompt-gap\)/s);
  assert.match(shortTermModules, /\.compareCanvasWrap\[data-compare-state="empty"\] canvas\s*\{[^}]*opacity: 0/s);
  assert.match(shortTermModules, /\.compareCanvasWrap\[data-compare-state="loaded"\] \.compareEmptyPrompt\s*\{[^}]*display: none/s);
  assert.match(shortTermModules, /\.assetList \.assetRow\s*\{[^}]*border-bottom: var\(--asv-asset-row-divider\)/s);
  assert.match(shortTermModules, /\.rightSurfaceHeader\s*\{[^}]*border-bottom: var\(--asv-right-panel-header-divider\)/s);
  assert.match(shortTermModules, /\.sectionHead\s*\{[^}]*padding-bottom: var\(--asv-right-section-head-padding-block-end\)/s);
  assert.match(shortTermModules, /\.assetList,[\s\S]*\.textElementList\s*\{[^}]*margin-top: var\(--asv-right-section-list-margin-block-start\)/s);
  assert.match(shortTermModules, /\.replaceableList\[data-empty="true"\],[\s\S]*\.textElementList\[data-empty="true"\]\s*\{[^}]*display:\s*none/s);
  assert.match(shortTermModules, /\.sectionHead\.assetSectionHead\s*\{[^}]*display: grid/s);
  assert.match(shortTermModules, /\.sectionHead\.assetSectionHead\s*\{[^}]*gap: var\(--asv-asset-section-head-gap\)/s);
  assert.match(shortTermModules, /\.sectionHead\.assetSectionHead h2\s*\{[^}]*white-space: nowrap/s);
  assert.match(shortTermModules, /\.assetFilterTabs\s*\{[^}]*width: min\(var\(--asv-asset-filter-width\), 100%\)/s);
  assert.match(shortTermModules, /\.assetFilterTabs\s*\{[^}]*min-height: var\(--asv-asset-filter-height\)/s);
  assert.match(shortTermModules, /\.assetFilterTabs button\s*\{[^}]*font-size: var\(--asv-asset-filter-tab-font-size\)/s);
  assert.match(shortTermModules, /\.layerPanel,\s*\.reservedPanel\s*\{[^}]*padding: var\(--asv-layer-panel-padding-block-start\) var\(--asv-layer-panel-padding\) var\(--asv-layer-panel-padding\)/s);
  assert.match(shortTermModules, /\.layerPanel\s*\{[^}]*gap: var\(--asv-layer-list-gap\)/s);
  assert.match(shortTermModules, /\.layerPanelHeader\s*\{[^}]*min-height: var\(--asv-layer-panel-header-height\)/s);
  assert.match(shortTermModules, /\.layerPanelHeader h1\s*\{[^}]*font-size: var\(--asv-layer-panel-header-title-size\)/s);
  assert.match(shortTermModules, /\.layerList\s*\{[^}]*gap: var\(--asv-layer-list-gap\)/s);
  assert.match(shortTermModules, /\.comparePlaybackBar\s*\{[^}]*pointer-events: none/s);
  assert.match(shortTermModules, /\.compareInfo\s*\{[^}]*gap: var\(--asv-right-panel-section-gap\)/s);
  assert.match(shortTermModules, /\.compareInfo\s*\{[^}]*padding: var\(--asv-right-panel-safe-padding-block-start\) var\(--asv-right-panel-padding\) var\(--asv-right-panel-padding\)/s);
  assert.match(shortTermTokens, /--asv-component-compare-mode-header-min-height: 54px/);
  assert.match(shortTermTokens, /--asv-compare-mode-header-divider: var\(--asv-component-compare-mode-header-divider\)/);
  assert.match(shortTermModules, /\.compareModeHeader\s*\{[^}]*min-height: var\(--asv-compare-mode-header-min-height\)/s);
  assert.match(shortTermModules, /\.compareModeHeader\s*\{[^}]*border-bottom: var\(--asv-compare-mode-header-divider\)/s);
  assert.match(shortTermModules, /\.compareCanvasHeader\s*\{[^}]*position: absolute/s);
  assert.match(shortTermModules, /\.compareCanvasHeader\s*\{[^}]*background: transparent/s);
  assert.match(shortTermModules, /\.layerPanel\s*\{[^}]*box-shadow: inset calc\(-1 \* var\(--asv-side-surface-separator-width\)\) 0 0 var\(--asv-side-surface-separator\)/s);
  assert.match(shortTermModules, /\.reservedPanel\s*\{[^}]*box-shadow: inset var\(--asv-side-surface-separator-width\) 0 0 var\(--asv-side-surface-separator\)/s);
  assert.match(shortTermModules, /background: var\(--asv-panel-chrome\)/);
  assert.match(shortTermModules, /\.resultGroup/);
  assert.match(shortTermModules, /\.resultGroup\s*\{[^}]*border: 0/s);
  assert.match(shortTermModules, /\.resultGroup\s*\{[^}]*box-shadow: none/s);
  assert.match(shortTermTokens, /--asv-component-optimization-result-row-padding-block: var\(--asv-base-space-4\)/);
  assert.match(shortTermTokens, /--asv-component-optimization-result-row-radius: var\(--asv-radius-md\)/);
  assert.match(shortTermModules, /\.resultGroup li\s*\{[^}]*padding: var\(--asv-optimization-result-row-padding-block\) var\(--asv-optimization-result-row-padding-inline\)/s);
  assert.match(shortTermModules, /\.resultGroup li\s*\{[^}]*background: var\(--asv-optimization-result-row-bg\)/s);
  assert.match(shortTermModules, /\.resultGroup\.muted li\s*\{[^}]*background: var\(--asv-optimization-result-muted-row-bg\)/s);
  assert.match(shortTermModules, /\.optimizationMetricGrid\s*\{[^}]*grid-template-columns: repeat\(2, minmax\(0, 1fr\)\)/s);
  assert.match(shortTermModules, /\.optimizationMetricCell\s*\{[^}]*min-height: var\(--asv-optimization-metric-min-height\)/s);
  assert.match(shortTermModules, /\.optimizationMetricValue em\s*\{[^}]*color: var\(--asv-success\)/s);
  assert.match(shortTermModules, /\.optimizationMetricValue \.factValueUnit\s*\{[^}]*opacity: var\(--asv-optimization-metric-unit-opacity\)/s);
  assert.match(shortTermModules, /\.optimizationActions\s*\{[^}]*grid-template-columns: minmax\(0, 1fr\)/s);
  assert.match(shortTermModules, /\.optimizationActions \.toolbarButton:not\(\.primary\)\s*\{[^}]*background: transparent/s);
  assert.match(shortTermModules, /\.optimizationActions \.toolbarButton:not\(\.primary\)\s*\{[^}]*min-height: var\(--asv-optimization-action-secondary-height\)/s);
  assert.match(shortTermModules, /\.optimizationActions \.toolbarButton:not\(\.primary\)\s*\{[^}]*box-shadow: none/s);
  assert.match(shortTermModules, /\.optimizationActions \.toolbarButton\[data-action="back-preview"\]\s*\{[^}]*color: var\(--asv-optimization-action-tertiary-color\)/s);
  assert.match(shortTermModules, /\.rightSurfaceBody:focus-visible/);
  assert.doesNotMatch(shortTermStyles, /scrollbar-gutter:\s*stable/);
  assert.match(shortTermTokens, /--asv-component-scrollable-surface-scrollbar-size: 0px/);
  assert.match(shortTermModules, /\.rightSurfaceBody,\s*\.compareInfo,\s*\.layerPanel,\s*\.reservedPanel\s*\{[^}]*scrollbar-width: none/s);
  assert.match(shortTermModules, /\.rightSurfaceBody::-webkit-scrollbar,[\s\S]*\.reservedPanel::-webkit-scrollbar\s*\{[^}]*width: var\(--asv-scrollable-surface-scrollbar-size\)[^}]*height: var\(--asv-scrollable-surface-scrollbar-size\)/s);
  assert.match(shortTermTokens, /--asv-component-save-banner-min-height/);
  assert.match(shortTermTokens, /--asv-save-banner-min-height: var\(--asv-component-save-banner-min-height\)/);
  assert.match(shortTermModules, /\.saveBanner\s*\{[^}]*min-height: var\(--asv-save-banner-min-height\)/s);
  assert.match(shortTermModules, /\.saveBanner\s*\{[^}]*border-bottom: var\(--asv-save-banner-border\)/s);
  assert.match(shortTermModules, /\.saveBanner::before\s*\{[^}]*display: none/s);
  assert.match(shortTermModules, /\.saveBanner\[data-status="success"\]::before/);
  assert.match(shortTermModules, /\.saveBanner\[data-status="loading"\]::before/);
  assert.doesNotMatch(shortTermModules, /\.canvasWrap\[data-canvas-label\]::before/);
  assert.match(shortTermModules, /\.playbackActions/);
  assert.match(shortTermModules, /\.playbackBar\s*\{[^}]*position: absolute/s);
  assert.match(shortTermModules, /\.playbackBar\s*\{[^}]*background: transparent/s);
  assert.match(shortTermModules, /\.playbackIconButton/);
  assert.match(shortTermModules, /\.playbackIconButton\s*\{[^}]*width: var\(--asv-icon-button-size\)/s);
  assert.match(shortTermModules, /\.playbackIconButton\s*\{[^}]*border-radius: var\(--asv-icon-button-radius\)/s);
  assert.match(shortTermModules, /\.playbackIconButton\s*\{[^}]*background: var\(--asv-icon-button-secondary-bg\)/s);
  assert.match(shortTermModules, /\.playbackIconButton\s*\{[^}]*box-shadow: var\(--asv-icon-button-shadow\)/s);
  assert.match(shortTermModules, /\.playbackIconButton\.primary\s*\{[^}]*background: var\(--asv-icon-button-primary-bg\)/s);
  assert.match(shortTermModules, /\.playbackIconButton\[data-playback-state="playing"\] \.playbackIconPause/);
  assert.match(shortTermModules, /var\(--asv-icon-button-icon-size\)/);
  assert.match(shortTermModules, /\.playbackProgress/);
  assert.match(shortTermModules, /grid-template-columns:[\s\S]*minmax\(var\(--asv-playback-progress-min-width\), var\(--asv-playback-progress-track-fr\)\)[\s\S]*minmax\(0, var\(--asv-playback-end-spacer-fr\)\)/);
  assert.match(shortTermModules, /\.playbackProgress\s*\{[^}]*background: var\(--asv-playback-progress-track-bg\)/s);
  assert.match(shortTermModules, /\.playbackProgress\s*\{[^}]*box-shadow: var\(--asv-playback-progress-track-ring\)/s);
  assert.doesNotMatch(shortTermModules, /\.playbackProgress\s*\{[^}]*color-mix\(in srgb, var\(--asv-color-border-default\)/s);
  assert.match(shortTermModules, /--asv-playback-progress: 0%/);
  assert.match(shortTermModules, /width: var\(--asv-playback-progress\)/);
  assert.match(shortTermModules, /\.playbackTime/);
  assert.match(shortTermModules, /\.playbackMeta/);
  assert.doesNotMatch(shortTermModules, /\.textPreviewActions/);
  assert.match(shortTermModules, /\.compareCanvasHeader/);
  assert.match(shortTermModules, /\.compareCanvasHeader\s*\{[^}]*display: none/s);
  assert.doesNotMatch(shortTermModules, /\.compareCanvasHeader\s*\{[^}]*display: grid/s);
  assert.match(shortTermModules, /\.comparePairHeader/);
  assert.doesNotMatch(shortTermModules, /\.compareMetricRow/);
  assert.match(shortTermModules, /\.compareMetricColumn/);
  assert.match(shortTermModules, /\.compareMetricCell\s*\{[^}]*gap: var\(--asv-compare-metric-cell-gap\)[^}]*min-height: var\(--asv-compare-metric-row-min-height\)/s);
  assert.match(shortTermModules, /\.compareMetricCell span,[\s\S]*\.optimizationMetricCell span\s*\{[^}]*font-size: var\(--asv-fact-cell-label-size\)[^}]*line-height: var\(--asv-fact-cell-label-line-height\)/s);
  assert.match(shortTermModules, /\.compareMetricCell strong,[\s\S]*\.optimizationMetricValue\s*\{[^}]*font-size: var\(--asv-fact-cell-value-size\)[^}]*line-height: var\(--asv-fact-cell-value-line-height\)/s);
  assert.equal((shortTermModules.match(/\.compareMetricCell\s*\{/g) ?? []).length, 1);
  assert.match(shortTermModules, /\.optimizationMetricCell/);
  assert.match(shortTermModules, /\.compareSummary/);
  assert.match(shortTermModules, /\.compareSummary\s*\{[^}]*border-bottom: 0/s);
  assert.match(shortTermModules, /\.compareModeHeader/);
  assert.match(shortTermModules, /\.compareMetricGrid/);
  assert.match(shortTermModules, /\.compareActions/);
  assert.match(shortTermModules, /\.compareActions \.toolbarButton\.primary\s*\{[^}]*background: var\(--asv-action\)/s);
  assert.match(shortTermModules, /\.compareStage\s*\{[^}]*gap: var\(--asv-compare-canvas-gap\)/s);
  assert.match(shortTermModules, /\.dragDecisionOverlay/);
  assert.match(shortTermModules, /\.canvasToast/);
  assert.match(shortTermModules, /\.canvasToast\s*\{[^}]*width: min\(var\(--asv-toast-failure-width\), 60%\)/s);
  assert.match(shortTermModules, /\.canvasToast\s*\{[^}]*min-height: var\(--asv-toast-height\)/s);
  assert.match(shortTermModules, /\.canvasToast\s*\{[^}]*border-radius: var\(--asv-toast-radius\)/s);
  assert.match(shortTermModules, /var\(--asv-drag-overlay-bg\)/);
  assert.match(shortTermModules, /var\(--asv-drag-supported-bg\)/);
  assert.match(shortTermModules, /var\(--asv-drag-unsupported-bg\)/);
  assert.match(shortTermModules, /\.dragDecisionOverlay\s*\{[^}]*grid-template-columns: 1fr/s);
  assert.match(shortTermTokens, /--asv-component-drag-overlay-grid-rows: 1fr 3fr/);
  assert.match(shortTermTokens, /--asv-drag-overlay-grid-rows: var\(--asv-component-drag-overlay-grid-rows\)/);
  assert.doesNotMatch(shortTermModules, /\.launchCanvas:has\(\.recentBlock:not\(\[hidden\]\)\)/);
  assert.doesNotMatch(shortTermModules, /padding-top: calc\(var\(--asv-toolbar-height\) \+ var\(--asv-launch-content-offset-block-start\)\)/);
  assert.match(shortTermModules, /\.dragDecisionOverlay\s*\{[^}]*grid-template-rows: var\(--asv-drag-overlay-grid-rows\)/s);
  assert.match(shortTermModules, /\.dragDecisionOverlay\s*\{[^}]*backdrop-filter: var\(--asv-drag-overlay-backdrop-filter\)/s);
  assert.match(shortTermModules, /\.dragDecisionZone\s*\{[^}]*opacity: var\(--asv-drag-zone-opacity\)/s);
  assert.match(shortTermModules, /\.dragDecisionZone strong\s*\{[^}]*font-size: var\(--asv-drag-overlay-label-size\)/s);
  assert.match(shortTermModules, /\.dragDecisionZone strong\s*\{[^}]*font-weight: var\(--asv-drag-overlay-label-weight\)/s);
  assert.match(shortTermModules, /opacity: var\(--asv-drag-zone-focus-opacity\)/);
  assert.match(shortTermPageStates, /\.macApp\[data-app-state="launch"\]/);
  assert.match(shortTermStyles, /body\s*\{[^}]*min-width: var\(--asv-launch-min-width\)[^}]*min-height: var\(--asv-launch-min-height\)/s);
  assert.match(shortTermPageStates, /\.macApp\s*\{[^}]*min-width: var\(--asv-launch-min-width\)[^}]*min-height: var\(--asv-launch-min-height\)/s);
  assert.match(shortTermPageStates, /\.macApp\[data-app-state="preview"\],[\s\S]*\.macApp\[data-app-state="failed"\]\s*\{[^}]*min-width: var\(--asv-workbench-min-width\)[^}]*min-height: var\(--asv-workbench-min-height\)/s);
  assert.match(shortTermPageStates, /\.launchView\s*\{[^}]*place-items: stretch/s);
  assert.match(shortTermPageStates, /\.saveBanner\s*\{[^}]*grid-row: 1/s);
  assert.match(shortTermPageStates, /\.macApp\[data-app-state="preview"\] \.view,[\s\S]*\.macApp\[data-app-state="failed"\] \.view\s*\{[^}]*grid-row: 2/s);
  assert.match(shortTermPageStates, /\.previewView,\s*\.workbenchStateView\s*\{[^}]*grid-template-rows: minmax\(0, 1fr\)/s);
  assert.match(shortTermPageStates, /\.compareView\s*\{[^}]*grid-template-rows: minmax\(0, 1fr\)/s);
  assert.match(shortTermPageStates, /\.editView\s*\{[^}]*grid-template-columns: var\(--asv-left-width\) minmax\(var\(--asv-edit-canvas-min-width\), 1fr\) minmax\(var\(--asv-edit-right-panel-min-width\), var\(--asv-right-panel-width\)\)/s);
  assert.match(shortTermPageStates, /\.editView\s*\{[^}]*grid-template-rows: minmax\(0, 1fr\)/s);
  assert.match(shortTermPageStates, /\.editView\s*\{[^}]*gap: var\(--asv-edit-view-gap\)/s);
  assert.match(shortTermPageStates, /\.editView\s*\{[^}]*padding: var\(--asv-edit-view-padding\)/s);
  assert.match(shortTermPageStates, /\.previewView/);
  assert.match(shortTermPageStates, /\.compareView/);
  assert.match(shortTermPageStates, /\.editView/);
  assert.match(shortTermPageStates, /--asv-right-panel-width/);
  assert.doesNotMatch(shortTermPageStates, /inspector/);
  assert.match(shortTermPageStates, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(shortTermPageStates, /\.launchCanvas\s*\{[^}]*animation: none !important/s);
  assert.match(shortTermPageStates, /\.launchCanvas\s*\{[^}]*background-position: 0 0, 0 0 !important/s);
  assert.match(shortTermPageStates, /--asv-effect-drag-overlay-backdrop-filter: none/);
  assert.match(shortTermPageStates, /\.dragDecisionOverlay\s*\{[^}]*backdrop-filter: none/s);
  assert.match(shortTermPageStates, /@media \(max-height: 780px\)/);
  assert.match(shortTermStyles, /\[hidden\]\s*\{\s*display: none !important;/);
  assert.doesNotMatch(shortTermStyles, /button\.primary:disabled/);
  assert.doesNotMatch(shortTermStyles, /\.toolbarCluster|\.resultGroup|\.previewView|\.compareView/);
  assert.doesNotMatch(shortTermEntry, /from "\.\/short-term-macos-dom-renderers\.mjs"/);
  assert.match(shortTermPreviewSurface, /from "\.\/short-term-macos-edit-reserved-renderers\.mjs"/);
  assert.match(shortTermCompareSurface, /from "\.\/short-term-macos-compare-renderers\.mjs"/);
  assert.match(shortTermRecentFilesSurface, /from "\.\/short-term-macos-launch-renderers\.mjs"/);
  assert.match(shortTermPreviewSurface, /from "\.\/short-term-macos-overview-renderers\.mjs"/);
  assert.match(shortTermResourceMenuSurface, /from "\.\/short-term-macos-resource-menu-renderers\.mjs"/);
  assert.match(shortTermFeedbackSurface, /from "\.\/short-term-macos-save-renderers\.mjs"/);
  assert.match(shortTermController, /from "\.\/short-term-macos-state-renderers\.mjs"/);
  assert.match(shortTermRuntimeTextSurface, /from "\.\/short-term-macos-text-renderers\.mjs"/);
  assert.match(shortTermController, /from "\.\/short-term-macos-replaceable-surface\.mjs"/);
  assert.match(shortTermController, /from "\.\/short-term-macos-output-surface\.mjs"/);
  assert.match(shortTermController, /from "\.\/short-term-macos-file-surface\.mjs"/);
  assert.match(shortTermController, /from "\.\/short-term-macos-runtime-text-surface\.mjs"/);
  assert.match(shortTermController, /from "\.\/short-term-macos-settings-surface\.mjs"/);
  assert.match(shortTermState, /loadStoredAppearance/);
  assert.match(shortTermAppearanceModel, /APPEARANCE_VALUES = Object\.freeze\(\["system", "light", "dark"\]\)/);
  assert.match(shortTermSettingsSurface, /applyShortTermAppearance/);
  assert.match(shortTermSettingsSurface, /openShortTermSettings/);
  assert.match(shortTermController, /async function openCompareAFromHost/);
  assert.match(shortTermEventBindings, /action === "open-compare-a"/);
  assert.match(shortTermCommandState, /appearance/);
  assert.match(shortTermCommandState, /compare: \{ enabled: true, reason: "" \}/);
  assert.match(shortTermCommandState, /canCompare: true/);
  assert.match(shortTermCommandSurface, /appearance: state\.appearance/);
  assert.match(shortTermActionBridge, /openSettings: handlers\.openSettings/);
  assert.match(shortTermActionBridge, /setAppearance: handlers\.setAppearance/);
  assert.match(shortTermEventBindings, /data-appearance-choice/);
  assert.match(main, /label: "设置\.\.\."/);
  assert.match(main, /label: "外观"/);
  assert.match(main, /label: "跟随系统"/);
  assert.match(main, /invokeShortTermAction\("setAppearance", "dark", \{ persist: true \}\)/);
  assert.match(shortTermCompareSurface, /applyCompareSlotView/);
  assert.match(shortTermCompareSurface, /applyCompareTraceView/);
  assert.match(shortTermRuntimeTextSurface, /applyRuntimeTextOverlay/);
  assert.match(shortTermRuntimeTextSurface, /clearRuntimeTextOverlay/);
  assert.match(shortTermFeedbackSurface, /clearSaveFeedbackBanner/);
  assert.match(shortTermResourceMenuSurface, /hideResourceContextMenu/);
  assert.match(shortTermFeedbackSurface, /hideSaveFeedbackBanner/);
  assert.match(shortTermCompareSurface, /markCompareSlotLoaded/);
  assert.match(shortTermOptimizationSurface, /prependOptimizationResult/);
  assert.match(shortTermPreviewSurface, /renderAssetList/);
  assert.match(shortTermCompareSurface, /renderCompareInfoPanel/);
  assert.match(shortTermController, /renderDiscardMessage/);
  assert.match(shortTermFeedbackSurface, /renderFailureMessage/);
  assert.match(shortTermPreviewSurface, /renderFileHeader/);
  assert.match(shortTermFileSurface, /renderLoadingMessage/);
  assert.match(shortTermOptimizationSurface, /renderOptimizationFindings/);
  assert.match(shortTermPreviewSurface, /renderOverviewFacts/);
  assert.match(shortTermReplaceableSurface, /renderReplaceableImages/);
  assert.match(shortTermReplaceableSurface, /renderRuntimeTextElements/);
  assert.match(shortTermFeedbackSurface, /showSaveFeedbackBanner/);
  assert.match(shortTermOutputSurface, /showShortTermSaveBanner/);
  assert.match(shortTermResourceMenuSurface, /showResourceContextMenu/);
  assert.match(shortTermCommandSurface, /from "\.\/short-term-macos-command-state\.mjs"/);
  assert.match(shortTermCommandSurface, /buildCommandState/);
  assert.match(shortTermController, /from "\.\/short-term-macos-compare-surface\.mjs"/);
  assert.match(shortTermController, /from "\.\/short-term-macos-drag-decision-surface\.mjs"/);
  assert.match(shortTermController, /showCanvasDragDecision/);
  assert.match(shortTermController, /dropCanvasFile/);
  assert.match(shortTermController, /resetShortTermLaunchSurface/);
  assert.match(shortTermCompareSurface, /from "\.\/short-term-macos-compare-model\.mjs"/);
  assert.match(shortTermCompareSurface, /from "\.\/short-term-macos-compare-renderers\.mjs"/);
  assert.match(shortTermCompareSurface, /renderCompareInfoHtml/);
  assert.match(shortTermCompareSurface, /renderOptimizationCompareResultHtml/);
  assert.match(shortTermCompareSurface, /renderGeneralComparePlaceholderHtml/);
  assert.doesNotMatch(shortTermEntry, /from "\.\/short-term-macos-compare-model\.mjs"|from "\.\/short-term-macos-compare-renderers\.mjs"|renderCompareInfoHtml|renderOptimizationCompareResultHtml|renderGeneralComparePlaceholderHtml|applyCompareSlotView|applyCompareTraceView|markCompareSlotLoaded|renderCompareInfoPanel/);
  assert.match(shortTermDragDecisionModel, /isSupportedShortTermDropFile/);
  assert.match(shortTermDragDecisionModel, /\.svga\$\/i/);
  assert.match(shortTermDragDecisionModel, /SHORT_TERM_DRAG_DECISION_OPEN_RATIO = 0\.75/);
  assert.match(shortTermDragDecisionModel, /SHORT_TERM_DRAG_DECISION_COMPARE_RATIO = 1 - SHORT_TERM_DRAG_DECISION_OPEN_RATIO/);
  assert.match(shortTermDragDecisionModel, /dragDecisionZoneForEvent/);
  assert.match(shortTermDragDecisionModel, /event\.clientY < compareBoundary \? "compare" : "open"/);
  assert.doesNotMatch(shortTermDragDecisionModel, /event\.clientX <|rect\.left \+ rect\.width \/ 2/);
  assert.match(shortTermDragDecisionSurface, /showShortTermDragDecisionOverlay/);
  assert.match(shortTermDragDecisionSurface, /showShortTermCanvasToast/);
  assert.match(shortTermDragDecisionSurface, /不支持的文件格式/);
  assert.match(shortTermController, /from "\.\/short-term-macos-feedback-surface\.mjs"/);
  assert.match(shortTermOutputSurface, /showShortTermOutputBanner/);
  assert.match(shortTermController, /showShortTermOutputBanner\(\{ nodes, title, message, tone \}\)/);
  assert.match(shortTermController, /showShortTermFailure\(\{ nodes, setView \}, error\)/);
  assert.match(shortTermController, /showShortTermOperationFailure\(\{ nodes, state, setMode, renderCommandState \}, title, error\)/);
  assert.match(shortTermController, /shortTermCurrentStateSummary\(\{ nodes, state \}\)/);
  assert.match(shortTermFeedbackSurface, /from "\.\/short-term-macos-feedback-model\.mjs"/);
  assert.match(shortTermFeedbackSurface, /buildCurrentStateSummary/);
  assert.match(shortTermFeedbackSurface, /sourceUnmodifiedMessage/);
  assert.doesNotMatch(shortTermEntry, /showSaveFeedbackBanner|clearSaveFeedbackBanner|hideSaveFeedbackBanner|renderFailureMessage|buildCurrentStateSummary|sourceUnmodifiedMessage/);
  assert.match(shortTermOutputSurface, /clearShortTermSaveBanner\(nodes\)/);
  assert.doesNotMatch(shortTermOutputSurface, /showShortTermOutputBanner\(\{ nodes, title, message: summary \}\)/);
  assert.match(shortTermOutputSurface, /state\.activeOutput = \{/);
  assert.match(shortTermOutputSurface, /state\.saveStatus = "dirty"/);
  assert.match(shortTermOutputSurface, /state\.saveStatus = "idle"/);
  assert.doesNotMatch(shortTermEntry, /state\.activeOutput = \{[\s\S]*state\.saveStatus = "dirty"|clearShortTermSaveBanner\(nodes\)/);
  assert.doesNotMatch(shortTermEntry, /saveBannerView/);
  assert.doesNotMatch(shortTermEntry, /saveBanner\.innerHTML = `<strong>\$\{escapeHtml\(title\)\}/);
  assert.doesNotMatch(shortTermEntry, /\$\{message \|\| "未知错误"\} 源文件没有被修改。/);
  assert.match(shortTermController, /from "\.\/short-term-macos-recent-files-surface\.mjs"/);
  assert.match(shortTermController, /refreshShortTermRecentFiles\(\{ bridge, nodes \}\)/);
  assert.match(shortTermController, /clearShortTermRecentFiles\(\{ bridge, nodes \}\)/);
  assert.match(shortTermRecentFilesSurface, /visibleLaunchRecentRecords/);
  assert.match(shortTermRecentFilesSurface, /renderLaunchRecentFiles/);
  assert.match(shortTermRecentFilesSurface, /renderRecentFilesUnavailable/);
  assert.match(shortTermRecentFilesSurface, /from "\.\/short-term-macos-recent-files-model\.mjs"/);
  assert.match(shortTermRecentFilesSurface, /from "\.\/short-term-macos-host-client\.mjs"/);
  assert.match(shortTermHostClient, /export async function getRecentSvgaFiles/);
  assert.match(shortTermHostClient, /export async function clearRecentSvgaFiles/);
  assert.match(shortTermHostClient, /export function syncShortTermMenuState/);
  assert.match(shortTermHostClient, /export function syncShortTermWindowMode/);
  assert.match(shortTermController, /state\.lastMenuStateSnapshot = renderShortTermCommandSurface/);
  assert.match(shortTermController, /syncShortTermWindowMode/);
  assert.match(shortTermState, /lastWindowModeSnapshot:\s*""/);
  assert.match(shortTermCommandSurface, /syncShortTermMenuState/);
  assert.doesNotMatch(shortTermEntry, /bridge\.getRecentSvgaFiles|bridge\.clearRecentSvgaFiles|bridge\.updateShortTermMenuState|bridge\.setShortTermWindowMode|visibleLaunchRecentRecords|renderLaunchRecentFiles|renderRecentFilesUnavailable/);
  assert.match(shortTermHostClient, /bridge\.getRecentSvgaFiles/);
  assert.match(shortTermHostClient, /bridge\.clearRecentSvgaFiles/);
  assert.match(shortTermHostClient, /bridge\.updateShortTermMenuState/);
  assert.match(shortTermHostClient, /bridge\.setShortTermWindowMode/);
  assert.match(shortTermController, /view === "launch" \|\| \(view === "failed" && !state\.sourceBytes\)/);
  assert.doesNotMatch(shortTermEntry, /暂无最近打开记录|仅显示文件名和父级位置|最近文件由 macOS 客户端提供/);
  assert.match(shortTermController, /from "\.\/short-term-macos-save-surface\.mjs"/);
  assert.match(shortTermSaveSurface, /from "\.\/short-term-macos-save-model\.mjs"/);
  assert.match(shortTermSaveSurface, /saveProofSourceImageKey/);
  assert.match(shortTermSaveSurface, /saveProofImageKey/);
  assert.match(shortTermSaveSurface, /createSaveFailureProofActiveOutput/);
  assert.doesNotMatch(shortTermEntry, /保存失败验证输出/);
  assert.match(shortTermController, /from "\.\/short-term-macos-dom-state\.mjs"/);
  assert.match(shortTermEntry, /from "\.\/short-term-macos-nodes\.mjs"/);
  assert.match(shortTermEntry, /collectShortTermNodes/);
  assert.doesNotMatch(shortTermEntry, /const nodes = \{\s*app: document\.querySelector\("\.macApp"\)/);
  assert.match(shortTermNodes, /export function collectShortTermNodes\(\)/);
  assert.match(shortTermNodes, /app: document\.querySelector\("\.macApp"\)/);
  assert.match(shortTermNodes, /replacementFileInput: document\.querySelector\("#replacementFileInput"\)/);
  assert.match(shortTermController, /from "\.\/short-term-macos-command-surface\.mjs"/);
  assert.match(shortTermCommandSurface, /export function renderShortTermCommandSurface/);
  assert.match(shortTermCommandSurface, /buildCommandState\(\{/);
  assert.match(shortTermCommandSurface, /applyCommandState\(commandState\)/);
  assert.match(shortTermCommandSurface, /dialogOpen: hasOpenDialog\(documentRef\)/);
  assert.match(shortTermController, /applyViewState/);
  assert.match(shortTermController, /applyModeButtons/);
  assert.match(shortTermController, /from "\.\/short-term-macos-navigation-surface\.mjs"/);
  assert.match(shortTermNavigationSurface, /applyTabState/);
  assert.match(shortTermReplaceableSurface, /setActionEnabled/);
  assert.match(shortTermCommandState, /export function buildCommandState/);
  assert.match(shortTermCommandState, /actionStates/);
  assert.doesNotMatch(shortTermEntry, /applyCommandState\(commandState\)|buildCommandState\(\{|dialogOpen: hasOpenDialog\(document\)/);
  assert.doesNotMatch(shortTermEntry, /Object\.entries\(commandState\.actionStates\)|document\.querySelector\("\[data-action='play-pause'\]"\)\.textContent = commandState\.playPauseCopy/);
  assert.match(shortTermDomState, /Object\.entries\(commandState\.actionStates\)/);
  assert.match(shortTermDomState, /setActionEnabled\(action, actionState\.enabled, actionState\.reason\)/);
  assert.match(shortTermDomState, /playPauseButton\.dataset\.playbackState = playing \? "playing" : "paused"/);
  assert.match(shortTermDomState, /playPauseButton\.setAttribute\("aria-label", commandState\.playPauseCopy\)/);
  assert.match(shortTermDomState, /loopButton\.classList\.toggle\("isSelected", commandState\.loopEnabled === true\)/);
  assert.match(shortTermDomState, /loopButton\.setAttribute\("aria-pressed", commandState\.loopEnabled === true \? "true" : "false"\)/);
  assert.doesNotMatch(shortTermDomState, /textContent = commandState\.playPauseCopy/);
  assert.match(shortTermCommandState, /"loop-toggle": \{ enabled: hasFile, reason: "请先打开 SVGA" \}/);
  assert.match(shortTermCommandState, /"run-optimization": \{ enabled: canRunOptimization, reason: "没有可安全执行的优化项" \}/);
  assert.match(shortTermCommandState, /"save-overwrite": \{ enabled: canOverwrite/);
  assert.match(shortTermCommandState, /playPauseCopy: input\.primaryPlaybackPlaying \? "暂停" : "播放"/);
  assert.match(shortTermCommandState, /loopEnabled: input\.primaryPlaybackLooping !== false/);
  assert.match(main, /label: "循环播放"[\s\S]*type: "checkbox"[\s\S]*click: \(\) => invokeShortTermAction\("toggleLoop"\)/);
  assert.match(shortTermCommandState, /canShowOptimizationComparison/);
  assert.match(shortTermCommandState, /hasTransientState/);
  assert.match(shortTermCompareModel, /export function renderCompareInfoHtml/);
  assert.match(shortTermCompareModel, /export function compareSlotMeta/);
  assert.match(shortTermCompareModel, /export function compareSlotView/);
  assert.match(shortTermCompareModel, /export function generalCompareTraceView/);
  assert.match(shortTermCompareModel, /export function optimizationCompareTraceView/);
  assert.match(shortTermCompareModel, /GeneralCompareModule/);
  assert.match(shortTermCompareModel, /OptimizationCompareModule/);
  assert.match(shortTermCompareModel, /export function renderOptimizationCompareResultHtml/);
  assert.match(shortTermCompareModel, /export function renderGeneralComparePlaceholderHtml/);
  assert.match(shortTermCompareModel, /export function renderGeneralComparePanelHtml/);
  assert.match(shortTermCompareModel, /class="toolbarButton compareExitButton" type="button" data-action="back-preview">退出对比/);
  assert.match(shortTermCompareModel, /if \(!aModel \|\| !bModel\) return ""/);
  assert.match(shortTermCompareModel, /const rows = renderCompareMetricColumns\(aModel, bModel\)/);
  assert.match(shortTermCompareModel, /rows \? `<section class="compareMetricGrid" aria-label="对比信息">/);
  assert.match(shortTermCompareModel, /comparePairHeader/);
  assert.doesNotMatch(shortTermCompareModel, /<span>\$\{escapeHtml\(aTitle\)\}<\/span>|<span>\$\{escapeHtml\(bTitle\)\}<\/span>/);
  assert.match(shortTermCompareModel, /compareModeHeader/);
  assert.doesNotMatch(shortTermCompareModel, /compareMetricRow/);
  assert.match(shortTermCompareModel, /compareMetricColumn/);
  assert.match(shortTermCompareModel, /data-diff/);
  assert.match(shortTermCompareModel, /renderCompareFactCellHtml/);
  assert.match(shortTermCompareModel, /renderOptimizationMetricCellHtml/);
  assert.doesNotMatch(shortTermCompareModel, /renderCompareMetricCellHtml/);
  assert.match(shortTermCompareModel, /data-optimization-actions/);
  assert.match(shortTermCompareModel, /data-optimization-skipped/);
  assert.doesNotMatch(shortTermCompareModel, /打开另一个 SVGA 后开始对比/);
  assert.doesNotMatch(shortTermEditReservedRenderers, /export function createOverviewFactCell|export function createAssetRow|export function renderOverviewFacts|export function renderAssetList|renderOverviewFactCellHtml/);
  assert.match(shortTermOverviewRenderers, /export function createOverviewFactCell/);
  assert.match(shortTermOverviewRenderers, /export function createOverviewMoreInfoDisclosure/);
  assert.match(shortTermOverviewRenderers, /cell\.dataset\.factId = fact\.id/);
  assert.match(shortTermOverviewRenderers, /export function createAssetRow/);
  assert.match(shortTermOverviewRenderers, /export function renderOverviewFacts/);
  assert.match(shortTermOverviewRenderers, /export function renderAssetList/);
  assert.match(shortTermOverviewRenderers, /renderOverviewFactCellHtml/);
  assert.match(shortTermOverviewRenderers, /RuntimeStructureMoreInfo/);
  assert.doesNotMatch(shortTermEditReservedRenderers, /export function createOptimizationFindingRow|export function renderOptimizationFindings|export function prependOptimizationResult|export function createMessageRow|renderOptimizationFindingHtml|renderMessageRowHtml/);
  assert.match(shortTermOptimizationRenderers, /export function createOptimizationFindingRow/);
  assert.match(shortTermOptimizationRenderers, /export function renderOptimizationFindings/);
  assert.match(shortTermOptimizationRenderers, /export function prependOptimizationResult/);
  assert.match(shortTermOptimizationRenderers, /export function createMessageRow/);
  assert.match(shortTermOptimizationRenderers, /from "\.\/short-term-macos-inline-status-renderers\.mjs"/);
  assert.doesNotMatch(shortTermEditReservedRenderers, /export function createInlineStatusText/);
  assert.doesNotMatch(shortTermEditReservedRenderers, /from "\.\/short-term-macos-inline-status-renderers\.mjs"/);
  assert.match(shortTermInlineStatusRenderers, /export function createInlineStatusText/);
  assert.doesNotMatch(shortTermEditReservedRenderers, /export function showSaveFeedbackBanner|export function hideSaveFeedbackBanner|export function clearSaveFeedbackBanner|saveBannerView/);
  assert.match(shortTermSaveRenderers, /export function showSaveFeedbackBanner/);
  assert.match(shortTermSaveRenderers, /export function hideSaveFeedbackBanner/);
  assert.match(shortTermSaveRenderers, /export function clearSaveFeedbackBanner/);
  assert.match(shortTermSaveRenderers, /saveBannerView/);
  assert.match(shortTermSaveRenderers, /node\.innerHTML = view\.html/);
  assert.doesNotMatch(shortTermEditReservedRenderers, /export function renderLoadingMessage|export function renderFileHeader|export function renderDiscardMessage|export function renderFailureMessage/);
  assert.match(shortTermStateRenderers, /export function renderLoadingMessage/);
  assert.match(shortTermStateRenderers, /export function renderFileHeader/);
  assert.match(shortTermStateRenderers, /export function renderDiscardMessage/);
  assert.match(shortTermStateRenderers, /export function renderFailureMessage/);
  assert.match(shortTermStateRenderers, /nodes\.loadingMessage\.textContent = copy/);
  assert.match(shortTermStateRenderers, /nodes\.fileIdentity\.textContent = displayName/);
  assert.match(shortTermStateRenderers, /nodes\.discardMessage\.textContent = copy/);
  assert.match(shortTermStateRenderers, /nodes\.errorMessage\.textContent = copy/);
  assert.doesNotMatch(shortTermEditReservedRenderers, /export function applyCompareSlotView|export function markCompareSlotLoaded|export function applyCompareTraceView|export function renderCompareInfoPanel/);
  assert.match(shortTermCompareRenderers, /export function applyCompareSlotView/);
  assert.match(shortTermCompareRenderers, /export function markCompareSlotLoaded/);
  assert.match(shortTermCompareRenderers, /export function applyCompareTraceView/);
  assert.match(shortTermCompareRenderers, /export function renderCompareInfoPanel/);
  assert.doesNotMatch(shortTermEditReservedRenderers, /export function showResourceContextMenu|export function hideResourceContextMenu/);
  assert.match(shortTermResourceMenuRenderers, /export function showResourceContextMenu/);
  assert.match(shortTermResourceMenuRenderers, /export function hideResourceContextMenu/);
  assert.match(shortTermResourceMenuRenderers, /menu\.style\.left = view\.left/);
  assert.match(shortTermResourceMenuRenderers, /menu\.querySelector\("\[data-action='context-reset'\]"\)\.disabled = view\.resetDisabled/);
  assert.doesNotMatch(shortTermEditReservedRenderers, /export function applyRuntimeTextOverlay|export function clearRuntimeTextOverlay/);
  assert.match(shortTermTextRenderers, /export function applyRuntimeTextOverlay/);
  assert.match(shortTermTextRenderers, /export function clearRuntimeTextOverlay/);
  assert.doesNotMatch(shortTermEditReservedRenderers, /export function createReplaceableImageRow|export function renderReplaceableImages|export function createTextElementRow|export function renderRuntimeTextElements|ReplaceableImageRow|ReplaceableTextRow/);
  assert.match(shortTermReplaceableRenderers, /export function createReplaceableImageRow/);
  assert.match(shortTermReplaceableRenderers, /export function renderReplaceableImages/);
  assert.match(shortTermReplaceableRenderers, /export function renderReplaceableEmptyState/);
  assert.match(shortTermReplaceableRenderers, /export function createTextElementRow/);
  assert.match(shortTermReplaceableRenderers, /export function renderRuntimeTextElements/);
  assert.match(shortTermReplaceableRenderers, /createReplaceableEmptyStatus/);
  assert.doesNotMatch(shortTermReplaceableRenderers, /createInlineStatusText\(/);
  assert.match(shortTermReplaceableRenderers, /from "\.\/short-term-macos-thumbnail-renderers\.mjs"/);
  assert.match(shortTermEditReservedRenderers, /export function createEditLayerRow/);
  assert.match(shortTermEditReservedRenderers, /export function renderEditReservedLayers/);
  assert.doesNotMatch(shortTermEditReservedRenderers, /function renderThumbnailHtml|isSafeImageDataUrl/);
  assert.match(shortTermEditReservedRenderers, /from "\.\/short-term-macos-thumbnail-renderers\.mjs"/);
  assert.match(shortTermOverviewRenderers, /from "\.\/short-term-macos-thumbnail-renderers\.mjs"/);
  assert.match(shortTermThumbnailRenderers, /export function renderThumbnailHtml/);
  assert.match(shortTermThumbnailRenderers, /isSafeImageDataUrl/);
  assert.match(shortTermThumbnailRenderers, /sequence-four-grid/);
  assert.match(shortTermDomState, /export function applyViewState/);
  assert.match(shortTermDomState, /export function applyModeButtons/);
  assert.match(shortTermDomState, /export function applyTabState/);
  assert.match(shortTermDomState, /export function setActionEnabled/);
  assert.match(shortTermDomState, /export function applyCommandState/);
  assert.match(shortTermDomState, /document\.querySelectorAll\("\[data-view\]"\)/);
  assert.match(shortTermDomState, /const activePanel = tab === "optimization" \? "optimization" : "overview"/);
  assert.match(shortTermDomState, /scrollIntoView\?\.\(\{ block: "nearest" \}\)/);
  assert.match(shortTermDomState, /aria-pressed/);
  assert.match(shortTermFeedbackModel, /export function bannerTone/);
  assert.match(shortTermFeedbackModel, /export function saveBannerView/);
  assert.match(shortTermFeedbackModel, /export function sourceUnmodifiedMessage/);
  assert.match(shortTermFeedbackModel, /escapeHtml\(title\)/);
  assert.match(shortTermFeedbackModel, /const messageHtml = message \?/);
  assert.match(shortTermFeedbackModel, /escapeHtml\(message\)/);
  assert.match(shortTermFeedbackModel, /源文件没有被修改。/);
  assert.match(shortTermFileSurface, /renderLoadingMessage\(nodes, ""\)/);
  assert.doesNotMatch(shortTermFileSurface, /正在打开最近文件。|解析文件并准备预览。/);
  assert.match(shortTermFileSurface, /renderFileHeader\(nodes, "等待打开文件", "-"\)/);
  assert.match(shortTermPreviewSurface, /renderFileHeader\(nodes, state\.displayName, overviewView\.playbackMeta\)/);
  assert.match(shortTermController, /renderMessage: \(copy\) => renderDiscardMessage\(nodes, copy\)/);
  assert.match(shortTermDialogModel, /renderMessage\(message\)/);
  assert.match(shortTermFeedbackSurface, /renderFailureMessage\(nodes, sourceUnmodifiedMessage\(message\)\)/);
  assert.match(shortTermFileSurface, /state\.sourceBytes = new Uint8Array\(bytes\)/);
  assert.match(shortTermFileSurface, /state\.sourceBytes = undefined/);
  assert.match(shortTermFileSurface, /clearRuntimeTextOverlay\(nodes\.runtimeTextOverlay\)/);
  assert.match(shortTermFileSurface, /hideShortTermSaveBanner\(nodes\)/);
  assert.doesNotMatch(shortTermEntry, /nodes\.(loadingMessage|fileIdentity|playbackMeta|discardMessage|errorMessage)\.textContent\s*=/);
  assert.doesNotMatch(shortTermEntry, /renderLoadingMessage\(nodes, "正在打开最近文件。"\)|renderLoadingMessage\(nodes, "解析文件并准备预览。"\)|renderFileHeader\(nodes, "等待打开文件", "-"\)|state\.sourceBytes = new Uint8Array\(bytes\)|state\.sourceBytes = undefined|hideShortTermSaveBanner\(nodes\)/);
  assert.match(shortTermStateRenderers, /nodes\.loadingMessage\.textContent = copy/);
  assert.match(shortTermStateRenderers, /nodes\.fileIdentity\.textContent = displayName/);
  assert.match(shortTermStateRenderers, /nodes\.playbackMeta\.textContent = playbackMeta/);
  assert.match(shortTermStateRenderers, /nodes\.discardMessage\.textContent = copy/);
  assert.match(shortTermStateRenderers, /nodes\.errorMessage\.textContent = copy/);
  assert.match(shortTermPreviewSurface, /renderOverviewFacts\(nodes, overviewView\)/);
  assert.match(shortTermPreviewSurface, /renderAssetList\(nodes, overviewView, model, state\.assetFilter\)/);
  assert.doesNotMatch(shortTermEntry, /createOverviewFactCell|createAssetRow|nodes\.factGrid\.replaceChildren|nodes\.assetList\.replaceChildren/);
  assert.match(shortTermOverviewRenderers, /nodes\.factGrid\.replaceChildren/);
  assert.match(shortTermOverviewRenderers, /nodes\.assetList\.replaceChildren/);
  assert.match(shortTermFeedbackModel, /export function buildCurrentStateSummary/);
  assert.match(shortTermFeedbackModel, /export function viewCopy/);
  assert.match(shortTermFeedbackModel, /Auto SVGA 状态摘要/);
  assert.match(shortTermFeedbackModel, /状态：\$\{viewCopy\(input\.view\)\}/);
  assert.match(shortTermFeedbackModel, /未保存输出：/);
  assert.match(shortTermRecentFilesModel, /export const LAUNCH_RECENT_LIMIT = 5/);
  assert.match(shortTermRecentFilesModel, /export function visibleLaunchRecentRecords/);
  assert.doesNotMatch(shortTermRecentFilesModel, /document\.createElement|innerHTML|replaceChildren|textContent|clearButton\.disabled|data-action="open-recent"/);
  assert.doesNotMatch(shortTermEditReservedRenderers, /export function renderLaunchRecentFiles|export function renderRecentFilesUnavailable|export function createRecentFileRow|export function createEmptyRecentFileRow/);
  assert.match(shortTermLaunchRenderers, /export function renderLaunchRecentFiles/);
  assert.match(shortTermLaunchRenderers, /export function renderRecentFilesUnavailable/);
  assert.match(shortTermLaunchRenderers, /listNode\.closest\("\.recentBlock"\)/);
  assert.match(shortTermLaunchRenderers, /recentBlock\.hidden = false/);
  assert.match(shortTermLaunchRenderers, /recentBlock\.dataset\.state = "unavailable"/);
  assert.match(shortTermLaunchRenderers, /recentBlock\.dataset\.state = records\.length === 0 \? "empty" : "ready"/);
  assert.match(shortTermLaunchRenderers, /clearButton\.disabled = records\.length === 0/);
  assert.match(shortTermLaunchRenderers, /data-action="open-recent"/);
  assert.match(shortTermLaunchRenderers, /data-recent-id/);
  assert.match(shortTermLaunchRenderers, /item\.dataset\.state = "invalid"/);
  assert.match(shortTermLaunchRenderers, /文件不可访问/);
  assert.doesNotMatch(shortTermLaunchRenderers, /暂无最近打开记录/);
  assert.match(shortTermLaunchRenderers, /noteNode\.hidden = true/);
  assert.doesNotMatch(shortTermLaunchRenderers, /仅显示文件名和父级位置|最近文件由 macOS 客户端提供/);
  assert.match(shortTermSaveModel, /export function saveProofImageKey/);
  assert.match(shortTermSaveModel, /export function saveProofSourceImageKey/);
  assert.match(shortTermSaveModel, /export function createSaveFailureProofActiveOutput/);
  assert.match(shortTermSaveModel, /kind: "rename"/);
  assert.match(shortTermSaveModel, /保存失败验证输出/);
  assert.match(shortTermSaveModel, /保存后重开验证应失败，当前源文件保持不变。/);
  assert.doesNotMatch(shortTermNavigationSurface, /from "\.\/short-term-macos-interaction-model\.mjs"|nextTabIndexForKey|consumeKeyboardEvent/);
  assert.match(shortTermInteractionModel, /export function consumeKeyboardEvent/);
  assert.match(shortTermInteractionModel, /export function isActivationKey/);
  assert.match(shortTermInteractionModel, /export function isContextMenuKey/);
  assert.match(shortTermInteractionModel, /export function isTextEditingTarget/);
  assert.match(shortTermInteractionModel, /export function shouldHandleGlobalPlaybackShortcut/);
  assert.match(shortTermInteractionModel, /export function enabledMenuItems/);
  assert.match(shortTermInteractionModel, /export function nextMenuItemIndexForKey/);
  assert.match(shortTermInteractionModel, /key === "ArrowDown"/);
  assert.match(shortTermInteractionModel, /key === "ArrowUp"/);
  assert.match(shortTermInteractionModel, /key === "Home"/);
  assert.match(shortTermInteractionModel, /key === "End"/);
  assert.match(shortTermInteractionModel, /event\.key === "Spacebar"/);
  assert.match(shortTermInteractionModel, /event\.key === "ContextMenu"/);
  assert.match(shortTermInteractionModel, /event\.shiftKey && event\.key === "F10"/);
  assert.match(shortTermInteractionModel, /"\[role='menuitem'\]"/);
  assert.doesNotMatch(shortTermInteractionModel, /"\[role='tab'\]"/);
  assert.match(shortTermController, /from "\.\/short-term-macos-resource-menu-surface\.mjs"/);
  assert.match(shortTermResourceMenuSurface, /from "\.\/short-term-macos-resource-menu-model\.mjs"/);
  assert.match(shortTermResourceMenuSurface, /keyboardResourceMenuAnchor/);
  assert.match(shortTermResourceMenuSurface, /resourceContextMenuView/);
  assert.match(shortTermResourceMenuSurface, /showResourceContextMenu\(menu, view\)/);
  assert.match(shortTermResourceMenuSurface, /hideResourceContextMenu\(nodes\.resourceContextMenu\)/);
  assert.match(shortTermController, /handleResourceContextMenuKeydown/);
  assert.match(shortTermResourceMenuSurface, /export function handleShortTermResourceMenuKeydown/);
  assert.match(shortTermResourceMenuSurface, /enabledMenuItems\(nodes\.resourceContextMenu\)/);
  assert.match(shortTermResourceMenuSurface, /nextMenuItemIndexForKey\(event\.key, currentIndex, items\.length\)/);
  assert.match(shortTermEventBindings, /nodes\.resourceContextMenu\.addEventListener\("keydown", handlers\.handleResourceContextMenuKeydown\)/);
  assert.match(shortTermState, /resourceMenuReturnFocus/);
  assert.match(shortTermResourceMenuSurface, /event: keyboardResourceMenuAnchor\(rect\)/);
  assert.match(shortTermEventBindings, /handlers\.openResourceContextMenu\(event, target\.dataset\.imageKey, target\)/);
  assert.match(shortTermEventBindings, /handlers\.closeResourceContextMenu\(\{ restoreFocus: true \}\)/);
  assert.match(shortTermSmokeRunner, /closeResourceContextMenu\(\{ restoreFocus: true \}\)/);
  assert.match(shortTermResourceMenuSurface, /returnFocus\.focus\(\{ preventScroll: true \}\)/);
  assert.doesNotMatch(shortTermEntry, /keyboardResourceMenuAnchor|resourceContextMenuView|showResourceContextMenu|hideResourceContextMenu|enabledMenuItems|nextMenuItemIndexForKey/);
  assert.doesNotMatch(shortTermEntry, /menu\.hidden = false|menu\.style\.left = view\.left|menu\.style\.top = view\.top|menu\.querySelector\("\[data-action='context-reset'\]"\)\.disabled|menu\.querySelector\("button:not\(:disabled\)"\)\?\.focus/);
  assert.match(shortTermResourceMenuRenderers, /menu\.hidden = false/);
  assert.match(shortTermResourceMenuRenderers, /menu\.style\.left = view\.left/);
  assert.match(shortTermResourceMenuRenderers, /menu\.style\.top = view\.top/);
  assert.match(shortTermResourceMenuRenderers, /menu\.querySelector\("\[data-action='context-reset'\]"\)\.disabled = view\.resetDisabled/);
  assert.match(shortTermResourceMenuRenderers, /menu\.querySelector\("button:not\(:disabled\)"\)\?\.focus/);
  assert.doesNotMatch(shortTermEntry, /context-reset[\s\S]{0,120}activeOutput\?\.kind !== "replacement"/);
  assert.match(shortTermResourceMenuModel, /export function keyboardResourceMenuAnchor/);
  assert.match(shortTermResourceMenuModel, /export function resourceContextMenuView/);
  assert.match(shortTermResourceMenuModel, /MENU_EDGE_INSET = 8/);
  assert.match(shortTermResourceMenuModel, /KEYBOARD_MENU_Y_LIMIT = 28/);
  assert.match(shortTermResourceMenuModel, /input\.activeOutput\?\.kind !== "replacement"/);
  assert.match(shortTermReplaceableSurface, /from "\.\/short-term-macos-text-model\.mjs"/);
  assert.match(shortTermReplaceableSurface, /runtimeTextListView/);
  assert.match(shortTermController, /from "\.\/short-term-macos-runtime-text-surface\.mjs"/);
  assert.match(shortTermRuntimeTextSurface, /from "\.\/short-term-macos-text-model\.mjs"/);
  assert.match(shortTermRuntimeTextSurface, /runtimeTextOverlayCopy/);
  assert.match(shortTermReplaceableSurface, /selectedRuntimeTextElement/);
  assert.match(shortTermReplaceableSurface, /renderRuntimeTextElements\(nodes, view, state\.selectedTextKey\)/);
  assert.match(shortTermReplaceableSurface, /from "\.\/short-term-macos-replaceable-renderers\.mjs"/);
  assert.doesNotMatch(shortTermEntry, /createTextElementRow|nodes\.textElementList\.replaceChildren|nodes\.textPreviewSummary\.textContent =|nodes\.editTextButton\.hidden =|nodes\.resetTextButton\.hidden =/);
  assert.match(shortTermReplaceableRenderers, /nodes\.textElementList\.replaceChildren/);
  assert.match(shortTermReplaceableRenderers, /nodes\.replaceableSummary\.textContent = view\.summaryCopy/);
  assert.doesNotMatch(shortTermReplaceableRenderers, /Enter 确认 · Esc 取消/);
  assert.match(shortTermReplaceableRenderers, /data-component="InlineTextReplacementInput"/);
  assert.match(shortTermReplaceableRenderers, /data-action="runtime-text-reset"/);
  assert.doesNotMatch(shortTermReplaceableRenderers, /nodes\.editTextButton\.hidden|nodes\.resetTextButton\.hidden/);
  assert.match(shortTermRuntimeTextSurface, /export function focusShortTermRuntimeTextPreviewInput/);
  assert.match(shortTermRuntimeTextSurface, /export function applyShortTermRuntimeTextPreview/);
  assert.match(shortTermRuntimeTextSurface, /runtimeTextReplacementView\(textElement, value, \{ emptyIsSource: true \}\)/);
  assert.match(shortTermRuntimeTextSurface, /setRuntimeTextValue\(state, textKey, replacement\.hasPreview \? replacement\.value : ""\)/);
  assert.match(shortTermRuntimeTextSurface, /if \(replacement\.hasPreview\) \{\s*applyRuntimeTextOverlay\(\s*nodes\.runtimeTextOverlay,\s*runtimeTextOverlayCopy\(textElement, state\.textPreview\),\s*true\s*\)/s);
  assert.match(shortTermRuntimeTextSurface, /clearRuntimeTextOverlay\(nodes\.runtimeTextOverlay\)/);
  assert.doesNotMatch(shortTermEntry, /applyRuntimeTextOverlay|clearRuntimeTextOverlay|runtimeTextOverlayCopy\(textElement|from "\.\/short-term-macos-text-renderers\.mjs"|from "\.\/short-term-macos-text-model\.mjs"/);
  assert.doesNotMatch(shortTermEntry, /nodes\.runtimeTextOverlay\.(hidden|textContent)\s*=/);
  assert.match(shortTermTextRenderers, /node\.textContent = copy/);
  assert.match(shortTermTextRenderers, /node\.hidden = !visible/);
  assert.match(shortTermTextRenderers, /node\.textContent = ""/);
  assert.match(shortTermTextModel, /export const RUNTIME_TEXT_DEFAULT_VALUE = "SVGA VIP"/);
  assert.match(shortTermTextModel, /export function runtimeTextInputValue/);
  assert.match(shortTermTextModel, /export function hasRuntimeTextPreview/);
  assert.match(shortTermTextModel, /export function runtimeTextPlaceholder/);
  assert.match(shortTermTextModel, /export function runtimeTextOverlayCopy/);
  assert.match(shortTermTextModel, /export function runtimeTextListView/);
  assert.match(shortTermTextModel, /export function nextSelectedTextKey/);
  assert.match(shortTermTextModel, /export function selectedRuntimeTextElement/);
  assert.doesNotMatch(shortTermTextModel, /当前文件没有可运行时预览的文本元素。/);
  assert.match(shortTermTextModel, /replaceableElementSummaryCopy\(images\.length \+ texts\.length, hasImagePreview \|\| hasTextPreview\)/);
  assert.match(shortTermReplaceableModel, /export function replaceableElementSummaryCopy/);
  assert.match(shortTermReplaceableSurface, /from "\.\/short-term-macos-replaceable-model\.mjs"/);
  assert.match(shortTermReplaceableSurface, /replaceableImageListView/);
  assert.match(shortTermReplaceableSurface, /nextReplaceableSelection/);
  assert.match(shortTermReplaceableSurface, /renderReplaceableImages\(nodes, view, state\.model\)/);
  assert.doesNotMatch(shortTermEntry, /replaceableImageListView|nextReplaceableSelection|renderReplaceableImages\(nodes, view, state\.model\)|renderRuntimeTextElements\(nodes, view, state\.selectedTextKey\)|selectedRuntimeTextElement/);
  assert.doesNotMatch(shortTermEntry, /createReplaceableImageRow|nodes\.replaceableList\.replaceChildren|nodes\.replaceableSummary\.textContent =/);
  assert.match(shortTermReplaceableRenderers, /nodes\.replaceableList\.replaceChildren/);
  assert.match(shortTermReplaceableRenderers, /nodes\.replaceableSummary\.textContent = view\.summaryCopy/);
  assert.match(shortTermReplaceableRenderers, /closest\("\.replaceableSection"\)\?\.setAttribute\("data-empty", view\.hasImages \? "false" : "true"\)/);
  assert.match(shortTermReplaceableRenderers, /nodes\.replaceableList\.dataset\.empty = view\.hasImages \? "false" : "true"/);
  assert.match(shortTermReplaceableRenderers, /nodes\.textElementList\.dataset\.empty = view\.hasTextElements \? "false" : "true"/);
  assert.match(shortTermReplaceableRenderers, /nodes\.textElementList\.closest\("\.replaceableSection"\)\?\.setAttribute\("data-empty", "false"\)/);
  assert.match(shortTermModules, /\.replaceableSection\[data-empty="true"\]/);
  assert.match(shortTermComponents, /\.replaceableRow\[data-replacement-state="preview"\] \.rowText strong::after/);
  assert.match(shortTermComponents, /\.textElementRow\[data-replacement-state="preview"\] \.rowText strong::after/);
  assert.match(shortTermComponents, /content: "\*"/);
  assert.doesNotMatch(shortTermModules, /textPreviewBlock/);
  assert.doesNotMatch(shortTermEntry, /普通自动命名图片不会出现在这里。|没有可替换元素。|\$\{rows\.length\} 个设计师命名图片元素。/);
  assert.doesNotMatch(shortTermReplaceableRenderers, /createInlineStatusText/);
  assert.match(shortTermReplaceableModel, /export function replaceableImageListView/);
  assert.match(shortTermReplaceableModel, /export function nextReplaceableSelection/);
  assert.doesNotMatch(shortTermReplaceableModel, /没有可替换元素。/);
  assert.match(shortTermReplaceableModel, /summaryCopy: replaceableElementSummaryCopy\(images\.length, hasPreview\)/);
  assert.match(shortTermController, /from "\.\/short-term-macos-optimization-surface\.mjs"/);
  assert.match(shortTermOptimizationSurface, /from "\.\/short-term-macos-optimization-model\.mjs"/);
  assert.match(shortTermOptimizationSurface, /optimizationTabView/);
  assert.match(shortTermOptimizationSurface, /optimizationResultTone/);
  assert.match(shortTermNodes, /runOptimizationButton: document\.querySelector\("\[data-action='run-optimization'\]"\)/);
  assert.match(shortTermOptimizationSurface, /renderOptimizationFindings\(nodes, optimizationTabView\(model\)\)/);
  assert.match(shortTermOptimizationSurface, /prependOptimizationResult\(nodes, model\.resultTitle, model\.resultSummary, tone\)/);
  assert.doesNotMatch(shortTermEntry, /createOptimizationFindingRow|createInlineStatusText|createMessageRow|nodes\.optimizationSummary\.textContent|nodes\.findingList\.replaceChildren|nodes\.findingList\.prepend/);
  assert.match(shortTermOptimizationSurface, /from "\.\/short-term-macos-optimization-renderers\.mjs"/);
  assert.match(shortTermOptimizationSurface, /showSaveBanner\("优化执行中…", "正在生成优化文件，请勿关闭…"\)/);
  assert.doesNotMatch(shortTermOptimizationSurface, /正在执行安全优化。|只处理当前可安全执行的项目。/);
  assert.doesNotMatch(shortTermEntry, /from "\.\/short-term-macos-optimization-model\.mjs"|from "\.\/short-term-macos-optimization-renderers\.mjs"|optimizationTabView|optimizationResultTone|prependOptimizationResult|renderOptimizationFindings/);
  assert.match(shortTermOptimizationRenderers, /nodes\.optimizationSummary\.textContent = view\.summaryCopy/);
  assert.match(shortTermOptimizationRenderers, /nodes\.runOptimizationButton\.textContent = view\.runButtonCopy/);
  assert.match(shortTermOptimizationRenderers, /nodes\.runOptimizationButton\.title = view\.runButtonTitle/);
  assert.match(shortTermOptimizationRenderers, /nodes\.runOptimizationButton\.disabled = view\.runButtonDisabled/);
  assert.match(shortTermOptimizationRenderers, /nodes\.findingList\.replaceChildren/);
  assert.match(shortTermOptimizationRenderers, /nodes\.findingList\.prepend/);
  assert.doesNotMatch(shortTermEntry, /暂无可执行优化项|批量执行当前可安全执行的优化项/);
  assert.match(shortTermOptimizationModel, /export function optimizationTabView/);
  assert.match(shortTermOptimizationModel, /export function optimizationResultTone/);
  assert.match(shortTermOptimizationModel, /groupOptimizationItems/);
  assert.match(shortTermOptimizationModel, /一键优化/);
  assert.match(shortTermOptimizationModel, /批量执行当前可安全执行的优化项/);
  assert.match(shortTermOptimizationModel, /暂无可执行优化项/);
  assert.match(shortTermPreviewSurface, /from "\.\/short-term-macos-overview-model\.mjs"/);
  assert.match(shortTermPreviewSurface, /overviewTabView/);
  assert.doesNotMatch(shortTermEntry, /overviewVisibleFacts/);
  assert.match(shortTermOverviewModel, /export function overviewTabView/);
  assert.match(shortTermOverviewModel, /overviewFactGroups/);
  assert.match(shortTermOverviewModel, /"canvas", "fps", "duration"/);
  assert.match(shortTermPreviewSurface, /from "\.\/short-term-macos-edit-reserved-model\.mjs"/);
  assert.match(shortTermPreviewSurface, /editReservedLayerListView/);
  assert.match(shortTermPreviewSurface, /renderEditReservedLayers\(nodes, editReservedLayerListView\(state\.model, state\.displayName\), state\.model\)/);
  assert.doesNotMatch(shortTermEntry, /createEditLayerRow|nodes\.layerPanel\.replaceChildren/);
  assert.match(shortTermEditReservedRenderers, /nodes\.layerPanel\.replaceChildren/);
  assert.match(shortTermEditReservedRenderers, /createEditLayerHeader/);
  assert.match(shortTermEditReservedRenderers, /createEditLayerList/);
  assert.match(shortTermEditReservedModel, /displayName: displayName \|\| "未打开文件"/);
  assert.doesNotMatch(shortTermEntry, /\.filter\(\(asset\) => asset\.kind !== "audio"\)[\s\S]*\.slice\(0, 32\)/);
  assert.match(shortTermEditReservedModel, /export const EDIT_RESERVED_LAYER_LIMIT = 32/);
  assert.match(shortTermEditReservedModel, /export function editReservedLayerListView/);
  assert.match(shortTermEditReservedModel, /asset\.kind !== "audio"/);
  assert.match(shortTermEditReservedModel, /EDIT_RESERVED_LAYER_LIMIT/);
  assert.match(shortTermReplaceableSurface, /from "\.\/short-term-macos-render-model\.mjs"/);
  assert.doesNotMatch(shortTermEntry, /from "\.\/short-term-macos-render-model\.mjs"/);
  assert.match(shortTermController, /function handleTabListKeydown/);
  assert.match(shortTermEntry, /from "\.\/short-term-macos-event-bindings\.mjs"/);
  assert.match(shortTermEntry, /bindShortTermInteractionEvents\(\{/);
  assert.match(shortTermEventBindings, /export function bindShortTermInteractionEvents/);
  assert.match(shortTermEventBindings, /bindCanvasDragDecision/);
  assert.match(shortTermEventBindings, /handlers\.dropCanvasFile/);
  assert.doesNotMatch(shortTermEventBindings, /querySelector\("\[role='tablist'\]"\)|\[data-tab\]/);
  assert.match(shortTermNavigationSurface, /export function handleShortTermTabListKeydown/);
  assert.match(shortTermNavigationSurface, /void event/);
  assert.match(shortTermNavigationSurface, /export function openShortTermTab/);
  assert.doesNotMatch(shortTermEntry, /nextTabIndexForKey|tabButtons\(\)|applyTabState\(tab, options\)|consumeKeyboardEvent\(event\)/);
  assert.doesNotMatch(shortTermEntry, /document\.addEventListener\("click"|document\.addEventListener\("keydown"|nodes\.dropZone\.addEventListener\("drop"/);
  assert.match(shortTermCompareSurface, /generalCompareTraceView/);
  assert.match(shortTermCompareSurface, /optimizationCompareTraceView/);
  assert.match(shortTermCompareSurface, /applyCompareSlotView\(nodes, slot, compareSlotView\(slot, title, model, fallbackMeta\)\)/);
  assert.match(shortTermCompareSurface, /applyCompareTraceView\(nodes\.compareView, generalCompareTraceView\(\)\)/);
  assert.match(shortTermCompareSurface, /applyCompareTraceView\(nodes\.compareView, optimizationCompareTraceView\(\)\)/);
  assert.match(shortTermCompareSurface, /markCompareSlotLoaded\(nodes, slot\)/);
  assert.match(shortTermCompareSurface, /renderShortTermGeneralComparePanel\(\{/);
  assert.match(shortTermCompareSurface, /renderCompareInfoPanel\(nodes, "B", renderGeneralComparePanelHtml/);
  assert.match(shortTermCompareSurface, /markShortTermCompareSlotLoaded\(\{ nodes, slot: "A" \}\)/);
  assert.match(shortTermCompareSurface, /markShortTermCompareSlotLoaded\(\{ nodes, slot: "B" \}\)/);
  assert.doesNotMatch(page, /id="compareInfoA"/);
  assert.match(shortTermOptimizationSurface, /renderShortTermOptimizationCompareResult\(\{ nodes, model \}\)/);
  assert.match(shortTermOptimizationSurface, /markShortTermCompareSlotLoaded\(\{ nodes, slot: "A" \}\)/);
  assert.doesNotMatch(shortTermEntry, /textContent = view\.title|textContent = view\.meta|dataset\.compareState = view\.compareState|dataset\.compareState = "loaded"|dataset\.module = view\.moduleName|dataset\.pageState = view\.pageState|nodes\.compareInfo[AB]\.innerHTML/);
  assert.match(shortTermCompareRenderers, /textContent = view\.title/);
  assert.match(shortTermCompareRenderers, /textContent = view\.meta/);
  assert.match(shortTermCompareRenderers, /dataset\.compareState = view\.compareState/);
  assert.match(shortTermCompareRenderers, /dataset\.compareState = "loaded"/);
  assert.match(shortTermCompareRenderers, /dataset\.module = view\.moduleName/);
  assert.match(shortTermCompareRenderers, /dataset\.pageState = view\.pageState/);
  assert.match(shortTermCompareRenderers, /node\.innerHTML = html/);
  assert.doesNotMatch(shortTermEntry, /setCompareTrace\("GeneralCompareModule", "General comparing"\)|setCompareTrace\("OptimizationCompareModule", "Optimization compare"\)/);
  assert.match(shortTermEntry, /from "\.\/short-term-macos-smoke-runner\.mjs"/);
  assert.match(shortTermSmokeRunner, /from "\.\/short-term-macos-smoke-proof-model\.mjs"/);
  assert.doesNotMatch(shortTermEntry, /from "\.\/short-term-macos-smoke-proof-model\.mjs"/);
  assert.match(shortTermSmokeProofModel, /export async function collectShortTermRightSurfaceNavigationProof/);
  assert.match(shortTermSmokeProofModel, /proofId: "short-term-right-surface-navigation-proof"/);
  assert.match(shortTermSmokeRunner, /shortTermRightSurfaceNavigationProof/);
  assert.match(shortTermFileSurface, /from "\.\/short-term-macos-byte-model\.mjs"/);
  assert.match(shortTermCompareSurface, /from "\.\/short-term-macos-byte-model\.mjs"/);
  assert.match(shortTermReplaceableSurface, /from "\.\/short-term-macos-byte-model\.mjs"/);
  assert.match(shortTermSmokeRunner, /from "\.\/short-term-macos-byte-model\.mjs"/);
  assert.doesNotMatch(shortTermEntry, /from "\.\/short-term-macos-byte-model\.mjs"/);
  assert.match(shortTermByteModel, /export function toUint8Array/);
  assert.match(shortTermByteModel, /export function toBase64/);
  assert.match(shortTermByteModel, /export function fromBase64/);
  assert.match(shortTermByteModel, /export function toParserArrayBuffer/);
  assert.match(shortTermByteModel, /export async function sha256Hex/);
  assert.doesNotMatch(shortTermEntry, /function toUint8Array|function toBase64|function fromBase64|function toParserArrayBuffer|async function sha256Hex/);
  assert.match(shortTermController, /from "\.\/short-term-macos-dialog-model\.mjs"/);
  assert.match(shortTermDialogModel, /export function hasOpenDialog/);
  assert.match(shortTermDialogModel, /export function closeOpenDialog/);
  assert.match(shortTermDialogModel, /export function showDialog/);
  assert.match(shortTermDialogModel, /export async function confirmDiscardUnsavedOutput/);
  assert.match(shortTermDialogModel, /dialog\.showModal\(\)/);
  assert.match(shortTermDialogModel, /function focusInitialDialogElement/);
  assert.match(shortTermDialogModel, /options\.initialFocus/);
  assert.match(shortTermDialogModel, /returnFocus\?\.focus\(\{ preventScroll: true \}\)/);
  assert.match(shortTermDialogModel, /querySelector\("dialog\[open\]"\)/);
  assert.match(shortTermCommandSurface, /dialogOpen: hasOpenDialog\(documentRef\)/);
  assert.doesNotMatch(shortTermRuntimeTextSurface, /showDialog|nodes\.textDialog|nodes\.runtimeTextInput/);
  assert.match(shortTermRuntimeTextSurface, /findRuntimeTextInput/);
  assert.match(shortTermEventBindings, /if \(hasOpenDialog\(documentRef\)\) \{\s+if \(event\.key === "Escape"\) closeOpenDialog\(documentRef, "cancel"\);\s+return;\s+\}/);
  assert.match(shortTermActionBridge, /closeOpenDialog\(documentRef, "cancel"\)/);
  assert.doesNotMatch(shortTermEntry, /function showDialog|dialog\.showModal\(\)|document\.querySelector\("dialog\[open\]"\)/);
  assert.match(shortTermController, /from "\.\/short-term-macos-playback-surface\.mjs"/);
  assert.match(shortTermPlaybackSurface, /from "\.\/short-term-macos-playback-model\.mjs"/);
  assert.match(shortTermPlaybackSurface, /export async function mountShortTermPlayback/);
  assert.match(shortTermPlaybackSurface, /playbackState: state/);
  assert.match(shortTermPlaybackSurface, /export function stopShortTermPlayback/);
  assert.match(shortTermPlaybackSurface, /export function stopAllShortTermPlayback/);
  assert.match(shortTermPlaybackSurface, /export function toggleShortTermPrimaryPlayback/);
  assert.match(shortTermPlaybackSurface, /export function replayShortTermPrimaryPlayback/);
  assert.match(shortTermPlaybackSurface, /export function renderShortTermPlaybackProgress/);
  assert.match(shortTermController, /requestAnimationFrame\(tick\)/);
  assert.match(shortTermController, /cancelAnimationFrame\(playbackProgressFrame\)/);
  assert.match(shortTermController, /if \(key === "primary"\) startPlaybackProgressLoop\(\)/);
  assert.match(shortTermPlaybackSurface, /export function clearShortTermPlaybackCanvas/);
  assert.match(shortTermPlaybackSurface, /export function shortTermPlayerPrototype/);
  assert.doesNotMatch(shortTermEntry, /from "\.\/short-term-macos-playback-model\.mjs"/);
  assert.match(shortTermPlaybackModel, /export async function mountPlayback/);
  assert.match(shortTermPlaybackModel, /export function stopPlayback/);
  assert.match(shortTermPlaybackModel, /export function stopAllPlayback/);
  assert.match(shortTermPlaybackModel, /export function togglePrimaryPlayback/);
  assert.match(shortTermPlaybackModel, /export function replayPrimaryPlayback/);
  assert.match(shortTermPlaybackModel, /export function togglePrimaryPlaybackLoop/);
  assert.match(shortTermPlaybackModel, /togglePrimaryPlaybackLoopState\(playbackState\)/);
  assert.match(shortTermPlaybackModel, /playback\.player\.set\(\{ loop: looping, fillMode: FILL_MODE\.FORWARDS, noExecutionDelay: false \}\)/);
  assert.match(shortTermPlaybackSurface, /export function toggleShortTermPrimaryPlaybackLoop/);
  assert.match(shortTermActionBridge, /toggleLoop: handlers\.togglePrimaryPlaybackLoop/);
  assert.match(shortTermEventBindings, /if \(action === "loop-toggle"\) handlers\.togglePrimaryPlaybackLoop\(\)/);
  assert.match(shortTermPlaybackModel, /export function playbackProgressView/);
  assert.match(shortTermPlaybackModel, /formatPlaybackTime/);
  assert.match(shortTermPlaybackModel, /export function clearCanvas/);
  assert.match(shortTermPlaybackModel, /export function svgaWebPlayerPrototype/);
  assert.match(shortTermPlaybackModel, /Parser as SvgaWebParser/);
  assert.match(shortTermPlaybackModel, /Player as SvgaWebPlayer/);
  assert.match(shortTermPlaybackModel, /FILL_MODE\.FORWARDS/);
  assert.match(shortTermPlaybackModel, /toParserArrayBuffer\(bytes\)/);
  assert.match(shortTermPlaybackModel, /from "\.\/short-term-macos-playback-fit-model\.mjs"/);
  assert.match(shortTermPlaybackModel, /fitPlaybackCanvasToContainer\(canvas, movieWidth, movieHeight\)/);
  assert.match(shortTermPlaybackFitModel, /export function playbackCanvasFitSize/);
  assert.match(shortTermPlaybackModel, /new ResizeObserver/);
  assert.match(shortTermPlaybackModel, /canvas\.style\.setProperty\("--asv-playback-aspect"/);
  assert.match(shortTermPlaybackModel, /canvas\.dataset\.movieWidth/);
  assert.doesNotMatch(shortTermModules, /width:\s*min\(70vh,\s*560px\);\s*height:\s*min\(70vh,\s*560px\);/);
  assert.doesNotMatch(shortTermPageStates, /width:\s*min\(64vh,\s*560px\);\s*height:\s*min\(64vh,\s*560px\);/);
  assert.doesNotMatch(shortTermEntry, /FILL_MODE|SvgaWebParser|SvgaWebPlayer|player\.set|new SvgaWebParser|new SvgaWebPlayer|toParserArrayBuffer/);
  assert.match(shortTermController, /from "\.\/short-term-macos-api-client\.mjs"/);
  assert.match(shortTermApiClient, /export async function inspectShortTermSvga/);
  assert.match(shortTermApiClient, /export async function optimizeShortTermSvga/);
  assert.match(shortTermApiClient, /export async function renameShortTermImageKey/);
  assert.match(shortTermApiClient, /export async function replaceShortTermImageAsset/);
  assert.match(shortTermApiClient, /export async function probeInvalidShortTermInspection/);
  assert.match(shortTermApiClient, /x-auto-svga-prototype-token/);
  assert.doesNotMatch(shortTermEntry, /function postBytes|function postJson|function authHeaders|function readJsonResponse|\/api\/short-term-product-/);
  assert.match(shortTermRenderModel, /export function renderOverviewFactCellHtml/);
  assert.match(shortTermRenderModel, /export function renderMetricValueHtml/);
  assert.match(shortTermRenderModel, /<span class="factValueUnit">/);
  assert.match(shortTermRenderModel, /data-component="MetricOptimizationEntry"/);
  assert.match(shortTermRenderModel, /export function renderOptimizationFindingHtml/);
  assert.match(shortTermRenderModel, /export function renderMessageRowHtml\(title, summary, tone = "info"\)/);
  assert.match(shortTermRenderModel, /success: "已生成"/);
  assert.match(shortTermRenderModel, /export function renderCompareFactCellHtml/);
  assert.match(shortTermRenderModel, /export function groupOptimizationItems/);
  assert.match(shortTermEntry, /from "\.\/short-term-macos-action-bridge\.mjs"/);
  assert.match(shortTermEntry, /installShortTermActionBridge\(\{/);
  assert.match(shortTermActionBridge, /export function installShortTermActionBridge/);
  assert.match(shortTermActionBridge, /windowRef\.__autoSvgaShortTermActions = Object\.freeze/);
  assert.match(shortTermActionBridge, /save: \(\) => handlers\.saveActiveOutput\("overwrite"\)/);
  assert.match(shortTermActionBridge, /copyStateSummary: \(\) => bridge\?\.writeClipboardText\?\.\(handlers\.currentStateSummary\(\)\)/);
  assert.doesNotMatch(shortTermEntry, /window\.__autoSvgaShortTermActions = Object\.freeze/);
  assert.match(shortTermReplaceableSurface, /aria-selected/);
  assert.match(shortTermApiClient, /\/api\/short-term-product-inspection-model/);
  assert.match(shortTermApiClient, /\/api\/short-term-product-optimization-workflow/);
  assert.match(shortTermApiClient, /\/api\/short-term-product-image-key-rename/);
  assert.match(shortTermController, /function createSaveProofOutput/);
  assert.match(shortTermController, /createSaveProofOutput,/);
  assert.match(shortTermApiClient, /\/api\/short-term-product-image-replacement-workflow/);
  assert.match(shortTermState, /renameImageKey: ""/);
  assert.match(shortTermReplaceableRenderers, /data-rename-input/);
  assert.match(shortTermReplaceableRenderers, /ReplaceableImageRow/);
  assert.match(shortTermReplaceableRenderers, /setAttribute\("role", "option"\)/);
  assert.match(shortTermController, /confirmInlineRename/);
  assert.match(shortTermReplaceableRenderers, /inline-rename-confirm/);
  assert.match(shortTermReplaceableRenderers, /inline-rename-cancel/);
  assert.doesNotMatch(shortTermReplaceableRenderers, /Enter 确认 · Esc 取消/);
  assert.match(shortTermEventBindings, /event\.key === "Enter"[\s\S]*handlers\.confirmInlineRename/);
  assert.match(shortTermEventBindings, /event\.key === "Escape"[\s\S]*handlers\.cancelInlineRename/);
  assert.match(shortTermController, /openKeyboardResourceContextMenu/);
  assert.match(shortTermEventBindings, /nodes\.textElementList\.addEventListener\("keydown"/);
  assert.match(shortTermResourceMenuRenderers, /button:not\(:disabled\)/);
  assert.match(shortTermEventBindings, /nodes\.textElementList\.addEventListener\("input"/);
  assert.match(shortTermEventBindings, /handlers\.updateRuntimeText\(input\.dataset\.textKey, input\.value\)/);
  assert.match(shortTermEventBindings, /runtime-text-reset/);
  assert.doesNotMatch(shortTermEventBindings, /runtimeTextInput\.addEventListener|nodes\.textDialog\.close/);
  assert.match(shortTermSmokeProofModel, /initialFocusInput/);
  assert.match(shortTermSmokeProofModel, /inlineInputRendered/);
  assert.match(shortTermSmokeProofModel, /inputSpaceSuppressed/);
  assert.match(shortTermSmokeRunner, /const runtimeTextInitialFocusInput = document\.activeElement === runtimeTextInput/);
  assert.match(shortTermSmokeRunner, /const runtimeTextInlineInputRendered = Boolean\(runtimeTextInput\)/);
  assert.match(shortTermSmokeRunner, /const runtimeTextResetButton = runtimeTextInput\.closest\("\.textElementRow"\)\?\.querySelector\("\[data-action='runtime-text-reset'\]"\)/);
  assert.doesNotMatch(shortTermEntry, /renameDialog|renameHint/);
  assert.doesNotMatch(shortTermEntry, /mountPlayback\("edit"[\s\S]{0,120}start:\s*false/);
  assert.match(shortTermSaveSurface, /saveShortTermSvgaOutput/);
  assert.match(shortTermSaveSurface, /return \{\s*\.\.\.result,\s*outputKind,\s*expectedSha256/s);
  assert.match(shortTermRecentFilesSurface, /getRecentSvgaFiles/);
  assert.match(shortTermEntry, /runShortTermSmokeIfRequested/);
  assert.match(shortTermSmokeRunner, /reportSmokeResult/);
  assert.match(shortTermSmokeProofModel, /export function collectShortTermRightSurfaceCaptureState/);
  assert.match(shortTermSmokeRunner, /collectShortTermRightSurfaceCaptureState/);
  assert.match(shortTermSmokeRunner, /state\.smokeSurfaceCaptureStates = \[\]/);
  assert.match(shortTermSmokeRunner, /const setSmokeSurface = async \(surface, artifactName = ""\)/);
  assert.match(shortTermSmokeRunner, /setTab\(surface, \{ focus: true, scroll: true \}\)/);
  assert.match(shortTermSmokeRunner, /rightSurfaceState: document\.querySelector\("\.rightPanel"\)\?\.dataset\.panelState \|\| ""/);
  assert.match(shortTermSmokeRunner, /document\.activeElement\?\.blur\?\.\(\)/);
  assert.ok(shortTermSmokeRunner.includes('document.querySelector(`[data-panel="${expectedPanel}"]`)?.hidden === false'));
  assert.match(shortTermSmokeRunner, /captureSmokeArtifact\("short-term-launch"\)/);
  assert.match(shortTermSmokeRunner, /captureSmokeArtifact\("short-term-preview-overview"\)/);
  assert.match(shortTermSmokeRunner, /captureSmokeArtifact\("short-term-preview-overview-wide"\)/);
  assert.match(shortTermSmokeRunner, /captureSmokeArtifact\("short-term-drag-decision-supported"\)/);
  assert.match(shortTermSmokeRunner, /captureSmokeArtifact\("short-term-drag-decision-unsupported"\)/);
  assert.match(shortTermSmokeRunner, /const dragEvidenceAppearance = document\.documentElement\.dataset\.appearance \|\| "system";[\s\S]*setAppearance\("light"\);[\s\S]*captureSmokeArtifact\("short-term-drag-decision-supported"\)/);
  assert.match(shortTermSmokeRunner, /captureSmokeArtifact\("short-term-drag-decision-unsupported"\);[\s\S]*setAppearance\(dragEvidenceAppearance\)/);
  assert.match(shortTermSmokeRunner, /captureSmokeArtifact\("short-term-preview-optimization"\)/);
  assert.match(shortTermSmokeRunner, /captureSmokeArtifact\("short-term-preview-replaceable"\)/);
  assert.match(shortTermSmokeRunner, /captureSmokeArtifact\("short-term-sequence-thumbnails"\)/);
  assert.match(shortTermSmokeRunner, /captureSmokeArtifact\("short-term-optimization-result"\)/);
  assert.match(shortTermSmokeRunner, /captureSmokeArtifact\("short-term-rename-dirty"\)/);
  assert.match(shortTermSmokeRunner, /captureSmokeArtifact\("short-term-replacement-dirty"\)/);
  assert.match(shortTermSmokeRunner, /captureSmokeArtifact\("short-term-replacement-reset"\)/);
  assert.match(shortTermSmokeRunner, /captureSmokeArtifact\("short-term-general-compare"\)/);
  assert.match(shortTermSmokeRunner, /captureSmokeArtifact\("short-term-edit-reserved"\)/);
  assert.match(shortTermSmokeRunner, /captureSmokeArtifact\("short-term-preview-minimum"\)/);
  assert.match(shortTermSmokeRunner, /captureSmokeArtifact\("short-term-save-failed"\)/);
  assert.match(shortTermSmokeRunner, /captureSmokeArtifact\("short-term-load-failed"\)/);
  assert.match(shortTermSmokeRunner, /captureSmokeArtifact\("short-term-playback-failed"\)/);
  assert.match(shortTermSmokeProofModel, /export function collectShortTermOpenFlowProof/);
  assert.match(shortTermSmokeProofModel, /short-term-open-flow-proof/);
  assert.match(shortTermSmokeProofModel, /dragDropAttempted/);
  assert.match(shortTermSmokeProofModel, /dragDecisionOverlayVisible/);
  assert.match(shortTermSmokeProofModel, /dragDecisionOffersOpenAndCompare/);
  assert.match(shortTermSmokeProofModel, /dragDecisionSplit: "top-25-bottom-75"/);
  assert.match(shortTermSmokeProofModel, /dragDecisionCenterPointOpen/);
  assert.match(shortTermSmokeProofModel, /dragDecisionLowerCenterPointOpen/);
  assert.match(shortTermSmokeProofModel, /dragDecisionBottomEntryPointOpen/);
  assert.match(shortTermSmokeProofModel, /dragDecisionTopSecondaryPointCompare/);
  assert.match(shortTermSmokeProofModel, /dragDecisionSecondaryPointCompare/);
  assert.match(shortTermSmokeRunner, /id: "center-open", ratioX: 0\.5, ratioY: 0\.5, expectedZone: "open"/);
  assert.match(shortTermSmokeRunner, /id: "lower-center-open", ratioX: 0\.5, ratioY: 0\.7, expectedZone: "open"/);
  assert.match(shortTermSmokeRunner, /id: "bottom-entry-open", ratioX: 0\.5, ratioY: 0\.95, expectedZone: "open"/);
  assert.match(shortTermSmokeRunner, /id: "secondary-compare", ratioX: 0\.5, ratioY: 0\.1, expectedZone: "compare"/);
  assert.match(shortTermSmokeProofModel, /unsupportedDropToastVisible/);
  assert.match(shortTermSmokeRunner, /collectShortTermOpenFlowProof/);
  assert.match(shortTermSmokeRunner, /supportedDragDecisionOverlayVisible/);
  assert.match(shortTermSmokeRunner, /unsupportedDropClearedCanvas/);
  assert.match(shortTermSmokeRunner, /unsupportedDropToastVisible/);
  assert.doesNotMatch(shortTermEntry, /proofId: "short-term-open-flow-proof"/);
  assert.match(shortTermSmokeProofModel, /export function collectShortTermLoadFailureProof/);
  assert.match(shortTermSmokeProofModel, /short-term-load-failure-proof/);
  assert.match(shortTermSmokeProofModel, /sourceBytesRestoredAfterRecovery/);
  assert.match(shortTermSmokeProofModel, /playbackFailureInjected/);
  assert.match(shortTermSmokeProofModel, /playbackFailureVisible/);
  assert.match(shortTermSmokeProofModel, /playbackFailureRecovered/);
  assert.match(shortTermSmokeProofModel, /playbackFailureSourceBytesRestoredAfterRecovery/);
  assert.match(shortTermSmokeRunner, /collectShortTermLoadFailureProof/);
  assert.doesNotMatch(shortTermEntry, /proofId: "short-term-load-failure-proof"/);
  assert.match(shortTermSmokeProofModel, /export function collectShortTermSpecComparisonProof/);
  assert.match(shortTermSmokeProofModel, /short-term-spec-comparison-proof/);
  assert.match(shortTermSmokeProofModel, /actualValuesVisible/);
  assert.match(shortTermSmokeProofModel, /defaultThresholdsHidden/);
  assert.match(shortTermSmokeProofModel, /optimizationStatusVisible/);
  assert.match(shortTermSmokeRunner, /collectShortTermSpecComparisonProof/);
  assert.doesNotMatch(shortTermEntry, /proofId: "short-term-spec-comparison-proof"/);
  assert.match(shortTermSmokeProofModel, /short-term-right-surface-navigation-proof/);
  assert.match(shortTermSmokeProofModel, /tabButtonsRemoved/);
  assert.match(shortTermSmokeProofModel, /legacyPanelTabNavigationRemoved/);
  assert.doesNotMatch(shortTermSmokeProofModel, /querySelectorAll\("\[data-tab\], \[role='tab'\], \[role='tablist'\]"\)/);
  assert.match(shortTermSmokeProofModel, /short-term-design-interaction-proof/);
  assert.match(shortTermSmokeProofModel, /export function createSmokeArtifactCapture/);
  assert.match(shortTermSmokeProofModel, /captureSmokeArtifact/);
  assert.match(shortTermSmokeProofModel, /allSmokeArtifactsCaptured/);
  assert.match(shortTermSmokeProofModel, /export function collectShortTermDesignInteractionProof/);
  assert.match(shortTermSmokeRunner, /const smokeArtifactCapture = createSmokeArtifactCapture\(bridge\)/);
  assert.match(shortTermSmokeRunner, /await setSmokeSurface\("optimization", "short-term-preview-optimization"\);[\s\S]*captureSmokeArtifact\("short-term-preview-optimization"\)/);
  assert.match(shortTermSmokeRunner, /await setSmokeSurface\("replaceable", "short-term-preview-replaceable"\);[\s\S]*captureSmokeArtifact\("short-term-preview-replaceable"\)/);
  assert.match(shortTermSmokeRunner, /collectShortTermDesignInteractionProof/);
  assert.match(shortTermSmokeProofModel, /visibleFocusableElements/);
  assert.match(shortTermSmokeProofModel, /metadataSelectable/);
  assert.match(shortTermSmokeProofModel, /surfaceCaptureStatesSynced/);
  assert.match(shortTermSmokeProofModel, /rightSurfaceState === "optimization"/);
  assert.match(shortTermSmokeProofModel, /rightSurfaceState === "replaceable"/);
  assert.match(shortTermSmokeProofModel, /captureState\?\.rightSurfaceState === expected\.expectedSurface/);
  assert.match(shortTermSmokeProofModel, /rightSurfaceState: boundedSmokeText\(rightSurfaceState, 40\)/);
  assert.match(shortTermSmokeProofModel, /menuStateDiscoverable/);
  assert.match(shortTermSmokeProofModel, /settingsSheetAvailable/);
  assert.match(shortTermSmokeProofModel, /appearanceSwitchingWorks/);
  assert.match(shortTermSmokeProofModel, /appearanceScreenshotsCaptured/);
  assert.match(shortTermSmokeProofModel, /settingsDialogScreenshotCaptured/);
  assert.match(shortTermSmokeProofModel, /appearanceMenuStateSynced/);
  assert.match(shortTermSmokeProofModel, /noMainSurfaceAppearanceButton/);
  assert.match(shortTermSmokeProofModel, /noVisibleCompareEntrypoint/);
  assert.match(shortTermSmokeProofModel, /canvasModeSwitchReachable/);
  assert.match(shortTermSmokeRunner, /document\.elementFromPoint\(compareExitHitX, compareExitHitY\)/);
  assert.match(shortTermSmokeRunner, /compareExitButtonPointerProof/);
  assert.match(shortTermSmokeRunner, /hitTargetIsExitButton: compareExitButtonPointerHit/);
  assert.match(shortTermSmokeRunner, /exitedToPreview: state\.view === "preview"/);
  assert.match(shortTermSmokeProofModel, /compareExitButtonPointerPathWorks/);
  assert.match(shortTermSmokeProofModel, /compareExitButtonBelowTitlebar/);
  assert.match(main, /compareExitButtonPointerProof/);
  assert.match(main, /hitTargetAction !== "back-preview"/);
  assert.match(main, /compareExitButtonPointerProof\.buttonTop < compareExitButtonPointerProof\.titlebarBottom/);
  assert.match(shortTermSmokeProofModel, /focusedControlSpaceNotGlobalPlayback/);
  assert.match(shortTermSmokeRunner, /focusedControlSpaceProof/);
  assert.match(shortTermSmokeRunner, /settingsAppearanceProof/);
  assert.match(shortTermSmokeRunner, /setAppearance\("dark"\)/);
  assert.match(shortTermSmokeRunner, /captureSmokeArtifact\("short-term-appearance-dark"\)/);
  assert.match(shortTermSmokeRunner, /captureSmokeArtifact\("short-term-settings-dialog"\)/);
  assert.match(shortTermSmokeRunner, /captureSmokeArtifact\("short-term-appearance-light"\)/);
  assert.match(shortTermSmokeRunner, /darkAppearanceScreenshotCaptured/);
  assert.match(shortTermSmokeRunner, /lightAppearanceScreenshotCaptured/);
  assert.match(shortTermSmokeProofModel, /minimumPreviewCaptured/);
  assert.match(shortTermSmokeProofModel, /export function collectShortTermReplaceableClassificationProof/);
  assert.match(shortTermSmokeProofModel, /short-term-replaceable-classification-proof/);
  assert.match(shortTermSmokeProofModel, /automaticKeysExcluded/);
  assert.match(shortTermSmokeRunner, /collectShortTermReplaceableClassificationProof/);
  assert.doesNotMatch(shortTermEntry, /proofId: "short-term-replaceable-classification-proof"/);
  assert.match(main, /validateShortTermOpenFlowProof/);
  assert.match(main, /dragDecisionOverlayVisible/);
  assert.match(main, /dragDecisionSplit !== "top-25-bottom-75"/);
  assert.match(main, /dragDecisionCenterPointOpen/);
  assert.match(main, /dragDecisionLowerCenterPointOpen/);
  assert.match(main, /dragDecisionBottomEntryPointOpen/);
  assert.match(main, /dragDecisionTopSecondaryPointCompare/);
  assert.match(main, /dragDecisionSecondaryPointCompare/);
  assert.match(main, /unsupportedDropSourceBytesRestoredAfterRecovery/);
  assert.match(main, /short-term-open-flow-proof\.json/);
  assert.match(main, /validateShortTermLoadFailureProof/);
  assert.match(main, /short-term-load-failure-proof\.json/);
  assert.match(main, /validateShortTermSpecComparisonProof/);
  assert.match(main, /short-term-spec-comparison-proof\.json/);
  assert.match(main, /function validateShortTermRightSurfaceNavigationProof/);
  assert.match(main, /shortTermRightSurfaceNavigationProof = validateShortTermRightSurfaceNavigationProof/);
  assert.match(main, /short-term-right-surface-navigation-proof\.json/);
  assert.match(main, /shortTermRightSurfaceNavigationProof: Boolean\(shortTermRightSurfaceNavigationProof\)/);
  assert.match(main, /function validateShortTermDesignInteractionProof/);
  assert.match(main, /normalizeBoundedStringList/);
  assert.match(main, /typeof normalized\.activeElementId !== "string"/);
  assert.match(main, /item\.activeElementId\.length > 80/);
  assert.match(main, /short-term-preview-optimization", "optimization", "panelOptimization"/);
  assert.match(main, /short-term-preview-replaceable", "replaceable", "panelOverview"/);
  assert.match(main, /rightSurfaceState: String\(item\.rightSurfaceState \|\| ""\)/);
  assert.match(main, /captureState\?\.rightSurfaceState === expectedSurface/);
  assert.match(main, /shortTermDesignInteractionProof = validateShortTermDesignInteractionProof/);
  assert.match(main, /short-term-design-interaction-proof\.json/);
  assert.match(main, /shortTermDesignInteractionProof: Boolean\(shortTermDesignInteractionProof\)/);
  assert.match(main, /validateShortTermReplaceableClassificationProof/);
  assert.match(main, /short-term-replaceable-classification-proof\.json/);
  assert.doesNotMatch(shortTermEntry, /const screenshotCaptures = \[\]/);
  assert.match(shortTermSmokeRunner, /shortTermScreenshots: smokeArtifactCapture\.allSmokeArtifactsCaptured\(9\)/);
  assert.match(shortTermSmokeRunner, /shortTermSaveFailed: saveFailedVisible/);
  assert.match(shortTermSmokeRunner, /shortTermLoadFailed: loadFailedVisible/);
  assert.match(shortTermSmokeProofModel, /export function collectShortTermEmptyStateProof/);
  assert.match(shortTermSmokeProofModel, /short-term-empty-state-proof/);
  assert.match(shortTermSmokeRunner, /collectShortTermEmptyStateProof/);
  assert.doesNotMatch(shortTermEntry, /proofId: "short-term-empty-state-proof"/);
  assert.match(shortTermSmokeProofModel, /export function collectShortTermRuntimeTextBoundaryProof/);
  assert.match(shortTermSmokeProofModel, /short-term-runtime-text-boundary-proof/);
  assert.match(shortTermSmokeProofModel, /inputSpaceSuppressed/);
  assert.match(shortTermSmokeProofModel, /productCompleteClaimed: true/);
  assert.match(shortTermSmokeRunner, /runtimeTextPlaybackBeforeSpace/);
  assert.match(shortTermSmokeRunner, /sourceSha256Before: runtimeTextSourceSha256Before/);
  assert.match(shortTermSmokeRunner, /sourceSha256AfterApply: runtimeTextSourceSha256AfterApply/);
  assert.match(shortTermSmokeProofModel, /runtimeTextKeySource: "official_svga_dynamic_text_imagekey"/);
  assert.match(shortTermSmokeProofModel, /runtimeOverlayVisibleAfterApply/);
  assert.match(shortTermSmokeRunner, /collectShortTermRuntimeTextBoundaryProof/);
  assert.doesNotMatch(shortTermEntry, /proofId: "short-term-runtime-text-boundary-proof"/);
  assert.match(shortTermSmokeRunner, /resetClearedOverlay/);
  assert.match(shortTermSmokeProofModel, /export function collectShortTermThumbnailProof/);
  assert.match(shortTermSmokeProofModel, /short-term-thumbnail-proof/);
  assert.match(shortTermSmokeProofModel, /sequenceFourGridVisible/);
  assert.match(shortTermSmokeProofModel, /sequenceThumbnailImageCount/);
  assert.match(shortTermSmokeRunner, /collectShortTermThumbnailProof/);
  assert.doesNotMatch(shortTermEntry, /proofId: "short-term-thumbnail-proof"/);
  assert.match(shortTermOverviewModel, /overviewFactGroups/);
  assert.match(shortTermRenderModel, /"fileSize"/);
  assert.match(shortTermRenderModel, /"decodedMemory"/);
  assert.match(shortTermRenderModel, /"runtimeStructure"/);
  assert.match(shortTermRenderModel, /"runtimeObjectCount"/);
  assert.match(shortTermRenderModel, /"animationFrameRecordCount"/);
  assert.match(shortTermRenderModel, /export function overviewFactGroups/);
  assert.match(shortTermRenderModel, /fact\.disclosure !== "moreInfo" \|\| RISK_STATUSES\.has\(fact\.status\)/);
  assert.match(shortTermOverviewModel, /moreInfoFacts: factGroups\.moreInfo/);
  assert.match(shortTermOverviewRenderers, /summary\.textContent = "更多信息"/);
  assert.match(shortTermOverviewRenderers, /view\.moreInfoFacts\.length > 0/);
  assert.match(shortTermSmokeProofModel, /export function collectShortTermOptimizationProof/);
  assert.match(shortTermSmokeProofModel, /short-term-optimization-proof/);
  assert.match(shortTermSmokeProofModel, /optimizedBytesSmaller/);
  assert.match(shortTermSmokeProofModel, /executedActionCount/);
  assert.match(shortTermSmokeProofModel, /executedActionRowsVisible/);
  assert.match(shortTermSmokeProofModel, /skippedMethodRowsVisible/);
  assert.match(shortTermSmokeRunner, /collectShortTermOptimizationProof/);
  assert.doesNotMatch(shortTermEntry, /proofId: "short-term-optimization-proof"/);
  assert.match(shortTermOptimizationModel, /groupOptimizationItems/);
  assert.match(shortTermRenderModel, /item\.count > 1/);
  assert.match(shortTermCompareModel, /data-optimization-actions/);
  assert.match(shortTermCompareModel, /data-optimization-skipped/);
  assert.match(shortTermCompareModel, /optimizationMetricGrid/);
  assert.match(shortTermCompareModel, /renderOptimizationMetricCellHtml/);
  assert.match(shortTermCompareModel, /optimizationActions/);
  assert.match(shortTermCompareModel, /data-component="OptimizationResultDetailRow" data-result-disposition="executed"/);
  assert.match(shortTermCompareModel, /data-component="OptimizationResultDetailRow" data-result-disposition="skipped"/);
  assert.match(shortTermCompareModel, /data-action="save-as"\$\{saveDisabled\}>另存为 SVGA/);
  assert.match(shortTermCompareModel, /data-action="save-overwrite"\$\{saveDisabled\}>覆盖保存/);
  assert.match(shortTermCompareModel, /data-action="back-preview">放弃优化/);
  assert.ok(
    shortTermCompareModel.indexOf("optimizationMetricGrid") < shortTermCompareModel.indexOf("optimizationActions")
      && shortTermCompareModel.indexOf("optimizationActions") < shortTermCompareModel.indexOf("data-optimization-actions"),
    "optimization result actions stay above long detail lists"
  );
  assert.match(shortTermFeedbackModel, /function bannerTone/);
  assert.match(shortTermFeedbackSurface, /showSaveFeedbackBanner\(nodes\.saveBanner, title, message, tone\)/);
  assert.match(shortTermFeedbackSurface, /clearSaveFeedbackBanner\(nodes\.saveBanner\)/);
  assert.match(shortTermFeedbackSurface, /hideSaveFeedbackBanner\(nodes\.saveBanner\)/);
  assert.doesNotMatch(shortTermEntry, /nodes\.saveBanner\.hidden = true|nodes\.saveBanner\.dataset\.status|nodes\.saveBanner\.innerHTML =/);
  assert.match(shortTermSaveRenderers, /node\.dataset\.status = view\.status/);
  assert.match(shortTermSaveRenderers, /node\.innerHTML = view\.html/);
  assert.doesNotMatch(shortTermEntry, /function messageRow|renderMessageRowHtml/);
  assert.doesNotMatch(shortTermEntry, /document\.createElement\("p"\)|empty\.dataset\.component = "InlineStatus"/);
  assert.match(shortTermOptimizationRenderers, /row\.dataset\.component = "InlineStatus"/);
  assert.doesNotMatch(shortTermEditReservedRenderers, /empty\.dataset\.component = "InlineStatus"/);
  assert.match(shortTermInlineStatusRenderers, /empty\.dataset\.component = "InlineStatus"/);
  assert.match(shortTermEditReservedRenderers, /row\.className = "layerRow"/);
  assert.doesNotMatch(shortTermEditReservedRenderers, /row\.className = "assetRow"/);
  assert.match(shortTermEditReservedRenderers, /row\.dataset\.component = "LayerRow"/);
  assert.match(shortTermReplaceableRenderers, /class="rowIndex"/);
  assert.match(shortTermSmokeProofModel, /comparisonVisible/);
  assert.match(shortTermSmokeProofModel, /sourceBytesUnchanged/);
  assert.match(shortTermSmokeProofModel, /export function collectShortTermRenameProof/);
  assert.match(shortTermSmokeProofModel, /short-term-rename-proof/);
  assert.match(shortTermSmokeProofModel, /contextMenuOpened/);
  assert.match(shortTermSmokeProofModel, /enterConfirmed/);
  assert.match(shortTermSmokeProofModel, /renamedKeyVisible/);
  assert.match(shortTermSmokeProofModel, /referenceFieldsChecked: \["imageKey", "matteKey"\]/);
  assert.match(shortTermSmokeProofModel, /referenceClosurePassed/);
  assert.match(shortTermSmokeProofModel, /matteKeyReferenceClosurePassed/);
  assert.match(shortTermSmokeProofModel, /danglingReferenceCount === 0/);
  assert.match(shortTermSmokeRunner, /collectShortTermRenameProof/);
  assert.doesNotMatch(shortTermEntry, /proofId: "short-term-rename-proof"/);
  assert.match(shortTermSmokeProofModel, /export function collectShortTermReplacementProof/);
  assert.match(shortTermSmokeProofModel, /short-term-replacement-proof/);
  assert.match(shortTermSmokeProofModel, /resetCommandEnabled/);
  assert.match(shortTermSmokeProofModel, /resetRestoredOriginal/);
  assert.match(shortTermSmokeProofModel, /resourceMenuKeyboardNavigationPassed/);
  assert.match(shortTermSmokeRunner, /resourceMenuArrowDownFocusedAction/);
  assert.match(shortTermSmokeRunner, /resourceMenuEndFocusedAction/);
  assert.match(shortTermSmokeRunner, /resourceMenuHomeFocusedAction/);
  assert.match(shortTermSmokeProofModel, /resourceMenuFocusReturnedAfterClose/);
  assert.match(shortTermSmokeRunner, /const resourceMenuFocusReturnedAfterClose = document\.activeElement === replacementRow/);
  assert.match(shortTermSmokeProofModel, /saveAsEnabledBeforeReset/);
  assert.match(shortTermSmokeRunner, /collectShortTermReplacementProof/);
  assert.doesNotMatch(shortTermEntry, /proofId: "short-term-replacement-proof"/);
  assert.match(shortTermSmokeProofModel, /noAudioVisible/);
  assert.match(shortTermSmokeProofModel, /noReplaceableImagesMinimal/);
  assert.match(shortTermSmokeProofModel, /textUnavailableMinimal/);
  assert.match(shortTermSmokeProofModel, /ordinaryImagesNotDuplicatedInReplaceables/);
  assert.match(shortTermSmokeProofModel, /ordinaryImageThumbnailVisible/);
  assert.match(shortTermController, /function createSaveFailureProofOutput/);
  assert.match(shortTermSaveSurface, /const savedModel = await inspectShortTerm\(outputBytes/);
  assert.ok(
    shortTermSaveSurface.indexOf("const savedModel = await inspectShortTerm(outputBytes") < shortTermSaveSurface.indexOf("state.sourceBytes = outputBytes"),
    "saved output must reopen before becoming the current source bytes"
  );
  assert.match(shortTermSmokeRunner, /playerLifecycleOk/);
  assert.match(shortTermSmokeRunner, /dragDropLoaded/);
  assert.match(shortTermSmokeProofModel, /export async function waitForCanvasPixels/);
  assert.match(shortTermSmokeProofModel, /export function resourceEntriesAreLocalOnly/);
  assert.match(shortTermSmokeRunner, /waitForCanvasPixels/);
  assert.match(shortTermApiClient, /name=invalid\.svga/);
  assert.match(shortTermPlaybackModel, /toParserArrayBuffer/);
  assert.match(shortTermByteModel, /view\.buffer\.slice\(view\.byteOffset, view\.byteOffset \+ view\.byteLength\)/);
  assert.match(shortTermController, /confirmDiscardUnsavedOutput/);
  assert.match(shortTermController, /renderTextElements/);
  assert.match(shortTermController, /selectedTextElement/);
  assert.match(shortTermReplaceableSurface, /当前文件没有可预览文本元素/);
  assert.match(shortTermFileSurface, /打开新文件会放弃当前未保存的 SVGA 输出/);
  assert.match(shortTermFileSurface, /拖入新文件会放弃当前未保存的 SVGA 输出/);
  assert.match(shortTermOptimizationSurface, /showOperationFailure\("优化未完成。", error\)/);
  assert.match(shortTermReplaceableSurface, /showOperationFailure\("重命名未完成。", error\)/);
  assert.match(shortTermReplaceableSurface, /showOperationFailure\("替换未完成。", error\)/);
  assert.match(shortTermReplaceableSurface, /showSaveBanner\("正在重命名 imageKey…", ""\)/);
  assert.match(shortTermReplaceableSurface, /showSaveBanner\("正在替换图片…", ""\)/);
  assert.match(shortTermFeedbackModel, /源文件没有被修改。/);
  assert.doesNotMatch(shortTermReplaceableSurface, /完成引用闭合检查|完成重开验证|保存保持关闭/);
  assert.doesNotMatch(shortTermOptimizationSurface, /保存保持关闭/);
  assert.doesNotMatch(shortTermSaveSurface, /保存保持关闭/);
  assert.match(shortTermController, /currentStateSummary/);
  assert.match(shortTermFeedbackModel, /错误：\$\{input\.errorText\.trim\(\)\}/);
  assert.match(shortTermFeedbackModel, /提示：\$\{input\.saveBannerText\.trim\(\)\}/);
  assert.match(shortTermActionBridge, /writeClipboardText\?\.\(handlers\.currentStateSummary\(\)\)/);
  assert.match(shortTermCommandSurface, /syncShortTermMenuState/);
  assert.match(shortTermHostClient, /updateShortTermMenuState/);
  assert.match(shortTermCommandState, /canShowOptimizationComparison/);
  assert.match(shortTermController, /showOptimizationComparison/);
  assert.match(shortTermCompareModel, /compareSummary/);
  assert.match(shortTermCompareModel, /compareMetricGrid/);
  assert.match(shortTermCompareModel, /compareActions/);
  assert.match(shortTermResourceMenuModel, /input\.activeOutput\?\.kind !== "replacement"/);
  assert.match(shortTermEventBindings, /addEventListener\("contextmenu"/);
  assert.match(shortTermController, /openResourceContextMenu/);
  assert.doesNotMatch(shortTermEntry, /rename-resource|replace-resource|reset-resource/);
  assert.doesNotMatch(shortTermEntry, /svga-sequence-repair|batch-png|exportReview/);
  assert.match(workbenchPage, /productShellMount/);
  assert.match(workbenchPage, /\/tools\/shared\/product-tokens\.css/);
  assert.match(workbenchPage, /\/tools\/shared\/product-frontend\/product-shell\.html/);
  assert.match(workbenchPage, /src="\/desktop-product-entry\.mjs"/);
  assert.match(sharedShell, /class="shell"/);
  assert.match(sharedShell, /本地预览/);
  assert.match(sharedShell, /data-workbench-region="inspector"/);
  assert.doesNotMatch(sharedShell, /检查器/);
  assert.doesNotMatch(sharedShell, /SVGA 信息/);
  assert.match(sharedShell, /活动记录/);
  assert.match(sharedShell, /设置/);
  assert.match(sharedShell, /floatingRoot/);
  assert.match(desktopEntry, /mountProductShell/);
  assert.match(desktopEntry, /autoSvgaHostAdapter/);
  assert.match(desktopEntry, /installSvgaWebCompatibility/);
  assert.match(desktopEntry, /\/tools\/shared\/product-frontend\/product-app\.mjs/);
  assert.match(desktopEntry, /x-auto-svga-prototype-token/);
  assert.match(desktopEntry, /productMilestoneId: bridge\?\.productMilestoneId \?\? "short-term"/);
  assert.match(desktopEntry, /latestArtifactHttpApi: Boolean\(bridge\?\.scanLatestArtifacts\)/);
  assert.match(desktopEntry, /electronReferenceMediaDialog: Boolean\(bridge\?\.openReferenceMediaFile\)/);
  assert.match(desktopEntry, /scanLatestArtifacts\?\.\(\)/);
  assert.doesNotMatch(desktopEntry, /latestArtifactHttpApi:\s*false/);
  assert.doesNotMatch(desktopEntry, /Electron 默认产品页不自动扫描/);
  assert.match(desktopEntry, /editorIncubationDefaultVisible: false/);
  assert.match(desktopEntry, /class CompatibleSvgaPlayer/);
  assert.match(desktopEntry, /class CompatibleSvgaParser/);
  assert.match(
    desktopEntry,
    /bridge\?\.productMilestoneId !== "short-term"[\s\S]*tokenBoundApiPaths\.add\("\/api\/svga-sequence-repair"\)/
  );
  assert.ok(
    desktopEntry.indexOf("class CompatibleSvgaParser") < desktopEntry.indexOf("installSvgaWebCompatibility();"),
    "svga-web compatibility classes must be defined before installation"
  );
  assert.match(main, /rendererEntry = usesShortTermPreviewShell \? "web\/short-term-macos-app\.mjs"/);
  assert.match(main, /rendererPath = usesShortTermPreviewShell \? "\/" : "\/workbench\.html"/);
  assert.match(main, /const productArtifactRoot = process\.env\.AUTO_SVGA_PRODUCT_ARTIFACTS[\s\S]*path\.join\(repoRoot, "\.artifacts\/product", productMilestoneId\)/);
  assert.match(main, /path: `\.artifacts\/product\/\$\{productMilestoneId\}\/\$\{fileName\}`/);
  assert.doesNotMatch(main, /productArtifactRoot[\s\S]{0,160}\.artifacts\/internal-trial/);
  assert.match(main, /installShortTermApplicationMenu/);
  assert.match(main, /function updateShortTermMenuState/);
  assert.match(main, /function setShortTermWindowMode/);
  assert.match(main, /IPC_CHANNELS\.setShortTermWindowMode/);
  assert.match(main, /function validateShortTermMenuState/);
  assert.match(main, /short-term-menu-state-proof/);
  assert.match(main, /stateReflectsLoadedSmoke/);
  assert.match(main, /openMenuAvailable/);
  assert.match(main, /recentMenuExists/);
  assert.match(main, /clearRecentMenuExists/);
  assert.match(main, /recentMenuRecordCountMatchesState/);
  assert.match(main, /recentMenuRecordLimitRespected/);
  assert.match(main, /recentMenuLabelsPathRedacted/);
  assert.match(main, /recentMenuPlaceholderMatchesEmptyState/);
  assert.match(main, /clearRecentEnabledMatchesState/);
  assert.match(main, /function menuSubmenuItems/);
  assert.match(main, /editRenameEnabledMatchesSelection/);
  assert.match(main, /cancelEnabledMatchesTransientState/);
  assert.match(main, /resetImageEnabledMatchesReplacementState/);
  assert.match(main, /editTextEnabledMatchesTextState/);
  assert.match(main, /resetTextEnabledMatchesTextState/);
  assert.match(main, /optimizationTabAvailableWithFile/);
  assert.match(main, /overviewTabCheckedMatchesState/);
  assert.match(main, /optimizationTabCheckedMatchesState/);
  assert.match(main, /replaceableTabCheckedMatchesState/);
  assert.match(main, /helpStateSummaryAvailable/);
  assert.match(main, /shortTermScreenshots/);
  assert.match(main, /shortTermLoadFailed/);
  assert.match(main, /shortTermSaveFailed/);
  assert.match(main, /function validateShortTermEmptyStateProof/);
  assert.match(main, /function validateShortTermRuntimeTextBoundaryProof/);
  assert.match(main, /function validateShortTermThumbnailProof/);
  assert.match(main, /function validateShortTermOptimizationProof/);
  assert.match(main, /function validateShortTermReplaceableClassificationProof/);
  assert.match(main, /function validateShortTermRenameProof/);
  assert.match(main, /function validateShortTermReplacementProof/);
  assert.match(main, /short-term-empty-state-proof\.json/);
  assert.match(main, /short-term-runtime-text-boundary-proof\.json/);
  assert.match(main, /short-term-thumbnail-proof\.json/);
  assert.match(main, /short-term-optimization-proof\.json/);
  assert.match(main, /short-term-replaceable-classification-proof\.json/);
  assert.match(main, /short-term-rename-proof\.json/);
  assert.match(main, /short-term-replacement-proof\.json/);
  assert.match(main, /shortTermNoAudio/);
  assert.match(main, /shortTermNoReplaceable/);
  assert.match(main, /shortTermTextUnavailable/);
  assert.match(main, /shortTermRuntimeTextBoundary/);
  assert.match(main, /shortTermThumbnails/);
  assert.match(main, /shortTermOptimization/);
  assert.match(main, /shortTermRename/);
  assert.match(main, /shortTermReplacement/);
  assert.match(main, /designer_named_imagekey_text_anchor/);
  assert.match(main, /official_svga_dynamic_text_imagekey/);
  assert.match(main, /runtimeTextKeySource/);
  assert.match(main, /runtimeOverlayVisibleAfterApply/);
  assert.match(main, /resetButtonEnabledAfterApply/);
  assert.match(main, /resetClearedOverlay/);
  assert.match(main, /productCompleteClaimed !== true/);
  assert.match(main, /short-term-launch/);
  assert.match(main, /short-term-sequence-thumbnails/);
  assert.match(main, /short-term-optimization-result/);
  assert.match(main, /short-term-rename-dirty/);
  assert.match(main, /short-term-replacement-dirty/);
  assert.match(main, /short-term-replacement-reset/);
  assert.match(main, /short-term-runtime-text-applied/);
  assert.match(main, /short-term-preview-minimum/);
  assert.match(main, /short-term-settings-dialog/);
  assert.match(main, /short-term-appearance-dark/);
  assert.match(main, /short-term-appearance-light/);
  assert.match(main, /short-term-load-failed/);
  assert.match(main, /short-term-save-failed/);
  assert.match(main, /short-term-playback-failed/);
  assert.match(main, /enabled: menuState\.canOverwrite/);
  assert.match(main, /enabled: menuState\.canSaveAs/);
  assert.match(main, /enabled: menuState\.canRenameImageKey/);
  assert.match(main, /enabled: menuState\.canReplaceImage/);
  assert.match(main, /enabled: menuState\.canRunOptimization/);
  assert.match(main, /enabled: menuState\.canShowOptimizationComparison/);
  assert.match(main, /saveShortTermSvgaOutput/);
  assert.match(main, /label: "文件"/);
  assert.match(main, /label: "编辑"/);
  assert.match(main, /label: "资源"/);
  assert.match(main, /label: "优化"/);
  const shortTermMenuStart = main.indexOf("function installShortTermApplicationMenu");
  const legacyMenuStart = main.indexOf("function installApplicationMenu", shortTermMenuStart + 1);
  assert.ok(shortTermMenuStart >= 0, "short-term macOS menu must be present");
  assert.ok(legacyMenuStart > shortTermMenuStart, "legacy menu boundary must follow short-term menu");
  const shortTermMenuSource = main.slice(shortTermMenuStart, legacyMenuStart);
  assert.doesNotMatch(shortTermMenuSource, /toggleDevTools|开发者工具|role: "reload"|重新载入窗口/);
  assert.match(prototypeRenderer, /loadBatchPngFiles/);
  assert.doesNotMatch(page, /id="pngInput"|id="batchPngInput"|批量 PNG 映射复核|替换 PNG/);
  assert.doesNotMatch(desktopEntry, /svgaplayerweb|unsafe-eval/);
  assert.doesNotMatch(desktopEntry, /require\(|ipcRenderer|node:fs|\/Users\//);
});

test("legacy editor prototype remains isolated from the default product surface", async () => {
  const renderer = await readFile(path.join(experimentRoot, "web/prototype.js"), "utf8");
  const page = await readFile(path.join(experimentRoot, "web/index.html"), "utf8");
  assert.match(renderer, /renderDesktopInspectionPresentation/);
  assert.match(renderer, /createInspectionPresentation/);
  assert.match(renderer, /data-inspection-group="overview"/);
  assert.match(renderer, /data-inspection-group="spec"/);
  assert.match(renderer, /data-inspection-group="audit"/);
  assert.match(renderer, /fileInput\.addEventListener\("change"/);
  assert.match(renderer, /dropZone\.addEventListener\("drop"/);
  assert.match(renderer, /playButton\.addEventListener\("click"/);
  assert.match(renderer, /pauseButton\.addEventListener\("click"/);
  assert.match(renderer, /replayButton\.addEventListener\("click"/);
  assert.match(renderer, /选择 SVGA 文件/);
  assert.match(renderer, /无法打开此 SVGA 文件/);
  assert.match(renderer, /不支持的文件类型/);
  assert.match(renderer, /cleanupPlayer\(\);\n\s+rejectedName = name;\n\s+showError\("无法打开此 SVGA 文件/);
  assert.match(renderer, /SVGA 播放输出为空/);
  assert.match(renderer, /waitForVisibleCanvasSamples/);
  assert.match(renderer, /visibleCanvas\.sampleCount >= 3/);
  assert.match(renderer, /clearCanvas/);
  assert.match(renderer, /summary\.dimensions/);
  assert.match(renderer, /timing\.durationMs/);
  assert.match(renderer, /const hostBridge = window\.autoSvgaPrototype \?\? window\.autoSvgaElectronHost/);
  assert.match(renderer, /openHostSvgaFile/);
  assert.match(renderer, /hostBridge\.openSvgaFile/);
  assert.match(renderer, /saveEditedSvga/);
  assert.match(renderer, /\/api\/svga-image-edit-session/);
  assert.match(renderer, /\/api\/svga-image-replace/);
  assert.match(renderer, /renderP3ComparisonArtifact/);
  assert.match(renderer, /p3-original-edited-comparison/);
  assert.doesNotMatch(page, /id="pngInput"|id="batchPngInput"|id="hostOpenButton"/);
  assert.doesNotMatch(renderer, /window\.autoSvgaPrototype\./);
  assert.doesNotMatch(renderer, /require\(|ipcRenderer|node:fs|\/Users\//);
});

test("P5 batch PNG mapping review stays isolated in the desktop prototype", async () => {
  const page = await readFile(path.join(experimentRoot, "web/index.html"), "utf8");
  const renderer = await readFile(path.join(experimentRoot, "web/prototype.js"), "utf8");
  const server = await readFile(path.join(experimentRoot, "server.mjs"), "utf8");
  const styles = await readFile(path.join(experimentRoot, "web/styles.css"), "utf8");

  assert.doesNotMatch(page, /id="batchPngInput"/);
  assert.match(renderer, /loadBatchPngFiles/);
  assert.match(renderer, /refreshBatchMappingReport/);
  assert.match(renderer, /applyBatchMapping/);
  assert.match(renderer, /\/api\/svga-batch-png-map/);
  assert.match(renderer, /pngSha256/);
  assert.match(renderer, /replacement\.inputIndex/);
  assert.match(renderer, /replacementRequestMilestoneId/);
  assert.match(renderer, /batchReplacementRequestOptions/);
  assert.match(renderer, /bindPreviewEvidenceToRoundTripReport/);
  assert.match(renderer, /schemaVersion !== 4/);
  assert.match(renderer, /milestoneId !== "P5"/);
  assert.match(renderer, /appliedMappingCount >= 3/);
  assert.match(renderer, /appliedMappingCount: Number\.isInteger\(lastRoundTripReport\.appliedMappingCount\)/);
  assert.match(renderer, /playbackPassed/);
  assert.match(renderer, /canvasNonBlank/);
  assert.match(renderer, /批量 PNG 映射复核/);
  assert.match(renderer, /批量替换 PNG/);
  assert.match(renderer, /应用批量替换/);
  assert.match(renderer, /当前视图：精确和规范化匹配/);
  assert.match(renderer, /技术详情/);
  assert.match(renderer, /collectP5UiFlowProof/);
  assert.match(renderer, /collectBatchMappingPanelRenderProof/);
  assert.match(renderer, /dispatchBatchInputFiles/);
  assert.match(renderer, /dispatchBatchDropFiles/);
  assert.match(renderer, /setBatchIncludeViaControl/);
  assert.match(renderer, /setBatchManualTargetViaControl/);
  assert.match(renderer, /data-batch-mapping-state/);
  assert.match(renderer, /data-batch-action="manual-target"/);
  assert.match(renderer, /data-batch-action="include"/);
  assert.match(renderer, /batch_replace_resources/);
  assert.match(server, /\/api\/svga-batch-png-map/);
  assert.match(server, /createSvgaBatchPngMappingReport/);
  assert.match(server, /input\?\.milestoneId === "P5"/);
  assert.match(server, /normalizeBatchMappings/);
  assert.match(server, /path\.basename\(String\(file\?\.fileLabel/);
  const main = await readFile(path.join(experimentRoot, "main.cjs"), "utf8");
  assert.match(main, /categoryCount: \(result\.reviewerBCategories \?\? \[\]\)\.length/);
  assert.match(main, /p5-ui-flow-proof\.json/);
  assert.match(main, /p5-mapping-ui-render-proof\.json/);
  assert.match(main, /verdict: \(result\.reviewerBCategories/);
  assert.equal(styles.trim(), '@import url("/tools/shared/product-frontend/product-styles.css");');
  assert.doesNotMatch(renderer, /fuzzy|substring|editDistance|visualSimilarity|\/Users\//i);
});

test("P3 image replacement prototype stays isolated and records verified Save As evidence", async () => {
  const main = await readFile(path.join(experimentRoot, "main.cjs"), "utf8");
  const renderer = await readFile(path.join(experimentRoot, "web/prototype.js"), "utf8");
  const server = await readFile(path.join(experimentRoot, "server.mjs"), "utf8");
  const runtimePrep = await readFile(path.join(experimentRoot, "../../scripts/prepare-runtime.mjs"), "utf8");
  const productApp = await readFile(path.join(repoRoot, "tools/shared/product-frontend/product-app.mjs"), "utf8");
  const preloadApi = hostContract.createPreloadApi(() => undefined, {
    reportToken: "test-token",
    productMilestoneId: "P3"
  });
  assert.match(main, /Basic Image Resource Replacement And Save As/);
  assert.match(main, /Save As target must be different from the original SVGA/);
  assert.match(main, /Save As requires the source SVGA to be opened through the desktop file picker/);
  assert.match(main, /p3SmokeSaveAs/);
  assert.match(main, /sourceFilePaths\.get\(value\.sourceId\)/);
  assert.match(main, /writeJsonProductArtifact\("resource-edit-report\.json", "p3-resource-edit-report", verifiedResult\)/);
  assert.match(main, /writeJsonProductArtifact\("round-trip-report\.json", "p3-round-trip-report", verifiedRoundTripReport\)/);
  assert.match(main, /writeJsonProductArtifact\("thumbnail-evidence\.json", "p3-thumbnail-evidence"/);
  assert.match(main, /validateP3ThumbnailEvidence/);
  assert.match(main, /schemaVersion:\s*2/);
  assert.match(main, /"p3-resource-list"/);
  assert.match(main, /"p3-original-edited-comparison": "original-edited-comparison\.png"/);
  assert.equal(typeof preloadApi.openSvgaFile, "function");
  assert.equal(typeof preloadApi.saveEditedSvga, "function");
  assert.equal(typeof preloadApi.reportP3EditResult, "function");
  assert.match(renderer, /renderEditPanel/);
  assert.match(renderer, /替换 PNG/);
  assert.match(renderer, /重置此资源/);
  assert.match(renderer, /另存为/);
  assert.match(renderer, /confirmDiscardUnsavedEdits/);
  assert.match(renderer, /window\.confirm/);
  assert.match(renderer, /canSaveEditedSvga/);
  assert.match(renderer, /浏览器选择或拖拽导入无法安全确认原始路径/);
  assert.match(renderer, /replacement-p3\.png/);
  assert.match(renderer, /originalCanvasHash !== editedCanvasHash/);
  assert.match(renderer, /thumbnailEvidence/);
  assert.match(renderer, /replacementSelectedScreenshotSha256/);
  assert.match(renderer, /replacementSelectedStateConfirmed/);
  assert.match(renderer, /replacementSelectedCandidateSha256/);
  assert.match(renderer, /replacementSelectedCandidateVisible/);
  assert.match(renderer, /replacementMatchesReopened/);
  assert.match(main, /validateReplacementResetProof/);
  assert.match(productApp, /svga-replacement-reset-proof/);
  assert.match(renderer, /invalidPngRetainsLastValidThumbnail/);
  assert.match(renderer, /resourceThumbnailSha256/);
  assert.match(renderer, /renderP3ComparisonArtifact/);
  assert.match(server, /\/api\/svga-image-edit-session/);
  assert.match(server, /\/api\/svga-image-replace/);
  assert.match(server, /attachSessionThumbnails/);
  assert.match(server, /thumbnailDataUrl/);
  assert.match(server, /SvgaImageResourceEditor/);
  assert.match(runtimePrep, /replacement-p3\.png/);
  assert.doesNotMatch(renderer, /readFile|writeFile|dialog|shell|\/Users\//);
  assert.doesNotMatch(main, /svga-web-experiment:open-svga-file[\s\S]*persistedAbsolutePath/);
});

test("P4 multi-resource editing keeps history and export integrity boundaries isolated", async () => {
  const main = await readFile(path.join(experimentRoot, "main.cjs"), "utf8");
  const renderer = await readFile(path.join(experimentRoot, "web/prototype.js"), "utf8");
  const server = await readFile(path.join(experimentRoot, "server.mjs"), "utf8");
  const preloadApi = hostContract.createPreloadApi(() => undefined, {
    reportToken: "test-token",
    productMilestoneId: "P4"
  });
  assert.match(renderer, /editHistorySnapshots/);
  assert.match(renderer, /savedReplacementDigest/);
  assert.match(renderer, /editOperationSequence/);
  assert.match(renderer, /maxEditHistorySnapshots/);
  assert.match(renderer, /replacementInputDigest/);
  assert.match(renderer, /data-edit-action="undo"/);
  assert.match(renderer, /data-edit-action="redo"/);
  assert.match(renderer, /data-edit-dirty/);
  assert.match(renderer, /data-edit-revision/);
  assert.match(renderer, /data-edit-can-undo/);
  assert.match(renderer, /data-edit-can-redo/);
  assert.match(renderer, /key === "z"/);
  assert.match(renderer, /key === "y"/);
  assert.match(renderer, /undoEditHistory/);
  assert.match(renderer, /redoEditHistory/);
  assert.match(renderer, /isStaleEditOperation/);
  assert.match(renderer, /staleLoadResult/);
  assert.match(renderer, /operationSequence/);
  assert.match(renderer, /maybeRunP4EditSmoke/);
  assert.match(renderer, /reportP4EditResult/);
  assert.match(renderer, /createSaveRevisionValidation/);
  assert.match(renderer, /roundTripReportDigest/);
  assert.match(renderer, /saveOperationSequence !== editOperationSequence/);
  assert.match(renderer, /reopenedResult\.playback/);
  assert.match(main, /validateSaveRevisionBinding/);
  assert.match(main, /value\.milestoneId === "P5"/);
  assert.match(main, /value\.reportSchemaVersion !== 4 \|\| value\.reportMilestoneId !== "P5"/);
  assert.match(main, /value\.appliedMappingCount < 3/);
  assert.match(main, /editedBytesSha256/);
  assert.match(main, /value\.replacementCount < 2/);
  assert.equal(typeof preloadApi.reportP4EditResult, "function");
  assert.match(renderer, /replacementRequestMilestoneId/);
  assert.match(server, /input\?\.milestoneId === "P3"/);
  assert.match(server, /replaceImages\(bytes, decodedReplacements, name, \{/);
  assert.match(server, /milestoneId,/);
  assert.match(main, /const savedSourceId = rememberSourceFile\(targetPath\)/);
  assert.match(main, /sourceId: savedSourceId/);
  assert.match(main, /IPC_CHANNELS\.p4EditResult/);
  assert.match(main, /validateP4EditResult/);
  assert.match(main, /multi-resource-round-trip-report\.json/);
  assert.match(main, /edit-history-report\.json/);
  assert.match(main, /canonical-multi-resource-fixture\.json/);
  assert.match(main, /multi-resource-edited-output\.svga/);
  const p4UploadScript = await readFile(path.join(experimentRoot, "scripts/build-p4-upload-package.mjs"), "utf8");
  assert.match(p4UploadScript, /review\/P4-latest/);
  assert.match(p4UploadScript, /P4 upload ZIP/);
  assert.match(p4UploadScript, /reviewSource: "independent-read-only-reviewer-b-json"/);
  assert.doesNotMatch(p4UploadScript, /generatedAt: "stable-reviewer-b-product-categories"/);
  assert.doesNotMatch(renderer, /readFile|writeFile|dialog|shell|\/Users\//);
});

test("short-term design system check enforces UI implementation guardrails", () => {
  const source = readFileSync(path.join(experimentRoot, "scripts/check-short-term-design-system.mjs"), "utf8");
  const dynamicDomAllowlist = source.match(/const allowedDynamicDomModules = new Set\(\[([\s\S]*?)\]\);/)?.[1] ?? "";
  const dataComponentAllowlist = source.match(/const allowedDataComponents = new Set\(\[([\s\S]*?)\]\);/)?.[1] ?? "";
  assert.doesNotMatch(dynamicDomAllowlist, /short-term-macos-dom-renderers\.mjs/);
  assert.match(dynamicDomAllowlist, /short-term-macos-compare-renderers\.mjs/);
  assert.match(dynamicDomAllowlist, /short-term-macos-edit-reserved-renderers\.mjs/);
  assert.match(dynamicDomAllowlist, /short-term-macos-inline-status-renderers\.mjs/);
  assert.match(dynamicDomAllowlist, /short-term-macos-launch-renderers\.mjs/);
  assert.match(dynamicDomAllowlist, /short-term-macos-optimization-renderers\.mjs/);
  assert.match(dynamicDomAllowlist, /short-term-macos-overview-renderers\.mjs/);
  assert.match(dynamicDomAllowlist, /short-term-macos-replaceable-renderers\.mjs/);
  assert.match(dynamicDomAllowlist, /short-term-macos-save-renderers\.mjs/);
  assert.doesNotMatch(dynamicDomAllowlist, /short-term-macos-compare-model\.mjs|short-term-macos-render-model\.mjs|short-term-macos-recent-files-model\.mjs/);
  assert.match(dataComponentAllowlist, /DragDecisionOverlay/);
  assert.match(dataComponentAllowlist, /CanvasToast/);
  assert.match(source, /const disallowedLaunchCopyPatterns = \[/);
  assert.match(source, /launch-page-copy-stays-minimal/);
  assert.match(source, /const disallowedLegacySurfaceCopyPatterns = \[/);
  assert.match(source, /visible-surface-avoids-legacy-workbench-and-inspector-language/);
  assert.match(source, /<p>拖拽文件到此处<\\\/p>/);
  assert.match(source, /largeOpenButton/);
  assert.match(source, /recentNote" hidden/);
  const output = execFileSync(process.execPath, ["scripts/check-short-term-design-system.mjs"], {
    cwd: experimentRoot,
    encoding: "utf8"
  });
  const report = JSON.parse(output);
  assert.equal(report.proofId, "short-term-design-system-check");
  assert.equal(report.passed, true);
  assert.ok(report.checks.some((check) => check.name === "stylesheet-order" && check.passed === true));
  assert.ok(report.checks.some((check) => check.name === "focus-visible-covered-by-ui-layers" && check.passed === true));
  assert.ok(report.checks.some((check) => check.name === "reduced-motion-covered" && check.passed === true));
  assert.ok(report.checks.some((check) => check.name === "foreground-validation-rule-documented" && check.passed === true));
  assert.ok(report.checks.some((check) => check.name === "launch-page-copy-stays-minimal" && check.passed === true));
  assert.ok(report.checks.some((check) => check.name === "visible-surface-avoids-legacy-workbench-and-inspector-language" && check.passed === true));
  assert.ok(report.checks.some((check) => check.name === "figma-page-state-catalog-mapped" && check.passed === true));
  assert.ok(report.checks.some((check) => check.name === "figma-page-states-map-to-current-html" && check.passed === true));
  assert.ok(report.checks.some((check) => check.name === "figma-page-frame-layout-contract-covered" && check.passed === true));
});

test("root package exposes explicit desktop entrypoints without changing default scripts", async () => {
  const rootPackage = JSON.parse(await readFile(path.join(repoRoot, "package.json"), "utf8"));
  const experimentPackage = JSON.parse(await readFile(path.join(experimentRoot, "package.json"), "utf8"));
  const legacyPackage = JSON.parse(await readFile(path.join(experimentRoot, "../../package.json"), "utf8"));
  assert.equal(rootPackage.scripts["desktop:dev"], "npm --prefix tools/electron-prototype/experiments/svga-web run desktop:dev");
  assert.equal(rootPackage.scripts["desktop:smoke"], "npm --prefix tools/electron-prototype/experiments/svga-web run desktop:smoke");
  assert.match(rootPackage.scripts["desktop:p2:normal-proof"], /desktop:p2:normal-proof/);
  assert.equal(rootPackage.scripts["desktop:short-term:acceptance-matrix"], "npm --prefix tools/electron-prototype/experiments/svga-web run desktop:short-term:acceptance-matrix");
  assert.equal(rootPackage.scripts["desktop:short-term:design-system-check"], "npm --prefix tools/electron-prototype/experiments/svga-web run desktop:short-term:design-system-check");
  assert.equal(rootPackage.scripts["desktop:p2:reviewer-b"], "npm --prefix tools/electron-prototype/experiments/svga-web run desktop:p2:reviewer-b");
  assert.equal(rootPackage.scripts["desktop:p2:upload-package"], "npm --prefix tools/electron-prototype/experiments/svga-web run desktop:p2:upload-package");
  assert.equal(rootPackage.scripts["desktop:p3:upload-package"], "npm --prefix tools/electron-prototype/experiments/svga-web run desktop:p3:upload-package");
  assert.equal(rootPackage.scripts["desktop:p4:upload-package"], "npm --prefix tools/electron-prototype/experiments/svga-web run desktop:p4:upload-package");
  assert.equal(rootPackage.scripts.test, "npm run test:all");
  assert.equal(rootPackage.scripts["local:preview"], "node tools/launch-local-preview.mjs");
  assert.match(experimentPackage.scripts["desktop:dev"], /electron \.$/);
  assert.match(experimentPackage.scripts["desktop:smoke"], /--smoke --product-smoke/);
  assert.match(experimentPackage.scripts["desktop:p2:normal-proof"], /run-canonical-normal-proof\.mjs/);
  assert.match(experimentPackage.scripts["desktop:short-term:acceptance-matrix"], /build-short-term-acceptance-matrix\.mjs/);
  assert.match(experimentPackage.scripts["desktop:short-term:design-system-check"], /check-short-term-design-system\.mjs/);
  assert.match(experimentPackage.scripts["desktop:p2:reviewer-b"], /build-p2-reviewer-b-categories\.mjs/);
  assert.match(experimentPackage.scripts["desktop:p2:upload-package"], /build-p2-upload-package\.mjs/);
  assert.match(experimentPackage.scripts["desktop:p3:upload-package"], /build-p3-upload-package\.mjs/);
  assert.match(experimentPackage.scripts["desktop:p4:upload-package"], /build-p4-upload-package\.mjs/);
  assert.doesNotMatch(experimentPackage.scripts["desktop:p2:normal-proof"], /--p2-normal-proof/);
  assert.notEqual(rootPackage.scripts["desktop:dev"], legacyPackage.scripts["spike:electron:smoke"]);
  assert.doesNotMatch(rootPackage.scripts["desktop:dev"], /tools\/electron-prototype run/);
});

test("short-term acceptance matrix stays current-head bound and does not hide known gaps", async () => {
  const source = await readFile(path.join(experimentRoot, "scripts/build-short-term-acceptance-matrix.mjs"), "utf8");
  assert.match(source, /proofId: "short-term-acceptance-matrix"/);
  assert.match(source, /releaseCandidateReady/);
  assert.match(source, /stale/);
  assert.match(source, /headCommit/);
  assert.match(source, /current HEAD/);
  assert.match(source, /short-term-open-flow-proof\.json/);
  assert.match(source, /short-term-load-failure-proof\.json/);
  assert.match(source, /short-term-playback-failed\.png/);
  assert.match(source, /short-term-spec-comparison-proof\.json/);
  assert.match(source, /short-term-replaceable-classification-proof\.json/);
  assert.match(source, /id: "S13"/);
  assert.match(source, /productCompleteClaimed === true/);
  assert.match(source, /designer_named_imagekey_text_anchor/);
  assert.match(source, /official_svga_dynamic_text_imagekey/);
  assert.match(source, /runtimeOverlayVisibleAfterApply === true/);
  assert.match(source, /resetClearedOverlay === true/);
  assert.match(source, /short-term-runtime-text-applied\.png/);
  assert.match(source, /Need both drag\/drop proof and macOS menu\/host-dialog normal proof/);
  assert.match(source, /playback-failure-specific abnormal-state proof/);
  assert.match(source, /playbackFailureInjected/);
  assert.match(source, /playbackFailureRecovered/);
  assert.match(source, /imageKey and matteKey reference closure/);
  assert.match(source, /imageKeyReferenceClosurePassed/);
  assert.match(source, /matteKeyReferenceClosurePassed/);
  assert.match(source, /danglingReferenceCount === 0/);
});

test("P2 parity report generator is deterministic and not unconditional pass", async () => {
  const source = await readFile(path.join(experimentRoot, "scripts/build-p2-parity-report.mjs"), "utf8");
  assert.match(source, /function check\(/);
  assert.match(source, /function category\(/);
  assert.match(source, /unresolvedDifferences/);
  assert.match(source, /missingArtifacts/);
  assert.match(source, /desktop_brand_mark/);
  assert.match(source, /player_column_primary/);
  assert.match(source, /structured_groups_exist/);
  assert.match(source, /calibration_collapsed/);
  assert.match(source, /shared_token_file_exists/);
  assert.match(source, /matched-web-desktop-loaded-comparison\.png/);
  assert.match(source, /normalRuntimeEvidence/);
  assert.match(source, /fixtureParity/);
  assert.match(source, /comparison-manifest\.json/);
  assert.match(source, /canonical-fixture\.json/);
  assert.match(source, /invalid-fixture\.json/);
  assert.match(source, /desktop-state-render-proof\.json/);
  assert.match(source, /stateProof/);
  assert.match(source, /empty_rendered_overlay_visible/);
  assert.match(source, /loading_rendered_text/);
  assert.match(source, /invalid_stale_metadata_cleared/);
  assert.match(source, /comparison_blank_space_bounded/);
  assert.match(source, /web_valid_phase_playback_confirmed/);
  assert.match(source, /web_invalid_phase_isolated/);
  assert.match(source, /requiredCategoryStatus/);
  assert.doesNotMatch(source, /productIdentity:\s*\{\s*status:\s*"pass"/);
  assert.doesNotMatch(source, /unresolvedDifferences:\s*\[\]/);
});

test("desktop state render proof aggregates every recorded failed state", async () => {
  const source = await readFile(path.join(experimentRoot, "main.cjs"), "utf8");
  assert.match(source, /proof\.failedStateIds = Object\.entries\(proof\.states \?\? \{\}\)/);
  assert.match(source, /value\?\.passed === false/);
  assert.match(source, /proof\.passed = proof\.requiredStateIds\.every/);
  assert.match(source, /&& proof\.failedStateIds\.length === 0/);
});

test("desktop smoke captures local compare states as required proof", async () => {
  const main = await readFile(path.join(experimentRoot, "main.cjs"), "utf8");
  const productApp = await readFile(path.join(repoRoot, "tools/shared/product-frontend/product-app.mjs"), "utf8");
  assert.match(main, /"local-compare-loaded"/);
  assert.match(main, /"responsive-local-compare-at-900-x-720"/);
  assert.match(main, /"responsive-local-compare-at-minimum-size"/);
  assert.match(productApp, /captureArtifact\("desktop-local-compare-loaded"\)/);
  assert.match(productApp, /captureArtifact\("desktop-responsive-local-compare-at-900-x-720"\)/);
  assert.match(productApp, /captureArtifact\("desktop-responsive-local-compare-at-minimum-size"\)/);
});

test("desktop svga-web compatibility exposes awaitable frame stepping", async () => {
  const desktopEntry = await readFile(path.join(experimentRoot, "web/desktop-product-entry.mjs"), "utf8");
  assert.match(desktopEntry, /stepToFrame\(frame, playAfter = false\) \{/);
  assert.match(desktopEntry, /return this\.ready\.then\(\(\) => \{/);
  assert.match(desktopEntry, /drawFrame\(this\.player, this\.videoItem, frame\)/);
});

test("P2 web reference capture isolates valid and invalid SVGA phases", async () => {
  const source = await readFile(path.join(experimentRoot, "scripts/web-reference-capture.cjs"), "utf8");
  assert.match(source, /setPhase\("valid-load"\)/);
  assert.match(source, /setPhase\("valid-inspection"\)/);
  assert.match(source, /setPhase\("invalid-load"\)/);
  assert.match(source, /validPhaseErrors/);
  assert.match(source, /invalidPhaseErrors/);
  assert.match(source, /validPhase:\s*\{/);
  assert.match(source, /invalidPhase:\s*\{/);
  assert.match(source, /playbackConfirmed = normalizedProof\.loaded === true/);
  assert.doesNotMatch(source, /consoleMessages\.filter/);
});

test("P2 canonical fixture helper freezes one approved fixture for all proof paths", async () => {
  const helper = await readFile(path.join(experimentRoot, "scripts/p2-fixture.mjs"), "utf8");
  const webCapture = await readFile(path.join(experimentRoot, "scripts/capture-p2-web-reference.mjs"), "utf8");
  const main = await readFile(path.join(experimentRoot, "main.cjs"), "utf8");
  assert.match(helper, /canonical-fixture\.json/);
  assert.match(helper, /canonicalFixtureFileName = "canonical-fixture\.svga"/);
  assert.match(helper, /invalid-fixture\.json/);
  assert.match(helper, /invalidFixtureFileName = "invalid-fixture\.svga"/);
  assert.match(helper, /expectedInvalid: true/);
  assert.match(helper, /fixtureFields\(fixture\)/);
  assert.match(helper, /approvedSyntheticOrRepositoryFixture: true/);
  assert.match(helper, /readCanonicalFixture/);
  assert.match(webCapture, /ensureCanonicalFixture/);
  assert.match(webCapture, /readCanonicalFixture/);
  assert.match(webCapture, /mergeFixtureMetadata\("web-reference-runtime-proof\.json"\)/);
  assert.match(main, /canonicalFixtureMetadata/);
  assert.match(main, /fixtureSha256/);
});

test("P2 Reviewer B product categories are generated from required parity categories", async () => {
  const source = await readFile(path.join(experimentRoot, "scripts/build-p2-reviewer-b-categories.mjs"), "utf8");
  assert.match(source, /reviewer-b-product-categories\.json/);
  assert.match(source, /Independent Reviewer B input is required/);
  assert.match(source, /readReviewerInput/);
  assert.match(source, /validateReviewerInput/);
  assert.match(source, /schemaVersion !== 2/);
  assert.match(source, /productIdentity/);
  assert.match(source, /fixtureParity/);
  assert.match(source, /playerWorkspace/);
  assert.match(source, /emptyState/);
  assert.match(source, /loadingState/);
  assert.match(source, /invalidState/);
  assert.match(source, /webDesktopParity/);
  assert.match(source, /normalRuntimeEvidence/);
  assert.doesNotMatch(source, /verdict: blocking\.length === 0 \? "PASS" : "BLOCKING"/);
});

test("P2 upload package contract includes review packet, screenshots, and reports", async () => {
  const source = await readFile(path.join(experimentRoot, "scripts/build-p2-upload-package.mjs"), "utf8");
  assert.match(source, /REVIEW_PACKET\.md/);
  assert.match(source, /FINAL_RESPONSE\.txt/);
  assert.match(source, /MANIFEST\.json/);
  assert.match(source, /screenshots/);
  assert.match(source, /reports/);
  assert.match(source, /canonical-fixture\.json/);
  assert.match(source, /comparison-manifest\.json/);
  assert.match(source, /desktop-state-render-proof\.json/);
  assert.match(source, /invalid-fixture\.json/);
  assert.match(source, /bundle-privacy-audit\.json/);
  assert.match(source, /sanitizeReviewText/);
  assert.match(source, /buildPrivacyAudit/);
  assert.match(source, /UPLOAD_TO_REVIEW_ASSISTANT:P2-\$\{headShort\}-upload\.zip/);
  assert.match(source, /reviewer-b-product-categories\.json/);
  assert.equal(source.includes("P2-${headShort}-upload.zip"), true);
  assert.equal(source.includes("review/P2-latest"), true);
});

test("P3 upload package contract includes sealed review evidence and redacted bundle manifest", async () => {
  const source = await readFile(path.join(experimentRoot, "scripts/build-p3-upload-package.mjs"), "utf8");
  assert.match(source, /REVIEW_PACKET\.md/);
  assert.match(source, /FINAL_RESPONSE\.txt/);
  assert.match(source, /MANIFEST\.json/);
  assert.match(source, /changes\.patch/);
  assert.match(source, /validation\.json/);
  assert.match(source, /budget-check\.json/);
  assert.match(source, /reviewer-a\.json/);
  assert.match(source, /reviewer-b\.json/);
  assert.match(source, /post-seal-verification\.json/);
  assert.match(source, /thumbnail-evidence\.json/);
  assert.match(source, /edited-output\.svga/);
  assert.match(source, /application\/x-svga/);
  assert.equal(source.includes('".patch"'), true);
  assert.match(source, /includedInBundle: true/);
  assert.match(source, /copySealedEvidence/);
  assert.match(source, /product-bundle-validation\.json/);
  assert.match(source, /reviewer-b-product-categories\.json/);
  assert.match(source, /sealed-packet-manifest\.json/);
  assert.match(source, /UPLOAD_INDEX\.json/);
  assert.match(source, /stable-p3-visible-upload-index/);
  assert.match(source, /await rm\(visibleRoot, \{ recursive: true, force: true \}\)/);
  assert.match(source, /replacementSelectedStateConfirmed/);
  assert.match(source, /POSIX_HOME_PATH/);
  assert.match(source, /MACOS_USERS_PATH/);
  assert.match(source, /valueHash/);
  assert.match(source, /PRIVATE_SENTINELS/);
  assert.match(source, /UPLOAD_TO_REVIEW_ASSISTANT:P3-\$\{headShort\}-upload\.zip/);
  assert.equal(source.includes("P3-${headShort}-upload.zip"), true);
  assert.equal(source.includes("review/P3-latest"), true);
  assert.equal(source.includes("sanitizeTextFiles"), false);
  assert.equal(source.includes("sanitizeReviewText"), false);
  assert.equal(source.includes('path.join(packetRoot, "FINAL_RESPONSE.txt")'), false);
  const macPrivatePath = ["", "Users", "private-user", "example"].join("/");
  const posixPrivatePath = ["", "home", "private-user", "example"].join("/");
  const windowsPrivatePath = ["C:", "Users", "private-user", "example"].join("\\");
  assert.equal(source.includes(macPrivatePath), false);
  assert.equal(source.includes(posixPrivatePath), false);
  assert.equal(source.includes(windowsPrivatePath), false);
});

async function createOptimizerFixture() {
  const root = await protobuf.load(path.join(repoRoot, "proto/svga.proto"));
  const MovieEntity = root.lookupType("com.opensource.svga.MovieEntity");
  const sharedImage = Buffer.from([0x89, 0x50, 0x4e, 0x47, 1, 2, 3]);
  const payload = {
    version: "2.0",
    params: { viewBoxWidth: 64, viewBoxHeight: 64, fps: 24, frames: 4 },
    images: {
      img_base: sharedImage,
      img_copy: sharedImage,
      img_unused: Buffer.from([0x89, 0x50, 0x4e, 0x47, 9])
    },
    sprites: [
      { imageKey: "img_base", frames: createOptimizerFrames() },
      { imageKey: "img_copy", frames: createOptimizerFrames() }
    ],
    audios: []
  };
  const verificationError = MovieEntity.verify(payload);
  assert.equal(verificationError, null);
  return deflateSync(MovieEntity.encode(MovieEntity.create(payload)).finish());
}

async function createReplaceableWideSvgaFixture() {
  const root = await protobuf.load(path.join(repoRoot, "proto/svga.proto"));
  const MovieEntity = root.lookupType("com.opensource.svga.MovieEntity");
  const sourceImage = await createTestPng([255, 0, 0, 255]);
  const payload = {
    version: "2.0",
    params: { viewBoxWidth: 800, viewBoxHeight: 320, fps: 24, frames: 48 },
    images: {
      profile_frame: sourceImage,
      internal_unused_designer_badge: sourceImage
    },
    sprites: [{ imageKey: "profile_frame", frames: createOptimizerFrames() }],
    audios: []
  };
  const verificationError = MovieEntity.verify(payload);
  assert.equal(verificationError, null);
  return deflateSync(MovieEntity.encode(MovieEntity.create(payload)).finish());
}

function lottieFixtureJson(imagePath) {
  return JSON.stringify({
    v: "5.13.0",
    w: 120,
    h: 80,
    fr: 30,
    ip: 0,
    op: 30,
    layers: [{ ind: 1, ty: 2, refId: "image_0" }],
    assets: [{ id: "image_0", u: "", p: imagePath, w: 1, h: 1 }]
  });
}

async function replaceFileWithSameBytesAndNewInode(filePath, bytes) {
  const before = await stat(filePath);
  const replacementPath = `${filePath}.same-byte-replacement`;
  await writeFile(replacementPath, bytes);
  await rename(replacementPath, filePath);
  const after = await stat(filePath);
  assert.notEqual(`${after.dev}:${after.ino}`, `${before.dev}:${before.ino}`);
}

async function replaceParentWithSameBytesAndNewIdentity(directoryPath, fileName, bytes) {
  const before = await stat(directoryPath);
  const swappedPath = `${directoryPath}.swapped`;
  await rename(directoryPath, swappedPath);
  try {
    await mkdir(directoryPath, { recursive: true });
    await writeFile(path.join(directoryPath, fileName), bytes);
    const after = await stat(directoryPath);
    assert.notEqual(`${after.dev}:${after.ino}`, `${before.dev}:${before.ino}`);
  } finally {
    await rm(swappedPath, { recursive: true, force: true });
  }
}

async function createTestPng(rgba) {
  const pngWriter = await import(pathToFileURL(path.join(repoRoot, "dist/utils/png-writer.js")).href);
  const image = pngWriter.createTransparentImage(2, 2);
  for (let y = 0; y < 2; y += 1) {
    for (let x = 0; x < 2; x += 1) pngWriter.setPixel(image, x, y, rgba);
  }
  return Buffer.from(pngWriter.encodeRgbaPng(image));
}

function createOptimizerFrames() {
  return Array.from({ length: 4 }, (_unused, index) => ({
    alpha: 1,
    layout: { x: 0, y: 0, width: 10, height: 10 },
    transform: { a: 1, b: 0, c: 0, d: 1, tx: index, ty: 0 },
    clipPath: "",
    shapes: []
  }));
}

function createSyntheticVapMp4Bytes(vapcOverrides = {}) {
  return concatFixtureBytes(
    fixtureFtypBox(),
    fixtureMoovBox(),
    fixtureMp4Box("vapc", fixtureTextEncoder.encode(JSON.stringify(createSyntheticVapcDocument(vapcOverrides))))
  );
}

function createSyntheticVapMp4WithoutEmbeddedVapcBytes() {
  return concatFixtureBytes(
    fixtureFtypBox(),
    fixtureMoovBox(),
    fixtureMp4Box("free", new Uint8Array([1, 2, 3]))
  );
}

function createSyntheticVapcDocument(vapcOverrides = {}) {
  return {
    info: {
      v: 2,
      f: 60,
      w: 720,
      h: 405,
      videoW: 720,
      videoH: 810,
      fps: 30,
      isVapx: false,
      aFrame: { x: 0, y: 405, w: 720, h: 405 },
      rgbFrame: { x: 0, y: 0, w: 720, h: 405 }
    },
    ...vapcOverrides
  };
}

function createMultiFormatRuntimeMountTestBridge() {
  const bridgeState = {
    format: "lottie",
    active: []
  };
  return {
    prepareInputs: [],
    menuStates: [],
    productMilestoneId: "0.2-multiformat-preview",
    updateShortTermMenuState(snapshot) {
      this.menuStates.push(snapshot);
      return Promise.resolve();
    },
    setShortTermWindowMode() {
      return Promise.resolve();
    },
    prepareMultiFormatRuntimePreview(input) {
      this.prepareInputs.push(input);
      if (input?.format === "lottie") {
        const textValue = input?.replacements?.active?.find((record) => record.targetId === "text:1")?.valuePreview
          ?? "Original greeting";
        const imageValue = input?.replacements?.active?.find((record) => record.targetId === "avatar")?.valuePreview
          ?? "data:image/png;base64,AQID";
        return Promise.resolve({
          status: "prepared",
          format: "lottie",
          pathRedacted: true,
          rendererHasFullPath: false,
          runtimeScripts: ["/runtime-node-modules/lottie-web/build/player/lottie_svg.js"],
          animationData: {
            v: "5.7.4",
            w: 120,
            h: 80,
            fr: 30,
            ip: 0,
            op: 30,
            layers: [
              {
                ind: 1,
                ty: 5,
                nm: "Greeting",
                t: {
                  d: {
                    k: [
                      { s: { t: textValue } }
                    ]
                  }
                }
              },
              {
                ind: 2,
                ty: 2,
                refId: "avatar"
              }
            ],
            assets: [{ id: "avatar", p: imageValue, u: "" }]
          },
          playback: {
            fps: 30,
            durationMs: 1000
          }
        });
      }
      const fusionParams = Object.fromEntries(
        (input?.replacements?.active ?? []).map((record) => [record.targetId, record.valuePreview])
      );
      const mergedFusionParams = {
        avatar: `data:image/png;base64,${Buffer.from([0x89, 0x50, 0x4e, 0x47, 1, 2, 3]).toString("base64")}`,
        title: "Original VAP title",
        ...fusionParams
      };
      return Promise.resolve({
        status: "prepared",
        format: "vap",
        pathRedacted: true,
        rendererHasFullPath: false,
        runtimeScripts: ["/runtime-node-modules/video-animation-player/dist/vap.js"],
        mp4Base64: Buffer.from([0, 0, 0, 8, 102, 116, 121, 112]).toString("base64"),
        mediaType: "video/mp4",
        vapConfig: createRuntimeCompatibleVapConfig(),
        fusionParams: mergedFusionParams,
        dimensions: {
          width: 120,
          height: 80
        },
        playback: {
          fps: 30,
          durationMs: 1000
        }
      });
    },
    applyMultiFormatReplacement(input) {
      bridgeState.active = [
        ...bridgeState.active.filter((record) => !(
          record.targetId === String(input?.targetId ?? "")
          && record.kind === (input?.kind === "text" ? "text" : "image")
        )),
        {
          format: bridgeState.format,
          targetId: String(input?.targetId ?? ""),
          kind: input?.kind === "text" ? "text" : "image",
          valuePreview: String(input?.value ?? "")
        }
      ];
      const result = createRuntimeMountOpenResult(bridgeState.format, { active: bridgeState.active });
      result.model.replacement.lastAction = {
        type: "applyReplacement",
        status: "accepted",
        publicTargetId: String(input?.targetId ?? ""),
        runtimeTargetId: String(input?.targetId ?? "")
      };
      result.replacementRuntimeValue = {
        kind: input?.kind === "text" ? "text" : "image",
        targetId: String(input?.targetId ?? ""),
        value: String(input?.value ?? "")
      };
      return Promise.resolve(result);
    },
    resetMultiFormatReplacement(input) {
      const targetId = String(input?.targetId ?? "");
      const kind = input?.kind === "text" ? "text" : "image";
      const active = bridgeState.active.some((record) => record.targetId === targetId && record.kind === kind);
      const result = createRuntimeMountOpenResult(bridgeState.format, {
        active: active
          ? bridgeState.active.filter((record) => !(record.targetId === targetId && record.kind === kind))
          : bridgeState.active
      });
      result.model.replacement.lastAction = active
        ? { type: "resetReplacement", status: "accepted", publicTargetId: targetId, runtimeTargetId: targetId }
        : { type: "resetReplacement", status: "blocked", diagnostic: { code: "replacement_reset_not_needed" } };
      if (active) bridgeState.active = result.model.replacement.active;
      return Promise.resolve(result);
    },
    markOpened(format) {
      bridgeState.format = format;
      bridgeState.active = [];
    }
  };
}

function createSessionBackedMultiFormatRuntimeMountTestBridge(session) {
  return {
    productMilestoneId: "0.2-multiformat-preview",
    updateShortTermMenuState() {
      return Promise.resolve();
    },
    setShortTermWindowMode() {
      return Promise.resolve();
    },
    prepareMultiFormatRuntimePreview(input) {
      return session.prepareRuntimePreview(input);
    },
    controlMultiFormatPreview(input) {
      return session.control(input);
    },
    async applyMultiFormatReplacement(input) {
      if (!input?.sourceId || input.sourceId !== session.activeSourceId) {
        return { status: "failed", code: "parse_precondition", pathRedacted: true };
      }
      const selection = await session.resolveReplacementSelection(input);
      if (selection.status !== "accepted") {
        return {
          status: "failed",
          code: selection.diagnostic.code,
          message: selection.diagnostic.message,
          pathRedacted: true
        };
      }
      const result = await session.applyReplacement({
        targetId: selection.publicTargetId,
        kind: input.kind,
        value: input.value
      });
      if (result.model?.replacement?.lastAction?.status !== "accepted") return result;
      return {
        ...result,
        replacementRuntimeValue: {
          kind: input.kind,
          targetId: selection.runtimeTargetId,
          value: input.value
        }
      };
    },
    async resetMultiFormatReplacement(input) {
      if (!input?.sourceId || input.sourceId !== session.activeSourceId) {
        return { status: "failed", code: "parse_precondition", pathRedacted: true };
      }
      const selection = await session.resolveReplacementSelection(input);
      if (selection.status !== "accepted") {
        return {
          status: "failed",
          code: selection.diagnostic.code,
          message: selection.diagnostic.message,
          pathRedacted: true
        };
      }
      const result = await session.resetReplacement({
        targetId: selection.publicTargetId,
        kind: input.kind
      });
      if (
        result.model?.replacement?.lastAction?.status !== "accepted"
        || result.model.replacement.lastAction.runtimeTargetId !== selection.runtimeTargetId
      ) {
        return { status: "failed", code: "replacement_binding_mismatch", pathRedacted: true };
      }
      return result;
    }
  };
}

function createRuntimeMountOpenResult(format, options = {}) {
  const activeReplacements = Array.isArray(options.active) ? options.active : [];
  const defaultImageTargets = format === "lottie"
    ? [{
        imageKey: "avatar",
        resourceId: "avatar",
        displayName: "Avatar",
        detail: "120 x 80"
      }]
    : format === "vap"
      ? [{
          imageKey: "avatar",
          resourceId: "avatar",
          displayName: "avatar",
          detail: "VAP 融合图片 · 120 x 80"
        }]
      : [];
  const defaultTextTargets = format === "lottie"
    ? [{
        textKey: "text:1",
        displayName: "Greeting",
        initialText: "Original greeting",
        placeholder: "输入文字以预览",
        resetDisabled: false
      }]
    : format === "vap"
      ? [{
          textKey: "title",
          displayName: "title",
          initialText: "VAP 融合文字",
          placeholder: "输入文字以预览",
          resetDisabled: false
        }]
      : [];
  const imageTargets = Array.isArray(options.imageTargets) ? options.imageTargets : defaultImageTargets;
  const textTargets = Array.isArray(options.textTargets) ? options.textTargets : defaultTextTargets;
  const ownerRightPanelSnapshotEnvelope = createTestOwnerRightPanelSnapshotEnvelope({
    facts: [{ id: "format", label: "格式", value: format.toUpperCase(), status: "pass" }],
    assetInventory: {
      schemaVersion: 1,
      pathRedacted: true,
      format,
      groups: [],
      summary: {
        totalItems: 0,
        replaceableItems: imageTargets.length + textTargets.length,
        imageCount: imageTargets.length,
        textCount: textTargets.length,
        sequenceFrameCount: 0,
        audioVideoCount: 0,
        unsupportedOrMissingCount: 0
      },
      capabilityMarkers: []
    },
    imageTargets,
    textTargets
  }, options.sourceId ?? (format === "lottie" ? "aaaaaaaaaaaaaaaaaaaaaaaa" : "bbbbbbbbbbbbbbbbbbbbbbbb"));
  return {
    status: "opened",
    sourceId: options.sourceId ?? (format === "lottie" ? "aaaaaaaaaaaaaaaaaaaaaaaa" : "bbbbbbbbbbbbbbbbbbbbbbbb"),
    ownerRightPanelSnapshotEnvelope,
    pathRedacted: true,
    model: {
      schemaVersion: 1,
      source: "owner-visible-0.2-multiformat-preview-candidate",
      productMode: "0.2-multiformat-preview-candidate",
      productVersion: "0.2.0-alpha.2",
      status: "previewReady",
      requestId: `${format}:request`,
      displayName: `${format}.fixture`,
      detectedFormat: format,
      pathRedacted: true,
      rendererHasFullPath: false,
      visibleIn01: false,
      supportClaim: false,
      saveExportSupported: false,
      commands: {
        openFile: true,
        dragDrop: true,
        play: true,
        pause: true,
        seek: true,
        loop: true,
        recover: true,
        replace: true,
        resetReplacement: activeReplacements.length > 0,
        save: false,
        export: false
      },
      canvas: {
        status: "previewReady",
        format,
        dimensions: "120 x 80",
        playback: {
          status: "ready",
          currentTimeMs: 250,
          durationMs: 1000,
          loop: true
        },
        emptyCopy: ""
      },
      rightPanel: {
        facts: [],
        assetInventory: {
          groups: [],
          summary: {
            totalItems: 0,
            imageCount: 0,
            textCount: 0,
            sequenceFrameCount: 0,
            audioVideoCount: 0,
            unsupportedOrMissingCount: 0
          }
        },
        layers: [],
        assets: format === "lottie"
          ? [{ id: "avatar", name: "Avatar", kind: "image", replaceable: true }]
          : [],
        lottieTexts: format === "lottie"
          ? [
              {
                id: "text:1",
                layerId: "1",
                name: "Greeting",
                initialText: "Original greeting",
                replaceable: true
              }
            ]
          : [],
        vapFusionImages: [],
        vapFusionTexts: format === "vap"
          ? [
              {
                id: "title",
                srcTag: "title",
                runtimeBindingKey: "title",
                replaceable: true
              }
            ]
          : [],
        unsupportedFeatures: [],
        issues: []
      },
      ownerRightPanelSnapshotEnvelope,
      replacement: {
        status: activeReplacements.length ? "applied" : "idle",
        revision: activeReplacements.length ? 1 : 0,
        dirty: activeReplacements.length > 0,
        resetEnabled: activeReplacements.length > 0,
        playerAction: activeReplacements.length ? "remountSource" : "none",
        active: activeReplacements
      }
    },
    visualEvidence: {
      lottieDomPlaybackVerified: false,
      vapVisualPlaybackVerified: false
    }
  };
}

function createTestOwnerRightPanelSnapshotEnvelope(snapshot, sourceId = "test-source") {
  const normalized = {
    schemaVersion: 1,
    pathRedacted: true,
    facts: [],
    assets: [],
    assetInventory: {
      schemaVersion: 1,
      pathRedacted: true,
      groups: [],
      summary: {
        totalItems: 0,
        replaceableItems: 0,
        imageCount: 0,
        textCount: 0,
        sequenceFrameCount: 0,
        audioVideoCount: 0,
        unsupportedOrMissingCount: 0
      },
      capabilityMarkers: []
    },
    unsupportedFeatures: [],
    issues: [],
    imageTargets: [],
    textTargets: [],
    ...snapshot
  };
  const snapshotJson = stableTestJson(normalized);
  return {
    schemaVersion: 1,
    sourceId,
    snapshotJson,
    snapshotByteLength: Buffer.byteLength(snapshotJson, "utf8"),
    snapshotSha256: createHash("sha256").update(snapshotJson).digest("hex"),
    pathRedacted: true
  };
}

function stableTestJson(value) {
  if (value === null) return "null";
  if (Array.isArray(value)) return `[${value.map(stableTestJson).join(",")}]`;
  if (typeof value === "object") {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableTestJson(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function fakeDeferredSvgaPlayback(label) {
  return {
    label,
    player: {
      currentFrame: label === "new" ? 12 : 6,
      start() {},
      pause() {}
    },
    playing: false,
    progress: label === "new" ? 20 : 10
  };
}

function createRuntimeCompatibleVapConfig() {
  return {
    info: {
      w: 120,
      h: 80,
      videoW: 120,
      videoH: 160,
      fps: 30,
      aFrame: [0, 80, 120, 80],
      rgbFrame: [0, 0, 120, 80]
    },
    src: [
      {
        srcId: "avatar",
        srcTag: "avatar",
        srcType: "img",
        w: 24,
        h: 24,
        fitType: "cover"
      },
      {
        srcId: "title",
        srcTag: "title",
        srcType: "txt",
        w: 80,
        h: 24,
        color: "#ffffff"
      }
    ],
    frame: [
      {
        i: 0,
        obj: [
          {
            srcId: "avatar",
            frame: [8, 8, 24, 24],
            mFrame: [0, 0, 24, 24]
          },
          {
            srcId: "title",
            frame: [36, 16, 80, 24],
            mFrame: [0, 0, 80, 24]
          }
        ]
      }
    ]
  };
}

function createMultiFormatControllerTestNodes() {
  const canvasWrap = new FakeDomElement("div");
  const primaryCanvas = new FakeDomElement("canvas");
  primaryCanvas.parentElement = canvasWrap;
  primaryCanvas.getContext = () => ({
    clearRect() {},
    fillRect() {},
    strokeRect() {},
    fillText() {},
    set fillStyle(_value) {},
    set strokeStyle(_value) {},
    set font(_value) {},
    set textAlign(_value) {}
  });
  primaryCanvas.getBoundingClientRect = () => ({ width: 640, height: 420 });
  canvasWrap.children.push(primaryCanvas);
  const playbackProgress = new FakeDomElement("div");
  const playbackProgressBar = new FakeDomElement("span");
  playbackProgress.replaceChildren(playbackProgressBar);
  const replaceableSection = new FakeDomElement("section");
  replaceableSection.className = "replaceableSection";
  const replaceableList = new FakeDomElement("div");
  const textElementList = new FakeDomElement("div");
  replaceableSection.replaceChildren(textElementList, replaceableList);
  return {
    app: new FakeDomElement("main"),
    loadingMessage: new FakeDomElement("p"),
    errorMessage: new FakeDomElement("p"),
    fileIdentity: new FakeDomElement("div"),
    playbackMeta: new FakeDomElement("span"),
    factGrid: new FakeDomElement("div"),
    assetListHeading: new FakeDomElement("h2"),
    assetFilterTabs: new FakeDomElement("div"),
    assetList: new FakeDomElement("div"),
    findingList: new FakeDomElement("div"),
    replaceableList,
    textElementList,
    replaceableSummary: new FakeDomElement("p"),
    playbackProgress,
    playbackTime: new FakeDomElement("span"),
    primaryCanvas,
    replacementFileInput: new FakeDomElement("input"),
    appearanceChoices: [],
    settingsDialog: new FakeDomElement("dialog"),
    runtimeMount: undefined
  };
}

function createMultiFormatControllerTestDocument(nodes) {
  const head = new FakeDomElement("head");
  const body = new FakeDomElement("body");
  const documentElement = new FakeDomElement("html");
  head.append = (node) => {
    head.appendChild(node);
    node.dispatchEvent("load");
  };
  return {
    head,
    body,
    documentElement,
    activeElement: body,
    createElement(tagName) {
      const node = new FakeDomElement(tagName);
      node.ownerDocument = this;
      if (tagName === "div") {
        Object.defineProperty(node, "id", {
          get() {
            return this.attributes.id || "";
          },
          set(value) {
            this.attributes.id = String(value);
            if (value === "multiFormatRuntimeMount") nodes.runtimeMount = this;
          }
        });
      }
      return node;
    },
    querySelector(selector) {
      if (selector === ".rightPanel") return new FakeDomElement("aside");
      if (selector === "#multiFormatRuntimeMount") return nodes.runtimeMount;
      return null;
    },
    querySelectorAll() {
      return [];
    }
  };
}

class FakeDomElement {
  constructor(tagName = "div") {
    this.tagName = tagName.toUpperCase();
    this.nodeName = this.tagName;
    this.nodeType = 1;
    this.dataset = {};
    this.style = {};
    this.attributes = {};
    this.children = [];
    this.childNodes = this.children;
    this.hidden = false;
    this.textContent = "";
    this.innerHTML = "";
    this.parentElement = undefined;
    this.eventListeners = new Map();
    this.classList = {
      toggle() {}
    };
  }

  set id(value) {
    this.attributes.id = String(value);
  }

  get id() {
    return this.attributes.id || "";
  }

  get parentNode() {
    return this.parentElement;
  }

  set parentNode(value) {
    this.parentElement = value;
  }

  get firstChild() {
    return this.children[0] ?? null;
  }

  get innerHTML() {
    return this._innerHTML;
  }

  set innerHTML(value) {
    this._innerHTML = String(value);
    if (!this._innerHTML.includes("data-text-input")) return;
    const textKey = fakeAttributeValue(this._innerHTML, "data-text-key") || "";
    const inputValue = fakeAttributeValue(this._innerHTML, "value") || "";
    const initialValue = fakeAttributeValue(this._innerHTML, "data-initial-value") || "";
    const input = new FakeDomElement("input");
    input.className = "runtimeTextInput";
    input.dataset.component = "InlineTextReplacementInput";
    input.dataset.textInput = "";
    input.dataset.textKey = textKey;
    input.dataset.initialValue = initialValue;
    input.value = inputValue;
    input.selectionStart = input.value.length;
    input.selectionEnd = input.value.length;
    input.selectionDirection = "none";
    input.ownerDocument = this.ownerDocument;
    input.setSelectionRange = (start, end, direction = "none") => {
      input.selectionStart = start;
      input.selectionEnd = end;
      input.selectionDirection = direction;
    };
    input.select = () => {
      input.selectionStart = 0;
      input.selectionEnd = input.value.length;
      input.selectionDirection = "none";
    };
    const resetButton = new FakeDomElement("button");
    resetButton.className = "runtimeTextResetButton";
    resetButton.dataset.action = "runtime-text-reset";
    resetButton.dataset.textKey = textKey;
    resetButton.disabled = /data-action="runtime-text-reset"[^>]*disabled/u.test(this._innerHTML);
    resetButton.ownerDocument = this.ownerDocument;
    this.replaceChildren(input, resetButton);
  }

  setAttribute(name, value) {
    this.attributes[name] = String(value);
    if (name.startsWith("data-")) {
      const datasetKey = name.slice(5).replace(/-([a-z])/gu, (_match, letter) => letter.toUpperCase());
      this.dataset[datasetKey] = String(value);
    }
  }

  setAttributeNS(_namespace, name, value) {
    this.setAttribute(name, value);
  }

  getAttribute(name) {
    return this.attributes[name] ?? null;
  }

  removeAttribute(name) {
    delete this.attributes[name];
  }

  removeAttributeNS(_namespace, name) {
    this.removeAttribute(name);
  }

  replaceChildren(...children) {
    this.children = children;
    this.childNodes = this.children;
    children.forEach((child) => {
      if (child) child.parentElement = this;
      if (child && !child.ownerDocument) child.ownerDocument = this.ownerDocument;
    });
  }

  append(child) {
    return this.appendChild(child);
  }

  appendChild(child) {
    if (child) child.parentElement = this;
    if (child && !child.ownerDocument) child.ownerDocument = this.ownerDocument;
    this.children.push(child);
    return child;
  }

  insertBefore(child, before) {
    if (!before) return this.appendChild(child);
    const index = this.children.indexOf(before);
    if (index < 0) return this.appendChild(child);
    if (child) child.parentElement = this;
    this.children.splice(index, 0, child);
    return child;
  }

  removeChild(child) {
    const index = this.children.indexOf(child);
    if (index >= 0) this.children.splice(index, 1);
    if (child) child.parentElement = undefined;
    return child;
  }

  querySelector(selector) {
    if (selector === "span") return this.children.find((child) => child.tagName === "SPAN") ?? null;
    if (selector === "#multiFormatRuntimeMount") {
      return this.children.find((child) => child.id === "multiFormatRuntimeMount") ?? null;
    }
    if (selector === "script") return this.querySelectorAll(selector)[0] ?? null;
    return this.querySelectorAll(selector)[0] ?? null;
  }

  querySelectorAll(selector = "*") {
    const matches = [];
    const normalized = selector.toUpperCase();
    const visit = (node) => {
      node.children.forEach((child) => {
        if (selector === "*" || child.tagName === normalized || fakeMatchesSelector(child, selector)) {
          matches.push(child);
        }
        visit(child);
      });
    };
    visit(this);
    return matches;
  }

  addEventListener(name, handler) {
    const handlers = this.eventListeners.get(name) ?? [];
    handlers.push(handler);
    this.eventListeners.set(name, handlers);
  }

  removeEventListener(name, handler) {
    const handlers = this.eventListeners.get(name) ?? [];
    this.eventListeners.set(name, handlers.filter((candidate) => candidate !== handler));
  }

  dispatchEvent(name) {
    const event = typeof name === "string" ? { type: name, target: this } : name;
    (this.eventListeners.get(event.type) ?? []).forEach((handler) => handler.call(this, event));
  }

  matches(selector) {
    return fakeMatchesSelector(this, selector);
  }

  contains(candidate) {
    if (candidate === this) return true;
    return this.children.some((child) => child?.contains?.(candidate));
  }

  closest(selector) {
    let node = this;
    while (node) {
      if (fakeMatchesSelector(node, selector)) return node;
      node = node.parentElement;
    }
    return null;
  }

  focus() {
    if (this.ownerDocument) this.ownerDocument.activeElement = this;
    if (globalThis.document && "activeElement" in globalThis.document) {
      globalThis.document.activeElement = this;
    }
  }
  select() {}
}

function fakeAttributeValue(markup, name) {
  const match = markup.match(new RegExp(`(?:^|\\s)${name}="([^"]*)"`, "u"));
  return match?.[1]?.replace(/&quot;/gu, "\"").replace(/&amp;/gu, "&") || "";
}

function fakeUnescapeCssIdentifier(value) {
  return String(value).replace(/\\:/gu, ":").replace(/\\"/gu, "\"").replace(/\\\\/gu, "\\");
}

function fakeSelectorDataTextKey(selector) {
  const match = selector.match(/data-text-key=["']([^"']+)["']/u);
  return match ? fakeUnescapeCssIdentifier(match[1]) : undefined;
}

function fakeMatchesSelector(node, selector) {
  if (!node || !selector) return false;
  if (selector === "[data-text-input]") return Object.hasOwn(node.dataset, "textInput");
  if (selector.startsWith("[data-text-input][data-text-key=")) {
    return Object.hasOwn(node.dataset, "textInput")
      && node.dataset.textKey === fakeSelectorDataTextKey(selector);
  }
  if (selector === "[data-action='runtime-text-reset']" || selector === "[data-action=\"runtime-text-reset\"]") {
    return node.dataset.action === "runtime-text-reset";
  }
  if (selector === ".textElementRow[data-text-key]") {
    return String(node.className || "").split(/\s+/u).includes("textElementRow")
      && typeof node.dataset.textKey === "string";
  }
  if (selector === ".replaceableSection") {
    return String(node.className || "").split(/\s+/u).includes("replaceableSection");
  }
  return false;
}

async function flushRuntimeMountPromises() {
  await Promise.resolve();
  await Promise.resolve();
  await new Promise((resolve) => setImmediate(resolve));
  await Promise.resolve();
}

async function withTerminalTestDeadline(promise, label) {
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      setTimeout(() => reject(new Error(`${label} desktop open did not reach a terminal state`)), 1500);
    })
  ]);
}

const fixtureTextEncoder = new TextEncoder();

function fixtureFtypBox() {
  return fixtureMp4Box("ftyp", concatFixtureBytes(
    fixtureTextEncoder.encode("isom"),
    fixtureU32(512),
    fixtureTextEncoder.encode("isom"),
    fixtureTextEncoder.encode("mp42")
  ));
}

function fixtureMoovBox() {
  return fixtureMp4Box("moov", concatFixtureBytes(
    fixtureMvhdBox(),
    fixtureTrackBox()
  ));
}

function fixtureTrackBox() {
  return fixtureMp4Box("trak", fixtureMp4Box("mdia", concatFixtureBytes(
    fixtureHdlrBox("vide"),
    fixtureMp4Box("minf", fixtureMp4Box("stbl", fixtureStsdBox("avc1")))
  )));
}

function fixtureMvhdBox() {
  const payload = new Uint8Array(20);
  const view = new DataView(payload.buffer);
  view.setUint32(12, 1_000);
  view.setUint32(16, 2_000);
  return fixtureMp4Box("mvhd", payload);
}

function fixtureHdlrBox(handler) {
  assert.equal(handler.length, 4);
  const payload = new Uint8Array(12);
  payload.set(fixtureTextEncoder.encode(handler), 8);
  return fixtureMp4Box("hdlr", payload);
}

function fixtureStsdBox(sampleEntry) {
  assert.equal(sampleEntry.length, 4);
  const payload = new Uint8Array(16);
  const view = new DataView(payload.buffer);
  view.setUint32(4, 1);
  view.setUint32(8, 8);
  payload.set(fixtureTextEncoder.encode(sampleEntry), 12);
  return fixtureMp4Box("stsd", payload);
}

function fixtureMp4Box(type, payload) {
  assert.equal(type.length, 4);
  const bytes = new Uint8Array(8 + payload.byteLength);
  const view = new DataView(bytes.buffer);
  view.setUint32(0, bytes.byteLength);
  bytes.set(fixtureTextEncoder.encode(type), 4);
  bytes.set(payload, 8);
  return bytes;
}

function fixtureU32(value) {
  const bytes = new Uint8Array(4);
  new DataView(bytes.buffer).setUint32(0, value);
  return bytes;
}

function concatFixtureBytes(...parts) {
  const bytes = new Uint8Array(parts.reduce((sum, part) => sum + part.byteLength, 0));
  let offset = 0;
  for (const part of parts) {
    bytes.set(part, offset);
    offset += part.byteLength;
  }
  return bytes;
}

test("real sample audit harness stores aliases and avoids absolute paths in report output", async () => {
  const auditPage = await readFile(path.join(experimentRoot, "web/audit.js"), "utf8");
  const auditScript = await readFile(path.join(experimentRoot, "scripts/run-real-sample-parity-audit.mjs"), "utf8");
  assert.match(auditPage, /playerMode/);
  assert.match(auditPage, /svgaplayerweb/);
  assert.match(auditPage, /svga-web/);
  assert.match(auditPage, /reportAuditResult/);
  assert.doesNotMatch(auditPage, /require\(|ipcRenderer|node:fs|\/Users\//);
  assert.match(auditScript, /sampleRoot: "external local sample root, not committed"/);
  assert.match(auditScript, /redactOutput/);
  assert.match(auditScript, /audit-samples/);
});

test("short-term launch window policy preserves compact bounds across runtime display work areas", () => {
  const minimumSize = { width: 640, height: 640 };
  const preservedSize = { width: 640, height: 640 };
  const standardDisplay = { x: 0, y: 71, width: 2560, height: 1344 };
  const retinaDisplay = { x: -1512, y: 458, width: 1512, height: 950 };

  const standardResult = preserveWindowSizeAcrossDisplay({
    currentBounds: { x: 920, y: 220, width: 1180, height: 760 },
    preservedSize,
    workArea: standardDisplay,
    minimumSize
  });
  assert.equal(standardResult.width, 640);
  assert.equal(standardResult.height, 640);
  assert.ok(standardResult.x >= standardDisplay.x);
  assert.ok(standardResult.y >= standardDisplay.y);
  assert.ok(standardResult.x + standardResult.width <= standardDisplay.x + standardDisplay.width);
  assert.ok(standardResult.y + standardResult.height <= standardDisplay.y + standardDisplay.height);

  const retinaResult = preserveWindowSizeAcrossDisplay({
    currentBounds: { x: -1210, y: 560, width: 1180, height: 760 },
    preservedSize,
    workArea: retinaDisplay,
    minimumSize
  });
  assert.equal(retinaResult.width, 640);
  assert.equal(retinaResult.height, 640);
  assert.ok(retinaResult.x >= retinaDisplay.x);
  assert.ok(retinaResult.y >= retinaDisplay.y);
  assert.ok(retinaResult.x + retinaResult.width <= retinaDisplay.x + retinaDisplay.width);
  assert.ok(retinaResult.y + retinaResult.height <= retinaDisplay.y + retinaDisplay.height);

  const smallDisplayResult = preserveWindowSizeAcrossDisplay({
    currentBounds: { x: 0, y: 0, width: 1180, height: 760 },
    preservedSize,
    workArea: { x: 10, y: 20, width: 650, height: 620 },
    minimumSize
  });
  assert.equal(smallDisplayResult.width, 640);
  assert.equal(smallDisplayResult.height, 620);
  assert.equal(smallDisplayResult.x, 10);
  assert.equal(smallDisplayResult.y, 20);
});
