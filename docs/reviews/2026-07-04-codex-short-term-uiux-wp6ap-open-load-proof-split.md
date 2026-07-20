# Short-term UI/UX WP6AP Open And Load-Failure Proof Split

Date: 2026-07-04
Agent: Codex
Branch: `agent/codex/svga-workbench-v1-autonomous`
Status: completed

## Summary

Moved the short-term open-flow and load-failure smoke proof builders out of the
main short-term macOS app entry file and into the shared smoke proof model.

This is a UI/UX implementation-architecture slice only. It does not change
visible UI copy, styling, menu structure, load behavior, error behavior,
recovery behavior, or product scope.

## Product And Design Boundary

- Product authority checked: `docs/product/PRODUCT_ROADMAP.md`.
- Design execution guidance checked:
  `docs/product/SHORT_TERM_UI_UX_REDESIGN_EXECUTION_PLAN.md` and `DESIGN.md`.
- PRD IDs touched: S1 local open flow and S2 failure/recovery proof.
- Main PRD and PM-owned docs were not edited.
- Automated smoke evidence remains regression evidence only. This review does
  not claim foreground macOS visual or interaction acceptance.

## Changed Files

- `tools/electron-prototype/experiments/svga-web/web/short-term-macos-app.mjs`
  - imports and calls `collectShortTermOpenFlowProof`.
  - imports and calls `collectShortTermLoadFailureProof`.
  - continues to own the actual drag/drop, invalid-file, playback-failure, and
    recovery actions.
  - no longer owns the inline `short-term-open-flow-proof` or
    `short-term-load-failure-proof` objects.
- `tools/electron-prototype/experiments/svga-web/web/short-term-macos-smoke-proof-model.mjs`
  - adds `collectShortTermOpenFlowProof`.
  - adds `collectShortTermLoadFailureProof`.
  - keeps proof schema, PRD IDs, pass conditions, path-redaction check,
    source-unmodified copy check, stale-metadata checks, recovery checks, and
    restored-source-byte checks in the proof model.
- `tools/electron-prototype/experiments/svga-web/tests/svga-web-experiment.test.mjs`
  - updates structure assertions so open-flow and load-failure proof
    construction must stay in the smoke proof model instead of the app entry
    file.

## Requirement Checks

- S1: Open-flow proof still checks drag/drop load, preview reachability,
  local-only resources, path redaction, and no arbitrary renderer filesystem
  access claim.
- S2: Load-failure proof still checks invalid-drop failure, user-visible
  source-unmodified copy, no stale metadata, invalid API rejection, valid-file
  recovery, injected playback failure, playback-failure recovery, and restored
  source bytes after recovery.
- No new visible components, labels, explanatory copy, or product actions were
  introduced.

## Verification

Passed:

- `node --check tools/electron-prototype/experiments/svga-web/web/short-term-macos-app.mjs`
- `node --check tools/electron-prototype/experiments/svga-web/web/short-term-macos-smoke-proof-model.mjs`
- `node --check tools/electron-prototype/experiments/svga-web/tests/svga-web-experiment.test.mjs`
- `npm run desktop:short-term:design-system-check`
- `npm --prefix tools/electron-prototype/experiments/svga-web run spike:svga-web:test`
  - 30/30 tests passed.
- `npm run desktop:smoke`
  - smoke result passed and included `shortTermOpenFlowProof:true` and
    `shortTermLoadFailureProof:true`.
  - smoke result still reports `ownerUsability:false`, so it is not treated as
    owner-visible UI/UX acceptance.
- `git diff --check`

## Risks And Follow-up

- This slice improves evidence/model ownership, not visual quality.
- Foreground macOS screenshots with real production SVGA files are still
  required before any visual or interaction acceptance claim.
- With this slice, the current short-term smoke proof builders are no longer
  owned as inline proof objects by the app entry file.
