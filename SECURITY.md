# Security Policy

## Supported versions

| Version | Supported          |
| ------- | ------------------ |
| 1.3.x   | :white_check_mark: |
| < 1.3   | :x:                |

Only the latest minor release receives security fixes. `atvImg` has no runtime
dependencies, so there is no transitive package surface to patch for users of
the published artifact.

## Reporting a vulnerability

Please **do not open a public issue** for a security problem.

Report it privately through GitHub's security advisory form:

<https://github.com/PreCogSecurity/atvImg/security/advisories/new>

Include, at minimum:

- the version of `atvImg` (and whether the page loaded `atvImg.js` or
  `atvImg-min.js`),
- the markup you passed to the plug-in,
- a proof of concept,
- the impact you believe it has.

We aim to acknowledge a report within 3 business days and to ship a fix or a
mitigation within 14 days. We will credit you in the advisory unless you ask us
not to.

## Threat model

`atvImg` runs in the page of whoever embeds it. The security boundary that
matters is the `data-img` attribute: on a real site it comes from a template, a
CMS field, or JSON produced elsewhere in the application, and the plug-in
copies it into a CSS declaration. Treat every `data-img` value as untrusted.

What v1.3 does with it:

- rejects empty, whitespace-only, non-string and control-character values;
- allows only relative paths, protocol-relative URLs, `http:`, `https:`, and
  `data:` URLs whose media type is an image;
- never lets a value reach CSSOM unless it passed that check;
- leaves the author's markup, including the `<img>` no-JavaScript fallback,
  untouched when a layer is rejected.

Rejected values are reported on the console with an `[atvImg] ` prefix. Values
are truncated and stripped of control characters before logging so a crafted
attribute cannot flood or forge log lines.

Deliberately out of scope:

- **The plug-in trusts the page it runs in.** If an attacker can already inject
  script into your page, they can do anything; this library is not a
  Content-Security-Policy boundary and does not sanitise the surrounding markup.
- **`http:` image sources.** Plain-HTTP layers are allowed for compatibility.
  Serve icons over HTTPS to avoid mixed-content blocking and passive sniffing.
- **Server-side rendering / availability.** `atvImg` is a presentational
  effect; it performs no network calls of its own.
