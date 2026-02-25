#!/usr/bin/env python3
"""Serve static files with precompressed gzip sidecar support.

If a request accepts gzip and `<path>.gz` exists for a compressible file,
the server returns the sidecar file with `Content-Encoding: gzip`.
"""

from __future__ import annotations

import argparse
import os
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path


DEFAULT_COMPRESSIBLE_EXTENSIONS = {
    ".js",
    ".json",
    ".css",
    ".html",
    ".svg",
    ".txt",
}


class GzipSidecarHandler(SimpleHTTPRequestHandler):
    compressible_extensions = DEFAULT_COMPRESSIBLE_EXTENSIONS

    def _accepts_gzip(self) -> bool:
        accept_encoding = self.headers.get("Accept-Encoding", "")
        for token in accept_encoding.split(","):
            token = token.strip().lower()
            if not token:
                continue
            parts = [part.strip() for part in token.split(";")]
            if parts[0] != "gzip":
                continue
            q_value = 1.0
            for part in parts[1:]:
                if part.startswith("q="):
                    try:
                        q_value = float(part[2:])
                    except ValueError:
                        q_value = 0.0
            return q_value > 0
        return False

    def _can_serve_gzip_sidecar(self, path: Path) -> bool:
        if not path.is_file():
            return False
        if path.suffix.lower() not in self.compressible_extensions:
            return False
        gzip_path = path.with_name(path.name + ".gz")
        return gzip_path.is_file()

    def send_head(self):  # noqa: D401 - overriding stdlib method
        path = Path(self.translate_path(self.path))
        if self._accepts_gzip() and self._can_serve_gzip_sidecar(path):
            gzip_path = path.with_name(path.name + ".gz")
            try:
                file_obj = open(gzip_path, "rb")
            except OSError:
                self.send_error(404, "File not found")
                return None

            stat = os.fstat(file_obj.fileno())
            original_stat = path.stat()
            self.send_response(200)
            self.send_header("Content-Type", self.guess_type(str(path)))
            self.send_header("Content-Encoding", "gzip")
            self.send_header("Vary", "Accept-Encoding")
            self.send_header("Content-Length", str(stat.st_size))
            self.send_header("Last-Modified", self.date_time_string(original_stat.st_mtime))
            self.end_headers()
            return file_obj
        return super().send_head()


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Static file server with gzip sidecar support (.gz)."
    )
    parser.add_argument(
        "--host",
        default="0.0.0.0",
        help="Bind address (default: %(default)s)",
    )
    parser.add_argument(
        "--port",
        type=int,
        default=8000,
        help="Port number (default: %(default)s)",
    )
    parser.add_argument(
        "--directory",
        default=".",
        help="Document root (default: current directory)",
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    handler = lambda *a, **kw: GzipSidecarHandler(  # noqa: E731
        *a,
        directory=args.directory,
        **kw,
    )
    server = ThreadingHTTPServer((args.host, args.port), handler)
    print(f"Serving {args.directory} on http://{args.host}:{args.port}")
    print("gzip sidecar enabled: serve *.gz when Accept-Encoding includes gzip")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nStopping server.")
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
