import functools, http.server, socketserver, socket
DIRECTORY = "/Users/jinaygala/stout-3d"
PORT = 4192
class H(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0")
        self.send_header("Pragma", "no-cache"); self.send_header("Expires", "0")
        super().end_headers()
# Dual-stack IPv6 bind so BOTH http://localhost and http://127.0.0.1 resolve
# (Chrome often prefers ::1 for "localhost"; an IPv4-only bind would 404 there).
class Server(socketserver.ThreadingTCPServer):
    address_family = socket.AF_INET6
    allow_reuse_address = True
with Server(("::", PORT), functools.partial(H, directory=DIRECTORY)) as httpd:
    print(f"Serving {DIRECTORY} at http://localhost:{PORT}"); httpd.serve_forever()
