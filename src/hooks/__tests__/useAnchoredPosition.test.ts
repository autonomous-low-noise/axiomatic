import { describe, it, expect, beforeEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useAnchoredPosition } from '../useAnchoredPosition'

function fakeRect(overrides: Partial<DOMRect>): DOMRect {
  return {
    x: 0,
    y: 0,
    left: 0,
    top: 0,
    right: 0,
    bottom: 0,
    width: 0,
    height: 0,
    toJSON: () => ({}),
    ...overrides,
  } as DOMRect
}

function elementWithRect(overrides: Partial<DOMRect>): HTMLElement {
  const el = document.createElement('div')
  el.getBoundingClientRect = () => fakeRect(overrides)
  document.body.appendChild(el)
  return el
}

// jsdom defaults: window.innerWidth = 1024, window.innerHeight = 768
beforeEach(() => {
  document.body.innerHTML = ''
})

describe('useAnchoredPosition — anchor mode', () => {
  it('positions below the anchor with the default 4px offset', () => {
    const anchor = elementWithRect({ left: 100, bottom: 200 })
    const floating = elementWithRect({ width: 50, height: 50 })
    const { result } = renderHook(() =>
      useAnchoredPosition({
        anchorRef: { current: anchor },
        floatingRef: { current: floating },
      }),
    )
    expect(result.current.ready).toBe(true)
    expect(result.current.left).toBe(100)
    expect(result.current.top).toBe(204)
  })

  it('respects a custom offset', () => {
    const anchor = elementWithRect({ left: 10, bottom: 20 })
    const floating = elementWithRect({ width: 50, height: 50 })
    const { result } = renderHook(() =>
      useAnchoredPosition({
        anchorRef: { current: anchor },
        floatingRef: { current: floating },
        offset: 10,
      }),
    )
    expect(result.current.top).toBe(30)
  })

  it('is not ready when the anchor is missing', () => {
    const floating = elementWithRect({ width: 50, height: 50 })
    const { result } = renderHook(() =>
      useAnchoredPosition({
        anchorRef: { current: null },
        floatingRef: { current: floating },
      }),
    )
    expect(result.current.ready).toBe(false)
  })
})

describe('useAnchoredPosition — point mode', () => {
  it('uses the point directly when it fits in the viewport', () => {
    const floating = elementWithRect({ width: 200, height: 100 })
    const { result } = renderHook(() =>
      useAnchoredPosition({
        point: { x: 300, y: 400 },
        floatingRef: { current: floating },
      }),
    )
    expect(result.current.ready).toBe(true)
    expect(result.current.left).toBe(300)
    expect(result.current.top).toBe(400)
  })

  it('clamps to the right/bottom viewport edges with the default 8px margin', () => {
    const floating = elementWithRect({ width: 200, height: 100 })
    const { result } = renderHook(() =>
      useAnchoredPosition({
        point: { x: 1000, y: 700 },
        floatingRef: { current: floating },
      }),
    )
    // 1024 - 200 - 8 = 816, 768 - 100 - 8 = 660
    expect(result.current.left).toBe(816)
    expect(result.current.top).toBe(660)
  })

  it('clamps to the top/left margin floor', () => {
    const floating = elementWithRect({ width: 200, height: 100 })
    const { result } = renderHook(() =>
      useAnchoredPosition({
        point: { x: -50, y: -50 },
        floatingRef: { current: floating },
      }),
    )
    expect(result.current.left).toBe(8)
    expect(result.current.top).toBe(8)
  })

  it('recomputes when the point changes', () => {
    const floating = elementWithRect({ width: 200, height: 100 })
    const { result, rerender } = renderHook(
      ({ point }) =>
        useAnchoredPosition({ point, floatingRef: { current: floating } }),
      { initialProps: { point: { x: 10, y: 10 } } },
    )
    expect(result.current.left).toBe(10)
    rerender({ point: { x: 20, y: 30 } })
    expect(result.current.left).toBe(20)
    expect(result.current.top).toBe(30)
  })
})
