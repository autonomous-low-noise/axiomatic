const HANDLE_WIDTH = 6 // w-1.5 = 6px resize handle
const MIN_CONTENT_WIDTH = 300

const PANEL_BOUNDS = {
  outline: { min: 120, max: 500 },
  notes: { min: 240, max: 800 },
  highlights: { min: 180, max: 500 },
  bookmarks: { min: 180, max: 500 },
} as const

type PanelName = keyof typeof PANEL_BOUNDS

export type PanelWidths = Partial<Record<PanelName, number>>

export function clampPanelWidths(windowWidth: number, panels: PanelWidths): PanelWidths {
  const keys = (Object.keys(panels) as PanelName[]).filter((k) => panels[k] !== undefined)
  if (keys.length === 0) return {}

  // First clamp each to its max
  const clamped: PanelWidths = {}
  for (const k of keys) {
    clamped[k] = Math.min(panels[k]!, PANEL_BOUNDS[k].max)
  }

  const totalHandles = keys.length * HANDLE_WIDTH
  const available = windowWidth - MIN_CONTENT_WIDTH - totalHandles

  const totalRequested = keys.reduce((sum, k) => sum + clamped[k]!, 0)

  if (totalRequested <= available) return clamped

  // Need to shrink — proportional reduction respecting minimums
  // Iterative: shrink proportionally, clamp to mins, redistribute
  const result: PanelWidths = {}
  const locked = new Set<PanelName>()
  let remaining = available

  // Iterate until stable
  for (let iter = 0; iter < keys.length; iter++) {
    const unlocked = keys.filter((k) => !locked.has(k))
    if (unlocked.length === 0) break

    const unlockedTotal = unlocked.reduce((sum, k) => sum + clamped[k]!, 0)
    let anyLocked = false

    for (const k of unlocked) {
      const share = Math.round((clamped[k]! / unlockedTotal) * remaining)
      if (share < PANEL_BOUNDS[k].min) {
        result[k] = PANEL_BOUNDS[k].min
        locked.add(k)
        remaining -= PANEL_BOUNDS[k].min
        anyLocked = true
      }
    }

    if (!anyLocked) {
      // All remaining panels fit proportionally
      for (const k of unlocked) {
        result[k] = Math.round((clamped[k]! / unlockedTotal) * remaining)
      }
      break
    }
  }

  // Fill any unset keys (shouldn't happen, but safety)
  for (const k of keys) {
    if (result[k] === undefined) {
      result[k] = PANEL_BOUNDS[k].min
    }
  }

  return result
}
