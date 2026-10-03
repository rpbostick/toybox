// The twisty cube page around the player (src/twisty/): move notation and keys, undo, the
// move counter and timer, the solved check (cubing.js's KPuzzle), the instructions panel and
// the postMessage API. The player is a stand-in that keeps the turns the way <twisty-player>
// keeps its alg; the real one is driven in Firefox by e2e/drive.mjs.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Window } from 'happy-dom';
import { cube3x3x3 } from 'cubing/puzzles';
import { Alg } from 'cubing/alg';
import { FACE_TURNS, MORE_TURNS, keyAction, moveString, randomMoveScramble } from '../src/twisty/notation.js';
import { CubeSession, formatTime } from '../src/twisty/session.js';
import { HELP_SEEN_KEY, TIMER_KEY, TOY, startTwistyPage } from '../src/twisty/page.js';

const kpuzzle = await cube3x3x3.kpuzzle();
const SCRAMBLE = "R U F' D2 L B'";
const inverse = (alg) => new Alg(alg).invert().toString();
const windows = [];
after(() => Promise.all(windows.map((win) => win.happyDOM.close())));

test('a letter turns clockwise, Shift+letter counter-clockwise, Ctrl/Cmd+Z undoes', () => {
  for (const family of ['U', 'D', 'L', 'R', 'F', 'B', 'M', 'E', 'S']) {
    assert.deepEqual(keyAction({ key: family.toLowerCase() }), { move: family });
    assert.deepEqual(keyAction({ key: family, shiftKey: true }), { move: `${family}'` });
  }
  for (const family of ['x', 'y', 'z']) {
    assert.deepEqual(keyAction({ key: family }), { move: family });
    assert.deepEqual(keyAction({ key: family.toUpperCase(), shiftKey: true }), { move: `${family}'` });
  }
  assert.deepEqual(keyAction({ key: 'z', ctrlKey: true }), { undo: true });
  assert.deepEqual(keyAction({ key: 'z', metaKey: true }), { undo: true });
  assert.equal(keyAction({ key: 'r', ctrlKey: true }), null, 'Ctrl+R stays the browser\'s');
  assert.equal(keyAction({ key: 'r', altKey: true }), null);
  assert.equal(keyAction({ key: 'q' }), null);
  assert.equal(keyAction({ key: 'Enter' }), null);
});

test('every button turn is a move cubing.js knows, with its face named for the hover text', () => {
  assert.deepEqual(FACE_TURNS.map((turn) => turn.title.split(':')[0]), ['U', 'D', 'L', 'R', 'F', 'B']);
  assert.equal(FACE_TURNS[0].title, 'U: up face');
  assert.deepEqual(MORE_TURNS.map((turn) => turn.family), ['x', 'y', 'z', 'M', 'E', 'S']);
  for (const { family } of [...FACE_TURNS, ...MORE_TURNS]) {
    for (const move of [moveString(family, false), moveString(family, true)]) {
      assert.doesNotThrow(() => kpuzzle.moveToTransformation(move), move);
    }
  }
  assert.throws(() => moveString('Q', false), /unknown turn Q/);
});

test('a turn and its prime undo each other, by the KPuzzle', () => {
  for (const { family } of [...FACE_TURNS, ...MORE_TURNS]) {
    const pattern = kpuzzle.defaultPattern().applyMove(moveString(family, false));
    assert.ok(pattern.applyMove(moveString(family, true)).isIdentical(kpuzzle.defaultPattern()), family);
  }
});

test('the session: solved after a scramble and its inverse, the timer from the first turn to the solve', () => {
  let clock = 1000;
  const session = new CubeSession(kpuzzle, () => clock);
  assert.ok(session.solved);
  session.scramble(SCRAMBLE);
  assert.ok(!session.solved);
  assert.equal(session.elapsed(), null, 'no time before the first turn');
  clock = 3000;
  const turns = inverse(SCRAMBLE).split(' ');
  assert.equal(session.setMoves(turns.slice(0, 1)), false);
  clock = 5500;
  assert.equal(session.elapsed(), 2500);
  assert.equal(session.setMoves(turns), true, 'the last inverse turn solves it');
  assert.equal(session.count, 6);
  clock = 9000;
  assert.equal(session.elapsed(), 2500, 'the timer stopped at the solve');
  assert.equal(session.scrambled, false);
  assert.equal(session.setMoves([...turns, 'R', "R'"]), false, 'solved again without a scramble is no new solve');
});

test('the session: a whole-cube turn or a slice turned back still counts as solved; one face turn does not', () => {
  const session = new CubeSession(kpuzzle, () => 0);
  session.scramble('R');
  // x turns the whole cube about the R face's axis, so R is still R after it.
  assert.equal(session.setMoves(['x']), false);
  assert.equal(session.setMoves(['x', "R'"]), true);
  session.scramble("M E");
  assert.equal(session.setMoves(["E'", "M'"]), true);
  session.reset();
  assert.equal(session.setMoves(['R', "R'"]), false, 'Reset is no scramble');
});

test('time formats as seconds, then minutes', () => {
  assert.equal(formatTime(0), '0.0');
  assert.equal(formatTime(41234), '41.2');
  assert.equal(formatTime(83456), '1:23.4');
});

test('a random-move scramble never turns the same axis twice in a row', () => {
  const scramble = randomMoveScramble().split(' ');
  assert.equal(scramble.length, 25);
  const axis = (move) => ({ U: 0, D: 0, L: 1, R: 1, F: 2, B: 2 })[move[0]];
  for (let i = 1; i < scramble.length; i++) assert.notEqual(axis(scramble[i]), axis(scramble[i - 1]), scramble.join(' '));
  assert.doesNotThrow(() => kpuzzle.defaultPattern().applyAlg(scramble.join(' ')));
});

/** A stand-in for <twisty-player>: its alg as a list of turns, appended and undone as the player does. */
function fakeCube() {
  const cube = { moves: [], calls: [], listener: null };
  const changed = () => cube.listener([...cube.moves]);
  Object.assign(cube, {
    turn: (move) => { cube.calls.push(['turn', move]); cube.moves.push(move); changed(); },
    undo: () => { cube.calls.push(['undo']); cube.moves.pop(); changed(); },
    scramble: (setup) => { cube.calls.push(['scramble', setup]); cube.moves = []; changed(); },
    reset: () => { cube.calls.push(['reset']); cube.moves = []; changed(); },
    pause: () => cube.calls.push(['pause']),
    onMoves: (listener) => { cube.listener = listener; },
  });
  return cube;
}

function fakeStorage(entries = {}) {
  const map = new Map(Object.entries(entries));
  return { getItem: (key) => (map.has(key) ? map.get(key) : null), setItem: (key, value) => map.set(key, String(value)), map };
}

function openPage({ storage = fakeStorage(), embedded = true } = {}) {
  const win = new Window({ url: 'https://cdn.example/toybox/twisty/index.html' });
  windows.push(win);
  const html = readFileSync(new URL('../src/twisty/index.html', import.meta.url), 'utf8');
  win.document.write(html.replace(/<script[^>]*><\/script>/, ''));
  const cube = fakeCube();
  const host = { posted: [], postMessage(message, origin) { this.posted.push({ message, origin }); } };
  let clock = 0;
  const page = startTwistyPage({ win, doc: win.document, cube, kpuzzle, storage, host: embedded ? host : null, scrambleAlg: () => SCRAMBLE, now: () => clock });
  const doc = win.document;
  return {
    win, doc, cube, host, page, storage,
    tick: (ms) => { clock += ms; },
    text: (selector) => doc.querySelector(selector).textContent,
    key: (key, options = {}) => doc.dispatchEvent(new win.KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...options })),
    button: (move) => doc.querySelector(`button[data-move="${move}"]`),
    message: (data, source = host) => win.dispatchEvent(new win.MessageEvent('message', { data: { toy: TOY, ...data }, source })),
  };
}

test('the page has a ⟳ and a ⟲ button for each face and each "More" turn, with the face named on hover', () => {
  const { doc, button } = openPage();
  const moves = [...doc.querySelectorAll('button[data-move]')].map((node) => node.dataset.move);
  assert.deepEqual(moves, ['U', "U'", 'D', "D'", 'L', "L'", 'R', "R'", 'F', "F'", 'B', "B'", 'x', "x'", 'y', "y'", 'z', "z'", 'M', "M'", 'E', "E'", 'S', "S'"]);
  assert.equal(doc.querySelectorAll('#more button').length, 12);
  assert.equal(button('U').textContent, '⟳');
  assert.equal(button("U'").textContent, '⟲');
  assert.equal(button('U').parentElement.title, 'U: up face');
  assert.match(button("R'").title, /^R: right face, counter-clockwise \(R'\)$/);
});

test('buttons and keys turn the cube, Undo takes the last turn back, and the counter follows', () => {
  const { cube, key, button, text, doc } = openPage();
  button('R').click();
  key('R', { shiftKey: true });
  key('u');
  assert.deepEqual(cube.moves, ['R', "R'", 'U']);
  assert.equal(text('#count'), 'Moves: 3');
  key('z', { ctrlKey: true });
  assert.deepEqual(cube.moves, ['R', "R'"]);
  doc.querySelector('#undo').click();
  assert.deepEqual(cube.moves, ['R']);
  assert.equal(text('#count'), 'Moves: 1');
  key('r', { repeat: true });
  key('q');
  assert.deepEqual(cube.moves, ['R'], 'a held key and an unmapped key turn nothing');
});

test('scramble, then the inverse turns: the timer runs from the first turn, stops at the solve, and "Solved!" shows and goes to the host', () => {
  const { cube, key, text, doc, host, tick, message } = openPage();
  message({ type: 'scramble' });
  assert.deepEqual(cube.calls.at(-1), ['scramble', SCRAMBLE]);
  assert.equal(text('#timer'), '0.0');
  // The scramble backwards, by key: B, L', D twice, F, U', R'.
  const keys = [['b'], ['L', true], ['d'], ['d'], ['f'], ['U', true], ['R', true]];
  for (const [index, [letter, shiftKey]] of keys.entries()) {
    if (index === 1) tick(12300);
    key(letter, { shiftKey });
  }
  assert.deepEqual(cube.moves, ['B', "L'", 'D', 'D', 'F', "U'", "R'"]);
  assert.ok(!doc.querySelector('#solved').hidden, '"Solved!" shows');
  assert.equal(text('#solved'), 'Solved! 7 moves, 12.3 s');
  assert.equal(text('#timer'), '12.3');
  const solved = host.posted.filter((item) => item.message.type === 'solved');
  assert.deepEqual(solved, [{ message: { toy: TOY, type: 'solved', moves: 7, ms: 12300 }, origin: '*' }]);
});

test('Reset and a solve without a scramble do not celebrate', () => {
  const { cube, host, doc, button, message } = openPage();
  message({ type: 'reset' });
  button('R').click();
  button("R'").click();
  assert.deepEqual(cube.moves, ['R', "R'"]);
  assert.ok(doc.querySelector('#solved').hidden);
  assert.deepEqual(host.posted, []);
});

test('the timer can be turned off, and the choice is remembered', () => {
  const storage = fakeStorage();
  const first = openPage({ storage });
  first.doc.querySelector('#timer-on').click();
  assert.ok(first.doc.querySelector('#timer').hidden);
  assert.equal(storage.map.get(TIMER_KEY), 'off');
  const second = openPage({ storage });
  assert.equal(second.doc.querySelector('#timer-on').checked, false);
});

test('the instructions show once by themselves, then on "?", and close on "Got it" or Escape', () => {
  const storage = fakeStorage();
  const first = openPage({ storage });
  const help = () => first.doc.querySelector('#help');
  assert.ok(!help().hidden, 'shown the first time');
  assert.equal(storage.map.get(HELP_SEEN_KEY), '1');
  first.doc.querySelector('#help-close').click();
  assert.ok(help().hidden);
  first.doc.querySelector('#help-button').click();
  assert.ok(!help().hidden, '"?" opens it');
  assert.equal(first.doc.querySelector('#help-button').getAttribute('aria-expanded'), 'true');
  first.key('Escape');
  assert.ok(help().hidden, 'Escape closes it');

  const second = openPage({ storage });
  assert.ok(second.doc.querySelector('#help').hidden, 'not shown by itself a second time');
  const text = first.text('#help');
  for (const words of ['click a sticker', 'right-click', 'Shift', 'Ctrl', "' (prime)", 'up, down, left, right, front and back', 'drag anywhere', 'Undo', 'Scramble', 'Reset']) {
    assert.ok(text.includes(words), `the instructions mention ${words}`);
  }
});

test('postMessage: move and undo from the host turn the cube; another window, another toy or a bad move is refused', () => {
  const { cube, message, page } = openPage();
  message({ type: 'move', move: "R'" });
  message({ type: 'move', move: 'U2' });
  assert.deepEqual(cube.moves, ["R'", 'U2']);
  message({ type: 'undo' });
  assert.deepEqual(cube.moves, ["R'"]);
  message({ type: 'move', move: 'F' }, {});
  assert.deepEqual(cube.moves, ["R'"], 'ignored from a window that is not the host');
  assert.throws(() => page.receive({ type: 'move', move: 'R3 U' }), /not a move this page makes/);
  assert.throws(() => page.receive({ type: 'spin' }), /unknown message spin/);
  message({ type: 'pause' });
  assert.deepEqual(cube.calls.at(-1), ['pause']);
});

test('opened on its own, the page takes no messages and posts none', () => {
  const { cube, message } = openPage({ embedded: false });
  message({ type: 'move', move: 'R' }, null);
  assert.deepEqual(cube.moves, []);
});
