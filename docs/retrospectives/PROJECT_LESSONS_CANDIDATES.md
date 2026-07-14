# Project Lessons Candidates

Status: active candidate pool

Use this file for reusable project lessons that are promising but not yet
stable enough for `PROJECT_EXPERIENCE_GUIDE.md`.

Do not copy chat history here. Summarize the smallest reusable lesson, cite the
review or task ledger entry that produced it, and mark whether it should be
promoted, watched, rejected, or kept historical.

## Candidate Format

```text
## <short lesson title>

- Source:
- Area: product | implementation | UI/UX | validation | coordination | token-cost | release
- Context:
- Problem:
- Candidate rule:
- Evidence:
- Status: candidate | promote | watch | rejected | historical
```

## Project retrospectives must not collapse into token accounting

- Source: `docs/retrospectives/TASK_RETRO_LEDGER.jsonl`
- Area: coordination, token-cost
- Context: The Product Owner requested token statistics, but clarified that
  weekly and monthly reviews must cover all project work: product planning,
  implementation, technical architecture, design interaction, validation,
  multi-process coordination, and execution cost.
- Problem: A token-only system would optimize for cheap turns while missing
  higher-impact causes of delay, rework, scope drift, UI churn, and validation
  weakness.
- Candidate rule: Treat token usage as one cost signal inside a broader
  project retrospective system.
- Evidence: Initial project retrospective system created on 2026-07-06.
- Status: promote

## Keep raw session content out of repository retrospectives

- Source: `docs/retrospectives/PROJECT_REVIEW_SYSTEM.md`
- Area: privacy, token-cost, coordination
- Context: Codex session files can contain `token_count` events useful for
  cost analysis, but they also contain raw conversation and tool output.
- Problem: Copying raw session content into Git would create privacy, noise,
  and token-cost problems.
- Candidate rule: Extract only structured counts, task ids, review paths, and
  short lessons. Do not copy raw chats or long logs.
- Evidence: The task ledger schema records token source and counts without raw
  transcript fields.
- Status: promote

## Batch adjacent visual polish into owner-visible bundles

- Source: `docs/retrospectives/weekly/2026-W28.md`
- Area: UI/UX, coordination, token-cost
- Context: The first weekly retrospective counted 144 review files across
  2026-07-04 through 2026-07-06, including 116 UI/UX reviews. Many were
  neighboring split or polish slices with repeated scope, smoke, foreground,
  and next-step language.
- Problem: Small slices improve traceability, but too many adjacent visual-only
  slices multiply startup, validation, screenshot, review, and handoff cost.
- Candidate rule: Batch adjacent visual-only polish by page state or surface
  and run one bundled foreground acceptance pass, unless behavior, save/output,
  host security, accessibility-critical focus behavior, or fragile cross-state
  layout requires isolation.
- Evidence: `docs/retrospectives/weekly/2026-W28.md`
- Status: promote

## Land Figma component contracts before page-level visual polish

- Source: `docs/research/figma-mcp-read-packets/r6-design-system-system-read-20260709.md`
- Area: UI/UX, implementation, validation, token-cost
- Context: The Product Owner corrected the UI/UX lane away from scattered
  page micro-tweaks and toward Figma token, atom, molecule, and module
  implementation first.
- Problem: Reading Figma once and then adjusting isolated page details can
  still ignore the design system and make later pixel tuning fragile.
- Candidate rule: Convert already-read Figma tokens/components/modules into
  code trace points and design-system checks before page-level high-fidelity
  polishing. Use new Figma MCP reads only when a component contract is missing
  or blocked.
- Evidence: WP-E through WP-H added trace/check coverage for right-surface
  asset tabs, rows, optimization candidates/results, and launch empty canvas
  without additional Figma reads.
- Status: watch

## Reconcile Figma fidelity conflicts into combined contracts

- Source: `docs/reviews/2026-07-10-codex-uiux-r11-loading-failure-shell-repair.md`
- Area: UI/UX, product, validation
- Context: R11 found that Figma Loading and Load failed preserved the workbench
  shell while product rules forbade stale previous-source metadata.
- Problem: Treating this as either "copy Figma exactly" or "do not repair"
  would lose one side of the requirement.
- Candidate rule: Ask whether the conflict can become a combined contract:
  preserve the Figma shell geometry while replacing disallowed stale content
  with state-specific neutral or recovery content.
- Evidence: The R11 shell repair added `StateRecoveryModule`, direct no-stale
  content tests, and design-system checks for Loading and Load failed.
- Status: watch

## Use P6 retrospectives as a preflight anti-pattern checklist

- Source: `docs/retrospectives/P6_POSTMORTEM.md`,
  `docs/retrospectives/P6_ROOT_CAUSE_TREE.md`,
  `docs/retrospectives/P6_MULTI_WORKER_ASSESSMENT.md`,
  `docs/retrospectives/P6_REPAIR_ROUND_MATRIX.md`
- Area: implementation, validation, coordination
- Context: P6 consumed six repair rounds while still missing product
  acceptance because evidence, packaging, protocol, and technical-layer work
  competed with vertical user-flow proof.
- Problem: Future milestones can repeat the same pattern if workers pass by
  layer while no one owns a complete user journey.
- Candidate rule: Before any large multi-lane milestone, check for vertical
  owner, failure-first evidence, machine/human gate separation, and
  final-head-bound proof.
- Evidence: First weekly retrospective confirms these retrospectives remain
  the highest-value historical learning source.
- Status: promote

## Centralize repeated foreground-validation disclaimers

- Source: `docs/retrospectives/weekly/2026-W28.md`
- Area: UI/UX, validation, token-cost
- Context: Recent UI/UX reviews repeatedly state that smoke is regression-only
  and foreground macOS evidence is still required.
- Problem: The disclaimer is correct, but repeating it in every adjacent
  visual slice consumes attention without closing acceptance.
- Candidate rule: Maintain one active foreground-validation checklist per
  UI/UX bundle; individual reviews should reference it and only add deltas.
- Evidence: `docs/retrospectives/weekly/2026-W28.md`
- Status: watch

## Use the baseline retrospective before historical deep dives

- Source: `docs/retrospectives/PROJECT_BASELINE_RETROSPECTIVE.md`
- Area: coordination, token-cost
- Context: The expanded first retrospective scanned project history from
  2026-06-02 through 2026-07-06, including docs inventory, review inventory,
  loop history, product docs, retrospectives, overnight reports, decisions,
  research notes, and current Git history.
- Problem: The repository has hundreds of useful historical docs. Reading them
  broadly for ordinary tasks is expensive and often unnecessary.
- Candidate rule: For onboarding, milestone planning, or broad retrospectives,
  read the baseline retrospective first, then open only the historical docs
  matching the current failure pattern or lane.
- Evidence: `docs/retrospectives/PROJECT_BASELINE_RETROSPECTIVE.md`
- Status: promote

## Product resets are acceleration when they are written into authority docs

- Source: `docs/retrospectives/PROJECT_BASELINE_RETROSPECTIVE.md`
- Area: product, coordination
- Context: P5 was reset into editor incubation; short-term scope was corrected;
  UI/UX was reset to canvas-first; AEB was promoted above AI/ComfyUI.
- Problem: Incremental continuation of the wrong lane wastes more time than a
  clear correction.
- Candidate rule: When the Product Owner corrects direction, update the main
  authority doc or subordinate brief quickly, isolate old lanes, and stop
  historical scope from leaking back into the product surface.
- Evidence: P5 reset, short-term PRD correction, UI/UX canvas reset, and AEB
  promotion summarized in the baseline retrospective.
- Status: promote

## Separate decoded image memory from runtime structure memory

- Source:
  `docs/retrospectives/production-cases/2026-07-07-lucky-notice-svga-runtime-structure-memory.md`
- Area: product, implementation, validation
- Context: A real lucky notice SVGA module had modest encoded size and decoded
  image memory, but the client team observed about 20 MiB runtime memory on
  phones. The ending file had only 27 embedded images but 2883 sprites and
  345,960 FrameEntity records.
- Problem: Image-only memory estimates can falsely reassure designers,
  reviewers, and engineers when the actual target-player cost comes from
  parsed timeline objects.
- Candidate rule: Every SVGA performance report should separate decoded image
  memory from runtime structure risk and include sprite count, FrameEntity
  count, sequence fanout, invisible/low-alpha ratios, and target-player
  assumptions.
- Evidence: Lucky notice production case promoted runtime structure diagnostics
  and optimization into `docs/product/PRODUCT_ROADMAP.md` as S17/S18.
- Status: promote

## Use pilot screenshots before batch Figma target capture

- Source: `docs/reviews/2026-07-07-codex-figma-mcp-r1-screenshot-archive.md`
- Area: UI/UX, Figma MCP, validation, token-cost
- Context: R1 target screenshot capture needed 15 Figma MCP screenshot calls
  for the short-term UI/UX design targets while preserving a daily quota
  reserve.
- Problem: A broad screenshot batch can waste quota if screenshot dimensions,
  URL downloading, local archiving, or visual content checks fail after several
  calls have already been consumed.
- Candidate rule: For Figma screenshot archive work, capture one pilot target
  first, download it, hash it, and verify dimensions before batching the
  remaining screenshots. Create a contact sheet for quick visual integrity
  checks.
- Evidence: The R1 pilot caught that rendered screenshots include outer
  window/shadow treatment and can differ from inventory dimensions; one later
  full-frame screenshot crossed the soft time threshold but was usable.
- Status: watch

## Split Figma variable reads by collection

- Source: `docs/reviews/2026-07-07-codex-figma-mcp-r2-token-map.md`
- Area: UI/UX, Figma MCP, design systems, token-cost
- Context: R2 needed exact values for 95 variables across five Figma variable
  collections.
- Problem: A single all-token structured read technically completed but the
  response was too large and got truncated, making it unsafe as a source for
  implementation.
- Candidate rule: For Figma variable extraction, read one collection per call
  and return compact values: colors as CSS hex, aliases as `{alias, aliasName}`,
  and only the fields needed by the implementation map.
- Evidence: The five split collection reads all returned complete payloads,
  while the combined read was truncated.
- Status: watch

## Read Figma components by atomic hierarchy

- Source:
  `docs/reviews/2026-07-07-codex-figma-mcp-atomic-read-strategy.md`,
  `docs/research/figma-mcp-read-packets/r3-atomic-component-hierarchy-20260707.md`
- Area: UI/UX, Figma MCP, design systems, token-cost
- Context: The Owner clarified that the Figma component library is organized by
  module, molecule, and atom, with modules composed from molecules/atoms and
  molecules composed from atoms. The design file was later organized into
  three top-level sections named exactly `atom`, `molecule`, and `module`.
- Problem: A flat component-library scan wastes quota and context, and can
  cause implementation to read isolated low-level components before
  understanding the composed design surface.
- Candidate rule: For atomic component libraries with explicit section
  structure, read the `atom`, `molecule`, and `module` sections directly and
  use the section as classification. Then read module dependencies by work
  package. Avoid global atom or molecule sweeps unless a module contract
  explicitly requires a targeted follow-up.
- Evidence: The revised Figma MCP read plan changes R3 to an atomic hierarchy
  section map and R4 to module-first component contracts. The R3 read confirmed
  the component-library page has only three top-level sections and 39 direct
  children.
- Status: watch

## Keep Figma component reads ultra-compact by default

- Source:
  `docs/research/figma-mcp-read-packets/r3-atomic-component-hierarchy-20260707.md`
- Area: UI/UX, Figma MCP, design systems, token-cost
- Context: R3's richer direct-child component map completed in Figma but the
  tool output channel truncated the response around 20 KB.
- Problem: Component maps can exceed response limits even without deep
  descendant traversal if they include coordinates, repeated metadata, and
  direct instance refs for many nodes.
- Candidate rule: Default component reads should return IDs, names, node type,
  layer classification, child/variant counts, variant property names/options,
  and compact direct refs only. Expand layout, tokens, or descendants for one
  named module or molecule at a time.
- Evidence: R3 call 3 completed with an ultra-compact section map covering all
  39 direct children, while R3 call 2 was too large for final use.
- Status: watch

## Convert Figma hierarchy into a WP read queue before component-detail reads

- Source:
  `docs/research/figma-mcp-read-packets/r3b-wp-component-dependency-plan-20260707.md`
- Area: UI/UX, Figma MCP, design systems, token-cost, implementation planning
- Context: R3 established the Atom/Molecule/Module library hierarchy, but that
  hierarchy alone did not say which component should be read first for each
  implementation work package.
- Problem: Jumping from a hierarchy map directly into R4 can still waste quota
  by reading low-priority modules or broad atom/molecule details.
- Candidate rule: Insert a no-MCP R3b step between hierarchy discovery and R4.
  Map each WP to a module root, allowed follow-up dependencies, blocked
  questions, and a small module-first read queue before requesting more Figma
  access.
- Evidence: R3b narrowed the next R4 action to `Module/启动页模块/默认`
  (`125:42`) with a one-call expected budget and two-call hard cap.
- Status: watch

## Turn Figma token reads into code guardrails before more visual polish

- Source:
  `docs/reviews/2026-07-07-codex-short-term-uiux-wp1a-figma-token-foundation.md`
- Area: UI/UX, design systems, Figma MCP, implementation quality
- Context: R2 produced exact base palette, semantic color, spacing, and radius
  values, but those values only became useful for implementation after they
  were wired into `short-term-macos.tokens.css`.
- Problem: Reading token values without adding code-level checks lets later
  visual work drift back to local color and spacing choices.
- Candidate rule: After a token extraction round, land a small WP that maps the
  extracted variables into code tokens and adds a design-system check before
  starting broad visual polish.
- Evidence: WP1A added Figma R2 base/semantic token coverage and a
  `figma-r2-token-foundation-covered` design-system check.
- Status: watch

## Retry truncated Figma module reads with contract essentials only

- Source:
  `docs/research/figma-mcp-read-packets/r4-launch-module-contract-20260707.md`
- Area: UI/UX, Figma MCP, design systems, token-cost, implementation planning
- Context: R4 targeted a single launch module, but the first module-contract
  read still exceeded the tool output channel because it returned too much
  nested data.
- Problem: A scoped module read can still waste quota if it asks for rich
  descendant metadata instead of the exact implementation contract needed for
  the active WP.
- Candidate rule: When a module read truncates, do not repeat the same request.
  Retry once with contract essentials only: node IDs, names, direct geometry,
  visible text, direct instance main-component IDs, component properties, and
  explicit implementation findings.
- Evidence: The first R4 launch-module read was truncated, while the compact
  retry completed within the hard cap and produced enough information for WP3
  launch visual alignment.
- Status: watch

## Do not turn unresolved Figma component children into unapproved product features

- Source:
  `docs/reviews/2026-07-07-codex-short-term-uiux-settings-sheet-figma-alignment.md`
- Area: UI/UX, Figma MCP, product scope, implementation quality
- Context: R3 mapped `Module/播放控制栏/播放中` to replay, play/pause, loop,
  and fullscreen icon-button children, but the current short-term PRD and
  implementation do not yet confirm loop/fullscreen as visible main-surface
  capabilities.
- Problem: Treating every Figma child as immediately implementable can add
  visible controls or product behavior without Owner/PRD confirmation.
- Candidate rule: When a Figma component child implies new user-visible
  capability, pause that child as a decision item unless the PRD or Owner has
  explicitly confirmed it; continue with style-only slices that do not alter
  capability scope.
- Evidence: The settings-sheet slice used archived Figma visual evidence but
  deliberately did not add loop/fullscreen playback controls.
- Status: watch

## Treat metadata-only Figma variant reads as state indexes

- Source:
  `docs/research/figma-mcp-read-packets/r4-right-surface-state-index-20260707.md`
- Area: UI/UX, Figma MCP, design systems, token-cost, implementation planning
- Context: The Owner authorized an R4 read for `Module/右侧栏` (`227:2861`).
  The available Figma metadata tool returned the component-set state symbols,
  and drilling into `模式=预览, 状态=默认` (`227:2796`) still returned only a
  symbol shell.
- Problem: A metadata-only component-set read can look successful while still
  lacking child structure, visible text, instance refs, geometry, and component
  properties needed for pixel-level implementation.
- Candidate rule: Use metadata-only reads of Figma component-set variants as
  state indexes only. Before implementation, require a structured child/context
  read or explicitly downgrade the work to screenshot-based rough alignment.
- Evidence: Batch 06 captured 16 right-surface states but could not expose the
  default Preview right-surface internals within the two-call hard cap.
- Status: watch

## Validate Figma implementation feasibility through WP dependency components

- Source:
  `docs/research/figma-mcp-read-packets/r4-wp4-right-surface-dependency-contracts-20260707.md`
- Area: UI/UX, Figma MCP, design systems, implementation planning, token-cost
- Context: The right-surface module read only returned state-symbol shells, but
  targeted `get_design_context` reads for the WP4 molecule/atom dependencies
  returned useful structure, typography, spacing, visible copy, variants, and
  screenshot context.
- Problem: Judging implementation feasibility from a failed module-internals
  read alone can cause the team to over-fall back to screenshot-only work or
  over-spend by scanning the full component library.
- Candidate rule: When a high-level module cannot expose internals, read the
  smallest WP dependency set of molecule/atom components before deciding the
  implementation route. If those contracts are sufficient, proceed with
  implementation instead of reading the full library.
- Evidence: Batch 07 used five reads to cover the WP4 right-surface dependency
  set and was enough to start the first high-fidelity Preview right-surface
  implementation pass.
- Status: watch

## Use packaged app identity when dev-mode Electron foreground capture is ambiguous

- Source:
  `docs/reviews/2026-07-07-codex-short-term-uiux-wp4-preview-right-surface-figma-alignment.md`
- Area: UI/UX, validation, foreground evidence, macOS, token-cost
- Context: WP4 right-surface styling changes passed design-system checks,
  focused tests, diff checks, and smoke, but dev-mode foreground screenshots
  were initially blocked by Stage Manager and same-name Electron activation
  ambiguity.
- Problem: Repeating generic activation commands can waste time and may capture
  unrelated private foreground content. Treating smoke as a replacement would
  also weaken UI/UX acceptance quality.
- Candidate rule: When dev-mode Electron foreground targeting is ambiguous,
  package and launch the current source as `Auto SVGA.app`, use the unique app
  identity for menu and window targeting, then capture foreground screenshots.
  Delete any wrong-app screenshots immediately.
- Evidence: Incorrect screenshots were deleted; the packaged app route produced
  usable foreground evidence for launch and real `战狼头像框.svga` preview.
- Status: watch

## Treat Launch window size as its own product state

- Source:
  `docs/reviews/2026-07-07-codex-short-term-uiux-launch-square-window.md`
- Area: UI/UX, macOS desktop behavior, foreground validation
- Context: The Owner clarified that the Launch page should not share the wide
  Preview workbench size. Launch is a compact 1:1 window focused on opening a
  file; Preview, Edit, and Compare need the wide workspace.
- Problem: Reading “full-window Launch canvas” as “same physical window size as
  the workbench” creates unused side space and weakens the startup focus.
- Candidate rule: Model desktop window size as a page-state behavior when the
  Owner has defined different spatial tasks. Keep actual dimensions in host
  tokens and let the renderer send semantic modes only.
- Evidence: The packaged App opened at `720 x 720`, expanded to `1440 x 900`
  after opening real `战狼头像框.svga`, and returned to `720 x 720` after
  `文件 > 关闭文件`.
- Status: watch

## Use clipboard paste for macOS file-dialog paths with Chinese text

- Source:
  `docs/reviews/2026-07-07-codex-short-term-uiux-launch-square-window.md`
- Area: validation, macOS automation, real-material testing, token-cost
- Context: Foreground validation had to open real production material from
  `/Users/huangtengxin/Downloads/auto-svga测试物料/...`.
- Problem: Simulated keystrokes for a non-ASCII path were affected by the
  active input method and produced an invalid path in the macOS file dialog.
- Candidate rule: For foreground validation through macOS file dialogs, copy
  the absolute path to the clipboard, invoke “Go to Folder”, paste, then press
  Return. Do not type Chinese paths character by character.
- Evidence: The clipboard workflow opened `战狼头像框.svga` successfully and
  avoided further failed dialog screenshots.
- Status: watch

## Assert packaged runtime dependency closure

- Source:
  `docs/reviews/2026-07-07-codex-packaged-runtime-protobufjs-dependency-fix.md`
- Area: release, validation, implementation
- Context: The packaged macOS App failed the optimization path with
  `Cannot find package 'protobufjs' imported from .../.runtime/dist/...`,
  while source files were not modified.
- Problem: Development-mode tests can resolve packages from the workspace, but
  the packaged App only has what was copied into `.runtime` and sealed into
  `app.asar`.
- Candidate rule: Whenever `.runtime/dist` imports an external Node package or
  depends on source-control metadata, add that dependency or build fact to the
  packaged runtime closure and assert its expected `app.asar` entries during
  internal packaging. Do not rely on developer-machine module resolution or the
  App being located under a Git checkout as release evidence.
- Evidence: Adding explicit `protobufjs` / `long` / `fast-png` / `fflate` /
  `iobuffer` runtime copies plus package assertions fixed packaged App import
  failures; adding `.runtime/build-info.json` kept the installed App
  current-head bound after it was promoted outside the Git checkout.
- Status: watch

## Scope short-term Preview fixes above generic editor contracts

- Source: `docs/reviews/2026-07-08-codex-short-term-preview-qa-fixes.md`
- Area: implementation, validation
- Context: ASV-QA-20260708-002 needed short-term replacement Preview to keep a
  large replacement image bounded to the original imageKey slot/resource size.
- Problem: Moving that normalization into the generic SVGA resource editor would
  break lower-level callers that intentionally expect exact PNG byte replacement.
- Candidate rule: Put product-specific fit, crop, fallback, and preview policies
  in the product workflow layer unless the lower-level editor contract is
  explicitly changed and all callers agree.
- Evidence: The final fix normalizes only in
  `short-term-image-replacement-workflow`, while generic editor and hardening
  tests continue to pass.
- Status: watch

## Do not judge wide reserved layouts from square smoke screenshots

- Source:
  `docs/reviews/2026-07-09-codex-uiux-edit-reserved-layer-polish.md`
- Area: UI/UX, validation, smoke evidence
- Context: The short-term Edit reserved state is a wide three-column workbench,
  but the smoke artifact for `short-term-edit-reserved` is captured at
  `720 x 720`.
- Problem: A square smoke screenshot can visually clip or underrepresent the
  right reserved operation area, making a valid three-column layout look like a
  missing panel.
- Candidate rule: Treat square smoke screenshots as regression evidence for
  loaded state and obvious visual breakage only. For full-layout acceptance of
  Preview, Edit, and Compare, use a packaged foreground screenshot at the
  owner-visible wide window size.
- Evidence: The Edit reserved smoke screenshot remained `720 x 720` while the
  renderer CSS still defines the short-term three-column layout.
- Status: watch

## Pair new smoke screenshots with host scenario allowlists

- Source:
  `docs/reviews/2026-07-09-codex-uiux-wide-preview-evidence.md`
- Area: UI/UX, validation, desktop smoke
- Context: UI/UX added `short-term-preview-overview-wide` so Preview can be
  inspected at the default workbench ratio instead of only through a square
  smoke screenshot.
- Problem: The first smoke run failed because the renderer requested the new
  capture scenario before the Electron main-process artifact scenario whitelist
  accepted it.
- Candidate rule: Every new product smoke screenshot scenario must update the
  renderer capture call, host allowlist, host sizing/restoration behavior when
  needed, and a unit assertion tying those pieces together.
- Evidence: Adding the allowlist entry and test allowed
  `npm --prefix tools/electron-prototype/experiments/svga-web run desktop:smoke`
  to pass and generated `short-term-preview-overview-wide.png` at `2880 x
  1800` Retina pixels.
- Status: watch

## Separate playback internal resolution from visual canvas size

- Source:
  `docs/reviews/2026-07-09-codex-uiux-preview-canvas-scale-polish.md`
- Area: UI/UX, playback, visual validation
- Context: A wide Preview smoke screenshot showed a `300 x 300` SVGA rendered
  with much larger visual weight than the Owner/Figma canvas-first direction.
- Problem: The playback model correctly kept the canvas internal bitmap at the
  SVGA movie dimensions, but the CSS display size could upscale small source
  canvases to fill a large workbench surface.
- Candidate rule: For default Preview, treat the decoded SVGA movie size as the
  visual upper bound unless a product-approved zoom/fit control exists. Keep
  responsive downscaling for small windows, but do not silently upscale beyond
  source dimensions.
- Evidence: Updating `playbackCanvasFitSize` to cap CSS width/height at movie
  dimensions kept `300 x 300` and `400 x 200` test cases at source size while
  preserving wide-movie downscaling, and desktop smoke still passed.
- Status: watch

## Leave quiet playback space instead of adding unsupported controls

- Source:
  `docs/reviews/2026-07-09-codex-uiux-playback-rhythm-polish.md`
- Area: UI/UX, playback, design system
- Context: Owner/Figma playback references include more compact control rhythm
  than the current implemented action set.
- Problem: Filling the right side of the playback bar with loop, fullscreen, or
  zoom icons would make the layout look closer to a sketch but would add
  controls that were not implemented in this slice.
- Candidate rule: When a design reference implies future controls, first align
  the rhythm of existing controls with tokenized layout space. Add new buttons
  only after product scope and implementation behavior are explicit.
- Evidence: `PlaybackControls` now uses tokenized progress/spacer proportions
  so progress and time read as one group while leaving the trailing region quiet
  and noninteractive.
- Status: watch

## Spend existing Figma packets before new MCP reads

- Source:
  `docs/reviews/2026-07-09-codex-uiux-right-surface-token-rhythm.md`
- Area: UI/UX, Figma MCP, design system
- Context: The Preview right surface still needed visual rhythm refinement, but
  the existing R4 Figma packet already contained component-level values for
  fact-grid spacing and selected tab surfaces.
- Problem: Calling Figma again for every small polish pass would burn daily MCP
  budget without necessarily improving implementation precision.
- Candidate rule: Before a UI/UX polish slice uses a new Figma MCP call, check
  whether a previous read packet already contains the exact token or component
  contract. If it does, implement from that packet and reserve fresh reads for
  unresolved visible mismatches.
- Evidence: The right-surface rhythm pass adjusted only token values and added
  token assertions using the existing R4 packet; design-system check and desktop
  smoke passed without a new Figma read.
- Status: watch

## Spatial interaction contracts need screenshot evidence

- Source:
  `docs/reviews/2026-07-09-codex-uiux-drag-decision-visual-evidence.md`
- Area: UI/UX, validation, drag-and-drop
- Context: The short-term drag decision overlay had already been corrected to
  top/bottom zones, with Compare in the top 25% and Open in the lower 75%.
- Problem: JSON proof can show hit-test correctness, but it cannot show whether
  the visual overlay communicates the spatial priority or whether unrelated UI
  state pollutes the evidence.
- Candidate rule: For spatial interaction contracts, capture at least one clean
  visual evidence screenshot for each high-risk state after the logic proof
  passes. Capture it in the state being evaluated, not after unrelated dirty,
  failure, or settings states.
- Evidence: Adding `short-term-drag-decision-supported.png` and
  `short-term-drag-decision-unsupported.png` exposed an initial polluted capture
  with a save-failure banner; moving the capture earlier produced clean evidence.
- Status: watch

## 2026-07-09 - Treat screenshot viewport as part of visual evidence

- Source task: `uiux-compare-result-rhythm-polish`
- Situation: Compare and Optimization Compare smoke screenshots rendered at
  `1440 x 1440` pixels, which made the right panel look disproportionately wide
  and risked steering the visual polish toward the wrong layout fix.
- Problem: A screenshot can be technically valid but visually misleading when
  its viewport does not match the product surface being judged.
- Candidate rule: Before using a smoke screenshot for UI/UX layout decisions,
  verify its viewport and capture geometry. If the state is meant to represent
  the default workbench, assert the default workbench size in host capture tests.
- Evidence: Registering `short-term-general-compare` and
  `short-term-optimization-result` for the default `1440 x 900` workbench
  viewport changed the evidence from square launch-sized captures to usable
  layout screenshots.
- Status: watch

## Stop Figma reads once the implementation decision is supported

- Source:
  `docs/reviews/2026-07-09-codex-uiux-right-surface-figma-rhythm.md`
- Area: UI/UX, Figma MCP, design system, token-cost
- Context: The Preview right-surface rhythm pass needed current Figma facts for
  panel padding and section spacing. A compact `use_figma` read returned those
  facts, then truncated later in the node list.
- Problem: A truncated Figma response can tempt another read even when the
  returned portion already proves the implementation decision.
- Candidate rule: When a Figma MCP response is truncated, first classify whether
  the needed implementation decision is already supported. If yes, stop the
  batch, record the truncation, and avoid another read.
- Evidence: The batch returned right content size `360 x 800`, padding `16px`,
  vertical gap `4`, header width `328px`, and resource row size `328 x 56`;
  token implementation and smoke validation succeeded without another Figma
  call.
- Status: watch

## Ask one precise Figma question for each visual WP

- Source:
  `docs/reviews/2026-07-09-codex-uiux-optimization-detail-row-polish.md`
- Area: UI/UX, Figma MCP, design system
- Context: The optimization detail surface looked visually heavier than the
  Figma design, but the implementation question was narrow: whether candidate
  findings should be large multi-line cards or compact rows.
- Problem: Broad frame reads can be costly and still fail to answer the specific
  design-to-code decision if the request is too vague.
- Candidate rule: Before a Figma MCP read, phrase the next implementation
  decision as one concrete question, then read only the node or component needed
  to answer it. Stop once the row, token, or module contract is captured.
- Evidence: One targeted read of `预览 / 优化详情` (`82:2669`) returned the
  candidate row size, padding, typography, and state backgrounds needed for a
  tokenized implementation pass.
- Status: watch

## Test component contracts, not incidental HTML order

- Source task: `uiux-test-contract-alignment-after-componentization`
- Area: UI/UX, validation, design system
- Context: The short-term client test suite failed after component-system work
  because several assertions still required exact HTML attribute adjacency,
  broad global bans such as any `role="tablist"`, and old token names.
- Problem: Those assertions caught stale implementation details rather than the
  intended design-system contract, which created repeated false failures before
  the next visual WP could proceed.
- Candidate rule: UI tests for componentized surfaces should assert same-node
  contracts, canonical component/module traces, scoped legacy bans, and semantic
  token consumption. Avoid matching incidental attribute order or old raw token
  plumbing unless that order is itself the product contract.
- Evidence: Updating the playback, settings dialog, asset-filter, compare info,
  optimization metric, and asset-list assertions restored the short-term test
  suite to 36/36 without changing owner-visible UI behavior.
- Status: watch

## Land shared Figma atom contracts before page polish

- Source task: `uiux-r10-shared-atom-contract-landing`
- Area: UI/UX, Figma MCP, design system, implementation sequencing
- Context: The design file already provided atom and molecule component
  contracts for mode switch, text input, text button, metric optimization entry,
  rows, filters, toast, and settings surfaces.
- Problem: Starting with page-level visual tweaks can accidentally invent
  one-off sizes or styles even when the design system already defines reusable
  contracts.
- Candidate rule: After a component-library Figma read, first land shared atom
  and molecule tokens plus design-system checks. Only then move into page-level
  polish.
- Evidence: Landing `152 x 42` mode switch, `172 x 24` text input, `18px`
  metric entry, and `72 x 30` header action contracts passed the design-system
  check and the 36-test short-term suite without a new Figma read or package
  build.
- Status: watch

## Remove forced scrollbar chrome at the shared surface layer

- Source task: `uiux-scrollable-surface-quiet-chrome`
- Area: UI/UX, design system, low-boundary canvas direction
- Context: Right-side information surfaces are intentionally scrollable, but a
  default visible scrollbar/gutter made the UI read like a web panel even after
  spacing and divider tokens were softened.
- Problem: Removing only `scrollbar-gutter: stable` was insufficient in smoke
  evidence; Chromium still rendered a visible default scrollbar thumb.
- Candidate rule: For the 0.1.x canvas-first client, scrollable right/side
  surfaces should share a tokenized quiet-scrollbar contract. Preserve scroll
  behavior and focus outlines, but do not let default scrollbar chrome become a
  persistent hierarchy separator.
- Evidence: Adding a shared `ScrollableSurface` token and pseudo-element rule
  removed the visible scrollbar from Preview and Settings smoke screenshots
  while keeping design-system check, unit tests, and smoke passing.
- Status: watch

## Reuse FileDropTarget language for file-selection empty states

- Source task: `uiux-compare-empty-slot-drop-target`
- Area: UI/UX, design system, canvas-first interaction
- Context: Compare empty and half-empty slots need to invite the same local
  open/drag workflow as Launch, but they must not add a new persistent Compare
  entry point or extra product scope.
- Problem: A lone `打开文件` button floating inside an empty compare canvas
  looked like a disconnected action rather than a native drop target.
- Candidate rule: Empty file-selection canvas states should reuse the shared
  `FileDropTarget` component language when the PRD/Owner references already
  allow open/drag selection: low-emphasis upload icon, approved drag prompt,
  and existing Open action grouped together.
- Evidence: The Compare half-empty smoke screenshot now shows the B slot as a
  quiet drop target while A remains loaded; design-system check, unit tests,
  and smoke passed.
- Status: watch

## Consolidate shared page-state surfaces before per-page polish

- Source task: `uiux-side-surface-settings-sheet-contract`
- Area: UI/UX, design system, visual high-fidelity sequencing
- Context: Preview right information, Compare information, Edit side panels,
  and Settings are distinct page states, but they should read as one coherent
  macOS app surface family.
- Problem: If each page state keeps direct visual references such as
  right-panel background, dialog border, or one-off backdrop styles, later
  high-fidelity polish becomes a set of selector tweaks rather than a design
  system update.
- Candidate rule: Before tuning individual page details, extract shared
  surface material contracts such as `SideSurface` and `SettingsSheet` into
  component tokens, aliases, CSS consumption, and design-system checks.
- Evidence: Preview, Compare, Edit, and Settings now consume shared
  SideSurface/SettingsSheet tokens; design-system check, 36-test suite, and
  desktop smoke passed without new product copy or behavior changes.
- Status: watch

## Hide optional modules until approved content exists

- Source task: `uiux-launch-empty-recent-copy-boundary`
- Area: UI/UX, launch page, copy boundary, design-system checks
- Context: The Launch recent-file area is approved when recent records exist,
  but the Figma R4 contract and PRD do not approve an extra zero-record helper
  sentence.
- Problem: Removing the renderer's empty-copy row alone was not enough because
  the initial HTML still showed a header-only recent block before async
  refresh.
- Candidate rule: Optional page modules should default hidden in static HTML
  and be revealed only when approved content exists. Pair renderer checks with
  initial-state checks so smoke cannot expose header-only half states.
- Evidence: Launch now hides the recent block when no records are available;
  design-system check, 36-test suite, and desktop smoke passed, and the smoke
  launch screenshot no longer shows unapproved empty-copy or a header-only
  recent shell.
- Status: watch

## Promote module spacing values into named component tokens

- Source task: `uiux-settings-module-spacing-contract`
- Area: UI/UX, design system, Figma-to-code
- Context: The R10 component-library read gave the settings sheet module
  spacing, appearance block, and action-area dimensions, but implementation had
  some of those values hidden as generic spacing utilities.
- Problem: Generic spacing variables inside component selectors make later
  design tuning harder because it is unclear whether a value belongs to the
  module contract or incidental CSS.
- Candidate rule: When Figma provides a module-level value, expose it as a
  named component token and consume the alias in CSS, even if the raw value is
  currently equal to an existing spacing scale token.
- Evidence: SettingsSheet / ThemeSegmentedControl now use explicit sheet gap,
  appearance block height, block gap, and block padding tokens; design-system
  check, 36-test suite, and smoke passed without new copy or behavior.
- Status: watch

## Promote reused atoms before adding more module variants

- Source task: `uiux-icon-button-atom-contract`
- Area: UI/UX, design system, component reuse
- Context: The playback bar already used the Figma `Atom/图标按钮` dimensions,
  but those values were still encoded as playback-specific tokens and selectors.
- Problem: Leaving shared atom values inside the first consuming module makes
  later icon buttons likely to fork into one-off systems.
- Candidate rule: When a component-library atom is used by a module, promote
  the reusable atom dimensions and states into named component tokens before
  extending that control to other surfaces.
- Evidence: IconButton now owns 44px size, 20px icon size, 8px radius, primary
  and secondary state tokens; playback buttons consume those aliases. Design
  system check, 36-test suite, and smoke passed.
- Status: watch

## Treat page-state frames as a third design-system source

- Source task: `uiux-page-state-tri-source-contract`
- Area: UI/UX, Figma-to-code, high-fidelity sequencing
- Context: Token and component mapping were already improving, but page-level
  polish still risked using CSS selectors or a single screenshot as the main
  source of truth.
- Problem: Launch, Preview, Compare, Edit, and Settings have different Figma
  frame dimensions and module compositions. A global window or page-state CSS
  rule can silently break one state while visually improving another.
- Candidate rule: Before page-level polish, record the page-state contract as
  data: Figma state name, code page state, frame size, root modules, read
  packets, and implementation files. Then make the design-system check verify
  the token, component, and page-state links together.
- Evidence: `design-system-map.json` now includes Launch, Preview,
  Optimization, Compare, Edit, and Settings page-state entries; design-system
  check verifies read packets, HTML/module mapping, and frame-layout tokens;
  unit tests passed `36/36`.
- Status: watch

## Align native window frames before page-detail polish

- Source task: `uiux-workbench-frame-alignment`
- Area: UI/UX, Figma-to-code, macOS window frame
- Context: Figma page states use 640 x 640 for Launch and 1280 x 800 for the
  workbench pages, while the runtime workbench still opened and captured most
  short-term scenarios at the historical 1440 x 900 frame.
- Problem: If runtime window bounds drift from the page-state design frame,
  page-level screenshots, right-surface rhythm, and canvas proportions can all
  appear slightly wrong even when component tokens are correct.
- Candidate rule: Before high-fidelity page polish, verify the native window
  sizing contract, CSS page tokens, design-system map, and screenshot scenario
  sizing against the same Figma page-state frame.
- Evidence: Short-term workbench mode now uses a 1280 x 800 sizing target while
  the historical 1440 x 900 wide evidence scenario remains separate;
  design-system check and the 36-test suite passed.
- Status: watch

## Guard page-level polish as module contracts, not selector tweaks

- Source task: `uiux-compare-header-contract`
- Area: UI/UX, compare mode, design-system checks
- Context: The R9 Compare loaded contract includes a right-surface header row
  and divider rhythm, but the implementation could easily drift through local
  CSS changes.
- Problem: Tiny visual polish becomes hard to evaluate when it changes a
  selector but does not record which token, component, and page-state contract
  it implements.
- Candidate rule: A page-level visual adjustment should add or consume a named
  component token and a design-system check when it claims Figma alignment.
  Otherwise defer it until a larger visual batch can validate it.
- Evidence: Compare mode header now consumes a 54px header-height token and
  shared right-surface divider, with design-system and unit checks guarding the
  contract.
- Status: watch

## Gate reference-design icons through product scope before implementation

- Source task: `uiux-playback-loop-control`
- Area: UI/UX, design-to-code, product scope control
- Context: The Figma playback area contains icon controls, while the 0.1.x
  UI/UX brief names the supported playback action group as Play/Pause, Replay,
  and Loop if supported.
- Problem: A high-fidelity implementation can accidentally promote every icon
  seen in a design reference into product behavior, adding undocumented entries
  such as fullscreen or future controls.
- Candidate rule: Before implementing a control from a Figma page or component,
  classify it against the PRD/action contract: documented action, visual-only
  reference, deferred capability, or out-of-scope. Implement only documented
  actions unless Owner/PM explicitly expands scope.
- Evidence: Playback loop was implemented because it is documented; fullscreen
  was explicitly blocked by design-system checks. Direct loop-state tests,
  design-system check, focused tests, and full spike suite passed.
- Status: watch

## Validate real preload globals, not just bridge factories

- Source:
  `docs/reviews/2026-07-10-codex-hb-cr-001-electron-host-boundary-repair.md`
- Area: Electron, host boundary, security, Code Review
- Context: The short-term host-adapter factory test said deferred Workbench
  methods were absent from the product bridge, but the actual `preload.cjs`
  still exposed a legacy bridge in formal short-term runtime.
- Problem: Factory-level contract tests can pass while the real preload global
  surface remains too wide.
- Candidate rule: For Electron host-boundary work, VM-load the actual
  `preload.cjs` with formal product arguments and assert exact global names,
  bridge keys, and blocked helper/deferred methods.
- Evidence: Adding real preload VM allowlist tests caught and then locked down
  `autoSvgaPrototype`, deferred save methods, artifact scan, reference-media,
  proof helpers, and AEB intake exposure in formal short-term mode.
- Status: watch

## Approve motion-format dependencies before installing renderers

- Source:
  `docs/reviews/2026-07-10-codex-0.2-multiformat-wp0.md`
- Area: multi-format, dependency governance, preview playback
- Context: The 0.2 multi-format lane needs Lottie and VAP playback/inspection,
  but the current owner-visible 0.1 client must remain SVGA-only and offline.
- Problem: Installing a renderer before license, maintenance, size, offline,
  redistribution, and rollback review can make a research spike look like
  supported product surface.
- Candidate rule: For each new motion-format renderer or player, complete and
  record dependency review before adding it to `package.json`, then keep the
  adapter behind a 0.2-only gate with typed missing-dependency and unsupported
  feature states.
- Evidence: WP0 reviewed `lottie-web`, `@lottiefiles/dotlottie-web`, Tencent
  VAP references, and `video-animation-player` without adding dependencies;
  the only code change was a 0.1 command-menu guard test.
- Status: watch

## Treat motion-format metadata as hints until content evidence agrees

- Source:
  `docs/reviews/2026-07-10-codex-0.2-multiformat-wp1.md`
- Area: multi-format, format detection, false-positive prevention
- Context: WP1 needed to distinguish SVGA, Lottie JSON, and VAP/MP4 without
  installing a parser, renderer, codec, or player.
- Problem: Extension and media-type routing alone can misclassify generic JSON,
  renamed compressed files, or ordinary MP4 as supported motion formats.
- Candidate rule: Keep extension and media type as low-confidence hints. Return
  a confirmed probe result only when bounded content evidence agrees; otherwise
  return a candidate, typed precondition, or ambiguous result without selecting
  a production parser/player.
- Evidence: Generic and malformed JSON, ordinary and malformed MP4, conflicting
  extension/media/content, and single-signal SVGA fixtures all fail closed in
  WP1 tests while path feedback remains redacted.
- Status: watch

## Add failure-first tests for every detected-threshold field

- Source:
  `docs/reviews/2026-07-10-codex-0.2-multiformat-wp1.md`
- Area: multi-format, parser boundary, Code Review repair
- Context: Code Review found that WP1 correctly separated candidates from
  detected formats in common cases, but still let malformed binary minima cross
  the detected threshold.
- Problem: A detector can satisfy byte-size arithmetic while missing semantic
  requirements such as zlib CINFO bounds, MP4 `ftyp` payload minima, or
  non-empty `vapc` payload evidence.
- Candidate rule: Whenever a field or structure is required to move from
  candidate to detected, add the matching negative fixture before treating the
  detector as implementation ready.
- Evidence: Invalid zlib bytes `0x88 0x1c`, header-only `ftyp`/`vapc`,
  empty `vapc`, extended-size boxes, size-zero boxes, declared overflow, and
  damaged trailing data now stay at `candidate` with `parse_precondition`.
- Status: watch

## Treat Lottie external assets as metadata until a resolver is approved

- Source:
  `docs/reviews/2026-07-10-codex-0.2-multiformat-wp2a.md`
- Area: multi-format, Lottie, path safety
- Context: WP2A inspects Lottie JSON with built-in parsing only and must not
  read production assets or expose visible Lottie support.
- Problem: Trusting image asset paths during parser inspection can leak local
  paths, cross package boundaries, or quietly turn metadata inspection into
  unsupported asset loading.
- Candidate rule: Normalize relative image references as metadata only, reject
  absolute paths, parent traversal, URL schemes, missing paths, duplicate asset
  ids, and missing layer references, and defer file reads to an approved host
  resolver gate.
- Evidence: WP2A synthetic tests cover safe relative metadata, absolute paths,
  parent traversal, file URLs, missing `p`, duplicate ids, missing references,
  and bounded reads without asset access.
- Status: watch

## Keep normalized Lottie resource references internally consistent

- Source:
  `docs/reviews/2026-07-10-codex-0.2-multiformat-wp2a.md`
- Area: multi-format, Lottie, parser normalization
- Context: WP2A Code Review found that top-level inspection missed unsupported
  markers nested inside precomp assets and that embedded image layers could
  reference an asset id with no corresponding resource.
- Problem: Metadata-only inspection can still mislead downstream tooling if
  unsupported markers are hidden or layer `resourceIds` point at resources that
  were not emitted.
- Candidate rule: For every Lottie structure normalized into `MotionAssetInfo`,
  traverse the nested layer arrays represented by that structure and ensure
  every emitted layer resource reference resolves to an emitted resource and
  that layer-level replacement candidate flags agree with unsupported resource
  metadata, even when the payload itself remains unsupported.
- Evidence: WP2A repair tests cover nested precomp mask/effect paths and a
  referenced embedded image represented as a non-replaceable metadata resource
  and non-replaceable image layer.
- Status: watch

## Pin renderer approval to one entry point and one hidden spike

- Source:
  `docs/reviews/2026-07-10-codex-0.2-multiformat-wp2b-dependency-decision.md`
- Area: multi-format, dependency governance, Lottie playback
- Context: WP2B needed a current dependency decision after WP2A metadata
  inspection passed QA, but renderer adoption itself still required Owner
  approval.
- Problem: A dependency review can accidentally turn into broad renderer
  approval if it accepts an entire package family, every renderer backend, or
  visible UI at once.
- Candidate rule: Dependency gates should name the exact package, version,
  entry point, import boundary, fixture scope, and non-claims before any
  install or lockfile mutation.
- Evidence: WP2B recommends only `lottie-web@5.13.0` with
  `lottie-web/build/player/lottie_svg` for a hidden SVG spike, and defers
  `@lottiefiles/dotlottie-web@0.77.0` because WASM and `.lottie` scope exceed
  the first JSON playback gate.
- Status: watch

## Keep renderer spikes hidden until host playback evidence exists

- Source:
  `docs/reviews/2026-07-10-codex-0.2-multiformat-wp2b-spike.md`
- Area: multi-format, Lottie playback, dependency integration
- Context: WP2B adopted `lottie-web@5.13.0` for a hidden SVG adapter after
  Product Owner approval, while keeping 0.1 visible behavior SVGA-only.
- Problem: A dependency import and lifecycle adapter can be mistaken for
  product support if review language does not separate hidden adapter evidence
  from host-rendered playback evidence.
- Candidate rule: For browser-oriented renderers, prove lifecycle, typed
  failures, bundle chunks, and 0.1 isolation first; require separate host DOM
  playback evidence before claiming user-visible support.
- Evidence: WP2B focused tests use injected renderer doubles, verify the real
  default loader fails typed in a non-DOM test host, and record dynamic
  renderer chunk size without adding UI/open-flow integration.
- Status: watch
## 2026-07-10: Bind Renderer Failures To The Active Instance

- Candidate lesson: Player adapters should remove renderer listeners during
  unload and also guard callbacks by active-instance identity. Listener removal
  alone cannot neutralize callbacks already queued by the renderer.
- Evidence: WP2B failure-first probes showed old Lottie callbacks could mutate
  disposed or reloaded sessions, and renderer errors left the failed animation
  alive. Instance binding plus one cleanup path closed all three probes.
- Status: Candidate pending reuse in another player adapter.

## 2026-07-10: Resolve External Motion Resources Through A Bounded Host Gate

- Candidate lesson: External motion resources should pass through a host-owned
  bounded resolver before renderer load. The renderer should receive sanitized
  data or a typed failure, not raw local paths.
- Evidence: The hidden Lottie preview vertical resolves deterministic adjacent
  image references with bounded host reads, inlines safe images as data URIs,
  blocks missing/oversized/unsupported resources before renderer load, and keeps
  the WP2B adapter strict by default unless resolved image resources are
  explicitly allowed.
- Status: Candidate pending reuse in VAP fusion resources or visible 0.2
  integration.

## 2026-07-10: Bind Local Opens To Request Generations

- Candidate lesson: Local open flows that cross host reads, format probing,
  inspection, resource resolution, and renderer preparation need a request
  generation guard after every awaited boundary. Request ids and display names
  on the current model are not enough to prove stale async work still owns the
  source content it is about to commit.
- Evidence: The hidden Lottie preview vertical Code Review probe showed a slow
  first open could overwrite a faster second open with stale inspection and
  playback content while leaving the newer request id visible. A delayed
  range-read regression plus generation/session binding now keeps the fast
  model final and prevents disposed sessions from later controls.
- Status: Candidate pending reuse in visible 0.2 open integration and VAP
  inspector/playback paths.

## 2026-07-10: Cancel Before Renderer Side Effects

- Candidate lesson: Player adapter `load()` calls are not atomic if they await
  dependency loading, inspection, or bounded data reads before invoking a real
  renderer. Request freshness must be checked immediately before renderer
  entry points such as `loadAnimation()` that can mutate a shared DOM/container.
- Evidence: The hidden Lottie preview vertical first repair protected final
  model commits, but Code Review still reproduced stale `loadAnimation()` after
  a newer open won. Passing request cancellation into `PlaybackSession.load()`
  and re-checking cancellation/disposed state before `renderer.loadAnimation()`
  prevents stale container mutation in the delayed renderer-loader regression.
- Status: Candidate pending reuse in VAP playback and any visible 0.2
  renderer integration.

## 2026-07-10: Keep VAP Inspection Separate From VAP Runtime Adoption

- Candidate lesson: VAP parser/readiness work should land before a player
  dependency. `vapc` extraction, fusion metadata, ordinary MP4 false positives,
  corrupt box handling, over-limit dimensions, and codec/audio facts can be
  tested with synthetic bytes without installing a stopped-maintenance WebGL
  runtime.
- Evidence: The hidden VAP inspection milestone normalizes MP4/vapc facts and
  produces the Tencent Web dependency decision while leaving package.json and
  pnpm-lock unchanged. Runtime adoption remains a Product Owner gate.
- Status: Candidate pending reuse in VAP playback dependency approval.

## 2026-07-10: Validate Fusion Element References Before Candidate UI

- Candidate lesson: Fusion element placeholders are future replacement
  candidates only when their source ids are unique and frame placement
  references close over known sources. Missing runtime replacement data can be
  a warning, but duplicate ids or dangling frame references should fail closed.
- Evidence: The hidden VAP inspection tests cover image/text fusion sources,
  missing runtime tags, duplicate `srcId`, and frame objects that reference a
  missing source before any visible replacement UI exists.
- Status: Candidate pending reuse in visible 0.2 assets/fusion surface.

## 2026-07-10: Prefer Range Reads And Preserve Complete Config Prefixes

- Candidate lesson: Format inspectors should prefer an available bounded
  `readRange` over caller-provided size metadata. Bounded-prefix parsers should
  keep complete metadata/config facts before intentionally clipped media
  payloads, while keeping malformed metadata boxes fail-closed.
- Evidence: The VAP inspection repair for `MF-VAP-CR-001` now accepts a valid
  range-readable source with `sizeBytes=NaN` using `readRange(0, 262144)` and
  preserves complete `ftyp`/`moov`/`vapc` facts before clipped trailing
  `mdat`. Regression tests still reject clipped `mdat` before `vapc`, clipped
  `vapc`, duplicate/missing `vapc`, invalid JSON, ordinary MP4, and trailing
  damaged bytes.
- Status: Candidate pending reuse in future VAP playback host reads and other
  bounded media/container inspectors.

## 2026-07-11: Bind VAP Runtime Approval To A Preparation Model Before Import

- Candidate lesson: VAP runtime approval should be represented as a typed
  preparation state before importing a WebGL player. The model should bind the
  exact dependency/version, host capabilities, H.264/container facts,
  1504-limit warnings, fusion replacement bindings, cancellation boundaries,
  disposal steps, and support-claim falsehood in one place.
- Evidence: WP3B adds a dependency-free VAP playback preparation service and
  tests for pending dependency, approved-but-prepared, missing host capability,
  unsupported codec, duplicate fusion tags, missing fusion replacements,
  dangling resource references, and cancellation.
- Status: Candidate pending reuse in the eventual VAP playback spike.

## 2026-07-11: Reject Network-Capable Renderer Inputs Before Runtime Load

- Candidate lesson: Hidden player adapters should validate replacement/resource
  values before a stopped-maintenance renderer sees them. A local object URL for
  the main media is not enough if fusion image strings can still become
  `Image.src`, XHR, or CDN/network loads inside the runtime.
- Evidence: The VAP runtime spike passes embedded `vapc` config objects and
  host-owned `blob:` MP4 URLs, disables runtime precache, and rejects fusion
  image replacements unless they are `blob:` or `data:image/...`. Regression
  coverage proves network image replacement input fails before local reads,
  object URL creation, or runtime construction.
- Status: Candidate pending reuse in visible 0.2 multi-format resource
  replacement UI and future renderer integrations.

## 2026-07-11: Guard Multi-format Composition Separately From Child Verticals

- Candidate lesson: A combined workspace must own request-generation and stale
  side-effect checks even when each delegated format vertical is already
  guarded. The composition layer can still mix active model, source, playback,
  or container state across formats if it only trusts child session correctness.
- Evidence: WP4 adds a hidden multi-format workspace that delegates Lottie and
  VAP to their accepted verticals and maps SVGA through an injected adapter.
  Regression coverage blocks an old Lottie request inside renderer loading,
  completes a newer SVGA open, releases the old request, and asserts no stale
  renderer load or final-model overwrite occurs.
- Status: Candidate pending reuse in any visible 0.2 workspace or future
  format-selection/open-flow integration.

## 2026-07-11: Keep Runtime Replacement Preview Separate From Save/Export

- Candidate lesson: A visible-candidate multi-format preview should treat
  replacement as a runtime preview/remount state until each format has an
  approved persistent edit/save contract. Lottie `animationData`, VAP fusion
  params, and SVGA imageKey preview bytes can share a dirty/reset model without
  implying authoring, export, or package support.
- Evidence: WP5 adds a gated `0.2.0-alpha.1` owner-preview candidate model that
  reloads Lottie image/text replacements into bounded renderer data, passes VAP
  fusion replacements into the hidden runtime config, and exposes SVGA
  imageKey replacement through an injected preview controller. Tests prove
  reset, stale replacement cancellation, unsafe URL rejection, and `0.1.x`
  command-menu isolation.
- Status: Candidate pending reuse in visible shell integration and Packaging
  QA.

## 2026-07-11: Preflight Reset Before Reopening Delegated Preview Workspaces

- Candidate lesson: Runtime reset is not just apply-with-empty-replacements.
  If reset calls a delegated workspace that disposes active renderer/runtime
  state before proving the original source is still readable, a missing source
  can erase dirty/reset context and report a false accepted reset.
- Evidence: WP5 repair for `MF-WP5-CR-001` stores the candidate host for a
  bounded preflight before Lottie/VAP reset. Failure-first tests remove the
  original source after a runtime replacement and prove reset now fails closed,
  keeps the active replacement record, keeps reset enabled, and redacts the
  path for both Lottie and VAP.
- Status: Candidate pending reuse in WP6 desktop integration and any future
  cross-format replacement shell.

## 2026-07-11: Define Reset Success By Format-aware Issue Semantics

- Candidate lesson: A cross-format reset flow must not accept a coarse
  workspace status such as `playbackBlocked` without checking why the format
  is blocked. Some blocked source states are valid reset targets, while
  missing source dependencies, parse failures, and renderer/session reload
  failures must keep the current replacement preview dirty and reset-enabled.
- Evidence: WP5 repair 2 for `MF-WP5-CR-001R` records the second consecutive
  review finding, preflights Lottie adjacent image dependencies captured from
  the original source-open model, accepts only format-aware VAP blocked-reset
  reasons, and rolls back to the prior replacement session when Lottie renderer
  reload fails after preflight.
- Status: Candidate pending Code Review re-review and reuse in WP6 desktop
  integration.

## 2026-07-11: Split Product-mode Bridges Instead Of Widening 0.1 Formal APIs

- Candidate lesson: When a future product mode becomes visible, give it a
  separate preload/API bridge and menu contract instead of adding optional
  future-format methods to the current formal `0.1` bridge. This keeps current
  owner-visible behavior auditable and makes support claims explicit.
- Evidence: WP6 adds the formal `0.2-multiformat-preview` desktop mode on the
  canonical UIUX/HB host base. The 0.2 bridge exposes local SVGA/Lottie/VAP
  preview operations, while the `short-term` formal bridge continues to expose
  only SVGA open/save APIs. Focused Electron tests prove both bridge shapes and
  the short-term design-system guard still pass.
- Status: Candidate pending WP6 Code Review and future package-candidate
  validation.

## 2026-07-11: Guard Hidden IPC Before Host UI Side Effects

- Candidate lesson: Preload isolation is not enough for future product modes.
  Hidden main-process IPC channels must perform product-mode rejection before
  file dialogs, session construction, source registration, renderer calls, or
  replacement/playback side effects.
- Evidence: WP6 repair for `MF-WP6-CR-001` adds a pre-dialog guard to
  `openMultiFormatFile()` and repeats the product-mode assertion in every
  multi-format IPC handler before delegating to open/drop/control/replace/reset
  targets. Focused regression proves the guard order without foreground
  Electron automation.
- Status: Candidate pending WP6 Code Review re-review and reuse for future
  desktop host-boundary work.

## 2026-07-11: Bind Candidate Package Identity To Packaged Runtime Closure

- Candidate lesson: Multi-version package candidates must prove both outer
  bundle identity and embedded runtime identity. A matching Info.plist stamp is
  not enough if packaged `app.asar` still carries stale `.runtime/build-info`
  or omits newly approved runtime dependencies.
- Evidence: The 0.2 alpha.1 packaging proof repair stamps
  `0.2.0-alpha.1`, records product/stage/channel identity, reads packaged
  `app.asar` runtime build info, and validates `lottie-web@5.13.0` plus
  `video-animation-player@1.0.5` closure with failure-first tests for stale
  identity, stale runtime commit, missing Lottie entry, and stale VAP version.
- Status: Candidate pending Code Review and the later 0.2 package-candidate
  retry gate.

## 2026-07-11: Keep Real-material Qualification Metadata-only Until Foreground QA

- Candidate lesson: A source-side qualification matrix can inventory approved
  local material categories with filename/size metadata only, but it must not
  be treated as playback, visual, package, or product-support evidence.
- Evidence: WP7 adds a read-only multi-format qualification harness for
  `/Users/huangtengxin/Downloads/auto-svga测试物料`. It scans directory entries
  and file sizes only, reports aggregate SVGA/Lottie JSON/VAP-MP4 bucket
  coverage, and commits no raw paths, bytes, screenshots, frames, media, or
  production assets.
- Status: Candidate pending WP7 Code Review and any future foreground/package
  acceptance route.

## 2026-07-11: Derive Multi-format Inventory From Accepted Preview Models

- Candidate lesson: Cross-format right-panel inventory should be a derived
  view model over accepted parser/playback contracts, not a new parser or
  replacement authority. This keeps SVGA imageKey, Lottie image/text, and VAP
  fusion tag behavior consistent while making unsupported and not-applicable
  format capabilities explicit.
- Evidence: WP7 introduces `buildMultiFormatAssetInventory()` and wires it into
  the owner candidate and desktop right panel. Tests cover SVGA resource and
  sequence roles, Lottie image/text candidates, VAP fusion/media facts, unknown
  fusion unsupported handling, and VAP fusion resource de-duplication.
- Status: Candidate pending WP7 Code Review and QA source-side acceptance.

## 2026-07-11: Integrate Product-line Alphas Through Packaging Proof Line

- Candidate lesson: A successor alpha package branch should integrate accepted
  product source and packaging proof hardening before any archive is generated.
  The source-facing candidate version and macOS package proof version must move
  together.
- Evidence: The `0.2.0-alpha.2` packaging integration branch cherry-picks WP7
  onto the accepted `0.2.0-alpha.1` runtime-proof line, preserves app.asar
  runtime binding checks, and updates both owner-preview product version and
  package proof identity to `0.2.0-alpha.2`.
- Status: Candidate pending Code Review before any package-candidate rebuild.

## 2026-07-11: Redact At Derived Inventory Boundaries

- Candidate lesson: A derived owner-visible inventory is a privacy boundary in
  its own right. Even when upstream parser or candidate models are expected to
  be redacted, the inventory builder must sanitize all copied identifiers,
  labels, runtime target ids, detail text, issue messages, and unsupported
  feature paths before it can truthfully return `pathRedacted=true`.
- Evidence: WP7 repair for `MF-WP7-CR-001` adds failure-first coverage for
  POSIX and Windows local paths flowing through asset ids/names, Lottie text
  metadata, VAP fusion tags/bindings/resource ids, issue messages, and
  unsupported feature paths. The repair centralizes `redactLocalPaths()` at
  `buildMultiFormatAssetInventory()` output assignment.
- Status: Candidate pending WP7 Code Review re-review and reuse for future
  derived UI/readiness view models.

## 2026-07-11: Test Redaction Helpers With Mixed Path Families

- Candidate lesson: Local-path redaction helpers should cover mixed POSIX and
  Windows paths in the same string, including residual fragments that no
  longer contain the original drive-letter prefix.
- Evidence: WP7 repair 2 for `MF-WP7-CR-001R` changes the shared redactor to
  match Windows drive-letter paths before greedy POSIX paths and adds a
  residual `:\Users\...` / `\Users\...` fallback. Focused helper and inventory
  regressions reject `/Users/alice`, `C:\Users\alice`, `:\Users\alice`,
  `\Users\alice`, usernames, and sensitive project names in serialized
  owner-visible inventory output.
- Status: Candidate pending WP7 Code Review repair 2 re-review and reuse for
  future privacy helpers.

## 2026-07-11: Bind Installed Product Mode, Not Just Package Version

- Candidate lesson: A packaged alpha can have correct Info.plist version
  stamps and runtime dependencies while still launching the wrong product mode.
  Package candidates need an explicit packaged runtime mode marker that the
  Electron main process consumes when LaunchServices does not provide the
  development environment.
- Evidence: ASV-QA-20260711-001 foreground QA showed installed alpha2 opened
  SVGA but Lottie/VAP silently stayed on the prior SVGA state. The repair
  stamps `.runtime/build-info.json` with
  `productMilestoneId: "0.2-multiformat-preview"` and reads that marker only
  for packaged apps before falling back to formal `short-term`.
- Status: Candidate pending QA regression on a rebuilt installed alpha2 repair
  package.

## 2026-07-11: Terminalize Desktop Open Results At The UI Boundary

- Candidate lesson: Desktop open flows should convert rejected, malformed,
  missing-model, and stalled host results into typed path-redacted terminal
  states at the renderer boundary. Returning to Launch or staying Loading after
  a user-selected file hides the true failure and blocks QA from diagnosing the
  next gate.
- Evidence: ASV-QA-20260711-001 permit 028 showed installed Lottie returned
  from Loading to Launch and VAP stayed Loading after the package mode binding
  repair. The terminal-state repair adds packaged `.runtime` root binding plus
  main-process and renderer terminalization, with focused regressions for
  missing model, rejection, timeout, and synthetic Lottie/VAP open terminal
  states.
- Status: Candidate pending Code Review and rebuilt-package foreground QA
  regression.

## 2026-07-12: Treat Installed File-open As Its Own Desktop Intake

- Candidate lesson: macOS installed app file-open events are a separate
  Electron intake path from menu/dialog open and drag/drop. Foreground QA that
  opens files through LaunchServices needs a first-class `open-file` contract
  that enters the same terminal preview/failure model as other open paths.
- Evidence: `ASV-QA-20260711-001` permit `ASV-APR-20260712-009` showed Lottie
  and VAP aliases returning to Launch after exact installed app file-open
  events, even though menu/dialog and session contracts were covered. The
  repair adds formal-0.2-only `app.on("open-file")` queuing, renderer-ready
  flushing, hidden terminal actions, and eventId/request-generation guards.
- Status: Candidate pending Code Review, package rebuild/install, and QA
  foreground regression.

## 2026-07-13: Stop Fake Browser Proofs At Repeated Environment Gaps

- Candidate lesson: When a source-local fake browser/VM smoke repeatedly fails
  on browser-environment primitives instead of product logic, stop expanding
  the fake runtime. Preserve source/runtime contracts and move actual playback
  proof to the package plus bounded foreground gate.
- Evidence: The owner-visible Lottie/VAP preview vertical reached prepared
  payload, self-hosted endpoint, renderer mount, sidecar VAP, and
  replacement/reset source contracts. A temporary self-hosted VM smoke then hit
  read-only `navigator`, UMD branch, canvas/script discovery, and timer/runtime
  gaps, so the incomplete VM-smoke additions were removed per PM stop route.
- Status: Candidate pending Code Review and reuse for future browser/runtime
  evidence ladders.

## 2026-07-13: Replay Desktop Intake Discriminants Through The Whole Session

- Candidate lesson: A desktop host event is not covered when tests only prove
  that main receives it and renderer can consume a fabricated result. Replay
  the exact source discriminant through validation, detection, session result,
  runtime preparation, controls, and remount identity in one test.
- Evidence: permit 016 showed installed Lottie and VAP all failed as incomplete
  input because main used `fileOpenEvent` while downstream validators accepted
  only dialog/menu/drag sources. The repair adds same-shape temporary-file tests
  and keeps the active hashed source id through play/pause/replacement/reset.
- Status: Candidate pending Code Review and rebuilt-package foreground
  regression.

## 2026-07-14: Validate Every Field A Security Normalizer Preserves

- Candidate lesson: A security or CSP normalizer must validate the complete
  record it clones, not only the fields it rewrites. Otherwise malformed
  optional metadata can cross the declared fail-closed boundary unchanged.
- Evidence: `MF-REAL-RENDER-CR-003` reproduced a Lottie loopOut property whose
  ordered numeric `t/s` values passed while malformed `i.x`, `e`, and `h`
  fields still reached a prepared runtime payload. The repair defines a narrow
  whole-keyframe grammar and tests end vectors, paired easing and spatial
  tangents, hold flags, dimensions, types, unknown fields, path redaction, and
  source immutability.
- Status: Candidate pending independent Code Review re-review and reuse at a
  second normalization boundary.

## 2026-07-14: Bind Replacement Evidence To Runtime Keys And Pixels

- Candidate lesson: Owner-visible replacement ids and runtime binding keys are
  separate contracts. A dirty model and successful remount are insufficient;
  evidence must prove the packaged runtime received the canonical binding,
  decoded it, changed a deterministic rendered frame, and restored the exact
  source frame after Reset.
- Evidence: Permit 058 changed inventory/issues and enabled Reset while source
  and replacement frames stayed byte-identical. The real runtime discriminator
  showed the selected resource id never became the VAP `avatar` constructor
  option, `srcData`, or texture. The repair canonicalizes only the private VAP
  image runtime value and adds exact frame-zero pixel, paused-stability, reset,
  lifecycle, and no-network gates.
- Status: Candidate pending independent source review and rebuilt installed
  replacement/reset QA.

## 2026-07-14: Give Replacement Selection One Public Namespace

- Candidate lesson: A public replacement selector must use one collision-checked
  identity namespace. Resolve that identity once to a canonical runtime key at
  the owner/host authority boundary, snapshot the binding across asynchronous
  pickers, and make renderers consume the accepted key without alias fallback.
- Evidence: `MF-VAP-FUSION-CR-001` reproduced a VAP record whose public
  `resourceId` matched an earlier record's `srcTag`. Ordered cross-namespace
  lookup selected the wrong fusion target even though the collision-free pixel
  proof passed. A second failure-first case showed preparation marked duplicate
  `srcTag` bindings failed but still carried both records, so the owner boundary
  also needs its own canonical-key uniqueness check. The repair uses public
  `resourceId`, rejects zero/duplicate/malformed/nonreplaceable/stale bindings
  without mutation, and requires the accepted owner result to return the exact
  unique canonical runtime key. Product proof harnesses must traverse that same
  authority instead of returning the requested public id as a runtime key.
- Status: Candidate pending independent Code Review re-review and installed
  replacement/reset QA. `MF-VAP-FUSION-PM-001` extended the regression from
  the dedicated pixel proof to both shared real-runtime proof shims after they
  were found echoing the public id directly.

## 2026-07-14: Extend The Owner Workflow Instead Of Replacing It

- Candidate lesson: A new-format shell should compose the accepted workflow for
  the current format and add capability-specific behavior. Replacing that
  workflow with a generic candidate controller can preserve playback while
  silently dropping editing, save, recent-file, menu, and recovery contracts.
- Evidence: `ASV-QA-20260714-002` through `008` traced one split 0.2 controller
  and intake architecture to layout, copy, recent-file, capability-panel, and
  formal 0.1 SVGA regressions. The repair delegates SVGA to the accepted
  short-term controller and keeps one host-owned intake contract for all
  formats.
- Status: Candidate pending independent Code Review and rebuilt installed QA.

## 2026-07-15: Keep Human Picker Time Outside Loading Deadlines

- Candidate lesson: A native chooser is an unbounded human interaction phase,
  not a parser/loading terminal phase. Start bounded loading deadlines only
  after accepted input reaches the host-owned intake contract.
- Evidence: Permit 069 left the chooser open long enough for the renderer's
  15-second race to synthesize a failed Preview before exact Cancel returned.
  The same installed gate also showed extension-filtered macOS files selected
  but not submittable. The repair waits for chooser completion, exposes files
  on macOS, and applies extension plus content validation in the host/parser
  chain. `MF-NATIVE-PICKER-CR-001` added that every new terminal host result
  must also be tested through its final owner-visible renderer consumer; helper-
  only tests missed safe typed failures degrading to generic copy.
- Status: Candidate pending Code Re-review and rebuilt installed
  native-picker QA.

## 2026-07-15: Per-row Reset Requires Per-target Runtime Authority

- Candidate lesson: An owner-visible Reset control attached to one asset or text
  row must carry that row's public identity through host authority and remove
  only its accepted canonical runtime key. A kind-only or global reset contract
  is destructive when multiple replacement previews are active.
- Evidence: Failure-first Lottie and VAP tests showed the prior kind-only reset
  cleared sibling replacements. The repaired hidden real VAP proof activated
  `title` and `avatar` together, reset `title` while decoded/textured `avatar`
  pixels remained, then reset `avatar` and restored the exact source digest.
- Status: Candidate pending independent Code Review and later installed matrix
  acceptance; source/dev proof is not Product Owner acceptance.

## 2026-07-15: Bind Reset Receipts To Action And Unique Identity

- Candidate lesson: A target-scoped mutation is safe only when its public alias
  identifies exactly one canonical runtime target across every exposed kind,
  and the completion receipt binds the action type, public target, canonical
  target, and selection generation.
- Evidence: `MF-TARGET-RESET-CR-001` reproduced Lottie image/text `text:1`
  collisions and duplicate text aliases that mutated the first matching row.
  `MF-TARGET-RESET-CR-002` showed an accepted Apply receipt could pass the host
  Reset check. The repair rejects both before renderer bookkeeping and retains
  the existing five-instance VAP sibling/reset pixel oracle.
- Status: Candidate pending independent Code Re-review and downstream installed
  matrix acceptance.
