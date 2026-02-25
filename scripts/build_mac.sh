#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

python3 -m PyInstaller \
  --clean \
  --workpath .pyi-build \
  --distpath dist \
  build/pyinstaller/visualize_movement_mac.spec
