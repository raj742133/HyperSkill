import { validateInput, generateMessages, whatsappLink, mailtoLink, formatRupees, formatDate } from "/core/index.js";

const $ = (id) => document.getElementById(id);
const params = new URLSearchParams(location.search);
const src = params.get("src") ?? undefined;
const FIELDS = ["me", "client", "call", "amount", "invoice", "due", "deadline", "pay"];
/** Which message fits today: a few days late, about two weeks late, or well past that. Only a suggestion. */
const suggest = (days) => (days <= 0 ? "polite" : days <= 7 ? "polite" : days <= 21 ? "firm" : "final");
const WHEN = {
  polite: "A few days late",
  firm: "About two weeks late",
  final: "The last reminder before you pause work",
};

let token = null;
let config = { priceInr: 149, waitlistEnabled: false };
let telemetryFailed = false; // counting is best effort: a failed request must never get in the visitor's way
const sent = new Set();

const todayLocal = () => {
  const d = new Date(), p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};

async function api(path, body) {
  const res = await fetch(path, {
    method: "POST",
    headers: { "content-type": "application/json", "x-requested-by": "chaser" },
    body: JSON.stringify(body),
    keepalive: true,
  });
  const json = await res.json().catch(() => null); // an error page from a proxy is not JSON: callers use the status instead
  return { status: res.status, json };
}

/** Anonymous counter. At most once per page load for each event and message kind; carries no form data. */
function track(event, kind) {
  const key = `${event}:${kind ?? ""}`;
  if (sent.has(key) || (event !== "page_ready" && !token)) return;
  sent.add(key);
  api("/api/event", { event, kind, src, token })
    .then(({ json }) => { if (event === "page_ready" && json?.token) token = json.token; })
    .catch(() => { telemetryFailed = true; });
}

function say(text) { $("live").textContent = ""; setTimeout(() => { $("live").textContent = text; }, 30); }

/* ---------- form ---------- */
function readForm() {
  const raw = {};
  for (const f of FIELDS) raw[f] = $(f).value;
  return raw;
}

function showErrors(errors) {
  for (const f of FIELDS) { $(f + "-err").textContent = errors[f] ?? ""; if (errors[f]) $(f).setAttribute("aria-invalid", "true"); else $(f).removeAttribute("aria-invalid"); }
  const box = $("errors");
  const keys = Object.keys(errors);
  if (!keys.length) { box.hidden = true; box.textContent = ""; return; }
  box.innerHTML = "";
  const p = document.createElement("strong"); p.textContent = keys.length === 1 ? "One thing needs fixing:" : `${keys.length} things need fixing:`;
  const ul = document.createElement("ul");
  for (const k of keys) {
    const li = document.createElement("li"), a = document.createElement("a");
    a.href = "#" + k; a.textContent = errors[k];
    a.addEventListener("click", (e) => { e.preventDefault(); $(k).focus(); });
    li.append(a); ul.append(li);
  }
  box.append(p, ul); box.hidden = false; box.focus();
}

$("form").addEventListener("submit", (e) => {
  e.preventDefault();
  const today = todayLocal();
  const result = validateInput(readForm(), today);
  showErrors(result.errors);
  if (!result.ok) return;
  if ($("messages").querySelector("textarea[data-edited]") && !confirm("Writing the messages again will replace the changes you made to them. Continue?")) return;
  render(result.value, today);
  track("generate");
});

/* ---------- results ---------- */
function el(tag, props = {}, ...kids) {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) { if (k === "text") n.textContent = v; else n.setAttribute(k, v); }
  n.append(...kids);
  return n;
}

function render(v, today) {
  const out = generateMessages(v, today);
  const best = suggest(out.days);
  const label = out.messages.find((m) => m.tone === best).label;
  $("summary").textContent = out.overdue
    ? `This invoice is ${out.days} day${out.days === 1 ? "" : "s"} overdue (counted from today's date on your device). Suggested: start with ${label}.`
    : "This invoice is not overdue yet, so the polite message fits best. The firm and final ones are below, for later.";
  const check = $("check"); check.textContent = "";
  const rows = [["Client", v.client], ["Amount", formatRupees(v.paise)], ["Due date", formatDate(v.due)], ["Pay-by date (final message)", formatDate(v.deadline)], ["Pay to", v.pay || "No payment details added"]];
  for (const [k, val] of rows) check.append(el("dt", { text: k }), el("dd", { text: val }));

  const box = $("messages"); box.textContent = "";
  // The suggested message comes first; when nothing is overdue the other two wait behind a button.
  const ordered = [...out.messages.filter((m) => m.tone === best), ...out.messages.filter((m) => m.tone !== best)];
  const later = out.overdue ? null : el("div", { id: "later", hidden: "" });
  ordered.forEach((m, i) => (later && i > 0 ? later : box).append(messageCard(m, m.tone === best)));
  if (later) {
    const show = el("button", { type: "button", class: "secondary", "aria-controls": "later", "aria-expanded": "false", text: "Show the firm and final messages" });
    show.addEventListener("click", () => { later.hidden = false; show.hidden = true; later.querySelector("textarea").focus(); });
    box.append(show, later);
  }
  const results = $("results"); results.hidden = false;
  results.focus(); results.scrollIntoView({ behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" });
}

function messageCard(m, suggested) {
  const grow = (t) => { t.style.height = "auto"; t.style.height = t.scrollHeight + 2 + "px"; };
  const ta = el("textarea", { id: `wa-${m.tone}`, "aria-label": `${m.label} message for WhatsApp, you can edit it`, spellcheck: "true" });
  ta.value = m.whatsapp;
  const wa = el("a", { class: suggested ? "btn" : "btn quiet", href: whatsappLink(m.whatsapp), target: "_blank", rel: "noopener noreferrer", text: "Open in WhatsApp" });
  ta.addEventListener("input", () => { wa.href = whatsappLink(ta.value); grow(ta); ta.dataset.edited = "1"; });
  const copy = el("button", { type: "button", class: "secondary", text: "Copy text" });
  const asked = el("p", { class: "sent", hidden: "" });
  const askSent = () => {
    if (!asked.hidden) return;
    asked.hidden = false;
    const yes = el("button", { type: "button", text: "Yes" }), no = el("button", { type: "button", text: "No" });
    const answer = (ev, msg) => { track(ev, m.tone); asked.textContent = msg; };
    yes.addEventListener("click", () => answer("sent_yes", "Thanks. That helps."));
    no.addEventListener("click", () => answer("sent_no", "Thanks. Come back when you are ready."));
    asked.append("Did you send it? ", yes, no);
  };
  copy.addEventListener("click", async () => {
    try { await navigator.clipboard.writeText(ta.value); say(`${m.label} message copied.`); }
    catch { ta.focus(); ta.select(); say("Copying is blocked here. The text is selected: press copy on your keyboard."); }
    track("copy", m.tone);
  });
  wa.addEventListener("click", () => { track("open_whatsapp", m.tone); askSent(); });

  const mail = el("a", { class: "btn", href: mailtoLink(m.email), text: "Open in email" });
  mail.addEventListener("click", () => { track("open_email", m.tone); askSent(); });
  const copyMail = el("button", { type: "button", class: "secondary", text: "Copy email", "aria-label": `Copy the ${m.label.toLowerCase()} email, subject and text` });
  copyMail.addEventListener("click", async () => {
    try { await navigator.clipboard.writeText(`Subject: ${m.email.subject}\n\n${m.email.body}`); say(`${m.label} email copied.`); }
    catch { say("Copying is blocked here. Select the email text and copy it with your keyboard."); }
    track("copy", m.tone);
  });
  const details = el("details", { class: "email" },
    el("summary", { text: "Email version" }),
    el("p", {}, el("strong", { text: "Subject: " }), m.email.subject),
    el("pre", { text: m.email.body }),
    el("div", { class: "row" }, mail, copyMail));
  const card = el("article", { class: suggested ? "card msg suggested" : "card msg" },
    el("h3", {}, m.label, suggested ? el("span", { class: "tag", text: "Suggested" }) : "", el("span", { class: "when", text: WHEN[m.tone] })),
    ta, el("div", { class: "row" }, wa, copy), details, asked);
  queueMicrotask(() => grow(ta)); // size the box to its text once it is in the page
  return card;
}

/* ---------- the paid-plan question (a fake door: nothing is sold) ---------- */
$("pay-intent").addEventListener("click", () => {
  track("pay_intent");
  $("pay-intent").hidden = true;
  $("door-2").hidden = false;
  if (config.waitlistEnabled) {
    $("door-thanks").textContent = "Thanks, noted. It does not exist yet and nothing will be charged.";
    const end = formatDate(config.endDate);
    $("wl-notice").textContent = `We use your email only to tell you if this gets built. Run by ${config.operatorName} (${config.operatorContact}). We keep your email until ${end}, then delete it; write to that address to have it removed sooner. This site's host also logs visitors' IP addresses.`;
    $("wl").hidden = false;
  } else {
    $("door-thanks").textContent = "Thanks, noted. It does not exist yet, and the email list is not open.";
  }
  $("door-thanks").focus();
});

$("wl").addEventListener("submit", async (e) => {
  e.preventDefault();
  const email = $("email").value.trim();
  const err = $("wl-err"); err.textContent = ""; $("email").removeAttribute("aria-invalid");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) { err.textContent = "Enter a valid email address."; $("email").setAttribute("aria-invalid", "true"); $("email").focus(); return; }
  const btn = $("wl").querySelector("button"); btn.disabled = true;
  try {
    const { status, json } = await api("/api/waitlist", { email, website: $("wl").elements.website.value, token, src });
    if (status === 202) { $("wl").hidden = true; const d = $("wl-done"); d.hidden = false; d.textContent = "Thanks. You are on the list."; return; }
    err.textContent = status === 429 ? "Too many attempts. Please try again later." : (json?.error?.message ?? "Something went wrong. Please try again.");
    $("email").focus();
  } catch {
    err.textContent = "Can't reach the server. Check your connection and try again.";
    $("email").focus();
  } finally { btn.disabled = false; }
});

/* ---------- start ---------- */
$("deadline").min = todayLocal();
{ const d = new Date(); d.setDate(d.getDate() + 7); const p = (n) => String(n).padStart(2, "0"); $("deadline").value = `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`; } // a week from today unless the visitor changes it
fetch("/api/config").then((r) => r.json()).then((c) => {
  config = c;
  $("price").textContent = `Rs ${c.priceInr} a month`;
  if (c.waitlistEnabled) {
    const p = $("operator"); p.textContent = `Run by ${c.operatorName}. Contact: `;
    const isMail = c.operatorContact.includes("@") && !c.operatorContact.startsWith("http");
    p.append(el("a", { href: isMail ? `mailto:${c.operatorContact}` : c.operatorContact, rel: "noopener noreferrer", text: c.operatorContact }));
  }
}).catch(() => { telemetryFailed = true; }).finally(() => track("page_ready"));
