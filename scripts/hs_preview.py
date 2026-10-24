"""The live preview: what is being built, shown in the dashboard.

A target is either a web address on this computer (a dev server such as http://localhost:3000) or a file in the project (a built page, a
`SKILL.md`). Addresses must be loopback; files must be a plain web or text type inside the project, never a hidden file, a dependency
folder, a script's secrets or anything outside it. Project files are served with a CSP sandbox so a page in the preview can never read
the dashboard's key. Standard library only.
"""
import os
import re
import socket
import threading
import time
import urllib.error
import urllib.request
from urllib.parse import urlparse

MAX_TARGETS = 12
LOOPBACK = {"127.0.0.1", "localhost", "[::1]", "::1"}
PORTS = list(range(3000, 3011)) + [4000, 4200, 4321, 5000, 5173, 5174, 5175, 6006, 8000, 8001, 8080, 8081, 8888, 9000]
FILE_TYPES = {".html": "text/html; charset=utf-8", ".htm": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8", ".js": "text/javascript; charset=utf-8",
              ".mjs": "text/javascript; charset=utf-8", ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg",
              ".webp": "image/webp", ".gif": "image/gif", ".ico": "image/x-icon", ".woff": "font/woff", ".woff2": "font/woff2", ".txt": "text/plain; charset=utf-8",
              ".md": "text/plain; charset=utf-8"}
BLOCKED = {"node_modules", ".git", ".hyperskill", ".claude", "__pycache__", ".next", ".venv", "venv"}
_CACHE = {"at": 0, "port": None, "rows": []}
_LOCK = threading.Lock()


class PreviewError(Exception):
    pass


def check_url(url):
    u = urlparse(str(url or "").strip())
    if u.scheme not in ("http", "https") or (u.hostname or "").lower() not in {h.strip("[]") for h in LOOPBACK} or not u.port:
        raise PreviewError("only addresses on this computer with a port are allowed, such as http://localhost:3000")
    if u.username or u.password:
        raise PreviewError("no credentials in the address")
    return "%s://%s:%d%s" % (u.scheme, "localhost" if u.hostname in ("localhost",) else u.hostname, u.port, u.path if u.path else "/")


def safe_rel(root, rel):
    """A project-relative path that is safe to serve, or an error."""
    rel = str(rel or "").replace("\\", "/").lstrip("/")
    parts = [p for p in rel.split("/") if p]
    if not parts or any(p in (".", "..") or p.startswith(".") or p in BLOCKED for p in parts):
        raise PreviewError("that path is not available for preview")
    ext = os.path.splitext(parts[-1])[1].lower()
    if ext not in FILE_TYPES:
        raise PreviewError("%s files cannot be previewed" % (ext or "extensionless"))
    full = os.path.realpath(os.path.join(root, *parts))
    if not full.startswith(os.path.realpath(root) + os.sep) or not os.path.isfile(full):
        raise PreviewError("no such file in the project")
    return "/".join(parts), full, FILE_TYPES[ext]


def targets(st):
    return list(st.get("preview", {}).get("targets", []))


def add(core, root, st, name, url=None, path=None):
    name = re.sub(r"\s+", " ", str(name or "").strip())[:40]
    if not name:
        core.die("give the preview a name.")
    t = {"name": name}
    if url:
        t["url"] = check_url(url)
        t["kind"] = "web"
    elif path:
        t["path"] = safe_rel(root, path)[0]
        t["kind"] = "file"
    else:
        core.die("give --url or --path.")
    p = st.setdefault("preview", {"targets": []})
    p["targets"] = [x for x in p["targets"] if x["name"] != name] + [t]
    if len(p["targets"]) > MAX_TARGETS:
        p["targets"] = p["targets"][-MAX_TARGETS:]
    core.activity.append(root, "note", "Preview added: %s" % name)
    return t


def remove(core, st, name):
    p = st.get("preview", {"targets": []})
    if not any(x["name"] == name for x in p["targets"]):
        core.die("no preview named '%s'." % name)
    p["targets"] = [x for x in p["targets"] if x["name"] != name]


def _title(port):
    try:
        req = urllib.request.Request("http://127.0.0.1:%d/" % port, headers={"User-Agent": "hyperskill-detect"})
        with urllib.request.urlopen(req, timeout=0.8) as r:
            body = r.read(20000).decode("utf-8", "replace")
        m = re.search(r"(?is)<title[^>]*>(.*?)</title>", body)
        return re.sub(r"\s+", " ", m.group(1)).strip()[:60] if m else ""
    except (OSError, urllib.error.URLError, ValueError):
        return None


def detect(skip_port=None):
    """Dev servers answering HTTP on this computer's usual ports, cached for a few seconds."""
    with _LOCK:
        if time.time() - _CACHE["at"] < 4 and _CACHE["port"] == skip_port:
            return list(_CACHE["rows"])
    rows = []
    for port in PORTS:
        if port == skip_port:
            continue
        try:
            with socket.create_connection(("127.0.0.1", port), timeout=0.12):
                pass
        except OSError:
            continue
        title = _title(port)
        if title is not None:
            rows.append({"url": "http://localhost:%d/" % port, "port": port, "title": title})
    with _LOCK:
        _CACHE.update(at=time.time(), port=skip_port, rows=rows)
    return rows
