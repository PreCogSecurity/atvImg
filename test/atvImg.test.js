/**
 * @jest-environment jsdom
 */

const atvImg = require('../atvImg.js');

describe('atvImg plugin', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  test('should do nothing if no .atvImg elements exist', () => {
    expect(() => atvImg()).not.toThrow();
  });

  test('should skip .atvImg elements with no .atvImg-layer children', () => {
    document.body.innerHTML = `
      <div class="atvImg" id="empty-img">
        <p>No layers here</p>
      </div>
    `;

    atvImg();

    const imgElem = document.getElementById('empty-img');
    expect(imgElem.querySelector('.atvImg-container')).toBeNull();
    expect(imgElem.querySelector('p')).not.toBeNull();
  });

  test('should build 3D parallax DOM structure for valid atvImg elements', () => {
    document.body.innerHTML = `
      <div class="atvImg">
        <img src="/images/fallback.png" class="fallback" />
        <div class="atvImg-layer" data-img="/images/layer1.png"></div>
        <div class="atvImg-layer" data-img="/images/layer2.png"></div>
      </div>
    `;

    atvImg();

    const imgElem = document.querySelector('.atvImg');
    expect(imgElem).not.toBeNull();
    expect(imgElem.id).toBe('atvImg__0');

    // Fallback image should be removed
    expect(imgElem.querySelector('.fallback')).toBeNull();

    // Container structure
    const container = imgElem.querySelector('.atvImg-container');
    expect(container).not.toBeNull();

    const shadow = container.querySelector('.atvImg-shadow');
    expect(shadow).not.toBeNull();

    const layersWrapper = container.querySelector('.atvImg-layers');
    expect(layersWrapper).not.toBeNull();

    const shine = container.querySelector('.atvImg-shine');
    expect(shine).not.toBeNull();

    // Rendered layers
    const renderedLayers = layersWrapper.querySelectorAll('.atvImg-rendered-layer');
    expect(renderedLayers.length).toBe(2);

    expect(renderedLayers[0].getAttribute('data-layer')).toBe('0');
    expect(renderedLayers[0].style.backgroundImage).toContain('/images/layer1.png');

    expect(renderedLayers[1].getAttribute('data-layer')).toBe('1');
    expect(renderedLayers[1].style.backgroundImage).toContain('/images/layer2.png');
  });

  test('should preserve existing ID if set on .atvImg element', () => {
    document.body.innerHTML = `
      <div class="atvImg" id="custom-id">
        <div class="atvImg-layer" data-img="/images/layer1.png"></div>
      </div>
    `;

    atvImg();

    const imgElem = document.querySelector('.atvImg');
    expect(imgElem.id).toBe('custom-id');
  });

  test('should handle mouse events (mouseenter, mousemove, mouseleave)', () => {
    document.body.innerHTML = `
      <div class="atvImg" style="width: 320px; height: 200px;">
        <div class="atvImg-layer" data-img="/images/layer1.png"></div>
        <div class="atvImg-layer" data-img="/images/layer2.png"></div>
      </div>
    `;

    atvImg();

    const imgElem = document.querySelector('.atvImg');
    const container = imgElem.querySelector('.atvImg-container');
    const shine = imgElem.querySelector('.atvImg-shine');
    const layers = imgElem.querySelectorAll('.atvImg-rendered-layer');

    // Mock dimensions
    Object.defineProperty(imgElem, 'clientWidth', { value: 320, configurable: true });
    Object.defineProperty(imgElem, 'clientHeight', { value: 200, configurable: true });
    imgElem.getBoundingClientRect = () => ({
      left: 0,
      top: 0,
      right: 320,
      bottom: 200,
      width: 320,
      height: 200,
      x: 0,
      y: 0,
      toJSON: () => {}
    });

    // Mouse Enter
    const enterEvent = new MouseEvent('mouseenter');
    imgElem.dispatchEvent(enterEvent);
    expect(container.className).toContain('over');

    // Mouse Move
    const moveEvent = new MouseEvent('mousemove', {
      clientX: 100,
      clientY: 100,
      bubbles: true,
    });
    // Set pageX/pageY on event
    Object.defineProperty(moveEvent, 'pageX', { value: 100 });
    Object.defineProperty(moveEvent, 'pageY', { value: 100 });

    imgElem.dispatchEvent(moveEvent);

    expect(container.style.transform).toContain('rotateX');
    expect(container.style.transform).toContain('rotateY');
    expect(container.style.transform).toContain('scale3d');
    expect(shine.style.background).toContain('linear-gradient');
    expect(layers[0].style.transform).toContain('translateX');

    // Mouse Leave
    const leaveEvent = new MouseEvent('mouseleave');
    imgElem.dispatchEvent(leaveEvent);

    expect(container.className).not.toContain('over');
    expect(container.style.transform).toBe('');
    expect(shine.style.cssText).toBe('');
    expect(layers[0].style.transform).toBe('');
  });

  test('should handle touch events when ontouchstart is supported', () => {
    window.ontouchstart = () => {};

    document.body.innerHTML = `
      <div class="atvImg" style="width: 320px; height: 200px;">
        <div class="atvImg-layer" data-img="/images/layer1.png"></div>
      </div>
    `;

    atvImg();

    const imgElem = document.querySelector('.atvImg');
    const container = imgElem.querySelector('.atvImg-container');

    // Touch Start
    const touchStartEvent = new Event('touchstart');
    imgElem.dispatchEvent(touchStartEvent);
    expect(container.className).toContain('over');

    // Touch Move
    const touchMoveEvent = new Event('touchmove');
    touchMoveEvent.touches = [{ pageX: 100, pageY: 100 }];
    touchMoveEvent.preventDefault = jest.fn();

    imgElem.dispatchEvent(touchMoveEvent);
    expect(touchMoveEvent.preventDefault).toHaveBeenCalled();

    // Touch End
    const touchEndEvent = new Event('touchend');
    imgElem.dispatchEvent(touchEndEvent);
    expect(container.className).not.toContain('over');

    delete window.ontouchstart;
  });
});
