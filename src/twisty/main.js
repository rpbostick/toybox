// The twisty cube page. It runs cubing.js (MPL-2.0 or GPL-3.0-or-later) and takes commands
// from the toy drawer only through postMessage: { toy: 'twisty-cube', type: 'scramble' |
// 'reset' | 'pause' | 'resume' }. It also works opened on its own.
import { TwistyPlayer } from 'cubing/twisty';

const TOY = 'twisty-cube';
const FACES = ['U', 'D', 'L', 'R', 'F', 'B'];
const AXIS = { U: 0, D: 0, L: 1, R: 1, F: 2, B: 2 };
const SUFFIXES = ['', "'", '2'];

/**
 * A random-move scramble: 25 face turns, never the same axis twice in a row. Not a
 * random-state scramble (cubing/scramble does that, with a search worker of its own); for a
 * desk toy, mixed up is enough.
 */
export function randomMoveScramble(length = 25, random = Math.random) {
  const moves = [];
  let lastAxis = -1;
  while (moves.length < length) {
    const face = FACES[Math.floor(random() * FACES.length)];
    if (AXIS[face] === lastAxis) continue;
    lastAxis = AXIS[face];
    moves.push(face + SUFFIXES[Math.floor(random() * SUFFIXES.length)]);
  }
  return moves.join(' ');
}

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
});
player.style.width = '100%';
player.style.height = '100%';
document.querySelector('#stage').append(player);
document.documentElement.dataset.theme = dark ? 'dark' : 'light';

function scramble() {
  player.experimentalSetupAlg = randomMoveScramble();
  player.alg = '';
}

function reset() {
  player.experimentalSetupAlg = '';
  player.alg = '';
}

document.querySelector('#scramble').addEventListener('click', scramble);
document.querySelector('#reset').addEventListener('click', reset);

const embedded = window.parent !== window;
if (embedded) document.body.classList.add('embedded');

window.addEventListener('message', (event) => {
  if (event.source !== window.parent || event.data?.toy !== TOY) return;
  switch (event.data.type) {
    case 'scramble': scramble(); break;
    case 'reset': reset(); break;
    case 'pause': player.pause(); break;
    case 'resume': break; // nothing runs on its own: turns animate only while they play
    default: throw new Error(`twisty page: unknown message ${event.data.type}`);
  }
});

// Deliberate: '*', because the embedding page may be on any origin (the library is loaded
// from another host); the message carries nothing but "ready".
if (embedded) window.parent.postMessage({ toy: TOY, type: 'ready' }, '*');
