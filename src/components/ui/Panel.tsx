import type { HTMLAttributes } from 'react'
import { cx } from '../../lib/cx'

/** The canonical card surface: token border + rounded corners. */
export function Panel({ className, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cx(
        'rounded-lg border border-base2 bg-base3 dark:border-base02 dark:bg-base03',
        className,
      )}
      {...rest}
    />
  )
}

/** The canonical panel/drawer header row. */
export function PanelHeader({ className, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cx(
        'flex items-center justify-between border-b border-base2 px-4 py-3 dark:border-base02',
        className,
      )}
      {...rest}
    />
  )
}
