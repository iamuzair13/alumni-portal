#!/usr/bin/env bash
# Run on the Linux PM2 production host (SSH).
# Verifies the event file exists where Next reads it and suggests a curl test.
#
# Usage:
#   cd /path/to/alumni-portal
#   source .env  # if UPLOADS_IMAGES_DIR or PROJECT_ROOT is set there
#   ./scripts/pm2-check-event-image.sh event-1776756076068-pkv7on-2.jpg
#
# Steps for full "relocate" to https://portal-alumni.uol.edu.pk/images/... :
#   1) Deploy app code (includes GET /images/[...path] and DB writes as /images/...).
#   2) Run SQL migration: migrations/039_tbl_events_store_public_image_paths.sql
#   3) If nginx fronts the site, apply deploy/nginx-event-images-to-nextjs.conf.example
#   4) pm2 reload <your-app>
#   5) curl -I "https://portal-alumni.uol.edu.pk/images/<basename>"

set -euo pipefail

bn="${1:-}"
if [[ -z "$bn" ]]; then
  echo "Usage: $0 <filename.ext>   e.g. $0 event-1776756076068-pkv7on-2.jpg" >&2
  exit 1
fi

ROOT="${PROJECT_ROOT:-$(cd "$(dirname "$0")/.." && pwd)}"
# Match getUploadsImagesDir(): UPLOADS_IMAGES_DIR wins, else ROOT/public/images
if [[ -n "${UPLOADS_IMAGES_DIR:-}" ]]; then
  DIR="$UPLOADS_IMAGES_DIR"
else
  DIR="$ROOT/public/images"
fi

path="$DIR/$bn"
if [[ -f "$path" ]]; then
  echo "OK: file exists: $path"
  ls -la "$path"
else
  echo "MISSING: $path" >&2
  echo "If the file only exists under another path, copy it here, e.g.:" >&2
  echo "  mkdir -p \"$DIR\" && cp /old/path/$bn \"$DIR/\"" >&2
  exit 2
fi

echo
echo "After nginx + PM2 are correct, test:"
echo "  curl -sI \"https://portal-alumni.uol.edu.pk/images/$bn\" | head -n5"
