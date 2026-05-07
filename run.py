import os
import shutil
import signal
import socket
import subprocess
import sys
import time


ROOT = os.path.dirname(os.path.abspath(__file__))
NODE = os.environ.get("NODE_BIN") or shutil.which("node") or shutil.which("node.exe") or "node"
NPM = (
    os.environ.get("NPM_BIN")
    or shutil.which("npm.cmd")
    or shutil.which("npm")
    or shutil.which("npm.exe")
    or "npm.cmd"
)
BACKEND_START_PORT = int(os.environ.get("PORT", "3000"))
VITE_PORT = os.environ.get("VITE_PORT", "5173")


def can_bind(family: socket.AddressFamily, address: str, port: int) -> bool:
    with socket.socket(family, socket.SOCK_STREAM) as sock:
        try:
            if family == socket.AF_INET6:
                sock.setsockopt(socket.IPPROTO_IPV6, socket.IPV6_V6ONLY, 0)
            sock.bind((address, port))
            return True
        except OSError:
            return False


def is_port_free(port: int) -> bool:
    ipv4_free = can_bind(socket.AF_INET, "0.0.0.0", port)
    try:
        ipv6_free = can_bind(socket.AF_INET6, "::", port)
    except OSError:
        ipv6_free = True
    return ipv4_free and ipv6_free


def find_free_port(start_port: int) -> int:
    for port in range(start_port, start_port + 50):
        if is_port_free(port):
            return port
    raise RuntimeError(f"No free port found from {start_port} to {start_port + 49}")


def spawn(label: str, args: list[str], env: dict[str, str]) -> subprocess.Popen:
    merged_env = os.environ.copy()
    merged_env.update(env)
    print(f"[run.py] start {label}: {' '.join(args)}", flush=True)
    return subprocess.Popen(args, cwd=ROOT, env=merged_env, shell=False)


def main() -> int:
    backend_port = find_free_port(BACKEND_START_PORT)
    api_target = f"http://localhost:{backend_port}"

    print(f"[run.py] backend port: {backend_port}", flush=True)
    print(f"[run.py] vite port: {VITE_PORT}", flush=True)
    print(f"[run.py] vite proxy target: {api_target}", flush=True)

    server = None
    vite = None
    children = []

    def shutdown(*_args):
        print("\n[run.py] stopping...", flush=True)
        for child in children:
            if child.poll() is None:
                child.terminate()
        for child in children:
            try:
                child.wait(timeout=5)
            except subprocess.TimeoutExpired:
                child.kill()

    signal.signal(signal.SIGINT, shutdown)
    signal.signal(signal.SIGTERM, shutdown)

    try:
        server = spawn("server", [NODE, "server/index.js"], {"PORT": str(backend_port)})
        children.append(server)
        vite = spawn(
            "vite",
            [NPM, "run", "dev", "--", "--port", VITE_PORT],
            {"VITE_API_TARGET": api_target},
        )
        children.append(vite)
    except Exception:
        shutdown()
        raise

    try:
        while True:
            for child in children:
                code = child.poll()
                if code is not None:
                    shutdown()
                    return code
            time.sleep(1)
    except KeyboardInterrupt:
        shutdown()
        return 0


if __name__ == "__main__":
    sys.exit(main())
