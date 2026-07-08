import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useDismissable } from '../useDismissable'

let inside: HTMLDivElement
let anchor: HTMLDivElement
let outside: HTMLDivElement

beforeEach(() => {
  inside = document.createElement('div')
  anchor = document.createElement('div')
  outside = document.createElement('div')
  document.body.append(inside, anchor, outside)
})

afterEach(() => {
  inside.remove()
  anchor.remove()
  outside.remove()
})

function mousedown(target: HTMLElement) {
  target.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }))
}

function keydown(key: string) {
  document.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }))
}

describe('useDismissable', () => {
  it('dismisses on mousedown outside all insideRefs', () => {
    const onDismiss = vi.fn()
    renderHook(() =>
      useDismissable({ onDismiss, insideRefs: [{ current: inside }] }),
    )
    mousedown(outside)
    expect(onDismiss).toHaveBeenCalledTimes(1)
  })

  it('does not dismiss on mousedown inside any insideRef', () => {
    const onDismiss = vi.fn()
    renderHook(() =>
      useDismissable({
        onDismiss,
        insideRefs: [{ current: inside }, { current: anchor }],
      }),
    )
    mousedown(inside)
    mousedown(anchor)
    expect(onDismiss).not.toHaveBeenCalled()
  })

  it('does not dismiss on mousedown inside a child of an insideRef', () => {
    const onDismiss = vi.fn()
    const child = document.createElement('span')
    inside.appendChild(child)
    renderHook(() =>
      useDismissable({ onDismiss, insideRefs: [{ current: inside }] }),
    )
    mousedown(child)
    expect(onDismiss).not.toHaveBeenCalled()
  })

  it('dismisses on Escape keydown', () => {
    const onDismiss = vi.fn()
    renderHook(() =>
      useDismissable({ onDismiss, insideRefs: [{ current: inside }] }),
    )
    keydown('Escape')
    expect(onDismiss).toHaveBeenCalledTimes(1)
  })

  it('ignores other keys', () => {
    const onDismiss = vi.fn()
    renderHook(() =>
      useDismissable({ onDismiss, insideRefs: [{ current: inside }] }),
    )
    keydown('Enter')
    keydown('a')
    expect(onDismiss).not.toHaveBeenCalled()
  })

  it('does nothing when enabled is false', () => {
    const onDismiss = vi.fn()
    renderHook(() =>
      useDismissable({
        onDismiss,
        insideRefs: [{ current: inside }],
        enabled: false,
      }),
    )
    mousedown(outside)
    keydown('Escape')
    expect(onDismiss).not.toHaveBeenCalled()
  })

  it('dismisses on scroll when closeOnScroll is set', () => {
    const onDismiss = vi.fn()
    renderHook(() =>
      useDismissable({
        onDismiss,
        insideRefs: [{ current: inside }],
        closeOnScroll: true,
      }),
    )
    window.dispatchEvent(new Event('scroll'))
    expect(onDismiss).toHaveBeenCalledTimes(1)
  })

  it('does not dismiss on scroll by default', () => {
    const onDismiss = vi.fn()
    renderHook(() =>
      useDismissable({ onDismiss, insideRefs: [{ current: inside }] }),
    )
    window.dispatchEvent(new Event('scroll'))
    expect(onDismiss).not.toHaveBeenCalled()
  })

  it('detaches listeners on unmount', () => {
    const onDismiss = vi.fn()
    const { unmount } = renderHook(() =>
      useDismissable({ onDismiss, insideRefs: [{ current: inside }] }),
    )
    unmount()
    mousedown(outside)
    keydown('Escape')
    expect(onDismiss).not.toHaveBeenCalled()
  })

  it('skips click-outside when closeOnClickOutside is false but keeps Escape', () => {
    const onDismiss = vi.fn()
    renderHook(() =>
      useDismissable({
        onDismiss,
        insideRefs: [{ current: inside }],
        closeOnClickOutside: false,
      }),
    )
    mousedown(outside)
    expect(onDismiss).not.toHaveBeenCalled()
    keydown('Escape')
    expect(onDismiss).toHaveBeenCalledTimes(1)
  })

  it('treats a null ref as non-blocking (still dismisses outside)', () => {
    const onDismiss = vi.fn()
    renderHook(() =>
      useDismissable({
        onDismiss,
        insideRefs: [{ current: null }, { current: inside }],
      }),
    )
    mousedown(outside)
    expect(onDismiss).toHaveBeenCalledTimes(1)
  })
})
