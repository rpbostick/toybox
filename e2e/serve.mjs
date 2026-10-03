// Serves dist/ under a sub-path, as a site that hosts the library somewhere other than its root
// would. Used by tests/subpath.test.js and tests/e2e.test.js; by hand:
//   node e2e/serve.mjs [port] [prefix]      (default: 8797 /toys/v1/)
// then open http://127.0.0.1:8797/toys/v1/index.html.
import { createReadStream, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, normalize, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const DIST = fileURLToPath(new URL('../dist/', import.meta.url));
const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml', '.txt': 'text/plain; charset=utf-8', '.md': 'text/plain; charset=utf-8',
  '.json': 'application/json', '.zip': 'application/zip', '': 'text/plain; charset=utf-8',
  '.wasm': 'application/wasm', '.png': 'image/png', '.jpg': 'image/jpeg',
};

/** Starts a server for dist/ at http://127.0.0.1:<port><prefix>; resolves to { url, close }. */
export function serveDist({ prefix = '/toys/v1/', port = 0 } = {}) {
  if (!prefix.startsWith('/') || !prefix.endsWith('/')) throw new Error(`prefix ${prefix} must start and end with /`);
  const server = createServer((request, response) => {
    const path = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
    if (!path.startsWith(prefix)) return send(response, 404);
    const file = normalize(join(DIST, path.slice(prefix.length) || 'index.html'));
    if (!file.startsWith(DIST.endsWith(sep) ? DIST : DIST + sep)) return send(response, 403);
    let stats;
    try {
      stats = statSync(file);
    } catch {
      return send(response, 404);
    }
    if (!stats.isFile()) return send(response, 404);
    const type = TYPES[extname(file)];
    if (!type) throw new Error(`serve.mjs: no content type for ${file}`);
    response.writeHead(200, { 'content-type': type, 'content-length': stats.size, 'access-control-allow-origin': '*' });
    createReadStream(file).pipe(response);
  });
  return new Promise((resolve) => {
    server.listen(port, '127.0.0.1', () => {
      const url = `http://127.0.0.1:${server.address().port}${prefix}`;
      resolve({ url, close: () => new Promise((done) => server.close(done)) });
    });
  });
}

function send(response, status) {
  response.writeHead(status, { 'content-type': 'text/plain' });
  response.end(String(status));
}

if (process.argv[1] && fileURLToPath(import.meta.url) === normalize(process.argv[1])) {
  const [port = '8797', prefix = '/toys/v1/'] = process.argv.slice(2);
  const { url } = await serveDist({ port: Number(port), prefix });
  console.log(`serving dist/ at ${url}index.html`);
}
