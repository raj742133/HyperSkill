#!/usr/bin/env python3
"""HyperSkill state and gate tracker.

Keeps the pipeline state in <project>/.hyperskill/state.json so any session can
resume. A phase may only be advanced once every gate item is either passed
(with evidence) or waived (with a reason). Standard library only.

Usage:
  hyperskill.py init [--name NAME] [--force]
  hyperskill.py status [--json]
  hyperskill.py gate PHASE                          show gate items and their state
  hyperskill.py gate PHASE --pass ID[,ID] --evidence TEXT
  hyperskill.py gate PHASE --waive ID[,ID] --reason TEXT
  hyperskill.py gate PHASE --run ID --cmd COMMAND   run a command; pass only if it exits 0
  hyperskill.py advance                             move to the next phase if the gate is clear
  hyperskill.py skip PHASE --reason TEXT            skip a whole phase (recorded)
  hyperskill.py decide --title T --choice C --why W [--phase PHASE]
  hyperskill.py log TEXT
  hyperskill.py integrations [list] [--json]        vetted external skills and what is installed
  hyperskill.py integrations resolve SLOT [--json]  which provider to use for a capability slot
  hyperskill.py integrations phase [PHASE]          resolve every slot of a phase
  hyperskill.py integrations enable|disable ID      opt a provider in / out for this project

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


def gate_summary(st, phase):
    """Return (open_ids, done_count, total) for a phase."""
    items = phase["gate"]
    recorded = st["phases"][phase["id"]]["gate"]
    open_ids = [i["id"] for i in items if i["id"] not in recorded]
    return open_ids, len(items) - len(open_ids), len(items)


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
        "integrations": {"enabled": [], "disabled": []},
        "phases": {p["id"]: {"status": "pending", "gate": {}} for p in phases},
        "decisions": [],
        "log": [],
    }
    st["phases"][phases[0]["id"]]["status"] = "active"
    save_state(args.root, st)
    print("initialised %s (%s); current phase: %s"
          % (st["name"], "commercial" if st["commercial"] else "non-commercial", st["current"]))


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
    if args.run_id:
        if not args.cmd:
            die("--run needs --cmd COMMAND.")
        if args.run_id not in valid:
            die("'%s' is not a gate item of phase %s" % (args.run_id, ph["id"]))
        try:
            r = subprocess.run(args.cmd, shell=True, cwd=args.root, capture_output=True, text=True, timeout=args.timeout)
        except subprocess.TimeoutExpired:
            die("command timed out after %ss; nothing recorded." % args.timeout)
        tail = ((r.stdout or "") + (r.stderr or "")).strip()[-400:]
        if r.returncode != 0:
            print(tail)
            die("command exited %d; '%s' stays open." % (r.returncode, args.run_id))
        rec[args.run_id] = {"state": "passed", "evidence": "ran `%s` -> exit 0. Output tail: %s" % (args.cmd, tail or "(none)"),
                            "at": now(), "ran": True}
        save_state(args.root, st)
    if args.pass_ids:
        if not args.evidence or not args.evidence.strip():
            die("--pass needs --evidence (what was run / seen). No evidence, no pass.")
        for gid in csv(args.pass_ids):
            if gid not in valid:
                die("'%s' is not a gate item of phase %s" % (gid, ph["id"]))
            rec[gid] = {"state": "passed", "evidence": args.evidence.strip(), "at": now()}
    if args.waive_ids:
        if not args.reason or not args.reason.strip():
            die("--waive needs --reason.")
        for gid in csv(args.waive_ids):
            if gid not in valid:
                die("'%s' is not a gate item of phase %s" % (gid, ph["id"]))
            rec[gid] = {"state": "waived", "reason": args.reason.strip(), "at": now()}
    if args.pass_ids or args.waive_ids:
        save_state(args.root, st)
    for item in ph["gate"]:
        r = rec.get(item["id"])
        tag = {"passed": "[x]", "waived": "[~]"}.get(r["state"], "[ ]") if r else "[ ]"
        print("%s %-22s %s" % (tag, item["id"], item["text"]))
        if r:
            print("      %s: %s" % (r["state"], r.get("evidence") or r.get("reason")))


def cmd_advance(args):
    phases = load_gates()
    st = load_state(args.root)
    if not st["current"]:
        die("pipeline already complete.")
    cur = phase_def(phases, st["current"])
    open_ids, _, _ = gate_summary(st, cur)
    if open_ids:
        die("gate not clear for '%s'. Open items: %s" % (cur["id"], ", ".join(open_ids)))
    st["phases"][cur["id"]]["status"] = "done"
    st["phases"][cur["id"]]["completed"] = now()
    ids = [p["id"] for p in phases]
    idx = ids.index(cur["id"]) + 1
    while idx < len(ids) and st["phases"][ids[idx]]["status"] == "skipped":
        idx += 1
    if idx >= len(ids):
        st["current"] = None
        print("pipeline complete")
    else:
        st["current"] = ids[idx]
        st["phases"][ids[idx]]["status"] = "active"
        print("advanced: %s -> %s" % (cur["id"], ids[idx]))
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
    print("recorded decision %d -> docs/decisions/%s" % (n, fname))


def cmd_log(args):
    st = load_state(args.root)
    st["log"].append({"at": now(), "text": args.text})
    save_state(args.root, st)
    print("logged")


# ---------------------------------------------------------------- integrations

def load_integrations():
    with open(INTEGRATIONS_PATH, encoding="utf-8") as f:
        return json.load(f)


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
    if prov.get("builtin"):
        installed = True
    else:
        installed = any(n in names for n in det.get("skills", [])) or \
            any(shutil.which(b) for b in det.get("binaries", []))
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
            suggest.append({"id": pid, "install": prov.get("install", []), "license": prov.get("license"),
                            "risks": prov.get("risks", [])})
    return {"slot": slot, "use": use, "providers": rows, "suggest_install": suggest, "fallback": sd["fallback"]}


def cmd_integrations(args):
    reg = load_integrations()
    st = load_state(args.root)
    names = installed_skill_names(args.root)
    action = args.action or "list"
    if action in ("enable", "disable"):
        if not args.target or args.target not in reg["providers"]:
            die("give a provider id. Valid: %s" % ", ".join(reg["providers"]))
        lst_in, lst_out = ("enabled", "disabled") if action == "enable" else ("disabled", "enabled")
        if args.target not in st["integrations"][lst_in]:
            st["integrations"][lst_in].append(args.target)
        if args.target in st["integrations"][lst_out]:
            st["integrations"][lst_out].remove(args.target)
        save_state(args.root, st)
        print("%sd %s" % (action, args.target))
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
                     "policy": prov.get("policy"), "installed": inst, "allowed": ok, "why": why})
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
    p.add_argument("--noncommercial", action="store_true", help="project is not commercial (unlocks noncommercial-licence tools)")
    p.set_defaults(fn=cmd_init)

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

    p = sub.add_parser("integrations")
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
