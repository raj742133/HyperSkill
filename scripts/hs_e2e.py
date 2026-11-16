"""End-to-end tests with Playwright: set a project up, run the suite, and keep a small record of the last run that a gate can cite.

Standard library only. HyperSkill never installs anything: `init` copies a starter and prints the exact commands for the owner to run, and
`run` uses only the Playwright that is already in the project's own node_modules (never `npx`, which would download code on the fly).
The record is docs/e2e-last.json: counts, the titles of failing tests (first error line only), the command and the time.
"""
import json
import os
import re
import shutil
import subprocess
import threading
import time

HERE = os.path.dirname(os.path.abspath(__file__))
TEMPLATE = os.path.normpath(os.path.join(HERE, "..", "skills", "hs-e2e", "template"))
LAST = os.path.join("docs", "e2e-last.json")
CONFIGS = ("playwright.config.js", "playwright.config.ts", "playwright.config.mjs", "playwright.config.cjs")
INSTALL = ["npm install -D @playwright/test", "npx playwright install chromium"]
TIMEOUT = 900

_lock = threading.Lock()
_running = {}


def config_file(root):
    return next((c for c in CONFIGS if os.path.isfile(os.path.join(root, c))), None)


def binary(root):
    for rel in (("node_modules", ".bin", "playwright"), ("node_modules", ".bin", "playwright.cmd")):
        p = os.path.join(root, *rel)
        if os.path.exists(p):
            return p
    return None


def init(root):
    """Copy the starter into the project without overwriting anything. Returns (copied, skipped)."""
    copied, skipped = [], []
    for dirpath, _, files in os.walk(TEMPLATE):
        for fn in sorted(files):
            src = os.path.join(dirpath, fn)
            rel = os.path.relpath(src, TEMPLATE)
            dst = os.path.join(root, rel)
            if os.path.exists(dst):
                skipped.append(rel)
                continue
            os.makedirs(os.path.dirname(dst), exist_ok=True)
            shutil.copyfile(src, dst)
            copied.append(rel)
    return copied, skipped


def _walk(suite, out, trail=()):
    title = suite.get("title") or ""
    trail = trail + ((title,) if title and not title.endswith((".js", ".ts", ".mjs", ".cjs")) else ())
    for spec in suite.get("specs", []):
        for t in spec.get("tests", []):
            results = t.get("results") or []
            status = t.get("status") or (results[-1].get("status") if results else "unknown")
            err = ""
            for r in results:
                e = (r.get("error") or {}).get("message") or ""
                if e:
                    err = re.sub(r"\x1b\[[0-9;]*m", "", e).strip().splitlines()[0][:200]
            out.append({"title": " > ".join(trail + (spec.get("title", ""),)), "status": status, "file": spec.get("file"), "error": err,
                        "annotation": [a.get("type") for a in t.get("annotations", [])]})
    for sub in suite.get("suites", []):
        _walk(sub, out, trail)


def summarise(report):
    tests = []
    for s in report.get("suites", []):
        _walk(s, tests)
    n = lambda *k: sum(1 for t in tests if t["status"] in k)
    return {"passed": n("expected"), "failed": n("unexpected"), "flaky": n("flaky"), "skipped": n("skipped"),
            "total": len(tests), "duration_ms": int((report.get("stats") or {}).get("duration", 0)),
            "failing": [{"title": t["title"], "error": t["error"]} for t in tests if t["status"] == "unexpected"][:20],
            "flaky_titles": [t["title"] for t in tests if t["status"] == "flaky"][:20],
            "skipped_titles": [t["title"] for t in tests if t["status"] == "skipped"][:30],
            "fixme": sum(1 for t in tests if "fixme" in t["annotation"])}


def last(root):
    try:
        with open(os.path.join(root, LAST), encoding="utf-8") as f:
            return json.load(f)
    except (OSError, ValueError):
        return None


def verdict(rec):
    if not rec:
        return "never run"
    if rec.get("error"):
        return "could not run"
    if rec["failed"] or rec["flaky"]:
        return "failing"
    if rec.get("fixme"):
        return "incomplete"         # placeholders (test.fixme) are flows that are not covered yet
    return "green" if rec["passed"] else "nothing ran"


def run(root, grep=None, timeout=TIMEOUT):
    """Run the suite with the project's own Playwright. Returns the record (also written to docs/e2e-last.json)."""
    root = os.path.abspath(root)
    rec = {"at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()), "command": "playwright test --reporter=json" + (" --grep " + grep if grep else "")}
    cfg, exe = config_file(root), binary(root)
    if not cfg:
        rec["error"] = "no playwright.config in the project: run `hyperskill.py e2e init`"
    elif not exe:
        rec["error"] = "Playwright is not installed in this project. Run: " + " && ".join(INSTALL)
    if "error" not in rec:
        cmd = [exe, "test", "--reporter=json"] + (["--grep", grep] if grep else [])
        try:
            r = subprocess.run(cmd, cwd=root, capture_output=True, text=True, timeout=timeout, env=dict(os.environ, CI="1"))
            m = re.search(r"\{.*\}", r.stdout, re.S)
            if m:
                rec.update(summarise(json.loads(m.group(0))))
            else:
                rec["error"] = ("no test report: " + (r.stderr.strip().splitlines() or ["the runner printed nothing"])[-1])[:240]
            rec["exit_code"] = r.returncode
        except subprocess.TimeoutExpired:
            rec["error"] = "timed out after %d s" % timeout
        except (OSError, ValueError) as exc:
            rec["error"] = "could not run: %s" % exc
    rec["verdict"] = verdict(rec)
    os.makedirs(os.path.join(root, "docs"), exist_ok=True)
    with open(os.path.join(root, LAST), "w", encoding="utf-8") as f:
        json.dump(rec, f, indent=1)
    return rec


def evidence(rec):
    """The one line a gate can cite."""
    if not rec or rec.get("error") or "passed" not in rec or verdict(rec) != "green":
        return None
    return "%s: %d passed, %d failed, %d flaky, %d skipped (%s, %s)" % (LAST.replace(os.sep, "/"), rec["passed"], rec["failed"], rec["flaky"], rec["skipped"], rec["verdict"], rec["at"])


def start_background(root):
    """Start a run in a thread, once at a time per project. Returns False if one is already running."""
    root = os.path.abspath(root)
    with _lock:
        if _running.get(root):
            return False
        _running[root] = time.time()

    def go():
        try:
            run(root)
        finally:
            with _lock:
                _running.pop(root, None)
    threading.Thread(target=go, daemon=True).start()
    return True


def state(root):
    root = os.path.abspath(root)
    rec = last(root)
    return {"configured": bool(config_file(root)), "installed": bool(binary(root)), "running": bool(_running.get(root)),
            "last": rec, "verdict": verdict(rec), "evidence": evidence(rec) if rec and verdict(rec) == "green" else None, "install": INSTALL}
