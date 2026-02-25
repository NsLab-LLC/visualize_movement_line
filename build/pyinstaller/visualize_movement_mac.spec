# -*- mode: python ; coding: utf-8 -*-

from pathlib import Path


project_root = Path(SPEC).resolve().parents[2]
datas = [
    (str(project_root / "main.html"), "."),
    (str(project_root / "d3.js"), "."),
    (str(project_root / "d3.js.gz"), "."),
    (str(project_root / "data"), "data"),
    (str(project_root / "scripts"), "scripts"),
    (str(project_root / "server.py"), "."),
]

a = Analysis(
    [str(project_root / "launcher.py")],
    pathex=[str(project_root)],
    binaries=[],
    datas=datas,
    hiddenimports=[],
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[],
    noarchive=False,
)
pyz = PYZ(a.pure)
exe = EXE(
    pyz,
    a.scripts,
    [],
    exclude_binaries=True,
    name="VisualizeMovement",
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    console=False,
    disable_windowed_traceback=False,
)
coll = COLLECT(
    exe,
    a.binaries,
    a.datas,
    strip=False,
    upx=True,
    upx_exclude=[],
    name="VisualizeMovement",
)
app = BUNDLE(
    coll,
    name="VisualizeMovement.app",
    icon=None,
    bundle_identifier="jp.visualize.movementline",
)
