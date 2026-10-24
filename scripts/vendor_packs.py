#!/usr/bin/env python3
"""Rebuild packs/ from the upstream repositories listed in packs/manifest.json.

  vendor_packs.py --clones DIR [--only ID[,ID]]

DIR holds one checkout per pack, named after the repository (DIR/security-audit-skill, DIR/impeccable, ...). Files are copied
unmodified, together with the upstream LICENSE; a NOTICE.md records the repository, the commit and what was copied.
It never fetches anything itself and never edits upstream files. Standard library only.
"""
import argparse
import datetime
import glob
import json
import os
import shutil
import subprocess
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
PACKS = os.path.normpath(os.path.join(HERE, "..", "packs"))
SKIP = (".git", "node_modules", "__pycache__", ".DS_Store")


def commit_of(path):
    return subprocess.run(["git", "-C", path, "rev-parse", "HEAD"], capture_output=True, text=True, check=True).stdout.strip()


def copy_tree(src, dst):
    if os.path.islink(src):
        return 0
    if os.path.isfile(src):
        os.makedirs(os.path.dirname(dst), exist_ok=True)
        shutil.copy2(src, dst)
        return 1
    n = 0
    for name in sorted(os.listdir(src)):
        if name in SKIP:
            continue
        n += copy_tree(os.path.join(src, name), os.path.join(dst, name))
    return n


def build(pid, spec, clones):
    repo_dir = os.path.join(clones, spec["repo"].split("/")[1])
    if not os.path.isdir(repo_dir):
        sys.exit("missing checkout %s" % repo_dir)
    out = os.path.join(PACKS, pid)
    shutil.rmtree(out, ignore_errors=True)
    files = 0
    for src_pat, dst in spec["copy"]:
        matches = sorted(glob.glob(os.path.join(repo_dir, src_pat)))
        if not matches:
            sys.exit("%s: nothing matches %s" % (pid, src_pat))
        for m in matches:
            target = os.path.join(out, dst, os.path.basename(m)) if dst.endswith("/") else os.path.join(out, dst)
            files += copy_tree(m, target)
    lic = os.path.join(repo_dir, "LICENSE")
    if os.path.exists(lic):
        shutil.copy2(lic, os.path.join(out, "LICENSE"))
    with open(os.path.join(out, "NOTICE.md"), "w", encoding="utf-8") as f:
        f.write("# %s\n\nBundled unmodified from https://github.com/%s at commit `%s` (%s).\n\n"
                % (pid, spec["repo"], commit_of(repo_dir), datetime.date.today().isoformat()))
        f.write("Licence: %s. The upstream licence text is in `LICENSE` here%s.\n\n"
                % (spec["license"], "" if os.path.exists(lic) else " (the upstream repository ships none; see the note above)"))
        f.write("Copied paths: %s.\n\nThe files are the original authors' work and are not edited. "
                "Nothing in this folder loads until a project runs `hyperskill.py integrations enable %s`.\n"
                % (", ".join("`%s`" % s for s, _ in spec["copy"]), pid))
    return files


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--clones", required=True)
    ap.add_argument("--only")
    a = ap.parse_args()
    with open(os.path.join(PACKS, "manifest.json"), encoding="utf-8") as f:
        packs = json.load(f)["packs"]
    for pid, spec in packs.items():
        if a.only and pid not in a.only.split(","):
            continue
        print("%-26s %5d files" % (pid, build(pid, spec, a.clones)))


if __name__ == "__main__":
    main()
