import { describe, it, expect } from 'vitest'
import { buildBoundaries, findSection, moveDown, moveUp, moveLeft, moveRight } from '../grid-nav'

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
