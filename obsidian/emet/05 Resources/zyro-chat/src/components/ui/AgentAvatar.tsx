import { avatarOf } from '../../data/agents'
import { cn } from '../../lib/cn'

/** Character avatar for an AI employee. Images live in src/assets/agents/<id>.* */
export function AgentAvatar({
  id,
  name,
  size = 56,
  className,
  rounded = 'rounded-2xl',
}: {
  id: string
  name?: string
  size?: number
  className?: string
  rounded?: string
}) {
  return (
    <img
      src={avatarOf(id)}
      alt={name ? `${name}, AI employee` : ''}
      width={size}
      height={size}
      loading="lazy"
      decoding="async"
      draggable={false}
      style={{ width: size, height: size }}
      className={cn('shrink-0 select-none object-cover', rounded, className)}
    />
  )
}
