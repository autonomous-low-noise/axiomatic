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
