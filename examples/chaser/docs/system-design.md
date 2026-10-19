# System design: Chaser v1 (the message-generator test)

Status: draft for the owner to read in full. Everything marked **ASSUMED** was not answered by the owner and needs a yes or a correction. Basis: `docs/research.md` and decision 0001.

## 1. Problem and purpose of v1
v1 is **an experiment, not a product**. It exists to answer three questions from `docs/research.md` section 6: do direct-client Indian freelancers want help writing payment reminders (assumption C), do reminders get used (E), and will anyone pay (C). If the pass conditions are not met, the project stops.

## 2. Roles and tenancy
- **Visitor / freelancer** (anonymous). There are **no accounts, no sign-in, no roles**.
- **Operator** (the owner). Reads aggregate counters; never sees what a visitor typed.
- **Tenancy: none.** Nothing is owned by a user, so there is no per-user data to scope or leak. This is the main reason the design is safe by construction: if the server never receives the client's name, amount or number, it cannot store or leak them.

## 3. Core workflows
1. **Generate.** The visitor enters: client name, invoice number (optional), amount in rupees, due date, optional UPI ID or payment link, their own name, and tone preference. The page produces three messages: **polite** (a few days late), **firm** (two weeks late), **final** (a deadline before further steps). Each comes as WhatsApp text and email text (subject and body). All text is produced **in the browser**; the inputs are not sent anywhere.
2. **Send.** For each message: *Copy*, *Open in WhatsApp* (official `wa.me/?text=` link; the visitor picks the chat and taps send), *Open in email* (`mailto:` link). The product never sends anything.
3. **Signal interest.** A visible *"Remind me automatically (waitlist)"* control. Clicking it records one anonymous counter; optionally the visitor enters an email to join a waitlist (see section 6 for what is stored and why).
4. **Measure.** The operator reads daily counters: visits, messages generated, copy/WhatsApp/email clicks, waitlist clicks, waitlist sign-ups.

## 4. Functional requirements
- F1. Generate three tones from the inputs, with the amount formatted in Indian grouping (Rs 1,25,000) and dates in an unambiguous format.
- F2. Correct handling of missing optional fields (no invoice number, no payment link) without leaving blank placeholders in the text.
- F3. Messages never contain threats, legal claims or deadlines the visitor did not choose. The *final* message names a deadline date the visitor can edit and refers only to "next steps", not to legal action.
- F4. Copy, WhatsApp and email actions per message; works on a phone browser.
- F5. English only in v1 (**ASSUMED**; Hindi and Hinglish templates are the obvious next test, not part of v1).
- F6. A privacy line next to the form: "Nothing you type here leaves your browser."
- F7. Counters via one endpoint that accepts only a fixed list of event names.

## 5. Non-functional requirements
- **Privacy:** no client data, no cookies, no third-party scripts or fonts, no analytics service. This is a requirement, and a test checks that the generate flow makes no network request.
- **Performance:** first load under 100 KB, usable on a 4G phone; generation is instant (pure function).
- **Accessibility:** keyboard operable, labelled fields, contrast AA, works with text zoom.
- **Availability:** best effort. It is a test; an hour of downtime is acceptable (**ASSUMED**).
- **Cost:** near zero. No paid services.
- **Compliance:** see section 7.

## 6. Data
| Data | Where | Personal? | Retained |
|---|---|---|---|
| Form inputs (client name, amount, number, UPI ID) | Browser memory only | Yes (third party's name, maybe a phone number) | Never leaves the page; not saved, not in localStorage |
| Event counters (a count per event name per day) | Server file | No | Indefinitely, aggregate only |
| Waitlist email (optional) | Server file, separate from counters | **Yes** (the freelancer's own email) | Until the test ends, then deleted; deletion on request |

The waitlist is the only personal data the server holds. It is the visitor's **own** address, entered voluntarily next to a one-line notice (what it is used for, how to have it deleted, and who runs it). No client details are ever collected.

## 7. Compliance and platform notes (from research, not legal advice)
- **WhatsApp:** copy-and-send via the official click-to-chat link only; no automation, no business API, no unofficial client. See `docs/research.md` section 5.
- **DPDP Act:** v1 avoids third-party personal data entirely. The waitlist email makes the operator a data fiduciary for a few emails; most duties apply from about May 2027 but the notice and deletion promise are built in now. A lawyer must review before any version stores client contact details.
- **No UPI collect requests**: the product only prints the visitor's UPI ID or link inside the message text.
- **No legal claims** in generated text (F3).

## 8. Out of scope for v1
Accounts and sign-in; storing invoices or clients; automatic sending of any kind; WhatsApp Business API; SMS; invoice creation; payment links or collection; reminders scheduled by the product; calendar integration; multiple languages; mobile apps; payments or billing (a "pay" click is only a counter); an admin UI (counters are read from a file or one authenticated endpoint); any AI-generated text (templates only, so output is predictable and reviewable).

## 9. Success and stop conditions
Taken from `docs/research.md` section 6. Evaluate after a fixed window (**ASSUMED: 14 days, minimum 300 visitors**). **Pass:** at least 5% of visitors who generate messages click the waitlist control and at least 20 join the waitlist; and in 10 short interviews at least 6 had an invoice 14+ days late in the last 6 months. **Stop:** fewer than 20 sign-ups after 300 visitors in two separate windows.

## 10. Capacity sketch (rough, shown with its arithmetic)
- Expected traffic: unknown. Plan for a **spike** if one post gets traction: 5,000 visitors in a day = 5,000 page loads (static, about 60 KB each = 300 MB transfer) and, say, 40% generate = 2,000 generate events, each with 2-3 follow-up clicks = about 8,000 event posts a day. Peak hour about 30% of that = 2,400 posts per hour = under 1 per second.
- A single Node process handles that by orders of magnitude: each event is an in-memory increment plus one buffered file append.
- Storage: counters are a few hundred bytes a day; a waitlist of 1,000 emails is about 40 KB.
- **First bottleneck:** none on the server. The real limits are the host's free-tier bandwidth if traffic spikes, and abuse of the event endpoint (a bot posting millions of events would corrupt the experiment's numbers). Hence F7 and the rate limit in the architecture.

## 11. Open questions for the owner
1. First customer is an individual direct-client freelancer: confirm. (**ASSUMED**)
2. Who is named in the waitlist notice as the operator, and what contact address goes there?
3. Measurement window and minimum visitors (**ASSUMED** 14 days, 300 visitors).
4. Where will traffic come from (a post, a community, friends)? With no traffic source, the experiment cannot pass or fail.
5. Will you run the 10 interviews, or should the plan assume none?
6. Hosting is deferred to the ship phase. Does the owner have a preference or a free credit somewhere?
