import { useEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { useDismissable } from '../../hooks/useDismissable'
import { useAnchoredPosition } from '../../hooks/useAnchoredPosition'
import { cx } from '../../lib/cx'
import { Z } from '../../lib/zIndex'

export interface MenuItemSpec {
  label: ReactNode
  action: () => void
  danger?: boolean
}

interface MenuProps {
  onClose: () => void
  /** Items mode: a keyboard-navigable action list (role=menu, j/k/Enter). */
  items?: MenuItemSpec[]
  /** Popover mode: arbitrary content instead of items. */
  children?: ReactNode
  /** Position at a viewport point (context menus). */
  point?: { x: number; y: number }
  /** Position below an anchor element (dropdown popovers). */
  anchorRef?: { current: HTMLElement | null }
  className?: string
  /** Defaults to true in point mode (menu would detach from its point). */
  closeOnScroll?: boolean
}

/**
 * The canonical floating surface: portal + viewport-clamped positioning +
 * dismiss lifecycle, with an optional keyboard-navigable item list.
 * Replaces every hand-rolled context menu and dropdown popover.
 */
export function Menu({
  onClose,
  items,
  children,
  point,
  anchorRef,
  className,
  closeOnScroll = point !== undefined,
}: MenuProps) {
  const ref = useRef<HTMLDivElement>(null)
  const [focusIndex, setFocusIndex] = useState(-1)
  const pos = useAnchoredPosition({ point, anchorRef, floatingRef: ref })

  useDismissable({
    onDismiss: onClose,
    insideRefs: anchorRef ? [ref, anchorRef] : [ref],
    closeOnScroll,
  })

  // Keyboard nav for items mode — document-level so it works without focus.
  useEffect(() => {
    if (!items) return
    const handleKey = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowDown':
        case 'j':
          e.preventDefault()
          setFocusIndex((prev) => (prev + 1) % items.length)
          break
        case 'ArrowUp':
        case 'k':
          e.preventDefault()
          setFocusIndex((prev) => (prev - 1 + items.length) % items.length)
          break
        case 'Enter':
          e.preventDefault()
          if (focusIndex >= 0 && focusIndex < items.length) {
            items[focusIndex].action()
            onClose()
          }
          break
      }
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [items, focusIndex, onClose])

  // Auto-focus the container for keyboard nav; scroll focused item into view.
  useEffect(() => {
    if (items) ref.current?.focus()
  }, [items])
  useEffect(() => {
    if (focusIndex >= 0 && ref.current) {
      const buttons = ref.current.querySelectorAll('[role="menuitem"]')
      buttons[focusIndex]?.scrollIntoView?.({ block: 'nearest' })
    }
  }, [focusIndex])

  return createPortal(
    <div
      ref={ref}
      role={items ? 'menu' : undefined}
      tabIndex={-1}
      className={cx(
        'fixed min-w-[140px] rounded-md border border-base2 bg-base3 py-1 shadow-lg outline-none dark:border-base02 dark:bg-base02',
        Z.modal,
        className,
      )}
      style={{
        left: pos.left,
        top: pos.top,
        visibility: pos.ready ? undefined : 'hidden',
      }}
    >
      {items
        ? items.map((item, i) => (
            <button
              key={i}
              type="button"
              role="menuitem"
              onClick={(e) => {
                e.stopPropagation()
                item.action()
                onClose()
              }}
              className={cx(
                'block w-full px-3 py-1.5 text-left text-sm',
                item.danger ? 'text-red' : 'text-base01 dark:text-base1',
                i === focusIndex
                  ? 'bg-base2 dark:bg-base03'
                  : 'hover:bg-base2 dark:hover:bg-base03',
              )}
            >
              {item.label}
            </button>
          ))
        : children}
    </div>,
    document.body,
  )
}
