import { describe, it, expect } from 'vitest'
import { clampPanelWidths } from '../layout'

describe('clampPanelWidths', () => {
  it('returns widths unchanged when window is wide enough', () => {
    const result = clampPanelWidths(1920, { outline: 200, notes: 384 })
    expect(result).toEqual({ outline: 200, notes: 384 })
  })

  it('returns empty object when no panels are open', () => {
    const result = clampPanelWidths(800, {})
    expect(result).toEqual({})
  })

  it('shrinks panels proportionally when total exceeds available space', () => {
    // windowWidth=600, outline=200 + handle(6) + notes=384 + handle(6) + minContent(300) = 896
    // available for panels = 600 - 300 - 12 = 288
    // outline ratio = 200/584, notes ratio = 384/584
    // outline gets 288 * 200/584 ≈ 98.6 → clamped to min 120
    // But if outline is clamped to 120, remaining = 288 - 120 = 168 → notes gets 168
    // notes min is 240, so notes gets clamped to 240 — but that's 120+240=360 > 288
    // Actually let me rethink. Let me use a bigger window.

    // windowWidth=800, outline=300 + handle(6) + notes=400 + handle(6) + minContent(300) = 1012
    // available for panels = 800 - 300 - 12 = 488
    // total requested = 700, needs to fit in 488
    // proportional: outline = 488 * 300/700 ≈ 209, notes = 488 * 400/700 ≈ 279
    // both above their minimums (120, 240) → ok
    const result = clampPanelWidths(800, { outline: 300, notes: 400 })
    expect(result.outline).toBeLessThan(300)
    expect(result.notes).toBeLessThan(400)
    expect(result.outline! + result.notes!).toBeLessThanOrEqual(800 - 300 - 12)
    // Proportional: outline should be roughly 60% of notes' width (300/400 ratio)
    expect(result.outline! / result.notes!).toBeCloseTo(300 / 400, 1)
  })

  it('respects minimum panel widths', () => {
    // Very narrow window: all panels get clamped to minimums
    const result = clampPanelWidths(400, { outline: 200, notes: 384 })
    expect(result.outline).toBeGreaterThanOrEqual(120)
    expect(result.notes).toBeGreaterThanOrEqual(240)
  })

  it('handles a single panel that needs clamping', () => {
    // windowWidth=700, notes=500 + handle(6) + minContent(300) = 806
    // available = 700 - 300 - 6 = 394
    const result = clampPanelWidths(700, { notes: 500 })
    expect(result.notes).toBeLessThanOrEqual(394)
    expect(result.notes).toBeGreaterThanOrEqual(240) // notes min
  })

  it('clamps to minimum even when available space is less than minimum', () => {
    // windowWidth=500, available = 500 - 300 - 6 = 194 < notes min (240)
    // Panel gets its minimum — content area absorbs the squeeze
    const result = clampPanelWidths(500, { notes: 500 })
    expect(result.notes).toBe(240)
  })

  it('clamps panels to their max widths', () => {
    const result = clampPanelWidths(3000, { outline: 600, notes: 900 })
    expect(result.outline).toBeLessThanOrEqual(500) // outline max is 500
    expect(result.notes).toBeLessThanOrEqual(800) // notes max is 800
  })

  it('handles all four panels open at once', () => {
    const result = clampPanelWidths(1200, {
      outline: 200,
      notes: 384,
      highlights: 280,
      bookmarks: 280,
    })
    const totalHandles = 4 * 6
    const totalPanels = (result.outline ?? 0) + (result.notes ?? 0) +
      (result.highlights ?? 0) + (result.bookmarks ?? 0)
    // Must leave at least 300px for content
    expect(totalPanels + totalHandles).toBeLessThanOrEqual(1200 - 300)
  })

  it('only includes keys for panels that were passed in', () => {
    const result = clampPanelWidths(1920, { notes: 384 })
    expect(result).toEqual({ notes: 384 })
    expect('outline' in result).toBe(false)
  })
})
