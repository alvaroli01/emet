/**
 * The 12 Zyro AI employees: profile, demo "video" script and the
 * interactive tasks used in the agent workspace. All data is mock data.
 * To swap an avatar, replace the file in src/assets/agents/<id>.svg
 * (or change the import to a .png/.webp with the same id).
 */
import type { LucideIcon } from 'lucide-react'
import {
  Briefcase,
  CalendarCheck,
  Handshake,
  Headphones,
  LineChart,
  Mail,
  PenLine,
  Search,
  Share2,
  ShoppingBag,
  Sprout,
  UserSearch,
} from 'lucide-react'

const avatarFiles = import.meta.glob('../assets/agents/*.{svg,png,webp,jpg}', {
  eager: true,
  query: '?url',
  import: 'default',
}) as Record<string, string>

export const avatarOf = (id: string) =>
  Object.entries(avatarFiles).find(([path]) => path.includes(`/${id}.`))?.[1] ?? ''

/* ---------------- Deliverables (rendered in chat + demo videos) ---------------- */

export type Deliverable =
  | { kind: 'ticket'; customer: string; channel: string; message: string; reply: string; tags: string[] }
  | { kind: 'email'; to: string; subject: string; body: string[]; stat?: string }
  | { kind: 'table'; title: string; columns: string[]; rows: string[][] }
  | { kind: 'chart'; title: string; bars: { label: string; value: number }[]; unit?: string; delta?: string; note?: string; highlight?: string }
  | { kind: 'doc'; title: string; sections: { heading: string; points: string[] }[] }
  | { kind: 'calendar'; title: string; events: { day: string; time: string; title: string; tone?: 'brand' | 'ion' | 'success' }[] }
  | { kind: 'checklist'; title: string; items: { text: string; done?: boolean }[] }
  | { kind: 'post'; platform: string; handle: string; caption: string; hashtags: string; stats: string[] }

export type AgentTask = {
  label: string // chip text
  prompt: string // what the "user" sends
  keywords: string[] // for matching free-text input
  reply: string
  deliverable?: Deliverable
}

export type Agent = {
  id: string
  name: string
  role: string
  category: 'Marketing' | 'Sales & Growth' | 'Operations' | 'Support & People'
  icon: LucideIcon
  color: string // accent for this agent
  tagline: string
  about: string
  capabilities: string[]
  tools: string[]
  kpi: string
  demo: {
    trigger: { app: string; title: string; body: string }
    steps: string[]
    output: Deliverable
    result: string
  }
  tasks: AgentTask[]
  fallback: string[] // plan steps used when free text doesn't match a task
}

export const categories = ['All', 'Marketing', 'Sales & Growth', 'Operations', 'Support & People'] as const

export const agents: Agent[] = [
  /* ------------------------------------------------------------------ */
  {
    id: 'aria',
    name: 'Aria',
    role: 'Customer Support',
    category: 'Support & People',
    icon: Headphones,
    color: '#3346FF',
    tagline: 'Resolves tickets in seconds, in your brand voice.',
    about:
      'Aria answers customers across email, live chat and social 24/7. She looks up orders, processes returns within your policy and escalates anything sensitive to a human, with full context attached.',
    capabilities: ['Order lookups & tracking', 'Refunds and returns within policy', 'Multilingual replies (30+ languages)', 'Smart escalation to humans'],
    tools: ['Gorgias', 'Zendesk', 'Shopify', 'Instagram DMs'],
    kpi: '82% of tickets auto-resolved',
    demo: {
      trigger: { app: 'Gorgias', title: 'New ticket · Emma Collins', body: 'Hi! My order #4821 still hasn’t arrived and I need it for Saturday 😟' },
      steps: ['Looking up order #4821 in Shopify', 'Checking live carrier tracking (UPS)', 'Applying 10% goodwill code per policy', 'Writing a reply in your brand voice'],
      output: {
        kind: 'ticket',
        customer: 'Emma Collins',
        channel: 'Email',
        message: 'My order #4821 still hasn’t arrived and I need it for Saturday.',
        reply:
          'Hi Emma! Your order is with UPS and arrives Thursday by 7pm, so you’re all set for Saturday. Sorry for the wait, here’s 10% off your next order: THANKYOU10 💙',
        tags: ['Resolved', 'Shipping', 'Goodwill applied'],
      },
      result: 'Resolved in 38 seconds · CSAT 5/5',
    },
    tasks: [
      {
        label: 'Where is order #4821?',
        prompt: 'A customer is asking where order #4821 is.',
        keywords: ['order', 'where', 'tracking', 'shipping', 'delivery', 'package'],
        reply: 'Found it. #4821 is with UPS and arrives Thursday. I replied to the customer and added a goodwill code, since it shipped a day late.',
        deliverable: {
          kind: 'ticket',
          customer: 'Emma Collins',
          channel: 'Email',
          message: 'Where is my order #4821?',
          reply: 'Hi Emma! Great news: your order arrives Thursday by 7pm (UPS 1Z84…). Here’s 10% off your next order for the wait: THANKYOU10.',
          tags: ['Resolved', 'Shipping'],
        },
      },
      {
        label: 'Handle a refund request',
        prompt: 'Handle this refund request: the dress arrived in the wrong size.',
        keywords: ['refund', 'return', 'exchange', 'wrong', 'size', 'money back'],
        reply: 'It’s within the 30-day window, so I offered a free exchange first and a refund as the backup. I also created the prepaid return label.',
        deliverable: {
          kind: 'ticket',
          customer: 'Jordan Lee',
          channel: 'Live chat',
          message: 'The dress arrived in the wrong size, can I get a refund?',
          reply: 'So sorry about that, Jordan! I’ve emailed you a prepaid return label. Want me to ship the right size today (free), or refund you in full once it’s back?',
          tags: ['Exchange offered', 'Label created'],
        },
      },
      {
        label: 'Summarize this week’s tickets',
        prompt: 'Summarize this week’s support tickets.',
        keywords: ['summary', 'summarize', 'week', 'report', 'trends', 'tickets'],
        reply: 'I handled 1,284 tickets this week and escalated 62 to your team. Shipping questions went up 18% after the carrier delay on Tuesday.',
        deliverable: {
          kind: 'chart',
          title: 'Tickets by topic · this week',
          bars: [
            { label: 'Shipping', value: 482 },
            { label: 'Returns', value: 311 },
            { label: 'Sizing', value: 204 },
            { label: 'Payments', value: 97 },
            { label: 'Other', value: 190 },
          ],
          delta: '94% resolved automatically',
        },
      },
    ],
    fallback: ['Search past tickets and your help center', 'Draft a reply in your brand voice', 'Resolve it, or escalate to a human with a summary'],
  },
  /* ------------------------------------------------------------------ */
  {
    id: 'leo',
    name: 'Leo',
    role: 'Business Development',
    category: 'Sales & Growth',
    icon: Briefcase,
    color: '#1D26C4',
    tagline: 'Finds your next growth lever and builds the plan.',
    about:
      'Leo is your strategist. He researches markets, sizes opportunities, benchmarks competitors and turns it all into clear plans your team can execute. Think of him as a management consultant who works in minutes, not months.',
    capabilities: ['Market sizing & research', 'Competitor benchmarking', 'Partnership sourcing', 'Growth plans & board memos'],
    tools: ['Google Drive', 'Notion', 'Crunchbase', 'Statista'],
    kpi: '14 hrs of research saved / week',
    demo: {
      trigger: { app: 'Slack', title: '#leadership · Alex (CEO)', body: '@Leo should we expand into the UK next quarter? Need a view by Friday.' },
      steps: ['Pulling UK market data (ONS, Statista)', 'Benchmarking 14 competitors', 'Modelling unit economics in 3 scenarios', 'Writing the go-to-market memo'],
      output: {
        kind: 'doc',
        title: 'UK Expansion Memo',
        sections: [
          { heading: 'Recommendation', points: ['Launch in Q1 with a London-first test ($40k budget)'] },
          { heading: 'Why now', points: ['£2.1B addressable market, growing 9% YoY', 'Only 2 direct competitors ship next-day'] },
          { heading: 'Risks', points: ['VAT & returns logistics add ~6% cost'] },
        ],
      },
      result: 'Memo delivered in 6 minutes · 3 scenarios modelled',
    },
    tasks: [
      {
        label: 'Size the market for our product',
        prompt: 'How big is the market for our product?',
        keywords: ['market', 'size', 'tam', 'opportunity', 'how big'],
        reply: 'Here’s a top-down and bottom-up estimate. The realistic 3-year target (SOM) is about $38M. I’ve saved the sources and assumptions in the memo.',
        deliverable: {
          kind: 'chart',
          title: 'Market size (USD)',
          unit: 'M',
          bars: [
            { label: 'TAM', value: 4200 },
            { label: 'SAM', value: 610 },
            { label: 'SOM', value: 38 },
          ],
          note: 'TAM $4.2B · SAM $610M · SOM $38M',
        },
      },
      {
        label: 'Find partnership opportunities',
        prompt: 'Find partnership opportunities for us.',
        keywords: ['partner', 'partnership', 'collab', 'collaboration', 'alliance'],
        reply: 'I shortlisted 4 partners with overlapping audiences and no competing products, and drafted intro emails for the top 2.',
        deliverable: {
          kind: 'table',
          title: 'Top partnership targets',
          columns: ['Partner', 'Audience fit', 'Reach'],
          rows: [
            ['Northwind Travel', '92%', '1.2M'],
            ['Lumora Skincare', '88%', '640k'],
            ['Fernhill Studio', '81%', '310k'],
            ['Orbitly', '77%', '95k'],
          ],
        },
      },
      {
        label: 'Draft a Q4 growth plan',
        prompt: 'Draft a one-page growth plan for Q4.',
        keywords: ['plan', 'strategy', 'q4', 'quarter', 'growth', 'roadmap'],
        reply: 'Here’s a one-page Q4 plan with three bets, ranked by expected impact. Want me to turn it into tasks for the rest of the team?',
        deliverable: {
          kind: 'doc',
          title: 'Q4 Growth Plan',
          sections: [
            { heading: 'Goal', points: ['$1.2M revenue (+35% QoQ)'] },
            { heading: 'Bets', points: ['Holiday bundles with Kit (+$180k)', 'Win-back flow with Mara (+$90k)', 'UK soft launch (+$60k)'] },
            { heading: 'Owners', points: ['Nova: content · Sage: B2B · Kai: weekly tracking'] },
          ],
        },
      },
    ],
    fallback: ['Research the question with live market data', 'Benchmark it against your competitors', 'Deliver a one-page recommendation'],
  },
  /* ------------------------------------------------------------------ */
  {
    id: 'kit',
    name: 'Kit',
    role: 'E-commerce Manager',
    category: 'Sales & Growth',
    icon: ShoppingBag,
    color: '#18C5F2',
    tagline: 'Runs your store: listings, pricing, stock and promos.',
    about:
      'Kit manages your online store end to end. She writes and optimizes product listings, keeps an eye on inventory, sets prices within your margin rules and plans promotions that actually move stock.',
    capabilities: ['Product listings & SEO titles', 'Inventory alerts & reorders', 'Margin-safe pricing', 'Bundles and promotions'],
    tools: ['Shopify', 'WooCommerce', 'Amazon', 'Klaviyo'],
    kpi: '+22% conversion on optimized listings',
    demo: {
      trigger: { app: 'Shopify', title: 'New supplier file uploaded', body: 'fall-collection.csv · 24 SKUs · no descriptions or prices' },
      steps: ['Writing titles & descriptions for 24 SKUs', 'Pricing at a 62% target margin', 'Creating the “Fall ’26” collection', 'Flagging 3 SKUs with low stock'],
      output: {
        kind: 'table',
        title: 'Fall ’26 · published',
        columns: ['Product', 'Price', 'Stock'],
        rows: [
          ['Linen Wrap Dress', '$89', '140'],
          ['Merino Crew Knit', '$120', '86'],
          ['Wide-Leg Trouser', '$95', '12 ⚠'],
          ['Suede Ankle Boot', '$165', '54'],
        ],
      },
      result: '24 products live · 0 manual edits',
    },
    tasks: [
      {
        label: 'Which products are low on stock?',
        prompt: 'Which products are running low on stock?',
        keywords: ['stock', 'inventory', 'low', 'reorder', 'sold out'],
        reply: 'Three products will sell out within 10 days at the current rate. I drafted purchase orders. Want me to send them to the supplier?',
        deliverable: {
          kind: 'table',
          title: 'Low stock forecast',
          columns: ['Product', 'Left', 'Sells out'],
          rows: [
            ['Wide-Leg Trouser', '12', '4 days'],
            ['Silk Cami (Black)', '19', '7 days'],
            ['Linen Shirt (M)', '23', '9 days'],
          ],
        },
      },
      {
        label: 'Plan a Black Friday bundle',
        prompt: 'Plan a Black Friday bundle.',
        keywords: ['black friday', 'bundle', 'promo', 'promotion', 'sale', 'discount'],
        reply: 'I paired high-margin items with slower movers, so the bundle clears stock without cutting into margin. The projected margin stays at 54%.',
        deliverable: {
          kind: 'doc',
          title: 'Black Friday: “The Capsule Set”',
          sections: [
            { heading: 'Bundle', points: ['Wrap Dress + Crew Knit + Tote: $219 (save $56)'] },
            { heading: 'Why it works', points: ['Clears 300 slow-moving totes', 'Keeps a 54% blended margin'] },
            { heading: 'Launch', points: ['Nov 24, 06:00 · email by Mara · posts by Nova'] },
          ],
        },
      },
      {
        label: 'Rewrite my product description',
        prompt: 'Rewrite the product description for our linen wrap dress.',
        keywords: ['description', 'listing', 'product page', 'rewrite', 'title'],
        reply: 'Here’s a sharper, search-friendly version. I kept it scannable and added the keywords shoppers actually search for.',
        deliverable: {
          kind: 'doc',
          title: 'Linen Wrap Dress · listing',
          sections: [
            { heading: 'Title', points: ['Linen Wrap Midi Dress: Breathable, Adjustable Fit'] },
            { heading: 'Description', points: ['Made from 100% European linen that softens with every wash. The adjustable wrap flatters every shape, from beach days to dinner.'] },
            { heading: 'Highlights', points: ['Pockets ✓ · Machine washable · Sizes XS–XXL'] },
          ],
        },
      },
    ],
    fallback: ['Pull the data from your store', 'Draft the change and check it against your margin rules', 'Publish after your approval'],
  },
  /* ------------------------------------------------------------------ */
  {
    id: 'kai',
    name: 'Kai',
    role: 'Data Analyst',
    category: 'Operations',
    icon: LineChart,
    color: '#3346FF',
    tagline: 'Turns your data into answers, before you ask.',
    about:
      'Kai connects your analytics, payments and ad platforms into one view. He spots anomalies, explains why numbers moved and delivers reports in plain English. No SQL, no dashboards to babysit.',
    capabilities: ['Automated weekly reports', 'Anomaly detection & root cause', 'Forecasting', 'Cross-channel attribution'],
    tools: ['GA4', 'Stripe', 'Meta Ads', 'BigQuery'],
    kpi: '6 hrs/week of reporting saved',
    demo: {
      trigger: { app: 'Schedule', title: 'Monday 8:00 · Weekly report', body: 'Sources: GA4, Shopify, Stripe, Meta Ads, TikTok Ads' },
      steps: ['Syncing 5 data sources', 'Detected: Tuesday conversion −22%', 'Root cause: Safari checkout error', 'Posting report to #growth'],
      output: {
        kind: 'chart',
        title: 'Revenue · last 7 days',
        unit: 'k',
        bars: [
          { label: 'Mon', value: 38 },
          { label: 'Tue', value: 29 },
          { label: 'Wed', value: 41 },
          { label: 'Thu', value: 55 },
          { label: 'Fri', value: 62 },
          { label: 'Sat', value: 58 },
          { label: 'Sun', value: 78 },
        ],
        delta: '+27% WoW',
      },
      result: 'Report delivered · 1 issue flagged to engineering',
    },
    tasks: [
      {
        label: 'Why did revenue dip on Tuesday?',
        prompt: 'Why did revenue dip on Tuesday?',
        keywords: ['why', 'dip', 'drop', 'down', 'decline', 'revenue', 'fell'],
        reply: 'Conversion on Safari (iOS 18) dropped 61% from 2pm Tuesday. A checkout script error was blocking the pay button. Estimated impact: $8.4k. I’ve sent engineering a repro.',
        deliverable: {
          kind: 'chart',
          title: 'Conversion rate by browser · Tuesday',
          unit: '%',
          bars: [
            { label: 'Chrome', value: 3.4 },
            { label: 'Safari', value: 1.2 },
            { label: 'Firefox', value: 3.1 },
            { label: 'Edge', value: 3.3 },
          ],
          delta: 'Safari −61%',
          highlight: 'Safari',
        },
      },
      {
        label: 'Build my weekly KPI report',
        prompt: 'Build my weekly KPI report.',
        keywords: ['kpi', 'report', 'weekly', 'dashboard', 'metrics', 'numbers'],
        reply: 'Here are this week’s headline KPIs. It’s a strong week, led by paid social. I’ll send this to Slack every Monday at 8:00 from now on.',
        deliverable: {
          kind: 'table',
          title: 'Weekly KPIs',
          columns: ['Metric', 'This week', 'vs last'],
          rows: [
            ['Revenue', '$361k', '+27%'],
            ['Orders', '4,120', '+19%'],
            ['AOV', '$87.6', '+6%'],
            ['Blended ROAS', '3.2×', '+0.4'],
          ],
        },
      },
      {
        label: 'Forecast next month',
        prompt: 'Forecast next month’s sales.',
        keywords: ['forecast', 'predict', 'next month', 'projection', 'future'],
        reply: 'Based on seasonality, current pipeline and ad spend, I forecast $1.48M next month (±6%). The holiday weeks carry most of the growth.',
        deliverable: {
          kind: 'chart',
          title: 'Forecast by week',
          unit: 'k',
          bars: [
            { label: 'W1', value: 310 },
            { label: 'W2', value: 342 },
            { label: 'W3', value: 388 },
            { label: 'W4', value: 440 },
          ],
          delta: '$1.48M ±6%',
        },
      },
    ],
    fallback: ['Pull the relevant metrics from your connected sources', 'Look for anomalies and what drove them', 'Give you a short answer with a chart'],
  },
  /* ------------------------------------------------------------------ */
  {
    id: 'mara',
    name: 'Mara',
    role: 'Email Marketer',
    category: 'Marketing',
    icon: Mail,
    color: '#FC909F',
    tagline: 'Writes, segments and sends emails that get opened.',
    about:
      'Mara builds your email program: welcome flows, launches, win-backs and newsletters. She segments your list, A/B tests subject lines and reports on the revenue each email brings in.',
    capabilities: ['Automated flows & sequences', 'Audience segmentation', 'Subject-line A/B tests', 'Revenue attribution'],
    tools: ['Klaviyo', 'Mailchimp', 'HubSpot', 'Shopify'],
    kpi: '48% average open rate',
    demo: {
      trigger: { app: 'Klaviyo', title: 'Segment alert', body: '“Lapsed 90 days” reached 1,240 customers' },
      steps: ['Analysing past purchases of the segment', 'Writing a personalized win-back email', 'A/B testing 2 subject lines on 10%', 'Sending the winner to everyone else'],
      output: {
        kind: 'email',
        to: 'Lapsed 90d · 1,240 contacts',
        subject: 'We saved something for you, {first_name}',
        body: ['It’s been a while! Your favourites from last spring are back in new colours.', 'Here’s 15% off, just for you, valid for 72 hours.'],
        stat: '52% open · 7.8% click · $6.2k revenue',
      },
      result: '$6,240 recovered from lapsed customers',
    },
    tasks: [
      {
        label: 'Write a welcome email',
        prompt: 'Write a welcome email for new subscribers.',
        keywords: ['welcome', 'new subscriber', 'onboarding', 'sequence', 'first email'],
        reply: 'Here’s email 1 of a 3-part welcome flow. It leads with your story, not a discount, so it builds trust first. Emails 2 and 3 are queued for review.',
        deliverable: {
          kind: 'email',
          to: 'New subscribers',
          subject: 'Welcome to the studio ✨',
          body: ['Hi {first_name}, we’re so glad you’re here.', 'Every piece we make is designed in New York and made to last. Here’s the story behind our first collection…'],
          stat: 'Predicted open rate: 61%',
        },
      },
      {
        label: 'Win back inactive customers',
        prompt: 'Win back customers who haven’t bought in 90 days.',
        keywords: ['win back', 'inactive', 'lapsed', 'churn', 'haven’t bought', 're-engage'],
        reply: 'I found 1,240 lapsed customers and personalized the email with each person’s last category. It’s ready to send when you are.',
        deliverable: {
          kind: 'email',
          to: 'Lapsed 90d · 1,240 contacts',
          subject: 'Your favourites are back, {first_name}',
          body: ['We noticed you loved our linen pieces, and the new summer drop just landed.', 'Enjoy 15% off for the next 72 hours.'],
          stat: 'Projected revenue: $5.8k–$7.1k',
        },
      },
      {
        label: 'Pick the best subject line',
        prompt: 'Which subject line should we use for the launch?',
        keywords: ['subject', 'subject line', 'a/b', 'test', 'headline'],
        reply: 'I tested three subject lines on 10% of your list. The curiosity angle won by a clear margin, so I’ll send it to the other 90%.',
        deliverable: {
          kind: 'table',
          title: 'Subject line A/B test',
          columns: ['Subject', 'Open rate', 'Result'],
          rows: [
            ['“It’s finally here”', '38%', ''],
            ['“The fall edit: 20 new pieces”', '44%', ''],
            ['“You weren’t supposed to see this yet”', '57%', 'Winner'],
          ],
        },
      },
    ],
    fallback: ['Choose the right segment from your list', 'Write and design the email', 'A/B test it, then report on the revenue'],
  },
  /* ------------------------------------------------------------------ */
  {
    id: 'milo',
    name: 'Milo',
    role: 'Copywriter',
    category: 'Marketing',
    icon: PenLine,
    color: '#9287FF',
    tagline: 'Writes copy that sounds like you, only sharper.',
    about:
      'Milo learns your brand voice from your website and past campaigns, then writes everything from homepage copy and product pages to ad headlines and scripts, all consistent and on brand.',
    capabilities: ['Website & landing page copy', 'Ad headlines & scripts', 'Product descriptions', 'Brand voice guide'],
    tools: ['Google Docs', 'Webflow', 'Notion', 'Figma'],
    kpi: '3× faster campaign launches',
    demo: {
      trigger: { app: 'Notion', title: 'Brief from Nova', body: 'Fall launch: need a hero headline, sub-copy and 3 ad hooks. Tone: confident, warm.' },
      steps: ['Reading your brand voice guide', 'Studying the 3 top-performing past ads', 'Writing 12 headline options', 'Shortlisting the top 3 with reasoning'],
      output: {
        kind: 'doc',
        title: 'Fall Launch: Copy',
        sections: [
          { heading: 'Hero headline', points: ['Made for the in-between seasons.'] },
          { heading: 'Sub-copy', points: ['Layer-ready pieces in natural fabrics, designed in New York to be worn for years.'] },
          { heading: 'Ad hooks', points: ['“The only jacket you’ll need until December”', '“Linen, but make it fall”', '“Your 5-piece fall wardrobe”'] },
        ],
      },
      result: 'Copy approved first time · 0 revisions',
    },
    tasks: [
      {
        label: 'Write homepage hero copy',
        prompt: 'Write hero copy for our homepage.',
        keywords: ['homepage', 'hero', 'headline', 'website', 'landing page', 'tagline'],
        reply: 'Here are three directions, from most to least bold. I’d go with option A: it’s specific and it matches how your best reviews describe you.',
        deliverable: {
          kind: 'doc',
          title: 'Homepage hero · 3 options',
          sections: [
            { heading: 'A · Bold', points: ['Clothes that outlast the trend cycle.'] },
            { heading: 'B · Warm', points: ['Everyday pieces, made to be loved for years.'] },
            { heading: 'C · Direct', points: ['Premium basics. Fair prices. Free returns.'] },
          ],
        },
      },
      {
        label: 'Give me 5 ad headlines',
        prompt: 'Give me 5 ad headlines for the new collection.',
        keywords: ['ad', 'ads', 'headline', 'hook', 'hooks', 'creative'],
        reply: 'Five hooks, each using a different angle: benefit, curiosity, social proof, urgency and identity. I’ve sent them to Nova so she can build the ad variants.',
        deliverable: {
          kind: 'checklist',
          title: 'Ad headlines',
          items: [
            { text: 'Benefit: “Breathable linen that doesn’t wrinkle”' },
            { text: 'Curiosity: “Why 20,000 women switched to linen”' },
            { text: 'Social proof: “The dress with 3,000 five-star reviews”' },
            { text: 'Urgency: “Back in stock, but not for long”' },
            { text: 'Identity: “For people who buy less, but better”' },
          ],
        },
      },
      {
        label: 'Write a product story',
        prompt: 'Write a short story about how our brand started.',
        keywords: ['story', 'about us', 'brand', 'founder', 'mission'],
        reply: 'Here’s a short founder story for your About page. It runs about 90 words and is written to be read aloud in a video too.',
        deliverable: {
          kind: 'doc',
          title: 'Our story',
          sections: [
            {
              heading: 'About',
              points: [
                'It started with one linen shirt that outlived everything else in the closet. We couldn’t find another like it, so we made one. Today every piece is designed in New York, cut from natural fabrics and made to be worn for years, not seasons.',
              ],
            },
          ],
        },
      },
    ],
    fallback: ['Match your brand voice from past content', 'Write 3 distinct options', 'Recommend the strongest with a reason'],
  },
  /* ------------------------------------------------------------------ */
  {
    id: 'nico',
    name: 'Nico',
    role: 'SEO Specialist',
    category: 'Marketing',
    icon: Search,
    color: '#1D26C4',
    tagline: 'Gets you found on Google and grows traffic every week.',
    about:
      'Nico audits your site, finds the keywords your customers search for, writes optimized articles and fixes technical issues. He tracks rankings daily and reports on what’s working.',
    capabilities: ['Technical SEO audits', 'Keyword research', 'Optimized blog content', 'Rank tracking'],
    tools: ['Google Search Console', 'Ahrefs', 'WordPress', 'Shopify'],
    kpi: '3.4× organic traffic in 90 days',
    demo: {
      trigger: { app: 'Search Console', title: 'Weekly crawl complete', body: '212 pages crawled · 9 issues found' },
      steps: ['Fixing 6 missing meta descriptions', 'Compressing 14 oversized images', 'Adding internal links to 3 orphan pages', 'Publishing “Linen care guide” (1,800 words)'],
      output: {
        kind: 'chart',
        title: 'Organic clicks · last 6 weeks',
        unit: 'k',
        bars: [
          { label: 'W1', value: 4.1 },
          { label: 'W2', value: 4.6 },
          { label: 'W3', value: 5.8 },
          { label: 'W4', value: 7.2 },
          { label: 'W5', value: 9.4 },
          { label: 'W6', value: 12.1 },
        ],
        delta: '+195%',
      },
      result: 'Site health 71 → 96 · 3 new top-3 rankings',
    },
    tasks: [
      {
        label: 'Audit my website',
        prompt: 'Run an SEO audit on my website.',
        keywords: ['audit', 'seo', 'website', 'site', 'technical', 'health'],
        reply: 'Your site health score is 71/100. I can fix 6 of the 9 issues automatically. Here’s the list, ordered by impact.',
        deliverable: {
          kind: 'checklist',
          title: 'SEO audit · 9 issues',
          items: [
            { text: 'Missing meta descriptions on 6 pages (fix ready)', done: true },
            { text: '14 images over 500 KB (compressing)', done: true },
            { text: '3 orphan pages with no internal links', done: true },
            { text: 'Slow mobile LCP on /collections (3.8s)' },
            { text: 'Duplicate title tags on 2 product pages' },
          ],
        },
      },
      {
        label: 'Find keywords for “linen dresses”',
        prompt: 'Find keywords for linen dresses.',
        keywords: ['keyword', 'keywords', 'rank', 'search', 'google', 'traffic'],
        reply: 'These are the best opportunities: decent volume, low difficulty and clear buying intent. I’d target the first two with a collection page and a guide.',
        deliverable: {
          kind: 'table',
          title: 'Keyword opportunities',
          columns: ['Keyword', 'Volume', 'Difficulty'],
          rows: [
            ['linen midi dress', '18.1k', '22'],
            ['linen dress for summer', '9.9k', '18'],
            ['best linen dresses 2026', '4.4k', '26'],
            ['linen wrap dress', '3.6k', '14'],
          ],
        },
      },
      {
        label: 'Write a blog post brief',
        prompt: 'Write a brief for a blog post about caring for linen.',
        keywords: ['blog', 'article', 'brief', 'post', 'content'],
        reply: 'Here’s the brief. I’ll write the full 1,800-word draft once you approve it, and it goes live with schema markup and internal links included.',
        deliverable: {
          kind: 'doc',
          title: 'Brief: How to care for linen',
          sections: [
            { heading: 'Target keyword', points: ['how to wash linen (12k/mo, KD 19)'] },
            { heading: 'Outline', points: ['Washing · Drying · Ironing (or not) · Storing', 'FAQ block with 5 questions'] },
            { heading: 'Links', points: ['→ Linen Wrap Dress · → Care kit · → Fabric guide'] },
          ],
        },
      },
    ],
    fallback: ['Check how you rank for it today', 'Find the quickest wins', 'Fix or write what’s needed and track the results'],
  },
  /* ------------------------------------------------------------------ */
  {
    id: 'nova',
    name: 'Nova',
    role: 'Social Media Manager',
    category: 'Marketing',
    icon: Share2,
    color: '#6A7CFF',
    tagline: 'Plans, creates and posts your social content daily.',
    about:
      'Nova runs your social channels. She plans a content calendar, writes captions, adapts posts for every platform, replies to comments and reports on what grows your audience.',
    capabilities: ['Content calendars', 'Captions & hashtags', 'Trend spotting', 'Comment & DM replies'],
    tools: ['Instagram', 'TikTok', 'LinkedIn', 'Pinterest'],
    kpi: '+41% engagement in 60 days',
    demo: {
      trigger: { app: 'Calendar', title: 'Sunday planning', body: 'Next week: 0 of 14 posts scheduled' },
      steps: ['Scanning trends in #slowfashion', 'Drafting 14 posts across 4 platforms', 'Writing captions in your brand voice', 'Scheduling at peak engagement times'],
      output: {
        kind: 'post',
        platform: 'Instagram',
        handle: '@lumora.studio',
        caption: 'Linen season doesn’t end in August. Here’s how we’re layering it into fall 🍂',
        hashtags: '#slowfashion #linen #falloutfits',
        stats: ['2.4k likes', '186 comments', '312 saves'],
      },
      result: '14 posts scheduled · best time slots picked',
    },
    tasks: [
      {
        label: 'Plan next week’s content',
        prompt: 'Plan our social content for next week.',
        keywords: ['plan', 'calendar', 'content', 'schedule', 'week', 'posts'],
        reply: 'Here’s next week at a glance: a mix of product, behind-the-scenes and one trend-led Reel. Everything is scheduled for your audience’s peak hours.',
        deliverable: {
          kind: 'calendar',
          title: 'Content calendar · next week',
          events: [
            { day: 'Mon', time: '12:30', title: 'Reel · “3 ways to style linen”', tone: 'brand' },
            { day: 'Tue', time: '18:00', title: 'Carousel · Fall lookbook', tone: 'ion' },
            { day: 'Wed', time: '09:00', title: 'LinkedIn · Founder story', tone: 'brand' },
            { day: 'Thu', time: '19:00', title: 'TikTok · Trend: “outfit math”', tone: 'success' },
            { day: 'Fri', time: '11:00', title: 'Story · Weekend drop teaser', tone: 'ion' },
          ],
        },
      },
      {
        label: 'Write an Instagram caption',
        prompt: 'Write an Instagram caption for our new linen dress.',
        keywords: ['caption', 'instagram', 'post', 'reel', 'tiktok'],
        reply: 'Here’s the caption, with a hook in the first line so it shows before “more”. I’ve also prepared shorter versions for TikTok and Pinterest.',
        deliverable: {
          kind: 'post',
          platform: 'Instagram',
          handle: '@lumora.studio',
          caption: 'The dress you’ll reach for every single weekend. Breathable linen, a wrap that fits everyone, and yes, it has pockets.',
          hashtags: '#linendress #capsulewardrobe #newin',
          stats: ['Predicted reach 18–24k', 'Best time: Tue 18:00'],
        },
      },
      {
        label: 'What’s trending in my niche?',
        prompt: 'What is trending in my niche right now?',
        keywords: ['trend', 'trending', 'viral', 'niche', 'idea', 'ideas'],
        reply: 'Four trends that suit your brand this week, ranked by fit. I’d jump on #1 fast. It peaks in about 5 days.',
        deliverable: {
          kind: 'checklist',
          title: 'Trends this week',
          items: [
            { text: '“Outfit math”: 1 piece × 5 looks (↑ 340%)' },
            { text: 'Quiet luxury basics (↑ 120%)' },
            { text: 'Get-ready-with-me for fall weddings (↑ 95%)' },
            { text: 'Sustainable closet clean-outs (↑ 60%)' },
          ],
        },
      },
    ],
    fallback: ['Check what’s working on your channels and in your niche', 'Create platform-ready posts', 'Schedule them and report on the results'],
  },
  /* ------------------------------------------------------------------ */
  {
    id: 'sage',
    name: 'Sage',
    role: 'Sales Manager',
    category: 'Sales & Growth',
    icon: Handshake,
    color: '#1D26C4',
    tagline: 'Qualifies leads, follows up and books meetings.',
    about:
      'Sage keeps your pipeline full. He qualifies inbound leads within minutes, researches every prospect, writes personal follow-ups and books meetings straight onto your calendar, all logged in your CRM.',
    capabilities: ['Lead scoring & enrichment', 'Personalized outreach', 'Follow-up sequences', 'Call prep briefs'],
    tools: ['HubSpot', 'Salesforce', 'Gmail', 'Calendly'],
    kpi: '2.1× more meetings booked',
    demo: {
      trigger: { app: 'HubSpot', title: '42 new demo requests', body: 'Received overnight from the website form' },
      steps: ['Enriching 42 leads (company size, role)', 'Scoring against your ideal customer profile', 'Sending 18 personalized replies', 'Booking 11 meetings on your calendar'],
      output: {
        kind: 'table',
        title: 'Qualified leads',
        columns: ['Company', 'Score', 'Status'],
        rows: [
          ['Orbitly', '94', 'Booked · Thu 10:00'],
          ['Halcyon Labs', '91', 'Booked · Thu 14:30'],
          ['Veridian', '86', 'Replied'],
          ['Parcel&Co', '72', 'Nurture'],
        ],
      },
      result: '11 meetings booked before 9 am',
    },
    tasks: [
      {
        label: 'Qualify last night’s leads',
        prompt: 'Qualify the leads that came in last night.',
        keywords: ['lead', 'leads', 'qualify', 'score', 'prospects', 'inbound'],
        reply: '42 leads came in overnight. 18 match your ideal customer profile and I’ve already booked 11 of them. The rest are in a nurture sequence.',
        deliverable: {
          kind: 'table',
          title: 'Lead scoring',
          columns: ['Company', 'Size', 'Score'],
          rows: [
            ['Orbitly', '120', '94'],
            ['Halcyon Labs', '60', '91'],
            ['Veridian', '240', '86'],
            ['Kestrel', '35', '68'],
          ],
        },
      },
      {
        label: 'Write a follow-up email',
        prompt: 'Write a follow-up to Orbitly after yesterday’s demo.',
        keywords: ['follow', 'follow-up', 'email', 'demo', 'prospect', 'close'],
        reply: 'Here’s a short, specific follow-up that references what they cared about on the call. It’s scheduled to send at 9:10 their time.',
        deliverable: {
          kind: 'email',
          to: 'james@orbitly.io',
          subject: 'Your support backlog, solved by Monday',
          body: ['Hi James, great speaking yesterday. You mentioned 3,000 open tickets and a team of 4.', 'Aria could clear that in a weekend. Shall I set up a pilot with your Zendesk this week?'],
          stat: 'Sends Thu 9:10 (EST)',
        },
      },
      {
        label: 'Prep me for tomorrow’s call',
        prompt: 'Prep me for tomorrow’s call with Halcyon Labs.',
        keywords: ['prep', 'call', 'meeting', 'brief', 'prepare', 'tomorrow'],
        reply: 'Here’s your one-page brief: who you’re meeting, what they need and the likely objections, with answers.',
        deliverable: {
          kind: 'doc',
          title: 'Call brief · Halcyon Labs',
          sections: [
            { heading: 'Attendees', points: ['Elena Duarte (COO), decision maker', 'Sam Ortiz (Head of Ops)'] },
            { heading: 'Their pain', points: ['Pipeline flat for 2 quarters; SDR team of 2 is stretched'] },
            { heading: 'Likely objection', points: ['“Will it sound robotic?” → show Sage’s replies from Orbitly'] },
          ],
        },
      },
    ],
    fallback: ['Research the prospect and your CRM history', 'Draft the outreach or next step', 'Log everything in your CRM and follow up'],
  },
  /* ------------------------------------------------------------------ */
  {
    id: 'remy',
    name: 'Remy',
    role: 'Recruiter',
    category: 'Operations',
    icon: UserSearch,
    color: '#9287FF',
    tagline: 'Finds, screens and schedules your best candidates.',
    about:
      'Remy handles hiring from start to shortlist. She writes inclusive job posts, sources candidates, screens applications against your criteria and books interviews, so you only meet people worth meeting.',
    capabilities: ['Job descriptions', 'Candidate sourcing', 'Application screening', 'Interview scheduling'],
    tools: ['LinkedIn', 'Greenhouse', 'Gmail', 'Google Calendar'],
    kpi: 'Time-to-shortlist: 3 weeks → 2 days',
    demo: {
      trigger: { app: 'Greenhouse', title: 'Role: Senior Designer', body: '126 new applications this week' },
      steps: ['Screening 126 CVs against 6 criteria', 'Checking portfolios for relevant work', 'Shortlisting the top 8 candidates', 'Sending interview invites'],
      output: {
        kind: 'table',
        title: 'Shortlist · Senior Designer',
        columns: ['Candidate', 'Match', 'Next step'],
        rows: [
          ['Priya S.', '96%', 'Interview Tue'],
          ['Daniel M.', '93%', 'Interview Wed'],
          ['Ana R.', '90%', 'Invite sent'],
          ['Tom W.', '87%', 'Invite sent'],
        ],
      },
      result: '126 → 8 candidates in 14 minutes',
    },
    tasks: [
      {
        label: 'Write a job post',
        prompt: 'Write a job post for a senior product designer.',
        keywords: ['job', 'post', 'description', 'hire', 'hiring', 'role', 'jd'],
        reply: 'Here’s an inclusive, skimmable job post. I’d share it on LinkedIn and two design communities. Want me to post it?',
        deliverable: {
          kind: 'doc',
          title: 'Senior Product Designer',
          sections: [
            { heading: 'The role', points: ['Own the end-to-end design of our AI workspace, from first sketch to shipped pixels.'] },
            { heading: 'You have', points: ['5+ years in product design', 'A portfolio of shipped SaaS work'] },
            { heading: 'Perks', points: ['Remote-first · 4-day summer weeks · $4k learning budget'] },
          ],
        },
      },
      {
        label: 'Screen my applicants',
        prompt: 'Screen the applicants for the designer role.',
        keywords: ['screen', 'applicants', 'candidates', 'cv', 'resume', 'shortlist'],
        reply: 'I scored all 126 applicants on your 6 criteria. Here are the top 4, and every score includes a short rationale you can check.',
        deliverable: {
          kind: 'table',
          title: 'Top candidates',
          columns: ['Candidate', 'Match', 'Standout'],
          rows: [
            ['Priya S.', '96%', 'Led design at a Series B SaaS'],
            ['Daniel M.', '93%', 'Strong design systems work'],
            ['Ana R.', '90%', 'AI product experience'],
            ['Tom W.', '87%', 'Great motion portfolio'],
          ],
        },
      },
      {
        label: 'Schedule the interviews',
        prompt: 'Schedule interviews with the top candidates.',
        keywords: ['schedule', 'interview', 'interviews', 'book', 'calendar'],
        reply: 'Done. All four are booked around your calendar, with the panel invited and prep notes attached to each invite.',
        deliverable: {
          kind: 'calendar',
          title: 'Interviews · next week',
          events: [
            { day: 'Tue', time: '10:00', title: 'Priya S. · Portfolio review', tone: 'brand' },
            { day: 'Wed', time: '14:00', title: 'Daniel M. · Portfolio review', tone: 'brand' },
            { day: 'Thu', time: '11:30', title: 'Ana R. · Intro call', tone: 'ion' },
            { day: 'Fri', time: '15:00', title: 'Tom W. · Intro call', tone: 'ion' },
          ],
        },
      },
    ],
    fallback: ['Clarify the role and your must-haves', 'Source and screen candidates', 'Book interviews around your calendar'],
  },
  /* ------------------------------------------------------------------ */
  {
    id: 'sol',
    name: 'Sol',
    role: 'Personal Growth Coach',
    category: 'Support & People',
    icon: Sprout,
    color: '#18C5F2',
    tagline: 'Keeps you focused, balanced and growing.',
    about:
      'Sol is a coach for founders and their teams. He helps you set goals, protect deep-work time, reflect every week and build habits that stick, with gentle accountability built in.',
    capabilities: ['Goal setting (OKRs)', 'Weekly planning & reviews', 'Focus time protection', 'Learning plans'],
    tools: ['Google Calendar', 'Notion', 'Slack', 'Apple Health'],
    kpi: '+9 hrs of focus time / week',
    demo: {
      trigger: { app: 'Check-in', title: 'Sunday 6:00 pm · Weekly review', body: 'Last week: 3 of 5 goals hit · 31 meetings' },
      steps: ['Reviewing last week’s calendar & goals', 'Spotting 6 meetings that could be async', 'Blocking 3 deep-work sessions', 'Setting 3 focus goals for the week'],
      output: {
        kind: 'calendar',
        title: 'Your focus week',
        events: [
          { day: 'Mon', time: '08:00', title: 'Deep work · Investor deck', tone: 'brand' },
          { day: 'Tue', time: '07:00', title: 'Run + reflection', tone: 'success' },
          { day: 'Wed', time: '09:00', title: 'Deep work · Hiring plan', tone: 'brand' },
          { day: 'Fri', time: '16:00', title: 'Weekly review with Sol', tone: 'ion' },
        ],
      },
      result: '9 hours of focus time protected',
    },
    tasks: [
      {
        label: 'Plan my week around my goals',
        prompt: 'Plan my week around my goals.',
        keywords: ['plan', 'week', 'goals', 'schedule', 'focus'],
        reply: 'I blocked your mornings for the two goals that matter most and moved four low-value meetings to async updates. You still have 2 hours of buffer each day.',
        deliverable: {
          kind: 'calendar',
          title: 'Your week',
          events: [
            { day: 'Mon', time: '08:00', title: 'Deep work · Pitch deck', tone: 'brand' },
            { day: 'Tue', time: '08:00', title: 'Deep work · Product roadmap', tone: 'brand' },
            { day: 'Wed', time: '12:00', title: 'Lunch with mentor', tone: 'success' },
            { day: 'Thu', time: '08:00', title: 'Deep work · Pitch practice', tone: 'brand' },
            { day: 'Fri', time: '16:00', title: 'Weekly review', tone: 'ion' },
          ],
        },
      },
      {
        label: 'I’m overwhelmed. Help me prioritize',
        prompt: 'I’m overwhelmed, help me prioritize.',
        keywords: ['overwhelmed', 'prioritize', 'priorities', 'stress', 'too much', 'busy', 'help'],
        reply: 'Let’s make this lighter. I sorted your 23 open items by impact and urgency. Only three need you this week. Everything else I can delegate, defer or drop.',
        deliverable: {
          kind: 'checklist',
          title: 'This week, only these 3',
          items: [
            { text: 'Finish investor deck (due Fri)' },
            { text: 'Decide on the designer hire' },
            { text: 'Approve Q4 budget' },
            { text: '11 items delegated to your AI team', done: true },
            { text: '9 items deferred to next month', done: true },
          ],
        },
      },
      {
        label: 'Build a 30-day learning plan',
        prompt: 'Build me a 30-day plan to get better at public speaking.',
        keywords: ['learn', 'learning', 'skill', 'course', 'improve', 'better at', '30-day'],
        reply: 'Here’s a 30-day plan at 20 minutes a day. I’ll check in every Friday and adjust it based on how you’re doing.',
        deliverable: {
          kind: 'doc',
          title: '30 days to confident speaking',
          sections: [
            { heading: 'Week 1–2', points: ['Record a 2-min talk daily; review one habit per day'] },
            { heading: 'Week 3', points: ['Practise your pitch with Sol’s live feedback'] },
            { heading: 'Week 4', points: ['Present at your team all-hands; debrief with Sol'] },
          ],
        },
      },
    ],
    fallback: ['Understand what you want to achieve', 'Break it into small weekly steps', 'Check in and keep you accountable'],
  },
  /* ------------------------------------------------------------------ */
  {
    id: 'otto',
    name: 'Otto',
    role: 'Virtual Assistant',
    category: 'Operations',
    icon: CalendarCheck,
    color: '#1D26C4',
    tagline: 'Handles your inbox, calendar and busywork.',
    about:
      'Otto is the executive assistant everyone wishes they had. He triages your inbox, drafts replies, schedules meetings across time zones, books travel and summarizes every meeting with its action items.',
    capabilities: ['Inbox triage & drafts', 'Scheduling across time zones', 'Travel & bookings', 'Meeting notes & follow-ups'],
    tools: ['Gmail', 'Outlook', 'Google Calendar', 'Zoom'],
    kpi: '1.5 hrs saved every day',
    demo: {
      trigger: { app: 'Gmail', title: 'Inbox · 86 unread', body: 'Since yesterday 6 pm' },
      steps: ['Sorting 86 emails by priority', 'Drafting 12 replies for your approval', 'Unsubscribing from 9 newsletters', 'Scheduling 3 meetings people asked for'],
      output: {
        kind: 'checklist',
        title: 'Inbox zero report',
        items: [
          { text: '4 need your decision (pinned)', done: false },
          { text: '12 replies drafted, ready to send', done: true },
          { text: '3 meetings scheduled', done: true },
          { text: '58 archived · 9 unsubscribed', done: true },
        ],
      },
      result: '86 → 4 emails that need you',
    },
    tasks: [
      {
        label: 'Clear my inbox',
        prompt: 'Clear my inbox.',
        keywords: ['inbox', 'email', 'emails', 'unread', 'clear'],
        reply: 'Your inbox is down from 86 to 4. Those 4 need your judgement, so I pinned them. Everything else is replied to, scheduled or archived.',
        deliverable: {
          kind: 'checklist',
          title: 'Inbox summary',
          items: [
            { text: 'Term sheet from Northwind Ventures: needs you', done: false },
            { text: 'Contract renewal (Lumora): needs you', done: false },
            { text: '12 replies drafted', done: true },
            { text: '58 archived · 9 unsubscribed', done: true },
          ],
        },
      },
      {
        label: 'Book dinner for 4 on Friday',
        prompt: 'Book a dinner for 4 people on Friday at 8pm.',
        keywords: ['book', 'dinner', 'restaurant', 'reservation', 'table', 'travel', 'flight'],
        reply: 'Booked Osteria Luce at 8:00 pm on Friday for 4. I added it to your calendar and sent the invite to your guests.',
        deliverable: {
          kind: 'calendar',
          title: 'Friday',
          events: [
            { day: 'Fri', time: '17:30', title: 'Car to Greenwich Village (booked)', tone: 'ion' },
            { day: 'Fri', time: '20:00', title: 'Dinner · Osteria Luce · party of 4', tone: 'brand' },
          ],
        },
      },
      {
        label: 'Summarize my meetings',
        prompt: 'Summarize today’s meetings and action items.',
        keywords: ['summarize', 'summary', 'meeting', 'meetings', 'notes', 'action items'],
        reply: 'You had 5 meetings today. Here are the decisions and action items. I’ve already sent the follow-up emails.',
        deliverable: {
          kind: 'doc',
          title: 'Today’s meetings',
          sections: [
            { heading: 'Decisions', points: ['Launch fall collection Oct 3', 'Hire 1 senior designer'] },
            { heading: 'Your action items', points: ['Review deck v3 by Thu', 'Intro Sage to Halcyon COO'] },
            { heading: 'Sent', points: ['3 follow-up emails · 2 calendar invites'] },
          ],
        },
      },
    ],
    fallback: ['Take it off your plate', 'Handle the busywork across your tools', 'Only ping you when a decision is needed'],
  },
]

export const agentById = (id: string) => agents.find((a) => a.id === id)
