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

- featureParity: pass, evidence 33/33, inventory 33
- visualParity: pass, evidence 20/20, inventory 20
- interactionParity: pass, evidence 10/10, inventory 10
- stateParity: pass, evidence 12/12, inventory 12
- motionParity: pass, evidence 9/9, inventory 9
- browserRegression: pass, evidence 3/3, inventory 3
- desktopRuntimeProof: pass, evidence 3/3, inventory 3
- securityAudit: pass, evidence 3/3, inventory 3
- accessibilityReport: pass, evidence 2/2, inventory 2
- artifactIndex: pass, evidence 1/1, inventory 32

## Key Artifact Hashes

| Role | Path | Size | SHA-256 |
| --- | --- | ---: | --- |
| p6_evidence | `.artifacts/product/P6/internal-trial-manifest.json` | 2297 | `464b10d6989e93c04af660e558721371694a95f77887f03a7b555cdbb1a4500b` |
| packaged_app_runtime | `.artifacts/product/P6/packaged-app-runtime-proof.json` | 1482 | `2862a771f9872ddf951dd3207adc7f772d126b9c6739999ed28948a4749fd30e` |
| web_baseline | `.artifacts/product/P6/web-baseline/computed-styles-manifest.json` | 10096 | `99073f30d3ab7b4c9ed9f58777a2c377e2384fc0a36fc9b01d97423bdb0b8811` |
| web_baseline | `.artifacts/product/P6/web-baseline/dom-manifest.json` | 336687 | `13f1a99fab1a98b9dd5bcf4fbc290399579439354990713c0c8c9bc75084bc92` |
| web_baseline | `.artifacts/product/P6/web-baseline/interaction-trace.json` | 1474 | `ae691f9e13dc80fc6ff2220b6c8498c9a3f0bbcc40d0b9d7ecbdec94a72dbe42` |
| web_baseline | `.artifacts/product/P6/web-baseline/motion-manifest.json` | 9818 | `3c25e7728ff214230d44e1a675332837277071926cc34bcb87036fb21dac05f7` |
| web_baseline | `.artifacts/product/P6/web-baseline/request-audit.json` | 439 | `3994bb4363bfc633eafd6ae58e97659b143849ddafdb078437bc65d087f614ac` |
| web_baseline | `.artifacts/product/P6/web-baseline/screenshot-export-review-loaded-1440x900.png` | 132826 | `a2fde689de5f20c93220fcebf4ad8d5428cfc4295095876474ce61f98d9be924` |
| web_baseline | `.artifacts/product/P6/web-baseline/screenshot-export-review-loaded-900x720.png` | 110719 | `cbc0516d09ef92328cff95080ea6b95f61c8b46e7c9eea03e5ee7a496bcf352b` |
| web_baseline | `.artifacts/product/P6/web-baseline/screenshot-info-assets-1440x900.png` | 163647 | `b9853d38e775a042745c07ca53670b9c3bc7bce472087eafca7640e9e1816bbd` |
| web_baseline | `.artifacts/product/P6/web-baseline/screenshot-info-overview-1440x900.png` | 193037 | `a62622a9ce247e822f46ad74f04027cf16b97d8b962a2c54be3ab1005ba85cfe` |
| web_baseline | `.artifacts/product/P6/web-baseline/screenshot-invalid-1440x900.png` | 73774 | `7e93924666b0ddd859a666efa0e7e09975c01a63a5c826b097ce1eeab253988e` |
| web_baseline | `.artifacts/product/P6/web-baseline/screenshot-local-compare-empty-1440x900.png` | 137655 | `a3d069465602ad4b1e56a6a6b2422ceb5b51bc4a03e07f26dcc9aa034de70f3b` |
| web_baseline | `.artifacts/product/P6/web-baseline/screenshot-local-empty-1440x900.png` | 45978 | `2ba7aa2690190ed7c985f2fe1f7ac134389b203fe850e891ab5355ea6316ff09` |
| web_baseline | `.artifacts/product/P6/web-baseline/screenshot-logs-1440x900.png` | 168574 | `a9e5574bb6ab4b1191c0e79ad04e0ccbca411c3b9b2091783c2966b759b24e69` |
| web_baseline | `.artifacts/product/P6/web-baseline/screenshot-settings-1440x900.png` | 178262 | `121ca64cb3bb976f6c8560081cb3563bdd14c620bbfa8782a03c2a9ab9407983` |

## Protected Flows

- Main Web Preview player implementation: not modified by this evidence generator.
- SVGA exporter: not modified.
- CLI default flow: not modified.
- Browser import, drag-drop, and comparison logic: not modified.
