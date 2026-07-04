# Short-Term UI/UX Replaceable Row Hierarchy Review

## Summary

Lightened the Preview replaceable image/text row hierarchy. Replaceable rows now read closer to list rows rather than small cards, and the row action control uses an icon-like ellipsis instead of visible `操作` copy while preserving the accessible label.

## Git State

- Branch: `agent/codex/svga-workbench-v1-autonomous`
- Base HEAD before this slice: `28689abb uiux: refine preview fact hierarchy`
- Scope: UI/UX lane, replaceable/text row presentation only

## Changed Files

- `tools/electron-prototype/experiments/svga-web/web/short-term-macos-replaceable-renderers.mjs`
- `tools/electron-prototype/experiments/svga-web/web/short-term-macos.components.css`

## Requirement Checks

- No replaceable-element detection logic changed.
- No new product copy added.
- Row action remains accessible through `aria-label`.
- Selection, focus, rename, replacement, and reset flows remain covered by existing smoke proof.

## Verification

- `npm run desktop:short-term:design-system-check` passed.
- `node --test tools/electron-prototype/experiments/svga-web/tests/svga-web-experiment.test.mjs` passed, 31/31.
- `npm run desktop:smoke` passed.
- `git diff --check` passed.

## Risks

- This is still not final foreground visual acceptance. Real desktop screenshots with production SVGA files remain required.

## Next Steps

- Continue visual polish for asset list density and the Preview right information surface.
