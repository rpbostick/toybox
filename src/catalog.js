// The sixteen toys: what the drawer shows before a toy is loaded (name, preview, credit) and
// how to load it. Each toy module takes its id, name and licence from here, so the card, the
// footer and the mounted toy cannot disagree.
//
// `page` toys run on their own page in an <iframe> because their licence (GPL, MPL) or their
// size keeps their code out of this bundle; the module that loads them is ours. `page` and
// `sourceZip` are paths under dist/, resolved with assetUrl().

const OURS = 'Written for Toybox';
// The toys written here are MIT, as the rest of Toybox's own code (LICENSE).
const OWN_LICENCE = 'MIT';

export const CATALOG = [
  {
    id: 'oil-and-water', name: 'Oil and water', licence: 'MIT',
    credit: 'Adapted from WebGL Fluid Simulation by Pavel Dobryakov',
    source: 'https://github.com/PavelDoGreat/WebGL-Fluid-Simulation',
    load: () => import('./toys/oil-and-water.js'),
  },
  {
    id: 'ripple-tank', name: 'Ripple tank', licence: 'MIT',
    credit: 'Adapted from jquery.ripples by Pim Schreurs (sirxemic), rewritten without jQuery',
    source: 'https://github.com/sirxemic/jquery.ripples',
    load: () => import('./toys/ripple-tank.js'),
  },
  {
    id: 'kaleidoscope', name: 'Kaleidoscope', licence: 'MIT',
    credit: 'Adapted from kaleidoscope by Kazuhiko Arase',
    source: 'https://github.com/kazuhikoarase/kaleidoscope',
    load: () => import('./toys/kaleidoscope.js'),
  },
  {
    id: 'newtons-cradle', name: "Newton's cradle", licence: 'MIT',
    credit: "Adapted from the matter.js Newton's cradle example by Liam Brummitt",
    source: 'https://github.com/liabru/matter-js/blob/master/examples/newtonsCradle.js',
    load: () => import('./toys/newtons-cradle.js'),
  },
  {
    id: 'drip-timer', name: 'Drip timer', licence: 'MIT',
    credit: 'Adapted from Galton board by Lucio Paiva, on matter.js',
    source: 'https://github.com/luciopaiva/galton',
    load: () => import('./toys/drip-timer.js'),
  },
  {
    id: 'stacking-blocks', name: 'Stacking blocks', licence: 'MIT',
    credit: 'Adapted from the matter.js stack and pyramid examples by Liam Brummitt',
    source: 'https://github.com/liabru/matter-js/tree/master/examples',
    load: () => import('./toys/stacking-blocks.js'),
  },
  {
    id: 'pendulums', name: 'Pendulums', licence: 'Unlicense AND MIT',
    credit: 'Double pendulum adapted from Christopher Wellons (skeeto, public domain); magnetic pendulum adapted from Rob Dawson (codebox, MIT)',
    source: 'https://github.com/skeeto/double-pendulum',
    load: () => import('./toys/pendulums.js'),
  },
  {
    id: 'string', name: "String and cloth", licence: 'MIT',
    credit: 'Adapted from verlet-js by Sub Protocol and other contributors',
    source: 'https://github.com/subprotocol/verlet-js',
    load: () => import('./toys/string.js'),
  },
  {
    id: 'spirograph', name: 'Spirograph', licence: 'MIT',
    credit: 'Adapted from circles (Simple spirograph toy) by Andrei Kashcha (anvaka)',
    source: 'https://github.com/anvaka/circles',
    load: () => import('./toys/spirograph.js'),
  },
  {
    id: 'twisty-cube', name: 'Twisty cube', licence: 'MPL-2.0 OR GPL-3.0-or-later',
    page: 'twisty/index.html', sourceZip: 'twisty/source.zip',
    credit: 'cubing.js <twisty-player> by the cubing.js contributors, on its own page; source in twisty/source.zip',
    source: 'https://github.com/cubing/cubing.js',
    load: () => import('./toys/twisty-cube.js'),
  },
  {
    id: 'music-box', name: 'Music box', licence: 'GPL-3.0',
    page: 'music-box/index.html', sourceZip: 'music-box/source.zip',
    credit: 'ToneMatrix Redux by Wolfy (lupine-dev), on its own page; source in music-box/source.zip',
    source: 'https://github.com/lupine-dev/ToneMatrixRedux',
    load: () => import('./toys/music-box.js'),
  },
  {
    id: 'lava-lamp', name: 'Lava lamp', licence: OWN_LICENCE, credit: OURS,
    load: () => import('./toys/lava-lamp.js'),
  },
  {
    id: 'pin-art', name: 'Pin art', licence: OWN_LICENCE, credit: OURS,
    load: () => import('./toys/pin-art.js'),
  },
  {
    id: 'bubble-wrap', name: 'Bubble wrap', licence: OWN_LICENCE, credit: OURS,
    load: () => import('./toys/bubble-wrap.js'),
  },
  {
    id: 'fidget-spinner', name: 'Fidget spinner', licence: OWN_LICENCE, credit: OURS,
    load: () => import('./toys/fidget-spinner.js'),
  },
  {
    id: 'zen-garden', name: 'Zen sand garden', licence: OWN_LICENCE, credit: OURS,
    load: () => import('./toys/zen-garden.js'),
  },
];

export function toyMeta(id) {
  const meta = CATALOG.find((entry) => entry.id === id);
  if (!meta) throw new Error(`no toy ${id} in the catalog`);
  return meta;
}
