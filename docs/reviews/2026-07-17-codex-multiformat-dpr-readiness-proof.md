# Multi-format DPR Readiness Proof

## Summary

While `8015bd668054fcbc3fd42ce36d43c47c6a7d6a3f` remains frozen for independent Code Re-review, this successor advances one nondependent installed-matrix readiness gap: the acceptance startup placement proof now records explicit display scale evidence for the distinct-DPR row.

The current source already contains source-only external-image Lottie and fusion-capable VAP fixture/oracle coverage, and this checkpoint reran that oracle instead of adding duplicate scaffolding.

## Source Binding

- Base / CR-frozen predecessor: `8015bd668054fcbc3fd42ce36d43c47c6a7d6a3f`
- Branch: `codex/0.2-multiformat-material-oracle-readiness-20260717`
- Status: `Source Ready / Not CR-approved / Not QA-ready`

Product diff SHA-256 over changed source/test files:

`4025670e5658c2d4fb2ae5c1f08836810b6c9559c821d94c1fa8065634f0c775`

## Changed Files

- `tools/electron-prototype/experiments/svga-web/acceptance-startup-placement-proof.cjs`
- `tools/electron-prototype/experiments/svga-web/tests/short-term-window-placement.test.mjs`

## Behavior

Accepted and rejected `acceptance-startup-placement-proof.json` payloads now include:

- selected display scale factor;
- primary display scale factor;
- absolute scale-factor delta;
- explicit `distinctFromPrimary` boolean;
- `evidenceReady` boolean.

The proof still uses the same placement acceptance rules. A same-DPR secondary display is not rejected; it is recorded as `distinctFromPrimary: false` so QA can classify the supplemental DPR row without screenshots, CGWindow relays, or manual scale-factor interpretation. Rejected proof artifacts also carry the same bounded scale evidence when display metadata is available.

## Failure-First / Gap Evidence

Before this source change, the artifact contained `selectedDisplay.scaleFactor` and `primaryDisplay.scaleFactor`, but no explicit row-level verdict. The next QA matrix could therefore prove placement containment while still needing external interpretation for the distinct-DPR row.

The new regression proves:

- distinct selected/primary scale factors produce `distinctFromPrimary: true`;
- same scale factors produce `distinctFromPrimary: false`;
- rejected placement proof still writes redacted scale evidence for QA-readable stop classification.

## Validation

Passed:

- `node --check tools/electron-prototype/experiments/svga-web/acceptance-startup-placement-proof.cjs`
- `node --check tools/electron-prototype/experiments/svga-web/tests/short-term-window-placement.test.mjs`
- `node --test --test-name-pattern "acceptance startup placement proof" tools/electron-prototype/experiments/svga-web/tests/short-term-window-placement.test.mjs`: PASS 3/3
- `node --test tools/electron-prototype/experiments/svga-web/tests/short-term-window-placement.test.mjs`: PASS 13/13
- Hash-matched read-only d657 overlay package-proof slice: PASS 2/2
- `node --test tools/electron-prototype/experiments/svga-web/tests/multiformat-task-fixture-source-oracle.test.mjs`: PASS 3/3
- Open-isolation focused regressions: PASS 3/3
- `npm run build`: PASS
- `npm run test:all`: PASS 542/542
- `node tools/electron-prototype/experiments/svga-web/scripts/check-short-term-design-system.mjs`: PASS
- `git diff --check`: PASS

The d657 overlay was used only for the static package-proof slice after verifying matching hashes for `tools/electron-prototype/package.json`, `package-lock.json`, and `experiments/svga-web/package.json`; no dependency install or Electron launch occurred.

## Boundaries

- No Electron, Auto SVGA, Finder, foreground, native chooser, install, packaging, promotion, QA route, or owner material access.
- No UI styling, renderer layout, picker, session, replacement, Reset, or runtime playback behavior changed.
- No installed QA, pixel fidelity, Product Owner acceptance, product support, distribution, or release readiness claim.

## Remaining Gaps

- External-image Lottie and fusion-capable VAP remain source-only/oracle-proven, not installed/runtime accepted.
- The distinct-DPR field still requires a future rebuilt installed artifact and QA permit to observe on real display hardware.
- The routed open-isolation repair at `8015bd66` still needs independent Code Re-review before any downstream Packaging/QA route.

## Retrospective

The useful next work was not another Lottie/VAP source oracle because that already exists and remained green. The smaller but real matrix gap was an ambiguous installed-artifact proof surface for DPR classification. Encoding the verdict in the existing bounded placement proof keeps the next QA run source-bound and avoids a foreground or CGWindow-dependent discriminator for this row.
