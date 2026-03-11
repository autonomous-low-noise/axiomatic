#!/usr/bin/env bash
set -euo pipefail

if [ $# -ne 1 ]; then
  echo "Usage: $0 <version>"
  echo "Example: $0 0.1.0"
  exit 1
fi

VERSION="$1"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "=== Prebuild pipeline for v${VERSION} ==="
echo ""

# 1. Version bump
echo ">> Bumping version..."
bash scripts/bump-version.sh "$VERSION"
echo ""

# 2. ESLint fix
echo ">> Running ESLint with --fix..."
npm run lint -- --fix
echo ""

# 3. Type-check (same as vite:build uses — NOT --noEmit)
echo ">> Type-checking (tsc -b)..."
npx tsc -b
echo ""

# 4. Frontend tests
echo ">> Running Vitest..."
npm run test
echo ""

# 5. Rust check
echo ">> Running cargo check..."
(cd src-tauri && cargo check)
echo ""

# 6. Rust tests
echo ">> Running cargo test --lib..."
(cd src-tauri && cargo test --lib)
echo ""

# 7. Stage, commit, and tag
echo ">> Committing and tagging..."
git add -A
git commit -m "chore: bump version to v${VERSION}"
git tag "v${VERSION}"
echo ""

echo "=== Done ==="
echo "  Commit: chore: bump version to v${VERSION}"
echo "  Tag:    v${VERSION}"
echo ""
echo "Review the commit, then push:"
echo "  git push origin master --tags"
