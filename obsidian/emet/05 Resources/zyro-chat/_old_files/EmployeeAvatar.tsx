import { useId } from 'react'
import { cn } from '../../lib/cn'

/**
 * Abstract, brand-consistent avatar. Each employee gets a deterministic
 * geometric "face" (orbital rings + core) derived from their name.
 */
export function EmployeeAvatar({
  name,
  hue,
  size = 56,
  className,
}: {
  name: string
  hue: [string, string]
  size?: number
  className?: string
}) {
  const id = useId().replace(/:/g, '')
  const seed = [...name].reduce((a, c) => a + c.charCodeAt(0), 0)
  const rot = (seed * 37) % 180
  const rings = 2 + (seed % 2)
  const coreX = 32 + ((seed % 7) - 3) * 1.5
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" className={cn('shrink-0', className)} role="img" aria-label={`${name} avatar`}>
      <defs>
        <linearGradient id={`bg-${id}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={hue[0]} />
          <stop offset="1" stopColor={hue[1]} />
        </linearGradient>
        <radialGradient id={`core-${id}`} cx="0.35" cy="0.3" r="0.8">
          <stop offset="0" stopColor="#fff" />
          <stop offset="0.5" stopColor="#fff" stopOpacity="0.85" />
          <stop offset="1" stopColor="#fff" stopOpacity="0.2" />
        </radialGradient>
      </defs>
      <rect width="64" height="64" rx="18" fill={`url(#bg-${id})`} />
      <g transform={`rotate(${rot} 32 32)`} fill="none" stroke="#fff" strokeOpacity="0.45" strokeWidth="1.2">
        {Array.from({ length: rings }).map((_, i) => (
          <ellipse key={i} cx="32" cy="32" rx={22 - i * 5} ry={9 + i * 3} transform={`rotate(${i * 55} 32 32)`} />
        ))}
      </g>
      <circle cx={coreX} cy="32" r="9" fill={`url(#core-${id})`} />
      <circle cx={coreX + 12} cy={20} r="2" fill="#fff" fillOpacity="0.9" />
    </svg>
  )
}
