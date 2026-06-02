# AGENTS.md

## Project Goal

This repository is an MVP for automating SVGA-like animation project generation for avatar frame assets.

Current scope is intentionally narrow:
- only avatar_frame asset type
- CLI first
- intermediate project format first
- exporter-ready project.json protocol first
- 3 animation templates only:
  - breathing_glow
  - metal_edge_sweep
  - gem_twinkle

## Priorities

1. Keep the project runnable
2. Keep the architecture modular
3. Prefer readable TypeScript over clever abstractions
4. Prefer schema-driven design
5. Avoid adding new asset types unless explicitly requested
6. Avoid premature UI work
7. Avoid implementing a full binary SVGA exporter unless explicitly requested
8. Do not bypass project.json as the source of truth for preview or export
9. Do not let preview.gif drift from project.json durationFrames / fps
10. Do not hardcode canvas dimensions; use asset.config.json canvas values
11. Do not hardcode gem glint positions; use asset.config.json gemGlints
12. Do not make exporter adapters understand template semantics
13. Do not change coordinate semantics unless preview, project schema, svga-map, and docs/exporter-contract.md are updated together
14. Do not mark frame_base as replaceable
15. If preview cannot evaluate masks directly, provide baked mask assets
16. Do not claim a real .svga export succeeded unless a standards-compliant file is produced
17. After generating a real .svga, prioritize validation in a real SVGA player
18. Do not rely only on zlib inflate or protobuf decode to judge visual success
19. Do not fabricate playback success; mark manual visual confirmation as required when automated playback verification is unavailable

## Expected Core Modules

- asset loader
- template engine
- generated asset builder
- project builder
- svga map builder
- exporter adapters
- preview renderer
- validator
- CLI commands

## Animation Quality Guidelines

- Keep animation subtle and premium
- Avoid noisy, flashy, or chaotic motion
- Focus on clean highlight motion and controlled glow
- Keep loop duration readable and stable
- Avoid too many simultaneous effects

## Output Contracts

The build step should generate:
- project.json
- svga-map.json
- generated assets
- preview file
- validation report

project.json must use the stable intermediate protocol:
- version
- projectId
- assetType
- canvas
- fps
- durationFrames
- loop
- assets
- layers
- animations
- export

Keyframes must use frame as the primary time unit. Do not reintroduce timeMs as the main timeline field.

Do not output abstract effect layers. All template effects must expand into concrete image layers with real asset references.

Canvas-dependent values must come from asset.config.json. If the example changes from 256x256 to 300x300, generated assets, sweep motion, anchors, and preview should adapt.

Gem glint locations must come from asset.config.json gemGlints. If gemGlints is empty, do not generate gem glint layers and emit a warning.

Exporter adapters must read image layers, assets, animations, masks, and svga-map style mappings. They must not infer behavior from breathing_glow, metal_edge_sweep, or gem_twinkle.

Coordinate convention is frozen:
- layer.transform.x/y is the layer anchor position in canvas coordinates
- layer.anchor.x/y is the anchor position in local layer coordinates
- rotation and scale occur around anchor
- preview-renderer and exporter adapters must use this same convention

Mask handling:
- project.json should preserve mask protocol fields
- svga-map.json should include bakedMaskAssetPath when available
- preview should prefer baked mask assets if it cannot fully evaluate mask protocol

SVGA export handling:
- exporterReady means the intermediate protocol is ready for an exporter
- svgaExport.success means a real .svga was produced
- keep these concepts separate in code, docs, and reports
- use proto/svga.proto and protobufjs for real protobuf export
- validate .svga by zlib inflate and protobuf decode after writing
- if binary export fails, update report.json with the concrete failure reason

Playback verification:
- real .svga output must be checked with a real SVGA player before visual success is claimed
- protobuf decode only proves the binary can be parsed; it does not prove the animation looks correct
- use tools/svga-player-preview for the current minimal Web playback comparison
- playback reports may record attempted/manualRequired/automated/instructions/knownLimitations
- if playback cannot be automatically judged, keep manualRequired true and do not write success

## Coding Conventions

- Use TypeScript
- Use pnpm
- Keep functions small and testable
- Keep schemas explicit
- Document assumptions in README
- Keep preview rendering driven by project.json layers, animations, and keyframes
- Keep exporter integration behind src/exporters interfaces

## Future Extension Direction

Possible later phases:
- medal
- title
- bubble
- real svga exporter integration
- lightweight web preview UI
