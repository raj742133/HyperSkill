import { formatRupees, formatDate, daysBetween } from "./format.js";

/** Phrases the generated text must never contain on its own (docs/system-design.md F3). Tests check every template against this. */
export const FORBIDDEN_PHRASES = [
  "legal action", "police", "court", "notice", "lawyer", "advocate", "defaulter", "fraud", "cheat", "blacklist",
  "report to your employer", "interest", "penalty", "late fee", "consequences",
];

export function findForbidden(text) {
  const t = text.toLowerCase();
  return FORBIDDEN_PHRASES.filter((p) => t.includes(p));
}

// null parts are skipped; an empty string is kept and becomes a blank line.
function lines(...parts) { return parts.filter((p) => p !== null).join("\n"); }

/**
 * Build the three messages from validated input (see validateInput). `today` is "YYYY-MM-DD".
 * Returns { days, overdue, messages: [{ tone, label, whatsapp, email: { subject, body } }] }.
 * The amount printed is exactly the amount typed; the due date and deadline come from the visitor.
 */
export function generateMessages(v, today) {
  const days = daysBetween(v.due, today); // positive = days since the due date
  const overdue = days > 0;
  const amount = formatRupees(v.paise);
  const due = formatDate(v.due);
  const deadline = formatDate(v.deadline);
  const inv = v.invoice ? `invoice ${v.invoice}` : "my invoice";
  const invFor = v.invoice ? `invoice ${v.invoice} for ${amount}` : `my invoice for ${amount}`;
  const payLine = v.pay ? `You can pay to: ${v.pay}` : null;
  const when = overdue ? `which was due on ${due}` : days === 0 ? `which is due today (${due})` : `which is due on ${due}`;
  const ago = overdue ? ` (${days} day${days === 1 ? "" : "s"} ago)` : "";
  const sign = v.me;
  const hi = `Hi ${v.client},`;

  const polite = {
    wa: lines(
      hi,
      overdue
        ? `Hope you're doing well. A quick reminder that ${invFor}, ${when}, is still showing as unpaid on my side.`
        : `Hope you're doing well. A friendly heads-up that ${invFor} ${when.replace("which ", "")}.`,
      payLine,
      overdue ? "Could you let me know when I can expect the payment? Thank you!" : "Please let me know if you need anything from me to process it. Thank you!",
      "", sign,
    ),
    subject: overdue ? `Reminder: ${inv} (${amount}) was due on ${due}` : `Upcoming payment: ${inv} (${amount}) due on ${due}`,
  };
  const firm = {
    wa: lines(
      hi,
      overdue
        ? `I'm following up on ${invFor}, ${when}${ago}. I haven't received the payment yet.`
        : `I'm following up on ${invFor}, ${when}.`,
      payLine,
      overdue
        ? "Please reply today with the date it will be paid. If something is holding it up, tell me what and I will help sort it out."
        : "Please reply with the date it will be paid. If anything is holding it up, tell me and I will help sort it out.",
      "", sign,
    ),
    subject: `Following up: ${inv} (${amount}), ${overdue ? `${days} day${days === 1 ? "" : "s"} overdue` : "due " + due}`,
  };
  const final = {
    wa: lines(
      hi,
      overdue ? `This is my final reminder about ${invFor}, ${when}${ago}.` : `A reminder about ${invFor}, ${when}.`,
      `Please make the payment by ${deadline}.`,
      payLine,
      "If I do not hear from you by then, I will have to pause further work until this is settled.",
      "", sign,
    ),
    subject: `${overdue ? "Final reminder" : "Reminder"}: ${inv} (${amount}), please pay by ${deadline}`,
  };
  const wrap = (m) => ({
    whatsapp: m.wa,
    email: { subject: m.subject, body: m.wa.replace(/^Hi /, "Dear ").replace(/\n\n([^\n]+)$/, "\n\nRegards,\n$1") },
  });
  return {
    days, overdue,
    messages: [
      { tone: "polite", label: "Polite", ...wrap(polite) },
      { tone: "firm", label: "Firm", ...wrap(firm) },
      { tone: "final", label: "Final", ...wrap(final) },
    ],
  };
}

/** WhatsApp click-to-chat link. The visitor picks the chat and taps send; nothing is sent by us. */
export function whatsappLink(text) { return "https://wa.me/?text=" + encodeURIComponent(text); }
export function mailtoLink({ subject, body }) { return "mailto:?subject=" + encodeURIComponent(subject) + "&body=" + encodeURIComponent(body); }
