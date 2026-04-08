import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

// Mock NotesPanel before importing LoopCarousel
vi.mock('../NotesPanel', () => ({
  NotesPanel: (props: { slug: string; page: number }) => (
    <div data-testid="notes-panel" data-slug={props.slug} data-page={props.page} />
  ),
}))

const mockEnsureNote = vi.fn()
const mockSetNote = vi.fn()
vi.mock('../../hooks/useNotes', () => ({
  useNotes: () => ({ ensureNote: mockEnsureNote, setNote: mockSetNote }),
  useNoteContent: () => undefined,
}))

import { LoopCarousel } from '../LoopCarousel'
import type { Snip } from '../../hooks/useSnips'

function makeSnip(overrides: Partial<Snip> = {}): Snip {
  return {
    id: 'snip-1',
    slug: 'test_book',
    full_path: '/dir/test_book.pdf',
    page: 1,
    label: 'Definition 1.1',
    x: 0.1,
    y: 0.2,
    width: 0.5,
    height: 0.3,
    created_at: '2024-01-01T00:00:00Z',
    tags: [],
    ...overrides,
  }
}

// Stub ResizeObserver for jsdom
class MockResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}
globalThis.ResizeObserver = MockResizeObserver as unknown as typeof ResizeObserver

beforeEach(() => {
  vi.restoreAllMocks()
})

describe('LoopCarousel', () => {
  it('renders the snip label', async () => {
    const snips = [makeSnip({ label: 'Theorem 3.2' })]
    const onIncrementXp = vi.fn().mockResolvedValue(1)
    const onExit = vi.fn()

    render(
      <LoopCarousel
        snips={snips}
        xp={0}
        onIncrementXp={onIncrementXp}
        onExit={onExit}
        shuffled={false}
      />,
    )

    await waitFor(() => {
      expect(screen.getByText('Theorem 3.2')).toBeInTheDocument()
    })
  })

  it('shows "No snips to review." when snips is empty', () => {
    render(
      <LoopCarousel
        snips={[]}
        xp={0}
        onIncrementXp={vi.fn().mockResolvedValue(0)}
        onExit={vi.fn()}
        shuffled={false}
      />,
    )

    expect(screen.getByText('No snips to review.')).toBeInTheDocument()
  })

  it('displays XP counter', async () => {
    const snips = [makeSnip()]
    render(
      <LoopCarousel
        snips={snips}
        xp={42}
        onIncrementXp={vi.fn().mockResolvedValue(43)}
        onExit={vi.fn()}
        shuffled={false}
      />,
    )

    await waitFor(() => {
      expect(screen.getByText('42 XP')).toBeInTheDocument()
    })
  })

  it('navigating next with j key updates index and calls onIncrementXp', async () => {
    const snips = [
      makeSnip({ id: 'snip-1', label: 'Card 1' }),
      makeSnip({ id: 'snip-2', label: 'Card 2' }),
    ]
    const onIncrementXp = vi.fn().mockResolvedValue(1)

    render(
      <LoopCarousel
        snips={snips}
        xp={0}
        onIncrementXp={onIncrementXp}
        onExit={vi.fn()}
        shuffled={false}
      />,
    )

    await waitFor(() => {
      expect(screen.getByText('Card 1')).toBeInTheDocument()
    })

    // Verify initial counter
    expect(screen.getByText('1 / 2')).toBeInTheDocument()

    // Press j to advance
    fireEvent.keyDown(window, { key: 'j' })

    await waitFor(() => {
      expect(screen.getByText('Card 2')).toBeInTheDocument()
    })
    expect(screen.getByText('2 / 2')).toBeInTheDocument()
    expect(onIncrementXp).toHaveBeenCalledTimes(1)
  })

  it('navigating prev with k key goes back', async () => {
    const snips = [
      makeSnip({ id: 'snip-1', label: 'Card 1' }),
      makeSnip({ id: 'snip-2', label: 'Card 2' }),
    ]
    const onIncrementXp = vi.fn().mockResolvedValue(1)

    render(
      <LoopCarousel
        snips={snips}
        xp={0}
        onIncrementXp={onIncrementXp}
        onExit={vi.fn()}
        shuffled={false}
      />,
    )

    await waitFor(() => {
      expect(screen.getByText('Card 1')).toBeInTheDocument()
    })

    // Go to next
    fireEvent.keyDown(window, { key: 'j' })
    await waitFor(() => {
      expect(screen.getByText('Card 2')).toBeInTheDocument()
    })

    // Go back
    fireEvent.keyDown(window, { key: 'k' })
    await waitFor(() => {
      expect(screen.getByText('Card 1')).toBeInTheDocument()
    })
  })

  it('Reveal button shows SnipImage content area', async () => {
    const snips = [makeSnip({ label: 'Test Card' })]

    render(
      <LoopCarousel
        snips={snips}
        xp={0}
        onIncrementXp={vi.fn().mockResolvedValue(1)}
        onExit={vi.fn()}
        shuffled={false}
      />,
    )

    await waitFor(() => {
      expect(screen.getByText('Test Card')).toBeInTheDocument()
    })

    // Reveal button should be visible
    expect(screen.getByText('Reveal')).toBeInTheDocument()

    // Click reveal
    fireEvent.click(screen.getByText('Reveal'))

    // After reveal, the Reveal button should be gone (replaced by canvas)
    expect(screen.queryByText('Reveal')).not.toBeInTheDocument()
  })

  it('Space toggles reveal on and off', async () => {
    const snips = [makeSnip({ label: 'Toggle Card' })]
    render(
      <LoopCarousel
        snips={snips}
        xp={0}
        onIncrementXp={vi.fn().mockResolvedValue(0)}
        onExit={vi.fn()}
        shuffled={false}
      />,
    )

    await waitFor(() => {
      expect(screen.getByText('Toggle Card')).toBeInTheDocument()
    })

    // Initially hidden
    expect(screen.getByText('Reveal')).toBeInTheDocument()

    // Space reveals
    fireEvent.keyDown(window, { key: ' ' })
    expect(screen.queryByText('Reveal')).not.toBeInTheDocument()

    // Space hides again
    fireEvent.keyDown(window, { key: ' ' })
    expect(screen.getByText('Reveal')).toBeInTheDocument()
  })

  it('Space toggles in viewMode too', async () => {
    const snips = [makeSnip({ label: 'View Card' })]
    render(
      <LoopCarousel
        snips={snips}
        xp={0}
        onIncrementXp={vi.fn().mockResolvedValue(0)}
        onExit={vi.fn()}
        shuffled={false}
        viewMode={true}
      />,
    )

    await waitFor(() => {
      expect(screen.getByText('View Card')).toBeInTheDocument()
    })

    // viewMode starts revealed (no Reveal button)
    expect(screen.queryByText('Reveal')).not.toBeInTheDocument()

    // Space hides
    fireEvent.keyDown(window, { key: ' ' })
    expect(screen.getByText('Reveal')).toBeInTheDocument()

    // Space reveals again
    fireEvent.keyDown(window, { key: ' ' })
    expect(screen.queryByText('Reveal')).not.toBeInTheDocument()
  })

  it('Escape key calls onExit', async () => {
    const onExit = vi.fn()
    const snips = [makeSnip()]

    render(
      <LoopCarousel
        snips={snips}
        xp={0}
        onIncrementXp={vi.fn().mockResolvedValue(0)}
        onExit={onExit}
        shuffled={false}
      />,
    )

    await waitFor(() => {
      expect(screen.getByText('Definition 1.1')).toBeInTheDocument()
    })

    fireEvent.keyDown(window, { key: 'Escape' })
    expect(onExit).toHaveBeenCalledTimes(1)
  })

  it('viewMode shows image immediately without Reveal button', async () => {
    const snips = [makeSnip({ label: 'View Card' })]
    render(
      <LoopCarousel
        snips={snips}
        xp={0}
        onIncrementXp={vi.fn().mockResolvedValue(0)}
        onExit={vi.fn()}
        shuffled={false}
        viewMode={true}
      />,
    )

    await waitFor(() => {
      expect(screen.getByText('View Card')).toBeInTheDocument()
    })

    // No Reveal button — image shown immediately
    expect(screen.queryByText('Reveal')).not.toBeInTheDocument()
  })

  it('viewMode skips XP on advance', async () => {
    const snips = [
      makeSnip({ id: 'snip-1', label: 'Card 1' }),
      makeSnip({ id: 'snip-2', label: 'Card 2' }),
    ]
    const onIncrementXp = vi.fn().mockResolvedValue(1)

    render(
      <LoopCarousel
        snips={snips}
        xp={0}
        onIncrementXp={onIncrementXp}
        onExit={vi.fn()}
        shuffled={false}
        viewMode={true}
      />,
    )

    await waitFor(() => {
      expect(screen.getByText('Card 1')).toBeInTheDocument()
    })

    // Press j to advance
    fireEvent.keyDown(window, { key: 'j' })

    await waitFor(() => {
      expect(screen.getByText('Card 2')).toBeInTheDocument()
    })

    // XP should NOT have been called
    expect(onIncrementXp).not.toHaveBeenCalled()
  })

  it('initialIndex starts at correct snip', async () => {
    const snips = [
      makeSnip({ id: 's1', label: 'First' }),
      makeSnip({ id: 's2', label: 'Second' }),
      makeSnip({ id: 's3', label: 'Third' }),
    ]

    render(
      <LoopCarousel
        snips={snips}
        xp={0}
        onIncrementXp={vi.fn().mockResolvedValue(0)}
        onExit={vi.fn()}
        shuffled={false}
        initialIndex={1}
      />,
    )

    await waitFor(() => {
      expect(screen.getByText('Second')).toBeInTheDocument()
    })
    expect(screen.getByText('2 / 3')).toBeInTheDocument()
  })

  it('renders zoom controls after reveal', async () => {
    const snips = [makeSnip()]
    render(
      <LoopCarousel
        snips={snips}
        xp={0}
        onIncrementXp={vi.fn().mockResolvedValue(0)}
        onExit={vi.fn()}
        shuffled={false}
      />,
    )

    await waitFor(() => {
      expect(screen.getByText('Definition 1.1')).toBeInTheDocument()
    })

    // Reveal first — zoom controls are part of ZoomableSnipImage
    fireEvent.click(screen.getByText('Reveal'))

    expect(screen.getByLabelText('Zoom in')).toBeInTheDocument()
    expect(screen.getByLabelText('Zoom out')).toBeInTheDocument()
    expect(screen.getByLabelText('Reset zoom')).toBeInTheDocument()
  })

  it('zoom in increases scale on the snip container', async () => {
    const snips = [makeSnip()]
    render(
      <LoopCarousel
        snips={snips}
        xp={0}
        onIncrementXp={vi.fn().mockResolvedValue(0)}
        onExit={vi.fn()}
        shuffled={false}
        viewMode={true}
      />,
    )

    await waitFor(() => {
      expect(screen.getByText('Definition 1.1')).toBeInTheDocument()
    })

    const zoomIn = screen.getByLabelText('Zoom in')
    fireEvent.click(zoomIn)

    const container = screen.getByTestId('snip-zoom-container')
    expect(container.style.transform).toBe('scale(1.25)')
  })

  it('Ctrl+= zooms in', async () => {
    const snips = [makeSnip()]
    render(
      <LoopCarousel
        snips={snips}
        xp={0}
        onIncrementXp={vi.fn().mockResolvedValue(0)}
        onExit={vi.fn()}
        shuffled={false}
        viewMode={true}
      />,
    )

    await waitFor(() => {
      expect(screen.getByText('Definition 1.1')).toBeInTheDocument()
    })

    fireEvent.keyDown(window, { key: '=', ctrlKey: true })

    const container = screen.getByTestId('snip-zoom-container')
    expect(container.style.transform).toBe('scale(1.25)')
  })

  it('Ctrl+- zooms out', async () => {
    const snips = [makeSnip()]
    render(
      <LoopCarousel
        snips={snips}
        xp={0}
        onIncrementXp={vi.fn().mockResolvedValue(0)}
        onExit={vi.fn()}
        shuffled={false}
        viewMode={true}
      />,
    )

    await waitFor(() => {
      expect(screen.getByText('Definition 1.1')).toBeInTheDocument()
    })

    fireEvent.keyDown(window, { key: '-', ctrlKey: true })

    const container = screen.getByTestId('snip-zoom-container')
    expect(container.style.transform).toBe('scale(0.75)')
  })

  it('Ctrl+0 resets zoom', async () => {
    const snips = [makeSnip()]
    render(
      <LoopCarousel
        snips={snips}
        xp={0}
        onIncrementXp={vi.fn().mockResolvedValue(0)}
        onExit={vi.fn()}
        shuffled={false}
        viewMode={true}
      />,
    )

    await waitFor(() => {
      expect(screen.getByText('Definition 1.1')).toBeInTheDocument()
    })

    // Zoom in first
    fireEvent.keyDown(window, { key: '=', ctrlKey: true })
    const container = screen.getByTestId('snip-zoom-container')
    expect(container.style.transform).toBe('scale(1.25)')

    // Reset
    fireEvent.keyDown(window, { key: '0', ctrlKey: true })
    expect(container.style.transform).toBe('scale(1)')
  })

  it('Ctrl+wheel zooms in and out', async () => {
    const snips = [makeSnip()]
    render(
      <LoopCarousel
        snips={snips}
        xp={0}
        onIncrementXp={vi.fn().mockResolvedValue(0)}
        onExit={vi.fn()}
        shuffled={false}
        viewMode={true}
      />,
    )

    await waitFor(() => {
      expect(screen.getByText('Definition 1.1')).toBeInTheDocument()
    })

    const container = screen.getByTestId('snip-zoom-container')

    // Ctrl+wheel up (deltaY < 0) → zoom in
    fireEvent.wheel(window, { deltaY: -100, ctrlKey: true })
    expect(container.style.transform).toBe('scale(1.25)')

    // Ctrl+wheel down (deltaY > 0) → zoom out
    fireEvent.wheel(window, { deltaY: 100, ctrlKey: true })
    expect(container.style.transform).toBe('scale(1)')
  })

  it('zoom resets on snip change', async () => {
    const snips = [
      makeSnip({ id: 's1', label: 'Card 1' }),
      makeSnip({ id: 's2', label: 'Card 2' }),
    ]
    render(
      <LoopCarousel
        snips={snips}
        xp={0}
        onIncrementXp={vi.fn().mockResolvedValue(0)}
        onExit={vi.fn()}
        shuffled={false}
        viewMode={true}
      />,
    )

    await waitFor(() => {
      expect(screen.getByText('Card 1')).toBeInTheDocument()
    })

    // Zoom in
    fireEvent.click(screen.getByLabelText('Zoom in'))
    const container = screen.getByTestId('snip-zoom-container')
    expect(container.style.transform).toBe('scale(1.25)')

    // Advance to next snip
    fireEvent.keyDown(window, { key: 'j' })

    await waitFor(() => {
      expect(screen.getByText('Card 2')).toBeInTheDocument()
    })

    // Zoom should reset
    expect(container.style.transform).toBe('scale(1)')
  })

  it('XP counter updates after navigation', async () => {
    const snips = [
      makeSnip({ id: 'snip-1', label: 'A' }),
      makeSnip({ id: 'snip-2', label: 'B' }),
    ]
    const onIncrementXp = vi.fn().mockResolvedValue(10)

    render(
      <LoopCarousel
        snips={snips}
        xp={5}
        onIncrementXp={onIncrementXp}
        onExit={vi.fn()}
        shuffled={false}
      />,
    )

    await waitFor(() => {
      expect(screen.getByText('5 XP')).toBeInTheDocument()
    })

    // Navigate next
    fireEvent.keyDown(window, { key: 'j' })

    await waitFor(() => {
      expect(screen.getByText('10 XP')).toBeInTheDocument()
    })
  })

  it('notes panel hidden by default', async () => {
    const snips = [makeSnip()]
    render(
      <LoopCarousel
        snips={snips}
        xp={0}
        onIncrementXp={vi.fn().mockResolvedValue(0)}
        onExit={vi.fn()}
        shuffled={false}
      />,
    )

    await waitFor(() => {
      expect(screen.getByText('Definition 1.1')).toBeInTheDocument()
    })

    expect(screen.queryByTestId('notes-panel')).not.toBeInTheDocument()
  })

  it('Ctrl+L opens notes panel for current snip', async () => {
    const snips = [makeSnip({ slug: 'algebra', page: 3 })]
    render(
      <LoopCarousel
        snips={snips}
        xp={0}
        onIncrementXp={vi.fn().mockResolvedValue(0)}
        onExit={vi.fn()}
        shuffled={false}
      />,
    )

    await waitFor(() => {
      expect(screen.getByText('Definition 1.1')).toBeInTheDocument()
    })

    fireEvent.keyDown(window, { key: 'l', ctrlKey: true })

    expect(screen.getByTestId('notes-panel')).toBeInTheDocument()
    expect(screen.getByTestId('notes-panel')).toHaveAttribute('data-slug', 'algebra')
    expect(screen.getByTestId('notes-panel')).toHaveAttribute('data-page', '3')
  })

  it('notes panel updates slug/page on snip navigation', async () => {
    const snips = [
      makeSnip({ id: 's1', slug: 'algebra', page: 1, label: 'Card 1' }),
      makeSnip({ id: 's2', slug: 'algebra', page: 5, label: 'Card 2' }),
    ]
    render(
      <LoopCarousel
        snips={snips}
        xp={0}
        onIncrementXp={vi.fn().mockResolvedValue(0)}
        onExit={vi.fn()}
        shuffled={false}
      />,
    )

    await waitFor(() => {
      expect(screen.getByText('Card 1')).toBeInTheDocument()
    })

    // Open notes
    fireEvent.keyDown(window, { key: 'l', ctrlKey: true })
    expect(screen.getByTestId('notes-panel')).toHaveAttribute('data-page', '1')

    // Navigate to next snip
    fireEvent.keyDown(window, { key: 'j' })
    await waitFor(() => {
      expect(screen.getByText('Card 2')).toBeInTheDocument()
    })

    expect(screen.getByTestId('notes-panel')).toHaveAttribute('data-page', '5')
  })

  it('Ctrl+H exits carousel when notes closed', async () => {
    const onExit = vi.fn()
    const snips = [makeSnip()]
    render(
      <LoopCarousel
        snips={snips}
        xp={0}
        onIncrementXp={vi.fn().mockResolvedValue(0)}
        onExit={onExit}
        shuffled={false}
      />,
    )

    await waitFor(() => {
      expect(screen.getByText('Definition 1.1')).toBeInTheDocument()
    })

    fireEvent.keyDown(window, { key: 'h', ctrlKey: true })
    expect(onExit).toHaveBeenCalledTimes(1)
  })

  it('noXp hides XP counter', async () => {
    const snips = [makeSnip()]
    render(
      <LoopCarousel
        snips={snips}
        xp={42}
        onIncrementXp={vi.fn().mockResolvedValue(43)}
        onExit={vi.fn()}
        shuffled={false}
        noXp={true}
      />,
    )
    await waitFor(() => {
      expect(screen.getByText('Definition 1.1')).toBeInTheDocument()
    })
    expect(screen.queryByText(/XP/)).not.toBeInTheDocument()
  })

  it('noXp still tracks XP on advance', async () => {
    const snips = [
      makeSnip({ id: 's1', label: 'Card A' }),
      makeSnip({ id: 's2', label: 'Card B' }),
    ]
    const onIncrementXp = vi.fn().mockResolvedValue(1)
    render(
      <LoopCarousel
        snips={snips}
        xp={0}
        onIncrementXp={onIncrementXp}
        onExit={vi.fn()}
        shuffled={false}
        noXp={true}
      />,
    )
    await waitFor(() => {
      expect(screen.getByText('Card A')).toBeInTheDocument()
    })
    fireEvent.keyDown(window, { key: 'j' })
    await waitFor(() => {
      expect(screen.getByText('Card B')).toBeInTheDocument()
    })
    expect(onIncrementXp).toHaveBeenCalledTimes(1)
  })

  it('shuffle toggle button shows "Sorted" label in normal mode', async () => {
    const snips = [makeSnip()]
    render(
      <LoopCarousel
        snips={snips}
        xp={0}
        onIncrementXp={vi.fn().mockResolvedValue(0)}
        onExit={vi.fn()}
        shuffled={false}
      />,
    )
    await waitFor(() => {
      expect(screen.getByText('Definition 1.1')).toBeInTheDocument()
    })
    const btn = screen.getByLabelText('Toggle shuffle')
    expect(btn).toBeInTheDocument()
    expect(btn).toHaveTextContent('Sorted')
  })

  it('shuffle toggle button not visible in viewMode', async () => {
    const snips = [makeSnip()]
    render(
      <LoopCarousel
        snips={snips}
        xp={0}
        onIncrementXp={vi.fn().mockResolvedValue(0)}
        onExit={vi.fn()}
        shuffled={false}
        viewMode={true}
      />,
    )
    await waitFor(() => {
      expect(screen.getByText('Definition 1.1')).toBeInTheDocument()
    })
    expect(screen.queryByLabelText('Toggle shuffle')).not.toBeInTheDocument()
  })

  it('re-shuffles after completing a full loop in shuffle mode', async () => {
    const snips = [
      makeSnip({ id: 's1', label: 'Card A' }),
      makeSnip({ id: 's2', label: 'Card B' }),
    ]
    // Initial shuffle: Math.random()=0.9 → j=floor(0.9*2)=1 → swap[1][1] → no change → [A,B]
    // Re-shuffle:      Math.random()=0.0 → j=floor(0.0*2)=0 → swap[1][0] → [B,A]
    let callCount = 0
    const mockRandom = vi.spyOn(Math, 'random').mockImplementation(() => callCount++ === 0 ? 0.9 : 0)

    render(
      <LoopCarousel
        snips={snips}
        xp={0}
        onIncrementXp={vi.fn().mockResolvedValue(0)}
        onExit={vi.fn()}
        shuffled={true}
      />,
    )

    // Initial order [A, B] — first card is A
    await waitFor(() => {
      expect(screen.getByText('Card A')).toBeInTheDocument()
    })
    expect(screen.getByText('1 / 2')).toBeInTheDocument()

    // Advance to B (index 1)
    fireEvent.keyDown(window, { key: 'j' })
    await waitFor(() => {
      expect(screen.getByText('Card B')).toBeInTheDocument()
    })

    // Advance from last card → triggers re-shuffle → [B, A], index=0 → shows B at "1 / 2"
    fireEvent.keyDown(window, { key: 'j' })
    await waitFor(() => {
      expect(screen.getByText('Card B')).toBeInTheDocument()
    })
    expect(screen.getByText('1 / 2')).toBeInTheDocument()

    mockRandom.mockRestore()
  })

  it('j/k still navigate when notes open but editor not focused', async () => {
    const snips = [
      makeSnip({ id: 's1', label: 'Card 1' }),
      makeSnip({ id: 's2', label: 'Card 2' }),
    ]
    render(
      <LoopCarousel
        snips={snips}
        xp={0}
        onIncrementXp={vi.fn().mockResolvedValue(0)}
        onExit={vi.fn()}
        shuffled={false}
      />,
    )

    await waitFor(() => {
      expect(screen.getByText('Card 1')).toBeInTheDocument()
    })

    // Open notes panel
    fireEvent.keyDown(window, { key: 'l', ctrlKey: true })
    expect(screen.getByTestId('notes-panel')).toBeInTheDocument()

    // j should still advance (no .cm-editor is focused in test env)
    fireEvent.keyDown(window, { key: 'j' })
    await waitFor(() => {
      expect(screen.getByText('Card 2')).toBeInTheDocument()
    })
  })

  it('r key opens rename input with current label', async () => {
    const onRename = vi.fn().mockResolvedValue(undefined)
    const snips = [makeSnip({ id: 's1', label: 'Old Name' })]
    render(
      <LoopCarousel snips={snips} xp={0} onIncrementXp={vi.fn().mockResolvedValue(0)} onExit={vi.fn()} shuffled={false} onRename={onRename} dirPath="/lib" />,
    )
    await waitFor(() => expect(screen.getByText('Old Name')).toBeInTheDocument())

    fireEvent.keyDown(window, { key: 'r' })
    const input = screen.getByDisplayValue('Old Name')
    expect(input).toBeInTheDocument()
  })

  it('rename commits on Enter and updates label', async () => {
    const onRename = vi.fn().mockResolvedValue(undefined)
    const snips = [makeSnip({ id: 's1', label: 'Old Name' })]
    render(
      <LoopCarousel snips={snips} xp={0} onIncrementXp={vi.fn().mockResolvedValue(0)} onExit={vi.fn()} shuffled={false} onRename={onRename} dirPath="/lib" />,
    )
    await waitFor(() => expect(screen.getByText('Old Name')).toBeInTheDocument())

    fireEvent.keyDown(window, { key: 'r' })
    const input = screen.getByDisplayValue('Old Name')
    fireEvent.change(input, { target: { value: 'New Name' } })
    fireEvent.keyDown(input, { key: 'Enter' })

    await waitFor(() => {
      expect(onRename).toHaveBeenCalledWith('/lib', 's1', 'New Name')
      expect(screen.getByText('New Name')).toBeInTheDocument()
    })
  })

  it('rename cancels on Escape without calling onRename', async () => {
    const onRename = vi.fn().mockResolvedValue(undefined)
    const snips = [makeSnip({ id: 's1', label: 'Keep Me' })]
    render(
      <LoopCarousel snips={snips} xp={0} onIncrementXp={vi.fn().mockResolvedValue(0)} onExit={vi.fn()} shuffled={false} onRename={onRename} dirPath="/lib" />,
    )
    await waitFor(() => expect(screen.getByText('Keep Me')).toBeInTheDocument())

    fireEvent.keyDown(window, { key: 'r' })
    const input = screen.getByDisplayValue('Keep Me')
    fireEvent.change(input, { target: { value: 'Changed' } })
    fireEvent.keyDown(input, { key: 'Escape' })

    expect(onRename).not.toHaveBeenCalled()
    await waitFor(() => expect(screen.getByText('Keep Me')).toBeInTheDocument())
  })

  it('double-click on label opens rename input', async () => {
    const onRename = vi.fn().mockResolvedValue(undefined)
    const snips = [makeSnip({ id: 's1', label: 'Click Me' })]
    render(
      <LoopCarousel snips={snips} xp={0} onIncrementXp={vi.fn().mockResolvedValue(0)} onExit={vi.fn()} shuffled={false} onRename={onRename} dirPath="/lib" />,
    )
    await waitFor(() => expect(screen.getByText('Click Me')).toBeInTheDocument())

    fireEvent.doubleClick(screen.getByText('Click Me'))
    expect(screen.getByDisplayValue('Click Me')).toBeInTheDocument()
  })

  it('o key calls onNavigateToSnip with current snip', async () => {
    const onNav = vi.fn()
    const snips = [makeSnip({ id: 's1', slug: 'algebra', page: 5, label: 'Nav Me' })]
    render(
      <LoopCarousel snips={snips} xp={0} onIncrementXp={vi.fn().mockResolvedValue(0)} onExit={vi.fn()} shuffled={false} onNavigateToSnip={onNav} />,
    )
    await waitFor(() => expect(screen.getByText('Nav Me')).toBeInTheDocument())

    fireEvent.keyDown(window, { key: 'o' })
    expect(onNav).toHaveBeenCalledWith(expect.objectContaining({ id: 's1', slug: 'algebra', page: 5 }))
  })

  it('o key does nothing when onNavigateToSnip is not provided', async () => {
    const onExit = vi.fn()
    const snips = [makeSnip({ label: 'No nav' })]
    render(
      <LoopCarousel snips={snips} xp={0} onIncrementXp={vi.fn().mockResolvedValue(0)} onExit={onExit} shuffled={false} />,
    )
    await waitFor(() => expect(screen.getByText('No nav')).toBeInTheDocument())

    fireEvent.keyDown(window, { key: 'o' })
    expect(onExit).not.toHaveBeenCalled() // no crash, no side effects
  })

  it('shuffle toggle shows "Shuffled" after clicking', async () => {
    const snips = [makeSnip({ id: 's1', label: 'A' }), makeSnip({ id: 's2', label: 'B' })]
    render(
      <LoopCarousel snips={snips} xp={0} onIncrementXp={vi.fn().mockResolvedValue(0)} onExit={vi.fn()} shuffled={false} />,
    )
    await waitFor(() => expect(screen.getByLabelText('Toggle shuffle')).toBeInTheDocument())

    const btn = screen.getByLabelText('Toggle shuffle')
    expect(btn).toHaveTextContent('Sorted')
    fireEvent.click(btn)
    expect(btn).toHaveTextContent('Shuffled')
  })
})
