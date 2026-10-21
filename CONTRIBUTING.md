# Contributing

Thanks for taking a look. This plugin is deliberately small — please keep it that way.

## Requirements

- Node.js ≥ 20 (no dependencies, no build step)
- A DSH checkout/profile if you want to try it for real

## Before you open a PR

```bash
node tools/selftest.mjs      # must print ALL PASS
node tools/preview.mjs       # optional: open dist/preview.html and watch the sequence
node tools/preview.mjs --config examples/video-then-image.json
```

CI runs the same self-test on Node 20 and 22, plus a compose smoke test.

## What belongs here

- Phase types that fit the existing "full-screen layer" model
- Configuration options with sane defaults and a fallback path
- Behaviour that stays fail-silent: a broken config must never block the app

## What does not

- Bundled artwork, game assets, fonts, or any third-party media
- Dependencies (the package intentionally has zero)
- A build pipeline (the source is the artifact)

## Style

- 2-space indent, no semicolons, single quotes (match `lib/*.js`)
- Comments explain *why*, not *what*
- Anything touching the DOM must only animate `opacity` / `transform`
- Every added code path needs a selftest assertion or a preview check

## Security

Media paths are resolved and confined to `media/` and `~/.dsh/boot-sequence-media/`.
Do not weaken that check; see [SECURITY.md](SECURITY.md).
