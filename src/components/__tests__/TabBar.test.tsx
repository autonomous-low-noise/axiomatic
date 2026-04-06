import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { TabBar } from '../TabBar'
import type { OpenTab } from '../../hooks/useTabs'

const tabs: OpenTab[] = [
  { slug: 'book-a', title: 'Linear Algebra', fullPath: '/a.pdf', route: '/read/book-a' },
  { slug: 'book-b', title: 'Real Analysis', fullPath: '/b.pdf', route: '/read/book-b' },
  { slug: 'book-c', title: 'Topology', fullPath: '/c.pdf', route: '/read/book-c' },
]

function renderTabBar(overrides: Partial<Parameters<typeof TabBar>[0]> = {}) {
  return render(
    <TabBar
      tabs={tabs}
      activeSlug="book-b"
      onSelect={vi.fn()}
      onClose={vi.fn()}
      onCloseOthers={vi.fn()}
      {...overrides}
    />,
  )
}

describe('TabBar', () => {
  it('renders nothing when zero tabs', () => {
    const { container } = render(
      <TabBar
        tabs={[]}
        activeSlug={null}
        onSelect={vi.fn()}
        onClose={vi.fn()}
        onCloseOthers={vi.fn()}
      />,
    )
    expect(container.innerHTML).toBe('')
  })

  it('renders single tab with close button', () => {
    render(
      <TabBar
        tabs={[tabs[0]]}
        activeSlug="book-a"
        onSelect={vi.fn()}
        onClose={vi.fn()}
        onCloseOthers={vi.fn()}
      />,
    )
    expect(screen.getByText('Linear Algebra')).toBeInTheDocument()
    expect(screen.getByLabelText('Close Linear Algebra')).toBeInTheDocument()
  })

  it('renders all tab titles', () => {
    renderTabBar()
    expect(screen.getByText('Linear Algebra')).toBeInTheDocument()
    expect(screen.getByText('Real Analysis')).toBeInTheDocument()
    expect(screen.getByText('Topology')).toBeInTheDocument()
  })

  it('marks active tab with aria-selected', () => {
    renderTabBar()
    const activeTabs = screen.getAllByRole('tab')
    const active = activeTabs.find((t) => t.getAttribute('aria-selected') === 'true')
    expect(active).toBeDefined()
    expect(active!.textContent).toContain('Real Analysis')
  })

  it('calls onSelect when tab is clicked', () => {
    const onSelect = vi.fn()
    renderTabBar({ onSelect })
    fireEvent.click(screen.getByText('Topology'))
    expect(onSelect).toHaveBeenCalledWith('book-c')
  })

  it('calls onClose when close button is clicked', () => {
    const onClose = vi.fn()
    renderTabBar({ onClose })
    const closeBtn = screen.getByLabelText('Close Real Analysis')
    fireEvent.click(closeBtn)
    expect(onClose).toHaveBeenCalledWith('book-b')
  })

  it('close button click does not trigger tab select', () => {
    const onSelect = vi.fn()
    const onClose = vi.fn()
    renderTabBar({ onSelect, onClose })
    const closeBtn = screen.getByLabelText('Close Linear Algebra')
    fireEvent.click(closeBtn)
    expect(onClose).toHaveBeenCalledWith('book-a')
    expect(onSelect).not.toHaveBeenCalled()
  })

  it('shows context menu on right-click with Close and Close Others', () => {
    renderTabBar()
    const tab = screen.getAllByRole('tab')[0]
    fireEvent.contextMenu(tab)
    expect(screen.getByText('Close')).toBeInTheDocument()
    expect(screen.getByText('Close Others')).toBeInTheDocument()
  })

  it('context menu Close calls onClose', () => {
    const onClose = vi.fn()
    renderTabBar({ onClose })
    const tab = screen.getAllByRole('tab')[2] // Topology
    fireEvent.contextMenu(tab)
    fireEvent.click(screen.getByText('Close'))
    expect(onClose).toHaveBeenCalledWith('book-c')
  })

  it('context menu Close Others calls onCloseOthers', () => {
    const onCloseOthers = vi.fn()
    renderTabBar({ onCloseOthers })
    const tab = screen.getAllByRole('tab')[1] // Real Analysis
    fireEvent.contextMenu(tab)
    fireEvent.click(screen.getByText('Close Others'))
    expect(onCloseOthers).toHaveBeenCalledWith('book-b')
  })

  it('context menu shows Close to the Left for non-first tab', () => {
    const onCloseToLeft = vi.fn()
    renderTabBar({ onCloseToLeft })
    const tab = screen.getAllByRole('tab')[1] // Real Analysis (middle)
    fireEvent.contextMenu(tab)
    expect(screen.getByText('Close to the Left')).toBeInTheDocument()
    fireEvent.click(screen.getByText('Close to the Left'))
    expect(onCloseToLeft).toHaveBeenCalledWith('book-b')
  })

  it('context menu hides Close to the Left for first tab', () => {
    const onCloseToLeft = vi.fn()
    renderTabBar({ onCloseToLeft })
    const tab = screen.getAllByRole('tab')[0] // Linear Algebra (first)
    fireEvent.contextMenu(tab)
    expect(screen.queryByText('Close to the Left')).not.toBeInTheDocument()
  })

  it('context menu shows Close to the Right for non-last tab', () => {
    const onCloseToRight = vi.fn()
    renderTabBar({ onCloseToRight })
    const tab = screen.getAllByRole('tab')[1] // Real Analysis (middle)
    fireEvent.contextMenu(tab)
    expect(screen.getByText('Close to the Right')).toBeInTheDocument()
    fireEvent.click(screen.getByText('Close to the Right'))
    expect(onCloseToRight).toHaveBeenCalledWith('book-b')
  })

  it('context menu hides Close to the Right for last tab', () => {
    const onCloseToRight = vi.fn()
    renderTabBar({ onCloseToRight })
    const tab = screen.getAllByRole('tab')[2] // Topology (last)
    fireEvent.contextMenu(tab)
    expect(screen.queryByText('Close to the Right')).not.toBeInTheDocument()
  })
})
