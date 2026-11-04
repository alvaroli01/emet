import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useRef, type ReactNode } from 'react'
import {
  channels,
  defaultBusinesses,
  findSlot,
  fmtDay,
  fmtTime,
  integrations,
  requestedDate,
  scenarios,
  seedBusiness,
  uid,
  verticals,
  withDefaultConnections,
  type Activity,
  type Booking,
  type Business,
  type Call,
  type Conversation,
  type Msg,
} from './data'

/* ------------------------------------------------------------------ */
/* State                                                               */
/* ------------------------------------------------------------------ */

export type Session = { role: 'customer' | 'owner'; businessId: string }
export type Toast = { id: string; title: string; body?: string; tone: 'brand' | 'success' | 'warn' }

type State = {
  businesses: Business[]
  conversations: Conversation[]
  bookings: Booking[]
  calls: Call[]
  activity: Activity[]
  typing: Record<string, boolean>
  toasts: Toast[]
  live: boolean
  session: Session | null
}

type Action =
  | { type: 'login'; session: Session }
  | { type: 'logout' }
  | { type: 'setBusinessView'; businessId: string }
  | { type: 'updateBusiness'; id: string; patch: Partial<Business> }
  | { type: 'addBusiness'; business: Business }
  | { type: 'addConversation'; conv: Conversation }
  | { type: 'appendMessage'; convId: string; msg: Msg; patch?: Partial<Conversation> }
  | { type: 'patchConversation'; convId: string; patch: Partial<Conversation> }
  | { type: 'typing'; convId: string; on: boolean }
  | { type: 'addBooking'; booking: Booking }
  | { type: 'patchBooking'; id: string; patch: Partial<Booking> }
  | { type: 'addCall'; call: Call }
  | { type: 'activity'; item: Activity }
  | { type: 'toast'; toast: Toast }
  | { type: 'dismissToast'; id: string }
  | { type: 'setLive'; live: boolean }

const STORAGE_KEY = 'zyro-portal-v1'

function load(): Pick<State, 'businesses' | 'session'> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as Pick<State, 'businesses' | 'session'>
      if (Array.isArray(parsed.businesses) && parsed.businesses.length) return { businesses: parsed.businesses.map(withDefaultConnections), session: parsed.session ?? null }
    }
  } catch {
    /* storage unavailable: fall back to defaults */
  }
  return { businesses: defaultBusinesses.map(withDefaultConnections), session: null }
}

function init(): State {
  const { businesses, session } = load()
  const seeded = businesses.map((b) => seedBusiness(b))
  return {
    businesses,
    conversations: seeded.flatMap((s) => s.conversations),
    bookings: seeded.flatMap((s) => s.bookings),
    calls: seeded.flatMap((s) => s.calls),
    activity: seeded.flatMap((s) => s.activity),
    typing: {},
    toasts: [],
    live: true,
    session,
  }
}

function reducer(s: State, a: Action): State {
  switch (a.type) {
    case 'login':
      return { ...s, session: a.session }
    case 'logout':
      return { ...s, session: null }
    case 'setBusinessView':
      return s.session ? { ...s, session: { ...s.session, businessId: a.businessId } } : s
    case 'updateBusiness':
      return { ...s, businesses: s.businesses.map((b) => (b.id === a.id ? { ...b, ...a.patch } : b)) }
    case 'addBusiness': {
      const seeded = seedBusiness(a.business, 3)
      return {
        ...s,
        businesses: [...s.businesses, a.business],
        bookings: [...s.bookings, ...seeded.bookings.slice(0, 6)],
        activity: [...s.activity, { id: uid('ac'), businessId: a.business.id, at: Date.now(), kind: 'connect', text: `${a.business.name} was onboarded to Zyro` }],
      }
    }
    case 'addConversation':
      return { ...s, conversations: [a.conv, ...s.conversations] }
    case 'appendMessage':
      return {
        ...s,
        conversations: s.conversations.map((c) => (c.id === a.convId ? { ...c, ...a.patch, messages: [...c.messages, a.msg], lastAt: a.msg.at } : c)),
      }
    case 'patchConversation':
      return { ...s, conversations: s.conversations.map((c) => (c.id === a.convId ? { ...c, ...a.patch } : c)) }
    case 'typing':
      return { ...s, typing: { ...s.typing, [a.convId]: a.on } }
    case 'addBooking':
      return { ...s, bookings: [...s.bookings, a.booking] }
    case 'patchBooking':
      return { ...s, bookings: s.bookings.map((b) => (b.id === a.id ? { ...b, ...a.patch } : b)) }
    case 'addCall':
      return { ...s, calls: [a.call, ...s.calls] }
    case 'activity':
      return { ...s, activity: [a.item, ...s.activity].slice(0, 200) }
    case 'toast':
      return { ...s, toasts: [...s.toasts.slice(-2), a.toast] }
    case 'dismissToast':
      return { ...s, toasts: s.toasts.filter((t) => t.id !== a.id) }
    case 'setLive':
      return { ...s, live: a.live }
  }
}

/* ------------------------------------------------------------------ */
/* Context                                                             */
/* ------------------------------------------------------------------ */

type Ctx = State & {
  dispatch: React.Dispatch<Action>
  simulateIncoming: (businessId: string) => void
  simulateCall: (businessId: string) => void
  toast: (t: Omit<Toast, 'id'>) => void
  sendOwnerMessage: (convId: string, text: string) => void
  toggleConnection: (businessId: string, integrationId: string) => void
  createBooking: (b: Omit<Booking, 'id' | 'createdAt'>) => { ok: boolean; booking?: Booking; suggestion?: { date: string; time: string } }
}

const PortalCtx = createContext<Ctx | null>(null)

export function usePortal() {
  const c = useContext(PortalCtx)
  if (!c) throw new Error('usePortal must be used inside <PortalProvider>')
  return c
}

export function useBusiness(id?: string) {
  const { businesses, session } = usePortal()
  return businesses.find((b) => b.id === (id ?? session?.businessId)) ?? businesses[0]
}

export function PortalProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, undefined, init)
  const ref = useRef(state)
  ref.current = state
  const scriptIdx = useRef<Record<string, number>>({})
  const timers = useRef<number[]>([])

  // Persist business settings, connections and the demo session
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ businesses: state.businesses, session: state.session }))
    } catch {
      /* ignore */
    }
  }, [state.businesses, state.session])

  useEffect(() => () => timers.current.forEach(clearTimeout), [])
  const later = (ms: number, fn: () => void) => timers.current.push(window.setTimeout(fn, ms))

  const toast = useCallback((t: Omit<Toast, 'id'>) => {
    const id = uid('t')
    dispatch({ type: 'toast', toast: { ...t, id } })
    later(5200, () => dispatch({ type: 'dismissToast', id }))
  }, [])

  /** A new message arrives on a connected channel; the AI answers (and books) on its own. */
  const simulateIncoming = useCallback(
    (businessId: string) => {
      const biz = ref.current.businesses.find((b) => b.id === businessId)
      if (!biz) return
      const connectedChannels = integrations.filter((i) => i.channel && biz.connections[i.id]?.connected).map((i) => i.channel)
      const list = scenarios[biz.vertical].filter((s) => connectedChannels.includes(s.channel))
      if (!list.length) {
        toast({ title: 'No channels connected', body: `Connect a channel for ${biz.name} to receive messages.`, tone: 'warn' })
        return
      }
      const i = (scriptIdx.current[businessId] = ((scriptIdx.current[businessId] ?? -1) + 1) % list.length)
      const sc = list[i]
      const first = ['Hannah', 'Leo', 'Camila', 'Jake', 'Priya', 'Tom', 'Valeria', 'Ben', 'Aisha', 'Marco'][Math.floor(Math.random() * 10)]
      const last = ['Reed', 'Morales', 'Chen', 'Wright', 'Rossi', 'Kaur', 'Evans', 'Diaz'][Math.floor(Math.random() * 8)]
      const contactName = `${first} ${last}`
      const now = Date.now()
      const conv: Conversation = {
        id: uid('cv'),
        businessId,
        channel: sc.channel,
        contact: { name: contactName, handle: sc.channel === 'instagram' || sc.channel === 'tiktok' ? `@${first.toLowerCase()}.${last.toLowerCase()}` : `+1 (646) 555-${Math.floor(1000 + Math.random() * 8999)}` },
        messages: [{ id: uid('m'), from: 'customer', text: sc.text, at: now }],
        status: 'ai',
        unread: true,
        autopilot: biz.autopilot,
        lastAt: now,
      }
      dispatch({ type: 'addConversation', conv })
      dispatch({ type: 'activity', item: { id: uid('ac'), businessId, at: now, kind: 'message', text: `New ${channels[sc.channel].label} message from ${contactName}` } })

      if (!biz.autopilot) {
        dispatch({ type: 'patchConversation', convId: conv.id, patch: { status: 'needs_you' } })
        toast({ title: `New message · ${channels[sc.channel].label}`, body: `${contactName}: “${sc.text.slice(0, 60)}”. Autopilot is off.`, tone: 'warn' })
        return
      }

      later(1300, () => dispatch({ type: 'typing', convId: conv.id, on: true }))
      later(3400, () => {
        const st = ref.current
        const c = st.conversations.find((x) => x.id === conv.id)
        dispatch({ type: 'typing', convId: conv.id, on: false })
        if (!c || !c.autopilot) return // owner took over in the meantime
        const v = verticals[biz.vertical]
        const at = Date.now()
        const firstName = contactName.split(' ')[0]

        if (sc.intent === 'question') {
          dispatch({ type: 'appendMessage', convId: conv.id, msg: { id: uid('m'), from: 'ai', text: sc.answer!, at }, patch: { status: 'resolved' } })
          dispatch({ type: 'activity', item: { id: uid('ac'), businessId, at, kind: 'message', text: `Answered ${contactName} on ${channels[sc.channel].label} in 3s` } })
          return
        }
        if (sc.intent === 'escalate') {
          dispatch({
            type: 'appendMessage',
            convId: conv.id,
            msg: { id: uid('m'), from: 'ai', text: `Thanks ${firstName}! This needs ${biz.contactName.split(' ')[0]} personally. I’ve shared all the details and you’ll hear back today.`, at },
            patch: { status: 'needs_you' },
          })
          dispatch({ type: 'activity', item: { id: uid('ac'), businessId, at, kind: 'escalation', text: `Escalated ${contactName}’s request to your team` } })
          toast({ title: 'Needs your attention', body: `${contactName} on ${channels[sc.channel].label}`, tone: 'warn' })
          return
        }
        // Booking: check the calendar, never double-book
        const reqDate = requestedDate(sc)
        const slot = findSlot(st.bookings, biz, reqDate, sc.time ?? '19:00')
        const booking: Booking = {
          id: uid('bk'),
          businessId,
          date: slot.date,
          time: slot.time,
          name: contactName,
          phone: conv.contact.handle.startsWith('+') ? conv.contact.handle : '+1 (646) 555-0127',
          service: sc.service ?? v.services[0],
          detail: sc.detail ?? '1',
          channel: sc.channel,
          status: 'Confirmed',
          source: 'AI',
          notes: slot.shifted ? `Asked for ${fmtDay(reqDate)} ${fmtTime(sc.time ?? '19:00')} (full)` : '',
          conflictAvoided: slot.shifted,
          createdAt: at,
        }
        dispatch({ type: 'addBooking', booking })
        const text = slot.shifted
          ? `So sorry ${firstName}, ${fmtDay(reqDate)} at ${fmtTime(sc.time ?? '19:00')} is fully booked. I’ve reserved the closest free slot for you instead: ${fmtDay(slot.date)} at ${fmtTime(slot.time)} ✅ Reply CHANGE if you’d like a different time.`
          : `You’re all set, ${firstName}! ✅ ${v.bookingNoun} confirmed for ${fmtDay(slot.date)} at ${fmtTime(slot.time)}. A confirmation is on its way and I’ll send a reminder the day before.`
        dispatch({ type: 'appendMessage', convId: conv.id, msg: { id: uid('m'), from: 'ai', text, at }, patch: { status: 'booked', bookingId: booking.id } })
        dispatch({
          type: 'activity',
          item: {
            id: uid('ac'),
            businessId,
            at,
            kind: slot.shifted ? 'conflict' : 'booking',
            text: slot.shifted
              ? `Double-booking prevented: moved ${contactName} to ${fmtDay(slot.date)} ${fmtTime(slot.time)}`
              : `Booked ${contactName} · ${fmtDay(slot.date)} ${fmtTime(slot.time)} → added to your sheet`,
          },
        })
        toast({
          title: slot.shifted ? 'Double-booking prevented' : `New ${v.bookingNoun.toLowerCase()} booked`,
          body: `${contactName} · ${fmtDay(slot.date)} ${fmtTime(slot.time)} · added to Bookings.xlsx`,
          tone: 'success',
        })
      })
    },
    [toast],
  )

  const simulateCall = useCallback(
    (businessId: string) => {
      const biz = ref.current.businesses.find((b) => b.id === businessId)
      if (!biz) return
      const v = verticals[biz.vertical]
      const d = new Date()
      d.setDate(d.getDate() + 1)
      const date = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
      const slot = findSlot(ref.current.bookings, biz, date, `${Math.min(v.close - 1, v.open + 6)}:00`)
      const name = ['Laura Bennett', 'Chris Ortega', 'Nadia Hassan', 'Peter Novak'][Math.floor(Math.random() * 4)]
      const at = Date.now()
      const booking: Booking = {
        id: uid('bk'), businessId, date: slot.date, time: slot.time, name, phone: '+1 (917) 555-0162', service: v.services[0], detail: biz.vertical === 'realestate' ? v.services[0] : '2',
        channel: 'phone', status: 'Confirmed', source: 'AI', notes: 'Booked by AI receptionist', conflictAvoided: slot.shifted, createdAt: at,
      }
      dispatch({ type: 'addBooking', booking })
      dispatch({
        type: 'addCall',
        call: {
          id: uid('call'), businessId, name, number: booking.phone, at, durationSec: 78, outcome: 'Booked',
          summary: `Booked a ${v.bookingNoun.toLowerCase()} for ${fmtDay(slot.date)} at ${fmtTime(slot.time)} and texted the confirmation.`,
          transcript: [
            { who: 'ai', text: `Thanks for calling ${biz.name}! How can I help today?` },
            { who: 'caller', text: `Hi, can I book something for tomorrow?` },
            { who: 'ai', text: `Absolutely. The first free slot tomorrow is ${fmtTime(slot.time)}. Shall I book it for you?` },
            { who: 'caller', text: 'Yes, perfect.' },
            { who: 'ai', text: 'Done! I’ve texted you the confirmation. See you then!' },
          ],
        },
      })
      dispatch({ type: 'activity', item: { id: uid('ac'), businessId, at, kind: 'call', text: `AI receptionist answered ${name} and booked ${fmtDay(slot.date)} ${fmtTime(slot.time)}` } })
      toast({ title: 'Call answered by AI', body: `${name} booked · ${fmtDay(slot.date)} ${fmtTime(slot.time)}`, tone: 'success' })
    },
    [toast],
  )

  // Live demo loop: new messages keep arriving while someone is logged in
  const tick = useRef(0)
  useEffect(() => {
    if (!state.live || !state.session) return
    const id = window.setInterval(() => {
      const s = ref.current
      if (!s.session) return
      tick.current++
      const target = s.session.role === 'customer' ? s.session.businessId : s.businesses[tick.current % s.businesses.length].id
      if (tick.current % 4 === 0) simulateCall(target)
      else simulateIncoming(target)
    }, 16000)
    return () => clearInterval(id)
  }, [state.live, state.session, simulateIncoming, simulateCall])

  const sendOwnerMessage = useCallback((convId: string, text: string) => {
    dispatch({ type: 'appendMessage', convId, msg: { id: uid('m'), from: 'owner', text, at: Date.now() }, patch: { autopilot: false, status: 'resolved', unread: false } })
  }, [])

  const toggleConnection = useCallback(
    (businessId: string, integrationId: string) => {
      const biz = ref.current.businesses.find((b) => b.id === businessId)
      const integ = integrations.find((i) => i.id === integrationId)
      if (!biz || !integ) return
      const current = biz.connections[integrationId]?.connected
      dispatch({
        type: 'updateBusiness',
        id: businessId,
        patch: {
          connections: {
            ...biz.connections,
            [integrationId]: current ? { connected: false } : { connected: true, account: integ.accountHint(biz), since: Date.now() },
          },
        },
      })
      dispatch({ type: 'activity', item: { id: uid('ac'), businessId, at: Date.now(), kind: 'connect', text: `${integ.name} ${current ? 'disconnected' : 'connected'}` } })
      toast({ title: `${integ.name} ${current ? 'disconnected' : 'connected'}`, body: current ? undefined : 'The AI will start answering here right away.', tone: current ? 'warn' : 'success' })
    },
    [toast],
  )

  const createBooking = useCallback((b: Omit<Booking, 'id' | 'createdAt'>) => {
    const biz = ref.current.businesses.find((x) => x.id === b.businessId)
    if (!biz) return { ok: false }
    const slot = findSlot(ref.current.bookings, biz, b.date, b.time)
    if (slot.shifted) return { ok: false, suggestion: { date: slot.date, time: slot.time } }
    const booking: Booking = { ...b, id: uid('bk'), createdAt: Date.now() }
    dispatch({ type: 'addBooking', booking })
    dispatch({ type: 'activity', item: { id: uid('ac'), businessId: b.businessId, at: Date.now(), kind: 'booking', text: `${b.name} added manually · ${fmtDay(b.date)} ${fmtTime(b.time)}` } })
    return { ok: true, booking }
  }, [])

  const value = useMemo<Ctx>(
    () => ({ ...state, dispatch, simulateIncoming, simulateCall, toast, sendOwnerMessage, toggleConnection, createBooking }),
    [state, simulateIncoming, simulateCall, toast, sendOwnerMessage, toggleConnection, createBooking],
  )
  return <PortalCtx.Provider value={value}>{children}</PortalCtx.Provider>
}
