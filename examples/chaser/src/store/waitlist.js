import fs from "node:fs";
import path from "node:path";

/**
 * The optional waitlist: the visitor's own email, when they asked, and which notice version they saw.
 * Kept in its own file, apart from the counters. The operator reads and deletes entries by hand.
 */
export function createWaitlistStore({ dir }) {
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, "waitlist.jsonl");
  const seen = new Set();
  if (fs.existsSync(file)) {
    for (const line of fs.readFileSync(file, "utf8").split("\n")) {
      if (!line) continue;
      try { seen.add(JSON.parse(line).email); } catch { /* skip a torn line */ }
    }
  }
  return {
    /** Returns true when a new entry was written, false when the address was already there. */
    add({ email, src, noticeVersion }, now = Date.now()) {
      if (seen.has(email)) return false;
      fs.appendFileSync(file, JSON.stringify({ email, at: new Date(now).toISOString(), src, noticeVersion, confirmed: false }) + "\n", { mode: 0o600 });
      seen.add(email);
      return true;
    },
    count: () => seen.size,
  };
}
