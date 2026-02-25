#!/usr/bin/env python3
"""Create deterministic gzip sidecar files for static assets."""

from __future__ import annotations

import argparse
import gzip
from pathlib import Path


DEFAULT_EXTENSIONS = {".js"}


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Precompress static files to .gz sidecar files."
    )
    parser.add_argument(
        "--root",
        default=".",
        help="Root directory to scan (default: current directory)",
    )
    parser.add_argument(
        "--ext",
        action="append",
        default=[],
        help="Target extension (repeatable, default: .js)",
    )
    parser.add_argument(
        "--level",
        type=int,
        default=9,
        choices=range(1, 10),
        metavar="[1-9]",
        help="gzip compression level (default: %(default)s)",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Show planned updates without writing files.",
    )
    return parser.parse_args()


def normalize_extensions(exts: list[str]) -> set[str]:
    if not exts:
        return DEFAULT_EXTENSIONS
    normalized = set()
    for ext in exts:
        value = ext.strip()
        if not value:
            continue
        if not value.startswith("."):
            value = "." + value
        normalized.add(value.lower())
    return normalized or DEFAULT_EXTENSIONS


def iter_targets(root: Path, extensions: set[str]):
    for path in root.rglob("*"):
        if not path.is_file():
            continue
        if path.name.endswith(".gz"):
            continue
        if path.suffix.lower() in extensions:
            yield path


def write_if_changed(path: Path, content: bytes, dry_run: bool) -> bool:
    if path.exists() and path.read_bytes() == content:
        return False
    if not dry_run:
        path.write_bytes(content)
    return True


def main() -> None:
    args = parse_args()
    root = Path(args.root).resolve()
    extensions = normalize_extensions(args.ext)

    total_raw = 0
    total_gz = 0
    updated = 0
    skipped = 0
    removed = 0
    not_smaller = 0
    scanned = 0

    for source in iter_targets(root, extensions):
        scanned += 1
        raw = source.read_bytes()
        gz = gzip.compress(raw, compresslevel=args.level, mtime=0)
        total_raw += len(raw)
        gz_path = source.with_name(source.name + ".gz")
        if len(gz) >= len(raw):
            not_smaller += 1
            if gz_path.exists():
                if not args.dry_run:
                    gz_path.unlink()
                removed += 1
                action = "would remove" if args.dry_run else "removed"
                print(f"{action}: {gz_path} (gzip is not smaller)")
            continue

        total_gz += len(gz)
        changed = write_if_changed(gz_path, gz, args.dry_run)
        if changed:
            updated += 1
            action = "would update" if args.dry_run else "updated"
            print(f"{action}: {gz_path}")
        else:
            skipped += 1

    ratio = (total_raw / total_gz) if total_gz else 0.0
    print("--- summary ---")
    print(f"root: {root}")
    print(f"extensions: {', '.join(sorted(extensions))}")
    print(f"scanned: {scanned}")
    print(f"updated: {updated}")
    print(f"unchanged: {skipped}")
    print(f"removed (not smaller): {removed}")
    print(f"not smaller: {not_smaller}")
    print(f"raw bytes: {total_raw}")
    print(f"gzip bytes: {total_gz}")
    if total_gz:
        print(f"ratio: {ratio:.2f}x")


if __name__ == "__main__":
    main()
