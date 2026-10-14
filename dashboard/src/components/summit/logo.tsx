import { useId } from "react";

/** emet mark: three summit lines on the indigo-to-cyan brand gradient. */
export function LogoMark({ size = 28 }: { size?: number }) {
  const id = useId();
  return (
    <svg width={size} height={size} viewBox="0 0 28 28" aria-hidden className="shrink-0">
      <defs>
        <linearGradient id={`${id}g`} x1="0" y1="1" x2="1" y2="0">
          <stop offset="0" stopColor="#2b39e0" /><stop offset=".55" stopColor="#3949f5" /><stop offset="1" stopColor="#18c5f2" />
        </linearGradient>
      </defs>
      <rect width="28" height="28" rx="8" fill={`url(#${id}g)`} />
      <g fill="none" stroke="#ffffff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 21.5 C8 19 10.5 13 14 8.5 C17.5 13 20 19 24 21.5" opacity=".55" />
        <path d="M7.5 21.5 C10.5 19.5 12 15 14 12 C16 15 17.5 19.5 20.5 21.5" opacity=".8" />
        <path d="M11 21.5 C12.4 20.3 13.2 18.2 14 16.6 C14.8 18.2 15.6 20.3 17 21.5" />
      </g>
      <circle cx="14" cy="8.5" r="2" fill="#ffffff" />
    </svg>
  );
}
