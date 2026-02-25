$ErrorActionPreference = "Stop"

$RootDir = Resolve-Path (Join-Path $PSScriptRoot "..")
Set-Location $RootDir

python -m PyInstaller --clean --workpath .pyi-build --distpath dist build/pyinstaller/visualize_movement_win.spec
