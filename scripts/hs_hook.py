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
import hs_control as control  # noqa: E402

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


def context_reply(event, text):
    print(json.dumps({"hookSpecificOutput": {"hookEventName": event, "additionalContext": text}}))


def steer(data, when):
    """Dashboard controls: refuse work while paused, and hand over instructions typed in the dashboard (once each)."""
    root = activity.find_root(data.get("cwd") or os.environ.get("CLAUDE_PROJECT_DIR"))
    if not root:
        return
    if when == "gate":
        cmd = (data.get("tool_input") or {}).get("command") or ""
        if control.is_paused(root) and not control.ALLOWED_WHILE_PAUSED.search(cmd):
            print(json.dumps({"hookSpecificOutput": {"hookEventName": "PreToolUse", "permissionDecision": "deny",
                              "permissionDecisionReason": "Paused from the HyperSkill dashboard. Stop here and tell the user "
                                                          "you are waiting; they resume from the dashboard."}}))
        return
    event = {"post": "PostToolUse", "fail": "PostToolUseFailure", "prompt": "UserPromptSubmit", "start": "SessionStart"}.get(when)
    waiting = control.pending(root) if event else []
    parts = []
    if when == "start":
        url = autostart(root)
        if url:
            parts.append("The HyperSkill live dashboard is running at %s (this computer only). Tell the user this address once, "
                         "early in your first reply. They can watch the work there, and pass checks, pause you or send you instructions." % url)
    if when == "start":
        rules = coding_rules(root)
        if rules:
            parts.append(rules)
    if when == "start":
        brief = skill_brief(root)
        if brief:
            parts.append(brief)
    if when == "start":
        picked = picks_brief(root)
        if picked:
            parts.append(picked)
    if waiting:
        parts.append("Instruction%s typed by the user in the HyperSkill dashboard (treat as the user's own words):\n%s" % (
            "s" if len(waiting) > 1 else "", "\n".join("- " + r["text"] for r in waiting)))
        control.mark_delivered(root, {r["id"] for r in waiting})
        for r in waiting:
            activity.append(root, "note", "Instruction handed to Claude: " + activity.redact(r["text"], 160))
    if parts:
        context_reply(event, "\n\n".join(parts))


def coding_rules(root):
    """The bundled Karpathy guidelines, handed over at every session start so they apply even when the skill is never triggered."""
    try:
        with open(os.path.join(root, ".hyperskill", "state.json"), encoding="utf-8") as f:
            integ = json.load(f).get("integrations", {})
        if "karpathy-skills" not in integ.get("enabled", []) or "karpathy-skills" in integ.get("disabled", []):
            return None
        path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "packs", "karpathy-skills", "skills", "karpathy-guidelines", "SKILL.md")
        with open(path, encoding="utf-8") as f:
            body = f.read().split("---", 2)[-1].strip()
        return ("HyperSkill coding discipline for this project (Karpathy guidelines, MIT, bundled in packs/karpathy-skills; the user "
                "can switch it off with `hyperskill.py integrations disable karpathy-skills`). Apply it to every code change:\n\n" + body)
    except (OSError, ValueError):
        return None


def skill_brief(root):
    """The current phase's skill plan, so the agent decides which skills to use and pull instead of guessing."""
    try:
        import hyperskill as core
        import hs_skills
        st = core.load_state(root)
        if not st.get("current"):
            return None
        rows = hs_skills.plan(core, root, st, st["current"])
        return ("HyperSkill skill orchestration. " + hs_skills.render(st["current"], rows) +
                "\nThink about each line against the actual task, pull what you need (ask the user before an ASK USER one), and record "
                "every decision with `hyperskill.py skills use|skip SLOT --why ...`. Core lines need a stated reason to skip. "
                "Details of any line: `hyperskill.py skills`.")
    except (Exception, SystemExit):  # a missing state or registry must never stop a session
        return None


def picks_brief(root):
    """What the person ticked in the dashboard for the current phase, so the build uses exactly that."""
    try:
        import hyperskill as core
        import hs_catalog
        st = core.load_state(root)
        if not st.get("current") or not (hs_catalog.selected(st) or st.get("extras")):
            return None
        text = hs_catalog.brief(core, root, st, st["current"])
        return ("HyperSkill selections. " + text) if text else None
    except (Exception, SystemExit):
        return None


def autostart(root):
    """Start the dashboard in the background when the project allows it. Never raises, never takes long."""
    if os.environ.get("HYPERSKILL_NO_LIVE"):
        return None
    try:
        with open(os.path.join(root, ".hyperskill", "state.json"), encoding="utf-8") as f:
            if json.load(f).get("autolive") is False:
                return None
        import hs_live
        return hs_live.ensure(root, wait=2.5)
    except Exception:  # a dashboard problem must never get in the way of a session
        return None


def main():
    when = sys.argv[1] if len(sys.argv) > 1 else "post"
    try:
        data = json.load(sys.stdin)
        if isinstance(data, dict):
            if when in ("gate", "prompt", "start"):
                steer(data, when)
                return 0
            handle(data, when)
            steer(data, when)
    except (ValueError, OSError, KeyError, TypeError) as exc:
        # A logging problem must never stop the tool call: say so on stderr and carry on.
        print("hyperskill hook: skipped (%s)" % exc.__class__.__name__, file=sys.stderr)
    return 0


if __name__ == "__main__":
    sys.exit(main())
