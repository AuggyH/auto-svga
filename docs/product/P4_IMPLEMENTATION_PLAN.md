# P4 Implementation Plan

## Mainline

P4 belongs to P7 client readiness and P1/P2 product infrastructure while
extending the accepted P3 image-resource editing loop.

## Plan

1. Build canonical synthetic fixture
   - at least three embedded PNG resources
   - at least two visible resource keys used by different sprites
   - at least one untouched resource
   - replacement A/B with distinct color and SHA-256
   - write `.artifacts/product/P4/canonical-multi-resource-fixture.json`

2. Add host-neutral edit session/history model
   - source identity, original resources, current replacements
   - selected resource key
   - transaction history and cursor
   - saved revision digest and current revision digest
   - dirty, export state, validation errors
   - capped deterministic history

3. Upgrade round-trip integrity
   - schemaVersion 3 report
   - per-replacement exported hash equality
   - untouched resource hash equality
   - sprite reference preservation
   - movie invariant preservation
   - original source hash immutability

4. Wire Electron product flow
   - resource-level modified badges
   - Undo/Redo buttons and keyboard shortcuts
   - reset selected and reset all through transactions
   - save-point clean/dirty copy
   - async operation sequence guard
   - post-save edit returns to dirty

5. Add targeted tests
   - editor multi-resource replacement
   - schemaVersion 3 report
   - history undo/redo/branch truncation
   - dirty/save point
   - async stale response guard
   - Electron source contract tests
   - P3 regression

6. Generate product evidence
   - actual Electron screenshots
   - edit history report
   - multi-resource round-trip report
   - thumbnail evidence
   - final edited SVGA
   - privacy-clean visible upload directory

7. Review and seal
   - preliminary validation
   - read-only Reviewer A
   - true independent read-only Reviewer B
   - final source commit
   - two final `npm run loop:validate` runs
   - final smoke, artifacts, candidate packet, reviewers, seal, post-seal, upload

## Protected Flows

- Do not modify the existing project-to-SVGA exporter.
- Do not modify CLI default flow.
- Do not modify main Web preview player behavior.
- Do not modify browser import, drag/drop, comparison, or `local:preview`
  rollback behavior.
- Do not add new format parsers or conversion flows.
- Do not submit real user assets.

## Validation

Minimum targeted commands before terminal state:

- `npm run build`
- `node --test dist/tests/svga-image-resource-editor.test.js`
- `npm --prefix tools/electron-prototype/experiments/svga-web run spike:svga-web:test`
- `AUTO_SVGA_PRODUCT_MILESTONE=P4 npm run desktop:smoke`
- `npm test`
- `npm run loop:validate`

Final state additionally requires two consecutive `npm run loop:validate` runs,
Electron multi-resource smoke, exported reopen smoke, Reviewer A PASS, true
independent Reviewer B PASS, post-seal verification PASS, and upload privacy
audit PASS.

## Risks

- P3 currently has multi-replacement data structures but not multi-replacement
  proof.
- Undo/redo can accidentally desync preview bytes and UI state if transaction
  application and async preview ordering are not centralized.
- Save-point dirty state can be wrong if based on replacement count rather than
  revision digest.
- Visual evidence must come from the actual Electron app; deterministic scripts
  may validate but must not invent Reviewer B observations.
