"""Tiny SVG drawing helpers for the generated previews (build_previews.py). Standard library only."""
from xml.sax.saxutils import escape

GROUND, INK, MUTED, LINE = "#f4efe6", "#1b1713", "#8b8176", "#d9d0c1"
ACCENT, OK, WARN, PAPER = "#c2410c", "#1f7a4d", "#b7791f", "#fffdf8"
FONT = "ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif"
MONO = "ui-monospace,SFMono-Regular,Menlo,Consolas,monospace"


class Svg:
    def __init__(self, w=480, h=270, bg=None, title=""):
        self.w, self.h, self.parts, self.defs, self.n, self.title = w, h, [], [], 0, title
        if bg:
            self.rect(0, 0, w, h, bg)

    def uid(self, p="g"):
        self.n += 1
        return "%s%d" % (p, self.n)

    def add(self, s):
        self.parts.append(s)
        return self

    def rect(self, x, y, w, h, fill="none", r=0, stroke=None, sw=1, op=None, extra=""):
        a = ' stroke="%s" stroke-width="%s"' % (stroke, sw) if stroke else ""
        o = ' opacity="%s"' % op if op is not None else ""
        return self.add('<rect x="%s" y="%s" width="%s" height="%s" rx="%s" fill="%s"%s%s %s/>' % (x, y, w, h, r, fill, a, o, extra))

    def circle(self, cx, cy, r, fill="none", stroke=None, sw=1, op=None):
        a = ' stroke="%s" stroke-width="%s"' % (stroke, sw) if stroke else ""
        o = ' opacity="%s"' % op if op is not None else ""
        return self.add('<circle cx="%s" cy="%s" r="%s" fill="%s"%s%s/>' % (cx, cy, r, fill, a, o))

    def line(self, x1, y1, x2, y2, stroke=INK, sw=1.5, dash=None, cap="round"):
        d = ' stroke-dasharray="%s"' % dash if dash else ""
        return self.add('<line x1="%s" y1="%s" x2="%s" y2="%s" stroke="%s" stroke-width="%s" stroke-linecap="%s"%s/>' % (x1, y1, x2, y2, stroke, sw, cap, d))

    def path(self, d, fill="none", stroke=None, sw=1.5, op=None):
        a = ' stroke="%s" stroke-width="%s" stroke-linecap="round" stroke-linejoin="round"' % (stroke, sw) if stroke else ""
        o = ' opacity="%s"' % op if op is not None else ""
        return self.add('<path d="%s" fill="%s"%s%s/>' % (d, fill, a, o))

    def text(self, x, y, s, size=13, fill=INK, weight=400, anchor="start", font=FONT, op=None, ls=None):
        o = ' opacity="%s"' % op if op is not None else ""
        l = ' letter-spacing="%s"' % ls if ls else ""
        return self.add('<text x="%s" y="%s" font-family="%s" font-size="%s" font-weight="%s" fill="%s" text-anchor="%s"%s%s>%s</text>' % (x, y, font, size, weight, fill, anchor, o, l, escape(str(s))))

    def lines(self, x, y, widths, h=7, gap=6, fill=LINE, r=3):
        for i, w in enumerate(widths):
            self.rect(x, y + i * (h + gap), w, h, fill, r)
        return self

    def grad(self, stops, x2=1, y2=1):
        gid = self.uid("lg")
        s = "".join('<stop offset="%s" stop-color="%s"/>' % (o, c) for o, c in stops)
        self.defs.append('<linearGradient id="%s" x1="0" y1="0" x2="%s" y2="%s">%s</linearGradient>' % (gid, x2, y2, s))
        return "url(#%s)" % gid

    def radial(self, color, op=0.9):
        gid = self.uid("rg")
        self.defs.append('<radialGradient id="%s"><stop offset="0" stop-color="%s" stop-opacity="%s"/><stop offset="1" stop-color="%s" stop-opacity="0"/></radialGradient>' % (gid, color, op, color))
        return "url(#%s)" % gid

    def shadow(self, blur=8, dy=6, op=0.45):
        gid = self.uid("sh")
        self.defs.append('<filter id="%s" x="-30%%" y="-30%%" width="160%%" height="170%%"><feDropShadow dx="0" dy="%s" stdDeviation="%s" flood-color="#000" flood-opacity="%s"/></filter>' % (gid, dy, blur, op))
        return 'filter="url(#%s)"' % gid

    def group(self, x, y, inner, scale=1):
        self.add('<g transform="translate(%s %s) scale(%s)">' % (x, y, scale))
        inner(self)
        self.add("</g>")
        return self

    def render(self):
        t = "<title>%s</title>" % escape(self.title) if self.title else ""
        return ('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 %s %s" width="%s" height="%s" role="img">%s<defs>%s</defs>%s</svg>\n'
                % (self.w, self.h, self.w, self.h, t, "".join(self.defs), "".join(self.parts)))


def tag(s, x, y, label, color):
    s.rect(x, y, len(label) * 7.2 + 14, 18, color, 9)
    s.text(x + 7, y + 13, label, 10.5, "#fff", 700, ls="0.06em")


def check(s, x, y, color=OK, size=9):
    s.path("M%s %s l%s %s l%s %s" % (x, y, size * .4, size * .45, size * .75, -size * .9), stroke=color, sw=2)


def cross(s, x, y, color=ACCENT, size=8):
    s.path("M%s %s l%s %s M%s %s l%s %s" % (x, y, size, size, x + size, y, -size, size), stroke=color, sw=2)


def arrow(s, x1, y1, x2, y2, color=MUTED, sw=1.6):
    s.line(x1, y1, x2, y2, color, sw)
    import math
    a = math.atan2(y2 - y1, x2 - x1)
    for d in (2.6, -2.6):
        s.line(x2, y2, x2 - 8 * math.cos(a + d * 0.2 - 0), y2 - 8 * math.sin(a + d * 0.2), color, sw)


def box(s, x, y, w, h, label, fill=PAPER, stroke=LINE, ink=INK, size=11.5, bold=False):
    s.rect(x, y, w, h, fill, 9, stroke, 1.4)
    s.text(x + w / 2, y + h / 2 + size * 0.35, label, size, ink, 700 if bold else 500, "middle")


def browser(s, x, y, w, h, url="", fill=PAPER):
    s.rect(x, y, w, h, fill, 10, LINE, 1.4)
    s.rect(x, y, w, 22, "#ece5d8", 10)
    s.rect(x, y + 12, w, 10, "#ece5d8")
    for i, c in enumerate(("#e5736a", "#e8b64a", "#6cb36c")):
        s.circle(x + 12 + i * 12, y + 11, 3.2, c)
    if url:
        s.rect(x + 54, y + 5, w - 70, 12, "#fffdf8", 6)
        s.text(x + 62, y + 14.5, url, 8, MUTED, font=MONO)


def phone(s, x, y, w=70, h=130, fill=PAPER):
    s.rect(x, y, w, h, fill, 12, INK, 2)
    s.rect(x + w / 2 - 10, y + 5, 20, 3.5, INK, 2)
