"""The code view's data: a file tree, a file's text and a file's diff, for the dashboard. Read-only.

Everything is confined to the project folder. A request is refused if its path leaves the folder (including through a symlink), names
HyperSkill's own state or keys, names a file that usually holds secrets (.env, private keys, certificates), or is not text. Lines that
look like secrets are replaced before they are sent, so the dashboard never shows a key it should not.
"""
import os
import re
import subprocess

import hs_activity as activity
import hs_adopt as adopt

SKIP_DIRS = adopt.SKIP_DIRS | {".hyperskill", ".git"}
MAX_TREE = 4000
MAX_FILE = 512 * 1024
MAX_DIFF = 400 * 1024
SECRET_NAMES = re.compile(r"(^\.env($|\.)|\.pem$|\.key$|\.p12$|\.pfx$|\.jks$|^id_(rsa|dsa|ecdsa|ed25519)|\.keystore$|^\.netrc$|^\.npmrc$|^\.pypirc$|credentials(\.json)?$)", re.I)
HIDDEN = "[hidden: this line looks like a secret]"


class CodeError(Exception):
    pass


def _git(root, *args, limit=MAX_DIFF):
    try:
        r = subprocess.run(["git", "-C", root] + list(args), capture_output=True, timeout=20)
    except (OSError, subprocess.TimeoutExpired):
        return None
    if r.returncode not in (0, 1):
        return None
    return r.stdout[:limit].decode("utf-8", errors="replace")


def safe(root, rel):
    """The absolute path of a readable project file, or CodeError."""
    root_real = os.path.realpath(root)
    if not rel or "\x00" in rel or rel.startswith(("/", "\\")) or re.match(r"^[A-Za-z]:", rel):
        raise CodeError("not a project path")
    parts = [p for p in re.split(r"[\\/]+", rel) if p not in ("", ".")]
    if ".." in parts or not parts:
        raise CodeError("not a project path")
    if any(p in SKIP_DIRS for p in parts[:-1]) or parts[0] in SKIP_DIRS:
        raise CodeError("that folder is not shown")
    if SECRET_NAMES.search(parts[-1]):
        raise CodeError("that file usually holds secrets and is not shown")
    full = os.path.join(root_real, *parts)
    real = os.path.realpath(full)
    if os.path.commonpath([real, root_real]) != root_real:
        raise CodeError("that path leaves the project")
    if not os.path.isfile(real):
        raise CodeError("no such file")
    if os.path.islink(full):
        raise CodeError("symlinks are not followed")
    return "/".join(parts), real


def _mask(text):
    out = []
    for line in text.split("\n"):
        if len(line) < 800 and any(rx.search(line) for _, rx in adopt.SECRET_PATTERNS):
            out.append(HIDDEN)
        else:
            out.append(line)
    return "\n".join(out)


def _status(root):
    """{path: letter} from git status; empty when the folder is not a repository."""
    out = _git(root, "status", "--porcelain", "-uall", limit=2 * 1024 * 1024)
    res = {}
    for line in (out or "").splitlines():
        if len(line) > 3:
            code, path = line[:2], line[3:].strip().strip('"')
            if " -> " in path:
                path = path.split(" -> ")[1]
            res[path] = "A" if code.strip() in ("??", "A") else "D" if "D" in code else "M"
    return res


def tree(root):
    root = os.path.abspath(root)
    status = _status(root)
    recent = []
    for e in reversed(activity.read_events(root, 0, 400)[0]):
        if e.get("type") == "file" and e.get("path"):
            p = os.path.relpath(e["path"], root) if os.path.isabs(e["path"]) else e["path"]
            p = p.replace(os.sep, "/")
            if p not in [r["path"] for r in recent] and not p.startswith(".."):
                recent.append({"path": p, "action": e.get("action"), "ts": e.get("ts")})
        if len(recent) >= 12:
            break
    files = []
    truncated = False
    for dirpath, dirnames, filenames in os.walk(root, followlinks=False):
        dirnames[:] = sorted(d for d in dirnames if d not in SKIP_DIRS and not os.path.islink(os.path.join(dirpath, d)))
        for fn in sorted(filenames):
            full = os.path.join(dirpath, fn)
            if os.path.islink(full) or SECRET_NAMES.search(fn):
                continue
            rel = os.path.relpath(full, root).replace(os.sep, "/")
            try:
                size = os.path.getsize(full)
            except OSError:
                continue
            files.append({"path": rel, "size": size, "status": status.get(rel, "")})
            if len(files) >= MAX_TREE:
                truncated = True
                break
        if truncated:
            break
    seen = {f["path"] for f in files}
    for p, st in status.items():           # deleted files are not on disk but belong in "changed"
        if st == "D" and p not in seen and not p.startswith(".hyperskill/"):
            files.append({"path": p, "size": 0, "status": "D"})
    return {"files": files, "changed": sum(1 for f in files if f["status"]), "recent": recent, "git": bool(_git(root, "rev-parse", "--is-inside-work-tree")), "truncated": truncated}


def read(root, rel):
    rel, full = safe(root, rel)
    size = os.path.getsize(full)
    if size > MAX_FILE:
        return {"path": rel, "size": size, "text": None, "note": "larger than %d KB: not shown" % (MAX_FILE // 1024)}
    with open(full, "rb") as f:
        data = f.read(MAX_FILE + 1)
    if b"\x00" in data[:8192]:
        return {"path": rel, "size": size, "text": None, "note": "binary file"}
    text = _mask(data.decode("utf-8", errors="replace"))
    return {"path": rel, "size": size, "text": text, "lines": text.count("\n") + 1}


def diff(root, rel):
    root = os.path.abspath(root)
    try:
        rel, full = safe(root, rel)
    except CodeError:
        # a deleted file is not on disk: allow it only when git says it was tracked
        clean = "/".join(p for p in re.split(r"[\\/]+", rel or "") if p not in ("", "."))
        if not clean or ".." in clean.split("/") or clean.startswith(".hyperskill") or SECRET_NAMES.search(clean.split("/")[-1]) or _status(root).get(clean) != "D":
            raise
        rel, full = clean, None
    st = _status(root).get(rel, "")
    if st != "A":
        out = _git(root, "diff", "HEAD", "--no-color", "--unified=3", "--", rel)
        if out is None:
            out = _git(root, "diff", "--no-color", "--unified=3", "--", rel) or ""
        return {"path": rel, "status": st or "unchanged", "diff": _mask(out)}
    if st == "A":                                   # new file: show it as all additions
        info = read(root, rel)
        if info.get("text") is None:
            return {"path": rel, "status": "A", "diff": "", "note": info.get("note")}
        body = info["text"].split("\n")
        return {"path": rel, "status": "A", "diff": "--- /dev/null\n+++ b/%s\n@@ -0,0 +1,%d @@\n%s" % (rel, len(body), "\n".join("+" + l for l in body))}
    return {"path": rel, "status": st or "unchanged", "diff": ""}
