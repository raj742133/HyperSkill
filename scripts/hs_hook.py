#!/usr/bin/env python3
"""Claude Code hook: record what Claude writes, runs and tests into the HyperSkill activity log.

Registered by hooks/hooks.json for PreToolUse (helper agents starting), PostToolUse (files, commands, test results) and
PostToolUseFailure (commands that exited non-zero, which is how a failing test run arrives).
It does nothing outside a HyperSkill project (no .hyperskill/state.json above the working directory), always exits 0 so
it can never block or break a tool call, and writes only locally, with secrets masked by hs_activity.redact.
Standard library only.
"""
import json
import os
import re
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import hs_activity as activity  # noqa: E402

FILE_TOOLS = {"Write": "write", "Edit": "edit", "MultiEdit": "edit", "NotebookEdit": "edit"}
AGENT_TOOLS = ("Task", "Agent")


def response_text(resp):
    """Best-effort text of a tool response, whatever shape the host gives it."""
    if resp is None:
        return ""
    if isinstance(resp, str):
        return resp
    if isinstance(resp, dict):
        parts = [resp.get(k) for k in ("stdout", "stderr", "output", "content", "text") if isinstance(resp.get(k), str)]
        return "\n".join(parts)
    if isinstance(resp, list):
        return "\n".join(response_text(x) for x in resp)
    return ""


def shown_path(root, path):
    """Path relative to the project; anything outside it is reduced to its file name so no home directory is logged."""
    if not path:
        return ""
    ap = os.path.abspath(path)
    if ap == root or ap.startswith(root + os.sep):
        return os.path.relpath(ap, root)
    return "(outside the project) " + os.path.basename(ap)


def handle(data, when):
    root = activity.find_root(data.get("cwd") or os.environ.get("CLAUDE_PROJECT_DIR"))
    if not root:
        return
    tool = data.get("tool_name") or ""
    inp = data.get("tool_input") or {}
    if not isinstance(inp, dict):
        inp = {}

    if tool in AGENT_TOOLS:
        what = inp.get("description") or inp.get("subagent_type") or "a helper"
        started = when == "pre"
        activity.append(root, "agent", ("Started a helper: " if started else "A helper finished: ") + str(what),
                        state="started" if started else "finished", agent=inp.get("subagent_type"))
        return
    if when == "fail":
        # Claude Code reports a command that exited non-zero through a separate event; failing tests are the interesting ones.
        if tool == "Bash":
            cmd = (inp.get("command") or "")
            if "hyperskill.py" in cmd:
                return
            text = response_text(data.get("tool_response")) + "\n" + str(data.get("error") or "")
            code = re.search(r"[Ee]xit code:? (\d+)", text)
            fields = {"ok": False, "desc": inp.get("description")}
            if code:
                fields["exit"] = int(code.group(1))
            activity.append(root, "command", activity.redact(cmd.replace(root, "."), 200), **fields)
            summary = activity.parse_test_summary(text)
            if summary:
                activity.append(root, "test", "%s: %d passed, %d failed" % (summary["runner"], summary["passed"], summary["failed"]),
                                cmd=activity.redact(cmd.replace(root, "."), 160), **summary)
        return
    if when != "post":
        return

    if tool in FILE_TOOLS:
        path = inp.get("file_path") or inp.get("notebook_path") or ""
        rel = shown_path(root, path)
        if rel.startswith(".hyperskill" + os.sep) or not rel:
            return  # the tracker's own files are reported by the tracker
        extra = {}
        if tool == "Write" and isinstance(inp.get("content"), str):
            extra["lines"] = inp["content"].count("\n") + 1
        if tool == "MultiEdit" and isinstance(inp.get("edits"), list):
            extra["edits"] = len(inp["edits"])
        verb = "Wrote" if tool == "Write" else "Edited"
        activity.append(root, "file", "%s %s" % (verb, rel), action=FILE_TOOLS[tool], path=rel, **extra)
        return

    if tool == "Bash":
        cmd = inp.get("command") or ""
        if "hyperskill.py" in cmd:
            return  # the tracker logs its own actions
        cmd = cmd.replace(root, ".")  # the project's own folder shows as "." so no home directory is logged
        text = response_text(data.get("tool_response"))
        summary = activity.parse_test_summary(text)
        activity.append(root, "command", activity.redact(cmd, 200), ok=True, desc=inp.get("description"))
        if summary:
            activity.append(root, "test", "%s: %d passed, %d failed" % (summary["runner"], summary["passed"], summary["failed"]),
                            cmd=activity.redact(cmd, 160), **summary)


def main():
    when = sys.argv[1] if len(sys.argv) > 1 else "post"
    try:
        data = json.load(sys.stdin)
        if isinstance(data, dict):
            handle(data, when)
    except (ValueError, OSError, KeyError, TypeError) as exc:
        # A logging problem must never stop the tool call: say so on stderr and carry on.
        print("hyperskill hook: skipped (%s)" % exc.__class__.__name__, file=sys.stderr)
    return 0


if __name__ == "__main__":
    sys.exit(main())
