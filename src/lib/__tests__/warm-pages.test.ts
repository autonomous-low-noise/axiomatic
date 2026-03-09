import { describe, it, expect } from 'vitest'
import { pruneWarmPages } from '../warm-pages'

describe('pruneWarmPages', () => {
  it('removes entries far below visible range', () => {
    const warm = new Set(['1:800', '2:800', '50:800'])
    pruneWarmPages(warm, 45, 55, 10)
    expect(warm.has('1:800')).toBe(false)
    expect(warm.has('2:800')).toBe(false)
    expect(warm.has('50:800')).toBe(true)
  })

  it('removes entries far above visible range', () => {
    const warm = new Set(['50:800', '100:800', '200:800'])
    pruneWarmPages(warm, 45, 55, 10)
    expect(warm.has('50:800')).toBe(true)
    expect(warm.has('100:800')).toBe(false)
    expect(warm.has('200:800')).toBe(false)
  })

  it('preserves entries within margin of visible range', () => {
    const warm = new Set(['35:800', '45:800', '55:800', '65:800'])
    pruneWarmPages(warm, 45, 55, 10)
    expect(warm.has('35:800')).toBe(true)  // 45 - 10 = 35, within margin
    expect(warm.has('45:800')).toBe(true)
    expect(warm.has('55:800')).toBe(true)
    expect(warm.has('65:800')).toBe(true)  // 55 + 10 = 65, within margin
  })

  it('handles entries at multiple widths', () => {
    const warm = new Set(['1:800', '1:1200', '50:800', '50:1200'])
    pruneWarmPages(warm, 45, 55, 10)
    expect(warm.has('1:800')).toBe(false)
    expect(warm.has('1:1200')).toBe(false)
    expect(warm.has('50:800')).toBe(true)
    expect(warm.has('50:1200')).toBe(true)
  })

  it('no-ops when all entries are within range', () => {
    const warm = new Set(['48:800', '50:800', '52:800'])
    pruneWarmPages(warm, 45, 55, 10)
    expect(warm.size).toBe(3)
  })
})
