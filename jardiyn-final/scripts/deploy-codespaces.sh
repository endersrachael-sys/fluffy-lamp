#!/usr/bin/env bash
set -euo pipefail
BRANCH="${1:-jardiyn-10of10-rebuild}"
APP_DIR="jardiyn-final"

echo "Creating branch: $BRANCH"
git checkout -b "$BRANCH" || git checkout "$BRANCH"

echo "Installing dependencies..."
cd "$APP_DIR"
npm install
npm test
cd ..

echo "Committing changes..."
git add "$APP_DIR"
git commit -m "Rebuild JarDIYn final MVP for product-grade demo" || echo "No changes to commit."

echo "Pushing branch..."
git push -u origin "$BRANCH"

echo "If Render watches main, merge this branch into main and push main to trigger auto-deploy."
