import { fileURLToPath } from "node:url";
import { inflateSync } from "node:zlib";
import protobuf from "protobufjs";
import type {
  SvgaBinaryInspector,
  SvgaImageInspection,
  SvgaMovieInspection,
  SvgaSpriteInspection
} from "./types.js";

interface DecodedMovie {
  version?: string;
  params?: {
    viewBoxWidth?: number;
    viewBoxHeight?: number;
    fps?: number;
    frames?: number;
  };
  images?: Record<string, number[]>;
  sprites?: Array<{
    imageKey?: string;
    matteKey?: string;
    frames?: unknown[];
  }>;
  audios?: unknown[];
}

export class NodeProtobufSvgaInspector implements SvgaBinaryInspector {
  private movieEntityPromise?: Promise<protobuf.Type>;

  constructor(
    private readonly protoPath = fileURLToPath(new URL("../../../proto/svga.proto", import.meta.url))
  ) {}

  async inspect(bytes: Uint8Array): Promise<SvgaMovieInspection> {
    const MovieEntity = await this.loadMovieEntity();
    const inflated = inflateSync(bytes);
    const decoded = MovieEntity.decode(inflated);
    const movie = MovieEntity.toObject(decoded, {
      bytes: Array,
      defaults: true
    }) as DecodedMovie;

    if (!movie.params || !movie.images || !movie.sprites) {
      throw new Error("SVGA MovieEntity is missing params, images, or sprites.");
    }

    const images: SvgaImageInspection[] = Object.entries(movie.images).map(([imageKey, imageBytes]) => ({
      imageKey,
      bytes: Uint8Array.from(imageBytes)
    }));
    const sprites: SvgaSpriteInspection[] = movie.sprites.map((sprite, index) => ({
      index,
      imageKey: sprite.imageKey ?? "",
      matteKey: sprite.matteKey ?? "",
      frameCount: sprite.frames?.length ?? 0
    }));

    return {
      version: movie.version ?? "",
      params: {
        viewBoxWidth: movie.params.viewBoxWidth ?? 0,
        viewBoxHeight: movie.params.viewBoxHeight ?? 0,
        fps: movie.params.fps ?? 0,
        frames: movie.params.frames ?? 0
      },
      images,
      sprites,
      audioCount: movie.audios?.length ?? 0
    };
  }

  private loadMovieEntity(): Promise<protobuf.Type> {
    this.movieEntityPromise ??= protobuf.load(this.protoPath)
      .then((root) => root.lookupType("com.opensource.svga.MovieEntity"));
    return this.movieEntityPromise;
  }
}
