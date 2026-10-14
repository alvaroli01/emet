import { useId } from "react";

/** emet mark: a solid twin summit on the orange brand tile, with a soft top light. Works from 16px up. */
export function LogoMark({ size = 28 }: { size?: number }) {
  const id = useId();
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden className="shrink-0">
      <defs>
        <linearGradient id={`${id}g`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#ff8d3f" /><stop offset="1" stopColor="#f0520a" />
        </linearGradient>
        <linearGradient id={`${id}h`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffffff" stopOpacity=".28" /><stop offset=".5" stopColor="#ffffff" stopOpacity="0" />
        </linearGradient>
      </defs>
      <rect width="32" height="32" rx="9" fill={`url(#${id}g)`} />
      <rect width="32" height="32" rx="9" fill={`url(#${id}h)`} />
      <path d="M5.5 23.5 L13.2 10.2 a1.1 1.1 0 0 1 1.9 0 L18.6 16.3 L20.4 13.4 a1.1 1.1 0 0 1 1.9 0 L26.5 23.5 Z" fill="#ffffff" />
      <path d="M13.2 10.2 a1.1 1.1 0 0 1 1.9 0 L17 13.5 L15.4 12.6 L14.1 14 L12.6 12.6 L11.4 13.3 Z" fill={`url(#${id}g)`} opacity=".35" />
    </svg>
  );
}
