export interface SvgaMovieParamsInspection {
  viewBoxWidth: number;
  viewBoxHeight: number;
  fps: number;
  frames: number;
}

export interface SvgaImageInspection {
  imageKey: string;
  bytes: Uint8Array;
}

export interface SvgaSpriteInspection {
  index: number;
  imageKey: string;
  matteKey: string;
  frameCount: number;
}

export interface SvgaMovieInspection {
  version: string;
  params: SvgaMovieParamsInspection;
  images: readonly SvgaImageInspection[];
  sprites: readonly SvgaSpriteInspection[];
  audioCount: number;
}

export interface SvgaBinaryInspector {
  inspect(bytes: Uint8Array): Promise<SvgaMovieInspection>;
}
