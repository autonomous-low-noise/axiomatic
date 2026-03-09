import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import type { SnipWithDir } from '../../hooks/useSnips'

vi.mock('../../lib/palette', () => ({ togglePalette: vi.fn() }))

const mockNavigate = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return { ...actual, useNavigate: () => mockNavigate }
})

// Stub hooks so we control data without IPC
const stubAllSnips = {
  snips: [] as SnipWithDir[],
  loading: false,
  addTag: vi.fn(),
  removeTag: vi.fn(),
  renameSnip: vi.fn(),
  deleteSnip: vi.fn(),
  bulkAddTag: vi.fn(),
  bulkRemoveTag: vi.fn(),
  refresh: vi.fn(),
}

vi.mock('../../hooks/useDirectories', () => ({
  useDirectories: () => ({
    directories: [{ id: 1, path: '/lib', label: 'Library', added_at: '2024-01-01' }],
  }),
}))

vi.mock('../../hooks/useTextbooks', () => ({
  useTextbooks: () => ({
    textbooks: [{ slug: 'algebra', title: 'Linear Algebra', file: 'algebra.pdf', dir_id: 1, dir_path: '/lib', full_path: '/lib/algebra.pdf' }],
    loading: false,
  }),
}))

vi.mock('../../hooks/useSnips', async () => {
  const actual = await vi.importActual('../../hooks/useSnips')
  return {
    ...actual,
    useAllSnips: () => stubAllSnips,
  }
})

vi.mock('../../hooks/useSnipTagDefs', () => ({
  useSnipTagDefs: () => ({
    defs: [],
    createDef: vi.fn(),
    deleteDef: vi.fn(),
    renameDef: vi.fn(),
    recolorDef: vi.fn(),
    refresh: vi.fn(),
  }),
}))

vi.mock('../../components/PomodoroTimer', () => ({
  PomodoroTimer: () => <div data-testid="pomodoro-timer" />,
}))

// LoopCarousel is complex and unnecessary for these tests
vi.mock('../../components/LoopCarousel', () => ({
  LoopCarousel: (props: any) => <div data-testid="loop-carousel" data-shuffled={String(props.shuffled)} data-view-mode={props.viewMode ? 'true' : undefined} />,
}))

import { SnipsPage } from '../SnipsPage'

function makeSnip(overrides: Partial<SnipWithDir> = {}): SnipWithDir {
  return {
    id: 'snip-1',
    slug: 'algebra',
    full_path: '/lib/algebra.pdf',
    page: 4,
    label: 'Definition 1.1',
    x: 0.1,
    y: 0.2,
    width: 0.5,
    height: 0.3,
    created_at: '2024-06-15T10:00:00Z',
    tags: [],
    dirPath: '/lib',
    dirLabel: 'Library',
    ...overrides,
  }
}

function renderPage(snips: SnipWithDir[] = [makeSnip()]) {
  stubAllSnips.snips = snips
  return render(
    <MemoryRouter initialEntries={['/snips']}>
      <SnipsPage />
    </MemoryRouter>,
  )
}

beforeEach(() => {
  mockNavigate.mockClear()
  stubAllSnips.snips = []
})

describe('SnipsPage', () => {
  it('renders snip rows with larger checkboxes (h-4 w-4)', () => {
    renderPage()

    // Per-row checkbox
    const tbody = screen.getByText('Definition 1.1').closest('tbody')!
    const rowCheckbox = within(tbody).getAllByRole('checkbox')[0]
    expect(rowCheckbox.className).toContain('h-4')
    expect(rowCheckbox.className).toContain('w-4')

    // Header select-all checkbox
    const thead = screen.getByText('Label').closest('thead')!
    const headerCheckbox = within(thead).getByRole('checkbox')
    expect(headerCheckbox.className).toContain('h-4')
    expect(headerCheckbox.className).toContain('w-4')
  })

  it('clicking a row selects it instead of navigating', () => {
    renderPage()

    const row = screen.getByText('Definition 1.1').closest('tr')!

    // Row should not have cursor-pointer
    expect(row.className).not.toContain('cursor-pointer')

    // Click the row
    fireEvent.click(row)

    // Should show "1 selected" in toolbar (selection, not navigation)
    expect(screen.getByText('1 selected')).toBeInTheDocument()

    // Should NOT have navigated
    expect(mockNavigate).not.toHaveBeenCalled()

    // The checkbox should be checked
    const tbody = screen.getByText('Definition 1.1').closest('tbody')!
    const checkbox = within(tbody).getAllByRole('checkbox')[0] as HTMLInputElement
    expect(checkbox.checked).toBe(true)
  })

  it('clicking a selected row deselects it', () => {
    renderPage()

    const row = screen.getByText('Definition 1.1').closest('tr')!

    // Select
    fireEvent.click(row)
    expect(screen.getByText('1 selected')).toBeInTheDocument()

    // Deselect
    fireEvent.click(row)
    expect(screen.queryByText('1 selected')).not.toBeInTheDocument()
  })

  it('shift-click on rows selects a range', () => {
    const snips = [
      makeSnip({ id: 's1', label: 'Snip A', created_at: '2024-06-03T00:00:00Z' }),
      makeSnip({ id: 's2', label: 'Snip B', created_at: '2024-06-02T00:00:00Z' }),
      makeSnip({ id: 's3', label: 'Snip C', created_at: '2024-06-01T00:00:00Z' }),
    ]
    renderPage(snips)

    const rowA = screen.getByText('Snip A').closest('tr')!
    const rowC = screen.getByText('Snip C').closest('tr')!

    // Click first row normally
    fireEvent.click(rowA)
    expect(screen.getByText('1 selected')).toBeInTheDocument()

    // Shift-click last row
    fireEvent.click(rowC, { shiftKey: true })
    expect(screen.getByText('3 selected')).toBeInTheDocument()
  })

  it('context menu shows "Expand" and "Open in reader" options', () => {
    renderPage()

    const row = screen.getByText('Definition 1.1').closest('tr')!
    fireEvent.contextMenu(row)

    expect(screen.getByText('Expand')).toBeInTheDocument()
    expect(screen.getByText('Open in reader')).toBeInTheDocument()
    expect(screen.getByText('Rename')).toBeInTheDocument()
    expect(screen.getByText('Delete')).toBeInTheDocument()
  })

  it('"Expand" shows inline preview with snip details and collapse button', () => {
    renderPage()

    // Open context menu and click Expand
    const row = screen.getByText('Definition 1.1').closest('tr')!
    fireEvent.contextMenu(row)
    fireEvent.click(screen.getByText('Expand'))

    // Expanded row should show metadata and buttons
    expect(screen.getByText('Go to page')).toBeInTheDocument()
    expect(screen.getByText('Collapse')).toBeInTheDocument()
    expect(screen.getByText(/Page:/)).toBeInTheDocument()
    expect(screen.getByText(/Source:/)).toBeInTheDocument()
  })

  it('collapse button removes the expanded row', () => {
    renderPage()

    // Expand
    const row = screen.getByText('Definition 1.1').closest('tr')!
    fireEvent.contextMenu(row)
    fireEvent.click(screen.getByText('Expand'))
    expect(screen.getByText('Collapse')).toBeInTheDocument()

    // Collapse
    fireEvent.click(screen.getByText('Collapse'))
    expect(screen.queryByText('Collapse')).not.toBeInTheDocument()
    expect(screen.queryByText('Go to page')).not.toBeInTheDocument()
  })

  it('"Open in reader" navigates to the snip page', () => {
    renderPage()

    const row = screen.getByText('Definition 1.1').closest('tr')!
    fireEvent.contextMenu(row)
    fireEvent.click(screen.getByText('Open in reader'))

    expect(mockNavigate).toHaveBeenCalledWith('/read/algebra?page=4')
  })

  it('"Go to page" in expanded row navigates to the snip page', () => {
    renderPage()

    const row = screen.getByText('Definition 1.1').closest('tr')!
    fireEvent.contextMenu(row)
    fireEvent.click(screen.getByText('Expand'))
    fireEvent.click(screen.getByText('Go to page'))

    expect(mockNavigate).toHaveBeenCalledWith('/read/algebra?page=4')
  })

  it('context menu "Expand" toggles: second Expand collapses', () => {
    renderPage()

    const row = screen.getByText('Definition 1.1').closest('tr')!

    // Expand
    fireEvent.contextMenu(row)
    fireEvent.click(screen.getByText('Expand'))
    expect(screen.getByText('Collapse')).toBeInTheDocument()

    // Expand again on same snip should collapse
    fireEvent.contextMenu(row)
    fireEvent.click(screen.getByText('Expand'))
    expect(screen.queryByText('Collapse')).not.toBeInTheDocument()
  })

  it('expanded row shows correct metadata values', () => {
    renderPage()

    const row = screen.getByText('Definition 1.1').closest('tr')!
    fireEvent.contextMenu(row)
    fireEvent.click(screen.getByText('Expand'))

    // Page 4 (0-indexed) should display as 5
    expect(screen.getByText((_, el) =>
      el?.tagName === 'P' && /Page:/.test(el.textContent ?? '') && el.textContent?.includes('5') === true,
    )).toBeInTheDocument()

    // Source should resolve via slugToTitle to "Linear Algebra"
    expect(screen.getByText((_, el) =>
      el?.tagName === 'P' && /Source:/.test(el.textContent ?? '') && el.textContent?.includes('Linear Algebra') === true,
    )).toBeInTheDocument()
  })

  it('renders PomodoroTimer in toolbar', () => {
    renderPage()
    expect(screen.getByTestId('pomodoro-timer')).toBeInTheDocument()
  })

  it('context menu shows View option', () => {
    renderPage()
    const row = screen.getByText('Definition 1.1').closest('tr')!
    fireEvent.contextMenu(row)
    expect(screen.getByText('View')).toBeInTheDocument()
  })

  it('View opens carousel in view mode', () => {
    renderPage()
    const row = screen.getByText('Definition 1.1').closest('tr')!
    fireEvent.contextMenu(row)
    fireEvent.click(screen.getByText('View'))

    const carousel = screen.getByTestId('loop-carousel')
    expect(carousel).toBeInTheDocument()
    expect(carousel).toHaveAttribute('data-view-mode', 'true')
  })

  it('Loop sorted button opens carousel with shuffled=false', () => {
    renderPage()
    fireEvent.click(screen.getByText('Loop sorted'))
    const carousel = screen.getByTestId('loop-carousel')
    expect(carousel).toHaveAttribute('data-shuffled', 'false')
  })

  it('Loop shuffled button opens carousel with shuffled=true', () => {
    renderPage()
    fireEvent.click(screen.getByText('Loop shuffled'))
    const carousel = screen.getByTestId('loop-carousel')
    expect(carousel).toHaveAttribute('data-shuffled', 'true')
  })

  it('row click does not toggle selection while renaming', () => {
    renderPage()

    // Double-click the label cell to start rename
    const labelCell = screen.getByText('Definition 1.1')
    fireEvent.doubleClick(labelCell)

    // Now a rename input should be active
    const renameInput = screen.getByDisplayValue('Definition 1.1')
    expect(renameInput).toBeInTheDocument()

    // Click the row — should NOT toggle selection because renamingId is set
    const row = renameInput.closest('tr')!
    fireEvent.click(row)
    expect(screen.queryByText('1 selected')).not.toBeInTheDocument()
  })
})
