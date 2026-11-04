import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion, useInView, useReducedMotion } from 'framer-motion'
import {
  ArrowUp,
  BarChart3,
  Bell,
  CheckCircle2,
  Clock,
  Lock,
  MoreHorizontal,
  Paperclip,
  RotateCcw,
  Search,
  Sparkles,
} from 'lucide-react'
import { demoScript, demoSidebar, type ChatMessage } from '../../data/content'
import { AgentAvatar } from '../ui/AgentAvatar'
import { SectionHeader } from '../ui/SectionHeader'
import { ease, inView } from '../../lib/motion'
import { cn } from '../../lib/cn'


/* ---------- Chat pieces ---------- */

function TypingDots() {
  return (
    <div className="flex items-end gap-2.5">
      <AgentAvatar id="kai" size={28} rounded="rounded-lg" />
      <div className="flex gap-1 rounded-2xl rounded-bl-md border border-ink-200/70 bg-ink-0 px-4 py-3.5 shadow-card">
        {[0, 1, 2].map((i) => (
          <motion.span
            key={i}
            className="h-1.5 w-1.5 rounded-full bg-brand-400"
            animate={{ y: [0, -4, 0], opacity: [0.5, 1, 0.5] }}
            transition={{ duration: 0.9, repeat: Infinity, delay: i * 0.15, ease: 'easeInOut' }}
          />
        ))}
      </div>
    </div>
  )
}

function ReportCard() {
  const bars = [38, 46, 41, 55, 62, 58, 78]
  return (
    <div className="mt-3 rounded-xl border border-ink-200/80 bg-ink-25 p-3.5">
      <div className="flex items-center justify-between text-caption">
        <span className="flex items-center gap-1.5 font-medium text-ink-700">
          <BarChart3 className="h-3.5 w-3.5 text-brand-500" /> Campaign revenue · 7d
        </span>
        <span className="rounded-full bg-success/10 px-2 py-0.5 font-medium text-success">+27%</span>
      </div>
      <div className="mt-3 flex h-16 items-end gap-1.5">
        {bars.map((h, i) => (
          <motion.div
            key={i}
            initial={{ scaleY: 0 }}
            animate={{ scaleY: 1 }}
            transition={{ delay: 0.15 + i * 0.06, duration: 0.6, ease }}
            style={{ height: `${h}%` }}
            className={cn('flex-1 origin-bottom rounded-t-[4px]', i === bars.length - 1 ? 'bg-brand-gradient' : 'bg-brand-200')}
          />
        ))}
      </div>
      <div className="mt-3 grid grid-cols-3 gap-2 text-caption">
        {[
          ['Meta', '$31.4k'],
          ['TikTok', '$9.8k'],
          ['Google', '$7.0k'],
        ].map(([k, v]) => (
          <div key={k} className="rounded-lg bg-ink-0 px-2 py-1.5">
            <div className="text-ink-500">{k}</div>
            <div className="font-semibold text-ink-900">{v}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

function Bubble({ m }: { m: ChatMessage }) {
  if (m.from === 'task') {
    return (
      <motion.div
        layout
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.4, ease }}
        className="mx-auto flex max-w-full items-center gap-2 rounded-full border border-success/25 bg-success/5 px-3.5 py-1.5 text-caption font-medium text-success"
      >
        <CheckCircle2 className="h-3.5 w-3.5 shrink-0" /> <span className="truncate">{m.text}</span>
      </motion.div>
    )
  }
  const isUser = m.from === 'user'
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 12, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.45, ease }}
      className={cn('flex items-end gap-2.5', isUser && 'justify-end')}
    >
      {!isUser && <AgentAvatar id="kai" size={28} rounded="rounded-lg" />}
      <div
        className={cn(
          'max-w-[85%] rounded-2xl px-4 py-3 text-body-sm sm:max-w-[78%]',
          isUser
            ? 'rounded-br-md bg-brand-500 text-white shadow-[0_6px_16px_-6px_rgb(var(--brand-500)/0.6)]'
            : 'rounded-bl-md border border-ink-200/70 bg-ink-0 text-ink-800 shadow-card',
        )}
      >
        {m.text}
        {m.from === 'ai' && m.card === 'report' && <ReportCard />}
      </div>
    </motion.div>
  )
}

/* ---------- Demo player (fake-data state machine) ---------- */

type Phase = { shown: number; typing: boolean; draft: string }

function useChatPlayer(active: boolean) {
  const reduced = useReducedMotion()
  const [phase, setPhase] = useState<Phase>({ shown: 0, typing: false, draft: '' })
  const [run, setRun] = useState(0)
  const [toast, setToast] = useState(false)

  useEffect(() => {
    if (!active) return
    if (reduced) {
      setPhase({ shown: demoScript.length, typing: false, draft: '' })
      setToast(true)
      return
    }
    let cancelled = false
    const timers: number[] = []
    const wait = (ms: number) => new Promise<void>((r) => timers.push(window.setTimeout(r, ms)))

    ;(async () => {
      setPhase({ shown: 0, typing: false, draft: '' })
      setToast(false)
      await wait(600)
      for (let i = 0; i < demoScript.length && !cancelled; i++) {
        const m = demoScript[i]
        if (m.from === 'user') {
          // type into the composer, then "send"
          for (let c = 1; c <= m.text.length && !cancelled; c += 2) {
            setPhase((p) => ({ ...p, draft: m.text.slice(0, c) }))
            await wait(22)
          }
          await wait(250)
          setPhase((p) => ({ ...p, draft: '', shown: i + 1 }))
          await wait(500)
        } else if (m.from === 'ai') {
          setPhase((p) => ({ ...p, typing: true }))
          await wait(1500)
          setPhase((p) => ({ ...p, typing: false, shown: i + 1 }))
          await wait(m.card ? 2200 : 1400)
        } else {
          setPhase((p) => ({ ...p, shown: i + 1 }))
          await wait(400)
          if (!cancelled) setToast(true)
        }
      }
    })()

    return () => {
      cancelled = true
      timers.forEach(clearTimeout)
    }
  }, [active, run, reduced])

  return { ...phase, toast, replay: () => setRun((r) => r + 1), done: phase.shown >= demoScript.length }
}

/* ---------- Section ---------- */

export function ProductDemo() {
  const frameRef = useRef<HTMLDivElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const active = useInView(frameRef, { once: true, margin: '-20% 0px' })
  const { shown, typing, draft, toast, replay, done } = useChatPlayer(active)

  // Keep the newest message in view (scrolls the chat pane only, never the page)
  useEffect(() => {
    const el = scrollRef.current
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' })
  }, [shown, typing])

  return (
    <section id="product" className="section overflow-hidden">
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-1/3 -z-10 h-[36rem] bg-[radial-gradient(ellipse_50%_50%_at_50%_50%,rgb(var(--brand-300)/0.25),transparent_70%)]" />
      <div className="container">
        <SectionHeader
          eyebrow="Product"
          title={
            <>
              Delegate like you would <span className="text-gradient">to a senior hire</span>
            </>
          }
          sub="Talk to your AI employees in plain language. They pull live data, take action across your tools, and coordinate with each other — with every step logged."
        />

        <motion.div
          ref={frameRef}
          initial={{ opacity: 0, y: 48, rotateX: 8 }}
          whileInView={{ opacity: 1, y: 0, rotateX: 0 }}
          viewport={inView}
          transition={{ duration: 1, ease }}
          style={{ transformPerspective: 1600 }}
          className="relative mx-auto mt-14 max-w-5xl lg:mt-16"
        >
          {/* App window */}
          <div className="overflow-hidden rounded-2xl border border-ink-0/70 bg-ink-0/75 shadow-window backdrop-blur-xl sm:rounded-3xl">
            {/* Browser chrome */}
            <div className="flex items-center gap-3 border-b border-ink-200/70 bg-ink-50/80 px-4 py-3">
              <div className="flex gap-1.5">
                <span className="h-3 w-3 rounded-full bg-[#FF5F57]" />
                <span className="h-3 w-3 rounded-full bg-[#FEBC2E]" />
                <span className="h-3 w-3 rounded-full bg-[#28C840]" />
              </div>
              <div className="mx-auto flex min-w-0 max-w-sm flex-1 items-center justify-center gap-1.5 rounded-lg bg-ink-0 px-3 py-1.5 text-caption text-ink-500 shadow-card">
                <Lock className="h-3 w-3 shrink-0" />
                <span className="truncate">app.zyrochat.ai/team/kai</span>
              </div>
              <MoreHorizontal className="hidden h-4 w-4 text-ink-400 sm:block" />
            </div>

            <div className="grid grid-cols-[minmax(0,1fr)] md:grid-cols-[220px_minmax(0,1fr)] lg:grid-cols-[220px_minmax(0,1fr)_240px]">
              {/* Sidebar */}
              <aside className="hidden border-r border-ink-200/70 bg-ink-25/60 p-4 md:block">
                <div className="flex items-center gap-2 rounded-lg border border-ink-200/70 bg-ink-0 px-2.5 py-2 text-caption text-ink-400">
                  <Search className="h-3.5 w-3.5" /> Search team…
                </div>
                <p className="mt-5 px-1 font-mono text-[0.65rem] uppercase tracking-[0.14em] text-ink-400">Your team</p>
                <ul className="mt-2 space-y-1">
                  {demoSidebar.map((s) => (
                    <li key={s.name}>
                    <a
                      href={`#agent/${s.name.toLowerCase()}`}
                      title={`Open ${s.name}`}
                      className={cn(
                        'flex items-center gap-2.5 rounded-xl px-2 py-2 text-body-sm transition-colors',
                        s.active ? 'bg-ink-0 shadow-card ring-1 ring-brand-200' : 'text-ink-600 hover:bg-ink-0/70',
                      )}
                    >
                      <AgentAvatar id={s.name.toLowerCase()} size={28} rounded="rounded-lg" />
                      <span className="min-w-0 flex-1">
                        <span className="block font-medium text-ink-900">{s.name}</span>
                        <span className="block truncate text-caption text-ink-500">{s.role}</span>
                      </span>
                      <span className={cn('text-[0.65rem]', s.active ? 'text-success' : 'text-ink-400')}>{s.status}</span>
                    </a>
                    </li>
                  ))}
                </ul>
              </aside>

              {/* Chat */}
              <div className="flex h-[30rem] min-w-0 flex-col sm:h-[34rem]">
                <div className="flex items-center justify-between border-b border-ink-200/70 px-4 py-3 sm:px-5">
                  <div className="flex items-center gap-3">
                    <AgentAvatar id="kai" size={34} rounded="rounded-xl" />
                    <div>
                      <p className="text-body-sm font-semibold text-ink-900">Kai</p>
                      <p className="flex items-center gap-1.5 text-caption text-ink-500">
                        <span className="h-1.5 w-1.5 rounded-full bg-success" /> Data Analyst · online
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={replay}
                    disabled={!done}
                    className="inline-flex items-center gap-1.5 rounded-full border border-ink-200 px-3 py-1.5 text-caption font-medium text-ink-600 transition-colors hover:border-brand-300 hover:text-brand-600 disabled:opacity-40"
                  >
                    <RotateCcw className="h-3 w-3" /> Replay
                  </button>
                </div>

                <div ref={scrollRef} className="no-scrollbar flex-1 space-y-4 overflow-y-auto px-4 py-5 sm:px-5" aria-live="polite">
                  <p className="text-center text-caption text-ink-400">Today · 9:41 AM</p>
                  {demoScript.slice(0, shown).map((m, i) => (
                    <Bubble key={i} m={m} />
                  ))}
                  <AnimatePresence>
                    {typing && (
                      <motion.div key="typing" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                        <TypingDots />
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {/* Composer */}
                <div className="border-t border-ink-200/70 p-3 sm:p-4">
                  <div className="flex items-center gap-2 rounded-2xl border border-ink-200 bg-ink-0 px-3 py-2 shadow-card focus-within:border-brand-300">
                    <Paperclip className="h-4 w-4 shrink-0 text-ink-400" />
                    <span className={cn('min-w-0 flex-1 truncate text-body-sm', draft ? 'text-ink-900' : 'text-ink-400')}>
                      {draft || 'Ask Kai anything…'}
                      {draft && <span className="ml-0.5 inline-block h-4 w-px translate-y-0.5 animate-pulse-dot bg-brand-500" />}
                    </span>
                    <span
                      className={cn(
                        'grid h-8 w-8 shrink-0 place-items-center rounded-xl transition-colors',
                        draft ? 'bg-brand-500 text-white' : 'bg-ink-100 text-ink-400',
                      )}
                    >
                      <ArrowUp className="h-4 w-4" />
                    </span>
                  </div>
                </div>
              </div>

              {/* Activity rail */}
              <aside className="hidden border-l border-ink-200/70 bg-ink-25/60 p-4 lg:block">
                <p className="font-mono text-[0.65rem] uppercase tracking-[0.14em] text-ink-400">Live activity</p>
                <ul className="mt-3 space-y-3">
                  {[
                    { who: 'Aria', what: 'Resolved 12 tickets', t: '2m' },
                    { who: 'Nova', what: 'Scheduled 14 posts', t: '9m' },
                    { who: 'Nico', what: 'Published “Linen care guide”', t: '24m' },
                    { who: 'Sage', what: 'Booked call with Orbitly', t: '1h' },
                  ].map((a) => (
                    <li key={a.what} className="flex gap-2.5 rounded-xl border border-ink-200/60 bg-ink-0 p-2.5">
                      <AgentAvatar id={a.who.toLowerCase()} size={24} rounded="rounded-md" />
                      <div className="min-w-0 text-caption">
                        <p className="font-medium text-ink-900">{a.who}</p>
                        <p className="text-ink-500">{a.what}</p>
                      </div>
                      <span className="ml-auto flex items-center gap-1 text-[0.65rem] text-ink-400">
                        <Clock className="h-2.5 w-2.5" />
                        {a.t}
                      </span>
                    </li>
                  ))}
                </ul>
                <div className="mt-4 rounded-xl bg-brand-gradient p-3.5 text-white">
                  <p className="flex items-center gap-1.5 text-caption font-medium">
                    <Sparkles className="h-3.5 w-3.5" /> This week
                  </p>
                  <p className="mt-1 font-display text-2xl font-semibold">1,284</p>
                  <p className="text-caption text-white/80">tasks completed · 212 hrs saved</p>
                </div>
              </aside>
            </div>
          </div>

          {/* Task-complete toast */}
          <AnimatePresence>
            {toast && (
              <motion.div
                initial={{ opacity: 0, y: -16, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ type: 'spring', stiffness: 260, damping: 22 }}
                className="glass absolute -bottom-6 right-3 z-10 flex items-center gap-3 rounded-2xl p-3 pr-4 shadow-lift sm:-left-8 sm:bottom-24 sm:right-auto"
              >
                <span className="grid h-9 w-9 place-items-center rounded-xl bg-success/10 text-success">
                  <Bell className="h-4 w-4" />
                </span>
                <span>
                  <span className="block text-body-sm font-semibold text-ink-900">Task completed</span>
                  <span className="block text-caption text-ink-500">Kai × Nova · 3 actions, 0 errors</span>
                </span>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </div>
    </section>
  )
}
