import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

import { SnipTagManager } from '../SnipTagManager'
import type { SnipTagDef } from '../../hooks/useSnipTagDefs'
import { TAG_PALETTE } from '../../lib/tagPalette'

beforeEach(() => {
  vi.restoreAllMocks()
})

function renderManager(onClose = vi.fn(), defs: SnipTagDef[] = []) {
  const anchor = document.createElement('button')
  anchor.getBoundingClientRect = () => ({ left: 100, top: 50, bottom: 70, right: 200, width: 100, height: 20, x: 100, y: 50, toJSON: () => '' })
  document.body.appendChild(anchor)
  const ref = { current: anchor }
  const props = {
    defs,
    anchorRef: ref,
    onCreate: vi.fn(),
    onDelete: vi.fn(),
    onRename: vi.fn(),
    onRecolor: vi.fn(),
    onClose,
  }
  const result = render(<SnipTagManager {...props} />)
  return { onClose, props, ...result }
}

describe('SnipTagManager', () => {
  it('Escape in "New tag" input closes the manager', () => {
    const { onClose } = renderManager()
    const input = screen.getByPlaceholderText('New tag…')
    input.focus()
    fireEvent.keyDown(input, { key: 'Escape', bubbles: true })
    expect(onClose).toHaveBeenCalled()
  })

  it('shows the empty state when no snip tags exist', () => {
    renderManager()
    expect(screen.getByText('No snip tags yet')).toBeInTheDocument()
  })

  it('Enter in "New tag" input creates a def with the next palette color and clears the input', () => {
    const { props } = renderManager(vi.fn(), [{ name: 'lemma', color: TAG_PALETTE[0] }])
    const input = screen.getByPlaceholderText('New tag…') as HTMLInputElement
    fireEvent.change(input, { target: { value: 'proof' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(props.onCreate).toHaveBeenCalledWith('proof', TAG_PALETTE[1])
    expect(input.value).toBe('')
  })

  it('the delete button calls onDelete with the def name', () => {
    const { props } = renderManager(vi.fn(), [{ name: 'lemma', color: TAG_PALETTE[0] }])
    fireEvent.click(screen.getByRole('button', { name: 'Delete lemma' }))
    expect(props.onDelete).toHaveBeenCalledWith('lemma')
  })

  it('the color swatch input calls onRecolor with the def name', () => {
    const { props } = renderManager(vi.fn(), [{ name: 'lemma', color: '#268bd2' }])
    const colorInput = document.body.querySelector('input[type="color"]') as HTMLInputElement
    fireEvent.change(colorInput, { target: { value: '#859900' } })
    expect(props.onRecolor).toHaveBeenCalledWith('lemma', '#859900')
  })

  it('double-click renames: Enter commits via onRename(old, new)', () => {
    const { props } = renderManager(vi.fn(), [{ name: 'lemma', color: TAG_PALETTE[0] }])
    fireEvent.doubleClick(screen.getByText('lemma'))
    const editInput = screen.getByDisplayValue('lemma')
    fireEvent.change(editInput, { target: { value: 'theorem' } })
    fireEvent.keyDown(editInput, { key: 'Enter' })
    expect(props.onRename).toHaveBeenCalledWith('lemma', 'theorem')
  })

  it('double-click renames: blur commits via onRename(old, new)', () => {
    const { props } = renderManager(vi.fn(), [{ name: 'lemma', color: TAG_PALETTE[0] }])
    fireEvent.doubleClick(screen.getByText('lemma'))
    const editInput = screen.getByDisplayValue('lemma')
    fireEvent.change(editInput, { target: { value: 'theorem' } })
    fireEvent.blur(editInput)
    expect(props.onRename).toHaveBeenCalledWith('lemma', 'theorem')
  })

  it('Escape cancels the rename without calling onRename', () => {
    const { props } = renderManager(vi.fn(), [{ name: 'lemma', color: TAG_PALETTE[0] }])
    fireEvent.doubleClick(screen.getByText('lemma'))
    const editInput = screen.getByDisplayValue('lemma')
    fireEvent.change(editInput, { target: { value: 'theorem' } })
    fireEvent.keyDown(editInput, { key: 'Escape' })
    expect(props.onRename).not.toHaveBeenCalled()
    expect(screen.getByText('lemma')).toBeInTheDocument()
  })
})
