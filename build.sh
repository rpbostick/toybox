#!/usr/bin/env bash
# Rebuilds dist/ from source, zips the framed pages' corresponding source, then measures
# dist/ into SIZES.md.
#
# Needs, once: npm ci
# Fetches into the git-ignored vendor/: ToneMatrix Redux (GPL-3.0, not on npm) at the pinned
# commit below, and cubing.js at the tag of the version npm installed (its source goes into
# dist/twisty/source.zip).
set -euo pipefail

here="$(cd "$(dirname "$0")" && pwd)"
tonematrix_commit=5e30ab35e6373dfa72fbf9dc0f96c2d6d1cfb055
tonematrix="$here/vendor/tonematrix"
cubing="$here/vendor/cubing.git"

if [ ! -d "$here/node_modules/esbuild" ]; then
  echo "build.sh: run npm ci first" >&2
  exit 1
fi
cubing_tag="v$(node -p "require('$here/node_modules/cubing/package.json').version")"

if [ ! -d "$tonematrix/.git" ]; then
  git clone --depth 1 https://github.com/lupine-dev/ToneMatrixRedux "$tonematrix"
fi
if [ "$(git -C "$tonematrix" rev-parse HEAD)" != "$tonematrix_commit" ]; then
  git -C "$tonematrix" fetch --depth 1 origin "$tonematrix_commit"
  git -C "$tonematrix" checkout --quiet "$tonematrix_commit"
fi

# Deliberate: a bare clone (no working tree). cubing.js has scripts under script/test/, which
# `node --test` would otherwise collect and run as this project's tests.
if [ ! -d "$cubing" ]; then
  git clone --quiet --bare --depth 1 --branch "$cubing_tag" https://github.com/cubing/cubing.js "$cubing"
fi
if ! git -C "$cubing" rev-parse --quiet --verify "refs/tags/$cubing_tag" >/dev/null; then
  git -C "$cubing" fetch --quiet --depth 1 origin tag "$cubing_tag"
fi

node "$here/scripts/build.mjs"

# The framed pages' corresponding source, zipped next to each (GPL-3.0 section 6, MPL-2.0
# section 3.2): upstream at the version built, our page around it, and the build scripts.
# Usage: zip_source <page folder under src/ and dist/> <upstream checkout> <upstream ref>
zip_source() {
  local page="$1" upstream="$2" ref="$3"
  local source_dir="$here/.build/$page-source"
  rm -rf "$source_dir"
  mkdir -p "$source_dir/upstream" "$source_dir/page" "$source_dir/build/scripts"
  git -C "$upstream" archive "$ref" | tar -x -C "$source_dir/upstream"
  find "$here/src/$page" -maxdepth 1 -type f ! -name SOURCE.md -exec cp {} "$source_dir/page/" \;
  cp "$here/src/$page/SOURCE.md" "$source_dir/SOURCE.md"
  cp "$here/build.sh" "$here/package.json" "$here/package-lock.json" "$source_dir/build/"
  cp "$here/scripts/build.mjs" "$here/scripts/licences.mjs" "$source_dir/build/scripts/"
  # Fixed timestamps, so an unchanged source gives a byte-identical zip.
  find "$source_dir" -exec touch -h -d '2026-01-01T00:00:00Z' {} +
  rm -f "$here/dist/$page/source.zip"
  (cd "$source_dir" && find . -type f | LC_ALL=C sort | zip -X -q -@ "$here/dist/$page/source.zip")
  cp "$here/src/$page/SOURCE.md" "$here/dist/$page/SOURCE.md"
}
zip_source music-box "$tonematrix" "$tonematrix_commit"
zip_source twisty "$cubing" "$cubing_tag"

node "$here/scripts/measure-sizes.mjs"
