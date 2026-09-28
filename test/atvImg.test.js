/**
 * @jest-environment jsdom
 */

/* global afterEach, beforeEach, describe, expect, jest, test */

const atvImg = require('../atvImg.js');
const atvImgMin = require('../atvImg-min.js');
const isSafeImageUrl = atvImg.isSafeImageUrl;

let warnSpy;

// jsdom does not implement layout, so every element measures 0x0 unless the
// test supplies dimensions. Give one geometry helper instead of repeating the
// defineProperty dance in each case.
function withLayout(el, width, height) {
  Object.defineProperty(el, 'clientWidth', { value: width, configurable: true });
  Object.defineProperty(el, 'clientHeight', { value: height, configurable: true });
  el.getBoundingClientRect = function () {
    return { top: 0, left: 0, width: width, height: height, bottom: height, right: width };
  };
  return el;
}

function nextFrame() {
  return new Promise(function (resolve) {
    if (typeof window.requestAnimationFrame === 'function') {
      window.requestAnimationFrame(function () {
        resolve();
      });
    } else {
      setTimeout(resolve, 0);
    }
  });
}

function createAtvImgContainer(layers, opts) {
  const options = opts || {};
  const container = document.createElement('div');
  container.className = 'atvImg';

  const img = document.createElement('img');
  img.src = '/images/flattened-icon.jpg';
  container.appendChild(img);

  if (options.id) {
    container.id = options.id;
  }

  (layers || []).forEach(function (layer) {
    const el = document.createElement('div');
    el.className = 'atvImg-layer';
    if (layer !== null) {
      el.setAttribute('data-img', layer);
    }
    container.appendChild(el);
  });

  document.body.appendChild(container);
  return container;
}

// jsdom has no TouchEvent implementation; the plug-in only reads
// e.touches[0].pageX/pageY, so a plain Event with a touches array is enough.
function touchEvent(type, pageX, pageY, cancelable) {
  const e = new Event(type, { bubbles: true, cancelable: !!cancelable });
  e.touches = pageX === null ? [] : [{ pageX: pageX, pageY: pageY }];
  return e;
}

function forceFinePointer(matches) {
  window.matchMedia = function () {
    return { matches: matches, media: '', addListener: function () {}, removeListener: function () {} };
  };
}

beforeEach(() => {
  document.body.innerHTML = '';
  warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
  warnSpy.mockRestore();
  delete window.ontouchstart;
  document.body.innerHTML = '';
});

describe('isSafeImageUrl', () => {
  test('accepts relative and root-relative paths', () => {
    expect(isSafeImageUrl('/images/back.png')).toBe(true);
    expect(isSafeImageUrl('images/back.png')).toBe(true);
    expect(isSafeImageUrl('./back.png')).toBe(true);
    expect(isSafeImageUrl('../back.png')).toBe(true);
  });

  test('accepts http, https and protocol-relative URLs', () => {
    expect(isSafeImageUrl('http://example.com/a.png')).toBe(true);
    expect(isSafeImageUrl('https://example.com/a.png')).toBe(true);
    expect(isSafeImageUrl('//cdn.example.com/a.png')).toBe(true);
  });

  test('accepts data: URLs for image media types only', () => {
    expect(isSafeImageUrl('data:image/png;base64,iVBORw0KGgo=')).toBe(true);
    expect(isSafeImageUrl('data:image/jpeg;base64,/9j/4AAQ')).toBe(true);
    expect(isSafeImageUrl('data:image/svg+xml,%3Csvg%3E%3C/svg%3E')).toBe(true);
  });

  test('rejects script-bearing and non-web schemes', () => {
    expect(isSafeImageUrl('javascript:alert(1)')).toBe(false);
    expect(isSafeImageUrl('JaVaScRiPt:alert(1)')).toBe(false);
    expect(isSafeImageUrl('vbscript:msgbox(1)')).toBe(false);
    expect(isSafeImageUrl('blob:https://example.com/1234')).toBe(false);
    expect(isSafeImageUrl('file:///etc/passwd')).toBe(false);
  });

  test('rejects control-character smuggling such as "java\\tscript:"', () => {
    expect(isSafeImageUrl('java\tscript:alert(1)')).toBe(false);
    expect(isSafeImageUrl('java\nscript:alert(1)')).toBe(false);
    expect(isSafeImageUrl('java\rscript:alert(1)')).toBe(false);
    expect(isSafeImageUrl('java\u0000script:alert(1)')).toBe(false);
  });

  test('rejects non-image data: URLs', () => {
    expect(isSafeImageUrl('data:text/html,<script>alert(1)</script>')).toBe(false);
    expect(isSafeImageUrl('data:application/xhtml+xml,<html/>')).toBe(false);
    expect(isSafeImageUrl('data:image/png')).toBe(false); // no payload
  });

  test('rejects empty, whitespace-only and non-string values', () => {
    expect(isSafeImageUrl('')).toBe(false);
    expect(isSafeImageUrl('   ')).toBe(false);
    expect(isSafeImageUrl('\t\n')).toBe(false);
    expect(isSafeImageUrl(null)).toBe(false);
    expect(isSafeImageUrl(undefined)).toBe(false);
    expect(isSafeImageUrl(42)).toBe(false);
    expect(isSafeImageUrl({})).toBe(false);
  });
});

describe('atvImg', () => {
  test('does nothing when no .atvImg elements exist', () => {
    document.body.innerHTML = '<div id="other">not an atvImg</div>';
    atvImg();
    expect(document.querySelector('.atvImg-container')).toBeNull();
  });

  test('creates container, shine, shadow, and layers DOM structure', () => {
    const el = createAtvImgContainer(['/images/back.png', '/images/front.png']);

    atvImg();

    const container = el.querySelector('.atvImg-container');
    expect(container).not.toBeNull();

    const shine = container.querySelector('.atvImg-shine');
    expect(shine).not.toBeNull();
    expect(shine.className).toBe('atvImg-shine');

    const shadow = container.querySelector('.atvImg-shadow');
    expect(shadow).not.toBeNull();
    expect(shadow.className).toBe('atvImg-shadow');

    const layersContainer = container.querySelector('.atvImg-layers');
    expect(layersContainer).not.toBeNull();
    expect(layersContainer.className).toBe('atvImg-layers');

    const renderedLayers = layersContainer.querySelectorAll('.atvImg-rendered-layer');
    expect(renderedLayers.length).toBe(2);

    // z-order: shadow behind the layers, shine in front of them
    expect(container.children[0].className).toBe('atvImg-shadow');
    expect(container.children[1].className).toBe('atvImg-layers');
    expect(container.children[2].className).toBe('atvImg-shine');
  });

  test('sets background-image from data-img attribute on each layer', () => {
    createAtvImgContainer(['/images/back.png']);

    atvImg();

    const renderedLayer = document.querySelector('.atvImg-rendered-layer');
    expect(renderedLayer).not.toBeNull();
    expect(renderedLayer.style.backgroundImage).toContain('/images/back.png');
  });

  test('quotes the url() token so spaces and parens survive', () => {
    // jsdom's CSS parser silently drops any url() whose target contains a
    // space or a parenthesis, so asserting on the parsed value would only be
    // testing the environment. Intercept the property write instead and assert
    // on the exact declaration the plug-in produces, which is what a real
    // browser parses.
    const proto = window.CSSStyleDeclaration.prototype;
    const original = Object.getOwnPropertyDescriptor(proto, 'backgroundImage');
    const written = [];

    Object.defineProperty(proto, 'backgroundImage', {
      configurable: true,
      get: original.get,
      set: function (value) {
        written.push(value);
        original.set.call(this, value);
      }
    });

    try {
      createAtvImgContainer(['/images/my icon(1).png']);
      atvImg();
    } finally {
      Object.defineProperty(proto, 'backgroundImage', original);
    }

    expect(written).toContain('url("/images/my icon(1).png")');
  });

  test('assigns an id to the atvImg element when it has none', () => {
    const el = createAtvImgContainer(['/images/layer.png']);

    atvImg();

    expect(el.id).toBe('atvImg__0');
  });

  test('preserves an author-supplied id', () => {
    const el = createAtvImgContainer(['/images/layer.png'], { id: 'my-icon' });

    atvImg();

    expect(el.id).toBe('my-icon');
  });

  test('sets perspective transform on the atvImg element', () => {
    const el = withLayout(createAtvImgContainer(['/images/layer.png']), 320, 190);

    atvImg();

    expect(el.style.transform).toMatch(/perspective/);
  });

  test('removes original child nodes before building structure', () => {
    const el = createAtvImgContainer(['/images/layer.png']);

    atvImg();

    expect(el.querySelector('img')).toBeNull();
    expect(el.querySelector('.atvImg-layer')).toBeNull();
  });

  test('sets data-layer attribute on each rendered layer', () => {
    createAtvImgContainer(['/images/a.png', '/images/b.png', '/images/c.png']);

    atvImg();

    const layers = document.querySelectorAll('.atvImg-rendered-layer');
    expect(layers.length).toBe(3);
    expect(layers[0].getAttribute('data-layer')).toBe('0');
    expect(layers[1].getAttribute('data-layer')).toBe('1');
    expect(layers[2].getAttribute('data-layer')).toBe('2');
  });

  test('processes multiple atvImg elements independently', () => {
    const el1 = createAtvImgContainer(['/images/a.png']);
    const el2 = createAtvImgContainer(['/images/b.png']);

    atvImg();

    expect(el1.id).toBe('atvImg__0');
    expect(el2.id).toBe('atvImg__1');

    const layer1 = el1.querySelector('.atvImg-rendered-layer');
    const layer2 = el2.querySelector('.atvImg-rendered-layer');
    expect(layer1.style.backgroundImage).toContain('/images/a.png');
    expect(layer2.style.backgroundImage).toContain('/images/b.png');
  });

  test('is idempotent: a second call does not rebuild or duplicate listeners', () => {
    const el = withLayout(createAtvImgContainer(['/images/layer.png']), 320, 190);

    atvImg();
    const htmlAfterFirstPass = el.innerHTML;
    atvImg();

    expect(el.innerHTML).toBe(htmlAfterFirstPass);
    expect(el.querySelectorAll('.atvImg-container').length).toBe(1);
    expect(el.querySelectorAll('.atvImg-rendered-layer').length).toBe(1);
  });
});

describe('atvImg input validation', () => {
  test('skips elements that have .atvImg class but no .atvImg-layer children', () => {
    const el = document.createElement('div');
    el.className = 'atvImg';
    document.body.appendChild(el);

    atvImg();

    expect(el.querySelector('.atvImg-container')).toBeNull();
  });

  test('renders only the safe layers and renumbers the rest', () => {
    const el = createAtvImgContainer([
      '/images/a.png',
      'javascript:alert(1)',
      '/images/c.png'
    ]);

    atvImg();

    const layers = el.querySelectorAll('.atvImg-rendered-layer');
    expect(layers.length).toBe(2);
    expect(layers[0].getAttribute('data-layer')).toBe('0');
    expect(layers[1].getAttribute('data-layer')).toBe('1');
    expect(layers[0].style.backgroundImage).toContain('/images/a.png');
    expect(layers[1].style.backgroundImage).toContain('/images/c.png');
    expect(el.innerHTML).not.toContain('javascript:');
    expect(warnSpy).toHaveBeenCalled();
  });

  test('skips a layer whose data-img attribute is missing entirely', () => {
    const el = createAtvImgContainer(['/images/a.png', null]);

    expect(() => atvImg()).not.toThrow();

    expect(el.querySelectorAll('.atvImg-rendered-layer').length).toBe(1);
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('unsafe or missing data-img "(missing)"')
    );
  });

  test('leaves the element and its <img> fallback intact when every layer is unsafe', () => {
    const el = createAtvImgContainer(['javascript:alert(1)', 'data:text/html,<script></script>']);

    atvImg();

    // The no-JavaScript fallback must survive: this is the whole point of
    // validating before mutating the DOM.
    expect(el.querySelector('img')).not.toBeNull();
    expect(el.querySelector('.atvImg-container')).toBeNull();
    expect(el.querySelectorAll('.atvImg-layer').length).toBe(2);
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('no usable layers')
    );
  });

  test('truncates and sanitizes untrusted values echoed into warnings', () => {
    const hostile = 'x'.repeat(400) + '\nFORGED LOG LINE';
    createAtvImgContainer([hostile]);

    atvImg();

    const message = warnSpy.mock.calls[0][0];
    expect(message).toContain('[atvImg]');
    expect(message).toContain('...');
    expect(message).not.toContain('\n');
    expect(message.length).toBeLessThan(200);
  });
});

describe('atvImg mouse interaction', () => {
  test('adds "over" class to container on mouseenter', () => {
    const el = withLayout(createAtvImgContainer(['/images/layer.png']), 320, 190);

    atvImg();
    const container = el.querySelector('.atvImg-container');

    el.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));

    expect(container.className).toContain('over');
  });

  test('removes "over" class and clears transforms on mouseleave', async () => {
    const el = withLayout(createAtvImgContainer(['/images/layer.png']), 320, 190);

    atvImg();
    const container = el.querySelector('.atvImg-container');
    const shine = el.querySelector('.atvImg-shine');

    el.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
    expect(container.className).toContain('over');

    el.dispatchEvent(new MouseEvent('mousemove', { bubbles: true, clientX: 100, clientY: 50 }));
    await nextFrame();
    expect(container.style.transform).not.toBe('');

    el.dispatchEvent(new MouseEvent('mouseleave', { bubbles: true }));

    expect(container.className).not.toContain('over');
    expect(container.style.transform).toBe('');
    expect(shine.style.cssText).toBe('');
    expect(el.querySelector('.atvImg-rendered-layer').style.transform).toBe('');
  });

  test('updates container transform on mousemove', async () => {
    const el = withLayout(createAtvImgContainer(['/images/layer.png']), 320, 190);

    atvImg();
    const container = el.querySelector('.atvImg-container');

    el.dispatchEvent(new MouseEvent('mousemove', { bubbles: true, clientX: 160, clientY: 95 }));
    await nextFrame();

    expect(container.style.transform).toContain('rotateX');
    expect(container.style.transform).toContain('rotateY');
  });

  test('scales the container while hovered', async () => {
    const el = withLayout(createAtvImgContainer(['/images/layer.png']), 320, 190);

    atvImg();
    const container = el.querySelector('.atvImg-container');

    el.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
    el.dispatchEvent(new MouseEvent('mousemove', { bubbles: true, clientX: 160, clientY: 95 }));
    await nextFrame();

    expect(container.style.transform).toContain('scale3d');
  });

  test('coalesces a burst of mousemove events into a single frame', async () => {
    const burst = withLayout(createAtvImgContainer(['/images/layer.png']), 320, 190);
    const control = withLayout(createAtvImgContainer(['/images/layer.png']), 320, 190);

    atvImg();

    const burstContainer = burst.querySelector('.atvImg-container');
    const controlContainer = control.querySelector('.atvImg-container');

    for (let i = 0; i < 25; i++) {
      burst.dispatchEvent(
        new MouseEvent('mousemove', { bubbles: true, clientX: 10 + i, clientY: 20 })
      );
    }
    await nextFrame();

    // The control gets exactly one event at the final coordinates of the burst.
    control.dispatchEvent(
      new MouseEvent('mousemove', { bubbles: true, clientX: 34, clientY: 20 })
    );
    await nextFrame();

    // Only the newest coordinates survive, so a 25-event burst must produce
    // exactly what a single event at the last position produces.
    expect(burstContainer.style.transform).not.toContain('NaN');
    expect(burstContainer.style.transform).toBe(controlContainer.style.transform);
  });

  test('applies movement synchronously when requestAnimationFrame is unavailable', () => {
    const el = withLayout(createAtvImgContainer(['/images/layer.png']), 320, 190);
    const originalRaf = window.requestAnimationFrame;
    window.requestAnimationFrame = undefined;

    try {
      atvImg();
      const container = el.querySelector('.atvImg-container');
      el.dispatchEvent(new MouseEvent('mousemove', { bubbles: true, clientX: 160, clientY: 95 }));

      expect(container.style.transform).toContain('rotateX');
    } finally {
      window.requestAnimationFrame = originalRaf;
    }
  });

  test('writes no transform for a zero-size (hidden) element', async () => {
    // jsdom performs no layout, so clientWidth/clientHeight stay 0.
    const el = createAtvImgContainer(['/images/layer.png']);

    atvImg();
    const container = el.querySelector('.atvImg-container');

    el.dispatchEvent(new MouseEvent('mousemove', { bubbles: true, clientX: 160, clientY: 95 }));
    await nextFrame();

    // Pre-v1.3 this produced "rotateX(NaNdeg) rotateY(NaNdeg)".
    expect(container.style.transform).toBe('');
  });

  test('does not pollute window with a scroll-lock flag', () => {
    withLayout(createAtvImgContainer(['/images/layer.png']), 320, 190);

    atvImg();

    expect(window.preventScroll).toBeUndefined();
  });
});

describe('atvImg touch interaction', () => {
  beforeEach(() => {
    window.ontouchstart = null; // makes 'ontouchstart' in window true
    forceFinePointer(false);
  });

  test('responds to touchstart, touchmove and touchend', async () => {
    const el = withLayout(createAtvImgContainer(['/images/layer.png']), 320, 190);

    atvImg();
    const container = el.querySelector('.atvImg-container');

    el.dispatchEvent(touchEvent('touchstart', 160, 95));
    expect(container.className).toContain('over');

    el.dispatchEvent(touchEvent('touchmove', 160, 95, true));
    await nextFrame();
    expect(container.style.transform).toContain('rotateX');

    el.dispatchEvent(touchEvent('touchend', null));
    expect(container.className).not.toContain('over');
    expect(container.style.transform).toBe('');
  });

  test('does not bind mouse handlers on a touch-only device', () => {
    const el = withLayout(createAtvImgContainer(['/images/layer.png']), 320, 190);

    atvImg();
    const container = el.querySelector('.atvImg-container');

    el.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
    expect(container.className).not.toContain('over');
  });

  test('ignores a touchmove that carries no active touch', () => {
    const el = withLayout(createAtvImgContainer(['/images/layer.png']), 320, 190);

    atvImg();
    const container = el.querySelector('.atvImg-container');

    expect(() => el.dispatchEvent(touchEvent('touchmove', null))).not.toThrow();
    expect(container.style.transform).toBe('');
  });

  test('ignores a touch whose coordinates are not finite numbers', async () => {
    const el = withLayout(createAtvImgContainer(['/images/layer.png']), 320, 190);

    atvImg();
    const container = el.querySelector('.atvImg-container');

    // A real Touch has no clientX/clientY to fall back to.
    const e = new Event('touchmove', { bubbles: true, cancelable: true });
    e.touches = [{}];
    el.dispatchEvent(e);
    await nextFrame();

    expect(container.style.transform).toBe('');
  });

  test('falls back to the legacy touch test when matchMedia throws', () => {
    window.matchMedia = function () {
      throw new Error('unsupported query');
    };
    const el = withLayout(createAtvImgContainer(['/images/layer.png']), 320, 190);

    // A throw must not take the whole page down; touch support is still known.
    expect(() => atvImg()).not.toThrow();

    const container = el.querySelector('.atvImg-container');
    el.dispatchEvent(touchEvent('touchstart', 160, 95));
    expect(container.className).toContain('over');
  });

  test('uses maxTouchPoints when there is no ontouchstart property', () => {
    delete window.ontouchstart;
    forceFinePointer(false);
    Object.defineProperty(window.navigator, 'maxTouchPoints', {
      value: 5,
      configurable: true
    });

    const el = withLayout(createAtvImgContainer(['/images/layer.png']), 320, 190);
    atvImg();
    const container = el.querySelector('.atvImg-container');

    el.dispatchEvent(touchEvent('touchstart', 160, 95));
    expect(container.className).toContain('over');

    delete window.navigator.maxTouchPoints;
  });

  test('prefers the mouse on hybrid devices that also report a fine pointer', () => {
    forceFinePointer(true);
    const el = withLayout(createAtvImgContainer(['/images/layer.png']), 320, 190);

    atvImg();
    const container = el.querySelector('.atvImg-container');

    // Touch support is still advertised, but a real pointer exists.
    el.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
    expect(container.className).toContain('over');
  });
});

describe('atvImg-min.js', () => {
  test('the committed minified artifact produces the same DOM as the source', () => {
    const source = createAtvImgContainer(['/images/a.png', '/images/b.png', '/images/c.png']);
    atvImg();
    const expected = source.innerHTML;

    document.body.innerHTML = '';

    const minified = createAtvImgContainer(['/images/a.png', '/images/b.png', '/images/c.png']);
    atvImgMin();
    expect(minified.innerHTML).toBe(expected);
  });

  test('the committed minified artifact applies the same input validation', () => {
    const el = createAtvImgContainer(['javascript:alert(1)', '/images/a.png']);

    atvImgMin();

    expect(el.querySelectorAll('.atvImg-rendered-layer').length).toBe(1);
    expect(el.innerHTML).not.toContain('javascript:');
  });
});
