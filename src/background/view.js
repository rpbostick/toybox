// The drawing side of <toy-background>: the page colour, the current background and the wash over
// it, inside the element's fixed layer, plus the pointer, wheel and key handling that reaches
// the background. The controls (controls.js) tell it what to show through update().
//
// A background, the library's or a page's own (registerBackground), is mounted into
// .backdrop-effect with api { colors, theme, reducedMotion, motion } and then told:
//   setColors(colors)  the look's colours when they change ({ theme, hex: [3], rgb: [3] })
//   pointer(point)     { x, y } in client pixels during a drag that started on bare background
//                      (while "reacts to the mouse" is on), wherever the pointer goes, then
//                      once a frame while it coasts on after a fling; null once when the drag
//                      and its coast end, so the background settles
//   pause(), resume()  out of sight (tab hidden, element scrolled away) or reduced motion
//   destroy()          another background is picked, the background is turned off, or the
//                      element leaves the page
// api.motion is the drag dynamics (motion.js) a background reads once per frame.
import { ColorDrive, wheelTicks } from './colorDrive.js';
import { BUILT_IN_EFFECTS } from './effects/index.js';
import { isBackground, pluginDefinition } from './backgrounds.js';
import { activeAfterPress, createDragFeed, isBareBackground, CURSOR_CSS, DRAGGING_CLASS, GRAB_CLASS, MIDDLE_BUTTON } from './input.js';
import { colorsAt, lookOf } from './looks.js';
import { checkedMotion, createMotion } from './motion.js';
import { colorName, nearestStopIndex } from './palette.js';

// One drive for the page: it keeps its place when the background changes.
export const drive = new ColorDrive();

const REDUCED_MOTION = '(prefers-reduced-motion: reduce)';
const SETTINGS = ['background', 'theme', 'paper', 'on', 'hidden', 'interactive', 'colorMode', 'motion'];

function checked(settings) {
  checkedMotion(settings.motion);
  if (!isBackground(settings.background)) throw new Error(`unknown background ${JSON.stringify(settings.background)}`);
  if (settings.theme !== 'light' && settings.theme !== 'dark') throw new Error(`unknown theme ${JSON.stringify(settings.theme)}`);
  if (settings.paper !== null && typeof settings.paper !== 'string') throw new Error(`paper must be a colour or null, not ${JSON.stringify(settings.paper)}`);
  for (const key of ['on', 'hidden', 'interactive', 'colorMode']) {
    if (typeof settings[key] !== 'boolean') throw new Error(`${key} must be true or false, not ${JSON.stringify(settings[key])}`);
  }
  return settings;
}

/** The methods of a mounted background: those mount() returned, else the definition's own. */
function handleOf(id, definition, returned) {
  const method = (name) => {
    const own = returned && typeof returned[name] === 'function' ? returned : null;
    const holder = own ?? (typeof definition[name] === 'function' ? definition : null);
    return holder ? (...args) => holder[name](...args) : null;
  };
  const destroy = method('destroy');
  if (!destroy) throw new Error(`background "${id}" has no destroy(): give it on the definition or on what mount() returns`);
  return {
    destroy,
    // Optional: a background that does not follow the colours, the pointer or the clock leaves them out.
    setColors: method('setColors') ?? (() => {}),
    pointer: method('pointer') ?? (() => {}),
    pause: method('pause') ?? (() => {}),
    resume: method('resume') ?? (() => {}),
  };
}

const colorKey = (colors) => `${colors.theme}${colors.hex.join('')}`;

/**
 * Mounts the view into `layer`. initial: the settings above plus onColorMode(active, name, stop)
 * and onColorModeRequest(active). effects replaces the built-in backgrounds (a test's stand-ins).
 */
export function mountView(layer, initial, { effects = BUILT_IN_EFFECTS } = {}) {
  const doc = layer.ownerDocument;
  const win = doc.defaultView;
  const { onColorMode, onColorModeRequest } = initial;
  let settings = checked(Object.fromEntries(SETTINGS.map((key) => [key, initial[key]])));
  const media = win.matchMedia(REDUCED_MOTION);
  let reduced = media.matches;
  let pageVisible = doc.visibilityState !== 'hidden';

  let layers = null; // { root, effect, wash } while on
  let handle = null;
  let mountedId = null;
  let failedId = null;
  let feed = null;
  let paused = false;
  let lastColors = null;
  let shownStop = null;
  let frame = null;
  let pointerAbort = null;
  let colorModeAbort = null;
  const always = new AbortController();
  const motion = createMotion({ now: () => win.performance.now(), size: () => ({ width: layer.clientWidth, height: layer.clientHeight }) });
  let coastFrame = null;
  const listen = (signal, target, type, handler, options = {}) => target.addEventListener(type, handler, { ...options, signal });

  const active = () => settings.on && settings.colorMode;
  const shouldPause = () => reduced || !pageVisible || settings.hidden;
  const position = () => drive.advance(win.performance.now());
  const report = (now) => onColorMode(active(), colorName(settings.theme, now), nearestStopIndex(now));

  function currentColors(now) {
    return colorsAt(settings.background, settings.theme, now);
  }

  function definitionOf(id) {
    const definition = effects[id] ?? pluginDefinition(id);
    if (!definition) throw new Error(`unknown background ${JSON.stringify(id)}`);
    return definition;
  }

  function destroyEffect() {
    if (!handle) return;
    const old = handle;
    handle = null;
    mountedId = null;
    old.destroy();
  }

  // If a background cannot draw (no WebGL, a shader that fails, a plug-in that throws), the error
  // is logged and named on the layer, and the page colour and wash stay, so the page is still
  // readable and working.
  function mountEffect() {
    destroyEffect();
    layers.effect.replaceChildren();
    delete layers.root.dataset.failed;
    failedId = null;
    const id = settings.background;
    const colors = currentColors(position());
    motion.reset();
    try {
      const definition = definitionOf(id);
      const returned = definition.mount(layers.effect, { colors, theme: settings.theme, reducedMotion: reduced, motion: motion.api });
      handle = handleOf(id, definition, returned);
      mountedId = id;
      lastColors = colorKey(colors);
      paused = false;
      if (shouldPause()) {
        handle.pause();
        paused = true;
      }
    } catch (error) {
      handle = null;
      failedId = id;
      layers.root.dataset.failed = id;
      win.console.error(`<toy-background>: the "${id}" background could not draw:`, error);
    }
  }

  function applyPause() {
    if (!handle) return;
    const want = shouldPause();
    if (want === paused) return;
    paused = want;
    if (want) handle.pause();
    else handle.resume();
  }

  // The colour loop runs while the background is on and in sight: it advances the drive, tells the
  // background its colours when they change and the page when the nearest stop changes.
  function tick() {
    const now = position();
    const index = nearestStopIndex(now);
    if (index !== shownStop) {
      shownStop = index;
      report(now);
    }
    if (handle) {
      const colors = currentColors(now);
      const key = colorKey(colors);
      if (key !== lastColors) {
        lastColors = key;
        handle.setColors(colors);
      }
    }
    frame = win.requestAnimationFrame(tick);
  }
  function runColorLoop() {
    const run = settings.on && pageVisible && !settings.hidden;
    if (run && frame === null) frame = win.requestAnimationFrame(tick);
    if (!run && frame !== null) {
      win.cancelAnimationFrame(frame);
      frame = null;
    }
  }

  function buildLayers() {
    const root = doc.createElement('div');
    root.className = 'backdrop-layers';
    const effect = doc.createElement('div');
    effect.className = 'backdrop-effect';
    const wash = doc.createElement('div');
    wash.className = 'backdrop-wash';
    root.append(effect, wash);
    layer.append(root);
    layers = { root, effect, wash };
  }

  function paint() {
    const look = lookOf(settings.background, settings.theme, settings.paper);
    layers.root.style.backgroundColor = look.background;
    layers.wash.style.backgroundColor = look.background;
    layers.wash.style.opacity = String(look.wash);
  }

  // Every pointer update the background gets goes through here: the drag goes into the motion
  // (motion.js) and reaches the background as { x, y }; after a fling the coasting point follows
  // once a frame, then null once when the coast is over. A drag that ends without a fling, or is
  // cancelled, sends null at once.
  function stopCoast() {
    if (coastFrame === null) return false;
    win.cancelAnimationFrame(coastFrame);
    coastFrame = null;
    return true;
  }
  function coast() {
    const point = motion.api.pointer();
    coastFrame = point ? win.requestAnimationFrame(coast) : null;
    handle?.pointer(point);
  }
  /** Ends a coast now (the interaction, the momentum or the animation turned off). */
  function endCoast() {
    motion.stopCoast();
    if (stopCoast()) handle?.pointer(null);
  }
  const pointerFeed = {
    grab(x, y) {
      stopCoast();
      motion.grab(x, y);
      handle?.pointer({ x, y });
    },
    move(x, y) {
      motion.move(x, y);
      handle?.pointer({ x, y });
    },
    release() {
      motion.release();
      if (motion.coasting()) coastFrame = win.requestAnimationFrame(coast);
      else handle?.pointer(null);
    },
    cancel() {
      motion.cancel();
      handle?.pointer(null);
    },
  };

  // The page content sits on top of the background, so the background follows the pointer only
  // while it is dragged: a press on bare background grabs it, and it follows wherever the pointer
  // goes until release (see createDragFeed). Hovering feeds nothing; bare background shows a grab
  // cursor.
  function startPointer() {
    pointerAbort = new AbortController();
    const { signal } = pointerAbort;
    const classes = doc.documentElement.classList;
    const cursors = doc.createElement('style');
    cursors.setAttribute('data-toybox-background', '');
    cursors.textContent = CURSOR_CSS;
    (doc.head ?? doc.documentElement).append(cursors);
    feed = createDragFeed(pointerFeed);
    const endDrag = () => {
      feed.cancel();
      classes.remove(DRAGGING_CLASS);
    };
    signal.addEventListener('abort', () => {
      endDrag();
      endCoast();
      classes.remove(GRAB_CLASS);
      cursors.remove();
    });

    listen(signal, win, 'pointerdown', (event) => {
      const here = isBareBackground(event.target);
      if (event.button === MIDDLE_BUTTON) {
        if (here) onColorModeRequest(activeAfterPress(active(), event.button));
        return;
      }
      if (!feed.press(event.pointerId, event.clientX, event.clientY, event.button, here)) return;
      win.getSelection()?.removeAllRanges();
      classes.remove(GRAB_CLASS);
      classes.add(DRAGGING_CLASS);
    });
    listen(signal, win, 'pointermove', (event) => {
      if (feed.dragging) {
        feed.move(event.pointerId, event.clientX, event.clientY);
        return;
      }
      classes.toggle(GRAB_CLASS, feed.enabled && isBareBackground(event.target));
    });
    const afterEnd = () => {
      if (!feed.dragging) classes.remove(DRAGGING_CLASS);
    };
    listen(signal, win, 'pointerup', (event) => {
      feed.release(event.pointerId);
      afterEnd();
    });
    listen(signal, win, 'pointercancel', (event) => {
      feed.cancelPointer(event.pointerId);
      afterEnd();
    });
    // The window lost the focus: the drag ends without a coast and the background settles.
    listen(signal, win, 'blur', endDrag);
    // The pointer left the window: a fling off the edge coasts on.
    listen(signal, doc, 'mouseout', (event) => {
      if (event.relatedTarget !== null) return;
      feed.leave();
      classes.remove(DRAGGING_CLASS, GRAB_CLASS);
    });
    // A touch drag moves the background, not the page.
    listen(signal, win, 'touchmove', (event) => { if (feed.dragging) event.preventDefault(); }, { passive: false });
    // A middle press would otherwise start autoscroll (mousedown) and, on Linux, paste the
    // primary selection (mouseup, auxclick).
    const suppressMiddle = (event) => {
      if (event.button === MIDDLE_BUTTON && isBareBackground(event.target)) event.preventDefault();
    };
    for (const type of ['mousedown', 'mouseup', 'auxclick']) listen(signal, win, type, suppressMiddle);
  }

  function setInteractive(on) {
    feed.setEnabled(on);
    if (on) return;
    endCoast();
    doc.documentElement.classList.remove(GRAB_CLASS, DRAGGING_CLASS);
  }

  // While the color mode is on, the wheel over bare background steps through the loop and Esc
  // turns the mode off.
  function startColorMode() {
    colorModeAbort = new AbortController();
    const { signal } = colorModeAbort;
    const accumulator = { pixels: 0 };
    listen(signal, win, 'wheel', (event) => {
      if (!isBareBackground(event.target)) return;
      event.preventDefault();
      const ticks = wheelTicks(accumulator, event.deltaY, event.deltaMode, win.innerHeight);
      const now = win.performance.now();
      for (let tick = 0; tick < Math.abs(ticks); tick++) drive.step(ticks > 0 ? 1 : -1, now);
    }, { passive: false });
    listen(signal, doc, 'keydown', (event) => { if (event.key === 'Escape') onColorModeRequest(false); });
    doc.documentElement.classList.add('toybox-background-color-mode');
    signal.addEventListener('abort', () => doc.documentElement.classList.remove('toybox-background-color-mode'));
  }

  function stopAll() {
    stopCoast();
    pointerAbort?.abort();
    pointerAbort = null;
    colorModeAbort?.abort();
    colorModeAbort = null;
    destroyEffect();
    failedId = null;
    layers?.root.remove();
    layers = null;
  }

  /** Brings the drawing in line with `settings`, from `before` (null at mount). */
  function apply(before) {
    if (!settings.on) {
      stopAll();
    } else {
      motion.setOptions(settings.motion);
      if (!settings.motion.momentum) endCoast();
      if (!layers) buildLayers();
      paint();
      if (!pointerAbort) startPointer();
      setInteractive(settings.interactive);
      // A background that failed is not retried on every theme or visibility change; picking it
      // again after another one, or turning the background off and on, does retry it.
      if (mountedId !== settings.background && failedId !== settings.background) mountEffect();
      else if (before && before.theme !== settings.theme && handle) {
        const colors = currentColors(position());
        lastColors = colorKey(colors);
        handle.setColors(colors);
      }
      applyPause();
    }
    if (active() && !colorModeAbort) startColorMode();
    if (!active() && colorModeAbort) {
      colorModeAbort.abort();
      colorModeAbort = null;
    }
    runColorLoop();
    if (!before || before.theme !== settings.theme || before.colorMode !== settings.colorMode || before.on !== settings.on) report(position());
  }

  drive.reducedMotion = reduced;
  motion.setReducedMotion(reduced);
  listen(always.signal, media, 'change', () => {
    reduced = media.matches;
    drive.reducedMotion = reduced;
    motion.setReducedMotion(reduced);
    if (reduced) endCoast();
    applyPause();
  });
  listen(always.signal, doc, 'visibilitychange', () => {
    pageVisible = doc.visibilityState !== 'hidden';
    applyPause();
    runColorLoop();
  });
  apply(null);

  return {
    update(change) {
      const before = settings;
      settings = checked({ ...settings, ...Object.fromEntries(Object.entries(change).filter(([key]) => SETTINGS.includes(key))) });
      apply(before);
    },
    /** A stop picked on the colour wheel. */
    pick(stop) {
      drive.pick(stop, win.performance.now());
    },
    unmount() {
      always.abort();
      if (frame !== null) win.cancelAnimationFrame(frame);
      frame = null;
      stopAll();
    },
  };
}
