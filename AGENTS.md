# AGENTS.md

## Project Goal

This repository is an MVP for automating SVGA-like animation project generation for avatar frame assets.

Current scope is intentionally narrow:
- only avatar_frame asset type
- CLI first
- intermediate project format first
- exporter-ready project.json protocol first
- 5 animation templates: wing_flap, gem_twinkle, metal_sweep, frame_breath, pop_settle (pop_settle defined but not enabled by default)

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
20. For product or UI work, read DESIGN.md and follow its mode, layout, language, and visual guidance

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

## Git Collaboration Rules

1. `main` branch represents stable, runnable state. Never force-push to main.
2. Each task starts from latest `main` and creates an agent branch.
3. Branch naming:
   - `agent/codex/<task-name>` — Codex agent work
   - `agent/hermes/<task-name>` — Hermes agent work
   - `fix/<issue-name>` — bug fixes
   - `review/<review-name>` — review/handoff branches
4. Each branch focuses on one task. No mixed-scope branches.
5. After development, run full verification (build + test + pipeline).
6. Produce a review file in `docs/reviews/` before merging.
7. Merge to main only after review passes. Use `--no-ff` or squash merge.
8. If a merge causes issues, fix via `revert` or a new `fix/` branch — never force-push.
9. Never delete untracked files or generated output without confirmed understanding.
10. Update `docs/CHANGELOG.md` and `docs/CURRENT_STATUS.md` after each merge to main.
11. Tag stable baselines after major milestone merges.
12. Commit authors: use agent name for traceability. Set per-repo:
    - Hermes: `git config user.name "Hermes"` / `user.email "hermes-agent@local"`
    - Codex: `git config user.name "Codex"` / `user.email "codex-agent@local"`

## Asset Commit Rules

The repository should contain engineering files only. Do not commit:

- Real design assets (PNG, PSD, Figma exports, Sketch files)
- Local job workspaces (`jobs/`, `input/`)
- Generated runtime outputs (`generated/`, `output/`, `preview/`)
- Exported SVGA, GIF, WebM, MP4, or frame sequences
- Production design reference images

The `jobs/` and `input/` directories are local runtime workspaces and are gitignored.

If tests require image assets, use small mock fixtures under `fixtures/` or generate temporary PNGs programmatically during test setup (see `src/tests/mvp-planner.test.ts` for patterns).

Before committing, always verify:
```bash
git status
git diff --cached --name-only
```
Confirm no real PNG, SVGA, GIF, job output, or design asset is staged.

## UI Design Rules

Before modifying the Web preview page (`tools/svga-player-preview/`):

1. Read `DESIGN.md` first — it defines the color tokens, typography, spacing, motion, and accessibility rules.
2. Read `docs/decisions/ADR-002-apple-design-translation.md` to understand which Apple patterns we adopt vs exclude.
3. Do NOT copy Apple's marketing-page patterns (56px headlines, 80px padding, pure-black nav, product shadows).
4. This is a production tool — information density and readability take priority over decorative effects.
5. Use CSS custom properties from DESIGN.md — no hardcoded hex values.
6. Test both light and dark modes.
7. Verify `prefers-reduced-motion: reduce` behavior.
8. Ensure all interactive elements have visible `:focus-visible` outlines.
9. Chinese labels primary, English secondary for debug traceability.
10. Do NOT add multiple menu styles — use the unified `.dropdownMenu` / `.dropdownMenuItem` classes.

## Agent Handoff

When a new agent takes over this repo:

1. Read `AGENTS.md` first (this file).
2. Read `docs/CURRENT_STATUS.md` for latest state.
3. Check `git status`, `git log`, `git branch` — never pull/reset before understanding current state.
4. If there are uncommitted changes, create a safety branch before working.
5. Read `docs/TOKEN_BUDGET_RULES.md` for token usage rules.
6. Load `docs/TECH_SPEC.md` only if technical details are needed.
7. Do not expand beyond avatar_frame MVP scope unless explicitly requested.

## Review Process

1. Each task outputs a review file in `docs/reviews/`:
   - Filename: `YYYY-MM-DD-agent-task-name.md`
   - Template: `docs/REVIEW_TEMPLATE.md`
2. Review must include: summary, git state, changed files, requirement checks, verification, risks, next steps.
3. Do NOT include: full diffs, full logs, project background repetition.
4. Review is for the next agent — write only what they need to continue.

## Current Template List

Now 5 templates (expanded from original 3):
- `wing_flap` — wing tip micro-flap rotation around root_joint
- `gem_twinkle` — gem glint scale + alpha pulse
- `metal_sweep` — metal edge light sweep with baked mask
- `frame_breath` — full frame scale + alpha breathing
- `pop_settle` — defined, not enabled by default

## Future Extension Direction

Possible later phases:
- medal
- title
- bubble
- real svga exporter integration
- lightweight web preview UI
