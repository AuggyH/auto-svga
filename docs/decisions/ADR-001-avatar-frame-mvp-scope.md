# ADR-001: Avatar Frame MVP Scope

Date: 2026-06-07

## Status

Accepted.

## Context

The auto-svga project is in MVP phase. Decisions about scope boundary are needed to prevent premature expansion.

## Decision

1. Current MVP focuses exclusively on `avatar_frame` asset type.
2. Goal: production-grade SVGA animation auto-generation with preview and acceptance workflow.
3. Out of scope for now: gift effects, screen banners, profile decorations, universal animation editors, and other asset types.
4. Repository uses Git-based agent collaboration. `main` is the stable baseline.
5. Asset submission: real design materials (PNG, PSD, Figma exports) and generated outputs (SVGA, GIF, frame sequences) must not enter Git. Tests use mock fixtures or auto-generated temp assets.

## Consequences

- Clear scope prevents agents from expanding into unsupported asset types.
- Mock fixture strategy keeps the repository lightweight and public-safe.
- When new asset types are eventually needed, a new ADR will define their scope.
