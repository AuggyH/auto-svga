import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  createReplaceableImageRow,
  createTextElementRow
} from "../web/short-term-macos-replaceable-renderers.mjs";
import {
  renderLaunchRecentFiles,
  renderRecentFilesUnavailable
} from "../web/short-term-macos-launch-renderers.mjs";
import {
  multiFormatActiveReplacementEntryForPublicTarget,
  multiFormatActiveReplacementForPublicTarget
} from "../web/multiformat-desktop-preview-controller.mjs";
import {
  multiFormatInventorySummaryItems,
  projectMultiFormatRightPanel
} from "../web/multiformat-product-conformance.mjs";
import {
  applyShortTermRuntimeTextPreview,
  resetShortTermRuntimeTextPreview
} from "../web/short-term-macos-runtime-text-surface.mjs";
import { collectRightSurfaceScrollContainmentProof } from "../web/short-term-macos-smoke-proof-model.mjs";

const experimentRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function stableStringify(value) {
  if (value === null) return "null";
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  if (typeof value === "object") {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function createOwnerSnapshotEnvelope(snapshot, sourceId = "uiux-ready-source") {
  const snapshotJson = stableStringify(snapshot);
  return {
    schemaVersion: 1,
    sourceId,
    snapshotJson,
    snapshotByteLength: Buffer.byteLength(snapshotJson, "utf8"),
    snapshotSha256: createHash("sha256").update(snapshotJson).digest("hex"),
    pathRedacted: true
  };
}

function readyRightPanelSnapshot(format, options = {}) {
  const groups = format === "vap"
    ? [
        {
          id: "vap_fusion_images",
          label: "VAP 融合图片",
          count: 1,
          replaceableCount: 1,
          status: "available",
          items: [{
            id: "vap-avatar",
            label: "avatar",
            groupId: "vap_fusion_images",
            kind: "image",
            source: "fusion",
            status: "replaceable",
            replaceable: true,
            runtimeTargetId: "srcTagAvatar",
            detail: ["120 x 80"],
            pathRedacted: true
          }]
        },
        {
          id: "vap_fusion_texts",
          label: "VAP 融合文字",
          count: 1,
          replaceableCount: 1,
          status: "available",
          items: [{
            id: "vap-title",
            label: "title",
            groupId: "vap_fusion_texts",
            kind: "text",
            source: "fusion",
            status: "replaceable",
            replaceable: true,
            runtimeTargetId: "title",
            detail: ["包含初始文字"],
            pathRedacted: true
          }]
        }
      ]
    : [
        {
          id: "image_resources",
          label: "图片",
          count: 1,
          replaceableCount: 1,
          status: "available",
          items: [{
            id: `${format}-avatar`,
            label: "avatar",
            groupId: "image_resources",
            kind: "image",
            source: "asset",
            status: "replaceable",
            replaceable: true,
            runtimeTargetId: "avatar",
            detail: ["120 x 80"],
            pathRedacted: true
          }]
        },
        {
          id: "text_candidates",
          label: "文本",
          count: 1,
          replaceableCount: 1,
          status: "available",
          items: [{
            id: `${format}-title`,
            label: "标题",
            groupId: "text_candidates",
            kind: "text",
            source: "text",
            status: "replaceable",
            replaceable: true,
            runtimeTargetId: format === "lottie" ? "text:1" : "title",
            detail: ["包含初始文字"],
            pathRedacted: true
          }]
        }
      ];
  return {
    schemaVersion: 1,
    pathRedacted: true,
    facts: [
      { id: "format", label: "格式", value: format.toUpperCase(), status: "pass" },
      { id: "dimensions", label: "画布尺寸", value: "120 x 80", status: "pass" },
      { id: "duration", label: "动画时长", value: "1s", status: "pass" },
      { id: "assets", label: "资源", value: "2", status: "pass" },
      { id: "replaceable", label: "可替换", value: "2", status: "pass" }
    ],
    assets: [],
    assetInventory: {
      schemaVersion: 1,
      pathRedacted: true,
      format,
      groups,
      summary: {
        totalItems: 2,
        replaceableItems: 2,
        imageCount: 1,
        textCount: 1,
        sequenceFrameCount: 0,
        audioVideoCount: 0,
        unsupportedOrMissingCount: 0
      },
      capabilityMarkers: []
    },
    unsupportedFeatures: [],
    issues: [],
    imageTargets: [{
      imageKey: "avatar",
      resourceId: "avatar",
      displayName: "avatar",
      detail: format === "vap" ? "VAP 融合图片 · 120 x 80" : "120 x 80"
    }],
    textTargets: [{
      textKey: format === "lottie" ? "text:1" : "title",
      displayName: format === "lottie" ? "Greeting" : "标题",
      initialText: options.initialText ?? "欢迎回来",
      placeholder: "输入文字以预览",
      resetDisabled: false
    }]
  };
}

class FakeClassList {
  toggle() {}
}

class FakeElement {
  constructor() {
    this.classList = new FakeClassList();
    this.dataset = {};
    this.children = [];
    this.disabled = false;
    this.hidden = false;
    this.innerHTML = "";
    this.textContent = "";
  }

  setAttribute(name, value) {
    this[name] = String(value);
  }

  replaceChildren(...children) {
    this.children = children;
  }
}

function withFakeDocument(run) {
  const previousDocument = globalThis.document;
  globalThis.document = {
    createElement() {
      return new FakeElement();
    }
  };
  try {
    return run();
  } finally {
    globalThis.document = previousDocument;
  }
}

function textTarget(overrides = {}) {
  return {
    textKey: "title",
    displayName: "标题",
    initialText: "欢迎回来",
    inputValue: "欢迎回来",
    placeholder: "输入文字以预览",
    resetDisabled: false,
    ...overrides
  };
}

test("ready workspace text Reset follows the current preview value", () => {
  withFakeDocument(() => {
    const sourceRow = createTextElementRow(textTarget(), 0, { selected: false });
    assert.match(sourceRow.innerHTML, /data-initial-value="欢迎回来"/u);
    assert.match(sourceRow.innerHTML, /data-action="runtime-text-reset"[^>]*disabled/u);
    assert.equal(sourceRow.dataset.replacementState, "source");

    const changedRow = createTextElementRow(textTarget({ inputValue: "新的标题" }), 0, { selected: true });
    assert.doesNotMatch(changedRow.innerHTML, /data-action="runtime-text-reset"[^>]*disabled/u);
    assert.equal(changedRow.dataset.replacementState, "preview");
  });
});

test("ready workspace image Reset follows active multi-format replacement state", () => {
  withFakeDocument(() => {
    const sourceRow = createReplaceableImageRow({
      imageKey: "avatar",
      resourceId: "avatar",
      displayName: "头像",
      detail: "120 x 80"
    }, 0, { selected: false, renaming: false, directReplace: true });
    assert.equal(sourceRow.dataset.replacementState, "source");
    assert.match(sourceRow.innerHTML, /data-action="reset-image-preview"[^>]*disabled/u);
    assert.match(sourceRow.innerHTML, /aria-label="替换 头像 图片"/u);

    const previewRow = createReplaceableImageRow({
      imageKey: "avatar",
      resourceId: "avatar",
      displayName: "头像",
      detail: "120 x 80",
      replacementActive: true
    }, 0, { selected: true, renaming: false, directReplace: true });
    assert.equal(previewRow.dataset.replacementState, "preview");
    assert.doesNotMatch(previewRow.innerHTML, /data-action="reset-image-preview"[^>]*disabled/u);
    assert.match(previewRow.innerHTML, /aria-label="重置 头像 图片预览"/u);
  });
});

test("ready workspace text Reset stays available for host-active runtime text", () => {
  withFakeDocument(() => {
    const activeRow = createTextElementRow(textTarget({ replacementActive: true }), 0, {
      selected: true,
      replacementActive: true
    });
    assert.equal(activeRow.dataset.replacementState, "preview");
    assert.doesNotMatch(activeRow.innerHTML, /data-action="runtime-text-reset"[^>]*disabled/u);
  });
});

test("multi-format replacement state resolves SVGA, Lottie, and VAP runtime bindings", () => {
  const lottieModel = {
    detectedFormat: "lottie",
    replacement: {
      active: [{ format: "lottie", kind: "text", targetId: "text:1", valuePreview: "Hello" }]
    }
  };
  assert.equal(multiFormatActiveReplacementForPublicTarget(lottieModel, "text", "text:1"), true);
  assert.equal(
    multiFormatActiveReplacementEntryForPublicTarget(lottieModel, "text", "text:1")?.valuePreview,
    "Hello"
  );

  const svgaModel = {
    detectedFormat: "svga",
    replacement: {
      active: [{ format: "svga", kind: "image", targetId: "profile_frame", valuePreview: "data:image/png;base64,AQ==" }]
    }
  };
  assert.equal(multiFormatActiveReplacementForPublicTarget(svgaModel, "image", "profile_frame"), true);

  const vapModel = {
    detectedFormat: "vap",
    replacement: {
      active: [{ format: "vap", kind: "image", targetId: "srcTagAvatar", valuePreview: "data:image/png;base64,Ag==" }]
    }
  };
  const publicBindings = new Map([
    ["image:avatar-resource", { kind: "image", publicTargetId: "avatar-resource", runtimeTargetId: "srcTagAvatar" }]
  ]);
  assert.equal(multiFormatActiveReplacementForPublicTarget(vapModel, "image", "avatar-resource"), false);
  assert.equal(multiFormatActiveReplacementForPublicTarget(vapModel, "image", "avatar-resource", publicBindings), true);
});

test("SVGA, Lottie, and VAP ready right surfaces share the owner snapshot hierarchy", () => {
  for (const format of ["svga", "lottie", "vap"]) {
    const snapshot = readyRightPanelSnapshot(format);
    const panel = projectMultiFormatRightPanel({
      ownerRightPanelSnapshotEnvelope: createOwnerSnapshotEnvelope(snapshot, `${format}-source`)
    });

    assert.deepEqual(panel.facts.map((fact) => fact.id), ["format", "dimensions", "duration", "assets", "replaceable"]);
    assert.equal(panel.assetInventory.format, format);
    assert.equal(panel.assetInventory.summary.totalItems, 2);
    assert.equal(panel.assetInventory.summary.replaceableItems, 2);
    assert.deepEqual(
      multiFormatInventorySummaryItems(panel.assetInventory.summary).map((item) => `${item.id}:${item.count}`),
      ["all:2", "images:1", "texts:1"]
    );
    assert.equal(panel.assetInventory.groups.length, 2);
    assert.equal(panel.assetInventory.groups.every((group) => group.replaceableCount === 1), true);
    assert.equal(panel.assetInventory.groups.every((group) => group.items.length === 1), true);
    assert.equal(panel.imageTargets.length, 1);
    assert.equal(panel.imageTargets[0].imageKey, "avatar");
    assert.equal(panel.textTargets.length, 1);
    assert.equal(panel.textTargets[0].placeholder, "输入文字以预览");
    assert.equal(panel.issues.length, 0);
    assert.equal(panel.unsupportedFeatures.length, 0);
  }
});

test("ready right surface rejects stale raw rightPanel data without a trusted snapshot", () => {
  const panel = projectMultiFormatRightPanel({
    detectedFormat: "lottie",
    rightPanel: {
      facts: [{ id: "format", label: "格式", value: "LOTTIE", status: "pass" }],
      assetInventory: {
        groups: [{
          id: "image_resources",
          label: "/Users/private/raw path",
          count: 1,
          replaceableCount: 1,
          status: "available",
          items: []
        }]
      },
      imageTargets: [{
        imageKey: "avatar",
        resourceId: "avatar",
        displayName: "raw-avatar",
        detail: "120 x 80"
      }]
    }
  });
  assert.deepEqual(panel.facts, []);
  assert.equal(panel.assetInventory.summary.totalItems, 0);
  assert.equal(panel.imageTargets.length, 0);
  assert.equal(panel.textTargets.length, 0);
  assert.equal(panel.issues[0].message, "当前文件存在无法显示的检查问题。");
});

test("live SVGA text preview keeps Reset and replacement state aligned with the source value", () => {
  const resetButton = { disabled: true };
  const row = {
    dataset: { replacementState: "source" },
    querySelector(selector) {
      return selector === "[data-action='runtime-text-reset']" ? resetButton : null;
    }
  };
  const input = {
    dataset: { textKey: "title" },
    closest(selector) {
      return selector === ".textElementRow" ? row : null;
    }
  };
  const nodes = {
    runtimeTextOverlay: { hidden: true, textContent: "" },
    textElementList: {
      querySelectorAll(selector) {
        return selector === "[data-text-input]" ? [input] : [];
      }
    }
  };
  const state = {
    sourceBytes: Uint8Array.from([1]),
    selectedTextKey: "title",
    textPreviewValues: {},
    model: {
      replaceableElements: {
        texts: [{ textKey: "title", displayName: "标题", initialText: "欢迎回来" }]
      }
    }
  };
  let commandRenders = 0;
  const applyValue = (value) => applyShortTermRuntimeTextPreview({
    nodes,
    state,
    textKey: "title",
    value,
    renderCommandState() {
      commandRenders += 1;
    }
  });

  applyValue("欢迎回来");
  assert.equal(resetButton.disabled, true);
  assert.equal(row.dataset.replacementState, "source");
  assert.deepEqual(state.textPreviewValues, {});

  applyValue("新的标题");
  assert.equal(resetButton.disabled, false);
  assert.equal(row.dataset.replacementState, "preview");
  assert.deepEqual(state.textPreviewValues, { title: "新的标题" });

  applyValue("欢迎回来");
  assert.equal(resetButton.disabled, true);
  assert.equal(row.dataset.replacementState, "source");
  assert.deepEqual(state.textPreviewValues, {});

  applyValue("再次修改");
  resetShortTermRuntimeTextPreview({
    nodes,
    state,
    textKey: "title",
    renderTextElements() {
      resetButton.disabled = true;
      row.dataset.replacementState = "source";
    },
    renderCommandState() {
      commandRenders += 1;
    }
  });
  assert.equal(resetButton.disabled, true);
  assert.equal(row.dataset.replacementState, "source");
  assert.deepEqual(state.textPreviewValues, {});
  assert.equal(commandRenders, 5);
});

test("ready workspace right surface keeps tokenized density and containment contracts", async () => {
  const [tokens, atoms, molecules, components, modules, pageStates] = await Promise.all([
    "short-term-macos.tokens.css",
    "short-term-macos.atoms.css",
    "short-term-macos.molecules.css",
    "short-term-macos.components.css",
    "short-term-macos.modules.css",
    "short-term-macos.page-states.css"
  ].map((file) => readFile(path.join(experimentRoot, "web", file), "utf8")));

  assert.match(tokens, /--asv-component-asset-summary-column-gap:/u);
  assert.match(tokens, /--asv-component-asset-group-header-warning-background:/u);
  assert.match(tokens, /--asv-component-asset-group-header-blocked-background:/u);
  assert.match(tokens, /--asv-component-row-action-disabled-opacity:/u);
  assert.match(tokens, /:root\[data-appearance="dark"\]/u);
  assert.match(atoms, /\.rowText\s*\{[^}]*overflow:\s*hidden/su);
  assert.match(molecules, /\.runtimeTextResetButton:disabled,[\s\S]*?\.resetImagePreviewButton:disabled\s*\{[^}]*opacity:\s*var\(--asv-row-action-disabled-opacity\)/su);
  assert.match(molecules, /\.runtimeTextResetButton:focus-visible,[\s\S]*?\.resetImagePreviewButton:focus-visible\s*\{[^}]*box-shadow:\s*var\(--asv-focus\)/su);
  assert.match(molecules, /\.resetImagePreviewButton:disabled\s*\{[^}]*opacity:\s*var\(--asv-row-action-disabled-opacity\)/su);
  assert.match(molecules, /\.resetImagePreviewButton:focus-visible\s*\{[^}]*box-shadow:\s*var\(--asv-focus\)/su);
  assert.match(molecules, /\.replacementRowActions\s*\{[^}]*max-width:\s*100%/su);
  assert.match(components, /\.assetRow \.badge\s*\{[^}]*text-overflow:\s*ellipsis/su);
  assert.match(modules, /\.assetFilterTabs\[data-presentation="summary"\]\s*\{[^}]*flex-wrap:\s*wrap/su);
  assert.match(modules, /\.assetSummaryItem\[data-summary-id="all"\]\s*\{[^}]*background:\s*var\(--asv-asset-filter-tab-selected-bg\)/su);
  assert.match(modules, /\.assetGroup\[data-status="warning"\] \.assetGroupHeader\s*\{[^}]*background:\s*var\(--asv-asset-group-header-warning-bg\)/su);
  assert.match(modules, /\.assetGroup\[data-status="blocked"\] \.assetGroupHeader\s*\{[^}]*background:\s*var\(--asv-asset-group-header-blocked-bg\)/su);
  assert.match(modules, /\.assetGroup\[data-empty="true"\] \.assetGroupHeader\s*\{[^}]*opacity:\s*var\(--asv-asset-group-empty-opacity\)/su);
  assert.match(modules, /\.assetGroupHeader \.rowText\s*\{[^}]*overflow:\s*hidden/su);
  assert.match(modules, /\.rightSurfaceBody\s*\{[^}]*overflow-x:\s*hidden[^}]*overflow-y:\s*auto/su);
  assert.match(modules, /\.recentClearButton:disabled\s*\{[^}]*visibility:\s*hidden/su);
  assert.doesNotMatch(modules, /\.launchCanvas:has\(\.recentBlock:not\(\[hidden\]\)\)/u);
  assert.match(pageStates, /@media \(prefers-reduced-motion: reduce\)/u);
  assert.match(pageStates, /@media \(max-width: 1080px\)/u);
});

test("launch recent module remains present for unavailable, empty, and non-empty states", () => {
  const createNodes = () => {
    const recentBlock = new FakeElement();
    const listNode = new FakeElement();
    listNode.closest = (selector) => selector === ".recentBlock" ? recentBlock : null;
    return {
      recentBlock,
      listNode,
      noteNode: new FakeElement(),
      clearButton: new FakeElement()
    };
  };

  withFakeDocument(() => {
    const empty = createNodes();
    renderLaunchRecentFiles(empty, []);
    assert.equal(empty.recentBlock.hidden, false);
    assert.equal(empty.recentBlock.dataset.state, "empty");
    assert.equal(empty.clearButton.disabled, true);
    assert.equal(empty.listNode.children.length, 0);
    assert.equal(empty.noteNode.hidden, true);

    const ready = createNodes();
    renderLaunchRecentFiles(ready, [{
      id: "recent-1",
      displayName: "头像框.svga",
      parentName: "素材",
      available: true
    }]);
    assert.equal(ready.recentBlock.hidden, false);
    assert.equal(ready.recentBlock.dataset.state, "ready");
    assert.equal(ready.clearButton.disabled, false);
    assert.equal(ready.listNode.children.length, 1);

    const unavailable = createNodes();
    renderRecentFilesUnavailable(unavailable);
    assert.equal(unavailable.recentBlock.hidden, false);
    assert.equal(unavailable.recentBlock.dataset.state, "unavailable");
    assert.equal(unavailable.clearButton.disabled, true);
    assert.equal(unavailable.listNode.children.length, 0);
    assert.equal(unavailable.noteNode.hidden, true);
  });
});

test("ready workspace right surface containment is vertical-only at narrow width", () => {
  const surface = {
    clientWidth: 320,
    scrollWidth: 320,
    clientHeight: 480,
    scrollHeight: 920,
    scrollTop: 0
  };
  const getComputedStyle = () => ({ overflowX: "hidden", overflowY: "auto" });

  const proof = collectRightSurfaceScrollContainmentProof(surface, {
    getComputedStyle,
    requireVerticalOverflow: true
  });
  assert.equal(proof.passed, true);
  assert.equal(proof.horizontalContentFits, true);
  assert.equal(proof.verticalScrollEnabled, true);
  assert.equal(proof.maxScrollTop, 440);
  assert.equal(proof.reachedScrollTop, 440);
  assert.equal(proof.bottomReachable, true);
  assert.equal(surface.scrollTop, 0);

  assert.equal(collectRightSurfaceScrollContainmentProof({
    ...surface,
    scrollWidth: 321
  }, { getComputedStyle, requireVerticalOverflow: true }).passed, false);
  assert.equal(collectRightSurfaceScrollContainmentProof(surface, {
    getComputedStyle: () => ({ overflowX: "hidden", overflowY: "hidden" }),
    requireVerticalOverflow: true
  }).passed, false);
});
