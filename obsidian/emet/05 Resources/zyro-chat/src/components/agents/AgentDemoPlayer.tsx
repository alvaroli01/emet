import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { Check, Loader2, Pause, Play, RotateCcw, Sparkles, Zap } from 'lucide-react'
import type { Agent } from '../../data/agents'
import { AgentAvatar } from '../ui/AgentAvatar'
import { Deliverable } from './Deliverable'
import { ease } from '../../lib/motion'
import { cn } from '../../lib/cn'

/**
 * A scripted, code-rendered "screen recording" of the agent doing its job.
 * Drawn at a fixed 640×420 stage and scaled to fit, so it looks identical
 * on every screen, like a real video. Driven by `agent.demo` data.
 */
const WIDE = { w: 640, h: 420 }
const TALL = { w: 360, h: 500 } // portrait stage for phones
const INTRO = 1800
const TRIGGER = 1900
const STEP = 1500
const STEP_WORK = 1150

function timeline(steps: number) {
  const stepsStart = TRIGGER + 1300
  const output = stepsStart + steps * STEP + 200
  const result = output + 2200
  const total = result + 3600
  return { stepsStart, output, result, total }
}

const fmt = (ms: number) => {
  const s = Math.floor(ms / 1000)
  return `0:${String(s).padStart(2, '0')}`
}

export function AgentDemoPlayer({ agent, autoPlay = true }: { agent: Agent; autoPlay?: boolean }) {
  const reduced = useReducedMotion()
  const { demo } = agent
  const tl = timeline(demo.steps.length)
  const [t, setT] = useState(reduced ? tl.total - 1 : 0)
  const [playing, setPlaying] = useState(autoPlay && !reduced)
  const last = useRef<number | null>(null)
  const wrap = useRef<HTMLDivElement>(null)
  const [box, setBox] = useState({ width: 640, compact: false })

  // Fit the fixed stage to the container width
  useLayoutEffect(() => {
    const el = wrap.current
    if (!el) return
    const ro = new ResizeObserver(([e]) => setBox({ width: e.contentRect.width, compact: e.contentRect.width < 480 }))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // Playback clock (loops)
  useEffect(() => {
    if (!playing) {
      last.current = null
      return
    }
    let raf = 0
    const tick = (now: number) => {
      if (last.current !== null) {
        const dt = now - last.current
        setT((prev) => (prev + dt >= tl.total ? 0 : prev + dt))
      }
      last.current = now
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [playing, tl.total])

  // Restart when switching agents
  useEffect(() => {
    setT(reduced ? tl.total - 1 : 0)
    setPlaying(autoPlay && !reduced)
  }, [agent.id]) // eslint-disable-line react-hooks/exhaustive-deps

  const seek = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const r = e.currentTarget.getBoundingClientRect()
      setT(Math.max(0, Math.min(tl.total - 1, ((e.clientX - r.left) / r.width) * tl.total)))
    },
    [tl.total],
  )

  const stage = box.compact ? TALL : WIDE
  const scale = box.width / stage.w
  const showIntro = t < INTRO
  const showTrigger = t >= TRIGGER
  const stepState = (i: number) => {
    const s = tl.stepsStart + i * STEP
    if (t < s) return 'pending'
    if (t < s + STEP_WORK) return 'working'
    return 'done'
  }
  const showOutput = t >= tl.output
  const showResult = t >= tl.result
  // Caption follows the most recently started step
  const activeStep = demo.steps.reduce((acc, _, i) => (stepState(i) !== 'pending' ? i : acc), -1)

  const caption = showIntro
    ? `Meet ${agent.name}, your ${agent.role}`
    : showResult
      ? demo.result
      : showOutput
        ? `${agent.name} delivers the finished work`
        : activeStep >= 0
          ? `${demo.steps[activeStep]}…`
          : showTrigger
            ? `${agent.name} picks up a new task from ${demo.trigger.app}`
            : ''

  return (
    <div className="overflow-hidden rounded-2xl border border-ink-200/80 bg-ink-950 shadow-window">
      {/* Stage */}
      <div ref={wrap} className="relative w-full overflow-hidden" style={{ height: stage.h * scale }}>
        <div
          className="absolute left-0 top-0 origin-top-left bg-ink-25"
          style={{ width: stage.w, height: stage.h, transform: `scale(${scale})` }}
          onClick={() => setPlaying((p) => !p)}
        >
          {/* App chrome */}
          <div className="flex h-10 items-center gap-2.5 border-b border-ink-200/70 bg-ink-0 px-4">
            <AgentAvatar id={agent.id} size={22} rounded="rounded-md" />
            <span className="text-[0.8rem] font-semibold text-ink-900">{agent.name}</span>
            <span className="text-[0.75rem] text-ink-400">· {agent.role}</span>
            <span className="ml-auto inline-flex items-center gap-1.5 rounded-full bg-success/10 px-2 py-0.5 text-[0.65rem] font-semibold text-success">
              <span className="h-1.5 w-1.5 animate-pulse-dot rounded-full bg-success" /> Working
            </span>
          </div>

          <div className={cn('grid h-[calc(100%-2.5rem)] gap-4 p-4', box.compact ? 'grid-cols-1 content-start gap-3' : 'grid-cols-[250px_1fr]')}>
            {/* Left: trigger + steps (on phones, steps give way to the output) */}
            <div className={cn('flex flex-col gap-3', box.compact && showOutput && 'hidden')}>
              <AnimatePresence>
                {showTrigger && (
                  <motion.div
                    key="trigger"
                    initial={{ opacity: 0, x: -16, scale: 0.97 }}
                    animate={{ opacity: 1, x: 0, scale: 1 }}
                    transition={{ duration: 0.5, ease }}
                    className="rounded-xl border border-ink-200/80 bg-ink-0 p-3 shadow-card"
                  >
                    <span className="inline-flex items-center gap-1 rounded-md bg-brand-50 px-1.5 py-0.5 text-[0.6rem] font-semibold uppercase tracking-wider text-brand-600">
                      <Zap className="h-2.5 w-2.5" /> {demo.trigger.app}
                    </span>
                    <p className="mt-1.5 text-[0.75rem] font-semibold text-ink-900">{demo.trigger.title}</p>
                    <p className="mt-0.5 text-[0.7rem] leading-snug text-ink-600">{demo.trigger.body}</p>
                  </motion.div>
                )}
              </AnimatePresence>

              <div className="space-y-1.5">
                {demo.steps.map((s, i) => {
                  const st = stepState(i)
                  return (
                    <motion.div
                      key={s}
                      animate={{ opacity: st === 'pending' ? 0.35 : 1 }}
                      className={cn(
                        'flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-[0.7rem] transition-colors',
                        st === 'working' ? 'bg-brand-50 text-brand-700 ring-1 ring-brand-200' : 'text-ink-700',
                      )}
                    >
                      {st === 'done' ? (
                        <span className="grid h-4 w-4 shrink-0 place-items-center rounded-full bg-success text-white">
                          <Check className="h-2.5 w-2.5" strokeWidth={3} />
                        </span>
                      ) : st === 'working' ? (
                        <Loader2 className="h-4 w-4 shrink-0 animate-spin text-brand-500" />
                      ) : (
                        <span className="h-4 w-4 shrink-0 rounded-full border border-ink-300" />
                      )}
                      <span className="leading-tight">{s}</span>
                    </motion.div>
                  )
                })}
              </div>
            </div>

            {/* Right: output */}
            <div className={cn('relative', box.compact && !showOutput && 'hidden', box.compact && 'min-h-[380px]')}>
              <AnimatePresence mode="wait">
                {showOutput ? (
                  <motion.div key="out" initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease }}>
                    <Deliverable d={demo.output} />
                  </motion.div>
                ) : (
                  <motion.div
                    key="wait"
                    exit={{ opacity: 0 }}
                    className="flex h-full flex-col gap-2 rounded-xl border border-dashed border-ink-200 p-4"
                  >
                    <p className="flex items-center gap-1.5 text-[0.7rem] text-ink-400">
                      <Sparkles className="h-3 w-3" /> {showTrigger ? 'Preparing output…' : 'Waiting for a task'}
                    </p>
                    {[80, 95, 60, 88, 70].map((w, i) => (
                      <div
                        key={i}
                        style={{ width: `${w}%` }}
                        className="h-2.5 rounded-full bg-[linear-gradient(90deg,rgb(var(--ink-100)),rgb(var(--ink-50)),rgb(var(--ink-100)))] bg-[length:200%_100%] animate-shimmer"
                      />
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>

              <AnimatePresence>
                {showResult && (
                  <motion.div
                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    transition={{ type: 'spring', stiffness: 260, damping: 20 }}
                    className={cn('absolute right-0 flex items-center gap-2 rounded-xl bg-ink-950 px-3 py-2 text-[0.7rem] font-medium text-white shadow-lift', box.compact ? 'bottom-2 left-0 justify-center' : '-bottom-1')}
                  >
                    <span className="grid h-5 w-5 place-items-center rounded-full bg-success">
                      <Check className="h-3 w-3" strokeWidth={3} />
                    </span>
                    {demo.result}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>

          {/* Intro title card */}
          <AnimatePresence>
            {showIntro && (
              <motion.div
                key="intro"
                initial={{ opacity: 1 }}
                exit={{ opacity: 0, scale: 1.03 }}
                transition={{ duration: 0.5 }}
                className="absolute inset-0 flex flex-col items-center justify-center bg-brand-gradient text-white"
              >
                <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ duration: 0.6, ease }}>
                  <AgentAvatar id={agent.id} size={104} rounded="rounded-[28px]" className="shadow-lift ring-4 ring-white/30" />
                </motion.div>
                <motion.p initial={{ y: 10, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.2, ease }} className="mt-4 font-display text-3xl font-semibold">
                  {agent.name}
                </motion.p>
                <motion.p initial={{ y: 10, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.3, ease }} className="text-sm text-white/80">
                  {agent.role} · live demo
                </motion.p>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Captions */}
          {caption && !showIntro && !showResult && (
            <div className="pointer-events-none absolute inset-x-0 bottom-3 flex justify-center">
              <motion.span
                key={caption}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                className="max-w-[80%] rounded-md bg-ink-950/80 px-3 py-1 text-center text-[0.72rem] text-white backdrop-blur"
              >
                {caption}
              </motion.span>
            </div>
          )}

          {/* Paused overlay */}
          {!playing && (
            <div className="absolute inset-0 grid place-items-center bg-ink-950/10">
              <span className="grid h-14 w-14 place-items-center rounded-full bg-ink-0/90 text-brand-600 shadow-lift">
                <Play className="ml-0.5 h-6 w-6 fill-current" />
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Video controls */}
      <div className="flex items-center gap-3 px-3 py-2.5 text-white">
        <button onClick={() => setPlaying((p) => !p)} aria-label={playing ? 'Pause demo' : 'Play demo'} className="grid h-7 w-7 place-items-center rounded-full hover:bg-white/10">
          {playing ? <Pause className="h-4 w-4 fill-current" /> : <Play className="h-4 w-4 fill-current" />}
        </button>
        <div className="group relative h-1.5 flex-1 cursor-pointer rounded-full bg-white/15" onClick={seek} role="slider" aria-label="Seek" aria-valuemin={0} aria-valuemax={tl.total} aria-valuenow={Math.round(t)}>
          <div className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-brand-400 to-ion-400" style={{ width: `${(t / tl.total) * 100}%` }} />
          <div className="absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white opacity-0 shadow transition-opacity group-hover:opacity-100" style={{ left: `${(t / tl.total) * 100}%` }} />
        </div>
        <span className="shrink-0 whitespace-nowrap text-right font-mono text-[0.68rem] tabular-nums text-white/70">
          {fmt(t)} / {fmt(tl.total)}
        </span>
        <button onClick={() => { setT(0); setPlaying(true) }} aria-label="Restart demo" className="grid h-7 w-7 place-items-center rounded-full hover:bg-white/10">
          <RotateCcw className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  )
}
