// Twisty cube: cubing.js <twisty-player> (MPL-2.0 or GPL-3.0-or-later, and a few MB with
// three.js) runs on its own page, twisty/index.html, with its source next to it in
// twisty/source.zip; this module only frames it.
import { toyMeta } from '../catalog.js';
import { defineToy } from '../runtime.js';
import { framePage } from './framed-page.js';

const meta = toyMeta('twisty-cube');

export default defineToy(meta, (ctx) => {
  const { send } = framePage(ctx, {
    id: meta.id,
    page: meta.page,
    sourceZip: meta.sourceZip,
    sourceLabel: 'Source code (MPL-2.0), zipped',
    title: 'Twisty cube (cubing.js, on its own page)',
    buttons: [{ label: 'Scramble', type: 'scramble' }],
  });
  return {
    reset: () => send('reset'),
    pause: () => send('pause'),
    resume: () => send('resume'),
  };
});
