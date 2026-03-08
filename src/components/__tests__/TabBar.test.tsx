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
  it('renders nothing when only one tab', () => {
    const { container } = render(
      <TabBar
        tabs={[tabs[0]]}
        activeSlug="book-a"
        onSelect={vi.fn()}
        onClose={vi.fn()}
        onCloseOthers={vi.fn()}
      />,
    )
    expect(container.innerHTML).toBe('')
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
})
