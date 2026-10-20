"""Live dashboard for a HyperSkill project: what is being made, tested and decided, as it happens.

`hyperskill.py live` serves site/live/ plus two data routes, read-only and on 127.0.0.1 only:
  GET /live/state.json   phases, checks and decisions merged from gates.json and .hyperskill/state.json
  GET /live/events       server-sent events: recent activity first, then every new line of .hyperskill/activity.jsonl
Nothing here writes to the project. Standard library only.
"""
import http.server
import json
import os
import sys
import threading
import time
import webbrowser

_HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, _HERE)
import hs_activity as activity  # noqa: E402
import hyperskill as core  # noqa: E402

LIVE_DIR = os.path.normpath(os.path.join(_HERE, "..", "site", "live"))
SITE_DIR = os.path.normpath(os.path.join(_HERE, "..", "site"))
# The same URLs as on the public site (/live, /live/live.css, ...), so one page works in both places.
STATIC = {  # the only files this server will ever send
    "/": (LIVE_DIR, "index.html", "text/html; charset=utf-8"),
    "/live": (LIVE_DIR, "index.html", "text/html; charset=utf-8"),
    "/live/": (LIVE_DIR, "index.html", "text/html; charset=utf-8"),
    "/live/live.css": (LIVE_DIR, "live.css", "text/css; charset=utf-8"),
    "/live/live.js": (LIVE_DIR, "live.js", "text/javascript; charset=utf-8"),
    "/favicon.svg": (SITE_DIR, "favicon.svg", "image/svg+xml"),
}
CSP = "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'"
RECENT = 300  # events sent to a browser that has just connected


def build_state(root):
    """Everything the page needs to draw the phase rail, the open checks and the decisions."""
    phases = core.load_gates()
    st = core.load_state(root)
    out = []
    for p in phases:
        rec = st["phases"][p["id"]]
        items = []
        for it in p["gate"]:
            r = rec["gate"].get(it["id"])
            applies = core.applies(st, it)
            state = "na" if not applies else (r["state"] if r else "open")
            row = {"id": it["id"], "text": core.item_text(st, it), "state": state}
            if it.get("needs"):
                row["needs"] = it["needs"]
            if r:
                row["note"] = activity.redact(r.get("evidence") or r.get("reason") or "", 300)
            items.append(row)
        counted = [i for i in items if i["state"] != "na"]
        out.append({"id": p["id"], "title": p["title"], "skill": p["skill"], "status": rec["status"],
                    "done": sum(1 for i in counted if i["state"] != "open"), "total": len(counted), "items": items})
    return {
        "mode": "live", "name": st["name"], "current": st["current"], "tenancy": st["tenancy"],
        "unavailable": st["unavailable"], "commercial": st["commercial"], "phases": out,
        "decisions": [{"n": d["n"], "title": d["title"], "choice": activity.redact(d["choice"], 200)} for d in st["decisions"]],
    }


def make_handler(root, port):
    allowed_hosts = {"127.0.0.1:%d" % port, "localhost:%d" % port, "[::1]:%d" % port}

    class Handler(http.server.BaseHTTPRequestHandler):
        server_version = "hyperskill-live"
        protocol_version = "HTTP/1.1"

        def log_message(self, *args):
            return  # quiet: the dashboard must not spam the terminal it was started from

        def _send(self, status, body, ctype, extra=None):
            self.send_response(status)
            self.send_header("Content-Type", ctype)
            self.send_header("Content-Length", str(len(body)))
            self.send_header("Cache-Control", "no-store")
            self.send_header("Content-Security-Policy", CSP)
            self.send_header("X-Content-Type-Options", "nosniff")
            self.send_header("Referrer-Policy", "no-referrer")
            for k, v in (extra or {}).items():
                self.send_header(k, v)
            self.end_headers()
            self.wfile.write(body)

        def do_GET(self):
            # A web page on another site must not be able to read this: refuse any Host header that is not ours (DNS rebinding).
            if self.headers.get("Host", "") not in allowed_hosts:
                return self._send(403, b'{"error":"forbidden host"}', "application/json")
            path = self.path.split("?")[0]
            if path in STATIC:
                folder, name, ctype = STATIC[path]
                try:
                    with open(os.path.join(folder, name), "rb") as f:
                        body = f.read()
                    if name == "index.html":  # tell the page it is the live one, so it never has to probe for a server
                        body = body.replace(b'name="hs-mode" content="replay"', b'name="hs-mode" content="live"')
                    return self._send(200, body, ctype)
                except OSError:
                    return self._send(404, b"not found", "text/plain")
            if path == "/live/state.json":
                try:
                    return self._send(200, json.dumps(build_state(root)).encode(), "application/json")
                except (OSError, ValueError, KeyError, SystemExit):
                    return self._send(500, b'{"error":"state unavailable"}', "application/json")
            if path == "/live/events":
                return self._events()
            return self._send(404, b"not found", "text/plain")

        def _events(self):
            last_id = self.headers.get("Last-Event-ID", "")
            self.send_response(200)
            self.send_header("Content-Type", "text/event-stream")
            self.send_header("Cache-Control", "no-store")
            self.send_header("Content-Security-Policy", CSP)
            self.send_header("X-Accel-Buffering", "no")
            self.send_header("Connection", "keep-alive")
            self.end_headers()
            state_file = core.state_file(root)

            def mtime():
                try:
                    return os.path.getmtime(state_file)
                except OSError:
                    return 0

            try:
                if last_id.isdigit():
                    events, offset = activity.read_events(root, int(last_id))
                else:
                    events, offset = activity.read_events(root, 0, limit=RECENT)
                seen_mtime = mtime()
                last_beat = time.time()
                self._write_batch(events, offset)
                self._write("event: state\ndata: {}\n\n")
                while True:
                    time.sleep(0.4)
                    events, offset2 = activity.read_events(root, offset)
                    if events:
                        self._write_batch(events, offset2)
                        offset = offset2
                        last_beat = time.time()
                    elif offset2 != offset:
                        offset = offset2
                    m = mtime()
                    if m != seen_mtime:
                        seen_mtime = m
                        self._write("event: state\ndata: {}\n\n")
                        last_beat = time.time()
                    if time.time() - last_beat > 15:
                        self._write(": keep-alive\n\n")
                        last_beat = time.time()
            except (BrokenPipeError, ConnectionResetError, ConnectionAbortedError):
                return  # the browser tab was closed: that is the normal way for this stream to end

        def _write(self, text):
            self.wfile.write(text.encode("utf-8"))
            self.wfile.flush()

        def _write_batch(self, events, offset):
            for i, e in enumerate(events):
                tail = "id: %d\n" % offset if i == len(events) - 1 else ""
                self._write("%sevent: activity\ndata: %s\n\n" % (tail, json.dumps(e, ensure_ascii=False)))

    return Handler


class Server(http.server.ThreadingHTTPServer):
    daemon_threads = True
    allow_reuse_address = True


def make_server(root, port=4777, tries=10):
    """Bind 127.0.0.1 only, on the first free port from `port`."""
    last = None
    for p in range(port, port + tries):
        try:
            return Server(("127.0.0.1", p), make_handler(root, p)), p
        except OSError as exc:
            last = exc
    raise OSError("no free port from %d to %d: %s" % (port, port + tries - 1, last))


def serve(root, port=4777, open_browser=True):
    core.load_state(root)  # fail early with the usual message when this is not a HyperSkill project
    server, p = make_server(root, port)
    url = "http://127.0.0.1:%d/" % p
    print("HyperSkill live view: %s" % url)
    print("Read-only, this computer only. Press Ctrl+C to stop.")
    if open_browser:
        threading.Thread(target=lambda: webbrowser.open(url), daemon=True).start()
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("stopped")
    finally:
        server.server_close()
