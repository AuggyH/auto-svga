# Review: uiux-canvas-recovery-states

## 1. Summary
Implemented a bounded Auto SVGA `0.1.x` UI/UX page-state bundle for canvas
recovery states. The bundle keeps scope inside existing Launch/Loading/Load
failed/Save failed behavior:

- Loading now exposes the same visible `打开文件` recovery action as Load failed.
- Loading state has direct `role="status"` and `aria-busy="true"` semantics.
- Load failed state has direct assertive alert semantics.
- Save failed feedback now uses the existing source-safe wording model so the
  user is told the source file was not modified.
- The design-system check now guards the Loading/Load failed recovery contract.

No new product feature, format, menu entry, package, foreground operation, or
local-stable promotion was added.

## 2. Git state
- Branch: `codex/uiux-redesign-20260710`
- Commit before work: `a8cd4150c7f29d026fde49ebecf012113b4424cc`
- Required current source: QA-accepted aligned head `a8cd4150c7f29d026fde49ebecf012113b4424cc`
- Working tree before work: clean
- Final commit: recorded in Code Review handoff after commit creation

## 3. Changed files
- `tools/electron-prototype/experiments/svga-web/web/index.html`
- `tools/electron-prototype/experiments/svga-web/web/short-term-macos-save-surface.mjs`
- `tools/electron-prototype/experiments/svga-web/tests/svga-web-experiment.test.mjs`
- `tools/electron-prototype/experiments/svga-web/scripts/check-short-term-design-system.mjs`
- `docs/reviews/2026-07-10-codex-uiux-canvas-recovery-states.md`
- `docs/retrospectives/TASK_RETRO_LEDGER.jsonl`

## 4. Requirement checks
| # | Requirement | Status |
|---|-------------|--------|
| 1 | Start from exact QA-accepted aligned head `a8cd4150...` | Done |
| 2 | Touch one bounded UI/UX page-state bundle instead of scattered polish | Done |
| 3 | Stay inside Auto SVGA `0.1.x` / SVGA Preview MVP scope | Done |
| 4 | Cover Loading and Load failed recovery states | Done |
| 5 | Preserve canvas-first direction and existing components | Done |
| 6 | Do not add VAP/Lottie/AEB/Windows/deferred edit scope | Done |
| 7 | Do not modify Product/PM/QA/Packaging authority files | Done |
| 8 | No foreground launch, package, local-stable promotion, or Owner acceptance claim | Done |

## 5. Verification
Commands run and results:

```bash
$ git status --short --branch -uall
clean at task start on codex/uiux-redesign-20260710

$ git rev-parse HEAD
a8cd4150c7f29d026fde49ebecf012113b4424cc

$ git merge-base --is-ancestor 0e1f77ba55614798e531e01afe71b62e619d6430 HEAD
PASS

$ git merge-base --is-ancestor 150a2360a630fb7f88692779647cc173896ea9a3 HEAD
PASS

$ node --check tools/electron-prototype/experiments/svga-web/web/short-term-macos-save-surface.mjs
PASS

$ node --check tools/electron-prototype/experiments/svga-web/tests/svga-web-experiment.test.mjs
PASS

$ node --check tools/electron-prototype/experiments/svga-web/scripts/check-short-term-design-system.mjs
PASS

$ node --test --test-name-pattern "short-term loading and load-failed states|short-term save banner states" tools/electron-prototype/experiments/svga-web/tests/svga-web-experiment.test.mjs
PASS 2/2

$ npm run desktop:short-term:design-system-check
PASS

$ npm --prefix tools/electron-prototype/experiments/svga-web run spike:svga-web:test
Sandboxed run reached 47/50, then failed only on local 127.0.0.1 listen EPERM.
Non-sandbox rerun PASS 50/50.

$ git diff --check
PASS

$ node -e "parse docs/retrospectives/TASK_RETRO_LEDGER.jsonl"
PASS

$ git diff --name-only | rg '(^|/)(package(-lock)?\.json|pnpm-lock\.yaml|yarn\.lock)$'
PASS, no matches

$ git diff --name-only | rg '\.(png|jpg|jpeg|gif|webm|mp4|mov|svga|psd|sketch|fig|zip|dmg)$'
PASS, no matches
```

Dependency environment:
- The isolated worktree lacked `protobufjs` for `node --test`.
- Root `package.json` / `pnpm-lock.yaml` and Electron prototype
  `package.json` / `package-lock.json` hashes matched the main checkout.
- Temporary ignored `node_modules` symlinks were used for validation and then
  removed.
- Test-generated `.runtime` directories were removed after validation.

Invalid command note:
- `node --check web/index.html` was accidentally attempted once and failed
  because HTML is not a Node module. It is not counted as validation evidence;
  HTML is covered by the focused test and design-system check.

## 6. Output inspection
- Foreground desktop inspection: not performed.
- Smoke/regression evidence: source tests and design-system checks only.
- Visual/interaction acceptance: not claimed.
- Owner local stable app: not launched, replaced, or promoted.

## 7. Risks
- The Loading recovery button reuses the existing `data-action="open"` flow.
  It does not cancel an already-running parse task; it simply provides the
  documented visible way to choose another file if loading is slow.
- Foreground visual acceptance remains separate and should be bundled with the
  next larger page-state visual review instead of run for this small source
  slice.

## 8. Next steps
- Send exact implementation head to independent Code Review.
- If Code Review approves, route to QA for source-side page-state acceptance.
- Continue the next UI/UX page-state bundle only after review/QA routing allows
  stacking another visible slice.

## 9. Commit
- Commit: final hash recorded in Code Review handoff.
- Branch: `codex/uiux-redesign-20260710`
- Tag: none

## 10. Project retrospective
- Value assessment: Medium
- Cost drivers: full suite needed a non-sandbox rerun because local server
  binding is blocked in the sandbox; isolated worktree needed temporary
  dependency symlinks.
- Avoidable costs: the accidental HTML syntax-check command was noise and
  should not be repeated.
- Product lessons: Loading is a real recovery state, not only a spinner; it
  should preserve a visible Open File path just like Load failed.
- Technical lessons: source-safe failure wording should be centralized so save,
  open, and operation failures do not drift.
- Design / interaction lessons: recovery states can improve desktop experience
  without adding explanatory copy or new feature scope.
- Process lessons: one page-state bundle can share focused tests,
  design-system check, and full-suite validation instead of running separate
  loops for Loading and Save failed.
- Follow-up candidate for `docs/retrospectives/PROJECT_LESSONS_CANDIDATES.md`: No

## 11. Token usage
- Source: unavailable
- Input tokens: unavailable
- Cached input tokens: unavailable
- Output tokens: unavailable
- Reasoning output tokens: unavailable
- Total tokens: unavailable
- Token lesson: Bundle related recovery states into one review/test cycle; do
  not split Loading, Load failed, and Save failed into separate micro-WPs.
