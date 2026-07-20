# P5 External Product Review 2

externalOutcome: REPAIR_REQUIRED

reviewedHeadCommit: f75092b5766003a29e5de2bb40867c48f51fd241

## Blocking Findings

1. `canonical-batch-fixture.json` lists only four resource keys. The P5 repair contract requires the canonical fixture to list all six resources:
   `img_frame`, `img_glow`, `img_badge`, `IconAlpha`, `ICONALPHA`, and `img_untouched`.
2. The batch mapping screenshots are not all distinct. Several required states share the same screenshot hash, so the evidence does not prove separate files-selected, exact-match, conflict, manual-resolution, corrupt-PNG, and dimension-warning UI states.
3. `reviewer-b-product-categories.json` still uses `PENDING_EXTERNAL_REVIEW` and has empty `visualObservations`. Repair 2 requires concrete read-only visual observations and PASS/BLOCKING categories.
4. The current product artifacts do not include `p5-ui-flow-proof.json` or `p5-mapping-ui-render-proof.json`.
5. Main UI evidence still exposes raw mapping status or issue codes in primary text. Technical codes may remain only in collapsed technical details.

## Preserve

- At least four real replacements.
- Atomic batch apply.
- Undo/redo.
- Save As and reopened export.
- schemaVersion 4 round-trip report.
- Source SVGA immutability.
- Browser workflow rollback.
- No P6 work.

