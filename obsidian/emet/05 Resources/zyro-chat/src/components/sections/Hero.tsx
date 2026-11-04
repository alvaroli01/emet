import { lazy, Suspense, useRef } from 'react'
import { motion, useInView } from 'framer-motion'
import { ArrowRight, CheckCircle2, PlayCircle, Sparkles, TrendingUp } from 'lucide-react'
import { contact, hero } from '../../data/content'
import { Button } from '../ui/Button'
import { ease, fadeUp, stagger } from '../../lib/motion'
import { useCan3D } from '../../hooks/useCan3D'
import { useCountUp } from '../../hooks/useCountUp'
import { StaticOrb } from '../three/StaticOrb'

// The 3D scene is code-split so text + CTAs paint before three.js downloads
const NeuralNetwork = lazy(() => import('../three/NeuralNetwork'))

function Stat({ value, suffix, label, start }: { value: number; suffix: string; label: string; start: boolean }) {
  const n = useCountUp(value, start)
  return (
    <div className="flex flex-col gap-1 px-4 py-4 sm:px-6">
      <span className="font-display text-display-sm font-semibold tabular-nums text-ink-900">
        {n.toLocaleString('en-US')}
        <span className="text-brand-500">{suffix}</span>
      </span>
      <span className="text-body-sm text-ink-500">{label}</span>
    </div>
  )
}

function FloatingChip({
  className,
  delay,
  icon,
  title,
  meta,
}: {
  className: string
  delay: number
  icon: React.ReactNode
  title: string
  meta: string
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ delay, duration: 0.8, ease }}
      className={`glass pointer-events-none absolute z-10 hidden items-center gap-3 rounded-2xl px-3.5 py-2.5 shadow-lift sm:flex ${className}`}
    >
      <span className="grid h-8 w-8 place-items-center rounded-xl bg-brand-50 text-brand-600">{icon}</span>
      <span className="flex flex-col">
        <span className="text-body-sm font-medium text-ink-900">{title}</span>
        <span className="text-caption text-ink-500">{meta}</span>
      </span>
    </motion.div>
  )
}

export function Hero() {
  const can3D = useCan3D()
  const statsRef = useRef<HTMLDivElement>(null)
  const statsInView = useInView(statsRef, { once: true, margin: '-40px' })

  return (
    <section id="top" className="relative overflow-hidden pt-[calc(var(--nav-h)+2.5rem)] sm:pt-[calc(var(--nav-h)+4rem)]">
      {/* Atmosphere: faint grid + slow-drifting colour fields (CSS only, GPU-cheap) */}
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute inset-0 bg-grid-faint bg-[size:56px_56px] [mask-image:radial-gradient(ellipse_70%_60%_at_60%_30%,#000_30%,transparent_75%)]" />
        <div className="absolute -right-[10%] -top-[20%] h-[42rem] w-[42rem] animate-drift rounded-full bg-brand-400/25 blur-[120px]" />
        <div className="absolute -left-[15%] top-[25%] h-[30rem] w-[30rem] animate-drift rounded-full bg-ion-400/20 blur-[110px] [animation-delay:-9s]" />
      </div>

      <div className="container grid items-center gap-10 lg:grid-cols-[1.05fr_1fr] lg:gap-6">
        <motion.div variants={stagger(0.09, 0.15)} initial="hidden" animate="show" className="relative z-10">
          <motion.a variants={fadeUp} href="#employees" className="eyebrow group">
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-ion-500 opacity-70" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-ion-500" />
            </span>
            {hero.eyebrow}
            <ArrowRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5" />
          </motion.a>

          <h1 className="mt-6 text-display-xl font-semibold text-balance">
            <motion.span variants={fadeUp} className="block">
              {hero.headline[0]}
            </motion.span>
            <motion.span variants={fadeUp} className="text-gradient block pb-1">
              {hero.headline[1]}
            </motion.span>
          </h1>

          <motion.p variants={fadeUp} className="mt-6 max-w-xl text-body-lg text-ink-500 text-pretty">
            {hero.sub}
          </motion.p>

          <motion.div variants={fadeUp} className="mt-9 flex flex-col gap-3 sm:flex-row">
            <Button href={contact.demoHref} size="lg">
              {hero.primaryCta}
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </Button>
            <Button href="#employees" size="lg" variant="secondary">
              <PlayCircle className="h-4 w-4" />
              {hero.secondaryCta}
            </Button>
          </motion.div>

          <motion.p variants={fadeUp} className="mt-5 flex items-center gap-2 text-body-sm text-ink-500">
            <CheckCircle2 className="h-4 w-4 text-success" /> Guided onboarding · Live within a week · SOC 2 Type II
          </motion.p>
        </motion.div>

        {/* 3D visual */}
        <motion.div
          initial={{ opacity: 0, scale: 0.94 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 1.2, ease, delay: 0.2 }}
          className="relative mx-auto aspect-square w-full max-w-[34rem] lg:max-w-none"
        >
          <div aria-hidden className="absolute inset-[12%] rounded-full bg-gradient-to-br from-brand-300/40 via-brand-100/10 to-ion-300/30 blur-3xl" />
          {can3D ? (
            <Suspense fallback={<StaticOrb />}>
              <NeuralNetwork />
            </Suspense>
          ) : (
            <StaticOrb />
          )}

          <FloatingChip
            className="left-0 top-[14%] lg:-left-6"
            delay={1.1}
            icon={<CheckCircle2 className="h-4 w-4" />}
            title="Aria resolved #4821"
            meta="38 seconds · CSAT 5/5"
          />
          <FloatingChip
            className="right-0 top-[48%] lg:-right-2"
            delay={1.35}
            icon={<Sparkles className="h-4 w-4" />}
            title="Nova scheduled 14 posts"
            meta="Instagram · TikTok · LinkedIn"
          />
          <FloatingChip
            className="bottom-[8%] left-[8%]"
            delay={1.6}
            icon={<TrendingUp className="h-4 w-4" />}
            title="Kai: ROAS up 27%"
            meta="Weekly report ready"
          />
        </motion.div>
      </div>

      {/* Stat strip */}
      <div className="container relative z-10 mt-10 lg:mt-4">
        <motion.div
          ref={statsRef}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7, duration: 0.8, ease }}
          className="glass grid grid-cols-2 divide-ink-200/70 rounded-2xl shadow-card md:grid-cols-4 md:divide-x [&>*:nth-child(-n+2)]:border-b [&>*:nth-child(-n+2)]:border-ink-200/70 md:[&>*:nth-child(-n+2)]:border-b-0 [&>*:nth-child(odd)]:border-r [&>*:nth-child(odd)]:border-ink-200/70 md:[&>*:nth-child(odd)]:border-r-0"
        >
          {hero.stats.map((s) => (
            <Stat key={s.label} {...s} start={statsInView} />
          ))}
        </motion.div>
        <p className="mt-3 text-center text-caption text-ink-400 md:text-right">{hero.disclaimer}</p>
      </div>
    </section>
  )
}
