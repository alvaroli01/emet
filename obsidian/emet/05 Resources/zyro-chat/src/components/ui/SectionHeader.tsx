import { motion } from 'framer-motion'
import type { ReactNode } from 'react'
import { fadeUp, inView, stagger } from '../../lib/motion'
import { cn } from '../../lib/cn'

export function SectionHeader({
  eyebrow,
  title,
  sub,
  align = 'center',
  className,
}: {
  eyebrow: string
  title: ReactNode
  sub?: ReactNode
  align?: 'center' | 'left'
  className?: string
}) {
  return (
    <motion.div
      variants={stagger(0.1)}
      initial="hidden"
      whileInView="show"
      viewport={inView}
      className={cn('max-w-2xl', align === 'center' && 'mx-auto text-center', className)}
    >
      <motion.span variants={fadeUp} className="eyebrow">
        {eyebrow}
      </motion.span>
      <motion.h2 variants={fadeUp} className="mt-5 text-display-lg font-semibold text-balance">
        {title}
      </motion.h2>
      {sub && (
        <motion.p variants={fadeUp} className="mt-5 text-body-lg text-ink-500 text-pretty">
          {sub}
        </motion.p>
      )}
    </motion.div>
  )
}
