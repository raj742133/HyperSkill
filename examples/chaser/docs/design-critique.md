# Independent design critique: Chaser page

Reviewer: a fresh read-only subagent that did not build the page. It saw screenshots and code only and did not run the app (it did not open desktop-light 1 and 3 or phone-dark 3). Its report is a set of findings, not instructions. Date: 2026-10-19. Contrast ratios below are the reviewer's own estimates from the CSS tokens.

| # | Sev | Finding | What was done |
|---|---|---|---|
| 1 | High | Message boxes clipped the text, including the final message's deadline | **Fixed.** Boxes size to their text on render and on edit (plus `field-sizing: content`); an e2e test fails if any box scrolls |
| 2 | High | Nothing said which message to use; three identical green buttons | **Fixed.** Summary says "Suggested: start with Firm" (by days late), the card is tagged and outlined, the other cards' WhatsApp buttons are quiet |
| 3 | High | Privacy copy overclaimed ("nothing leaves your browser" is false once you tap WhatsApp) | **Fixed.** Now "Our server never sees the invoice details you enter"; "message only people you already work with" moved out of the trust box |
| 4 | Med | First screen spent space on the header bar and a long privacy box; no sample output | **Fixed.** Header bar removed, one-sentence privacy line, a sample line of the first message |
| 5 | Med | Email route buried; 32px target; WhatsApp's recipient step unexplained | **Fixed.** 44px summary target; hint "WhatsApp will ask you to pick the contact" |
| 6 | Med | "Check before you send" looked like the message cards, omitted the client name, went stale on edits | **Fixed.** Tinted block, Client row added, softer wording, note that edits are not reflected |
| 7 | Med | Door block nearly invisible in dark mode (rule borders about 1.3:1); focus jumped to the email field | **Fixed.** Dashed border and textarea border use the stronger edge colour (3.7:1 light, 5.3:1 dark); auto-focus removed; spacing and wording ("Thanks, noted.") changed |
| 8 | Med-low | Padding left about 318px of input width at 390px and far less at 200% zoom; submit not full width | **Partly fixed.** Smaller card padding on phones, 12px page padding under 380px, full-width submit. 200% zoom is estimated, not tested; the type scale was not collapsed |
| - | Low | Pay-by label confusing; defensive footer line; Yes/No at 40px; focus ring on the results region | **Fixed:** pay-by starts a week from today, footer line removed, 44px buttons, no outline on the programmatic focus target |

**Contrast** (reviewer's estimate): muted text 6.9:1 light and 7.9:1 dark; white on accent 6.4:1; error on white 6.5:1; input border 3.7:1 light and 5.3:1 dark. The decorative `--rule` borders (1.3:1) no longer carry meaning that matters.

**Kept as is** (reviewer's "works" list): the headline and lede, plain "Rs" and Indian grouping, the single-column phone form with 46px inputs and visible labels, the error summary with jump links, the check block placed before the messages, the copy fallback, the honest "Chaser does not send anything yet" door copy.

**Not checked by anyone:** real Android rendering and fonts, Devanagari and other Unicode names, the native Android date picker, the keyboard overlay, actual WhatsApp and mailto behaviour, the 200% zoom layout, hover states, load time. The automated checks (axe in light and dark, 375px width, 44px targets, keyboard-only path) passed after the changes.
