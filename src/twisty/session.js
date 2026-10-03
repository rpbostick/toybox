// One go at the cube: the scramble it started from, the turns made since, the move count, the
// timer, and whether it is solved. The cube's state comes from cubing.js's KPuzzle (passed
// in), never from a cube model of our own.

// Deliberate: a cube turned whole (x, y, z) or with its centres turned in place still counts
// as solved; only the colours on each face matter.
const SOLVED_OPTIONS = { ignorePuzzleOrientation: true, ignoreCenterOrientation: true };

export class CubeSession {
  #kpuzzle;
  #now;
  #setup = '';
  #moves = [];
  #scrambled = false;
  #startedAt = null;
  #stoppedAt = null;

  constructor(kpuzzle, now = () => performance.now()) {
    this.#kpuzzle = kpuzzle;
    this.#now = now;
  }

  scramble(setup) {
    this.#begin(setup);
    this.#scrambled = true;
  }

  reset() {
    this.#begin('');
  }

  #begin(setup) {
    this.#setup = setup;
    this.#moves = [];
    this.#scrambled = false;
    this.#startedAt = null;
    this.#stoppedAt = null;
  }

  /**
   * The turns made since the scramble, as the player now holds them (a turn made by clicking
   * the cube arrives here as well as one from a button or key). Returns true when this is the
   * turn that solved a scrambled cube; the timer stops there.
   */
  setMoves(moves) {
    this.#moves = [...moves];
    if (this.#scrambled && this.#startedAt === null && moves.length > 0) this.#startedAt = this.#now();
    if (!this.#scrambled || !this.solved) return false;
    this.#scrambled = false;
    this.#stoppedAt = this.#now();
    return true;
  }

  get moves() {
    return [...this.#moves];
  }

  get count() {
    return this.#moves.length;
  }

  /** True between a scramble and the turn that solves it. */
  get scrambled() {
    return this.#scrambled;
  }

  get solved() {
    return this.#kpuzzle.defaultPattern().applyAlg(this.#setup).applyAlg(this.#moves.join(' ')).experimentalIsSolved(SOLVED_OPTIONS);
  }

  /** Milliseconds from the first turn after the scramble to the solve (or to now), or null before that turn. */
  elapsed() {
    if (this.#startedAt === null) return null;
    return (this.#stoppedAt ?? this.#now()) - this.#startedAt;
  }
}

export function formatTime(ms) {
  const tenths = Math.floor(ms / 100);
  const minutes = Math.floor(tenths / 600);
  const seconds = ((tenths % 600) / 10).toFixed(1);
  return minutes > 0 ? `${minutes}:${seconds.padStart(4, '0')}` : seconds;
}
