#!/usr/bin/env python3
"""Own local application process groups; PostgreSQL has a separate lifecycle."""
import argparse
import os
from pathlib import Path
import signal
import socket
import subprocess
import sys
import threading
import time

ROOT = Path(__file__).resolve().parents[1]


def check_ports():
    sockets = []
    try:
        for port in (8000, 3344):
            listener = socket.socket()
            sockets.append(listener)
            try:
                listener.bind(("127.0.0.1", port))
            except OSError as exc:
                raise RuntimeError(
                    f"Port {port} is unavailable. Stop its owner before restarting; "
                    f"check with: lsof -nP -iTCP:{port} -sTCP:LISTEN"
                ) from exc
    finally:
        for listener in sockets:
            listener.close()


def stop_groups(processes):
    # Signal groups even if a group leader has exited: reloaders can outlive it.
    for process in processes:
        try:
            os.killpg(process.pid, signal.SIGTERM)
        except ProcessLookupError:
            pass
    deadline = time.monotonic() + 10
    for process in processes:
        try:
            process.wait(timeout=max(0, deadline - time.monotonic()))
        except subprocess.TimeoutExpired:
            pass
    for process in processes:
        try:
            os.killpg(process.pid, signal.SIGKILL)
        except ProcessLookupError:
            pass
        process.wait()


def copy_output(stream, path):
    with path.open("wb") as logfile:
        for line in iter(stream.readline, b""):
            logfile.write(line)
            logfile.flush()
            sys.stdout.buffer.write(line)
            sys.stdout.buffer.flush()
    stream.close()


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--check-ports", action="store_true")
    parser.add_argument("--api", action="store_true")
    args = parser.parse_args()
    try:
        check_ports()
    except RuntimeError as exc:
        print(f"[slotera] error: {exc}", file=sys.stderr)
        return 1
    if args.check_ports:
        return 0
    server = ROOT / "server"
    executable = server / ".venv/bin"
    commands = [
        ("api", server, [str(executable / "uvicorn"), "slotera_api.main:app", "--reload", "--port", "8000", "--no-access-log"]),
        ("worker", server, [str(executable / "slotera-email-worker")]),
        ("maintenance", server, [str(executable / "slotera-maintenance"), "--loop"]),
        ("web", ROOT / "web", ["npm", "run", "dev", "--", "--port", "3344"]),
    ]
    processes, threads = [], []
    interrupted = False

    def interrupt(signum, frame):
        nonlocal interrupted
        interrupted = True

    for signum in (signal.SIGINT, signal.SIGTERM, signal.SIGHUP):
        signal.signal(signum, interrupt)
    logs = ROOT / ".logs"
    logs.mkdir(exist_ok=True)
    try:
        for name, cwd, command in commands:
            if interrupted:
                return 130
            env = os.environ.copy()
            if name == "web":
                env["PORT"] = "3344"
                if args.api:
                    env["NEXT_PUBLIC_DATA_SOURCE"] = "api"
            process = subprocess.Popen(command, cwd=cwd, env=env, start_new_session=True,
                                       stdout=subprocess.PIPE, stderr=subprocess.STDOUT)
            processes.append(process)
            thread = threading.Thread(target=copy_output, args=(process.stdout, logs / f"{name}.log"))
            thread.start()
            threads.append(thread)
        print("[slotera] Starting API :8000 and frontend :3344; Ctrl-C stops application processes.")
        while not interrupted:
            for (name, _, _), process in zip(commands, processes):
                if process.poll() is not None:
                    print(f"[slotera] error: {name} stopped unexpectedly (exit {process.returncode})", file=sys.stderr)
                    return process.returncode or 1
            time.sleep(.2)
        return 130
    finally:
        stop_groups(processes)
        for thread in threads:
            thread.join()
        print("[slotera] Application processes stopped; PostgreSQL remains running.")


if __name__ == "__main__":
    sys.exit(main())
