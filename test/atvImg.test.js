/**
 * @jest-environment jsdom
 */

/* global atvImg */

const fs = require('fs');
const path = require('path');

// Load the source directly as a string and evaluate in the jsdom context
const source = fs.readFileSync(path.join(__dirname, '..', 'atvImg.js'), 'utf8');

beforeEach(() => {
  document.body.innerHTML = '';
  // Evaluate atvImg function into the global scope.
  // Indirect eval runs in the global scope, making atvImg() available
  // to the test cases below.
  // eslint-disable-next-line no-eval
  (0, eval)(source);
});

afterEach(() => {
  document.body.innerHTML = '';
});

function createAtvImgContainer(layers) {
  const container = document.createElement('div');
  container.className = 'atvImg';
  container.style.width = '320px';
  container.style.height = '190px';

  const img = document.createElement('img');
  img.src = '/images/flattened-icon.jpg';
  container.appendChild(img);

  layers.forEach(function (src) {
    const layer = document.createElement('div');
    layer.className = 'atvImg-layer';
    layer.setAttribute('data-img', src);
    container.appendChild(layer);
  });

  return container;
}

describe('atvImg', function () {
  test('does nothing when no .atvImg elements exist', function () {
    document.body.innerHTML = '<div id="other">not an atvImg</div>';
    atvImg();
    // No atvImg-container should have been created
    expect(document.querySelector('.atvImg-container')).toBeNull();
  });

  test('creates container, shine, shadow, and layers DOM structure', function () {
    const el = createAtvImgContainer([
      '/images/back.png',
      '/images/front.png'
    ]);
    document.body.appendChild(el);

    atvImg();

    // Container should have atvImg-container child
    const container = el.querySelector('.atvImg-container');
    expect(container).not.toBeNull();

    // Should have shine element
    const shine = container.querySelector('.atvImg-shine');
    expect(shine).not.toBeNull();
    expect(shine.className).toBe('atvImg-shine');

    // Should have shadow element
    const shadow = container.querySelector('.atvImg-shadow');
    expect(shadow).not.toBeNull();
    expect(shadow.className).toBe('atvImg-shadow');

    // Should have layers container
    const layersContainer = container.querySelector('.atvImg-layers');
    expect(layersContainer).not.toBeNull();
    expect(layersContainer.className).toBe('atvImg-layers');

    // Should have rendered layers matching input layers
    const renderedLayers = layersContainer.querySelectorAll('.atvImg-rendered-layer');
    expect(renderedLayers.length).toBe(2);
  });

  test('sets background-image from data-img attribute on each layer', function () {
    const el = createAtvImgContainer(['/images/back.png']);
    document.body.appendChild(el);

    atvImg();

    const renderedLayer = document.querySelector('.atvImg-rendered-layer');
    expect(renderedLayer).not.toBeNull();
    expect(renderedLayer.style.backgroundImage).toContain('/images/back.png');
  });

  test('assigns an id to the atvImg element', function () {
    const el = createAtvImgContainer(['/images/layer.png']);
    document.body.appendChild(el);

    atvImg();

    expect(el.id).toBe('atvImg__0');
  });

  test('sets perspective transform on the atvImg element', function () {
    const el = createAtvImgContainer(['/images/layer.png']);
    document.body.appendChild(el);

    atvImg();

    expect(el.style.transform).toMatch(/perspective/);
  });

  test('removes original child nodes before building structure', function () {
    const el = createAtvImgContainer(['/images/layer.png']);
    document.body.appendChild(el);

    atvImg();

    // Original <img> and .atvImg-layer elements should be gone,
    // replaced by the atvImg-container structure
    expect(el.querySelector('img')).toBeNull();
    expect(el.querySelector('.atvImg-layer')).toBeNull();
  });

  test('sets data-layer attribute on each rendered layer', function () {
    const el = createAtvImgContainer([
      '/images/a.png',
      '/images/b.png',
      '/images/c.png'
    ]);
    document.body.appendChild(el);

    atvImg();

    const layers = document.querySelectorAll('.atvImg-rendered-layer');
    expect(layers.length).toBe(3);
    expect(layers[0].getAttribute('data-layer')).toBe('0');
    expect(layers[1].getAttribute('data-layer')).toBe('1');
    expect(layers[2].getAttribute('data-layer')).toBe('2');
  });

  test('skips elements that have .atvImg class but no .atvImg-layer children', function () {
    const el = document.createElement('div');
    el.className = 'atvImg';
    document.body.appendChild(el);

    atvImg();

    // The element should still exist but without a container (nothing to process)
    expect(el.querySelector('.atvImg-container')).toBeNull();
  });

  test('adds "over" class to container on mouseenter', function () {
    const el = createAtvImgContainer(['/images/layer.png']);
    document.body.appendChild(el);
    // Give it dimensions so getBoundingClientRect works
    el.getBoundingClientRect = jest.fn(function () {
      return { top: 0, left: 0, width: 320, height: 190, bottom: 190, right: 320 };
    });
    Object.defineProperty(el, 'clientWidth', { value: 320 });
    Object.defineProperty(el, 'clientHeight', { value: 190 });

    atvImg();

    const container = el.querySelector('.atvImg-container');

    // Simulate mouseenter
    el.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));

    expect(container.className).toContain('over');
  });

  test('removes "over" class on mouseleave', function () {
    const el = createAtvImgContainer(['/images/layer.png']);
    document.body.appendChild(el);
    el.getBoundingClientRect = jest.fn(function () {
      return { top: 0, left: 0, width: 320, height: 190, bottom: 190, right: 320 };
    });
    Object.defineProperty(el, 'clientWidth', { value: 320 });
    Object.defineProperty(el, 'clientHeight', { value: 190 });

    atvImg();

    const container = el.querySelector('.atvImg-container');

    // mouseenter first
    el.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
    expect(container.className).toContain('over');

    // mouseleave
    el.dispatchEvent(new MouseEvent('mouseleave', { bubbles: true }));
    expect(container.className).not.toContain('over');
  });

  test('updates container transform on mousemove', function () {
    const el = createAtvImgContainer(['/images/layer.png']);
    document.body.appendChild(el);
    el.getBoundingClientRect = jest.fn(function () {
      return { top: 0, left: 0, width: 320, height: 190, bottom: 190, right: 320 };
    });
    Object.defineProperty(el, 'clientWidth', { value: 320 });
    Object.defineProperty(el, 'clientHeight', { value: 190 });

    atvImg();

    const container = el.querySelector('.atvImg-container');

    // Simulate mousemove over the element
    el.dispatchEvent(new MouseEvent('mousemove', {
      bubbles: true,
      clientX: 160,
      clientY: 95
    }));

    // Container's first child (the container div itself) should have a transform applied
    const firstChild = container;
    expect(firstChild.style.transform).toContain('rotateX');
    expect(firstChild.style.transform).toContain('rotateY');
  });

  test('processes multiple atvImg elements independently', function () {
    const el1 = createAtvImgContainer(['/images/a.png']);
    const el2 = createAtvImgContainer(['/images/b.png']);
    document.body.appendChild(el1);
    document.body.appendChild(el2);

    atvImg();

    expect(el1.id).toBe('atvImg__0');
    expect(el2.id).toBe('atvImg__1');

    const container1 = el1.querySelector('.atvImg-container');
    const container2 = el2.querySelector('.atvImg-container');
    expect(container1).not.toBeNull();
    expect(container2).not.toBeNull();

    const layer1 = el1.querySelector('.atvImg-rendered-layer');
    const layer2 = el2.querySelector('.atvImg-rendered-layer');
    expect(layer1.style.backgroundImage).toContain('/images/a.png');
    expect(layer2.style.backgroundImage).toContain('/images/b.png');
  });
});
