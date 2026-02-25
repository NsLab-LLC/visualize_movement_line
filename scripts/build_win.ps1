param(
    [string]$Version = (Get-Date -Format "yyyyMMdd")
)

$ErrorActionPreference = "Stop"

$RootDir = Resolve-Path (Join-Path $PSScriptRoot "..")
Set-Location $RootDir

$DistDir = Join-Path $RootDir "dist"
$ExeDir = Join-Path $DistDir "VisualizeMovement"
$DataDir = Join-Path $RootDir "VisualizeMovementData"
$UserReadme = Join-Path $RootDir "docs/README_利用者向け.txt"
$PackageName = "VisualizeMovement_Windows_$Version"
$PackageRoot = Join-Path $DistDir "_package_win"
$PackageDir = Join-Path $PackageRoot $PackageName
$ArchivePath = Join-Path $DistDir "$PackageName.zip"

python -m PyInstaller -y --clean --workpath .pyi-build --distpath $DistDir build/pyinstaller/visualize_movement_win.spec

if (-not (Test-Path -Path $ExeDir -PathType Container)) {
    throw "Build output not found: $ExeDir"
}
if (-not (Test-Path -Path $DataDir -PathType Container)) {
    throw "Data directory not found: $DataDir"
}
if (-not (Test-Path -Path $UserReadme -PathType Leaf)) {
    throw "User README not found: $UserReadme"
}

if (Test-Path -Path $PackageDir) {
    Remove-Item -Path $PackageDir -Recurse -Force
}
New-Item -Path $PackageDir -ItemType Directory -Force | Out-Null

Copy-Item -Path $ExeDir -Destination $PackageDir -Recurse
Copy-Item -Path $DataDir -Destination $PackageDir -Recurse
Copy-Item -Path $UserReadme -Destination (Join-Path $PackageDir "README_利用者向け.txt") -Force

if (Test-Path -Path $ArchivePath -PathType Leaf) {
    Remove-Item -Path $ArchivePath -Force
}
Compress-Archive -Path (Join-Path $PackageRoot $PackageName) -DestinationPath $ArchivePath -CompressionLevel Optimal

Write-Host "Created: $ArchivePath"
