# SVGA Workbench macOS Signing Workflow

Date: 2026-06-30
Branch: `agent/codex/svga-workbench-v1-autonomous`

## Summary

Added a local macOS signing and notarization workflow for the internal Electron
trial package. The workflow is dry-run by default, records the exact signing and
notarization command plan, and reports `SIGNING_BLOCKED_REQUIRES_CREDENTIALS`
when official Apple credentials are absent.

## Changed Files

- `tools/electron-prototype/experiments/svga-web/packaging/macos/entitlements.plist`
- `tools/electron-prototype/experiments/svga-web/scripts/macos-signing-workflow.mjs`
- `tools/electron-prototype/experiments/svga-web/package.json`
- `tools/electron-prototype/experiments/svga-web/scripts/macos-package-proof.mjs`
- `tools/electron-prototype/experiments/svga-web/tests/svga-web-experiment.test.mjs`
- `docs/autonomous/SVGA_WORKBENCH_V1_STATUS.md`
- `docs/autonomous/AUTONOMOUS_BLOCKERS.md`
- `docs/autonomous/AUTONOMOUS_RUN_LOG.md`
- `docs/autonomous/LESSONS_CANDIDATES.md`
- `docs/reviews/2026-06-30-codex-svga-workbench-signing-workflow.md`

## Requirement Checks

- Unsigned internal package remains available: pass.
- Signing/notarization workflow exists without requiring credentials: pass.
- Credential-bearing commands require explicit `--execute`: pass.
- Missing credentials are recorded as external blocker, not product failure:
  pass.
- Package proof binds entitlements and workflow scripts: pass.
- No production release, notarization upload, push, or distribution was
  performed: pass.

## Verification

- `node --check tools/electron-prototype/experiments/svga-web/scripts/macos-signing-workflow.mjs`: pass
- `node --check tools/electron-prototype/experiments/svga-web/scripts/macos-package-proof.mjs`: pass
- `npm --prefix tools/electron-prototype/experiments/svga-web run internal:trial:signing-plan:mac`: pass, reported `SIGNING_BLOCKED_REQUIRES_CREDENTIALS`
- `npm --prefix tools/electron-prototype/experiments/svga-web run internal:trial:proof:mac`: pass
- `node --test tools/shared/product-frontend/source-sharing.test.mjs`: pass, 7/7
- `npm --prefix tools/electron-prototype/experiments/svga-web run spike:svga-web:test`: pass, 23/23
- `git diff --check`: pass

## Risks

- The workflow has not completed real signing or notarization because official
  credentials are not present.
- The final signed/notarized release path still requires Integration
  Coordinator acceptance and credential-backed execution.
