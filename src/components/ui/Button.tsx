import type { ComponentProps } from 'react'
import { cx } from '../../lib/cx'

export type ButtonVariant = 'icon' | 'primary' | 'secondary' | 'danger' | 'ghost'
export type ButtonSize = 'sm' | 'md' | 'lg'

interface ButtonProps extends ComponentProps<'button'> {
  variant?: ButtonVariant
  size?: ButtonSize
  /** Icon buttons: accent-tinted active/toggled state. */
  active?: boolean
}

const BASE =
  'inline-flex items-center justify-center gap-1.5 transition-colors ' +
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue ' +
  'disabled:pointer-events-none disabled:opacity-50'

const ICON_SIZE: Record<ButtonSize, string> = {
  sm: 'rounded p-1',
  md: 'rounded p-1.5',
  lg: 'rounded p-2',
}

const TEXT_SIZE: Record<ButtonSize, string> = {
  sm: 'rounded px-2 py-1 text-xs',
  md: 'rounded px-3 py-1.5 text-sm',
  lg: 'rounded-md px-4 py-2 text-sm',
}

/**
 * The canonical button. Variants:
 * - icon      — ghost icon button (toolbars, panel headers); `active` tints it blue
 * - primary   — solid accent action
 * - secondary — bordered neutral action
 * - danger    — solid red destructive action
 * - ghost     — bare text action (cancel links)
 */
export function Button({
  variant = 'secondary',
  size = 'md',
  active = false,
  className,
  type = 'button',
  ...rest
}: ButtonProps) {
  let look: string
  switch (variant) {
    case 'icon':
      look = cx(
        ICON_SIZE[size],
        active
          ? 'bg-blue/15 text-blue dark:bg-blue/25 dark:text-blue'
          : 'text-base00 hover:bg-base2 dark:text-base1 dark:hover:bg-base02',
      )
      break
    case 'primary':
      look = cx(TEXT_SIZE[size], 'bg-blue font-medium text-white hover:bg-blue/90')
      break
    case 'danger':
      look = cx(TEXT_SIZE[size], 'bg-red font-medium text-white hover:bg-red/90')
      break
    case 'ghost':
      look = cx(
        TEXT_SIZE[size],
        'text-base1 hover:text-base00 dark:text-base01 dark:hover:text-base1',
      )
      break
    case 'secondary':
      look = cx(
        TEXT_SIZE[size],
        'border border-base1/40 text-base01 hover:bg-base2 dark:border-base01/40 dark:text-base1 dark:hover:bg-base02',
      )
      break
  }
  return <button type={type} className={cx(BASE, look, className)} {...rest} />
}
