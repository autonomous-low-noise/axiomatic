import { describe, it, expect } from 'vitest'
import {
  buildBoundaries, findSection, moveDown, moveUp, moveLeft, moveRight,
  navDown, navUp, navLeftSec, navRightSec, selToTileIndex,
  type NavSection, type NavSel,
} from '../grid-nav'

// Test grid layout:
// Section 0 (starred): 3 items  → indices 0, 1, 2
// Section 1 (dir A):   5 items  → indices 3, 4, 5, 6, 7
// Section 2 (dir B):   4 items  → indices 8, 9, 10, 11
// Total: 12 items, cols = 3
//
// Visual (3 cols):
// Section 0:  [0] [1] [2]
// Section 1:  [3] [4] [5]
//             [6] [7]
// Section 2:  [8] [9] [10]
//             [11]

const sectionSizes = [3, 5, 4]
const boundaries = buildBoundaries(sectionSizes)
const count = 12
const cols = 3

describe('buildBoundaries', () => {
  it('builds cumulative boundaries from section sizes', () => {
    expect(buildBoundaries([3, 5, 4])).toEqual([0, 3, 8])
  })

  it('skips zero-size sections', () => {
    expect(buildBoundaries([3, 0, 5])).toEqual([0, 3])
  })

  it('returns empty for no sections', () => {
    expect(buildBoundaries([])).toEqual([])
  })
})

describe('findSection', () => {
  it('finds section for index in first section', () => {
    const sec = findSection(1, boundaries, count)
    expect(sec).toEqual({ start: 0, size: 3, local: 1, sectionIdx: 0 })
  })

  it('finds section for index in middle section', () => {
    const sec = findSection(5, boundaries, count)
    expect(sec).toEqual({ start: 3, size: 5, local: 2, sectionIdx: 1 })
  })

  it('finds section for index in last section', () => {
    const sec = findSection(10, boundaries, count)
    expect(sec).toEqual({ start: 8, size: 4, local: 2, sectionIdx: 2 })
  })

  it('handles first index of a section', () => {
    const sec = findSection(3, boundaries, count)
    expect(sec).toEqual({ start: 3, size: 5, local: 0, sectionIdx: 1 })
  })
})

describe('moveDown', () => {
  it('activates first item from unselected state (-1)', () => {
    expect(moveDown(-1, cols, boundaries, count)).toBe(0)
  })

  it('moves down within a section', () => {
    // From [3] (row 0 of section 1) → [6] (row 1 of section 1)
    expect(moveDown(3, cols, boundaries, count)).toBe(6)
  })

  it('preserves column when moving down', () => {
    // From [4] (row 0, col 1 of section 1) → [7] (row 1, col 1)
    expect(moveDown(4, cols, boundaries, count)).toBe(7)
  })

  it('crosses to next section from last row', () => {
    // From [6] (last row of section 1, col 0) → [8] (first row of section 2, col 0)
    expect(moveDown(6, cols, boundaries, count)).toBe(8)
  })

  it('preserves column when crossing sections', () => {
    // From [7] (last row of section 1, col 1) → [9] (section 2, col 1)
    expect(moveDown(7, cols, boundaries, count)).toBe(9)
  })

  it('clamps to last item when column exceeds next section size', () => {
    // From [2] (section 0, col 2) → [5] (section 1, col 2)
    expect(moveDown(2, cols, boundaries, count)).toBe(5)
  })

  it('stays put at last row of last section', () => {
    expect(moveDown(11, cols, boundaries, count)).toBe(11)
  })

  it('snaps to last item when target exceeds section size', () => {
    // Section 1 has 5 items: indices 3,4,5,6,7
    // From [5] (row 0, col 2), down goes to row 1 col 2 = index 3+1*3+2=8
    // But 8 >= 3+5=8, so clamp to 7
    expect(moveDown(5, cols, boundaries, count)).toBe(7)
  })
})

describe('moveUp', () => {
  it('stays at 0', () => {
    expect(moveUp(0, cols, boundaries, count)).toBe(0)
  })

  it('stays at -1', () => {
    expect(moveUp(-1, cols, boundaries, count)).toBe(-1)
  })

  it('moves up within a section', () => {
    // From [6] (row 1 of section 1) → [3] (row 0)
    expect(moveUp(6, cols, boundaries, count)).toBe(3)
  })

  it('crosses to previous section from first row', () => {
    // From [3] (first row of section 1, col 0) → [0] (last row of section 0, col 0)
    expect(moveUp(3, cols, boundaries, count)).toBe(0)
  })

  it('preserves column crossing sections up', () => {
    // From [4] (section 1, row 0, col 1) → [1] (section 0, row 0, col 1)
    expect(moveUp(4, cols, boundaries, count)).toBe(1)
  })

  it('clamps to last item of previous section when column exceeds', () => {
    // From [8] (section 2, row 0, col 0) → section 1 last row col 0 = [6]
    expect(moveUp(8, cols, boundaries, count)).toBe(6)
  })

  it('handles crossing to section with incomplete last row', () => {
    // From [9] (section 2, row 0, col 1) → section 1 last row col 1 = [7]
    expect(moveUp(9, cols, boundaries, count)).toBe(7)
  })
})

describe('moveLeft', () => {
  it('stays at 0', () => {
    expect(moveLeft(0, cols, boundaries, count)).toBe(0)
  })

  it('moves left within a row', () => {
    expect(moveLeft(1, cols, boundaries, count)).toBe(0)
    expect(moveLeft(5, cols, boundaries, count)).toBe(4)
  })

  it('does not cross row boundary', () => {
    // [3] is start of a row in section 1
    expect(moveLeft(3, cols, boundaries, count)).toBe(3)
    // [6] is start of second row in section 1
    expect(moveLeft(6, cols, boundaries, count)).toBe(6)
  })
})

describe('moveRight', () => {
  it('activates first item from -1', () => {
    expect(moveRight(-1, cols, boundaries, count)).toBe(0)
  })

  it('moves right within a row', () => {
    expect(moveRight(0, cols, boundaries, count)).toBe(1)
    expect(moveRight(3, cols, boundaries, count)).toBe(4)
  })

  it('does not cross row boundary', () => {
    // [2] is end of row in section 0 (col 2 of 3)
    expect(moveRight(2, cols, boundaries, count)).toBe(2)
  })

  it('does not exceed section size', () => {
    // [7] is last item in section 1, on its own partial row
    expect(moveRight(7, cols, boundaries, count)).toBe(7)
  })

  it('stays at last item', () => {
    expect(moveRight(11, cols, boundaries, count)).toBe(11)
  })
})

// === Header-aware nav tests ===
//
// Mixed layout (3 cols):
//   Section 0 (starred, expanded, 3 tiles):  [0] [1] [2]
//   Section 1 (dir-1,   collapsed, 5 tiles):  <header>
//   Section 2 (dir-2,   expanded, 4 tiles):  [0] [1] [2]
//                                             [3]
//
// slugs (expanded only): starred tiles 0–2, dir-2 tiles 3–6
//   flat indices: starred 0,1,2  dir-2 3,4,5,6

const mixed: NavSection[] = [
  { key: 'starred', expanded: true, tileCount: 3 },
  { key: 'dir-1', expanded: false, tileCount: 5 },
  { key: 'dir-2', expanded: true, tileCount: 4 },
]
const navCols = 3

describe('selToTileIndex', () => {
  it('returns flat index for tile in first expanded section', () => {
    expect(selToTileIndex({ kind: 'tile', sectionIdx: 0, localIdx: 1 }, mixed)).toBe(1)
  })

  it('skips collapsed sections when computing flat index', () => {
    // dir-2 is section 2, but section 1 is collapsed (0 tiles in slugs)
    expect(selToTileIndex({ kind: 'tile', sectionIdx: 2, localIdx: 0 }, mixed)).toBe(3)
    expect(selToTileIndex({ kind: 'tile', sectionIdx: 2, localIdx: 2 }, mixed)).toBe(5)
  })

  it('returns -1 for header', () => {
    expect(selToTileIndex({ kind: 'header', sectionIdx: 1 }, mixed)).toBe(-1)
  })

  it('returns -1 for none', () => {
    expect(selToTileIndex({ kind: 'none' }, mixed)).toBe(-1)
  })
})

describe('navDown (header-aware)', () => {
  it('from none + first section expanded → first tile', () => {
    expect(navDown({ kind: 'none' }, navCols, mixed)).toEqual({
      kind: 'tile', sectionIdx: 0, localIdx: 0,
    })
  })

  it('from none + first section collapsed → first header', () => {
    const collapsed: NavSection[] = [
      { key: 'a', expanded: false, tileCount: 2 },
      { key: 'b', expanded: true, tileCount: 3 },
    ]
    expect(navDown({ kind: 'none' }, navCols, collapsed)).toEqual({
      kind: 'header', sectionIdx: 0,
    })
  })

  it('from collapsed header → next section', () => {
    // Header of dir-1 (collapsed) → dir-2 is expanded → first tile
    const sel: NavSel = { kind: 'header', sectionIdx: 1 }
    expect(navDown(sel, navCols, mixed)).toEqual({
      kind: 'tile', sectionIdx: 2, localIdx: 0,
    })
  })

  it('from collapsed header → next collapsed header', () => {
    const allClosed: NavSection[] = [
      { key: 'a', expanded: false, tileCount: 2 },
      { key: 'b', expanded: false, tileCount: 3 },
    ]
    expect(navDown({ kind: 'header', sectionIdx: 0 }, navCols, allClosed)).toEqual({
      kind: 'header', sectionIdx: 1,
    })
  })

  it('from expanded header → first tile of section', () => {
    const sel: NavSel = { kind: 'header', sectionIdx: 0 }
    expect(navDown(sel, navCols, mixed)).toEqual({
      kind: 'tile', sectionIdx: 0, localIdx: 0,
    })
  })

  it('tile within section moves down', () => {
    // dir-2, localIdx 0 (row 0, col 0) → localIdx 3 (row 1, col 0)
    const sel: NavSel = { kind: 'tile', sectionIdx: 2, localIdx: 0 }
    expect(navDown(sel, navCols, mixed)).toEqual({
      kind: 'tile', sectionIdx: 2, localIdx: 3,
    })
  })

  it('tile clamps to last item when column exceeds row', () => {
    // dir-2, localIdx 1 (row 0, col 1) → row 1 col 1 = 4, but only 4 items (indices 0-3)
    const sel: NavSel = { kind: 'tile', sectionIdx: 2, localIdx: 1 }
    expect(navDown(sel, navCols, mixed)).toEqual({
      kind: 'tile', sectionIdx: 2, localIdx: 3,
    })
  })

  it('last row of expanded → next collapsed header (not fluent)', () => {
    // starred last row (row 0), next is collapsed dir-1
    const sel: NavSel = { kind: 'tile', sectionIdx: 0, localIdx: 0 }
    expect(navDown(sel, navCols, mixed)).toEqual({
      kind: 'header', sectionIdx: 1,
    })
  })

  it('last row of expanded → next expanded first tile (fluent)', () => {
    const twoExpanded: NavSection[] = [
      { key: 'a', expanded: true, tileCount: 3 },
      { key: 'b', expanded: true, tileCount: 4 },
    ]
    // a, row 0 col 0 → b first tile col 0
    expect(navDown({ kind: 'tile', sectionIdx: 0, localIdx: 0 }, navCols, twoExpanded)).toEqual({
      kind: 'tile', sectionIdx: 1, localIdx: 0,
    })
  })

  it('fluent cross-section preserves column', () => {
    const twoExpanded: NavSection[] = [
      { key: 'a', expanded: true, tileCount: 3 },
      { key: 'b', expanded: true, tileCount: 4 },
    ]
    // a, col 2 → b col 2
    expect(navDown({ kind: 'tile', sectionIdx: 0, localIdx: 2 }, navCols, twoExpanded)).toEqual({
      kind: 'tile', sectionIdx: 1, localIdx: 2,
    })
  })

  it('last section last row stays put', () => {
    const sel: NavSel = { kind: 'tile', sectionIdx: 2, localIdx: 3 }
    expect(navDown(sel, navCols, mixed)).toEqual(sel)
  })

  it('last collapsed header stays put', () => {
    const sel: NavSel = { kind: 'header', sectionIdx: 1 }
    const onlyClosed: NavSection[] = [
      { key: 'a', expanded: true, tileCount: 3 },
      { key: 'b', expanded: false, tileCount: 5 },
    ]
    expect(navDown(sel, navCols, onlyClosed)).toEqual(sel)
  })
})

describe('navUp (header-aware)', () => {
  it('from none stays none', () => {
    expect(navUp({ kind: 'none' }, navCols, mixed)).toEqual({ kind: 'none' })
  })

  it('header + prev expanded → last tile matching column', () => {
    // dir-1 header, prev is starred (expanded, 3 tiles, 1 row of 3)
    const sel: NavSel = { kind: 'header', sectionIdx: 1 }
    // col defaults to 0 for headers
    expect(navUp(sel, navCols, mixed)).toEqual({
      kind: 'tile', sectionIdx: 0, localIdx: 0,
    })
  })

  it('header + prev collapsed → prev header', () => {
    const twoClosed: NavSection[] = [
      { key: 'a', expanded: false, tileCount: 2 },
      { key: 'b', expanded: false, tileCount: 3 },
    ]
    expect(navUp({ kind: 'header', sectionIdx: 1 }, navCols, twoClosed)).toEqual({
      kind: 'header', sectionIdx: 0,
    })
  })

  it('first header stays put', () => {
    const sel: NavSel = { kind: 'header', sectionIdx: 0 }
    const sections: NavSection[] = [{ key: 'a', expanded: false, tileCount: 2 }]
    expect(navUp(sel, navCols, sections)).toEqual(sel)
  })

  it('tile moves up within section', () => {
    // dir-2, localIdx 3 (row 1) → localIdx 0 (row 0)
    const sel: NavSel = { kind: 'tile', sectionIdx: 2, localIdx: 3 }
    expect(navUp(sel, navCols, mixed)).toEqual({
      kind: 'tile', sectionIdx: 2, localIdx: 0,
    })
  })

  it('first row + prev collapsed → prev header', () => {
    // dir-2 first row, prev is dir-1 (collapsed)
    const sel: NavSel = { kind: 'tile', sectionIdx: 2, localIdx: 0 }
    expect(navUp(sel, navCols, mixed)).toEqual({
      kind: 'header', sectionIdx: 1,
    })
  })

  it('first row + prev expanded → last tile matching column (fluent)', () => {
    const twoExpanded: NavSection[] = [
      { key: 'a', expanded: true, tileCount: 5 }, // 2 rows: [0,1,2] [3,4]
      { key: 'b', expanded: true, tileCount: 3 },
    ]
    // b, row 0 col 1 → a last row col 1 = localIdx 4
    expect(navUp({ kind: 'tile', sectionIdx: 1, localIdx: 1 }, navCols, twoExpanded)).toEqual({
      kind: 'tile', sectionIdx: 0, localIdx: 4,
    })
  })

  it('first row + prev expanded clamps column', () => {
    const twoExpanded: NavSection[] = [
      { key: 'a', expanded: true, tileCount: 4 }, // 2 rows: [0,1,2] [3]
      { key: 'b', expanded: true, tileCount: 3 },
    ]
    // b, row 0 col 2 → a last row col 2, but last row only has 1 item → clamp to 3
    expect(navUp({ kind: 'tile', sectionIdx: 1, localIdx: 2 }, navCols, twoExpanded)).toEqual({
      kind: 'tile', sectionIdx: 0, localIdx: 3,
    })
  })

  it('first tile of first section stays put', () => {
    const sel: NavSel = { kind: 'tile', sectionIdx: 0, localIdx: 0 }
    expect(navUp(sel, navCols, mixed)).toEqual(sel)
  })
})

describe('navLeftSec', () => {
  it('tile col > 0 moves left, no action', () => {
    const result = navLeftSec({ kind: 'tile', sectionIdx: 0, localIdx: 1 }, navCols, mixed)
    expect(result.sel).toEqual({ kind: 'tile', sectionIdx: 0, localIdx: 0 })
    expect(result.action).toBeUndefined()
  })

  it('tile col 0 of expanded section → header + collapse action', () => {
    const sel: NavSel = { kind: 'tile', sectionIdx: 0, localIdx: 0 }
    const result = navLeftSec(sel, navCols, mixed)
    expect(result.sel).toEqual({ kind: 'header', sectionIdx: 0 })
    expect(result.action).toEqual({ type: 'collapse', sectionKey: 'starred' })
  })

  it('tile col 0 row > 0 also collapses', () => {
    // localIdx 3 = row 1 col 0 in a 3-col grid
    const sel: NavSel = { kind: 'tile', sectionIdx: 2, localIdx: 3 }
    const result = navLeftSec(sel, navCols, mixed)
    expect(result.sel).toEqual({ kind: 'header', sectionIdx: 2 })
    expect(result.action).toEqual({ type: 'collapse', sectionKey: 'dir-2' })
  })

  it('header stays put (no-op)', () => {
    const sel: NavSel = { kind: 'header', sectionIdx: 1 }
    const result = navLeftSec(sel, navCols, mixed)
    expect(result.sel).toEqual(sel)
    expect(result.action).toBeUndefined()
  })
})

describe('navRightSec', () => {
  it('collapsed header returns expand action + first tile', () => {
    const sel: NavSel = { kind: 'header', sectionIdx: 1 }
    const result = navRightSec(sel, navCols, mixed)
    expect(result.sel).toEqual({ kind: 'tile', sectionIdx: 1, localIdx: 0 })
    expect(result.action).toEqual({ type: 'expand', sectionKey: 'dir-1' })
  })

  it('expanded header → first tile, no action', () => {
    const sel: NavSel = { kind: 'header', sectionIdx: 0 }
    const result = navRightSec(sel, navCols, mixed)
    expect(result.sel).toEqual({ kind: 'tile', sectionIdx: 0, localIdx: 0 })
    expect(result.action).toBeUndefined()
  })

  it('tile not at row end moves right', () => {
    const sel: NavSel = { kind: 'tile', sectionIdx: 0, localIdx: 0 }
    const result = navRightSec(sel, navCols, mixed)
    expect(result.sel).toEqual({ kind: 'tile', sectionIdx: 0, localIdx: 1 })
    expect(result.action).toBeUndefined()
  })

  it('tile at row end stays put', () => {
    // col 2 = last col
    const sel: NavSel = { kind: 'tile', sectionIdx: 0, localIdx: 2 }
    const result = navRightSec(sel, navCols, mixed)
    expect(result.sel).toEqual(sel)
  })

  it('tile at end of section stays put', () => {
    // dir-2 has 4 tiles, localIdx 3 is last
    const sel: NavSel = { kind: 'tile', sectionIdx: 2, localIdx: 3 }
    const result = navRightSec(sel, navCols, mixed)
    expect(result.sel).toEqual(sel)
  })
})
