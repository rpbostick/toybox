// What dist/dice-box/ holds: dice-box's module and the modules it imports beside it, its physics
// wasm and its one theme, copied from the package by scripts/build.mjs (the 3D dice load them
// on first use). Paths are under the package's dist/ and under dist/dice-box/ alike.
export const DICE_BOX_FILES = [
  'dice-box.es.min.js', 'Dice.min.js', 'world.offscreen.min.js', 'world.onscreen.min.js', 'world.none.min.js',
  'assets/ammo/ammo.wasm.wasm',
  ...['default.json', 'diffuse-dark.png', 'diffuse-light.png', 'normal.png', 'specular.jpg', 'theme.config.json'].map((name) => `assets/themes/default/${name}`),
];
