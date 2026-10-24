"""Activity log shared by hyperskill.py, the plugin hook and the live dashboard.

Every event is one line of JSON in <project>/.hyperskill/activity.jsonl. The log is local, redacted, and capped in size.
Standard library only. Writing the log is best effort: a failure here must never break the command that caused it.
"""
import datetime
import json
import os
import re

LOG_NAME = "activity.jsonl"
MAX_BYTES = 5 * 1024 * 1024  # past this the file is rotated once (activity.1.jsonl)
MAX_TEXT = 240

# Event types the dashboard knows how to draw. Anything else is shown as a plain note.
TYPES = (
    "init", "config", "progress", "note", "decision", "advance", "skip",
    "gate_pass", "gate_waive", "check_failed", "refused",
    "file", "command", "test", "agent", "skill",
)

_SECRET_NAME = r"[A-Za-z0-9_]*(?:TOKEN|SECRET|PASSWORD|PASSWD|PASSPHRASE|API[_-]?KEY|PRIVATE[_-]?KEY|ACCESS[_-]?KEY|AUTH|COOKIE|SESSION)[A-Za-z0-9_]*"
_PATTERNS = [
    # Header-style credentials first, so "Authorization: Bearer <token>" is masked as a whole before the generic rule sees it.
    (re.compile(r"(?i)\b(authorization\s*[:=]\s*)(?:(?:bearer|basic|token)\s+)?\S+"), r"\1***"),
    (re.compile(r"(?i)\bbearer\s+[A-Za-z0-9._~+/=-]{8,}"), "Bearer ***"),
    (re.compile(r"(?i)\b(" + _SECRET_NAME + r")(\s*[=:]\s*)(?:(?:bearer|basic|token)\s+)?(\"[^\"]*\"|'[^']*'|[^\s;&|]+)"), r"\1\2***"),
    (re.compile(r"\b(?:ghp|gho|ghu|ghs|ghr|github_pat|glpat|xox[abprs]|sk|rk|pk)[-_][A-Za-z0-9_-]{16,}"), "***"),
    (re.compile(r"\bAKIA[0-9A-Z]{16}\b"), "***"),
    (re.compile(r"://[^/\s:@]+:[^/\s@]+@"), "://***@"),
    (re.compile(r"\b[A-Fa-f0-9]{32,}\b"), "***"),
    (re.compile(r"\b[A-Za-z0-9+/_-]{40,}={0,2}"), "***"),
    (re.compile(r"-----BEGIN [A-Z ]*PRIVATE KEY-----"), "***"),
]


def now():
    return datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%dT%H:%M:%S.%f")[:-3] + "Z"


def redact(text, limit=MAX_TEXT):
    """Mask anything that looks like a secret, flatten whitespace and cut to `limit` characters."""
    if text is None:
        return ""
    t = str(text)
    for rx, repl in _PATTERNS:
        t = rx.sub(repl, t)
    t = re.sub(r"\s+", " ", t).strip()
    return t if len(t) <= limit else t[: limit - 1] + "…"


def log_path(root):
    return os.path.join(root, ".hyperskill", LOG_NAME)


def find_root(start):
    """Walk up from `start` to the nearest directory holding .hyperskill/state.json, or None."""
    d = os.path.abspath(start or os.getcwd())
    while True:
        if os.path.exists(os.path.join(d, ".hyperskill", "state.json")):
            return d
        parent = os.path.dirname(d)
        if parent == d:
            return None
        d = parent


def _rotate(path):
    try:
        if os.path.getsize(path) > MAX_BYTES:
            os.replace(path, path[: -len(".jsonl")] + ".1.jsonl")
    except OSError:
        return  # nothing to rotate yet, or the file was moved by a concurrent writer


def append(root, type_, text="", **fields):
    """Append one event. Returns True when written. Never raises."""
    event = {"ts": now(), "type": type_, "text": redact(text)}
    for k, v in fields.items():
        if v is not None:
            event[k] = redact(v, 600) if isinstance(v, str) else v
    try:
        d = os.path.join(root, ".hyperskill")
        os.makedirs(d, exist_ok=True)
        gi = os.path.join(d, ".gitignore")
        if not os.path.exists(gi):
            with open(gi, "w", encoding="utf-8") as f:
                f.write("# the activity log is local and may name your files and commands: do not commit it\n" + LOG_NAME + "\nactivity.1.jsonl\n")
        path = log_path(root)
        _rotate(path)
        fd = os.open(path, os.O_WRONLY | os.O_APPEND | os.O_CREAT, 0o600)
        try:
            os.write(fd, (json.dumps(event, ensure_ascii=False) + "\n").encode("utf-8"))
        finally:
            os.close(fd)
        return True
    except OSError:
        return False


def read_events(root, offset=0, limit=None):
    """Return (events, new_offset). Reads whole lines only, so a half-written last line waits for the next call."""
    path = log_path(root)
    try:
        size = os.path.getsize(path)
    except OSError:
        return [], 0
    if offset > size:
        offset = 0  # the file was rotated or truncated
    with open(path, "rb") as f:
        f.seek(offset)
        data = f.read()
    end = data.rfind(b"\n")
    if end < 0:
        return [], offset
    chunk = data[: end + 1]
    events = []
    for line in chunk.decode("utf-8", "replace").split("\n"):
        if not line:
            continue
        try:
            events.append(json.loads(line))
        except ValueError:
            continue  # a corrupt line is skipped, the rest still shows
    if limit is not None and len(events) > limit:
        events = events[-limit:]
    return events, offset + len(chunk)


# ---------------------------------------------------------------- test output

_NODE = re.compile(r"^# (tests|pass|fail|skipped|cancelled) (\d+)\s*$", re.M)
_UNITTEST_RAN = re.compile(r"^Ran (\d+) tests? in ", re.M)
_UNITTEST_FAIL = re.compile(r"^FAILED \((.*?)\)\s*$", re.M)
_PYTEST_LINE = re.compile(r"^.*\b\d+ (?:passed|failed|error|errors|skipped)\b.* in [\d.]+s.*$", re.M)
_PYTEST_COUNT = re.compile(r"(\d+) (passed|failed|errors?|skipped)")
_JEST = re.compile(r"^Tests:\s+(?:(\d+) failed, )?(?:(\d+) skipped, )?(?:(\d+) passed, )?(\d+) total", re.M)


def parse_test_summary(text):
    """Recognise the summary line of node:test, unittest, pytest or jest. Returns a dict or None."""
    if not text:
        return None
    node = {k: int(v) for k, v in _NODE.findall(text)}
    # A run whose output was filtered (for example through grep) may show only "# pass" and "# fail": still a result.
    if "pass" in node and ("tests" in node or "fail" in node):
        failed = node.get("fail", 0)
        return {"runner": "node:test", "passed": node["pass"], "failed": failed,
                "skipped": node.get("skipped", 0), "total": node.get("tests", node["pass"] + failed + node.get("skipped", 0))}
    ran = _UNITTEST_RAN.search(text)
    if ran:
        total = int(ran.group(1))
        failed = 0
        f = _UNITTEST_FAIL.search(text)
        if f:
            failed = sum(int(n) for n in re.findall(r"=(\d+)", f.group(1)))
        return {"runner": "unittest", "passed": total - failed, "failed": failed, "skipped": 0, "total": total}
    m = _JEST.search(text)
    if m:
        failed, skipped, passed, total = (int(x) if x else 0 for x in m.groups())
        return {"runner": "jest", "passed": passed, "failed": failed, "skipped": skipped, "total": total}
    line = _PYTEST_LINE.search(text)
    if line:
        counts = {}
        for n, word in _PYTEST_COUNT.findall(line.group(0)):
            counts["failed" if word.startswith("error") else word] = counts.get("failed" if word.startswith("error") else word, 0) + int(n)
        passed, failed, skipped = counts.get("passed", 0), counts.get("failed", 0), counts.get("skipped", 0)
        return {"runner": "pytest", "passed": passed, "failed": failed, "skipped": skipped, "total": passed + failed + skipped}
    return None
