# Path Display Control Character Hardening Review

Date: 2026-07-02
Agent: Codex
Branch: `agent/codex/svga-workbench-v1-autonomous`

## Summary

Hardened short-term path-derived display labels so Unicode control and format characters cannot leak into owner-visible source names or recent-file menu labels. This keeps filename display readable and avoids hidden direction-control characters changing how labels appear.

## Git State

- Base before task: `116174d7`
- Untracked `docs/research/figma-make-short-term-uiux-prompt.md` is unrelated and was not touched.

## Changed Files

- `src/workbench/short-term-path-display.ts`
- `src/tests/short-term-path-display.test.ts`

## Requirement Checks

- Keeps existing separator and whitespace normalization behavior.
- Removes ASCII control characters and Unicode format/control characters from path display parts.
- Covers right-to-left override and delete control character input in the path-display regression test.
- Leaves raw local paths out of renderer-facing display utilities.

## Verification

- `npm run build && node --test dist/tests/short-term-path-display.test.js dist/tests/short-term-recent-files.test.js dist/tests/short-term-app-state.test.js dist/tests/short-term-host-actions.test.js` (58 tests)
- `npm run test:all` (396 tests)

## Risks

- Low. The change only affects sanitized owner-visible display strings; stored local paths and host-side file operations are unchanged.

## Next Steps

- Run full test and loop validation after commit.
