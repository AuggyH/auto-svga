# Short-term UI Visual System Pass Review

Date: 2026-07-02
Agent: Codex
Scope owner: UI/UX

## Summary

Started the first formal visual-system pass on top of the confirmed short-term
UI skeleton. The change keeps product scope unchanged and focuses on making
the prototype more tokenized, componentized, and closer to a native macOS
utility surface.

## Git State

- Branch: `agent/codex/svga-workbench-v1-autonomous`
- Base checkpoint: `ff9bb4c feat: add short-term recent file state skeleton`
- Working tree after implementation: source and this review file modified;
  not committed in this review file itself.

## Changed Files

- `tools/shared/product-frontend/short-term-product-styles.css`
- `tools/shared/product-frontend/short-term-product-shell.test.mjs`
- `docs/reviews/2026-07-02-codex-short-term-ui-visual-system-pass.md`

## Requirement Checks

- No product scope changes were made.
- S1-S16 structure and state coverage remain unchanged.
- Visual values for typography, controls, rows, thumbnails, focus, shadows,
  canvas pattern, modal backdrop, and toolbar controls are now represented by
  stable `--asv-*` tokens.
- Toolbar buttons, segmented tabs, fact cells, asset rows, finding rows,
  modal, save banner, and launch canvas now share component-level visual
  contracts instead of isolated one-off styling.
- Launch recent rows remain secondary to the central drag/open action.
- Focus-visible feedback remains explicit and keyboard-visible.

## Verification

- `node --check tools/shared/product-frontend/short-term-product-app.mjs`
- `node --test tools/shared/product-frontend/short-term-product-shell.test.mjs tools/shared/product-frontend/source-sharing.test.mjs`
- `git diff --check`
- Browser interaction and screenshot check against
  `http://127.0.0.1:4191/tools/short-term-ui-preview/index.html` using local
  Chrome:
  - launch page 1280 x 860
  - preview overview 1280 x 860
  - optimization tab 1280 x 860
  - optimization compare 1280 x 860
  - launch page 1080 x 760
  - keyboard focus-visible check

## Risks

- This is still a coded prototype pass, not a complete high-fidelity design
  system in Figma.
- Dark appearance behavior remains an open product/design decision and was not
  changed in this pass.
- Real file persistence, real optimization execution, and true save output are
  intentionally still fixture-only.

## Next Steps

- Continue component-by-component visual refinement for menus, save states,
  modal/sheet behavior, and compare surfaces.
- Decide whether the next deliverable should be a Figma library/screen file or
  continued coded prototype refinement.
