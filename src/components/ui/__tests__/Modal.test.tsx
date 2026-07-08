import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { Modal } from '../Modal'

describe('Modal', () => {
  it('renders children inside a dialog', () => {
    render(
      <Modal onClose={vi.fn()} ariaLabel="Test dialog">
        <p>body</p>
      </Modal>,
    )
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getByText('body')).toBeInTheDocument()
  })

  it('Escape closes', () => {
    const onClose = vi.fn()
    render(
      <Modal onClose={onClose} ariaLabel="Test dialog">
        <p>body</p>
      </Modal>,
    )
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('mousedown on the scrim closes, inside the card does not', () => {
    const onClose = vi.fn()
    render(
      <Modal onClose={onClose} ariaLabel="Test dialog">
        <p>body</p>
      </Modal>,
    )
    fireEvent.mouseDown(screen.getByText('body'))
    expect(onClose).not.toHaveBeenCalled()
    fireEvent.mouseDown(screen.getByTestId('modal-scrim'))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('traps Tab focus within the dialog', () => {
    render(
      <Modal onClose={vi.fn()} ariaLabel="Test dialog">
        <button>first</button>
        <button>last</button>
      </Modal>,
    )
    const first = screen.getByText('first')
    const last = screen.getByText('last')

    // Tab past the last focusable wraps to the first
    last.focus()
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Tab' })
    expect(first).toHaveFocus()

    // Shift+Tab from the first wraps to the last
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Tab', shiftKey: true })
    expect(last).toHaveFocus()
  })

  it('focuses the dialog on mount so keyboard users are inside it', () => {
    render(
      <Modal onClose={vi.fn()} ariaLabel="Test dialog">
        <p>body</p>
      </Modal>,
    )
    expect(document.activeElement).toBe(screen.getByRole('dialog'))
  })
})
