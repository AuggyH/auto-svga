import type {
  FormatAdapter,
  FormatProbeResult,
  MotionAssetInfo,
  MotionAssetSource,
  MotionLayerInfo,
  MotionResourceInfo,
  WorkbenchOperationContext,
  WorkbenchResult
} from "../contracts.js";
import type { EmbeddedImageAlphaAnalyzer } from "../image-alpha-analyzer.js";
import type { EmbeddedResourceHasher } from "../resource-hasher.js";
import { isReplaceableImageResource } from "../short-term-product-model.js";
import { readEmbeddedImageMetadata } from "./image-metadata.js";
import { classifySvgaResources } from "./resource-classifier.js";
import type { SvgaBinaryInspector, SvgaMovieInspection } from "./types.js";

export class SvgaFormatAdapter implements FormatAdapter {
  readonly format = "svga" as const;

  constructor(
    private readonly inspector: SvgaBinaryInspector,
    private readonly alphaAnalyzer?: EmbeddedImageAlphaAnalyzer,
    private readonly resourceHasher?: EmbeddedResourceHasher
  ) {}

  async probe(source: MotionAssetSource, context?: WorkbenchOperationContext): Promise<FormatProbeResult> {
    try {
      context?.cancellation?.throwIfCancelled();
      const bytes = await source.read();
      context?.cancellation?.throwIfCancelled();
      await this.inspector.inspect(bytes);
      return { format: "svga", confidence: 1, issues: [] };
    } catch (error) {
      return {
        confidence: 0,
        issues: [{
          severity: "error",
          code: "svga_probe_failed",
          message: errorMessage(error)
        }]
      };
    }
  }

  async parse(
    source: MotionAssetSource,
    context?: WorkbenchOperationContext
  ): Promise<WorkbenchResult<MotionAssetInfo>> {
    try {
      context?.cancellation?.throwIfCancelled();
      context?.onProgress?.({ phase: "read", completed: 0, total: 1 });
      const bytes = await source.read();
      context?.onProgress?.({ phase: "read", completed: 1, total: 1 });
      context?.cancellation?.throwIfCancelled();
      context?.onProgress?.({ phase: "decode", completed: 0, total: 1 });
      const movie = await this.inspector.inspect(bytes);
      context?.onProgress?.({ phase: "decode", completed: 1, total: 1 });
      context?.cancellation?.throwIfCancelled();

      return {
        value: await toMotionAssetInfo(
          source,
          movie,
          this.alphaAnalyzer,
          this.resourceHasher
        ),
        issues: []
      };
    } catch (error) {
      return {
        issues: [{
          severity: "error",
          code: "svga_parse_failed",
          message: errorMessage(error)
        }]
      };
    }
  }
}

async function toMotionAssetInfo(
  source: MotionAssetSource,
  movie: SvgaMovieInspection,
  alphaAnalyzer?: EmbeddedImageAlphaAnalyzer,
  resourceHasher?: EmbeddedResourceHasher
): Promise<MotionAssetInfo> {
  const { params } = movie;
  const durationMs = params.fps > 0 ? (params.frames / params.fps) * 1000 : undefined;
  const imagesWithMetadata = movie.images.map((image) => ({
    ...image,
    imageMetadata: readEmbeddedImageMetadata(image.bytes)
  }));
  const classifications = classifySvgaResources({
    images: imagesWithMetadata.map(({ imageMetadata, ...image }) => ({
      ...image,
      dimensions: imageMetadata.dimensions
    })),
    sprites: movie.sprites
  });
  const resources: MotionResourceInfo[] = await Promise.all(imagesWithMetadata.map(async (image) => {
    const classification = classifications.get(image.imageKey);
    const role = classification?.role ?? "unknown";
    let alphaBounds;
    let contentHash;
    if (alphaAnalyzer) {
      try {
        alphaBounds = await alphaAnalyzer.analyze({
          bytes: image.bytes,
          format: image.imageMetadata.format,
          dimensions: image.imageMetadata.dimensions
        });
      } catch {
        alphaBounds = { status: "unknown" as const };
      }
    }
    if (resourceHasher) {
      try {
        contentHash = await resourceHasher.hash(image.bytes);
      } catch {
        contentHash = undefined;
      }
    }
    return {
      id: image.imageKey,
      name: image.imageKey,
      kind: "image",
      role,
      replaceable: isReplaceableImageResource({
        kind: "image",
        name: image.imageKey,
        role
      }),
      sizeBytes: image.bytes.byteLength,
      dimensions: image.imageMetadata.dimensions,
      alphaBounds,
      contentHash,
      metadata: {
        imageKey: image.imageKey,
        imageFormat: image.imageMetadata.format,
        roleEvidence: classification?.evidence ?? ["insufficient_evidence"]
      }
    };
  }));
  const layers: MotionLayerInfo[] = movie.sprites.map((sprite) => ({
    id: `sprite_${sprite.index}`,
    name: sprite.imageKey || `sprite_${sprite.index}`,
    kind: "sprite",
    resourceIds: sprite.imageKey ? [sprite.imageKey] : [],
    metadata: {
      spriteIndex: sprite.index,
      imageKey: sprite.imageKey,
      matteKey: sprite.matteKey,
      frameCount: sprite.frameCount,
      frameAlphas: sprite.frameAlphas
    }
  }));

  return {
    format: "svga",
    name: source.name,
    sizeBytes: source.sizeBytes,
    dimensions: {
      width: params.viewBoxWidth,
      height: params.viewBoxHeight
    },
    timing: {
      fps: params.fps,
      frameCount: params.frames,
      durationMs
    },
    layers,
    resources,
    metadata: {
      sourceId: source.id,
      version: movie.version,
      imageCount: resources.length,
      spriteCount: layers.length,
      audioCount: movie.audioCount
    }
  };
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
