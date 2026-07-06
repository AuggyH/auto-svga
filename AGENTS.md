# AGENTS.md

## Project Goal

This repository is an MVP for automating SVGA-like animation project generation for avatar frame assets.

Auto-SVGA product mainline is P6-R1 owner-visible Workbench parity and
acceptance.

The frozen Web Preview parity baseline is historical lineage, required
inventory, and rollback reference. It is no longer the active P6-R1 product
ceiling after owner-authorized Workbench revisions. Current P6-R1 work must
bind evidence and handoff to the owner-visible shared Product Workbench on the
active final head.

Do not add new editor features to the default Desktop product until the P6-R1
Workbench and macOS internal app are accepted.

Desktop-specific host behavior may differ only for native window, file dialogs,
menus, shortcuts, file association, Save As, and security boundaries.

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
20. For product or UI work, read `docs/product/PRODUCT_ROADMAP.md`,
    `docs/product/SHORT_TERM_UI_UX_DESIGN_BRIEF.md`,
    `docs/product/SHORT_TERM_UI_UX_REDESIGN_EXECUTION_PLAN.md`, and
    `DESIGN.md`; treat `DESIGN.md` as the current agent-readable design-system
    manifest, not as product scope authority.
21. Web preview artifact discovery must prefer the newest complete group containing a real SVGA; reference media must come from the same group
22. Do not let a successful GIF/video reference hide a failed or missing SVGA
23. Keep preview workspaces vertically reachable at narrow desktop widths; do not lock wrapped content behind hidden overflow
24. Treat WCAG AAA as Partial until axe, contrast, keyboard, resize, and reduced-motion checks are complete

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

Before modifying owner-visible UI:

1. Read the main PRD, short-term UI/UX design brief, redesign execution plan,
   and `DESIGN.md`.
2. Use `DESIGN.md` for agent-readable design-system identity, token
   namespaces, component inventory, and implementation rules.
3. Do NOT copy Apple's marketing-page patterns (56px headlines, 80px padding,
   pure-black nav, product shadows).
4. This is a production tool — information density and readability take
   priority over decorative effects.
5. Use design tokens and CSS custom properties — no hardcoded owner-visible
   visual values.
6. Test both light and dark modes when the touched surface supports them.
7. Verify reduced-motion behavior when motion is touched.
8. Ensure all interactive elements have visible `:focus-visible` outlines.
9. Chinese labels are primary; English appears only for traceability where
   useful.
10. Do not create duplicate one-off menu, button, row, or panel systems.
11. For desktop UI/UX judgment, use real foreground desktop-client screenshots
    that include the macOS menu bar, native titlebar/window chrome, and actual
    foreground state. Smoke screenshots are functional evidence, not primary
    visual/experience evidence.
12. When launching the desktop client for UI/UX review, place it on the second
    display when available so the owner's main display is not interrupted.
13. For SVGA open/playback/editing UI review, test multiple real owner-provided
    production materials from `/Users/huangtengxin/Downloads/auto-svga测试物料`
    when available. Do not rely only on fixtures; cover varied file size,
    estimated memory, resource count, and replaceability conditions.

## Agent Handoff

When a new agent takes over this repo:

1. Read `AGENTS.md` first (this file).
2. Read `docs/CURRENT_STATUS.md` for latest state.
3. Check `git status`, `git log`, `git branch` — never pull/reset before understanding current state.
4. If there are uncommitted changes, create a safety branch before working.
5. Read `docs/TOKEN_BUDGET_RULES.md` for token usage rules.
6. Read relevant sections of
   `docs/retrospectives/PROJECT_EXPERIENCE_GUIDE.md` for reusable project
   execution lessons.
7. Load `docs/TECH_SPEC.md` only if technical details are needed.
8. Do not expand beyond avatar_frame MVP scope unless explicitly requested.

## Autonomous Loop Protocol

For long-running autonomous tasks, follow `docs/loop/AUTONOMOUS_PROTOCOL.md`.
Create a frozen milestone contract before implementation, execute
Implement -> Validate -> Review -> Repair, and do not push, merge, release, or
deploy automatically.

For the active SVGA Workbench v1 autonomous branch, also follow
`docs/autonomous/AUTONOMOUS_EXECUTION_RULES.md`. In particular, do not convert
small fixes into new review packages, do not stop for ordinary implementation
gaps, and keep real-asset validation redacted.

Before returning `PASS` or `HUMAN_REQUIRED`, run the repository handoff command
successfully and return the generated `FINAL_RESPONSE.txt` verbatim. Never
substitute a chat summary for the review packet.

Review Packet v4 requires byte-exact `PASS` diffs, source/packet diff hash
binding, loop budget evidence, structured reviewer JSON v2, and terminal
`Next Action: external_review`.
Loop budget counts must be derived from `LOOP_HISTORY.jsonl`, and
`HUMAN_REQUIRED` snapshots must never include high-confidence secret content.

## Repair Health Rules

- Every external review must update the active Finding Ledger.
- The same finding in two consecutive review rounds requires a root-cause
  review before another repair.
- The same finding in three review rounds pauses implementation and requires a
  retrospective.
- Exhausted repair budget requires a postmortem before a successor repair
  milestone.
- A required machine-gate failure forbids an owner-acceptance Human Gate.
- Every vertical work package has one Lead Implementation Owner, a separate
  Evidence Owner, and an A0 or independent Integration Verifier.
- A repair contract must state its root-cause hypothesis, why the prior fix
  failed, a failure-first test, success stop condition, and failure stop
  condition.

See `docs/engineering/REPAIR_HEALTH_PROTOCOL.md`.

## Multi-Worker Coordination

- Formal implementation workers must be visible project Worktree threads.
- Subagents are limited to short-lived read-only audit and review.
- Before coordinating or resuming a multi-worker milestone, A0 must read the
  protocol, coordination doc, and registry; list visible project threads;
  refresh the registry; and validate it.
- List and reuse existing project threads before creating workers.
- A0 is the only integration coordinator and global lifecycle writer.
- Worker PASS does not imply milestone PASS.
- Heavy Electron, Web server, and packaged-App validation runs serially.

## Token-saving Skills

Repository-local reusable skills live under `codex-skills/`:

- `auto-svga-core-guard` — required for every Auto SVGA task
- `auto-svga-motion-formats` — format parsing, playback, replacement, conversion, and export
- `auto-svga-spec-check` — asset specifications and performance checks
- `auto-svga-ui-stability` — Web preview and responsive UI work
- `auto-svga-client-ready` — dependencies, filesystem, offline, and desktop packaging
- `caveman-report` — compact plans, progress updates, completion reports, and risks
- `context-budget` — minimal context loading and precise file reads
- `diff-first` — change/evidence/regression-first engineering reports
- `verification-budget` — risk-proportional validation and concise test evidence

Load `auto-svga-core-guard` for every task, then load only the domain skills
needed. See `docs/codex-skill-usage.md`. These files are source artifacts;
installing them into a user's global Codex skill directory is a separate
explicit action.

For any product, UI, feature, release, planning, acceptance, or product-doc
task, the agent must check `docs/product/PRODUCT_DOCUMENTATION_SYSTEM.md` and
the single project-level PRD authority, `docs/product/PRODUCT_ROADMAP.md`,
before implementation. If the task conflicts with that authority or would
revive hidden/deferred scope, ask the Product Owner instead of choosing
silently.

## Project Retrospective And Experience

Project retrospectives cover product planning, implementation, technical
architecture, UI/UX, validation, release, coordination, and token cost. They do
not define product scope or acceptance.

For meaningful tasks:

1. Read `docs/retrospectives/PROJECT_EXPERIENCE_GUIDE.md` after the relevant
   authority docs.
2. Add a compact retrospective section to the task review.
3. Append one valid JSON line to
   `docs/retrospectives/TASK_RETRO_LEDGER.jsonl`.
4. Record exact Codex session token counts when available; otherwise mark the
   source as `unavailable` or `manual-estimate`.
5. Add reusable but unproven lessons to
   `docs/retrospectives/PROJECT_LESSONS_CANDIDATES.md`.

Weekly and monthly project retrospectives follow
`docs/retrospectives/PROJECT_REVIEW_SYSTEM.md`. Do not copy raw chat history,
long logs, full diffs, or production assets into retrospective docs.

## Review Process

1. Each task outputs a review file in `docs/reviews/`:
   - Filename: `YYYY-MM-DD-agent-task-name.md`
   - Template: `docs/REVIEW_TEMPLATE.md`
2. Review must include: summary, git state, changed files, requirement checks, verification, risks, next steps, project retrospective, and token usage.
3. Do NOT include: full diffs, full logs, project background repetition.
4. Review is for the next agent — write only what they need to continue.
5. Every completed task must also expose owner-visible review material under
   `review/<task-or-milestone>-<head-short-sha>/`.
6. The final response must include clickable Markdown links to the visible
   review folder, `REVIEW_PACKET.md`, the upload ZIP, product artifacts such as
   an App ZIP when present, and required companions such as `changes.patch`.
7. Hidden `.artifacts` paths alone are not an acceptable owner handoff. See
   `docs/engineering/REVIEW_PACKET_VISIBILITY_PROTOCOL.md`.
8. `changes.patch` is not a default attachment. Terminal handoff includes it
   only when `companionRequired=true`; do not create an empty patch.

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
