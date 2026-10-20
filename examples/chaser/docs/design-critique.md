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

## Designer pass on the running page (second round, 2026-10-20)

Evidence: `docs/screenshots/before/` (the build before the first critique, regenerated from commit 602c5f1) against `docs/screenshots/` (now). Two fresh read-only reviewers, neither of whom built the page. Their reports are findings, not instructions.

**5-second test** (reviewer saw only the two first-screen screenshots). Got right: it turns one unpaid invoice into three reminders for WhatsApp and email, for freelancers in India. Hesitations: the privacy box asks for trust before any payoff; "send yourself" can read as "send to yourself"; the sample quote looks like a quotation, not example output; no button or preview of the three tones on the first screen. Not changed: the button sits below the form on purpose, and the date field format follows the visitor's browser (the screenshots use a US locale).

**10-problem review** (reviewer drove the running page at 1100px and 375px, light and dark):

| # | Finding | Status |
|---|---|---|
| 1 | Greeting uses the full client name ("Hi Ravi Kumar"), sample says "Hi Ravi" | **Fixed.** A first-word greeting would break on "Dr Rao" and company names, so there is a new optional field "What you call them"; empty means the full name as before (unit and browser tests) |
| 2 | The rupee sign was rejected; a bare phone number is not a valid UPI ID | **Fixed.** The rupee sign is accepted, and a bare phone number now gets a specific hint to add the bank handle, e.g. 9876543210@ybl (unit tests) |
| 3 | Email version could not be copied | **Fixed.** "Copy email" copies subject and text (browser test added) |
| 4 | Fixed wording; "pause further work" is wrong if work is finished | **Mitigated.** Line added above the cards: edit anything that is not true for you. A "work is ongoing" switch is open |
| 5 | Invoice not yet due still shows Firm and Final cards | **Fixed.** Not overdue: only Polite is shown, the other two wait behind "Show the firm and final messages" (browser test) |
| 6 | Writing the messages again silently overwrites edits | **Fixed.** Writing again asks before replacing edited text; Cancel keeps the edits (browser test) |
| 7 | Error summary duplicates inline errors, uses default link colours | **Half fixed.** Links now use the theme error colour. Duplication kept: the summary is how a screen reader and keyboard user finds the first error |
| 8 | Focus lost to the page after "I would pay for this" | **Fixed.** Focus moves to the confirmation (browser test added) |
| 9 | "Pick the contact" hint far from the buttons | **Fixed.** Moved under the summary, before the cards |
| 10 | On a phone the suggested card is second, results start far down | **Fixed.** The suggested card comes first (browser test) |

After the first round: 39 of 39 unit tests, 18 of 18 browser tests (axe included, light and dark) pass. Second round (findings 1, 5, 6, 10 above): 40 of 40 unit tests, 19 of 19 browser tests, and the mutation check kills every mutant. Third round: unit tests 41 of 41. Still open: a "work is ongoing" switch (4), and the summary/inline error duplication (7, kept on purpose).
