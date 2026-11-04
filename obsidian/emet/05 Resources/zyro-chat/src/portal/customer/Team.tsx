import { useState } from 'react'
import { Check, Plus } from 'lucide-react'
import { agents } from '../../data/agents'
import { AgentAvatar } from '../../components/ui/AgentAvatar'
import { AgentModal } from '../../components/agents/AgentModal'
import { usePortal } from '../store'
import { verticals } from '../data'
import { Card } from '../ui'
import { cn } from '../../lib/cn'

export function TeamView({ businessId }: { businessId: string }) {
  const { businesses, toast } = usePortal()
  const biz = businesses.find((b) => b.id === businessId)!
  const main = verticals[biz.vertical].agent
  const [hired, setHired] = useState<string[]>([main, 'aria', 'otto', 'nova'].filter((v, i, a) => a.indexOf(v) === i))
  const [open, setOpen] = useState<string | null>(null)
  return (
    <>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {agents.map((a) => {
          const on = hired.includes(a.id)
          return (
            <Card key={a.id} className={cn('flex items-center gap-3 p-4', on && 'border-brand-200')}>
              <button onClick={() => setOpen(a.id)} className="flex min-w-0 flex-1 items-center gap-3 text-left">
                <AgentAvatar id={a.id} name={a.name} size={52} />
                <div className="min-w-0">
                  <p className="text-body-sm font-semibold text-ink-900">{a.name} {a.id === main && <span className="ml-1 rounded bg-brand-50 px-1.5 py-0.5 text-[0.62rem] font-semibold text-brand-700">Inbox lead</span>}</p>
                  <p className="truncate text-caption text-ink-500">{a.role}</p>
                  <p className="text-caption font-medium text-brand-600">Open workspace →</p>
                </div>
              </button>
              <button
                onClick={() => {
                  setHired(on ? hired.filter((x) => x !== a.id) : [...hired, a.id])
                  toast({ title: on ? `${a.name} paused` : `${a.name} joined your team`, tone: on ? 'warn' : 'success' })
                }}
                className={cn('inline-flex h-8 shrink-0 items-center gap-1 rounded-lg px-2.5 text-caption font-semibold', on ? 'bg-success/10 text-success' : 'border border-ink-200 text-ink-700 hover:border-brand-300')}
              >
                {on ? <><Check className="h-3.5 w-3.5" /> Active</> : <><Plus className="h-3.5 w-3.5" /> Add</>}
              </button>
            </Card>
          )
        })}
      </div>
      <AgentModal id={open} onClose={() => setOpen(null)} onNavigate={setOpen} />
    </>
  )
}
