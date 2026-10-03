// The dice tray's shadow-root styles: the window, the log above the roller, the pool and the
// buttons below it, the 2D dice and the settings popup.
import { CONTROL_RULES, THEME_RULES } from '../elements/theme.js';

export const TRAY_CSS = `
  :host { display: contents; }
  ${THEME_RULES}
  ${CONTROL_RULES}
  .tray { position: fixed; z-index: 2147482000; display: flex; flex-direction: column; overflow: hidden;
    min-width: 280px; min-height: 420px; max-width: 100vw; max-height: 100vh; resize: both;
    background: var(--card); border: 1px solid var(--soft); border-radius: 12px; box-shadow: 0 10px 40px rgba(0,0,0,.3); }
  .tray.minimized { min-height: 0; resize: none; }
  .tray.minimized .body, .tray.minimized .grip { display: none; }
  .tray.moving { user-select: none; }
  .bar { display: flex; align-items: center; gap: .3rem; padding: .3rem .5rem; border-bottom: 1px solid var(--faint);
    cursor: move; touch-action: none; user-select: none; }
  .bar h2 { flex: 1; margin: 0; font-size: .95rem; font-weight: 500; }
  .bar .btn { padding: .05rem .45rem; }
  .body { flex: 1; min-height: 0; display: flex; flex-direction: column; gap: .35rem; padding: .4rem .5rem .6rem; overflow-y: auto; }
  .log { flex: 1 1 30%; min-height: 2.6rem; margin: 0; padding: .2rem .3rem; overflow-y: auto; list-style: none;
    font-size: .8rem; border: 1px solid var(--faint); border-radius: 8px; background: var(--paper); }
  .log li { padding: .15rem 0; border-bottom: 1px dotted var(--faint); display: flex; flex-wrap: wrap; gap: .1rem .4rem; align-items: baseline; }
  .log li:last-child { border-bottom: 0; }
  .log .time { color: var(--soft); font-variant-numeric: tabular-nums; }
  .log .what { font-weight: 600; }
  .log .faces { display: inline-flex; flex-wrap: wrap; gap: .2rem; }
  .log .f { min-width: 1.4em; text-align: center; border: 1px solid var(--faint); border-radius: 4px; padding: 0 .2em; }
  .log .f.dropped { opacity: .45; text-decoration: line-through; }
  .log .groups { color: var(--soft); }
  .log .total { font-weight: 700; }
  .log .band { padding: 0 .35em; border-radius: 4px; background: var(--faint); }
  .log .band-critical, .log .band-full { background: var(--accent); color: var(--paper); }
  .log .note { color: var(--soft); font-style: italic; }
  .logbar { display: flex; justify-content: flex-end; }
  .logbar .btn { font-size: .75rem; padding: 0 .4rem; }
  .stage { position: relative; flex: 2 1 40%; min-height: 80px; border-radius: 8px; overflow: hidden;
    background: radial-gradient(circle at 50% 40%, var(--paper), var(--faint)); }
  .stage2d { position: absolute; inset: 0; display: flex; flex-wrap: wrap; align-content: center; justify-content: center;
    gap: .6rem; padding: .6rem; overflow: auto; }
  .stage[data-showing="3d"] .stage2d { visibility: hidden; }
  .stage[data-showing="2d"] ::slotted(*) { visibility: hidden; }
  ::slotted([slot="stage3d"]) { position: absolute; inset: 0; }
  .pool { display: flex; align-items: center; gap: .35rem; }
  .pool output { flex: 1; min-height: 1.6rem; padding: .15rem .45rem; border: 1px dashed var(--soft); border-radius: 6px;
    font-variant-numeric: tabular-nums; overflow-wrap: anywhere; }
  .pool output:empty::before { content: 'Pick dice, then Roll'; color: var(--soft); }
  .buttons { display: grid; grid-template-columns: repeat(auto-fill, minmax(3rem, 1fr)); gap: .3rem; }
  .buttons .btn { padding: .3rem 0; }
  .modifier { display: flex; align-items: center; gap: .3rem; }
  .modifier .value { min-width: 3.2rem; }
  .modifier .value.set { border-color: var(--accent); }
  .dn, .notation { display: flex; align-items: center; gap: .35rem; }
  .dn input { width: 5.5rem; }
  .notation input { flex: 1; min-width: 0; }
  .grip { position: absolute; right: 0; bottom: 0; width: 22px; height: 22px; cursor: nwse-resize; touch-action: none;
    background: linear-gradient(135deg, transparent 0 45%, var(--soft) 45% 52%, transparent 52% 64%, var(--soft) 64% 71%, transparent 71%); }
  .launcher { position: fixed; z-index: 2147482000; bottom: 16px; padding: .4rem .8rem; border-radius: 999px;
    box-shadow: 0 4px 16px rgba(0,0,0,.25); }
  .launcher.right { right: 16px; }
  .launcher.left { left: 16px; }
  dialog.settings { border: 1px solid var(--soft); border-radius: 10px; background: var(--card); color: var(--ink); max-width: 22rem; }
  dialog.settings::backdrop { background: rgba(0,0,0,.3); }
  dialog.settings h3 { margin: 0 0 .5rem; font-size: 1rem; font-weight: 500; }
  dialog.settings label { display: flex; justify-content: space-between; align-items: center; gap: .8rem; margin: .3rem 0; font-size: .85rem; }
  dialog.settings .actions { display: flex; justify-content: flex-end; margin-top: .6rem; }

  /* 2D dice */
  .die { --size: 54px; position: relative; width: var(--size); height: var(--size); display: grid; place-items: center;
    background: var(--die-color, #f4ecd8); color: var(--pip-color, #3b2a7a); font-weight: 700; font-size: 1.3rem;
    filter: drop-shadow(0 2px 2px rgba(0,0,0,.35)); }
  .die.d6 { border-radius: 10px; }
  .die.d4 { clip-path: polygon(50% 4%, 97% 92%, 3% 92%); padding-top: 22%; }
  .die.d8 { clip-path: polygon(50% 0, 100% 50%, 50% 100%, 0 50%); }
  .die.d10 { clip-path: polygon(50% 0, 100% 42%, 50% 100%, 0 42%); }
  .die.d12 { clip-path: polygon(50% 0, 98% 36%, 80% 95%, 20% 95%, 2% 36%); }
  .die.d20 { clip-path: polygon(50% 0, 95% 25%, 95% 75%, 50% 100%, 5% 75%, 5% 25%); }
  .die.dn { clip-path: polygon(30% 0, 70% 0, 100% 30%, 100% 70%, 70% 100%, 30% 100%, 0 70%, 0 30%); }
  .die.dn::after { content: attr(data-sides); position: absolute; bottom: 7%; font-size: .55rem; font-weight: 500; opacity: .75; }
  .die.dropped { opacity: .4; }
  .die .face.numeral.wide { font-size: 1.05rem; }
  .die .face.numeral.wider { font-size: .8rem; }
  .die .face[class*="pips-"] { display: grid; grid-template: repeat(3, 1fr) / repeat(3, 1fr); width: 74%; height: 74%; }
  .die .face[class*="pips-"] span { display: grid; place-items: center; }
  .die .face[class*="pips-"] .pip::before { content: ''; width: 9px; height: 9px; background: currentColor; }
  .die .face.pips-round .pip::before { border-radius: 50%; }
  .die.tumbling { animation: tumble 1100ms cubic-bezier(.2,.7,.3,1) both; animation-delay: calc(var(--i) * 40ms); }
  @keyframes tumble { from { transform: translate(-30px, -40px) rotate(var(--spin)); } to { transform: none; } }
  @media (prefers-reduced-motion: reduce) { .die.tumbling { animation: none; } }
  @media print { .tray, .launcher, dialog { display: none !important; } }
`;
