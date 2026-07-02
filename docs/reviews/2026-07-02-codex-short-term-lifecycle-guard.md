# 2026-07-02 Codex Short-Term Lifecycle Guard

## Summary

Hardened the short-term Workbench lifecycle boundary so malformed close/quit
requests fail closed instead of flowing through typed-only assumptions.

## Git State

- Branch: `agent/codex/svga-workbench-v1-autonomous`
- Base head before commit: `bbc40107fde7575a45324b21317e50f7f50f27ae`
- Untracked file intentionally left unstaged: `docs/research/figma-make-short-term-uiux-prompt.md`

## Changed Files

- `src/workbench/short-term-host-lifecycle.ts`
- `src/tests/short-term-host-session.test.ts`

## Requirement Checks

- PRD alignment: supports S14 dirty-state/lifecycle handling without adding
  hidden UI shell behavior or sequence repair scope.
- Runtime safety: invalid lifecycle request kinds and malformed discard flags
  now return blocked, path-redacted decisions with diagnostics.
- State safety: malformed lifecycle requests do not mutate active session state
  or clear dirty output.

## Verification

- `npm run build`
- `node --test dist/tests/short-term-host-session.test.js dist/tests/short-term-host-actions.test.js dist/tests/short-term-host-menu-routing.test.js dist/tests/short-term-node-host-session.test.js`
- `npm run test:all` — 388 tests passed.
- `npm run loop:validate` — PASS.

## Risks

- The lifecycle decision contract now exposes `request: "unsupported"` for
  invalid runtime payloads. Existing valid callers remain unchanged.

## Next Steps

- Continue auditing short-term host/session boundaries for runtime input,
  mutation, redaction, and save-state gaps before wiring into a final native UI.
