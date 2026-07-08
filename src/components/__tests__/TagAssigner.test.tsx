import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

import { TagAssigner } from '../TagAssigner'
import type { Tag } from '../../hooks/useTags'

const TAGS: Tag[] = [
  { id: 1, name: 'algebra', color: '#268bd2' },
  { id: 2, name: 'topology', color: '#859900' },
]

function renderAssigner(overrides: Partial<Parameters<typeof TagAssigner>[0]> = {}) {
  const props = {
    slug: 'my-book',
    title: 'My Book Title',
    tags: TAGS,
    bookTags: [TAGS[0]],
    onTag: vi.fn(),
    onUntag: vi.fn(),
    onClose: vi.fn(),
    ...overrides,
  }
  const result = render(<TagAssigner {...props} />)
  return { props, ...result }
}

describe('TagAssigner', () => {
  it('renders the panel title and the book title', () => {
    renderAssigner()
    expect(screen.getByText('Tags')).toBeInTheDocument()
    expect(screen.getByText('My Book Title')).toBeInTheDocument()
  })

  it('renders one checkbox per tag reflecting assignment state', () => {
    renderAssigner()
    const assigned = screen.getByRole('checkbox', { name: /algebra/ }) as HTMLInputElement
    const unassigned = screen.getByRole('checkbox', { name: /topology/ }) as HTMLInputElement
    expect(assigned.checked).toBe(true)
    expect(unassigned.checked).toBe(false)
  })

  it('checking an unassigned tag calls onTag with slug and tag id', () => {
    const { props } = renderAssigner()
    fireEvent.click(screen.getByRole('checkbox', { name: /topology/ }))
    expect(props.onTag).toHaveBeenCalledWith('my-book', 2)
    expect(props.onUntag).not.toHaveBeenCalled()
  })

  it('unchecking an assigned tag calls onUntag with slug and tag id', () => {
    const { props } = renderAssigner()
    fireEvent.click(screen.getByRole('checkbox', { name: /algebra/ }))
    expect(props.onUntag).toHaveBeenCalledWith('my-book', 1)
    expect(props.onTag).not.toHaveBeenCalled()
  })

  it('shows the empty state when no tags exist', () => {
    renderAssigner({ tags: [], bookTags: [] })
    expect(screen.getByText('No tags created yet.')).toBeInTheDocument()
    expect(screen.queryAllByRole('checkbox')).toHaveLength(0)
  })

  it('Escape calls onClose', () => {
    const { props } = renderAssigner()
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(props.onClose).toHaveBeenCalledTimes(1)
  })

  it('the close button calls onClose', () => {
    const { props } = renderAssigner()
    fireEvent.click(screen.getByRole('button', { name: /close/i }))
    expect(props.onClose).toHaveBeenCalledTimes(1)
  })
})
