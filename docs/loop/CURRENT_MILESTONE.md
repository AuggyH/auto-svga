# NQ1-R1: Overnight Hardening Completion And Portable Evidence Repair

Milestone ID: NQ1-R1
Title: Overnight Hardening Completion And Portable Evidence Repair
Status: frozen
milestoneStartCommit: `396100329c3fef9762ec28611981db049ae154d9`
Branch: `agent/codex/nq1-r1-hardening-completion`
Previous milestone: `docs/loop/milestones/NQ1-overnight-reliability-hardening.md`
Previous final review: `docs/loop/reviews/NQ1-external-review.md`
Reviewed NQ1 HEAD: `c745f1a67880bc5aabc2bc74265cdbf00cfac2ff`

maxRepairRounds: 3
maxConsecutiveNoProgressRounds: 1

## Objective

Repair the NQ1 external review findings while preserving all existing NQ1 work.
NQ1-R1 must complete stronger deterministic overnight hardening evidence and
produce a portable, privacy-clean upload bundle bound to the final NQ1-R1 HEAD.

## Product Boundary

NQ1-R1 is engineering reliability and handoff hardening only. P4 is accepted by
product owner review, but NQ1-R1 must not start P5 functionality unless all
NQ1-R1 acceptance criteria pass.

## Allowed Changes

1. Synthetic fixtures, deterministic tests, local helper scripts, and ignored
   generated evidence.
2. NQ1-R1 reports under `.artifacts/product/NQ1-R1/`.
3. Reliability, cleanup, performance, accessibility, safety, flake, and portable
   handoff repair documents.
4. Loop state, history, final report, review packet, visible review folder, and
   upload packaging.
5. Test-only or helper-only changes required to produce truthful NQ1-R1
   evidence.

## Prohibited Scope

1. P5 product functionality before NQ1-R1 passes.
2. Text, timeline, transform, crop, resize, effect, conversion, export
   workbench, auto-fix, cloud, account, telemetry, or AI features.
3. New third-party dependencies, public network, credentials, production
   services, push, merge, release, publish, deploy, or irreversible operations.
4. Real user SVGA, PNG, screenshots, recordings, or labels in Git.
5. Changes to existing SVGA exporter semantics, CLI default flow, browser
   import, drag-drop, comparison, or product direction.
6. Resetting, deleting, rewriting, or hiding existing NQ1 work/history.
7. Loosening unsupported unknown-field boundaries.

## Acceptance Criteria

- `NQ1-R1-AC-01`: Preserve existing NQ1 work, reports, history, and commits.
- `NQ1-R1-AC-02`: Add 100 or more deterministic async schedules covering
  stale success, stale failure, latest failure rollback, file switch, reset,
  save rejection, reordered completion, duplicate operation IDs, invalid file,
  and concurrent open/replace/save interleavings. Every failure must include a
  seed and schedule ID.
- `NQ1-R1-AC-03`: Add at least 12 round-trip configuration cases. Supported
  cases must include at least two replacements except the P3 single-resource
  baseline, one untouched resource, and two Save As/reopen paths. Mutation cases
  must cover second replacement omission, untouched mutation, sprite order,
  frame alpha, transform, imageKey, and saved revision mismatch.
- `NQ1-R1-AC-04`: Add 30 actual or semi-real lifecycle cycles for open, replace
  A, replace B, undo, redo, reset, Save As, reopen, and close. Record RSS,
  heapUsed, external memory, active player/parser/objectURL/listener/timer,
  pending operation, temp, and Electron child counts every 5 cycles.
- `NQ1-R1-AC-05`: Add operation performance matrix for resource counts 1, 3,
  10, and 25 across open, decode, discovery, preview, replace, undo, redo, Save
  As, reopen, and round-trip. Use five samples each and record min, max, median,
  p95, sample values, warm/cold state, output size, peak RSS, Node, Electron,
  OS, arch, fixture hash, and final HEAD.
- `NQ1-R1-AC-06`: Correct flake evidence names and run actual repeats for
  desktop product smoke 3 times, Electron prototype/product tests 3 times,
  round-trip subset 3 times, and core targeted tests 5 times.
- `NQ1-R1-AC-07`: Execute Reserve A-E evidence: 1000 seeds x 100 operations
  model history, lifecycle up to 100 cycles with at least 30 blocking cycles,
  a 50-resource fixture, mutation validation, and an Electron editor threat
  model document.
- `NQ1-R1-AC-08`: Keep Windows risk honest with pure function and `path.win32`
  checks only. Do not claim actual Windows runtime coverage.
- `NQ1-R1-AC-09`: Produce required NQ1-R1 reports under
  `.artifacts/product/NQ1-R1/` with no empty placeholders.
- `NQ1-R1-AC-10`: Produce a portable bundle named
  `NQ1-R1-<final-head-short-sha>-upload.zip` with accurate upload manifest and
  no old `3c2a8f` references, username, absolute repo root, or local temp paths.
- `NQ1-R1-AC-11`: Include `bundle-privacy-audit.json` scanning every upload ZIP
  entry with findingCount 0, blocking 0, and no `allowedUploadPointer`
  exception.
- `NQ1-R1-AC-12`: Bind final evidence to the final NQ1-R1 HEAD, final ZIP name,
  validation HEAD, candidate digest, reviewer hashes, and terminal handoff.

## Required Validation Before Terminal State

1. NQ1-R1 targeted tests pass.
2. `npm test` passes.
3. `npm run loop:validate` passes on terminal NQ1-R1 HEAD.
4. Reviewer A and independent read-only Reviewer B complete.
5. Portable upload ZIP privacy audit passes.
6. Source workspace is clean before terminal packet generation.
7. Final response is exactly `.artifacts/loop-handoff/latest/FINAL_RESPONSE.txt`.

## Remaining Manual Gaps

- Real Windows runtime behavior remains deferred.
- Pixel-perfect visual parity and screen-reader output remain manual review.
- NQ1-R1 must not become P5 product acceptance.

## Recommended Next Milestone

If NQ1-R1 passes, create P5 from the final NQ1-R1 HEAD. P5 remains a separate
product milestone and must stop at `HUMAN_REQUIRED`.
