// A toy that runs on its own page in an <iframe>. The drawer and the page share no code and
// no objects: they talk only through postMessage, with messages { toy, type, ... }. This is
// what keeps GPL and MPL code (ToneMatrix, cubing.js) out of the library's bundle.
//
// The page lives next to the script (assetUrl), which may be on another origin than the page
// that embeds the toy, so commands are posted to the frame's own origin.
import { assetUrl } from '../assets.js';

export function framePage(ctx, { id, page, sourceZip, sourceLabel, title, buttons = [] }) {
  const url = new URL(assetUrl(page));
  url.searchParams.set('theme', ctx.theme);
  const origin = url.origin;
  const frame = ctx.add(ctx.element('iframe', { src: url.href, title, className: 'toy-frame' }));
  frame.setAttribute?.('allow', 'autoplay');
  let ready = false;
  const queue = [];

  function send(type) {
    const message = { toy: id, type };
    if (!ready) {
      queue.push(message);
      return;
    }
    frame.contentWindow?.postMessage(message, origin);
  }

  ctx.listen(ctx.win, 'message', (event) => {
    if (event.source !== frame.contentWindow) return;
    if (event.data?.toy !== id || event.data.type !== 'ready') return;
    ready = true;
    for (const message of queue.splice(0)) frame.contentWindow.postMessage(message, origin);
  });

  ctx.controls([
    ...buttons.map(({ label, type }) => ({ label, onClick: () => send(type) })),
    { href: assetUrl(sourceZip), label: sourceLabel, download: true },
  ]);
  return { frame, send };
}
