import { motion } from 'framer-motion'
import { logos } from '../../data/content'
import { fadeIn, inView } from '../../lib/motion'

// Simple wordmark placeholders — each gets a different glyph + type treatment
const glyphs = [
  <circle key="c" cx="8" cy="8" r="6" />,
  <rect key="r" x="2" y="2" width="12" height="12" rx="3" />,
  <path key="t" d="M8 1.5 14.5 14h-13z" />,
  <path key="d" d="M8 1 15 8 8 15 1 8z" />,
]
const styles = ['font-display font-semibold', 'font-sans font-semibold tracking-tight', 'font-display font-medium uppercase tracking-[0.18em] text-[0.95rem]', 'font-sans font-medium italic']

function Wordmark({ name, i }: { name: string; i: number }) {
  return (
    <span className="flex shrink-0 items-center gap-2 px-8 text-[1.15rem] text-ink-400 transition-colors duration-300 hover:text-ink-700 sm:px-11">
      <svg viewBox="0 0 16 16" className="h-4 w-4 fill-current" aria-hidden>
        {glyphs[i % glyphs.length]}
      </svg>
      <span className={styles[i % styles.length]}>{name}</span>
    </span>
  )
}

export function LogoStrip() {
  return (
    <motion.section
      variants={fadeIn}
      initial="hidden"
      whileInView="show"
      viewport={inView}
      className="py-16 sm:py-20"
      aria-label="Customers"
    >
      <p className="text-center text-body-sm text-ink-500">Trusted by fast-moving teams at 2,000+ companies</p>
      <div className="mask-fade-x mt-8 flex overflow-hidden">
        <div className="flex w-max animate-marquee hover:[animation-play-state:paused]">
          {[...logos, ...logos].map((l, i) => (
            <Wordmark key={i} name={l} i={i % logos.length} />
          ))}
        </div>
      </div>
    </motion.section>
  )
}
