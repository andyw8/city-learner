#!/usr/bin/env bash
set -euo pipefail

# Fetch a Toronto PMTiles basemap cutout for local development.
# The tile file is large, so it is gitignored; run this once after cloning.

BUILD="${BUILD:-20260926}"
MAXZOOM="${MAXZOOM:-14}"
BBOX="${BBOX:--79.68,43.55,-79.08,43.90}"
OUT="${OUT:-data/tiles/toronto.pmtiles}"
VERSION="v1.31.2"

case "$(uname -s)-$(uname -m)" in
  Darwin-arm64) ASSET="go-pmtiles-${VERSION#v}_Darwin_arm64.zip" ;;
  Darwin-x86_64) ASSET="go-pmtiles-${VERSION#v}_Darwin_x86_64.zip" ;;
  Linux-x86_64) ASSET="go-pmtiles_${VERSION#v}_Linux_x86_64.tar.gz" ;;
  *) echo "Unsupported platform: $(uname -s)-$(uname -m)" >&2; exit 1 ;;
esac

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

URL="https://github.com/protomaps/go-pmtiles/releases/download/${VERSION}/${ASSET}"
echo "Downloading pmtiles CLI: ${ASSET}"
curl -fsSL -o "$TMP/$ASSET" "$URL"

case "$ASSET" in
  *.zip) unzip -o "$TMP/$ASSET" -d "$TMP" >/dev/null ;;
  *.tar.gz) tar -xzf "$TMP/$ASSET" -C "$TMP" ;;
esac

mkdir -p "$(dirname "$OUT")"
echo "Extracting ${BBOX} at maxzoom ${MAXZOOM} from build ${BUILD}"
"$TMP/pmtiles" extract "https://build.protomaps.com/${BUILD}.pmtiles" "$OUT" \
  --bbox="$BBOX" --maxzoom="$MAXZOOM" --download-threads=8

echo "Wrote $OUT"
