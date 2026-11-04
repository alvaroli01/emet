import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { ArrowUp, Check, CheckCircle2, PencilLine, Sparkles } from 'lucide-react'
import type { Agent, AgentTask, Deliverable as D } from '../../data/agents'
import { AgentAvatar } from '../ui/AgentAvatar'
import { Deliverable } from './Deliverable'
import { ease } from '../../lib/motion'
import { cn } from '../../lib/cn'

/**
 * Interactive (mock) chat with an AI employee. Suggested tasks return
 * scripted, realistic work; free text is matched to the closest task by
 * keywords, or answered with the agent's plan. No backend needed.
 */
type Msg =
  | { id: number; from: 'user'; text: string }
  | { id: number; from: 'ai'; text: string; deliverable?: D; actionable?: boolean }
  | { id: number; from: 'system'; text: string }

let uid = 0

function matchTask(agent: Agent, text: string): AgentTask | null {
  const q = text.toLowerCase()
  let best: AgentTask | null = null
  let bestScore = 0
  for (const t of agent.tasks) {
    const score = t.keywords.reduce((s, k) => s + (q.includes(k) ? k.length : 0), 0)
    if (score > bestScore) {
      best = t
      bestScore = score
    }
  }
  return best
}

/** Reveals text word by word, like a streamed model response */
function Streamed({ text, onDone, instant }: { text: string; onDone: () => void; instant: boolean }) {
  const words = text.split(' ')
  const [n, setN] = useState(instant ? words.length : 0)
  const done = useRef(false)
  useEffect(() => {
    if (n >= words.length) {
      if (!done.current) {
        done.current = true
        onDone()
      }
      return
    }
    const id = window.setTimeout(() => setN((x) => x + 1), 28)
    return () => clearTimeout(id)
  }, [n, words.length, onDone])
  return <>{words.slice(0, n).join(' ')}</>
}

export function AgentChat({ agent }: { agent: Agent }) {
  const reduced = !!useReducedMotion()
  const [msgs, setMsgs] = useState<Msg[]>([])
  const [typing, setTyping] = useState(false)
  const [streamingId, setStreamingId] = useState<number | null>(null)
  const [revealed, setRevealed] = useState<Set<number>>(new Set())
  const [input, setInput] = useState('')
  const scroller = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const timers = useRef<number[]>([])

  // Reset when the agent changes
  useEffect(() => {
    timers.current.forEach(clearTimeout)
    const hello: Msg = {
      id: ++uid,
      from: 'ai',
      text: `Hi, I’m ${agent.name} 👋 ${agent.tagline} Pick a task below or ask me anything.`,
    }
    setMsgs([hello])
    setRevealed(new Set([hello.id]))
    setTyping(false)
    setStreamingId(null)
    setInput('')
    return () => timers.current.forEach(clearTimeout)
  }, [agent])

  useEffect(() => {
    const el = scroller.current
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: reduced ? 'auto' : 'smooth' })
  }, [msgs, typing, revealed, reduced])

  const busy = typing || streamingId !== null

  const send = (text: string) => {
    const clean = text.trim()
    if (!clean || busy) return
    setInput('')
    const task = agent.tasks.find((t) => t.prompt === clean || t.label === clean) ?? matchTask(agent, clean)
    const userMsg: Msg = { id: ++uid, from: 'user', text: clean }
    setMsgs((m) => [...m, userMsg])
    setTyping(true)
    const reply: Msg = task
      ? { id: ++uid, from: 'ai', text: task.reply, deliverable: task.deliverable, actionable: !!task.deliverable }
      : {
          id: ++uid,
          from: 'ai',
          text: `On it. Here’s how I’ll handle “${clean.length > 60 ? clean.slice(0, 57) + '…' : clean}”:`,
          deliverable: { kind: 'checklist', title: 'My plan', items: agent.fallback.map((s) => ({ text: s })) },
          actionable: true,
        }
    timers.current.push(
      window.setTimeout(() => {
        setTyping(false)
        setMsgs((m) => [...m, reply])
        setStreamingId(reply.id)
      }, reduced ? 0 : 1100 + Math.random() * 500),
    )
  }

  const act = (msgId: number, approve: boolean) => {
    const follow: Msg = approve
      ? { id: ++uid, from: 'system', text: `Approved. ${agent.name} completed the task and logged it in your workspace.` }
      : { id: ++uid, from: 'ai', text: 'Sure. What should I change? Tell me and I’ll revise it.' }
    setMsgs((m) => m.map((x) => (x.id === msgId && x.from === 'ai' ? { ...x, actionable: false } : x)).concat(follow))
    if (!approve) inputRef.current?.focus()
  }

  const usedPrompts = new Set(msgs.filter((m) => m.from === 'user').map((m) => m.text))
  const suggestions = agent.tasks.filter((t) => !usedPrompts.has(t.prompt))

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div ref={scroller} className="no-scrollbar min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-5 sm:px-5" aria-live="polite">
        {msgs.map((m) => {
          if (m.from === 'system')
            return (
              <motion.div key={m.id} initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} className="flex justify-center">
                <span className="inline-flex items-center gap-1.5 rounded-full border border-success/25 bg-success/5 px-3 py-1.5 text-caption font-medium text-success">
                  <CheckCircle2 className="h-3.5 w-3.5" /> {m.text}
                </span>
              </motion.div>
            )
          if (m.from === 'user')
            return (
              <motion.div key={m.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, ease }} className="flex justify-end">
                <div className="max-w-[85%] rounded-2xl rounded-br-md bg-brand-500 px-4 py-2.5 text-body-sm text-white shadow-[0_6px_16px_-6px_rgb(var(--brand-500)/0.6)]">
                  {m.text}
                </div>
              </motion.div>
            )
          const isStreaming = streamingId === m.id
          const showExtras = revealed.has(m.id)
          return (
            <motion.div key={m.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, ease }} className="flex items-start gap-2.5">
              <AgentAvatar id={agent.id} size={30} rounded="rounded-xl" />
              <div className="min-w-0 max-w-[88%] flex-1">
                <div className="inline-block rounded-2xl rounded-tl-md border border-ink-200/70 bg-ink-0 px-4 py-2.5 text-body-sm text-ink-800 shadow-card">
                  {isStreaming ? (
                    <Streamed
                      text={m.text}
                      instant={reduced}
                      onDone={() => {
                        setStreamingId(null)
                        setRevealed((r) => new Set(r).add(m.id))
                      }}
                    />
                  ) : (
                    m.text
                  )}
                </div>
                {m.deliverable && showExtras && (
                  <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, ease }} className="mt-2 max-w-sm">
                    <Deliverable d={m.deliverable} />
                    {m.actionable && (
                      <div className="mt-2 flex gap-2">
                        <button
                          onClick={() => act(m.id, true)}
                          className="inline-flex items-center gap-1.5 rounded-full bg-ink-950 px-3 py-1.5 text-caption font-medium text-white transition-transform hover:-translate-y-px"
                        >
                          <Check className="h-3 w-3" /> Approve & run
                        </button>
                        <button
                          onClick={() => act(m.id, false)}
                          className="inline-flex items-center gap-1.5 rounded-full border border-ink-200 bg-ink-0 px-3 py-1.5 text-caption font-medium text-ink-700 hover:border-brand-300 hover:text-brand-600"
                        >
                          <PencilLine className="h-3 w-3" /> Revise
                        </button>
                      </div>
                    )}
                  </motion.div>
                )}
              </div>
            </motion.div>
          )
        })}

        <AnimatePresence>
          {typing && (
            <motion.div key="typing" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="flex items-center gap-2.5">
              <AgentAvatar id={agent.id} size={30} rounded="rounded-xl" />
              <div className="flex items-center gap-2 rounded-2xl rounded-tl-md border border-ink-200/70 bg-ink-0 px-4 py-3 shadow-card">
                {[0, 1, 2].map((i) => (
                  <motion.span
                    key={i}
                    className="h-1.5 w-1.5 rounded-full bg-brand-400"
                    animate={{ y: [0, -4, 0], opacity: [0.5, 1, 0.5] }}
                    transition={{ duration: 0.9, repeat: Infinity, delay: i * 0.15 }}
                  />
                ))}
                <span className="text-caption text-ink-400">{agent.name} is working…</span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Suggested tasks */}
      {suggestions.length > 0 && (
        <div className="no-scrollbar flex gap-2 overflow-x-auto border-t border-ink-100 px-4 pt-3 sm:px-5">
          <span className="flex shrink-0 items-center gap-1 text-caption text-ink-400">
            <Sparkles className="h-3 w-3" /> Try:
          </span>
          {suggestions.map((t) => (
            <button
              key={t.label}
              disabled={busy}
              onClick={() => send(t.prompt)}
              className="shrink-0 rounded-full border border-brand-200 bg-brand-50/60 px-3 py-1.5 text-caption font-medium text-brand-700 transition-colors hover:border-brand-400 hover:bg-brand-50 disabled:opacity-50"
            >
              {t.label}
            </button>
          ))}
        </div>
      )}

      {/* Composer */}
      <form
        onSubmit={(e) => {
          e.preventDefault()
          send(input)
        }}
        className="p-3 sm:p-4"
      >
        <div className="flex items-center gap-2 rounded-2xl border border-ink-200 bg-ink-0 py-1.5 pl-4 pr-1.5 shadow-card transition-colors focus-within:border-brand-400">
          <input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={`Ask ${agent.name} to do something…`}
            className="min-w-0 flex-1 bg-transparent text-body-sm text-ink-900 outline-none placeholder:text-ink-400"
            aria-label={`Message ${agent.name}`}
          />
          <button
            type="submit"
            disabled={!input.trim() || busy}
            aria-label="Send"
            className={cn(
              'grid h-9 w-9 shrink-0 place-items-center rounded-xl transition-colors',
              input.trim() && !busy ? 'bg-brand-500 text-white hover:bg-brand-600' : 'bg-ink-100 text-ink-400',
            )}
          >
            <ArrowUp className="h-4 w-4" />
          </button>
        </div>
        <p className="mt-2 text-center text-[0.65rem] text-ink-400">Demo workspace with sample data. Connect your tools to run it on your business.</p>
      </form>
    </div>
  )
}
