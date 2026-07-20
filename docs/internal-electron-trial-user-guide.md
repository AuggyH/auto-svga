# Auto SVGA macOS Internal Trial Guide

## Status

This package is an internal prototype, not a production version. It is for
controlled Auto SVGA team testing only.

- Internal prototype only.
- Not production-approved.
- Unsigned.
- Not notarized.
- macOS arm64 only.
- Windows is not verified.
- No installer, auto-update, cloud sync, account system, format conversion,
  export workbench, or automatic repair.

## Verify the ZIP

Use the SHA-256 value from:

```text
tools/electron-prototype/experiments/svga-web/.artifacts/internal-trial/internal-trial-manifest.json
```

Then verify the archive:

```bash
shasum -a 256 tools/electron-prototype/experiments/svga-web/.artifacts/internal-trial/AutoSVGAInternalPrototype-darwin-arm64.zip
```

The value must match the manifest before testing.

## First Open on macOS

This is unsigned and not notarized. macOS may block the first launch.

For internal testing, use Finder to locate the `.app`, right-click it, choose
Open, and confirm the warning. Do not redistribute the package.

## Load SVGA Files

Use either path:

1. Click the file selection control and choose a local `.svga`.
2. Drag a local `.svga` into the drop area.

The app should show:

- SVGA playback.
- Inspection report.
- Motion Asset Audit read-only panel.
- Internal prototype / non-production / internal testing label.

## Exit

Close the application window. The local server and temporary session directory
should be cleaned up during normal exit.

## Logs and Temporary Data

- No telemetry is enabled.
- No user assets are uploaded.
- Logs should redact local absolute paths.
- Temporary session data is removed on normal exit.
- Reports and cache data must not persist user absolute paths.

## Browser Rollback

If the prototype fails, use the stable browser workflow:

```bash
npm run local:preview
```

## Do Not Include Sensitive Assets in Feedback

When filing feedback, avoid attaching real user SVGA, PNG, screenshots, or
recordings unless the material has been cleared for internal sharing.
