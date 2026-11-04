import { useCallback, useEffect, useState } from 'react'
import { agentById } from '../data/agents'

/**
 * Agent workspace routing via the URL hash (#agent/aria), so any link on
 * the page — or a URL shared in a pitch — can open a specific employee.
 */
const parse = () => {
  const m = window.location.hash.match(/^#agent\/([a-z]+)/)
  return m && agentById(m[1]) ? m[1] : null
}

export function useAgentRoute() {
  const [id, setId] = useState<string | null>(parse)

  useEffect(() => {
    const sync = () => setId(parse())
    window.addEventListener('hashchange', sync)
    window.addEventListener('popstate', sync)
    return () => {
      window.removeEventListener('hashchange', sync)
      window.removeEventListener('popstate', sync)
    }
  }, [])

  const open = useCallback((next: string) => {
    history.pushState(null, '', `#agent/${next}`)
    setId(next)
  }, [])

  const close = useCallback(() => {
    history.replaceState(null, '', window.location.pathname + window.location.search)
    setId(null)
  }, [])

  return { id, open, close }
}
