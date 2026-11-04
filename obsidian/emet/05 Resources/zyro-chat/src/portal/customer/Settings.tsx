import { useState } from 'react'
import { Bot, Save } from 'lucide-react'
import { usePortal } from '../store'
import { verticals, type Vertical } from '../data'
import { Btn, Card } from '../ui'
import { cn } from '../../lib/cn'

export function SettingsView({ businessId }: { businessId: string }) {
  const { businesses, dispatch, toast } = usePortal()
  const biz = businesses.find((b) => b.id === businessId)!
  const [f, setF] = useState({ name: biz.name, vertical: biz.vertical, city: biz.city, address: biz.address, phone: biz.phone, hours: biz.hours, contactName: biz.contactName, loginEmail: biz.loginEmail, tone: biz.tone })
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setF({ ...f, [k]: e.target.value })
  const input = 'mt-1.5 h-11 w-full rounded-xl border border-ink-200 bg-ink-0 px-3 text-body-sm text-ink-900 outline-none focus:border-brand-400'
  const v = verticals[f.vertical]
  const save = (e: React.FormEvent) => {
    e.preventDefault()
    dispatch({ type: 'updateBusiness', id: biz.id, patch: { ...f, slug: f.name.toLowerCase().replace(/[^a-z0-9]/g, '') || biz.slug } })
    toast({ title: 'Business profile saved', body: 'Your AI team will use the new details immediately.', tone: 'success' })
  }
  return (
    <form onSubmit={save} className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
      <Card className="p-5 sm:p-6">
        <h3 className="text-body-lg font-semibold">Business profile</h3>
        <p className="text-body-sm text-ink-500">This is what your AI employees know about your business.</p>
        <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <label className="text-caption font-medium text-ink-600 sm:col-span-2">Business name<input className={input} value={f.name} onChange={set('name')} /></label>
          <label className="text-caption font-medium text-ink-600">Business type
            <select className={input} value={f.vertical} onChange={(e) => setF({ ...f, vertical: e.target.value as Vertical })}>
              {Object.entries(verticals).map(([k, x]) => <option key={k} value={k}>{x.label}</option>)}
            </select>
          </label>
          <label className="text-caption font-medium text-ink-600">City<input className={input} value={f.city} onChange={set('city')} /></label>
          <label className="text-caption font-medium text-ink-600 sm:col-span-2">Address<input className={input} value={f.address} onChange={set('address')} /></label>
          <label className="text-caption font-medium text-ink-600">Phone<input className={input} value={f.phone} onChange={set('phone')} /></label>
          <label className="text-caption font-medium text-ink-600">Opening hours<input className={input} value={f.hours} onChange={set('hours')} /></label>
          <label className="text-caption font-medium text-ink-600">Owner / manager<input className={input} value={f.contactName} onChange={set('contactName')} /></label>
          <label className="text-caption font-medium text-ink-600">Escalations go to<input className={input} value={f.loginEmail} onChange={set('loginEmail')} /></label>
          <label className="text-caption font-medium text-ink-600 sm:col-span-2">Tone of voice
            <textarea rows={2} className={cn(input, 'h-auto py-2.5')} value={f.tone} onChange={set('tone')} />
          </label>
        </div>
        <div className="mt-6 flex justify-end">
          <Btn type="submit"><Save className="h-4 w-4" /> Save changes</Btn>
        </div>
      </Card>

      <div className="space-y-5">
        <Card className="p-5 sm:p-6">
          <div className="flex items-start gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-brand-50 text-brand-600"><Bot className="h-5 w-5" /></span>
            <div className="flex-1">
              <p className="text-body-md font-semibold text-ink-900">AI autopilot</p>
              <p className="text-body-sm text-ink-500">When on, the AI answers and books across every channel. When off, new messages wait for you.</p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={biz.autopilot}
              onClick={() => dispatch({ type: 'updateBusiness', id: biz.id, patch: { autopilot: !biz.autopilot } })}
              className={cn('relative mt-1 h-6 w-11 shrink-0 rounded-full transition-colors', biz.autopilot ? 'bg-brand-500' : 'bg-ink-300')}
            >
              <span className={cn('absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all', biz.autopilot ? 'left-[22px]' : 'left-0.5')} />
            </button>
          </div>
        </Card>
        <Card className="p-5 sm:p-6">
          <p className="text-body-md font-semibold text-ink-900">Booking rules</p>
          <p className="text-body-sm text-ink-500">Set for {v.label.toLowerCase()}s. The AI checks these before confirming anything.</p>
          <dl className="mt-4 grid grid-cols-2 gap-3 text-body-sm">
            {[
              ['Booking type', v.bookingNoun],
              ['Duration', `${v.durationMin} min`],
              ['Max at the same time', String(v.capacity)],
              ['Bookable hours', `${v.open}:00–${v.close}:00`],
            ].map(([k, val]) => (
              <div key={k} className="rounded-xl bg-ink-50 p-3">
                <dt className="text-caption text-ink-500">{k}</dt>
                <dd className="font-semibold text-ink-900">{val}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-3 text-caption text-ink-500">Services: {v.services.join(' · ')}</p>
        </Card>
      </div>
    </form>
  )
}
