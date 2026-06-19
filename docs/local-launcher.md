# Auto SVGA Local Launcher

The local launcher starts the existing browser preview workflow with one command.
It does not replace the Web preview server, Electron prototype, exporter, or CLI
pipeline.

## Start

```bash
npm run local:preview
```

Default URL:

```text
http://127.0.0.1:4173/tools/svga-player-preview/
```

The launcher checks the configured port first:

1. If an Auto SVGA preview service is already running, it opens the preview page
   and does not start another server.
2. If no service is running, it starts `tools/svga-player-preview/server.mjs`,
   waits for the preview health check, then opens the browser.
3. If another process owns the port, it fails safely with a clear message and
   does not kill the unknown process.

## Stop

When the launcher started the server, stop it with `Ctrl+C` in the terminal.
The launcher forwards the signal to the child preview server.

If the preview service was already running before launch, the launcher does not
own that process and does not stop it.

## Options

```bash
node tools/launch-local-preview.mjs --port 4173 --host 127.0.0.1
node tools/launch-local-preview.mjs --no-open
node tools/launch-local-preview.mjs --once
```

- `--port`: preview server port. Default: `4173`.
- `--host`: preview server host. Default: `127.0.0.1`.
- `--no-open`: start or detect the service without opening a browser.
- `--once`: start/open and return instead of keeping the child server attached.

Environment:

```bash
PORT=4174 npm run local:preview
AUTO_SVGA_LAUNCH_NO_OPEN=1 npm run local:preview
```

## macOS

macOS is the primary supported platform for this launcher. Browser opening uses
the system `open` command.

## Windows

The launcher includes a basic Windows browser-open path through `cmd /c start`.
Windows runtime validation is still a follow-up task.

## Rollback

Manual startup remains unchanged:

```bash
npm run preview:player
```

Then open:

```text
http://127.0.0.1:4173/tools/svga-player-preview/
```

## Boundaries

- No Electron dependency.
- No installer, signing, notarization, or auto-update.
- No telemetry.
- No external network service.
- No report writes and no absolute path persistence.
- No changes to SVGA export, playback implementation, import, drag-drop, or
  comparison logic.
