# Review: Repo hygiene follow-up fixes

## 1. Summary

Small follow-up to tighten .gitignore examples exception rules, fix outdated job path references in README and TECH_SPEC, add missing commit hash to previous review.

## 2. Git state

- Branch before work: `main` (clean, `6cf7cc0`)
- Tag: `v0.1.0-avatar-frame-handoff-baseline`
- Working branch: `agent/hermes/repo-hygiene-followup-fixes`

## 3. Changes

- `.gitignore` — added `examples/**/*.zip`, `*.svga`, `*.gif`, `*.webm`, `*.mp4` under examples
- `README.md` — `avatar_frame_test_001` → `avatar_frame_local_001` (all refs), added jobs/ gitignore note
- `docs/TECH_SPEC.md` — updated `jobs/` description to local runtime workspace
- `docs/CURRENT_STATUS.md` — added follow-up summary, examples ignore rules note
- `docs/CHANGELOG.md` — added follow-up entry
- `docs/reviews/2026-06-07-hermes-repo-hygiene-and-doc-fixes.md` — added commit/merge hash

## 4. Asset ignore verification

```
$ git check-ignore -v examples/avatar_frame_basic/output.zip
.gitignore:37:examples/**/*.zip  → IGNORED ✓

$ git check-ignore -v examples/avatar_frame_basic/output/test.svga
.gitignore:36:examples/**/output/  → IGNORED ✓

$ git check-ignore -v examples/avatar_frame_basic/output/test.gif
.gitignore:36:examples/**/output/  → IGNORED ✓

$ git ls-files jobs   → (empty) ✓
$ git ls-files input  → (empty) ✓
```

## 5. Documentation fixes

| File | Change |
|------|--------|
| `README.md` | Job path `test_001` → `local_001`, added jobs/ gitignore note |
| `docs/TECH_SPEC.md` | Jobs description updated, added fixtures/examples entries |
| `docs/CURRENT_STATUS.md` | Follow-up summary, examples rules noted |
| `docs/CHANGELOG.md` | Follow-up entry |
| `docs/reviews/...-repo-hygiene-...md` | Commit hash `4efad20` / merge `6079e90` added |

## 6. Verification

```
tsc -p tsconfig.json               → BUILD OK
node --test dist/tests/...          → 28 passed, 0 failed
git ls-files jobs                   → (empty)
git ls-files input                  → (empty)
```

## 7. Risks

- UI spacing/style items from previous review still Not verified (listed in CURRENT_STATUS)
- `duplicateOverlayRisk: true` still needs human visual confirmation

## 8. Next steps

- Human visual acceptance of 002 job
- Complete UI spacing/style verification
- Consider wing phase offset

## 9. Commit

- Branch: `agent/hermes/repo-hygiene-followup-fixes`
- Merged to: `main`
- Agent: Hermes
- Tag: none
