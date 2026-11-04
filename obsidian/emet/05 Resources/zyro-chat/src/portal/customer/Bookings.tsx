import { useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { AlertTriangle, CalendarDays, CheckCircle2, Download, Plus, RefreshCw, Sheet, Table2, X } from 'lucide-react'
import { usePortal } from '../store'
import { channels, dayKey, fmtDay, fmtTime, toMin, verticals, type Booking, type Business } from '../data'
import { Btn, Card, ChannelBadge } from '../ui'
import { cn } from '../../lib/cn'

const COLS = ['Date', 'Time', 'Name', 'Phone', 'Service', 'Detail', 'Source', 'Channel', 'Status', 'Notes']

function toCSV(rows: Booking[], b: Business) {
  const v = verticals[b.vertical]
  const head = ['Date', 'Time', 'Name', 'Phone', 'Service', v.detailLabel, 'Booked by', 'Channel', 'Status', 'Notes']
  const esc = (s: string) => `"${String(s).replace(/"/g, '""')}"`
  const lines = rows.map((r) => [r.date, r.time, r.name, r.phone, r.service, r.detail, r.source === 'AI' ? 'Zyro AI' : 'Team', r.channel, r.status, r.notes].map(esc).join(','))
  return [head.map(esc).join(','), ...lines].join('\n')
}

function NewBookingModal({ biz, onClose }: { biz: Business; onClose: () => void }) {
  const { createBooking, toast } = usePortal()
  const v = verticals[biz.vertical]
  const [f, setF] = useState({ name: '', phone: '', date: dayKey(1), time: `${v.open + 6}:00`.padStart(5, '0'), service: v.services[0], detail: biz.vertical === 'realestate' ? v.services[0] : '2', notes: '' })
  const [suggest, setSuggest] = useState<{ date: string; time: string } | null>(null)
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setF({ ...f, [k]: e.target.value })
    setSuggest(null)
  }
  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    const r = createBooking({ businessId: biz.id, ...f, name: f.name || 'Walk-in guest', phone: f.phone || '—', channel: 'walk-in', status: 'Confirmed', source: 'Team' })
    if (r.ok) {
      toast({ title: 'Booking added', body: `${f.name || 'Walk-in guest'} · ${fmtDay(f.date)} ${fmtTime(f.time)} · synced to your sheet`, tone: 'success' })
      onClose()
    } else if (r.suggestion) setSuggest(r.suggestion)
  }
  const input = 'mt-1 h-10 w-full rounded-xl border border-ink-200 bg-ink-0 px-3 text-body-sm outline-none focus:border-brand-400'
  return (
    <motion.div className="fixed inset-0 z-[70] !mt-0 grid place-items-center bg-ink-950/40 p-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
      <motion.form
        onSubmit={submit}
        onClick={(e) => e.stopPropagation()}
        initial={{ y: 20, scale: 0.98 }}
        animate={{ y: 0, scale: 1 }}
        className="w-full max-w-lg rounded-2xl bg-ink-0 p-5 shadow-window sm:p-6"
      >
        <div className="flex items-center justify-between">
          <h3 className="text-body-lg font-semibold">New {v.bookingNoun.toLowerCase()}</h3>
          <button type="button" onClick={onClose} className="text-ink-400 hover:text-ink-800" aria-label="Close">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="text-caption text-ink-600">Name<input className={input} value={f.name} onChange={set('name')} placeholder="Customer name" /></label>
          <label className="text-caption text-ink-600">Phone<input className={input} value={f.phone} onChange={set('phone')} placeholder="+1 …" /></label>
          <label className="text-caption text-ink-600">Date<input type="date" className={input} value={f.date} onChange={set('date')} /></label>
          <label className="text-caption text-ink-600">Time<input type="time" step={1800} className={input} value={f.time} onChange={set('time')} /></label>
          <label className="text-caption text-ink-600">Service
            <select className={input} value={f.service} onChange={set('service')}>
              {v.services.map((s) => <option key={s}>{s}</option>)}
            </select>
          </label>
          <label className="text-caption text-ink-600">{v.detailLabel}<input className={input} value={f.detail} onChange={set('detail')} /></label>
          <label className="text-caption text-ink-600 sm:col-span-2">Notes<input className={input} value={f.notes} onChange={set('notes')} placeholder="Optional" /></label>
        </div>
        <AnimatePresence>
          {suggest && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="mt-4 flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-caption text-amber-800">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <div className="flex-1">
                <p className="font-semibold">That slot is already full, so we blocked a double-booking.</p>
                <p>Nearest free slot: {fmtDay(suggest.date)} at {fmtTime(suggest.time)}.</p>
              </div>
              <Btn variant="secondary" className="h-8" onClick={() => { setF({ ...f, date: suggest.date, time: suggest.time }); setSuggest(null) }}>Use it</Btn>
            </motion.div>
          )}
        </AnimatePresence>
        <div className="mt-5 flex justify-end gap-2">
          <Btn variant="ghost" onClick={onClose}>Cancel</Btn>
          <Btn type="submit">Add booking</Btn>
        </div>
      </motion.form>
    </motion.div>
  )
}

export function BookingsView({ businessId }: { businessId: string }) {
  const { bookings, businesses, dispatch } = usePortal()
  const biz = businesses.find((b) => b.id === businessId)!
  const v = verticals[biz.vertical]
  const [view, setView] = useState<'sheet' | 'week'>('sheet')
  const [range, setRange] = useState<'upcoming' | 'today' | 'all'>('upcoming')
  const [adding, setAdding] = useState(false)
  const today = dayKey(0)

  const rows = useMemo(
    () =>
      bookings
        .filter((b) => b.businessId === businessId)
        .filter((b) => (range === 'all' ? true : range === 'today' ? b.date === today : b.date >= today))
        .sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time)),
    [bookings, businessId, range, today],
  )
  const sheetConn = biz.connections.excel?.connected ? 'Microsoft Excel · Bookings.xlsx' : biz.connections.sheets?.connected ? 'Google Sheets · Bookings (live)' : null
  const newest = Math.max(0, ...rows.map((r) => r.createdAt))

  const download = () => {
    const blob = new Blob([toCSV(rows, biz)], { type: 'text/csv;charset=utf-8' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `${biz.slug}-bookings-${today}.csv`
    a.click()
    URL.revokeObjectURL(a.href)
  }

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-xl border border-ink-200 bg-ink-0 p-1">
            {(
              [
                ['sheet', 'Sheet', Table2],
                ['week', 'Week', CalendarDays],
              ] as const
            ).map(([k, l, I]) => (
              <button key={k} onClick={() => setView(k)} className={cn('inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-body-sm font-medium', view === k ? 'bg-ink-900 text-white' : 'text-ink-600')}>
                <I className="h-4 w-4" /> {l}
              </button>
            ))}
          </div>
          {view === 'sheet' && (
            <select value={range} onChange={(e) => setRange(e.target.value as typeof range)} className="h-10 rounded-xl border border-ink-200 bg-ink-0 px-3 text-body-sm">
              <option value="upcoming">Upcoming</option>
              <option value="today">Today</option>
              <option value="all">All</option>
            </select>
          )}
          {sheetConn ? (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-[#107C41]/10 px-3 py-1.5 text-caption font-medium text-[#107C41]">
              <RefreshCw className="h-3.5 w-3.5 animate-[spin_4s_linear_infinite]" /> Synced to {sheetConn}
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-3 py-1.5 text-caption font-medium text-amber-700">
              <AlertTriangle className="h-3.5 w-3.5" /> Connect Excel or Google Sheets to sync
            </span>
          )}
        </div>
        <div className="flex gap-2">
          <Btn variant="secondary" onClick={download}>
            <Download className="h-4 w-4" /> Export CSV
          </Btn>
          <Btn onClick={() => setAdding(true)}>
            <Plus className="h-4 w-4" /> New {v.bookingNoun.toLowerCase()}
          </Btn>
        </div>
      </div>

      <div className="flex flex-wrap gap-3 text-caption text-ink-500">
        <span className="inline-flex items-center gap-1.5"><CheckCircle2 className="h-3.5 w-3.5 text-success" /> Every slot is checked before booking: max {v.capacity} {v.capacity > 1 ? 'bookings' : 'booking'} per {v.durationMin}-min window</span>
        <span className="inline-flex items-center gap-1.5"><AlertTriangle className="h-3.5 w-3.5 text-amber-500" /> {rows.filter((r) => r.conflictAvoided).length} double-bookings prevented</span>
      </div>

      {view === 'sheet' ? (
        <Card className="overflow-hidden">
          {/* Spreadsheet chrome */}
          <div className="flex items-center gap-2 border-b border-ink-200 bg-[#107C41] px-3 py-2 text-caption text-white">
            <Sheet className="h-4 w-4" />
            <span className="font-semibold">Bookings.xlsx</span>
            <span className="opacity-70">· {biz.name}</span>
            <span className="ml-auto opacity-80">{rows.length} rows</span>
          </div>
          <div className="no-scrollbar max-h-[62vh] overflow-auto">
            <table className="w-full min-w-[980px] border-collapse text-caption">
              <thead className="sticky top-0 z-10">
                <tr className="bg-ink-100 text-[0.65rem] text-ink-500">
                  <th className="w-10 border border-ink-200 font-normal" />
                  {COLS.map((_, i) => (
                    <th key={i} className="border border-ink-200 py-0.5 font-normal">
                      {String.fromCharCode(65 + i)}
                    </th>
                  ))}
                </tr>
                <tr className="bg-ink-50 text-left text-ink-700">
                  <th className="border border-ink-200 text-center text-[0.65rem] font-normal text-ink-400">1</th>
                  {COLS.map((c) => (
                    <th key={c} className="whitespace-nowrap border border-ink-200 px-2 py-1.5 font-semibold">
                      {c === 'Detail' ? v.detailLabel : c}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <AnimatePresence initial={false}>
                  {rows.map((r, i) => (
                    <motion.tr
                      key={r.id}
                      layout="position"
                      initial={{ backgroundColor: 'rgb(220 252 231)' }}
                      animate={{ backgroundColor: r.createdAt === newest && Date.now() - newest < 8000 ? 'rgb(220 252 231)' : 'rgb(255 255 255)' }}
                      transition={{ duration: 1.2 }}
                      className="text-ink-800"
                    >
                      <td className="border border-ink-200 bg-ink-50 text-center text-[0.65rem] text-ink-400">{i + 2}</td>
                      <td className="whitespace-nowrap border border-ink-200 px-2 py-1.5">{fmtDay(r.date)}</td>
                      <td className="border border-ink-200 px-2 py-1.5 tabular-nums">{fmtTime(r.time)}</td>
                      <td className="whitespace-nowrap border border-ink-200 px-2 py-1.5 font-medium">{r.name}</td>
                      <td className="whitespace-nowrap border border-ink-200 px-2 py-1.5 tabular-nums text-ink-600">{r.phone}</td>
                      <td className="whitespace-nowrap border border-ink-200 px-2 py-1.5">{r.service}</td>
                      <td className="whitespace-nowrap border border-ink-200 px-2 py-1.5">{r.detail}</td>
                      <td className="border border-ink-200 px-2 py-1.5">
                        <span className={cn('whitespace-nowrap rounded px-1.5 py-0.5 text-[0.65rem] font-semibold', r.source === 'AI' ? 'bg-brand-50 text-brand-700' : 'bg-ink-100 text-ink-600')}>{r.source === 'AI' ? 'Zyro AI' : 'Team'}</span>
                      </td>
                      <td className="border border-ink-200 px-2 py-1.5">
                        <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
                          <ChannelBadge channel={r.channel} size="sm" /> {r.channel === 'phone' ? 'Phone call' : r.channel === 'walk-in' ? 'Manual' : channels[r.channel].label}
                        </span>
                      </td>
                      <td className="min-w-[7.5rem] border border-ink-200 px-1 py-1">
                        <select
                          value={r.status}
                          onChange={(e) => dispatch({ type: 'patchBooking', id: r.id, patch: { status: e.target.value as Booking['status'] } })}
                          className={cn(
                            'w-full rounded bg-transparent px-1 py-0.5 text-[0.7rem] font-semibold outline-none',
                            r.status === 'Confirmed' ? 'text-success' : r.status === 'Pending' ? 'text-amber-600' : 'text-red-500',
                          )}
                        >
                          <option>Confirmed</option>
                          <option>Pending</option>
                          <option>Cancelled</option>
                        </select>
                      </td>
                      <td className="min-w-[10rem] border border-ink-200 px-2 py-1.5 text-ink-500">
                        {r.conflictAvoided && <span className="mr-1 rounded bg-amber-50 px-1 text-[0.62rem] font-semibold text-amber-700">Moved</span>}
                        {r.notes}
                      </td>
                    </motion.tr>
                  ))}
                </AnimatePresence>
              </tbody>
            </table>
          </div>
        </Card>
      ) : (
        <WeekView businessId={businessId} />
      )}

      <AnimatePresence>{adding && <NewBookingModal biz={biz} onClose={() => setAdding(false)} />}</AnimatePresence>
    </div>
  )
}

function WeekView({ businessId }: { businessId: string }) {
  const { bookings, businesses } = usePortal()
  const biz = businesses.find((b) => b.id === businessId)!
  const v = verticals[biz.vertical]
  const days = Array.from({ length: 7 }, (_, i) => dayKey(i))
  const hours = Array.from({ length: v.close - v.open + 2 }, (_, i) => v.open + i)
  const HOUR_PX = 56
  return (
    <Card className="overflow-hidden">
      <div className="no-scrollbar overflow-x-auto">
        <div className="min-w-[1080px]">
          <div className="grid grid-cols-[56px_repeat(7,1fr)] border-b border-ink-200 bg-ink-50 text-caption">
            <div />
            {days.map((d) => (
              <div key={d} className={cn('border-l border-ink-200 px-2 py-2 font-semibold', d === dayKey(0) ? 'text-brand-600' : 'text-ink-700')}>
                {fmtDay(d)}
              </div>
            ))}
          </div>
          <div className="no-scrollbar relative grid max-h-[60vh] grid-cols-[56px_repeat(7,1fr)] overflow-y-auto">
            <div>
              {hours.map((h) => (
                <div key={h} style={{ height: HOUR_PX }} className="border-b border-ink-100 pr-2 pt-1 text-right text-[0.65rem] text-ink-400">
                  {fmtTime(`${String(h).padStart(2, '0')}:00`)}
                </div>
              ))}
            </div>
            {days.map((d) => {
              const dayB = bookings.filter((b) => b.businessId === businessId && b.date === d && b.status !== 'Cancelled').sort((a, b) => a.time.localeCompare(b.time))
              // lane assignment so overlapping bookings (within capacity) sit side by side
              const lanes: number[] = []
              const placed = dayB.map((b) => {
                const s = toMin(b.time)
                let lane = lanes.findIndex((end) => end <= s)
                if (lane === -1) lane = lanes.length
                lanes[lane] = s + v.durationMin
                return { b, lane }
              })
              const laneCount = Math.max(1, v.capacity)
              return (
                <div key={d} className="relative border-l border-ink-200" style={{ height: hours.length * HOUR_PX }}>
                  {hours.map((h) => (
                    <div key={h} style={{ height: HOUR_PX }} className="border-b border-ink-100" />
                  ))}
                  {placed.map(({ b, lane }) => {
                    const top = ((toMin(b.time) - v.open * 60) / 60) * HOUR_PX
                    const height = (v.durationMin / 60) * HOUR_PX - 3
                    return (
                      <div
                        key={b.id}
                        title={`${b.name} · ${fmtTime(b.time)} · ${b.service}`}
                        className={cn(
                          'absolute overflow-hidden rounded-lg border px-1.5 py-1 text-[0.65rem] leading-tight',
                          b.source === 'AI' ? 'border-brand-200 bg-brand-50 text-brand-800' : 'border-ink-200 bg-ink-100 text-ink-700',
                          b.conflictAvoided && 'border-amber-300 bg-amber-50 text-amber-800',
                        )}
                        style={{ top, height, left: `calc(${(lane / laneCount) * 100}% + 2px)`, width: `calc(${100 / laneCount}% - 4px)` }}
                      >
                        <p className="truncate font-semibold">{b.name}</p>
                        <p className="truncate opacity-75">{fmtTime(b.time)} · {b.service}</p>
                      </div>
                    )
                  })}
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </Card>
  )
}
