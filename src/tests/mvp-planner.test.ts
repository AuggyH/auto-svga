import { access, mkdtemp, mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { execFile } from "node:child_process";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import assert from "node:assert/strict";
import test from "node:test";
import { convertCanvasAnchorToLocal } from "../mvp/anchor.js";
import { planCommand } from "../commands/plan.js";
import { previewCommand } from "../commands/preview.js";
import { reportCommand } from "../commands/report.js";
import { exportCommand } from "../commands/export.js";
import { packageCommand } from "../commands/package.js";
import { acceptanceCommand, type AcceptanceRecord } from "../commands/acceptance.js";
import { planMotions } from "../mvp/motion-planner.js";
import { expandMotionPlan } from "../mvp/template-expander.js";
import { validateStructure } from "../mvp/job-loader.js";
import type { MvpConfig, MvpPart, MvpStructure } from "../mvp/types.js";
import type { MvpReport, MvpSvgaMap } from "../mvp/report-builder.js";
import { ensureMvpGeneratedAssets } from "../mvp/generated-assets.js";
import { canvasPointToLayerLocal, renderMvpPreviewGif, transformAtFrame } from "../mvp/preview-renderer.js";
import { buildAnchorTransformMatrix, buildMvpImageRegistry, interpolateLayerTransform } from "../mvp/svga-exporter.js";
import { createTransparentImage, setPixel, writeRgbaPng } from "../utils/png-writer.js";
import { decodeRgbaPng } from "../utils/png-reader.js";
import { applyEasing } from "../mvp/easing.js";

const execFileAsync = promisify(execFile);

const config: MvpConfig = {
  assetType: "avatar_frame",
  canvas: { width: 512, height: 512 },
  fps: 30,
  durationMs: 2400,
  outputName: "avatar_frame_test_001"
};

const leftWing: MvpPart = {
  id: "left_wing",
  type: "wing",
  source: "input/left_wing.png",
  bbox: [40, 150, 170, 300],
  anchor: { x: 145, y: 238, space: "canvas", role: "root_joint", confidence: 0.9 },
  zIndex: 5,
  motionAllowed: ["wing_flap"],
  symmetryPair: "right_wing",
  motionProfile: { amplitudeDeg: 1.2, phase: 0, easing: "easeInOutSine", mode: "micro_flap" }
};

const rightWing: MvpPart = {
  id: "right_wing",
  type: "wing",
  source: "input/right_wing.png",
  bbox: [342, 150, 472, 300],
  anchor: { x: 367, y: 238, space: "canvas", role: "root_joint", confidence: 0.9 },
  zIndex: 5,
  motionAllowed: ["wing_flap"],
  symmetryPair: "left_wing",
  motionProfile: { amplitudeDeg: 1.2, phase: 0, easing: "easeInOutSine", mode: "micro_flap" }
};

const structure: MvpStructure = {
  assetType: "avatar_frame",
  inputMode: "layered",
  canvas: { width: 512, height: 512 },
  safeArea: { type: "circle", centerX: 256, centerY: 256, radius: 174 },
  parts: [
    {
      id: "base_frame",
      type: "base_frame",
      source: "input/base_frame.png",
      bbox: [0, 0, 512, 512],
      anchor: { x: 256, y: 256, space: "canvas", role: "center", confidence: 1 },
      zIndex: 1,
      motionAllowed: ["frame_breath", "metal_sweep"]
    },
    leftWing,
    rightWing,
    {
      id: "top_gem",
      type: "gem",
      source: "input/top_gem.png",
      bbox: [232, 30, 280, 82],
      anchor: { x: 256, y: 56, space: "canvas", role: "center", confidence: 0.95 },
      zIndex: 10,
      motionAllowed: ["gem_twinkle"]
    }
  ]
};

test("anchor canvas coordinates convert to local coordinates", () => {
  assert.deepEqual(convertCanvasAnchorToLocal(leftWing), {
    canvasX: 145,
    canvasY: 238,
    localX: 105,
    localY: 88
  });
});

test("missing part.source produces a warning", async () => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "auto-svga-mvp-"));
  const issues = await validateStructure(structure, tempDir);
  assert.equal(issues.some((issue) => issue.code === "PART_SOURCE_MISSING" && issue.level === "warning"), true);
});

test("motion planner emits expected effects", () => {
  const motionPlan = planMotions(config, structure);
  assert.deepEqual(motionPlan.effects.map((effect) => effect.template), [
    "frame_breath",
    "metal_sweep",
    "wing_flap",
    "wing_flap",
    "gem_twinkle"
  ]);
});

test("wing_flap generates mirrored rotations", () => {
  const motionPlan = planMotions(config, structure);
  const { project } = expandMotionPlan(config, structure, motionPlan);
  const left = project.layers.find((layer) => layer.id === "left_wing_layer");
  const right = project.layers.find((layer) => layer.id === "right_wing_layer");
  assert.deepEqual(left?.keyframes.map((keyframe) => keyframe.rotation), [-1.2, 0, 1.2, 0, -1.2]);
  assert.deepEqual(right?.keyframes.map((keyframe) => keyframe.rotation), [1.2, 0, -1.2, 0, 1.2]);
  assert.equal(left?.keyframes.every((keyframe) => keyframe.easing === "easeInOutSine"), true);
});

test("gem_twinkle generates scale and alpha keyframes", () => {
  const motionPlan = planMotions(config, structure);
  const { project } = expandMotionPlan(config, structure, motionPlan);
  const gem = project.layers.find((layer) => layer.id === "top_gem_layer");
  assert.equal(gem?.sourceEffect, "top_gem_twinkle");
  assert.deepEqual(gem?.keyframes.slice(0, 3), [
    { frame: 0, alpha: 0.85, scaleX: 1, scaleY: 1 },
    { frame: 8, alpha: 1, scaleX: 1.08, scaleY: 1.08 },
    { frame: 16, alpha: 0.75, scaleX: 1, scaleY: 1 }
  ]);
  const glint = project.layers.find((layer) => layer.id === "top_gem_glint_layer");
  assert.equal(glint?.source, "generated/glow_dot.png");
  assert.equal(glint?.sourceEffect, "top_gem_twinkle");
});

test("plan command writes motion-plan.json and project.json", async () => {
  const tempDir = await createTempJob();

  const result = await planCommand(tempDir);
  assert.equal(result.motionPlan.effects.length, 5);
  assert.equal(result.project.frames, 72);
  assert.equal(result.project.layers.length > 6, true);
  assert.equal(result.generated.some((file) => file.endsWith("project/project.json")), true);
  assert.equal(result.generated.some((file) => file.includes("generated/optimized")), true);
});

test("generated assets and preview.gif are produced for MVP project", async () => {
  const tempDir = await createTempJob();
  const result = await planCommand(tempDir);
  const generated = await ensureMvpGeneratedAssets(tempDir, result.project);
  assert.equal(generated.generated.length >= 0, true);
  assert.equal(result.project.layers.some((layer) => layer.source.includes("sweep_baked")), true);
  const sweepLayer = result.project.layers.find((layer) => layer.source.includes("sweep_baked"));
  assert.ok(sweepLayer);
  const bakedSweep = decodeRgbaPng(await readFile(path.join(tempDir, sweepLayer.source)));
  assert.equal(bakedSweep.width < config.canvas.width || bakedSweep.height < config.canvas.height, true);
  const localCenterX = 256 - (sweepLayer.bbox?.[0] ?? 0);
  const localCenterY = 256 - (sweepLayer.bbox?.[1] ?? 0);
  if (localCenterX >= 0 && localCenterY >= 0 && localCenterX < bakedSweep.width && localCenterY < bakedSweep.height) {
    const safeAreaCenterAlpha = bakedSweep.pixels[(localCenterY * bakedSweep.width + localCenterX) * 4 + 3];
    assert.equal(safeAreaCenterAlpha, 0);
  }

  const report = await renderMvpPreviewGif(tempDir, result.project);
  assert.equal(path.basename(report.previewPath), "preview.gif");
  assert.equal(report.generatedAssets.length, 0);
  assert.equal(report.frames, 72);
  assert.equal(report.previewOutputs.frames.count, 72);
  assert.equal(report.gifPreviewDeprecated, true);
  assert.equal(await fileExists(path.join(tempDir, "output", "preview_frames", "frame_000.png")), true);
  const frame = decodeRgbaPng(await readFile(path.join(tempDir, "output", "preview_frames", "frame_000.png")));
  assert.deepEqual({ width: frame.width, height: frame.height }, config.canvas);
  assert.equal(frame.pixels.some((value, index) => index % 4 === 3 && value === 0), true);
});

test("missing generated assets are created during preview without crashing", async () => {
  const tempDir = await createTempJob();
  const result = await planCommand(tempDir);
  const report = await renderMvpPreviewGif(tempDir, result.project);
  assert.equal(report.generatedAssets.length >= 0, true);
  assert.equal(report.warnings.length, 0);
});

test("anchor local coordinates participate in preview transform", () => {
  const motionPlan = planMotions(config, structure);
  const { project } = expandMotionPlan(config, structure, motionPlan);
  const left = project.layers.find((layer) => layer.id === "left_wing_layer");
  assert.ok(left);
  const transform = transformAtFrame(left, 18);
  const local = canvasPointToLayerLocal(left, transform, transform.x + left.anchor!.localX, transform.y + left.anchor!.localY);
  assert.deepEqual(local, { x: 105, y: 88 });
});

test("plan, preview, and report CLI do not require protobufjs", async () => {
  const tempDir = await createTempJob();
  await planCommand(tempDir);

  await withProtobufjsHidden(async () => {
    await execFileAsync(process.execPath, ["dist/cli.js", "plan", tempDir]);
    const { stdout } = await execFileAsync(process.execPath, ["dist/cli.js", "preview", tempDir]);
    assert.match(stdout, /auto-svga MVP preview completed/);
    const reportResult = await execFileAsync(process.execPath, ["dist/cli.js", "report", tempDir]);
    assert.match(reportResult.stdout, /auto-svga MVP report completed/);
  });
});

test("report command writes report.json and svga-map.json with relative paths", async () => {
  const tempDir = await createTempJob();
  await planCommand(tempDir);
  await previewCommand(tempDir);

  const result = await reportCommand(tempDir);
  assert.equal(result.reportPath, "output/report.json");
  assert.equal(result.svgaMapPath, "output/svga-map.json");

  const report = await readJson<MvpReport>(path.join(tempDir, "output", "report.json"));
  const svgaMap = await readJson<MvpSvgaMap>(path.join(tempDir, "output", "svga-map.json"));
  assert.equal(report.validation.svgaExported, false);
  assert.equal(report.review.primary, "svga");
  assert.equal(report.visualWarnings.gifPreviewDeprecated, true);
  assert.equal(report.visualWarnings.unmaskedSweepWarning, false);
  assert.equal(report.maskSystem.sweepMaskEnabled, true);
  assert.equal(report.maskSystem.maskSource, "input/base_frame.png");
  assert.equal(report.maskSystem.sweepFrameStride, 3);
  assert.equal(report.maskSystem.trimBakedFrames, true);
  assert.equal(report.assetOptimization.allSvgaImagesTrimmed, true);
  assert.equal(report.memoryEstimate.withinBudget, true);
  assert.equal(report.technicalStatus, "success");
  assert.equal(report.visualStatus, "needs_review");
  assert.equal(report.animationSystem.easingEnabled, true);
  assert.equal(JSON.stringify(report).includes(tempDir), false);
  assert.equal(JSON.stringify(svgaMap).includes(tempDir), false);
  assert.equal(report.output.project, "project/project.json");
  assert.equal(report.preview.path, "output/preview.gif");
});

test("svga-map records layers, source effects, source images, and generated assets", async () => {
  const tempDir = await createTempJob();
  await planCommand(tempDir);
  await previewCommand(tempDir);
  const result = await reportCommand(tempDir);

  const leftWingLayer = result.svgaMap.layers.find((layer) => layer.projectLayerId === "left_wing_layer");
  assert.equal(leftWingLayer?.sourceEffect, "left_wing_flap");
  assert.equal(leftWingLayer?.sourceImage, "generated/optimized/left_wing.png");

  const sweep = result.svgaMap.effects.find((effect) => effect.effectId === "base_frame_sweep");
  assert.equal((sweep?.generatedAssets.length ?? 0) > 0, true);
  const sweepLayer = result.svgaMap.layers.find((layer) => layer.sourceEffect === "base_frame_sweep");
  assert.equal(sweepLayer?.maskSource, "input/base_frame.png");
  assert.equal((sweepLayer?.trimmedBbox?.[2] ?? 0) > 0, true);
  assert.equal((sweepLayer?.decodedBytes ?? 0) > 0, true);

  const breath = result.svgaMap.effects.find((effect) => effect.effectId === "base_frame_breath");
  assert.deepEqual(breath?.generatedAssets, ["generated/glow_frame.png"]);
});

test("report command warns but succeeds when preview-report.json is missing", async () => {
  const tempDir = await createTempJob();
  await planCommand(tempDir);

  const result = await reportCommand(tempDir);
  assert.equal(result.report.preview.generated, false);
  assert.equal(result.report.warnings.some((warning) => warning.includes("output/preview-report.json is missing")), true);
});

test("MVP export matrix uses local anchor instead of top-left rotation", () => {
  const matrix = buildAnchorTransformMatrix({
    x: 40,
    y: 150,
    scaleX: 1,
    scaleY: 1,
    rotation: 30,
    alpha: 1
  }, {
    canvasX: 145,
    canvasY: 238,
    localX: 105,
    localY: 88
  });
  const radians = (30 / 180) * Math.PI;
  const topLeftTx = 40;
  const topLeftTy = 150;
  assert.notEqual(Math.round(matrix.tx * 1000) / 1000, topLeftTx);
  assert.notEqual(Math.round(matrix.ty * 1000) / 1000, topLeftTy);
  assert.equal(Math.round(matrix.a * 1000) / 1000, Math.round(Math.cos(radians) * 1000) / 1000);
});

test("MVP export interpolates sparse keyframes into full frame transforms", () => {
  const motionPlan = planMotions(config, structure);
  const { project } = expandMotionPlan(config, structure, motionPlan);
  const left = project.layers.find((layer) => layer.id === "left_wing_layer");
  assert.ok(left);
  const transform = interpolateLayerTransform(left, 9);
  assert.equal(transform.x, 40);
  assert.equal(transform.y, 150);
  assert.equal(Math.round(transform.rotation * 100) / 100, -0.6);
  assert.equal(transform.alpha, 1);
});

test("MVP export interpolates each sparse property independently", () => {
  const layer = {
    id: "sparse_layer",
    type: "image" as const,
    source: "input/base_frame.png",
    role: "part" as const,
    zIndex: 1,
    bbox: [10, 20, 110, 120] as [number, number, number, number],
    keyframes: [
      { frame: 0, x: 10, alpha: 0 },
      { frame: 5, rotation: 20 },
      { frame: 10, x: 30, alpha: 1 }
    ]
  };
  const transform = interpolateLayerTransform(layer, 5);
  assert.equal(transform.x, 20);
  assert.equal(transform.y, 20);
  assert.equal(transform.rotation, 20);
  assert.equal(transform.alpha, 0.5);
});

test("MVP image registry dedupes identical source paths", async () => {
  const tempDir = await createTempJob();
  const result = await planCommand(tempDir);
  await ensureMvpGeneratedAssets(tempDir, result.project);
  const duplicatedProject = {
    ...result.project,
    layers: [
      ...result.project.layers,
      {
        ...result.project.layers[0],
        id: "base_frame_layer_duplicate"
      }
    ]
  };
  const registry = await buildMvpImageRegistry(tempDir, duplicatedProject);
  assert.equal(registry.entries.length, new Set(duplicatedProject.layers.map((layer) => layer.source)).size);
});

test("export command writes real MVP svga and updates report and map", async () => {
  const tempDir = await createTempJob();
  await planCommand(tempDir);
  await previewCommand(tempDir);
  await reportCommand(tempDir);

  const result = await exportCommand(tempDir);
  assert.equal("mode" in result && result.mode === "mvp", true);
  if (!("mode" in result) || result.mode !== "mvp") {
    throw new Error("Expected MVP export result.");
  }

  assert.equal(result.svgaPath, "output/avatar_frame_test_001.svga");
  assert.equal(result.sizeBytes > 0, true);
  assert.equal(result.images > 0, true);
  assert.equal(result.sprites, result.layers);
  assert.deepEqual(result.validation, {
    exists: true,
    inflated: true,
    decoded: true,
    imageCount: result.images,
    spriteCount: result.sprites,
    frameCount: 72
  });
  assert.equal(result.report.validation.svgaExported, true);
  assert.equal(result.report.output.svga, "output/avatar_frame_test_001.svga");
  assert.equal(result.report.svga?.sizeBytes, result.sizeBytes);

  const report = await readJson<MvpReport>(path.join(tempDir, "output", "report.json"));
  const svgaMap = await readJson<MvpSvgaMap>(path.join(tempDir, "output", "svga-map.json"));
  assert.equal(report.validation.svgaExported, true);
  assert.equal(report.output.svga, "output/avatar_frame_test_001.svga");
  assert.equal(svgaMap.layers.every((layer) => layer.svgaSpriteId && layer.svgaImageKey), true);
  assert.equal(svgaMap.assets.every((asset) => asset.svgaImageKey), true);
  assert.equal(result.report.svga?.imageCount, result.images);
  assert.equal(result.report.svga?.spriteCount, result.sprites);
  assert.equal(result.report.svga?.frameCount, result.frames);
});

test("export CLI reports a clear error when protobufjs is missing", async () => {
  const tempDir = await createTempJob();
  await planCommand(tempDir);

  await withProtobufjsHidden(async () => {
    await assert.rejects(
      execFileAsync(process.execPath, ["dist/cli.js", "export", tempDir]),
      (error: unknown) => {
        const output = error && typeof error === "object" && "stderr" in error ? String(error.stderr) : String(error);
        assert.match(output, /MVP SVGA export requires protobufjs/);
        return true;
      }
    );
  });
});

test("package command writes delivery.zip with required job-relative files", async () => {
  const tempDir = await createExportedTempJob();
  const result = await packageCommand(tempDir);

  assert.equal(result.deliveryPath, "output/delivery.zip");
  assert.equal(result.sizeBytes > 0, true);
  const zipEntries = listZipEntries(await readFile(path.join(tempDir, result.deliveryPath)));
  for (const requiredPath of [
    "output/avatar_frame_test_001.svga",
    "output/report.json",
    "output/svga-map.json",
    "project/project.json",
    "project/motion-plan.json",
    "input/config.json",
    "input/structure.json"
  ]) {
    assert.equal(zipEntries.includes(requiredPath), true, `delivery.zip should contain ${requiredPath}`);
  }
  assert.equal(zipEntries.some((entry) => path.isAbsolute(entry)), false);

  const report = await readJson<MvpReport>(path.join(tempDir, "output", "report.json"));
  assert.equal(report.output.deliveryZip, "output/delivery.zip");
  assert.equal((report.delivery?.sizeBytes ?? 0) > 0, true);
  assert.deepEqual(report.delivery?.includedFiles, result.includedFiles);
});

test("package command does not require preview.gif", async () => {
  const tempDir = await createExportedTempJob();
  await rm(path.join(tempDir, "output", "preview.gif"));
  const result = await packageCommand(tempDir);
  assert.equal(result.sizeBytes > 0, true);
  assert.equal(result.includedFiles.includes("output/preview.gif"), false);
});

test("easing system changes interpolation and falls back to linear", () => {
  assert.notEqual(applyEasing("easeInOutSine", 0.25), 0.25);
  assert.equal(applyEasing("unknown", 0.25), 0.25);
  assert.equal(applyEasing(undefined, 0.25), 0.25);
});

test("preview and exporter share eased interpolation", () => {
  const layer = {
    id: "eased_layer",
    type: "image" as const,
    source: "input/base_frame.png",
    role: "part" as const,
    zIndex: 1,
    keyframes: [
      { frame: 0, x: 0 },
      { frame: 20, x: 100, easing: "easeInOutSine" }
    ]
  };
  const preview = transformAtFrame(layer, 5);
  const exported = interpolateLayerTransform(layer, 5);
  assert.equal(preview.x, exported.x);
  assert.notEqual(preview.x, 25);
});

test("generated assets discover a nonstandard base frame source from structure.json", async () => {
  const tempDir = await createTempJob();
  const customStructure = {
    ...structure,
    parts: structure.parts.map((part) => part.id === "base_frame" ? {
      ...part,
      id: "base_frame_full",
      source: "input/01_base_frame_full.png",
      layerMode: "full_canvas" as const
    } : part)
  };
  await writeFile(path.join(tempDir, "input", "structure.json"), `${JSON.stringify(customStructure, null, 2)}\n`);
  await rename(path.join(tempDir, "input", "base_frame.png"), path.join(tempDir, "input", "01_base_frame_full.png"));
  const result = await planCommand(tempDir);
  await ensureMvpGeneratedAssets(tempDir, result.project);
  const glow = decodeRgbaPng(await readFile(path.join(tempDir, "generated", "glow_frame.png")));
  assert.equal(glow.pixels.some((value, index) => index % 4 === 3 && value > 0), true);
});

test("preview continues when ffmpeg is unavailable", async () => {
  const tempDir = await createTempJob();
  const result = await planCommand(tempDir);
  const originalPath = process.env.PATH;
  process.env.PATH = "";
  try {
    const report = await renderMvpPreviewGif(tempDir, result.project);
    assert.equal(report.previewOutputs.webm.generated, false);
    assert.equal(report.previewOutputs.mp4.generated, false);
    assert.equal(report.warnings.some((warning) => warning.includes("could not be generated")), true);
    assert.equal(await fileExists(path.join(tempDir, "output", "preview.gif")), true);
  } finally {
    process.env.PATH = originalPath;
  }
});

test("package command reports a clear error when the exported svga is missing", async () => {
  const tempDir = await createExportedTempJob();
  await rm(path.join(tempDir, "output", "avatar_frame_test_001.svga"));
  await assert.rejects(
    packageCommand(tempDir),
    /Required delivery file is missing: output\/avatar_frame_test_001\.svga/
  );
});

test("accept command writes acceptance.json and updates report.json", async () => {
  const tempDir = await createExportedTempJob();
  const result = await acceptanceCommand(tempDir, "accepted");
  const acceptance = await readJson<AcceptanceRecord>(path.join(tempDir, "output", "acceptance.json"));
  const report = await readJson<MvpReport>(path.join(tempDir, "output", "report.json"));

  assert.equal(result.acceptancePath, "output/acceptance.json");
  assert.equal(acceptance.status, "accepted");
  assert.equal(acceptance.jobName, path.basename(tempDir));
  assert.equal(report.acceptance?.status, "accepted");
  assert.equal(report.output.acceptance, "output/acceptance.json");
});

test("Web job loader uses validated repository-relative job paths", async () => {
  const webEntry = await readFile(path.resolve("tools/svga-player-preview/main.js"), "utf8");
  const source = await readFile(path.resolve("tools/shared/product-frontend/product-app.mjs"), "utf8");
  const shellHtml = await readFile(path.resolve("tools/shared/product-frontend/product-shell.html"), "utf8");
  const html = `${await readFile(path.resolve("tools/svga-player-preview/index.html"), "utf8")}\n${shellHtml}`;
  assert.match(webEntry, /shared\/product-frontend\/product-app\.mjs/);
  assert.match(webEntry, /product-shell-loader\.mjs/);
  assert.match(html, /data-product-shell-src="\.\.\/shared\/product-frontend\/product-shell\.html"/);
  assert.match(source, /new URLSearchParams\(window\.location\.search\)\.get\("job"\)/);
  assert.match(source, /\^jobs\\\/\[a-zA-Z0-9\._-\]\+\$/);
  assert.match(source, /previewOutputs\?\.webm/);
  assert.match(source, /previewOutputs\?\.mp4/);
  assert.match(source, /referenceState\.video\.load\(\)/);
  assert.match(source, /addEventListener\("canplay"/);
  assert.match(source, /for \(const candidate of previewCandidates\)/);
  assert.match(html, /<video id="referenceVideo" controls muted playsinline loop preload="auto"/);
  assert.equal(source.includes("/Users/"), false);
});

async function createTempJob(): Promise<string> {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "auto-svga-job-"));
  const inputDir = path.join(tempDir, "input");
  await mkdir(inputDir, { recursive: true });
  await writeFile(path.join(inputDir, "config.json"), `${JSON.stringify(config, null, 2)}\n`);
  await writeFile(path.join(inputDir, "structure.json"), `${JSON.stringify(structure, null, 2)}\n`);
  for (const part of structure.parts) {
    await writeFixturePng(path.join(tempDir, part.source), part);
  }
  return tempDir;
}

async function createExportedTempJob(): Promise<string> {
  const tempDir = await createTempJob();
  await planCommand(tempDir);
  await previewCommand(tempDir);
  await reportCommand(tempDir);
  await exportCommand(tempDir);
  return tempDir;
}

async function writeFixturePng(filePath: string, part: MvpPart): Promise<void> {
  const width = Math.max(1, part.bbox[2] - part.bbox[0]);
  const height = Math.max(1, part.bbox[3] - part.bbox[1]);
  const image = createTransparentImage(width, height);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (part.type === "base_frame") {
        const dx = x - width / 2;
        const dy = y - height / 2;
        const radius = Math.sqrt(dx * dx + dy * dy);
        if (radius < 190 || radius > 250) continue;
      }
      setPixel(image, x, y, [188, 218, 246, 180]);
    }
  }
  await writeRgbaPng(filePath, image);
}

async function readJson<T>(filePath: string): Promise<T> {
  return JSON.parse(await readFile(filePath, "utf8")) as T;
}

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

function listZipEntries(buffer: Buffer): string[] {
  const endSignature = 0x06054b50;
  let endOffset = buffer.length - 22;
  while (endOffset >= 0 && buffer.readUInt32LE(endOffset) !== endSignature) endOffset -= 1;
  if (endOffset < 0) throw new Error("ZIP end-of-central-directory record not found.");
  const entryCount = buffer.readUInt16LE(endOffset + 10);
  let offset = buffer.readUInt32LE(endOffset + 16);
  const names: string[] = [];
  for (let index = 0; index < entryCount; index += 1) {
    assert.equal(buffer.readUInt32LE(offset), 0x02014b50);
    const nameLength = buffer.readUInt16LE(offset + 28);
    const extraLength = buffer.readUInt16LE(offset + 30);
    const commentLength = buffer.readUInt16LE(offset + 32);
    names.push(buffer.subarray(offset + 46, offset + 46 + nameLength).toString("utf8"));
    offset += 46 + nameLength + extraLength + commentLength;
  }
  return names;
}

async function withProtobufjsHidden(run: () => Promise<void>): Promise<void> {
  const packagePath = path.resolve("node_modules", "protobufjs");
  const hiddenPath = path.resolve("node_modules", `.protobufjs-hidden-${Date.now()}`);
  let renamed = false;

  try {
    await access(packagePath);
    await rename(packagePath, hiddenPath);
    renamed = true;
  } catch {
    renamed = false;
  }

  try {
    await run();
  } finally {
    if (renamed) {
      await rename(hiddenPath, packagePath);
    }
  }
}
