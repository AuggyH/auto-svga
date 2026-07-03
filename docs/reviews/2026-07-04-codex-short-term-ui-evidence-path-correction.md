# Short-Term UI Evidence Path Correction Review

Date: 2026-07-04
Agent: Codex
Branch: `agent/codex/svga-workbench-v1-autonomous`

## Summary

Corrected the UI/UX evidence-path record after verifying that source smoke
screenshots are written under the repository-level
`.artifacts/product/short-term/` root, while packaged internal-trial artifacts
are separate package-history evidence.

No product behavior, UI layout, or PM-owned product docs were changed.

## Changed Files

- `docs/reviews/2026-07-04-codex-short-term-ui-visual-system-polish.md`
- `docs/reviews/2026-07-04-codex-short-term-ui-evidence-path-correction.md`
- `tools/electron-prototype/experiments/svga-web/tests/svga-web-experiment.test.mjs`

## Requirement Checks

- Preserves the Owner rule that automated smoke evidence does not replace
  foreground desktop UI/UX acceptance.
- Clarifies that source smoke screenshots and packaged internal-trial history
  screenshots must not be mixed.
- Adds static guard coverage for the default source-smoke artifact root and
  the internal-trial package artifact root.

## Verification

- `npm --prefix tools/electron-prototype/experiments/svga-web run spike:svga-web:test`
- `git diff --check`

## Risks / Follow-Up

- This correction does not create foreground Owner-view screenshots.
- Foreground desktop validation with real production SVGA files remains the
  required UI/UX acceptance path.
