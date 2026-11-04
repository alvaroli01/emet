/**
 * Static fallback for the 3D hero (reduced motion, no WebGL, low-power
 * devices, or while the 3D chunk loads). Pure SVG — zero JS cost.
 */
export function StaticOrb() {
  const nodes = [
    [50, 12, '#3346FF', 3.2],
    [86, 36, '#18C5F2', 3.2],
    [78, 80, '#6A7CFF', 3.2],
    [24, 82, '#7DDEFA', 3.2],
    [12, 40, '#1D26C4', 3.2],
    [66, 22, '#9EADFF', 1.2],
    [34, 20, '#9EADFF', 1.2],
    [90, 58, '#9EADFF', 1.2],
    [52, 90, '#9EADFF', 1.2],
    [10, 62, '#9EADFF', 1.2],
    [30, 55, '#9EADFF', 1.2],
    [70, 60, '#9EADFF', 1.2],
  ] as const
  return (
    <svg viewBox="0 0 100 100" className="absolute inset-0 h-full w-full" aria-hidden>
      <defs>
        <radialGradient id="orb-core" cx="0.38" cy="0.32" r="0.75">
          <stop offset="0" stopColor="#E2E7FF" />
          <stop offset="0.35" stopColor="#6A7CFF" />
          <stop offset="0.8" stopColor="#3346FF" />
          <stop offset="1" stopColor="#1D26C4" />
        </radialGradient>
        <radialGradient id="orb-halo">
          <stop offset="0" stopColor="#3346FF" stopOpacity="0.35" />
          <stop offset="1" stopColor="#3346FF" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="orb-line" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#6A7CFF" />
          <stop offset="1" stopColor="#18C5F2" />
        </linearGradient>
      </defs>
      <g stroke="url(#orb-line)" strokeWidth="0.25" opacity="0.5">
        {nodes.slice(0, 5).map(([x, y], i) => (
          <line key={`s${i}`} x1="50" y1="50" x2={x} y2={y} />
        ))}
        {nodes.map(([x, y], i) => {
          const [nx, ny] = nodes[(i + 1) % nodes.length]
          return <line key={`e${i}`} x1={x} y1={y} x2={nx} y2={ny} />
        })}
      </g>
      <circle cx="50" cy="50" r="24" fill="none" stroke="#6A7CFF" strokeOpacity="0.3" strokeWidth="0.25" />
      <circle cx="50" cy="50" r="30" fill="url(#orb-halo)" />
      <circle cx="50" cy="50" r="13" fill="url(#orb-core)" />
      {nodes.map(([x, y, c, r], i) => (
        <g key={i}>
          <circle cx={x} cy={y} r={r * 2.4} fill={c} opacity="0.15" />
          <circle cx={x} cy={y} r={r * 0.6} fill={c} />
        </g>
      ))}
    </svg>
  )
}
