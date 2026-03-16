import { describe, it, expect, vi } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import type { Snip } from '../../hooks/useSnips'

// Mock SnipImage to expose onSize callback and simulate canvas dimensions
vi.mock('../SnipImage', () => ({
  SnipImage: ({ snip, onSize }: { snip: Snip; className?: string; onSize?: (w: number, h: number) => void }) => {
    // Simulate async image load: call onSize after a microtask
    if (onSize) {
      // Use the snip id to vary sizes for testing
      const w = snip.id === 'snip-large' ? 800 : 300
      const h = snip.id === 'snip-large' ? 600 : 200
      Promise.resolve().then(() => onSize(w, h))
    }
    return <canvas data-testid="snip-canvas" />
  },
}))

import { ZoomableSnipImage } from '../ZoomableSnipImage'

function makeSnip(overrides: Partial<Snip> = {}): Snip {
  return {
    id: 'snip-1',
    slug: 'test_book',
    full_path: '/dir/test_book.pdf',
    page: 1,
    label: 'Snip 1',
    x: 0.1,
    y: 0.2,
    width: 0.5,
    height: 0.3,
    created_at: '2024-01-01T00:00:00Z',
    tags: [],
    ...overrides,
  }
}

describe('ZoomableSnipImage', () => {
  it('sizes container from SnipImage onSize callback', async () => {
    const snip = makeSnip()
    render(<ZoomableSnipImage snip={snip} />)

    // Wait for the microtask (simulated image load) to fire onSize
    await act(() => Promise.resolve())

    const scrollWrapper = screen.getByTestId('snip-zoom-container').parentElement!
    expect(scrollWrapper.style.width).toBe('300px')
    expect(scrollWrapper.style.height).toBe('200px')
  })

  it('updates container when snip changes to a larger image', async () => {
    const { rerender } = render(<ZoomableSnipImage snip={makeSnip()} />)

    await act(() => Promise.resolve())
    const scrollWrapper = screen.getByTestId('snip-zoom-container').parentElement!
    expect(scrollWrapper.style.width).toBe('300px')

    // Switch to a larger snip
    rerender(<ZoomableSnipImage snip={makeSnip({ id: 'snip-large' })} />)
    await act(() => Promise.resolve())

    expect(scrollWrapper.style.width).toBe('800px')
    expect(scrollWrapper.style.height).toBe('600px')
  })
})
