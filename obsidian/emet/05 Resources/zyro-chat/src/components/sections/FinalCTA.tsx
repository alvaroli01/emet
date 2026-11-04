import { motion, useReducedMotion } from 'framer-motion'
import { CalendarDays, Mail } from 'lucide-react'
import { Button } from '../ui/Button'
import { AgentAvatar } from '../ui/AgentAvatar'
import { agents } from '../../data/agents'
import { contact } from '../../data/content'
import { ease, inView } from '../../lib/motion'

export function FinalCTA() {
  const reduced = useReducedMotion()
  return (
    <section id="cta" className="section pt-0">
      <div className="container">
        <motion.div
          initial={{ opacity: 0, y: 40, scale: 0.98 }}
          whileInView={{ opacity: 1, y: 0, scale: 1 }}
          viewport={inView}
          transition={{ duration: 0.9, ease }}
          className="relative isolate overflow-hidden rounded-[2rem] bg-ink-950 px-6 py-16 text-center shadow-window sm:px-12 sm:py-24"
        >
          {/* Backdrop: brand glow, grid, expanding rings */}
          <div aria-hidden className="absolute inset-0 -z-10">
            <div className="absolute left-1/2 top-full h-[40rem] w-[60rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-brand-500/50 blur-[120px]" />
            <div className="absolute left-[15%] top-0 h-64 w-64 rounded-full bg-ion-500/25 blur-[100px]" />
            <div className="absolute inset-0 bg-[linear-gradient(rgb(255_255_255/0.05)_1px,transparent_1px),linear-gradient(90deg,rgb(255_255_255/0.05)_1px,transparent_1px)] bg-[size:48px_48px] [mask-image:radial-gradient(ellipse_60%_70%_at_50%_100%,#000,transparent)]" />
            {!reduced &&
              [0, 1, 2].map((i) => (
                <motion.span
                  key={i}
                  className="absolute left-1/2 top-full h-[28rem] w-[28rem] -translate-x-1/2 -translate-y-1/2 rounded-full border border-brand-300/30"
                  initial={{ scale: 0.4, opacity: 0 }}
                  animate={{ scale: 1.8, opacity: [0, 0.8, 0] }}
                  transition={{ duration: 6, repeat: Infinity, delay: i * 2, ease: 'easeOut' }}
                />
              ))}
          </div>

          <div className="mx-auto flex w-fit -space-x-3">
            {agents.slice(0, 7).map((e, i) => (
              <motion.div
                key={e.id}
                initial={{ opacity: 0, y: 12 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={inView}
                transition={{ delay: 0.3 + i * 0.07, ease }}
              >
                <AgentAvatar id={e.id} name={e.name} size={52} rounded="rounded-full" className="ring-4 ring-ink-950" />
              </motion.div>
            ))}
          </div>

          <h2 className="mx-auto mt-8 max-w-3xl text-display-lg font-semibold text-white text-balance">
            Your next twelve hires are{' '}
            <span className="bg-gradient-to-r from-brand-300 to-ion-300 bg-clip-text text-transparent">ready to start today</span>
          </h2>
          <p className="mx-auto mt-5 max-w-xl text-body-lg text-ink-300">
            See Zyro Chat run a live workflow on your own data in a 20-minute demo. Most teams go live within a week.
          </p>
          <div className="mt-10 flex flex-col justify-center gap-3 sm:flex-row">
            <Button href={contact.demoHref} size="lg" variant="inverse">
              <CalendarDays className="h-4 w-4" /> Book a demo
            </Button>
            <Button href={`mailto:${contact.email}`} size="lg" className="border border-white/20 bg-white/10 text-white shadow-none backdrop-blur hover:bg-white/20 hover:shadow-none">
              <Mail className="h-4 w-4" /> {contact.email}
            </Button>
          </div>
        </motion.div>
      </div>
    </section>
  )
}
