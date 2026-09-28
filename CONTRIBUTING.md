# Contributing to atvImg

Thanks for helping. This is a small, dependency-free plug-in, and the bar for
a change is that it stays that way.

## Getting set up

Node 18 or newer is required (see `.nvmrc` and the `engines` field in
`package.json`).

```sh
nvm use          # optional, reads .nvmrc
npm ci           # reproducible install from package-lock.json
```

There is no build step to *use* the plug-in — `atvImg.js` is loaded directly by
a `<script>` tag. The build step only regenerates the minified artifact.

## Everyday commands

| Command             | What it does                                                        |
| ------------------- | ------------------------------------------------------------------- |
| `npm test`          | Jest + jsdom, with the coverage gate enforced                        |
| `npm run coverage`  | Same, with the full text/HTML report                                 |
| `npm run lint`      | ESLint over the whole repository                                     |
| `npm run lint:fix`  | ESLint with autofix                                                  |
| `npm run build`     | Regenerate `atvImg-min.js` from `atvImg.js` with terser             |
| `npm run check-min` | Build, then fail if `atvImg-min.js` no longer matches the source    |
| `npm run verify`    | Lint + test + minified-artifact check, i.e. what CI runs             |

`npm run verify` is the same set of checks CI runs. Run it before you push.

## Ground rules

**`atvImg.js` must stay ES5 and dependency-free.** It is copied into other
people's pages, often from a CDN, with no build step on their side. That is the
entire value proposition of the library. `eslint.config.js` pins this file to
`ecmaVersion: 5`, so a `const` or an arrow function in it is a lint error rather
than a subtle breakage in an old browser. Do not add a runtime dependency for
any reason short of an earthquake.

**`atvImg-min.js` is generated output.** Never edit it by hand and never commit
a change to it without the matching change to `atvImg.js`. Regenerate it with
`npm run build`. CI fails if the committed artifact differs from a fresh build,
and `test/atvImg.test.js` also asserts that the minified build produces the same
DOM and the same input validation as the source.

**Coverage is a gate, not a report.** `coverageThreshold` in `package.json`
fails the build. New code needs new tests.

## Style

- Tabs for indentation in `atvImg.js`, two spaces in tests and config. Match
  whatever you are editing.
- Prefer the existing naming: DOM classes are `atvImg-*`, module-level helpers
  are `atvImg*`.
- Comments explain *why*, especially for the security checks in
  `isSafeImageUrl` and the fallback paths. Do not narrate what the code does.

## Changing the security behaviour

`data-img` validation is the security boundary of this plug-in. If you change
`atvImgIsSafeImageUrl`:

1. update the tests in the `isSafeImageUrl` describe block to cover the new
   accept/reject behaviour,
2. update the **Security Policy** threat model in `SECURITY.md`,
3. add a `CHANGELOG.md` entry under `Unreleased`,
4. treat it as a breaking change if you reject anything v1.3 accepted.

## Commit and PR conventions

One focused change per PR, with its tests in the same commit. A PR that mixes a
refactor, a feature and formatting is hard to review and hard to revert. CI
(lint, tests, coverage, `npm audit`, artifact sync) must be green before merge.

## Reporting a security issue

Do not open a public issue. See [SECURITY.md](SECURITY.md).
