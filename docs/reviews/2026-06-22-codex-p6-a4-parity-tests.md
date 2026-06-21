# Review: P6 A4 parity test framework

## 1. Summary

Added the P6 parity report contract framework without claiming parity PASS.
The framework defines report schemas for feature, visual, interaction, state,
motion, browser regression, desktop runtime proof, security, accessibility, and
artifact index evidence. It also validates required evidence counts, prevents
silent inventory shrink, and binds artifacts by SHA-256.

## 2. Git state

- Branch: `agent/codex/p6-a4-parity-tests`
- Commit before work: `d16fb380c0ff82b9aca3af58b0335708e0b0ef73`
- Uncommitted changes before commit: `src/workbench/p6-parity-report-contract.ts`, `src/tests/p6-parity-report-contract.test.ts`, this review file
- Untracked files before commit: same as above

## 3. Changed files

- `src/workbench/p6-parity-report-contract.ts`
- `src/tests/p6-parity-report-contract.test.ts`
- `docs/reviews/2026-06-22-codex-p6-a4-parity-tests.md`

## 4. Requirement checks

| # | Requirement | Status |
|---|-------------|--------|
| 1 | Define report schemas for all A4 parity categories | Done |
| 2 | Add deterministic validators for required counts | Done |
| 3 | Add no silent inventory shrink validation | Done |
| 4 | Add artifact hash binding helpers and manifest checks | Done |
| 5 | Prepare tests runnable after A1/A2/A3 integration | Done |
| 6 | Do not claim parity PASS before final integration evidence | Done |
| 7 | Do not edit protected files or root `package.json` | Done |

## 5. Verification

Commands run and results:
```
$ npm run build && node --test dist/tests/p6-parity-report-contract.test.js
7 tests passed.

$ npm test
207 tests passed.

$ git diff --check
passed.
```

Setup note:
```
$ pnpm install --frozen-lockfile
failed: pnpm unavailable in this environment.

$ npm install --no-package-lock
installed local node_modules for verification; no package or lockfile change.
```

## 6. Output inspection

- Parity PASS: not claimed.
- Runtime SVGA output: not touched.
- Web preview: not touched.
- Desktop runtime: not touched.
- Root scripts: not touched.

## 7. Risks

- The framework validates integration evidence shape and inventory counts, but
  A1/A2/A3 must still produce the real artifacts and fill the report.
- Default minimum evidence count is one per parity category; integration may
  choose stricter counts by passing validator options.

## 8. Next steps

- Integrate A1/A2/A3 artifacts into a real P6 report generator.
- Run the validator with the final artifact index and previous report baseline.
- Keep final parity PASS blocked until browser, desktop, accessibility, security,
  visual, state, interaction, feature, and motion evidence is present.

## 9. Commit

- Commit: pending
- Branch: `agent/codex/p6-a4-parity-tests`
- Tag: none
