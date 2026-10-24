"""One before/after picture for each of the 30 vibe-coded design tells (see catalog_data.TELLS). Drawn from scratch, not copied."""
from preview_svg import *

W, H = 225, 188  # one half


def panel(s, x, y, fill=PAPER):
    s.rect(x, y, W, H, fill, 10, LINE, 1.4)


def head(s, x, y, w=120, fill=INK):
    s.rect(x, y, w, 11, fill, 3)
    s.rect(x, y + 17, w * .7, 7, LINE if fill == INK else "#ffffff55", 3)


def cards3(s, x, y, equal=True, fill=PAPER):
    for i in range(3):
        s.rect(x + i * 70, y, 62, 74, fill, 8, LINE)
        s.rect(x + i * 70 + 8, y + 10, 18, 18, "#d9c9b6", 5)
        s.lines(x + i * 70 + 8, y + 38, [44, 34], 6, 6)


def btn(s, x, y, label, fill=INK, ink="#fff", w=84, r=17):
    s.rect(x, y, w, 30, fill, r)
    s.text(x + w / 2, y + 19.5, label, 11.5, ink, 600, "middle")


def b_gradient(s, x, y):
    panel(s, x, y); g = s.grad([(0, "#ff00d4"), (.5, "#7a00ff"), (1, "#00e5ff")]); s.rect(x + 12, y + 12, W - 24, 110, g, 8); head(s, x + 26, y + 34, 100, "#fff"); btn(s, x + 26, y + 138, "Start", "#fff", INK)
def g_gradient(s, x, y):
    panel(s, x, y); s.rect(x + 12, y + 12, W - 24, 110, "#e9dccb", 8); head(s, x + 26, y + 34); btn(s, x + 26, y + 138, "Start")
def b_lucide(s, x, y):
    panel(s, x, y)
    for i in range(6):
        cx, cy = x + 40 + (i % 3) * 70, y + 50 + (i // 3) * 70
        s.rect(cx - 22, cy - 22, 44, 44, "#eef1f6", 12); s.circle(cx, cy, 10, stroke="#475569", sw=2.4)
        s.line(cx - 4, cy, cx + 4, cy, "#475569", 2.4)
def g_lucide(s, x, y):
    panel(s, x, y); s.text(x + 18, y + 46, "Billing", 16, INK, 700); s.lines(x + 18, y + 60, [150, 110], 7, 7)
    s.text(x + 18, y + 118, "Reports", 16, INK, 700); s.lines(x + 18, y + 132, [140, 90], 7, 7)
def b_white(s, x, y):
    panel(s, x, y, "#ffffff"); head(s, x + 20, y + 28); s.lines(x + 20, y + 70, [170, 150, 160], 7, 8, "#d6d6d6"); btn(s, x + 20, y + 140, "Start")
def g_white(s, x, y):
    panel(s, x, y, "#f1e8d8"); head(s, x + 20, y + 28); s.lines(x + 20, y + 70, [170, 150, 160], 7, 8, "#d3c6b2"); btn(s, x + 20, y + 140, "Start", "#7a3e12")
def b_rainbow(s, x, y):
    panel(s, x, y)
    for i, c in enumerate(["#ef4444", "#f59e0b", "#eab308", "#22c55e", "#06b6d4", "#6366f1", "#d946ef"]):
        s.rect(x + 16 + i * 28, y + 40 + (i % 3) * 8, 22, 100 - (i % 3) * 14, c, 5)
def g_rainbow(s, x, y):
    panel(s, x, y)
    for i in range(7):
        s.rect(x + 16 + i * 28, y + 40 + (i % 3) * 8, 22, 100 - (i % 3) * 14, ACCENT if i == 3 else "#cfc6b8", 5)
def b_shadow(s, x, y):
    panel(s, x, y); f = s.shadow(11, 12, .55); s.rect(x + 40, y + 36, 145, 100, "#ffffff", 14, extra=f); head(s, x + 56, y + 56, 90); s.lines(x + 56, y + 90, [110, 80], 7, 7)
def g_shadow(s, x, y):
    panel(s, x, y); s.rect(x + 40, y + 36, 145, 100, "#ffffff", 8, "#cfc6b8", 1.6); head(s, x + 56, y + 56, 90); s.lines(x + 56, y + 90, [110, 80], 7, 7)
def b_three(s, x, y):
    panel(s, x, y); s.text(x + 14, y + 28, "Features", 14, INK, 700); cards3(s, x + 8, y + 50)
def g_three(s, x, y):
    panel(s, x, y); s.text(x + 14, y + 28, "How it works", 14, INK, 700); s.rect(x + 12, y + 44, 120, 126, "#e9dccb", 8); s.rect(x + 20, y + 54, 104, 70, PAPER, 5, LINE)
    for i in range(3):
        s.circle(x + 150, y + 62 + i * 38, 9, INK); s.text(x + 150, y + 66, "1", 9, "#fff", 700, "middle") if i == 0 else None
        s.lines(x + 166, y + 56 + i * 38, [48, 34], 6, 6)
def b_emoji(s, x, y):
    panel(s, x, y)
    for i, c in enumerate(["#fbbf24", "#f87171", "#60a5fa", "#34d399"]):
        cy = y + 38 + i * 36; s.circle(x + 28, cy, 11, c); s.circle(x + 24.5, cy - 3, 1.6, INK); s.circle(x + 31.5, cy - 3, 1.6, INK); s.path("M%s %s q3.5 4 7 0" % (x + 24.5, cy + 3), stroke=INK, sw=1.4); s.lines(x + 50, cy - 6, [120], 8, 6)
def g_emoji(s, x, y):
    panel(s, x, y)
    for i in range(4):
        cy = y + 38 + i * 36; s.text(x + 28, cy + 5, "%d" % (i + 1), 14, INK, 700, "middle", font=MONO); s.lines(x + 50, cy - 6, [120], 8, 6)
def b_glass(s, x, y):
    panel(s, x, y, "#fff"); g = s.grad([(0, "#7c3aed"), (1, "#06b6d4")]); s.rect(x + 8, y + 8, W - 16, H - 16, g, 8); s.circle(x + 60, y + 60, 34, "#f0abfc", op=.9)
    s.rect(x + 36, y + 50, 150, 88, "#ffffff", 16, "#ffffff", 1.6, .28); s.rect(x + 36, y + 50, 150, 2, "#ffffff", 1, op=.7); head(s, x + 52, y + 72, 90, "#fff")
def g_glass(s, x, y):
    panel(s, x, y); s.rect(x + 36, y + 50, 150, 88, "#ffffff", 8, "#cfc6b8", 1.6); head(s, x + 52, y + 72, 90); s.lines(x + 52, y + 106, [100], 7, 6)
def b_emdash(s, x, y):
    panel(s, x, y); s.text(x + 14, y + 70, "Fast — simple —", 17, INK, 700); s.text(x + 14, y + 96, "powerful — yours.", 17, INK, 700); s.rect(x + 14, y + 112, 190, 7, LINE, 3)
def g_emdash(s, x, y):
    panel(s, x, y); s.text(x + 14, y + 70, "It loads fast and", 17, INK, 700); s.text(x + 14, y + 96, "you can edit it.", 17, INK, 700); s.rect(x + 14, y + 112, 190, 7, LINE, 3)
def b_font(s, x, y):
    panel(s, x, y); s.text(x + 18, y + 80, "Inter", 40, INK, 700, font="Inter,Helvetica,Arial,sans-serif"); s.text(x + 18, y + 108, "The same typeface as every other site.", 11, MUTED)
def g_font(s, x, y):
    panel(s, x, y); s.text(x + 18, y + 80, "Roast", 44, INK, 700, font="Georgia,'Times New Roman',serif"); s.text(x + 18, y + 108, "A pairing chosen for this brand.", 11, MUTED, font=MONO)
def b_stripe(s, x, y):
    panel(s, x, y)
    for i, c in enumerate(["#6366f1", "#22c55e", "#f59e0b"]):
        yy = y + 22 + i * 52; s.rect(x + 16, yy, 192, 42, "#fff", 6, LINE); s.rect(x + 16, yy, 5, 42, c, 2); s.lines(x + 32, yy + 11, [100, 70], 7, 7)
def g_stripe(s, x, y):
    panel(s, x, y)
    for i, (t, c) in enumerate([("NEW", OK), ("LATE", ACCENT), ("DONE", MUTED)]):
        yy = y + 22 + i * 52; s.rect(x + 16, yy, 192, 42, "#fff", 6, LINE); s.lines(x + 28, yy + 11, [100, 70], 7, 7); s.rect(x + 160, yy + 12, 36, 16, c, 8); s.text(x + 178, yy + 24, t, 8, "#fff", 700, "middle")
def b_fakequotes(s, x, y):
    panel(s, x, y)
    for i, n in enumerate(["Sarah, CEO", "Alex, CTO", "Jo, Founder"]):
        xx = x + 8 + i * 70; s.rect(xx, y + 30, 62, 110, "#fff", 8, LINE); s.circle(xx + 31, y + 56, 12, "#d9c9b6"); s.lines(xx + 8, y + 80, [46, 40, 34], 5, 5); s.text(xx + 31, y + 130, n, 7.5, MUTED, anchor="middle")
    s.text(x + 14, y + 168, "“Life-changing!” x3", 10, ACCENT, 600)
def g_fakequotes(s, x, y):
    panel(s, x, y); s.rect(x + 14, y + 26, 197, 110, "#fff", 8, LINE); s.text(x + 28, y + 60, "“Shipped our first invoice", 12, INK, 600); s.text(x + 28, y + 78, "in an afternoon.”", 12, INK, 600); s.text(x + 28, y + 106, "Priya N., Leeds (used with permission)", 9, MUTED)
    s.text(x + 14, y + 168, "A real, attributable quote", 10, OK, 600)
def b_bento(s, x, y):
    panel(s, x, y)
    for (a, b, w, h, c) in [(10, 10, 100, 80, "#c7d2fe"), (116, 10, 100, 36, "#fbcfe8"), (116, 52, 46, 38, "#bbf7d0"), (168, 52, 48, 38, "#fde68a"), (10, 96, 60, 80, "#bae6fd"), (76, 96, 140, 80, "#ddd6fe")]:
        s.rect(x + a, y + b, w, h, c, 10)
def g_bento(s, x, y):
    panel(s, x, y); s.rect(x + 12, y + 14, 98, 160, "#e9dccb", 8); s.lines(x + 124, y + 22, [88, 70, 80, 60, 84, 66], 7, 12)
def b_terminal(s, x, y):
    panel(s, x, y); s.rect(x + 14, y + 20, 197, 120, "#0f172a", 8)
    for i, c in enumerate(("#ef4444", "#f59e0b", "#22c55e")): s.circle(x + 28 + i * 12, y + 34, 3.5, c)
    s.text(x + 26, y + 66, "$ npm i awesome", 11, "#4ade80", font=MONO); s.text(x + 26, y + 86, "✓ installed in 0.2s", 11, "#94a3b8", font=MONO)
def g_terminal(s, x, y):
    panel(s, x, y); browser(s, x + 12, y + 16, 201, 130, "app.example.com")
    s.rect(x + 22, y + 46, 40, 90, "#ece5d8", 4); s.lines(x + 70, y + 50, [80, 60], 7, 8); s.rect(x + 70, y + 82, 132, 14, "#fff", 3, LINE); s.rect(x + 70, y + 100, 132, 14, "#fff", 3, LINE); s.rect(x + 70, y + 118, 132, 14, "#fff", 3, LINE)
def b_notx(s, x, y):
    panel(s, x, y); s.text(x + 14, y + 66, "It’s not a tool,", 16, INK, 700); s.text(x + 14, y + 90, "it’s a movement.", 16, INK, 700); s.rect(x + 14, y + 108, 150, 7, LINE, 3)
def g_notx(s, x, y):
    panel(s, x, y); s.text(x + 14, y + 66, "Track invoices and", 16, INK, 700); s.text(x + 14, y + 90, "get paid sooner.", 16, INK, 700); s.rect(x + 14, y + 108, 150, 7, LINE, 3)
def b_checks(s, x, y):
    panel(s, x, y)
    for i in range(4): check(s, x + 20, y + 40 + i * 32, "#16a34a", 10); s.lines(x + 44, y + 33 + i * 32, [130 - i * 12], 8, 6)
def g_checks(s, x, y):
    panel(s, x, y); s.lines(x + 18, y + 30, [180, 150, 170, 130, 160, 120], 7, 9)
def b_pricing(s, x, y):
    panel(s, x, y)
    for i, n in enumerate(["Basic", "Pro", "Team"]):
        xx = x + 8 + i * 70; s.rect(xx, y + 24 + (-6 if i == 1 else 0), 62, 130 + (12 if i == 1 else 0), "#fff", 8, ACCENT if i == 1 else LINE, 2 if i == 1 else 1.2); s.text(xx + 31, y + 48, n, 10, INK, 700, "middle"); s.text(xx + 31, y + 78, "$%d" % (9 + i * 20), 15, INK, 700, "middle"); s.lines(xx + 9, y + 96, [44, 38, 44], 5, 6)
def g_pricing(s, x, y):
    panel(s, x, y); s.rect(x + 28, y + 20, 170, 150, "#fff", 10, LINE, 1.4); s.text(x + 113, y + 54, "Free while you grow", 11.5, MUTED, anchor="middle"); s.text(x + 113, y + 92, "$0", 30, INK, 700, "middle"); s.lines(x + 56, y + 108, [114, 100, 108], 6, 7); btn(s, x + 73, y + 140, "Start", INK, "#fff", 80, 15)
def b_nodemo(s, x, y):
    panel(s, x, y); g = s.grad([(0, "#c4b5fd"), (1, "#f0abfc")]); s.circle(x + 112, y + 94, 56, g); s.text(x + 112, y + 99, "✨ AI-powered", 11, "#fff", 700, "middle")
def g_nodemo(s, x, y):
    panel(s, x, y); browser(s, x + 12, y + 16, 201, 150, "app.example.com/invoices")
    for i, (a, v) in enumerate([("INV-014", "£240"), ("INV-013", "£180"), ("INV-012", "£920")]): s.text(x + 24, y + 62 + i * 28, a, 9.5, INK, 600, font=MONO); s.text(x + 190, y + 62 + i * 28, v, 9.5, INK, 600, "end", font=MONO); s.line(x + 24, y + 70 + i * 28, x + 196, y + 70 + i * 28, LINE, 1)
def b_radius(s, x, y):
    panel(s, x, y); s.rect(x + 18, y + 24, 190, 70, "#fff", 28, LINE); s.rect(x + 18, y + 106, 120, 34, ACCENT, 17); s.rect(x + 146, y + 106, 62, 34, "#fff", 17, LINE); s.circle(x + 40, y + 160, 12, "#d9c9b6")
def g_radius(s, x, y):
    panel(s, x, y); s.rect(x + 18, y + 24, 190, 70, "#fff", 4, INK, 1.6); s.rect(x + 18, y + 106, 120, 34, ACCENT, 4); s.rect(x + 146, y + 106, 62, 34, "#fff", 12, LINE); s.rect(x + 28, y + 150, 24, 24, "#d9c9b6", 0)
def b_purple(s, x, y):
    panel(s, x, y, "#0b0b12"); s.text(x + 16, y + 44, "Launch faster", 17, "#c4b5fd", 700); s.rect(x + 16, y + 64, 110, 30, "#7c3aed", 15); s.rect(x + 16, y + 112, 190, 52, "#1a1a2e", 8)
    for i, c in enumerate(["#7c3aed", "#a78bfa", "#0b0b12", "#1a1a2e"]): s.rect(x + 28 + i * 40, y + 124, 30, 28, c, 5, "#3b3b5c")
def g_purple(s, x, y):
    panel(s, x, y, "#f1e8d8"); s.text(x + 16, y + 44, "Roasted to order", 17, "#4a2a10", 700); s.rect(x + 16, y + 64, 110, 30, "#b4541a", 15); s.rect(x + 16, y + 112, 190, 52, "#fff", 8, LINE)
    for i, c in enumerate(["#b4541a", "#e8a33d", "#f1e8d8", "#4a2a10"]): s.rect(x + 28 + i * 40, y + 124, 30, 28, c, 5, "#cfc6b8")
def b_skel(s, x, y):
    panel(s, x, y); s.circle(x + 112, y + 94, 24, stroke=LINE, sw=6); s.path("M%s %s a24 24 0 0 1 24 -24" % (x + 88, y + 94), stroke=INK, sw=6); s.text(x + 112, y + 150, "Loading…", 11, MUTED, anchor="middle")
def g_skel(s, x, y):
    panel(s, x, y); s.rect(x + 16, y + 20, 193, 60, "#ece5d8", 8); s.lines(x + 16, y + 96, [150, 120, 140], 9, 9, "#ece5d8"); s.rect(x + 16, y + 20, 70, 60, "#e3d9c8", 8)
def b_orbs(s, x, y):
    panel(s, x, y, "#fff"); s.circle(x + 60, y + 60, 60, s.radial("#a78bfa")); s.circle(x + 170, y + 130, 70, s.radial("#f472b6")); head(s, x + 40, y + 80, 120)
def g_orbs(s, x, y):
    panel(s, x, y, "#fff"); head(s, x + 40, y + 60, 120); s.lines(x + 40, y + 100, [140, 110], 7, 7)
def b_dots(s, x, y):
    panel(s, x, y, "#fff")
    for i in range(11):
        for j in range(8): s.circle(x + 14 + i * 20, y + 14 + j * 23, 1.6, "#cbd5e1")
    head(s, x + 40, y + 70, 120)
def g_dots(s, x, y):
    panel(s, x, y, "#fff"); head(s, x + 40, y + 70, 120); s.lines(x + 40, y + 110, [140, 100], 7, 7)
def star(s, cx, cy, r, c):
    s.path("M%s %s Q%s %s %s %s Q%s %s %s %s Q%s %s %s %s Q%s %s %s %s Z" % (cx, cy - r, cx, cy, cx + r, cy, cx, cy, cx, cy + r, cx, cy, cx - r, cy, cx, cy, cx, cy - r), c)
def b_sparkle(s, x, y):
    panel(s, x, y); star(s, x + 36, y + 70, 12, "#a78bfa"); star(s, x + 54, y + 52, 6, "#f472b6"); s.text(x + 72, y + 76, "AI features", 17, INK, 700); star(s, x + 36, y + 120, 10, "#a78bfa"); s.text(x + 72, y + 126, "Magic inside", 14, MUTED)
def g_sparkle(s, x, y):
    panel(s, x, y); s.text(x + 36, y + 76, "Drafts replies", 17, INK, 700); s.text(x + 36, y + 126, "Summarises threads", 14, MUTED)
def b_arrow(s, x, y):
    panel(s, x, y); s.rect(x + 20, y + 70, 150, 40, INK, 20); s.text(x + 60, y + 95, "Get started", 13, "#fff", 600); arrow(s, x + 124, y + 90, x + 150, y + 90, "#fff", 2.2); s.line(x + 154, y + 62, x + 164, y + 62, MUTED, 2); s.line(x + 160, y + 124, x + 176, y + 124, MUTED, 2)
def g_arrow(s, x, y):
    panel(s, x, y); s.rect(x + 20, y + 70, 150, 40, INK, 6); s.text(x + 95, y + 95, "Get started", 13, "#fff", 600, "middle")
def b_nolegal(s, x, y):
    panel(s, x, y); s.rect(x + 12, y + 128, W - 24, 48, "#ece5d8", 6); s.text(x + 112, y + 156, "© 2026 Acme", 11, MUTED, anchor="middle"); head(s, x + 24, y + 30, 120)
def g_terms(s, x, y):
    panel(s, x, y); s.rect(x + 12, y + 128, W - 24, 48, "#ece5d8", 6); s.text(x + 112, y + 156, "© 2026 Acme  ·  Terms  ·  Privacy", 10.5, INK, 600, "middle"); s.line(x + 118, y + 160, x + 150, y + 160, ACCENT, 1.6); head(s, x + 24, y + 30, 120)
def g_privacy(s, x, y):
    panel(s, x, y); s.rect(x + 12, y + 128, W - 24, 48, "#ece5d8", 6); s.text(x + 112, y + 156, "© 2026 Acme  ·  Terms  ·  Privacy", 10.5, INK, 600, "middle"); s.line(x + 158, y + 160, x + 198, y + 160, ACCENT, 1.6); head(s, x + 24, y + 30, 120)
def b_hover(s, x, y):
    panel(s, x, y)
    for i in range(3):
        for j in range(2):
            xx, yy = x + 14 + i * 70, y + 28 + j * 76; s.rect(xx, yy, 62, 62, "#fff", 8, LINE); s.path("M%s %s q-5 8 0 16 M%s %s q-9 12 0 24" % (xx - 4, yy + 20, xx + 66, yy + 14), stroke=ACCENT, sw=1.6)
def g_hover(s, x, y):
    panel(s, x, y); s.rect(x + 40, y + 50, 145, 50, ACCENT, 8); s.text(x + 112, y + 80, "Buy now", 14, "#fff", 700, "middle"); s.rect(x + 40, y + 114, 145, 36, "#fff", 8, LINE); s.text(x + 112, y + 137, "Details", 12, MUTED, 500, "middle")
def b_neon(s, x, y):
    panel(s, x, y, "#05050a"); s.text(x + 18, y + 64, "NEON", 34, "#39ff14", 800); s.text(x + 18, y + 104, "ELECTRIC", 22, "#ff2bd6", 800); s.rect(x + 18, y + 124, 150, 36, "#00f0ff", 4)
def g_neon(s, x, y):
    panel(s, x, y, "#fff"); s.text(x + 18, y + 64, "Clear", 34, INK, 800); s.text(x + 18, y + 104, "high contrast", 18, "#4a2a10", 600); s.rect(x + 18, y + 124, 150, 36, ACCENT, 6); s.text(x + 93, y + 147, "4.8 : 1", 12, "#fff", 700, "middle", font=MONO)
def b_pastel(s, x, y):
    panel(s, x, y)
    for i, c in enumerate(["#fbcfe8", "#bfdbfe", "#bbf7d0", "#fde68a", "#e9d5ff", "#fed7aa"]): s.rect(x + 14 + (i % 3) * 68, y + 24 + (i // 3) * 74, 62, 66, c, 12)
    s.text(x + 14, y + 178, "all soft, none distinct", 9.5, MUTED)
def g_pastel(s, x, y):
    panel(s, x, y)
    for i, c in enumerate(["#4a2a10", "#b4541a", "#e8a33d", "#f1e8d8", "#2f5d50", "#1b1713"]): s.rect(x + 14 + (i % 3) * 68, y + 24 + (i // 3) * 74, 62, 66, c, 4, LINE)
    s.text(x + 14, y + 178, "a palette with a point of view", 9.5, MUTED)

TELLS = {
    "harsh-gradients": (b_gradient, g_gradient), "default-lucide-icons-everywhere": (b_lucide, g_lucide), "pure-white-background": (b_white, g_white),
    "rainbow-colouring": (b_rainbow, g_rainbow), "heavy-default-drop-shadows": (b_shadow, g_shadow), "three-feature-cards-in-a-row": (b_three, g_three),
    "emojis-as-icons-or-bullets": (b_emoji, g_emoji), "liquid-glass": (b_glass, g_glass), "em-dashes-in-copy": (b_emdash, g_emdash),
    "default-inter-geist-space-grotesk": (b_font, g_font), "coloured-left-stripe-on-cards": (b_stripe, g_stripe), "fake-testimonials": (b_fakequotes, g_fakequotes),
    "bento-grids-by-default": (b_bento, g_bento), "terminal-window-mock-up-in-the-hero": (b_terminal, g_terminal), "it-s-not-x-it-s-y-copy": (b_notx, g_notx),
    "checkmark-bullet-lists": (b_checks, g_checks), "three-pricing-tiers-by-reflex": (b_pricing, g_pricing), "no-real-product-demos": (b_nodemo, g_nodemo),
    "soft-corner-radius-on-everything": (b_radius, g_radius), "purple-and-black-palette": (b_purple, g_purple), "no-skeleton-loaders": (b_skel, g_skel),
    "radial-gradient-orbs": (b_orbs, g_orbs), "dot-grid-backgrounds": (b_dots, g_dots), "sparkle-icons": (b_sparkle, g_sparkle),
    "animated-arrows-on-every-button": (b_arrow, g_arrow), "no-terms-of-service": (b_nolegal, g_terms), "no-privacy-policy": (b_nolegal, g_privacy),
    "hover-animations-on-everything": (b_hover, g_hover), "neon-colours": (b_neon, g_neon), "basic-pastel-colours": (b_pastel, g_pastel),
}


def tell_svg(name, bad, good):
    s = Svg(480, 252, "#efe8da", title="%s: avoid (left) and instead (right)" % name)
    tag(s, 14, 8, "AVOID", ACCENT); tag(s, 250, 8, "INSTEAD", OK)
    bad(s, 10, 34); good(s, 245, 34)
    return s.render()
