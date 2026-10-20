import { parseAmountToPaise, parseDate, daysBetween } from "./format.js";

const CONTROL = /[\u0000-\u001f\u007f\u2028\u2029]/;
const UPI_ID = /^[a-zA-Z0-9._-]{2,64}@[a-zA-Z][a-zA-Z0-9.-]{1,30}$/;
const HTTPS_LINK = /^https:\/\/[^\s]{4,200}$/;

/**
 * Check the form inputs. `today` is "YYYY-MM-DD" (the visitor's device date), passed in so this stays pure and testable.
 * Returns { ok, errors: { field: message }, value } where value has the cleaned inputs.
 */
export function validateInput(raw, today) {
  const errors = {};
  const text = (key, label, max, required = true) => {
    const v = typeof raw?.[key] === "string" ? raw[key].trim() : "";
    if (!v) { if (required) errors[key] = `Enter ${label}.`; return ""; }
    if (v.length > max) errors[key] = `${label[0].toUpperCase() + label.slice(1)} must be ${max} characters or fewer.`;
    else if (CONTROL.test(v)) errors[key] = `${label[0].toUpperCase() + label.slice(1)} cannot contain line breaks.`;
    return v;
  };
  const value = {
    me: text("me", "your name", 60),
    client: text("client", "the client's name", 60),
    call: text("call", "what you call them", 30, false),
    invoice: text("invoice", "the invoice number", 30, false),
    pay: text("pay", "a UPI ID or payment link", 120, false),
  };
  const paise = parseAmountToPaise(raw?.amount);
  if (paise === null) errors.amount = "Enter the amount as a number, for example 25000 or 1,25,000.50 (up to Rs 100 crore).";
  value.paise = paise;

  const due = parseDate(raw?.due);
  if (!due) errors.due = "Pick the invoice's due date.";
  value.due = raw?.due;
  const dl = parseDate(raw?.deadline);
  if (!dl) errors.deadline = "Pick the date you want to be paid by.";
  else if (parseDate(today) && daysBetween(today, raw.deadline) < 0) errors.deadline = "That date has passed. Pick today or a later date.";
  value.deadline = raw?.deadline;

  if (value.pay && !errors.pay && /^\+?(91)?[\s-]?\d{10}$/.test(value.pay)) {
    errors.pay = "A phone number alone is not a UPI ID. Add your bank handle after it, for example 9876543210@ybl, or leave this empty.";
  } else if (value.pay && !errors.pay && !UPI_ID.test(value.pay) && !HTTPS_LINK.test(value.pay)) {
    errors.pay = "That does not look like a UPI ID (name@bank) or an https payment link. Check it, or leave it empty.";
  }
  return { ok: Object.keys(errors).length === 0, errors, value };
}
