// The toy elements alone, <toy-drawer> and <toy-box>: what dist/toybox.iife.js defines. Kept apart
// from registry.js so a bundle of this list holds none of the other elements' chunks.
import { defineFrom } from './define.js';
import { toyBoxClass } from './toy-box.js';
import { toyDrawerClass } from './toy-drawer.js';

export const TOY_ELEMENTS = [
  { tag: 'toy-drawer', make: toyDrawerClass },
  { tag: 'toy-box', make: toyBoxClass },
];

export const defineToyElements = (options) => defineFrom(TOY_ELEMENTS, options);
