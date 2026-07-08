# Project Experience Guide

Status: active distilled guidance

Read the relevant sections of this guide before starting non-trivial Auto SVGA
work. This guide records reusable project execution lessons. It is not a PRD,
release gate, or acceptance record.

## Reading Strategy

- Product, planning, UI/UX, feature, release, and acceptance tasks still start
  from `docs/product/PRODUCT_DOCUMENTATION_SYSTEM.md` and
  `docs/product/PRODUCT_ROADMAP.md`.
- For first-time onboarding, milestone planning, or broad retrospective work,
  read `docs/retrospectives/PROJECT_BASELINE_RETROSPECTIVE.md` once before
  opening older historical documents.
- Use this guide to choose a lower-risk execution path after the authority
  documents are understood.
- Read only the sections relevant to the task. Do not expand every historical
  retrospective just to appear thorough.

## Product And Scope

- Keep `docs/product/PRODUCT_ROADMAP.md` as the single PRD authority.
  Subordinate design, implementation, review, and retrospective docs may add
  execution detail but must not redefine product scope.
- Treat owner memos as candidate scope until they are promoted into the main
  roadmap or a subordinate product brief.
- Separate short-term release surface from mid-term integration lanes. Internal
  debug or integration clients may accelerate validation, but they must not
  leak unfinished scope into the formal short-term client.
- Technically valuable work can still be the wrong mainline. Preserve
  incubation work, but hide or isolate it when the Product Owner resets the
  active product direction.

## Implementation

- Start from existing contracts, adapters, and inspection primitives before
  adding one-off UI or report logic.
- Prefer narrow work packages with current-head evidence over broad technical
  layer changes that only prove isolated internals.
- When compiling or saving SVGA output, keep source immutability, reference
  closure, inflate/decode, reopen, and playback-load proof separate.
- Preserve the original MVP discipline: one source of truth, clear output
  contracts, shared preview/export semantics, and explicit separation between
  binary validity and visual success.

## UI/UX

- Use the current PRD, design brief, low-fidelity IA, design-system spec, and
  `DESIGN.md` before judging short-term UI work.
- Do not use old Web Preview, historical Electron prototype, or Workbench v1
  screens as the visual baseline for the short-term client.
- Use foreground macOS screenshots with native chrome and varied real
  production materials for visual/interaction judgment when available. Treat
  smoke screenshots as regression evidence, not primary design evidence.
- Before foreground desktop debugging or screenshot capture, check for a
  second display. Use it when available so the Product Owner's main display is
  not interrupted. If no second display is available, prefer silent,
  background, minimized, hidden, or shortest-possible foreground operation and
  record the fallback used.

## Validation

- Match validation cost to risk. Documentation-only changes do not need full
  runtime regression. Parser, exporter, playback, dependency, build, and
  cross-cutting changes do.
- Report passing validation as command names and short results, not long logs.
- Do not claim `PASS`, accepted, released, visually successful, or production
  ready unless the exact gate and evidence are named.
- Evidence should prove a user-visible flow or a fail-closed invariant, not
  only artifact existence, packet completeness, or generated status text.

## Coordination

- Before creating or resuming worker threads, look for existing relevant
  threads and avoid duplicate work streams.
- Keep PM, UI/UX, short-term implementation, mid-term integration, AEB, release
  packaging, and research lanes separate unless a handoff explicitly opens an
  integration point.
- If the working tree is dirty, isolate your staged files. Do not clean up or
  commit another lane's changes unless explicitly asked.
- QA routing should preserve owner task continuity by default. Use the ticket's
  priority, importance, source, and response expectation to decide whether a
  responsible owner may be interrupted; immediate interruption requires an
  explicit emergency reason.
- Confirmed Product Owner feature, optimization, interaction, or production
  workflow requests need an `ASV-REQ` requirement ticket after PRD promotion.
  Do not rely on chat memory or roadmap text alone to push implementation and
  QA acceptance forward.
- Treat the owner local stable app at
  `/Users/huangtengxin/Applications/Auto SVGA.app` as the current short-term
  macOS client baseline for owner-visible QA and version progression.
  Historical Workbench v1, Web Preview, dev Electron windows, `.artifacts`
  packages, and Windows clients are not current-stage standards unless the
  Product Owner explicitly names them.
- Before foreground desktop validation, distinguish owner local stable,
  candidate, and other workers' client instances by path, PID, window,
  display/workspace, and task context. If identity is ambiguous, do not
  automate or capture the frontmost app.
- Foreground coordination covers more than Auto SVGA windows. Finder,
  Open/Save dialogs, After Effects, browsers, system prompts, menu bar actions,
  Dock/Launchpad, screenshots, and clipboard-changing operations are shared
  macOS foreground resources. Only one worker should actively drive keyboard,
  mouse, menu, modal, or clipboard input at a time.
- Before replacing the owner local stable app, check for baseline drift: do not
  drop behavior that exists in the installed app but is absent from source,
  product docs, review notes, or promotion evidence.
- Use vertical user-flow ownership for major capability closure. Technical
  layers may be useful implementation slices, but they are not enough to claim
  evidence-ready product behavior.
- Batch adjacent visual-only UI polish by page state or surface. Avoid paying a
  full task-start, smoke, screenshot, review, and handoff cycle for every tiny
  neighboring style change unless risk requires isolation.
- Keep one foreground-validation checklist per UI/UX bundle. Individual
  visual-only reviews should link to the bundle evidence instead of restating
  the same smoke-vs-foreground boundary each time.

## Token And Context Cost

- Token usage is a cost signal, not the objective. Optimize for project value
  per token, not for the cheapest possible answer.
- Use precise `rg` searches, known authority docs, and existing review files
  before broad scans.
- Prefer `git diff --stat`, targeted file reads, and concise review summaries
  over full diffs, full logs, and repeated background explanations.
- When token usage is high but justified, record why. When token usage is high
  and avoidable, add an avoidance note to the task retrospective.
- Declare the validation tier before running checks. Documentation and
  low-risk visual-token work should not trigger full regression by habit;
  parser, exporter, playback, host, dependency, and release work still needs
  stronger gates.
