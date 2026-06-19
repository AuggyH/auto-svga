# Review: Finalize launcher and svga-web delivery state, then decide wasm-eval security boundary

## 1. Summary
- Finalized delivery wording for the launcher and `svga-web` spike reviews.
- Added ADR-010 to define the Electron player `wasm-eval` boundary.
- Kept runtime code, root package scripts, exporter, Web preview, CLI, import, drag-drop, and comparison untouched in this round.

## 2. Git state
- Branch: `agent/codex/local-preview-launcher`
- Decision commit: `2ddc80b452d81955467f2e4c4d8c254373e61db3`
- Checked branch tip: `agent/codex/local-preview-launcher` at `9bf7296f4562d7c677092d7b716024a942dbc747` before this decision commit
- Checked branch tip: `agent/codex/svga-web-strict-csp-spike` at `351c0ebd193beb85266555bdf2a1293601ffcf35`
- Working tree after decision commit: clean before this review file was added

## 3. Changed files
- `docs/decisions/ADR-010-electron-player-wasm-eval-boundary.md`
- `docs/reviews/2026-06-19-codex-local-preview-launcher.md`
- `docs/reviews/2026-06-19-codex-svga-web-strict-csp-spike.md`

## 4. Requirement checks
| # | Requirement | Status |
|---|-------------|--------|
| 1 | Check local launcher delivery state | Done |
| 2 | Check svga-web spike delivery state | Done |
| 3 | Remove unclosed `this review file only` wording | Done |
| 4 | Add explicit working tree clean state to both review files | Done |
| 5 | Define wasm-eval security boundary | Done |
| 6 | Evaluate strict/no-wasm, internal exception, and safer-player strategies | Done |
| 7 | Do not approve wasm-eval as production baseline | Done |
| 8 | Do not add player, dependency, runtime, Web, exporter, or CLI changes | Done |

## 5. Verification
Commands run and results:

```text
git status --short
git branch --list 'agent/codex/local-preview-launcher' 'agent/codex/svga-web-strict-csp-spike' -v --no-abbrev
```

Result: branch tips confirmed; working tree clean before review-file creation.

```text
git diff --check
```

Result: passed.

```text
rg -n "this review file only|recorded after finalization|see repository history|this delivery commit" ...
```

Result: no matches in the finalized reviews or ADR-010.

Build/test: not run. Runtime code not touched in this round.

## 6. Output inspection
- `svgaplayerweb@2.3.1`: blocked by `unsafe-eval`; prototype-only.
- `svga-web@2.4.4`: playback/report/audit smoke passed; blocked by `wasm-eval`; candidate-only.
- ADR-010 decision: `wasm-eval` is not a production desktop baseline.
- Internal prototype exception is allowed only if local vendored assets, no remote navigation/scripts, no arbitrary file serving, narrow preload, validated IPC, no telemetry, no persisted absolute paths, and no production release claim are all preserved.

## 7. Risks
- Old standalone branch tips remain historical; final status is now documented on the current delivery branch.
- Production desktop remains blocked until a no-wasm/no-eval path or separate internal exception review is completed.
- Windows runtime smoke remains unavailable for the `svga-web` prototype.

## 8. Next steps
- Choose one bounded follow-up: try a no-wasm/no-eval `svga-web` build or patch, run a formal internal-prototype exception review, or freeze desktop playback and continue browser workflow.

## 9. Commit
- Decision commit: `2ddc80b452d81955467f2e4c4d8c254373e61db3`
- Branch: `agent/codex/local-preview-launcher`
- Tag: none
