// <toy-background>'s implementation: a fixed layer behind the page holding the view (view.js),
// and the controls where the element sits (controls="full|compact|none"), with a slot after them
// for the page's own content. mountView comes from the chunk entry (background.js), so this runs
// in a test with a stand-in view.
import { CONTROL_RULES, THEME_RULES } from '../elements/theme.js';
import { MOTIONS } from './backgrounds.js';
import { startControls } from './controls.js';

const ELEMENT_CSS = `
  :host { display: block; }
  :host([hidden]) { display: none; }
  ${THEME_RULES}
  ${CONTROL_RULES}
  .layer { position: fixed; inset: 0; z-index: -1; pointer-events: none; }
  .backdrop-layers, .backdrop-effect, .backdrop-wash { position: absolute; inset: 0; }
  .backdrop-effect > * { width: 100%; height: 100%; }
  .controls { display: flex; flex-wrap: wrap; align-items: center; gap: .4rem .8rem; }
  .controls[data-mode="none"] { display: none; }
  .controls[data-mode="compact"] .full-only { display: none; }
  .wheel { width: 64px; height: 64px; cursor: pointer; }
  .wheel.off { opacity: .4; cursor: default; }
  .wheel .marker { fill: none; stroke: var(--ink); stroke-width: 2.5; pointer-events: none; }
  .hint { font-size: .8rem; color: var(--soft); }
  @media print { .layer, .controls { display: none !important; } }`;

export function mountBackground(host, wrapper, { mountView }) {
  const doc = host.ownerDocument;
  const win = doc.defaultView;
  wrapper.querySelector('style').textContent = ELEMENT_CSS;
  const layer = doc.createElement('div');
  layer.className = 'layer';
  layer.setAttribute('aria-hidden', 'true');
  layer.setAttribute('part', 'layer');
  const box = doc.createElement('div');
  box.className = 'controls';
  box.setAttribute('part', 'controls');
  wrapper.append(layer, box, doc.createElement('slot'));
  let hidden = false;

  const environment = () => {
    const paper = win.getComputedStyle(host).getPropertyValue('--toybox-paper').trim();
    return { theme: host.environment().theme, paper: paper || null, hidden, motion: host.motion };
  };
  const start = () => startControls({
    win, box, layer, mode: host.controlsMode, effects: host.effects, environment, mountView,
    onChange: (state) => host.dispatchEvent(new win.CustomEvent('background-change', { detail: state, bubbles: true, composed: true })),
  });
  let controls = start();

  return {
    set: (change) => controls.set(change),
    state: () => controls.state(),
    environmentChanged: () => controls.update(),
    hiddenChanged(outOfSight) {
      hidden = outOfSight;
      controls.update();
    },
    attributeChanged(name) {
      if (MOTIONS.includes(name)) {
        controls.update();
        return;
      }
      if (name !== 'effects' && name !== 'controls') return;
      controls.destroy();
      controls = start();
    },
    destroy() {
      controls.destroy();
      layer.remove();
      box.remove();
    },
  };
}
