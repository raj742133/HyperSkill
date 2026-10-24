"""The person's idea, what Claude finds in it, and where each picked piece is used.

  state.brief          {text, version, at}: the pasted idea (also written to .hyperskill/brief.md)
  state.requirements   what the brief asks for, as Claude lists it; closed with evidence
  state.findings       gaps, conflicts and suggestions Claude found; the person accepts, rejects or answers each one
  state.placements     for each picked Sitewright component or figure: where it is used and why

The brief decides WHAT gets built. HyperSkill decides HOW: the phases, the gates and the evidence. A brief never waives a gate, and
HyperSkill never silently rewrites the brief: it lists what it would change and the person decides. Open gaps and conflicts block
`advance` until they are answered. `core` (the tracker module) is passed in. Standard library only.
"""
import os
import re

MAX_BRIEF = 20000
KINDS = ("gap", "conflict", "suggestion")
PRECEDENCE = ("Precedence when choices clash: 1) what the user ticked in the dashboard, 2) what the brief says, 3) the design system the user selected, "
              "4) Sitewright's defaults, 5) HyperSkill's defaults. The brief decides what to build; HyperSkill decides how (phases, gates, evidence). "
              "A brief never waives a gate, and you never rewrite the brief silently: list what you would change as a finding and let the user decide.")


def clean(text, limit):
    return re.sub(r"[\x00-\x08\x0b\x0c\x0e-\x1f]", "", str(text or "")).strip()[:limit]


def set_brief(core, root, st, text):
    text = clean(text, MAX_BRIEF)
    if not text:
        core.die("the brief is empty.")
    b = st.get("brief") or {"version": 0}
    st["brief"] = {"text": text, "version": b["version"] + 1, "at": core.now()}
    path = os.path.join(root, ".hyperskill", "brief.md")
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        f.write(text + "\n")
    core.activity.append(root, "note", "Brief saved (version %d, %d characters)" % (st["brief"]["version"], len(text)))
    return st["brief"]["version"]


def _next(st, key, prefix):
    n = 1 + max([int(re.sub(r"\D", "", k) or 0) for k in st.get(key, {})] + [0])
    return "%s%d" % (prefix, n)


def add_finding(core, root, st, kind, text, proposed="", blocking=None):
    if kind not in KINDS:
        core.die("kind must be one of: %s" % ", ".join(KINDS))
    text = clean(text, 400)
    if not text:
        core.die("give the finding text.")
    fid = _next(st, "findings", "f")
    st.setdefault("findings", {})[fid] = {"kind": kind, "text": text, "proposed": clean(proposed, 400), "blocking": kind != "suggestion" if blocking is None else bool(blocking),
                                          "state": "open", "answer": "", "at": core.now()}
    core.activity.append(root, "note", "Finding %s (%s): %s" % (fid, kind, core.activity.redact(text, 160)))
    return fid


def resolve(core, root, st, fid, state, answer=""):
    f = st.get("findings", {}).get(fid)
    if not f:
        core.die("no finding '%s'." % fid)
    if state not in ("accepted", "rejected", "answered"):
        core.die("state must be accepted, rejected or answered.")
    if state == "answered" and not clean(answer, 600):
        core.die("an answer needs text.")
    f.update(state=state, answer=clean(answer, 600), resolved=core.now())
    core.activity.append(root, "decision", "Finding %s %s%s" % (fid, state, ": " + core.activity.redact(answer, 120) if answer else ""))


def open_blocking(st):
    return [i for i, f in st.get("findings", {}).items() if f["state"] == "open" and f["blocking"]]


def add_req(core, root, st, text):
    text = clean(text, 300)
    if not text:
        core.die("give the requirement text.")
    rid = _next(st, "requirements", "r")
    st.setdefault("requirements", {})[rid] = {"text": text, "state": "open", "at": core.now()}
    return rid


def finish_req(core, root, st, rid, evidence):
    r = st.get("requirements", {}).get(rid)
    if not r:
        core.die("no requirement '%s'." % rid)
    if not core.evidence_is_concrete(evidence or ""):
        core.die("--evidence: " + core.EVIDENCE_HINT)
    r.update(state="covered", evidence=clean(evidence, 400), at=core.now())
    core.activity.append(root, "note", "Requirement %s covered" % rid)


def summary(st, limit=1800, root=None):
    """What the hook hands Claude: the brief, the precedence rule, what is still open and what the user already decided."""
    b = st.get("brief")
    files = ""
    if root:
        import hs_inputs
        files = hs_inputs.summary(root)
    if not b and not files:
        return ""
    lines = (["The user's brief (version %d; full text in .hyperskill/brief.md):" % b["version"], b["text"][:limit] + (" ..." if len(b["text"]) > limit else "")]
             if b else ["The user has not written a brief, but attached files."]) + ([files] if files else []) + [PRECEDENCE]
    reqs = st.get("requirements", {})
    fnd = st.get("findings", {})
    if not reqs and not fnd:
        lines.append("Nothing has been extracted yet. Read the brief, then list each requirement (`hyperskill.py brief req add --text ...`) and every gap, conflict or "
                     "improvement you see (`hyperskill.py brief finding add --kind gap|conflict|suggestion --text ... [--proposed ...]`). Ask nothing in chat that a finding can ask.")
    openf = [(i, f) for i, f in fnd.items() if f["state"] == "open"]
    if openf:
        lines.append("Waiting for the user's answer (do not assume): " + "; ".join("%s [%s] %s" % (i, f["kind"], f["text"]) for i, f in openf))
    done = [(i, f) for i, f in fnd.items() if f["state"] != "open"]
    if done:
        lines.append("Decided by the user: " + "; ".join("%s %s%s" % (i, f["state"], " (" + f["answer"] + ")" if f["answer"] else "") + " <- " + f["text"][:80] for i, f in done))
    left = [i for i, r in reqs.items() if r["state"] == "open"]
    if reqs:
        lines.append("Requirements: %d, covered %d. Open: %s" % (len(reqs), len(reqs) - len(left), ", ".join("%s %s" % (i, reqs[i]["text"][:60]) for i in left[:12]) or "none"))
    return "\n".join(lines)


# ---------------------------------------------------------------- placements of picked Sitewright pieces
PLACEABLE = ("sw-components", "sw-figures")


def pascal(s):
    return "".join(p.capitalize() for p in re.split(r"[-_]", s))


def add_place(core, root, st, item_id, where, why):
    from hs_catalog import catalog, selected
    _, items = catalog()
    it = items.get(item_id)
    if not it or it["group"] not in PLACEABLE:
        core.die("'%s' is not a Sitewright component or figure. Placeable: %s" % (item_id, ", ".join(PLACEABLE)))
    if item_id not in selected(st):
        core.die("'%s' is not among the user's picks." % item_id)
    where, why = clean(where, 200), clean(why, 300)
    if not where:
        core.die("give --where (page and section).")
    st.setdefault("placements", {})[item_id] = {"where": where, "why": why, "at": core.now()}
    core.activity.append(root, "note", "Placed %s: %s" % (it["name"], core.activity.redact(where, 120)))


SKIP_DIRS = {"node_modules", ".next", ".git", ".hyperskill", "dist", "build", ".claude"}


def find_usage(root, item):
    """A source file that really uses the piece: the component's name outside Sitewright's own library and gallery, or the figure's name."""
    key = item["id"].split("/", 1)[1]
    words = [pascal(key)] if item["group"] == "sw-components" else ['name="%s"' % key, "name='%s'" % key, '"%s"' % key]
    for dirpath, dirs, files in os.walk(root):
        dirs[:] = [d for d in dirs if d not in SKIP_DIRS]
        rel = os.path.relpath(dirpath, root).replace(os.sep, "/")
        if "components/fx" in rel or rel.endswith("app/effects") or "/app/effects/" in rel + "/":
            continue
        for fn in files:
            if not fn.endswith((".tsx", ".ts", ".jsx", ".js", ".json")):
                continue
            path = os.path.join(dirpath, fn)
            try:
                with open(path, encoding="utf-8") as f:
                    text = f.read()
            except (OSError, UnicodeDecodeError):
                continue
            if any(w in text for w in words) and not (fn.endswith(".json") and item["group"] == "sw-components"):
                return os.path.relpath(path, root)
    return None


def check(core, root, st, close=False):
    """For every picked component or figure: is it placed, and is it really used? Closes the matching checks when both are true."""
    from hs_catalog import catalog, selected, finish
    _, items = catalog()
    rows = []
    for i in selected(st):
        it = items.get(i)
        if not it or it["group"] not in PLACEABLE:
            continue
        place = st.get("placements", {}).get(i)
        used = find_usage(root, it)
        rows.append({"id": i, "name": it["name"], "placed": bool(place), "where": place["where"] if place else None, "used_in": used})
        e = st.get("extras", {}).get(i)
        if close and place and used and e and e["state"] == "open":
            finish(core, root, st, i, "done", "placed at %s and found in %s" % (place["where"], used))
    return rows
