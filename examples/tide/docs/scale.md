# Scale: measured numbers and a cost model

All numbers were measured on 2026-10-20 on one shared machine (the test client and the server used the same CPU). They describe the dev server and the page, not the deployed host.

## Load test (real numbers)
`BASE=http://127.0.0.1:4210 USERS=50 SECONDS=10 node scripts/loadtest.js`: 50 virtual visitors each loading the page and its five files in a loop.

| Requests | Per second | Error rate | p50 | p95 | p99 |
|---|---|---|---|---|---|
| 47,754 | 4,767 | 0 | 8.3 ms | 19.3 ms | 28.2 ms |

This is the dev server (`scripts/serve.js`), which reads each file from disk on every request. The deployed site is static files on Vercel's network and is **not load tested**: hammering someone else's production host is not appropriate, and its limits are the host's.

## Two instances side by side
`node scripts/two-instances.js` starts two copies on different ports. All six files and the health endpoint return byte-identical responses (same SHA-256), and 200 requests interleaved across both gave 0 errors. Tide keeps nothing on a server, so there is no state to share and nothing to conflict. Multiple instances are a non-issue by design.

## Before and after (the one optimisation)
Cause: the first version drifted the background orbs with properties that force repainting, and redrew a large glow every frame. Change (commit 248271a): the drift moved to the `translate` property, which the browser can run off the main thread, the glow became a static layer, and the animation step was capped. Measured with `scripts/fps-compare.mjs` in the same headless Chromium (software rendering, no GPU), three runs each, alternating, liquid running for 5 seconds:

| Build | Runs (frames per second) | Mean |
|---|---|---|
| Before (commit ab8f5e4) | 6.8, 6.6, 6.6 | 6.7 |
| After (current) | 15.0, 14.0, 14.2 | 14.4 |

A real GPU would be much faster; a real phone was not measured.

## Cost model
Page weight, measured: 6 files, 38,239 bytes raw, 14,082 bytes gzipped (the host normally compresses). One visit is 6 requests.

Hosting is Vercel's Hobby plan today. Limits quoted by third-party summaries of Vercel's pricing, which the owner should confirm at vercel.com/pricing: 100 GB fast data transfer and about 1 million edge requests per month, no overage purchase on Hobby, non-commercial use only.

| Scenario (visits per month) | Requests | Transfer (raw, worst case) | Fits Hobby? | Cost |
|---|---|---|---|---|
| Today, about 1,000 | 6,000 | 0.04 GB | yes | 0 |
| 10x, 10,000 | 60,000 | 0.4 GB | yes | 0 |
| 100x, 100,000 | 600,000 | 3.8 GB | yes (60% of the request limit) | 0 |
| About 167,000 | 1,000,000 | 6.4 GB | at the request limit | 0 until the cap |
| 1,000,000 | 6,000,000 | 38 GB | **no**: over the request limit | Needs a paid plan; the overage price was not verified and is not modelled here |

The request count, not bandwidth, is the first limit (about 167,000 visits a month; bandwidth would last to about 2.6 million raw visits). Merging the CSS and scripts into fewer files would raise that ceiling; it is not worth doing at today's scale. Everything else is free: no database, no functions, no third-party services.
