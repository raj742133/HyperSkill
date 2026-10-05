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
  hyperskill.py advance                             move to the next phase if the gate is clear
  hyperskill.py skip PHASE --reason TEXT            skip a whole phase (recorded)
  hyperskill.py decide --title T --choice C --why W [--phase PHASE]
  hyperskill.py log TEXT

Use --root DIR to point at the project (default: current directory).
"""
import argparse
import datetime
import json
import os
import re
import sys

GATES_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "skills", "hyperskill", "gates.json")


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
        return json.load(f)


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
        "phases": {p["id"]: {"status": "pending", "gate": {}} for p in phases},
        "decisions": [],
        "log": [],
    }
    st["phases"][phases[0]["id"]]["status"] = "active"
    save_state(args.root, st)
    print("initialised %s; current phase: %s" % (st["name"], st["current"]))


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


def build_parser():
    ap = argparse.ArgumentParser(description="HyperSkill state and gate tracker")
    ap.add_argument("--root", default=os.getcwd())
    sub = ap.add_subparsers(dest="cmd", required=True)

    p = sub.add_parser("init")
    p.add_argument("--name")
    p.add_argument("--force", action="store_true")
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
    return ap


def main(argv=None):
    args = build_parser().parse_args(argv)
    args.fn(args)


if __name__ == "__main__":
    main()
