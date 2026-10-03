// The lifecycle every toy shares. A toy module supplies its metadata and a setup function;
// defineToy turns that into the drawer's interface:
//   { id, name, licence, mount(el, { theme, reducedMotion }), pause(), resume(), reset(), destroy(), create() }
// Everything a toy starts (animation frames, listeners, timers, observers, audio, DOM nodes)
// goes through the session below, so destroy() can release all of it and the tests can
// prove that it did. One object mounts in one place at a time; create() gives another,
// unmounted one, so a page can show the same toy in a drawer and in several <toy-box>es.

const MAX_FRAME_SECONDS = 1 / 30;

export const PALETTES = {
  light: { paper: '#f6f1e7', ink: '#2b2622', soft: '#8a7f72', faint: '#d9cfbf', accent: '#b5523b', accent2: '#3b6fb5', glass: 'rgba(255,255,255,0.55)' },
  dark: { paper: '#1d1b19', ink: '#ece5d8', soft: '#9a9084', faint: '#3a3530', accent: '#e07a5f', accent2: '#7aa6e0', glass: 'rgba(255,255,255,0.12)' },
};

export function defineToy(meta, setup) {
  for (const key of ['id', 'name', 'licence']) {
    if (typeof meta[key] !== 'string' || !meta[key]) throw new Error(`toy metadata is missing ${key}`);
  }
  return toyInstance(meta, setup);
}

function toyInstance(meta, setup) {
  let session = null;
  const live = () => {
    if (!session) throw new Error(`${meta.id} is not mounted`);
    return session;
  };
  return {
    id: meta.id,
    name: meta.name,
    licence: meta.licence,
    get mounted() { return session !== null; },
    get running() { return session !== null && session.running; },
    create: () => toyInstance(meta, setup),
    mount(el, options) {
      if (session) throw new Error(`${meta.id} is already mounted`);
      if (!options || (options.theme !== 'light' && options.theme !== 'dark')) {
        throw new Error(`${meta.id}: mount needs { theme: 'light' | 'dark', reducedMotion }`);
      }
      session = createSession(el, options, setup);
    },
    pause() { live().pause(); },
    resume() { live().resume(); },
    reset() { live().reset(); },
    destroy() {
      const ending = live();
      session = null;
      ending.destroy();
    },
  };
}

function createSession(el, { theme, reducedMotion }, setup) {
  const doc = el.ownerDocument;
  const win = doc.defaultView ?? globalThis;
  const listeners = [];
  const timers = new Set();
  const observers = [];
  const nodes = [];
  const resizeHandlers = [];
  const fits = [];
  let frameHandler = null;
  let frameId = 0;
  let lastTime = null;
  let running = false;
  let destroyed = false;
  let audio = null;

  // destroy() closes the audio context, which rejects a resume() or suspend() still in
  // flight ("Closed before resume completed"). That rejection is expected after destroy and
  // only then; any other is rethrown.
  const settle = (promise) => promise.catch((error) => {
    if (!destroyed) throw error;
  });

  const tick = (time) => {
    frameId = 0;
    if (!running || destroyed) return;
    const dt = lastTime === null ? 0 : Math.min((time - lastTime) / 1000, MAX_FRAME_SECONDS);
    lastTime = time;
    frameHandler?.(dt, time);
    if (running && !destroyed) frameId = win.requestAnimationFrame(tick);
  };

  const ctx = {
    el,
    doc,
    win,
    theme,
    reducedMotion: Boolean(reducedMotion),
    palette: PALETTES[theme],
    get running() { return running; },

    /** Registers the per-frame callback, called with (dt seconds, time ms) while running. */
    onFrame(handler) { frameHandler = handler; },

    /** Draws one frame while paused, so a change made by a click shows without restarting time. */
    redraw() { if (!running && !destroyed) frameHandler?.(0, 0); },

    listen(target, type, handler, options) {
      target.addEventListener(type, handler, options);
      listeners.push([target, type, handler, options]);
    },

    timeout(handler, ms) {
      const id = win.setTimeout(() => { timers.delete(id); handler(); }, ms);
      timers.add(id);
      return id;
    },

    add(node) {
      el.appendChild(node);
      nodes.push(node);
      return node;
    },

    element(tag, props = {}) {
      const node = doc.createElement(tag);
      Object.assign(node, props);
      return node;
    },

    /**
     * A canvas that fills the element and follows its size; draw in CSS pixels.
     * context: null leaves getContext to the toy (WebGL toys pick their own attributes).
     */
    canvas({ context = '2d', attributes, scaleToPixels = true } = {}) {
      const canvas = ctx.add(doc.createElement('canvas'));
      canvas.className = 'toy-canvas';
      canvas.style.touchAction = 'none';
      const surface = { canvas, g: null, width: 0, height: 0, ratio: 1 };
      if (context) surface.g = canvas.getContext(context, attributes) ?? null;
      // The canvas shares the element with the toy's control bar, so measure the canvas's own
      // box (the element's before layout has run).
      const fit = () => {
        const width = Math.max(1, Math.round(canvas.clientWidth || el.clientWidth));
        const height = Math.max(1, Math.round(canvas.clientHeight || el.clientHeight));
        const ratio = Math.min(win.devicePixelRatio || 1, 2);
        if (width === surface.width && height === surface.height && ratio === surface.ratio) return false;
        Object.assign(surface, { width, height, ratio });
        canvas.width = Math.round(width * ratio);
        canvas.height = Math.round(height * ratio);
        if (scaleToPixels && context === '2d' && surface.g) surface.g.setTransform(ratio, 0, 0, ratio, 0, 0);
        return true;
      };
      fit();
      fits.push(fit);
      observe(canvas);
      return surface;
    },

    /** Called after a canvas made by ctx.canvas changes size and has been refitted. */
    onResize(handler) { resizeHandlers.push(handler); },

    /** Pointer down/move/up relative to the target, in CSS pixels; mouse, pen and touch alike. */
    drag(target, { down, move, up }) {
      const at = (event) => {
        const box = target.getBoundingClientRect();
        return { x: event.clientX - box.left, y: event.clientY - box.top, id: event.pointerId, event };
      };
      const active = new Set();
      ctx.listen(target, 'pointerdown', (event) => {
        if (event.button !== undefined && event.button > 0) return;
        active.add(event.pointerId);
        target.setPointerCapture?.(event.pointerId);
        event.preventDefault?.();
        down?.(at(event));
      });
      ctx.listen(target, 'pointermove', (event) => {
        if (active.has(event.pointerId)) move?.(at(event), true);
        else move?.(at(event), false);
      });
      const finish = (event) => {
        if (!active.delete(event.pointerId)) return;
        up?.(at(event));
      };
      ctx.listen(target, 'pointerup', finish);
      ctx.listen(target, 'pointercancel', finish);
    },

    /** A row of buttons and selects under the toy; returns the created controls by key. */
    controls(items) {
      const bar = ctx.add(doc.createElement('div'));
      bar.className = 'toy-controls';
      const made = {};
      for (const item of items) {
        if (item.href) {
          const link = doc.createElement('a');
          link.href = item.href;
          link.textContent = item.label;
          if (item.download) link.setAttribute('download', '');
          bar.appendChild(link);
          made[item.key ?? item.label] = link;
        } else if (item.range) {
          const label = doc.createElement('label');
          label.textContent = item.label;
          const input = doc.createElement('input');
          input.type = 'range';
          [input.min, input.max, input.step] = item.range.map(String);
          input.value = String(item.value);
          ctx.listen(input, 'input', () => item.onInput(Number(input.value)));
          label.appendChild(input);
          bar.appendChild(label);
          made[item.key ?? item.label] = input;
        } else if (item.options) {
          const select = doc.createElement('select');
          select.title = item.label;
          select.setAttribute?.('aria-label', item.label);
          for (const [value, label] of item.options) {
            const option = doc.createElement('option');
            option.value = value;
            option.textContent = label;
            select.appendChild(option);
          }
          if (item.value !== undefined) select.value = item.value;
          ctx.listen(select, 'change', () => item.onChange(select.value));
          bar.appendChild(select);
          made[item.key ?? item.label] = select;
        } else {
          const button = doc.createElement('button');
          button.type = 'button';
          button.textContent = item.label;
          ctx.listen(button, 'click', () => item.onClick(button));
          bar.appendChild(button);
          made[item.key ?? item.label] = button;
        }
      }
      return made;
    },

    /** A shared AudioContext, created on first use (which must follow a user gesture). */
    audio() {
      if (destroyed) return null;
      if (!audio) {
        const Context = win.AudioContext ?? win.webkitAudioContext;
        if (!Context) return null;
        audio = new Context();
      }
      if (audio.state === 'suspended' && running) settle(audio.resume());
      return audio;
    },

    get hasAudio() { return audio !== null; },
  };

  function observe(node) {
    if (!win.ResizeObserver) return;
    const observer = new win.ResizeObserver(() => {
      if (destroyed) return;
      const changed = fits.map((fit) => fit()).some(Boolean);
      if (!changed) return;
      for (const handler of resizeHandlers) handler();
      if (!running) ctx.redraw();
    });
    observer.observe(node);
    observers.push(observer);
  }

  const toy = setup(ctx);
  if (!toy || typeof toy.reset !== 'function') throw new Error('a toy setup must return at least { reset }');

  const start = () => {
    if (running || destroyed) return;
    running = true;
    lastTime = null;
    toy.resume?.();
    if (audio?.state === 'suspended') settle(audio.resume());
    frameId = win.requestAnimationFrame(tick);
  };
  const stop = () => {
    if (!running) return;
    running = false;
    if (frameId) win.cancelAnimationFrame(frameId);
    frameId = 0;
    toy.pause?.();
    if (audio?.state === 'running') settle(audio.suspend());
  };

  ctx.redraw();
  if (!reducedMotion) start();

  return {
    get running() { return running; },
    pause: stop,
    resume: start,
    reset() {
      toy.reset();
      if (!running) ctx.redraw();
    },
    destroy() {
      stop();
      destroyed = true;
      toy.destroy?.();
      for (const [target, type, handler, options] of listeners) target.removeEventListener(type, handler, options);
      listeners.length = 0;
      for (const id of timers) win.clearTimeout(id);
      timers.clear();
      for (const observer of observers) observer.disconnect();
      for (const node of nodes) node.remove();
      if (audio) audio.close();
      audio = null;
    },
  };
}
