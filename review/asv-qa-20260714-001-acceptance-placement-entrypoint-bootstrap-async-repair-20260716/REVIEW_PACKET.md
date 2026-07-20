# Review Packet

## Scope

Repair `MF-ENTRYPOINT-BOOTSTRAP-CR-001` for the acceptance placement startup
proof/no-process successor.

## Source Binding

- Branch: `codex/0.2-acceptance-placement-entrypoint-bootstrap-20260716`
- Rejected head: `1104eb72ff7af79d701f2063e4253e8000018923`
- Product diff SHA-256: `406a2e6702edb9b6ba263c2ed87740e57f59bcc127a0317b5b677591d559feea`

## Change

`main.cjs` now releases the entrypoint bootstrap fatal/rejection guard with a
single `setImmediate` turn instead of removing it synchronously after
`app.whenReady().catch(...)` is registered. The handler remains bounded and is
not a permanent runtime exception policy.

## Evidence

- Failure-first focused test failed before the repair because source lacked the
  scheduled release.
- Final focused placement test: PASS 11/11.
- Focused startup/proof/picker/file-open group: PASS 25/25.
- Build: PASS.
- Full source suite: PASS 538/538.
- Design-system check: PASS.

See `VALIDATION_SUMMARY.json`.

## Nonclaims

This packet does not claim installed QA, startup placement success in the
installed app, product matrix pass, foreground success, packaging readiness,
Product Owner acceptance, support, distribution, or release readiness.
