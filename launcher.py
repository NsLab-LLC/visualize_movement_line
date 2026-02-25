#!/usr/bin/env python3
"""Double-click launcher for the movement visualization app."""

from __future__ import annotations

import argparse
import json
import os
import subprocess
import sys
import threading
import time
import webbrowser
from pathlib import Path
from typing import Any
from urllib.error import URLError
from urllib.request import urlopen

from server import HEALTH_PATH, HEALTH_RESPONSE_TEXT, create_server


APP_NAME = "VisualizeMovement"
DEFAULT_HOST = "127.0.0.1"
LOCK_BASENAME = "server.lock.json"
STARTUP_TIMEOUT_SECONDS = 15.0
HEALTH_POLL_INTERVAL_SECONDS = 0.2


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Launch the movement visualization app without terminal commands."
    )
    parser.add_argument("--serve", action="store_true", help=argparse.SUPPRESS)
    parser.add_argument("--smoke-test", action="store_true", help="Run startup smoke test and exit.")
    parser.add_argument("--no-browser", action="store_true", help="Do not open a browser tab.")
    parser.add_argument("--host", default=DEFAULT_HOST, help=argparse.SUPPRESS)
    parser.add_argument("--port", type=int, default=0, help=argparse.SUPPRESS)
    parser.add_argument("--directory", default=None, help=argparse.SUPPRESS)
    parser.add_argument("--lock-file", default=None, help=argparse.SUPPRESS)
    return parser.parse_args()


def get_resource_root() -> Path:
    if getattr(sys, "frozen", False):
        bundle_root = getattr(sys, "_MEIPASS", None)
        if bundle_root:
            return Path(bundle_root)
        return Path(sys.executable).resolve().parent
    return Path(__file__).resolve().parent


def get_default_lock_file() -> Path:
    state_dir = Path.home() / ".visualize_movement_line"
    state_dir.mkdir(parents=True, exist_ok=True)
    return state_dir / LOCK_BASENAME


def resolve_lock_file(raw_lock_file: str | None) -> Path:
    if raw_lock_file:
        lock_file = Path(raw_lock_file).expanduser()
        lock_file.parent.mkdir(parents=True, exist_ok=True)
        return lock_file
    return get_default_lock_file()


def resolve_directory(raw_directory: str | None) -> Path:
    if raw_directory:
        return Path(raw_directory).expanduser().resolve()
    return get_resource_root().resolve()


def main_url(port: int) -> str:
    return f"http://{DEFAULT_HOST}:{port}/main.html"


def health_url(port: int) -> str:
    return f"http://{DEFAULT_HOST}:{port}{HEALTH_PATH}"


def read_lock(lock_file: Path) -> dict[str, Any] | None:
    try:
        data = json.loads(lock_file.read_text(encoding="utf-8"))
    except (FileNotFoundError, json.JSONDecodeError, OSError):
        return None

    if not isinstance(data, dict):
        return None
    port = data.get("port")
    if not isinstance(port, int) or port <= 0 or port > 65535:
        return None

    url = data.get("url")
    if not isinstance(url, str) or not url:
        url = main_url(port)
    return {"port": port, "url": url}


def write_lock(lock_file: Path, payload: dict[str, Any]) -> None:
    temporary = lock_file.with_suffix(lock_file.suffix + ".tmp")
    temporary.write_text(json.dumps(payload, ensure_ascii=True), encoding="utf-8")
    temporary.replace(lock_file)


def remove_lock(lock_file: Path) -> None:
    try:
        lock_file.unlink()
    except FileNotFoundError:
        return
    except OSError:
        return


def is_server_alive(port: int, timeout_seconds: float = 0.6) -> bool:
    try:
        with urlopen(health_url(port), timeout=timeout_seconds) as response:
            body = response.read().decode("utf-8", errors="replace").strip()
            return response.status == 200 and body == HEALTH_RESPONSE_TEXT
    except (URLError, OSError, TimeoutError, ValueError):
        return False


def find_running_instance(lock_file: Path) -> tuple[int, str] | None:
    lock_data = read_lock(lock_file)
    if not lock_data:
        return None
    port = lock_data["port"]
    url = lock_data["url"]
    if is_server_alive(port):
        return port, url
    remove_lock(lock_file)
    return None


def show_error_dialog(message: str) -> None:
    try:
        import tkinter as tk
        from tkinter import messagebox

        root = tk.Tk()
        root.withdraw()
        messagebox.showerror(APP_NAME, message)
        root.destroy()
    except Exception:
        print(f"{APP_NAME}: {message}", file=sys.stderr)


def open_browser(url: str, no_browser: bool) -> None:
    if no_browser:
        return
    opened = webbrowser.open(url, new=2)
    if not opened:
        show_error_dialog(f"Could not open browser automatically.\nOpen this URL manually:\n{url}")


def executable_command() -> list[str]:
    if getattr(sys, "frozen", False):
        return [sys.executable]
    return [sys.executable, str(Path(__file__).resolve())]


def spawn_server_process(lock_file: Path, directory: Path) -> subprocess.Popen[Any]:
    command = executable_command() + [
        "--serve",
        "--host",
        DEFAULT_HOST,
        "--port",
        "0",
        "--directory",
        str(directory),
        "--lock-file",
        str(lock_file),
    ]
    kwargs: dict[str, Any] = {
        "stdin": subprocess.DEVNULL,
        "stdout": subprocess.DEVNULL,
        "stderr": subprocess.DEVNULL,
        "close_fds": True,
    }
    if os.name == "nt":
        kwargs["creationflags"] = (
            subprocess.CREATE_NEW_PROCESS_GROUP | subprocess.DETACHED_PROCESS
        )
    else:
        kwargs["start_new_session"] = True
    return subprocess.Popen(command, **kwargs)


def wait_for_server(lock_file: Path, child: subprocess.Popen[Any]) -> tuple[int, str]:
    deadline = time.monotonic() + STARTUP_TIMEOUT_SECONDS
    while time.monotonic() < deadline:
        instance = find_running_instance(lock_file)
        if instance:
            return instance
        if child.poll() is not None:
            break
        time.sleep(HEALTH_POLL_INTERVAL_SECONDS)
    raise RuntimeError("Server did not become ready within the startup timeout.")


def terminate_process(child: subprocess.Popen[Any]) -> None:
    if child.poll() is not None:
        return
    try:
        child.terminate()
        child.wait(timeout=2.0)
    except Exception:
        try:
            child.kill()
        except Exception:
            return


def run_launcher_mode(args: argparse.Namespace) -> int:
    lock_file = resolve_lock_file(args.lock_file)
    existing = find_running_instance(lock_file)
    if existing:
        _, url = existing
        open_browser(url, args.no_browser)
        return 0

    directory = resolve_directory(args.directory)
    child = spawn_server_process(lock_file, directory)
    try:
        _, url = wait_for_server(lock_file, child)
    except RuntimeError as error:
        terminate_process(child)
        show_error_dialog(
            "Failed to start local server.\n"
            f"{error}\n"
            f"Directory: {directory}"
        )
        return 1

    open_browser(url, args.no_browser)
    return 0


def run_server_mode(args: argparse.Namespace) -> int:
    lock_file = resolve_lock_file(args.lock_file)
    existing = find_running_instance(lock_file)
    if existing:
        return 0

    directory = resolve_directory(args.directory)
    server = create_server(args.host, args.port, str(directory))
    _, bound_port = server.server_address[:2]
    write_lock(
        lock_file,
        {
            "port": bound_port,
            "url": main_url(bound_port),
            "pid": os.getpid(),
            "directory": str(directory),
        },
    )

    try:
        server.serve_forever(poll_interval=0.5)
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()
        remove_lock(lock_file)
    return 0


def request_status(url: str, timeout_seconds: float = 1.0) -> int:
    with urlopen(url, timeout=timeout_seconds) as response:
        return response.status


def run_smoke_test() -> int:
    directory = resolve_directory(None)
    server = create_server(DEFAULT_HOST, 0, str(directory))
    _, port = server.server_address[:2]
    thread = threading.Thread(target=server.serve_forever, kwargs={"poll_interval": 0.2})
    thread.daemon = True
    thread.start()
    try:
        deadline = time.monotonic() + 5.0
        while time.monotonic() < deadline:
            if is_server_alive(port, timeout_seconds=0.5):
                break
            time.sleep(0.1)
        else:
            print("smoke-test: health check timeout", file=sys.stderr)
            return 1

        status_main = request_status(main_url(port))
        if status_main != 200:
            print(f"smoke-test: main.html returned {status_main}", file=sys.stderr)
            return 1
        print("smoke-test: ok")
        return 0
    except Exception as error:
        print(f"smoke-test: failed ({error})", file=sys.stderr)
        return 1
    finally:
        server.shutdown()
        thread.join(timeout=2.0)
        server.server_close()


def main() -> int:
    args = parse_args()
    if args.smoke_test:
        return run_smoke_test()
    if args.serve:
        return run_server_mode(args)
    return run_launcher_mode(args)


if __name__ == "__main__":
    raise SystemExit(main())
