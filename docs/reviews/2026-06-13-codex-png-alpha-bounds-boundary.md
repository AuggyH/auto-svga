# Review: PNG alpha-bound metadata boundary

## 1. Summary

Added a host-neutral alpha-bound metadata contract, optional SVGA analyzer
boundary, and avatar-frame transparent-padding checks. No PNG decoder or new
dependency was added.

## 2. Git state

- Branch: `agent/codex/png-alpha-bounds-boundary`
- Commit before work: `42a3fb3`
- Uncommitted changes: source, tests, Web issue labels, and documentation listed below
- Untracked files: alpha analyzer contract, alpha-bound tests, this review

## 3. Changed files

- `src/workbench/contracts.ts`
- `src/workbench/image-alpha-analyzer.ts`
- `src/workbench/svga/format-adapter.ts`
- `src/workbench/svga/index.ts`
- `src/workbench/svga/spec-checker.ts`
- `src/workbench/specs/avatar-frame-production.ts`
- `src/tests/svga-alpha-bounds.test.ts`
- `src/tests/avatar-frame-production-spec.test.ts`
- `src/tests/avatar-frame-inspection-report.test.ts`
- `tools/svga-player-preview/inspection-report-view.mjs`
- `tools/svga-player-preview/inspection-report-view.test.mjs`
- `tools/svga-player-preview/server-inspection-report.test.mjs`
- `docs/TECH_SPEC.md`

## 4. Requirement checks

| # | Requirement | Status |
|---|-------------|--------|
| 1 | Optional alpha-bound metadata contract | Done |
| 2 | Independent host analyzer boundary | Done |
| 3 | Checker consumes metadata without image decoding | Done |
| 4 | Known, excessive, fully transparent, unknown, unsupported tests | Done |
| 5 | No Canvas, DOM, browser, filesystem, or new dependency in core checker | Done |
| 6 | Existing resource dimension rule preserved | Done |
| 7 | Exporter, player implementation, and CLI default flow unchanged | Done |

## 5. Verification

```text
./node_modules/.bin/tsc -p tsconfig.json
pass

node --test dist/tests/svga-format-adapter.test.js dist/tests/svga-alpha-bounds.test.js dist/tests/svga-resource-dimensions.test.js dist/tests/avatar-frame-production-spec.test.js dist/tests/avatar-frame-inspection-report.test.js
23 pass, 0 fail

node --test tools/svga-player-preview/inspection-report-view.test.mjs tools/svga-player-preview/server-inspection-report.test.mjs
7 pass, 0 fail
```

Full regression was skipped because exporter, playback, dependencies, build
configuration, and CLI routing were not changed.

## 6. Output inspection

- Known padding at or below 50% passes.
- Padding above 50% and fully transparent resources fail.
- Unknown or unsupported metadata produces one aggregated warning and does not fail the report.
- Web report only maps the new issue codes to Chinese labels; it does not analyze images.

## 7. Risks

- No concrete PNG alpha analyzer is connected yet, so current real SVGA reports show an unavailable-analysis warning.
- The 50% threshold is provisional and needs representative production samples.

## 8. Next steps

- Add a desktop host adapter using an approved native or lightweight image decoder, then calibrate the padding threshold from real avatar-frame resources.

## 9. Commit

- Commit: this delivery commit (see repository history)
- Branch: `agent/codex/png-alpha-bounds-boundary`
- Tag: none
