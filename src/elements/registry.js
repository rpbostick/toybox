// Every element the library defines, in one list: the toy elements, then those with a `load`,
// which keep their code in a chunk of their own (lazy.js), imported from next to the script the
// first time one connects, so defining them costs toybox.js only their small classes.
import { defineFrom } from './define.js';
import { diceTrayClass } from './dice-tray.js';
import { drawLayerClass } from './draw-layer.js';
import { toyBackgroundClass } from './toy-background.js';
import { TOY_ELEMENTS } from './toy-elements.js';
import { toyPagesClass } from './toy-pages.js';

export const ELEMENTS = [
  ...TOY_ELEMENTS,
  { tag: 'dice-tray', make: diceTrayClass, load: () => import('../dice/tray.js') },
  { tag: 'toy-background', make: toyBackgroundClass, load: () => import('../background/background.js') },
  { tag: 'draw-layer', make: drawLayerClass, load: () => import('../draw/layer.js') },
  { tag: 'toy-pages', make: toyPagesClass, load: () => import('../draw/pages.js') },
];

/**
 * Defines every element in a window's registry; returns the tags it defined just now. loaders
 * replaces an element's chunk by tag (a test's stand-in for the background's view, say).
 */
export const defineElements = (options) => defineFrom(ELEMENTS, options);
