# Data visualisation for a student marketing dashboard: patterns that help, and when 3D helps or hurts

Labels: **[Research]** = peer-reviewed or academic finding. **[Practitioner]** = opinion or guidance from a designer, vendor or product. **[Vendor]** = a product's own description of its features, not checked independently.

## Q1. Which chart types do analytics products use for funnels, cohorts, channel mix, creative leaderboards, experiments and goal pacing?

### Takeaway
Mature analytics tools mostly use plain 2D forms. They show funnels as stepped bars with the conversion rate between steps, retention as a cohort heatmap table that can switch to a curve, creative performance as a thumbnail tile grid ranked by a chosen metric, and experiments as a confidence interval compared against zero. For goal pacing, the established pattern is Stephen Few's bullet graph.

### Cited Findings
- **Retention, Mixpanel:** the Retention report measures how users engage over time, and a saved metric is a behaviour (events, a funnel or a retention definition) plus how it is measured. [Vendor] — [Mixpanel docs: Retention](https://docs.mixpanel.com/docs/reports/retention.md)
- **Retention, Mixpanel:** the retention API returns counts for each cohort in each time interval. "First time" retention maps to `retention_type=birth` and "Recurring" maps to `compounded`. [Vendor] — [Mixpanel retention query reference](https://docs.mixpanel.com/reference/retention-query.md)
- **Retention, Mixpanel:** the table puts cohorts in rows and later time periods in columns, shown as a heatmap that can switch to a line-chart "Retention Curve". This comes from an AI-assistant answer on Mixpanel's community site, not from the official docs. [Vendor, low confidence] — [Mixpanel community](https://community.mixpanel.com/x/ask-ai/msg_LXAKjRrZgBIV/how-to-display-a-monthly-cohort-chart-with-event-t)
- **Funnels, Mixpanel:** Mixpanel describes funnels as measuring conversion through a series of events so you can find where people drop off. [Vendor] — [Mixpanel reports overview (mirror)](https://mintlify.com/mixpanel/docs/reports/overview)
- **Creative leaderboards, Motion:**
  - Motion has a "Tile View" that shows creative thumbnails with up to 6 metrics each, next to a bar chart for comparing assets. [Vendor] — [Motion help: How to build a report](https://help.motionapp.com/en/articles/7090459-how-to-build-a-report)
  - Its "Top Performing Ads" report groups duplicate ads into a leaderboard, can chart two KPIs at once, and has a time-series view for spotting creative fatigue. [Vendor] — [Motion: Top performing ads report](https://motionapp.com/library/talk/motion-top-performing-ads-report/)
  - Motion's "Launch Analysis" follows ads from launch to "winner" status and adds badges automatically once an ad reaches a spend target. [Vendor] — [Motion: launch analysis](https://motionapp.com/library/talk/best-launch-analysis-tool-ads-on-facebook-tiktok-youtube/)
  - Motion's own argument is that putting playable creatives next to their metrics avoids pasting screenshots into slide decks. [Vendor] — [Motion vs Ads Manager](https://motionapp.com/blog/motion-vs-ads-manager-creative-analysis)
  - An independent review says Motion's deepest integration is with Meta, and its TikTok, YouTube and LinkedIn support is more limited. [Practitioner] — [Superscale review](https://superscale.ai/alternatives/motion/review)
- **Experiments, Amplitude:**
  - Amplitude's experiment analysis reads a confidence interval against zero. If the interval contains 0, there is not yet enough evidence of a difference. If it is entirely above 0, the effect is positive; entirely below 0, negative. The default method is a sequential test. [Vendor] — [Amplitude Experiment Analysis view](https://amplitude.com/docs/feature-experiment/analysis-view)
  - Amplitude also shows a "confidence interval of absolute performance over time" chart (sequential testing only), plus cumulative exposure, performance by variant, and mean over time. [Vendor] — [Amplitude: Experiment results, dig deeper](https://amplitude.com/docs/en/analytics/charts/experiment-results/experiment-results-dig-deeper)
- **Experiments, critique:** Analytics-Toolkit argues that many A/B-test tools show confidence intervals in ways people misread. [Practitioner] — [Analytics-Toolkit: perils of poor data visualization in CRO](https://blog.analytics-toolkit.com/?p=1164)
- **Experiments, alternative design:** CXL describes a simplified chart with two point estimates, dotted interval lines, and shaded green and red zones for a significant win or loss. [Practitioner] — [CXL: How to visualize A/B test results](https://conversionxl.com/blog/visualize-ab-test-results/)
- **Goal pacing, bullet graph:**
  - A bullet graph compares one main measure with a related one (a target, or last year's value) and places it within qualitative ranges such as poor, OK and good. [Practitioner] — [BetterEvaluation: Bullet graph](https://www.betterevaluation.org/methods-approaches/methods/bullet-graph)
  - Few also shows a reversed scale for "not to exceed" targets such as cost per acquisition (CPA). [Practitioner] — [Perceptual Edge blog: bullet graphs for not-to-exceed targets](https://www.perceptualedge.com/blog/?p=217)
  - Secondary sources say the qualitative bands should be muted background shades. [Practitioner] — [Visualizing.org: bullet chart](https://www.visualizing.org/bullet-chart)
- **Animated globes, GitHub:** GitHub's homepage globe draws each pull request as an arc from where it was opened to where it was merged. Hovering shows the PR, repository, timestamp, language and locations, and each arc can be clicked. Precise details come from the hover text, not from the 3D geometry. [Practitioner] — [GitHub blog: How we built the GitHub globe](https://github.blog/engineering/engineering-principles/how-we-built-the-github-globe/)

### Inferences
- In every product found, exact comparison is done with 2D position or length: funnel bars, retention curves, interval plots and bullet graphs. Colour or images are used only for a quick scan, such as heatmap cells and thumbnails.
- The thumbnail-grid leaderboard used by Motion is the norm for creative analytics, because marketers recognise a creative by its image, not its ID.

### Gaps
- I did not fetch the official docs for Shopify Analytics, HubSpot or GA4 funnel exploration, or Linear's and Stripe's dashboard design posts, so I cannot cite their exact chart choices.
- I could not retrieve Few's original *Bullet Graph Design Specification* PDF, so its exact colours and dimensions are unverified.

## Q2. What does perception research say about 3D charts, and where does 3D add value?

### Takeaway
The research consensus is that 3D perspective and depth make it harder to read and compare abstract quantities. Effect sizes vary, and a few studies find no difference. 3D is justified for truly spatial data or shape perception, especially when people can rotate it. Memorability and engagement benefits come from distinctive design, colour, recognisable objects, and especially good titles and annotations, not from 3D as such.

### Cited Findings
- **Cleveland & McGill (1984):** people judge position on a common scale most accurately, then length, then angle and slope, then area, with volume and colour shading last. Heer & Bostock replicated the study on Mechanical Turk in 2010 and extended it to bubble charts and treemaps. [Research] — [Cornell INFO 3312 notes](https://info3312.infosci.cornell.edu/ae/graphical-perception-A.html); [Cleveland & McGill experiment text](https://vis.arc.vt.edu/%7Enpolys/projects/safas/science.pdf)
- **Munzner, "No unjustified 3D":**
  - 3D is legitimate for truly spatial 3D data but "needs very careful justification for abstract data".
  - The dangers she lists include occlusion, perspective distortion (which "interferes with all size channel encodings") and tilted text.
  - Time-series curves extruded into 3D make "detailed comparisons impossible".
  - The justified exception is perceiving the shape of 3D spatial data, especially with interactive navigation.
  - She presents these as guidelines, not absolute laws. [Research/textbook] — [Munzner, VAD rules of thumb (slides)](https://cs.ubc.ca/~tmm/talks/vad/VAD-rules.pdf); [Munzner minicourse session 4](https://www.cs.ubc.ca/~tmm/talks/minicourse14/minicourse14-session4.pdf); [Routledge: Visualization Analysis and Design](https://www.routledge.com/Visualization-Analysis-and-Design/Munzner/p/book/9781466508910)
- **Zacks et al., 3D bar charts:** adding perspective depth cues to bar graphs lowered estimation accuracy. The penalty was smaller when judgments were delayed. [Research] — [Zacks et al., "Reading bar graphs: effects of extraneous depth cues"](https://profiles.wustl.edu/en/publications/reading-bar-graphs-effects-of-extraneous-depth-cues-and-graphical/)
- **Just-noticeable-difference study:** people were about 10% more accurate with 2D bars than 3D bars, and bars had to differ more in 3D before people could tell them apart. These figures come from the abstract. [Research] — [University of Galway: JND in 2D and 3D bar charts](https://research.universityofgalway.ie/en/publications/just-noticeable-differences-in-2d-and-3d-bar-charts-a-psychophysi-3/)
- **Studies that conflict:**
  - Siegrist found no significant accuracy difference between 2D and 3D bars, though 3D was slightly slower. [Research, via survey] — [arXiv: Task-based effectiveness of basic visualizations](https://arxiv.org/pdf/1709.08546)
  - Svalina et al. (2024) found no significant difference in understanding for 3D bars with different gap sizes. [Research] — [MDPI Digital 2024](https://www.mdpi.com/2673-6470/4/4/46)
  - So the 3D penalty is real but not universal, and it is concentrated in perspective and depth cues.
- **Spatial memory:**
  - Cockburn & McKenzie (CHI 2002) found performance got worse as users had more freedom to use the third dimension, and users found the higher-dimensional interfaces more cluttered. [Research] — [ACM DOI 10.1145/503376.503413](https://dx.doi.org/10.1145/503376.503413)
  - A 2004 follow-up concluded that, on static single-screen (monocular) displays, 3D perspective effects do not change how well spatial memory works. [Research] — [Cockburn CRPIT abstract](https://crpit.scem.westernsydney.edu.au/abstracts/CRPITV28Cockburn.html)
  - An earlier 3D advantage reported by Tavanti & Lind was largely not replicated. [Research] — [arXiv 2308.12201](https://arxiv.org/pdf/2308.12201)
- **Memorability, Borkin et al. 2013:**
  - In a study of 2,070 visualizations, people agreed consistently on which charts were memorable.
  - Colour and a recognisable human object made charts more memorable, and unusual chart types were more memorable than common ones. [Research] — [Harvard VCG: What makes a visualization memorable?](https://vcg.seas.harvard.edu/publications/20130101-what-makes-a-visualization-memorable)
- **Memorability, Borkin et al. 2015 ("Beyond Memorability"):**
  - Visualizations with effective titles and text annotations were remembered more accurately.
  - Pictograms did not distract people.
  - This is from secondary coverage; I did not verify it in the paper. [Research, secondary] — [World Bank blog](https://blogs.worldbank.org/opendata/what-makes-data-visualization-memorable); [Harvard VCG: eye movement and memory experiments](https://vcg.seas.harvard.edu/publications/20170801-what-eye-movement-and-memory-experiments-can-tell-us-about-the-human-perception-of-visualizations)

### Inferences
- In emet's mountain, revenue = altitude is a decorative metaphor, not truly spatial data. Under Munzner's rule it can be justified for overview, identity and memorability, but never as the place where a student reads an exact number.
- Borkin's findings support having one distinctive, memorable visual "hero" in a section. They also show that titles and annotations do more for recall than the 3D form itself.

### Gaps
- I found no controlled study of terrain or landscape metaphors for abstract business metrics. The "content landscape" idea is untested; it is plausible only through Munzner's overview-plus-interaction argument.
- I did not retrieve Tufte's "chartjunk" / "lie factor" arguments against 3D from a primary source.

## Q3. Which patterns make metrics actionable?

### Takeaway
Use length and 2D position for the numbers that matter. Always show a comparison (a target, the previous period or a benchmark). Use sparklines inside tables for context, label the chart directly and annotate events, and encode status with lightness and icons rather than red versus green alone.

### Cited Findings
- **Dashboards are for fast reading:** NN/g defines dashboards as single-page, at-a-glance displays meant for fast consumption, not exploration. It recommends length and 2D position for quantitative data so charts work with preattentive processing (what the eye picks out before conscious attention). [Practitioner/UX research] — [NN/g: Dashboards and preattentive processing](https://www.nngroup.com/articles/dashboards-preattentive/); [NN/g video: Data visualizations for dashboards](https://www.nngroup.com/videos/data-visualizations-dashboards/)
- **Sparklines:** Tufte defines sparklines as "data-intense, design-simple, word-sized graphics" that can go anywhere a word or number can: in a sentence, table or headline. [Practitioner] — [Tufte: Sparkline theory and practice](https://www.edwardtufte.com/notebook/sparkline-theory-and-practice-edward-tufte/); [Wikipedia: Sparkline](https://Www.Wikipedia.org/wiki/Sparkline)
- **Comparison to a target:** the bullet graph pattern is described under Q1. [Practitioner] — [BetterEvaluation](https://www.betterevaluation.org/methods-approaches/methods/bullet-graph)
- **Titles and annotations:** these improve recall, per Borkin 2015 (secondary source, see Q2). [Research, secondary] — [World Bank blog](https://blogs.worldbank.org/opendata/what-makes-data-visualization-memorable)
- **Uncertainty for non-experts:**
  - Hypothetical outcome plots (HOPs), which animate random draws from a distribution, beat error bars and violin plots when people judged how reliable an ordering was. Viewers can rely on counting rather than statistical reasoning (Hullman, Resnick & Adar 2015). [Research] — [MU Collective: HOPs](https://mucollective.northwestern.edu/project/hops)
  - HOPs helped untrained observers judge trends in ambiguous data (Kale et al. 2019). [Research] — [Kale et al. 2018 InfoVis PDF](https://mucollective.northwestern.edu/files/2018-HOPsTrends-InfoVis.pdf)
  - Limitation: HOPs take time to play and add cognitive load. [Research review] — [arXiv 2011.07586](https://arxiv.org/pdf/2011.07586)
- **Colour-blind-safe status colours:**
  - Avoid red/green/brown, pink/turquoise/grey and purple/blue when they have the same brightness. Varying lightness is the main fix. If in doubt, pair an orange or red with a blue, and if you use green, choose a yellowish or bluish one.
  - Red-green colour deficiency affects about 1 in 12 men and 1 in 200 women of Northern European descent. [Practitioner] — [Datawrapper: colorblindness part 1](https://www.datawrapper.de/blog/colorblindness-part1); [part 2](https://www.datawrapper.de/blog/colorblindness-part2); [Datawrapper colour check](https://www.datawrapper.de/blog/colorblind-check)
  - Use Viridis for continuous colour scales. [Practitioner] — [NCEAS colorblind-safe schemes](https://nceas.ucsb.edu/sites/default/files/2022-06/Colorblind%20Safe%20Color%20Schemes.pdf)

### Inferences
- A "what changed and why" card is a large number, a change versus the previous period, a sparkline and a one-line annotation. It brings together Tufte (sparklines), NN/g (fast reading) and Borkin (text annotations aid recall).
- For experiment results aimed at students, a simplified interval-against-zero chart with plain-language verdicts ("not enough evidence yet", "B is likely better") follows Amplitude's decision rules and avoids the misreadings Analytics-Toolkit describes. HOPs are an optional upgrade for teaching.

### Gaps
- I found no study specifically on annotating campaign launches on timelines. The recommendation rests on Borkin's annotation finding plus practitioner convention.
- Small multiples: I did not retrieve a primary Tufte source in this session.

## Q4. What are good examples of tasteful 3D or interactive storytelling, and how do they keep numbers readable?

### Takeaway
The good examples use 3D for overview and atmosphere and put the exact data in hover text, tooltips or a constrained 2D view. They also fall back to static or stepped views on weak devices and phones.

### Cited Findings
- **GitHub globe, performance:** it targets 60 FPS. If the last 50 frames drop below 55.5 FPS, it falls back to lower quality tiers (lower pixel density, about 12k down to about 8k Earth points, fewer PRs shown). It shows an SVG gradient placeholder that crossfades to the canvas once the first frame is ready, and it disables antialiasing for wider device support. [Practitioner] — [GitHub blog](https://github.blog/engineering/engineering-principles/how-we-built-the-github-globe/)
- **GitHub globe, data:** it uses real pull-request data as "proof of life", and hovering or clicking reveals exact details. [Practitioner] — [GitHub blog](https://github.blog/engineering/engineering-principles/how-we-built-the-github-globe/); [Visualizing GitHub's global community](https://github.blog/engineering/engineering-principles/visualizing-githubs-global-community/)
- **GitHub globe, accessibility:** the write-up says nothing about accessibility or reduced motion. That is a gap in the example, not an endorsement of skipping it. [Observation] — [GitHub blog](https://github.blog/engineering/engineering-principles/how-we-built-the-github-globe/)
- **NYT 3D yield curve (Aisch & Cox, 2015):**
  - It is cited as a rare good use of 3D, built on about 5,000 trading days of data. [Practitioner] — [PolicyViz](https://policyviz.com/2022/12/09/updating-the-new-york-times-yield-curve-graphic/)
  - It used computed "optimal views" and a narrative stepper, and on mobile it became a stepper of static views while desktop allowed free rotation. [Practitioner] — [Data Stories with Gregor Aisch](https://datastori.es/data-stories-tv-00-the-nyt-3d-yeld-curve-chart-w-gregor-aisch/); [Ritholtz](https://ritholtz.com/2015/03/3-d-view-of-the-yield-curve)

### Inferences
- The pattern to copy is: guided camera presets (not free orbit) on mobile, numbers in 2D overlays or tooltips, a static fallback, and adaptive quality.

### Gaps
- I did not research Pudding.cool or Stripe's globe in this session.

## Q5. What does mobile-first dashboard guidance say?

### Takeaway
On phones: KPIs at the top, then one simple chart type per card stacked vertically, few bars, horizontal bars, and at most three easy-to-tap filters, with detail on demand. Nearly all of this guidance comes from vendors, so treat the numbers as rules of thumb.

### Cited Findings
- **Tableau:** start with line, bar and area charts and highlight tables plus summary numbers, avoid dense scatter plots, and use three or fewer filters, single-select or sliders (2015). [Vendor] — [Tableau: Mobile dashboard design](https://www.tableau.com/blog/mobile-dashboard-design-less-more-small-screen-47854)
- **Infor (Birst):** put the most important element top-left, avoid distracting legends and redundant labels, stack KPIs first and then charts and tables, use low-cardinality filters, and avoid tables wider than 12 columns. [Vendor] — [Infor Birst: Guidelines for mobile design](https://docs.infor.com/birst/2025.x/en-us/birstolh/mobile_user/nsc1655271156432.html)
- **Esri (ArcGIS):** indicators are often the best phone visualizations, and phone views should have at most one map with one operational layer. [Vendor] — [ArcGIS Dashboards on smartphones](https://enterprise.arcgis.com/en/dashboards/latest/reference/dashboards-on-your-smartphone.htm)
- **Querio:** use 5–7 bars at most, horizontal bars, and fewer gridlines. [Vendor, low confidence] — [Querio](https://querio.ai/articles/how-to-design-dashboards-for-mobile-users)

### Inferences
- Esri's "one map per mobile view" translates to emet as one 3D scene per screen at most on a phone. The mountain and a content landscape should not both render at once on mobile.

### Gaps
- I found no academic study of mobile dashboard comprehension.

---

## Fit for emet

Context: emet already has a 3D topographic mountain where revenue = altitude. The users are non-expert university students, mostly on phones. The recommendations below are inferences from the cited findings above.

1. **Content landscape (3D allowed, overview only)**
   - **What it is:** posts appear as peaks, height = reach, colour lightness = engagement rate (Viridis-like, colour-blind safe), clustered by channel or by week along the ground plane.
   - **Why it works:** it reuses the mountain metaphor, so the section feels like one system. It is distinctive and memorable (Borkin 2013). Its job is "spot the outliers" overview, which is Munzner's justified case of shape perception with interaction.
   - **Rules:**
     - Tapping a peak opens a 2D card with the thumbnail and exact numbers (the GitHub hover pattern).
     - On phones, use camera presets or a stepper instead of free orbit (the NYT pattern).
     - Show a static or SVG fallback and adaptive quality (the GitHub pattern), and respect reduced-motion settings.
     - Never ask students to compare two peak heights by eye (Zacks; the JND study).
2. **Creative leaderboard (2D)**
   - **What it is:** a thumbnail grid ranked by a chosen metric (reach, saves, CTR), each tile showing 2–3 metrics, a sparkline and a "winner" badge.
   - **Why it works:** this is Motion's Tile View and badge pattern. Sparklines follow Tufte. It is the precise companion to the 3D landscape.
3. **Funnel (2D)**
   - **What it is:** horizontal stepped bars (impressions → visits → sign-ups → purchases) with the step-to-step conversion rate and the biggest drop highlighted.
   - **Why it works:** length is the second most accurate encoding (Cleveland & McGill), horizontal bars suit phones (Querio, Infor), and it is the standard pattern in Mixpanel and Amplitude.
   - **Rule:** no 3D cone or pyramid funnel.
4. **Goal pacing with bullet graphs (2D)**
   - **What it is:** one bullet graph per goal (followers, sales, budget), showing actual vs target vs expected pace to date, over muted qualitative bands.
   - **Rule:** use a reversed scale for "not to exceed" metrics such as CPA.
   - **Why it works:** it is Few's pattern and compact enough to stack on a phone.
5. **"What changed and why" timeline (2D)**
   - **What it is:** a line chart with campaign launches and posts as annotated markers, plus KPI cards above it (big number, change vs last period, sparkline, one-sentence explanation).
   - **Status encoding:** use arrows and icons plus blue/orange with different lightness, not red/green alone (Datawrapper).
   - **Why it works:** text annotations aid recall (Borkin 2015), and it is fast to read (NN/g).
6. **Experiment card (2D, optional)**
   - **What it is:** a confidence interval per variant against a zero line, with a plain-language verdict using Amplitude's three states. An optional "replay outcomes" HOP animation can teach students what uncertainty looks like (Hullman 2015; Kale 2019).

**Must stay 2D:** funnel, channel comparison (sorted horizontal bars), retention heatmap or curve, goal pacing, experiments, and any number a student has to act on. **May use 3D:** the existing revenue mountain and the content landscape, both as overview and navigation with 2D readouts. On phones, render at most one 3D scene per screen.
