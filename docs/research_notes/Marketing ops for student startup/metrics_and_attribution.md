# Marketing metrics, measurement frameworks and attribution (consumer/DTC) — and what a €0 student team can measure

Research date: 2026-10-14. Most sources are 2025–2026. Many benchmark figures come from vendor blogs or secondary summaries; this is flagged inline. Items with no source found are listed under Gaps rather than stated as fact.

## 1. Frameworks companies use to organise marketing metrics

### Takeaway
Operators organise metrics as a hierarchy: one top "outcome" number (contribution margin for DTC, a North Star for product companies), a small set of business-level drivers under it, and channel/creative-level diagnostics under those. Amazon's split between **controllable input** and **output** metrics is the most useful idea for a weekly cadence: review outputs, but spend discussion time on the inputs the team can move.

### Cited Findings
- **Common Thread Collective (CTC, DTC agency), Mar 2026:** contribution margin sits at the top of the metric hierarchy. Below it are business-level metrics (revenue, total spend, MER, AOV, orders, new-customer CAC), and below those are channel-level metrics (Meta ROAS, Google ROAS, email revenue, creative performance). The diagnostic flow is: check CM first; if it is off plan, look at business-level metrics, then drill into the channel. "If revenue is on track but CM is short, the problem is usually on the cost side." — [CTC, Complete Guide to Ecommerce Contribution Margin (2026)](https://commonthreadco.com/blogs/coachs-corner/the-complete-guide-to-ecommerce-contribution-margin)
- CTC also recommends breaking an annual CM goal into daily targets, tracking pacing against them, and separating new-customer CM from returning-customer CM. — [CTC (2026)](https://commonthreadco.com/blogs/coachs-corner/the-complete-guide-to-ecommerce-contribution-margin)
- **Amazon Weekly Business Review (WBR):** metrics are split into *controllable input metrics* that teams influence directly (e.g. selection, price, convenience) and *output metrics* (revenue, share price) that leaders "have little direct control over". The WBR deck keeps the same metrics, format and order every week so changes are easy to compare, and most discussion goes to exceptions and trends in input metrics. The process assumes the first input metrics chosen may be wrong and gets revised over time. — [Holistics, How Amazon Uses Input Metrics](https://www.holistics.io/blog/how-amazon-uses-input-metrics/); WBR described as reviewing 400–500 metrics in 60–90 minutes — [Nanoglobals WBR glossary](https://nanoglobals.com/glossary/wbr-weekly-business-review/). (Primary source is the book *Working Backwards* by Bryar & Carr, 2021; I only saw secondary summaries of it.)
- **North Star Metric:** Airbnb's "nights booked" is the most cited example. It is broken down into input metrics: active hosts, active guests and booking conversion rate, or arithmetically active guests × trips per guest × nights per trip ("breadth, depth, frequency"). These examples are community-cited illustrations, not official company statements. — [Amplitude, Good vs Bad North Star Metric](https://www.amplitude.com/blog/good-bad-north-star-metric.md); [MetricGate](https://metricgate.com/blogs/north-star-metric-product-analytics/). Itamar Gilad (quoted in Lenny-derived material): the North Star should measure the value created for the market. — [Lenny skills summary](https://www.skills.sh/refoundai/lenny-skills/north-star-metrics) (derivative; the original Lenny's Newsletter post was not retrieved).
- **Glossier:** an often-repeated claim is that ~70% of online sales and traffic came from peer-to-peer referrals (Emily Weiss). This was reportedly measured when Glossier had ~500 reps. — [Beans case study](https://www.trybeans.com/blog/glossier-referral-program-analysis). The Hustle reported that "80% of their growth and sales come from peer-to-peer recommendations or their own channels". — [The Hustle](https://thehustle.co/glossier-raises-52-million). The figures conflict and are pre-2023, so treat them as dated and approximate.
- **HubSpot State of Marketing:** in the 2025 report, 21% of marketers named short-form video the highest-ROI content format, ahead of live streaming (15.53%). 2026 figures cited elsewhere are 49% short-form, 29% long-form and 25% live. These are secondary citations that conflict, possibly because they measure different things. — [Shno stats roundup](https://www.shno.co/marketing-statistics/short-form-content-statistics); [VidPros (2026)](https://vidpros.com/video-marketing-roi/). A HubSpot-cited stat says 62% of marketers measure video ROI through views (year not given). — [VidPros](https://vidpros.com/video-marketing-roi/)

### Inferences
- For a physical-product brand, the CTC hierarchy (profit → revenue/orders/AOV/CAC → channel/content) maps directly onto emet's €15K profit / €30K revenue goal. In emet's terms, the top output is "€ contribution profit to date vs pacing line", and the inputs are content published, stall hours and conversations.
- The AARRR (Acquisition, Activation, Retention, Referral, Revenue) and AIDA/full-funnel models are useful as *labels* for stages: views → profile visits/DM → purchase → repeat/referral. For physical products sold in person and via DM, though, CTC-style profit-first plus input/output is the more actionable structure.
- Glossier's lesson for a student brand is that referral/word of mouth can be the dominant channel, so a "how did you hear about us" question is essential to measure it.

### Gaps
- I did not retrieve primary sources for AARRR (Dave McClure, 2007 talk, so pre-2023), Andrew Chen or Reforge growth-metric essays, or Lenny's original North Star post. Treat references to them here as background only.
- I found no primary published KPI lists from **Gymshark** or **Shopify merchants generally**. Gymshark's annual reports publish revenue/EBITDA but were not retrieved. I found no reliable source for "how Gymshark measures influencer ROI".
- I could not access HubSpot's original report page, so the 21% vs 49% conflict is unresolved.

## 2. Precise definitions and formulas

### Takeaway
Use profit-anchored, blended metrics (contribution margin, MER/blended CAC) as the "truth", and treat platform-reported ROAS and engagement as diagnostics. Definitions vary between sources (especially what counts as "marketing cost" and which costs go into contribution margin), so the team must write its own definitions down and keep them fixed.

### Cited Findings
- **Contribution margin (CTC, 2026):** `CM = (Net Sales + Shipping Revenue) − COGS − Ad Spend − Shipping & Fulfillment − Merchant Fees`. Net sales = gross sales − returns/refunds − discounts. COGS includes product, packaging and landed cost. Fixed costs (rent, salaries, software) are excluded. — [CTC (2026)](https://commonthreadco.com/blogs/coachs-corner/the-complete-guide-to-ecommerce-contribution-margin)
- Other DTC sources define CM as revenue minus COGS, fulfillment/shipping, payment fees and variable marketing, and note that definitions vary. — [Polar Analytics, MER](https://www.polaranalytics.com/post/mer-marketing-efficiency-ratio); [FirstPier glossary](https://www.firstpier.com/glossary/marketing-efficiency-ratio-mer)
- **CM2 (contribution after fulfillment, before marketing):** the maximum a brand can pay to acquire a customer and still break even on the first order. Scaling test: `CM2 ÷ new-customer CAC`; above 1.0 means the brand is contribution-positive on the first order. — [Eightx, CM2](https://eightx.co/blog/what-is-cm2-contribution-margin-after-marketing); [Eightx, DTC unit economics](https://eightx.co/blog/dtc-unit-economics-end-to-end)
- **MER (Marketing Efficiency Ratio), also called blended ROAS:** `MER = total revenue ÷ total marketing spend`. "ROAS grades a campaign, MER grades a business." **Break-even MER = 1 ÷ contribution margin %** (e.g. 40% CM → break-even MER 2.5). Inconsistent categorisation of what counts as marketing spend makes MERs incomparable across companies. — [Polar Analytics](https://www.polaranalytics.com/post/mer-marketing-efficiency-ratio); [Agile Brand Guide](https://www.agilebrandguide.com/wiki/metrics/marketing-efficiency-ratio-mer/); [Eightx, MER by vertical](https://eightx.co/blog/average-mer-by-ecommerce-vertical)
- **ROAS:** revenue attributed to a channel/campaign ÷ ad spend on that channel. It is a channel-level metric in the CTC hierarchy. — [CTC (2026)](https://commonthreadco.com/blogs/coachs-corner/the-complete-guide-to-ecommerce-contribution-margin); [Polar Analytics](https://www.polaranalytics.com/post/mer-marketing-efficiency-ratio)
- **CAC:** `all costs of winning new customers ÷ number of new customers in the same period`. Costs include ad spend, agency fees, content production, sales-team costs and promotional discounts. The denominator must be *new customers*, not orders: counting returning buyers understates CAC. **Blended CAC** = total marketing spend ÷ all new customers, regardless of channel. — [Polar Analytics, CAC](https://www.polaranalytics.com/post/customer-acquisition-cost-cac); [FirstPier](https://www.firstpier.com/glossary/customer-acquisition-cost-cac)
- **LTV/CLV (Shopify):** `CLV = AOV × purchase frequency × customer lifespan`. Shopify lists average CLV from $168 (retail) to $1,202 (subscription). — [Shopify Enterprise blog](https://www.shopify.com/enterprise/blog/44310083-warning-most-conversion-optimization-tips-are-bs-heres-why)
- **AOV** = revenue ÷ number of orders. It is a business-level metric in CTC's hierarchy. — [CTC (2026)](https://commonthreadco.com/blogs/coachs-corner/the-complete-guide-to-ecommerce-contribution-margin)
- **Repeat purchase rate** = customers with ≥2 orders ÷ total customers. Rivo (Jan 2026, vendor) reports an average ecommerce rate of 28.2%, ranging from 9.9% (luxury) to 65.2% (grocery). — [Rivo](https://www.rivo.io/blog/repeat-purchase-rate-complete-guide). Gempages gives a rougher scale: under 10% suggests trouble retaining customers, 10–20% is average. — [Gempages](https://gempages.net/blogs/shopify/ecommerce-repeat-purchase-rate). Hologrow suggests pairing CAC with first-order CM and a **60-day repeat rate**. — [Hologrow](https://hologrow.ai/blog/customer-acquisition-quality)
- **Engagement rate by followers** = interactions ÷ followers × 100. Rival IQ uses all interactions ÷ total followers. Socialinsider uses (likes + comments) ÷ followers × 100. **Follower growth rate** = followers gained ÷ starting followers × 100. — [Rival IQ 2025 report](https://www.rivaliq.com/blog/social-media-industry-benchmark-report/); [Socialinsider 2025 Instagram benchmarks](https://www.socialinsider.io/blog/instagram-hashtag-study/)
- **Engagement/send rate by reach:** Instagram's Mosseri said in spring 2024 that "the rate is more important than the count" for sends, likes and comments **per reach**. — [Dataslayer summary](https://www.dataslayer.ai/blog/instagram-algorithm-2025-complete-guide-for-marketers); [Social Media Today (2025)](https://www.socialmediatoday.com/news/instagram-shares-algorithm-insights-2025/738034/). Follower-based and reach/impression-based formulas give very different numbers and must not be mixed. — [Inrō calculator](https://www.inro.social/tools/instagram-engagement-rate-calculator)
- **Instagram "accounts engaged"** (API definition): accounts that interacted with content (likes, saves, comments, shares, replies); the metric is estimated. — [Meta Instagram Account Insights API](https://developers.facebook.com/docs/instagram-platform/api-reference/instagram-user/insights). **Profile activity** = profile visits + website (bio link) taps + email/call taps. — [Colorado State data dictionary](https://social.colostate.edu/strategy/social-media-analytics-data-dictionary/). Supermetrics notes that Instagram replaced several contact-button metrics with a combined tap count and no longer exposes website link taps via the API, so check the in-app (i) definitions. — [Supermetrics IG fields](https://docs.supermetrics.com/docs/en/instagram-insights-fields)

### Inferences
- For emet (no ad spend), **marketing spend ≈ product samples + giveaway COGS + discount € given + printing (QR posters, flyers) + stall costs**. With that definition, MER and blended CAC still compute and stay meaningful once a small ad budget arrives.
- The following custom content metrics are standard practitioner concepts, but I found no authoritative formula source for them (defined here as working definitions): **save rate** = saves ÷ reach; **share/send rate** = shares ÷ reach; **cost per content piece** = (€ props/product used + € tools) ÷ pieces published, which is ~€0 for emet so it is better tracked as *hours per piece*; **content hit rate** = pieces beating a threshold (e.g. ≥2× account median views) ÷ pieces published; **lead-to-sale conversion** = DMs/stall conversations that become orders ÷ total DMs/conversations.

### Gaps
- No primary CTC source for the MER formula or "aMER" (acquisition MER = new-customer revenue ÷ spend) was retrieved. The MER formula comes from Polar/Agile Brand/Eightx.
- No authoritative benchmark for content "hit rate" or DM-to-sale conversion for small brands.

## 3. Attribution for small brands without ad tools

### Takeaway
Small brands triangulate between three cheap, imperfect methods: **UTM links** (track web traffic, but break across devices and sessions), **unique discount codes per channel/creator** (capture sales even without a click, but leak to coupon sites and over-credit), and **"how did you hear about us" (HDYHAU) post-purchase surveys** (capture word of mouth and dark social that pixels miss, but rely on recall). Pairing a code with a UTM per source gives two independent confirmation paths.

### Cited Findings
- Using UTM links (for web traffic) together with unique discount codes (for purchase attribution) "gives more reliable attribution across devices". Codes capture conversions that bypass the link entirely. UTMs are free, but "die when someone closes their browser, clears cookies, or switches devices". — [ReferralCandy](https://www.referralcandy.com/blog/how-to-set-up-influencer-affiliate-tracking-on-shopify); [InfluencerMarketingHub](https://influencermarketinghub.com/utms-promo-codes-holidays-bf-cm)
- Shopify's built-in discount reports show how many times a code was used but not where those customers came from. The fix is one code per creator/source (e.g. SARAH15). — [ReferralCandy](https://www.referralcandy.com/blog/how-to-set-up-influencer-affiliate-tracking-on-shopify); [GrowthSuite](https://www.growthsuite.net/questions/can-i-track-which-marketing-channels-drive-the-most-discount-code-usage)
- **UTM conventions:** use a fixed `utm_source` per platform, a shared `utm_campaign` name, and `utm_content` = creator handle + asset ID. Mis-tagging sends conversions to "(not set)" or "direct". Shopify's "Sales attributed to marketing" report respects the UTM campaign name. — [InfluencerMarketingHub](https://influencermarketinghub.com/utms-promo-codes-holidays-bf-cm)
- Linking each code to its UTM campaign lets a sale be confirmed by two independent paths. — [InfluencerMarketingHub](https://influencermarketinghub.com/utms-promo-codes-holidays-bf-cm)
- **HDYHAU / post-purchase survey:** typically one question on the order-confirmation page. DTC brands use it to detect influence from a TikTok mention, a podcast or a friend referral. — [Fairing FAQ](https://fairing.co/resources/measurement-faqs/what-is-a-post-purchase-survey). Fairing claims the surveys fill part of a ~30% attribution gap ([Fairing blog](https://fairing.co/blog/the-post-purchase-survey-a-vital-marketing-attribution-tool)), and that a follow-up question (which creator or podcast) yields up to 50% more usable answers ([PPC Land](https://ppc.land/fairing-beta-users-gain-up-to-50-more-attribution-data-from-same-orders/)). Both are vendor claims.
- **Accuracy trade-off:** tracked attribution over-credits last-touch digital channels, while self-reported attribution under-counts brand recall, so the two are best used together. — [Ecommerce Fastlane](https://ecommercefastlane.com/how-zero-party-attribution-data-fuels-a-competitive-advantage-for-dtc-brands/)
- Fairing pricing is $49/month for up to 500 orders, with a 14-day trial. That is unnecessary for emet, since a free form field does the same job. — [Fairing](https://app.fairing.co/powered-by)
- Instagram profile insights expose profile visits and (historically) external/bio link taps, but definitions changed in the API. — [Supermetrics](https://docs.supermetrics.com/docs/en/instagram-insights-fields); [Colorado State](https://social.colostate.edu/strategy/social-media-analytics-data-dictionary/)

### Inferences
- **Pros and cons for emet:**
  - UTMs on the link-in-bio and story links: free and precise for web orders. Useless for in-person and DM sales.
  - Unique codes per channel/creator/stall (e.g. `TT10`, `IG10`, `STALL-UNI`, `AMBASSADOR-NAME`): work offline and in DMs. They cost margin and over-credit whoever owns the code.
  - Mandatory HDYHAU field on every order (web form, DM order template, stall order form) with fixed options (TikTok / Instagram / friend / campus stall / ambassador / other): the only way to capture word of mouth.
  - QR codes at the stall pointing to a UTM-tagged URL (`utm_source=stall&utm_campaign=<date-location>`): measure scans → visits, but most stall sales are cash/card on the spot, so the stall should log sales directly.
- Expect HDYHAU answers and code/UTM data to disagree. Use HDYHAU as the primary channel split for word of mouth and stall sales, and codes/UTMs as the primary split for online sales.

### Gaps
- I found no independent (non-vendor) accuracy study comparing HDYHAU with tracked attribution.
- I found no source quantifying QR-code scan-to-purchase rates at physical pop-ups or stalls.
- Link-in-bio tools (Linktree etc.) offer click analytics, but I did not retrieve their docs to confirm the free-tier limits.

## 4. Organic social: predictive metrics vs vanity metrics, and 2025–2026 benchmarks

### Takeaway
Instagram's head has named **watch time, likes per reach and sends per reach** as the top ranking signals (sends matter most for reaching non-followers). For a seller, the metrics closest to revenue are **sends/shares, saves, profile visits, bio-link taps and DMs**, all expressed as rates per reach. Raw follower count and likes are the weakest predictors. Engagement rates by followers fell sharply in 2025, so tiny accounts should compare against their own rolling median rather than against industry averages.

### Cited Findings
- **Mosseri (Jan 2025):** "The top three signals that matter most for ranking are watch time, likes and sends." Likes matter slightly more for connected (follower) content, and sends slightly more for unconnected content. — [Social Media Today](https://www.socialmediatoday.com/news/instagram-shares-algorithm-insights-2025/738034/); [Social Samosa](https://www.socialsamosa.com/news-2-instagram-reveals-key-factors-for-boosting-reach-8646916). A claim that sends carry 3–5× the weight of likes for non-follower reach comes from a marketing firm, not Instagram. — [eClincher](https://www.eclincher.com/articles/how-the-instagram-algorithm-works-in-2026)
- **Rival IQ 2025 report** (published Feb 25, 2025; method: interactions ÷ followers, 150 companies per industry): year-over-year engagement fell on every platform: Facebook −36%, Instagram −16%, TikTok −34%, X −48%. TikTok still has the highest engagement. Health & Beauty has the lowest engagement on all channels. In Fashion, Reels and Carousels led Instagram, and #fitcheck led TikTok hashtags. Retail Instagram engagement fell (the report contradicts itself: ">50%" vs "nearly 30%"). — [Rival IQ](https://www.rivaliq.com/blog/social-media-industry-benchmark-report/)
- Rival IQ 2025 medians as cited secondarily: TikTok ~1.73%, Instagram ~0.36%, Facebook ~0.063%, X ~0.029% (not verified against the report's charts). — [SocialKit](https://socialk.it/en/blog/what-is-a-good-engagement-rate); [Inrō](https://www.inro.social/tools/instagram-engagement-rate-calculator)
- **Socialinsider 2025 Instagram** (35M posts, 447,613 accounts, published Feb 2026): average engagement 0.48% (−24% YoY). By format: Reels 0.52%, carousels 0.55%, images 0.37%. Q2 2026 average 0.45%. — [Socialinsider](https://www.socialinsider.io/blog/instagram-hashtag-study/); [Socialinsider benchmarks page](https://www.socialinsider.io/de/social-media-benchmarks/instagram)
  - Views per post for **1–5K follower** accounts: Reels 580, carousels 993, images 417. For 5–10K: Reels 1,000, carousels 2,117, images 1,068.
  - Saves per post for 1–5K accounts: ~1 for every format. For 10–50K: Reels 7, carousels 8. — [Socialinsider](https://www.socialinsider.io/blog/instagram-hashtag-study/)
- Average Instagram reach rate 3.50% (May 2024–May 2025, −12% YoY), per a secondary summary of Socialinsider. — [blckalpaca](https://blckalpaca.at/en/knowledge-base/social-media/social-media-algorithms-distribution/good-engagement-rate-social-media-benchmarks-2026)
- **Buffer** (27M posts / 273K accounts) reports a much higher median engagement of ~4.3%, and finds that follower count is the factor that most influences engagement rate (smaller accounts score higher). Tier medians cited secondarily: 5.2% for under 1K followers down to 3.5% for 100K–500K. Buffer uses a different denominator and sample, so its figures are not comparable with Rival IQ or Socialinsider. — [Inrō](https://www.inro.social/tools/instagram-engagement-rate-calculator); [blckalpaca](https://blckalpaca.at/en/knowledge-base/social-media/social-media-algorithms-distribution/good-engagement-rate-social-media-benchmarks-2026)
- HubSpot-cited research: B2C marketers rate Instagram/Facebook (47.4%) and TikTok (35.2%) among the highest-ROI platforms (2026, secondary). — [VidPros](https://vidpros.com/video-marketing-roi/)

### Inferences
- Benchmarks span 0.36% to 5% depending on formula and sample. For emet, the useful comparison is **each post vs the account's own trailing 10-post median**, plus a reach-based rate.
- Funnel signals to log, from closest to purchase: DMs asking price/stock, then bio-link taps, then profile visits, then sends/shares, then saves, then watch time/views. Likes and follower count are vanity unless used as context.
- A new account (<5K followers) should expect hundreds, not thousands, of views per Reel (Socialinsider median 580). Single "viral" outliers should be logged as hits, but should not reset targets.

### Gaps
- No primary TikTok official guidance was retrieved on which metrics predict purchases. TikTok median engagement (~1.73%) is a secondary figure.
- No public study directly correlating saves or shares with sales for small product brands was found. The "predicts sales" ordering above is inference.
- Sprout Social and Hootsuite 2025/2026 benchmark reports were not retrieved.

## 5. Single-source-of-truth weekly scorecard and data quality

### Takeaway
The pattern from Amazon's WBR and CTC is the same: a fixed set of metrics in a fixed order every week, a profit/outcome line at the top tracked against a pacing target, controllable inputs underneath, and discussion focused on exceptions. Data quality comes from written definitions, a named owner per metric, and consistent tagging conventions.

### Cited Findings
- The WBR keeps the same metrics, format and order each week, and discussion goes to exceptions and trends in controllable inputs. — [Holistics](https://www.holistics.io/blog/how-amazon-uses-input-metrics/)
- CTC: break the annual CM goal into daily/period targets, track pacing, and separate new from returning customers. — [CTC (2026)](https://commonthreadco.com/blogs/coachs-corner/the-complete-guide-to-ecommerce-contribution-margin)
- Inconsistent categorisation of marketing spend makes MER non-comparable, so definitions must be fixed. — [Polar Analytics](https://www.polaranalytics.com/post/mer-marketing-efficiency-ratio)
- Inconsistent UTM tagging pushes conversions to "(not set)/direct", so tagging conventions need enforcing. — [InfluencerMarketingHub](https://influencermarketinghub.com/utms-promo-codes-holidays-bf-cm)
- Follower-based and reach-based engagement formulas yield very different numbers, so pick one and label it. — [Inrō](https://www.inro.social/tools/instagram-engagement-rate-calculator)

### Inferences
- **Data-quality rules for a student team:**
  1. Keep a written metric dictionary (formula, source, owner, cadence).
  2. Every sale is logged within 24h by whoever made it, with required fields: date, channel, HDYHAU answer, code used, items, gross €, discount €, COGS €.
  3. Social numbers are pulled from native Insights on a fixed day (e.g. Monday, for posts 7+ days old) so posts are compared at the same age.
  4. One owner per metric.
  5. Numbers are locked once the week is closed. Corrections are made as new entries, not edits.

### Gaps
- No published weekly marketing scorecard from a consumer brand of emet's size was found.

## 6. Fit for emet (€0 student team)

### Takeaway
Track one outcome (contribution profit vs the €15K pacing line) and 6–9 supporting numbers, all computable from two tables the team already controls: an **orders log** and a **content log**, plus a small **stall-session log**. Don't track anything you can't act on weekly.

### Recommended metrics (how each is logged and calculated in the web dashboard)
1. **Contribution profit to date vs pacing target** (owner: finance/ops).
   - Formula: `Σ(gross € − discounts € − COGS € − payment fees € − shipping/packaging €) − variable marketing € (samples, giveaways, print)`.
   - Pacing: €15K × (days elapsed ÷ days to June 2027), or a seasonal curve.
   - Shown as a line chart with the target line. Adapted from [CTC CM formula](https://commonthreadco.com/blogs/coachs-corner/the-complete-guide-to-ecommerce-contribution-margin).
2. **Revenue and orders per week, split by channel** (Instagram / TikTok / stall / referral-ambassador / other).
   - Channel = HDYHAU answer, with the code/UTM as a cross-check.
   - Weekly bar stacked by channel, plus cumulative revenue vs €30K.
3. **AOV** = revenue ÷ orders, weekly and per channel. A stall-vs-online AOV gap tells you where to push bundles.
4. **Contribution margin % per order** = CM ÷ net revenue. Gives the break-even "MER" for when ads begin (1 ÷ CM%, per [Polar](https://www.polaranalytics.com/post/mer-marketing-efficiency-ratio)).
5. **Repeat purchase rate** = customers with ≥2 orders ÷ customers. This needs a customer identifier (Instagram handle, email or phone) on every order. Show both a 60-day and an all-time version ([Hologrow](https://hologrow.ai/blog/customer-acquisition-quality)). Compare against ~28% for all ecommerce ([Rivo](https://www.rivo.io/blog/repeat-purchase-rate-complete-guide)), but expect lower early on.
6. **Content output and hit rate** (input metric; owner: each marketer).
   - Content log row per post: platform, format, date, author, hook/topic, views (at 7 days), reach, saves, shares/sends, profile visits, link taps, DMs received.
   - Hit rate = posts with views ≥ 2× trailing-10-post median ÷ posts published.
   - Pieces published per week per marketer is the main controllable input.
7. **Share + save rate per reach** = (shares + saves) ÷ reach, per post and as a weekly median. This is the best organic leading indicator, per [Mosseri's per-reach signals](https://www.socialmediatoday.com/news/instagram-shares-algorithm-insights-2025/738034/). Log from Instagram/TikTok native insights at day 7.
8. **Social → sale bridge:** weekly DMs/inquiries, bio-link taps, and **inquiry-to-order conversion** = orders with channel ∈ {IG, TT} ÷ inquiries. DMs are logged by a tally in the content log, or by an "inquiry" status in the orders log.
9. **Stall efficiency** (if stalls are frequent):
   - Stall-session log: date, location, hours, people staffing, conversations (tally), orders, revenue.
   - Derived: revenue per stall-hour, and conversation-to-sale rate.
   - QR scans are tracked via a UTM-tagged link (`utm_source=stall`).
- Blended CAC / MER: compute once real spend exists (`variable marketing € ÷ new customers`). Until then, show it as "n/a (organic)", so the definition is ready when spend arrives ([Polar CAC](https://www.polaranalytics.com/post/customer-acquisition-cost-cac)).

### Attribution setup (free)
- One discount/referral code per channel and per ambassador.
- UTM-tagged bio link and story links, with fixed `utm_source` values: `ig`, `tt`, `stall`, `ambassador`.
- A required HDYHAU dropdown on every order form, including in-person orders entered on a phone at the stall.
- QR codes at the stall point to a UTM URL.
- Rely on HDYHAU when the sources conflict, and note the disagreement rate.

### Weekly scorecard (fixed order; reviewed every Monday, 30 min)
1. Contribution profit to date vs pace.
2. Revenue and orders this week by channel.
3. AOV and CM%.
4. Repeat rate.
5. Posts published and hit rate.
6. Median share + save rate.
7. Inquiries and inquiry-to-order rate.
8. Revenue per stall-hour.

Discuss only the metrics off target, and focus on which inputs to change.

### What NOT to track
- Follower count as a goal, and likes (vanity, per [Mosseri's per-reach framing](https://www.socialmediatoday.com/news/instagram-shares-algorithm-insights-2025/738034/)). Follower count is fine as context, monthly.
- Engagement rate by followers compared with industry benchmarks (formulas vary from 0.36% to 5%, per [Inrō](https://www.inro.social/tools/instagram-engagement-rate-calculator)).
- ROAS or multi-touch attribution models (no ad spend, no pixel volume).
- LTV projections (too little history; use repeat rate instead).
- Hashtag performance, posting-time micro-optimisation, impressions totals.
- Paid tools like Fairing, Triple Whale or Northbeam. Free forms and native Insights cover it.

### Gaps
- Benchmarks for inquiry-to-order rates, stall revenue per hour and content hit rate for student brands do not exist in the sources found. emet should set its own baselines after 4–6 weeks of logging.
