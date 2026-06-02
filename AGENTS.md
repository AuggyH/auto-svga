# AGENTS.md

## Project Goal

This repository is an MVP for automating SVGA-like animation project generation for avatar frame assets.

Current scope is intentionally narrow:
- only avatar_frame asset type
- CLI first
- intermediate project format first
- 3 animation templates only:
  - breathing_glow
  - metal_edge_sweep
  - gem_twinkle

## Priorities

1. Keep the project runnable
2. Keep the architecture modular
3. Prefer readable TypeScript over clever abstractions
4. Prefer schema-driven design
5. Avoid adding new asset types unless explicitly requested
6. Avoid premature UI work
7. Avoid implementing a full binary SVGA exporter unless explicitly requested

## Expected Core Modules

- asset loader
- template engine
- project builder
- preview renderer
- validator
- CLI commands

## Animation Quality Guidelines

- Keep animation subtle and premium
- Avoid noisy, flashy, or chaotic motion
- Focus on clean highlight motion and controlled glow
- Keep loop duration readable and stable
- Avoid too many simultaneous effects

## Output Contracts

The build step should generate:
- project.json
- generated assets
- preview file
- validation report

## Coding Conventions

- Use TypeScript
- Use pnpm
- Keep functions small and testable
- Keep schemas explicit
- Document assumptions in README

## Future Extension Direction

Possible later phases:
- medal
- title
- bubble
- real svga exporter integration
- lightweight web preview UI
