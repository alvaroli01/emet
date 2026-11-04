import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import {
  AlertTriangle,
  ArrowLeft,
  Building2,
  CalendarCheck,
  Check,
  Copy,
  ExternalLink,
  Inbox,
  KeyRound,
  LayoutDashboard,
  MessageSquare,
  Plug,
  Plus,
  Search,
  ShieldCheck,
  X,
} from 'lucide-react'
import { usePortal } from '../store'
import { dayKey, integrations, uid, verticals, withDefaultConnections, type Business, type Vertical } from '../data'
import { go } from '../router'
import { Shell } from '../Shell'
import { Btn, Card, PageHeader, StatCard } from '../ui'
import { InboxView } from '../customer/Inbox'
import { BookingsView } from '../customer/Bookings'
import { ConnectionsView } from '../customer/Connections'
import { SettingsView } from '../customer/Settings'
import { OverviewView } from '../customer/Overview'
import { CallsView } from '../customer/Calls'
import { cn } from '../../lib/cn'

/* ------------------------------------------------------------------ */

function useClientStats() {
  const { businesses, conversations, bookings } = usePortal()
  const today = dayKey(0)
  return businesses.map((b) => {
    const convs = conversations.filter((c) => c.businessId === b.id)
    const conns = integrations.filter((i) => b.connections[i.id]?.connected).length
    const needs = convs.filter((c) => c.status === 'needs_you').length
    return {
      b,
      conns,
      msgs: convs.reduce((n, c) => n + c.messages.length, 0) * 3,
      bookings: bookings.filter((x) => x.businessId === b.id && x.date >= today && x.status !== 'Cancelled').length,
      needs,
      health: conns === 0 ? 'Not set up' : needs > 0 ? `${needs} need attention` : 'Healthy',
    }
  })
}

function openAsClient(dispatch: ReturnType<typeof usePortal>['dispatch'], id: string) {
  dispatch({ type: 'setBusinessView', businessId: id })
  go('app/overview')
}

/* ------------------------------------------------------------------ */

function AddClientModal({ onClose }: { onClose: () => void }) {
  const { dispatch, toast } = usePortal()
  const [f, setF] = useState({ name: '', vertical: 'restaurant' as Vertical, city: '', contactName: '', email: '', plan: 'Growth' })
  const [created, setCreated] = useState<{ biz: Business; password: string } | null>(null)
  const [copied, setCopied] = useState(false)
  const input = 'mt-1.5 h-10 w-full rounded-xl border border-ink-200 bg-ink-0 px-3 text-body-sm outline-none focus:border-brand-400'

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    const slug = f.name.toLowerCase().replace(/[^a-z0-9]/g, '') || 'newclient'
    const biz = withDefaultConnections({
      id: uid('biz'),
      name: f.name || 'New client',
      slug,
      vertical: f.vertical,
      city: f.city || 'New York, NY',
      address: '',
      phone: '',
      hours: `${verticals[f.vertical].open}:00–${verticals[f.vertical].close}:00`,
      contactName: f.contactName || 'Owner',
      loginEmail: f.email || `owner@${slug}.com`,
      plan: f.plan,
      autopilot: true,
      tone: 'Friendly and professional',
      connections: {},
      createdAt: Date.now(),
    })
    const password = `zyro-${Math.random().toString(36).slice(2, 6)}-${Math.random().toString(36).slice(2, 6)}`
    dispatch({ type: 'addBusiness', business: biz })
    toast({ title: `${biz.name} onboarded`, body: 'Customer login created. Connect their accounts next.', tone: 'success' })
    setCreated({ biz, password })
  }

  return (
    <motion.div className="fixed inset-0 z-[70] !mt-0 grid place-items-center bg-ink-950/40 p-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
      <motion.div onClick={(e) => e.stopPropagation()} initial={{ y: 20, scale: 0.98 }} animate={{ y: 0, scale: 1 }} className="w-full max-w-lg rounded-2xl bg-ink-0 p-5 shadow-window sm:p-6">
        <div className="flex items-center justify-between">
          <h3 className="text-body-lg font-semibold">{created ? 'Client ready' : 'Add a new client'}</h3>
          <button onClick={onClose} className="text-ink-400 hover:text-ink-800" aria-label="Close"><X className="h-5 w-5" /></button>
        </div>
        {!created ? (
          <form onSubmit={submit} className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="text-caption font-medium text-ink-600 sm:col-span-2">Business name<input required className={input} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="e.g. Bella Vista Trattoria" /></label>
            <label className="text-caption font-medium text-ink-600">Business type
              <select className={input} value={f.vertical} onChange={(e) => setF({ ...f, vertical: e.target.value as Vertical })}>
                {Object.entries(verticals).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
              </select>
            </label>
            <label className="text-caption font-medium text-ink-600">City<input className={input} value={f.city} onChange={(e) => setF({ ...f, city: e.target.value })} placeholder="Miami, FL" /></label>
            <label className="text-caption font-medium text-ink-600">Owner name<input className={input} value={f.contactName} onChange={(e) => setF({ ...f, contactName: e.target.value })} /></label>
            <label className="text-caption font-medium text-ink-600">Owner email (their login)<input type="email" className={input} value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></label>
            <label className="text-caption font-medium text-ink-600 sm:col-span-2">Plan
              <select className={input} value={f.plan} onChange={(e) => setF({ ...f, plan: e.target.value })}>
                <option>Starter</option><option>Growth</option><option>Scale</option><option>Custom</option>
              </select>
            </label>
            <div className="mt-2 flex justify-end gap-2 sm:col-span-2">
              <Btn variant="ghost" onClick={onClose}>Cancel</Btn>
              <Btn type="submit"><KeyRound className="h-4 w-4" /> Create client & login</Btn>
            </div>
          </form>
        ) : (
          <div className="mt-4">
            <p className="text-body-sm text-ink-600">Send these login details to <strong>{created.biz.contactName}</strong>. They’ll be asked to set a new password on first login.</p>
            <div className="mt-4 space-y-2 rounded-xl border border-ink-200 bg-ink-50 p-4 font-mono text-caption">
              <p><span className="text-ink-400">Login:</span> {window.location.origin}{window.location.pathname}#/login</p>
              <p><span className="text-ink-400">Email:</span> {created.biz.loginEmail}</p>
              <p><span className="text-ink-400">Temporary password:</span> {created.password}</p>
            </div>
            <div className="mt-5 flex flex-wrap justify-end gap-2">
              <Btn
                variant="secondary"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(`Zyro Chat login\nEmail: ${created.biz.loginEmail}\nTemporary password: ${created.password}`)
                  } catch { /* ignore */ }
                  setCopied(true)
                }}
              >
                {copied ? <Check className="h-4 w-4 text-success" /> : <Copy className="h-4 w-4" />} {copied ? 'Copied' : 'Copy details'}
              </Btn>
              <Btn onClick={() => { onClose(); go(`admin/clients/${created.biz.id}/connections`) }}><Plug className="h-4 w-4" /> Connect their accounts</Btn>
            </div>
          </div>
        )}
      </motion.div>
    </motion.div>
  )
}

/* ------------------------------------------------------------------ */

function ClientsTable({ compact = false }: { compact?: boolean }) {
  const { dispatch } = usePortal()
  const stats = useClientStats()
  const [q, setQ] = useState('')
  const [vf, setVf] = useState<Vertical | 'all'>('all')
  const rows = stats.filter(({ b }) => (vf === 'all' || b.vertical === vf) && b.name.toLowerCase().includes(q.toLowerCase()))
  return (
    <Card className="overflow-hidden">
      {!compact && (
        <div className="flex flex-col gap-2 border-b border-ink-200/70 p-3 sm:flex-row">
          <div className="flex h-10 flex-1 items-center gap-2 rounded-xl border border-ink-200 px-3">
            <Search className="h-4 w-4 text-ink-400" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search clients" className="min-w-0 flex-1 bg-transparent text-body-sm outline-none" />
          </div>
          <select value={vf} onChange={(e) => setVf(e.target.value as Vertical | 'all')} className="h-10 rounded-xl border border-ink-200 bg-ink-0 px-3 text-body-sm">
            <option value="all">All industries</option>
            {Object.entries(verticals).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
        </div>
      )}
      <div className="no-scrollbar overflow-x-auto">
        <table className="w-full min-w-[820px] text-body-sm">
          <thead>
            <tr className="border-b border-ink-200/70 bg-ink-50 text-left text-caption text-ink-500">
              <th className="px-4 py-2.5 font-medium">Business</th>
              <th className="px-4 py-2.5 font-medium">Plan</th>
              <th className="px-4 py-2.5 font-medium">Channels</th>
              <th className="px-4 py-2.5 font-medium">Messages (7d)</th>
              <th className="px-4 py-2.5 font-medium">Upcoming bookings</th>
              <th className="px-4 py-2.5 font-medium">Status</th>
              <th className="px-4 py-2.5" />
            </tr>
          </thead>
          <tbody>
            {rows.map(({ b, conns, msgs, bookings, health, needs }) => {
              const V = verticals[b.vertical]
              const Icon = V.icon
              return (
                <tr key={b.id} className="cursor-pointer border-b border-ink-100 hover:bg-ink-50" onClick={() => go(`admin/clients/${b.id}`)}>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-brand-50 text-brand-600"><Icon className="h-4 w-4" /></span>
                      <div>
                        <p className="font-semibold text-ink-900">{b.name}</p>
                        <p className="text-caption text-ink-500">{V.label} · {b.city}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-ink-700">{b.plan}</td>
                  <td className="px-4 py-3 tabular-nums text-ink-700">{conns}</td>
                  <td className="px-4 py-3 tabular-nums text-ink-700">{msgs}</td>
                  <td className="px-4 py-3 tabular-nums text-ink-700">{bookings}</td>
                  <td className="px-4 py-3">
                    <span className={cn('inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[0.7rem] font-semibold', health === 'Healthy' ? 'bg-success/10 text-success' : needs ? 'bg-amber-50 text-amber-700' : 'bg-ink-100 text-ink-600')}>
                      <span className={cn('h-1.5 w-1.5 rounded-full', health === 'Healthy' ? 'bg-success' : needs ? 'bg-amber-500' : 'bg-ink-400')} /> {health}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        openAsClient(dispatch, b.id)
                      }}
                      className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-caption font-medium text-brand-600 hover:bg-brand-50"
                    >
                      Open dashboard <ExternalLink className="h-3 w-3" />
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </Card>
  )
}

/* ------------------------------------------------------------------ */

function ClientDetail({ id, tab }: { id: string; tab: string }) {
  const { businesses, dispatch } = usePortal()
  const biz = businesses.find((b) => b.id === id)
  if (!biz) return <p className="text-body-sm text-ink-500">Client not found.</p>
  const V = verticals[biz.vertical]
  const tabs = [
    ['overview', 'Overview'],
    ['inbox', 'Inbox'],
    ['bookings', `${V.bookingNoun}s`],
    ['calls', 'Calls'],
    ['connections', 'Accounts & connections'],
    ['settings', 'Business info'],
  ] as const
  const current = tabs.some(([k]) => k === tab) ? tab : 'overview'
  const Icon = V.icon
  return (
    <div>
      <button onClick={() => go('admin/clients')} className="mb-4 inline-flex items-center gap-1.5 text-body-sm text-ink-500 hover:text-ink-900"><ArrowLeft className="h-4 w-4" /> All clients</button>
      <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-center">
        <span className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-brand-gradient text-white"><Icon className="h-6 w-6" /></span>
        <div className="flex-1">
          <h1 className="font-display text-[1.7rem] font-semibold tracking-tight text-ink-900">{biz.name}</h1>
          <p className="text-body-sm text-ink-500">{V.label} · {biz.city} · {biz.plan} plan · Login: {biz.loginEmail}</p>
        </div>
        <Btn onClick={() => openAsClient(dispatch, biz.id)}><ExternalLink className="h-4 w-4" /> Open client dashboard</Btn>
      </div>
      <div className="no-scrollbar mb-5 flex gap-1 overflow-x-auto border-b border-ink-200">
        {tabs.map(([k, l]) => (
          <button key={k} onClick={() => go(`admin/clients/${id}/${k}`)} className={cn('relative shrink-0 px-3 pb-3 pt-1 text-body-sm font-medium', current === k ? 'text-brand-700' : 'text-ink-500 hover:text-ink-900')}>
            {l}
            {current === k && <motion.span layoutId="client-tab" className="absolute inset-x-0 -bottom-px h-0.5 rounded-full bg-brand-500" />}
          </button>
        ))}
      </div>
      {current === 'overview' && <OverviewView businessId={biz.id} />}
      {current === 'inbox' && <InboxView businessIds={[biz.id]} />}
      {current === 'bookings' && <BookingsView businessId={biz.id} />}
      {current === 'calls' && <CallsView businessId={biz.id} />}
      {current === 'connections' && <ConnectionsView businessId={biz.id} />}
      {current === 'settings' && <SettingsView key={biz.id} businessId={biz.id} />}
    </div>
  )
}

/* ------------------------------------------------------------------ */

function HealthMatrix() {
  const { businesses, toggleConnection } = usePortal()
  const cols = integrations.filter((i) => !i.only)
  return (
    <Card className="overflow-hidden">
      <div className="no-scrollbar overflow-x-auto">
        <table className="w-full min-w-[980px] text-caption">
          <thead>
            <tr className="border-b border-ink-200/70 bg-ink-50 text-ink-500">
              <th className="sticky left-0 bg-ink-50 px-4 py-3 text-left font-medium">Client</th>
              {cols.map((i) => {
                const I = i.icon
                return (
                  <th key={i.id} className="px-2 py-3 font-medium" title={i.name}>
                    <span className="mx-auto grid h-7 w-7 place-items-center rounded-lg text-white" style={{ background: i.color }}><I className="h-3.5 w-3.5" /></span>
                  </th>
                )
              })}
            </tr>
          </thead>
          <tbody>
            {businesses.map((b) => (
              <tr key={b.id} className="border-b border-ink-100">
                <td className="sticky left-0 whitespace-nowrap bg-ink-0 px-4 py-2.5 font-semibold text-ink-900">{b.name}</td>
                {cols.map((i) => {
                  const on = b.connections[i.id]?.connected
                  return (
                    <td key={i.id} className="px-2 py-2.5 text-center">
                      <button
                        onClick={() => toggleConnection(b.id, i.id)}
                        title={on ? `${i.name}: ${b.connections[i.id]?.account} (click to disconnect)` : `Connect ${i.name}`}
                        className={cn('mx-auto grid h-6 w-6 place-items-center rounded-full transition-colors', on ? 'bg-success/15 text-success hover:bg-success/25' : 'bg-ink-100 text-ink-400 hover:bg-brand-50 hover:text-brand-600')}
                      >
                        {on ? <Check className="h-3.5 w-3.5" strokeWidth={3} /> : <Plus className="h-3.5 w-3.5" />}
                      </button>
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="flex items-center gap-2 border-t border-ink-100 px-4 py-3 text-caption text-ink-500">
        <ShieldCheck className="h-4 w-4 text-success" /> Accounts connect through official OAuth. The Zyro team manages access tokens, never client passwords.
      </p>
    </Card>
  )
}

/* ------------------------------------------------------------------ */

export function AdminApp({ path }: { path: string[] }) {
  const { session, businesses, conversations, bookings } = usePortal()
  const [adding, setAdding] = useState(false)
  const [inboxClient, setInboxClient] = useState<string>('all')
  useEffect(() => {
    if (!session) go('login')
  }, [session])
  if (!session) return null

  const page = path[1] ?? 'overview'
  const needs = conversations.filter((c) => c.status === 'needs_you')
  const nav = [
    { id: 'overview', label: 'Overview', icon: LayoutDashboard },
    { id: 'clients', label: 'Clients', icon: Building2, badge: businesses.length },
    { id: 'inbox', label: 'All inboxes', icon: Inbox, badge: needs.length },
    { id: 'health', label: 'Connections', icon: Plug },
  ]
  const current = nav.some((n) => n.id === page) ? page : 'overview'
  const today = dayKey(0)

  return (
    <Shell
      nav={nav}
      current={current}
      base="admin"
      roleLabel="Zyro team · Owner"
      header={
        <div className="flex items-center gap-2.5">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-ink-950 text-white"><ShieldCheck className="h-4 w-4" /></span>
          <div>
            <p className="text-body-sm font-semibold text-ink-900">Owner panel</p>
            <p className="text-caption text-ink-500">{businesses.length} active clients</p>
          </div>
        </div>
      }
    >
      <motion.div key={path.join('/')} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
        {current === 'overview' && (
          <>
            <PageHeader title="Good to see you" sub="Every client, every inbox, one place." actions={<Btn onClick={() => setAdding(true)}><Plus className="h-4 w-4" /> Add client</Btn>} />
            <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
              <StatCard label="Active clients" value={businesses.length} hint="across 4 industries" icon={<Building2 className="h-4 w-4" />} />
              <StatCard label="Conversations handled" value={(conversations.length * 23).toLocaleString()} hint="this week · all clients" icon={<MessageSquare className="h-4 w-4" />} tone="ion" />
              <StatCard label="Upcoming bookings" value={bookings.filter((b) => b.date >= today && b.status !== 'Cancelled').length} hint="written to client sheets" icon={<CalendarCheck className="h-4 w-4" />} tone="success" />
              <StatCard label="Need a human" value={needs.length} hint="escalations across clients" icon={<AlertTriangle className="h-4 w-4" />} tone="warn" />
            </div>
            <div className="mt-5 grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
              <div>
                <h3 className="mb-3 text-body-md font-semibold text-ink-900">Clients</h3>
                <ClientsTable compact />
              </div>
              <div>
                <h3 className="mb-3 text-body-md font-semibold text-ink-900">Escalation queue</h3>
                <Card className="divide-y divide-ink-100">
                  <AnimatePresence initial={false}>
                    {needs.slice(0, 7).map((c) => {
                      const b = businesses.find((x) => x.id === c.businessId)
                      return (
                        <motion.button
                          key={c.id}
                          layout
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          onClick={() => go(`admin/clients/${c.businessId}/inbox`)}
                          className="flex w-full items-start gap-3 px-4 py-3 text-left hover:bg-ink-50"
                        >
                          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-body-sm font-semibold text-ink-900">{c.contact.name} <span className="font-normal text-ink-400">· {b?.name}</span></p>
                            <p className="truncate text-caption text-ink-500">{c.messages[0].text}</p>
                          </div>
                        </motion.button>
                      )
                    })}
                  </AnimatePresence>
                  {!needs.length && <p className="px-4 py-8 text-center text-body-sm text-ink-400">All clear 🎉</p>}
                </Card>
              </div>
            </div>
          </>
        )}

        {current === 'clients' && !path[2] && (
          <>
            <PageHeader title="Clients" sub="Each client gets their own login, inbox and bookings sheet." actions={<Btn onClick={() => setAdding(true)}><Plus className="h-4 w-4" /> Add client</Btn>} />
            <ClientsTable />
          </>
        )}
        {current === 'clients' && path[2] && <ClientDetail id={path[2]} tab={path[3] ?? 'overview'} />}

        {current === 'inbox' && (
          <>
            <PageHeader
              title="All inboxes"
              sub="Every message from every client, in one queue."
              actions={
                <select value={inboxClient} onChange={(e) => setInboxClient(e.target.value)} className="h-9 rounded-xl border border-ink-200 bg-ink-0 px-3 text-body-sm">
                  <option value="all">All clients</option>
                  {businesses.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
              }
            />
            <InboxView key={inboxClient} businessIds={inboxClient === 'all' ? businesses.map((b) => b.id) : [inboxClient]} showBusiness={inboxClient === 'all'} />
          </>
        )}

        {current === 'health' && (
          <>
            <PageHeader title="Connections" sub="Which accounts are connected for each client. Click a dot to connect or disconnect." />
            <HealthMatrix />
          </>
        )}
      </motion.div>
      <AnimatePresence>{adding && <AddClientModal onClose={() => setAdding(false)} />}</AnimatePresence>
    </Shell>
  )
}
