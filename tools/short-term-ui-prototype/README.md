# Short-term UI Structure Prototype

This folder contains a standalone static prototype for the corrected
short-term Auto SVGA UI/UX direction.

Open `index.html` directly in a browser, or serve this folder locally during
browser testing.

## Scope

- Represents the S1-S15 short-term app shell, page states, modules, and
  component structure.
- Uses design-token CSS variables and reusable component classes.
- Uses fixture state only. It does not parse SVGA, optimize bytes, rename real
  references, replace real resources, or write files.
- Does not change the existing preview, export, validation, or shared frontend
  runtime paths.

## Covered Flows

- Launch, loading, load failed, and recovery.
- Preview Overview, Optimization, and Replaceable Elements tabs.
- Optimization comparison and save validating, complete, and failed states.
- imageKey rename interaction and dirty save state.
- Runtime image replacement preview and runtime text replacement modal.
- General compare and Edit mode reserved layout.

## Product Boundaries

The prototype follows `docs/product/PRODUCT_ROADMAP.md` as the authority and
uses the short-term UI/UX design docs as design input only. It intentionally
does not expose export acceptance, sequence repair, batch replacement, AI
generation, accounts, cloud sync, or advanced motion authoring controls.
