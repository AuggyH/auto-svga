# Short-Term Preview Playback Input Guard

Date: 2026-07-02
Agent: Codex
Branch: agent/codex/svga-workbench-v1-autonomous

## Summary

Added runtime fail-closed guards for short-term text preview and playback
failure host action payloads. Malformed runtime text element arrays, malformed
text replacement payloads, and non-string playback error messages now return
blocked action results instead of throwing or mutating the preview state.

## Git State

- Base head before task: 10990f8c
- Unrelated untracked file intentionally untouched:
  `docs/research/figma-make-short-term-uiux-prompt.md`

## Changed Files

- `src/workbench/short-term-host-actions.ts`
- `src/tests/short-term-host-actions.test.ts`
- `docs/reviews/2026-07-02-codex-short-term-preview-playback-input-guard.md`

## Requirement Checks

- S13 text preview remains runtime-only and does not write SVGA bytes.
- Valid text preview preparation, apply, and reset behavior remains unchanged.
- Playback failure reporting still redacts local paths for valid messages.
- Malformed preview/playback payloads fail closed without leaking local paths.
- No temporary UI shell, layout, or product-scope behavior was changed.

## Verification

- `npm run build`
- `node --test dist/tests/short-term-host-actions.test.js dist/tests/short-term-host-session.test.js`
- `npm run test:all` (382 passed)
- `npm run loop:validate`

## Risks / Next Steps

- Low risk; only invalid runtime payload paths changed.
- Next useful mainline task: audit the remaining host/session boundary for
  renderer-owned action payloads and defensive snapshots.
