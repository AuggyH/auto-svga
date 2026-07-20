# Review Packet

## Scope

Acceptance-display launches now emit a bounded pre-input placement proof under
`AUTO_SVGA_PRODUCT_ARTIFACTS`, allowing QA to verify display containment without
foreground CGWindow/PM relay before clicking Open.

## Source Binding

- Requirement: `ASV-REQ-20260709-003`
- QA parent: `ASV-QA-20260714-001`
- Base source: `57b8ef1f1ec55d872514766536f8b1c2df84156e`
- Branch: `codex/0.2-acceptance-placement-proof-20260715`
- Product diff SHA-256:
  `9c320367ca6c076d32e16e4b630282c60760c94710ffec5cd638651525cc0a61`

## Product Delta

- Added `acceptance-startup-placement-proof.cjs` with a pure proof builder/writer.
- Wired `main.cjs` to write the proof after `BrowserWindow` construction and
  before `window.loadURL(rendererUrl)`.
- Added failure-first/source coverage for missing execution id, mismatched
  display, window bounds drift, primary overlap, containment failure, invalid
  artifact root, existing proof collision, privacy, and no owner-preference
  mutation.

## Validation

See `VALIDATION_SUMMARY.json`.

## Nonclaims

No Electron/Auto SVGA/Finder foreground run, installed app mutation, packaging,
promotion, QA route, Code Review route, Product Owner acceptance, public support,
distribution, or release readiness is claimed by this packet.
