import { useRef, type ReactNode } from 'react'
import { useDismissable } from '../../hooks/useDismissable'
import { cx } from '../../lib/cx'
import { Z } from '../../lib/zIndex'
import { Button } from './Button'
import { PanelHeader } from './Panel'

interface DrawerProps {
  title: ReactNode
  onClose: () => void
  children: ReactNode
  className?: string
  /** Extra controls rendered in the header, left of the close button. */
  headerActions?: ReactNode
}

/**
 * The canonical right-hand slide-in panel (tag assigners etc.).
 * Persistent: closes on Escape or its close button, not on outside clicks.
 */
export function Drawer({ title, onClose, children, className, headerActions }: DrawerProps) {
  const ref = useRef<HTMLDivElement>(null)

  useDismissable({
    onDismiss: onClose,
    insideRefs: [ref],
    closeOnClickOutside: false,
  })

  return (
    <div
      ref={ref}
      className={cx(
        'absolute inset-y-0 right-0 flex w-64 flex-col border-l border-base2 bg-base3 shadow-lg dark:border-base02 dark:bg-base03',
        Z.drawer,
        className,
      )}
    >
      <PanelHeader>
        <span className="text-sm font-medium text-base01 dark:text-base1">{title}</span>
        <div className="flex items-center gap-1">
          {headerActions}
          <Button variant="icon" size="sm" aria-label="Close" onClick={onClose}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </Button>
        </div>
      </PanelHeader>
      <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
    </div>
  )
}
