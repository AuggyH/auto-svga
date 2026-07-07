# Review: packaged-runtime-protobufjs-dependency-fix

## 1. Summary
Fixed the packaged macOS App runtime dependency gap that caused:

```text
Cannot find package 'protobufjs' imported from .../.runtime/dist/workbench/svga/asset-optimizer.js
```

The source SVGA file was not modified by that failure. The failure happened before
the optimization/write path could complete because the packaged App did not carry
the runtime Node dependency closure required by `.runtime/dist`.

## 2. Git state
- Branch: `agent/codex/svga-workbench-v1-autonomous`
- Commit before work: `80d3bdc6`
- Uncommitted changes before review finalization: the three runtime dependency
  fix files listed below were already present from this in-progress task.
- Untracked files before review finalization: this review file

## 3. Changed files
- `tools/electron-prototype/experiments/svga-web/scripts/prepare-runtime.mjs`
- `tools/electron-prototype/experiments/svga-web/main.cjs`
- `tools/electron-prototype/experiments/svga-web/scripts/package-internal-trial.mjs`
- `tools/electron-prototype/experiments/svga-web/tests/svga-web-experiment.test.mjs`
- `docs/reviews/2026-07-07-codex-packaged-runtime-protobufjs-dependency-fix.md`
- `docs/retrospectives/PROJECT_LESSONS_CANDIDATES.md`
- `docs/retrospectives/TASK_RETRO_LEDGER.jsonl`

## 4. Requirement checks
| # | Requirement | Status |
|---|-------------|--------|
| 1 | Do not modify source SVGA while fixing the packaging failure. | Done |
| 2 | Include the runtime dependencies needed by `.runtime/dist/workbench/svga/asset-optimizer.js` inside the packaged App. | Done |
| 3 | Make packaging fail closed if the App archive is missing those runtime dependencies. | Done |
| 4 | Keep installed App smoke independent from the source Git checkout path. | Done |
| 5 | Keep the fix scoped to packaging/runtime dependency closure, not UI or product behavior. | Done |
| 6 | Preserve the short-term client optimization, rename, replacement, and save flow behavior. | Verified by targeted tests and packaged smoke |

## 5. Verification
Commands run and results:

```text
node --check tools/electron-prototype/experiments/svga-web/scripts/package-internal-trial.mjs
passed

node --check tools/electron-prototype/experiments/svga-web/scripts/prepare-runtime.mjs
passed

git diff --check
passed

node --test tools/electron-prototype/experiments/svga-web/tests/svga-web-experiment.test.mjs
31/31 tests passed

npm --prefix tools/electron-prototype/experiments/svga-web run internal:trial:package:mac
passed
```

Additional packaged App inspection confirmed these entries exist in
`Contents/Resources/app.asar`:

```text
/.runtime/build-info.json
/.runtime/node_modules/protobufjs/package.json
/.runtime/node_modules/protobufjs/index.js
/.runtime/node_modules/long/package.json
/.runtime/node_modules/long/index.js
```

A packaged App product smoke was also run from the `.app` binary and completed
without the previous `protobufjs` import failure.

Follow-up validation after local App promotion found that the installed App was
outside the Git checkout and could not derive a valid `headCommit` from
`git rev-parse`. The packaging flow now writes `.runtime/build-info.json` into
`app.asar`, and the main process uses it as the packaged fallback so installed
smoke can remain current-head bound without requiring the App to live inside a
Git repository.

## 6. Output inspection
- Source SVGA mutation: not part of the fix; no source material was edited.
- Runtime dependency closure: `protobufjs` and `long` are copied into `.runtime/node_modules`.
- Packaged archive guard: packaging now checks `app.asar` for the required runtime dependency entries before creating the final ZIP.
- Packaged build identity: `.runtime/build-info.json` carries the source commit into the installed App.
- UI changes: none.

## 7. Risks
- This fixes the known `protobufjs` package resolution failure and the installed-App Git-path dependency found during verification. If future runtime modules import additional external packages, those packages must be added to the runtime dependency closure and package assertion in the same change.
- Packaged smoke is functional evidence. Owner-visible foreground use remains the final practical acceptance path for the installed App.

## 8. Next steps
- Rebuild the internal macOS trial package from the final commit.
- Refresh `/Users/huangtengxin/Applications/Auto SVGA.app` through the local stable promotion flow.
- If another runtime import error appears, treat it as a dependency-closure regression rather than a source SVGA mutation.

## 9. Commit
- Commit: this task commit
- Branch: `agent/codex/svga-workbench-v1-autonomous`
- Tag: none

## 10. Project retrospective
- Value assessment: High
- Cost drivers: packaged-only dependency failures require both archive inspection and real packaged binary smoke, because development-mode tests can resolve dependencies from the workspace.
- Avoidable costs: future runtime imports should update the packaged dependency assertion in the same patch instead of relying on developer machine module resolution.
- Product lessons: a successful source-level optimizer is not enough for short-term client readiness; the packaged App must carry the same runtime closure.
- Technical lessons: `.runtime/dist` modules that import Node packages need an explicit `.runtime/node_modules` closure when packaged into `app.asar`.
- Design / interaction lessons: none; no owner-visible UI changed.
- Process lessons: package build scripts should fail before handoff when required runtime packages are missing.
- Follow-up candidate for `docs/retrospectives/PROJECT_LESSONS_CANDIDATES.md`: Yes

## 11. Token usage
- Source: unavailable
- Input tokens: unavailable
- Cached input tokens: unavailable
- Output tokens: unavailable
- Reasoning output tokens: unavailable
- Total tokens: unavailable
- Token lesson: inspect packaged dependency closure directly instead of repeatedly diagnosing the same packaged-only error from UI symptoms.
