# Twisty cube page: corresponding source

The twisty cube page (`index.html`, `app/`) bundles cubing.js by the cubing.js contributors,
<https://github.com/cubing/cubing.js>, licensed MPL-2.0 or GPL-3.0-or-later (see
`LICENSES.txt`), with three.js (MIT) and the other packages listed there.

`source.zip` holds everything needed to rebuild it:

- `upstream/`: cubing.js at the tag of the npm version bundled (named in
  `build/package-lock.json`), unmodified.
- `page/`: the page around it. `main.js` makes a 3×3×3 `<twisty-player>` that turns a layer
  when a sticker is clicked; `page.js` adds the move buttons, keys, Undo, move counter, timer,
  "Solved!" note, instructions panel and the `postMessage` API (scramble, reset, pause, move,
  undo; solved back to the embedding page); `notation.js` holds the moves, keys and the
  random-move scramble; `session.js` the move count, timer and solved check (cubing.js's
  KPuzzle).
- `build/`: `build.sh` and the Node scripts it runs. The twisty part bundles `page/main.js`
  with esbuild from the npm packages in `build/package-lock.json`.
