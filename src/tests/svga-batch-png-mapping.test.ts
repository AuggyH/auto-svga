import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";
import {
  createSvgaBatchPngMappingReport,
  createSvgaBatchReplacementInputs,
  type SvgaEditableImageResource
} from "../workbench/svga/index.js";
import { createTransparentImage, encodeRgbaPng, setPixel } from "../utils/png-writer.js";

const resources: SvgaEditableImageResource[] = [
  resource("img_frame", "Frame", 300, 300),
  resource("img_glow", "Glow", 80, 80),
  resource("img_unicode", "宝石", 24, 24),
  resource("IconAlpha", "Icon Alpha", 32, 32),
  resource("ICONALPHA", "Icon Alpha Copy", 32, 32)
];

test("P5 batch PNG mapping uses exact and unique normalized rules deterministically", () => {
  const inputs = [
    input("img_frame.png", png(300, 300, [255, 0, 0, 255])),
    input("glow.png", png(80, 80, [0, 255, 0, 255])),
    input("宝石.png", png(24, 24, [0, 0, 255, 255])),
    input("Icon Alpha.png", png(32, 32, [255, 255, 0, 255]))
  ];
  const report = createSvgaBatchPngMappingReport(resources, inputs);

  assert.equal(report.readyToApply, true);
  assert.deepEqual(report.records.map(({ fileLabel, status, ruleId, selectedResourceKey }) => ({
    fileLabel,
    status,
    ruleId,
    selectedResourceKey
  })), [
    { fileLabel: "img_frame.png", status: "exact_match", ruleId: "resource_key_exact", selectedResourceKey: "img_frame" },
    { fileLabel: "glow.png", status: "unique_normalized_match", ruleId: "display_name_normalized_unique", selectedResourceKey: "img_glow" },
    { fileLabel: "宝石.png", status: "exact_match", ruleId: "display_name_exact", selectedResourceKey: "img_unicode" },
    { fileLabel: "Icon Alpha.png", status: "exact_match", ruleId: "display_name_exact", selectedResourceKey: "IconAlpha" }
  ]);
});

test("P5 batch PNG mapping detects normalized ambiguity and allows manual resolution", () => {
  const unresolved = createSvgaBatchPngMappingReport(resources, [
    input("iconalpha.png", png(32, 32, [255, 0, 0, 255]))
  ]);
  assert.equal(unresolved.readyToApply, false);
  assert.equal(unresolved.records[0].status, "ambiguous");
  assert.deepEqual(unresolved.records[0].candidateResourceKeys, ["ICONALPHA", "IconAlpha"]);

  const resolved = createSvgaBatchPngMappingReport(resources, [
    input("iconalpha.png", png(32, 32, [255, 0, 0, 255]), { manualResourceKey: "IconAlpha" })
  ]);
  assert.equal(resolved.readyToApply, true);
  assert.equal(resolved.records[0].status, "manually_resolved");
  assert.equal(resolved.records[0].ruleId, "manual");
  assert.equal(resolved.records[0].selectedResourceKey, "IconAlpha");
});

test("P5 batch PNG mapping blocks duplicate target conflicts until one file is excluded", () => {
  const bytes = png(300, 300, [255, 0, 0, 255]);
  const conflicted = createSvgaBatchPngMappingReport(resources, [
    input("img_frame.png", bytes),
    input("replacement.png", png(300, 300, [0, 255, 0, 255]), { manualResourceKey: "img_frame" })
  ]);
  assert.equal(conflicted.readyToApply, false);
  assert.deepEqual(conflicted.records.map(({ status }) => status), ["duplicate_target", "duplicate_target"]);

  const excluded = createSvgaBatchPngMappingReport(resources, [
    input("img_frame.png", bytes),
    input("replacement.png", png(300, 300, [0, 255, 0, 255]), {
      manualResourceKey: "img_frame",
      include: false
    })
  ]);
  assert.equal(excluded.readyToApply, true);
  assert.deepEqual(excluded.records.map(({ status }) => status), ["exact_match", "excluded"]);
});

test("P5 batch PNG mapping reports invalid, unmatched, and dimension warnings without absolute paths", () => {
  const macUserRoot = `/${"Users"}/`;
  const report = createSvgaBatchPngMappingReport(resources, [
    input(`${macUserRoot}example/Desktop/img_glow.png`, png(90, 80, [255, 0, 0, 255])),
    input("missing.png", png(10, 10, [0, 255, 0, 255])),
    input("broken.png", Uint8Array.from([1, 2, 3, 4]))
  ]);

  assert.equal(report.readyToApply, false);
  assert.equal(report.records[0].fileLabel, "img_glow.png");
  assert.equal(report.records[0].status, "exact_match");
  assert.equal(report.records[0].issues.some(({ code }) => code === "dimension_mismatch"), true);
  assert.equal(report.records[1].status, "unmatched");
  assert.equal(report.records[2].status, "invalid");
  assert.equal(JSON.stringify(report).includes(macUserRoot), false);
});

test("P5 batch replacement inputs are returned only for ready reports", () => {
  const frame = png(300, 300, [255, 0, 0, 255]);
  const glow = png(80, 80, [0, 255, 0, 255]);
  const readyInputs = [
    input("img_frame.png", frame),
    input("img_glow.png", glow)
  ];
  const ready = createSvgaBatchPngMappingReport(resources, readyInputs);
  assert.deepEqual(createSvgaBatchReplacementInputs(ready, readyInputs).map(({ resourceKey, pngBytes }) => ({
    resourceKey,
    sha256: sha256(pngBytes)
  })), [
    { resourceKey: "img_frame", sha256: sha256(frame) },
    { resourceKey: "img_glow", sha256: sha256(glow) }
  ]);

  const notReady = createSvgaBatchPngMappingReport(resources, [
    input("missing.png", png(10, 10, [255, 0, 0, 255]))
  ]);
  assert.deepEqual(createSvgaBatchReplacementInputs(notReady, []), []);
});

function input(
  fileLabel: string,
  pngBytes: Uint8Array,
  options: Partial<{ include: boolean; manualResourceKey: string }> = {}
) {
  return { fileLabel, pngBytes, ...options };
}

function resource(resourceKey: string, displayName: string, width: number, height: number): SvgaEditableImageResource {
  return {
    resourceKey,
    displayName,
    originalMime: "image/png",
    originalSizeBytes: 10,
    originalSha256: `${resourceKey}-sha`,
    decodedWidth: width,
    decodedHeight: height,
    usageCount: 1,
    replacementStatus: "original",
    validationStatus: "valid"
  };
}

function png(width: number, height: number, rgba: [number, number, number, number]): Buffer {
  const image = createTransparentImage(width, height);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      setPixel(image, x, y, rgba);
    }
  }
  return encodeRgbaPng(image);
}

function sha256(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}
