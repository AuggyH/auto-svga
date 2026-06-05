import { access, mkdtemp, mkdir, rename, writeFile } from "node:fs/promises";
import { execFile } from "node:child_process";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import assert from "node:assert/strict";
import test from "node:test";
import { convertCanvasAnchorToLocal } from "../mvp/anchor.js";
import { planCommand } from "../commands/plan.js";
import { planMotions } from "../mvp/motion-planner.js";
import { expandMotionPlan } from "../mvp/template-expander.js";
import { validateStructure } from "../mvp/job-loader.js";
import type { MvpConfig, MvpPart, MvpStructure } from "../mvp/types.js";
import { ensureMvpGeneratedAssets } from "../mvp/generated-assets.js";
import { canvasPointToLayerLocal, renderMvpPreviewGif, transformAtFrame } from "../mvp/preview-renderer.js";
import { createTransparentImage, setPixel, writeRgbaPng } from "../utils/png-writer.js";

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
  symmetryPair: "right_wing"
};

const rightWing: MvpPart = {
  id: "right_wing",
  type: "wing",
  source: "input/right_wing.png",
  bbox: [342, 150, 472, 300],
  anchor: { x: 367, y: 238, space: "canvas", role: "root_joint", confidence: 0.9 },
  zIndex: 5,
  motionAllowed: ["wing_flap"],
  symmetryPair: "left_wing"
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
  assert.deepEqual(left?.keyframes.map((keyframe) => keyframe.rotation), [-2, 3, -2, 3, -2]);
  assert.deepEqual(right?.keyframes.map((keyframe) => keyframe.rotation), [2, -3, 2, -3, 2]);
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
});

test("plan command writes motion-plan.json and project.json", async () => {
  const tempDir = await createTempJob();

  const result = await planCommand(tempDir);
  assert.equal(result.motionPlan.effects.length, 5);
  assert.equal(result.project.frames, 72);
  assert.equal(result.project.layers.length, 6);
  assert.equal(result.generated.map((file) => path.basename(file)).join(","), "motion-plan.json,project.json");
});

test("generated assets and preview.gif are produced for MVP project", async () => {
  const tempDir = await createTempJob();
  const result = await planCommand(tempDir);
  const generated = await ensureMvpGeneratedAssets(tempDir, result.project);
  assert.deepEqual(generated.generated.map((file) => path.basename(file)).sort(), [
    "glow_dot.png",
    "glow_frame.png",
    "sweep_light.png"
  ]);

  const report = await renderMvpPreviewGif(tempDir, result.project);
  assert.equal(path.basename(report.previewPath), "preview.gif");
  assert.equal(report.generatedAssets.length, 0);
  assert.equal(report.frames, 72);
});

test("missing generated assets are created during preview without crashing", async () => {
  const tempDir = await createTempJob();
  const result = await planCommand(tempDir);
  const report = await renderMvpPreviewGif(tempDir, result.project);
  assert.equal(report.generatedAssets.length, 3);
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

test("plan and preview CLI do not require protobufjs", async () => {
  const tempDir = await createTempJob();
  await planCommand(tempDir);

  await withProtobufjsHidden(async () => {
    await execFileAsync(process.execPath, ["dist/cli.js", "plan", tempDir]);
    const { stdout } = await execFileAsync(process.execPath, ["dist/cli.js", "preview", tempDir]);
    assert.match(stdout, /auto-svga MVP preview completed/);
  });
});

async function createTempJob(): Promise<string> {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "auto-svga-job-"));
  const inputDir = path.join(tempDir, "input");
  await mkdir(inputDir, { recursive: true });
  await writeFile(path.join(inputDir, "config.json"), `${JSON.stringify(config, null, 2)}\n`);
  await writeFile(path.join(inputDir, "structure.json"), `${JSON.stringify(structure, null, 2)}\n`);
  for (const part of structure.parts) {
    await writeFixturePng(path.join(tempDir, part.source));
  }
  return tempDir;
}

async function writeFixturePng(filePath: string): Promise<void> {
  const image = createTransparentImage(512, 512);
  for (let y = 180; y < 332; y += 1) {
    for (let x = 180; x < 332; x += 1) {
      setPixel(image, x, y, [188, 218, 246, 180]);
    }
  }
  await writeRgbaPng(filePath, image);
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
