// dist/ is a build product, not in git: the tests that read it skip with this message until
// `bash build.sh` has run, rather than failing on a missing file.
import { existsSync } from 'node:fs';

const BUILT = ['toybox.js', 'toybox.iife.js', 'toybox-all.iife.js', 'THIRD_PARTY_LICENSES.txt', 'bundled-packages.json'];

/** false when dist/ is built; otherwise the reason to skip, for node:test's `skip`. */
export const distMissing = BUILT.every((file) => existsSync(new URL(`../dist/${file}`, import.meta.url)))
  ? false : 'dist/ is not built (it is not in git): run npm ci, then bash build.sh';
