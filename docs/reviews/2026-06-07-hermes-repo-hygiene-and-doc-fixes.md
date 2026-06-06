# Review: Repo hygiene and doc fixes

## 1. Summary

Cleaned repository hygiene: removed real design assets from Git tracking, updated .gitignore, fixed outdated documentation, added ADR-001, established asset commit rules.

## 2. Git state before work

- Branch: `main` (clean, synced with origin)
- HEAD: `7e8cfbe` docs: update CHANGELOG and CURRENT_STATUS with merge commit hash
- Tag: `v0.1.0-avatar-frame-handoff-baseline`
- No uncommitted changes

## 3. Changes

Key files:
- `.gitignore` — rewritten to exclude jobs/, input/, generated/, output/, *.svga, *.gif, *.webm, *.mp4, *.psd, *.fig, *.sketch
- `AGENTS.md` — fixed template count (3→5), added Asset Commit Rules section
- `docs/decisions/ADR-001-avatar-frame-mvp-scope.md` — new ADR
- `docs/CURRENT_STATUS.md` — updated with asset rules, preserved UI unverified items
- `docs/CHANGELOG.md` — added repo hygiene entry
- `jobs/` — 19 files removed from Git tracking (`git rm --cached`), local copies preserved

## 4. Asset tracking cleanup

- 19 tracked jobs/ files removed from Git index: 12 PNG design assets, config.json, structure.json, manifest.json, motion-plan.json, project.json, requirement.txt, README_INPUT.md
- Local files intact (149 files under jobs/ remain on disk)
- New .gitignore ensures future jobs/ and generated outputs will not be tracked

## 5. Documentation updates

| File | Change |
|------|--------|
| `AGENTS.md` | Template count 3→5, added Asset Commit Rules |
| `docs/decisions/ADR-001-*.md` | New: scope decision for avatar frame MVP |
| `docs/CURRENT_STATUS.md` | Added asset rules, preserved UI unverified items as known issues |
| `docs/CHANGELOG.md` | Added repo hygiene entry |

## 6. Verification

```
tsc -p tsconfig.json               → BUILD OK
node --test dist/tests/...          → 28 passed, 0 failed
```

Tests use `createTempJob()` with programmatically generated PNGs — no dependency on tracked jobs/.

## 7. Risks

- Previous review UI items (spacing, modal style, global style) remain Not verified — listed as known issues in CURRENT_STATUS
- `duplicateOverlayRisk: true` still needs human visual confirmation
- No new tag created (optional per task spec)

## 8. Next steps

- Human visual acceptance of 002 job
- Complete UI spacing/style verification
- Consider wing phase offset
- Evaluate sweep stride vs quality balance

## 9. Commit

- Branch: `agent/hermes/repo-hygiene-and-doc-fixes`
- Merged to: `main`
- Agent: Hermes
