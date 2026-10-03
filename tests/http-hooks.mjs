// Node module hooks that import ES modules over http://, as a browser would, so a test can load
// the built library from a server and see the import.meta.url a page would give it.
// Registered with module.register() by tests/subpath.test.js.

export async function resolve(specifier, context, next) {
  if (/^https?:\/\//.test(specifier)) return { url: specifier, shortCircuit: true };
  if (context.parentURL?.startsWith('http') && /^\.{0,2}\//.test(specifier)) {
    return { url: new URL(specifier, context.parentURL).href, shortCircuit: true };
  }
  return next(specifier, context);
}

export async function load(url, context, next) {
  if (!url.startsWith('http')) return next(url, context);
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${url}: HTTP ${response.status}`);
  return { format: 'module', source: await response.text(), shortCircuit: true };
}
