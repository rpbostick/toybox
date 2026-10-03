// Just enough of a browser for the toys to mount, run frames, take pointer events and be torn
// down, with every animation frame, listener, timer, observer and audio context counted so a
// test can prove destroy() released them. Drawing contexts accept any call.

/** An object that accepts any property read, call or construction and returns itself. */
function anything(overrides = {}) {
  let proxy;
  const target = function stub() {};
  proxy = new Proxy(target, {
    get(_, key) {
      if (key === Symbol.toPrimitive) return () => 0;
      if (key === 'then') return undefined;
      if (Object.prototype.hasOwnProperty.call(overrides, key)) return overrides[key];
      return proxy;
    },
    apply() { return proxy; },
    construct() { return proxy; },
    set() { return true; },
  });
  return proxy;
}

function context2d() {
  const pixels = (width, height) => ({ width, height, data: new Uint8ClampedArray(Math.max(1, width * height) * 4) });
  return anything({
    getImageData: (x, y, width, height) => pixels(width, height),
    createImageData: (width, height) => pixels(width, height),
    measureText: () => ({ width: 0 }),
  });
}

function contextWebGL() {
  return anything({
    getShaderParameter: () => true,
    getProgramParameter: () => true,
    getExtension: () => anything(),
    checkFramebufferStatus: () => 'complete',
    FRAMEBUFFER_COMPLETE: 'complete',
  });
}

export class FakeTarget {
  constructor() { this.listeners = new Map(); }

  addEventListener(type, handler) {
    if (!this.listeners.has(type)) this.listeners.set(type, new Set());
    this.listeners.get(type).add(handler);
  }

  removeEventListener(type, handler) { this.listeners.get(type)?.delete(handler); }

  listenerCount() {
    let count = 0;
    for (const handlers of this.listeners.values()) count += handlers.size;
    return count;
  }

  dispatch(type, event = {}) {
    const full = { type, target: this, preventDefault() {}, stopPropagation() {}, ...event };
    for (const handler of [...(this.listeners.get(type) ?? [])]) handler(full);
  }
}

export class FakeElement extends FakeTarget {
  constructor(doc, tagName) {
    super();
    this.ownerDocument = doc;
    this.tagName = tagName.toUpperCase();
    this.children = [];
    this.parentNode = null;
    this.style = {};
    this.attributes = {};
    this.className = '';
    this.textContent = '';
    this.hidden = false;
    this.value = '';
    this.width = 300;
    this.height = 150;
    this.clientWidth = 0;
    this.clientHeight = 0;
    this.contexts = [];
    if (this.tagName === 'IFRAME') this.contentWindow = { posted: [], postMessage(message, origin) { this.posted.push({ message, origin }); } };
    doc.created.push(this);
  }

  appendChild(child) {
    child.parentNode = this;
    this.children.push(child);
    return child;
  }

  append(...children) { for (const child of children) if (typeof child === 'object') this.appendChild(child); }

  remove() {
    if (!this.parentNode) return;
    this.parentNode.children = this.parentNode.children.filter((child) => child !== this);
    this.parentNode = null;
  }

  setAttribute(name, value) { this.attributes[name] = String(value); }

  getBoundingClientRect() {
    const width = this.clientWidth || this.parentNode?.clientWidth || 0;
    const height = this.clientHeight || this.parentNode?.clientHeight || 0;
    return { left: 0, top: 0, width, height, right: width, bottom: height };
  }

  setPointerCapture() {}

  getContext(type) {
    let context = null;
    if (type === '2d') context = context2d();
    else if (type === 'webgl' || type === 'webgl2' || type === 'experimental-webgl') context = this.doc?.webgl === false ? null : contextWebGL();
    if (context) this.contexts.push(type);
    return context;
  }

  get doc() { return this.ownerDocument; }
}

/**
 * A window + document pair. `stage` is a 400 x 400 element to mount toys in.
 * Options: { webgl: false } makes getContext('webgl*') return null.
 */
export function createFakeBrowser({ webgl = true } = {}) {
  const win = new FakeTarget();
  const doc = new FakeTarget();
  doc.created = [];
  doc.webgl = webgl;
  doc.defaultView = win;
  doc.createElement = (tag) => new FakeElement(doc, tag);

  let nextId = 1;
  const frames = new Map();
  const timers = new Map();
  const observers = new Set();
  const audioContexts = [];

  Object.assign(win, {
    devicePixelRatio: 1,
    location: { origin: 'http://localhost:8797' },
    requestAnimationFrame(callback) { const id = nextId++; frames.set(id, callback); return id; },
    cancelAnimationFrame(id) { frames.delete(id); },
    setTimeout(callback, ms) { const id = nextId++; timers.set(id, { callback, ms }); return id; },
    clearTimeout(id) { timers.delete(id); },
    ResizeObserver: class {
      constructor(callback) { this.callback = callback; this.targets = []; observers.add(this); }
      observe(target) { this.targets.push(target); }
      disconnect() { this.targets = []; observers.delete(this); }
    },
    AudioContext: class {
      constructor() { this.state = 'running'; this.currentTime = 0; this.sampleRate = 8000; this.destination = anything(); audioContexts.push(this); }
      // As in Firefox: resume() and suspend() settle later, and reject if close() came first.
      resume() { return this.settleLater('running', 'Closed before resume completed'); }
      suspend() { return this.settleLater('suspended', 'Closed before suspend completed'); }
      settleLater(state, message) {
        return new Promise((resolve, reject) => setImmediate(() => {
          if (this.state === 'closed') reject(Object.assign(new Error(message), { name: 'InvalidStateError' }));
          else { this.state = state; resolve(); }
        }));
      }
      close() { this.state = 'closed'; return Promise.resolve(); }
      createBuffer(channels, length) { const data = new Float32Array(length); return { getChannelData: () => data }; }
      createBufferSource() { return anything(); }
      createOscillator() { return anything(); }
      createGain() { return anything(); }
      createBiquadFilter() { return anything(); }
    },
  });

  const stage = doc.createElement('div');
  stage.clientWidth = 400;
  stage.clientHeight = 400;

  let clock = 0;
  return {
    win,
    doc,
    stage,
    frames,
    timers,
    observers,
    audioContexts,
    /** Runs the pending animation frames n times, 16 ms apart. */
    runFrames(n = 1) {
      for (let i = 0; i < n; i += 1) {
        clock += 16;
        const pending = [...frames.entries()];
        frames.clear();
        for (const [, callback] of pending) callback(clock);
      }
    },
    runTimers() {
      const pending = [...timers.entries()];
      timers.clear();
      for (const [, { callback }] of pending) callback();
    },
    /** Every listener still attached to the window, the document or any element. */
    listenerCount() {
      return win.listenerCount() + doc.listenerCount() + doc.created.reduce((sum, element) => sum + element.listenerCount(), 0);
    },
  };
}

/** Pointer down, a few moves and up on an element, as from a mouse or a finger. */
export function swipe(element, from, to, pointerId = 1) {
  const at = ([x, y]) => ({ clientX: x, clientY: y, pointerId, button: 0, buttons: 1 });
  element.dispatch('pointerdown', at(from));
  for (let i = 1; i <= 4; i += 1) {
    element.dispatch('pointermove', at([from[0] + ((to[0] - from[0]) * i) / 4, from[1] + ((to[1] - from[1]) * i) / 4]));
  }
  element.dispatch('pointerup', at(to));
}
