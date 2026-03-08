import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { buildBoundaries, moveDown, moveUp, moveLeft, moveRight } from '../lib/grid-nav'

function getColumnsFromGrid(grid: HTMLDivElement | null): number {
  if (grid) {
    const tracks = getComputedStyle(grid).gridTemplateColumns
    if (tracks) return tracks.split(' ').length
  }
  return 2
}

export function useVimOverview(
  slugs: string[],
  gridRef: React.RefObject<HTMLDivElement | null>,
  sectionSizes: number[],
) {
  const [selectedIndex, setSelectedIndex] = useState(-1)
  const navigate = useNavigate()

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA') return

      const cols = getColumnsFromGrid(gridRef.current)
      const count = slugs.length
      if (count === 0) return

      const boundaries = buildBoundaries(sectionSizes)

      switch (e.key) {
        case 'ArrowDown':
        case 'j': {
          e.preventDefault()
          setSelectedIndex((prev) => moveDown(prev, cols, boundaries, count))
          break
        }
        case 'ArrowUp':
        case 'k': {
          e.preventDefault()
          setSelectedIndex((prev) => moveUp(prev, cols, boundaries, count))
          break
        }
        case 'ArrowLeft':
        case 'h': {
          e.preventDefault()
          setSelectedIndex((prev) => moveLeft(prev, cols, boundaries, count))
          break
        }
        case 'ArrowRight':
        case 'l': {
          e.preventDefault()
          setSelectedIndex((prev) => moveRight(prev, cols, boundaries, count))
          break
        }
        case 'Enter': {
          if (selectedIndex >= 0 && selectedIndex < count) {
            e.preventDefault()
            navigate(`/read/${slugs[selectedIndex]}`)
          }
          break
        }
      }
    }

    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [slugs, sectionSizes, selectedIndex, navigate, gridRef])

  return { selectedIndex }
}
