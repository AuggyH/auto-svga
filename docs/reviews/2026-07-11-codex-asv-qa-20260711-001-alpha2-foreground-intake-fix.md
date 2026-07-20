# Review: ASV-QA-20260711-001 Alpha2 Foreground Intake Fix

## 1. Summary

Fixed the source/package-mode mismatch behind the installed alpha2 foreground QA failure. The internal alpha package now records `productMilestoneId: "0.2-multiformat-preview"` in packaged runtime build info, and Electron main uses that package-only marker before falling back to formal `short-term`.

This is a source/package binding repair only. The installed app was not rebuilt, replaced, launched, or foreground-tested by this task.

## 2. Git State

- Branch: `codex/0.2-alpha2-foreground-intake-fix`
- Commit before work: `421b083b93f4deacb2cb18c8ad6f7a042990b7f3`
- Uncommitted changes: this review, fix report, requirement handoff, runtime identity source changes, and tests before final commit
- Untracked files: classified `.pnpm-store/` residue only

## 3. Changed Files

- `tools/electron-prototype/experiments/svga-web/main.cjs`
- `tools/electron-prototype/experiments/svga-web/scripts/package-internal-trial.mjs`
- `tools/electron-prototype/experiments/svga-web/tests/svga-web-experiment.test.mjs`
- `docs/product/requirements/ASV-REQ-20260709-003.md`
- `docs/quality/reports/ASV-QA-20260711-001-fix.md`
- `docs/reviews/2026-07-11-codex-asv-qa-20260711-001-alpha2-foreground-intake-fix.md`
- `docs/retrospectives/TASK_RETRO_LEDGER.jsonl`
- `docs/retrospectives/PROJECT_LESSONS_CANDIDATES.md`

## 4. Requirement Checks

| # | Requirement | Status |
|---|-------------|--------|
| 1 | Investigate QA foreground Lottie/VAP silent stale-SVGA behavior. | Done |
| 2 | Preserve formal 0.1 SVGA-only visible behavior. | Done |
| 3 | Return Fix Ready with commit, report, callback evidence, validation, and packaging need. | Done after final commit/callback |
| 4 | Do not close QA ticket directly. | Done |
| 5 | Do not launch foreground, package, promote, save/export, or claim format support. | Done |

## 5. Verification

```text
$ node --test --test-name-pattern "0.2 alpha package runtime identity|0.2 multi-format desktop mode|formal 0.1 direct multi-format IPC" tools/electron-prototype/experiments/svga-web/tests/svga-web-experiment.test.mjs
PASS 3/3

$ node --check tools/electron-prototype/experiments/svga-web/main.cjs
PASS

$ node --check tools/electron-prototype/experiments/svga-web/scripts/package-internal-trial.mjs
PASS

$ node --test --test-name-pattern "macOS package proof manifest records audit boundaries|0.2 alpha package runtime identity|0.2 multi-format desktop mode|formal 0.1 direct multi-format IPC|formal preload isolates short-term|formal 0.2 multi-format preload" tools/electron-prototype/experiments/svga-web/tests/svga-web-experiment.test.mjs
PASS 6/6

$ npm run build
PASS

$ npm run test:all
PASS 524/524

$ git diff --check
PASS
```

Additional attempted context check:

```text
$ node --test tools/electron-prototype/experiments/svga-web/tests/svga-web-experiment.test.mjs
NOT USED AS GATE: unrelated environment-sensitive failures for missing @electron/asar fixture support and one token-bound server path returning 404. Targeted package-mode regressions in the same file passed.
```

## 6. Output Inspection

- Installed Info.plist read-only inspection confirmed `0.2.0-alpha.2` / build `421b083b...` identity but no `AUTO_SVGA_PRODUCT_MILESTONE` launch environment.
- No production material, screenshots, app foreground actions, package archive, app replacement, save, export, or conversion output was produced.

## 7. Risks

- The current installed app is still unchanged. Packaging must rebuild and install a repaired candidate before QA can rerun the foreground Lottie/VAP matrix.
- This changes packaged startup mode binding; Code Review may be useful if PM wants an additional host-boundary check before packaging.
- The repair does not prove real-material visual playback success.

## 8. Next Steps

- Return `Fix Ready` to QA with this report and exact commit.
- Route Packaging to rebuild/reinstall an alpha2 repair candidate from this branch/head.
- QA reruns the installed foreground matrix after the repaired candidate is installed.

## 9. Commit

- Commit: branch head at handoff
- Branch: `codex/0.2-alpha2-foreground-intake-fix`
- Tag: none

## 10. Project Retrospective

- Value assessment: High
- Cost drivers:
  - Installed foreground failure required tracing source, package metadata, preload, menu, and launch-mode boundaries.
  - Validation needed package-mode static regressions plus full root regression.
- Avoidable costs:
  - Package candidates should have had an installed-mode assertion that package runtime identity selects the intended product milestone before foreground QA.
- Product lessons:
  - Version/build identity and runtime dependency closure are not enough; installed product mode must also be bound.
- Technical lessons:
  - Packaged Electron startup should prefer an explicit package-owned runtime mode marker over relying on an environment variable that LaunchServices may not provide.
  - The package marker must be ignored for non-packaged development runs so formal 0.1 defaults stay SVGA-only.
- Design / interaction lessons:
  - Silent retention of prior SVGA metadata is worse than a typed 0.2 error state; package mode must reach the 0.2 bridge before fixture-specific feedback can be trusted.
- Process lessons:
  - Source Fix Ready is not installed-app Fix Verified when the defect is in packaged startup binding; packaging rebuild is a separate gate.
- Follow-up candidate for `docs/retrospectives/PROJECT_LESSONS_CANDIDATES.md`: Yes

## 11. Token Usage

- Source: unavailable
- Input tokens: unavailable
- Cached input tokens: unavailable
- Output tokens: unavailable
- Reasoning output tokens: unavailable
- Total tokens: unavailable
- Token lesson: A narrow package-mode regression plus full root regression was cheaper and cleaner than attempting foreground reproduction without a permit.
