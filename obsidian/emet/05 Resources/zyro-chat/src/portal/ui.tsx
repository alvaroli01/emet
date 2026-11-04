import type { ReactNode } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { AlertTriangle, CheckCircle2, Sparkles, X } from 'lucide-react'
import { channels, type Channel } from './data'
import { usePortal } from './store'
import { cn } from '../lib/cn'

export function ChannelBadge({ channel, size = 'md' }: { channel: Channel | 'phone' | 'walk-in'; size?: 'sm' | 'md' }) {
  if (channel === 'phone' || channel === 'walk-in')
    return (
      <span className={cn('inline-grid shrink-0 place-items-center rounded-full bg-ink-700 font-semibold text-white', size === 'sm' ? 'h-4 w-4 text-[0.5rem]' : 'h-6 w-6 text-[0.6rem]')}>
        {channel === 'phone' ? '☎' : 'W'}
      </span>
    )
  const c = channels[channel]
  const Icon = c.icon
  return (
    <span className={cn('inline-grid shrink-0 place-items-center rounded-full text-white', size === 'sm' ? 'h-4 w-4' : 'h-6 w-6')} style={{ background: c.color }} title={c.label}>
      <Icon className={size === 'sm' ? 'h-2.5 w-2.5' : 'h-3.5 w-3.5'} />
    </span>
  )
}

export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('rounded-2xl border border-ink-200/80 bg-ink-0 shadow-card', className)}>{children}</div>
}

export function PageHeader({ title, sub, actions }: { title: string; sub?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="font-display text-[1.6rem] font-semibold tracking-tight text-ink-900 sm:text-[1.9rem]">{title}</h1>
        {sub && <p className="mt-1 text-body-sm text-ink-500">{sub}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  )
}

export function StatCard({ label, value, hint, icon, tone = 'brand' }: { label: string; value: ReactNode; hint?: string; icon: ReactNode; tone?: 'brand' | 'success' | 'ion' | 'warn' }) {
  const tones = { brand: 'bg-brand-50 text-brand-600', success: 'bg-success/10 text-success', ion: 'bg-ion-100 text-ion-600', warn: 'bg-amber-50 text-amber-600' }
  return (
    <Card className="p-4 sm:p-5">
      <div className="flex items-center justify-between">
        <span className="text-body-sm text-ink-500">{label}</span>
        <span className={cn('grid h-8 w-8 place-items-center rounded-xl', tones[tone])}>{icon}</span>
      </div>
      <p className="mt-3 font-display text-[1.7rem] font-semibold tabular-nums tracking-tight text-ink-900">{value}</p>
      {hint && <p className="mt-0.5 text-caption text-ink-500">{hint}</p>}
    </Card>
  )
}

export function Btn({
  children,
  onClick,
  variant = 'primary',
  className,
  type = 'button',
  disabled,
}: {
  children: ReactNode
  onClick?: () => void
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger'
  className?: string
  type?: 'button' | 'submit'
  disabled?: boolean
}) {
  const v = {
    primary: 'bg-brand-500 text-white hover:bg-brand-600 shadow-[0_6px_16px_-8px_rgb(var(--brand-500)/0.8)]',
    secondary: 'border border-ink-200 bg-ink-0 text-ink-800 hover:border-brand-300 hover:text-brand-700',
    ghost: 'text-ink-600 hover:bg-ink-100 hover:text-ink-900',
    danger: 'border border-red-200 bg-ink-0 text-red-600 hover:bg-red-50',
  }
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={cn('inline-flex h-9 items-center justify-center gap-1.5 whitespace-nowrap rounded-xl px-3.5 text-body-sm font-medium transition-colors disabled:opacity-50', v[variant], className)}
    >
      {children}
    </button>
  )
}

export function Toasts() {
  const { toasts, dispatch } = usePortal()
  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-[80] flex w-[min(92vw,22rem)] flex-col gap-2">
      <AnimatePresence initial={false}>
        {toasts.map((t) => (
          <motion.div
            key={t.id}
            layout
            initial={{ opacity: 0, y: 16, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, x: 40 }}
            transition={{ type: 'spring', stiffness: 320, damping: 26 }}
            className="pointer-events-auto flex items-start gap-3 rounded-2xl border border-ink-200/80 bg-ink-0/95 p-3.5 shadow-lift backdrop-blur"
          >
            <span
              className={cn(
                'grid h-8 w-8 shrink-0 place-items-center rounded-xl',
                t.tone === 'success' ? 'bg-success/10 text-success' : t.tone === 'warn' ? 'bg-amber-50 text-amber-600' : 'bg-brand-50 text-brand-600',
              )}
            >
              {t.tone === 'success' ? <CheckCircle2 className="h-4 w-4" /> : t.tone === 'warn' ? <AlertTriangle className="h-4 w-4" /> : <Sparkles className="h-4 w-4" />}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-body-sm font-semibold text-ink-900">{t.title}</p>
              {t.body && <p className="mt-0.5 text-caption text-ink-500">{t.body}</p>}
            </div>
            <button onClick={() => dispatch({ type: 'dismissToast', id: t.id })} className="text-ink-400 hover:text-ink-700" aria-label="Dismiss">
              <X className="h-4 w-4" />
            </button>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  )
}

export function StatusPill({ status }: { status: string }) {
  const map: Record<string, string> = {
    ai: 'bg-brand-50 text-brand-700',
    booked: 'bg-success/10 text-success',
    resolved: 'bg-ink-100 text-ink-600',
    needs_you: 'bg-amber-50 text-amber-700',
    Confirmed: 'bg-success/10 text-success',
    Pending: 'bg-amber-50 text-amber-700',
    Cancelled: 'bg-red-50 text-red-600',
    Booked: 'bg-success/10 text-success',
    Answered: 'bg-brand-50 text-brand-700',
    Escalated: 'bg-amber-50 text-amber-700',
    Voicemail: 'bg-ink-100 text-ink-600',
  }
  const label: Record<string, string> = { ai: 'AI handling', booked: 'Booked', resolved: 'Resolved', needs_you: 'Needs you' }
  return <span className={cn('inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[0.68rem] font-semibold', map[status] ?? 'bg-ink-100 text-ink-600')}>{label[status] ?? status}</span>
}
