import { useState, type MouseEvent } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { ArrowRight, Mail, PlayCircle, Plus } from 'lucide-react'
import { agents, categories, type Agent } from '../../data/agents'
import { contact } from '../../data/content'
import { AgentAvatar } from '../ui/AgentAvatar'
import { SectionHeader } from '../ui/SectionHeader'
import { ease } from '../../lib/motion'
import { cn } from '../../lib/cn'

/** Cursor-following spotlight via CSS vars, with no React re-render */
function trackSpotlight(e: MouseEvent<HTMLElement>) {
  const r = e.currentTarget.getBoundingClientRect()
  e.currentTarget.style.setProperty('--mx', `${e.clientX - r.left}px`)
  e.currentTarget.style.setProperty('--my', `${e.clientY - r.top}px`)
}

function AgentCard({ a, onOpen, i }: { a: Agent; onOpen: (id: string) => void; i: number }) {
  const Icon = a.icon
  return (
    <motion.button
      layout
      type="button"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.96 }}
      transition={{ duration: 0.45, ease, delay: Math.min(i, 8) * 0.04 }}
      onClick={() => onOpen(a.id)}
      onMouseMove={trackSpotlight}
      aria-label={`Open ${a.name}, ${a.role}`}
      className="group relative grid grid-cols-[auto_1fr] items-center gap-x-4 overflow-hidden rounded-3xl border border-ink-200/80 bg-ink-0 p-4 text-left shadow-card sm:flex sm:flex-col sm:items-stretch sm:p-6 transition-[border-color,box-shadow,transform] duration-500 ease-out-expo hover:-translate-y-1 hover:border-brand-300 hover:shadow-lift focus-visible:-translate-y-1 sm:p-6"
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-500 group-hover:opacity-100"
        style={{ background: 'radial-gradient(360px circle at var(--mx) var(--my), rgb(var(--brand-500) / 0.08), transparent 60%)' }}
      />

      <div className="relative row-span-3 flex items-start justify-between sm:row-span-1">
        <div className="relative">
          <AgentAvatar id={a.id} name={a.name} size={76} rounded="rounded-[22px]" className="transition-transform duration-500 ease-out-expo group-hover:-rotate-3 group-hover:scale-105" />
          <span className="absolute -bottom-1 -right-1 grid h-7 w-7 place-items-center rounded-full border-2 border-ink-0 text-white" style={{ background: a.color }}>
            <Icon className="h-3.5 w-3.5" />
          </span>
        </div>
        <span className="hidden items-center gap-1.5 rounded-full bg-success/10 px-2.5 py-1 text-caption font-medium text-success sm:inline-flex">
          <span className="h-1.5 w-1.5 animate-pulse-dot rounded-full bg-success" /> Online
        </span>
      </div>

      <h3 className="relative text-display-sm font-semibold sm:mt-5">{a.name}</h3>
      <p className="relative text-body-sm font-medium text-brand-600">{a.role}</p>
      <p className="relative mt-1 flex-1 text-body-sm text-ink-600 sm:mt-2.5">{a.tagline}</p>

      <div className="relative col-span-2 mt-4 flex items-center justify-between border-t border-ink-100 pt-3 sm:mt-5 sm:pt-4">
        <span className="inline-flex items-center gap-1.5 text-caption font-medium text-ink-500 transition-colors group-hover:text-ink-800">
          <PlayCircle className="h-3.5 w-3.5 text-brand-500" /> Demo + live chat
        </span>
        <span className="inline-flex items-center gap-1 text-caption font-semibold text-brand-600">
          Try {a.name}
          <ArrowRight className="h-3.5 w-3.5 transition-transform duration-300 group-hover:translate-x-1" />
        </span>
      </div>
    </motion.button>
  )
}

export function Employees({ onOpen }: { onOpen: (id: string) => void }) {
  const [cat, setCat] = useState<(typeof categories)[number]>('All')
  const list = cat === 'All' ? agents : agents.filter((a) => a.category === cat)

  return (
    <section id="employees" className="section">
      <div className="container">
        <SectionHeader
          eyebrow="Meet the team"
          title={
            <>
              12 specialists, <span className="text-gradient">ready on day one</span>
            </>
          }
          sub="Each Zyro employee is trained for one job and does it exceptionally well. Click any of them to watch them work, then give them a task yourself."
        />

        {/* Category filter */}
        <div className="no-scrollbar -mx-5 mt-10 flex justify-start gap-1 overflow-x-auto px-5 sm:mx-0 sm:justify-center sm:px-0">
          <div className="inline-flex gap-1 rounded-full border border-ink-200 bg-ink-0 p-1 shadow-card">
            {categories.map((c) => (
              <button
                key={c}
                onClick={() => setCat(c)}
                className={cn(
                  'relative shrink-0 whitespace-nowrap rounded-full px-4 py-2 text-body-sm font-medium transition-colors',
                  cat === c ? 'text-white' : 'text-ink-600 hover:text-ink-900',
                )}
              >
                {cat === c && <motion.span layoutId="cat-pill" className="absolute inset-0 rounded-full bg-brand-500" transition={{ type: 'spring', stiffness: 400, damping: 32 }} />}
                <span className="relative">{c}</span>
              </button>
            ))}
          </div>
        </div>

        <motion.div layout className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          <AnimatePresence mode="popLayout">
            {list.map((a, i) => (
              <AgentCard key={a.id} a={a} i={i} onOpen={onOpen} />
            ))}
          </AnimatePresence>
        </motion.div>

        {/* Custom role banner */}
        <motion.a
          href={`mailto:${contact.email}?subject=${encodeURIComponent('Custom AI employee for our team')}`}
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, ease }}
          className="group relative mt-6 flex flex-col items-start gap-4 overflow-hidden rounded-3xl bg-brand-gradient p-6 text-white shadow-lift sm:flex-row sm:items-center sm:p-7"
        >
          <div aria-hidden className="absolute -right-16 -top-20 h-56 w-56 rounded-full bg-white/20 blur-3xl transition-transform duration-700 ease-out-expo group-hover:scale-125" />
          <span className="relative grid h-12 w-12 shrink-0 place-items-center rounded-2xl border border-white/30 bg-white/10 backdrop-blur transition-transform duration-500 group-hover:rotate-90">
            <Plus className="h-5 w-5" />
          </span>
          <div className="relative flex-1">
            <p className="font-display text-body-lg font-semibold">Need a role that isn’t on the list?</p>
            <p className="text-body-sm text-white/80">We design custom AI employees around your workflows, tools and guardrails.</p>
          </div>
          <span className="relative inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-body-sm font-medium text-brand-700">
            <Mail className="h-4 w-4" /> Talk to our team
          </span>
        </motion.a>
      </div>
    </section>
  )
}
