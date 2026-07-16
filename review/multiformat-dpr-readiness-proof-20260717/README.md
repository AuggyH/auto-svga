# Multi-format DPR Readiness Proof

Status: `Source Ready / Not CR-approved / Not QA-ready`

Branch: `codex/0.2-multiformat-material-oracle-readiness-20260717`

Base: `8015bd668054fcbc3fd42ce36d43c47c6a7d6a3f`

Product diff SHA-256:

`4025670e5658c2d4fb2ae5c1f08836810b6c9559c821d94c1fa8065634f0c775`

Changed behavior:

- acceptance startup placement proof records explicit selected/primary scale-factor evidence;
- proof includes `distinctFromPrimary` and `evidenceReady` for QA row classification;
- rejected placement proof also carries bounded scale evidence when available.

Primary validation:

- placement tests PASS 13/13;
- task fixture source oracle PASS 3/3;
- root `test:all` PASS 542/542;
- design-system PASS.

Nonclaims:

- no Electron/Auto SVGA launch;
- no foreground/Finder/install/package/promotion/QA route;
- no installed DPR acceptance or Product Owner acceptance.
