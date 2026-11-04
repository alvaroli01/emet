import { useEffect, useState } from 'react'
import { useReducedMotion } from 'framer-motion'

/**
 * Decides whether the WebGL hero should render.
 * Falls back to a static gradient when: reduced motion is requested,
 * WebGL is unavailable, the device reports low memory / few cores,
 * or the user has Save-Data enabled.
 */
export function useCan3D() {
  const reduced = useReducedMotion()
  const [ok, setOk] = useState(false)

  useEffect(() => {
    // Manual override for demos: ?3d=1 forces the WebGL scene, ?3d=0 forces the fallback
    const force = new URLSearchParams(window.location.search).get('3d')
    if (force === '0') return setOk(false)
    if (reduced && force !== '1') return setOk(false)
    const nav = navigator as Navigator & { deviceMemory?: number; connection?: { saveData?: boolean } }
    const lowPower =
      (nav.deviceMemory !== undefined && nav.deviceMemory < 4) ||
      (nav.hardwareConcurrency !== undefined && nav.hardwareConcurrency < 4) ||
      nav.connection?.saveData === true
    let webgl = false
    try {
      const c = document.createElement('canvas')
      webgl = !!(c.getContext('webgl2') || c.getContext('webgl'))
    } catch {
      webgl = false
    }
    setOk(webgl && (!lowPower || force === '1'))
  }, [reduced])

  return ok
}
