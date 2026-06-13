# Roadmap

## Current: MVP 0.1 avatar_frame

- [x] Planning chain (config + structure → motion-plan → project.json)
- [x] 5 animation templates
- [x] Generated assets + image optimization (trimming, scaling)
- [x] Baked sweep mask system
- [x] Unified easing/interpolation
- [x] Preview pipeline (PNG frames + WebM + MP4 + GIF)
- [x] Report + svga-map generation
- [x] Real SVGA protobuf+zlib export
- [x] Delivery packaging
- [x] Acceptance workflow
- [x] Web playback validation tool
- [x] Agent collaboration docs + review process
- [x] Web preview rebuild: grouped latest artifacts, SVGA-first loading, readable panels
- [x] Unified dropdown, playback state, settings groups, and reduced motion
- [ ] WCAG AAA verification (axe, contrast, complete keyboard and resize checks)
- [ ] Full 1600/1440/1280/1024/900/768 visual matrix

## Next: MVP 0.2

- Visual tuning (wing phase, gem glint, breath glow)
- Sweep quality/stride evaluation
- Additional template parameters (easing curves, amplitude ranges)
- CI pipeline for automated build+test verification

## P1 Infrastructure: Multi-format workbench preparation

- [x] Audit current SVGA-specific parser, playback, export, and host coupling
- [x] Define host-neutral workbench contracts and capability maturity language
- [x] Record initial capability matrix for SVGA, VAP, Lottie, animated WebP, WebM, APNG, and sprite sequences
- [x] Record dependency, license, maintenance, and desktop redistribution risks
- [x] Wrap current SVGA inspection behind `FormatAdapter` without changing output
- [ ] Integrate SVGA inspection into one non-UI application service
- [ ] Extract browser SVGA playback behind `PlaybackAdapter`
- [ ] Replace CDN runtime loading with an approved local bundle
- [ ] Define versioned delivery specifications and deterministic checks
- [ ] Define sprite-sequence manifest and bounded frame cache
- [ ] Run separate Lottie, VAP, and desktop-host technical spikes

This track is infrastructure only. It does not expand the production asset
scope beyond `avatar_frame`, and it does not authorize new format dependencies
or conversion features.

## Roadmap Principle: Inspection Primitives First

Auto SVGA should make stable, reusable inspection primitives reliable before
building higher-level product features. Current P1/P2 work should prioritize:

1. format recognition and parsing
2. normalized `MotionAssetInfo`
3. file size, dimensions, FPS, frame count, and duration
4. embedded resource metadata and image dimensions
5. `alphaBounds` and `transparentPaddingRatio`
6. resource role classification
7. versioned spec profiles and role-aware policies
8. decoded memory estimation and resource-level diagnostics
9. stable report output contracts

Higher-level features must be composed from those primitives:

- Motion Asset Audit
- Performance Audit
- Format Recommendation Engine
- Optimization Suggestions
- Export Preflight
- Batch Inspection
- Legacy Asset Cleanup
- Multi-format Comparison

Do not implement these as isolated one-off UI logic. Their evidence should come
from deterministic local metadata and rules: parsed metadata, resource
dimensions, alpha statistics, decoded memory estimates, timing, resource
counts, file size, roles, profile thresholds, and the format capability matrix.

Do not use AI, external models, multimodal models, or network services to
replace deterministic inspection, performance analysis, format decisions, or
optimization recommendations. Any separately approved generative capability
must remain outside this inspection foundation.

## Future Phases

- Additional asset types: medal, title, bubble
- Web preview editor (template parameter tweaking without CLI)
- Runtime mask support in SVGA export
- Composition/precomp support
