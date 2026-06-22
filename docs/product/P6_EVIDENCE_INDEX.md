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
| p6_evidence | `.artifacts/product/P6/internal-trial-manifest.json` | 2297 | `8955a9ad81be74a8fad1fa2ca7604d3442b5cf6aad0155c3e10de1db30ece538` |
| packaged_app_runtime | `.artifacts/product/P6/packaged-app-runtime-proof.json` | 1240 | `bbb48e38c4aac17ca00b5bea2da4894d45a59e7e5786c6aaf2247a36526141f5` |
| web_baseline | `.artifacts/product/P6/web-baseline/computed-styles-manifest.json` | 10096 | `99073f30d3ab7b4c9ed9f58777a2c377e2384fc0a36fc9b01d97423bdb0b8811` |
| web_baseline | `.artifacts/product/P6/web-baseline/dom-manifest.json` | 336687 | `afd0ee09c0fd2df9a46ceaa4f4695cb2e7a32d312b5780ba89c9cd504a823a76` |
| web_baseline | `.artifacts/product/P6/web-baseline/interaction-trace.json` | 1474 | `9d414d59cd696ab90486d1f6564779a917580c7d148552fc90cf882cf5597eb8` |
| web_baseline | `.artifacts/product/P6/web-baseline/motion-manifest.json` | 9818 | `3c25e7728ff214230d44e1a675332837277071926cc34bcb87036fb21dac05f7` |
| web_baseline | `.artifacts/product/P6/web-baseline/request-audit.json` | 439 | `d236e43cdd7c3a18b10d4bcf1c3975069db6a780fd0118ea4aa57c71d9629d77` |
| web_baseline | `.artifacts/product/P6/web-baseline/screenshot-export-review-loaded-1440x900.png` | 132567 | `aed8398dce3b484ba22ea688e4dabeb2996feb27b146482e2ccf605ec19f8817` |
| web_baseline | `.artifacts/product/P6/web-baseline/screenshot-export-review-loaded-900x720.png` | 111014 | `a03b9db4b94de1ee1b03e886866415855c2497c365b0360ddb730deedebe962f` |
| web_baseline | `.artifacts/product/P6/web-baseline/screenshot-info-assets-1440x900.png` | 164364 | `7b02fdb6236e2cc855753ee21a469d9fecb65ce59fd85b5ce9384cfcb3b789dd` |
| web_baseline | `.artifacts/product/P6/web-baseline/screenshot-info-overview-1440x900.png` | 192005 | `5cbeb6c8cb94689357321cdf494f78c98fe3a259911789604225a544c819ed5a` |
| web_baseline | `.artifacts/product/P6/web-baseline/screenshot-invalid-1440x900.png` | 73777 | `eaa8e5dc81f5e8c292af8c0da04e6c24127132d567743aa7110665c4b0554289` |
| web_baseline | `.artifacts/product/P6/web-baseline/screenshot-local-compare-empty-1440x900.png` | 137683 | `a03510a4650467010627f4b59f586d2b83223b6d5cf139bb5ac87741b86144f7` |
| web_baseline | `.artifacts/product/P6/web-baseline/screenshot-local-empty-1440x900.png` | 45987 | `3ab6f16ced0fc3b0f4d55f754b3bc30be92853969f27ab16e9f5aeb2b54c35f6` |
| web_baseline | `.artifacts/product/P6/web-baseline/screenshot-logs-1440x900.png` | 168247 | `266f26ac95a2b3ac9b8e2ed751f8aaff33d1681859ea3eecd7e317cb4cff2cb6` |
| web_baseline | `.artifacts/product/P6/web-baseline/screenshot-settings-1440x900.png` | 178508 | `bb67a978e9a7f2c800559c913ad2ca25fddb3a22715dd9935ed223855fedc76e` |

## Protected Flows

- Main Web Preview player implementation: not modified by this evidence generator.
- SVGA exporter: not modified.
- CLI default flow: not modified.
- Browser import, drag-drop, and comparison logic: not modified.
