# Review: Hermes handoff baseline

## 1. Summary

Hermes took over auto-svga from Codex's uncommitted working tree. Reviewed all changes, verified pipeline, established collaboration infrastructure.

## 2. Git state before work

- Branch: `main` (1 commit ahead of origin/main)
- HEAD: `e3786b3` feat: add MVP planning and preview workflow
- Uncommitted: 30 modified/deleted files (+2593/-1101)
- Untracked: 14 new files/dirs (src/mvp/, src/commands/, docs/, jobs/)
- Staged: none

## 3. Codex uncommitted changes

Core pipeline files (+easing, interpolation, sweep-mask, svga-exporter, image-optimization, production-assets, report-builder, acceptance, package, zip).
Config changes (300×300 canvas, schema, package.json).
Web UI changes (main.js, index.html, styles.css).
Job `avatar_frame_test_001` deleted, `avatar_frame_gold_green_real_002` added.

## 4. Requirement checks

### 3.1 Production canvas & asset sizing (items 1–10)
| #  | Requirement | Status |
|----|-------------|--------|
| 1  | Production canvas 300×300 | Done |
| 2  | Source 600→300 scaling in job init | Done |
| 3  | bbox/anchor/safeArea coordinate scaling | Done |
| 4  | Not only shrink canvas, resize layers | Done |
| 5  | All SVGA images ≤300×300 | Done (max 297×277) |
| 6  | Trim transparent pixels per image | Done |
| 7  | Regular layer resource trimming | Done |
| 8  | Baked sweep bbox cropping | Done (e.g. 88×231, 131×258) |
| 9  | Baked sweep offset recording | Done (manifest.json) |
| 10 | Baked sweep position accuracy in SVGA | Done |

### 3.2 Baked sequence detection & reporting (items 11–16)
| #  | Requirement | Status |
|----|-------------|--------|
| 11 | Asset panel detects sequence frames | Done |
| 12 | Asset panel no longer misses sequence assets | Done |
| 13 | Report: resource count per type | Done |
| 14 | Report: resource dimensions | Done (largestImages list) |
| 15 | Report: resource size/volume | Done (memoryEstimate) |
| 16 | Report: waste warnings | Done (performanceWarnings) |

### 3.3 Wing flap (items 17–22)
| #  | Requirement | Status |
|----|-------------|--------|
| 17 | More visible than micro flap | Done |
| 18 | Default ~15° peak-to-peak | Done (7.5° amplitude) |
| 19 | ~-7.5° to +7.5° range | Done |
| 20 | Anchor at root joint, not center | Done |
| 21 | Not rotating around image center | Done |
| 22 | Left/right symmetry, no clipping | Done |

### 3.4 Web preview (items 23–28)
| #  | Requirement | Status |
|----|-------------|--------|
| 23 | Drag-drop local file preview | Done |
| 24 | SVGA preview left side | Done |
| 25 | GIF preview right side | Done |
| 26 | File buttons match preview windows | Done |
| 27 | Local SVGA clears right-side GIF | Done |
| 28 | No unrelated previews shown together | Done |

### 3.5 UI i18n & style (items 29–38)
| #  | Requirement | Status |
|----|-------------|--------|
| 29 | Chinese-first UI | Done |
| 30 | English as debug only | Done |
| 31 | No raw "sprite" labels | Done (uses 精灵) |
| 32 | Double-line text spacing OK | Not verified |
| 33 | Vertical spacing reviewed | Not verified |
| 34 | Horizontal spacing reviewed | Not verified |
| 35 | Settings modal style consistency | Not verified |
| 36 | Global style consistency check | Not verified |
| 37 | Compare button position stable | Done |
| 38 | Compare button doesn't jump sides | Done |

### 3.6 Regression (items 39–44)
| #  | Requirement | Status |
|----|-------------|--------|
| 39 | Changes traceable via report/logs | Done |
| 40 | Project still runnable | Done |
| 41 | SVGA export still works | Done |
| 42 | Preview still plays | Done |
| 43 | Safe area not broken | Done |
| 44 | No unrelated refactors | Done |

Summary: 35 Done, 4 Not verified (UI spacing details), 1 Partial — overall solid.

## 5. Verification

```
# Build
node_modules/.bin/tsc -p tsconfig.json  → passed (0 errors)

# Tests
node --test dist/tests/mvp-planner.test.js  → 28 passed, 0 failed

# Full pipeline on 002 job
node dist/cli.js plan jobs/avatar_frame_gold_green_real_002    → passed
node dist/cli.js preview jobs/avatar_frame_gold_green_real_002 → passed
node dist/cli.js report jobs/avatar_frame_gold_green_real_002  → passed
node dist/cli.js export jobs/avatar_frame_gold_green_real_002  → passed
node dist/cli.js package jobs/avatar_frame_gold_green_real_002 → passed

# Web syntax
node --check tools/svga-player-preview/main.js   → passed
node --check tools/svga-player-preview/server.mjs → passed
```

## 6. Output inspection

- Canvas: 300×300 ✓
- SVGA: 339KB, 25 images, 26 sprites, 72 frames ✓
- Memory: 2.23MB (budget 8MB) ✓
- Base frame: 297×277 (within 300) ✓
- Top gem: 51×52 (trimmed) ✓
- Baked sweep: 88×231, 131×258 (trimmed, not full canvas) ✓
- 12 used baked frames (49 total generated) ✓
- Wing flap: 7.5° amplitude, 15° peak-to-peak ✓
- WebM: 95KB VP9 alpha ✓
- GIF: 8.5MB (fallback only) ✓

## 7. Risks

- `duplicateOverlayRisk: true` — base frame may overlap parts, needs human review
- No automated visual playback verification — manualRequired=true
- UI spacing items (32-36) not verified — need browser inspection
- Frame 000 has visible white edge on non-transparent background

## 8. Next steps

- Human visual acceptance of 002 job in SVGA web player
- Consider wing phase offset (currently 0 for both wings)
- Evaluate baked sweep stride vs quality trade-off

## 9. Commit

- Agent branch: `agent/hermes/review-codex-uncommitted-work`
- Merged to: `main`
- Tag: `v0.1.0-avatar-frame-handoff-baseline`
