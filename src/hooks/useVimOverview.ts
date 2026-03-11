import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  navDown, navUp, navLeftSec, navRightSec, selToTileIndex,
  type NavSection, type NavSel,
} from '../lib/grid-nav'

export type { NavSection }

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
  sections: NavSection[],
  onToggleSection: (key: string) => void,
) {
  const [sel, setSel] = useState<NavSel>({ kind: 'none' })
  const navigate = useNavigate()

  // Refs keep latest values accessible in the handler without
  // re-registering it on every state change.
  const selRef = useRef(sel)
  const sectionsRef = useRef(sections)
  const slugsRef = useRef(slugs)

  useEffect(() => {
    selRef.current = sel
    sectionsRef.current = sections
    slugsRef.current = slugs
  })

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA') return

      const cols = getColumnsFromGrid(gridRef.current)
      const secs = sectionsRef.current
      if (secs.length === 0) return

      switch (e.key) {
        case 'ArrowDown':
        case 'j': {
          e.preventDefault()
          setSel((prev) => navDown(prev, cols, secs))
          break
        }
        case 'ArrowUp':
        case 'k': {
          e.preventDefault()
          setSel((prev) => navUp(prev, cols, secs))
          break
        }
        case 'ArrowLeft':
        case 'h': {
          e.preventDefault()
          const cur = selRef.current
          const result = navLeftSec(cur, cols, secs)
          setSel(result.sel)
          if (result.action?.type === 'collapse') {
            onToggleSection(result.action.sectionKey)
          }
          break
        }
        case 'ArrowRight':
        case 'l': {
          e.preventDefault()
          const cur = selRef.current
          const result = navRightSec(cur, cols, secs)
          setSel(result.sel)
          if (result.action?.type === 'expand') {
            onToggleSection(result.action.sectionKey)
          }
          break
        }
        case 'Enter': {
          const cur = selRef.current
          if (cur.kind === 'tile') {
            const idx = selToTileIndex(cur, secs)
            const sl = slugsRef.current
            if (idx >= 0 && idx < sl.length) {
              e.preventDefault()
              navigate(`/read/${sl[idx]}`)
            }
          } else if (cur.kind === 'header' && cur.sectionIdx < secs.length) {
            e.preventDefault()
            const sec = secs[cur.sectionIdx]
            onToggleSection(sec.key)
            if (!sec.expanded) {
              setSel({ kind: 'tile', sectionIdx: cur.sectionIdx, localIdx: 0 })
            }
          }
          break
        }
      }
    }

    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [navigate, gridRef, onToggleSection])

  const selectedIndex = selToTileIndex(sel, sections)
  const selectedHeader = sel.kind === 'header' && sel.sectionIdx < sections.length
    ? sections[sel.sectionIdx].key
    : null

  return { selectedIndex, selectedHeader }
}
