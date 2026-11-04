import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { ChevronDown, PhoneCall, PhoneIncoming } from 'lucide-react'
import { usePortal } from '../store'
import { ago } from '../data'
import { Card, StatusPill } from '../ui'
import { AgentAvatar } from '../../components/ui/AgentAvatar'
import { cn } from '../../lib/cn'

export function CallsView({ businessId }: { businessId: string }) {
  const { calls, businesses } = usePortal()
  const biz = businesses.find((b) => b.id === businessId)!
  const list = calls.filter((c) => c.businessId === businessId).sort((a, b) => b.at - a.at)
  const [open, setOpen] = useState<string | null>(list[0]?.id ?? null)
  const phone = biz.connections.phone
  return (
    <div className="space-y-4">
      <Card className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-ion-100 text-ion-600"><PhoneCall className="h-5 w-5" /></span>
        <div className="flex-1">
          <p className="text-body-md font-semibold text-ink-900">AI receptionist {phone?.connected ? 'is answering your calls' : 'is off'}</p>
          <p className="text-body-sm text-ink-500">
            {phone?.connected ? `Calls to ${phone.account} are answered 24/7, booked straight into your sheet, and followed up by SMS.` : 'Connect your phone line in Connections to stop missing calls.'}
          </p>
        </div>
        <span className={cn('rounded-full px-3 py-1 text-caption font-semibold', phone?.connected ? 'bg-success/10 text-success' : 'bg-ink-100 text-ink-500')}>{phone?.connected ? 'Live' : 'Off'}</span>
      </Card>
      <Card className="divide-y divide-ink-100">
        {list.map((c) => (
          <div key={c.id}>
            <button onClick={() => setOpen(open === c.id ? null : c.id)} className="flex w-full items-center gap-3 px-4 py-3.5 text-left hover:bg-ink-50">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-ink-100 text-ink-600"><PhoneIncoming className="h-4 w-4" /></span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-body-sm font-semibold text-ink-900">{c.name} <span className="font-normal text-ink-400">· {c.number}</span></p>
                <p className="truncate text-caption text-ink-500">{c.summary}</p>
              </div>
              <div className="hidden shrink-0 text-right text-caption text-ink-400 sm:block">
                <p>{ago(c.at)} ago</p>
                <p>{Math.floor(c.durationSec / 60)}:{String(c.durationSec % 60).padStart(2, '0')}</p>
              </div>
              <StatusPill status={c.outcome} />
              <ChevronDown className={cn('h-4 w-4 shrink-0 text-ink-400 transition-transform', open === c.id && 'rotate-180')} />
            </button>
            <AnimatePresence initial={false}>
              {open === c.id && c.transcript.length > 0 && (
                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                  <div className="space-y-2 bg-ink-25 px-4 py-4 sm:pl-16">
                    <p className="font-mono text-[0.62rem] uppercase tracking-[0.14em] text-ink-400">Transcript</p>
                    {c.transcript.map((t, i) => (
                      <div key={i} className={cn('flex items-start gap-2 text-body-sm', t.who === 'ai' ? 'text-ink-800' : 'text-ink-600')}>
                        {t.who === 'ai' ? <AgentAvatar id="otto" size={20} rounded="rounded-full" /> : <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-ink-200 text-[0.6rem] font-semibold">C</span>}
                        <p><span className="font-semibold">{t.who === 'ai' ? 'Zyro AI' : c.name.split(' ')[0]}:</span> {t.text}</p>
                      </div>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        ))}
      </Card>
    </div>
  )
}
