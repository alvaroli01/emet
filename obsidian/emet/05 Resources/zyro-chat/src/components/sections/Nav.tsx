import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { ArrowRight, Menu, X } from 'lucide-react'
import { contact, nav } from '../../data/content'
import { Logo } from '../ui/Logo'
import { Button } from '../ui/Button'
import { cn } from '../../lib/cn'
import { ease } from '../../lib/motion'

export function Nav() {
  const [scrolled, setScrolled] = useState(false)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : ''
  }, [open])

  return (
    <motion.header
      initial={{ y: -20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.6, ease }}
      className="fixed inset-x-0 top-0 z-50"
    >
      <div
        className={cn(
          'border-b transition-[background-color,border-color,backdrop-filter] duration-300',
          scrolled || open ? 'border-ink-200/70 bg-ink-25/80 backdrop-blur-xl' : 'border-transparent bg-transparent',
        )}
      >
        <nav className="container flex h-[var(--nav-h)] items-center justify-between" aria-label="Main">
          <Logo />

          <ul className="hidden items-center gap-1 md:flex">
            {nav.links.map((l) => (
              <li key={l.href}>
                <a
                  href={l.href}
                  className="relative rounded-full px-4 py-2 text-body-sm font-medium text-ink-600 transition-colors hover:text-ink-900"
                >
                  {l.label}
                </a>
              </li>
            ))}
          </ul>

          <div className="hidden items-center gap-2 md:flex">
            <a href="#/login" className="px-3 text-body-sm font-medium text-ink-600 hover:text-ink-900">
              Log in
            </a>
            <Button href={contact.demoHref} size="sm">
              Book a demo <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </Button>
          </div>

          <button
            className="-mr-2 grid h-10 w-10 place-items-center rounded-full text-ink-800 md:hidden"
            onClick={() => setOpen((o) => !o)}
            aria-label={open ? 'Close menu' : 'Open menu'}
            aria-expanded={open}
          >
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </nav>
      </div>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.25, ease }}
            className="border-b border-ink-200/70 bg-ink-25/95 backdrop-blur-xl md:hidden"
          >
            <ul className="container flex flex-col py-4">
              {nav.links.map((l) => (
                <li key={l.href}>
                  <a
                    href={l.href}
                    onClick={() => setOpen(false)}
                    className="block border-b border-ink-100 py-4 font-display text-display-sm font-medium text-ink-900"
                  >
                    {l.label}
                  </a>
                </li>
              ))}
              <li>
                <a href="#/login" onClick={() => setOpen(false)} className="block border-b border-ink-100 py-4 font-display text-display-sm font-medium text-ink-900">
                  Log in
                </a>
              </li>
              <li className="pt-5">
                <Button href={contact.demoHref} size="lg" className="w-full" onClick={() => setOpen(false)}>
                  Book a demo <ArrowRight className="h-4 w-4" />
                </Button>
              </li>
            </ul>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.header>
  )
}
