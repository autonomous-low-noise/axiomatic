import type { HTMLAttributes } from 'react'
import { cx } from '../../lib/cx'

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  /** pill (default): rounded-full chips · square: compact status stamps. */
  variant?: 'pill' | 'square'
}

/**
 * The canonical badge/chip. Colors come from the call site (token classes,
 * or inline style for data-driven tag colors).
 */
export function Badge({ variant = 'pill', className, ...rest }: BadgeProps) {
  return (
    <span
      className={cx(
        'inline-flex items-center gap-1',
        variant === 'pill'
          ? 'rounded-full px-2 py-0.5 text-xs'
          : 'rounded px-1.5 py-0.5 text-[10px] font-medium',
        className,
      )}
      {...rest}
    />
  )
}
