// What a page calls on the library besides its elements. Each loads its chunk on first use, from
// next to the script, like the elements do.

/**
 * Opens the image editor on any image box (an <img>, or any element, which gets a background
 * image). Resolves to null for Cancel, or { src, images, strokes } once Done has drawn into it.
 */
export async function editImage(element, options) {
  return (await import('./draw/image-editor.js')).editImage(element, options);
}

/** Downloads one JSON file of everything the page's Toybox elements keep; resolves to its name. */
export async function saveFile(doc = globalThis.document) {
  return (await import('./draw/file.js')).saveFile(doc);
}

/** Loads a file Save file wrote (a File or Blob) into the page's elements; resolves to the keys loaded. */
export async function openFile(file, doc = globalThis.document) {
  return (await import('./draw/file.js')).openFile(doc, file);
}

export { registerBands } from './dice/bands.js';
export { onOpenFile, onSaveFile } from './draw/file-hooks.js';
