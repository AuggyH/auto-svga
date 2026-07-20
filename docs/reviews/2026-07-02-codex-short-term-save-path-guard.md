# Codex Review: Short-Term Save Path Guard

## Summary

Added an S14 save safety guard in the host-action layer. Save As now refuses to
target the currently opened source file, while explicit Overwrite Save still
uses the current source path and validates the written bytes before clearing
dirty state.

This is main-engineering contract work only. It does not wire real behavior
into the temporary UI/UX shell.

## Git State

- Branch: `agent/codex/svga-workbench-v1-autonomous`
- Base before this change: `ef005988 feat: add short-term recent persistence store`
- Unrelated untracked file left untouched: `docs/research/figma-make-short-term-uiux-prompt.md`

## Changed Files

- `src/workbench/short-term-host-actions.ts`
  - Blocks same-source Save As with a stable diagnostic code.
  - Keeps explicit Overwrite Save behavior available through the existing
    validated write/read-back path.
- `src/tests/short-term-host-actions.test.ts`
  - Covers same-source Save As refusal, source immutability after refusal, and
    successful explicit overwrite save after an optimized output exists.

## Requirement Checks

- Mainline priority: P7 desktop-client preparation plus P1 infrastructure.
- PRD alignment: S14 requires Overwrite Save and Save As as separate formal
  product actions; this keeps their target semantics distinct and safer.
- No UI shell wiring, UI polish, telemetry, network dependency, or external AI.
- No parser, preview, optimization algorithm, replacement workflow, or recent
  persistence behavior change.

## Verification

- `npm run build` passed.
- Targeted tests passed: `node --test dist/tests/short-term-host-actions.test.js dist/tests/short-term-save-execution.test.js dist/tests/short-term-node-host-environment.test.js`
  - Result: 14 tests passed.
- Full validation passed: `npm run test:all`
  - Result: 314 tests passed.

## Risks

- Path equality currently uses resolved local paths. It does not add a broader
  filesystem identity check for aliases or symlinks; that can be added at the
  native host boundary if real-world files show that risk.

## Next Steps

- Continue strengthening the short-term host boundary around menu-command
  execution and persisted recent/save state before any real UI shell wiring.
