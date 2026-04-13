#!/usr/bin/env bash
set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo -e "${BLUE}Rhema Release Creation${NC}"
echo "======================"

if ! git rev-parse --git-dir >/dev/null 2>&1; then
  echo -e "${RED}Error: Not in a git repository${NC}"
  echo "Please run this script from the project directory"
  exit 1
fi

if ! git diff-index --quiet HEAD --; then
  echo -e "${YELLOW}Warning: You have uncommitted changes${NC}"
  echo "Please commit or stash your changes before creating a release"
  echo ""
  echo "To commit changes:"
  echo "  git add ."
  echo "  git commit -m \"Your commit message\""
  echo ""
  echo "To stash changes:"
  echo "  git stash"
  echo ""
  read -r -p "Continue anyway? (y/N): " -n 1 REPLY
  echo
  if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    exit 1
  fi
fi

CURRENT_VERSION=$(python3 - <<'PY'
import json
from pathlib import Path
print(json.loads(Path("src-tauri/tauri.conf.json").read_text())["version"])
PY
)
echo -e "${GREEN}Current version: ${CURRENT_VERSION}${NC}"

echo ""
echo "Enter the new version (e.g. 0.1.0, 0.2.0, 1.0.0):"
read -r -p "New version: " NEW_VERSION

if [[ ! $NEW_VERSION =~ ^[0-9]+\.[0-9]+\.[0-9]+([-.][0-9A-Za-z.-]+)?$ ]]; then
  echo -e "${RED}Error: Invalid version format${NC}"
  echo "Please use semantic versioning (e.g. 0.2.0)"
  exit 1
fi

TAG="v$NEW_VERSION"
if git rev-parse -q --verify "refs/tags/$TAG" >/dev/null; then
  echo -e "${RED}Error: Version $TAG already exists${NC}"
  exit 1
fi

CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD)
if [[ "$CURRENT_BRANCH" != "main" ]]; then
  echo -e "${YELLOW}Warning: You are on branch '${CURRENT_BRANCH}', not 'main'${NC}"
  read -r -p "Create the release from this branch anyway? (y/N): " -n 1 REPLY
  echo
  if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    exit 1
  fi
fi

echo ""
echo -e "${BLUE}Preparing release $TAG...${NC}"

echo "Syncing versions from tag..."
bun run scripts/set-version-from-tag.ts --tag "$TAG"

echo "Committing version change..."
git add package.json src-tauri/tauri.conf.json src-tauri/Cargo.toml
git commit -m "Bump version to $NEW_VERSION"

echo "Creating tag $TAG..."
git tag "$TAG"

echo "Pushing changes to remote..."
git push origin "$CURRENT_BRANCH"
git push origin "$TAG"

REMOTE_URL=$(git remote get-url origin 2>/dev/null || true)
REPO_PATH=$(printf '%s' "$REMOTE_URL" | sed -E 's#(git@|https://)([^/:]+)[:/]([^/]+/[^/.]+)(\.git)?#\3#')

echo ""
echo -e "${GREEN}Release $TAG created successfully${NC}"
echo ""
echo "What happens next:"
echo "1. GitHub Actions will sync versions in CI and build the macOS release artifacts"
echo "2. A GitHub Release for $TAG will be created/updated with those assets"
if [[ -n "$REPO_PATH" ]]; then
  echo "3. You can monitor progress at: https://github.com/$REPO_PATH/actions"
fi
echo ""
echo "To check release status:"
echo "  git log --oneline -5"
echo "  git tag -l | tail -5"
