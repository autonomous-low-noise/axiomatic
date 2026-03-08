import { describe, it, expect } from 'vitest'
import { clampZoom } from '../useVimReader'

describe('clampZoom', () => {
  it('returns value unchanged when within bounds', () => {
    expect(clampZoom(1)).toBe(1)
    expect(clampZoom(2.5)).toBe(2.5)
  })

  it('clamps to MIN_ZOOM (0.25) when below', () => {
    expect(clampZoom(0.1)).toBe(0.25)
    expect(clampZoom(0)).toBe(0.25)
    expect(clampZoom(-1)).toBe(0.25)
  })

  it('clamps to MAX_ZOOM (5) when above', () => {
    expect(clampZoom(6)).toBe(5)
    expect(clampZoom(100)).toBe(5)
  })

  it('rounds to 2 decimal places', () => {
    expect(clampZoom(1.116)).toBe(1.12)
    expect(clampZoom(1.111)).toBe(1.11)
    expect(clampZoom(3.999)).toBe(4)
  })

  it('handles exact boundary values', () => {
    expect(clampZoom(0.25)).toBe(0.25)
    expect(clampZoom(5)).toBe(5)
  })
})
