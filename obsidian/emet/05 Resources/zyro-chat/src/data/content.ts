/**
 * All marketing copy and mock data lives here so it can be edited
 * without touching layout code. Metrics are illustrative placeholders
 * for demo purposes only.
 */
import {
  UserPlus,
  Plug,
  Zap,
  ShieldCheck,
} from 'lucide-react'

export const nav = {
  links: [
    { label: 'Product', href: '#product' },
    { label: 'AI Employees', href: '#employees' },
    { label: 'How it Works', href: '#how' },
    { label: 'Contact', href: '#contact' },
  ],
}

export const hero = {
  eyebrow: 'Now hiring: 12 AI specialists',
  headline: ['Hire an AI workforce', 'that runs your business'],
  sub: 'Zyro Chat gives you autonomous AI employees for support, content, ads, analytics and sales. They learn your brand, plug into your tools, and ship real work — around the clock.',
  primaryCta: 'Book a demo',
  secondaryCta: 'Meet the team',
  stats: [
    { value: 10000, suffix: '+', label: 'tasks automated daily' },
    { value: 40, suffix: '%', label: 'faster response times' },
    { value: 24, suffix: '/7', label: 'always-on coverage' },
    { value: 3, suffix: ' min', label: 'average time to hire' },
  ],
  disclaimer: 'Illustrative metrics for demo purposes.',
}

export const logos = ['Northwind', 'Lumora', 'Kestrel', 'Halcyon', 'Parcel&Co', 'Veridian', 'Orbitly', 'Fernhill']

/* ---------------- Product demo chat script ---------------- */
export type ChatMessage =
  | { from: 'user'; text: string }
  | { from: 'ai'; text: string; card?: 'report' }
  | { from: 'task'; text: string }

export const demoScript: ChatMessage[] = [
  { from: 'user', text: 'Hey Kai — how did last week’s spring campaign perform?' },
  {
    from: 'ai',
    text: 'Revenue from the campaign hit $48.2k, up 27% week-over-week. Meta drove most of it; TikTok CPA is creeping up.',
    card: 'report',
  },
  { from: 'user', text: 'Nice. Shift 20% of TikTok budget to Meta and brief Nova on new hooks.' },
  { from: 'ai', text: 'On it. Budget rebalanced and Nova has a brief with the top 3 performing angles. I’ll check results Friday.' },
  { from: 'task', text: 'Budget updated · Brief sent to Nova · Reminder set for Fri 9:00' },
]

export const demoSidebar = [
  { name: 'Kai', role: 'Data Analyst', status: 'Active', active: true },
  { name: 'Aria', role: 'Support', status: '12 tickets', active: false },
  { name: 'Nova', role: 'Social Media', status: 'Posting', active: false },
  { name: 'Milo', role: 'Copywriter', status: 'Drafting', active: false },
  { name: 'Sage', role: 'Sales', status: '3 calls', active: false },
]

/* ---------------- How it works ---------------- */
export const steps = [
  {
    icon: UserPlus,
    title: 'Hire your employee',
    body: 'Pick a specialist, give them a name and a goal. They absorb your docs, site and past tickets in minutes.',
  },
  {
    icon: Plug,
    title: 'Connect your tools',
    body: 'One-click integrations with 120+ apps — Shopify, HubSpot, Slack, Meta, GA4 — with scoped, revocable permissions.',
  },
  {
    icon: Zap,
    title: 'They get to work',
    body: 'Employees execute autonomously, collaborate with each other, and report progress in your Slack or inbox.',
  },
  {
    icon: ShieldCheck,
    title: 'You review & scale',
    body: 'Approve high-stakes actions, tune guardrails, and add headcount in a click as the results compound.',
  },
]

/* ---------------- Use cases ---------------- */
export const caseStudies = [
  {
    company: 'Lumora Skincare',
    segment: 'DTC e-commerce · 40 staff',
    employee: 'Aria',
    headline: 'Support backlog cleared in a weekend',
    before: { label: 'First response', value: '9h 40m' },
    after: { label: 'First response', value: '42s' },
    metrics: [
      { value: '82%', label: 'tickets auto-resolved' },
      { value: '+18', label: 'CSAT points' },
    ],
  },
  {
    company: 'Kestrel Outdoor',
    segment: 'Retail · 3 markets',
    employee: 'Nova + Kai',
    headline: 'Paid social that optimizes itself',
    before: { label: 'Blended ROAS', value: '1.9×' },
    after: { label: 'Blended ROAS', value: '3.2×' },
    metrics: [
      { value: '−31%', label: 'cost per acquisition' },
      { value: '140', label: 'creatives tested / mo' },
    ],
  },
  {
    company: 'Halcyon Labs',
    segment: 'B2B SaaS · Series A',
    employee: 'Sage',
    headline: 'Pipeline doubled without new hires',
    before: { label: 'Meetings / month', value: '38' },
    after: { label: 'Meetings / month', value: '81' },
    metrics: [
      { value: '2.1×', label: 'meetings booked' },
      { value: '< 2 min', label: 'lead response time' },
    ],
  },
]

/* ---------------- Testimonials ---------------- */
export const testimonials = [
  {
    quote:
      'We replaced three different tools and a night-shift contractor with Aria. Customers genuinely can’t tell — they just notice we’re faster.',
    name: 'Priya Raman',
    title: 'Head of CX, Lumora',
  },
  {
    quote:
      'Nova ships more creative in a week than our agency did in a quarter, and Kai tells us which ones actually made money. It’s a growth team in a tab.',
    name: 'Marcus Oyelaran',
    title: 'Founder, Kestrel Outdoor',
  },
  {
    quote:
      'The guardrails sold me. Everything risky waits for approval, everything routine just happens. Our team finally works on the interesting problems.',
    name: 'Elena Duarte',
    title: 'COO, Halcyon Labs',
  },
  {
    quote:
      'Onboarding took an afternoon. By Monday Milo had a content calendar, four drafts and a keyword map. I’ve never seen time-to-value like it.',
    name: 'James Whitfield',
    title: 'Marketing Lead, Orbitly',
  },
]

/* ---------------- Contact (replaces public pricing) ---------------- */
export const contact = {
  email: 'zyrochat@gmail.com',
  demoHref: `mailto:zyrochat@gmail.com?subject=${encodeURIComponent('Zyro Chat demo request')}&body=${encodeURIComponent('Hi Zyro team,\n\nWe would like to book a demo.\n\nCompany:\nTeam size:\nWhich AI employees we are interested in:\n')}`,
  pricingHref: `mailto:zyrochat@gmail.com?subject=${encodeURIComponent('Zyro Chat pricing & plans')}`,
  responseTime: 'We reply within one business day',
  includes: [
    { title: 'Tailored to your team', body: 'Plans are built around how many AI employees you need, your task volume and the tools you connect.' },
    { title: 'Guided onboarding', body: 'Our team configures your first employees, connects your stack and trains them on your brand, with you in the loop.' },
    { title: 'Enterprise-ready', body: 'SSO, audit logs, data residency options and a dedicated success manager for larger teams.' },
  ],
}

export const footer = {
  columns: [
    { title: 'Product', links: ['AI Employees', 'Integrations', 'Security', 'Changelog'] },
    { title: 'Company', links: ['About', 'Careers', 'Press', 'Contact'] },
    { title: 'Resources', links: ['Docs', 'Guides', 'Community', 'Status'] },
  ],
}
