import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

import { TagManager } from '../TagManager'
import type { Tag } from '../../hooks/useTags'
import { TAG_PALETTE } from '../../lib/tagPalette'

beforeEach(() => {
  vi.restoreAllMocks()
})

function renderManager(onClose = vi.fn(), tags: Tag[] = [], overrides: Partial<Parameters<typeof TagManager>[0]> = {}) {
  const anchor = document.createElement('button')
  anchor.getBoundingClientRect = () => ({ left: 100, top: 50, bottom: 70, right: 200, width: 100, height: 20, x: 100, y: 50, toJSON: () => '' })
  document.body.appendChild(anchor)
  const ref = { current: anchor }
  const props = {
    tags,
    anchorRef: ref,
    onCreate: vi.fn(),
    onDelete: vi.fn(),
    onUpdateColor: vi.fn(),
    onClose,
    ...overrides,
  }
  const result = render(<TagManager {...props} />)
  return { onClose, props, ...result }
}

describe('TagManager', () => {
  it('Escape in "New tag" input closes the manager', () => {
    const { onClose } = renderManager()
    const input = screen.getByPlaceholderText('New tag…')
    input.focus()
    fireEvent.keyDown(input, { key: 'Escape', bubbles: true })
    expect(onClose).toHaveBeenCalled()
  })

  it('shows the empty state when no tags exist', () => {
    renderManager()
    expect(screen.getByText('No tags yet')).toBeInTheDocument()
  })

  it('Enter in "New tag" input creates a tag with the next palette color and clears the input', () => {
    const tags: Tag[] = [{ id: 1, name: 'algebra', color: TAG_PALETTE[0] }]
    const { props } = renderManager(vi.fn(), tags)
    const input = screen.getByPlaceholderText('New tag…') as HTMLInputElement
    fireEvent.change(input, { target: { value: '  topology  ' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(props.onCreate).toHaveBeenCalledWith('topology', TAG_PALETTE[1])
    expect(input.value).toBe('')
  })

  it('the delete button calls onDelete with the tag id', () => {
    const tags: Tag[] = [{ id: 7, name: 'algebra', color: TAG_PALETTE[0] }]
    const { props } = renderManager(vi.fn(), tags)
    fireEvent.click(screen.getByRole('button', { name: 'Delete algebra' }))
    expect(props.onDelete).toHaveBeenCalledWith(7)
  })

  it('the color swatch input calls onUpdateColor with the tag id', () => {
    const tags: Tag[] = [{ id: 7, name: 'algebra', color: '#268bd2' }]
    const { props } = renderManager(vi.fn(), tags)
    const colorInput = document.body.querySelector('input[type="color"]') as HTMLInputElement
    expect(colorInput).not.toBeNull()
    fireEvent.change(colorInput, { target: { value: '#859900' } })
    expect(props.onUpdateColor).toHaveBeenCalledWith(7, '#859900')
  })
})
