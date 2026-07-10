import type { FormatCapabilityProfile, MotionFormat } from "./contracts.js";

export const MOTION_FORMATS = [
  "svga",
  "vap",
  "lottie",
  "animated_webp",
  "webm",
  "apng",
  "sprite_sequence"
] as const satisfies readonly MotionFormat[];

export const FORMAT_CAPABILITY_BASELINES = [
  {
    format: "svga",
    assessments: [
      { capability: "playback", maturity: "current", boundary: "Existing Web validation player; desktop bundling is not implemented." },
      { capability: "parse", maturity: "current", boundary: "MovieEntity protobuf metadata and resources." },
      { capability: "replaceable_content", maturity: "partial", boundary: "Image keys can be inspected; product replacement workflow is not implemented." },
      { capability: "convert", maturity: "partial", boundary: "Avatar-frame project can export to SVGA; generic conversion is not implemented." },
      { capability: "export", maturity: "current", boundary: "Avatar-frame MVP image layers only." },
      { capability: "spec_check", maturity: "partial", boundary: "Existing report and validation checks are SVGA-specific." },
      { capability: "performance_check", maturity: "partial", boundary: "Decoded image memory is estimated; runtime profiling is manual." }
    ]
  },
  {
    format: "vap",
    assessments: [
      { capability: "playback", maturity: "research", boundary: "Hidden 0.2 runtime decision and dependency-free preparation contracts only; no integrated player, runtime dependency, visible UI, or support claim." },
      { capability: "parse", maturity: "partial", boundary: "Hidden 0.2 VAP MP4/vapc inspection readiness only; no playback, UI, production support, or runtime dependency." },
      { capability: "replaceable_content", maturity: "research", boundary: "Fusion/resource replacement semantics require format study." },
      { capability: "convert", maturity: "planned", boundary: "Requires frame-sequence intermediate and encoder decision." },
      { capability: "export", maturity: "research", boundary: "No approved encoder toolchain." },
      { capability: "spec_check", maturity: "planned", boundary: "Platform limits are not encoded." },
      { capability: "performance_check", maturity: "planned", boundary: "Hardware decode metrics need a client host." }
    ]
  },
  {
    format: "lottie",
    assessments: [
      { capability: "playback", maturity: "partial", boundary: "Hidden 0.2-WP2B SVG adapter spike only; no visible UI, external assets, production support, or 0.1 entry." },
      { capability: "parse", maturity: "partial", boundary: "Built-in JSON inspection normalizes metadata only; no renderer, playback, asset loading, or production support." },
      { capability: "replaceable_content", maturity: "research", boundary: "Replacement support varies by renderer and asset type." },
      { capability: "convert", maturity: "planned", boundary: "Vector semantics cannot be preserved through a raster-only intermediate." },
      { capability: "export", maturity: "unsupported", boundary: "No authoring/export scope in the current product." },
      { capability: "spec_check", maturity: "planned", boundary: "Feature compatibility checks require a Lottie feature model." },
      { capability: "performance_check", maturity: "planned", boundary: "Renderer and DOM/canvas mode must be measured separately." }
    ]
  },
  {
    format: "animated_webp",
    assessments: [
      { capability: "playback", maturity: "planned", boundary: "Browser-native playback path is available but not integrated." },
      { capability: "parse", maturity: "planned", boundary: "Animation frame metadata parser required." },
      { capability: "replaceable_content", maturity: "unsupported", boundary: "Flattened raster animation has no semantic replaceable layers." },
      { capability: "convert", maturity: "planned", boundary: "Frame-sequence encoding candidate required." },
      { capability: "export", maturity: "planned", boundary: "No approved encoder implementation." },
      { capability: "spec_check", maturity: "planned", boundary: "Dimensions, duration, alpha, and file-size checks." },
      { capability: "performance_check", maturity: "planned", boundary: "Decoded frame memory and browser decode timing." }
    ]
  },
  {
    format: "webm",
    assessments: [
      { capability: "playback", maturity: "partial", boundary: "Reference video playback exists in the Web validation tool." },
      { capability: "parse", maturity: "planned", boundary: "Container metadata currently comes from HTMLVideoElement only." },
      { capability: "replaceable_content", maturity: "unsupported", boundary: "Flattened video has no semantic replaceable layers." },
      { capability: "convert", maturity: "partial", boundary: "Preview export shells out to system FFmpeg." },
      { capability: "export", maturity: "partial", boundary: "System FFmpeg is optional and not client-ready." },
      { capability: "spec_check", maturity: "planned", boundary: "Codec, alpha, dimensions, duration, and bitrate checks." },
      { capability: "performance_check", maturity: "planned", boundary: "Hardware decode and dropped-frame metrics need a client host." }
    ]
  },
  {
    format: "apng",
    assessments: [
      { capability: "playback", maturity: "planned", boundary: "Browser-native playback path is available but not integrated." },
      { capability: "parse", maturity: "planned", boundary: "Chunk and frame-control parser required." },
      { capability: "replaceable_content", maturity: "unsupported", boundary: "Flattened raster animation has no semantic replaceable layers." },
      { capability: "convert", maturity: "planned", boundary: "Frame-sequence encoding candidate required." },
      { capability: "export", maturity: "planned", boundary: "No approved encoder implementation." },
      { capability: "spec_check", maturity: "planned", boundary: "Dimensions, frame timing, alpha, and file-size checks." },
      { capability: "performance_check", maturity: "planned", boundary: "Decoded frame memory and browser decode timing." }
    ]
  },
  {
    format: "sprite_sequence",
    assessments: [
      { capability: "playback", maturity: "planned", boundary: "Canvas/ImageBitmap playback adapter required." },
      { capability: "parse", maturity: "planned", boundary: "Manifest and filename-order conventions must be defined." },
      { capability: "replaceable_content", maturity: "unsupported", boundary: "Frames are flattened unless a separate composition manifest is supplied." },
      { capability: "convert", maturity: "planned", boundary: "Proposed lossless interchange for raster formats." },
      { capability: "export", maturity: "planned", boundary: "PNG frames plus manifest only; no implementation yet." },
      { capability: "spec_check", maturity: "planned", boundary: "Frame consistency, dimensions, timing, and total size." },
      { capability: "performance_check", maturity: "planned", boundary: "Peak decoded frame cache and upload cost." }
    ]
  }
] as const satisfies readonly FormatCapabilityProfile[];
