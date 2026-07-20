import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { deflateSync } from "node:zlib";
import protobuf from "protobufjs";
import { fileURLToPath, pathToFileURL } from "node:url";

const scriptRoot = path.dirname(fileURLToPath(import.meta.url));
const experimentRoot = path.resolve(scriptRoot, "..");
const repoRoot = path.resolve(scriptRoot, "../../../../..");
const fixtureRoot = path.join(experimentRoot, ".runtime/fixture");
const p5FixtureRoot = path.join(fixtureRoot, "p5");
const protoPath = path.join(repoRoot, "proto/svga.proto");
const pngWriter = await import(pathToFileURL(path.join(repoRoot, "dist/utils/png-writer.js")).href);
const { createTransparentImage, encodeRgbaPng, setPixel } = pngWriter;

await mkdir(p5FixtureRoot, { recursive: true });

const sourceSvga = await createCanonicalSvga();
const pngFiles = new Map([
  ["img_frame.png", coloredPng(300, 300, [255, 0, 0, 255])],
  ["IMG_GLOW.png", coloredPng(64, 48, [0, 255, 0, 255])],
  ["img_badge.png", coloredPng(32, 32, [0, 0, 255, 255])],
  ["not_in_svga.png", coloredPng(12, 12, [255, 255, 0, 255])],
  ["iconalpha.png", coloredPng(24, 24, [0, 255, 255, 255])],
  ["IMG_FRAME.png", coloredPng(300, 300, [255, 0, 255, 255])],
  ["corrupt.png", Uint8Array.from([1, 2, 3])]
]);

await writeFile(path.join(fixtureRoot, "avatar-frame-smoke.svga"), sourceSvga);
for (const [fileName, bytes] of pngFiles) {
  await writeFile(path.join(p5FixtureRoot, fileName), bytes);
}

const manifest = {
  schemaVersion: 1,
  milestoneId: "P5",
  fixtureId: "p5-canonical-batch-runtime",
  sourceFile: "avatar-frame-smoke.svga",
  sourceSha256: sha256(sourceSvga),
  resources: [
    { resourceKey: "img_frame", width: 300, height: 300, usageCount: 1 },
    { resourceKey: "img_glow", width: 48, height: 48, usageCount: 1 },
    { resourceKey: "img_badge", width: 32, height: 32, usageCount: 1 },
    { resourceKey: "IconAlpha", width: 24, height: 24, usageCount: 1 },
    { resourceKey: "ICONALPHA", width: 24, height: 24, usageCount: 1 },
    { resourceKey: "img_untouched", width: 16, height: 16, usageCount: 0 }
  ],
  batchInputs: [...pngFiles].map(([fileName, bytes]) => ({
    fileName,
    sizeBytes: bytes.byteLength,
    sha256: sha256(bytes)
  })),
  generatedAt: "stable-p5-runtime-fixture"
};
await writeFile(path.join(p5FixtureRoot, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);

console.log(JSON.stringify({
  milestoneId: "P5",
  fixture: "avatar-frame-smoke.svga",
  sourceSha256: manifest.sourceSha256,
  batchInputCount: manifest.batchInputs.length
}, null, 2));

async function createCanonicalSvga() {
  const root = await protobuf.load(protoPath);
  const MovieEntity = root.lookupType("com.opensource.svga.MovieEntity");
  const payload = {
    version: "2.0",
    params: {
      viewBoxWidth: 300,
      viewBoxHeight: 300,
      fps: 24,
      frames: 72
    },
    images: {
      img_frame: coloredPng(300, 300, [180, 120, 40, 255]),
      img_glow: coloredPng(48, 48, [255, 230, 120, 200]),
      img_badge: coloredPng(32, 32, [40, 120, 255, 255]),
      IconAlpha: coloredPng(24, 24, [120, 255, 180, 255]),
      ICONALPHA: coloredPng(24, 24, [255, 120, 180, 255]),
      img_untouched: coloredPng(16, 16, [120, 120, 120, 255])
    },
    sprites: [
      { imageKey: "img_frame", frames: frames(72) },
      { imageKey: "img_glow", matteKey: "img_frame", frames: frames(72) },
      { imageKey: "img_badge", frames: frames(72) },
      { imageKey: "IconAlpha", frames: frames(72) },
      { imageKey: "ICONALPHA", frames: frames(72) }
    ],
    audios: []
  };
  const verificationError = MovieEntity.verify(payload);
  if (verificationError) throw new Error(verificationError);
  return deflateSync(MovieEntity.encode(MovieEntity.create(payload)).finish());
}

function frames(count) {
  return Array.from({ length: count }, (_, index) => ({
    alpha: index % 2 === 0 ? 1 : 0.85,
    layout: { x: 0, y: 0, width: 300, height: 300 },
    transform: { a: 1, b: 0, c: 0, d: 1, tx: 0, ty: 0 },
    clipPath: "",
    shapes: []
  }));
}

function coloredPng(width, height, rgba) {
  const image = createTransparentImage(width, height);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      setPixel(image, x, y, rgba);
    }
  }
  return encodeRgbaPng(image);
}

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}
