"""What the dashboard may change besides the gates: pause/resume and instructions for Claude.

  <project>/.hyperskill/control.json   {"paused": true|false}
  <project>/.hyperskill/inbox.jsonl    one instruction per line: {"id", "ts", "text", "delivered"}

The plugin hook reads both: while paused it refuses file writes, edits and shell commands, and it hands every pending
instruction to Claude (once) as extra context. Local files only. Standard library only.
"""
import json
import os
import re
import time

MAX_TEXT = 1000
MAX_PENDING = 20
ALLOWED_WHILE_PAUSED = re.compile(r"hyperskill\.py[\"']?\s+(?:--root\s+\S+\s+)?(?:status|resume|event|log)\b")


def _dir(root):
    return os.path.join(root, ".hyperskill")


def _write(path, text):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    tmp = path + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        f.write(text)
    os.replace(tmp, path)


def is_paused(root):
    try:
        with open(os.path.join(_dir(root), "control.json"), encoding="utf-8") as f:
            return bool(json.load(f).get("paused"))
    except (OSError, ValueError, AttributeError):
        return False


def set_paused(root, paused):
    _write(os.path.join(_dir(root), "control.json"), json.dumps({"paused": bool(paused)}) + "\n")


def _read_inbox(root):
    rows = []
    try:
        with open(os.path.join(_dir(root), "inbox.jsonl"), encoding="utf-8") as f:
            for line in f:
                try:
                    rows.append(json.loads(line))
                except ValueError:
                    continue
    except OSError:
        pass
    return [r for r in rows if isinstance(r, dict)]


def _save_inbox(root, rows):
    _write(os.path.join(_dir(root), "inbox.jsonl"), "".join(json.dumps(r, ensure_ascii=False) + "\n" for r in rows[-200:]))


def push(root, text):
    """Queue an instruction for Claude. Returns its id, or None when the text is empty or too many are waiting."""
    text = re.sub(r"[\x00-\x08\x0b\x0c\x0e-\x1f]", "", str(text or "")).strip()[:MAX_TEXT]
    rows = _read_inbox(root)
    if not text or sum(1 for r in rows if not r.get("delivered")) >= MAX_PENDING:
        return None
    rid = "%d-%d" % (int(time.time() * 1000), len(rows))
    rows.append({"id": rid, "ts": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()), "text": text, "delivered": False})
    _save_inbox(root, rows)
    return rid


def pending(root):
    return [r for r in _read_inbox(root) if not r.get("delivered")]


def mark_delivered(root, ids):
    rows = _read_inbox(root)
    for r in rows:
        if r.get("id") in ids:
            r["delivered"] = True
    _save_inbox(root, rows)


def recent(root, n=8):
    return [{"id": r.get("id"), "text": r.get("text", "")[:200], "delivered": bool(r.get("delivered"))} for r in _read_inbox(root)[-n:]]
