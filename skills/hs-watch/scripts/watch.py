#!/usr/bin/env python3
"""hs-watch: turn a video into things Claude can read: frames at each cut, a closer look at the opening,
a contact sheet, a timestamped transcript from captions, and a report skeleton.

Standard library only; needs ffmpeg and ffprobe. `fetch` also needs yt-dlp. Nothing is sent anywhere:
frames and captions stay in the work folder.

    watch.py run VIDEO_OR_URL [--out DIR] [--start T] [--end T] [--captions FILE] [--max-frames N]
    watch.py probe VIDEO
    watch.py frames VIDEO --out DIR [--start T] [--end T] [--max-frames N] [--every S]
    watch.py hook VIDEO --out DIR            the first ten seconds, twice a second
    watch.py sheet DIR --out FILE            one contact sheet from the frames in DIR
    watch.py fetch URL --out DIR             yt-dlp, no cookies, one video, size capped
    watch.py captions FILE                   print a .vtt or .srt as [mm:ss] lines
"""
import argparse
import glob
import ipaddress
import json
import os
import re
import shutil
import socket
import subprocess
import sys
import urllib.parse

SCENE = 0.30          # ffmpeg scene score that counts as a cut
WIDTH = 512           # frame width; the height follows
HOOK_SECONDS = 10
HOOK_FPS = 2
MAX_BYTES = 500 * 1024 * 1024
VIDEO_EXT = (".mp4", ".mov", ".mkv", ".webm", ".m4v", ".avi")


def die(msg):
    print("watch: " + msg, file=sys.stderr)
    sys.exit(2)


def need(tool):
    if not shutil.which(tool):
        die("%s is not installed (it is part of ffmpeg)" % tool if tool.startswith("ff") else "%s is not installed" % tool)


def clock(sec):
    sec = int(round(sec))
    h, rem = divmod(sec, 3600)
    m, s = divmod(rem, 60)
    return "%d:%02d:%02d" % (h, m, s) if h else "%02d:%02d" % (m, s)


def parse_time(v):
    if v in (None, ""):
        return None
    try:
        parts = [float(x) for x in str(v).split(":")]
    except ValueError:
        die("cannot read time %r (use SS, MM:SS or HH:MM:SS)" % v)
    t = 0.0
    for p in parts:
        t = t * 60 + p
    return t


def run(cmd, timeout=600):
    return subprocess.run(cmd, capture_output=True, text=True, timeout=timeout)


def probe(path):
    need("ffprobe")
    r = run(["ffprobe", "-v", "quiet", "-print_format", "json", "-show_format", "-show_streams", path], 60)
    if r.returncode:
        die("ffprobe could not read %s: %s" % (path, r.stderr.strip()[:200]))
    d = json.loads(r.stdout or "{}")
    v = next((s for s in d.get("streams", []) if s.get("codec_type") == "video"), None)
    if not v:
        die("%s has no video stream" % path)
    fmt = d.get("format", {})
    dur = float(fmt.get("duration") or v.get("duration") or 0)
    num, _, den = (v.get("avg_frame_rate") or "0/1").partition("/")
    fps = float(num) / float(den or 1) if float(den or 1) else 0.0
    return {"path": path, "seconds": round(dur, 2), "width": v.get("width"), "height": v.get("height"),
            "fps": round(fps, 2), "codec": v.get("codec_name"), "bytes": int(fmt.get("size") or 0),
            "audio": any(s.get("codec_type") == "audio" for s in d.get("streams", []))}


def budget(seconds):
    """How many frames a full scan may use: dense when short, capped when long, so the cost stays bounded."""
    for limit, n in ((30, 24), (60, 36), (180, 54), (600, 72)):
        if seconds <= limit:
            return n
    return 90


def extract_scenes(path, out, start, end, cap):
    """One frame per detected cut. Returns [(seconds, file)]."""
    os.makedirs(out, exist_ok=True)
    cmd = ["ffmpeg", "-hide_banner", "-nostats", "-y"]
    if start:
        cmd += ["-ss", str(start)]
    if end:
        cmd += ["-to", str(end)]
    cmd += ["-i", path, "-vf", "select='gt(scene,%s)+eq(n,0)',showinfo,scale=%d:-2" % (SCENE, WIDTH),
            "-vsync", "vfr", "-q:v", "4", os.path.join(out, "_s%05d.jpg")]
    r = run(cmd)
    times = [float(t) for t in re.findall(r"pts_time:([0-9.]+)", r.stderr)]
    files = sorted(glob.glob(os.path.join(out, "_s*.jpg")))
    return finish(out, list(zip([t + (start or 0) for t in times], files)), cap)


def extract_even(path, out, start, end, cap, every=None):
    os.makedirs(out, exist_ok=True)
    total = (end or probe(path)["seconds"]) - (start or 0)
    step = every or max(total / max(cap, 1), 0.25)
    cmd = ["ffmpeg", "-hide_banner", "-nostats", "-y"]
    if start:
        cmd += ["-ss", str(start)]
    if end:
        cmd += ["-to", str(end)]
    cmd += ["-i", path, "-vf", "fps=1/%s,scale=%d:-2" % (step, WIDTH), "-q:v", "4", os.path.join(out, "_s%05d.jpg")]
    run(cmd)
    files = sorted(glob.glob(os.path.join(out, "_s*.jpg")))
    return finish(out, [((start or 0) + i * step, f) for i, f in enumerate(files)], cap)


def finish(out, pairs, cap):
    """Thin to the cap (keeping the first and last), then rename each file by its time."""
    if len(pairs) > cap:
        idx = sorted({round(i * (len(pairs) - 1) / (cap - 1)) for i in range(cap)}) if cap > 1 else [0]
        keep = {pairs[i][1] for i in idx}
        for t, f in pairs:
            if f not in keep:
                os.remove(f)
        pairs = [p for p in pairs if p[1] in keep]
    named = []
    for t, f in pairs:
        dest = os.path.join(out, "t%07.2f.jpg" % t)
        os.replace(f, dest)
        named.append((t, dest))
    return named


def frames(path, out, start=None, end=None, cap=None, every=None):
    need("ffmpeg")
    info = probe(path)
    span = (end or info["seconds"]) - (start or 0)
    cap = cap or budget(span)
    if every:
        return extract_even(path, out, start, end, cap, every)
    got = extract_scenes(path, out, start, end, cap)
    if len(got) < min(6, cap):                       # a screen recording or a slow shot: cuts are rare, so sample evenly instead
        for t, f in got:
            os.remove(f)
        got = extract_even(path, out, start, end, cap)
    return got


def hook(path, out):
    need("ffmpeg")
    os.makedirs(out, exist_ok=True)
    cmd = ["ffmpeg", "-hide_banner", "-nostats", "-y", "-t", str(HOOK_SECONDS), "-i", path,
           "-vf", "fps=%d,scale=%d:-2" % (HOOK_FPS, WIDTH), "-q:v", "4", os.path.join(out, "_h%04d.jpg")]
    run(cmd)
    pairs = []
    for i, f in enumerate(sorted(glob.glob(os.path.join(out, "_h*.jpg")))):
        dest = os.path.join(out, "h%05.1f.jpg" % (i / HOOK_FPS))
        os.replace(f, dest)
        pairs.append((i / HOOK_FPS, dest))
    return pairs


def sheet(folder, out_file, cols=4):
    need("ffmpeg")
    files = sorted(glob.glob(os.path.join(folder, "t*.jpg")) or glob.glob(os.path.join(folder, "*.jpg")))
    if not files:
        die("no frames in %s" % folder)
    rows = (len(files) + cols - 1) // cols
    lst = os.path.join(os.path.dirname(os.path.abspath(out_file)), ".sheet-list.txt")
    with open(lst, "w") as f:
        for p in files:
            f.write("file '%s'\nduration 1\n" % os.path.abspath(p).replace("'", "'\\''"))
    r = run(["ffmpeg", "-hide_banner", "-nostats", "-y", "-f", "concat", "-safe", "0", "-i", lst,
             "-vf", "scale=320:-2,tile=%dx%d:padding=4:color=white" % (cols, rows), "-frames:v", "1", out_file])
    os.remove(lst)
    if r.returncode:
        die("could not build the sheet: " + r.stderr.strip()[-200:])
    return out_file


def check_url(url):
    u = urllib.parse.urlparse(url)
    if u.scheme not in ("http", "https") or not u.hostname:
        die("only http and https links are fetched")
    try:
        addrs = {a[4][0] for a in socket.getaddrinfo(u.hostname, None)}
    except OSError as e:
        die("cannot resolve %s: %s" % (u.hostname, e))
    for a in addrs:
        ip = ipaddress.ip_address(a)
        if ip.is_private or ip.is_loopback or ip.is_link_local or ip.is_reserved:
            die("%s points at a private address; refusing" % u.hostname)


def fetch(url, out):
    if not shutil.which("yt-dlp"):
        die("yt-dlp is not installed; download the video yourself and pass the file")
    check_url(url)
    os.makedirs(out, exist_ok=True)
    cmd = ["yt-dlp", "--no-playlist", "--no-cookies", "--max-filesize", str(MAX_BYTES), "--write-subs", "--write-auto-subs",
           "--sub-langs", "en.*,en", "--sub-format", "vtt/srt/best", "-f", "mp4/bestvideo[height<=720]+bestaudio/best[height<=720]",
           "--merge-output-format", "mp4", "-o", os.path.join(out, "video.%(ext)s"), url]
    r = run(cmd, 900)
    vids = [p for p in glob.glob(os.path.join(out, "video.*")) if p.lower().endswith(VIDEO_EXT)]
    if r.returncode or not vids:
        die("download failed: %s" % (r.stderr.strip().splitlines() or ["no output"])[-1][:240])
    subs = sorted(glob.glob(os.path.join(out, "video*.vtt")) + glob.glob(os.path.join(out, "video*.srt")))
    return vids[0], (subs[0] if subs else None)


TS = re.compile(r"(?:(\d+):)?(\d{1,2}):(\d{2})[.,](\d{3})\s*-->")


def captions(path):
    """[(seconds, text)] from a .vtt or .srt file, with rolling duplicates removed."""
    out, cur, last = [], None, ""
    with open(path, encoding="utf-8", errors="replace") as f:
        for line in f:
            line = line.strip()
            m = TS.search(line)
            if m:
                h, mi, s, ms = m.groups()
                cur = int(h or 0) * 3600 + int(mi) * 60 + int(s) + int(ms) / 1000
                continue
            if cur is None or not line or line.isdigit() or line.startswith(("WEBVTT", "NOTE", "Kind:", "Language:")):
                continue
            text = re.sub(r"<[^>]+>", "", line).strip()
            if text and text != last:
                out.append((cur, text))
                last = text
    return out


def report(info, src, scene_frames, hook_frames, caps, out, question):
    L = ["# Video report", "", "- source: %s" % src,
         "- length: %s, %sx%s, %s fps%s" % (clock(info["seconds"]), info["width"], info["height"], info["fps"], "" if info["audio"] else ", no audio")]
    if question:
        L += ["- question: %s" % question]
    L += ["", "## What Claude has to fill in", "",
          "<!-- pending: one-paragraph summary, written after looking at every frame -->", "",
          "<!-- pending: the opening: what is on screen at 0s, 3s and 10s and what is said -->", "",
          "<!-- pending: key moments, each with a time and the frame it comes from -->", "",
          "<!-- pending: anything on screen that the audio does not say (text, UI, numbers) -->", "",
          "## Frames (one per cut, or evenly spaced when the video has few cuts)", ""]
    for t, f in scene_frames:
        L.append("- [%s] `%s`" % (clock(t), os.path.relpath(f, out)))
    if hook_frames:
        L += ["", "## The first %d seconds" % HOOK_SECONDS, ""]
        for t, f in hook_frames:
            L.append("- [%s] `%s`" % (clock(t), os.path.relpath(f, out)))
    L += ["", "## Transcript", ""]
    if caps:
        L += ["[%s] %s" % (clock(t), x) for t, x in caps]
    else:
        L.append("_No captions were available. Say so in the answer; do not invent what was said._")
    path = os.path.join(out, "report.md")
    with open(path, "w", encoding="utf-8") as f:
        f.write("\n".join(L) + "\n")
    return path


def cmd_run(a):
    src = a.source
    out = a.out or os.path.join(os.getcwd(), ".hyperskill", "watch", re.sub(r"[^A-Za-z0-9]+", "-", os.path.basename(src.rstrip("/")))[:40].strip("-").lower() or "video")
    os.makedirs(out, exist_ok=True)
    subs = a.captions
    if re.match(r"https?://", src):
        src, fetched = fetch(src, out)
        subs = subs or fetched
    elif not os.path.isfile(src):
        die("no such file: %s" % src)
    info = probe(src)
    start, end = parse_time(a.start), parse_time(a.end)
    sf = frames(src, os.path.join(out, "frames"), start, end, a.max_frames)
    hf = hook(src, os.path.join(out, "hook")) if not start and info["seconds"] > 3 else []
    sheet(os.path.join(out, "frames"), os.path.join(out, "sheet.jpg")) if sf else None
    caps = captions(subs) if subs else []
    if start or end:
        caps = [(t, x) for t, x in caps if (start or 0) <= t <= (end or 1e9)]
    rep = report(info, a.source, sf, hf, caps, out, a.question)
    print(json.dumps({"report": rep, "sheet": os.path.join(out, "sheet.jpg"), "frames": len(sf), "hook_frames": len(hf),
                      "captions": len(caps), "info": info}, indent=1))


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = ap.add_subparsers(dest="cmd", required=True)
    p = sub.add_parser("run"); p.add_argument("source"); p.add_argument("--out"); p.add_argument("--start"); p.add_argument("--end")
    p.add_argument("--captions"); p.add_argument("--max-frames", type=int); p.add_argument("--question")
    p = sub.add_parser("probe"); p.add_argument("video")
    p = sub.add_parser("frames"); p.add_argument("video"); p.add_argument("--out", required=True); p.add_argument("--start"); p.add_argument("--end")
    p.add_argument("--max-frames", type=int); p.add_argument("--every", type=float)
    p = sub.add_parser("hook"); p.add_argument("video"); p.add_argument("--out", required=True)
    p = sub.add_parser("sheet"); p.add_argument("dir"); p.add_argument("--out", required=True)
    p = sub.add_parser("fetch"); p.add_argument("url"); p.add_argument("--out", required=True)
    p = sub.add_parser("captions"); p.add_argument("file")
    a = ap.parse_args(argv)
    if a.cmd == "run":
        cmd_run(a)
    elif a.cmd == "probe":
        print(json.dumps(probe(a.video), indent=1))
    elif a.cmd == "frames":
        for t, f in frames(a.video, a.out, parse_time(a.start), parse_time(a.end), a.max_frames, a.every):
            print("[%s] %s" % (clock(t), f))
    elif a.cmd == "hook":
        for t, f in hook(a.video, a.out):
            print("[%s] %s" % (clock(t), f))
    elif a.cmd == "sheet":
        print(sheet(a.dir, a.out))
    elif a.cmd == "fetch":
        v, s = fetch(a.url, a.out)
        print(json.dumps({"video": v, "captions": s}))
    elif a.cmd == "captions":
        for t, x in captions(a.file):
            print("[%s] %s" % (clock(t), x))


if __name__ == "__main__":
    main()
