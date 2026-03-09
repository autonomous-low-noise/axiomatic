/** Build cumulative section boundary indices from section sizes. */
export function buildBoundaries(sectionSizes: number[]): number[] {
  const boundaries: number[] = []
  let cum = 0
  for (const size of sectionSizes) {
    if (size > 0) {
      boundaries.push(cum)
      cum += size
    }
  }
  return boundaries
}

/** Given a flat index, return the section start, size, local offset, and section index. */
export function findSection(idx: number, boundaries: number[], count: number) {
  for (let i = boundaries.length - 1; i >= 0; i--) {
    if (idx >= boundaries[i]) {
      const start = boundaries[i]
      const end = i + 1 < boundaries.length ? boundaries[i + 1] : count
      return { start, size: end - start, local: idx - start, sectionIdx: i }
    }
  }
  return { start: 0, size: count, local: idx, sectionIdx: 0 }
}

export function moveDown(prev: number, cols: number, boundaries: number[], count: number): number {
  if (prev === -1) return 0
  const sec = findSection(prev, boundaries, count)
  const localRow = Math.floor(sec.local / cols)
  const col = sec.local % cols
  const lastRow = Math.floor((sec.size - 1) / cols)

  if (localRow < lastRow) {
    const next = sec.start + (localRow + 1) * cols + col
    return next < sec.start + sec.size ? next : sec.start + sec.size - 1
  }

  if (sec.sectionIdx + 1 < boundaries.length) {
    const nextStart = boundaries[sec.sectionIdx + 1]
    const target = nextStart + col
    return target < count ? target : count - 1
  }

  return prev
}

export function moveUp(prev: number, cols: number, boundaries: number[], count: number): number {
  if (prev <= 0) return prev
  const sec = findSection(prev, boundaries, count)
  const localRow = Math.floor(sec.local / cols)
  const col = sec.local % cols

  if (localRow > 0) {
    return sec.start + (localRow - 1) * cols + col
  }

  if (sec.sectionIdx > 0) {
    const prevStart = boundaries[sec.sectionIdx - 1]
    const prevEnd = boundaries[sec.sectionIdx]
    const prevSize = prevEnd - prevStart
    const lastPrevRow = Math.floor((prevSize - 1) / cols)
    const target = prevStart + lastPrevRow * cols + col
    return target < prevEnd ? target : prevEnd - 1
  }

  return prev
}

export function moveLeft(prev: number, cols: number, boundaries: number[], count: number): number {
  if (prev <= 0) return prev
  const sec = findSection(prev, boundaries, count)
  const localRowStart = Math.floor(sec.local / cols) * cols
  return sec.local > localRowStart ? prev - 1 : prev
}

export function moveRight(prev: number, cols: number, boundaries: number[], count: number): number {
  if (prev === -1) return 0
  const sec = findSection(prev, boundaries, count)
  const localRowEnd = Math.floor(sec.local / cols) * cols + cols - 1
  const next = prev + 1
  return sec.local < localRowEnd && next < sec.start + sec.size ? next : prev
}

// === Header-aware navigation for collapsible sections ===

export interface NavSection {
  key: string
  expanded: boolean
  tileCount: number
}

export type NavSel =
  | { kind: 'none' }
  | { kind: 'header'; sectionIdx: number }
  | { kind: 'tile'; sectionIdx: number; localIdx: number }

export interface NavAction {
  type: 'expand' | 'collapse'
  sectionKey: string
}

/** Convert a tile NavSel to a flat index into the slugs array (expanded tiles only). */
export function selToTileIndex(sel: NavSel, sections: NavSection[]): number {
  if (sel.kind !== 'tile') return -1
  let offset = 0
  for (let i = 0; i < sel.sectionIdx; i++) {
    if (sections[i].expanded) offset += sections[i].tileCount
  }
  return offset + sel.localIdx
}

/**
 * Find next navigable stop after the given section index.
 * Collapsed sections → header. Expanded sections → first tile (fluent).
 */
function nextStop(afterIdx: number, sections: NavSection[]): NavSel | null {
  for (let i = afterIdx + 1; i < sections.length; i++) {
    if (!sections[i].expanded) return { kind: 'header', sectionIdx: i }
    if (sections[i].tileCount > 0) return { kind: 'tile', sectionIdx: i, localIdx: 0 }
  }
  return null
}

/**
 * Find previous navigable stop before the given section index.
 * Collapsed sections → header. Expanded sections → last tile (matching column).
 */
function prevStop(beforeIdx: number, sections: NavSection[], col: number, cols: number): NavSel | null {
  for (let i = beforeIdx - 1; i >= 0; i--) {
    if (!sections[i].expanded) return { kind: 'header', sectionIdx: i }
    if (sections[i].tileCount > 0) {
      const lastRow = Math.floor((sections[i].tileCount - 1) / cols)
      const target = lastRow * cols + col
      const clamped = Math.min(target, sections[i].tileCount - 1)
      return { kind: 'tile', sectionIdx: i, localIdx: clamped }
    }
  }
  return null
}

export function navDown(sel: NavSel, cols: number, sections: NavSection[]): NavSel {
  if (sections.length === 0) return sel

  if (sel.kind === 'none') {
    // Enter navigation: first section
    if (!sections[0].expanded || sections[0].tileCount === 0) {
      return { kind: 'header', sectionIdx: 0 }
    }
    return { kind: 'tile', sectionIdx: 0, localIdx: 0 }
  }

  if (sel.kind === 'header') {
    const sec = sections[sel.sectionIdx]
    if (sec.expanded && sec.tileCount > 0) {
      return { kind: 'tile', sectionIdx: sel.sectionIdx, localIdx: 0 }
    }
    // Collapsed or empty: skip to next section
    return nextStop(sel.sectionIdx, sections) ?? sel
  }

  // tile
  const sec = sections[sel.sectionIdx]
  const localRow = Math.floor(sel.localIdx / cols)
  const col = sel.localIdx % cols
  const lastRow = Math.floor((sec.tileCount - 1) / cols)

  if (localRow < lastRow) {
    const target = (localRow + 1) * cols + col
    return { kind: 'tile', sectionIdx: sel.sectionIdx, localIdx: Math.min(target, sec.tileCount - 1) }
  }

  // Last row → next section
  const next = nextStop(sel.sectionIdx, sections)
  if (next) {
    if (next.kind === 'tile') {
      // Preserve column in next expanded section
      const nextSec = sections[next.sectionIdx]
      return { kind: 'tile', sectionIdx: next.sectionIdx, localIdx: Math.min(col, nextSec.tileCount - 1) }
    }
    return next
  }
  return sel
}

export function navUp(sel: NavSel, cols: number, sections: NavSection[]): NavSel {
  if (sel.kind === 'none' || sections.length === 0) return sel

  if (sel.kind === 'header') {
    return prevStop(sel.sectionIdx, sections, 0, cols) ?? sel
  }

  // tile
  const localRow = Math.floor(sel.localIdx / cols)
  const col = sel.localIdx % cols

  if (localRow > 0) {
    return { kind: 'tile', sectionIdx: sel.sectionIdx, localIdx: (localRow - 1) * cols + col }
  }

  // First row → previous section
  return prevStop(sel.sectionIdx, sections, col, cols) ?? sel
}

export function navLeftSec(
  sel: NavSel,
  cols: number,
  sections: NavSection[],
): { sel: NavSel; action?: NavAction } {
  if (sel.kind === 'tile') {
    const col = sel.localIdx % cols
    if (col > 0) {
      return { sel: { kind: 'tile', sectionIdx: sel.sectionIdx, localIdx: sel.localIdx - 1 } }
    }
    // Col 0: collapse the section
    const sec = sections[sel.sectionIdx]
    if (sec?.expanded) {
      return {
        sel: { kind: 'header', sectionIdx: sel.sectionIdx },
        action: { type: 'collapse', sectionKey: sec.key },
      }
    }
  }
  return { sel }
}

export function navRightSec(
  sel: NavSel,
  cols: number,
  sections: NavSection[],
): { sel: NavSel; action?: NavAction } {
  if (sel.kind === 'header') {
    const sec = sections[sel.sectionIdx]
    if (!sec.expanded) {
      // Expand and select first tile
      return {
        sel: { kind: 'tile', sectionIdx: sel.sectionIdx, localIdx: 0 },
        action: { type: 'expand', sectionKey: sec.key },
      }
    }
    // Expanded header (e.g. reached via k): go to first tile
    if (sec.tileCount > 0) {
      return { sel: { kind: 'tile', sectionIdx: sel.sectionIdx, localIdx: 0 } }
    }
    return { sel }
  }

  if (sel.kind === 'tile') {
    const sec = sections[sel.sectionIdx]
    const nextIdx = sel.localIdx + 1
    if (nextIdx < sec.tileCount && nextIdx % cols !== 0) {
      return { sel: { kind: 'tile', sectionIdx: sel.sectionIdx, localIdx: nextIdx } }
    }
  }

  return { sel }
}
