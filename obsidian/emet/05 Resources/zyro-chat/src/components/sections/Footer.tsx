import { Github, Linkedin, Twitter, Youtube } from 'lucide-react'
import { footer } from '../../data/content'
import { Logo } from '../ui/Logo'

const socials = [
  { icon: Twitter, label: 'X / Twitter' },
  { icon: Linkedin, label: 'LinkedIn' },
  { icon: Youtube, label: 'YouTube' },
  { icon: Github, label: 'GitHub' },
]

export function Footer() {
  return (
    <footer className="border-t border-ink-200/70 bg-ink-0">
      <div className="container grid gap-12 py-16 md:grid-cols-[1.4fr_2fr]">
        <div>
          <Logo />
          <p className="mt-4 max-w-xs text-body-sm text-ink-500">
            The AI workforce platform. Hire autonomous specialists that run support, content, ads, analytics and sales.
          </p>
          <div className="mt-6 flex gap-2">
            {socials.map(({ icon: Icon, label }) => (
              <a
                key={label}
                href="#top"
                aria-label={label}
                className="grid h-9 w-9 place-items-center rounded-full border border-ink-200 text-ink-500 transition-colors hover:border-brand-300 hover:text-brand-600"
              >
                <Icon className="h-4 w-4" />
              </a>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-8 sm:grid-cols-3">
          {footer.columns.map((c) => (
            <div key={c.title}>
              <p className="text-body-sm font-semibold text-ink-900">{c.title}</p>
              <ul className="mt-4 space-y-3">
                {c.links.map((l) => (
                  <li key={l}>
                    <a href="#top" className="text-body-sm text-ink-500 transition-colors hover:text-brand-600">
                      {l}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
      <div className="border-t border-ink-100">
        <div className="container flex flex-col items-center justify-between gap-3 py-6 text-caption text-ink-400 sm:flex-row">
          <p>© {new Date().getFullYear()} Zyro Chat, Inc. All rights reserved. · Avatars: “Micah” by Micah Lanier, CC BY 4.0</p>
          <div className="flex gap-5">
            <a href="#top" className="hover:text-ink-700">Privacy</a>
            <a href="#top" className="hover:text-ink-700">Terms</a>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-success" /> All systems operational
            </span>
          </div>
        </div>
      </div>
    </footer>
  )
}
