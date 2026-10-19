import crypto from "node:crypto";
import { serveStatic } from "./static.js";
import { clientIp, hashIp, createRateLimiter } from "./limits.js";
import { EVENTS, KINDS, istDay } from "../store/events.js";

const BOT_UA = /bot|crawl|spider|slurp|headless|lighthouse|curl|wget|python-requests|facebookexternalhit|monitor|uptime|preview/i;
const EMAIL = /^[^\s@]{1,64}@[^\s@]{1,190}\.[^\s@]{2,}$/;
const DECISION_EXCLUDED = ["me", "friends"]; // the owner's and friends' visits never count toward a pass or stop decision
const TOKEN_TTL_MS = 6 * 3600_000;
const MAX_TOKENS = 50_000;

class HttpError extends Error {
  constructor(status, code, message) { super(message); this.status = status; this.code = code; }
}

function readJson(req, limit = 2048) {
  return new Promise((resolve, reject) => {
    if (!/^application\/json\b/i.test(req.headers["content-type"] ?? "")) return reject(new HttpError(415, "unsupported_media_type", "Send JSON"));
    let size = 0; let tooLarge = false; const chunks = [];
    // On overflow keep the connection open long enough to send the 413, discard the rest, and close afterwards.
    req.on("data", (c) => { size += c.length; if (size > limit) { if (!tooLarge) { tooLarge = true; chunks.length = 0; reject(new HttpError(413, "too_large", "Request body too large")); } } else if (!tooLarge) chunks.push(c); });
    req.on("end", () => {
      if (tooLarge) return;
      try { const v = JSON.parse(Buffer.concat(chunks).toString("utf8") || "null"); resolve(v && typeof v === "object" && !Array.isArray(v) ? v : (() => { throw 0; })()); }
      catch { reject(new HttpError(400, "invalid_json", "Request body is not a valid JSON object")); }
    });
    req.on("error", () => reject(new HttpError(400, "invalid_request", "Could not read the request")));
  });
}

const sameSecret = (a, b) => {
  const x = crypto.createHash("sha256").update(String(a)).digest();
  const y = crypto.createHash("sha256").update(String(b)).digest();
  return crypto.timingSafeEqual(x, y);
};

/** Ratios exactly as defined in docs/system-design.md section 8, computed only from sources that count toward decisions. */
export function summarise(snapshot, { waitlistCount, minGenerates = 100 }) {
  const totals = {}; const decision = {};
  for (const day of Object.values(snapshot)) for (const [src, evs] of Object.entries(day)) for (const [ev, n] of Object.entries(evs)) {
    (totals[src] ??= {})[ev] = (totals[src][ev] ?? 0) + n;
    if (!DECISION_EXCLUDED.includes(src)) decision[ev] = (decision[ev] ?? 0) + n;
  }
  const d = (k) => decision[k] ?? 0;
  const ratio = (a, b) => (b > 0 ? Number((a / b).toFixed(4)) : null);
  const sends = d("open_whatsapp") + d("open_email");
  const rates = {
    generateRate: ratio(d("generate"), d("page_ready")),
    payIntentRate: ratio(d("pay_intent"), d("generate")),
    waitlistRate: ratio(d("waitlist_submit"), d("pay_intent")),
    useRate: ratio(d("sent_yes"), sends),
  };
  return {
    note: "Page loads stand in for visitors (no cookies). Days are IST dates. Sources me and friends are excluded from decision numbers.",
    perDay: snapshot, bySource: totals, decisionCounts: decision, rates,
    waitlistEntries: waitlistCount,
    passChecks: {
      enoughTraffic: d("generate") >= minGenerates,
      payIntentAtLeast5pct: rates.payIntentRate !== null && rates.payIntentRate >= 0.05,
      waitlistAtLeast20: d("waitlist_submit") >= 20,
      useRateAtLeast40pct: rates.useRate !== null && rates.useRate >= 0.4,
    },
  };
}

/** Request routing only. Product logic lives in src/core (in the browser), disk access in src/store. */
export function createHandler({ config, publicDir, coreDir, events, waitlist }) {
  const tokens = new Map(); // load token -> { at, seen:Set }
  const sweep = setInterval(() => { const now = Date.now(); for (const [t, v] of tokens) if (now - v.at > TOKEN_TTL_MS) tokens.delete(t); }, 600_000);
  sweep.unref();
  const eventLimit = createRateLimiter({ windowMs: 3600_000, max: 400 });
  const loadLimit = createRateLimiter({ windowMs: 3600_000, max: 120 });
  const waitlistLimit = createRateLimiter({ windowMs: 3600_000, max: 5 });
  const authFailLimit = createRateLimiter({ windowMs: 3600_000, max: 20 });
  const srcOf = (v) => (typeof v === "string" && config.ALLOWED_SRC.includes(v) ? v : "none");

  const json = (res, status, body, extra = {}) => {
    const payload = JSON.stringify(body);
    res.writeHead(status, { "content-type": "application/json; charset=utf-8", "content-length": Buffer.byteLength(payload), ...extra });
    res.end(payload);
  };
  const requireHeader = (req) => { if (req.headers["x-requested-by"] !== "chaser") throw new HttpError(403, "forbidden", "Missing request header"); };

  async function handle(req, res) {
    const url = new URL(req.url, "http://localhost");
    const route = `${req.method} ${url.pathname}`;
    const ipKey = hashIp(clientIp(req, config.TRUST_PROXY));

    if (route === "GET /api/health/live") return json(res, 200, { status: "ok" });
    if (route === "GET /api/health") return json(res, 200, { status: "ok", checks: { config: "ok" } });

    if (route === "GET /api/config") {
      return json(res, 200, {
        priceInr: config.PRICE_INR, waitlistEnabled: config.WAITLIST_ENABLED,
        operatorName: config.WAITLIST_ENABLED ? config.OPERATOR_NAME : null,
        operatorContact: config.WAITLIST_ENABLED ? config.OPERATOR_CONTACT : null,
        endDate: config.WAITLIST_ENABLED ? config.TEST_END_DATE : null,
        noticeVersion: config.NOTICE_VERSION,
      });
    }

    if (route === "POST /api/event") {
      requireHeader(req);
      const body = await readJson(req);
      if (!EVENTS.includes(body.event)) throw new HttpError(400, "invalid_event", "Unknown event");
      if (body.kind !== undefined && !KINDS.includes(body.kind)) throw new HttpError(400, "invalid_kind", "Unknown message kind");
      const ignored = (reason) => json(res, 202, { counted: false, reason });
      if (BOT_UA.test(req.headers["user-agent"] ?? "")) return ignored("bot");
      if (!eventLimit.take(ipKey)) throw new HttpError(429, "rate_limited", "Too many requests");
      const src = srcOf(body.src);
      if (body.event === "page_ready") {
        if (!loadLimit.take(ipKey)) return ignored("rate_limited");
        if (tokens.size >= MAX_TOKENS) tokens.delete(tokens.keys().next().value);
        const token = crypto.randomBytes(16).toString("hex");
        tokens.set(token, { at: Date.now(), seen: new Set() });
        events.record("page_ready", src);
        return json(res, 200, { counted: true, token });
      }
      const t = typeof body.token === "string" ? tokens.get(body.token) : undefined;
      if (!t) return ignored("no_page_ready");
      const key = `${body.event}:${body.kind ?? ""}`;
      if (t.seen.has(key)) return ignored("duplicate");
      t.seen.add(key);
      if (body.event === "waitlist_submit") return ignored("use_waitlist_endpoint"); // counted only by the waitlist endpoint
      events.record(body.event, src);
      return json(res, 202, { counted: true });
    }

    if (route === "POST /api/waitlist") {
      requireHeader(req);
      if (!config.WAITLIST_ENABLED) throw new HttpError(503, "waitlist_unavailable", "The waitlist is not open");
      const body = await readJson(req);
      if (typeof body.website === "string" && body.website !== "") return json(res, 202, { ok: true }); // honeypot: pretend success
      if (!waitlistLimit.take(ipKey)) throw new HttpError(429, "rate_limited", "Too many attempts. Try again later.");
      const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
      if (email.length > 254 || !EMAIL.test(email)) throw new HttpError(400, "invalid_email", "Enter a valid email address");
      const src = srcOf(body.src);
      const added = waitlist.add({ email, src, noticeVersion: config.NOTICE_VERSION });
      const t = typeof body.token === "string" ? tokens.get(body.token) : undefined;
      if (added && t && !t.seen.has("waitlist_submit:")) { t.seen.add("waitlist_submit:"); events.record("waitlist_submit", src); }
      return json(res, 202, { ok: true }); // same answer whether or not the address was already there
    }

    if (route === "GET /api/stats") {
      const m = /^Bearer (.+)$/.exec(req.headers.authorization ?? "");
      if (!m || !sameSecret(m[1], config.OPERATOR_TOKEN)) {
        // Only failed attempts count toward the limit, so the operator is never locked out by their own reads.
        if (!authFailLimit.take(ipKey)) throw new HttpError(429, "rate_limited", "Too many attempts");
        return json(res, 401, { error: { code: "unauthenticated", message: "Operator token required" } }, { "www-authenticate": "Bearer" });
      }
      return json(res, 200, summarise(events.snapshot(), { waitlistCount: waitlist.count() }));
    }

    if (req.method === "GET" && url.pathname.startsWith("/core/") && serveStatic(coreDir, url.pathname.slice("/core".length), res)) return;
    if (req.method === "GET" && serveStatic(publicDir, url.pathname, res)) return;
    throw new HttpError(404, "not_found", "Not found");
  }

  return (req, res) => {
    handle(req, res).catch((err) => {
      if (res.headersSent) return res.end();
      if (err instanceof HttpError) return json(res, err.status, { error: { code: err.code, message: err.message } }, err.status === 413 ? { connection: "close" } : {});
      console.error(JSON.stringify({ level: "error", msg: "unhandled_error", error: err.message }));
      json(res, 500, { error: { code: "internal_error", message: "Something went wrong" } });
    });
  };
}
