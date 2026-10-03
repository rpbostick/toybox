#!/usr/bin/env bash
# Builds dist/ and writes release/toybox-<version>.zip: the whole of dist/ (with the framed
# pages' bundles and source zips, which are not in git) under toybox-<version>/, for sites that
# copy the library into their own files instead of installing it from npm.
#
# Needs, once: npm ci
set -euo pipefail

here="$(cd "$(dirname "$0")/.." && pwd)"
version="$(node -p "require('$here/package.json').version")"
name="toybox-$version"

if ! grep -q "^## $version " "$here/CHANGELOG.md"; then
  echo "release.sh: CHANGELOG.md has no entry for $version" >&2
  exit 1
fi

bash "$here/build.sh"

for required in dist/twisty/app/main.js dist/twisty/source.zip dist/music-box/app/all.js dist/music-box/source.zip; do
  if [ ! -f "$here/$required" ]; then
    echo "release.sh: build.sh did not make $required" >&2
    exit 1
  fi
done

stage="$here/.build/release/$name"
rm -rf "$here/.build/release"
mkdir -p "$stage" "$here/release"
cp -R "$here/dist/." "$stage/"
cp "$here/README.md" "$here/CHANGELOG.md" "$stage/"
# Fixed timestamps, so the same build gives a byte-identical zip.
find "$stage" -exec touch -h -d '2026-01-01T00:00:00Z' {} +
rm -f "$here/release/$name.zip"
(cd "$here/.build/release" && find "$name" -type f | LC_ALL=C sort | zip -X -q -@ "$here/release/$name.zip")
echo "wrote release/$name.zip"
