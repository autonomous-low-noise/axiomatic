import type { ComponentProps } from 'react'
import { cx } from '../../lib/cx'

interface InputProps extends ComponentProps<'input'> {
  /** md: h-7 text-sm (default) · sm: h-6 text-xs. (`size` is a native attr.) */
  inputSize?: 'sm' | 'md'
  /**
   * Which dark surface the input sits on:
   * - page  (default, dark:bg-base03 pages) → input is raised base02
   * - panel (dark:bg-base02 popovers/panels) → input recesses to base03
   */
  surface?: 'page' | 'panel'
}

/** The canonical text input: token borders, blue focus accent, muted placeholder. */
export function Input({
  inputSize = 'md',
  surface = 'page',
  className,
  ...rest
}: InputProps) {
  return (
    <input
      className={cx(
        'rounded border border-base1/40 bg-base3 text-base02 outline-none',
        'focus:border-blue placeholder:text-base1',
        'dark:border-base02 dark:text-base2 dark:placeholder:text-base01',
        inputSize === 'sm' ? 'h-6 px-2 text-xs' : 'h-7 px-2 text-sm',
        surface === 'panel' ? 'dark:bg-base03' : 'dark:bg-base02',
        className,
      )}
      {...rest}
    />
  )
}
