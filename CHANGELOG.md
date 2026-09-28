# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and this project
adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [1.3.0] - 2026-09-28

Security and reliability pass over the 1.2 line. No API was removed; the
`data-img` validation rules below are the only behavioural change and are
called out as breaking.

### Security

- **Validate every `data-img` before it reaches CSSOM.** 1.2 passed the
  attribute straight into `url(...)`. A `data-img` is markup supplied by a
  template or CMS, so on any real site it crosses a trust boundary. The value
  must now be a non-empty string with no control characters, and must be a
  relative path, a protocol-relative URL, an `http:`/`https:` URL, or a `data:`
  URL with an image media type. `javascript:`, `vbscript:`, `blob:`, `file:`
  and `data:text/html` are rejected. **Breaking** for anyone relying on a
  non-web scheme; rejected layers are skipped with a console warning.
- Reject values containing C0 control characters, which browsers strip and
  which can otherwise smuggle a scheme past a naive check
  (`java<TAB>script:alert(1)`).
- Leave the author's element untouched — including the `<img>` no-JavaScript
  fallback — when every layer of an icon is rejected, instead of replacing good
  markup with a broken icon.
- Sanitise untrusted values before they reach the console: control characters
  are replaced and output is truncated at 120 characters, so a crafted `data-img`
  cannot flood or forge log lines.
- The touch scroll-lock flag moved off `window` into per-call state. In 1.2
  `window.preventScroll` was a global that any other script on the page could
  read and flip.
- Quote the CSS `url()` token so layer paths containing spaces or parentheses
  are no longer truncated by the CSS parser.

### Fixed

- `atvImg()` called before `<body>` existed captured `undefined` and threw on
  the first pointer event. It now falls back to `document.documentElement`.
- An author-supplied `id` on `.atvImg` is preserved instead of being
  overwritten with `atvImg__<n>`.
- The container is now captured by reference rather than re-derived from
  `firstChild`, which threw if anything inserted a text node before it.
- `preventDefault()` is only called on cancelable `touchmove` events; on
  non-cancelable events it was a console error in Chromium.
- Movement is ignored for elements that measure `0x0` (hidden, or not yet laid
  out) instead of writing `rotateX(NaNdeg)`, which browsers discard.
- Synthetic or legacy events that omit `pageX`/`pageY` fall back to
  `clientX`/`clientY` rather than producing `NaN` transforms.
- Hybrid devices (touch laptops, browser device emulation) now drive the plug-in
  with the mouse when a fine pointer is available, instead of losing hover
  entirely because touch support was detected.

### Changed

- `mousemove`/`touchmove` updates are coalesced with `requestAnimationFrame`, so
  a page with many icons no longer forces a synchronous layout and a style
  write per layer on every pointer event. Falls back to synchronous updates
  where `requestAnimationFrame` is unavailable.

### Added

- CommonJS export, so the plug-in can be `require`d and unit tested.
  `require('atvimg').isSafeImageUrl` exposes the validator.
- Test suite grown from 12 to 40 tests, with an enforced coverage threshold
  (`coverageThreshold` in `package.json`).
- `npm run build` / `npm run check-min`: `atvImg-min.js` is now a reproducible
  terser build, and CI fails if the committed artifact drifts from the source.
- CI: least-privilege `permissions`, in-flight run cancellation,
  `npm audit --audit-level=high`, and `fail-fast: false` on the Node matrix.
- `.github/dependabot.yml` for npm and GitHub Actions updates.
- `LICENSE` (MIT), `SECURITY.md` with a threat model, `CONTRIBUTING.md`,
  `CHANGELOG.md`, and a documented architecture and API section in the README.

### Removed

- `.eslintrc.json`, which ESLint 9 ignores in favour of `eslint.config.js`. It
  was dead configuration that only misled contributors.

### Fixed (packaging)

- `package.json` declared MIT but the repository shipped no `LICENSE` file.
- `repository`, `bugs` and `homepage` pointed at the upstream `drewwilson`
  repository rather than this one.

## [1.2.0] - 2015-12-09

- Original upstream release.

[Unreleased]: https://github.com/PreCogSecurity/atvImg/compare/v1.3.0...HEAD
[1.3.0]: https://github.com/PreCogSecurity/atvImg/compare/v1.2.0...v1.3.0
[1.2.0]: https://github.com/drewwilson/atvImg/releases/tag/v1.2.0
