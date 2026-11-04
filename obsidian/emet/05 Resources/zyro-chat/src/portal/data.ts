/**
 * Mock data for the Zyro dashboards (customer + owner panel).
 * Everything here is sample data. Nothing connects to real accounts.
 */
import type { LucideIcon } from 'lucide-react'
import {
  AtSign,
  Calendar,
  FileSignature,
  Globe,
  Home,
  Instagram,
  Facebook,
  Mail,
  Megaphone,
  MessageCircle,
  MessageSquareText,
  Music2,
  Phone,
  Search,
  ShoppingBag,
  Sheet,
  Store,
  Table2,
  UtensilsCrossed,
} from 'lucide-react'

/* ------------------------------------------------------------------ */
/* Channels (where messages come from)                                 */
/* ------------------------------------------------------------------ */

export type Channel =
  | 'instagram'
  | 'facebook'
  | 'whatsapp'
  | 'tiktok'
  | 'google'
  | 'email'
  | 'webchat'
  | 'sms'
  | 'metalead'
  | 'googlelead'

export const channels: Record<Channel, { label: string; color: string; icon: LucideIcon }> = {
  instagram: { label: 'Instagram', color: '#E1306C', icon: Instagram },
  facebook: { label: 'Messenger', color: '#1877F2', icon: Facebook },
  whatsapp: { label: 'WhatsApp', color: '#22C55E', icon: MessageCircle },
  tiktok: { label: 'TikTok', color: '#111626', icon: Music2 },
  google: { label: 'Google Business', color: '#EA4335', icon: Search },
  email: { label: 'Email', color: '#6A7CFF', icon: Mail },
  webchat: { label: 'Website chat', color: '#3346FF', icon: Globe },
  sms: { label: 'SMS', color: '#0EA5E9', icon: MessageSquareText },
  metalead: { label: 'Meta lead ad', color: '#0866FF', icon: Megaphone },
  googlelead: { label: 'Google Ads lead', color: '#F59E0B', icon: AtSign },
}

/* ------------------------------------------------------------------ */
/* Verticals                                                           */
/* ------------------------------------------------------------------ */

export type Vertical = 'restaurant' | 'realestate' | 'notary' | 'fashion'

export const verticals: Record<
  Vertical,
  {
    label: string
    icon: LucideIcon
    bookingNoun: string // "Reservation", "Viewing"…
    detailLabel: string // column header for the booking detail
    durationMin: number
    capacity: number // simultaneous bookings allowed in the same time window
    open: number // opening hour
    close: number // last start hour
    services: string[]
    agent: string // default AI employee id
  }
> = {
  restaurant: {
    label: 'Restaurant',
    icon: UtensilsCrossed,
    bookingNoun: 'Reservation',
    detailLabel: 'Guests',
    durationMin: 90,
    capacity: 3,
    open: 12,
    close: 22,
    services: ['Dinner', 'Lunch', 'Birthday dinner', 'Private room'],
    agent: 'aria',
  },
  realestate: {
    label: 'Real estate',
    icon: Home,
    bookingNoun: 'Viewing',
    detailLabel: 'Property',
    durationMin: 45,
    capacity: 1,
    open: 9,
    close: 18,
    services: ['2BR · 118 Kent Ave', 'Studio · 45 Bedford Ave', '3BR townhouse · Park Slope', 'Valuation visit'],
    agent: 'sage',
  },
  notary: {
    label: 'Notary',
    icon: FileSignature,
    bookingNoun: 'Appointment',
    detailLabel: 'Signers',
    durationMin: 30,
    capacity: 1,
    open: 9,
    close: 17,
    services: ['Power of attorney', 'Real estate closing', 'Apostille', 'Affidavit', 'Loan signing'],
    agent: 'otto',
  },
  fashion: {
    label: 'Fashion store',
    icon: Store,
    bookingNoun: 'Appointment',
    detailLabel: 'Guests',
    durationMin: 60,
    capacity: 2,
    open: 10,
    close: 19,
    services: ['Personal styling', 'Bridal fitting', 'Alterations', 'Order pickup'],
    agent: 'kit',
  },
}

/* ------------------------------------------------------------------ */
/* Integrations catalog                                                */
/* ------------------------------------------------------------------ */

export type IntegrationCategory = 'Messaging & social' | 'Ads & lead forms' | 'Calls' | 'Bookings & sheets' | 'Commerce & industry'

export type Integration = {
  id: string
  name: string
  category: IntegrationCategory
  icon: LucideIcon
  color: string
  description: string
  channel?: Channel
  accountHint: (b: { name: string; slug: string }) => string
  only?: Vertical[]
}

export const integrations: Integration[] = [
  { id: 'instagram', name: 'Instagram', category: 'Messaging & social', icon: Instagram, color: '#E1306C', channel: 'instagram', description: 'DMs, story replies and comments', accountHint: (b) => `@${b.slug}` },
  { id: 'facebook', name: 'Facebook Messenger', category: 'Messaging & social', icon: Facebook, color: '#1877F2', channel: 'facebook', description: 'Page messages and comments', accountHint: (b) => `${b.name} (Page)` },
  { id: 'whatsapp', name: 'WhatsApp Business', category: 'Messaging & social', icon: MessageCircle, color: '#22C55E', channel: 'whatsapp', description: 'Chats on your business number', accountHint: () => '+1 (212) 555-0148' },
  { id: 'tiktok', name: 'TikTok', category: 'Messaging & social', icon: Music2, color: '#111626', channel: 'tiktok', description: 'DMs and comment replies', accountHint: (b) => `@${b.slug}` },
  { id: 'google', name: 'Google Business Profile', category: 'Messaging & social', icon: Search, color: '#EA4335', channel: 'google', description: 'Maps messages, Q&A and reviews', accountHint: (b) => `${b.name} · Google Maps` },
  { id: 'email', name: 'Gmail / Outlook', category: 'Messaging & social', icon: Mail, color: '#6A7CFF', channel: 'email', description: 'Your shared inbox', accountHint: (b) => `hello@${b.slug}.com` },
  { id: 'webchat', name: 'Website chat', category: 'Messaging & social', icon: Globe, color: '#3346FF', channel: 'webchat', description: 'Zyro chat widget on your site', accountHint: (b) => `${b.slug}.com` },
  { id: 'metaads', name: 'Meta Ads lead forms', category: 'Ads & lead forms', icon: Megaphone, color: '#0866FF', channel: 'metalead', description: 'Instant replies to every lead in seconds', accountHint: (b) => `${b.name} · Ad account` },
  { id: 'googleads', name: 'Google Ads lead forms', category: 'Ads & lead forms', icon: AtSign, color: '#F59E0B', channel: 'googlelead', description: 'Lead-form extensions & Local Services leads', accountHint: () => 'Ads account 482-119-2045' },
  { id: 'phone', name: 'AI phone receptionist', category: 'Calls', icon: Phone, color: '#0EA5E9', channel: 'sms', description: 'Answers every call, books, texts a confirmation', accountHint: () => '+1 (212) 555-0199 (forwarded)' },
  { id: 'excel', name: 'Microsoft Excel', category: 'Bookings & sheets', icon: Table2, color: '#107C41', description: 'Every booking written to your spreadsheet', accountHint: () => 'OneDrive · Bookings.xlsx' },
  { id: 'sheets', name: 'Google Sheets', category: 'Bookings & sheets', icon: Sheet, color: '#0F9D58', description: 'Live sync to a Google Sheet', accountHint: () => 'Drive · Bookings (live)' },
  { id: 'gcal', name: 'Google Calendar', category: 'Bookings & sheets', icon: Calendar, color: '#4285F4', description: 'Blocks time and prevents double-booking', accountHint: (b) => `bookings@${b.slug}.com` },
  { id: 'shopify', name: 'Shopify', category: 'Commerce & industry', icon: ShoppingBag, color: '#5E8E3E', description: 'Orders, products & customers for support', accountHint: (b) => `${b.slug}.myshopify.com`, only: ['fashion', 'restaurant'] },
  { id: 'opentable', name: 'OpenTable', category: 'Commerce & industry', icon: UtensilsCrossed, color: '#DA3743', description: 'Table inventory & reservations', accountHint: (b) => `${b.name} · Restaurant ID 20931`, only: ['restaurant'] },
  { id: 'zillow', name: 'Zillow Premier Agent', category: 'Commerce & industry', icon: Home, color: '#006AFF', description: 'Buyer & renter inquiries', accountHint: (b) => `${b.name} · Agent profile`, only: ['realestate'] },
  { id: 'docusign', name: 'DocuSign', category: 'Commerce & industry', icon: FileSignature, color: '#FFB400', description: 'Send documents before appointments', accountHint: (b) => `${b.slug}@docusign`, only: ['notary', 'realestate'] },
]

/* ------------------------------------------------------------------ */
/* Core types                                                          */
/* ------------------------------------------------------------------ */

export type Connection = { connected: boolean; account?: string; since?: number }

export type Business = {
  id: string
  name: string
  slug: string
  vertical: Vertical
  city: string
  address: string
  phone: string
  hours: string
  contactName: string
  loginEmail: string
  plan: string
  autopilot: boolean
  tone: string
  connections: Record<string, Connection>
  createdAt: number
}

export type Msg = { id: string; from: 'customer' | 'ai' | 'owner' | 'system'; text: string; at: number }

export type ConvStatus = 'ai' | 'needs_you' | 'booked' | 'resolved'

export type Conversation = {
  id: string
  businessId: string
  channel: Channel
  contact: { name: string; handle: string }
  messages: Msg[]
  status: ConvStatus
  unread: boolean
  autopilot: boolean
  bookingId?: string
  lastAt: number
}

export type Booking = {
  id: string
  businessId: string
  date: string // YYYY-MM-DD
  time: string // HH:MM
  name: string
  phone: string
  service: string
  detail: string
  channel: Channel | 'phone' | 'walk-in'
  status: 'Confirmed' | 'Pending' | 'Cancelled'
  source: 'AI' | 'Team'
  notes: string
  conflictAvoided?: boolean
  createdAt: number
}

export type Call = {
  id: string
  businessId: string
  name: string
  number: string
  at: number
  durationSec: number
  outcome: 'Booked' | 'Answered' | 'Escalated' | 'Voicemail'
  summary: string
  transcript: { who: 'caller' | 'ai'; text: string }[]
}

export type Activity = { id: string; businessId: string; at: number; kind: 'message' | 'booking' | 'call' | 'conflict' | 'escalation' | 'connect'; text: string }

/* ------------------------------------------------------------------ */
/* Time helpers                                                        */
/* ------------------------------------------------------------------ */

export const pad = (n: number) => String(n).padStart(2, '0')
export const dayKey = (offset = 0, from = new Date()) => {
  const d = new Date(from)
  d.setHours(12, 0, 0, 0)
  d.setDate(d.getDate() + offset)
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}
export const toMin = (t: string) => {
  const [h, m] = t.split(':').map(Number)
  return h * 60 + m
}
export const fromMin = (m: number) => `${pad(Math.floor(m / 60))}:${pad(m % 60)}`
export const fmtDay = (key: string) => {
  const d = new Date(`${key}T12:00:00`)
  const today = dayKey(0)
  if (key === today) return 'Today'
  if (key === dayKey(1)) return 'Tomorrow'
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
}
export const fmtTime = (t: string) => {
  const [h, m] = t.split(':').map(Number)
  const suffix = h >= 12 ? 'pm' : 'am'
  const hh = h % 12 === 0 ? 12 : h % 12
  return m === 0 ? `${hh}${suffix}` : `${hh}:${pad(m)}${suffix}`
}
export const ago = (at: number, now = Date.now()) => {
  const s = Math.max(0, Math.round((now - at) / 1000))
  if (s < 45) return 'just now'
  if (s < 3600) return `${Math.round(s / 60)}m`
  if (s < 86400) return `${Math.round(s / 3600)}h`
  return `${Math.round(s / 86400)}d`
}

/* ------------------------------------------------------------------ */
/* Conflict-free scheduling                                            */
/* ------------------------------------------------------------------ */

/** Returns true if a booking at date/time would exceed capacity (overlap-aware). */
export function isTaken(bookings: Booking[], b: Business, date: string, time: string) {
  const v = verticals[b.vertical]
  const start = toMin(time)
  const end = start + v.durationMin
  const overlapping = bookings.filter(
    (x) => x.businessId === b.id && x.date === date && x.status !== 'Cancelled' && toMin(x.time) < end && toMin(x.time) + v.durationMin > start,
  )
  return overlapping.length >= v.capacity
}

/** Finds the requested slot, or the nearest free one (same day first, then next days). */
export function findSlot(bookings: Booking[], b: Business, date: string, time: string) {
  const v = verticals[b.vertical]
  if (!isTaken(bookings, b, date, time)) return { date, time, shifted: false }
  const step = 30
  for (let dayOff = 0; dayOff < 7; dayOff++) {
    const d = dayOff === 0 ? date : dayKey(dayOff, new Date(`${date}T12:00:00`))
    const base = dayOff === 0 ? toMin(time) + step : v.open * 60
    for (let m = base; m <= v.close * 60; m += step) {
      if (!isTaken(bookings, b, d, fromMin(m))) return { date: d, time: fromMin(m), shifted: true }
    }
    if (dayOff === 0) {
      // also try earlier the same day
      for (let m = toMin(time) - step; m >= v.open * 60; m -= step) {
        if (!isTaken(bookings, b, d, fromMin(m))) return { date: d, time: fromMin(m), shifted: true }
      }
    }
  }
  return { date, time, shifted: false }
}

/* ------------------------------------------------------------------ */
/* Seed data                                                           */
/* ------------------------------------------------------------------ */

let seq = 0
export const uid = (p: string) => `${p}_${Date.now().toString(36)}${(seq++).toString(36)}`

const firstNames = ['Sarah', 'Michael', 'Emma', 'David', 'Olivia', 'James', 'Sofia', 'Daniel', 'Ava', 'Lucas', 'Mia', 'Noah', 'Chloe', 'Ethan', 'Isabella', 'Liam', 'Grace', 'Mateo', 'Zoe', 'Ryan']
const lastNames = ['Johnson', 'Chen', 'Garcia', 'Miller', 'Patel', 'Rossi', 'Kim', 'Brown', 'Lopez', 'Nguyen', 'Walker', 'Silva', 'Martin', 'Cohen', 'Davis']
const rnd = (seed: number) => () => {
  seed = (seed * 16807) % 2147483647
  return (seed - 1) / 2147483646
}
const phoneFrom = (r: () => number) => `+1 (${[212, 347, 646, 718, 305, 310][Math.floor(r() * 6)]}) 555-${pad(Math.floor(r() * 90) + 10)}${pad(Math.floor(r() * 90) + 10)}`

export const defaultBusinesses: Business[] = [
  {
    id: 'osteria',
    name: 'Osteria Luce',
    slug: 'osterialuce',
    vertical: 'restaurant',
    city: 'New York, NY',
    address: '214 Mulberry St, New York, NY',
    phone: '+1 (212) 555-0148',
    hours: 'Tue–Sun · 12:00–23:00',
    contactName: 'Marco Bellini',
    loginEmail: 'marco@osterialuce.com',
    plan: 'Growth',
    autopilot: true,
    tone: 'Warm and welcoming, a little Italian flair',
    connections: {},
    createdAt: Date.now() - 86400000 * 64,
  },
  {
    id: 'hudson',
    name: 'Hudson & Park Realty',
    slug: 'hudsonpark',
    vertical: 'realestate',
    city: 'Brooklyn, NY',
    address: '88 N 6th St, Brooklyn, NY',
    phone: '+1 (718) 555-0133',
    hours: 'Mon–Sat · 09:00–19:00',
    contactName: 'Rachel Park',
    loginEmail: 'rachel@hudsonpark.com',
    plan: 'Scale',
    autopilot: true,
    tone: 'Professional, fast and helpful',
    connections: {},
    createdAt: Date.now() - 86400000 * 41,
  },
  {
    id: 'mercer',
    name: 'Mercer Notary Services',
    slug: 'mercernotary',
    vertical: 'notary',
    city: 'Miami, FL',
    address: '1200 Brickell Ave, Suite 410, Miami, FL',
    phone: '+1 (305) 555-0172',
    hours: 'Mon–Fri · 09:00–17:30',
    contactName: 'Daniel Mercer',
    loginEmail: 'daniel@mercernotary.com',
    plan: 'Starter',
    autopilot: true,
    tone: 'Precise, reassuring and bilingual (EN/ES)',
    connections: {},
    createdAt: Date.now() - 86400000 * 19,
  },
  {
    id: 'lumora',
    name: 'Lumora Boutique',
    slug: 'lumoraboutique',
    vertical: 'fashion',
    city: 'Los Angeles, CA',
    address: '8420 Melrose Ave, Los Angeles, CA',
    phone: '+1 (310) 555-0190',
    hours: 'Mon–Sun · 10:00–20:00',
    contactName: 'Sofia Alvarez',
    loginEmail: 'sofia@lumoraboutique.com',
    plan: 'Growth',
    autopilot: true,
    tone: 'Friendly, stylish, uses emojis sparingly',
    connections: {},
    createdAt: Date.now() - 86400000 * 88,
  },
]

// Which integrations each demo business starts with
const startConnected: Record<string, string[]> = {
  osteria: ['instagram', 'facebook', 'whatsapp', 'google', 'email', 'phone', 'metaads', 'excel', 'gcal', 'opentable'],
  hudson: ['instagram', 'facebook', 'whatsapp', 'google', 'email', 'webchat', 'phone', 'metaads', 'googleads', 'sheets', 'gcal', 'zillow'],
  mercer: ['facebook', 'whatsapp', 'google', 'email', 'phone', 'googleads', 'excel', 'gcal'],
  lumora: ['instagram', 'tiktok', 'facebook', 'whatsapp', 'google', 'email', 'webchat', 'phone', 'metaads', 'excel', 'shopify', 'gcal'],
}

export function withDefaultConnections(b: Business): Business {
  if (Object.keys(b.connections).length) return b
  const ids = startConnected[b.id] ?? []
  const connections: Record<string, Connection> = {}
  for (const i of integrations) {
    connections[i.id] = ids.includes(i.id)
      ? { connected: true, account: i.accountHint(b), since: b.createdAt + 3600000 }
      : { connected: false }
  }
  return { ...b, connections }
}

/* Conversation scripts per vertical: what customers say and how the AI replies */
export type Scenario = {
  channel: Channel
  text: string
  intent: 'booking' | 'question' | 'escalate'
  service?: string
  detail?: string
  dayOffset?: number
  weekday?: number // 0 = Sunday … 6 = Saturday; overrides dayOffset
  time?: string
  answer?: string
}

/** Date key for a scenario's requested day (next occurrence of a weekday, or an offset). */
export function requestedDate(sc: { dayOffset?: number; weekday?: number }) {
  const d = new Date()
  if (sc.weekday !== undefined) {
    const diff = (sc.weekday - d.getDay() + 7) % 7 || 7
    return dayKey(diff)
  }
  return dayKey(sc.dayOffset ?? 1)
}

export const scenarios: Record<Vertical, Scenario[]> = {
  restaurant: [
    { channel: 'instagram', text: 'Hi! Do you have a table for 4 this Friday around 8pm? 🍝', intent: 'booking', service: 'Dinner', detail: '4', weekday: 5, time: '20:00' },
    { channel: 'whatsapp', text: 'Are you open on Monday for lunch?', intent: 'question', answer: 'We’re closed on Mondays, but we’re open Tuesday to Sunday from 12:00 to 23:00. Would you like me to book a table for Tuesday lunch?' },
    { channel: 'google', text: 'Can I book a birthday dinner for 8 people Saturday at 7:30?', intent: 'booking', service: 'Birthday dinner', detail: '8', weekday: 6, time: '19:30' },
    { channel: 'facebook', text: 'Do you have gluten-free pasta?', intent: 'question', answer: 'Yes! We make fresh gluten-free tagliatelle and gnocchi every day, prepared separately to avoid cross-contact. Just let your server know when you arrive. 🌾' },
    { channel: 'metalead', text: 'Lead form: “Private dining for 20 · company dinner · next month”', intent: 'escalate' },
    { channel: 'whatsapp', text: 'Table for 2 tomorrow at 8pm please', intent: 'booking', service: 'Dinner', detail: '2', dayOffset: 1, time: '20:00' },
    { channel: 'instagram', text: 'Is there parking nearby?', intent: 'question', answer: 'There’s a public garage 2 minutes away at 180 Mulberry St (about $18 for the evening). We can also call you a car after dinner!' },
    { channel: 'email', text: 'Hello, could we reserve for 6 on Sunday at 1pm? One high chair needed.', intent: 'booking', service: 'Lunch', detail: '6', weekday: 0, time: '13:00' },
  ],
  realestate: [
    { channel: 'metalead', text: 'Lead form: “Interested in the 2BR on Kent Ave. Can I see it this week?”', intent: 'booking', service: '2BR · 118 Kent Ave', detail: '2BR · 118 Kent Ave', dayOffset: 1, time: '17:00' },
    { channel: 'instagram', text: 'Is the studio on Bedford still available? What’s the rent?', intent: 'question', answer: 'Yes, it’s still available! It’s $2,850/month with heat and hot water included, available from the 1st. Want me to book you a viewing? I have slots tomorrow and Thursday.' },
    { channel: 'googlelead', text: 'Google lead: “Looking to sell my 3BR in Park Slope, need a valuation”', intent: 'booking', service: 'Valuation visit', detail: 'Valuation · Park Slope', dayOffset: 2, time: '11:00' },
    { channel: 'whatsapp', text: 'Can I view the Park Slope townhouse Saturday at 10?', intent: 'booking', service: '3BR townhouse · Park Slope', detail: '3BR townhouse · Park Slope', weekday: 6, time: '10:00' },
    { channel: 'webchat', text: 'Do you accept guarantors for rentals?', intent: 'question', answer: 'We do. We accept personal guarantors earning 80× the monthly rent, as well as institutional guarantors like TheGuarantors and Insurent. Want the application link?' },
    { channel: 'email', text: 'I want to discuss commission terms for listing 3 properties.', intent: 'escalate' },
    { channel: 'facebook', text: 'Viewing for the Kent Ave 2BR tomorrow at 5pm possible?', intent: 'booking', service: '2BR · 118 Kent Ave', detail: '2BR · 118 Kent Ave', dayOffset: 1, time: '17:00' },
  ],
  notary: [
    { channel: 'google', text: 'Do you do apostilles? How long does it take?', intent: 'question', answer: 'Yes! We handle Florida apostilles end to end. Standard processing is 5–7 business days, or 48 hours with express service. I can book you a drop-off appointment.' },
    { channel: 'whatsapp', text: 'Necesito un poder notarial, ¿tienen cita mañana a las 10?', intent: 'booking', service: 'Power of attorney', detail: '1', dayOffset: 1, time: '10:00' },
    { channel: 'googlelead', text: 'Google lead: “Loan signing for refinance, 2 signers, this week”', intent: 'booking', service: 'Loan signing', detail: '2', dayOffset: 2, time: '14:00' },
    { channel: 'email', text: 'Can a notary come to a hospital for a signing?', intent: 'escalate' },
    { channel: 'facebook', text: 'Appointment for an affidavit tomorrow at 10am?', intent: 'booking', service: 'Affidavit', detail: '1', dayOffset: 1, time: '10:00' },
    { channel: 'webchat', text: 'What ID do I need to bring?', intent: 'question', answer: 'Please bring a valid, unexpired government photo ID: a driver’s license, passport or state ID. Every signer needs their own ID. Don’t sign the document beforehand!' },
  ],
  fashion: [
    { channel: 'instagram', text: 'Hiii is the linen wrap dress back in size S? 😍', intent: 'question', answer: 'It is! 🎉 The Linen Wrap Dress is back in S in Sand and Black. Want me to hold one for you in store, or send you the link to order online?' },
    { channel: 'tiktok', text: 'Can I book a personal styling session this Saturday at 2?', intent: 'booking', service: 'Personal styling', detail: '1', weekday: 6, time: '14:00' },
    { channel: 'whatsapp', text: 'My order #1043 hasn’t arrived yet', intent: 'question', answer: 'So sorry for the wait! Order #1043 is out for delivery today with UPS and should arrive by 7pm. Here’s your tracking link. Let me know if anything goes wrong 💛' },
    { channel: 'email', text: 'Bridal fitting for me + 2 bridesmaids on Sunday at 11?', intent: 'booking', service: 'Bridal fitting', detail: '3', weekday: 0, time: '11:00' },
    { channel: 'facebook', text: 'I want to return a dress but lost my receipt', intent: 'escalate' },
    { channel: 'instagram', text: 'Styling session Saturday 2pm for me and my sister?', intent: 'booking', service: 'Personal styling', detail: '2', weekday: 6, time: '14:00' },
  ],
}

/** Builds the initial conversations, bookings and calls for a business. */
export function seedBusiness(b: Business, seedNum = 7) {
  const r = rnd(seedNum + b.id.length * 13)
  const v = verticals[b.vertical]
  const now = Date.now()
  const bookings: Booking[] = []
  const name = () => `${firstNames[Math.floor(r() * firstNames.length)]} ${lastNames[Math.floor(r() * lastNames.length)]}`
  const chans: Booking['channel'][] = ['instagram', 'whatsapp', 'google', 'phone', 'facebook', 'email', 'metalead', 'walk-in']

  // ~3 weeks of bookings (a few days back, two weeks ahead), capacity-safe
  for (let d = -3; d <= 13; d++) {
    const perDay = 3 + Math.floor(r() * (v.capacity > 1 ? 6 : 4))
    for (let k = 0; k < perDay; k++) {
      const m = v.open * 60 + Math.floor(r() * ((v.close - v.open) * 2)) * 30
      const date = dayKey(d)
      const time = fromMin(m)
      if (isTaken(bookings, b, date, time)) continue
      const svc = b.vertical === 'restaurant' ? (m < 16 * 60 ? 'Lunch' : ['Dinner', 'Dinner', 'Birthday dinner', 'Private room'][Math.floor(r() * 4)]) : v.services[Math.floor(r() * v.services.length)]
      bookings.push({
        id: uid('bk'),
        businessId: b.id,
        date,
        time,
        name: name(),
        phone: phoneFrom(r),
        service: svc,
        detail: b.vertical === 'realestate' ? svc : String(b.vertical === 'restaurant' ? 2 + Math.floor(r() * 5) : 1 + Math.floor(r() * 2)),
        channel: chans[Math.floor(r() * chans.length)],
        status: d < 0 ? 'Confirmed' : r() > 0.88 ? 'Pending' : 'Confirmed',
        source: r() > 0.2 ? 'AI' : 'Team',
        notes: r() > 0.7 ? ['Window seat', 'Allergic to nuts', 'Bring ID', 'First-time client', 'Wants parking info'][Math.floor(r() * 5)] : '',
        createdAt: now - Math.floor(r() * 86400000 * 5),
      })
    }
  }

  // A few past requests the AI moved to a free slot instead of double-booking
  bookings
    .filter((x) => x.source === 'AI' && x.date >= dayKey(0))
    .filter((_, i) => i % 9 === 4)
    .slice(0, 3)
    .forEach((x) => {
      x.conflictAvoided = true
      x.notes = 'Requested time was full, moved to nearest free slot'
    })

  // Past conversations (already handled)
  const convs: Conversation[] = []
  const script = scenarios[b.vertical]
  script.forEach((s, i) => {
    const at = now - (i + 1) * 1000 * 60 * (35 + Math.floor(r() * 80))
    const contact = name()
    const msgs: Msg[] = [{ id: uid('m'), from: 'customer', text: s.text, at }]
    let status: ConvStatus = 'resolved'
    let bookingId: string | undefined
    if (s.intent === 'question') {
      msgs.push({ id: uid('m'), from: 'ai', text: s.answer!, at: at + 14000 })
      msgs.push({ id: uid('m'), from: 'customer', text: ['Perfect, thank you!', 'Great 🙏', 'Amazing, thanks!', 'Got it, thanks'][i % 4], at: at + 90000 })
    } else if (s.intent === 'escalate') {
      msgs.push({ id: uid('m'), from: 'ai', text: `Thanks for reaching out! This one needs ${b.contactName.split(' ')[0]} personally. I’ve passed it on with all the details and they’ll reply today.`, at: at + 12000 })
      status = 'needs_you'
    } else {
      const bk = bookings.find((x) => x.date >= dayKey(0) && x.source === 'AI' && !convs.some((c) => c.bookingId === x.id))
      if (bk) {
        bk.name = contact
        bk.channel = s.channel
        bookingId = bk.id
        msgs.push({ id: uid('m'), from: 'ai', text: `You’re booked, ${contact.split(' ')[0]}! ✅ ${v.bookingNoun} on ${fmtDay(bk.date)} at ${fmtTime(bk.time)}. I’ve sent a confirmation and a reminder will go out the day before.`, at: at + 16000 })
        status = 'booked'
      }
    }
    convs.push({
      id: uid('cv'),
      businessId: b.id,
      channel: s.channel,
      contact: { name: contact, handle: s.channel === 'instagram' || s.channel === 'tiktok' ? `@${contact.split(' ')[0].toLowerCase()}.${Math.floor(r() * 90 + 10)}` : phoneFrom(r) },
      messages: msgs,
      status,
      unread: status === 'needs_you',
      autopilot: status !== 'needs_you',
      bookingId,
      lastAt: msgs[msgs.length - 1].at,
    })
  })

  // Calls answered by the AI receptionist
  const calls: Call[] = [
    {
      id: uid('call'),
      businessId: b.id,
      name: name(),
      number: phoneFrom(r),
      at: now - 1000 * 60 * 22,
      durationSec: 94,
      outcome: 'Booked',
      summary: `Booked a ${v.bookingNoun.toLowerCase()} for tomorrow and texted the confirmation.`,
      transcript: [
        { who: 'ai', text: `Thanks for calling ${b.name}, this is Zyro, the virtual assistant. How can I help?` },
        { who: 'caller', text: `Hi, I'd like to book for tomorrow if you have space.` },
        { who: 'ai', text: `Of course! I have 6pm or 7:30pm available tomorrow. Which works better?` },
        { who: 'caller', text: '7:30 please.' },
        { who: 'ai', text: 'Done! You’ll get a text confirmation in a moment. Anything else?' },
      ],
    },
    {
      id: uid('call'),
      businessId: b.id,
      name: name(),
      number: phoneFrom(r),
      at: now - 1000 * 60 * 75,
      durationSec: 51,
      outcome: 'Answered',
      summary: 'Asked about opening hours and location. Answered and sent a Google Maps link by SMS.',
      transcript: [
        { who: 'caller', text: 'What time do you close today?' },
        { who: 'ai', text: `Today we’re open until ${v.close}:00. I can text you the address with a map link, would that help?` },
        { who: 'caller', text: 'Yes please.' },
      ],
    },
    {
      id: uid('call'),
      businessId: b.id,
      name: name(),
      number: phoneFrom(r),
      at: now - 1000 * 60 * 180,
      durationSec: 132,
      outcome: 'Escalated',
      summary: `Complex request. Transferred a full summary to ${b.contactName} and promised a call back before 5pm.`,
      transcript: [
        { who: 'caller', text: 'I have a special request and I’d like to talk to the owner.' },
        { who: 'ai', text: `Of course. I’ll pass this to ${b.contactName.split(' ')[0]} with the details so you won’t have to repeat yourself. What’s the best number to reach you?` },
      ],
    },
    {
      id: uid('call'),
      businessId: b.id,
      name: name(),
      number: phoneFrom(r),
      at: now - 1000 * 60 * 60 * 20,
      durationSec: 12,
      outcome: 'Voicemail',
      summary: 'Caller hung up before speaking. Sent an automatic follow-up text.',
      transcript: [],
    },
  ]

  const activity: Activity[] = [
    ...convs.slice(0, 5).map((c) => ({
      id: uid('ac'),
      businessId: b.id,
      at: c.lastAt,
      kind: (c.status === 'booked' ? 'booking' : c.status === 'needs_you' ? 'escalation' : 'message') as Activity['kind'],
      text:
        c.status === 'booked'
          ? `Booked ${c.contact.name} from ${channels[c.channel].label}`
          : c.status === 'needs_you'
            ? `Escalated ${c.contact.name}’s request to your team`
            : `Answered ${c.contact.name} on ${channels[c.channel].label}`,
    })),
    { id: uid('ac'), businessId: b.id, at: calls[0].at, kind: 'call', text: `AI receptionist booked ${calls[0].name} by phone` },
  ]

  return { bookings, conversations: convs, calls, activity }
}

/** Extra clients shown in the owner panel (summary rows only). */
export const extraClients = [
  { name: 'Casa Verde Taquería', vertical: 'restaurant' as Vertical, city: 'Austin, TX', plan: 'Starter', channels: 6, msgs: 64, bookings: 21, health: 'Healthy' },
  { name: 'Summit Homes Group', vertical: 'realestate' as Vertical, city: 'Denver, CO', plan: 'Growth', channels: 9, msgs: 118, bookings: 14, health: 'Healthy' },
  { name: 'Atelier Noir', vertical: 'fashion' as Vertical, city: 'Miami, FL', plan: 'Growth', channels: 8, msgs: 97, bookings: 9, health: 'Reconnect TikTok' },
  { name: 'Coastal Notary & Apostille', vertical: 'notary' as Vertical, city: 'San Diego, CA', plan: 'Starter', channels: 5, msgs: 31, bookings: 12, health: 'Healthy' },
]
