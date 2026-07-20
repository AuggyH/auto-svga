import { createHash } from "node:crypto";
import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { deflateSync } from "node:zlib";
import protobuf from "protobufjs";

const prototypeRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const repoRoot = path.resolve(prototypeRoot, "../..");
const runtimeRoot = path.join(prototypeRoot, ".runtime");
const expectedVendorHashes = {
  "pako-2.1.0.min.js": "ede2693a4a6a5126b9d35669062b358ecab6ae7b9b86a1cf302feb45a8514907",
  "svgaplayerweb-2.3.1.min.js": "3e8cb9a59e17a9b0861298eacc4beba79895ebd7178d97669687af07212509b6"
};

await verifyVendorAssets();
await rm(runtimeRoot, { recursive: true, force: true });
await cp(path.join(repoRoot, "dist"), path.join(runtimeRoot, "dist"), { recursive: true });
await pruneRuntimeDist(path.join(runtimeRoot, "dist"));
await mkdir(path.join(runtimeRoot, "proto"), { recursive: true });
await cp(path.join(repoRoot, "proto/svga.proto"), path.join(runtimeRoot, "proto/svga.proto"));
await mkdir(path.join(runtimeRoot, "tools/svga-player-preview"), { recursive: true });
await cp(
  path.join(repoRoot, "tools/svga-player-preview/inspection-report-view.mjs"),
  path.join(runtimeRoot, "tools/svga-player-preview/inspection-report-view.mjs")
);
await mkdir(path.join(runtimeRoot, "tools"), { recursive: true });
await cp(
  path.join(repoRoot, "tools/shared"),
  path.join(runtimeRoot, "tools/shared"),
  { recursive: true }
);
await mkdir(path.join(runtimeRoot, "fixture"), { recursive: true });
const fixture = await createSyntheticFixture();
const replacement = await createSyntheticReplacementPng("p3");
const replacementA = await createSyntheticReplacementPng("a");
const replacementB = await createSyntheticReplacementPng("b");
await writeFile(path.join(runtimeRoot, "fixture/avatar-frame-smoke.svga"), fixture);
await writeFile(path.join(runtimeRoot, "fixture/replacement-p3.png"), replacement);
await writeFile(path.join(runtimeRoot, "fixture/replacement-a.png"), replacementA);
await writeFile(path.join(runtimeRoot, "fixture/replacement-b.png"), replacementB);
await writeFile(path.join(runtimeRoot, "manifest.json"), JSON.stringify({
  fixture: "fixture/avatar-frame-smoke.svga",
  fixtureSha256: sha256(fixture),
  replacementFixture: "fixture/replacement-p3.png",
  replacementFixtureSha256: sha256(replacement),
  replacementA: "fixture/replacement-a.png",
  replacementASha256: sha256(replacementA),
  replacementB: "fixture/replacement-b.png",
  replacementBSha256: sha256(replacementB),
  vendor: expectedVendorHashes
}, null, 2));
console.log(`Electron prototype runtime prepared (${fixture.byteLength} byte synthetic SVGA)`);

async function verifyVendorAssets() {
  for (const [name, expectedHash] of Object.entries(expectedVendorHashes)) {
    const bytes = await readFile(path.join(prototypeRoot, "vendor", name));
    if (sha256(bytes) !== expectedHash) throw new Error(`Vendor checksum mismatch: ${name}`);
  }
}

async function pruneRuntimeDist(distRoot) {
  await rm(path.join(distRoot, "tests"), { recursive: true, force: true });
  await rm(path.join(distRoot, ".DS_Store"), { force: true });
}

async function createSyntheticFixture() {
  const root = await protobuf.load(path.join(repoRoot, "proto/svga.proto"));
  const MovieEntity = root.lookupType("com.opensource.svga.MovieEntity");
  const leftImage = await createSyntheticImagePng(80, 80, "left");
  const rightImage = await createSyntheticImagePng(72, 72, "right");
  const unusedImage = await createSyntheticImagePng(24, 24, "unused");
  const leftFrames = Array.from({ length: 24 }, (_unused, frame) => ({
    alpha: 1,
    layout: { x: 0, y: 0, width: 80, height: 80 },
    transform: { a: 1, b: 0, c: 0, d: 1, tx: 58 + Math.sin(frame / 24 * Math.PI * 2) * 8, ty: 110 },
    clipPath: "",
    shapes: []
  }));
  const rightFrames = Array.from({ length: 24 }, (_unused, frame) => ({
    alpha: 0.9 + Math.sin(frame / 24 * Math.PI * 2) * 0.08,
    layout: { x: 0, y: 0, width: 72, height: 72 },
    transform: { a: 1, b: 0, c: 0, d: 1, tx: 176, ty: 112 + Math.cos(frame / 24 * Math.PI * 2) * 7 },
    clipPath: "",
    shapes: []
  }));
  const payload = {
    version: "2.0",
    params: { viewBoxWidth: 300, viewBoxHeight: 300, fps: 24, frames: 24 },
    images: {
      img_frame_left: leftImage,
      img_frame_right: rightImage,
      img_unused_marker: unusedImage
    },
    sprites: [
      { imageKey: "img_frame_left", frames: leftFrames },
      { imageKey: "img_frame_right", frames: rightFrames }
    ],
    audios: []
  };
  const verificationError = MovieEntity.verify(payload);
  if (verificationError) throw new Error(`Synthetic fixture verification failed: ${verificationError}`);
  return deflateSync(MovieEntity.encode(MovieEntity.create(payload)).finish());
}

async function createSyntheticImagePng(width, height, variant) {
  const { createTransparentImage, encodeRgbaPng } = await import(
    pathToFileURL(path.join(runtimeRoot, "dist/utils/png-writer.js")).href
  );
  const image = createTransparentImage(width, height);
  for (let y = 0; y < image.height; y += 1) {
    for (let x = 0; x < image.width; x += 1) {
      const offset = (y * image.width + x) * 4;
      if (variant === "right") {
        image.pixels[offset] = 126 + Math.round(y * 0.7);
        image.pixels[offset + 1] = 78 + Math.round(x * 0.8);
        image.pixels[offset + 2] = 220;
      } else if (variant === "unused") {
        image.pixels[offset] = 96;
        image.pixels[offset + 1] = 96;
        image.pixels[offset + 2] = 96;
      } else if (variant === "b") {
        image.pixels[offset] = 250;
        image.pixels[offset + 1] = 205 - Math.round(x * 0.5);
        image.pixels[offset + 2] = 52 + Math.round(y * 0.7);
      } else if (variant === "a") {
        image.pixels[offset] = 42 + Math.round(x * 0.9);
        image.pixels[offset + 1] = 180 + Math.round(y * 0.5);
        image.pixels[offset + 2] = 245;
      } else {
        image.pixels[offset] = 36 + Math.round(x * 0.8);
        image.pixels[offset + 1] = 156 + Math.round(y * 0.7);
        image.pixels[offset + 2] = 104 + Math.round((x + y) * 0.35);
      }
      image.pixels[offset + 3] = 255;
    }
  }
  return encodeRgbaPng(image);
}

async function createSyntheticReplacementPng(variant) {
  if (variant === "b") return createSyntheticImagePng(72, 72, "b");
  return createSyntheticImagePng(80, 80, "a");
}

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}
