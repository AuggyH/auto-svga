# SVGA Workbench Safe Optimization UI

Date: 2026-06-30
Branch: `agent/codex/svga-workbench-v1-autonomous`

## Summary

Exposed the existing safe SVGA image optimizer through the default desktop
Workbench Asset Intelligence panel as `生成优化副本`. The action stays bounded to
mechanically safe candidates, requires a desktop File > Open source identity,
saves only through Save As, reloads the saved SVGA, and verifies the saved hash
against the optimizer report.

## Changed Files

- `tools/shared/product-frontend/product-app.mjs`
- `tools/shared/product-frontend/source-sharing.test.mjs`
- `tools/electron-prototype/experiments/svga-web/main.cjs`
- `tools/electron-prototype/experiments/svga-web/tests/svga-web-experiment.test.mjs`
- `docs/autonomous/SVGA_WORKBENCH_V1_STATUS.md`
- `docs/autonomous/AUTONOMOUS_RUN_LOG.md`
- `docs/autonomous/LESSONS_CANDIDATES.md`
- `docs/reviews/2026-06-30-codex-svga-workbench-safe-optimization-ui.md`

## Requirement Checks

- Safe optimization remains report-bound and Save As only: pass.
- Original SVGA is never modified in place: pass.
- Drag/drop sources without host file authority cannot save optimized output:
  pass, button remains disabled with user-facing reason.
- Desktop File > Open source identity is preserved into product state: pass.
- Risky optimization classes remain suggestion-only: pass.
- Sequence repair Save As remains closed: pass.

## Verification

- `node --check tools/shared/product-frontend/product-app.mjs`: pass
- `node --check tools/electron-prototype/experiments/svga-web/main.cjs`: pass
- `git diff --check`: pass
- `node --test tools/shared/product-frontend/source-sharing.test.mjs`: pass, 7/7
- `npm --prefix tools/electron-prototype/experiments/svga-web run spike:svga-web:test`: pass, 23/23
- `npm run desktop:smoke`: pass

## Risks

- The optimized Save As dialog is host-mediated and not auto-clicked in smoke;
  coverage comes from the existing IPC validator tests plus the renderer flow
  guard and optimized reopen smoke proof.
- Production signing, notarization, and Windows trusted distribution still
  require external credentials.
