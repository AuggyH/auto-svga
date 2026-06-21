# P6 Evidence Index

Generated at: 2026-06-21T19:44:31.012Z
Head commit: `0609a71e4b0bc4a1f48d0adbb342bbe3945e9aa8`
Branch: `agent/codex/p6-integration`

## Status

- Web baseline artifacts: generated under `.artifacts/product/P6/web-baseline/`.
- P6 parity report: generated as `.artifacts/product/P6/p6-parity-report.json` and tracked snapshot `docs/product/P6_PARITY_REPORT_SNAPSHOT.json`.
- Packaged app runtime proof: generated as `.artifacts/product/P6/packaged-app-runtime-proof.json`.
- This index is source-tracked so the review packet can bind generated evidence by path and SHA-256.

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
| p6_evidence | `.artifacts/product/P6/internal-trial-manifest.json` | 2374 | `8dea522ca8e2b48a58b47072ba9cbeae565cb9f03c36608dcee2ec10c2cf57f4` |
| packaged_app_runtime | `.artifacts/product/P6/packaged-app-runtime-proof.json` | 1592 | `a220ff6c43c250f5bbe63f98df153f7da9d4a35882beb5e16674181997f1955a` |
| web_baseline | `.artifacts/product/P6/web-baseline/computed-styles-manifest.json` | 10096 | `17cd15be49bf4cc49c1ebcd576aa9c373e7bebaf80b73cfedc0a7c9aeec1603f` |
| web_baseline | `.artifacts/product/P6/web-baseline/dom-manifest.json` | 309779 | `b41b7f95f2f67a7f21f96582d38fe0a7aa8acb4fabfe57f97ec2cf0edff6b48e` |
| web_baseline | `.artifacts/product/P6/web-baseline/interaction-trace.json` | 1473 | `63a1082efd8fd293fbd3a2169739034dc254cd9fe2331c6c3b7887cebaa93065` |
| web_baseline | `.artifacts/product/P6/web-baseline/motion-manifest.json` | 9818 | `3c25e7728ff214230d44e1a675332837277071926cc34bcb87036fb21dac05f7` |
| web_baseline | `.artifacts/product/P6/web-baseline/request-audit.json` | 439 | `bafd222a7943c57279d064d74cebbaabe465edf87a75310e00afa177cffd8d0c` |
| web_baseline | `.artifacts/product/P6/web-baseline/screenshot-export-review-loaded-1440x900.png` | 426780 | `5b5ccb7d2b30634d3acbf1e22097a11176de73d8b5c37ac14df53fd14956e263` |
| web_baseline | `.artifacts/product/P6/web-baseline/screenshot-export-review-loaded-900x720.png` | 318253 | `e3f4be903efba9f65d20edf1f3de6a50dd6a30a2e83c5931c2ff6a5ea8cbb8fb` |
| web_baseline | `.artifacts/product/P6/web-baseline/screenshot-info-assets-1440x900.png` | 470741 | `aa9e8c575f8ea96058739274d56eaab5a64ca8f56a6dff1f4aa3eab552aaddfa` |
| web_baseline | `.artifacts/product/P6/web-baseline/screenshot-info-overview-1440x900.png` | 532988 | `301b4abae277fc8857d2285e86ae2a8925c9ac89113661dbe1f8bbe67d1073a7` |
| web_baseline | `.artifacts/product/P6/web-baseline/screenshot-invalid-1440x900.png` | 224823 | `08abd0504dcc5ffb7205cf0d35deb060755b64003316b1e5b334e340a0d1d40f` |
| web_baseline | `.artifacts/product/P6/web-baseline/screenshot-local-compare-empty-1440x900.png` | 437810 | `c85b5076f34f7d325b6d371608356397de468fd3e6d576348e9e8e031f5f7dbd` |
| web_baseline | `.artifacts/product/P6/web-baseline/screenshot-local-empty-1440x900.png` | 220597 | `cee0ffdbf7bae3baeb0a7519646591a22b3b9b5275e8e81b4beaa5b75d568621` |
| web_baseline | `.artifacts/product/P6/web-baseline/screenshot-logs-1440x900.png` | 477913 | `886c6d72a29a48119a8cd61753d70b7f3497b3bd9cde3a5131d5e2ddc0dfa58f` |
| web_baseline | `.artifacts/product/P6/web-baseline/screenshot-settings-1440x900.png` | 418761 | `2ba003c4210f4680a16f076a1f8a6c06626d36aa77a7ac470685b8733f2dbc8e` |

## Protected Flows

- Main Web Preview player implementation: not modified by this evidence generator.
- SVGA exporter: not modified.
- CLI default flow: not modified.
- Browser import, drag-drop, and comparison logic: not modified.
