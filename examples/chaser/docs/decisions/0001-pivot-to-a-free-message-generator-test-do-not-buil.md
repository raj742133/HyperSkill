# 0001. Pivot to a free message-generator test; do not build the tracker yet

- Date: 2026-10-19T20:17:19Z
- Phase: research

## Decision
Build only a no-accounts page that generates three ready-to-send payment reminders (polite, firm, final) with a one-tap WhatsApp link, and measure demand and willingness to pay against the pass conditions in docs/research.md section 6.

## Why
Free incumbents already include reminders, demand evidence is old or foreign, and nobody is shown paying. The owner chose this option in chat on 2026-10-19 after reading the research summary.

## Alternatives considered
- Build the full tracker (accounts, stored invoices, scheduled reminders): rejected, because the research shows free tools already include reminders and shows no one paying.
- Stop now: rejected, because the niche (off-platform invoices, tone, user-sent WhatsApp) is untested rather than disproved, and a one-page test is cheap.
- Priced fake door on a bare page with no useful output: rejected, because it would measure curiosity about a promise instead of use of a real result.

## Consequences
- v1 delivers real value (three usable messages) without storing any client data, which also removes most of the privacy and legal exposure.
- The test can only prove demand for message writing and pay intent. How often invoices are late, why free tools fall short and whether reminders change outcomes need interviews (design section 9).
- The result has wide uncertainty at low traffic, and no traffic source is yet identified.
- The project stops if the pass conditions are not met in two windows.
