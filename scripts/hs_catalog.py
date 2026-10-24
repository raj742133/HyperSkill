"""What the person picked from the catalogue, and how the picks reach the build.

skills/hyperskill/catalog.json lists everything selectable (see build_catalog.py). A selection lives in .hyperskill/state.json:
  catalog.selected   item ids the person ticked
  extras             one tracked check per selected "track" item: {phase, text, state: open|done|waived, ...}
Selected "build" items (Sitewright effects and components, a visual style, a palette, skills) go into a brief that the session hook and
`advance` hand to Claude for the phase they belong to. Selected "track" items (design tells, production concepts, site fixes,
add-ons) must be done with evidence or waived with a reason before their phase can end, exactly like a gate item.
`core` (the tracker module) is passed in. Standard library only.
"""
import json
import os

HERE = os.path.dirname(os.path.abspath(__file__))
CATALOG_PATH = os.path.join(HERE, "..", "skills", "hyperskill", "catalog.json")
_CACHE = {}


def catalog():
    mtime = os.path.getmtime(CATALOG_PATH)
    if _CACHE.get("m") != mtime:
        with open(CATALOG_PATH, encoding="utf-8") as f:
            data = json.load(f)
        items = {}
        for g in data["groups"]:
            for it in g["items"]:
                items[it["id"]] = dict(it, group=g["id"], group_title=g["title"], source=g["source"])
        _CACHE.update(m=mtime, data=data, items=items)
    return _CACHE["data"], _CACHE["items"]


def selected(st):
    return list(st.get("catalog", {}).get("selected", []))


def phase_rank(core, pid):
    ids = [p["id"] for p in core.load_gates()]
    return ids.index(pid) if pid in ids else 0


def apply(core, root, st, ids):
    """Replace the selection. Returns (added, removed) counts. Refuses unknown ids and two picks in one exclusive set."""
    data, items = catalog()
    ids = sorted(set(ids))
    unknown = [i for i in ids if i not in items]
    if unknown:
        core.die("unknown catalogue item(s): %s" % ", ".join(unknown[:5]))
    seen = {}
    for i in ids:
        ex = items[i].get("exclusive")
        if ex:
            if ex in seen:
                core.die("pick one only: %s and %s are alternatives (%s)." % (seen[ex], i, ex))
            seen[ex] = i
    before = set(selected(st))
    st.setdefault("catalog", {})["selected"] = ids
    extras = st.setdefault("extras", {})
    cur = st.get("current") or "scale"
    for i in ids:
        it = items[i]
        if it["mode"] == "track" and i not in extras:
            ph = it["phase"] if phase_rank(core, it["phase"]) >= phase_rank(core, cur) else cur
            extras[i] = {"phase": ph, "name": it["name"], "group": it["group_title"], "text": it.get("text") or it["desc"], "state": "open", "at": core.now()}
    for i in list(extras):
        if i not in ids and extras[i]["state"] == "open":
            del extras[i]
    after = set(ids)
    core.activity.append(root, "note", "Selection saved: %d picked (%d added, %d removed)" % (len(after), len(after - before), len(before - after)))
    return len(after - before), len(before - after)


def open_extras(st, phase):
    return [(i, e) for i, e in st.get("extras", {}).items() if e["phase"] == phase and e["state"] == "open"]


def finish(core, root, st, eid, state, note):
    e = st.get("extras", {}).get(eid)
    if not e:
        core.die("no selected check '%s'. List them: hyperskill.py extras" % eid)
    if not note or not note.strip():
        core.die("give --evidence (what you ran or saw)" if state == "done" else "give --reason")
    if state == "done" and not core.evidence_is_concrete(note):
        core.die("--evidence: " + core.EVIDENCE_HINT)
    e.update(state=state, at=core.now(), **({"evidence": note.strip()} if state == "done" else {"reason": note.strip()}))
    core.activity.append(root, "gate_pass" if state == "done" else "gate_waive", "%s/%s %s" % (e["phase"], eid, "done" if state == "done" else "waived"),
                         phase=e["phase"], item=eid, label=e["name"], **({"evidence": note.strip()} if state == "done" else {"reason": note.strip()}))


def sitewright_config(st):
    """The Sitewright site.json fragment and flags that the selection adds up to."""
    _, items = catalog()
    cfg = {"modules": [], "effects": {}, "design": {}}
    comps, extras, figs = [], [], []
    keymap = {"heroBackground", "loginBackground", "headline", "buttons", "cards", "reveal", "preset"}
    for i in selected(st):
        it = items.get(i)
        if not it or it["source"] != "sitewright" or "cfg" not in it:
            continue
        for k, v in it["cfg"].items():
            if k == "modules":
                cfg["modules"].append(v)
            elif k in keymap:
                cfg["effects"][k] = v
            elif k == "extras":
                extras.append(v)
            elif k == "component":
                comps.append(v)
            elif k == "figure":
                figs.append(v)
            elif k == "theme":
                cfg["design"]["theme"] = v
    if comps:
        cfg["effects"]["components"] = comps
    if extras:
        cfg["effects"]["extras"] = extras
    if figs:
        defaults = {"hero": "exploded", "releases": "parcel", "signin": "padlock", "mfa": "vault", "connect": "scanner", "empty": "bars", "notfound": "dish"}
        places, rest = {}, []
        for f in figs:
            place = next((p for p, d in defaults.items() if d == f and p not in places), None)
            if place:
                places[place] = f
            else:
                rest.append(f)
        free = [p for p in defaults if p not in places]
        for f in rest:
            if free:
                places[free.pop(0)] = f
        cfg["effects"]["figures"] = places
    return {k: v for k, v in cfg.items() if v}


def brief(core, root, st, phase):
    """Text for Claude: what the person picked for this phase."""
    _, items = catalog()
    sel = [items[i] for i in selected(st) if i in items]
    lines = []
    build = [it for it in sel if it["mode"] == "build" and (it["phase"] == phase or phase == "plan")]
    if build:
        by = {}
        for it in build:
            by.setdefault(it["group_title"], []).append(it["name"])
        lines.append("Picked by the user in the dashboard (use exactly these; ask before substituting):")
        for title, names in by.items():
            lines.append("- %s: %s" % (title, ", ".join(names[:40]) + (" ..." if len(names) > 40 else "")))
        sw = sitewright_config(st)
        if sw:
            lines.append("Sitewright config to merge into site.json (`hyperskill.py catalog sitewright` prints it): " + json.dumps(sw, ensure_ascii=False))
        packs = sorted({it["pack"] for it in build if it.get("pack")})
        if packs:
            lines.append("Skills the user wants used (pull their packs with `hyperskill.py skills pull ID`): " + ", ".join(packs))
    opened = open_extras(st, phase) if phase else []
    if opened:
        lines.append("Selected checks that must be done (with evidence) or waived (with a reason) before phase %s can end:" % phase)
        for eid, e in opened:
            lines.append("- %s [%s]: %s" % (eid, e["group"], e["text"]))
        lines.append("Close one with `hyperskill.py extras done ID --evidence ...` or `extras waive ID --reason ...`.")
    return "\n".join(lines)
