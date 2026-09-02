"""Dev server for the Stout 3D planner.

Two jobs beyond serving files:
  1. no-store headers, so an edit is always the thing you see;
  2. cache-busting that a human can't forget — index.html ships `?v=DEV` and this
     rewrites it to a hash of the asset's own bytes on the way out. Forgetting to
     bump a version string by hand has cost us a session before now.
"""
import functools, hashlib, http.server, os, socket, socketserver

DIRECTORY = "/Users/jinaygala/stout-3d"
PORT = 4192


def stamp(rel_path):
    """Short content hash for an asset, so the query changes only when it does."""
    full = os.path.join(DIRECTORY, rel_path)
    try:
        with open(full, "rb") as fh:
            return hashlib.sha1(fh.read()).hexdigest()[:10]
    except OSError:
        return "0"


class H(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0")
        self.send_header("Pragma", "no-cache")
        self.send_header("Expires", "0")
        super().end_headers()

    def send_head(self):
        # index.html is rewritten in flight; everything else is served as-is
        if self.path.split("?")[0] in ("/", "/index.html"):
            return self._send_index()
        return super().send_head()

    def _send_index(self):
        with open(os.path.join(DIRECTORY, "index.html"), "rb") as fh:
            html = fh.read().decode("utf-8")
        for rel in ("assets/planner.css", "assets/catalog.js", "assets/planner.js"):
            html = html.replace(rel + "?v=DEV", "%s?v=%s" % (rel, stamp(rel)))
        body = html.encode("utf-8")
        self.send_response(200)
        self.send_header("Content-Type", "text/html; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        import io
        return io.BytesIO(body)


# Dual-stack IPv6 bind so BOTH http://localhost and http://127.0.0.1 resolve
# (Chrome often prefers ::1 for "localhost"; an IPv4-only bind would 404 there).
class Server(socketserver.ThreadingTCPServer):
    address_family = socket.AF_INET6
    allow_reuse_address = True


with Server(("::", PORT), functools.partial(H, directory=DIRECTORY)) as httpd:
    print("Serving %s at http://localhost:%d" % (DIRECTORY, PORT))
    httpd.serve_forever()
