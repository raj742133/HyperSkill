"""Live dashboard for a HyperSkill project: what is being made, tested and decided, as it happens.

`hyperskill.py live` serves site/live/ on 127.0.0.1 only:
  GET  /live/state.json   phases, checks, decisions, integrations and control state
  GET  /live/events       server-sent events: recent activity first, then every new line of .hyperskill/activity.jsonl
  POST /live/api/ACTION   the controls (pass or waive a check, advance, enable an integration, pause, send Claude an instruction ...)
With --read-only the POST route does not exist. Controls need the per-run token that only the served page carries, a
matching Host and Origin, and a JSON body; each runs through the same `hyperskill.py` command a person would type, so every
rule of the tracker (evidence required, gate must be clear) still applies. There is no way to run an arbitrary command from
here. Standard library only.
"""
import hmac
import http.server
import json
import os
import re
import secrets
import signal
import subprocess
import sys
import threading
import time
import webbrowser

_HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, _HERE)
import hs_activity as activity  # noqa: E402
import hs_catalog as cat  # noqa: E402
import hs_control as control  # noqa: E402
import hs_skills as skills  # noqa: E402
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
    "/live/catalog.json": (os.path.normpath(os.path.join(_HERE, "..", "skills", "hyperskill")), "catalog.json", "application/json"),
}
CSP = "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'"
RECENT = 300  # events sent to a browser that has just connected


_NAMES = {"at": 0.0, "names": set(), "root": None}


def installed_names(root):
    """installed_skill_names walks several folders; the page asks on every change, so reuse the answer for a few seconds."""
    if _NAMES["root"] != root or time.time() - _NAMES["at"] > 5:
        _NAMES.update(at=time.time(), names=core.installed_skill_names(root), root=root)
    return _NAMES["names"]


def integrations_state(root, st):
    reg = core.load_integrations()
    names = installed_names(root)
    rows = []
    for pid, prov in reg["providers"].items():
        inst, ok, why = core.provider_state(pid, prov, st, names)
        bundled = core.pack_skills(pid)
        rows.append({"id": pid, "name": prov.get("name") or pid, "kind": prov.get("kind"), "policy": prov.get("policy"),
                     "license": prov.get("license"), "bundled": len(bundled), "builtin": bool(prov.get("builtin")),
                     "installed": inst, "allowed": ok, "why": why, "enabled": pid in st["integrations"]["enabled"],
                     "disabled": pid in st["integrations"]["disabled"], "risks": prov.get("risks", [])[:4],
                     "install": (prov.get("install") or [])[:2]})
    slots = []
    cur = st["current"]
    if cur:
        ph = core.phase_def(core.load_gates(), cur)
        for slot in ph.get("slots", []):
            r = core.resolve_slot(slot, st, names, reg)
            slots.append({"slot": slot, "use": r["use"], "fallback": r["fallback"],
                          "options": [x["id"] for x in r["providers"]]})
    return rows, slots


def build_state(root, controls=False):
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
    rows, slots = integrations_state(root, st)
    return {
        "mode": "live", "name": st["name"], "current": st["current"], "tenancy": st["tenancy"],
        "unavailable": st["unavailable"], "commercial": st["commercial"], "phases": out,
        "decisions": [{"n": d["n"], "title": d["title"], "choice": activity.redact(d["choice"], 200)} for d in st["decisions"]],
        "integrations": rows, "slots": slots,
        "catalog": {"selected": cat.selected(st)},
        "extras": [dict(e, id=i) for i, e in st.get("extras", {}).items()],
        "skillplan": skills.plan(core, root, st, st["current"], installed_names(root)) if st["current"] else [],
        "control": {"enabled": controls, "paused": control.is_paused(root), "pending": len(control.pending(root)), "inbox": control.recent(root)},
    }


ID = re.compile(r"[a-z0-9][a-z0-9_-]{0,63}")
MAX_BODY = 8192


class Refused(Exception):
    pass


def text_field(body, name, limit=500, required=True):
    v = body.get(name, "")
    if not isinstance(v, str) or (required and not v.strip()) or len(v) > limit:
        raise Refused("%s is missing or longer than %d characters" % (name, limit))
    return v.strip()


def run_tracker(root, *argv):
    r = subprocess.run([sys.executable, os.path.join(_HERE, "hyperskill.py"), "--root", root, *argv],
                       capture_output=True, text=True, timeout=60, stdin=subprocess.DEVNULL)
    out = ((r.stdout or "") + (r.stderr or "")).strip()
    return {"ok": r.returncode == 0, "output": activity.redact(out[-900:], 900)}


def perform(root, action, body):
    """One dashboard control. Ids are checked against the real phase and provider lists before anything runs."""
    phases = core.load_gates()
    reg = core.load_integrations()

    def phase():
        pid = text_field(body, "phase", 40)
        match = next((p for p in phases if p["id"] == pid), None)
        if not match:
            raise Refused("unknown phase")
        return match

    def item(ph):
        iid = text_field(body, "item", 80)
        if iid not in {i["id"] for i in ph["gate"]}:
            raise Refused("unknown check")
        return iid

    if action == "pass":
        ph = phase()
        return run_tracker(root, "gate", ph["id"], "--pass", item(ph), "--evidence", text_field(body, "evidence"))
    if action == "waive":
        ph = phase()
        return run_tracker(root, "gate", ph["id"], "--waive", item(ph), "--reason", text_field(body, "reason"))
    if action == "waive_unavailable":
        return run_tracker(root, "gate", phase()["id"], "--waive-unavailable")
    if action == "advance":
        return run_tracker(root, "advance")
    if action == "skip":
        return run_tracker(root, "skip", phase()["id"], "--reason", text_field(body, "reason"))
    if action == "decide":
        return run_tracker(root, "decide", "--title", text_field(body, "title", 120), "--choice", text_field(body, "choice", 300),
                           "--why", text_field(body, "why", 400))
    if action == "note":
        return run_tracker(root, "log", text_field(body, "text", 300))
    if action in ("pause", "resume"):
        return run_tracker(root, action)
    if action == "say":
        return run_tracker(root, "say", text_field(body, "text", control.MAX_TEXT))
    if action == "pull":  # the person clicked the button: that is the user's yes for an opt-in skill
        pid = text_field(body, "id", 64)
        if not ID.fullmatch(pid) or pid not in reg["providers"]:
            raise Refused("unknown integration")
        return run_tracker(root, "skills", "pull", pid, "--user-approved", "--why", "pulled from the dashboard")
    if action in ("skill_use", "skill_skip"):
        slot = text_field(body, "slot", 64)
        if not ID.fullmatch(slot) or slot not in reg["slots"]:
            raise Refused("unknown slot")
        argv = ["skills", "use" if action == "skill_use" else "skip", slot, "--why", text_field(body, "why")]
        prov = body.get("provider")
        if action == "skill_use" and isinstance(prov, str) and ID.fullmatch(prov) and prov in reg["providers"]:
            argv += ["--provider", prov]
        return run_tracker(root, *argv)
    if action == "catalog_apply":
        ids = body.get("ids")
        if not isinstance(ids, list) or len(ids) > 1000 or not all(isinstance(i, str) and re.fullmatch(r"[a-z0-9][a-z0-9_/-]{0,120}", i) for i in ids):
            raise Refused("ids must be a list of catalogue ids")
        res = run_tracker(root, "catalog", "set", *ids)
        if res["ok"] and body.get("tell_claude") is True:
            control.push(root, "The user changed what to use in the dashboard (%d items picked). Run `hyperskill.py catalog brief` and follow it, "
                               "and close the selected checks with `hyperskill.py extras`." % len(ids))
        return res
    if action in ("extra_done", "extra_waive"):
        eid = text_field(body, "id", 130)
        if not re.fullmatch(r"[a-z0-9][a-z0-9_/-]{0,120}", eid) or eid not in core.load_state(root).get("extras", {}):
            raise Refused("unknown selected check")
        if action == "extra_done":
            return run_tracker(root, "extras", "done", eid, "--evidence", text_field(body, "evidence"))
        return run_tracker(root, "extras", "waive", eid, "--reason", text_field(body, "reason"))
    if action in ("enable", "disable"):
        pid = text_field(body, "id", 64)
        if not ID.fullmatch(pid) or pid not in reg["providers"]:
            raise Refused("unknown integration")
        return run_tracker(root, "integrations", action, pid)
    if action == "enable_all":
        return run_tracker(root, "integrations", "enable", "--all", *(["--include-opt-in"] if body.get("opt_in") is True else []))
    raise Refused("unknown action")


def make_handler(root, port, token=None):
    allowed_hosts = {"127.0.0.1:%d" % port, "localhost:%d" % port, "[::1]:%d" % port}
    lock = threading.Lock()

    class Handler(http.server.BaseHTTPRequestHandler):
        server_version = "hyperskill-live"
        protocol_version = "HTTP/1.1"

        def log_message(self, *args):
            return  # quiet: the dashboard must not spam the terminal it was started from

        def setup(self):
            super().setup()
            self.server.last_seen = time.time()

        def _send(self, status, body, ctype, extra=None):
            self.server.last_seen = time.time()
            self.send_response(status)
            self.send_header("Content-Type", ctype)
            self.send_header("Content-Length", str(len(body)))
            self.send_header("Cache-Control", "no-store")
            self.send_header("Content-Security-Policy", CSP)
            self.send_header("X-Content-Type-Options", "nosniff")
            self.send_header("Referrer-Policy", "no-referrer")
            if self.command == "POST" and status >= 400:
                self.close_connection = True  # the body may be unread; do not parse it as the next request
                self.send_header("Connection", "close")
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
                        if token:  # the controls' key travels only inside the page this server hands out
                            body = body.replace(b'name="hs-token" content=""', b'name="hs-token" content="' + token.encode() + b'"')
                    return self._send(200, body, ctype)
                except OSError:
                    return self._send(404, b"not found", "text/plain")
            if path == "/live/state.json":
                try:
                    return self._send(200, json.dumps(build_state(root, bool(token))).encode(), "application/json")
                except (OSError, ValueError, KeyError, SystemExit):
                    return self._send(500, b'{"error":"state unavailable"}', "application/json")
            if path == "/live/events":
                return self._events()
            return self._send(404, b"not found", "text/plain")

        def do_POST(self):
            if not token:
                return self._send(405, b'{"error":"this dashboard is read-only"}', "application/json")
            host = self.headers.get("Host", "")
            origin = self.headers.get("Origin")
            if host not in allowed_hosts or (origin is not None and origin != "http://" + host):
                return self._send(403, b'{"error":"forbidden origin"}', "application/json")
            if not hmac.compare_digest(self.headers.get("X-HS-Token", ""), token):
                return self._send(403, b'{"error":"missing or wrong token"}', "application/json")
            if not self.headers.get("Content-Type", "").startswith("application/json"):
                return self._send(415, b'{"error":"send JSON"}', "application/json")
            m = re.fullmatch(r"/live/api/([a-z_]{1,24})", self.path.split("?")[0])
            if not m:
                return self._send(404, b'{"error":"not found"}', "application/json")
            try:
                n = int(self.headers.get("Content-Length", "0"))
                if n < 0 or n > MAX_BODY:
                    return self._send(413, b'{"error":"too large"}', "application/json")
                body = json.loads(self.rfile.read(n) or b"{}")
                if not isinstance(body, dict):
                    raise ValueError
                with lock:
                    result = perform(root, m.group(1), body)
                return self._send(200, json.dumps(result).encode(), "application/json")
            except Refused as exc:
                return self._send(400, json.dumps({"ok": False, "output": str(exc)}).encode(), "application/json")
            except (ValueError, subprocess.TimeoutExpired, OSError):
                return self._send(400, b'{"ok":false,"output":"could not do that"}', "application/json")

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
            self.server.streams += 1

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
                    self.server.last_seen = time.time()
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
            finally:
                self.server.streams -= 1

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
    streams = 0
    last_seen = 0.0


def make_server(root, port=4777, tries=10, controls=False):
    """Bind 127.0.0.1 only, on the first free port from `port`. Controls are off unless asked for."""
    last = None
    token = secrets.token_urlsafe(24) if controls else None
    for p in range(port, port + tries):
        try:
            srv = Server(("127.0.0.1", p), make_handler(root, p, token))
            srv.token = token
            return srv, p
        except OSError as exc:
            last = exc
    raise OSError("no free port from %d to %d: %s" % (port, port + tries - 1, last))


def live_file(root):
    return os.path.join(root, ".hyperskill", "live.json")


def read_live(root):
    """The running dashboard of this project as {pid, port, url}, or None when there is none (a stale file is removed)."""
    try:
        with open(live_file(root), encoding="utf-8") as f:
            info = json.load(f)
        pid, port = int(info["pid"]), int(info["port"])
        with open("/proc/%d/cmdline" % pid, "rb") as f:
            cmd = f.read()
        if b"hyperskill" not in cmd:
            raise ValueError("pid reused")
    except (OSError, ValueError, KeyError, TypeError):
        try:
            os.remove(live_file(root))
        except OSError:
            pass
        return None
    return {"pid": pid, "port": port, "url": "http://127.0.0.1:%d/" % port}


def ensure(root, port=4777, idle_hours=4, wait=3.0):
    """Start the dashboard in the background unless this project's is already running. Returns its URL, or None."""
    info = read_live(root)
    if info:
        return info["url"]
    argv = [sys.executable, os.path.join(_HERE, "hyperskill.py"), "--root", root, "live", "--no-open", "--port", str(port),
            "--idle-hours", str(idle_hours)]
    kw = {"start_new_session": True} if os.name != "nt" else {}
    subprocess.Popen(argv, stdin=subprocess.DEVNULL, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, **kw)
    end = time.time() + wait
    while time.time() < end:
        info = read_live(root)
        if info:
            return info["url"]
        time.sleep(0.1)
    return None


def stop(root):
    """Stop this project's dashboard. Returns True if one was running."""
    info = read_live(root)
    if not info:
        return False
    try:
        os.kill(info["pid"], 15)
    except OSError:
        return False
    return True


def serve(root, port=4777, open_browser=True, control=True, idle_hours=0):
    core.load_state(root)  # fail early with the usual message when this is not a HyperSkill project
    if read_live(root):
        print("HyperSkill live view is already running: %s" % read_live(root)["url"])
        return
    server, p = make_server(root, port, controls=control)
    url = "http://127.0.0.1:%d/" % p
    os.makedirs(os.path.dirname(live_file(root)), exist_ok=True)
    with open(live_file(root), "w", encoding="utf-8") as f:
        json.dump({"pid": os.getpid(), "port": p, "started": activity.now()}, f)
    print("HyperSkill live view: %s" % url, flush=True)
    print("Controls on (pass checks, advance, enable skills, pause, instruct Claude), this computer only. Press Ctrl+C to stop."
          if control else "Read-only, this computer only. Press Ctrl+C to stop.", flush=True)
    if open_browser:
        threading.Thread(target=lambda: webbrowser.open(url), daemon=True).start()
    server.last_seen = time.time()
    if idle_hours:
        def watchdog():
            while True:
                time.sleep(30)
                if server.streams == 0 and time.time() - server.last_seen > idle_hours * 3600:
                    server.shutdown()
                    return
        threading.Thread(target=watchdog, daemon=True).start()
    signal.signal(signal.SIGTERM, lambda *_: threading.Thread(target=server.shutdown, daemon=True).start())
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("stopped")
    finally:
        server.server_close()
        try:
            os.remove(live_file(root))
        except OSError:
            pass
