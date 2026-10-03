// The page-wide cap on running toy windows. Of the windows that would run (open, not
// minimized, on screen, not paused by the user, the tab shown), only the most recently focused
// `max` run; the others pause until focused again. Every floating <toy-drawer> on a page joins
// the same cap, at the smallest max-running among the drawers that have windows open.

export const DEFAULT_MAX_RUNNING = 4;

/** items: [{ eligible, focusedAt }]; the items the cap pauses (eligible, beyond the newest max). */
export function overCap(items, max) {
  if (!(max >= 0)) throw new Error(`running cap: ${max} is not a number of toys`);
  return new Set(items.filter((item) => item.eligible).sort((a, b) => b.focusedAt - a.focusedAt).slice(max));
}

const caps = new WeakMap();

/**
 * The cap of one document. An owner is { maxRunning(), windows() }, where each window is
 * { focusedAt, eligible(), applyCap(eligible, capped) }; update() works out every window's
 * place and tells it. tick() gives the next focus time.
 */
export function runningCap(doc) {
  let cap = caps.get(doc);
  if (cap) return cap;
  const owners = new Set();
  let clock = 0;
  cap = {
    join(owner) { owners.add(owner); },
    leave(owner) {
      owners.delete(owner);
      cap.update();
    },
    tick: () => ++clock,
    update() {
      const active = [...owners].filter((owner) => owner.windows().length > 0);
      const max = Math.min(...active.map((owner) => owner.maxRunning()));
      const items = active.flatMap((owner) => owner.windows()).map((window) => ({ window, eligible: window.eligible(), focusedAt: window.focusedAt }));
      const capped = overCap(items, max);
      for (const item of items) item.window.applyCap(item.eligible, capped.has(item));
    },
  };
  caps.set(doc, cap);
  return cap;
}
