# ASV-QA-20260711-001 File-open Terminal Repair

## Scope

- Requirement: `ASV-REQ-20260709-003`
- QA ticket: `ASV-QA-20260711-001`
- Repair branch: `codex/0.2-alpha2-file-open-terminal-repair`
- Source base: `046cf503f4f65d603c44923bc2a5ba60d718fd3a`
- Source fix commit: `2a33790f8ab48530bf29d2785a6afd5565b37457`
- Status: Fix Ready for Code Review, not QA acceptance.

## QA Failure Addressed

Installed foreground regression permit `ASV-APR-20260712-009` showed that the
repaired installed app no longer retained stale SVGA state, but routed
LaunchServices file-open attempts for Lottie and VAP returned to the Launch
open-candidate surface without preview/playback or a visible typed terminal
failure.

## Root Cause

The packaged app handled the 0.2 menu and drag/open IPC paths, but the Electron
main process did not handle macOS `open-file` events. QA used exact installed
app file-open events, so the selected Lottie/VAP aliases never reached
`openMultiFormatFilePath()`, the shared multi-format desktop session, or the
renderer terminal-state bridge.

## Repair

- Added an early, formal-0.2-only `app.on("open-file")` handler that queues
  file paths before `app.whenReady()` and does not produce a multi-format side
  effect in formal 0.1.
- Added a bounded queue flush after the 0.2 renderer finishes loading.
- Routed queued installed file-open events through
  `openMultiFormatFilePath(filePath, "fileOpenEvent")`.
- Added hidden renderer actions `beginHostFileOpen`, `completeHostFileOpen`,
  and `failHostFileOpen` so each installed file-open attempt reaches preview or
  a visible path-redacted terminal failure.
- Bound renderer completion to `eventId` plus active request generation so stale
  file-open completions cannot overwrite newer user actions.
- Kept the action bridge conditional: short-term 0.1 handlers do not gain these
  hidden 0.2 actions unless the multi-format controller supplies them.

## Verification

Commands run:

```text
node --test --test-name-pattern "0.2 installed file-open events route" tools/electron-prototype/experiments/svga-web/tests/svga-web-experiment.test.mjs
PASS 1/1

node --test --test-name-pattern "formal 0.1 direct multi-format|0.2 installed file-open|0.2 multi-format desktop session|0.2 renderer open contract" tools/electron-prototype/experiments/svga-web/tests/svga-web-experiment.test.mjs
PASS 5/5

node --check tools/electron-prototype/experiments/svga-web/main.cjs
PASS

node --check tools/electron-prototype/experiments/svga-web/preload.cjs
PASS

npm run build
PASS

npm run test:all
PASS 524/524

npm run desktop:short-term:design-system-check
PASS

git diff --check
PASS
```

Failure-first evidence:

- Before implementation, the new `0.2 installed file-open events route...`
  source contract failed with `installed macOS file-open events must be
  handled`.
- The same broad direct Node run also hit unrelated local test-environment
  failures (`@electron/asar` missing for direct package-proof fixtures and
  sandbox `listen EPERM` for local server tests). Final validation used focused
  source contracts plus the repository `npm run test:all` gate.

Hygiene:

- No `package.json`, `pnpm-lock.yaml`, or `package-lock.json` diff.
- No production media/archive/app bundle changed.
- `docs/retrospectives/TASK_RETRO_LEDGER.jsonl` parses.
- Known untracked `.pnpm-store/` residue remains unstaged and untouched.

## Boundaries

- No package rebuild, install, promotion, or foreground app launch was performed.
- No Finder/Open dialog, clipboard, save/export/conversion, or production asset
  mutation was performed.
- This does not claim Lottie or VAP product support, real-material visual
  success, Product Owner acceptance, QA acceptance, release readiness, or
  distribution readiness.

## Next Gate

Route the exact Fix Ready head to Code Review. If approved, Release/Packaging
must rebuild/promote an alpha2 repair candidate before QA can rerun the
installed foreground LOTTIE-A/VAP-A regression.
