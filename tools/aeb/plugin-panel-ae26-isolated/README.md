# Auto SVGA AEB AE 26.3 Isolated Overlay

This overlay supplies the CEP manifest and bootstrap HTML for a local AE
26.3-only development extension. Materialize it with the shared files from
`plugin-panel-dev`, then replace `CSXS/manifest.xml` and `index.html` with the
overlay files.

The isolated extension has a distinct CEP identity and uses the dedicated
`semantic-inbox-ae26` request path. Its `index.html` writes a source-defined
`ae26-isolated` bootstrap profile before loading the shared panel script, so
hidden AutoVisible CEP loads do not depend solely on the optional
`getExtensionId()` runtime API. It must not replace or mutate the legacy
`local.auto-svga.aeb.panel.dev` extension while AE 25.5 is running.
