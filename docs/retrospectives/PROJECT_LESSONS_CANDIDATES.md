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
