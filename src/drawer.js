// Opens one toy at a time in a stage element. Used by <toy-drawer>, its toy windows and
// <toy-box>; kept apart from the elements so the tests can drive it with fake elements.

// hidden() says whether the stage cannot be seen right now (or the toy is held paused for
// another reason, such as a page's running cap); a toy that finishes loading then starts
// paused, as if the tab had been hidden while it ran.
export function createDrawer({ catalog, stage, environment, hidden = () => false, onChange = () => {} }) {
  let current = null; // { id, toy }
  let opening = 0;
  let pausedByUser = false;
  // Held paused from outside (setHidden): kept apart from pausedByUser, so a toy runs only
  // when neither holds it.
  let held = false;

  const notify = () => onChange(state());

  function state() {
    return {
      id: current?.id ?? null,
      running: current ? current.toy.running : false,
      pausedByUser,
    };
  }

  function close() {
    opening += 1;
    if (!current) return;
    const { toy } = current;
    current = null;
    toy.destroy();
    notify();
  }

  async function open(id) {
    const meta = catalog.find((entry) => entry.id === id);
    if (!meta) throw new Error(`no toy ${id}`);
    close();
    const ticket = ++opening;
    const module = await meta.load();
    if (ticket !== opening) return; // another open or a close happened while this one loaded
    // A fresh instance: the module's own object may be open in another drawer or <toy-box>.
    const toy = module.default.create();
    const { theme, reducedMotion } = environment();
    toy.mount(stage, { theme, reducedMotion });
    current = { id, toy };
    pausedByUser = Boolean(reducedMotion);
    held = false;
    if (hidden()) {
      held = true;
      if (toy.running) toy.pause();
    }
    notify();
  }

  // Pause and Play follow what the user asked for, not whether the toy runs this moment: a toy
  // held paused (hidden, or by a page's running cap) is not started by Play until the hold ends.
  function togglePause() {
    if (!current) return;
    if (pausedByUser) {
      pausedByUser = false;
      if (!held) current.toy.resume();
    } else {
      pausedByUser = true;
      if (current.toy.running) current.toy.pause();
    }
    notify();
  }

  function reset() {
    current?.toy.reset();
    notify();
  }

  function setHidden(hidden) {
    if (!current) return;
    if (hidden && !held) {
      held = true;
      if (current.toy.running) current.toy.pause();
    } else if (!hidden && held) {
      held = false;
      if (!pausedByUser) current.toy.resume();
    }
    notify();
  }

  /** Re-mounts the open toy, e.g. after the system theme changes. */
  async function remount() {
    if (!current) return;
    const { id } = current;
    await open(id);
  }

  return { open, close, togglePause, reset, setHidden, remount, state };
}
