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
import subprocess
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
        if started:
            mark_running(root, inp)
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


TASK_ID = re.compile(r"^\s*(T[0-9]{1,3})\b")
NUDGE_AFTER = 8  # file edits in one phase, by one Claude, with no helper tasks, before it is reminded once


def mark_running(root, inp):
    """A helper dispatched for a task ("T3: ...") marks that task running at the moment it starts, so the board never lags the work."""
    m = TASK_ID.match(str(inp.get("description") or ""))
    if not m or not str(inp.get("subagent_type") or "").split(":")[-1].startswith("hs-"):
        return
    try:
        subprocess.run([sys.executable, os.path.join(os.path.dirname(os.path.abspath(__file__)), "hyperskill.py"), "--root", root, "work", "start", m.group(1)],
                       capture_output=True, timeout=4, stdin=subprocess.DEVNULL)
    except (OSError, subprocess.SubprocessError):
        pass


def work_state(root):
    try:
        import hyperskill as core
        import hs_work
        st = core.load_state(root)
        return st, hs_work, hs_work.policy(st)
    except (Exception, SystemExit):
        return None, None, None


def work_brief(root):
    """Open helper tasks and the next wave, so a resumed session carries on the plan instead of forgetting it."""
    st, hw, pol = work_state(root)
    if not st or not st.get("current"):
        return None
    open_ids = hw.open_tasks(st, st["current"])
    if not open_ids:
        return None
    return ("HyperSkill helper tasks open in %s: %s. Next:\n%s\nDispatch a wave in one message, start the wave first, give each Agent a description that begins with its task "
            "id (for example `T3: build the pricing section`), and verify each result yourself before `work done`." % (st["current"], ", ".join(open_ids), hw.render_plan(st, st["current"])))


def helper_returned(data):
    """After a helper returns, remind the conductor that the report is a claim, and name the task."""
    inp = data.get("tool_input") or {}
    m = TASK_ID.match(str((inp or {}).get("description") or ""))
    if not m:
        return None
    return ("Helper for %s returned. Its report is a claim: read what it changed and run the check yourself, then `hyperskill.py work done %s --result \"<what you ran and saw>\"` "
            "or `work fail %s --why \"...\"` (that moves it up a tier)." % (m.group(1), m.group(1), m.group(1)))


def split_nudge(root, data):
    """Once per phase: a lot of editing by one Claude and no tasks. Only a reminder; helpers off or a small phase silences it."""
    st, hw, pol = work_state(root)
    if not st or not st.get("current") or not pol["helpers"]:
        return None
    path = os.path.join(root, ".hyperskill", "work-nudge.json")
    try:
        with open(path, encoding="utf-8") as f:
            n = json.load(f)
    except (OSError, ValueError):
        n = {}
    if n.get("phase") != st["current"]:
        n = {"phase": st["current"], "edits": 0, "done": False}
    if n["done"]:
        return None
    n["edits"] += 1
    if hw.work(st)["tasks"] and any(t["phase"] == st["current"] for t in hw.work(st)["tasks"]):
        n["done"] = True
    msg = None
    if n["edits"] >= NUDGE_AFTER and not n["done"]:
        n["done"] = True
        msg = ("HyperSkill: %d files edited in %s with no helper tasks. If the remaining work has separate pieces, split it (`hyperskill.py work add ...`, `work plan`) so easy parts "
               "go to cheap helpers and hard parts to strong ones, and independent parts run together. If it is one small thing, carry on; this reminder will not repeat in this phase." % (n["edits"], st["current"]))
    try:
        with open(path, "w", encoding="utf-8") as f:
            json.dump(n, f)
    except OSError:
        pass
    return msg


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
        idea = idea_brief(root)
        if idea:
            parts.append(idea)
    if when in ("start", "prompt"):
        wb = work_brief(root)
        if wb:
            parts.append(wb)
    if when == "post":
        tool = data.get("tool_name") or ""
        if tool in AGENT_TOOLS:
            hr = helper_returned(data)
            if hr:
                parts.append(hr)
        elif tool in FILE_TOOLS:
            nudge = split_nudge(root, data)
            if nudge:
                parts.append(nudge)
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


def idea_brief(root):
    """The user's pasted idea with the precedence rule, open questions and the answers they already gave."""
    try:
        import hyperskill as core
        import hs_brief
        text = hs_brief.summary(core.load_state(root), root=root)
        return ("HyperSkill brief. " + text) if text else None
    except (Exception, SystemExit):
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
    if os.environ.get("HYPERSKILL_RUN"):  # a run started from the dashboard: that dashboard is already up, never start another
        try:
            import hs_live
            info = hs_live.read_live(root)
            return info["url"] if info else None
        except Exception:
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
