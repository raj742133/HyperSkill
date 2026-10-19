// Pure date helpers for the client. A due date is a date only (YYYY-MM-DD) and "today" is the browser's local date,
// so a student in any timezone sees "overdue" flip at their own midnight.
const pad = (n) => String(n).padStart(2, "0");

export function localToday(now = new Date()) {
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

function utcDay(iso) {
  const [y, m, d] = iso.split("-").map(Number);
  return Date.UTC(y, m - 1, d) / 86400000;
}

/** Whole days from `fromISO` to `toISO` (negative when `toISO` is earlier). */
export function daysBetween(fromISO, toISO) {
  return utcDay(toISO) - utcDay(fromISO);
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
export function shortDate(iso) {
  const [, m, d] = iso.split("-").map(Number);
  return `${d} ${MONTHS[m - 1]}`;
}

/** What to show next to an assignment: a kind for styling and words for people. */
export function dueInfo(dueISO, todayISO, done) {
  if (done) return { kind: "done", label: "Done" };
  const d = daysBetween(todayISO, dueISO);
  if (d < 0) return { kind: "overdue", days: -d, label: -d === 1 ? "Overdue by 1 day" : `Overdue by ${-d} days` };
  if (d === 0) return { kind: "today", days: 0, label: "Due today" };
  if (d === 1) return { kind: "soon", days: 1, label: "Due tomorrow" };
  if (d <= 7) return { kind: "soon", days: d, label: `Due in ${d} days` };
  return { kind: "later", days: d, label: `Due ${shortDate(dueISO)}` };
}

/** The line under the title: counts of what needs attention, from the rows as shown. */
export function summarize(items, todayISO) {
  let overdue = 0, soon = 0, open = 0;
  for (const it of items) {
    if (it.done) continue;
    open += 1;
    const d = daysBetween(todayISO, it.dueDate);
    if (d < 0) overdue += 1;
    else if (d <= 7) soon += 1;
  }
  return { overdue, soon, open };
}

/** Count of not-done assignments per day for `days` days from today. Overdue ones are returned separately. */
export function weekStrip(items, todayISO, days = 14) {
  const counts = Array.from({ length: days }, () => 0);
  let overdue = 0;
  for (const it of items) {
    if (it.done) continue;
    const d = daysBetween(todayISO, it.dueDate);
    if (d < 0) overdue += 1;
    else if (d < days) counts[d] += 1;
  }
  return { counts, overdue };
}

/** Add `n` days to an ISO date (used for the strip's day labels and for tests). */
export function addDays(iso, n) {
  const t = new Date(utcDay(iso) * 86400000 + n * 86400000);
  return `${t.getUTCFullYear()}-${pad(t.getUTCMonth() + 1)}-${pad(t.getUTCDate())}`;
}

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
export function weekdayShort(iso) {
  return WEEKDAYS[new Date(utcDay(iso) * 86400000).getUTCDay()];
}
