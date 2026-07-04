# Review: short-term UI/UX right surface alignment

## 1. Summary

Aligned the short-term macOS client right side with the latest Owner-confirmed
canvas-first direction in `PRODUCT_ROADMAP.md`: the old permanent right-panel
tab strip is removed, default Preview information now stays in one state-driven
information surface, and optimization uses a contextual replacement surface.

This is a UI/UX implementation slice, not a final visual high-fidelity claim.
It does not change PM-owned product documents and does not add product scope.

## 2. Git state

- Branch: `agent/codex/svga-workbench-v1-autonomous`
- Commit before work: `2a6e0c99`
- Uncommitted changes at review creation:
  - `tools/electron-prototype/experiments/svga-web/main.cjs`
  - `tools/electron-prototype/experiments/svga-web/scripts/check-short-term-design-system.mjs`
  - `tools/electron-prototype/experiments/svga-web/tests/svga-web-experiment.test.mjs`
  - `tools/electron-prototype/experiments/svga-web/web/index.html`
  - `tools/electron-prototype/experiments/svga-web/web/short-term-macos-dom-state.mjs`
  - `tools/electron-prototype/experiments/svga-web/web/short-term-macos-event-bindings.mjs`
  - `tools/electron-prototype/experiments/svga-web/web/short-term-macos-interaction-model.mjs`
  - `tools/electron-prototype/experiments/svga-web/web/short-term-macos-navigation-surface.mjs`
  - `tools/electron-prototype/experiments/svga-web/web/short-term-macos-replaceable-model.mjs`
  - `tools/electron-prototype/experiments/svga-web/web/short-term-macos-smoke-proof-model.mjs`
  - `tools/electron-prototype/experiments/svga-web/web/short-term-macos-smoke-runner.mjs`
  - `tools/electron-prototype/experiments/svga-web/web/short-term-macos-text-model.mjs`
  - `tools/electron-prototype/experiments/svga-web/web/short-term-macos.modules.css`
  - `tools/electron-prototype/experiments/svga-web/web/short-term-macos.molecules.css`
  - `docs/reviews/2026-07-05-codex-short-term-uiux-right-surface-alignment.md`
- Untracked files: none known

## 3. Changed files

- `tools/electron-prototype/experiments/svga-web/web/index.html`
- `tools/electron-prototype/experiments/svga-web/web/short-term-macos.modules.css`
- `tools/electron-prototype/experiments/svga-web/web/short-term-macos.molecules.css`
- `tools/electron-prototype/experiments/svga-web/web/short-term-macos-dom-state.mjs`
- `tools/electron-prototype/experiments/svga-web/web/short-term-macos-navigation-surface.mjs`
- `tools/electron-prototype/experiments/svga-web/web/short-term-macos-event-bindings.mjs`
- `tools/electron-prototype/experiments/svga-web/web/short-term-macos-interaction-model.mjs`
- `tools/electron-prototype/experiments/svga-web/web/short-term-macos-replaceable-model.mjs`
- `tools/electron-prototype/experiments/svga-web/web/short-term-macos-text-model.mjs`
- `tools/electron-prototype/experiments/svga-web/web/short-term-macos-smoke-runner.mjs`
- `tools/electron-prototype/experiments/svga-web/web/short-term-macos-smoke-proof-model.mjs`
- `tools/electron-prototype/experiments/svga-web/main.cjs`
- `tools/electron-prototype/experiments/svga-web/scripts/check-short-term-design-system.mjs`
- `tools/electron-prototype/experiments/svga-web/tests/svga-web-experiment.test.mjs`

## 4. Requirement checks

| # | Requirement | Status |
|---|-------------|--------|
| 1 | S3/S4 default Preview information remains visible without a separate production-spec module. | Done |
| 2 | S8/S10 optimization entry uses a contextual right-surface replacement, not a permanent tab. | Done |
| 3 | S12/S13 replaceable image and runtime text sections remain in Preview without switching mode. | Done |
| 4 | Owner-confirmed rule: no persistent right-panel tab strip for Preview/Optimization/Replaceable. | Done |
| 5 | Design-system guardrails remain aligned to canonical components/modules. | Done |
| 6 | Foreground macOS screenshot validation with real production SVGA files. | Not verified in this slice |

## 5. Verification

Commands run and results:

```text
npm run desktop:short-term:design-system-check
result: succeeded

node --test tools/electron-prototype/experiments/svga-web/tests/svga-web-experiment.test.mjs
result: succeeded, 31/31 tests

npm run desktop:smoke
result: succeeded, short-term smoke reported passed=true

git diff --check
result: succeeded
```

## 6. Output inspection

- Canvas size: not changed.
- SVGA output: not changed by this UI slice.
- Web preview: not used as visual acceptance.
- Desktop smoke: regression evidence only. It confirms open, preview,
  right-surface navigation, empty states, thumbnails, optimization, rename,
  replacement, load-failure, save-failure, and menu-state proofs still validate.
- Foreground app screenshots: not collected in this slice. Visual/interaction
  acceptance still requires real macOS foreground screenshots with Owner
  production SVGA materials.

## 7. Risks

- Runtime text still uses the existing edit/reset flow; the final Owner sketch
  direction expects inline inputs. That should be handled in a separate UI/UX
  slice so this commit stays scoped to right-surface alignment.
- Visual fidelity is still not final. This commit removes old structural chrome
  and improves state alignment, but it does not claim high-fidelity completion.
- Automated smoke screenshots remain regression evidence, not final design
  evidence.

## 8. Next steps

- Continue the main UI/UX line with inline runtime text input and right-surface
  visual refinement.
- Then run real foreground desktop validation using multiple files from
  `/Users/huangtengxin/Downloads/auto-svga测试物料`.

## 9. Commit

- Commit: to be filled by final handoff after commit creation
- Branch: `agent/codex/svga-workbench-v1-autonomous`
- Tag: none
