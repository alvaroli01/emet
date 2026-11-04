import { useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { ArrowLeft, Bot, CalendarCheck, CheckCheck, Hand, Inbox as InboxIcon, Search, Send, Sparkles, UserRound } from 'lucide-react'
import { usePortal } from '../store'
import { ago, channels, fmtDay, fmtTime, verticals, type Channel } from '../data'
import { ChannelBadge, StatusPill } from '../ui'
import { AgentAvatar } from '../../components/ui/AgentAvatar'
import { cn } from '../../lib/cn'

type Filter = 'all' | 'needs_you' | 'booked' | 'ai'

/** Unified inbox. Pass one business id (customer) or many (owner panel). */
export function InboxView({ businessIds, showBusiness = false }: { businessIds: string[]; showBusiness?: boolean }) {
  const { conversations, businesses, bookings, typing, dispatch, sendOwnerMessage } = usePortal()
  const [filter, setFilter] = useState<Filter>('all')
  const [chan, setChan] = useState<Channel | 'all'>('all')
  const [q, setQ] = useState('')
  const [selected, setSelected] = useState<string | null>(null)
  const [draft, setDraft] = useState('')
  const [, force] = useState(0)
  const scroller = useRef<HTMLDivElement>(null)

  // refresh relative timestamps
  useEffect(() => {
    const id = window.setInterval(() => force((x) => x + 1), 20000)
    return () => clearInterval(id)
  }, [])

  const mine = useMemo(() => conversations.filter((c) => businessIds.includes(c.businessId)).sort((a, b) => b.lastAt - a.lastAt), [conversations, businessIds])
  const list = mine.filter(
    (c) =>
      (filter === 'all' || c.status === filter || (filter === 'ai' && c.status === 'resolved')) &&
      (chan === 'all' || c.channel === chan) &&
      (!q || `${c.contact.name} ${c.messages.map((m) => m.text).join(' ')}`.toLowerCase().includes(q.toLowerCase())),
  )
  const usedChannels = Array.from(new Set(mine.map((c) => c.channel)))
  const conv = mine.find((c) => c.id === selected) ?? null
  const counts = {
    all: mine.length,
    needs_you: mine.filter((c) => c.status === 'needs_you').length,
    booked: mine.filter((c) => c.status === 'booked').length,
    ai: mine.filter((c) => c.status === 'ai' || c.status === 'resolved').length,
  }

  // Desktop: auto-select the newest conversation
  useEffect(() => {
    if (!selected && list[0] && window.matchMedia('(min-width: 1024px)').matches) setSelected(list[0].id)
  }, [list, selected])

  useEffect(() => {
    if (conv?.unread) dispatch({ type: 'patchConversation', convId: conv.id, patch: { unread: false } })
  }, [conv, dispatch])

  useEffect(() => {
    const el = scroller.current
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' })
  }, [conv?.messages.length, conv && typing[conv.id]])

  const biz = (id: string) => businesses.find((b) => b.id === id)

  const reply = () => {
    if (!conv || !draft.trim()) return
    sendOwnerMessage(conv.id, draft.trim())
    setDraft('')
  }

  const ListPane = (
    <div className={cn('flex min-h-0 flex-col border-ink-200/70 lg:border-r', conv && 'hidden lg:flex')}>
      <div className="space-y-3 border-b border-ink-200/70 p-3">
        <div className="flex h-10 items-center gap-2 rounded-xl border border-ink-200 bg-ink-0 px-3 focus-within:border-brand-400">
          <Search className="h-4 w-4 text-ink-400" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search messages" className="min-w-0 flex-1 bg-transparent text-body-sm outline-none" />
        </div>
        <div className="no-scrollbar flex gap-1 overflow-x-auto">
          {(
            [
              ['all', 'All'],
              ['needs_you', 'Needs you'],
              ['booked', 'Booked'],
              ['ai', 'AI handled'],
            ] as const
          ).map(([k, l]) => (
            <button
              key={k}
              onClick={() => setFilter(k)}
              className={cn(
                'shrink-0 rounded-lg px-2.5 py-1.5 text-caption font-medium transition-colors',
                filter === k ? 'bg-ink-900 text-white' : 'text-ink-600 hover:bg-ink-100',
              )}
            >
              {l} <span className="opacity-60">{counts[k]}</span>
            </button>
          ))}
        </div>
        <div className="no-scrollbar flex gap-1.5 overflow-x-auto">
          <button onClick={() => setChan('all')} className={cn('shrink-0 rounded-full border px-2.5 py-1 text-[0.68rem] font-medium', chan === 'all' ? 'border-brand-300 bg-brand-50 text-brand-700' : 'border-ink-200 text-ink-500')}>
            All channels
          </button>
          {usedChannels.map((c) => (
            <button
              key={c}
              onClick={() => setChan(c)}
              className={cn('flex shrink-0 items-center gap-1 rounded-full border py-0.5 pl-0.5 pr-2 text-[0.68rem] font-medium', chan === c ? 'border-brand-300 bg-brand-50 text-brand-700' : 'border-ink-200 text-ink-500')}
            >
              <ChannelBadge channel={c} size="sm" /> {channels[c].label}
            </button>
          ))}
        </div>
      </div>
      <ul className="no-scrollbar min-h-0 flex-1 overflow-y-auto">
        <AnimatePresence initial={false}>
          {list.map((c) => {
            const last = c.messages[c.messages.length - 1]
            return (
              <motion.li key={c.id} layout initial={{ opacity: 0, backgroundColor: 'rgb(226 231 255)' }} animate={{ opacity: 1, backgroundColor: 'rgba(0,0,0,0)' }} transition={{ duration: 0.8 }}>
                <button
                  onClick={() => setSelected(c.id)}
                  className={cn('flex w-full gap-3 border-b border-ink-100 px-3 py-3 text-left transition-colors hover:bg-ink-50', selected === c.id && 'bg-brand-50/60 hover:bg-brand-50/60')}
                >
                  <div className="relative">
                    <span className="grid h-10 w-10 place-items-center rounded-full bg-ink-100 text-body-sm font-semibold text-ink-600">
                      {c.contact.name.split(' ').map((p) => p[0]).join('')}
                    </span>
                    <span className="absolute -bottom-0.5 -right-0.5 rounded-full ring-2 ring-ink-0">
                      <ChannelBadge channel={c.channel} size="sm" />
                    </span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className={cn('truncate text-body-sm', c.unread ? 'font-semibold text-ink-900' : 'font-medium text-ink-800')}>{c.contact.name}</span>
                      <span className="ml-auto shrink-0 text-[0.68rem] text-ink-400">{ago(c.lastAt)}</span>
                    </div>
                    {showBusiness && <p className="truncate text-[0.68rem] font-medium text-brand-600">{biz(c.businessId)?.name}</p>}
                    <p className="truncate text-caption text-ink-500">
                      {typing[c.id] ? <span className="text-brand-600">AI is typing…</span> : `${last.from === 'ai' ? 'AI: ' : last.from === 'owner' ? 'You: ' : ''}${last.text}`}
                    </p>
                    <div className="mt-1.5 flex items-center gap-1.5">
                      <StatusPill status={c.status} />
                      {c.unread && <span className="h-2 w-2 rounded-full bg-brand-500" />}
                    </div>
                  </div>
                </button>
              </motion.li>
            )
          })}
        </AnimatePresence>
        {!list.length && (
          <li className="grid place-items-center gap-2 px-6 py-16 text-center text-body-sm text-ink-500">
            <InboxIcon className="h-6 w-6 text-ink-300" /> No conversations here
          </li>
        )}
      </ul>
    </div>
  )

  const b = conv ? biz(conv.businessId) : undefined
  const booking = conv?.bookingId ? bookings.find((x) => x.id === conv.bookingId) : undefined
  const agentId = b ? verticals[b.vertical].agent : 'aria'

  const ThreadPane = conv && b && (
    <div className="flex min-h-0 flex-col">
      <div className="flex items-center gap-3 border-b border-ink-200/70 px-4 py-3">
        <button onClick={() => setSelected(null)} className="-ml-1 grid h-8 w-8 place-items-center rounded-lg text-ink-600 hover:bg-ink-100 lg:hidden" aria-label="Back">
          <ArrowLeft className="h-4 w-4" />
        </button>
        <ChannelBadge channel={conv.channel} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-body-sm font-semibold text-ink-900">{conv.contact.name}</p>
          <p className="truncate text-caption text-ink-500">
            {channels[conv.channel].label} · {conv.contact.handle}
            {showBusiness && ` · ${b.name}`}
          </p>
        </div>
        <button
          onClick={() => dispatch({ type: 'patchConversation', convId: conv.id, patch: { autopilot: !conv.autopilot, status: conv.autopilot ? 'needs_you' : conv.status === 'needs_you' ? 'ai' : conv.status } })}
          className={cn(
            'inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-caption font-semibold transition-colors',
            conv.autopilot ? 'bg-brand-50 text-brand-700 hover:bg-brand-100' : 'bg-amber-50 text-amber-700 hover:bg-amber-100',
          )}
          title={conv.autopilot ? 'AI is answering this chat. Click to take over.' : 'You are handling this chat. Click to hand back to AI.'}
        >
          {conv.autopilot ? <Bot className="h-3.5 w-3.5" /> : <Hand className="h-3.5 w-3.5" />}
          <span className="hidden sm:inline">{conv.autopilot ? 'AI autopilot' : 'You’re handling'}</span>
        </button>
      </div>

      <div ref={scroller} className="no-scrollbar min-h-0 flex-1 space-y-3 overflow-y-auto bg-ink-25 px-4 py-5">
        {conv.messages.map((m) => {
          if (m.from === 'customer')
            return (
              <div key={m.id} className="flex max-w-[85%] flex-col items-start">
                <div className="rounded-2xl rounded-tl-md border border-ink-200/70 bg-ink-0 px-3.5 py-2.5 text-body-sm text-ink-800 shadow-card">{m.text}</div>
                <span className="mt-1 text-[0.65rem] text-ink-400">{new Date(m.at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}</span>
              </div>
            )
          const ai = m.from === 'ai'
          return (
            <motion.div key={m.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="ml-auto flex max-w-[85%] flex-col items-end">
              <div className={cn('rounded-2xl rounded-tr-md px-3.5 py-2.5 text-body-sm', ai ? 'bg-brand-500 text-white' : 'bg-ink-900 text-white')}>{m.text}</div>
              <span className="mt-1 flex items-center gap-1 text-[0.65rem] text-ink-400">
                {ai ? (
                  <>
                    <AgentAvatar id={agentId} size={14} rounded="rounded-full" /> Answered by Zyro AI
                  </>
                ) : (
                  <>
                    <UserRound className="h-3 w-3" /> You
                  </>
                )}
                · {new Date(m.at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                <CheckCheck className="h-3 w-3 text-brand-400" />
              </span>
            </motion.div>
          )
        })}
        {typing[conv.id] && (
          <div className="ml-auto flex w-fit items-center gap-1.5 rounded-2xl rounded-tr-md bg-brand-500/90 px-4 py-3">
            {[0, 1, 2].map((i) => (
              <motion.span key={i} className="h-1.5 w-1.5 rounded-full bg-white" animate={{ y: [0, -3, 0], opacity: [0.5, 1, 0.5] }} transition={{ duration: 0.9, repeat: Infinity, delay: i * 0.15 }} />
            ))}
          </div>
        )}
        {booking && (
          <motion.div initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} className="mx-auto flex w-fit max-w-full items-center gap-3 rounded-2xl border border-success/25 bg-ink-0 px-4 py-3 shadow-card">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-success/10 text-success">
              <CalendarCheck className="h-4 w-4" />
            </span>
            <div className="min-w-0 text-caption">
              <p className="font-semibold text-ink-900">
                {verticals[b.vertical].bookingNoun} · {fmtDay(booking.date)} at {fmtTime(booking.time)}
              </p>
              <p className="text-ink-500">
                {booking.service} · {verticals[b.vertical].detailLabel}: {booking.detail} · added to Bookings.xlsx
                {booking.conflictAvoided && <span className="font-medium text-amber-600"> · double-booking avoided</span>}
              </p>
            </div>
          </motion.div>
        )}
      </div>

      <div className="border-t border-ink-200/70 p-3">
        {conv.autopilot && (
          <p className="mb-2 flex items-center gap-1.5 text-caption text-ink-500">
            <Sparkles className="h-3.5 w-3.5 text-brand-500" /> AI is handling this conversation. Typing a reply will take over.
          </p>
        )}
        <form
          onSubmit={(e) => {
            e.preventDefault()
            reply()
          }}
          className="flex items-center gap-2 rounded-2xl border border-ink-200 bg-ink-0 py-1.5 pl-4 pr-1.5 focus-within:border-brand-400"
        >
          <input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder={`Reply on ${channels[conv.channel].label}…`} className="min-w-0 flex-1 bg-transparent text-body-sm outline-none" />
          <button type="submit" disabled={!draft.trim()} className="grid h-9 w-9 place-items-center rounded-xl bg-brand-500 text-white disabled:bg-ink-100 disabled:text-ink-400" aria-label="Send">
            <Send className="h-4 w-4" />
          </button>
        </form>
      </div>
    </div>
  )

  return (
    <div className="grid grid-cols-1 h-[calc(100vh-11rem)] min-h-[520px] overflow-hidden rounded-2xl border border-ink-200/80 bg-ink-0 shadow-card lg:grid-cols-[360px_minmax(0,1fr)]">
      {ListPane}
      {ThreadPane || (
        <div className="hidden place-items-center text-center text-body-sm text-ink-400 lg:grid">
          <div>
            <InboxIcon className="mx-auto h-8 w-8 text-ink-300" />
            <p className="mt-2">Select a conversation</p>
          </div>
        </div>
      )}
    </div>
  )
}
