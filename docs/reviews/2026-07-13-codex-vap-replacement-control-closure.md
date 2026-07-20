# ASV-QA-20260711-001 VAP Replacement Control Closure

## Summary

Implemented the owner-visible VAP replacement-control closure for `ASV-REQ-20260709-003`.
The row image action and native/menu-driven replacement action now share the
host picker path instead of relying on a renderer `input.click()` or the
previous `unsupportedSync` row action.

Status: Repair Ready / Code Review re-review requested after final head-bound
hidden runtime proof.

## Scope

- Branch: `codex/0.2-vap-replacement-control-20260713`
- Base: `2795dcb786a8579125fc8fdfe92cebeb014d0766`
- Requirement: `ASV-REQ-20260709-003`
- QA ticket: `ASV-QA-20260711-001`
- Installed/owner app: not launched, mutated, packaged, or promoted.

## Changes

- Added a 0.2-gated `chooseMultiFormatReplacementImage` IPC channel.
- Added a main-process replacement image picker using Electron dialog semantics,
  local image validation, redacted picker metadata, and stale `sourceId` guard.
- Repaired `MF-VAP-REPLACE-CR-001`: `sourceId` is now mandatory authority across
  renderer, preload, IPC, and main. Missing or blank source identity fails
  before `showOpenDialog`; stale source identity fails before and after picker
  selection.
- Repaired `MF-VAP-REPLACE-CR-002`: selected image reads now use an exact
  read-only fd, `fstat`, explicit `MAX+1` bounded reads, and redacted typed
  failure for read/delete/permission errors instead of `readFileSync`.
- Routed the desktop controller replacement command through the host picker.
- Rewired candidate-row image action to the same replacement flow.
- Preserved runtime replacement values for VAP remount/reset while keeping
  owner-visible paths redacted.
- Extended the real VAP runtime proof script so menu/action-bridge replacement,
  row replacement, reset, WebGL mount, play/pause, object URL cleanup, and no
  external requests are verified in one hidden Electron session.

## Failure-First Evidence

The repaired boundary matches the observed Permit 044 failure:

- Native Resource menu command reached replacement intent but no chooser opened.
- Candidate-row action was enabled-looking but wired to `unsupportedSync`.
- Renderer synthetic file-input click was not reliable across main-to-renderer
  command dispatch because it cannot preserve a browser user gesture.

Regression coverage now asserts that both visible controls use the host picker
contract and that 0.1 callers remain guarded before host side effects.

Code Review then found two adversarial host-boundary gaps at `f8617f82`:

- `MF-VAP-REPLACE-CR-001`: missing `sourceId` could still open the host picker
  and apply to the current active source.
- `MF-VAP-REPLACE-CR-002`: stat-then-`readFileSync` could leak raw filesystem
  errors or exceed the 10 MiB image cap after a TOCTOU growth.

The repair adds failure-first checks for missing/blank source identity before
dialog, stale source identity before dialog, stale source identity after picker
selection, redacted read failure handling, bounded `MAX+1` reading, and no
`statSync(normalizedPath)` / `readFileSync(normalizedPath)` in the replacement
picker path. The host-boundary test also VM-executes the extracted picker/read
helpers to prove dialog call count stays `0` for missing/blank/stale sourceId,
read exceptions return only typed redacted failure, and max+1 growth rejects
without returning an opened payload.

## Active Finding Ledger

| Finding | Reviewed Head | Repair Evidence | Status |
| --- | --- | --- | --- |
| `MF-VAP-REPLACE-CR-001` | `f8617f821b4e2e03b4d4bc776b9a63466e283445` | `sourceId` is trimmed and mandatory; missing/blank/stale source identity returns `parse_precondition` before dialog; post-picker stale identity returns `parse_precondition` before apply. VM behavioral test asserts dialog count stays `0` for missing/blank/stale source. | Fix Ready |
| `MF-VAP-REPLACE-CR-002` | `f8617f821b4e2e03b4d4bc776b9a63466e283445` | Picked image reads use `openSync` + `fstatSync` + bounded `readSync` up to `MAX+1` bytes and `closeSync`; VM behavioral test asserts read exceptions are redacted and post-stat growth rejects without an opened payload. | Fix Ready |

## Validation

Completed before this review packet:

- `node --check tools/electron-prototype/experiments/svga-web/main.cjs`: PASS
- `node --check tools/electron-prototype/experiments/svga-web/preload.cjs`: PASS
- `node --check tools/electron-prototype/experiments/svga-web/scripts/run-multiformat-real-vap-runtime-proof.cjs`: PASS
- Focused Electron replacement/control/runtime suites: PASS 5/5
- Focused host picker behavioral regression suite: PASS 6/6
- Related multi-format runtime suites: PASS 42/42
- `npm run build`: PASS
- `npm run desktop:short-term:design-system-check`: PASS
- `npm run test:all`: PASS 528/528
- `git diff --check`: PASS
- `docs/retrospectives/TASK_RETRO_LEDGER.jsonl` parse: PASS

Hidden VAP runtime proof is rerun after each committed head with a temporary
ignored Electron dependency overlay from a hash-matched local tree. The final
Code Review handoff includes the post-commit head-bound proof path and SHA-256.

## Boundaries

- No owner foreground action.
- No installed app mutation.
- No Packaging or QA routing from implementation.
- No save/export/conversion scope.
- No Product Owner acceptance, product support, production, distribution, or
  release readiness claim.
- `.pnpm-store/` remains classified residue and unstaged.

## Retrospective

Root cause: product replacement authority split across a native/menu command
that attempted to trigger a renderer file input and a row action still wired to
unsupported behavior. The first repair made the product path functional but did
not make source identity mandatory and still used stat-then-unbounded-read for
picked image files. The durable path is a host-owned picker with mandatory
semantic source identity, bounded fd reads, semantic replacement dispatch, stale
source guards, and one shared controller action.

Lesson: for Electron desktop replacement commands, file selection should stay in
the host process when invoked from native menu/IPC boundaries; renderer-only
synthetic file input is not a reliable owner-visible control path.

Second lesson: host pickers must treat renderer-provided source identity as
mandatory authorization, not an optional hint, and file reads should bind
validation and bytes through one bounded fd lifecycle.

Token usage: unavailable from runtime; marked unavailable in ledger.
