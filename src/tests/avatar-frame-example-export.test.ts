import assert from "node:assert/strict";
import { copyFile, mkdir, mkdtemp, readFile, realpath, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { exportCommand } from "../commands/export.js";

test("avatar-frame example exports referenced sprites without requiring intermediate assets", async (t) => {
  const tempRoot = await mkdtemp(path.join(await realpath(os.tmpdir()), "auto-svga-example-export-"));
  t.after(() => rm(tempRoot, { recursive: true, force: true }));
  const jobDir = path.join(tempRoot, "avatar_frame_basic");
  await mkdir(path.join(jobDir, "assets"), { recursive: true });
  await copyFile("examples/avatar_frame_basic/asset.config.json", path.join(jobDir, "asset.config.json"));
  await copyFile("examples/avatar_frame_basic/assets/frame.png", path.join(jobDir, "assets/frame.png"));

  const report = await exportCommand(jobDir);
  assert.ok("svgaExport" in report);
  assert.equal(report.svgaExport?.success, true);
  assert.equal(report.svgaExport?.validation?.imageCount, 28);
  assert.equal(report.svgaExport?.validation?.spriteCount, 30);

  const project = JSON.parse(await readFile(path.join(jobDir, "output/project.json"), "utf8")) as {
    assets: Array<{ path: string }>;
  };
  assert.equal(project.assets.length, 30);
  assert.deepEqual(
    project.assets.filter(({ path: assetPath }) => assetPath === "assets/sweep_core.png" || assetPath === "assets/sweep_soft.png").length,
    2
  );
});
