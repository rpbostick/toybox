// Where the library's files (the framed toy pages, their source zips, the licence file) are
// served from. Each built entry sets this from its own URL when it loads (dist/toybox.js and
// dist/toys/<id>.js from import.meta.url, dist/toybox.iife.js from its <script> tag), so the
// library works from any host or sub-path. A bundler that moves the files elsewhere can point
// it at wherever dist/ is served with setAssetBase().

let base = null;

/** Sets the URL of the directory holding dist/'s files; a relative URL is an error. */
export function setAssetBase(url) {
  const parsed = new URL(String(url));
  if (!parsed.pathname.endsWith('/')) parsed.pathname += '/';
  base = parsed.href;
}

export function assetBase() {
  if (!base) throw new Error('toybox: the asset base is not set; load dist/toybox.js, or call setAssetBase(url of dist/)');
  return base;
}

/** The absolute URL of a file under dist/, given its path relative to dist/. */
export function assetUrl(path) {
  if (path.startsWith('/') || /^[a-z][a-z0-9+.-]*:/i.test(path)) throw new Error(`toybox: asset path ${path} must be relative to dist/`);
  return new URL(path, assetBase()).href;
}
