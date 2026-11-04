import { useEffect, useState } from 'react'

/** Minimal hash router for the dashboards: #/login, #/app/<page>, #/admin/<page>/<id> */
const parts = () => window.location.hash.replace(/^#\/?/, '').split('/').filter(Boolean)

export function useRoute() {
  const [p, setP] = useState(parts)
  useEffect(() => {
    const on = () => setP(parts())
    window.addEventListener('hashchange', on)
    return () => window.removeEventListener('hashchange', on)
  }, [])
  return p
}

export const go = (path: string) => {
  window.location.hash = `#/${path.replace(/^\//, '')}`
}

export const isPortalHash = (hash = window.location.hash) => /^#\/(login|app|admin)/.test(hash)
