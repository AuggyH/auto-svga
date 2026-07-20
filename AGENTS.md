# AGENTS.md

## Project Goal

The current Auto SVGA product mainline is Auto SVGA `0.1.x` / SVGA Preview MVP:
the macOS client for SVGA preview, inspection, replacement preview, imageKey
rename, optimization, comparison, save, and owner-visible QA.

The Product Owner's current daily-use client and QA baseline is:

```text
/Users/huangtengxin/Applications/Auto SVGA.app
~/Applications/Auto SVGA.app
```

Historical Workbench v1 surfaces, Web Preview pages, frozen parity baselines,
development Electron windows, and generated `.artifacts` packages are lineage,
supplemental narrowing evidence, or rollback references. They are not the
current product standard, QA baseline, or requirement target unless the Product
Owner explicitly names them for a task.

Current `0.1.x` focus is macOS only. Do not plan, validate, or gate Auto SVGA
`0.1.x` work against Windows clients or standalone Web Preview unless the
Product Owner explicitly requests that target.

Product versions, alpha/beta/RC stages, distribution channels, and build
identity are governed by
`docs/product/VERSIONING_AND_RELEASE_POLICY.md`. Do not use "short-term",
"mid-term", "D0", "latest app", or "the app in Applications" as a complete
version identity in tickets, reviews, QA reports, or release handoffs.

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
2. Start each task from latest `main` on one focused branch. Use `codex/<task-name>`
   for Codex work and an equivalent owner prefix for other agents.
3. Open a GitHub PR using `.github/pull_request_template.md`. The PR is the
   default review, handoff, validation, risk, and rollback record.
4. Run risk-proportional self-tests before requesting review. Required GitHub
   Actions checks must pass before merge.
5. Use independent review for high-risk changes when a real reviewer is
   available. Do not create synthetic approvals, duplicate review branches, or
   repository review files merely to simulate separation of duties.
6. Merge with a merge commit or squash merge. If a merge causes issues, use
   `revert` or a new repair PR; never force-push.
7. Never delete untracked files or generated output without confirmed
   understanding.
8. Update roadmap, status, changelog, release, or decision docs only when the
   corresponding durable truth changes, not after every merge.
9. Tag stable baselines only after a meaningful milestone gate.
10. Commit authors: use agent name for traceability. Set per-repo:
    - Hermes: `git config user.name "Hermes"` / `user.email "hermes-agent@local"`
    - Codex: `git config user.name "Codex"` / `user.email "codex-agent@local"`

## Local Stable App Promotion

The Product Owner's quick-open macOS client is
`~/Applications/Auto SVGA.app`. It is the current Auto SVGA `0.1.0-alpha`
`local` channel app, not a signed/notarized release and not Product Owner
acceptance.

This local stable app is the owner-used short-term client baseline. Before a
worker promotes a new package over it, the worker must prove the candidate is
current-head bound and must not drop owner-visible behavior already present in
the installed app. If the installed app appears to contain behavior that is not
represented in source, PRD, review notes, or the promotion manifest, stop and
route a baseline-drift question to Product Manager / Release before replacing
the app.

Promote a merged exact candidate only when the current milestone explicitly
requires a local-channel refresh and its required gates pass. Ordinary PRs must
not replace the owner local stable app. Use:

```bash
npm run svga-workbench:v1:promote-local-stable
```

Rules:

1. Do not manually copy `.app` bundles into `~/Applications`.
2. The promotion command must package from a clean worktree by default.
3. If a current-head package already exists and unrelated dirty files are
   present, use `-- --use-existing` only to install that already-built package.
   Do not claim uncommitted work was installed.
4. If promotion fails, keep the previous local stable app in place and record
   the blocker in the review.
5. Do not call a promoted `local` app a beta, release candidate, signed build,
   notarized build, or public release unless the version policy gate and
   evidence make that label true.

See `docs/engineering/DESKTOP_CLIENT_COORDINATION_PROTOCOL.md` for foreground
lease, shared desktop-resource identity, client-instance identity, and
baseline-drift rules.

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
12. Follow the foreground desktop debugging rules below before launching,
    automating, or capturing the desktop client in the foreground.
13. For SVGA open/playback/editing UI review, test multiple real owner-provided
    production materials from `/Users/huangtengxin/Downloads/auto-svga测试物料`
    when available. Do not rely only on fixtures; cover varied file size,
    estimated memory, resource count, and replaceability conditions.

## Foreground Desktop Debugging Rules

Before launching, automating, clicking through, capturing, or otherwise
controlling any foreground macOS app or system UI, including Auto SVGA, Finder,
Open/Save dialogs, After Effects, browsers, menu bar interactions, permission
dialogs, clipboard-changing operations, Dock/Launchpad, or screen capture:

1. Prefer non-foreground evidence first when it is sufficient: unit tests,
   source checks, smoke artifacts, headless/browser automation, passive logs,
   or packaged-app metadata.
2. Treat active keyboard, mouse, menu bar, modal dialog, and clipboard control
   as one global foreground input lease. Only one process may hold that active
   input lease at a time, even when several app windows are visible on
   different displays.
3. Check for existing Auto SVGA / Electron / Finder / After Effects / browser
   foreground sessions, running processes, modals, and windows before taking
   focus. Do not assume the frontmost app or dialog is yours unless its app
   path, PID, window/dialog identity, display/workspace, and task context match
   your own launch.
4. If foreground operation is required, check the current display topology
   first using the available macOS/tooling context.
5. If a second or non-primary display is available, launch, move, automate, and
   capture there so the Product Owner's main display is not interrupted. This
   reduces visual disruption but does not remove the single active input lease
   requirement.
6. If no second display is available, prefer silent or low-disturbance startup:
   background/headless mode, minimized or hidden window, non-activating launch,
   or the shortest possible foreground session.
7. Use the main display foreground only when secondary-display operation is not
   available and silent evidence cannot prove the required behavior. In that
   case, say what you are about to do, keep the interruption brief, avoid
   repeated focus stealing, and restore or close the app afterward.
8. Multiple foreground windows or clients may coexist only when each process can
   identify its own target by app path, PID/process identity, window/dialog,
   display/workspace, and evidence label. If identity cannot be proven,
   serialize foreground debugging instead of sharing or stealing an ambiguous
   app, dialog, or clipboard state.
9. Do not hold a foreground lease while running long background builds, waiting
   for unrelated work, or leaving modal dialogs open. Keep the lease short,
   release or restore focus when done, and record the result.
10. Reviews and handoffs that rely on foreground evidence must record the
   strategy used: second display, isolated instance, active input lease,
   shared-resource scope, clipboard use, silent/low-disturbance fallback, or
   main display with reason.

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

Use `docs/loop/AUTONOMOUS_PROTOCOL.md` only when the Product Owner explicitly
starts or resumes a named autonomous milestone. Normal PR work does not require
a frozen milestone contract, handoff packet, reviewer JSON, or loop ledger.

For historical or explicitly resumed SVGA Workbench v1 autonomous branches,
also follow `docs/autonomous/AUTONOMOUS_EXECUTION_RULES.md`. Do not treat those
branches as the current short-term macOS client baseline unless the Product
Owner explicitly asks to resume that lane.

When an autonomous milestone is explicitly active, follow its packet and
terminal-response contract. Do not apply those mechanics to ordinary fixes,
PRs, CI, QA Issues, or weekly retrospectives.

## Repair Health Rules

- The same observable symptom twice requires a discriminating experiment
  before another repair attempt.
- Keep one accountable implementation owner and one PR per root cause. Add an
  independent reviewer or evidence owner only when risk justifies it.
- A required machine-gate failure blocks downstream acceptance for that exact
  candidate.
- Use a root-cause review or postmortem only for repeated systemic failure,
  exhausted bounded repair attempts, data loss, security incidents, or a false
  acceptance that escaped an existing gate.
- Do not create a Finding Ledger, repair contract, or retrospective merely to
  document an ordinary failed test and fix.

See `docs/engineering/REPAIR_HEALTH_PROTOCOL.md`.

## Multi-Worker Coordination

- Default to at most three active execution roles: implementation, integration,
  and QA/CR. Independent read-only investigation may temporarily expand total
  concurrency to five.
- One implementation task owns one milestone or PR, then emits a compact
  handoff and ends. Do not keep permanent product-line workers alive for
  historical context alone.
- A PM/integration task keeps decisions, blockers, candidate identity, and the
  next gate. It does not mirror microtask callbacks or duplicate PR/Issue state.
- Only one implementation owner may modify the same product vertical at a time.
  Use subagents for independent read-only exploration, tests, and log analysis.
- Foreground desktop or system-UI work must follow
  `docs/engineering/DESKTOP_CLIENT_COORDINATION_PROTOCOL.md`; each worker must
  distinguish owner local stable app, its own development instance, any other
  process's foreground client, Finder/Open dialog state, After Effects windows,
  browser windows, and clipboard-changing operations.
- Before starting workers, close or archive inactive historical workers and
  confirm the exact shared candidate and worktree boundary.
- Worker test success does not imply candidate QA or milestone acceptance.
- Shared-port servers, package promotion, owner local stable replacement,
  active foreground input, Finder/Open dialog automation, After Effects UI
  automation, and clipboard-changing operations run serially. Isolated visible
  windows may coexist only when instance identity and display/workspace
  ownership are recorded.

## Project QA And Defect Workflow

Confirmed Product Owner requirements must not stop after PRD updates. Route a
focused change to one accountable owner and one PR. Create a GitHub Issue only
when cross-PR tracking, backlog state, or a real defect needs it.

Real-use bugs, regressions, and acceptance failures must follow
`docs/quality/PROJECT_TEST_ENGINEER_WORKFLOW.md`.

- The Test Engineer lane owns intake, reproduction evidence, routing,
  regression, and closure.
- Implementation owners link a self-tested fixing PR; QA closes the Issue after
  regression on the merged exact candidate.
- Chat handoff is transport only. Link the Issue and PR instead of
  pasting long reproduction logs.
- QA routing does not automatically authorize interrupting the responsible
  owner or jumping the queue. Tickets must carry priority, importance, source,
  and response expectation; immediate interruption is allowed only when the
  ticket explicitly says `Immediate interrupt allowed` and records the
  emergency reason.
- Route ambiguous scope, hidden/deferred features, and ownership disputes to
  the Product Manager before implementation.
- Do not commit real production assets while reproducing bugs.

## Project Code Review Workflow

High-risk source changes must follow
`docs/engineering/CODE_REVIEW_WORKFLOW.md`. Code Review is separate from QA:
QA owns user-visible reproduction, regression, and closure; Code Review owns
source-level architecture, maintainability, dependency, safety, and test
adequacy.

Require Code Review before QA acceptance or local-stable promotion when a task
touches save/overwrite/export bytes, optimization output, parsing/encoding,
playback, Electron main/preload/IPC, filesystem/dialog/menu/clipboard host
boundaries, packaging/runtime closure, new dependencies, broad refactors,
security/privacy, or production-asset handling.

High-risk handoff should normally flow:

```text
Self-tested PR -> CI and Code Review -> merged candidate -> QA Acceptance -> Packaging / Owner-visible promotion
```

Code Review approval does not mean product acceptance or QA pass. QA pass does
not mean source-level risk is acceptable. Use exact review states such as
`Approved For QA`, `Approved For Packaging`, `Changes Requested`, or
`Advisory Findings`.

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

1. Use the GitHub PR as the default review record. Keep the description concise:
   goal, scope/non-goals, risk, validation, candidate identity, acceptance
   boundary, and rollback.
2. Put actionable findings in GitHub review comments. Do not paste full diffs,
   full logs, raw chat, or repeated project background.
3. Create `docs/reviews/` or `review/` artifacts only for a meaningful product
   checkpoint, release/package evidence, broad audit, or an explicitly requested
   durable handoff. Ordinary fixes and internal repairs do not require them.
4. Never create permit, packet, callback, or ledger documents solely to move a
   normal PR between implementation, review, and QA.

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
