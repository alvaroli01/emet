"use client";

import { motion, useReducedMotion } from "motion/react";

/**
 * Glossy shapes filled with Google's four colours, floating behind the page headline (the Google I/O look).
 * Each shape is an SVG silhouette used as a mask over layered radial gradients, so it reads as one glossy blob.
 * They spring in with a blur when the page opens, then drift slowly. Decorative only (aria-hidden).
 */
const SHAPES = {
  mountain: "M5 88 L38 30 Q42 23 46 30 L58 50 L66 38 Q70 32 74 38 L95 88 Z",
  coin: "M50 6 A44 44 0 1 1 49.9 6 Z M50 24 A26 26 0 1 0 50.1 24 Z",
  sparkle: "M50 2 C54 36 64 46 98 50 C64 54 54 64 50 98 C46 64 36 54 2 50 C36 46 46 36 50 2 Z",
  globe: "M50 4 A46 46 0 1 1 49.9 4 Z M50 16 A34 34 0 1 0 50.1 16 Z M46 6 H54 V94 H46 Z M6 46 H94 V54 H6 Z",
  cloud: "M26 82 A20 20 0 0 1 24 42 A26 26 0 0 1 74 36 A22 22 0 0 1 78 82 Z",
  ring: "M50 8 A42 42 0 1 1 49.9 8 Z M50 30 A20 20 0 1 0 50.1 30 Z",
  pill: "M30 20 H70 A30 30 0 0 1 70 80 H30 A30 30 0 0 1 30 20 Z",
} as const;
export type ShapeName = keyof typeof SHAPES;

const GLOSS = [
  "radial-gradient(at 22% 18%, #34a853 0, transparent 45%), radial-gradient(at 82% 22%, #ea4335 0, transparent 50%), radial-gradient(at 60% 88%, #fbbc04 0, transparent 50%), radial-gradient(at 40% 55%, #4285f4 0, #4285f4 100%)",
  "radial-gradient(at 75% 15%, #fbbc04 0, transparent 45%), radial-gradient(at 15% 70%, #34a853 0, transparent 50%), radial-gradient(at 85% 85%, #ea4335 0, transparent 50%), radial-gradient(at 50% 40%, #4285f4 0, #4285f4 100%)",
  "radial-gradient(at 30% 85%, #ea4335 0, transparent 45%), radial-gradient(at 85% 30%, #34a853 0, transparent 50%), radial-gradient(at 20% 15%, #fbbc04 0, transparent 45%), radial-gradient(at 55% 50%, #4285f4 0, #4285f4 100%)",
];

const mask = (d: string) => `url("data:image/svg+xml,${encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><path fill-rule='evenodd' d='${d}'/></svg>`)}")`;

/** Default layouts: x/y in % of the hero box, size in % of its width. */
const LAYOUT = [
  { x: 4, y: 30, s: 21, r: -8 },
  { x: 24, y: 6, s: 24, r: 6 },
  { x: 52, y: 22, s: 22, r: -4 },
  { x: 74, y: 8, s: 23, r: 10 },
];

export function IoArt({ shapes, className = "" }: { shapes: ShapeName[]; className?: string }) {
  const reduce = useReducedMotion();
  return (
    <div aria-hidden className={`pointer-events-none absolute inset-0 -z-10 overflow-hidden ${className}`}>
      {shapes.slice(0, 4).map((name, i) => {
        const p = LAYOUT[i];
        const style: React.CSSProperties = {
          left: `${p.x}%`, top: `${p.y}%`, width: `${p.s}%`, aspectRatio: "1",
          backgroundImage: GLOSS[i % GLOSS.length], maskImage: mask(SHAPES[name]), WebkitMaskImage: mask(SHAPES[name]),
          maskSize: "contain", WebkitMaskSize: "contain", maskRepeat: "no-repeat", WebkitMaskRepeat: "no-repeat",
        };
        return (
          <motion.div key={name + i} className="absolute mix-blend-normal dark:mix-blend-screen" style={style}
            initial={{ opacity: 0, scale: 0.55, y: 40, rotate: p.r - 20, filter: "blur(18px)" }}
            animate={reduce ? { opacity: 0.7, scale: 1, y: 0, rotate: p.r, filter: "blur(0px)" } : { opacity: 0.7, scale: 1, y: [0, -10, 0], rotate: p.r, filter: "blur(0px)" }}
            transition={reduce ? { duration: 0 } : {
              opacity: { duration: 0.6, delay: 0.08 * i }, scale: { type: "spring", stiffness: 120, damping: 14, delay: 0.08 * i },
              rotate: { type: "spring", stiffness: 90, damping: 12, delay: 0.08 * i }, filter: { duration: 0.6, delay: 0.08 * i },
              y: { duration: 6 + i, repeat: Infinity, ease: "easeInOut", delay: 0.8 + i * 0.3 },
            }} />
        );
      })}
    </div>
  );
}
