#!/usr/bin/env bash
# Publish (or update) rhema.db as a GitHub Release asset under the `data-v1` tag.
# Run this once after generating rhema.db, and again whenever the Bible data changes.
#
# Usage:
#   bash scripts/publish-data.sh
#
# Requirements:
#   - gh (GitHub CLI) authenticated: gh auth login
#   - data/rhema.db must exist (run: bun run setup:all)

set -euo pipefail

REPO="ojutalayomi/rhema"
TAG="data-v1"
DB_PATH="data/rhema.db"

cd "$(dirname "$0")/.."

if [[ ! -f "$DB_PATH" ]]; then
  echo "❌  $DB_PATH not found. Run 'bun run setup:all' first."
  exit 1
fi

echo "📦  rhema.db: $(du -sh "$DB_PATH" | cut -f1)"

# Create the release if it doesn't exist yet
if gh release view "$TAG" --repo "$REPO" &>/dev/null; then
  echo "ℹ️   Release '$TAG' already exists — uploading/replacing asset…"
  # Delete existing asset if present, then re-upload
  gh release delete-asset "$TAG" rhema.db --repo "$REPO" --yes 2>/dev/null || true
else
  echo "🏷️   Creating release '$TAG'…"
  gh release create "$TAG" \
    --repo "$REPO" \
    --title "Data: Bible database" \
    --notes "Contains \`rhema.db\` — the compiled Bible database used by all Rhema releases. Re-upload whenever Bible data changes." \
    --prerelease
fi

echo "⬆️   Uploading rhema.db…"
gh release upload "$TAG" "$DB_PATH" --repo "$REPO" --clobber

echo "✅  Done. rhema.db is now available at:"
echo "    https://github.com/$REPO/releases/tag/$TAG"
