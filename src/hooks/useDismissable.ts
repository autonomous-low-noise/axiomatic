import { useEffect, useLayoutEffect, useRef } from 'react'

interface DismissableOptions {
  onDismiss: () => void
  /** Elements whose subtrees do NOT count as "outside" (the popover itself, its anchor). */
  insideRefs: Array<{ current: HTMLElement | null }>
  /** Also dismiss on any scroll (context menus that would detach from their point). */
  closeOnScroll?: boolean
  /** Set false for persistent surfaces (drawers) that only close on Escape. Defaults to true. */
  closeOnClickOutside?: boolean
  /** Master switch — pass false while the element is closed. Defaults to true. */
  enabled?: boolean
}

/**
 * Canonical dismiss lifecycle for floating UI: Escape and click-outside
 * (and optionally scroll) call onDismiss. Replaces the per-component
 * document-listener boilerplate previously copied across menus/popovers.
 */
export function useDismissable({
  onDismiss,
  insideRefs,
  closeOnScroll = false,
  closeOnClickOutside = true,
  enabled = true,
}: DismissableOptions) {
  // Keep latest callbacks/refs in a ref so listeners attach once per enable-cycle.
  const stateRef = useRef({ onDismiss, insideRefs })
  useLayoutEffect(() => {
    stateRef.current = { onDismiss, insideRefs }
  })

  useEffect(() => {
    if (!enabled) return

    const handleMouseDown = (e: MouseEvent) => {
      const { onDismiss, insideRefs } = stateRef.current
      const target = e.target as Node
      const inside = insideRefs.some(
        (ref) => ref.current !== null && ref.current.contains(target),
      )
      if (!inside) onDismiss()
    }
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') stateRef.current.onDismiss()
    }
    const handleScroll = () => stateRef.current.onDismiss()

    if (closeOnClickOutside) document.addEventListener('mousedown', handleMouseDown)
    document.addEventListener('keydown', handleKeyDown)
    if (closeOnScroll) window.addEventListener('scroll', handleScroll, true)
    return () => {
      if (closeOnClickOutside) document.removeEventListener('mousedown', handleMouseDown)
      document.removeEventListener('keydown', handleKeyDown)
      if (closeOnScroll) window.removeEventListener('scroll', handleScroll, true)
    }
  }, [enabled, closeOnScroll, closeOnClickOutside])
}
