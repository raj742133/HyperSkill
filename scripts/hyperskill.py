#!/usr/bin/env python3
"""HyperSkill state and gate tracker.

Keeps the pipeline state in <project>/.hyperskill/state.json so any session can
resume. A phase may only be advanced once every gate item is either passed
(with evidence) or waived (with a reason). Standard library only.

Usage:
  hyperskill.py init [--name NAME] [--force] [--no-karpathy] [--noncommercial] [--tenancy organization|user|none] [--unavailable LIST]
  hyperskill.py config [--tenancy T] [--unavailable LIST|none]   change tenancy / what this environment lacks
  hyperskill.py status [--json]
  hyperskill.py gate PHASE                          show gate items and their state
  hyperskill.py gate PHASE --pass ID[,ID] --evidence TEXT
  hyperskill.py gate PHASE --waive ID[,ID] --reason TEXT
  hyperskill.py gate PHASE --run ID --cmd COMMAND   run a command; pass only if it exits 0
  hyperskill.py gate PHASE --waive-unavailable      waive, in one recorded step, every open item that needs
                                                    something this environment lacks (host, provider, device, human)
  hyperskill.py advance                             move to the next phase if the gate is clear
  hyperskill.py skip PHASE --reason TEXT            skip a whole phase (recorded)
  hyperskill.py decide --title T --choice C --why W [--phase PHASE]
  hyperskill.py log TEXT
  hyperskill.py event TEXT [--kind building|testing|reviewing|waiting|done]
                                                    tell the live view what is happening right now
  hyperskill.py brief [show|set --file F|finding add ...|req add ...|resolve ID --state S]   the pasted idea, gaps and conflicts, your answers
  hyperskill.py place [list|add ITEM --where W --why T|check --close]   where each picked component or figure is used, and proof it is
  hyperskill.py catalog [list|select|unselect|brief|sitewright] [IDS] [--group G --all|--recommended]
                                                    pick what to use (Sitewright parts, styles, checks, add-ons); the picks reach the build
  hyperskill.py extras [list|done ID --evidence T|waive ID --reason T]   the checks that came from your picks
  hyperskill.py skills [list] [--phase P] [--json]  what each phase should use, when and why (the skill plan)
  hyperskill.py skills pull ID [--why T] [--user-approved]   install a bundled skill for this phase (opt-in ones need the user's yes)
  hyperskill.py skills use|skip SLOT --why TEXT     record the decision for the phase;  skills release [PHASE]
  hyperskill.py live [--port 4777] [--read-only]    open the live dashboard (127.0.0.1 only; it can also control the flow)
  hyperskill.py live --allow-run                    also let the dashboard chat box run Claude here (your login and usage; never started automatically)
  hyperskill.py live --ensure | --stop              start it in the background (what the session hook does) / stop it
  hyperskill.py config --autolive on|off            start the dashboard automatically when a session opens (default on)
  hyperskill.py pause | resume                      stop / allow Claude's file writes and commands (needs the plugin hook)
  hyperskill.py say TEXT                            queue an instruction that Claude receives on its next step
  hyperskill.py integrations [list] [--json]        vetted external skills and what is installed
  hyperskill.py integrations resolve SLOT [--json]  which provider to use for a capability slot
  hyperskill.py integrations phase [PHASE]          resolve every slot of a phase
  hyperskill.py integrations enable|disable ID|--all [--include-opt-in]
                                                    opt a provider in / out; bundled ones are installed into .claude/skills

Use --root DIR to point at the project (default: current directory).
"""
import argparse
import datetime
import glob
import json
import os
import re
import shutil
import subprocess
import sys

_HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, _HERE)
import hs_activity as activity  # noqa: E402  (shared with the plugin hook and the live dashboard)
import hs_control as control  # noqa: E402
import hs_skills as skills  # noqa: E402
import hs_catalog as cat  # noqa: E402
import hs_brief as brief  # noqa: E402
GATES_PATH = os.path.join(_HERE, "..", "skills", "hyperskill", "gates.json")
INTEGRATIONS_PATH = os.path.join(_HERE, "..", "skills", "hyperskill", "integrations.json")


def now():
    return datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def load_gates():
    with open(GATES_PATH, encoding="utf-8") as f:
        return json.load(f)["phases"]


def state_file(root):
    return os.path.join(root, ".hyperskill", "state.json")


def load_state(root):
    path = state_file(root)
    if not os.path.exists(path):
        die("no HyperSkill state here. Run: hyperskill.py init")
    with open(path, encoding="utf-8") as f:
        st = json.load(f)
    st.setdefault("commercial", True)
    st.setdefault("tenancy", "organization")
    st.setdefault("unavailable", [])
    st.setdefault("integrations", {"enabled": [], "disabled": []})
    return st


def save_state(root, st):
    path = state_file(root)
    os.makedirs(os.path.dirname(path), exist_ok=True)
    tmp = path + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(st, f, indent=2)
        f.write("\n")
    os.replace(tmp, path)


def die(msg, code=1):
    print("error: " + msg, file=sys.stderr)
    sys.exit(code)


def phase_def(phases, pid):
    for p in phases:
        if p["id"] == pid:
            return p
    die("unknown phase '%s'. Valid: %s" % (pid, ", ".join(p["id"] for p in phases)))


def csv(value):
    return [v.strip() for v in value.split(",") if v.strip()]


TENANCIES = ("organization", "user", "none")
NEEDS = ("host", "provider", "device", "human")


def applies(st, item):
    """An item with a tenancy list only applies to projects of that tenancy (default: organization)."""
    t = item.get("tenancy")
    return not t or st.get("tenancy", "organization") in t


def item_text(st, item):
    return item.get("text_by_tenancy", {}).get(st.get("tenancy", "organization"), item["text"])


def gate_summary(st, phase):
    """Return (open_ids, done_count, total) for a phase. Items that do not apply to this tenancy are not counted."""
    items = [i for i in phase["gate"] if applies(st, i)]
    recorded = st["phases"][phase["id"]]["gate"]
    open_ids = [i["id"] for i in items if i["id"] not in recorded]
    return open_ids, len(items) - len(open_ids), len(items)


def parse_unavailable(value):
    if value is None:
        return None
    if value.strip().lower() in ("", "none"):
        return []
    vals = csv(value)
    bad = [v for v in vals if v not in NEEDS]
    if bad:
        die("unknown --unavailable value(s): %s. Valid: %s" % (", ".join(bad), ", ".join(NEEDS)))
    return vals


def check_tenancy(value):
    if value is not None and value not in TENANCIES:
        die("--tenancy must be one of: %s" % ", ".join(TENANCIES))
    return value


EVIDENCE_HINT = ("evidence must point at something checkable: a file path (docs/x.md), a backticked command, "
                 "or a count with a unit (12 tests, 40 ms). 'done' or 'looks fine' is not evidence.")


def evidence_is_concrete(text):
    t = text.strip()
    if len(t) < 20:
        return False
    return bool(re.search(r"`[^`]+`|[\w.-]+/[\w./-]+|\b[\w-]+\.(md|js|ts|py|json|yml|yaml|html|css|sh|sql|txt|png|jpg|pdf)\b"
                          r"|\b\d+(\.\d+)?\s*(tests?|requests?|ms|s|%|checks?|files?|findings?|pass(ed)?|fail(ed)?)\b", t))


def vacuous_negated_check(cmd):
    """`! grep ...` passes when the file does not exist. Require a positive existence guard next to it."""
    negated = re.search(r"(^|[;&|(]|&&)\s*!\s*(\w+\s+)*?(grep|rg|egrep|fgrep)\b", cmd)
    guarded = re.search(r"\btest\s+-[edfs]\b|\[\s+-[edfs]\s", cmd)
    return bool(negated and not guarded)


def cmd_init(args):
    phases = load_gates()
    path = state_file(args.root)
    if os.path.exists(path) and not args.force:
        die("state already exists. Use --force to overwrite.")
    st = {
        "name": args.name or os.path.basename(os.path.abspath(args.root)),
        "created": now(),
        "current": phases[0]["id"],
        "commercial": not args.noncommercial,
        "tenancy": check_tenancy(args.tenancy) or "organization",
        "unavailable": parse_unavailable(args.unavailable) or [],
        "integrations": {"enabled": [], "disabled": []},
        "phases": {p["id"]: {"status": "pending", "gate": {}} for p in phases},
        "decisions": [],
        "log": [],
    }
    st["phases"][phases[0]["id"]]["status"] = "active"
    if not args.no_karpathy:  # the coding rules are tiny (one 3 KB skill) and are meant to be always on, so they are the one default
        st["integrations"]["enabled"].append(DEFAULT_ON)
        install_pack(args.root, st, DEFAULT_ON)
    save_state(args.root, st)
    activity.append(args.root, "init", "Started %s: %s, tenancy %s" % (st["name"], "commercial" if st["commercial"] else "non-commercial", st["tenancy"]),
                    phase=st["current"], unavailable=",".join(st["unavailable"]) or None)
    print("initialised %s (%s, tenancy: %s%s); current phase: %s"
          % (st["name"], "commercial" if st["commercial"] else "non-commercial", st["tenancy"],
             ", unavailable: " + ",".join(st["unavailable"]) if st["unavailable"] else "", st["current"]))
    if not args.no_karpathy:
        print("coding rules on: Karpathy guidelines installed and read at every session start (turn off: integrations disable %s)" % DEFAULT_ON)


def cmd_config(args):
    st = load_state(args.root)
    if args.autolive is not None:
        st["autolive"] = args.autolive == "on"
        save_state(args.root, st)
        activity.append(args.root, "config", "Dashboard auto-start " + args.autolive)
        print("autolive: " + args.autolive)
        if args.tenancy is None and args.unavailable is None:
            return
    if args.tenancy is None and args.unavailable is None:
        print("tenancy: %s\nunavailable: %s\nautolive: %s" % (st["tenancy"], ", ".join(st["unavailable"]) or "(nothing)", "on" if st.get("autolive", True) else "off"))
        return
    if args.tenancy is not None:
        st["tenancy"] = check_tenancy(args.tenancy)
    un = parse_unavailable(args.unavailable)
    if un is not None:
        st["unavailable"] = un
    save_state(args.root, st)
    activity.append(args.root, "config", "Set tenancy %s, unavailable here: %s" % (st["tenancy"], ", ".join(st["unavailable"]) or "nothing"), phase=st["current"])
    print("tenancy: %s; unavailable: %s" % (st["tenancy"], ", ".join(st["unavailable"]) or "(nothing)"))


def cmd_status(args):
    phases = load_gates()
    st = load_state(args.root)
    if args.json:
        out = dict(st)
        out["next_open_items"] = gate_summary(st, phase_def(phases, st["current"]))[0] if st["current"] else []
        print(json.dumps(out, indent=2))
        return
    print("project: %s" % st["name"])
    for p in phases:
        ps = st["phases"][p["id"]]
        _, done, total = gate_summary(st, p)
        marker = {"done": "[x]", "active": "[>]", "skipped": "[-]"}.get(ps["status"], "[ ]")
        extra = ""
        if ps["status"] == "skipped":
            extra = "  skipped: " + ps.get("reason", "")
        print("%s %-10s %-34s gate %d/%d%s" % (marker, p["id"], p["title"], done, total, extra))
    print("decisions recorded: %d" % len(st["decisions"]))
    print("tenancy: %s; unavailable here: %s" % (st["tenancy"], ", ".join(st["unavailable"]) or "(nothing)"))
    if st["current"]:
        cur = phase_def(phases, st["current"])
        open_ids, _, _ = gate_summary(st, cur)
        print("current: %s (skill: %s)" % (cur["id"], cur["skill"]))
        if open_ids:
            print("open gate items: " + ", ".join(open_ids))
        else:
            print("gate clear - run: hyperskill.py advance")
    else:
        print("pipeline complete")


def cmd_gate(args):
    phases = load_gates()
    st = load_state(args.root)
    ph = phase_def(phases, args.phase)
    rec = st["phases"][ph["id"]]["gate"]
    valid = {i["id"] for i in ph["gate"]}
    touched = []
    if args.run_id:
        if not args.cmd:
            die("--run needs --cmd COMMAND.")
        if args.run_id not in valid:
            die("'%s' is not a gate item of phase %s" % (args.run_id, ph["id"]))
        if vacuous_negated_check(args.cmd):
            die("this check negates a grep (`! grep ...`), which also passes when the file or directory does not exist. "
                "Add a positive guard, e.g. `test -d src && ! grep -rn PATTERN src`. Nothing recorded.")
        try:
            r = subprocess.run(args.cmd, shell=True, cwd=args.root, capture_output=True, text=True, timeout=args.timeout)
        except subprocess.TimeoutExpired:
            die("command timed out after %ss; nothing recorded." % args.timeout)
        full = (r.stdout or "") + (r.stderr or "")
        tail = full.strip()[-400:]
        summary = activity.parse_test_summary(full)
        label = next((item_text(st, i) for i in ph["gate"] if i["id"] == args.run_id), args.run_id)
        if summary:
            activity.append(args.root, "test", "%s: %d passed, %d failed" % (summary["runner"], summary["passed"], summary["failed"]),
                            phase=ph["id"], item=args.run_id, cmd=args.cmd, **summary)
        if r.returncode != 0:
            activity.append(args.root, "check_failed", "%s/%s did not pass (exit %d)" % (ph["id"], args.run_id, r.returncode),
                            phase=ph["id"], item=args.run_id, label=label, cmd=args.cmd, output=tail[-300:])
            print(tail)
            die("command exited %d; '%s' stays open." % (r.returncode, args.run_id))
        rec[args.run_id] = {"state": "passed", "evidence": "ran `%s` -> exit 0. Output tail: %s" % (args.cmd, tail or "(none)"),
                            "at": now(), "ran": True}
        activity.append(args.root, "gate_pass", "%s/%s passed by running a command" % (ph["id"], args.run_id),
                        phase=ph["id"], item=args.run_id, label=label, ran=True, cmd=args.cmd, output=tail[-300:])
        touched.append(args.run_id)
    if args.pass_ids:
        if not args.evidence or not args.evidence.strip():
            die("--pass needs --evidence (what was run / seen). No evidence, no pass.")
        if not evidence_is_concrete(args.evidence):
            die("--pass: " + EVIDENCE_HINT + " If you cannot point at anything, waive the item with a reason instead.")
        for gid in csv(args.pass_ids):
            if gid not in valid:
                die("'%s' is not a gate item of phase %s" % (gid, ph["id"]))
            rec[gid] = {"state": "passed", "evidence": args.evidence.strip(), "at": now()}
            activity.append(args.root, "gate_pass", "%s/%s passed" % (ph["id"], gid), phase=ph["id"], item=gid,
                            label=next((item_text(st, i) for i in ph["gate"] if i["id"] == gid), gid), evidence=args.evidence.strip())
            touched.append(gid)
    if args.waive_ids:
        if not args.reason or not args.reason.strip():
            die("--waive needs --reason.")
        for gid in csv(args.waive_ids):
            if gid not in valid:
                die("'%s' is not a gate item of phase %s" % (gid, ph["id"]))
            rec[gid] = {"state": "waived", "reason": args.reason.strip(), "at": now()}
            activity.append(args.root, "gate_waive", "%s/%s waived" % (ph["id"], gid), phase=ph["id"], item=gid,
                            label=next((item_text(st, i) for i in ph["gate"] if i["id"] == gid), gid), reason=args.reason.strip())
            touched.append(gid)
    if args.waive_unavailable:
        if not st["unavailable"]:
            die("nothing is marked unavailable. Set it with: hyperskill.py config --unavailable host,provider,device,human")
        for item in ph["gate"]:
            lacking = [n for n in item.get("needs", []) if n in st["unavailable"]]
            if applies(st, item) and item["id"] not in rec and lacking:
                rec[item["id"]] = {"state": "waived", "at": now(), "unavailable": lacking,
                                   "reason": "needs %s, which this environment does not have. Revisit before a real launch." % "+".join(lacking)}
                activity.append(args.root, "gate_waive", "%s/%s waived: needs %s" % (ph["id"], item["id"], "+".join(lacking)),
                                phase=ph["id"], item=item["id"], label=item_text(st, item), reason=rec[item["id"]]["reason"])
                touched.append(item["id"])
        if not touched:
            print("(no open item in %s needs something unavailable)" % ph["id"])
    if touched:
        save_state(args.root, st)
    # Acting on items prints only those items; asking (no action flags) prints the whole gate.
    for item in ph["gate"]:
        r = rec.get(item["id"])
        if touched and item["id"] not in touched:
            continue
        if not applies(st, item):
            tag, r = "[n/a]", None
        else:
            tag = {"passed": "[x]", "waived": "[~]"}.get(r["state"], "[ ]") if r else "[ ]"
        need = "  (needs: %s)" % ",".join(item["needs"]) if item.get("needs") and not r else ""
        print("%s %-22s %s%s" % (tag, item["id"], item_text(st, item), need))
        if r:
            print("      %s: %s" % (r["state"], r.get("evidence") or r.get("reason")))
        elif tag == "[n/a]":
            print("      not applicable for tenancy '%s'" % st["tenancy"])


def cmd_advance(args):
    phases = load_gates()
    st = load_state(args.root)
    if not st["current"]:
        die("pipeline already complete.")
    cur = phase_def(phases, st["current"])
    open_ids, _, _ = gate_summary(st, cur)
    if open_ids:
        activity.append(args.root, "refused", "Cannot leave %s: %d check%s still open" % (cur["id"], len(open_ids), "" if len(open_ids) == 1 else "s"),
                        phase=cur["id"], open=",".join(open_ids))
        die("gate not clear for '%s'. Open items: %s" % (cur["id"], ", ".join(open_ids)))
    waiting = brief.open_blocking(st)
    if waiting:
        activity.append(args.root, "refused", "Cannot leave %s: %d question%s about the brief still open" % (cur["id"], len(waiting), "" if len(waiting) == 1 else "s"),
                        phase=cur["id"], open=",".join(waiting))
        die("the user has not answered these gaps or conflicts in the brief yet: %s. They answer in the dashboard (or `brief resolve ID ...`); "
            "do not assume the answer." % ", ".join(waiting))
    open_x = cat.open_extras(st, cur["id"])
    if open_x:
        activity.append(args.root, "refused", "Cannot leave %s: %d selected check%s still open" % (cur["id"], len(open_x), "" if len(open_x) == 1 else "s"),
                        phase=cur["id"], open=",".join(i for i, _ in open_x))
        die("selected checks still open in '%s': %s. Close each with `extras done ID --evidence ...` or `extras waive ID --reason ...` "
            "(the user picked them in the catalogue)." % (cur["id"], ", ".join(i for i, _ in open_x)))
    undecided = skills.undecided_core(sys.modules[__name__], args.root, st, cur["id"])
    if undecided:
        print("note: skills not decided in %s: %s (hyperskill.py skills %s)" % (cur["id"], ", ".join(undecided), cur["id"]))
    st["phases"][cur["id"]]["status"] = "done"
    st["phases"][cur["id"]]["completed"] = now()
    ids = [p["id"] for p in phases]
    idx = ids.index(cur["id"]) + 1
    while idx < len(ids) and st["phases"][ids[idx]]["status"] == "skipped":
        idx += 1
    if idx >= len(ids):
        st["current"] = None
        print("pipeline complete")
        activity.append(args.root, "advance", "Finished %s: the pipeline is complete" % cur["id"], phase=cur["id"], to="complete")
    else:
        st["current"] = ids[idx]
        st["phases"][ids[idx]]["status"] = "active"
        print("advanced: %s -> %s" % (cur["id"], ids[idx]))
        activity.append(args.root, "advance", "Finished %s, now in %s" % (cur["id"], ids[idx]), phase=cur["id"], to=ids[idx])
        me = sys.modules[__name__]
        gone = skills.release(me, args.root, st, cur["id"], keep=skills.wanted_next(me, args.root, st, ids[idx]))
        if gone:
            print("released at the end of %s: %s" % (cur["id"], ", ".join(gone)))
        print(skills.render(ids[idx], skills.plan(me, args.root, st, ids[idx]), short=True))
        picked = cat.brief(me, args.root, st, ids[idx])
        if picked:
            print(picked)
    save_state(args.root, st)


def cmd_skip(args):
    phases = load_gates()
    st = load_state(args.root)
    ph = phase_def(phases, args.phase)
    if not args.reason or not args.reason.strip():
        die("--reason is required to skip a phase.")
    if st["phases"][ph["id"]]["status"] == "done":
        die("phase already done.")
    st["phases"][ph["id"]]["status"] = "skipped"
    st["phases"][ph["id"]]["reason"] = args.reason.strip()
    if st["current"] == ph["id"]:
        ids = [p["id"] for p in phases]
        idx = ids.index(ph["id"]) + 1
        while idx < len(ids) and st["phases"][ids[idx]]["status"] == "skipped":
            idx += 1
        st["current"] = ids[idx] if idx < len(ids) else None
        if st["current"]:
            st["phases"][st["current"]]["status"] = "active"
    save_state(args.root, st)
    activity.append(args.root, "skip", "Skipped %s" % ph["id"], phase=ph["id"], reason=args.reason.strip())
    print("skipped %s; current: %s" % (ph["id"], st["current"]))


def slugify(text):
    return re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-")[:50] or "decision"


def cmd_decide(args):
    st = load_state(args.root)
    n = len(st["decisions"]) + 1
    entry = {
        "n": n,
        "title": args.title,
        "choice": args.choice,
        "why": args.why,
        "phase": args.phase or st["current"],
        "at": now(),
    }
    st["decisions"].append(entry)
    ddir = os.path.join(args.root, "docs", "decisions")
    os.makedirs(ddir, exist_ok=True)
    fname = "%04d-%s.md" % (n, slugify(args.title))
    with open(os.path.join(ddir, fname), "w", encoding="utf-8") as f:
        f.write("# %04d. %s\n\n- Date: %s\n- Phase: %s\n\n## Decision\n%s\n\n## Why\n%s\n\n"
                "## Alternatives considered\n_Add here._\n\n## Consequences\n_Add here._\n"
                % (n, args.title, entry["at"], entry["phase"], args.choice, args.why))
    save_state(args.root, st)
    activity.append(args.root, "decision", "Decision %d: %s" % (n, args.title), phase=entry["phase"], n=n, choice=args.choice, why=args.why)
    print("recorded decision %d -> docs/decisions/%s" % (n, fname))


def cmd_log(args):
    st = load_state(args.root)
    st["log"].append({"at": now(), "text": args.text})
    save_state(args.root, st)
    activity.append(args.root, "note", args.text, phase=st["current"])
    print("logged")


KINDS = ("building", "testing", "reviewing", "waiting", "done")


def cmd_event(args):
    st = load_state(args.root)
    ok = activity.append(args.root, "progress", args.text, phase=st["current"], kind=args.kind)
    print("shown in the live view" if ok else "could not write the activity log (continuing)")


def cmd_live(args):
    import hs_live
    if args.stop:
        print("stopped" if hs_live.stop(args.root) else "no live view is running for this project")
        return
    if args.ensure:
        url = hs_live.ensure(args.root, args.port)
        print(url or "could not start the live view")
        return
    hs_live.serve(args.root, args.port, open_browser=not args.no_open, control=not args.read_only, idle_hours=args.idle_hours, allow_run=args.allow_run)


def cmd_skills(args):
    me = sys.modules[__name__]
    st = load_state(args.root)
    action = args.action or "list"
    phase = args.phase or (args.target if action in ("list", "release") else None) or st["current"]
    if action == "list":
        if not phase:
            die("pipeline complete; name a phase.")
        phase_def(load_gates(), phase)
        rows = skills.plan(me, args.root, st, phase)
        print(json.dumps(rows, indent=2) if args.json else skills.render(phase, rows))
        return
    if action == "pull":
        if not args.target:
            die("give a provider id.")
        copied, kept = skills.pull(me, args.root, st, args.target, args.why, args.user_approved)
        save_state(args.root, st)
        print("pulled %s: %s" % (args.target, ("installed " + ", ".join(copied)) if copied else "nothing new to install")
              + ("; left your own %s alone" % ", ".join(kept) if kept else ""))
        rb = load_integrations()["providers"][args.target].get("requires_binary")
        if rb and not shutil.which(rb):
            print("note: these skills drive the `%s` command, which is not installed. Tell the user to install it: %s" % (rb, "; ".join(load_integrations()["providers"][args.target].get("install", [])[-1:])))
        return
    if action in ("use", "skip"):
        if not args.target:
            die("give a slot name.")
        if not phase:
            die("pipeline complete; name a phase with --phase.")
        skills.record(me, args.root, st, phase, args.target, "used" if action == "use" else "skipped", args.provider if action == "use" else None, args.why)
        save_state(args.root, st)
        print("%s %s in %s" % ("using" if action == "use" else "skipping", args.target, phase))
        return
    if action == "release":
        if not phase:
            die("name a phase.")
        gone = skills.release(me, args.root, st, phase)
        save_state(args.root, st)
        print("released: %s" % (", ".join(gone) or "(nothing was pulled for this phase)"))


def cmd_brief(args):
    st = load_state(args.root)
    me = sys.modules[__name__]
    a, t = args.action or "show", args.target
    if a == "set":
        text = args.text
        if args.file:
            with open(args.file, encoding="utf-8") as f:
                text = f.read()
        v = brief.set_brief(me, args.root, st, text)
        save_state(args.root, st)
        print("brief saved (version %d). Now extract the requirements and any gaps, conflicts or suggestions." % v)
        return
    if a == "show":
        print(brief.summary(st, root=args.root) or "(no brief yet: paste one in the dashboard or `hyperskill.py brief set --file idea.md`)")
        return
    if a == "finding":
        sub = t
        if sub != "add":
            die("usage: brief finding add --kind gap|conflict|suggestion --text TEXT [--proposed TEXT] [--blocking|--non-blocking]")
        fid = brief.add_finding(me, args.root, st, args.kind, args.text, args.proposed, True if args.blocking else (False if args.non_blocking else None))
        save_state(args.root, st)
        print("finding %s added (%s)" % (fid, args.kind))
        return
    if a == "req":
        sub = t
        if sub == "add":
            rid = brief.add_req(me, args.root, st, args.text)
            print("requirement %s added" % rid)
        elif sub == "done":
            rid = args.rest[0] if args.rest else ""
            brief.finish_req(me, args.root, st, rid, args.evidence)
            print("requirement %s covered" % rid)
        else:
            die("usage: brief req add --text TEXT | brief req done ID --evidence TEXT")
        save_state(args.root, st)
        return
    if a == "resolve":
        brief.resolve(me, args.root, st, t, args.state, args.answer)
        save_state(args.root, st)
        print("%s %s" % (t, args.state))
        return
    if a == "list":
        for i, f in st.get("findings", {}).items():
            print("%-4s %-10s %-9s %s" % (i, f["kind"], f["state"], f["text"][:90]))
        for i, r in st.get("requirements", {}).items():
            print("%-4s requirement %-9s %s" % (i, r["state"], r["text"][:90]))


def cmd_inputs(args):
    import hs_inputs
    load_state(args.root)
    a = args.action or "list"
    try:
        if a == "add":
            if not args.target:
                die("give the path of a file to attach.")
            with open(args.target, "rb") as f:
                name = hs_inputs.add(args.root, os.path.basename(args.target), f.read())
            activity.append(args.root, "note", "Attached input file " + name)
            print("attached %s" % name)
        elif a == "remove":
            hs_inputs.remove(args.root, args.target or "")
            print("removed")
        else:
            rows = hs_inputs.listing(args.root)
            for r in rows:
                print("%-40s %8d bytes  %s" % (r["name"], r["size"], "text extracted" if r["text"] else "original only"))
            if not rows:
                print("(no attached files)")
    except (hs_inputs.InputError, OSError) as exc:
        die(str(exc))


def cmd_place(args):
    st = load_state(args.root)
    me = sys.modules[__name__]
    a = args.action or "list"
    if a == "add":
        if not args.target:
            die("give the catalogue item id, e.g. sw-components/ring-chart")
        brief.add_place(me, args.root, st, args.target, args.where, args.why)
        save_state(args.root, st)
        print("placed %s" % args.target)
        return
    rows = brief.check(me, args.root, st, close=a == "check" and args.close)
    if a == "check" and args.close:
        save_state(args.root, st)
    for r in rows:
        print("%-34s placed=%-5s used=%s%s" % (r["id"], "yes" if r["placed"] else "NO", r["used_in"] or "NOT FOUND", "   at: " + r["where"] if r["where"] else ""))
    if not rows:
        print("(no Sitewright components or figures picked)")


def cmd_catalog(args):
    me = sys.modules[__name__]
    st = load_state(args.root)
    data, items = cat.catalog()
    action = args.action or "list"
    chosen = set(cat.selected(st))
    if action == "list":
        if args.group:
            g = next((x for x in data["groups"] if x["id"] == args.group), None)
            if not g:
                die("unknown group. Valid: %s" % ", ".join(x["id"] for x in data["groups"]))
            if args.json:
                print(json.dumps([dict(i, selected=i["id"] in chosen) for i in g["items"]], indent=1))
                return
            for i in g["items"]:
                print("[%s] %-44s %-10s %s" % ("x" if i["id"] in chosen else " ", i["id"], i["phase"], i["name"]))
            return
        print("%-14s %5s %4s  %s" % ("group", "items", "picked", "title"))
        for g in data["groups"]:
            n = sum(1 for i in g["items"] if i["id"] in chosen)
            print("%-14s %5d %6d  %s" % (g["id"], len(g["items"]), n, g["title"]))
        return
    if action == "set":
        added, removed = cat.apply(me, args.root, st, set(args.ids))
        save_state(args.root, st)
        print("%d picked (%d added, %d removed)" % (len(args.ids), added, removed))
        return
    if action in ("select", "unselect"):
        ids = set(args.ids)
        if args.group:
            g = next((x for x in data["groups"] if x["id"] == args.group), None)
            if not g:
                die("unknown group.")
            pool = [i["id"] for i in g["items"] if (i.get("rec") if args.recommended else True)]
            if args.recommended and action == "select" or args.all:
                ids |= set(pool)
        new = (chosen | ids) if action == "select" else (chosen - ids)
        if action == "select":  # picking an alternative replaces the one picked before in the same exclusive set
            for i in ids:
                ex = items.get(i, {}).get("exclusive")
                if ex:
                    new -= {o for o in chosen if o != i and items.get(o, {}).get("exclusive") == ex}
        added, removed = cat.apply(me, args.root, st, new)
        save_state(args.root, st)
        print("%d picked (%d added, %d removed)" % (len(new), added, removed))
        return
    if action == "brief":
        phase = args.phase or st["current"]
        print(cat.brief(me, args.root, st, phase) or "(nothing picked for this phase)")
        return
    if action == "sitewright":
        print(json.dumps(cat.sitewright_config(st), indent=2, ensure_ascii=False))


def cmd_extras(args):
    me = sys.modules[__name__]
    st = load_state(args.root)
    action = args.action or "list"
    if action == "list":
        phase = args.phase
        rows = [(i, e) for i, e in st.get("extras", {}).items() if not phase or e["phase"] == phase]
        if args.json:
            print(json.dumps([dict(e, id=i) for i, e in rows], indent=1))
            return
        for i, e in rows:
            tag = {"done": "[x]", "waived": "[~]"}.get(e["state"], "[ ]")
            print("%s %-9s %-34s %s" % (tag, e["phase"], i, e["text"][:90]))
        if not rows:
            print("(no selected checks)")
        return
    if not args.target:
        die("give the check id.")
    cat.finish(me, args.root, st, args.target, "done" if action == "done" else "waived", args.evidence if action == "done" else args.reason)
    save_state(args.root, st)
    print("%s %s" % (args.target, "done" if action == "done" else "waived"))


def cmd_pause(args):
    load_state(args.root)
    control.set_paused(args.root, args.cmd == "pause")
    activity.append(args.root, "note", "Paused: Claude's writes and commands are refused until resume" if args.cmd == "pause" else "Resumed")
    print("paused" if args.cmd == "pause" else "resumed")


def cmd_say(args):
    load_state(args.root)
    rid = control.push(args.root, " ".join(args.text))
    if not rid:
        die("nothing queued (empty text, or 20 instructions are already waiting).")
    activity.append(args.root, "note", "Instruction queued for Claude: " + activity.redact(" ".join(args.text), 160))
    print("queued; Claude receives it on its next step")


# ---------------------------------------------------------------- integrations

def load_integrations():
    with open(INTEGRATIONS_PATH, encoding="utf-8") as f:
        return json.load(f)


DEFAULT_ON = "karpathy-skills"
PACKS_DIR = os.path.normpath(os.path.join(_HERE, "..", "packs"))


def pack_skills(pid):
    """Names of the skill folders a bundled pack carries (empty when the provider is not bundled)."""
    base = os.path.join(PACKS_DIR, pid, "skills")
    if not os.path.isdir(base) or not re.fullmatch(r"[a-z0-9-]+", pid):
        return []
    return sorted(n for n in os.listdir(base) if os.path.isfile(os.path.join(base, n, "SKILL.md")))


def install_pack(root, st, pid):
    """Copy a bundled pack's skills into <project>/.claude/skills. Folders that already exist are left alone."""
    done = st["integrations"].setdefault("installed", {})
    mine = set(done.get(pid, []))
    dest = os.path.join(root, ".claude", "skills")
    copied, kept = [], []
    for name in pack_skills(pid):
        target = os.path.join(dest, name)
        if os.path.exists(target) and name not in mine:
            kept.append(name)
            continue
        shutil.rmtree(target, ignore_errors=True)
        shutil.copytree(os.path.join(PACKS_DIR, pid, "skills", name), target, symlinks=False)
        copied.append(name)
    if copied:
        done[pid] = sorted(mine | set(copied))
    return copied, kept


def uninstall_pack(root, st, pid):
    """Remove only the folders this tool installed for the pack."""
    removed = []
    for name in st["integrations"].get("installed", {}).pop(pid, []):
        target = os.path.join(root, ".claude", "skills", name)
        if os.path.isdir(target):
            shutil.rmtree(target)
            removed.append(name)
    return removed


def skill_roots(root):
    home = os.path.expanduser("~")
    return [os.path.join(home, ".claude", "skills"), os.path.join(root, ".claude", "skills"),
            os.path.join(home, ".agents", "skills"), os.path.join(root, ".agents", "skills")]


def installed_skill_names(root):
    """Directory names and frontmatter names of every skill we can see on disk."""
    names = set()
    dirs = []
    for r in skill_roots(root):
        dirs += glob.glob(os.path.join(r, "*", "SKILL.md"))
    home = os.path.expanduser("~")
    dirs += glob.glob(os.path.join(home, ".claude", "plugins", "**", "skills", "*", "SKILL.md"), recursive=True)
    dirs += glob.glob(os.path.join(root, ".claude", "plugins", "**", "skills", "*", "SKILL.md"), recursive=True)
    for path in dirs:
        names.add(os.path.basename(os.path.dirname(path)))
        try:
            with open(path, encoding="utf-8") as f:
                m = re.search(r"^name:\s*(.+)$", f.read(2000), re.M)
            if m:
                names.add(m.group(1).strip().strip("\"'"))
        except OSError:
            pass
    return names


def provider_state(pid, prov, st, names):
    """Return (installed, allowed, reason)."""
    det = prov.get("detect", {})
    if prov.get("builtin") or st["integrations"].get("installed", {}).get(pid):
        installed = True
    else:
        installed = any(n in names for n in det.get("skills", [])) or \
            any(shutil.which(b) for b in det.get("binaries", []))
    if prov.get("requires_binary") and not shutil.which(prov["requires_binary"]):
        installed = False  # the skills alone do nothing: they drive a command-line tool that has to be on this computer
    enabled = pid in st["integrations"]["enabled"]
    disabled = pid in st["integrations"]["disabled"]
    policy = prov.get("policy", "unreviewed")
    if disabled:
        return installed, False, "disabled for this project"
    if prov.get("noncommercial") and st["commercial"]:
        return installed, False, "licence %s forbids commercial use (project is commercial)" % prov.get("license")
    if policy in ("reference-only", "unreviewed"):
        return installed, False, policy
    if policy == "opt-in" and not enabled:
        return installed, False, "opt-in: run `integrations enable %s` after reading its risks" % pid
    return installed, True, "ok"


def resolve_slot(slot, st, names, reg):
    sd = reg["slots"].get(slot)
    if sd is None:
        die("unknown slot '%s'. Valid: %s" % (slot, ", ".join(sorted(reg["slots"]))))
    rows, use, suggest = [], None, []
    for pid in sd["providers"]:
        prov = reg["providers"][pid]
        inst, ok, why = provider_state(pid, prov, st, names)
        rows.append({"id": pid, "installed": inst, "allowed": ok, "why": why})
        if inst and ok and use is None:
            use = pid
        if ok and not inst and not prov.get("builtin"):
            how = ["hyperskill.py integrations enable %s   (bundled pack, no download)" % pid] if pack_skills(pid) else prov.get("install", [])
            suggest.append({"id": pid, "install": how, "license": prov.get("license"),
                            "risks": prov.get("risks", [])})
    return {"slot": slot, "use": use, "providers": rows, "suggest_install": suggest, "fallback": sd["fallback"]}


def cmd_integrations(args):
    reg = load_integrations()
    st = load_state(args.root)
    names = installed_skill_names(args.root)
    action = args.action or "list"
    if action in ("enable", "disable"):
        targets = list(reg["providers"]) if args.all else [args.target]
        if args.all:
            targets = [t for t in targets if pack_skills(t) and (reg["providers"][t].get("policy") == "recommended" or args.include_opt_in)
                       and not (reg["providers"][t].get("noncommercial") and st["commercial"])]
        elif not args.target or args.target not in reg["providers"]:
            die("give a provider id (or --all). Valid: %s" % ", ".join(reg["providers"]))
        lst_in, lst_out = ("enabled", "disabled") if action == "enable" else ("disabled", "enabled")
        for t in targets:
            if t not in st["integrations"][lst_in]:
                st["integrations"][lst_in].append(t)
            if t in st["integrations"][lst_out]:
                st["integrations"][lst_out].remove(t)
            if action == "enable":
                copied, kept = install_pack(args.root, st, t)
                note = "installed %d skill%s into .claude/skills" % (len(copied), "" if len(copied) == 1 else "s") if copied else ""
                if kept:
                    note += ("; " if note else "") + "left your own %s alone" % ", ".join(kept)
            else:
                removed = uninstall_pack(args.root, st, t)
                note = "removed %d skill folder%s" % (len(removed), "" if len(removed) == 1 else "s") if removed else ""
            activity.append(args.root, "config", "%sd %s%s" % (action, t, " (" + note + ")" if note else ""))
            print("%sd %s%s" % (action, t, "  - " + note if note else ""))
        save_state(args.root, st)
        return
    if action == "resolve":
        if not args.target:
            die("give a slot name.")
        out = resolve_slot(args.target, st, names, reg)
        if args.json:
            print(json.dumps(out, indent=2))
        else:
            print_resolution(out)
        return
    if action == "phase":
        phases = load_gates()
        pid = args.target or st["current"]
        if not pid:
            die("pipeline complete; name a phase.")
        ph = phase_def(phases, pid)
        outs = [resolve_slot(s, st, names, reg) for s in ph.get("slots", [])]
        if args.json:
            print(json.dumps(outs, indent=2))
        else:
            print("phase %s slots:" % ph["id"])
            for o in outs:
                print_resolution(o, short=True)
        return
    # list
    rows = []
    for pid, prov in reg["providers"].items():
        inst, ok, why = provider_state(pid, prov, st, names)
        rows.append({"id": pid, "kind": prov.get("kind"), "license": prov.get("license"),
                     "policy": prov.get("policy"), "installed": inst, "allowed": ok, "why": why,
                     "bundled": bool(pack_skills(pid)), "skills": pack_skills(pid)})
    if args.json:
        print(json.dumps(rows, indent=2))
        return
    print("%-26s %-14s %-12s %-9s %-7s %s" % ("id", "kind", "policy", "installed", "allowed", "note"))
    for r in rows:
        print("%-26s %-14s %-12s %-9s %-7s %s" % (r["id"], r["kind"], r["policy"], "yes" if r["installed"] else "no",
                                                  "yes" if r["allowed"] else "no", "" if r["allowed"] else r["why"]))


def print_resolution(o, short=False):
    head = "%-22s -> %s" % (o["slot"], o["use"] or "fallback: " + o["fallback"])
    print(head)
    if short:
        for s in o["suggest_install"]:
            print("    could install %s (%s): %s" % (s["id"], s["license"], s["install"][0] if s["install"] else "see docs"))
        return
    for r in o["providers"]:
        print("    %-26s installed=%-5s allowed=%-5s %s" % (r["id"], r["installed"], r["allowed"], r["why"]))
    for s in o["suggest_install"]:
        print("    could install %s (%s): %s" % (s["id"], s["license"], "; ".join(s["install"]) or "see docs"))
        for risk in s["risks"]:
            print("       risk: " + risk)
    print("    fallback: " + o["fallback"])


def build_parser():
    ap = argparse.ArgumentParser(description="HyperSkill state and gate tracker")
    ap.add_argument("--root", default=os.getcwd())
    sub = ap.add_subparsers(dest="cmd", required=True)

    p = sub.add_parser("init")
    p.add_argument("--name")
    p.add_argument("--force", action="store_true")
    p.add_argument("--no-karpathy", dest="no_karpathy", action="store_true", help="do not switch on the bundled Karpathy coding guidelines")
    p.add_argument("--noncommercial", action="store_true", help="project is not commercial (unlocks noncommercial-licence tools)")
    p.add_argument("--tenancy", choices=TENANCIES, help="who owns data: organization (default), user, or none")
    p.add_argument("--unavailable", help="comma list of what this environment lacks: host,provider,device,human")
    p.set_defaults(fn=cmd_init)

    p = sub.add_parser("config", help="show or change tenancy and what this environment lacks")
    p.add_argument("--tenancy", choices=TENANCIES)
    p.add_argument("--unavailable", help="comma list: host,provider,device,human (or 'none')")
    p.add_argument("--autolive", choices=("on", "off"), help="start the dashboard automatically when a session opens")
    p.set_defaults(fn=cmd_config)

    p = sub.add_parser("status")
    p.add_argument("--json", action="store_true")
    p.set_defaults(fn=cmd_status)

    p = sub.add_parser("gate")
    p.add_argument("phase")
    p.add_argument("--pass", dest="pass_ids")
    p.add_argument("--evidence")
    p.add_argument("--waive", dest="waive_ids")
    p.add_argument("--reason")
    p.add_argument("--run", dest="run_id")
    p.add_argument("--cmd")
    p.add_argument("--timeout", type=int, default=600)
    p.add_argument("--waive-unavailable", dest="waive_unavailable", action="store_true",
                   help="waive every open item that needs something marked unavailable (recorded with the reason)")
    p.set_defaults(fn=cmd_gate)

    p = sub.add_parser("advance")
    p.set_defaults(fn=cmd_advance)

    p = sub.add_parser("skip")
    p.add_argument("phase")
    p.add_argument("--reason")
    p.set_defaults(fn=cmd_skip)

    p = sub.add_parser("decide")
    p.add_argument("--title", required=True)
    p.add_argument("--choice", required=True)
    p.add_argument("--why", required=True)
    p.add_argument("--phase")
    p.set_defaults(fn=cmd_decide)

    p = sub.add_parser("log")
    p.add_argument("text")
    p.set_defaults(fn=cmd_log)

    p = sub.add_parser("event", help="tell the live view what is happening right now")
    p.add_argument("text")
    p.add_argument("--kind", choices=KINDS, default="building")
    p.set_defaults(fn=cmd_event)

    p = sub.add_parser("brief", help="the pasted idea, what was found in it, and the user's answers")
    p.add_argument("action", nargs="?", choices=["show", "set", "finding", "req", "resolve", "list"])
    p.add_argument("target", nargs="?")
    p.add_argument("rest", nargs="*")
    p.add_argument("--text")
    p.add_argument("--file")
    p.add_argument("--kind", choices=list(brief.KINDS))
    p.add_argument("--proposed", default="")
    p.add_argument("--blocking", action="store_true")
    p.add_argument("--non-blocking", dest="non_blocking", action="store_true")
    p.add_argument("--evidence")
    p.add_argument("--state", choices=["accepted", "rejected", "answered"])
    p.add_argument("--answer", default="")
    p.set_defaults(fn=cmd_brief)

    p = sub.add_parser("inputs", help="files attached as project input (requirements, specs, notes)")
    p.add_argument("action", nargs="?", choices=["list", "add", "remove"])
    p.add_argument("target", nargs="?")
    p.set_defaults(fn=cmd_inputs)

    p = sub.add_parser("place", help="where each picked Sitewright component or figure is used")
    p.add_argument("action", nargs="?", choices=["list", "add", "check"])
    p.add_argument("target", nargs="?")
    p.add_argument("--where")
    p.add_argument("--why", default="")
    p.add_argument("--close", action="store_true", help="check: close the checks of pieces that are placed and really used")
    p.set_defaults(fn=cmd_place)

    p = sub.add_parser("catalog", help="what you can pick from (Sitewright parts, styles, checks, add-ons ...) and what you picked")
    p.add_argument("action", nargs="?", choices=["list", "select", "unselect", "set", "brief", "sitewright"])
    p.add_argument("ids", nargs="*", help="select|unselect: item ids such as concepts/rate-limiting")
    p.add_argument("--group")
    p.add_argument("--all", action="store_true", help="with --group: every item of the group")
    p.add_argument("--recommended", action="store_true", help="with --group: the recommended items of the group")
    p.add_argument("--phase")
    p.add_argument("--json", action="store_true")
    p.set_defaults(fn=cmd_catalog)

    p = sub.add_parser("extras", help="the checks that came from your selection")
    p.add_argument("action", nargs="?", choices=["list", "done", "waive"])
    p.add_argument("target", nargs="?")
    p.add_argument("--phase")
    p.add_argument("--evidence")
    p.add_argument("--reason")
    p.add_argument("--json", action="store_true")
    p.set_defaults(fn=cmd_extras)

    p = sub.add_parser("skills", help="which skill each phase should use, when and why; pull one, record the decision")
    p.add_argument("action", nargs="?", choices=["list", "pull", "use", "skip", "release"])
    p.add_argument("target", nargs="?", help="pull: provider id; use|skip: slot; list|release: phase")
    p.add_argument("--phase", help="phase (default: the current one)")
    p.add_argument("--why")
    p.add_argument("--provider", help="use: which provider you are using for the slot")
    p.add_argument("--user-approved", dest="user_approved", action="store_true", help="pull: the user said yes to this opt-in skill")
    p.add_argument("--json", action="store_true")
    p.set_defaults(fn=cmd_skills)

    for name in ("pause", "resume"):
        p = sub.add_parser(name, help="stop / allow Claude's file writes and commands")
        p.set_defaults(fn=cmd_pause)
    p = sub.add_parser("say", help="queue an instruction for Claude")
    p.add_argument("text", nargs="+")
    p.set_defaults(fn=cmd_say)

    p = sub.add_parser("live", help="open the live dashboard (127.0.0.1 only; it can also control the flow)")
    p.add_argument("--read-only", dest="read_only", action="store_true", help="no buttons: show only")
    p.add_argument("--allow-run", dest="allow_run", action="store_true", help="let the dashboard's chat box start Claude on this project (off unless you ask)")
    p.add_argument("--stop", action="store_true", help="stop this project's running live view")
    p.add_argument("--ensure", action="store_true", help="start it in the background if it is not running; print its address")
    p.add_argument("--idle-hours", dest="idle_hours", type=float, default=0, help="stop by itself after this long with no page open (0 = never)")
    p.add_argument("--port", type=int, default=4777)
    p.add_argument("--no-open", action="store_true", help="do not try to open a browser")
    p.set_defaults(fn=cmd_live)

    p = sub.add_parser("integrations")
    p.add_argument("--all", action="store_true", help="enable|disable: every bundled recommended provider")
    p.add_argument("--include-opt-in", dest="include_opt_in", action="store_true", help="with --all: also the bundled opt-in providers")
    p.add_argument("action", nargs="?", choices=["list", "resolve", "phase", "enable", "disable"])
    p.add_argument("target", nargs="?")
    p.add_argument("--json", action="store_true")
    p.set_defaults(fn=cmd_integrations)
    return ap


def main(argv=None):
    args = build_parser().parse_args(argv)
    args.fn(args)


if __name__ == "__main__":
    main()
