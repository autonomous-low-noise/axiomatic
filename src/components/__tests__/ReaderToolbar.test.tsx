import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import { ReaderToolbar } from '../ReaderToolbar'

vi.mock('@tauri-apps/api/core')

// Mock PomodoroTimer to avoid its module-level state
vi.mock('../PomodoroTimer', () => ({
  PomodoroTimer: () => <div data-testid="pomodoro-timer" />,
}))

const baseProps = {
  title: 'Test Book',
  currentPage: 1,
  totalPages: 100,
  zoom: 1,
  onZoomChange: vi.fn(),
  searchOpen: false,
  onToggleSearch: vi.fn(),
  searchQuery: '',
  onSearchQueryChange: vi.fn(),
  searchCurrentIndex: 0,
  searchTotalMatches: 0,
  onSearchNext: vi.fn(),
  onSearchPrev: vi.fn(),
}

function renderToolbar(overrides: Record<string, unknown> = {}) {
  return render(
    <MemoryRouter>
      <ReaderToolbar {...baseProps} {...overrides} />
    </MemoryRouter>,
  )
}

describe('ReaderToolbar', () => {
  // ac-155: snip toggle button visible when onToggleSnipMode provided
  it('renders snip toggle button', () => {
    renderToolbar({ onToggleSnipMode: vi.fn(), snipMode: false })
    expect(screen.getByLabelText('Snip mode')).toBeInTheDocument()
  })

  // ac-155: snip button uses active styling when snip mode is on
  it('shows active styling on snip button when snip mode on', () => {
    renderToolbar({ onToggleSnipMode: vi.fn(), snipMode: true })
    const btn = screen.getByLabelText('Stop snipping')
    expect(btn.className).toContain('blue')
  })

  // ac-155: snip toggle calls callback
  it('calls onToggleSnipMode when snip button clicked', () => {
    const onToggle = vi.fn()
    renderToolbar({ onToggleSnipMode: onToggle, snipMode: false })
    fireEvent.click(screen.getByLabelText('Snip mode'))
    expect(onToggle).toHaveBeenCalledTimes(1)
  })

  // ac-155: loop buttons visible when hasSnips
  it('renders loop buttons when hasSnips is true', () => {
    renderToolbar({
      onToggleSnipMode: vi.fn(),
      hasSnips: true,
      onLoopSorted: vi.fn(),
      onLoopShuffled: vi.fn(),
    })
    expect(screen.getByLabelText('Loop sorted')).toBeInTheDocument()
    expect(screen.getByLabelText('Loop shuffled')).toBeInTheDocument()
  })

  // ac-155: no loop buttons when no snips
  it('does not render loop buttons when hasSnips is false', () => {
    renderToolbar({
      onToggleSnipMode: vi.fn(),
      hasSnips: false,
      onLoopSorted: vi.fn(),
      onLoopShuffled: vi.fn(),
    })
    expect(screen.queryByLabelText('Loop sorted')).toBeNull()
    expect(screen.queryByLabelText('Loop shuffled')).toBeNull()
  })

  // ac-155: loop callbacks fire
  it('calls onLoopSorted when loop sorted button clicked', () => {
    const onSorted = vi.fn()
    renderToolbar({
      onToggleSnipMode: vi.fn(),
      hasSnips: true,
      onLoopSorted: onSorted,
      onLoopShuffled: vi.fn(),
    })
    fireEvent.click(screen.getByLabelText('Loop sorted'))
    expect(onSorted).toHaveBeenCalledTimes(1)
  })

  // learningTools=false hides snip, loop, and pomodoro
  it('hides snip/loop/pomodoro when learningTools is false', () => {
    renderToolbar({
      learningTools: false,
      onToggleSnipMode: vi.fn(),
      snipMode: false,
      hasSnips: true,
      onLoopSorted: vi.fn(),
      onLoopShuffled: vi.fn(),
    })
    expect(screen.queryByLabelText('Snip mode')).toBeNull()
    expect(screen.queryByLabelText('Loop sorted')).toBeNull()
    expect(screen.queryByLabelText('Loop shuffled')).toBeNull()
    expect(screen.queryByTestId('pomodoro-timer')).toBeNull()
    expect(screen.queryByLabelText('Snips')).toBeNull()
  })

  // learningTools=true (default) shows them
  it('shows snip/loop/pomodoro when learningTools is true', () => {
    renderToolbar({
      learningTools: true,
      onToggleSnipMode: vi.fn(),
      snipMode: false,
      hasSnips: true,
      onLoopSorted: vi.fn(),
      onLoopShuffled: vi.fn(),
    })
    expect(screen.getByLabelText('Snip mode')).toBeInTheDocument()
    expect(screen.getByLabelText('Loop sorted')).toBeInTheDocument()
    expect(screen.getByTestId('pomodoro-timer')).toBeInTheDocument()
  })

  // Toolbar overflow prevention: side sections use overflow-hidden
  it('has overflow-hidden on left and right sections', () => {
    const { container } = renderToolbar({
      onToggleSnipMode: vi.fn(),
      hasSnips: true,
      onLoopSorted: vi.fn(),
      onLoopShuffled: vi.fn(),
    })
    const toolbar = container.querySelector('[class*="h-10"]')!
    const left = toolbar.children[0] as HTMLElement
    const right = toolbar.children[2] as HTMLElement
    expect(left.className).toContain('overflow-hidden')
    expect(right.className).toContain('overflow-hidden')
  })

  // Title section takes flex-1, side sections use natural width
  it('title section is flex-1 while side sections are not', () => {
    const { container } = renderToolbar()
    const toolbar = container.querySelector('[class*="h-10"]')!
    const left = toolbar.children[0] as HTMLElement
    const center = toolbar.children[1] as HTMLElement
    const right = toolbar.children[2] as HTMLElement
    expect(left.className).not.toContain('flex-1')
    expect(center.className).toContain('flex-1')
    expect(right.className).not.toContain('flex-1')
  })

  it('title has max-width cap and ellipsis truncation', () => {
    renderToolbar({ title: 'A Very Long Title That Should Truncate' })
    const titleEl = screen.getByText('A Very Long Title That Should Truncate')
    const cls = titleEl.className
    expect(cls).toContain('truncate')
    expect(cls).toMatch(/max-w-/)
  })

  it('side sections cannot shrink', () => {
    const { container } = renderToolbar()
    const toolbar = container.querySelector('[class*="h-10"]')!
    const left = toolbar.children[0] as HTMLElement
    const right = toolbar.children[2] as HTMLElement
    expect(left.className).toContain('shrink-0')
    expect(right.className).toContain('shrink-0')
  })

  it('renders Snips nav link always visible', () => {
    renderToolbar()
    const link = screen.getByLabelText('Snips')
    expect(link.tagName).toBe('A')
    expect(link).toHaveAttribute('href', '/snips')
  })

  it('hides Snips nav link when learningTools is false', () => {
    renderToolbar({ learningTools: false })
    expect(screen.queryByLabelText('Snips')).toBeNull()
  })

  it('Snips nav icon is not the scissors icon', () => {
    renderToolbar()
    const snipsLink = screen.getByLabelText('Snips')
    // Scissors icon has <circle> elements; the nav icon must not
    expect(snipsLink.querySelector('circle')).toBeNull()
  })

  it('right section is pushed to the right edge via ml-auto', () => {
    const { container } = renderToolbar()
    const toolbar = container.querySelector('[class*="h-10"]')!
    const right = toolbar.children[2] as HTMLElement
    expect(right.className).toContain('ml-auto')
  })
})
