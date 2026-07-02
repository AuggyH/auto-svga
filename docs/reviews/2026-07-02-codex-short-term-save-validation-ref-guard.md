# Short-Term Save Validation Ref Guard

Date: 2026-07-02
Agent: Codex
Branch: agent/codex/svga-workbench-v1-autonomous

## Summary

Hardened S14 persisted-output records so validation references are copied and
restricted to safe internal identifiers. Caller-owned validation ref arrays can
no longer mutate saved output metadata after record creation, and path-like
refs are filtered before entering renderer-facing active-output state.

## Git State

- Base head before task: 12da0ecd
- Unrelated untracked file intentionally untouched:
  `docs/research/figma-make-short-term-uiux-prompt.md`

## Changed Files

- `src/workbench/short-term-save-state.ts`
- `src/tests/short-term-save-state.test.ts`
- `docs/reviews/2026-07-02-codex-short-term-save-validation-ref-guard.md`

## Requirement Checks

- S14 persisted-output save state keeps existing dirty/save enablement
  behavior.
- Validation refs are snapshot-copied, de-duplicated, and kept path-redacted.
- Existing optimization, rename, replacement, Save As, and overwrite save flows
  remain unchanged.
- No temporary UI shell, layout, or product-scope behavior was changed.

## Verification

- `npm run build`
- `node --test dist/tests/short-term-save-state.test.js dist/tests/short-term-save-execution.test.js dist/tests/short-term-workbench-facade.test.js dist/tests/short-term-host-actions.test.js`
- `npm run test:all` (386 passed)
- `npm run loop:validate`

## Risks / Next Steps

- Low risk; current workflow refs already use safe `validation:*` identifiers.
- Next useful mainline task: continue auditing app-state persisted-output
  attachment and renderer-safe serialization for mutation or redaction gaps.
