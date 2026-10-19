# Research: DueSoon

Date: 2026-10-19. Confidence: **low to medium** (blog reviews and two small surveys; no interviews).

## 1. Problem and user
- **User:** undergraduate students (e.g. BCA / BSc CS / BTech) juggling several courses with separate deadlines.
- **Job:** "Tell me what is due next so I stop missing or rushing deadlines."
- **Today:** a mix of the college portal, WhatsApp groups, notes apps and memory.

## 2. Evidence of demand (honest)
| Evidence | Source | What it shows | Strength |
|---|---|---|---|
| Survey-based study: about half of undergraduate respondents often put off academic work; poor time management, fear of failure and distraction named | [DOAJ record, J. Educational, Cultural and Psychological Studies, Dec 2023](https://doaj.org/article/5ba67ee7b0b044e48e63a04db811e44f) | The problem exists | Weak: small, local sample; shows the problem, not demand for an app |
| Widely reposted article claims "up to 45% miss deadlines more than once" | several mirrored blog posts | nothing: no traceable study | **Unverified, do not use** |

No interviews, waitlist, search-volume or willingness-to-pay data were gathered. **Demand for this specific app is unproven.**

## 3. Alternatives
| Alternative | Strength | Weakness | Source |
|---|---|---|---|
| Notion (free tier; Plus free for eligible students) | Very flexible: notes, deadlines, plans | Setup effort; no built-in automation | [Save My Exams comparison](https://www.savemyexams.com/learning-hub/useful-resources/best-productivity-apps-for-students/) |
| Todoist (free; Pro about GBP 6.99/mo) | Fast capture, reminders | Not school-specific | same |
| MyStudyLife (free; plus about GBP 4.99/mo) | Student-specific timetable, assignments, exams; works offline | Dated design; mostly manual entry; few integrations | same; also [Coursicle roundup](https://www.coursicle.com/blog/best-assignment-trackers-for-college-students/) |
| Spreadsheet / paper / "do nothing" | Zero cost, zero friction | Easy to ignore, no reminders | assumption (no source) |
Prices come from blog reviews and may be stale.

## 4. Market and money
Not researched: no reliable sizing or pricing data found. Free competitors cover the basics, so any paid plan is a long shot.

## 5. Legal, compliance, platform risk
Stores email addresses, password hashes and assignment titles/courses (free text that can contain personal data). Notes are out of v1 scope. Students may be minors in some regions; GDPR/DPDP-style rules apply to the account data. Out of scope for this test: payments.

## 6. Riskiest assumptions (tests are optional for a learning build)
| Assumption | Why it could be false | Cheapest test | Pass condition |
|---|---|---|---|
| Students want yet another tracker | Free tools already exist | 5 interviews with students about how they track deadlines now | 3 of 5 say they have missed a deadline this term and have no good system |
| Fast capture beats the incumbents | Todoist is already fast | Time how long it takes to add 5 assignments in each tool | Under 30 s for the 5 |
| People will return daily | Utility apps decay | Landing page + 20 sign-ups, check week-2 return | 8 of 20 return |

## 7. Recommendation
**Pivot-to-proceed as a learning build, not as a business bet.** Build the narrowest v1: sign up, add an assignment with a due date, list "due soon" sorted by date, mark done. Everything else is out of v1 (payments, notes, calendar sync, reminders by email, teams, mobile app, AI).

## 8. Open questions for the owner
Is this a business or a learning exercise? Which students (country, course type)?
