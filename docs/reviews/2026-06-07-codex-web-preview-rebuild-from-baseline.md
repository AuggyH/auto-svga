# Review: Web preview rebuild from baseline

## 1. Summary

Rebuilt the playback validation UI from the stable handoff baseline. The work
prioritizes truthful SVGA-first artifact loading, readable panels, recoverable
responsive layouts, and shared interaction primitives.

## 2. Baseline

- Tag: `v0.1.0-avatar-frame-handoff-baseline`
- Commit: `ea4e34d`
- Branch: `agent/codex/web-preview-rebuild-from-baseline`

## 3. Preserved changes

- Git handoff, review, and ignore rules
- 300x300 avatar_frame production pipeline
- real SVGA export and real-player validation
- local drag/drop, Compare, resource inspection, theme support
- local real job files remain on disk but are no longer tracked

## 4. Discarded changes

- 15vw information/log panels
- hidden-overflow responsive layout
- fragmented mode and fit menus
- GIF-first or directory-mtime artifact selection
- reference success masking SVGA failure

## 5. Requirement checks

| # | Requirement | Status |
|---|-------------|--------|
| 1 | Grouped latest artifact API | Done |
| 2 | SVGA-first, same-group frontend loading | Done |
| 3 | Manual selection preserved until rescan | Done |
| 4 | Drag/drop and file buttons retained | Done |
| 5 | Shared playback button state | Done |
| 6 | Information panel 320/420/560 sizing | Done |
| 7 | Logs panel 420/560/720 sizing | Done |
| 8 | Narrow layout remains scrollable | Done |
| 9 | Unified mode and fit dropdown structure | Done |
| 10 | Settings regroup and rescan feedback | Done |
| 11 | Reduced motion | Done |
| 12 | Complete viewport matrix | Not verified |
| 13 | WCAG AAA target | Partial |
| 14 | Real jobs and runtime outputs excluded from Git | Done |

## 6. Layout

Body and workspace vertical scrolling are restored. At constrained widths,
information and logs become dismissible overlays rather than compressing
preview cards.

## 7. Artifact loading

The server computes group freshness from key file mtimes. `latestWithSvga`
remains authoritative even when a newer GIF-only group exists. Reference and
report files are loaded only from the selected group.

## 8. Panels

Both panels have persisted widths, pointer/keyboard resize, double-click reset,
independent scrolling, and fixed-column log/report layouts.

## 9. Menus

Mode and fit controls share dropdown classes and setup logic. Selected state,
Escape, arrows, Enter/Space, outside click, focus, and overflow positioning
are implemented. Cross-step browser keyboard automation was unstable and
remains Partial verification.

## 10. Settings

Settings now use Preview/Appearance, Playback/Acceptance, and
Debug/Accessibility groups. Rescan is a trailing workflow action with
scanning, success, and error feedback.

## 11. Playback and feedback

SVGA A/B, reference, and synchronized primary controls share one playback
state renderer. GIF uses replay semantics.

## 12. Motion

Panel, modal, dropdown, and state changes use short restrained transitions.
System and manual reduced-motion modes collapse nonessential movement.

## 13. Accessibility

Focus-visible, bilingual debug labels, semantic statuses, menu roles, and
separator values are present. WCAG AAA remains Partial until axe, contrast,
and the full keyboard matrix pass.

## 14. Verification

- `npm run build`: passed
- `npm run test:mvp`: 28 passed, 0 failed
- `node --check tools/svga-player-preview/main.js`: passed
- `node --check tools/svga-player-preview/server.mjs`: passed
- live player: real SVGA + same-group GIF/report loaded
- temporary artifact fixture: newer GIF-only group did not displace the newest SVGA group
- narrow browser viewport: vertical scrolling and dual overlays remained reachable
- `git ls-files jobs input`: no tracked runtime job/input files

## 15. Risks

- Full six-width screenshot matrix is not complete.
- axe zero-violation status is not verified.
- Real playback still requires human visual judgment.

## 16. Next steps

- Human review of desktop visual density
- Complete the six-width and axe verification passes
- Merge only after UI approval

## 17. Commit

- Implementation commits: `23ec4d1`, `4e1a6bc`, `6c38fad`, `429cfa3`
- Tag: not created
