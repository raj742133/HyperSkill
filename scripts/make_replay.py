#!/usr/bin/env python3
"""Turn a project's recorded activity log into site/live/replay.json for the public replay.

Usage: python3 scripts/make_replay.py PROJECT_DIR [--out site/live/replay.json] [--note TEXT] [--max 400]

The replay is a real recording (nothing is invented or reordered). Every string is passed through the redactor again,
absolute paths are reduced to project-relative ones, and the phases and their checks come from gates.json for the
project's tenancy. Standard library only.
"""
import argparse
import json
import os
import re
import sys

_HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, _HERE)
import hs_activity as activity  # noqa: E402
import hyperskill as core  # noqa: E402


def clean(value, root):
    if isinstance(value, str):
        value = value.replace(root, ".")
        value = re.sub(r"/(?:home|Users|root|tmp)/[^\s'\"]+", "<path>", value)
        return activity.redact(value, 600)
    return value


def build(project, note=None, limit=400):
    root = os.path.abspath(project)
    st = core.load_state(root)
    events, _ = activity.read_events(root)
    if not events:
        raise SystemExit("error: no activity recorded in %s" % root)
    events = events[:limit]
    out_events = []
    for e in events:
        out_events.append({k: clean(v, root) for k, v in e.items()})
    phases = []
    for p in core.load_gates():
        items = [{"id": i["id"], "text": core.item_text(st, i), **({"needs": i["needs"]} if i.get("needs") else {})}
                 for i in p["gate"] if core.applies(st, i)]
        phases.append({"id": p["id"], "title": p["title"], "skill": p["skill"], "items": items})
    return {
        "project": st["name"], "tenancy": st["tenancy"],
        "note": note or "A recording of a real session, not a live one. Nothing was added or reordered.",
        "recorded": events[0]["ts"], "phases": phases, "events": out_events,
    }


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("project")
    ap.add_argument("--out", default=os.path.join(_HERE, "..", "site", "live", "replay.json"))
    ap.add_argument("--note")
    ap.add_argument("--max", type=int, default=400)
    args = ap.parse_args(argv)
    data = build(args.project, args.note, args.max)
    with open(args.out, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=1)
        f.write("\n")
    print("wrote %s: %d events, %d phases" % (os.path.normpath(args.out), len(data["events"]), len(data["phases"])))


if __name__ == "__main__":
    main()
