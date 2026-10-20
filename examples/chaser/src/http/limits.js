import crypto from "node:crypto";

const SALT = crypto.randomBytes(16); // per process, never stored: rate-limit keys cannot be traced back to an address after a restart

/** The client address. Behind `trustProxy` proxies, the entry that many places from the right of X-Forwarded-For. */
export function clientIp(req, trustProxy) {
  if (trustProxy > 0) {
    const parts = String(req.headers["x-forwarded-for"] ?? "").split(",").map((s) => s.trim()).filter(Boolean);
    const ip = parts[parts.length - trustProxy];
    if (ip) return ip;
  }
  return req.socket.remoteAddress ?? "unknown";
}

export const hashIp = (ip) => crypto.createHash("sha256").update(SALT).update(ip).digest("hex").slice(0, 24);

/** Fixed-window limiter held in memory only, bounded in size and swept. `take(key)` returns false when over the limit. */
export function createRateLimiter({ windowMs, max, maxKeys = 10_000 }) {
  const hits = new Map();
  const sweep = setInterval(() => { const now = Date.now(); for (const [k, e] of hits) if (e.reset <= now) hits.delete(k); }, Math.min(windowMs, 60_000));
  sweep.unref();
  return {
    take(key, now = Date.now()) {
      const e = hits.get(key);
      if (!e || e.reset <= now) {
        hits.delete(key);
        if (hits.size >= maxKeys) hits.delete(hits.keys().next().value);
        hits.set(key, { count: 1, reset: now + windowMs });
        return true;
      }
      e.count += 1;
      return e.count <= max;
    },
    size: () => hits.size,
  };
}
