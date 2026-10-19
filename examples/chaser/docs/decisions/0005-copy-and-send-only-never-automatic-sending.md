# 0005. Copy-and-send only, never automatic sending

- Date: 2026-10-19T20:20:06Z
- Phase: plan

## Decision
WhatsApp via the official wa.me click-to-chat link and email via mailto; no business API, no automation, no upi:// deep link, one message at a time.

## Why
Research (docs/research.md section 5) shows automation from a personal number violates WhatsApp's guidelines and the business API requires recipient opt-in.

## Alternatives considered
- WhatsApp Business API: rejected, needs approved templates and recipient opt-in the debtor has not given.
- Unofficial WhatsApp automation: rejected, violates the terms and risks the user's account.
- SMS: rejected for v1, needs TRAI DLT registration.

## Consequences
- The visitor stays in control of every message, so the product cannot be accused of automated messaging.
- Value stays manual for the user; this is the main limit on how much people will pay.
- Spam-report risk remains; the page tells users to message only people they already work with.
