---
name: hs-design-review
description: A design critique that ranks findings and gives the exact fix for each - blocking, important, polish - with the evidence that it is a problem. Use when the screens exist and need a critique before the designer-pass gate, when the user asks for a design review, or when a UI feels off and nobody can say why.
---

# hs-design-review

A critique is only worth having if it can be acted on. This one ranks what it finds, says exactly what to change, and proves each finding. It is a method, not a mood: no "feels cluttered" without the thing that makes it so.

## Before you judge

1. Say who the screen is for and the one job it has to do, in a sentence each. A finding that does not touch that job is at most polish.
2. Look at the running page at phone and desktop width (the `browser-verify` slot), light and dark if both exist. Do not review from source.
3. Run the measurements first, so opinion does not argue with numbers: `hs-a11y-review` (contrast), `hs-responsive` (overflow, targets). Their failures are blocking findings by definition.

## Look at, in this order

1. **Purpose and hierarchy.** What is the first thing the eye lands on, and is it the right thing? Is there one primary action per screen? Can a stranger say what this is in five seconds?
2. **Content.** Real copy, real numbers, real names. Any invented statistic, logo or quote is a blocking finding. Headlines say something; buttons say what they do.
3. **Layout and rhythm.** One spacing scale, one grid, alignment that is deliberate; related things grouped, unrelated things apart. Empty areas are decisions, not leftovers.
4. **Type.** At most two families; a clear scale; body 16px or more; line length 45 to 75 characters; no centred paragraphs of more than three lines.
5. **Colour.** A small palette with a job for each colour; one accent; contrast measured, not eyeballed; colour never the only signal.
6. **Components and states.** Every interactive thing has hover, focus, active, disabled, loading, empty and error states, and they look related. Consistent radii, borders, shadows.
7. **Motion.** Only where it explains something; short; stoppable; respects reduced motion.
8. **Generic-look tells.** Gradients and glows used as decoration, icon-in-a-tinted-square feature cards, three identical cards in a row, stock hero with a floating mockup. Name them and say what to do instead (the catalogue's "design tells" group has before-and-after pictures).

## Write it down

Create `docs/design-audit.md`. One block per finding, ranked **blocking** (a user cannot do the job, the content is false, a measured failure), **important** (hurts the job or the brand; fix before launch), **polish** (a craft detail). Every block has the same four lines:

```
BLOCKING  The only button on the page is grey on grey
  Evidence: screenshot at 390px; .btn is #ddd on #eee (1.3:1)
  Why:      the one action the page exists for is invisible
  Fix:      .btn { background: #1b4dff; color: #fff } (8.6:1), and keep the focus ring
```

Then a short list of what is **already good**, so nobody removes it. Finish with the three changes that would improve the screen most, in order.

## Rules

- A finding without evidence is an opinion; leave it out or label it a question.
- Do not rewrite the design while reviewing. Propose the smallest change that fixes each finding.
- The reviewer should not be the context that built the screen: run this in a fresh context (`hs-reviewer`) where possible.
- Say what you did not look at (a flow you did not click through, a width you did not test).
