// Rupee and date formatting. Pure functions; no Intl, so output does not vary by device locale.
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
export const MAX_RUPEES = 1_000_000_000; // Rs 100 crore

/** "1,25,000.50" or "125000" -> amount in paise (integer), or null when not a valid positive amount. */
export function parseAmountToPaise(text) {
  if (typeof text !== "string") return null;
  const t = text.trim().replace(/^(₹|rs\.?|inr)\s*/i, "");
  if (!/^\d{1,3}(,\d{2,3})*(\.\d{1,2})?$|^\d+(\.\d{1,2})?$/.test(t)) return null;
  const [whole, frac = ""] = t.replace(/,/g, "").split(".");
  const paise = Number(whole) * 100 + Number(frac.padEnd(2, "0"));
  if (!Number.isSafeInteger(paise) || paise <= 0 || paise > MAX_RUPEES * 100) return null;
  return paise;
}

/** Paise -> "Rs 1,25,000" (decimals only when there are paise), Indian digit grouping at any size. */
export function formatRupees(paise) {
  const rupees = Math.floor(paise / 100);
  const p = paise % 100;
  const s = String(rupees);
  const grouped = s.length <= 3 ? s : s.slice(0, -3).replace(/\B(?=(\d{2})+(?!\d))/g, ",") + "," + s.slice(-3);
  return "Rs " + grouped + (p ? "." + String(p).padStart(2, "0") : "");
}

/** "YYYY-MM-DD" -> { y, m, d } for a real calendar date, else null. */
export function parseDate(text) {
  const m = typeof text === "string" && /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
  if (!m) return null;
  const y = Number(m[1]), mo = Number(m[2]), d = Number(m[3]);
  const dt = new Date(Date.UTC(y, mo - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== mo - 1 || dt.getUTCDate() !== d) return null;
  return { y, m: mo, d, utc: dt.getTime() };
}

/** "2026-10-19" -> "19 Oct 2026" (month name, never numeric day/month). */
export function formatDate(text) {
  const p = parseDate(text);
  return p ? `${p.d} ${MONTHS[p.m - 1]} ${p.y}` : "";
}

/** Whole days from `from` to `to` (both "YYYY-MM-DD"); positive when `to` is later. */
export function daysBetween(from, to) {
  return Math.round((parseDate(to).utc - parseDate(from).utc) / 86_400_000);
}
