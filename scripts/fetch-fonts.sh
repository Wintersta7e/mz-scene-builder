#!/usr/bin/env bash
# Download latin-subset woff2 fonts from fontsource via jsDelivr.
# CSP-safe: outputs are self-hosted; no runtime CDN reference.
# Re-run any time to refresh.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
OUT="$REPO_ROOT/assets/fonts"
mkdir -p "$OUT"

# fontsource @5 ships pre-bundled latin-only woff2 files — no subset ambiguity.
BASE='https://cdn.jsdelivr.net/npm'

fetch() {
  # $1 = url
  # $2 = output filename
  echo "  $2"
  curl -fsSL "$1" -o "$OUT/$2"
}

echo "Fetching Inter (4 weights)..."
for w in 400 500 600 700; do
  fetch "$BASE/@fontsource/inter@5/files/inter-latin-$w-normal.woff2" "inter-$w.woff2"
done

echo "Fetching JetBrains Mono (2 weights)..."
for w in 400 500; do
  fetch "$BASE/@fontsource/jetbrains-mono@5/files/jetbrains-mono-latin-$w-normal.woff2" "jetbrains-mono-$w.woff2"
done

echo "Fetching Instrument Serif (italic)..."
fetch "$BASE/@fontsource/instrument-serif@5/files/instrument-serif-latin-400-italic.woff2" "instrument-serif-400-italic.woff2"

# Sanity check — every file should be > 10 KB. Anything smaller is a subset miss.
echo
echo "Verifying file sizes..."
fail=0
for f in "$OUT"/*.woff2; do
  size=$(stat -c%s "$f" 2>/dev/null || stat -f%z "$f")
  if [ "$size" -lt 10000 ]; then
    echo "FAIL: $f is only $size bytes (expected > 10000)"
    fail=1
  fi
done
if [ "$fail" -eq 1 ]; then
  echo "One or more font files look like partial downloads. Re-run or investigate."
  exit 1
fi

echo "Done. $(ls -1 "$OUT"/*.woff2 | wc -l) font files in $OUT, all sane size."
