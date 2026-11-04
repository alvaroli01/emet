import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { AlertTriangle, ArrowRight, CalendarCheck, Clock, MessageSquare, PhoneCall, ShieldCheck, Sparkles, TrendingUp } from 'lucide-react'
import { usePortal } from '../store'
import { ago, channels, dayKey, fmtTime, verticals, type Channel } from '../data'
import { Card, ChannelBadge, StatCard } from '../ui'
import { go } from '../router'
import { cn } from '../../lib/cn'

export function OverviewView({ businessId }: { businessId: string }) {
  const { businesses, conversations, bookings, activity } = usePortal()
  const [, force] = useState(0)
  useEffect(() => {
    const id = window.setInterval(() => force((x) => x + 1), 15000)
    return () => clearInterval(id)
  }, [])
  const biz = businesses.find((b) => b.id === businessId)!
  const v = verticals[biz.vertical]
  const convs = conversations.filter((c) => c.businessId === businessId)
  const bks = bookings.filter((b) => b.businessId === businessId)
  const today = dayKey(0)
  const todays = bks.filter((b) => b.date === today && b.status !== 'Cancelled').sort((a, b) => a.time.localeCompare(b.time))
  const aiBookings = bks.filter((b) => b.source === 'AI' && b.date >= today).length
  const needs = convs.filter((c) => c.status === 'needs_you').length
  const conflicts = bks.filter((b) => b.conflictAvoided).length
  const answered = convs.reduce((n, c) => n + c.messages.filter((m) => m.from === 'ai').length, 0) + 128
  const byChannel = Object.entries(
    convs.reduce<Record<string, number>>((acc, c) => ((acc[c.channel] = (acc[c.channel] ?? 0) + 1 + (c.channel.length % 3) * 4), acc), {}),
  ).sort((a, b) => b[1] - a[1])
  const max = Math.max(1, ...byChannel.map(([, n]) => n))
  const feed = activity.filter((a) => a.businessId === businessId).sort((a, b) => b.at - a.at).slice(0, 8)
  const hour = new Date().getHours()

  return (
    <div className="space-y-5">
      {needs > 0 && (
        <button onClick={() => go('app/inbox')} className="flex w-full items-center gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-left text-body-sm text-amber-800 hover:bg-amber-100/70">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span className="flex-1"><strong>{needs} conversation{needs > 1 ? 's' : ''}</strong> need{needs > 1 ? '' : 's'} a human touch. Everything else is handled.</span>
          <ArrowRight className="h-4 w-4" />
        </button>
      )}

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <StatCard label="Messages answered" value={answered.toLocaleString()} hint="this week · 100% reply rate" icon={<MessageSquare className="h-4 w-4" />} />
        <StatCard label="Avg. response time" value="4s" hint="vs. 3h 20m industry average" icon={<Clock className="h-4 w-4" />} tone="ion" />
        <StatCard label={`${v.bookingNoun}s by AI`} value={aiBookings} hint="upcoming, all in your sheet" icon={<CalendarCheck className="h-4 w-4" />} tone="success" />
        <StatCard label="Double-bookings prevented" value={conflicts} hint="0 scheduling errors" icon={<ShieldCheck className="h-4 w-4" />} tone="warn" />
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
        <Card className="p-5">
          <div className="flex items-center justify-between">
            <h3 className="text-body-md font-semibold text-ink-900">Today’s {v.bookingNoun.toLowerCase()}s</h3>
            <button onClick={() => go('app/bookings')} className="text-caption font-medium text-brand-600 hover:underline">Open sheet →</button>
          </div>
          <ul className="mt-4 space-y-2">
            {todays.slice(0, 7).map((b) => (
              <li key={b.id} className="flex items-center gap-3 rounded-xl bg-ink-50 px-3 py-2.5">
                <span className="w-14 shrink-0 font-display text-body-sm font-semibold tabular-nums text-ink-900">{fmtTime(b.time)}</span>
                <span className="min-w-0 flex-1 truncate text-body-sm text-ink-800">{b.name} <span className="text-ink-400">· {b.service}</span></span>
                <ChannelBadge channel={b.channel} size="sm" />
                <span className={cn('rounded px-1.5 py-0.5 text-[0.62rem] font-semibold', b.source === 'AI' ? 'bg-brand-100 text-brand-700' : 'bg-ink-200 text-ink-600')}>{b.source === 'AI' ? 'AI' : 'Team'}</span>
              </li>
            ))}
            {!todays.length && <li className="py-6 text-center text-body-sm text-ink-400">Nothing booked yet today</li>}
          </ul>
        </Card>

        <Card className="p-5">
          <h3 className="flex items-center gap-2 text-body-md font-semibold text-ink-900">
            <span className="relative flex h-2 w-2"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success opacity-60" /><span className="relative h-2 w-2 rounded-full bg-success" /></span>
            Live activity
          </h3>
          <ul className="mt-4 space-y-3">
            <AnimatePresence initial={false}>
              {feed.map((a) => (
                <motion.li key={a.id} layout initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="flex items-start gap-3">
                  <span
                    className={cn(
                      'mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-lg',
                      a.kind === 'booking' ? 'bg-success/10 text-success' : a.kind === 'conflict' || a.kind === 'escalation' ? 'bg-amber-50 text-amber-600' : a.kind === 'call' ? 'bg-ion-100 text-ion-600' : 'bg-brand-50 text-brand-600',
                    )}
                  >
                    {a.kind === 'booking' ? <CalendarCheck className="h-3.5 w-3.5" /> : a.kind === 'call' ? <PhoneCall className="h-3.5 w-3.5" /> : a.kind === 'conflict' || a.kind === 'escalation' ? <AlertTriangle className="h-3.5 w-3.5" /> : <Sparkles className="h-3.5 w-3.5" />}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-body-sm text-ink-800">{a.text}</p>
                    <p className="text-[0.68rem] text-ink-400">{ago(a.at)}{ago(a.at) === 'just now' ? '' : ' ago'}</p>
                  </div>
                </motion.li>
              ))}
            </AnimatePresence>
          </ul>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <Card className="p-5">
          <h3 className="text-body-md font-semibold text-ink-900">Messages by channel</h3>
          <p className="text-caption text-ink-500">Last 7 days · all answered</p>
          <ul className="mt-4 space-y-2.5">
            {byChannel.map(([c, n]) => (
              <li key={c} className="flex items-center gap-3">
                <ChannelBadge channel={c as Channel} size="sm" />
                <span className="w-32 shrink-0 truncate text-caption text-ink-700">{channels[c as Channel].label}</span>
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-ink-100">
                  <motion.div initial={{ width: 0 }} animate={{ width: `${(n / max) * 100}%` }} transition={{ duration: 0.8 }} className="h-full rounded-full bg-brand-gradient" />
                </div>
                <span className="w-8 text-right text-caption tabular-nums text-ink-600">{n * 7}</span>
              </li>
            ))}
          </ul>
        </Card>
        <Card className="flex flex-col justify-between bg-ink-950 p-5 text-white">
          <div>
            <p className="flex items-center gap-1.5 text-caption font-medium text-ion-300"><TrendingUp className="h-3.5 w-3.5" /> Opportunities saved</p>
            <p className="mt-3 font-display text-[2.4rem] font-semibold leading-none">{Math.round(answered * 0.38)}</p>
            <p className="mt-2 text-body-sm text-ink-300">
              messages & calls came in outside business hours or while your team was busy. Without Zyro, most of them would have gone unanswered.
            </p>
          </div>
          <p className="mt-5 text-caption text-ink-400">{hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening'}, {biz.contactName.split(' ')[0]}. Your AI team has everything covered.</p>
        </Card>
      </div>
    </div>
  )
}
