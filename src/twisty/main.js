// The twisty cube page. It runs cubing.js (MPL-2.0 or GPL-3.0-or-later) and takes commands
// from the toy drawer only through postMessage (listed in page.js). It also works opened on
// its own.
import { TwistyPlayer } from 'cubing/twisty';
import { TOY, startTwistyPage } from './page.js';

// The embedding element passes its theme as ?theme=light|dark; opened alone, the system's.
const asked = new URLSearchParams(location.search).get('theme');
if (asked !== null && asked !== 'light' && asked !== 'dark') throw new Error(`twisty page: unknown theme ${asked}`);
const dark = asked ? asked === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches;
const player = new TwistyPlayer({
  puzzle: '3x3x3',
  alg: '',
  background: 'none',
  controlPanel: 'none',
  hintFacelets: 'none',
  tempoScale: 2,
  // Deliberate: PG3D, not the default Cube3D: cubing.js turns a layer on a click only in
  // PG3D ("basic" move-press input); with Cube3D a click does nothing. Its directions are
  // fixed inside cubing.js (Twizzle's): a click turns the face counter-clockwise, a right-click
  // clockwise, and the instructions in index.html say so.
  visualization: 'PG3D',
  experimentalMovePressInput: 'basic',
});
player.style.width = '100%';
player.style.height = '100%';
document.querySelector('#stage').append(player);
document.documentElement.dataset.theme = dark ? 'dark' : 'light';

const embedded = window.parent !== window;
if (embedded) document.body.classList.add('embedded');

const cube = {
  turn: (move) => player.experimentalAddMove(move),
  undo: () => player.experimentalRemoveFinalChild(),
  scramble: (setup) => {
    player.experimentalSetupAlg = setup;
    player.alg = '';
  },
  reset: () => {
    player.experimentalSetupAlg = '';
    player.alg = '';
  },
  pause: () => player.pause(),
  onMoves: (listener) => player.experimentalModel.alg.addFreshListener(({ alg }) => listener([...alg.childAlgNodes()].map(String))),
};

// The player's own KPuzzle, so the solved check and the cube on screen share one definition.
const kpuzzle = await player.experimentalModel.kpuzzle.get();
startTwistyPage({ win: window, doc: document, cube, kpuzzle, storage: localStorage, host: embedded ? window.parent : null });

// Deliberate: '*', because the embedding page may be on any origin (the library is loaded
// from another host); the message carries nothing but "ready".
if (embedded) window.parent.postMessage({ toy: TOY, type: 'ready' }, '*');
