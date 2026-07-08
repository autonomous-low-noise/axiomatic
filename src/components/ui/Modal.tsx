import { useEffect, useRef, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { useDismissable } from '../../hooks/useDismissable'
import { cx } from '../../lib/cx'
import { Z } from '../../lib/zIndex'

interface ModalProps {
  onClose: () => void
  children: ReactNode
  ariaLabel: string
  /** Extra classes for the dialog card (width, padding). */
  className?: string
  /** Override the scrim (e.g. break overlays use a solid tint). */
  scrimClassName?: string
}

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

/**
 * The canonical modal dialog: portal, scrim, centered card, Escape and
 * scrim-click dismiss, and Tab focus trapping (which no hand-rolled
 * dialog implemented).
 */
export function Modal({
  onClose,
  children,
  ariaLabel,
  className,
  scrimClassName,
}: ModalProps) {
  const cardRef = useRef<HTMLDivElement>(null)

  useDismissable({ onDismiss: onClose, insideRefs: [cardRef] })

  // Move focus inside on mount so keyboard/screen-reader users land in the dialog.
  useEffect(() => {
    cardRef.current?.focus()
  }, [])

  const trapTab = (e: React.KeyboardEvent) => {
    if (e.key !== 'Tab' || !cardRef.current) return
    const focusable = cardRef.current.querySelectorAll<HTMLElement>(FOCUSABLE)
    if (focusable.length === 0) return
    const first = focusable[0]
    const last = focusable[focusable.length - 1]
    const current = document.activeElement
    if (e.shiftKey && (current === first || current === cardRef.current)) {
      e.preventDefault()
      last.focus()
    } else if (!e.shiftKey && current === last) {
      e.preventDefault()
      first.focus()
    }
  }

  return createPortal(
    <div
      data-testid="modal-scrim"
      className={cx(
        'fixed inset-0 flex items-center justify-center',
        Z.modal,
        scrimClassName ?? 'bg-black/50',
      )}
    >
      <div
        ref={cardRef}
        role="dialog"
        aria-modal="true"
        aria-label={ariaLabel}
        tabIndex={-1}
        onKeyDown={trapTab}
        className={cx(
          'rounded-lg border border-base2 bg-base3 shadow-xl outline-none dark:border-base02 dark:bg-base03',
          className,
        )}
      >
        {children}
      </div>
    </div>,
    document.body,
  )
}
