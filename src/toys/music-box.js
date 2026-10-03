// Music box: ToneMatrix Redux (GPL-3.0) runs on its own page, music-box/index.html, with its
// corresponding source next to it in music-box/source.zip; this module only frames it.
import { toyMeta } from '../catalog.js';
import { defineToy } from '../runtime.js';
import { framePage } from './framed-page.js';

const meta = toyMeta('music-box');

export default defineToy(meta, (ctx) => {
  const { send } = framePage(ctx, {
    id: meta.id,
    page: meta.page,
    sourceZip: meta.sourceZip,
    sourceLabel: 'Source code (GPL-3.0), zipped',
    title: 'Music box (ToneMatrix Redux, on its own page)',
  });
  return {
    reset: () => send('reset'),
    pause: () => send('pause'),
    resume: () => send('resume'),
  };
});
