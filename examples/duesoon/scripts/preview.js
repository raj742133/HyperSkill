// DEV ONLY. Serves the real app on PREVIEW_PORT with a seeded demo user already signed in, so tools that cannot log in
// (screenshots, design inspectors) can see the main screen. Never import this from src/ and never run it in production.
import express from "express";
import { loadConfig } from "../src/config.js";
import { createLogger } from "../src/logger.js";
import { openDb } from "../src/db/connection.js";
import { createApp } from "../src/app.js";
import { createUser } from "../src/services/users.js";
import { createAssignment, updateAssignment } from "../src/services/assignments.js";
import { addDays, localToday } from "../public/due.js";

if (process.env.NODE_ENV === "production") { console.error("preview.js refuses to run in production"); process.exit(1); }
const config = loadConfig({ SESSION_SECRET: "preview-".padEnd(40, "p"), BCRYPT_ROUNDS: "4", NODE_ENV: "development", LOG_LEVEL: "error" });
const db = openDb(":memory:");
const logger = createLogger({ level: "error" });
const empty = process.env.PREVIEW_EMPTY === "1";
const email = "priya.nair@campusmail.in", password = "demo-password-2026";
const user = await createUser(db, { email, password }, 4);
const t = localToday();
if (!empty) {
  const rows = [
    ["Operating Systems lab report", "CS301", -2], ["Statistics problem set 4", "MA210", -1], ["DBMS mini project demo", "CS305", 0],
    ["Technical writing draft", "EN202", 2], ["Computer Networks quiz prep", "CS307", 3], ["Algorithms assignment 5", "CS302", 3],
    ["Design project proposal", "CS350", 6], ["Statistics midterm", "MA210", 9], ["Capstone literature review", "CS499", 13],
  ];
  for (const [title, course, off] of rows) {
    const a = createAssignment(db, user, { title, course, dueDate: addDays(t, off) });
    if (title.startsWith("Algorithms")) updateAssignment(db, user, a.id, { done: true });
  }
}
const inner = createApp({ config, logger, db });
const srv = inner.listen(0);
const base = `http://127.0.0.1:${srv.address().port}`;
const res = await fetch(base + "/api/auth/login", { method: "POST", headers: { "content-type": "application/json", "x-requested-by": "duesoon" }, body: JSON.stringify({ email, password }) });
const sid = res.headers.getSetCookie()[0].split(";")[0];
const outer = express();
outer.use((req, _res, next) => { if (!/(^|;\s*)sid=/.test(req.headers.cookie ?? "")) req.headers.cookie = sid; next(); });
outer.use(inner);
const port = Number(process.env.PREVIEW_PORT ?? 3120);
outer.listen(port, "127.0.0.1", () => console.log(`preview on http://127.0.0.1:${port} (signed in as ${email}${empty ? ", empty account" : ""})`));
