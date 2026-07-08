# Review: UI/UX Preview Canvas Fit Polish

## 1. Summary
This UI/UX slice corrects the Preview canvas presentation after fresh foreground
evidence showed the opened SVGA artwork filling too much of the canvas. The
change keeps the existing playback, parsing, inspection, replacement, and save
logic untouched, and adds a tokenized visual fit scale so the artwork leaves
intentional breathing room inside the canvas-first Preview surface.

This review also records a process correction: an earlier screenshot used in
analysis was stale. Current UI judgment must use the owner-visible short-term
macOS client or a clearly identified candidate instance, with app path and PID
recorded when foreground evidence is involved.

## 2. Git state
- Branch: `agent/codex/short-term-preview-qa-20260708`
- Current baseline during this slice: `7628cfdb docs: govern client baseline and foreground coordination`
- Existing unrelated dirty files were present from PM/QA lanes and were not
  staged or modified by this UI/UX slice:
  - `docs/product/SHORT_TERM_DISTRIBUTION_PREP.md`
  - `docs/quality/PROJECT_TEST_ENGINEER_WORKFLOW.md`
  - `docs/retrospectives/TASK_RETRO_LEDGER.jsonl`
  - several `docs/reviews/2026-07-08-codex-local-stable-*` files

## 3. Changed files
- `tools/electron-prototype/experiments/svga-web/web/short-term-macos.tokens.css`
- `tools/electron-prototype/experiments/svga-web/web/short-term-macos-playback-fit-model.mjs`
- `tools/electron-prototype/experiments/svga-web/web/short-term-macos-playback-model.mjs`
- `tools/electron-prototype/experiments/svga-web/tests/short-term-playback-fit.test.mjs`
- `docs/reviews/2026-07-08-codex-uiux-preview-canvas-fit-polish.md`

## 4. Requirement checks
| # | Requirement | Status |
|---|-------------|--------|
| 1 | Do not change product scope, visible copy, or feature logic | Done |
| 2 | Keep Preview canvas-first and avoid reviving old Workbench/Web Preview visual baseline | Done |
| 3 | Use tokenized design-system values for owner-visible visual sizing | Done |
| 4 | Preserve playback aspect ratio across square and wide SVGA assets | Done |
| 5 | Do not rely on stale screenshots as current-client evidence | Done |
| 6 | Foreground screenshot after owner-visible local stable refresh | Done |

## 5. Verification
Commands run and results:

```text
node --test tools/electron-prototype/experiments/svga-web/tests/short-term-playback-fit.test.mjs
PASS: 2/2

node --test tools/electron-prototype/experiments/svga-web/tests/svga-web-experiment.test.mjs
PASS: 33/33

npm run desktop:short-term:design-system-check
PASS

npm --prefix tools/electron-prototype/experiments/svga-web run desktop:smoke
PASS

npm --prefix tools/electron-prototype/experiments/svga-web run internal:trial:package:mac
PASS: package manifest bound to current HEAD

npm run svga-workbench:v1:promote-local-stable -- --use-existing
PASS: refreshed /Users/huangtengxin/Applications/Auto SVGA.app from current-head package

git diff --check
PASS
```

## 6. Output inspection
- Fresh before-change owner-visible foreground evidence was captured from
  `/Users/huangtengxin/Applications/Auto SVGA.app` with real material
  `战狼头像框.svga`: `review/uiux-current-client-evidence-20260708/latest-preview-display2.png`.
- Candidate foreground verification was attempted from
  `.artifacts/internal-trial/Auto SVGA-darwin-arm64/Auto SVGA.app`, but the
  candidate and installed app share the same app name and bundle identifier.
  Any screenshot captured during that ambiguity is not used as evidence.
- After commit and local stable promotion, owner-visible foreground evidence
  was captured from `/Users/huangtengxin/Applications/Auto SVGA.app`:
  `review/uiux-current-client-evidence-20260708/stable-after-fit-display1.png`.
  This screenshot includes the macOS menu bar, native window chrome, and the
  real `战狼头像框.svga` material.
- The source-level fit contract is now verified by unit tests:
  - default fit behavior remains unchanged when no token is provided;
  - `fitScale: 0.62` reserves canvas breathing room while preserving aspect
    ratio.

## 7. Risks
- Candidate foreground validation should avoid same-name Launch Services
  activation; use PID/path identity or promote a committed current-head package
  before visual acceptance.
- The exact 0.62 visual fit scale may still need Owner taste review in the next
  high-fidelity pass, but the previous overfilled canvas issue is reduced.

## 8. Next steps
- Continue the next high-fidelity Preview pass from the refreshed local stable
  app, not from stale artifacts or historical Workbench/Web Preview surfaces.
- Keep foreground evidence tied to app path, process identity, and display
  strategy under the desktop coordination protocol.

## 9. Commit
- Commit: this commit, `uiux: reserve preview canvas breathing room`
- Branch: `agent/codex/short-term-preview-qa-20260708`
- Tag: none

## 10. Project retrospective
- Value assessment: Medium
- Cost drivers: foreground candidate validation was slowed by identical app
  identity between candidate and installed local stable app.
- Avoidable costs: avoid app-name activation for same-bundle candidate clients;
  use PID/path identity, or promote after commit before visual acceptance.
- Product lessons: none; this was visual implementation only.
- Technical lessons: playback canvas fit should be a tokenized presentation
  concern, not a product behavior change.
- Design / interaction lessons: large decorative SVGA assets need intentional
  canvas breathing room even when their logical canvas is only 300 x 300.
- Process lessons: stale screenshots must be called out and discarded instead
  of carried forward as evidence.
- Follow-up candidate for `docs/retrospectives/PROJECT_LESSONS_CANDIDATES.md`: No

## 11. Token usage
- Source: unavailable
- Input tokens: unavailable
- Cached input tokens: unavailable
- Output tokens: unavailable
- Reasoning output tokens: unavailable
- Total tokens: unavailable
- Token lesson: when foreground identity becomes ambiguous, stop pursuing
  screenshots and fall back to source checks until a committed/promoted client
  can be verified cleanly.
