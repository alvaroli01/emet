import { useState } from 'react'
import { motion } from 'framer-motion'
import { ArrowRight, Building2, CalendarDays, Check, Clock, Copy, Mail, Rocket, ShieldCheck } from 'lucide-react'
import { contact } from '../../data/content'
import { SectionHeader } from '../ui/SectionHeader'
import { Button } from '../ui/Button'
import { AgentAvatar } from '../ui/AgentAvatar'
import { fadeUp, inView, stagger } from '../../lib/motion'

const icons = [Building2, Rocket, ShieldCheck]

/** Replaces public pricing: plans are scoped per customer via email. */
export function Contact() {
  const [copied, setCopied] = useState(false)
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(contact.email)
    } catch {
      /* clipboard may be blocked; the mailto button still works */
    }
    setCopied(true)
    window.setTimeout(() => setCopied(false), 2000)
  }

  return (
    <section id="contact" className="section">
      <div className="container">
        <SectionHeader
          eyebrow="Plans & pricing"
          title={
            <>
              Pricing built around <span className="text-gradient">your team</span>
            </>
          }
          sub="Every business runs differently, so we don’t sell one-size-fits-all plans. Tell us what you need and we’ll send a tailored proposal."
        />

        <motion.div
          variants={stagger(0.1)}
          initial="hidden"
          whileInView="show"
          viewport={inView}
          className="mx-auto mt-14 grid max-w-5xl gap-5 lg:grid-cols-[1fr_1.05fr]"
        >
          {/* What's included */}
          <div className="grid gap-4">
            {contact.includes.map((c, i) => {
              const Icon = icons[i]
              return (
                <motion.div key={c.title} variants={fadeUp} className="flex gap-4 rounded-3xl border border-ink-200/80 bg-ink-0 p-5 shadow-card sm:p-6">
                  <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-brand-50 text-brand-600">
                    <Icon className="h-5 w-5" />
                  </span>
                  <div>
                    <h3 className="text-body-lg font-semibold">{c.title}</h3>
                    <p className="mt-1 text-body-sm text-ink-500">{c.body}</p>
                  </div>
                </motion.div>
              )
            })}
          </div>

          {/* Contact card */}
          <motion.div
            variants={fadeUp}
            className="relative flex flex-col overflow-hidden rounded-3xl bg-ink-950 p-7 text-white shadow-[0_40px_80px_-30px_rgb(var(--brand-600)/0.6)] ring-1 ring-brand-500/50 sm:p-9"
          >
            <div aria-hidden className="pointer-events-none absolute inset-0">
              <div className="absolute -right-20 -top-20 h-72 w-72 rounded-full bg-brand-500/40 blur-3xl" />
              <div className="absolute -bottom-24 -left-10 h-60 w-60 rounded-full bg-ion-500/20 blur-3xl" />
            </div>

            <div className="relative flex -space-x-2">
              {['aria', 'kai', 'nova', 'sage'].map((id) => (
                <AgentAvatar key={id} id={id} size={40} rounded="rounded-full" className="ring-2 ring-ink-950" />
              ))}
            </div>
            <p className="relative mt-6 font-mono text-caption uppercase tracking-[0.14em] text-ion-300">Get a proposal</p>
            <h3 className="relative mt-2 text-display-sm font-semibold text-white">Tell us about your business</h3>
            <p className="relative mt-2 text-body-md text-ink-300">
              Share your team size, the AI employees you’re interested in and the tools you use. We’ll come back with a plan and pricing that fit.
            </p>

            <div className="relative mt-7 flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 p-2 pl-4 backdrop-blur">
              <Mail className="h-5 w-5 shrink-0 text-ion-300" />
              <a href={contact.pricingHref} className="min-w-0 flex-1 truncate font-display text-body-lg font-semibold text-white hover:text-ion-100">
                {contact.email}
              </a>
              <button
                onClick={copy}
                aria-label="Copy email address"
                className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-white/10 px-3 py-2 text-caption font-medium text-white transition-colors hover:bg-white/20"
              >
                {copied ? <Check className="h-3.5 w-3.5 text-ion-300" /> : <Copy className="h-3.5 w-3.5" />}
                {copied ? 'Copied' : 'Copy'}
              </button>
            </div>

            <div className="relative mt-4 flex flex-col gap-3 sm:flex-row">
              <Button href={contact.pricingHref} size="lg" className="flex-1">
                Email our team <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              </Button>
              <Button href={contact.demoHref} size="lg" className="flex-1 border border-white/20 bg-white/10 text-white shadow-none hover:bg-white/20 hover:shadow-none">
                <CalendarDays className="h-4 w-4" /> Book a demo
              </Button>
            </div>

            <p className="relative mt-5 flex items-center gap-2 text-caption text-ink-400">
              <Clock className="h-3.5 w-3.5" /> {contact.responseTime}
            </p>
          </motion.div>
        </motion.div>
      </div>
    </section>
  )
}
