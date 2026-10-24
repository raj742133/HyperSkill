"""Test helper: the dashboard now answers only a signed-in browser, so every test client sends the session cookie of the server it talks to.

Importing this module patches `hs_live.make_server` to remember each server's cookie, and `http.client.HTTPConnection.request` to attach
it. A test that wants to be anonymous passes the header `X-Anonymous: 1` (it is removed before sending).
"""
import http.client
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "scripts"))
import hs_live  # noqa: E402

COOKIES = {}
_make = hs_live.make_server
_request = http.client.HTTPConnection.request


def make_server(*a, **kw):
    srv, port = _make(*a, **kw)
    COOKIES[port] = "%s=%s" % (hs_live.COOKIE % port, srv.session)
    return srv, port


def request(self, method, url, body=None, headers=None, **kw):
    headers = dict(headers or {})
    if headers.pop("X-Anonymous", None) is None and self.port in COOKIES and "Cookie" not in headers:
        headers["Cookie"] = COOKIES[self.port]
    return _request(self, method, url, body=body, headers=headers, **kw)


if hs_live.make_server is _make:
    hs_live.make_server = make_server
    http.client.HTTPConnection.request = request


def confirm_items(root, phase=None):
    """Play the person: confirm every item that needs the user's own word, the way the dashboard's Confirm button does (with its key)."""
    import json
    import subprocess
    key_path = os.path.join(root, ".hyperskill", "live.key")
    had = os.path.exists(key_path)
    if not had:
        with open(key_path, "w", encoding="utf-8") as f:
            f.write("test-confirm-key")
    with open(key_path, encoding="utf-8") as f:
        key = f.read().strip()
    tracker = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "scripts", "hyperskill.py")
    with open(os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "skills", "hyperskill", "gates.json"), encoding="utf-8") as f:
        phases = json.load(f)["phases"]
    for ph in phases:
        if phase and ph["id"] != phase:
            continue
        for it in ph["gate"]:
            if it.get("confirm"):
                subprocess.run([sys.executable, tracker, "--root", root, "gate", ph["id"], "--confirm", it["id"]], check=True, capture_output=True,
                               env=dict(os.environ, HYPERSKILL_CONFIRM_KEY=key))
    if not had:
        os.remove(key_path)


def seed_docs(root):
    """The files that tests cite as evidence, so a pass really can point at something that exists."""
    for rel in ("docs/evidence.md", "docs/research.md", "docs/security/audit.md", "docs/system-design.md", "docs/launch.md"):
        path = os.path.join(root, rel)
        os.makedirs(os.path.dirname(path), exist_ok=True)
        with open(path, "w", encoding="utf-8") as f:
            f.write("test evidence\n")


def write_state(root, st):
    """Save a hand-built state the way the tracker would (signed), for tests that need a state no command can reach."""
    sys.path.insert(0, os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "scripts"))
    import hyperskill as core
    core.save_state(root, st)
