# ADR-008: Player and CSP Compatibility Boundary

Date: 2026-06-19

Status: accepted for bounded follow-up; production desktop remains blocked

## Context

The isolated Electron prototype passed local playback and inspection parity on
macOS, but `svgaplayerweb@2.3.1` requires CSP `unsafe-eval`. Source inspection
and a temporary strict-CSP smoke confirmed that the dependency comes from
protobuf.js reflection code generation, not only one removable `eval` call.

## Decision

1. Keep the current player only in the isolated prototype.
2. Prohibit `unsafe-eval` in any production desktop security baseline.
3. Do not patch, fork, or replace the production Web preview in this decision.
4. Permit one isolated strict-CSP parity spike with `svga-web@2.4.4`.
5. Treat that candidate's zero dynamic-code static scan as evidence for a
   spike, not as playback or production approval.
6. If the candidate fails strict CSP, playback parity, or maintainability
   checks, freeze production desktop shell work and retain the browser workflow.
7. Do not begin installer, signing, update, production packaging, or custom
   renderer work under this decision.

## Rationale

- A one-line patch is insufficient because reflection protobuf decoding still
  constructs functions dynamically.
- Forking the old player would create a long-lived security and parity burden.
- `svga-web@2.4.4` uses static generated protobuf decoders, has an MIT license,
  declares no runtime dependencies, and has no `eval(`/`Function(` match in its
  published JavaScript. It is nevertheless unofficial and requires parity
  testing before any adoption decision.
- A custom renderer is disproportionate to the current P7 feasibility goal.
- Keeping the browser workflow provides a tested rollback without weakening
  desktop CSP.

## Consequences

- Electron remains non-production and non-default.
- Current prototype behavior and package contents remain unchanged.
- Inspection, audit, exporter, CLI, import, drag-drop, and comparison flows are
  unaffected.
- The next desktop task is narrowly defined and reversible.
- Failure of the next spike pauses production desktop work rather than relaxing
  the security baseline.

## References

- `docs/electron-prototype.md`
- `docs/player-csp-compatibility-decision.md`
- `docs/decisions/ADR-007-isolated-electron-prototype.md`
