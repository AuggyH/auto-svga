# Review: UI/UX right resource row visual pass

## Summary

This UI/UX slice refines the existing Preview right-surface resource rows and
replaceable rows toward the saved Figma `Molecule/资源列表行` contract.

Scope stayed intentionally narrow:

- No new product scope.
- No new filters, tabs, row actions, copy, or explanatory text.
- No change to resource ordering, classification, replacement, rename, save, or
  compare behavior.
- Figma was not called in this slice; the saved R4 WP4 dependency packet was
  used as implementation input.

## Git State

- Branch: `agent/codex/short-term-preview-qa-20260708`
- Baseline: `67160894 uiux: align canvas playback controls with figma`
- Pre-existing unrelated dirty work was present in PM/QA docs and
  `TASK_RETRO_LEDGER.jsonl`; those files were not modified or staged by this
  UI/UX slice.

## Changed Files

- `tools/electron-prototype/experiments/svga-web/web/short-term-macos.tokens.css`
- `tools/electron-prototype/experiments/svga-web/web/short-term-macos.atoms.css`
- `tools/electron-prototype/experiments/svga-web/web/short-term-macos.molecules.css`
- `tools/electron-prototype/experiments/svga-web/web/short-term-macos.components.css`
- `tools/electron-prototype/experiments/svga-web/web/short-term-macos-replaceable-renderers.mjs`
- `tools/electron-prototype/experiments/svga-web/tests/svga-web-experiment.test.mjs`

## Requirement Checks

| Requirement | Status |
| --- | --- |
| Use PRD as product authority and Figma only as design evidence | Done |
| Preserve owner-confirmed canvas-first, boundary-light direction | Done |
| Avoid unapproved visible copy, helper text, labels, or controls | Done |
| Keep implementation tokenized and component-layered | Done |
| Improve existing rows without adding asset filters | Done |
| Preserve resource menu, rename, runtime text, replacement, and smoke flows | Done |

## Implementation Notes

- Added thumbnail, row index, row menu, row detail, runtime text input, and reset
  icon tokens.
- Softened selected/hover row states by removing the strong left selected rail
  and divider line.
- Converted the replaceable row `...` operation affordance to an icon-only
  button with the same accessible label and action.
- Converted the runtime text reset action to an icon-only button while keeping
  the existing `data-action` and accessible label.
- Kept `Atom/筛选标签栏` out of this slice because active asset filters would be
  a visible interaction addition.

## Verification

- `npm run desktop:short-term:design-system-check` - passed
- `node --test tools/electron-prototype/experiments/svga-web/tests/svga-web-experiment.test.mjs` - passed, 33/33
- `npm --prefix tools/electron-prototype/experiments/svga-web run desktop:smoke` - passed
- `git diff --check -- <changed UI files>` - passed

Smoke remains regression evidence only. Foreground packaged-app evidence should
still be refreshed after this slice is committed and promoted.

## Risks

- This pass reduces engineering chrome in resource rows, but final pixel
  acceptance still depends on a foreground packaged-app screenshot with real
  production SVGA material.
- Asset filter tabs from Figma remain intentionally unimplemented until product
  scope explicitly authorizes that interaction.
- `TASK_RETRO_LEDGER.jsonl` already had parallel uncommitted QA/PM content, so
  the ledger entry for this slice is captured here instead of being mixed into
  that file.

## Project Retrospective

- Value: medium-high. The change removes a visible engineering-list feel from
  the most-used right-side resource area without touching core behavior.
- Cost driver: existing design-system tests encoded one previous visual choice
  (`transparent` asset-row hover), so the test contract had to be updated with
  the new tokenized value.
- Lesson: when using Figma packets for polish, prefer token-level changes plus
  contract tests; avoid turning visual alignment into new active controls.
- Avoid next time: do not stage shared retrospective ledgers when another lane
  already has uncommitted entries in the same file.

## Token Usage

- Source: unavailable
- Input tokens: unavailable
- Cached input tokens: unavailable
- Output tokens: unavailable
- Reasoning output tokens: unavailable
- Total tokens: unavailable
