# Free marketing data sources for a €0-budget student startup (Next.js + Supabase), as of October 2026

Scope: what a Spain-based student team can pipe into its own dashboard for free, what each source needs, and where manual entry or a CSV is the realistic route. Research date: 2026-10-14. Wherever the official docs did not answer a question, it is listed under Gaps.

## Instagram API (Instagram Login / Graph API): account type, app review, metrics, retention, limits, tokens

### Takeaway
You can automate your OWN Instagram Business or Creator account with no App Review (Standard Access) and get reach, views, saves, shares, profile visits, follows and story link clicks per media. Three things to plan for: `impressions` and `plays` are gone (replaced by `views`, cut over 21 April 2025), Story insights last only 24 h, and the long-lived token has to be refreshed before 60 days pass. This is the best "API now" source on the list.

### Cited Findings
- **Account type:** Instagram API with Instagram Login is for "Instagram professionals" (businesses and creators). It does not require a linked Facebook Page. Personal accounts are not supported. — [Meta: Instagram API with Instagram Login](https://developers.facebook.com/docs/instagram-platform/instagram-api-with-instagram-login)
- **Scopes:** `instagram_business_basic`, `instagram_business_content_publish`, `instagram_business_manage_messages`, `instagram_business_manage_comments`. The old `business_*` scope names were deprecated on 27 January 2025. — [Meta: Instagram API with Instagram Login](https://developers.facebook.com/docs/instagram-platform/instagram-api-with-instagram-login)
- **App Review:** Standard Access covers an app used only for a business you own or manage, and it needs no App Review under Instagram Login, Facebook Login or no login. Advanced Access, which requires App Review, is for Tech Providers serving multiple businesses. You cannot use Facebook Login and Instagram Login in the same app. — [Meta: App Review for Instagram API](https://developers.facebook.com/docs/instagram-platform/app-review)
  - A third-party source says Standard Access only works for accounts held by people with a role on the app (admin, developer or tester). Meta's page does not spell this out. — [singhamandeep.com (vendor blog, unverified)](https://singhamandeep.com/meta-permissions-approval-case-study/). One developer guide claims the insights scope needs its own review, which contradicts Meta's table. — [rapidevelopers.com](https://www.rapidevelopers.com/api-automations/how-to-automate-instagram-analytics-using-the-api)
- **Media metrics (per post, reel and story):**
  - FEED: `comments, facebook_views, follows, impressions (legacy), likes, profile_activity, profile_visits, reach, reposts, saved, shares, total_interactions, views, total_comments, total_likes, total_views`
  - REELS: `comments, crossposted_views, facebook_views, ig_reels_avg_watch_time, ig_reels_video_view_total_time, likes, reach, reels_skip_rate, reposts, saved, shares, total_interactions, views, …`
  - STORY: `follows, link_clicks, navigation, profile_activity, profile_visits, reach, replies, reposts, shares, total_interactions, views, …`
  - `views` is labelled "in development". `total_views` (which includes paid and Facebook views) is only available with Facebook Login. — [Meta: Media Insights](https://developers.facebook.com/docs/instagram-platform/reference/instagram-media/insights)
- **Retention and latency:** media metrics are stored for up to 2 years, data can lag by up to 48 h, and Story metrics are available for only 24 h (the `story_insights` webhook can capture them). Metrics with no data come back as an empty set, not 0. — [Meta: Media Insights](https://developers.facebook.com/docs/instagram-platform/reference/instagram-media/insights)
- **Account metrics:** `accounts_engaged, comments, follows_and_unfollows, likes, profile_links_taps, reach, replies, reposts, saves, shares, total_interactions, views`, plus `follower_demographics` and `engaged_audience_demographics`.
  - Most metrics support only `metric_type=total_value`. `reach` also supports `time_series`. If you omit `since`/`until`, the API returns the last 24 h.
  - Accounts with fewer than 100 followers do not get `follower_demographics`, `follows_and_unfollows`, `follower_count` or `online_followers`. `online_followers` covers the last 30 days only.
  - `website_clicks` is not in the current metrics table (`profile_links_taps` is the nearest metric). — [Meta: Account Insights](https://developers.facebook.com/docs/instagram-platform/api-reference/instagram-user/insights)
- **Deprecations:** the 21 January 2025 changelog (v22.0) added `views` and deprecated `impressions`, `plays`, `clips_replays_count` and `ig_reels_aggregated_all_plays_count`. This applied to v22+ first and to all versions from 21 April 2025. `impressions` still works only for media created before 2 July 2024. — [Meta Graph API v22.0 changelog](https://developers.facebook.com/docs/graph-api/changelog/version22.0); [Meta: Media Insights](https://developers.facebook.com/docs/instagram-platform/reference/instagram-media/insights). Metricool dates the change to April 2024, which conflicts with Meta's own dates. — [Metricool help](https://help.metricool.com/en/article/instagram-replaces-impressions-with-views-what-you-need-to-know-ustr2f)
- **Tokens:**
  - A short-lived token lasts 1 h. Exchange it server-side (this needs the app secret) for a long-lived token that lasts 60 days.
  - A token can be refreshed once it is at least 24 h old and still valid. Each refresh gives 60 more days. A token not refreshed within 60 days expires for good. — [Meta: Refresh Access Token](https://developers.facebook.com/documentation/instagram-platform/reference/refresh_access_token.md); [Make community: reauthorize every 60 days](https://community.make.com/t/instagram-connection-has-to-be-reauthorized-every-60-days/41109)
- **Rate limits:**
  - Third-party guides quote a Business Use Case limit of 4800 × impressions per 24 h. Meta does not publish the formula, so read the `X-Business-Use-Case-Usage` header instead.
  - Some guides quote "200 calls/user/hour". That figure comes from the Platform Rate Limit (Business Discovery and Hashtag Search). Going over returns HTTP 429. — [Phyllo rate-limit guide 2026](https://www.getphyllo.com/post/instagram-api-rate-limits-explained-and-how-to-scale-beyond-them-2026); [bundle.social](https://bundle.social/blog/instagram-api-rate-limits)

### Inferences
- For one owned account, polling about 30 recent media once a day is well under any limit.
- Set up a Supabase cron or Edge Function to refresh the token every ~50 days and to snapshot Story insights within 24 h (or use the webhook). Without that, Story data is lost.
- Store per-media snapshots daily (`views`, `reach`, `saved`, `shares`, `follows`, `profile_visits`). That builds history, because the API returns values, not a time series per post.
- Because of the <100-follower thresholds, a brand-new account sees little follower-level data at first.

### Gaps
- No official Meta page confirmed which app roles cover Standard Access, or whether Business Verification is needed for Standard Access on one owned account. Check in the App Dashboard.
- I could not find an official retention limit for account-level insights (the 2-year figure is for media).
- I did not verify the exact current Graph API version as of October 2026. One third-party guide mentions v25.0. — [adlibrary.com](https://adlibrary.com/posts/eu-dsa-ad-repositories-developers)

## TikTok: Display API, Research API, Business/organic APIs, and the CSV fallback

### Takeaway
A small creator can get public per-video counts (views, likes, comments, shares) and basic profile data through the Display API. Production access needs Login Kit and Display API approval; Sandbox mode allows testing without review for up to 10 target accounts. The Research API is closed to a commercial startup. The deeper metrics (watch time, traffic sources, followers gained) need the TikTok API for Business organic endpoints or manual export from TikTok Studio. Realistic plan: Display API (or Sandbox) for public counts, and a manual/CSV log for the deeper analytics.

### Cited Findings
- **Display API endpoints:** `/v2/user/info/` (open_id, avatar_url, display_name, profile_deep_link, bio_description), `/v2/video/list/` and `/v2/video/query/`. Scopes are `user.info.basic` and `video.list`. — [TikTok: Display API overview](https://developers.tiktok.com/doc/display-api-overview)
- **Video object fields:** `id, create_time, cover_image_url` (CDN link that expires after 6 h), `share_url, video_description, duration, title, embed_html, like_count, comment_count, share_count, view_count, is_aigc`. — [TikTok: Video object](https://developers.tiktok.com/doc/tiktok-api-v2-video-object)
- **Prerequisites:** "Approval for both a Login Kit and TikTok API products" plus the granted `user.info.basic` and `video.list` scopes. — [TikTok: Display API Get Started](https://developers.tiktok.com/doc/display-api-get-started)
- **Sandbox:** up to 5 sandboxes, each shareable with up to 10 TikTok accounts as target users. Lets you test integrations without submitting the app for review. — [TikTok blog: Introducing Sandbox](https://developers.tiktok.com/blog/introducing-sandbox)
- **Tokens:** the access token lasts 24 h (86,400 s) and the refresh token 365 days, according to third-party guides. TikTok's legacy guide only says the expiry values are returned in the response. — [Phyllo TikTok guide 2026](https://www.getphyllo.com/post/tiktok-api-integration-guide-2026-setup-endpoints-common-pitfalls); [TikTok: Manage user access tokens](https://developers.tiktok.com/docs/en/login-kit-manage-user-access-tokens)
- **Research API:** eligible applicants are non-profit academic institutions in the US, EEA, UK or Switzerland, or not-for-profit research bodies in the EU. Use must be non-commercial. — [TikTok: Research Tools](https://developers.tiktok.com/products/research-api); [TechCrunch 2023](https://techcrunch.com/2023/07/20/tiktok-ads-transparency). One EU institute took 21 months (Dec 2023 to Sep 2025) to get working access. — [KInIT](https://kinit.sk/when-research-apis-close-the-door-when-you-finally-get-it-it-is-not-what-you-have-asked-for/)
- **TikTok API for Business, Organic API:** it comprises the Accounts, Mentions, TikTok One, Discovery and Spark Ads Recommendation APIs. — [TikTok Ads help: About API for Business](https://ads.tiktok.com/help/article/marketing-api). Connectors report it returns daily account- and video-level metrics (views, watch time, completion rate) for Business or Creator accounts only. — [Adriel docs (third-party)](https://docs.adriel.com/data-sources/o-z/tiktok-organic/how-to-connect)

### Inferences
- The Display API gives public counts only. It does not give reach, watch time, traffic source or followers gained per video.
- Students could plausibly stay in Sandbox for their own 1–3 accounts, but whether Sandbox tokens are stable enough for production use is unverified.
- For a €0 team, the low-effort path is a weekly manual entry, or a CSV upload where TikTok Studio offers one, into a Supabase table.

### Gaps
- I found no official confirmation that `user.info.stats` (follower_count, likes_count, video_count) exists or what it requires.
- I found no official statement on whether TikTok API for Business organic access is free or self-serve for a small creator.
- I could not verify exactly what TikTok Studio or Analytics exports (CSV/XLSX columns, date range) in 2026. Treat CSV export as "check in-app"; manual logging is the safe assumption.
- I found no Display API rate limits.

## Competitor and creative research: Meta Ad Library API and TikTok Creative Center

### Takeaway
Both are free. Meta's Ad Library API returns all ads delivered in the EU (not only political ones), but requires identity verification and a search term or page ID. TikTok Creative Center (Top Ads, trends) is a free web tool and is better used by hand than integrated.

### Cited Findings
- **Meta Ad Library API access:** you need ID and location confirmation (facebook.com/ID), which Meta takes a few days to approve. Every call requires `access_token` and `ad_reached_countries`, plus `search_terms` or `search_page_ids`.
  - For US-only queries the API surfaces only political/issue ads. EU country codes also surface commercial ads, under DSA Art. 39.
  - EU ads include targeting (age, gender, location), estimated EU reach and beneficiary/payer.
  - Retention: political ads worldwide are kept 7 years, all EU/UK ads 1 year. — [adlibrary.com: EU DSA repositories](https://adlibrary.com/posts/eu-dsa-ad-repositories-developers); [Zernio docs](https://docs.zernio.com/platforms/meta-ads/ad-library). These are secondary sources; the official page was not reachable during research.
- **TikTok Creative Center:** a free hub with Top Ads filterable by region and industry. Without login only 4 cards render; a free TikTok login lifts that limit. Sources conflict on whether a Business account is needed. — [Segwise guide 2026](https://segwise.ai/blog/tiktok-creative-center-guide-advertisers.md); [bir.ch](https://bir.ch/blog/tiktok-creative-center)

### Inferences
- Integrating these is low value for a student brand. Run manual weekly "swipe file" sessions and log notable competitor creatives (link, hook, format) in a Supabase table.

### Gaps
- I could not open the official Meta Ad Library API page (socket error). Access rules come from secondary sources.
- I found no official TikTok Creative Center API, and no confirmation that the Spain region is selectable.

## Web and link tracking: GA4 Data API, UTMs, shorteners, QR codes, link-in-bio

### Takeaway
The GA4 Data API is free with generous quotas: 200k tokens per property per day is plenty for a daily pull. UTM tags plus GA4 cover website attribution. For click analytics on bio links and QR codes, Dub's free tier (25 new links/month, 1,000 tracked events/month, 30-day history) beats Bitly free (about 5 links/month, effectively no analytics, interstitial ads). A self-hosted redirect route in Next.js that logs clicks to Supabase gives unlimited €0 tracking.

### Cited Findings
- **GA4 Data API quotas** (standard property): 200,000 core tokens per property per day, 40,000 per property per hour, 14,000 per project per property per hour, 10 concurrent requests, 10 server errors per project per property per hour, and 120 potentially thresholded requests per hour. — [Google: Data API quotas](https://developers.google.com/analytics/devguides/reporting/data/v1/quotas)
- **Dub free plan:** 25 new links/month, 1,000 tracked events/month (clicks, QR scans and conversions combined), 3 custom domains, 1 user, 30-day analytics retention. Events past the cap are still recorded but you need to upgrade to view them. — [agentdeals.dev](https://agentdeals.dev/vendor/dub-co); [Linkly review](https://linklyhq.com/review/dub). One comparison claims "1,000 links (25 clicks/link)", which conflicts with the others and is likely wrong. — [sed.sh](https://sed.sh/compare/dubco)
- **Bitly free (2026):** about 5 links/month, 2 QR codes/month, 1,000 API requests/month, no click or scan analytics, and an ad page before redirect since February 2025. Clicks are unlimited. — [qck.sh](https://qck.sh/blog/bitly-free-plan-limits); [u2l.ai](https://u2l.ai/blog/bitly-free-plan-review). These are competitor blogs, so verify on bitly.com/pricing.
- **Linktree free:** a permanent free tier. Sources conflict on whether it shows per-link lifetime clicks or only total visits. Payment blocks on Free take a 12% cut. — [unilink.us](https://www.unilink.us/blog/is-linktree-free); [replug.io](https://replug.io/blog/linktree-pricing)

### Inferences
- A `/go/[slug]` route in Next.js does the job for €0 and with no caps: it logs timestamp, slug, referrer, user-agent and a coarse country (from a Vercel header) to Supabase, then does a 302 redirect to a UTM-tagged URL. Use it for the bio link, per-stall QR codes and per-influencer links.
- QR codes can be generated free (for example with an open-source library) and simply point to `/go/stall-<name>`.

### Gaps
- I did not verify UTM builder tools, because the format is a convention and needs no service (Google's Campaign URL Builder is free).
- I did not verify Linktree analytics granularity on the official site.

## Sales capture at €0: Shopify, Stripe, social shops in Spain/EU, discount codes

### Takeaway
Shopify is not €0: there is a 3-day trial, then €1/month for 3 months, then Basic at €32/month (€24/month billed annually). Stripe Payment Links have no monthly fee and charge only per transaction (1.5% + €0.25 for standard EEA cards). TikTok Shop has been live in Spain since December 2024. Instagram/Facebook native checkout is not available in the EU.

### Cited Findings
- **Shopify (ES pricing page):** Basic €32/month (€24/month annual), Grow €92 (€69), Advanced €384 (€289). Trial is 3 days, then €1/month for the first 3 months on most plans.
  - Basic online card fee is 2.1% + €0.30, Bizum 0.9% + €0.20, and an extra 2% if you use a provider other than Shopify Payments.
  - The page did not list a Starter plan. — [Shopify ES pricing](https://www.shopify.com/es/precios)
- **Stripe (EEA business):** standard EEA cards 1.5% + €0.25, premium EEA cards 1.9% + €0.25, UK cards 2.5% + €0.25, international cards 3.25% + €0.25. — [Stripe support: EEA pricing](https://support.stripe.com/questions/pricing-updates-for-businesses-based-in-the-european-economic-area-(eea))
- **TikTok Shop Spain:** launched in December 2024 (sources give 9 or 10 December), invite-only at first. Commission is reported as 9% since January 2026. About 21,000 local sellers were active between November 2025 and April 2026. Expanded to NL, BE, PL and AT on 15 June 2026. — [nss magazine](https://www.nssmag.com/en/lifestyle/39206/tiktok-shop-europe-spain); [TikTok Newsroom](https://newsroom.tiktok.com/tiktok-shop-expands-across-europe?lang=en-150); [worldef](https://worldef.com/2026/05/28/tiktok-shop-spain-ecommerce/); [novadata](https://novadata.io/resources/news/tiktok-shop-europe-4-countries-sell-across-europe-june-2026)
- **Instagram Shopping in Spain:** Agorapulse lists Spain among the countries that keep product tagging without Instagram checkout. Shopify Community threads report that Meta restricts Shops to checkout-enabled (US-only) accounts and that EU merchants hit "content not available in this region" errors. The sources conflict. — [Agorapulse](https://support.agorapulse.com/en/articles/8769612-setting-up-commerce-manager-for-product-tagging-on-instagram); [Shopify Community](https://community.shopify.com/t/instagram-not-showing-store-or-products-despite-everything-set-up-properly/161545/6)

### Inferences
- **Lowest-cost stack:** Stripe Payment Links (one link per product, or one per channel) plus a Stripe webhook that writes each `checkout.session.completed` event into Supabase. That gives automatic sales data for €0 fixed cost.
  - Stripe promotion codes (for example `IG10`, `TT10`, `STALL10`) attribute sales to channels.
  - Stripe Checkout supports `client_reference_id` and metadata for UTM pass-through.
  - Both points are general Stripe knowledge and were not re-verified in this session.
- Cash and Bizum sales at physical stalls have to be logged by hand through a quick mobile form in the dashboard.
- TikTok Shop is an option but adds 9% commission plus seller onboarding. Its data stays inside Seller Center unless you integrate the TikTok Shop Partner API, which I did not research.

### Gaps
- I could not confirm Shopify Starter plan price or availability in Spain.
- I did not confirm on Stripe's site that Payment Links carry no extra fee.
- I did not research TikTok Shop seller requirements for students (autónomo/company registration) or the Shop API.

## Fit for emet

| Source | Recommended integration | Effort | Value | Notes |
|---|---|---|---|---|
| Instagram (own Business/Creator account) | **API now** (Instagram Login, Standard Access, no App Review) | Medium: OAuth, daily cron, token refresh every ~50 days, 24 h story capture | High | Use `views` (not impressions/plays); history only builds if you snapshot daily |
| TikTok public video counts | **API (Display API, Sandbox first)** or **manual log** | Medium-High: needs Login Kit + Display API approval for production | Medium | Views, likes, comments and shares only |
| TikTok deep analytics (watch time, traffic source, follows) | **Manual weekly log** (CSV if Studio provides one) | Low | Medium-High | Business organic API access for small creators is unverified |
| TikTok Research API | Not eligible | n/a | n/a | Academic/non-profit, non-commercial only |
| Meta Ad Library | **Manual** (web UI); API optional after ID verification | Low (manual) / Medium (API) | Low-Medium | EU queries include commercial ads |
| TikTok Creative Center | **Manual** swipe file | Low | Low-Medium | No public API found |
| GA4 (website) | **API now** (Data API, service account) | Low-Medium | High once a site exists | 200k tokens/day is ample |
| Own `/go/[slug]` redirect + QR codes | **Build in-app** (Next.js route → Supabase) | Low | High | €0, unlimited; replaces Bitly/Dub/Linktree analytics |
| Dub free | Optional (API available) | Low | Medium | 25 links and 1k events/month, 30-day history |
| Bitly free / Linktree free | Avoid for analytics | n/a | Low | Bitly free has no analytics; Linktree granularity unclear |
| Stripe Payment Links + promo codes | **API now** (webhook → Supabase) | Low-Medium | High | €0 fixed cost; 1.5% + €0.25 per EEA card |
| Shopify | Skip at €0 (Basic €32/month after trial) | n/a | Medium later | Revisit when revenue justifies it |
| TikTok Shop (Spain) | Later / manual export | Medium | Medium | Live in ES since Dec 2024; ~9% commission |
| Instagram Shopping checkout | Not available in EU | n/a | n/a | At most product tagging; status conflicting |
| Stall cash/Bizum sales | **Manual log** (mobile form) | Low | High | Use per-stall codes so sales are attributed by channel |
