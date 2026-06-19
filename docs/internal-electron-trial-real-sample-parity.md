# Internal Electron Trial Real-sample Parity Audit

## Summary

- Samples: 8
- Browser baseline: local vendored svgaplayerweb@2.3.1 equivalent to current browser workflow player
- Electron candidate: isolated svga-web@2.4.4 internal prototype
- Blocking: 0
- Major: 0
- Minor: 0
- None: 8
- Inconclusive: 0
- Real assets committed: no

## Scope

This audit uses local external SVGA samples copied into ignored runtime storage.
The report stores sample IDs, categories, file sizes, and SHA-256 hashes, but no
absolute source paths and no asset bytes.

Automated checks cover loading, first nonblank frame, playback start, loop
metadata, nonblank canvas, inspection report, Motion Asset Audit panel, and
local-only resource loading.

Manual visual checks are still required for alpha edge fidelity, transform /
scale / rotation / layout parity, mask or matte behavior, sequence visual order,
sweep / glow / particle fidelity, and imageKey replacement behavior.

## Matrix

| Sample | Category | Size bytes | Browser baseline | Electron candidate | Difference | Notes |
|---|---:|---:|---|---|---|---|
| sample-01-basic-small | basic_legacy_small | 117485 | none | none | none | No automated difference detected |
| sample-02-production-size | production_size_300 | 467045 | none | none | none | No automated difference detected |
| sample-03-sequence-heavy | sequence_heavy | 952916 | none | none | none | No automated difference detected |
| sample-04-sweep-glow | sweep_glow_heavy | 3387492 | none | none | none | No automated difference detected |
| sample-05-particle-heavy | particle_heavy | 4236659 | none | none | none | No automated difference detected |
| sample-06-mask-matte-candidate | mask_matte_candidate | 538639 | none | none | none | No automated difference detected |
| sample-07-replaceable-key-candidate | image_key_candidate | 2538825 | none | none | none | No automated difference detected |
| sample-08-large-legacy | large_legacy | 4075852 | none | none | none | No automated difference detected |

## Trial Readiness

Small-scope macOS internal trial is allowed only if blocking and major counts
remain zero. This does not approve production desktop distribution.

## Security Notes

- Electron candidate still uses restricted CSP with internal-only
  `wasm-unsafe-eval` exception.
- Browser baseline uses local vendored `svgaplayerweb@2.3.1` for parity
  evidence; it is not a production desktop security baseline.
- No AI, external model, telemetry, CDN runtime loading, or network analysis is
  used by this audit.
