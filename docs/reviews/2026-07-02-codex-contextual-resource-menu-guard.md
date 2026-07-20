# Contextual Resource Menu Guard

Date: 2026-07-02
Agent: Codex
Branch: agent/codex/svga-workbench-v1-autonomous
Base: b97fd544

## Summary

Tightened the short-term host menu dispatcher for resource operations that need
renderer context. `renameImageKey` now requires both `fromImageKey` and
`toImageKey`; `replaceImage` now requires both `imageKey` and `Uint8Array` PNG
bytes. If a future menu shell sends only the command id, the host returns a
blocked `menu_command_context_missing` result and preserves the current preview
state.

The real host capabilities for rename and image replacement remain available
when the renderer supplies the required context payload.

## Requirement Checks

- S11 imageKey rename: kept as a contextual operation instead of a blind menu
  action.
- S12 image replacement preview: kept as a contextual operation requiring the
  selected image key and replacement PNG bytes.
- S14 dirty output: missing context no longer creates or clears output bytes.
- Product scope: no UI shell wiring and no additional product surface.

## Changed Files

- `src/workbench/short-term-host-actions.ts`
- `src/tests/short-term-host-actions.test.ts`

## Verification

- `npm run build` PASS
- `git diff --check` PASS
- `node --test dist/tests/short-term-host-actions.test.js dist/tests/short-term-workbench-facade.test.js` PASS, 20 tests
- `npm run test:all` PASS, 330 tests

## Risks And Next Step

The future native/renderer shell still needs to gather selected resource
context and replacement bytes before calling these host actions. This change
keeps the host boundary deterministic while that UI layer is still being
rebuilt separately.
