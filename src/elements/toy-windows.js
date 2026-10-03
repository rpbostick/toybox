// The toy windows of a floating <toy-drawer>: each open toy in a window of its own (its name,
// Pause, Reset, minimize, close), several at once, each moved, resized, minimized and
// remembered on its own (src/elements/window.js). A toy has one window at a time; opening it
// again brings that window to the front. A toy runs while its window is open, not minimized,
// on screen and within the page's running cap (running-cap.js); a window the cap pauses says
// "Paused, click to resume".
import { createDrawer } from '../drawer.js';
import { runningCap } from './running-cap.js';
import { attachWindow, windowStack } from './window.js';
import * as WindowState from './window-state.js';

export const TOY_WINDOW_SIZE = { w: 440, h: 520 };
export const TOY_WINDOW_MIN = { w: 300, h: 360 };
// Each new window sits this far below and right of the one before, so they do not stack exactly.
export const CASCADE = 32;
// The gap between the drawer's window and the first toy window, which opens beside it.
const GAP = 16;

const TEMPLATE = `
  <header class="bar" part="window-bar" tabindex="0">
    <h2></h2>
    <button class="pause" type="button">Pause</button>
    <button class="reset" type="button">Reset</button>
    <button class="minimize" type="button">–</button>
    <button class="close" type="button">×</button>
  </header>
  <div class="stage"></div>
  <button class="held" type="button" hidden>Paused, click to resume</button>
  <div class="grip" part="resize-handle" title="Resize"></div>`;

/**
 * container: the element the windows go in. tabHidden(): the tab is hidden. storeFor(id): where
 * that toy's window is remembered. anchor(): the drawer window's state, which new windows
 * cascade from. maxRunning(): this drawer's cap. onChange(): after a window opens, closes,
 * pauses or resumes.
 */
export function createToyWindows({ win, container, catalog, environment, tabHidden, storeFor, anchor, maxRunning, onChange }) {
  const doc = container.ownerDocument;
  const windows = new Map(); // toy id -> its window
  const cap = runningCap(doc);
  const stack = windowStack(doc);
  const owner = { maxRunning, windows: () => [...windows.values()] };
  cap.join(owner);
  const update = () => cap.update();

  function placeNew(viewport) {
    const from = anchor();
    const step = CASCADE * windows.size;
    return { x: from.x + from.w + GAP + step, y: from.y + step, w: TOY_WINDOW_SIZE.w, h: Math.min(TOY_WINDOW_SIZE.h, viewport.height), open: true, minimized: false };
  }

  function focus(entry) {
    entry.focusedAt = cap.tick();
    stack.raise(entry.box);
    update();
  }

  function show(entry) {
    const state = entry.drawer.state();
    entry.parts.pause.textContent = state.pausedByUser ? 'Play' : 'Pause';
    entry.parts.held.hidden = !entry.capped;
    entry.box.dataset.running = String(state.running);
    if (state.id) entry.parts.title.textContent = entry.meta.name;
  }

  function build(meta) {
    const box = doc.createElement('section');
    box.className = 'window toy-window';
    box.setAttribute('part', 'toy-window');
    box.setAttribute('role', 'dialog');
    box.setAttribute('aria-modal', 'false');
    box.dataset.toy = meta.id;
    box.innerHTML = TEMPLATE;
    const find = (selector) => box.querySelector(selector);
    const parts = { title: find('h2'), pause: find('.pause'), held: find('.held') };
    parts.title.id = `toy-window-${meta.id}`;
    parts.title.textContent = `${meta.name}…`;
    box.setAttribute('aria-labelledby', parts.title.id);
    find('.close').setAttribute('aria-label', `Close ${meta.name}`);
    find('.close').title = `Close ${meta.name}`;
    container.append(box);

    const entry = {
      id: meta.id, meta, box, parts, focusedAt: 0, offscreen: false, capped: false, applied: false,
      eligible: () => !tabHidden() && !entry.frame.state().minimized && !entry.offscreen && !entry.drawer.state().pausedByUser,
      // The hold reaches the toy only once it is mounted; until then hidden() below asks for it.
      applyCap(eligible, capped) {
        entry.capped = eligible && capped;
        const hold = !eligible || capped;
        if (entry.drawer.state().id !== null && hold !== entry.applied) {
          entry.applied = hold;
          entry.drawer.setHidden(hold);
        }
        show(entry);
      },
    };
    entry.drawer = createDrawer({
      catalog,
      stage: find('.stage'),
      environment,
      hidden: () => {
        update();
        return entry.applied;
      },
      onChange: () => {
        show(entry);
        onChange();
      },
    });
    entry.frame = attachWindow({
      win,
      els: { box, bar: find('.bar'), grip: find('.grip'), minimize: find('.minimize'), close: find('.close') },
      store: storeFor(meta.id),
      place: placeNew,
      min: TOY_WINDOW_MIN,
      name: meta.name,
      stack,
      escapeCloses: true,
      onChange: () => { if (windows.has(meta.id)) update(); },
      onClose: () => close(meta.id),
      onFront: () => focus(entry),
    });
    entry.observer = new win.IntersectionObserver((records) => {
      entry.offscreen = !records.at(-1).isIntersecting;
      update();
    });
    entry.observer.observe(box);
    const abort = new AbortController();
    entry.abort = abort;
    // Pressing Pause or Play is using the window, so it comes first for the cap too (a keyboard
    // press may not move the focus into the window).
    parts.pause.addEventListener('click', () => {
      entry.drawer.togglePause();
      focus(entry);
    }, { signal: abort.signal });
    find('.reset').addEventListener('click', () => entry.drawer.reset(), { signal: abort.signal });
    parts.held.addEventListener('click', () => focus(entry), { signal: abort.signal });
    return entry;
  }

  /**
   * Opens the toy's window, or brings its open window to the front and restores it. restoring:
   * reopening a window remembered open, which keeps its remembered minimized state.
   */
  function open(id, { restoring = false } = {}) {
    const existing = windows.get(id);
    if (existing) {
      existing.frame.open();
      focus(existing);
      return existing.loading;
    }
    const meta = catalog.find((entry) => entry.id === id);
    if (!meta) throw new Error(`no toy ${id}`);
    const entry = build(meta);
    windows.set(id, entry);
    if (!restoring) entry.frame.open();
    focus(entry);
    entry.loading = entry.drawer.open(id).catch((error) => {
      entry.parts.title.textContent = `${meta.name}: could not open (${error.message})`;
      throw error;
    });
    onChange();
    return entry.loading;
  }

  function release(entry) {
    windows.delete(entry.id);
    entry.drawer.close();
    entry.abort.abort();
    entry.frame.detach();
    entry.observer.disconnect();
    entry.box.remove();
  }

  /** Closes the toy's window and destroys the toy; the window is remembered closed. */
  function close(id) {
    const entry = windows.get(id);
    if (!entry) return;
    entry.frame.close();
    release(entry);
    update();
    onChange();
  }

  return {
    open,
    close,
    closeAll() { for (const id of [...windows.keys()]) close(id); },
    /** Reopens the windows of `ids` that were open when the page was last left. */
    restore(ids) {
      const opening = ids.filter((id) => WindowState.parse(storeFor(id).read())?.open).map((id) => open(id, { restoring: true }));
      return Promise.all(opening);
    },
    has: (id) => windows.has(id),
    /** The open windows, most recently focused first: { id, running, pausedByUser, minimized, capped }. */
    list() {
      return [...windows.values()].sort((a, b) => b.focusedAt - a.focusedAt).map((entry) => ({
        ...entry.drawer.state(), id: entry.id, minimized: entry.frame.state().minimized, capped: entry.capped,
      }));
    },
    update,
    remount() { for (const entry of windows.values()) entry.drawer.remount(); },
    /** Takes every window down without remembering them closed: the drawer left the page. */
    destroy() {
      for (const entry of [...windows.values()]) release(entry);
      cap.leave(owner);
    },
  };
}
