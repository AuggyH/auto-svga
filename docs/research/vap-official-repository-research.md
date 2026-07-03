# VAP Official Repository Research

Date: 2026-07-04
Owner role: Product / format research
Status: research input for future multi-format workbench planning

## Purpose

This note records the first-pass research on the official Tencent VAP
repository so future Auto SVGA work can continue from a stable baseline instead
of rediscovering the same format facts.

This document is not a PRD and does not change committed short-term or mid-term
scope. The project-level product authority remains
`docs/product/PRODUCT_ROADMAP.md`. Current architecture scope for VAP remains
Research in `docs/multiformat-workbench-architecture.md`.

## Official Project Snapshot

- Repository: <https://github.com/Tencent/vap>
- License: MIT, based on the repository license statement.
- Current upstream state: the README says the open-source repository has
  entered a stopped-maintenance state and will not continue updates.
- Supported playback references in the repository: Android, iOS, and Web.
- Official material tools:
  - VapTool Java tool for Windows and macOS.
  - Historical Mac VAPX tool.
  - Mac and Windows preview tools published through repository releases.

Implication for Auto SVGA: Tencent VAP is useful as a format and playback
reference, but should not be treated as a healthy long-term upstream dependency
without an explicit fork, compatibility, and redistribution plan.

## Format Model

VAP is closer to an MP4-based delivery container than to an editable layer
format like SVGA. The official introduction describes the core idea:

- H264 video frames do not carry alpha directly.
- VAP stores alpha data in an extra area of the decoded video frame.
- Runtime playback uses OpenGL/WebGL-style compositing to combine RGB and alpha
  into transparent output.
- The latest VAP layout can shrink the alpha area to reduce final video
  resolution and reserve room for fusion data.

VAP configuration is JSON stored inside an MP4 custom box named `vapc`
(`VAP Config`). The repository also emits `vapc.json` for Web-side use, but the
MP4 itself is intended to contain the playback configuration.

Important config fields observed in the official tool/player source:

| Config area | Important fields | Notes |
| --- | --- | --- |
| `info` | `v`, `f`, `w`, `h`, `videoW`, `videoH`, `orien`, `fps`, `isVapx`, `aFrame`, `rgbFrame` | Version, total frames, display size, actual video size, fps, fusion flag, alpha/RGB frame rectangles. |
| `src` | `srcId`, `srcType`, `loadType`, `srcTag`, `color`, `style`, `w`, `h`, `fitType` | Fusion source definitions for image/text placeholders. |
| `frame` | `i`, `obj[]` | Per-frame fusion placement. |
| `frame.obj[]` | `srcId`, `z`, `frame`, `mFrame`, `mt` | Draw order, output rectangle, mask rectangle, and mask rotation. |

Auto SVGA implication: a VAP parser should first target MP4 box inspection and
`vapc` JSON normalization, not a universal animation layer abstraction.

## Official Toolchain Findings

VapTool supports:

- codec selection: h264 and h265
- fps
- quality through bitrate or crf
- alpha scale, defaulting to 0.5
- input frame directory
- optional mp3 audio
- fusion mask information

Official output files:

- `video.mp4`: final VAP video
- `vapc.json`: Web-side config file, also encoded into the MP4 as `vapc`
- `md5.txt`: hash for output integrity checks
- `frames`: temporary generated images

Official frame input rule:

- video frames are named as fixed-width ascending numbers such as `000.png`,
  `001.png`, and so on
- the first frame must be `000.png`

Auto SVGA implication: VAP sequence import should validate naming, frame count,
dimensions, fps, audio presence, and config generation inputs before offering
preview or export.

## Fusion Animation Semantics

VAP fusion animation supports inserting dynamic images and text, such as user
avatar and user name, into a flattened video effect.

Official tool fields include:

- source tag: placeholder tag used at playback time to fetch matching content
- source type: image or text
- fit type: `fitXY` or proportional crop/fit behavior
- mask path
- text color
- text bold

Important mask rules from the official tool docs:

- mask frame naming follows the same numeric rule as video frames
- mask frame dimensions must match the video frame dimensions
- black marks the display area
- red marks the occlusion area
- fusion animation forces alpha scale to 0.5 because room must be reserved for
  mask data

Auto SVGA implication: VAP support needs a first-class Fusion Element model,
not a reuse of SVGA `imageKey` semantics. The model should preserve source tag,
type, fit type, mask path, frame mapping, z order, and text attributes.

## Resolution And Compatibility

The official FAQ treats 1504 as an empirical compatibility limit:

- If VAP output width or height exceeds 1504, some Android devices may show
  green screen or decode errors.
- The tool may still generate the output, but the FAQ says this is not
  recommended.
- The Mac tool doc also references 1504 as the maximum length used when laying
  out padding between source/mask regions.
- The tool aligns generated material dimensions to multiples of 16 for Android
  compatibility.

Auto SVGA implication: future VAP export should default to keeping output
`videoW` and `videoH` at or below 1504, align generated output to 16-pixel
boundaries, and expose the quality/size tradeoff when downscaling is required.

## Web Playback Notes

The official Web package expects:

- `src`: MP4 video URL
- `config`: config JSON object or URL
- `fps`
- `width` and `height`
- fusion parameters matching config tags
- optional `accurate` mode using `requestVideoFrameCallback` where supported

The Web implementation uses video and image/text textures in WebGL and custom
shader compositing.

Auto SVGA implication: an Electron/WebGL preview may need to extract `vapc`
from the local MP4 first, then pass the JSON into the Web renderer. Relying only
on an adjacent `vapc.json` would miss normal single-file VAP packages.

## Known Risks And Issue Evidence

Observed official or repository-adjacent risk areas:

| Area | Evidence | Product risk |
| --- | --- | --- |
| Upstream maintenance | README says the open-source repo has stopped maintenance. | Auto SVGA cannot rely on upstream fixes. |
| Over-1504 output | Official FAQ warns about green screen and decode failures on some Android devices. | Export should default to safe sizing and report risk. |
| MP4 mutation | FAQ says server-side MP4 changes can remove or corrupt the `vapc` box. | Inspector should verify `vapc` and optional md5 before playback/export claims. |
| Fusion fit/crop mismatch | Issue #276 reports Android fusion image stretching under centerCrop-like behavior when source dimensions differ from real bitmap dimensions. | Preview parity may differ by platform; fit calculations need deterministic tests. |
| Decoder alignment | Issues #291 and #408 report deformation/black shadow or alignWidth/alignHeight related playback problems on Android devices. | Playback validation needs device/decoder compatibility evidence. |
| Frame alignment | Web code can derive frame index from `requestVideoFrameCallback` or `currentTime * fps`. | Fusion jitter can come from frame-index drift in preview. |

The Owner-reported symptom "when an element passes through a fusion element,
the fusion layer jitters" was not found as a closed official issue in this
first pass. Based on the source and issues above, the likely investigation
order is:

1. Confirm mask frame dimensions exactly match video frame dimensions.
2. Confirm mask frame filenames map to the intended video frame indexes.
3. Compare `frame` and `mFrame` rectangles for 1-pixel oscillation caused by
   bounding-box extraction or integer rounding.
4. Check whether `fitXY` or proportional fit/crop is being used.
5. Check whether output dimensions are near 1504 or require decoder alignment.
6. Check whether playback frame indexing is driven by decoded frame count or
   by wall-clock/currentTime approximation.

## Recommended Auto SVGA Work Packages

These are research follow-ups, not committed scope changes.

| Work package | Goal | Exit criteria |
| --- | --- | --- |
| VAP-WP0 fixtures and compatibility brief | Collect safe synthetic VAP fixtures, one fusion fixture, and one over-limit fixture. | Fixtures documented without committing production assets; risk matrix drafted. |
| VAP-WP1 container inspector | Parse MP4 boxes, locate `vapc`, parse JSON, expose normalized metadata. | Inspector reports fps, frame count, display size, video size, alpha/RGB rectangles, fusion sources, frame coverage, and missing/corrupt config errors. |
| VAP-WP2 sequence-folder analyzer | Analyze frame folders and mask subfolders before generation. | Validates naming, first frame, count, dimensions, mask/video alignment, and inferred fusion tags. |
| VAP-WP3 preview spike | Evaluate WebGL preview from local MP4 plus extracted `vapc`. | Playback and fusion preview work for local test fixtures with failure states. |
| VAP-WP4 generator strategy | Decide whether to wrap official tools, fork/reimplement packaging, or use a new local encoder path. | ADR covers ffmpeg/mp4edit licensing, Java/tool dependency, platform support, output validation, and rollback. |
| VAP-WP5 production spec profile | Define VAP-specific output rules. | Profile includes 1504 limit, 16-pixel alignment, audio handling, alpha scale, fusion constraints, md5, and error messages. |

## Product Boundary Recommendation

VAP should remain outside short-term SVGA scope. If Product Owner promotes VAP
from long-term candidate to active work, the first committed deliverable should
be inspection and preview, not full export. Export should follow only after:

- local deterministic fixtures exist
- `vapc` parsing is validated
- desktop playback path is approved
- encoder/tool redistribution is approved
- output size and quality controls are specified
- over-1504 behavior is fail-closed or explicitly warned
- fusion jitter has a reproducible fixture and diagnostic checklist

## Source Links

- Official repository: <https://github.com/Tencent/vap>
- README: <https://github.com/Tencent/vap/blob/master/README.md>
- Format introduction: <https://github.com/Tencent/vap/blob/master/Introduction.md>
- VapTool docs: <https://github.com/Tencent/vap/blob/master/tool/README.md>
- Mac VAPX tool docs: <https://github.com/Tencent/vap/blob/master/tool/Mac_Tool.md>
- Web player docs: <https://github.com/Tencent/vap/blob/master/web/README.md>
- Official FAQ / Wiki: <https://github.com/Tencent/vap/wiki>
- Release history: <https://github.com/Tencent/vap/releases>
- Fusion fit/crop issue: <https://github.com/Tencent/vap/issues/276>
- Android deformation/black shadow issue: <https://github.com/Tencent/vap/issues/291>
- Decoder alignWidth/alignHeight issue: <https://github.com/Tencent/vap/issues/408>
