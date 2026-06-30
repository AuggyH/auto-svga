# SVGA Workbench v1 Lessons Candidates

Use this file only for verified, reusable observations from the autonomous run.
Do not copy raw chat history or unverified guesses here.

## Review packages are checkpoints, not progress meters

- Context: a complete review directory can be mechanically valid while Product
  Owner feedback still identifies missing real-asset coverage, weak product
  walkthroughs, or unfinished workflow behavior.
- Problem: regenerating a package after every small fix creates noise and can
  make ordinary progress look like a completion claim.
- Rule: only create the next complete review/upload package after a meaningful
  product checkpoint. Between packages, keep run status, blockers, and redacted
  validation artifacts current.
- Validation: `docs/autonomous/AUTONOMOUS_EXECUTION_RULES.md` now records this
  cadence and the post-`cdb101e` package is explicitly marked as a progress
  checkpoint only.

## Real assets should turn parser errors into product constraints

- Context: the first real-asset sequence repair matrix found many failures as
  `Unsupported PNG color type: 3`.
- Problem: treating that as a terminal Phase 4 limitation hid the next product
  problem behind a decoder gap.
- Rule: fix deterministic parser support first when the format is common and
  local, then rerun the same real-asset matrix to expose the true workflow
  boundary.
- Validation: indexed/palette PNG decoding now supports 1/2/4/8-bit
  non-interlaced PLTE/tRNS images; the matrix advanced from color-type failures
  to explicit sequence repair policy outcomes: no group, non-unique candidate,
  or boundary-frame candidate.

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

## Keyboard smoke input must focus body before global shortcut proof

- Context: Workbench smoke uses a trusted Electron keyboard path to prove Space
  toggles synchronized playback from the product surface.
- Problem: sending Space to `body` is unreliable if `document.body` is not
  programmatically focusable; focus can remain on the previous toolbar control
  after closing a modal.
- Rule: smoke drivers that target `body` for global shortcuts should make body
  temporarily focusable before sending the key, and product proof should record
  the trusted key receipt.
- Validation: `npm run desktop:smoke` passed after the smoke input driver set
  `tabindex="-1"` on `body` for keyboard proof and recorded the Space key
  receipt in `desktop-interaction-trace.source.json`.
- Follow-up: source-level accessibility audits should validate the behavior
  contract, not only one historical handler shape. The NQ1 audit now accepts
  the current Space code/key fallback while still requiring text-input
  exclusion and playback toggles.

## UI audit repairs should promote visual findings into machine proof fields

- Context: the HIG audit found target-size, modal-context, loading escape,
  sequence-state, and row-focus issues that were visible in screenshots.
- Problem: screenshot-only review can regress quietly when later layout rules
  preserve DOM text but shrink hit areas or blur state distinctions.
- Rule: each repaired UI issue should add a small proof field or layout check,
  such as `comfortableToolbarTargets`, `resourceRowsFocusable`,
  `settingsBodyScrollTop`, `loadingHeaderActionText`, and
  `sequenceProofStates`.
- Validation: `desktop-state-render-proof.json` records these fields and
  `npm run desktop:smoke` passed on the UI/UX repair slice.

## Current review packages must derive phase evidence from the final head

- Context: the first complete Workbench review package mixed useful product
  progress with older P3/P4 incubation evidence and stale status references.
- Problem: a mechanically clean ZIP can still be misleading if package-local
  status docs or phase reports point to an old active head as current.
- Rule: final review generation should parse the current desktop smoke payload,
  generate compact Phase 2/3/4 reports at package time, and keep historical
  incubation artifacts out of the current evidence path unless they are clearly
  labelled as lineage.
- Validation: the complete review package generator now fails closed when
  required desktop smoke proofs are missing, when `desktop-state-render-proof`
  is not bound to the final head, or when packaged normal runtime proof is not
  bound to the final head.

## Recorded UI state failures must fail the aggregate proof

- Context: a complete review directory can contain secondary-workflow UI states
  such as local compare normal/narrow/minimum screenshots.
- Problem: if those states fail layout proof while the aggregate proof still
  reports PASS, reviewers cannot tell whether the package is clean or carrying
  deferred UI debt.
- Rule: aggregate rendered-state proof must include every recorded failed state,
  and secondary failures must either be fixed or explicitly downgraded in the
  feature matrix before packaging.
- Validation: local compare smoke now captures the three compare states as
  required proof; narrow compare cards stack to keep `播放中` status chips
  readable; `failedStateIds=[]` is required before complete review packaging.

## Sequence anti-flicker proof should separate alpha evidence from canvas delta

- Context: the current supported sequence repair removes a four-pixel
  near-empty speck resource from a 26-resource numeric sequence group.
- Problem: a true byte/alpha repair can be too small or occluded for every
  target frame to show a svga-web canvas hash delta, so a hard all-frames
  canvas-delta gate can reject a mechanically safe repair.
- Rule: product sequence repair proof should require full affected-resource
  alpha proof, source immutability, Save As hash binding, reopen playback, and
  fail-closed unsafe cases. Canvas before/after hashes should still be recorded
  frame by frame; partial canvas-delta observability should remain a known
  evidence note unless the product requirement explicitly demands a visible
  pixel-delta threshold on every target frame.
- Validation: desktop smoke accepted `sequenceProductRepairProof` with
  `productSaveAsEnabled=true`, `repairSuccessClaimed=true`,
  `manualVisualConfirmationRequired=false`, `repairedResourceKey=img_14`,
  `changedResourceCount=1`; exact-frame canvas delta may still be absent for
  four-pixel/occluded targets, so alpha proof remains authoritative.
