⚠️ DEGRADED: single-context design review only (detector binary not run: it would be downloaded on first run, and installs were not authorised)

# DueSoon design audit (Operate mode, web)

Reviewed: public/index.html, styles.css, app.js, due.js, docs/design.md, the six .taste-skill/inspect screenshots, and the dark and empty PNGs. Nothing was modified except this file.

## Verdict

This is a calm, trustworthy, correctly boring tool. It reads as a tool and not a template. The computed finding line, the "Late" bar split out of the 14-day strip, the red overdue chip and the one-hue discipline all fit a student's one question: what is due and what is late. There are no AI-slop tells: no gradients, no glass, no icon-in-circle cards, no decorative motion. The weaknesses are craft, not concept. The phone strip collides with its own labels and sits after the whole list. Rows carry redundant text (an ISO date beside a relative date). The light-theme form controls fall below 3:1 contrast. Interaction states (hover and active) and the placement of feedback are thin. Specificity is moderate: the strip is ownable, and everything else is competent category-standard. For an Operate surface that is the right bar. It needs polish, not redesign.

## Heuristic scores (Nielsen, 0-4)

| # | Heuristic | Score | Evidence |
|---|---|---|---|
| 1 | System status | 3 | Skeleton, error-with-Retry and role=status exist. But the status line sits between form and list, far from the row you ticked (app.js:55, index.html:60). |
| 2 | Match real world | 3 | "Overdue by 2 days", "Due tomorrow", "Late" are student words. Three date formats show at once: native 10/19/2026, ISO 2026-10-17, "28 Oct". |
| 3 | User control | 3 | Delete confirm and edit cancel are good. Ticking done moves the row to the bottom with no undo. |
| 4 | Consistency | 3 | Vocabulary is consistent. Only .act links have :hover. .primary, .secondary and .seg have no hover or active state (styles.css:82,109,133). |
| 5 | Error prevention | 3 | Inline validation, aria-invalid, focus moved to the bad field. Nothing stops a typo year such as 2062 or 2025. |
| 6 | Recognition vs recall | 3 | Labels always visible. Course is free text, so a student retypes "CS301" every time. |
| 7 | Flexibility | 2 | No quick dates (tomorrow, Fri), no course memory, no grouping, no shortcut. Enter-to-add is the only accelerator. |
| 8 | Minimalist design | 3 | Clean. But ISO suffix on every desktop row and Edit/Delete on every row add noise (desktop-fold.jpg). |
| 9 | Error recovery | 3 | Plain-language errors, Retry. No undo for done. |
| 10 | Help | 2 | Empty state repeats the same instruction twice (finding line and dashed box, duplicate-empty in duesoon-empty.png). Nothing explains the strip. |
| | **Total** | **28/40** | Good: solid, fixable polish. |

Cognitive load: low. The add form has 3 fields and 1 button. The visible list is under 10 rows. There is no decision point with more than 4 options. The only checklist miss is the three date formats, a small memory bridge.

## Top 5 problems, ranked

1. **[P1] Phone strip is cramped and buried.**
   - Where: mobile-page-01.jpg shows "Late19" fused into one token and 11px labels. styles.css:139-157 puts the strip last (order:3) on 15 columns at 360px.
   - Why it matters: the signature element is unreadable on the device a student uses most. On a phone it is also below all assignments (9 rows is about 800px of scroll), so it is effectively hidden.
   - Smallest fix: on <=640px give the first (Late) column room (`grid-template-columns: 1.7fr repeat(14,1fr)`) and set labels back to 12px. Optionally put the strip right under the finding line at about 64px tall. The list is still inside the first fold.

2. **[P1] Row noise and wasted height.**
   - Where: desktop-fold.jpg shows "Overdue by 2 days · 2026-10-17" on every row, and the ISO date repeats what the relative label already says. mobile-fold.jpg shows about 99px per row because the due chip is on its own line, so only 4 rows are visible.
   - Why it matters: scanning is the daily job. Fewer rows per screen and more reading per row slow the glance. The ISO date also adds a third date format.
   - Smallest fix: drop `.iso` entirely, or show it only in the `title` tooltip (app.js:221). On mobile put the due label on the course line (grid area "main due") so rows are about 60px.

3. **[P1] Light-theme form controls are too faint.**
   - Where: styles.css:7 `--control:#cfd3d9` on white is about 1.5:1. In desktop-fold.jpg the three empty inputs barely read as fields, and the dashed empty-state border uses the same token.
   - Why it matters: WCAG 1.4.11 needs 3:1 for control boundaries. Students on dim laptops or sunlit phones will not see where to tap. The add form is the most frequent action.
   - Smallest fix: introduce `--control-edge` of about #8a8f98 (about 3.2:1) for input, secondary-button and checkbox borders. Keep `--control` for rules. Check the dark value (#3c3c42 on #131315 is about 1.7:1) in the same pass.

4. **[P2] States and feedback are incomplete for an Operate surface.**
   - Where: no hover or active on `.primary`, `.secondary`, `.seg button` or rows (styles.css). "Marked done." appears in `#status` between form and list (index.html:60). On a phone that line can be off-screen after scrolling, and the ticked row has already jumped away.
   - Why it matters: ticking by mistake loses the row with no cue where it went and no way back, and buttons give no pressed feedback.
   - Smallest fix: add `:hover` and `:active` rules (for example `.primary:hover{opacity:.88}`, `.row:hover{background:var(--raised)}`). Put an "Undo" text button in the status message for done and delete-less actions. Optionally keep the row in place for about 1s before re-sorting.

5. **[P2] The answer line is under-weighted and the copy repeats.**
   - Where: the finding is 15px muted with only "2 overdue" in 500 black (styles.css:52-53). The h1 "Due soon" sits under the brand "DueSoon" in the same bar. duesoon-empty.png shows "Nothing here yet. Add your first assignment below." and then "No assignments yet. Add one above..." (app.js:154 and 203).
   - Why it matters: "what is late?" should be answerable in half a second. When the count is nonzero it deserves the negative colour that the chip and strip already use. Duplicated empty copy and a near-duplicate heading read as unfinished.
   - Smallest fix: colour the `<strong>` with `--negative` when `s.overdue > 0`. Retitle the h1 to something that is not the brand (for example "This week", or drop it and let the finding line be the heading). Make the empty box the only empty message and let the finding line say "Nothing due."

## What works and should not be touched

- The one-hue rule: blue only on the strip, red only for late (chip, "Late" bar, count). Chrome stays achromatic.
- The "Late" bar pulled out of the 14 days, and every zero printed. Direct value labels are better than an axis for small integers.
- Overdue as a pill plus words ("Overdue by 2 days"), not colour alone. Today is bolded text, not a loud badge.
- Phone ordering of form then list, with 44px targets, 16px inputs (no iOS zoom), and the course and date pair on one row.
- Inline add form with Enter to submit, focus restored after every re-render, confirm-before-delete inline (no modal), skip link, aria-live finding, aria-labelled strip.
- Skeleton rows at real height, and an error state with Retry kept inside the list frame.
- Dark theme is a faithful twin: contrast holds, the chip reads, the strip hues are lifted. Geist in a tight 12/14/16/24 scale, a single family, no display font in labels.

## Minor observations

- The strip shows day numbers only, so "19 ... 31 | 1" has no weekday or month cue. Adding a weekday letter row or a month tick at the 1st would help. 9 of 15 columns are zero, so the chart is mostly baseline, and the blue bars are the heaviest ink on the page above the list the student acts on.
- Bar `title` tooltips do nothing on touch; the aria-label carries the data for screen readers only.
- Edit and Delete sit about 10px apart on phones (mobile-fold.jpg). The confirm step mitigates it. A wider gap or an overflow menu would be safer.
- `.primary:disabled` is styled but the add button is never disabled when empty, so the style is unused.
- duesoon-dark.png is cropped at about 813px with black beneath. This looks like a capture artifact, not a layout bug. Verify.

## Not checked

- The live app was not run: no hover, focus-ring, keyboard-order or motion behaviour was observed. Findings come from CSS, JS and screenshots only.
- Screen-reader output (announcement order of the status, finding and strip aria-labels).
- Computed contrast values are estimated from hex tokens, not measured. Dark `--control` and the dark pill were not checked numerically.
- Auth screen, edit-row, delete-confirm and error states have no screenshots and were judged from code only.
- Worst-case data (very long titles or courses, 100+ rows, many items on one day so the bar scale saturates, strip with a single huge count).
- Real-device touch, text zoom at 200%, Windows high-contrast mode, and the Geist font failing to load.
- Right-to-left, non-Latin text, and locales whose native date picker order differs from the ISO strings.
