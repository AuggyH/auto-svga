# Review: HB-CR-001 Electron Host Boundary Repair

## 1. Summary

Repaired the formal Auto SVGA `0.1.x / SVGA Preview MVP` Electron host boundary
for `--prototype-product-milestone=short-term`.

Formal short-term preload now exposes only `autoSvgaElectronHost` with the
PRD-authorized product bridge. It no longer exposes `autoSvgaPrototype`,
deferred Workbench save methods, reference-media open, artifact scan, AEB
intake, or proof/smoke helper methods. Explicit proof mode keeps evidence
helpers available without exposing the legacy Workbench bridge.

Main IPC handlers now reject deferred Workbench, reference-media,
artifact-scan, and proof/smoke-only channels in formal short-term runtime even
if a renderer tries to call the channel directly.

## 2. Git state

- Branch: `agent/codex/short-term-main-rebind-20260710`
- Commit before work: `427106dba8894a4d5e58d5325f122810edeaa795`
- Uncommitted changes before work: none
- Untracked files before work: none

## 3. Changed files

- `tools/electron-prototype/experiments/svga-web/preload.cjs`
- `tools/electron-prototype/experiments/svga-web/host-adapter-contract.cjs`
- `tools/electron-prototype/experiments/svga-web/main.cjs`
- `tools/electron-prototype/experiments/svga-web/tests/svga-web-experiment.test.mjs`
- `docs/reviews/2026-07-10-codex-hb-cr-001-electron-host-boundary-repair.md`
- `docs/retrospectives/TASK_RETRO_LEDGER.jsonl`
- `docs/retrospectives/PROJECT_LESSONS_CANDIDATES.md`

## 4. Requirement checks

| # | Requirement | Status |
|---|-------------|--------|
| 1 | Formal short-term exposes only minimal product bridge | Done |
| 2 | Formal short-term does not expose `autoSvgaPrototype` | Done |
| 3 | Formal short-term main IPC fails closed for deferred/proof/helper channels | Done |
| 4 | Actual `preload.cjs` VM allowlist tests cover short-term and AEB modes | Done |
| 5 | AEB remains a narrow `getAebIntakeReport` preload bridge only | Done |
| 6 | No visible feature, foreground run, package, promotion, dependency, or production asset change | Done |

## 5. Verification

```text
$ node --check tools/electron-prototype/experiments/svga-web/preload.cjs
PASS

$ node --check tools/electron-prototype/experiments/svga-web/host-adapter-contract.cjs
PASS

$ node --check tools/electron-prototype/experiments/svga-web/main.cjs
PASS

$ node --test --test-name-pattern "short-term actual preload|AEB actual preload|main process keeps sandboxed Electron security settings" tools/electron-prototype/experiments/svga-web/tests/svga-web-experiment.test.mjs
PASS 4/4

$ node --test tools/electron-prototype/experiments/svga-web/tests/svga-web-experiment.test.mjs
PASS 39/39

$ git diff --check
PASS
```

The first full-suite attempt inside the managed sandbox failed three local
server tests with `listen EPERM: operation not permitted 127.0.0.1`. The same
command passed 39/39 when rerun outside the sandbox because those tests need a
local loopback listener.

## 6. Output inspection

- No package, App ZIP, foreground desktop run, owner local stable promotion, or
  production asset output was created.
- This was a source-level Code Review repair only.

## 7. Risks

- AEB is only preserved at the shared preload/contract boundary in this branch.
  This repair does not introduce an AEB product surface, page route, package, or
  formal `0.1.x` AEB entry point.
- Proof mode still exposes evidence helpers by design. Formal mode is the
  owner-visible runtime boundary.

## 8. Next steps

- Return `Fix Ready` to Code Review for HB-CR-001 re-review.
- Do not route to QA or Packaging until Code Review marks the source boundary
  acceptable for QA/integration.

## 9. Commit

- Commit: pending in this review file; final callback should use the actual
  commit hash.
- Branch: `agent/codex/short-term-main-rebind-20260710`
- Tag: none

## 10. Project retrospective

- Value assessment: High
- Cost drivers: differentiating formal product host boundary from proof/smoke
  evidence mode, and validating the actual preload globals rather than the API
  factory alone
- Avoidable costs: earlier tests should have VM-loaded `preload.cjs` instead
  of only checking host-adapter factory output
- Product lessons: hidden/deferred host capabilities must be isolated even when
  current UI code does not call them
- Technical lessons: origin checks are necessary but insufficient; product-mode
  channel availability needs explicit fail-closed guards
- Design / interaction lessons: no owner-visible UI change
- Process lessons: source-level host boundary repairs should not trigger
  packaging or local-stable promotion before Code Review approval
- Follow-up candidate for `docs/retrospectives/PROJECT_LESSONS_CANDIDATES.md`: Yes

## 11. Token usage

- Source: unavailable
- Input tokens: unavailable
- Cached input tokens: unavailable
- Output tokens: unavailable
- Reasoning output tokens: unavailable
- Total tokens: unavailable
- Token lesson: narrow Code Review probes first, full suite second
