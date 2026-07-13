# ASV-QA-20260711-001 VAP Replacement Control Closure

## Summary

Implemented the owner-visible VAP replacement-control closure for `ASV-REQ-20260709-003`.
The row image action and native/menu-driven replacement action now share the
host picker path instead of relying on a renderer `input.click()` or the
previous `unsupportedSync` row action.

Status: Implementation Ready / Code Review requested after final head-bound
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

## Validation

Completed before this review packet:

- `node --check tools/electron-prototype/experiments/svga-web/main.cjs`: PASS
- `node --check tools/electron-prototype/experiments/svga-web/preload.cjs`: PASS
- `node --check tools/electron-prototype/experiments/svga-web/scripts/run-multiformat-real-vap-runtime-proof.cjs`: PASS
- Focused Electron replacement/control/runtime suites: PASS 5/5
- Related multi-format runtime suites: PASS 42/42
- `npm run build`: PASS
- `npm run desktop:short-term:design-system-check`: PASS
- `npm run test:all`: PASS 528/528
- `git diff --check`: PASS

Pre-commit hidden VAP runtime proof passed with a temporary ignored Electron
dependency overlay from a hash-matched local tree. Final Code Review handoff
will include a post-commit head-bound proof path and SHA-256.

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
unsupported behavior. The durable path is a host-owned picker with semantic
replacement dispatch, stale source guards, and one shared controller action.

Lesson: for Electron desktop replacement commands, file selection should stay in
the host process when invoked from native menu/IPC boundaries; renderer-only
synthetic file input is not a reliable owner-visible control path.

Token usage: unavailable from runtime; marked unavailable in ledger.
