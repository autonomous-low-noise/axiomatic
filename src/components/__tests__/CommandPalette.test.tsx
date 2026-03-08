import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi, beforeAll } from 'vitest'
import { CommandPalette, type Command } from '../CommandPalette'

beforeAll(() => {
  // jsdom doesn't implement scrollIntoView
  Element.prototype.scrollIntoView = vi.fn()
})

const commands: Command[] = [
  { id: 'theme-toggle', label: 'Switch to dark mode', action: vi.fn() },
  { id: 'toggle-outline', label: 'Toggle outline', shortcut: 'Ctrl+B', action: vi.fn() },
  { id: 'toggle-notes', label: 'Toggle notes', shortcut: 'Ctrl+L', action: vi.fn() },
  { id: 'toggle-zen', label: 'Toggle zen mode', action: vi.fn() },
]

function renderPalette(onClose = vi.fn()) {
  return render(<CommandPalette commands={commands} onClose={onClose} />)
}

describe('CommandPalette', () => {
  it('renders all commands when query is empty', () => {
    renderPalette()
    for (const cmd of commands) {
      expect(screen.getByText(cmd.label)).toBeInTheDocument()
    }
  })

  it('filters commands case-insensitively', () => {
    renderPalette()
    const input = screen.getByPlaceholderText('Type a command…')
    fireEvent.change(input, { target: { value: 'zen' } })

    expect(screen.getByText('Toggle zen mode')).toBeInTheDocument()
    expect(screen.queryByText('Switch to dark mode')).toBeNull()
    expect(screen.queryByText('Toggle outline')).toBeNull()
  })

  it('shows "No matching commands" when filter has no results', () => {
    renderPalette()
    const input = screen.getByPlaceholderText('Type a command…')
    fireEvent.change(input, { target: { value: 'xyznonexistent' } })

    expect(screen.getByText('No matching commands')).toBeInTheDocument()
  })

  it('shows keyboard shortcuts when present', () => {
    renderPalette()
    expect(screen.getByText('Ctrl+B')).toBeInTheDocument()
    expect(screen.getByText('Ctrl+L')).toBeInTheDocument()
  })

  it('Enter executes selected command and closes palette', () => {
    const onClose = vi.fn()
    renderPalette(onClose)
    const input = screen.getByPlaceholderText('Type a command…')

    // First command is selected by default
    fireEvent.keyDown(input, { key: 'Enter' })

    expect(commands[0].action).toHaveBeenCalledTimes(1)
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('Escape calls onClose', () => {
    const onClose = vi.fn()
    renderPalette(onClose)
    const input = screen.getByPlaceholderText('Type a command…')

    fireEvent.keyDown(input, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('ArrowDown moves selection and Enter executes it', () => {
    const onClose = vi.fn()
    const cmds = commands.map((c) => ({ ...c, action: vi.fn() }))
    render(<CommandPalette commands={cmds} onClose={onClose} />)

    // The palette div has onKeyDown — use it via the wrapper
    const wrapper = screen.getByPlaceholderText('Type a command…').parentElement!.parentElement!
    fireEvent.keyDown(wrapper, { key: 'ArrowDown' })
    fireEvent.keyDown(wrapper, { key: 'Enter' })

    // Second command should have been executed (index 1)
    expect(cmds[0].action).not.toHaveBeenCalled()
    expect(cmds[1].action).toHaveBeenCalledTimes(1)
  })

  it('clicking a command executes it', () => {
    const onClose = vi.fn()
    renderPalette(onClose)
    fireEvent.click(screen.getByText('Toggle zen mode'))

    expect(commands[3].action).toHaveBeenCalled()
    expect(onClose).toHaveBeenCalled()
  })
})
