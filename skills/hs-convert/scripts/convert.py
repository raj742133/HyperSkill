#!/usr/bin/env python3
"""hs-convert: convert a file from one format to another with whatever is installed, and say plainly what is missing.

    convert.py formats                     what this machine can convert, by tool
    convert.py plan IN OUT_EXT             which tool would be used, and the exact command; nothing runs
    convert.py run IN OUT_EXT [--out-dir DIR] [--force] [--width PX] [--quality N] [--fps N]
    convert.py many OUT_EXT IN [IN ...]    the same, for several files

The tools are never invoked through a shell, never given a name that could be read as an option or a
coder prefix (inputs are made absolute), and never overwrite a file unless --force is given. Output goes
next to the input, or into --out-dir. A conversion that fails removes its partial output.
"""
import argparse
import json
import os
import shutil
import subprocess
import sys
import tempfile

TIMEOUT = 900
MAX_IN = 2 * 1024 ** 3

IMAGE = {"png", "jpg", "jpeg", "webp", "gif", "bmp", "tif", "tiff", "avif", "ico", "heic"}
AUDIO = {"mp3", "wav", "ogg", "m4a", "flac", "aac", "opus"}
VIDEO = {"mp4", "mov", "mkv", "webm", "avi", "m4v"}
OFFICE_IN = {"doc", "docx", "odt", "rtf", "ppt", "pptx", "odp", "xls", "xlsx", "ods", "csv", "txt", "html", "htm"}
OFFICE_OUT = {"pdf", "docx", "odt", "txt", "html", "xlsx", "ods", "csv", "pptx", "odp", "png"}
PANDOC_IN = {"md", "markdown", "html", "htm", "docx", "odt", "epub", "rst", "txt", "tex"}
PANDOC_OUT = {"md", "html", "docx", "odt", "epub", "rst", "txt", "pdf", "tex"}
PDF_IMG = {"png", "jpg", "jpeg"}

PANDOC_NAME = {"md": "gfm", "txt": "plain", "html": "html5"}


def ext(path_or_ext):
    e = os.path.splitext(path_or_ext)[1] if os.sep in path_or_ext or "." in path_or_ext else path_or_ext
    return e.lstrip(".").lower()


def have(*names):
    return next((n for n in names if shutil.which(n)), None)


def engines():
    return {
        "ffmpeg": have("ffmpeg"),
        "imagemagick": have("magick", "convert"),
        "libreoffice": have("soffice", "libreoffice"),
        "pandoc": have("pandoc"),
        "pdftoppm": have("pdftoppm"),
    }


def route(src, dst):
    """Ordered list of (engine, why) that could do src -> dst; availability is checked by the caller."""
    s, d = ext(src), ext(dst)
    out = []
    if s in IMAGE and d in IMAGE:
        out += [("imagemagick", "image to image"), ("ffmpeg", "image to image")]
    if s in VIDEO and d in VIDEO | AUDIO | {"gif", "webp", "png", "jpg"}:
        out.append(("ffmpeg", "video"))
    if s in AUDIO and d in AUDIO:
        out.append(("ffmpeg", "audio"))
    if s == "gif" and d in VIDEO | {"webp"}:
        out.append(("ffmpeg", "animation"))
    if s == "pdf" and d in PDF_IMG:
        out.append(("pdftoppm", "first page of a PDF as an image"))
    if s in OFFICE_IN and d in OFFICE_OUT and s != d:
        out.append(("libreoffice", "office document"))
    if s in PANDOC_IN and d in PANDOC_OUT and s != d:
        out.append(("pandoc", "text document"))
    return out


def build(engine, exe, src, dst, o):
    """The argv for one conversion. `src` and `dst` are absolute paths."""
    s, d = ext(src), ext(dst)
    if engine == "ffmpeg":
        c = [exe, "-hide_banner", "-nostdin", "-loglevel", "error", "-n", "-i", src]
        vf = []
        if o.get("width") and (d in IMAGE or d in VIDEO or d == "gif"):
            vf.append("scale=%d:-2" % o["width"])
        if d == "gif":
            vf = ["fps=%d" % (o.get("fps") or 12)] + vf + ["split[a][b];[a]palettegen[p];[b][p]paletteuse"]
        elif o.get("fps") and d in VIDEO:
            vf.append("fps=%d" % o["fps"])
        if vf:
            c += ["-vf", ",".join(vf)]
        if o.get("quality") and d in ("jpg", "jpeg"):
            c += ["-q:v", str(max(1, min(31, round((100 - o["quality"]) * 0.31))))]
        elif o.get("quality") and d == "webp":
            c += ["-quality", str(o["quality"])]
        if d == "webp" and s in VIDEO | {"gif"}:
            c += ["-loop", "0"]
        if d in ("png", "jpg", "jpeg", "webp") and s in VIDEO:
            c += ["-frames:v", "1"]
        return c + [dst]
    if engine == "imagemagick":
        c = [exe] if os.path.basename(exe) == "magick" else [exe]
        c += [src + ("[0]" if s in ("gif", "ico", "tif", "tiff", "webp") and d not in ("gif", "webp") else "")]
        if o.get("width"):
            c += ["-resize", "%dx" % o["width"]]
        if o.get("quality"):
            c += ["-quality", str(o["quality"])]
        return c + [dst]
    if engine == "pdftoppm":
        base = dst[: -len(os.path.splitext(dst)[1])]
        return [exe, "-singlefile", "-f", "1", "-l", "1", "-r", "150", "-" + ("png" if d == "png" else "jpeg"), src, base]
    if engine == "libreoffice":
        return [exe, "--headless", "--norestore", "-env:UserInstallation=file://%s" % o["profile"], "--convert-to", d,
                "--outdir", os.path.dirname(dst), src]
    if engine == "pandoc":
        c = [exe, "-f", PANDOC_NAME.get(s, s), "-t", PANDOC_NAME.get(d, d), "-o", dst]
        if d in ("html", "epub"):
            c.insert(1, "--standalone")
        return c + [src]
    raise ValueError(engine)


def choose(src, dst):
    eng = engines()
    options = route(src, dst)
    if not options:
        return None, "no route from .%s to .%s in this tool" % (ext(src), ext(dst)), []
    for name, why in options:
        if eng[name]:
            return (name, eng[name], why), None, options
    return None, "needs one of: %s (none is installed)" % ", ".join(sorted({n for n, _ in options})), options


def target(src, dst_ext, out_dir):
    stem = os.path.splitext(os.path.basename(src))[0]
    return os.path.join(os.path.abspath(out_dir) if out_dir else os.path.dirname(src), "%s.%s" % (stem, dst_ext.lstrip(".").lower()))


def check_input(path):
    p = os.path.abspath(path)
    if not os.path.isfile(p):
        raise SystemExit("convert: no such file: %s" % path)
    if os.path.getsize(p) > MAX_IN:
        raise SystemExit("convert: %s is larger than 2 GB; refusing" % path)
    return p


def convert(src, dst_ext, out_dir=None, force=False, **opts):
    src = check_input(src)
    pick, why_not, _ = choose(src, dst_ext)
    if not pick:
        return {"input": src, "ok": False, "error": why_not}
    engine, exe, why = pick
    dst = target(src, dst_ext, out_dir)
    if os.path.abspath(dst) == src:
        return {"input": src, "ok": False, "error": "input and output are the same file"}
    if os.path.exists(dst) and not force:
        return {"input": src, "ok": False, "error": "%s already exists (use --force to replace it)" % dst}
    os.makedirs(os.path.dirname(dst), exist_ok=True)
    with tempfile.TemporaryDirectory(prefix="hs-convert-") as tmp:
        work = dst
        if force and os.path.exists(dst):
            os.remove(dst)
        cmd = build(engine, exe, src, work, dict(opts, profile=tmp))
        try:
            r = subprocess.run(cmd, capture_output=True, text=True, timeout=TIMEOUT, cwd=tmp)
        except subprocess.TimeoutExpired:
            r = None
        ok = r is not None and r.returncode == 0 and os.path.isfile(dst) and os.path.getsize(dst) > 0
        if not ok:
            if os.path.isfile(dst):
                os.remove(dst)
            err = "timed out" if r is None else (r.stderr.strip().splitlines() or ["the tool failed without a message"])[-1][:240]
            return {"input": src, "ok": False, "engine": engine, "error": err}
    return {"input": src, "ok": True, "output": dst, "engine": engine, "bytes": os.path.getsize(dst), "why": why}


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = ap.add_subparsers(dest="cmd", required=True)
    sub.add_parser("formats")
    p = sub.add_parser("plan"); p.add_argument("input"); p.add_argument("to")
    for name in ("run", "many"):
        p = sub.add_parser(name)
        if name == "run":
            p.add_argument("input"); p.add_argument("to")
        else:
            p.add_argument("to"); p.add_argument("inputs", nargs="+")
        p.add_argument("--out-dir"); p.add_argument("--force", action="store_true")
        p.add_argument("--width", type=int); p.add_argument("--quality", type=int); p.add_argument("--fps", type=int)
    a = ap.parse_args(argv)
    if a.cmd == "formats":
        eng = engines()
        info = {"ffmpeg": sorted(IMAGE | AUDIO | VIDEO), "imagemagick": sorted(IMAGE), "libreoffice": "documents, sheets, slides to " + ", ".join(sorted(OFFICE_OUT)),
                "pandoc": "text to " + ", ".join(sorted(PANDOC_OUT)), "pdftoppm": "PDF first page to png or jpg"}
        for k, v in eng.items():
            detail = " ".join(info[k]) if isinstance(info[k], list) else info[k]
            print("%-12s %-8s %s" % (k, "ready" if v else "missing", detail if v else "(not installed)"))
        return
    if a.cmd == "plan":
        src = os.path.abspath(a.input)
        pick, why_not, options = choose(src, a.to)
        if not pick:
            print(json.dumps({"ok": False, "error": why_not}))
            sys.exit(1)
        engine, exe, why = pick
        print(json.dumps({"ok": True, "engine": engine, "why": why, "command": build(engine, exe, src, target(src, a.to, None), {"profile": "<temp>"})}, indent=1))
        return
    inputs = [a.input] if a.cmd == "run" else a.inputs
    opts = {k: getattr(a, k) for k in ("width", "quality", "fps") if getattr(a, k)}
    results = [convert(i, a.to, a.out_dir, a.force, **opts) for i in inputs]
    print(json.dumps(results if a.cmd == "many" else results[0], indent=1))
    sys.exit(0 if all(r["ok"] for r in results) else 1)


if __name__ == "__main__":
    main()
