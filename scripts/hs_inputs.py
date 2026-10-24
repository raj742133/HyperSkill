"""Files the person attaches in the dashboard as project input: requirements, specs, notes, designs.

Saved under <project>/.hyperskill/inputs/ (private, never executed, never served back). Text is also extracted into a sidecar `.txt` where that
can be done safely with the standard library (markdown, text, csv, json, html, docx; PDF through `pdftotext` when it is installed). Claude reads
the originals too: its Read tool opens PDFs and images. Standard library only.
"""
import html
import os
import re
import shutil
import subprocess
import zipfile

MAX_FILE = 15 * 1024 * 1024
MAX_FILES = 40
MAX_TOTAL = 80 * 1024 * 1024
MAX_TEXT = 400 * 1024
TEXT_EXT = {".md", ".markdown", ".txt", ".csv", ".json", ".yaml", ".yml", ".toml"}
ALLOWED = TEXT_EXT | {".html", ".htm", ".pdf", ".docx", ".png", ".jpg", ".jpeg", ".webp", ".gif"}  # no svg, no scripts, no archives


class InputError(Exception):
    pass


def folder(root):
    return os.path.join(root, ".hyperskill", "inputs")


def safe_name(name):
    base = os.path.basename(str(name or "").replace("\\", "/"))
    base = re.sub(r"[^A-Za-z0-9._ -]", "_", base).strip(" .")[:80]
    if not base:
        raise InputError("the file needs a name")
    return base


def _docx_text(path):
    with zipfile.ZipFile(path) as z:
        info = z.getinfo("word/document.xml")
        if info.file_size > 40 * 1024 * 1024:
            raise InputError("the document is too large to read")
        with z.open(info) as f:
            xml = f.read(MAX_TEXT * 8).decode("utf-8", "replace")
    xml = re.sub(r"</w:p>", "\n", xml)
    xml = re.sub(r"<w:tab/>", "\t", xml)
    return html.unescape(re.sub(r"<[^>]+>", "", xml))


def _extract(path, ext):
    try:
        if ext in TEXT_EXT:
            with open(path, encoding="utf-8", errors="replace") as f:
                return f.read(MAX_TEXT)
        if ext in (".html", ".htm"):
            with open(path, encoding="utf-8", errors="replace") as f:
                t = f.read(MAX_TEXT * 2)
            t = re.sub(r"(?is)<(script|style).*?</\1>", "", t)
            return html.unescape(re.sub(r"\s*\n\s*", "\n", re.sub(r"<[^>]+>", " ", t)))[:MAX_TEXT]
        if ext == ".docx":
            return _docx_text(path)[:MAX_TEXT]
        if ext == ".pdf" and shutil.which("pdftotext"):
            r = subprocess.run(["pdftotext", "-layout", "-q", path, "-"], capture_output=True, timeout=30, stdin=subprocess.DEVNULL)
            return r.stdout.decode("utf-8", "replace")[:MAX_TEXT] if r.returncode == 0 else None
    except (OSError, zipfile.BadZipFile, KeyError, subprocess.TimeoutExpired, InputError):
        return None
    return None


def listing(root):
    d = folder(root)
    rows = []
    if os.path.isdir(d):
        for n in sorted(os.listdir(d)):
            if n.endswith(".txt") and os.path.exists(os.path.join(d, n[:-4])):
                continue  # a sidecar
            p = os.path.join(d, n)
            if os.path.isfile(p):
                side = p + ".txt"
                rows.append({"name": n, "size": os.path.getsize(p), "text": os.path.exists(side) or os.path.splitext(n)[1].lower() in TEXT_EXT,
                             "path": os.path.relpath(side if os.path.exists(side) else p, root)})
    return rows


def add(root, name, data):
    name = safe_name(name)
    ext = os.path.splitext(name)[1].lower()
    if ext not in ALLOWED:
        raise InputError("%s files are not accepted (allowed: %s)" % (ext or "extensionless", ", ".join(sorted(ALLOWED))))
    if len(data) > MAX_FILE:
        raise InputError("the file is larger than %d MB" % (MAX_FILE // 1048576))
    if not data:
        raise InputError("the file is empty")
    rows = listing(root)
    if len(rows) >= MAX_FILES or sum(r["size"] for r in rows) + len(data) > MAX_TOTAL:
        raise InputError("too many or too large attachments already; remove some first")
    d = folder(root)
    os.makedirs(d, exist_ok=True)
    stem, e = os.path.splitext(name)
    final, i = name, 1
    while os.path.exists(os.path.join(d, final)):
        i += 1
        final = "%s-%d%s" % (stem, i, e)
    path = os.path.join(d, final)
    fd = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
    with os.fdopen(fd, "wb") as f:
        f.write(data)
    text = None if ext in TEXT_EXT else _extract(path, ext)
    if text and text.strip():
        with open(path + ".txt", "w", encoding="utf-8") as f:
            f.write(text)
    return final


def remove(root, name):
    name = safe_name(name)
    p = os.path.join(folder(root), name)
    if not os.path.isfile(p):
        raise InputError("no such attachment")
    os.remove(p)
    if os.path.exists(p + ".txt"):
        os.remove(p + ".txt")


def summary(root):
    rows = listing(root)
    if not rows:
        return ""
    return ("Files the user attached as project input (read each one; PDFs and images with your Read tool; a .txt next to a file is its extracted text): "
            + "; ".join("%s (%s)" % (r["path"], "%d KB" % max(1, r["size"] // 1024)) for r in rows))
