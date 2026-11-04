import { motion } from 'framer-motion'
import { ArrowRight } from 'lucide-react'
import { caseStudies } from '../../data/content'
import { SectionHeader } from '../ui/SectionHeader'
import { fadeUp, inView, stagger } from '../../lib/motion'

export function UseCases() {
  return (
    <section className="section">
      <div className="container">
        <SectionHeader
          eyebrow="Results"
          title={
            <>
              Real work, <span className="text-gradient">measurable outcomes</span>
            </>
          }
          sub="What teams see after their first 90 days with a Zyro workforce."
        />

        <motion.div
          variants={stagger(0.12)}
          initial="hidden"
          whileInView="show"
          viewport={inView}
          className="mt-14 grid gap-5 lg:mt-16 lg:grid-cols-3"
        >
          {caseStudies.map((c) => (
            <motion.article
              key={c.company}
              variants={fadeUp}
              className="group flex flex-col rounded-3xl border border-ink-200/80 bg-ink-0 p-6 shadow-card transition-[box-shadow,border-color] duration-500 hover:border-brand-200 hover:shadow-lift sm:p-7"
            >
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="font-display text-body-lg font-semibold text-ink-900">{c.company}</p>
                  <p className="text-caption text-ink-500">{c.segment}</p>
                </div>
                <span className="rounded-full bg-brand-50 px-2.5 py-1 text-caption font-medium text-brand-600">{c.employee}</span>
              </div>

              <h3 className="mt-6 text-display-sm font-semibold">{c.headline}</h3>

              {/* Before → After */}
              <div className="mt-6 grid grid-cols-[1fr_auto_1fr] items-center gap-3 rounded-2xl bg-ink-50 p-4">
                <div>
                  <p className="text-caption uppercase tracking-wider text-ink-400">Before</p>
                  <p className="mt-1 font-display text-2xl font-semibold text-ink-400 line-through decoration-ink-300 decoration-1">
                    {c.before.value}
                  </p>
                  <p className="text-caption text-ink-500">{c.before.label}</p>
                </div>
                <span className="grid h-8 w-8 place-items-center rounded-full bg-ink-0 text-brand-500 shadow-card transition-transform duration-500 group-hover:translate-x-1">
                  <ArrowRight className="h-4 w-4" />
                </span>
                <div>
                  <p className="text-caption uppercase tracking-wider text-brand-500">After</p>
                  <p className="text-gradient mt-1 font-display text-2xl font-semibold">{c.after.value}</p>
                  <p className="text-caption text-ink-500">{c.after.label}</p>
                </div>
              </div>

              <dl className="mt-auto grid grid-cols-2 gap-4 border-t border-ink-100 pt-5 [margin-top:1.5rem]">
                {c.metrics.map((m) => (
                  <div key={m.label}>
                    <dt className="order-2 text-caption text-ink-500">{m.label}</dt>
                    <dd className="font-display text-display-sm font-semibold text-ink-900">{m.value}</dd>
                  </div>
                ))}
              </dl>
            </motion.article>
          ))}
        </motion.div>
        <p className="mt-6 text-center text-caption text-ink-400">Illustrative customer scenarios with placeholder figures, for demo purposes.</p>
      </div>
    </section>
  )
}
