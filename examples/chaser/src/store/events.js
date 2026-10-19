import fs from "node:fs";
import path from "node:path";

export const EVENTS = ["page_ready", "generate", "copy", "open_whatsapp", "open_email", "sent_yes", "sent_no", "pay_intent", "waitlist_submit"];
export const KINDS = ["polite", "firm", "final"];

/** IST calendar day, because the audience and the operator are in India. */
export const istDay = (ms = Date.now()) => new Date(ms + 19_800_000).toISOString().slice(0, 10);

/**
 * Anonymous event counters. Each counted event is one line of JSON (time, event, src, day); there is nothing
 * personal in it. Counts are rebuilt from the file at start, so a restart does not lose them.
 */
export function createEventStore({ dir }) {
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, "events.jsonl");
  const counts = new Map(); // `${day}|${src}|${event}` -> n
  const bump = (day, src, event) => { const k = `${day}|${src}|${event}`; counts.set(k, (counts.get(k) ?? 0) + 1); };
  if (fs.existsSync(file)) {
    for (const line of fs.readFileSync(file, "utf8").split("\n")) {
      if (!line) continue;
      try { const e = JSON.parse(line); bump(e.day, e.src, e.event); } catch { /* a torn last line after a crash is skipped; the rest still counts */ }
    }
  }
  return {
    record(event, src, now = Date.now()) {
      const day = istDay(now);
      fs.appendFileSync(file, JSON.stringify({ t: new Date(now).toISOString(), day, src, event }) + "\n", { mode: 0o600 });
      bump(day, src, event);
    },
    /** { [day]: { [src]: { [event]: n } } } */
    snapshot() {
      const out = {};
      for (const [k, n] of counts) {
        const [day, src, event] = k.split("|");
        ((out[day] ??= {})[src] ??= {})[event] = n;
      }
      return out;
    },
  };
}
