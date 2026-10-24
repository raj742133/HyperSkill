"""Skill orchestration: which skill a phase should use, when, why, and pulling it only when it is wanted.

The data is skills/hyperskill/orchestration.json (per phase: slot, need, when, why). Each slot is resolved against the registry
(integrations.json) and what is installed, so every line of the plan says one of:
  ready     a provider is installed and allowed
  pull      allowed and bundled in packs/, not installed yet: `skills pull ID` installs it for this phase only
  ask       an opt-in provider: the user decides first (`skills pull ID --user-approved` once they said yes)
  install   allowed but not bundled: the user installs it outside HyperSkill
  fallback  nothing usable: the slot's built-in fallback applies
The conductor then records what it decided (`skills use SLOT --why ...` or `skills skip SLOT --why ...`). Pulled packs are released
when the phase ends unless the next phase wants them. `core` is passed in (the tracker module) so nothing here imports it.
Standard library only.
"""
import json
import os
import shutil

HERE = os.path.dirname(os.path.abspath(__file__))
ORCH_PATH = os.path.join(HERE, "..", "skills", "hyperskill", "orchestration.json")
NEED_ORDER = {"core": 0, "situational": 1, "optional": 2}


def load():
    with open(ORCH_PATH, encoding="utf-8") as f:
        return json.load(f)["phases"]


def decisions(st, phase):
    return st.setdefault("skillplan", {}).setdefault(phase, {})


def plan(core, root, st, phase_id, names=None):
    reg = core.load_integrations()
    names = names if names is not None else core.installed_skill_names(root)
    rows = []
    for ent in load().get(phase_id, []):
        res = core.resolve_slot(ent["slot"], st, names, reg)
        provs = res["providers"]
        ready = next((r for r in provs if r["installed"] and r["allowed"]), None)
        first = next((r for r in provs if r["allowed"]), None)
        ask = next((r for r in provs if r["why"].startswith("opt-in")), None)
        status, detail, note = "fallback", res["fallback"], ""
        if first and first["installed"]:
            status, detail = "ready", first["id"]
        elif first and reg["providers"][first["id"]].get("requires_binary") and not shutil.which(reg["providers"][first["id"]]["requires_binary"]):
            # its skills are only half of it: the command-line tool is missing, so settle for the next provider and say what the user could add
            note = "the `%s` command is not installed: %s" % (reg["providers"][first["id"]]["requires_binary"], reg["providers"][first["id"]]["install"][-1])
            if ready:
                status, detail = "ready", ready["id"]
            else:
                status, detail = "install", first["id"]
        elif first and core.pack_skills(first["id"]):  # the preferred provider is bundled: pulling it beats settling for a lower one
            status, detail = "pull", first["id"]
        elif ready:
            status, detail = "ready", ready["id"]
        elif first:
            status, detail = "install", first["id"]
        elif ask:  # opt-in: bundled ones wait for the user's yes, external ones can only be installed by the user
            status, detail = ("ask" if core.pack_skills(ask["id"]) else "install"), ask["id"]
        d = decisions(st, phase_id).get(ent["slot"])
        rows.append({"slot": ent["slot"], "need": ent["need"], "when": ent["when"], "why": ent["why"], "status": status,
                     "provider": detail if status != "fallback" else None, "detail": detail,
                     "options": [r["id"] for r in provs], "decision": d["decision"] if d else None,
                     "decision_why": d.get("why") if d else None, "decision_provider": d.get("provider") if d else None, "note": note})
    rows.sort(key=lambda r: NEED_ORDER.get(r["need"], 9))
    return rows


def render(phase_id, rows, short=False):
    out = ["Skills for phase %s. Decide each line: `hyperskill.py skills pull ID` (if needed), then `skills use SLOT --why ...` or `skills skip SLOT --why ...`." % phase_id
           if not short else "Skills for phase %s (hyperskill.py skills):" % phase_id]
    for r in rows:
        tag = {"ready": "ready", "pull": "PULL", "ask": "ASK USER", "install": "USER INSTALLS", "fallback": "fallback"}[r["status"]]
        who = r["provider"] or "built-in fallback"
        dec = ""
        if r["decision"]:
            dec = "  => %s%s: %s" % (r["decision"].upper(), " (" + r["decision_provider"] + ")" if r["decision_provider"] else "", r["decision_why"])
        out.append("- [%s] %s -> %s (%s)%s" % (r["need"], r["slot"], who, tag, dec))
        if r.get("note"):
            out.append("    note: " + r["note"])
        if not short:
            out.append("    when: %s. why: %s." % (r["when"], r["why"]))
    return "\n".join(out)


def undecided_core(core, root, st, phase_id):
    return [r["slot"] for r in plan(core, root, st, phase_id) if r["need"] == "core" and not r["decision"] and r["status"] != "fallback"]


def record(core, root, st, phase_id, slot, decision, provider, why):
    if slot not in {e["slot"] for e in load().get(phase_id, [])}:
        core.die("'%s' is not a slot of phase %s. Valid: %s" % (slot, phase_id, ", ".join(e["slot"] for e in load().get(phase_id, []))))
    if not why or not why.strip():
        core.die("give --why: a decision with no reason is not recorded.")
    decisions(st, phase_id)[slot] = {"decision": decision, "provider": provider, "why": why.strip(), "at": core.now()}
    core.activity.append(root, "skill", "%s %s%s: %s" % ("Using" if decision == "used" else "Skipping", slot, " with " + provider if provider else "", core.activity.redact(why, 160)),
                         action=decision, slot=slot, provider=provider, phase=phase_id)


def pull(core, root, st, pid, why, user_approved):
    reg = core.load_integrations()
    prov = reg["providers"].get(pid)
    if not prov:
        core.die("unknown provider '%s'." % pid)
    if not core.pack_skills(pid):
        core.die("%s is not bundled. Install it outside HyperSkill: %s" % (pid, "; ".join(prov.get("install", [])) or "see docs/integrations-review.md"))
    if prov.get("noncommercial") and st["commercial"]:
        core.die("%s: licence %s forbids commercial use and this project is commercial." % (pid, prov.get("license")))
    policy = prov.get("policy")
    if policy not in ("recommended", "opt-in"):
        core.die("%s is %s and is never pulled." % (pid, policy))
    already = pid in st["integrations"]["enabled"]
    if policy == "opt-in" and not already and not user_approved:
        core.die("%s is opt-in: ask the user, quoting its risks, and pull it with --user-approved only after they say yes.\nrisks: %s" % (
            pid, "; ".join(prov.get("risks", [])) or "(none listed)"))
    if not already:
        st["integrations"]["enabled"].append(pid)
    if pid in st["integrations"]["disabled"]:
        st["integrations"]["disabled"].remove(pid)
    copied, kept = core.install_pack(root, st, pid)
    phase = st["current"] or "none"
    if copied and not already:  # only what this pull added is taken back at the end of the phase
        st.setdefault("pulled", []).append({"id": pid, "phase": phase, "at": core.now()})
    core.activity.append(root, "skill", "Pulled %s for phase %s%s" % (pid, phase, ": " + core.activity.redact(why, 160) if why else ""),
                         action="pull", provider=pid, phase=phase)
    return copied, kept


def release(core, root, st, phase_id, keep=()):
    gone = []
    for rec in list(st.get("pulled", [])):
        if rec["phase"] == phase_id and rec["id"] not in keep:
            core.uninstall_pack(root, st, rec["id"])
            if rec["id"] in st["integrations"]["enabled"]:
                st["integrations"]["enabled"].remove(rec["id"])
            st["pulled"].remove(rec)
            gone.append(rec["id"])
            core.activity.append(root, "skill", "Released %s at the end of phase %s" % (rec["id"], phase_id), action="release", provider=rec["id"], phase=phase_id)
    return gone


def wanted_next(core, root, st, next_phase):
    """Provider ids that the next phase's plan would use, so a pull that is still needed is not released and re-pulled."""
    ids = set()
    for r in plan(core, root, st, next_phase):
        if r["provider"]:
            ids.add(r["provider"])
    return ids
