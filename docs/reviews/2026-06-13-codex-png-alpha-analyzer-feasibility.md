# Review: PNG alpha analyzer feasibility spike

## 1. Summary

Completed a documentation-only feasibility spike. The recommendation is to
retain the host boundary and evaluate `fast-png` in a separate dependency
spike. No decoder or dependency was added.

## 2. Git state

- Branch: `agent/codex/png-alpha-analyzer-feasibility`
- Base: `b78efad`
- Relationship: stacked on the alpha-bound metadata boundary commit

## 3. Changed files

- `docs/png-alpha-analyzer-feasibility.md`
- `docs/reviews/2026-06-13-codex-png-alpha-analyzer-feasibility.md`

## 4. Requirement checks

| Requirement | Status |
|---|---|
| Inspect current PNG capabilities | Done |
| Assess no-dependency implementation | Done |
| Compare lightweight dependencies and licenses | Done |
| Assess macOS and Windows host reuse | Done |
| Recommend one route | Done |
| Preserve runtime behavior | Done |

## 5. Verification

- Tier 0 documentation validation.
- `git diff --check`: required before commit.
- `git diff --stat`: required before commit.
- Build and runtime tests skipped because runtime code is not touched.

## 6. Risks

- npm package size is not equivalent to bundled desktop size.
- `fast-png` still requires fixture, malformed-input, memory-limit, and bundle measurements.
- The current report continues to show unavailable alpha analysis until a host analyzer is connected.

## 7. Next steps

- Run a bounded `fast-png` dependency and bundle-size spike without wiring production behavior.

## 8. Commit

- Commit: this delivery commit (see repository history)
- Branch: `agent/codex/png-alpha-analyzer-feasibility`
- Tag: none
