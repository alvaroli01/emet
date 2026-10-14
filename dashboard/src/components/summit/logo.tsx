/** emet mark: three contour lines closing on a summit point. */
export function LogoMark({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 28 28" aria-hidden className="shrink-0">
      <rect width="28" height="28" rx="8" fill="var(--brand)" />
      <g fill="none" stroke="var(--brand-contrast)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 21.5 C8 19 10.5 13 14 8.5 C17.5 13 20 19 24 21.5" opacity=".45" />
        <path d="M7.5 21.5 C10.5 19.5 12 15 14 12 C16 15 17.5 19.5 20.5 21.5" opacity=".75" />
        <path d="M11 21.5 C12.4 20.3 13.2 18.2 14 16.6 C14.8 18.2 15.6 20.3 17 21.5" />
      </g>
      <circle cx="14" cy="8.5" r="1.9" fill="var(--trail)" />
    </svg>
  );
}
