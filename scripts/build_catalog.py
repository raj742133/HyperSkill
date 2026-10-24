#!/usr/bin/env python3
"""Build skills/hyperskill/catalog.json: everything a person can pick from, in one list the dashboard shows.

  build_catalog.py [--check]

Reads the bundled packs (Sitewright's own `--list` / `--list-effects`, UI UX Pro Max's data tables, every pack's skills, Impeccable's
commands, Hyperfigure's examples) and the hand-written lists in catalog_data.py. `--check` exits 1 when the committed file is out of
date. Needs node for the Sitewright listing. Standard library only.
"""
import csv
import glob
import json
import os
import re
import subprocess
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import catalog_data as data  # noqa: E402

ROOT = os.path.normpath(os.path.join(HERE, ".."))
OUT = os.path.join(ROOT, "skills", "hyperskill", "catalog.json")
SW = os.path.join(ROOT, "packs", "sitewright", "skills", "sitewright")
GALLERY = "https://sitewright-skill.vercel.app/#gallery"


def slug(s):
    return re.sub(r"[^a-z0-9]+", "-", s.lower()).strip("-")[:60]


def item(gid, name, desc, phase, mode, **kw):
    it = {"id": "%s/%s" % (gid, kw.pop("key", None) or slug(name)), "name": name, "desc": desc, "phase": phase, "mode": mode}
    it.update({k: v for k, v in kw.items() if v not in (None, "", [], False)})
    return it


def group(gid, title, source, blurb, mode, items, **kw):
    g = {"id": gid, "title": title, "source": source, "blurb": blurb, "mode": mode, "items": items}
    g.update(kw)
    return g


def node(*args):
    r = subprocess.run(["node", os.path.join(SW, "scripts", "scaffold.mjs"), *args], capture_output=True, text=True, timeout=60)
    if r.returncode != 0:
        sys.exit("sitewright %s failed: %s" % (" ".join(args), r.stderr.strip()[:300]))
    return r.stdout


# ---------------------------------------------------------------- Sitewright
def sitewright_groups():
    groups = []
    # modules: "id  Name\n            desc\n            requires: x"
    mods, cur = [], None
    for line in node("--list").splitlines():
        m = re.match(r"^(\w+)\s{2,}(.+)$", line)
        if m and not line.startswith(" "):
            cur = {"id": m.group(1), "name": m.group(2).strip()}
            mods.append(cur)
        elif cur is not None and line.strip().startswith("requires:"):
            cur["requires"] = line.split(":", 1)[1].strip()
        elif cur is not None and line.strip():
            cur["desc"] = line.strip()
    groups.append(group("sw-modules", "Sitewright: pages and features", "sitewright",
                        "Whole slices of the site, each with its own pages, API routes and tables. Required modules are added for you.", "build",
                        [item("sw-modules", m["name"], m.get("desc", ""), "product", "build", key=m["id"], cfg={"modules": m["id"]},
                              tags=["needs " + m["requires"]] if m.get("requires", "-") != "-" else [], rec=m["id"] in ("landing", "signin"))
                         for m in mods]))
    out = node("--list-effects").splitlines()
    sections, sec = {}, None
    for line in out:
        if re.match(r"^\S", line) and line.strip():
            sec = line.split("   --")[0].split(":")[0].strip()
            sections[sec] = []
        elif sec and line.strip():
            sections[sec].append(line)

    def rows(title):
        for key, lines in sections.items():
            if key.startswith(title):
                return lines
        return []

    def parse(lines, pat=r"^\s{2,}([\w-]+)\s+(.+)$"):
        res = []
        for ln in lines:
            m = re.match(pat, ln)
            if m:
                res.append((m.group(1), m.group(2).strip()))
        return res

    def effect_group(gid, title, src_title, cfg_key, exclusive, blurb, phase="product"):
        its = []
        for eid, desc in parse(rows(src_title)):
            its.append(item(gid, eid, desc, phase, "build", key=eid, cfg={cfg_key: eid}, exclusive=gid if exclusive else None,
                            link=GALLERY))
        return group(gid, title, "sitewright", blurb, "build", its, exclusive=exclusive)

    groups.append(effect_group("sw-hero", "Sitewright: hero backgrounds", "Hero backgrounds", "heroBackground", True,
                               "Pick one animated background for the landing hero. All are dependency-free code."))
    groups.append(effect_group("sw-login", "Sitewright: sign-in backgrounds", "Sign-in backgrounds", "loginBackground", True,
                               "Pick one background behind the sign-in card."))
    groups.append(effect_group("sw-headline", "Sitewright: headline animations", "Headline animations", "headline", True, "Pick one way the main headline appears."))
    groups.append(effect_group("sw-buttons", "Sitewright: button effects", "Buttons", "buttons", True, "Pick one micro-interaction for primary buttons."))
    groups.append(effect_group("sw-cards", "Sitewright: card effects", "Cards", "cards", True, "Pick one effect for every card."))
    groups.append(effect_group("sw-reveal", "Sitewright: scroll reveal", "Scroll reveal", "reveal", True, "Pick how landing sections come into view."))
    groups.append(effect_group("sw-extras", "Sitewright: page extras", "Extras", "extras", False, "Small page-wide touches; pick any number."))
    pres = []
    for ln in rows("Presets"):
        m = re.match(r"^\s{2,}([\w-]+)\s{2,}(.+)$", ln)
        if m:
            pres.append(item("sw-presets", m.group(1), m.group(2).strip().replace(" / ", " · "), "product", "build", key=m.group(1),
                             cfg={"preset": m.group(1)}, exclusive="sw-presets", link=GALLERY))
    groups.append(group("sw-presets", "Sitewright: ready-made looks", "sitewright",
                        "A bundle of the choices above; anything you pick separately overrides it.", "build", pres, exclusive=True))
    figs = []
    sub = rows("Figures")
    fig_lines = []
    for ln in sub:
        if ln.strip().startswith("Places"):
            break
        fig_lines.append(ln)
    for fid, desc in parse(fig_lines, r"^\s{4}([\w-]+)\s{2,}(.+)$"):
        figs.append(item("sw-figures", fid, desc, "product", "build", key=fid, cfg={"figure": fid}, link=GALLERY))
    groups.append(group("sw-figures", "Sitewright: interactive line figures", "sitewright",
                        "Small isometric drawings that answer the pointer (Hairline, MIT, plus three new). They are placed where they mean something: hero, sign-in, connect page, empty states, 404.",
                        "build", figs))
    comps, sub = [], None
    for ln in rows("Components"):
        m1 = re.match(r"^  (\w[\w-]*)\s*$", ln)
        m2 = re.match(r"^    ([\w-]+)\s{2,}(.+?)(?: Use: (.+))?$", ln)
        if m1:
            sub = m1.group(1)
        elif m2:
            comps.append(item("sw-components", m2.group(1), m2.group(2).strip(), "product", "build", key=m2.group(1), sub=(sub or "").title(),
                              cfg={"component": m2.group(1)}, tags=["use: " + m2.group(3).strip()] if m2.group(3) else [], link=GALLERY))
    groups.append(group("sw-components", "Sitewright: interactive components", "sitewright",
                        "Buttons, inputs, cards, loaders, text and 16 charts you import by name. Pick the ones this site should carry.", "build", comps))
    theme = [item("sw-theme", "studio", "Flat, warm neutrals and display headlines (the default).", "product", "build", key="studio", cfg={"theme": "studio"}, exclusive="sw-theme"),
             item("sw-theme", "classic", "The original pale surface with soft brand-tinted shadows.", "product", "build", key="classic", cfg={"theme": "classic"}, exclusive="sw-theme")]
    groups.append(group("sw-theme", "Sitewright: design theme", "sitewright", "The overall design language of the generated UI.", "build", theme, exclusive=True))
    return groups


# ---------------------------------------------------------------- UI UX Pro Max
def read_csv(name):
    path = os.path.join(ROOT, "packs", "ui-ux-pro-max", "skills", "ui-ux-pro-max", "data", name)
    with open(path, encoding="utf-8", newline="") as f:
        return list(csv.DictReader(f))


def uiux_groups():
    g = []
    styles = [item("uu-styles", r["Style Category"], "%s. Best for: %s" % (r["Keywords"][:150].strip(), r["Best For"][:110].strip()), "product", "build",
                   key=slug(r["Style Category"]), sub=r["Type"], tags=[t for t in (r.get("Era/Origin", "").strip(),) if t], exclusive="uu-styles")
              for r in read_csv("styles.csv")]
    g.append(group("uu-styles", "UI UX Pro Max: visual styles", "ui-ux-pro-max", "Pick one overall style; the skill then derives tokens, effects and do-and-don't rules from it.", "build", styles, exclusive=True))
    land = [item("uu-landing", r["Pattern Name"], "Sections: %s" % r["Section Order"][:170], "product", "build", key=slug(r["Pattern Name"]),
                 tags=["CTA: " + r["Primary CTA Placement"][:40]], exclusive="uu-landing") for r in read_csv("landing.csv")]
    g.append(group("uu-landing", "UI UX Pro Max: landing page patterns", "ui-ux-pro-max", "Pick the section order and call-to-action pattern for the landing page.", "build", land, exclusive=True))
    fonts = [item("uu-fonts", r["Font Pairing Name"], "%s + %s. %s" % (r["Heading Font"], r["Body Font"], r["Mood/Style Keywords"][:90]), "product", "build",
                  key=slug(r["Font Pairing Name"]), sub=r["Category"], exclusive="uu-fonts", fonts=[r["Heading Font"], r["Body Font"]]) for r in read_csv("typography.csv")]
    g.append(group("uu-fonts", "UI UX Pro Max: font pairings", "ui-ux-pro-max", "Pick one heading and body pairing. Check each font's licence (the skill ships them with their Google Fonts licences).", "build", fonts, exclusive=True))
    pal = []
    for r in read_csv("colors.csv"):
        pal.append(item("uu-palettes", r["Product Type"], r["Notes"][:140], "product", "build", key=slug(r["Product Type"]), exclusive="uu-palettes",
                        swatch=[r["Primary"], r["Secondary"], r["Accent"], r["Background"], r["Foreground"]]))
    g.append(group("uu-palettes", "UI UX Pro Max: colour palettes", "ui-ux-pro-max", "Pick one palette by product type; the swatches are primary, secondary, accent, background and text.", "build", pal, exclusive=True))
    return g


# ---------------------------------------------------------------- skills of every pack, Impeccable commands, Hyperfigure examples
def frontmatter(path):
    with open(path, encoding="utf-8") as f:
        text = f.read(4000)
    m = re.match(r"^---\n(.*?)\n---", text, re.S)
    out = {}
    if m:
        cur = None
        for line in m.group(1).splitlines():
            kv = re.match(r"^([\w-]+):\s*(.*)$", line)
            if kv:
                cur = kv.group(1)
                out[cur] = kv.group(2).strip().strip("'\"")
            elif cur and line.startswith(" "):
                out[cur] += " " + line.strip()
    return out


PACK_PHASES = {
    "impeccable": "product", "taste-skill": "product", "emil-skills": "product", "ui-ux-pro-max": "product", "better-icons": "product",
    "slopmonster": "launch", "hyperframes": "launch", "watch": "research", "cloudflare-security-audit": "harden",
    "superpowers": "foundation", "ponytail": "foundation", "karpathy-skills": "plan", "sitewright": "product",
}


def pack_skill_group():
    its = []
    for path in sorted(glob.glob(os.path.join(ROOT, "packs", "*", "skills", "*", "SKILL.md"))):
        parts = path.split(os.sep)
        pack, name = parts[-4], parts[-2]
        fm = frontmatter(path)
        desc = (fm.get("description") or "").strip()
        its.append(item("skills", "%s: %s" % (pack, fm.get("name") or name), desc[:260], PACK_PHASES.get(pack, "product"), "build", key="%s-%s" % (pack, name),
                        sub=pack, pack=pack, skill=name))
    return group("skills", "Skills inside the bundled packs", "hyperskill",
                 "Every skill that ships in packs/. Mark the ones you want Claude to use (the pack is pulled when its phase starts).", "build", its)


def impeccable_group():
    path = os.path.join(ROOT, "packs", "impeccable", "skills", "impeccable", "SKILL.md")
    its = []
    with open(path, encoding="utf-8") as f:
        for ln in f:
            m = re.match(r"^\| `([\w-]+)(?: \[[^`]*\])?[^`]*` \| (\w+) \| ([^|]+) \|", ln)
            if m and m.group(1) not in ("craft",):
                its.append(item("impeccable", m.group(1), m.group(3).strip(), "product", "build", key=m.group(1), sub=m.group(2), cmd="/impeccable " + m.group(1)))
    return group("impeccable", "Impeccable: design commands", "impeccable", "Commands you can have Claude run on the interface: critique, audit, polish, animate, harden and more.", "build", its)


def hyperfigure_group():
    its = []
    for d in sorted(glob.glob(os.path.join(ROOT, "skills", "hyperfigure", "examples", "*"))):
        if os.path.isdir(d):
            name = os.path.basename(d)
            its.append(item("figures", name.replace("-", " ").title(), "Worked example of an interactive isometric figure (skills/hyperfigure/examples/%s)." % name, "plan", "build", key=name))
    return group("figures", "Hyperfigure: worked figure examples", "hyperfigure",
                 "Figures Claude can build for explaining an idea; pick the ones that match what the product needs explained.", "build", its)


# ---------------------------------------------------------------- hand-written lists
def curated_groups():
    g = []
    g.append(group("tells", "Vibe-coded design tells to avoid", "hyperskill",
                   "Each one you select becomes a check in its phase: fix it or waive it with a reason before the phase can end.", "track",
                   [item("tells", n, "Instead: " + fix, ph, "track", key=slug(n), text="No \"%s\" in the design or copy. %s" % (n, fix), rec=True) for n, ph, fix in data.TELLS]))
    g.append(group("concepts", "Production concepts people forget", "hyperskill",
                   "Backend and infrastructure topics, with the phase each belongs in. Select what applies: each becomes a check to build it, or to write down why it is not needed yet. Core = nearly every app.", "track",
                   [item("concepts", n, d, ph, "track", key=slug(n), tier=t, sub={"core": "Core: nearly every app", "growth": "Growth: once real users arrive", "scale": "Scale: only at real scale"}[t],
                         text="%s: %s Build it, or record in docs/decisions why it is not needed yet." % (n, d), rec=t == "core") for n, ph, t, d in data.CONCEPTS]))
    g.append(group("fixes", "Site fixes", "hyperskill", "Tidy-ups that make a site feel finished. Each one you select becomes a check.", "track",
                   [item("fixes", n, d, ph, "track", key=slug(n), text="%s: %s" % (n, d), rec=True) for n, ph, d in data.FIXES]))
    g.append(group("addons", "Features to add to the site", "hyperskill", "Things Claude can add while keeping your design. Each one you select becomes a check.", "track",
                   [item("addons", n, d, ph, "track", key=slug(n), text="%s: %s" % (n, d), tags=[h] if h else [], rec=False) for n, ph, d, h in data.ADDONS]))
    g.append(group("styles-popular", "Popular visual styles (with build rules)", "hyperskill",
                   "The ten styles people ask for by name. Claude follows the rules in skills/hs-product/references/style-recipes.md for the one you pick: the recipe, the traps and the checks. One style per product: a pick here replaces a pick in the big UI UX Pro Max list.", "build",
                   [item("styles-popular", n, d, "product", "build", key=slug(n), exclusive="uu-styles", media={"kind": "svg", "src": "uu-styles/%s.svg" % uu}) for n, uu, d in data.POPULAR_STYLES],
                   exclusive="uu-styles"))  # shares one exclusive set with the big style list: one style per product
    g.append(group("selfhost", "Self-hosted building blocks", "hyperskill",
                   "Open-source services you can run yourself. Each one you select becomes a check with a clear 'done' and its licence caveat, so you choose with the facts in front of you. None is installed for you.", "track",
                   [item("selfhost", n, d, ph, "track", key=slug(n), sub=lab, text=t) for n, ph, lab, d, t in data.SELFHOST]))
    return g


PREVIEWS = os.path.join(ROOT, "site", "live", "previews")
# groups whose pictures are the same as another group's (a hero background is also a sign-in background)
SHARED = {"sw-login": "sw-hero"}


def attach_media(groups):
    """Point each item at its picture or clip under site/live/previews, when one exists."""
    for g in groups:
        folder = SHARED.get(g["id"], g["id"])
        for it in g["items"]:
            key = it["id"].split("/", 1)[1]
            base = os.path.join(PREVIEWS, folder, key)
            rel = "%s/%s" % (folder, key)
            if os.path.exists(base + ".mp4"):
                it["media"] = {"kind": "video", "src": rel + ".mp4", "poster": rel + ".webp"}
            elif os.path.exists(base + ".svg"):
                it["media"] = {"kind": "svg", "src": rel + ".svg"}
            elif os.path.exists(base + ".webp"):
                it["media"] = {"kind": "image", "src": rel + ".webp"}


def build():
    groups = sitewright_groups() + uiux_groups() + [impeccable_group(), pack_skill_group(), hyperfigure_group()] + curated_groups()
    seen = set()
    for g in groups:
        for it in g["items"]:
            assert it["id"] not in seen, "duplicate id " + it["id"]
            seen.add(it["id"])
    attach_media(groups)
    order = ["tells", "concepts", "fixes", "addons"]
    groups.sort(key=lambda g: (0 if g["id"] in order else 1, order.index(g["id"]) if g["id"] in order else 0))
    return {"_about": "Generated by scripts/build_catalog.py. Do not edit by hand.", "groups": groups}


def main():
    text = json.dumps(build(), indent=1, ensure_ascii=False) + "\n"
    if "--check" in sys.argv:
        try:
            with open(OUT, encoding="utf-8") as f:
                same = f.read() == text
        except OSError:
            same = False
        if not same:
            print("skills/hyperskill/catalog.json is out of date: run python3 scripts/build_catalog.py", file=sys.stderr)
            sys.exit(1)
        return
    with open(OUT, "w", encoding="utf-8") as f:
        f.write(text)
    cat = json.loads(text)
    print("wrote catalog.json: %d groups, %d items" % (len(cat["groups"]), sum(len(g["items"]) for g in cat["groups"])))
    for g in cat["groups"]:
        print("  %-14s %4d  %s" % (g["id"], len(g["items"]), g["title"]))


if __name__ == "__main__":
    main()
