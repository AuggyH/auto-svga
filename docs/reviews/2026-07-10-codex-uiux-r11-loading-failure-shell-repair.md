# Review: UI/UX R11 Loading / Failure Shell Repair

## 1. Summary

Implemented the PM-confirmed R11 Figma fidelity repair for `Loading` and
`Load failed` page states. The states now preserve the 0.1 workbench shell:
native titlebar row, canvas region, disabled mode/playback context, and right
information-surface footprint. Stale previous-file facts, asset lists,
optimization content, and save actions remain suppressed.

## 2. Git state

- Branch: `codex/uiux-0.1-page-state-milestone`
- Commit before work: `aeb440656697448abe2b8bd48c3a947e105c6cf1`
- Uncommitted changes before work: R11 packet had an uncommitted superseded
  no-repair conclusion; corrected before commit per PM instruction.
- Untracked files: none intended.

## 3. Changed files

- `docs/research/figma-mcp-read-packets/r11-current-head-fidelity-audit-20260710.md`
- `tools/electron-prototype/experiments/svga-web/design-system-map.json`
- `tools/electron-prototype/experiments/svga-web/scripts/check-short-term-design-system.mjs`
- `tools/electron-prototype/experiments/svga-web/tests/svga-web-experiment.test.mjs`
- `tools/electron-prototype/experiments/svga-web/web/index.html`
- `tools/electron-prototype/experiments/svga-web/web/short-term-macos.modules.css`
- `tools/electron-prototype/experiments/svga-web/web/short-term-macos.page-states.css`
- `tools/electron-prototype/experiments/svga-web/web/short-term-macos.tokens.css`

## 4. Requirement checks

| # | Requirement | Status |
|---|-------------|--------|
| 1 | Preserve Figma shell/spatial context for Loading and Load failed. | Done |
| 2 | Forbid stale previous-source facts, assets, optimization results, and actionable save state. | Done |
| 3 | Keep primary loading/error feedback and Open File recovery in the canvas. | Done |
| 4 | Keep unavailable mode/playback controls disabled. | Done |
| 5 | Add Loading and Load failed to design-system-map traceability. | Done |
| 6 | No new product feature, deferred scope, Figma write, foreground run, package, or local promotion. | Done |

## 5. Verification

```text
$ node --check tools/electron-prototype/experiments/svga-web/scripts/check-short-term-design-system.mjs
PASS

$ node --check tools/electron-prototype/experiments/svga-web/tests/svga-web-experiment.test.mjs
PASS

$ node -e "JSON.parse(require('fs').readFileSync('tools/electron-prototype/experiments/svga-web/design-system-map.json','utf8')); console.log('design-system-map json ok')"
PASS

$ npm run desktop:short-term:design-system-check
PASS

$ node --test --test-name-pattern "loading and load-failed|page-state trace|figma" tools/electron-prototype/experiments/svga-web/tests/svga-web-experiment.test.mjs
PASS 2/2 after temporary ignored dependency symlink setup

$ npm --prefix tools/electron-prototype/experiments/svga-web run spike:svga-web:test
PASS 51/51 after temporary ignored dependency symlink setup

$ git diff --check
PASS
```

Scans:

- Package/lockfile diff scan: no matches.
- Production/media/archive generated-output diff scan: no matches.
- Temporary `node_modules` symlinks and `svga-web/.runtime` output were removed.

## 6. Output inspection

- Loading: workbench shell retained; canvas owns spinner/message/Open File
  action; right surface is neutral skeleton only.
- Load failed: workbench shell retained; canvas owns error/Open File action;
  right surface shows failure recovery content only.
- Disabled controls: mode switch and playback controls are present for spatial
  continuity but disabled and carry no playback command action.
- Stale content: state tests and design-system check reject file identity,
  facts, asset lists, replaceable list, and save actions inside these states.

## 7. Risks

- No new foreground proof was taken by design. Owner-visible visual acceptance
  remains outside this source-side repair.
- The right-side loading skeleton is intentionally neutral; later visual QA may
  tune proportions if Figma requires finer pixel matching.

## 8. Next steps

- Send this final milestone head to independent Code Review.
- If Code Review approves, route to QA for source-side validation.
- Do not package, promote, or claim Product Owner acceptance from this lane.

## 9. Commit

- Commit: `final-hash-in-code-review-callback`
- Branch: `codex/uiux-0.1-page-state-milestone`
- Tag: none

## 10. Project retrospective

- Value assessment: High
- Cost drivers: R11 PM disposition correction required undoing an uncommitted
  no-repair conclusion and converting it into a machine-checkable shell
  contract.
- Avoidable costs: none significant after the correction; the repair stayed in
  one bundle rather than splitting loading and failure into separate tasks.
- Product lessons: Figma shell fidelity and no-stale-data rules can coexist
  when stale content is replaced by state-specific neutral/error content.
- Technical lessons: page-state shell geometry should be checked as a traceable
  module contract, not only as visual CSS.
- Design / interaction lessons: recovery states can preserve spatial context
  without exposing old file information or active controls.
- Process lessons: when PM supersedes a design disposition before commit,
  correct the packet instead of preserving stale conclusions.
- Follow-up candidate for `docs/retrospectives/PROJECT_LESSONS_CANDIDATES.md`: Yes

## 11. Token usage

- Source: unavailable
- Input tokens: unavailable
- Cached input tokens: unavailable
- Output tokens: unavailable
- Reasoning output tokens: unavailable
- Total tokens: unavailable
- Token lesson: bundle Figma fidelity repair, tests, review, and callback once
  instead of routing separate micro-repairs for loading and failure.
