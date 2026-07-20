# Review: short-term resource menu focus return

## 1. Summary
Completed a scoped UI/UX interaction repair for the short-term macOS client:
resource row context menus now remember their opener and return keyboard focus
when closed through Escape or a menu command.

This does not add product scope, visible copy, new menu items, or layout
changes. It only tightens the existing S11/S12 resource-row interaction path.

## 2. Git state
- Branch: `agent/codex/svga-workbench-v1-autonomous`
- Commit before work: `7d63e0a9`
- Uncommitted changes at review creation:
  - `tools/electron-prototype/experiments/svga-web/web/short-term-macos-app.mjs`
  - `tools/electron-prototype/experiments/svga-web/web/short-term-macos-smoke-proof-model.mjs`
  - `tools/electron-prototype/experiments/svga-web/tests/svga-web-experiment.test.mjs`
- Untracked files: none observed

## 3. Changed files
- `tools/electron-prototype/experiments/svga-web/web/short-term-macos-app.mjs`
- `tools/electron-prototype/experiments/svga-web/web/short-term-macos-smoke-proof-model.mjs`
- `tools/electron-prototype/experiments/svga-web/tests/svga-web-experiment.test.mjs`
- `docs/reviews/2026-07-04-codex-short-term-resource-menu-focus-return.md`

## 4. Requirement checks
| # | Requirement | Status |
|---|-------------|--------|
| 1 | Preserve PRD scope; do not add new visible product behavior or copy. | Done |
| 2 | Keep resource row context menu behavior within S11/S12. | Done |
| 3 | Make keyboard focus predictable after context menu close. | Done |
| 4 | Keep visible DOM rendering owned by render modules. | Done |
| 5 | Add regression evidence for the focus-return path. | Done |
| 6 | Treat smoke as regression evidence, not final visual acceptance. | Done |

## 5. Verification
Commands run and results:
```bash
$ node --test tools/electron-prototype/experiments/svga-web/tests/svga-web-experiment.test.mjs
31/31 passed.

$ npm run desktop:smoke
passed=true. shortTermReplacementProof=true and shortTermDesignInteractionProof=true.

$ npm run desktop:short-term:design-system-check
passed=true. Token/component/page-state guardrails remain satisfied.

$ git diff --check
passed.
```

## 6. Output inspection
- Product scope: no PRD or PM-owned product document edited.
- Visual surface: no layout, copy, color, spacing, or component styling changed.
- Interaction surface: resource menu closes with focus returned for Escape and
  menu-command paths; outside click still closes without forcing focus back.
- Evidence boundary: Electron smoke proves this regression path stays functional.
  Real foreground macOS screenshots and multi-production-material checks remain
  required for broader visual/experience acceptance.

## 7. Risks
- The current proof covers renderer-level focus behavior through smoke. It does
  not replace owner-visible foreground client review with macOS chrome.
- macOS Downloads permission prompts can still interrupt real production-file
  validation until the owner chooses the permission response.

## 8. Next steps
- Continue design-system/UI refinement in small scoped slices.
- Prioritize foreground client validation with real production SVGA files for
  broader visual hierarchy, layout density, and keyboard-path review.

## 9. Commit
- Commit: pending
- Branch: `agent/codex/svga-workbench-v1-autonomous`
- Tag: none
