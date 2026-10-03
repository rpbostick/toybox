// The dice tray's implementation, a chunk of its own (see src/elements/dice-tray.js): the window,
// the results log, the roller, the pool the die buttons build, the dN field, the notation box,
// the settings popup and sound. Rolls run one after another; each is parsed by notation.js,
// thrown in 2D or 3D, totalled by notation.js and written to the log.
import { assetUrl } from '../assets.js';
import { pageKey, remembered } from '../elements/remembered.js';
import { bandFor, bandNames } from './bands.js';
import { checkEntry, clock, entryFor, entryText } from './log.js';
import { MAX_SIDES, MIN_SIDES, parseNotation, rollPlan } from './notation.js';
import * as Rolls from './rolls.js';
import * as Dice2D from './roller2d.js';
import * as Dice3D from './roller3d.js';
import * as Settings from './settings.js';
import { clatter } from './sound.js';
import { TRAY_CSS } from './styles.js';
import { attach } from './tray-window.js';

// How many entries the log keeps; older ones scroll away.
const LOG_LIMIT = 500;

const LABELS = {
  mode: '3D dice (loads on first use)', quick: 'Quick roll (no tumbling)', dieColor: '2D die colour', pipColor: '2D pip colour',
  pipStyle: '2D d6 faces', theme3d: '3D theme', color3d: '3D die colour', sound: 'Sound', throwForce: '3D throw strength', scale3d: '3D dice size',
};

const TEMPLATE = `
  <section class="tray" part="tray" aria-label="Dice tray" hidden>
    <header class="bar" part="bar" tabindex="-1">
      <h2>Dice</h2>
      <button type="button" class="btn settings-open" title="Dice settings" aria-label="Dice settings">⚙</button>
      <button type="button" class="btn minimize">–</button>
      <button type="button" class="btn close" title="Close the dice tray" aria-label="Close the dice tray">×</button>
    </header>
    <div class="body">
      <ol class="log" part="log" aria-live="polite" aria-label="Rolls"></ol>
      <div class="logbar"><button type="button" class="btn clear-log">Clear log</button></div>
      <div class="stage" part="stage" data-showing="2d"><div class="stage2d"></div><slot name="stage3d"></slot></div>
      <div class="pool" part="pool">
        <output class="pool-text" aria-live="polite"></output>
        <button type="button" class="btn roll-pool" disabled>Roll</button>
        <button type="button" class="btn clear-pool" disabled>Clear</button>
      </div>
      <div class="buttons" part="buttons"></div>
      <div class="modifier">
        <span>Modifier</span>
        <button type="button" class="btn mod-down" aria-label="Modifier down">−</button>
        <button type="button" class="btn value" title="Reset the modifier">+0</button>
        <button type="button" class="btn mod-up" aria-label="Modifier up">+</button>
      </div>
      <form class="dn" hidden>
        <label class="check">Sides <input class="field" type="number" min="${MIN_SIDES}" max="${MAX_SIDES}" step="1" value="7" required></label>
        <button type="submit" class="btn">Add die</button>
      </form>
      <form class="notation">
        <input class="field" type="text" placeholder="2d6+1d8+3, 4d6kh3" aria-label="Dice notation" spellcheck="false" autocomplete="off">
        <button type="submit" class="btn">Roll</button>
      </form>
    </div>
    <div class="grip" part="resize-handle" title="Resize"></div>
  </section>
  <button type="button" class="btn launcher" part="launcher" hidden>🎲 Dice</button>
  <dialog class="settings" part="settings">
    <form method="dialog">
      <h3>Dice settings</h3>
      <div class="fields"></div>
      <div class="actions"><button class="btn" value="close">Done</button></div>
    </form>
  </dialog>`;

let stageCount = 0;

function settingControl(doc, key) {
  const field = Settings.FIELDS[key];
  const label = doc.createElement('label');
  label.append(LABELS[key]);
  let control;
  if (key === 'mode') {
    control = Object.assign(doc.createElement('input'), { type: 'checkbox' });
  } else if (field.choices) {
    control = doc.createElement('select');
    for (const [value, text] of field.choices) control.append(Object.assign(doc.createElement('option'), { value, textContent: text }));
  } else {
    control = Object.assign(doc.createElement('input'), { type: field.type === 'boolean' ? 'checkbox' : field.type });
    if (field.type === 'range') Object.assign(control, { min: field.min, max: field.max, step: field.step });
  }
  control.dataset.setting = key;
  label.append(control);
  return label;
}

export function mount(host, wrapper) {
  const doc = host.ownerDocument;
  const win = doc.defaultView;
  wrapper.querySelector('style').textContent = TRAY_CSS;
  wrapper.insertAdjacentHTML('beforeend', TEMPLATE);
  const find = (selector) => wrapper.querySelector(selector);
  const abort = new AbortController();
  const on = (target, type, handler) => target.addEventListener(type, handler, { signal: abort.signal });
  const tray = find('.tray');
  const log = find('.log');
  const stage = find('.stage');
  const stage2d = find('.stage2d');
  const launcher = find('.launcher');
  const dialog = find('dialog.settings');

  // dice-box looks its container up with document.querySelector, so the 3D stage is a child of
  // the element in the page's own DOM, shown in the tray through the stage3d slot.
  const stage3d = doc.createElement('div');
  stage3d.slot = 'stage3d';
  stage3d.id = `toybox-dice-3d-${++stageCount}`;
  stage3d.style.cssText = 'position:absolute;inset:0';
  stage3d.hidden = true;
  host.append(stage3d);

  // ---- the window ----
  const side = () => host.side;
  const trayWindow = attach({
    win,
    store: remembered(win, `dice-tray.window.${pageKey(win, host.id || 'dice-tray')}`),
    side: side(),
    els: { tray, bar: find('.bar'), grip: find('.grip'), minimize: find('.minimize'), close: find('.close'), open: launcher },
  });
  const showLauncherSide = () => { launcher.className = `btn launcher ${side()}`; };
  showLauncherSide();
  // The CSS resize corner is the fallback to the handle; whatever size it gives is kept too.
  const resizeObserver = new win.ResizeObserver(() => {
    if (tray.offsetWidth && tray.offsetHeight) trayWindow.resized(tray.offsetWidth, tray.offsetHeight);
  });
  resizeObserver.observe(tray);

  // ---- settings ----
  const reducedMotion = win.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const settingsStore = remembered(win, 'dice-tray.settings');
  let settings = Settings.parse(settingsStore.read(), reducedMotion);
  const fields = find('.fields');
  for (const key of Object.keys(Settings.FIELDS)) fields.append(settingControl(doc, key));
  const controls = [...fields.querySelectorAll('[data-setting]')];
  const controlValue = (control) => {
    const key = control.dataset.setting;
    if (key === 'mode') return control.checked ? '3d' : '2d';
    if (control.type === 'checkbox') return control.checked;
    return Settings.FIELDS[key].type === 'range' ? Number(control.value) : control.value;
  };
  function showSettings() {
    for (const control of controls) {
      const value = settings[control.dataset.setting];
      if (control.dataset.setting === 'mode') control.checked = value === '3d';
      else if (control.type === 'checkbox') control.checked = value;
      else control.value = String(value);
    }
    stage2d.style.setProperty('--die-color', settings.dieColor);
    stage2d.style.setProperty('--pip-color', settings.pipColor);
  }
  function changeSetting(key, value) {
    settings = Settings.withSetting(settings, key, value);
    settingsStore.write(JSON.stringify(settings));
    showSettings();
    const box = modes.box();
    if (box && key !== 'mode') box.update(settings).catch((err) => addNote(`3D dice settings: ${err.message}`));
  }
  on(fields, 'change', (event) => {
    const key = event.target.dataset.setting;
    if (!key) return;
    const value = controlValue(event.target);
    if (key === 'mode') switchMode(value);
    else changeSetting(key, value);
  });
  on(find('.settings-open'), 'click', () => {
    showSettings();
    dialog.showModal();
  });

  // ---- the log ----
  const entries = [];
  const span = (className, text) => Object.assign(doc.createElement('span'), { className, textContent: text });
  function append(item) {
    log.append(item);
    while (log.children.length > LOG_LIMIT) log.firstElementChild.remove();
    log.scrollTop = log.scrollHeight;
  }
  function showEntry(entry) {
    const item = doc.createElement('li');
    item.setAttribute('aria-label', entryText(entry));
    const faces = span('faces', '');
    for (const face of entry.faces) faces.append(span(face.dropped ? 'f dropped' : 'f', face.face));
    item.append(span('time', entry.time), span('what', entry.what), faces);
    if (entry.groups) item.append(span('groups', entry.groups));
    item.append(span('total', `= ${entry.total}`));
    if (entry.band) item.append(span(`band band-${entry.band.toLowerCase().replace(/\s+/g, '-')}`, entry.band));
    append(item);
  }
  function addEntry(entry) {
    entries.push(entry);
    if (entries.length > LOG_LIMIT) entries.shift();
    showEntry(entry);
  }
  function addNote(text) {
    const item = doc.createElement('li');
    item.className = 'note';
    item.append(span('time', clock(new Date())), span('what', text));
    append(item);
  }
  function clearLog() {
    entries.length = 0;
    log.replaceChildren();
  }
  on(find('.clear-log'), 'click', clearLog);

  // ---- 2D and 3D ----
  const modes = Dice3D.createModeSwitch({
    load3d: async () => {
      stage3d.hidden = false;
      const box = await Dice3D.load({ importModule: (url) => import(url), base: assetUrl('dice-box/'), container: stage3d, settings });
      for (const canvas of stage3d.querySelectorAll('canvas')) canvas.style.cssText = 'width:100%;height:100%;display:block';
      return box;
    },
    report: (err) => addNote(`3D dice could not load here (${err.message}); rolling 2D dice.`),
  });
  async function switchMode(next) {
    const mode = await modes.set(next);
    stage3d.hidden = mode !== '3d';
    stage.dataset.showing = mode;
    // A failed 3D load leaves the 3D box unchecked again.
    if (mode !== settings.mode) changeSetting('mode', mode);
    else showSettings();
  }

  // ---- rolling ----
  let queue = Promise.resolve();
  async function perform(roll, bands) {
    if (bands !== undefined && !bandNames().includes(bands)) throw new Error(`no band set "${bands}"; the sets are ${bandNames().join(', ')}`);
    const plan = parseNotation(roll.notation);
    const box = modes.box();
    const in3d = Boolean(box) && Dice3D.throwable(plan);
    if (box && !in3d) addNote(`${roll.notation} has a die with no 3D model; rolled in 2D.`);
    stage.dataset.showing = in3d ? '3d' : '2d';
    const values = in3d ? await box.roll(plan, { quick: settings.quick }) : rollPlan(plan);
    const result = Rolls.resultFor(roll, plan, values);
    const band = bandFor(bands, result.total, result);
    if (!in3d) await Dice2D.draw(stage2d, result.dice, { pipStyle: settings.pipStyle, animate: !settings.quick, win });
    if (settings.sound) clatter(win, result.dice.length);
    const entry = entryFor(result, band, new Date());
    addEntry(entry);
    const done = { ...result, band, entry };
    host.dispatchEvent(new win.CustomEvent('roll', { detail: done, bubbles: true, composed: true }));
    return done;
  }
  /** Queues a roll; makeRoll may throw (bad notation), which is logged and rejected. */
  function rollInto(makeRoll, bands) {
    trayWindow.reveal();
    const next = queue.then(() => perform(makeRoll(), bands));
    queue = next.catch((err) => addNote(err.message));
    return next;
  }

  // ---- the pool ----
  let pool = Rolls.emptyPool();
  const poolText = find('.pool-text');
  const modValue = find('.modifier .value');
  function showPool() {
    poolText.textContent = Rolls.poolText(pool);
    find('.roll-pool').disabled = Rolls.poolIsEmpty(pool);
    find('.clear-pool').disabled = Rolls.poolIsEmpty(pool) && pool.modifier === 0;
    modValue.textContent = pool.modifier < 0 ? `−${-pool.modifier}` : `+${pool.modifier}`;
    modValue.classList.toggle('set', pool.modifier !== 0);
    modValue.setAttribute('aria-label', `Modifier: ${modValue.textContent}. Click to reset.`);
  }
  function addToPool(sides) {
    try {
      pool = Rolls.addDie(pool, sides);
    } catch (err) {
      addNote(err.message);
    }
    showPool();
  }
  const buttons = find('.buttons');
  for (const sides of Rolls.BUTTON_SIDES) {
    buttons.append(Object.assign(doc.createElement('button'), { type: 'button', className: 'btn', textContent: `d${sides}`, title: `Add a d${sides} to the pool` }));
    buttons.lastElementChild.dataset.die = String(sides);
  }
  const dnButton = Object.assign(doc.createElement('button'), { type: 'button', className: 'btn dn-open', textContent: 'dN', title: 'A die with any number of sides' });
  dnButton.setAttribute('aria-expanded', 'false');
  buttons.append(dnButton);
  on(buttons, 'click', (event) => {
    const button = event.target.closest('button');
    if (!button) return;
    if (button === dnButton) {
      const form = find('.dn');
      form.hidden = !form.hidden;
      dnButton.setAttribute('aria-expanded', String(!form.hidden));
      if (!form.hidden) form.querySelector('input').focus();
      return;
    }
    addToPool(Number(button.dataset.die));
  });
  on(find('.dn'), 'submit', (event) => {
    event.preventDefault();
    const input = event.target.querySelector('input');
    const sides = Number(input.value);
    if (!Number.isInteger(sides) || sides < MIN_SIDES || sides > MAX_SIDES) {
      addNote(`a die has ${MIN_SIDES} to ${MAX_SIDES} sides, not ${input.value || 'none'}`);
      return;
    }
    addToPool(sides);
  });
  on(find('.mod-down'), 'click', () => { pool = Rolls.withPoolModifier(pool, pool.modifier - 1); showPool(); });
  on(find('.mod-up'), 'click', () => { pool = Rolls.withPoolModifier(pool, pool.modifier + 1); showPool(); });
  on(modValue, 'click', () => { pool = Rolls.withPoolModifier(pool, 0); showPool(); });
  on(find('.clear-pool'), 'click', () => { pool = Rolls.emptyPool(); showPool(); });
  on(find('.roll-pool'), 'click', () => {
    const rolling = pool;
    pool = Rolls.emptyPool();
    showPool();
    rollInto(() => Rolls.poolRoll(rolling)).catch(() => {}); // logged by rollInto
  });
  on(find('.notation'), 'submit', (event) => {
    event.preventDefault();
    const input = event.target.querySelector('input');
    rollInto(() => Rolls.notationRoll(input.value)).catch(() => {}); // logged by rollInto
  });
  showPool();
  showSettings();
  if (settings.mode === '3d') switchMode('3d');

  return {
    roll(notation, { label, bands } = {}) {
      return rollInto(() => Rolls.notationRoll(notation, label), bands);
    },
    open: () => trayWindow.open(),
    close: () => trayWindow.close(),
    clearLog,
    log: () => entries.map((entry) => structuredClone(entry)),
    /** For a saved file: the log, when the element has save-log; otherwise nothing. */
    saveState: () => (host.hasAttribute('save-log') ? { log: entries.map((entry) => structuredClone(entry)) } : null),
    loadState(state) {
      if (state === null) return;
      if (!state || !Array.isArray(state.log)) throw new Error('dice tray: the saved state must be { log: [entries] }');
      const checked = state.log.map((entry, i) => checkEntry(entry, `dice tray log[${i}]`));
      clearLog();
      checked.forEach(addEntry);
    },
    /** For tests: the pool as the buttons have built it, and the window's state. */
    pool: () => structuredClone(pool),
    windowState: () => trayWindow.state(),
    attributeChanged(name) {
      if (name === 'side') {
        trayWindow.setSide(side());
        showLauncherSide();
      }
    },
    destroy() {
      abort.abort();
      trayWindow.detach();
      resizeObserver.disconnect();
      stage3d.remove();
      wrapper.querySelectorAll('.tray, .launcher, dialog').forEach((node) => node.remove());
    },
  };
}
