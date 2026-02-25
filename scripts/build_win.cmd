@echo off
setlocal EnableExtensions

set "SCRIPT_DIR=%~dp0"
for %%I in ("%SCRIPT_DIR%..") do set "ROOT_DIR=%%~fI"
cd /d "%ROOT_DIR%" || (
  echo Failed to move to repository root: "%ROOT_DIR%"
  exit /b 1
)

set "VERSION=%~1"
if not defined VERSION (
  for /f %%I in ('python -c "from datetime import datetime; print(datetime.now().strftime(\"%%Y%%m%%d\"))"') do set "VERSION=%%I"
)
if not defined VERSION (
  echo Failed to resolve version.
  exit /b 1
)

set "DIST_DIR=%ROOT_DIR%\dist"
set "EXE_DIR=%DIST_DIR%\VisualizeMovement"
set "EXE_PATH=%EXE_DIR%\VisualizeMovement.exe"
set "DATA_DIR=%ROOT_DIR%\VisualizeMovementData"
set "DOC_DIR=%ROOT_DIR%\docs"
set "PACKAGE_NAME=VisualizeMovement_Windows_%VERSION%"
set "PACKAGE_ROOT=%DIST_DIR%\_package_win"
set "PACKAGE_DIR=%PACKAGE_ROOT%\%PACKAGE_NAME%"
set "ARCHIVE_PATH=%DIST_DIR%\%PACKAGE_NAME%.zip"
set "USER_README="

for /f "delims=" %%F in ('dir /b /a:-d "%DOC_DIR%\README_*.txt" 2^>nul') do if not defined USER_README set "USER_README=%DOC_DIR%\%%F"

python -m PyInstaller -y --clean --workpath .pyi-build --distpath "%DIST_DIR%" build/pyinstaller/visualize_movement_win.spec
if errorlevel 1 (
  echo PyInstaller build failed.
  exit /b 1
)

if not exist "%EXE_PATH%" (
  echo Build output not found: "%EXE_PATH%"
  exit /b 1
)
if not exist "%DATA_DIR%\" (
  echo Data directory not found: "%DATA_DIR%"
  exit /b 1
)
if not defined USER_README (
  echo User README not found under "%DOC_DIR%\README_*.txt"
  exit /b 1
)
if not exist "%USER_README%" (
  echo User README not found: "%USER_README%"
  exit /b 1
)

if exist "%PACKAGE_DIR%" (
  rmdir /s /q "%PACKAGE_DIR%"
  if errorlevel 1 (
    echo Failed to remove package directory: "%PACKAGE_DIR%"
    exit /b 1
  )
)
if not exist "%PACKAGE_ROOT%" (
  mkdir "%PACKAGE_ROOT%"
  if errorlevel 1 (
    echo Failed to create package root: "%PACKAGE_ROOT%"
    exit /b 1
  )
)
mkdir "%PACKAGE_DIR%"
if errorlevel 1 (
  echo Failed to create package directory: "%PACKAGE_DIR%"
  exit /b 1
)

xcopy "%EXE_DIR%" "%PACKAGE_DIR%\VisualizeMovement\" /E /I /H /Y >nul
if errorlevel 1 (
  echo Failed to copy executable directory.
  exit /b 1
)
xcopy "%DATA_DIR%" "%PACKAGE_DIR%\VisualizeMovementData\" /E /I /H /Y >nul
if errorlevel 1 (
  echo Failed to copy data directory.
  exit /b 1
)
copy /y "%USER_README%" "%PACKAGE_DIR%\" >nul
if errorlevel 1 (
  echo Failed to copy user README.
  exit /b 1
)

if exist "%ARCHIVE_PATH%" (
  del /f /q "%ARCHIVE_PATH%"
  if errorlevel 1 (
    echo Failed to remove existing archive: "%ARCHIVE_PATH%"
    exit /b 1
  )
)

python -c "import os,pathlib,zipfile; src=pathlib.Path(os.environ['PACKAGE_DIR']); dst=pathlib.Path(os.environ['ARCHIVE_PATH']); root=src.parent; z=zipfile.ZipFile(dst,'w',compression=zipfile.ZIP_DEFLATED); [z.write(p, p.relative_to(root).as_posix()) for p in src.rglob('*') if p.is_file()]; z.close()"
if errorlevel 1 (
  echo Failed to create archive: "%ARCHIVE_PATH%"
  exit /b 1
)

echo Created: %ARCHIVE_PATH%
