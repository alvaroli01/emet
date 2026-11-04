import { useState } from 'react'
import { motion } from 'framer-motion'
import { ArrowLeft, ArrowRight, Building2, CalendarCheck, Inbox, Lock, Mail, PhoneCall, ShieldCheck } from 'lucide-react'
import { LogoMark } from '../components/ui/Logo'
import { AgentAvatar } from '../components/ui/AgentAvatar'
import { contact } from '../data/content'
import { usePortal } from './store'
import { verticals } from './data'
import { go } from './router'
import { cn } from '../lib/cn'
import { ease } from '../lib/motion'

type Role = 'customer' | 'owner'

export function Login() {
  const { businesses, dispatch } = usePortal()
  const [role, setRole] = useState<Role>('customer')
  const [bizId, setBizId] = useState(businesses[0]?.id ?? '')
  const biz = businesses.find((b) => b.id === bizId) ?? businesses[0]
  const [loading, setLoading] = useState(false)

  const email = role === 'owner' ? 'team@zyrochat.com' : biz?.loginEmail ?? ''

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    window.setTimeout(() => {
      dispatch({ type: 'login', session: { role, businessId: biz.id } })
      go(role === 'owner' ? 'admin/overview' : 'app/overview')
    }, 650)
  }

  return (
    <div className="grid min-h-screen grid-cols-1 bg-ink-25 lg:grid-cols-[1fr_1.05fr]">
      {/* Brand panel */}
      <div className="relative hidden overflow-hidden bg-ink-950 p-12 text-white lg:flex lg:flex-col">
        <div aria-hidden className="absolute inset-0">
          <div className="absolute -left-20 top-1/3 h-[30rem] w-[30rem] rounded-full bg-brand-500/40 blur-[120px]" />
          <div className="absolute -right-10 bottom-0 h-80 w-80 rounded-full bg-ion-500/25 blur-[100px]" />
          <div className="absolute inset-0 bg-[linear-gradient(rgb(255_255_255/0.05)_1px,transparent_1px),linear-gradient(90deg,rgb(255_255_255/0.05)_1px,transparent_1px)] bg-[size:44px_44px] [mask-image:radial-gradient(ellipse_70%_60%_at_40%_50%,#000,transparent)]" />
        </div>
        <a href="#" onClick={() => (window.location.hash = '')} className="relative flex items-center gap-2.5">
          <LogoMark />
          <span className="font-display text-lg font-semibold">
            Zyro<span className="text-ion-300"> Chat</span>
          </span>
        </a>
        <div className="relative my-auto max-w-md">
          <h1 className="font-display text-[2.6rem] font-semibold leading-[1.05] tracking-tight text-white">Never miss a customer again.</h1>
          <p className="mt-4 text-body-lg text-ink-300">
            Every DM, lead form, email and phone call answered by AI in seconds, and every booking written straight into your spreadsheet. No double-bookings, ever.
          </p>
          <ul className="mt-8 space-y-3 text-body-sm text-ink-200">
            {[
              [Inbox, 'One inbox for Instagram, WhatsApp, Messenger, Google, email & more'],
              [PhoneCall, 'AI receptionist that answers every call'],
              [CalendarCheck, 'Conflict-free bookings synced to Excel & Google Sheets'],
            ].map(([Icon, t], i) => {
              const I = Icon as typeof Inbox
              return (
                <motion.li key={i} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.2 + i * 0.1, ease }} className="flex items-center gap-3">
                  <span className="grid h-8 w-8 place-items-center rounded-lg bg-white/10">
                    <I className="h-4 w-4 text-ion-300" />
                  </span>
                  {t as string}
                </motion.li>
              )
            })}
          </ul>
        </div>
        <div className="relative flex items-center gap-3">
          <div className="flex -space-x-2">
            {['aria', 'otto', 'sage', 'kit'].map((id) => (
              <AgentAvatar key={id} id={id} size={32} rounded="rounded-full" className="ring-2 ring-ink-950" />
            ))}
          </div>
          <p className="text-caption text-ink-400">Your AI team is online 24/7</p>
        </div>
      </div>

      {/* Form */}
      <div className="flex flex-col px-5 py-8 sm:px-10">
        <a href="#" onClick={() => (window.location.hash = '')} className="inline-flex w-fit items-center gap-1.5 text-body-sm text-ink-500 hover:text-ink-900">
          <ArrowLeft className="h-4 w-4" /> Back to website
        </a>
        <motion.form
          onSubmit={submit}
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease }}
          className="mx-auto my-auto w-full max-w-md py-10"
        >
          <div className="lg:hidden">
            <LogoMark className="h-10 w-10" />
          </div>
          <h2 className="mt-6 font-display text-[1.9rem] font-semibold tracking-tight lg:mt-0">Log in to Zyro</h2>
          <p className="mt-1 text-body-sm text-ink-500">Accounts are set up by the Zyro team when you join.</p>

          {/* Role picker */}
          <div className="mt-7 grid grid-cols-2 gap-3" role="radiogroup" aria-label="Account type">
            {(
              [
                ['customer', 'Business', 'Your AI team, inbox & bookings', Building2],
                ['owner', 'Zyro team', 'Manage every client account', ShieldCheck],
              ] as const
            ).map(([key, title, sub, Icon]) => (
              <button
                type="button"
                key={key}
                role="radio"
                aria-checked={role === key}
                onClick={() => setRole(key)}
                className={cn(
                  'rounded-2xl border p-4 text-left transition-all',
                  role === key ? 'border-brand-400 bg-brand-50/70 ring-2 ring-brand-200' : 'border-ink-200 bg-ink-0 hover:border-ink-300',
                )}
              >
                <Icon className={cn('h-5 w-5', role === key ? 'text-brand-600' : 'text-ink-400')} />
                <p className="mt-2 text-body-sm font-semibold text-ink-900">{title}</p>
                <p className="text-caption text-ink-500">{sub}</p>
              </button>
            ))}
          </div>

          {role === 'customer' && (
            <label className="mt-5 block">
              <span className="text-caption font-medium text-ink-600">Demo business</span>
              <select
                value={bizId}
                onChange={(e) => setBizId(e.target.value)}
                className="mt-1.5 h-11 w-full rounded-xl border border-ink-200 bg-ink-0 px-3 text-body-sm text-ink-900 outline-none focus:border-brand-400"
              >
                {businesses.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name} ({verticals[b.vertical].label})
                  </option>
                ))}
              </select>
            </label>
          )}

          <label className="mt-4 block">
            <span className="text-caption font-medium text-ink-600">Email</span>
            <div className="mt-1.5 flex h-11 items-center gap-2 rounded-xl border border-ink-200 bg-ink-0 px-3 focus-within:border-brand-400">
              <Mail className="h-4 w-4 text-ink-400" />
              <input value={email} readOnly className="min-w-0 flex-1 bg-transparent text-body-sm text-ink-900 outline-none" />
            </div>
          </label>
          <label className="mt-4 block">
            <span className="text-caption font-medium text-ink-600">Password</span>
            <div className="mt-1.5 flex h-11 items-center gap-2 rounded-xl border border-ink-200 bg-ink-0 px-3 focus-within:border-brand-400">
              <Lock className="h-4 w-4 text-ink-400" />
              <input type="password" value="demo-password" readOnly className="min-w-0 flex-1 bg-transparent text-body-sm text-ink-900 outline-none" />
            </div>
          </label>

          <button
            type="submit"
            disabled={loading}
            className="mt-6 flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-brand-500 text-body-md font-medium text-white shadow-[0_8px_24px_-8px_rgb(var(--brand-500)/0.7)] transition-colors hover:bg-brand-600 disabled:opacity-70"
          >
            {loading ? 'Signing in…' : role === 'owner' ? 'Open owner panel' : 'Open my dashboard'}
            {!loading && <ArrowRight className="h-4 w-4" />}
          </button>

          <p className="mt-4 rounded-xl bg-ink-100/70 px-3 py-2 text-center text-caption text-ink-500">
            Demo mode: sample data only, nothing connects to real accounts.
          </p>
          <p className="mt-6 text-center text-body-sm text-ink-500">
            Not a customer yet?{' '}
            <a href={contact.demoHref} className="font-medium text-brand-600 hover:underline">
              Contact {contact.email}
            </a>
          </p>
        </motion.form>
      </div>
    </div>
  )
}
