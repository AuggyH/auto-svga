# Review: short-term-path-display-boundary

## 1. Summary
Added a shared short-term path-display helper and routed recent-file labels,
open display names, and save target display names through it.

This prevents path-like strings from being transformed into owner-visible text
such as `Users designer Secret Project file.svga`; renderer-facing labels now
keep only the file name or immediate parent label.

## 2. Git state
- Branch: agent/codex/svga-workbench-v1-autonomous
- Commit before work: 930d3e2e fix: redact direct short-term save failures
- Uncommitted changes: path-display helper, recent/open/save display-name wiring, focused tests, this review
- Untracked files: docs/research/figma-make-short-term-uiux-prompt.md (unrelated, not staged)

## 3. Changed files
- src/workbench/short-term-path-display.ts
- src/workbench/short-term-recent-files.ts
- src/workbench/short-term-host-actions.ts
- src/workbench/short-term-save-execution.ts
- src/tests/short-term-path-display.test.ts
- src/tests/short-term-recent-files.test.ts
- src/tests/short-term-host-actions.test.ts
- src/tests/short-term-save-execution.test.ts
- docs/reviews/2026-07-02-codex-short-term-path-display-boundary.md

## 4. Requirement checks
| # | Requirement | Status |
|---|-------------|--------|
| 1 | Renderer-facing display names do not expose full local paths. | Done |
| 2 | Recent-file display names and parent labels stay concise and path-redacted. | Done |
| 3 | Save target display names handle macOS and Windows-style separators. | Done |
| 4 | Existing host open, save, recent, and dirty-output behavior remains unchanged. | Done |
| 5 | No temporary UI shell wiring or product-surface expansion. | Done |

## 5. Verification
Commands run and results:
```
$ npm run build
PASS

$ node --test dist/tests/short-term-path-display.test.js dist/tests/short-term-recent-files.test.js dist/tests/short-term-save-execution.test.js dist/tests/short-term-host-actions.test.js dist/tests/short-term-host-session.test.js
PASS, 52 tests

$ git diff --check
PASS
```

## 6. Output inspection
- Not applicable. This is host/session privacy and display-label hardening and
  does not generate SVGA, preview media, app packages, or review ZIPs.

## 7. Risks
- Parent labels intentionally expose only the immediate parent directory name,
  matching the short-term recent-file privacy rule that full paths stay hidden.

## 8. Next steps
- Continue tightening renderer-facing short-term models so future UI wiring can
  rely on safe labels and redacted state by default.

## 9. Commit
- Commit: recorded in final handoff after commit creation
- Branch: agent/codex/svga-workbench-v1-autonomous
- Tag: none
