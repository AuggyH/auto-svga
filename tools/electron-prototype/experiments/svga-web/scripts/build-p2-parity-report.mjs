import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptRoot = path.dirname(fileURLToPath(import.meta.url));
const experimentRoot = path.resolve(scriptRoot, "..");
const repoRoot = path.resolve(experimentRoot, "../../../..");
const artifactRoot = path.join(repoRoot, ".artifacts/product/P2");
const electronBin = path.resolve(experimentRoot, "../../node_modules/.bin/electron");

function gitHeadCommit() {
  return execFileSync("git", ["rev-parse", "HEAD"], { cwd: repoRoot, encoding: "utf8" }).trim();
}

async function readIndex() {
  try {
    return JSON.parse(await readFile(path.join(artifactRoot, "artifact-index.json"), "utf8"));
  } catch {
    return {
      milestoneId: "P2",
      title: "Desktop Product Shell And Web Preview Parity",
      productIdentity: "Auto SVGA",
      headCommit: gitHeadCommit(),
      generatedAt: new Date().toISOString(),
      humanReviewRequired: true,
      artifacts: []
    };
  }
}

async function addArtifact(index, fileName, scenario, mode = "comparison") {
  const bytes = await readFile(path.join(artifactRoot, fileName));
  const record = {
    scenario,
    mode,
    source: "comparison",
    path: `.artifacts/product/P2/${fileName}`,
    mime: fileName.endsWith(".json") ? "application/json" : "image/png",
    sizeBytes: bytes.byteLength,
    sha256: createHash("sha256").update(bytes).digest("hex"),
    fixture: "synthetic-avatar-frame.svga",
    headCommit: index.headCommit,
    generatedAt: new Date().toISOString(),
    humanReviewRequired: true
  };
  index.artifacts = index.artifacts.filter((artifact) => artifact.path !== record.path);
  index.artifacts.push(record);
}

async function main() {
  await mkdir(artifactRoot, { recursive: true });
  execFileSync(electronBin, [
    path.join(scriptRoot, "comparison-capture.cjs"),
    "--artifact-root", artifactRoot,
    "--left", "web-reference-loaded.png",
    "--right", "desktop-loaded.png",
    "--out", "web-desktop-loaded-comparison.png",
    "--title", "Loaded state parity"
  ], { cwd: experimentRoot, stdio: "inherit" });
  execFileSync(electronBin, [
    path.join(scriptRoot, "comparison-capture.cjs"),
    "--artifact-root", artifactRoot,
    "--left", "web-reference-inspection.png",
    "--right", "desktop-inspection.png",
    "--out", "web-desktop-inspection-comparison.png",
    "--title", "Inspection report parity"
  ], { cwd: experimentRoot, stdio: "inherit" });

  const required = [
    "web-reference-loaded.png",
    "web-reference-inspection.png",
    "desktop-loaded.png",
    "desktop-inspection.png",
    "actual-normal-loaded.png",
    "smoke-loaded.png"
  ];
  const missing = [];
  for (const fileName of required) {
    try {
      await readFile(path.join(artifactRoot, fileName));
    } catch {
      missing.push(fileName);
    }
  }
  const report = {
    schemaVersion: 1,
    milestoneId: "P2",
    headCommit: gitHeadCommit(),
    passed: missing.length === 0,
    baseline: "Web preview remains reference workflow; desktop shell must match primary states before editing features.",
    comparedStates: [
      { state: "loaded", web: "web-reference-loaded.png", desktop: "desktop-loaded.png", comparison: "web-desktop-loaded-comparison.png" },
      { state: "inspection", web: "web-reference-inspection.png", desktop: "desktop-inspection.png", comparison: "web-desktop-inspection-comparison.png" }
    ],
    knownDifferences: [
      "Desktop shell uses a two-pane product layout while Web preview keeps the full inspection workbench.",
      "Electron runtime remains internal prototype and keeps a wasm-unsafe-eval exception for svga-web only."
    ],
    missingArtifacts: missing,
    generatedAt: new Date().toISOString()
  };
  await writeFile(path.join(artifactRoot, "web-desktop-parity-report.json"), `${JSON.stringify(report, null, 2)}\n`);
  const index = await readIndex();
  index.headCommit = report.headCommit;
  index.generatedAt = new Date().toISOString();
  await addArtifact(index, "web-desktop-loaded-comparison.png", "web-desktop-loaded-comparison");
  await addArtifact(index, "web-desktop-inspection-comparison.png", "web-desktop-inspection-comparison");
  await addArtifact(index, "web-desktop-parity-report.json", "web-desktop-parity-report");
  await writeFile(path.join(artifactRoot, "artifact-index.json"), `${JSON.stringify(index, null, 2)}\n`);
  if (!report.passed) throw new Error(`Missing parity artifacts: ${missing.join(", ")}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
