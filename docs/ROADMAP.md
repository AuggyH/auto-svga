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
- [ ] Wrap current SVGA inspection behind `FormatAdapter` without changing output
- [ ] Extract browser SVGA playback behind `PlaybackAdapter`
- [ ] Replace CDN runtime loading with an approved local bundle
- [ ] Define versioned delivery specifications and deterministic checks
- [ ] Define sprite-sequence manifest and bounded frame cache
- [ ] Run separate Lottie, VAP, and desktop-host technical spikes

This track is infrastructure only. It does not expand the production asset
scope beyond `avatar_frame`, and it does not authorize new format dependencies
or conversion features.

## Future Phases

- Additional asset types: medal, title, bubble
- Web preview editor (template parameter tweaking without CLI)
- Runtime mask support in SVGA export
- Composition/precomp support
