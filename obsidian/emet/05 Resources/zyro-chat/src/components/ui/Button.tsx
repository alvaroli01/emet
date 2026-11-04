import { motion, type HTMLMotionProps } from 'framer-motion'
import type { ReactNode } from 'react'
import { cn } from '../../lib/cn'

type Variant = 'primary' | 'secondary' | 'ghost' | 'inverse'
type Size = 'sm' | 'md' | 'lg'

const variants: Record<Variant, string> = {
  primary:
    'relative overflow-hidden bg-brand-500 text-white shadow-[0_1px_0_rgb(255_255_255/0.25)_inset,0_8px_24px_-8px_rgb(var(--brand-500)/0.7)] hover:bg-brand-600 hover:shadow-glow',
  secondary:
    'bg-ink-0 text-ink-900 border border-ink-200 shadow-card hover:border-brand-300 hover:text-brand-700',
  ghost: 'text-ink-700 hover:text-ink-900 hover:bg-ink-100/70',
  inverse: 'bg-white text-brand-700 hover:bg-brand-50 shadow-lift',
}

const sizes: Record<Size, string> = {
  sm: 'h-9 px-4 text-body-sm',
  md: 'h-11 px-5 text-body-sm',
  lg: 'h-12 px-6 text-body-md sm:h-[3.25rem] sm:px-7',
}

type Props = Omit<HTMLMotionProps<'a'>, 'children'> & {
  variant?: Variant
  size?: Size
  children: ReactNode
}

export function Button({ variant = 'primary', size = 'md', className, children, ...rest }: Props) {
  return (
    <motion.a
      whileHover={{ y: -1 }}
      whileTap={{ scale: 0.97 }}
      transition={{ type: 'spring', stiffness: 400, damping: 25 }}
      className={cn(
        'group inline-flex select-none items-center justify-center gap-2 whitespace-nowrap rounded-full font-medium transition-[background-color,box-shadow,border-color,color] duration-300',
        variants[variant],
        sizes[size],
        className,
      )}
      {...rest}
    >
      {variant === 'primary' && (
        <span
          aria-hidden
          className="pointer-events-none absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/25 to-transparent transition-transform duration-700 ease-out-expo group-hover:translate-x-full"
        />
      )}
      <span className="relative inline-flex items-center gap-2">{children}</span>
    </motion.a>
  )
}
