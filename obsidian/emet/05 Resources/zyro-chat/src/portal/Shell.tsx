import { useState, type ReactNode } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import type { LucideIcon } from 'lucide-react'
import { ArrowLeft, LogOut, Menu, MessageSquarePlus, PhoneIncoming, Radio, X } from 'lucide-react'
import { LogoMark } from '../components/ui/Logo'
import { usePortal } from './store'
import { go } from './router'
import { Toasts } from './ui'
import { cn } from '../lib/cn'

export type NavItem = { id: string; label: string; icon: LucideIcon; badge?: number }

export function Shell({
  nav,
  current,
  base,
  header,
  simulateFor,
  roleLabel,
  banner,
  children,
}: {
  nav: NavItem[]
  current: string
  base: 'app' | 'admin'
  header: ReactNode
  simulateFor?: string
  roleLabel: string
  banner?: ReactNode
  children: ReactNode
}) {
  const { live, dispatch, simulateIncoming, simulateCall, businesses } = usePortal()
  const [open, setOpen] = useState(false)

  const Sidebar = (
    <nav className="flex h-full flex-col gap-1 p-3" aria-label="Dashboard">
      <a href="#top" onClick={() => (window.location.hash = '')} className="mb-4 flex items-center gap-2.5 px-2 pt-1">
        <LogoMark className="h-7 w-7" />
        <span className="font-display text-[1.05rem] font-semibold text-ink-900">
          Zyro<span className="text-brand-500"> Chat</span>
        </span>
      </a>
      <p className="px-3 pb-1 font-mono text-[0.62rem] uppercase tracking-[0.16em] text-ink-400">{roleLabel}</p>
      {nav.map((n) => {
        const Icon = n.icon
        const active = current === n.id
        return (
          <button
            key={n.id}
            onClick={() => {
              go(`${base}/${n.id}`)
              setOpen(false)
            }}
            className={cn(
              'relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-left text-body-sm font-medium transition-colors',
              active ? 'text-brand-700' : 'text-ink-600 hover:bg-ink-100/70 hover:text-ink-900',
            )}
          >
            {active && <motion.span layoutId={`nav-${base}`} className="absolute inset-0 rounded-xl bg-brand-50 ring-1 ring-brand-100" transition={{ type: 'spring', stiffness: 400, damping: 34 }} />}
            <Icon className="relative h-[18px] w-[18px]" />
            <span className="relative flex-1">{n.label}</span>
            {!!n.badge && <span className="relative rounded-full bg-brand-500 px-1.5 py-px text-[0.65rem] font-semibold text-white">{n.badge}</span>}
          </button>
        )
      })}
      <div className="mt-auto space-y-2 pt-4">
        <div className="rounded-xl border border-ink-200/70 bg-ink-0 p-3">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-2 text-caption font-medium text-ink-800">
              <Radio className={cn('h-3.5 w-3.5', live ? 'text-success' : 'text-ink-400')} /> Live demo feed
            </span>
            <button
              role="switch"
              aria-checked={live}
              onClick={() => dispatch({ type: 'setLive', live: !live })}
              className={cn('relative h-5 w-9 rounded-full transition-colors', live ? 'bg-success' : 'bg-ink-300')}
            >
              <span className={cn('absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all', live ? 'left-[18px]' : 'left-0.5')} />
            </button>
          </div>
          <p className="mt-1 text-[0.68rem] leading-snug text-ink-500">Sample messages & calls arrive every ~15s{simulateFor ? '' : ` across ${businesses.length} clients`}.</p>
        </div>
        <button
          onClick={() => {
            dispatch({ type: 'logout' })
            go('login')
          }}
          className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-body-sm font-medium text-ink-500 hover:bg-ink-100 hover:text-ink-900"
        >
          <LogOut className="h-[18px] w-[18px]" /> Log out
        </button>
      </div>
    </nav>
  )

  return (
    <div className="min-h-screen bg-ink-50/60">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 hidden w-64 border-r border-ink-200/70 bg-ink-25 lg:block">{Sidebar}</aside>

      {/* Mobile drawer */}
      <AnimatePresence>
        {open && (
          <>
            <motion.div className="fixed inset-0 z-40 bg-ink-950/40 lg:hidden" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setOpen(false)} />
            <motion.aside
              className="fixed inset-y-0 left-0 z-50 w-72 bg-ink-25 shadow-window lg:hidden"
              initial={{ x: -300 }}
              animate={{ x: 0 }}
              exit={{ x: -300 }}
              transition={{ type: 'spring', stiffness: 320, damping: 34 }}
            >
              <button onClick={() => setOpen(false)} className="absolute right-3 top-3 grid h-9 w-9 place-items-center rounded-full text-ink-500 hover:bg-ink-100" aria-label="Close menu">
                <X className="h-5 w-5" />
              </button>
              {Sidebar}
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      <div className="lg:pl-64">
        {banner}
        {/* Top bar */}
        <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-ink-200/70 bg-ink-25/85 px-4 backdrop-blur-xl sm:px-6">
          <button onClick={() => setOpen(true)} className="-ml-1 grid h-9 w-9 place-items-center rounded-xl text-ink-700 hover:bg-ink-100 lg:hidden" aria-label="Open menu">
            <Menu className="h-5 w-5" />
          </button>
          <div className="min-w-0 flex-1">{header}</div>
          {simulateFor && (
            <div className="flex items-center gap-2">
              <button
                onClick={() => simulateIncoming(simulateFor)}
                className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-ink-200 bg-ink-0 px-3 text-body-sm font-medium text-ink-700 hover:border-brand-300 hover:text-brand-700"
                title="Send a sample customer message to this business"
              >
                <MessageSquarePlus className="h-4 w-4" /> <span className="hidden sm:inline">Test message</span>
              </button>
              <button
                onClick={() => simulateCall(simulateFor)}
                className="hidden h-9 items-center gap-1.5 rounded-xl border border-ink-200 bg-ink-0 px-3 text-body-sm font-medium text-ink-700 hover:border-brand-300 hover:text-brand-700 sm:inline-flex"
                title="Simulate an incoming phone call"
              >
                <PhoneIncoming className="h-4 w-4" /> Test call
              </button>
            </div>
          )}
        </header>
        <main className="mx-auto max-w-[1400px] px-4 py-6 sm:px-6 sm:py-8">{children}</main>
      </div>
      <Toasts />
    </div>
  )
}

export function BackToAdminBanner({ name }: { name: string }) {
  return (
    <div className="flex items-center justify-between gap-3 bg-ink-950 px-4 py-2 text-caption text-white sm:px-6">
      <span className="truncate">
        You’re viewing <strong>{name}</strong>’s dashboard as the Zyro team
      </span>
      <button onClick={() => go('admin/clients')} className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-white/10 px-2.5 py-1 font-medium hover:bg-white/20">
        <ArrowLeft className="h-3.5 w-3.5" /> Back to owner panel
      </button>
    </div>
  )
}
