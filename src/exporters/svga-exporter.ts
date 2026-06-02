import { deflateSync, inflateSync } from "node:zlib";
import { access, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import protobuf from "protobufjs";
import { readJsonFile } from "../utils/fs.js";
import type { Exporter, ExportResult } from "./exporter.js";
import type { AvatarFrameProject, Keyframe, LayerTransform } from "../types/project.js";
import type { SvgaMap, SvgaSpriteMap } from "../core/svga-map-builder.js";

export interface SvgaExportValidation {
  exists: boolean;
  inflated: boolean;
  decoded: boolean;
  imageCount: number;
  spriteCount: number;
  frameCount: number;
}

export interface SvgaExportResult extends ExportResult {
  format: "svga";
  outputPath: string;
  fileSizeBytes: number;
  validation: SvgaExportValidation;
  warnings: string[];
}

interface InterpolatedTransform extends LayerTransform {
  width: number;
  height: number;
}

export class SvgaExporter implements Exporter {
  async export(project: AvatarFrameProject, outputDir: string): Promise<SvgaExportResult> {
    const mapPath = path.join(outputDir, "svga-map.json");
    const protoPath = path.resolve("proto/svga.proto");
    const svgaMap = await readJsonFile<SvgaMap>(mapPath);
    await validateExportInputs(project, svgaMap, outputDir);

    const root = await protobuf.load(protoPath);
    const MovieEntity = root.lookupType("com.opensource.svga.MovieEntity");
    const imageEntries = await loadImages(svgaMap, outputDir);
    const sprites = svgaMap.sprites.map((sprite) => buildSprite(sprite, imageEntries.imageKeys, svgaMap.durationFrames));
    const moviePayload = {
      version: "2.0",
      params: {
        viewBoxWidth: svgaMap.canvas.width,
        viewBoxHeight: svgaMap.canvas.height,
        fps: svgaMap.fps,
        frames: svgaMap.durationFrames
      },
      images: imageEntries.images,
      sprites,
      audios: []
    };
    const verificationError = MovieEntity.verify(moviePayload);
    if (verificationError) {
      throw new Error(`MovieEntity verification failed: ${verificationError}`);
    }

    const encoded = MovieEntity.encode(MovieEntity.create(moviePayload)).finish();
    const compressed = deflateSync(encoded);
    const outputPath = path.join(outputDir, `${project.projectId}.svga`);
    await writeFile(outputPath, compressed);
    const validation = await validateSvgaOutput(outputPath, MovieEntity);

    return {
      format: "svga",
      outputPath,
      fileSizeBytes: (await stat(outputPath)).size,
      validation,
      warnings: ["Project easing values are currently linearized during SVGA protobuf export."]
    };
  }
}

async function validateExportInputs(project: AvatarFrameProject, svgaMap: SvgaMap, outputDir: string): Promise<void> {
  if (project.schemaVersion !== "0.4.0" || svgaMap.schemaVersion !== "0.4.0") {
    throw new Error("SVGA export requires project.json and svga-map.json schemaVersion 0.4.0.");
  }

  if (svgaMap.durationFrames !== project.durationFrames || svgaMap.fps !== project.fps) {
    throw new Error("svga-map.json timeline does not match project.json.");
  }

  for (const sprite of svgaMap.sprites) {
    if (!sprite.exportAssetPath) {
      throw new Error(`Sprite ${sprite.spriteId} is missing exportAssetPath.`);
    }
    const assetPath = path.join(outputDir, sprite.exportAssetPath);
    await access(assetPath).catch(() => {
      throw new Error(`Sprite ${sprite.spriteId} export asset does not exist: ${sprite.exportAssetPath}`);
    });
  }
}

async function loadImages(
  svgaMap: SvgaMap,
  outputDir: string
): Promise<{ images: Record<string, Buffer>; imageKeys: Map<string, string> }> {
  const images: Record<string, Buffer> = {};
  const imageKeys = new Map<string, string>();
  const uniquePaths = [...new Set(svgaMap.sprites.map((sprite) => sprite.exportAssetPath))];

  uniquePaths.forEach((assetPath, index) => {
    imageKeys.set(assetPath, `img_${index}`);
  });

  for (const assetPath of uniquePaths) {
    const key = imageKeys.get(assetPath);
    if (!key) {
      continue;
    }
    images[key] = await readFile(path.join(outputDir, assetPath));
  }

  return { images, imageKeys };
}

function buildSprite(sprite: SvgaSpriteMap, imageKeys: Map<string, string>, durationFrames: number): unknown {
  const imageKey = imageKeys.get(sprite.exportAssetPath);
  if (!imageKey) {
    throw new Error(`No imageKey found for sprite asset: ${sprite.exportAssetPath}`);
  }

  return {
    imageKey,
    frames: Array.from({ length: durationFrames }, (_, frame) => buildFrame(sprite, frame))
  };
}

function buildFrame(sprite: SvgaSpriteMap, frame: number): unknown {
  const transform = transformAtFrame(sprite, frame);
  const matrix = transformMatrix(transform);

  return {
    alpha: Math.max(0, Math.min(1, transform.opacity * sprite.fallbackOpacityMultiplier)),
    layout: {
      x: 0,
      y: 0,
      width: transform.width,
      height: transform.height
    },
    transform: matrix,
    clipPath: "",
    shapes: []
  };
}

function transformAtFrame(sprite: SvgaSpriteMap, frame: number): InterpolatedTransform {
  const base: InterpolatedTransform = {
    ...sprite.transform,
    width: sprite.width,
    height: sprite.height
  };
  const keyframes = [...sprite.keyframes].sort((a, b) => a.frame - b.frame);

  if (keyframes.length === 0) {
    return base;
  }
  if (frame <= keyframes[0].frame) {
    return mergeKeyframe(base, keyframes[0]);
  }
  if (frame >= keyframes[keyframes.length - 1].frame) {
    return mergeKeyframe(base, keyframes[keyframes.length - 1]);
  }

  const nextIndex = keyframes.findIndex((keyframe) => keyframe.frame >= frame);
  const previous = keyframes[nextIndex - 1];
  const next = keyframes[nextIndex];
  const t = (frame - previous.frame) / Math.max(1, next.frame - previous.frame);
  const merged = { ...base };

  for (const key of ["x", "y", "scaleX", "scaleY", "rotation", "opacity"] as const) {
    const a = previous[key] ?? base[key];
    const b = next[key] ?? base[key];
    merged[key] = a + (b - a) * t;
  }

  return merged;
}

function mergeKeyframe(base: InterpolatedTransform, keyframe: Keyframe): InterpolatedTransform {
  return {
    ...base,
    ...Object.fromEntries(
      (["x", "y", "scaleX", "scaleY", "rotation", "opacity"] as const)
        .filter((key) => typeof keyframe[key] === "number")
        .map((key) => [key, keyframe[key]])
    )
  };
}

function transformMatrix(transform: InterpolatedTransform): { a: number; b: number; c: number; d: number; tx: number; ty: number } {
  const radians = (transform.rotation / 180) * Math.PI;
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);
  const a = cos * transform.scaleX;
  const b = sin * transform.scaleX;
  const c = -sin * transform.scaleY;
  const d = cos * transform.scaleY;
  const anchorX = transform.width / 2;
  const anchorY = transform.height / 2;

  return {
    a,
    b,
    c,
    d,
    tx: transform.x - (a * anchorX + c * anchorY),
    ty: transform.y - (b * anchorX + d * anchorY)
  };
}

async function validateSvgaOutput(outputPath: string, MovieEntity: protobuf.Type): Promise<SvgaExportValidation> {
  const exists = await access(outputPath).then(() => true, () => false);
  if (!exists) {
    return { exists: false, inflated: false, decoded: false, imageCount: 0, spriteCount: 0, frameCount: 0 };
  }

  const compressed = await readFile(outputPath);
  const inflated = inflateSync(compressed);
  const decoded = MovieEntity.decode(inflated) as protobuf.Message & {
    params?: { frames?: number };
    images?: Record<string, Uint8Array>;
    sprites?: Array<{ frames?: unknown[] }>;
  };
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
