"""A small diagram for each of the 111 production concepts (see catalog_data.CONCEPTS). Drawn from scratch."""
import math
from preview_svg import *

CW, CH = 480, 210


def canvas(title):
    return Svg(CW, CH, "#efe8da", title=title)


def nodes_row(s, labels, y=84, h=46, hl=None, pad=22, gap=26):
    n = len(labels)
    w = (CW - 2 * pad - gap * (n - 1)) / n
    xs = []
    for i, lab in enumerate(labels):
        x = pad + i * (w + gap)
        box(s, x, y, w, h, lab, ACCENT if i == hl else PAPER, ACCENT if i == hl else LINE, "#fff" if i == hl else INK, 10.5 if len(lab) > 14 else 11.5, i == hl)
        xs.append(x)
    for i in range(n - 1):
        arrow(s, xs[i] + w + 3, y + h / 2, xs[i + 1] - 3, y + h / 2, MUTED, 1.8)
    return xs, w


def chain(s, labels, hl=None):
    nodes_row(s, labels, hl=hl)


def fan(s, src, targets, mid=None):
    n = len(targets)
    ys = [30 + i * (150 / max(1, n - 1)) if n > 1 else 105 for i in range(n)]
    box(s, 16, 84, 90, 42, src, PAPER, LINE, INK, 11)
    tx = 330
    mx = 150
    if mid:
        box(s, mx, 84, 100, 42, mid, ACCENT, ACCENT, "#fff", 11, True)
        arrow(s, 108, 105, mx - 2, 105)
        sx = mx + 100
    else:
        sx = 108
    for y, t in zip(ys, targets):
        box(s, tx, y - 17, 130, 34, t, PAPER, LINE, INK, 10.5)
        arrow(s, sx + 2, 105, tx - 3, y)


def gate(s, src, gate_label, dst, blocked):
    box(s, 16, 84, 90, 42, src)
    s.path("M200 70 l36 0 l0 34 q0 22 -18 30 q-18 -8 -18 -30 z", ACCENT)
    s.text(218, 90, "✓", 14, "#fff", 700, "middle"); s.text(218, 160, gate_label, 10.5, INK, 700, "middle")
    arrow(s, 108, 105, 196, 105); arrow(s, 240, 105, 350, 105); box(s, 352, 84, 106, 42, dst, PAPER, OK, INK)
    arrow(s, 218, 138, 218, 172, ACCENT); box(s, 150, 174, 136, 28, blocked, "#fbe3d8", ACCENT, ACCENT, 10, True)


def loop(s, labels):
    box(s, 30, 84, 110, 46, labels[0]); box(s, 190, 84, 110, 46, labels[1], "#fbe3d8", ACCENT, ACCENT, 11.5, True)
    arrow(s, 142, 107, 188, 107); s.path("M245 82 C245 34 85 34 85 82", stroke=ACCENT, sw=2); arrow(s, 85, 78, 85, 82, ACCENT, 2)
    s.text(165, 40, labels[2], 11.5, ACCENT, 700, "middle"); box(s, 340, 84, 110, 46, "Success", PAPER, OK, INK); arrow(s, 302, 107, 338, 107, OK)


def backoff(s):
    s.line(24, 120, 456, 120, MUTED, 2)
    xs = [40, 84, 150, 262, 430]
    for i, x in enumerate(xs):
        s.circle(x, 120, 8, ACCENT if i else INK); s.text(x, 100, "try %d" % (i + 1), 9.5, INK, 600, "middle")
        if i:
            s.text((xs[i - 1] + x) / 2, 146, "wait %ds" % (2 ** (i - 1)), 9.5, MUTED, anchor="middle")
    s.text(240, 186, "waits double each time (plus jitter)", 11, MUTED, anchor="middle")


def states(s, labels):
    cols = [OK, ACCENT, WARN]
    for i, lab in enumerate(labels):
        x = 24 + i * 156; s.rect(x, 80, 124, 54, cols[i], 12); s.text(x + 62, 112, lab, 12.5, "#fff", 700, "middle")
        if i < 2: arrow(s, x + 126, 107, x + 154, 107, MUTED, 2)
    s.path("M70 78 C70 40 350 40 350 78", stroke=MUTED, sw=1.6); arrow(s, 350, 74, 350, 78, MUTED)
    s.text(210, 52, "success closes it again", 10, MUTED, anchor="middle")


def timeline(s, events, mark=None):
    s.line(26, 108, 454, 108, MUTED, 2); n = len(events)
    for i, e in enumerate(events):
        x = 40 + i * (400 / max(1, n - 1)); hot = (mark == i)
        s.circle(x, 108, 7, ACCENT if hot else INK); s.text(x, 140 if i % 2 == 0 else 84, e, 10, ACCENT if hot else INK, 600, "middle")


def compare(s, lt, ll, rt, rl, style="badgood"):
    tones = {"badgood": (ACCENT, OK), "neutral": ("#6b6258", "#3d3a8c"), "goodbad": (OK, ACCENT)}[style]
    for k, (t, ls, ok) in enumerate(((lt, ll, False), (rt, rl, True))):
        c = tones[1 if ok else 0]
        x = 14 + k * 238; s.rect(x, 14, 224, 182, PAPER, 10, LINE, 1.4); s.rect(x, 14, 224, 30, c, 10); s.rect(x, 30, 224, 14, c)
        s.text(x + 12, 34, t, 12, "#fff", 700)
        for i, line in enumerate(ls[:5]):
            s.text(x + 14, 72 + i * 26, line, 11, INK, 500, font=MONO if "_" in line or "(" in line else FONT)


def bars(s, labels, vals, hl=None, unit=""):
    top = max(vals); n = len(vals); w = min(70, 360 / n - 14)
    for i, (l, v) in enumerate(zip(labels, vals)):
        x = 60 + i * (380 / n); h = 120 * v / top
        s.rect(x, 170 - h, w, h, ACCENT if i == hl else "#cfc6b8", 5); s.text(x + w / 2, 186, l, 10.5, INK, 600, "middle"); s.text(x + w / 2, 164 - h, "%s%s" % (v, unit), 10.5, INK, 700, "middle")
    s.line(40, 170, 452, 170, MUTED, 1.4)


def shards(s, top, subs):
    box(s, 170, 18, 140, 44, top, ACCENT, ACCENT, "#fff", 11.5, True); n = len(subs)
    for i, t in enumerate(subs):
        x = 24 + i * (432 / n); w = 432 / n - 16; box(s, x, 130, w, 52, t, PAPER, LINE, INK, 10.5); arrow(s, 240, 64, x + w / 2, 128)


def layers(s, labels):
    n = len(labels); h = 150 / n
    for i, t in enumerate(labels):
        y = 24 + i * (h + 4); s.rect(110 - i * 0, y, 260, h, PAPER if i % 2 else "#f7efe0", 8, LINE, 1.3); s.text(240, y + h / 2 + 4, t, 12, INK, 600, "middle")


def cache(s):
    box(s, 16, 84, 76, 42, "Request"); box(s, 168, 28, 100, 42, "Cache", ACCENT, ACCENT, "#fff", 12, True); box(s, 360, 84, 100, 42, "Database", PAPER, LINE)
    arrow(s, 94, 98, 166, 56); s.text(116, 60, "hit: fast", 10, OK, 700); arrow(s, 94, 114, 358, 108); s.text(228, 124, "miss: slow, then store", 10, ACCENT, 700, "middle")
    arrow(s, 168, 50, 94, 90, OK)


def triangle(s):
    pts = [(240, 24), (110, 180), (370, 180)]
    s.path("M240 24 L110 180 L370 180 Z", PAPER, LINE, 2)
    for (x, y), t in zip(pts, ["Consistency", "Availability", "Partition tolerance"]):
        s.circle(x, y, 9, ACCENT); s.text(x, y - 16 if y < 100 else y + 24, t, 11.5, INK, 700, "middle")
    s.text(240, 120, "pick two", 13, MUTED, 600, "middle")


def leader(s):
    for i, (x, y) in enumerate([(240, 40), (130, 140), (350, 140)]):
        s.circle(x, y, 28, ACCENT if i == 0 else PAPER, ACCENT if i == 0 else LINE, 2); s.text(x, y + 4, "node %d" % (i + 1), 10.5, "#fff" if i == 0 else INK, 700, "middle")
    s.text(240, 14, "★ leader", 10.5, ACCENT, 700, "middle"); s.line(214, 60, 150, 118, MUTED, 1.6, "4 4"); s.line(266, 60, 330, 118, MUTED, 1.6, "4 4")


def deadlock(s):
    box(s, 40, 40, 150, 46, "Tx A holds row 1", PAPER, LINE); box(s, 290, 40, 150, 46, "Tx B holds row 2", PAPER, LINE)
    box(s, 40, 130, 150, 46, "A wants row 2", "#fbe3d8", ACCENT, ACCENT); box(s, 290, 130, 150, 46, "B wants row 1", "#fbe3d8", ACCENT, ACCENT)
    arrow(s, 115, 132, 115, 88, ACCENT); arrow(s, 365, 132, 365, 88, ACCENT); s.line(192, 150, 288, 70, ACCENT, 1.6); s.line(288, 150, 192, 70, ACCENT, 1.6); s.text(240, 112, "stuck", 12, ACCENT, 700, "middle")


def spark(s, vals, color=ACCENT, label=""):
    n = len(vals); top = max(vals); pts = ["%s,%s" % (40 + i * 400 / (n - 1), 170 - 130 * v / top) for i, v in enumerate(vals)]
    s.path("M" + " L".join(pts), stroke=color, sw=2.6); s.line(40, 170, 450, 170, MUTED, 1.2); s.line(40, 30, 40, 170, MUTED, 1.2)
    if label: s.text(246, 196, label, 10.5, MUTED, anchor="middle")


def toggle(s):
    for i, (n, on) in enumerate([("new-checkout", True), ("beta-search", False), ("dark-mode", True)]):
        y = 28 + i * 54; s.rect(60, y, 360, 42, PAPER, 8, LINE); s.text(78, y + 26, n, 12, INK, 600, font=MONO)
        s.rect(350, y + 9, 54, 24, OK if on else "#cfc6b8", 12); s.circle(392 if on else 362, y + 21, 9, "#fff")


def bluegreen(s):
    box(s, 20, 84, 76, 42, "Users"); box(s, 190, 28, 120, 44, "Blue (v1) live", PAPER, OK, INK, 11, True); box(s, 190, 140, 120, 44, "Green (v2) ready", PAPER, LINE, INK, 11)
    arrow(s, 98, 98, 188, 52, OK, 2.2); arrow(s, 98, 114, 188, 160, MUTED, 1.4); s.text(400, 108, "switch =", 11, MUTED, anchor="middle"); s.text(400, 126, "instant", 11, ACCENT, 700, "middle")


def split(s):
    s.rect(30, 70, 420, 40, "#cfc6b8", 6); s.rect(30, 70, 40, 40, ACCENT, 6); s.text(50, 95, "5%", 12, "#fff", 700, "middle"); s.text(260, 95, "95% on the current version", 12, INK, 600, "middle")
    s.text(50, 58, "new version", 10.5, ACCENT, 700, "middle"); s.text(240, 150, "watch errors, then widen the share", 11.5, MUTED, anchor="middle")


def rolling(s):
    for r, states_ in enumerate([("v1", "v1", "v1", "v1"), ("v2", "v1", "v1", "v1"), ("v2", "v2", "v1", "v1"), ("v2", "v2", "v2", "v2")]):
        for i, v in enumerate(states_):
            s.rect(40 + i * 100, 24 + r * 44, 84, 32, ACCENT if v == "v2" else PAPER, 8, LINE); s.text(82 + i * 100, 45 + r * 44, v, 12, "#fff" if v == "v2" else INK, 700, "middle")


def logs(s):
    s.rect(30, 24, 420, 160, "#14110f", 10)
    for i, (c, t) in enumerate([("#8fbf8f", '{"level":"info","req":"a91","path":"/pay"}'), ("#8fbf8f", '{"level":"info","req":"a91","ms":84}'), ("#e8b64a", '{"level":"warn","req":"b02","msg":"slow query"}'), ("#e5736a", '{"level":"error","req":"c77","code":"E_TIMEOUT"}')]):
        s.text(44, 54 + i * 32, t, 10, c, font=MONO)


def trace(s):
    for i, (n, x, w, c) in enumerate([("GET /order", 40, 380, INK), ("auth", 60, 60, "#8b8176"), ("db query", 130, 190, ACCENT), ("payment API", 200, 180, "#b7791f"), ("email", 340, 60, "#8b8176")]):
        s.rect(x, 28 + i * 32, w, 20, c, 5); s.text(x + 6, 43 + i * 32, n, 10, "#fff", 600)


def gauge(s):
    s.path("M90 160 A150 150 0 0 1 390 160", stroke="#cfc6b8", sw=22); s.path("M90 160 A150 150 0 0 1 366 104", stroke=OK, sw=22)
    s.text(240, 150, "99.9%", 34, INK, 800, "middle"); s.text(240, 178, "target: 43 min down per month", 11, MUTED, anchor="middle")


def partition(s):
    for x, t in ((40, "Cluster A"), (290, "Cluster B")):
        s.rect(x, 50, 150, 100, PAPER, 12, LINE, 1.6); s.text(x + 75, 76, t, 12, INK, 700, "middle")
        for j in range(3): s.circle(x + 30 + j * 45, 118, 12, "#cfc6b8")
    s.line(192, 100, 288, 100, ACCENT, 2, "6 5"); cross(s, 232, 92, ACCENT, 16); s.text(240, 150, "link down", 11, ACCENT, 700, "middle")


def multiplex(s):
    s.text(20, 28, "HTTP/1.1: one at a time", 11, MUTED)
    for i in range(3): s.rect(20 + i * 100, 36, 92, 18, "#cfc6b8", 4)
    s.text(20, 100, "HTTP/2 and 3: together on one connection", 11, OK, 700)
    for i in range(3): s.rect(20, 110 + i * 24, 120 + i * 90, 16, ACCENT if i == 0 else "#d98a4e", 4)


def semver(s):
    for i, (n, t, c) in enumerate([("2", "major: breaking", ACCENT), ("4", "minor: new, compatible", WARN), ("1", "patch: fixes", OK)]):
        x = 36 + i * 148; s.text(x + 30, 100, n, 56, c, 800, "middle"); s.text(x + 30, 130, t, 10.5, INK, 600, "middle")
        if i < 2: s.text(x + 82, 100, ".", 56, MUTED, 800, "middle")


def tree(s):
    box(s, 190, 14, 100, 34, "your app", ACCENT, ACCENT, "#fff", 11.5, True)
    for x, t in ((60, "lib A"), (330, "lib B")):
        box(s, x, 84, 90, 34, t); arrow(s, 240, 50, x + 45, 82)
    box(s, 36, 152, 130, 34, "needs shared v1", "#fbe3d8", ACCENT, ACCENT, 10); box(s, 306, 152, 130, 34, "needs shared v2", "#fbe3d8", ACCENT, ACCENT, 10)
    arrow(s, 105, 120, 100, 150); arrow(s, 375, 120, 370, 150); s.text(240, 172, "≠", 22, ACCENT, 800, "middle")


def saga(s):
    nodes_row(s, ["Reserve stock", "Charge card", "Ship"], y=40, h=42)
    for i in range(2):
        x = 22 + (2 - i) * 162 - 16; arrow(s, x + 70, 150, x - 80, 150, ACCENT, 1.6)
    s.text(240, 128, "if a step fails, run the undo steps backwards", 11, ACCENT, 700, "middle"); s.text(240, 178, "refund  ←  release stock", 11, MUTED, anchor="middle", font=MONO)


def duplex(s, a, b):
    box(s, 30, 84, 120, 46, a); box(s, 330, 84, 120, 46, b); arrow(s, 152, 96, 328, 96, OK, 2.4); arrow(s, 328, 118, 152, 118, OK, 2.4); s.text(240, 150, "messages both ways, one open connection", 11, MUTED, anchor="middle")


def stream(s):
    box(s, 30, 84, 120, 46, "Server"); box(s, 330, 84, 120, 46, "Browser")
    for i in range(5): s.circle(170 + i * 32, 107, 7, ACCENT); 
    arrow(s, 156, 107, 326, 107, MUTED, 1.4); s.text(240, 150, "events pushed over plain HTTP", 11, MUTED, anchor="middle")


def percentile(s, vals):
    bars(s, ["p50", "p95", "p99"], vals, hl=2, unit=" ms")


def dash(s):
    for i, (t, v, c) in enumerate([("requests/s", "412", INK), ("errors", "0.3%", OK), ("p95", "180ms", INK)]):
        x = 24 + i * 150; s.rect(x, 24, 136, 62, PAPER, 8, LINE); s.text(x + 12, 46, t, 10.5, MUTED); s.text(x + 12, 74, v, 22, c, 800)
    spark(s, [3, 4, 3, 5, 4, 6, 5, 7, 6, 8], OK)


KIND = {}


def render(name, spec):
    s = canvas(name)
    k, a = spec[0], spec[1:]
    {"chain": chain, "fan": fan, "gate": gate, "loop": loop, "backoff": lambda s: backoff(s), "states": states, "timeline": timeline, "compare": compare,
     "bars": bars, "shards": shards, "layers": layers, "cache": lambda s: cache(s), "triangle": lambda s: triangle(s), "leader": lambda s: leader(s),
     "deadlock": lambda s: deadlock(s), "spark": spark, "toggle": lambda s: toggle(s), "bluegreen": lambda s: bluegreen(s), "split": lambda s: split(s),
     "rolling": lambda s: rolling(s), "logs": lambda s: logs(s), "trace": lambda s: trace(s), "gauge": lambda s: gauge(s), "partition": lambda s: partition(s),
     "multiplex": lambda s: multiplex(s), "semver": lambda s: semver(s), "tree": lambda s: tree(s), "saga": lambda s: saga(s), "duplex": duplex,
     "stream": lambda s: stream(s), "percentile": percentile, "dash": lambda s: dash(s)}[k](s, *a)
    return s.render()


V = {
    "Rate limiting": ("gate", "Requests", "Rate limit", "API", "429 Too Many Requests"),
    "Caching": ("cache",),
    "Load balancing": ("fan", "Users", ["Server A", "Server B", "Server C"], "Balancer"),
    "Reverse proxies": ("chain", ["Browser", "Proxy: TLS, limits", "App server"], 1),
    "API gateways": ("fan", "Clients", ["Auth", "Billing", "Orders"], "Gateway"),
    "CI/CD": ("chain", ["Commit", "Build", "Test", "Deploy"], 2),
    "Docker": ("layers", ["Your app", "Runtime", "Base image", "Container engine"]),
    "Kubernetes": ("fan", "Deploy", ["Pod", "Pod", "Pod"], "Control plane"),
    "Service discovery": ("chain", ["Service A", "Registry", "Service B"], 1),
    "Circuit breakers": ("states", ["Closed", "Open", "Half-open"]),
    "Timeouts": ("timeline", ["send", "waiting", "waiting", "timeout 3s", "give up"], 3),
    "Retries": ("loop", ["Call", "Fails", "retry up to 3x"]),
    "Exponential backoff": ("backoff",),
    "Idempotency": ("compare", "No key", ["Pay £10", "Pay £10 again", "Charged twice"], "With key", ["Pay £10 (key k1)", "Repeat (key k1)", "Charged once"]),
    "Message queues": ("chain", ["Web request", "Queue", "Worker"], 1),
    "Pub/Sub": ("fan", "Publisher", ["Email", "Search index", "Analytics"], "Topic"),
    "Event-driven architecture": ("fan", "Order placed", ["Stock", "Email", "Invoice"], "Event bus"),
    "Distributed transactions": ("compare", "One database", ["BEGIN", "debit + credit", "COMMIT"], "Two services", ["Debit ok", "Credit fails", "Now what?"], "neutral"),
    "Saga pattern": ("saga",),
    "Dead letter queues": ("chain", ["Queue", "Worker fails 5x", "Dead letters"], 2),
    "Cron jobs": ("timeline", ["00:00 job", "06:00 job", "12:00 job", "18:00 job"], None),
    "WebSockets": ("duplex", "Browser", "Server"),
    "Long polling": ("chain", ["Request", "Server waits", "Response", "Ask again"], 1),
    "Server-sent events": ("stream",),
    "Database indexing": ("compare", "No index", ["scan 1,000,000 rows", "slow"], "Index", ["jump to 3 rows", "fast"]),
    "Query optimization": ("bars", ["before", "after"], [90, 12], 1, " ms"),
    "N+1 queries": ("compare", "N+1", ["1 query: 50 orders", "+50 queries: customers", "51 round trips"], "Joined", ["1 query with a join", "1 round trip"]),
    "Connection pooling": ("chain", ["Requests", "Pool of 10", "Database"], 1),
    "Read replicas": ("shards", "Primary: writes", ["Replica: reads", "Replica: reads"]),
    "Sharding": ("shards", "Router", ["Users A-H", "Users I-P", "Users Q-Z"]),
    "Partitioning": ("layers", ["orders_2026_10", "orders_2026_09", "orders_2026_08", "orders_2026_07"]),
    "Replication": ("chain", ["Primary", "copies changes", "Replica"], 1),
    "Leader election": ("leader",),
    "CAP theorem": ("triangle",),
    "Eventual consistency": ("timeline", ["write", "replica A old", "replica B old", "all agree"], 3),
    "Optimistic locking": ("compare", "Two editors", ["A saves v1 → v2", "B saves v1: conflict"], "Result", ["B reloads v2", "and retries"], "neutral"),
    "Pessimistic locking": ("chain", ["Lock row", "Update", "Unlock"], 0),
    "Distributed locks": ("chain", ["Worker A", "Lock (expires 30s)", "Worker B waits"], 1),
    "Race conditions": ("compare", "Check, then act", ["A reads stock=1", "B reads stock=1", "both buy: stock -1"], "Atomic", ["UPDATE ... WHERE stock>0", "one wins, one is told"]),
    "Deadlocks": ("deadlock",),
    "Memory leaks": ("spark", [2, 2.4, 3, 3.8, 4.8, 6, 7.4, 9], ACCENT, "memory climbs for days: restart is a stopgap"),
    "Garbage collection": ("timeline", ["run", "run", "GC pause", "run"], 2),
    "Thread safety": ("compare", "Shared counter", ["T1 reads 5", "T2 reads 5", "both write 6"], "Guarded", ["lock or atomic add", "result 7"]),
    "Backpressure": ("chain", ["Producer", "Queue: full", "Consumer"], 1),
    "Autoscaling": ("bars", ["low", "mid", "high", "peak"], [2, 4, 8, 12], 3, " servers"),
    "Horizontal scaling": ("fan", "Balancer", ["Server", "Server", "Server", "+ more"]),
    "Vertical scaling": ("compare", "Small", ["2 CPU", "8 GB"], "Bigger", ["16 CPU", "64 GB", "has a ceiling"], "neutral"),
    "CDN": ("fan", "Origin", ["Edge: London", "Edge: New York", "Edge: Tokyo"]),
    "Edge caching": ("chain", ["User", "Edge cache", "Origin"], 1),
    "Cache invalidation": ("chain", ["Data changes", "Purge the key", "Fresh copy"], 1),
    "Feature flags": ("toggle",),
    "Blue-green deployment": ("bluegreen",),
    "Canary releases": ("split",),
    "Rolling deployments": ("rolling",),
    "Rollbacks": ("chain", ["v2 fails", "Roll back", "v1 live again"], 1),
    "Health checks": ("chain", ["Monitor", "GET /health", "DB + cache ok"], 1),
    "Liveness and readiness probes": ("compare", "Liveness", ["Is it alive?", "restart if not"], "Readiness", ["Ready for traffic?", "hold traffic if not"], "neutral"),
    "Monitoring": ("dash",),
    "Logging": ("logs",),
    "Distributed tracing": ("trace",),
    "Metrics": ("spark", [3, 4, 3, 5, 4, 6, 5, 7, 6, 8], OK, "requests per second"),
    "Alerts": ("chain", ["Error rate > 2%", "Alert fires", "Runbook + on-call"], 1),
    "SLOs": ("gauge",),
    "SLIs": ("chain", ["Good requests", "÷ all requests", "= 99.95%"], 2),
    "Error budgets": ("bars", ["allowed", "used"], [43, 12], 1, " min"),
    "Observability": ("layers", ["Logs", "Metrics", "Traces"]),
    "Secrets management": ("chain", ["App", "Secret store", "Key: never in code"], 1),
    "IAM": ("compare", "Too broad", ["admin for everyone"], "Least privilege", ["reports: read-only", "deploy: CI only"]),
    "OAuth": ("chain", ["User", "Provider login", "Token to your app"], 1),
    "JWT rotation": ("timeline", ["token 15 min", "refresh", "new token", "old revoked"], 2),
    "TLS": ("chain", ["Browser", "encrypted: TLS", "Server"], 1),
    "Encryption at rest": ("layers", ["App", "Database (encrypted)", "Disk (encrypted)"]),
    "Encryption in transit": ("chain", ["App", "TLS", "Database"], 1),
    "WAF": ("gate", "Traffic", "WAF", "App", "Blocked: SQL injection"),
    "DDoS protection": ("gate", "Flood", "Edge filter", "App", "Dropped at the edge"),
    "CORS": ("compare", "Allowed", ["app.example.com", "✓ may call the API"], "Blocked", ["evil.example", "✗ browser refuses"], "goodbad"),
    "CSRF": ("compare", "No token", ["evil page posts a form", "your bank accepts it"], "With token", ["form carries a token", "server checks it"]),
    "SQL injection": ("compare", "Unsafe", ["'... ' OR 1=1 --", "reads every row"], "Parameterised", ["WHERE id = $1", "input is only data"]),
    "XSS": ("compare", "Unsafe", ["<script>steal()</script>", "runs in the browser"], "Escaped", ["&lt;script&gt;...", "shown as text"]),
    "SSRF": ("gate", "User URL", "Allow-list", "Fetch", "Blocked: internal address"),
    "Database migrations": ("chain", ["Write migration", "Review", "Run in deploy"], 2),
    "Schema versioning": ("timeline", ["v1 code", "add column", "v1 + v2 work", "drop old"], 2),
    "Disaster recovery": ("chain", ["Disaster", "Restore backup", "Back in 1 h: tested"], 1),
    "Backups": ("chain", ["Database", "Nightly copy", "Off-site + restore test"], 2),
    "Failover": ("chain", ["Primary fails", "Replica promoted", "Traffic follows"], 1),
    "Multi-region deployment": ("fan", "Users", ["Europe", "US", "Asia"], "DNS"),
    "Chaos engineering": ("chain", ["Kill a node", "Watch", "Fix the weak spot"], 1),
    "Cost optimization": ("bars", ["before", "after"], [18, 6], 1, " £/user"),
    "Cold starts": ("timeline", ["idle", "request", "boot 800 ms", "answer"], 2),
    "Serverless limits": ("layers", ["Timeout 10 s", "Memory 1 GB", "Payload 6 MB", "Connections"]),
    "Latency": ("chain", ["Click", "waiting...", "Page in 320 ms"], 1),
    "Throughput": ("bars", ["1 instance", "2", "4"], [120, 240, 480], 2, " req/s"),
    "P99 latency": ("percentile", [80, 210, 900]),
    "Tail latency": ("percentile", [60, 140, 1800]),
    "Network partitions": ("partition",),
    "Clock skew": ("compare", "Server A", ["12:00:00"], "Server B", ["12:00:07", "7 s apart"], "neutral"),
    "DNS": ("chain", ["example.com", "DNS lookup", "93.184.216.34"], 1),
    "TCP vs UDP": ("compare", "TCP", ["ordered", "retried"], "UDP", ["fast", "may drop packets"], "neutral"),
    "HTTP/2 and HTTP/3": ("multiplex",),
    "gRPC": ("chain", ["Service A", "gRPC: typed", "Service B"], 1),
    "Webhooks": ("chain", ["Stripe event", "Your endpoint", "200 fast, process later"], 1),
    "API versioning": ("fan", "Client", ["/v1 (old apps)", "/v2 (new apps)"]),
    "Semantic versioning": ("semver",),
    "Infrastructure as code": ("chain", ["Code in git", "Plan", "Infrastructure"], 0),
    "Terraform": ("chain", ["main.tf", "terraform plan", "apply"], 1),
    "Helm charts": ("layers", ["Chart", "values.yaml", "Deployment"]),
    "Build caching": ("compare", "No cache", ["npm install", "3 minutes"], "Cache", ["restore", "8 seconds"]),
    "Dependency hell": ("tree",),
    "Production incidents": ("chain", ["Detect", "Mitigate", "Tell users", "Fix"], 1),
    "On-call": ("timeline", ["Mon: Ana", "Tue: Ben", "Wed: Chi", "Thu: Ana"], None),
    "Postmortems": ("chain", ["What happened", "Why", "What changes"], 2),
}
