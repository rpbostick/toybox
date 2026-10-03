// A display preference remembered per browser in localStorage, under a "toybox." key.
//
// Deliberate: a browser that refuses storage (private windows, some file:// pages) keeps the
// defaults and this visit's changes only; a display preference is not worth an error. Data a
// user made (strokes, pages) does not go through here; it is kept in IndexedDB and fails loud.

export function remembered(win, key) {
  const full = `toybox.${key}`;
  return {
    read() {
      try {
        return win.localStorage.getItem(full);
      } catch {
        return null;
      }
    },
    write(text) {
      try {
        win.localStorage.setItem(full, text);
      } catch {
        // this visit only
      }
    },
  };
}

/** A remembered choice among `allowed` strings; anything else reads as `fallback`. */
export function rememberedChoice(win, key, allowed, fallback) {
  const store = remembered(win, key);
  return {
    read() {
      const value = store.read();
      return allowed.includes(value) ? value : fallback;
    },
    write(value) {
      if (!allowed.includes(value)) throw new Error(`${key}: ${JSON.stringify(value)} is not one of ${allowed.join(', ')}`);
      store.write(value);
    },
  };
}

/** The page a remembered layout belongs to: its path, so two pages of one site keep their own. */
export const pageKey = (win, id) => `${win.location.pathname}#${id}`;
