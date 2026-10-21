# Security

## Reporting

Open a private security advisory on the repository, or email the maintainer listed in `package.json`.
Please do not file a public issue for a vulnerability.

## Threat model

The plugin runs in the host process and registers one HTTP route:

```
GET|HEAD /dsh-boot-sequence-nice/media/<path>
```

The path is decoded, resolved, and **must stay inside** one of two directories:

- `<package>/media/`
- `~/.dsh/boot-sequence-media/`

Anything else — `..`, absolute paths, symlinks pointing outside, NUL bytes — is rejected with `404`.
Only a fixed extension allowlist is served (`mp4/webm/mov/jpg/jpeg/png/webp/avif/gif`); unknown extensions are
not served even if the file exists.

The route is read-only, supports `Range`, and never writes to disk.

## Things that are by design

- The injected script is inline in `<head>`; it contains only configuration and CSS, never user input echoed as HTML.
- Config values are length-clamped (`text` ≤ 80 chars, `hint` ≤ 60, phase count is unbounded but each phase is cheap).
- If composition fails for any reason, nothing is injected — the app still starts.
