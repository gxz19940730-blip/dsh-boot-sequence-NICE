# Changelog

All notable changes to this project are documented here.
Format loosely follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/);
versioning follows [Semantic Versioning](https://semver.org/).

## [0.1.0] — 2026-10-21

First public-ready release.

### Added

- Config-driven boot sequence: ordered `phases` of `video` / `image` / `blank`
- Full-screen overlay injected into `<head>` before the app UI renders
- Media route `/dsh-boot-sequence/media/*` with HTTP Range support
- Media lookup order: package `media/` → `~/.dsh/boot-sequence-media/`
- Skip by click or `Escape` / `Space` / `Enter` (immediate, 260 ms fade)
- Optional per-tab replay guard via `oncePerSession` (`sessionStorage`)
- `prefers-reduced-motion` support (transitions and animation disabled)
- Ending sequence: fade to black, hold, then slow reveal of the app
- Optional brand line and skip hint
- `/dsh-boot-sequence/health` diagnostics
- `tools/selftest.mjs` (mocked ctx: injection, compile check, health, media 200/206/traversal 404)
- `tools/preview.mjs` with `--config` / `--out` for standalone HTML previews
- Example configs under `examples/`
- Procedural CSS backdrop (no third-party artwork shipped)

### Design notes

- No build step, no generated artifacts: `screen.css` + `runtime.js` + config are composed per render
- Fail-silent: any composition error results in no injection, never a blocked app
- Clean teardown: overlay nodes and injected `<style>` are removed on exit

[0.1.0]: https://example.invalid/dsh-boot-sequence/releases/tag/v0.1.0
