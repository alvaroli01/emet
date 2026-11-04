import { useEffect } from 'react'
import { motion } from 'framer-motion'
import { Bot, CalendarDays, Inbox, LayoutDashboard, PhoneCall, Plug, Settings } from 'lucide-react'
import { usePortal, useBusiness } from '../store'
import { verticals } from '../data'
import { go } from '../router'
import { BackToAdminBanner, Shell } from '../Shell'
import { PageHeader } from '../ui'
import { OverviewView } from './Overview'
import { InboxView } from './Inbox'
import { BookingsView } from './Bookings'
import { CallsView } from './Calls'
import { ConnectionsView } from './Connections'
import { SettingsView } from './Settings'
import { TeamView } from './Team'

export function CustomerApp({ page }: { page: string }) {
  const { session, conversations } = usePortal()
  const biz = useBusiness()
  useEffect(() => {
    if (!session) go('login')
  }, [session])
  if (!session || !biz) return null
  const v = verticals[biz.vertical]
  const unread = conversations.filter((c) => c.businessId === biz.id && (c.unread || c.status === 'needs_you')).length
  const Icon = v.icon

  const nav = [
    { id: 'overview', label: 'Overview', icon: LayoutDashboard },
    { id: 'inbox', label: 'Unified inbox', icon: Inbox, badge: unread },
    { id: 'bookings', label: `${v.bookingNoun}s`, icon: CalendarDays },
    { id: 'calls', label: 'Calls', icon: PhoneCall },
    { id: 'connections', label: 'Connections', icon: Plug },
    { id: 'team', label: 'AI employees', icon: Bot },
    { id: 'settings', label: 'Business settings', icon: Settings },
  ]
  const current = nav.some((n) => n.id === page) ? page : 'overview'
  const titles: Record<string, [string, string]> = {
    overview: [`Welcome back, ${biz.contactName.split(' ')[0]}`, 'Here’s what your AI team handled for you.'],
    inbox: ['Unified inbox', 'Every channel in one place. The AI replies in seconds; step in whenever you want.'],
    bookings: [`${v.bookingNoun}s`, 'Written automatically to your spreadsheet. Double-bookings are impossible.'],
    calls: ['Calls', 'Every call answered, summarized and followed up.'],
    connections: ['Connections', 'Connect your accounts once and the AI covers them all.'],
    team: ['AI employees', 'Your AI team. Click any employee to see them work.'],
    settings: ['Business settings', 'Your profile, AI behavior and booking rules.'],
  }

  return (
    <Shell
      nav={nav}
      current={current}
      base="app"
      roleLabel="Business"
      simulateFor={biz.id}
      banner={session.role === 'owner' ? <BackToAdminBanner name={biz.name} /> : undefined}
      header={
        <div className="flex items-center gap-2.5">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-brand-gradient text-white"><Icon className="h-4 w-4" /></span>
          <div className="min-w-0">
            <p className="truncate text-body-sm font-semibold text-ink-900">{biz.name}</p>
            <p className="truncate text-caption text-ink-500">{v.label} · {biz.city}</p>
          </div>
          <span className={`ml-2 hidden rounded-full px-2.5 py-1 text-[0.68rem] font-semibold md:inline-flex ${biz.autopilot ? 'bg-success/10 text-success' : 'bg-amber-50 text-amber-700'}`}>
            {biz.autopilot ? '● AI autopilot on' : '● Autopilot off'}
          </span>
        </div>
      }
    >
      <motion.div key={current} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
        <PageHeader title={titles[current][0]} sub={titles[current][1]} />
        {current === 'overview' && <OverviewView businessId={biz.id} />}
        {current === 'inbox' && <InboxView businessIds={[biz.id]} />}
        {current === 'bookings' && <BookingsView businessId={biz.id} />}
        {current === 'calls' && <CallsView businessId={biz.id} />}
        {current === 'connections' && <ConnectionsView businessId={biz.id} />}
        {current === 'team' && <TeamView businessId={biz.id} />}
        {current === 'settings' && <SettingsView key={biz.id} businessId={biz.id} />}
      </motion.div>
    </Shell>
  )
}
