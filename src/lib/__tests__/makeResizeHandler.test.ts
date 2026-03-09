import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { makeResizeHandler } from '../makeResizeHandler'

describe('makeResizeHandler', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('throttles mousemove to animation frames', () => {
    const setter = vi.fn()
    const startDrag = makeResizeHandler(setter, 100, 500, 'left')

    // Simulate mousedown
    const mouseDownEvent = { preventDefault: vi.fn() } as any
    startDrag(mouseDownEvent)

    // Fire 10 rapid mousemove events with no animation frame between
    for (let i = 0; i < 10; i++) {
      window.dispatchEvent(new MouseEvent('mousemove', { clientX: 200 + i * 10 }))
    }

    // Before RAF fires, setter should NOT have been called 10 times.
    // With throttling: 0 or 1 call. Without: 10 calls.
    expect(setter.mock.calls.length).toBeLessThanOrEqual(1)

    // After one animation frame, the latest value should be applied
    vi.advanceTimersByTime(16) // one frame

    // Clean up: simulate mouseup
    window.dispatchEvent(new MouseEvent('mouseup'))
  })
})
