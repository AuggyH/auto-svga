# Review: ASV-QA-20260711-001 Alpha2 Terminal State Repair

## 1. Summary

Repaired the second installed alpha2 foreground regression reported after permit
028. The prior stale-SVGA retention was fixed, but installed Lottie intake could
fall from Loading back to Launch without a loaded state or typed error, and VAP
could remain Loading through the observation window.

Root cause was two-part:

- In packaged Electron, the multi-format desktop session still treated the app
  root like a source checkout. It passed a source-style `repoRoot` into the
  accepted workspace session, so packaged Lottie/VAP paths could miss
  `.runtime/dist`, `.runtime/proto`, and `.runtime/node_modules`.
- The renderer/open bridge did not enforce a terminal outcome for rejected,
  malformed, missing-model, or stalled open requests. A failed host response
  could become a silent no-op, leaving Launch/Loading instead of a typed
  path-redacted failure.

The repair points packaged multi-format sessions at `.runtime`, keeps source
mode unchanged, and adds bounded terminalization in both the main-process session
and renderer controller. Every local open now resolves to loaded, cancelled, or
a typed path-redacted failure within the bounded deadline. No foreground app,
package, promotion, or QA rerun was performed.

## 2. Git State

- Branch: `codex/0.2-alpha2-intake-terminal-state-repair`
- Commit before work: `7077c867bb31e3fd72823649b2c6412bb8af6de2`
- Uncommitted changes before final commit: Electron main/session/controller
  repair, focused tests, this review, fix report, requirement handoff,
  retrospective updates, and visible review packet
- Untracked files: classified `.pnpm-store/` residue only

## 3. Changed Files

- `tools/electron-prototype/experiments/svga-web/main.cjs`
- `tools/electron-prototype/experiments/svga-web/multiformat-desktop-session.cjs`
- `tools/electron-prototype/experiments/svga-web/web/multiformat-desktop-preview-controller.mjs`
- `tools/electron-prototype/experiments/svga-web/tests/svga-web-experiment.test.mjs`
- `docs/product/requirements/ASV-REQ-20260709-003.md`
- `docs/quality/reports/ASV-QA-20260711-001-terminal-state-repair.md`
- `docs/reviews/2026-07-11-codex-asv-qa-20260711-001-alpha2-terminal-state-repair.md`
- `docs/retrospectives/TASK_RETRO_LEDGER.jsonl`
- `docs/retrospectives/PROJECT_LESSONS_CANDIDATES.md`
- `review/asv-qa-20260711-001-alpha2-terminal-state-repair/`

## 4. Requirement Checks

| # | Requirement | Status |
|---|-------------|--------|
| 1 | Reproduce Lottie Loading-to-Launch and VAP indefinite Loading through desktop open contracts. | Done with failure-first terminal-state tests for missing model, rejected bridge, stalled bridge, and synthetic Lottie/VAP open terminal states. |
| 2 | Trace request/generation identity across main, preload, renderer, session, and adapter boundaries. | Done by keeping request ids, session open deadlines, packaged runtime root binding, and renderer open outcome normalization in the desktop open path. |
| 3 | Every open request reaches loaded or typed path-redacted failure/limitation within a bounded deadline. | Done. Main-process session and renderer bridge both terminalize missing, rejected, invalid, and stalled outcomes. |
| 4 | Fix concrete Lottie/VAP causes rather than only adding cosmetic timeout. | Done. Packaged runtime root now points at `.runtime`; terminal deadlines are a safety boundary, not the only fix. |
| 5 | Preserve stale-generation guard, reset rollback, path privacy, SVGA regression, package mode binding, and formal 0.1 isolation. | Done by focused 0.1/0.2 desktop tests and full regression. |
| 6 | Do not package, promote, foreground-run, rerun QA, or claim Lottie/VAP support. | Done. |

## 5. Active Finding Ledger

| Finding | Source | Outcome | Repair Evidence | Current State |
|---|---|---|---|---|
| `ASV-QA-20260711-001` permit 028 terminal-state regression | QA fact-source `788b6983f81824e24972f8ef9bcee2c608f9ba0a`; evidence SHA `6e2748c1517af682ea6e0c5b972cd0db899bf5b5fbd1e0c126f40d25e2c259dc` | Changes Requested: Lottie returned to Launch without typed state; VAP remained Loading. | Packaged multi-format runtime root is `.runtime`; main session returns typed failed models on module/open/no-model/timeout outcomes; renderer normalizes missing model, rejection, and timeout into visible failure state; synthetic Lottie/VAP desktop opens reach `previewReady`. | Fix Ready / Code Review Required before Packaging and QA foreground rerun. |

## 6. Validation

```text
$ npm run build
PASS

$ git diff --check
PASS

$ node tools/electron-prototype/experiments/svga-web/scripts/check-short-term-design-system.mjs
PASS

$ node --test --test-name-pattern "0\\.2 (multi-format desktop|renderer open|alpha package runtime|packaged multi-format)|formal 0\\.1 direct multi-format" tools/electron-prototype/experiments/svga-web/tests/svga-web-experiment.test.mjs
PASS 6/6

$ npm run test:all
PASS 524/524
```

Additional hygiene:

- Package/lockfile drift scan: PASS, no `package.json`, lockfile, or Electron
  package metadata changes.
- Production media/archive changed-file scan: PASS, no changed SVGA, Lottie,
  VAP, MP4, image, video, frame, ZIP, asar, or icon artifacts.
- Formal 0.1 isolation scan: PASS, 0.2 multi-format APIs remain behind the
  explicit product-mode gate.
- Known `.pnpm-store/` residue remains untracked and unstaged.

Not used as a gate:

- `npm --prefix tools/electron-prototype/experiments/svga-web run
  spike:svga-web:test` was attempted earlier in the repair turn and failed
  during runtime preparation because the local Electron experiment dependency
  tree reported a missing packaging dependency (`long`). The source-focused
  Electron tests and root full regression above were rerun successfully after
  the repair.

## 7. Risks

- The installed `/Users/huangtengxin/Applications/Auto SVGA.app` is unchanged by
  this source repair. Packaging must rebuild and promote a repaired alpha2
  candidate before QA can rerun the foreground Lottie/VAP regression.
- This repair improves terminal state guarantees, but it does not prove
  real-material visual playback success.
- The open terminal deadline is a safety fallback. Review should verify the
  primary packaged runtime-root repair and the renderer/main terminalization
  semantics, not treat the timeout as the root fix.

## 8. Next Steps

- Send exact source head to PM for Code Review activation.
- After Code Review approval, Packaging needs a rebuilt alpha2 repair candidate
  from this head.
- QA should rerun the original foreground matrix only after installed metadata
  confirms the repaired package is promoted.

## 9. Commit

- Commit: branch head at handoff
- Branch: `codex/0.2-alpha2-intake-terminal-state-repair`
- Tag: none

## 10. Project Retrospective

- Value assessment: High
- Cost drivers:
  - The defect appeared only after packaged foreground QA, so source-side repair
    had to reason across package root layout, main session loading, renderer
    bridge behavior, and visible terminal states.
  - Broad regression was needed because the repair touches Electron main,
    renderer, and desktop session contracts.
- Avoidable costs:
  - Package candidates should assert that source-style roots are not used for
    packaged runtime module/proto/dependency resolution.
- Product lessons:
  - Installed intake must always produce a visible terminal state. A silent
    Launch fallback or indefinite Loading is not acceptable even when the
    underlying format feature is still candidate-stage.
- Technical lessons:
  - Packaged Electron runtime roots and source checkout roots should be explicit
    separate values; passing one generic `repoRoot` across both modes hides
    package-only failures.
  - Open bridges need typed terminalization for rejected, malformed,
    missing-model, and stalled outcomes at the UI boundary.
- Design / interaction lessons:
  - A clear typed failure and recovery affordance is preferable to an empty
    launch state after a user has selected a file.
- Process lessons:
  - Source Fix Ready for foreground regressions should state both the source fix
    and the packaging/install gate needed before QA can retest.
- Follow-up candidate for `docs/retrospectives/PROJECT_LESSONS_CANDIDATES.md`: Yes

## 11. Token Usage

- Source: unavailable
- Input tokens: unavailable
- Cached input tokens: unavailable
- Output tokens: unavailable
- Reasoning output tokens: unavailable
- Total tokens: unavailable
- Token lesson: Focused source terminal-state probes plus full regression were
  more reliable than trying to reproduce foreground behavior without a fresh
  permit.
