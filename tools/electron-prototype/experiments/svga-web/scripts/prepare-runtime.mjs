import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import { deflateSync } from "node:zlib";
import { chmod, cp, mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import { fileURLToPath, pathToFileURL } from "node:url";
import protobuf from "protobufjs";

const experimentRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const prototypeRoot = path.resolve(experimentRoot, "../..");
const repoRoot = path.resolve(experimentRoot, "../../../..");
const runtimeRoot = path.join(experimentRoot, ".runtime");
const execFileAsync = promisify(execFile);
const nativePickerHelperSourcePath = path.join(experimentRoot, "native/macos/AutoSvgaOpenPanel.swift");
const nativePickerHelperInfoPlistSourcePath = path.join(experimentRoot, "native/macos/AutoSvgaOpenPanel.Info.plist");
const nativePickerHelperBundleRuntimePath = path.join(runtimeRoot, "native/Auto SVGA File Picker.app");
const nativePickerHelperInfoPlistRuntimePath = path.join(nativePickerHelperBundleRuntimePath, "Contents/Info.plist");
const nativePickerHelperRuntimePath = path.join(nativePickerHelperBundleRuntimePath, "Contents/MacOS/asv-open-panel");
const webBaselineFixturePath = path.join(repoRoot, "examples/avatar_frame_basic/output/avatar_frame_basic.svga");
const expectedVendorHashes = new Map([
  ["svga-web-2.4.4.js", "6235bc9802e76dd517343123ec730d25e02c4d476b66b81ef26befe7881f3c50"]
]);
const expectedLegacyVendorHashes = new Map([
  ["pako-2.1.0.min.js", "ede2693a4a6a5126b9d35669062b358ecab6ae7b9b86a1cf302feb45a8514907"]
]);
const runtimeNodeDependencies = [
  "protobufjs",
  "long",
  "fast-png",
  "fflate",
  "iobuffer",
  "lottie-web",
  "video-animation-player"
];

await verifyVendorAssets();
await verifyLegacyVendorAssets();
await rm(runtimeRoot, { recursive: true, force: true });
await mkdir(runtimeRoot, { recursive: true });
await cp(path.join(prototypeRoot, ".runtime/dist"), path.join(runtimeRoot, "dist"), { recursive: true });
await pruneRuntimeDist(path.join(runtimeRoot, "dist"));
await cp(path.join(prototypeRoot, ".runtime/tools"), path.join(runtimeRoot, "tools"), { recursive: true });
await cp(path.join(prototypeRoot, ".runtime/fixture"), path.join(runtimeRoot, "fixture"), { recursive: true });
await cp(path.join(prototypeRoot, ".runtime/proto"), path.join(runtimeRoot, "proto"), { recursive: true });
for (const packageName of runtimeNodeDependencies) {
  await copyRuntimeNodeDependency(packageName);
}
await mkdir(path.join(runtimeRoot, "legacy-vendor"), { recursive: true });
for (const name of expectedLegacyVendorHashes.keys()) {
  await cp(path.join(prototypeRoot, "vendor", name), path.join(runtimeRoot, "legacy-vendor", name));
}
await ensureWebBaselineFixture();
await cp(webBaselineFixturePath, path.join(runtimeRoot, "fixture/avatar-frame-smoke.svga"));
const nativePickerHelper = await prepareDarwinPickerHelper();
const optimizerReopenFixture = await createOptimizerReopenFixture();
const sequenceRepairFixture = await createSequenceRepairFixture();
const replaceableWorkflowFixture = await createReplaceableWorkflowFixture();
const replacementPreviewPng = await createReplacementPreviewPng();
await writeFile(path.join(runtimeRoot, "fixture/optimizer-reopen-smoke.svga"), optimizerReopenFixture);
await writeFile(path.join(runtimeRoot, "fixture/sequence-repair-smoke.svga"), sequenceRepairFixture);
await writeFile(path.join(runtimeRoot, "fixture/replaceable-workflow-smoke.svga"), replaceableWorkflowFixture);
await writeFile(path.join(runtimeRoot, "fixture/replacement-preview-green.png"), replacementPreviewPng);
await writeFile(path.join(runtimeRoot, "manifest.json"), JSON.stringify({
  runtime: "svga-web-strict-csp-spike",
  sourceRuntime: path.relative(experimentRoot, path.join(prototypeRoot, ".runtime")),
  fixtureSource: path.relative(repoRoot, webBaselineFixturePath),
  optimizerReopenFixture: "fixture/optimizer-reopen-smoke.svga",
  optimizerReopenFixtureSha256: createHash("sha256").update(optimizerReopenFixture).digest("hex"),
  sequenceRepairFixture: "fixture/sequence-repair-smoke.svga",
  sequenceRepairFixtureSha256: createHash("sha256").update(sequenceRepairFixture).digest("hex"),
  replaceableWorkflowFixture: "fixture/replaceable-workflow-smoke.svga",
  replaceableWorkflowFixtureSha256: createHash("sha256").update(replaceableWorkflowFixture).digest("hex"),
  replacementPreviewPng: "fixture/replacement-preview-green.png",
  replacementPreviewPngSha256: createHash("sha256").update(replacementPreviewPng).digest("hex"),
  runtimeDependencies: runtimeNodeDependencies.map((packageName) => `node_modules/${packageName}`),
  nativePickerHelper,
  vendor: "svga-web@2.4.4",
  strictCsp: true
}, null, 2));

console.log("svga-web strict-CSP experiment runtime prepared");

async function prepareDarwinPickerHelper() {
  await mkdir(path.dirname(nativePickerHelperRuntimePath), { recursive: true });
  await cp(nativePickerHelperInfoPlistSourcePath, nativePickerHelperInfoPlistRuntimePath);
  await execFileAsync("/usr/bin/xcrun", [
    "swiftc",
    "-O",
    "-framework",
    "AppKit",
    "-o",
    nativePickerHelperRuntimePath,
    nativePickerHelperSourcePath
  ], {
    cwd: experimentRoot,
    maxBuffer: 1024 * 1024
  });
  await chmod(nativePickerHelperRuntimePath, 0o755);
  const [sourceBytes, infoPlistBytes, executableBytes, executableStats] = await Promise.all([
    readFile(nativePickerHelperSourcePath),
    readFile(nativePickerHelperInfoPlistRuntimePath),
    readFile(nativePickerHelperRuntimePath),
    stat(nativePickerHelperRuntimePath)
  ]);
  if (!executableStats.isFile() || executableStats.size <= 0 || (executableStats.mode & 0o111) === 0) {
    throw new Error("macOS native picker helper is not one executable regular file");
  }
  return {
    source: "native/macos/AutoSvgaOpenPanel.swift",
    sourceSha256: createHash("sha256").update(sourceBytes).digest("hex"),
    infoPlistSource: "native/macos/AutoSvgaOpenPanel.Info.plist",
    infoPlistSha256: createHash("sha256").update(infoPlistBytes).digest("hex"),
    bundleIdentifier: "local.auto-svga.open-panel",
    bundleRuntimePath: "native/Auto SVGA File Picker.app",
    runtimePath: "native/Auto SVGA File Picker.app/Contents/MacOS/asv-open-panel",
    executableSha256: createHash("sha256").update(executableBytes).digest("hex"),
    sizeBytes: executableStats.size
  };
}

async function verifyVendorAssets() {
  for (const [name, expectedHash] of expectedVendorHashes) {
    const bytes = await readFile(path.join(experimentRoot, "vendor", name));
    const actualHash = createHash("sha256").update(bytes).digest("hex");
    if (actualHash !== expectedHash) throw new Error(`Vendor checksum mismatch: ${name}`);
    const source = bytes.toString("utf8");
    if (source.includes("eval(") || source.includes("Function(")) {
      throw new Error(`Vendor is not strict-CSP compatible: ${name}`);
    }
  }
}

async function pruneRuntimeDist(distRoot) {
  await rm(path.join(distRoot, "tests"), { recursive: true, force: true });
  await rm(path.join(distRoot, ".DS_Store"), { force: true });
}

async function verifyLegacyVendorAssets() {
  for (const [name, expectedHash] of expectedLegacyVendorHashes) {
    const bytes = await readFile(path.join(prototypeRoot, "vendor", name));
    const actualHash = createHash("sha256").update(bytes).digest("hex");
    if (actualHash !== expectedHash) throw new Error(`Legacy vendor checksum mismatch: ${name}`);
  }
}

async function copyRuntimeNodeDependency(packageName) {
  const packageRoot = await resolveRuntimeNodeDependency(packageName);
  await cp(
    packageRoot,
    path.join(runtimeRoot, "node_modules", packageName),
    { recursive: true }
  );
}

async function resolveRuntimeNodeDependency(packageName) {
  const candidates = [
    path.join(prototypeRoot, "node_modules", packageName),
    path.join(repoRoot, "node_modules", packageName)
  ];
  for (const candidate of candidates) {
    try {
      const packageJson = JSON.parse(await readFile(path.join(candidate, "package.json"), "utf8"));
      if (packageJson.name === packageName) return candidate;
    } catch {
      // Try the next declared runtime dependency source.
    }
  }
  throw new Error(`Runtime dependency is not installed for packaging: ${packageName}`);
}

async function ensureWebBaselineFixture() {
  try {
    const bytes = await readFile(webBaselineFixturePath);
    if (bytes.byteLength > 0) return;
  } catch {
    // Missing repository fixture is generated by the normal CLI export below.
  }
  await execFileAsync("node", ["dist/cli.js", "export", "examples/avatar_frame_basic"], {
    cwd: repoRoot,
    maxBuffer: 20 * 1024 * 1024
  });
  const bytes = await readFile(webBaselineFixturePath);
  if (bytes.byteLength <= 0) throw new Error("Web baseline SVGA fixture is empty.");
}

async function createOptimizerReopenFixture() {
  const root = await protobuf.load(path.join(runtimeRoot, "proto/svga.proto"));
  const MovieEntity = root.lookupType("com.opensource.svga.MovieEntity");
  const baseImage = await createOptimizerFixtureImage([224, 60, 70, 255]);
  const unusedImage = await createOptimizerFixtureImage([50, 130, 220, 255]);
  const payload = {
    version: "2.0",
    params: { viewBoxWidth: 96, viewBoxHeight: 96, fps: 24, frames: 8 },
    images: {
      img_base: baseImage,
      img_copy: baseImage,
      img_unused: unusedImage
    },
    sprites: [
      { imageKey: "img_base", frames: createOptimizerFixtureFrames(0) },
      { imageKey: "img_copy", frames: createOptimizerFixtureFrames(20) }
    ],
    audios: []
  };
  const verificationError = MovieEntity.verify(payload);
  if (verificationError) throw new Error(`Optimizer reopen fixture verification failed: ${verificationError}`);
  return deflateSync(MovieEntity.encode(MovieEntity.create(payload)).finish());
}

async function createOptimizerFixtureImage(rgba) {
  const { createTransparentImage, encodeRgbaPng } = await import(
    pathToFileURL(path.join(runtimeRoot, "dist/utils/png-writer.js")).href
  );
  const image = createTransparentImage(32, 32);
  for (let y = 0; y < image.height; y += 1) {
    for (let x = 0; x < image.width; x += 1) {
      const offset = (y * image.width + x) * 4;
      image.pixels[offset] = rgba[0];
      image.pixels[offset + 1] = rgba[1];
      image.pixels[offset + 2] = rgba[2];
      image.pixels[offset + 3] = rgba[3];
    }
  }
  return encodeRgbaPng(image);
}

function createOptimizerFixtureFrames(xOffset) {
  return Array.from({ length: 8 }, (_unused, frame) => ({
    alpha: 1,
    layout: { x: 0, y: 0, width: 32, height: 32 },
    transform: { a: 1, b: 0, c: 0, d: 1, tx: xOffset + frame, ty: 28 },
    clipPath: "",
    shapes: []
  }));
}

async function createSequenceRepairFixture() {
  const root = await protobuf.load(path.join(runtimeRoot, "proto/svga.proto"));
  const MovieEntity = root.lookupType("com.opensource.svga.MovieEntity");
  const imageKeys = Array.from({ length: 12 }, (_unused, index) => `seq_${String(index + 1).padStart(3, "0")}`);
  const backgroundImage = await createSequenceBackgroundImage();
  const images = Object.fromEntries(await Promise.all(imageKeys.map(async (imageKey, index) => [
    imageKey,
    index === imageKeys.length - 1
      ? await createSequenceSpeckImage()
      : await createSequenceFrameImage(index)
  ])));
  const payload = {
    version: "2.0",
    params: { viewBoxWidth: 220, viewBoxHeight: 220, fps: 24, frames: 30 },
    images: {
      bg_main: backgroundImage,
      ...images
    },
    sprites: [
      {
        imageKey: "bg_main",
        frames: createSequenceBackgroundFrames(30)
      },
      ...imageKeys.map((imageKey, index) => ({
        imageKey,
        frames: createSequenceFrames(30, [index * 2, index * 2 + 1])
      }))
    ],
    audios: []
  };
  const verificationError = MovieEntity.verify(payload);
  if (verificationError) throw new Error(`Sequence repair fixture verification failed: ${verificationError}`);
  return deflateSync(MovieEntity.encode(MovieEntity.create(payload)).finish());
}

async function createSequenceFrameImage(index) {
  const { createTransparentImage, encodeRgbaPng } = await import(
    pathToFileURL(path.join(runtimeRoot, "dist/utils/png-writer.js")).href
  );
  const image = createTransparentImage(180, 180);
  for (let y = 0; y < image.height; y += 1) {
    for (let x = 0; x < image.width; x += 1) {
      const offset = (y * image.width + x) * 4;
      image.pixels[offset] = (60 + index * 13 + x * 0.2) % 255;
      image.pixels[offset + 1] = (120 + index * 7 + y * 0.3) % 255;
      image.pixels[offset + 2] = (190 + index * 5) % 255;
      image.pixels[offset + 3] = 255;
    }
  }
  return encodeRgbaPng(image);
}

async function createSequenceBackgroundImage() {
  const { createTransparentImage, encodeRgbaPng } = await import(
    pathToFileURL(path.join(runtimeRoot, "dist/utils/png-writer.js")).href
  );
  const image = createTransparentImage(220, 220);
  for (let y = 0; y < image.height; y += 1) {
    for (let x = 0; x < image.width; x += 1) {
      const offset = (y * image.width + x) * 4;
      image.pixels[offset] = 22 + Math.round(x * 0.12);
      image.pixels[offset + 1] = 32 + Math.round(y * 0.12);
      image.pixels[offset + 2] = 48;
      image.pixels[offset + 3] = 255;
    }
  }
  return encodeRgbaPng(image);
}

async function createSequenceSpeckImage() {
  const { createTransparentImage, encodeRgbaPng, setPixel } = await import(
    pathToFileURL(path.join(runtimeRoot, "dist/utils/png-writer.js")).href
  );
  const image = createTransparentImage(180, 180);
  setPixel(image, 88, 90, [255, 255, 255, 255]);
  setPixel(image, 89, 90, [255, 255, 255, 255]);
  setPixel(image, 88, 91, [255, 255, 255, 255]);
  setPixel(image, 89, 91, [255, 255, 255, 255]);
  return encodeRgbaPng(image);
}

function createSequenceFrames(count, visibleIndices) {
  const visible = new Set(visibleIndices);
  return Array.from({ length: count }, (_unused, frameIndex) => ({
    alpha: visible.has(frameIndex) ? 1 : 0,
    layout: { x: 0, y: 0, width: 180, height: 180 },
    transform: { a: 1, b: 0, c: 0, d: 1, tx: 20, ty: 20 },
    clipPath: "",
    shapes: []
  }));
}

function createSequenceBackgroundFrames(count) {
  return Array.from({ length: count }, () => ({
    alpha: 1,
    layout: { x: 0, y: 0, width: 220, height: 220 },
    transform: { a: 1, b: 0, c: 0, d: 1, tx: 0, ty: 0 },
    clipPath: "",
    shapes: []
  }));
}

async function createReplaceableWorkflowFixture() {
  const root = await protobuf.load(path.join(runtimeRoot, "proto/svga.proto"));
  const MovieEntity = root.lookupType("com.opensource.svga.MovieEntity");
  const frameImage = await createSolidPng(56, 56, [185, 68, 214, 255]);
  const textAnchorImage = await createSolidPng(64, 20, [255, 255, 255, 1]);
  const matteConsumerImage = await createSolidPng(56, 56, [40, 48, 78, 220]);
  const payload = {
    version: "2.0",
    params: { viewBoxWidth: 128, viewBoxHeight: 128, fps: 24, frames: 12 },
    images: {
      profile_frame: frameImage,
      nickname_text: textAnchorImage,
      img_000: matteConsumerImage
    },
    sprites: [
      { imageKey: "profile_frame", frames: createReplaceableFixtureFrames(12, 36, 32) },
      { imageKey: "nickname_text", frames: createReplaceableFixtureFrames(12, 32, 78, 64, 20) },
      { imageKey: "img_000", frames: createReplaceableFixtureFrames(12, 38, 34) }
    ],
    audios: []
  };
  const verificationError = MovieEntity.verify(payload);
  if (verificationError) throw new Error(`Replaceable workflow fixture verification failed: ${verificationError}`);
  return deflateSync(MovieEntity.encode(MovieEntity.create(payload)).finish());
}

function createReplaceableFixtureFrames(count, tx, ty, width = 56, height = 56) {
  return Array.from({ length: count }, (_unused, frameIndex) => ({
    alpha: 1,
    layout: { x: 0, y: 0, width, height },
    transform: { a: 1, b: 0, c: 0, d: 1, tx: tx + Math.sin(frameIndex / 2) * 2, ty },
    clipPath: "",
    shapes: []
  }));
}

async function createReplacementPreviewPng() {
  return createSolidPng(56, 56, [44, 188, 98, 255]);
}

async function createSolidPng(width, height, rgba) {
  const { createTransparentImage, encodeRgbaPng } = await import(
    pathToFileURL(path.join(runtimeRoot, "dist/utils/png-writer.js")).href
  );
  const image = createTransparentImage(width, height);
  for (let y = 0; y < image.height; y += 1) {
    for (let x = 0; x < image.width; x += 1) {
      const offset = (y * image.width + x) * 4;
      image.pixels[offset] = rgba[0];
      image.pixels[offset + 1] = rgba[1];
      image.pixels[offset + 2] = rgba[2];
      image.pixels[offset + 3] = rgba[3];
    }
  }
  return encodeRgbaPng(image);
}
