#!/usr/bin/env python3
"""Serve the production frontend build with single-page-app routing."""

from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import unquote, urlparse


ROOT = Path(__file__).resolve().parents[1] / "frontend" / "build"


class SpaHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def do_GET(self):
        request_path = unquote(urlparse(self.path).path).lstrip("/")
        candidate = ROOT / request_path
        if request_path and not candidate.is_file():
            self.path = "/index.html"
        super().do_GET()


if __name__ == "__main__":
    if not (ROOT / "index.html").is_file():
        raise SystemExit("Frontend build is missing. Run `npm run build` first.")

    server = ThreadingHTTPServer(("127.0.0.1", 3000), SpaHandler)
    print("Serving frontend at http://127.0.0.1:3000", flush=True)
    server.serve_forever()
