# System design: Chaser v1 (the message-generator test)

Status: revision 2, after an independent review (`design-review.md`). For the owner to read in full. Everything marked **ASSUMED** was not answered by the owner and needs a yes or a correction. Basis: `research.md` and decision 0001.

## 1. Problem and purpose of v1
v1 is **an experiment, not a product**. It tests two of the five assumptions in `research.md` section 6: that freelancers want help writing payment reminders and use the result (C, E in part), and that some would pay (C). **The page cannot test A, B or D** (how often invoices are late, why free tools are not enough, whether delays are forgetting or ghosting). Those need interviews, listed in section 9. If the pass conditions are not met, the project stops.

## 2. Roles and tenancy
- **Visitor / freelancer** (anonymous). No accounts, no sign-in, no roles.
- **Operator** (the owner). Reads aggregate counters and the waitlist file; never sees what a visitor typed.
- **Tenancy: none.** Nothing is owned by a user. The client data a visitor types is never received by the server, so it cannot be stored or leaked by it. This is true of the form inputs only; the waitlist email and the host's access logs are separate (sections 6 and 7).

## 3. Core workflows
1. **Generate.** The visitor enters: their own name, client name, amount in rupees, due date (a date picker, not free text), optional invoice number, optional UPI ID or payment link, and (for the final message) a deadline date they choose. The page produces three messages: **polite**, **firm**, **final**. Each has WhatsApp text and email text (subject and body). Text is produced in the browser by templates; no AI is used.
2. **Check and send.** Each message shows a read-only preview of the exact amount and UPI ID/link it will contain, with the warning "Check these before you send". Actions: *Copy*, *Open in WhatsApp* (official `https://wa.me/?text=`; the visitor picks the chat and taps send), *Open in email* (`mailto:`). The product never sends anything, and there is no "send to many".
3. **Priced fake door.** A control labelled *"Send these reminders for me automatically: Rs 149 a month"* (**ASSUMED** price). Clicking it opens a second step: "This is not built yet. Leave your email to be first at this price", with the optional email field. Clicking the priced control is the **pay-intent event**; submitting an email is a separate event.
4. **Did you send it?** After a WhatsApp or email click, a one-line optional prompt: "Did you send it? Yes / No". It is a counter, not a record.
5. **Measure.** The operator reads daily counters by traffic source (section 8).

## 4. Functional requirements
- F1. Three tones from the inputs. Amounts render in Indian grouping with decimals shown only when entered (Rs 1,25,000 or Rs 1,25,000.50, including above a crore). Accept digits, commas and a decimal point; reject zero, negative and absurd values (over Rs 100 crore) with a clear message. The text uses "Rs" (not the rupee symbol) so it survives every WhatsApp client.
- F2. Dates render with a month name ("19 Oct 2026"), never numeric day/month. "Days late" is computed from the visitor's device date, shown to the visitor so they can correct it. If the due date is in the future, the messages must not say "overdue"; they become a friendly "payment is due on" reminder.
- F3. **Text safety.** Generated text never contains, unless the visitor typed them into a field: "legal action", "police", "court", "notice", "lawyer", "defaulter", "fraud", "cheat", "blacklist", "report to your employer", "interest", "penalty", "late fee". The final message's default consequence is "I will have to pause further work until this is settled". Its deadline is the date the visitor entered; a past date is rejected. The page states "You are responsible for what you send."
- F4. Part payment, GST breakdowns and multiple invoices are not supported, and the page says so. The amount printed is exactly the number the visitor typed (the preview shows it), never a computed balance.
- F5. English only. **Accepted risk:** many Indian freelancers write in Hinglish on WhatsApp, so an English-only result could understate demand. One Hinglish version of the polite message is the first follow-up test and is not in v1.
- F6. Privacy line: "We never receive what you type here. When you tap WhatsApp or email, that app receives the message, because that is how sending works." Plus: "Message only people you already work with." No UPI deep link (`upi://`) in v1.
- F7. One counter endpoint with a fixed allowlist of event names (section 8). Anything else is rejected.
- F8. Client-side inputs use `autocomplete="off"`, no form data in URLs or fragments, outbound links carry `rel="noopener noreferrer"`.

## 5. Non-functional requirements
- **Privacy:** no cookies, no local or session storage, no third-party scripts, fonts or analytics. The Content-Security-Policy limits `connect-src` to the page's own origin, so a stray request to anywhere else is blocked in production. A test also fails if the generate flow makes any network request.
- **Performance:** first load under 100 KB; generation is instant.
- **Accessibility:** keyboard operable, labelled fields, AA contrast, usable at 200% text zoom.
- **Availability:** best effort; an hour of downtime is acceptable (**ASSUMED**).
- **Cost:** near zero; no paid services.

## 6. Data
| Data | Where | Personal? | Retained |
|---|---|---|---|
| Form inputs | Browser memory only | Yes (third party's name, maybe a number) | Never leaves the page; not saved |
| Event counters (count per event, per source, per day) | Server file | No | Until the test ends |
| Waitlist email (optional, the visitor's own address) | Server file, separate from counters, with timestamp and notice version | **Yes** | Until the stated end date, then deleted; earlier on request |
| Rate-limit state (IP address) | Server memory only, hashed with a per-process salt, never written to disk | Yes (briefly) | Minutes; lost on restart |
| Hosting access logs (IP, URL, referrer, user agent) | **Kept by the host, outside this app** | Yes | Per the host's policy; disclosed in the notice |

The waitlist form shows a notice naming the operator and a contact address (**blocker: open question 2**), what the email is used for, the end date, and how to ask for deletion. Unconfirmed emails (no confirmation mail is sent in v1) do not count toward the pass condition. The endpoint has a honeypot field and a per-IP hourly limit, so strangers cannot easily sign up other people.

## 7. Compliance and platform notes (research, not legal advice)
- **WhatsApp:** copy-and-send via the official click-to-chat link only; no automation, no business API, no unofficial client. Research warns this avoids automation but not spam reports, hence "message only people you already work with".
- **DPDP Act:** v1 avoids third-party personal data entirely. The waitlist email and the IP-based limiter make the operator a data fiduciary for very little data; most duties apply from about May 2027, but notice and deletion are built in now. A lawyer must review before any version stores client contact details.
- **No UPI collect requests**, and no UPI deep link. The visitor's own UPI ID or link is only printed in the message text, after a preview.
- **No legal claims, fees or interest** in generated text (F3).

## 8. Metrics, defined exactly
Every metric is an **event count**; there is no unique-visitor count (no cookies), so **page loads are the accepted proxy for visitors** and reloads and repeat visits inflate it. Events:

`page_ready` (fired by script once per page load), `generate`, `copy`, `open_whatsapp`, `open_email`, `sent_yes`, `sent_no`, `pay_intent`, `waitlist_submit`.

Rules: each event posts at most once per page load per message (a JavaScript variable, no storage); the server ignores user agents that look like bots and requests without a preceding `page_ready` from the same load (a per-load random token held in memory); each event carries a `src` tag taken from `?src=` (an allowlist the operator defines: e.g. `me`, `friends`, `community`, `post`); the owner's own visits use `?src=me`, which is recorded but excluded from every decision (a secret in the URL would leak into host logs, so there is no separate operator switch).

Ratios used in the decision: **generate rate** = `generate` / `page_ready`; **pay-intent rate** = `pay_intent` / `generate`; **waitlist rate** = `waitlist_submit` / `pay_intent`; **use rate** = `sent_yes` / (`open_whatsapp` + `open_email`).
Counts are reported per `src`; results from `me` and `friends` are excluded from any pass or stop decision. `src` values outside the operator's allowlist are recorded as `none`.

## 9. Success, stop and decision rule
Window: **ASSUMED** 14 days from first public traffic, and at least 100 `generate` events from sources other than `me` and `friends`. If traffic is below that at 14 days, **extend; do not conclude.**
- **Pass (page):** pay-intent rate at least 5% and at least 20 unconfirmed-or-confirmed `waitlist_submit` events from outside sources, and use rate at least 40%.
- **Pass (interviews):** in 10 short interviews, at least 6 had an invoice 14 or more days late in the last 6 months, and at least 5 chase by hand despite having an invoicing app or invoice outside any app.
- **Mixed or borderline** (for example 15 sign-ups and a pay-intent rate of 8%): extend one more window; do not treat as pass.
- **Stop:** fewer than 20 sign-ups in two separate windows that each met the traffic minimum.
- **Noise warning:** with about 100 generators, 5% is five clicks; a result near the threshold is weak. Treat the outcome as a signal to continue or stop, not as proof. Record the traffic source mix with the result.
- Interviews are recruited by the owner (**open question 5**); the page cannot record answers, so interview results are written to `docs/interviews.md`.

## 10. Out of scope for v1
Accounts and sign-in; storing invoices or clients; automatic sending of any kind; WhatsApp Business API; SMS; invoice creation; payment links, UPI deep links or collection; reminders scheduled by the product; calendar integration; Hindi or Hinglish text; mobile apps; real payments or billing; an admin UI; any AI-generated text; confirmation emails; sending to many recipients; part-payment and GST handling.

## 11. Capacity sketch
Rough only. A spike of 5,000 page loads in a day with 40% generating and about 4 follow-up events each is about 8,000 event posts a day, under one per second at peak. A single Node process serves that easily; the real limits are the host's free-tier bandwidth and bots inflating the counters (handled in section 8). **First bottleneck: bot and abuse traffic on the event endpoint, not capacity.** Hosting is decided early in the ship phase because a persistent disk (or a managed counter) is required.

## 12. Open questions for the owner
1. First customer is an individual direct-client freelancer. Confirm. (**ASSUMED**)
2. **Blocker:** who is named as operator in the waitlist notice, and what contact address? And what end date for the test?
3. Is Rs 149 a month the price to test, and is a single price enough? (**ASSUMED**)
4. Where will traffic come from, and which `src` tags do you want? With no traffic source, the experiment cannot pass or fail.
5. Will you run the 10 interviews yourself, and how will you recruit them?
6. Hosting preference or free credits? Decided at the ship phase.
