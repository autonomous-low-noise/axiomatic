import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

// --- mocks (NO mock for useVimOverview — we test the real hook) ---

vi.mock('../../lib/palette', () => ({ togglePalette: vi.fn() }))

const mockNavigate = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return { ...actual, useNavigate: () => mockNavigate }
})

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn().mockResolvedValue([]),
}))

vi.mock('../../hooks/useTextbooks', () => ({
  useTextbooks: () => ({
    textbooks: [
      { slug: 'algebra', title: 'Algebra', file: 'a.pdf', dir_id: 1, dir_path: '/lib', full_path: '/lib/a.pdf' },
      { slug: 'topology', title: 'Topology', file: 't.pdf', dir_id: 1, dir_path: '/lib', full_path: '/lib/t.pdf' },
      { slug: 'calculus', title: 'Calculus', file: 'c.pdf', dir_id: 2, dir_path: '/math', full_path: '/math/c.pdf' },
      { slug: 'analysis', title: 'Analysis', file: 'an.pdf', dir_id: 2, dir_path: '/math', full_path: '/math/an.pdf' },
      { slug: 'geometry', title: 'Geometry', file: 'g.pdf', dir_id: 2, dir_path: '/math', full_path: '/math/g.pdf' },
    ],
    loading: false,
    refresh: vi.fn(),
  }),
}))

vi.mock('../../hooks/useDirectories', () => ({
  useDirectories: () => ({
    directories: [
      { id: 1, path: '/lib', label: 'Library', added_at: '2024-01-01' },
      { id: 2, path: '/math', label: 'Math', added_at: '2024-01-02' },
    ],
    add: vi.fn(),
    remove: vi.fn(),
  }),
}))

vi.mock('../../hooks/useProgress', () => ({
  useProgress: () => ({ progress: {} }),
}))

vi.mock('../../hooks/useStarred', () => ({
  useStarred: () => ({
    starred: { algebra: true, topology: true },
    toggle: vi.fn(),
  }),
}))

vi.mock('../../hooks/useTags', () => ({
  useTags: () => ({
    tags: [],
    bookTags: {},
    createTag: vi.fn(),
    deleteTag: vi.fn(),
    tagBook: vi.fn(),
    untagBook: vi.fn(),
    updateTagColor: vi.fn(),
  }),
}))

vi.mock('../../hooks/useBatchedRender', () => ({
  useBatchedRender: (total: number) => total,
}))

vi.mock('../../hooks/useSyncStatus', () => ({
  useSyncStatus: () => ({ state: 'synced' as const, rendered: 0, total: 0 }),
}))

vi.mock('../../components/BookTile', () => ({
  BookTile: ({ title, slug, selected }: { title: string; slug: string; selected: boolean }) => (
    <div data-testid={`tile-${slug}`} data-selected={selected || undefined}>{title}</div>
  ),
}))

vi.mock('../../components/TileGrid', () => ({
  TileGrid: ({ children, gridRef }: { children: React.ReactNode; gridRef?: React.Ref<HTMLDivElement> }) => (
    <div data-testid="tile-grid" ref={gridRef as React.Ref<HTMLDivElement>}>{children}</div>
  ),
}))

vi.mock('../../components/SyncStatus', () => ({ SyncStatus: () => null }))

import { OverviewPage } from '../OverviewPage'

const COLLAPSE_KEY = 'axiomatic:section-collapse'

/** Expand given section keys via localStorage and notify the store. */
function expandSections(...keys: string[]) {
  const state: Record<string, boolean> = {}
  for (const k of keys) state[k] = true
  localStorage.setItem(COLLAPSE_KEY, JSON.stringify(state))
  window.dispatchEvent(new StorageEvent('storage', { key: COLLAPSE_KEY }))
}

function pressKey(key: string) {
  fireEvent.keyDown(window, { key })
}

/** Return the slug of the currently data-selected tile, or null. */
function selectedTile(): string | null {
  const el = document.querySelector('[data-selected]')
  return el?.getAttribute('data-testid')?.replace('tile-', '') ?? null
}

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/']}>
      <OverviewPage />
    </MemoryRouter>,
  )
}

beforeEach(() => {
  localStorage.clear()
  window.dispatchEvent(new StorageEvent('storage', { key: COLLAPSE_KEY, newValue: null }))
  mockNavigate.mockClear()
})

/** Return the section key of the currently selected header, or null. */
function selectedHeader(): string | null {
  const el = document.querySelector('[data-header-selected]')
  return el?.getAttribute('data-section-key') ?? null
}

// Test grid layout (2 cols, default in jsdom):
//
// Starred (expanded): [algebra(0)] [topology(1)]    (row 0)
// Math    (expanded): [calculus(2)] [analysis(3)]    (row 0)
//                     [geometry(4)]                  (row 1)

describe('OverviewPage vim navigation — existing behaviour', () => {
  describe('all sections expanded', () => {
    beforeEach(() => {
      expandSections('starred', 'dir-2')
    })

    it('j from unselected selects first tile', () => {
      renderPage()
      pressKey('j')
      expect(selectedTile()).toBe('algebra')
    })

    it('l moves right within a row', () => {
      renderPage()
      pressKey('j') // algebra
      pressKey('l') // topology
      expect(selectedTile()).toBe('topology')
    })

    it('h moves left within a row', () => {
      renderPage()
      pressKey('j')
      pressKey('l') // topology
      pressKey('h') // algebra
      expect(selectedTile()).toBe('algebra')
    })

    it('h at leftmost column collapses section', () => {
      renderPage()
      pressKey('j') // algebra (col 0)
      pressKey('h') // collapse starred → header
      expect(selectedTile()).toBeNull()
      expect(selectedHeader()).toBe('starred')
    })

    it('l at rightmost column stays put', () => {
      renderPage()
      pressKey('j')
      pressKey('l') // topology (col 1, last col)
      pressKey('l')
      expect(selectedTile()).toBe('topology')
    })

    it('j crosses from starred to math section (col 0)', () => {
      renderPage()
      pressKey('j') // algebra (sec 0, row 0, col 0)
      pressKey('j') // calculus (sec 1, row 0, col 0)
      expect(selectedTile()).toBe('calculus')
    })

    it('j crosses from starred to math section preserving column', () => {
      renderPage()
      pressKey('j')
      pressKey('l') // topology (col 1)
      pressKey('j') // analysis (sec 1, row 0, col 1)
      expect(selectedTile()).toBe('analysis')
    })

    it('j moves down within a section', () => {
      renderPage()
      pressKey('j') // algebra
      pressKey('j') // calculus (sec 1, row 0, col 0)
      pressKey('j') // geometry (sec 1, row 1, col 0)
      expect(selectedTile()).toBe('geometry')
    })

    it('j clamps column when target row is shorter', () => {
      renderPage()
      pressKey('j')
      pressKey('l') // topology
      pressKey('j') // analysis (sec 1, row 0, col 1)
      pressKey('j') // geometry (sec 1, row 1 — only col 0, clamps)
      expect(selectedTile()).toBe('geometry')
    })

    it('j at last row of last section stays put', () => {
      renderPage()
      pressKey('j') // algebra
      pressKey('j') // calculus
      pressKey('j') // geometry
      pressKey('j') // stays geometry
      expect(selectedTile()).toBe('geometry')
    })

    it('k from second section crosses up to starred (col 0)', () => {
      renderPage()
      pressKey('j') // algebra
      pressKey('j') // calculus
      pressKey('k') // algebra
      expect(selectedTile()).toBe('algebra')
    })

    it('k from second section crosses up preserving column', () => {
      renderPage()
      pressKey('j')
      pressKey('l') // topology
      pressKey('j') // analysis (col 1)
      pressKey('k') // topology (col 1 in starred)
      expect(selectedTile()).toBe('topology')
    })

    it('k moves up within a section', () => {
      renderPage()
      pressKey('j') // algebra
      pressKey('j') // calculus
      pressKey('j') // geometry
      pressKey('k') // calculus
      expect(selectedTile()).toBe('calculus')
    })

    it('k at first tile stays put', () => {
      renderPage()
      pressKey('j') // algebra
      pressKey('k') // stays algebra (first tile)
      expect(selectedTile()).toBe('algebra')
    })

    it('Enter on selected tile navigates to reader', () => {
      renderPage()
      pressKey('j') // algebra
      pressKey('Enter')
      expect(mockNavigate).toHaveBeenCalledWith('/read/algebra')
    })

    it('Enter on different tile navigates correctly', () => {
      renderPage()
      pressKey('j') // algebra
      pressKey('j') // calculus
      pressKey('Enter')
      expect(mockNavigate).toHaveBeenCalledWith('/read/calculus')
    })

    it('ArrowDown/ArrowUp work as j/k aliases', () => {
      renderPage()
      pressKey('ArrowDown') // algebra
      expect(selectedTile()).toBe('algebra')
      pressKey('ArrowDown') // calculus
      expect(selectedTile()).toBe('calculus')
      pressKey('ArrowUp') // algebra
      expect(selectedTile()).toBe('algebra')
    })

    it('ArrowLeft/ArrowRight work as h/l aliases', () => {
      renderPage()
      pressKey('j') // algebra
      pressKey('ArrowRight') // topology
      expect(selectedTile()).toBe('topology')
      pressKey('ArrowLeft') // algebra
      expect(selectedTile()).toBe('algebra')
    })
  })

  describe('collapsed sections become header stops', () => {
    it('j navigates through collapsed header then into expanded tiles', () => {
      // Only expand Math, leave Starred collapsed
      expandSections('dir-2')
      renderPage()

      pressKey('j') // Starred header (collapsed)
      expect(selectedHeader()).toBe('starred')
      expect(selectedTile()).toBeNull()

      pressKey('j') // first Math tile = calculus
      expect(selectedTile()).toBe('calculus')
      pressKey('l')
      expect(selectedTile()).toBe('analysis')
      pressKey('j')
      expect(selectedTile()).toBe('geometry')
    })

    it('j on all-collapsed selects first header', () => {
      // Everything collapsed
      renderPage()
      pressKey('j')
      expect(selectedHeader()).toBe('starred')
      expect(selectedTile()).toBeNull()
    })
  })
})

// === Header-aware navigation (collapsible sections) ===
//
// Layout:
//   Starred (expanded): [algebra] [topology]    (tiles)
//   Math    (collapsed):  <header>
//
// j from topology → Math header (collapsed stop)
// l on Math header → expand Math, calculus selected

describe('OverviewPage vim navigation — collapsible headers', () => {
  it('j from last tile of expanded section selects collapsed header', () => {
    expandSections('starred') // Math stays collapsed
    renderPage()

    pressKey('j') // algebra
    pressKey('j') // next stop: Math header (collapsed)

    expect(selectedTile()).toBeNull()
    expect(selectedHeader()).toBe('dir-2')
  })

  it('k from collapsed header goes back to expanded tiles', () => {
    expandSections('starred')
    renderPage()

    pressKey('j') // algebra
    pressKey('j') // Math header
    pressKey('k') // back to starred tiles (col 0 → algebra)

    expect(selectedTile()).toBe('algebra')
    expect(selectedHeader()).toBeNull()
  })

  it('l on collapsed header expands section and selects first tile', () => {
    expandSections('starred')
    renderPage()

    pressKey('j') // algebra
    pressKey('j') // Math header
    pressKey('l') // expand Math → calculus

    expect(selectedTile()).toBe('calculus')
    expect(selectedHeader()).toBeNull()
    // Math tiles should now be visible
    expect(screen.getByTestId('tile-calculus')).toBeInTheDocument()
  })

  it('h on collapsed header is a no-op', () => {
    expandSections('starred')
    renderPage()

    pressKey('j') // algebra
    pressKey('j') // Math header
    pressKey('h') // no-op — still on Math header

    expect(selectedHeader()).toBe('dir-2')
  })

  it('j on collapsed header skips to next section', () => {
    // All collapsed — j navigates between headers
    renderPage()

    pressKey('j') // Starred header (first section, collapsed)
    expect(selectedHeader()).toBe('starred')

    pressKey('j') // Math header
    expect(selectedHeader()).toBe('dir-2')
  })

  it('Enter on collapsed header toggles it open', () => {
    renderPage()
    pressKey('j') // Starred header (collapsed)
    expect(selectedHeader()).toBe('starred')

    pressKey('Enter') // toggle → expand, select first tile
    expect(selectedTile()).toBe('algebra')
    expect(screen.getByTestId('tile-algebra')).toBeInTheDocument()
  })

  it('fluent j/k between two expanded sections skips collapsed between them', () => {
    expandSections('starred', 'dir-2') // both expanded
    renderPage()

    pressKey('j') // algebra (starred, col 0)
    pressKey('j') // calculus (Math, col 0 — fluent, no header stop)
    expect(selectedTile()).toBe('calculus')

    pressKey('k') // back to algebra (fluent)
    expect(selectedTile()).toBe('algebra')
  })

  it('h at leftmost tile collapses section and selects header', () => {
    expandSections('starred', 'dir-2') // both expanded
    renderPage()

    pressKey('j') // algebra (starred, col 0)
    expect(selectedTile()).toBe('algebra')

    pressKey('h') // collapse starred → header selected
    expect(selectedTile()).toBeNull()
    expect(selectedHeader()).toBe('starred')
    // starred tiles should no longer be visible
    expect(screen.queryByTestId('tile-algebra')).toBeNull()
  })

  it('h at leftmost tile in second section collapses that section', () => {
    expandSections('starred', 'dir-2')
    renderPage()

    pressKey('j') // algebra
    pressKey('j') // calculus (Math, col 0)
    expect(selectedTile()).toBe('calculus')

    pressKey('h') // collapse Math → Math header
    expect(selectedTile()).toBeNull()
    expect(selectedHeader()).toBe('dir-2')
    expect(screen.queryByTestId('tile-calculus')).toBeNull()
  })

  it('h at col > 0 moves left, does not collapse', () => {
    expandSections('starred', 'dir-2')
    renderPage()

    pressKey('j') // algebra
    pressKey('l') // topology (col 1)
    expect(selectedTile()).toBe('topology')

    pressKey('h') // back to algebra (col 0), section stays expanded
    expect(selectedTile()).toBe('algebra')
    expect(screen.getByTestId('tile-topology')).toBeInTheDocument()
  })
})
