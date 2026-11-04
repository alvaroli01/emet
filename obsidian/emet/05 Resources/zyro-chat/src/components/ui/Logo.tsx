import { useId } from 'react'
import { cn } from '../../lib/cn'

export function LogoMark({ className }: { className?: string }) {
  const gid = `zyro-g-${useId().replace(/:/g, '')}`
  return (
    <svg viewBox="0 0 32 32" className={cn('h-8 w-8', className)} aria-hidden>
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="rgb(var(--brand-600))" />
          <stop offset="0.6" stopColor="rgb(var(--brand-500))" />
          <stop offset="1" stopColor="rgb(var(--ion-500))" />
        </linearGradient>
      </defs>
      <rect width="32" height="32" rx="9" fill={`url(#${gid})`} />
      <path d="M10 10.5h12l-12 11h12" stroke="#fff" strokeWidth="2.6" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="22" cy="10.5" r="1.9" fill="rgb(var(--ion-300))" />
    </svg>
  )
}

export function Logo({ className, inverse = false }: { className?: string; inverse?: boolean }) {
  return (
    <a href="#top" className={cn('inline-flex items-center gap-2.5', className)} aria-label="Zyro Chat home">
      <LogoMark />
      <span className={cn('font-display text-[1.2rem] font-semibold tracking-tight', inverse ? 'text-white' : 'text-ink-900')}>
        Zyro<span className={inverse ? 'text-ion-300' : 'text-brand-500'}> Chat</span>
      </span>
    </a>
  )
}
