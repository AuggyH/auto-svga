# P6 Evidence Index

Generated at: source-tracked runtime snapshot
Head commit: `source-tracked-runtime-snapshot`

This source-tracked file is intentionally commit-neutral. Final head-bound
P6 evidence is generated into `.artifacts/product/P6/` and mirrored into
`review/P6-latest/` during handoff.
Branch: `agent/codex/p6-integration`

## Status

- Web baseline artifacts: generated under `.artifacts/product/P6/web-baseline/`.
- P6 parity report: generated as `.artifacts/product/P6/p6-parity-report.json`; `docs/product/P6_PARITY_REPORT_SNAPSHOT.json` is a source-tracked runtime snapshot.
- Packaged app runtime proof: generated as `.artifacts/product/P6/packaged-app-runtime-proof.json`.
- Final review packets bind generated evidence by path and SHA-256 from `.artifacts/product/P6/` and the visible `review/P6-latest/` mirror.

## Section Summary

- featureParity: pass, evidence 12/12, inventory 12
- visualParity: pass, evidence 14/14, inventory 14
- interactionParity: pass, evidence 10/10, inventory 10
- stateParity: pass, evidence 12/12, inventory 12
- motionParity: pass, evidence 9/9, inventory 9
- browserRegression: pass, evidence 3/3, inventory 3
- desktopRuntimeProof: pass, evidence 3/3, inventory 3
- securityAudit: pass, evidence 3/3, inventory 3
- accessibilityReport: pass, evidence 2/2, inventory 2
- artifactIndex: pass, evidence 1/1, inventory 42

## Key Artifact Hashes

| Role | Path | Size | SHA-256 |
| --- | --- | ---: | --- |
| p6_evidence | `.artifacts/product/P6/internal-trial-manifest.json` | 2374 | `a47c8557f725eeb36785188eb0d4ec88759a902627a3ccc9052768fd3a959005` |
| packaged_app_runtime | `.artifacts/product/P6/packaged-app-runtime-proof.json` | 1592 | `a0538c1bf7da69a0332ca15ec8091463ea519c9cb55bc357c31558bda53b80c9` |
| web_baseline | `.artifacts/product/P6/web-baseline/computed-styles-manifest.json` | 10096 | `17cd15be49bf4cc49c1ebcd576aa9c373e7bebaf80b73cfedc0a7c9aeec1603f` |
| web_baseline | `.artifacts/product/P6/web-baseline/dom-manifest.json` | 309779 | `d0a02fae4186d0560531961fdd30a41f41550b49dadb9eea1ae9e2b13e9173d8` |
| web_baseline | `.artifacts/product/P6/web-baseline/interaction-trace.json` | 1473 | `f8f33e7acccda26da60f3ca6f89d9d09dcf8d185e239415041da8a29ee7d2957` |
| web_baseline | `.artifacts/product/P6/web-baseline/motion-manifest.json` | 9818 | `3c25e7728ff214230d44e1a675332837277071926cc34bcb87036fb21dac05f7` |
| web_baseline | `.artifacts/product/P6/web-baseline/request-audit.json` | 439 | `4bd215fcd3ac42346792a27ef23544154ec4a1d71811856cc58c99a71d9f18a2` |
| web_baseline | `.artifacts/product/P6/web-baseline/screenshot-export-review-loaded-1440x900.png` | 425190 | `ddc0bda371f11a2b6f77b250fe208de175732d1eb85a0ee4a69fc1e13df346a1` |
| web_baseline | `.artifacts/product/P6/web-baseline/screenshot-export-review-loaded-900x720.png` | 318919 | `4873b5fedd0f54f3d828a7a29d4bd6ff93f6c87aea23440e8be73eae143a58af` |
| web_baseline | `.artifacts/product/P6/web-baseline/screenshot-info-assets-1440x900.png` | 470518 | `a02e627f12f8aade5c77a22d1ca7d4bf5b54330ecfa927efae772f0c55e72f11` |
| web_baseline | `.artifacts/product/P6/web-baseline/screenshot-info-overview-1440x900.png` | 531191 | `4e4d397b96ac0c2aa6fb364044b5360b07684cc4914e2b7d2ebb160947f0454e` |
| web_baseline | `.artifacts/product/P6/web-baseline/screenshot-invalid-1440x900.png` | 224823 | `08abd0504dcc5ffb7205cf0d35deb060755b64003316b1e5b334e340a0d1d40f` |
| web_baseline | `.artifacts/product/P6/web-baseline/screenshot-local-compare-empty-1440x900.png` | 437794 | `c4a0605d7d65c833bfbe00f65dd830f4bc3b67762535e372d3593aaee0d06e9b` |
| web_baseline | `.artifacts/product/P6/web-baseline/screenshot-local-empty-1440x900.png` | 220550 | `d19929b176d8436f01c367b2c218bd5ca2b8d7312653d103fdba2a46a3d18023` |
| web_baseline | `.artifacts/product/P6/web-baseline/screenshot-logs-1440x900.png` | 476995 | `921115d8d6c4dabb99a90820f14c8af773f0426bc9e62975c7777800fad17ebb` |
| web_baseline | `.artifacts/product/P6/web-baseline/screenshot-settings-1440x900.png` | 418878 | `939ec104fa8fec85fba17abd40c0c790d1f581e165d2db9f17992bc23cc1e77e` |

## Protected Flows

- Main Web Preview player implementation: not modified by this evidence generator.
- SVGA exporter: not modified.
- CLI default flow: not modified.
- Browser import, drag-drop, and comparison logic: not modified.
