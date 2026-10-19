import express from "express";
import session from "express-session";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import { HttpError } from "./errors.js";
import { securityHeaders, requireCsrfHeader } from "./middleware/security.js";
import { apiRouter } from "./routes/index.js";

export { HttpError };
const PUBLIC_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "public");
const DEFAULT_LIMITS = {
  login: { windowMs: 15 * 60 * 1000, max: 10 },
  signup: { windowMs: 60 * 60 * 1000, max: 10 },
};

/** Build the Express app. Dependencies are passed in so tests can use an in-memory database. */
export function createApp({ config, logger, db, limits = DEFAULT_LIMITS }) {
  const app = express();
  app.disable("x-powered-by"); app.set("etag", false); // no validators on private bodies
  if (config.NODE_ENV === "production") app.set("trust proxy", 1);

  app.use((req, res, next) => {
    req.id = randomUUID();
    res.setHeader("X-Request-Id", req.id);
    const start = process.hrtime.bigint();
    res.on("finish", () => {
      logger.info("request", {
        requestId: req.id, method: req.method, path: req.originalUrl.split("?")[0], status: res.statusCode,
        ms: Number((process.hrtime.bigint() - start) / 1000000n), userId: req.session?.userId,
      });
    });
    next();
  });
  app.use(securityHeaders({ production: config.NODE_ENV === "production" }));

  app.get("/api/health/live", (_req, res) => res.json({ status: "ok" }));
  app.get("/api/health", (_req, res) => {
    try {
      db.prepare("SELECT 1").get();
      res.json({ status: "ok", checks: { database: "ok" } });
    } catch {
      res.status(503).json({ status: "degraded", checks: { database: "down" } });
    }
  });

  app.use(express.json({ limit: "10kb" }));
  app.use(session({
    name: "sid", secret: config.SESSION_SECRET, resave: false, saveUninitialized: false,
    cookie: { httpOnly: true, sameSite: "lax", secure: config.NODE_ENV === "production", maxAge: 7 * 24 * 3600 * 1000 },
  }));
  app.use("/api", requireCsrfHeader, apiRouter({ db, config, limits }));
  app.use(express.static(PUBLIC_DIR, { index: "index.html", maxAge: 0 }));

  app.use((_req, _res, next) => next(new HttpError(404, "not_found", "Not found")));
  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, _next) => {
    let status = 500, code = "internal_error", message = "Something went wrong", details;
    if (err instanceof HttpError) ({ status, code, message, details } = err);
    else if (err.type === "entity.parse.failed") { status = 400; code = "invalid_json"; message = "Request body is not valid JSON"; }
    else if (err.type === "entity.too.large") { status = 413; code = "too_large"; message = "Request body too large"; }
    else logger.error("unhandled_error", { requestId: req.id, error: err.message, stack: err.stack });
    res.status(status).json({ error: { code, message, ...(details ? { details } : {}) } });
  });
  return app;
}
