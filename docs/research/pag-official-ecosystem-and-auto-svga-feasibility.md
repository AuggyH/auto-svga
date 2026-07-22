# PAG Ecosystem And Auto SVGA Feasibility

Date: 2026-07-14
Last product disposition: 2026-07-23
Status: research input; `docs/product/PRODUCT_ROADMAP.md` remains scope authority

Reverify upstream releases, issue status, licensing, dependencies, and platform
support before implementation or distribution.

## Product Disposition

The Product Owner approved two separate outcomes:

1. a `0.2.x` follow-up for local PAG preview, playback, parameter analysis,
   runtime text/image replacement preview, target Reset, and lifecycle safety;
2. a later AEB-to-PAG export path using a controlled exporter and independent
   visual/timing validation.

The preview milestone does not promise persistent PAG editing or serialization
of runtime replacements. The export milestone does not inherit acceptance from
preview. Neither expands the current `0.2.0-alpha.2` local-stable closure gate.

## Source-audit Findings

- The official exporter reads After Effects composition, layer, and property
  state; translates it into PAG objects; generates bitmap/video/audio
  resources; and serializes through native PAG codec code.
- Building official source does not remove semantic or timing defects already
  present in translation logic. A controlled fork must earn support row by
  row.
- Structural validation can reload or re-encode bytes, but that does not prove
  representative pixels or timing are correct.
- The Web/WASM runtime can inspect and preview PAG and supports runtime text and
  image replacement. It does not provide a general API to serialize those
  runtime replacements into a new PAG file.
- WebAssembly objects, players, surfaces, and WebGL resources require explicit
  destruction and repeated lifecycle/memory testing.
- Export, runtime, package, and installed-client correctness are separate
  macOS/Windows boundaries.

Audited upstream snapshot:
`47e35cedbf8af16aa2ffdf4131e3eeb7d3a51136`.

## Initial Preview Boundary

| Capability | Initial decision |
| --- | --- |
| File/header detection and bounded parsing | Feasible foundation. |
| Local play, pause, seek, loop, dimensions, duration, resource and editability facts | Feasible with a pinned official runtime. |
| Runtime text/image replacement | Feasible session behavior; no persistent-save claim. |
| Target Reset and sibling isolation | Required product behavior, not implied by a successful API call. |
| Repeated lifecycle and memory settle | Required because PAG/WASM/WebGL objects have explicit lifetimes. |
| General PAG authoring or runtime-change serialization | Deferred. |

Visible replacement success requires rendered target pixels to change after
input, not merely a truthy API result or an installed binding. Reset must
restore the target and preserve unrelated replacements. Invalid or unusable
target geometry must fail closed rather than fabricate a successful surface.

## Export Architecture Candidate

```text
PAG workflow controller
  -> AE/project preflight and immutable input identity
  -> backend adapter
       - pinned stock exporter (reference)
       - Auto SVGA-controlled source build (preferred candidate)
  -> versioned intermediate stage records
  -> output validator
       - format/load validation
       - real native/Web playback
       - representative pixel/timing comparison
       - editability/resource/performance facts
  -> typed diagnosis, recovery, and rollback
```

The controlled backend should separate host extraction, semantic translation,
media generation, model construction, and serialization so the earliest
divergent stage can be identified and repaired without rewriting the entire
pipeline.

## Failure Classes To Preserve

| Class | Required evidence |
| --- | --- |
| Export stall or host crash | Exact AE/exporter build, phase, elapsed time, immutable source identity, and bounded recovery. |
| Parseable but wrong pixels/timing | Representative source-to-PAG frame comparison, duration/time checks, and real playback. |
| Bitmap/video boundary drift | Explicit vector/bitmap/video plan and editability loss before export. |
| Reused sequence/precomp timing | Golden cases with multiple instances and different start offsets. |
| Masks, mattes, effects, orientation | Feature-specific compatibility rows and pixel comparison. |
| Font/text substitution or clipping | Font identity, alignment policy, editable-index proof, and text-frame comparison. |
| Path, locale, or package dependency | Portable-name checks and installed runtime-closure evidence. |
| Long-session memory growth | Repeated open/close/replacement with balanced destroy and memory settle. |

## Go / No-Go For AEB-to-PAG Export

Proceed only when:

1. exporter source builds reproducibly on the target platform;
2. license and dependency obligations are accepted;
3. at least one real stock-exporter failure is fixed by the candidate backend;
4. output loads in pinned native and Web runtimes;
5. representative pixels and timing match the AE source within an approved
   tolerance;
6. supported, degraded, baked, and blocked feature rows are explicit;
7. crash, timeout, cleanup, rollback, and source immutability are bounded.

Stop or redesign if a backend cannot localize failure, silently mutates source,
cannot preserve valid output, or repeatedly fails the required material
corpus.

Production projects and failing PAG files stay local and uncommitted. Durable
records contain redacted facts, aliases, hashes, versions, and outcomes only.

## Primary Sources

- [Official repository](https://github.com/Tencent/libpag)
- [Audited source snapshot](https://github.com/Tencent/libpag/tree/47e35cedbf8af16aa2ffdf4131e3eeb7d3a51136)
- [Exporter build contract](https://github.com/Tencent/libpag/blob/47e35cedbf8af16aa2ffdf4131e3eeb7d3a51136/exporter/README.md)
- [Exporter implementation](https://github.com/Tencent/libpag/blob/47e35cedbf8af16aa2ffdf4131e3eeb7d3a51136/exporter/src/export/PAGExport.cpp)
- [Native file/codec API](https://github.com/Tencent/libpag/blob/47e35cedbf8af16aa2ffdf4131e3eeb7d3a51136/include/pag/file.h)
- [Native codec implementation](https://github.com/Tencent/libpag/blob/47e35cedbf8af16aa2ffdf4131e3eeb7d3a51136/src/codec/Codec.cpp)
- [Export modes](https://pag.io/docs/en/pag-export.html)
- [File format specification](https://pag.io/file/pag_codec_en_V1.1.2.pdf)
- [Web runtime](https://github.com/Tencent/libpag/blob/main/web/README.md)
- [Web PAGFile API](https://github.com/Tencent/libpag/blob/main/web/src/pag-file.ts)
- [Web PAGPlayer API](https://github.com/Tencent/libpag/blob/main/web/src/pag-player.ts)
