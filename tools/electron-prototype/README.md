# Isolated Electron Prototype

This directory is an experimental desktop runtime boundary. It is not the
default Auto SVGA application and does not replace the browser workflow.

## Commands

Run from this directory:

```bash
npm install
npm run spike:electron:test
npm run spike:electron:smoke
npm run spike:electron:package:mac
npm run spike:electron:package:win
```

Generated `.runtime/`, `.artifacts/`, and `node_modules/` directories are
ignored. The preparation script builds the root project, copies only the
approved runtime roots, verifies vendored checksums, and creates a synthetic
SVGA fixture.

Security and production blockers are documented in
`docs/electron-prototype.md`. In particular, the pinned SVGAPlayer-Web runtime
requires CSP `unsafe-eval`; this prototype is not approved for production use.

## Removal

Delete `tools/electron-prototype/` and its documentation/review files. No root
package dependency or default script needs to be restored.
