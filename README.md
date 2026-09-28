# atvImg

`atvImg` = 'AppleTV Image'

Made by http://drewwilson.com

---

This lightweight plug-in (~2 kB gzipped) will automatically turn your layered
Apple TV PNGs into 3D parallax icons, the same way the new Apple TV treats app
icons. You can have any number of AppleTV Images on your web page.

No dependencies, zero build step — this plugin is just plain ol' vanilla
javascript, ES5, loadable straight from a `<script>` tag. Works on all major
browsers. It even supports touch and mobile.

<img src="http://d.pr/i/12IWV+" alt="atcImg example" width="246" height="240">
 
A live example of this plug-in can bee seen here: http://kloc.pm

Here is a video explaining how it works: http://d.pr/v/18YXv

Here is a video showing off the touch/mobile support: http://d.pr/v/1k2Ju
 
-------------------
 
## Usage

Here is how to setup the HTML for a single `atvImg`:

```html
<div class="atvImg">
   <img src="/images/flattened-icon.jpg">
   
   <div class="atvImg-layer" data-img="/images/back.png"></div>
   <div class="atvImg-layer" data-img="/images/front.png"></div>
</div>
```

You can have any number of `'.atvImg-layer'` elements. So add as many as your
icon needs. Be sure to use 2x (retina) scale PNGs. The plug-in will downscale
for 1x screens. Using 2x scale PNGs is recommended so the icon will appear crisp
on 2x screens.

Layer images should be 2x the size you want to display the icon as. The
plug-in will adapt the `atvImg` to be whatever size it's parent element is. So
if you set your `'.atvImg'` element to be 320px X 190px, that is how big the icon
will appear. If you set it to be 640px X 380px, that is how big it will appear.
Just be sure to use the correct aspect ratio for AppleTV icons.

The `<img>` element in the example above is a fallback in case javascript is not
allowed to run. It will be removed when the plug-in is running. Put a flattened
version (no layers) of you icon in there.

Then load the script and call the function in your `<script>` tag or JS file:

```html
<script src="/js/atvImg-min.js"></script>
<script>
  atvImg();
</script>
```

Just be sure you add that call after you've loaded the DOM. So put it below all
your page's HTML just before the closing `</body>` tag or in a
`document.ready()` function.

You also need the stylesheet, which positions the generated elements:

```html
<link rel="stylesheet" href="/css/atvImg.css">
```

Running `atvImg()` a second time is safe. Already-processed icons are left
alone rather than being rebuilt or given duplicate event listeners.

-------------------

## API

### `atvImg()`

The only entry point. It takes no arguments and returns nothing. It scans the
document for every `.atvImg` element, builds the parallax DOM for each one that
has at least one usable `.atvImg-layer`, and wires up pointer handling.

Call it once per set of icons. It is safe to call again after injecting new
markup.

### `require('atvimg').isSafeImageUrl(value)`

Returns `true` when `value` is safe to use as a `data-img` (see
[Security](#security) below). Exposed so callers that assemble `atvImg` markup
themselves can validate before rendering, and so the rule is unit testable.
Not needed in a browser, where the plug-in is a global function.

### Globals

Loading the script with a `<script>` tag defines `atvImg` plus a small number
of module-level helpers, all prefixed `atvImg` (`atvImgWarn`,
`atvImgIsSafeImageUrl`, `atvImgDescribe`, and the validation tables). The
prefixes exist to avoid colliding with the host page.

### Markup contract

| Selector / attribute | Meaning                                                        |
| -------------------- | -------------------------------------------------------------- |
| `.atvImg`            | The element to turn into an icon. Sized by your own CSS.         |
| `.atvImg-layer`      | One layer. `data-img` is its image; its order is its depth.      |
| `data-img`           | Image URL for that layer. Validated — see below.                 |
| `> img`              | Optional no-JavaScript fallback. Removed once the icon is built. |

Anything else in the `.atvImg` element is discarded when the icon is built, so
do not put content you need to keep inside it.

-------------------

## Architecture

`atvImg()` is a single pass over the document with three phases.

**1. Build.** For each `.atvImg` element it reads every `.atvImg-layer`, in
order, and replaces the element's children with a fixed structure:

```html
<div class="atvImg" id="atvImg__0" style="transform: perspective(960px)">
  <div class="atvImg-container">      <!-- rotated/scaled on pointer move -->
    <div class="atvImg-shadow"></div> <!-- z-below the layers; CSS box-shadow -->
    <div class="atvImg-layers">       <!-- preserve-3d, overflow: hidden      -->
      <div class="atvImg-rendered-layer" data-layer="0" style="background-image: url('...')"></div>
      <div class="atvImg-rendered-layer" data-layer="1" style="background-image: url('...')"></div>
    </div>
    <div class="atvImg-shine"></div>  <!-- z-above; gradient follows the pointer -->
  </div>
</div>
```

The outer `.atvImg` gets a `perspective()` sized to three times its width, which
is what gives the container its depth. The number of rendered layers — not the
number of `.atvImg-layer` elements found — is what drives the parallax maths, so
rejected layers cannot skew it.

**2. Bind.** Each icon gets one set of listeners, chosen once per call by
capability detection:

- If `(hover: hover) and (pointer: fine)` matches, the mouse handlers are bound
  — even on devices that also report touch support. Hybrid hardware (touch
  laptops, browser device emulation) reports both, and choosing touch there
  would disable hover entirely.
- Otherwise, if `ontouchstart` or `maxTouchPoints` indicates touch, the touch
  handlers are bound and scroll is locked for the duration of the gesture.
- Otherwise, the mouse handlers are bound.

**3. Animate.** `mousemove`/`touchmove` write a `rotateX`/`rotateY` transform to
the container, a moving gradient to the shine, and an offset to each layer in
reverse order to produce the parallax. These writes are coalesced through
`requestAnimationFrame`: pointer events arrive far faster than the display
refreshes, and each one otherwise forces a synchronous layout
(`getBoundingClientRect`) plus a style write per layer. Only the newest
coordinates in a frame are applied. Where `requestAnimationFrame` is
unavailable, updates are applied synchronously instead of being dropped.

`processMovement` bails out for elements that measure `0x0` (hidden, or not yet
laid out) and for events without finite coordinates, because either case
produces `rotateX(NaNdeg)`, which browsers discard — leaving the icon frozen
with no explanation.

Source layout, in order: the module-level validation helpers
(`atvImgIsSafeImageUrl`, `atvImgDescribe`, `atvImgWarn`), then the build loop,
then the three nested functions `detectTouch`, `bindEvents` and
`scheduleMove`/`flushMove`/`processMovement`.

Files:

| File             | Role                                                        |
| ---------------- | ----------------------------------------------------------- |
| `atvImg.js`      | The entire plug-in. ES5, no dependencies.                    |
| `atvImg-min.js`  | Generated by `npm run build`. Do not edit by hand.            |
| `atvImg.css`     | Positioning for the generated structure. Required.            |
| `test/`          | Jest + jsdom suite.                                          |
| `eslint.config.js` | Pins `atvImg.js` to ES5; allows modern syntax in tests.     |

-------------------

## Security

A `data-img` value is markup: on a real site it comes from a template, a CMS
field, or JSON produced elsewhere in the application. **Treat it as untrusted.**

Before a layer is allowed anywhere near CSSOM, its `data-img` must be a
non-empty string, contain no C0 control characters, and resolve to one of:

- a relative path (`/img/a.png`, `img/a.png`, `../a.png`), or
- a protocol-relative URL (`//cdn.example.com/a.png`), or
- an `http:` or `https:` URL, or
- a `data:` URL whose media type is an image

Everything else — `javascript:`, `vbscript:`, `blob:`, `file:`,
`data:text/html` — is rejected. Control characters are rejected rather than
stripped because browsers strip them, which is how `java<TAB>script:alert(1)`
slips past a naive check.

A rejected layer is skipped and reported:

```
[atvImg] skipping layer 1 of atvImg__0: unsafe or missing data-img "javascript:alert(1)"
```

Values are truncated at 120 characters and stripped of control characters before
logging, so a crafted attribute cannot flood or forge log lines. If *every*
layer of an icon is rejected, the element is left completely untouched so its
`<img>` fallback keeps rendering.

Note that the plug-in trusts the page it runs in: if an attacker can already
inject script into your page, this library is not the control that stops them.
Serve your images over HTTPS — plain `http:` sources are allowed for
compatibility but will be blocked as mixed content.

See [SECURITY.md](SECURITY.md) for the full threat model and how to report a
vulnerability.

-------------------

## Development

Requires Node 18+ (`.nvmrc`, `engines`).

```sh
npm ci            # reproducible install from the committed lockfile
npm test          # jest + jsdom, with the coverage gate enforced
npm run lint      # eslint over the whole repository
npm run build     # regenerate atvImg-min.js
npm run verify    # everything CI runs
```

`atvImg.js` must stay ES5 and dependency-free: it is loaded directly by other
people's pages, usually from a CDN, with no build step on their side. ESLint
enforces that. `atvImg-min.js` is generated; CI fails if it drifts from
`atvImg.js`, and the test suite asserts the minified build behaves identically
to the source.

Contributing guidelines are in [CONTRIBUTING.md](CONTRIBUTING.md); notable
changes are in [CHANGELOG.md](CHANGELOG.md).

-------------------

## License

`atvImg` is released under the **MIT license** — see [LICENSE](LICENSE).
Copyright (c) 2015 Drew Wilson.

The original plug-in was offered as dual MIT/GPL; this distribution is MIT,
which is the more permissive of the two and compatible with either.

I used http://designmodo.com/apple-tv-effect as reference and
inspiration when creating this plug-in.
