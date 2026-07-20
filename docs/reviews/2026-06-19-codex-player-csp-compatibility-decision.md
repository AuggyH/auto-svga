# Review: Bounded player and CSP compatibility decision

## 1. Summary

- Mainline: P7 client readiness + P1 infrastructure.
- Confirmed that `svgaplayerweb@2.3.1` cannot meet strict CSP through a
  one-line `eval` removal because bundled protobuf reflection decoding also
  generates functions dynamically.
- Kept the current player prototype-only and prohibited `unsafe-eval` as a
  production desktop baseline.
- Approved only one next isolated strict-CSP parity spike with
  `svga-web@2.4.4`; production desktop remains blocked.

## 2. Git state

- Branch: `agent/codex/player-csp-compatibility-decision`
- Parent prototype review commit: `963e9866d3bfe6df67ed578674cccf1e7c1f7408`
- Decision commit: `ac8ba72758b3d6249663b833a68960aa03f5cb67`
- Working tree after delivery: clean

## 3. Changed files

- `docs/player-csp-compatibility-decision.md`
- `docs/decisions/ADR-008-player-csp-compatibility.md`
- `docs/electron-prototype.md`

## 4. Evidence and verification

- Current bundle scan: one `eval(` and two `Function(` paths.
- Temporary isolated patch removed dynamic require/global probing and enabled
  strict `script-src 'self'`; Electron smoke still failed playback and canvas
  with CSP `EvalError`, confirming protobuf reflection codegen remains active.
- Temporary experiment was restored; vendored player SHA-256 returned to
  `3e8cb9a59e17a9b0861298eacc4beba79895ebd7178d97669687af07212509b6`.
- `svga-web@2.4.4` package scan: zero `eval(`, zero `Function(`, static generated
  protobuf decoder, MIT, no declared runtime dependencies, 569,692 bytes npm
  unpacked and 121,142-byte tarball.
- `svga@2.1.1` package scan still contains dynamic-code paths and was rejected
  as a CSP solution.
- `git diff --check`: passed.
- `npm test`: not run because final changes are documentation-only and all
  temporary runtime edits were restored. The isolated strict-CSP smoke and its
  root TypeScript build were run as decision evidence.

## 5. Regression and drift

- Only docs changed.
- Not touched: exporter, Web player implementation, Electron prototype
  runtime, CLI default flow, import, drag-drop, comparison, root scripts, and
  dependency graph.
- No production player replacement, fork, renderer, installer, or shell was
  added.
- No AI, external model, multimodal capability, telemetry, or network analysis
  service was used.

## 6. Dependencies and client assessment

- No dependency added.
- Current prototype player remains Apache-2.0 and local-only.
- Candidate evidence: `svga-web@2.4.4`, MIT; evaluated from npm package and
  source only, not added to the repository.
- macOS: existing prototype remains usable with its documented non-production
  CSP exception; candidate parity is not verified.
- Windows: same CSP decision applies; candidate runtime parity is not verified.
- Offline, privacy, path redaction, security flags, and browser rollback remain
  unchanged.

## 7. Risks

- `svga-web@2.4.4` is unofficial and appears single-maintainer; static CSP
  evidence does not prove playback parity or production support.
- A current-player fork would require replacing protobuf reflection codegen and
  maintaining visual parity, not merely deleting one `eval` call.
- Production desktop remains frozen until a candidate passes strict CSP and
  representative playback parity.

## 8. Next step

- Run one isolated `svga-web@2.4.4` strict-CSP playback parity spike. If it
  fails security, parity, or maintenance criteria, freeze production desktop
  shell work and retain the browser workflow.

## 9. Commit

- Commit: `ac8ba72758b3d6249663b833a68960aa03f5cb67`
- Branch: `agent/codex/player-csp-compatibility-decision`
- Tag: none
