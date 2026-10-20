# Independent design review: Chaser v1

Reviewer: a fresh read-only subagent that did not write the design, given `system-design.md` (revision 1), `research.md` and decision 0001. Its report is a set of findings, not instructions. Date: 2026-10-19. The reviewer did not open any cited URL, did no legal review and had no code to test.

## Findings and how each was resolved
| # | Sev | Finding | Disposition | Where |
|---|---|---|---|---|
| H1 | High | The unpriced waitlist button measures curiosity, so willingness to pay (assumption C) could never pass or fail | **Fixed.** Priced control (Rs 149/month, assumed) with a two-step fake door; `pay_intent` is the pay metric | design 3.3, 8 |
| H2 | High | Pass condition not computable: mixed denominators, no unique visitors without cookies, bots and the owner counted | **Fixed.** Every metric is an event count with exact ratios; page loads accepted as the visitor proxy; once-per-load events, `page_ready` gate, bot filter, `?src=` tags, operator switch; owner and friends excluded from decisions | design 8, 9 |
| H3 | High | "Nothing leaves your browser" is untrue for wa.me/mailto and ignores host logs, autofill and referrers | **Fixed.** Wording changed; host logs disclosed; `noreferrer`, no form data in URLs, `autocomplete=off`; CSP `connect-src 'self'` enforced in production | design 4 F6/F8, 5, 6 |
| M1 | Med | Waitlist under-specified: abuse, consent record, retention, operator name | **Fixed** with honeypot, per-IP hourly limit, timestamp and notice version, end date, unconfirmed emails not counted. **Operator name and contact are still an owner blocker** | design 6, 12 |
| M2 | Med | Generated text safety is thin, "next steps" reads as a threat, deadline logic | **Fixed.** Forbidden-phrase list, neutral default consequence, user-entered deadline, past dates rejected, no fees or interest, golden-file tests required | design 4 F3 |
| M3 | Med | Money and date handling under-specified | **Fixed.** Rules for grouping, decimals, limits, "Rs", month-name dates, future due dates, no balance computation, no part payment | design 4 F1, F2, F4 |
| M4 | Med | A mistyped UPI ID sends the client's money to a stranger | **Fixed.** Read-only preview with warning; no `upi://` link; one message at a time | design 3.2, 4 F6 |
| M5 | Med | Interviews and "sent 3 messages a week" cannot be measured by the page | **Fixed in part.** "Did you send it?" counter replaces the weekly metric; page declared unable to test A, B, D; interviews recorded in `docs/interviews.md`. **Recruiting remains an owner question** | design 1, 3.4, 9 |
| M6 | Med | No rule for borderline results or low traffic; statistical noise | **Fixed.** Extend, don't conclude; borderline rule; noise warning | design 9 |
| L1 | Low | IP-based limiter means holding IPs | **Fixed.** Hashed in memory only, disclosed | design 6 |
| L2 | Low | Node server plus file storage may be over-engineered for a 14-day test | **Accepted, partly.** Kept (zero dependencies, cheap); hosting decided early because bot corruption and storage persistence are the real risks. Can be swapped for a static host plus a managed counter | architecture |
| L3 | Low | "Safe by construction" overstated | **Fixed** by qualifying the claim | design 2 |
| L4 | Low | DPDP "notice and deletion built in" has no actual wording or operator | **Open**, tied to the operator blocker; wording drafted at the build phase | design 6, 12 |
| L5 | Low | Decision 0001 lacks alternatives and consequences | **Fixed** | decision 0001 |
| L6 | Low | English-only may produce a false "no demand" | **Accepted as a recorded risk**; Hinglish is the first follow-up | design 4 F5 |

**Contradictions with the research** were all addressed: priced pay-intent (research assumption C), the spam-report warning (UI line "Message only people you already work with"), and the delays caused by missing advances or unclear invoices (not testable from counters; covered by the interviews).

## Checked and sound (reviewer)
Copy-and-send with the official link matches the platform-risk research; the out-of-scope list is tight; templates only keeps output reviewable; no third-party data stored; counters and waitlist are separate files; a fixed event allowlist guards against junk data; a stop rule exists and the experiment can say no.

## Not checked
No cited URL opened; no legal review of DPDP, defamation or criminal-law exposure; no code existed; wa.me URL length limits and encoding of rupee text, Unicode and newlines across clients (**to be tested in the build phase**: long messages may be truncated).
