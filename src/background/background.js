// The chunk <toy-background> loads: its implementation with the view that draws the backgrounds.
import { mountBackground } from './element.js';
import { mountView } from './view.js';

export const mount = (host, wrapper) => mountBackground(host, wrapper, { mountView });
