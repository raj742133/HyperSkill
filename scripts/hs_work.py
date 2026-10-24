"""Work breakdown for several helper agents: who does which task, at what model and effort, and what can run at the same time.

The conductor splits a phase's work into tasks. Each task gets a *kind* (what sort of work), a *risk* and a size, and a fixed rule turns
that into a tier from `models.json`: scout (haiku, low, read-only), fixer (haiku, low), builder (sonnet, medium), deep builder
(sonnet, high), architect (opus, high), reviewer (opus, high, read-only). The rule is plain arithmetic so the same task always lands on
the same tier and the reason can be shown. Claude may override a tier, but must say why. Tasks that edit the same files never run in
the same wave; a task that fails moves up one tier, and a failure at the top is handed to the person. Standard library only.
"""
import json
import os
import re

_HERE = os.path.dirname(os.path.abspath(__file__))
KINDS = ("lookup", "docs", "edit", "build", "refactor", "debug", "design", "review")
RISKS = ("none", "data", "security", "money")
BIAS = ("economy", "balanced", "quality")
STATUS = ("todo", "running", "done", "failed", "blocked", "dropped")
OPEN = ("todo", "running", "failed", "blocked")
MAX_TASKS = 60
DEFAULT_POLICY = {"helpers": True, "parallel": 3, "bias": "balanced"}
ID = re.compile(r"^T[0-9]{1,3}$")


class WorkError(Exception):
    pass


def models():
    with open(os.path.join(_HERE, "..", "skills", "hyperskill", "models.json"), encoding="utf-8") as f:
        return json.load(f)


def tiers():
    return {t["id"]: t for t in models()["tiers"]}


def work(st):
    w = st.setdefault("work", {"seq": 0, "tasks": [], "policy": dict(DEFAULT_POLICY)})
    w.setdefault("policy", dict(DEFAULT_POLICY))
    return w


def policy(st):
    return dict(DEFAULT_POLICY, **work(st)["policy"])


def rules(st=None):
    """The scoring table: the shipped defaults with this project's own tuning laid over them."""
    r = json.loads(json.dumps(models()["rules"]))
    tuned = (work(st).get("rules") if st is not None else None) or {}
    r["kinds"].update(tuned.get("kinds", {}))
    r["plus"].update(tuned.get("plus", {}))
    return r


def classify(kind, files=1, risk="none", unknown=False, bias="balanced", table=None):
    """(tier id, score, reasons). Pure function: the same input always gives the same answer."""
    m = models()
    table = table or m["rules"]
    if kind not in table["kinds"]:
        raise WorkError("kind must be one of: " + ", ".join(KINDS))
    if risk not in RISKS:
        raise WorkError("risk must be one of: " + ", ".join(RISKS))
    if kind == "review":
        return "reviewer", table["kinds"][kind], ["a review always goes to a fresh, read-only reviewer"]
    if kind == "lookup":
        return "scout", 0, ["reading and summarising only, so a read-only scout is enough"]
    score = table["kinds"][kind]
    why = ["%s work starts at %d" % (kind, score)]
    plus = table["plus"]
    if files >= 4:
        score += plus["files_4_or_more"]
        why.append("touches %d files" % files)
    if risk != "none":
        score += plus["risk"]
        why.append("%s risk" % risk)
    if unknown:
        score += plus["unknown"]
        why.append("the cause or the requirement is not yet clear")
    if risk in ("security", "money") and kind in ("build", "refactor", "edit"):
        score = max(score, 3)
    ladder = m["ladder"]
    idx = {0: 0, 1: 0, 2: 1, 3: 2}.get(score, 3)
    if risk in ("security", "money") and score >= 4:
        idx = 3
    if bias == "economy" and risk == "none":
        idx, why = max(0, idx - 1), why + ["economy: one tier cheaper because nothing risky is involved"]
    elif bias == "quality":
        idx, why = min(len(ladder) - 1, idx + 1), why + ["quality: one tier stronger"]
    return ladder[idx], score, why


def _paths(value):
    out = []
    for p in (value or "").split(","):
        p = p.strip().replace("\\", "/")
        if not p:
            continue
        absolute = p.startswith("/") or re.match(r"^[A-Za-z]:", p)
        p = p.strip("/")
        if absolute or p.startswith(".") or ".." in p.split("/") or len(p) > 200:
            raise WorkError("a task may only own project-relative paths (no dot-folders, no ..): %s" % p)
        out.append(p)
    return out[:20]


def find(st, tid):
    for t in work(st)["tasks"]:
        if t["id"] == tid:
            return t
    raise WorkError("no task %s: see `work list`" % tid)


def add(st, phase, title, kind, paths="", risk="none", unknown=False, depends="", tier=None, why=""):
    w = work(st)
    title = re.sub(r"\s+", " ", str(title or "").strip())[:140]
    if not title:
        raise WorkError("give the task a title")
    if len(w["tasks"]) >= MAX_TASKS:
        raise WorkError("too many tasks; finish or drop some first")
    pl = _paths(paths)
    deps = [d.strip() for d in (depends or "").split(",") if d.strip()]
    for d in deps:
        if not ID.match(d):
            raise WorkError("depends must be task ids such as T1,T2")
        find(st, d)
    auto, score, reasons = classify(kind, max(1, len(pl)), risk, unknown, policy(st)["bias"], rules(st))
    chosen = auto
    if tier:
        if tier not in tiers():
            raise WorkError("tier must be one of: " + ", ".join(tiers()))
        if tier != auto:
            if not why.strip():
                raise WorkError("overriding the suggested tier (%s) needs --why" % auto)
            if tiers()[tier]["writes"] is False and kind not in ("lookup", "review"):
                raise WorkError("a read-only tier cannot do %s work" % kind)
            chosen, reasons = tier, reasons + ["overridden: " + why.strip()[:200]]
    if not tiers()[chosen]["writes"] and kind not in ("lookup", "review"):
        raise WorkError("a read-only tier cannot do %s work" % kind)
    w["seq"] += 1
    t = {"id": "T%d" % w["seq"], "phase": phase, "title": title, "kind": kind, "paths": pl, "risk": risk, "unknown": bool(unknown), "depends": deps,
         "tier": chosen, "suggested": auto, "score": score, "reasons": reasons, "status": "todo", "attempts": 0, "result": ""}
    w["tasks"].append(t)
    return t


def _overlap(a, b):
    if "*" in a or "*" in b:
        return True
    for x in a:
        for y in b:
            if x == y or x.startswith(y + "/") or y.startswith(x + "/"):
                return True
    return False


def plan(st, phase=None):
    """Waves of tasks that may run together: dependencies met, no two writers on the same paths, at most `parallel` at once."""
    w, pol, tr = work(st), policy(st), tiers()
    tasks = [t for t in w["tasks"] if t["status"] in ("todo", "failed") and (phase is None or t["phase"] == phase)]
    done = {t["id"] for t in w["tasks"] if t["status"] in ("done", "dropped")}
    limit = pol["parallel"] if pol["helpers"] else 1
    waves, left = [], list(tasks)
    placed = set(done)
    guard = 0
    while left and guard < MAX_TASKS + 2:
        guard += 1
        wave, owned = [], []
        for t in list(left):
            if any(d not in placed for d in t["depends"]) or len(wave) >= limit:
                continue
            writes = tr[t["tier"]]["writes"]
            mine = t["paths"] or ["*"]  # a writer that names no paths is assumed to touch everything
            if writes and any(_overlap(mine, o) for o in owned):
                continue
            wave.append(t)
            if writes:
                owned.append(mine)
        if not wave:
            break
        for t in wave:
            left.remove(t)
            placed.add(t["id"])
        waves.append(wave)
    return waves, left


def start(st, tid):
    t = find(st, tid)
    if t["status"] not in ("todo", "failed"):
        raise WorkError("%s is %s" % (tid, t["status"]))
    unmet = [d for d in t["depends"] if find(st, d)["status"] not in ("done", "dropped")]
    if unmet:
        raise WorkError("%s waits for %s" % (tid, ", ".join(unmet)))
    t["status"] = "running"
    t["attempts"] += 1
    return t


def finish(st, tid, result):
    t = find(st, tid)
    if t["status"] != "running":
        raise WorkError("%s is %s, not running" % (tid, t["status"]))
    result = re.sub(r"\s+", " ", str(result or "").strip())
    if not result:
        raise WorkError("say what was verified: --result 'tests pass: ...' (the conductor checks helper claims, it does not trust them)")
    t["status"], t["result"] = "done", result[:400]
    return t


def fail(st, tid, why):
    """Mark a failed attempt and move the task up one tier; at the top of the ladder it needs a person."""
    t = find(st, tid)
    if t["status"] != "running":
        raise WorkError("%s is %s, not running" % (tid, t["status"]))
    why = re.sub(r"\s+", " ", str(why or "").strip())
    if not why:
        raise WorkError("say why it failed: --why ...")
    t["result"] = why[:400]
    ladder = models()["ladder"]
    if t["tier"] in ladder and ladder.index(t["tier"]) < len(ladder) - 1:
        old = t["tier"]
        t["tier"], t["status"] = ladder[ladder.index(old) + 1], "todo"
        t["reasons"].append("failed on %s (%s): moved up to %s" % (old, why[:80], t["tier"]))
    else:
        t["status"] = "blocked"
        t["reasons"].append("failed at the top tier (%s): needs a person" % t["tier"])
    return t


def drop(st, tid, why):
    t = find(st, tid)
    if not str(why or "").strip():
        raise WorkError("say why it was dropped: --why ...")
    t["status"], t["result"] = "dropped", str(why).strip()[:400]
    return t


def open_tasks(st, phase):
    return [t["id"] for t in work(st)["tasks"] if t["phase"] == phase and t["status"] in OPEN]


def set_policy(st, helpers=None, parallel=None, bias=None):
    p = work(st)["policy"]
    if helpers is not None:
        p["helpers"] = helpers
    if parallel is not None:
        if not 1 <= parallel <= 8:
            raise WorkError("parallel must be between 1 and 8")
        p["parallel"] = parallel
    if bias is not None:
        if bias not in BIAS:
            raise WorkError("bias must be one of: " + ", ".join(BIAS))
        p["bias"] = bias
    return policy(st)


def tune(st, kind=None, score=None, plus=None, value=None, reset=False):
    """Change this project's scoring: a kind's starting score (0 to 6) or one of the add-ons (0 to 3). Defaults stay in models.json."""
    w = work(st)
    if reset:
        w.pop("rules", None)
        return rules(st)
    t = w.setdefault("rules", {"kinds": {}, "plus": {}})
    if kind is not None:
        if kind not in KINDS or kind in ("lookup", "review"):
            raise WorkError("tune one of: " + ", ".join(k for k in KINDS if k not in ("lookup", "review")))
        if score is None or not 0 <= score <= 6:
            raise WorkError("--score must be 0 to 6")
        t["kinds"][kind] = score
    if plus is not None:
        if plus not in models()["rules"]["plus"] or value is None or not 0 <= value <= 3:
            raise WorkError("--plus must be one of %s with --value 0 to 3" % ", ".join(models()["rules"]["plus"]))
        t["plus"][plus] = value
    return rules(st)


def stats(st):
    """What actually happened, per tier: tasks finished, how many were right on the first try, how many were pushed up from a cheaper tier."""
    tr, rows = tiers(), {}
    for tid in tr:
        rows[tid] = {"tier": tid, "label": tr[tid]["label"], "done": 0, "first_try": 0, "failed": 0}
    for t in work(st)["tasks"]:
        if t["status"] == "done":
            rows[t["tier"]]["done"] += 1
            rows[t["tier"]]["first_try"] += 1 if t["attempts"] == 1 else 0
        for r in t["reasons"]:
            m = re.match(r"failed on (\S+) ", r)
            if m and m.group(1) in rows:
                rows[m.group(1)]["failed"] += 1
    advice = []
    for r in rows.values():
        n = r["done"] + r["failed"]
        r["rate"] = round(100 * r["first_try"] / n) if n else None
        if n >= 4 and r["rate"] < 60 and r["tier"] in ("fixer", "builder", "builder-deep"):
            advice.append("%s got only %d%% of its tasks right first time over %d: raise the starting score of the work it keeps getting (`work tune --kind build --score 3`)" % (r["label"], r["rate"], n))
        if n >= 6 and r["rate"] >= 95 and r["tier"] in ("builder-deep", "architect"):
            advice.append("%s was right first time %d%% of %d tasks: some of its work may be fine one tier cheaper (`work tune`)" % (r["label"], r["rate"], n))
    return list(rows.values()), advice


def label(t):
    tr = tiers()[t["tier"]]
    return "%s (%s, %s)" % (tr["label"], tr["model"], tr["effort"])


def render_plan(st, phase=None):
    waves, left = plan(st, phase)
    tr, lines = tiers(), []
    for i, wave in enumerate(waves, 1):
        lines.append("wave %d%s" % (i, "  (run these together, in one message)" if len(wave) > 1 else ""))
        for t in wave:
            lines.append("  %-4s %-14s %-30s %s%s" % (t["id"], tr[t["tier"]]["agent"], label(t)[:30], t["title"], "  [%s]" % ",".join(t["paths"]) if t["paths"] else ""))
    for t in left:
        lines.append("  %-4s waiting on %s or a stuck dependency: %s" % (t["id"], ",".join(t["depends"]) or "?", t["title"]))
    if not lines:
        lines.append("(no open tasks)")
    return "\n".join(lines)
