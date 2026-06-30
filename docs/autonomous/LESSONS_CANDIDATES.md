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

## Package hygiene must inspect the product App ZIP itself

- Context: Workbench review artifacts can have a clean outer ZIP while the
  nested macOS App ZIP still contains Finder metadata.
- Problem: a package hygiene PASS based only on the review wrapper can miss
  `__MACOSX`, AppleDouble `._*`, `.DS_Store`, duplicate entries, or path
  traversal inside the actual product App ZIP.
- Rule: package hygiene is not PASS until the App ZIP entry list itself is
  extracted, indexed, and validated.
- Validation: `tools/svga-workbench/complete-review-package.test.mjs` includes
  failure-first ZIP entry checks; the complete review package generator writes
  `extracted-index/app-zip-entry-list.json` and `package-hygiene-proof.json`.

## HIG study should become a standing Workbench checklist

- Context: the 2026-06-30 UI audit was preceded by a full Apple HIG directory
  crawl and review.
- Problem: HIG learning loses value if it only lives in one audit artifact.
- Rule: carry HIG-derived rules into future Workbench implementation through a
  durable checklist covering hierarchy, feedback, target size, focus, modality,
  scrolling, loading, proof-state distinction, text integrity, reduced motion,
  and truthful privacy/security metadata.
- Validation: `docs/product/SVGA_WORKBENCH_HIG_AUDIT_GUIDE.md` now records the
  project-specific rules and the current UI audit repair queue.

## UI proof must verify visible hit points, not only DOM text

- Context: the diagnostics inspector contained issue text in the DOM, but the
  visible screenshot only showed the summary count.
- Problem: an obsolete 42px tab row in the inspector grid clipped diagnostics
  content into a non-existent tab area, so text-based proof alone overstated
  user-visible feedback.
- Rule: for critical feedback panels, smoke proof should verify that the first
  actionable item is visibly hittable, and layout CSS should not reserve rows
  for controls that are no longer rendered.
- Validation: `npm run desktop:smoke` passed after adding
  `diagnosticFirstIssueVisible` proof for `info-diagnostics-open`, and the
  latest diagnostics screenshot shows visible issue cards.
