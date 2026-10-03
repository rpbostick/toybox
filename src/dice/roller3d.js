// 3D dice: Fantastic Dice (@3d-dice/dice-box). Its module, physics worker, wasm and theme are
// files of their own in dist/dice-box/ (copied there by the build), imported only when 3D is
// switched on, from next to the library's script. A roll with a die dice-box has no model for
// (anything but d4, d6, d8, d10, d12, d20 and d100) is thrown in 2D instead.
import { diceTerms, readD100 } from './notation.js';

/** The file the build copies from the package; it imports its world and Dice modules beside it. */
export const ENTRY = 'dice-box.es.min.js';
export const SIDES_3D = [4, 6, 8, 10, 12, 20, 100];

const boxConfig = (settings) => ({ theme: settings.theme3d, themeColor: settings.color3d, scale: settings.scale3d, throwForce: settings.throwForce });

/** Whether every die of the plan has a 3D model. */
export const throwable = (plan) => diceTerms(plan).every((term) => SIDES_3D.includes(term.sides));

/**
 * base: the URL of dist/dice-box/. importModule: the dynamic import, passed in so tests can
 * stand in for it. container: an element in the page's own DOM (not a shadow root), with an
 * id, since dice-box finds it with document.querySelector.
 */
export async function load({ importModule, base, container, settings }) {
  const entry = new URL(ENTRY, base);
  const module = await importModule(entry.href);
  const DiceBox = module && module.default;
  if (typeof DiceBox !== 'function') throw new Error(`${entry.href} did not export the DiceBox class`);
  if (!container.id) throw new Error("the 3D dice container needs an id for dice-box's selector");
  const box = new DiceBox({
    container: `#${container.id}`,
    // dice-box fetches origin + assetPath + "themes/…" and "ammo/…".
    origin: entry.origin,
    assetPath: new URL('assets/', entry).pathname,
    ...boxConfig(settings),
  });
  await box.init();
  return {
    async update(next) {
      await box.updateConfig(boxConfig(next));
    },
    /**
     * Faces per dice term of the plan, in plan order; quick skips the physics. dice-box throws a
     * d100 as a tens and a ones d10, read back into one value 1-100.
     */
    async roll(plan, { quick }) {
      if (!throwable(plan)) throw new Error('this roll has a die with no 3D model');
      await box.updateConfig({ suspendSimulation: quick });
      const terms = diceTerms(plan);
      const groups = terms.map((term) => (term.sides === 100 ? { qty: term.qty * 2, sides: 10 } : { qty: term.qty, sides: term.sides }));
      const rolls = await box.roll(groups);
      return terms.map((term, groupId) => {
        const values = rolls.filter((roll) => roll.groupId === groupId).map((roll) => roll.value);
        if (term.sides !== 100) return values;
        return Array.from({ length: term.qty }, (_, i) => readD100(values[2 * i], values[2 * i + 1]).value);
      });
    },
    show() { box.show(); },
    hide() { box.clear(); box.hide(); },
  };
}

/**
 * The 2D/3D switch. load3d runs on the first switch to 3D only (a second switch while it loads
 * waits for the same load), and again after a failure; report receives the error of a failed
 * load, after which the dice stay 2D. Switching back to 2D while 3D loads wins.
 */
export function createModeSwitch({ load3d, report }) {
  let mode = '2d';
  let wanted = '2d';
  let loading = null;
  let box = null;
  async function set(next) {
    if (next !== '2d' && next !== '3d') throw new Error(`unknown dice mode ${next}`);
    wanted = next;
    if (next === '2d') {
      if (box) box.hide();
      mode = '2d';
      return mode;
    }
    loading = loading || load3d();
    try {
      box = await loading;
    } catch (err) {
      loading = null;
      if (wanted === '3d') report(err);
      wanted = mode = '2d';
      return mode;
    }
    if (wanted !== '3d') return mode;
    box.show();
    mode = '3d';
    return mode;
  }
  return { set, mode: () => mode, box: () => (mode === '3d' ? box : null) };
}
