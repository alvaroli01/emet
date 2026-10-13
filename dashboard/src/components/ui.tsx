import { Lock } from "lucide-react";

/** Shown wherever the logged-in member can look but not edit. */
export function ViewOnlyBadge() {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-surface-2 px-2 py-0.5 text-xs font-medium text-muted">
      <Lock size={12} /> View only
    </span>
  );
}

export function Avatar({ name, src, size = 32 }: { name: string; src?: string | null; size?: number }) {
  const initials = name.split(/\s+/).map((p) => p[0]).join("").slice(0, 2).toUpperCase();
  return src ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={name} width={size} height={size} className="rounded-full object-cover" style={{ width: size, height: size }} />
  ) : (
    <span
      aria-label={name}
      className="grid shrink-0 place-items-center rounded-full bg-surface-2 font-medium text-muted"
      style={{ width: size, height: size, fontSize: size * 0.38 }}
    >
      {initials}
    </span>
  );
}

export function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <section className={`rounded-2xl border border-line bg-surface p-5 shadow-sm ${className}`}>{children}</section>;
}

/** Placeholder for pages that later build steps fill in. */
export function ComingSoon({ step, what }: { step: number; what: string }) {
  return (
    <Card className="border-dashed text-center">
      <p className="text-sm text-muted">
        {what} — arrives in build step {step}.
      </p>
    </Card>
  );
}
