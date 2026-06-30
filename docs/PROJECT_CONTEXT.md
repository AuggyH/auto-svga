# Project Context

## What

Auto SVGA is evolving from an avatar-frame SVGA CLI into a designer-facing
export and acceptance workbench. Its current production scope remains the
layered `avatar_frame` pipeline; its product direction emphasizes playback,
comparison, inspection, performance diagnosis, safe post-export refinement,
and delivery evidence rather than full motion authoring.

## Scope

- Asset type: `avatar_frame` only
- Input: transparent PNG parts + `asset.config.json` + `structure.json`
- Output: `.svga` + previews (WebM/MP4/GIF/PNG frames) + report + svga-map + delivery.zip
- 5 animation templates: `wing_flap`, `gem_twinkle`, `metal_sweep`, `frame_breath`, `pop_settle`

## Key Principles

- Configuration-driven (no hardcoded canvas sizes, glint positions, etc.)
- Template semantics expand to concrete layers before export — exporters don't understand templates
- Coordinate convention: `transform.x/y` = canvas coords, `anchor.x/y` = local coords, rotation/scale around anchor
- Acceptance is split: `technicalStatus` (pipeline) vs `visualStatus` (human review)
- Do not fabricate playback success
- See `AGENTS.md` for full engineering rules

## Tech Stack

- TypeScript + Node.js (ES2022, ESM)
- pnpm (package manager)
- protobufjs (only dependency, for real SVGA export)
- No other external runtime deps

## Workbench architecture preparation

The repository includes an isolated P1 contract proposal for future motion
format inspection, playback, checks, recommendations, and conversion:

- `src/workbench/contracts.ts`
- `src/workbench/capabilities.ts`
- `docs/multiformat-workbench-architecture.md`
- `docs/decisions/ADR-003-multiformat-workbench-boundaries.md`

These files are not connected to the current CLI or Web preview runtime.
Current production scope remains `avatar_frame` to SVGA.

## Key File Paths

- `AGENTS.md` — engineering rules, git workflow, agent handoff
- `DESIGN.md` — agent-readable design-system manifest for the corrected short-term app
- `docs/CURRENT_STATUS.md` — historical status snapshot; not current product authority
- `docs/ROADMAP.md` — historical roadmap lineage; not current PRD authority
- `docs/product/PRODUCT_DOCUMENTATION_SYSTEM.md` — product document source hierarchy, PM responsibilities, status vocabulary, and maintenance cadence
- `docs/product/PRODUCT_ROADMAP.md` — only project-level PRD authority and active product roadmap
- `docs/product/SHORT_TERM_UI_UX_DESIGN_BRIEF.md` — active subordinate UI/UX input for the corrected short-term app
- `docs/product/SHORT_TERM_UI_UX_REDESIGN_EXECUTION_PLAN.md` — active subordinate design-system and implementation-trace plan
- `docs/product/auto-svga-product-principles.md` — product positioning and anti-drift rules
- `docs/product/auto-svga-backlog.md` — staged product candidates and explicit deferrals
- `docs/research/figma-svga-editor-competitor-research.md` — black-box competitor findings
- `docs/CHANGELOG.md` — merge history
- `docs/TECH_SPEC.md` — module architecture
- `docs/TOKEN_BUDGET_RULES.md` — agent behavior rules
- `docs/REVIEW_TEMPLATE.md` — per-task review template
- `docs/reviews/` — review records
- `docs/decisions/` — ADR records
- `docs/exporter-contract.md` — exporter protocol contract
- `docs/svga-packaging-strategy.md` — SVGA binary strategy
- `docs/motion-system-research-notes.md` — animation system research
- `docs/multiformat-workbench-architecture.md` — future format capability matrix and staged architecture

## Run Commands

```bash
node_modules/.bin/tsc -p tsconfig.json        # build
node --test dist/tests/mvp-planner.test.js     # test
node dist/cli.js plan jobs/<job-dir>           # plan
node dist/cli.js preview jobs/<job-dir>        # preview
node dist/cli.js report jobs/<job-dir>         # report
node dist/cli.js export jobs/<job-dir>         # export SVGA
node dist/cli.js package jobs/<job-dir>        # package delivery.zip
node tools/svga-player-preview/server.mjs      # Web preview server
```

Web preview: `http://127.0.0.1:4173/tools/svga-player-preview/`
