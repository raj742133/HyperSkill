# Design: DueSoon

Direction dealt by the taste-skill app run (`draw.mjs --app`, seed 1404535244, 2026-10-19).

- **Style:** `achromatic-ledger` (light, with a dark twin). Chosen because DueSoon is opened for a quick daily look by one person: the chrome holds no colour, the only hue is on the screen's own data.
- **Redraw:** the shell. The sheet dealt a labelled sidebar (then an icon rail on a redraw). DueSoon is one screen with no destinations, so I used the reference's "No sidebar" shell: a 48px top bar over a centred 760px column. Reason: a nav with one item is decoration.
- **Screen's one question:** "What is due next, and is anything overdue?"
- **The one finding** (computed, line under the title): "2 overdue. 4 due in the next 7 days. 8 open in all."
- **Most frequent job:** add an assignment (inline form above the list; Enter submits). Second: tick one off (one click on its row).
- **Its face:** a blue-grey ground (`#f2f4f7`); the single hue (`#1d5fbf`) only on the 14-day strip; overdue in the negative colour as a small chip and the strip's first bar.
- **Signature element:** the 14-day strip, a count per day with every zero printed, overdue pulled out as its own "Late" bar. Direct value labels replace a y-axis because counts are small integers.
- **Type:** Geist 400/500/700, self-hosted (`public/fonts`, SIL OFL included). 700 only for the title.
- **Tokens:** `public/styles.css` `:root`. Radius 8 (cards) and 6 (controls), 12px gap, 24px canvas padding, no shadows, 1px borders.
- **States built and checked:** loading (grey rows at real size), empty (frame kept, one sentence), error (inside the list with Retry), offline (status line), success (status line), hover/focus (visible 2px outline), confirm-before-delete.
- **Phone:** the list comes before the strip so the first row is in the top 60% of the screen; course and date share a row; 44px touch targets; due date drops its ISO suffix.
- **Keyboard:** focus is restored to the same control after every re-render.

## Sample data to replace
`scripts/preview.js` and `scripts/seed-demo.js` create a demo student and assignments. They are development helpers; the product ships with no sample data.

## Known gaps
No `/design` page (one screen, about six components; tokens live in `styles.css`). No motion beyond focus and hover, so the animation slot was not used.
