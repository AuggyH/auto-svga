import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptRoot = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptRoot, "../../../../..");
const artifactRoot = path.join(repoRoot, ".artifacts/product/P2");
const visibleRoot = path.join(repoRoot, "review/P2-latest");

const screenshotFiles = [
  "web-reference-empty.png",
  "web-reference-loaded.png",
  "web-reference-inspection.png",
  "web-reference-invalid.png",
  "desktop-empty.png",
  "desktop-loading.png",
  "desktop-loaded.png",
  "desktop-inspection.png",
  "desktop-invalid.png",
  "actual-normal-loaded.png",
  "smoke-loaded.png",
  "desktop-1280x800.png",
  "desktop-1440x900.png",
  "matched-web-desktop-empty-comparison.png",
  "matched-web-desktop-loaded-comparison.png",
  "matched-web-desktop-inspection-comparison.png",
  "matched-web-desktop-invalid-comparison.png"
];

const reportFiles = [
  "canonical-fixture.json",
  "comparison-manifest.json",
  "artifact-index.json",
  "normal-runtime-proof.json",
  "normal-smoke-parity.json",
  "runtime-identity.json",
  "web-reference-runtime-proof.json",
  "web-reference-request-audit.json",
  "web-desktop-parity-report.json",
  "reviewer-b-product-categories.json"
];

function readArgument(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function gitHeadCommit() {
  return execFileSync("git", ["rev-parse", "HEAD"], { cwd: repoRoot, encoding: "utf8" }).trim();
}

async function copyRequired(src, dest) {
  await readFile(src);
  await cp(src, dest);
}

async function main() {
  const headCommit = gitHeadCommit();
  const headShort = headCommit.slice(0, 7);
  const packetRoot = readArgument("--packet-root")
    ? path.resolve(repoRoot, readArgument("--packet-root"))
    : path.join(repoRoot, ".artifacts/loop-handoff/latest");
  const stagingRoot = path.join(artifactRoot, `P2-${headShort}-upload`);
  const uploadZip = path.join(artifactRoot, `P2-${headShort}-upload.zip`);
  await rm(stagingRoot, { recursive: true, force: true });
  await rm(uploadZip, { force: true });
  await mkdir(path.join(stagingRoot, "screenshots"), { recursive: true });
  await mkdir(path.join(stagingRoot, "reports"), { recursive: true });

  await copyRequired(path.join(packetRoot, "REVIEW_PACKET.md"), path.join(stagingRoot, "REVIEW_PACKET.md"));
  await copyRequired(path.join(packetRoot, "FINAL_RESPONSE.txt"), path.join(stagingRoot, "FINAL_RESPONSE.txt"));
  await copyRequired(path.join(packetRoot, "MANIFEST.json"), path.join(stagingRoot, "MANIFEST.json"));
  await writeFile(path.join(stagingRoot, "README.md"), [
    "# P2 Review Upload Package",
    "",
    "Status: HUMAN_REQUIRED",
    "This package contains the P2 Repair 3 review packet and product evidence.",
    "",
    "Upload this ZIP only. REVIEW_PACKET.md is included inside the ZIP.",
    ""
  ].join("\n"));

  for (const fileName of screenshotFiles) {
    await copyRequired(path.join(artifactRoot, fileName), path.join(stagingRoot, "screenshots", fileName));
  }
  for (const fileName of reportFiles) {
    await copyRequired(path.join(artifactRoot, fileName), path.join(stagingRoot, "reports", fileName));
  }

  execFileSync("zip", ["-qr", uploadZip, "."], {
    cwd: stagingRoot,
    env: { ...process.env, COPYFILE_DISABLE: "1" }
  });
  await rm(stagingRoot, { recursive: true, force: true });
  await mkdir(visibleRoot, { recursive: true });
  await cp(uploadZip, path.join(visibleRoot, path.basename(uploadZip)));
  await cp(path.join(packetRoot, "REVIEW_PACKET.md"), path.join(visibleRoot, "REVIEW_PACKET.md"));
  await cp(path.join(packetRoot, "FINAL_RESPONSE.txt"), path.join(visibleRoot, "FINAL_RESPONSE.txt"));
  await cp(path.join(packetRoot, "MANIFEST.json"), path.join(visibleRoot, "MANIFEST.json"));
  const bytes = await readFile(uploadZip);
  const summary = {
    schemaVersion: 1,
    milestoneId: "P2",
    headCommit,
    uploadZip: path.relative(repoRoot, uploadZip),
    visibleUploadZip: path.relative(repoRoot, path.join(visibleRoot, path.basename(uploadZip))),
    sizeBytes: bytes.byteLength,
    sha256: createHash("sha256").update(bytes).digest("hex"),
    screenshotFiles,
    reportFiles,
    generatedAt: new Date().toISOString()
  };
  await writeFile(path.join(artifactRoot, "p2-upload-package-summary.json"), `${JSON.stringify(summary, null, 2)}\n`);
  await writeFile(path.join(visibleRoot, "README.md"), [
    "# P2 Review Materials",
    "",
    "Use the ZIP in this folder for review upload.",
    "",
    `- ${path.basename(uploadZip)}`,
    "- REVIEW_PACKET.md is included in the ZIP and also copied here for quick reading.",
    ""
  ].join("\n"));
  console.log(`P2_UPLOAD_PACKAGE=${JSON.stringify(summary)}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
