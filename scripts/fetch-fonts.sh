#!/usr/bin/env bash
# Download woff2 fonts from Google Fonts into assets/fonts/.
# CSP-safe: outputs are self-hosted; no runtime CDN reference.
# Re-run any time to refresh.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
OUT="$REPO_ROOT/assets/fonts"
mkdir -p "$OUT"

# Modern Chrome UA so Google Fonts returns woff2 (not legacy formats).
UA='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'

fetch_woff2() {
  # $1 = google fonts query (e.g. "Inter:wght@400")
  # $2 = output filename (no extension)
  local query="$1"
  local out="$2"
  local css url
  css=$(curl -fsSL -A "$UA" "https://fonts.googleapis.com/css2?family=$query&display=swap")
  url=$(printf '%s\n' "$css" | grep -oE 'https://[^)]+\.woff2' | head -1)
  if [ -z "$url" ]; then
    echo "FAILED: no woff2 url for $query" >&2
    exit 1
  fi
  echo "  $query -> $out.woff2"
  curl -fsSL -A "$UA" "$url" -o "$OUT/$out.woff2"
}

echo "Fetching Inter (4 weights)..."
for w in 400 500 600 700; do
  fetch_woff2 "Inter:wght@$w" "inter-$w"
done

echo "Fetching JetBrains Mono (2 weights)..."
for w in 400 500; do
  fetch_woff2 "JetBrains+Mono:wght@$w" "jetbrains-mono-$w"
done

echo "Fetching Instrument Serif (italic)..."
fetch_woff2 "Instrument+Serif:ital@1" "instrument-serif-400-italic"

echo "Done. $(ls -1 "$OUT"/*.woff2 | wc -l) font files in $OUT"
