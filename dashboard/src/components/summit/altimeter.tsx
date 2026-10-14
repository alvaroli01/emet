/** A thin altitude gauge: filled share of a goal, with optional camp ticks. The number is always written next to it. */
export function Altimeter({ value, steps = 0, color, label, className = "" }: {
  value: number; steps?: number; color: string; label: string; className?: string;
}) {
  const v = Math.min(1, Math.max(0, value));
  return (
    <div role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(v * 100)} aria-label={label}
         className={`relative h-2 overflow-hidden rounded-full bg-surface-2 ${className}`}>
      <div className="h-full origin-left rounded-full transition-[width] duration-700 ease-out motion-safe:animate-[rise_900ms_cubic-bezier(.2,.8,.2,1)]"
           style={{ width: `${v * 100}%`, background: color }} />
      {Array.from({ length: Math.max(0, steps - 1) }, (_, i) => (
        <span key={i} aria-hidden className="absolute top-0 h-full w-px bg-bg" style={{ left: `${((i + 1) / steps) * 100}%` }} />
      ))}
    </div>
  );
}
