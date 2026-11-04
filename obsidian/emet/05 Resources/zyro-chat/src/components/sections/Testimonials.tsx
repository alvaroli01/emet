import { motion } from 'framer-motion'
import { Quote, Star } from 'lucide-react'
import { testimonials } from '../../data/content'
import { SectionHeader } from '../ui/SectionHeader'
import { fadeIn, inView } from '../../lib/motion'

const gradients = [
  'from-brand-500 to-ion-500',
  'from-brand-700 to-brand-400',
  'from-ion-500 to-brand-300',
  'from-brand-400 to-ion-300',
]

function Card({ t, i }: { t: (typeof testimonials)[number]; i: number }) {
  const initials = t.name
    .split(' ')
    .map((p) => p[0])
    .join('')
  return (
    <figure className="flex w-[20rem] shrink-0 flex-col justify-between rounded-3xl border border-ink-200/80 bg-ink-0 p-6 shadow-card transition-[border-color,box-shadow] duration-300 hover:border-brand-200 hover:shadow-lift sm:w-[24rem] sm:p-7">
      <div>
        <div className="flex items-center justify-between">
          <div className="flex gap-0.5 text-brand-500">
            {Array.from({ length: 5 }).map((_, k) => (
              <Star key={k} className="h-3.5 w-3.5 fill-current" />
            ))}
          </div>
          <Quote className="h-6 w-6 text-brand-100" />
        </div>
        <blockquote className="mt-4 text-body-md text-ink-700">“{t.quote}”</blockquote>
      </div>
      <figcaption className="mt-6 flex items-center gap-3">
        <span className={`grid h-10 w-10 place-items-center rounded-full bg-gradient-to-br ${gradients[i % gradients.length]} font-display text-body-sm font-semibold text-white`}>
          {initials}
        </span>
        <span>
          <span className="block text-body-sm font-semibold text-ink-900">{t.name}</span>
          <span className="block text-caption text-ink-500">{t.title}</span>
        </span>
      </figcaption>
    </figure>
  )
}

export function Testimonials() {
  const loop = [...testimonials, ...testimonials]
  return (
    <section className="section overflow-hidden bg-ink-0">
      <div className="hairline absolute inset-x-0 top-0" />
      <div className="container">
        <SectionHeader
          eyebrow="Loved by operators"
          title={
            <>
              Teams that hired Zyro <span className="text-gradient">don’t go back</span>
            </>
          }
        />
      </div>
      <motion.div variants={fadeIn} initial="hidden" whileInView="show" viewport={inView} className="mask-fade-x mt-14 flex">
        <div className="flex w-max animate-marquee gap-5 pr-5 [animation-duration:55s] hover:[animation-play-state:paused]">
          {loop.map((t, i) => (
            <Card key={i} t={t} i={i % testimonials.length} />
          ))}
        </div>
      </motion.div>
      <p className="container mt-6 text-center text-caption text-ink-400">Sample testimonials for demo purposes.</p>
    </section>
  )
}
