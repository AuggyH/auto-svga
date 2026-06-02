import { access, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { ensureDir, writeJsonFile } from "../utils/fs.js";

export async function initCommand(targetDir: string): Promise<void> {
  const dir = path.resolve(targetDir);
  await mkdir(dir, { recursive: true });
  await ensureDir(path.join(dir, "assets"));

  const configPath = path.join(dir, "asset.config.json");
  if (!(await exists(configPath))) {
    await writeJsonFile(configPath, {
      assetType: "avatar_frame",
      name: path.basename(dir),
      source: {
        framePng: "assets/frame.png"
      },
      canvas: {
        width: 256,
        height: 256,
        fps: 24,
        durationMs: 2400
      },
      templates: [
        { id: "breathing_glow" },
        { id: "metal_edge_sweep" },
        { id: "gem_twinkle" }
      ]
    });
  }

  const readmePath = path.join(dir, "README.md");
  if (!(await exists(readmePath))) {
    await writeFile(readmePath, "Place a transparent PNG at assets/frame.png, then run the build command.\n", "utf8");
  }
}

async function exists(filePath: string): Promise<boolean> {
  return access(filePath).then(() => true, () => false);
}
