import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  createReplaceableImageRow,
  createTextElementRow
} from "../web/short-term-macos-replaceable-renderers.mjs";
import {
  multiFormatActiveReplacementEntryForPublicTarget,
  multiFormatActiveReplacementForPublicTarget
} from "../web/multiformat-desktop-preview-controller.mjs";
import {
  applyShortTermRuntimeTextPreview,
  resetShortTermRuntimeTextPreview
} from "../web/short-term-macos-runtime-text-surface.mjs";
import { collectRightSurfaceScrollContainmentProof } from "../web/short-term-macos-smoke-proof-model.mjs";

const experimentRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

class FakeClassList {
  toggle() {}
}

class FakeElement {
  constructor() {
    this.classList = new FakeClassList();
    this.dataset = {};
    this.innerHTML = "";
  }

  setAttribute(name, value) {
    this[name] = String(value);
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
  assert.match(tokens, /--asv-component-row-action-disabled-opacity:/u);
  assert.match(tokens, /:root\[data-appearance="dark"\]/u);
  assert.match(atoms, /\.rowText\s*\{[^}]*overflow:\s*hidden/su);
  assert.match(molecules, /\.runtimeTextResetButton:disabled,[\s\S]*?\.resetImagePreviewButton:disabled\s*\{[^}]*opacity:\s*var\(--asv-row-action-disabled-opacity\)/su);
  assert.match(molecules, /\.runtimeTextResetButton:focus-visible,[\s\S]*?\.resetImagePreviewButton:focus-visible\s*\{[^}]*box-shadow:\s*var\(--asv-focus\)/su);
  assert.match(molecules, /\.resetImagePreviewButton:disabled\s*\{[^}]*opacity:\s*var\(--asv-row-action-disabled-opacity\)/su);
  assert.match(molecules, /\.resetImagePreviewButton:focus-visible\s*\{[^}]*box-shadow:\s*var\(--asv-focus\)/su);
  assert.match(molecules, /\.replacementRowActions\s*\{[^}]*max-width:\s*100%/su);
  assert.match(components, /\.assetRow \.badge\s*\{[^}]*text-overflow:\s*ellipsis/su);
  assert.match(modules, /\.assetFilterTabs\[data-presentation="summary"\]\s*\{[^}]*grid-template-columns:\s*repeat\(2, minmax\(0, 1fr\)\)/su);
  assert.match(modules, /\.assetGroupHeader \.rowText\s*\{[^}]*overflow:\s*hidden/su);
  assert.match(modules, /\.rightSurfaceBody\s*\{[^}]*overflow-x:\s*hidden[^}]*overflow-y:\s*auto/su);
  assert.match(pageStates, /@media \(prefers-reduced-motion: reduce\)/u);
  assert.match(pageStates, /@media \(max-width: 1080px\)/u);
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
