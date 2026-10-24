"""Small UI mock-ups for the site fixes and add-ons (see catalog_data.FIXES / ADDONS). Drawn from scratch."""
from preview_svg import *

UW, UH = 480, 210


def canvas(title):
    return Svg(UW, UH, "#efe8da", title=title)


def lbl(s, x, y, text, color=MUTED, size=10.5, weight=600, anchor="start"):
    s.text(x, y, text, size, color, weight, anchor)


def side(s, left, right, lt="BEFORE", rt="AFTER"):
    tag(s, 14, 8, lt, ACCENT); tag(s, 250, 8, rt, OK)
    left(s, 10, 34); right(s, 245, 34)


def pagebox(s, x, y, w=225, h=168):
    s.rect(x, y, w, h, PAPER, 10, LINE, 1.4)


def nav(s, x, y, items, w=200):
    s.rect(x, y, 14, 14, INK, 4)
    for i, t in enumerate(items):
        s.text(x + 26 + i * 52, y + 11, t, 9.5, MUTED, 600)


def mpage(s, x, y, over=False):
    phone(s, x, y, 76, 140); s.rect(x + 8, y + 18, 60, 8, INK, 3); s.lines(x + 8, y + 34, [60, 52, 58], 5, 5)
    if over:
        s.rect(x + 8, y + 68, 120, 30, "#fbe3d8", 4, ACCENT, 1.4); s.text(x + 12, y + 87, "wide table →→→", 8, ACCENT, 700)


def ph_menu(s, x, y, open_):
    phone(s, x, y, 76, 140)
    if not open_:
        for i in range(3): s.rect(x + 54, y + 16 + i * 5, 14, 2.4, INK, 1)
        s.rect(x + 8, y + 16, 24, 10, INK, 3); s.lines(x + 8, y + 44, [60, 50], 6, 6)
    else:
        s.rect(x + 4, y + 12, 68, 124, "#fff", 6); s.text(x + 12, y + 32, "Home", 9, INK, 700); s.text(x + 12, y + 54, "Pricing", 9, INK, 700); s.text(x + 12, y + 76, "About", 9, INK, 700); s.rect(x + 12, y + 96, 50, 20, ACCENT, 10); s.text(x + 37, y + 110, "Sign in", 8, "#fff", 700, "middle")


def tabs(s, x, y, titles, ok):
    for i, t in enumerate(titles):
        xx = x + i * 74; s.rect(xx, y, 70, 24, "#fff" if i == 0 else "#e6dccb", 6); s.rect(xx + 6, y + 7, 10, 10, ACCENT if ok else "#b9afa0", 2); s.text(xx + 21, y + 16, t, 8.2, INK if ok else MUTED, 600)


def snippet(s, x, y, ok):
    s.text(x + 14, y + 40, "Bean & Barrel | Coffee" if ok else "Home", 12, "#1a0dab" if ok else MUTED, 600)
    s.text(x + 14, y + 56, "beanandbarrel.example", 9, OK)
    if ok:
        s.lines(x + 14, y + 68, [190, 150], 6, 7, "#cfc6b8")
        s.text(x + 14, y + 112, "A short, honest description", 9.5, OK, 700)
    else:
        s.text(x + 14, y + 76, "(no description: the engine guesses)", 9.5, ACCENT, 600)


def footer(s, x, y, links, good):
    s.rect(x + 10, y + 100, 205, 58, "#ece5d8", 6)
    for i, l in enumerate(links):
        s.text(x + 22 + i * 62, y + 134, l, 10, INK if good else ACCENT, 700)
        (check(s, x + 22 + i * 62 + 14, y + 146, OK, 8) if good else cross(s, x + 22 + i * 62 + 10, y + 142, ACCENT, 8))


def err404(s, x, y, good):
    pagebox(s, x, y)
    if good:
        s.text(x + 112, y + 80, "404", 44, INK, 800, "middle"); s.text(x + 112, y + 104, "That page moved or never existed.", 10, MUTED, anchor="middle"); s.rect(x + 66, y + 118, 94, 28, ACCENT, 6); s.text(x + 113, y + 136, "Back home", 10.5, "#fff", 700, "middle")
    else:
        s.text(x + 14, y + 40, "404 Not Found", 14, INK, 700, font="Times,serif"); s.text(x + 14, y + 60, "nginx/1.18.0", 10, MUTED, font="Times,serif")


def year(s, x, y, good):
    pagebox(s, x, y); s.rect(x + 10, y + 100, 205, 58, "#ece5d8", 6); s.text(x + 112, y + 134, "© 2026 Acme" if good else "© 2019 Acme", 13, INK if good else ACCENT, 700, "middle")


def sizes(s, x, y, vals):
    pagebox(s, x, y)
    for i, (n, v, c) in enumerate(vals):
        s.rect(x + 20, y + 36 + i * 54, 185 * v, 24, c, 5); s.text(x + 20, y + 30 + i * 54, n, 10, INK, 700)


def button(s, x, y, ok):
    pagebox(s, x, y); s.rect(x + 50, y + 44, 125, 40, ACCENT if ok else "#cfc6b8", 8); s.text(x + 112, y + 70, "Submit", 13, "#fff", 700, "middle")
    s.path("M%s %s l0 18 l5 -4 l4 9 l4 -2 l-4 -9 l7 0 z" % (x + 130, y + 72), INK)
    if ok:
        s.rect(x + 40, y + 108, 145, 30, "#e0f1e6", 6, OK); s.text(x + 112, y + 127, "✓ Message sent", 11, OK, 700, "middle")
    else:
        s.text(x + 112, y + 126, "nothing happens", 11, ACCENT, 700, "middle")


def toast(s, x, y, kind):
    pagebox(s, x, y); s.lines(x + 16, y + 20, [120, 90], 8, 8)
    c, t = (OK, "✓ Saved") if kind == "ok" else (ACCENT, "✗ Couldn't save. Try again.")
    s.rect(x + 20, y + 100, 185, 40, "#fff", 8, c, 1.6); s.text(x + 34, y + 125, t, 12, c, 700)


def field_err(s, x, y):
    pagebox(s, x, y); s.text(x + 18, y + 38, "Email", 10.5, INK, 700); s.rect(x + 18, y + 46, 190, 32, "#fff", 6, ACCENT, 1.8); s.text(x + 28, y + 67, "jo@", 12, INK, font=MONO)
    s.text(x + 18, y + 98, "Enter a full email address", 9.5, ACCENT, 600)


def placeholder(s, x, y, good):
    pagebox(s, x, y)
    if good:
        s.text(x + 16, y + 48, "Roasted in Leeds", 15, INK, 700); s.lines(x + 16, y + 66, [180, 150, 164], 7, 8, "#cfc6b8")
    else:
        s.text(x + 16, y + 48, "Lorem ipsum dolor", 15, ACCENT, 700); s.text(x + 16, y + 74, "Your text here. John Doe.", 10, ACCENT, 600); s.lines(x + 16, y + 92, [160, 130], 7, 8, "#e9c4b4")


def navfix(s, x, y, good):
    pagebox(s, x, y)
    items = ["Home", "Shop", "About"] if good else ["Home", "Shop", "Blog", "Careers", "Test", "About"]
    for i, t in enumerate(items):
        broken = (not good) and t in ("Blog", "Careers", "Test")
        s.text(x + 16, y + 38 + i * 24, t, 12, "#b9afa0" if broken else INK, 600)
        if broken: s.line(x + 14, y + 34 + i * 24, x + 54, y + 34 + i * 24, ACCENT, 1.4); s.text(x + 90, y + 38 + i * 24, "404", 9, ACCENT, 700)


def logo(s, x, y, ok):
    pagebox(s, x, y); s.circle(x + 30, y + 30, 11, ACCENT); s.text(x + 48, y + 35, "Acme", 14, INK, 800); s.line(x + 14, y + 52, x + 211, y + 52, LINE, 1)
    if ok:
        s.path("M%s %s l0 18 l5 -4 l4 9 l4 -2 l-4 -9 l7 0 z" % (x + 40, y + 34), INK); s.rect(x + 70, y + 74, 84, 22, OK, 11); s.text(x + 112, y + 89, "→ home page", 9.5, "#fff", 700, "middle")
    else:
        s.text(x + 112, y + 90, "click does nothing", 10, ACCENT, 700, "middle")


def link(s, x, y, ok, kind):
    pagebox(s, x, y); s.text(x + 18, y + 54, "Call us" if kind == "tel" else "Write to us", 10.5, MUTED, 700)
    s.text(x + 18, y + 82, "+44 113 496 0000" if kind == "tel" else "hello@acme.example", 14, "#1a0dab" if ok else INK, 700, font=MONO)
    if ok:
        s.line(x + 18, y + 86, x + 190, y + 86, "#1a0dab", 1.4); s.rect(x + 18, y + 104, 130, 28, OK, 14); s.text(x + 83, y + 122, "opens dialer" if kind == "tel" else "opens mail app", 10, "#fff", 700, "middle")
    else:
        s.text(x + 18, y + 118, "plain text: must copy by hand", 10, ACCENT, 700)


def three_phones(s):
    for i in range(3): mpage(s, 60 + i * 140, 36)


# ----- add-ons
def dark(s):
    s.rect(30, 30, 200, 150, PAPER, 12, LINE); s.rect(250, 30, 200, 150, "#14110f", 12); s.lines(46, 50, [120, 90], 9, 9, "#cfc6b8"); s.lines(266, 50, [120, 90], 9, 9, "#4a4540")
    s.rect(168, 150, 50, 22, "#cfc6b8", 11); s.circle(179, 161, 8, "#fff"); s.rect(388, 150, 50, 22, OK, 11); s.circle(427, 161, 8, "#fff")


def cookie(s):
    browser(s, 60, 14, 360, 180, "acme.example"); s.lines(80, 50, [160, 130], 9, 9); s.rect(70, 140, 340, 44, "#fff", 8, INK, 1.6); s.text(84, 160, "We use one cookie to remember your choice.", 10, INK, 600)
    s.rect(84, 166, 52, 14, INK, 7); s.text(110, 176.5, "OK", 8, "#fff", 700, "middle"); s.rect(142, 166, 70, 14, "#fff", 7, LINE); s.text(177, 176.5, "No thanks", 8, INK, 700, "middle")


def search(s):
    s.rect(60, 24, 360, 38, "#fff", 19, INK, 1.6); s.circle(84, 43, 8, stroke=INK, sw=2); s.line(90, 49, 97, 56, INK, 2); s.text(108, 48, "cof", 13, INK, font=MONO)
    for i, t in enumerate(["Coffee beans", "Coffee grinders", "Cold coffee kit"]):
        s.rect(60, 74 + i * 38, 360, 32, PAPER, 8, LINE); s.text(78, 95 + i * 38, t, 12, INK, 600)


def totop(s):
    browser(s, 120, 14, 240, 182, "long-page"); s.lines(136, 46, [180, 150, 170, 120, 160, 140, 170], 7, 10, "#cfc6b8"); s.circle(336, 172, 15, ACCENT); s.path("M329 175 l7 -8 l7 8", stroke="#fff", sw=2.4)


def loading(s):
    for i in range(2):
        x = 40 + i * 215; s.rect(x, 26, 190, 150, PAPER, 10, LINE); s.rect(x + 12, 38, 166, 66, "#e6dccb", 6); s.lines(x + 12, 118, [150, 120, 140], 8, 8, "#e6dccb")
    s.text(135, 196, "skeleton matches the layout", 10, MUTED, anchor="middle"); s.text(350, 196, "then real content replaces it", 10, MUTED, anchor="middle")


def hover(s):
    s.rect(50, 60, 150, 50, "#cfc6b8", 10); s.text(125, 90, "Default", 13, INK, 600, "middle"); s.rect(280, 60, 150, 50, ACCENT, 10); s.text(355, 90, "Hover / focus", 13, "#fff", 700, "middle")
    s.rect(274, 54, 162, 62, "none", 12, ACCENT, 1.6, extra='stroke-dasharray="4 3"'); s.text(240, 160, "every interactive element shows its state", 11, MUTED, anchor="middle")


def progress(s):
    browser(s, 100, 14, 280, 182, "article"); s.rect(100, 36, 280, 4, "#d8cfbf"); s.rect(100, 36, 170, 4, ACCENT); s.lines(116, 60, [200, 170, 190, 140, 180, 160], 7, 10, "#cfc6b8")


def copybtn(s):
    s.rect(70, 50, 340, 54, "#14110f", 10); s.text(88, 83, "npm install acme", 14, "#8fbf8f", font=MONO); s.rect(334, 62, 62, 28, "#fff", 6); s.text(365, 80, "Copy", 11, INK, 700, "middle")
    s.rect(300, 120, 110, 28, "#e0f1e6", 14, OK); s.text(355, 138, "✓ Copied", 11, OK, 700, "middle")


def printer(s):
    s.rect(60, 70, 130, 80, "#cfc6b8", 12); s.rect(84, 36, 82, 50, "#fff", 3, LINE); s.rect(84, 128, 82, 52, "#fff", 3, LINE); s.lines(94, 144, [60, 50], 5, 6)
    s.text(270, 70, "On paper:", 12, INK, 700); s.text(270, 94, "✓ no navigation", 11, OK, 600); s.text(270, 114, "✓ no background colour", 11, OK, 600); s.text(270, 134, "✓ links shown as text", 11, OK, 600)


def sticky(s):
    browser(s, 90, 14, 300, 182, "acme.example"); s.rect(90, 36, 300, 26, INK); s.text(104, 54, "Acme", 11, "#fff", 800); s.text(300, 54, "Shop   Help", 10, "#fff", 600); s.lines(106, 80, [200, 160, 180, 120, 190], 7, 10, "#cfc6b8"); s.text(240, 190, "stays reachable while scrolling", 9.5, MUTED, anchor="middle")


def skip(s):
    browser(s, 90, 14, 300, 182, "acme.example"); s.rect(100, 40, 130, 22, ACCENT, 4); s.text(165, 55, "Skip to content", 10.5, "#fff", 700, "middle"); s.lines(100, 76, [40, 40, 40, 40], 8, 8, "#cfc6b8"); s.rect(100, 120, 260, 56, "#fff", 6, LINE); s.text(110, 140, "Main content (focus lands here)", 10, INK, 600)
    arrow(s, 165, 66, 165, 118, ACCENT, 1.8)


def pwtoggle(s):
    s.rect(80, 50, 320, 44, "#fff", 8, INK, 1.6); s.text(98, 79, "••••••••", 18, INK, 700); s.path("M356 72 q14 -14 28 0 q-14 14 -28 0 z", stroke=INK, sw=2); s.circle(370, 72, 4, INK)
    s.rect(80, 108, 320, 44, "#fff", 8, LINE); s.text(98, 137, "hunter2!", 16, INK, font=MONO); s.text(240, 180, "show what you typed, on request", 10.5, MUTED, anchor="middle")


def utm(s):
    s.rect(30, 30, 420, 38, "#fff", 8, LINE); s.text(44, 54, "acme.example/?", 10.5, INK, font=MONO); s.text(132, 54, "utm_source=news", 10.5, ACCENT, 700, font=MONO); s.text(240, 54, "&utm_campaign=fall", 10.5, OK, 700, font=MONO)
    s.text(40, 110, "Read once on arrival, stored with consent,", 11, MUTED); s.text(40, 128, "so you can tell which campaign brought a visitor.", 11, MUTED)


def modal(s):
    s.rect(30, 20, 420, 170, "#cfc6b8", 10, op=.5); s.rect(110, 44, 260, 120, "#fff", 12, INK, 1.8); s.text(240, 78, "Delete this project?", 14, INK, 700, "middle"); s.text(240, 98, "This cannot be undone.", 10.5, MUTED, anchor="middle")
    s.rect(130, 124, 100, 28, "#fff", 8, LINE); s.text(180, 142, "Cancel", 11, INK, 700, "middle"); s.rect(250, 124, 100, 28, ACCENT, 8); s.text(300, 142, "Delete", 11, "#fff", 700, "middle")


def updated(s):
    browser(s, 100, 14, 280, 182, "acme.example/docs"); s.text(116, 58, "Getting started", 14, INK, 800); s.rect(116, 68, 140, 18, "#e6dccb", 9); s.text(186, 81, "Last updated 12 Oct 2026", 9.5, MUTED, 600, "middle"); s.lines(116, 100, [220, 190, 200, 150], 7, 10, "#cfc6b8")


def faq(s):
    for i, (q, o) in enumerate([("How long is delivery?", True), ("Can I change my order?", False), ("Do you ship abroad?", False)]):
        y = 22 + i * (74 if i == 0 else 48) if i < 1 else 22 + 74 + (i - 1) * 48
        h = 66 if o else 40
        s.rect(60, y, 360, h, PAPER, 8, ACCENT if o else LINE, 1.6 if o else 1.2); s.text(76, y + 25, q, 12, INK, 700); s.text(396, y + 25, "−" if o else "+", 16, ACCENT, 700, "middle")
        if o: s.lines(76, y + 38, [250, 190], 6, 6, "#cfc6b8")


def floating(s):
    browser(s, 100, 14, 280, 182, "acme.example"); s.lines(116, 48, [200, 160, 180, 120], 8, 10, "#cfc6b8"); s.circle(352, 168, 20, OK); s.path("M344 161 h16 v12 h-8 l-5 5 v-5 h-3 z", "#fff")
    s.text(240, 205, "does not cover content or the footer links", 9.5, MUTED, anchor="middle")


def optimistic(s):
    steps = [("tap Like", "♡", MUTED), ("heart fills at once", "♥", ACCENT), ("server confirms (or undo)", "✓", OK)]
    for i, (t, g, c) in enumerate(steps):
        x = 24 + i * 150; s.rect(x, 50, 130, 100, PAPER, 10, LINE); s.text(x + 65, 108, g, 40, c, 700, "middle"); s.text(x + 65, 138, t, 9.5, INK, 600, "middle")
        if i < 2: arrow(s, x + 134, 100, x + 148, 100, MUTED)


def pagination(s):
    for i in range(4): s.rect(60 + i * 90, 26, 80, 36, PAPER, 8, LINE); s.lines(70 + i * 90, 36, [58, 40], 6, 6, "#cfc6b8")
    for i, t in enumerate(["‹", "1", "2", "3", "…", "9", "›"]):
        x = 90 + i * 46; on = t == "2"; s.rect(x, 110, 36, 36, ACCENT if on else "#fff", 8, ACCENT if on else LINE); s.text(x + 18, 134, t, 14, "#fff" if on else INK, 700, "middle")


def render_fix(name):
    s = canvas(name)
    def L(f): return lambda s, x, y: f(s, x, y)
    sp = {
        "Remove horizontal scrolling": lambda: side(s, lambda s, x, y: (pagebox(s, x, y), mpage(s, x + 74, y + 14, True), s.rect(x + 14, y + 156, 197, 6, "#cfc6b8", 3), s.rect(x + 14, y + 156, 90, 6, ACCENT, 3)), lambda s, x, y: (pagebox(s, x, y), mpage(s, x + 74, y + 14), lbl(s, x + 112, y + 164, "fits the screen", OK, 10, 700, "middle"))),
        "Find broken links": lambda: (pagebox(s, 60, 20, 360, 170), [ (s.text(84, 62 + i * 40, t, 13, "#1a0dab" if i != 1 else ACCENT, 600), s.text(330, 62 + i * 40, "200 OK" if i != 1 else "404", 11, OK if i != 1 else ACCENT, 700)) for i, t in enumerate(["/pricing", "/old-page", "/contact", "/docs"][:4])], cross(s, 300, 92, ACCENT, 9)),
        "Add a mobile menu": lambda: (ph_menu(s, 130, 36, False), ph_menu(s, 274, 36, True), arrow(s, 214, 106, 270, 106, MUTED, 2)),
        "Add a favicon": lambda: (tabs(s, 80, 50, ["Acme", "Docs", "Blog"], True), s.text(240, 120, "a recognisable icon in every tab and bookmark", 11, MUTED, anchor="middle")),
        "Fix page titles": lambda: side(s, lambda s, x, y: (pagebox(s, x, y), tabs(s, x + 10, y + 50, ["Untitled", "Document", "index"], False), lbl(s, x + 14, y + 120, "same or empty titles", ACCENT)), lambda s, x, y: (pagebox(s, x, y), tabs(s, x + 10, y + 50, ["Pricing", "About us", "Contact"], True), lbl(s, x + 14, y + 120, "one clear title each", OK))),
        "Add meta descriptions": lambda: side(s, lambda s, x, y: (pagebox(s, x, y), snippet(s, x, y, False)), lambda s, x, y: (pagebox(s, x, y), snippet(s, x, y, True))),
        "Fix footer links": lambda: side(s, lambda s, x, y: (pagebox(s, x, y), footer(s, x, y, ["Terms", "Privacy", "Help"], False), lbl(s, x + 14, y + 40, 'links to "#"', ACCENT)), lambda s, x, y: (pagebox(s, x, y), footer(s, x, y, ["Terms", "Privacy", "Help"], True), lbl(s, x + 14, y + 40, "real pages", OK))),
        "Add a custom 404 page": lambda: side(s, lambda s, x, y: err404(s, x, y, False), lambda s, x, y: err404(s, x, y, True)),
        "Fix the copyright year": lambda: side(s, lambda s, x, y: year(s, x, y, False), lambda s, x, y: year(s, x, y, True)),
        "Compress images": lambda: side(s, lambda s, x, y: sizes(s, x, y, [("hero.png", 1, ACCENT), ("team.jpg", .62, ACCENT)]), lambda s, x, y: sizes(s, x, y, [("hero.webp", .09, OK), ("team.webp", .05, OK)])),
        "Fix broken buttons": lambda: side(s, lambda s, x, y: button(s, x, y, False), lambda s, x, y: button(s, x, y, True)),
        "Add success messages": lambda: toast(s, 130, 20, "ok") if False else side(s, lambda s, x, y: (pagebox(s, x, y), s.rect(x + 20, y + 40, 100, 30, ACCENT, 6), s.text(x + 70, y + 60, "Save", 12, "#fff", 700, "middle"), lbl(s, x + 20, y + 110, "no feedback: did it work?", ACCENT)), lambda s, x, y: toast(s, x, y, "ok")),
        "Add error messages": lambda: side(s, lambda s, x, y: (pagebox(s, x, y), s.rect(x + 18, y + 46, 190, 32, "#fff", 6, LINE), s.text(x + 28, y + 67, "jo@", 12, INK, font=MONO), lbl(s, x + 18, y + 110, "form just doesn't submit", ACCENT)), lambda s, x, y: field_err(s, x, y)),
        "Remove placeholder text": lambda: side(s, lambda s, x, y: placeholder(s, x, y, False), lambda s, x, y: placeholder(s, x, y, True)),
        "Remove unused navigation": lambda: side(s, lambda s, x, y: navfix(s, x, y, False), lambda s, x, y: navfix(s, x, y, True)),
        "Fix mobile overflow": lambda: side(s, lambda s, x, y: (pagebox(s, x, y), mpage(s, x + 74, y + 14, True)), lambda s, x, y: (pagebox(s, x, y), mpage(s, x + 74, y + 14), s.lines(x + 82, y + 82, [56, 44, 50], 5, 5, "#cfc6b8"))),
        "Make the logo clickable": lambda: side(s, lambda s, x, y: logo(s, x, y, False), lambda s, x, y: logo(s, x, y, True)),
        "Make the phone number clickable": lambda: side(s, lambda s, x, y: link(s, x, y, False, "tel"), lambda s, x, y: link(s, x, y, True, "tel")),
        "Make the email clickable": lambda: side(s, lambda s, x, y: link(s, x, y, False, "mail"), lambda s, x, y: link(s, x, y, True, "mail")),
        "Make every page mobile optimised": lambda: (three_phones(s), [lbl(s, 98 + i * 140, 196, t, MUTED, 10, 600, "middle") for i, t in enumerate(["home", "pricing", "checkout"])]),
    }
    sp[name]()
    return s.render()


def render_addon(name):
    s = canvas(name)
    {"Dark mode toggle": dark, "Cookie banner": cookie, "Site search": search, "Back-to-top button": totop, "Loading animations": loading, "Hover states": hover,
     "Scroll progress bar": progress, "Copy button": copybtn, "Print stylesheet": printer, "Sticky header": sticky, "Skip to content": skip,
     "Password visibility toggle": pwtoggle, "UTM tracking": utm, "Confirmation modals": modal, "Last updated date": updated, "Expandable FAQ": faq,
     "Floating contact button": floating, "Optimistic UI": optimistic, "Pagination": pagination}[name](s)
    return s.render()
