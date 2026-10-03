// The toy elements' shadow-root styles. Colours come from the toys' palettes (theme.js), so a
// toy and the element around it agree; the base element sets data-theme on the wrapper.
import { THEME_RULES } from './theme.js';

// What every toy needs around it: its canvas, frame, control bar and messages.
const TOY_RULES = `
  ${THEME_RULES}
  .bar button, .toy-controls button, .toy-controls select {
    background: var(--paper); border: 1px solid var(--soft); border-radius: 6px; padding: .2rem .6rem; cursor: pointer; }
  .bar { display: flex; align-items: center; gap: .4rem; padding: .4rem .6rem; border-bottom: 1px solid var(--faint); }
  .bar h2 { flex: 1; margin: 0; font-size: 1rem; font-weight: 500; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .stage { position: relative; flex: 1; min-height: 0; display: flex; flex-direction: column; }
  .toy-canvas { flex: 1; min-height: 0; width: 100%; height: 100%; display: block; touch-action: none; user-select: none; }
  .toy-frame { flex: 1; min-height: 0; width: 100%; border: 0; display: block; }
  .toy-controls { display: flex; flex-wrap: wrap; gap: .4rem; align-items: center; padding: .35rem .6rem; border-top: 1px solid var(--faint); }
  .toy-controls label { display: flex; align-items: center; gap: .3rem; font-size: .8rem; }
  .toy-controls input[type=range] { width: 80px; }
  .toy-controls [hidden] { display: none; }
  .toy-controls a { font-size: .8rem; color: var(--soft); }
  .toy-message { margin: auto; padding: 1rem; text-align: center; color: var(--soft); }
  .error { margin: auto; padding: 1rem; color: var(--accent); }
`;

export const DRAWER_CSS = `
  :host { display: block; }
  :host([hidden]) { display: none; }
  ${TOY_RULES}
  .cards { display: grid; grid-template-columns: repeat(auto-fill, minmax(118px, 1fr)); gap: .6rem; }
  .card { display: flex; flex-direction: column; align-items: center; gap: .3rem; padding: .7rem .4rem; border: 1px solid var(--faint);
    border-radius: 10px; background: var(--card); color: var(--ink); font: inherit; cursor: pointer; }
  .card:hover, .card:focus-visible { border-color: var(--soft); }
  .card[aria-pressed="true"] { border-color: var(--accent); box-shadow: 0 0 0 2px var(--accent) inset; }
  .card span { font-size: .85rem; text-align: center; }
  .panel { display: flex; flex-direction: column; overflow: hidden; min-width: 300px; min-height: 360px;
    background: var(--card); border: 1px solid var(--soft); border-radius: 12px; }
  .panel[hidden] { display: none; }
  .toybox[data-panel="inline"] .panel { position: relative; width: 100%; height: 520px; margin-top: .8rem; resize: vertical; }
  .toybox[data-panel="inline"] .drawer-bar, .toybox[data-panel="inline"] .drawer-grip, .toybox[data-panel="inline"] .launcher,
  .toybox[data-panel="floating"] .panel { display: none; }
  /* Floating: the drawer and each toy are windows (src/elements/window.js sets their place, size and z-index). */
  .toybox[data-panel="floating"] .drawer-window, .toy-window { position: fixed; z-index: 2147483000; display: flex; flex-direction: column;
    overflow: hidden; background: var(--card); color: var(--ink); border: 1px solid var(--soft); border-radius: 12px;
    box-shadow: 0 10px 40px rgba(0,0,0,.35); }
  .window[hidden] { display: none; }
  .window.minimized > :not(.bar) { display: none; }
  .window.moving { user-select: none; }
  .window > .bar { cursor: move; touch-action: none; user-select: none; }
  .window > .bar:focus-visible { outline: 2px solid var(--accent); outline-offset: -2px; }
  .toybox[data-panel="floating"] .drawer-body { flex: 1; min-height: 0; overflow: auto; padding: .6rem .6rem 1.4rem; }
  .toybox[data-panel="floating"] .credits { margin-top: .6rem; }
  .grip { position: absolute; right: 0; bottom: 0; width: 22px; height: 22px; cursor: nwse-resize; touch-action: none;
    background: linear-gradient(135deg, transparent 0 45%, var(--soft) 45% 52%, transparent 52% 64%, var(--soft) 64% 71%, transparent 71%); }
  .held { position: absolute; left: 0; right: 0; top: 2.6rem; bottom: 0; display: grid; place-items: center; margin: 0; padding: 1rem;
    border: 0; background: rgba(0,0,0,.45); color: #fff; font: inherit; cursor: pointer; }
  .held[hidden] { display: none; }
  .launcher { padding: .4rem .9rem; border: 1px solid var(--soft); border-radius: 999px; background: var(--card); color: var(--ink);
    font: inherit; cursor: pointer; }
  .launcher[hidden] { display: none; }
  @media print { .toybox[data-panel="floating"] .window, .toy-window, .launcher { display: none !important; } }
  .credits { margin-top: 1rem; font-size: .8rem; color: var(--soft); }
  .credits summary { cursor: pointer; }
  .credits a { color: inherit; }
  .credits li { margin-bottom: .2rem; }
`;

export const BOX_CSS = `
  :host { display: block; width: 320px; height: 360px; }
  :host([hidden]) { display: none; }
  ${TOY_RULES}
  .toybox { display: flex; flex-direction: column; width: 100%; height: 100%; overflow: hidden;
    background: var(--card); border: 1px solid var(--faint); border-radius: 10px; }
  .bar { padding: .25rem .4rem; }
  .bar h2 { font-size: .85rem; }
  .bar button { font-size: .75rem; padding: .1rem .45rem; }
`;
