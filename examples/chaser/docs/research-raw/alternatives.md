# Alternatives and competitors: Chaser (research date 2026-10-19)

Method limits: WebFetch failed on every host (DNS errors), so no pricing page was read directly. All findings come from WebSearch result summaries. Vendor pages and "best of" listicles are claims, not evidence of demand. Page dates were mostly not shown; "undated" means the snippet carried no date. Re-verify every price on the vendor's own page.

## Findings

| Finding | Source URL | Date | Confidence |
|---|---|---|---|
| Zoho Invoice is described on Zoho's India help page as "forever free", with automated payment reminders listed among its features. | https://www.zoho.com/in/invoice/kb/general/zoho-invoice-free.html | undated (surfaced 2026) | medium (snippet only) |
| Zoho Invoice India free-plan caps are reported inconsistently: 500 invoices/yr, 1,000/yr, or "unlimited". The paid tier is reported as about Rs 420-500/user/month by a reseller and a listicle. | https://appadvisor.in/software/zoho-invoice ; https://precisiontech.in/software/zoho/zoho-invoice/ | 2026 / undated | low |
| Zoho Invoice does GST invoices (CGST/SGST/IGST) and can send invoices via WhatsApp. I found no source that it sends reminders via WhatsApp; reminders look email-based. | https://jetinvoice.in/blog/zoho-invoice-vs-jetinvoice (competitor blog) | 2026 | low-medium |
| Zoho Invoice complaints: limited template customisation, currency handling, weak email notification customisation and tracking, free-plan caps. Capterra shows 96% positive of 28 reviews on reminder-type features. | https://www.g2.com/products/5855/reviews ; https://www.capterra.com/p/163114/Zoho-Invoice/reviews/Capterra___6653863/ | undated | medium (small samples) |
| Refrens: a Refrens help article says reminders can go out over WhatsApp or email, and its pages advertise automated WhatsApp and email reminders on the free plan. | https://help.refrens.com/en/article/how-to-take-better-follow-ups-with-automated-reminders-1i9zxoe/ ; https://www.refrens.com/free-online-invoicing-software | undated | medium (vendor claim) |
| Refrens pricing is contradictory across sources. Free plan caps are stated as 15 or 50 documents/yr. Paid is stated as Rs 100/month (Rs 1,200/yr), or Rs 499 and Rs 999/month on refrens.app. | https://www.refrens.com/grow/best-10-invoice-reminder-software ; https://refrens.app/ | undated | low |
| Razorpay Payment Links: reminders are on by default, by SMS, email or both, max 3, tied to the link expiry or issue date. They reach the customer only if contact details were captured. API docs list India. | https://razorpay.com/docs/payment-links/reminders | undated | medium-high (vendor docs) |
| Razorpay WhatsApp payment reminders require a WhatsApp Business API connection through a BSP, which is a setup barrier for an individual. | https://razorpay.com/docs/payments/whatsapp/faqs | undated | medium |
| Cashfree: auto reminders are off by default and need account-manager activation (SMS and email, max 3). WhatsApp payment links are limited to selected merchants. No public price found. | https://www.cashfree.com/docs/payments/no-code/customize/send-reminder.md ; https://www.cashfree.com/docs/payments/no-code/whatsapp-payment-links.md | undated | medium |
| Instamojo: a reseller lists 2% + Rs 3 per payment, with a free plan and a Pro plan of about Rs 2,999/yr. Auto WhatsApp reminders are unconfirmed. | https://precisiontech.in/solutions/payment-gateway-integration/instamojo/ | 2026-07-28 | low |
| Vyapar: a reseller lists Desktop Silver from about Rs 3,399/yr and Desktop+Mobile from about Rs 4,010/yr, plus 18% GST. The mobile app is free on one device. Bulk payment reminders via WhatsApp, SMS and email are claimed by third-party profiles. | https://www.itforsme.in/pricing/vyapar-india | 2026 | low-medium |
| Meekhata, a dedicated reminder app: WhatsApp, SMS and email reminders, from Rs 10 per user (unit unclear), India only. One review notes missing bill-wise settlement. | https://www.capterra.in/software/219032/meekhata | undated | low-medium |
| myBillBook advertises automated payment reminders and WhatsApp sharing for freelancers. | https://mybillbook.in/free/invoicing-software/freelancers/ | undated | low |
| FreshBooks Lite is about $23/month, capped at 5 billable clients. Bonsai is about $15-25/month. Both include auto reminders. Wave's free Starter lacks automated reminders, so Pro is $19/month. Figures are unofficial and differ by source. | https://dupple.com/learn/best-invoicing-software-for-freelancers ; https://www.temperstack.com/versus/freshbooks-vs-bonsai/ | 2026 | low-medium |
| Dedicated chasing tools already exist, mostly as early-stage launches. PayTrack is India/US with scheduled reminders. TryGetBill offers GST invoices, Razorpay links and WhatsApp reminders for Indian freelancers. RemindFox gives a 3-hour pre-send cancel window. NowPaid has CSV import and tone selection. DueKind only drafts reminders on a Day 1/3/7/14 cadence. A Google-Sheet agent skill sends email or WhatsApp follow-ups. | https://peerlist.io/madhu_k/project/trygetbill ; https://hunted.space/product/remitae ; https://www.g2.com/products/remindfox/discuss ; https://appgoblin.info/apps/6781895520 ; https://webcatalog.io/apps/nowpaid | undated | medium that they exist, low on traction |
| Problem prevalence: a PayPal India survey reported by Times of India said about 61% of Indian freelancers were unpaid at least once, and many get paid 2-4 weeks after invoicing. The survey is from 2018 and I saw only a secondary report. | https://www.business-standard.com/article/pti-stories/australia-us-among-major-markets-for-indian-freelancers-report-118010900944_1.html | 2018 | low-medium (old) |
| Some delays come from invoice defects such as unclear GST breakdowns, not refusal to pay. This is from a TryGetBill founder's post, which is promotional. | https://peerlist.io/madhu_k/articles/invoice-clarity-faster-payments-india | undated | low |

## Contradictions and gaps

- **Disconfirming evidence is strong.** Automated reminders are a free feature in at least Zoho Invoice and (per vendor claims) Refrens, and are default-on in Razorpay Payment Links. Reminder emails alone are not a gap. Inference: Chaser cannot win on "sends reminders".
- **Where a gap might remain (inference, untested).**
  - WhatsApp-style reminders sent by the freelancer personally. Gateway and BSP routes are API-based, gated and corporate.
  - Tools for people who do not issue invoices through that tool: off-platform invoices, bank transfers, UPI, foreign clients.
  - Tone control and escalation.
  - Human-in-the-loop sending.
  - Per-link reminder caps (Razorpay and Cashfree allow 3) versus a longer escalation ladder.
- **Do-nothing and manual alternatives (WhatsApp, Sheets) are not evidenced.** I found no data on how many freelancers actually use them or how well they work.
- **No first-hand complaints found.** I found no Reddit or forum posts saying "existing reminder features are inadequate" or "I hate chasing". Complaint evidence is only G2/Capterra snippets on Zoho, and the Meekhata review.
- **Price conflicts.** Refrens, Zoho caps, Vyapar, Instamojo and the USD tools all conflict or come from resellers. No official pricing page was read.
- **Not found at all:** PayPal/Wise invoicing reminder behaviour, Paymo, Notion/Sheets template popularity, Khatabook, and whether TryGetBill or PayTrack have paying users.
- **Prevalence data** is old (2018) and secondary. No Indian figure from 2025-26 found.

## What I would research next

1. Open the official pricing and feature pages (Zoho India, Refrens, Vyapar, Razorpay, Instamojo), once WebFetch works, to settle prices and which plan holds reminders and WhatsApp.
2. Mine Reddit (r/IndianFreelancers, r/freelance, r/developersIndia), X and LinkedIn for first-hand "chasing payment" stories. Check whether freelancers mention awkwardness, which tools they use and what failed.
3. Try the dedicated rivals (TryGetBill, PayTrack, RemindFox, NowPaid) for signs of traction: reviews, pricing, users, shutdowns.
4. Interview 8-10 Indian freelancers about their last overdue invoice: what they did, which tool, what it cost them, and whether they would pay.
5. Check Zoho Invoice and Refrens reminder channels directly (is the WhatsApp reminder automated, or a manual share?), since this decides whether the "WhatsApp copy-text" angle is differentiated.
