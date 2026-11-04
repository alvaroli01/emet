import { useEffect, useState } from 'react'
import { animate, useReducedMotion } from 'framer-motion'

export function useCountUp(target: number, start: boolean, duration = 1.8) {
  const reduced = useReducedMotion()
  const [value, setValue] = useState(reduced ? target : 0)
  useEffect(() => {
    if (!start) return
    if (reduced) return setValue(target)
    const controls = animate(0, target, {
      duration,
      ease: [0.16, 1, 0.3, 1],
      onUpdate: (v) => setValue(Math.round(v)),
    })
    return () => controls.stop()
  }, [start, target, duration, reduced])
  return value
}
