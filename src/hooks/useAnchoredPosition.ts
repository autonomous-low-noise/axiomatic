import { useLayoutEffect, useState } from 'react'

interface AnchoredPositionOptions {
  /** Anchor mode: position the floating element below this anchor. */
  anchorRef?: { current: HTMLElement | null }
  /** Point mode: position at this viewport point (context menus). */
  point?: { x: number; y: number }
  /** The floating element itself — measured for viewport clamping. */
  floatingRef: { current: HTMLElement | null }
  /** Gap below the anchor in anchor mode. Defaults to 4. */
  offset?: number
  /** Minimum distance from viewport edges. Defaults to 8. */
  margin?: number
}

export interface AnchoredPosition {
  left: number
  top: number
  /** False until a position could be computed — hide the element until then. */
  ready: boolean
}

/**
 * Canonical positioning for floating UI (popovers below an anchor, context
 * menus at a cursor point), clamped to the viewport. Replaces the three
 * divergent hand-rolled positioning schemes.
 */
export function useAnchoredPosition({
  anchorRef,
  point,
  floatingRef,
  offset = 4,
  margin = 8,
}: AnchoredPositionOptions): AnchoredPosition {
  const [pos, setPos] = useState<AnchoredPosition>({ left: 0, top: 0, ready: false })

  useLayoutEffect(() => {
    let left: number
    let top: number
    if (point) {
      left = point.x
      top = point.y
    } else {
      const anchor = anchorRef?.current
      if (!anchor) return
      const rect = anchor.getBoundingClientRect()
      left = rect.left
      top = rect.bottom + offset
    }

    const floating = floatingRef.current
    if (floating) {
      const { width, height } = floating.getBoundingClientRect()
      left = Math.max(margin, Math.min(left, window.innerWidth - width - margin))
      top = Math.max(margin, Math.min(top, window.innerHeight - height - margin))
    }
    setPos((prev) =>
      prev.ready && prev.left === left && prev.top === top
        ? prev
        : { left, top, ready: true },
    )
    // Ref objects are intentionally excluded: their identity is not a signal.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [point?.x, point?.y, offset, margin])

  return pos
}
