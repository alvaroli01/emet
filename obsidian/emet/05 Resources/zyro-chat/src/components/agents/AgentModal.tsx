import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { CheckCircle2, ChevronLeft, ChevronRight, MessageSquare, PlayCircle, TrendingUp, X } from 'lucide-react'
import { agents, agentById } from '../../data/agents'
import { AgentAvatar } from '../ui/AgentAvatar'
import { AgentDemoPlayer } from './AgentDemoPlayer'
import { AgentChat } from './AgentChat'
import { ease } from '../../lib/motion'
import { cn } from '../../lib/cn'

type Tab = 'demo' | 'chat'

export function AgentModal({ id, onClose, onNavigate }: { id: string | null; onClose: () => void; onNavigate: (id: string) => void }) {
  const agent = id ? agentById(id) : undefined
  const [tab, setTab] = useState<Tab>('demo')
  const panel = useRef<HTMLDivElement>(null)

  const idx = agent ? agents.indexOf(agent) : -1
  const prev = agents[(idx - 1 + agents.length) % agents.length]
  const next = agents[(idx + 1) % agents.length]

  // Lock page scroll + keyboard shortcuts
  useEffect(() => {
    if (!agent) return
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (e: KeyboardEvent) => {
      const typing = (e.target as HTMLElement)?.tagName === 'INPUT'
      if (e.key === 'Escape') onClose()
      if (!typing && e.key === 'ArrowRight') onNavigate(next.id)
      if (!typing && e.key === 'ArrowLeft') onNavigate(prev.id)
    }
    window.addEventListener('keydown', onKey)
    panel.current?.focus()
    return () => {
      document.body.style.overflow = prevOverflow
      window.removeEventListener('keydown', onKey)
    }
  }, [agent, next, prev, onClose, onNavigate])

  useEffect(() => setTab('demo'), [id])

  return (
    <AnimatePresence>
      {agent && (
        <motion.div
          key="agent-modal"
          className="fixed inset-0 z-[60] flex items-stretch justify-center sm:items-center sm:p-4 lg:p-8"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
        >
          <div className="absolute inset-0 bg-ink-950/45 backdrop-blur-sm" onClick={onClose} aria-hidden />

          <motion.div
            ref={panel}
            tabIndex={-1}
            role="dialog"
            aria-modal="true"
            aria-label={`${agent.name}, ${agent.role}`}
            initial={{ opacity: 0, y: 30, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.98 }}
            transition={{ duration: 0.4, ease }}
            className="relative flex h-full w-full max-w-6xl flex-col overflow-hidden bg-ink-25 shadow-window outline-none sm:h-[min(92vh,860px)] sm:rounded-3xl sm:border sm:border-ink-0/70"
          >
            {/* Header */}
            <header className="flex items-center gap-3 border-b border-ink-200/70 bg-ink-0 px-4 py-3 sm:px-6 sm:py-4">
              <AgentAvatar id={agent.id} name={agent.name} size={48} className="sm:h-14 sm:w-14" />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                  <h2 className="text-display-sm font-semibold">{agent.name}</h2>
                  <span className="rounded-full bg-brand-50 px-2.5 py-0.5 text-caption font-medium text-brand-700">{agent.role}</span>
                </div>
                <p className="truncate text-body-sm text-ink-500">{agent.tagline}</p>
              </div>
              <span className="hidden items-center gap-1.5 rounded-full bg-success/10 px-3 py-1 text-caption font-medium text-success md:inline-flex">
                <TrendingUp className="h-3.5 w-3.5" /> {agent.kpi}
              </span>
              <div className="flex items-center gap-1">
                <button onClick={() => onNavigate(prev.id)} aria-label={`Previous: ${prev.name}`} className="hidden h-9 w-9 place-items-center rounded-full text-ink-500 hover:bg-ink-100 hover:text-ink-900 sm:grid">
                  <ChevronLeft className="h-5 w-5" />
                </button>
                <button onClick={() => onNavigate(next.id)} aria-label={`Next: ${next.name}`} className="hidden h-9 w-9 place-items-center rounded-full text-ink-500 hover:bg-ink-100 hover:text-ink-900 sm:grid">
                  <ChevronRight className="h-5 w-5" />
                </button>
                <button onClick={onClose} aria-label="Close" className="grid h-9 w-9 place-items-center rounded-full bg-ink-100 text-ink-700 hover:bg-ink-200">
                  <X className="h-4 w-4" />
                </button>
              </div>
            </header>

            {/* Mobile tabs */}
            <div className="flex gap-1 border-b border-ink-200/70 bg-ink-0 px-3 py-2 lg:hidden" role="tablist">
              {(
                [
                  ['demo', 'Watch demo', PlayCircle],
                  ['chat', `Try ${agent.name}`, MessageSquare],
                ] as const
              ).map(([key, label, Icon]) => (
                <button
                  key={key}
                  role="tab"
                  aria-selected={tab === key}
                  onClick={() => setTab(key)}
                  className={cn(
                    'relative flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2 text-caption font-medium transition-colors',
                    tab === key ? 'text-brand-700' : 'text-ink-500',
                  )}
                >
                  {tab === key && <motion.span layoutId="agent-tab" className="absolute inset-0 rounded-lg bg-brand-50" transition={{ type: 'spring', stiffness: 400, damping: 34 }} />}
                  <Icon className="relative h-3.5 w-3.5" />
                  <span className="relative">{label}</span>
                </button>
              ))}
            </div>

            {/* Body */}
            <div className="grid min-h-0 flex-1 lg:grid-cols-[minmax(0,1.08fr)_minmax(0,1fr)]">
              {/* Left: demo video + about */}
              <div className={cn('no-scrollbar min-h-0 overflow-y-auto p-4 sm:p-6', tab === 'chat' && 'hidden lg:block')}>
                <div>
                  <p className="mb-3 flex items-center gap-1.5 font-mono text-caption uppercase tracking-[0.14em] text-ink-400">
                    <PlayCircle className="h-3.5 w-3.5" /> Watch {agent.name} work
                  </p>
                  <AgentDemoPlayer key={agent.id} agent={agent} />
                  <button
                    onClick={() => setTab('chat')}
                    className="mt-4 flex w-full items-center justify-center gap-2 rounded-full bg-brand-500 py-3 text-body-sm font-medium text-white lg:hidden"
                  >
                    <MessageSquare className="h-4 w-4" /> Try {agent.name} yourself
                  </button>
                </div>

                <div className="mt-6 lg:mt-7">
                  <h3 className="text-body-lg font-semibold">What {agent.name} does</h3>
                  <p className="mt-2 text-body-md text-ink-600">{agent.about}</p>
                  <ul className="mt-5 grid gap-2.5 sm:grid-cols-2">
                    {agent.capabilities.map((c) => (
                      <li key={c} className="flex items-start gap-2 rounded-xl border border-ink-200/70 bg-ink-0 px-3 py-2.5 text-body-sm text-ink-700">
                        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-brand-500" />
                        {c}
                      </li>
                    ))}
                  </ul>
                  <p className="mt-6 text-caption font-medium uppercase tracking-wider text-ink-400">Works with</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {agent.tools.map((t) => (
                      <span key={t} className="rounded-lg border border-ink-200 bg-ink-0 px-2.5 py-1 text-caption text-ink-700">
                        {t}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              {/* Right: interactive chat */}
              <div className={cn('flex min-h-0 flex-col border-ink-200/70 bg-ink-0 lg:border-l', tab !== 'chat' && 'hidden lg:flex')}>
                <div className="flex items-center justify-between border-b border-ink-100 px-4 py-3 sm:px-5">
                  <p className="flex items-center gap-2 text-body-sm font-semibold text-ink-900">
                    <MessageSquare className="h-4 w-4 text-brand-500" /> Try {agent.name}
                  </p>
                  <span className="inline-flex items-center gap-1.5 text-caption text-success">
                    <span className="h-1.5 w-1.5 animate-pulse-dot rounded-full bg-success" /> Online
                  </span>
                </div>
                <div className="min-h-0 flex-1">
                  <AgentChat agent={agent} />
                </div>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
