# Review: Web preview recovery rework

## 1. Summary

Re-verified and fixed remaining issues from previous incomplete recovery. CSS panel widths fixed, server API restructured for SVGA-priority artifact selection, frontend auto-load updated. Review and status docs added.

## 2. Root cause

Previous recovery restored CSS to d28ebfb baseline but left the 15vw panel widths, shell/workspace overflow:hidden, and single `latest` API field intact. Also missing review file and CURRENT_STATUS/CHANGELOG updates.

## 3. Baseline decision

- CSS: d28ebfb baseline + body overflow:auto + panel width fix + skipLink
- JS: preserved autoLoadLatestArtifact, setupPanelResize, keyboard nav, drag errors, SVGA retry, settings toggle+rescan
- Server: preserved /api/latest-artifact, restructured to latestWithSvga/latestAny

## 4. Requirement checks

| Fix | Status |
|-----|--------|
| Panel width 15vw → clamp(320px,32vw,560px) | Done |
| Log panel width → clamp(420px,42vw,720px) | Done |
| Body overflow:auto for responsive scroll | Done |
| latestWithSvga / latestAny API | Done |
| Frontend auto-load uses latestWithSvga first | Done |
| Review file | Done |
| CURRENT_STATUS update | Done |
| CHANGELOG update | Done |

## 5. Layout recovery

- `--info-panel-width: clamp(320px, 32vw, 560px)`
- `--logs-panel-width: clamp(420px, 42vw, 720px)`
- body `overflow: auto` for narrow window scroll
- Shell/workspace keep `overflow: hidden` (app-shell layout needs this for the grid)

## 6. Artifact loading

- Server computes `updatedAt` from actual file mtimes, not directory mtime
- Returns `latestWithSvga` (latest group containing SVGA) and `latestAny` (latest any group)
- Frontend prefers `latestWithSvga`, falls back to `latestAny` with warning

## 7. Risks

- Settings modal not yet reorganized (cosmetic)
- Menu not fully unified (fitMenu uses dropdown classes, modeSelect still native)
- Play/pause state sync still needs manual verification
- No automated visual regression tests

## 8. Commit

Branch: `agent/hermes/web-preview-recovery-rework`
Agent: Hermes
