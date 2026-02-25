#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

VERSION="${1:-$(date +%Y%m%d)}"
DIST_DIR="$ROOT_DIR/dist"
APP_NAME="VisualizeMovement.app"
DATA_DIR_NAME="VisualizeMovementData"
PACKAGE_NAME="VisualizeMovement_macOS_${VERSION}"
PACKAGE_ROOT="$DIST_DIR/_package_mac"
PACKAGE_DIR="$PACKAGE_ROOT/$PACKAGE_NAME"
ARCHIVE_PATH="$DIST_DIR/${PACKAGE_NAME}.zip"
USER_README="$ROOT_DIR/docs/README_利用者向け.txt"

python3 -m PyInstaller \
  -y \
  --clean \
  --workpath .pyi-build \
  --distpath "$DIST_DIR" \
  build/pyinstaller/visualize_movement_mac.spec

if [[ ! -d "$DIST_DIR/$APP_NAME" ]]; then
  echo "Build output not found: $DIST_DIR/$APP_NAME" >&2
  exit 1
fi
if [[ ! -d "$ROOT_DIR/$DATA_DIR_NAME" ]]; then
  echo "Data directory not found: $ROOT_DIR/$DATA_DIR_NAME" >&2
  exit 1
fi
if [[ ! -f "$USER_README" ]]; then
  echo "User README not found: $USER_README" >&2
  exit 1
fi

rm -rf "$PACKAGE_DIR"
mkdir -p "$PACKAGE_DIR"
cp -R "$DIST_DIR/$APP_NAME" "$PACKAGE_DIR/$APP_NAME"
cp -R "$ROOT_DIR/$DATA_DIR_NAME" "$PACKAGE_DIR/$DATA_DIR_NAME"
cp "$USER_README" "$PACKAGE_DIR/README_利用者向け.txt"

rm -f "$ARCHIVE_PATH"
(
  cd "$PACKAGE_ROOT"
  zip -rq "$ARCHIVE_PATH" "$PACKAGE_NAME"
)

echo "Created: $ARCHIVE_PATH"
