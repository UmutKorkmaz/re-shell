#!/usr/bin/env python3
"""Minimal smart-HTTP git server used by scripts/k8s-live-check.sh.

It serves the bare/non-bare repositories under a root directory by delegating to
`git http-backend` (the CGI that ships with git), so an in-cluster GitOps
controller (Flux, Argo CD) can clone a repository that only exists on the
machine running the test.

    git-http-server.py <root-dir> <port> [bind-address]

Prints "listening <address>:<port>" on stdout once it accepts connections.
Read-only: pushes are not enabled (the test commits to the repository with
plain `git commit` on the host).
"""
import http.server
import os
import socketserver
import subprocess
import sys
import urllib.parse


class GitBackendHandler(http.server.BaseHTTPRequestHandler):
    root = "."
    protocol_version = "HTTP/1.0"

    def _serve(self):
        parsed = urllib.parse.urlsplit(self.path)
        length = int(self.headers.get("Content-Length") or 0)
        body = self.rfile.read(length) if length else b""

        env = {
            "PATH": os.environ.get("PATH", "/usr/bin:/bin"),
            "GIT_PROJECT_ROOT": self.root,
            "GIT_HTTP_EXPORT_ALL": "1",
            "REQUEST_METHOD": self.command,
            "PATH_INFO": urllib.parse.unquote(parsed.path),
            "QUERY_STRING": parsed.query,
            "CONTENT_TYPE": self.headers.get("Content-Type", ""),
            "CONTENT_LENGTH": str(len(body)),
            "REMOTE_ADDR": self.client_address[0],
            "REMOTE_USER": "reshell-live",
            "SERVER_PROTOCOL": "HTTP/1.0",
        }
        if self.headers.get("Content-Encoding"):
            env["HTTP_CONTENT_ENCODING"] = self.headers["Content-Encoding"]
        if self.headers.get("Git-Protocol"):
            env["GIT_PROTOCOL"] = self.headers["Git-Protocol"]

        proc = subprocess.run(
            ["git", "http-backend"], input=body, env=env, capture_output=True
        )
        raw = proc.stdout
        head, _, payload = raw.partition(b"\r\n\r\n")
        if not _:
            head, _, payload = raw.partition(b"\n\n")
        status = 200
        headers = []
        for line in head.decode("latin-1").splitlines():
            if ":" not in line:
                continue
            key, value = line.split(":", 1)
            if key.lower() == "status":
                status = int(value.strip().split(" ", 1)[0])
            else:
                headers.append((key, value.strip()))
        self.send_response(status)
        for key, value in headers:
            self.send_header(key, value)
        self.send_header("Content-Length", str(len(payload)))
        self.end_headers()
        self.wfile.write(payload)

    do_GET = _serve
    do_POST = _serve

    def log_message(self, fmt, *args):  # keep test output quiet
        if os.environ.get("GIT_HTTP_SERVER_VERBOSE"):
            sys.stderr.write("git-http: " + (fmt % args) + "\n")


class Server(socketserver.ThreadingMixIn, http.server.HTTPServer):
    daemon_threads = True
    allow_reuse_address = True


def main():
    if len(sys.argv) < 3:
        sys.exit(__doc__)
    GitBackendHandler.root = os.path.abspath(sys.argv[1])
    port = int(sys.argv[2])
    bind = sys.argv[3] if len(sys.argv) > 3 else "0.0.0.0"
    server = Server((bind, port), GitBackendHandler)
    print("listening %s:%d" % (bind, server.server_address[1]), flush=True)
    server.serve_forever()


if __name__ == "__main__":
    main()
