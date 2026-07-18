import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import {
  containMotionMedia,
  multiFormatDragDecisionForEvent,
  multiFormatInventorySummaryItems,
  projectMultiFormatRightPanel
} from "../web/multiformat-product-conformance.mjs";
import { applyModeButtons } from "../web/short-term-macos-dom-state.mjs";
import { showShortTermDragDecisionOverlay } from "../web/short-term-macos-drag-decision-surface.mjs";
import {
  createMultiFormatDesktopPreviewController,
  resolveMultiFormatChooserOutcome
} from "../web/multiformat-desktop-preview-controller.mjs";

const experimentRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(import.meta.url);
const {
  chooseMultiFormatLocalFile,
  createMultiFormatOpenDialogOptions,
  validateMultiFormatPickerSelection
} = require("../multiformat-native-picker.cjs");

function source(relativePath) {
  return readFileSync(path.join(experimentRoot, relativePath), "utf8");
}

function extractFunctionSource(moduleSource, functionSignature) {
  const start = moduleSource.indexOf(functionSignature);
  assert.notEqual(start, -1, `${functionSignature} must exist`);
  const nextFunction = moduleSource.indexOf("\nfunction ", start + functionSignature.length);
  const nextAsyncFunction = moduleSource.indexOf("\nasync function ", start + functionSignature.length);
  const candidates = [nextFunction, nextAsyncFunction].filter((index) => index > start);
  const end = candidates.length ? Math.min(...candidates) : moduleSource.length;
  return moduleSource.slice(start, end);
}

function ownerEnvelope(snapshot) {
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
  const snapshotJson = stableStringify(normalized);
  return {
    schemaVersion: 1,
    sourceId: "owner-snapshot-test",
    snapshotJson,
    snapshotByteLength: Buffer.byteLength(snapshotJson, "utf8"),
    snapshotSha256: createHash("sha256").update(snapshotJson).digest("hex"),
    pathRedacted: true
  };
}

function stableStringify(value) {
  if (value === null) return "null";
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  if (typeof value === "object") {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

test("0.2 composes the established SVGA controller instead of globally disabling its workflow", () => {
  const appSource = source("web/short-term-macos-app.mjs");
  const controllerSource = source("web/multiformat-desktop-preview-controller.mjs");
  const mainSource = source("main.cjs");

  assert.match(appSource, /createShortTermAppController\(\{ bridge, nodes, state \}\)/u);
  assert.match(appSource, /svgaController/u);
  assert.doesNotMatch(controllerSource, /saveActiveOutput:\s*unsupportedAsync/u);
  assert.doesNotMatch(controllerSource, /renameSelectedImageKey:\s*unsupportedAsync/u);
  assert.doesNotMatch(controllerSource, /runOptimization:\s*unsupportedAsync/u);
  assert.match(mainSource, /async function saveShortTermSvgaOutput[\s\S]*if \(!usesShortTermPreviewShell\)/u);
  assert.doesNotMatch(mainSource, /async function saveShortTermSvgaOutput[\s\S]{0,200}if \(!isShortTermProduct\)/u);
});

test("0.2 owner copy uses Open File without candidate or proof language", () => {
  const controllerSource = source("web/multiformat-desktop-preview-controller.mjs");
  const mainSource = source("main.cjs");

  assert.doesNotMatch(controllerSource, /打开预览候选/u);
  assert.doesNotMatch(mainSource, /title:\s*"打开 0\.2 预览候选"|label:\s*"打开预览候选/u);
  assert.match(controllerSource, /打开文件/u);
});

test("multi-format owner copy hides host and runtime implementation language", () => {
  const controllerSource = source("web/multiformat-desktop-preview-controller.mjs");

  assert.doesNotMatch(controllerSource, /Replacement preview/u);
  assert.doesNotMatch(controllerSource, /0\.2 预览(?:主机|请求|运行时)/u);
  assert.match(controllerSource, /无法更新替换预览，源文件没有被修改。/u);
  assert.match(controllerSource, /文件加载超时，请重新打开文件。源文件没有被修改。/u);
  assert.match(controllerSource, /资产列表/u);
  assert.match(controllerSource, /未发现可替换元素/u);
  assert.match(controllerSource, /replaceableElementSummaryCopy\(totalCount\)/u);
  assert.match(controllerSource, /renderFailureMessage\(nodes, ownerFailureCopy\(error\)\)/u);
  assert.doesNotMatch(controllerSource, /renderFailureMessage\(nodes, error instanceof Error \? error\.message/u);
});

test("host chooser cancellation cannot enter loading or resize the Launch window", () => {
  const controllerSource = source("web/multiformat-desktop-preview-controller.mjs");
  const openStart = controllerSource.indexOf("async function openFromHostDialog()");
  const openEnd = controllerSource.indexOf("async function loadDroppedFile", openStart);
  const openBody = controllerSource.slice(openStart, openEnd);
  const invokeIndex = openBody.indexOf("bridge.openMultiFormatFile()");
  const loadingIndex = openBody.indexOf("setLoading(");

  assert.ok(invokeIndex >= 0);
  assert.ok(loadingIndex < 0 || loadingIndex > invokeIndex);
  assert.doesNotMatch(openBody, /resolveMultiFormatOpenOutcome/u);
  assert.match(openBody, /resolveMultiFormatChooserOutcome/u);
});

test("macOS multi-format picker exposes files and validates the selected extension in the host", () => {
  const mainSource = source("main.cjs");
  const pickerSource = source("multiformat-native-picker.cjs");
  const openStart = mainSource.indexOf("async function openMultiFormatFile()");
  const openEnd = mainSource.indexOf("async function openDroppedMultiFormatFile", openStart);
  const openBody = mainSource.slice(openStart, openEnd);

  assert.match(openBody, /chooseMultiFormatLocalFile/u);
  assert.match(pickerSource, /platform === "darwin"[\s\S]*extensions:\s*\["\*"\]/u);
  assert.match(pickerSource, /\.svga[\s\S]*\.json[\s\S]*\.mp4/u);

  const options = createMultiFormatOpenDialogOptions("darwin");
  assert.deepEqual(options.filters, [{ name: "SVGA / Lottie JSON / VAP MP4", extensions: ["*"] }]);
  for (const filePath of ["/private/tmp/example.svga", "/private/tmp/example.JSON", "/private/tmp/example.mp4"]) {
    assert.deepEqual(validateMultiFormatPickerSelection(filePath), { status: "selected", filePath });
  }
  assert.deepEqual(validateMultiFormatPickerSelection("/private/tmp/example.txt"), {
    status: "failed",
    code: "unsupported_file_type",
    message: "仅支持 SVGA、Lottie JSON 或 VAP MP4 文件。",
    pathRedacted: true
  });
});

test("multi-format native picker is owned by the active BrowserWindow and fails typed without an owner", async () => {
  const mainSource = source("main.cjs");
  const openStart = mainSource.indexOf("async function openMultiFormatFile()");
  const openEnd = mainSource.indexOf("async function openDroppedMultiFormatFile", openStart);
  const openBody = mainSource.slice(openStart, openEnd);
  const ownerHelper = extractFunctionSource(mainSource, "function showOpenDialogForActiveMainWindow(options)");

  assert.match(openBody, /showOpenDialogForActiveMainWindow/);
  assert.doesNotMatch(openBody, /dialog\.showOpenDialog\(options\)/);
  assert.match(ownerHelper, /activeMainWindow/);
  assert.match(ownerHelper, /activeMainWindow\.isDestroyed\(\)/);
  assert.match(ownerHelper, /dialog\.showOpenDialog\(activeMainWindow, options\)/);

  const ownerMissing = await chooseMultiFormatLocalFile({
    platform: "darwin",
    async showOpenDialog() {
      throw new Error("active picker owner unavailable at /Users/alice/Secret Project/input.svga");
    }
  });
  assert.deepEqual(ownerMissing, {
    status: "failed",
    code: "file_picker_failed",
    message: "无法打开文件选择器，源文件没有被修改。",
    pathRedacted: true
  });
  assert.doesNotMatch(JSON.stringify(ownerMissing), /Users\/alice|Secret Project/u);
});

test("host picker cancellation waits for the human decision without a renderer deadline", async () => {
  let finishPicker;
  const pendingPicker = new Promise((resolve) => {
    finishPicker = resolve;
  });
  const pendingOutcome = resolveMultiFormatChooserOutcome(pendingPicker);
  const earlyResult = await Promise.race([
    pendingOutcome.then(() => "settled"),
    new Promise((resolve) => setTimeout(() => resolve("waiting"), 20))
  ]);

  assert.equal(earlyResult, "waiting");
  finishPicker({ status: "cancelled" });
  assert.deepEqual(await pendingOutcome, { kind: "cancelled" });
});

test("host picker returns cancel, selected formats, and redacted invalid input without opening early", async () => {
  const observedOptions = [];
  for (const filePath of ["/private/tmp/example.svga", "/private/tmp/example.json", "/private/tmp/example.mp4"]) {
    const result = await chooseMultiFormatLocalFile({
      platform: "darwin",
      async showOpenDialog(options) {
        observedOptions.push(options);
        return { canceled: false, filePaths: [filePath] };
      }
    });
    assert.deepEqual(result, { status: "selected", filePath });
  }
  assert.deepEqual(await chooseMultiFormatLocalFile({
    platform: "darwin",
    async showOpenDialog() {
      return { canceled: true, filePaths: [] };
    }
  }), { status: "cancelled" });
  assert.equal(observedOptions.length, 3);
  assert.ok(observedOptions.every(({ filters }) => filters[0].extensions[0] === "*"));
});

test("unsupported picker selection stays typed and mutation-free through the renderer contract", async () => {
  const authority = { view: "launch", windowMode: "launch", sourceId: "", sessionOpenCalls: 0 };
  const hostResult = await chooseMultiFormatLocalFile({
    platform: "darwin",
    async showOpenDialog() {
      return { canceled: false, filePaths: ["/Users/alice/Secret Project/input.txt"] };
    }
  });
  if (hostResult.status === "selected") authority.sessionOpenCalls += 1;
  const rendererResult = await resolveMultiFormatChooserOutcome(hostResult);

  assert.deepEqual(rendererResult, {
    kind: "failure",
    code: "unsupported_file_type",
    message: "仅支持 SVGA、Lottie JSON 或 VAP MP4 文件。",
    pathRedacted: true
  });
  assert.deepEqual(authority, { view: "launch", windowMode: "launch", sourceId: "", sessionOpenCalls: 0 });
  assert.doesNotMatch(JSON.stringify({ hostResult, rendererResult }), /Users\/alice|Secret Project/u);

  const fixedCopyResult = await resolveMultiFormatChooserOutcome({
    status: "failed",
    code: "unsupported_file_type",
    message: "Leaked /Users/alice/Secret Project/input.txt",
    pathRedacted: true
  });
  assert.deepEqual(fixedCopyResult, rendererResult);
  assert.doesNotMatch(JSON.stringify(fixedCopyResult), /Users\/alice|Secret Project/u);

  const untrustedResult = await resolveMultiFormatChooserOutcome({
    status: "failed",
    code: "unsupported_file_type",
    message: "Leaked /Users/alice/Secret Project/input.txt",
    pathRedacted: false
  });
  assert.equal(untrustedResult.code, undefined);
  assert.equal(untrustedResult.message, "操作未能完成，源文件没有被修改。");
  assert.doesNotMatch(JSON.stringify(untrustedResult), /Users\/alice|Secret Project/u);
});

test("picker exception stays typed and mutation-free through the renderer contract", async () => {
  const authority = { view: "launch", windowMode: "launch", sourceId: "", sessionOpenCalls: 0 };
  const hostResult = await chooseMultiFormatLocalFile({
    platform: "darwin",
    async showOpenDialog() {
      throw new Error("Picker failed at /Users/alice/Secret Project/input.svga");
    }
  });
  if (hostResult.status === "selected") authority.sessionOpenCalls += 1;
  const rendererResult = await resolveMultiFormatChooserOutcome(hostResult);

  assert.deepEqual(rendererResult, {
    kind: "failure",
    code: "file_picker_failed",
    message: "无法打开文件选择器，源文件没有被修改。",
    pathRedacted: true
  });
  assert.deepEqual(authority, { view: "launch", windowMode: "launch", sourceId: "", sessionOpenCalls: 0 });
  assert.doesNotMatch(JSON.stringify({ hostResult, rendererResult }), /Users\/alice|Secret Project/u);
});

test("cancelled host chooser preserves Launch state and window geometry behaviorally", async () => {
  let openCalls = 0;
  const windowModes = [];
  const state = { view: "launch" };
  const controller = createMultiFormatDesktopPreviewController({
    bridge: {
      async openMultiFormatFile() {
        openCalls += 1;
        return { status: "cancelled" };
      },
      async setShortTermWindowMode(mode) {
        windowModes.push(mode);
      }
    },
    nodes: {},
    state
  });

  await controller.handlers.openFromHostDialog();

  assert.equal(openCalls, 1);
  assert.equal(state.view, "launch");
  assert.deepEqual(windowModes, []);
});

test("host-opened SVGA delegates established save, optimize, and rename workflows", async () => {
  const calls = [];
  const svgaController = {
    handlers: {
      async loadOpenedSource(input) {
        calls.push(["load", input]);
      },
      async refreshRecentFiles() {
        calls.push(["refresh"]);
      },
      saveActiveOutput() {
        calls.push(["save"]);
        return "saved";
      },
      runOptimization() {
        calls.push(["optimize"]);
        return "optimized";
      },
      renameSelectedImageKey() {
        calls.push(["rename"]);
        return "renamed";
      }
    }
  };
  const controller = createMultiFormatDesktopPreviewController({
    bridge: {},
    nodes: {},
    state: { view: "launch" },
    svgaController
  });

  assert.equal(controller.handlers.beginHostFileOpen({ eventId: "svga-open-1" }), true);
  assert.equal(await controller.handlers.completeHostFileOpen({
    eventId: "svga-open-1",
    result: {
      sourceId: "sha256:svga-source",
      model: {
        detectedFormat: "svga",
        displayName: "SVGA-A",
        status: "playing"
      },
      svgaSource: {
        displayName: "SVGA-A",
        bytes: Uint8Array.from([1, 2, 3])
      }
    }
  }), true);

  assert.equal(controller.handlers.saveActiveOutput(), "saved");
  assert.equal(controller.handlers.runOptimization(), "optimized");
  assert.equal(controller.handlers.renameSelectedImageKey(), "renamed");
  assert.deepEqual(calls.map(([name]) => name), ["load", "refresh", "save", "optimize", "rename"]);
  assert.equal(calls[0][1].sourceId, "sha256:svga-source");
  assert.deepEqual(Array.from(calls[0][1].bytes), [1, 2, 3]);
  assert.equal(calls[0][1].startPlayback, true);
});

test("drag intake keeps host path authority and does not serialize renderer bytes", () => {
  const preloadSource = source("preload.cjs");
  const controllerSource = source("web/multiformat-desktop-preview-controller.mjs");
  const mainSource = source("main.cjs");

  assert.match(preloadSource, /webUtils/u);
  assert.match(preloadSource, /getPathForFile/u);
  assert.doesNotMatch(controllerSource, /Array\.from\(bytes\)/u);
  assert.match(mainSource, /openMultiFormatFilePath\([^,]+,\s*"dragDrop"\)/u);
});

test("multi-format drag decisions preserve SVGA Compare opt-in without exposing unsupported compare", () => {
  const target = {
    getBoundingClientRect() {
      return { top: 20, height: 400 };
    }
  };
  const event = (name, clientY) => ({
    clientY,
    dataTransfer: { files: [{ name }] }
  });

  assert.deepEqual(
    multiFormatDragDecisionForEvent(target, event("current.svga", 40), { activeFormat: "svga" }),
    {
      file: { name: "current.svga" },
      focusZone: "compare",
      supported: true,
      compareAvailable: true
    }
  );
  assert.deepEqual(
    multiFormatDragDecisionForEvent(target, event("next.json", 40), { activeFormat: "svga" }),
    {
      file: { name: "next.json" },
      focusZone: "open",
      supported: true,
      compareAvailable: false
    }
  );
  assert.equal(
    multiFormatDragDecisionForEvent(target, event("current.svga", 220), { activeFormat: "svga" }).focusZone,
    "open"
  );
  assert.equal(
    multiFormatDragDecisionForEvent(target, event("current.svga", 40), { activeFormat: "lottie" }).compareAvailable,
    false
  );
});

test("multi-format inventory summary exposes only meaningful localized counts", () => {
  assert.deepEqual(multiFormatInventorySummaryItems({
    imageCount: 4,
    textCount: 0,
    sequenceFrameCount: 12,
    audioVideoCount: 1,
    unsupportedOrMissingCount: 0
  }), [
    { id: "images", label: "图片", count: 4 },
    { id: "sequences", label: "序列帧", count: 12 },
    { id: "media", label: "音视频", count: 1 }
  ]);
});

test("multi-format mode availability and drag overlay expose the capability state directly", () => {
  const classNames = new Set();
  const buttons = ["mode-preview", "mode-edit"].map((action) => ({
    dataset: { action },
    classList: {
      toggle(name, active) {
        if (active) classNames.add(`${action}:${name}`);
        else classNames.delete(`${action}:${name}`);
      }
    },
    setAttribute(name, value) {
      this[name] = value;
    },
    disabled: false,
    title: ""
  }));
  const originalDocument = globalThis.document;
  globalThis.document = { querySelectorAll: () => buttons };
  try {
    applyModeButtons("preview", { editEnabled: false, editReason: "当前格式仅支持预览" });
  } finally {
    globalThis.document = originalDocument;
  }
  assert.equal(buttons[0].disabled, false);
  assert.equal(buttons[0]["aria-pressed"], "true");
  assert.equal(buttons[1].disabled, true);
  assert.equal(buttons[1]["aria-disabled"], "true");
  assert.equal(buttons[1].title, "当前格式仅支持预览");

  const zones = ["compare", "open"].map((dragZone) => {
    const label = { textContent: "" };
    return {
      dataset: { dragZone },
      hidden: false,
      querySelector: () => label,
      setAttribute(name, value) {
        this[name] = value;
      },
      label
    };
  });
  const overlay = {
    hidden: true,
    dataset: {},
    querySelectorAll: () => zones
  };
  showShortTermDragDecisionOverlay(overlay, {
    focusZone: "open",
    supported: true,
    compareAvailable: false
  });
  assert.equal(overlay.dataset.compareAvailable, "false");
  assert.equal(zones[0].hidden, true);
  assert.equal(zones[0]["aria-hidden"], "true");
  assert.equal(zones[1].hidden, false);
  assert.equal(zones[1].label.textContent, "打开新文件");
});

test("formal 0.2 exposes redacted recent files and SVGA save through the established shell", () => {
  const preloadSource = source("preload.cjs");
  const multiApiStart = preloadSource.indexOf("function createMultiFormatDesktopProductPreloadApi()");
  const multiApiEnd = preloadSource.indexOf("function withShortTermProductApi", multiApiStart);
  const multiApi = preloadSource.slice(multiApiStart, multiApiEnd);
  const mainSource = source("main.cjs");

  assert.match(multiApi, /recentFiles:\s*"host-user-data-redacted"/u);
  assert.match(multiApi, /getRecentSvgaFiles\(/u);
  assert.match(multiApi, /openRecentSvgaFile\(/u);
  assert.match(multiApi, /clearRecentSvgaFiles\(/u);
  assert.match(multiApi, /saveShortTermSvgaOutput\(/u);
  assert.match(mainSource, /if \(usesShortTermPreviewShell\) \{\s*installShortTermApplicationMenu/u);
});

test("recent-file normalization accepts only the three 0.2 local motion formats", () => {
  const mainSource = source("main.cjs");
  assert.match(mainSource, /\.svga[\s\S]*\.json[\s\S]*\.mp4/u);
  assert.match(mainSource, /openMultiFormatFilePath\(record\.path,\s*"recentFile"\)/u);
});

test("right-panel rendering projects only format-applicable groups and hides internal phases", () => {
  const controllerSource = source("web/multiformat-desktop-preview-controller.mjs");
  assert.match(controllerSource, /projectMultiFormatRightPanel/u);
  assert.doesNotMatch(controllerSource, /\["Maturity",\s*"阶段"\]/u);
  const projected = projectMultiFormatRightPanel(ownerEnvelope({
    facts: [{ id: "format", label: "格式", value: "LOTTIE", status: "pass" }],
    assets: [
      { id: "cover", name: "cover.png", kind: "image", ownerKind: "图片", fileSize: "1.5 KiB", dimensions: "320 x 180", resolutionStatus: "", replaceable: true },
      { id: "missing", name: "missing.png", kind: "image", ownerKind: "图片", fileSize: "", dimensions: "", resolutionStatus: "缺失", replaceable: false }
    ],
    assetInventory: {
      schemaVersion: 1,
      pathRedacted: true,
      format: "lottie",
      groups: [{
        id: "image_resources",
        label: "图片",
        count: 1,
        replaceableCount: 0,
        status: "available",
        items: [{
          id: "cover",
          label: "cover.png",
          groupId: "image_resources",
          kind: "image",
          source: "asset",
          status: "available",
          replaceable: false,
          runtimeTargetId: "cover",
          detail: [],
          pathRedacted: true
        }]
      }],
      summary: {
        totalItems: 1,
        replaceableItems: 0,
        imageCount: 1,
        textCount: 0,
        sequenceFrameCount: 0,
        audioVideoCount: 0,
        unsupportedOrMissingCount: 0
      },
      capabilityMarkers: []
    },
    issues: [{ code: "missing_resource", severity: "error", message: "预览所需资源缺失。", pathRedacted: true }],
    imageTargets: [{ imageKey: "cover", resourceId: "cover", displayName: "cover.png", detail: "320 x 180 · 1.5 KiB" }]
  }));
  assert.deepEqual(projected.facts.map(({ id }) => id), ["format"]);
  assert.deepEqual(projected.assetInventory.groups.map(({ id }) => id), ["image_resources"]);
  assert.deepEqual(projected.assetInventory.groups.map(({ label }) => label), ["图片"]);
  assert.deepEqual(projected.issues.map(({ code }) => code), ["missing_resource"]);
  assert.deepEqual(projected.assets.map(({ ownerKind, fileSize, resolutionStatus }) => ({ ownerKind, fileSize, resolutionStatus })), [
    { ownerKind: "图片", fileSize: "1.5 KiB", resolutionStatus: "" },
    { ownerKind: "图片", fileSize: "", resolutionStatus: "缺失" }
  ]);

  const vapProjection = projectMultiFormatRightPanel(ownerEnvelope({
    facts: [
      { id: "audio", label: "音频", value: "存在", status: "pass" },
      { id: "dimensions", label: "画布", value: "未知", status: "unknown" }
    ],
    assetInventory: {
      schemaVersion: 1,
      pathRedacted: true,
      format: "vap",
      groups: [{
        id: "audio_video_media",
        label: "音视频",
        count: 1,
        replaceableCount: 0,
        status: "available",
        items: [{
          id: "vap-video",
          label: "视频轨道",
          groupId: "audio_video_media",
          kind: "video",
          source: "media",
          status: "available",
          replaceable: false,
          detail: ["编码：avc1"],
          pathRedacted: true
        }]
      }],
      summary: {
        totalItems: 1,
        replaceableItems: 0,
        imageCount: 0,
        textCount: 0,
        sequenceFrameCount: 0,
        audioVideoCount: 1,
        unsupportedOrMissingCount: 0
      },
      capabilityMarkers: []
    }
  }));
  assert.equal(vapProjection.assetInventory.groups[0].label, "音视频");
  assert.equal(vapProjection.assetInventory.groups[0].items[0].label, "视频轨道");
  assert.deepEqual(vapProjection.assetInventory.groups[0].items[0].detail, ["编码：avc1"]);
  assert.deepEqual(vapProjection.facts.map(({ value }) => value), ["存在", "未知"]);
});

test("accepted R12 shell affordances remain present in the composed 0.2 shell", () => {
  const htmlSource = source("web/index.html");
  const controllerSource = source("web/short-term-macos-controller.mjs");
  const compareModelSource = source("web/short-term-macos-compare-model.mjs");
  const domStateSource = source("web/short-term-macos-dom-state.mjs");

  assert.match(htmlSource, /class="canvasModeSwitch compareModeSwitch"/u);
  assert.match(compareModelSource, /comparePairOpenButton[\s\S]*打开文件/u);
  assert.match(compareModelSource, /compareExitButton/u);
  assert.match(controllerSource, /loadDroppedCompareFile,/u);
  assert.match(domStateSource, /rightSurfaceHeader\.hidden = surfaceState === "optimization"/u);
});

test("owner right-panel projection consumes only a verified snapshot envelope", () => {
  let getterCalls = 0;
  let coercionCalls = 0;
  const accessorIssue = {};
  Object.defineProperty(accessorIssue, "code", {
    enumerable: true,
    get() {
      getterCalls += 1;
      return "missing_resource";
    }
  });
  const coercibleFeature = {
    toString() {
      coercionCalls += 1;
      return "expression";
    },
    [Symbol.toPrimitive]() {
      coercionCalls += 1;
      return "expression";
    }
  };
  const rawRightPanel = {
    facts: [{ id: "format", label: "Format", value: "LOTTIE", status: "pass", rawPath: "/Users/alice/fact.json" }],
    assets: [{
      id: "cover",
      name: "cover.png",
      kind: "image",
      sizeBytes: 1536,
      dimensions: "320 x 180",
      resolutionStatus: "available",
      replaceable: true,
      rawPath: "/Users/alice/cover.png"
    }],
    assetInventory: {
      schemaVersion: 1,
      pathRedacted: true,
      format: "lottie",
      rawPath: "/Users/alice/inventory.json",
      groups: [{
        id: "image_resources",
        label: "Images",
        status: "available",
        rawPath: "/Users/alice/group.json",
        items: [{
          id: "cover",
          label: "cover.png",
          groupId: "image_resources",
          kind: "image",
          source: "asset",
          status: "replaceable",
          replaceable: true,
          runtimeTargetId: "cover",
          detail: ["320 x 180"],
          pathRedacted: true,
          rawPath: "/Users/alice/item.png"
        }]
      }]
    },
    unsupportedFeatures: [
      { feature: "expression", path: "layers.0.xp", severity: "warning" },
      { feature: ["expression"], path: "/Users/alice/array.json", severity: "warning" },
      { feature: new String("expression"), path: "/Users/alice/boxed.json", severity: "warning" },
      { feature: coercibleFeature, path: "/Users/alice/coercible.json", severity: "warning" },
      { feature: Symbol("expression"), path: "/Users/alice/symbol.json", severity: "warning" }
    ],
    issues: [
      { code: "missing_resource", message: "known", severity: "error" },
      { code: ["missing_resource"], message: "/Users/alice/array.json", severity: "error" },
      { code: new String("missing_resource"), message: "/Users/alice/boxed.json", severity: "error" },
      accessorIssue,
      { code: 42, message: "/Users/alice/numeric.json", severity: "error" }
    ],
    rawPath: "/Users/alice/right-panel.json",
    diagnostics: { feature: "expression", path: "/Users/alice/diagnostics.json" }
  };
  Object.defineProperty(rawRightPanel, "accessorPath", {
    enumerable: true,
    get() {
      getterCalls += 1;
      return "/Users/alice/accessor.json";
    }
  });
  [
    [rawRightPanel.assetInventory, "inventoryAccessor"],
    [rawRightPanel.assetInventory.groups[0], "groupAccessor"],
    [rawRightPanel.assets[0], "assetAccessor"],
    [rawRightPanel.assetInventory.groups[0].items[0], "itemAccessor"]
  ].forEach(([record, key]) => {
    Object.defineProperty(record, key, {
      enumerable: true,
      get() {
        getterCalls += 1;
        return `/Users/alice/${key}.json`;
      }
    });
  });

  let projection;
  assert.doesNotThrow(() => {
    projection = projectMultiFormatRightPanel({ detectedFormat: "lottie", rightPanel: rawRightPanel });
  });

  assert.equal(getterCalls, 0);
  assert.equal(coercionCalls, 0);
  assert.deepEqual(Object.keys(projection).sort(), [
    "assetInventory",
    "assets",
    "facts",
    "imageTargets",
    "issues",
    "pathRedacted",
    "schemaVersion",
    "textTargets",
    "unsupportedFeatures"
  ]);
  assert.deepEqual(projection.facts, []);
  assert.deepEqual(projection.assets, []);
  assert.deepEqual(projection.assetInventory.groups, []);
  assert.deepEqual(projection.imageTargets, []);
  assert.deepEqual(projection.textTargets, []);
  assert.deepEqual(projection.issues, [{
    code: "owner_issue",
    severity: "warning",
    message: "当前文件存在无法显示的检查问题。",
    pathRedacted: true
  }]);
  assert.doesNotMatch(JSON.stringify(projection), /Users\/alice|rawPath|accessorPath|diagnostics|layers\.0\.xp|Complete bounded JSON|expression/iu);
});

test("owner snapshot envelope rejects tampering and noncanonical payloads", () => {
  const envelope = ownerEnvelope({
    facts: [{ id: "format", label: "格式", value: "LOTTIE", status: "pass" }]
  });
  assert.deepEqual(projectMultiFormatRightPanel(envelope).facts.map(({ value }) => value), ["LOTTIE"]);
  assert.deepEqual(projectMultiFormatRightPanel({ ...envelope, schemaVersion: 2 }).facts, []);
  assert.deepEqual(projectMultiFormatRightPanel({ ...envelope, pathRedacted: false }).facts, []);
  assert.deepEqual(projectMultiFormatRightPanel({ ...envelope, snapshotByteLength: envelope.snapshotByteLength + 1 }).facts, []);
  assert.deepEqual(projectMultiFormatRightPanel({ ...envelope, snapshotSha256: "0".repeat(64) }).facts, []);
  assert.deepEqual(projectMultiFormatRightPanel({
    ...envelope,
    snapshotJson: `{"facts":[],"facts":[{"id":"format","label":"格式","status":"pass","value":"LOTTIE"}],"assets":[],"assetInventory":{"capabilityMarkers":[],"groups":[],"pathRedacted":true,"schemaVersion":1,"summary":{"audioVideoCount":0,"imageCount":0,"replaceableItems":0,"sequenceFrameCount":0,"textCount":0,"totalItems":0,"unsupportedOrMissingCount":0}},"imageTargets":[],"issues":[],"pathRedacted":true,"schemaVersion":1,"textTargets":[],"unsupportedFeatures":[]}`,
    snapshotByteLength: Buffer.byteLength(`{"facts":[],"facts":[{"id":"format","label":"格式","status":"pass","value":"LOTTIE"}],"assets":[],"assetInventory":{"capabilityMarkers":[],"groups":[],"pathRedacted":true,"schemaVersion":1,"summary":{"audioVideoCount":0,"imageCount":0,"replaceableItems":0,"sequenceFrameCount":0,"textCount":0,"totalItems":0,"unsupportedOrMissingCount":0}},"imageTargets":[],"issues":[],"pathRedacted":true,"schemaVersion":1,"textTargets":[],"unsupportedFeatures":[]}`, "utf8"),
    snapshotSha256: createHash("sha256").update(`{"facts":[],"facts":[{"id":"format","label":"格式","status":"pass","value":"LOTTIE"}],"assets":[],"assetInventory":{"capabilityMarkers":[],"groups":[],"pathRedacted":true,"schemaVersion":1,"summary":{"audioVideoCount":0,"imageCount":0,"replaceableItems":0,"sequenceFrameCount":0,"textCount":0,"totalItems":0,"unsupportedOrMissingCount":0}},"imageTargets":[],"issues":[],"pathRedacted":true,"schemaVersion":1,"textTargets":[],"unsupportedFeatures":[]}`).digest("hex")
  }).facts, []);
});

test("multi-format UI reuses shared rows and keeps unavailable Edit explicitly disabled", () => {
  const controllerSource = source("web/multiformat-desktop-preview-controller.mjs");
  const modulesSource = source("web/short-term-macos.modules.css");
  const tokensSource = source("web/short-term-macos.tokens.css");

  assert.match(controllerSource, /createReplaceableImageRow/u);
  assert.match(controllerSource, /createTextElementRow/u);
  assert.match(controllerSource, /directReplace:\s*true/u);
  assert.match(controllerSource, /row\.dataset\.component = "AssetRow"/u);
  assert.match(controllerSource, /section\.dataset\.role = "AssetInventoryGroup"/u);
  assert.match(controllerSource, /mount\.dataset\.role = "MultiFormatRuntimeMount"/u);
  assert.doesNotMatch(controllerSource, /dataset\.component = "AssetInventory(?:Group|Item)"/u);
  assert.doesNotMatch(controllerSource, /dataset\.component = "MultiFormatRuntimeMount"/u);
  assert.doesNotMatch(controllerSource, /无运行时替换|无可替换项/u);
  assert.doesNotMatch(controllerSource, /:\s*assetStatusCopy\(item\.status\)/u);
  assert.match(controllerSource, /editEnabled:\s*false/u);
  assert.doesNotMatch(controllerSource, />\.\.\.<\/button>/u);
  assert.doesNotMatch(controllerSource, /#f6f7f8|#d7dce2|#1f2937|#64748b/u);
  assert.doesNotMatch(controllerSource, /本地渲染已就绪|正在准备本地预览/u);
  assert.doesNotMatch(controllerSource, /asset\.sizeBytes \? `\$\{asset\.sizeBytes\} B`/u);
  assert.match(controllerSource, /\[asset\.dimensions, asset\.fileSize, asset\.resolutionStatus\]/u);
  assert.match(controllerSource, /function clearSurfaces\(\)[\s\S]*assetFilterTabs\.replaceChildren\(\)[\s\S]*assetFilterTabs\.hidden = true/u);
  assert.match(controllerSource, /activeFormat = result\?\.model\?\.detectedFormat[\s\S]*state\.mode = "preview"[\s\S]*state\.tab = "overview"[\s\S]*applyTabState\("overview"\)/u);
  assert.match(modulesSource, /\.assetGroup\s*\{[\s\S]*var\(--asv-asset-group-gap\)/u);
  assert.match(modulesSource, /\.assetGroupHeader\s*\{[\s\S]*var\(--asv-asset-group-header-padding-block\)/u);
  assert.match(tokensSource, /--asv-component-asset-group-gap:/u);
  assert.match(tokensSource, /--asv-asset-group-gap:\s*var\(--asv-component-asset-group-gap\)/u);
  assert.match(tokensSource, /--asv-component-replace-image-action-height:/u);
  assert.match(tokensSource, /--asv-replace-image-action-height:\s*var\(--asv-component-replace-image-action-height\)/u);
});

test("composed SVGA playback exposes and cleans an exact primary-player identity", () => {
  const playbackSource = source("web/short-term-macos-playback-model.mjs");
  const playbackSurfaceSource = source("web/short-term-macos-playback-surface.mjs");
  const fileSurfaceSource = source("web/short-term-macos-file-surface.mjs");
  const proofSource = source("scripts/run-multiformat-real-rendering-matrix-proof.cjs");
  const mountIndex = playbackSource.indexOf("await player.mount(videoItem)");
  const readyIndex = playbackSource.indexOf('canvas.dataset.runtimePlayer = "svga-web"');

  assert.ok(mountIndex >= 0 && readyIndex > mountIndex);
  assert.match(playbackSource, /delete playback\.canvas\.dataset\.runtimePlayer/u);
  assert.match(playbackSource, /hasPlayed: options\.start !== false/u);
  assert.match(playbackSurfaceSource, /runtimePlaybackFrame/u);
  assert.match(playbackSurfaceSource, /runtimePlaybackState/u);
  assert.match(fileSurfaceSource, /renderFailureMessage\(nodes, ""\)/u);
  assert.match(source("web/multiformat-desktop-preview-controller.mjs"), /startPlayback: result\.model\.status === "playing"/u);
  assert.match(source("web/multiformat-desktop-preview-controller.mjs"), /delete mount\.dataset\.runtimePlaybackProgress/u);
  assert.match(proofSource, /format: "svga",[\s\S]*?expectedCanvas: "primary"/u);
  assert.match(proofSource, /#primaryCanvas\[data-runtime-player="svga-web"\]/u);
  assert.doesNotMatch(proofSource, /svga_failure_discriminator/u);
});

test("preview runtime has a reserved stage viewport between mode and transport controls", () => {
  const htmlSource = source("web/index.html");
  const cssSource = source("web/short-term-macos.modules.css");

  assert.match(htmlSource, /class="runtimeStageViewport"/u);
  assert.match(cssSource, /\.runtimeStageViewport/u);
  assert.match(cssSource, /--asv-runtime-stage-top/u);
  assert.match(cssSource, /--asv-runtime-stage-bottom/u);
});

test("square, wide, and tall media fit wholly inside the reserved stage", () => {
  assert.deepEqual(containMotionMedia({ width: 300, height: 300 }, { width: 600, height: 400 }), {
    width: 400,
    height: 400,
    scale: 4 / 3
  });
  assert.deepEqual(containMotionMedia({ width: 900, height: 300 }, { width: 600, height: 400 }), {
    width: 600,
    height: 200,
    scale: 2 / 3
  });
  assert.deepEqual(containMotionMedia({ width: 300, height: 900 }, { width: 600, height: 400 }), {
    width: 133,
    height: 400,
    scale: 4 / 9
  });
});

test("real-rendering evidence binds the current routed material aliases without durable local paths", () => {
  const proofSource = source("scripts/run-multiformat-real-rendering-matrix-proof.cjs");

  assert.match(proofSource, /alias: "REAL-SVGA-SQUARE-A"[\s\S]*da75da15150fb7d9bca0c3a5acafbcce9601438a2142afdd2c014b0c3d64449d/u);
  assert.match(proofSource, /alias: "REAL-LOTTIE-EMBEDDED-A"[\s\S]*4d415de7f6ec0a3742281e91f60a0dcc9e1c5574760e82e17a053eafc1d82eb1/u);
  assert.match(proofSource, /alias: "OWNER-VAP-A"[\s\S]*22cb7c516cba552ba5347e82aea7d17b8a3f988b68befbb7e6f69743b096de9d/u);
  assert.match(proofSource, /AUTO_SVGA_SKIP_FUSION_FIXTURE === "1"/u);
  assert.match(proofSource, /status: "notRun", reason: "task_owned_fusion_fixture_unavailable"/u);
  assert.doesNotMatch(proofSource, /Users\/huangtengxin\/Downloads/u);
});

test("real-material source proof validates the private binding and emits aliases only", () => {
  const proofSource = source("scripts/run-multiformat-conformance-source-proof.cjs");

  assert.match(proofSource, /AUTO_SVGA_CONFORMANCE_INPUT_BINDING/u);
  assert.match(proofSource, /bindingStat\.mode & 0o777/u);
  assert.match(proofSource, /inputStat\.isFile\(\) \|\| inputStat\.isSymbolicLink\(\)/u);
  assert.match(proofSource, /chooseMultiFormatLocalFile/u);
  assert.match(proofSource, /pickerStatus: selection\.status/u);
  assert.match(proofSource, /nativeButtonAcceptanceRequiresInstalledQa: true/u);
  assert.match(proofSource, /waitedForHumanDecision: true/u);
  assert.match(proofSource, /assertNoPathLeak/u);
  assert.match(proofSource, /runtimePixelPlayback: false/u);
  assert.match(proofSource, /fusionReplacementRuntimeRerun: false/u);
  assert.doesNotMatch(proofSource, /Users\/huangtengxin\/Downloads/u);
});
