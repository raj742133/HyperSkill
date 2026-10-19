// Dev helper: create a demo account with realistic assignments relative to today, through the real API.
// Usage: BASE=http://localhost:3000 node scripts/seed-demo.js   (prints the login)
import { addDays } from "../public/due.js";
import { localToday } from "../public/due.js";

const base = process.env.BASE ?? "http://localhost:3000";
if (!/^https?:\/\/(localhost|127\.0\.0\.1)(:|\/|$)/.test(base)) { console.error("seed-demo.js only talks to a local server: it creates an account with a known password"); process.exit(1); }
const email = process.env.DEMO_EMAIL ?? "priya.nair@campusmail.in";
const password = process.env.DEMO_PASSWORD ?? "demo-password-2026";
const headers = { "content-type": "application/json", "x-requested-by": "duesoon" };
let cookie = "";
async function call(method, path, body) {
  const res = await fetch(base + path, { method, headers: { ...headers, ...(cookie ? { cookie } : {}) }, body: body && JSON.stringify(body) });
  const set = res.headers.getSetCookie?.()[0];
  if (set) cookie = set.split(";")[0];
  const text = await res.text();
  if (!res.ok && !(path.endsWith("signup") && res.status === 409)) throw new Error(`${method} ${path} -> ${res.status} ${text}`);
  return text ? JSON.parse(text) : null;
}
const t = localToday();
await call("POST", "/api/auth/signup", { email, password }).catch(() => {});
await call("POST", "/api/auth/login", { email, password });
const rows = [
  ["Operating Systems lab report", "CS301", -2], ["Statistics problem set 4", "MA210", -1], ["DBMS mini project demo", "CS305", 0],
  ["Technical writing draft", "EN202", 2], ["Computer Networks quiz prep", "CS307", 3], ["Algorithms assignment 5", "CS302", 3],
  ["Design project proposal", "CS350", 6], ["Statistics midterm", "MA210", 9], ["Capstone literature review", "CS499", 13],
];
for (const [title, course, off] of rows) await call("POST", "/api/assignments", { title, course, dueDate: addDays(t, off) });
const list = await call("GET", "/api/assignments");
for (const it of list.items.filter((i) => ["Algorithms assignment 5"].includes(i.title))) await call("PATCH", `/api/assignments/${it.id}`, { done: true });
console.log(`seeded ${rows.length} assignments for ${email} / ${password}`);
