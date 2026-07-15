# Acceptance Startup Placement Proof

## Summary

Implemented a source-only acceptance-display startup proof for
`ASV-QA-20260714-001` / `ASV-REQ-20260709-003`. Acceptance-display launches now
write a bounded JSON proof under `AUTO_SVGA_PRODUCT_ARTIFACTS` after
`BrowserWindow` construction and before renderer load or product input.

The proof is acceptance-only. Normal owner launches still use the existing
normal placement preference path and are not broadened.

## Git State

- Branch: `codex/0.2-acceptance-placement-proof-20260715`
- Base source: `57b8ef1f1ec55d872514766536f8b1c2df84156e`
- Product diff SHA-256 over changed product/test files:
  `9c320367ca6c076d32e16e4b630282c60760c94710ffec5cd638651525cc0a61`
- Classified untracked residue preserved: `.pnpm-store/`

## Changed Files

- `tools/electron-prototype/experiments/svga-web/acceptance-startup-placement-proof.cjs`
- `tools/electron-prototype/experiments/svga-web/main.cjs`
- `tools/electron-prototype/experiments/svga-web/tests/short-term-window-placement.test.mjs`
- `docs/reviews/2026-07-15-codex-acceptance-startup-placement-proof.md`
- `docs/retrospectives/TASK_RETRO_LEDGER.jsonl`
- `review/asv-qa-20260714-001-acceptance-startup-placement-proof-20260715/`

## Behavior

- Writes `acceptance-startup-placement-proof.json` only for acceptance-display launches.
- Proof includes execution id, requested/resolved/main display ids, window bounds,
  selected and primary display bounds/workArea/scaleFactor, containment,
  primary-display disjointness, placement mode, runtime instance id, timestamp,
  and whitelisted product/build identity.
- Rejects before renderer load/product input when the artifact root is missing
  or relative, proof already exists, execution id is absent, selected display is
  mismatched, actual window bounds drift from the resolved launch bounds, bounds
  are not contained, or the window touches the primary display.
- Uses `openSync(..., "wx")` plus `fsyncSync` to avoid overwriting an existing
  proof.
- Does not include raw owner file paths, screenshots, AX tree data, material
  names, or private build fields.
- Does not mutate owner placement preferences and does not change normal launch
  placement behavior.

## Verification

- `node --check tools/electron-prototype/experiments/svga-web/acceptance-startup-placement-proof.cjs`: PASS
- `node --check tools/electron-prototype/experiments/svga-web/main.cjs`: PASS
- `node --test tools/electron-prototype/experiments/svga-web/tests/short-term-window-placement.test.mjs`: PASS 10/10
- `node --test tools/electron-prototype/experiments/svga-web/tests/multiformat-conformance-milestone.test.mjs`: PASS 28/28
- `node --test --test-name-pattern "0\\.2 host replacement picker|multi-format native picker|host picker|unsupported picker|picker exception|file-open|0\\.2 installed file-open|launch-time file-open queue" tools/electron-prototype/experiments/svga-web/tests/svga-web-experiment.test.mjs`: PASS 9/9
- `npm run build`: PASS
- `npm run test:all`: PASS 538/538
- `npm run desktop:short-term:design-system-check`: PASS
- `git diff --check`: PASS

## Boundaries

- No Electron, Auto SVGA, Finder, native chooser, foreground, screenshots, install,
  package, promotion, QA route, Code Review route, owner-material mutation, save,
  export, Product Owner acceptance, support, distribution, or release action.
- This is source Implementation Ready only; installed QA still requires a
  rebuilt/promoted candidate and PM/A0-routed evidence gate.

## Retrospective

- Product lesson: installed foreground gates need a product-owned pre-input
  placement proof when host CGWindow/display binding is unavailable to QA.
- Technical lesson: acceptance placement evidence should fail closed at the
  host boundary before renderer load, not depend on foreground relays.
- Process lesson: source-only proof artifacts can remove a lifecycle blocker
  without consuming a foreground lease.
