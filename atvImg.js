/*
 * atvImg
 * Copyright 2015 Drew Wilson
 * http://drewwilson.com
 *
 * Version 1.3   -   Updated: Sep. 28, 2026
 *
 * atvImg = 'AppleTV Image'
 * 
 * This plug-in will automatically turn your layered Apple TV PNGs into
 * 3D parallax icons, the same way the new Apple TV treats app icons.
 * You can have any number of AppleTV Images on the page.
 *
 * An example of this plug-in can bee seen here: http://kloc.pm
 *
 * -------------------
 *
 * Here is how to setup the HTML for a single atvImg:
 * <div class="atvImg">
 * 		<img src="/images/flattened-icon.jpg">
 *
 *		<div class="atvImg-layer" data-img="/images/back.png"></div>
 *		<div class="atvImg-layer" data-img="/images/front.png"></div>
 * </div>
 * 
 * You can have any number of 'atvImg-layer' elements. So add as many
 * as your icon needs. Be sure to use 2x (retina) scale PNGs. The plug-in
 * will downscale for 1x screens. Using 2x scale PNGs is recommended
 * so the icon will appear crisp on 2x screens. 
 * Layer images should be 2x the size you want to display the icon as.
 * The plug-in will adapt the atvImg to be whatever size it's parent
 * element is. So if you set your '.atvImg' element to be 320px X 190px,
 * that is how big the icon will appear. If you set it to be 
 * 640px X 380px, that is how big it will appear. Just be sure to
 * use the correct aspect ratio for AppleTV icons.
 *
 * The <img> element in the example above is a fallback in case 
 * javascript is not allowed to run. It will be removed when the plug-in
 * is running. Put a flattened version (no layers) of you icon in there.
 * 
 * Then call the funciton in you <script> tag or JS file like this: 
 *
 * atvImg();
 *
 *
 * Just be sure you add that line after you've loaded the DOM. So put
 * it below all your page's HTML just before the closing </body> tag or
 * in a document.ready() function.
 *
 * -------------------
 *
 * SECURITY NOTES (v1.3)
 *
 * A 'data-img' value is markup: on any real site it comes from a template, a
 * CMS field, or JSON that another part of the application feeds to the page.
 * v1.2 passed that string straight into a CSS 'url()' value with no checks at
 * all, so a missing attribute produced 'url(null)' and an attacker-influenced
 * attribute could smuggle a script-bearing scheme into the stylesheet. v1.3
 * validates every layer before it reaches CSSOM:
 *
 *   - empty / whitespace-only / non-string values are rejected;
 *   - values containing C0 control characters are rejected (browsers strip
 *     them, so "java\tscript:" can otherwise slip past a naive check);
 *   - only 'http:', 'https:', protocol-relative and relative paths are
 *     accepted;
 *   - 'data:' URLs are accepted for raster/vector *images* only, since
 *     inlining a small layer as a data URI is a supported use case.
 *     'data:text/html' and friends are rejected.
 *
 * Rejected layers are reported on the console with a "[atvImg] " prefix and
 * are skipped. If *every* layer of an element is rejected, the element is left
 * completely untouched so its <img> no-JavaScript fallback keeps rendering.
 *
 * The scroll-lock flag used during touch tracking is per-call state, not a
 * property hung off the global 'window' object, so no other script on the page
 * can flip it.
 *
 * -------------------
 *
 * This atvImg plug-in is dual licensed under the MIT and GPL licenses:
 *   http://www.opensource.org/licenses/mit-license.php
 *   http://www.gnu.org/licenses/gpl.html
 *
 * I used http://designmodo.com/apple-tv-effect as reference and
 * inspiration when creating this plug-in.
 */

/* exported atvImg */

// ---------------------------------------------------------------------------
// Validation helpers
//
// These are module-level and pure so they can be reasoned about (and tested)
// independently of the DOM work.
// ---------------------------------------------------------------------------

// Every diagnostic this plug-in emits is prefixed so integrators can grep or
// silence atvImg warnings in a shared console.
var atvImgLogPrefix = '[atvImg] ';

// Longest value echoed into a warning before truncation. Untrusted markup must
// not be able to flood a log or forge log lines.
var atvImgMaxLogLength = 120;

// URL schemes accepted in a 'data-img' attribute. 'javascript:', 'vbscript:'
// and friends are deliberately absent: an attacker who controls a layer path
// should not be able to turn a stylesheet into a script sink.
var atvImgAllowedSchemes = ['http:', 'https:'];

// 'data:' URLs are allowed for images only, because embedding a small layer as
// a data URI is a documented use case. Note that a data: image loaded through
// CSS background-image is not a script context, so SVG is safe here; the
// dangerous 'data:text/html' and 'data:application/*' types are not.
var atvImgAllowedDataTypes = /^image\/(png|jpe?g|gif|webp|avif|bmp|x-icon|vnd\.microsoft\.icon|svg\+xml)$/;

// C0 controls and DEL. URL and CSS parsers drop these, so a value such as
// "java\tscript:alert(1)" can be interpreted differently by a validator and by
// the browser. Reject them outright rather than trying to normalise.
var atvImgControlChars = /[\u0000-\u001F\u007F]/;

/*
 * atvImgIsSafeImageUrl(value)
 *
 * Returns true when 'value' is safe to interpolate into a CSS 'url()'. This is
 * a strict allowlist: anything not explicitly recognised is rejected, which is
 * the correct default for a value that crosses a trust boundary.
 */
function atvImgIsSafeImageUrl(value){
	if (typeof value !== 'string') {
		return false;
	}

	// Trim without String.prototype.trim so very old engines still behave.
	var trimmed = value.replace(/^\s+|\s+$/g, '');

	if (trimmed === '' || atvImgControlChars.test(trimmed)) {
		return false;
	}

	var lower = trimmed.toLowerCase();

	if (lower.indexOf('data:') === 0){
		var commaAt = trimmed.indexOf(',');

		if (commaAt === -1){
			return false; // no payload, nothing to render
		}

		// Only the media type is meaningful to us; the payload is opaque image
		// data. Strip any ";base64" or charset parameter before matching.
		return atvImgAllowedDataTypes.test(lower.slice(5, commaAt).split(';')[0]);
	}

	if (lower.indexOf('//') === 0){
		return true; // protocol-relative: inherits the page's own scheme
	}

	// No scheme at all means a relative path, resolved against the document.
	if (!/^[a-z][a-z0-9+.-]*:/i.test(trimmed)){
		return true;
	}

	// Keep the trailing colon so the slice matches the allowlist entries.
	return atvImgAllowedSchemes.indexOf(lower.slice(0, trimmed.indexOf(':') + 1)) !== -1;
}

/*
 * atvImgDescribe(value)
 *
 * Renders an untrusted attribute value for inclusion in a console warning.
 * Control characters are replaced so a crafted value cannot forge extra log
 * lines, and the result is length-capped.
 */
function atvImgDescribe(value){
	if (value === null || typeof value === 'undefined'){
		return '(missing)';
	}

	var text = String(value).replace(/[\u0000-\u001F\u007F]/g, '?');

	return (text.length > atvImgMaxLogLength)
		? text.slice(0, atvImgMaxLogLength) + '...'
		: text;
}

function atvImgWarn(message){
	if (typeof console !== 'undefined' && console && typeof console.warn === 'function'){
		console.warn(atvImgLogPrefix + message);
	}
}

// ---------------------------------------------------------------------------
// Plug-in
// ---------------------------------------------------------------------------

function atvImg(){

	var d = document,
		// Fall back to <html> when called before <body> is parsed; the original
		// captured undefined here and threw on the first pointer event.
		bd = d.getElementsByTagName('body')[0] || d.documentElement,
		htm = d.getElementsByTagName('html')[0] || d.documentElement,
		win = window,
		imgs = d.querySelectorAll('.atvImg'),
		totalImgs = imgs.length,
		supportsTouch = detectTouch(),
		// Per-call state. In v1.2 this was 'window.preventScroll', a global any
		// script on the page could flip to defeat or hijack scroll locking.
		preventScroll = false,
		// requestAnimationFrame coalescing state. mousemove fires far faster
		// than the display refreshes; without this, every event forced a
		// synchronous layout (getBoundingClientRect) and then wrote styles for
		// the container, the shine and every layer.
		frame = {
			elem: null,
			container: null,
			layers: null,
			totalLayers: 0,
			shine: null,
			x: 0,
			y: 0
		},
		frameQueued = false;

	if(totalImgs <= 0){
		return;
	}

	// build HTML
	for(var l=0;l<totalImgs;l++){

		var thisImg = imgs[l],
			layerElems = thisImg.querySelectorAll('.atvImg-layer'),
			totalLayerElems = layerElems.length,
			imgSrcs = [],
			i,
			candidate;

		if(totalLayerElems <= 0){
			continue;
		}

		// Validate every layer BEFORE mutating the DOM. Doing it first means a
		// bad configuration cannot destroy the author's markup, and it lets the
		// parallax maths use the number of layers that actually rendered.
		for(i=0;i<totalLayerElems;i++){
			candidate = layerElems[i].getAttribute('data-img');

			if(atvImgIsSafeImageUrl(candidate)){
				imgSrcs.push(candidate);
			} else {
				atvImgWarn('skipping layer '+i+' of '+(thisImg.id||'.atvImg['+l+']')+': unsafe or missing data-img "'+atvImgDescribe(candidate)+'"');
			}
		}

		if(imgSrcs.length <= 0){
			// Nothing renderable. Leave the element (and its <img> fallback)
			// exactly as the author wrote it.
			atvImgWarn('no usable layers on '+(thisImg.id||'.atvImg['+l+']')+'; element left untouched');
			continue;
		}

		totalLayerElems = imgSrcs.length;

		while(thisImg.firstChild) {
			thisImg.removeChild(thisImg.firstChild);
		}
	
		var containerHTML = d.createElement('div'),
			shineHTML = d.createElement('div'),
			shadowHTML = d.createElement('div'),
			layersHTML = d.createElement('div'),
			layers = [];

		// Never clobber an author-supplied id: styles and analytics commonly
		// key off it.
		if(!thisImg.id){
			thisImg.id = 'atvImg__'+l;
		}
		containerHTML.className = 'atvImg-container';
		shineHTML.className = 'atvImg-shine';
		shadowHTML.className = 'atvImg-shadow';
		layersHTML.className = 'atvImg-layers';

		for(i=0;i<totalLayerElems;i++){
			var layer = d.createElement('div');

			layer.className = 'atvImg-rendered-layer';
			layer.setAttribute('data-layer',i);
			// Quote the URL: the value may legitimately contain spaces or
			// parentheses, which an unquoted url() token would truncate.
			layer.style.backgroundImage = 'url("'+imgSrcs[i]+'")';
			layersHTML.appendChild(layer);

			layers.push(layer);
		}

		containerHTML.appendChild(shadowHTML);
		containerHTML.appendChild(layersHTML);
		containerHTML.appendChild(shineHTML);
		thisImg.appendChild(containerHTML);

		var w = thisImg.clientWidth || thisImg.offsetWidth || thisImg.scrollWidth;
		thisImg.style.transform = 'perspective('+ w*3 +'px)';

		bindEvents(thisImg, containerHTML, layers, totalLayerElems, shineHTML);
	}

	/*
	 * detectTouch()
	 *
	 * Picks the input model for this page. A hybrid device (touch laptop,
	 * browser device emulation) reports both a fine pointer and touch support;
	 * choosing touch there disables hover entirely, so a real pointer wins.
	 */
	function detectTouch(){
		var nav = win.navigator,
			hasTouch = ('ontouchstart' in win) ||
				(!!nav && ((nav.maxTouchPoints || nav.msMaxTouchPoints || 0) > 0)),
			hasFinePointer = false;

		if(typeof win.matchMedia === 'function'){
			try {
				hasFinePointer = win.matchMedia('(hover: hover) and (pointer: fine)').matches === true;
			} catch (err) {
				hasFinePointer = false; // unknown -> treat as no fine pointer
			}
		}

		if(hasFinePointer){
			return false;
		}

		return hasTouch;
	}

	/*
	 * bindEvents()
	 *
	 * One place to wire input for both models. The container is captured by
	 * reference rather than re-derived from elem.firstChild, which threw if
	 * anything ever inserted a text node in front of it.
	 */
	function bindEvents(elem, container, layers, totalLayers, shine){

		function enter(){
			container.className += ' over';
		}

		function exit(){
			container.className = container.className.replace(' over','');
			container.style.transform = '';
			shine.style.cssText = '';

			for(var ly=0;ly<totalLayers;ly++){
				layers[ly].style.transform = '';
			}
		}

		function move(e){
			var point = e,
				x,
				y;

			if(supportsTouch){
				point = e.touches && e.touches.length ? e.touches[0] : null;
			}

			// A touchmove with no active touch (edge-swipe, cancelled gesture)
			// carries no coordinates; ignoring it beats a NaN transform.
			if(!point){
				return;
			}

			x = point.pageX;
			y = point.pageY;

			// pageX/pageY are absent on some synthetic and legacy events. This
			// plug-in already compensates for page scroll, so clientX/clientY
			// is an exact substitute rather than a new offset.
			if(typeof x !== 'number' || !isFinite(x)){
				x = point.clientX;
			}
			if(typeof y !== 'number' || !isFinite(y)){
				y = point.clientY;
			}

			scheduleMove(x, y, elem, container, layers, totalLayers, shine);
		}

		if(supportsTouch){
			elem.addEventListener('touchstart', function(){
				preventScroll = true;
				enter();
			}, false);

			elem.addEventListener('touchmove', function(e){
				// preventDefault() on a non-cancelable event is a console error
				// in Chromium and a no-op elsewhere.
				if(preventScroll && e.cancelable){
					e.preventDefault();
				}
				move(e);
			}, false);

			elem.addEventListener('touchend', function(){
				preventScroll = false;
				exit();
			}, false);

			return;
		}

		elem.addEventListener('mousemove', move, false);
		elem.addEventListener('mouseenter', enter, false);
		elem.addEventListener('mouseleave', exit, false);
	}

	/*
	 * scheduleMove()
	 *
	 * Coalesce pointer movement into at most one style write per animation
	 * frame, per atvImg() call. Only the newest coordinates survive, which is
	 * exactly what a visual-only effect wants.
	 */
	function scheduleMove(x, y, elem, container, layers, totalLayers, shine){
		frame.elem = elem;
		frame.container = container;
		frame.layers = layers;
		frame.totalLayers = totalLayers;
		frame.shine = shine;
		frame.x = x;
		frame.y = y;

		if(frameQueued){
			return;
		}

		if(typeof win.requestAnimationFrame === 'function'){
			frameQueued = true;
			win.requestAnimationFrame(flushMove);
			return;
		}

		// No rAF (very old engines, some embedded webviews): apply immediately
		// rather than dropping the interaction entirely.
		flushMove();
	}

	function flushMove(){
		frameQueued = false;

		if(frame.elem){
			processMovement(frame.elem, frame.container, frame.layers, frame.totalLayers, frame.shine, frame.x, frame.y);
		}
	}

	function processMovement(elem, container, layers, totalLayers, shine, pageX, pageY){

		var offsets = elem.getBoundingClientRect(),
			w = elem.clientWidth || elem.offsetWidth || elem.scrollWidth, // width
			h = elem.clientHeight || elem.offsetHeight || elem.scrollHeight, // height
			wMultiple,
			offsetX,
			offsetY,
			dy,
			dx,
			yRotate,
			xRotate,
			imgCSS,
			arad,
			angle,
			bdst,
			bdsl,
			revNum,
			ly;

		// A hidden or not-yet-laid-out element measures 0 (or NaN). Every
		// calculation below would then produce Infinity/NaN and hand the
		// browser an invalid transform, which it silently drops. Nothing is
		// visible anyway, so bail out before doing any work.
		if(!(w > 0) || !(h > 0)){
			return;
		}

		// Defensive: a malformed event would otherwise serialise into
		// "rotateX(NaNdeg)", which the browser discards, leaving the icon
		// frozen mid-animation with no explanation.
		if(!isFinite(pageX) || !isFinite(pageY)){
			return;
		}

		bdst = (bd ? bd.scrollTop : 0) || (htm ? htm.scrollTop : 0);
		bdsl = bd ? bd.scrollLeft : 0;

		wMultiple = 320/w;
		offsetX = 0.52 - (pageX - offsets.left - bdsl)/w; //cursor position X
		offsetY = 0.52 - (pageY - offsets.top - bdst)/h; //cursor position Y
		dy = (pageY - offsets.top - bdst) - h / 2; //@h/2 = center of container
		dx = (pageX - offsets.left - bdsl) - w / 2; //@w/2 = center of container
		yRotate = (offsetX - dx)*(0.07 * wMultiple); //rotation for container Y
		xRotate = (dy - offsetY)*(0.1 * wMultiple); //rotation for container X
		imgCSS = 'rotateX(' + xRotate + 'deg) rotateY(' + yRotate + 'deg)'; //img transform
		arad = Math.atan2(dy, dx), //angle between cursor and center of container in RAD
		angle = arad * 180 / Math.PI - 90; //convert rad in degrees

		//get angle between 0-360
		if (angle < 0) {
			angle = angle + 360;
		}

		//container transform
		if(container.className.indexOf(' over') !== -1){
			imgCSS += ' scale3d(1.07,1.07,1.07)';
		}
		container.style.transform = imgCSS;
	
		//gradient angle and opacity for shine
		shine.style.background = 'linear-gradient(' + angle + 'deg, rgba(255,255,255,' + (pageY - offsets.top - bdst)/h * 0.4 + ') 0%,rgba(255,255,255,0) 80%)';
		shine.style.transform = 'translateX(' + (offsetX * totalLayers) - 0.1 + 'px) translateY(' + (offsetY * totalLayers) - 0.1 + 'px)';	

		//parallax for each layer
		revNum = totalLayers;
		for(ly=0;ly<totalLayers;ly++){
			layers[ly].style.transform = 'translateX(' + (offsetX * revNum) * ((ly * 2.5) / wMultiple) + 'px) translateY(' + (offsetY * totalLayers) * ((ly * 2.5) / wMultiple) + 'px)';
			revNum--;
		}
	}
}

/*
 * CommonJS export, so the plug-in can be required by the test suite and by
 * bundlers. The guard is false in a browser, where 'module' is undefined, so
 * loading this file with a <script> tag still defines the global atvImg().
 */
if (typeof module !== 'undefined' && module && module.exports){
	module.exports = atvImg;

	// The validator is exported alongside the plug-in so the security-critical
	// scheme allowlist can be unit tested (and reused by callers who assemble
	// their own markup). It is not needed in a browser.
	module.exports.isSafeImageUrl = atvImgIsSafeImageUrl;
}
