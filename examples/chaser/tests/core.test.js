import { test } from "node:test";
import assert from "node:assert/strict";
import {
  parseAmountToPaise, formatRupees, formatDate, daysBetween, validateInput, generateMessages,
  findForbidden, FORBIDDEN_PHRASES, whatsappLink, mailtoLink,
} from "../src/core/index.js";

const TODAY = "2026-10-19";
const base = { me: "Asha", client: "Ravi Traders", invoice: "INV-12", amount: "25000", due: "2026-10-01", deadline: "2026-10-26", pay: "asha@okaxis" };
const gen = (over = {}, today = TODAY) => {
  const v = validateInput({ ...base, ...over }, today);
  assert.ok(v.ok, JSON.stringify(v.errors));
  return generateMessages(v.value, today);
};
const text = (r) => r.messages.map((m) => `${m.whatsapp}\n${m.email.subject}\n${m.email.body}`).join("\n");

test("amounts: Indian grouping at every size, decimals only when typed", () => {
  const cases = [["1", "Rs 1"], ["999", "Rs 999"], ["1000", "Rs 1,000"], ["25000", "Rs 25,000"], ["125000", "Rs 1,25,000"],
    ["1,25,000.50", "Rs 1,25,000.50"], ["12345678", "Rs 1,23,45,678"], ["1000000000", "Rs 1,00,00,00,000"], ["0.5", "Rs 0.50"], ["Rs 5000", "Rs 5,000"]];
  cases.push(["₹25,000", "Rs 25,000"], ["₹ 1,25,000.50", "Rs 1,25,000.50"]);
  for (const [input, want] of cases) assert.equal(formatRupees(parseAmountToPaise(input)), want, input);
});

test("amounts: zero, negative, junk, too many decimals and absurd values are rejected", () => {
  for (const bad of ["", "0", "0.00", "-5", "abc", "12.345", "1,2,3", "1e5", "10000000000", "5 lakh", " ", null, undefined, 5]) {
    assert.equal(parseAmountToPaise(bad), null, String(bad));
  }
  assert.ok(parseAmountToPaise("1000000000") !== null, "Rs 100 crore is the allowed maximum");
});

test("dates: month names, real calendar dates only, day arithmetic", () => {
  assert.equal(formatDate("2026-10-19"), "19 Oct 2026");
  assert.equal(formatDate("2026-02-30"), "");
  assert.equal(formatDate("19/10/2026"), "");
  assert.equal(daysBetween("2026-10-01", "2026-10-19"), 18);
  assert.equal(daysBetween("2026-10-19", "2026-10-19"), 0);
  assert.equal(daysBetween("2026-10-19", "2026-10-01"), -18);
  assert.equal(daysBetween("2027-02-28", "2027-03-01"), 1);
  assert.equal(daysBetween("2028-02-28", "2028-03-01"), 2, "leap year");
});

test("validation: every required field, line breaks, bad payment details, past deadline", () => {
  assert.deepEqual(Object.keys(validateInput({}, TODAY).errors).sort(), ["amount", "client", "deadline", "due", "me"]);
  assert.ok(validateInput({ ...base, client: "Ravi\nTraders" }, TODAY).errors.client, "line break in a name");
  assert.ok(validateInput({ ...base, client: "x".repeat(61) }, TODAY).errors.client);
  assert.ok(validateInput({ ...base, pay: "pay me at 9999999999" }, TODAY).errors.pay);
  assert.ok(validateInput({ ...base, pay: "http://insecure.example/pay" }, TODAY).errors.pay, "http link refused");
  assert.ok(validateInput({ ...base, pay: "upi://pay?pa=x@y" }, TODAY).errors.pay, "upi deep link refused");
  assert.ok(validateInput({ ...base, deadline: "2026-10-18" }, TODAY).errors.deadline, "past deadline");
  assert.ok(validateInput({ ...base, deadline: TODAY }, TODAY).ok, "today is allowed");
  assert.ok(validateInput({ ...base, pay: "https://rzp.io/l/abc123" }, TODAY).ok);
  assert.ok(validateInput({ ...base, pay: "" , invoice: ""}, TODAY).ok, "optional fields can be empty");
});

test("messages: exact text for the overdue case (golden)", () => {
  const r = gen();
  assert.equal(r.days, 18);
  assert.equal(r.messages[0].whatsapp, [
    "Hi Ravi Traders,",
    "Hope you're doing well. A quick reminder that invoice INV-12 for Rs 25,000, which was due on 1 Oct 2026, is still showing as unpaid on my side.",
    "You can pay to: asha@okaxis",
    "Could you let me know when I can expect the payment? Thank you!",
    "",
    "Asha",
  ].join("\n"));
  assert.match(r.messages[1].whatsapp, /which was due on 1 Oct 2026 \(18 days ago\)/);
  assert.match(r.messages[2].whatsapp, /Please make the payment by 26 Oct 2026\./);
  assert.match(r.messages[2].whatsapp, /I will have to pause further work until this is settled\./);
  assert.match(r.messages[0].email.body, /^Dear Ravi Traders,/);
  assert.match(r.messages[0].email.body, /Regards,\nAsha$/);
});

test("messages: the amount, due date and deadline printed are exactly the ones entered", () => {
  const r = gen({ amount: "1,25,000.50", due: "2026-09-05", deadline: "2026-11-30" });
  for (const m of r.messages) assert.match(m.whatsapp, /Rs 1,25,000\.50/);
  assert.match(text(r), /5 Sep 2026/);
  assert.match(r.messages[2].whatsapp, /30 Nov 2026/);
});

test("messages: a due date today or in the future never says overdue", () => {
  for (const due of ["2026-10-19", "2026-10-25"]) {
    const r = gen({ due });
    assert.equal(r.overdue, false);
    assert.ok(!/overdue|days ago|still showing as unpaid/i.test(text(r)), due + "\n" + text(r));
  }
  assert.match(gen({ due: "2026-10-19" }).messages[0].whatsapp, /due today/);
});

test("messages: for an invoice that is not due yet, no message claims the payment is missing", () => {
  for (const due of ["2026-10-19", "2026-10-25"]) {
    const t = text(gen({ due }));
    assert.ok(!/haven't received|final reminder|still showing|ago\)/i.test(t), due + "\n" + t);
  }
});

test("messages: optional fields leave no blank placeholders", () => {
  const r = gen({ invoice: "", pay: "" });
  const t = text(r);
  assert.ok(!/undefined|null|\{|\}|invoice  /.test(t), t);
  assert.ok(!t.includes("You can pay to"));
  assert.ok(!/\n\n\n/.test(r.messages[0].whatsapp));
  assert.match(r.messages[0].whatsapp, /my invoice for Rs 25,000/);
  assert.equal(gen({ due: "2026-10-18" }).messages[1].whatsapp.includes("(1 day ago)"), true, "singular day");
});

test("safety: no template ever produces a forbidden phrase, across many input combinations", () => {
  const clients = ["Ravi Traders", "A", "Mrs. D'Souza & Sons", "Ananya Iyer"];
  const amounts = ["1", "999", "25000", "1,25,000.50", "99999999"];
  const dues = ["2026-10-19", "2026-10-18", "2026-10-12", "2026-09-01", "2025-01-01", "2026-12-31"];
  const pays = ["", "asha@okaxis", "https://rzp.io/l/abc123"];
  const invoices = ["", "INV-1"];
  let n = 0;
  for (const client of clients) for (const amount of amounts) for (const due of dues) for (const pay of pays) for (const invoice of invoices) {
    const hits = findForbidden(text(gen({ client, amount, due, pay, invoice })));
    assert.deepEqual(hits, [], `${client} ${amount} ${due} ${pay} ${invoice}`);
    n++;
  }
  assert.ok(n >= 700, `ran ${n} combinations`);
});

test("safety: the forbidden-phrase checker really catches what it should (so the test above is not vacuous)", () => {
  for (const p of FORBIDDEN_PHRASES) assert.deepEqual(findForbidden(`xx ${p.toUpperCase()} yy`), [p]);
  assert.deepEqual(findForbidden("Please pay by 26 Oct 2026."), []);
});

test("safety: visitor-typed words are the visitor's own and pass through unchanged", () => {
  const t = text(gen({ client: "Legal Notice Pvt Ltd" }));
  assert.match(t, /Legal Notice Pvt Ltd/);
});

test("links: encoding survives Unicode, newlines and the rupee text, and stays within a safe length", () => {
  const r = gen({ client: "Ananya Iyer", me: "Zoë Krishnan", invoice: "INV/2026/001" });
  for (const m of r.messages) {
    const wa = whatsappLink(m.whatsapp);
    assert.ok(wa.startsWith("https://wa.me/?text="));
    assert.equal(decodeURIComponent(wa.slice("https://wa.me/?text=".length)), m.whatsapp, "round trip");
    assert.ok(wa.length < 1500, `whatsapp link is ${wa.length} chars`);
    const mt = mailtoLink(m.email);
    assert.ok(mt.startsWith("mailto:?subject="));
    assert.ok(mt.length < 1800, `mailto link is ${mt.length} chars`);
    assert.ok(!/[\n ]/.test(wa) && !/[\n ]/.test(mt), "no raw spaces or newlines in a URL");
  }
  // worst case: maximum length name, client, invoice and payment link
  const big = gen({ me: "m".repeat(60), client: "c".repeat(60), invoice: "i".repeat(30), pay: "https://" + "p".repeat(110) });
  for (const m of big.messages) assert.ok(whatsappLink(m.whatsapp).length < 2500, "worst-case link length");
});

test("generating messages makes no network call and reads no browser state (pure functions)", () => {
  const saved = { fetch: globalThis.fetch };
  globalThis.fetch = () => { throw new Error("network call during generation"); };
  try { gen(); } finally { globalThis.fetch = saved.fetch; }
});

test("greeting: uses 'what you call them' when given, the full client name otherwise, and the optional field is length-checked", () => {
  assert.match(gen({ call: "Ravi" }).messages[0].whatsapp, /^Hi Ravi,\n/);
  assert.match(gen({ call: "Ravi" }).messages[0].email.body, /^Dear Ravi,\n/);
  assert.match(gen({ call: "  " }).messages[0].whatsapp, /^Hi Ravi Traders,\n/);
  assert.match(gen().messages[2].whatsapp, /^Hi Ravi Traders,\n/);
  assert.equal(validateInput({ ...base, call: "x".repeat(31) }, TODAY).ok, false);
  assert.equal(validateInput({ ...base, call: "Ra\nvi" }, TODAY).ok, false);
});

test("a bare phone number as the payment detail gets a specific hint, a number with a bank handle is accepted", () => {
  for (const bad of ["9876543210", "+91 9876543210", "91-9876543210"]) {
    const r = validateInput({ ...base, pay: bad }, TODAY);
    assert.equal(r.ok, false, bad);
    assert.match(r.errors.pay, /bank handle.*9876543210@ybl/, bad);
  }
  assert.equal(validateInput({ ...base, pay: "9876543210@ybl" }, TODAY).ok, true);
});
