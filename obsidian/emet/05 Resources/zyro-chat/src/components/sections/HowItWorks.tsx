import { useRef } from 'react'
import { motion, useScroll, useSpring } from 'framer-motion'
import { Check, X } from 'lucide-react'
import { steps } from '../../data/content'
import { agents } from '../../data/agents'
import { SectionHeader } from '../ui/SectionHeader'
import { AgentAvatar } from '../ui/AgentAvatar'
import { ease, inView } from '../../lib/motion'

/* Small bespoke visual per step */
function StepVisual({ i }: { i: number }) {
  if (i === 0)
    return (
      <div className="flex -space-x-2">
        {agents.slice(0, 5).map((a) => (
          <AgentAvatar key={a.id} id={a.id} size={32} rounded="rounded-full" className="ring-2 ring-ink-0" />
        ))}
      </div>
    )
  if (i === 1)
    return (
      <div className="flex gap-1.5">
        {['Shopify', 'Slack', 'Meta', 'GA4'].map((t, k) => (
          <motion.span
            key={t}
            initial={{ opacity: 0, y: 6 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={inView}
            transition={{ delay: 0.5 + k * 0.1, ease }}
            className="rounded-md border border-ink-200 bg-ink-0 px-2 py-1 text-caption text-ink-600"
          >
            {t}
          </motion.span>
        ))}
      </div>
    )
  if (i === 2)
    return (
      <div className="w-full max-w-[12rem]">
        <div className="flex justify-between text-caption text-ink-500">
          <span>Running</span>
          <span className="tabular-nums">87%</span>
        </div>
        <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-ink-100">
          <motion.div
            initial={{ scaleX: 0 }}
            whileInView={{ scaleX: 0.87 }}
            viewport={inView}
            transition={{ delay: 0.4, duration: 1.6, ease }}
            className="h-full origin-left rounded-full bg-brand-gradient"
          />
        </div>
      </div>
    )
  return (
    <div className="flex gap-2 text-caption font-medium">
      <span className="inline-flex items-center gap-1 rounded-full bg-success/10 px-2.5 py-1 text-success">
        <Check className="h-3 w-3" /> Approve
      </span>
      <span className="inline-flex items-center gap-1 rounded-full bg-ink-100 px-2.5 py-1 text-ink-500">
        <X className="h-3 w-3" /> Edit
      </span>
    </div>
  )
}

export function HowItWorks() {
  const ref = useRef<HTMLDivElement>(null)
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start 75%', 'end 60%'] })
  const progress = useSpring(scrollYProgress, { stiffness: 120, damping: 30 })

  return (
    <section id="how" className="section bg-ink-0">
      <div className="hairline absolute inset-x-0 top-0" />
      <div className="container">
        <SectionHeader
          eyebrow="How it works"
          title={
            <>
              From hire to results <span className="text-gradient">in an afternoon</span>
            </>
          }
          sub="No prompt engineering, no workflows to wire up. If you can onboard a new teammate, you can run a Zyro team."
        />

        <div ref={ref} className="relative mt-16">
          {/* Progress rail (desktop: horizontal, mobile: vertical) */}
          <div aria-hidden className="absolute left-[1.75rem] top-0 h-full w-px bg-ink-200 lg:left-0 lg:top-[1.75rem] lg:h-px lg:w-full">
            <motion.div
              style={{ scaleY: progress }}
              className="h-full w-full origin-top bg-gradient-to-b from-brand-500 to-ion-500 lg:hidden"
            />
            <motion.div
              style={{ scaleX: progress }}
              className="hidden h-full w-full origin-left bg-gradient-to-r from-brand-500 to-ion-500 lg:block"
            />
          </div>

          <ol className="relative grid gap-10 lg:grid-cols-4 lg:gap-8">
            {steps.map((s, i) => {
              const Icon = s.icon
              return (
                <motion.li
                  key={s.title}
                  initial={{ opacity: 0, y: 28 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={inView}
                  transition={{ delay: i * 0.12, duration: 0.7, ease }}
                  className="relative grid grid-cols-[3.5rem_1fr] gap-5 lg:block"
                >
                  <motion.div
                    initial={{ scale: 0.6, rotate: -12 }}
                    whileInView={{ scale: 1, rotate: 0 }}
                    viewport={inView}
                    transition={{ delay: 0.15 + i * 0.12, type: 'spring', stiffness: 260, damping: 16 }}
                    className="relative z-10 grid h-14 w-14 place-items-center rounded-2xl bg-ink-0 text-brand-600 shadow-lift ring-1 ring-brand-100"
                  >
                    <Icon className="h-6 w-6" strokeWidth={1.75} />
                    <motion.span
                      aria-hidden
                      className="absolute inset-0 rounded-2xl ring-2 ring-brand-400"
                      initial={{ opacity: 0.8, scale: 1 }}
                      whileInView={{ opacity: 0, scale: 1.5 }}
                      viewport={inView}
                      transition={{ delay: 0.35 + i * 0.12, duration: 1.1, ease: 'easeOut' }}
                    />
                  </motion.div>
                  <div className="lg:mt-7">
                    <span className="font-mono text-caption text-brand-500">0{i + 1}</span>
                    <h3 className="mt-1.5 text-[1.3rem] font-semibold tracking-tight">{s.title}</h3>
                    <p className="mt-2 text-body-md text-ink-500">{s.body}</p>
                    <div className="mt-5 flex min-h-[2rem] items-center">
                      <StepVisual i={i} />
                    </div>
                  </div>
                </motion.li>
              )
            })}
          </ol>
        </div>
      </div>
    </section>
  )
}
