import { createApp } from "../src/app.js";
import { createLogger } from "../src/logger.js";
import { loadConfig } from "../src/config.js";
import { openDb } from "../src/db/connection.js";

export const SECRET = "x".repeat(40);
const BIG = { login: { windowMs: 60000, max: 1e6 }, loginIp: { windowMs: 60000, max: 1e6 }, signup: { windowMs: 60000, max: 1e6 } };

/** Real app, real in-memory SQLite, real HTTP. Nothing of our own is mocked. */
export async function startApp({ env = {}, limits = BIG, logs } = {}) {
  const config = loadConfig({ SESSION_SECRET: SECRET, BCRYPT_ROUNDS: "4", NODE_ENV: "test", ...env });
  const db = openDb(":memory:");
  const logger = createLogger({ level: "debug", write: logs ? (l) => logs.push(l) : () => {} });
  const app = createApp({ config, logger, db, limits });
  const server = await new Promise((res) => { const s = app.listen(0, "127.0.0.1", () => res(s)); });
  const base = `http://127.0.0.1:${server.address().port}`;
  return { db, base, config, close: () => new Promise((r) => server.close(r)) , agent: () => new Agent(base) };
}

/** Minimal cookie-keeping HTTP client. */
export class Agent {
  constructor(base) { this.base = base; this.cookie = ""; }
  async req(method, path, body, { csrf = true, raw, headers = {} } = {}) {
    const h = { ...headers };
    if (csrf) h["x-requested-by"] = "duesoon";
    if (this.cookie) h.cookie = this.cookie;
    let payload;
    if (raw !== undefined) { payload = raw; h["content-type"] = "application/json"; }
    else if (body !== undefined) { payload = JSON.stringify(body); h["content-type"] = "application/json"; }
    const res = await fetch(this.base + path, { method, headers: h, body: payload, redirect: "manual" });
    const set = res.headers.getSetCookie?.() ?? [];
    for (const c of set) {
      const [pair] = c.split(";");
      if (/^sid=;|Expires=Thu, 01 Jan 1970/.test(c)) this.cookie = "";
      else this.cookie = pair;
    }
    const text = await res.text();
    let json; try { json = JSON.parse(text); } catch { json = undefined; }
    return { status: res.status, json, text, headers: res.headers, setCookie: set };
  }
  get(p, o) { return this.req("GET", p, undefined, o); }
  post(p, b, o) { return this.req("POST", p, b, o); }
  patch(p, b, o) { return this.req("PATCH", p, b, o); }
  del(p, b, o) { return this.req("DELETE", p, b, o); }
}

let n = 0;
export async function signedUp(ctx, email = `user${++n}@example.com`) {
  const a = ctx.agent();
  const r = await a.post("/api/auth/signup", { email, password: "correct-horse-1" });
  if (r.status !== 201) throw new Error(`signup failed: ${r.status} ${r.text}`);
  return { agent: a, user: r.json.user };
}
