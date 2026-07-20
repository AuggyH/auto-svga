# 2026-07-02 Codex Short-Term Menu Dispatch Guard

## Summary

Hardened the short-term host menu dispatch entry so null or undefined runtime
payloads fail closed instead of throwing before command validation.

## Git State

- Branch: `agent/codex/svga-workbench-v1-autonomous`
- Base head before commit: `fc0e515f4b2d27a74f7426c7248a23ca6b5627bf`
- Untracked file intentionally left unstaged: `docs/research/figma-make-short-term-uiux-prompt.md`

## Changed Files

- `src/workbench/short-term-host-actions.ts`
- `src/tests/short-term-host-actions.test.ts`

## Requirement Checks

- PRD alignment: supports S14 host action safety and menu dispatch reliability.
- Runtime safety: null and undefined menu payloads now return a blocked,
  path-redacted `menu_command_id_invalid` result.
- Scope control: no UI shell wiring, sequence repair, or product-scope changes.

## Verification

- `npm run build`
- `node --test dist/tests/short-term-host-actions.test.js dist/tests/short-term-host-menu-routing.test.js`

## Risks

- None known for valid menu callers; valid command routing still uses the same
  canonical command and enabled-state checks.

## Next Steps

- Continue checking renderer-facing host inputs for null/undefined payload
  handling and mutation-safe result projection.
