// The twisty cube page around the player: the move buttons, the keys, Undo, the move counter,
// the timer, the "Solved!" note, the instructions panel and the postMessage API. The player
// itself stays behind `cube` (see main.js), so this runs without cubing.js's 3D code.
//
// Messages from the embedding page: { toy: 'twisty-cube', type: 'scramble' | 'reset' |
// 'pause' | 'resume' | 'undo' } and { toy, type: 'move', move: "R'" }. To it: 'ready', and
// { toy, type: 'solved', moves, ms } when a scrambled cube is solved.
import { FACE_TURNS, MORE_TURNS, keyAction, moveString, randomMoveScramble } from './notation.js';
import { CubeSession, formatTime } from './session.js';

export const TOY = 'twisty-cube';
export const HELP_SEEN_KEY = 'toybox.twisty-cube.help-seen';
export const TIMER_KEY = 'toybox.twisty-cube.timer';
const MOVE_PATTERN = /^[UDLRFBxyzMES]['2]?$/;
const CELEBRATION_MS = 3000;

/**
 * cube: { turn(move), undo(), scramble(setup), reset(), pause(), onMoves(listener) }, where
 * onMoves calls back with the turns the player holds after each change, including turns made by
 * clicking the cube. host: the embedding window, or null opened alone.
 */
export function startTwistyPage({ win, doc, cube, kpuzzle, storage, host, scrambleAlg = randomMoveScramble, now }) {
  const session = new CubeSession(kpuzzle, now);
  const $ = (selector) => {
    const node = doc.querySelector(selector);
    if (!node) throw new Error(`twisty page: no ${selector}`);
    return node;
  };
  const count = $('#count');
  const timer = $('#timer');
  const timerOn = $('#timer-on');
  const solvedNote = $('#solved');
  const help = $('#help');
  let ticking = null;
  let celebration = null;

  function addTurnButtons(container, turns) {
    for (const { family, title } of turns) {
      const group = doc.createElement('span');
      group.className = 'turn';
      group.title = title;
      const name = doc.createElement('b');
      name.textContent = family;
      group.append(name);
      for (const [counterClockwise, symbol, way] of [[false, '⟳', 'clockwise'], [true, '⟲', 'counter-clockwise']]) {
        const move = moveString(family, counterClockwise);
        const button = doc.createElement('button');
        button.type = 'button';
        button.textContent = symbol;
        button.dataset.move = move;
        button.title = `${title}, ${way} (${move})`;
        button.setAttribute('aria-label', `${move}: ${title.split(': ')[1]}, ${way}`);
        button.addEventListener('click', () => turn(move));
        group.append(button);
      }
      container.append(group);
    }
  }
  addTurnButtons($('#faces'), FACE_TURNS);
  addTurnButtons($('#more'), MORE_TURNS);

  function turn(move) {
    if (!MOVE_PATTERN.test(move)) throw new Error(`twisty page: not a move this page makes: ${move}`);
    cube.turn(move);
  }

  function render() {
    count.textContent = `Moves: ${session.count}`;
    const elapsed = session.elapsed();
    timer.hidden = !timerOn.checked;
    timer.textContent = elapsed === null ? (session.scrambled ? '0.0' : '') : formatTime(elapsed);
    const running = timerOn.checked && elapsed !== null && session.scrambled;
    if (running && ticking === null) ticking = win.setInterval(render, 100);
    if (!running && ticking !== null) {
      win.clearInterval(ticking);
      ticking = null;
    }
  }

  function celebrate() {
    const elapsed = session.elapsed();
    solvedNote.textContent = `Solved! ${session.count} moves${timerOn.checked && elapsed !== null ? `, ${formatTime(elapsed)} s` : ''}`;
    solvedNote.hidden = false;
    win.clearTimeout(celebration);
    celebration = win.setTimeout(() => { solvedNote.hidden = true; }, CELEBRATION_MS);
    // Deliberate: '*', as for 'ready': the embedding page may be on any origin, and the
    // message carries only the move count and the time.
    host?.postMessage({ toy: TOY, type: 'solved', moves: session.count, ms: elapsed }, '*');
  }

  cube.onMoves((moves) => {
    if (session.setMoves(moves)) celebrate();
    render();
  });

  function scramble() {
    const setup = scrambleAlg();
    session.scramble(setup);
    solvedNote.hidden = true;
    cube.scramble(setup);
    render();
  }

  function reset() {
    session.reset();
    solvedNote.hidden = true;
    cube.reset();
    render();
  }

  // Focus moves into the panel only when it is asked for: shown on its own at load, it must not
  // take the focus from the page that embeds the toy.
  function showHelp(shown, { focus = false } = {}) {
    help.hidden = !shown;
    $('#help-button').setAttribute('aria-expanded', String(shown));
    if (shown && focus) $('#help-close').focus();
  }

  $('#undo').addEventListener('click', () => cube.undo());
  $('#scramble').addEventListener('click', scramble);
  $('#reset').addEventListener('click', reset);
  $('#help-button').addEventListener('click', () => showHelp(help.hidden, { focus: true }));
  $('#help-close').addEventListener('click', () => showHelp(false));
  timerOn.checked = storage.getItem(TIMER_KEY) !== 'off';
  timerOn.addEventListener('change', () => {
    storage.setItem(TIMER_KEY, timerOn.checked ? 'on' : 'off');
    render();
  });
  // A right-click on a sticker turns it the other way, so the menu stays shut over the cube.
  $('#stage').addEventListener('contextmenu', (event) => event.preventDefault());

  doc.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && !help.hidden) {
      showHelp(false);
      return;
    }
    if (event.repeat || event.target?.closest?.('input, textarea, select')) return;
    const action = keyAction(event);
    if (!action) return;
    event.preventDefault();
    if (action.undo) cube.undo();
    else turn(action.move);
  });

  function receive(data) {
    switch (data.type) {
      case 'scramble': scramble(); break;
      case 'reset': reset(); break;
      case 'pause': cube.pause(); break;
      case 'resume': break; // nothing runs on its own: turns animate only while they play
      case 'move': turn(data.move); break;
      case 'undo': cube.undo(); break;
      default: throw new Error(`twisty page: unknown message ${data.type}`);
    }
  }
  win.addEventListener('message', (event) => {
    if (!host || event.source !== host || event.data?.toy !== TOY) return;
    receive(event.data);
  });

  if (storage.getItem(HELP_SEEN_KEY) === null) {
    storage.setItem(HELP_SEEN_KEY, '1');
    showHelp(true);
  }
  render();
  return { session, receive };
}
