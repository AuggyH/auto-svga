import path from "node:path";
import type { AvatarFrameProject, Keyframe, LayerTransform, ProjectLayer } from "../types/project.js";
import { writeJsonFile } from "../utils/fs.js";

export interface SvgaMap {
  schemaVersion: "0.4.0";
  version: "0.1.0";
  projectId: string;
  coordinateConvention: {
    transformXY: string;
    anchorXY: string;
    rotationAndScale: string;
  };
  canvas: {
    width: number;
    height: number;
  };
  fps: number;
  durationFrames: number;
  sweepMaskStrategy?: "baked_per_frame_fixed_alpha_mask";
  runtimeMaskUsed: boolean;
  sweepExportMode?: "baked_frame_sprites";
  bakedSweepOptimization?: {
    hashDeduplication: true;
    transparentFrameElision: true;
    frameLevelImageKeySupported: false;
    strategy: "reuse_identical_png_assets";
    frameStride?: number;
  };
  bakedSweepSprites: BakedSweepSpriteMap[];
  sprites: SvgaSpriteMap[];
}

export interface SvgaSpriteMap {
  spriteId: string;
  layerId: string;
  assetPath: string;
  exportAssetPath: string;
  width: number;
  height: number;
  zIndex: number;
  transform: LayerTransform;
  keyframes: Keyframe[];
  blendMode: ProjectLayer["blendMode"];
  fallbackBlendMode: ProjectLayer["fallbackBlendMode"];
  fallbackOpacityMultiplier: number;
  mask?: ProjectLayer["mask"];
  bakedMaskAssetPath?: string;
  maskStrategy: "none" | "baked_asset_preferred" | "baked_per_frame_fixed_alpha_mask";
  visibleFrameRange?: {
    start: number;
    end: number;
  };
  replaceable: boolean;
}

export interface BakedSweepSpriteMap {
  spriteId: string;
  frameIndex: number;
  sampledFrame: number;
  frameStride: number;
  exportAssetPath: string;
  imageHash: string;
  sharedAssetId: string;
  zIndex: number;
  visibleFrameRange: {
    start: number;
    end: number;
  };
  transform: LayerTransform;
}

export async function writeSvgaMap(project: AvatarFrameProject, outputDir: string): Promise<string> {
  const map = buildSvgaMap(project);
  const outputPath = path.join(outputDir, "svga-map.json");
  await writeJsonFile(outputPath, map);
  return outputPath;
}

export function buildSvgaMap(project: AvatarFrameProject): SvgaMap {
  const assetMap = new Map(project.assets.map((asset) => [asset.id, asset]));
  const animationMap = new Map(project.animations.map((animation) => [animation.targetLayerId, animation]));
  const bakedSweepLayers = project.layers.filter((layer) => layer.metadata?.sweepBakedFrame);

  return {
    schemaVersion: "0.4.0",
    version: "0.1.0",
    projectId: project.projectId,
    coordinateConvention: {
      transformXY: "layer.transform.x/y is the layer anchor position in canvas coordinates.",
      anchorXY: "layer.anchor.x/y is the anchor position in the layer local coordinate system.",
      rotationAndScale: "rotation and scale are applied around anchor."
    },
    canvas: project.canvas,
    fps: project.fps,
    durationFrames: project.durationFrames,
    sweepMaskStrategy: bakedSweepLayers.length > 0 ? "baked_per_frame_fixed_alpha_mask" : undefined,
    runtimeMaskUsed: project.layers.some((layer) => Boolean(layer.mask)),
    sweepExportMode: bakedSweepLayers.length > 0 ? "baked_frame_sprites" : undefined,
    bakedSweepOptimization: bakedSweepLayers.length > 0
      ? {
        hashDeduplication: true,
        transparentFrameElision: true,
        frameLevelImageKeySupported: false,
        strategy: "reuse_identical_png_assets",
        frameStride: bakedSweepLayers[0]?.metadata?.sweepBakedFrame?.frameStride
      }
      : undefined,
    bakedSweepSprites: bakedSweepLayers.map((layer) => {
      const metadata = layer.metadata?.sweepBakedFrame;
      return {
        spriteId: `sprite_${layer.id}`,
        frameIndex: metadata?.frameIndex ?? 0,
        sampledFrame: metadata?.sampledFrame ?? metadata?.frameIndex ?? 0,
        frameStride: metadata?.frameStride ?? 1,
        exportAssetPath: metadata?.exportAssetPath ?? assetMap.get(layer.assetId)?.path ?? "",
        imageHash: metadata?.imageHash ?? assetMap.get(layer.assetId)?.sha256 ?? "",
        sharedAssetId: metadata?.sharedAssetId ?? layer.assetId,
        zIndex: layer.zIndex,
        visibleFrameRange: metadata?.visibleFrameRange ?? { start: 0, end: 0 },
        transform: layer.transform
      };
    }),
    sprites: project.layers.map((layer) => {
      const asset = assetMap.get(layer.assetId);
      const animation = animationMap.get(layer.id);
      const bakedMaskAssetPath = bakedMaskAssetPathFor(layer, assetMap);
      const visibleFrameRange = layer.metadata?.sweepBakedFrame?.visibleFrameRange;
      return {
        spriteId: `sprite_${layer.id}`,
        layerId: layer.id,
        assetPath: asset?.path ?? "",
        exportAssetPath: bakedMaskAssetPath ?? asset?.path ?? "",
        width: asset?.width ?? 0,
        height: asset?.height ?? 0,
        zIndex: layer.zIndex,
        transform: layer.transform,
        keyframes: animation?.keyframes ?? [],
        blendMode: layer.blendMode,
        fallbackBlendMode: layer.fallbackBlendMode,
        fallbackOpacityMultiplier: layer.fallbackOpacityMultiplier,
        mask: layer.mask,
        bakedMaskAssetPath,
        maskStrategy: layer.metadata?.sweepBakedFrame
          ? "baked_per_frame_fixed_alpha_mask"
          : bakedMaskAssetPath
            ? "baked_asset_preferred"
            : "none",
        visibleFrameRange,
        replaceable: false
      };
    })
  };
}

function bakedMaskAssetPathFor(layer: ProjectLayer, assetMap: Map<string, { path: string }>): string | undefined {
  if (!layer.mask) {
    return undefined;
  }
  return assetMap.get(`${layer.assetId}_masked`)?.path;
}
