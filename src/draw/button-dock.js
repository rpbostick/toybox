// <draw-layer>'s Draw button and the tool bar it opens, fixed in a corner of the window or
// wherever its grip dragged it (button-place.js does the geometry). Its "⋯" menu picks the
// corner and resets a dragged button back to it; the place is remembered in `store`.
import { trackPointer } from '../elements/pointer-track.js';
import { CORNERS, MARGIN, anchors, checkCorner, keepOnScreen, parsePlace, serializePlace } from './button-place.js';

const CORNER_LABELS = { 'bottom-left': 'Lower left', 'bottom-right': 'Lower right', 'top-left': 'Upper left', 'top-right': 'Upper right' };

// Above the dice tray's window (2147482000), which a button in a right-hand corner would
// otherwise sit under; below the floating drawer and the image editor.
export const DOCK_CSS = `
  .dock { position: fixed; z-index: 2147482500; display: flex; flex-direction: column; align-items: flex-start; gap: .35rem;
    max-width: calc(100vw - ${2 * MARGIN}px); }
  .dock[data-open-y="up"] { flex-direction: column-reverse; }
  .dock[data-open-x="left"] { align-items: flex-end; }
  .dock .head, .dock .body, .dock .menu { background: var(--card); border: 1px solid var(--faint); border-radius: 10px;
    box-shadow: 0 2px 10px rgba(0, 0, 0, .18); }
  .dock .head { display: inline-flex; align-items: center; gap: .25rem; padding: .25rem; }
  .dock[data-open-x="left"] .head { flex-direction: row-reverse; }
  .dock .grip { align-self: stretch; display: flex; align-items: center; padding: 0 .2rem; color: var(--soft);
    cursor: grab; touch-action: none; user-select: none; -webkit-user-select: none; }
  .dock.moving .grip { cursor: grabbing; }
  .dock .body { display: flex; flex-direction: column; gap: .3rem; padding: .4rem .5rem; max-width: 40rem;
    max-height: calc(100vh - 7rem); overflow: auto; }
  .dock:not(.drawing) .body { display: none; }
  .dock .menu { display: grid; gap: .25rem; padding: .4rem .6rem; }
  .dock .menu .title { font-size: .75rem; color: var(--soft); }`;

/**
 * toggle: the Draw button; body: what shows only while drawing (the tool bar and its choices);
 * corner: the element's corner="…", used until the menu picks one. Returns the dock's element
 * and its controls; destroy() removes every listener it added.
 */
export function createDock(doc, { toggle, body, store, corner }) {
  const win = doc.defaultView;
  const abort = new AbortController();
  const on = (node, type, handler) => node.addEventListener(type, handler, { signal: abort.signal });
  const dock = doc.createElement('div');
  dock.className = 'dock';
  dock.setAttribute('part', 'dock');
  dock.innerHTML = `
    <div class="head">
      <span class="grip" title="Drag to move the Draw button" aria-hidden="true">⠿</span>
      <button type="button" class="btn place" aria-expanded="false" aria-label="Where the Draw button sits" title="Where the Draw button sits">⋯</button>
    </div>
    <div class="menu" role="group" aria-label="Where the Draw button sits" hidden>
      <span class="title">Draw button in the</span>
      ${CORNERS.map((name) => `<label class="check"><input type="radio" name="corner" value="${name}"> ${CORNER_LABELS[name]} corner</label>`).join('')}
      <button type="button" class="btn reset" title="Put the Draw button back in its corner">Reset position</button>
    </div>
    <div class="body"></div>`;
  const $ = (selector) => dock.querySelector(selector);
  const head = $('.head');
  head.insertBefore(toggle, $('.place'));
  $('.body').append(...body);

  let place = parsePlace(store.read()) ?? { corner: checkCorner(corner, '<draw-layer>'), spot: null };
  // Inside the scroll bars, where position: fixed measures from (innerWidth includes them).
  const viewport = () => ({ width: doc.documentElement.clientWidth, height: doc.documentElement.clientHeight });
  const headSize = () => {
    const { width, height } = head.getBoundingClientRect();
    return { width, height };
  };

  function show() {
    const { open, css } = anchors(place, viewport(), headSize());
    Object.assign(dock.style, css);
    dock.dataset.openX = open.x;
    dock.dataset.openY = open.y;
    for (const radio of dock.querySelectorAll('input[name="corner"]')) radio.checked = radio.value === place.corner;
  }

  function set(next, save = true) {
    place = { ...place, ...next };
    show();
    if (save) store.write(serializePlace(place));
  }

  trackPointer($('.grip'), {
    signal: abort.signal,
    start: () => {
      dock.classList.add('moving');
      const { left, top } = head.getBoundingClientRect();
      return { x: left, y: top };
    },
    move: (dx, dy, start) => set({ spot: keepOnScreen({ x: start.x + dx, y: start.y + dy }, viewport(), headSize()) }, false),
    end: () => {
      dock.classList.remove('moving');
      set({});
    },
  });

  const menuButton = $('.place');
  function setMenu(open) {
    $('.menu').hidden = !open;
    menuButton.setAttribute('aria-expanded', String(open));
  }
  on(menuButton, 'click', () => setMenu($('.menu').hidden));
  on($('.menu'), 'change', (event) => {
    set({ corner: checkCorner(event.target.value, 'the corner menu'), spot: null });
    setMenu(false);
  });
  on($('.reset'), 'click', () => {
    set({ spot: null });
    setMenu(false);
  });
  on($('.menu'), 'keydown', (event) => {
    if (event.key !== 'Escape') return;
    setMenu(false);
    menuButton.focus();
  });
  on(win, 'resize', () => show());
  show();

  return {
    el: dock,
    setDrawing(drawing) { dock.classList.toggle('drawing', drawing); },
    /** corner="…" changed: the button goes to that corner (a choice from the menu still wins on reload). */
    setCorner(next) { set({ corner: checkCorner(next, '<draw-layer>'), spot: null }, false); },
    place: () => structuredClone(place),
    destroy() { abort.abort(); },
  };
}
