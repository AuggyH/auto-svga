import { access, readFile, stat, writeFile } from "node:fs/promises";
import { deflateSync, inflateSync } from "node:zlib";
import path from "node:path";
import protobuf from "protobufjs";
import { decodeRgbaPng } from "../utils/png-reader.js";
import { ensureDir } from "../utils/fs.js";
import { ensureMvpGeneratedAssets } from "./generated-assets.js";
import { interpolateLayerAtFrame } from "./interpolation.js";
import type { AnchorConversion, MvpProject, MvpProjectLayer } from "./types.js";

export interface MvpLayerTransform {
  x: number;
  y: number;
  scaleX: number;
  scaleY: number;
  rotation: number;
  alpha: number;
}

export interface MvpTransformMatrix {
  a: number;
  b: number;
  c: number;
  d: number;
  tx: number;
  ty: number;
}

export interface MvpImageRegistryEntry {
  source: string;
  imageKey: string;
  bytes: Buffer;
  width: number;
  height: number;
}

export interface MvpSvgaExportValidation {
  exists: boolean;
  inflated: boolean;
  decoded: boolean;
  imageCount: number;
  spriteCount: number;
  frameCount: number;
}

export interface MvpSvgaExportResult {
  outputPath: string;
  relativeOutputPath: string;
  fileSizeBytes: number;
  imageCount: number;
  spriteCount: number;
  frameCount: number;
  layerMappings: Array<{
    projectLayerId: string;
    svgaSpriteId: string;
    svgaImageKey: string;
  }>;
  assetMappings: Array<{
    source: string;
    svgaImageKey: string;
  }>;
  validation: MvpSvgaExportValidation;
  warnings: string[];
}

interface MvpImageRegistry {
  entries: MvpImageRegistryEntry[];
  bySource: Map<string, MvpImageRegistryEntry>;
}

export async function exportMvpSvga(jobDir: string, project: MvpProject, outputName?: string): Promise<MvpSvgaExportResult> {
  const outputDir = path.join(jobDir, "output");
  await ensureDir(outputDir);
  const generatedAssets = await ensureMvpGeneratedAssets(jobDir, project);
  await validateLayerSources(jobDir, project);

  const root = await protobuf.load(path.resolve("proto/svga.proto"));
  const MovieEntity = root.lookupType("com.opensource.svga.MovieEntity");
  const imageRegistry = await buildMvpImageRegistry(jobDir, project);
  const sortedLayers = [...project.layers].sort((a, b) => a.zIndex - b.zIndex);
  const layerMappings: MvpSvgaExportResult["layerMappings"] = [];
  const sprites = sortedLayers.map((layer) => {
    const image = imageRegistry.bySource.get(layer.source);
    if (!image) {
      throw new Error(`No image registry entry found for layer source: ${layer.source}`);
    }
    const svgaSpriteId = `sprite_${sanitizeId(layer.id)}`;
    layerMappings.push({
      projectLayerId: layer.id,
      svgaSpriteId,
      svgaImageKey: image.imageKey
    });
    return {
      imageKey: image.imageKey,
      frames: Array.from({ length: project.frames }, (_, frame) => buildFrame(layer, image, frame))
    };
  });

  const moviePayload = {
    version: "2.0",
    params: {
      viewBoxWidth: project.canvas.width,
      viewBoxHeight: project.canvas.height,
      fps: project.fps,
      frames: project.frames
    },
    images: Object.fromEntries(imageRegistry.entries.map((entry) => [entry.imageKey, entry.bytes])),
    sprites,
    audios: []
  };

  const verificationError = MovieEntity.verify(moviePayload);
  if (verificationError) {
    throw new Error(`MovieEntity verification failed: ${verificationError}`);
  }

  const outputFileName = `${outputName ?? "avatar_frame_test_001"}.svga`;
  const outputPath = path.join(outputDir, outputFileName);
  const encoded = MovieEntity.encode(MovieEntity.create(moviePayload)).finish();
  await writeFile(outputPath, deflateSync(encoded));
  const validation = await validateMvpSvgaOutput(outputPath, MovieEntity);
  assertValidMvpSvgaOutput(validation, imageRegistry.entries.length, sprites.length, project.frames);

  return {
    outputPath,
    relativeOutputPath: `output/${outputFileName}`,
    fileSizeBytes: (await stat(outputPath)).size,
    imageCount: imageRegistry.entries.length,
    spriteCount: sprites.length,
    frameCount: project.frames,
    layerMappings,
    assetMappings: imageRegistry.entries.map((entry) => ({
      source: entry.source,
      svgaImageKey: entry.imageKey
    })),
    validation,
    warnings: [
      ...generatedAssets.warnings,
      "MVP SVGA export supports image layers only; masks, text, audio, shapes, and nested compositions are not exported."
    ]
  };
}

export async function buildMvpImageRegistry(jobDir: string, project: MvpProject): Promise<MvpImageRegistry> {
  const entries: MvpImageRegistryEntry[] = [];
  const bySource = new Map<string, MvpImageRegistryEntry>();
  const usedKeys = new Set<string>();

  for (const source of unique(project.layers.map((layer) => layer.source))) {
    const bytes = await readFile(path.join(jobDir, source));
    const decoded = decodeRgbaPng(bytes);
    const imageKey = uniqueImageKey(source, usedKeys);
    const entry = {
      source,
      imageKey,
      bytes,
      width: decoded.width,
      height: decoded.height
    };
    entries.push(entry);
    bySource.set(source, entry);
  }

  return { entries, bySource };
}

export function interpolateLayerTransform(layer: MvpProjectLayer, frame: number): MvpLayerTransform {
  return interpolateLayerAtFrame(layer, frame);
}

export function buildAnchorTransformMatrix(transform: MvpLayerTransform, anchor?: AnchorConversion): MvpTransformMatrix {
  const anchorX = anchor?.localX ?? 0;
  const anchorY = anchor?.localY ?? 0;
  const radians = (transform.rotation / 180) * Math.PI;
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);
  const a = cos * transform.scaleX;
  const b = sin * transform.scaleX;
  const c = -sin * transform.scaleY;
  const d = cos * transform.scaleY;

  return {
    a,
    b,
    c,
    d,
    tx: transform.x + anchorX - (a * anchorX + c * anchorY),
    ty: transform.y + anchorY - (b * anchorX + d * anchorY)
  };
}

export async function validateMvpSvgaOutput(outputPath: string, MovieEntity: protobuf.Type): Promise<MvpSvgaExportValidation> {
  const exists = await access(outputPath).then(() => true, () => false);
  if (!exists) {
    return { exists: false, inflated: false, decoded: false, imageCount: 0, spriteCount: 0, frameCount: 0 };
  }

  const inflated = inflateSync(await readFile(outputPath));
  const decoded = MovieEntity.decode(inflated);
  const decodedObject = MovieEntity.toObject(decoded, { bytes: Buffer }) as {
    params?: { frames?: number };
    images?: Record<string, Buffer>;
    sprites?: Array<{ frames?: unknown[] }>;
  };

  return {
    exists,
    inflated: inflated.length > 0,
    decoded: Boolean(decodedObject.params && decodedObject.images && decodedObject.sprites),
    imageCount: Object.keys(decodedObject.images ?? {}).length,
    spriteCount: decodedObject.sprites?.length ?? 0,
    frameCount: decodedObject.params?.frames ?? 0
  };
}

async function validateLayerSources(jobDir: string, project: MvpProject): Promise<void> {
  for (const layer of project.layers) {
    const sourcePath = path.join(jobDir, layer.source);
    await access(sourcePath).catch(() => {
      throw new Error(`MVP SVGA export missing layer source for ${layer.id}: ${layer.source}`);
    });
  }
}

function buildFrame(layer: MvpProjectLayer, image: MvpImageRegistryEntry, frame: number): unknown {
  const transform = interpolateLayerTransform(layer, frame);
  return {
    alpha: Math.max(0, Math.min(1, transform.alpha)),
    layout: {
      x: 0,
      y: 0,
      width: image.width,
      height: image.height
    },
    transform: buildAnchorTransformMatrix(transform, layer.anchor),
    clipPath: "",
    shapes: []
  };
}

function assertValidMvpSvgaOutput(
  validation: MvpSvgaExportValidation,
  expectedImages: number,
  expectedSprites: number,
  expectedFrames: number
): void {
  if (!validation.exists || !validation.inflated || !validation.decoded) {
    throw new Error("MVP SVGA validation failed: output could not be inflated and decoded.");
  }
  if (validation.imageCount !== expectedImages) {
    throw new Error(`MVP SVGA validation failed: expected ${expectedImages} images, decoded ${validation.imageCount}.`);
  }
  if (validation.spriteCount !== expectedSprites) {
    throw new Error(`MVP SVGA validation failed: expected ${expectedSprites} sprites, decoded ${validation.spriteCount}.`);
  }
  if (validation.frameCount !== expectedFrames) {
    throw new Error(`MVP SVGA validation failed: expected ${expectedFrames} frames, decoded ${validation.frameCount}.`);
  }
}

function uniqueImageKey(source: string, usedKeys: Set<string>): string {
  const base = `img_${sanitizeId(path.basename(source, path.extname(source)))}`;
  let candidate = base;
  let index = 2;
  while (usedKeys.has(candidate)) {
    candidate = `${base}_${index}`;
    index += 1;
  }
  usedKeys.add(candidate);
  return candidate;
}

function sanitizeId(value: string): string {
  return value.replace(/[^a-zA-Z0-9_]+/g, "_").replace(/^_+|_+$/g, "");
}

function unique(values: string[]): string[] {
  return [...new Set(values)];
}
