import { HttpError } from "../errors.js";

/** Security headers. CSP allows only same-origin scripts and styles (no inline). */
export function securityHeaders({ production }) {
  return (_req, res, next) => {
    res.setHeader("Content-Security-Policy", "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'");
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Referrer-Policy", "no-referrer");
    res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
    res.setHeader("Cache-Control", "no-store");
    if (production) res.setHeader("Strict-Transport-Security", "max-age=63072000; includeSubDomains");
    next();
  };
}

/**
 * CSRF defence for a JSON API on same-site cookies: every state-changing request must carry a custom header.
 * Browsers cannot add custom headers cross-origin without a CORS preflight, and this app sends no CORS headers.
 */
export function requireCsrfHeader(req, _res, next) {
  if (["GET", "HEAD", "OPTIONS"].includes(req.method)) return next();
  if (req.get("x-requested-by") !== "duesoon") return next(new HttpError(403, "csrf", "Missing or invalid X-Requested-By header"));
  next();
}

/** In-memory fixed-window limiter. LIMIT: per process only; use a shared store before running several instances. */
export function createLimiter({ windowMs, max, key }) {
  const hits = new Map();
  return (req, res, next) => {
    const now = Date.now();
    const k = key(req);
    const e = hits.get(k);
    if (!e || e.reset <= now) { hits.set(k, { count: 1, reset: now + windowMs }); return next(); }
    e.count += 1;
    if (e.count > max) {
      res.setHeader("Retry-After", String(Math.ceil((e.reset - now) / 1000)));
      return next(new HttpError(429, "rate_limited", "Too many attempts. Try again later."));
    }
    next();
  };
}
