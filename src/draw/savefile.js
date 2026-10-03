// What the drawing elements keep, in the browser and in a saved file, and its checks. One shape
// for both, checked on every read, so a damaged or foreign file fails loud instead of being half
// loaded and then autosaved over the good copy.
//   <draw-layer>:  { strokes: [stroke] }
//   <toy-pages>:   { pages: [{ id, kind: "notes", title, text, strokes } | { id, kind: "drawing", images, strokes }] }
//   <dice-tray save-log>: { log: [entry] } (src/dice/log.js checks each entry)
// A saved file holds them all: { format: "toybox-file", version: 1, page, elements: { key: state },
// extra?: { field: value } }. extra holds the page's own fields (file-hooks.js); a file written
// before it existed has none, and reads as extra {}.

export const FORMAT = 'toybox-file';
export const VERSION = 1;
const TOOLS = ['pen', 'highlighter'];
const COLOR = /^#[0-9a-f]{6}$/i;

function fail(where, what) {
  throw new Error(`${where} ${what}`);
}

function checkString(value, where) {
  if (typeof value !== 'string') fail(where, `must be a string, not ${typeof value}`);
}

function checkImageUrl(value, where) {
  checkString(value, where);
  if (!value.startsWith('data:image/')) fail(where, 'must be an image data URL');
}

export function checkStrokes(strokes, where) {
  if (!Array.isArray(strokes)) fail(where, 'must be a list of strokes');
  strokes.forEach((stroke, i) => {
    const at = `${where}[${i}]`;
    if (!stroke || typeof stroke !== 'object') fail(at, 'must be an object');
    if (!TOOLS.includes(stroke.tool)) fail(`${at}.tool`, `must be "pen" or "highlighter", not ${JSON.stringify(stroke.tool)}`);
    if (typeof stroke.color !== 'string' || !COLOR.test(stroke.color)) fail(`${at}.color`, 'must be a #rrggbb colour');
    if (!(Number.isFinite(stroke.size) && stroke.size > 0)) fail(`${at}.size`, 'must be a positive number');
    if (!Array.isArray(stroke.points) || !stroke.points.length) fail(`${at}.points`, 'must be a list of at least one point');
    const width = stroke.points[0].length;
    stroke.points.forEach((point, j) => {
      if (!Array.isArray(point) || (point.length !== 2 && point.length !== 3) || point.length !== width || !point.every(Number.isFinite)) {
        fail(`${at}.points[${j}]`, "must be [x, y] or [x, y, pressure], like the stroke's first point");
      }
    });
  });
  return strokes;
}

export function checkImages(images, where) {
  if (!Array.isArray(images)) fail(where, 'must be a list of pictures');
  images.forEach((img, i) => {
    const at = `${where}[${i}]`;
    if (!img || typeof img !== 'object') fail(at, 'must be an object');
    checkString(img.id, `${at}.id`);
    checkImageUrl(img.src, `${at}.src`);
    for (const key of ['x', 'y', 'w', 'h']) if (!Number.isFinite(img[key])) fail(`${at}.${key}`, 'must be a number');
  });
  return images;
}

export function checkLayerState(state, where = 'draw-layer') {
  if (!state || typeof state !== 'object') fail(where, 'must be { strokes }');
  checkStrokes(state.strokes, `${where}.strokes`);
  return state;
}

export function checkPagesState(state, where = 'toy-pages') {
  if (!state || typeof state !== 'object' || !Array.isArray(state.pages)) fail(where, 'must be { pages: [...] }');
  const ids = new Set();
  state.pages.forEach((page, i) => {
    const at = `${where}.pages[${i}]`;
    if (!page || typeof page !== 'object') fail(at, 'must be an object');
    checkString(page.id, `${at}.id`);
    if (ids.has(page.id)) fail(`${at}.id`, `"${page.id}" is used twice`);
    ids.add(page.id);
    checkStrokes(page.strokes, `${at}.strokes`);
    if (page.kind === 'notes') {
      checkString(page.title, `${at}.title`);
      checkString(page.text, `${at}.text`);
    } else if (page.kind === 'drawing') {
      checkImages(page.images, `${at}.images`);
    } else {
      fail(`${at}.kind`, `must be "notes" or "drawing", not ${JSON.stringify(page.kind)}`);
    }
  });
  return state;
}

const isPlainObject = (value) => Boolean(value) && typeof value === 'object' && !Array.isArray(value);

/** The text of a saved file holding `elements` ({ key: state }) and the page's `extra` fields for the page at `page`. */
export function toFile(page, elements, extra = {}) {
  if (!isPlainObject(extra)) fail('the file\'s extra fields', 'must be an object');
  const file = { format: FORMAT, version: VERSION, page, elements };
  if (Object.keys(extra).length) file.extra = extra;
  return JSON.stringify(file);
}

/** Reads a saved file back to { page, elements, extra }; the elements' states are checked by their owners. */
export function fromFile(text) {
  let data;
  try {
    data = JSON.parse(text);
  } catch (error) {
    throw new Error(`not a Toybox file: ${error.message}`);
  }
  if (!data || data.format !== FORMAT) throw new Error(`not a Toybox file: format is ${JSON.stringify(data?.format)}, expected "${FORMAT}"`);
  if (data.version !== VERSION) throw new Error(`Toybox file version ${JSON.stringify(data.version)} is not supported; this version reads ${VERSION}`);
  checkString(data.page, 'the file\'s page');
  if (!isPlainObject(data.elements)) fail('the file\'s elements', 'must be an object');
  if ('extra' in data && !isPlainObject(data.extra)) fail('the file\'s extra fields', 'must be an object');
  return { page: data.page, elements: data.elements, extra: data.extra ?? {} };
}

/** A file name from the page's title, keeping letters, digits, spaces, _ and -. */
export function fileName(title) {
  const cleaned = (title ?? '').replace(/[^\p{L}\p{N} _-]+/gu, '').trim().replace(/\s+/g, '-');
  return `${cleaned || 'toybox'}.json`;
}
