# SVGA Workbench v1 Lessons Candidates

Use this file only for verified, reusable observations from the autonomous run.
Do not copy raw chat history or unverified guesses here.

## Host source identity must survive renderer file loading

- Context: desktop Save As flows for edited or optimized SVGA bytes need a
  host-issued `sourceId` so the main process can prove the output is saved to a
  new path instead of overwriting the original.
- Problem: the Electron menu injection path attached `autoSvgaSourceId` and
  `autoSvgaSourceHash` to the injected `File`, but the shared frontend loader
  did not preserve those fields in `players.a.sourceIdentity`.
- Rule: any future renderer file-loading path that originates from trusted
  desktop host IPC must forward host source identity into the product state
  before exposing Save As actions.
- Validation: `node --test tools/shared/product-frontend/source-sharing.test.mjs`,
  `npm --prefix tools/electron-prototype/experiments/svga-web run spike:svga-web:test`,
  and `npm run desktop:smoke` passed on 2026-06-30.

## Distribution scripts should default to dry-run until credentials are present

- Context: macOS signing and notarization require official Apple Developer ID
  identity and notary credentials, but the autonomous run can still prepare the
  workflow locally.
- Problem: treating missing credentials as a generic package failure blurs the
  line between local product readiness and external distribution approval.
- Rule: signing/notarization scripts should print a redacted plan and report a
  credential blocker by default; credential-bearing commands must require an
  explicit execution flag.
- Validation:
  `npm --prefix tools/electron-prototype/experiments/svga-web run internal:trial:signing-plan:mac`
  reported `SIGNING_BLOCKED_REQUIRES_CREDENTIALS`, and
  `npm --prefix tools/electron-prototype/experiments/svga-web run internal:trial:proof:mac`
  passed on 2026-06-30.
