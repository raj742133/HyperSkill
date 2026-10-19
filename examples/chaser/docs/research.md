# Research: Chaser (late-payment follow-up for Indian freelancers)

Date: 2026-10-19. Method: four parallel researcher agents, one angle each (raw briefs in `docs/research-raw/`). **Every page was read through search-result summaries only; the fetch tool failed on every host, so no page was opened in full and no price was checked on a vendor's own site.** Confidence is stated per claim. Overall confidence in the demand evidence: **low**. Overall confidence in "free tools already cover reminders": **medium**.

**Link check (2026-10-19, HTTP status only; a 200 does not prove the page says what is claimed):** 34 cited URLs: 27 returned 200. Four returned 403 (peerlist.io x3, yourstory.com; likely bot blocking, unverified), `indbiz.gov.in` did not respond, `razorpay.com/docs/payment-links/reminders` returned 404, `pn.ispirt.in` returned 406, and the Tofu thread returned 410 Gone. Claims resting on those pages are the weakest in this document, including the 2018 PayPal survey (YourStory link blocked; a second report, [Business Standard](https://www.business-standard.com/article/pti-stories/australia-us-among-major-markets-for-indian-freelancers-report-118010900944_1.html), was cited by the alternatives researcher and was not checked here).

## 1. Problem and user
- **Who (assumed, for the owner to confirm):** one individual Indian freelancer (designer, developer, writer, consultant) who bills direct clients, not through Upwork or Fiverr (those platforms pay the freelancer themselves, so there is nothing to chase).
- **Job:** get an overdue invoice paid without damaging the client relationship.
- **Today:** WhatsApp and email by hand, written from memory or from advice-blog templates; a spreadsheet; or reminders built into an invoicing app. Advice guides describe the same manual ladder: plain reminder with invoice number, amount, due date and a 5-7 day deadline, then the client's accounts team, then a legal notice or MSME route ([fueler](https://fueler.io/blog/client-wont-pay-freelancer-payment-recovery-india), [profitbooks, 2026-03-17](https://profitbooks.net/client-not-paying-in-india/)). Medium confidence that the ladder is standard; all three sources are content marketing.
- **Cost of the problem:** unmeasured. The only figure found (about 3 overdue invoices at a time, 20-30 minutes each, about Rs 18,000 a year) is a competing vendor's own back-of-envelope assumption ([Peerlist, 2026](https://peerlist.io/madhu_k/articles/indian-freelancers-are-losing-18000year-waiting-to-get-paid-)). Treat as **not evidence**.

## 2. Evidence of demand
| Evidence | Source | What it shows | Strength |
|---|---|---|---|
| PayPal survey of about 500 Indian freelancers: about 61% were unpaid at least once; many paid 2-4 weeks after invoicing | [YourStory, Jan 2018](https://yourstory.com/2018/01/41pc-freelancers-witnessing-growth-2017-india-now-largest-freelancers-market-paypal-report) | Non-payment is common over a career. "Ever", not frequency. 8 years old | Medium-low |
| UK IPSE: 54% of freelancers had a payment delay in their career | [IPSE](https://www.ipse.co.uk/policy/research/financial-wellbeing/late-payment-within-the-self-employed-sector.html) | Same pattern abroad | Medium (not India) |
| Bonsai, 100k+ invoices: 29% paid at least one day late | [Bonsai](https://www.hellobonsai.com/blog/late-freelance-payment) | Late payment is frequent but mostly short | Medium (global) |
| Recordent: Indian MSMEs wait 73 days on average | [MediaBrief](https://mediabrief.com/recordent-report-highlights-working-capital-stress-for-indian-smes-as-average-overdue-receivables-cross-%E2%82%B93-83-crore/) | Clients' payment culture is slow | Low (businesses, not freelancers) |
| TechEnclave poster ending Indian contracts: payment means "beg", others had no trouble | [TechEnclave](https://techenclave.com/t/suspending-all-the-active-contracts-from-indian-clients/396802) | One first-person complaint, one contradiction | Low |
| Forum post about the awkwardness of asking for money | [Tofu thread](https://community.tofu.com/t/how-do-you-consistently-remind-clients-about-outstanding-balances-without-feeling-awkward/1274) (link returned 410 Gone on 2026-10-19, so unverifiable) | The emotional job may be real for some | Very low (small, not India, page removed) |

**What was not found:** any Reddit, HN, X or LinkedIn first-person Indian thread (Reddit blocked, others not surfaced); any 2024-26 India freelancer lateness survey; typical delay in days for individuals; **any Indian freelancer saying they pay for a chasing tool**; also no one saying they would not. Absence of evidence, not evidence of absence.

**Counter-evidence found:** (a) some delay is invoice defects (unclear GST breakdown), not refusal ([Peerlist, 2026](https://peerlist.io/madhu_k/articles/invoice-clarity-faster-payments-india), a competitor founder, low); (b) the strongest horror stories are ghosting or part-payment, which gentle reminders don't fix; (c) advice says take a 25-50% advance, which prevents the problem instead of chasing it.

## 3. Alternatives
| Alternative | Who uses it | Price (unverified, see note) | Strength | Gap we might exploit | Source |
|---|---|---|---|---|---|
| Do nothing / chase by hand on WhatsApp | Likely most freelancers (no data) | Free | Personal, no setup | Awkward, forgotten, no record | guides above |
| Spreadsheet / Notion | Some | Free | Flexible | Manual | not evidenced |
| **Zoho Invoice** | Small businesses | Free forever per Zoho India (limits reported inconsistently: 500 or 1,000 invoices/yr) | Automatic reminders (email), GST invoices, UPI/card | WhatsApp reminders not confirmed | [Zoho](https://www.zoho.com/in/invoice/kb/general/zoho-invoice-free.html) |
| **Refrens** | Indian freelancers and SMEs | Free tier (cap 15, 20 or 50 documents a year, sources conflict); paid about Rs 3,900-8,500/yr | Reminders by WhatsApp and email advertised on the free plan | Cap, vendor claim unverified | [Refrens help](https://help.refrens.com/en/article/how-to-take-better-follow-ups-with-automated-reminders-1i9zxoe/) |
| Vyapar | Shops, SMEs | About Rs 3,399/yr plus GST (reseller figure) | Bulk reminders (WhatsApp, SMS, email) claimed | Heavy accounting product | [reseller](https://www.itforsme.in/pricing/vyapar-india) |
| Razorpay Payment Links | Anyone collecting payments | Per-payment fee | Reminders on by default, up to 3, SMS/email (claim from a search summary; this docs link returned 404 on 2026-10-19, so unverified) | Only for payments taken through the link; WhatsApp needs a Business API partner | [Razorpay docs](https://razorpay.com/docs/payment-links/reminders) |
| Wave / Bonsai / FreshBooks | Foreign-client freelancers | Free to about $25/mo | Reminders included | Priced in USD, not GST/UPI aware | [comparison](https://dupple.com/learn/best-invoicing-software-for-freelancers) |
| Dedicated chasers (TryGetBill, PayTrack, RemindFox, NowPaid, Meekhata) | Early adopters | unclear | Exist; some do WhatsApp reminders | Traction unknown | [Peerlist](https://peerlist.io/madhu_k/project/trygetbill) |

Note: prices and caps come from search summaries, resellers and listicles and conflict between sources. **Re-check each on the vendor's own page before using any number.**

**Reading:** a reminder feature is not a gap. The only remaining space is untested: reminders for invoices that were not made in that tool (UPI, bank transfer, foreign client), a tone and escalation ladder, and the freelancer sending from their own WhatsApp.

## 4. Market and money
- **Reachable customers:** unknown. The often-quoted "15 million Indian freelancers" has no named primary source ([Razorpay blog](https://razorpay.com/learn/scope-and-challenges-of-freelancers/), low). NITI Aayog counts 7.7M gig workers for 2020-21, mostly platform delivery and ride work ([IndBiz, 2022](https://indbiz.gov.in/indias-gig-economy-to-have-23-5-million-workers-by-2029-30-niti-aayog/)). Estimate (mine, not sourced): at most about 1.7M if 22% of those are high-skilled; the subset who invoice direct clients is smaller and unmeasured.
- **Price anchors:** full invoicing tools start about Rs 280-325 a month (annual Rs 3,400-3,900); free tiers are common. A reminder-only tool would have to sit well below that. No source tests what a freelancer will pay. Commentary on Indian software buyers is contested opinion ([iSPIRT](https://pn.ispirt.in/piracy-and-freemium-killed-the-indian-software-buyer/), [The Ken](https://the-ken.com/the-nutgraf/nobody-wants-to-buy-software-in-india/)), low.
- **Illustration only (assumption):** 1,000 paying users at Rs 149/month would be about Rs 17.9 lakh a year. No conversion rate is known.
- **How competitors acquire users:** free tools plus SEO ([Refrens case study](https://blog.saasbrowser.com/case-study-refrens-reinventing-invoicing-accounting-for-indian-smes/): "SEO is a long game"); Khatabook and OkCredit used free reminders as the hook and monetised later ([StartupTalky](https://startuptalky.com/khatabook-business-model/), low).

## 5. Legal, compliance, platform risk (research, not legal advice)
- **WhatsApp automation is the main risk.** WhatsApp's messaging guidelines treat bulk and automated messaging as adversarial and unofficial clients as a terms violation ([WhatsApp](https://www.whatsapp.com/legal/messaging-guidelines), medium-high). The official Business API needs approved templates and recipient opt-in, which a freelancer's debtor has not given ([Meta docs](https://developers.facebook.com/documentation/business-messaging/whatsapp/getting-opt-in), medium-high). **Mitigation: copy-and-send only**, using the official click-to-chat link with prefilled text so the user taps send ([WhatsApp FAQ](https://faq.whatsapp.com/general/chats/how-to-use-click-to-chat/), medium-high). Inference: this avoids automation but not spam reports.
- **DPDP Act and Rules 2025:** notified 14 Nov 2025; most duties (notice, safeguards, breach) apply about 18 months later (around May 2027), possibly earlier if the government shortens it; the shorter timeline is proposed, not confirmed ([SCC Online](https://www.scconline.com/blog/post/2025/12/26/digital-personal-data-protection-rules-2025-key-highlights/), [Takshashila](https://takshashila.org.in/content/blogs/20260126-meity-considers-reducing-dpdpa-compliance-timelines.html)). No small-business exemption was found. Chaser would hold third parties' names, emails and amounts, and those clients never signed up; whether the "voluntarily provided" ground covers this is disputed ([Bar & Bench](https://www.barandbench.com/view-point/voluntary-provision-of-data-under-the-dpdp-act), medium-low). **Needs a lawyer before storing client contact data at scale.** A "paste the text yourself, store nothing about the client" design shrinks this.
- **SMS:** needs TRAI DLT registration; skip in v1 ([Telerivet](https://www.telerivet.com/blog/india-sms-compliance-trai-dlt-registration-and-tcccpr-guide), low-medium).
- **Debt-collection law:** RBI's recovery-agent rules bind regulated lenders, not private creditors ([Business Standard, 2022](https://www.business-standard.com/amp/article/finance/rbi-directs-loan-recovery-agents-not-to-intimidate-borrowers-no-calling-before-8am-after-7pm-122081201144_1.html), medium-high). Polite reminders: no source treats them as an offence; threats could fall under general criminal law (low, section numbers unverified). Keep templates non-threatening.
- **MSMED Act:** a lever only for Udyam-registered micro and small suppliers; a freelancer without Udyam registration cannot use it ([TaxGuru](https://taxguru.in/corporate-law/delayed-payments-msmes-role-msme-samadhaan.html), medium). A 2026 amendment bill passed; its effect on freelancers is unconfirmed ([Vinod Kothari](https://vinodkothari.com/2026/07/strengthening-msme-ecosystem-msmed-amendment-bill/)).
- **UPI:** NPCI ended person-to-person collect requests from 1 Oct 2025 ([Business Today](https://www.businesstoday.in/amp/personal-finance/banking/story/npci-to-tighten-upi-rules-peer-to-peer-collect-feature-to-end-in-october-489244-2025-08-13), medium). Only display a UPI ID or link; never push a collect request. No source says displaying one is regulated; that is a gap, not clearance.
- **Email:** no India anti-spam statute found (not confirmed absent). Bulk senders to Gmail/Yahoo need SPF, DKIM, DMARC ([Bird](https://bird.com/docs/knowledge-base/deliverability/gmail-yahoo-requirements), medium-low).

## 6. Riskiest assumptions
| Assumption | Why it could be false | Cheapest test | Pass condition |
|---|---|---|---|
| A. Direct-client freelancers are paid late often enough to care | Only 2018 and non-India data | 10 short interviews (last 5 invoices, days late, what they sent) | At least 6 of 10 had an invoice 14+ days late in the last 6 months |
| B. Existing free reminders do not already solve it | Zoho, Refrens, Razorpay all have them | Ask the same 10 which tool they use and why they still chase by hand | At least 5 of 10 chase by hand despite having an invoicing app, or invoice outside any app |
| C. They would pay for it | Free tier culture; no price test | Fake-door page with a price (Rs 99-299/month) or a free message-template page with an upgrade button | At least 20 sign-ups and at least 5% click "pay" from 300 visitors |
| D. Reminders change the outcome | Ghosting and disputes dominate the horror stories | Ask interviewees how many overdue invoices were forgotten vs disputed vs ghosted | At least half were "forgotten or slow" |
| E. Copy-and-send WhatsApp is enough value | It stays manual for the user | Test the message generator alone first | Users report sending at least 3 generated messages in a week |

## 7. Recommendation
- **PIVOT, and do not build the app yet.** Reasoning: the core feature (reminders) is free in tools the audience already has; demand evidence is old, foreign, or from competing vendors; no one is shown paying; the one defensible niche (off-platform invoices, tone and escalation, user-sent WhatsApp) is a hypothesis.
- **Proposed v1 (the cheapest thing that tests assumptions C, D, E):** a single free web page, no accounts, where a freelancer enters client name, amount, due date and days overdue and gets three ready-to-send WhatsApp and email messages (polite, firm, final) with a one-tap WhatsApp link. Store nothing about the client. An upgrade button measures willingness to pay. If it clears the pass conditions, build the tracker; if not, stop.
- **Explicitly out of v1:** accounts, invoice creation, payment links, automatic sending, SMS, storing client contact details, UPI collect requests, any claim of legal effect.
- **Go to a full product only if A, B and C pass.** Stop if C fails twice.

## 8. Open questions for the owner
1. Is the first customer an individual freelancer? (Assumed.)
2. What is success in 6 months: revenue, learning, or a portfolio piece? This changes whether a low-evidence build is worth it.
3. Do you accept pivoting to the message-generator test, or do you want to proceed with the full tracker anyway, knowing the evidence above?
4. Can you run the 10 interviews, or should the plan assume none?
