import { useState } from 'react'
import { motion } from 'framer-motion'
import { Check, Sparkles } from 'lucide-react'
import { pricing } from '../../data/content'
import { SectionHeader } from '../ui/SectionHeader'
import { Button } from '../ui/Button'
import { fadeUp, inView, stagger } from '../../lib/motion'
import { cn } from '../../lib/cn'

export function Pricing() {
  const [annual, setAnnual] = useState(true)

  return (
    <section id="pricing" className="section">
      <div className="container">
        <SectionHeader
          eyebrow="Pricing"
          title={
            <>
              A full team for <span className="text-gradient">less than one hire</span>
            </>
          }
          sub="Start free for 14 days. Scale headcount up or down any time."
        />

        {/* Billing toggle */}
        <div className="mt-10 flex justify-center">
          <div className="relative inline-flex rounded-full border border-ink-200 bg-ink-0 p-1 shadow-card" role="radiogroup" aria-label="Billing period">
            {[
              { label: 'Monthly', value: false },
              { label: 'Annual', value: true },
            ].map((o) => (
              <button
                key={o.label}
                role="radio"
                aria-checked={annual === o.value}
                onClick={() => setAnnual(o.value)}
                className={cn(
                  'relative z-10 rounded-full px-5 py-2 text-body-sm font-medium transition-colors',
                  annual === o.value ? 'text-white' : 'text-ink-600 hover:text-ink-900',
                )}
              >
                {annual === o.value && (
                  <motion.span layoutId="billing-pill" className="absolute inset-0 -z-10 rounded-full bg-brand-500" transition={{ type: 'spring', stiffness: 400, damping: 32 }} />
                )}
                {o.label}
                {o.value && <span className={cn('ml-1.5 text-caption', annual ? 'text-ion-100' : 'text-brand-500')}>−20%</span>}
              </button>
            ))}
          </div>
        </div>

        <motion.div
          variants={stagger(0.1)}
          initial="hidden"
          whileInView="show"
          viewport={inView}
          className="mx-auto mt-12 grid max-w-5xl items-stretch gap-5 lg:grid-cols-3"
        >
          {pricing.map((p) => {
            const price = p.price === null ? null : annual ? Math.round(p.price * 0.8) : p.price
            return (
              <motion.div
                key={p.name}
                variants={fadeUp}
                className={cn(
                  'relative flex flex-col rounded-3xl p-7 transition-[transform,box-shadow] duration-500 ease-out-expo hover:-translate-y-1',
                  p.popular
                    ? 'bg-ink-950 text-white shadow-[0_40px_80px_-30px_rgb(var(--brand-600)/0.6)] ring-1 ring-brand-500/60 lg:-my-4 lg:py-11'
                    : 'border border-ink-200/80 bg-ink-0 shadow-card hover:shadow-lift',
                )}
              >
                {p.popular && (
                  <>
                    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden rounded-3xl">
                      <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-brand-500/40 blur-3xl" />
                      <div className="absolute -bottom-24 -left-10 h-56 w-56 rounded-full bg-ion-500/20 blur-3xl" />
                    </div>
                    <span className="absolute -top-3 left-1/2 inline-flex -translate-x-1/2 items-center gap-1 rounded-full bg-brand-gradient px-3 py-1 text-caption font-semibold text-white shadow-glow lg:-top-3">
                      <Sparkles className="h-3 w-3" /> Most popular
                    </span>
                  </>
                )}
                <div className="relative">
                  <h3 className={cn('text-display-sm font-semibold', p.popular && 'text-white')}>{p.name}</h3>
                  <p className={cn('mt-1.5 text-body-sm', p.popular ? 'text-ink-300' : 'text-ink-500')}>{p.blurb}</p>
                  <div className="mt-6 flex items-baseline gap-1.5">
                    {price === null ? (
                      <span className="font-display text-display-md font-semibold">Custom</span>
                    ) : (
                      <>
                        <motion.span
                          key={price}
                          initial={{ opacity: 0, y: -8 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="font-display text-display-lg font-semibold tabular-nums"
                        >
                          ${price}
                        </motion.span>
                        <span className={cn('text-body-sm', p.popular ? 'text-ink-300' : 'text-ink-500')}>/ month</span>
                      </>
                    )}
                  </div>
                  <p className={cn('mt-1 h-5 text-caption', p.popular ? 'text-ink-400' : 'text-ink-400')}>
                    {price !== null && annual ? 'billed annually' : price !== null ? 'billed monthly' : 'volume-based, annual contract'}
                  </p>
                </div>

                <ul className="relative mt-7 flex-1 space-y-3">
                  {p.features.map((f) => (
                    <li key={f} className={cn('flex items-start gap-2.5 text-body-sm', p.popular ? 'text-ink-200' : 'text-ink-600')}>
                      <span className={cn('mt-0.5 grid h-4 w-4 shrink-0 place-items-center rounded-full', p.popular ? 'bg-brand-500 text-white' : 'bg-brand-50 text-brand-600')}>
                        <Check className="h-2.5 w-2.5" strokeWidth={3} />
                      </span>
                      {f}
                    </li>
                  ))}
                </ul>

                <Button href="#cta" size="lg" variant={p.popular ? 'primary' : 'secondary'} className="relative mt-8 w-full">
                  {p.cta}
                </Button>
              </motion.div>
            )
          })}
        </motion.div>
      </div>
    </section>
  )
}
