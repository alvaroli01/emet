import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Check, Loader2, Lock, Plug, ShieldCheck, Unplug } from 'lucide-react'
import { usePortal } from '../store'
import { integrations, type Integration, type IntegrationCategory } from '../data'
import { Btn, Card } from '../ui'
import { cn } from '../../lib/cn'

const order: IntegrationCategory[] = ['Messaging & social', 'Ads & lead forms', 'Calls', 'Bookings & sheets', 'Commerce & industry']

function ConnectFlow({ integ, businessName, onDone, onCancel }: { integ: Integration; businessName: string; onDone: () => void; onCancel: () => void }) {
  const steps = [`Opening ${integ.name} secure sign-in`, `${businessName} approved access`, integ.channel ? 'Importing the last 30 days of messages' : 'Syncing existing data', 'Turning on AI replies']
  const [i, setI] = useState(0)
  useEffect(() => {
    if (i >= steps.length) {
      const t = window.setTimeout(onDone, 500)
      return () => clearTimeout(t)
    }
    const t = window.setTimeout(() => setI(i + 1), 750)
    return () => clearTimeout(t)
  }, [i]) // eslint-disable-line react-hooks/exhaustive-deps
  const Icon = integ.icon
  return (
    <motion.div className="fixed inset-0 z-[70] !mt-0 grid place-items-center bg-ink-950/40 p-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <motion.div initial={{ scale: 0.96, y: 10 }} animate={{ scale: 1, y: 0 }} className="w-full max-w-sm rounded-2xl bg-ink-0 p-6 shadow-window">
        <div className="flex items-center gap-3">
          <span className="grid h-11 w-11 place-items-center rounded-xl text-white" style={{ background: integ.color }}>
            <Icon className="h-5 w-5" />
          </span>
          <div>
            <p className="text-body-md font-semibold text-ink-900">Connecting {integ.name}</p>
            <p className="flex items-center gap-1 text-caption text-ink-500"><Lock className="h-3 w-3" /> Secure OAuth, no passwords shared</p>
          </div>
        </div>
        <ul className="mt-5 space-y-2.5">
          {steps.map((s, k) => (
            <li key={s} className={cn('flex items-center gap-2.5 text-body-sm', k > i ? 'text-ink-400' : 'text-ink-800')}>
              {k < i ? (
                <span className="grid h-5 w-5 place-items-center rounded-full bg-success text-white"><Check className="h-3 w-3" strokeWidth={3} /></span>
              ) : k === i ? (
                <Loader2 className="h-5 w-5 animate-spin text-brand-500" />
              ) : (
                <span className="h-5 w-5 rounded-full border border-ink-300" />
              )}
              {s}
            </li>
          ))}
        </ul>
        <button onClick={onCancel} className="mt-5 w-full text-center text-caption text-ink-400 hover:text-ink-700">Cancel</button>
      </motion.div>
    </motion.div>
  )
}

export function ConnectionsView({ businessId }: { businessId: string }) {
  const { businesses, toggleConnection } = usePortal()
  const biz = businesses.find((b) => b.id === businessId)!
  const [connecting, setConnecting] = useState<Integration | null>(null)
  const available = integrations.filter((i) => !i.only || i.only.includes(biz.vertical))
  const connectedCount = available.filter((i) => biz.connections[i.id]?.connected).length

  return (
    <div className="space-y-8">
      <Card className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-brand-50 text-brand-600"><Plug className="h-5 w-5" /></span>
        <div className="flex-1">
          <p className="text-body-md font-semibold text-ink-900">{connectedCount} of {available.length} connected</p>
          <p className="text-body-sm text-ink-500">Every connected channel flows into one inbox. The AI answers there, and every booking lands in your spreadsheet.</p>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-ink-100 sm:w-48">
          <motion.div className="h-full rounded-full bg-brand-gradient" animate={{ width: `${(connectedCount / available.length) * 100}%` }} />
        </div>
      </Card>

      {order.map((cat) => {
        const items = available.filter((i) => i.category === cat)
        if (!items.length) return null
        return (
          <section key={cat}>
            <h3 className="mb-3 text-body-sm font-semibold text-ink-700">{cat}</h3>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {items.map((i) => {
                const c = biz.connections[i.id]
                const Icon = i.icon
                return (
                  <Card key={i.id} className={cn('flex items-start gap-3 p-4 transition-colors', c?.connected && 'border-success/30')}>
                    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl text-white" style={{ background: i.color }}>
                      <Icon className="h-5 w-5" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="truncate text-body-sm font-semibold text-ink-900">{i.name}</p>
                        {c?.connected && <span className="h-2 w-2 shrink-0 rounded-full bg-success" />}
                      </div>
                      <p className="truncate text-caption text-ink-500">{c?.connected ? c.account : i.description}</p>
                      <div className="mt-3">
                        {c?.connected ? (
                          <Btn variant="ghost" className="-ml-2 h-8 text-caption" onClick={() => toggleConnection(biz.id, i.id)}>
                            <Unplug className="h-3.5 w-3.5" /> Disconnect
                          </Btn>
                        ) : (
                          <Btn variant="secondary" className="h-8 text-caption" onClick={() => setConnecting(i)}>
                            <Plug className="h-3.5 w-3.5" /> Connect
                          </Btn>
                        )}
                      </div>
                    </div>
                  </Card>
                )
              })}
            </div>
          </section>
        )
      })}

      <p className="flex items-center gap-2 text-caption text-ink-500">
        <ShieldCheck className="h-4 w-4 text-success" /> Zyro connects through each platform’s official login (OAuth). We never see or store your passwords, and you can revoke access at any time.
      </p>

      <AnimatePresence>
        {connecting && (
          <ConnectFlow
            integ={connecting}
            businessName={biz.name}
            onCancel={() => setConnecting(null)}
            onDone={() => {
              toggleConnection(biz.id, connecting.id)
              setConnecting(null)
            }}
          />
        )}
      </AnimatePresence>
    </div>
  )
}
