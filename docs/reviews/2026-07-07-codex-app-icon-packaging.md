# Review: app icon packaging

## 1. Summary

Added the Owner-provided temporary Auto SVGA app icon to the macOS internal
packaging flow. Future internal packages and local stable app promotion now use
the repository-managed icon asset instead of a local Downloads/Desktop file.

## 2. Git State

- Branch: `agent/codex/svga-workbench-v1-autonomous`
- Worktree before task: clean
- Scope: packaging / release identity only

## 3. Changed Files

- `DESIGN.md`
- `docs/product/SHORT_TERM_DISTRIBUTION_PREP.md`
- `tools/electron-prototype/experiments/svga-web/packaging/macos/app-icon-source.png`
- `tools/electron-prototype/experiments/svga-web/packaging/macos/app-icon.icns`
- `tools/electron-prototype/experiments/svga-web/scripts/macos-package-proof.mjs`
- `tools/electron-prototype/experiments/svga-web/scripts/package-internal-trial.mjs`
- `tools/electron-prototype/experiments/svga-web/tests/svga-web-experiment.test.mjs`
- `docs/reviews/2026-07-07-codex-app-icon-packaging.md`
- `docs/retrospectives/TASK_RETRO_LEDGER.jsonl`

## 4. Requirement Checks

- Source image is copied into a stable repository path as
  `packaging/macos/app-icon-source.png`.
- macOS `.icns` is generated as `packaging/macos/app-icon.icns`.
- `electron-packager` receives the app icon path.
- Package proof records source/icon hashes and validates that the packaged
  `Contents/Resources/electron.icns` hash matches the repository `.icns`.
- Distribution docs and design manifest record that the icon is a temporary
  Owner-provided app icon.

## 5. Verification

Passed:

- `node --check` for packaging scripts.
- `node --test tools/electron-prototype/experiments/svga-web/tests/svga-web-experiment.test.mjs`
  with 31/31 passing.
- `git diff --check`.
- `npm --prefix tools/electron-prototype/experiments/svga-web run internal:trial:package:mac`.
- Package proof reports `appIcon.packagedIconMatchesSource: true`.
- Packaged `Contents/Resources/electron.icns` SHA-256 equals
  `tools/electron-prototype/experiments/svga-web/packaging/macos/app-icon.icns`.

Icon hashes:

- Source PNG:
  `bb976694f005e2b23fa1ef783162b1c4f483ad6fe7f0232b49eb86014502f27c`
- ICNS:
  `a77c7edfd952ebe9d0d5c1c3d6f0020487ddf1781e03b4e3ceda69eb931b2ed9`

## 6. Notes

`@electron/packager` on this machine emits a warning about the newer macOS
`.icon` format, which requires newer platform tooling. The `.icns` path is
still copied correctly; the package proof now verifies the actual packaged icon
hash to avoid relying on log interpretation.

## 7. Risks

- The source PNG has no alpha channel, so the temporary icon keeps the exact
  Owner-provided raster appearance rather than synthesizing transparent
  corners.
- This is an unsigned internal package icon update, not a final brand approval.

## 8. Project Retrospective

Small branding assets are still packaging inputs once they affect the app
bundle. The safer pattern is to store the source image and generated app icon in
the packaging tree, wire the packager path, and make proof validate the final
bundle resource hash.

## 9. Token Usage

Exact Codex token counts were not available in-session. Source:
`unavailable`.
