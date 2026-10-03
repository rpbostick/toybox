// The colours every element's shadow root draws with, per theme. The base element sets
// data-theme on the wrapper (.toybox); a page matches its own look by setting the
// --toybox-* custom properties, which win over the built-in palettes in both themes.
import { PALETTES } from '../runtime.js';

const CARD = { light: '#fffaf0', dark: '#26231f' };

export const THEME_PROPERTIES = ['paper', 'ink', 'soft', 'faint', 'accent', 'card', 'font'];

export const THEME_RULES = Object.entries(PALETTES).map(([theme, palette]) => `
  .toybox[data-theme="${theme}"] {
    color-scheme: ${theme};
    --paper: var(--toybox-paper, ${palette.paper}); --ink: var(--toybox-ink, ${palette.ink});
    --soft: var(--toybox-soft, ${palette.soft}); --faint: var(--toybox-faint, ${palette.faint});
    --accent: var(--toybox-accent, ${palette.accent}); --card: var(--toybox-card, ${CARD[theme]});
  }`).join('') + `
  * { box-sizing: border-box; }
  .toybox { color: var(--ink); font: 15px/1.4 var(--toybox-font, system-ui, sans-serif); }
  button, select, input, textarea { font: inherit; font-size: .85rem; color: var(--ink); }
  [hidden] { display: none !important; }`;

/** Buttons, toggles and fields drawn the same in every element. */
export const CONTROL_RULES = `
  .btn { background: var(--paper); border: 1px solid var(--soft); border-radius: 6px; padding: .2rem .6rem; cursor: pointer; }
  .btn:hover, .btn:focus-visible { border-color: var(--accent); }
  .btn[aria-pressed="true"] { background: var(--accent); border-color: var(--accent); color: var(--paper); }
  .btn:disabled { opacity: .5; cursor: default; }
  .check { display: inline-flex; align-items: center; gap: .3rem; font-size: .8rem; }
  .field { background: var(--paper); border: 1px solid var(--soft); border-radius: 6px; padding: .15rem .4rem; }`;
