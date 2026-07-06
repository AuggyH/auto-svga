# Project Experience Guide

Status: active distilled guidance

Read the relevant sections of this guide before starting non-trivial Auto SVGA
work. This guide records reusable project execution lessons. It is not a PRD,
release gate, or acceptance record.

## Reading Strategy

- Product, planning, UI/UX, feature, release, and acceptance tasks still start
  from `docs/product/PRODUCT_DOCUMENTATION_SYSTEM.md` and
  `docs/product/PRODUCT_ROADMAP.md`.
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

## Implementation

- Start from existing contracts, adapters, and inspection primitives before
  adding one-off UI or report logic.
- Prefer narrow work packages with current-head evidence over broad technical
  layer changes that only prove isolated internals.
- When compiling or saving SVGA output, keep source immutability, reference
  closure, inflate/decode, reopen, and playback-load proof separate.

## UI/UX

- Use the current PRD, design brief, low-fidelity IA, design-system spec, and
  `DESIGN.md` before judging short-term UI work.
- Do not use old Web Preview, historical Electron prototype, or Workbench v1
  screens as the visual baseline for the short-term client.
- Use foreground macOS screenshots with native chrome and varied real
  production materials for visual/interaction judgment when available. Treat
  smoke screenshots as regression evidence, not primary design evidence.

## Validation

- Match validation cost to risk. Documentation-only changes do not need full
  runtime regression. Parser, exporter, playback, dependency, build, and
  cross-cutting changes do.
- Report passing validation as command names and short results, not long logs.
- Do not claim `PASS`, accepted, released, visually successful, or production
  ready unless the exact gate and evidence are named.

## Coordination

- Before creating or resuming worker threads, look for existing relevant
  threads and avoid duplicate work streams.
- Keep PM, UI/UX, short-term implementation, mid-term integration, AEB, release
  packaging, and research lanes separate unless a handoff explicitly opens an
  integration point.
- If the working tree is dirty, isolate your staged files. Do not clean up or
  commit another lane's changes unless explicitly asked.

## Token And Context Cost

- Token usage is a cost signal, not the objective. Optimize for project value
  per token, not for the cheapest possible answer.
- Use precise `rg` searches, known authority docs, and existing review files
  before broad scans.
- Prefer `git diff --stat`, targeted file reads, and concise review summaries
  over full diffs, full logs, and repeated background explanations.
- When token usage is high but justified, record why. When token usage is high
  and avoidable, add an avoidance note to the task retrospective.
