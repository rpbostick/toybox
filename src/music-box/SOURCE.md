# Music box page: corresponding source

The music box page (`index.html`, `bridge.js`, `app/`) is a build of ToneMatrix Redux by
Wolfy (lupine-dev), <https://github.com/lupine-dev/ToneMatrixRedux>, licensed GPL-3.0 (see
`LICENSE`). The page as a whole is GPL-3.0.

`source.zip` holds everything needed to rebuild it:

- `upstream/`: ToneMatrix Redux at the commit named in `build.sh`, unmodified (it includes
  Tone.js and clipboard.js in `lib/`, under their own MIT licences; see `LICENSES.txt`).
- `page/index.html` and `page/bridge.js`: the page around it. Changes from upstream
  `src/index.html` are listed at the top of `page/index.html`: no analytics, canonical link,
  favicons, web font or URL rewrite, the share box hidden, the canvas sized to its frame, and
  ToneMatrix started only after a click, with pause, resume and clear taken from the
  embedding page by `postMessage`.
- `build/`: `build.sh` and the Node scripts it runs. The music box part concatenates
  upstream `lib/*.js` and `src/*.js` (as upstream's gulpfile does), minifies the result with
  esbuild, and compiles `src/style.scss` with sass.
