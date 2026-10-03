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
  .toybox[data-panel="floating"] .panel { position: fixed; z-index: 2147483000; left: 16px; bottom: 16px; width: 440px; height: 520px;
    max-width: 96vw; max-height: 94vh; resize: both; box-shadow: 0 10px 40px rgba(0,0,0,.35); }
  .toybox[data-panel="floating"] .bar { cursor: move; touch-action: none; }
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
