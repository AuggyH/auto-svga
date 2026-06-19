# Review: Desktop Shell Feasibility Spike

## 1. Summary

- Mainline: P7 client readiness + P1 infrastructure.
- Documented current Web/Node/inspection boundaries and desktop migration risks.
- Recommended Electron only for a future isolated prototype; no desktop
  framework or dependency is approved or installed.
- Deferred Tauri until the host contract and macOS/Windows playback parity are
  proven.

## 2. Git state

- Branch: `agent/codex/desktop-shell-feasibility`
- Implementation commit: `d832143c0363b533515b1f1472e098e6f35a6cec`
- Uncommitted changes before work: none
- Untracked files before work: none

## 3. Changed files

- `docs/desktop-shell-feasibility.md`
- `docs/decisions/ADR-005-desktop-shell-feasibility.md`
- `docs/reviews/2026-06-19-codex-desktop-shell-feasibility.md`

## 4. Requirement checks

| Requirement | Status |
|---|---|
| Compare Electron, Tauri, and current browser host | Done |
| Define recommended and deferred options | Done |
| Assess Web loading, local server, filesystem, `dist`, and offline inspection | Done |
| Define bounded desktop MVP and explicit non-goals | Done |
| Cover macOS, Windows, packaging, logs, cache, privacy, and distribution | Done |
| Confirm inspection/report host neutrality and UI separation | Done |
| Avoid runtime, dependency, exporter, player, and CLI changes | Done |

## 5. Verification

```text
git diff --check
PASS

git diff --cached --stat
PASS: two implementation documents, 311 insertions

protected-path diff check
PASS: no changes under Web preview, exporters, commands, CLI, or MVP exporter

build and regression tests
SKIPPED: Tier 0 documentation-only delivery; runtime code and dependencies were not touched
```

## 6. Regression and drift

- SVGA exporter output bytes: not touched.
- Web player implementation and layout: not touched.
- CLI default flow: not touched.
- Import, drag-drop, and comparison: not touched.
- No new parser, format, conversion, export workbench, or production gate.
- No AI, external model, multimodal, telemetry, or network analysis service.

## 7. Dependencies and client readiness

- No dependency added or changed.
- Current inspected licenses remain `fast-png` MIT and `protobufjs`
  BSD-3-Clause.
- Electron requires a separate dependency/license/security/package-size spike.
- The desktop path remains local and deterministic, but CDN player scripts must
  be packaged locally before claiming offline behavior.
- Host-side filesystem access, loopback lifecycle, clean `dist`, cache/temp
  cleanup, redacted logs, macOS notarization, and Windows signing are explicit
  follow-up risks.

## 8. Risks and next step

- Recommendation is architecture evidence, not production desktop approval.
- Exact package size and cross-platform playback parity are unmeasured.
- Next single task: bounded Electron dependency, security, offline-asset, and
  package-size spike using a synthetic fixture and preserving the current
  browser workflow as rollback.

## 9. Commit

- Implementation commit: `d832143c0363b533515b1f1472e098e6f35a6cec`
- Branch: `agent/codex/desktop-shell-feasibility`
