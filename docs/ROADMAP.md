# Roadmap

## Current: MVP 0.1 avatar_frame

- [x] Planning chain (config + structure → motion-plan → project.json)
- [x] 5 animation templates
- [x] Generated assets + image optimization (trimming, scaling)
- [x] Baked sweep mask system
- [x] Unified easing/interpolation
- [x] Preview pipeline (PNG frames + WebM + MP4 + GIF)
- [x] Report + svga-map generation
- [x] Real SVGA protobuf+zlib export
- [x] Delivery packaging
- [x] Acceptance workflow
- [x] Web playback validation tool
- [x] Agent collaboration docs + review process
- [x] DESIGN.md Apple-adapted design system
- [x] Latest artifact auto-load API + frontend
- [x] Panel drag-to-resize (info panel + logs)
- [x] CSS token system + reduced motion + responsive breakpoints

## Next: MVP 0.2 UX Polish

- [ ] Motion presets migration (fadeInOut, panelSlideIn, modalPop, dropdown, etc.)
- [ ] Menu component unification (GlassDropdownMenu)
- [ ] WCAG AAA compliance sweep (contrast audit, keyboard nav, axe testing)
- [ ] Drag-drop UX polish (hover states, error feedback)
- [ ] Visual tuning (wing phase, gem glint, breath glow)
- [ ] Sweep quality/stride evaluation

## Future Phases

- [ ] Mobile responsive layout (< 768px)
- [ ] Automated visual playback verification (Playwright + axe)
- [ ] CI pipeline for build+test+a11y checks
- [ ] Additional asset types: medal, title, bubble
- [ ] Web preview editor (template parameter tweaking without CLI)
- [ ] Runtime mask support in SVGA export
- [ ] Multi-job history selector
- [ ] Full reduce-transparency support
