// The library's own backgrounds by id, each a definition of the same shape a page passes to
// registerBackground(): { mount(el, api) } returning { setColors, pause, resume, destroy }; each
// reads the pointer and the drag dynamics from api.motion once a frame, and `dynamics` lists
// which of them (MOTIONS in backgrounds.js) it uses.
import aurora from './aurora.js';
import film from './film.js';
import lines from './lines.js';
import plasma from './plasma.js';
import ripples from './ripples.js';
import stars from './stars.js';

export const BUILT_IN_EFFECTS = { lines, aurora, film, plasma, stars, ripples };
