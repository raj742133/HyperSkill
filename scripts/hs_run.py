"""Run Claude on this project from the dashboard's chat box.

Off unless the dashboard was started with `hyperskill.py live --allow-run`, which the automatic start never passes. A run is one headless
`claude -p` process in the project folder with the HyperSkill plugin loaded for that run only. The first message starts a conversation, later
messages resume it (`--resume SESSION`), so the chat box behaves like a chat.

What a run may do is the person's choice, per message:
  edits   file edits, plus the HyperSkill tracker. Other shell commands are denied.
  build   file edits and any shell command in the project (npm, git, tests ...), with whatever rights your user account has.
There is no mode that skips permission checks. One run at a time, a spend limit per run, a time limit, and a stop button.
It uses your own Claude Code login and your own usage. Standard library only.
"""
import json
import os
import shutil
import signal
import subprocess
import threading
import time

HERE = os.path.dirname(os.path.abspath(__file__))
PLUGIN_ROOT = os.path.normpath(os.path.join(HERE, ".."))
MODES = ("edits", "build")
MAX_TEXT = 4000
MAX_SECONDS = 30 * 60
HISTORY = 400


def claude_bin():
    override = os.environ.get("CLAUDE_BIN")
    if override:
        return override if os.path.isfile(override) and os.access(override, os.X_OK) else None
    return shutil.which("claude")


def paths(root):
    d = os.path.join(root, ".hyperskill")
    return os.path.join(d, "chat.jsonl"), os.path.join(d, "run.json")


def _append(root, role, text):
    log, _ = paths(root)
    os.makedirs(os.path.dirname(log), exist_ok=True)
    with open(log, "a", encoding="utf-8") as f:
        f.write(json.dumps({"ts": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()), "role": role, "text": text[:6000]}, ensure_ascii=False) + "\n")
    try:  # keep the history bounded
        with open(log, encoding="utf-8") as f:
            lines = f.readlines()
        if len(lines) > HISTORY:
            with open(log, "w", encoding="utf-8") as f:
                f.writelines(lines[-HISTORY:])
    except OSError:
        pass


def history(root, n=40):
    log, _ = paths(root)
    rows = []
    try:
        with open(log, encoding="utf-8") as f:
            for line in f:
                try:
                    rows.append(json.loads(line))
                except ValueError:
                    pass
    except OSError:
        pass
    return rows[-n:]


def _meta(root):
    _, p = paths(root)
    try:
        with open(p, encoding="utf-8") as f:
            return json.load(f)
    except (OSError, ValueError):
        return {}


def _save_meta(root, meta):
    _, p = paths(root)
    os.makedirs(os.path.dirname(p), exist_ok=True)
    with open(p, "w", encoding="utf-8") as f:
        json.dump(meta, f)


def build_command(root, text, mode, budget, session):
    tracker = os.path.join(PLUGIN_ROOT, "scripts", "hyperskill.py")
    tools = ["Read", "Edit", "Write", "Glob", "Grep", "Bash" if mode == "build" else "Bash(python3 %s:*)" % tracker]
    if session:
        prompt = text
    else:
        prompt = ("You are working in this project through the HyperSkill dashboard. Use the hyperskill skill (the HyperSkill conductor). The tracker is "
                  "`python3 %s`: run `status` to see the project (run `init` if there is no state yet), read the user's brief and attachments with `brief show`, "
                  "and carry on from the current phase.%s The user says: %s" % (tracker, (
                      " In this run you may edit files and run only the tracker, as `python3 %s <command>` (several joined with && are fine). Any other shell "
                      "command is denied, and a helper script you write cannot be run, so call the tracker directly, one call per item." % tracker)
                      if mode == "edits" else "", text))
    cmd = [claude_bin(), "-p", prompt, "--output-format", "stream-json", "--verbose", "--permission-mode", "acceptEdits",
           "--max-budget-usd", "%.2f" % budget, "--plugin-dir", PLUGIN_ROOT, "--allowedTools"] + tools
    if session:
        cmd = cmd[:cmd.index("--allowedTools")] + ["--resume", session, "--allowedTools"] + tools
    return cmd


class Runner:
    def __init__(self, root, allowed):
        self.root, self.allowed = root, allowed
        self.proc = None
        self.lock = threading.Lock()
        self.started = None
        self.mode = None
        self.last = None

    def running(self):
        return bool(self.proc and self.proc.poll() is None)

    def state(self):
        meta = _meta(self.root)
        return {"allowed": self.allowed, "available": bool(claude_bin()), "running": self.running(), "mode": self.mode if self.running() else None,
                "session": bool(meta.get("session")), "last": self.last or meta.get("last"), "messages": history(self.root)}

    def start(self, text, mode, budget=3.0):
        if not self.allowed:
            raise PermissionError("running Claude from the dashboard is off: start it with `hyperskill.py live --allow-run`")
        if mode not in MODES:
            raise ValueError("mode must be one of: %s" % ", ".join(MODES))
        text = str(text or "").strip()[:MAX_TEXT]
        if not text:
            raise ValueError("write a message first")
        if not claude_bin():
            raise FileNotFoundError("the `claude` command was not found on this computer")
        budget = min(max(float(budget), 0.5), 25.0)
        with self.lock:
            if self.running():
                raise RuntimeError("a run is already in progress: stop it or wait")
            meta = _meta(self.root)
            cmd = build_command(self.root, text, mode, budget, meta.get("session"))
            _append(self.root, "user", text)
            err = open(os.path.join(self.root, ".hyperskill", "run.err"), "wb")
            env = dict(os.environ)
            env["HYPERSKILL_RUN"] = "1"
            self.proc = subprocess.Popen(cmd, cwd=self.root, stdin=subprocess.DEVNULL, stdout=subprocess.PIPE, stderr=err, env=env, start_new_session=True)
            self.started, self.mode, self.last = time.time(), mode, None
            threading.Thread(target=self._read, args=(self.proc, err), daemon=True).start()
            threading.Thread(target=self._watchdog, args=(self.proc,), daemon=True).start()

    def _read(self, proc, err):
        session, said = None, False
        try:
            for raw in proc.stdout:
                try:
                    ev = json.loads(raw)
                except ValueError:
                    continue
                session = ev.get("session_id") or session
                if ev.get("type") == "assistant":
                    for block in (ev.get("message") or {}).get("content", []):
                        if isinstance(block, dict) and block.get("type") == "text" and block.get("text", "").strip():
                            _append(self.root, "claude", block["text"].strip())
                            said = True
                elif ev.get("type") == "result":
                    self.last = {"error": bool(ev.get("is_error")), "turns": ev.get("num_turns"), "cost": ev.get("total_cost_usd"),
                                 "seconds": round((ev.get("duration_ms") or 0) / 1000)}
                    if ev.get("is_error") or not said:
                        _append(self.root, "system", ("The run ended with an error: " if ev.get("is_error") else "") + str(ev.get("result") or "(no text)")[:600])
        finally:
            code = proc.wait()
            err.close()
            if self.last is None:
                tail = ""
                try:
                    with open(os.path.join(self.root, ".hyperskill", "run.err"), encoding="utf-8", errors="replace") as f:
                        tail = f.read()[-400:].strip()
                except OSError:
                    pass
                self.last = {"error": True, "turns": None, "cost": None, "seconds": round(time.time() - (self.started or time.time()))}
                _append(self.root, "system", "The run stopped (exit %s)%s" % (code, ": " + tail if tail else ""))
            meta = _meta(self.root)
            if session and not self.last.get("error"):
                meta["session"] = session
            meta["last"] = self.last
            _save_meta(self.root, meta)

    def _watchdog(self, proc):
        while proc.poll() is None:
            time.sleep(1)
            if time.time() - (self.started or time.time()) > MAX_SECONDS:
                self.stop()
                _append(self.root, "system", "Stopped after the 30 minute limit.")
                return

    def stop(self):
        p = self.proc
        if not p or p.poll() is not None:
            return False
        try:
            os.killpg(p.pid, signal.SIGTERM)
        except OSError:
            return False
        for _ in range(50):
            if p.poll() is not None:
                return True
            time.sleep(0.1)
        try:
            os.killpg(p.pid, signal.SIGKILL)
        except OSError:
            pass
        return True

    def new_chat(self):
        if self.running():
            raise RuntimeError("stop the run first")
        meta = _meta(self.root)
        meta.pop("session", None)
        _save_meta(self.root, meta)
        _append(self.root, "system", "Started a new conversation.")
