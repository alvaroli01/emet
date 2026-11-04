import { motion } from 'framer-motion'
import {
  BarChart3,
  CalendarDays,
  CheckCircle2,
  Circle,
  FileText,
  Heart,
  Mail,
  MessageCircle,
  Table2,
  Ticket,
  Bookmark,
} from 'lucide-react'
import type { Deliverable as D } from '../../data/agents'
import { ease } from '../../lib/motion'
import { cn } from '../../lib/cn'

const item = (i: number) => ({
  initial: { opacity: 0, y: 6 },
  animate: { opacity: 1, y: 0 },
  transition: { delay: 0.08 * i, duration: 0.4, ease },
})

function Shell({ icon, label, children, className }: { icon: React.ReactNode; label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={cn('overflow-hidden rounded-xl border border-ink-200/80 bg-ink-0 text-left shadow-card', className)}>
      <div className="flex items-center gap-1.5 border-b border-ink-100 bg-ink-25 px-3 py-2 text-caption font-medium text-ink-600">
        {icon}
        <span className="truncate">{label}</span>
      </div>
      <div className="p-3">{children}</div>
    </div>
  )
}

const toneCls = {
  brand: 'border-brand-200 bg-brand-50 text-brand-700',
  ion: 'border-ion-300/60 bg-ion-100/60 text-ion-600',
  success: 'border-success/30 bg-success/10 text-success',
}

export function Deliverable({ d, className }: { d: D; className?: string }) {
  switch (d.kind) {
    case 'ticket':
      return (
        <Shell icon={<Ticket className="h-3.5 w-3.5 text-brand-500" />} label={`${d.channel} · ${d.customer}`} className={className}>
          <motion.p {...item(0)} className="rounded-lg bg-ink-50 px-2.5 py-2 text-caption text-ink-600">
            “{d.message}”
          </motion.p>
          <motion.p {...item(1)} className="mt-2 rounded-lg border border-brand-100 bg-brand-50/60 px-2.5 py-2 text-caption leading-relaxed text-ink-800">
            {d.reply}
          </motion.p>
          <motion.div {...item(2)} className="mt-2 flex flex-wrap gap-1">
            {d.tags.map((t, i) => (
              <span key={t} className={cn('rounded-full px-2 py-0.5 text-[0.65rem] font-medium', i === 0 ? 'bg-success/10 text-success' : 'bg-ink-100 text-ink-600')}>
                {t}
              </span>
            ))}
          </motion.div>
        </Shell>
      )

    case 'email':
      return (
        <Shell icon={<Mail className="h-3.5 w-3.5 text-brand-500" />} label="Email draft" className={className}>
          <motion.div {...item(0)} className="space-y-0.5 text-caption">
            <p className="text-ink-500">
              To: <span className="text-ink-800">{d.to}</span>
            </p>
            <p className="font-semibold text-ink-900">{d.subject}</p>
          </motion.div>
          <div className="mt-2 space-y-1.5 border-t border-ink-100 pt-2">
            {d.body.map((p, i) => (
              <motion.p key={i} {...item(i + 1)} className="text-caption leading-relaxed text-ink-700">
                {p}
              </motion.p>
            ))}
          </div>
          {d.stat && (
            <motion.p {...item(d.body.length + 1)} className="mt-2 rounded-md bg-success/10 px-2 py-1 text-[0.68rem] font-medium text-success">
              {d.stat}
            </motion.p>
          )}
        </Shell>
      )

    case 'table':
      return (
        <Shell icon={<Table2 className="h-3.5 w-3.5 text-brand-500" />} label={d.title} className={className}>
          <table className="w-full text-caption">
            <thead>
              <tr className="text-left text-ink-400">
                {d.columns.map((c) => (
                  <th key={c} className="pb-1.5 font-medium">
                    {c}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {d.rows.map((r, i) => (
                <motion.tr key={i} {...item(i)} className="border-t border-ink-100">
                  {r.map((cell, j) => (
                    <td key={j} className={cn('py-1.5 pr-2', j === 0 ? 'font-medium text-ink-900' : 'text-ink-600', cell === 'Winner' && 'font-semibold text-success')}>
                      {cell}
                    </td>
                  ))}
                </motion.tr>
              ))}
            </tbody>
          </table>
        </Shell>
      )

    case 'chart': {
      const max = Math.max(...d.bars.map((b) => b.value))
      return (
        <Shell icon={<BarChart3 className="h-3.5 w-3.5 text-brand-500" />} label={d.title} className={className}>
          {d.delta && <span className="float-right -mt-0.5 rounded-full bg-success/10 px-2 py-0.5 text-[0.65rem] font-semibold text-success">{d.delta}</span>}
          <div className="flex h-24 items-end gap-1.5 pt-4">
            {d.bars.map((b, i) => (
              <div key={b.label} className="flex h-full flex-1 flex-col items-center justify-end gap-1">
                <motion.div
                  initial={{ scaleY: 0 }}
                  animate={{ scaleY: 1 }}
                  transition={{ delay: 0.1 + i * 0.07, duration: 0.6, ease }}
                  style={{ height: `${Math.max(6, (b.value / max) * 100)}%` }}
                  className={cn('w-full origin-bottom rounded-t-[4px]', b.label === (d.highlight ?? d.bars[d.bars.length - 1].label) ? 'bg-brand-gradient' : 'bg-brand-200')}
                />
                <span className="text-[0.6rem] text-ink-500">{b.label}</span>
              </div>
            ))}
          </div>
          {d.note && <p className="mt-2 text-[0.68rem] text-ink-500">{d.note}</p>}
        </Shell>
      )
    }

    case 'doc':
      return (
        <Shell icon={<FileText className="h-3.5 w-3.5 text-brand-500" />} label="Document" className={className}>
          <motion.p {...item(0)} className="font-display text-body-sm font-semibold text-ink-900">
            {d.title}
          </motion.p>
          <div className="mt-2 space-y-2">
            {d.sections.map((s, i) => (
              <motion.div key={s.heading} {...item(i + 1)}>
                <p className="text-[0.65rem] font-semibold uppercase tracking-wider text-brand-600">{s.heading}</p>
                {s.points.map((p) => (
                  <p key={p} className="mt-0.5 text-caption leading-relaxed text-ink-700">
                    {s.points.length > 1 ? '• ' : ''}
                    {p}
                  </p>
                ))}
              </motion.div>
            ))}
          </div>
        </Shell>
      )

    case 'calendar':
      return (
        <Shell icon={<CalendarDays className="h-3.5 w-3.5 text-brand-500" />} label={d.title} className={className}>
          <div className="space-y-1.5">
            {d.events.map((e, i) => (
              <motion.div key={i} {...item(i)} className="flex items-center gap-2">
                <span className="w-8 shrink-0 text-[0.65rem] font-semibold uppercase text-ink-400">{e.day}</span>
                <span className={cn('flex min-w-0 flex-1 items-center gap-2 rounded-lg border px-2 py-1 text-caption', toneCls[e.tone ?? 'brand'])}>
                  <span className="shrink-0 font-mono text-[0.65rem] opacity-80">{e.time}</span>
                  <span className="truncate font-medium">{e.title}</span>
                </span>
              </motion.div>
            ))}
          </div>
        </Shell>
      )

    case 'checklist':
      return (
        <Shell icon={<CheckCircle2 className="h-3.5 w-3.5 text-brand-500" />} label={d.title} className={className}>
          <ul className="space-y-1.5">
            {d.items.map((it, i) => (
              <motion.li key={i} {...item(i)} className="flex items-start gap-2 text-caption">
                {it.done ? <CheckCircle2 className="mt-px h-3.5 w-3.5 shrink-0 text-success" /> : <Circle className="mt-px h-3.5 w-3.5 shrink-0 text-ink-300" />}
                <span className={it.done ? 'text-ink-500' : 'text-ink-800'}>{it.text}</span>
              </motion.li>
            ))}
          </ul>
        </Shell>
      )

    case 'post':
      return (
        <Shell icon={<Heart className="h-3.5 w-3.5 text-brand-500" />} label={`${d.platform} post`} className={className}>
          <div className="flex items-center gap-2">
            <span className="h-6 w-6 rounded-full bg-brand-gradient" />
            <span className="text-caption font-semibold text-ink-900">{d.handle}</span>
          </div>
          <motion.div
            {...item(0)}
            className="relative mt-2 grid aspect-[16/9] place-items-center overflow-hidden rounded-lg bg-[linear-gradient(135deg,#F6E7D8,#E9D5C3_40%,#C9D6FF)]"
          >
            <div className="h-3/4 w-1/4 rounded-t-full bg-[#D8B89A] shadow-inner" />
            <span className="absolute bottom-1.5 right-2 rounded bg-white/70 px-1.5 text-[0.6rem] font-medium text-ink-700">1/5</span>
          </motion.div>
          <motion.p {...item(1)} className="mt-2 text-caption leading-relaxed text-ink-800">
            {d.caption} <span className="text-brand-600">{d.hashtags}</span>
          </motion.p>
          <motion.div {...item(2)} className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[0.65rem] text-ink-500">
            {d.stats.map((s, i) => (
              <span key={s} className="inline-flex items-center gap-1">
                {i === 0 ? <Heart className="h-3 w-3" /> : i === 1 ? <MessageCircle className="h-3 w-3" /> : <Bookmark className="h-3 w-3" />}
                {s}
              </span>
            ))}
          </motion.div>
        </Shell>
      )
  }
}
