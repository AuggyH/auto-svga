# Review: UI and output validation

## 1. Summary

Real browser validation of Web preview page and visual inspection of 002 job outputs. No code fixes needed — all tested items passed. Identified visual items requiring human review.

## 2. Git state

- Branch before work: `main` (clean, `dce7aa9`)
- Tag: `v0.1.0-avatar-frame-handoff-baseline`
- Working branch: `agent/hermes/ui-and-output-validation`

## 3. Validation environment

- OS: macOS 15.5
- Node: system default
- Browser: Chromium (via browser tools)
- Server: `node tools/svga-player-preview/server.mjs`

## 4. Commands

```
tsc -p tsconfig.json                            → BUILD OK
node --test dist/tests/mvp-planner.test.js       → 28 passed
node dist/cli.js build examples/avatar_frame_basic → passed
node dist/cli.js export examples/avatar_frame_basic → passed
node tools/svga-player-preview/server.mjs        → http://127.0.0.1:4173 (200)
```

002 job pipeline could not be re-run because `input/` directory was missing locally. Existing output from previous run was used for visual inspection.

## 5. Web UI checks

| Item | Result |
|------|--------|
| Chinese-first UI (labels, buttons, headings) | Done — all primary labels are Chinese |
| English as secondary/debug only | Done — bilingual format: "中文 / English" |
| Asset panel: "sprite" → "精灵" | Done — no raw English labels |
| Filter buttons: 全部/精灵/图片/序列帧/异常 | Done |
| Info panel tabs: 概览/资源 | Done |
| Settings modal: 播放/预览/工作流/显示/外观 | Done — all Chinese, organized |
| Compare button position stable | Done — toggle stays in card header |
| Compare on/off restores correctly | Done — SVGA A/B panels appear/disappear cleanly |
| SVGA preview left / Reference video right | Done — works in export review mode |
| Job auto-load (?job=jobs/...) | Done — SVGA loads and plays, MP4 loads |
| SVGA info panel empty state | Done — shows "空" (empty) when no data |
| Drag-drop file preview | Not tested (requires file system interaction) |
| Double-line text spacing | Not verified (accessibility tree, not visual) |
| Vertical/horizontal spacing | Not verified (accessibility tree, not visual) |

## 6. Output checks

| Item | Result |
|------|--------|
| Canvas 300×300 | Done — preview frames, GIF, WebM, MP4 all 300×300 |
| Assets within 300×300 | Done — max 297×277 (base frame), sweep 171×330 (note: height > 300, masked) |
| Transparent pixel trimming | Done — `allSvgaImagesTrimmed: true` |
| Baked sweep trimmed | Done — sweep_003: 88×231, sweep_024: 131×258 |
| Baked sweep offset recording | Present in manifest.json |
| Wing amplitude 7.5° / 15° pk-pk | Done |
| Wing anchor at root_joint | Done |
| Memory budget | 2.23MB / 8MB — within budget |
| SVGA file | 339KB, exists, valid |
| Preview frames | 72 frames, 300×300 RGBA PNG |
| WebM | 95KB VP9 alpha |
| MP4 | 54KB H.264 #111827 |
| GIF | 8.5MB (fallback only) |
| Sweep white edge / quality | Not verified (visual, requires human eyes) |
| Duplicate overlay risk | Known — `true` in report |
| Safe area protected | Done — safeArea excluded from sweep |
| SVGA vs GIF visual consistency | Not verified |

## 7. Fixes applied

None. All tested items passed without code changes.

## 8. Remaining risks

- `duplicateOverlayRisk: true` — needs human visual confirmation
- No automated visual playback verification
- Visual-only items (spacing, sweep quality, drag-drop) need human review
- 002 job input/ directory missing locally — can't run full pipeline on real assets until restored

## 9. Next steps

- Human visual acceptance of 002 job in real SVGA player
- Manual drag-drop testing in browser
- Visual spacing/style review
- Restore 002 job input or use alternative test job

## 10. Commit

- Branch: `agent/hermes/ui-and-output-validation`
- Merged to: `main`
- Agent: Hermes
- Tag: none
